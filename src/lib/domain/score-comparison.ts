import { median, type Driver } from './project';

export type ScoreSummary = {
  min: number;
  max: number;
  median: number;
  range: number;
};

function summarize(values: number[]): ScoreSummary | null {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max, median: median(values)!, range: max - min };
}

export function scoreComparison(driver: Driver, expectedModels: string[] = []) {
  const ratings = driver.ratings.filter((r) => r.driverRevision === driver.revision);
  const impact = summarize(ratings.map((r) => r.impact));
  const uncertainty = summarize(ratings.map((r) => r.uncertainty));
  const ratedModels = new Set(ratings.map((r) => r.modelId));
  const missingModels = [...new Set(expectedModels)].filter((model) => !ratedModels.has(model));
  const groups = Object.values(
    ratings.reduce<Record<string, typeof ratings>>((all, rating) => {
      (all[`${rating.uncertainty}:${rating.impact}`] ??= []).push(rating);
      return all;
    }, {})
  );
  const status = !ratings.length
    ? 'No current AI scores'
    : ratings.length === 1
      ? 'One model; comparison unavailable'
      : impact!.range + uncertainty!.range > 0
        ? 'Models differ'
        : 'Available models agree';
  return { ratings, impact, uncertainty, missingModels, groups, status };
}

// Use one exercise-wide order, including historical contributors, rather than rating-array order.
export function comparisonModelIds(expectedModels: string[], drivers: Driver[]): string[] {
  return [
    ...new Set([...expectedModels, ...drivers.flatMap((d) => d.ratings.map((r) => r.modelId))])
  ].sort();
}
