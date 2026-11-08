import { complete, statesFor, uncertainties, type Project } from './project';

/** Coverage and approval are separate: a populated uncertainty still needs analyst review. */
export function hypothesisReview(p: Project) {
  const groups = uncertainties(p).map((driver) => {
    const hypotheses = statesFor(p, driver.id);
    const pending = hypotheses.filter((h) => !h.approved).length;
    const status = !hypotheses.length ? 'missing' : pending ? 'review' : 'approved';
    return { driver, hypotheses, pending, status };
  });
  return {
    groups,
    missing: groups.filter((g) => g.status === 'missing'),
    attention: groups.filter((g) => g.status !== 'approved'),
    total: groups.reduce((n, g) => n + g.hypotheses.length, 0),
    pending: groups.reduce((n, g) => n + g.pending, 0),
    canComplete: groups.length > 0 && groups.every((g) => g.hypotheses.length > 0)
  };
}

/** Only approve active hypotheses for the selected uncertainties, with no empty groups. */
export function approveHypotheses(p: Project, driverId?: string): boolean {
  const review = hypothesisReview(p);
  const groups = driverId ? review.groups.filter((g) => g.driver.id === driverId) : review.groups;
  if (!groups.length || groups.some((g) => !g.hypotheses.length)) return false;
  groups.forEach((g) => g.hypotheses.forEach((h) => (h.approved = true)));
  if (!driverId) complete(p, 4);
  return true;
}
