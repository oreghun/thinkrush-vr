import { createComponent, Types } from '@iwsdk/core';

/**
 * Marks the RUSH companion; RushSystem animates it from the puzzle board.
 * `embodied` is set once her body has loaded (RushBodySystem): the body
 * then walks and moves her with her own head and face, and RushSystem
 * leaves the floating RUSH's parts hidden.
 */
export const Rush = createComponent('Rush', {
  embodied: { type: Types.Boolean, default: false },
  // The body's current move (a CLIP key) and what she is doing (walking,
  // sitting...), for debugging and checks; written only when they change.
  move: { type: Types.String, default: '' },
  activity: { type: Types.String, default: '' },
});
