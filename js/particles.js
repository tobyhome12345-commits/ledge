/**
 * Particles: short-lived squares and circles for feedback - dust, sparkles,
 * bursts. Purely visual, so they use Math.random freely.
 */
class Particles {
  constructor() {
    this.list = [];
  }

  /**
   * Spray `count` particles from (x, y).
   * opts: colors[], speed, angle (radians, -PI/2 = up), spread (radians),
   *       life (s), size, gravity (px/s^2), drag (0..), shape 'square'|'circle',
   *       shrink (true = size shrinks with age)
   */
  burst(x, y, count, opts = {}) {
    const colors = opts.colors || ['#ffffff'];
    const angle = opts.angle ?? -Math.PI / 2;
    const spread = opts.spread ?? TAU;
    const speed = opts.speed ?? 150;
    const life = opts.life ?? 0.6;
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed * (0.35 + Math.random() * 0.65);
      const l = life * (0.6 + Math.random() * 0.4);
      this.list.push({
        x, y, px: x, py: y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: l,
        maxLife: l,
        size: (opts.size ?? 4) * (0.6 + Math.random() * 0.6),
        color: colors[(Math.random() * colors.length) | 0],
        gravity: opts.gravity ?? 500,
        drag: opts.drag ?? 1,
        shape: opts.shape || 'square',
        shrink: opts.shrink ?? true,
      });
    }
  }

  update(dt) {
    for (const p of this.list) {
      p.px = p.x;
      p.py = p.y;
      p.vy += p.gravity * dt;
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k;
      p.vy *= k;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  draw(ctx, alpha) {
    for (const p of this.list) {
      const age = p.life / p.maxLife; // 1 -> 0
      const size = p.shrink ? p.size * age : p.size;
      const x = lerp(p.px, p.x, alpha);
      const y = lerp(p.py, p.y, alpha);
      ctx.globalAlpha = Math.min(1, age * 2);
      ctx.fillStyle = p.color;
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;
  }
}
