/**
 * Screens: full-screen overlays drawn in view space on top of the world -
 * title, pause, level clear, game over and victory.
 */
const CONTROLS_TEXT = '←/→ or A/D move   ·   Space/W jump (hold = higher)   ·   jump while sliding a wall = wall jump   ·   ↓ + Jump drop down   ·   P pause';

const Screens = {
  title(ctx, game) {
    const W = CONFIG.VIEW_W;
    const H = CONFIG.VIEW_H;
    const t = game.time;

    // Darken the bottom so the text reads over the level
    const g = ctx.createLinearGradient(0, H * 0.35, 0, H);
    g.addColorStop(0, 'rgba(12, 14, 30, 0)');
    g.addColorStop(1, 'rgba(12, 14, 30, 0.75)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Logo
    const logoY = 170;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 118px ${HUD_FONT}`;
    ctx.fillStyle = 'rgba(12, 14, 30, 0.35)';
    ctx.fillText('LEDGE', W / 2 + 6, logoY + 9);
    const logoGrad = ctx.createLinearGradient(0, logoY - 50, 0, logoY + 50);
    logoGrad.addColorStop(0, '#ffffff');
    logoGrad.addColorStop(1, '#ffe08a');
    ctx.lineJoin = 'round';
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#1b1f35';
    ctx.strokeText('LEDGE', W / 2, logoY);
    ctx.fillStyle = logoGrad;
    ctx.fillText('LEDGE', W / 2, logoY);

    // A little grassy ledge under the logo, with our hero peering over the edge
    const ledgeW = 300;
    const lx = W / 2 - ledgeW / 2;
    const ly = logoY + 62;
    ctx.fillStyle = '#1b1f35';
    ctx.beginPath();
    roundRectPath(ctx, lx - 4, ly - 4, ledgeW + 8, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#8a5a36';
    ctx.beginPath();
    roundRectPath(ctx, lx, ly, ledgeW, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#58b847';
    ctx.beginPath();
    roundRectPath(ctx, lx, ly, ledgeW, 9, 4);
    ctx.fill();
    ctx.fillStyle = '#8fdc5e';
    ctx.fillRect(lx + 6, ly, ledgeW - 12, 3);
    const hop = Math.max(0, Math.sin(t * 3.2)) * 14;
    drawHero(ctx, lx + ledgeW - 26, ly - hop, 1);

    ctx.font = `bold 18px ${HUD_FONT}`;
    outlinedText(ctx, 'a tiny run-and-jump platformer', W / 2, ly + 52, '#dbe7ff', 4);

    // Prompt
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 4);
    ctx.font = `bold 26px ${HUD_FONT}`;
    outlinedText(ctx, 'PRESS ENTER OR SPACE TO START', W / 2, H - 110, '#ffe17a', 6);
    ctx.globalAlpha = 1;

    ctx.font = `14px ${HUD_FONT}`;
    outlinedText(ctx, CONTROLS_TEXT, W / 2, H - 50, '#e6ecff', 4);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  },

  pause(ctx) {
    dim(ctx, 0.6);
    const W = CONFIG.VIEW_W;
    const H = CONFIG.VIEW_H;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 60px ${HUD_FONT}`;
    outlinedText(ctx, 'PAUSED', W / 2, H * 0.3, '#ffffff', 10);
    ctx.font = `bold 20px ${HUD_FONT}`;
    const lines = [['Enter / P / Esc', 'Resume'], ['R', 'Restart level'], ['Q', 'Quit to title'], ['M', 'Toggle sound']];
    lines.forEach(([key, action], i) => {
      const y = H * 0.46 + i * 34;
      ctx.textAlign = 'right';
      outlinedText(ctx, key, W / 2 - 14, y, '#ffe17a', 4);
      ctx.textAlign = 'left';
      outlinedText(ctx, action, W / 2 + 14, y, '#ffffff', 4);
    });
    ctx.textAlign = 'center';
    ctx.font = `14px ${HUD_FONT}`;
    outlinedText(ctx, CONTROLS_TEXT, W / 2, H - 50, '#cfd8f0', 4);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  },

  levelClear(ctx, game) {
    const W = CONFIG.VIEW_W;
    const H = CONFIG.VIEW_H;
    const k = clamp(game.stateTime / 0.6, 0, 1); // fade/slide in
    const world = game.world;
    dim(ctx, 0.45 * k);
    ctx.globalAlpha = k;
    const pw = 420;
    const ph = 260;
    const px = W / 2 - pw / 2;
    const py = H / 2 - ph / 2 + (1 - k) * 30;
    ctx.fillStyle = 'rgba(22, 26, 48, 0.9)';
    ctx.beginPath();
    roundRectPath(ctx, px, py, pw, ph, 18);
    ctx.fill();
    ctx.strokeStyle = '#ffe17a';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 40px ${HUD_FONT}`;
    outlinedText(ctx, 'LEVEL CLEAR!', W / 2, py + 48, '#ffe17a', 8);
    ctx.font = `bold 20px ${HUD_FONT}`;
    const rows = [
      ['Coins', `${world.stats.coins} / ${world.stats.totalCoins}`],
      ['Time', formatTime(world.clock)],
      ['Deaths', `${world.stats.deaths}`],
    ];
    rows.forEach(([label, value], i) => {
      const y = py + 104 + i * 32;
      ctx.textAlign = 'left';
      outlinedText(ctx, label, px + 70, y, '#cfd8f0', 4);
      ctx.textAlign = 'right';
      outlinedText(ctx, value, px + pw - 70, y, '#ffffff', 4);
    });
    if (game.stateTime > 1) {
      ctx.textAlign = 'center';
      ctx.globalAlpha = k * (0.6 + 0.4 * Math.sin(game.time * 4));
      ctx.font = `bold 18px ${HUD_FONT}`;
      const prompt = game.levelIndex + 1 < LEVELS.length ? 'Press Enter for the next level' : 'Press Enter to finish';
      outlinedText(ctx, prompt, W / 2, py + ph - 30, '#ffffff', 4);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  },

  gameOver(ctx, game) {
    const W = CONFIG.VIEW_W;
    const H = CONFIG.VIEW_H;
    const k = clamp(game.stateTime / 0.8, 0, 1);
    ctx.fillStyle = `rgba(40, 6, 16, ${0.65 * k})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = k;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 72px ${HUD_FONT}`;
    outlinedText(ctx, 'GAME OVER', W / 2, H * 0.4, '#ff6b7a', 12);
    if (game.stateTime > 1) {
      ctx.font = `bold 20px ${HUD_FONT}`;
      outlinedText(ctx, 'Press Enter to try this level again', W / 2, H * 0.58, '#ffffff', 4);
      ctx.font = `16px ${HUD_FONT}`;
      outlinedText(ctx, 'Q  -  quit to title', W / 2, H * 0.58 + 34, '#cfd8f0', 4);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  },

  victory(ctx, game) {
    const W = CONFIG.VIEW_W;
    const H = CONFIG.VIEW_H;
    dim(ctx, 0.55);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 56px ${HUD_FONT}`;
    outlinedText(ctx, 'YOU BEAT LEDGE!', W / 2, H * 0.28, '#ffe17a', 10);
    ctx.font = `bold 20px ${HUD_FONT}`;
    const s = game.runStats;
    outlinedText(ctx, `Coins ${s.coins}   ·   Time ${formatTime(s.time)}   ·   Deaths ${s.deaths}`, W / 2, H * 0.45, '#ffffff', 4);
    outlinedText(ctx, 'Thanks for playing!', W / 2, H * 0.55, '#cfd8f0', 4);
    if (game.stateTime > 1) {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(game.time * 4);
      outlinedText(ctx, 'Press Enter to return to the title', W / 2, H * 0.72, '#ffffff', 4);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  },
};

function dim(ctx, amount) {
  ctx.fillStyle = `rgba(10, 12, 26, ${amount})`;
  ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
}
