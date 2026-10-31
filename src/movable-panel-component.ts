import { createComponent, Types } from '@iwsdk/core';
import { ScreenStop } from './screen-stops.js';

/**
 * Marks the screen's mount: an invisible anchor above the table that the
 * screen hangs from (scene node "screen-handle"). In VR the screen's
 * Closer / Push back button moves it between its stops; `stop` is where it
 * rests (see src/screen-stops.ts); a new puzzle sets it to far. The mount
 * has no grab of its own any more (the light bar under the screen was
 * removed); MovablePanelSystem would still settle a grabbable mount on
 * release. Declared in its own system-free module so the editor catalog
 * loads it.
 */
export const MovablePanel = createComponent('MovablePanel', {
  stop: { type: Types.Enum, enum: ScreenStop, default: ScreenStop.Far },
});
