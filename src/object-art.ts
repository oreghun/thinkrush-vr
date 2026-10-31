import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from '@iwsdk/core';
import {
  type Cell,
  FIGURES,
  type ObjectBoard,
  PALETTE,
  type ShownPiece,
  turnCells,
} from './object-puzzle.js';

// Blocks for object puzzles (src/object-puzzle.ts): the figure on the
// object board, its gap, the candidate pieces on the tiles and the piece
// that snaps into the gap. Each is one mesh with a colour per block, so a
// whole figure costs a single draw call.

/** Block pitch: a 10-block figure is 21 cm across. */
export const BLOCK = 0.021;
/** How thick a block stands off the board. */
export const BLOCK_DEPTH = 0.014;
// Blocks fill this share of the pitch; the rest reads as grooves.
const BLOCK_FILL = 0.92;
// Sides a little darker than faces, so neighbouring blocks stay apart.
const SIDE_SHADE = 0.82;
// The back of a loose piece: plain wood, so a flipped piece looks wrong.
const BACK_WOOD = '#6B4426';
const GAP_COLORS = { idle: '#62E3D6', ready: '#FFD23F' };

// Unit-cube faces, counter-clockwise from outside: normal, then corners.
const FACES: ReadonlyArray<readonly [number[], number[][]]> = [
  [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]],
  [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]],
  [[1, 0, 0], [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]]],
  [[-1, 0, 0], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]],
  [[0, 1, 0], [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]]],
  [[0, -1, 0], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]],
];

const scratch = new Color();

/**
 * One geometry for `cells`, block (cx, cy) at the origin, standing from
 * z 0 to `depth`. Faces take the block's colour, sides a shade darker, and
 * backs `back` when given.
 */
function blockGeometry(
  cells: readonly Cell[],
  cx: number,
  cy: number,
  depth = BLOCK_DEPTH,
  back?: string,
): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const half = (BLOCK * BLOCK_FILL) / 2;
  for (const cell of cells) {
    const x = (cell.x - cx) * BLOCK;
    const y = (cell.y - cy) * BLOCK;
    FACES.forEach(([normal, corners], face) => {
      const hex = face === 1 && back ? back : (PALETTE[cell.color] ?? '#ffffff');
      scratch.set(hex);
      if (face > 1) scratch.multiplyScalar(SIDE_SHADE);
      const start = positions.length / 3;
      for (const [sx, sy, sz] of corners) {
        positions.push(x + sx * half, y + sy * half, depth / 2 + (sz * depth) / 2);
        normals.push(normal[0], normal[1], normal[2]);
        colors.push(scratch.r, scratch.g, scratch.b);
      }
      indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    });
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function blockMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
}

/** The middle of the figure's grid, in blocks. */
function figureCentre(board: ObjectBoard): [number, number] {
  const rows = FIGURES[board.figure];
  return [(rows[0].length - 1) / 2, (rows.length - 1) / 2];
}

/** The middle of a set of blocks, in blocks. */
function middle(cells: readonly Cell[]): [number, number] {
  const xs = cells.map((cell) => cell.x);
  const ys = cells.map((cell) => cell.y);
  return [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ];
}

export interface FigureParts {
  root: Group;
  /** Glowing squares where the missing blocks go. */
  gap: Mesh;
  gapMaterial: MeshBasicMaterial;
}

/** The figure without its gap, centred in the board's bed frame. */
export function createFigure(board: ObjectBoard): FigureParts {
  const [cx, cy] = figureCentre(board);
  const missing = new Set(board.gap.map((cell) => `${cell.x},${cell.y}`));
  const root = new Group();
  root.name = 'ObjectFigure';
  const blocks = new Mesh(
    blockGeometry(
      board.cells.filter((cell) => !missing.has(`${cell.x},${cell.y}`)),
      cx,
      cy,
    ),
    blockMaterial(),
  );
  blocks.name = 'ObjectFigure/Blocks';
  blocks.castShadow = true;
  blocks.receiveShadow = true;
  root.add(blocks);
  const gapMaterial = new MeshBasicMaterial({
    color: GAP_COLORS.idle,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    toneMapped: false,
  });
  // Centred on its own middle, so the gap's world position is its middle.
  const [gx, gy] = middle(board.gap);
  const gap = new Mesh(blockGeometry(board.gap, gx, gy, 0.002), gapMaterial);
  gap.name = 'ObjectFigure/Gap';
  gap.position.set((gx - cx) * BLOCK, (gy - cy) * BLOCK, 0);
  root.add(gap);
  return { root, gap, gapMaterial };
}

/** Lights the gap gold while a held piece is near it, turquoise otherwise. */
export function setGapReady(material: MeshBasicMaterial, ready: boolean): void {
  material.color.set(ready ? GAP_COLORS.ready : GAP_COLORS.idle);
}

/** Where the gap's middle is in the bed frame. */
export function gapCentre(board: ObjectBoard): [number, number] {
  const [cx, cy] = figureCentre(board);
  const [gx, gy] = middle(board.gap);
  return [(gx - cx) * BLOCK, (gy - cy) * BLOCK];
}

/** The missing blocks as one piece, centred on its own middle. */
export function createFill(board: ObjectBoard): Mesh {
  const [gx, gy] = middle(board.gap);
  const fill = new Mesh(blockGeometry(board.gap, gx, gy), blockMaterial());
  fill.name = 'ObjectFigure/Fill';
  fill.castShadow = true;
  return fill;
}

/**
 * A candidate piece for a tile's stand, turned the way it is shown, with a
 * plain wooden back, leaning back a little like the pattern swatches.
 * Origin at its bottom edge. Its geometry and material are freed with the
 * tile's model. The blocks mesh is named so the fit check can find it.
 */
export function createPieceModel(piece: ShownPiece): Group {
  const cells = turnCells(piece.cells, piece.turn);
  const [mx, my] = middle(cells);
  const height = (Math.max(...cells.map((cell) => cell.y)) + 1) * BLOCK;
  const root = new Group();
  root.name = 'ObjectPiece';
  root.userData.ownsMaterials = true;
  const lean = new Group();
  lean.rotation.x = -0.25;
  root.add(lean);
  const blocks = new Mesh(
    blockGeometry(cells, mx, my, BLOCK_DEPTH, BACK_WOOD),
    blockMaterial(),
  );
  blocks.name = PIECE_BLOCKS;
  blocks.position.set(0, height / 2, -BLOCK_DEPTH / 2);
  blocks.castShadow = true;
  lean.add(blocks);
  return root;
}

export const PIECE_BLOCKS = 'ObjectPiece/Blocks';
