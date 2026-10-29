import {
  BaseControllerVisual,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  type InputLayout,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  type PerspectiveCamera,
  Quaternion,
  type Scene,
  SphereGeometry,
  Vector3,
  type VisualConstructor,
  type VisualImplementation,
  type World,
  type XRAssetLoader,
  type XRHandVisualAdapter,
  type XRInputVisualAdapter,
} from '@iwsdk/core';

/**
 * Hand and controller visuals built in code. By default IWSDK downloads its
 * hand and controller models from a public CDN when XR input connects; the
 * game makes no outside requests and ships only code-generated assets, so
 * installCodeInputVisuals swaps these in before any XR session can start.
 */

type GLTF = Awaited<ReturnType<XRAssetLoader['loadGLTF']>>;

// WebXR hand joints in XRHand order: the wrist, then the thumb (4 joints)
// and each finger (5 joints) from the base outwards.
const JOINT_COUNT = 25;
// Joint radii in meters, in the same order.
// prettier-ignore
const JOINT_RADII = [
  0.016,
  0.014, 0.012, 0.01, 0.009,
  0.011, 0.01, 0.009, 0.008, 0.007,
  0.011, 0.0105, 0.0095, 0.0085, 0.0075,
  0.0105, 0.0095, 0.009, 0.008, 0.007,
  0.0095, 0.0085, 0.0075, 0.007, 0.0065,
];
// Joint pairs drawn as bones: each digit from the wrist out, then the line
// of knuckles across the palm.
// prettier-ignore
const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8], [8, 9],
  [0, 10], [10, 11], [11, 12], [12, 13], [13, 14],
  [0, 15], [15, 16], [16, 17], [17, 18], [18, 19],
  [0, 20], [20, 21], [21, 22], [22, 23], [23, 24],
  [6, 11], [11, 16], [16, 21],
] as const;
// Bones are a little thinner than the joints they connect.
const BONE_RADIUS_SCALE = 0.85;
const UP = new Vector3(0, 1, 0);

// Warm ochre reads against both the pale floor and the dark graphite pieces.
const inputMaterial = new MeshStandardMaterial({
  color: '#d9a440',
  roughness: 0.55,
});
const jointGeometry = new SphereGeometry(1, 12, 8);
const boneGeometry = new CylinderGeometry(1, 1, 1, 8, 1, true);

/** Two instanced meshes per hand: one draw call for joints, one for bones. */
function createHandModel(): Group {
  const hidden = new Matrix4().makeScale(0, 0, 0);
  const joints = new InstancedMesh(jointGeometry, inputMaterial, JOINT_COUNT);
  const bones = new InstancedMesh(boneGeometry, inputMaterial, BONES.length);
  joints.name = 'joints';
  bones.name = 'bones';
  for (const mesh of [joints, bones]) {
    // Instances move every frame, so the mesh's bounding sphere is stale.
    mesh.frustumCulled = false;
    for (let i = 0; i < mesh.count; i += 1) {
      mesh.setMatrixAt(i, hidden);
    }
  }
  const hand = new Group().add(joints, bones);
  hand.name = 'code-hand';
  return hand;
}

/** A plain rounded handle with a marker at the front, in the grip's frame. */
function createControllerModel(): Group {
  const handle = new Mesh(
    new CapsuleGeometry(0.018, 0.07, 4, 12),
    inputMaterial,
  );
  handle.rotation.x = Math.PI / 2;
  handle.position.z = 0.015;
  const front = new Mesh(new SphereGeometry(0.012, 12, 8), inputMaterial);
  front.position.z = -0.04;
  const controller = new Group().add(handle, front);
  controller.name = 'code-controller';
  return controller;
}

/** Places joint spheres and bone cylinders from the tracked joint poses. */
class CodeHandVisual implements VisualImplementation {
  static assetKeyPrefix = 'code-hand';
  static assetProfileId = 'code';

  xrInput?: XRInputVisualAdapter;
  private enabled = true;
  private readonly joints: InstancedMesh;
  private readonly bones: InstancedMesh;
  private readonly matrix = new Matrix4();
  private readonly positions = Array.from(
    { length: JOINT_COUNT },
    () => new Vector3(),
  );
  private readonly direction = new Vector3();
  private readonly midpoint = new Vector3();
  private readonly rotation = new Quaternion();
  private readonly scale = new Vector3();

  constructor(
    _scene: Scene,
    _camera: PerspectiveCamera,
    readonly model: Group,
    _layout: InputLayout,
  ) {
    this.joints = model.getObjectByName('joints') as InstancedMesh;
    this.bones = model.getObjectByName('bones') as InstancedMesh;
  }

  init(): void {}

  connect(_inputSource: XRInputSource, enabled: boolean): void {
    this.toggle(enabled);
  }

  disconnect(): void {}

  toggle(enabled: boolean): void {
    this.enabled = enabled;
    this.model.visible = enabled;
  }

  update(): void {
    // Joint poses relative to the grip, which the adapter copies onto model.
    const transforms = (this.xrInput as XRHandVisualAdapter | undefined)
      ?.jointTransforms;
    if (!this.enabled || !transforms || transforms.length < JOINT_COUNT * 16) {
      return;
    }
    for (let i = 0; i < JOINT_COUNT; i += 1) {
      this.matrix.fromArray(transforms, i * 16);
      this.positions[i].setFromMatrixPosition(this.matrix);
      this.matrix.scale(this.scale.setScalar(JOINT_RADII[i]));
      this.joints.setMatrixAt(i, this.matrix);
    }
    for (let i = 0; i < BONES.length; i += 1) {
      const from = BONES[i][0];
      const to = BONES[i][1];
      const start = this.positions[from];
      this.direction.subVectors(this.positions[to], start);
      const length = this.direction.length();
      this.midpoint.copy(start).addScaledVector(this.direction, 0.5);
      this.rotation.setFromUnitVectors(
        UP,
        this.direction.divideScalar(length || 1),
      );
      const radius =
        BONE_RADIUS_SCALE * Math.min(JOINT_RADII[from], JOINT_RADII[to]);
      this.scale.set(radius, length, radius);
      this.matrix.compose(this.midpoint, this.rotation, this.scale);
      this.bones.setMatrixAt(i, this.matrix);
    }
    this.joints.instanceMatrix.needsUpdate = true;
    this.bones.instanceMatrix.needsUpdate = true;
  }
}

/** The stock controller behavior, given the code-built model. */
class CodeControllerVisual extends BaseControllerVisual {
  static assetKeyPrefix = 'code-controller';
  static assetProfileId = 'code';
}

/** Call right after World.create, before any XR input can connect. */
export function installCodeInputVisuals(world: World): void {
  const { controller, hand } = world.input.xr.visualAdapters;
  for (const adapter of [controller.left, controller.right]) {
    useCodeVisual(adapter, createControllerModel, CodeControllerVisual);
  }
  for (const adapter of [hand.left, hand.right]) {
    useCodeVisual(adapter, createHandModel, CodeHandVisual);
  }
}

function useCodeVisual(
  adapter: XRInputVisualAdapter,
  createModel: () => Group,
  visualClass: VisualConstructor<VisualImplementation>,
): void {
  // World.create gives every adapter the AssetManager, which fetches the
  // model URL from the input profile, and offers no option to change that.
  // This loader hands back a code-built model for whatever URL is asked for.
  const loader: XRAssetLoader = {
    loadGLTF: () => Promise.resolve({ scene: createModel() } as GLTF),
  };
  (adapter as unknown as { assetLoader: XRAssetLoader }).assetLoader = loader;
  adapter.updateVisualImplementation(visualClass);
}
