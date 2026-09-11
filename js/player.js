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
    this.groundType = null;   // what we're standing on: 'solid' | 'oneway' | 'platform'
    this.platform = null;     // the moving platform we're riding, if any
    this.coyoteTimer = 0;     // > 0: a ground jump is still allowed
    this.jumpBufferTimer = 0; // > 0: a jump was requested recently
    this.jumpCuttable = false; // true while rising from a jump (releasing jump shortens it)
    this.dropTimer = 0;       // > 0: deliberately falling through one-way platforms
    this.health = c.maxHealth;
    this.invulnTimer = 0;     // > 0: recently hurt, can't be hurt again (blinks)
    this.stunTimer = 0;       // > 0: knocked back, controls ignored
  }

  /** Put the player back at a spawn point (bottom-centre) in a clean state. */
  respawn(spawn) {
    this.x = this.px = spawn.x - this.w / 2;
    this.y = this.py = spawn.y - this.h;
    this.vx = this.vy = 0;
    this.grounded = false;
    this.platform = null;
    this.coyoteTimer = this.jumpBufferTimer = this.dropTimer = this.stunTimer = 0;
    this.jumpCuttable = false;
  }

  update(dt, input, world) {
    const c = CONFIG.player;
    const level = world.level;
    this.px = this.x;
    this.py = this.y;

    this.coyoteTimer -= dt;
    this.jumpBufferTimer -= dt;
    this.dropTimer -= dt;
    this.invulnTimer -= dt;
    this.stunTimer -= dt;

    // --- Input (ignored while stunned by a hit)
    const stunned = this.stunTimer > 0;
    const move = stunned ? 0 : (input.held('right') ? 1 : 0) - (input.held('left') ? 1 : 0);
    const jumpHeld = !stunned && input.held('jump');
    if (!stunned && input.pressed('jump')) this.jumpBufferTimer = c.jumpBufferTime;

    // --- Horizontal: accelerate toward the target speed (knockback keeps its momentum)
    if (!stunned) {
      const target = move * c.maxRunSpeed;
      const turning = move !== 0 && this.vx * move < 0;
      let accel;
      if (this.grounded) accel = move === 0 ? c.groundDecel : turning ? c.turnAccel : c.groundAccel;
      else accel = move === 0 ? c.airDecel : turning ? c.airTurnAccel : c.airAccel;
      this.vx = approach(this.vx, target, accel * dt);
      if (move !== 0) this.facing = move;
    }

    // --- Jump: standing on the ground keeps coyote time topped up, and a
    // buffered press fires as soon as a jump is allowed. Down + jump on a
    // one-way platform drops through it instead.
    if (this.grounded) this.coyoteTimer = c.coyoteTime;
    if (this.jumpBufferTimer > 0 && this.grounded && input.held('down') && this.groundType !== 'solid') {
      this.dropThrough();
    } else if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.jump();
    }

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

    // --- Ride the moving platform we're standing on (it already moved this step)
    const prevBottom = this.y + this.h;
    if (this.platform) {
      Physics.moveX(this, this.platform.dx, level);
      Physics.moveY(this, this.platform.dy, level, true);
    }

    // --- Collide: X first, then Y
    const dropping = this.dropTimer > 0;
    if (dy < 0) this.cornerCorrect(level, dy);
    if (Physics.moveX(this, this.vx * dt, level)) this.vx = 0;
    const hit = Physics.moveY(this, dy, level, dropping);
    if (hit.bumped) this.vy = 0;

    // Moving platforms work like one-way tiles: land on them only if our feet
    // were above their top at the start of this step.
    let platform = null;
    if (!hit.landed && this.vy >= 0 && !dropping) {
      for (const p of world.platforms) {
        if (this.x + this.w > p.x && this.x < p.x + p.w &&
            prevBottom <= p.py + 1 && this.y + this.h >= p.y) {
          this.y = p.y - this.h;
          platform = p;
          break;
        }
      }
    }

    const landed = hit.landed || platform !== null;
    if (landed) {
      this.vy = 0;
      this.jumpCuttable = false;
    }
    // Walking off a moving platform keeps its momentum instead of stopping dead.
    if (this.platform && !platform) this.vx += this.platform.vx;
    this.platform = platform;
    this.grounded = landed;
    this.groundType = platform ? 'platform' : hit.ground;
  }

  jump() {
    this.vy = -CONFIG.player.jumpVelocity;
    // Jumping off a moving platform adds its velocity (an elevator gives a boost).
    if (this.platform) {
      this.vx += this.platform.vx;
      this.vy += Math.min(0, this.platform.vy);
    }
    this.platform = null;
    this.grounded = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.jumpCuttable = true;
  }

  /** Fall through the one-way platform we're standing on. */
  dropThrough() {
    this.dropTimer = 0.1;
    this.jumpBufferTimer = 0;
    this.coyoteTimer = 0;
    this.grounded = false;
    this.platform = null;
  }

  /** Bounce off an enemy we stomped. Holding jump bounces higher (variable jump applies). */
  bounce() {
    this.vy = -CONFIG.player.stompBounce;
    this.grounded = false;
    this.platform = null;
    this.coyoteTimer = 0;
    this.jumpCuttable = true;
  }

  /** Took a hit (health already reduced by World): get knocked away from the source. */
  knockback(fromX) {
    const c = CONFIG.player;
    const dir = Math.sign(this.x + this.w / 2 - fromX) || -this.facing;
    this.vx = dir * c.hurtKnockbackX;
    this.vy = -c.hurtKnockbackY;
    this.grounded = false;
    this.platform = null;
    this.jumpCuttable = false;
    this.invulnTimer = c.invulnTime;
    this.stunTimer = c.hurtStunTime;
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
    // Blink while invulnerable
    if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 12) % 2 === 0) return;
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
