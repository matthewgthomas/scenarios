import { describe, expect, it } from 'vitest';
import { exampleProject, hasExerciseEdits } from './example';

describe('example preview edits', () => {
  it('ignores browsing positions and save bookkeeping', () => {
    const original = exampleProject();
    const browsed = structuredClone(original);
    browsed.stage = 0;
    browsed.modelSetupStep = 'connection';
    browsed.revision++;
    browsed.updatedAt = '2026-11-09T12:00:00.000Z';
    browsed.events.push({ at: browsed.updatedAt, revision: browsed.revision, message: 'Browsing' });

    expect(hasExerciseEdits(original, browsed)).toBe(false);
    expect(hasExerciseEdits(original, structuredClone(original))).toBe(false);
  });

  it.each(['title', 'question', 'horizon'] as const)('recognizes an edit to %s', (field) => {
    const original = exampleProject();
    const edited = structuredClone(original);
    edited[field] += ' edited';
    expect(hasExerciseEdits(original, edited)).toBe(true);
  });

  it('recognizes nested analytical edits and exercise settings', () => {
    const original = exampleProject();
    const edited = structuredClone(original);
    edited.drivers[0].selected = !edited.drivers[0].selected;
    expect(hasExerciseEdits(original, edited)).toBe(true);

    const configured = structuredClone(original);
    configured.budget = (configured.budget ?? 0) + 1;
    expect(hasExerciseEdits(original, configured)).toBe(true);
  });
});
