// The room's set dressing: owner-made models (art/SOURCES.md) optimized to
// real metres with scripts/optimize-model.mjs --height, origin at the
// centre of their base, so the scene stands them on the floor at scale 1.
// They sit in the two back corners, 5 m away, so their textures are 512 px.
//
// No runtime imports, so Node's test runner can check every piece has its
// file and its source record.

export const ROOM_PIECES = [
  'clay-pot',
  'basket',
  'snake-plant',
  'cabinet',
  'stool',
  'low-table',
] as const;

export type RoomPiece = (typeof ROOM_PIECES)[number];

/** The manifest id a piece is placed by in the scene. */
export function roomAssetId(piece: RoomPiece): string {
  return `room-${piece}`;
}

/** The optimized model, relative to public/. */
export function roomFile(piece: RoomPiece): string {
  return `models/room/${piece}.glb`;
}
