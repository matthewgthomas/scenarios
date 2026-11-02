<script lang="ts">
  import { ArrowRight, Zap, LockKeyhole, Settings2 } from '@lucide/svelte';
  import { complete, id, flagDownstream, type Project, type Change } from '$lib/domain/project';
  let {
    p,
    change,
    settings,
    next
  }: { p: Project; change: Change; settings: () => void; next: () => void } = $props();
  let preliminary = $state('');
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
    <p>A little context is enough. You’ll shape the drivers, hypotheses and scenarios as you go.</p>
  </div>
</div>
<div class="setup-layout">
  <section class="setup-form">
    <label
      >Exercise name<input
        value={p.title}
        oninput={(e) => field('title', e.currentTarget.value || 'Untitled exercise')}
        placeholder="Give this exercise a short name"
      /></label
    ><label
      >Your analytical question<textarea
        rows="4"
        value={p.question}
        oninput={(e) => field('question', e.currentTarget.value)}
        placeholder="How might… evolve, and what could that mean for people affected?"
      ></textarea><small class="muted"
        >Frame an open question about change, rather than asking for a prediction.</small
      ></label
    ><label
      >Time horizon and geography<input
        value={p.horizon}
        oninput={(e) => field('horizon', e.currentTarget.value)}
        placeholder="For example, United Kingdom, 2026–2029"
      /></label
    >
    <details>
      <summary>Add preliminary drivers (optional)</summary><label class="spaced"
        >One driver per line<textarea
          rows="4"
          bind:value={preliminary}
          placeholder="Energy costs&#10;Government support"></textarea></label
      >
      <p class="small muted">Your own drivers are preserved alongside model contributions.</p>
    </details>
  </section>
  <aside class="setup-aside">
    <div class="mode-panel">
      <Zap size={24} />
      <h2>Quick Mode</h2>
      <p>
        Explore futures using the AI models’ existing knowledge. No external searches or invented
        citations.
      </p>
      <span class="badge">Designed for a faster, focused working session</span>
    </div>
    <div class="setup-note">
      <h3>Choose which AI models to use.</h3>
      <p>
        Models propose ideas independently. You review their reasoning and decide what to keep at every
        stage.
      </p>
      <button class="secondary" onclick={settings}><Settings2 size={16} /> Models & budget</button>
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
    <strong>You lead the analysis.</strong><small
      >You choose if and when to involve AI models.</small
    >
  </div>
  <button class="primary" disabled={!p.question.trim() || !p.horizon.trim()} onclick={start}
    >Explore drivers <ArrowRight size={16} /></button
  >
</footer>
