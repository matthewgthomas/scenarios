<script lang="ts">
  import { assessmentResults } from '$lib/domain/task-results';
  import { modelName, type Project } from '$lib/domain/project';
  let {
    p,
    expectedModels,
    inspect
  }: {
    p: Project;
    expectedModels: string[];
    inspect: (driverId: string) => void;
  } = $props();
  const results = $derived(assessmentResults(p, expectedModels));
</script>

{#if results.runs.length}
  <section class="task-results assessment-results" aria-label="Driver assessment results">
    <div role="status" aria-live="polite" aria-atomic="true">
      <h2>
        {#if results.state === 'running'}Assessing drivers…{:else if results.affected.length}
          Scores received for {results.affected.length}
          {results.affected.length === 1 ? 'driver' : 'drivers'} from {results.modelCount}
          {results.modelCount === 1 ? 'model' : 'models'}
        {:else}No current scores received{/if}
      </h2>
      <p class="small muted">
        {#if results.state === 'running'}Results appear as model requests finish.
        {:else if results.state === 'partial'}Assessment finished with partial results. Valid scores
          are kept; retry missing work in Model contributions below.
        {:else if results.state === 'failed'}Assessment failed. Retry it in Model contributions
          below.
        {:else if results.state === 'cancelled'}Assessment was cancelled. Previously received scores
          are kept.
        {:else if results.state === 'skipped'}Missing work was skipped. Available scores are kept.
        {:else}Latest assessment complete.{/if}
        {#if results.missingRequested && results.state !== 'running'}
          {results.missingRequested} requested driver/model {results.missingRequested === 1
            ? 'assessment is'
            : 'assessments are'} missing from this run.
        {/if}
      </p>
    </div>
    <p class="small">
      {results.missingCoverage}
      {results.missingCoverage === 1 ? 'driver is' : 'drivers are'} missing current scores from one or
      more configured models.
      {results.awaitingApproval}
      {results.awaitingApproval === 1 ? 'driver awaits' : 'drivers await'} analyst approval. AI scores
      are provisional. Review the scores before approving; your analyst decisions are preserved.
    </p>
    {#if results.affected.length}
      <div class="toolbar-group">
        <button
          class="secondary"
          onclick={() =>
            inspect(
              (
                results.affected.find(
                  (row) => row.driver.decision?.revision !== row.driver.revision
                ) ?? results.affected[0]
              ).driver.id
            )}>Review assessed drivers</button
        >
      </div>
      <details class="assessment-result-details">
        <summary>See assessed drivers and current AI scores ({results.affected.length})</summary>
        <div class="table-scroll">
          <table class="data-table">
            <caption class="sr-only"
              >Drivers with scores received in the latest assessment; medians include all current
              model scores.</caption
            >
            <thead
              ><tr
                ><th scope="col">Driver</th><th scope="col">AI median impact</th><th scope="col"
                  >AI median uncertainty</th
                ><th scope="col">Current model coverage</th><th scope="col">Review</th></tr
              ></thead
            >
            <tbody>
              {#each results.affected as row (row.driver.id)}
                <tr>
                  <th scope="row">{row.driver.title}</th>
                  <td class="numeric">{row.comparison.impact?.median ?? 'Missing'}</td>
                  <td class="numeric">{row.comparison.uncertainty?.median ?? 'Missing'}</td>
                  <td
                    >{row.comparison.ratings.length}
                    {row.comparison.ratings.length === 1 ? 'model' : 'models'}
                    {#if row.comparison.missingModels.length}<p class="small muted">
                        Missing: {row.comparison.missingModels.map(modelName).join(', ')}
                      </p>{/if}
                  </td>
                  <td
                    ><button class="text-button" onclick={() => inspect(row.driver.id)}
                      >Review {row.driver.title}</button
                    ></td
                  >
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </details>
    {:else if results.state === 'complete'}
      <p class="small muted">
        There are no results for active drivers at their current revision. Earlier revision scores
        are excluded.
      </p>
    {/if}
  </section>
{/if}
