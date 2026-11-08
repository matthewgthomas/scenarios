<script lang="ts">
  import { Sparkles, Merge, Plus } from '@lucide/svelte';

  let {
    kind,
    label,
    onclick,
    disabled = false,
    title
  }: {
    kind: 'generate' | 'merge' | 'add';
    label: string;
    onclick: () => void;
    disabled?: boolean;
    title?: string;
  } = $props();
  const Icon = $derived(kind === 'generate' ? Sparkles : kind === 'merge' ? Merge : Plus);
</script>

<button
  type="button"
  class="secondary stage-action"
  data-stage-action={kind}
  aria-haspopup="dialog"
  {onclick}
  {disabled}
  {title}
>
  <Icon size={16} aria-hidden="true" />{label}
</button>

<style>
  .stage-action {
    min-height: 40px;
    font-size: 0.875rem;
  }
  .stage-action :global(svg) {
    flex-shrink: 0;
  }
</style>
