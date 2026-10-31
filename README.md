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

> Status: 40 English draft puzzles are playable, one at a time: ten each of
> visual puzzles, riddles, proverbs and mafumbo stories. One glass screen,
> projected from a light bar above the table, opens on the home page: pick
> a world (visual, riddles, proverbs or mafumbo) and the same screen turns
> into the puzzle page; its Home button comes back. A visual puzzle
> puts four objects on the table under a clue such as "Three of these let
> you in. Which one keeps you out?" Pick the one it points to, then do the
> move the screen asks for: drop it on the tray, flip it over, lift it
> above your head, or show it to RUSH, who comes within reach for that. The right object with the wrong move is "Right answer,
> wrong move!", so read (or listen) carefully. New moves arrive one at a
> time. The objects are built in code and stand on identical wooden display
> stands, all at one size; abstract ones, like a password, appear as a word
> card set into the stand. Riddles, proverbs and mafumbo use three answer orbs you
> point at and pinch. Ten Swahili methali drafts are kept separately in
> `content/methali-drafts.json` for fluent-language review and are not loaded
> into gameplay yet. Next puzzle (always available) steps through the bank, and a
> Category button narrows browsing and runs to one puzzle type. The
> 60-second practice timer only runs inside VR; a run's 3-minute clock also
> ticks on the flat page, so desktop runs end properly. In VR, pinch the light
> bar under the screen (on a flat screen, mouse-drag it) to move the screen
> where you like; on a flat screen, drag empty space to look around. Each new puzzle
> is read aloud by a voice built into your device (see "Read aloud" below).
> Press Start a 3-minute run for a
> scored dash through shuffled puzzles: solving auto-advances, Skip costs
> only time, points scale with difficulty, and your best score stays on your
> device. RUSH, a glowing companion beside the puzzle, is the timer: it
> shrinks and turns red as time runs out, and reacts to every answer.
> The pattern puzzles come next.

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
| `npm test`          | Unit tests in `tests/` (Node's built-in test runner)                 |
| `npm run build`     | `validate`, production build into `dist/`, then the 20 MB size check |
| `npm run preview`   | Serves `dist/` under `/thinkrush-vr/`                                |

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`: `npm ci`, the
typecheck, the tests and the build, then publishes `dist/` to GitHub Pages with the
official Pages actions. Pull requests run the same checks without deploying.
The build's base path is `/thinkrush-vr/` (set in `vite.config.ts`); the dev
server stays at `/`.

## Languages

All interface text lives in `src/i18n/en.json` (English, primary) and
`src/i18n/sw.json` (Swahili). Code reads it with `t(key)` from `src/i18n`, and
`setLanguage('sw')` switches language; the home page has a toggle button.
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

Puzzles live in `content/puzzles.json`: an object with a `puzzles` list,
plus optional `version` and `notes`. Each puzzle has:

| Field         | Value                                                                        |
| ------------- | ---------------------------------------------------------------------------- |
| `id`          | Unique string, e.g. `en-riddle-01`                                           |
| `lang`        | `en` or `sw`                                                                 |
| `type`        | `visual`, `riddle`, `proverb` or `mafumbo`                                   |
| `prompt`      | The puzzle text (for mafumbo, the story)                                     |
| `question`    | Mafumbo only: asked after the story                                          |
| `answer`      | The correct answer                                                           |
| `accepted`    | Extra spoken answers that count as correct, or `[]`                          |
| `options`     | 3 different answers for the orbs, correct one first (the game shuffles them) |
| `tiles`       | Visual only: the 4 objects on the table, one of them the answer              |
| `answer_mode` | `grab` (visual), `voice+orbs` or `orbs`                                      |
| `hint`        | A short hint                                                                 |
| `explanation` | Shown after answering                                                        |
| `subtitle_en` | English subtitle; required when `lang` is `sw`, otherwise `null`             |
| `difficulty`  | `1` (easiest) to `5` (hardest)                                               |
| `status`      | `draft` or `tested`                                                          |

Visual puzzles use `tiles` with `options: []` and `answer_mode: "grab"`; the
other types use 3 `options` and no `tiles`. Text must use plain ASCII
punctuation (straight quotes, no long dashes), because the game font has no
other characters. `npm run validate` (and every build) checks all of this, plus
unique ids and the `subtitle_en` rule, and names the field to fix.

## Read aloud

The game reads each new puzzle's question out loud; players answer by
choosing a tile or an orb, never by speaking. It uses the browser's own
speech synthesis (the Web Speech API) with **voices installed on the device
only**: online voices send the text to a server, so the game skips them.

- The home page's **Read aloud** button cycles Off, Slow, Normal and
  Fast. The choice is saved in the browser. If it says **No voice on this
  device**, the device has no built-in English voice and the game stays
  quiet; the text is always on screen either way.
- **Read it out** on the puzzle page reads the current question again,
  even with automatic reading off.
- Reading pauses when the headset is taken off or a system menu opens, and
  stops when the puzzle is solved.
- Swahili puzzles are read only where the device has a Swahili voice.

Browsers only allow speech after the first tap or click, so on a flat page
the first puzzle is read once you interact; in VR, entering the headset
reads the current puzzle.

## Project rules

The full list is in [CLAUDE.md](CLAUDE.md). In short:

- Hands-first: everything works without controllers, menus included.
- No external services, analytics, ads or payments. Free to play.
- Assets are code-generated, CC0, or generated by the owner on a plan that
  grants ownership (listed in `art/SOURCES.md`). No brand names, logos or
  real people.
  The answer chime (`public/audio/chime.wav`) is synthesized by
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
public/ui/                UIKitML: the screen (home and puzzle pages), tile and orb labels
src/index.ts              entry point: creates the world, registers systems
src/i18n/                 en.json, sw.json and the t() helper
src/ui-text.ts            fills UIKitML text from src/i18n
src/input-visuals.ts      code-built hands and controllers for VR
src/puzzle.ts             gameplay: tiles, tray, answer orbs, timer, progression
src/movable-panel.ts      the screen hangs above its light bar and can be re-placed
src/screen-look.ts        drag-to-look camera for flat screens
src/puzzles.ts            typed access to content/puzzles.json
src/tile-models.ts        which visual tiles get a miniature (tests in tests/)
src/moves.ts              the action twist: which move to ask for, and judging it
src/rush.ts               RUSH the companion (moods and timer in src/rush-mood.ts)
public/models/            imported models, optimized (see art/SOURCES.md)
art/                      originals of imported models and how they were made
src/read-aloud.ts         reads puzzles aloud with on-device voices only
src/assets.ts             asset manifest; models are built in src/scene-assets/
scripts/                  content check, build size check, chime generator,
                          model optimizer
iwsdk.config.json         IWSDK settings: XR mode, hand tracking, features
```

IWSDK guides: https://iwsdk.dev
