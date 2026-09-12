/**
 * Settings and Progress: the two things that outlive a session. Both are kept
 * in localStorage, which can be unavailable (private windows, file:// in some
 * browsers), so every read and write is wrapped - the game just runs with
 * defaults if storage is blocked.
 */

const Settings = {
  values: {
    musicVolume: 0.5,   // 0..1
    sfxVolume: 0.7,     // 0..1
    screenShake: true,
    doubleJump: false,  // the stretch ability, as an assist you can switch on
    muted: false,       // quick mute for everything (the M key)
  },

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem('ledge.settings') || '{}');
      Object.assign(this.values, saved);
    } catch (e) { /* storage blocked or corrupt: keep defaults */ }
    this.apply();
  },

  save() {
    try {
      localStorage.setItem('ledge.settings', JSON.stringify(this.values));
    } catch (e) { /* ignore */ }
  },

  get(key) { return this.values[key]; },

  set(key, value) {
    this.values[key] = value;
    this.apply();
    this.save();
  },

  /** Flip the quick mute; returns the new state. */
  toggleMute() {
    this.set('muted', !this.values.muted);
    return this.values.muted;
  },

  /** Push the current values into the systems that use them. */
  apply() {
    CONFIG.player.doubleJump = !!this.values.doubleJump;
    const mute = this.values.muted ? 0 : 1;
    if (typeof Sfx !== 'undefined') Sfx.setVolume(this.values.sfxVolume * mute);
    if (typeof Music !== 'undefined') Music.setVolume(this.values.musicVolume * mute);
  },
};

const Progress = {
  data: { completed: [], best: {} }, // completed: level ids; best: { id: {time, coins} }

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem('ledge.progress') || 'null');
      if (saved && Array.isArray(saved.completed)) this.data = { completed: saved.completed, best: saved.best || {} };
    } catch (e) { /* ignore */ }
  },

  save() {
    try {
      localStorage.setItem('ledge.progress', JSON.stringify(this.data));
    } catch (e) { /* ignore */ }
  },

  isComplete(index) {
    const level = LEVELS[index];
    return !!level && this.data.completed.includes(level.id);
  },

  /** Level 1 is always open; the rest need the level before them finished. */
  isUnlocked(index) {
    return index === 0 || this.isComplete(index - 1);
  },

  best(index) {
    const level = LEVELS[index];
    return level ? this.data.best[level.id] : null;
  },

  /** Record a finished level, keeping the best time and coin count. */
  complete(index, time, coins) {
    const level = LEVELS[index];
    if (!level) return;
    if (!this.data.completed.includes(level.id)) this.data.completed.push(level.id);
    const best = this.data.best[level.id];
    this.data.best[level.id] = {
      time: best ? Math.min(best.time, time) : time,
      coins: best ? Math.max(best.coins, coins) : coins,
    };
    this.save();
  },

  reset() {
    this.data = { completed: [], best: {} };
    this.save();
  },
};
