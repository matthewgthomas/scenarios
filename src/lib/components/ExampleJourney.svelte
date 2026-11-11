<script lang="ts">
  import { ArrowLeft, ArrowRight } from '@lucide/svelte';
  import type { Project } from '$lib/domain/project';
  let {
    p,
    guided,
    navigate,
    onexit,
    exitDisabled = false,
    onguided
  }: {
    p: Project;
    guided: boolean;
    navigate: (stage: number) => void;
    onexit: () => void;
    exitDisabled?: boolean;
    onguided: (value: boolean) => void;
  } = $props();
  const steps = [
    {
      stage: 0,
      title: 'Begin with the analytical question',
      text: 'This example analysis asks how UK financial hardship could evolve by 2029. The starting point is an open question about people’s ability to meet essential costs, rather than a prediction.'
    },
    {
      stage: 1,
      title: 'Identify a driver: household energy',
      text: 'Energy costs, reliability and access to heating can shape hardship. This example list was written to illustrate the method; it did not come from an evidence review or a live run with AI models. When designing your own scenarios, you can record research and consultation findings alongside the driver assessment.'
    },
    {
      stage: 2,
      title: 'Assess impact and uncertainty',
      text: 'Take a look at the “Household energy” driver below: the illustrative analyst decision is impact 5 and uncertainty 4. Serious consequences and several credible trajectories make it worth exploring. The uncertainty scores show how judgements can differ, but note that they are not probabilities.'
    },
    {
      stage: 3,
      title: 'Choose the driver as a critical uncertainty',
      text: 'Household energy is selected because its different futures could materially change the answer to the question. Health service capacity is important but more predictable here, so it has not been selected as a critical uncertainty. Any assumption carried across all scenarios should be written explicitly in the “Define analysis” stage.'
    },
    {
      stage: 4,
      title: 'Develop contrasting alternative outcomes',
      text: 'For household energy, compare “Prices remain volatile”, “Lower costs, unequal gains” and “Stable regulated bills”. These are alternative hypotheses for the same critical uncertainty. They are possibilities to explore, rather than forecasts.'
    },
    {
      stage: 5,
      title: 'Combine outcomes into a scenario',
      text: 'Read the chain of hypotheses for the “Local lifelines” scenario below: volatile energy prices combine with local emergency funds, portfolio incomes, rising rents and mutual aid. The explanation connects these choices. The column combines outcomes across uncertainties; it is not a timeline.'
    },
    {
      stage: 6,
      title: 'Follow the combination into its narrative',
      text: 'Open the “Local lifelines” scenario below. Its draft shows how volatile bills and rising rents can undermine households despite stronger local support. The selected hypotheses remain beside the writing so you can trace the story to the analytical choices.'
    }
  ];
  const index = $derived(steps.findIndex((s) => s.stage === p.stage));
  function go(i: number) {
    onguided(true);
    navigate(steps[i].stage);
  }
</script>

<section class="example-journey" aria-label="Guided example">
  {#if guided && index >= 0}
    <p class="small muted">Follow one driver of change through the example · {index + 1} of {steps.length}</p>
    <h2>{steps[index].title}</h2>
    <p>{steps[index].text}</p>
    <div class="journey-actions">
      <button class="secondary small" disabled={index === 0} onclick={() => go(index - 1)}
        ><ArrowLeft size={15} /> Previous</button
      >
      {#if index < steps.length - 1}<button class="primary small" onclick={() => go(index + 1)}
          >Next: {[
            '',
            'driver',
            'scoring',
            'selection',
            'alternatives',
            'combination',
            'narrative'
          ][index + 1]}
          <ArrowRight size={15} /></button
        >{:else}<button class="primary small" onclick={() => onguided(false)}>Finish guide</button
        >{/if}
      <button class="secondary small" onclick={onexit} disabled={exitDisabled}
        >Exit example</button
      >
    </div>
    <p class="small muted">
      The illustrative upstream decisions are already approved so you can inspect every stage.
      Follow the guide or explore the workspace below.
    </p>
  {:else}
    <div class="journey-actions">
      <button class="text-button" onclick={() => go(0)}
        >Trace the example from its question <ArrowRight size={15} /></button
      ><button class="secondary small" onclick={onexit} disabled={exitDisabled}
        >Exit example</button
      >
    </div>
  {/if}
</section>

<style>
  .example-journey {
    margin: 0 0 24px;
    border-left: 3px solid var(--cg-action);
    padding: 4px 0 4px 20px;
  }
  h2 {
    font-size: 1.1rem;
    margin: 8px 0;
  }
  p {
    max-width: 78ch;
    margin: 8px 0;
  }
  .journey-actions {
    display: flex;
    gap: 10px 16px;
    align-items: center;
    flex-wrap: wrap;
    margin: 14px 0;
  }
  .journey-actions:last-child {
    margin: 0;
  }
</style>
