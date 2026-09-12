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
 *   - squash and stretch when jumping and landing
 *   - optional wall slide / wall jump and double jump (toggles in CONFIG)
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
    this.groundType = null;   // what we are standing on: 'solid' | 'oneway' | 'platform'
    this.platform = null;     // the moving platform we are riding, if any
    this.coyoteTimer = 0;     // > 0: a ground jump is still allowed
    this.jumpBufferTimer = 0; // > 0: a jump was requested recently
    this.jumpCuttable = false; // true while rising from a jump (releasing jump shortens it)
    this.dropTimer = 0;       // > 0: deliberately falling through one-way platforms
    this.health = c.maxHealth;
    this.invulnTimer = 0;     // > 0: recently hurt, cannot be hurt again (blinks)
    this.stunTimer = 0;       // > 0: knocked back, controls ignored
    this.dead = false;        // true during the death/respawn sequence

    // Wall interaction (used when CONFIG.player.wallJump is on)
    this.wallDir = 0;         // -1 wall on the left, 1 on the right, 0 none
    this.lastWallDir = 0;
    this.wallCoyoteTimer = 0;
    this.wallLockTimer = 0;   // > 0: steering disabled right after a wall jump
    this.wallSliding = false;
    this.airJumps = 0;        // double jumps left

    // Visuals
    this.scaleX = 1;
    this.scaleY = 1;
    this.runPhase = 0;
    this.blinkTimer = 2 + Math.random() * 3;
  }

  /** Put the player back at a spawn point (bottom-centre) in a clean state. */
  respawn(spawn) {
    this.x = this.px = spawn.x - this.w / 2;
    this.y = this.py = spawn.y - this.h;
    this.vx = this.vy = 0;
    this.grounded = false;
    this.platform = null;
    this.coyoteTimer = this.jumpBufferTimer = this.dropTimer = this.stunTimer = 0;
    this.wallDir = this.wallCoyoteTimer = this.wallLockTimer = 0;
    this.jumpCuttable = false;
    this.wallSliding = false;
    this.dead = false;
    this.scaleX = this.scaleY = 1;
  }

  update(dt, input, world) {
    const c = CONFIG.player;
    const level = world.level;
    this.px = this.x;
    this.py = this.y;
    // Squash and stretch always ease back to normal
    this.scaleX += (1 - this.scaleX) * damp(c.squashRate, dt);
    this.scaleY += (1 - this.scaleY) * damp(c.squashRate, dt);
    if (this.dead) return;

    this.coyoteTimer -= dt;
    this.jumpBufferTimer -= dt;
    this.dropTimer -= dt;
    this.invulnTimer -= dt;
    this.stunTimer -= dt;
    this.wallCoyoteTimer -= dt;
    this.wallLockTimer -= dt;
    this.blinkTimer -= dt;
    if (this.blinkTimer < -0.12) this.blinkTimer = 2 + Math.random() * 3;
    this.runPhase += Math.abs(this.vx) * dt * 0.07;

    // --- Input (ignored while stunned by a hit)
    const stunned = this.stunTimer > 0;
    const move = stunned ? 0 : (input.held('right') ? 1 : 0) - (input.held('left') ? 1 : 0);
    const jumpHeld = !stunned && input.held('jump');
    if (!stunned && input.pressed('jump')) this.jumpBufferTimer = c.jumpBufferTime;

    // --- Horizontal: accelerate toward the target speed. Knockback and wall
    // jumps skip this so their momentum reads clearly.
    if (!stunned && this.wallLockTimer <= 0) {
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
    if (this.grounded) {
      this.coyoteTimer = c.coyoteTime;
      this.airJumps = c.doubleJump ? 1 : 0;
    }
    if (this.jumpBufferTimer > 0 && !stunned) {
      if (this.grounded && input.held('down') && this.groundType !== 'solid') this.dropThrough();
      else if (this.coyoteTimer > 0) this.jump(world);
      else if (c.wallJump && (this.wallDir !== 0 || this.wallCoyoteTimer > 0)) {
        this.wallJump(world, this.wallDir || this.lastWallDir);
      } else if (this.airJumps > 0) this.airJump(world);
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

    // Hugging a wall while falling slows the descent to a slide
    this.wallSliding = c.wallJump && !this.grounded && this.wallDir !== 0 && move === this.wallDir && this.vy > 0;
    if (this.wallSliding) {
      this.vy = Math.max(c.wallSlideSpeed, this.vy - 2600 * dt);
      if (Math.random() < 0.3) {
        world.particles.burst(this.x + (this.wallDir > 0 ? this.w : 0), this.y + this.h * 0.7, 1, {
          colors: ['#e8e2d4'], speed: 30, life: 0.3, size: 3, gravity: 140,
        });
      }
    }
    const dy = ((vyStart + this.vy) / 2) * dt;

    // --- Ride the moving platform we are standing on (it already moved this step)
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
    if (landed && !this.grounded) this.onLand(world, this.vy);
    if (landed) {
      this.vy = 0;
      this.jumpCuttable = false;
    }
    // Walking off a moving platform keeps its momentum instead of stopping dead.
    if (this.platform && !platform) this.vx += this.platform.vx;
    this.platform = platform;
    this.grounded = landed;
    this.groundType = platform ? 'platform' : hit.ground;

    // --- Wall contact, checked after moving (used by the next step)
    this.wallDir = 0;
    if (c.wallJump && !this.grounded) {
      if (this.touchingWall(level, -1)) this.wallDir = -1;
      else if (this.touchingWall(level, 1)) this.wallDir = 1;
    }
    if (this.wallDir !== 0) {
      this.wallCoyoteTimer = c.wallCoyoteTime;
      this.lastWallDir = this.wallDir;
    }
  }

  /** Is there a solid wall right next to us on this side? */
  touchingWall(level, dir) {
    const x = dir < 0 ? this.x - 1 : this.x + this.w;
    return Physics.boxHitsSolid(level, x, this.y + 4, 1, this.h - 8);
  }

  jump(world) {
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
    this.stretch(0.74, 1.28);
    world.particles.burst(this.x + this.w / 2, this.y + this.h, 6, {
      colors: ['#e8e2d4', '#ffffff'], speed: 90, angle: Math.PI / 2, spread: Math.PI, life: 0.3, size: 4, gravity: 200,
    });
    Sfx.play('jump');
  }

  /** Kick off a wall, away from it. Steering locks briefly so the push reads. */
  wallJump(world, dir) {
    const c = CONFIG.player;
    this.vx = -dir * c.wallJumpVX;
    this.vy = -c.wallJumpVY;
    this.facing = -dir;
    this.wallLockTimer = c.wallJumpLock;
    this.wallCoyoteTimer = 0;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.jumpCuttable = true;
    this.grounded = false;
    if (c.doubleJump) this.airJumps = 1;
    this.stretch(0.8, 1.2);
    world.particles.burst(this.x + (dir > 0 ? this.w : 0), this.y + this.h * 0.6, 8, {
      colors: ['#e8e2d4', '#ffffff'], speed: 150, angle: dir > 0 ? Math.PI : 0, spread: Math.PI * 0.7, life: 0.35, size: 4, gravity: 200,
    });
    Sfx.play('jump');
  }

  airJump(world) {
    this.vy = -CONFIG.player.doubleJumpVelocity;
    this.airJumps -= 1;
    this.jumpBufferTimer = 0;
    this.jumpCuttable = true;
    this.stretch(0.7, 1.3);
    world.particles.burst(this.x + this.w / 2, this.y + this.h, 10, {
      colors: ['#bfe6ff', '#ffffff'], speed: 130, angle: Math.PI / 2, spread: Math.PI * 1.4, life: 0.35, size: 4, gravity: 120,
    });
    Sfx.play('doubleJump');
  }

  /** Landing: squash in proportion to the impact, plus dust and a thud. */
  onLand(world, impact) {
    const k = clamp(impact / CONFIG.player.maxFallSpeed, 0, 1);
    this.stretch(1 + 0.35 * k, 1 - 0.32 * k);
    if (k > 0.25) {
      world.particles.burst(this.x + this.w / 2, this.y + this.h, Math.round(3 + k * 8), {
        colors: ['#e8e2d4', '#ffffff'], speed: 60 + k * 120, angle: -Math.PI / 2, spread: Math.PI, life: 0.3, size: 4, gravity: 400,
      });
      Sfx.play('land');
    }
  }

  stretch(sx, sy) {
    this.scaleX = sx;
    this.scaleY = sy;
  }

  /** Fall through the one-way platform we are standing on. */
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
    if (CONFIG.player.doubleJump) this.airJumps = 1;
    this.stretch(0.75, 1.25);
    Sfx.play('stomp');
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
    this.stretch(1.2, 0.85);
    Sfx.play('hurt');
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
    if (this.dead) return;
    // Blink while invulnerable
    if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 12) % 2 === 0) return;
    const x = lerp(this.px, this.x, alpha);
    const y = lerp(this.py, this.y, alpha);
    drawHero(ctx, x + this.w / 2, y + this.h, this.facing, {
      scaleX: this.scaleX,
      scaleY: this.scaleY,
      run: this.grounded && Math.abs(this.vx) > 20 ? this.runPhase : 0,
      airborne: !this.grounded,
      wallSliding: this.wallSliding,
      blink: this.blinkTimer < 0,
      falling: this.vy > 120,
    });
  }
}

/**
 * Draw the hero with its feet at (cx, bottom). Shared by the Player and the
 * title screen; `o` carries optional animation state.
 */
function drawHero(ctx, cx, bottom, facing, o = {}) {
  const sx = o.scaleX ?? 1;
  const sy = o.scaleY ?? 1;
  const w = CONFIG.player.width * 1.15 * sx;
  const h = CONFIG.player.height * sy;
  const x = cx - w / 2;
  const y = bottom - h;
  const stride = o.run ? Math.sin(o.run * TAU) * 4 : 0;

  // Feet
  ctx.fillStyle = '#c23b47';
  ctx.beginPath();
  if (o.airborne) {
    roundRectPath(ctx, cx - 9, bottom - 5, 8, 5, 2.5);
    roundRectPath(ctx, cx + 1, bottom - 5, 8, 5, 2.5);
  } else {
    roundRectPath(ctx, cx - 9 + stride, bottom - 4, 8, 4, 2);
    roundRectPath(ctx, cx + 1 - stride, bottom - 4, 8, 4, 2);
  }
  ctx.fill();

  // Body
  ctx.fillStyle = '#ff5a5f';
  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h - 2, 8);
  ctx.fill();
  ctx.fillStyle = '#ff8085'; // lighter belly
  ctx.beginPath();
  roundRectPath(ctx, x + 3, y + h * 0.45, w - 6, h * 0.4, 6);
  ctx.fill();

  // Scarf, trailing behind
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  roundRectPath(ctx, x, y + h * 0.3, w, 5, 2.5);
  const tail = o.airborne ? 10 : 5 + Math.abs(stride);
  roundRectPath(ctx, cx - facing * (w / 2 + tail), y + h * 0.3 - (o.airborne ? 3 : 0), tail + 2, 4, 2);
  ctx.fill();

  // Eyes, looking where we are going
  const eyeX = cx + facing * 3;
  const eyeY = y + h * 0.27;
  if (o.blink) {
    ctx.strokeStyle = '#1d1d2b';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(eyeX - 6.5, eyeY);
    ctx.lineTo(eyeX - 1.5, eyeY);
    ctx.moveTo(eyeX + 1.5, eyeY);
    ctx.lineTo(eyeX + 6.5, eyeY);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(eyeX - 4, eyeY, 3.4, 4.2, 0, 0, TAU);
    ctx.ellipse(eyeX + 4, eyeY, 3.4, 4.2, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1d1d2b';
    const look = o.wallSliding ? 0 : facing * 1.3;
    const lookY = o.falling ? 1.2 : 0;
    ctx.beginPath();
    ctx.arc(eyeX - 4 + look, eyeY + lookY, 1.9, 0, TAU);
    ctx.arc(eyeX + 4 + look, eyeY + lookY, 1.9, 0, TAU);
    ctx.fill();
  }
}
