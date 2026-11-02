<script lang="ts">
  import { Plus, Search, ArrowRight, Check, Merge, Scissors, Trash2, Sprout } from '@lucide/svelte';
  import {
    activeDrivers,
    id,
    complete,
    flagDownstream,
    type Project,
    type Change
  } from '$lib/domain/project';
  import MergeSuggestions from './MergeSuggestions.svelte';
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
  let selected = $state<string[]>([]);
  let editing = $state('');
  let title = $state('');
  let summary = $state('');
  let tags = $state('');
  const drivers = $derived(activeDrivers(p));
  const filtered = $derived(
    drivers.filter((d) =>
      `${d.title} ${d.summary} ${d.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase())
    )
  );
  function edit(driverId: string) {
    const d = p.drivers.find((d) => d.id === driverId)!;
    editing = d.id;
    title = d.title;
    summary = d.summary;
    tags = d.tags.join(', ');
  }
  function add() {
    const driverId = id('driver');
    change((p) =>
      p.drivers.push({
        id: driverId,
        title: 'New driver',
        summary: '',
        tags: [],
        origin: 'user',
        origins: [],
        revision: 1,
        approved: false,
        selected: false,
        archived: false,
        ratings: []
      })
    );
    edit(driverId);
  }
  function save() {
    change((p) => {
      const d = p.drivers.find((d) => d.id === editing)!;
      (d.history ??= []).push({ title: d.title, summary: d.summary, revision: d.revision });
      d.title = title.trim() || d.title;
      d.summary = summary;
      d.tags = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      d.revision++;
      d.approved = false;
      flagDownstream(p, 1, `${d.title} changed. Reassess scores and dependent work.`);
    }, 'Driver saved. Dependent decisions may need review.');
    editing = '';
  }
  function merge() {
    change((p) => {
      const records = p.drivers.filter((d) => selected.includes(d.id));
      const target = records[0];
      target.summary = records
        .map((d) => d.summary)
        .filter(Boolean)
        .join('\n\n');
      target.origins.push(...records.slice(1).flatMap((d) => d.origins));
      target.tags = [...new Set(records.flatMap((d) => d.tags))];
      target.revision++;
      target.approved = false;
      records.slice(1).forEach((d) => {
        d.archived = true;
        d.selected = false;
      });
      flagDownstream(
        p,
        1,
        `${records.length} drivers merged into ${target.title}; originals preserved.`
      );
    });
    selected = [];
  }
  function split() {
    const d = p.drivers.find((d) => d.id === selected[0])!;
    const newId = id('driver');
    const original = structuredClone($state.snapshot(d));
    change((p) => {
      p.drivers.push({
        ...original,
        id: newId,
        title: `${d.title} — second aspect`,
        revision: 1,
        approved: false,
        selected: false,
        ratings: [],
        decision: undefined
      });
      flagDownstream(p, 1, `${d.title} split. Review both aspects and their scores.`);
    });
    selected = [];
    edit(newId);
  }
</script>

<div class="stage-heading">
  <div>
    <h1>Explore what could shape the future.</h1>
    <p>Bring independent perspectives together. Keep the drivers that matter to your question.</p>
  </div>
</div>
<div class="toolbar">
  <div class="toolbar-group">
    <button class="primary" onclick={() => request('drivers')}
      ><Sprout size={17} /> Generate drivers</button
    ><button class="secondary" disabled={drivers.length < 2} onclick={() => request('consolidate')}
      ><Merge size={16} /> Suggest merges</button
    ><button class="secondary" onclick={add}><Plus size={16} /> Add driver</button>
  </div>
  <label class="search-field"
    ><Search size={16} /><input
      aria-label="Search drivers"
      placeholder="Find a driver…"
      bind:value={search}
    /></label
  >
</div>
<MergeSuggestions {p} {change} kind="driver" />
{#if selected.length}<div class="selection-bar">
    <strong>{selected.length} selected</strong><button
      class="text-button"
      disabled={selected.length < 2}
      onclick={merge}><Merge size={16} /> Merge</button
    ><button class="text-button" disabled={selected.length !== 1} onclick={split}
      ><Scissors size={16} /> Split</button
    ><button
      class="text-button danger-text"
      onclick={() => {
        change((p) => {
          p.drivers
            .filter((d) => selected.includes(d.id))
            .forEach((d) => {
              d.archived = true;
              d.selected = false;
            });
          flagDownstream(
            p,
            1,
            'Drivers removed. Original proposals retained in the analytical record.'
          );
        });
        selected = [];
      }}><Trash2 size={16} /> Remove</button
    >
  </div>{/if}
{#if drivers.length}<div class="table-scroll">
    <table class="data-table">
      <caption class="sr-only">Drivers, original contributions and approval states</caption><thead
        ><tr
          ><th scope="col" class="checkbox-col"><span class="sr-only">Select</span></th><th
            scope="col">Driver</th
          ><th scope="col">Perspectives</th><th scope="col">Status</th><th scope="col"
            ><span class="sr-only">Edit</span></th
          ></tr
        ></thead
      ><tbody
        >{#each filtered as d (d.id)}<tr
            ><td
              ><input
                type="checkbox"
                aria-label={`Select ${d.title}`}
                checked={selected.includes(d.id)}
                onchange={(e) =>
                  (selected = e.currentTarget.checked
                    ? [...selected, d.id]
                    : selected.filter((v) => v !== d.id))}
              /></td
            ><th scope="row"
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
              >
              <details>
                <summary class="small">Original proposals</summary>{#each d.origins as o}<p
                    class="small"
                  >
                    <strong>{o.modelId}</strong><br />{o.text}
                  </p>{/each}
              </details></td
            ><td
              ><span class:approved={d.approved} class="badge"
                >{d.approved ? '✓ Approved' : '○ For review'}</span
              ></td
            ><td><button class="text-button" onclick={() => edit(d.id)}>Edit</button></td></tr
          >{/each}</tbody
      >
    </table>
  </div>
  <p class="small muted">
    Exact title matches are grouped automatically. Select related drivers to merge them yourself.
    Unique contributions stay visible.
  </p>{:else}<div class="empty-state">
    <Sprout size={34} />
    <h2>Start by exploring possible drivers.</h2>
    <p>
      Your models will independently consider political, economic, social, technological, legal and
      environmental change, and look beyond these categories.
    </p>
    <button class="primary" onclick={() => request('drivers')}>Generate drivers</button>
  </div>{/if}
{#if editing}<section class="inspector editor-form" aria-label="Driver editor">
    <h2>Edit driver</h2>
    <label>Name<input bind:value={title} /></label><label
      >Description<textarea rows="3" bind:value={summary}></textarea></label
    ><label>Tags, separated by commas<input bind:value={tags} /></label>
    <div class="toolbar-group">
      <button class="primary" disabled={!title.trim()} onclick={save}>Save driver</button><button
        class="secondary"
        onclick={() => (editing = '')}>Cancel</button
      >
    </div>
  </section>{/if}
<footer class="stage-footer">
  <div>
    <strong>{drivers.length} drivers to explore</strong><small
      >Approving keeps every original contribution available.</small
    >
  </div>
  {#if drivers.length && drivers.every((d) => d.approved)}<button class="primary" onclick={next}
      >Assess drivers <ArrowRight size={16} /></button
    >{:else}<button
      class="primary"
      disabled={!drivers.length}
      onclick={() =>
        change((p) => {
          activeDrivers(p).forEach((d) => (d.approved = true));
          complete(p, 1);
        }, 'Driver list approved.')}><Check size={16} /> Approve driver list</button
    >{/if}
</footer>
