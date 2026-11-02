<script lang="ts">
  import { Merge } from '@lucide/svelte';
  import { acceptMerge } from '$lib/domain/consolidation';
  import type { Project, Change } from '$lib/domain/project';
  let { p, change, kind }: { p: Project; change: Change; kind: 'driver' | 'hypothesis' } = $props();
  let error = $state('');
  const suggestions = $derived(
    p.mergeSuggestions.filter((s) => s.kind === kind && s.status === 'pending')
  );
</script>

{#if suggestions.length}<section class="merge-suggestions">
    <h2>Possible overlaps to consider</h2>
    <p class="small muted">
      Suggestions only. Keep meaningful differences and unusual perspectives.
    </p>
    {#each suggestions as s}<article class="merge-suggestion">
        <div>
          <h3>{s.title}</h3>
          <p>{s.reason}</p>
          <p class="small muted">
            {s.entityIds
              .map((id) =>
                kind === 'driver'
                  ? p.drivers.find((d) => d.id === id)?.title
                  : p.hypotheses.find((h) => h.id === id)?.title
              )
              .join(' / ')}<br />{s.modelId}
          </p>
        </div>
        <div class="toolbar-group">
          <button
            class="secondary"
            onclick={() => {
              try {
                change(
                  (p) => acceptMerge(p, s.id),
                  'Merge accepted. Original contributions preserved.'
                );
                error = '';
              } catch (e) {
                error =
                  e instanceof Error ? e.message : 'Could not merge. Review the proposed records.';
              }
            }}><Merge size={16} /> Accept merge</button
          ><button
            class="text-button"
            onclick={() =>
              change((p) => (p.mergeSuggestions.find((v) => v.id === s.id)!.status = 'dismissed'))}
            >Keep separate</button
          >
        </div>
      </article>{/each}{#if error}<p class="notice error" role="alert">{error}</p>{/if}
  </section>{/if}
