# Ledge

A 2D side-view platformer built with HTML5 Canvas and plain JavaScript. No build tools, no
dependencies, no art assets — **open `index.html` in a browser and play**.

## Play

Double-click `index.html`, or serve the folder and open it (any static server works).

| Action | Keys |
| --- | --- |
| Move | ← / → or A / D |
| Jump | Space, W or ↑ (hold for a higher jump) |
| Drop through a platform | ↓ + Jump |
| Wall jump | Jump while sliding down a wall |
| Pause | P or Esc |
| Mute | M |
| Debug overlay | ` (backtick) or F3 |

Gamepads work too (d-pad/stick to move, A/B to jump, Start to pause).

URL options: `?level=2` starts on a given level, `?debug` opens with the debug overlay on.

## Levels

| # | Name | Theme | What it adds |
| --- | --- | --- | --- |
| 1-1 | First Steps | meadow | Tutorial - signposts teach one mechanic at a time |
| 1-2 | Green Ledge | meadow | The full first level: ferry, elevator, hidden cave |
| 1-3 | Dusk Heights | dusk | Wider gaps, spike rhythms, a long climb |
| 1-4 | The Spire | cavern | Narrow ledges over a bottomless cavern |
| 1-5 | Bounce Country | meadow | Bounce pads and flyers |
| 1-6 | Crumble Caves | cavern | Blocks that fall away, spiky walkers you cannot stomp |
| 1-7 | Ember Ascent | ember | Everything at once, over a long drop |

## What's in it

- **Movement that feels right**: acceleration and deceleration, coyote time (0.1s), jump
  buffering (0.12s), variable jump height, heavier gravity while falling, a little hang time at
  the apex, and corner correction that slides you past ceiling corners you barely clip.
- **Fixed 60 Hz physics** with interpolated rendering, so jumps behave identically on a 60 Hz or
  144 Hz screen.
- **Tile levels** written as ASCII art, 32px tiles, with solid ground, brick blocks, one-way
  platforms, spikes and cave backdrops.
- **Moving platforms** that carry you, hand over their momentum when you jump off, and show a
  dotted track so you can read their path.
- **Enemies** that patrol and turn at walls, ledges, spikes and each other. Stomp them from
  above; touching them from the side costs a heart.
- **Checkpoints, hearts and lives**: spikes and pits cost a heart and send you back to the last
  checkpoint, running out of hearts costs a life, 50 coins earns one back.
- **Feel and feedback**: squash and stretch, dust, particle bursts, screen shake, a camera with
  look-ahead and a vertical dead zone, parallax scenery, and procedural WebAudio sound effects.
- **Signposts** that show a hint when you walk up to them, used by the tutorial level.
- **Bounce pads, crumbling blocks, flyers and spiky walkers** in the later levels,
  each introduced one at a time.
- **Title menu** with Play, Levels and Options; levels unlock as you finish the one
  before, and the level list remembers your best time and coin count.
- **Options** for music and sound volume, screen shake and a double-jump assist,
  all saved in the browser. M mutes everything instantly.
- **Music**: a small chiptune sequencer, one track per theme, synthesised at runtime.

## Project layout

```
index.html          loads everything (plain <script> tags, so file:// works)
js/
  config.js         every tunable number: speeds, gravity, timings, lives
  utils.js          small math/drawing helpers
  input.js          keyboard + gamepad -> named actions
  sfx.js            procedural sound effects
  settings.js       saved options and level progress (localStorage)
  music.js          chiptune sequencer, one track per theme
  themes.js         colour palettes ('meadow', 'dusk', 'cavern', 'ember')
  level.js          tile ids, the map LEGEND, and the Level parser
  physics.js        AABB vs tile-grid collision
  camera.js         follow camera with easing, look-ahead, dead zone, shake
  particles.js      particle bursts
  player.js         the character: movement, jumps, damage, drawing
  platforms.js      moving platforms
  enemies.js        Walker (and the interface new enemies implement)
  items.js          Coin, Checkpoint, Goal
  renderer.js       canvas scaling, parallax background, tile drawing
  hud.js            hearts, lives, coins, timer, title card
  screens.js        title, pause, level clear, game over, victory
  world.js          one level in play: entities, collisions, events
  game.js           main loop and the game state machine
levels/
  levels.js         the LEVELS registry
  level1.js .. level7.js   the seven levels, pure data
tools/
  playtest-bot.js   robot player that checks a level can be finished
```

## Tweaking how it feels

Everything lives in `js/config.js`. Jumps are described the way you'd describe them out loud —
gravity is derived from them:

```js
jumpHeight: 112,       // px at the top of a full jump (3.5 tiles)
jumpTimeToApex: 0.38,  // seconds to reach it
coyoteTime: 0.1,       // still jumpable after leaving a ledge
jumpBufferTime: 0.12,  // pressed early, fires on landing
```

Two stretch abilities are toggles in the same file:

```js
wallJump: true,     // wall slide + wall jump (on)
doubleJump: false,  // a second jump in mid-air (off)
```

## Adding a level

1. Copy `levels/level1.js` to `levels/level2.js` and edit the map.
2. Add `<script src="levels/level2.js"></script>` to `index.html`, after `levels/levels.js`.

No engine code changes. A level is just data:

```js
LEVELS.push({
  id: '1-2',
  name: 'Dusk Heights',
  theme: 'dusk',                 // key in js/themes.js
  map: [ '.....', '..P..', '#####' ],
  signs: [ { x: 6, y: 19, text: 'Hold jump to go higher' } ],  // hints on signposts
  movers: [ { x: 20, y: 12, w: 3, dx: 6, dy: 0, period: 4 } ],
});
```

Map characters (`LEGEND` in `js/level.js`):

| Char | Meaning | Char | Meaning |
| --- | --- | --- | --- |
| `.` | empty | `P` | player start |
| `#` | ground | `o` | coin |
| `B` | brick block | `*` | coin in a cave |
| `-` | one-way platform | `e` | walker enemy |
| `^` | spikes | `C` | checkpoint |
| `J` | bounce pad | `h` | spiky walker (cannot be stomped) |
| `x` | crumbling block | `f` | flyer |
| `:` | cave backdrop | `G` | goal flag |

Moving platforms are listed in `movers`, in tile units: start at `(x, y)`, `w` tiles wide,
travel `(dx, dy)` tiles and back every `period` seconds (`phase` 0..1 offsets the cycle).

Design rules for level 1's physics: you can clear a **3 tile** step-up and roughly a **4 tile**
gap at full speed, and the player fits through 1-tile gaps.

## Adding an enemy or item

Write a class following the small interface documented at the top of `js/enemies.js` or
`js/items.js`, then give it a character in `LEGEND`:

```js
'f': { spawn: (world, tx, ty) => world.addEnemy(new Flyer(tx, ty)) },
```

`World` handles stomping, damage and pickups generically, so nothing else needs to change.

## Checking a level can be finished

With the game open in a browser, paste this into the console:

```js
const s = document.createElement('script');
s.src = 'tools/playtest-bot.js';
document.body.appendChild(s);
// then
botRun(0, 400);   // -> { completed: true, time: 39.7, respawns: 0, ... }
```

The bot plays worse than a person (it only runs right and jumps at obstacles), so if it can
finish, a player can.

## Ideas for later

More levels and themes, new enemy types (flyers, chargers, spiky ones that can't be stomped),
power-ups (extra hearts, a speed boost, unlocking double jump mid-level), breakable blocks, a
level editor that writes the ASCII map, and saved best times.
