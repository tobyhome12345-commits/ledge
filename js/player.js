/**
 * Player: the character you control.
 *
 * Position (x, y) is the top-left of the hitbox; (px, py) is where it was at
 * the previous physics step, used for render interpolation.
 *
 * The movement "feel" tricks, all tunable in CONFIG.player:
 *   - acceleration/deceleration instead of instant velocity changes
 *   - coyote time: jump still works briefly after running off a ledge
 *   - jump buffering: jump pressed just before landing fires on landing
 *   - variable jump height: releasing jump early adds gravity -> short hop
 *   - heavier gravity when falling, lighter at the apex while jump is held
 *   - corner correction: slide past ceiling corners you barely clip
 */
class Player {
  constructor(x, y) {
    const c = CONFIG.player;
    this.w = c.width;
    this.h = c.height;
    this.x = x;
    this.y = y;
    this.px = x;
    this.py = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;          // 1 = right, -1 = left
    this.grounded = false;
    this.coyoteTimer = 0;     // > 0: a ground jump is still allowed
    this.jumpBufferTimer = 0; // > 0: a jump was requested recently
    this.jumpCuttable = false; // true while rising from a jump (releasing jump shortens it)
  }

  update(dt, input, world) {
    const c = CONFIG.player;
    const level = world.level;
    this.px = this.x;
    this.py = this.y;

    this.coyoteTimer -= dt;
    this.jumpBufferTimer -= dt;

    // --- Input
    const move = (input.held('right') ? 1 : 0) - (input.held('left') ? 1 : 0);
    const jumpHeld = input.held('jump');
    if (input.pressed('jump')) this.jumpBufferTimer = c.jumpBufferTime;

    // --- Horizontal: accelerate toward the target speed
    const target = move * c.maxRunSpeed;
    const turning = move !== 0 && this.vx * move < 0;
    let accel;
    if (this.grounded) accel = move === 0 ? c.groundDecel : turning ? c.turnAccel : c.groundAccel;
    else accel = move === 0 ? c.airDecel : turning ? c.airTurnAccel : c.airAccel;
    this.vx = approach(this.vx, target, accel * dt);
    if (move !== 0) this.facing = move;

    // --- Jump: standing on the ground keeps coyote time topped up, and a
    // buffered press fires as soon as a jump is allowed.
    if (this.grounded) this.coyoteTimer = c.coyoteTime;
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) this.jump();

    // --- Gravity
    let g = c.gravity;
    if (this.vy > 0) g *= c.fallGravityMult;
    else if (this.vy < 0 && !jumpHeld && this.jumpCuttable) g *= c.lowJumpGravityMult;
    if (this.jumpCuttable && jumpHeld && Math.abs(this.vy) < c.apexThreshold) g *= c.apexGravityMult;

    // Move by the average of the old and new velocity (trapezoidal
    // integration) so the real jump height matches CONFIG.player.jumpHeight.
    const vyStart = this.vy;
    this.vy = Math.min(this.vy + g * dt, c.maxFallSpeed);
    const dy = ((vyStart + this.vy) / 2) * dt;

    // --- Collide: X first, then Y
    if (dy < 0) this.cornerCorrect(level, dy);
    if (Physics.moveX(this, this.vx * dt, level)) this.vx = 0;
    const hit = Physics.moveY(this, dy, level);
    if (hit.bumped) this.vy = 0;
    if (hit.landed) {
      this.vy = 0;
      this.jumpCuttable = false;
    }
    this.grounded = hit.landed;
  }

  jump() {
    this.vy = -CONFIG.player.jumpVelocity;
    this.grounded = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.jumpCuttable = true;
  }

  /** If moving up by `dy` would clip a ceiling corner by a few pixels, nudge sideways instead. */
  cornerCorrect(level, dy) {
    if (!Physics.boxHitsSolid(level, this.x, this.y + dy, this.w, this.h)) return;
    for (let off = 1; off <= CONFIG.player.cornerCorrection; off++) {
      for (const dir of [1, -1]) {
        const nx = this.x + off * dir;
        if (!Physics.boxHitsSolid(level, nx, this.y + dy, this.w, this.h) &&
            !Physics.boxHitsSolid(level, nx, this.y, this.w, this.h)) {
          this.x = nx;
          return;
        }
      }
    }
  }

  draw(ctx, alpha) {
    const x = lerp(this.px, this.x, alpha);
    const y = lerp(this.py, this.y, alpha);
    ctx.fillStyle = '#ff5a5f';
    ctx.fillRect(x, y, this.w, this.h);
    // Direction indicator: an eye on the side we're facing
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + this.w / 2 + this.facing * 4 - 3, y + 7, 6, 7);
    ctx.fillStyle = '#1d1d2b';
    ctx.fillRect(x + this.w / 2 + this.facing * 6 - 1.5, y + 9, 3, 4);
  }
}
