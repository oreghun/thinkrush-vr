// Fits RUSH's moving face to her model: writes src/rush-face-shape.ts.
//
//   node scripts/fit-face.mjs [public/models/rush/rush-body.glb]
//
// Her eyes are painted into her texture (Meshy gives no face rig), so the
// game lays a lid over each that slides down to blink: a grid over an
// ellipse (measured on a front projection of her painted face), bridged
// over the smooth skin around the eye and lifted just clear of it. Her
// painted smile is gone from her texture (scripts/paint-face.mjs; run that
// first), and her code-built mouth sits just in front of her carved lips.
// Positions are in her model's space at rest (feet at the origin, facing
// +Z).
//
// It also picks the texture spot each lid takes its skin colour from: of
// the skin in a ring around the eye, the spot closest to its median colour
// (one painted spot would be lighter or darker than the skin it meets).
//
// Uses three.js (already a dependency), sharp (already installed) and the
// GLB container format; nothing runs at game time.

import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const input = process.argv[2] ?? 'public/models/rush/rush-body.glb';
const output = 'src/rush-face-shape.ts';

// Measured on her painted face (metres, model space, front view).
const LID_REGIONS = [
  // Her right eye (at -x), then her left: the white, the iris and the
  // upper lash line; the outer flick of liner stays visible when closed.
  { cx: -0.0485, cy: 0.916, a: 0.0305, b: 0.027 },
  { cx: 0.0485, cy: 0.916, a: 0.0305, b: 0.027 },
];
// The skin around her mouth, and the code-built mouth's footprint on it.
const MOUTH_REGION = { cx: -0.0015, cy: 0.849, a: 0.033, b: 0.0155 };
const MOUTH_FOOTPRINT = { a: 0.018, b: 0.011 };
// The paint itself (each eye's white, iris and lashes): her face must stay
// under a lid here, or the paint shows through in specks. Outside it, skin
// under skin cannot be seen.
const PAINTED_EYES = [
  { cx: -0.0485, cy: 0.9155, a: 0.0245, b: 0.0225 },
  { cx: 0.0485, cy: 0.9155, a: 0.0245, b: 0.0225 },
];
// Raised to the carved line between her lips, where her smile was drawn.
const MOUTH_CENTER = { x: -0.0015, y: 0.851 };

// How far each lid sits off the smooth skin (metres): domed, from `rim` at
// its edge to `middle` at its centre, which clears her sculpted eyes
// between the lid's grid points (checked below).
// A lid's top edge tucks into her skin (no step shows above a closed eye);
// its bottom edge, where the lash line is, sits just proud of it.
const LID_LIFT = { rim: -0.0005, bottomRim: 0.0008, middle: 0.0035 };
// The code-built mouth sits this far in front of the most her carved lips
// stand out within its footprint.
const MOUTH_LIFT = 0.001;
const LID_GRID = { cols: 12, rows: 8 };

// The GLB without its images, which GLTFLoader cannot decode in Node.
const glb = readFileSync(input);
const jsonLength = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8'));
const binStart = 20 + jsonLength + 8;
const binLength = glb.readUInt32LE(20 + jsonLength);
const bin = glb.subarray(binStart, binStart + binLength);
const material = json.materials[0];
const texture = json.textures[material.pbrMetallicRoughness.baseColorTexture.index];
const imageView = json.bufferViews[json.images[texture.source].bufferView];
const jpeg = bin.subarray(imageView.byteOffset ?? 0, (imageView.byteOffset ?? 0) + imageView.byteLength);
const { data: pixels, info } = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true });
for (const m of json.materials) {
  delete m.pbrMetallicRoughness?.baseColorTexture;
  delete m.pbrMetallicRoughness?.metallicRoughnessTexture;
  delete m.normalTexture;
  delete m.occlusionTexture;
  delete m.emissiveTexture;
}
delete json.images;
delete json.textures;
delete json.samplers;
const jsonBytes = Buffer.from(JSON.stringify(json));
const padded = Buffer.concat([jsonBytes, Buffer.alloc((4 - (jsonBytes.length % 4)) % 4, 0x20)]);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + padded.length + 8 + bin.length, 8);
header.writeUInt32LE(padded.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(bin.length, 0);
binHeader.writeUInt32LE(0x004e4942, 4);
const stripped = Buffer.concat([header, padded, binHeader, bin]);
const gltf = await new GLTFLoader().parseAsync(
  stripped.buffer.slice(stripped.byteOffset, stripped.byteOffset + stripped.byteLength),
  '',
);

// Her mesh at rest, baked into model space for ray casting.
const model = gltf.scene;
model.updateMatrixWorld(true);
let skinned;
model.traverse((object) => {
  if (object.isSkinnedMesh) skinned = object;
});
skinned.skeleton.update();
const source = skinned.geometry;
const count = source.attributes.position.count;
const positions = new Float32Array(count * 3);
const normals = new Float32Array(count * 3);
const normalMatrix = new THREE.Matrix3().getNormalMatrix(skinned.matrixWorld);
const v = new THREE.Vector3();
for (let i = 0; i < count; i += 1) {
  skinned.getVertexPosition(i, v);
  v.applyMatrix4(skinned.matrixWorld);
  positions.set([v.x, v.y, v.z], i * 3);
  v.fromBufferAttribute(source.attributes.normal, i).applyMatrix3(normalMatrix).normalize();
  normals.set([v.x, v.y, v.z], i * 3);
}
const baked = new THREE.BufferGeometry();
baked.setAttribute('position', new THREE.BufferAttribute(positions, 3));
baked.setIndex(source.index);
const face = new THREE.Mesh(baked, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
const uvs = source.attributes.uv;
const ray = new THREE.Raycaster();
const back = new THREE.Vector3(0, 0, -1);

/** The face where a ray straight back at (x, y) first meets her: point, smooth normal, uv. */
function surface(x, y) {
  ray.set(new THREE.Vector3(x, y, 1), back);
  const hit = ray.intersectObject(face, false)[0];
  if (!hit) throw new Error(`no face at ${x}, ${y}`);
  const { a, b, c } = hit.face;
  const pa = new THREE.Vector3().fromBufferAttribute(baked.attributes.position, a);
  const pb = new THREE.Vector3().fromBufferAttribute(baked.attributes.position, b);
  const pc = new THREE.Vector3().fromBufferAttribute(baked.attributes.position, c);
  const bary = new THREE.Triangle(pa, pb, pc).getBarycoord(hit.point, new THREE.Vector3());
  const n = new THREE.Vector3();
  const uv = new THREE.Vector2();
  [a, b, c].forEach((index, k) => {
    const weight = bary.getComponent(k);
    n.addScaledVector(new THREE.Vector3(normals[index * 3], normals[index * 3 + 1], normals[index * 3 + 2]), weight);
    uv.addScaledVector(new THREE.Vector2(uvs.getX(index), uvs.getY(index)), weight);
  });
  return { point: hit.point, normal: n.normalize(), uv };
}

const round = (value) => Math.round(value * 1e5) / 1e5;

/**
 * The smooth skin around a region: a quadratic surface z = f(x, y) fitted
 * (least squares) to her face in a ring just outside the region, then
 * bridged across it. Her mesh is coarse and sculpts the painted features
 * (a carved smile, a raised lower lip, the eyes), so a patch that followed
 * the mesh would shade as a lumpy smudge; this one is as smooth as skin.
 */
function skinOver({ cx, cy, a, b }) {
  const rows = [];
  const zs = [];
  for (let k = 0; k < 48; k += 1) {
    const angle = (2 * Math.PI * k) / 48;
    for (const scale of [1.0, 1.15, 1.3]) {
      const x = cx + a * scale * Math.cos(angle);
      const y = cy + b * scale * Math.sin(angle);
      const { point } = surface(x, y);
      const dx = x - cx;
      const dy = y - cy;
      rows.push([1, dx, dy, dx * dx, dx * dy, dy * dy]);
      zs.push(point.z);
    }
  }
  // Normal equations, solved by Gaussian elimination.
  const n = 6;
  const m = Array.from({ length: n }, () => new Array(n + 1).fill(0));
  rows.forEach((row, r) => {
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) m[i][j] += row[i] * row[j];
      m[i][n] += row[i] * zs[r];
    }
  });
  for (let i = 0; i < n; i += 1) {
    let pivot = i;
    for (let r = i + 1; r < n; r += 1) if (Math.abs(m[r][i]) > Math.abs(m[pivot][i])) pivot = r;
    [m[i], m[pivot]] = [m[pivot], m[i]];
    for (let r = 0; r < n; r += 1) {
      if (r === i) continue;
      const factor = m[r][i] / m[i][i];
      for (let c = i; c <= n; c += 1) m[r][c] -= factor * m[i][c];
    }
  }
  const k = m.map((row, i) => row[n] / row[i]);
  return (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const z = k[0] + k[1] * dx + k[2] * dy + k[3] * dx * dx + k[4] * dx * dy + k[5] * dy * dy;
    const dzdx = k[1] + 2 * k[3] * dx + k[4] * dy;
    const dzdy = k[2] + k[4] * dx + 2 * k[5] * dy;
    return { point: new THREE.Vector3(x, y, z), normal: new THREE.Vector3(-dzdx, -dzdy, 1).normalize() };
  };
}

/**
 * A grid over an ellipse on the smooth skin around it: (cols + 1) columns
 * across, each running from the ellipse's top edge (row 0) to its bottom
 * edge, lifted along the skin's normal.
 */
function patch(region, { cols, rows }, lift) {
  const { cx, cy, a, b } = region;
  const skin = skinOver(region);
  const out = { cols, rows, positions: [], normals: [] };
  for (let j = 0; j <= rows; j += 1) {
    for (let i = 0; i <= cols; i += 1) {
      // Across: closer together towards the ends, where the ellipse narrows.
      const across = Math.sin(-Math.PI / 2 + (Math.PI * i) / cols) * 0.985;
      const x = cx + a * across;
      const half = b * Math.sqrt(1 - across * across);
      const y = cy + half - (2 * half * j) / rows;
      // From the ellipse's edge, the lift rises to its full height a third
      // of the way in (a soft step).
      const r2 = Math.min(1, ((x - cx) / a) ** 2 + ((y - cy) / b) ** 2);
      const t = Math.min(1, (1 - r2) / 0.35);
      const rise = t * t * (3 - 2 * t);
      const { point, normal } = skin(x, y);
      const rim = y < cy && lift.bottomRim !== undefined ? lift.bottomRim : lift.rim;
      point.addScaledVector(normal, rim + (lift.middle - rim) * rise);
      out.positions.push(round(point.x), round(point.y), round(point.z));
      out.normals.push(round(normal.x), round(normal.y), round(normal.z));
    }
  }
  return out;
}

/**
 * How far her face rises above a patch over its paint, sampled between its
 * grid points (her mesh is coarse, so its facets and sculpted lips can poke
 * through a patch that only touches it at the grid points). Must be below
 * zero, or the paint shows through in specks.
 */
function poking(patchData, paint) {
  const { cols, rows, positions } = patchData;
  const across = cols + 1;
  const p = (i) => new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
  let worst = -Infinity;
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const a = j * across + i;
      for (const [x0, x1, x2] of [[a, a + across, a + 1], [a + 1, a + across, a + across + 1]]) {
        const A = p(x0), B = p(x1), C = p(x2);
        for (let s = 0; s <= 4; s += 1) {
          for (let t = 0; t <= 4 - s; t += 1) {
            const u = s / 4, w = t / 4;
            const q = A.clone().multiplyScalar(1 - u - w).addScaledVector(B, u).addScaledVector(C, w);
            if (((q.x - paint.cx) / paint.a) ** 2 + ((q.y - paint.cy) / paint.b) ** 2 > 1) continue;
            const hit = surface(q.x, q.y);
            worst = Math.max(worst, hit.point.z - q.z);
          }
        }
      }
    }
  }
  return worst;
}

/** The texture's colour at a uv, and how far it is from her skin tone. */
function texel(uv) {
  const col = Math.min(info.width - 1, Math.floor((((uv.x % 1) + 1) % 1) * info.width));
  const row = Math.min(info.height - 1, Math.floor((((uv.y % 1) + 1) % 1) * info.height));
  const k = (row * info.width + col) * info.channels;
  return [pixels[k], pixels[k + 1], pixels[k + 2]];
}
// Her skin, measured on her cheeks: anything far from it is paint.
const SKIN = [192, 110, 58];
const isSkin = (colour) => Math.hypot(...colour.map((c, k) => c - SKIN[k])) < 45;
/** Of the skin in a ring around a region, the spot closest to its median colour. */
function skinSpot({ cx, cy, a, b }) {
  const samples = [];
  for (let k = 0; k < 72; k += 1) {
    const angle = (2 * Math.PI * k) / 72;
    for (const scale of [1.08, 1.18, 1.3]) {
      const { uv } = surface(cx + a * scale * Math.cos(angle), cy + b * scale * Math.sin(angle));
      const colour = texel(uv);
      if (isSkin(colour)) samples.push({ uv, colour });
    }
  }
  if (samples.length < 20) throw new Error(`too little skin around ${cx}, ${cy}`);
  const median = [0, 1, 2].map((c) => {
    const values = samples.map((s) => s.colour[c]).sort((p, q) => p - q);
    return values[values.length >> 1];
  });
  const best = samples.reduce((p, q) =>
    Math.hypot(...q.colour.map((c, k) => c - median[k])) < Math.hypot(...p.colour.map((c, k) => c - median[k])) ? q : p,
  );
  console.log(`skin around ${cx}, ${cy}: median ${median}, picked ${best.colour}`);
  return [round(best.uv.x), round(best.uv.y)];
}

// The mouth faces out along the smooth skin at its centre, just in front of
// her lips wherever they stand out most within its footprint.
const mouthSkin = skinOver(MOUTH_REGION);
const mouthCentre = mouthSkin(MOUTH_CENTER.x, MOUTH_CENTER.y);
let lipsOut = -Infinity;
for (let i = 0; i <= 20; i += 1) {
  for (let j = 0; j <= 12; j += 1) {
    const x = MOUTH_CENTER.x + MOUTH_FOOTPRINT.a * (-1 + (2 * i) / 20);
    const y = MOUTH_CENTER.y + MOUTH_FOOTPRINT.b * (-1 + (2 * j) / 12);
    if (((x - MOUTH_CENTER.x) / MOUTH_FOOTPRINT.a) ** 2 + ((y - MOUTH_CENTER.y) / MOUTH_FOOTPRINT.b) ** 2 > 1) continue;
    const face = surface(x, y).point;
    const skin = mouthSkin(x, y);
    lipsOut = Math.max(lipsOut, face.clone().sub(skin.point).dot(mouthCentre.normal));
  }
}
const MOUTH_OUT = lipsOut + MOUTH_LIFT;
const shape = {
  lids: LID_REGIONS.map((region) => patch(region, LID_GRID, LID_LIFT)),
  mouth: {
    centre: [
      round(mouthCentre.point.x + mouthCentre.normal.x * MOUTH_OUT),
      round(mouthCentre.point.y + mouthCentre.normal.y * MOUTH_OUT),
      round(mouthCentre.point.z + mouthCentre.normal.z * MOUTH_OUT),
    ],
    normal: [round(mouthCentre.normal.x), round(mouthCentre.normal.y), round(mouthCentre.normal.z)],
  },
  skinUv: LID_REGIONS.map(skinSpot),
};

console.log(`mouth: ${(MOUTH_OUT * 1000).toFixed(1)} mm out from the smooth skin (her lips stand out ${(lipsOut * 1000).toFixed(1)} mm)`);
for (const [name, data, paint] of [
  ['right lid', shape.lids[0], PAINTED_EYES[0]],
  ['left lid', shape.lids[1], PAINTED_EYES[1]],
]) {
  const worst = poking(data, paint);
  console.log(`${name}: over its paint her face stays ${(-worst * 1000).toFixed(2)} mm under it`);
  if (worst > 0) throw new Error(`${name}: her face pokes through by ${(worst * 1000).toFixed(2)} mm`);
}

const text = `// RUSH's moving face, fitted to public/models/rush/rush-body.glb by
// scripts/fit-face.mjs: run it again after changing her model. Do not edit
// by hand.
//
// Positions are in her model's space at rest (metres, feet at the origin,
// facing +Z). Each lid is a grid of (cols + 1) x (rows + 1) points, row by
// row from the top edge of an ellipse to its bottom edge, bridged over the
// smooth skin around her eye and lifted a little off it; normals are that
// skin's.
//
// No runtime imports, so Node's test runner can check it.

export interface FacePatch {
  cols: number;
  rows: number;
  positions: readonly number[];
  normals: readonly number[];
}

export interface FaceShape {
  /** A lid over each painted eye: her right (at -x), then her left. */
  lids: readonly FacePatch[];
  /** Where the code-built mouth sits, and which way it faces. */
  mouth: { centre: readonly number[]; normal: readonly number[] };
  /** For each lid, a texture spot of plain skin it takes its colour from. */
  skinUv: readonly (readonly number[])[];
}

export const FACE_SHAPE: FaceShape = ${JSON.stringify(shape)};
`;
writeFileSync(output, text);
console.log(`wrote ${output}: lids ${shape.lids.map((l) => l.positions.length / 3).join(' + ')} points, skin uvs ${JSON.stringify(shape.skinUv)}`);
