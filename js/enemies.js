/**
 * Enemies.
 *
 * Every enemy type implements the same small interface, so World can handle
 * collisions with the player generically:
 *
 *   x, y, w, h, px, py   hitbox and its position at the previous step
 *   alive                false once defeated (it may still be animating)
 *   removed              true when World should delete it
 *   stompable            can the player defeat it by landing on it?
 *   update(dt, world)    move / think
 *   draw(ctx, alpha)     render (world transform already applied)
 *   onStomp(world)       the player landed on it
 *   onBump(other)        optional: touched another enemy
 *
 * To add a new enemy: write a class like Walker below, then give it a map
 * character in LEGEND (js/level.js).
 */

/** Walker: patrols back and forth, turning at walls, ledges and spikes. */
class Walker {
  constructor(tx, ty) {
    const T = CONFIG.TILE;
    this.w = 26;
    this.h = 22;
    this.x = tx * T + (T - this.w) / 2;
    this.y = (ty + 1) * T - this.h; // stand on the floor of its tile
    this.px = this.x;
    this.py = this.y;
    this.vx = -CONFIG.enemies.walker.speed; // start walking left
    this.vy = 0;
    this.grounded = false;
    this.alive = true;
    this.removed = false;
    this.stompable = true;
    this.deadTimer = 0;
    this.cfg = CONFIG.enemies.walker;
    this.anim = hash2(tx, ty) * 10; // de-sync walk cycles between walkers
  }

  update(dt, world) {
    this.px = this.x;
    this.py = this.y;
    this.anim += dt;
    if (!this.alive) {
      this.deadTimer -= dt;
      if (this.deadTimer <= 0) this.removed = true;
      return;
    }

    const T = CONFIG.TILE;
    const level = world.level;
    const cfg = this.cfg;

    // Look one pixel ahead of the leading foot: turn around at ledges and
    // before walking into spikes.
    if (this.grounded) {
      const aheadX = this.vx > 0 ? this.x + this.w + 1 : this.x - 1;
      const tx = Math.floor(aheadX / T);
      const floorTy = Math.floor((this.y + this.h + 1) / T);
      const bodyTy = Math.floor((this.y + this.h - 1) / T);
      const floorAhead = level.isSolid(tx, floorTy) || level.isOneWay(tx, floorTy);
      if (!floorAhead || level.isHazard(tx, bodyTy)) this.vx = -this.vx;
    }

    this.vy = Math.min(this.vy + cfg.gravity * dt, cfg.maxFallSpeed);
    if (Physics.moveX(this, this.vx * dt, level)) this.vx = -this.vx;
    const hit = Physics.moveY(this, this.vy * dt, level);
    if (hit.landed || hit.bumped) this.vy = 0;
    this.grounded = hit.landed;
    if (this.y > level.height) this.removed = true;
  }

  onStomp() {
    this.alive = false;
    this.deadTimer = 0.5;
  }

  /** Walk away from another enemy we bumped into. */
  onBump(other) {
    this.vx = Math.abs(this.vx) * (Math.sign(this.x - other.x) || 1);
  }

  draw(ctx, alpha) {
    const x = lerp(this.px, this.x, alpha);
    const y = lerp(this.py, this.y, alpha);
    const cx = x + this.w / 2;
    const bottom = y + this.h;

    if (!this.alive) {
      // Squashed flat, fading away
      ctx.globalAlpha = clamp(this.deadTimer / 0.5, 0, 1);
      ctx.fillStyle = '#6a42a8';
      ctx.beginPath();
      roundRectPath(ctx, cx - 16, bottom - 7, 32, 7, 3);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx - 7, bottom - 5, 4, 1.5);
      ctx.fillRect(cx + 3, bottom - 5, 4, 1.5);
      ctx.globalAlpha = 1;
      return;
    }

    const dir = this.vx >= 0 ? 1 : -1;
    const cycle = this.anim * 11;
    const bob = Math.abs(Math.sin(cycle)) * 1.5;

    // Feet (alternating)
    ctx.fillStyle = '#3d2560';
    const stride = Math.sin(cycle) * 3;
    ctx.beginPath();
    roundRectPath(ctx, cx - 10 + stride, bottom - 5, 8, 5, 2);
    roundRectPath(ctx, cx + 2 - stride, bottom - 5, 8, 5, 2);
    ctx.fill();

    // Body
    const top = y + bob;
    ctx.fillStyle = '#8e5ad6';
    ctx.beginPath();
    roundRectPath(ctx, x, top, this.w, this.h - 3 - bob, 10);
    ctx.fill();
    ctx.fillStyle = '#b58cf0'; // belly highlight
    ctx.beginPath();
    roundRectPath(ctx, cx - 7, top + 11, 14, 6, 3);
    ctx.fill();

    // Eyes look where it's walking, with grumpy brows
    const ex = cx + dir * 4;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(ex - 4.5, top + 7, 3.4, 4, 0, 0, TAU);
    ctx.ellipse(ex + 4.5, top + 7, 3.4, 4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1d1430';
    ctx.beginPath();
    ctx.arc(ex - 4.5 + dir * 1.4, top + 7.8, 1.8, 0, TAU);
    ctx.arc(ex + 4.5 + dir * 1.4, top + 7.8, 1.8, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#1d1430';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(ex - 8, top + 2);
    ctx.lineTo(ex - 2, top + 4);
    ctx.moveTo(ex + 8, top + 2);
    ctx.lineTo(ex + 2, top + 4);
    ctx.stroke();
  }
}

/**
 * Spiker: walks like a Walker but its back is covered in spikes, so landing
 * on it hurts. Jump over it, or lure it somewhere else.
 */
class Spiker extends Walker {
  constructor(tx, ty) {
    super(tx, ty);
    this.cfg = CONFIG.enemies.spiker;
    this.vx = -this.cfg.speed;
    this.stompable = false;
  }

  draw(ctx, alpha) {
    const x = lerp(this.px, this.x, alpha);
    const y = lerp(this.py, this.y, alpha);
    const cx = x + this.w / 2;
    const bottom = y + this.h;

    if (!this.alive) { // only possible if something else defeated it
      ctx.globalAlpha = clamp(this.deadTimer / 0.5, 0, 1);
      ctx.fillStyle = '#8c3b2f';
      ctx.beginPath();
      roundRectPath(ctx, cx - 16, bottom - 7, 32, 7, 3);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    const dir = this.vx >= 0 ? 1 : -1;
    const cycle = this.anim * 12;
    const stride = Math.sin(cycle) * 3;

    ctx.fillStyle = '#5e241c';
    ctx.beginPath();
    roundRectPath(ctx, cx - 10 + stride, bottom - 5, 8, 5, 2);
    roundRectPath(ctx, cx + 2 - stride, bottom - 5, 8, 5, 2);
    ctx.fill();

    // Spiky back
    ctx.fillStyle = '#f2f5fa';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const sx = x + 2 + i * 6;
      ctx.moveTo(sx, y + 7);
      ctx.lineTo(sx + 3, y - 4);
      ctx.lineTo(sx + 6, y + 7);
      ctx.closePath();
    }
    ctx.fill();

    ctx.fillStyle = '#d4533f';
    ctx.beginPath();
    roundRectPath(ctx, x, y + 4, this.w, this.h - 7, 9);
    ctx.fill();
    ctx.fillStyle = '#f0876a'; // belly highlight
    ctx.beginPath();
    roundRectPath(ctx, cx - 7, y + 13, 14, 5, 3);
    ctx.fill();

    const ex = cx + dir * 4;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(ex - 4.5, y + 11, 3.2, 3.8, 0, 0, TAU);
    ctx.ellipse(ex + 4.5, y + 11, 3.2, 3.8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2b1410';
    ctx.beginPath();
    ctx.arc(ex - 4.5 + dir * 1.3, y + 11.6, 1.7, 0, TAU);
    ctx.arc(ex + 4.5 + dir * 1.3, y + 11.6, 1.7, 0, TAU);
    ctx.fill();
  }
}

/**
 * Flyer: drifts back and forth through the air on a sine path, ignoring
 * gravity and the level geometry. Stompable, but you have to meet it midair.
 */
class Flyer {
  constructor(tx, ty) {
    const T = CONFIG.TILE;
    const cfg = CONFIG.enemies.flyer;
    this.w = 24;
    this.h = 20;
    this.homeX = tx * T + (T - this.w) / 2;
    this.homeY = ty * T + (T - this.h) / 2;
    this.range = cfg.range * T;
    this.bob = cfg.bob;
    this.rate = cfg.rate;
    this.t = hash2(tx, ty) * 10;
    this.x = this.homeX;
    this.y = this.homeY;
    this.px = this.x;
    this.py = this.y;
    this.alive = true;
    this.removed = false;
    this.stompable = true;
    this.deadTimer = 0;
    this.vy = 0;
  }

  update(dt) {
    this.px = this.x;
    this.py = this.y;
    this.t += dt;
    if (!this.alive) { // drop out of the sky when defeated
      this.vy += 1400 * dt;
      this.y += this.vy * dt;
      this.deadTimer -= dt;
      if (this.deadTimer <= 0) this.removed = true;
      return;
    }
    this.x = this.homeX + Math.sin(this.t * this.rate) * this.range;
    this.y = this.homeY + Math.sin(this.t * this.rate * 1.9) * this.bob;
  }

  onStomp() {
    this.alive = false;
    this.deadTimer = 0.8;
    this.vy = -120;
  }

  draw(ctx, alpha) {
    const x = lerp(this.px, this.x, alpha);
    const y = lerp(this.py, this.y, alpha);
    const cx = x + this.w / 2;
    const cy = y + this.h / 2;
    const dir = this.x >= this.px ? 1 : -1;
    const flap = Math.sin(this.t * 14) * (this.alive ? 1 : 0.2);

    ctx.globalAlpha = this.alive ? 1 : clamp(this.deadTimer / 0.8, 0, 1);
    // Wings
    ctx.fillStyle = '#5ad1ff';
    ctx.beginPath();
    ctx.ellipse(cx - 12, cy - flap * 5, 9, 5, -0.5 * flap, 0, TAU);
    ctx.ellipse(cx + 12, cy - flap * 5, 9, 5, 0.5 * flap, 0, TAU);
    ctx.fill();
    // Body
    ctx.fillStyle = '#2f9fd6';
    ctx.beginPath();
    ctx.ellipse(cx, cy, this.w / 2, this.h / 2, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#8fe3ff';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 3, this.w / 3, this.h / 4, 0, 0, TAU);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(cx + dir * 3 - 3.5, cy - 2, 3, 3.5, 0, 0, TAU);
    ctx.ellipse(cx + dir * 3 + 3.5, cy - 2, 3, 3.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0f2b3d';
    ctx.beginPath();
    ctx.arc(cx + dir * 4 - 3.5, cy - 1.6, 1.6, 0, TAU);
    ctx.arc(cx + dir * 4 + 3.5, cy - 1.6, 1.6, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
