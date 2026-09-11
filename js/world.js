/**
 * World: the live state of one level being played - tiles, camera, player,
 * moving platforms, enemies and (as the game grows) items and effects.
 */
class World {
  constructor(levelData) {
    const T = CONFIG.TILE;
    this.data = levelData;
    this.level = new Level(levelData);
    this.theme = THEMES[levelData.theme] || THEMES.meadow;
    this.camera = new Camera();
    this.time = 0;
    this.start = { x: 2 * T, y: this.level.height - 4 * T }; // overwritten by a 'P' tile
    this.platforms = (levelData.movers || []).map((def) => new MovingPlatform(def));
    this.enemies = [];
    this.items = [];

    // Let every map character with a spawn() create its entity.
    for (const s of this.level.spawns) s.spawn(this, s.tx, s.ty);

    this.stats = {
      coins: 0,
      totalCoins: this.items.filter((it) => it instanceof Coin).length,
    };

    this.player = new Player(this.start.x - CONFIG.player.width / 2, this.start.y - CONFIG.player.height);
    this.camera.snapTo(this.player, this.level);
  }

  // --- Spawn hooks used by LEGEND entries (js/level.js)

  /** Stored as the bottom-centre of the tile. */
  setPlayerStart(tx, ty) {
    const T = CONFIG.TILE;
    this.start = { x: tx * T + T / 2, y: (ty + 1) * T };
  }

  addEnemy(enemy) { this.enemies.push(enemy); }
  addItem(item) { this.items.push(item); }

  // --- Events raised by entities

  collectCoin() {
    this.stats.coins += 1;
  }

  // --- Simulation

  update(dt, input) {
    this.time += dt;
    // Platforms move first so riders can be carried by this step's motion.
    for (const plat of this.platforms) plat.update(dt);

    const p = this.player;
    p.update(dt, input, this);

    for (const e of this.enemies) e.update(dt, this);
    this.bumpEnemies();
    this.checkEnemyContacts();
    this.enemies = this.enemies.filter((e) => !e.removed);

    for (const it of this.items) {
      it.update(dt, this);
      if (!it.removed && overlaps(p, it)) it.onTouch(this);
    }
    this.items = this.items.filter((it) => !it.removed);

    // Temporary until checkpoints exist: falling out of the level restarts you.
    if (p.y > this.level.height) this.killPlayer();

    this.camera.update(dt, p, this.level);
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
      }
    }
    // A stomp wins over any side contact in the same step.
    if (stomped) p.bounce();
    else this.hurtPlayer(touching[0].x + touching[0].w / 2);
  }

  /** Lose a heart and get knocked back (ignored while invulnerable). */
  hurtPlayer(fromX) {
    const p = this.player;
    if (p.invulnTimer > 0) return;
    p.health -= 1;
    if (p.health <= 0) this.killPlayer();
    else p.knockback(fromX);
  }

  /** Step 4: dying restarts the level from its start (checkpoints come in step 6). */
  killPlayer() {
    const p = this.player;
    p.respawn(this.start);
    p.health = CONFIG.player.maxHealth;
    this.camera.snapTo(p, this.level);
  }

  // --- Rendering

  /** Draw entities (the renderer has already set the world transform). */
  draw(ctx, alpha) {
    const t = this.time;
    for (const plat of this.platforms) plat.draw(ctx, alpha, this.theme);
    for (const it of this.items) it.draw(ctx, alpha, t);
    for (const e of this.enemies) e.draw(ctx, alpha);
    this.player.draw(ctx, alpha);
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
