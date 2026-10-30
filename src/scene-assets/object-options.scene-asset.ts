import {
  Box3,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  type Object3D,
  Vector3,
} from '@iwsdk/core';
import { type TileModel, tileModelFor } from '../tile-models.js';

/**
 * Small, code-generated visual-puzzle props. The source label is only used to
 * choose a model (see tile-models.ts); a label without one is shown as a word
 * on the tile instead. Each returned group is owned by one tile and can be
 * removed/disposed when the next round starts.
 *
 * Keep the geometry deliberately low-poly: these objects are viewed at arm's
 * length on a Quest and the four choices must read by silhouette first.
 */
const materials = {
  cream: new MeshStandardMaterial({ color: '#F1E7D3', roughness: 0.82 }),
  white: new MeshStandardMaterial({ color: '#FFF8E9', roughness: 0.7 }),
  indigo: new MeshStandardMaterial({ color: '#26345F', roughness: 0.66 }),
  turquoise: new MeshStandardMaterial({ color: '#20A6A2', roughness: 0.56 }),
  amber: new MeshStandardMaterial({ color: '#E6B64D', roughness: 0.62 }),
  terracotta: new MeshStandardMaterial({ color: '#C77955', roughness: 0.76 }),
  wood: new MeshStandardMaterial({ color: '#A8774F', roughness: 0.78 }),
  dark: new MeshStandardMaterial({ color: '#303544', roughness: 0.48 }),
  metal: new MeshStandardMaterial({ color: '#B9C6D0', metalness: 0.58, roughness: 0.32 }),
  green: new MeshStandardMaterial({ color: '#5B8A58', roughness: 0.8 }),
  blue: new MeshStandardMaterial({ color: '#386CA8', roughness: 0.56 }),
  red: new MeshStandardMaterial({ color: '#C84F46', roughness: 0.65 }),
};

// Longest side of every miniature, in metres (owner, 2026-10-30: 10 cm
// read better than 8.5 cm). It fits within the display stand's tray,
// about 15.6 x 12.5 cm for the imported stand and 14.2 x 10.2 cm for the
// code-built one.
const OBJECT_SIZE = 0.1;

function add(
  root: Group,
  geometry: BoxGeometry | ConeGeometry | CylinderGeometry | SphereGeometry | TorusGeometry,
  material: MeshStandardMaterial,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
  rotation: [number, number, number] = [0, 0, 0],
): Mesh {
  const part = new Mesh(geometry, material);
  part.position.set(...position);
  part.scale.set(...scale);
  part.rotation.set(...rotation);
  part.castShadow = false;
  part.receiveShadow = false;
  root.add(part);
  return part;
}

function box(root: Group, material: MeshStandardMaterial, pos: [number,number,number], size: [number,number,number], rotation: [number,number,number] = [0,0,0]) {
  return add(root, new BoxGeometry(...size), material, pos, [1,1,1], rotation);
}
function cylinder(root: Group, material: MeshStandardMaterial, pos: [number,number,number], radiusTop: number, radiusBottom: number, height: number, segments=12, rotation: [number,number,number]=[0,0,0]) {
  return add(root, new CylinderGeometry(radiusTop,radiusBottom,height,segments),material,pos,[1,1,1],rotation);
}
function sphere(root: Group, material: MeshStandardMaterial, pos: [number,number,number], scale: [number,number,number], segments=12) {
  return add(root,new SphereGeometry(1,segments,Math.max(6,segments>>1)),material,pos,scale);
}
function ring(root: Group, material: MeshStandardMaterial, pos: [number,number,number], radius:number, tube:number, rotation:[number,number,number]=[0,0,0]) {
  return add(root,new TorusGeometry(radius,tube,6,16),material,pos,[1,1,1],rotation);
}
function makeEgg(root: Group) {
  sphere(root, materials.cream, [0,0.026,0], [0.022,0.031,0.02], 14);
}
function makeHouse(root: Group) {
  box(root,materials.cream,[0,0.018,0],[0.052,0.038,0.045]);
  add(root,new ConeGeometry(0.043,0.034,4),materials.terracotta,[0,0.054,0],[1,1,1],[0,Math.PI/4,0]);
  box(root,materials.dark,[0,0.012,0.023],[0.012,0.024,0.003]);
}
function makeKey(root: Group) {
  cylinder(root,materials.amber,[-0.012,0.018,0],0.006,0.006,0.038,10,[0,0,Math.PI/2]);
  ring(root,materials.amber,[-0.033,0.018,0],0.012,0.003,[Math.PI/2,0,0]);
  box(root,materials.amber,[0.012,0.018,0],[0.013,0.006,0.006]);
  box(root,materials.amber,[0.017,0.025,0],[0.006,0.009,0.006]);
}
function makePadlock(root: Group) {
  box(root,materials.amber,[0,0.018,0],[0.043,0.034,0.016]);
  ring(root,materials.metal,[0,0.041,0],0.014,0.003,[Math.PI/2,0,0]);
}
function makeUmbrella(root: Group) {
  cylinder(root,materials.wood,[0,0.019,0],0.002,0.002,0.044,8);
  sphere(root,materials.turquoise,[0,0.045,0],[0.034,0.013,0.034],12);
  sphere(root,materials.turquoise,[0,0.039,0],[0.027,0.01,0.027],12);
  cylinder(root,materials.dark,[0.003,0.002,0],0.003,0.003,0.014,8,[0,0,Math.PI/2]);
}
function makeKeyboard(root: Group, keys=10) {
  box(root,materials.dark,[0,0.009,0],[0.066,0.012,0.033]);
  for(let i=0;i<keys;i++){
    const x=-0.027+(i%5)*0.0135;
    const z=-0.009+Math.floor(i/5)*0.013;
    box(root,i%4===0?materials.amber:materials.cream,[x,0.017,z],[0.009,0.004,0.007]);
  }
}
function makeTypewriter(root: Group) {
  box(root,materials.terracotta,[0,0.018,0],[0.06,0.022,0.04]);
  box(root,materials.dark,[0,0.031,-0.005],[0.052,0.004,0.025]);
  for(let i=0;i<9;i++) box(root,materials.cream,[-0.021+(i%3)*0.021,0.036,-0.012+Math.floor(i/3)*0.009],[0.012,0.003,0.006]);
  cylinder(root,materials.metal,[0,0.04,-0.026],0.003,0.003,0.052,8,[Math.PI/2,0,0]);
}
function makePaperClip(root: Group) {
  ring(root,materials.metal,[0,0.018,0],0.017,0.002,[Math.PI/2,0,0]);
  ring(root,materials.metal,[0,0.018,0.001],0.011,0.002,[Math.PI/2,0,0]);
}
function makeBottle(root: Group) {
  cylinder(root,materials.turquoise,[0,0.02,0],0.012,0.014,0.03,12);
  sphere(root,materials.turquoise,[0,0.033,0],[0.012,0.01,0.012],12);
  cylinder(root,materials.cream,[0,0.045,0],0.005,0.005,0.012,8);
  cylinder(root,materials.wood,[0,0.052,0],0.005,0.005,0.004,8);
}
function makeSolarPanel(root: Group) {
  box(root,materials.dark,[0,0.014,0],[0.062,0.008,0.044]);
  box(root,materials.blue,[0,0.019,0],[0.056,0.003,0.038]);
  for(let i=0;i<3;i++) box(root,materials.metal,[-0.019+i*0.019,0.021,0],[0.001,0.001,0.038]);
  for(let i=0;i<2;i++) box(root,materials.metal,[0,0.021,-0.009+i*0.018],[0.056,0.001,0.001]);
}
function makePiano(root: Group) {
  box(root,materials.dark,[0,0.02,0],[0.066,0.026,0.036]);
  for(let i=0;i<7;i++) box(root,materials.cream,[-0.027+i*0.009,0.035,0.011],[0.008,0.004,0.015]);
  for(const i of [1,2,4,5]) box(root,materials.dark,[-0.022+i*0.009,0.038,0.003],[0.004,0.004,0.009]);
}
function makeCandle(root: Group) {
  cylinder(root,materials.cream,[0,0.019,0],0.012,0.013,0.036,12);
  cylinder(root,materials.dark,[0,0.041,0],0.001,0.001,0.008,6);
  add(root,new ConeGeometry(0.006,0.016,8),materials.amber,[0,0.054,0]);
}
function makeBattery(root: Group) {
  cylinder(root,materials.green,[0,0.02,0],0.012,0.012,0.04,12);
  cylinder(root,materials.metal,[0,0.042,0],0.004,0.004,0.004,8);
}
function makeUSB(root: Group) {
  box(root,materials.blue,[0,0.018,0],[0.045,0.014,0.02]);
  box(root,materials.metal,[0.027,0.018,0],[0.012,0.01,0.014]);
}
function makeEnvelope(root: Group) {
  box(root,materials.cream,[0,0.016,0],[0.052,0.003,0.036]);
  add(root,new ConeGeometry(0.025,0.02,4),materials.turquoise,[0,0.019,0],[1,0.5,1],[Math.PI,Math.PI/4,0]);
}
function makeKite(root: Group) {
  add(root,new ConeGeometry(0.025,0.055,4),materials.turquoise,[0,0.032,0],[1,1,0.5],[0,0,Math.PI/4]);
  cylinder(root,materials.wood,[0,0.032,0],0.001,0.001,0.06,6);
}
function makeSail(root: Group) {
  cylinder(root,materials.wood,[0,0.031,0],0.002,0.002,0.06,8);
  add(root,new ConeGeometry(0.03,0.054,3),materials.cream,[0.012,0.034,0],[0.7,1,0.15],[0,0,-0.2]);
  box(root,materials.terracotta,[0,0.009,0],[0.055,0.006,0.025]);
}
function makeParachute(root: Group) {
  sphere(root,materials.red,[0,0.048,0],[0.034,0.022,0.034],12);
  for(const x of [-0.018,0.018]) cylinder(root,materials.cream,[x/2,0.026,0],0.0008,0.0008,0.035,5,[0,0,x>0?-0.5:0.5]);
  sphere(root,materials.dark,[0,0.009,0],[0.009,0.008,0.009],8);
}
function makeThermometer(root: Group) {
  cylinder(root,materials.cream,[0,0.027,0],0.006,0.006,0.05,10);
  sphere(root,materials.red,[0,0.006,0],[0.009,0.009,0.009],8);
  cylinder(root,materials.red,[0,0.02,0.001],0.002,0.002,0.025,8);
}
function makeRuler(root: Group) {
  box(root,materials.amber,[0,0.009,0],[0.07,0.006,0.018]);
  for(let i=0;i<7;i++) box(root,materials.dark,[-0.029+i*0.009,0.013,-0.004],[0.001,0.001,0.006]);
}
function makeTelescope(root: Group) {
  cylinder(root,materials.indigo,[0,0.022,0],0.012,0.018,0.047,12,[0,0,Math.PI/2]);
  cylinder(root,materials.metal,[0.026,0.022,0],0.013,0.013,0.009,12,[0,0,Math.PI/2]);
  cylinder(root,materials.turquoise,[-0.025,0.022,0],0.01,0.01,0.01,12,[0,0,Math.PI/2]);
}
function makeNail(root: Group) {
  cylinder(root,materials.metal,[0,0.022,0],0.002,0.002,0.045,8);
  add(root,new ConeGeometry(0.004,0.009,8),materials.metal,[0,0.049,0]);
}
function makeScrew(root: Group) {
  cylinder(root,materials.metal,[0,0.021,0],0.003,0.003,0.04,8);
  cylinder(root,materials.metal,[0,0.043,0],0.007,0.007,0.006,8);
  for(let i=0;i<4;i++) ring(root,materials.metal,[0,0.012+i*0.007,0],0.003,0.001);
}
function makePan(root: Group) {
  cylinder(root,materials.dark,[0,0.01,0],0.022,0.022,0.008,12);
  cylinder(root,materials.metal,[0.034,0.013,0],0.004,0.004,0.06,8,[0,0,-Math.PI/2]);
}
function makeScale(root: Group) {
  box(root,materials.dark,[0,0.01,0],[0.045,0.012,0.038]);
  box(root,materials.cream,[0,0.017,0],[0.025,0.002,0.019]);
  sphere(root,materials.turquoise,[0,0.02,0],[0.006,0.002,0.004],8);
}
function makeMegaphone(root: Group) {
  cylinder(root,materials.cream,[0,0.023,0],0.007,0.018,0.045,12,[0,0,-Math.PI/2]);
  cylinder(root,materials.turquoise,[-0.026,0.023,0],0.007,0.007,0.01,10,[0,0,Math.PI/2]);
}
function makeTrumpet(root: Group) {
  cylinder(root,materials.amber,[-0.006,0.023,0],0.005,0.005,0.035,10,[0,0,Math.PI/2]);
  cylinder(root,materials.amber,[0.018,0.023,0],0.009,0.005,0.022,10,[0,0,Math.PI/2]);
  cylinder(root,materials.amber,[0.03,0.023,0],0.014,0.009,0.004,12,[0,0,Math.PI/2]);
  for(let i=0;i<3;i++) cylinder(root,materials.cream,[-0.005+i*0.009,0.031,0],0.003,0.003,0.008,8);
}
function makeLoudspeaker(root: Group) {
  box(root,materials.dark,[0,0.022,0],[0.035,0.046,0.025]);
  sphere(root,materials.turquoise,[0,0.025,0.014],[0.012,0.014,0.003],12);
  sphere(root,materials.amber,[0,0.025,0.017],[0.004,0.005,0.002],8);
}

function makeBlueprint(root: Group) {
  box(root,materials.blue,[0,0.008,0],[0.06,0.004,0.042]);
  box(root,materials.cream,[0,0.011,0],[0.001,0.001,0.034]);
  box(root,materials.cream,[0,0.011,0],[0.05,0.001,0.001]);
  box(root,materials.cream,[-0.012,0.011,0.008],[0.02,0.001,0.001]);
}
function makeSeed(root: Group) {
  sphere(root,materials.terracotta,[0,0.016,0],[0.013,0.02,0.009],10);
}
function makeWoodBlock(root: Group) {
  box(root,materials.wood,[0,0.018,0],[0.032,0.032,0.032]);
}
function makeKeyring(root: Group) {
  ring(root,materials.metal,[0,0.017,0],0.016,0.002,[Math.PI/2,0,0]);
  makeKey(root);
}
const BUILDERS: Record<TileModel, (root: Group) => void> = {
  seed: makeSeed,
  egg: makeEgg,
  house: makeHouse,
  keyboard: (root) => makeKeyboard(root),
  keyring: makeKeyring,
  key: makeKey,
  padlock: makePadlock,
  umbrella: makeUmbrella,
  piano: makePiano,
  typewriter: makeTypewriter,
  'paper clip': makePaperClip,
  nail: makeNail,
  screw: makeScrew,
  megaphone: makeMegaphone,
  trumpet: makeTrumpet,
  loudspeaker: makeLoudspeaker,
  thermometer: makeThermometer,
  ruler: makeRuler,
  telescope: makeTelescope,
  scale: makeScale,
  blueprint: makeBlueprint,
  kite: makeKite,
  sail: makeSail,
  parachute: makeParachute,
  envelope: makeEnvelope,
  bottle: makeBottle,
  usb: makeUSB,
  'solar panel': makeSolarPanel,
  battery: makeBattery,
  candle: makeCandle,
  'frying pan': makePan,
  'wooden block': makeWoodBlock,
};
/**
 * Normalize props so their longest side is the same, OBJECT_SIZE: the four
 * choices then read at one size on their identical display stands, whether
 * the object is long (a ruler), tall (a thermometer) or round (an egg). The
 * object itself is the visible answer target; the tile mesh is hidden by
 * PuzzleSystem.
 */
export function createPuzzleObject(
  label: string,
  imported?: Object3D,
): Group | undefined {
  const model = tileModelFor(label);
  if (!model) return undefined;
  const root = new Group();
  root.name = 'puzzle-object:' + label;
  if (imported) {
    // An imported model's geometry is shared with the loaded asset, so
    // disposePuzzleObject must leave it alone.
    root.add(imported);
    root.userData.imported = true;
  } else {
    BUILDERS[model](root);
  }

  root.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(root);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  if (size.x > 0 && size.y > 0 && size.z > 0) {
    const scale = OBJECT_SIZE / Math.max(size.x, size.y, size.z);
    root.scale.setScalar(scale);
    root.position.set(
      -center.x * scale,
      0.001 - bounds.min.y * scale,
      -center.z * scale,
    );
  }
  return root;
}
export function disposePuzzleObject(root: Group): void {
  if (root.userData.imported) {
    root.clear();
    return;
  }
  root.traverse((object) => {
    const part = object as Mesh;
    if (part.isMesh) part.geometry.dispose();
  });
  root.clear();
}
