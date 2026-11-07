import { describe, expect, it } from 'vitest';
import { exampleProject } from './example';
import { coordinates } from './project';
import { comparisonModelIds, scoreComparison } from './score-comparison';

describe('AI score comparisons', () => {
  it('shows per-axis ranges and medians independently of approved analyst scores', () => {
    const driver = exampleProject().drivers[1];
    driver.decision!.impact = 1;
    driver.decision!.uncertainty = 2;
    const result = scoreComparison(driver);
    expect(result.impact).toEqual({ min: 2, max: 5, median: 4, range: 3 });
    expect(result.uncertainty).toEqual({ min: 4, max: 5, median: 5, range: 1 });
    expect(result.status).toBe('Models differ');
    expect(coordinates(driver)).toEqual({ impact: 1, uncertainty: 2 });
  });

  it('preserves fractional medians', () => {
    const driver = exampleProject().drivers[0];
    driver.ratings = driver.ratings.slice(0, 2);
    driver.ratings[0].impact = 3;
    driver.ratings[1].impact = 4;
    expect(scoreComparison(driver).impact).toEqual({ min: 3, max: 4, median: 3.5, range: 1 });
  });

  it('groups identical positions and reports agreement in available scores', () => {
    const driver = exampleProject().drivers[0];
    driver.ratings.forEach((rating) => {
      rating.impact = 4;
      rating.uncertainty = 3;
    });
    const result = scoreComparison(driver);
    expect(result.status).toBe('Available models agree');
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]).toHaveLength(3);
    expect(result.impact).toEqual({ min: 4, max: 4, median: 4, range: 0 });
  });

  it.each(['impact', 'uncertainty'] as const)('reports a one-point difference in %s', (axis) => {
    const driver = exampleProject().drivers[0];
    driver.ratings.forEach((rating) => {
      rating.impact = 3;
      rating.uncertainty = 3;
    });
    driver.ratings[0][axis] = 4;
    const result = scoreComparison(driver);
    expect(result.status).toBe('Models differ');
    expect(result[axis]!.range).toBe(1);
    expect(result.groups).toHaveLength(2);
    expect(result.groups.map((group) => group.length).sort()).toEqual([1, 2]);
  });

  it('excludes earlier revisions without deleting their rationale history', () => {
    const driver = exampleProject().drivers[1];
    driver.ratings[0].driverRevision = 0;
    const result = scoreComparison(
      driver,
      driver.ratings.map((r) => r.modelId)
    );
    expect(result.ratings).toHaveLength(2);
    expect(result.impact!.median).toBe(3);
    expect(result.missingModels).toEqual([driver.ratings[0].modelId]);
    expect(driver.ratings).toHaveLength(3);
    expect(driver.ratings[0].rationale).toBeTruthy();
  });

  it('shows no current scores even if earlier ratings and an analyst decision exist', () => {
    const driver = exampleProject().drivers[0];
    driver.ratings.forEach((rating) => rating.driverRevision--);
    const result = scoreComparison(driver, ['missing/model']);
    expect(result.status).toBe('No current AI scores');
    expect(result.impact).toBeNull();
    expect(result.uncertainty).toBeNull();
    expect(result.groups).toEqual([]);
    expect(result.missingModels).toEqual(['missing/model']);
    expect(coordinates(driver).impact).toBe(5);
  });

  it('does not describe a single model as agreement', () => {
    const driver = exampleProject().drivers[0];
    driver.ratings = driver.ratings.slice(0, 1);
    const result = scoreComparison(driver);
    expect(result.status).toBe('One model; comparison unavailable');
    expect(result.impact!.range).toBe(0);
  });

  it('reports missing configured models without discarding additional contributors', () => {
    const driver = exampleProject().drivers[0];
    const result = scoreComparison(driver, [
      'missing/model',
      'missing/model',
      driver.ratings[0].modelId
    ]);
    expect(result.ratings).toHaveLength(3);
    expect(result.missingModels).toEqual(['missing/model']);
  });

  it('assigns model identities consistently across rating and driver order, including history', () => {
    const drivers = exampleProject().drivers;
    drivers[0].ratings[0].modelId = 'historical/model';
    drivers[0].ratings[0].driverRevision = 0;
    const ids = comparisonModelIds(['configured/model'], drivers);
    const reordered = drivers
      .toReversed()
      .map((driver) => ({ ...driver, ratings: driver.ratings.toReversed() }));
    expect(comparisonModelIds(['configured/model'], reordered)).toEqual(ids);
    expect(ids).toContain('historical/model');
    expect(ids).toContain('configured/model');
    expect(new Set(ids).size).toBe(ids.length);
  });
});
