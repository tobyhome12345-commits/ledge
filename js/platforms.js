/**
 * MovingPlatform: a floating platform that glides back and forth along a
 * straight line. Like one-way tiles you can jump up through it and land on
 * top; whatever stands on it is carried along (see Player.update).
 *
 * Level data (tile units), in a level's `movers` array:
 *   { x, y, w, dx, dy, period, phase }
 *   starts with its top-left at tile (x, y), is `w` tiles wide, travels
 *   (dx, dy) tiles and back every `period` seconds. `phase` (0..1) offsets
 *   where in the cycle it starts, handy for de-syncing platforms.
 */
class MovingPlatform {
  constructor(def) {
    const T = CONFIG.TILE;
    this.x0 = def.x * T;
    this.y0 = def.y * T;
    this.w = (def.w || 3) * T;
    this.h = 14;
    this.travelX = (def.dx || 0) * T;
    this.travelY = (def.dy || 0) * T;
    this.period = def.period || 4;
    this.t = (def.phase || 0) * this.period;
    this.dx = 0;  // how far it moved during the last step
    this.dy = 0;
    this.vx = 0;  // velocity in px/s (handed to riders when they jump off)
    this.vy = 0;
    this.place();
    this.px = this.x;
    this.py = this.y;
  }

  /** Put the platform where it should be at time t. Cosine easing slows it at both ends. */
  place() {
    const k = (1 - Math.cos((this.t / this.period) * TAU)) / 2;
    this.x = this.x0 + this.travelX * k;
    this.y = this.y0 + this.travelY * k;
  }

  update(dt) {
    this.px = this.x;
    this.py = this.y;
    this.t += dt;
    this.place();
    this.dx = this.x - this.px;
    this.dy = this.y - this.py;
    this.vx = this.dx / dt;
    this.vy = this.dy / dt;
  }

  draw(ctx, alpha, theme) {
    const x = lerp(this.px, this.x, alpha);
    const y = lerp(this.py, this.y, alpha);
    const w = this.w;
    const h = this.h;

    // Faint track showing the path, so players can read where it goes.
    const cx0 = this.x0 + w / 2;
    const cy0 = this.y0 + h / 2;
    ctx.strokeStyle = theme.track;
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.moveTo(cx0, cy0);
    ctx.lineTo(cx0 + this.travelX, cy0 + this.travelY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = theme.track;
    for (const [ex, ey] of [[cx0, cy0], [cx0 + this.travelX, cy0 + this.travelY]]) {
      ctx.beginPath();
      ctx.arc(ex, ey, 4, 0, TAU);
      ctx.fill();
    }

    // Body: a riveted metal slab with a lighter top edge.
    ctx.fillStyle = theme.moverDark;
    ctx.beginPath();
    roundRectPath(ctx, x, y, w, h, 5);
    ctx.fill();
    ctx.fillStyle = theme.mover;
    ctx.beginPath();
    roundRectPath(ctx, x, y, w, h - 4, 5);
    ctx.fill();
    ctx.fillStyle = theme.moverLight;
    ctx.fillRect(x + 4, y + 1, w - 8, 2);
    ctx.fillStyle = theme.moverDark;
    for (let bx = x + 8; bx < x + w - 4; bx += 16) {
      ctx.beginPath();
      ctx.arc(bx, y + 6, 1.6, 0, TAU);
      ctx.fill();
    }
  }
}
