<script lang="ts">
  import type { Snippet } from 'svelte';
  import ActionButton from './ActionButton.svelte';

  type Action = { label: string; onclick: () => void; disabled?: boolean; title?: string };
  let {
    generate,
    merge,
    add,
    tools,
    context
  }: {
    generate: Action;
    merge?: Action;
    add?: Action;
    tools?: Snippet;
    context?: Snippet;
  } = $props();
  let element = $state<HTMLDivElement>();
  let height = $state(0);
  // Adjacent sticky panels and focus targets must clear the actual wrapped action bar.
  $effect(() => {
    const workspace = element?.closest<HTMLElement>('.workspace-content');
    workspace?.style.setProperty('--stage-actions-height', `${height}px`);
    return () => workspace?.style.removeProperty('--stage-actions-height');
  });
</script>

<div
  class="stage-actions"
  role="group"
  aria-label="Stage actions"
  bind:this={element}
  bind:offsetHeight={height}
>
  <div class="stage-action-buttons" data-walkthrough="stage-actions">
    <ActionButton kind="generate" {...generate} />
    {#if merge}<ActionButton kind="merge" {...merge} />{/if}
    {#if add}<ActionButton kind="add" {...add} />{/if}
    {#if tools}{@render tools()}{/if}
  </div>
  {#if context}<div class="stage-action-context">{@render context()}</div>{/if}
</div>

<style>
  .stage-actions {
    position: sticky;
    top: var(--workspace-topbar-height, 72px);
    z-index: 16;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px 24px;
    padding: 12px 0;
    margin: -12px 0 20px;
    background: var(--cg-workspace);
    border-bottom: 1px solid var(--cg-border);
  }
  .stage-action-buttons,
  .stage-action-context {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    min-width: 0;
    max-width: 100%;
  }
  @media (max-width: 680px) {
    .stage-action-context {
      width: 100%;
    }
  }
  @media print {
    .stage-actions {
      display: none;
    }
  }
</style>
