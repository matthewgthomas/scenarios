<script lang="ts">
  import { onMount, tick } from 'svelte';
  import {
    ArrowRight,
    Check,
    MessageSquareText,
    PencilLine,
    RotateCcw,
    Undo2,
    Redo2
  } from '@lucide/svelte';
  import {
    uncertainties,
    activeChains,
    approvedChainSet,
    modelName,
    allNarrativesWritten,
    canWriteNarrative,
    editNarrative,
    undoNarrative,
    proposalIsCurrent,
    applyNarrativeProposal,
    type Project,
    type Change
  } from '$lib/domain/project';
  import Modal from './Modal.svelte';
  import StageGuide from './StageGuide.svelte';
  import StageActions from './StageActions.svelte';
  import ActionButton from './ActionButton.svelte';
  import { completeScenarioSet } from '$lib/domain/workflow';
  let {
    p,
    change,
    request,
    busy = false,
    next,
    reviewChains
  }: {
    p: Project;
    change: Change;
    request: (task: 'narrative' | 'narrative_edit', chainId: string, instructions?: string) => void;
    busy?: boolean;
    next: () => void;
    reviewChains: () => void;
  } = $props();
  let selectedId = $state('');
  type WritingAction = 'generate' | 'write';
  let choosing = $state<WritingAction | null>(null);
  let editorOpen = $state(false);
  let mode = $state('rich');
  let snapshot = $state('');
  let restoring = $state(false);
  let instructions = $state<Record<string, string>>({});
  let proposalsHeading = $state<HTMLHeadingElement>();
  const uid = $props.id();
  const proposalsHeadingId = `${uid}-proposals-heading`;
  let RichEditor = $state<typeof import('./Editor.svelte').default>();
  onMount(() => {
    void import('./Editor.svelte').then((module) => (RichEditor = module.default));
  });
  const chains = $derived(activeChains(p).filter((c) => c.selected));
  const chain = $derived(chains.find((c) => c.id === selectedId) ?? chains[0]);
  const narrative = $derived(p.narratives.find((n) => n.chainId === chain?.id));
  const editable = $derived(chain ? canWriteNarrative(p, chain.id) : false);
  const proposals = $derived(
    narrative?.drafts.filter(
      (d) => d.id !== narrative.chosenId && d.status !== 'accepted' && d.status !== 'dismissed'
    ) ?? []
  );
  const pendingAI = $derived(
    chains.flatMap((c) => {
      const n = p.narratives.find((n) => n.chainId === c.id);
      return (
        n?.drafts
          .filter(
            (d) =>
              d.modelId !== 'authored/example' &&
              d.id !== n.chosenId &&
              d.status !== 'accepted' &&
              d.status !== 'dismissed'
          )
          .map((d) => ({ chainId: c.id, title: c.title, draft: d })) ?? []
      );
    })
  );
  const attentionTarget = $derived(
    pendingAI.find((entry) => entry.chainId === chain?.id) ?? pendingAI[0]
  );
  const attentionTitle = $derived(
    pendingAI.length > 1
      ? `${pendingAI.length} AI proposals need your review`
      : attentionTarget?.draft.kind === 'edit'
        ? 'AI edit ready for your review'
        : 'AI draft ready for your review'
  );
  const missingDrafts = $derived(
    chains.filter((c) => !p.narratives.find((n) => n.chainId === c.id)?.working.trim())
  );
  const allWritten = $derived(allNarrativesWritten(p));
  const chainsApproved = $derived(approvedChainSet(p));
  function openScenario(chainId: string) {
    selectedId = chainId;
    editorOpen = true;
    snapshot = '';
    restoring = false;
  }
  function canPerform(action: WritingAction | null, chainId: string) {
    const c = chains.find((c) => c.id === chainId);
    if (!c) return false;
    return action === 'generate'
      ? !busy && c.approvedRevision === c.revision
      : action === 'write' && canWriteNarrative(p, c.id);
  }
  function perform(action: WritingAction, chainId: string) {
    if (!canPerform(action, chainId)) return;
    choosing = null;
    if (action === 'generate') request('narrative', chainId);
    else openScenario(chainId);
  }
  function startAction(action: WritingAction) {
    if (chains.length === 1) perform(action, chains[0].id);
    else choosing = action;
  }

  const allFinal = $derived(
    p.completed.includes(7) &&
      !p.stale.some((s) => s === 6 || s === 7) &&
      allWritten &&
      chains.every((c) =>
        p.narratives.some(
          (n) => n.chainId === c.id && n.final !== null && n.final === n.working && !n.review
        )
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
  async function reviewProposals() {
    if (!attentionTarget) return;
    selectedId = attentionTarget.chainId;
    editorOpen = true;
    snapshot = '';
    restoring = false;
    await tick();
    proposalsHeading?.focus({ preventScroll: true });
    proposalsHeading?.scrollIntoView({
      block: 'start',
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    });
  }
</script>

<div class="stage-heading">
  <div>
    <h1 data-walkthrough="stage-heading">Write & review scenarios</h1>
    <p>
      Shape each story, review it alongside its hypothesis chains, then save your final set of
      scenarios.
    </p>
  </div>
</div>
<StageGuide
  title={!chainsApproved
    ? 'Review your updated scenario set before saving final stories'
    : allFinal
      ? 'Your final set of scenarios is saved'
      : allWritten
        ? 'Every story has a draft. Ready for a final read?'
        : `${chains.length - missingDrafts.length} of ${chains.length} scenario drafts written`}
  description="Write a narrative for every included scenario, then review the stories and save a final snapshot. The review checklist is optional. Your writing saves as you type, and you can keep editing after completing the set."
  ready={allFinal}
  helpTitle="A simple way to shape your story"
>
  {#snippet children()}
    {#if !chainsApproved}<button class="workflow-link" onclick={reviewChains}
        >Review & approve your chains <ArrowRight size={14} /></button
      >{/if}
    {#each missingDrafts as c}<button class="workflow-link" onclick={() => openScenario(c.id)}
        >Write {c.title}<ArrowRight size={14} /></button
      >{/each}
    {#if allWritten && !allFinal}<button
        class="workflow-link"
        onclick={() =>
          openScenario(
            (
              chains.find((c) =>
                p.narratives.some((n) => n.chainId === c.id && (n.review || n.final !== n.working))
              ) ?? chains[0]
            ).id
          )}>Click/tap a story to review <ArrowRight size={14} /></button
      >{/if}
  {/snippet}
  {#snippet help()}<ol>
      <li>Set the scene: what does this future look and feel like?</li>
      <li>
        Trace the path: how do the choices in the hypothesis chain reinforce or challenge each
        other?
      </li>
      <li>Make it human: who is affected, in what ways, and what remains uncertain?</li>
    </ol>
    <p>
      Aim for around 400–600 words per scenario. AI drafts and edits are proposals for you to review
      before applying.
    </p>{/snippet}
</StageGuide>
<StageActions
  generate={{
    label: 'Generate draft',
    disabled: !chains.some((c) => canPerform('generate', c.id)),
    onclick: () => startAction('generate')
  }}
  add={{
    label: 'Write scenario',
    disabled: !chains.some((c) => canPerform('write', c.id)),
    onclick: () => startAction('write')
  }}
/>
{#if choosing}
  <Modal
    title={choosing === 'generate'
      ? 'Choose a scenario for the draft'
      : 'Choose a scenario to write'}
    close={() => (choosing = null)}
  >
    <p>
      {choosing === 'generate'
        ? 'Which scenario would you like an AI draft for? You’ll review the models and cost before running.'
        : 'Which story would you like to write or review?'}
    </p>
    <ul class="scenario-choices">
      {#each chains as c (c.id)}
        <li>
          <ActionButton
            kind={choosing === 'generate' ? 'generate' : 'add'}
            label={c.title}
            disabled={!canPerform(choosing, c.id)}
            onclick={() => {
              if (choosing) perform(choosing, c.id);
            }}
          />
          {#if !canPerform(choosing, c.id)}<p class="small muted">
              {choosing === 'generate' && busy
                ? 'Wait for the current model operation to finish.'
                : 'Approve this chain in Construct chains first.'}
            </p>{/if}
        </li>
      {/each}
    </ul>
  </Modal>
{/if}
{#if attentionTarget && !editorOpen}
  <aside class="proposal-attention" aria-label="AI proposals awaiting review">
    <MessageSquareText size={22} aria-hidden="true" />
    <div class="proposal-attention-copy">
      <strong>{attentionTitle}</strong>
      <p>
        For {attentionTarget.title}. Open the editor to review the {pendingAI.length === 1
          ? 'proposal'
          : 'proposals'}
        before deciding what to keep.
      </p>
    </div>
    <button class="primary" aria-haspopup="dialog" onclick={reviewProposals}>
      Review AI {pendingAI.length === 1 ? 'proposal' : 'proposals'}
      <ArrowRight size={16} aria-hidden="true" />
    </button>
  </aside>
{/if}

<p class="small muted scenario-tabs-hint">
  Click/tap a scenario to work on its story. You can move between scenarios inside the editor.
</p>
<div class="scenario-tabs" aria-label="Narratives">
  {#each chains as c}{@const pendingCount = pendingAI.filter(
      (entry) => entry.chainId === c.id
    ).length}{@const story = p.narratives.find((n) => n.chainId === c.id)}<button
      class:active={editorOpen && chain?.id === c.id}
      class="scenario-tab scenario-{c.colour}"
      data-walkthrough="writing-scenarios"
      aria-label={`Write and review scenario: ${c.title}. ${story?.working.trim() ? 'Draft written' : 'Not started'}${pendingCount ? `. ${pendingCount} AI proposals to review` : ''}`}
      aria-haspopup="dialog"
      onclick={() => {
        selectedId = c.id;
        editorOpen = true;
        snapshot = '';
        restoring = false;
      }}
      ><strong>{c.title}</strong><span class="small"
        >{p.narratives.find((n) => n.chainId === c.id)?.working.trim()
          ? story?.final === story?.working
            ? '✓ Final snapshot saved'
            : '✓ Draft written'
          : '○ Not started'}</span
      >{#if story?.working.trim()}<p class="scenario-preview">
          {story.working.replace(/[#*_>`]/g, '').slice(0, 180)}{story.working.length > 180
            ? '…'
            : ''}
        </p>
        <span class="small muted">{story.working.trim().split(/\s+/).length} words</span>{:else}<p
          class="scenario-preview"
        >
          A story waiting to be written. Start with what changes and who is affected.
        </p>{/if}{#if pendingCount}<span class="proposal-tab-badge"
          ><MessageSquareText size={13} aria-hidden="true" />
          {pendingCount} AI {pendingCount === 1 ? 'proposal' : 'proposals'} to review</span
        >{/if}<span class="scenario-tab-action small"
        ><PencilLine size={14} aria-hidden="true" />
        {story?.working.trim() ? 'Write or review' : 'Start writing'}</span
      ></button
    >{/each}
</div>
{#if editorOpen && chain}
  <Modal title={`Write & review scenario: ${chain.title}`} close={() => (editorOpen = false)} wide>
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
            <button class:active={mode === 'rich'} onclick={() => (mode = 'rich')}>Rich text</button
            >
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
          Describe the future, its causal pathway and humanitarian implications. Around 400–600
          words is a guide, not a limit.
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
        {#if narrative}
          <hr />
          <details class="review-checklist">
            <summary>Review checklist (optional)</summary>
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
          </details>
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
          Ask AI to edit your draft or, if you prefer, request an AI-generated draft. You review
          every proposal before applying it.
        </p>
        <p class="small muted">Choose your model or Fusion and review the cost before sending.</p>
        <label class="spaced"
          >Editing instructions (optional)<textarea
            rows="2"
            value={instructions[chain.id] ?? ''}
            placeholder="For example, make the causal pathway clearer while keeping my voice."
            oninput={(e) => (instructions[chain.id] = e.currentTarget.value)}></textarea></label
        >
        <div class="toolbar-group spaced">
          <ActionButton
            kind="generate"
            label="Ask AI to edit this draft"
            disabled={busy ||
              !narrative?.working.trim() ||
              chain.approvedRevision !== chain.revision}
            onclick={() => {
              editorOpen = false;
              request('narrative_edit', chain.id, instructions[chain.id]);
            }}
          />
        </div>
        <p class="small muted">
          For a new starting draft, use Generate draft in the page action bar.
        </p>
      </details>{/key}
    {#if proposals.length}<section class="narrative-proposals" aria-label="AI proposals">
        <h2 id={proposalsHeadingId} bind:this={proposalsHeading} tabindex="-1">
          Proposals awaiting your review
        </h2>
        <p class="small muted">
          Compare each proposal below, then apply or dismiss it. Your working text stays unchanged
          until you apply a proposal.
        </p>
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
                Your text or chain has changed since this proposal. Request a fresh proposal to
                apply AI changes to your current draft.
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
    <div class="dialog-actions">
      <span class="small muted">Your writing is saved as you type.</span>
      {#if chains.length > 1}<button
          class="secondary"
          onclick={() =>
            openScenario(
              chains[(chains.findIndex((c) => c.id === chain.id) + 1) % chains.length].id
            )}>Next scenario <ArrowRight size={15} /></button
        >{/if}<button class="primary" onclick={() => (editorOpen = false)}>Done</button>
    </div>
  </Modal>
{/if}
<footer class="stage-footer" data-walkthrough="stage-complete">
  <div>
    <strong
      >{!chainsApproved
        ? 'Your scenario set needs approval'
        : missingDrafts.length
          ? `${missingDrafts.length} ${missingDrafts.length === 1 ? 'story still needs' : 'stories still need'} a draft`
          : allFinal
            ? 'Your final set is ready to share'
            : 'Ready to save your final set?'}</strong
    >
    <small
      >{!chainsApproved
        ? 'Your writing is kept. Review and approve the updated chains before saving a final set.'
        : missingDrafts.length
          ? 'Write a draft for every selected scenario. AI help is optional.'
          : allFinal
            ? 'You can export now, or keep refining your stories.'
            : 'Give your stories a final read, then save a snapshot of the whole set. The checklist is optional.'}</small
    >
  </div>
  {#if !chainsApproved}<button class="primary" onclick={reviewChains}
      >Review & approve your chains <ArrowRight size={16} /></button
    >
  {:else if missingDrafts.length}<button
      class="primary"
      onclick={() => openScenario(missingDrafts[0].id)}
      >Write the next missing draft <ArrowRight size={16} /></button
    >
  {:else if allFinal}<button class="primary" onclick={next}
      >Export scenarios <ArrowRight size={16} /></button
    >
  {:else}<button
      class="primary"
      disabled={!allWritten}
      onclick={() => {
        change((p) => {
          completeScenarioSet(p);
        }, 'Final narrative snapshots saved. You can keep editing.');
        next();
      }}><Check size={16} /> Save final set & export</button
    >{/if}
</footer>
<div class="sr-only" role="status" aria-atomic="true">
  {#if attentionTarget}{attentionTitle}. For {attentionTarget.title}. Review the proposals in the
    scenario editor.{/if}
</div>

<style>
  .scenario-choices {
    display: grid;
    gap: 12px;
    list-style: none;
    margin: 20px 0 0;
    padding: 0;
  }
  .scenario-choices :global(.stage-action) {
    width: 100%;
    justify-content: flex-start;
    text-align: left;
  }
  .scenario-choices p {
    margin: 6px 0 0;
  }
  .review-checklist summary {
    cursor: pointer;
    color: var(--cg-action);
    font-weight: 700;
  }
  .review-checklist {
    margin-bottom: 16px;
  }
  .scenario-preview {
    margin: 12px 0;
    font-size: 0.875rem;
    font-weight: 400;
    color: var(--cg-text-muted);
    line-height: 1.7;
    max-width: 60ch;
  }
  .proposal-attention {
    position: static;
    width: auto;
    margin: 0 0 24px;
    transform: none;
  }
</style>
