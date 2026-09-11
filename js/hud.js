/**
 * HUD: hearts, coins, level name and timer, drawn in view space (VIEW_W x
 * VIEW_H) on top of the world. Also shared text helpers for menus.
 */
const HUD_FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

class Hud {
  constructor() {
    this.coinPulse = 0;  // 1 -> 0: the coin counter "pops" when you collect one
    this.heartPulse = 0; // 1 -> 0: the heart you just lost flashes
    this.lastCoins = 0;
    this.lastHealth = null;
  }

  /** Watch the world for changes that deserve a little feedback. */
  update(dt, world) {
    const coins = world.stats.coins;
    const health = world.player.health;
    if (coins > this.lastCoins) this.coinPulse = 1;
    if (this.lastHealth !== null && health < this.lastHealth) this.heartPulse = 1;
    this.lastCoins = coins;
    this.lastHealth = health;
    this.coinPulse = Math.max(0, this.coinPulse - dt * 4);
    this.heartPulse = Math.max(0, this.heartPulse - dt * 2);
  }

  draw(ctx, world, lives) {
    const W = CONFIG.VIEW_W;
    const p = world.player;
    const maxHp = CONFIG.player.maxHealth;

    // --- Hearts and lives (top-left)
    const livesX = 24 + maxHp * 34;
    panel(ctx, 12, 10, livesX + 50, 42);
    for (let i = 0; i < maxHp; i++) {
      const justLost = i === p.health && this.heartPulse > 0;
      const size = 26 * (1 + (justLost ? this.heartPulse * 0.35 : 0));
      drawHeart(ctx, 36 + i * 34, 31 - size * 0.46, size, i < p.health, justLost ? this.heartPulse : 0);
    }
    drawPlayerIcon(ctx, livesX + 12, 31, 18);
    ctx.font = `bold 18px ${HUD_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    outlinedText(ctx, `×${lives}`, livesX + 26, 32, '#ffffff');

    // --- Coins and timer (top-right)
    panel(ctx, W - 176, 10, 164, 42);
    const pop = 1 + this.coinPulse * 0.3;
    drawCoinIcon(ctx, W - 152, 31, 10 * pop);
    ctx.font = `bold 22px ${HUD_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const coinText = `${world.stats.coins}`;
    outlinedText(ctx, coinText, W - 134, 32, '#ffe17a');
    const coinTextW = ctx.measureText(coinText).width;
    ctx.font = `bold 15px ${HUD_FONT}`;
    outlinedText(ctx, `/ ${world.stats.totalCoins}`, W - 134 + coinTextW + 6, 33, '#f3e6c0');
    ctx.textAlign = 'right';
    ctx.font = `bold 16px ${HUD_FONT}`;
    outlinedText(ctx, formatTime(world.clock), W - 22, 32, '#ffffff');

    // --- Level name (top-centre)
    ctx.textAlign = 'center';
    ctx.font = `bold 15px ${HUD_FONT}`;
    outlinedText(ctx, `${world.data.id || ''}  ${world.level.name.toUpperCase()}`, W / 2, 26, '#ffffff');

    // --- Title card for the first moments of a level
    const t = world.time;
    if (t < 2.6 && !world.complete) {
      const a = t < 1.6 ? 1 : 1 - (t - 1.6);
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.font = `bold 20px ${HUD_FONT}`;
      outlinedText(ctx, `WORLD ${world.data.id || ''}`, W / 2, CONFIG.VIEW_H * 0.36, '#ffe17a', 5);
      ctx.font = `bold 48px ${HUD_FONT}`;
      outlinedText(ctx, world.level.name, W / 2, CONFIG.VIEW_H * 0.36 + 44, '#ffffff', 7);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  /** Debug readout of the player's state (toggle with ` or F3). */
  drawDebug(ctx, world, fps) {
    const p = world.player;
    const lines = [
      `fps ${fps.toFixed(0)}`,
      `pos ${p.x.toFixed(1)}, ${p.y.toFixed(1)}  tile ${Math.floor((p.x + p.w / 2) / CONFIG.TILE)}, ${Math.floor((p.y + p.h - 1) / CONFIG.TILE)}`,
      `vel ${p.vx.toFixed(0)}, ${p.vy.toFixed(0)}`,
      `${p.grounded ? 'grounded (' + p.groundType + ')' : 'airborne'}${p.platform ? ' riding' : ''}`,
      `coyote ${Math.max(0, p.coyoteTimer).toFixed(2)}  buffer ${Math.max(0, p.jumpBufferTimer).toFixed(2)}`,
      `hp ${p.health}  invuln ${Math.max(0, p.invulnTimer).toFixed(2)}`,
    ];
    ctx.font = `12px ui-monospace, Consolas, monospace`;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(12, 60, 290, lines.length * 16 + 10);
    ctx.fillStyle = '#9dffb0';
    lines.forEach((line, i) => ctx.fillText(line, 20, 78 + i * 16));
  }
}

// ---------------------------------------------------------------------------
// Drawing helpers (view space)
// ---------------------------------------------------------------------------

/** Text with a dark outline so it reads on any background. */
function outlinedText(ctx, text, x, y, fill = '#fff', width = 4, outline = 'rgba(20, 22, 38, 0.9)') {
  ctx.lineJoin = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = outline;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/** Translucent rounded backing panel for HUD groups. */
function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(16, 20, 38, 0.35)';
  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h, 12);
  ctx.fill();
}

/** Heart centred on x with its top at `top`. `flash` (0..1) tints it white. */
function drawHeart(ctx, x, top, size, full, flash = 0) {
  const s = size;
  const w = s / 2;
  ctx.beginPath();
  ctx.moveTo(x, top + s * 0.28);
  ctx.bezierCurveTo(x, top, x - w, top, x - w, top + s * 0.3);
  ctx.bezierCurveTo(x - w, top + s * 0.58, x - w * 0.2, top + s * 0.7, x, top + s * 0.92);
  ctx.bezierCurveTo(x + w * 0.2, top + s * 0.7, x + w, top + s * 0.58, x + w, top + s * 0.3);
  ctx.bezierCurveTo(x + w, top, x, top, x, top + s * 0.28);
  ctx.closePath();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(20, 22, 38, 0.9)';
  ctx.stroke();
  ctx.fillStyle = flash > 0 ? `rgba(255, 255, 255, ${0.35 + flash * 0.65})` : full ? '#ff4d6d' : 'rgba(255, 255, 255, 0.18)';
  ctx.fill();
  if (full) { // shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(x - w * 0.45, top + s * 0.28, s * 0.09, s * 0.12, -0.5, 0, TAU);
    ctx.fill();
  }
}

/** A tiny version of the player, centred on (x, y). */
function drawPlayerIcon(ctx, x, y, size) {
  ctx.fillStyle = 'rgba(20, 22, 38, 0.9)';
  ctx.beginPath();
  roundRectPath(ctx, x - size / 2 - 2, y - size / 2 - 2, size + 4, size + 4, 6);
  ctx.fill();
  ctx.fillStyle = '#ff5a5f';
  ctx.beginPath();
  roundRectPath(ctx, x - size / 2, y - size / 2, size, size, 5);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + 1, y - size * 0.25, size * 0.24, size * 0.32);
  ctx.fillStyle = '#1d1d2b';
  ctx.fillRect(x + 1 + size * 0.1, y - size * 0.18, size * 0.12, size * 0.2);
}

function drawCoinIcon(ctx, x, y, r) {
  ctx.fillStyle = '#c4830b';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.78, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff5bf';
  ctx.fillRect(x - r * 0.35, y - r * 0.5, r * 0.22, r);
}

/** Seconds -> "m:ss". */
function formatTime(seconds) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
