/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AudioUtils, createSystem, Pressed } from '@iwsdk/core';
import { Orb } from './orb-component.js';

/**
 * Starter-only behavior for the select-station orb: play its configured audio
 * when pressed (a hand pinch, a controller trigger or a mouse click). It is
 * safe to delete with the orb scene node, Orb component declaration, and
 * registration in src/index.ts.
 */
export class OrbSystem extends createSystem({
  orbPressed: { required: [Orb, Pressed] },
}) {
  init(): void {
    this.queries.orbPressed.subscribe('qualify', (entity) => {
      AudioUtils.play(entity);
    });
  }
}
