/**
 * Music: a tiny chiptune sequencer. Like the sound effects, everything is
 * synthesised at runtime - no audio files.
 *
 * Each track is a four bar loop of eighth notes with three voices: a bass
 * note, an arpeggio of the current chord, and a melody. Notes are MIDI
 * numbers. Notes are scheduled slightly ahead of time against the audio
 * clock, which keeps the timing steady even when the frame rate wobbles.
 */
const MUSIC_TRACKS = {
  // Bright and bouncy: C - G - Am - F
  meadow: {
    bpm: 132,
    bars: [
      { bass: 48, chord: [60, 64, 67] },
      { bass: 43, chord: [55, 59, 62] },
      { bass: 45, chord: [57, 60, 64] },
      { bass: 41, chord: [53, 57, 60] },
    ],
    melody: [
      [72, null, 74, 76, null, 79, null, 76],
      [74, null, 71, null, 74, null, 79, null],
      [76, null, 74, 72, null, 69, null, 72],
      [74, null, 76, 77, null, 79, null, null],
    ],
  },

  // Warmer and slower: Am - F - C - G
  dusk: {
    bpm: 104,
    bars: [
      { bass: 45, chord: [57, 60, 64] },
      { bass: 41, chord: [53, 57, 60] },
      { bass: 48, chord: [60, 64, 67] },
      { bass: 43, chord: [55, 59, 62] },
    ],
    melody: [
      [69, null, null, 72, null, 76, null, null],
      [72, null, 71, null, 69, null, null, null],
      [67, null, 69, null, 72, null, 76, null],
      [74, null, null, 71, null, 67, null, null],
    ],
  },

  // Fast and tense: Dm - A - Bb - C
  ember: {
    bpm: 146,
    bars: [
      { bass: 38, chord: [62, 65, 69] },
      { bass: 45, chord: [57, 61, 64] },
      { bass: 34, chord: [58, 62, 65] },
      { bass: 36, chord: [60, 64, 67] },
    ],
    melody: [
      [74, null, 77, null, 74, null, 70, null],
      [76, null, 73, null, 76, null, 81, null],
      [77, null, 74, null, 70, null, 74, null],
      [72, null, 76, null, 79, null, 76, null],
    ],
  },

  // Sparse and uneasy: Dm - Bb - F - A
  cavern: {
    bpm: 92,
    bars: [
      { bass: 38, chord: [62, 65, 69] },
      { bass: 34, chord: [58, 62, 65] },
      { bass: 41, chord: [53, 57, 60] },
      { bass: 45, chord: [57, 61, 64] },
    ],
    melody: [
      [74, null, null, null, 77, null, null, null],
      [null, null, 74, null, null, null, 70, null],
      [72, null, null, null, 69, null, null, null],
      [null, null, 68, null, 69, null, null, null],
    ],
  },
};

const midiToFreq = (note) => 440 * Math.pow(2, (note - 69) / 12);

const Music = {
  volume: 0.5,
  ducked: false,   // quieter while paused
  current: null,   // name of the playing track
  track: null,
  gain: null,
  timer: null,
  step: 0,
  nextTime: 0,

  /** Make sure we have an audio context and our own gain node. */
  ensure() {
    Sfx.unlock();
    if (!Sfx.ctx) return false;
    if (!this.gain) {
      this.gain = Sfx.ctx.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(Sfx.ctx.destination);
    }
    return true;
  },

  targetGain() {
    return this.volume * (this.ducked ? 0.25 : 1) * 0.5;
  },

  applyGain(immediate = false) {
    if (!this.gain || !Sfx.ctx) return;
    const v = this.current ? this.targetGain() : 0;
    if (immediate) this.gain.gain.value = v;
    else this.gain.gain.setTargetAtTime(v, Sfx.ctx.currentTime, 0.08);
  },

  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    this.applyGain();
  },

  setDucked(ducked) {
    this.ducked = ducked;
    this.applyGain();
  },

  /** Start (or switch to) a track by name. Re-calling with the same name is a no-op. */
  play(name) {
    const track = MUSIC_TRACKS[name] || MUSIC_TRACKS.meadow;
    if (this.current === name && this.timer) return;
    const switching = this.current !== null;
    this.current = name;
    this.track = track;
    if (switching) this.step = 0;
    if (!this.ensure()) return;
    this.nextTime = Sfx.ctx.currentTime + 0.06;
    this.applyGain();
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 25);
  },

  stop() {
    this.current = null;
    this.track = null;
    this.applyGain();
    clearInterval(this.timer);
    this.timer = null;
  },

  /** Schedule any notes that fall inside the lookahead window. */
  schedule() {
    const ctx = Sfx.ctx;
    if (!ctx || !this.track) return;
    if (this.volume <= 0) { // muted: keep the clock moving, play nothing
      this.nextTime = ctx.currentTime;
      return;
    }
    const stepDur = 60 / this.track.bpm / 2; // eighth notes
    // If the tab was hidden the timer stalls; skip forward instead of catching up.
    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.02;
    let guard = 0;
    while (this.nextTime < ctx.currentTime + 0.15 && guard++ < 32) {
      this.playStep(this.step, this.nextTime, stepDur);
      this.step = (this.step + 1) % (this.track.bars.length * 8);
      this.nextTime += stepDur;
    }
  },

  playStep(step, time, stepDur) {
    const bar = Math.floor(step / 8);
    const beat = step % 8;
    const { bass, chord } = this.track.bars[bar];
    const melody = this.track.melody[bar][beat];

    if (beat === 0 || beat === 4) this.note(bass, time, stepDur * 1.6, 'triangle', 0.5);
    // Arpeggio: one chord tone per eighth, quiet, so it sits under the melody
    this.note(chord[step % chord.length], time, stepDur * 0.7, 'square', 0.09);
    if (melody !== null && melody !== undefined) this.note(melody, time, stepDur * 1.5, 'square', 0.2);
    // Soft off-beat tick for a sense of pulse
    if (beat % 2 === 1) this.tick(time, 0.04);
  },

  note(midi, time, duration, type, volume) {
    const ctx = Sfx.ctx;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.value = midiToFreq(midi);
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(volume, time + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(env).connect(this.gain);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  },

  tick(time, volume) {
    const ctx = Sfx.ctx;
    const frames = Math.floor(ctx.sampleRate * 0.03);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 4000;
    const env = ctx.createGain();
    env.gain.value = volume;
    src.connect(filter).connect(env).connect(this.gain);
    src.start(time);
  },
};
