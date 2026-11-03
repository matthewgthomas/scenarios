import { describe, expect, it } from 'vitest';
import { spent, reserved, uncertainSpend, type Run } from '$lib/domain/project';
import { newProject } from '$lib/domain/project';
import {
  activityPreferenceKey,
  activityTransitions,
  dismissActivityHistory,
  markActivityRead,
  parseActivityPreferences,
  summarizeActivity
} from './model-activity';

const run = (id: string, status: Run['status'], overrides: Partial<Run> = {}): Run => ({
  id,
  status,
  operationId: 'operation',
  exerciseId: 'exercise',
  stage: 2,
  task: 'ratings',
  modelId: 'test/model',
  promptTemplateVersion: 'quick-2',
  inputRevision: 1,
  at: '2026-11-03T09:00:00Z',
  estimated: 0.2,
  confirmed: null,
  unknownCharge: false,
  context: {},
  targetIds: [],
  ...overrides
});
const empty = () => parseActivityPreferences();

describe('model activity', () => {
  it('counts requests rather than models and puts running work before queued batches', () => {
    const activity = summarizeActivity(
      [
        run('q1', 'queued', { batchIndex: 3, batchCount: 3 }),
        run('r1', 'running', { batchIndex: 1, batchCount: 3 }),
        run('r2', 'running', { batchIndex: 2, batchCount: 3 })
      ],
      empty()
    );
    expect(activity.running).toBe(2);
    expect(activity.queued).toBe(1);
    expect(activity.active.map((run) => run.id)).toEqual(['r1', 'r2', 'q1']);
  });

  it('groups finished requests across stages newest first and retains partial failures', () => {
    const activity = summarizeActivity(
      [
        run('old', 'succeeded', { operationId: 'old', stage: 1 }),
        run('ok', 'succeeded', { finishedAt: '2026-11-03T09:02:00Z' }),
        run('failed', 'failed', { finishedAt: '2026-11-03T09:03:00Z' }),
        run('active', 'running')
      ],
      empty()
    );
    expect(activity.history.map((group) => group.id)).toEqual(['operation', 'old']);
    expect(activity.history[0].runs.map((run) => run.status)).toEqual(['failed', 'succeeded']);
    expect(activity.latestOutcome).toBe('failed');
    expect(activity.unread).toBe(3);
    expect(activity.unreadFailures).toBe(1);
    expect(activity.running).toBe(1);
  });

  it('clears only currently finished entries, preserving future completions and financial records', () => {
    const p = newProject();
    p.runs = [
      run('ok', 'succeeded', { confirmed: 0.1 }),
      run('failed', 'failed', { unknownCharge: true }),
      run('active', 'running')
    ];
    const original = structuredClone(p.runs);
    const costs = [spent(p), reserved(p), uncertainSpend(p)];
    const preferences = dismissActivityHistory(empty(), p.runs);
    expect(summarizeActivity(p.runs, preferences).history).toEqual([]);
    expect(summarizeActivity(p.runs, preferences).active).toHaveLength(1);
    expect(p.runs).toEqual(original);
    expect([spent(p), reserved(p), uncertainSpend(p)]).toEqual(costs);
    p.runs[2].status = 'cancelled';
    const reloaded = parseActivityPreferences(JSON.stringify(preferences));
    expect(summarizeActivity(p.runs, reloaded).history[0].runs.map((run) => run.id)).toEqual([
      'active'
    ]);
    expect(summarizeActivity(p.runs, reloaded).unread).toBe(1);
  });

  it('marks finished entries read without consuming active requests or repeatedly changing preferences', () => {
    const runs = [run('ok', 'succeeded'), run('active', 'running')];
    const read = markActivityRead(empty(), runs);
    expect(read.read).toEqual(['ok']);
    expect(markActivityRead(read, runs)).toBe(read);
    runs[1].status = 'failed';
    expect(summarizeActivity(runs, read).unreadFailures).toBe(1);
    expect(summarizeActivity(runs, markActivityRead(read, runs)).unread).toBe(0);
  });

  it('detects starts, partial completions, stops and recovered failures without replaying historical statuses', () => {
    const runs = [run('ok', 'succeeded'), run('active', 'running')];
    const baseline = new Map(runs.map((run) => [run.id, run.status]));
    expect(activityTransitions(baseline, runs)).toEqual({
      started: false,
      stopped: false,
      finished: []
    });
    expect(activityTransitions(new Map(), [run('q', 'queued')]).started).toBe(true);
    runs[1].status = 'failed';
    const changes = activityTransitions(baseline, runs);
    expect(changes.stopped).toBe(true);
    expect(changes.finished.map((run) => run.id)).toEqual(['active']);
    expect(summarizeActivity(runs, { read: ['ok'], dismissed: [] }).unreadFailures).toBe(1);
    expect(activityTransitions(new Map([['q', 'queued']]), [run('q', 'running')]).started).toBe(
      false
    );
  });

  it('tolerates malformed preferences and isolates exercises', () => {
    expect(parseActivityPreferences('invalid')).toEqual(empty());
    expect(parseActivityPreferences('null')).toEqual(empty());
    expect(parseActivityPreferences('{"read":["a","a",2],"dismissed":false}')).toEqual({
      read: ['a'],
      dismissed: []
    });
    expect(activityPreferenceKey('one')).not.toBe(activityPreferenceKey('two'));
  });
});
