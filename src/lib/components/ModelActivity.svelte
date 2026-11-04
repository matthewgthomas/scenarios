<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import {
    Cpu,
    LoaderCircle,
    Clock,
    CircleCheck,
    CircleAlert,
    CircleMinus,
    ChevronDown,
    X,
    Trash2,
    ArrowUpRight
  } from '@lucide/svelte';
  import { modelName, stages, type Run } from '$lib/domain/project';
  import { preference } from '$lib/storage/projects';
  import {
    activityPreferenceKey,
    activityTransitions,
    dismissActivityHistory,
    markActivityRead,
    operationOutcome,
    parseActivityPreferences,
    summarizeActivity,
    type ActivityPreferences
  } from '$lib/ai/model-activity';

  let {
    exerciseId,
    runs,
    busy,
    onCancel,
    onViewDetails
  }: {
    exerciseId: string;
    runs: Run[];
    busy: boolean;
    onCancel: () => void;
    onViewDetails: (run: Run) => void;
  } = $props();

  const uid = $props.id();
  const panelId = `${uid}-model-activity`;
  const tasks: Record<Run['task'], string> = {
    drivers: 'Generate drivers',
    ratings: 'Assess drivers',
    hypotheses: 'Generate hypotheses',
    chains: 'Generate chains',
    coherence: 'Check coherence',
    narrative: 'Draft narrative',
    narrative_edit: 'Edit narrative',
    consolidate: 'Suggest merges'
  };
  const statuses: Record<Run['status'], string> = {
    queued: 'Queued',
    running: 'Running',
    succeeded: 'Succeeded',
    failed: 'Failed',
    cancelled: 'Cancelled',
    skipped: 'Skipped'
  };
  let trigger: HTMLButtonElement;
  let panel: HTMLDivElement;
  let open = $state(false);
  let ready = $state(false);
  let preferences = $state<ActivityPreferences>({ read: [], dismissed: [] });
  let storageError = $state('');
  let announcement = $state('');
  let cancelling = $state(false);
  let feedback = $state<{ id: number; kind: string } | null>(null);
  let feedbackId = 0;
  let feedbackTimer: ReturnType<typeof setTimeout>;
  let previous: Map<string, Run['status']> | null = null;
  let alive = true;
  let writes: Promise<unknown> = Promise.resolve();
  const activity = $derived(summarizeActivity(runs, preferences));
  const signature = $derived(runs.map((run) => `${run.id}:${run.status}`).join('|'));
  const outcomeText = {
    succeeded: 'Completed',
    failed: 'Completed with errors',
    cancelled: 'Cancelled',
    skipped: 'Skipped'
  };
  const status = $derived(
    activity.active.length
      ? [
          activity.running ? `${activity.running} running` : '',
          activity.queued ? `${activity.queued} queued` : ''
        ]
          .filter(Boolean)
          .join(' · ')
      : activity.latestOutcome
        ? outcomeText[activity.latestOutcome]
        : 'Idle'
  );
  const StatusIcon = $derived(
    activity.running
      ? LoaderCircle
      : activity.queued
        ? Clock
        : activity.latestOutcome === 'failed'
          ? CircleAlert
          : activity.latestOutcome === 'succeeded'
            ? CircleCheck
            : activity.latestOutcome
              ? CircleMinus
              : Cpu
  );

  function savePreferences(next: ActivityPreferences) {
    preferences = next;
    const value = JSON.stringify(next);
    const key = activityPreferenceKey(exerciseId);
    writes = writes
      .catch(() => {})
      .then(() => preference(key, value))
      .then(() => {
        if (alive) storageError = '';
      })
      .catch(() => {
        if (alive)
          storageError =
            'Activity history changes could not be remembered on this device. They may return after reload.';
      });
  }

  function positionPanel() {
    if (!open || !trigger || !panel) return;
    const anchor = trigger.getBoundingClientRect();
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    const offsetLeft = viewport?.offsetLeft ?? 0;
    const offsetTop = viewport?.offsetTop ?? 0;
    const gap = 8;
    const below = height + offsetTop - anchor.bottom - gap - 12;
    const above = anchor.top - offsetTop - gap - 12;
    const useAbove = below < 220 && above > below;
    panel.style.width = `${Math.min(440, width - 24)}px`;
    panel.style.maxHeight = `${Math.max(100, Math.min(640, useAbove ? above : below))}px`;
    panel.style.left = `${Math.max(offsetLeft + 12, Math.min(anchor.right - panel.offsetWidth, offsetLeft + width - panel.offsetWidth - 12))}px`;
    panel.style.top = `${Math.max(offsetTop + 12, useAbove ? anchor.top - gap - panel.offsetHeight : anchor.bottom + gap)}px`;
  }

  function close() {
    panel.hidePopover();
  }

  function toggle(event: Event) {
    open = (event as ToggleEvent).newState === 'open';
    if (open)
      void tick().then(() => {
        if (!open) return;
        panel.scrollTop = 0;
        positionPanel();
        panel.focus({ preventScroll: true });
      });
  }

  function clearHistory() {
    savePreferences(dismissActivityHistory(preferences, runs));
    announcement = 'Activity history cleared. Model records and spending totals are preserved.';
    void tick().then(() => {
      panel.scrollTop = 0;
      panel.focus({ preventScroll: true });
      positionPanel();
    });
  }

  function time(at: string) {
    const date = new Date(at);
    return Number.isNaN(date.getTime())
      ? at
      : date.toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
  }

  $effect(() => {
    signature;
    untrack(() => {
      const current = new Map(runs.map((run) => [run.id, run.status]));
      if (previous) {
        const changes = activityTransitions(previous, runs);
        if (changes.started || changes.finished.length) {
          const operationIds = new Set(changes.finished.map((run) => run.operationId));
          const operationRuns = runs.filter((run) => operationIds.has(run.operationId));
          const kind = changes.stopped
            ? operationOutcome(operationRuns)
            : changes.finished.some((run) => run.status === 'failed')
              ? 'failed'
              : changes.started
                ? 'started'
                : changes.finished.some((run) => run.status === 'cancelled')
                  ? 'cancelled'
                  : 'succeeded';
          feedback = { id: ++feedbackId, kind };
          clearTimeout(feedbackTimer);
          feedbackTimer = setTimeout(() => (feedback = null), 900);
          if (changes.started)
            announcement =
              'Model operation started. Open Model activity in the top bar for progress.';
          else if (changes.stopped) {
            announcement = `Model operation finished. ${operationRuns.filter((run) => run.status === 'succeeded').length} succeeded, ${operationRuns.filter((run) => run.status === 'failed').length} failed, ${operationRuns.filter((run) => run.status === 'cancelled').length} cancelled.`;
          } else
            announcement = changes.finished
              .map((run) => `${modelName(run.modelId)}: ${statuses[run.status].toLowerCase()}.`)
              .join(' ');
        }
      }
      previous = current;
      if (open) void tick().then(positionPanel);
    });
  });

  $effect(() => {
    if (ready && open) {
      const next = markActivityRead(preferences, runs);
      if (next !== preferences) savePreferences(next);
    }
  });

  $effect(() => {
    if (!busy) cancelling = false;
  });

  onMount(() => {
    const key = activityPreferenceKey(exerciseId);
    void preference(key)
      .then((value) => {
        if (alive) preferences = parseActivityPreferences(value);
      })
      .catch(() => {
        if (alive)
          storageError =
            'Activity history preferences could not be loaded. Changes may not be remembered on this device.';
      })
      .finally(() => {
        if (alive) ready = true;
      });
    const observer = new ResizeObserver(positionPanel);
    observer.observe(trigger);
    window.addEventListener('resize', positionPanel);
    window.addEventListener('scroll', positionPanel, { capture: true, passive: true });
    window.visualViewport?.addEventListener('resize', positionPanel);
    window.visualViewport?.addEventListener('scroll', positionPanel);
    return () => {
      alive = false;
      clearTimeout(feedbackTimer);
      observer.disconnect();
      window.removeEventListener('resize', positionPanel);
      window.removeEventListener('scroll', positionPanel, true);
      window.visualViewport?.removeEventListener('resize', positionPanel);
      window.visualViewport?.removeEventListener('scroll', positionPanel);
    };
  });
</script>

<button
  bind:this={trigger}
  class="model-activity-trigger"
  class:activity-has-errors={activity.unreadFailures > 0}
  class:activity-is-active={activity.active.length > 0}
  popovertarget={panelId}
  aria-haspopup="dialog"
  aria-controls={panelId}
  aria-expanded={open}
  aria-label={`AI model activity: ${status}${ready && activity.unread ? `, ${activity.unread} unread updates${activity.unreadFailures ? `, ${activity.unreadFailures} failed` : ''}` : ''}. View model status details`}
  title="View model status details"
>
  {#if feedback}{#key feedback.id}<span
        class="activity-feedback feedback-{feedback.kind}"
        aria-hidden="true"
      ></span>{/key}{/if}
  <span
    class="activity-status-icon"
    class:activity-spinning={activity.running > 0}
    class:activity-pulsing={!activity.running && activity.queued > 0}
    aria-hidden="true"><StatusIcon size={19} /></span
  >
  <span class="activity-trigger-copy"
    ><strong>AI model activity</strong><small>{status}</small></span
  >
  {#if ready && activity.unread}<span
      class="activity-unread"
      class:activity-unread-error={activity.unreadFailures > 0}
      aria-hidden="true"
      >{#if activity.unreadFailures}<CircleAlert size={12} />{/if}{activity.unread}</span
    >{/if}
  <ChevronDown size={14} aria-hidden="true" />
</button>

<div
  bind:this={panel}
  id={panelId}
  class="model-activity-panel"
  popover="auto"
  role="dialog"
  aria-labelledby={`${uid}-title`}
  tabindex="-1"
  ontoggle={toggle}
>
  <div class="activity-panel-heading">
    <div>
      <h2 id={`${uid}-title`}>Model activity</h2>
      <p>Requests across this exercise</p>
    </div>
    <button class="icon-button" aria-label="Close model activity" onclick={close}
      ><X size={18} /></button
    >
  </div>
  <div class="activity-panel-body">
    {#if !ready}<p class="small muted">Loading activity history…</p>{/if}
    {#if storageError}<p class="activity-storage-error" role="status">{storageError}</p>{/if}
    <section class="activity-section" aria-labelledby={`${uid}-progress`}>
      <h3 id={`${uid}-progress`}>In progress <span>{activity.active.length}</span></h3>
      {#if activity.active.length}
        <ul class="activity-requests">
          {#each activity.active as run (run.id)}<li>{@render requestRow(run)}</li>{/each}
        </ul>
      {:else}<p class="activity-empty">No model requests running or queued.</p>{/if}
      {#if busy}<div class="activity-cancel">
          <button
            class="secondary"
            disabled={cancelling}
            onclick={() => {
              cancelling = true;
              onCancel();
            }}>{cancelling ? 'Cancelling…' : 'Cancel queued work'}</button
          >
          <p>Dispatched requests may still be billed. Cancellation cannot guarantee refunds.</p>
        </div>{/if}
    </section>
    <section class="activity-section" aria-labelledby={`${uid}-history`}>
      <div class="activity-history-heading">
        <h3 id={`${uid}-history`}>History</h3>
        <button
          class="text-button"
          disabled={!ready || !activity.history.length}
          onclick={clearHistory}><Trash2 size={14} />Clear history</button
        >
      </div>
      <p class="activity-history-note">
        Clearing hides finished activity here. Full model records and spending totals are kept.
      </p>
      {#if activity.history.length}
        {#each activity.history as group (group.id)}
          <div class="activity-operation">
            <div class="activity-operation-heading">
              <h4>{tasks[group.runs[0].task]}</h4>
              <time datetime={group.at}>{time(group.at)}</time>
            </div>
            <p class="activity-operation-summary">
              {group.runs.length}
              {group.runs.length === 1 ? 'finished request' : 'finished requests'} · {outcomeText[
                operationOutcome(group.runs)
              ]}
            </p>
            <ul class="activity-requests">
              {#each group.runs as run (run.id)}<li>{@render requestRow(run)}</li>{/each}
            </ul>
          </div>
        {/each}
      {:else}<p class="activity-empty">
          No finished activity to show. New results will appear here.
        </p>{/if}
    </section>
  </div>
</div>

{#snippet requestRow(run: Run)}
  <div class="activity-request-heading">
    <strong>{modelName(run.modelId)}</strong><span class="activity-run-status status-{run.status}"
      >{#if run.status === 'failed'}<CircleAlert
          size={13}
        />{:else if run.status === 'succeeded'}<CircleCheck
          size={13}
        />{:else if run.status === 'running'}<LoaderCircle
          size={13}
          class="activity-spinning"
        />{:else if run.status === 'queued'}<Clock size={13} />{:else}<CircleMinus
          size={13}
        />{/if}{statuses[run.status]}</span
    >
  </div>
  <p class="activity-request-context">
    {tasks[run.task]} · {stages[run.stage]}{#if run.batchIndex}<br />Batch {run.batchIndex} of {run.batchCount}{/if}
  </p>
  {#if run.error}<p class="activity-request-error">{run.error}</p>{/if}
  <a
    class="activity-details-link"
    href={`#run-${run.id}`}
    onclick={(event) => {
      event.preventDefault();
      close();
      onViewDetails(run);
    }}
    aria-label={`View details for ${modelName(run.modelId)}, ${tasks[run.task]}${run.batchIndex ? `, batch ${run.batchIndex}` : ''}`}
    >View details <ArrowUpRight size={13} aria-hidden="true" /></a
  >
{/snippet}

<div class="sr-only" role="status" aria-live="polite">{announcement}</div>
