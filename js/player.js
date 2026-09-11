/**
 * Player: the character you control.
 *
 * Position (x, y) is the top-left of the hitbox; (px, py) is where it was at
 * the previous physics step, used for render interpolation.
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
    this.facing = 1;       // 1 = right, -1 = left
    this.grounded = false;
  }

  update(dt, input, world) {
    const c = CONFIG.player;
    const level = world.level;
    this.px = this.x;
    this.py = this.y;

    const move = (input.held('right') ? 1 : 0) - (input.held('left') ? 1 : 0);
    this.vx = move * c.maxRunSpeed;
    if (move !== 0) this.facing = move;

    if (input.pressed('jump') && this.grounded) this.vy = -c.jumpVelocity;

    // Gravity, capped at terminal velocity. Moving by the average of the old and
    // new velocity (trapezoidal integration) makes the real jump height match
    // CONFIG.player.jumpHeight exactly instead of falling a few pixels short.
    const vyStart = this.vy;
    this.vy = Math.min(this.vy + c.gravity * dt, c.maxFallSpeed);

    // Resolve X then Y against the tiles
    if (Physics.moveX(this, this.vx * dt, level)) this.vx = 0;
    const hit = Physics.moveY(this, ((vyStart + this.vy) / 2) * dt, level);
    if (hit.landed || hit.bumped) this.vy = 0;
    this.grounded = hit.landed;
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
