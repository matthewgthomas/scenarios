import { describe, expect, it } from 'vitest';
import { newProject, parseProject } from './project';
import {
  aiModelStages,
  customizeStageModels,
  resetStageModels,
  hasStageModels,
  requestModels,
  stageModels,
  selectionMode,
  FUSION_MODEL
} from './model-settings';

describe('optional stage model choices', () => {
  it('starts with shared defaults and only exposes stages with AI actions', () => {
    const p = newProject();
    expect(aiModelStages).toEqual([1, 2, 4, 5, 6]);
    for (const stage of aiModelStages) {
      expect(hasStageModels(p, String(stage))).toBe(false);
      expect(requestModels(p, stage, stage === 6)).toEqual(stage === 6 ? [p.writer] : p.models);
    }
    expect(p.overrides).toEqual({});
  });
  it('pins an independent copy only when a user chooses a custom selection', () => {
    const p = newProject();
    customizeStageModels(p, '2');
    const pinned = [...p.models];
    expect(p.overrides['2']).not.toBe(p.models);
    p.models = ['different/default'];
    p.modelMode = 'fusion';
    expect(requestModels(p, 1)).toEqual([FUSION_MODEL]);
    expect(requestModels(p, 2)).toEqual(pinned);
    resetStageModels(p, '2');
    expect(hasStageModels(p, '2')).toBe(false);
    expect(requestModels(p, 2)).toEqual([FUSION_MODEL]);
    p.modelMode = 'individual';
    expect(requestModels(p, 2)).toEqual(['different/default']);
  });
  it('preserves other custom stages and original preferences when resetting one stage', () => {
    const p = newProject();
    customizeStageModels(p, '1');
    customizeStageModels(p, '4');
    p.overrides['4'] = ['example/hypotheses'];
    p.modelModeOverrides['1'] = 'fusion';
    resetStageModels(p, '1');
    expect(requestModels(p, 4)).toEqual(['example/hypotheses']);
    expect(p.writer).toBe(p.models[0]);
    const restored = parseProject(JSON.parse(JSON.stringify(p)));
    expect(restored.overrides).toEqual(p.overrides);
    expect(selectionMode(restored, '1')).toBe('individual');
  });
  it('fills missing legacy preferences without replacing an existing custom choice', () => {
    const p = newProject();
    p.modelModeOverrides['1'] = 'fusion';
    customizeStageModels(p, '1');
    expect(p.overrides['1']).toEqual(p.models);
    expect(selectionMode(p, '1')).toBe('fusion');
    p.overrides['2'] = ['example/custom'];
    customizeStageModels(p, '2');
    p.modelMode = 'fusion';
    expect(requestModels(p, 2)).toEqual(['example/custom']);
  });
  it('uses the writing-stage choice for single proposals without changing the shared writer', () => {
    const p = newProject();
    const writer = p.writer;
    customizeStageModels(p, '6');
    expect(stageModels(p, '6')).toEqual([writer]);
    p.overrides['6'] = ['example/writer', 'legacy/extra'];
    expect(requestModels(p, 6, true)).toEqual(['example/writer']);
    expect(requestModels(p, 7, true)).toEqual(['example/writer']);
    expect(p.writer).toBe(writer);
    resetStageModels(p, '6');
    expect(requestModels(p, 6, true)).toEqual([writer]);
  });
  it('uses Fusion for a custom stage and the first stage model for a single merge proposal', () => {
    const p = newProject();
    customizeStageModels(p, '1');
    p.overrides['1'] = ['example/first', 'example/second'];
    expect(requestModels(p, 1, true)).toEqual(['example/first']);
    p.modelModeOverrides['1'] = 'fusion';
    expect(requestModels(p, 1, true)).toEqual([FUSION_MODEL]);
    expect(requestModels(p, 2, true)).toEqual([p.writer]);
  });
});
