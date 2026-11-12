import { describe, it, expect } from 'vitest';
import { exampleProject, finishedExampleProject } from '$lib/domain/example';
import { newProject } from '$lib/domain/project';
import {
  buildReport,
  matrixPoints,
  narrativeBlocks,
  scoreBasis,
  hypothesisChoice,
  type ReportTable
} from './report';

describe('structured PDF and Word reports', () => {
  it('always includes the chosen uncertainties, matrix, paired comparisons and individual chains without changing the project', () => {
    const p = exampleProject();
    const before = structuredClone(p);
    const report = buildReport(p);
    expect(report.sections[0].blocks.filter((b) => b.kind === 'card')).toHaveLength(5);
    expect(
      report.sections
        .find((s) => s.label === 'Assessment matrix')
        ?.blocks.some((b) => b.kind === 'matrix')
    ).toBe(true);
    const comparisons = report.sections.filter((s) => s.label === 'Scenario comparison');
    expect(comparisons).toHaveLength(2);
    const grids = comparisons.flatMap((s) =>
      s.blocks.filter((b): b is ReportTable => b.kind === 'table')
    );
    expect(grids.map((g) => g.headers.length)).toEqual([3, 2]);
    expect(grids.every((g) => g.rows.length === 5)).toBe(true);
    expect(
      report.sections
        .filter((s) => /^Scenario \d/.test(s.label))
        .every((s) => s.blocks.filter((b) => b.kind === 'card').length === 5)
    ).toBe(true);
    expect(p).toEqual(before);
  });

  it('keeps detailed research and assumptions behind the existing options', () => {
    const p = exampleProject();
    p.researchNotes = 'Private research sentinel';
    p.backgroundAssumptions = 'Background sentinel';
    p.drivers[0].evidence = {
      sources: ['https://example.org/source'],
      notes: 'Consultation sentinel',
      rationale: 'Rationale sentinel',
      perspectives: 'Perspectives sentinel'
    };
    p.chains[0].notes[0].assumptions = ['Assumption sentinel'];
    const basic = JSON.stringify(buildReport(p));
    expect(basic).not.toContain('sentinel');
    const annotated = JSON.stringify(buildReport(p, true));
    expect(annotated).toContain('Assumption sentinel');
    expect(annotated).not.toContain('Private research sentinel');
    const full = JSON.stringify(buildReport(p, false, true));
    for (const content of [
      'Private research sentinel',
      'Background sentinel',
      'Consultation sentinel',
      'Rationale sentinel',
      'Perspectives sentinel',
      'https://example.org/source',
      'Assumption sentinel',
      'Selected critical uncertainty',
      'Operation record',
      'Revision log'
    ])
      expect(full).toContain(content);
  });

  it('uses current score provenance, retains fractional medians and never plots missing or earlier scores', () => {
    const p = exampleProject();
    const [approved, provisional, missing] = p.drivers;
    provisional.decision = undefined;
    provisional.ratings = provisional.ratings.slice(0, 2);
    provisional.ratings[0].impact = 3;
    provisional.ratings[1].impact = 4;
    missing.revision++;
    expect(scoreBasis(approved)).toBe('Analyst-approved scores');
    expect(scoreBasis(provisional)).toContain('Provisional AI median');
    expect(scoreBasis(missing)).toContain('Scores missing');
    expect(
      matrixPoints(p).find((point) => point.drivers.some((d) => d.id === provisional.id))?.impact
    ).toBe(3.5);
    expect(matrixPoints(p).some((point) => point.drivers.some((d) => d.id === missing.id))).toBe(
      false
    );
    expect(JSON.stringify(buildReport(p))).toContain('Not plotted');
    expect(JSON.stringify(buildReport(p))).toContain('Scores missing');
  });

  it('groups coincident points without hiding selected or unselected members and excludes archived/disruption drivers', () => {
    const p = exampleProject();
    p.drivers[3].selected = false;
    p.drivers[6].archived = true;
    p.drivers[7].origin = 'wildcard';
    const points = matrixPoints(p);
    const energy = points.find((point) => point.drivers.some((d) => d.id === p.drivers[0].id))!;
    expect(energy.drivers.map((d) => d.title)).toEqual(['Household energy', 'Housing access']);
    expect(energy.drivers.map((d) => d.selected)).toEqual([true, false]);
    expect(energy.selected).toBe(true);
    expect(points.flatMap((g) => g.drivers)).toHaveLength(6);
  });

  it('preserves unresolved, missing and removed hypothesis choices and omits archived scenarios', () => {
    const p = exampleProject();
    const c = p.chains[0];
    c.items[p.drivers[0].id] = null;
    delete c.items[p.drivers[1].id];
    p.hypotheses.find((h) => h.id === c.items[p.drivers[2].id])!.archived = true;
    p.chains[2].archived = true;
    expect(hypothesisChoice(p, c, p.drivers[0].id).title).toBe('Deliberately unresolved');
    expect(hypothesisChoice(p, c, p.drivers[1].id).title).toBe('Not chosen yet');
    const content = JSON.stringify(buildReport(p, true, true));
    for (const label of [
      'Deliberately unresolved',
      'Not chosen yet',
      'Removed state · review suggested',
      'No outcome has been assumed'
    ])
      expect(content).toContain(label);
    expect(content).not.toContain('Public renewal');
  });

  it('exports current working text and truthful snapshot/review status', () => {
    const p = finishedExampleProject();
    expect(JSON.stringify(buildReport(p))).toContain(
      'Final snapshots recorded for the selected scenario set'
    );
    p.narratives[0].working = 'Current writing sentinel';
    p.narratives[1].review = true;
    const report = JSON.stringify(buildReport(p));
    expect(report).toContain('Current writing sentinel');
    expect(report).toContain('Working draft');
    expect(report).toContain('Review suggested');
    expect(report).toContain('1 of 3');
  });

  it('handles empty reports and large sets without imposing selection limits or squeezing comparison columns', () => {
    const empty = JSON.stringify(buildReport(newProject(), true, true));
    expect(empty).toContain('No scenarios selected yet');
    expect(empty).toContain('No critical uncertainties have been selected');
    const p = exampleProject();
    for (let i = 3; i < 7; i++)
      p.chains.push({ ...structuredClone(p.chains[0]), id: `extra_${i}`, title: `Scenario ${i}` });
    p.drivers.push({ ...structuredClone(p.drivers[0]), id: 'ninth', title: 'Ninth uncertainty' });
    p.drivers.forEach((d) => (d.selected = true));
    const report = buildReport(p);
    expect(report.sections.filter((s) => /^Scenario \d/.test(s.label))).toHaveLength(7);
    expect(report.sections[0].blocks.filter((b) => b.kind === 'card')).toHaveLength(9);
    expect(report.sections.filter((s) => s.label === 'Scenario comparison')).toHaveLength(4);
  });
});

describe('narrative formatting in reports', () => {
  it('retains emphasis, links, lists, explicit breaks, quotes and code without HTML or image loading', () => {
    const blocks = narrativeBlocks(
      '## A **clear** heading\n\nA **bold** and *italic* [source](https://example.org).\n\n3. First\n4. Second\n   - Nested\n\n> A quote\n\n```\nconst x = 1;\n```\n\n[Unsafe](javascript:alert(1))\n\n<script>secret()</script>\n\n![Hidden](https://example.org/image.png)'
    );
    expect(blocks[0]).toMatchObject({ kind: 'heading', text: 'A clear heading' });
    const texts = blocks.filter((b) => b.kind === 'text');
    expect(texts.some((b) => b.runs.some((r) => r.bold && r.text === 'bold'))).toBe(true);
    expect(texts.some((b) => b.runs.some((r) => r.italic && r.text === 'italic'))).toBe(true);
    expect(texts.some((b) => b.runs.some((r) => r.link === 'https://example.org/'))).toBe(true);
    expect(texts.filter((b) => b.prefix).map((b) => b.prefix)).toEqual(['3.', '4.', '•']);
    expect(texts.some((b) => b.style === 'quote')).toBe(true);
    expect(texts.some((b) => b.style === 'code')).toBe(true);
    expect(JSON.stringify(blocks)).not.toMatch(/javascript:|secret\(\)|image.png/);
  });
});
