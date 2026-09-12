/**
 * Game: the main loop, the state machine, and everything that spans levels
 * (lives, the extra-life coin bank, whole-run totals).
 *
 *   title <-> levelSelect / options
 *   title -> playing <-> paused
 *            playing -> complete -> next level ... -> victory -> title
 *            playing -> gameover -> retry level
 *
 * Physics runs at a fixed 60 Hz (CONFIG.STEP) so jumps behave identically on
 * every monitor; rendering happens once per requestAnimationFrame and
 * interpolates between the last two physics states so motion stays smooth on
 * 120/144 Hz screens too.
 *
 * URL options: ?level=2 starts at level 2, ?debug shows the debug overlay.
 */
class Game {
  constructor(canvas) {
    this.input = new Input();
    this.renderer = new Renderer(canvas);
    this.hud = new Hud();
    Settings.load();
    Progress.load();

    const params = new URLSearchParams(location.search);
    this.debug = params.has('debug');
    this.firstLevel = clamp((parseInt(params.get('level'), 10) || 1) - 1, 0, LEVELS.length - 1);

    this.levelIndex = this.firstLevel;
    this.lives = CONFIG.startLives;
    this.coinBank = 0; // coins toward the next extra life
    this.runStats = { coins: 0, time: 0, deaths: 0 };

    this.menuIndex = 0;      // cursor in the current menu
    this.menuHitboxes = [];  // filled in by the menu screens, for the mouse
    this.confirmReset = false;
    this.audioReady = false; // audio can only start after the first input

    this.fade = 0;          // 0..1 black overlay for transitions
    this.fadeDir = 0;       // 1 = fading out, -1 = fading in
    this.fadeAction = null; // runs while the screen is fully black

    this.time = 0;          // total simulated time, for UI animation
    this.accumulator = 0;   // unsimulated time carried between frames
    this.lastFrame = 0;
    this.fps = 60;
    this.frame = this.frame.bind(this);

    this.goToTitle();

    // Pause automatically if the window loses focus mid-game.
    const autoPause = () => { if (this.state === 'playing') this.setState('paused'); };
    window.addEventListener('blur', autoPause);
    document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
  }

  start() {
    this.lastFrame = performance.now();
    requestAnimationFrame(this.frame);
  }

  frame(now) {
    const elapsed = (now - this.lastFrame) / 1000;
    const dt = Math.min(elapsed, CONFIG.MAX_FRAME);
    this.lastFrame = now;
    if (elapsed > 0) this.fps += (1 / elapsed - this.fps) * 0.05;
    this.accumulator += dt;
    while (this.accumulator >= CONFIG.STEP) {
      this.update(CONFIG.STEP);
      this.accumulator -= CONFIG.STEP;
    }
    this.render(this.accumulator / CONFIG.STEP);
    requestAnimationFrame(this.frame);
  }

  // ---------------------------------------------------------------------------
  // Flow
  // ---------------------------------------------------------------------------

  setState(state) {
    this.state = state;
    this.stateTime = 0;
  }

  /** Switch to a menu state with the cursor on `index`. */
  openMenu(state, index = 0) {
    this.setState(state);
    this.menuIndex = index;
    this.menuHitboxes = [];
    this.confirmReset = false;
  }

  makeWorld(index) {
    return new World(LEVELS[index], {
      onPlayerDown: (lostLife) => this.onPlayerDown(lostLife),
      onLevelComplete: () => this.onLevelComplete(),
      onCoin: () => this.onCoin(),
    });
  }

  goToTitle() {
    this.world = this.makeWorld(this.firstLevel);
    this.world.demo = true; // the level scrolls by behind the logo
    this.openMenu('title');
  }

  newGame(levelIndex = this.firstLevel) {
    this.lives = CONFIG.startLives;
    this.coinBank = 0;
    this.runStats = { coins: 0, time: 0, deaths: 0 };
    this.loadLevel(levelIndex);
  }

  loadLevel(index) {
    this.levelIndex = index;
    this.world = this.makeWorld(index);
    this.hud = new Hud();
    this.setState('playing');
  }

  /** Fade to black, run `action` while the screen is dark, then fade back in. */
  transition(action) {
    if (this.fadeDir !== 0) return;
    this.fadeDir = 1;
    this.fadeAction = action;
  }

  updateFade(dt) {
    if (this.fadeDir > 0) {
      this.fade = Math.min(1, this.fade + dt / CONFIG.death.fadeOut);
      if (this.fade === 1) {
        const action = this.fadeAction;
        this.fadeAction = null;
        this.fadeDir = -1;
        if (action) action();
      }
    } else if (this.fadeDir < 0) {
      this.fade = Math.max(0, this.fade - dt / CONFIG.death.fadeIn);
      if (this.fade === 0) this.fadeDir = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // World events
  // ---------------------------------------------------------------------------

  /** The death animation finished. Spend a life if needed, then respawn. */
  onPlayerDown(lostLife) {
    if (lostLife) {
      this.lives -= 1;
      if (this.lives <= 0) {
        this.setState('gameover');
        return;
      }
    }
    this.transition(() => this.world.respawnPlayer(lostLife));
  }

  onLevelComplete() {
    const w = this.world;
    this.runStats.coins += w.stats.coins;
    this.runStats.deaths += w.stats.deaths;
    this.runStats.time += w.clock;
    Progress.complete(this.levelIndex, w.clock, w.stats.coins); // unlocks the next level
    this.setState('complete');
  }

  onCoin() {
    this.coinBank += 1;
    if (this.coinBank >= CONFIG.coinsPerLife) {
      this.coinBank -= CONFIG.coinsPerLife;
      this.lives += 1;
      const p = this.world.player;
      this.world.popup('1UP!', p.x + p.w / 2, p.y - 16, '#7dffb8');
      Sfx.play('oneUp');
    }
  }

  // ---------------------------------------------------------------------------
  // Menus
  // ---------------------------------------------------------------------------

  /** Which menu row is the mouse over? -1 for none. */
  pickHitbox() {
    const m = this.input.mouse;
    const p = this.renderer.viewFromClient(m.clientX, m.clientY);
    for (const box of this.menuHitboxes) {
      if (p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h) return box.index;
    }
    return -1;
  }

  /**
   * Shared list-menu behaviour: move the cursor with the keyboard or mouse,
   * select with Enter or a click, leave with Esc.
   */
  updateMenu(count, { horizontal = false, cols = 0, onSelect, onBack } = {}) {
    const input = this.input;
    const before = this.menuIndex;
    if (cols > 0) {
      // Grid: left/right step one card, up/down jump a whole row
      if (input.pressed('menuLeft')) this.menuIndex = (this.menuIndex - 1 + count) % count;
      if (input.pressed('menuRight')) this.menuIndex = (this.menuIndex + 1) % count;
      if (input.pressed('menuUp')) this.menuIndex = (this.menuIndex - cols + count) % count;
      if (input.pressed('menuDown')) this.menuIndex = (this.menuIndex + cols) % count;
    } else {
      const prevKey = horizontal ? 'menuLeft' : 'menuUp';
      const nextKey = horizontal ? 'menuRight' : 'menuDown';
      if (input.pressed(prevKey)) this.menuIndex = (this.menuIndex - 1 + count) % count;
      if (input.pressed(nextKey)) this.menuIndex = (this.menuIndex + 1) % count;
    }

    const hover = this.pickHitbox();
    if (hover >= 0 && input.mouse.moved) this.menuIndex = hover;
    if (this.menuIndex !== before) Sfx.play('menuMove');

    const clicked = input.mouse.clicked && hover >= 0;
    if (clicked) this.menuIndex = hover;
    if (onSelect && (clicked || input.pressed('confirm'))) onSelect(this.menuIndex);
    else if (onBack && input.pressed('back')) onBack();
  }

  updateOptions() {
    const input = this.input;
    const before = this.menuIndex;
    if (input.pressed('menuUp')) this.menuIndex = (this.menuIndex - 1 + OPTION_ROWS.length) % OPTION_ROWS.length;
    if (input.pressed('menuDown')) this.menuIndex = (this.menuIndex + 1) % OPTION_ROWS.length;
    const hover = this.pickHitbox();
    if (hover >= 0 && input.mouse.moved) this.menuIndex = hover;
    if (this.menuIndex !== before) {
      Sfx.play('menuMove');
      this.confirmReset = false;
    }

    const row = OPTION_ROWS[this.menuIndex];
    const clicked = input.mouse.clicked && hover === this.menuIndex;

    if (row.type === 'volume') {
      const current = Settings.get(row.key);
      let value = current;
      if (input.pressed('menuLeft')) value -= 0.1;
      if (input.pressed('menuRight')) value += 0.1;
      value = clamp(Math.round(value * 10) / 10, 0, 1);
      if (value !== current) {
        if (Settings.get('muted')) Settings.set('muted', false); // adjusting volume unmutes
        Settings.set(row.key, value);
        Sfx.play('menuMove'); // so you hear the level you just picked
      }
    } else if (row.type === 'toggle') {
      if (clicked || input.pressed('confirm') || input.pressed('menuLeft') || input.pressed('menuRight')) {
        Settings.set(row.key, !Settings.get(row.key));
        Sfx.play('menuSelect');
      }
    } else if (row.type === 'action' && (clicked || input.pressed('confirm'))) {
      if (this.confirmReset) {
        Progress.reset();
        this.confirmReset = false;
        Sfx.play('menuSelect');
      } else {
        this.confirmReset = true;
        Sfx.play('locked');
      }
    }

    if (input.pressed('back')) this.openMenu('title', 2);
  }

  /** Music follows whatever level is on screen; menus keep playing it. */
  updateMusic() {
    if (!this.audioReady) return;
    Music.setDucked(this.state === 'paused');
    Music.play((this.world && this.world.data.theme) || 'meadow');
  }

  // ---------------------------------------------------------------------------
  // Update / render
  // ---------------------------------------------------------------------------

  update(dt) {
    const input = this.input;
    this.time += dt;
    this.stateTime += dt;
    input.pollGamepads();

    // Browsers only allow audio to start from a user gesture.
    if (!this.audioReady && (input.down.size > 0 || input.mouse.clicked)) {
      this.audioReady = true;
      Sfx.unlock();
    }
    if (input.pressed('debug')) this.debug = !this.debug;
    if (input.pressed('mute') && !Settings.toggleMute()) Sfx.play('pause');
    const busy = this.fadeDir !== 0; // ignore menu keys mid-transition

    switch (this.state) {
      case 'title':
        this.world.update(dt, NO_INPUT);
        this.panMenuCamera();
        if (!busy) {
          this.updateMenu(TITLE_ITEMS.length, {
            onSelect: (i) => {
              Sfx.play('menuSelect');
              if (i === 0) this.transition(() => this.newGame());
              else if (i === 1) this.openMenu('levelSelect', clamp(this.levelIndex, 0, LEVELS.length - 1));
              else this.openMenu('options');
            },
          });
        }
        break;

      case 'levelSelect':
        this.world.update(dt, NO_INPUT);
        this.panMenuCamera();
        if (!busy) {
          this.updateMenu(LEVELS.length, {
            cols: LEVEL_SELECT_COLS,
            onSelect: (i) => {
              if (Progress.isUnlocked(i)) {
                Sfx.play('menuSelect');
                this.transition(() => this.newGame(i));
              } else {
                Sfx.play('locked');
              }
            },
            onBack: () => this.openMenu('title', 1),
          });
        }
        break;

      case 'options':
        this.world.update(dt, NO_INPUT);
        this.panMenuCamera();
        if (!busy) this.updateOptions();
        break;

      case 'playing':
        if (!busy && input.pressed('pause')) {
          this.setState('paused');
          Sfx.play('pause');
          break;
        }
        this.world.update(dt, input);
        this.hud.update(dt, this.world);
        break;

      case 'paused':
        if (busy) break;
        if (input.pressed('pause') || input.pressed('confirm')) this.setState('playing');
        else if (input.pressed('restart')) this.transition(() => this.loadLevel(this.levelIndex));
        else if (input.pressed('quit')) this.transition(() => this.goToTitle());
        break;

      case 'complete':
        this.world.update(dt, NO_INPUT);
        this.hud.update(dt, this.world);
        if (!busy && this.stateTime > 1 && input.pressed('confirm')) {
          const next = this.levelIndex + 1;
          if (next < LEVELS.length) this.transition(() => this.loadLevel(next));
          else this.transition(() => this.setState('victory'));
        }
        break;

      case 'gameover':
        this.world.update(dt, NO_INPUT);
        if (!busy && this.stateTime > 1) {
          if (input.pressed('confirm')) {
            this.transition(() => {
              this.lives = CONFIG.startLives;
              this.coinBank = 0;
              this.loadLevel(this.levelIndex);
            });
          } else if (input.pressed('quit')) {
            this.transition(() => this.goToTitle());
          }
        }
        break;

      case 'victory':
        this.world.update(dt, NO_INPUT);
        if (!busy && this.stateTime > 1 && input.pressed('confirm')) this.transition(() => this.goToTitle());
        break;
    }

    this.updateMusic();
    this.updateFade(dt);
    input.endStep();
  }

  /** Slowly sweep the camera across the level behind the menus. */
  panMenuCamera() {
    const cam = this.world.camera;
    const level = this.world.level;
    const range = Math.max(0, level.width - CONFIG.VIEW_W);
    cam.px = cam.x;
    cam.py = cam.y;
    cam.x = range * (0.5 - 0.5 * Math.cos(this.time * 0.04));
    cam.y = Math.max(0, level.height - CONFIG.VIEW_H);
  }

  /** @param alpha 0..1 - how far we are between the last physics step and the next */
  render(alpha) {
    const r = this.renderer;
    const ctx = r.ctx;
    const W = CONFIG.VIEW_W;
    const H = CONFIG.VIEW_H;
    const inLevel = ['playing', 'paused', 'complete', 'gameover'].includes(this.state);

    r.drawWorld(this.world, alpha, this.time);
    if (this.debug && inLevel) {
      r.drawGrid(this.world.level);
      r.useWorld();
      this.world.drawDebug(ctx, alpha);
    }

    r.useView();
    if (this.world.flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.world.flash * 0.45})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (inLevel) this.hud.draw(ctx, this.world, this.lives);

    switch (this.state) {
      case 'title': Screens.title(ctx, this); break;
      case 'levelSelect': Screens.levelSelect(ctx, this); break;
      case 'options': Screens.options(ctx, this); break;
      case 'paused': Screens.pause(ctx, this); break;
      case 'complete': Screens.levelClear(ctx, this); break;
      case 'gameover': Screens.gameOver(ctx, this); break;
      case 'victory': Screens.victory(ctx, this); break;
    }
    if (this.debug && inLevel) this.hud.drawDebug(ctx, this.world, this.fps);

    if (this.fade > 0) {
      ctx.fillStyle = `rgba(8, 9, 20, ${this.fade})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}

window.addEventListener('load', () => {
  window.game = new Game(document.getElementById('game'));
  window.game.start();
});
