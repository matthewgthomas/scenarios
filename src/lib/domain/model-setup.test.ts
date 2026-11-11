import { describe, expect, it } from 'vitest';
import {
  MODEL_SETUP_STAGE,
  complete,
  flagDownstream,
  newProject,
  parseProject,
  prerequisite,
  modelSetupSteps,
  approveDriverScores,
  editNarrative,
  stageIsComplete
} from './project';
import {
  prerequisiteStage,
  skipModelSetup,
  approveChainSet,
  completeScenarioSet
} from './workflow';
import { approveHypotheses } from './hypotheses';
import { exampleProject } from './example';
import { projectJSON, markdown } from '$lib/export/files';

describe('guided model setup and saved-project compatibility', () => {
  it('requires framing, then a choice about optional AI setup before the analytical stages', () => {
    const p = newProject();
    expect(prerequisite(p, MODEL_SETUP_STAGE)).toContain('Define analysis');
    expect(prerequisiteStage(p, MODEL_SETUP_STAGE)).toBe(0);
    p.question = 'How might access to essential services change?';
    p.horizon = 'United Kingdom, 2026–2029';
    complete(p, 0);
    expect(prerequisite(p, MODEL_SETUP_STAGE)).toBeNull();
    expect(prerequisite(p, 1)).toContain('Models and budget');
    expect(prerequisite(p, 1)).toContain('Continue manually');
    expect(prerequisiteStage(p, 1)).toBe(MODEL_SETUP_STAGE);
    complete(p, MODEL_SETUP_STAGE);
    expect(prerequisite(p, 1)).toBeNull();
    expect(prerequisite(p, 2)).toContain('Approve the driver list');
  });

  it('keeps analytical framing required when skipping AI setup', () => {
    const p = newProject();
    expect(skipModelSetup(p)).toBe(false);
    p.question = 'How might access to essential services change?';
    expect(skipModelSetup(p)).toBe(false);
    expect(p.stage).toBe(0);
    expect(p.completed).not.toContain(MODEL_SETUP_STAGE);
  });

  it.each(modelSetupSteps)('can skip a saved %s step without a key or budget', (step) => {
    const p = newProject();
    p.question = 'How might access to essential services change?';
    p.horizon = 'United Kingdom, 2026–2029';
    p.stage = MODEL_SETUP_STAGE;
    p.modelSetupStep = step;
    p.budget = null;
    p.overrides['4'] = ['test/existing-model'];
    complete(p, 0);
    const restored = parseProject(JSON.parse(projectJSON(p)));
    expect(skipModelSetup(restored)).toBe(true);
    expect(restored.stage).toBe(1);
    expect(prerequisite(restored, 1)).toBeNull();
    expect(restored.models).toEqual(p.models);
    expect(restored.overrides).toEqual(p.overrides);
    expect(restored.modelSetupStep).toBe(step);
    expect(restored.budget).toBeNull();
    const reopened = parseProject(JSON.parse(projectJSON(restored)));
    expect(prerequisite(reopened, 1)).toBeNull();
    expect(reopened.completed).toContain(MODEL_SETUP_STAGE);
    expect(reopened.modelSetupStatus).toBe('skipped');
    expect(reopened.runs).toEqual([]);
  });

  it('completes and exports a new manual analysis without AI contributions', () => {
    const p = newProject();
    p.question = 'How might access to essential services change?';
    p.horizon = 'United Kingdom, 2026–2029';
    p.budget = null;
    complete(p, 0);
    expect(skipModelSetup(p)).toBe(true);
    expect(prerequisite(p, 1)).toBeNull();
    p.drivers.push({
      id: 'manual-driver',
      title: 'Local services',
      summary: 'Access to essential services',
      origin: 'user',
      origins: [],
      tags: [],
      revision: 1,
      approved: true,
      selected: false,
      archived: false,
      ratings: [],
      history: []
    });
    complete(p, 1);
    expect(prerequisite(p, 2)).toBeNull();
    approveDriverScores(p, 'manual-driver', 4, 5);
    expect(prerequisite(p, 3)).toBeNull();
    p.drivers[0].selected = true;
    complete(p, 3);
    expect(prerequisite(p, 4)).toBeNull();
    p.hypotheses.push({
      id: 'manual-hypothesis',
      driverId: 'manual-driver',
      title: 'Access improves',
      description: 'Services become easier to reach.',
      origins: [],
      revision: 1,
      approved: false,
      archived: false,
      history: []
    });
    expect(approveHypotheses(p)).toBe(true);
    expect(prerequisite(p, 5)).toBeNull();
    p.chains.push({
      id: 'manual-chain',
      title: 'Services within reach',
      kind: 'main',
      colour: 1,
      items: { 'manual-driver': 'manual-hypothesis' },
      revision: 1,
      selected: true,
      archived: false,
      explanation: 'Local investment improves access.',
      approvedRevision: null,
      review: false,
      notes: [],
      origins: [],
      wildcardDriverIds: [],
      distinctiveness: 'Analyst-created combination',
      snapshots: []
    });
    expect(approveChainSet(p)).toBe(true);
    expect(prerequisite(p, 6)).toBeNull();
    editNarrative(p, 'manual-chain', 'By 2029, more people can reach essential local services.');
    expect(completeScenarioSet(p)).toBe(true);
    expect(stageIsComplete(p, 6)).toBe(true);
    p.stage = 8;
    const restored = parseProject(JSON.parse(projectJSON(p)));
    expect(prerequisite(restored, 8)).toBeNull();
    expect(markdown(restored, true, true)).toContain(
      'By 2029, more people can reach essential local services.'
    );
    expect(restored.runs).toEqual([]);
    expect(restored.narratives[0].original?.source).toBe('user');
  });

  it('round-trips a partly finished wizard without marking it complete', () => {
    const p = newProject();
    p.stage = MODEL_SETUP_STAGE;
    p.modelSetupStep = 'models';
    const restored = parseProject(JSON.parse(projectJSON(p)));
    expect(restored.stage).toBe(MODEL_SETUP_STAGE);
    expect(restored.modelSetupStep).toBe('models');
    expect(restored.completed).not.toContain(MODEL_SETUP_STAGE);
    expect(restored).not.toHaveProperty('key');
    expect(restored).not.toHaveProperty('verifiedKey');
  });

  it('preserves existing scenarios, their historical stage IDs and choices', () => {
    const p = parseProject(exampleProject());
    p.completed = p.completed.filter((stage) => stage !== MODEL_SETUP_STAGE);
    p.stage = 4;
    p.overrides['4'] = ['test/existing-model'];
    const { modelSetupStep: _, ...legacy } = p;
    const restored = parseProject(legacy);
    expect(restored.stage).toBe(4);
    expect(restored.completed).toEqual([...p.completed, MODEL_SETUP_STAGE]);
    expect(restored.modelSetupStep).toBe('budget');
    expect(restored.overrides).toEqual(p.overrides);
    expect(restored.drivers).toEqual(p.drivers);
    expect(restored.hypotheses).toEqual(p.hypotheses);
    expect(restored.runs).toEqual(p.runs);
    expect(prerequisite(restored, 4)).toBeNull();
  });

  it('keeps an untouched legacy exercise at the start of the wizard', () => {
    const { modelSetupStep: _, ...legacy } = newProject();
    const restored = parseProject(legacy);
    expect(restored.modelSetupStep).toBe('connection');
    expect(restored.completed).not.toContain(MODEL_SETUP_STAGE);
  });

  it('does not invalidate model setup when the analytical framing changes', () => {
    const p = exampleProject();
    flagDownstream(p, 0, 'Question changed');
    expect(p.stale).toContain(1);
    expect(p.stale).not.toContain(MODEL_SETUP_STAGE);
    expect(p.completed).toContain(MODEL_SETUP_STAGE);
  });
});
