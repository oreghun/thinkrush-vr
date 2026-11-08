import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from '@iwsdk/core';
import { FACE_SHAPE, type FacePatch } from './rush-face-shape.js';
import { lidOpenness, mouthShape, type MoodName } from './rush-mood.js';

// A blink every few seconds: shut and open again in about a tenth of a
// second. Lids and mouth ease towards their target so nothing snaps.
const BLINK_SECONDS = 0.12;
const LID_RATE = 30;
const MOUTH_RATE = 28;
// The lash line along a lid's lower edge: the skin colour times this, in a
// band this share of the lid's last row deep (a crisp line, about 2 mm).
const LASH = 0.1;
const LASH_DEPTH = 0.3;
// Her face's facets shade the skin around her eyes a little darker than a
// smooth lid facing straight out, so the lid's skin is toned down to match.
const LID_SKIN = 0.93;

// Her code-built mouth (metres): an open oval with teeth and a tongue, and a
// lip line that curves into a smile or a frown, flattened to a gentle arc.
const OPEN = { halfWidth: 0.0145, halfHeight: 0.009, depth: 0.0025 };
const TEETH = { width: 0.0098, height: 0.0024, depth: 0.0012, y: 0.0048 };
const TONGUE = { width: 0.0085, height: 0.0034, depth: 0.0012, y: -0.0046 };
const LIP = { radius: 0.016, tube: 0.0021, flatten: 0.45 };
const FORWARD = new Vector3(0, 0, 1);

const oval = new SphereGeometry(1, 20, 12);
const lipGeometry = new TorusGeometry(LIP.radius, LIP.tube, 8, 28, Math.PI);
const inside = new MeshStandardMaterial({ color: '#4a1716', roughness: 0.7 });
const tongueMaterial = new MeshStandardMaterial({ color: '#c8606a', roughness: 0.6 });
const teethMaterial = new MeshStandardMaterial({ color: '#f4ede4', roughness: 0.5 });
const lipMaterial = new MeshStandardMaterial({ color: '#6a2a24', roughness: 0.6 });

/**
 * RUSH's moving face on the girl's painted one (src/rush-face-shape.ts,
 * fitted by scripts/fit-face.mjs): a lid over each eye that slides down from
 * the top of the eye to blink, droops when she is sleepy and narrows a little
 * when she is pleased or worried, with a lash line on its lower edge; and a
 * mouth built in code just in front of her carved lips (her painted smile is
 * gone from her texture: scripts/paint-face.mjs) that smiles, frowns, makes
 * an "o" and chatters while she talks. The lids take their colour from plain
 * skin in her own texture, so they match her face under the same light.
 *
 * Everything is built in her model's space at rest: the lids are then hung
 * on her head bone and the mouth group placed each frame by RushBodySystem.
 */
export class GirlFace {
  readonly lids: Mesh[];
  readonly mouth = new Group();
  private readonly open: Mesh;
  private readonly lip: Mesh;
  private lidNow = 1;
  private blinkIn = 2;
  private blinkLeft = 0;
  private mouthAmount = 0;
  private mouthWidth = 1;

  constructor(skin: MeshStandardMaterial) {
    const lidMaterial = skin.clone();
    lidMaterial.vertexColors = true;
    this.lids = FACE_SHAPE.lids.map((patch, side) => {
      const lid = new Mesh(lidGeometry(patch, FACE_SHAPE.skinUv[side]), lidMaterial);
      lid.name = side === 0 ? 'Rush/LidR' : 'Rush/LidL';
      lid.updateMorphTargets();
      lid.morphTargetInfluences![0] = 1;
      lid.visible = false;
      return lid;
    });

    this.mouth.name = 'Rush/GirlMouth';
    const frame = new Group();
    frame.position.fromArray(FACE_SHAPE.mouth.centre);
    frame.quaternion.setFromUnitVectors(FORWARD, new Vector3().fromArray(FACE_SHAPE.mouth.normal));

    this.open = new Mesh(oval, inside);
    this.open.name = 'Open';
    this.open.scale.set(OPEN.halfWidth, OPEN.halfHeight, OPEN.depth);
    this.open.visible = false;
    // Teeth along the top and a tongue at the bottom, just proud of the dark
    // oval; as its children they open and close with it (sizes in metres,
    // divided by the oval's own scale).
    for (const [part, material] of [
      [TEETH, teethMaterial],
      [TONGUE, tongueMaterial],
    ] as const) {
      const mesh = new Mesh(oval, material);
      mesh.scale.set(part.width, part.height, part.depth).divide(this.open.scale);
      mesh.position.set(0, part.y, OPEN.depth * 0.6).divide(this.open.scale);
      this.open.add(mesh);
    }
    this.lip = new Mesh(lipGeometry, lipMaterial);
    this.lip.name = 'Lip';
    frame.add(this.open, this.lip);
    this.mouth.add(frame);
    this.showLip(1, 1);
  }

  /** Shows `mood` on her face; `talking` while she reads aloud or speaks. */
  update(mood: MoodName, talking: boolean, time: number, delta: number): void {
    this.blinkIn -= delta;
    if (this.blinkIn <= 0) {
      this.blinkLeft = BLINK_SECONDS;
      this.blinkIn = 2.5 + Math.random() * 3;
    }
    this.blinkLeft = Math.max(0, this.blinkLeft - delta);
    const lidTarget = this.blinkLeft > 0 ? 0 : lidOpenness(mood);
    this.lidNow += (lidTarget - this.lidNow) * (1 - Math.exp(-LID_RATE * delta));
    for (const lid of this.lids) {
      lid.morphTargetInfluences![0] = this.lidNow;
      lid.visible = this.lidNow < 0.995;
    }

    const shape = mouthShape(mood, talking, time);
    const ease = 1 - Math.exp(-MOUTH_RATE * delta);
    this.mouthAmount += (shape.open - this.mouthAmount) * ease;
    this.mouthWidth += (shape.width - this.mouthWidth) * ease;
    this.open.visible = this.mouthAmount > 0.06;
    this.open.scale.set(
      OPEN.halfWidth * this.mouthWidth,
      OPEN.halfHeight * Math.max(0.06, this.mouthAmount),
      OPEN.depth,
    );
    this.lip.visible = shape.smile !== 0 && !this.open.visible;
    this.showLip(shape.smile, shape.smileSize);
  }

  /** Turns the lip line into a smile (1) or a frown (-1), centred on the mouth. */
  private showLip(smile: number, size: number): void {
    // Half a ring is an arch; turned over it is a smile.
    this.lip.rotation.z = smile > 0 ? Math.PI : 0;
    this.lip.scale.set(size, size * LIP.flatten, size);
    const half = (LIP.radius * LIP.flatten * size) / 2;
    this.lip.position.y = smile > 0 ? half : -half;
  }
}

/**
 * A lid's mesh: its grid with the skin's normals, every point sampling one
 * spot of plain skin, a lash line (a dark band along the bottom edge: an
 * extra row is set in just above it) and an "open" morph that slides every
 * point up to the top of its column.
 */
function lidGeometry(patch: FacePatch, uv: readonly number[]): BufferGeometry {
  const { cols } = patch;
  const across = cols + 1;
  // The grid with one more row, LASH_DEPTH of the last row above the edge.
  const rows = patch.rows + 1;
  const count = across * (rows + 1);
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  for (let row = 0; row <= rows; row += 1) {
    for (let col = 0; col < across; col += 1) {
      const at = (row * across + col) * 3;
      // Rows up to the last-but-one as they are; then the lash row; then the edge.
      const from = Math.min(row, patch.rows - 1);
      const to = row <= patch.rows - 1 ? from : patch.rows;
      const t = row <= patch.rows - 1 ? 0 : row === patch.rows ? 1 - LASH_DEPTH : 1;
      for (let k = 0; k < 3; k += 1) {
        const a = (from * across + col) * 3 + k;
        const b = (to * across + col) * 3 + k;
        positions[at + k] = patch.positions[a] + (patch.positions[b] - patch.positions[a]) * t;
        normals[at + k] = patch.normals[a] + (patch.normals[b] - patch.normals[a]) * t;
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  const uvs = new Float32Array(count * 2);
  for (let i = 0; i < count; i += 1) {
    uvs[i * 2] = uv[0];
    uvs[i * 2 + 1] = uv[1];
  }
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  const index: number[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const a = row * across + col;
      const below = a + across;
      index.push(a, below, a + 1, a + 1, below, below + 1);
    }
  }
  geometry.setIndex(index);
  const colours = new Float32Array(count * 3).fill(LID_SKIN);
  const open = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const row = Math.floor(i / across);
    if (row === rows) colours.fill(LASH, i * 3, i * 3 + 3);
    const top = (i % across) * 3;
    open[i * 3] = positions[top];
    open[i * 3 + 1] = positions[top + 1];
    open[i * 3 + 2] = positions[top + 2];
  }
  geometry.setAttribute('color', new BufferAttribute(colours, 3));
  geometry.morphAttributes.position = [new BufferAttribute(open, 3)];
  return geometry;
}
