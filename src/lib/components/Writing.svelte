<script lang="ts">
  import { onMount } from 'svelte';
  import { ArrowRight, Check, RotateCcw, Undo2, Redo2 } from '@lucide/svelte';
  import {
    complete,
    now,
    uncertainties,
    modelName,
    allNarrativesWritten,
    canWriteNarrative,
    editNarrative,
    undoNarrative,
    prepareNarrativeReview,
    proposalIsCurrent,
    applyNarrativeProposal,
    type Project,
    type Change
  } from '$lib/domain/project';
  let {
    p,
    change,
    request,
    review = false,
    busy = false,
    next
  }: {
    p: Project;
    change: Change;
    request: (task: 'narrative' | 'narrative_edit', chainId: string, instructions?: string) => void;
    review?: boolean;
    busy?: boolean;
    next: () => void;
  } = $props();
  let selectedId = $state('');
  let mode = $state('rich');
  let annotations = $state(false);
  let snapshot = $state('');
  let restoring = $state(false);
  let instructions = $state<Record<string, string>>({});
  let RichEditor = $state<typeof import('./Editor.svelte').default>();
  onMount(() => {
    void import('./Editor.svelte').then((module) => (RichEditor = module.default));
  });
  const chains = $derived(p.chains.filter((c) => c.selected));
  const chain = $derived(chains.find((c) => c.id === selectedId) ?? chains[0]);
  const narrative = $derived(p.narratives.find((n) => n.chainId === chain?.id));
  const editable = $derived(chain ? canWriteNarrative(p, chain.id) : false);
  const proposals = $derived(
    narrative?.drafts.filter(
      (d) => d.id !== narrative.chosenId && d.status !== 'accepted' && d.status !== 'dismissed'
    ) ?? []
  );
  const allWritten = $derived(allNarrativesWritten(p));
  const allFinal = $derived(
    p.completed.includes(7) &&
      allWritten &&
      chains.every((c) =>
        p.narratives.some((n) => n.chainId === c.id && n.final !== null && n.final === n.working)
      )
  );
  const checks = [
    'Causal coherence',
    'Plausibility within the horizon',
    'Distinctiveness across scenarios',
    'Breadth of perspectives',
    'Humanitarian relevance',
    'Traceability to hypotheses',
    'Clear, accessible prose'
  ];
  function edit(text: string) {
    if (!chain || text === (narrative?.working ?? '')) return;
    change((p) => editNarrative(p, chain.id, text));
  }
</script>

<div class="stage-heading">
  <div>
    <h1>{review ? 'Make these stories your own.' : 'Write your scenario in your own words.'}</h1>
    <p>
      {review
        ? 'Review your narratives and save the final scenario set when you are ready.'
        : 'Start with your own account of how this future could unfold. AI help is optional.'}
    </p>
  </div>
</div>
<div class="toolbar">
  <span class="muted"
    >{chains.length} selected {chains.length === 1 ? 'scenario' : 'scenarios'}</span
  >
</div>
<div class="scenario-tabs" aria-label="Narratives">
  {#each chains as c}<button
      class:active={chain?.id === c.id}
      class="scenario-tab scenario-{c.colour}"
      onclick={() => {
        selectedId = c.id;
        snapshot = '';
        restoring = false;
      }}
      ><strong>{c.title}</strong><span class="small"
        >{c.kind === 'wildcard' ? 'Wildcard · ' : ''}{p.narratives
          .find((n) => n.chainId === c.id)
          ?.working.trim()
          ? '✓ Draft written'
          : '○ Not started'}</span
      ></button
    >{/each}
</div>
{#if chain}
  {#if chain.review || narrative?.review}<p class="notice review">
      Review suggested: the chain or an upstream hypothesis changed. Your narrative and original
      snapshots are preserved.
    </p>{/if}
  {#if chain.approvedRevision !== chain.revision}<p class="notice review">
      Approve this chain’s current revision in Construct chains before starting a new draft or
      requesting AI help. You can keep editing an existing narrative.
    </p>{/if}
  {#if uncertainties(p).some((d) => !chain.items[d.id])}<p class="notice review">
      Intentionally unresolved: {uncertainties(p)
        .filter((d) => !chain.items[d.id])
        .map((d) => d.title)
        .join(', ')}. Preserve these open questions in the narrative.
    </p>{/if}
  <div class="writing-layout">
    <section class="narrative-paper">
      <div class="narrative-title">
        <h2>{chain.title}</h2>
        <span class="small muted"
          >{narrative?.working.trim() ? narrative.working.trim().split(/\s+/).length : 0} words</span
        >
      </div>
      <div class="writing-controls">
        <div class="segmented">
          <button class:active={mode === 'rich'} onclick={() => (mode = 'rich')}>Rich text</button>
          <button class:active={mode === 'markdown'} onclick={() => (mode = 'markdown')}
            >Markdown</button
          >
        </div>
        <div class="toolbar-group">
          <button
            class="icon-button"
            aria-label="Undo text edit"
            disabled={!narrative?.history.length}
            onclick={() => change((p) => undoNarrative(p, chain.id))}><Undo2 size={17} /></button
          >
          <button
            class="icon-button"
            aria-label="Redo text edit"
            disabled={!narrative?.redo.length}
            onclick={() => change((p) => undoNarrative(p, chain.id, true))}
            ><Redo2 size={17} /></button
          >
        </div>
      </div>
      {#key chain.id}{#if mode === 'rich' && RichEditor}<RichEditor
            value={narrative?.working ?? ''}
            onedit={edit}
            {editable}
          />{:else}<textarea
            class="markdown-editor"
            aria-label="Scenario narrative in Markdown"
            value={narrative?.working ?? ''}
            disabled={!editable}
            placeholder="Describe this future, how it unfolds and what it means for people."
            oninput={(e) => edit(e.currentTarget.value)}
            rows="22"></textarea>{/if}{/key}
      <div class="narrative-meta">
        <span
          >{narrative?.original
            ? `Original: ${narrative.original.source === 'user' ? 'Your writing' : narrative.original.source === 'example' ? 'Authored example' : modelName(narrative.original.modelId ?? '')} · chain revision ${narrative.original.chainRevision}`
            : 'Your working draft · saved as you write'}</span
        >
        <span
          >{narrative?.final !== null &&
          narrative?.final !== undefined &&
          narrative.final === narrative.working
            ? '✓ Final snapshot saved'
            : 'Working draft'}</span
        >
      </div>
    </section>
    <aside class="writing-aside">
      <h2>Your hypothesis chain</h2>
      <p class="small muted">
        Describe the future, its causal pathway and humanitarian implications. Around 400–600 words
        is a guide, not a limit.
      </p>
      <div class="annotation-list">
        {#each uncertainties(p) as d}<p class="small">
            <strong>{d.title}</strong><br />{p.hypotheses.find((h) => h.id === chain.items[d.id])
              ?.title ?? 'Unresolved'}
          </p>{/each}
        {#each chain.wildcardDriverIds as driverId}{@const driver = p.drivers.find(
            (d) => d.id === driverId
          )}
          {#if driver}<p class="small">
              <strong>{driver.title}</strong><br />{driver.summary}
            </p>{/if}
        {/each}
      </div>
      {#if review && narrative}
        <hr />
        <h2>Your review</h2>
        <p class="small muted">
          This checklist is advisory. You can complete with every box unchecked.
        </p>
        {#each checks as check}<label class="check-label qa-check"
            ><input
              type="checkbox"
              checked={narrative.checklist.includes(check)}
              onchange={(e) => {
                const checked = e.currentTarget.checked;
                change((p) => {
                  const n = p.narratives.find((n) => n.chainId === chain.id)!;
                  n.checklist = checked
                    ? [...n.checklist, check]
                    : n.checklist.filter((c) => c !== check);
                });
              }}
            />{check}</label
          >{/each}
      {/if}
      <hr />
      <label class="check-label"
        ><input type="checkbox" bind:checked={annotations} /> Show annotation details</label
      >
      {#if annotations}<p class="small muted">
          Hypotheses and assumptions, not historical citations.
        </p>
        {#if narrative?.annotationsDetached}<p class="notice review small">
            Text changed. Chain annotations are contextual and are not attached to particular
            sentences.
          </p>{/if}
      {/if}
      {#if narrative?.original || (narrative?.final !== null && narrative?.final !== undefined)}
        <hr />
        <label
          >Compare snapshot<select bind:value={snapshot}>
            <option value="">Current working draft</option>
            {#if narrative?.original}<option value="original">Original draft</option>{/if}
            {#if narrative?.final !== null && narrative?.final !== undefined}<option value="final"
                >Final approved snapshot</option
              >{/if}
          </select></label
        >
        {#if snapshot}<div class="snapshot-text">
            {snapshot === 'original' ? narrative?.original?.text : narrative?.final}
          </div>
          {#if !restoring}<button class="secondary" onclick={() => (restoring = true)}
              ><RotateCcw size={15} /> Restore this snapshot</button
            >
          {:else}<p class="small">
              The current text will remain available through Undo. Restore this snapshot?
            </p>
            <div class="toolbar-group">
              <button
                class="primary"
                onclick={() => {
                  edit(
                    (snapshot === 'original' ? narrative?.original?.text : narrative?.final) ?? ''
                  );
                  restoring = false;
                  snapshot = '';
                }}>Restore</button
              ><button class="text-button" onclick={() => (restoring = false)}>Cancel</button>
            </div>
          {/if}
        {/if}
      {/if}
    </aside>
  </div>
  {#key chain.id}<details class="ai-help">
      <summary>AI help</summary>
      <p class="small muted">
        Your writing comes first. Ask for an edit or, if you prefer, request a generated starting
        draft. You review every proposal before applying it.
      </p>
      <label class="inline-label"
        >Model<select
          value={p.writer}
          onchange={(e) => {
            const value = e.currentTarget.value;
            change((p) => (p.writer = value));
          }}
          >{#each p.models as model}<option value={model}>{modelName(model)}</option>{/each}</select
        ></label
      >
      <label class="spaced"
        >Editing instructions (optional)<textarea
          rows="2"
          value={instructions[chain.id] ?? ''}
          placeholder="For example, make the causal pathway clearer while keeping my voice."
          oninput={(e) => (instructions[chain.id] = e.currentTarget.value)}></textarea></label
      >
      <div class="toolbar-group">
        <button
          class="primary"
          disabled={busy || !narrative?.working.trim() || chain.approvedRevision !== chain.revision}
          onclick={() => request('narrative_edit', chain.id, instructions[chain.id])}
          >Ask AI to edit this draft</button
        >
        <button
          class="secondary"
          disabled={busy || chain.approvedRevision !== chain.revision}
          onclick={() => request('narrative', chain.id)}>Generate a draft with AI</button
        >
      </div>
    </details>{/key}
  {#if proposals.length}<section class="narrative-proposals" aria-label="AI proposals">
      <h2>Review proposed drafts</h2>
      <p class="small muted">Your working text stays in the editor until you apply a proposal.</p>
      {#each proposals as d}{@const current = proposalIsCurrent(p, chain.id, d.id)}
        <article class="draft-paper">
          <div class="section-line">
            <h3>
              {d.modelId === 'authored/example'
                ? 'Authored example draft'
                : d.kind === 'edit'
                  ? 'Proposed edit'
                  : 'Generated draft'}
            </h3>
            <span class="small muted"
              >{modelName(d.modelId)} · chain revision {d.chainRevision}</span
            >
          </div>
          {#if d.instructions}<p class="small">
              <strong>Editing request:</strong>
              {d.instructions}
            </p>{/if}
          <div class="draft-comparison">
            <div>
              <h4>Current working text</h4>
              <div class="draft-prose">{narrative?.working || 'No text yet.'}</div>
            </div>
            <div>
              <h4>Proposed text</h4>
              <div class="draft-prose">{d.text}</div>
            </div>
          </div>
          {#if !current}<p class="notice review small">
              Your text or chain has changed since this proposal. Request a fresh proposal to apply
              AI changes to your current draft.
            </p>{/if}
          <div class="toolbar-group">
            <button
              class="secondary"
              disabled={!current}
              onclick={() =>
                change(
                  (p) => applyNarrativeProposal(p, chain.id, d.id),
                  'Proposal applied. Your previous text is available through Undo.'
                )}><Check size={16} /> Apply proposal</button
            >
            <button
              class="text-button"
              onclick={() =>
                change((p) => {
                  p.narratives
                    .find((n) => n.chainId === chain.id)!
                    .drafts.find((draft) => draft.id === d.id)!.status = 'dismissed';
                }, 'Proposal dismissed. Your working text is unchanged.')}>Dismiss</button
            >
          </div>
        </article>
      {/each}
    </section>{/if}
{/if}
<footer class="stage-footer">
  <div>
    <strong>{review ? 'Ready when you are.' : 'Your scenarios, in your own words.'}</strong><small
      >{review
        ? 'Completion records a final snapshot. It does not run an AI critique.'
        : 'Write a draft for each selected scenario to continue. AI help is optional.'}</small
    >
  </div>
  {#if !review}<button
      class="primary"
      disabled={!allWritten}
      onclick={() => {
        change(prepareNarrativeReview);
        next();
      }}>Review & complete <ArrowRight size={16} /></button
    >
  {:else if allFinal}<button class="primary" onclick={next}
      >Export scenarios <ArrowRight size={16} /></button
    >
  {:else}<button
      class="primary"
      disabled={!allWritten}
      onclick={() =>
        change((p) => {
          if (!allNarrativesWritten(p)) return;
          prepareNarrativeReview(p);
          p.narratives
            .filter((n) => chains.some((c) => c.id === n.chainId))
            .forEach((n) => {
              n.final = n.working;
              n.finalAt = now();
            });
          complete(p, 7);
        }, 'Final narrative snapshots saved. You can keep editing.')}
      ><Check size={16} /> Complete scenario set</button
    >
  {/if}
</footer>
