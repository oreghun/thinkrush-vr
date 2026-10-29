/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createSystem, UIKitMLAsset, VisibilityState } from '@iwsdk/core';
import {
  nextLanguage,
  onLanguageChange,
  setLanguage,
  t,
} from './i18n/index.js';

export class PanelSystem extends createSystem({}) {
  init(): void {
    const panel = this.world.getSceneObject<UIKitMLAsset>('welcome-panel');
    if (panel == null) {
      return;
    }
    this.initLanguageButton(panel);
    this.initXRButtons(panel);
  }

  private initLanguageButton(panel: UIKitMLAsset): void {
    const button = panel.getElementById('language-button');
    const label = panel.getElementById('language-label');
    if (button == null || label == null) {
      return;
    }
    // The button names the language a press switches to.
    const updateLabel = () =>
      label.setProperties({ text: t(`language.${nextLanguage()}`) });
    const toggle = () => setLanguage(nextLanguage());
    updateLabel();
    button.addEventListener('click', toggle);
    this.cleanupFuncs.push(
      () => button.removeEventListener('click', toggle),
      onLanguageChange(updateLabel),
    );
  }

  private initXRButtons(panel: UIKitMLAsset): void {
    const xrButton = panel.getElementById('xr-button');
    const exitButton = panel.getElementById('exit-button');
    if (xrButton == null || exitButton == null) {
      return;
    }
    if (!this.world.xrEnabled) {
      xrButton.setProperties({ display: 'none' });
      exitButton.setProperties({ display: 'none' });
      return;
    }

    const launchXR = () => this.world.launchXR();
    const exitXR = () => this.world.exitXR();
    xrButton.addEventListener('click', launchXR);
    exitButton.addEventListener('click', exitXR);
    this.cleanupFuncs.push(
      () => xrButton.removeEventListener('click', launchXR),
      () => exitButton.removeEventListener('click', exitXR),
      this.world.visibilityState.subscribe((visibilityState) => {
        const is2D = visibilityState === VisibilityState.NonImmersive;
        xrButton.setProperties({ display: is2D ? 'flex' : 'none' });
        exitButton.setProperties({ display: is2D ? 'none' : 'flex' });
      }),
    );
  }
}
