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

> Status: 60 English draft puzzles are playable, one at a time: ten each of
> visual puzzles, riddles, proverbs, mafumbo stories, patterns and objects. One glass screen,
> floating above the table, opens on the home page: pick
> a world (visual, riddles, proverbs or mafumbo) and the same screen turns
> into the puzzle page; its Home button comes back. A visual puzzle
> puts four objects on the table under a clue such as "Three of these let
> you in. Which one keeps you out?" Pick the one it points to, then do the
> move the screen asks for: drop it on the tray, flip it over, lift it
> above your head, or show it to RUSH, who comes within reach for that. The right object with the wrong move is "Right answer,
> wrong move!", so read (or listen) carefully. New moves arrive one at a
> time. The objects are built in code and stand on identical wooden display
> stands, all at one size; abstract ones, like a password, appear as a word
> card set into the stand. Pattern puzzles ("Complete the pattern") lay a
> strip of six cloth pieces on a small lectern where the tray stands, with
> one gap; the four stands carry candidate pieces, and you drop the right
> one in the gap. Every pattern is drawn in code in five families (kitenge-
> and kanga-inspired, beadwork, tessellation, weave, abstract) and each
> board is dealt fresh from the puzzle's rule. Object puzzles ("Complete the
> giraffe") stand a little figure built of blocks on the lectern with a
> chunk missing; the four stands carry candidate chunks, shown turned. Pick
> the right one, turn it to fit and let it go at the gap: it snaps in.
> Riddles, proverbs and mafumbo use three answer orbs you
> point at and pinch. Ten Swahili methali drafts are kept separately in
> `content/methali-drafts.json` for fluent-language review and are not loaded
> into gameplay yet. Next puzzle (always available) steps through the bank, and a
> Category button narrows browsing and runs to one puzzle type. The
> 60-second practice timer only runs inside VR; a run's 3-minute clock also
> ticks on the flat page, so desktop runs end properly. In VR the screen floats
> about 1.4 m away, sized so its text reads easily. Press **Closer** to
> bring it within reach and tap its buttons with a fingertip; press **Push
> back** to send it back. A new puzzle sends it back on its own. On a flat
> screen, drag empty space to look around. On a phone held upright the view steps back so the screen and
> the table still fit. Each new puzzle
> is read aloud by a voice built into your device (see "Read aloud" below).
> Press Start a 3-minute run for a
> scored dash through shuffled puzzles: solving auto-advances, Skip costs
> only time, points scale with difficulty, and your best score stays on your
> device. In a run you get one pick per puzzle: a wrong pick loses it and
> moves on, so guessing through the choices never pays (practice still
> lets you try again). You sit in a clay-walled room with a beamed ceiling,
> two windows and a doorway open to the evening sky, all built in code.
> RUSH, a glowing companion beside the puzzle, is the timer: it
> shrinks and turns red as time runs out, and reacts to every answer.

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

## Where the answer is

The right answer never sits in a predictable place. Every round shuffles
the tiles, orbs and pieces afresh with a fair shuffle (`src/answer-order.ts`),
independent of the round before, so no guessing order (always the first,
the next one along, the same as last time) does better than chance. The
Daily Challenge gives everyone the same boards, but replaying it moves the
pieces. `tests/answer-order.test.ts` checks this over 60,000 rounds. And in
a run (the Daily Challenge too) a wrong pick loses the puzzle, so trying
every choice in turn doesn't pay either.

## Daily Challenge and streaks

The home page's **Daily Challenge** plays six puzzles, one from each world,
easiest first, in a 3-minute run that ends once all six are played. The set
comes from the date alone (`src/daily.ts`), so everyone gets the same
puzzles that day, pattern and object boards included. Finishing the challenge on
consecutive days builds a streak; the button shows it ("keep your 3-day
streak") or today's result ("done today, 120 points"), and the summary
shows the score, how many were solved, the streak and the best daily score.
Everything is saved on the device only (`thinkrush.daily` in localStorage).

## Meta VR Glasses

The game asks for gaze tracking (optionally), so on Meta VR Glasses you look
at a screen button or an orb and pinch with either hand to
use it; the puzzle pieces on the table are picked up with your hands as on
a Quest. The glasses see less of the world (37 degrees to each side, 25 up,
43 down), so the screen sits a little low and RUSH close beside it: seated
and glancing down at the table, the puzzle page, RUSH (the timer) and the
pieces are all in view at once. To check it in the emulator, set
`dev.emulator.device` to `metaVRGlasses` in `iwsdk.config.json`.

## Pause

Turn either hand palm up, open, in front of you and hold it for a moment:
the game pauses. The screen shows **Paused** with **Resume**, **Home** and
the settings (sound, read aloud, language); the clock, music and voice stop
and RUSH dozes. Palm up again (or Resume) carries on. With controllers, the
menu button does the same; on a flat page, Escape. Taking the headset off
mid-puzzle also pauses it, so nothing is lost while you are away. The
gesture ignores a hand that is pinching, holding a puzzle piece (flipping
one turns the palm up) or resting low on the table (`src/palm.ts`).

## Sound

All music and sound effects are made in code with the browser's WebAudio
synthesizer (`src/sound-design.ts` holds the composition, `src/sound.ts`
plays it), so no audio files are downloaded and nothing recorded or
third-party ships. The one exception is the solve chime, also generated
in code (`scripts/generate-chime.mjs`).

- A light groove on a five-note scale (plucked kalimba-like notes, a
  shaker, a low and a high hand drum) plays during puzzles. RUSH is the
  timer and the music is its heartbeat: the tempo rises from 92 to 140 beats
  a minute as the clock runs down, and the drums join in. Home has a calmer
  version.
- RUSH has a voice: a little hop for a new puzzle, a cheer after the solve
  chime, an "uh-oh" for a wrong answer, a "huh?" for the right object with
  the wrong move, a yawn when time runs out and a fanfare at the end of a
  run. It comes from RUSH's side of your view.
- The music drops while a puzzle is read aloud, so every word is clear.
- Sound pauses with the game when the headset is taken off. The home page's
  **Sound on / Sound off** button switches it all, and the choice is saved.

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

## Performance

The game must hold at least 60 fps on a Quest 3. To check it on the headset,
open the live build with `?fps` at the end of the address:

    https://oreghun.github.io/thinkrush-vr/?fps

A line at the foot of the screen then shows, once a second: frames per
second, the headset's display rate, the slowest frame in milliseconds,
late frames (when the headset had to show the previous picture again),
draw calls and triangles. Without `?fps` nothing is shown or measured.

When VR starts, the game asks the headset for 72 Hz (Quest's own baseline),
which leaves the most time for each frame. Shadows are drawn only around the
table, where they matter; the furniture in the room corners is grounded by
soft contact shadows instead.

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
src/movable-panel.ts      the screen's two stops (Far, and Near within reach) and its glide
src/screen-look.ts        drag-to-look camera for flat screens
src/screen-stops.ts       beckoning the screen: its Far and Near stops (tests in tests/)
src/patterns.ts           pattern puzzles: families, rules and dealing a fair board (tests in tests/)
src/pattern-art.ts        draws every pattern piece in code
src/pattern-play.ts       the pattern board on the table during a pattern puzzle
src/object-puzzle.ts      object puzzles: the block figures and dealing a fair board (tests in tests/)
src/object-art.ts         builds the figures and pieces from blocks in code
src/object-play.ts        the object board on the table: the gap, judging a piece, the snap
src/sound.ts              music and RUSH's voice, synthesized (composition in src/sound-design.ts)
src/daily.ts              the Daily Challenge's puzzles and the streak (tests in tests/)
src/pause-gesture.ts      the palm-up pause (gesture logic in src/palm.ts, tested)
src/puzzles.ts            typed access to content/puzzles.json
src/tile-models.ts        which visual tiles get a miniature (tests in tests/)
src/moves.ts              the action twist: which move to ask for, and judging it
src/rush.ts               RUSH the companion (moods and timer in src/rush-mood.ts)
public/models/            imported models, optimized (see art/SOURCES.md); room/ holds the corner set dressing
art/                      originals of imported models and how they were made
src/read-aloud.ts         reads puzzles aloud with on-device voices only
src/assets.ts             asset manifest; models are built in src/scene-assets/
scripts/                  content check, build size check, chime generator,
                          model optimizer
iwsdk.config.json         IWSDK settings: XR mode, hand tracking, features
```

IWSDK guides: https://iwsdk.dev
