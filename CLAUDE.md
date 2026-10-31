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

As of 2026-10-31, PRs 1-37 merged plus the Daily Challenge PR (6 answer orbs;
7 Next always visible on the desktop page, where tiles need hands; 8 movable
panels and drag-to-look; 9 the 3-minute run loop; 10 the category picker and
desktop fixes; 11-17, by the owner: ten English drafts per puzzle type,
Swahili methali drafts kept aside, the indigo/turquoise studio palette with
category accents, code-built miniatures on the visual tiles, and the
"Choose your world" hub; 18 clue-style visual prompts and word tiles; 19
read-aloud in place of voice recognition; 20 the action twist; 21
release-tagged URLs for public files; 22 display stands for the visual
choices; 23 the owner's Meshy stand replacing the code-built one; 24
the first Meshy miniatures, for the wind puzzle; 25 objects at 10 cm;
26 Meshy miniatures for the number and beginnings puzzles, swapped in as
they load; 27 the keys, lock and magnet puzzles' miniatures; then the
energy and sound puzzles' miniatures; 29 the yellow ruler and flat
objects tilted toward the player; 30 RUSH; 31 the show-it-to-RUSH move;
32 one projected screen with home and puzzle pages; 33 beckoning it;
34 the owner's room set in the back corners; 35 the owner's pedestal
table as the play table; 36 the pattern puzzle; 37 the sound pass; then the
Daily Challenge and streaks):

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
  so their longest side is 10 cm (flat ones, under 18% as tall as they are
  long, tilt 30 degrees toward the player so their face shows: ruler,
  paper clip, key, keyboard, blueprint), and every tile carries the same wooden
  display stand (display-stand asset, 15.6 x 11.6 x 2.2 cm, origin bottom
  centre, +Z to the player), picked up with it; word cards stand set into
  it. The stand is now the owner's Meshy model (public/models/display-stand.glb,
  loaded as a critical manifest asset, fitted to 15.6 cm wide at runtime;
  objects rest on its tray floor at 92% of its height). If it fails to load,
  the code-built stand (builtStand) takes its place.
- Imported miniatures: src/imported-objects.ts lists the tile models that
  have an owner-made model in public/models/objects/ (batches 1-3: kite,
  sail, parachute, umbrella, thermometer, ruler, scale, telescope, seed
  (a sunflower seed, also used for the dry seed), egg, blueprint, house;
  batch 4: piano, keyboard, typewriter, keyring, key, padlock; batch 5:
  nail, screw, paper clip, wooden block; batch 6: battery, candle, solar
  panel, trumpet, loudspeaker). They load
  with background priority so the game starts fast; until one has loaded,
  its code-built version shows, and PuzzleSystem swaps it onto any tile
  still showing that stand-in as soon as it arrives.
  tests/imported-objects.test.ts fails if a listed model has no optimized
  file or no row in art/SOURCES.md. Object textures are 512 px (28 objects
  at 1024 px would cost ~150 MB of GPU memory once all were seen).
- Action twist (src/moves.ts, PuzzleBoard.move): each visual puzzle asks
  for a move with your pick, shown as the screen's instruction line and read
  aloud: DROP it on the tray, FLIP it over (released upside down, anywhere),
  LIFT it above your head (held 0.1 m above the eyes for 0.5 s, so
  looking closely at it is not an answer), or SHOW it to RUSH (held within
  0.2 m of RUSH's centre for 0.6 s; for this move RUSH glides from beside
  the screen, out of seated reach, to a spot fixed when the move starts:
  0.28 m right, 0.2 m below and 0.42 m in front of the head). The game
  picks the move, never the puzzle file: the first two visual puzzles on a
  device are drops, the 3rd introduces flip, the 5th lift and the 7th show
  ("New move!"), then it is random
  (count kept in localStorage, thinkrush.visualSeen). Wrong object = wrong
  answer whatever the move. Right object, wrong move = "Right answer, wrong
  move!": a run loses that puzzle (status wrongMove, no points, moves on
  after 2.5 s); practice says so and lets you retry. Orb puzzles have no
  moves. The tray stays visible for every move: the habit is the trap.
- RUSH (src/rush.ts, logic in src/rush-mood.ts with tests, model in
  src/scene-assets/rush.scene-asset.ts, scene node "rush" at 0.52, 1.25,
  -0.8 beside the screen): a deep-gold glowing sphere, 18 cm across,
  with two eyes; it turns to face the player and blinks. It is the timer:
  it shrinks to 45% and warms from gold to red as the clock (the puzzle's
  60 s, or the run's 180 s) runs out. Lasting moods follow the board
  (happy when solved or after a run, sleepy at time up, surprised on a
  run's wrong move); short reactions play over them: a hop for each new
  puzzle, a bigger hop with happy eyes for a solve, a shake with worried
  eyes for a wrong answer, surprised eyes for right-object-wrong-move
  (PuzzleBoard.wrongMoves counts those). It glows in pulses while a puzzle
  is read aloud. All motion is RUSH's own, never the player's view.
- Room set (src/room-pieces.ts, public/models/room/, tests in
  tests/room-pieces.test.ts): the owner's Meshy pieces replace the IWSDK
  starter's Scandinavian decor (decor.scene-asset.ts is gone). Each was
  optimized with --height to real metres, origin at the centre of its base,
  textures 512 px, roughness flattened; manifest ids room-<piece>, loaded
  in the background. Scene groups "pottery-corner" (left, where the
  starter's gallery set stood: low table with a small clay pot on it, a
  clay pot, a basket, a snake plant) and "cabinet-corner" (right: cabinet
  with a small pot on top, a snake plant, the stool), each piece with a
  ContactShadow node. The low table was meant to be the play table but
  came out coffee-table height (my prompt said "low"), so it dresses a
  corner.
- Play table: the owner's Meshy pedestal table (public/models/play-table.glb,
  manifest id play-table, critical), optimized with --height 0.645 to
  1.01 x 0.645 x 0.51 m at its own proportions, so its top is at 0.68 m on
  the stage (owner wanted it no smaller; an earlier fit to the code-built
  0.84 x 0.44 footprint needed a 20% stretch). The puzzle-table entity keeps
  its code-built content (it carries PuzzleBoard); PuzzleSystem.useOwnersTable
  hides the code-built pillar and top (BUILT_TABLE_PARTS) and adds the model
  3 cm further back (OWNERS_TABLE_BACK) so its near edge stays 19 cm in
  front of the seat; if it failed to load, the code-built table stays.
- Pattern puzzle (src/patterns.ts with tests, art in src/pattern-art.ts,
  board in src/pattern-play.ts and the pattern-board scene asset): "Complete
  the pattern." Ten entries (en-pattern-01..10) name a family (kitenge,
  beadwork, tessellation, weave, abstract) and a rule: repeat-2, repeat-3,
  mirror, turn (quarter turns; needs a motif that differs at every turn,
  so not weave), grow (2 to 7 tokens to count), two-cycles (shape period 2,
  colour period 3: the gap holds the one pair not shown). Each round deals
  a fresh random board: a strip of 6 pieces with one gap, and 4 options (1
  right, 3 near misses: other pieces of the strip, or the answer with one
  thing changed); tests deal 300 boards per family and rule and check the
  options all look different and the rule holds. The board (scene node
  "pattern-board", where the tray sits; the tray hides for patterns) is a
  wooden lectern tilted 26 degrees with six 5.8 cm cloth cells and a
  turquoise gap outline that turns gold while a held piece is over it. The
  tiles carry swatch plaques (createSwatch) on their stands; letting a
  piece go over the board answers (always a drop, no move twist, and the
  visualSeen count is untouched). Solving fills the gap and hides the right
  tile; time up fills it too. Category "pattern" (accent #FF6FA8, pink
  floor tint), world button "Pattern Loom - Patterns" as a full-width row
  above the other four on the home page. Textures: 128 px canvases per
  distinct piece, freed each round.
- Sound (src/sound.ts SoundSystem, composition in src/sound-design.ts with
  tests, setting in src/sound-settings.ts): all synthesized with WebAudio
  on three's shared AudioContext, no audio files (only the existing
  generated chime.wav on the tray). Instruments are rendered once into
  buffers (kalimba on two octaves of C major pentatonic, shaker, bass and
  slap hand drums, RUSH's voice tone at C5); the groove (16 steps, a 4-bar
  original melody) is scheduled 0.15 s ahead on the audio clock. Tempo
  92 -> 140 BPM eased by the clock fraction (musicTempo), bass joins below
  75% of the clock and slaps below 40%; home plays kalimba and shaker at 84
  BPM; the groove rests on solved/time up/run over. RUSH's cues (present,
  cheer 0.25 s after the chime, worried, surprised, sleepy at time up,
  runOver fanfare) come from reactionTo on the board and are panned toward
  RUSH from the head. Music ducks to 30% while read-aloud speaks; a blurred
  session suspends the context; a pointer or key press resumes it (browser
  rule). Levels: music bus 0.3, cues 0.55, master 0.9 (offline render peaks
  at 0.4; music about -24 dB calm, -21 dB urgent; cues -16 to -19 dB).
  Home page "Sound on/off" (thinkrush.sound) also mutes the chime.
- Daily Challenge (src/daily.ts with tests; PuzzleSystem.startDaily): the
  home page's gold "Daily Challenge" button (full width, above Pattern Loom)
  starts a run (mode run, 180 s, category All) over the day's puzzles:
  one per world with content, picked by a seed from the local date
  (dayKey, YYYY-MM-DD), sorted easiest first; pattern boards are dealt with
  dailySeed(day, puzzle id), so everyone gets the same boards. Moves still
  follow the device's own introduction count. The run ends after the last
  puzzle or at the clock (advanceRun/endRun), and either counts: endRun
  records the day (recordDaily) in thinkrush.daily ({lastDay, streak,
  bestStreak, lastScore, bestScore}; parseRecord falls back to empty on
  bad data). Streak: +1 when the last day was yesterday, kept on a replay
  the same day (better score kept), else 1; currentStreak shows it until a
  whole day is missed. Button text: "done today, {score} points", else
  "keep your {n}-day streak", else "Daily Challenge" (fill() puts values
  into {name} slots). Summary: "Daily Challenge done!", score, solved x/5,
  streak, best daily score; no Run again (Home and Back to practice). The
  general run best (thinkrush.bestScore) is separate.
- Hands and controllers are code-built (src/input-visuals.ts); the app makes
  no outside requests at runtime.
- One screen (public/ui/screen.uikitml, asset and scene node "screen", scale
  0.115 under a bar at scale 1.6: 600 cm = 1.1 m wide, its centre at
  y 1.2, 1.4 m in front of the seat, the Far stop): two
  pages, home and puzzle, shown one at a time by PuzzleSystem.render. The
  game opens on home (PuzzleMode.Home, the board's default): the table is
  cleared, no clock runs, RUSH rests full size and nothing is read aloud.
  A world button starts that world's first puzzle in practice; the puzzle
  page's Home button (hidden during a run) clears the table and returns.
  Home holds the welcome text, the four worlds in a 2 x 2 grid, and the
  settings row (Enter/Exit VR, language, read aloud). Look: plain divs, not
  the kit's opaque Panel; two faint turquoise rings around dark glass at
  0.9 alpha with a bright edge (UIKitML takes rgba() colours; it rejects
  background-opacity). The screen keeps a min-height so both pages match.
- Category button on the puzzle page (practice only): cycles All plus each
  puzzle type that has content (empty ones are skipped); filters practice
  Next and the draw order of runs. The home page's "Choose your world"
  buttons pick a category directly and tint the floor and stage for it.
  Pure logic in src/categories.ts with unit tests. Switching keeps the
  current puzzle when it already fits the category.
- Run mode: Start a 3-minute run draws from the chosen category, shuffled,
  auto-advances 2.5 s after a solve, Skip costs only time, a solve scores
  difficulty x 10, the summary shows score/solved/best, and the best run
  score is kept in localStorage (thinkrush.bestScore). Practice stays the
  default browsing mode with the per-puzzle 60 s timer.
- The screen hangs above its light bar (screen-projector asset: the
  graphite grab bar, a turquoise lens and an additive fan of light rising
  toward the screen; the fan's mesh ignores rays, so only the bar grabs):
  DistanceGrabbable with MoveFromTarget, rotation locked so the
  single-sided screen keeps facing the player, position clamped near the
  table by MovablePanelSystem.
- Beckon (src/screen-stops.ts with tests, MovablePanel.stop, run by
  MovablePanelSystem): in VR the screen rests at one of two stops. Far is
  the scene's pose (above). Near puts its centre 0.42 m ahead of and 0.18 m
  below the eyes at 40% of the Far scale (0.44 m wide), placed from the
  head when called and never with the bar below 0.72 m (the table top is
  0.68 m). On letting go of the bar, a pull of 8 cm or more toward the head
  means Near, a push of 8 cm means Far, a pinch under 0.35 s moving under
  3 cm switches, and anything else returns to the current stop; the
  screen glides there (rate 4/s). Each page's header has a Closer / Push
  back button (VR only) doing the same switch. A new puzzle (startRound)
  and leaving VR set the stop to Far. The screen carries PokeInteractable,
  so at Near a fingertip taps its buttons; a hand that close loses its
  pointer ray (touch takes over), so at Near the bar can't be ray-grabbed
  from the lap: Push back is the way back. On a flat page the mouse still
  places the screen freely and nothing snaps. On flat
  screens, ScreenLookSystem turns the camera when empty space is dragged;
  it never runs in an immersive session (comfort), never starts on a press
  that begins over something interactable (so mouse-dragging a grab bar
  moves only the screen), and we deliberately do not rotate the world in VR.
  The run clock ticks on flat pages too (practice stays VR-only); only a
  blurred XR session pauses everything.
- Read aloud (src/read-aloud.ts): each new puzzle's prompt (plus the
  mafumbo question) is read with speechSynthesis, one utterance per
  sentence, using on-device voices only (localService); online voices are
  never used. Home page button cycles Off/Slow/Normal/Fast (rates 0.8,
  1, 1.25; saved as thinkrush.readAloud) and says "No voice on this device"
  when there is no local English voice. Puzzle page "Read it out" reads on
  demand. Entering VR reads the current puzzle (browsers need a user
  gesture before speech); a blurred session pauses speech; solving and the
  run summary stop it. Speech recognition, the voice check panel and
  answer matching were removed (git history has them). Quest Browser voice
  availability still untested: the owner checks the home page label on
  the headset.

Decisions

- Comfort contract: nothing may move or rotate the player's viewpoint in VR
  except their own head. No locomotion, no snap turns, no world rotation, no
  camera animation, no screen shake (juice goes on objects, never on the
  view); avoid full-field particle bursts; the floor and horizon stay
  static; ScreenLookSystem runs only outside immersive sessions. The other
  half of comfort is frame rate: 60 fps gets verified on a real Quest 3 in
  Week 3.
- Pattern puzzle (built 2026-10-31, details under Live on main): universal
  "Complete the pattern"; content gives type "pattern", a family and a rule,
  answer "generated"; the game deals the board.
- Assembly idea (owner, 2026-10-31): joining model pieces. Agreed a light
  version, "Complete the object" (one missing piece of a model, turned and
  fitted into the gap, snapping when close), after the sound pass and
  streaks if time allows; full many-piece assembly stays a stretch. Size is
  no issue: pieces come from code or models already in the game.
- Competition strategy: polish two mechanics (patterns + orbs) over adding
  more; RUSH is the demo video's face; verify with iwsdk-glasses-test and
  claim Meta VR Glasses readiness; keep the first 60 seconds tutorial-free.
- Visual clue style: the prompt points at the answer from an angle ("Three
  of these let you in. Which one keeps you out?") and never names it
  outright; easy puzzles state the shared link plainly, harder ones use a
  riddle-style clue. Prompts carry no action verb (grab means pinch in VR
  and click on a screen); the screen's instruction line says how to answer.
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
  --height <m> scales a model to its real height with its origin at the
  centre of its base, so the scene places it at scale 1 (room pieces);
  --size W,H,D fits each axis exactly, stretching (for a piece that must
  match a layout).
  Describe proportions in prompts ("about three quarters as tall as it is
  wide"): "low" gave a coffee table.
- Mafumbo stories are long for a headset: plan for RUSH to reveal them in
  two or three beats. Owner may rework options so the correct answer is not
  always the longest.

Open questions (owner deciding, 2026-10-30)

- Action twist follow-ups: moves for the answer orbs.

- One model still to redo (owner): the megaphone (the upload in
  art/incoming/megaphone.glb is the untextured 929k-triangle preview, so
  the code-built megaphone stays). The ruler is now a bright yellow one:
  the first, wooden ruler disappeared on the wooden stand (prompts were given
  in chat: one ChatGPT style message, then one subject line per object;
  Meshy remesh to ~3,000 triangles, symmetry off for asymmetric objects).
  To add one: optimize it to public/models/objects/<model>.glb with
  --max-texture 512 (add --flat-roughness 0.55 unless it has real metal
  parts; the optimizer keeps data maps as PNG at half the colour maps'
  size), add its TileModel to
  IMPORTED_OBJECTS, add its row to art/SOURCES.md. Batch 3's seed is a
  sunflower seed: the first seed looked like the egg beside it.

Next up (in order)

1. Palm-up pause gesture; pause when the session loses visibility.
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
- The headless emulator renders in software (SwiftShader) at about 2 fps
  with the full room (frame p50 ~0.5 s): UIKit clicks then never fire,
  because the pointer library counts a click only when release follows
  press within ~300 ms, and a screenshot looking down at the table can
  time out and relaunch the browser (check xr status after: a relaunch
  ends the XR session and xr enter can fail silently). Workarounds: click
  screen buttons on the flat page with browser_interact at the button's
  projected canvas point (Pattern Loom ~ (390, 147) on the 780 x 493
  canvas), then enter XR for grab tests (squeeze has no click window);
  check the pattern art with a gallery drawn by src/pattern-art.ts in
  plain Chromium (Playwright page on the dev server, dynamic import).
- Fingertip pokes can't be proven in the headless emulator: its slow
  frames stretch every press past UIKit's 800 ms click window (contactMs
  over 800 in xr run-sequence). Prove the logic with a ray click from a
  controller held 0.7 m or more from the screen (closer, touch takes over
  and the ray stops pressing), and leave the fingertip tap to the Quest.
- Script edits must assert their match: one silent no-op left MovablePanel
  out of components.ts and every scene load failed with "not present in the
  active component catalog". Components must be declared in system-free
  modules or the catalog build drops them.

## IWSDK guidance

The IWSDK creator generated AGENTS.md (plus scoped copies in src/ and public/,
and rules and skills under .claude/). They explain how the SDK and its dev
tooling work, not this game; the rules above take precedence.

@AGENTS.md
