import { createSystem, Euler, Hovered, VisibilityState } from '@iwsdk/core';

// Radians of rotation per pixel of drag, and how far the view may tilt.
const SENSITIVITY = 0.004;
const PITCH_LIMIT = 1.2;

/**
 * Drag-to-look for the flat page: dragging the canvas with a mouse or a
 * finger turns the camera from the fixed seat, phone-viewer style. It only
 * ever runs outside an immersive session; in VR the headset is the camera.
 */
export class ScreenLookSystem extends createSystem({
  hovered: { required: [Hovered] },
}) {
  private readonly euler = new Euler(0, 0, 0, 'YXZ');
  private pointerId?: number;
  private lastX = 0;
  private lastY = 0;

  init(): void {
    const canvas = this.world.renderer.domElement;
    // Without this, a phone treats the drag as a page gesture.
    canvas.style.touchAction = 'none';

    const down = (event: PointerEvent) => {
      if (
        this.pointerId !== undefined ||
        this.world.visibilityState.peek() !== VisibilityState.NonImmersive ||
        // Only empty space turns the view; a press that starts on a button,
        // orb or tile belongs to that thing alone.
        this.queries.hovered.entities.size > 0
      ) {
        return;
      }
      this.pointerId = event.pointerId;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      // Start from wherever the camera is pointing now.
      this.euler.setFromQuaternion(this.world.camera.quaternion, 'YXZ');
      this.euler.z = 0;
    };
    const move = (event: PointerEvent) => {
      if (
        event.pointerId !== this.pointerId ||
        this.world.visibilityState.peek() !== VisibilityState.NonImmersive
      ) {
        return;
      }
      this.euler.y -= (event.clientX - this.lastX) * SENSITIVITY;
      this.euler.x -= (event.clientY - this.lastY) * SENSITIVITY;
      this.euler.x = Math.min(
        Math.max(this.euler.x, -PITCH_LIMIT),
        PITCH_LIMIT,
      );
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.world.camera.quaternion.setFromEuler(this.euler);
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId === this.pointerId) {
        this.pointerId = undefined;
      }
    };

    canvas.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    this.cleanupFuncs.push(() => {
      canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    });
  }
}
