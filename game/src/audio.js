// audio.js — all sound is synthesised with Web Audio. No audio files.
// Engine hum follows throttle, wind follows speed, plus lock beeps and impacts.

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.windGain = null;
    this.windFilter = null;
    this.started = false;
  }

  // Must be called from a user gesture (menu click / first keypress).
  start() {
    if (this.started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      // Engine: two detuned sawtooths through a low-pass.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.value = 55.7;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 1.2;
      this.engineOsc.connect(lp); osc2.connect(lp);
      lp.connect(this.engineGain); this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start(); osc2.start();
      this._osc2 = osc2;
      // Wind: looping noise buffer through a band-pass.
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 500; this.windFilter.Q.value = 0.6;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.0;
      src.connect(this.windFilter); this.windFilter.connect(this.windGain);
      this.windGain.connect(this.ctx.destination);
      src.start();
      this.started = true;
    } catch (e) {
      this.started = false; // audio is garnish; the game plays without it
    }
  }

  update(throttle, speedKts, afterburner) {
    if (!this.started || !this.ctx) return;
    const t = this.ctx.currentTime;
    const freq = 42 + throttle * 95 + (afterburner ? 30 : 0);
    this.engineOsc.frequency.setTargetAtTime(freq, t, 0.1);
    this._osc2.frequency.setTargetAtTime(freq * 1.012, t, 0.1);
    this.engineGain.gain.setTargetAtTime(0.02 + throttle * 0.05, t, 0.15);
    this.windFilter.frequency.setTargetAtTime(300 + speedKts * 1.6, t, 0.2);
    this.windGain.gain.setTargetAtTime(Math.min(0.09, speedKts * 0.00016), t, 0.2);
  }

  _beep(freq, dur, type = 'sine', vol = 0.12) {
    if (!this.started || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur);
  }

  lockBeep() { this._beep(880, 0.09, 'sine', 0.1); }
  lockDone() { this._beep(1320, 0.25, 'sine', 0.14); this._beep(1760, 0.3, 'sine', 0.1); }
  ringChime() { this._beep(1046, 0.18, 'triangle', 0.14); this._beep(1568, 0.28, 'triangle', 0.1); }
  warning() { this._beep(440, 0.2, 'square', 0.06); }
  impact() {
    if (!this.started || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'triangle'; o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.4);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + 0.5);
  }
}
