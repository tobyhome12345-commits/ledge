/**
 * Renderer: owns the canvas, handles screen/DPI scaling, and draws a World in
 * layers:  parallax background -> tiles -> entities  (the HUD is drawn on top
 * by hud.js).
 *
 * Coordinate spaces
 *   world   level pixels (1 tile = CONFIG.TILE)
 *   view    the fixed VIEW_W x VIEW_H game screen - HUD and menus draw here
 *   device  real canvas pixels = view * scale (includes devicePixelRatio)
 *
 * The canvas backing store matches the real screen resolution so shapes stay
 * sharp at any window size. Tiles are snapped to whole device pixels, which
 * avoids hairline seams between neighbouring tiles at fractional scales.
 */
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 1;  // device pixels per world pixel
    this.camX = 0;   // world coords of the view's top-left corner (this frame)
    this.camY = 0;
    this.ox = 0;     // ...and the same in whole device pixels
    this.oy = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Fit the largest 16:9 canvas into the window, at native resolution. */
  resize() {
    const { VIEW_W, VIEW_H } = CONFIG;
    const fit = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    const cssW = Math.max(1, Math.floor(VIEW_W * fit));
    const cssH = Math.max(1, Math.floor(VIEW_H * fit));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.scale = this.canvas.width / VIEW_W;
  }

  setCamera(x, y) {
    this.camX = x;
    this.camY = y;
    this.ox = Math.round(x * this.scale);
    this.oy = Math.round(y * this.scale);
  }

  // --- Transforms for the three coordinate spaces
  useWorld() { const s = this.scale; this.ctx.setTransform(s, 0, 0, s, -this.ox, -this.oy); }
  useView() { const s = this.scale; this.ctx.setTransform(s, 0, 0, s, 0, 0); }
  useDevice() { this.ctx.setTransform(1, 0, 0, 1, 0, 0); }

  // --- World -> device coordinates, snapped to whole pixels (for tiles)
  sx(wx) { return Math.round(wx * this.scale) - this.ox; }
  sy(wy) { return Math.round(wy * this.scale) - this.oy; }

  /** Append a pixel-snapped world-space rectangle to the current path (device transform). */
  rect(x, y, w, h) {
    const x0 = this.sx(x);
    const y0 = this.sy(y);
    this.ctx.rect(x0, y0, this.sx(x + w) - x0, this.sy(y + h) - y0);
  }

  /** Draw a whole world: background, tiles, then the world's own entities. */
  drawWorld(world, alpha, time) {
    const view = world.camera.view(alpha, time, world.level);
    this.setCamera(view.x, view.y);
    this.drawBackground(world.theme, world.level, time);
    this.drawTiles(world.level, world.theme);
    this.useWorld();
    world.draw(this.ctx, alpha, this);
  }

  // ---------------------------------------------------------------------------
  // Background
  // ---------------------------------------------------------------------------

  drawBackground(theme, level, time) {
    const ctx = this.ctx;
    const W = CONFIG.VIEW_W;
    const H = CONFIG.VIEW_H;
    this.useView();

    if (this.skyTheme !== theme) {
      this.sky = ctx.createLinearGradient(0, 0, 0, H);
      this.sky.addColorStop(0, theme.skyTop);
      this.sky.addColorStop(1, theme.skyBottom);
      this.skyTheme = theme;
    }
    ctx.fillStyle = this.sky;
    ctx.fillRect(0, 0, W, H);

    // How far the camera is above its lowest position. Distant layers sink
    // less than near ones when the camera rises, which sells the depth.
    const lift = Math.max(0, level.height - H) - this.camY;

    // Sun
    const sunX = W * 0.8 - this.camX * 0.01;
    const sunY = 96 + lift * 0.04;
    ctx.fillStyle = theme.sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 72, 0, TAU);
    ctx.fill();
    ctx.fillStyle = theme.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 44, 0, TAU);
    ctx.fill();

    this.drawClouds(theme, time, lift);

    //             colour      scroll  baseline               height seed pointy  cap colour
    this.drawRidge(theme.far,  0.12,   H * 0.66 + lift * 0.12, 190,  1.3, true,  theme.farPeak);
    this.drawRidge(theme.mid,  0.3,    H * 0.8 + lift * 0.3,   90,   4.1, false);
    this.drawRidge(theme.near, 0.55,   H * 0.93 + lift * 0.55, 70,   7.7, false);
  }

  drawClouds(theme, time, lift) {
    const ctx = this.ctx;
    if (!this.clouds) {
      const rng = makeRng(7);
      this.clouds = Array.from({ length: 9 }, () => ({
        x: rng() * 2400, y: 30 + rng() * 160, s: 0.55 + rng() * 0.7,
      }));
    }
    const span = 2400; // clouds wrap around every `span` pixels
    ctx.fillStyle = theme.cloud;
    ctx.globalAlpha = 0.85;
    for (const c of this.clouds) {
      const x = ((((c.x - this.camX * 0.06 - time * 7) % span) + span) % span) - 200;
      const y = c.y + lift * 0.06;
      const s = c.s;
      ctx.beginPath();
      ctx.moveTo(x + 22 * s, y);
      ctx.arc(x, y, 22 * s, 0, TAU);
      ctx.moveTo(x + 58 * s, y - 10 * s);
      ctx.arc(x + 30 * s, y - 10 * s, 28 * s, 0, TAU);
      ctx.moveTo(x + 82 * s, y);
      ctx.arc(x + 60 * s, y, 22 * s, 0, TAU);
      roundRectPath(ctx, x - 8 * s, y - 4 * s, 76 * s, 26 * s, 13 * s);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** A scrolling silhouette layer, optionally with snow caps on the peaks. */
  drawRidge(color, factor, baseY, height, seed, pointy, capColor) {
    const ctx = this.ctx;
    const W = CONFIG.VIEW_W;
    const H = CONFIG.VIEW_H;
    if (baseY - height > H) return; // entirely below the screen
    const off = this.camX * factor;
    const step = 12;
    const xs = [];
    for (let sx = 0; sx <= W + step; sx += step) xs.push(sx);
    const yAt = (sx) => baseY - ridgeHeight(sx + off, seed, pointy) * height;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (const sx of xs) ctx.lineTo(sx, yAt(sx));
    ctx.lineTo(xs[xs.length - 1], H);
    ctx.closePath();
    ctx.fill();

    if (capColor) {
      // Fill between the skyline and a wavy "snow line", only where peaks poke above it.
      const lineAt = (sx) => baseY - height * 0.7 + Math.sin((sx + off) * 0.07) * 5;
      ctx.fillStyle = capColor;
      ctx.beginPath();
      for (const sx of xs) ctx.lineTo(sx, Math.min(yAt(sx), lineAt(sx)));
      for (let i = xs.length - 1; i >= 0; i--) ctx.lineTo(xs[i], lineAt(xs[i]));
      ctx.closePath();
      ctx.fill();
    }
  }

  // ---------------------------------------------------------------------------
  // Tiles
  // ---------------------------------------------------------------------------

  /**
   * Draws every visible tile. Each "layer" call fills one colour for all
   * tiles of one type in a single path, which keeps draw calls low.
   */
  drawTiles(level, theme) {
    const T = CONFIG.TILE;
    const ctx = this.ctx;
    this.useDevice();

    const x0 = Math.max(0, Math.floor(this.camX / T));
    const x1 = Math.min(level.cols - 1, Math.floor((this.camX + CONFIG.VIEW_W) / T));
    const y0 = Math.max(0, Math.floor(this.camY / T));
    const y1 = Math.min(level.rows - 1, Math.floor((this.camY + CONFIG.VIEW_H) / T));
    const r = (x, y, w, h) => this.rect(x, y, w, h);

    // For shading, treat everything below the level as solid ground.
    const solid = (tx, ty) => ty >= level.rows || level.isSolid(tx, ty);
    // Ground gets grass when the tile above is open sky (not solid, not cave).
    const grassy = (tx, ty) => {
      const above = level.tileAt(tx, ty - 1);
      return !TILE_PROPS[above].solid && above !== TILE.BACKDROP;
    };

    const layer = (type, color, draw) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          if (level.tileAt(tx, ty) === type) draw(tx, ty, tx * T, ty * T);
        }
      }
      ctx.fill();
    };

    // Cave backdrop
    layer(TILE.BACKDROP, theme.cave, (tx, ty, x, y) => r(x, y, T, T));
    layer(TILE.BACKDROP, theme.caveDark, (tx, ty, x, y) => {
      const h = hash2(tx, ty);
      r(x + 4 + Math.floor(h * 18), y + 5 + Math.floor(hash2(ty, tx) * 18), 6, 4);
    });

    // Ground: dirt body, pebbles, darker rim on exposed sides, grass on top
    layer(TILE.GROUND, theme.dirt, (tx, ty, x, y) => r(x, y, T, T));
    layer(TILE.GROUND, theme.dirtDark, (tx, ty, x, y) => {
      const h1 = hash2(tx, ty);
      const h2 = hash2(tx + 71, ty - 13);
      r(x + 3 + Math.floor(h1 * 22), y + 13 + Math.floor(h2 * 13), 5, 3);
      if (h2 > 0.45) r(x + 4 + Math.floor(h2 * 22), y + 5 + Math.floor(h1 * 18), 3, 3);
    });
    layer(TILE.GROUND, theme.dirtEdge, (tx, ty, x, y) => {
      if (!solid(tx - 1, ty)) r(x, y, 3, T);
      if (!solid(tx + 1, ty)) r(x + T - 3, y, 3, T);
      if (!solid(tx, ty + 1)) r(x, y + T - 4, T, 4);
    });
    layer(TILE.GROUND, theme.grass, (tx, ty, x, y) => {
      if (!grassy(tx, ty)) return;
      r(x, y, T, 9);
      const h = hash2(tx, ty);
      r(x + 3 + Math.floor(h * 10), y + 9, 4, 3);   // tufts hanging over the dirt
      r(x + 18 + Math.floor(h * 9), y + 9, 3, 2);
      if (!solid(tx - 1, ty)) r(x - 2, y, 2, 11);    // lip over exposed corners
      if (!solid(tx + 1, ty)) r(x + T, y, 2, 11);
    });
    layer(TILE.GROUND, theme.grassLight, (tx, ty, x, y) => {
      if (grassy(tx, ty)) r(x, y, T, 3);
    });

    // Bricks: running-bond pattern with a bevel
    layer(TILE.BRICK, theme.brick, (tx, ty, x, y) => r(x, y, T, T));
    layer(TILE.BRICK, theme.brickDark, (tx, ty, x, y) => {
      r(x, y + 15, T, 2);
      r(x + 15, y, 2, 15);
      r(x + 7, y + 17, 2, 15);
      r(x + 23, y + 17, 2, 15);
      r(x, y + T - 2, T, 2);
      r(x + T - 2, y, 2, T);
    });
    layer(TILE.BRICK, theme.brickLight, (tx, ty, x, y) => {
      r(x, y, T - 2, 2);
      r(x, y, 2, T - 2);
    });

    // One-way platforms: planks with struts under the ends of each run
    layer(TILE.ONEWAY, theme.plankDark, (tx, ty, x, y) => {
      r(x, y, T, 11);
      if (level.tileAt(tx - 1, ty) !== TILE.ONEWAY) r(x + 3, y + 11, 4, 9);
      if (level.tileAt(tx + 1, ty) !== TILE.ONEWAY) r(x + T - 7, y + 11, 4, 9);
    });
    layer(TILE.ONEWAY, theme.plank, (tx, ty, x, y) => r(x + 1, y + 1, T - 2, 7));
    layer(TILE.ONEWAY, theme.plankLight, (tx, ty, x, y) => r(x + 1, y + 1, T - 2, 2));

    // Spikes: three metal teeth per tile, shaded on the right half
    layer(TILE.SPIKES, theme.spikeBase, (tx, ty, x, y) => r(x, y + T - 4, T, 4));
    const teeth = (x, y, shadeOnly) => {
      for (let i = 0; i < 3; i++) {
        const bx = x + 1 + i * 10;
        const left = shadeOnly ? bx + 5 : bx;
        ctx.moveTo(this.sx(left), this.sy(y + T - 4));
        ctx.lineTo(this.sx(bx + 5), this.sy(y + T - 18));
        ctx.lineTo(this.sx(bx + 10), this.sy(y + T - 4));
        ctx.closePath();
      }
    };
    layer(TILE.SPIKES, theme.spike, (tx, ty, x, y) => teeth(x, y, false));
    layer(TILE.SPIKES, theme.spikeShade, (tx, ty, x, y) => teeth(x, y, true));
  }

  /** Debug: tile grid over the visible area. */
  drawGrid(level) {
    const T = CONFIG.TILE;
    const ctx = this.ctx;
    this.useDevice();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const x0 = Math.floor(this.camX / T), x1 = Math.ceil((this.camX + CONFIG.VIEW_W) / T);
    const y0 = Math.floor(this.camY / T), y1 = Math.ceil((this.camY + CONFIG.VIEW_H) / T);
    for (let tx = x0; tx <= x1; tx++) { ctx.moveTo(this.sx(tx * T) + 0.5, 0); ctx.lineTo(this.sx(tx * T) + 0.5, this.canvas.height); }
    for (let ty = y0; ty <= y1; ty++) { ctx.moveTo(0, this.sy(ty * T) + 0.5); ctx.lineTo(this.canvas.width, this.sy(ty * T) + 0.5); }
    ctx.stroke();
  }
}

/** Smooth pseudo-random skyline height in [0, 1] for the background ridges. */
function ridgeHeight(x, seed, pointy) {
  let h = 0;
  let amp = 1;
  let freq = 1 / 160;
  let total = 0;
  for (let i = 0; i < 3; i++) {
    const s = Math.sin(x * freq + seed * (i + 1) * 2.3);
    h += (pointy ? 1 - Math.abs(s) : 0.5 + 0.5 * s) * amp;
    total += amp;
    amp *= 0.45;
    freq *= 2.2;
  }
  return h / total;
}
