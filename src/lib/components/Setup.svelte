<script lang="ts">
  import { showModeLabels } from '$lib/config/presentation';
  import { ArrowRight, Zap, LockKeyhole, Settings2 } from '@lucide/svelte';
  import { complete, id, flagDownstream, type Project, type Change } from '$lib/domain/project';
  import StageGuide from './StageGuide.svelte';
  let {
    p,
    change,
    settings,
    next
  }: { p: Project; change: Change; settings: () => void; next: () => void } = $props();
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
  function start() {
    change((p) => {
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
      p.stage = 1;
    }, 'Exercise configured.');
    preliminary = '';
  }
</script>

<div class="stage-heading">
  <div>
    <h1>Start with a question worth exploring.</h1>
    <p>You’ll shape the drivers of change, hypotheses and scenarios as you go.</p>
  </div>
</div>
<StageGuide
  title={ready ? 'You are ready to explore drivers of change' : `${detailsReady} of 2 essential details added`}
  description="Add a guiding analytical question, a time horizon and geography. Everything else can take shape as you explore."
  {ready}
>
  {#snippet help()}<p>
      Try “How might financial hardship change over the next three years, and what could that mean
      for households struggling to meet essential costs?” A good question leaves room for several
      plausible answers.
    </p>{/snippet}
</StageGuide>
<div class="setup-layout">
  <section class="setup-form">
    <label
      >Analysis name<input
        value={p.title}
        oninput={(e) => field('title', e.currentTarget.value || 'Untitled analysis')}
        placeholder="Give this analysis a short name"
      /></label
    ><label
      >Your analytical question <small class="muted">Required</small><textarea
        id="setup-question"
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
        value={p.horizon}
        oninput={(e) => field('horizon', e.currentTarget.value)}
        placeholder="For example, United Kingdom, 2026–2029"
      /></label
    >
    <details>
      <summary>Add preliminary drivers of change (optional)</summary><label class="spaced"
        >One driver per line<textarea
          rows="4"
          bind:value={preliminary}
          placeholder="Energy costs&#10;Government support"></textarea></label
      >
      <p class="small muted">Your own drivers of change are preserved alongside those contributed by AI models.</p>
    </details>
  </section>
  <aside class="setup-aside">
    {#if showModeLabels}<div class="mode-panel">
        <Zap size={24} />
        <h2>Quick Mode</h2>
        <p>
          Explore futures using the AI models’ existing knowledge. No external searches or invented
          citations.
        </p>
        <span class="badge">Designed for a faster, focused working session</span>
      </div>
    {/if}
    <div class="setup-note">
      <h3>AI help, when you want it.</h3>
      <p>
        You choose when to involve AI models in the scenario design process, if at all. 
        You can complete the entire process without any AI input if you prefer.
      </p>
      <p>
        Models propose ideas independently. You review their reasoning and decide what to keep at every stage.
        Click the button below to configure AI models and budget. Model setup can wait until you want AI help.
      </p>
      <button class="secondary" onclick={settings}><Settings2 size={16} /> AI models & budget</button>
    </div>
  </aside>
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
<footer class="stage-footer">
  <div>
    <strong>{ready ? 'Analytical framing complete.' : 'Start by articulating your overall question'}</strong><small
      >{ready
        ? 'Next, explore the forces that could shape this future.'
        : !p.question.trim()
          ? 'Add your analytical question to get started.'
          : 'Add a time horizon and geography to give your analysis a boundary.'}</small
    >
  </div>
  <button class="primary" onclick={ready ? start : fillNext}
    >{ready
      ? 'Explore drivers of change'
      : !p.question.trim()
        ? 'Add your question'
        : 'Add time horizon & place'}
    <ArrowRight size={16} /></button
  >
</footer>
