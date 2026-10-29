import { createComponent } from '@iwsdk/core';

/**
 * Marks the grab bar under a floating panel. Pointing at the bar and
 * pinching (or holding the trigger) moves the whole panel, so seated
 * players can arrange the panels to suit their chair and reach.
 * Declared in its own system-free module so the editor catalog loads it.
 */
export const MovablePanel = createComponent('MovablePanel', {});
