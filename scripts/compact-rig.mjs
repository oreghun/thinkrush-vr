// Makes a rigged, animated character (a Meshy export, already through
// optimize-model.mjs for its textures) small enough for the headset:
//
//   node scripts/compact-rig.mjs <in.glb> <out.glb> \
//     --keep Walking,Idle_3,...      animations to keep (all if omitted)
//     --pin Big_Wave_Hello,...       animations held in place: the root
//                                    bone's sideways and forward drift is
//                                    removed, its height kept
//     [--pin-ref Idle_3]             where pinned animations stand: that
//                                    animation's first frame (default: each
//                                    pinned animation's own first frame)
//     [--root mixamorig:Hips] [--no-images]
//
// It drops every accessor, buffer view and animation nothing uses (Meshy's
// exports carry megabytes of leftovers), animation tracks that only ever
// hold the bone's rest value, and the TANGENT attribute (unused without a
// normal map). --no-images leaves the textures out, for analysis in Node.
// Uses only the GLB container format, so no outside tool runs on the file.

import { readFileSync, writeFileSync } from 'node:fs';

const [input, output, ...flags] = process.argv.slice(2);
if (!input || !output) {
  throw new Error('usage: node scripts/compact-rig.mjs <in.glb> <out.glb> [--keep a,b] [--pin a,b] [--root name] [--no-images]');
}
const list = (name) => {
  const at = flags.indexOf(name);
  return at >= 0 ? flags[at + 1].split(',').map((s) => s.trim()).filter(Boolean) : undefined;
};
const keep = list('--keep');
const pin = new Set(list('--pin') ?? []);
const rootName = (() => {
  const at = flags.indexOf('--root');
  return at >= 0 ? flags[at + 1] : 'mixamorig:Hips';
})();
const noImages = flags.includes('--no-images');
const pinRef = (() => {
  const at = flags.indexOf('--pin-ref');
  return at >= 0 ? flags[at + 1] : undefined;
})();

const glb = readFileSync(input);
const jsonLength = glb.readUInt32LE(12);
const gltf = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8'));
const binStart = 20 + jsonLength + 8;
const viewBytes = (view) => {
  const start = binStart + (view.byteOffset ?? 0);
  return glb.subarray(start, start + view.byteLength);
};
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

/** An accessor's values as floats (animation data is float32). */
function floats(index) {
  const accessor = gltf.accessors[index];
  if (accessor.componentType !== 5126) throw new Error(`accessor ${index} is not float32`);
  const view = gltf.bufferViews[accessor.bufferView];
  const bytes = viewBytes(view);
  const width = COMPONENTS[accessor.type];
  const stride = view.byteStride ?? width * 4;
  const out = new Float32Array(accessor.count * width);
  for (let i = 0; i < accessor.count; i += 1) {
    for (let c = 0; c < width; c += 1) {
      out[i * width + c] = bytes.readFloatLE((accessor.byteOffset ?? 0) + i * stride + c * 4);
    }
  }
  return out;
}

// New binary chunks, added as fresh buffer views (old ones are dropped
// when nothing refers to them any more).
const added = [];
function addFloats(values, type, accessorTemplate) {
  const bytes = Buffer.from(values.buffer, values.byteOffset, values.byteLength);
  added.push(bytes);
  gltf.bufferViews.push({ buffer: 0, byteLength: bytes.length, newIndex: added.length - 1 });
  const accessor = { ...accessorTemplate, bufferView: gltf.bufferViews.length - 1, byteOffset: 0, type };
  delete accessor.sparse;
  gltf.accessors.push(accessor);
  return gltf.accessors.length - 1;
}

// 1. Animations: keep the named ones.
const before = gltf.animations?.length ?? 0;
if (keep) {
  const missing = keep.filter((name) => !gltf.animations.some((a) => a.name === name));
  if (missing.length) throw new Error(`no animation named ${missing.join(', ')}`);
  gltf.animations = gltf.animations.filter((a) => keep.includes(a.name));
}

// 2. Tracks: drop the ones that only hold the rest value; pin root drift.
const rootIndex = gltf.nodes.findIndex((node) => node.name === rootName);
let pinXZ;
if (pinRef) {
  const reference = gltf.animations.find((a) => a.name === pinRef);
  const channel = reference?.channels.find(
    (c) => c.target.node === rootIndex && c.target.path === 'translation',
  );
  if (!channel) throw new Error(`--pin-ref ${pinRef}: no root translation track`);
  const first = floats(reference.samplers[channel.sampler].output);
  pinXZ = [first[0], first[2]];
}
let dropped = 0;
for (const animation of gltf.animations ?? []) {
  const kept = [];
  for (const channel of animation.channels) {
    const sampler = animation.samplers[channel.sampler];
    const node = gltf.nodes[channel.target.node];
    const path = channel.target.path;
    const values = floats(sampler.output);
    const width = path === 'rotation' ? 4 : 3;
    const rest =
      path === 'rotation' ? node.rotation ?? [0, 0, 0, 1]
      : path === 'scale' ? node.scale ?? [1, 1, 1]
      : node.translation ?? [0, 0, 0];
    if (channel.target.node === rootIndex && path === 'translation' && pin.has(animation.name)) {
      // In place: one sideways and forward position, always (the reference
      // animation's, so every pinned move stands where the idle does).
      const [x, z] = pinXZ ?? [values[0], values[2]];
      for (let i = 0; i < values.length; i += 3) {
        values[i] = x;
        values[i + 2] = z;
      }
      sampler.output = addFloats(values, 'VEC3', gltf.accessors[sampler.output]);
    }
    let still = true;
    for (let i = 0; i < values.length && still; i += width) {
      for (let c = 0; c < width; c += 1) {
        // A quaternion and its negation are the same turn.
        const same = Math.abs(values[i + c] - rest[c]) < 1e-4;
        if (!same) { still = false; break; }
      }
    }
    if (still && channel.target.node !== rootIndex) {
      dropped += 1;
      continue;
    }
    kept.push(channel);
  }
  // Renumber samplers to the kept channels.
  const samplers = [];
  animation.channels = kept.map((channel) => {
    samplers.push(animation.samplers[channel.sampler]);
    return { ...channel, sampler: samplers.length - 1 };
  });
  animation.samplers = samplers;
}

// 3. Meshes: drop TANGENT (no normal map uses it).
for (const mesh of gltf.meshes ?? []) {
  for (const primitive of mesh.primitives) delete primitive.attributes.TANGENT;
}
if (noImages) {
  for (const material of gltf.materials ?? []) {
    delete material.pbrMetallicRoughness?.baseColorTexture;
    delete material.pbrMetallicRoughness?.metallicRoughnessTexture;
    delete material.normalTexture;
    delete material.occlusionTexture;
    delete material.emissiveTexture;
  }
  delete gltf.textures;
  delete gltf.images;
  delete gltf.samplers;
}

// 4. Keep only accessors something uses, then only buffer views something uses.
const usedAccessors = new Set();
for (const mesh of gltf.meshes ?? []) {
  for (const primitive of mesh.primitives) {
    Object.values(primitive.attributes).forEach((a) => usedAccessors.add(a));
    if (primitive.indices !== undefined) usedAccessors.add(primitive.indices);
    for (const target of primitive.targets ?? []) Object.values(target).forEach((a) => usedAccessors.add(a));
  }
}
for (const skin of gltf.skins ?? []) if (skin.inverseBindMatrices !== undefined) usedAccessors.add(skin.inverseBindMatrices);
for (const animation of gltf.animations ?? []) {
  for (const sampler of animation.samplers) { usedAccessors.add(sampler.input); usedAccessors.add(sampler.output); }
}
const accessorIndex = new Map();
const accessors = [];
[...usedAccessors].sort((a, b) => a - b).forEach((old) => {
  accessorIndex.set(old, accessors.length);
  accessors.push(gltf.accessors[old]);
});
const remapAccessor = (old) => accessorIndex.get(old);
for (const mesh of gltf.meshes ?? []) {
  for (const primitive of mesh.primitives) {
    for (const key of Object.keys(primitive.attributes)) primitive.attributes[key] = remapAccessor(primitive.attributes[key]);
    if (primitive.indices !== undefined) primitive.indices = remapAccessor(primitive.indices);
    for (const target of primitive.targets ?? []) for (const key of Object.keys(target)) target[key] = remapAccessor(target[key]);
  }
}
for (const skin of gltf.skins ?? []) if (skin.inverseBindMatrices !== undefined) skin.inverseBindMatrices = remapAccessor(skin.inverseBindMatrices);
for (const animation of gltf.animations ?? []) {
  for (const sampler of animation.samplers) { sampler.input = remapAccessor(sampler.input); sampler.output = remapAccessor(sampler.output); }
}
gltf.accessors = accessors;

const usedViews = new Set(accessors.map((a) => a.bufferView));
for (const image of gltf.images ?? []) usedViews.add(image.bufferView);
const chunks = [];
const viewIndex = new Map();
const views = [];
let offset = 0;
gltf.bufferViews.forEach((view, index) => {
  if (!usedViews.has(index)) return;
  const bytes = view.newIndex !== undefined ? added[view.newIndex] : viewBytes(view);
  const padding = (4 - (offset % 4)) % 4;
  if (padding) { chunks.push(Buffer.alloc(padding)); offset += padding; }
  const { newIndex, ...rest } = view;
  viewIndex.set(index, views.length);
  views.push({ ...rest, buffer: 0, byteOffset: offset });
  chunks.push(bytes);
  offset += bytes.length;
});
for (const accessor of accessors) accessor.bufferView = viewIndex.get(accessor.bufferView);
for (const image of gltf.images ?? []) image.bufferView = viewIndex.get(image.bufferView);
gltf.bufferViews = views;
const binary = Buffer.concat(chunks);
const binPadded = Buffer.concat([binary, Buffer.alloc((4 - (binary.length % 4)) % 4)]);
gltf.buffers = [{ byteLength: binPadded.length }];

const json = Buffer.from(JSON.stringify(gltf), 'utf8');
const jsonPadded = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + binPadded.length, 8);
const chunk = (type, data) => {
  const head = Buffer.alloc(8);
  head.writeUInt32LE(data.length, 0);
  head.writeUInt32LE(type, 4);
  return Buffer.concat([head, data]);
};
writeFileSync(output, Buffer.concat([header, chunk(0x4e4f534a, jsonPadded), chunk(0x004e4942, binPadded)]));
console.log(
  `${input}: ${(glb.length / 1e6).toFixed(2)} MB -> ${output}: ${(binPadded.length / 1e6 + jsonPadded.length / 1e6).toFixed(2)} MB; ` +
    `animations ${before} -> ${gltf.animations?.length ?? 0}, ${dropped} still tracks dropped`,
);
