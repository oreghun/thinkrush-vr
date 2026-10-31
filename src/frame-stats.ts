// Frame timing for the performance readout (add ?fps to the page URL): how
// many frames the last second drew, the slowest of them, and how many came
// late. A late frame took over 1.5 times the display's frame interval, so
// the headset showed the previous picture again for it.
//
// No runtime imports, so Node's test runner can use it.

/** The readout covers this much time, then starts over. */
export const FRAME_WINDOW_SECONDS = 1;

/** A frame this many display intervals long or longer was late. */
const LATE_INTERVALS = 1.5;

export interface FrameSummary {
  /** Frames per second over the window, rounded. */
  fps: number;
  /** The slowest frame in the window, in whole milliseconds. */
  worstMs: number;
  /** Frames in the window that came late. */
  late: number;
}

/** Collects frame times; every FRAME_WINDOW_SECONDS it closes a summary. */
export class FrameWindow {
  private frames = 0;
  private elapsed = 0;
  private worst = 0;
  private late = 0;

  /**
   * Adds one frame that took `seconds`, on a display refreshing `targetHz`
   * times a second. Returns true when this frame closed a window: `out` then
   * holds its summary and the next frame starts a new one.
   */
  add(seconds: number, targetHz: number, out: FrameSummary): boolean {
    if (!(seconds > 0)) {
      return false;
    }
    this.frames += 1;
    this.elapsed += seconds;
    this.worst = Math.max(this.worst, seconds);
    if (targetHz > 0 && seconds >= LATE_INTERVALS / targetHz) {
      this.late += 1;
    }
    if (this.elapsed < FRAME_WINDOW_SECONDS) {
      return false;
    }
    out.fps = Math.round(this.frames / this.elapsed);
    out.worstMs = Math.round(this.worst * 1000);
    out.late = this.late;
    this.frames = 0;
    this.elapsed = 0;
    this.worst = 0;
    this.late = 0;
    return true;
  }
}

/**
 * The frame rate to ask the headset for: 72 Hz when it offers it (Quest's
 * own baseline, and the most time per frame), otherwise none (keep the
 * browser's choice).
 */
export function preferredFrameRate(
  supported: ArrayLike<number> | undefined,
): number | null {
  if (!supported) {
    return null;
  }
  for (let i = 0; i < supported.length; i += 1) {
    if (supported[i] === 72) {
      return 72;
    }
  }
  return null;
}
