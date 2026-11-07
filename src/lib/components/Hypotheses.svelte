<script lang="ts">
  import { Plus, Check, ArrowRight, Merge, Scissors, Trash2 } from '@lucide/svelte';
  import {
    uncertainties,
    statesFor,
    editHypothesis,
    id,
    flagDownstream,
    complete,
    type Project,
    type Change
  } from '$lib/domain/project';
  import MergeSuggestions from './MergeSuggestions.svelte';
  import Modal from './Modal.svelte';
  let {
    p,
    change,
    request,
    next
  }: {
    p: Project;
    change: Change;
    request: (task?: 'hypotheses' | 'consolidate') => void;
    next: () => void;
  } = $props();
  let selected = $state<string[]>([]);
  let editing = $state('');
  let title = $state('');
  let description = $state('');
  const drivers = $derived(uncertainties(p));
  const allApproved = $derived(
    drivers.every((d) => statesFor(p, d.id).length && statesFor(p, d.id).every((h) => h.approved))
  );
  function edit(hId: string) {
    const h = p.hypotheses.find((h) => h.id === hId)!;
    editing = hId;
    title = h.title;
    description = h.description;
  }
  function add(driverId: string) {
    const hId = id('hypothesis');
    change((p) =>
      p.hypotheses.push({
        id: hId,
        driverId,
        title: 'New future state',
        description: '',
        origins: [],
        revision: 1,
        approved: false,
        archived: false
      })
    );
    edit(hId);
  }
  function remove(hIds: string[]) {
    change((p) => {
      p.hypotheses
        .filter((h) => hIds.includes(h.id))
        .forEach((h) => {
          h.archived = true;
          h.approved = false;
        });
      const affected = p.chains.filter((c) =>
        Object.values(c.items).some((h) => h !== null && hIds.includes(h))
      );
      affected.forEach((c) => c.revision++);
      flagDownstream(
        p,
        4,
        'Hypotheses removed. Existing chain references are retained for review.',
        affected.map((c) => c.id)
      );
    });
    selected = [];
  }
  function merge() {
    const hs = p.hypotheses.filter((h) => selected.includes(h.id));
    if (hs.length < 2 || !hs.every((h) => h.driverId === hs[0].driverId)) return;
    change((p) => {
      const first = p.hypotheses.find((h) => h.id === hs[0].id)!;
      first.origins.push(...hs.slice(1).flatMap((h) => h.origins));
      editHypothesis(p, first.id, first.title, hs.map((h) => h.description).join('\n\n'));
    });
    remove(hs.slice(1).map((h) => h.id));
  }
  function split() {
    const h = p.hypotheses.find((h) => h.id === selected[0])!;
    const hId = id('hypothesis');
    const original = structuredClone($state.snapshot(h));
    change((p) =>
      p.hypotheses.push({
        ...original,
        id: hId,
        title: `${h.title} — alternative`,
        revision: 1,
        approved: false
      })
    );
    selected = [];
    edit(hId);
  }
</script>

<div class="stage-heading">
  <div>
    <h1>Explore different futures for each critical uncertainty.</h1>
    <p>
      Develop distinct, plausible future states. There is no fixed number of alternatives to keep.
    </p>
  </div>
</div>
<div class="toolbar">
  <div class="toolbar-group">
    <button class="primary" onclick={() => request('hypotheses')}>Generate hypotheses</button
    ><button
      class="secondary"
      disabled={p.hypotheses.filter((h) => !h.archived).length < 2}
      onclick={() => request('consolidate')}><Merge size={16} /> Suggest merges</button
    >
  </div>
  <span class="muted">{drivers.length} critical uncertainties</span>
</div>
<MergeSuggestions {p} {change} kind="hypothesis" />
{#if selected.length}<div class="selection-bar">
    <strong>{selected.length} selected</strong><button
      class="text-button"
      disabled={selected.length < 2 ||
        new Set(p.hypotheses.filter((h) => selected.includes(h.id)).map((h) => h.driverId)).size !==
          1}
      onclick={merge}><Merge size={16} /> Merge within uncertainty</button
    ><button class="text-button" disabled={selected.length !== 1} onclick={split}
      ><Scissors size={16} /> Split</button
    ><button class="text-button danger-text" onclick={() => remove(selected)}
      ><Trash2 size={16} /> Remove</button
    >
  </div>{/if}
<div class="hypothesis-sections">
  {#each drivers as d (d.id)}<section class="hypothesis-section">
      <div class="section-line">
        <div>
          <h2>{d.title}</h2>
          <span class="small muted"
            >{d.tags.join(' / ')} · {statesFor(p, d.id).length} future states</span
          >
        </div>
        <button class="text-button" onclick={() => add(d.id)}><Plus size={16} /> Add your own hypothesis</button>
      </div>
      <div class="hypothesis-options">
        {#each statesFor(p, d.id) as h (h.id)}<article class="hypothesis-option">
            <div class="section-line">
              <label class="check-label"
                ><input
                  type="checkbox"
                  aria-label={`Select ${h.title}`}
                  checked={selected.includes(h.id)}
                  onchange={(e) =>
                    (selected = e.currentTarget.checked
                      ? [...selected, h.id]
                      : selected.filter((id) => id !== h.id))}
                /><strong>{h.title}</strong></label
              ><span class="small muted">{h.approved ? '✓ Approved' : '○ For review'}</span>
            </div>
            <p>{h.description}</p>
            <div class="section-line">
              <details>
                <summary class="small"
                  >{h.origins.length
                    ? `${new Set(h.origins.map((o) => o.modelId)).size} contributing perspective(s)`
                    : 'Analyst-added'}</summary
                >{#each h.origins as o}<p class="small">
                    <strong>{o.modelId}</strong><br />{o.text}
                  </p>{/each}
              </details>
              <button class="text-button" onclick={() => edit(h.id)}>Edit</button>
            </div>
          </article>{/each}{#if !statesFor(p, d.id).length}<p class="muted">
            Generate possible future states or add your own.
          </p>{/if}
      </div>
    </section>{/each}
</div>
{#if editing}<Modal title="Edit future state" close={() => (editing = '')}>
    <form
      class="editor-form"
      onsubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        change(
          (p) => editHypothesis(p, editing, title, description),
          'Hypothesis saved. Affected work marked for review.'
        );
        editing = '';
      }}
    >
      <label>Short title<input bind:value={title} /></label><label
        >Describe this future state<textarea rows="4" bind:value={description}></textarea></label
      >
      <p class="small muted">
        Changing a state flags affected chains and narratives for review. Earlier model reasoning is
        preserved. No models run.
      </p>
      <div class="dialog-actions">
        <button type="button" class="secondary" onclick={() => (editing = '')}>Cancel</button>
        <button type="submit" class="primary" disabled={!title.trim()}>Save hypothesis</button>
      </div>
    </form>
  </Modal>{/if}
<footer class="stage-footer">
  <div>
    <strong>Alternatives, not predictions</strong><small
      >Keep enough difference to tell meaningfully different stories.</small
    >
  </div>
  {#if allApproved}<button
      class="primary"
      onclick={() => {
        change((p) => complete(p, 4));
        next();
      }}
      >Construct chains <ArrowRight size={16} /></button
    >{:else}<button
      class="primary"
      disabled={!drivers.every((d) => statesFor(p, d.id).length)}
      onclick={() =>
        change((p) => {
          p.hypotheses
            .filter((h) => !h.archived && drivers.some((d) => d.id === h.driverId))
            .forEach((h) => (h.approved = true));
          complete(p, 4);
        }, 'Future-state hypotheses approved.')}><Check size={16} /> Approve future states</button
    >{/if}
</footer>
