import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Header,
  Footer,
  PageNumber,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  TableLayoutType,
  AlignmentType,
  SectionType,
  ImageRun,
  ExternalHyperlink,
  type FileChild,
  type ParagraphChild,
  type IParagraphOptions,
  type ISectionOptions
} from 'docx';
import { matrixPNG, matrixSize } from './matrix';
import {
  palette,
  type Report,
  type Block,
  type Text,
  type Run,
  type Card,
  type ReportTable
} from './report';

const width = 9412;
const rule = { style: BorderStyle.SINGLE, size: 4, color: palette.line };
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const headings = {
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4
};
function runs(source: Run[]): ParagraphChild[] {
  return source.flatMap((r) => {
    const pieces: ParagraphChild[] = r.text.split('\n').flatMap((line, i) => [
      ...(i ? [new TextRun({ break: 1 })] : []),
      new TextRun({
        text: line,
        bold: r.bold,
        italics: r.italic,
        ...(r.code ? { font: 'Consolas', shading: { fill: palette.paper } } : {}),
        ...(r.link ? { color: palette.green, underline: {} } : {})
      })
    ]);
    return r.link ? [new ExternalHyperlink({ link: r.link, children: pieces })] : pieces;
  });
}
function paragraph(block: Text, extra: IParagraphOptions = {}): Paragraph {
  const style = {
    body: 'Normal',
    lead: 'ReportLead',
    small: 'ReportSmall',
    label: 'ReportLabel',
    notice: 'ReportNotice',
    quote: 'ReportQuote',
    code: 'ReportCode'
  }[block.style ?? 'body'];
  return new Paragraph({
    style,
    children: [
      ...(block.prefix ? [new TextRun({ text: `${block.prefix}  ` })] : []),
      ...runs(block.runs)
    ],
    ...(block.depth
      ? {
          indent: { left: Math.min(block.depth, 6) * 240, hanging: block.prefix ? 200 : undefined }
        }
      : {}),
    widowControl: true,
    ...extra
  });
}
const spacer = () =>
  new Paragraph({
    spacing: { before: 0, after: 100, line: 20 },
    children: [new TextRun({ text: '', size: 2 })]
  });
function card(block: Card): FileChild[] {
  const chars =
    block.label.length + block.title.length + (block.text?.length ?? 0) + (block.meta?.length ?? 0);
  const long = chars > 900;
  const chunks = (value: string) =>
    long ? (value.match(/[\s\S]{1,600}(?=\s|$)|[\s\S]{1,600}/g) ?? ['']) : [value];
  const content = [
    paragraph(
      { kind: 'text', style: 'label', runs: [{ text: block.label }] },
      { spacing: { after: 55 }, keepNext: true }
    ),
    ...chunks(block.title).map(
      (value) =>
        new Paragraph({
          children: [new TextRun({ text: value, bold: true, size: 24 })],
          spacing: { after: 65 },
          keepNext: !long && !!(block.text || block.meta),
          widowControl: true
        })
    ),
    ...(block.text
      ? chunks(block.text).map((value) =>
          paragraph({ kind: 'text', runs: [{ text: value }] }, { spacing: { after: 70 } })
        )
      : []),
    ...(block.meta
      ? [
          paragraph(
            { kind: 'text', style: 'small', runs: [{ text: block.meta }] },
            { spacing: { after: 0 } }
          )
        ]
      : [])
  ];
  const cell = (children: Paragraph[]) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      shading: { fill: block.fill ?? palette.paper },
      margins: { top: 125, bottom: 125, left: 180, right: 180 },
      borders: {
        left: { style: BorderStyle.SINGLE, size: 16, color: palette.green },
        top: none,
        right: none,
        bottom: none
      },
      children
    });
  const table = new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths: [width],
    layout: TableLayoutType.FIXED,
    borders: {
      top: none,
      bottom: none,
      left: none,
      right: none,
      insideHorizontal: none,
      insideVertical: none
    },
    rows: long
      ? [
          new TableRow({
            tableHeader: true,
            cantSplit: true,
            children: [
              cell([
                paragraph(
                  {
                    kind: 'text',
                    style: 'label',
                    runs: [{ text: block.label.length > 180 ? 'Card details' : block.label }]
                  },
                  { spacing: { after: 0 }, keepNext: true }
                )
              ])
            ]
          }),
          new TableRow({
            cantSplit: false,
            children: [cell(block.label.length > 180 ? content : content.slice(1))]
          })
        ]
      : [new TableRow({ cantSplit: true, children: [cell(content)] })]
  });
  const gap = block.connected
    ? new Paragraph({
        children: [new TextRun({ text: ' ', size: 4 })],
        spacing: { before: 0, after: 0, line: 100 },
        indent: { left: 185 },
        border: { left: { style: BorderStyle.SINGLE, size: 6, color: palette.green, space: 0 } }
      })
    : spacer();
  return [table, gap];
}
function table(block: ReportTable): FileChild[] {
  // Split oversized cells into continuation rows so the uncertainty stays visible.
  // Word performs final pagination using its own font metrics.
  const continuedRows = block.rows.flatMap((row) => {
    const lines = row.map((cell, i) => {
      const measure = Math.max(10, Math.floor(block.widths[i] * 80));
      return cell.text.split('\n').flatMap((line) => {
        const wrapped: string[] = [];
        while (line.length > measure) {
          const space = line.lastIndexOf(' ', measure);
          const cut = space > measure / 2 ? space : measure;
          wrapped.push(line.slice(0, cut));
          line = line.slice(cut).trimStart();
        }
        return [...wrapped, line];
      });
    });
    const longest = Math.max(...lines.map((l) => l.length));
    if (longest <= 24) return [row];
    return Array.from({ length: Math.ceil(longest / 12) }, (_, index) =>
      row.map((cell, i) => ({
        ...cell,
        text:
          i === 0 && index > 0
            ? `${lines[0].slice(index * 12, (index + 1) * 12).join('\n') || lines[0].slice(0, 12).join('\n')}\nContinued`
            : lines[i].slice(index * 12, (index + 1) * 12).join('\n')
      }))
    );
  });
  const makeRow = (cells: ReportTable['headers'], header: boolean) =>
    new TableRow({
      tableHeader: header,
      cantSplit: cells.every((c, i) => c.text.length / (block.widths[i] * 85) < 34),
      children: cells.map(
        (cell, i) =>
          new TableCell({
            width: { size: Math.round(width * block.widths[i]), type: WidthType.DXA },
            shading: { fill: cell.fill ?? (header ? palette.pale : 'FFFFFF') },
            margins: { top: 120, bottom: 120, left: 130, right: 130 },
            borders: { top: rule, bottom: rule, left: rule, right: rule },
            children: [
              paragraph(
                { kind: 'text', runs: [{ text: cell.text, bold: header || cell.bold }] },
                { spacing: { after: 0, line: 290 }, keepNext: header }
              )
            ]
          })
      )
    });
  return [
    new Table({
      width: { size: width, type: WidthType.DXA },
      columnWidths: block.widths.map((w) => Math.round(width * w)),
      layout: TableLayoutType.FIXED,
      rows: [makeRow(block.headers, true), ...continuedRows.map((r) => makeRow(r, false))]
    }),
    spacer()
  ];
}
async function children(block: Block): Promise<FileChild[]> {
  if (block.kind === 'text') return [paragraph(block)];
  if (block.kind === 'heading')
    return [
      new Paragraph({
        heading: headings[block.level],
        text: block.text,
        keepNext: true,
        widowControl: true
      })
    ];
  if (block.kind === 'card') return card(block);
  if (block.kind === 'table') return table(block);
  const data = await matrixPNG(block.points);
  return [
    new Paragraph({
      children: [
        new ImageRun({
          type: 'png',
          data,
          transformation: { width: 627, height: (627 * matrixSize.height) / matrixSize.width },
          altText: {
            title: 'Impact and uncertainty matrix',
            description:
              'Uncertainty on the horizontal axis and humanitarian impact on the vertical axis, both from 1 to 5. Filled squares contain selected critical uncertainties. Point references and exact scores are provided in the driver key.'
          }
        })
      ],
      keepNext: true,
      spacing: { after: 100 }
    })
  ];
}

export async function renderDocx(report: Report): Promise<ArrayBuffer> {
  const sections: ISectionOptions[] = [];
  for (const section of report.sections) {
    const content: FileChild[] = [
      paragraph({ kind: 'text', style: 'label', runs: [{ text: section.label }] }),
      new Paragraph({
        text: section.title,
        heading: section.titlePage ? HeadingLevel.TITLE : HeadingLevel.HEADING_1,
        keepNext: true,
        ...(section.fill ? { shading: { fill: section.fill } } : {})
      })
    ];
    for (const block of section.blocks) content.push(...(await children(block)));
    sections.push({
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1134, bottom: 1134, left: 1247, right: 1247, header: 567, footer: 567 }
        }
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: `Scenario Designer  /  ${section.label}`,
                  size: 17,
                  color: palette.muted
                })
              ],
              spacing: { after: 0 }
            })
          ]
        })
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: 'Page ', size: 17, color: palette.muted }),
                new TextRun({ children: [PageNumber.CURRENT], size: 17, color: palette.muted })
              ]
            })
          ]
        })
      },
      children: content
    });
  }
  const doc = new Document({
    creator: 'Scenario Designer',
    title: report.title,
    description: 'Scenario narratives and analytical overview',
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22, color: palette.ink },
          paragraph: { spacing: { line: 320, after: 150 } }
        },
        title: {
          run: { font: 'Calibri', size: 52, bold: true, color: '000000' },
          paragraph: { spacing: { before: 0, after: 240 }, keepNext: true }
        },
        heading1: {
          run: { size: 38, bold: true, color: palette.green },
          paragraph: { spacing: { before: 0, after: 240 }, keepNext: true }
        },
        heading2: {
          run: { size: 30, bold: true, color: palette.green },
          paragraph: { spacing: { before: 260, after: 130 }, keepNext: true }
        },
        heading3: {
          run: { size: 25, bold: true, color: palette.green },
          paragraph: { spacing: { before: 210, after: 100 }, keepNext: true }
        },
        heading4: {
          run: { size: 22, bold: true, color: palette.green },
          paragraph: { spacing: { before: 180, after: 90 }, keepNext: true }
        }
      },
      paragraphStyles: [
        {
          id: 'ReportLead',
          name: 'Report lead',
          basedOn: 'Normal',
          run: { size: 26 },
          paragraph: { spacing: { line: 350, after: 200 } }
        },
        {
          id: 'ReportSmall',
          name: 'Report caption and metadata',
          basedOn: 'Normal',
          run: { size: 19, color: palette.muted },
          paragraph: { spacing: { line: 270, after: 130 } }
        },
        {
          id: 'ReportLabel',
          name: 'Report section label',
          basedOn: 'Normal',
          run: { size: 19, color: palette.green, bold: true },
          paragraph: { spacing: { after: 100 }, keepNext: true }
        },
        {
          id: 'ReportNotice',
          name: 'Report status',
          basedOn: 'Normal',
          run: { size: 21 },
          paragraph: {
            shading: { fill: palette.pale },
            spacing: { before: 100, after: 180, line: 320 },
            indent: { left: 150, right: 150 }
          }
        },
        {
          id: 'ReportQuote',
          name: 'Report quotation',
          basedOn: 'Normal',
          run: { italics: true },
          paragraph: {
            indent: { left: 280, right: 160 },
            border: {
              left: { style: BorderStyle.SINGLE, color: palette.green, size: 12, space: 10 }
            }
          }
        },
        {
          id: 'ReportCode',
          name: 'Report code',
          basedOn: 'Normal',
          run: { font: 'Consolas', size: 20 },
          paragraph: { shading: { fill: palette.paper }, indent: { left: 150, right: 150 } }
        }
      ]
    },
    sections
  });
  return (await Packer.toBlob(doc)).arrayBuffer();
}
