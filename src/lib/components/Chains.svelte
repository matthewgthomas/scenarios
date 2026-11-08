<script lang="ts">
  import {
    GitBranch,
    ChevronDown,
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
    type Project,
    type Change
  } from '$lib/domain/project';
  import Modal from './Modal.svelte';
  import StageGuide from './StageGuide.svelte';
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
    request: (task: 'chains' | 'coherence', ids?: string[]) => void;
    next: () => void;
  } = $props();
  let selectedChain = $state('');
  let editorOpen = $state(false);
  let selectedDriver = $state('');
  let perspective = $state('');
  let showAll = $state(true);
  const rows = $derived(uncertainties(p));
  const columns = $derived(p.chains.filter((c) => showAll || c.selected));
  const chain = $derived(p.chains.find((c) => c.id === selectedChain) ?? columns[0]);
  const driver = $derived(rows.find((d) => d.id === selectedDriver) ?? rows[1] ?? rows[0]);
  const notes = $derived(chain?.notes ?? []);
  const models = $derived([...new Set(notes.map((n) => n.modelId))]);
  const note = $derived(
    notes
      .filter((n) => n.modelId === (models.includes(perspective) ? perspective : models[0]))
      .at(-1)
  );
  const readiness = $derived(chainReadiness(p));
  const selected = $derived(readiness.selected);
  const mainSelected = $derived(selected.filter((c) => c.kind === 'main').length);
  const wildSelected = $derived(selected.filter((c) => c.kind === 'wildcard').length);
  const allApproved = $derived(
    readiness.canApprove &&
      mainSelected === p.mainCount &&
      wildSelected === p.wildcardCount &&
      selected.every((c) => c.approvedRevision === c.revision && !c.review)
  );
  function openIssue(issue: { chainId: string; driverId?: string }) {
    selectedChain = issue.chainId;
    selectedDriver = issue.driverId ?? rows[0]?.id ?? '';
    editorOpen = true;
  }
  function chooseScenarios() {
    if (!p.chains.length) {
      addChain();
      return;
    }
    showAll = true;
    setTimeout(
      () =>
        document.querySelector<HTMLInputElement>('.chain-table input[type="checkbox"]')?.focus(),
      0
    );
  }
  function approve() {
    if (!readiness.canApprove) return false;
    change((p) => {
      approveChainSet(p);
    }, `${selected.length} chains approved at their current revisions.`);
    return true;
  }
  function addChain() {
    const newId = id('chain');
    change((p) =>
      p.chains.push({
        id: newId,
        title: 'Untitled scenario',
        kind: 'main',
        colour: (p.chains.length % 6) + 1,
        items: Object.fromEntries(rows.map((d) => [d.id, null])),
        revision: 1,
        selected: false,
        approvedRevision: null,
        review: false,
        notes: [],
        origins: [],
        wildcardDriverIds: [],
        distinctiveness: 'Analyst-created chain'
      })
    );
    selectedChain = newId;
    selectedDriver = rows[0]?.id ?? '';
    showAll = true;
    editorOpen = true;
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
      const affected = p.chains.filter((c) => c.wildcardDriverIds.includes(driverId));
      affected.forEach((c) => {
        snapshotChain(p, c);
        c.revision++;
      });
      d[field] = value;
      d.revision++;
      d.approved = false;
      flagDownstream(
        p,
        5,
        `${d.title} changed. Accept the novel driver and approve the updated chain.`,
        affected.map((c) => c.id)
      );
    });
  }
  function approveWildcard(driverId: string) {
    change((p) => {
      const d = p.drivers.find((d) => d.id === driverId)!;
      const affected = p.chains.filter((c) => c.wildcardDriverIds.includes(driverId));
      affected.forEach((c) => {
        snapshotChain(p, c);
        c.revision++;
      });
      d.approved = !d.approved;
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
    <h1>Construct chains of hypotheses.</h1>
    <p>Compare how your critical uncertainties could combine into scenarios.</p>
  </div>
  <details class="chain-help">
    <summary aria-label="About scenario chains"><CircleHelp size={20} /></summary>
    <p>
      Each chain combines one future state per critical uncertainty. Select cells to inspect the
      reasoning and change a choice. Unresolved is an intentional option. Chains explore plausible
      combinations; they do not predict likelihood.
    </p>
  </details>
</div>
<StageGuide
  title={allApproved
    ? 'Your scenario set is ready to write'
    : readiness.canApprove
      ? `Your ${selected.length} ${selected.length === 1 ? 'scenario is' : 'scenarios are'} ready for approval`
      : readiness.issues.length
        ? `${readiness.issues.length} chain ${readiness.issues.length === 1 ? 'issue needs' : 'issues need'} your attention`
        : `Choose ${p.mainCount} main ${p.mainCount === 1 ? 'scenario' : 'scenarios'}${p.wildcardCount ? ` and ${p.wildcardCount} ${p.wildcardCount === 1 ? 'wildcard' : 'wildcards'}` : ''}`}
  description="Each scenario will appear in its own column and represents a combination of futures for your critical uncertainties. Include the ones you want in your set, open cells to review their hypotheses, then approve the set. Inclusion chooses your scenarios; approval confirms your review."
  ready={allApproved}
  helpTitle="How do I build a useful set of scenarios?"
>
  {#snippet children()}
    <span class="workflow-chip">{mainSelected} of {p.mainCount} main scenarios included</span>
    <span class="workflow-chip">{wildSelected} of {p.wildcardCount} wildcards included</span>
    {#each readiness.issues as issue}<button class="workflow-link" onclick={() => openIssue(issue)}
        >{issue.message}<ArrowRight size={14} /></button
      >{/each}
  {/snippet}
  {#snippet help()}<p>
      Look for contrasting stories with choices that make sense together. A wildcard explores a
      surprising but plausible disruption. You can deliberately leave a hypothesis unresolved. An AI
      coherence check is optional; editing never runs one automatically.
    </p>{/snippet}
</StageGuide>
<StageActions
  generate={{ label: 'Generate chains', onclick: () => request('chains') }}
  add={{ label: 'Add chain', onclick: addChain }}
>
  {#snippet context()}
    <details class="portfolio">
      <summary
        >Portfolio targets: {p.mainCount} main / {p.wildcardCount} wildcards <ChevronDown
          size={14}
        /></summary
      >
      <div class="popover-fields">
        <label
          >Main scenarios<input
            type="number"
            min="1"
            max="12"
            value={p.mainCount}
            onchange={(e) => {
              const n = +e.currentTarget.value;
              if (n >= 1 && n <= 12) change((p) => (p.mainCount = Math.round(n)));
            }}
          /></label
        ><label
          >Wildcards<input
            type="number"
            min="0"
            max="6"
            value={p.wildcardCount}
            onchange={(e) => {
              const n = +e.currentTarget.value;
              if (n >= 0 && n <= 6) change((p) => (p.wildcardCount = Math.round(n)));
            }}
          /></label
        >
      </div>
    </details>
  {/snippet}
</StageActions>
{#if p.chains.length}
  {#if !columns.length}<div class="workflow-empty">
      <h3>No scenarios are included yet</h3>
      <button class="secondary" onclick={() => (showAll = true)}>Show all candidates</button>
    </div>{/if}
  <div class="table-scroll chain-scroll">
    <table class="chain-table">
      <caption class="sr-only"
        >Scenario chains: one hypothesis per critical uncertainty. Select a cell to inspect or
        change it.</caption
      >
      <thead
        ><tr
          ><th class="uncertainty-heading" scope="col">Critical uncertainty</th
          >{#each columns as c (c.id)}<th scope="col" class="scenario-heading scenario-{c.colour}"
              ><label class="chain-include"
                ><input
                  aria-label={`Include ${c.title} in scenario set`}
                  type="checkbox"
                  checked={c.selected}
                  onchange={(e) => {
                    const checked = e.currentTarget.checked;
                    change((p) => (p.chains.find((v) => v.id === c.id)!.selected = checked));
                  }}
                /><span>Include in set</span></label
              >
              <div class="scenario-heading-top">
                <button
                  class="scenario-name"
                  aria-label={`Edit scenario: ${c.title}`}
                  aria-haspopup="dialog"
                  onclick={() => {
                    selectedChain = c.id;
                    editorOpen = true;
                  }}>{c.title}</button
                >
              </div>
              <div class="scenario-heading-state">
                {#if c.kind === 'wildcard'}<span class="badge">Wildcard</span>{/if}<span
                  >{c.approvedRevision === c.revision
                    ? '✓ Analyst-approved'
                    : c.review
                      ? '◒ Review suggested'
                      : c.origins.length
                        ? '○ Proposed chain'
                        : '○ Analyst-created'}</span
                >
              </div>
              <button
                class="text-button small"
                onclick={() =>
                  change((p) => {
                    const chain = p.chains.find((v) => v.id === c.id)!;
                    chain.kind = chain.kind === 'main' ? 'wildcard' : 'main';
                    chain.revision++;
                    flagDownstream(p, 5, 'Scenario type changed.', [c.id]);
                  })}>Make {c.kind === 'main' ? 'wildcard' : 'main'}</button
              ></th
            >{/each}</tr
        ></thead
      >
      <tbody
        >{#each rows as d (d.id)}<tr
            ><th scope="row"><span>{d.title}</span><small>{d.tags.join(' / ')}</small></th
            >{#each columns as c (c.id)}{@const h = p.hypotheses.find(
                (h) => h.id === c.items[d.id]
              )}<td
                ><button
                  class:selected-cell={chain?.id === c.id && driver?.id === d.id}
                  class="hypothesis-cell"
                  onclick={() => {
                    selectedChain = c.id;
                    selectedDriver = d.id;
                    perspective = '';
                    editorOpen = true;
                  }}
                  aria-haspopup="dialog"
                  aria-pressed={chain?.id === c.id && driver?.id === d.id}
                  ><span
                    >{h?.title ?? 'Unresolved'}{#if h?.archived}<small class="review-text"
                        >Removed state · review suggested</small
                      >{/if}</span
                  ><ChevronDown size={16} /></button
                ></td
              >{/each}</tr
          >{/each}</tbody
      >
    </table>
  </div>
  <div class="under-table">
    <div class="toolbar-group">
      <span>Select a hypothesis to inspect or change it.</span><button
        class="text-button small"
        onclick={() => (editorOpen = true)}
        aria-haspopup="dialog">Edit selected hypothesis</button
      >
    </div>
    <label class="check-label"
      ><input type="checkbox" bind:checked={showAll} /> Show all candidates</label
    >
  </div>
  {#if editorOpen && chain && driver}
    <Modal title={`Edit chain: ${chain.title}`} close={() => (editorOpen = false)} wide>
      <section class="inspector modal-inspector" aria-label="Chain reasoning and hypothesis editor">
        <div>
          <div class="context-line">
            <GitBranch size={18} /><span>{chain.title} / {driver.title}</span>
          </div>
          <h2>What connects these choices?</h2>
          {#if note}<p>{note.reasoning}</p>
            <div class="segmented model-tabs" aria-label="Model perspectives">
              {#each models as model, i}<button
                  class:active={note.modelId === model}
                  onclick={() => (perspective = model)}
                  ><span class="model-mark">{['●', '■', '▲', '◆'][i % 4]}</span>{modelName(
                    model
                  )}</button
                >{/each}
            </div>
            <p class="small muted">
              {note.modelId} · checked revision {note.revision} · {new Date(
                note.at
              ).toLocaleDateString()}{#if note.revision !== chain.revision}
                <span class="review-text">— Review suggested after your edit</span>{/if}
            </p>
            <details>
              <summary>Inspect tensions and assumptions</summary>
              <h3>Tensions</h3>
              <ul>
                {#each note.tensions as text}<li>{text}</li>{/each}
              </ul>
              <h3>Assumptions</h3>
              <ul>
                {#each note.assumptions as text}<li>{text}</li>{/each}
              </ul>
            </details>
          {:else}<p class="muted">
              No model coherence check yet. You can inspect and edit the chain, then request a check
              when useful.
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
                    const saved = p.chains.find((c) => c.id === chain.id)!;
                    snapshotChain(p, saved);
                    saved.title = value;
                    saved.revision++;
                    flagDownstream(p, 5, `${value} was renamed.`, [saved.id]);
                  });
                else e.currentTarget.value = chain.title;
              }}
            /></label
          >
          <label
            >{driver.title} hypothesis<select
              id="chain-hypothesis"
              value={chain.items[driver.id] ?? ''}
              onchange={(e) => {
                const value = e.currentTarget.value;
                change(
                  (p) => setChainItem(p, chain.id, driver.id, value || null),
                  'Hypothesis changed. Earlier coherence notes are preserved.'
                );
              }}
              ><option value="">Unresolved</option>{#each statesFor(p, driver.id) as h}<option
                  value={h.id}>{h.title}{h.approved ? '' : ' (not approved)'}</option
                >{/each}</select
            ></label
          >
          <p>
            {p.hypotheses.find((h) => h.id === chain.items[driver.id])?.description ??
              'This uncertainty is intentionally unresolved. It will remain explicit in drafting and exports.'}
          </p>
          <p class="small muted">Your judgement decides. Editing preserves earlier work.</p>
          <button
            class="secondary"
            onclick={() => {
              editorOpen = false;
              request('coherence', [chain.id]);
            }}><GitBranch size={16} /> Recheck coherence</button
          >
          <p class="small muted">Choose models and review the estimate before running.</p>
          {#if chain.wildcardDriverIds.length}<div class="notice review">
              <strong>Novel wildcard drivers · unscored</strong
              >{#each chain.wildcardDriverIds as driverId}{@const d = p.drivers.find(
                  (d) => d.id === driverId
                )}{#if d}<label class="spaced"
                    >Novel driver name<input
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
                          c.review = true;
                        })}><Trash2 size={14} /> Remove</button
                    >
                  </div>{/if}{/each}
            </div>{/if}
        </div>
      </section>
      <div class="dialog-actions">
        <button class="primary" onclick={() => (editorOpen = false)}>Done</button>
      </div>
    </Modal>
  {/if}
{:else}<div class="empty-state">
    <GitBranch size={34} />
    <h2>Different futures start with different combinations.</h2>
    <p>
      Generate independent candidate chains from your approved hypotheses, or build one yourself.
    </p>
    <p class="small muted">
      Use Generate chains above for AI suggestions, or Add chain to build your own.
    </p>
  </div>{/if}
{#if p.chains.length}<footer class="stage-footer">
    <div class="footer-description">
      <Layers size={20} />
      <div>
        <strong
          >{allApproved
            ? `${selected.length} hypothesis chains approved`
            : 'Your judgement, at every stage'}</strong
        ><small
          >{readiness.issues.length
            ? 'Open the named issues above and choose approved hypotheses or Unresolved.'
            : !readiness.targetsMet
              ? `Your target is ${p.mainCount} main scenarios and ${p.wildcardCount} wildcards. Tick a hypothesis chain to include it in your final set of scenarios.`
              : 'Next, turn these combinations into narratives in your own words.'}</small
        >
      </div>
    </div>
    <div class="toolbar-group">
      {#if allApproved}<button
          class="text-button"
          onclick={() =>
            change((p) => {
              p.chains.filter((c) => c.selected).forEach((c) => (c.approvedRevision = null));
              p.completed = p.completed.filter((s) => s !== 5);
            }, 'Chain approval undone. Drafts preserved.')}
          ><RotateCcw size={16} /> Undo approval</button
        ><button class="primary" onclick={next}
          >Write & review scenarios <ArrowRight size={16} /></button
        >{:else if readiness.issues.length}<button
          class="primary"
          onclick={() => openIssue(readiness.issues[0])}
          >Review next chain issue <ArrowRight size={16} /></button
        >
      {:else if !readiness.targetsMet}<button class="primary" onclick={chooseScenarios}
          >{p.chains.length ? 'Choose your scenarios' : 'Build your first chain'}
          <ArrowRight size={16} /></button
        >
      {:else}<button
          class="primary"
          onclick={() => {
            if (approve()) next();
          }}><Check size={16} /> Approve set & write scenarios</button
        >{/if}
    </div>
  </footer>{/if}

<style>
  .chain-include {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    font-size: 0.75rem;
    font-weight: 600;
    margin-bottom: 12px;
  }
  .chain-include input {
    width: 17px;
  }
</style>
