import { describe, expect, it } from 'vitest';
import { exampleProject } from './example';
import { acceptMerge } from './consolidation';

describe('explicit consolidation decisions', () => {
  it('merges drivers only on acceptance and retains the removed records and provenance', () => {
    const p = exampleProject();
    const first = p.drivers[0],
      second = p.drivers[1];
    const before = first.summary;
    p.mergeSuggestions.push({
      id: 'merge',
      kind: 'driver',
      entityIds: [first.id, second.id],
      title: 'Combined driver',
      reason: 'Related drivers',
      modelId: 'test/model',
      runId: 'test',
      status: 'pending'
    });
    acceptMerge(p, 'merge');
    expect(first.title).toBe('Combined driver');
    expect(first.approved).toBe(false);
    expect(second.archived).toBe(true);
    expect(p.drivers).toHaveLength(8);
    expect(first.origins).toHaveLength(2);
    expect(first.history?.[0].summary).toBe(before);
    expect(p.mergeSuggestions[0].status).toBe('accepted');
    expect(p.chains.every((c) => c.review)).toBe(true);
  });
  it('flags chains referencing a removed future state and keeps their previous notes and content', () => {
    const p = exampleProject();
    const [first, second] = p.hypotheses;
    p.mergeSuggestions.push({
      id: 'merge',
      kind: 'hypothesis',
      entityIds: [first.id, second.id],
      title: 'Combined future',
      reason: 'Equivalent states',
      modelId: 'test/model',
      runId: 'test',
      status: 'pending'
    });
    const originalItems = { ...p.chains[1].items };
    const originalNotes = JSON.stringify(p.chains[1].notes);
    acceptMerge(p, 'merge');
    expect(first.title).toBe('Combined future');
    expect(second.archived).toBe(true);
    expect(p.chains[1].items).toEqual(originalItems);
    expect(JSON.stringify(p.chains[1].notes)).toBe(originalNotes);
    expect(p.chains[1].review).toBe(true);
    expect(p.chains[1].snapshots).toHaveLength(1);
  });
});
