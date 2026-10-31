import { createSystem, type UIKitMLAsset, VisibilityState } from '@iwsdk/core';
import {
  type FrameSummary,
  FrameWindow,
  preferredFrameRate,
} from './frame-stats.js';
import { fill, t } from './i18n/index.js';

type UIElement = ReturnType<UIKitMLAsset['getElementById']>;

/** On a flat page there is no headset rate; late frames count against this. */
const FLAT_PAGE_HZ = 60;

/**
 * Two jobs for keeping the game smooth on a headset:
 *
 * - When VR starts, asks for 72 frames a second if the headset offers it
 *   (Quest's own baseline), so each frame has the most time to draw. A
 *   headset that picks 90 or 120 by itself would otherwise leave less.
 * - With ?fps in the page URL (for example
 *   https://oreghun.github.io/thinkrush-vr/?fps), shows a line at the foot of
 *   the screen, refreshed every second: frames per second, the display rate,
 *   the slowest frame, late frames (the headset repeated the last picture),
 *   draw calls and triangles. Without ?fps it does nothing each frame.
 */
export class PerformanceSystem extends createSystem({}) {
  private readonly frames = new FrameWindow();
  private readonly summary: FrameSummary = { fps: 0, worstMs: 0, late: 0 };
  private line: UIElement = null;
  private last = 0;

  init(): void {
    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        // A paused or hidden session draws nothing; the gap is not a frame.
        this.last = 0;
        if (state === VisibilityState.Visible) {
          this.askForFrameRate();
        }
      }),
    );
    if (!new URLSearchParams(window.location.search).has('fps')) {
      return;
    }
    const panel = this.world.getSceneObject<UIKitMLAsset>('screen');
    panel?.getElementById('perf-row')?.setProperties({ display: 'flex' });
    this.line = panel?.getElementById('perf-line') ?? null;
  }

  update(): void {
    if (!this.line) {
      return;
    }
    const now = performance.now();
    const seconds = this.last > 0 ? (now - this.last) / 1000 : 0;
    this.last = now;
    const session = this.renderer.xr.getSession();
    const hz = session?.frameRate ?? 0;
    if (!this.frames.add(seconds, hz || FLAT_PAGE_HZ, this.summary)) {
      return;
    }
    // Counted over the last frame drawn. Without multiview (the desktop
    // emulator) each eye is drawn separately and counts double.
    const render = this.renderer.info.render;
    this.line.setProperties({
      text: fill(t('perf.line'), {
        fps: this.summary.fps,
        hz: hz > 0 ? Math.round(hz) : '-',
        worst: this.summary.worstMs,
        late: this.summary.late,
        calls: render.calls,
        triangles: Math.round(render.triangles / 1000),
      }),
    });
  }

  private askForFrameRate(): void {
    const session = this.renderer.xr.getSession();
    if (!session || typeof session.updateTargetFrameRate !== 'function') {
      return;
    }
    const rate = preferredFrameRate(session.supportedFrameRates);
    if (rate !== null && session.frameRate !== rate) {
      // A refusal just keeps the browser's own rate.
      session.updateTargetFrameRate(rate).catch(() => undefined);
    }
  }
}
