import { describe, it, expect } from 'vitest';
import { exampleProject } from './example';
import {
  canonicalStage,
  completedStageCount,
  coreStageCount,
  editNarrative,
  parseProject,
  prepareNarrativeReview,
  stageIsComplete,
  stageNeedsReview,
  workflowStages,
  type Run
} from './project';
import {
  chainReadiness,
  prerequisiteStage,
  approveChainSet,
  completeScenarioSet
} from './workflow';

describe('actionable workflow readiness', () => {
  it('shows one combined writing/review stage and counts final approval rather than draft readiness', () => {
    const p = exampleProject();
    p.completed = [0, 1, 2, 3, 4, 5];
    expect(workflowStages.map((s) => s.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 8]);
    expect(coreStageCount).toBe(7);
    prepareNarrativeReview(p);
    expect(stageIsComplete(p, 6)).toBe(false);
    expect(completedStageCount(p)).toBe(6);
    approveChainSet(p);
    completeScenarioSet(p);
    expect(stageIsComplete(p, 6)).toBe(true);
    expect(completedStageCount(p)).toBe(7);
    editNarrative(p, p.chains[0].id, 'A revision after completion.');
    expect(stageIsComplete(p, 6)).toBe(false);
    expect(completedStageCount(p)).toBe(6);
  });
  it('reopens legacy review-stage backups in the unified workspace without changing saved work or run history', () => {
    const p = exampleProject();
    p.stage = 7;
    p.completed = [0, 1, 2, 3, 4, 5, 6];
    p.stale = [7];
    p.overrides['7'] = ['test/review-model'];
    const run: Run = {
      id: 'legacy-review-run',
      operationId: 'legacy-op',
      exerciseId: p.id,
      stage: 7,
      task: 'narrative_edit',
      modelId: 'test/review-model',
      promptTemplateVersion: 'quick-3',
      inputRevision: p.revision,
      status: 'succeeded',
      at: p.updatedAt,
      estimated: 0.1,
      confirmed: 0.05,
      unknownCharge: false,
      context: {},
      targetIds: [p.chains[0].id]
    };
    p.runs = [run];
    const restored = parseProject(JSON.parse(JSON.stringify(p)));
    expect(restored.schemaVersion).toBe('1.0');
    expect(restored.stage).toBe(6);
    expect(stageNeedsReview(restored, 6)).toBe(true);
    expect(stageIsComplete(restored, 6)).toBe(false);
    expect(restored.narratives).toEqual(p.narratives);
    expect(restored.runs).toEqual([run]);
    expect(restored.completed).toEqual(p.completed);
    expect(restored.overrides['6']).toEqual(['test/review-model']);
    expect(restored.overrides['7']).toEqual(['test/review-model']);
  });
  it('preserves completed legacy sets, export routes and writing model choices', () => {
    const p = exampleProject();
    approveChainSet(p);
    completeScenarioSet(p);
    p.stage = 7;
    p.overrides = { '6': ['test/writer'], '7': ['test/reviewer'] };
    const restored = parseProject(p);
    expect(stageIsComplete(restored, 6)).toBe(true);
    expect(restored.overrides).toEqual(p.overrides);
    expect(canonicalStage(7)).toBe(6);
    expect(parseProject({ ...p, stage: 8 }).stage).toBe(8);
    expect(restored.narratives.map((n) => n.final)).toEqual(p.narratives.map((n) => n.final));
  });
  it('clears a chain review warning only when a valid selected set is explicitly approved', () => {
    const p = exampleProject();
    p.chains.forEach((c) => (c.review = true));
    p.chains[0].selected = false;
    expect(approveChainSet(p)).toBe(true);
    expect(p.chains[0].review).toBe(true);
    expect(p.chains.slice(1).every((c) => !c.review)).toBe(true);
    p.chains[0].selected = true;
    expect(approveChainSet(p)).toBe(true);
    expect(p.chains.every((c) => !c.review && c.approvedRevision === c.revision)).toBe(true);
  });
  it('final review clears narrative review warnings without requiring advisory checks or overwriting originals', () => {
    const p = exampleProject();
    const original = structuredClone(p.narratives[0].original);
    p.narratives[0].working = 'An updated story after review.';
    p.narratives[0].review = true;
    p.chains[0].revision++;
    approveChainSet(p);
    expect(completeScenarioSet(p)).toBe(true);
    expect(p.narratives[0].review).toBe(false);
    expect(p.narratives[0].chainRevision).toBe(p.chains[0].revision);
    expect(p.narratives[0].final).toBe('An updated story after review.');
    expect(p.narratives[0].original).toEqual(original);
    expect(p.narratives.every((n) => !n.checklist.length)).toBe(true);
  });
  it('does not save a partial set as final when a narrative is missing', () => {
    const p = exampleProject();
    p.narratives[1].working = '';
    expect(completeScenarioSet(p)).toBe(false);
    expect(p.narratives.every((n) => n.final === null)).toBe(true);
    expect(p.completed).not.toContain(7);
  });
  it('accepts a subset without enforcing historical targets', () => {
    const p = exampleProject();
    p.chains[0].selected = false;
    expect(chainReadiness(p)).toMatchObject({
      canApprove: true
    });
  });
  it('identifies the exact chain and uncertainty with a removed or unapproved state', () => {
    const p = exampleProject();
    p.hypotheses[0].archived = true;
    const r = chainReadiness(p);
    expect(r.issues[0]).toMatchObject({ chainId: p.chains[0].id, driverId: p.drivers[0].id });
    expect(r.canApprove).toBe(false);
    p.chains[0].items[p.drivers[0].id] = null;
    expect(chainReadiness(p).canApprove).toBe(true);
  });
  it('requires novel wildcard acceptance and ignores unselected candidates', () => {
    const p = exampleProject();
    p.chains[0].wildcardDriverIds = ['new-driver'];
    expect(chainReadiness(p).issues).toHaveLength(1);
    p.chains[0].selected = false;
    expect(chainReadiness(p).issues).toHaveLength(0);
  });
  it('routes a blocked later stage to the first missing prerequisite', () => {
    const p = exampleProject();
    p.question = '';
    expect(prerequisiteStage(p, 6)).toBe(0);
    p.question = 'How might things change?';
    p.drivers[0].decision = undefined;
    expect(prerequisiteStage(p, 6)).toBe(2);
    p.drivers[0].decision = {
      impact: 4,
      uncertainty: 4,
      type: 'bulk_accepted_median',
      at: '',
      revision: p.drivers[0].revision
    };
    p.hypotheses.forEach((h) => {
      if (h.driverId === p.drivers[0].id) h.approved = false;
    });
    expect(prerequisiteStage(p, 6)).toBe(4);
  });
});
