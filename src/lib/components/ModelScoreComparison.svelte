<script lang="ts">
  import { modelName, type Driver } from '$lib/domain/project';
  import { scoreComparison } from '$lib/domain/score-comparison';
  import ModelScoreMark from './ModelScoreMark.svelte';
  import ScoreStrip from './ScoreStrip.svelte';

  let {
    driver,
    expectedModels,
    modelIds
  }: {
    driver: Driver;
    expectedModels: string[];
    modelIds: string[];
  } = $props();
  const comparison = $derived(scoreComparison(driver, expectedModels));
  const earlier = $derived(driver.ratings.filter((r) => r.driverRevision !== driver.revision));
  const decision = $derived(driver.decision?.revision === driver.revision ? driver.decision : null);
  const x = (score: number) => 56 + (score - 1) * 77;
  const y = (score: number) => 260 - (score - 1) * 54;
</script>

<section class="model-score-comparison" aria-label={`AI score comparison for ${driver.title}`}>
  <h3>Compare model scores</h3>
  <p class="small comparison-status">
    <strong>{comparison.status}.</strong>
    {comparison.ratings.length} current model {comparison.ratings.length === 1
      ? 'score'
      : 'scores'}.
  </p>
  {#if comparison.missingModels.length}
    <p class="small missing-scores">
      Missing current scores: {comparison.missingModels.map(modelName).join(', ')}.
    </p>
  {/if}
  {#if comparison.ratings.length || decision}
    <div class="matrix-chart comparison-chart">
      <svg
        viewBox="0 0 414 330"
        role="img"
        aria-label={`Model positions for ${driver.title}. X axis uncertainty 1 to 5; Y axis humanitarian impact 1 to 5. Exact scores and model rationales follow the chart.`}
      >
        <rect x="56" y="44" width="308" height="216" class="plot-background" />
        {#each [1, 2, 3, 4, 5] as value}
          <line x1={x(value)} x2={x(value)} y1="44" y2="260" class="plot-line" />
          <line x1="56" x2="364" y1={y(value)} y2={y(value)} class="plot-line" />
          <text x={x(value)} y="284" text-anchor="middle">{value}</text>
          <text x="34" y={y(value) + 5} text-anchor="middle">{value}</text>
        {/each}
        <text x="210" y="318" text-anchor="middle" class="axis-label">Uncertainty</text>
        <text transform="translate(14 152) rotate(-90)" text-anchor="middle" class="axis-label"
          >Humanitarian impact</text
        >
        {#if decision}
          <g transform={`translate(${x(decision.uncertainty)} ${y(decision.impact)})`}>
            <title
              >Approved analyst scores: impact {decision.impact}, uncertainty {decision.uncertainty}</title
            >
            <circle r="20" class="approved-position" />
          </g>
        {/if}
        {#if comparison.impact && comparison.uncertainty}
          <g
            transform={`translate(${x(comparison.uncertainty.median)} ${y(comparison.impact.median)})`}
          >
            <title
              >Provisional AI median: impact {comparison.impact.median}, uncertainty {comparison
                .uncertainty.median}</title
            >
            <path d="M 0 -15 L 13 0 L 0 15 L -13 0 Z" class="median-position" />
          </g>
        {/if}
        {#each comparison.groups as group}
          <g transform={`translate(${x(group[0].uncertainty)} ${y(group[0].impact)})`}>
            <title
              >{group.map((r) => modelName(r.modelId)).join(', ')}: impact {group[0].impact},
              uncertainty {group[0].uncertainty}</title
            >
            {#if group.length > 1}
              <circle r="10" class="group-position" />
              <text y="4" text-anchor="middle" class="group-count">{group.length}</text>
            {:else}
              <g transform="translate(-12 -12)">
                <ModelScoreMark index={modelIds.indexOf(group[0].modelId)} size={24} />
              </g>
            {/if}
          </g>
        {/each}
      </svg>
    </div>
    <div class="comparison-references small">
      {#if comparison.impact && comparison.uncertainty}
        <p>
          <span class="reference-mark median-key" aria-hidden="true"></span><span
            >Provisional AI median: impact {comparison.impact.median}, uncertainty {comparison
              .uncertainty.median}</span
          >
        </p>
      {/if}
      {#if decision}
        <p>
          <span class="reference-mark approved-key" aria-hidden="true"></span><span
            >Approved analyst scores: impact {decision.impact}, uncertainty {decision.uncertainty}</span
          >
        </p>
      {/if}
    </div>
  {/if}
  {#if comparison.impact && comparison.uncertainty}
    <div class="detail-score-strips">
      <ScoreStrip label="Humanitarian impact" scores={comparison.impact} />
      <ScoreStrip label="Uncertainty" scores={comparison.uncertainty} />
    </div>
  {/if}
  <p class="small muted">
    Ranges show differences in ordinal judgements, not confidence intervals or probabilities.
  </p>
  {#each comparison.groups.filter((group) => group.length > 1) as group}
    <p class="small shared-position">
      <strong>{group.length} models at the same position</strong> (impact {group[0].impact},
      uncertainty {group[0].uncertainty}): {group.map((r) => modelName(r.modelId)).join(', ')}.
    </p>
  {/each}
  <div class="model-score-legend">
    {#each comparison.ratings as rating}
      <details>
        <summary>
          <span class="model-score-name"
            ><ModelScoreMark index={modelIds.indexOf(rating.modelId)} /><span
              >{modelName(rating.modelId)}</span
            ></span
          >
          <span class="small muted">Impact {rating.impact} / uncertainty {rating.uncertainty}</span>
        </summary>
        <p>{rating.rationale}</p>
        <p class="small muted model-id">{rating.modelId}</p>
      </details>
    {/each}
  </div>
  {#if !comparison.ratings.length}
    <p class="notice review">
      No model scores for this driver revision. Generate scores or enter your own assessment.
    </p>
  {/if}
  {#if earlier.length}
    <details class="earlier-scores">
      <summary>Earlier revision scores ({earlier.length})</summary>
      <p class="small muted">These scores are excluded from the current comparison.</p>
      {#each earlier as rating}
        <details>
          <summary
            >{modelName(rating.modelId)} · impact {rating.impact}, uncertainty {rating.uncertainty} ·
            earlier revision {rating.driverRevision}</summary
          >
          <p>{rating.rationale}</p>
          <p class="small muted model-id">{rating.modelId}</p>
        </details>
      {/each}
    </details>
  {/if}
</section>

<style>
  h3 {
    margin: 0 0 8px;
    font-size: 1rem;
  }
  .comparison-status {
    margin-bottom: 8px;
  }
  .comparison-chart {
    max-width: 480px;
  }
  .missing-scores,
  .shared-position,
  .model-id {
    overflow-wrap: anywhere;
  }
  .missing-scores {
    color: var(--cg-text-muted);
  }
  .median-position {
    fill: none;
    stroke: var(--cg-text);
    stroke-width: 2;
  }
  .approved-position {
    fill: none;
    stroke: var(--cg-action);
    stroke-width: 3;
    stroke-dasharray: 5 3;
  }
  .group-position {
    fill: var(--cg-text);
    stroke: var(--cg-paper);
    stroke-width: 2;
  }
  .comparison-chart .group-count {
    fill: var(--cg-paper);
    font-size: 12px;
    font-weight: 700;
  }
  .comparison-references p {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 8px;
  }
  .reference-mark {
    display: inline-block;
    flex-shrink: 0;
    width: 13px;
    height: 13px;
    margin: 0 4px;
  }
  .median-key {
    border: 2px solid var(--cg-text);
    transform: rotate(45deg);
  }
  .approved-key {
    border: 2px dashed var(--cg-action);
    border-radius: 50%;
  }
  .detail-score-strips {
    display: grid;
    gap: 8px;
    margin: 18px 0 12px;
  }
  .model-score-legend {
    margin-top: 16px;
  }
  details {
    border-top: 1px solid var(--cg-border);
    padding: 10px 0;
  }
  summary {
    cursor: pointer;
    overflow-wrap: anywhere;
  }
  summary > .small {
    display: block;
    margin-left: 24px;
  }
  .model-score-name {
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
    gap: 6px;
    max-width: calc(100% - 24px);
  }
  .model-score-name > span {
    min-width: 0;
  }
  details p {
    margin: 10px 0 0;
  }
  .earlier-scores {
    margin-top: 16px;
  }
</style>
