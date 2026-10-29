import { createSystem, type UIKitMLAsset } from '@iwsdk/core';
import { MESSAGE_KEYS, onLanguageChange, t } from './i18n/index.js';

/**
 * Fills every UIKitML element whose id is a message key from
 * src/i18n/en.json with that message in the current language, and refills it
 * when the language changes. In the markup, give such an element the
 * placeholder text "...": UIKitML only creates a text node for non-empty text.
 */
export class UITextSystem extends createSystem({}) {
  init(): void {
    this.applyText();
    this.cleanupFuncs.push(onLanguageChange(() => this.applyText()));
  }

  private applyText(): void {
    this.world.scene.traverse((object) => {
      const asset = object as UIKitMLAsset;
      if (!asset.isUIKitMLAsset) {
        return;
      }
      for (const key of MESSAGE_KEYS) {
        asset.getElementById(key)?.setProperties({ text: t(key) });
      }
    });
  }
}
