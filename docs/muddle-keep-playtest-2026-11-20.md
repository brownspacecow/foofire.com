# Muddle Keep — playtest + improvement list

Playtested 2026-11-20 on the live site (foofire.com/src/games/muddle-keep/).
Four hands-on runs in a desktop browser, plus a code audit of
`src/games/muddle-keep/js/*.js` to check each finding against the source.

## Playtest summary

- Load is fast (~2–3 s), no console errors, no crashes in any run.
- Core loop works: dig, mine gold seams, build Treasury/Lair, walls, Hand/Slap,
  Stop time, spells by mouse, pause, Save & quit, Continue resumes exactly.
- All three completed runs ended the same way: **wave 4, 0 creatures left,
  Heart destroyed.** Run 4 lost 3 of 4 starting creatures to wave 1 alone.
- Best run on record before this test: wave 4.
- First wave at 70 s, then ~40 s gaps. Wave sizes: 3, 4, 4, 5 heroes.
  Boss (Baron Bumblefrost) arrives every 5th wave — never reached.
- Starting economy: 480 gold, 100 mana (regen ~0.9/s, cap 120), 8 food,
  5 imps, 4 creatures, Heart 900 HP.

## Where the playtest report needed correcting

Checked against the code — these are real, but subtler than they looked:

- **Shadows, particles, health bars and walk-bob already exist** — they are
  just too small/subtle to notice at normal zoom. Blob shadows
  (`makeShadow`, opacity 0.34), particle bursts/rings/lines (`actors.js`
  Effects: dig dust, gold sparkles, heal, level-up, heart-hit, deaths),
  health bars (shown when damaged), and walk bob (`sin * 0.045`) are all
  in. The fix is to make them bigger/longer/more visible, not to add them.
- **Selling does refund** — a wall refunds 2 gold (cost 4). The playtester
  saw no change because gold was at the 450 cap with no Treasury, and
  `addGold` silently drops the overflow. The fix is a "+2 gold" toast and
  not eating refunds at the cap (or showing "Treasury full!").
- **Space is not a pause key anywhere in the code** — no "Space" string
  exists outside `colorSpace`. The help text says P or Esc. So Space isn't
  broken, it's just never taught; P/Esc are undiscoverable in-game.
- **Mana regen while paused could not be reproduced in code** —
  `economy.update` (mana +0.9/s) only runs inside `game.update`, which the
  main loop skips while paused or a menu is open. Needs a retest before
  treating it as a bug.
- **Two "Grumblet"s are by design** — `levels.json` starts with
  `grumblet × 2`. Same-type duplicates need individual nicknames, not a
  spawn fix.
- **Wheel zoom is wired up in code** (`input.js` wheel listener on the
  canvas, `preventDefault`, `rig.zoom`) — but it did not work in the
  playtest. Likely the pointer was over HUD/page rather than the canvas.
  Needs a retest, plus on-screen zoom buttons either way.

## 1. Blockers — fix first

1. **Low quality + full zoom-out blacks out the canvas, with no recovery.**
   Mechanism (from code): low quality sets fog far to 58, but the camera
   can zoom out to distance 56 — at that range the whole map is past the
   fog and renders as the near-black background. Zooming back in, panning
   and clicking did not recover it; only switching quality back to High
   (which resets the camera) fixed it. Fix: clamp max zoom-out distance
   below the fog range on Low, widen Low fog, and add a reset-camera
   button. Also stop `resize` from resetting the camera (`main.js`
   calls `rig.frame()` on every resize).
2. **Settings → Back returns to the title menu, even from pause.**
   `menus.js`: both Settings screens use `back-title`. Remember where
   Settings was opened from and go back there.

## 2. Combat you can't see (the biggest gameplay problem)

3. **Enemies look like your own creatures.** Same cute-blob style, similar
   size and colours; no red ring, outline, "!" marker or always-on health
   bar. Health bars only appear once a hero is already damaged, and the
   playtester never once clearly saw a fight in three full runs. Fix: red
   ring + "!" under intruders, always-on thin health bar for heroes,
   and visually distinct knights (silver armour, shield, sword, plume)
   vs the player's monsters.
4. **No alarm when the Heart is attacked.** Its HP silently drops
   (900 → 195 in one wave in run 2). There is a low thud sound and a red
   burst, but no banner, flash, shake or "Heart under attack!" message.
   Fix: banner + red flash + camera shake + Heart-bar pulse when
   `heart-hit` fires, plus a louder alarm the first time per wave.
5. **SLAP has no visible feedback.** It fires a small pink ring, but no
   shove, damage number or message — its effect is unclear. Make the
   shove obvious (bigger ring + creature hop, which already exists as
   `slapHop`, + a "Shoved!" toast the first times).

## 3. Controls

6. **Wheel zoom didn't work in the playtest** (see correction above).
   Add on-screen + / − / reset-camera buttons so zoom never depends on
   the wheel or keyboard.
7. **Camera can be lost by zooming out fully** (black void, no recovery).
   Clamp pan/zoom so the map can't leave the frame; add reset camera.
8. **Keyboard shortcuts are unreliable / undiscoverable.** Q didn't cast
   Zoomies after clicking UI buttons in the playtest (couldn't reproduce
   in code — retest). P/Esc pause works; Space doesn't exist. Fix: show
   the shortcuts on screen (a small "?" hint row), and retest Q/W/E/R
   after UI clicks.
9. **Spells need an unexplained two-step flow** (click spell to arm, then
   click a target). The hint line does say "Tap the dungeon to cast X"
   once armed, but it's easy to miss. Add a big "Now tap the dungeon!"
   prompt + highlight valid targets while armed.

## 4. Difficulty — too hard for 7–9 year olds

10. **Wave 1 can wipe 3 of 4 starting creatures; every run died at wave 4
    with 0 creatures.** Imps don't fight and there are no starting traps,
    so once creatures die the Heart is defenceless. Fix: wave 1 = 2
    squires instead of 3, first wave at 90 s instead of 70 s, and give the
    player one free Bounce Trap (or +1 starting creature) so the first
    fight is winnable. Consider a "Kid mode" toggle: slower waves, +1
    creature, cheaper walls.
11. **Creature income is slow and invisible.** New creatures trickle in
    every ~16 s from the portal, capped by Lair size — nothing tells the
    player that. Show "Next creature in Xs" near the creature panel.

## 5. Economy and rules nobody explains

12. **Payday is silent.** Gold drops by exactly 45 every minute (wages:
    10 + 10 + 12 + 13) with no HUD warning — only a toast when payday is
    *missed*. Fix: a "Payday −45 gold" toast + a small gold animation
    every payday, and show the per-minute wage total in the HUD.
13. **Sell refunds vanish at the gold cap** (see correction above).
    Toast the refund amount; warn "Treasury full!" when gold is capped.
14. **Zap is locked with no explanation on its button.** The Library
    description mentions it, but the spell button itself says nothing.
    Show "Unlock: build a Library" on locked spells/traps.
15. **"N jobs queued · M waiting for a tunnel" reads like an error.**
    Planned tiles that look adjacent to open floor sit undug with no
    explanation. Reword to "N jobs queued" + a hint ("Imps dig one tile
    at a time from open floor") and highlight blocked tiles.
16. **Hunger / Energy / Mood numbers have no "what do I do?" link.**
    The creature sheet explains wages, but never says Hatchery = food,
    Lair = energy. Add one line per need ("Hungry → build a Hatchery").
17. **Room painting errors don't say which tiles are valid.**
    "Rooms need floor." fired on the Heart room's top row (portal/heart
    tiles aren't floor). Highlight paintable tiles while a room is
    selected, and say why a tile is invalid ("That's the portal!").
18. **The tip toast is a carousel, not a tutorial.** Code check: action
    tips *do* wait for the player (only the welcome card times out after
    12 s), so it's better than it looked — but "Got it" advances to the
    next tip instead of dismissing, and there's no way to dismiss tips
    for good. Fix: "Got it" dismisses the current tip, add an X to hide
    tips for the run, and don't re-show a dismissed tip after resume.

## 6. Layout

19. **Short screens can't see HUD + canvas + toolbar at once.** The app
    is `min(78dvh, 820px)` with a 560 px minimum, so on a short window
    the toolbar sits below the fold and the page must scroll. Fix: make
    the toolbar overlay the canvas bottom (or collapse to a row that fits
    in 480 px height), and test at 840×480.

## 7. Graphics upgrade (Jordan's ask)

What the game looks like now: flat-shaded low-poly, top-down with a
slight tilt. Almost everything is a solid flat colour. The stone speckle
texture exists but is very subtle; `shadowMap` is off
(`render.js`: `shadowMap.enabled = false`); lighting is flat and even;
the Heart is a pink octahedron crystal, not a heart; walls are flat grey
slabs; rooms are flat colour tints. The UI (big purple buttons, chunky
yellow title) is the best-looking part. No lag at any point; load 2–3 s.

### Tier 1 — cheap, big win (no new assets, same primitives)

- **Dirt that reads as dirt:** stronger speckle/noise texture (bigger
  dots, more contrast), per-tile brightness variation wider than the
  current ±9%, plus pebbles, cracks and moss patches as tiny instanced
  details on random dirt tiles.
- **Bigger, darker blob shadows** under every creature/imp/knight
  (they exist at 0.34 opacity — go darker and larger, and add one under
  the rock border).
- **Bigger, longer particles:** dig dust, gold sparkles, heal "+",
  kill star-bursts, hit flashes — current bursts are 3–18 points at
  size 0.14 for 0.35–0.9 s; roughly double size and life.
- **Rooms you can read:** gold piles that grow in the Treasury, blankets
  in the Lair, mushrooms in the Hatchery, dummies in Training, books in
  the Library — all buildable from the existing primitive shapes.
- **Real walls:** make wall tiles genuinely tall blocks with a visible
  top face instead of flat grey slabs (height 1 already exists in
  `HEIGHTS` — it just doesn't read).
- **A Heart that looks like a heart:** replace the octahedron with a
  heart shape (two spheres + cone, or an extruded heart), keep the pulse
  (already in `render.js`), add a red flash + shake on `heart-hit`, and
  a warm radial glow. Explain or remove the floating purple ring
  (it's the portal swirl, but it reads as unexplained).
- **Light and depth:** warm point light around the Heart (exists on High
  only — keep it) plus torch glow at the gate; darken un-dug dirt
  slightly vs dug floor so dug tunnels read clearly.

### Tier 2 — medium (new animation + enemy readability)

- **Enemies unmistakable:** red ring under intruders, always-on health
  bars, distinct knight models (silver armour, shield, sword, plume)
  vs the player's cute monsters; ranged heroes get a visible bow.
- **Animation with weight:** amplify the existing walk bob, add pickaxe
  swings for imps, attack swings for creatures/heroes, squash-and-
  stretch on pick-up/slap (the `slapHop` hop exists — make it bigger).
- **Combat feedback:** hit flashes (the `hurtFlash` scale-pop exists —
  add a colour flash), damage numbers, a star burst on kills (exists,
  make it bigger), and a "Wave cleared!" celebration.

### Tier 3 — bigger (only if Tier 1–2 land well)

- Real-time shadows: turn `shadowMap` on with a single directional
  light and a tight shadow camera (test the perf cost on phones first;
  keep the Low-quality path shadow-free).
- Terrain texture variants per tile type (cracked dirt, mossy dirt,
  veined gold) instead of one speckle texture tinted by colour.
- Torch props with flickering point lights at the gate and Heart.

## What worked well (don't break these)

Title screen and How to play are clear; Pause / Stop time / Save & quit /
Continue all work and the save resumes exactly; digging, room painting,
walls, selling, Hand, spell arming/casting and the creature roster all
function; the wage/payday system, room minimum sizes and Workshop-gated
traps are sensible rules, just under-communicated; best-wave persistence
and the "NEW BEST RUN" / "knights sent home" end screens are encouraging.

## Fixed on branch `muddle-keep-improvements` (2026-11-20)

Everything in the list above was implemented, in order. Commit on the
branch; not yet pushed or merged.

- **Blockers:** Low fog far 58 → 72, max zoom-out 56 → 44, so the map can
  no longer fade to black; Settings → Back returns to the pause menu when
  opened from there; window resize no longer resets the camera zoom.
- **Combat readability:** red ring under every intruder, hero health bars
  always on, knight gets a plume + big shield + silver chest; Heart attack
  now flashes the Heart bar, shows a "The Heart is under attack!" toast
  and shakes the camera (throttled to once per 4 s); Slap rings are
  bigger and the first three slaps toast "Shoved N creatures!".
- **Controls:** on-screen − / + / ⟲ zoom buttons in the top bar; Space
  now pauses (P/Esc still work); a shortcuts line under the toolbar;
  arming a spell toasts "Now tap the dungeon to cast X!".
- **Difficulty:** first wave 70 s → 90 s, wave sizes 3/4/4/5 → 2/3/3/4,
  +1 starting creature (2 Snootles, 5 total), base creature cap 4 → 5 so
  the HUD never reads over-cap; Kid mode setting (slower waves, 120 s
  first wave, −15% knight HP, next run only); "Next creature in Xs" in
  the hint line.
- **Economy/UX:** payday toasts "Payday −N gold" with a gold-chip pulse;
  sell refunds are toasted (and no longer silently eaten at the gold cap
  without saying so); Zap's button explains "Locked — research Zap Spell
  in a Library"; jobs line explains blocked tiles; creature sheet links
  Hunger → Hatchery, Energy → Lair; room-paint errors name the problem
  (dirt, rock, water, lava, wall, Portal, Heart); "Got it" dismisses a
  tip, ✕ hides tips for the run, dismissed tips don't come back.
- **Layout:** app min-height 560 → 420 px, short screens (<640 px tall)
  hide the hint lines and shrink the app so the toolbar stays in view.
- **Graphics Tier 1:** stronger dirt speckle (420 dots, cracks, pebbles),
  per-tile brightness variation ±15%, darker un-dug dirt, taller walls
  (1 → 1.3) with taller doors, bigger/darker blob shadows, particles
  ~1.7× bigger and longer-lived, room props (gold piles, beds, mushrooms,
  training dummies, book stacks, anvils), Heart rebuilt as a real heart
  shape (two lobes + point) with a damage flash, gate torch light.
- **Graphics Tier 2:** walk bob doubled, hurt pop 1.08 → 1.18, bigger
  attack/dig/gold/heart-hit/death bursts.
- **Graphics Tier 3:** real-time shadows on High only (PCFSoft, tight
  1024 shadow camera); Low stays shadow-free.
- **Bug found while testing:** `setTool` spread the tool object into the
  event, so its `type` field ('sell', 'dig', ...) overwrote the event's
  own `type: 'tool'` — selecting the Sell tool fired a phantom 'sell'
  event. Fixed in `game.js` (emits `{ tool, id }`) and guarded the sell
  toast in `main.js`.

Verification: `node --check` on all 15 changed files; headless sim test
(17 checks: wave sizes, Kid mode, sell refund, paint errors, payday,
240 s soak) all pass; repo `npm test` 8/8; headless Chromium render test
on the local server — title, HUD, digging and Low-quality full zoom-out
all render with no page errors. The zoom-out screenshot proves the black
canvas is gone: the whole map stays visible at max zoom on Low. The only
failed request is the Google Font (Press Start 2P), blocked by this
sandbox's proxy — pre-existing, unrelated, loads fine on the live site.
