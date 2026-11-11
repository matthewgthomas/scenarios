import { activeDrivers, type Project, type Run } from './project';
import { scoreComparison } from './score-comparison';

export type MergeSuggestion = Project['mergeSuggestions'][number];

export function latestTaskRuns(p: Project, task: Run['task'], stage: number): Run[] {
  const runs = p.runs.filter((run) => run.task === task && run.stage === stage);
  const latest = runs.at(-1);
  return latest ? runs.filter((run) => run.operationId === latest.operationId) : [];
}

export function resultState(runs: Run[], contributions: number) {
  if (runs.some((run) => run.status === 'queued' || run.status === 'running')) return 'running';
  if (runs.some((run) => run.status !== 'succeeded')) {
    if (contributions) return 'partial';
    if (runs.some((run) => run.status === 'failed')) return 'failed';
    if (runs.some((run) => run.status === 'cancelled')) return 'cancelled';
    return 'skipped';
  }
  return 'complete';
}

// Preserve project order: acceptance retains the first matching active record,
// which need not be the first ID supplied by the model.
export function mergePreview(p: Project, suggestion: MergeSuggestion) {
  const records =
    suggestion.kind === 'driver'
      ? p.drivers.map((d) => ({ ...d, description: d.summary }))
      : p.hypotheses;
  const sources = records.filter((record) => suggestion.entityIds.includes(record.id));
  const active = sources.filter((record) => !record.archived);
  const applicable =
    active.length === suggestion.entityIds.length &&
    (suggestion.kind === 'driver' ||
      new Set(active.map((record) => ('driverId' in record ? record.driverId : undefined))).size ===
        1);
  const merging = suggestion.status === 'pending' ? active : sources;
  return {
    sources,
    target: merging[0],
    removed: merging.slice(1),
    description: merging
      .map((record) => record.description)
      .filter((description) => suggestion.kind === 'hypothesis' || Boolean(description))
      .join('\n\n'),
    applicable
  };
}

export function mergeResults(p: Project, kind: MergeSuggestion['kind']) {
  const runs = latestTaskRuns(p, 'consolidate', kind === 'hypothesis' ? 4 : 1);
  const runIds = new Set(runs.map((run) => run.id));
  const suggestions = p.mergeSuggestions.filter((suggestion) => suggestion.kind === kind);
  const proposed = suggestions.filter((suggestion) => runIds.has(suggestion.runId)).length;
  const unavailable = runs.some((run) => {
    const output = run.output as { groups?: unknown[] } | null;
    return (
      run.status === 'succeeded' &&
      Array.isArray(output?.groups) &&
      output.groups.length > suggestions.filter((suggestion) => suggestion.runId === run.id).length
    );
  });
  return {
    runs,
    proposed,
    unavailable,
    state: resultState(runs, proposed),
    pending: suggestions.filter((suggestion) => suggestion.status === 'pending'),
    decisions: suggestions.filter((suggestion) => suggestion.status !== 'pending')
  };
}

export function assessmentResults(p: Project, expectedModels: string[]) {
  const runs = latestTaskRuns(p, 'ratings', 2);
  const runIds = new Set(runs.map((run) => run.id));
  const drivers = activeDrivers(p);
  const rows = drivers.map((driver) => ({
    driver,
    comparison: scoreComparison(driver, expectedModels),
    received: driver.ratings.filter(
      (rating) => runIds.has(rating.runId) && rating.driverRevision === driver.revision
    )
  }));
  const affected = rows.filter((row) => row.received.length);
  const rowsById = new Map(rows.map((row) => [row.driver.id, row]));
  const modelCount = new Set(
    affected.flatMap((row) => row.received.map((rating) => rating.modelId))
  ).size;
  let missingRequested = 0;
  for (const run of runs) {
    const context = run.context as { drivers?: { id: string; revision: number }[] } | null;
    const requested = context?.drivers ?? run.targetIds.map((id) => ({ id, revision: undefined }));
    for (const input of requested) {
      const row = rowsById.get(input.id);
      if (
        row &&
        (input.revision === undefined || row.driver.revision === input.revision) &&
        !row.received.some((rating) => rating.runId === run.id)
      )
        missingRequested++;
    }
  }
  return {
    runs,
    affected,
    modelCount,
    missingRequested,
    state: resultState(runs, affected.length),
    missingCoverage: rows.filter((row) => row.comparison.missingModels.length).length,
    awaitingApproval: rows.filter(
      (row) =>
        row.comparison.ratings.length && row.driver.decision?.revision !== row.driver.revision
    ).length
  };
}
