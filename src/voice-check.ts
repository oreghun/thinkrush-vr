import { createSystem, type UIKitMLAsset } from '@iwsdk/core';
import { findSpokenMatch } from './answer-match.js';
import { type MessageKey, onLanguageChange, t } from './i18n/index.js';
import { type Puzzle, PUZZLES } from './puzzles.js';
import {
  installOnDevice,
  listenOnDevice,
  onDeviceSupport,
  type VoiceSupport,
} from './voice.js';

// Recognizer languages for the game's two languages.
const SPEECH_LANGS = { en: 'en-US', sw: 'sw-KE' } as const;
// While a download runs, check again this often, in seconds.
const RECHECK_SECONDS = 3;

const COLORS = {
  neutral: '#dddfe3',
  listening: '#f5d90a',
  correct: '#7bd88f',
  wrong: '#f5b14a',
  error: '#ff8a7a',
};

type Support = VoiceSupport | 'notChecked' | 'checking';
type Attempt =
  | { kind: 'idle' }
  | { kind: 'listening' }
  | { kind: 'heard'; heard: string; correct: boolean }
  | { kind: 'error'; code: string };
type UIElement = ReturnType<UIKitMLAsset['getElementById']>;

const ERROR_MESSAGES: Record<string, MessageKey> = {
  'no-speech': 'voice.noSpeech',
  'not-allowed': 'voice.micDenied',
  'service-not-allowed': 'voice.micDenied',
  'audio-capture': 'voice.noMic',
};

/**
 * Week 1 voice check: reports whether this device can recognize English and
 * Swahili without an online service, and lets the player answer the first
 * voice riddle out loud. Voice moves into the riddles themselves later.
 *
 * Nothing speech-related runs until the player presses Check: one headless
 * Chromium build crashes the page when asked about on-device speech, and a
 * browser that did that on load would take the puzzle down with it.
 */
export class VoiceCheckSystem extends createSystem({}) {
  private riddle?: Puzzle;
  private support: Record<keyof typeof SPEECH_LANGS, Support> = {
    en: 'notChecked',
    sw: 'notChecked',
  };
  private attempt: Attempt = { kind: 'idle' };
  private stopListening?: () => void;
  private recheckIn = 0;
  private elements: Record<
    'en' | 'sw' | 'riddle' | 'result' | 'check' | 'listen' | 'download',
    UIElement
  > = {
    en: null,
    sw: null,
    riddle: null,
    result: null,
    check: null,
    listen: null,
    download: null,
  };

  init(): void {
    this.riddle = PUZZLES.find(
      (puzzle) => puzzle.lang === 'en' && puzzle.answer_mode === 'voice+orbs',
    );
    const panel = this.world.getSceneObject<UIKitMLAsset>('voice-check-panel');
    if (!panel || !this.riddle) {
      return;
    }
    this.elements = {
      en: panel.getElementById('voice-support-en'),
      sw: panel.getElementById('voice-support-sw'),
      riddle: panel.getElementById('voice-riddle'),
      result: panel.getElementById('voice-result'),
      check: panel.getElementById('voice-check'),
      listen: panel.getElementById('voice-listen'),
      download: panel.getElementById('voice-download'),
    };
    const check = () => void this.checkSupport();
    const listen = () => this.listen();
    const download = () => void this.download();
    this.elements.check?.addEventListener('click', check);
    this.elements.listen?.addEventListener('click', listen);
    this.elements.download?.addEventListener('click', download);
    this.cleanupFuncs.push(
      () => this.elements.check?.removeEventListener('click', check),
      () => this.elements.listen?.removeEventListener('click', listen),
      () => this.elements.download?.removeEventListener('click', download),
      () => this.stopListening?.(),
      onLanguageChange(() => this.render()),
    );
    this.render();
  }

  update(delta: number): void {
    if (this.support.en !== 'downloading') {
      return;
    }
    this.recheckIn -= delta;
    if (this.recheckIn <= 0) {
      this.recheckIn = RECHECK_SECONDS;
      void this.checkSupport();
    }
  }

  private async checkSupport(): Promise<void> {
    if (this.support.en === 'notChecked') {
      this.support = { en: 'checking', sw: 'checking' };
      this.render();
    }
    const [en, sw] = await Promise.all([
      onDeviceSupport(SPEECH_LANGS.en),
      onDeviceSupport(SPEECH_LANGS.sw),
    ]);
    this.support = { en, sw };
    this.render();
  }

  private async download(): Promise<void> {
    this.support.en = 'downloading';
    this.recheckIn = RECHECK_SECONDS;
    this.render();
    await installOnDevice(SPEECH_LANGS.en);
    await this.checkSupport();
  }

  private listen(): void {
    const riddle = this.riddle;
    if (!riddle || this.support.en !== 'available' || this.stopListening) {
      return;
    }
    this.attempt = { kind: 'listening' };
    this.stopListening = listenOnDevice(SPEECH_LANGS.en, {
      onHeard: (alternatives) => {
        const match = findSpokenMatch(
          alternatives,
          riddle.answer,
          riddle.accepted,
        );
        this.attempt = {
          kind: 'heard',
          heard: match ?? alternatives[0] ?? '',
          correct: match !== undefined,
        };
        this.render();
      },
      onError: (code) => {
        this.attempt = { kind: 'error', code };
        this.render();
      },
      onEnd: () => {
        this.stopListening = undefined;
        if (this.attempt.kind === 'listening') {
          this.attempt = { kind: 'error', code: 'no-speech' };
        }
        this.render();
      },
    });
    if (!this.stopListening) {
      this.attempt = { kind: 'error', code: 'unavailable' };
    }
    this.render();
  }

  /** Writes every panel text for the current state and language. */
  private render(): void {
    const riddle = this.riddle;
    if (!riddle) {
      return;
    }
    const { en, sw } = this.support;
    this.elements.en?.setProperties({
      text: `${t('language.en')}: ${t(`voice.status.${en}`)}`,
    });
    this.elements.sw?.setProperties({
      text: `${t('language.sw')}: ${t(`voice.status.${sw}`)}`,
    });
    this.elements.riddle?.setProperties({ text: riddle.prompt });

    let result = en === 'available' ? t('voice.prompt') : ' ';
    let color = COLORS.neutral;
    const attempt = this.attempt;
    if (attempt.kind === 'listening') {
      result = t('voice.listening');
      color = COLORS.listening;
    } else if (attempt.kind === 'heard') {
      const verdict = attempt.correct ? t('voice.correct') : t('voice.noMatch');
      // Recognizers often end with a full stop; don't double it.
      const heard = attempt.heard.replace(/[.!?]+$/u, '');
      result = `${t('voice.heard')} "${heard}". ${verdict}`;
      color = attempt.correct ? COLORS.correct : COLORS.wrong;
    } else if (attempt.kind === 'error') {
      const key = ERROR_MESSAGES[attempt.code];
      result = key ? t(key) : `${t('voice.error')} ${attempt.code}`;
      color = COLORS.error;
    }
    this.elements.result?.setProperties({ text: result, color });
    this.elements.check?.setProperties({
      display: en === 'notChecked' ? 'flex' : 'none',
    });
    this.elements.listen?.setProperties({
      display: en === 'available' ? 'flex' : 'none',
    });
    this.elements.download?.setProperties({
      display: en === 'downloadable' ? 'flex' : 'none',
    });
  }
}
