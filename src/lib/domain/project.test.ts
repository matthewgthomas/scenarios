import { describe, it, expect } from 'vitest';
import { exampleProject } from './example';
import {
  median,
  coordinates,
  editHypothesis,
  setChainItem,
  snapshotChain,
  parseProject,
  canSpend,
  spent,
  reserved,
  uncertainSpend,
  newProject,
  prerequisite,
  type Run
} from './project';
import { projectJSON, markdown } from '$lib/export/files';
import { recoverInterrupted } from '$lib/storage/projects';

const run = (overrides: Partial<Run> = {}): Run => ({
  id: 'r',
  operationId: 'o',
  exerciseId: 'e',
  stage: 1,
  task: 'drivers',
  modelId: 'test/model',
  promptTemplateVersion: 'quick-1',
  inputRevision: 1,
  status: 'succeeded',
  at: '2026-11-02',
  estimated: 0.2,
  confirmed: 0.1,
  unknownCharge: false,
  context: {},
  targetIds: [],
  ...overrides
});

describe('analyst decisions and provenance', () => {
  it('calculates per-axis medians without rounding or inventing missing scores', () => {
    expect(median([5, 4, 2])).toBe(4);
    expect(median([3, 4])).toBe(3.5);
    expect(median([])).toBeNull();
    const d = exampleProject().drivers[0];
    d.decision = undefined;
    d.ratings = d.ratings.slice(0, 2);
    d.ratings[0].impact = 3;
    d.ratings[1].impact = 4;
    expect(coordinates(d).impact).toBe(3.5);
    d.revision++;
    expect(coordinates(d).impact).toBeNull();
  });
  it('snapshots a chain before a hypothesis edit, preserving original content and model notes', () => {
    const p = exampleProject();
    const c = p.chains[0];
    const h = p.hypotheses.find((h) => h.id === c.items[p.drivers[0].id])!;
    const original = h.description;
    c.approvedRevision = c.revision;
    p.narratives[0].working = 'My own edited narrative.';
    const notes = JSON.stringify(c.notes);
    editHypothesis(p, h.id, 'Changed future', 'New future state');
    expect(h.history?.[0].description).toBe(original);
    expect(c.snapshots?.[0].states.find((v) => v.id === h.id)?.description).toBe(original);
    expect(c.revision).toBe(2);
    expect(c.approvedRevision).toBe(1);
    expect(c.review).toBe(true);
    expect(JSON.stringify(c.notes)).toBe(notes);
    expect(p.narratives[0].working).toBe('My own edited narrative.');
    expect(p.narratives[0].review).toBe(true);
    expect(p.runs).toHaveLength(0);
  });
  it('keeps explicit unresolved states through exports and round trips', () => {
    const p = exampleProject();
    setChainItem(p, p.chains[0].id, p.drivers[0].id, null);
    const restored = parseProject(JSON.parse(projectJSON(p)));
    expect(restored.chains[0].items[p.drivers[0].id]).toBeNull();
    expect(markdown(restored, true, true)).toContain('Unresolved uncertainties: Household energy');
  });
  it('round-trips batch diagnostics alongside historical version 1.0 runs', () => {
    const p = exampleProject();
    const historical = run();
    const batch = run({
      id: 'batch',
      task: 'ratings',
      promptTemplateVersion: 'quick-2',
      status: 'failed',
      batchIndex: 2,
      batchCount: 5,
      maxOutputTokens: 6000,
      inputTokens: 200,
      outputTokens: 6000,
      rawOutput: '{"ratings":[\n{"rationale":"',
      output: '{"ratings":[\n{"rationale":"',
      finishReason: 'length',
      nativeFinishReason: 'max_tokens',
      targetIds: [p.drivers[0].id],
      retryOf: historical.id
    });
    const chainBatch = run({
      id: 'chain-batch',
      task: 'chains',
      promptTemplateVersion: 'quick-3',
      batchIndex: 2,
      batchCount: 2,
      maxOutputTokens: 12000,
      context: { chainBatch: { kind: 'wildcard', start: 1, count: 1 } }
    });
    p.runs = [historical, batch, chainBatch];
    const restored = parseProject(JSON.parse(projectJSON(p)));
    expect(restored.schemaVersion).toBe('1.0');
    expect(restored.runs).toEqual([historical, batch, chainBatch]);
  });
  it('records only one immutable snapshot per chain revision', () => {
    const p = exampleProject();
    const c = p.chains[0];
    snapshotChain(p, c);
    snapshotChain(p, c);
    expect(c.snapshots).toHaveLength(1);
    expect(c.snapshots?.[0].items).not.toBe(c.items);
  });
  it('rejects unsupported versions, invalid scores and dangling references', () => {
    const p = exampleProject();
    expect(() => parseProject({ ...p, schemaVersion: '2.0' })).toThrow();
    p.drivers[0].ratings[0].impact = 6;
    expect(() => parseProject(p)).toThrow();
    p.drivers[0].ratings[0].impact = 5;
    p.chains[0].items[p.drivers[0].id] = 'nonexistent';
    expect(() => parseProject(p)).toThrow();
  });
  it('restores editable state without importing arbitrary credential fields', () => {
    const p = exampleProject();
    p.narratives[0].working = 'Analyst revision';
    const imported = parseProject({ ...p, apiKey: 'SECRET', key: 'SECRET' });
    expect(projectJSON(imported)).not.toContain('SECRET');
    expect(imported.narratives[0].working).toBe('Analyst revision');
  });
  it('does not allow unconfigured projects to skip prerequisites', () => {
    expect(prerequisite(newProject(), 5)).toContain('question');
    expect(prerequisite(exampleProject(), 5)).toBeNull();
    const unwritten = exampleProject();
    unwritten.narratives = [];
    expect(prerequisite(unwritten, 6)).toContain('Approve');
  });
});

describe('spending and interrupted operations', () => {
  it('distinguishes confirmed, reserved and uncertain charges without double counting', () => {
    const p = newProject();
    p.budget = 0.6;
    p.runs = [
      run(),
      run({ id: 'r2', status: 'running', confirmed: null, unknownCharge: true }),
      run({ id: 'r3', status: 'failed', confirmed: null, unknownCharge: true })
    ];
    expect(spent(p)).toBe(0.1);
    expect(reserved(p)).toBe(0.2);
    expect(uncertainSpend(p)).toBe(0.2);
    expect(canSpend(p, 0.09)).toBe(true);
    expect(canSpend(p, 0.11)).toBe(false);
  });
  it('marks interrupted dispatched calls as unknown without charging queued calls', () => {
    const p = newProject();
    p.runs = [
      run({ status: 'running', confirmed: null }),
      run({ id: 'r2', status: 'queued', confirmed: null })
    ];
    expect(recoverInterrupted(p)).toBe(2);
    expect(p.runs.every((r) => r.status === 'failed')).toBe(true);
    expect(p.runs[0].unknownCharge).toBe(true);
    expect(p.runs[1].unknownCharge).toBe(false);
  });
});
