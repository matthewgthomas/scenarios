import { describe, expect, it } from 'vitest';
import {
  MODEL_SETUP_STAGE,
  complete,
  flagDownstream,
  newProject,
  parseProject,
  prerequisite
} from './project';
import { prerequisiteStage } from './workflow';
import { exampleProject } from './example';
import { projectJSON } from '$lib/export/files';

describe('guided model setup and saved-project compatibility', () => {
  it('requires framing, then model setup before the analytical stages', () => {
    const p = newProject();
    expect(prerequisite(p, MODEL_SETUP_STAGE)).toContain('Define analysis');
    expect(prerequisiteStage(p, MODEL_SETUP_STAGE)).toBe(0);
    p.question = 'How might access to essential services change?';
    p.horizon = 'United Kingdom, 2026–2029';
    complete(p, 0);
    expect(prerequisite(p, MODEL_SETUP_STAGE)).toBeNull();
    expect(prerequisite(p, 1)).toContain('Models and budget');
    expect(prerequisiteStage(p, 1)).toBe(MODEL_SETUP_STAGE);
    complete(p, MODEL_SETUP_STAGE);
    expect(prerequisite(p, 1)).toBeNull();
    expect(prerequisite(p, 2)).toContain('Approve the driver list');
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

  it('preserves existing exercises, their historical stage IDs and choices', () => {
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
