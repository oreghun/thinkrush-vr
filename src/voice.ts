/**
 * Speech recognition that runs on the device only. Browsers' default Web
 * Speech recognition sends audio to an online service, which the game must
 * not use, so nothing here starts unless the browser supports on-device
 * processing (`processLocally`) and has the language installed.
 */

// TypeScript's DOM types don't include the Web Speech recognition API yet;
// these cover the parts used here.
type Availability =
  | 'unavailable'
  | 'downloadable'
  | 'downloading'
  | 'available';

interface OnDeviceOptions {
  langs: string[];
  processLocally: boolean;
}

interface RecognitionResultEvent extends Event {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface RecognitionErrorEvent extends Event {
  error: string;
}

interface Recognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  processLocally: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}

interface RecognitionConstructor {
  new (): Recognition;
  prototype: Recognition;
  available?(options: OnDeviceOptions): Promise<Availability>;
  install?(options: OnDeviceOptions): Promise<boolean>;
}

/**
 * unsupported: no speech recognition at all. cloudOnly: recognition exists
 * but only through an online service. Otherwise the on-device status.
 */
export type VoiceSupport = 'unsupported' | 'cloudOnly' | Availability;

export interface VoiceHandlers {
  /** The recognizer's alternatives for what was said, most likely first. */
  onHeard(alternatives: string[]): void;
  /** A Web Speech error code, such as "no-speech" or "not-allowed". */
  onError(code: string): void;
  onEnd(): void;
}

function recognitionConstructor(): RecognitionConstructor | undefined {
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
}

function hasOnDeviceMode(
  Recognition: RecognitionConstructor | undefined,
): Recognition is RecognitionConstructor {
  return (
    Recognition !== undefined &&
    typeof Recognition.available === 'function' &&
    'processLocally' in Recognition.prototype
  );
}

/** Whether `lang` (e.g. "en-US") can be recognized on this device. */
export async function onDeviceSupport(lang: string): Promise<VoiceSupport> {
  const Recognition = recognitionConstructor();
  if (!Recognition) {
    return 'unsupported';
  }
  if (!hasOnDeviceMode(Recognition)) {
    return 'cloudOnly';
  }
  try {
    return await Recognition.available!({
      langs: [lang],
      processLocally: true,
    });
  } catch {
    return 'unavailable';
  }
}

/** Asks the browser to download `lang` for on-device recognition. */
export async function installOnDevice(lang: string): Promise<boolean> {
  const Recognition = recognitionConstructor();
  if (!hasOnDeviceMode(Recognition) || !Recognition.install) {
    return false;
  }
  try {
    return await Recognition.install({ langs: [lang], processLocally: true });
  } catch {
    return false;
  }
}

/**
 * Listens for one phrase in `lang`, on the device only. Returns a function
 * that stops listening, or undefined when on-device recognition is missing,
 * in which case nothing was started. Check onDeviceSupport first.
 */
export function listenOnDevice(
  lang: string,
  handlers: VoiceHandlers,
): (() => void) | undefined {
  const Recognition = recognitionConstructor();
  if (!hasOnDeviceMode(Recognition)) {
    return undefined;
  }
  const recognition = new Recognition();
  recognition.processLocally = true;
  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 5;
  recognition.onresult = (event) => {
    handlers.onHeard(
      Array.from(
        event.results[0] ?? [],
        (alternative) => alternative.transcript,
      ),
    );
  };
  recognition.onerror = (event) => handlers.onError(event.error);
  recognition.onend = () => handlers.onEnd();
  recognition.start();
  return () => recognition.abort();
}
