/**
 * World: the live state of one level being played - tiles, camera and
 * (as the game grows) the player, enemies, items and effects.
 */
class World {
  constructor(levelData) {
    this.data = levelData;
    this.level = new Level(levelData);
    this.theme = THEMES[levelData.theme] || THEMES.meadow;
    this.camera = new Camera();
    this.time = 0;

    // Step 1: a free-flying camera target (arrow keys) to inspect the level.
    this.focus = { x: 3 * CONFIG.TILE, y: this.level.height - 6 * CONFIG.TILE, w: 1, h: 1, vx: 0, facing: 1, grounded: true };
    this.camera.snapTo(this.focus, this.level);
  }

  update(dt, input) {
    this.time += dt;
    const speed = 700;
    const f = this.focus;
    const dx = (input.held('right') ? 1 : 0) - (input.held('left') ? 1 : 0);
    const dy = (input.held('down') ? 1 : 0) - (input.held('jump') ? 1 : 0);
    f.vx = dx * speed;
    if (dx) f.facing = dx;
    f.x = clamp(f.x + dx * speed * dt, 0, this.level.width);
    f.y = clamp(f.y + dy * speed * dt, 0, this.level.height);
    this.camera.update(dt, f, this.level);
  }

  /** Draw entities (world transform is already set by the renderer). */
  draw(ctx) {
    const f = this.focus;
    ctx.strokeStyle = '#ff3366';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(f.x - 10, f.y); ctx.lineTo(f.x + 10, f.y);
    ctx.moveTo(f.x, f.y - 10); ctx.lineTo(f.x, f.y + 10);
    ctx.stroke();
  }
}
