// Paints RUSH's painted-on smile out of her texture, so her code-built
// mouth (src/rush-face.ts) is the only mouth she has:
//
//   node scripts/paint-face.mjs [public/models/rush/rush-body.glb]
//
// The texels under the painted lips and teeth (found by drawing each of her
// face's triangles into the texture and keeping the texels whose place on
// her face lies inside MOUTH_PAINT) are filled from the skin around them:
// each one becomes the average of its neighbours, over and over, until the
// fill is as smooth as the skin it meets. Only texels of her face take part,
// so the dark gaps between texture islands never bleed in. The model file is
// rewritten in place with the new texture (JPEG, as the optimizer writes
// it). Running it again changes nothing visible.
//
// Uses three.js (already a dependency), sharp (already installed) and the
// GLB container format.

import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const file = process.argv[2] ?? 'public/models/rush/rush-body.glb';
// Her painted smile on the front of her face (metres, model space at rest),
// with a little room around it.
const MOUTH_PAINT = { cx: -0.0015, cy: 0.849, a: 0.034, b: 0.0165 };
const ROUNDS = 600;

const glb = readFileSync(file);
const jsonLength = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8'));
const binStart = 20 + jsonLength + 8;
const binLength = glb.readUInt32LE(20 + jsonLength);
const bin = glb.subarray(binStart, binStart + binLength);
const viewBytes = (view) => bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
const imageIndex = json.textures[json.materials[0].pbrMetallicRoughness.baseColorTexture.index].source;
const imageView = json.bufferViews[json.images[imageIndex].bufferView];
const { data: pixels, info } = await sharp(viewBytes(imageView)).raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

// Her mesh at rest, from a copy of the file without images (GLTFLoader cannot
// decode them in Node).
function withoutImages() {
  const copy = JSON.parse(JSON.stringify(json));
  for (const m of copy.materials) {
    delete m.pbrMetallicRoughness?.baseColorTexture;
    delete m.pbrMetallicRoughness?.metallicRoughnessTexture;
    delete m.normalTexture;
  }
  delete copy.images;
  delete copy.textures;
  delete copy.samplers;
  return pack(copy, bin);
}
const stripped = withoutImages();
const gltf = await new GLTFLoader().parseAsync(
  stripped.buffer.slice(stripped.byteOffset, stripped.byteOffset + stripped.byteLength),
  '',
);
gltf.scene.updateMatrixWorld(true);
let skinned;
gltf.scene.traverse((object) => {
  if (object.isSkinnedMesh) skinned = object;
});
skinned.skeleton.update();
const geometry = skinned.geometry;
const uvs = geometry.attributes.uv;
const point = (i) => {
  const v = new THREE.Vector3();
  skinned.getVertexPosition(i, v);
  return v.applyMatrix4(skinned.matrixWorld);
};

// Draw her face's triangles into the texture: which texels are her face
// (`face`), and which of those lie under the painted smile (`fill`).
const face = new Uint8Array(width * height);
const fill = new Uint8Array(width * height);
const index = geometry.index;
for (let t = 0; t < index.count / 3; t += 1) {
  const corners = [index.getX(t * 3), index.getX(t * 3 + 1), index.getX(t * 3 + 2)];
  const P = corners.map(point);
  const centre = P[0].clone().add(P[1]).add(P[2]).divideScalar(3);
  if (centre.z < 0.04 || Math.abs(centre.x) > 0.09 || centre.y < 0.8 || centre.y > 0.98) continue;
  const T = corners.map((i) => [uvs.getX(i) * width, uvs.getY(i) * height]);
  const x0 = Math.max(0, Math.floor(Math.min(T[0][0], T[1][0], T[2][0])));
  const x1 = Math.min(width - 1, Math.ceil(Math.max(T[0][0], T[1][0], T[2][0])));
  const y0 = Math.max(0, Math.floor(Math.min(T[0][1], T[1][1], T[2][1])));
  const y1 = Math.min(height - 1, Math.ceil(Math.max(T[0][1], T[1][1], T[2][1])));
  const area = (T[1][0] - T[0][0]) * (T[2][1] - T[0][1]) - (T[2][0] - T[0][0]) * (T[1][1] - T[0][1]);
  if (Math.abs(area) < 1e-9) continue;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w1 = ((px - T[0][0]) * (T[2][1] - T[0][1]) - (T[2][0] - T[0][0]) * (py - T[0][1])) / area;
      const w2 = ((T[1][0] - T[0][0]) * (py - T[0][1]) - (px - T[0][0]) * (T[1][1] - T[0][1])) / area;
      const w0 = 1 - w1 - w2;
      // A texel's edge can touch the triangle without its centre inside.
      if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
      const at = y * width + x;
      face[at] = 1;
      const q = P[0].clone().multiplyScalar(w0).addScaledVector(P[1], w1).addScaledVector(P[2], w2);
      // The front of her face, whichever way a triangle turns (the carved
      // crease of her lips faces up and down).
      if (q.z < 0.07) continue;
      const inside = ((q.x - MOUTH_PAINT.cx) / MOUTH_PAINT.a) ** 2 + ((q.y - MOUTH_PAINT.cy) / MOUTH_PAINT.b) ** 2;
      if (inside <= 1) fill[at] = 1;
    }
  }
}

// Fill from the skin around: start from the average of the skin at the
// fill's edge, then let every filled texel take its face neighbours' average.
const colour = new Float32Array(width * height * 3);
for (let i = 0; i < width * height; i += 1) {
  for (let c = 0; c < 3; c += 1) colour[i * 3 + c] = pixels[i * channels + c];
}
const filled = [];
const rim = [0, 0, 0];
let rimCount = 0;
for (let i = 0; i < width * height; i += 1) {
  if (!fill[i]) continue;
  filled.push(i);
  for (const n of [i - 1, i + 1, i - width, i + width]) {
    if (face[n] && !fill[n]) {
      for (let c = 0; c < 3; c += 1) rim[c] += colour[n * 3 + c];
      rimCount += 1;
    }
  }
}
if (!filled.length || !rimCount) throw new Error('found no painted mouth to fill');
for (const i of filled) for (let c = 0; c < 3; c += 1) colour[i * 3 + c] = rim[c] / rimCount;
for (let round = 0; round < ROUNDS; round += 1) {
  for (const i of filled) {
    const sum = [0, 0, 0];
    let count = 0;
    for (const n of [i - 1, i + 1, i - width, i + width]) {
      if (!face[n]) continue;
      for (let c = 0; c < 3; c += 1) sum[c] += colour[n * 3 + c];
      count += 1;
    }
    if (count) for (let c = 0; c < 3; c += 1) colour[i * 3 + c] = sum[c] / count;
  }
}
// Texture filtering also reads the texels just outside a triangle's patch,
// where the old paint was smeared when the texture was made: give the ones
// bordering the fill (two texels deep) the fill's colour too.
const smeared = [];
let edge = filled;
const taken = new Uint8Array(fill);
for (let ring = 0; ring < 2; ring += 1) {
  const next = [];
  for (const i of edge) {
    for (const n of [i - 1, i + 1, i - width, i + width, i - width - 1, i - width + 1, i + width - 1, i + width + 1]) {
      if (n < 0 || n >= width * height || taken[n] || face[n]) continue;
      taken[n] = 1;
      for (let c = 0; c < 3; c += 1) colour[n * 3 + c] = colour[i * 3 + c];
      next.push(n);
    }
  }
  smeared.push(...next);
  edge = next;
}
const out = Buffer.from(pixels);
for (const i of [...filled, ...smeared]) {
  for (let c = 0; c < 3; c += 1) out[i * channels + c] = Math.round(colour[i * 3 + c]);
}
const jpeg = await sharp(out, { raw: { width, height, channels } }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();

// Put the new texture in and pack the file again.
const views = json.bufferViews.map((view, i) => (i === json.images[imageIndex].bufferView ? jpeg : viewBytes(view)));
const chunks = [];
let offset = 0;
json.bufferViews.forEach((view, i) => {
  const bytes = views[i];
  view.byteOffset = offset;
  view.byteLength = bytes.length;
  chunks.push(bytes);
  const pad = (4 - (bytes.length % 4)) % 4;
  if (pad) chunks.push(Buffer.alloc(pad));
  offset += bytes.length + pad;
});
const newBin = Buffer.concat(chunks);
json.buffers[0].byteLength = newBin.length;
writeFileSync(file, pack(json, newBin));
console.log(`${file}: filled ${filled.length} texels of painted mouth from the skin around (${rimCount} edge texels) and ${smeared.length} around them; texture ${(jpeg.length / 1024).toFixed(0)} KB`);

/** A GLB from its JSON and binary chunk. */
function pack(body, binary) {
  const text = Buffer.from(JSON.stringify(body));
  const padded = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  const binPadded = Buffer.concat([binary, Buffer.alloc((4 - (binary.length % 4)) % 4)]);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + padded.length + 8 + binPadded.length, 8);
  header.writeUInt32LE(padded.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binPadded.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, padded, binHeader, binPadded]);
}
