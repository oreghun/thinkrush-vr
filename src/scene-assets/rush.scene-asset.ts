import {
  AdditiveBlending,
  BackSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from '@iwsdk/core';

/**
 * RUSH, the companion: a glowing sphere with two expressive eyes.
 *
 * Origin: the sphere's centre; +Z is the face (RushSystem turns it to the
 * player). Radius RUSH_RADIUS, plus a soft halo a little wider. Named parts
 * for RushSystem: Rush/Body, Rush/Halo, Rush/EyeL and Rush/EyeR, each eye
 * holding Open (the oval it squashes and scales), Shine (a highlight) and
 * Happy (an arc shown instead of Open when RUSH is pleased).
 */
export const RUSH_RADIUS = 0.09;

// A deep gold: a paler one washes out to white once it glows.
const GOLD = '#FFB020';
const bodyMaterial = new MeshStandardMaterial({
  color: GOLD,
  emissive: GOLD,
  emissiveIntensity: 0.55,
  roughness: 0.4,
});
const haloMaterial = new MeshBasicMaterial({
  color: GOLD,
  transparent: true,
  opacity: 0.22,
  side: BackSide,
  depthWrite: false,
  blending: AdditiveBlending,
});
const eyeMaterial = new MeshStandardMaterial({
  color: '#1D1F2B',
  roughness: 0.3,
});
const shineMaterial = new MeshBasicMaterial({ color: '#FFFFFF' });

const bodyGeometry = new SphereGeometry(RUSH_RADIUS, 32, 24);
const haloGeometry = new SphereGeometry(RUSH_RADIUS * 1.22, 24, 16);
const ovalGeometry = new SphereGeometry(1, 16, 12);
const arcGeometry = new TorusGeometry(0.0135, 0.0034, 6, 14, Math.PI);

// Eye centres on the face, as directions from the sphere's centre.
const EYE_X = 0.33;
const EYE_Y = 0.17;
const FORWARD = new Vector3(0, 0, 1);
// The open eye's oval, which RushSystem squashes and stretches per mood.
export const EYE_WIDTH = 0.0135;
export const EYE_HEIGHT = 0.02;
export const EYE_DEPTH = 0.005;

function createEye(side: 'L' | 'R'): Group {
  const eye = new Group();
  eye.name = `Rush/Eye${side}`;
  const direction = new Vector3(
    side === 'L' ? -EYE_X : EYE_X,
    EYE_Y,
    1,
  ).normalize();
  // Sit on the surface, facing outward, so the eye reads as part of the face.
  eye.position.copy(direction).multiplyScalar(RUSH_RADIUS * 0.985);
  eye.quaternion.setFromUnitVectors(FORWARD, direction);

  const open = new Mesh(ovalGeometry, eyeMaterial);
  open.name = 'Open';
  open.scale.set(EYE_WIDTH, EYE_HEIGHT, EYE_DEPTH);
  const shine = new Mesh(ovalGeometry, shineMaterial);
  shine.name = 'Shine';
  shine.scale.set(0.0041, 0.0041, 0.0019);
  shine.position.set(0.0045, 0.007, 0.0038);
  open.add(shine);
  // Shine is a child of Open: scaling Open by its own size would warp it,
  // so undo that scale for the highlight.
  shine.scale.divide(open.scale);
  shine.position.divide(open.scale);

  const happy = new Mesh(arcGeometry, eyeMaterial);
  happy.name = 'Happy';
  happy.visible = false;
  eye.add(open, happy);
  return eye;
}

export function createRush(): Group {
  const rush = new Group();
  rush.name = 'Rush';
  const body = new Mesh(bodyGeometry, bodyMaterial);
  body.name = 'Rush/Body';
  const halo = new Mesh(haloGeometry, haloMaterial);
  halo.name = 'Rush/Halo';
  halo.userData.iwsdkPreviewBounds = 'exclude';
  rush.add(body, halo, createEye('L'), createEye('R'));
  return rush;
}
