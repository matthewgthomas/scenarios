import { showModeLabels } from '$lib/config/presentation';
import {
  parseProject,
  activeChains,
  chainExplanation,
  uncertainties,
  coordinates,
  spent,
  statesFor,
  type Project
} from '$lib/domain/project';
import pdfFontUrl from '$lib/assets/NunitoSans-Regular.ttf?url';

export function download(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const filename = (p: Project) =>
  p.title
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'scenario-exercise';
export function projectJSON(p: Project) {
  return JSON.stringify(parseProject(p), null, 2);
}
export function analyticalJSON(p: Project) {
  const { stage, overrides, ...data } = parseProject(p);
  return JSON.stringify(
    { ...data, exportType: 'analytical-record', exportedAt: new Date().toISOString() },
    null,
    2
  );
}
export function markdown(p: Project, annotations = false, full = false): string {
  let text = `# ${p.title}\n\n${p.question}\n\nTime horizon: ${p.horizon}\n\n${showModeLabels ? 'Quick Mode — hypothetical' : 'Hypothetical'} futures, not forecasts.${p.example ? ' This is an authored example exercise.' : ''}\n\n`;
  for (const c of activeChains(p).filter((c) => c.selected)) {
    const n = p.narratives.find((n) => n.chainId === c.id);
    text += `## ${c.title}\n\n`;
    text += `${n?.working.trim() ? n.working : '_No narrative written yet._'}\n\n`;
    if (n?.review || c.review) text += '_Review suggested after an upstream edit._\n\n';
    const unresolved = uncertainties(p).filter((d) => !c.items[d.id]);
    if (unresolved.length)
      text += `Unresolved uncertainties: ${unresolved.map((d) => d.title).join(', ')}. No outcome has been assumed.\n\n`;
    if (annotations) {
      text += '### Scenario hypotheses and assumptions\n\n';
      for (const d of uncertainties(p))
        text += `- ${d.title}: ${p.hypotheses.find((h) => h.id === c.items[d.id])?.title ?? (Object.hasOwn(c.items, d.id) ? 'Deliberately unresolved' : 'Not chosen yet')} (hypothetical future state).\n`;
      const latest = c.notes.at(-1);
      if (latest)
        text += `\nAssumptions (${latest.modelId}, checked revision ${latest.revision}): ${latest.assumptions.join('; ')}\n`;
      text += '\nThese are chain-level annotations, not historical evidence or citations.\n\n';
    }
  }
  if (full) {
    text += '## Analytical record\n\n';
    if (p.researchNotes?.trim())
      text += `### Desk review and consultation notes\n\n${p.researchNotes}\n\n`;
    if (p.backgroundAssumptions?.trim())
      text += `### Background assumptions\n\n${p.backgroundAssumptions}\n\n`;
    text += '### Drivers and decisions\n\n';
    for (const d of p.drivers.filter((d) => !d.archived)) {
      const scores = coordinates(d);
      text += `#### ${d.title}\n\n${d.summary}\n\nOrigin: ${d.origin === 'wildcard' ? 'additional disruption driver' : d.origin}. Revision: ${d.revision}. ${d.origin === 'wildcard' ? `Unscored. ${d.assessment ?? ''}` : `Humanitarian impact: ${scores.impact ?? 'Missing'}; uncertainty: ${scores.uncertainty ?? 'Missing'}. Decision: ${d.decision?.type ?? 'Not approved'}.`}\n\n`;
      if (d.evidence) {
        if (d.evidence.sources.length)
          text += `Sources:\n${d.evidence.sources.map((url) => `- ${url}`).join('\n')}\n\n`;
        if (d.evidence.notes.trim())
          text += `Research and consultation notes: ${d.evidence.notes}\n\n`;
        if (d.evidence.rationale.trim()) text += `Analyst rationale: ${d.evidence.rationale}\n\n`;
        if (d.evidence.perspectives.trim())
          text += `Represented and missing perspectives: ${d.evidence.perspectives}\n\n`;
      }
      for (const r of d.ratings)
        text += `- ${r.modelId}: impact ${r.impact}, uncertainty ${r.uncertainty}. ${r.rationale}\n`;
      for (const o of d.origins) text += `- Original proposal (${o.modelId}): ${o.text}\n`;
      for (const h of statesFor(p, d.id))
        text += `\nHypothesis ${h.id}, revision ${h.revision}: **${h.title}**. ${h.description} (${h.approved ? 'Analyst-approved' : 'Not approved'}).\n`;
      text += '\n';
    }
    text += '### Chain reasoning\n\n';
    for (const c of activeChains(p)) {
      text += `#### ${c.title}\n\nRevision ${c.revision}; approved revision ${c.approvedRevision ?? 'none'}. ${c.distinctiveness}\n\n`;
      if (chainExplanation(c))
        text += `What connects these choices${c.explanation == null ? ' (original model explanation)' : ' (analyst explanation)'}: ${chainExplanation(c)}\n\n`;
      for (const driverId of new Set([
        ...uncertainties(p).map((d) => d.id),
        ...Object.keys(c.items)
      ])) {
        const hId = c.items[driverId];
        text += `- ${p.drivers.find((d) => d.id === driverId)?.title ?? driverId}: ${p.hypotheses.find((h) => h.id === hId)?.title ?? (Object.hasOwn(c.items, driverId) ? 'Deliberately unresolved' : 'Not chosen yet')}\n`;
      }
      for (const note of c.notes)
        text += `\n${note.modelId}, checked revision ${note.revision}, ${note.at}: ${note.reasoning}\n\nTensions: ${note.tensions.join('; ')}\n\nAssumptions: ${note.assumptions.join('; ')}\n`;
    }
    text += `\n### Operation record\n\nConfirmed spending: $${spent(p).toFixed(4)} USD.\n\n`;
    for (const r of p.runs)
      text += `- ${r.task}: ${r.modelId}, ${r.status}, input revision ${r.inputRevision}, ${r.at}. Cost: ${r.confirmed === null ? `unknown (${r.costBasis === 'allowance' ? 'planning allowance' : 'estimate'} $${r.estimated.toFixed(4)})` : `$${r.confirmed.toFixed(4)}`}. ${r.resolvedModelId ? `Answered by ${r.resolvedModelId}. ` : ''}${r.reasoningEffort ? `Thinking effort: ${r.reasoningEffort}. ` : ''}${r.modelId === 'openrouter/fusion' ? `Fusion panel ${r.fusionInvoked ? 'consulted' : 'not completed'}. ` : ''}${r.error ?? ''}\n`;
    text += '\n### Revision log\n\n';
    for (const e of p.events) text += `- ${e.at}, revision ${e.revision}: ${e.message}\n`;
  }
  return text;
}
export async function exportDocx(p: Project, annotations: boolean, full: boolean) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
  const paragraphs = markdown(p, annotations, full)
    .split('\n')
    .map((line) => {
      const level = line.match(/^(#{1,4}) /)?.[1].length;
      const headings = [
        HeadingLevel.TITLE,
        HeadingLevel.HEADING_1,
        HeadingLevel.HEADING_2,
        HeadingLevel.HEADING_3
      ];
      const runs = line
        .replace(/^#{1,4} /, '')
        .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
        .filter(Boolean)
        .map(
          (t) =>
            new TextRun({
              text: t.replace(/^\*{1,2}|\*{1,2}$/g, ''),
              bold: t.startsWith('**'),
              italics: t.startsWith('*') && !t.startsWith('**')
            })
        );
      return new Paragraph({
        children: runs,
        ...(level ? { heading: headings[level - 1], keepNext: true } : {}),
        spacing: { after: 140 },
        ...(line.startsWith('- ')
          ? { bullet: { level: 0 }, children: [new TextRun(line.slice(2))] }
          : {})
      });
    });
  const doc = new Document({
    creator: 'Scenario Designer',
    title: p.title,
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22, color: '233D33' },
          paragraph: { spacing: { line: 300 } }
        }
      }
    },
    sections: [
      {
        properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        children: paragraphs
      }
    ]
  });
  download(
    await (await Packer.toBlob(doc)).arrayBuffer(),
    `${filename(p)}${full ? '-full-record' : ''}.docx`,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}
export async function exportPDF(p: Project, annotations: boolean, full: boolean) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  // A bundled Unicode font keeps place names and analytical text intact in PDF.
  const fontResponse = await fetch(pdfFontUrl);
  if (fontResponse.ok) {
    const bytes = new Uint8Array(await fontResponse.arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    doc.addFileToVFS('NunitoSans.ttf', btoa(binary));
    doc.addFont('NunitoSans.ttf', 'NunitoSans', 'normal');
    doc.setFont('NunitoSans');
  }
  let y = 23;
  const lines = markdown(p, annotations, full).split('\n');
  for (const line of lines) {
    if (!line.trim()) {
      y += 3;
      continue;
    }
    const level = line.match(/^(#{1,4}) /)?.[1].length;
    const fontSize = level === 1 ? 23 : level === 2 ? 17 : level ? 13 : 10.5;
    doc.setFontSize(fontSize);
    doc.setTextColor(35, 61, 51);
    const clean = line.replace(/^#{1,4} /, '').replace(/\*{1,2}/g, '');
    const wrapped: string[] = doc.splitTextToSize(clean, 164);
    const lineHeight = fontSize * 0.48;
    if (level && y + lineHeight * Math.min(3, wrapped.length + 1) > 272) {
      doc.addPage();
      y = 23;
    }
    for (const text of wrapped) {
      if (y + lineHeight > 277) {
        doc.addPage();
        y = 23;
      }
      doc.text(text, 23, y);
      y += lineHeight;
    }
    y += level ? 4 : 1;
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(84, 107, 96);
    doc.text(
      `Scenario Designer${showModeLabels ? ' | Quick Mode' : ''} | ${page} / ${pages}`,
      23,
      287
    );
  }
  download(
    doc.output('arraybuffer'),
    `${filename(p)}${full ? '-full-record' : ''}.pdf`,
    'application/pdf'
  );
}
