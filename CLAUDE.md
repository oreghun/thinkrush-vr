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
- Originality: only code-generated assets, CC0 assets, or assets the owner
  generated on a plan that grants ownership (e.g. Meshy's paid plans), each
  listed in art/SOURCES.md. No CC-BY or other attribution-required assets
  (Meshy's free plan is CC BY 4.0).
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

As of 2026-10-30, PRs 1-22 merged plus the imported-stand PR (6 answer orbs;
7 Next always visible on the desktop page, where tiles need hands; 8 movable
panels and drag-to-look; 9 the 3-minute run loop; 10 the category picker and
desktop fixes; 11-17, by the owner: ten English drafts per puzzle type,
Swahili methali drafts kept aside, the indigo/turquoise studio palette with
category accents, code-built miniatures on the visual tiles, and the
"Choose your world" hub; 18 clue-style visual prompts and word tiles; 19
read-aloud in place of voice recognition; 20 the action twist; 21
release-tagged URLs for public files; 22 display stands for the visual
choices; then the owner's Meshy stand replacing the code-built one):

Live on main

- Foundation: IWSDK 1.1.0-rc.2 scaffold, Pages deploy on every push to main,
  en/sw i18n behind t(key), content/puzzles.json (40 English drafts,
  ten per type) with validators wired into every build. Ten Swahili methali
  drafts wait in content/methali-drafts.json and are not loaded yet.
- Playable: every puzzle in the bank, one at a time. Visual puzzles use the
  four grabbable tiles and the tray; riddles/proverbs/mafumbo use the three
  answer orbs; "Next puzzle" steps through the bank and wraps. The unused
  set (tiles or orbs) stows below the floor. 60 s timer runs only while the
  XR session is visible.
- Visual tiles show code-built low-poly miniatures
  (src/scene-assets/object-options.scene-asset.ts), picked by label in
  src/tile-models.ts. A label with no miniature (password, shadow,
  footprint, fingerprint, tyre track) shows as a word on the tile's slab
  instead. tests/tile-models.test.ts fails if a puzzle's answer is the only
  word among miniatures or the only miniature among words. Miniatures scale
  so their longest side is 8.5 cm, and every tile carries the same wooden
  display stand (display-stand asset, 15.6 x 11.6 x 2.2 cm, origin bottom
  centre, +Z to the player), picked up with it; word cards stand set into
  it. The stand is now the owner's Meshy model (public/models/display-stand.glb,
  loaded as a critical manifest asset, fitted to 15.6 cm wide at runtime;
  objects rest on its tray floor at 92% of its height). If it fails to load,
  the code-built stand (builtStand) takes its place.
- Action twist (src/moves.ts, PuzzleBoard.move): each visual puzzle asks
  for a move with your pick, shown as the panel's instruction line and read
  aloud: DROP it on the tray, FLIP it over (released upside down, anywhere),
  or LIFT it above your head (held 0.1 m above the eyes for 0.5 s, so
  looking closely at it is not an answer). The game picks the move, never
  the puzzle file: the first two visual puzzles on a device are drops, the
  3rd introduces flip and the 5th lift ("New move!"), then it is random
  (count kept in localStorage, thinkrush.visualSeen). Wrong object = wrong
  answer whatever the move. Right object, wrong move = "Right answer, wrong
  move!": a run loses that puzzle (status wrongMove, no points, moves on
  after 2.5 s); practice says so and lets you retry. Orb puzzles have no
  moves. The tray stays visible for every move: the habit is the trap.
- Hands and controllers are code-built (src/input-visuals.ts); the app makes
  no outside requests at runtime.
- Category button on the puzzle panel (practice only): cycles All plus each
  puzzle type that has content (empty ones are skipped); filters practice
  Next and the draw order of runs. The welcome panel's "Choose your world"
  buttons pick a category directly and tint the floor and stage for it.
  Pure logic in src/categories.ts with unit tests. Switching keeps the
  current puzzle when it already fits the category.
- Run mode: Start a 3-minute run draws from the chosen category, shuffled,
  auto-advances 2.5 s after a solve, Skip costs only time, a solve scores
  difficulty x 10, the summary shows score/solved/best, and the best run
  score is kept in localStorage (thinkrush.bestScore). Practice stays the
  default browsing mode with the per-puzzle 60 s timer.
- Each panel hangs from a graphite grab bar: DistanceGrabbable with
  MoveFromTarget, rotation locked so the single-sided panel keeps facing the
  player, position clamped near the table by MovablePanelSystem. On flat
  screens, ScreenLookSystem turns the camera when empty space is dragged;
  it never runs in an immersive session (comfort), never starts on a press
  that begins over something interactable (so mouse-dragging a grab bar
  moves only the panel), and we deliberately do not rotate the world in VR.
  The run clock ticks on flat pages too (practice stays VR-only); only a
  blurred XR session pauses everything.
- Read aloud (src/read-aloud.ts): each new puzzle's prompt (plus the
  mafumbo question) is read with speechSynthesis, one utterance per
  sentence, using on-device voices only (localService); online voices are
  never used. Welcome panel button cycles Off/Slow/Normal/Fast (rates 0.8,
  1, 1.25; saved as thinkrush.readAloud) and says "No voice on this device"
  when there is no local English voice. Puzzle panel "Read it out" reads on
  demand. Entering VR reads the current puzzle (browsers need a user
  gesture before speech); a blurred session pauses speech; solving and the
  run summary stop it. Speech recognition, the voice check panel and
  answer matching were removed (git history has them). Quest Browser voice
  availability still untested: the owner checks the welcome panel label on
  the headset.

Decisions

- Comfort contract: nothing may move or rotate the player's viewpoint in VR
  except their own head. No locomotion, no snap turns, no world rotation, no
  camera animation, no screen shake (juice goes on objects, never on the
  view); avoid full-field particle bursts; the floor and horizon stay
  static; ScreenLookSystem runs only outside immersive sessions. The other
  half of comfort is frame rate: 60 fps gets verified on a real Quest 3 in
  Week 3.
- Pattern puzzle (next big type): universal "Complete the pattern" mechanic;
  procedurally generated families (kanga/kitenge signature, beadwork,
  tessellation, weave, abstract); planned content fields: type "pattern" plus
  a family field. Not built yet.
- Competition strategy: polish two mechanics (patterns + orbs) over adding
  more; RUSH is the demo video's face; verify with iwsdk-glasses-test and
  claim Meta VR Glasses readiness; keep the first 60 seconds tutorial-free.
- Visual clue style: the prompt points at the answer from an angle ("Three
  of these let you in. Which one keeps you out?") and never names it
  outright; easy puzzles state the shared link plainly, harder ones use a
  riddle-style clue. Prompts carry no action verb (grab means pinch in VR
  and click on a screen); the panel's instruction line says how to answer.
  Each hint goes one step closer than its clue.
- Voice (owner, 2026-10-30): no spoken answers in v1 (accents, and
  on-device recognition may be missing on Quest). Instead the game reads
  each question aloud with an on-device voice only, and the player answers
  with the tiles or orbs as usual. This replaces "Answers: by voice" in
  Game design above; the player can set the reading pace.
- AI-made models (owner, 2026-10-30): allowed when the owner generates them
  on a plan that grants ownership. Pipeline: owner uploads to art/incoming/;
  scripts/optimize-model.mjs writes the game copy to public/models/
  (textures <= 1024 px JPEG, a flat roughness map becomes factors); the
  originals move to art/source/ with a row in art/SOURCES.md. Ask for about
  5,000 triangles (Meshy remesh) and low-profile shapes for table props.
- Mafumbo stories are long for a headset: plan for RUSH to reveal them in
  two or three beats. Owner may rework options so the correct answer is not
  always the longest.

Open questions (owner deciding, 2026-10-30)

- Action twist follow-ups: moves for the answer orbs, and a "hold it up to
  RUSH" variant once RUSH exists.

- More AI-made models: the miniatures themselves and a few set pieces,
  following the stand's pipeline below.

Next up (in order)

1. Pattern puzzle type (decision above).
2. RUSH companion (glowing sphere with eyes, shrinks as time runs down) and
   a sound/juice pass.
3. Streaks and the Daily Challenge (localStorage only).
4. Palm-up pause gesture; pause when the session loses visibility.
   Then: Swahili content drop-in (owner writes it), glasses check, 60 fps on a
   real Quest 3, demo video. Cut order if time runs short: leaderboard,
   misplaced-object puzzle variant, extra puzzle count.

Working notes

- Live verification happens in the IWSDK emulator: npx @iwsdk/cli dev up
  --headless, then the xr/ecs/ui CLI commands. CI equals npm run typecheck
  - npm test + npm run build (content rules and the 20 MB budget included).
- The UIKitML panels reflow, so a button's world position moves with panel
  content; query xr list-targets before aiming at it.
- Public files keep fixed names and GitHub Pages lets browsers reuse them
  for 10 minutes, so production builds fetch the scene and every manifest
  URL with ?v=<commit> (src/build-id.ts, __BUILD_ID__ defined in
  vite.config.ts). Without it, a reload right after a deploy paired new
  code with the old scene ("asset voice-check is not declared"). A new
  public file must go through publicAssetUrl or withBuildId.
- Script edits must assert their match: one silent no-op left MovablePanel
  out of components.ts and every scene load failed with "not present in the
  active component catalog". Components must be declared in system-free
  modules or the catalog build drops them.

## IWSDK guidance

The IWSDK creator generated AGENTS.md (plus scoped copies in src/ and public/,
and rules and skills under .claude/). They explain how the SDK and its dev
tooling work, not this game; the rules above take precedence.

@AGENTS.md
