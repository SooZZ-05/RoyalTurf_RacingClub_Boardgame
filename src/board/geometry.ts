import type { BoardTheme } from '../shared/types';

export type Point = [number, number];
interface TrackShape {
  outerStarts: Point[];
  innerStarts: Point[];
  segments: [string, string, number][];
}

// Traced from the approved artwork. Coordinates remain in its 1536 × 1024 space.
const shapes: Record<BoardTheme, TrackShape> = {
  'royal-club': {
    outerStarts: [
      [360, 609],
      [471, 615],
      [579, 615],
      [690, 615],
      [801, 615],
      [910, 615],
      [1021, 615],
      [1135, 615],
    ],
    innerStarts: [
      [360, 544],
      [471, 548],
      [579, 548],
      [690, 548],
      [801, 548],
      [910, 548],
      [1021, 548],
      [1135, 548],
    ],
    segments: [
      [
        'M1135 615 C1292 615 1426 516 1426 368 C1426 225 1275 114 1100 114',
        'M1135 548 C1249 548 1342 469 1342 368 C1342 259 1226 173 1100 173',
        10,
      ],
      ['M1100 114 L445 114', 'M1100 173 L445 173', 9],
      [
        'M445 114 C290 114 111 225 111 368 C111 510 224 582 360 609',
        'M445 173 C324 173 195 260 195 368 C195 470 263 538 360 544',
        10,
      ],
    ],
  },
  'imperial-porcelain': {
    outerStarts: [
      [260, 620],
      [386, 668],
      [494, 675],
      [609, 675],
      [722, 675],
      [837, 675],
      [954, 675],
      [1074, 675],
    ],
    innerStarts: [
      [314, 540],
      [405, 579],
      [494, 584],
      [609, 584],
      [722, 584],
      [837, 584],
      [954, 584],
      [1074, 582],
    ],
    segments: [
      [
        'M1074 675 C1258 675 1404 558 1404 407 C1404 254 1268 112 1060 112',
        'M1074 582 C1202 582 1305 494 1305 400 C1305 284 1207 198 1060 198',
        10,
      ],
      ['M1060 112 L480 112', 'M1060 198 L480 198', 9],
      [
        'M480 112 C284 112 132 242 132 407 C132 507 176 578 260 620',
        'M480 198 C341 198 238 282 238 400 C238 461 269 506 314 540',
        10,
      ],
    ],
  },
  nocturne: {
    outerStarts: [
      [346, 632],
      [465, 637],
      [585, 637],
      [706, 637],
      [823, 637],
      [939, 637],
      [1057, 637],
      [1175, 635],
    ],
    innerStarts: [
      [346, 533],
      [465, 544],
      [585, 544],
      [706, 544],
      [823, 544],
      [939, 544],
      [1057, 544],
      [1175, 539],
    ],
    segments: [
      [
        'M1175 635 C1342 632 1454 545 1454 380 C1454 225 1310 110 1150 110',
        'M1175 539 C1269 531 1328 468 1328 378 C1328 273 1252 199 1150 199',
        10,
      ],
      ['M1150 110 L405 110', 'M1150 199 L405 199', 9],
      [
        'M405 110 C223 110 83 220 83 380 C83 514 185 610 346 632',
        'M405 199 C290 199 203 278 203 378 C203 476 264 523 346 533',
        10,
      ],
    ],
  },
};

export const mixPoint = (a: Point, b: Point, t: number): Point => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];
export const physicalSpace = (position: number) => ((((position - 1) % 36) + 36) % 36) + 1;
export interface TrackCell {
  number: number;
  alias: number | null;
  outer: Point;
  inner: Point;
  outerNext: Point;
  innerNext: Point;
  center: Point;
  label: Point;
}

/** Arc-length samples of our small, fixed M/L/C path vocabulary. Pure geometry
 * keeps the same board coordinates available in browser rendering and tests. */
function samplePath(d: string) {
  const tokens = d.match(/[MLC]|-?\d+(?:\.\d+)?/g)!;
  const points: Point[] = [];
  let cursor = 0;
  let last: Point = [0, 0];
  const read = (): Point => [Number(tokens[cursor++]), Number(tokens[cursor++])];
  while (cursor < tokens.length) {
    const command = tokens[cursor++];
    if (command === 'M' || command === 'L') {
      last = read();
      points.push(last);
    } else if (command === 'C') {
      const start = last,
        first = read(),
        second = read(),
        end = read();
      for (let i = 1; i <= 320; i++) {
        const t = i / 320,
          u = 1 - t;
        points.push([
          u * u * u * start[0] +
            3 * u * u * t * first[0] +
            3 * u * t * t * second[0] +
            t * t * t * end[0],
          u * u * u * start[1] +
            3 * u * u * t * first[1] +
            3 * u * t * t * second[1] +
            t * t * t * end[1],
        ]);
      }
      last = end;
    }
  }
  const lengths = [0];
  for (let i = 1; i < points.length; i++)
    lengths.push(
      lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]),
    );
  return (fraction: number): Point => {
    const target = Math.max(0, Math.min(1, fraction)) * lengths[lengths.length - 1];
    let low = 1,
      high = lengths.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (lengths[middle] < target) low = middle + 1;
      else high = middle;
    }
    return mixPoint(
      points[low - 1],
      points[low],
      (target - lengths[low - 1]) / (lengths[low] - lengths[low - 1] || 1),
    );
  };
}

export function buildTrack(theme: BoardTheme) {
  const shape = shapes[theme];
  const cells: TrackCell[] = [];
  let number = 29;
  for (const [outerPath, innerPath, count] of shape.segments) {
    const outside = samplePath(outerPath),
      inside = samplePath(innerPath);
    for (let k = 0; k < count; k++) {
      const outer = outside(k / count),
        inner = inside(k / count);
      const outerNext = outside((k + 1) / count),
        innerNext = inside((k + 1) / count);
      cells.push({
        number: number--,
        alias: null,
        outer,
        inner,
        outerNext,
        innerNext,
        center: mixPoint(mixPoint(inner, innerNext, 0.5), mixPoint(outer, outerNext, 0.5), 0.5),
        label: mixPoint(inside((k + 0.5) / count), outside((k + 0.5) / count), 0.55),
      });
    }
  }
  for (let k = 0; k < 7; k++) {
    const outer = shape.outerStarts[k],
      inner = shape.innerStarts[k];
    const outerNext = shape.outerStarts[k + 1],
      innerNext = shape.innerStarts[k + 1];
    cells.push({
      number: 36 - k,
      alias: k === 0 ? 0 : -k,
      outer,
      inner,
      outerNext,
      innerNext,
      center: mixPoint(mixPoint(inner, innerNext, 0.5), mixPoint(outer, outerNext, 0.5), 0.5),
      label: mixPoint(mixPoint(inner, innerNext, 0.5), mixPoint(outer, outerNext, 0.5), 0.81),
    });
  }
  const point = (position: number): Point => {
    const floor = Math.floor(position),
      fraction = position - floor;
    const first = cells.find((cell) => cell.number === physicalSpace(floor))!;
    const next = cells.find((cell) => cell.number === physicalSpace(floor + 1))!;
    return mixPoint(first.center, next.center, fraction);
  };
  const finish = shape.outerStarts[0],
    inside = shape.innerStarts[0];
  const dx = finish[0] - inside[0],
    dy = finish[1] - inside[1],
    length = Math.hypot(dx, dy);
  const nx = (-dy / length) * 8,
    ny = (dx / length) * 8;
  const finishPoints: Point[] = [
    [inside[0] + nx, inside[1] + ny],
    [finish[0] + nx, finish[1] + ny],
    [finish[0] - nx, finish[1] - ny],
    [inside[0] - nx, inside[1] - ny],
  ];
  return { cells, point, finishPoints };
}
