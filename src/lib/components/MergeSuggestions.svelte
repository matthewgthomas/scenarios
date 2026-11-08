<script lang="ts">
  import { Check, Merge } from '@lucide/svelte';
  import { acceptMerge } from '$lib/domain/consolidation';
  import { mergePreview, mergeResults } from '$lib/domain/task-results';
  import { modelName, type Project, type Change } from '$lib/domain/project';
  let { p, change, kind }: { p: Project; change: Change; kind: 'driver' | 'hypothesis' } = $props();
  let error = $state('');
  const results = $derived(mergeResults(p, kind));
  const noun = $derived(kind === 'hypothesis' ? 'hypothesis' : 'driver');
</script>

{#if results.runs.length || results.pending.length || results.decisions.length}
  <section class="merge-suggestions task-results" aria-label="Merge results">
    <div role="status" aria-live="polite" aria-atomic="true">
      <h2>
        {#if results.pending.length}
          {results.pending.length} merge {results.pending.length === 1
            ? 'suggestion'
            : 'suggestions'} ready for review
        {:else if results.state === 'running'}Reviewing possible merges…
        {:else if results.unavailable}Request a fresh merge review
        {:else if results.runs.length && results.state === 'complete' && !results.proposed}No merges
          suggested
        {:else if results.decisions.length}Merge decisions saved
        {:else}No merge suggestions received{/if}
      </h2>
      {#if results.runs.length}
        <p class="small muted">
          {#if results.state === 'running'}The latest merge review is still running.
          {:else if results.unavailable}Earlier suggestions are unavailable. Request a fresh merge
            review to see and apply them.
          {:else if results.state === 'complete'}
            Latest review: {results.proposed
              ? `${results.proposed} merge ${results.proposed === 1 ? 'suggestion' : 'suggestions'} proposed.`
              : 'No merges suggested. Existing records are unchanged.'}
          {:else if results.state === 'partial'}The latest review finished with some results
            missing. Available suggestions are kept.
          {:else if results.state === 'cancelled'}The latest review was cancelled. Earlier
            suggestions are still available.
          {:else if results.state === 'skipped'}The latest review was skipped. Earlier suggestions
            are still available.
          {:else}The latest review failed. Retry it in Model contributions below.{/if}
        </p>
      {/if}
    </div>
    {#if results.pending.length}
      <p class="small">
        Review the proposed replacements below. Accept merge applies the changes; no records change
        until you accept. Keep meaningful differences and unusual perspectives.
      </p>
    {/if}
    {#each results.pending as s (s.id)}
      {@const preview = mergePreview(p, s)}
      <article class="merge-suggestion">
        <div class="merge-comparison">
          <div class="merge-sources">
            <h3>Existing {kind === 'hypothesis' ? 'hypotheses' : 'drivers'}</h3>
            <ul>
              {#each preview.sources as source (source.id)}
                <li>
                  <strong>{source.title}</strong>
                  <p class="small">{source.description}</p>
                </li>
              {/each}
            </ul>
          </div>
          <div class="merge-proposal">
            <h3>Proposed combined {noun}</h3>
            <strong>{s.title}</strong>
            <p class="merge-description small">{preview.description}</p>
          </div>
        </div>
        <p class="small"><strong>Why merge:</strong> {s.reason}</p>
        {#if preview.applicable && preview.target}
          <p class="merge-effect small">
            <strong>On acceptance:</strong> update “{preview.target.title}” to “{s.title}” and
            remove
            {preview.removed.map((record) => `“${record.title}”`).join(', ')} from the active list. Original
            contributions are preserved{kind === 'hypothesis'
              ? '; affected chains are flagged for review'
              : ''}.
          </p>
        {:else}
          <p class="notice review small">
            Some source records have changed or been removed. Keep these separate and request a
            fresh merge review.
          </p>
        {/if}
        <div class="section-line">
          <span class="small muted">Suggested by {modelName(s.modelId)}</span>
          <div class="toolbar-group">
            <button
              class="secondary"
              disabled={!preview.applicable}
              onclick={() => {
                try {
                  change(
                    (p) => acceptMerge(p, s.id),
                    `Merged as “${s.title}”. Removed from the active list: ${preview.removed.map((record) => record.title).join(', ')}. Original contributions preserved.`
                  );
                  error = '';
                } catch (e) {
                  error =
                    e instanceof Error
                      ? e.message
                      : 'Could not merge. Review the proposed records.';
                }
              }}><Merge size={16} /> Accept merge</button
            >
            <button
              class="text-button"
              onclick={() =>
                change((p) => {
                  p.mergeSuggestions.find((v) => v.id === s.id)!.status = 'dismissed';
                }, `Kept the proposed sources for “${s.title}” separate.`)}>Keep separate</button
            >
          </div>
        </div>
      </article>
    {/each}
    {#if results.decisions.length}
      <div class="merge-decisions">
        {#each results.decisions as s (s.id)}
          {@const preview = mergePreview(p, s)}
          <p class="small merge-receipt">
            <Check size={16} aria-hidden="true" />
            <span
              >{#if s.status === 'accepted'}
                <strong>Merged as “{s.title}”.</strong> Removed from the active list:
                {preview.removed.map((record) => `“${record.title}”`).join(', ')}. Original
                contributions preserved.
              {:else}<strong>Kept separate:</strong>
                {preview.sources.map((record) => `“${record.title}”`).join(', ')}.{/if}</span
            >
          </p>
        {/each}
      </div>
    {/if}
    {#if error}<p class="notice error" role="alert">{error}</p>{/if}
  </section>
{/if}
