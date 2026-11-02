<script lang="ts">
  import { onMount } from 'svelte';
  import {
    ArrowRight,
    Check,
    PenLine,
    RotateCcw,
    Undo2,
    Redo2,
    Copy,
    FileText
  } from '@lucide/svelte';
  import {
    complete,
    now,
    uncertainties,
    modelName,
    type Project,
    type Change
  } from '$lib/domain/project';
  let {
    p,
    change,
    request,
    review = false,
    next
  }: {
    p: Project;
    change: Change;
    request: (chainId: string, modelId?: string) => void;
    review?: boolean;
    next: () => void;
  } = $props();
  let selectedId = $state('');
  let mode = $state('rich');
  let annotations = $state(false);
  let snapshot = $state('');
  let restoring = $state(false);
  let alternate = $state('');
  let showQA = $state(true);
  let RichEditor = $state<typeof import('./Editor.svelte').default>();
  onMount(() => {
    void import('./Editor.svelte').then((module) => (RichEditor = module.default));
  });
  const chains = $derived(p.chains.filter((c) => c.selected));
  const chain = $derived(chains.find((c) => c.id === selectedId) ?? chains[0]);
  const narrative = $derived(p.narratives.find((n) => n.chainId === chain?.id));
  const draft = $derived(narrative?.drafts.find((d) => d.id === narrative.chosenId));
  const checks = [
    'Causal coherence',
    'Plausibility within the horizon',
    'Distinctiveness across scenarios',
    'Breadth of perspectives',
    'Humanitarian relevance',
    'Traceability to hypotheses',
    'Clear, accessible prose'
  ];
  const allChosen = $derived(
    chains.length > 0 &&
      chains.every((c) => p.narratives.some((n) => n.chainId === c.id && n.chosenId))
  );
  const allFinal = $derived(
    chains.length > 0 &&
      chains.every((c) =>
        p.narratives.some((n) => n.chainId === c.id && n.final !== null && n.final === n.working)
      )
  );
  function edit(text: string) {
    if (!narrative || text === narrative.working) return;
    change((p) => {
      const n = p.narratives.find((n) => n.id === narrative.id)!;
      n.history.push(n.working);
      if (n.history.length > 100) n.history.shift();
      n.redo = [];
      n.working = text;
      n.annotationsDetached = true;
      p.completed = p.completed.filter((stage) => stage !== 7 && stage !== 8);
    });
  }
  function undo(redo = false) {
    if (!narrative) return;
    change((p) => {
      const n = p.narratives.find((n) => n.id === narrative.id)!;
      const source = redo ? n.redo : n.history;
      const destination = redo ? n.history : n.redo;
      if (source.length) {
        destination.push(n.working);
        n.working = source.pop()!;
        n.annotationsDetached = true;
      }
    });
  }
  function choose(draftId: string) {
    change((p) => {
      const n = p.narratives.find((n) => n.id === narrative!.id)!;
      const d = n.drafts.find((d) => d.id === draftId)!;
      n.chosenId = d.id;
      n.working = d.text;
      n.history = [];
      n.review = d.chainRevision !== chain.revision;
      if (
        p.chains
          .filter((c) => c.selected)
          .every((c) => p.narratives.some((n) => n.chainId === c.id && n.chosenId))
      )
        complete(p, 6);
    }, 'Initial draft chosen. Further revisions are manual.');
  }
</script>

<div class="stage-heading">
  <div>
    <h1>{review ? 'Make these stories your own.' : 'Turn hypothesis chains into stories.'}</h1>
    <p>
      {review
        ? 'Revise the narratives in your own words. A thoughtful review is yours to make.'
        : 'Write a narrative for each approved hypothesis chain.'}
    </p>
  </div>
</div>
<div class="toolbar">
  {#if !review}<label class="inline-label"
      >Primary writer<select
        value={p.writer}
        onchange={(e) => {
          const value = e.currentTarget.value;
          change((p) => (p.writer = value));
        }}
        >{#each p.models as model}<option value={model}>{modelName(model)}</option>{/each}</select
      ></label
    >{:else}<span class="badge"><PenLine size={14} /> Manual editing</span>{/if}<span class="muted"
    >{chains.length} selected scenarios</span
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
        >{c.kind === 'wildcard' ? 'Wildcard · ' : ''}{p.narratives.find((n) => n.chainId === c.id)
          ?.chosenId
          ? '✓ Draft chosen'
          : '○ Choose a draft'}</span
      ></button
    >{/each}
</div>
{#if chain}
  {#if chain.review || narrative?.review}<p class="notice review">
      Review suggested: the chain or an upstream hypothesis changed. Your narrative and original
      drafts are preserved.
    </p>{/if}
  {#if uncertainties(p).some((d) => !chain.items[d.id])}<p class="notice review">
      Intentionally unresolved: {uncertainties(p)
        .filter((d) => !chain.items[d.id])
        .map((d) => d.title)
        .join(', ')}. Preserve these open questions in the narrative.
    </p>{/if}
  {#if !narrative?.chosenId}
    <div class="toolbar">
      <h2>{chain.title}</h2>
      <div class="toolbar-group">
        <button
          class="primary"
          disabled={chain.approvedRevision !== chain.revision}
          onclick={() => request(chain.id)}>Draft narrative</button
        >{#if narrative?.drafts.length}<label class="inline-label"
            >Alternate writer<select bind:value={alternate}
              ><option value="">Choose a model</option>{#each p.models as model}<option
                  value={model}>{modelName(model)}</option
                >{/each}</select
            ></label
          ><button
            class="secondary"
            disabled={!alternate || chain.approvedRevision !== chain.revision}
            onclick={() => request(chain.id, alternate)}>Request alternate draft</button
          >{/if}
      </div>
    </div>
    {#if chain.approvedRevision !== chain.revision}<p class="notice review">
        Approve this chain’s current revision in Construct chains before drafting.
      </p>{/if}
    {#if narrative?.drafts.length}<div class="draft-comparison">
        {#each narrative.drafts as d}<article class="draft-paper">
            <div class="section-line">
              <strong>{modelName(d.modelId)}</strong><span class="small muted"
                >Chain revision {d.chainRevision}</span
              >
            </div>
            <div class="draft-prose">{d.text}</div>
            <button class="primary" onclick={() => choose(d.id)}
              ><Check size={16} /> Choose this draft</button
            >
          </article>{/each}
      </div>{:else}<div class="empty-state">
        <FileText size={34} />
        <h2>A first draft, from your decisions.</h2>
        <p>
          The writer follows the approved chain and keeps unresolved uncertainties visible. You
          choose the draft before editing.
        </p>
      </div>{/if}
  {:else}
    <div class="writing-layout">
      <section class="narrative-paper">
        <div class="narrative-title">
          <h2>{chain.title}</h2>
          <span class="small muted"
            >{narrative.working.trim() ? narrative.working.trim().split(/\s+/).length : 0} words</span
          >
        </div>
        <div class="writing-controls">
          <div class="segmented">
            <button class:active={mode === 'rich'} onclick={() => (mode = 'rich')}>Rich text</button
            ><button class:active={mode === 'markdown'} onclick={() => (mode = 'markdown')}
              >Markdown</button
            >
          </div>
          <div class="toolbar-group">
            <button
              class="icon-button"
              aria-label="Undo text edit"
              disabled={!narrative.history.length}
              onclick={() => undo()}><Undo2 size={17} /></button
            ><button
              class="icon-button"
              aria-label="Redo text edit"
              disabled={!narrative.redo.length}
              onclick={() => undo(true)}><Redo2 size={17} /></button
            >
          </div>
        </div>
        {#key narrative.id}{#if mode === 'rich' && RichEditor}<RichEditor
              value={narrative.working}
              onedit={edit}
            />{:else}<textarea
              class="markdown-editor"
              aria-label="Scenario narrative in Markdown"
              value={narrative.working}
              oninput={(e) => edit(e.currentTarget.value)}
              rows="22"></textarea>{/if}{/key}
        <div class="narrative-meta">
          <span>Original: {draft?.modelId} · chain revision {draft?.chainRevision}</span><span
            >{narrative.final === narrative.working
              ? '✓ Final snapshot saved'
              : 'Working draft'}</span
          >
        </div>
      </section>
      <aside class="writing-aside">
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
                  const n = p.narratives.find((n) => n.id === narrative.id)!;
                  n.checklist = checked
                    ? [...n.checklist, check]
                    : n.checklist.filter((c) => c !== check);
                });
              }}
            />{check}</label
          >{/each}
        <hr />
        <label class="check-label"
          ><input type="checkbox" bind:checked={annotations} /> Show chain annotations</label
        >{#if annotations}<div class="annotation-list">
            <p class="small muted">Hypotheses and assumptions, not historical citations.</p>
            {#each uncertainties(p) as d}<p class="small">
                <strong>{d.title}</strong><br />{p.hypotheses.find(
                  (h) => h.id === chain.items[d.id]
                )?.title ?? 'Unresolved'}
              </p>{/each}{#if narrative.annotationsDetached}<p class="notice review small">
                Text changed. Chain annotations are contextual and are not attached to particular
                sentences.
              </p>{/if}
          </div>{/if}
        <hr />
        <label
          >Compare snapshot<select bind:value={snapshot}
            ><option value="">Current working draft</option><option value="original"
              >Original initial draft</option
            >{#if narrative.final !== null}<option value="final">Final approved snapshot</option
              >{/if}</select
          ></label
        >{#if snapshot}<div class="snapshot-text">
            {snapshot === 'original' ? draft?.text : narrative.final}
          </div>
          {#if !restoring}<button class="secondary" onclick={() => (restoring = true)}
              ><RotateCcw size={15} /> Restore this snapshot</button
            >{:else}<p class="small">
              The current text will remain available through Undo. Restore this snapshot?
            </p>
            <div class="toolbar-group">
              <button
                class="primary"
                onclick={() => {
                  edit(snapshot === 'original' ? draft!.text : narrative!.final!);
                  restoring = false;
                  snapshot = '';
                }}>Restore</button
              ><button class="text-button" onclick={() => (restoring = false)}>Cancel</button>
            </div>{/if}{/if}
      </aside>
    </div>
  {/if}
{/if}
<footer class="stage-footer">
  <div>
    <strong>{review ? 'Ready when you are.' : 'The first draft is the beginning.'}</strong><small
      >{review
        ? 'Completion records a final snapshot. It does not run an AI critique.'
        : 'After choosing a draft, all revisions are yours.'}</small
    >
  </div>
  {#if !review}<button class="primary" disabled={!allChosen} onclick={next}
      >Review & complete <ArrowRight size={16} /></button
    >{:else if allFinal}<button class="primary" onclick={next}
      >Export scenarios <ArrowRight size={16} /></button
    >{:else}<button
      class="primary"
      disabled={!allChosen}
      onclick={() =>
        change((p) => {
          p.narratives
            .filter((n) => chains.some((c) => c.id === n.chainId) && n.chosenId)
            .forEach((n) => {
              n.final = n.working;
              n.finalAt = now();
            });
          complete(p, 7);
        }, 'Final narrative snapshots saved. You can keep editing.')}
      ><Check size={16} /> Complete scenario set</button
    >{/if}
</footer>
