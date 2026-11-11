<script lang="ts">
  import { selectionMode } from '$lib/domain/model-settings';
  import { Search, ArrowRight, Check, Merge, Scissors, Trash2, Sprout } from '@lucide/svelte';
  import {
    activeDrivers,
    id,
    complete,
    flagDownstream,
    type Project,
    type Change
  } from '$lib/domain/project';
  import MergeSuggestions from './MergeSuggestions.svelte';
  import Modal from './Modal.svelte';
  import StageGuide from './StageGuide.svelte';
  import StageActions from './StageActions.svelte';
  let {
    p,
    change,
    request,
    next
  }: {
    p: Project;
    change: Change;
    request: (task?: 'drivers' | 'consolidate') => void;
    next: () => void;
  } = $props();
  let search = $state('');
  let organising = $state(false);
  let attentionOnly = $state(false);
  let mergeIds = $state<string[]>([]);
  let sourceId = $state('');
  let selected = $state<string[]>([]);
  let editorOpen = $state(false);
  let editing = $state('');
  let title = $state('');
  let summary = $state('');
  let tags = $state('');
  let categories = $state<string[]>([]);
  const pestleCategories = [
    'Political',
    'Economic',
    'Social',
    'Technological',
    'Legal',
    'Environmental'
  ];
  const categoryFor = (tag: string) =>
    pestleCategories.find((category) => category.toLowerCase() === tag.trim().toLowerCase());
  const drivers = $derived(activeDrivers(p));
  const pending = $derived(drivers.filter((d) => !d.approved));
  const originalProposals = $derived(
    p.drivers
      .filter((d) => d.id === (editing || sourceId) || mergeIds.includes(d.id))
      .flatMap((d) => d.origins)
  );
  const filtered = $derived(
    drivers.filter(
      (d) =>
        (!attentionOnly || !d.approved) &&
        `${d.title} ${d.summary} ${d.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase())
    )
  );
  function edit(driverId: string) {
    mergeIds = [];
    sourceId = '';
    const d = p.drivers.find((d) => d.id === driverId)!;
    editing = d.id;
    title = d.title;
    summary = d.summary;
    categories = pestleCategories.filter((category) =>
      d.tags.some((tag) => categoryFor(tag) === category)
    );
    tags = d.tags.filter((tag) => !categoryFor(tag)).join(', ');
    editorOpen = true;
  }
  function add() {
    mergeIds = [];
    sourceId = '';
    editing = '';
    title = '';
    summary = '';
    tags = '';
    categories = [];
    editorOpen = true;
  }
  function closeEditor() {
    mergeIds = [];
    sourceId = '';
    editorOpen = false;
    editing = '';
    title = '';
    summary = '';
    tags = '';
    categories = [];
  }
  function save(approve = false) {
    if (!title.trim()) return;
    const driverTags = [
      ...new Set([
        ...categories,
        ...tags
          .split(',')
          .map((tag) => categoryFor(tag) ?? tag.trim())
          .filter(Boolean)
      ])
    ];
    change(
      (p) => {
        if (editing) {
          const d = p.drivers.find((d) => d.id === editing)!;
          (d.history ??= []).push({ title: d.title, summary: d.summary, revision: d.revision });
          d.title = title.trim();
          d.summary = summary;
          d.tags = driverTags;
          d.revision++;
          d.approved = false;
          if (mergeIds.length) {
            const others = p.drivers.filter((v) => mergeIds.includes(v.id) && v.id !== d.id);
            d.origins.push(...others.flatMap((v) => v.origins));
            others.forEach((v) => {
              v.archived = true;
              v.selected = false;
            });
          }
          flagDownstream(p, 1, `${d.title} changed. Reassess scores and dependent work.`);
        } else {
          p.drivers.push({
            id: id('driver'),
            title: title.trim(),
            summary,
            tags: driverTags,
            origin: 'user',
            origins: sourceId
              ? structuredClone(p.drivers.find((d) => d.id === sourceId)?.origins ?? [])
              : [],
            revision: 1,
            approved: approve,
            selected: false,
            archived: false,
            ratings: []
          });
          flagDownstream(p, 1, `${title.trim()} added. Reassess scores and dependent work.`);
        }
        p.completed = p.completed.filter((s) => s !== 1);
        if (activeDrivers(p).length && activeDrivers(p).every((d) => d.approved)) complete(p, 1);
      },
      editing
        ? 'Driver saved. Dependent decisions may need review.'
        : approve
          ? 'Driver added and approved.'
          : 'Driver added.'
    );
    selected = [];
    closeEditor();
  }
  function merge() {
    const records = drivers.filter((d) => selected.includes(d.id));
    if (records.length < 2) return;
    edit(records[0].id);
    mergeIds = records.map((d) => d.id);
    summary = records
      .map((d) => d.summary)
      .filter(Boolean)
      .join('\n\n');
    const combinedTags = [...new Set(records.flatMap((d) => d.tags))];
    categories = pestleCategories.filter((category) =>
      combinedTags.some((t) => categoryFor(t) === category)
    );
    tags = combinedTags.filter((t) => !categoryFor(t)).join(', ');
  }
  function split() {
    const d = p.drivers.find((d) => d.id === selected[0])!;
    edit(d.id);
    editing = '';
    sourceId = d.id;
    title = `${d.title} — second aspect`;
  }
  function remove(driverIds: string[]) {
    const removed = drivers.filter((d) => driverIds.includes(d.id));
    if (!removed.length) return;
    change(
      (p) => {
        p.drivers
          .filter((d) => driverIds.includes(d.id))
          .forEach((d) => {
            d.archived = true;
            d.selected = false;
          });
        flagDownstream(
          p,
          1,
          'Drivers removed. Original proposals retained in the analytical record.'
        );
        p.completed = p.completed.filter((s) => s !== 1);
      },
      `${removed.length === 1 ? `“${removed[0].title}” removed.` : `${removed.length} drivers removed.`} Original proposals retained. You can undo this change.`
    );
    selected = selected.filter((driverId) => !driverIds.includes(driverId));
    if (editorOpen && driverIds.includes(editing)) closeEditor();
  }
</script>

<div class="stage-heading">
  <div>
    <h1 data-walkthrough="stage-heading">Explore what could shape the future.</h1>
    <p>
      {selectionMode(p, '1') === 'fusion'
        ? 'Explore combined model perspectives. Keep the drivers that matter to your question.'
        : 'Bring independent perspectives together. Keep the drivers that matter to your question.'}
    </p>
  </div>
</div>
<StageGuide
  title={!drivers.length
    ? 'Start collecting drivers of change'
    : pending.length
      ? `${drivers.length} drivers in your list, ${pending.length} to approve`
      : `Your ${drivers.length === 1 ? 'driver is' : `${drivers.length} drivers are`} approved`}
  description="A driver is a force that could shape your question, such as energy costs or access to housing. Add your own or use AI, refine the list (using the Suggest merges button if you want AI assistance), then approve every driver you want to keep."
  ready={drivers.length > 0 && !pending.length}
>
  {#snippet help()}<p>
      Explore different kinds of change: political, economic, social, technological, legal and
      environmental. Keep unusual but relevant perspectives. You’ll assess impact and uncertainty
      next; you don’t need to choose the most important drivers yet.
    </p>{/snippet}
</StageGuide>
<StageActions
  generate={{ label: 'Generate drivers', onclick: () => request('drivers') }}
  merge={{
    label: 'Suggest merges',
    disabled: drivers.length < 2,
    onclick: () => request('consolidate')
  }}
  add={{ label: 'Add driver', onclick: add }}
>
  {#snippet tools()}<button
      class="text-button"
      aria-pressed={organising}
      onclick={() => {
        organising = !organising;
        selected = [];
      }}>{organising ? 'Done organising' : 'Organise drivers'}</button
    >{/snippet}
  {#snippet context()}<label class="search-field"
      ><Search size={16} /><input
        aria-label="Search drivers"
        placeholder="Find a driver…"
        bind:value={search}
      /></label
    >{/snippet}
</StageActions>
{#if drivers.length}<div class="workflow-filter">
    <button
      class:active={!attentionOnly}
      aria-pressed={!attentionOnly}
      onclick={() => (attentionOnly = false)}>All drivers ({drivers.length})</button
    ><button
      class:active={attentionOnly}
      aria-pressed={attentionOnly}
      onclick={() => (attentionOnly = true)}>To approve ({pending.length})</button
    ><span class="small muted">Approval includes every driver you keep.</span>
  </div>{/if}
{#if organising}<p class="notice">
    Select drivers only to merge, split or remove them. These checkboxes do not control approval.
  </p>{/if}
<MergeSuggestions {p} {change} kind="driver" />
{#if selected.length}<div class="selection-bar">
    <strong>{selected.length} selected</strong><button
      class="text-button"
      disabled={selected.length < 2}
      onclick={merge}><Merge size={16} /> Merge</button
    ><button class="text-button" disabled={selected.length !== 1} onclick={split}
      ><Scissors size={16} /> Split</button
    ><button class="text-button danger-text" onclick={() => remove(selected)}
      ><Trash2 size={16} /> Remove</button
    >
  </div>{/if}
{#if drivers.length}<div class="table-scroll">
    <table class="data-table">
      <caption class="sr-only">Drivers, perspectives and approval states</caption><thead
        data-walkthrough="driver-list"
        ><tr
          >{#if organising}<th scope="col" class="checkbox-col"
              ><span class="sr-only">Select to organise</span></th
            >{/if}<th scope="col">Driver</th><th scope="col">Perspectives</th><th scope="col"
            >Status</th
          ><th scope="col"><span class="sr-only">Actions</span></th></tr
        ></thead
      ><tbody
        >{#each filtered as d (d.id)}<tr
            >{#if organising}<td
                ><input
                  type="checkbox"
                  aria-label={`Select ${d.title} to organise`}
                  checked={selected.includes(d.id)}
                  onchange={(e) =>
                    (selected = e.currentTarget.checked
                      ? [...selected, d.id]
                      : selected.filter((v) => v !== d.id))}
                /></td
              >{/if}<th scope="row"
              ><strong>{d.title}</strong>
              <p class="table-description">{d.summary}</p>
              <div class="tags">
                {#each d.tags as tag}<span>{tag}</span>{/each}
              </div></th
            ><td
              ><span
                >{d.origin === 'user'
                  ? 'Analyst-added'
                  : d.origin === 'example'
                    ? 'Authored example'
                    : `${new Set(d.origins.map((o) => o.modelId)).size} model(s)`}</span
              ></td
            ><td
              ><span class:approved={d.approved} class="badge"
                >{d.approved ? '✓ Approved' : '○ For review'}</span
              ></td
            ><td
              ><div class="driver-actions">
                {#if !d.approved}<button
                    class="text-button"
                    aria-label={`Approve ${d.title}`}
                    onclick={() =>
                      change((p) => {
                        const driver = activeDrivers(p).find((driver) => driver.id === d.id);
                        if (!driver) return;
                        driver.approved = true;
                        if (activeDrivers(p).every((driver) => driver.approved)) complete(p, 1);
                      }, `“${d.title}” approved.`)}><Check size={16} /> Approve</button
                  >{/if}
                <button
                  class="text-button"
                  aria-label={`Edit ${d.title}`}
                  onclick={() => edit(d.id)}>Edit</button
                ><button
                  class="text-button danger-text"
                  aria-label={`Remove ${d.title}`}
                  onclick={() => remove([d.id])}><Trash2 size={16} /> Remove</button
                >
              </div></td
            ></tr
          >{/each}</tbody
      >
    </table>
  </div>
  {#if !filtered.length}<div class="workflow-empty">
      <h3>{search ? 'No drivers match your search' : 'Every driver is approved'}</h3>
      <button
        class="secondary"
        onclick={() => {
          search = '';
          attentionOnly = false;
        }}>Show all drivers</button
      >
    </div>{/if}
{:else}<div class="empty-state">
    <Sprout size={34} />
    <h2>Start by exploring possible drivers of change.</h2>
    <p>
      {selectionMode(p, '1') === 'fusion'
        ? 'Fusion’s panel will consider'
        : p.modelSetupStatus === 'skipped'
          ? 'Consider'
          : 'Your chosen AI models will independently consider'} political, economic, social, technological,
      legal and environmental change, as well as looking beyond these categories.
    </p>
    <p class="small muted">
      Click Generate drivers above for AI suggestions, or Add driver to write your own.
    </p>
  </div>{/if}
{#if editorOpen}<Modal
    title={mergeIds.length
      ? 'Merge drivers'
      : sourceId
        ? 'Split into a new driver'
        : editing
          ? 'Edit driver'
          : 'Add driver'}
    close={closeEditor}
  >
    <form
      class="editor-form"
      onsubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {#if mergeIds.length}<p>
          Review the combined driver below. Saving replaces the {mergeIds.length} selected drivers with
          this one. Original contributions are preserved, and you can undo the merge.
        </p>{:else if sourceId}<p>
          Edit this copy into a distinct aspect of the original driver. The original stays in your
          list.
        </p>{/if}
      <label>Name<input required bind:value={title} /></label><label
        >Description<textarea rows="3" bind:value={summary}></textarea></label
      >
      <fieldset class="pestle-tags">
        <legend>PESTLE categories</legend>
        <p class="small muted">Select any that apply.</p>
        <div class="category-options">
          {#each pestleCategories as category}
            <label
              ><input type="checkbox" value={category} bind:group={categories} />{category}</label
            >
          {/each}
        </div>
      </fieldset>
      <label
        >Custom tags<input bind:value={tags} placeholder="For example, Migration, Food security" />
        <small class="muted">Separate tags with commas.</small>
      </label>
      {#if originalProposals.length}
        <details>
          <summary class="small">Original proposals</summary>
          {#each originalProposals as proposal}
            <p class="small"><strong>{proposal.modelId}</strong><br />{proposal.text}</p>
          {/each}
        </details>
      {/if}
      <div class="dialog-actions">
        {#if editing && !mergeIds.length}<button
            type="button"
            class="text-button danger-text remove-driver"
            onclick={() => remove([editing])}><Trash2 size={16} /> Remove</button
          >{/if}
        <button type="button" class="secondary" onclick={closeEditor}>Cancel</button>
        {#if !editing && !sourceId}<button
            type="button"
            class="secondary"
            disabled={!title.trim()}
            onclick={() => save(true)}>Add and approve</button
          >{/if}
        <button type="submit" class="primary" disabled={!title.trim()}
          >{mergeIds.length ? 'Save merged driver' : editing ? 'Save driver' : 'Add driver'}</button
        >
      </div>
    </form>
  </Modal>{/if}
{#if drivers.length}<footer class="stage-footer" data-walkthrough="stage-complete">
    <div>
      <strong
        >{drivers.length
          ? pending.length
            ? 'Happy with the drivers you’ve kept?'
            : 'Your driver list is ready'
          : 'Your first driver is a good starting point'}</strong
      ><small
        >{drivers.length
          ? `Continue with ${drivers.length === 1 ? 'this driver' : `all ${drivers.length} drivers`}. You can return and refine them later.`
          : 'Add a force that could shape your question, or generate ideas with AI.'}</small
      >
    </div>
    {#if drivers.length && drivers.every((d) => d.approved)}<button class="primary" onclick={next}
        >Assess drivers <ArrowRight size={16} /></button
      >{:else}<button
        class="primary"
        onclick={() => {
          if (!drivers.length) {
            add();
            return;
          }
          change((p) => {
            activeDrivers(p).forEach((d) => (d.approved = true));
            complete(p, 1);
          }, 'Driver list approved.');
          next();
        }}
        ><Check size={16} />
        {drivers.length ? 'Approve all & assess drivers' : 'Add your first driver'}</button
      >{/if}
  </footer>{/if}

<style>
  .driver-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .remove-driver {
    margin-right: auto;
  }
  .pestle-tags {
    border: 0;
    padding: 0;
    margin: 0;
    min-width: 0;
  }
  .pestle-tags legend {
    padding: 0;
    font-size: 0.875rem;
    font-weight: 600;
  }
  .pestle-tags p {
    margin: 4px 0 12px;
  }
  .category-options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
  }
  .category-options label {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-weight: 400;
  }
  .category-options input {
    margin: 0;
    flex-shrink: 0;
  }
  @media (max-width: 680px) {
    .data-table {
      display: block;
      background: transparent;
    }
    .data-table thead {
      display: none;
    }
    .data-table tbody {
      display: grid;
      gap: 12px;
    }
    .data-table tbody tr {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      padding: 16px;
      border: 1px solid var(--cg-border);
      border-radius: 8px;
      background: var(--cg-paper);
    }
    .data-table tbody th {
      grid-column: 1 / -1;
      grid-row: 1;
      min-width: 0;
      padding: 0;
      border: 0;
    }
    .data-table tbody tr:has(input) th {
      padding-right: 28px;
    }
    .data-table td {
      border: 0;
      padding: 8px 0 0;
    }
    .data-table td:has(input) {
      grid-column: 2;
      grid-row: 1;
      justify-self: end;
      padding: 0;
    }
    .data-table td:has(.badge) {
      grid-column: 1;
      grid-row: 3;
    }
    .data-table td:has(.text-button) {
      grid-column: 2;
      grid-row: 2 / 4;
      align-self: end;
    }
  }
</style>
