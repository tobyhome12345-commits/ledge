/**
 * Camera: follows a target (normally the player) and stays inside the level.
 *
 * - Horizontal: eases toward the target plus a "look-ahead" in the direction
 *   the target faces, so you can see what's coming.
 * - Vertical: "platform snapping" - re-centres on the target's feet while it
 *   stands on something, but ignores ordinary jumps (a dead zone), so the
 *   screen doesn't bob up and down every hop.
 * - Keeps the previous position so rendering can interpolate between steps.
 *
 * A target is any object with {x, y, w, h} plus optional {vx, facing, grounded}.
 */
class Camera {
  constructor() {
    this.x = 0;       // top-left corner, world pixels
    this.y = 0;
    this.px = 0;      // position at the previous physics step
    this.py = 0;
    this.lookX = 0;   // current look-ahead offset
    this.focusY = 0;  // world y kept at `focusRatio` of the screen height
    this.shakeMag = 0;
    this.shakeTime = 0;
    this.shakeDuration = 1;
  }

  /** Jump straight to the target with no easing (level start, respawn). */
  snapTo(target, level) {
    this.lookX = (target.facing || 0) * CONFIG.camera.lookAhead * 0.4;
    this.focusY = target.y + target.h;
    const goal = this.goalFor(target);
    this.x = goal.x;
    this.y = goal.y;
    this.clampTo(level);
    this.px = this.x;
    this.py = this.y;
  }

  update(dt, target, level) {
    const c = CONFIG.camera;
    this.px = this.x;
    this.py = this.y;

    // Look ahead in the facing direction (only partly while standing still).
    const moving = Math.abs(target.vx || 0) > 20;
    const wantLook = (target.facing || 0) * c.lookAhead * (moving ? 1 : 0.4);
    this.lookX += (wantLook - this.lookX) * damp(c.lookRate, dt);

    // Vertical focus: follow the feet when grounded, otherwise only when the
    // target leaves the dead zone (long falls, climbs, wall-jumps).
    const feet = target.y + target.h;
    if (target.grounded) this.focusY = feet;
    else if (feet < this.focusY - c.deadZoneUp) this.focusY = feet + c.deadZoneUp;
    else if (feet > this.focusY + c.deadZoneDown) this.focusY = feet - c.deadZoneDown;

    const goal = this.goalFor(target);
    this.x += (goal.x - this.x) * damp(c.followRate, dt);
    this.y += (goal.y - this.y) * damp(c.followRateY, dt);
    this.clampTo(level);

    if (this.shakeTime > 0) this.shakeTime -= dt;
  }

  goalFor(target) {
    return {
      x: target.x + target.w / 2 + this.lookX - CONFIG.VIEW_W / 2,
      y: this.focusY - CONFIG.VIEW_H * CONFIG.camera.focusRatio,
    };
  }

  clampTo(level) {
    const maxX = level.width - CONFIG.VIEW_W;
    const maxY = level.height - CONFIG.VIEW_H;
    // Levels smaller than the screen are centred.
    this.x = maxX > 0 ? clamp(this.x, 0, maxX) : maxX / 2;
    this.y = maxY > 0 ? clamp(this.y, 0, maxY) : maxY / 2;
  }

  /** Start a screen shake (a stronger shake overrides a weaker one). */
  shake(magnitude, duration = 0.3) {
    const current = this.shakeTime > 0 ? this.shakeMag * (this.shakeTime / this.shakeDuration) : 0;
    if (magnitude < current) return;
    this.shakeMag = magnitude;
    this.shakeTime = duration;
    this.shakeDuration = duration;
  }

  /** Interpolated (and shaken) view position for rendering. */
  view(alpha, time, level) {
    let x = lerp(this.px, this.x, alpha);
    let y = lerp(this.py, this.y, alpha);
    if (this.shakeTime > 0) {
      const k = this.shakeTime / this.shakeDuration;
      const m = this.shakeMag * k * k;
      x += Math.sin(time * 91.7) * m;
      y += Math.cos(time * 73.3) * m;
      // Don't let the shake reveal the void past the level edges.
      x = clamp(x, Math.min(0, this.x), Math.max(this.x, level.width - CONFIG.VIEW_W));
      y = clamp(y, Math.min(0, this.y), Math.max(this.y, level.height - CONFIG.VIEW_H));
    }
    return { x, y };
  }
}
