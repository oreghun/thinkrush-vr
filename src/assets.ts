/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AssetType, defineAssets } from '@iwsdk/core';
import {
  createGallerySet,
  createSideboardSet,
} from './scene-assets/decor.scene-asset.js';
import {
  createAnswerOrb,
  createAnswerTray,
  createPanelHandle,
  createPuzzleTable,
  createPuzzleTile,
} from './scene-assets/puzzle.scene-asset.js';
import {
  createStage,
  createStudioFloor,
} from './scene-assets/studio.scene-asset.js';

const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;
const uikitml = (fileName: string, name: string) => ({
  url: publicAssetUrl(`ui/${fileName}`),
  type: AssetType.UIKitML,
  name,
});

export default defineAssets({
  'studio-floor': createStudioFloor(),
  stage: createStage(),
  'gallery-set': createGallerySet(),
  'sideboard-set': createSideboardSet(),
  'puzzle-table': createPuzzleTable(),
  'answer-tray': createAnswerTray(),
  'puzzle-tile': createPuzzleTile(),
  'answer-orb': createAnswerOrb(),
  'panel-handle': createPanelHandle(),
  'welcome-panel': uikitml('welcome.uikitml', 'Welcome Panel'),
  'puzzle-panel': uikitml('puzzle-panel.uikitml', 'Puzzle Panel'),
  'tile-label': uikitml('tile-label.uikitml', 'Tile Label'),
  'orb-label': uikitml('orb-label.uikitml', 'Orb Label'),
  'voice-check': uikitml('voice-check.uikitml', 'Voice Check'),
});
