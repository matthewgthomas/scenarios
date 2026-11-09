<script lang="ts">
  import { onMount } from 'svelte';
  import Modal from './Modal.svelte';
  import Roadmap from './Roadmap.svelte';

  let { close }: { close: () => void } = $props();
  const tabs = [
    { id: 'how', label: 'How Scenario Designer works' },
    { id: 'about', label: 'About' },
    { id: 'roadmap', label: 'Roadmap' }
  ];
  let activeTab = $state('how');
  let elapsedTime = $state('');

  onMount(() => {
    const today = new Date();
    const totalMonths = Math.max(0, (today.getFullYear() - 2023) * 12 + today.getMonth() - 7);
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    elapsedTime = `${years} ${years === 1 ? 'year' : 'years'} and ${months} ${months === 1 ? 'month' : 'months'}`;
  });

  function navigateTabs(event: KeyboardEvent, index: number) {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;

    event.preventDefault();
    activeTab = tabs[next].id;
    const button = event.currentTarget as HTMLButtonElement;
    button.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }
</script>

<Modal title="How it works" {close}>
  <div class="settings-tabs help-tabs" role="tablist" aria-label="About Scenario Designer">
    {#each tabs as tab, index}
      <button
        id={`help-tab-${tab.id}`}
        role="tab"
        class:active={activeTab === tab.id}
        aria-selected={activeTab === tab.id}
        aria-controls={`help-panel-${tab.id}`}
        tabindex={activeTab === tab.id ? 0 : -1}
        onclick={() => (activeTab = tab.id)}
        onkeydown={(event) => navigateTabs(event, index)}>{tab.label}</button
      >
    {/each}
  </div>

  <div
    id="help-panel-how"
    class="help-panel"
    role="tabpanel"
    aria-labelledby="help-tab-how"
    tabindex="0"
    hidden={activeTab !== 'how'}
  >
    <p>
      At its best, foresight brings together <a
        href="https://www.forumforthefuture.org/what-does-it-mean-to-decolonize-the-future"
        target="_blank"
        rel="noopener noreferrer">diverse voices and perspectives</a
      > to imagine ‘what if’.
    </p>
    <p>So what if we included artificial intelligence (AI) alongside these voices?</p>
    <p>
      This app uses an AI-augmented version of <a
        href="https://www.iaran.org/strategic-planning"
        target="_blank"
        rel="noopener noreferrer">IARAN’s approach to strategic foresight</a
      > to design scenarios. It will guide you through:
    </p>
    <ul class="how-it-works">
      <li>Identifying the drivers of change in the system you’re analysing.</li>
      <li>Judging the impact and uncertainty of the drivers of change.</li>
      <li>Coming up with hypotheses for how drivers of change might evolve in future.</li>
      <li>Connecting these hypotheses into coherent, contrasting 'chains'.</li>
      <li>Writing scenarios from your selection of hypotheses.</li>
    </ul>
    <p>
      At every stage, you can choose to receive inputs from a diversity of AI-generated views. Using
      AI is completely optional. You can complete the entire scenario design process without AI
      assistance if you wish.
    </p>
    <p>
      Human expertise and judgement is vital. We must always check for confidently delivered
      nonsense (from machines as well as humans). But AI models <em>can</em> be helpful for checking our
      own biases, particularly if we are working as individual analysts exploring potential futures.
    </p>
    <p>
      And remember that AI reflects the biases and worldviews of the data that goes into training
      them — which generally excludes the most marginalised and minoritised people — so proceed with
      caution if bringing AI into your foresight practice.
    </p>
  </div>

  <div
    id="help-panel-about"
    class="help-panel"
    role="tabpanel"
    aria-labelledby="help-tab-about"
    tabindex="0"
    hidden={activeTab !== 'about'}
  >
    <p>
      Scenario Designer was built by <a
        href="https://matthewgthomas.co.uk"
        target="_blank"
        rel="noopener noreferrer">Matthew Gwynfryn Thomas</a
      >.
    </p>
    <p>
      In August 2023, Matt <a
        href="https://medium.com/data-and-insight-hub-at-british-red-cross/humans-and-machines-imagining-futures-together-68767ea8c673"
        target="_blank"
        rel="noopener noreferrer">explored how humans and machines</a
      >
      might imagine future scenarios together. He was
      <a
        href="https://solferinoacademy.com/discover-your-ai-pioneer-finalists/"
        target="_blank"
        rel="noopener noreferrer">recognised as an 'AI pioneer'</a
      > by the International Federation of Red Cross and Red Crescent Societies' (IFRC) Solferino Academy
      for this experiment.
    </p>
    <p>
      {elapsedTime} feels like multiple lifetimes in the world of AI. The latest coding agents helped
      Matt turn his early experiment into this app.
    </p>
    <p>
      The code for Scenario Designer is <a
        href="https://github.com/matthewgthomas/scenarios"
        target="_blank"
        rel="noopener noreferrer">available on GitHub</a
      >, published under an MIT license.
    </p>
  </div>

  <div
    id="help-panel-roadmap"
    class="help-panel"
    role="tabpanel"
    aria-labelledby="help-tab-roadmap"
    tabindex="0"
    hidden={activeTab !== 'roadmap'}
  >
    {#if activeTab === 'roadmap'}<Roadmap />{/if}
  </div>

  <p class="small muted help-disclaimer">
    <strong>Disclaimer:</strong> Scenario Designer is not responsible for AI-generated content. You are
    responsible for reviewing and verifying any AI-generated content you use.
  </p>
  <div class="dialog-actions">
    <button class="primary" onclick={close}>Back to the workspace</button>
  </div>
</Modal>
