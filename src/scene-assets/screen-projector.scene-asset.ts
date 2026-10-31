import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
} from '@iwsdk/core';
import { createPanelHandle } from './puzzle.scene-asset.js';

/**
 * The light bar the screen hangs above: the graphite grab bar (pinch it to
 * move the screen), a turquoise lens along its top, and a faint fan of
 * light rising from the lens toward the screen, as if the bar projected
 * it. Origin at the bar's centre, +Z toward the player.
 */

const TURQUOISE = 0x35b7ae;
const BAR_TOP = 0.012;

// The fan starts as wide as the lens and opens to most of the screen's
// width. It ends just under the screen's lower edge, which sits forward of
// the bar because the screen leans back by 12 degrees. It fades out before
// it gets there, so a taller screen never shows its tip.
const BEAM_BOTTOM_WIDTH = 0.13;
const BEAM_TOP_WIDTH = 0.64;
const BEAM_HEIGHT = 0.19;
const BEAM_FORWARD = 0.04;
const BEAM_PEAK_ALPHA = 0.42;
const BEAM_ROWS = 6;
const BEAM_COLUMNS = [-1, -0.6, -0.25, 0, 0.25, 0.6, 1];

/** Light is not a handle: the fan never catches a pointer or a grab. */
class LightMesh extends Mesh {
  override raycast(): void {}
}

function beamGeometry(): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const r = ((TURQUOISE >> 16) & 255) / 255;
  const g = ((TURQUOISE >> 8) & 255) / 255;
  const b = (TURQUOISE & 255) / 255;
  for (let row = 0; row < BEAM_ROWS; row += 1) {
    const t = row / (BEAM_ROWS - 1);
    const halfWidth =
      (BEAM_BOTTOM_WIDTH + (BEAM_TOP_WIDTH - BEAM_BOTTOM_WIDTH) * t) / 2;
    // Brightest at the lens, gone at the top; soft at both sides.
    const rise = BEAM_PEAK_ALPHA * (1 - t) ** 1.2;
    for (const s of BEAM_COLUMNS) {
      positions.push(s * halfWidth, BAR_TOP + BEAM_HEIGHT * t, BEAM_FORWARD * t);
      colors.push(r, g, b, rise * (1 - s * s));
    }
  }
  const columns = BEAM_COLUMNS.length;
  const indices: number[] = [];
  for (let row = 0; row < BEAM_ROWS - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const a = row * columns + column;
      const c = a + columns;
      indices.push(a, a + 1, c + 1, a, c + 1, c);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

export function createScreenProjector(): Group {
  const root = new Group();
  root.name = 'ScreenProjector';

  const bar = createPanelHandle();
  bar.name = 'ScreenProjector/Bar';
  root.add(bar);

  // Set slightly into the bar's top so it reads as part of it.
  const lens = new Mesh(
    new BoxGeometry(0.13, 0.004, 0.009),
    new MeshBasicMaterial({ color: 0x8ff3e8, toneMapped: false }),
  );
  lens.name = 'ScreenProjector/Lens';
  lens.position.y = BAR_TOP - 0.0005;
  root.add(lens);

  const beam = new LightMesh(
    beamGeometry(),
    new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    }),
  );
  beam.name = 'ScreenProjector/Beam';
  beam.userData.iwsdkPreviewBounds = 'exclude';
  root.add(beam);
  return root;
}
