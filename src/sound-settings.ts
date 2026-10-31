// Whether the game makes sound (music, RUSH's voice and the chime). Read
// aloud has its own setting. Saved in the browser like the other choices.

const STORAGE_KEY = 'thinkrush.sound';
const listeners = new Set<(on: boolean) => void>();
let on = load();

function load(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function isSoundOn(): boolean {
  return on;
}

export function setSoundOn(next: boolean): void {
  on = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
  } catch {
    // Storage can be blocked (private mode); the choice then lasts this visit.
  }
  for (const listener of listeners) {
    listener(next);
  }
}

/** Calls `listener` when sound is switched; returns an unsubscribe function. */
export function onSoundChange(listener: (on: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
