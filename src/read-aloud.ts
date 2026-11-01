// Reads puzzle text aloud with the browser's speech synthesis, using only
// voices that run on the device: an online voice would send the text to a
// server, which the competition rules rule out. Players never answer by
// voice; they listen, then choose a tile or an orb.
//
// No runtime imports, so Node's test runner can load the pure helpers.

/** The parts of a voice that decide whether, and which, we use. */
export type VoiceInfo = Pick<
  SpeechSynthesisVoice,
  'lang' | 'localService' | 'default' | 'name'
>;

// RUSH is a girl: voices carry no gender, but many name it ("Female") or
// go by a woman's name. A best guess; any voice for the language will do.
const WOMEN_NAMES = [
  'samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona', 'serena',
  'susan', 'zira', 'hazel', 'jenny', 'aria', 'allison', 'ava', 'kate',
  'catherine', 'joanna', 'salli', 'kimberly', 'ivy', 'emma', 'amy',
  'libby', 'sonia', 'natasha', 'linda',
];
// Whole words only: "Bavarian" holds "aria" but is no one's name.
const FEMALE_VOICE = new RegExp(
  `\\b(female|woman|girl|${WOMEN_NAMES.join('|')})\\b`,
  'iu',
);

/** Whether a voice's name suggests a woman's voice. */
export function soundsFemale(voice: Pick<VoiceInfo, 'name'>): boolean {
  return FEMALE_VOICE.test(voice.name ?? '');
}

/**
 * The index of the on-device voice for `language` ("en", "sw"), or -1 when
 * there is none. Among the matches a woman's voice wins (RUSH's), then the
 * device's default voice.
 */
export function pickVoice(
  voices: readonly VoiceInfo[],
  language: string,
): number {
  const rank = (voice: VoiceInfo) =>
    (soundsFemale(voice) ? 2 : 0) + (voice.default ? 1 : 0);
  let best = -1;
  voices.forEach((voice, index) => {
    const base = voice.lang.toLowerCase().split(/[-_]/u)[0];
    if (!voice.localService || base !== language) {
      return;
    }
    if (best === -1 || rank(voice) > rank(voices[best])) {
      best = index;
    }
  });
  return best;
}

/**
 * RUSH's voice is pitched up a little, for a lively cartoon sound (1 is the
 * voice's own pitch; browsers allow 0 to 2).
 */
export const RUSH_PITCH = 1.3;

/**
 * Splits text into sentences, each read as its own utterance: some browsers
 * cut a long utterance off part-way, and a mafumbo story is long.
 */
export function sentences(text: string): string[] {
  return (text.match(/[^.!?]+(?:[.!?]+["')]*|$)/gu) ?? [])
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/**
 * Text as it should sound: a fill-in gap ("____", as in "Practice makes
 * ____.") is said as `word` ("blank"). Read as written, voices spell the
 * symbols out ("underscore underscore underscore underscore"). The screen
 * keeps the gap as drawn.
 */
export function speakableBlanks(text: string, word: string): string {
  return text.replace(/_+/gu, word);
}

/** The read-aloud setting: off, or the pace the puzzles are read at. */
export const READ_ALOUD_SPEEDS = ['off', 'slow', 'normal', 'fast'] as const;
export type ReadAloudSpeed = (typeof READ_ALOUD_SPEEDS)[number];

// Speech rate per pace: 1 is the voice's own speed. Slow helps a player
// who is still learning English; fast suits a quick run.
const RATES: Record<Exclude<ReadAloudSpeed, 'off'>, number> = {
  slow: 0.8,
  normal: 1,
  fast: 1.25,
};

/** The setting after `speed` on the home page's single button. */
export function nextReadAloudSpeed(speed: ReadAloudSpeed): ReadAloudSpeed {
  return READ_ALOUD_SPEEDS[
    (READ_ALOUD_SPEEDS.indexOf(speed) + 1) % READ_ALOUD_SPEEDS.length
  ];
}

const STORAGE_KEY = 'thinkrush.readAloud';

let speed = loadSpeed();
let pending: { text: string; language: string } | undefined;
// Utterances of the latest speak() not yet finished. Each speak() starts a
// new generation: cancelling the old one reports its utterances ended, late,
// and those reports must not count against the new one.
let utterancesLeft = 0;
let generation = 0;

function synth(): SpeechSynthesis | undefined {
  return typeof speechSynthesis === 'undefined' ? undefined : speechSynthesis;
}

function loadSpeed(): ReadAloudSpeed {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (READ_ALOUD_SPEEDS.includes(saved as ReadAloudSpeed)) {
      return saved as ReadAloudSpeed;
    }
  } catch {
    // Fall through to the default.
  }
  return 'normal';
}

export function readAloudSpeed(): ReadAloudSpeed {
  return speed;
}

/** Whether each new puzzle is read out on its own. On unless turned off. */
export function isReadAloudOn(): boolean {
  return speed !== 'off';
}

export function setReadAloudSpeed(next: ReadAloudSpeed): void {
  speed = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage can be blocked (private mode); the choice then lasts this visit.
  }
  if (next === 'off') {
    stopSpeaking();
  }
}

function voiceFor(language: string): SpeechSynthesisVoice | undefined {
  const voices = synth()?.getVoices() ?? [];
  return voices[pickVoice(voices, language)];
}

/** Whether this device has an on-device voice for `language`. */
export function hasVoice(language: string): boolean {
  return voiceFor(language) !== undefined;
}

/**
 * Reads `text` in `language`, replacing anything still being read. Returns
 * false when there is no on-device voice for it, so nothing is said. On a
 * fresh page the voice list can still be loading: the text is then read as
 * soon as the voices arrive, if one of them fits.
 */
export function speak(text: string, language: string): boolean {
  const speech = synth();
  if (speech === undefined) {
    return false;
  }
  speech.cancel();
  pending = undefined;
  generation += 1;
  utterancesLeft = 0;
  if (speech.getVoices().length === 0) {
    pending = { text, language };
    speech.addEventListener('voiceschanged', speakPending, { once: true });
    return false;
  }
  const voice = voiceFor(language);
  if (voice === undefined) {
    return false;
  }
  const mine = generation;
  const finished = () => {
    if (mine === generation) utterancesLeft = Math.max(0, utterancesLeft - 1);
  };
  for (const sentence of sentences(text)) {
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    // "Read it out" still works with automatic reading off, at normal pace.
    utterance.rate = RATES[speed === 'off' ? 'normal' : speed];
    utterance.pitch = RUSH_PITCH;
    utterance.onend = finished;
    utterance.onerror = finished;
    utterancesLeft += 1;
    speech.speak(utterance);
  }
  return true;
}

/**
 * Whether the latest speak() is still being read (or waiting to be): the
 * game waits for RUSH to finish before the choices and the clock. It counts
 * the utterances' own end events, which a paused voice holds back.
 */
export function speechPending(): boolean {
  return utterancesLeft > 0;
}

function speakPending(): void {
  if (pending !== undefined) {
    speak(pending.text, pending.language);
  }
}

/** Whether something is being read out right now (RUSH glows as it talks). */
export function isSpeaking(): boolean {
  return synth()?.speaking ?? false;
}

export function stopSpeaking(): void {
  pending = undefined;
  generation += 1;
  utterancesLeft = 0;
  synth()?.cancel();
}

/** Holds speech while the headset is off or a system menu is up. */
export function pauseSpeaking(paused: boolean): void {
  const speech = synth();
  if (paused) {
    speech?.pause();
  } else {
    speech?.resume();
  }
}

/**
 * Calls `listener` whenever the device's voice list changes (it loads
 * after the page on some browsers); returns an unsubscribe function.
 */
export function onVoicesChanged(listener: () => void): () => void {
  const speech = synth();
  if (speech === undefined) {
    return () => {};
  }
  speech.addEventListener('voiceschanged', listener);
  return () => speech.removeEventListener('voiceschanged', listener);
}
