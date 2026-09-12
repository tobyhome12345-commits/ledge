/**
 * Input: maps keyboard keys and gamepad buttons to abstract actions.
 *
 *   input.held('left')      is the action down right now?
 *   input.pressed('jump')   did it go down since the last physics step?
 *   input.released('jump')  did it go up since the last physics step?
 *
 * Presses/releases are collected from events between steps and cleared by
 * endStep(), so every press is seen by exactly one physics step no matter
 * how the monitor's refresh rate lines up with the fixed timestep.
 */

/** Action -> list of KeyboardEvent.code values (and virtual "Pad:" codes). */
const KEY_BINDINGS = {
  left:    ['ArrowLeft', 'KeyA', 'Pad:left'],
  right:   ['ArrowRight', 'KeyD', 'Pad:right'],
  down:    ['ArrowDown', 'KeyS', 'Pad:down'],
  jump:    ['Space', 'KeyW', 'ArrowUp', 'Pad:a'],
  confirm: ['Enter', 'Space', 'Pad:a', 'Pad:start'],
  pause:   ['Escape', 'KeyP', 'Pad:start'],
  restart: ['KeyR', 'Pad:select'],
  quit:    ['KeyQ'],
  mute:    ['KeyM'],
  debug:   ['Backquote', 'F3'],
  // Menu navigation (menus are separate states, so these can share keys with play)
  menuUp:    ['ArrowUp', 'KeyW', 'Pad:up'],
  menuDown:  ['ArrowDown', 'KeyS', 'Pad:down'],
  menuLeft:  ['ArrowLeft', 'KeyA', 'Pad:left'],
  menuRight: ['ArrowRight', 'KeyD', 'Pad:right'],
  back:      ['Escape', 'KeyQ', 'Backspace', 'Pad:select'],
};

class Input {
  constructor() {
    this.down = new Set();      // codes currently held
    this.pressedSet = new Set(); // codes that went down since the last step
    this.releasedSet = new Set(); // codes that went up since the last step
    this.padHeld = new Set();    // virtual gamepad codes held last poll
    // Pointer state for clickable menus
    this.mouse = { clientX: 0, clientY: 0, moved: false, clicked: false };

    // Keys we handle ourselves (stop Space/arrows from scrolling, F3 from searching, ...)
    this.gameKeys = new Set(Object.values(KEY_BINDINGS).flat());

    window.addEventListener('keydown', (e) => {
      if (this.gameKeys.has(e.code)) e.preventDefault();
      Sfx.unlock();
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressedSet.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.releasedSet.add(e.code);
    });
    window.addEventListener('mousemove', (e) => {
      this.mouse.clientX = e.clientX;
      this.mouse.clientY = e.clientY;
      this.mouse.moved = true;
    });
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouse.clicked = true;
      Sfx.unlock();
    });

    // Losing focus would otherwise leave keys "stuck" down (the keyup goes elsewhere).
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => this.reset());
  }

  held(action) { return KEY_BINDINGS[action].some((c) => this.down.has(c)); }
  pressed(action) { return KEY_BINDINGS[action].some((c) => this.pressedSet.has(c)); }
  released(action) { return KEY_BINDINGS[action].some((c) => this.releasedSet.has(c)); }

  /** Call once at the end of every physics step. */
  endStep() {
    this.pressedSet.clear();
    this.releasedSet.clear();
    this.mouse.clicked = false;
    this.mouse.moved = false;
  }

  reset() {
    this.down.clear();
    this.padHeld.clear();
    this.endStep();
  }

  /** Read gamepads (standard mapping) and turn them into virtual key codes. Call once per step. */
  pollGamepads() {
    let pads = [];
    try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch { /* blocked by permissions policy */ }
    const now = new Set();
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      const btn = (i) => pad.buttons[i] && pad.buttons[i].pressed;
      const ax = pad.axes[0] || 0;
      const ay = pad.axes[1] || 0;
      if (btn(14) || ax < -0.4) now.add('Pad:left');
      if (btn(15) || ax > 0.4) now.add('Pad:right');
      if (btn(13) || ay > 0.6) now.add('Pad:down');
      if (btn(12) || ay < -0.6) now.add('Pad:up');
      if (btn(0) || btn(1)) now.add('Pad:a');   // A/B (Cross/Circle) both jump
      if (btn(9)) now.add('Pad:start');
      if (btn(8)) now.add('Pad:select');
    }
    for (const code of now) {
      if (!this.padHeld.has(code)) { this.down.add(code); this.pressedSet.add(code); }
    }
    for (const code of this.padHeld) {
      if (!now.has(code)) { this.down.delete(code); this.releasedSet.add(code); }
    }
    this.padHeld = now;
  }
}
