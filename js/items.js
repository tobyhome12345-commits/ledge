/**
 * Items: things the player touches - coins now, checkpoints and the goal flag
 * later, power-ups in future.
 *
 * Every item implements:
 *   x, y, w, h                trigger box (world pixels)
 *   removed                   true when World should delete it
 *   update(dt, world)         animate
 *   draw(ctx, alpha, time)    render (world transform already applied)
 *   onTouch(world)            the player overlapped the trigger box
 *
 * To add a new item: write a class here and give it a map character in
 * LEGEND (js/level.js).
 */

/** Coin: spins and bobs; collected on touch. */
class Coin {
  constructor(tx, ty) {
    const T = CONFIG.TILE;
    this.w = 16;
    this.h = 16;
    this.x = tx * T + (T - this.w) / 2;
    this.y = ty * T + (T - this.h) / 2;
    this.phase = hash2(tx, ty) * TAU; // so coins don't all spin in lockstep
    this.removed = false;
  }

  update() {}

  onTouch(world) {
    this.removed = true;
    world.collectCoin(this);
  }

  draw(ctx, alpha, time) {
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2 + Math.sin(time * 3 + this.phase) * 2;
    const spin = Math.cos(time * 4 + this.phase); // -1..1: the coin's facing
    const rx = Math.max(1.5, 8 * Math.abs(spin));

    ctx.fillStyle = '#c4830b'; // rim
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, 8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = spin > 0 ? '#ffd23f' : '#f2b705'; // face (back side darker)
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(0.6, rx - 1.8), 6.2, 0, 0, TAU);
    ctx.fill();
    if (rx > 4) { // glint
      ctx.fillStyle = '#fff5bf';
      ctx.fillRect(cx - rx * 0.4, cy - 4, Math.max(1, rx * 0.22), 7);
    }
  }
}
