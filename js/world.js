/**
 * World: the live state of one level being played - tiles, camera, player,
 * moving platforms, enemies, items and effects.
 *
 * The World knows nothing about menus or lives. It reports big events through
 * `hooks` and the Game decides what they mean:
 *   hooks.onPlayerDown(lostLife)  death animation finished; respawn or game over?
 *   hooks.onLevelComplete()       the goal was reached
 *   hooks.onCoin()                a coin was collected
 * With no hooks (e.g. in tests) the player simply respawns.
 */

/** An input source that presses nothing (used when the player shouldn't move). */
const NO_INPUT = { held: () => false, pressed: () => false, released: () => false };

class World {
  constructor(levelData, hooks = {}) {
    const T = CONFIG.TILE;
    this.data = levelData;
    this.hooks = hooks;
    this.level = new Level(levelData);
    this.theme = THEMES[levelData.theme] || THEMES.meadow;
    this.camera = new Camera();
    this.particles = new Particles();
    this.popups = [];      // floating text: { text, x, y, life, color }
    this.time = 0;         // animation time
    this.clock = 0;        // level timer (stops when the level is cleared)
    this.flash = 0;        // 1 -> 0 white screen flash
    this.start = { x: 2 * T, y: this.level.height - 4 * T }; // overwritten by a 'P' tile
    this.platforms = (levelData.movers || []).map((def) => new MovingPlatform(def));
    this.enemies = [];
    this.items = [];

    // Let every map character with a spawn() create its entity.
    for (const s of this.level.spawns) s.spawn(this, s.tx, s.ty);

    this.demo = false;             // title-screen backdrop: scenery only, no player
    this.checkpoint = this.start;  // where the player respawns
    this.complete = false;         // goal reached
    this.deathTimer = 0;           // counts down the death animation
    this.lostLife = false;         // did the current death cost a life?
    this.waitingForRespawn = false;
    this.stats = {
      coins: 0,
      totalCoins: this.items.filter((it) => it instanceof Coin).length,
      deaths: 0,
    };

    this.player = new Player(this.start.x - CONFIG.player.width / 2, this.start.y - CONFIG.player.height);
    this.camera.snapTo(this.player, this.level);
  }

  // ---------------------------------------------------------------------------
  // Spawn hooks used by LEGEND entries (js/level.js)
  // ---------------------------------------------------------------------------

  /** Stored as the bottom-centre of the tile. */
  setPlayerStart(tx, ty) {
    const T = CONFIG.TILE;
    this.start = { x: tx * T + T / 2, y: (ty + 1) * T };
  }

  addEnemy(enemy) { this.enemies.push(enemy); }
  addItem(item) { this.items.push(item); }

  // ---------------------------------------------------------------------------
  // Simulation
  // ---------------------------------------------------------------------------

  update(dt, input) {
    this.time += dt;
    if (!this.complete) this.clock += dt;
    this.flash = Math.max(0, this.flash - dt * 4);

    // Platforms move first so riders can be carried by this step's motion.
    for (const plat of this.platforms) plat.update(dt);

    const p = this.player;
    if (!this.demo) p.update(dt, this.complete ? NO_INPUT : input, this);

    for (const e of this.enemies) e.update(dt, this);
    this.bumpEnemies();
    for (const it of this.items) it.update(dt, this);

    if (!p.dead && !this.demo) {
      this.checkEnemyContacts();
      for (const it of this.items) {
        if (!it.removed && overlaps(p, it)) it.onTouch(this);
      }
      this.checkHazards();
    }
    this.enemies = this.enemies.filter((e) => !e.removed);
    this.items = this.items.filter((it) => !it.removed);

    // Death sequence: let the burst play, then hand over to the Game.
    if (p.dead && !this.waitingForRespawn) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        this.waitingForRespawn = true;
        if (this.hooks.onPlayerDown) this.hooks.onPlayerDown(this.lostLife);
        else this.respawnPlayer(this.lostLife);
      }
    }

    this.particles.update(dt);
    for (const pop of this.popups) { pop.y -= 28 * dt; pop.life -= dt; }
    this.popups = this.popups.filter((pop) => pop.life > 0);
    if (!this.demo) this.camera.update(dt, p, this.level);
  }

  /** Enemies that walk into each other turn around. */
  bumpEnemies() {
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (!a.alive || !b.alive || !overlaps(a, b)) continue;
        if (a.onBump) a.onBump(b);
        if (b.onBump) b.onBump(a);
      }
    }
  }

  /** Stomp enemies from above; touching them any other way hurts. */
  checkEnemyContacts() {
    const p = this.player;
    const touching = this.enemies.filter((e) => e.alive && overlaps(p, e));
    if (touching.length === 0) return;

    // It's a stomp if we're falling and our feet were above the enemy's
    // middle at the previous step (generous on purpose).
    let stomped = false;
    for (const e of touching) {
      const wasAbove = p.py + p.h <= e.py + e.h * 0.5;
      if (e.stompable && p.vy > 0 && wasAbove) {
        e.onStomp(this);
        stomped = true;
        this.particles.burst(e.x + e.w / 2, e.y + e.h, 10, {
          colors: ['#ffffff', '#d9c7ff'], speed: 160, spread: Math.PI, life: 0.4, size: 5, gravity: 300,
        });
      }
    }
    // A stomp wins over any side contact in the same step.
    if (stomped) {
      p.bounce();
      this.camera.shake(3, 0.15);
    } else {
      this.hurtPlayer(touching[0].x + touching[0].w / 2);
    }
  }

  /** Spikes and falling out of the level. */
  checkHazards() {
    const p = this.player;
    if (p.y > this.level.height) {
      this.killPlayer('pit');
      return;
    }
    const T = CONFIG.TILE;
    const x0 = Math.floor(p.x / T);
    const x1 = Math.floor((p.x + p.w - Physics.EPS) / T);
    const y0 = Math.floor(p.y / T);
    const y1 = Math.floor((p.y + p.h - Physics.EPS) / T);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!this.level.isHazard(tx, ty)) continue;
        // The teeth only fill the bottom of the tile; be a little forgiving.
        const teeth = { x: tx * T + 3, y: ty * T + T - 13, w: T - 6, h: 13 };
        if (overlaps(p, teeth)) {
          this.killPlayer('spikes');
          return;
        }
      }
    }
  }

  /** Enemy contact: lose a heart and get knocked back (ignored while invulnerable). */
  hurtPlayer(fromX) {
    const p = this.player;
    if (p.invulnTimer > 0) return;
    p.health -= 1;
    if (p.health <= 0) {
      this.killPlayer('enemy');
      return;
    }
    p.knockback(fromX);
    this.camera.shake(5, 0.25);
    this.particles.burst(p.x + p.w / 2, p.y + p.h / 2, 8, { colors: ['#ffffff', '#ff8a8f'], speed: 140, life: 0.35 });
  }

  /**
   * Something fatal happened. Spikes and pits cost a heart (enemies already
   * took theirs); either way you go back to the last checkpoint, and if your
   * hearts are gone it costs a life.
   */
  killPlayer(cause) {
    const p = this.player;
    if (p.dead) return;
    if (cause !== 'enemy') p.health -= 1;
    this.lostLife = p.health <= 0;
    p.dead = true;
    this.stats.deaths += 1;
    this.deathTimer = CONFIG.death.delay;
    this.camera.shake(8, 0.35);
    this.flash = 0.6;
    Sfx.play('die');

    // Burst where the player was (clamped to the screen for pits).
    const bx = p.x + p.w / 2;
    const by = Math.min(p.y + p.h / 2, this.camera.y + CONFIG.VIEW_H - 8);
    this.particles.burst(bx, by, 26, {
      colors: ['#ff5a5f', '#ff8a8f', '#ffffff', '#ffd23f'],
      speed: cause === 'pit' ? 420 : 300,
      angle: -Math.PI / 2,
      spread: cause === 'pit' ? Math.PI * 0.8 : TAU,
      life: 0.8, size: 7, gravity: 700,
    });
  }

  /** Bring the player back at the last checkpoint. Called by the Game (or directly in tests). */
  respawnPlayer(refillHearts) {
    const p = this.player;
    p.respawn(this.checkpoint);
    if (refillHearts || p.health <= 0) p.health = CONFIG.player.maxHealth;
    p.invulnTimer = CONFIG.death.respawnInvuln;
    this.waitingForRespawn = false;
    this.camera.snapTo(p, this.level);
  }

  // ---------------------------------------------------------------------------
  // Events raised by items
  // ---------------------------------------------------------------------------

  collectCoin(coin) {
    this.stats.coins += 1;
    this.particles.burst(coin.x + coin.w / 2, coin.y + coin.h / 2, 6, {
      colors: ['#fff5bf', '#ffd23f'], speed: 90, life: 0.35, size: 4, gravity: 0, shape: 'circle',
    });
    Sfx.play('coin');
    if (this.hooks.onCoin) this.hooks.onCoin();
  }

  activateCheckpoint(cp) {
    this.checkpoint = cp.spawn;
    this.player.health = CONFIG.player.maxHealth;
    Sfx.play('checkpoint');
    this.popup('CHECKPOINT!', cp.cx, cp.groundY - 76, '#7dffb8');
    this.particles.burst(cp.cx, cp.groundY - 56, 18, {
      colors: ['#2fd08a', '#a7f3d0', '#ffffff', '#ffd23f'], speed: 220, life: 0.8, size: 5, gravity: 400,
    });
  }

  completeLevel(goal) {
    this.complete = true;
    Sfx.play('goal');
    this.popup('LEVEL CLEAR!', goal.cx, goal.groundY - 150, '#ffe17a');
    for (let i = 0; i < 3; i++) {
      this.particles.burst(goal.cx + (i - 1) * 60, goal.groundY - 140 - i * 20, 24, {
        colors: ['#ffd23f', '#ff5a5f', '#5ad1ff', '#7dffb8', '#ffffff'], speed: 260, life: 1.1, size: 5, gravity: 250,
      });
    }
    if (this.hooks.onLevelComplete) this.hooks.onLevelComplete();
  }

  /** Floating text in world space. */
  popup(text, x, y, color = '#ffffff') {
    this.popups.push({ text, x, y, life: 1.2, color });
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  /** Draw entities (the renderer has already set the world transform). */
  draw(ctx, alpha) {
    const t = this.time;
    for (const plat of this.platforms) plat.draw(ctx, alpha, this.theme);
    for (const it of this.items) it.draw(ctx, alpha, t);
    for (const e of this.enemies) e.draw(ctx, alpha);
    if (!this.demo) this.player.draw(ctx, alpha);
    this.particles.draw(ctx, alpha);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 16px ${HUD_FONT}`;
    for (const pop of this.popups) {
      ctx.globalAlpha = Math.min(1, pop.life * 2);
      outlinedText(ctx, pop.text, pop.x, pop.y, pop.color, 4);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  /** Debug overlay: hitboxes. */
  drawDebug(ctx, alpha) {
    const box = (o, color) => {
      ctx.strokeStyle = color;
      ctx.strokeRect(lerp(o.px ?? o.x, o.x, alpha), lerp(o.py ?? o.y, o.y, alpha), o.w, o.h);
    };
    ctx.lineWidth = 1;
    for (const plat of this.platforms) box(plat, '#3aa0ff');
    for (const it of this.items) box(it, '#ffd000');
    for (const e of this.enemies) box(e, '#ff4444');
    box(this.player, '#00ff88');
  }
}
