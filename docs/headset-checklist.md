# Headset checklist

Everything that can only be proven on a real Meta Quest 3. The desktop
emulator and a phone show that the game runs; they cannot show frame rate in
VR, real hand tracking, or the headset's own voice. Work down the list once,
note what you see, and send the notes back. Anything that fails becomes the
next fix.

## Before you start

- Open the live build with the frame rate line:
  https://oreghun.github.io/thinkrush-vr/?fps
- Turn hand tracking on and put the controllers out of reach, so they do not
  wake up.
- Sit in a chair, as a player would.
- For a first-visit check, use a device that has never opened the game, or
  clear the site's data in the browser settings. That also clears streaks,
  best scores and the move count.

## 1. Frame rate (the competition asks for 60 fps)

Press Enter VR. The line at the bottom of the screen updates every second:

`72 fps (display 72 Hz), slowest frame 15 ms, 0 late, 55 draws, 92k triangles`

Read it for a few seconds in each place:

- [ ] Home page
- [ ] Object Studio (a visual puzzle with the 3D objects)
- [ ] Pattern Loom (a pattern board)
- [ ] Riddle Garden (the three orbs)
- [ ] While holding and moving a tile

Good: fps close to the display rate (72), and "late" at 0 most seconds.
Report: the lowest fps and the most "late" you saw, and where.

## 2. How to play (the tour)

- [ ] Entering VR for the first time starts the tour on its own.
- [ ] The voice reads every step, and RUSH pulses while it speaks.
- [ ] Step 1: picking up any object moves on.
- [ ] Step 2: dropping the right object on the tray says Correct.
- [ ] Step 3: pointing at the right orb and pinching solves the riddle.
- [ ] Step 4: RUSH shrinks and turns red, the music speeds up, then RUSH
      grows back.
- [ ] Step 5: turning a palm up shows the Paused page; palm up again ends the
      tour on the home page.
- [ ] Skip tour works with a real pinch.
- [ ] Entering VR again does not start the tour; How to play replays it.

## 3. Hands

- [ ] Fix-it Workshop: turning a piece and letting it go at the gap snaps it
      in; an unturned right piece asks you to TURN it.
- [ ] Closer brings the screen within reach, a fingertip tap presses its
      buttons, and Push back sends it away.
- [ ] Object Studio moves: FLIP (let go upside down), LIFT (above your head)
      and SHOW (hold it up to RUSH) each count once introduced.
- [ ] Palm-up pause works during a normal puzzle too, and not while holding
      a tile.

## 4. Voice

- [ ] The home page's Read aloud button shows a pace (Slow, Normal or Fast),
      not "No voice on this device".
- [ ] A proverb (Wisdom Courtyard) reads its gap as "blank".

## 5. Demo video

Once the frame rate looks good, record from the shot list in
`docs/demo-video.md`. Check the competition's video length and hosting rules
first.
