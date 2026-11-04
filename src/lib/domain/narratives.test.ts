import { describe, it, expect } from 'vitest';
import { exampleProject } from './example';
import {
  allNarrativesWritten,
  applyNarrativeProposal,
  canWriteNarrative,
  editNarrative,
  narrativeFor,
  parseProject,
  prepareNarrativeReview,
  prerequisite,
  proposalIsCurrent,
  snapshotNarrative,
  undoNarrative,
  setChainItem,
  type Narrative
} from './project';
import { markdown, projectJSON } from '$lib/export/files';

function exercise() {
  const p = exampleProject();
  p.example = false;
  p.chains.forEach((c) => {
    c.approvedRevision = c.revision;
  });
  p.narratives = [];
  return p;
}
function proposal(p: ReturnType<typeof exercise>, baseText = '') {
  const c = p.chains[0];
  const d: Narrative['drafts'][number] = {
    id: 'proposal',
    text: 'A proposed scenario.',
    at: '2026-11-04',
    modelId: 'test/model',
    runId: 'run',
    chainRevision: c.revision,
    baseText,
    kind: 'edit' as const,
    status: 'pending' as const,
    instructions: 'Clarify the pathway.'
  };
  narrativeFor(p, c.id).drafts.push(d);
  return d;
}

describe('human-first narrative writing', () => {
  it('creates human drafts on edit and requires text for every selected scenario', () => {
    const p = exercise();
    expect(allNarrativesWritten(p)).toBe(false);
    editNarrative(p, p.chains[0].id, 'My first scenario.');
    expect(p.narratives[0].chainRevision).toBe(1);
    expect(p.narratives[0].chosenId).toBeNull();
    expect(prerequisite(p, 7)).toContain('every selected');
    p.chains.slice(1).forEach((c) => editNarrative(p, c.id, `Scenario ${c.title}`));
    expect(allNarrativesWritten(p)).toBe(true);
    expect(prerequisite(p, 7)).toBeNull();
    expect(p.runs).toEqual([]);
    p.chains.forEach((c) => {
      c.selected = false;
    });
    expect(allNarrativesWritten(p)).toBe(false);
  });
  it('keeps empty and whitespace drafts incomplete, including after undo/redo', () => {
    const p = exercise();
    p.chains = p.chains.slice(0, 1);
    editNarrative(p, p.chains[0].id, ' \n ');
    expect(allNarrativesWritten(p)).toBe(false);
    editNarrative(p, p.chains[0].id, 'Some prose');
    prepareNarrativeReview(p);
    p.completed.push(7, 8);
    undoNarrative(p, p.chains[0].id);
    expect(allNarrativesWritten(p)).toBe(false);
    expect(p.completed).not.toContain(6);
    expect(p.completed).not.toContain(7);
    expect(p.completed).not.toContain(8);
    undoNarrative(p, p.chains[0].id, true);
    expect(p.narratives[0].working).toBe('Some prose');
  });
  it('blocks new drafts on unapproved chains but preserves existing editable drafts after upstream changes', () => {
    const p = exercise();
    const c = p.chains[0];
    c.approvedRevision = null;
    editNarrative(p, c.id, 'Blocked');
    expect(p.narratives).toHaveLength(0);
    expect(canWriteNarrative(p, c.id)).toBe(false);
    c.approvedRevision = c.revision;
    editNarrative(p, c.id, 'My text');
    setChainItem(p, c.id, p.drivers[0].id, null);
    p.hypotheses.forEach((h) => {
      h.approved = false;
    });
    expect(prerequisite(p, 6)).toBeNull();
    editNarrative(p, c.id, 'My revised text');
    expect(p.narratives[0].working).toBe('My revised text');
    expect(p.narratives[0].chainRevision).toBe(1);
    expect(p.narratives[0].review).toBe(true);
  });
  it('freezes the human original at the review milestone and preserves formatting and exports', () => {
    const p = exercise();
    p.chains = p.chains.slice(0, 1);
    const c = p.chains[0];
    editNarrative(p, c.id, '## Future\n\n**My own prose** with an open question.');
    expect(p.narratives[0].original).toBeUndefined();
    prepareNarrativeReview(p);
    const original = structuredClone(p.narratives[0].original);
    editNarrative(p, c.id, 'Changed later');
    snapshotNarrative(p, c.id);
    expect(p.narratives[0].original).toEqual(original);
    editNarrative(p, c.id, original!.text);
    const restored = parseProject(JSON.parse(projectJSON(p)));
    expect(restored.narratives[0].original?.source).toBe('user');
    expect(restored.narratives[0].chosenId).toBeNull();
    expect(markdown(restored)).toContain('**My own prose**');
    expect(restored.narratives[0].history).toContain('Changed later');
  });
  it('derives legacy originals from chosen AI drafts without altering working or final text', () => {
    const p = exercise();
    const n = narrativeFor(p, p.chains[0].id);
    const d = proposal(p);
    n.chosenId = d.id;
    n.working = 'Later human edits';
    n.final = 'Earlier final';
    n.history = ['Previous'];
    const restored = parseProject(p).narratives[0];
    expect(restored.original).toMatchObject({ text: d.text, source: 'ai', chainRevision: 1 });
    expect(restored.working).toBe(n.working);
    expect(restored.final).toBe(n.final);
    expect(restored.history).toEqual(n.history);
    expect(restored.drafts).toEqual(n.drafts);
  });
  it('exports a truthful empty state for whitespace-only text', () => {
    const p = exercise();
    editNarrative(p, p.chains[0].id, '  ');
    expect(markdown(p)).toContain('_No narrative written yet._');
  });
});

describe('explicit AI proposals', () => {
  it('applies an edit only explicitly, retaining the human original, final and undo history', () => {
    const p = exercise();
    const c = p.chains[0];
    editNarrative(p, c.id, 'My scenario');
    const d = proposal(p, 'My scenario');
    const n = p.narratives[0];
    n.final = 'Earlier final';
    p.completed.push(7, 8);
    expect(n.working).toBe('My scenario');
    expect(proposalIsCurrent(p, c.id, d.id)).toBe(true);
    applyNarrativeProposal(p, c.id, d.id);
    expect(n.working).toBe(d.text);
    expect(n.original?.text).toBe('My scenario');
    expect(n.original?.source).toBe('user');
    expect(n.final).toBe('Earlier final');
    expect(p.completed).not.toContain(7);
    undoNarrative(p, c.id);
    expect(n.working).toBe('My scenario');
    undoNarrative(p, c.id, true);
    expect(n.working).toBe(d.text);
    expect(parseProject(JSON.parse(projectJSON(p))).narratives[0].drafts[0]).toEqual(n.drafts[0]);
  });
  it('uses an accepted generated draft as the original when there is no human text', () => {
    const p = exercise();
    const d = proposal(p);
    d.kind = 'initial';
    applyNarrativeProposal(p, p.chains[0].id, d.id);
    const n = p.narratives[0];
    expect(n.original?.source).toBe('ai');
    expect(n.original?.text).toBe(d.text);
    expect(n.chosenId).toBe(d.id);
    undoNarrative(p, n.chainId);
    expect(n.working).toBe('');
    expect(n.original?.text).toBe(d.text);
  });
  it.each(['text', 'chain', 'dismissed', 'unapproved'] as const)(
    'cannot apply a %s-stale or dismissed proposal',
    (change) => {
      const p = exercise();
      const c = p.chains[0];
      editNarrative(p, c.id, 'My scenario');
      const d = proposal(p, 'My scenario');
      if (change === 'text') editNarrative(p, c.id, 'Newer writing');
      if (change === 'chain') c.revision++;
      if (change === 'unapproved') c.approvedRevision = null;
      if (change === 'dismissed') p.narratives[0].drafts[0].status = 'dismissed';
      const before = p.narratives[0].working;
      expect(proposalIsCurrent(p, c.id, d.id)).toBe(false);
      applyNarrativeProposal(p, c.id, d.id);
      expect(p.narratives[0].working).toBe(before);
      expect(p.narratives[0].drafts).toHaveLength(1);
    }
  );
});
