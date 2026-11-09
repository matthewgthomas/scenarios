<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { HelpCircle } from '@lucide/svelte';
  import { driver, type Driver, type PopoverDOM } from 'driver.js';
  import 'driver.js/dist/driver.css';
  import { preference } from '$lib/storage/projects';
  import {
    WALKTHROUGH_PREFERENCE,
    readWalkthroughPreferences,
    shouldShowWalkthrough,
    walkthroughSteps,
    type WalkthroughId
  } from '$lib/walkthroughs';

  let {
    page,
    pageKey,
    ready,
    blocked = null
  }: {
    page: WalkthroughId;
    pageKey: string;
    ready: boolean;
    blocked?: string | null;
  } = $props();
  let launcher: HTMLButtonElement;
  let preferences = readWalkthroughPreferences();
  let preferencesReady = $state(false);
  let storageWarning = $state('');
  let warningElement: HTMLElement | undefined;
  let tour: Driver | undefined;
  let mounted = false;
  let frame = 0;
  let generation = 0;
  let suppressFocus = false;
  let focusGeneration = 0;
  let writes: Promise<unknown> = Promise.resolve();

  const dialogOpen = () => Boolean(document.querySelector('dialog[open]'));

  function warn() {
    storageWarning =
      'Your walkthrough choices could not be saved on this device. They will apply until you reload.';
    if (warningElement) {
      warningElement.textContent = storageWarning;
      warningElement.hidden = false;
      tour?.refresh();
    }
  }

  function savePreferences() {
    const snapshot = JSON.stringify(preferences);
    // Serialize writes so a slow seen-page write cannot undo a later opt-out.
    writes = writes
      .catch(() => {})
      .then(() => preference(WALKTHROUGH_PREFERENCE, snapshot))
      .then(() => {
        storageWarning = '';
        if (warningElement) warningElement.hidden = true;
      })
      .catch(warn);
  }

  function stop(restoreFocus = false) {
    focusGeneration++;
    suppressFocus = true;
    tour?.destroy();
    tour = undefined;
    warningElement = undefined;
    suppressFocus = false;
    if (restoreFocus && launcher?.isConnected) launcher.focus({ preventScroll: true });
  }

  function renderControls(popover: PopoverDOM) {
    const options = document.createElement('div');
    options.className = 'walkthrough-options';
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !preferences.automatic;
    checkbox.addEventListener('change', () => {
      preferences = { ...preferences, automatic: !checkbox.checked };
      savePreferences();
    });
    label.append(checkbox, document.createTextNode('Don’t show walkthroughs automatically'));
    warningElement = document.createElement('p');
    warningElement.className = 'walkthrough-storage-warning';
    warningElement.setAttribute('role', 'status');
    warningElement.textContent = storageWarning;
    warningElement.hidden = !storageWarning;
    options.append(label, warningElement);
    popover.wrapper.insertBefore(options, popover.footer);
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'walkthrough-skip';
    skip.textContent = 'Skip tour';
    skip.addEventListener('click', () => tour?.destroy());
    popover.footer.prepend(skip);
    // Keep the arrow and close control outside the scrolling content at high zoom.
    const content = document.createElement('div');
    content.className = 'walkthrough-content';
    content.append(popover.title, popover.description, options, popover.footer);
    popover.wrapper.append(content);
  }

  function start() {
    if (!ready || !preferencesReady || dialogOpen()) return;
    stop();
    const startedOn = pageKey;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const steps = walkthroughSteps(page, blocked);
    tour = driver({
      animate: !reducedMotion,
      duration: 180,
      smoothScroll: false,
      allowClose: true,
      allowKeyboardControl: true,
      disableActiveInteraction: true,
      overlayClickBehavior: 'none',
      overlayColor: '#142d23',
      overlayOpacity: 0.65,
      stagePadding: 6,
      stageRadius: 8,
      popoverClass: 'page-walkthrough',
      showProgress: true,
      progressText: 'Step {{current}} of {{total}}',
      prevBtnText: 'Back',
      nextBtnText: 'Next',
      doneBtnText: 'Done',
      closeBtnLabel: 'Close page walkthrough',
      onHighlighted: (element, _step, { driver: current, signal }) => {
        requestAnimationFrame(() => {
          if (!mounted || signal?.aborted || !current.isActive() || !element) return;
          revealTarget(element);
          current.refresh();
        });
      },
      steps: steps.map((step) => ({
        // Resolve visible targets at start; absent targets retain their instructions.
        element: step.target ? visibleTarget(step.target) : undefined,
        popover: {
          // Set textContent below: even a prerequisite containing user text stays plain text.
          title: 'Page walkthrough',
          description: 'Page instructions',
          side: 'bottom',
          align: 'start',
          onPopoverRender: (popover) => {
            popover.title.textContent = step.title;
            popover.description.textContent = step.description;
            renderControls(popover);
          }
        }
      })),
      onDestroyed: () => {
        tour = undefined;
        warningElement = undefined;
        const ticket = focusGeneration;
        if (suppressFocus) return;
        // Driver restores its own focus after this hook; restore to our stable launcher last.
        queueMicrotask(() => {
          if (mounted && ticket === focusGeneration && startedOn === pageKey && !dialogOpen())
            launcher?.focus({ preventScroll: true });
        });
      }
    });
    tour.drive();
    if (tour?.isActive() && !blocked && !preferences.seen.includes(page)) {
      preferences = { ...preferences, seen: [...preferences.seen, page] };
      savePreferences();
    }
  }

  function visibleTarget(name: string): Element | undefined {
    return [...document.querySelectorAll(`[data-walkthrough="${name}"]`)]
      .map((element) => {
        if (name === 'stage-complete') return element.querySelector('.primary') ?? element;
        if (name === 'uncertainty-choices')
          return element.querySelector('input[type="checkbox"]') ?? element;
        return element;
      })
      .find((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden'
        );
      });
  }

  function revealTarget(element: Element) {
    // Driver knows the viewport, but not our wrapping sticky header and action bar.
    const header = document.querySelector('.topbar');
    let top = Math.max(0, header?.getBoundingClientRect().bottom ?? 0);
    const actions = document.querySelector('.stage-actions');
    if (
      actions &&
      !actions.contains(element) &&
      actions.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING
    )
      top += actions.getBoundingClientRect().height;
    let bottom = innerHeight;
    const footer = document.querySelector('footer.stage-footer, footer.hypothesis-completion');
    if (
      footer &&
      !footer.contains(element) &&
      ['sticky', 'fixed'].includes(getComputedStyle(footer).position)
    )
      bottom = Math.min(bottom, footer.getBoundingClientRect().top);
    const rect = element.getBoundingClientRect();
    if (rect.top < top + 12 || rect.bottom > bottom - 12) {
      const destination = top + 12 + Math.max(0, (bottom - top - 24 - rect.height) / 2);
      window.scrollBy({ top: rect.top - destination, behavior: 'instant' });
    }
  }

  function queueAutomatic() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!mounted || tour?.isActive()) return;
      if (
        shouldShowWalkthrough(
          preferences,
          page,
          ready && preferencesReady,
          Boolean(blocked),
          dialogOpen()
        )
      )
        start();
    });
  }

  $effect(() => {
    // Only navigation/readiness changes restart scheduling, never preference writes or typing.
    const identity = pageKey;
    const available = ready && preferencesReady;
    const prerequisite = blocked;
    const ticket = ++generation;
    void tick().then(() => {
      if (ticket === generation && identity === pageKey && available && !prerequisite)
        queueAutomatic();
    });
    return () => {
      generation++;
      cancelAnimationFrame(frame);
      const wasActive = tour?.isActive();
      stop();
      if (wasActive)
        void tick().then(() => {
          if (!mounted || dialogOpen() || tour?.isActive()) return;
          const heading = document.querySelector<HTMLElement>('#main h1');
          heading?.setAttribute('tabindex', '-1');
          heading?.focus({ preventScroll: true });
        });
    };
  });

  onMount(() => {
    mounted = true;
    void preference(WALKTHROUGH_PREFERENCE)
      .then((value) => {
        if (mounted) preferences = readWalkthroughPreferences(value);
      })
      .catch(() => {
        if (mounted) warn();
      })
      .finally(() => {
        if (mounted) preferencesReady = true;
      });
    const beforeDialog = () => {
      if (tour?.isActive()) stop(true);
    };
    document.addEventListener('walkthrough:before-dialog', beforeDialog);
    const observer = new MutationObserver(() => {
      if (dialogOpen()) {
        if (tour?.isActive()) stop();
      } else queueAutomatic();
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['open']
    });
    return () => {
      mounted = false;
      generation++;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('walkthrough:before-dialog', beforeDialog);
      stop();
    };
  });
</script>

<button
  bind:this={launcher}
  class="secondary walkthrough-launcher"
  data-walkthrough="walkthrough-launcher"
  disabled={!ready || !preferencesReady}
  onclick={start}><HelpCircle size={18} aria-hidden="true" /><span>Page walkthrough</span></button
>
<span class="sr-only" role="status">{storageWarning}</span>
