<script lang="ts">
  import { tick } from 'svelte';
  import {
    Plus,
    Check,
    CheckCircle2,
    Circle,
    ArrowRight,
    ArrowLeft,
    ChevronRight,
    Merge,
    Scissors,
    Trash2,
    AlertCircle,
    SlidersHorizontal,
    Sparkles,
    X
  } from '@lucide/svelte';
  import {
    editHypothesis,
    id,
    flagDownstream,
    snapshotChain,
    modelName,
    type Project,
    type Change
  } from '$lib/domain/project';
  import { approveHypotheses, hypothesisReview } from '$lib/domain/hypotheses';
  import MergeSuggestions from './MergeSuggestions.svelte';
  import Modal from './Modal.svelte';
  import StageActions from './StageActions.svelte';

  let {
    p,
    change,
    request,
    next
  }: {
    p: Project;
    change: Change;
    request: (task?: 'hypotheses' | 'consolidate', ids?: string[]) => void;
    next: () => void;
  } = $props();
  let activeId = $state('');
  let generateScope = $state('all');
  let attentionOnly = $state(false);
  let organising = $state(false);
  let selected = $state<string[]>([]);
  let editing = $state<{
    driverId: string;
    id?: string;
    sourceId?: string;
    mergeIds?: string[];
  } | null>(null);
  let title = $state('');
  let description = $state('');
  let panelHeading = $state<HTMLHeadingElement>();
  const review = $derived(hypothesisReview(p));
  const visibleGroups = $derived(attentionOnly ? review.attention : review.groups);
  const active = $derived(
    review.groups.find((g) => g.driver.id === activeId) ??
      review.missing[0] ??
      review.attention[0] ??
      review.groups[0]
  );
  const activeIndex = $derived(review.groups.findIndex((g) => g.driver.id === active?.driver.id));
  const selectedHypotheses = $derived(
    active?.hypotheses.filter((h) => selected.includes(h.id)) ?? []
  );
  const editingDriver = $derived(
    review.groups.find((g) => g.driver.id === editing?.driverId)?.driver
  );
  const contributingPerspectives = $derived(
    p.hypotheses
      .filter(
        (h) => h.id === (editing?.id ?? editing?.sourceId) || editing?.mergeIds?.includes(h.id)
      )
      .flatMap((h) => h.origins)
  );
  const mergeable = $derived(review.groups.some((g) => g.hypotheses.length > 1));

  // Retain the current uncertainty when adding or approving changes its status.
  $effect(() => {
    if (active && activeId !== active.driver.id) activeId = active.driver.id;
  });

  function filterAttention() {
    attentionOnly = true;
    if (active?.status === 'approved' && review.attention[0])
      void showUncertainty(review.attention[0].driver.id);
  }

  async function showUncertainty(driverId: string, focus = false) {
    activeId = driverId;
    selected = [];
    organising = false;
    if (focus) {
      await tick();
      panelHeading?.focus();
    }
  }
  function generate() {
    const ids =
      generateScope === 'current'
        ? [active!.driver.id]
        : generateScope === 'missing'
          ? review.missing.map((g) => g.driver.id)
          : undefined;
    request('hypotheses', ids);
  }
  function edit(hId: string) {
    const h = p.hypotheses.find((h) => h.id === hId)!;
    editing = { id: h.id, driverId: h.driverId };
    title = h.title;
    description = h.description;
  }
  function add(driverId: string) {
    editing = { driverId };
    title = '';
    description = '';
  }
  function save(approve = false) {
    if (!editing || !title.trim()) return;
    const draft = editing;
    change(
      (p) => {
        if (draft.id) {
          if (draft.mergeIds?.length) {
            const first = p.hypotheses.find((h) => h.id === draft.id)!;
            first.origins.push(
              ...p.hypotheses
                .filter((h) => draft.mergeIds!.includes(h.id))
                .flatMap((h) => h.origins)
            );
            archive(p, draft.mergeIds);
          }
          editHypothesis(p, draft.id, title.trim(), description.trim());
        } else {
          const source = p.hypotheses.find((h) => h.id === draft.sourceId);
          p.hypotheses.push({
            id: id('hypothesis'),
            driverId: draft.driverId,
            title: title.trim(),
            description: description.trim(),
            origins: source ? structuredClone(source.origins) : [],
            revision: 1,
            approved: approve,
            archived: false
          });
        }
        p.completed = p.completed.filter((s) => s !== 4);
      },
      draft.id
        ? 'Hypothesis saved. Review and approve this uncertainty again.'
        : approve
          ? 'Hypothesis added and approved.'
          : 'Hypothesis added. Review and approve it when ready.'
    );
    activeId = draft.driverId;
    editing = null;
    selected = [];
  }
  function archive(p: Project, hIds: string[]) {
    const affected = p.chains.filter((c) =>
      Object.values(c.items).some((h) => h !== null && hIds.includes(h))
    );
    affected.forEach((c) => snapshotChain(p, c));
    p.hypotheses
      .filter((h) => hIds.includes(h.id))
      .forEach((h) => {
        h.archived = true;
        h.approved = false;
      });
    affected.forEach((c) => c.revision++);
    p.completed = p.completed.filter((s) => s !== 4);
    flagDownstream(
      p,
      4,
      'Hypotheses removed. Existing combination references are retained for review.',
      affected.map((c) => c.id)
    );
  }
  function remove(hIds: string[]) {
    if (!hIds.length) return;
    change(
      (p) => archive(p, hIds),
      `${hIds.length} ${hIds.length === 1 ? 'hypothesis' : 'hypotheses'} removed. Use Undo exercise change to restore.`
    );
    selected = [];
  }
  function merge() {
    if (selectedHypotheses.length < 2) return;
    const first = selectedHypotheses[0];
    editing = {
      driverId: first.driverId,
      id: first.id,
      mergeIds: selectedHypotheses.slice(1).map((h) => h.id)
    };
    title = first.title;
    description = selectedHypotheses.map((h) => h.description).join('\n\n');
  }
  function split() {
    const h = selectedHypotheses[0];
    if (!h || selectedHypotheses.length !== 1) return;
    editing = { driverId: h.driverId, sourceId: h.id };
    title = `${h.title} — alternative`;
    description = h.description;
  }
  function finish() {
    if (!review.canComplete) return;
    change((p) => {
      approveHypotheses(p);
    }, 'All retained hypotheses approved. Ready to build scenario combinations.');
    next();
  }
</script>

<div class="stage-heading hypothesis-heading">
  <div>
    <h1 data-walkthrough="stage-heading">Develop hypotheses</h1>
    <p>
      How could each critical uncertainty unfold? Develop plausible alternatives for {p.horizon}.
      You’ll combine them into scenarios next.
    </p>
  </div>
</div>

<section class="hypothesis-brief" aria-label="How to complete this stage">
  <div>
    <h2>Cover every uncertainty, then approve your hypotheses.</h2>
    <p>
      Add at least one hypothesis for each uncertainty. Review the alternatives and remove any you
      don’t want to keep. <strong>Approval includes every hypothesis you keep.</strong>
    </p>
  </div>
  <details class="hypothesis-guidance">
    <summary>What makes a useful hypothesis?</summary>
    <div>
      <p>
        A hypothesis describes one possible future for one uncertainty. A scenario combines
        hypotheses across several uncertainties.
      </p>
      <p>
        For “Household energy”, alternatives might be “Bills remain volatile” and “Prices stabilise,
        but access is unequal”. Describe what changes and who could be affected.
      </p>
      <p>
        Keep the alternatives distinct and plausible. There’s no fixed number, and you don’t need to
        choose a single “most likely” future.
      </p>
    </div>
  </details>
</section>

<section
  class="hypothesis-coverage"
  data-walkthrough="hypothesis-coverage"
  class:has-gaps={review.missing.length > 0}
  aria-label="Hypothesis coverage"
>
  <div class="coverage-summary" role="status" aria-live="polite" aria-atomic="true">
    {#if review.missing.length}<AlertCircle size={21} aria-hidden="true" />{:else}<CheckCircle2
        size={21}
        aria-hidden="true"
      />{/if}
    <div>
      <strong
        >{review.groups.length - review.missing.length} of {review.groups.length} uncertainties have hypotheses</strong
      >
      <span
        >{#if review.missing.length}Fill the gaps below to unlock approval.{:else if review.pending}{review.pending}
          {review.pending === 1 ? 'hypothesis needs' : 'hypotheses need'} approval. Review your set, then
          approve and continue.{:else}All {review.total} hypotheses are approved. You can continue to
          build scenario combinations.{/if}</span
      >
    </div>
  </div>
  {#if review.missing.length}
    <div class="coverage-gaps">
      <span>Missing hypotheses:</span>
      {#each review.missing as g (g.driver.id)}
        <button onclick={() => showUncertainty(g.driver.id, true)}
          >{g.driver.title}<ArrowRight size={14} /></button
        >
      {/each}
    </div>
  {/if}
</section>

<StageActions
  generate={{
    label: 'Generate hypotheses',
    onclick: generate,
    disabled: !active || (generateScope === 'missing' && !review.missing.length)
  }}
  merge={{ label: 'Suggest merges', disabled: !mergeable, onclick: () => request('consolidate') }}
  add={{ label: 'Add hypothesis', disabled: !active, onclick: () => add(active!.driver.id) }}
>
  {#snippet context()}<label class="action-scope"
      >Generate for<select aria-label="Hypothesis generation scope" bind:value={generateScope}
        ><option value="all">All uncertainties</option><option value="current"
          >Current uncertainty: {active?.driver.title ?? 'None'}</option
        ><option value="missing" disabled={!review.missing.length}
          >Missing hypotheses ({review.missing.length})</option
        ></select
      ></label
    >{/snippet}
</StageActions>
<MergeSuggestions {p} {change} kind="hypothesis" />

<div class="hypothesis-workspace">
  <aside class="uncertainty-index" aria-label="Critical uncertainties">
    <div class="uncertainty-index-heading">
      <h2 data-walkthrough="hypothesis-index">Critical uncertainties</h2>
      <span>{review.groups.length}</span>
    </div>
    <div class="uncertainty-filter" aria-label="Filter uncertainties">
      <button
        class:active={!attentionOnly}
        aria-pressed={!attentionOnly}
        onclick={() => (attentionOnly = false)}>All</button
      >
      <button class:active={attentionOnly} aria-pressed={attentionOnly} onclick={filterAttention}
        >Needs attention <span>{review.attention.length}</span></button
      >
    </div>
    <nav aria-label="Choose an uncertainty">
      {#each visibleGroups as g (g.driver.id)}
        <button
          class="uncertainty-link"
          class:current={active?.driver.id === g.driver.id}
          class:missing={g.status === 'missing'}
          aria-current={active?.driver.id === g.driver.id ? 'true' : undefined}
          onclick={() => showUncertainty(g.driver.id, true)}
        >
          <span
            class="uncertainty-state"
            class:approved={g.status === 'approved'}
            aria-hidden="true"
          >
            {#if g.status === 'missing'}<AlertCircle
                size={18}
              />{:else if g.status === 'approved'}<CheckCircle2 size={18} />{:else}<Circle
                size={18}
              />{/if}
          </span>
          <span class="uncertainty-link-text"
            ><strong>{g.driver.title}</strong><small
              >{#if g.status === 'missing'}No hypotheses yet{:else}{g.hypotheses.length}
                {g.hypotheses.length === 1 ? 'hypothesis' : 'hypotheses'}<span
                  >{g.status === 'approved' ? 'Approved' : `${g.pending} to approve`}</span
                >{/if}</small
            ></span
          >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      {/each}
    </nav>
    {#if !visibleGroups.length}
      <p class="small muted index-empty">Every uncertainty is approved.</p>
      <button class="text-button" onclick={() => (attentionOnly = false)}
        >Show all uncertainties</button
      >
    {/if}
    <p class="index-help">
      Each uncertainty needs its own alternatives. You’ll use these to build contrasting scenarios.
    </p>
  </aside>

  {#if active}
    <section class="uncertainty-review" aria-labelledby="uncertainty-heading">
      <header class="uncertainty-review-heading">
        <div class="uncertainty-position">
          Uncertainty {activeIndex + 1} of {review.groups.length}
        </div>
        <div class="section-line">
          <h2 id="uncertainty-heading" tabindex="-1" bind:this={panelHeading}>
            {active.driver.title}
          </h2>
          <span
            class="hypothesis-status"
            class:approved={active.status === 'approved'}
            class:missing={active.status === 'missing'}
            >{#if active.status === 'approved'}<Check size={14} /> Approved{:else if active.status === 'missing'}<AlertCircle
                size={14}
              /> Hypotheses missing{:else}Review needed{/if}</span
          >
        </div>
        <p>{active.driver.summary}</p>
        <div class="section-line">
          {#if active.hypotheses.length}
            <button
              class="text-button"
              aria-pressed={organising}
              onclick={() => {
                organising = !organising;
                selected = [];
              }}
              ><SlidersHorizontal size={15} />{organising
                ? 'Done organising'
                : 'Organise hypotheses'}</button
            >
          {/if}
        </div>
      </header>

      {#if !active.hypotheses.length}
        <div class="hypothesis-empty">
          <button
            type="button"
            class="empty-branch"
            aria-label={`Add hypothesis for ${active.driver.title}`}
            title="Add hypothesis"
            onclick={() => add(active.driver.id)}><Plus size={25} aria-hidden="true" /></button
          >
          <h3>What could change for {active.driver.title.toLowerCase()}?</h3>
          <p>
            Add a possible future for this uncertainty, or use AI to suggest alternatives. At least
            one hypothesis is needed to complete this stage.
          </p>
          <p class="small muted">
            Click + to write your own, or Generate hypotheses for AI suggestions.
          </p>
        </div>
      {:else}
        {#if active.hypotheses.length === 1}
          <p class="hypothesis-advice">
            <Sparkles size={17} aria-hidden="true" /><span
              >One possible future so far. Consider adding a contrasting alternative. You can still
              continue with one.</span
            >
          </p>
        {/if}
        {#if organising}
          <div class="hypothesis-organise">
            <div>
              <strong>Organise this uncertainty’s hypotheses</strong>
              <p>Select only to merge, split or remove. Selection does not affect approval.</p>
            </div>
            <div class="organise-actions">
              <span class="small">{selectedHypotheses.length} selected</span>
              <button class="secondary" disabled={selectedHypotheses.length < 2} onclick={merge}
                ><Merge size={15} /> Merge</button
              >
              <button class="secondary" disabled={selectedHypotheses.length !== 1} onclick={split}
                ><Scissors size={15} /> Split</button
              >
              <button
                class="secondary danger-text"
                disabled={!selectedHypotheses.length}
                onclick={() => remove(selectedHypotheses.map((h) => h.id))}
                ><Trash2 size={15} /> Remove</button
              >
              <button
                class="icon-button"
                aria-label="Close organise mode"
                onclick={() => {
                  organising = false;
                  selected = [];
                }}><X size={17} /></button
              >
            </div>
            {#if selectedHypotheses.length > 1}<p class="small muted">
                Merge opens a combined draft for review. Nothing changes until you save it.
              </p>{/if}
            {#if selectedHypotheses.length === 1}<p class="small muted">
                Split starts a new alternative for you to edit. The original is kept.
              </p>{/if}
          </div>
        {/if}
        <div class="future-state-grid">
          {#each active.hypotheses as h (h.id)}
            <article class="future-state" class:selected={organising && selected.includes(h.id)}>
              <div class="future-state-heading">
                {#if organising}<input
                    type="checkbox"
                    aria-label={`Select ${h.title} to organise`}
                    checked={selected.includes(h.id)}
                    onchange={(e) =>
                      (selected = e.currentTarget.checked
                        ? [...selected, h.id]
                        : selected.filter((v) => v !== h.id))}
                  />{/if}
                <h3>{h.title}</h3>
              </div>
              {#if h.description}<p class="future-state-description">{h.description}</p>{:else}<p
                  class="future-state-description muted"
                >
                  No description yet. Add detail to explain what changes in this future.
                </p>{/if}
              <div class="future-state-footer">
                <span class="small" class:approved-text={h.approved}
                  >{#if h.approved}<Check size={14} /> Approved{:else}<Circle size={12} /> To approve{/if}</span
                ><button
                  class="text-button"
                  aria-label={`Edit ${h.title}`}
                  onclick={() => edit(h.id)}>Edit</button
                >
              </div>
              {#if h.origins.length}
                <details class="hypothesis-sources">
                  <summary
                    >{p.example && h.origins.every((o) => o.modelId.startsWith('authored/'))
                      ? 'Illustrative contribution'
                      : `Contributions (${new Set(h.origins.map((o) => o.modelId)).size})`}</summary
                  >{#each h.origins as o}<p>
                      <strong>{modelName(o.modelId)}</strong><br />{o.text}
                    </p>{/each}
                </details>
              {:else}<span class="hypothesis-author small muted">Added by you</span>{/if}
            </article>
          {/each}
        </div>
        <div class="uncertainty-review-actions">
          <p>
            {#if active.status === 'approved'}All hypotheses for this uncertainty are approved.{:else}Keep
              all the alternatives you want available when building scenario combinations.{/if}
          </p>
          {#if active.pending}<button
              class="secondary"
              onclick={() =>
                change((p) => {
                  approveHypotheses(p, active.driver.id);
                }, `All hypotheses for “${active.driver.title}” approved.`)}
              ><Check size={16} />
              {active.hypotheses.length === 1
                ? 'Approve this hypothesis'
                : `Approve these ${active.hypotheses.length} hypotheses`}</button
            >{/if}
        </div>
      {/if}
      <nav class="uncertainty-pagination" aria-label="Review uncertainties">
        <button
          class="text-button"
          disabled={activeIndex === 0}
          onclick={() => showUncertainty(review.groups[activeIndex - 1].driver.id, true)}
          ><ArrowLeft size={16} /> Previous</button
        >
        {#if activeIndex < review.groups.length - 1}<button
            class="text-button"
            onclick={() => showUncertainty(review.groups[activeIndex + 1].driver.id, true)}
            >Next uncertainty <ArrowRight size={16} /></button
          >{:else if review.attention.some((g) => g.driver.id !== active.driver.id)}<button
            class="text-button"
            onclick={() =>
              showUncertainty(
                review.attention.find((g) => g.driver.id !== active.driver.id)!.driver.id,
                true
              )}>Next needing attention <ArrowRight size={16} /></button
          >{:else}<span class="small muted">Last uncertainty</span>{/if}
      </nav>
    </section>
  {/if}
</div>

<footer class="hypothesis-completion" data-walkthrough="stage-complete">
  <div aria-live="polite" aria-atomic="true">
    {#if review.missing.length}<strong
        >{review.missing.length}
        {review.missing.length === 1 ? 'uncertainty still needs' : 'uncertainties still need'} hypotheses</strong
      ><small>Add at least one for each before approving your set.</small>
    {:else if review.pending}<strong>Ready to approve your hypotheses?</strong><small
        >Approve all {review.total} retained hypotheses across {review.groups.length} uncertainties and
        move to Build scenario combinations.</small
      >
    {:else}<strong>Your hypotheses are approved</strong><small
        >Next, combine the alternatives into contrasting scenario combinations.</small
      >{/if}
  </div>
  {#if review.missing.length}<button
      class="primary"
      onclick={() => showUncertainty(review.missing[0].driver.id, true)}
      >Go to missing hypotheses <ArrowRight size={16} /></button
    >
  {:else}<button class="primary" disabled={!review.canComplete} onclick={finish}
      >{#if review.pending}<Check size={16} /> Approve all & build scenario combinations{:else}Build
        scenario combinations <ArrowRight size={16} />{/if}</button
    >{/if}
</footer>

{#if editing}
  <Modal
    title={editing.mergeIds?.length
      ? 'Merge hypotheses'
      : editing.id
        ? 'Edit hypothesis'
        : editing.sourceId
          ? 'Split into a new hypothesis'
          : 'Add a hypothesis'}
    close={() => (editing = null)}
  >
    <form
      class="editor-form"
      onsubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <p class="hypothesis-editor-context">
        A possible future for <strong>{editingDriver?.title}</strong><br /><span class="small muted"
          >Time horizon: {p.horizon}</span
        >
      </p>
      {#if editing.mergeIds?.length}<p class="small">
          Saving keeps this combined hypothesis and removes {editing.mergeIds.length}
          {editing.mergeIds.length === 1 ? 'other hypothesis' : 'other hypotheses'} from this uncertainty.
          Original contributions are preserved. You can undo the merge.
        </p>{/if}
      {#if !editing.id && !editing.sourceId}<label
          >Critical uncertainty<select bind:value={editing.driverId}
            >{#each review.groups as g}<option value={g.driver.id}>{g.driver.title}</option
              >{/each}</select
          ></label
        >{/if}
      <label
        >Short title<input
          bind:value={title}
          required
          placeholder="Describe the future in a few words"
        /></label
      >
      <label
        >What would this future look like?<textarea
          rows="5"
          bind:value={description}
          placeholder="What changes? Who is affected? What makes this different from the other alternatives?"
        ></textarea><small class="muted"
          >Describe a plausible future, rather than a prediction or a recommended action.</small
        ></label
      >
      {#if contributingPerspectives.length}<details>
          <summary class="small">Original contributions ({contributingPerspectives.length})</summary
          >{#each contributingPerspectives as o}<p class="small">
              <strong>{modelName(o.modelId)}</strong><br />{o.text}
            </p>{/each}
        </details>{/if}
      {#if editing.id}<p class="small muted">
          Saving requires approval again. Combinations and narratives that use this hypothesis will
          be flagged for review.
        </p>{:else if editing.sourceId}<p class="small muted">
          Edit this copy into a distinct alternative. The original hypothesis is kept.
        </p>{/if}
      <div class="dialog-actions">
        <button type="button" class="secondary" onclick={() => (editing = null)}>Cancel</button
        >{#if !editing.id && !editing.sourceId}<button
            type="button"
            class="secondary"
            disabled={!title.trim()}
            onclick={() => save(true)}>Add and approve</button
          >{/if}<button type="submit" class="primary" disabled={!title.trim()}
          >{editing.mergeIds?.length
            ? 'Save merged hypothesis'
            : editing.id
              ? 'Save hypothesis'
              : 'Add hypothesis'}</button
        >
      </div>
    </form>
  </Modal>
{/if}

<style>
  .hypothesis-heading {
    margin-bottom: 24px;
  }
  .hypothesis-brief {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(230px, 0.45fr);
    gap: 24px;
    margin-bottom: 24px;
  }
  .hypothesis-brief h2 {
    font-size: 1.125rem;
    margin-bottom: 8px;
  }
  .hypothesis-brief p {
    color: var(--cg-text-muted);
    margin-bottom: 0;
  }
  .hypothesis-brief strong {
    color: var(--cg-text);
    font-weight: 600;
  }
  .hypothesis-guidance {
    align-self: start;
    font-size: 0.8125rem;
  }
  .hypothesis-guidance summary {
    cursor: pointer;
    padding: 10px 0;
    color: var(--cg-action);
    font-weight: 700;
  }
  .hypothesis-guidance > div {
    padding-top: 6px;
  }
  .hypothesis-guidance p + p {
    margin-top: 12px;
  }
  .hypothesis-coverage {
    border: 1px solid var(--cg-border);
    border-left: 4px solid var(--cg-action);
    background: var(--cg-paper);
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 20px;
  }
  .hypothesis-coverage.has-gaps {
    border-left-color: var(--cg-status-review-text);
  }
  .coverage-summary {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    color: var(--cg-action);
  }
  .has-gaps .coverage-summary {
    color: var(--cg-status-review-text);
  }
  .coverage-summary > :global(svg) {
    flex-shrink: 0;
    margin-top: 2px;
  }
  .coverage-summary strong {
    display: block;
    font-size: 1rem;
    color: var(--cg-text);
  }
  .coverage-summary span {
    display: block;
    color: var(--cg-text-muted);
    font-size: 0.8125rem;
    margin-top: 3px;
  }
  .coverage-gaps {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 12px;
    margin: 12px 0 0 33px;
    font-size: 0.8125rem;
  }
  .coverage-gaps > span {
    color: var(--cg-text-muted);
  }
  .coverage-gaps button {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    background: var(--cg-status-review-bg);
    color: var(--cg-status-review-text);
    padding: 6px 10px;
    font-weight: 700;
  }
  .hypothesis-workspace {
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr);
    gap: 28px;
    align-items: start;
    padding-bottom: 24px;
  }
  .uncertainty-index {
    position: sticky;
    top: calc(var(--workspace-topbar-height, 72px) + var(--stage-actions-height, 0px) + 20px);
    max-height: calc(
      100dvh - var(--workspace-topbar-height, 72px) - var(--stage-actions-height, 0px) - 140px
    );
    overflow-y: auto;
    padding: 0 3px 8px;
    scroll-padding: 6px;
  }
  .uncertainty-index-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }
  .uncertainty-index h2 {
    font-size: 0.9375rem;
    margin-bottom: 0;
  }
  .uncertainty-index-heading > span {
    color: var(--cg-text-muted);
    font-size: 0.8125rem;
  }
  .uncertainty-filter {
    display: flex;
    gap: 4px;
    padding: 3px;
    border: 1px solid var(--cg-border);
    border-radius: 8px;
    margin-bottom: 12px;
  }
  .uncertainty-filter button {
    font-size: 0.75rem;
    padding: 7px 8px;
    flex: 1;
    white-space: nowrap;
  }
  .uncertainty-filter button.active {
    background: var(--cg-selection);
    color: var(--cg-action);
    font-weight: 700;
  }
  .uncertainty-filter span {
    margin-left: 3px;
  }
  .uncertainty-index nav {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .uncertainty-link {
    width: 100%;
    display: flex;
    gap: 10px;
    align-items: flex-start;
    text-align: left;
    padding: 13px 10px;
    border: 1px solid transparent;
    border-radius: 8px;
  }
  .uncertainty-link:hover {
    background: var(--cg-selection);
  }
  .uncertainty-link.current {
    background: var(--cg-paper);
    border-color: var(--cg-selection-border);
    box-shadow: inset 3px 0 0 var(--cg-selection-border);
  }
  .uncertainty-link.missing {
    background: var(--cg-status-review-bg);
  }
  .uncertainty-state {
    color: var(--cg-text-muted);
    display: flex;
    margin-top: 2px;
  }
  .uncertainty-link.missing .uncertainty-state {
    color: var(--cg-status-review-text);
  }
  .uncertainty-state.approved {
    color: var(--cg-action);
  }
  .uncertainty-link-text {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .uncertainty-link-text strong {
    font-weight: 700;
    font-size: 0.875rem;
  }
  .uncertainty-link-text small {
    display: block;
    font-size: 0.75rem;
    color: var(--cg-text-muted);
    margin-top: 3px;
  }
  .uncertainty-link-text small span {
    display: block;
  }
  .uncertainty-link > :global(svg) {
    flex-shrink: 0;
    margin-top: 4px;
    opacity: 0;
  }
  .uncertainty-link.current > :global(svg) {
    opacity: 1;
  }
  .index-help,
  .index-empty {
    font-size: 0.75rem;
    color: var(--cg-text-muted);
    padding: 14px 10px 0;
    margin: 8px 0 0;
  }
  .index-help {
    border-top: 1px solid var(--cg-border);
  }
  .uncertainty-review {
    min-width: 0;
  }
  .uncertainty-review-heading {
    border-bottom: 1px solid var(--cg-border);
    padding: 0 0 20px;
  }
  .uncertainty-position {
    color: var(--cg-text-muted);
    font-size: 0.75rem;
    margin-bottom: 8px;
  }
  .uncertainty-review-heading h2 {
    font-size: 1.5rem;
    scroll-margin-top: calc(
      var(--workspace-topbar-height, 72px) + var(--stage-actions-height, 0px) + 20px
    );
  }
  .uncertainty-review-heading > p {
    color: var(--cg-text-muted);
    margin: 10px 0 16px;
    font-size: 0.875rem;
  }
  .uncertainty-review-heading .section-line {
    gap: 12px;
  }
  .hypothesis-status {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    background: var(--cg-status-neutral-bg);
    color: var(--cg-status-neutral-text);
    border-radius: 5px;
    font-size: 0.75rem;
    white-space: nowrap;
  }
  .hypothesis-status.approved {
    background: var(--cg-status-approved-bg);
    color: var(--cg-status-approved-text);
  }
  .hypothesis-status.missing {
    background: var(--cg-status-review-bg);
    color: var(--cg-status-review-text);
  }
  .hypothesis-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 44px 28px;
    background: var(--cg-paper);
    border: 1px dashed var(--cg-control-border);
    border-radius: 8px;
    margin-top: 20px;
  }
  .empty-branch {
    display: flex;
    padding: 12px;
    color: var(--cg-action);
    background: var(--cg-selection);
    border-radius: 50%;
    margin-bottom: 16px;
  }
  .hypothesis-empty h3 {
    font-size: 1.125rem;
  }
  .hypothesis-empty p {
    color: var(--cg-text-muted);
    max-width: 48ch;
    margin: 4px 0 20px;
  }
  .hypothesis-advice {
    display: flex;
    gap: 9px;
    align-items: flex-start;
    font-size: 0.8125rem;
    color: var(--cg-status-info-text);
    background: var(--cg-status-info-bg);
    padding: 12px 14px;
    border-radius: 6px;
    margin: 20px 0 0;
  }
  .hypothesis-advice :global(svg) {
    flex-shrink: 0;
    margin-top: 2px;
  }
  .hypothesis-organise {
    border: 1px solid var(--cg-control-border);
    background: var(--cg-selection);
    border-radius: 8px;
    padding: 14px;
    margin-top: 20px;
  }
  .hypothesis-organise p {
    font-size: 0.8125rem;
    margin: 4px 0 0;
  }
  .organise-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
    margin-top: 12px;
  }
  .organise-actions > span {
    margin-right: auto;
  }
  .organise-actions .secondary {
    padding: 7px 10px;
    min-height: 34px;
    font-size: 0.8125rem;
  }
  .future-state-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
    gap: 14px;
    margin-top: 20px;
  }
  .future-state {
    display: flex;
    flex-direction: column;
    background: var(--cg-paper);
    border: 1px solid var(--cg-border);
    border-radius: 8px;
    padding: 18px;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .future-state.selected {
    border-color: var(--cg-selection-border);
    box-shadow: inset 0 0 0 1px var(--cg-selection-border);
  }
  .future-state-heading {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .future-state-heading h3 {
    margin: 0;
    font-size: 1rem;
  }
  .future-state-heading input {
    margin-top: 3px;
  }
  .future-state-description {
    color: var(--cg-text-muted);
    font-size: 0.875rem;
    line-height: 1.7;
    margin: 12px 0 16px;
  }
  .future-state-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: auto;
  }
  .future-state-footer > span {
    display: flex;
    align-items: center;
    gap: 5px;
    color: var(--cg-text-muted);
    font-size: 0.75rem;
  }
  .future-state-footer > .approved-text {
    color: var(--cg-status-approved-text);
  }
  .hypothesis-sources,
  .hypothesis-author {
    border-top: 1px solid var(--cg-border);
    margin-top: 12px;
    padding-top: 10px;
    font-size: 0.75rem;
    color: var(--cg-text-muted);
  }
  .hypothesis-sources summary {
    cursor: pointer;
  }
  .hypothesis-sources p {
    margin: 10px 0 0;
  }
  .uncertainty-review-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 18px;
  }
  .uncertainty-review-actions p {
    font-size: 0.8125rem;
    color: var(--cg-text-muted);
    margin: 0;
    flex: 1;
    min-width: 200px;
  }
  .uncertainty-review-actions button {
    font-size: 0.8125rem;
  }
  .uncertainty-pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-top: 24px;
    padding-top: 14px;
    border-top: 1px solid var(--cg-border);
  }
  .hypothesis-completion {
    position: sticky;
    bottom: 0;
    z-index: 12;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    background: var(--cg-paper);
    border-top: 1px solid var(--cg-control-border);
    margin: 0 calc(-1 * var(--cg-work-padding));
    padding: 18px var(--cg-work-padding);
    box-shadow: 0 -5px 20px light-dark(rgb(23 41 30 / 4%), rgb(0 0 0 / 12%));
  }
  .hypothesis-completion strong {
    display: block;
    font-weight: 700;
    font-size: 0.875rem;
  }
  .hypothesis-completion small {
    display: block;
    color: var(--cg-text-muted);
    max-width: 62ch;
    font-size: 0.75rem;
    margin-top: 4px;
  }
  .hypothesis-completion > button {
    flex-shrink: 0;
  }
  .hypothesis-editor-context {
    margin: 0;
  }
  @media (max-width: 1250px) {
    .hypothesis-workspace {
      grid-template-columns: 210px minmax(0, 1fr);
      gap: 20px;
    }
    .uncertainty-filter button {
      padding: 7px 4px;
    }
    .hypothesis-brief {
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .hypothesis-completion {
      flex-wrap: wrap;
    }
  }
  @media (max-width: 800px) {
    .hypothesis-workspace {
      grid-template-columns: minmax(0, 1fr);
    }
    .uncertainty-index {
      position: static;
      max-height: none;
      overflow: visible;
    }
    .uncertainty-index nav {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
    }
    .index-help {
      display: none;
    }
    .uncertainty-link {
      height: 100%;
    }
    .uncertainty-filter {
      max-width: 320px;
    }
    .hypothesis-completion {
      gap: 12px;
      padding-block: 14px;
    }
    .hypothesis-completion > button {
      width: 100%;
      justify-content: center;
    }
  }
  @media (max-width: 480px) {
    .coverage-gaps {
      margin-left: 0;
    }
    .hypothesis-empty {
      padding: 30px 18px;
    }
    .uncertainty-review-heading h2 {
      font-size: 1.25rem;
    }
    .hypothesis-completion small {
      max-width: 48ch;
    }
  }
  @media print {
    .hypothesis-completion {
      display: none;
    }
    .uncertainty-index {
      position: static;
      max-height: none;
    }
  }
</style>
