import {
  DataTexture,
  LatheGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  Vector2,
} from '@iwsdk/core';
import { POUF, POUF_PROFILE } from '../pouf-shape.js';

/**
 * RUSH's pouf: a round cushioned seat in a kitenge-style print, where she
 * sits at home. Her sitting move was recorded on a chair; a soft seat at her
 * own seat height lets her play it as recorded, feet on the floor, settling
 * a little into the cushion (src/rush-body-plan.ts).
 *
 * Origin: centre of its base, on the floor. One lathe mesh, one material,
 * one small generated texture (no files, no DOM).
 */

const SEGMENTS = 40;
// The print repeats this many times round the pouf.
const REPEATS = 8;
const TILE_WIDTH = 64;
const TILE_HEIGHT = 256;

// The game's kitenge colours (src/pattern-art.ts).
const ORANGE = [0xf2, 0x8c, 0x28];
const INK = [0x1b, 0x1b, 0x1b];
const GOLD = [0xff, 0xe1, 0x5a];
const TEAL = [0x0e, 0x8c, 0x96];
const CREAM = [0xff, 0xf1, 0xc4];

/**
 * The print at (u, v) of one tile: u round the pouf (0 to 1 across the
 * tile), v up its profile (0 at the middle of the base, 1 at the middle of
 * the top, as LatheGeometry maps it). Bands up the side, a row of diamonds,
 * and on the top teal with ink rays round a gold centre.
 */
function printAt(u: number, v: number): number[] {
  // Profile points are evenly spaced in v: the side runs over points 2-8
  // (v 0.18-0.73), the cushion top over 8-11.
  if (v < 0.19) return INK;
  if (v < 0.24) return GOLD;
  if (v < 0.6) {
    const across = Math.abs(u - 0.5) / 0.42;
    const up = Math.abs(v - 0.42) / 0.15;
    const diamond = across + up;
    if (diamond < 0.45) return GOLD;
    if (diamond < 1) return INK;
    return ORANGE;
  }
  if (v < 0.68) {
    // A zigzag edge between the orange and the teal band.
    const tooth = Math.abs(((u * 4) % 1) - 0.5) * 2;
    return v < 0.6 + 0.05 * tooth ? ORANGE : TEAL;
  }
  if (v < 0.73) return GOLD;
  if (v > 0.965) return GOLD;
  if (v > 0.945) return INK;
  // Rays: one ink triangle per tile, narrowing towards the centre.
  const share = (v - 0.73) / (0.945 - 0.73);
  const halfWidth = 0.3 * (1 - share);
  if (Math.abs(u - 0.5) < halfWidth) return INK;
  return share > 0.82 ? CREAM : TEAL;
}

function createPrint(): DataTexture {
  const pixels = new Uint8Array(TILE_WIDTH * TILE_HEIGHT * 4);
  for (let y = 0; y < TILE_HEIGHT; y += 1) {
    for (let x = 0; x < TILE_WIDTH; x += 1) {
      const [r, g, b] = printAt((x + 0.5) / TILE_WIDTH, (y + 0.5) / TILE_HEIGHT);
      const at = (y * TILE_WIDTH + x) * 4;
      pixels[at] = r;
      pixels[at + 1] = g;
      pixels[at + 2] = b;
      pixels[at + 3] = 255;
    }
  }
  const texture = new DataTexture(
    pixels,
    TILE_WIDTH,
    TILE_HEIGHT,
    RGBAFormat,
    UnsignedByteType,
  );
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.repeat.set(REPEATS, 1);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function createPouf(): Mesh {
  const points = POUF_PROFILE.map(
    ([across, up]) => new Vector2(across * POUF.radius, up * POUF.height),
  );
  const geometry = new LatheGeometry(points, SEGMENTS);
  const material = new MeshStandardMaterial({
    map: createPrint(),
    roughness: 0.85,
  });
  const pouf = new Mesh(geometry, material);
  pouf.name = 'Pouf';
  return pouf;
}
