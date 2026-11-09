<script lang="ts">
  import { tick, type Snippet } from 'svelte';
  import { ArrowLeft, ArrowRight, Check } from '@lucide/svelte';
  import {
    complete,
    MODEL_SETUP_STAGE,
    modelSetupSteps,
    type Project,
    type Change
  } from '$lib/domain/project';
  import { FUSION_MODEL } from '$lib/domain/model-settings';
  import { skipModelSetup } from '$lib/domain/workflow';
  import type { Model } from '$lib/ai/models';
  import StageModelSettings from './StageModelSettings.svelte';
  import ExerciseBudget from './ExerciseBudget.svelte';
  let {
    p,
    change,
    connection,
    connected,
    catalogue,
    loading,
    loaded,
    status,
    refresh
  }: {
    p: Project;
    change: Change;
    connection: Snippet;
    connected: boolean;
    catalogue: Model[];
    loading: boolean;
    loaded: boolean;
    status: string;
    refresh: () => void;
  } = $props();
  let heading: HTMLHeadingElement;
  let budgetValid = $state(true);
  // A saved position is restored only once a session key has been checked again.
  const step = $derived(!connected ? 'connection' : p.modelSetupStep);
  const index = $derived(modelSetupSteps.indexOf(step));
  const selectedModels = $derived(p.modelMode === 'fusion' ? [FUSION_MODEL] : p.models);
  const modelsReady = $derived(
    loaded &&
      !loading &&
      selectedModels.length > 0 &&
      selectedModels.every((id) => catalogue.some((m) => m.id === id))
  );
  const ready = $derived(
    connected &&
      (step === 'connection' || modelsReady) &&
      (step !== 'budget' || (budgetValid && p.budget !== null && p.budget > 0))
  );
  const labels = ['Connect OpenRouter', 'Choose models', 'Set a budget'];
  async function go(next: (typeof modelSetupSteps)[number]) {
    budgetValid = true;
    change((p) => (p.modelSetupStep = next));
    await tick();
    heading.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  function finish() {
    if (!ready) return;
    change((p) => {
      complete(p, MODEL_SETUP_STAGE);
      p.stage = 1;
    }, 'Models and budget configured. Ready to explore drivers.');
  }
  function continueManually() {
    change(skipModelSetup, 'AI setup skipped. Continuing manually. You can add AI help later.');
  }
</script>

<div class="stage-heading">
  <div>
    <h1 data-walkthrough="stage-heading">Set up AI assistance for your analysis.</h1>
    <p>
      For optional AI help, connect your OpenRouter account, choose models and decide how much to
      spend.
    </p>
  </div>
</div>
<section
  class="model-setup-manual"
  aria-labelledby="manual-heading"
  data-walkthrough="model-manual"
>
  <div>
    <h2 id="manual-heading">Prefer to work through the analysis yourself?</h2>
    <p>
      Add and assess drivers, develop hypotheses, build chains and write scenarios manually. No
      OpenRouter account, model selection or budget is needed. You can add AI help later using
      “Models and budget” in the top bar.
    </p>
  </div>
  <button class="secondary" onclick={continueManually}>
    Continue manually <ArrowRight size={16} />
  </button>
</section>
<nav class="model-setup-steps" aria-label="AI setup steps">
  <ol>
    {#each modelSetupSteps as item, i}
      <li>
        <button
          data-walkthrough={`model-${item}-step`}
          class:current={step === item}
          aria-current={step === item ? 'step' : undefined}
          disabled={i > 0 && (!connected || (i === 2 && (!modelsReady || index < 1)))}
          onclick={() => go(item)}
        >
          <span class="wizard-step-number"
            >{#if i < index}<Check size={17} aria-hidden="true" />{:else}{i + 1}{/if}</span
          >
          <span
            ><strong>{labels[i]}</strong><small
              >{[
                'Your account and private key',
                'One model or several perspectives',
                'An allowance for this analysis'
              ][i]}</small
            ></span
          >
        </button>
      </li>
    {/each}
  </ol>
</nav>
<section class="model-setup-content" aria-labelledby="model-setup-heading">
  <h2
    id="model-setup-heading"
    data-walkthrough="model-current-step"
    tabindex="-1"
    bind:this={heading}
  >
    Step {index + 1} of 3: {labels[index]}
  </h2>
  {#if step === 'connection'}
    {@render connection()}
  {:else if step === 'models'}
    <div class="learning-copy">
      <p>
        In a web chatbot, the service usually chooses the AI for you. Here, you can choose which
        models help with your analysis. Different models may notice different drivers of change or
        suggest different futures. Their suggestions are starting points for your judgement.
      </p>
      <p>
        One model is enough to get started. With individual models, each responds separately and
        each paid model adds to the cost. Fusion asks a panel and brings its answers together into
        one response; it can take longer and its cost varies. You’ll confirm each request before it
        runs.
      </p>
      <details class="model-learning-details">
        <summary>What do prices, tokens and thinking effort mean?</summary>
        <p>
          A token is a small piece of text, often part of a word. Input is the text the model reads;
          output is what it writes. Prices per million tokens help you compare models; they are not
          the price of a single question. The app estimates the cost of your request before you run
          it.
        </p>
        <p>
          Thinking effort controls how much extra reasoning a model can do before answering, where
          supported. More thinking may take longer and use more of your budget. You can keep the
          starting settings and change them as you learn.
        </p>
      </details>
    </div>
    <StageModelSettings {p} {change} {catalogue} {loading} {loaded} {status} {refresh} />
    {#if !modelsReady}<p class="notice review" role="status">
        {loading
          ? 'Loading the models available to your account…'
          : !loaded
            ? 'Refresh the model list to check which models your account can use.'
            : 'One or more selected models are unavailable. Remove them or choose available replacements before continuing.'}
      </p>{/if}
  {:else}
    <ExerciseBudget {p} {change} required bind:valid={budgetValid} />
  {/if}
</section>
<footer class="stage-footer" data-walkthrough="stage-complete">
  <div>
    <strong
      >{step === 'connection'
        ? connected
          ? 'Your connection is checked.'
          : 'Start by connecting your account.'
        : step === 'models'
          ? 'Choose the perspectives you want.'
          : 'Ready when you are.'}</strong
    >
    <small
      >{step === 'connection'
        ? 'Paste your key and check the connection to continue. This does not generate a paid response.'
        : step === 'models'
          ? 'Keep the starting selection or change it. You can revisit these choices at any time.'
          : 'Use “Models and budget” in the top bar whenever you want to change your settings.'}</small
    >
  </div>
  <div class="toolbar-group">
    <button
      class="secondary"
      onclick={() => (index === 0 ? change((p) => (p.stage = 0)) : go(modelSetupSteps[index - 1]))}
      ><ArrowLeft size={16} />{index === 0 ? 'Back to Define analysis' : 'Back'}</button
    >
    <button
      class="primary"
      disabled={!ready}
      onclick={() => (index === 2 ? finish() : go(modelSetupSteps[index + 1]))}
    >
      {index === 0
        ? 'Continue to models'
        : index === 1
          ? 'Continue to budget'
          : 'Explore drivers of change'}<ArrowRight size={16} />
    </button>
  </div>
</footer>

<style>
  .model-setup-manual {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px 24px;
    max-width: 1080px;
    padding: 20px;
    border: 1px solid var(--cg-border);
    border-radius: 8px;
    background: var(--cg-paper);
  }
  .model-setup-manual h2 {
    font-size: 1rem;
    margin: 0 0 8px;
  }
  .model-setup-manual p {
    max-width: 65ch;
    margin: 0;
    color: var(--cg-text-muted);
  }
</style>
