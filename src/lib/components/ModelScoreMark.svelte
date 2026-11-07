<script lang="ts">
  let { index, size = 20 }: { index: number; size?: number } = $props();
  const colors = ['var(--cg-model-a)', 'var(--cg-model-b)', 'var(--cg-model-c)'];
  const paths = [
    'M 0 -8 A 8 8 0 1 1 0 8 A 8 8 0 1 1 0 -8',
    'M -7 -7 H 7 V 7 H -7 Z',
    'M 0 -9 L 9 7 H -9 Z',
    'M 0 -10 L 8 0 L 0 10 L -8 0 Z',
    'M -3 -9 H 3 V -3 H 9 V 3 H 3 V 9 H -3 V 3 H -9 V -3 H -3 Z',
    'M -5 -8 H 5 L 10 0 L 5 8 H -5 L -10 0 Z'
  ];
</script>

<svg width={size} height={size} viewBox="-12 -12 24 24" aria-hidden="true">
  <path d={paths[index % paths.length]} fill={colors[index % colors.length]} />
  {#if index >= paths.length}
    <text x="0" y="3" text-anchor="middle">{index + 1}</text>
  {/if}
</svg>

<style>
  svg {
    flex-shrink: 0;
    overflow: visible;
  }
  text {
    fill: var(--cg-paper);
    font-family: var(--cg-font-ui);
    font-size: 8px;
    font-weight: 700;
  }
</style>
