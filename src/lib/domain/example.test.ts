import { describe, expect, it } from 'vitest';
import { exampleProject, finishedExampleProject, hasExerciseEdits } from './example';
import { approvedChainSet, parseProject, stageIsComplete } from './project';

describe('example preview edits', () => {
  it('starts the guided example at the question with a finished authored set available', () => {
    const p = parseProject(JSON.parse(JSON.stringify(finishedExampleProject())));
    expect(p.stage).toBe(0);
    expect(p.example).toBe(true);
    expect(p.runs).toEqual([]);
    expect(approvedChainSet(p)).toBe(true);
    expect(stageIsComplete(p, 6)).toBe(true);
    expect(p.narratives.every((n) => n.final === n.working && n.finalAt)).toBe(true);
    const browsed = structuredClone(p);
    browsed.stage = 6;
    expect(hasExerciseEdits(p, browsed)).toBe(false);
  });
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
