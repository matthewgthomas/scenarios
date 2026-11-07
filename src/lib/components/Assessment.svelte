<script lang="ts">
  import { ArrowRight, Check, ChartScatter, List, CircleHelp } from '@lucide/svelte';
  import Modal from './Modal.svelte';
  import ScoreStrip from './ScoreStrip.svelte';
  import ModelScoreComparison from './ModelScoreComparison.svelte';
  import { comparisonModelIds, scoreComparison } from '$lib/domain/score-comparison';
  import {
    activeDrivers,
    coordinates,
    disagreement,
    complete,
    approveDriverScores,
    flagDownstream,
    snapshotChain,
    now,
    modelName,
    type Project,
    type Change
  } from '$lib/domain/project';
  let {
    p,
    change,
    selection = false,
    request,
    next
  }: {
    p: Project;
    change: Change;
    selection?: boolean;
    request: () => void;
    next: () => void;
  } = $props();
  let selectedId = $state('');
  let editorOpen = $state(false);
  let view = $state('plot');
  let sort = $state('disagreement');
  let error = $state('');
  let impact = $state(3);
  let uncertainty = $state(3);
  const drivers = $derived(activeDrivers(p));
  const sorted = $derived(
    [...drivers].sort((a, b) =>
      sort === 'impact'
        ? (coordinates(b).impact ?? -1) - (coordinates(a).impact ?? -1)
        : sort === 'uncertainty'
          ? (coordinates(b).uncertainty ?? -1) - (coordinates(a).uncertainty ?? -1)
          : sort === 'unique'
            ? a.origins.length - b.origins.length
            : disagreement(b) - disagreement(a)
    )
  );
  const selected = $derived(drivers.find((d) => d.id === selectedId));
  const expectedModels = $derived(p.overrides['2'] ?? p.models);
  const comparisonModels = $derived(p.example ? comparisonModelIds([], drivers) : expectedModels);
  const modelIds = $derived(comparisonModelIds(comparisonModels, drivers));
  const comparisons = $derived(
    new Map(drivers.map((d) => [d.id, scoreComparison(d, comparisonModels)]))
  );
  const selectedCount = $derived(drivers.filter((d) => d.selected).length);
  const combinations = $derived(
    drivers
      .filter((d) => d.selected)
      .reduce(
        (n, d) =>
          n * Math.max(2, p.hypotheses.filter((h) => h.driverId === d.id && !h.archived).length),
        1
      )
  );
  const groups = $derived(
    Object.values(
      drivers.reduce<Record<string, typeof drivers>>((all, d) => {
        const c = coordinates(d);
        if (c.impact !== null && c.uncertainty !== null)
          (all[`${c.uncertainty}:${c.impact}`] ??= []).push(d);
        return all;
      }, {})
    )
  );
  const overlapping = $derived(
    groups.find((group) => group.some((d) => d.id === selectedId)) ?? []
  );
  function inspect(driverId: string) {
    selectedId = driverId;
    editorOpen = true;
    const c = coordinates(drivers.find((d) => d.id === driverId)!);
    impact = c.impact ?? 3;
    uncertainty = c.uncertainty ?? 3;
  }
  function inspectGroup(group: typeof drivers) {
    const current = group.findIndex((d) => d.id === selectedId);
    inspect(group[(current + 1) % group.length].id);
  }
  function toggle(driverId: string) {
    change((p) => {
      const d = p.drivers.find((d) => d.id === driverId)!;
      p.chains.forEach((c) => {
        snapshotChain(p, c);
        c.revision++;
        if (!d.selected && !(driverId in c.items)) c.items[driverId] = null;
      });
      d.selected = !d.selected;
      flagDownstream(
        p,
        3,
        'Critical uncertainty selection changed. Saved chains and narratives are preserved.'
      );
    });
  }
  function approveRemaining() {
    if (
      drivers.some((d) => coordinates(d).impact === null || coordinates(d).uncertainty === null)
    ) {
      error =
        'Some drivers have no scores. Run the models, retry missing work, or enter an explicit analyst score for each missing driver.';
      return;
    }
    change((p) => {
      activeDrivers(p).forEach((d) => {
        if (d.decision?.revision !== d.revision) {
          const c = coordinates(d);
          d.decision = {
            impact: c.impact!,
            uncertainty: c.uncertainty!,
            type: 'bulk_accepted_median',
            at: now(),
            revision: d.revision
          };
        }
      });
      complete(p, 2);
    }, 'Remaining provisional medians explicitly accepted.');
    error = '';
  }
</script>

<div class="stage-heading">
  <div>
    <h1>
      {selection
        ? 'Which uncertainties change the story?'
        : 'Assess potential impact and uncertainty.'}
    </h1>
    <p>
      {selection
        ? 'Choose the drivers with meaningfully different futures. Four to six is a useful starting point.'
        : 'Explore the differences in how AI models assess the potential humanitarian impact and uncertainty of each driver. Median scores are a starting point for your judgement.'}
    </p>
  </div>
  <details class="scale-help">
    <summary aria-label="Understand the 1–5 scales" title="Understand the 1–5 scales">
      <CircleHelp size={20} />
    </summary>
    <div class="table-scroll">
      <table class="data-table">
        <thead
          ><tr
            ><th>Score</th><th>Humanitarian impact</th><th>Uncertainty about future trajectory</th
            ></tr
          ></thead
        ><tbody
          >{#each [['Negligible consequences', 'Highly predictable'], ['Limited consequences', 'Relatively predictable'], ['Substantial consequences for some populations', 'Several credible trajectories'], ['Serious or widespread consequences', 'Considerable uncertainty'], ['Severe, potentially systemic consequences', 'Highly uncertain, radically different plausible outcomes']] as row, i}<tr
              ><th scope="row">{i + 1}</th><td>{row[0]}</td><td>{row[1]}</td></tr
            >{/each}</tbody
        >
      </table>
    </div>
  </details>
</div>
{#if !p.example && drivers.some( (d) => expectedModels.some((m) => !d.ratings.some((r) => r.modelId === m && r.driverRevision === d.revision)) )}<p
    class="notice review"
  >
    Some drivers are missing AI-generated impact/uncertainty scores from one or more models in your
    configured ensemble. You can continue with available scores, run additional models, or add your
    own scores.
  </p>{/if}
<div class="toolbar">
  <div class="segmented">
    <button class:active={view === 'plot'} onclick={() => (view = 'plot')}
      ><ChartScatter size={16} /> Matrix</button
    ><button class:active={view === 'table'} onclick={() => (view = 'table')}
      ><List size={16} /> Table</button
    >
  </div>
  {#if !selection}<button class="primary" onclick={request}>Generate impact/uncertainty scores</button
    >{:else}<span class="badge"
      >{selectedCount} selected · at least {combinations.toLocaleString()} combinations</span
    >{/if}
</div>
{#if view === 'plot'}
  <div class="assessment-layout">
    <section class="matrix-panel" aria-label="Humanitarian impact by uncertainty">
      <div class="matrix-chart">
        <svg
          viewBox="0 0 560 370"
          role="group"
          aria-label="Driver matrix. X axis uncertainty 1 to 5; Y axis humanitarian impact 1 to 5. Use the adjacent list or table to inspect and edit each driver."
        >
          <rect x="62" y="25" width="442" height="272" rx="4" class="plot-background" />
          {#each [1, 2, 3, 4, 5] as value}<line
              x1={62 + (value - 1) * 110.5}
              x2={62 + (value - 1) * 110.5}
              y1="25"
              y2="297"
              class="plot-line"
            /><line
              x1="62"
              x2="504"
              y1={297 - (value - 1) * 68}
              y2={297 - (value - 1) * 68}
              class="plot-line"
            /><text x={62 + (value - 1) * 110.5} y="322" text-anchor="middle">{value}</text><text
              x="43"
              y={302 - (value - 1) * 68}
              text-anchor="middle">{value}</text
            >{/each}
          <text x="283" y="355" text-anchor="middle" class="axis-label">Uncertainty</text><text
            transform="translate(18 163) rotate(-90)"
            text-anchor="middle"
            class="axis-label">Humanitarian impact</text
          >
          {#each groups as group}{@const c = coordinates(group[0])}<g
              class="point-control"
              role="button"
              tabindex="0"
              aria-pressed={group.some((d) => d.id === selectedId)}
              aria-label={`${group.map((d) => d.title).join(', ')}. Impact ${c.impact}, uncertainty ${c.uncertainty}. Open assessment dialog.`}
              onclick={() => inspectGroup(group)}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  inspectGroup(group);
                }
              }}
              ><circle
                cx={62 + (c.uncertainty! - 1) * 110.5}
                cy={297 - (c.impact! - 1) * 68}
                r="20"
                fill="transparent"
              /><circle
                cx={62 + (c.uncertainty! - 1) * 110.5}
                cy={297 - (c.impact! - 1) * 68}
                r={group.some((d) => d.id === selectedId) ? 12 : 9}
                class:selected-point={group.some((d) => d.id === selectedId)}
                class="matrix-point"
              /><text
                x={62 + (c.uncertainty! - 1) * 110.5}
                y={301 - (c.impact! - 1) * 68}
                class="point-label"
                text-anchor="middle"
                >{group.length > 1
                  ? group.length
                  : drivers.findIndex((d) => d.id === group[0].id) + 1}</text
              ></g
            >{/each}
        </svg>
      </div>
      <p class="small muted">
        Drivers with the same impact/uncertainty scores will appear at the same points on the
        matrix. Open a point to inspect its drivers, or use the list to the right. These scores are
        ordinal judgements, not probabilities.
      </p>
      {#if selected && selection}<div class="model-positions">
          <strong>{selected.title}: individual positions</strong
          >{#each selected.ratings as r, i}<div>
              <span class="model-mark">{['●', '■', '▲'][i % 3]}</span>
              {modelName(r.modelId)}
              <span
                >Impact {r.impact} / uncertainty {r.uncertainty}{r.driverRevision !==
                selected.revision
                  ? ' · earlier revision'
                  : ''}</span
              >
            </div>{/each}
        </div>{/if}
    </section>
    <section class="review-queue">
      <div class="queue-header">
        <h2>{selection ? 'Critical uncertainties' : 'Review by exception'}</h2>
        <label class="small"
          >Sort by<select bind:value={sort}
            ><option value="disagreement">Score disagreement</option><option value="impact"
              >Humanitarian impact</option
            ><option value="uncertainty">Uncertainty</option><option value="unique"
              >Unique contributions</option
            ></select
          ></label
        >
      </div>
      <p class="small muted">
        {selection
          ? 'No minimum or maximum is enforced.'
          : 'Larger score ranges appear first. This is a review aid, not a scientific threshold.'}
      </p>
      {#if !selection}<p class="small muted score-strip-help">
          Each strip shows the available AI score range on a 1–5 scale. The outlined diamond marks
          the AI median; ranges show differences in judgements.
        </p>{/if}
      <div class="driver-queue">
        {#each sorted as d (d.id)}{@const c = coordinates(d)}
          {@const comparison = comparisons.get(d.id)!}
          <div class:queue-selected={selectedId === d.id} class="queue-row">
            {#if selection}<input
                type="checkbox"
                aria-label={`Select ${d.title} as a critical uncertainty`}
                checked={d.selected}
                onchange={() => toggle(d.id)}
              />{/if}<button class="queue-button" onclick={() => inspect(d.id)}
              ><strong>{d.title}</strong><span class="small muted"
                >{c.impact ?? '—'} impact / {c.uncertainty ?? '—'} uncertainty · {d.ratings.filter(
                  (r) => r.driverRevision === d.revision
                ).length} perspectives</span
              >{#if !selection}<span class="queue-score-strips">
                  <ScoreStrip label="Humanitarian impact" scores={comparison.impact} />
                  <ScoreStrip label="Uncertainty" scores={comparison.uncertainty} />
                </span><span class="small muted score-comparison-status"
                  >{comparison.status}{comparison.missingModels.length
                    ? ` · ${comparison.missingModels.length} configured ${comparison.missingModels.length === 1 ? 'model' : 'models'} missing`
                    : ''}</span
                >{/if}<span class="small"
                >{d.decision?.revision === d.revision
                  ? '✓ Analyst-approved'
                  : disagreement(d) >= (selection ? 2 : 1)
                    ? '◒ Differing scores'
                    : '○ Provisional median'}</span
              ></button
            >
          </div>{/each}
      </div>
    </section>
  </div>
{:else}<div class="table-scroll">
    <table class="data-table">
      <caption class="sr-only">Driver assessment. Inspect to edit numeric scores.</caption><thead
        ><tr
          >{#if selection}<th scope="col">Select</th>{/if}<th scope="col">Driver</th><th scope="col"
            >Humanitarian impact</th
          ><th scope="col">Uncertainty</th>{#if !selection}<th scope="col">AI score comparison</th
            >{/if}<th scope="col">Review state</th><th scope="col">Action</th></tr
        ></thead
      ><tbody
        >{#each sorted as d}{@const c = coordinates(d)}{@const comparison = comparisons.get(
            d.id
          )!}<tr
            >{#if selection}<td
                ><input
                  type="checkbox"
                  aria-label={`Select ${d.title}`}
                  checked={d.selected}
                  onchange={() => toggle(d.id)}
                /></td
              >{/if}<th scope="row">{d.title}</th><td class="numeric">{c.impact ?? 'Missing'}</td
            ><td class="numeric">{c.uncertainty ?? 'Missing'}</td>{#if !selection}<td
                class="assessment-comparison-cell"
              >
                <ScoreStrip label="Humanitarian impact" scores={comparison.impact} />
                <ScoreStrip label="Uncertainty" scores={comparison.uncertainty} />
                <p class="small muted">
                  {comparison.status}{comparison.missingModels.length
                    ? ` · ${comparison.missingModels.length} configured ${comparison.missingModels.length === 1 ? 'model' : 'models'} missing`
                    : ''}
                </p>
              </td>{/if}<td
              >{d.decision?.revision === d.revision
                ? d.decision.type === 'explicitly_edited'
                  ? 'Analyst-edited'
                  : 'Accepted median'
                : 'Not approved'}</td
            ><td
              ><button class="text-button" onclick={() => inspect(d.id)}>Inspect / edit</button></td
            ></tr
          >{/each}</tbody
      >
    </table>
  </div>{/if}
{#if editorOpen && selected}<Modal
    title={`Assessment: ${selected.title}`}
    close={() => (editorOpen = false)}
    wide
  >
    {#if overlapping.length > 1}<div
        class="toolbar-group spaced overlapping-drivers"
        aria-label="Drivers at this matrix point"
      >
        <p>
          Multiple drivers have the same impact and uncertainty scores. Choose one to see more
          details.
        </p>
        {#each overlapping as d}<button
            class="secondary"
            aria-pressed={selectedId === d.id}
            onclick={() => inspect(d.id)}>{d.title}</button
          >{/each}
      </div>{/if}
    <section
      class:assessment-score-inspector={!selection}
      class="inspector modal-inspector"
      aria-label={`Scores for ${selected.title}`}
    >
      <div>
        <h2>{selected.title}</h2>
        <p>{selected.summary}</p>
        {#if !selection}
          <ModelScoreComparison driver={selected} expectedModels={comparisonModels} {modelIds} />
        {:else}{#each selected.ratings as r}<details>
              <summary
                >{modelName(r.modelId)} · impact {r.impact}, uncertainty {r.uncertainty}{r.driverRevision !==
                selected.revision
                  ? ' · earlier revision'
                  : ''}</summary
              >
              <p>{r.rationale}</p>
              <p class="small muted">{r.modelId}</p>
            </details>{/each}{#if !selected.ratings.length}<p class="notice review">
              No model scores returned. You can enter your own scores manually.
            </p>{/if}{/if}
        <p class="small muted">
          {selected.decision?.revision === selected.revision
            ? `Recorded as ${selected.decision.type.replaceAll('_', ' ')}.`
            : 'Provisional scores have not been analyst-approved.'}
        </p>
      </div>
      <div>
        <h3>Your assessment</h3>
        <div class="form-row">
          <label
            >Humanitarian impact<input
              type="number"
              min="1"
              max="5"
              step="0.5"
              bind:value={impact}
            /></label
          ><label
            >Uncertainty<input
              type="number"
              min="1"
              max="5"
              step="0.5"
              bind:value={uncertainty}
            /></label
          >
        </div>
        <button
          class="primary"
          disabled={!(impact >= 1 && impact <= 5 && uncertainty >= 1 && uncertainty <= 5)}
          onclick={() => {
            change((p) => {
              approveDriverScores(p, selected.id, impact, uncertainty);
            }, 'Analyst assessment approved.');
            editorOpen = false;
          }}><Check size={16} /> Approve these scores</button
        >
        <p class="small muted">Changes are recorded as an explicit analyst decision.</p>
      </div>
    </section>
    <div class="dialog-actions">
      <button class="secondary" onclick={() => (editorOpen = false)}>Close</button>
    </div>
  </Modal>{/if}

{#if error}<p role="alert" class="notice error">{error}</p>{/if}
<footer class="stage-footer">
  <div>
    <strong
      >{selection
        ? `${selectedCount} critical uncertainties`
        : `${drivers.filter((d) => d.decision?.revision === d.revision).length} of ${drivers.length} assessments approved`}</strong
    ><small
      >{selection
        ? 'More uncertainties increase the space to explore; choose what you can meaningfully compare.'
        : 'Inspect any AI-generated scores before accepting the remaining medians.'}</small
    >
  </div>
  {#if selection}<button
      class="primary"
      disabled={!selectedCount}
      onclick={() => {
        change((p) => complete(p, 3), 'Critical uncertainty selection approved.');
        next();
      }}>Approve selection <ArrowRight size={16} /></button
    >{:else if drivers.every((d) => d.decision?.revision === d.revision)}<button
      class="primary"
      onclick={() => {
        change((p) => complete(p, 2));
        next();
      }}>Select uncertainties <ArrowRight size={16} /></button
    >{:else}<button class="primary" onclick={approveRemaining}
      ><Check size={16} /> Accept remaining medians</button
    >{/if}
</footer>

<style>
  .overlapping-drivers {
    margin-bottom: 24px;
  }
  .overlapping-drivers > p {
    flex-basis: 100%;
    margin: 0;
    font-weight: 600;
  }
</style>
