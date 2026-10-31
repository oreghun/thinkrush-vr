import { createSystem, VisibilityState } from '@iwsdk/core';
import { framingFor } from './flat-framing.js';

/**
 * Frames the flat page (outside VR) for the window's shape: a desktop
 * window keeps the view from iwsdk.config.json, a phone held upright steps
 * the camera back so the screen and the choices stay in view (see
 * src/flat-framing.ts). It runs at start, after every resize or rotation
 * and when VR ends; never during VR, where the headset is the camera.
 * Drag-to-look (ScreenLookSystem) turns the camera from wherever this left it.
 */
export class FlatViewSystem extends createSystem({}) {
  private pending = true;

  init(): void {
    const onResize = () => {
      this.pending = true;
    };
    window.addEventListener('resize', onResize);
    this.cleanupFuncs.push(
      () => window.removeEventListener('resize', onResize),
      this.world.visibilityState.subscribe((state) => {
        if (state === VisibilityState.NonImmersive) {
          this.pending = true;
        }
      }),
    );
  }

  update(): void {
    if (
      !this.pending ||
      this.world.visibilityState.peek() !== VisibilityState.NonImmersive
    ) {
      return;
    }
    // Applied in a frame, after the SDK's own resize and end-of-session work.
    this.pending = false;
    const camera = this.world.camera;
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const { position, target, fov } = framingFor(aspect);
    camera.position.set(position[0], position[1], position[2]);
    camera.lookAt(target[0], target[1], target[2]);
    camera.fov = fov;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }
}
