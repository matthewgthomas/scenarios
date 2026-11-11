import { describe, expect, it } from 'vitest';
import { workflowStages } from '$lib/domain/project';
import {
  readWalkthroughPreferences,
  shouldShowWalkthrough,
  walkthroughId,
  walkthroughSteps,
  walkthroughs
} from './walkthroughs';

describe('page walkthroughs', () => {
  it('covers home and every workflow page, sharing the legacy writing identity', () => {
    const ids = ['home', ...workflowStages.map(({ id }) => walkthroughId(id))];
    expect(new Set(ids).size).toBe(10);
    expect(Object.keys(walkthroughs).sort()).toEqual(ids.sort());
    expect(walkthroughId(7)).toBe(walkthroughId(6));
    expect(walkthroughId(null)).toBe('home');
    for (const [page, steps] of Object.entries(walkthroughs)) {
      expect(steps.length).toBeGreaterThanOrEqual(page === 'home' ? 3 : 4);
      expect(steps.length).toBeLessThanOrEqual(6);
      expect(steps.every((step) => step.title && step.description && step.target)).toBe(true);
    }
  });

  it('preserves full instructions when a stage is blocked without using absent controls', () => {
    const original = structuredClone(walkthroughs.chains);
    const steps = walkthroughSteps('chains', 'Approve your driver list first.');
    expect(steps[0].description).toContain('Approve your driver list first.');
    expect(steps.slice(1).map(({ description }) => description)).toEqual(
      original.map(({ description }) => description)
    );
    expect(steps.every((step) => !step.target)).toBe(true);
    expect(walkthroughs.chains).toEqual(original);
    expect(walkthroughSteps('chains')).toEqual(original);
  });

  it('starts with automatic tours enabled and recovers from corrupt preferences', () => {
    for (const input of [undefined, '', '{', 'null', '12', 'false', '"text"'])
      expect(readWalkthroughPreferences(input)).toEqual({ automatic: true, seen: [] });
    expect(readWalkthroughPreferences('{"automatic":"false","seen":null}')).toEqual({
      automatic: true,
      seen: []
    });
  });

  it('round-trips opt-out and filters invalid or duplicated page history', () => {
    const preferences = readWalkthroughPreferences(
      JSON.stringify({
        automatic: false,
        seen: ['home', 'writing', 'writing', 'retired-page', 4, null, 'constructor', '__proto__']
      })
    );
    expect(preferences).toEqual({ automatic: false, seen: ['home', 'writing'] });
    expect(readWalkthroughPreferences(JSON.stringify(preferences))).toEqual(preferences);
  });

  it('only automatically opens the short home orientation after loading without blockers or dialogs', () => {
    const preferences = { automatic: true, seen: ['home'] as const };
    const saved = { ...preferences, seen: [...preferences.seen] };
    expect(shouldShowWalkthrough(saved, 'define', true, false, false)).toBe(false);
    expect(shouldShowWalkthrough({ automatic: true, seen: [] }, 'home', true, false, false)).toBe(
      true
    );
    expect(shouldShowWalkthrough(saved, 'home', true, false, false)).toBe(false);
    expect(shouldShowWalkthrough(saved, 'define', false, false, false)).toBe(false);
    expect(shouldShowWalkthrough(saved, 'define', true, true, false)).toBe(false);
    expect(shouldShowWalkthrough(saved, 'define', true, false, true)).toBe(false);
    expect(
      shouldShowWalkthrough({ ...saved, automatic: false }, 'define', true, false, false)
    ).toBe(false);
  });

  it('re-enabling automatic orientation never launches stage tours', () => {
    const saved = readWalkthroughPreferences('{"automatic":false,"seen":["home","drivers"]}');
    const enabled = { ...saved, automatic: true };
    expect(shouldShowWalkthrough(enabled, 'drivers', true, false, false)).toBe(false);
    expect(shouldShowWalkthrough(enabled, 'assessment', true, false, false)).toBe(false);
  });
});
