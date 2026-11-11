<script lang="ts">
  import { Check, Plus, X, Layers, RefreshCw, Search } from '@lucide/svelte';
  import {
    FUSION_MODEL,
    suggestedModels,
    displayModelName,
    effortLabels,
    type ModelMode,
    type ReasoningEffort
  } from '$lib/domain/model-settings';
  import { isFreeModel, effectiveEffort, supportedEfforts, type Model } from '$lib/ai/models';
  let {
    catalogue,
    selected,
    mode = 'individual',
    efforts = {},
    multiple = true,
    loading = false,
    loaded = false,
    status = '',
    onmodels,
    onmode,
    oneffort,
    refresh
  }: {
    catalogue: Model[];
    selected: string[];
    mode?: ModelMode;
    efforts?: Record<string, ReasoningEffort>;
    multiple?: boolean;
    loading?: boolean;
    loaded?: boolean;
    status?: string;
    onmodels: (ids: string[]) => void;
    onmode: (mode: ModelMode) => void;
    oneffort: (id: string, effort: ReasoningEffort) => void;
    refresh: () => void;
  } = $props();
  const uid = $props.id();
  let view = $state<'suggested' | 'free' | 'all'>('suggested');
  let search = $state('');
  let advanced = $state(false);
  let limit = $state(20);
  const modelsById = $derived(new Map(catalogue.map((model) => [model.id, model])));
  const selectedModel = $derived(modelsById.get(selected[0]));
  const selectedEffort = $derived(effectiveEffort(selectedModel, efforts[selected[0]]));
  const searchTerm = $derived(search.trim().toLowerCase());
  const available = $derived(
    catalogue.filter((m) => m.id !== FUSION_MODEL && !m.id.startsWith('openrouter/fusion'))
  );
  const listed = $derived(
    (view === 'suggested'
      ? suggestedModels.flatMap((id) => available.find((m) => m.id === id) ?? [])
      : view === 'free'
        ? available.filter(isFreeModel)
        : available
    ).filter((m) => `${m.name} ${m.id}`.toLowerCase().includes(searchTerm))
  );
  function choose(id: string) {
    if (selected.includes(id)) {
      if (selected.length > 1) onmodels(selected.filter((model) => model !== id));
      return;
    }
    onmodels(multiple ? [...selected, id] : [id]);
  }
  const name = (id: string) => displayModelName(id, modelsById.get(id)?.name) || id;
  const developers: Record<string, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    mistralai: 'Mistral',
    moonshotai: 'MoonshotAI',
    meta: 'Meta',
    openrouter: 'OpenRouter',
    nvidia: 'NVIDIA'
  };
  function developer(id: string) {
    const prefix = id.replace(/^~/, '').split('/')[0];
    return developers[prefix] ?? prefix;
  }
  const price = (m: Model) => {
    const input = Number(m.pricing.prompt),
      output = Number(m.pricing.completion);
    return [input, output].every((n) => Number.isFinite(n) && n >= 0)
      ? `$${(input * 1e6).toFixed(2)} input / $${(output * 1e6).toFixed(2)} output per million tokens${Number(m.pricing.request ?? 0) > 0 ? `, plus $${m.pricing.request} per request` : ''}`
      : 'Variable pricing';
  };
</script>

<div class="model-picker">
  <section class="model-start" aria-label="AI configuration summary">
    <strong
      >{mode === 'fusion'
        ? 'Combined panel response'
        : selected.length === 1
          ? 'One model for this analysis'
          : `${selected.length} independent perspectives`}</strong
    >
    <p>{mode === 'fusion' ? 'OpenRouter Fusion' : selected.map(name).join(', ')}</p>
    <p class="small muted">
      {mode === 'fusion'
        ? 'One combined contribution, charged to your overall exercise budget.'
        : selected.length === 1
          ? 'Recommended for getting started: one response to review, one set of charges. You can add perspectives after seeing a result.'
          : 'Review the contribution and cost of each perspective before running.'}
    </p>
    {#if mode === 'individual' && selected.length === 1}<p class="small muted">
        Thinking effort: {selectedModel
          ? selectedEffort
            ? effortLabels[selectedEffort]
            : 'Not offered by this model'
          : 'Checked when the model list loads'}.
      </p>{/if}
  </section>
  <details class="model-advanced model-settings-disclosure" bind:open={advanced}>
    <summary>Change models and thinking effort, or combine models with 'Fusion' (advanced)</summary>
    <fieldset class="model-mode-options">
      <legend>How would you like AI to help?</legend>
      <label class:chosen={mode === 'individual'}>
        <input
          type="radio"
          name={`${uid}-mode`}
          checked={mode === 'individual'}
          onchange={() => onmode('individual')}
        />
        <span
          ><strong>Choose individual models</strong><small
            >{multiple
              ? 'Get separate perspectives from the models you choose.'
              : 'Choose one model for this proposal.'}</small
          ></span
        >
      </label>
      <label class:chosen={mode === 'fusion'}>
        <input
          type="radio"
          name={`${uid}-mode`}
          checked={mode === 'fusion'}
          onchange={() => onmode('fusion')}
        />
        <span
          ><strong>Let Fusion combine models</strong><small
            >A panel considers your question and returns one combined response.</small
          ></span
        >
      </label>
    </fieldset>
    {#if mode === 'fusion'}
      <div class="fusion-explanation">
        <Layers size={24} aria-hidden="true" />
        <div>
          <h3>Several perspectives. One response.</h3>
          <p>
            OpenRouter Fusion consults a panel of models, compares their answers and brings them
            together. It may research the web and takes longer than a single model.
          </p>
          <p class="small muted">
            Its panel uses High thinking effort. Costs vary and count towards the same overall
            exercise budget as every other model.
          </p>
          {#if loaded && !catalogue.some((m) => m.id === FUSION_MODEL)}<p class="notice review">
              Fusion isn’t available for this connection. Refresh the list or choose individual
              models.
            </p>{/if}
          <a
            class="small"
            href="https://openrouter.ai/docs/guides/routing/routers/fusion-router"
            target="_blank"
            rel="noreferrer">How Fusion works</a
          >
        </div>
      </div>
    {:else}
      <div class="section-line picker-selection-heading">
        <h3>{multiple ? 'Your models' : 'Your model'}</h3>
        <span class="small muted">{selected.length} selected</span>
      </div>
      <p class="small muted">
        {multiple
          ? 'One is enough to start. Add more for different perspectives; each model runs separately.'
          : 'You can change this choice before running. Your writing stays yours to review.'}
      </p>
      <div class="picker-selected">
        {#each selected as id, i (id)}
          {@const model = modelsById.get(id)}
          {@const choices = supportedEfforts(model)}
          <div class="picker-selected-model">
            <div class="picker-model-heading">
              <span class="model-mark" aria-hidden="true">{['●', '■', '▲', '◆'][i % 4]}</span>
              <div>
                <strong>{name(id)}</strong><small
                  >{developer(id)}{model && isFreeModel(model) ? ' · Free' : ''}</small
                >
              </div>
              {#if multiple}<button
                  class="icon-button"
                  disabled={selected.length === 1}
                  aria-label={`Remove ${name(id)}`}
                  onclick={() => onmodels(selected.filter((v) => v !== id))}><X size={16} /></button
                >{/if}
            </div>
            {#if loaded && !model}<p class="small picker-unavailable">
                Not available for this connection. Choose a replacement below.
              </p>{/if}
            {#if choices.length}<label class="picker-effort"
                >Thinking effort<select
                  aria-label={`Thinking effort for ${name(id)}`}
                  value={effectiveEffort(model, efforts[id])}
                  onchange={(e) => oneffort(id, e.currentTarget.value as ReasoningEffort)}
                  >{#each choices as effort}<option value={effort}>{effortLabels[effort]}</option
                    >{/each}</select
                ></label
              >{/if}
            <details class="picker-details">
              <summary>Model details</summary>
              <div>
                <code>{id}</code>{#if model}<span>{price(model)}</span
                  >{#if model.context_length}<span
                      >{model.context_length.toLocaleString()} token context</span
                    >{/if}{:else}<span
                    >Refresh the model list to check availability and prices.</span
                  >{/if}
              </div>
            </details>
          </div>
        {/each}
      </div>
      {#if selected.some((id) => supportedEfforts(modelsById.get(id)).length)}<p
          class="small muted picker-thinking-help"
        >
          More thinking can take longer and cost more. The recommended starter uses Medium where
          supported.
        </p>{/if}
      <div class="picker-browser">
        <div class="picker-filter-tabs" role="group" aria-label="Find models">
          {#each [['suggested', 'Suggested'], ['free', 'Free'], ['all', 'Browse all']] as [value, label]}<button
              class:active={view === value}
              aria-pressed={view === value}
              onclick={() => {
                view = value as typeof view;
                limit = 20;
              }}>{label}</button
            >{/each}
        </div>
        {#if view === 'free'}<p class="small muted">
            These models have no input, output or request charge in the current catalogue.
            OpenRouter may apply usage limits. A key is still required.
          </p>{/if}
        <label class="picker-search"
          ><span>Find a model</span>
          <div>
            <Search size={17} aria-hidden="true" /><input
              type="search"
              bind:value={search}
              oninput={() => (limit = 20)}
              placeholder="Search name or developer…"
            />
          </div></label
        >
        <div class="section-line picker-catalogue-status">
          <span class="small muted" role="status"
            >{loading
              ? 'Finding available models…'
              : `${listed.length} ${listed.length === 1 ? 'model' : 'models'}${search ? ' found' : ''}`}</span
          ><button class="text-button small" disabled={loading} onclick={refresh}
            ><RefreshCw size={14} /> Refresh</button
          >
        </div>
        {#if !loading && status}<p class="small muted" role="status">{status}</p>{/if}
        {#if !loading && !listed.length}<div class="picker-empty">
            <strong>{loaded ? 'No models found here' : 'Let’s find your models'}</strong>
            <p>
              {search
                ? 'Try another name or developer, or choose Browse all.'
                : loaded
                  ? 'Try Browse all, or refresh the list to check again.'
                  : 'Refresh the list to see suggestions and free options.'}
            </p>
          </div>{/if}
        <div class="picker-results" aria-busy={loading}>
          {#each listed.slice(0, limit) as model (model.id)}
            {@const added = selected.includes(model.id)}
            <div class="picker-result">
              <div>
                <strong>{name(model.id)}</strong><small
                  >{model.id === 'openrouter/free'
                    ? 'Chooses a free model for you'
                    : developer(model.id)}</small
                >
              </div>
              <span class="picker-price">{isFreeModel(model) ? 'Free' : 'Paid'}</span><button
                class="secondary small"
                class:is-added={added}
                disabled={added && selected.length === 1}
                aria-pressed={added}
                aria-label={`${added ? 'Selected' : multiple ? 'Add' : 'Use'} ${name(model.id)}`}
                onclick={() => choose(model.id)}
                >{#if added}<Check size={15} /> Selected{:else}<Plus size={15} />
                  {multiple ? 'Add' : 'Use'}{/if}</button
              >
            </div>
          {/each}
        </div>
        {#if listed.length > limit}<button
            class="secondary picker-show-more"
            onclick={() => (limit += 20)}
            >Show more models ({listed.length - limit} remaining)</button
          >{/if}
      </div>
    {/if}
  </details>
</div>

<style>
  .model-start {
    padding: 16px 0;
  }
  .model-start > p {
    margin: 8px 0 0;
    max-width: 70ch;
  }
</style>
