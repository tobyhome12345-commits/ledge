/**
 * Screens: full-screen overlays drawn in view space on top of the world -
 * title menu, level select, options, pause, level clear, game over, victory.
 *
 * Menu screens record the rectangle of every row they draw in
 * `game.menuHitboxes`, so Game can match mouse hovers and clicks to items
 * without the two files having to agree on a layout twice.
 */
const CONTROLS_TEXT = '←/→ or A/D move   ·   Space/W jump (hold = higher)   ·   jump while sliding a wall = wall jump   ·   ↓ + Jump drop down   ·   P pause';

const TITLE_ITEMS = ['PLAY', 'LEVELS', 'OPTIONS'];
const LEVEL_SELECT_COLS = 4;   // cards per row on the level select

const OPTION_ROWS = [
  { key: 'musicVolume', label: 'Music', type: 'volume' },
  { key: 'sfxVolume', label: 'Sound effects', type: 'volume' },
  { key: 'screenShake', label: 'Screen shake', type: 'toggle' },
  { key: 'doubleJump', label: 'Double jump (assist)', type: 'toggle' },
  { key: 'reset', label: 'Reset level progress', type: 'action' },
];

const Screens = {
  title(ctx, game) {
    const W = CONFIG.VIEW_W;
    const H = CONFIG.VIEW_H;
    const t = game.time;

    const g = ctx.createLinearGradient(0, H * 0.25, 0, H);
    g.addColorStop(0, 'rgba(12, 14, 30, 0)');
    g.addColorStop(1, 'rgba(12, 14, 30, 0.8)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Logo
    const logoY = 116;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 104px ${HUD_FONT}`;
    ctx.fillStyle = 'rgba(12, 14, 30, 0.35)';
    ctx.fillText('LEDGE', W / 2 + 6, logoY + 8);
    const logoGrad = ctx.createLinearGradient(0, logoY - 44, 0, logoY + 44);
    logoGrad.addColorStop(0, '#ffffff');
    logoGrad.addColorStop(1, '#ffe08a');
    ctx.lineJoin = 'round';
    ctx.lineWidth = 11;
    ctx.strokeStyle = '#1b1f35';
    ctx.strokeText('LEDGE', W / 2, logoY);
    ctx.fillStyle = logoGrad;
    ctx.fillText('LEDGE', W / 2, logoY);

    // A grassy ledge under the logo with our hero hopping on the end
    const ledgeW = 280;
    const lx = W / 2 - ledgeW / 2;
    const ly = logoY + 56;
    ctx.fillStyle = '#1b1f35';
    ctx.beginPath();
    roundRectPath(ctx, lx - 4, ly - 4, ledgeW + 8, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#8a5a36';
    ctx.beginPath();
    roundRectPath(ctx, lx, ly, ledgeW, 20, 6);
    ctx.fill();
    ctx.fillStyle = '#58b847';
    ctx.beginPath();
    roundRectPath(ctx, lx, ly, ledgeW, 8, 4);
    ctx.fill();
    ctx.fillStyle = '#8fdc5e';
    ctx.fillRect(lx + 6, ly, ledgeW - 12, 3);
    const hop = Math.max(0, Math.sin(t * 3.2)) * 13;
    drawHero(ctx, lx + ledgeW - 26, ly - hop, 1);

    ctx.font = `bold 16px ${HUD_FONT}`;
    outlinedText(ctx, 'a tiny run-and-jump platformer', W / 2, ly + 42, '#dbe7ff', 4);

    // Menu
    game.menuHitboxes = [];
    TITLE_ITEMS.forEach((label, i) => {
      const y = 288 + i * 46;
      menuRow(ctx, game, i, label, W / 2 - 140, y - 18, 280, 36, i === game.menuIndex);
    });

    ctx.font = `13px ${HUD_FONT}`;
    outlinedText(ctx, 'Up / Down to choose   ·   Enter or Space to select   ·   mouse works too', W / 2, 452, '#cfd8f0', 4);
    ctx.font = `13px ${HUD_FONT}`;
    outlinedText(ctx, CONTROLS_TEXT, W / 2, 500, '#aab6d4', 4);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  },

  levelSelect(ctx, game) {
    const W = CONFIG.VIEW_W;
    const H = CONFIG.VIEW_H;
    dim(ctx, 0.72);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 38px ${HUD_FONT}`;
    outlinedText(ctx, 'SELECT LEVEL', W / 2, 52, '#ffe17a', 8);

    game.menuHitboxes = [];
    const count = LEVELS.length;
    const cols = Math.min(LEVEL_SELECT_COLS, count);
    const rows = Math.ceil(count / cols);
    const cardW = Math.min(196, (W - 80 - (cols - 1) * 16) / cols);
    const cardH = rows > 1 ? 166 : 206;
    const thumbH = rows > 1 ? 62 : 88;
    const totalW = cols * cardW + (cols - 1) * 16;
    const x0 = (W - totalW) / 2;
    const y0 = rows > 1 ? 88 : 120;

    for (let i = 0; i < count; i++) {
      const level = LEVELS[i];
      const x = x0 + (i % cols) * (cardW + 16);
      const top = y0 + Math.floor(i / cols) * (cardH + 18);
      const selected = i === game.menuIndex;
      const unlocked = Progress.isUnlocked(i);
      const best = Progress.best(i);
      game.menuHitboxes.push({ x, y: top, w: cardW, h: cardH, index: i });

      const cardY = top - (selected ? 5 : 0);
      ctx.fillStyle = selected ? 'rgba(38, 44, 78, 0.98)' : 'rgba(22, 26, 48, 0.9)';
      ctx.beginPath();
      roundRectPath(ctx, x, cardY, cardW, cardH, 14);
      ctx.fill();
      ctx.strokeStyle = selected ? '#ffe17a' : 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = selected ? 3 : 2;
      ctx.stroke();

      // Thumbnail of the level's skyline
      const tx = x + 12;
      const ty = cardY + 34;
      const tw = cardW - 24;
      ctx.save();
      ctx.beginPath();
      roundRectPath(ctx, tx, ty, tw, thumbH, 6);
      ctx.clip();
      drawLevelThumb(ctx, level, tx, ty, tw, thumbH);
      if (!unlocked) {
        ctx.fillStyle = 'rgba(8, 10, 22, 0.72)';
        ctx.fillRect(tx, ty, tw, thumbH);
      }
      ctx.restore();

      ctx.font = `bold 14px ${HUD_FONT}`;
      outlinedText(ctx, level.id, x + cardW / 2, cardY + 19, unlocked ? '#ffe17a' : '#8892b0', 4);
      ctx.font = `bold 15px ${HUD_FONT}`;
      outlinedText(ctx, level.name, x + cardW / 2, ty + thumbH + 20, unlocked ? '#ffffff' : '#8892b0', 4);

      ctx.font = `12px ${HUD_FONT}`;
      const footY = ty + thumbH + 42;
      if (!unlocked) {
        drawPadlock(ctx, x + cardW / 2, ty + thumbH / 2, 22);
        outlinedText(ctx, 'finish the level before', x + cardW / 2, footY, '#8892b0', 3);
      } else if (best) {
        outlinedText(ctx, `best ${formatTime(best.time)}   ·   ${best.coins} coins`, x + cardW / 2, footY, '#cfd8f0', 3);
      } else {
        outlinedText(ctx, 'not finished yet', x + cardW / 2, footY, '#cfd8f0', 3);
      }
    }

    ctx.font = `13px ${HUD_FONT}`;
    outlinedText(ctx, 'Arrow keys to choose   ·   Enter to play   ·   Esc to go back', W / 2, H - 34, '#cfd8f0', 4);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  },

  options(ctx, game) {
    const W = CONFIG.VIEW_W;
    const H = CONFIG.VIEW_H;
    dim(ctx, 0.72);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 40px ${HUD_FONT}`;
    outlinedText(ctx, 'OPTIONS', W / 2, 70, '#ffe17a', 8);

    game.menuHitboxes = [];
    const rowW = 520;
    const rowX = (W - rowW) / 2;

    OPTION_ROWS.forEach((row, i) => {
      const y = 146 + i * 58;
      const selected = i === game.menuIndex;
      game.menuHitboxes.push({ x: rowX, y: y - 22, w: rowW, h: 44, index: i });

      if (selected) {
        ctx.fillStyle = 'rgba(255, 225, 122, 0.14)';
        ctx.beginPath();
        roundRectPath(ctx, rowX, y - 22, rowW, 44, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 225, 122, 0.7)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.textAlign = 'left';
      ctx.font = `bold 18px ${HUD_FONT}`;
      outlinedText(ctx, row.label, rowX + 22, y, selected ? '#ffffff' : '#cfd8f0', 4);

      if (row.type === 'volume') {
        const value = Settings.get(row.key);
        drawVolumeBar(ctx, rowX + 300, y, 150, value);
        ctx.textAlign = 'right';
        ctx.font = `bold 16px ${HUD_FONT}`;
        outlinedText(ctx, `${Math.round(value * 100)}%`, rowX + rowW - 22, y, '#ffe17a', 4);
      } else if (row.type === 'toggle') {
        const on = !!Settings.get(row.key);
        ctx.textAlign = 'right';
        ctx.font = `bold 17px ${HUD_FONT}`;
        outlinedText(ctx, on ? 'ON' : 'OFF', rowX + rowW - 22, y, on ? '#7dffb8' : '#8892b0', 4);
      } else {
        ctx.textAlign = 'right';
        ctx.font = `bold 15px ${HUD_FONT}`;
        const label = game.confirmReset ? 'PRESS ENTER AGAIN' : 'ENTER';
        outlinedText(ctx, label, rowX + rowW - 22, y, game.confirmReset ? '#ff8a8f' : '#8892b0', 4);
      }
    });

    ctx.textAlign = 'center';
    ctx.font = `13px ${HUD_FONT}`;
    const muted = Settings.get('muted');
    outlinedText(ctx, muted ? 'Everything is muted (press M to unmute)' : 'M mutes everything at any time',
      W / 2, H - 96, muted ? '#ff8a8f' : '#aab6d4', 4);
    outlinedText(ctx, 'Up / Down to choose   ·   Left / Right to adjust   ·   Enter to toggle   ·   Esc to go back',
      W / 2, H - 60, '#cfd8f0', 4);
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
    const lines = [['Enter / P / Esc', 'Resume'], ['R', 'Restart level'], ['Q', 'Quit to title'], ['M', 'Mute everything']];
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

// ---------------------------------------------------------------------------
// Menu drawing helpers
// ---------------------------------------------------------------------------

/** One selectable row; also records its hitbox for the mouse. */
function menuRow(ctx, game, index, label, x, y, w, h, selected) {
  game.menuHitboxes.push({ x, y, w, h, index });
  if (selected) {
    ctx.fillStyle = 'rgba(255, 225, 122, 0.16)';
    ctx.beginPath();
    roundRectPath(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 225, 122, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold 24px ${HUD_FONT}`;
  outlinedText(ctx, label, x + w / 2, y + h / 2, selected ? '#ffe17a' : '#e6ecff', 5);
  if (selected) {
    ctx.font = `bold 20px ${HUD_FONT}`;
    outlinedText(ctx, '▶', x - 6, y + h / 2, '#ffe17a', 4);
  }
}

function drawVolumeBar(ctx, x, y, w, value) {
  const h = 12;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.beginPath();
  roundRectPath(ctx, x, y - h / 2, w, h, 6);
  ctx.fill();
  if (value > 0) {
    ctx.fillStyle = '#ffe17a';
    ctx.beginPath();
    roundRectPath(ctx, x, y - h / 2, Math.max(h, w * value), h, 6);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  roundRectPath(ctx, x, y - h / 2, w, h, 6);
  ctx.stroke();
}

function drawPadlock(ctx, cx, cy, size) {
  const w = size * 0.8;
  const h = size * 0.62;
  ctx.strokeStyle = '#cfd8f0';
  ctx.lineWidth = size * 0.14;
  ctx.beginPath();
  ctx.arc(cx, cy - h * 0.45, w * 0.32, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = '#cfd8f0';
  ctx.beginPath();
  roundRectPath(ctx, cx - w / 2, cy - h * 0.2, w, h, 3);
  ctx.fill();
  ctx.fillStyle = '#1b1f35';
  ctx.beginPath();
  ctx.arc(cx, cy + h * 0.1, size * 0.08, 0, TAU);
  ctx.fill();
}

/** A tiny skyline preview of a level, drawn from its map data. */
function drawLevelThumb(ctx, level, x, y, w, h) {
  const theme = THEMES[level.theme] || THEMES.meadow;
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, theme.skyTop);
  grad.addColorStop(1, theme.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  const map = level.map;
  const rows = map.length;
  const cols = Math.max(...map.map((r) => r.length));
  const step = Math.max(1, Math.round(cols / w));
  const colW = (step / cols) * w + 1;
  for (let pass = 0; pass < 2; pass++) {
    ctx.fillStyle = pass === 0 ? theme.dirt : theme.grass;
    for (let tx = 0; tx < cols; tx += step) {
      let top = -1;
      for (let ty = 0; ty < rows; ty++) {
        const ch = map[ty][tx];
        if (ch === '#' || ch === 'B') { top = ty; break; }
      }
      if (top < 0) continue;
      const px = x + (tx / cols) * w;
      const py = y + (top / rows) * h;
      if (pass === 0) ctx.fillRect(px, py, colW, y + h - py);
      else ctx.fillRect(px, py, colW, Math.max(1.5, h / rows * 0.8));
    }
  }
}

function dim(ctx, amount) {
  ctx.fillStyle = `rgba(10, 12, 26, ${amount})`;
  ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
}
