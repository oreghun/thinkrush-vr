import { createComponent, Types } from '@iwsdk/core';
import { ScreenStop } from './screen-stops.js';

/**
 * Marks the light bar under the screen. In VR, pinching the bar (or
 * holding the trigger on it) and pulling toward you brings the screen
 * within reach; pushing sends it back; a quick pinch switches. `stop` is
 * where it rests (see src/screen-stops.ts); a new puzzle sets it to far.
 * On a flat page the mouse drags the bar to place the screen freely.
 * Declared in its own system-free module so the editor catalog loads it.
 */
export const MovablePanel = createComponent('MovablePanel', {
  stop: { type: Types.Enum, enum: ScreenStop, default: ScreenStop.Far },
});
