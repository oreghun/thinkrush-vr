/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { iwsdkDev } from '@iwsdk/vite-plugin-dev';
import { defineConfig } from 'vite';

// GitHub Pages serves the site from https://oreghun.github.io/thinkrush-vr/.
// The dev server stays at the root because the IWSDK dev browser opens "/".
const PAGES_BASE = '/thinkrush-vr/';

export default defineConfig(({ command, isPreview }) => ({
  plugins: [iwsdkDev()],
  // Tags public file URLs per release (src/build-id.ts): the commit on CI.
  define: {
    __BUILD_ID__: JSON.stringify(
      command === 'build'
        ? (process.env.GITHUB_SHA ?? Date.now().toString(36)).slice(0, 12)
        : '',
    ),
  },
  server: { host: '0.0.0.0', port: 8081, open: false },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV !== 'production',
    target: 'esnext',
    rollupOptions: { input: './index.html' },
  },
  esbuild: { target: 'esnext' },
  // @drawcall/uikitml otherwise pulls a second three/@pmndrs/uikit graph
  // (its own three vs the app's super-three alias). Duplicate Component classes break
  // instanceof checks → "Only pmndrs/uikit components can be added as children".
  resolve: {
    dedupe: [
      'three',
      '@pmndrs/uikit',
      '@pmndrs/uikit-horizon',
      '@pmndrs/uikit-lucide',
    ],
  },
  optimizeDeps: {
    exclude: ['@babylonjs/havok'],
    include: [
      'three',
      '@pmndrs/uikit',
      '@pmndrs/uikit-horizon',
      '@pmndrs/uikit-lucide',
      '@drawcall/uikitml',
    ],
    esbuildOptions: { target: 'esnext' },
  },
  publicDir: 'public',
  base: command === 'build' || isPreview ? PAGES_BASE : './',
}));
