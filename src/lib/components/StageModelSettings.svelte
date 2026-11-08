<script lang="ts">
  import { tick } from 'svelte';
  import { ArrowLeft, ChevronRight } from '@lucide/svelte';
  import { stages, type Project, type Change } from '$lib/domain/project';
  import {
    aiModelStages,
    defaultModels,
    displayModelName,
    selectionMode,
    stageModels,
    hasStageModels,
    customizeStageModels,
    resetStageModels,
    type ModelMode
  } from '$lib/domain/model-settings';
  import type { Model } from '$lib/ai/models';
  import ModelPicker from './ModelPicker.svelte';
  let {
    p,
    change,
    catalogue,
    loading,
    loaded,
    status,
    refresh
  }: {
    p: Project;
    change: Change;
    catalogue: Model[];
    loading: boolean;
    loaded: boolean;
    status: string;
    refresh: () => void;
  } = $props();
  let editing = $state<string | null>(null);
  let advancedOpen = $state(false);
  let heading = $state<HTMLHeadingElement>();
  const uid = $props.id();
  const customCount = $derived(
    aiModelStages.filter((stage) => hasStageModels(p, String(stage))).length
  );
  const custom = $derived(editing !== null && hasStageModels(p, editing));
  const mode = $derived(selectionMode(p, editing ?? 'default'));
  const selected = $derived(editing === null ? p.models : stageModels(p, editing));
  const name = (id: string) => displayModelName(id, catalogue.find((m) => m.id === id)?.name);
  function summary(scope: string) {
    return selectionMode(p, scope) === 'fusion'
      ? 'OpenRouter Fusion'
      : (scope === 'default' ? p.models : stageModels(p, scope)).map(name).join(', ');
  }
  async function editStage(scope: string) {
    editing = scope;
    await tick();
    heading?.focus();
    heading?.scrollIntoView({ block: 'start' });
  }
  async function back() {
    const previous = editing;
    editing = null;
    advancedOpen = true;
    await tick();
    document.getElementById(`${uid}-stage-${previous}`)?.focus();
  }
  function setModels(models: string[]) {
    if (!models.length) return;
    const scope = editing;
    change((p) => {
      if (scope !== null) {
        customizeStageModels(p, scope);
        p.overrides[scope] = scope === '6' ? models.slice(0, 1) : [...models];
      } else {
        p.models = [...models];
        if (!models.includes(p.writer)) p.writer = models[0];
      }
    });
  }
  function setMode(mode: ModelMode) {
    const scope = editing;
    change((p) => {
      if (scope !== null) {
        customizeStageModels(p, scope);
        p.modelModeOverrides[scope] = mode;
      } else p.modelMode = mode;
    });
  }
</script>

{#if editing === null}
  <div class="stage-model-heading">
    <h3>Models for the whole exercise</h3>
    <p class="muted">
      A ready-to-use selection for your exercise. Keep these models, try a free option, or let
      Fusion combine perspectives.
    </p>
  </div>
  <details class="stage-model-advanced" bind:open={advancedOpen}>
    <summary
      ><span
        >Use different models by stage <span class="small muted">(advanced, optional)</span></span
      >{#if customCount}<span class="stage-model-custom-count"
          >{customCount} {customCount === 1 ? 'custom stage' : 'custom stages'}</span
        >{/if}</summary
    >
    <p class="small muted">
      Most exercises can use the same models throughout. Change a stage below only if you want a
      different selection for that part of the work.
    </p>
    <ul class="stage-model-list" aria-label="Models by stage">
      {#each aiModelStages as stage}
        {@const scope = String(stage)}
        {@const customized = hasStageModels(p, scope)}
        <li>
          <div>
            <strong>{stages[stage]}</strong><span class="stage-model-source" class:customized
              >{customized ? 'Custom selection' : 'Uses exercise defaults'}</span
            >
            <p>{summary(scope)}</p>
          </div>
          <button
            id={`${uid}-stage-${scope}`}
            class="secondary small"
            aria-label={`Change models for ${stages[stage]}`}
            onclick={() => editStage(scope)}>Change <ChevronRight size={15} /></button
          >
        </li>
      {/each}
    </ul>
    <p class="small muted">
      Select uncertainties and Export don’t run AI models, so they don’t need their own choices.
    </p>
  </details>
{:else}
  <button class="text-button stage-model-back" onclick={back}
    ><ArrowLeft size={16} /> Whole-exercise models</button
  >
  <div class="stage-model-heading">
    <h3 tabindex="-1" bind:this={heading}>{stages[Number(editing)]}</h3>
    <p class="muted">
      Choose how this stage uses AI. Your other stage selections stay as they are.
    </p>
  </div>
  <fieldset class="stage-model-inheritance">
    <legend>Models for this stage</legend>
    <label class:chosen={!custom}
      ><input
        type="radio"
        name={`${uid}-inherit`}
        checked={!custom}
        onchange={() => {
          const scope = editing!;
          change((p) => resetStageModels(p, scope));
        }}
      /><span
        ><strong>Use exercise defaults</strong><small
          >Follows any changes you make to whole-exercise models.</small
        ></span
      ></label
    >
    <label class:chosen={custom}
      ><input
        type="radio"
        name={`${uid}-inherit`}
        checked={custom}
        onchange={() => {
          const scope = editing!;
          change((p) => customizeStageModels(p, scope));
        }}
      /><span
        ><strong>Choose different models</strong><small
          >Keep a separate selection just for this stage.</small
        ></span
      ></label
    >
  </fieldset>
  {#if !custom}<div class="stage-model-inherited">
      <strong>This stage will use</strong>
      <p>{summary(editing)}</p>
      <span class="small muted"
        >To change this selection, choose “Choose different models” above.</span
      >
    </div>{/if}
{/if}

{#if editing === null || custom}
  {#key editing}
    <ModelPicker
      {catalogue}
      {selected}
      {mode}
      efforts={p.reasoningEfforts}
      multiple={editing !== '6'}
      {loading}
      {loaded}
      {status}
      {refresh}
      onmodels={setModels}
      onmode={setMode}
      oneffort={(id, effort) => change((p) => (p.reasoningEfforts[id] = effort))}
    />
  {/key}
  <p class="small muted">
    Thinking effort is shared wherever a model is used. You can also change it for a single run.
  </p>
  {#if editing === null}<div class="picker-settings-actions">
      <button
        class="text-button small"
        onclick={() =>
          change((p) => {
            p.models = [...defaultModels];
            p.writer = defaultModels[0];
            p.modelMode = 'individual';
          })}>Restore default models</button
      >
    </div>{/if}
{/if}
{#if editing !== null && custom}<p class="stage-model-save-note" role="status">
    This model selection applies only to {stages[Number(editing)]}.
  </p>{/if}
