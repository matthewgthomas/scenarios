<script lang="ts">
  import { tick, onDestroy } from 'svelte';
  import {
    GitBranch,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Check,
    RotateCcw,
    ArrowRight,
    Layers,
    CircleHelp,
    Trash2
  } from '@lucide/svelte';
  import {
    uncertainties,
    statesFor,
    setChainItem,
    snapshotChain,
    flagDownstream,
    id,
    modelName,
    activeChains,
    chainExplanation,
    approvedChainSet,
    includeChain,
    editChainExplanation,
    archiveChain,
    invalidateChainSet,
    type Project,
    type Change
  } from '$lib/domain/project';
  import type { ChainGenerationOptions } from '$lib/ai/openrouter';
  import Modal from './Modal.svelte';
  import StageActions from './StageActions.svelte';
  import { chainReadiness, approveChainSet } from '$lib/domain/workflow';
  let {
    p,
    change,
    request,
    next
  }: {
    p: Project;
    change: Change;
    request: (task: 'chains', ids?: string[], options?: ChainGenerationOptions) => void;
    next: () => void;
  } = $props();
  let selectedChain = $state('');
  let editorOpen = $state(false);
  let creating = $state(false);
  let draftTitle = $state('');
  let draftExplanation = $state('');
  let draftItems = $state<Record<string, string | null>>({});
  let choosing = $state(false);
  let returnToChooser = $state(false);
  let selectedDriver = $state('');
  let perspective = $state('');
  let showAll = $state(true);
  let removedId = $state('');
  let scrollRegion = $state<HTMLDivElement>();
  let comparisonHeading = $state<HTMLHeadingElement>();
  let firstVisible = $state(0);
  let lastVisible = $state(0);
  let pendingExplanation = $state<{ chainId: string; value: string } | null>(null);
  let explanationTimer: ReturnType<typeof setTimeout>;
  const rows = $derived(uncertainties(p));
  const candidates = $derived(activeChains(p));
  const removed = $derived(p.chains.filter((c) => c.archived));
  const columns = $derived(candidates.filter((c) => showAll || c.selected));
  const chain = $derived(
    candidates.find((c) => c.id === selectedChain) ?? columns[0] ?? candidates[0]
  );
  const driver = $derived(rows.find((d) => d.id === selectedDriver) ?? rows[0]);
  const driverIndex = $derived(rows.findIndex((d) => d.id === driver?.id));
  const notes = $derived(chain?.notes ?? []);
  const models = $derived([...new Set(notes.map((n) => n.modelId))]);
  const note = $derived(
    notes
      .filter((n) => n.modelId === (models.includes(perspective) ? perspective : models[0]))
      .at(-1)
  );
  const readiness = $derived(chainReadiness(p));
  const selected = $derived(readiness.selected);
  const allApproved = $derived(readiness.canApprove && approvedChainSet(p));
  const progress = $derived(
    allApproved
      ? 'Your scenario set is ready to write.'
      : !selected.length
        ? 'Choose at least one scenario combination to take into the writing stage.'
        : readiness.issues.length
          ? `Review ${readiness.issues.length} ${readiness.issues.length === 1 ? 'issue' : 'issues'} in your chosen combinations.`
          : `${selected.length} ${selected.length === 1 ? 'combination' : 'combinations'} selected. Ready to approve.`
  );

  function saveExplanation() {
    clearTimeout(explanationTimer);
    if (!pendingExplanation) return;
    const draft = pendingExplanation;
    pendingExplanation = null;
    change((p) => editChainExplanation(p, draft.chainId, draft.value));
  }
  function queueExplanation(chainId: string, value: string) {
    pendingExplanation = { chainId, value };
    clearTimeout(explanationTimer);
    explanationTimer = setTimeout(saveExplanation, 350);
  }
  onDestroy(saveExplanation);

  function measureColumns() {
    if (!scrollRegion) return;
    const region = scrollRegion.getBoundingClientRect();
    const headers = [...scrollRegion.querySelectorAll<HTMLElement>('.scenario-heading')];
    const visible = headers.flatMap((h, i) => {
      const box = h.getBoundingClientRect();
      return box.right > region.left + 185 && box.left < region.right - 8 ? [i] : [];
    });
    firstVisible = visible[0] ?? 0;
    lastVisible = visible.at(-1) ?? 0;
  }
  $effect(() => {
    columns.map((c) => c.id).join(',');
    const region = scrollRegion;
    if (!region) return;
    const observer = new ResizeObserver(measureColumns);
    observer.observe(region);
    void tick().then(measureColumns);
    return () => observer.disconnect();
  });
  function scrollToChain(index: number) {
    const header = scrollRegion?.querySelectorAll<HTMLElement>('.scenario-heading')[index];
    if (!header || !scrollRegion) return;
    const left =
      header.getBoundingClientRect().left -
      scrollRegion.getBoundingClientRect().left +
      scrollRegion.scrollLeft -
      186;
    scrollRegion.scrollTo({
      left: Math.max(0, left),
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    });
  }
  function chooseScenarios() {
    choosing = true;
  }
  function openIssue(issue: { chainId: string; driverId?: string }) {
    returnToChooser = choosing;
    choosing = false;
    selectedChain = issue.chainId;
    selectedDriver = issue.driverId ?? rows[0]?.id ?? '';
    perspective = '';
    editorOpen = true;
  }
  function closeEditor() {
    saveExplanation();
    editorOpen = false;
    if (returnToChooser) choosing = true;
    returnToChooser = false;
  }
  function approve() {
    if (!readiness.canApprove) return;
    change((p) => {
      approveChainSet(p);
    }, `${selected.length} scenarios approved. Your set is ready to write.`);
    choosing = false;
    next();
  }
  function addChain() {
    draftTitle = '';
    draftExplanation = '';
    draftItems = {};
    creating = true;
  }
  function createChain() {
    if (!draftTitle.trim()) return;
    const newId = id('chain');
    const items = { ...$state.snapshot(draftItems) };
    change((p) => {
      p.chains.push({
        id: newId,
        title: draftTitle.trim(),
        kind: 'main',
        colour: (p.chains.length % 6) + 1,
        items,
        revision: 1,
        selected: false,
        archived: false,
        explanation: draftExplanation,
        approvedRevision: null,
        review: false,
        notes: [],
        origins: [],
        wildcardDriverIds: [],
        distinctiveness: 'Analyst-created combination'
      });
    }, 'Scenario combination created. Include it in your set when ready.');
    selectedChain = newId;
    showAll = true;
    creating = false;
  }
  async function removeChain(chainId: string) {
    saveExplanation();
    const title = candidates.find((c) => c.id === chainId)?.title;
    change(
      (p) => archiveChain(p, chainId),
      `${title} removed. Its writing and history are kept; you can restore it.`
    );
    removedId = chainId;
    if (selectedChain === chainId || editorOpen) {
      editorOpen = false;
      returnToChooser = false;
    }
    selectedChain = candidates[0]?.id ?? '';
    await tick();
    comparisonHeading?.focus();
  }
  function restoreChain(chainId: string) {
    change(
      (p) => archiveChain(p, chainId, false),
      'Combination restored. Review it and include it when you are ready.'
    );
    if (removedId === chainId) removedId = '';
    showAll = true;
  }
  function editWildcard(
    driverId: string,
    field: 'title' | 'summary' | 'assessment',
    value: string
  ) {
    if (field === 'title' && !value.trim()) return;
    change((p) => {
      const d = p.drivers.find((d) => d.id === driverId)!;
      (d.history ??= []).push({ title: d.title, summary: d.summary, revision: d.revision });
      const affected = activeChains(p).filter((c) => c.wildcardDriverIds.includes(driverId));
      affected.forEach((c) => {
        snapshotChain(p, c);
        c.revision++;
      });
      d[field] = value;
      d.revision++;
      d.approved = false;
      invalidateChainSet(
        p,
        affected.map((c) => c.id)
      );
      flagDownstream(
        p,
        5,
        `${d.title} changed. Accept the novel driver and approve the updated combination.`,
        affected.map((c) => c.id)
      );
    });
  }
  function approveWildcard(driverId: string) {
    change((p) => {
      const d = p.drivers.find((d) => d.id === driverId)!;
      const affected = activeChains(p).filter((c) => c.wildcardDriverIds.includes(driverId));
      affected.forEach((c) => {
        snapshotChain(p, c);
        c.revision++;
      });
      d.approved = !d.approved;
      invalidateChainSet(
        p,
        affected.map((c) => c.id)
      );
      flagDownstream(
        p,
        5,
        `Novel driver ${d.approved ? 'accepted' : 'acceptance revoked'}: ${d.title}.`,
        affected.map((c) => c.id)
      );
    });
  }
</script>

<div class="stage-heading">
  <div>
    <h1 data-walkthrough="stage-heading">Build scenario combinations.</h1>
    <p>
      Choose one alternative outcome per uncertainty and explain how those choices fit together.
      Each scenario combination brings outcomes together rather than describing a chronological sequence.
    </p>
  </div>
  <details class="chain-help">
    <summary aria-label="About scenario combinations"><CircleHelp size={20} /></summary>
    <p>
      Look for contrasting futures whose choices make sense together. Select one or more scenario combinations to
      write. Explore a disruption when you want to consider a surprising but plausible change.
    </p>
  </details>
</div>
<ol class="chain-steps" aria-label="Steps to complete scenario combinations">
  <li class:step-done={candidates.length > 0}>
    <span class="step-number">1</span>
    <div>
      <strong>Create scenario combinations</strong><small
        >Generate ideas with AI or build your own scenario combinations.</small
      >
    </div>
  </li>
  <li>
    <span class="step-number">2</span>
    <div>
      <strong>Explore & refine</strong><small>Compare choices and make each combination your own.</small>
    </div>
  </li>
  <li class:step-done={allApproved}>
    <span class="step-number"
      >{#if allApproved}<Check size={16} />{:else}3{/if}</span
    >
    <div>
      <strong>Choose & approve</strong><small>Take any selection of one or more into writing.</small
      >
    </div>
  </li>
</ol>
<StageActions
  generate={{ label: 'Generate combinations', onclick: () => request('chains') }}
  add={{ label: 'Add combination', onclick: addChain }}
>
  {#snippet tools()}<button
      class="secondary"
      onclick={() => request('chains', undefined, { mode: 'disruption' })}
      ><GitBranch size={16} /> Explore a disruptive wildcard</button
    >{/snippet}
</StageActions>

{#if removedId && removed.some((c) => c.id === removedId)}
  <div class="removal-receipt" role="status">
    <span>Combination removed. Its writing and history are kept.</span><button
      class="text-button"
      onclick={() => restoreChain(removedId)}><RotateCcw size={15} /> Undo removal</button
    >
  </div>
{/if}
<div class="comparison-toolbar">
  <div>
    <h2 data-walkthrough="chain-comparison" tabindex="-1" bind:this={comparisonHeading}>
      {candidates.length
        ? `${candidates.length} candidate ${candidates.length === 1 ? 'combination' : 'combinations'} to explore`
        : 'Your possible futures start here'}
    </h2>
    <p>
      {candidates.length
        ? 'Compare the columns. Open any hypothesis to shape its scenario combination.'
        : 'Generate a starting set from your approved hypotheses, or add a combination yourself.'}
    </p>
  </div>
  {#if candidates.length}<button
      data-walkthrough="chain-chooser"
      class="secondary"
      onclick={chooseScenarios}
      >View {candidates.length === 1 ? '' : 'all'}
      {candidates.length}
      {candidates.length === 1 ? 'combination' : 'scenario combinations'}
      <Layers size={16} /></button
    >{/if}
</div>
{#if candidates.length}
  <div class="comparison-navigation">
    <label class="check-label"
      ><input type="checkbox" bind:checked={showAll} /> Show all candidates</label
    >
    {#if columns.length}<div class="toolbar-group">
        <span class="small" aria-live="polite"
          >Showing {firstVisible + 1}{#if lastVisible !== firstVisible}–{lastVisible + 1}{/if} of {columns.length}{#if !showAll}
            included{/if}</span
        >
        <button
          class="secondary small"
          aria-label="Previous combinations"
          disabled={firstVisible === 0}
          onclick={() => scrollToChain(Math.max(0, firstVisible - 1))}
          ><ChevronLeft size={16} /> Previous</button
        >
        <button
          class="secondary small"
          aria-label="Next combinations"
          disabled={lastVisible >= columns.length - 1}
          onclick={() => scrollToChain(Math.min(columns.length - 1, firstVisible + 1))}
          >Next <ChevronRight size={16} /></button
        >
      </div>{/if}
  </div>
  {#if !columns.length}<div class="workflow-empty">
      <h3>No scenarios are included yet</h3>
      <button class="secondary" onclick={() => (showAll = true)}>Show all candidates</button>
    </div>
  {:else}<div
      class="table-scroll chain-scroll"
      bind:this={scrollRegion}
      onscroll={measureColumns}
      role="region"
      aria-label="Compare scenario combinations"
    >
      <table class="chain-table" style:min-width={`${180 + columns.length * 250}px`}>
        <caption class="sr-only"
          >One hypothesis per critical uncertainty. Open a cell to inspect or change it. Choose
          combinations with Include in set.</caption
        >
        <colgroup
          ><col class="uncertainty-column" />{#each columns as c (c.id)}<col />{/each}</colgroup
        >
        <thead
          ><tr
            ><th class="uncertainty-heading" scope="col">Critical uncertainty</th>
            {#each columns as c (c.id)}<th
                scope="col"
                class="scenario-heading scenario-{c.colour}"
                class:chain-included={c.selected}
              >
                <label class="chain-include"
                  ><input
                    aria-label={`Include ${c.title} in scenario set`}
                    type="checkbox"
                    checked={c.selected}
                    onchange={(e) => {
                      const checked = e.currentTarget.checked;
                      change((p) => includeChain(p, c.id, checked));
                    }}
                  /><span>{c.selected ? 'Included in your set' : 'Include in set'}</span></label
                >
                <button
                  class="scenario-name"
                  aria-label={`Edit scenario: ${c.title}`}
                  aria-haspopup="dialog"
                  onclick={() => {
                    selectedChain = c.id;
                    selectedDriver = rows[0]?.id ?? '';
                    perspective = '';
                    returnToChooser = false;
                    editorOpen = true;
                  }}>{c.title}</button
                >
                <div class="scenario-heading-state">
                  <span
                    >{c.review
                      ? '◒ Review suggested'
                      : c.approvedRevision === c.revision
                        ? '✓ Analyst-approved'
                        : c.origins.length
                          ? '○ Proposed combination'
                          : '○ Analyst-created'}</span
                  >
                </div>
                <div class="chain-header-actions">
                  <button
                    class="text-button"
                    aria-label={`Remove combination: ${c.title}`}
                    onclick={() => removeChain(c.id)}><Trash2 size={14} /> Remove combination</button
                  >
                </div>
              </th>{/each}</tr
          ></thead
        >
        <tbody
          >{#each rows as d (d.id)}<tr
              ><th scope="row"><span>{d.title}</span><small>{d.tags.join(' / ')}</small></th>
              {#each columns as c (c.id)}{@const h = p.hypotheses.find(
                  (h) => h.id === c.items[d.id]
                )}<td
                  ><button
                    class="hypothesis-cell"
                    class:selected-cell={chain?.id === c.id && driver?.id === d.id}
                    onclick={() => {
                      selectedChain = c.id;
                      selectedDriver = d.id;
                      perspective = '';
                      returnToChooser = false;
                      editorOpen = true;
                    }}
                    aria-haspopup="dialog"
                    aria-label={`${c.title}: ${d.title} — ${h?.title ?? (Object.hasOwn(c.items, d.id) ? 'Deliberately unresolved' : 'Not chosen yet')}`}
                  >
                    <span
                      >{h?.title ??
                        (Object.hasOwn(c.items, d.id)
                          ? 'Deliberately unresolved'
                          : 'Not chosen yet')}{#if h?.archived}<small class="review-text"
                          >Removed state · review suggested</small
                        >{/if}</span
                    ><ChevronDown size={16} /></button
                  ></td
                >{/each}
            </tr>{/each}</tbody
        >
      </table>
    </div>{/if}
{:else}<div class="chain-empty">
    <GitBranch size={36} />
    <h3>What could happen when these futures meet?</h3>
    <p>
      Use Generate combinations for a first set of ideas, or Add combination to follow your own
      thinking. Every combination stays editable.
    </p>
  </div>{/if}

{#if removed.length}<details class="removed-chains">
    <summary>Removed combinations ({removed.length})</summary>
    <p class="small muted">
      Their writing and history are saved. Restoring a combination does not automatically include or
      approve it.
    </p>
    {#each removed as c (c.id)}<div class="removed-chain">
        <span>{c.title}</span><button class="secondary small" onclick={() => restoreChain(c.id)}
          ><RotateCcw size={14} /> Restore combination</button
        >
      </div>{/each}
  </details>{/if}

{#if candidates.length}<footer class="stage-footer" data-walkthrough="stage-complete">
    <div class="footer-description">
      <Layers size={20} />
      <div>
        <strong role="status">{progress}</strong><small
          >{selected.length} {selected.length === 1 ? 'combination' : 'combinations'} selected</small
        >
      </div>
    </div>
    <div class="toolbar-group">
      {#if allApproved}<button
          class="text-button"
          onclick={() =>
            change((p) => {
              selected.forEach((c) => {
                p.chains.find((v) => v.id === c.id)!.approvedRevision = null;
              });
              invalidateChainSet(p);
            }, 'Scenario approval undone. Writing preserved.')}
          ><RotateCcw size={16} /> Undo approval</button
        ><button class="primary" onclick={next}
          >Write & review scenarios <ArrowRight size={16} /></button
        >
      {:else}<button class="primary" onclick={chooseScenarios} aria-haspopup="dialog"
          >{readiness.canApprove
            ? `Review & approve ${selected.length} ${selected.length === 1 ? 'combination' : 'combinations'}`
            : 'Choose combinations to write'}
          <ArrowRight size={16} /></button
        >{/if}
    </div>
  </footer>{/if}

{#if creating}<Modal title="Create a scenario combination" close={() => (creating = false)} wide>
    <form
      class="editor-form"
      onsubmit={(e) => {
        e.preventDefault();
        createChain();
      }}
    >
      <p>
        Combine alternative outcomes, then explain how they fit together. Nothing is saved until you
        choose Create combination.
      </p>
      <label
        >Scenario name<input
          required
          bind:value={draftTitle}
          placeholder="Name this possible future"
        /></label
      >
      {#each rows as d}<label
          >{d.title}<select
            value={Object.hasOwn(draftItems, d.id) ? (draftItems[d.id] ?? '__unresolved') : ''}
            onchange={(e) => {
              const value = e.currentTarget.value;
              if (value) draftItems[d.id] = value === '__unresolved' ? null : value;
            }}
          >
            <option value="" disabled>Not chosen yet</option>
            {#each statesFor(p, d.id).filter((h) => h.approved) as h}<option value={h.id}
                >{h.title}</option
              >{/each}
            <option value="__unresolved">Deliberately leave unresolved</option>
          </select></label
        >{/each}
      <label
        >What connects these choices? (optional)<textarea
          rows="4"
          bind:value={draftExplanation}
          placeholder="How might these outcomes reinforce or challenge each other?"
        ></textarea></label
      >
      <p class="small muted">
        You can finish choosing outcomes later. Every uncertainty needs an outcome or an explicit
        decision to leave it unresolved before approval.
      </p>
      <div class="dialog-actions">
        <button type="button" class="secondary" onclick={() => (creating = false)}>Cancel</button
        ><button type="submit" class="primary" disabled={!draftTitle.trim()}
          >Create combination</button
        >
      </div>
    </form>
  </Modal>{/if}

{#if choosing}<Modal title="Choose combinations to write" close={() => (choosing = false)} wide>
    <p class="chooser-intro">
      Choose any combinations you want to turn into scenarios. Select at least one. Your choices are saved
      as you go.
    </p>
    <div class="chooser-progress" aria-live="polite">
      <strong>{selected.length} {selected.length === 1 ? 'combination' : 'combinations'} selected</strong>
    </div>
    <section aria-label="Candidate combinations">
      {#each candidates as c (c.id)}{@const issues = readiness.candidateIssues.filter(
          (issue) => issue.chainId === c.id
        )}
        <article class="chain-choice" class:included={c.selected}>
          <label class="choice-label"
            ><input
              type="checkbox"
              aria-label={`Include ${c.title} in scenario set`}
              checked={c.selected}
              onchange={(e) => {
                const checked = e.currentTarget.checked;
                change((p) => includeChain(p, c.id, checked));
              }}
            />
            <span
              ><strong>{c.title}</strong><small
                >{c.distinctiveness ||
                  chainExplanation(c) ||
                  'Your own combination of hypotheses.'}</small
              ></span
            ></label
          >
          <button class="text-button" onclick={() => openIssue({ chainId: c.id })}
            >Review combination <ChevronRight size={16} /></button
          >
          {#if issues.length}<div class="choice-issues">
              {#each issues as issue}<button class="workflow-link" onclick={() => openIssue(issue)}
                  >{issue.message} <ArrowRight size={14} /></button
                >{/each}
            </div>{/if}
        </article>
      {/each}
    </section>
    <div class="chooser-footer">
      <div class="chooser-readiness" role="status">
        {#if !selected.length}<p>Choose at least one scenario combination to take into writing.</p>
        {:else if readiness.issues.length}<p>
            Review the named issues in your included scenario combinations before approving.
          </p>
        {:else}<p>
            <Check size={16} /> Your set is ready to approve. Next, you’ll write each scenario.
          </p>{/if}
      </div>
      <div class="dialog-actions">
        <button class="secondary" onclick={() => (choosing = false)}>Back to comparison</button
        ><button class="primary" disabled={!readiness.canApprove} onclick={approve}
          ><Check size={16} /> Approve {selected.length}
          {selected.length === 1 ? 'combination' : 'combinations'} & start writing</button
        >
      </div>
    </div>
  </Modal>{/if}

{#if editorOpen && chain && driver}<Modal
    title={`Edit combination: ${chain.title}`}
    close={closeEditor}
    wide
  >
    <section class="inspector modal-inspector" aria-label="Combination reasoning and hypothesis editor">
      <div class="chain-reasoning">
        <div class="context-line"><GitBranch size={18} /><span>{chain.title}</span></div>
        <label class="explanation-label" for="chain-explanation">What connects these choices?</label
        >
        <p class="small muted" id="explanation-help">
          Make this explanation your own. It is optional and saves automatically. Original model
          reasoning is kept below.
        </p>
        <textarea
          id="chain-explanation"
          rows="7"
          aria-describedby="explanation-help"
          value={pendingExplanation?.chainId === chain.id
            ? pendingExplanation.value
            : chainExplanation(chain)}
          placeholder="How do these futures reinforce or challenge each other?"
          oninput={(e) => queueExplanation(chain.id, e.currentTarget.value)}
          onblur={saveExplanation}></textarea>
        <p class="small muted">
          {chain.explanation == null && chain.notes.length
            ? 'Starting text from the original model contribution.'
            : chain.explanation != null
              ? 'Your explanation · analyst-edited'
              : 'Your thinking can start here.'}
        </p>
        {#if note}<details class="model-reference">
            <summary>Model reasoning</summary>
            <div class="segmented model-tabs" aria-label="Model perspectives">
              {#each models as model, i}<button
                  class:active={note.modelId === model}
                  aria-pressed={note.modelId === model}
                  onclick={() => (perspective = model)}
                  ><span class="model-mark">{['●', '■', '▲', '◆'][i % 4]}</span>{modelName(
                    model
                  )}</button
                >{/each}
            </div>
            <p>{note.reasoning}</p>
            <p class="small muted">
              {note.modelId} · checked revision {note.revision} · {new Date(
                note.at
              ).toLocaleDateString()}{#if note.revision !== chain.revision}<span
                  class="review-text"
                >
                  — Review suggested after your edit</span
                >{/if}
            </p>
            <details>
              <summary>Original model contribution</summary>
              <p>{chain.notes[0].reasoning}</p>
              <p class="small muted">{chain.notes[0].modelId}</p>
            </details>
            <h3>Tensions</h3>
            <ul>
              {#each note.tensions as text}<li>{text}</li>{/each}
            </ul>
            <h3>Assumptions</h3>
            <ul>
              {#each note.assumptions as text}<li>{text}</li>{/each}
            </ul>
          </details>{:else}<p class="small muted">
            No model check yet. You can complete your set using your own judgement.
          </p>{/if}
      </div>
      <div class="inspector-editor">
        <label class="spaced"
          >Scenario name<input
            value={chain.title}
            onchange={(e) => {
              const value = e.currentTarget.value.trim();
              if (value && value !== chain.title)
                change((p) => {
                  const c = p.chains.find((c) => c.id === chain.id)!;
                  snapshotChain(p, c);
                  c.title = value;
                  c.revision++;
                  invalidateChainSet(p, [c.id]);
                });
              else e.currentTarget.value = chain.title;
            }}
          /></label
        >
        <div class="uncertainty-navigation">
          <label
            >Uncertainty to explore<select
              aria-label="Uncertainty to explore"
              value={driver.id}
              onchange={(e) => (selectedDriver = e.currentTarget.value)}
              >{#each rows as d}<option value={d.id}>{d.title}</option>{/each}</select
            ></label
          >
          <div class="toolbar-group">
            <button
              class="secondary small"
              aria-label="Previous uncertainty"
              disabled={driverIndex === 0}
              onclick={() => (selectedDriver = rows[driverIndex - 1].id)}
              ><ChevronLeft size={16} /></button
            ><span class="small">{driverIndex + 1} of {rows.length} uncertainties</span><button
              class="secondary small"
              aria-label="Next uncertainty"
              disabled={driverIndex === rows.length - 1}
              onclick={() => (selectedDriver = rows[driverIndex + 1].id)}
              ><ChevronRight size={16} /></button
            >
          </div>
        </div>
        <label
          >{driver.title} hypothesis<select
            id="chain-hypothesis"
            value={Object.hasOwn(chain.items, driver.id)
              ? (chain.items[driver.id] ?? '__unresolved')
              : ''}
            onchange={(e) => {
              const value = e.currentTarget.value;
              if (!value) return;
              change(
                (p) =>
                  setChainItem(p, chain.id, driver.id, value === '__unresolved' ? null : value),
                'Hypothesis changed. Earlier reasoning and writing are preserved.'
              );
            }}
            ><option value="" disabled>Not chosen yet</option><option value="__unresolved"
              >Deliberately leave unresolved</option
            >{#each statesFor(p, driver.id) as h}<option value={h.id}
                >{h.title}{h.approved ? '' : ' (not approved)'}</option
              >{/each}</select
          ></label
        >
        <p>
          {p.hypotheses.find((h) => h.id === chain.items[driver.id])?.description ??
            (Object.hasOwn(chain.items, driver.id)
              ? 'You have deliberately left this uncertainty unresolved. It stays explicit in writing and exports.'
              : 'No outcome has been chosen yet. Choose an approved hypothesis, or deliberately leave this uncertainty unresolved.')}
        </p>
        {#if chain.wildcardDriverIds.length}<div class="notice review">
            <strong>Additional drivers to review · unscored</strong
            >{#each chain.wildcardDriverIds as driverId}{@const d = p.drivers.find(
                (d) => d.id === driverId
              )}{#if d}<label class="spaced"
                  >Additional driver name<input
                    value={d.title}
                    onchange={(e) => editWildcard(driverId, 'title', e.currentTarget.value)}
                  /></label
                >
                <label class="spaced"
                  >Future disruption<textarea
                    rows="2"
                    value={d.summary}
                    onchange={(e) => editWildcard(driverId, 'summary', e.currentTarget.value)}
                  ></textarea></label
                >
                <label class="spaced"
                  >Plausibility, humanitarian significance and interactions<textarea
                    rows="3"
                    value={d.assessment ?? ''}
                    onchange={(e) => editWildcard(driverId, 'assessment', e.currentTarget.value)}
                  ></textarea></label
                >
                <p class="small">Unscored. No matrix positions have been assigned.</p>
                <div class="toolbar-group">
                  <button class="secondary" onclick={() => approveWildcard(driverId)}
                    >{d.approved ? '✓ Accepted · undo' : 'Accept driver'}</button
                  ><button
                    class="text-button"
                    onclick={() =>
                      change((p) => {
                        const c = p.chains.find((c) => c.id === chain.id)!;
                        c.wildcardDriverIds = c.wildcardDriverIds.filter((i) => i !== driverId);
                        c.revision++;
                        invalidateChainSet(p, [c.id]);
                      })}><Trash2 size={14} /> Remove</button
                  >
                </div>{/if}{/each}
          </div>{/if}
      </div>
    </section>
    <div class="dialog-actions">
      <button class="text-button" onclick={() => removeChain(chain.id)}
        ><Trash2 size={16} /> Remove combination</button
      ><button class="primary" onclick={closeEditor}
        >{returnToChooser ? 'Back to your choices' : 'Done'}</button
      >
    </div>
  </Modal>{/if}

<style>
  .stage-heading > div {
    max-width: 76ch;
  }
  .chain-steps {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    padding: 0;
    margin: 0 0 28px;
    gap: 24px;
  }
  .chain-steps li {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }
  .step-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 1px solid var(--cg-control-border);
    border-radius: 50%;
    flex-shrink: 0;
    font-weight: 700;
    color: var(--cg-action);
  }
  .step-done .step-number {
    background: var(--cg-selection);
    border-color: var(--cg-action);
  }
  .chain-steps strong {
    font-size: 0.875rem;
  }
  .chain-steps small {
    display: block;
    color: var(--cg-text-muted);
    line-height: 1.5;
    margin-top: 3px;
  }
  .comparison-toolbar,
  .comparison-navigation,
  .removal-receipt,
  .removed-chain {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .comparison-toolbar {
    margin: 24px 0 16px;
  }
  .comparison-navigation {
    margin-bottom: 16px;
    font-size: 0.875rem;
  }
  .chain-scroll {
    margin-bottom: 28px;
  }
  .chain-table {
    width: 100%;
  }
  .uncertainty-column {
    width: 180px;
  }
  .chain-table .uncertainty-heading {
    position: sticky;
    left: -6px;
    background: var(--cg-workspace);
    z-index: 2;
    font-size: 0.875rem;
  }
  .chain-table .scenario-heading {
    width: auto;
    border: 2px solid transparent;
    transition: border-color var(--cg-duration-feedback);
  }
  .chain-table .chain-included {
    border-color: var(--cg-action);
  }
  .chain-include {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    font-size: 0.875rem;
    margin-bottom: 12px;
    font-weight: 600;
  }
  .chain-include input {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }
  .chain-header-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin-top: 10px;
  }
  .chain-header-actions .text-button {
    font-size: 0.875rem;
    min-height: 32px;
    opacity: 1;
  }
  .chain-empty {
    text-align: center;
    padding: 36px 24px 48px;
    color: var(--cg-text-muted);
  }
  .chain-empty > :global(svg) {
    color: var(--cg-action);
  }
  .chain-empty h3 {
    color: var(--cg-text);
    font-size: 1.25rem;
    margin: 12px 0;
  }
  .chain-empty p {
    max-width: 60ch;
    margin: 0 auto;
  }
  .removal-receipt {
    background: var(--cg-selection);
    padding: 12px 18px;
    border-radius: 8px;
  }
  .removed-chains {
    border-top: 1px solid var(--cg-border);
    padding: 18px 0;
    margin: 16px 0;
  }
  .removed-chains summary {
    cursor: pointer;
    font-weight: 600;
  }
  .removed-chain {
    padding: 10px 0;
    border-bottom: 1px solid var(--cg-border);
  }
  .chooser-intro {
    margin-top: 0;
  }
  .chooser-progress {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 24px;
    padding: 14px 0;
    border-bottom: 1px solid var(--cg-border);
    font-size: 0.875rem;
  }
  .chain-choice {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    padding: 16px;
    margin: 8px 0;
    background: var(--cg-workspace);
    border: 2px solid transparent;
    border-radius: 8px;
    transition:
      background var(--cg-duration-feedback),
      border-color var(--cg-duration-feedback);
  }
  .chain-choice.included {
    border-color: var(--cg-action);
    background: var(--cg-selection);
  }
  .choice-label {
    display: flex;
    flex-direction: row;
    flex: 1;
    align-items: flex-start;
    gap: 12px;
    min-width: 180px;
    cursor: pointer;
  }
  .choice-label input {
    width: 18px;
    height: 18px;
    margin-top: 3px;
    flex-shrink: 0;
  }
  .choice-label strong {
    display: block;
  }
  .choice-label small {
    display: block;
    font-weight: 400;
    color: var(--cg-text-muted);
    line-height: 1.5;
    margin-top: 4px;
  }
  .choice-issues {
    width: 100%;
    padding-left: 30px;
  }
  .choice-issues button {
    text-align: left;
  }
  .chooser-readiness {
    margin: 20px 0 8px;
    font-size: 0.875rem;
    color: var(--cg-text-muted);
  }
  .chooser-footer {
    position: sticky;
    bottom: 0;
    z-index: 1;
    background: var(--cg-paper);
    border-top: 1px solid var(--cg-border);
    padding: 8px 0 16px;
  }
  .chooser-footer .dialog-actions {
    margin-top: 14px;
  }
  @media (max-height: 640px), (max-width: 680px) {
    .chooser-footer {
      position: static;
    }
  }
  .chooser-readiness p {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 6px 0;
  }
  .explanation-label {
    display: block;
    font-size: 1.125rem;
    font-weight: 700;
    margin: 16px 0 8px;
  }
  .chain-reasoning textarea {
    display: block;
    width: 100%;
    margin-top: 8px;
    line-height: 1.7;
  }
  .model-reference {
    border-top: 1px solid var(--cg-border);
    margin-top: 24px;
    padding-top: 16px;
  }
  .model-reference summary {
    font-weight: 600;
    cursor: pointer;
  }
  .model-reference .model-tabs {
    margin-top: 16px;
    flex-wrap: wrap;
  }
  .uncertainty-navigation {
    padding: 16px 0;
    border-top: 1px solid var(--cg-border);
    margin: 16px 0;
  }
  .uncertainty-navigation .toolbar-group {
    margin-top: 10px;
    justify-content: space-between;
  }
  .dialog-actions {
    flex-wrap: wrap;
  }
  @media (max-width: 1100px) {
    .chain-steps {
      gap: 16px;
    }
  }
  @media (max-width: 680px) {
    .chain-steps {
      grid-template-columns: 1fr;
      gap: 14px;
    }
    .comparison-navigation .toolbar-group {
      width: 100%;
    }
    .chain-choice {
      align-items: flex-start;
    }
    .choice-label {
      min-width: 0;
      flex-basis: 100%;
    }
    .choice-issues {
      padding-left: 0;
    }
    .dialog-actions > button {
      flex: 1 1 100%;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .chain-choice,
    .chain-table .scenario-heading {
      transition: none;
    }
  }
</style>
