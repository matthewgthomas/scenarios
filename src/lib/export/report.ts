import { Marked, type Token, type Tokens } from 'marked';
import { showModeLabels } from '$lib/config/presentation';
import {
  activeChains,
  activeDrivers,
  chainExplanation,
  coordinates,
  spent,
  statesFor,
  uncertainties,
  type Chain,
  type Driver,
  type Project
} from '$lib/domain/project';

export const palette = {
  ink: '233D33',
  muted: '546B60',
  green: '245C47',
  pale: 'E6EFE8',
  line: 'DBE5DD',
  paper: 'F3F7F4',
  amber: 'FCF5DF',
  amberInk: '715B24',
  scenarios: ['E0ECE4', 'E1EAF3', 'F4EBCE', 'EEE7F3', 'F4E5DF', 'E1EDEF']
};
export type Run = { text: string; bold?: boolean; italic?: boolean; code?: boolean; link?: string };
export type Text = {
  kind: 'text';
  runs: Run[];
  style?: 'body' | 'lead' | 'small' | 'label' | 'notice' | 'quote' | 'code';
  prefix?: string;
  depth?: number;
};
export type Heading = { kind: 'heading'; text: string; level: 2 | 3 | 4 };
export type Card = {
  kind: 'card';
  label: string;
  title: string;
  text?: string;
  meta?: string;
  fill?: string;
  connected?: boolean;
};
export type Cell = { text: string; fill?: string; bold?: boolean };
export type ReportTable = { kind: 'table'; headers: Cell[]; rows: Cell[][]; widths: number[] };
export type MatrixPoint = {
  label: string;
  impact: number;
  uncertainty: number;
  selected: boolean;
  drivers: { id: string; title: string; selected: boolean }[];
};
export type Matrix = { kind: 'matrix'; points: MatrixPoint[] };
export type Block = Text | Heading | Card | ReportTable | Matrix;
export type ReportSection = {
  label: string;
  title: string;
  titlePage?: boolean;
  fill?: string;
  blocks: Block[];
};
export type Report = { title: string; sections: ReportSection[] };

export const text = (value: string, style?: Text['style']): Text => ({
  kind: 'text',
  runs: [{ text: value }],
  style
});
const heading = (value: string, level: Heading['level'] = 2): Heading => ({
  kind: 'heading',
  text: value,
  level
});
const lexer = new Marked();
export function safeLink(href: string): string | undefined {
  try {
    const url = new URL(href);
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
function inline(tokens: Token[], inherited: Omit<Run, 'text'> = {}): Run[] {
  return tokens.flatMap((token): Run[] => {
    if (token.type === 'strong')
      return inline((token as Tokens.Strong).tokens, { ...inherited, bold: true });
    if (token.type === 'em')
      return inline((token as Tokens.Em).tokens, { ...inherited, italic: true });
    if (token.type === 'link')
      return inline((token as Tokens.Link).tokens, {
        ...inherited,
        link: safeLink((token as Tokens.Link).href)
      });
    if (token.type === 'codespan')
      return [{ ...inherited, code: true, text: (token as Tokens.Codespan).text }];
    if (token.type === 'br') return [{ ...inherited, text: '\n' }];
    if (token.type === 'html' || token.type === 'image') return [];
    if ('tokens' in token && token.tokens) return inline(token.tokens as Token[], inherited);
    return [{ ...inherited, text: 'text' in token ? String(token.text) : token.raw }];
  });
}
/** Parse supported editor content without rendering arbitrary HTML or fetching images. */
export function narrativeBlocks(source: string): (Text | Heading)[] {
  function blocks(tokens: Token[], depth = 0, quoted = false): (Text | Heading)[] {
    return tokens.flatMap((token): (Text | Heading)[] => {
      switch (token.type) {
        case 'space':
        case 'html':
          return [];
        case 'heading':
          return [
            heading(
              inline((token as Tokens.Heading).tokens)
                .map((r) => r.text)
                .join(''),
              Math.min(4, (token as Tokens.Heading).depth + 1) as Heading['level']
            )
          ];
        case 'blockquote':
          return blocks((token as Tokens.Blockquote).tokens, depth, true);
        case 'code':
          return [text((token as Tokens.Code).text, 'code')];
        case 'list': {
          const list = token as Tokens.List;
          return list.items.flatMap((item, index) => {
            const content = blocks(item.tokens, depth + 1, quoted);
            const first = content.find((b): b is Text => b.kind === 'text');
            if (first) first.prefix = list.ordered ? `${Number(list.start || 1) + index}.` : '•';
            return content;
          });
        }
        case 'paragraph':
        case 'text': {
          const t = token as Tokens.Paragraph;
          return [
            {
              kind: 'text',
              runs: t.tokens ? inline(t.tokens) : [{ text: t.text }],
              depth,
              style: quoted ? 'quote' : 'body'
            }
          ];
        }
        case 'hr':
          return [];
        default:
          return 'text' in token ? [text(String(token.text))] : [];
      }
    });
  }
  return blocks(lexer.lexer(source));
}

export function scoreBasis(d: Driver): string {
  if (d.origin === 'wildcard') return 'Unscored disruption driver';
  if (d.decision?.revision === d.revision) return 'Analyst-approved scores';
  const scores = coordinates(d);
  if (scores.impact !== null || scores.uncertainty !== null)
    return 'Provisional AI median · not analyst-approved';
  return 'Scores missing · not analyst-approved';
}
const score = (value: number | null) => (value === null ? 'Missing' : String(value));
const scoreLine = (d: Driver) => {
  const c = coordinates(d);
  return `Impact ${score(c.impact)} / 5 · Uncertainty ${score(c.uncertainty)} / 5`;
};
export function matrixPoints(p: Project): MatrixPoint[] {
  const points: MatrixPoint[] = [];
  for (const d of activeDrivers(p)) {
    const c = coordinates(d);
    if (c.impact === null || c.uncertainty === null) continue;
    let point = points.find((g) => g.impact === c.impact && g.uncertainty === c.uncertainty);
    if (!point) {
      point = {
        label: `P${points.length + 1}`,
        impact: c.impact,
        uncertainty: c.uncertainty,
        selected: false,
        drivers: []
      };
      points.push(point);
    }
    point.selected ||= d.selected;
    point.drivers.push({ id: d.id, title: d.title, selected: d.selected });
  }
  return points;
}
export function hypothesisChoice(p: Project, c: Chain, driverId: string) {
  const h = p.hypotheses.find((h) => h.id === c.items[driverId]);
  return {
    title:
      h?.title ?? (Object.hasOwn(c.items, driverId) ? 'Deliberately unresolved' : 'Not chosen yet'),
    description: h?.description ?? '',
    status: h?.archived
      ? 'Removed state · review suggested'
      : h
        ? 'Hypothetical future state'
        : 'No outcome has been assumed'
  };
}
function scenarioStatus(p: Project, c: Chain) {
  const n = p.narratives.find((n) => n.chainId === c.id);
  const status = !n?.working.trim()
    ? 'No narrative yet'
    : n.final !== null && n.final === n.working
      ? 'Final snapshot recorded'
      : 'Working draft';
  const combination =
    c.approvedRevision === c.revision ? 'Combination approved' : 'Combination not approved';
  return `${status} · ${combination}${c.review || n?.review ? ' · Review suggested after an upstream edit' : ''}`;
}
function labelled(label: string, value: string): Text {
  return { kind: 'text', runs: [{ text: `${label}: `, bold: true }, { text: value }] };
}

export function buildReport(p: Project, annotations = false, full = false): Report {
  const chosen = uncertainties(p);
  const chains = activeChains(p);
  const selected = chains.filter((c) => c.selected);
  const sections: ReportSection[] = [];
  const add = (section: ReportSection) => {
    sections.push(section);
    return section.blocks;
  };
  const overview = add({ label: 'Overview', title: p.title, titlePage: true, blocks: [] });
  overview.push(
    text('Scenario report', 'label'),
    text(p.question || 'No analysis question recorded.', 'lead')
  );
  overview.push(labelled('Time horizon', p.horizon || 'Not recorded'));
  overview.push(
    text(
      `${selected.length} selected ${selected.length === 1 ? 'scenario' : 'scenarios'} · ${chosen.length} chosen critical ${chosen.length === 1 ? 'uncertainty' : 'uncertainties'}`,
      'label'
    )
  );
  const finals = selected.filter((c) => {
    const n = p.narratives.find((n) => n.chainId === c.id);
    return n?.working.trim() && n.final !== null && n.final === n.working && !n.review && !c.review;
  }).length;
  overview.push(
    text(
      !selected.length
        ? 'No scenarios selected yet.'
        : finals === selected.length
          ? 'Final snapshots recorded for the selected scenario set.'
          : `Working report · ${finals} of ${selected.length} scenarios have current final snapshots without review flags.`,
      'notice'
    )
  );
  overview.push(
    text(
      `${showModeLabels ? 'Quick Mode · ' : ''}Hypothetical futures, not forecasts.${p.example ? ' This is an authored example exercise.' : ''}`,
      'small'
    )
  );
  overview.push(
    heading('How to read this report'),
    text(
      'Start with the chosen critical uncertainties, then use the matrix to see their assessed impact and uncertainty. Compare the scenario combinations before reading each story and its hypothesis chain.'
    )
  );
  if (selected.length)
    overview.push(text(selected.map((c, i) => `${i + 1}. ${c.title}`).join('\n'), 'small'));
  overview.push(heading('Chosen critical uncertainties'));
  overview.push(
    text(
      'These are the drivers selected by the analyst to structure the scenarios. Selection is explicit; it is not automatically determined by scores.',
      'small'
    )
  );
  if (!chosen.length)
    overview.push(text('No critical uncertainties have been selected.', 'notice'));
  chosen.forEach((d, i) =>
    overview.push({
      kind: 'card',
      label: `U${i + 1} · Selected critical uncertainty`,
      title: d.title,
      text: d.summary,
      meta: `${scoreLine(d)}\n${scoreBasis(d)}`,
      fill: palette.pale
    })
  );

  const points = matrixPoints(p);
  const matrix = add({ label: 'Assessment matrix', title: 'Impact and uncertainty', blocks: [] });
  matrix.push(
    text(
      'Compare all active assessed drivers. Higher values mean greater humanitarian impact or greater uncertainty; these ordinal judgements are not probabilities.'
    )
  );
  matrix.push({ kind: 'matrix', points });
  matrix.push(
    text(
      'Figure 1. Humanitarian impact by uncertainty. Filled squares contain at least one selected critical uncertainty; open circles contain other drivers. Coincident scores share one point. Point references identify every member in the key below.',
      'small'
    )
  );
  matrix.push(heading('Driver key and score provenance'));
  matrix.push({
    kind: 'table',
    widths: [0.13, 0.39, 0.18, 0.3],
    headers: ['Point', 'Driver and selection', 'Impact / uncertainty', 'Score basis'].map((t) => ({
      text: t
    })),
    rows: activeDrivers(p).map((d) => {
      const point = points.find((g) => g.drivers.some((member) => member.id === d.id));
      const c = coordinates(d);
      const u = chosen.findIndex((u) => u.id === d.id);
      return [
        { text: point?.label ?? 'Not plotted' },
        {
          text: `${u >= 0 ? `U${u + 1} · ` : ''}${d.title}\n${d.selected ? 'Selected critical uncertainty' : 'Not selected'}`,
          fill: d.selected ? palette.pale : undefined,
          bold: d.selected
        },
        { text: `${score(c.impact)} / ${score(c.uncertainty)}` },
        { text: scoreBasis(d) }
      ];
    })
  });
  if (!activeDrivers(p).length) matrix.push(text('No active drivers to plot yet.', 'notice'));
  if (activeDrivers(p).some((d) => Object.values(coordinates(d)).includes(null)))
    matrix.push(
      text(
        'Drivers with missing scores are listed in the key but are not plotted. Earlier-revision ratings are excluded from plotted positions.',
        'small'
      )
    );

  if (!selected.length)
    add({
      label: 'Scenario comparison',
      title: 'Scenario combinations',
      blocks: [text('No scenarios selected yet.', 'notice')]
    });
  for (let offset = 0; offset < selected.length; offset += 2) {
    const panel = selected.slice(offset, offset + 2);
    const comparison = add({
      label: 'Scenario comparison',
      title: 'Scenario combinations',
      blocks: []
    });
    comparison.push(
      text(
        `Selected scenarios ${offset + 1}–${offset + panel.length} of ${selected.length}. Each column combines one hypothetical state for each chosen critical uncertainty.`,
        'small'
      )
    );
    panel
      .filter((c) => c.title.length > 100)
      .forEach((c) => comparison.push(labelled(`Scenario ${selected.indexOf(c) + 1}`, c.title)));
    comparison.push({
      kind: 'table',
      widths: panel.length === 1 ? [0.36, 0.64] : [0.28, 0.36, 0.36],
      headers: [
        { text: 'Critical uncertainty' },
        ...panel.map((c) => ({
          text:
            c.title.length > 100
              ? `Scenario ${selected.indexOf(c) + 1}`
              : `${selected.indexOf(c) + 1}. ${c.title}`,
          fill: palette.scenarios[c.colour - 1]
        }))
      ],
      rows: chosen.map((d, i) => [
        { text: `U${i + 1}\n${d.title}`, bold: true },
        ...panel.map((c) => {
          const h = hypothesisChoice(p, c, d.id);
          return {
            text: `${h.title}${h.status !== 'Hypothetical future state' ? `\n${h.status}` : ''}`
          };
        })
      ])
    });
    if (!chosen.length)
      comparison.push(text('No critical uncertainties have been selected.', 'notice'));
    comparison.push(
      text(
        'Read down a column to see a hypothesis chain; read across a row to compare alternative states. The grid does not imply likelihood, rank or causal sequence.',
        'small'
      )
    );
  }

  selected.forEach((c, index) => {
    const n = p.narratives.find((n) => n.chainId === c.id);
    const fill = palette.scenarios[c.colour - 1];
    const story = add({
      label: `Scenario ${index + 1}`,
      title: c.title,
      fill,
      blocks: [
        text(scenarioStatus(p, c), 'notice'),
        heading('Hypothesis chain'),
        text(
          'One hypothetical state per chosen critical uncertainty. Connections indicate a combination, not a causal or chronological sequence.',
          'small'
        )
      ]
    });
    chosen.forEach((d, i) => {
      const h = hypothesisChoice(p, c, d.id);
      story.push({
        kind: 'card',
        label: `U${i + 1} · ${d.title}`,
        title: h.title,
        text: annotations ? h.description : undefined,
        meta: h.status,
        fill,
        connected: i < chosen.length - 1
      });
    });
    if (!chosen.length) story.push(text('No critical uncertainties have been selected.', 'notice'));
    story.push(heading('Scenario narrative'));
    story.push(
      ...(n?.working.trim()
        ? narrativeBlocks(n.working)
        : [text('No narrative written yet.', 'notice')])
    );
    const unresolved = chosen.filter((d) => !c.items[d.id]);
    if (unresolved.length)
      story.push(
        text(
          `Unresolved uncertainties: ${unresolved.map((d) => d.title).join(', ')}. No outcome has been assumed.`,
          'notice'
        )
      );
    if (annotations) {
      story.push(heading('Combination annotations'));
      const latest = c.notes.at(-1);
      if (latest)
        story.push(
          labelled(
            `Assumptions (${latest.modelId}, checked revision ${latest.revision})`,
            latest.assumptions.join('; ') || 'None recorded.'
          )
        );
      else story.push(text('No combination assumptions recorded.', 'small'));
      story.push(
        text(
          'These annotations describe hypotheses and assumptions, not historical evidence or citations.',
          'small'
        )
      );
    }
  });

  if (full) {
    const context = add({
      label: 'Analytical record',
      title: 'Research and background assumptions',
      blocks: []
    });
    context.push(
      heading('Desk review and consultation notes'),
      ...narrativeBlocks(p.researchNotes?.trim() || 'No notes recorded.')
    );
    context.push(
      heading('Background assumptions'),
      ...narrativeBlocks(p.backgroundAssumptions?.trim() || 'No background assumptions recorded.')
    );
    const drivers = add({
      label: 'Analytical record · Drivers',
      title: 'Drivers and decisions',
      blocks: []
    });
    for (const d of p.drivers.filter((d) => !d.archived)) {
      drivers.push(heading(d.title));
      drivers.push(
        text(
          chosen.some((u) => u.id === d.id)
            ? 'Selected critical uncertainty'
            : d.origin === 'wildcard'
              ? 'Additional disruption driver'
              : 'Not selected as a critical uncertainty',
          'label'
        )
      );
      drivers.push(
        text(d.summary),
        labelled(
          'Origin and revision',
          `${d.origin === 'wildcard' ? 'additional disruption driver' : d.origin} · revision ${d.revision}`
        )
      );
      drivers.push(
        text(
          d.origin === 'wildcard'
            ? `Unscored. ${d.assessment ?? ''}`
            : `${scoreLine(d)}\n${scoreBasis(d)}\nDecision: ${d.decision?.type ?? 'Not approved'}${d.decision && d.decision.revision !== d.revision ? ` (earlier revision ${d.decision.revision})` : ''}`,
          'notice'
        )
      );
      if (d.evidence) {
        if (d.evidence.sources.length) {
          drivers.push(heading('Sources', 3));
          d.evidence.sources.forEach((url) =>
            drivers.push({ kind: 'text', runs: [{ text: url, link: safeLink(url) }] })
          );
        }
        for (const [label, value] of [
          ['Research and consultation notes', d.evidence.notes],
          ['Analyst rationale', d.evidence.rationale],
          ['Represented and missing perspectives', d.evidence.perspectives]
        ])
          if (value.trim()) drivers.push(heading(label, 3), ...narrativeBlocks(value));
      }
      if (d.ratings.length) drivers.push(heading('Model assessments', 3));
      for (const r of d.ratings)
        drivers.push(
          labelled(
            `${r.modelId} · impact ${r.impact}, uncertainty ${r.uncertainty} · ${r.driverRevision === d.revision ? 'current' : 'earlier'} revision ${r.driverRevision}`,
            r.rationale
          )
        );
      for (const o of d.origins) drivers.push(labelled(`Original proposal (${o.modelId})`, o.text));
      if (statesFor(p, d.id).length) drivers.push(heading('Hypotheses', 3));
      for (const h of statesFor(p, d.id))
        drivers.push({
          kind: 'card',
          label: `Hypothesis ${h.id} · revision ${h.revision}`,
          title: h.title,
          text: h.description,
          meta: h.approved ? 'Analyst-approved' : 'Not approved'
        });
    }
    if (!p.drivers.some((d) => !d.archived)) drivers.push(text('No active drivers recorded.'));
    const reasoning = add({
      label: 'Analytical record · Combinations',
      title: 'Combination reasoning',
      blocks: []
    });
    for (const c of chains) {
      reasoning.push(
        heading(c.title),
        text(
          `${c.selected ? 'Included in selected set' : 'Candidate not selected'} · Revision ${c.revision}; approved revision ${c.approvedRevision ?? 'none'}.`,
          'label'
        ),
        text(c.distinctiveness)
      );
      if (chainExplanation(c))
        reasoning.push(
          labelled(
            `What connects these choices (${c.explanation == null ? 'original model explanation' : 'analyst explanation'})`,
            chainExplanation(c)
          )
        );
      for (const driverId of new Set([...chosen.map((d) => d.id), ...Object.keys(c.items)])) {
        const h = hypothesisChoice(p, c, driverId);
        reasoning.push(
          labelled(
            p.drivers.find((d) => d.id === driverId)?.title ?? driverId,
            `${h.title}${h.status === 'Removed state · review suggested' ? ` · ${h.status}` : ''}`
          )
        );
      }
      for (const note of c.notes)
        reasoning.push(
          heading(`${note.modelId} assessment`, 3),
          text(`Checked revision ${note.revision} · ${note.at}`, 'small'),
          text(note.reasoning),
          labelled('Tensions', note.tensions.join('; ')),
          labelled('Assumptions', note.assumptions.join('; '))
        );
    }
    if (!chains.length) reasoning.push(text('No active scenario combinations recorded.'));
    const operations = add({
      label: 'Analytical record · Operations',
      title: 'Operation record',
      blocks: [text(`Confirmed spending: $${spent(p).toFixed(4)} USD.`, 'notice')]
    });
    for (const r of p.runs)
      operations.push(
        heading(`${r.task} · ${r.modelId}`, 3),
        text(`${r.status} · Input revision ${r.inputRevision} · ${r.at}`, 'label'),
        text(
          `Cost: ${r.confirmed === null ? `unknown (${r.costBasis === 'allowance' ? 'budget reservation' : 'estimate'} $${r.estimated.toFixed(4)})` : `$${r.confirmed.toFixed(4)}`}. ${r.resolvedModelId ? `Answered by ${r.resolvedModelId}. ` : ''}${r.reasoningEffort ? `Thinking effort: ${r.reasoningEffort}. ` : ''}${r.modelId === 'openrouter/fusion' ? `Fusion panel ${r.fusionInvoked ? 'consulted' : 'not completed'}. ` : ''}${r.error ?? ''}`
        )
      );
    if (!p.runs.length) operations.push(text('No model operations recorded.'));
    operations.push(heading('Revision log'));
    for (const e of p.events)
      operations.push(text(`${e.at} · Revision ${e.revision}\n${e.message}`, 'small'));
    if (!p.events.length) operations.push(text('No revision events recorded.'));
  }
  return { title: p.title, sections };
}
