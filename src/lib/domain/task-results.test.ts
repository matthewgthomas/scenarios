import { describe, expect, it } from 'vitest';
import { exampleProject } from './example';
import { acceptMerge } from './consolidation';
import { parseProject, type Project, type Run } from './project';
import {
  assessmentResults,
  latestTaskRuns,
  mergePreview,
  mergeResults,
  resultState
} from './task-results';

function run(p: Project, id: string, overrides: Partial<Run> = {}): Run {
  return {
    id,
    operationId: 'assessment',
    exerciseId: p.id,
    stage: 2,
    task: 'ratings',
    modelId: 'test/a',
    promptTemplateVersion: 'quick-2',
    inputRevision: p.revision,
    status: 'succeeded',
    at: p.updatedAt,
    estimated: 0,
    confirmed: 0,
    unknownCharge: false,
    targetIds: [],
    context: {},
    ...overrides
  };
}

function assessment() {
  const p = exampleProject();
  p.stage = 2;
  p.drivers = p.drivers.slice(0, 3);
  p.hypotheses = [];
  p.chains = [];
  p.narratives = [];
  p.drivers.forEach((d) => {
    d.ratings = [];
    d.decision = undefined;
  });
  return p;
}

function receive(p: Project, r: Run, indexes: number[]) {
  r.targetIds = indexes.map((i) => p.drivers[i].id);
  r.context = {
    drivers: indexes.map((i) => ({ id: p.drivers[i].id, revision: p.drivers[i].revision }))
  };
  indexes.forEach((i) =>
    p.drivers[i].ratings.push({
      modelId: r.modelId,
      runId: r.id,
      impact: 4,
      uncertainty: 3,
      rationale: 'Test assessment',
      driverRevision: p.drivers[i].revision
    })
  );
  p.runs.push(r);
}

describe('task result summaries', () => {
  it('does not describe unsaved legacy suggestions as an empty model response', () => {
    const p = exampleProject();
    p.runs.push(
      run(p, 'legacy-review', {
        task: 'consolidate',
        stage: 4,
        output: { groups: [{ title: 'An unsaved suggestion' }] }
      })
    );
    expect(mergeResults(p, 'hypothesis').unavailable).toBe(true);
  });
  it('counts distinct assessed drivers and models across batches and survives backup parsing', () => {
    const p = assessment();
    receive(p, run(p, 'a1'), [0, 1]);
    receive(p, run(p, 'a2'), [2]);
    receive(p, run(p, 'b1', { modelId: 'test/b' }), [0, 1, 2]);
    const result = assessmentResults(parseProject(JSON.parse(JSON.stringify(p))), [
      'test/a',
      'test/b'
    ]);
    expect(result.affected).toHaveLength(3);
    expect(result.modelCount).toBe(2);
    expect(result.missingRequested).toBe(0);
    expect(result.missingCoverage).toBe(0);
    expect(result.awaitingApproval).toBe(3);
    expect(result.state).toBe('complete');
  });

  it('includes valid scores from failed partial requests and reports the missing work', () => {
    const p = assessment();
    const r = run(p, 'partial', { status: 'failed' });
    receive(p, r, [0, 1, 2]);
    p.drivers[2].ratings = [];
    const result = assessmentResults(p, ['test/a', 'test/b']);
    expect(result.affected).toHaveLength(2);
    expect(result.modelCount).toBe(1);
    expect(result.missingRequested).toBe(1);
    expect(result.missingCoverage).toBe(3);
    expect(result.state).toBe('partial');
  });

  it('scopes retries to the latest operation while including earlier scores in current coverage', () => {
    const p = assessment();
    receive(p, run(p, 'initial'), [0, 1]);
    receive(p, run(p, 'retry', { operationId: 'retry', retryOf: 'initial' }), [2]);
    p.runs.push(run(p, 'other-task', { task: 'hypotheses', stage: 4 }));
    const result = assessmentResults(p, ['test/a']);
    expect(result.affected.map((row) => row.driver.id)).toEqual([p.drivers[2].id]);
    expect(result.missingCoverage).toBe(0);
    expect(result.awaitingApproval).toBe(3);
    expect(latestTaskRuns(p, 'ratings', 2).map((r) => r.id)).toEqual(['retry']);
  });

  it('excludes archived drivers and earlier revisions, and preserves approved analyst scores', () => {
    const p = assessment();
    receive(p, run(p, 'scores'), [0, 1, 2]);
    p.drivers[0].revision++;
    p.drivers[1].archived = true;
    p.drivers[2].decision = {
      impact: 2.5,
      uncertainty: 5,
      revision: p.drivers[2].revision,
      type: 'explicitly_edited',
      at: p.updatedAt
    };
    const result = assessmentResults(p, ['test/a']);
    expect(result.affected).toHaveLength(1);
    expect(result.affected[0].comparison.impact?.median).toBe(4);
    expect(result.affected[0].driver.decision?.impact).toBe(2.5);
    expect(result.missingCoverage).toBe(1);
    expect(result.awaitingApproval).toBe(0);
  });

  it('distinguishes running, failed, cancelled, skipped and partial outcomes', () => {
    const p = assessment();
    for (const [status, expected] of [
      ['running', 'running'],
      ['queued', 'running'],
      ['failed', 'failed'],
      ['cancelled', 'cancelled'],
      ['skipped', 'skipped'],
      ['succeeded', 'complete']
    ] as const) {
      expect(resultState([run(p, 'run', { status })], 0)).toBe(expected);
    }
    expect(resultState([run(p, 'run', { status: 'cancelled' })], 1)).toBe('partial');
  });

  it.each(['driver', 'hypothesis'] as const)(
    'previews %s merges in acceptance order and retains an accurate receipt',
    (kind) => {
      const p = exampleProject();
      const records = kind === 'driver' ? p.drivers : p.hypotheses;
      const [first, second] = records;
      const suggestion = {
        id: 'merge',
        kind,
        entityIds: [second.id, first.id],
        title: 'Combined proposal',
        reason: 'Equivalent',
        modelId: 'test/a',
        runId: 'review',
        status: 'pending' as const
      };
      p.mergeSuggestions.push(suggestion);
      const before = mergePreview(p, suggestion);
      expect(before.target?.id).toBe(first.id);
      expect(before.removed.map((record) => record.id)).toEqual([second.id]);
      expect(before.applicable).toBe(true);
      acceptMerge(p, 'merge');
      expect(first.title).toBe(suggestion.title);
      expect('summary' in first ? first.summary : first.description).toBe(before.description);
      expect(second.archived).toBe(true);
      const result = mergeResults(parseProject(JSON.parse(JSON.stringify(p))), kind);
      expect(result.decisions).toHaveLength(1);
      expect(mergePreview(p, result.decisions[0]).removed.map((record) => record.id)).toEqual([
        second.id
      ]);
    }
  );

  it('keeps older pending suggestions visible after an empty or failed new review', () => {
    const p = exampleProject();
    p.mergeSuggestions.push({
      id: 'old',
      kind: 'hypothesis',
      entityIds: p.hypotheses.slice(0, 2).map((h) => h.id),
      title: 'Older proposal',
      reason: 'Overlap',
      modelId: 'test/a',
      runId: 'old-review',
      status: 'pending'
    });
    p.runs.push(run(p, 'new-review', { task: 'consolidate', stage: 4 }));
    const result = mergeResults(p, 'hypothesis');
    expect(result.proposed).toBe(0);
    expect(result.state).toBe('complete');
    expect(result.pending).toHaveLength(1);
    p.runs[0].status = 'failed';
    expect(mergeResults(p, 'hypothesis').state).toBe('failed');
    p.hypotheses[1].archived = true;
    expect(mergePreview(p, result.pending[0]).applicable).toBe(false);
  });
});
