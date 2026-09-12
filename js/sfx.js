/**
 * Sfx: tiny WebAudio blips, synthesised in code so the game needs no audio
 * files. Browsers only allow audio after a user gesture, so unlock() is
 * called on the first key press.
 *
 * Add a sound by adding an entry to SOUNDS and calling Sfx.play('name').
 */
const Sfx = {
  ctx: null,
  master: null,
  volume: 0.7,   // 0..1, set from Settings

  /** Create (or resume) the audio context. Safe to call often. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume * 0.4;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    if (this.master) this.master.gain.value = this.volume * 0.4;
  },

  /** One oscillator note, optionally sliding to another frequency. */
  tone(freq, duration, { type = 'square', volume = 0.5, slideTo = null, delay = 0 } = {}) {
    if (!this.ctx || this.volume <= 0) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + duration);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  },

  /** Filtered white noise, for thuds and stomps. */
  noise(duration, { volume = 0.3, frequency = 900, delay = 0 } = {}) {
    if (!this.ctx || this.volume <= 0) return;
    const t0 = this.ctx.currentTime + delay;
    const frames = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
  },

  play(name) {
    if (!this.ctx || this.volume <= 0) return;
    const sound = SOUNDS[name];
    if (sound) sound(this);
  },
};

const SOUNDS = {
  jump: (s) => s.tone(300, 0.13, { volume: 0.35, slideTo: 620 }),
  doubleJump: (s) => s.tone(520, 0.13, { volume: 0.3, slideTo: 900, type: 'triangle' }),
  land: (s) => s.noise(0.07, { volume: 0.18, frequency: 500 }),
  coin: (s) => {
    s.tone(988, 0.06, { volume: 0.3 });
    s.tone(1319, 0.16, { volume: 0.3, delay: 0.06 });
  },
  stomp: (s) => {
    s.tone(260, 0.14, { type: 'triangle', volume: 0.45, slideTo: 70 });
    s.noise(0.09, { volume: 0.25, frequency: 1400 });
  },
  hurt: (s) => s.tone(420, 0.28, { type: 'sawtooth', volume: 0.3, slideTo: 110 }),
  die: (s) => {
    [660, 550, 440, 300].forEach((f, i) => s.tone(f, 0.16, { type: 'square', volume: 0.3, delay: i * 0.1 }));
  },
  checkpoint: (s) => {
    [523, 659, 784, 1047].forEach((f, i) => s.tone(f, 0.16, { volume: 0.26, delay: i * 0.07 }));
  },
  oneUp: (s) => {
    [784, 1047, 1319].forEach((f, i) => s.tone(f, 0.14, { type: 'triangle', volume: 0.3, delay: i * 0.08 }));
  },
  goal: (s) => {
    [523, 659, 784, 1047, 1319].forEach((f, i) => s.tone(f, 0.3, { volume: 0.3, delay: i * 0.12 }));
  },
  pause: (s) => s.tone(440, 0.08, { type: 'triangle', volume: 0.25 }),
  spring: (s) => s.tone(320, 0.22, { type: 'triangle', volume: 0.4, slideTo: 1100 }),
  crumble: (s) => s.noise(0.18, { volume: 0.2, frequency: 700 }),
  menuMove: (s) => s.tone(660, 0.05, { type: 'triangle', volume: 0.22 }),
  menuSelect: (s) => {
    s.tone(784, 0.07, { type: 'square', volume: 0.26 });
    s.tone(1175, 0.12, { type: 'square', volume: 0.22, delay: 0.06 });
  },
  locked: (s) => s.tone(200, 0.14, { type: 'square', volume: 0.25, slideTo: 120 }),
};
