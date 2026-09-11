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
    const cfg = CONFIG.enemies.walker;

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
