<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { showModeLabels } from '$lib/config/presentation';
  import '@fontsource-variable/nunito-sans';
  import '../../design/tokens.css';
  import '$lib/styles.css';
  import {
    GitBranch,
    Check,
    Circle,
    Layers,
    Settings2,
    FolderOpen,
    HardDrive,
    Download,
    Plus,
    ArrowLeft,
    ArrowRight,
    ArrowUpRight,
    Sun,
    Moon,
    HelpCircle,
    Sprout,
    Zap,
    Upload,
    Trash2,
    Clock,
    ExternalLink,
    X,
    RefreshCw,
    AlertTriangle,
    BookOpen,
    Undo2,
    Redo2
  } from '@lucide/svelte';
  import {
    stages,
    newProject,
    parseProject,
    id,
    now,
    uncertainties,
    spent,
    reserved,
    uncertainSpend,
    canSpend,
    prerequisite,
    modelName,
    workflowStages,
    canonicalStage,
    stageIsComplete,
    stageNeedsReview,
    completedStageCount,
    coreStageCount,
    MODEL_SETUP_STAGE,
    type Project,
    type Change,
    type Run
  } from '$lib/domain/project';
  import { exampleProject } from '$lib/domain/example';
  import {
    listProjects,
    saveProject,
    deleteProject,
    preference,
    recoverInterrupted
  } from '$lib/storage/projects';
  import {
    launch,
    getModels,
    testKey,
    planRequests,
    responseText,
    isRunnableTask,
    type Model,
    type Operation,
    type Task,
    type NarrativeOptions,
    type ChainGenerationOptions
  } from '$lib/ai/openrouter';
  import { download, projectJSON, filename } from '$lib/export/files';
  import Chains from '$lib/components/Chains.svelte';
  import Drivers from '$lib/components/Drivers.svelte';
  import Assessment from '$lib/components/Assessment.svelte';
  import Hypotheses from '$lib/components/Hypotheses.svelte';
  import Writing from '$lib/components/Writing.svelte';
  import Setup from '$lib/components/Setup.svelte';
  import ModelSetup from '$lib/components/ModelSetup.svelte';
  import OpenRouterConnection from '$lib/components/OpenRouterConnection.svelte';
  import ExerciseBudget from '$lib/components/ExerciseBudget.svelte';
  import Exports from '$lib/components/Exports.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import HelpDialog from '$lib/components/HelpDialog.svelte';
  import ModelActivity from '$lib/components/ModelActivity.svelte';
  import ModelPicker from '$lib/components/ModelPicker.svelte';
  import StageModelSettings from '$lib/components/StageModelSettings.svelte';
  import {
    FUSION_MODEL,
    requestModels,
    selectionMode,
    type ModelMode,
    type ReasoningEffort
  } from '$lib/domain/model-settings';
  import { prerequisiteStage } from '$lib/domain/workflow';
  import PageWalkthrough from '$lib/components/PageWalkthrough.svelte';
  import { walkthroughId } from '$lib/walkthroughs';

  let project = $state<Project | null>(null);
  let projects = $state<Project[]>([]);
  let loaded = $state(false);
  let saveState = $state('');
  let announcement = $state('');
  let error = $state('');
  let theme = $state('light');
  let topbarHeight = $state(72);
  let dialog = $state<'settings' | 'paid' | 'delete' | 'help' | ''>('');
  let deleteId = $state('');
  let key = $state('');
  let keyStatus = $state('');
  let testing = $state(false);
  let verifiedKey = $state<string | null>(null);
  const connected = $derived(Boolean(key.trim() && verifiedKey === key.trim()));
  let catalogue = $state<Model[]>([]);
  let catalogueStatus = $state('Not loaded');
  let catalogueLoading = $state(false);
  let settingsTab = $state<'models' | 'connection' | 'budget'>('connection');
  let catalogueForKey = $state<string | null>(null);
  let catalogueLoaded = $state(false);
  let catalogueGeneration = 0;
  let paidMode = $state<ModelMode>('individual');
  let paidEfforts = $state<Record<string, ReasoningEffort>>({});
  let fusionAllowance = $state<number | undefined>(1);
  let paidTask = $state<Task>('drivers');
  let paidTargets = $state<string[] | undefined>();
  let paidContributors = $state<{ modelId: string; included: boolean }[]>([]);
  let retryId = $state<string | undefined>();
  let paidChainOptions = $state<ChainGenerationOptions>({ mode: 'standard' });
  let paidNarrativeOptions = $state<NarrativeOptions | undefined>();
  let paidError = $state('');
  let paidConnectionOpen = $state(false);
  let busy = $state(false);
  let leaving = $state(false);
  let operation: Operation | null = null;
  let offline = $state(false);
  let importInput: HTMLInputElement;
  let saveTimer: ReturnType<typeof setTimeout>;
  let saveQueue: Promise<void> = Promise.resolve();
  let undoStack = $state<Project[]>([]);
  let redoStack = $state<Project[]>([]);
  let lastUndoAt = 0;
  const p = $derived(project);
  const stageRuns = $derived(
    p?.runs.filter((r) => canonicalStage(r.stage) === canonicalStage(p.stage)) ?? []
  );
  const latestOperationRuns = $derived(
    stageRuns.filter((r) => r.operationId === stageRuns.at(-1)?.operationId)
  );
  const blocked = $derived(p ? prerequisite(p, p.stage) : null);
  const paidModels = $derived(
    paidMode === 'fusion'
      ? [FUSION_MODEL]
      : paidContributors.filter((c) => c.included).map((c) => c.modelId)
  );
  const singleContributor = $derived(
    ['narrative', 'narrative_edit', 'consolidate'].includes(paidTask)
  );
  const paidPlan = $derived(
    p && dialog === 'paid'
      ? planRequests(
          p,
          catalogue,
          paidTask,
          paidModels,
          paidTargets,
          retryId,
          paidNarrativeOptions,
          paidChainOptions,
          { reasoningEfforts: paidEfforts, fusionAllowance }
        )
      : null
  );
  const paidEstimate = $derived(paidPlan?.estimatedTotal ?? null);
  const paidCandidateCount = $derived(
    paidTask === 'chains'
      ? (paidPlan?.requests.reduce(
          (total, request) =>
            total + Number((request.context.chainBatch as { count: number }).count),
          0
        ) ?? 0)
      : 0
  );

  async function persist(snapshot: Project) {
    let saved = false;
    saveQueue = saveQueue
      .catch(() => {})
      .then(async () => {
        try {
          await saveProject(snapshot);
          projects = await listProjects();
          saved = true;
          if (project?.id === snapshot.id && project.revision === snapshot.revision) {
            saveState = 'Saved on this device';
            if (
              error ===
              'Device storage failed. Retry saving or download a project backup before closing this page.'
            )
              error = '';
          }
        } catch {
          if (project?.id === snapshot.id) {
            saveState = 'Changes not saved';
            error =
              'Device storage failed. Retry saving or download a project backup before closing this page.';
          }
        }
      });
    await saveQueue;
    return saved;
  }
  function updateProject(fn: Parameters<Change>[0], message?: string, recordUndo = true) {
    if (!project) return;
    if (recordUndo && !busy) {
      if (message || Date.now() - lastUndoAt > 700) {
        undoStack.push(structuredClone($state.snapshot(project)));
        if (undoStack.length > 20) undoStack.shift();
      }
      lastUndoAt = Date.now();
      redoStack = [];
    }
    const next = structuredClone($state.snapshot(project));
    fn(next);
    next.revision++;
    next.updatedAt = now();
    if (message) {
      announcement = message;
      next.events.push({ at: now(), revision: next.revision, message });
    }
    project = next;
    saveState = 'Saving…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => persist(structuredClone(next)), 250);
  }
  const change: Change = (fn, message) => updateProject(fn, message);
  function undoProject(redo = false) {
    if (!project || busy) return;
    const source = redo ? redoStack : undoStack;
    const destination = redo ? undoStack : redoStack;
    if (!source.length) return;
    const current = structuredClone($state.snapshot(project));
    const previous = structuredClone($state.snapshot(source.pop()!));
    destination.push(current);
    previous.runs = current.runs;
    previous.events = current.events;
    previous.stage = current.stage;
    previous.revision = current.revision;
    project = previous;
    updateProject(
      () => {},
      redo
        ? 'Change redone. Model usage records preserved.'
        : 'Change undone. Model usage records preserved.',
      false
    );
    lastUndoAt = 0;
  }
  async function openProject(value: Project) {
    if (busy || leaving) return;
    if (project) {
      clearTimeout(saveTimer);
      await persist(structuredClone($state.snapshot(project)));
    }
    project = structuredClone($state.snapshot(value));
    undoStack = [];
    redoStack = [];
    lastUndoAt = 0;
    error = '';
    saveState = 'Saving…';
    const interrupted = recoverInterrupted(project);
    if (interrupted)
      announcement = `${interrupted} model request(s) were interrupted. Work is preserved; dispatched calls may have been billed.`;
    await preference('last-project', project.id).catch(() => {});
    await persist(structuredClone($state.snapshot(project)));
  }
  async function home() {
    if (busy || leaving) return;
    leaving = true;
    try {
      while (true) {
        clearTimeout(saveTimer);
        const snapshot = project ? structuredClone($state.snapshot(project)) : null;
        if (snapshot && !(await persist(snapshot))) return;
        if (busy) return;
        try {
          await preference('last-project', '');
        } catch {
          error = 'Could not return to the start. Try Back to start again.';
          return;
        }
        if (!project || (project.id === snapshot?.id && project.revision === snapshot.revision))
          break;
      }
      if (busy) return;
      project = null;
      error = '';
      await tick();
      window.scrollTo(0, 0);
      document.getElementById('main')?.focus();
    } finally {
      leaving = false;
    }
  }
  function navigate(stage: number) {
    stage = canonicalStage(stage);
    updateProject(
      (p) => {
        p.stage = stage;
      },
      undefined,
      false
    );
    error = '';
    void tick().then(() => {
      window.scrollTo(0, 0);
      document.getElementById('main')?.focus();
    });
  }
  async function viewRunDetails(run: Run) {
    navigate(run.stage);
    await tick();
    const row = document.getElementById(`run-${run.id}`);
    if (!row) return;
    const record = row.querySelector('details');
    if (record) record.open = true;
    row.scrollIntoView({
      block: 'center',
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    });
    row.focus({ preventScroll: true });
  }
  async function loadCatalogue() {
    const sessionKey = key.trim();
    const generation = ++catalogueGeneration;
    catalogueLoading = true;
    catalogueStatus = 'Finding available models…';
    try {
      const models = await getModels(sessionKey);
      if (generation !== catalogueGeneration || sessionKey !== key.trim()) return;
      catalogue = models;
      catalogueForKey = sessionKey;
      catalogueLoaded = true;
      catalogueStatus = sessionKey
        ? 'Available for your OpenRouter connection.'
        : 'Connect your key to check account availability.';
    } catch (e) {
      if (generation !== catalogueGeneration) return;
      catalogueForKey = null;
      catalogueStatus = e instanceof Error ? e.message : 'Could not load models. Try again.';
    } finally {
      if (generation === catalogueGeneration) catalogueLoading = false;
    }
  }
  function keyChanged() {
    keyStatus = '';
    verifiedKey = null;
    catalogueForKey = null;
    catalogueLoaded = false;
    catalogueGeneration++;
    catalogueLoading = false;
  }
  async function checkConnection() {
    if (testing || !key.trim()) return;
    testing = true;
    verifiedKey = null;
    keyStatus = '';
    const sessionKey = key.trim();
    try {
      const result = await testKey(sessionKey);
      if (sessionKey !== key.trim()) return;
      verifiedKey = sessionKey;
      keyStatus = result.paidAllowanceAvailable
        ? 'Connected. Your key is accepted. Paid models also need credit in your OpenRouter account.'
        : 'Connected. Your key is accepted, but its spending allowance is used up. Review its limit on OpenRouter before making paid requests.';
      await loadCatalogue();
    } catch (e) {
      if (sessionKey === key.trim())
        keyStatus =
          e instanceof Error
            ? e.message
            : 'Connection failed. Check your internet connection and try again.';
    } finally {
      testing = false;
    }
  }
  function forgetKey() {
    key = '';
    keyChanged();
    keyStatus = 'Key removed from this session.';
    void loadCatalogue();
  }
  function settings() {
    settingsTab = 'connection';
    dialog = 'settings';
    if (catalogueForKey !== key.trim() && !catalogueLoading) void loadCatalogue();
  }
  function remainingAllowance() {
    return !p || p.budget === null
      ? 1
      : Math.max(
          0,
          Math.floor((p.budget - spent(p) - reserved(p) - uncertainSpend(p)) * 100) / 100
        );
  }
  function request(
    task: Task,
    targets?: string[],
    writer?: string,
    retry?: Run,
    narrativeOptions?: NarrativeOptions,
    chainOptions?: ChainGenerationOptions
  ) {
    if (!p || busy) return;
    paidTask = task;
    const savedGeneration = retry?.context as
      { chainGeneration?: ChainGenerationOptions; chainBatch?: { kind: string } } | undefined;
    paidChainOptions = savedGeneration?.chainGeneration ??
      chainOptions ?? {
        mode: savedGeneration?.chainBatch?.kind === 'wildcard' ? 'disruption' : 'standard'
      };
    paidMode = retry
      ? retry.modelId === FUSION_MODEL
        ? 'fusion'
        : 'individual'
      : selectionMode(p, String(p.stage));
    paidEfforts = {
      ...p.reasoningEfforts,
      ...(retry?.reasoningEffort ? { [retry.modelId]: retry.reasoningEffort } : {})
    };
    fusionAllowance =
      retry?.costBasis === 'allowance'
        ? Math.min(retry.estimated, remainingAllowance())
        : Math.min(1, remainingAllowance());
    paidTargets = targets;
    retryId = retry?.id;
    paidNarrativeOptions =
      narrativeOptions ??
      (retry?.context as { narrative?: NarrativeOptions } | undefined)?.narrative;
    const models = retry
      ? [retry.modelId]
      : writer && paidMode === 'individual'
        ? [writer]
        : requestModels(p, p.stage, ['narrative', 'narrative_edit', 'consolidate'].includes(task));
    paidContributors = (models.includes(FUSION_MODEL) ? p.models.slice(0, 1) : models).map(
      (modelId, i) => ({
        modelId,
        included: task !== 'chains' || !!retry || i === 0
      })
    );
    paidError = '';
    paidConnectionOpen = !key.trim();
    dialog = 'paid';
    if (catalogueForKey !== key.trim() && !catalogueLoading) void loadCatalogue();
  }
  async function run() {
    if (!project) return;
    if (catalogueForKey !== key.trim()) {
      paidError = 'Refresh available models for this connection before running.';
      return;
    }
    let started = false;
    try {
      operation = launch(
        () => $state.snapshot(project!),
        (fn, message) => updateProject(fn, message, false),
        key,
        catalogue,
        paidTask,
        [...paidModels],
        paidTargets,
        retryId,
        paidNarrativeOptions,
        paidChainOptions,
        { reasoningEfforts: paidEfforts, fusionAllowance }
      );
      started = true;
      if (singleContributor && paidMode === 'individual' && !p?.overrides[String(p?.stage)])
        change((p) => (p.writer = paidModels[0]));
      dialog = '';
      undoStack = [];
      redoStack = [];
      busy = true;
      error = '';
      await operation.done;
    } catch (e) {
      paidError = e instanceof Error ? e.message : 'Could not start operation.';
    } finally {
      busy = false;
      operation = null;
      if (started) {
        undoStack = [];
        redoStack = [];
        lastUndoAt = 0;
      }
    }
  }
  function retry(run: Run) {
    if (!isRunnableTask(run.task)) return;
    request(run.task, run.targetIds.length ? run.targetIds : undefined, undefined, run);
  }
  async function importFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      if (file.size > 30_000_000)
        throw new Error('This file is too large. Choose a project backup smaller than 30 MB.');
      const imported = parseProject(JSON.parse(await file.text()));
      imported.id = id('exercise');
      imported.title += ' (imported)';
      await openProject(imported);
      announcement = 'Project imported. Your API key was not included.';
    } catch (e) {
      error =
        e instanceof Error && !e.message.startsWith('[')
          ? e.message
          : 'This is not a supported version 1.0 project backup. Select a .scenario.json project file.';
    } finally {
      importInput.value = '';
    }
  }
  onMount(() => {
    let alive = true;
    (async () => {
      try {
        projects = await listProjects();
        const [last, appearance] = await Promise.all([
          preference('last-project'),
          preference('theme')
        ]);
        if (!alive) return;
        theme =
          appearance || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        document.documentElement.dataset.cgTheme = theme;
        const saved = projects.find((p) => p.id === last);
        if (saved) await openProject(saved);
      } catch {
        error =
          'Local storage is unavailable. You can work here, but download a project backup before closing.';
      } finally {
        loaded = true;
      }
    })();
    const connection = () => (offline = !navigator.onLine);
    connection();
    addEventListener('online', connection);
    addEventListener('offline', connection);
    const leave = (event: BeforeUnloadEvent) => {
      if (saveState === 'Saving…' || saveState === 'Changes not saved' || busy)
        event.preventDefault();
    };
    addEventListener('beforeunload', leave);
    return () => {
      alive = false;
      removeEventListener('online', connection);
      removeEventListener('offline', connection);
      removeEventListener('beforeunload', leave);
    };
  });
</script>

{#snippet openRouterConnection()}
  <OpenRouterConnection
    bind:connectionKey={key}
    {connected}
    {testing}
    status={keyStatus}
    onkeychange={keyChanged}
    ontest={checkConnection}
    onforget={forgetKey}
  />
{/snippet}

<svelte:head
  ><title
    >{p ? `${p.title} · Scenario Designer` : 'Scenario Designer — imagine futures together'}</title
  ><meta
    name="description"
    content={`An analyst-led workbench for exploring humanitarian futures with independent AI perspectives. ${showModeLabels ? 'Quick Mode, local projects, and decisions that stay yours.' : 'Local projects and decisions that stay yours.'}`}
  /></svelte:head
>
<a class="skip-link" href="#main">Skip to workspace</a>
<input
  bind:this={importInput}
  type="file"
  accept=".json,application/json"
  class="sr-only"
  tabindex="-1"
  aria-label="Import project file"
  onchange={importFile}
/>
<div class="desktop-note">
  Designed for desktop analysis. Use a larger screen for comparing and editing scenarios. Your saved
  work remains accessible here.
</div>
<div class="app-shell">
  <aside class="sidebar" aria-label="Exercise navigation">
    <button class="brand" onclick={home} disabled={busy || leaving}
      ><GitBranch size={27} strokeWidth={1.5} /><span
        >Scenario<br />Designer<span class="brand-sub">A workspace for possible futures</span></span
      ></button
    >
    {#if p}<button class="project-context" onclick={() => navigate(0)}
        ><strong>{p.title}</strong><span>{p.horizon || 'Set your time horizon'}</span></button
      >
      <nav aria-label="Workflow stages">
        {#each workflowStages as { id: i, title: stage }}<button
            class:current={p.stage === i}
            class:stage-completed={stageIsComplete(p, i)}
            aria-current={p.stage === i ? 'step' : undefined}
            onclick={() => navigate(i)}
            ><span class="stage-number"
              >{stageNeedsReview(p, i)
                ? '◒'
                : stageIsComplete(p, i)
                  ? '✓'
                  : i === 0 || i === MODEL_SETUP_STAGE
                    ? '◇'
                    : i === 8
                      ? '↗'
                      : i}</span
            ><span
              >{stage}<small
                >{stageNeedsReview(p, i)
                  ? 'Review suggested'
                  : stageIsComplete(p, i)
                    ? 'Complete'
                    : p.stage === i
                      ? 'Working'
                      : prerequisite(p, i)
                        ? 'Blocked'
                        : 'Not started'}</small
              ></span
            ></button
          >{/each}
      </nav>
    {:else}<div class="sidebar-intro">
        <p>Possible futures.<br />AI-augmented perspectives.<br />Your judgement.</p>
      </div>
      <nav aria-label="Main navigation">
        <button class="current" onclick={home}><FolderOpen size={18} /> Your exercises</button
        ><button data-walkthrough="home-how-it-works" onclick={() => (dialog = 'help')}
          ><HelpCircle size={18} /> How it works</button
        >
      </nav>{/if}
    <div class="sidebar-bottom">
      {#if p}<button class="sidebar-models" onclick={settings}
          ><span>AI models</span>
          <div>
            {#each p.modelMode === 'fusion' ? [FUSION_MODEL] : p.models as model, i}<span
                class="sidebar-model"
                title={model}>{['●', '■', '▲', '◆'][i % 4]}</span
              >{/each}<Settings2 size={16} />
          </div>
          <small
            >{p.modelMode === 'fusion'
              ? 'Fusion · combined perspectives'
              : `${p.models.length} models · manage selection`}</small
          ></button
        ><button
          class="sidebar-spend"
          onclick={() => {
            settings();
            settingsTab = 'budget';
          }}
          ><span>Budget</span><strong
            >${spent(p).toFixed(3)} confirmed{p.budget !== null ? ` / $${p.budget}` : ''}</strong
          >{#if reserved(p)}<small>${reserved(p).toFixed(3)} reserved</small
            >{/if}{#if uncertainSpend(p)}<small
              >Unknown charges · est. ${uncertainSpend(p).toFixed(3)}</small
            >{/if}</button
        >{:else}<GitBranch size={25} />
        <p>Open source. Runs in your browser.</p>
      {/if}
    </div>
  </aside>
  <div class="workspace" style:--workspace-topbar-height={`${topbarHeight}px`}>
    <header class="topbar" bind:offsetHeight={topbarHeight}>
      <div class="topbar-context">
        {#if p}<button class="secondary back-to-exercises" onclick={home} disabled={busy || leaving}
            ><ArrowLeft size={17} /> Back to start</button
          >{#if showModeLabels}<span class="mode-badge">Quick mode</span>{/if}{#if p.example}<span
              class="example-label">Example</span
            >{/if}{:else}<span>Your exercises</span>{#if showModeLabels}<span class="mode-badge"
              >Quick mode</span
            >{/if}{/if}
      </div>
      <div class="topbar-tools">
        {#if p}{#if saveState === 'Changes not saved'}<button
              class="text-button"
              onclick={() => p && persist(structuredClone($state.snapshot(p)))}>Retry save</button
            >{/if}{#key p.id}<ModelActivity
              exerciseId={p.id}
              runs={p.runs}
              {busy}
              onCancel={() => operation?.cancel()}
              onViewDetails={viewRunDetails}
            />{/key}<button
            class="secondary topbar-model-settings"
            title="Models and budget"
            aria-label="Models and budget"
            onclick={settings}><Settings2 size={19} /><span>Models and budget</span></button
          ><button
            class="icon-button"
            title="Download project backup"
            aria-label="Download project backup"
            onclick={() =>
              download(projectJSON(p), `${filename(p)}.scenario.json`, 'application/json')}
            ><Download size={19} /></button
          ><button
            class="icon-button"
            aria-label="Undo exercise change"
            title="Undo exercise change"
            disabled={busy || !undoStack.length}
            onclick={() => undoProject()}><Undo2 size={18} /></button
          ><button
            class="icon-button"
            aria-label="Redo exercise change"
            title="Redo exercise change"
            disabled={busy || !redoStack.length}
            onclick={() => undoProject(true)}><Redo2 size={18} /></button
          >{/if}<button
          class="icon-button"
          title={theme === 'light' ? 'Switch to dark appearance' : 'Switch to light appearance'}
          aria-label={theme === 'light'
            ? 'Switch to dark appearance'
            : 'Switch to light appearance'}
          onclick={() => {
            theme = theme === 'light' ? 'dark' : 'light';
            document.documentElement.dataset.cgTheme = theme;
            void preference('theme', theme).catch(() => {});
          }}
          >{#if theme === 'light'}<Moon size={18} />{:else}<Sun size={18} />{/if}</button
        >
        <PageWalkthrough
          page={walkthroughId(p?.stage ?? null)}
          pageKey={p ? `${p.id}:${canonicalStage(p.stage)}` : 'home'}
          ready={loaded}
          {blocked}
        />
      </div>
    </header>
    <main id="main" tabindex="-1">
      <div class="workspace-content">
        {#if offline}<p class="notice review">
            You’re offline. Saved work remains editable. Reconnect to run models.
          </p>{/if}
        {#if error}<div class="notice error" role="alert">
            <span>{error}</span><button
              class="icon-button"
              aria-label="Dismiss error"
              onclick={() => (error = '')}><X size={17} /></button
            >
          </div>{/if}
        {#if !loaded}<div class="loading-state">
            <GitBranch size={30} />
            <p>Opening your workspace…</p>
          </div>
        {:else if p}
          {#if p.example}<div class="example-notice">
              <BookOpen size={16} /><span
                >Example exercise. Scores, reasoning and drafts are authored illustrations, not live
                model results.</span
              >
              <button class="secondary" onclick={home} disabled={busy || leaving}
                >Exit example <ArrowLeft size={16} /></button
              >
            </div>{/if}
          {#if stageNeedsReview(p, p.stage)}<div class="notice review">
              <AlertTriangle size={18} /><span
                >Review suggested after an upstream change. Your decisions and edits are preserved.</span
              >
            </div>{/if}
          {#if blocked}<div class="empty-state">
              <GitBranch size={34} />
              <h1>{stages[p.stage]}</h1>
              <p>{blocked}</p>
              <button class="primary" onclick={() => navigate(prerequisiteStage(p, p.stage))}
                >Go to {stages[prerequisiteStage(p, p.stage)]} <ArrowRight size={16} /></button
              >
            </div>
          {:else}{#key `${p.id}:${p.stage}`}
              {#if p.stage === 0}<Setup {p} {change} />
              {:else if p.stage === MODEL_SETUP_STAGE}<ModelSetup
                  {p}
                  {change}
                  {connected}
                  {catalogue}
                  loading={catalogueLoading}
                  loaded={catalogueLoaded && catalogueForKey === key.trim()}
                  status={catalogueStatus}
                  refresh={loadCatalogue}
                >
                  {#snippet connection()}{@render openRouterConnection()}{/snippet}
                </ModelSetup>
              {:else if p.stage === 1}<Drivers
                  {p}
                  {change}
                  request={(task) => request(task ?? 'drivers')}
                  next={() => navigate(2)}
                />
              {:else if p.stage === 2 || p.stage === 3}<Assessment
                  {p}
                  {change}
                  selection={p.stage === 3}
                  request={() => request('ratings')}
                  next={() => navigate(p.stage + 1)}
                />
              {:else if p.stage === 4}<Hypotheses
                  {p}
                  {change}
                  request={(task, ids) => request(task ?? 'hypotheses', ids)}
                  next={() => navigate(5)}
                />
              {:else if p.stage === 5}<Chains
                  {p}
                  {change}
                  request={(task, ids, options) =>
                    request(task, ids, undefined, undefined, undefined, options)}
                  next={() => navigate(6)}
                />
              {:else if p.stage === 6 || p.stage === 7}<Writing
                  {p}
                  {change}
                  {busy}
                  request={(task, id, instructions) =>
                    request(task, [id], undefined, undefined, { instructions })}
                  next={() => navigate(8)}
                  reviewChains={() => navigate(5)}
                />
              {:else}<Exports {p} {navigate} />{/if}
            {/key}{/if}
          {#if stageRuns.length}<section class="run-list" aria-label="Model operations">
              <div class="section-line">
                <h2>Model contributions</h2>
                {#if busy}<button class="secondary" onclick={() => operation?.cancel()}
                    >Cancel queued work</button
                  >{/if}
              </div>
              <p class="small muted">
                Successful contributions remain available if another model fails. Cancellation
                cannot guarantee refunds for dispatched calls.
              </p>
              <p class="small">
                Latest operation: {latestOperationRuns.filter(
                  (r) => !['queued', 'running'].includes(r.status)
                ).length}
                of {latestOperationRuns.length} requests finished ·
                {latestOperationRuns.filter((r) => r.status === 'succeeded').length} succeeded ·
                {latestOperationRuns.filter((r) => r.status === 'failed').length} failed
              </p>
              {#each stageRuns.slice().reverse() as r (r.id)}<div
                  class="run-row"
                  id={`run-${r.id}`}
                  tabindex="-1"
                >
                  <span
                    class:approved={r.status === 'succeeded'}
                    class:review={r.status === 'failed'}
                    class="badge">{r.status}</span
                  >
                  <div class="run-description">
                    <strong>{modelName(r.modelId)}</strong><small
                      >{r.modelId} · {r.task}{#if r.batchIndex}{' · '}batch {r.batchIndex} of {r.batchCount}
                        {#if r.task === 'ratings'}
                          · {r.targetIds.length}
                          {r.targetIds.length === 1 ? 'driver' : 'drivers'}{/if}{/if}</small
                    >{#if r.error}<p class="small error-text">{r.error}</p>{/if}
                    <details>
                      <summary class="small">Operation record</summary>
                      <p class="small">
                        {r.id} · input revision {r.inputRevision} · {r.at}<br />Prompt version {r.promptTemplateVersion}<br
                        />{r.confirmed === null
                          ? 'Confirmed cost unavailable'
                          : `Confirmed cost $${r.confirmed.toFixed(5)}`} · {r.costBasis ===
                        'allowance'
                          ? 'planning allowance'
                          : 'estimate'} ${r.estimated.toFixed(5)}
                      </p>
                      {#if r.reasoningEffort || r.resolvedModelId || r.fusionInvoked !== undefined}<p
                          class="small"
                        >
                          {#if r.resolvedModelId}Answered by {r.resolvedModelId}.
                          {/if}{#if r.reasoningEffort}{r.modelId === FUSION_MODEL
                              ? 'Panel thinking'
                              : 'Thinking effort'}: {r.reasoningEffort}.
                          {/if}{#if r.fusionInvoked !== undefined}Fusion panel {r.fusionInvoked
                              ? 'consulted'
                              : 'not completed'}.{/if}
                        </p>{/if}
                      {#if r.finishReason || r.nativeFinishReason || r.inputTokens !== undefined || r.outputTokens !== undefined}<p
                          class="small"
                        >
                          Completion: {r.finishReason ?? 'unavailable'}{r.nativeFinishReason
                            ? ` (${r.nativeFinishReason})`
                            : ''} · input tokens: {r.inputTokens ?? 'unavailable'} · output tokens: {r.outputTokens ??
                            'unavailable'}{r.maxOutputTokens
                            ? ` / ${r.maxOutputTokens} allowance`
                            : ''}
                        </p>{/if}
                      {#if responseText(r) !== undefined}<pre>{responseText(r)}</pre>{/if}
                    </details>
                  </div>
                  {#if ['failed', 'cancelled'].includes(r.status)}<div class="toolbar-group">
                      {#if isRunnableTask(r.task)}<button
                          class="secondary"
                          disabled={busy}
                          onclick={() => retry(r)}>Retry / replace</button
                        >{/if}<button
                        class="text-button"
                        onclick={() =>
                          change((p) => {
                            p.runs.find((v) => v.id === r.id)!.status = 'skipped';
                          }, 'Missing contribution explicitly skipped. Partial coverage retained.')}
                        >Proceed without</button
                      >
                    </div>{/if}
                </div>{/each}
            </section>{/if}
        {:else}
          <section class="home-hero">
            <div class="home-hero-copy">
              <div class="home-symbol"><GitBranch size={34} strokeWidth={1.4} /></div>
              <h1>A workspace for<br />possible futures.</h1>
              <p>
                Explore how change might unfold through a scenario design process controlled by you
                and augmented by AI.
              </p>
              <div class="toolbar-group">
                <button
                  data-walkthrough="home-create"
                  class="primary large"
                  onclick={() => openProject(newProject())}
                  ><Plus size={18} /> Design a new set of scenarios</button
                ><button
                  data-walkthrough="home-example"
                  class="text-button"
                  onclick={() => openProject(exampleProject())}
                  >Explore an example <ArrowRight size={17} /></button
                >
              </div>
              <span class="home-small"
                ><HardDrive size={14} /> Everything is saved on your device. No account needed.</span
              >
            </div>
            <div
              class="home-preview"
              aria-label="Three different futures, connected by your choices"
            >
              <div class="preview-label">One question, different possibilities.</div>
              <div class="preview-branches">
                <svg viewBox="0 0 360 72" aria-hidden="true"
                  ><path
                    d="M180 0V20Q180 32 168 32H72Q60 32 60 44V72M180 20V72M180 20Q180 32 192 32H288Q300 32 300 44V72"
                  /></svg
                >
              </div>
              <div class="preview-columns">
                {#each ['Local lifelines', 'The digital divide', 'Public renewal'] as title, i}<div>
                    <h3 class="scenario-{i + 1}">{title}</h3>
                    {#each [['Local support', 'Targeted support', 'National support'], ['Mutual aid', 'Digital assistance', 'Local partnerships'], ['Volatile costs', 'Unequal gains', 'Stable bills']] as row}<div
                        class="preview-cell"
                      >
                        {row[i]}
                      </div>{/each}
                  </div>{/each}
              </div>
            </div>
          </section>
          <section class="projects-section">
            <div class="section-line">
              <h2 data-walkthrough="home-projects">
                Your exercises <span class="count">{projects.length}</span>
              </h2>
              <button
                data-walkthrough="home-import"
                class="secondary"
                onclick={() => importInput.click()}><Upload size={16} /> Import project</button
              >
            </div>
            {#if projects.length}<div class="project-list">
                {#each projects as saved}<article class="project-row">
                    <button class="project-open" onclick={() => openProject(saved)}
                      ><span class="project-icon"><GitBranch size={23} /></span><span
                        ><strong>{saved.title}</strong><span
                          >{saved.horizon || 'Not configured'}{saved.example
                            ? ' · Example'
                            : ''}</span
                        ><small
                          >Continue with {stages[saved.stage]} · saved {new Date(
                            saved.updatedAt
                          ).toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}</small
                        ><span class="exercise-progress"
                          ><progress
                            max={coreStageCount}
                            value={completedStageCount(saved)}
                            aria-label={`${saved.title} completed stages`}
                          ></progress><span
                            >{completedStageCount(saved)} of {coreStageCount} stages complete</span
                          ></span
                        ></span
                      ><ArrowRight size={19} /></button
                    ><button
                      class="icon-button danger-text"
                      aria-label={`Delete ${saved.title}`}
                      title="Delete exercise"
                      onclick={() => {
                        deleteId = saved.id;
                        dialog = 'delete';
                      }}><Trash2 size={17} /></button
                    >
                  </article>{/each}
              </div>{:else}<div class="project-empty">
                <FolderOpen size={24} />
                <p>Your first question is a good place to start.</p>
                <span>Create an exercise, explore the example, or import a project backup.</span>
              </div>{/if}
          </section>
          <div class="home-footnote">
            {#if showModeLabels}<span><Zap size={17} /> Individual models or Fusion</span>{/if}
            <button
              data-walkthrough="home-how-it-works"
              class="text-button"
              onclick={() => (dialog = 'help')}>How it works <ArrowUpRight size={15} /></button
            >
          </div>
          <p class="privacy-line">
            For publicly shareable, non-sensitive analysis only. Model requests are sent through
            OpenRouter to selected providers.
          </p>
        {/if}
      </div>
    </main>
  </div>
</div>
<div class="sr-only" role="status" aria-live="polite">{announcement}</div>

{#if dialog === 'settings' && p}<Modal title="Models and budget" close={() => (dialog = '')} wide>
    <div class="settings-tabs" role="group" aria-label="AI settings">
      {#each [['connection', 'Connect'], ['models', 'AI models'], ['budget', 'Budget']] as [value, label]}<button
          class:active={settingsTab === value}
          aria-pressed={settingsTab === value}
          onclick={() => (settingsTab = value as typeof settingsTab)}
          >{label}{#if value === 'connection'}<span class="small"
              >{key.trim() ? 'Key added' : 'Not connected'}</span
            >{/if}</button
        >{/each}
    </div>
    {#if settingsTab === 'models'}
      <StageModelSettings
        {p}
        {change}
        {catalogue}
        loading={catalogueLoading}
        loaded={catalogueLoaded}
        status={catalogueStatus}
        refresh={loadCatalogue}
      />
      {#if !key.trim()}<div class="picker-connect-prompt">
          <span>Connect OpenRouter when you’re ready to run.</span><button
            class="secondary small"
            onclick={() => (settingsTab = 'connection')}>Connect your key</button
          >
        </div>{/if}
    {:else if settingsTab === 'connection'}<section class="settings-form">
        {@render openRouterConnection()}
      </section>
    {:else}<section class="settings-form">
        <ExerciseBudget {p} {change} />
      </section>{/if}
    <p class="small muted settings-privacy">
      Only use publicly shareable, non-sensitive analysis. Model requests leave your browser through
      OpenRouter.
    </p>
    <div class="dialog-actions">
      <button class="primary" onclick={() => (dialog = '')}>Done</button>
    </div>
  </Modal>
{:else if dialog === 'paid' && p}<Modal
    title={retryId
      ? 'Retry or replace this contribution'
      : paidTask === 'chains' && paidChainOptions.mode === 'disruption'
        ? 'Explore a disruption'
        : paidTask === 'narrative_edit'
          ? 'Ask AI to edit your scenario'
          : paidTask === 'narrative'
            ? 'Generate a draft with AI'
            : paidTask === 'consolidate'
              ? 'Spot overlapping contributions'
              : `Generate ${paidTask === 'ratings' ? (paidMode === 'fusion' ? 'combined scores' : 'independent scores') : paidTask}`}
    wide
    close={() => (dialog = '')}
    ><p>Review the models and estimated cost before sending this analysis to OpenRouter.</p>
    {#if paidTask === 'narrative_edit'}<p class="small">
        <strong>Editing request:</strong>
        {paidNarrativeOptions?.instructions?.trim() ||
          'Improve clarity and flow while preserving my voice and meaning.'}
      </p>{/if}
    {#if paidTargets?.length}<p class="small">
        <strong>Scope:</strong>
        {paidTargets
          .map(
            (id) =>
              p.chains.find((c) => c.id === id)?.title ??
              p.drivers.find((d) => d.id === id)?.title ??
              id
          )
          .join(', ')}
      </p>{/if}

    {#if paidTask === 'chains' && paidChainOptions.mode === 'disruption'}
      {#if retryId}<p>
          <strong>What if…?</strong>
          {paidChainOptions.prompt || 'Suggest a surprising but plausible disruption.'}
        </p>
      {:else}<label class="spaced"
          >What if…? (optional)<textarea
            rows="3"
            bind:value={paidChainOptions.prompt}
            placeholder="For example, a prolonged energy supply interruption."></textarea></label
        >
        <p class="small muted">
          Leave this blank for the model to suggest a disruption. Each model creates one new
          candidate. Any additional drivers will need your review.
        </p>{/if}
    {/if}
    <details class="generation-connection" bind:open={paidConnectionOpen}>
      <summary>{key.trim() ? 'OpenRouter connection · Change key' : 'Connect OpenRouter'}</summary>
      {@render openRouterConnection()}
    </details>
    <ModelPicker
      {catalogue}
      selected={paidContributors.filter((c) => c.included).map((c) => c.modelId)}
      mode={paidMode}
      efforts={paidEfforts}
      multiple={!singleContributor}
      loading={catalogueLoading}
      loaded={catalogueLoaded}
      status={catalogueStatus}
      refresh={loadCatalogue}
      onmodels={(ids) => (paidContributors = ids.map((modelId) => ({ modelId, included: true })))}
      onmode={(mode) => (paidMode = mode)}
      oneffort={(id, effort) => (paidEfforts = { ...paidEfforts, [id]: effort })}
    />
    {#if paidMode === 'fusion'}<label class="spaced"
        >Planning allowance for this run (USD)<input
          type="number"
          min="0.01"
          step="0.01"
          bind:value={fusionAllowance}
        /></label
      >
      <p class="small muted">
        This reserves money in your exercise budget for the whole run. It is not an OpenRouter
        spending cap; actual charges may be higher. Use a spending-limited key for an external cap.
      </p>{/if}
    {#if paidTask === 'chains'}
      <p class="chain-generation-summary" role="status">
        <strong
          >{paidCandidateCount} new candidate {paidCandidateCount === 1
            ? 'chain'
            : 'chains'}</strong
        >
        from {paidModels.length}
        {paidMode === 'fusion'
          ? 'combined contributor'
          : paidModels.length === 1
            ? 'model'
            : 'models'}. Choose any one or more chains to take into writing.
      </p>
    {/if}
    <div class="estimate-box">
      <span>{paidMode === 'fusion' ? 'Planning allowance' : 'Estimated maximum allowance'}</span
      ><strong
        >{paidEstimate === null
          ? paidMode === 'fusion'
            ? 'Enter an available allowance'
            : 'Price unavailable'
          : `$${paidEstimate.toFixed(4)} USD`}</strong
      ><small
        >{paidPlan?.requests.length ?? 0}
        {paidPlan?.requests.length === 1 ? 'request' : 'requests'} across {paidModels.length}
        {paidMode === 'fusion'
          ? 'combined contributor'
          : paidModels.length === 1
            ? 'model'
            : 'models'}. {#if paidMode === 'fusion'}Final charges depend on Fusion’s work.{:else}Based
          on current prices and up to {Math.max(
            0,
            ...(paidPlan?.requests.map((r) => r.maxOutputTokens) ?? [])
          ).toLocaleString()} output tokens per request, including thinking. Actual charges can vary.{/if}</small
      >
    </div>
    {#if paidTask === 'chains'}<p class="small muted">
        {#if retryId}The saved request scope is retained for this retry.{:else}Generate chains
          requests three candidates per model; Explore a disruption requests one per model.{/if} Every
        chain includes all selected uncertainties. Retry / replace repeats only the failed batch.
      </p>{/if}
    {#if paidEstimate !== null && !canSpend(p, paidEstimate)}<p class="notice review" role="status">
        This run exceeds your remaining exercise allowance. {paidMode === 'fusion'
          ? 'Lower the planning allowance or adjust your budget.'
          : 'Choose fewer models, try a free option or adjust your budget.'}
      </p>{/if}
    {#if new Set(paidModels).size !== paidModels.length}<p class="notice review" role="status">
        Choose a different model for each contributor.
      </p>{/if}
    {#if !paidModels.length}<p class="notice review" role="status">
        Select at least one model to run.
      </p>{:else if !paidPlan?.requests.length}<p class="notice review">
        {retryId
          ? 'No missing ratings remain for the selected model in this scope. Choose a replacement model with missing ratings or close this dialog.'
          : 'No approved drivers are available to assess.'}
      </p>{/if}
    {#if catalogueForKey !== key.trim()}<p class="small muted">{catalogueStatus}</p>
      <button class="secondary" disabled={catalogueLoading} onclick={loadCatalogue}
        >Refresh catalogue</button
      >{/if}{#if paidError}<p class="notice error" role="alert">{paidError}</p>
      <button class="text-button" onclick={settings}>Adjust models & budget</button>{/if}
    <p class="small muted">
      {paidMode === 'fusion'
        ? 'Fusion combines its panel’s perspectives into one contribution and may research the web. You review the result before approving it.'
        : paidTask === 'narrative' || paidTask === 'narrative_edit'
          ? 'This creates a proposal for you to review. Your working text changes only when you apply it.'
          : paidTask === 'consolidate'
            ? 'This model reviews the independent contributions for overlap. Every proposed merge requires your acceptance.'
            : 'Models work independently from the same analyst context. No searches or web tools are used.'}
      Successful existing contributions are preserved.
    </p>
    <div class="dialog-actions">
      <button class="secondary" onclick={() => (dialog = '')}>Cancel</button><button
        class="primary"
        disabled={!key.trim() ||
          catalogueForKey !== key.trim() ||
          !paidModels.length ||
          paidEstimate === null ||
          (paidEstimate !== null && !canSpend(p, paidEstimate)) ||
          !paidPlan?.requests.length ||
          new Set(paidModels).size !== paidModels.length ||
          offline}
        onclick={run}
        >{paidMode === 'fusion'
          ? 'Run Fusion'
          : `Run ${paidModels.length} ${paidModels.length === 1 ? 'model' : 'models'}`}
        <ArrowRight size={16} /></button
      >
    </div></Modal
  >
{:else if dialog === 'delete'}<Modal title="Delete this exercise?" close={() => (dialog = '')}
    ><p>
      “{projects.find((p) => p.id === deleteId)?.title}” will be removed from this browser,
      including its decisions and drafts. Download a backup first if you want to keep it.
    </p>
    <div class="dialog-actions">
      <button class="secondary" onclick={() => (dialog = '')}>Keep exercise</button><button
        class="danger"
        onclick={async () => {
          try {
            await deleteProject(deleteId);
            projects = await listProjects();
            dialog = '';
            announcement = 'Exercise deleted from this browser.';
          } catch {
            error = 'Could not delete this exercise. Try again.';
            dialog = '';
          }
        }}>Delete exercise</button
      >
    </div></Modal
  >
{:else if dialog === 'help'}<HelpDialog close={() => (dialog = '')} />{/if}
