<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { X } from '@lucide/svelte';
  let {
    title,
    close,
    children,
    wide = false
  }: { title: string; close: () => void; children: Snippet; wide?: boolean } = $props();
  let dialog: HTMLDialogElement;
  onMount(() => {
    // End any spotlight before the native modal owns focus and the top layer.
    document.dispatchEvent(new Event('walkthrough:before-dialog'));
    const trigger = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      trigger?.focus();
    };
  });
</script>

<dialog
  bind:this={dialog}
  class:wide
  oncancel={(e) => {
    e.preventDefault();
    close();
  }}
  aria-label={title}
>
  <div class="dialog-heading">
    <h2>{title}</h2>
    <button class="icon-button" aria-label="Close dialog" onclick={close}><X size={20} /></button>
  </div>
  <div class="dialog-content">{@render children()}</div>
</dialog>
