<script lang="ts">
  import { selectionMode } from '$lib/domain/model-settings';
  import { showModeLabels } from '$lib/config/presentation';
  import { ArrowRight, Zap, LockKeyhole } from '@lucide/svelte';
  import {
    complete,
    id,
    flagDownstream,
    MODEL_SETUP_STAGE,
    type Project,
    type Change
  } from '$lib/domain/project';
  import { skipModelSetup } from '$lib/domain/workflow';
  import StageGuide from './StageGuide.svelte';
  let { p, change }: { p: Project; change: Change } = $props();
  let preliminary = $state('');
  const ready = $derived(Boolean(p.question.trim() && p.horizon.trim()));
  const detailsReady = $derived(
    Number(Boolean(p.question.trim())) + Number(Boolean(p.horizon.trim()))
  );
  function fillNext() {
    document.getElementById(p.question.trim() ? 'setup-horizon' : 'setup-question')?.focus();
  }
  function field(key: 'title' | 'question' | 'horizon', value: string) {
    change((p) => {
      p[key] = value;
      if (key !== 'title' && p.completed.includes(0))
        flagDownstream(
          p,
          0,
          'The question or horizon changed. Review earlier judgements against the new context.'
        );
    });
  }
  function start(manual = false) {
    if (!ready) return;
    change(
      (p) => {
        preliminary
          .split('\n')
          .map((t) => t.trim())
          .filter(Boolean)
          .forEach((title) =>
            p.drivers.push({
              id: id('driver'),
              title,
              summary: '',
              tags: [],
              origin: 'user',
              origins: [],
              revision: 1,
              approved: false,
              selected: false,
              archived: false,
              ratings: []
            })
          );
        complete(p, 0);
        if (manual) skipModelSetup(p);
        else p.stage = MODEL_SETUP_STAGE;
      },
      manual ? 'Exercise configured. Continuing manually without AI setup.' : 'Exercise configured.'
    );
    preliminary = '';
  }
</script>

<div class="stage-heading">
  <div>
    <h1 data-walkthrough="stage-heading">Start with a question worth exploring.</h1>
    <p>You’ll shape the drivers of change, hypotheses and scenarios as you go.</p>
  </div>
</div>
<StageGuide
  title={ready
    ? 'You are ready to continue manually or set up AI help'
    : `${detailsReady} of 2 essential details added`}
  description="Add a guiding analytical question, a time horizon and geography. Everything else can take shape as you explore."
  {ready}
>
  {#snippet help()}<p>
      Try “How might financial hardship change over the next three years, and what could that mean
      for households struggling to meet essential costs?” A good question leaves room for several
      plausible answers.
    </p>{/snippet}
</StageGuide>
<div class="setup-layout" class:setup-layout-single={!showModeLabels}>
  <section class="setup-form">
    <label
      >Analysis name<input
        data-walkthrough="analysis-name"
        value={p.title}
        oninput={(e) => field('title', e.currentTarget.value || 'Untitled analysis')}
        placeholder="Give this analysis a short name"
      /></label
    ><label
      >Your analytical question <small class="muted">Required</small><textarea
        id="setup-question"
        data-walkthrough="analysis-question"
        rows="4"
        value={p.question}
        oninput={(e) => field('question', e.currentTarget.value)}
        placeholder="How might… evolve, and what could that mean for people affected?"
      ></textarea><small class="muted"
        >Frame an open question about change, rather than asking for a prediction.</small
      ></label
    ><label
      >Time horizon and geography <small class="muted">Required</small><input
        id="setup-horizon"
        data-walkthrough="analysis-horizon"
        value={p.horizon}
        oninput={(e) => field('horizon', e.currentTarget.value)}
        placeholder="For example, United Kingdom, 2026–2029"
      /></label
    >
    <details class="research-context">
      <summary>Research and background assumptions (optional)</summary>
      <label class="spaced"
        >Desk review and consultation notes<textarea
          rows="4"
          value={p.researchNotes ?? ''}
          oninput={(e) =>
            change((p) => {
              p.researchNotes = e.currentTarget.value;
            })}
          placeholder="Key findings, source links, consultation dates and disagreements to carry through the analysis."
        ></textarea></label
      >
      <label class="spaced"
        >Background assumptions<textarea
          rows="4"
          value={p.backgroundAssumptions ?? ''}
          oninput={(e) => {
            const value = e.currentTarget.value;
            change((p) => {
              p.backgroundAssumptions = value;
              flagDownstream(
                p,
                0,
                'Background assumptions changed. Review scenarios against the updated context.'
              );
            });
          }}
          placeholder="What do you expect to remain relatively stable? Which important, predictable drivers underpin all scenarios?"
        ></textarea></label
      >
      <p class="small muted">
        Unselected drivers stay in your analytical record. They do not automatically become
        assumptions: record the ones that underpin every scenario here. These notes are included in
        the analytical export.
      </p>
    </details>
    <details>
      <summary data-walkthrough="analysis-drivers"
        >Add preliminary drivers of change (optional)</summary
      ><label class="spaced"
        >One driver per line<textarea
          rows="4"
          bind:value={preliminary}
          placeholder="Energy costs&#10;Government support"></textarea></label
      >
      <p class="small muted">
        Your own drivers of change are preserved alongside those contributed by AI models.
      </p>
    </details>
  </section>
  {#if showModeLabels}<aside class="setup-aside">
      <div class="mode-panel">
        <Zap size={24} />
        <h2>Quick Mode</h2>
        <p>
          {selectionMode(p) === 'fusion'
            ? 'Fusion combines a model panel and may research the web. Review every suggestion before keeping it.'
            : 'Explore futures using the AI models’ existing knowledge. No external searches or invented citations.'}
        </p>
        <span class="badge">Designed for a faster, focused working session</span>
      </div>
    </aside>{/if}
</div>
<div class="privacy-notice">
  <LockKeyhole size={20} />
  <div>
    <strong>Use publicly shareable, non-sensitive information only.</strong>
    <p>
      No personal data, confidential operational details or sensitive security assessments. Model
      requests send your analysis through OpenRouter to your selected providers. Projects are saved
      in this browser; this is not confidential storage.
    </p>
  </div>
</div>
<footer class="stage-footer" data-walkthrough="stage-complete">
  <div>
    <strong
      >{ready
        ? 'Analytical framing complete.'
        : 'Start by articulating your overall question'}</strong
    ><small
      >{ready
        ? 'Continue manually without an account, models or budget, or set up optional AI help.'
        : !p.question.trim()
          ? 'Add your analytical question to get started.'
          : 'Add a time horizon and geography to give your analysis a boundary.'}</small
    >
  </div>
  <div class="toolbar-group">
    {#if ready}<button
        data-walkthrough="analysis-manual"
        class="secondary"
        onclick={() => start(true)}>Continue manually <ArrowRight size={16} /></button
      >{/if}
    <button class="primary" onclick={() => (ready ? start() : fillNext())}
      >{ready
        ? 'Continue to models and budget'
        : !p.question.trim()
          ? 'Add your question'
          : 'Add time horizon & place'}
      <ArrowRight size={16} /></button
    >
  </div>
</footer>
