import { describe, expect, it } from 'vitest';
import { exampleProject } from './example';
import { approveHypotheses, hypothesisReview } from './hypotheses';

describe('hypothesis review and completion', () => {
  it('exposes an empty uncertainty even when the exercise has many other hypotheses', () => {
    const p = exampleProject();
    const missing = p.drivers[4];
    p.hypotheses.filter((h) => h.driverId === missing.id).forEach((h) => (h.archived = true));
    p.hypotheses[0].approved = false;
    const review = hypothesisReview(p);
    expect(review.total).toBe(12);
    expect(review.missing.map((g) => g.driver.id)).toEqual([missing.id]);
    expect(review.attention).toHaveLength(2);
    expect(review.pending).toBe(1);
    expect(review.canComplete).toBe(false);
    expect(approveHypotheses(p)).toBe(false);
    expect(p.hypotheses[0].approved).toBe(false);
  });

  it('allows one alternative, approves the whole kept set, and clears stage review', () => {
    const p = exampleProject();
    p.completed = p.completed.filter((s) => s !== 4);
    p.stale = [4, 5];
    p.hypotheses.forEach((h) => (h.approved = false));
    p.hypotheses
      .filter((h) => h.driverId === p.drivers[0].id)
      .slice(1)
      .forEach((h) => (h.archived = true));
    expect(hypothesisReview(p).canComplete).toBe(true);
    expect(approveHypotheses(p)).toBe(true);
    expect(hypothesisReview(p).attention).toHaveLength(0);
    expect(p.completed).toContain(4);
    expect(p.stale).toEqual([5]);
    expect(
      p.hypotheses
        .filter((h) => h.archived || h.driverId === p.drivers[5].id)
        .every((h) => !h.approved)
    ).toBe(true);
  });

  it('can approve one uncertainty without approving others or completing the stage', () => {
    const p = exampleProject();
    p.completed = [];
    p.hypotheses.forEach((h) => (h.approved = false));
    expect(approveHypotheses(p, p.drivers[0].id)).toBe(true);
    expect(hypothesisReview(p).groups[0].status).toBe('approved');
    expect(hypothesisReview(p).groups[1].status).toBe('review');
    expect(p.completed).not.toContain(4);
    expect(approveHypotheses(p, 'unknown')).toBe(false);
  });

  it('does not allow an empty selection to count as completed', () => {
    const p = exampleProject();
    p.drivers.forEach((d) => (d.selected = false));
    expect(hypothesisReview(p).canComplete).toBe(false);
    expect(approveHypotheses(p)).toBe(false);
  });
});
