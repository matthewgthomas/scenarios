<script lang="ts">
  import {
    ArrowRight,
    ArrowLeft,
    ArrowUp,
    ArrowDown,
    ArrowUpDown,
    Check,
    ChartScatter,
    List,
    CircleHelp
  } from '@lucide/svelte';
  import Modal from './Modal.svelte';
  import StageGuide from './StageGuide.svelte';
  import StageActions from './StageActions.svelte';
  import ScoreStrip from './ScoreStrip.svelte';
  import ModelScoreComparison from './ModelScoreComparison.svelte';
  import AssessmentResults from './AssessmentResults.svelte';
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
    type Driver,
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
  type TableSortKey = 'selected' | 'title' | 'impact' | 'uncertainty' | 'disagreement' | 'review';
  let tableSort = $state<TableSortKey>('disagreement');
  let tableDirection = $state<'ascending' | 'descending'>('descending');
  let error = $state('');
  let attentionOnly = $state(false);
  let missingOnly = $state(false);
  let impact = $state(3);
  let uncertainty = $state(3);
  let assessmentOrder = $state<string[]>([]);
  let scoreDrafts = $state<Record<string, { impact: number; uncertainty: number }>>({});
  const drivers = $derived(activeDrivers(p));
  const hasModelScores = $derived(
    drivers.some((d) => d.ratings.some((r) => r.driverRevision === d.revision))
  );
  const pending = $derived(drivers.filter((d) => d.decision?.revision !== d.revision));
  const missing = $derived(
    pending.filter((d) => coordinates(d).impact === null || coordinates(d).uncertainty === null)
  );
  const visibleDrivers = $derived(
    !selection && missingOnly ? missing : attentionOnly && !selection ? pending : drivers
  );
  const sorted = $derived(
    [...visibleDrivers].sort((a, b) =>
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
  const assessmentIds = $derived(assessmentOrder.filter((id) => drivers.some((d) => d.id === id)));
  const assessmentIndex = $derived(assessmentIds.indexOf(selectedId));
  const expectedModels = $derived(p.overrides['2'] ?? p.models);
  const comparisonModels = $derived(p.example ? comparisonModelIds([], drivers) : expectedModels);
  const modelIds = $derived(comparisonModelIds(comparisonModels, drivers));
  const comparisons = $derived(
    new Map(drivers.map((d) => [d.id, scoreComparison(d, comparisonModels)]))
  );
  const tableColumns = $derived<{ key: TableSortKey; label: string }[]>([
    ...(selection ? [{ key: 'selected' as const, label: 'Select' }] : []),
    { key: 'title', label: 'Driver' },
    { key: 'impact', label: 'Humanitarian impact' },
    { key: 'uncertainty', label: 'Uncertainty' },
    ...(!selection && hasModelScores
      ? [{ key: 'disagreement' as const, label: 'AI score comparison' }]
      : []),
    { key: 'review', label: 'Review state' }
  ]);
  function reviewState(d: Driver) {
    return d.decision?.revision === d.revision
      ? d.decision.type === 'explicitly_edited'
        ? 'Analyst-edited'
        : 'Accepted median'
      : 'Not approved';
  }
  function tableValue(d: Driver): string | number | null {
    switch (tableSort) {
      case 'selected':
        return Number(d.selected);
      case 'title':
        return d.title;
      case 'impact':
        return coordinates(d).impact;
      case 'uncertainty':
        return coordinates(d).uncertainty;
      case 'disagreement':
        return comparisons.get(d.id)!.ratings.length ? disagreement(d) : null;
      case 'review':
        return reviewState(d);
    }
  }
  const tableDrivers = $derived(
    [...visibleDrivers].sort((a, b) => {
      const left = tableValue(a);
      const right = tableValue(b);
      if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
      const order =
        typeof left === 'string' && typeof right === 'string'
          ? left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
          : Number(left) - Number(right);
      return (tableDirection === 'ascending' ? order : -order) || a.title.localeCompare(b.title);
    })
  );
  function sortTable(key: TableSortKey) {
    tableDirection =
      tableSort === key
        ? tableDirection === 'ascending'
          ? 'descending'
          : 'ascending'
        : key === 'title' || key === 'review'
          ? 'ascending'
          : 'descending';
    tableSort = key;
  }
  const selectedCount = $derived(drivers.filter((d) => d.selected).length);
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
    if (!editorOpen) {
      assessmentOrder = (view === 'table' ? tableDrivers : sorted).map((d) => d.id);
      scoreDrafts = {};
    } else if (selectedId) {
      scoreDrafts[selectedId] = { impact, uncertainty };
    }
    if (!assessmentOrder.includes(driverId)) assessmentOrder.push(driverId);
    selectedId = driverId;
    editorOpen = true;
    const c = coordinates(drivers.find((d) => d.id === driverId)!);
    impact = scoreDrafts[driverId]?.impact ?? c.impact ?? 3;
    uncertainty = scoreDrafts[driverId]?.uncertainty ?? c.uncertainty ?? 3;
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
      return false;
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
    return true;
  }
</script>

<div class="stage-heading">
  <div>
    <h1 data-walkthrough="stage-heading">
      {selection ? 'Choose critical uncertainties.' : 'Assess potential impact and uncertainty.'}
    </h1>
    <p>
      {selection
        ? 'Choose the high-impact, high-uncertainty drivers of change. Four to six is a useful starting point.'
        : 'Explore the differences in how AI models assess the potential humanitarian impact and uncertainty of each driver, or score each driver yourself.'}
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
<StageGuide
  title={selection
    ? selectedCount
      ? `${selectedCount} critical uncertainties selected`
      : 'Choose the uncertainties to explore through your scenarios'
    : `${drivers.length - pending.length} of ${drivers.length} assessments approved`}
  description={selection
    ? 'Select the drivers that could shape the future. Choose at least one; four to six is a useful guide. Checkboxes here choose what goes into your scenarios.'
    : 'Give every driver an impact score and an uncertainty score from 1 to 5. Open a driver to enter your judgement, or review AI scores and accept their medians. AI scoring is optional.'}
  ready={selection ? selectedCount > 0 : !pending.length}
  helpTitle={selection ? 'How should I choose?' : 'What do these scores mean?'}
>
  {#snippet children()}
    {#if !selection && missing.length}<span class="small review-text">Missing scores:</span
      >{#each missing.slice(0, 5) as d}<button class="workflow-link" onclick={() => inspect(d.id)}
          >{d.title}<ArrowRight size={13} /></button
        >{/each}{#if missing.length > 5}<button
          class="workflow-link"
          onclick={() => {
            attentionOnly = true;
            missingOnly = true;
          }}>See all {missing.length} missing assessments</button
        >{/if}
    {:else if selection}{#each drivers.filter((d) => d.selected) as d}<button
          class="workflow-chip"
          aria-label={`Remove ${d.title} from critical uncertainties`}
          onclick={() => toggle(d.id)}>{d.title}<span aria-hidden="true">×</span></button
        >{/each}{/if}
  {/snippet}
  {#snippet help()}<p>
      {selection
        ? 'Look for drivers with both high humanitarian impact and an uncertain direction. Keep a mix that creates meaningfully different stories. Selecting a driver keeps all its future alternatives available; you’ll develop those next.'
        : 'Impact describes the scale of humanitarian consequences. Uncertainty describes how differently the driver might unfold, not how little you know about it. AI medians remain provisional until you approve them; missing model contributions do not prevent your own assessment.'}
    </p>{/snippet}
</StageGuide>
{#if !selection}<StageActions
    generate={{ label: 'Generate scores', onclick: request }}
    add={{
      label: 'Enter scores',
      disabled: !drivers.length,
      onclick: () => inspect((missing[0] ?? pending[0] ?? drivers[0]).id)
    }}
  >
    {#snippet context()}<div class="segmented" aria-label="Assessment view">
        <button
          class:active={view === 'plot'}
          aria-pressed={view === 'plot'}
          onclick={() => (view = 'plot')}><ChartScatter size={16} /> Matrix</button
        ><button
          class:active={view === 'table'}
          aria-pressed={view === 'table'}
          onclick={() => (view = 'table')}><List size={16} /> Table</button
        >
      </div>{/snippet}
  </StageActions>{:else}<div class="toolbar">
    <div class="segmented" aria-label="Assessment view">
      <button
        class:active={view === 'plot'}
        aria-pressed={view === 'plot'}
        onclick={() => (view = 'plot')}><ChartScatter size={16} /> Matrix</button
      ><button
        class:active={view === 'table'}
        aria-pressed={view === 'table'}
        onclick={() => (view = 'table')}><List size={16} /> Table</button
      >
    </div>
    <span class="badge">{selectedCount} selected for your scenarios</span>
  </div>{/if}
{#if !p.example && hasModelScores && pending.length && drivers.some( (d) => expectedModels.some((m) => !d.ratings.some((r) => r.modelId === m && r.driverRevision === d.revision)) )}<p
    class="notice review"
  >
    Some drivers are missing AI-generated impact/uncertainty scores from one or more models in your
    configured ensemble. You can continue with available scores, run additional models, or add your
    own scores.
  </p>{/if}
{#if !selection}<div class="workflow-filter">
    <button
      class:active={!attentionOnly}
      aria-pressed={!attentionOnly}
      onclick={() => {
        attentionOnly = false;
        missingOnly = false;
      }}>All drivers ({drivers.length})</button
    ><button
      class:active={attentionOnly && !missingOnly}
      aria-pressed={attentionOnly && !missingOnly}
      onclick={() => {
        attentionOnly = true;
        missingOnly = false;
      }}>Needs approval ({pending.length})</button
    >{#if missing.length}<button
        class:active={missingOnly}
        aria-pressed={missingOnly}
        onclick={() => {
          attentionOnly = true;
          missingOnly = true;
        }}>Missing scores ({missing.length})</button
      >{/if}{#if pending.length}<button
        class="workflow-link"
        onclick={() => inspect((missing[0] ?? pending[0]).id)}
        >Review next driver <ArrowRight size={14} /></button
      >{/if}
  </div>{/if}
{#if !selection}<AssessmentResults {p} expectedModels={comparisonModels} {inspect} />{/if}
{#if view === 'plot'}
  <div class="assessment-layout">
    <section
      class="matrix-panel"
      data-walkthrough="assessment-workspace"
      aria-label="Humanitarian impact by uncertainty"
    >
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
          {#each groups as group}{@const c = coordinates(group[0])}
            {@const highlighted = group.some((d) => (selection ? d.selected : d.id === selectedId))}
            {@const checkedCount = group.filter((d) => d.selected).length}<g
              class="point-control"
              role="button"
              tabindex="0"
              aria-pressed={highlighted}
              aria-label={`${group.map((d) => d.title).join(', ')}. Impact ${c.impact}, uncertainty ${c.uncertainty}.${selection ? ` ${checkedCount} of ${group.length} selected as critical uncertainties.` : ''} Open assessment dialog.`}
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
                r={highlighted ? 12 : 9}
                class:selected-point={highlighted}
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
        {#if selection}Highlighted points contain checked critical uncertainties.{/if}
        Drivers with the same impact/uncertainty scores will appear at the same points on the matrix.
        Open a point to inspect its drivers, or use the list to the right. These scores are ordinal judgements,
        not probabilities.
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
    <section class="review-queue" data-walkthrough="uncertainty-choices">
      <div class="queue-header">
        <h2>
          {selection
            ? 'Critical uncertainties'
            : hasModelScores
              ? 'Review by exception'
              : 'Your assessments'}
        </h2>
        <label class="small"
          >Sort by<select bind:value={sort}
            ><option value="disagreement"
              >{hasModelScores ? 'Score disagreement' : 'Original order'}</option
            ><option value="impact">Humanitarian impact</option><option value="uncertainty"
              >Uncertainty</option
            ><option value="unique">Unique contributions</option></select
          ></label
        >
      </div>
      <p class="small muted">
        {selection
          ? 'Choose at least one. Four to six is a guide, not a limit.'
          : hasModelScores
            ? 'Larger score ranges appear first. This is a review aid, not a scientific threshold.'
            : 'Open a driver to enter or change your impact and uncertainty scores.'}
      </p>
      {#if !selection && hasModelScores}<p class="small muted score-strip-help">
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
                >{c.impact ?? '—'} impact / {c.uncertainty ?? '—'} uncertainty {#if hasModelScores}· {d.ratings.filter(
                    (r) => r.driverRevision === d.revision
                  ).length} perspectives{/if}</span
              >{#if !selection && hasModelScores}<span class="queue-score-strips">
                  <ScoreStrip label="Humanitarian impact" scores={comparison.impact} />
                  <ScoreStrip label="Uncertainty" scores={comparison.uncertainty} />
                </span><span class="small muted score-comparison-status"
                  >{comparison.status}{comparison.missingModels.length
                    ? ` · ${comparison.missingModels.length} configured ${comparison.missingModels.length === 1 ? 'model' : 'models'} missing`
                    : ''}</span
                >{/if}<span class="small"
                >{d.decision?.revision === d.revision
                  ? '✓ Analyst-approved'
                  : c.impact === null || c.uncertainty === null
                    ? 'Scores missing'
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
    <table data-walkthrough="assessment-workspace" class="data-table">
      <caption class="sr-only">Driver assessment. Inspect to edit numeric scores.</caption><thead
        data-walkthrough="uncertainty-choices"
        ><tr
          >{#each tableColumns as column}<th
              scope="col"
              aria-sort={tableSort === column.key ? tableDirection : undefined}
              ><button
                class="column-sort"
                onclick={() => sortTable(column.key)}
                title={column.key === 'disagreement'
                  ? 'Sort by AI score disagreement'
                  : `Sort by ${column.label.toLowerCase()}`}
                >{column.label}
                {#if tableSort !== column.key}<ArrowUpDown size={14} aria-hidden="true" />
                {:else if tableDirection === 'ascending'}<ArrowUp size={14} aria-hidden="true" />
                {:else}<ArrowDown size={14} aria-hidden="true" />{/if}
              </button></th
            >{/each}<th scope="col">Action</th></tr
        ></thead
      ><tbody
        >{#each tableDrivers as d (d.id)}{@const c = coordinates(d)}{@const comparison =
            comparisons.get(d.id)!}<tr
            >{#if selection}<td
                ><input
                  type="checkbox"
                  aria-label={`Select ${d.title}`}
                  checked={d.selected}
                  onchange={() => toggle(d.id)}
                /></td
              >{/if}<th scope="row">{d.title}</th><td class="numeric">{c.impact ?? 'Missing'}</td
            ><td class="numeric">{c.uncertainty ?? 'Missing'}</td
            >{#if !selection && hasModelScores}<td class="assessment-comparison-cell">
                <ScoreStrip label="Humanitarian impact" scores={comparison.impact} />
                <ScoreStrip label="Uncertainty" scores={comparison.uncertainty} />
                <p class="small muted">
                  {comparison.status}{comparison.missingModels.length
                    ? ` · ${comparison.missingModels.length} configured ${comparison.missingModels.length === 1 ? 'model' : 'models'} missing`
                    : ''}
                </p>
              </td>{/if}<td>{reviewState(d)}</td><td
              ><button class="text-button" onclick={() => inspect(d.id)}>Inspect / edit</button></td
            ></tr
          >{/each}</tbody
      >
    </table>
  </div>{/if}
{#if !selection && attentionOnly && !(missingOnly ? missing.length : pending.length)}<div
    class="workflow-empty"
  >
    <h3>{missingOnly ? 'Every driver has scores.' : 'Every assessment is approved.'}</h3>
    <p>
      {pending.length
        ? 'Review the remaining provisional scores before continuing.'
        : 'You’re ready to choose the uncertainties to explore.'}
    </p>
    <button
      class="secondary"
      onclick={() => {
        attentionOnly = false;
        missingOnly = false;
      }}>Show all assessments</button
    >
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
        {#if selection}<label class="check-label uncertainty-selection">
            <input
              type="checkbox"
              aria-label={`Select ${selected.title} as a critical uncertainty`}
              checked={selected.selected}
              onchange={() => toggle(selected.id)}
            />
            Select as a critical uncertainty
          </label>{/if}
        <p class="small muted">
          Approve scores to save them as an explicit analyst decision. Unapproved edits are kept
          while you move between drivers, until you close this dialog.
        </p>
      </div>
    </section>
    <div class="dialog-actions">
      <button
        class="secondary"
        disabled={assessmentIndex <= 0}
        onclick={() => inspect(assessmentIds[assessmentIndex - 1])}
        ><ArrowLeft size={16} /> Previous</button
      >
      <span class="small muted">Driver {assessmentIndex + 1} of {assessmentIds.length}</span>
      <button
        class="secondary"
        disabled={assessmentIndex < 0 || assessmentIndex >= assessmentIds.length - 1}
        onclick={() => inspect(assessmentIds[assessmentIndex + 1])}
        >Next <ArrowRight size={16} /></button
      >
      <button class="secondary" onclick={() => (editorOpen = false)}>Close</button>
    </div>
  </Modal>{/if}

{#if error}<p role="alert" class="notice error">{error}</p>{/if}
<footer class="stage-footer" data-walkthrough="stage-complete">
  <div>
    <strong
      >{selection
        ? `${selectedCount} critical uncertainties`
        : `${drivers.filter((d) => d.decision?.revision === d.revision).length} of ${drivers.length} assessments approved`}</strong
    ><small
      >{selection
        ? 'More uncertainties increase the space to explore; choose what you can meaningfully compare.'
        : !pending.length
          ? 'Next, choose the drivers whose different futures could change your story.'
          : missing.length
            ? `${missing.length} drivers still need scores. Open the next one to enter your judgement.`
            : 'Review available AI scores before accepting the remaining medians.'}</small
    >
  </div>
  {#if selection}<button
      class="primary"
      onclick={() => {
        if (!selectedCount) {
          inspect(
            [...drivers].sort(
              (a, b) => (coordinates(b).impact ?? 0) - (coordinates(a).impact ?? 0)
            )[0].id
          );
          return;
        }
        change((p) => complete(p, 3), 'Critical uncertainty selection approved.');
        next();
      }}
      >{selectedCount ? 'Confirm selection & develop hypotheses' : 'Choose an uncertainty'}
      <ArrowRight size={16} /></button
    >{:else if drivers.every((d) => d.decision?.revision === d.revision)}<button
      class="primary"
      onclick={() => {
        change((p) => complete(p, 2));
        next();
      }}>Select critical uncertainties <ArrowRight size={16} /></button
    >{:else if missing.length}<button class="primary" onclick={() => inspect(missing[0].id)}
      >Score the next missing driver <ArrowRight size={16} /></button
    >
  {:else}<button
      class="primary"
      onclick={() => {
        if (approveRemaining()) next();
      }}><Check size={16} /> Accept scores & choose critical uncertainties</button
    >{/if}
</footer>

<style>
  .column-sort {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
  }
  .column-sort:hover {
    text-decoration: underline;
  }
  .column-sort :global(svg) {
    flex-shrink: 0;
  }
  .uncertainty-selection {
    margin-top: 16px;
  }
  .overlapping-drivers {
    margin-bottom: 24px;
  }
  .overlapping-drivers > p {
    flex-basis: 100%;
    margin: 0;
    font-weight: 600;
  }
</style>
