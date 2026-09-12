/**
 * Playtest bot: a crude robot player used to check that a level can actually
 * be finished. It runs right, jumps at ledges, walls, spikes and enemies,
 * waits for moving platforms and rides lifts. It plays worse than a person,
 * so if the bot can finish a level, a player almost certainly can.
 *
 * Usage (in the browser console, with the game open):
 *   const s = document.createElement('script');
 *   s.src = 'tools/playtest-bot.js';
 *   document.body.appendChild(s);
 *   // then:
 *   botRun(0, 400)                    // level 1, give up after 400 simulated seconds
 *   botRun(0, 400, { noEnemies: true })
 *
 * It simulates the world directly at the fixed timestep, so a full run takes
 * a fraction of a second and never touches the live game.
 */
function makeBot() {
  let jumpHold = 0;
  let target = null;
  const T = CONFIG.TILE;

  return function botStep(world, dt) {
    const p = world.player;
    const L = world.level;
    const feet = p.y + p.h;
    const cx = p.x + p.w / 2;
    const groundAt = (tx, ty) => L.isSolid(tx, ty) || L.isOneWay(tx, ty);
    const standable = (tx, ty) => groundAt(tx, ty) && !L.isSolid(tx, ty - 1) && !L.isHazard(tx, ty - 1);

    /** Top y of the nearest place to land ahead, or null if there is none. */
    const landingTop = (fromX, tiles, rise, drop) => {
      const c0 = Math.floor(fromX / T);
      for (let tx = c0; tx <= c0 + tiles; tx++) {
        for (let ty = Math.floor((feet - rise) / T); ty <= Math.floor((feet + drop) / T); ty++) {
          if (standable(tx, ty)) return ty * T;
        }
      }
      return null;
    };
    const enemyNear = (range) => world.enemies.some(
      (e) => e.alive && Math.abs(e.x + e.w / 2 - cx) < range && Math.abs(e.y + e.h - feet) < 30
    );

    const keys = new Set();
    let move = 1;
    let jump = false;
    let hop = false; // short hop when the landing is below us
    if (p.grounded) target = null;

    if (p.platform) {
      // Riding: wait until there is somewhere to get off, then run to the edge and jump.
      const pl = p.platform;
      const vertical = pl.travelY !== 0;
      const exit = landingTop(pl.x + pl.w + 1, vertical ? 1 : 4, 90, vertical ? 8 : 120);
      const dx = pl.x + pl.w / 2 - cx;
      if (exit === null) move = Math.abs(dx) > 6 ? Math.sign(dx) : 0;
      else if (p.x + p.w >= pl.x + pl.w - 3) { jump = true; hop = exit > feet + 24; }
    } else if (p.grounded) {
      const lift = world.platforms.find((pl) => pl.travelY !== 0 && cx > pl.x0 && cx < pl.x0 + pl.w);
      if (lift) {
        // Standing under a lift: wait for it to come down, then hop on.
        move = 0;
        if (lift.y < feet - 8 && lift.y > feet - 80) { jump = true; target = lift; }
        if (enemyNear(48)) jump = true;
      } else {
        const ahead = p.x + p.w + 4;
        const wall = Physics.boxHitsSolid(L, p.x + 6, p.y, p.w, p.h);
        const hazard = L.isHazard(Math.floor((ahead + 8) / T), Math.floor((feet - 1) / T));
        const enemy = enemyNear(48) || world.enemies.some(
          (e) => e.alive && e.x > p.x && e.x - (p.x + p.w) < 50 && Math.abs(e.y + e.h - feet) < 40
        );
        const floorAhead = groundAt(Math.floor(ahead / T), Math.floor((feet + 1) / T));
        if (wall || hazard || enemy) jump = true;
        else if (!floorAhead) {
          const top = landingTop(ahead, 5, 96, 200);
          if (top !== null) { jump = true; hop = top > feet + 24; }
          else {
            const reach = world.platforms.find(
              (pl) => pl.x < ahead + 60 && pl.x + pl.w > ahead + 10 && pl.y > feet - 90 && pl.y < feet + 70
            );
            if (reach) { jump = true; target = reach; hop = reach.y > feet + 24; }
            else move = 0; // nothing to jump to: wait for a platform
          }
        }
      }
    } else if (target) {
      // Airborne toward a moving platform: steer onto its middle.
      const dx = target.x + target.w / 2 - cx;
      move = Math.abs(dx) > 8 ? Math.sign(dx) : 0;
    }

    if (jump && p.grounded) jumpHold = hop ? 0.1 : 0.4;
    if (jumpHold > 0) { keys.add('jump'); jumpHold -= dt; }
    if (move > 0) keys.add('right');
    if (move < 0) keys.add('left');
    return keys;
  };
}

/**
 * Run the bot through a level.
 * @returns {{completed, time, respawns, maxCol, coins, stuckAtCol}}
 */
function botRun(levelIndex = 0, seconds = 400, opts = {}) {
  let done = false;
  let downs = 0;
  const world = new World(LEVELS[levelIndex], {
    onLevelComplete: () => { done = true; },
    onPlayerDown: (lostLife) => { downs++; world.respawnPlayer(lostLife); },
  });
  if (opts.noEnemies) world.enemies = [];
  const bot = makeBot();
  let prev = new Set();
  let maxX = 0;
  let lastProgress = 0;
  let t = 0;
  const steps = Math.round(seconds / CONFIG.STEP);
  for (let i = 0; i < steps && !done; i++) {
    t = i * CONFIG.STEP;
    const now = bot(world, CONFIG.STEP);
    const input = {
      held: (a) => now.has(a),
      pressed: (a) => now.has(a) && !prev.has(a),
      released: (a) => !now.has(a) && prev.has(a),
    };
    world.update(CONFIG.STEP, input);
    prev = now;
    if (world.player.x > maxX + 32) { maxX = world.player.x; lastProgress = t; }
    if (t - lastProgress > 25) break; // wedged somewhere
  }
  return {
    completed: done,
    time: +t.toFixed(1),
    respawns: downs,
    maxCol: Math.floor(maxX / CONFIG.TILE),
    coins: world.stats.coins,
    stuckAtCol: done ? null : Math.floor(world.player.x / CONFIG.TILE),
  };
}
