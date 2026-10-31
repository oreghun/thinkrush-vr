import en from './en.json';
import sw from './sw.json';

/** English is primary; Swahili is the second language. */
export const LANGUAGES = ['en', 'sw'] as const;
export type Language = (typeof LANGUAGES)[number];
export type MessageKey = keyof typeof en;

// Typing sw against the English keys makes `npm run typecheck` fail when a
// key is missing from sw.json. An empty sw value means "not written yet".
const MESSAGES: Record<Language, Record<MessageKey, string>> = { en, sw };
export const MESSAGE_KEYS = Object.keys(en) as MessageKey[];

const STORAGE_KEY = 'thinkrush.language';
const listeners = new Set<(language: Language) => void>();
let current: Language = initialLanguage();
document.documentElement.lang = current;

/** Interface text for `key` in the current language, or English if it is not written yet. */
export function t(key: MessageKey): string {
  return MESSAGES[current][key] || MESSAGES.en[key];
}

/** Puts values into a message's {name} slots. */
export function fill(
  text: string,
  values: Record<string, number | string>,
): string {
  return text.replace(/\{(\w+)\}/gu, (slot, name: string) =>
    name in values ? String(values[name]) : slot,
  );
}

export function getLanguage(): Language {
  return current;
}

export function setLanguage(language: Language): void {
  if (language === current) {
    return;
  }
  current = language;
  document.documentElement.lang = language;
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Storage can be blocked (private mode); the choice then lasts this visit.
  }
  listeners.forEach((listener) => listener(language));
}

/** The language after the current one, for a single toggle button. */
export function nextLanguage(): Language {
  return LANGUAGES[(LANGUAGES.indexOf(current) + 1) % LANGUAGES.length];
}

/** Calls `listener` after every language change; returns an unsubscribe function. */
export function onLanguageChange(
  listener: (language: Language) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isLanguage(value: unknown): value is Language {
  return LANGUAGES.includes(value as Language);
}

/** A saved choice wins; otherwise the first supported browser language; otherwise English. */
function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLanguage(saved)) {
      return saved;
    }
  } catch {
    // Fall through to the browser languages.
  }
  for (const tag of navigator.languages ?? []) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLanguage(base)) {
      return base;
    }
  }
  return 'en';
}
