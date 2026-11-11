import { describe, it, expect } from 'vitest';
import { exampleProject } from './example';
import {
  activeChains,
  chainExplanation,
  editChainExplanation,
  archiveChain,
  includeChain,
  approvedChainSet,
  canWriteNarrative,
  parseProject
} from './project';
import {
  chainReadiness,
  approveChainSet,
  prerequisiteStage,
  completeScenarioSet
} from './workflow';
import { markdown, projectJSON, analyticalJSON } from '$lib/export/files';

describe('guided combination decisions', () => {
  it('keeps an explicitly blank manual explanation empty when its first model check arrives', () => {
    const p = exampleProject();
    const c = p.chains[0];
    const note = structuredClone(c.notes[0]);
    c.notes = [];
    editChainExplanation(p, c.id, '');
    expect(c.explanation).toBe('');
    c.notes.push(note);
    expect(chainExplanation(c)).toBe('');
    expect(parseProject(JSON.parse(projectJSON(p))).chains[0].explanation).toBe('');
  });

  it('starts from original reasoning, preserves an intentionally empty explanation, and imports old backups', () => {
    const p = exampleProject();
    const c = p.chains[0];
    const original = c.notes[0].reasoning;
    expect(chainExplanation(c)).toBe(original);
    editChainExplanation(p, c.id, '');
    c.notes.push({ ...c.notes[0], reasoning: 'A later model check.', revision: c.revision });
    expect(chainExplanation(c)).toBe('');
    const restored = parseProject(JSON.parse(projectJSON(p)));
    expect(restored.chains[0].explanation).toBe('');
    expect(restored.chains[0].snapshots?.[0].explanation).toBe(original);
    const legacy = JSON.parse(projectJSON(exampleProject()));
    legacy.chains.forEach((chain: Record<string, unknown>) => {
      delete chain.archived;
      delete chain.explanation;
    });
    const imported = parseProject(legacy);
    expect(imported.chains.every((c) => c.archived === false && c.explanation === null)).toBe(true);
    expect(chainExplanation(imported.chains[0])).toBe(original);
  });

  it('revisions explanation edits without changing model contributions or written prose', () => {
    const p = exampleProject();
    approveChainSet(p);
    const c = p.chains[0];
    const notes = structuredClone(c.notes);
    const text = p.narratives[0].working;
    editChainExplanation(p, c.id, 'Mutual aid grows as public support becomes less reliable.');
    expect(c.revision).toBe(2);
    expect(c.approvedRevision).toBe(1);
    expect(c.review).toBe(true);
    expect(p.completed).not.toContain(5);
    expect(p.narratives[0].working).toBe(text);
    expect(p.narratives[0].review).toBe(true);
    expect(c.notes).toEqual(notes);
    expect(approvedChainSet(p)).toBe(false);
    expect(approveChainSet(p)).toBe(true);
    expect(approvedChainSet(p)).toBe(true);
    expect(markdown(p, false, true)).toContain('(analyst explanation): Mutual aid grows');
  });

  it('removes combinations recoverably and excludes them even when an imported archive is marked selected', () => {
    const p = exampleProject();
    approveChainSet(p);
    const c = p.chains[0];
    const narrative = structuredClone(p.narratives[0]);
    const notes = structuredClone(c.notes);
    archiveChain(p, c.id);
    expect(c).toMatchObject({ archived: true, selected: false, review: true });
    expect(activeChains(p)).toHaveLength(2);
    expect(p.narratives[0].working).toBe(narrative.working);
    expect(c.notes).toEqual(notes);
    expect(c.snapshots).toHaveLength(1);
    expect(canWriteNarrative(p, c.id)).toBe(false);
    c.selected = true;
    expect(chainReadiness(p).selected).toHaveLength(2);
    expect(markdown(p, true, true)).not.toContain(c.title);
    expect(JSON.parse(analyticalJSON(p)).chains[0].archived).toBe(true);
    const restored = parseProject(JSON.parse(projectJSON(p)));
    archiveChain(restored, c.id, false);
    expect(restored.chains[0]).toMatchObject({ archived: false, selected: false, review: true });
    expect(restored.narratives[0].working).toBe(narrative.working);
    expect(restored.chains[0].approvedRevision).not.toBe(restored.chains[0].revision);
  });

  it.each([1, 2, 7, 20])('approves %i combinations regardless of legacy targets or types', (count) => {
    const p = exampleProject();
    const template = structuredClone(p.chains[0]);
    p.chains = Array.from({ length: count }, (_, i) => ({
      ...structuredClone(template),
      id: `chain-${i}`,
      kind: i % 2 ? 'main' : 'wildcard'
    }));
    p.narratives = [];
    p.mainCount = 12;
    p.wildcardCount = 6;
    expect(chainReadiness(p).canApprove).toBe(true);
    expect(approveChainSet(p)).toBe(true);
    expect(approvedChainSet(p)).toBe(true);
    const restored = parseProject(JSON.parse(projectJSON(p)));
    expect(restored.mainCount).toBe(12);
    expect(restored.chains).toHaveLength(count);
    expect(approvedChainSet(restored)).toBe(true);
  });

  it('blocks empty selections and preserves approval when legacy targets differ', () => {
    const p = exampleProject();
    p.chains.forEach((c) => includeChain(p, c.id, false));
    expect(chainReadiness(p).canApprove).toBe(false);
    expect(approveChainSet(p)).toBe(false);
    includeChain(p, p.chains[0].id, true);
    expect(approveChainSet(p)).toBe(true);
    p.mainCount = 12;
    p.wildcardCount = 6;
    expect(approvedChainSet(p)).toBe(true);
  });

  it('checks every candidate for the chooser but only included candidates block approval', () => {
    const p = exampleProject();
    p.chains[0].wildcardDriverIds = ['missing-driver'];
    includeChain(p, p.chains[0].id, false);
    expect(chainReadiness(p).candidateIssues).toHaveLength(1);
    expect(chainReadiness(p).issues).toHaveLength(0);
    expect(approveChainSet(p)).toBe(true);
    p.narratives = [];
    includeChain(p, p.chains[0].id, true);
    expect(prerequisiteStage(p, 6)).toBe(5);
  });

  it('ignores redundant edits', () => {
    const p = exampleProject();
    const original = structuredClone(p);
    editChainExplanation(p, p.chains[0].id, chainExplanation(p.chains[0]));
    includeChain(p, p.chains[0].id, p.chains[0].selected);
    expect(p).toEqual(original);
  });

  it('exports formerly labelled combinations without category headings and preserves their historical kind', () => {
    const p = exampleProject();
    p.chains.forEach((c) => (c.kind = 'wildcard'));
    expect(approveChainSet(p)).toBe(true);
    expect(markdown(p, true, true)).not.toContain('(Wildcard)');
    const restored = parseProject(JSON.parse(projectJSON(p)));
    expect(restored.chains.every((c) => c.kind === 'wildcard')).toBe(true);
    expect(approvedChainSet(restored)).toBe(true);
    expect(completeScenarioSet(restored)).toBe(true);
  });

  it('requires renewed combination approval before finalizing preserved narratives', () => {
    const p = exampleProject();
    approveChainSet(p);
    expect(completeScenarioSet(p)).toBe(true);
    editChainExplanation(p, p.chains[0].id, 'An updated connection.');
    expect(completeScenarioSet(p)).toBe(false);
    approveChainSet(p);
    expect(completeScenarioSet(p)).toBe(true);
  });
});
