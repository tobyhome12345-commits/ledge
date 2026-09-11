/**
 * Game: owns the main loop.
 *
 * Physics runs at a fixed 60 Hz (CONFIG.STEP) so jumps behave identically on
 * every monitor; rendering happens once per requestAnimationFrame and
 * interpolates between the last two physics states so motion stays smooth on
 * 120/144 Hz screens too.
 */
class Game {
  constructor(canvas) {
    this.input = new Input();
    this.renderer = new Renderer(canvas);
    this.world = new World(LEVELS[0]);
    this.debug = new URLSearchParams(location.search).has('debug');
    this.time = 0;          // total real time, for background animation
    this.accumulator = 0;   // unsimulated time carried between frames
    this.lastFrame = 0;
    this.frame = this.frame.bind(this);
  }

  start() {
    this.lastFrame = performance.now();
    requestAnimationFrame(this.frame);
  }

  frame(now) {
    const dt = Math.min((now - this.lastFrame) / 1000, CONFIG.MAX_FRAME);
    this.lastFrame = now;
    this.accumulator += dt;
    while (this.accumulator >= CONFIG.STEP) {
      this.update(CONFIG.STEP);
      this.accumulator -= CONFIG.STEP;
    }
    this.render(this.accumulator / CONFIG.STEP);
    requestAnimationFrame(this.frame);
  }

  update(dt) {
    this.time += dt;
    this.input.pollGamepads();
    if (this.input.pressed('debug')) this.debug = !this.debug;
    this.world.update(dt, this.input);
    this.input.endStep();
  }

  /** @param alpha 0..1 - how far we are between the last physics step and the next */
  render(alpha) {
    const r = this.renderer;
    r.drawWorld(this.world, alpha, this.time);
    if (this.debug) {
      r.drawGrid(this.world.level);
      r.useWorld();
      this.world.drawDebug(r.ctx, alpha);
    }

    r.useView();
    const ctx = r.ctx;
    const p = this.world.player;
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(8, 8, 420, 26);
    ctx.fillStyle = '#fff';
    ctx.fillText(`Step 2 - move/jump   x:${p.x.toFixed(0)} y:${p.y.toFixed(0)} vy:${p.vy.toFixed(0)} ${p.grounded ? 'grounded' : 'air'}`, 16, 26);
  }
}

window.addEventListener('load', () => {
  window.game = new Game(document.getElementById('game'));
  window.game.start();
});
