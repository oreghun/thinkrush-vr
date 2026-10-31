// Makes an imported model (for example from Meshy) light enough for the
// headset: shrinks every texture to at most --max-texture pixels, stores
// colour maps as JPEG and data maps (metal/roughness, normals, occlusion)
// as lossless PNG, and can replace a nearly uniform metallic-roughness map
// with plain factors. Geometry is copied unchanged.
//
//   node scripts/optimize-model.mjs <in.glb> <out.glb> \
//     [--max-texture 1024] [--flat-roughness 0.55] [--height 0.55]
//
// --height gives the model its real size: its root node is scaled so the
// model stands that many metres tall, with its origin at the centre of its
// base, so a scene can stand it on the floor at scale 1. Meshy models come
// centred on their middle at about 2 units across.
//
// Data maps are kept at half the colour maps' size: metal and roughness
// change over broad areas, and PNG at full size would dominate the file.
//
// Uses only sharp (already installed) and the GLB container format, so no
// outside tool runs on the file.
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const [input, output, ...flags] = process.argv.slice(2);
if (!input || !output) {
  console.error(
    'usage: node scripts/optimize-model.mjs <in.glb> <out.glb> [--max-texture N] [--flat-roughness R] [--height M]',
  );
  process.exit(1);
}
const option = (name, fallback) => {
  const at = flags.indexOf(name);
  return at === -1 ? fallback : Number(flags[at + 1]);
};
const maxTexture = option('--max-texture', 1024);
const maxDataTexture = Math.max(128, Math.round(maxTexture / 2));
const flatRoughness = option('--flat-roughness', undefined);
const height = option('--height', undefined);

// A GLB is a 12-byte header, a JSON chunk and one binary chunk.
const glb = readFileSync(input);
if (glb.toString('latin1', 0, 4) !== 'glTF') {
  throw new Error(`${input} is not a GLB file`);
}
const jsonLength = glb.readUInt32LE(12);
const gltf = JSON.parse(glb.toString('utf8', 20, 20 + jsonLength));
const binStart = 20 + jsonLength + 8;
const viewBytes = (view) => {
  const start = binStart + (view.byteOffset ?? 0);
  return glb.subarray(start, start + view.byteLength);
};

// Swap the metallic-roughness map for factors: wood is not metal, and a
// 2048-pixel image of one roughness value costs megabytes for nothing.
if (flatRoughness !== undefined) {
  for (const material of gltf.materials ?? []) {
    const pbr = material.pbrMetallicRoughness;
    if (pbr?.metallicRoughnessTexture) {
      delete pbr.metallicRoughnessTexture;
      pbr.metallicFactor = 0;
      pbr.roughnessFactor = flatRoughness;
    }
  }
}

// Real size: scale the root so the model is `height` metres tall and move
// its origin to the centre of its base. Only for a single root node with no
// transform of its own (as Meshy exports), so nothing is silently combined.
if (height !== undefined) {
  const roots = gltf.scenes[gltf.scene ?? 0].nodes;
  const root = gltf.nodes[roots[0]];
  if (roots.length !== 1 || root.matrix || root.rotation || root.scale || root.translation) {
    throw new Error('--height needs one root node without its own transform');
  }
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const visit = (node) => {
    if (node.matrix || node.rotation || node.scale || node.translation) {
      if (node !== root) {
        throw new Error('--height needs child nodes without transforms');
      }
    }
    for (const primitive of gltf.meshes[node.mesh]?.primitives ?? []) {
      const accessor = gltf.accessors[primitive.attributes.POSITION];
      for (let i = 0; i < 3; i += 1) {
        min[i] = Math.min(min[i], accessor.min[i]);
        max[i] = Math.max(max[i], accessor.max[i]);
      }
    }
    for (const child of node.children ?? []) {
      visit(gltf.nodes[child]);
    }
  };
  visit(root);
  const scale = height / (max[1] - min[1]);
  root.scale = [scale, scale, scale];
  root.translation = [
    -((min[0] + max[0]) / 2) * scale,
    -min[1] * scale,
    -((min[2] + max[2]) / 2) * scale,
  ];
  console.log(
    `real size: ${((max[0] - min[0]) * scale).toFixed(2)} x ${height} x ${((max[2] - min[2]) * scale).toFixed(2)} m (w x h x d)`,
  );
}

// Drop textures and images no material uses any more, renumbering the rest.
const textureSlots = [];
// Textures holding data rather than colour: JPEG would bleed one channel
// into the next (metal into roughness), so these stay lossless.
const dataTextures = new Set();
const DATA_SLOTS = [
  'metallicRoughnessTexture',
  'normalTexture',
  'occlusionTexture',
];
for (const material of gltf.materials ?? []) {
  for (const holder of [material, material.pbrMetallicRoughness ?? {}]) {
    for (const [key, value] of Object.entries(holder)) {
      if (key.endsWith('Texture') && typeof value?.index === 'number') {
        textureSlots.push(value);
        if (DATA_SLOTS.includes(key)) {
          dataTextures.add(value.index);
        }
      }
    }
  }
}
const dataImages = new Set(
  [...dataTextures].map((index) => gltf.textures[index].source),
);
const keptTextures = [...new Set(textureSlots.map((slot) => slot.index))];
const keptImages = [
  ...new Set(keptTextures.map((index) => gltf.textures[index].source)),
];
for (const slot of textureSlots) {
  slot.index = keptTextures.indexOf(slot.index);
}
gltf.textures = keptTextures.map((index) => ({
  ...gltf.textures[index],
  source: keptImages.indexOf(gltf.textures[index].source),
}));
const images = keptImages.map((index) => gltf.images[index]);

// Re-encode each kept image: at most maxTexture pixels a side, JPEG unless
// it holds data or needs transparency.
const encoded = new Map();
for (const [position, image] of images.entries()) {
  const lossless = dataImages.has(keptImages[position]);
  const source = viewBytes(gltf.bufferViews[image.bufferView]);
  const side = lossless ? maxDataTexture : maxTexture;
  const picture = sharp(source).resize({
    width: side,
    height: side,
    fit: 'inside',
    withoutEnlargement: true,
  });
  const { hasAlpha } = await sharp(source).metadata();
  const png = lossless || hasAlpha;
  const bytes = png
    ? await picture.png({ compressionLevel: 9 }).toBuffer()
    : await picture.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  image.mimeType = png ? 'image/png' : 'image/jpeg';
  encoded.set(image.bufferView, bytes);
}

// Rebuild the binary chunk from the views still in use, 4-byte aligned.
const usedViews = new Set([
  ...(gltf.accessors ?? []).map((accessor) => accessor.bufferView),
  ...images.map((image) => image.bufferView),
]);
const parts = [];
const viewIndex = new Map();
const views = [];
let offset = 0;
gltf.bufferViews.forEach((view, index) => {
  if (!usedViews.has(index)) {
    return;
  }
  const bytes = encoded.get(index) ?? viewBytes(view);
  const padding = (4 - (offset % 4)) % 4;
  parts.push(Buffer.alloc(padding), bytes);
  offset += padding;
  viewIndex.set(index, views.length);
  views.push({
    ...view,
    buffer: 0,
    byteOffset: offset,
    byteLength: bytes.length,
  });
  offset += bytes.length;
});
for (const accessor of gltf.accessors ?? []) {
  accessor.bufferView = viewIndex.get(accessor.bufferView);
}
for (const image of images) {
  image.bufferView = viewIndex.get(image.bufferView);
}
gltf.bufferViews = views;
gltf.images = images;
let bin = Buffer.concat(parts);
bin = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
gltf.buffers = [{ byteLength: bin.length }];

let json = Buffer.from(JSON.stringify(gltf), 'utf8');
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
const header = Buffer.alloc(12);
header.write('glTF', 0, 'latin1');
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
const chunk = (length, type) => {
  const head = Buffer.alloc(8);
  head.writeUInt32LE(length, 0);
  head.write(type, 4, 'latin1');
  return head;
};
writeFileSync(
  output,
  Buffer.concat([
    header,
    chunk(json.length, 'JSON'),
    json,
    chunk(bin.length, 'BIN\0'),
    bin,
  ]),
);
const megabytes = (bytes) => (bytes / 1024 / 1024).toFixed(2);
console.log(
  `${input}: ${megabytes(glb.length)} MB -> ${output}: ${megabytes(12 + 16 + json.length + bin.length)} MB`,
);
