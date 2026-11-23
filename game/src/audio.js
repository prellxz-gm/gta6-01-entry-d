// Palmar Bay — WebAudio synth: SFX + 3 radio stations (oscillator music, no files).
import { RADIO } from './config.js';

const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.radioOn = false;
    this.station = 0;
    this.radioTimer = null;
    this.step = 0;
    this.muted = false;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  }
  tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  sfx(name) {
    if (!this.ctx) return;
    if (name === 'shoot') this.tone(880, 0.12, 'square', 0.25, 0, 120);
    else if (name === 'punch') this.tone(160, 0.1, 'sine', 0.3, 0, 60);
    else if (name === 'pickup') { this.tone(660, 0.1, 'sine', 0.2); this.tone(990, 0.15, 'sine', 0.2, 0.09); }
    else if (name === 'complete') { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.22, i * 0.11)); }
    else if (name === 'fail') { [330, 262, 196].forEach((f, i) => this.tone(f, 0.25, 'sawtooth', 0.15, i * 0.13)); }
    else if (name === 'siren') { this.tone(700, 0.4, 'sine', 0.06, 0, 950); this.tone(950, 0.4, 'sine', 0.06, 0.4, 700); }
    else if (name === 'checkpoint') { this.tone(784, 0.12, 'sine', 0.2); this.tone(1175, 0.18, 'sine', 0.2, 0.08); }
    else if (name === 'crash') this.tone(90, 0.3, 'sawtooth', 0.3, 0, 40);
    else if (name === 'steal') { this.tone(440, 0.1, 'square', 0.15); this.tone(587, 0.14, 'square', 0.15, 0.09); }
    else if (name === 'click') this.tone(1200, 0.05, 'sine', 0.12);
  }
  startRadio() {
    this.ensure();
    if (!this.ctx || this.radioOn) return;
    this.radioOn = true;
    this.step = 0;
    this.radioTimer = setInterval(() => this.radioStep(), 240);
  }
  stopRadio() {
    this.radioOn = false;
    if (this.radioTimer) { clearInterval(this.radioTimer); this.radioTimer = null; }
  }
  nextStation() {
    this.station = (this.station + 1) % RADIO.length;
    this.step = 0;
    return RADIO[this.station];
  }
  radioStep() {
    if (!this.ctx || this.muted || !this.radioOn) return;
    const st = RADIO[this.station];
    const scale = SCALES[st.minor ? 'minor' : 'major'];
    const bar = Math.floor(this.step / 8) % 4;
    const roots = [0, 3, 5, 4];
    const root = roots[bar];
    const deg = scale[this.step % scale.length] + root;
    const freq = st.base * Math.pow(2, deg / 12);
    if (this.step % 2 === 0) this.tone(freq, 0.22, st.wave, 0.07);
    if (this.step % 8 === 0) this.tone(st.base / 2, 0.5, 'sine', 0.12);
    if (this.step % 4 === 2) this.tone(180, 0.06, 'sine', 0.1, 0, 60);
    this.step += 1;
  }
  toggleMute() { this.muted = !this.muted; return this.muted; }
}
