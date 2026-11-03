import type { Run } from '$lib/domain/project';

export interface ActivityPreferences {
  read: string[];
  dismissed: string[];
}

export const activityPreferenceKey = (exerciseId: string) => `model-activity:${exerciseId}`;
export const isActiveRun = (run: Run) => run.status === 'running' || run.status === 'queued';

export function parseActivityPreferences(value?: string): ActivityPreferences {
  try {
    const parsed = JSON.parse(value ?? '{}');
    const ids = (value: unknown): string[] =>
      Array.isArray(value) ? [...new Set(value.filter((id) => typeof id === 'string'))] : [];
    return { read: ids(parsed?.read), dismissed: ids(parsed?.dismissed) };
  } catch {
    return { read: [], dismissed: [] };
  }
}

export function markActivityRead(
  preferences: ActivityPreferences,
  runs: Run[]
): ActivityPreferences {
  const read = new Set(preferences.read);
  runs.filter((run) => !isActiveRun(run)).forEach((run) => read.add(run.id));
  return read.size === preferences.read.length ? preferences : { ...preferences, read: [...read] };
}

export function dismissActivityHistory(
  preferences: ActivityPreferences,
  runs: Run[]
): ActivityPreferences {
  const finished = runs.filter((run) => !isActiveRun(run)).map((run) => run.id);
  return {
    read: [...new Set([...preferences.read, ...finished])],
    dismissed: [...new Set([...preferences.dismissed, ...finished])]
  };
}

export function operationOutcome(runs: Run[]): 'failed' | 'cancelled' | 'succeeded' | 'skipped' {
  if (runs.some((run) => run.status === 'failed')) return 'failed';
  if (runs.some((run) => run.status === 'cancelled')) return 'cancelled';
  if (runs.some((run) => run.status === 'succeeded')) return 'succeeded';
  return 'skipped';
}

export function summarizeActivity(runs: Run[], preferences: ActivityPreferences) {
  const dismissed = new Set(preferences.dismissed);
  const read = new Set(preferences.read);
  const running = runs.filter((run) => run.status === 'running');
  const queued = runs.filter((run) => run.status === 'queued');
  const finished = runs.filter((run) => !isActiveRun(run) && !dismissed.has(run.id));
  const groups = new Map<string, { id: string; at: string; runs: Run[] }>();
  // Reverse first so equal timestamps still put the newest dispatched request first.
  for (const run of finished.slice().reverse()) {
    const at = run.finishedAt ?? run.at;
    const group = groups.get(run.operationId);
    if (group) {
      group.runs.push(run);
      if (at > group.at) group.at = at;
    } else groups.set(run.operationId, { id: run.operationId, at, runs: [run] });
  }
  const history = [...groups.values()].sort((a, b) => b.at.localeCompare(a.at));
  const unread = finished.filter((run) => !read.has(run.id));
  const active = [...running, ...queued];
  return {
    active,
    running: running.length,
    queued: queued.length,
    history,
    unread: unread.length,
    unreadFailures: unread.filter((run) => run.status === 'failed').length,
    latestOutcome: history.length ? operationOutcome(history[0].runs) : null
  };
}

export function activityTransitions(previous: Map<string, Run['status']>, runs: Run[]) {
  const wasActive = [...previous.values()].some(
    (status) => status === 'running' || status === 'queued'
  );
  const active = runs.some(isActiveRun);
  return {
    started: active && !wasActive,
    stopped: wasActive && !active,
    finished: runs.filter((run) => {
      const before = previous.get(run.id);
      return !isActiveRun(run) && (!before || before === 'running' || before === 'queued');
    })
  };
}
