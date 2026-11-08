<script lang="ts">
  import { CheckCircle2, CircleHelp, CircleArrowRight, ChevronDown } from '@lucide/svelte';
  import type { Snippet } from 'svelte';
  let {
    title,
    description,
    ready = false,
    children,
    help,
    helpTitle = 'A little guidance'
  }: {
    title: string;
    description: string;
    ready?: boolean;
    children?: Snippet;
    help?: Snippet;
    helpTitle?: string;
  } = $props();
</script>

<details class="stage-guide" class:ready aria-label="Stage progress and next steps" open>
  <summary class="stage-guide-main">
    <span class="stage-guide-icon" aria-hidden="true"
      >{#if ready}<CheckCircle2 size={22} />{:else}<CircleArrowRight size={22} />{/if}</span
    >
    <h2 role="status" aria-live="polite" aria-atomic="true">{title}</h2>
    <span class="stage-guide-toggle" aria-hidden="true"><ChevronDown size={18} /></span>
  </summary>
  <div class="stage-guide-copy">
    <p>{description}</p>
    {#if children}<div class="stage-guide-actions">{@render children()}</div>{/if}
  </div>
  {#if help}<details class="stage-guide-help">
      <summary><CircleHelp size={15} />{helpTitle}</summary>
      <div>{@render help()}</div>
    </details>{/if}
</details>

<style>
  .stage-guide {
    border: 1px solid var(--cg-border);
    border-left: 4px solid var(--cg-action);
    border-radius: 8px;
    background: var(--cg-paper);
    padding: 18px 20px;
    margin: 0 0 24px;
  }
  .stage-guide-main {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 0;
    margin: 0;
    color: var(--cg-text);
    list-style: none;
    cursor: pointer;
  }
  .stage-guide-main::-webkit-details-marker {
    display: none;
  }
  .stage-guide-toggle {
    display: flex;
    color: var(--cg-text-muted);
  }
  .stage-guide[open] > .stage-guide-main .stage-guide-toggle {
    transform: rotate(180deg);
  }
  .stage-guide-icon {
    color: var(--cg-action);
    display: flex;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .stage-guide-copy {
    min-width: 0;
    margin: 10px 0 0 34px;
  }
  h2 {
    font-size: 1rem;
    margin: 0;
    flex: 1;
  }
  p {
    font-size: 0.875rem;
    color: var(--cg-text-muted);
    margin: 0;
    max-width: 80ch;
  }
  .stage-guide-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 12px;
    margin-top: 12px;
  }
  .stage-guide-help {
    margin: 14px 0 0 34px;
    font-size: 0.8125rem;
  }
  .stage-guide-help > summary {
    display: flex;
    align-items: center;
    gap: 7px;
    cursor: pointer;
    color: var(--cg-action);
    font-weight: 700;
    width: fit-content;
  }
  .stage-guide-help > summary::before {
    content: '▸';
  }
  .stage-guide-help[open] > summary::before {
    content: '▾';
  }
  .stage-guide-help > div {
    padding-top: 12px;
    max-width: 75ch;
    color: var(--cg-text-muted);
  }
  .ready {
    border-left-color: var(--cg-status-approved-text);
  }
  @media (max-width: 480px) {
    .stage-guide {
      padding: 16px;
    }
    .stage-guide-help,
    .stage-guide-copy {
      margin-left: 0;
    }
  }
</style>
