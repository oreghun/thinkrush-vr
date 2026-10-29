# ThinkRush VR

ThinkRush VR is a seated, hands-first puzzle game for Meta Quest and Meta VR
Glasses. You sit at a virtual table and solve quick visual puzzles, riddles,
proverbs and _mafumbo_ (cryptic stories) by pinching, grabbing and poking with
your hands. No controllers are needed. The game is free, in English with
Swahili as a second language, and runs in the browser with Meta's
[Immersive Web SDK](https://iwsdk.dev) (IWSDK).

It is an entry for the Meta VR Start Developer Competition 2026 (Gaming track,
New Experience division).

**Play it: https://oreghun.github.io/thinkrush-vr/**

On a Quest, open that link in the Browser and choose **Enter VR**. With hand
tracking turned on in the headset's settings, put the controllers down and the
game switches to your hands. On a computer, the same link shows a 3D preview
you can click around in.

> Status: foundation only. The live build is the IWSDK starter scene (three
> practice stations and a welcome panel) with ThinkRush's language and content
> setup. There is no gameplay yet.

## Run it locally

You need Node.js 20.19 or newer. `.nvmrc` selects Node 22, so with
[nvm](https://github.com/nvm-sh/nvm) run `nvm use` first.

```bash
npm ci
npm run dev
```

`npm run dev` starts the IWSDK dev server at https://localhost:8081/ and opens
a browser window with the IWER emulator (IWSDK's in-browser headset
simulator). The first run downloads that browser. To use your own Chrome and
the Immersive Web Emulator extension instead, run `npm run dev:runtime` and
open https://localhost:8081/. The certificate is self-signed, so accept the
browser warning once.

To try it on a Quest on the same Wi-Fi, open `https://<your computer's IP>:8081/`
in the Quest Browser and accept the same warning.

To check the production build exactly as GitHub Pages serves it:

```bash
npm run build
npm run preview
```

Then open https://localhost:4173/thinkrush-vr/.

| Script              | What it does                                                         |
| ------------------- | -------------------------------------------------------------------- |
| `npm run dev`       | IWSDK dev server plus the managed emulator browser                   |
| `npm run typecheck` | TypeScript check                                                     |
| `npm run validate`  | Checks `content/puzzles.json` and the `src/i18n` files               |
| `npm run build`     | `validate`, production build into `dist/`, then the 20 MB size check |
| `npm run preview`   | Serves `dist/` under `/thinkrush-vr/`                                |

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`: `npm ci`, the
typecheck and the build, then publishes `dist/` to GitHub Pages with the
official Pages actions. Pull requests run the same checks without deploying.
The build's base path is `/thinkrush-vr/` (set in `vite.config.ts`); the dev
server stays at `/`.

## Languages

All interface text lives in `src/i18n/en.json` (English, primary) and
`src/i18n/sw.json` (Swahili). Code reads it with `t(key)` from `src/i18n`, and
`setLanguage('sw')` switches language; the welcome panel has a toggle button.
The choice is saved in the browser.

- Never hard-code interface text. Add the English string to `en.json` and the
  same key to `sw.json`.
- In `sw.json`, an empty string means "not written yet"; the game then shows
  the English text. Swahili text is written by the project owner only.
- In a UIKitML panel (`public/ui/*.uikitml`), give a text element the message
  key as its `id` and `...` as placeholder text. `src/ui-text.ts` fills it in
  and updates it when the language changes.

The typecheck fails if `sw.json` is missing a key, and `npm run validate`
lists how many Swahili strings are still empty.

## Puzzle content

Puzzles live in `content/puzzles.json`, an array of objects:

| Field         | Value                                                            |
| ------------- | ---------------------------------------------------------------- |
| `id`          | Unique string, e.g. `sw-riddle-001`                              |
| `lang`        | `en` or `sw`                                                     |
| `type`        | `visual`, `riddle`, `proverb` or `mafumbo`                       |
| `prompt`      | The puzzle text                                                  |
| `answer`      | The correct answer; must be one of `options`                     |
| `options`     | Exactly 3 different strings, one per answer orb                  |
| `hint`        | A short hint                                                     |
| `subtitle_en` | English subtitle; required when `lang` is `sw`, otherwise `null` |
| `difficulty`  | `1` (easy), `2` (medium) or `3` (hard)                           |
| `placeholder` | Optional. `true` marks sample content to replace before release  |

The two English puzzles there now are placeholders. `npm run validate` (and
every build) rejects unknown fields, duplicate ids, a missing `subtitle_en` on
Swahili puzzles, and the other rules above.

## Project rules

The full list is in [CLAUDE.md](CLAUDE.md). In short:

- Hands-first: everything works without controllers, menus included.
- No external services, analytics, ads or payments. Free to play.
- Assets are code-generated or CC0 only. No brand names, logos or real people.
  The starter's chime (`public/audio/chime.wav`) is synthesized by
  `scripts/generate-chime.mjs`, and every model is built in code, including
  the VR hands and controllers (`src/input-visuals.ts`), which IWSDK would
  otherwise download from a CDN.
- Keep the build under 20 MB. The build fails above that.

## Known gaps

- IWSDK is at 1.1.0-rc.2, a release candidate. That is what `@iwsdk/create@latest`
  installs today. Upgrade to 1.1.0 once it ships.

## Layout

```
content/puzzles.json      puzzle bank
public/scenes/            scene JSON (layout of the world)
public/ui/                UIKitML panels
src/index.ts              entry point: creates the world, registers systems
src/i18n/                 en.json, sw.json and the t() helper
src/ui-text.ts            fills UIKitML text from src/i18n
src/input-visuals.ts      code-built hands and controllers for VR
src/assets.ts             asset manifest; models are built in src/scene-assets/
scripts/                  content check, build size check, chime generator
iwsdk.config.json         IWSDK settings: XR mode, hand tracking, features
```

IWSDK guides: https://iwsdk.dev
