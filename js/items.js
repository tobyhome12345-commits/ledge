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

/**
 * Checkpoint: a flag pole. Touching it raises the flag, makes it your respawn
 * point and refills your hearts. Place 'C' on the empty tile above the ground.
 */
class Checkpoint {
  constructor(tx, ty) {
    const T = CONFIG.TILE;
    this.cx = tx * T + T / 2;
    this.groundY = (ty + 1) * T;
    this.spawn = { x: this.cx, y: this.groundY }; // respawn point (bottom-centre)
    this.x = this.cx - 10;                          // trigger: the whole pole
    this.y = this.groundY - 64;
    this.w = 20;
    this.h = 64;
    this.active = false;
    this.raise = 0; // 0 -> 1 flag-raising animation
    this.removed = false;
  }

  update(dt) {
    if (this.active) this.raise = Math.min(1, this.raise + dt * 2.2);
  }

  onTouch(world) {
    if (this.active) return;
    this.active = true;
    world.activateCheckpoint(this);
  }

  draw(ctx, alpha, time) {
    const { cx, groundY } = this;
    // Base and pole
    ctx.fillStyle = '#5b6472';
    ctx.beginPath();
    roundRectPath(ctx, cx - 9, groundY - 7, 18, 7, 2);
    ctx.fill();
    ctx.fillStyle = '#e8ebf0';
    ctx.fillRect(cx - 2, groundY - 60, 4, 54);
    ctx.fillStyle = '#b9c0cc';
    ctx.fillRect(cx, groundY - 60, 2, 54);
    ctx.fillStyle = this.active ? '#ffd23f' : '#9aa1ad';
    ctx.beginPath();
    ctx.arc(cx, groundY - 62, 4, 0, TAU);
    ctx.fill();

    // Flag: droops near the bottom until activated, then springs to the top.
    const k = this.raise;
    const ease = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2); // easeOutBack
    const fy = lerp(groundY - 24, groundY - 58, ease);
    const wave = this.active ? Math.sin(time * 7) * 2.5 : 0;
    ctx.fillStyle = this.active ? '#2fd08a' : '#8a919d';
    ctx.beginPath();
    ctx.moveTo(cx + 2, fy);
    ctx.quadraticCurveTo(cx + 14, fy + 2 + wave, cx + 27, fy + 8 + wave);
    ctx.quadraticCurveTo(cx + 14, fy + 12 - wave, cx + 2, fy + 16);
    ctx.closePath();
    ctx.fill();
    if (this.active) {
      ctx.fillStyle = '#a7f3d0';
      ctx.fillRect(cx + 4, fy + 6, 10, 3);
    }
  }
}

/** Goal: the big flag at the end of the level. Touch it to clear the level. */
class Goal {
  constructor(tx, ty) {
    const T = CONFIG.TILE;
    this.cx = tx * T + T / 2;
    this.groundY = (ty + 1) * T;
    this.x = this.cx - 10; // trigger: the whole (tall) pole
    this.y = this.groundY - 4 * T;
    this.w = 20;
    this.h = 4 * T;
    this.reached = false;
    this.removed = false;
  }

  update() {}

  onTouch(world) {
    if (this.reached) return;
    this.reached = true;
    world.completeLevel(this);
  }

  draw(ctx, alpha, time) {
    const { cx, groundY } = this;
    const top = groundY - 4 * CONFIG.TILE + 8;
    // Base and pole
    ctx.fillStyle = '#5b6472';
    ctx.beginPath();
    roundRectPath(ctx, cx - 12, groundY - 10, 24, 10, 3);
    ctx.fill();
    ctx.fillStyle = '#f1f3f7';
    ctx.fillRect(cx - 2.5, top, 5, groundY - 10 - top);
    ctx.fillStyle = '#c3c9d4';
    ctx.fillRect(cx, top, 2.5, groundY - 10 - top);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(cx, top - 3, 6, 0, TAU);
    ctx.fill();

    // Waving checkered flag, drawn as thin vertical strips offset by a sine wave
    const cols = 8;
    const rows = 4;
    const cw = 5;
    const ch = 6;
    for (let i = 0; i < cols; i++) {
      const off = Math.sin(time * 6 - i * 0.7) * (i / cols) * 4;
      for (let j = 0; j < rows; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? '#1f2433' : '#ffffff';
        ctx.fillRect(cx + 2.5 + i * cw, top + 4 + j * ch + off, cw + 0.4, ch + 0.4);
      }
    }
  }
}
