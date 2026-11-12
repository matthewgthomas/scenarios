import { palette, type MatrixPoint } from './report';

type Line = { kind: 'line'; x: number; y: number; x2: number; y2: number; color: string };
type Shape = {
  kind: 'rect' | 'circle';
  x: number;
  y: number;
  size: number;
  fill: string;
  stroke: string;
};
type Label = {
  kind: 'text';
  x: number;
  y: number;
  text: string;
  size: number;
  color: string;
  rotate?: boolean;
};
export type MatrixCommand = Line | Shape | Label;
export const matrixSize = { width: 720, height: 430 };

/** One drawing description keeps the Word figure and PDF vector plot aligned. */
export function matrixDrawing(points: MatrixPoint[]): MatrixCommand[] {
  const commands: MatrixCommand[] = [];
  const x = 92,
    y = 36,
    width = 566,
    height = 306;
  for (let value = 1; value <= 5; value++) {
    const px = x + ((value - 1) * width) / 4;
    const py = y + height - ((value - 1) * height) / 4;
    commands.push(
      { kind: 'line', x: px, y, x2: px, y2: y + height, color: palette.line },
      { kind: 'line', x, y: py, x2: x + width, y2: py, color: palette.line }
    );
    commands.push(
      { kind: 'text', x: px, y: 370, text: String(value), size: 14, color: palette.muted },
      { kind: 'text', x: 63, y: py + 5, text: String(value), size: 14, color: palette.muted }
    );
  }
  commands.push(
    { kind: 'text', x: x + width / 2, y: 408, text: 'Uncertainty', size: 17, color: palette.ink },
    {
      kind: 'text',
      x: 22,
      y: y + height / 2,
      text: 'Humanitarian impact',
      size: 17,
      color: palette.ink,
      rotate: true
    }
  );
  for (const point of points) {
    const px = x + ((point.uncertainty - 1) * width) / 4;
    const py = y + height - ((point.impact - 1) * height) / 4;
    commands.push({
      kind: point.selected ? 'rect' : 'circle',
      x: px,
      y: py,
      size: 16,
      fill: point.selected ? palette.green : 'FFFFFF',
      stroke: palette.green
    });
    commands.push({
      kind: 'text',
      x: px,
      y: py + 4,
      text: point.label,
      size: 11,
      color: point.selected ? 'FFFFFF' : palette.green
    });
    if (point.drivers.length > 1)
      commands.push({
        kind: 'text',
        x: px,
        y: py - 24,
        text: `${point.drivers.length} drivers`,
        size: 11,
        color: palette.muted
      });
  }
  return commands;
}

export async function matrixPNG(points: MatrixPoint[]): Promise<Uint8Array<ArrayBuffer>> {
  const canvas = document.createElement('canvas');
  const scale = 3;
  canvas.width = matrixSize.width * scale;
  canvas.height = matrixSize.height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot create the report matrix.');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, matrixSize.width, matrixSize.height);
  for (const command of matrixDrawing(points)) {
    if (command.kind === 'line') {
      ctx.strokeStyle = `#${command.color}`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(command.x, command.y);
      ctx.lineTo(command.x2, command.y2);
      ctx.stroke();
    } else if (command.kind === 'text') {
      ctx.save();
      ctx.fillStyle = `#${command.color}`;
      ctx.font = `${command.size}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.translate(command.x, command.y);
      if (command.rotate) ctx.rotate(-Math.PI / 2);
      ctx.fillText(command.text, 0, 0);
      ctx.restore();
    } else {
      ctx.fillStyle = `#${command.fill}`;
      ctx.strokeStyle = `#${command.stroke}`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (command.kind === 'rect')
        ctx.rect(
          command.x - command.size,
          command.y - command.size,
          command.size * 2,
          command.size * 2
        );
      else ctx.arc(command.x, command.y, command.size, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }
  }
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Cannot encode the report matrix.'))),
      'image/png'
    )
  );
  return new Uint8Array(await blob.arrayBuffer());
}
