# ThinkRush VR: project context for Claude Code

ThinkRush VR is a seated, hands-first puzzle game for Meta Quest and Meta VR Glasses,
built with Meta's Immersive Web SDK (IWSDK). It is an entry for the Meta VR Start
Developer Competition 2026 (Gaming track, New Experience division).
Official rules: https://start-developer-competition-26.devpost.com/rules

Live build: https://oreghun.github.io/thinkrush-vr/

## Competition rules (non-negotiable)

- Hands-first: the whole game must work without ever pairing a controller, menus included.
- Seated: every interaction works within a 2 ft radius (the "airplane seat test").
- FoV-aware: keep puzzle area, timer and essential UI in the central field of view.
- Fast cold start, clean pause/resume, a satisfying session in under 10 minutes.
- Performance: at least 60 fps on Quest 3. Low-poly models, few draw calls,
  simple lighting, small compressed textures. Total build target under 20 MB.
- Language: English primary. Any Swahili text must show English subtitles.
- Originality: only code-generated assets or CC0 assets. No CC-BY or other
  attribution-required assets.
- No real people, brand names, logos, trademarks, or characters/quotes from films or TV.
- Free to play: no ads, payments, analytics, or external AI services at the core.
- The deadline is Nov 18, 2026, 12:00 PST. Nothing can change after that.

## Tech

- IWSDK (WebXR), Node 20.19+.
- Deployed to GitHub Pages by a GitHub Actions workflow on every push to main.
- Build base path: /thinkrush-vr/
- Testing: Chrome with the Immersive Web Emulator; a real Quest 3 later.
- Saves (streaks, best scores, Daily Challenge progress): localStorage only, no backend.

## Game design

- The player sits at a virtual table at lap height. Puzzle tiles sit on the table
  within arm's reach; the player pinches, grabs and drops tiles into an answer slot.
- Puzzle types:
  - visual: visual association (find the link, or the odd one out)
  - riddle: classic riddles (vitendawili in Swahili)
  - proverb: complete or interpret a proverb (methali)
  - mafumbo: RUSH tells a short cryptic story; the player works out what it is really about
- Answers: by voice, or by poking one of three floating answer orbs.
  Orbs are always available; voice is optional.
- RUSH: a glowing sphere companion with expressive eyes that presents puzzles and
  reacts to answers. RUSH is also the timer: it shrinks and the music speeds up as time runs out.
- Runs last about 3 minutes. Daily Challenge plus streaks bring players back.
- The first puzzle is the tutorial. No walls of text.
- Palm-up gesture opens pause and settings. Pause when the XR session loses visibility.
- No passthrough in v1: fully virtual scene.
- Art direction: Kenyan / pan-African heart, readable to anyone. Patterns are
  generated procedurally in code in several families (kitenge/kanga-inspired as
  the signature, beadwork, geometric tessellation, weave, plain abstract), never
  copied from specific existing designs. Solving a puzzle must never require
  cultural knowledge: prompts say "Complete the pattern", not the fabric's name.

## Bilingual structure

- All interface text lives in src/i18n/en.json and src/i18n/sw.json, accessed through t(key).
  Never hard-code UI strings.
- Puzzles live in content/puzzles.json, an object with a "puzzles" array. Fields:
  id, lang (en|sw), type (visual|riddle|proverb|mafumbo), prompt,
  question (mafumbo only: asked after the story), answer,
  accepted (extra spoken answers that count as correct),
  options (3 choices for the answer orbs, listed answer-first; shuffle them in game),
  tiles (visual only: the 4 objects on the table; options is empty),
  answer_mode (grab | voice+orbs | orbs), hint, explanation (shown after answering),
  subtitle_en (required when lang is sw), difficulty (1-5), status (draft | tested).
- Voice answers are matched against the answer plus accepted, case-insensitive,
  ignoring "a", "an" and "the". Orbs are always shown, even in voice+orbs mode.
- Write all text with plain ASCII punctuation (straight quotes, no long dashes):
  the game font has no other characters. `npm run validate` checks this.
- Swahili content is written by the project owner. Do not write, translate or
  invent Swahili puzzles or text; leave clearly marked placeholders instead.

## Schedule

- Week 1 (to Nov 3): IWSDK project live on Pages; table, one grabbable tile, timer;
  one visual-association puzzle end to end; test voice input.
- Week 2 (to Nov 10): puzzle bank, riddles with orbs and voice, RUSH companion,
  streaks, Daily Challenge, pause/resume, tutorial, Swahili toggle and pack.
- Week 3 (to Nov 16): art and sound pass, 60 fps on a real Quest 3, demo video.
- Submit Nov 17.
- If time runs short, cut in this order: leaderboard, extra puzzle types, Swahili voice.

## Working style

- Small pull requests, one feature each. Keep main deployable at all times.
- Explain anything the owner must do by hand (settings, accounts, testing on device).

## Session log (state for the next session)

Whoever works on the repo updates this section when a PR merges or a
decision changes. Newest facts win.

As of 2026-10-29, PRs 1-8 merged (6 answer orbs; 7 Next always visible,
because on the desktop page the timer never runs and tiles need hands, so a
round there never ends; 8 movable panels and drag-to-look):

Live on main

- Foundation: IWSDK 1.1.0-rc.2 scaffold, Pages deploy on every push to main,
  en/sw i18n behind t(key), content/puzzles.json (21 English drafts) with
  validators wired into every build.
- Playable: every puzzle in the bank, one at a time. Visual puzzles use the
  four grabbable tiles and the tray; riddles/proverbs/mafumbo use the three
  answer orbs; "Next puzzle" steps through the bank and wraps. The unused
  set (tiles or orbs) stows below the floor. 60 s timer runs only while the
  XR session is visible.
- Hands and controllers are code-built (src/input-visuals.ts); the app makes
  no outside requests at runtime.
- Each panel hangs from a graphite grab bar: DistanceGrabbable with
  MoveFromTarget, rotation locked so the single-sided panel keeps facing the
  player, position clamped near the table by MovablePanelSystem. On flat
  screens, ScreenLookSystem turns the camera when empty space is dragged;
  it never runs in an immersive session (comfort), and we deliberately do
  not rotate the world in VR.
- Voice: on-device-only Web Speech wrapper (src/voice.ts) and a voice check
  panel. Desktop Chrome verified: English downloads then recognizes
  on-device; Swahili (sw-KE) is unavailable in Chrome. Quest Browser still
  untested - the owner runs "Check this device" on the headset and reports.

Decisions

- Pattern puzzle (next big type): universal "Complete the pattern" mechanic;
  procedurally generated families (kanga/kitenge signature, beadwork,
  tessellation, weave, abstract); planned content fields: type "pattern" plus
  a family field. Not built yet.
- Competition strategy: polish two mechanics (patterns + orbs) over adding
  more; RUSH is the demo video's face; verify with iwsdk-glasses-test and
  claim Meta VR Glasses readiness; keep the first 60 seconds tutorial-free.
- Mafumbo stories are long for a headset: plan for RUSH to reveal them in
  two or three beats. Owner may rework options so the correct answer is not
  always the longest.

Next up (in order)

1. Run loop: about 3-minute runs mixing puzzle types, score; then streaks
   and Daily Challenge (localStorage only).
2. Pattern puzzle type (decision above).
3. RUSH companion (glowing sphere with eyes, shrinks as time runs down) and
   a sound/juice pass.
4. Palm-up pause gesture; pause when the session loses visibility.
   Then: Swahili content drop-in (owner writes it), glasses check, 60 fps on a
   real Quest 3, demo video. Cut order if time runs short: leaderboard,
   misplaced-object puzzle variant, in-game voice answers, extra puzzle count.

Working notes

- Live verification happens in the IWSDK emulator: npx @iwsdk/cli dev up
  --headless, then the xr/ecs/ui CLI commands. CI equals npm run typecheck
  - npm test + npm run build (content rules and the 20 MB budget included).
- The UIKitML panels reflow, so a button's world position moves with panel
  content; query xr list-targets before aiming at it.
- Script edits must assert their match: one silent no-op left MovablePanel
  out of components.ts and every scene load failed with "not present in the
  active component catalog". Components must be declared in system-free
  modules or the catalog build drops them.

## IWSDK guidance

The IWSDK creator generated AGENTS.md (plus scoped copies in src/ and public/,
and rules and skills under .claude/). They explain how the SDK and its dev
tooling work, not this game; the rules above take precedence.

@AGENTS.md
