/**
 * World: the live state of one level being played - tiles, camera, player
 * and (as the game grows) enemies, items and effects.
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

    // Let every map character with a spawn() create its entity.
    for (const s of this.level.spawns) s.spawn(this, s.tx, s.ty);

    this.player = new Player(this.start.x - CONFIG.player.width / 2, this.start.y - CONFIG.player.height);
    this.camera.snapTo(this.player, this.level);
  }

  /** Called by the 'P' legend entry. Stored as the bottom-centre of the tile. */
  setPlayerStart(tx, ty) {
    const T = CONFIG.TILE;
    this.start = { x: tx * T + T / 2, y: (ty + 1) * T };
  }

  update(dt, input) {
    this.time += dt;
    const p = this.player;
    p.update(dt, input, this);

    // Temporary until checkpoints exist: falling out of the level resets you.
    if (p.y > this.level.height) {
      p.x = p.px = this.start.x - p.w / 2;
      p.y = p.py = this.start.y - p.h;
      p.vx = p.vy = 0;
      this.camera.snapTo(p, this.level);
    }

    this.camera.update(dt, p, this.level);
  }

  /** Draw entities (the renderer has already set the world transform). */
  draw(ctx, alpha) {
    this.player.draw(ctx, alpha);
  }

  /** Debug overlay: hitboxes. */
  drawDebug(ctx, alpha) {
    const p = this.player;
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1;
    ctx.strokeRect(lerp(p.px, p.x, alpha), lerp(p.py, p.y, alpha), p.w, p.h);
  }
}
