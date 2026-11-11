import { describe, expect, it } from 'vitest';
import { exampleProject } from './example';
import { parseProject, newProject, approveDriverScores, setChainItem } from './project';
import { chainReadiness, approveChainSet } from './workflow';
import { projectJSON, analyticalJSON, markdown } from '$lib/export/files';
import { contextFor } from '$lib/ai/openrouter';

describe('research and explicit analytical decisions', () => {
  it('retains research and judgement through backup, analytical JSON and full text export', () => {
    const p = exampleProject();
    p.researchNotes = 'Desk review and consultation on 10 November.';
    p.backgroundAssumptions = 'Health services remain under pressure across all scenarios.';
    p.drivers[0].evidence = {
      sources: ['https://example.org/energy-review'],
      notes: 'Consultations disagree on access to heating support.',
      rationale: 'Score 5 for consequences; 4 for several credible trajectories.',
      perspectives:
        'Renters were consulted; experiences of people without stable homes are missing.'
    };
    approveDriverScores(p, p.drivers[0].id, 5, 4);
    const restored = parseProject(JSON.parse(projectJSON(p)));
    expect(restored.drivers[0].evidence).toEqual(p.drivers[0].evidence);
    expect(restored.researchNotes).toBe(p.researchNotes);
    expect(restored.backgroundAssumptions).toBe(p.backgroundAssumptions);
    const data = JSON.parse(analyticalJSON(restored));
    expect(data.drivers[0].evidence).toEqual(p.drivers[0].evidence);
    const report = markdown(restored, true, true);
    for (const text of [
      p.researchNotes,
      p.backgroundAssumptions,
      ...Object.values(p.drivers[0].evidence).flat()
    ])
      expect(report).toContain(text);
  });

  it('sends explicit background assumptions without sending local research notes or sources', () => {
    const p = exampleProject();
    p.backgroundAssumptions = 'Services stay under pressure.';
    p.researchNotes = 'LOCAL_EXERCISE_NOTES';
    p.drivers.forEach((d) => {
      d.evidence = {
        sources: ['LOCAL_SOURCE'],
        notes: 'LOCAL_NOTES',
        rationale: 'LOCAL_JUDGEMENT',
        perspectives: 'LOCAL_PERSPECTIVES'
      };
    });
    p.chains[0].wildcardDriverIds = [p.drivers[0].id];
    for (const task of [
      'drivers',
      'ratings',
      'hypotheses',
      'chains',
      'narrative',
      'narrative_edit',
      'consolidate'
    ] as const) {
      const context = contextFor(
        p,
        task,
        task.startsWith('narrative') ? [p.chains[0].id] : undefined
      );
      expect(context.backgroundAssumptions).toBe(p.backgroundAssumptions);
      expect(JSON.stringify(context)).not.toContain('LOCAL_');
    }
  });

  it('does not treat a not-yet-chosen outcome as deliberately unresolved', () => {
    const p = exampleProject();
    const c = p.chains[0];
    const driverId = p.drivers[0].id;
    delete c.items[driverId];
    expect(chainReadiness(p).canApprove).toBe(false);
    expect(approveChainSet(p)).toBe(false);
    expect(
      chainReadiness(p).issues.some((i) => i.chainId === c.id && i.driverId === driverId)
    ).toBe(true);
    const restored = parseProject(JSON.parse(projectJSON(p)));
    expect(Object.hasOwn(restored.chains[0].items, driverId)).toBe(false);
    expect(markdown(restored, true, true)).toContain(`${p.drivers[0].title}: Not chosen yet`);
    setChainItem(restored, c.id, driverId, null);
    expect(chainReadiness(restored).canApprove).toBe(true);
    expect(markdown(restored, true, true)).toContain(
      `${p.drivers[0].title}: Deliberately unresolved`
    );
    expect(approveChainSet(restored)).toBe(true);
  });

  it('starts without an implied manual score and uses a single starter model', () => {
    const p = newProject();
    expect(p.models).toHaveLength(1);
    expect(p.reasoningEfforts[p.models[0]]).toBe('medium');
    expect(p.drivers).toEqual([]);
  });
});
