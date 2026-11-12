import { jsPDF } from 'jspdf';
import regular from '$lib/assets/NunitoSans-Regular.ttf?url';
import bold from '$lib/assets/NunitoSans-Bold.ttf?url';
import italic from '$lib/assets/NunitoSans-Italic.ttf?url';
import boldItalic from '$lib/assets/NunitoSans-BoldItalic.ttf?url';
import { matrixDrawing, matrixSize } from './matrix';
import {
  palette,
  type Report,
  type Run,
  type Text,
  type Block,
  type Card,
  type ReportTable,
  type Cell
} from './report';

const left = 22,
  width = 166,
  top = 25,
  bottom = 273;
const mm = 25.4 / 72;
type Part = { run: Run; width: number };
type Line = Part[];
const plain = (value: string, strong = false): Run[] => [{ text: value, bold: strong }];
const fontStyle = (r: Run) =>
  r.bold ? (r.italic ? 'bolditalic' : 'bold') : r.italic ? 'italic' : 'normal';

let fonts: Promise<{ data: string; style: string }[]> | undefined;
async function loadFonts() {
  fonts ??= Promise.all(
    [
      [regular, 'normal'],
      [bold, 'bold'],
      [italic, 'italic'],
      [boldItalic, 'bolditalic']
    ].map(async ([url, style]) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Cannot load the report font.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return { data: btoa(binary), style };
    })
  ).catch((error) => {
    fonts = undefined;
    throw error;
  });
  return fonts;
}

class Layout {
  y = top;
  label = '';
  pages: string[] = [];
  constructor(readonly doc: jsPDF) {}
  font(run: Run, size: number) {
    this.doc.setFont('NunitoSans', fontStyle(run));
    this.doc.setFontSize(size);
  }
  page() {
    if (this.pages.length) this.doc.addPage();
    this.pages.push(this.label);
    this.y = top;
  }
  ensure(height: number) {
    if (this.y + height > bottom && this.y > top) this.page();
  }
  /** Wrap styled text by measured glyph width, including long URLs and explicit breaks. */
  wrap(runs: Run[], size: number, available = width): Line[] {
    const lines: Line[] = [[]];
    let used = 0;
    const next = () => {
      lines.push([]);
      used = 0;
    };
    for (const run of runs) {
      this.font(run, size);
      for (const token of run.text.match(/\n|[^\S\n]+|[^\s]+/gu) ?? []) {
        if (token === '\n') {
          next();
          continue;
        }
        const tokenWidth = this.doc.getTextWidth(token);
        if (!token.trim() && !used) continue;
        if (used + tokenWidth > available && used) next();
        if (!token.trim() && !used) continue;
        if (tokenWidth <= available) {
          lines.at(-1)!.push({ run: { ...run, text: token }, width: tokenWidth });
          used += tokenWidth;
        } else {
          for (const character of Array.from(token)) {
            const charWidth = this.doc.getTextWidth(character);
            if (used + charWidth > available && used) next();
            lines.at(-1)!.push({ run: { ...run, text: character }, width: charWidth });
            used += charWidth;
          }
        }
      }
    }
    return lines;
  }
  line(parts: Line, x: number, y: number, size: number, color = palette.ink) {
    for (const part of parts) {
      this.font(part.run, size);
      this.doc.setTextColor(part.run.link ? palette.green : color);
      if (part.run.code) {
        this.doc.setFillColor(palette.paper);
        this.doc.rect(x, y, part.width, size * mm * 1.2, 'F');
      }
      this.doc.text(part.run.text, x, y + size * mm * 0.88);
      if (part.run.link) {
        this.doc.setDrawColor(palette.green);
        this.doc.setLineWidth(0.15);
        this.doc.line(x, y + size * mm * 1.02, x + part.width, y + size * mm * 1.02);
        this.doc.link(x, y, part.width, size * mm * 1.3, { url: part.run.link });
      }
      x += part.width;
    }
  }
  paragraph(block: Text) {
    const style = block.style ?? 'body';
    const size =
      style === 'lead'
        ? 13
        : style === 'small' || style === 'label'
          ? 9.5
          : style === 'code'
            ? 10
            : 11;
    const height = size * mm * 1.4;
    const inset = style === 'notice' || style === 'code' || style === 'quote' ? 4 : 0;
    const indent = Math.min(block.depth ?? 0, 6) * 4;
    const source = block.runs.map((r) => ({
      ...r,
      bold: style === 'label' || r.bold,
      italic: style === 'quote' || r.italic
    }));
    const lines = this.wrap(source, size, width - inset * 2 - indent - (block.prefix ? 4 : 0));
    this.ensure(height * Math.min(lines.length, 2) + (style === 'label' ? 10 : 0));
    for (let i = 0; i < lines.length; i++) {
      if (lines.length - i === 2) this.ensure(height * 2);
      this.ensure(height);
      if (style === 'notice' || style === 'code') {
        this.doc.setFillColor(palette.paper);
        this.doc.rect(left + indent, this.y - 0.8, width - indent, height + 1, 'F');
      }
      if (style === 'quote') {
        this.doc.setDrawColor(palette.green);
        this.doc.setLineWidth(0.7);
        this.doc.line(left + indent, this.y, left + indent, this.y + height);
      }
      if (!i && block.prefix)
        this.line(this.wrap(plain(block.prefix), size, 12)[0], left + indent, this.y, size);
      this.line(
        lines[i],
        left + inset + indent + (block.prefix ? 4 : 0),
        this.y,
        size,
        style === 'small' ? palette.muted : style === 'label' ? palette.green : palette.ink
      );
      this.y += height;
    }
    this.y += style === 'small' || style === 'label' ? 2.5 : 4;
  }
  heading(value: string, size: number, title = false, fill?: string) {
    const lines = this.wrap(plain(value, true), size);
    const lineHeight = size * mm * 1.2;
    this.ensure(Math.min(lines.length, 3) * lineHeight + 17);
    if (this.y > top + 1) this.y += 3;
    for (const line of lines) {
      this.ensure(lineHeight + 10);
      if (fill) {
        this.doc.setFillColor(fill);
        this.doc.rect(left - 2, this.y - 1, width + 4, lineHeight + 2, 'F');
      }
      this.line(line, left, this.y, size, title ? '000000' : palette.green);
      this.y += lineHeight;
    }
    this.y += 5;
  }
  card(block: Card) {
    const segments = [
      { text: block.label, size: 9.5, bold: true, color: palette.green },
      { text: block.title, size: 12, bold: true, color: palette.ink },
      ...(block.text ? [{ text: block.text, size: 11, bold: false, color: palette.ink }] : []),
      ...(block.meta ? [{ text: block.meta, size: 9.5, bold: false, color: palette.muted }] : [])
    ];
    const lines = segments.flatMap((s) =>
      this.wrap(plain(s.text, s.bold), s.size, width - 12).map((parts, i, all) => ({
        parts,
        size: s.size,
        color: s.color,
        height: s.size * mm * 1.35 + (i === all.length - 1 ? 1.5 : 0)
      }))
    );
    const total = lines.reduce((h, l) => h + l.height, 8);
    // Small cards stay together; large cards use the remaining page before continuing.
    if (total <= 90) this.ensure(total);
    else this.ensure(25);
    let index = 0;
    while (index < lines.length) {
      let height = 8,
        end = index;
      while (end < lines.length && this.y + height + lines[end].height <= bottom)
        height += lines[end++].height;
      if (end === index) {
        this.page();
        continue;
      }
      this.doc.setFillColor(block.fill ?? palette.paper);
      this.doc.rect(left, this.y, width, height, 'F');
      this.doc.setDrawColor(palette.green);
      this.doc.setLineWidth(0.9);
      this.doc.line(left + 0.4, this.y, left + 0.4, this.y + height);
      this.y += 4;
      for (; index < end; index++) {
        const l = lines[index];
        this.line(l.parts, left + 6, this.y, l.size, l.color);
        this.y += l.height;
      }
      this.y += 4;
      if (index < lines.length) {
        this.page();
        this.paragraph({ kind: 'text', style: 'small', runs: plain(`${block.label} (continued)`) });
      }
    }
    if (block.connected) {
      this.ensure(4);
      this.doc.setLineWidth(0.6);
      this.doc.line(left + 5, this.y, left + 5, this.y + 4);
      this.y += 4;
    } else this.y += 3;
  }
  table(block: ReportTable) {
    const size = 10.5,
      lineHeight = size * mm * 1.4,
      padding = 3;
    const prepare = (cells: Cell[], header = false) =>
      cells.map((c, i) =>
        this.wrap(plain(c.text, header || c.bold), size, width * block.widths[i] - padding * 2)
      );
    const headers = prepare(block.headers, true);
    const headerHeight = Math.max(...headers.map((c) => c.length)) * lineHeight + padding * 2;
    const draw = (cells: Cell[], lines: Line[][], count: number, header = false) => {
      const h = count * lineHeight + padding * 2;
      let x = left;
      cells.forEach((cell, i) => {
        const w = width * block.widths[i];
        this.doc.setFillColor(cell.fill ?? (header ? palette.pale : 'FFFFFF'));
        this.doc.setDrawColor(palette.line);
        this.doc.setLineWidth(0.2);
        this.doc.rect(x, this.y, w, h, 'FD');
        lines[i].forEach((l, index) =>
          this.line(l, x + padding, this.y + padding + index * lineHeight, size)
        );
        x += w;
      });
      this.y += h;
    };
    this.ensure(headerHeight + lineHeight * 2 + padding * 2);
    const head = () =>
      draw(block.headers, headers, Math.max(...headers.map((c) => c.length)), true);
    head();
    for (const row of block.rows) {
      const lines = prepare(row);
      const length = Math.max(...lines.map((c) => c.length));
      const rowHeight = length * lineHeight + padding * 2;
      if (this.y + rowHeight > bottom && rowHeight < bottom - top - headerHeight) {
        this.page();
        head();
      }
      let offset = 0;
      while (offset < length) {
        let capacity = Math.floor((bottom - this.y - padding * 2) / lineHeight);
        if (capacity < 2 && length - offset > capacity) {
          this.page();
          head();
          capacity = Math.floor((bottom - this.y - padding * 2) / lineHeight);
        }
        const count = Math.min(capacity, length - offset);
        if (count <= 0) throw new Error('The report table header is too tall to paginate.');
        const slices = lines.map((ls, i) =>
          offset && !ls.slice(offset, offset + count).length && i === 0
            ? [
                ...ls.slice(0, Math.max(0, count - 1)),
                this.wrap(plain('Continued'), size, width * block.widths[i] - 6)[0]
              ]
            : ls.slice(offset, offset + count)
        );
        draw(row, slices, count);
        offset += count;
        if (offset < length) {
          this.page();
          head();
        }
      }
    }
    this.y += 5;
  }
  matrix(block: Extract<Block, { kind: 'matrix' }>) {
    const scale = width / matrixSize.width,
      h = matrixSize.height * scale;
    this.ensure(h + 22);
    for (const c of matrixDrawing(block.points)) {
      const x = left + c.x * scale,
        y = this.y + c.y * scale;
      if (c.kind === 'line') {
        this.doc.setDrawColor(c.color);
        this.doc.setLineWidth(0.2);
        this.doc.line(x, y, left + c.x2 * scale, this.y + c.y2 * scale);
      } else if (c.kind === 'text') {
        this.font({ text: c.text }, (c.size * scale) / mm);
        this.doc.setTextColor(c.color);
        if (c.rotate)
          this.doc.text(c.text, x, y + this.doc.getTextWidth(c.text) / 2, { angle: 90 });
        else this.doc.text(c.text, x, y, { align: 'center' });
      } else {
        this.doc.setFillColor(c.fill);
        this.doc.setDrawColor(c.stroke);
        this.doc.setLineWidth(0.4);
        if (c.kind === 'circle') this.doc.circle(x, y, c.size * scale, 'FD');
        else
          this.doc.rect(
            x - c.size * scale,
            y - c.size * scale,
            c.size * scale * 2,
            c.size * scale * 2,
            'FD'
          );
      }
    }
    this.y += h + 3;
  }
  render(block: Block) {
    if (block.kind === 'text') this.paragraph(block);
    else if (block.kind === 'heading')
      this.heading(block.text, block.level === 2 ? 15 : block.level === 3 ? 12.5 : 11);
    else if (block.kind === 'card') this.card(block);
    else if (block.kind === 'table') this.table(block);
    else this.matrix(block);
  }
  finish() {
    this.pages.forEach((label, index) => {
      this.doc.setPage(index + 1);
      this.font({ text: '' }, 8.5);
      this.doc.setTextColor(palette.muted);
      this.doc.text('Scenario Designer', left, 14);
      this.doc.text(label, left + width, 14, { align: 'right' });
      this.doc.text(`Page ${index + 1} / ${this.pages.length}`, left + width, 286, {
        align: 'right'
      });
    });
  }
}

export async function renderPDF(report: Report): Promise<ArrayBuffer> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', putOnlyUsedFonts: true, compress: true });
  for (const font of await loadFonts()) {
    const name = `NunitoSans-${font.style}.ttf`;
    doc.addFileToVFS(name, font.data);
    doc.addFont(name, 'NunitoSans', font.style);
  }
  doc.setProperties({
    title: report.title,
    author: 'Scenario Designer',
    subject: 'Scenario narratives and analytical overview'
  });
  const layout = new Layout(doc);
  for (const section of report.sections) {
    layout.label = section.label;
    layout.page();
    layout.paragraph({ kind: 'text', style: 'label', runs: plain(section.label) });
    layout.heading(section.title, section.titlePage ? 26 : 20, section.titlePage, section.fill);
    for (const block of section.blocks) layout.render(block);
  }
  layout.finish();
  return doc.output('arraybuffer');
}
