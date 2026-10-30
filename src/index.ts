/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { onLanguageChange, t } from './i18n/index.js';
import { installCodeInputVisuals } from './input-visuals.js';
import { MovablePanelSystem } from './movable-panel.js';
import { PanelSystem } from './panel.js';
import { UITextSystem } from './ui-text.js';
import { PuzzleSystem } from './puzzle.js';
import { ScreenLookSystem } from './screen-look.js';

const updateTitle = () => {
  document.title = t('app.title');
};
updateTitle();
onLanguageChange(updateTitle);

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  installCodeInputVisuals(world);
  world.registerSystem(UITextSystem);
  world.registerSystem(PanelSystem);
  world.registerSystem(MovablePanelSystem);
  world.registerSystem(ScreenLookSystem);
  world.registerSystem(PuzzleSystem);
});
