// Draws pattern pieces (src/patterns.ts) as small canvas textures. Every
// motif is drawn here in code: inspired by kitenge and kanga prints,
// beadwork, tessellations and weaving, never copied from a real design.
// MOTIF_TURNS in src/patterns.ts must match how each motif looks when
// turned (the tests rely on it to keep every option different).

import { CanvasTexture, SRGBColorSpace } from '@iwsdk/core';
import {
  lookKey,
  type PatternFamily,
  type Piece,
} from './patterns.js';

const SIZE = 128;

interface Colorway {
  ground: string;
  ink: string;
  accent: string;
}

// Four colourways per family, far enough apart in both hue and lightness
// to tell apart at arm's length.
const PALETTES: Record<PatternFamily, readonly Colorway[]> = {
  kitenge: [
    { ground: '#F28C28', ink: '#1B1B1B', accent: '#FFE15A' },
    { ground: '#0E8C96', ink: '#FFE15A', accent: '#1B1B1B' },
    { ground: '#C2185B', ink: '#FFF1C4', accent: '#1B1B1B' },
    { ground: '#27306E', ink: '#FFFFFF', accent: '#F28C28' },
  ],
  beadwork: [
    { ground: '#F3E6CF', ink: '#D32F2F', accent: '#1E5BB8' },
    { ground: '#F3E6CF', ink: '#2E7D32', accent: '#F9A825' },
    { ground: '#1E1E1E', ink: '#FAFAFA', accent: '#E53935' },
    { ground: '#7A3E1D', ink: '#FFB300', accent: '#00ACC1' },
  ],
  tessellation: [
    { ground: '#F6E7C8', ink: '#0E8C96', accent: '#E0A100' },
    { ground: '#1F2A5A', ink: '#F28C28', accent: '#F6E7C8' },
    { ground: '#F6E7C8', ink: '#B71C1C', accent: '#1B1B1B' },
    { ground: '#1B1B1B', ink: '#43A047', accent: '#FFE15A' },
  ],
  weave: [
    { ground: '#3B2414', ink: '#D9B676', accent: '#8A5A2B' },
    { ground: '#10343A', ink: '#2BB3A6', accent: '#F3E6CF' },
    { ground: '#1B1B1B', ink: '#C62828', accent: '#F3E6CF' },
    { ground: '#2B3A12', ink: '#7CB342', accent: '#FDD835' },
  ],
  abstract: [
    { ground: '#27306E', ink: '#FF8FB1', accent: '#FFE15A' },
    { ground: '#FFE15A', ink: '#1B1B1B', accent: '#0E8C96' },
    { ground: '#E8F1F2', ink: '#D84315', accent: '#27306E' },
    { ground: '#0E8C96', ink: '#FFFFFF', accent: '#F28C28' },
  ],
};

type Draw = (g: CanvasRenderingContext2D, s: number, c: Colorway) => void;

// Each motif is drawn upright in a square of side `s` centred on 0, 0.
const disc = (g: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
};
const polygon = (g: CanvasRenderingContext2D, points: number[][]) => {
  g.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
  g.closePath();
  g.fill();
};
/** One bead: a disc with a small shine, so rows read as beads. */
const bead = (g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) => {
  g.fillStyle = color;
  disc(g, x, y, r);
  g.fillStyle = 'rgba(255,255,255,0.45)';
  disc(g, x - r * 0.3, y - r * 0.3, r * 0.3);
};

const MOTIFS: Record<PatternFamily, readonly Draw[]> = {
  kitenge: [
    // Sun: a disc in a ring of rays (looks the same every quarter turn).
    (g, s, c) => {
      g.fillStyle = c.accent;
      for (let i = 0; i < 8; i += 1) {
        const a = (i * Math.PI) / 4;
        polygon(g, [
          [Math.cos(a - 0.18) * s * 0.26, Math.sin(a - 0.18) * s * 0.26],
          [Math.cos(a) * s * 0.46, Math.sin(a) * s * 0.46],
          [Math.cos(a + 0.18) * s * 0.26, Math.sin(a + 0.18) * s * 0.26],
        ]);
      }
      g.fillStyle = c.ink;
      disc(g, 0, 0, s * 0.24);
    },
    // Teardrop leaf: pointed tip up, round end and stem down, so every
    // quarter turn points a clearly different way.
    (g, s, c) => {
      g.fillStyle = c.ink;
      g.beginPath();
      g.moveTo(0, -s * 0.46);
      g.bezierCurveTo(s * 0.12, -s * 0.2, s * 0.3, -s * 0.02, s * 0.3, s * 0.12);
      g.arc(0, s * 0.12, s * 0.3, 0, Math.PI);
      g.bezierCurveTo(-s * 0.3, -s * 0.02, -s * 0.12, -s * 0.2, 0, -s * 0.46);
      g.fill();
      g.fillStyle = c.accent;
      disc(g, 0, s * 0.14, s * 0.1);
    },
    // Half-moon with a dot above its flat side: each turn looks different.
    (g, s, c) => {
      g.fillStyle = c.ink;
      g.beginPath();
      g.arc(0, s * 0.06, s * 0.36, 0, Math.PI);
      g.closePath();
      g.fill();
      g.fillStyle = c.accent;
      disc(g, 0, -s * 0.2, s * 0.11);
    },
    // Rings: circles inside circles (looks the same every turn).
    (g, s, c) => {
      [0.44, 0.32, 0.2, 0.09].forEach((r, i) => {
        g.fillStyle = i % 2 === 0 ? c.ink : c.accent;
        disc(g, 0, 0, s * r);
      });
    },
  ],
  beadwork: [
    // Three rows of beads, two colours: a half turn looks the same.
    (g, s, c) => {
      for (let row = -1; row <= 1; row += 1) {
        for (let col = -2; col <= 2; col += 1) {
          bead(g, col * s * 0.19, row * s * 0.28, s * 0.085, row === 0 ? c.accent : c.ink);
        }
      }
    },
    // A triangle of beads pointing up: each turn looks different.
    (g, s, c) => {
      [[0], [-0.5, 0.5], [-1, 0, 1], [-1.5, -0.5, 0.5, 1.5]].forEach((row, r) =>
        row.forEach((col) =>
          bead(g, col * s * 0.21, (r - 1.5) * s * 0.21, s * 0.09, r === 0 ? c.accent : c.ink),
        ),
      );
    },
    // A diamond of beads around one centre bead (looks the same every turn).
    (g, s, c) => {
      for (let x = -2; x <= 2; x += 1) {
        for (let y = -2; y <= 2; y += 1) {
          if (Math.abs(x) + Math.abs(y) <= 2) {
            bead(g, x * s * 0.18, y * s * 0.18, s * 0.08, x === 0 && y === 0 ? c.accent : c.ink);
          }
        }
      }
    },
    // A corner: a column down the left and a row along the bottom.
    (g, s, c) => {
      for (let i = 0; i < 5; i += 1) {
        bead(g, -s * 0.36, (i - 2) * s * 0.18, s * 0.08, c.ink);
        bead(g, (i - 2) * s * 0.18, s * 0.36, s * 0.08, i === 0 ? c.accent : c.ink);
      }
    },
  ],
  tessellation: [
    // A square split corner to corner: each turn looks different.
    (g, s, c) => {
      const h = s * 0.42;
      g.fillStyle = c.ink;
      polygon(g, [[-h, -h], [h, -h], [h, h]]);
      g.fillStyle = c.accent;
      polygon(g, [[-h, -h], [h, h], [-h, h]]);
    },
    // A chevron pointing up: each turn looks different.
    (g, s, c) => {
      const h = s * 0.42;
      g.fillStyle = c.ink;
      polygon(g, [[-h, h * 0.3], [0, -h], [h, h * 0.3], [h, h], [0, -h * 0.25], [-h, h]]);
      g.fillStyle = c.accent;
      polygon(g, [[-h * 0.3, h], [0, h * 0.45], [h * 0.3, h]]);
    },
    // A diamond in a diamond (looks the same every turn).
    (g, s, c) => {
      const h = s * 0.44;
      g.fillStyle = c.ink;
      polygon(g, [[0, -h], [h, 0], [0, h], [-h, 0]]);
      g.fillStyle = c.accent;
      polygon(g, [[0, -h * 0.45], [h * 0.45, 0], [0, h * 0.45], [-h * 0.45, 0]]);
    },
    // An hourglass: two triangles tip to tip (a half turn looks the same).
    (g, s, c) => {
      const h = s * 0.42;
      g.fillStyle = c.ink;
      polygon(g, [[-h, -h], [h, -h], [0, 0]]);
      polygon(g, [[-h, h], [h, h], [0, 0]]);
      g.fillStyle = c.accent;
      disc(g, 0, 0, s * 0.07);
    },
  ],
  weave: [
    // Plain weave: strands over and under in a checker.
    (g, s, c) => weaveCells(g, s, 4, (x, y) => ((x + y) % 2 === 0 ? c.ink : c.accent)),
    // Twill: wide bands running corner to corner.
    (g, s, c) => {
      const h = s * 0.44;
      g.save();
      g.beginPath();
      g.rect(-h, -h, h * 2, h * 2);
      g.clip();
      for (let i = -4; i <= 4; i += 1) {
        g.fillStyle = i % 2 === 0 ? c.ink : c.accent;
        const o = i * h * 0.5;
        polygon(g, [[o - h, -h], [o - h * 0.5, -h], [o + h * 1.5, h], [o + h, h]]);
      }
      g.restore();
    },
    // Basket weave: four blocks of three strands, across then down.
    (g, s, c) => {
      const h = s * 0.44;
      for (let bx = 0; bx < 2; bx += 1) {
        for (let by = 0; by < 2; by += 1) {
          const across = (bx + by) % 2 === 0;
          g.fillStyle = across ? c.ink : c.accent;
          for (let k = 0; k < 3; k += 1) {
            const step = h / 3;
            const x = -h + bx * h;
            const y = -h + by * h;
            if (across) {
              g.fillRect(x + step * 0.08, y + k * step + step * 0.15, h - step * 0.16, step * 0.7);
            } else {
              g.fillRect(x + k * step + step * 0.15, y + step * 0.08, step * 0.7, h - step * 0.16);
            }
          }
        }
      }
    },
    // Bands: wide, narrow, wide (a half turn looks the same).
    (g, s, c) => weaveCells(g, s, 5, (_x, y) => (y === 2 ? c.accent : c.ink)),
  ],
  abstract: [
    // Nine dots (look the same every turn).
    (g, s, c) => {
      g.fillStyle = c.ink;
      for (let x = -1; x <= 1; x += 1) {
        for (let y = -1; y <= 1; y += 1) {
          g.fillStyle = x === 0 && y === 0 ? c.accent : c.ink;
          disc(g, x * s * 0.3, y * s * 0.3, s * 0.1);
        }
      }
    },
    // An arrow pointing up: each turn looks different.
    (g, s, c) => {
      const h = s * 0.42;
      g.fillStyle = c.ink;
      polygon(g, [[0, -h], [h * 0.8, 0], [h * 0.3, 0], [h * 0.3, h], [-h * 0.3, h], [-h * 0.3, 0], [-h * 0.8, 0]]);
      g.fillStyle = c.accent;
      disc(g, 0, -h * 0.35, s * 0.06);
    },
    // A block filling the left half, with a dot in it: each turn differs.
    (g, s, c) => {
      const h = s * 0.42;
      g.fillStyle = c.ink;
      g.fillRect(-h, -h, h, h * 2);
      g.fillStyle = c.accent;
      disc(g, -h / 2, -h / 2, s * 0.08);
    },
    // A plus with a bright centre (looks the same every turn).
    (g, s, c) => {
      const h = s * 0.42;
      const w = s * 0.13;
      g.fillStyle = c.ink;
      g.fillRect(-w, -h, w * 2, h * 2);
      g.fillRect(-h, -w, h * 2, w * 2);
      g.fillStyle = c.accent;
      disc(g, 0, 0, w * 0.8);
    },
  ],
};

/** Strands in an n x n grid, each cell a short strand with a gap around it. */
function weaveCells(
  g: CanvasRenderingContext2D,
  s: number,
  n: number,
  color: (x: number, y: number) => string,
): void {
  const h = s * 0.44;
  const cell = (h * 2) / n;
  for (let x = 0; x < n; x += 1) {
    for (let y = 0; y < n; y += 1) {
      g.fillStyle = color(x, y);
      // Strands run across on dark cells and down on light ones, so the
      // over-and-under reads even in one colour.
      const across = (x + y) % 2 === 0;
      const inset = cell * 0.1;
      g.fillRect(
        -h + x * cell + (across ? 0 : inset),
        -h + y * cell + (across ? inset : 0),
        cell - (across ? 0 : inset * 2),
        cell - (across ? inset * 2 : 0),
      );
    }
  }
}

// Where `count` copies sit in the square (fractions of its side), and how
// big each copy is.
const LAYOUTS: Record<number, { at: number[][]; size: number }> = {
  1: { at: [[0.5, 0.5]], size: 0.84 },
  2: { at: [[0.27, 0.5], [0.73, 0.5]], size: 0.44 },
  3: { at: [[0.5, 0.27], [0.27, 0.72], [0.73, 0.72]], size: 0.42 },
  4: { at: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]], size: 0.42 },
  5: { at: [[0.24, 0.24], [0.76, 0.24], [0.5, 0.5], [0.24, 0.76], [0.76, 0.76]], size: 0.34 },
  6: { at: [[0.28, 0.2], [0.72, 0.2], [0.28, 0.5], [0.72, 0.5], [0.28, 0.8], [0.72, 0.8]], size: 0.3 },
  7: { at: [[0.3, 0.2], [0.7, 0.2], [0.18, 0.5], [0.5, 0.5], [0.82, 0.5], [0.3, 0.8], [0.7, 0.8]], size: 0.28 },
};

// When a piece shows several copies (the "grow" rule asks the player to
// count them), each copy is one simple token, easy to count at a glance.
const TOKENS: Record<PatternFamily, Draw> = {
  kitenge: (g, s, c) => {
    g.fillStyle = c.ink;
    disc(g, 0, 0, s * 0.42);
    g.fillStyle = c.accent;
    disc(g, 0, 0, s * 0.18);
  },
  beadwork: (g, s, c) => bead(g, 0, 0, s * 0.42, c.ink),
  tessellation: (g, s, c) => {
    const h = s * 0.46;
    g.fillStyle = c.ink;
    polygon(g, [[0, -h], [h, 0], [0, h], [-h, 0]]);
  },
  weave: (g, s, c) => {
    const h = s * 0.36;
    g.fillStyle = c.ink;
    g.fillRect(-h, -h, h * 2, h * 2);
    g.fillStyle = c.accent;
    g.fillRect(-h, -h * 0.25, h * 2, h * 0.5);
  },
  abstract: (g, s, c) => {
    g.fillStyle = c.ink;
    disc(g, 0, 0, s * 0.4);
  },
};

/** Draws one piece onto a canvas of SIZE pixels. */
export function drawPiece(
  g: CanvasRenderingContext2D,
  family: PatternFamily,
  piece: Piece,
): void {
  const colors = PALETTES[family][piece.colors];
  g.fillStyle = colors.ground;
  g.fillRect(0, 0, SIZE, SIZE);
  const layout = LAYOUTS[piece.count] ?? LAYOUTS[1];
  for (const [x, y] of layout.at) {
    g.save();
    g.translate(x * SIZE, y * SIZE);
    g.rotate((piece.turn * Math.PI) / 2);
    const draw = piece.count > 1 ? TOKENS[family] : MOTIFS[family][piece.motif];
    draw(g, layout.size * SIZE, colors);
    g.restore();
  }
}

/**
 * Textures for one board, one per distinct look, made on demand and all
 * freed together when the next board is dealt.
 */
export class PieceTextures {
  private readonly made = new Map<string, CanvasTexture>();

  get(family: PatternFamily, piece: Piece): CanvasTexture {
    const key = `${family}/${lookKey(family, piece)}`;
    let texture = this.made.get(key);
    if (!texture) {
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      drawPiece(canvas.getContext('2d')!, family, piece);
      texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 4;
      this.made.set(key, texture);
    }
    return texture;
  }

  dispose(): void {
    for (const texture of this.made.values()) {
      texture.dispose();
    }
    this.made.clear();
  }
}
