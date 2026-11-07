<script lang="ts">
  import type { ScoreSummary } from '$lib/domain/score-comparison';

  let { label, scores }: { label: string; scores: ScoreSummary | null } = $props();
  const x = (value: number) => `${5 + (value - 1) * 22.5}%`;
</script>

<span class="score-strip">
  <span class="strip-heading">
    <span class="strip-label">{label}</span>
    <span class="strip-values"
      >{scores
        ? `${scores.min === scores.max ? scores.min : `${scores.min}–${scores.max}`} · median ${scores.median}`
        : 'No current scores'}</span
    >
  </span>
  {#if scores}
    <svg
      class="strip-chart"
      role="img"
      aria-label={`${label}: AI score range ${scores.min} to ${scores.max}, AI median ${scores.median}, on a scale of 1 to 5.`}
    >
      <line x1="5%" x2="95%" y1="10" y2="10" class="strip-track" />
      {#each [1, 2, 3, 4, 5] as value}
        <line x1={x(value)} x2={x(value)} y1="6" y2="14" class="strip-track" />
        <text x={x(value)} y="30" text-anchor="middle">{value}</text>
      {/each}
      {#if scores.range > 0}
        <line x1={x(scores.min)} x2={x(scores.max)} y1="10" y2="10" class="strip-range" />
      {/if}
      <circle cx={x(scores.min)} cy="10" r="3" class="strip-end" />
      <circle cx={x(scores.max)} cy="10" r="3" class="strip-end" />
      <svg
        x={x(scores.median)}
        y="10"
        width="1"
        height="1"
        class="median-symbol"
        aria-hidden="true"
      >
        <path d="M 0 -7 l 6 7 l -6 7 l -6 -7 Z" class="strip-median" />
      </svg>
    </svg>
  {/if}
</span>

<style>
  .score-strip {
    display: block;
    min-width: 0;
    text-align: left;
    font-size: 0.75rem;
    font-weight: 400;
  }
  .strip-heading {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0 8px;
  }
  .strip-label {
    display: inline;
    font-weight: 600;
    color: var(--cg-text);
  }
  .strip-values {
    display: inline;
    color: var(--cg-text-muted);
    font-variant-numeric: tabular-nums;
  }
  .strip-chart {
    display: block;
    width: 100%;
    height: 33px;
    overflow: visible;
  }
  .median-symbol {
    overflow: visible;
  }
  text {
    fill: var(--cg-text-muted);
    font-family: var(--cg-font-ui);
    font-size: 12px;
  }
  .strip-track {
    stroke: var(--cg-control-border);
    stroke-width: 1;
  }
  .strip-range {
    stroke: var(--cg-action);
    stroke-width: 4;
    stroke-linecap: round;
  }
  .strip-end {
    fill: var(--cg-action);
  }
  .strip-median {
    fill: var(--cg-paper);
    stroke: var(--cg-action);
    stroke-width: 2;
  }
</style>
