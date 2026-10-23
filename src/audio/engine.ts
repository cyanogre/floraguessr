import { degreeToMidi, midiToHz, scaleFor, type Scale } from './scales';

const TEMPO = 74;
const STEP = 60 / TEMPO / 4;
const LEVEL = 0.5;
const DUCKED = 0.2;

export type Sfx = 'open' | 'pick' | 'ok' | 'no' | 'tick';

/**
 * Música generativa: acordes lentos, bajo, percusión suave y una melodía que pasea por la escala
 * del continente. Arranca solo tras un gesto del jugador (política de autoplay).
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private send!: GainNode;
  private noise!: AudioBuffer;
  private scale: Scale = scaleFor('EUROPE', 40, 0);
  private step = 0;
  private t = 0;
  private melody = 4;
  private chordDeg = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private ducked = false;
  enabled = true;

  start(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const c = (this.ctx = new Ctx());
    const comp = c.createDynamicsCompressor();
    this.master = c.createGain();
    this.master.gain.value = this.enabled ? LEVEL : 0;
    this.master.connect(comp).connect(c.destination);

    // Reverb con ruido decreciente y un eco a corchea con puntillo.
    const len = c.sampleRate * 3;
    const ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
    }
    const verb = c.createConvolver();
    verb.buffer = ir;
    const wet = c.createGain();
    wet.gain.value = 0.7;
    verb.connect(wet).connect(this.master);
    const delay = c.createDelay(1);
    delay.delayTime.value = (60 / TEMPO) * 0.75;
    const fb = c.createGain();
    fb.gain.value = 0.36;
    delay.connect(fb).connect(delay);
    delay.connect(verb);
    this.send = c.createGain();
    this.send.connect(verb);
    this.send.connect(delay);

    this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    this.t = c.currentTime + 0.2;
    this.timer = setInterval(() => this.schedule(), 100);
  }

  setPlace(continent: Parameters<typeof scaleFor>[0], lat: number, lng: number): Scale {
    this.scale = scaleFor(continent, lat, lng);
    this.melody = this.scale.intervals.length;
    return this.scale;
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    this.applyLevel();
    return this.enabled;
  }

  duck(on: boolean): void {
    this.ducked = on;
    this.applyLevel();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void this.ctx?.close();
    this.ctx = null;
  }

  sfx(kind: Sfx): void {
    const c = this.ctx;
    if (!c || !this.enabled) return;
    const t = c.currentTime + 0.02;
    const n = this.scale.intervals.length;
    const hz = (d: number) => midiToHz(degreeToMidi(this.scale, d) + 12);
    if (kind === 'open') {
      this.noiseHit(t, 0.9, 0.16, 'bandpass', 300, 3500);
      [0, 2, 4, 7].forEach((d, i) => this.tone('sine', hz(d + n), t + 0.5 + i * 0.09, 1.8, 0.07, 0.01, 0.9));
    }
    if (kind === 'pick') this.tone('triangle', hz(2), t, 0.25, 0.11, 0.005, 0.5);
    if (kind === 'ok') [0, 2, 4, 6].forEach((d, i) => this.tone('triangle', hz(d + n), t + i * 0.1, 1.3, 0.09, 0.01, 0.9));
    if (kind === 'no') [0, 1].forEach((i) => this.tone('sine', midiToHz(this.scale.root - i * 3), t + i * 0.2, 1, 0.15, 0.02, 0.3, 500));
    if (kind === 'tick') this.noiseHit(t, 0.05, 0.05, 'highpass', 4000);
  }

  private applyLevel(): void {
    if (!this.ctx) return;
    const v = this.enabled ? (this.ducked ? DUCKED : LEVEL) : 0;
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2);
  }

  private schedule(): void {
    const c = this.ctx!;
    while (this.t < c.currentTime + 0.4) {
      this.beat(this.t, this.step++);
      this.t += STEP;
    }
  }

  private beat(t: number, i: number): void {
    const s = i % 16;
    const bar = i >> 4;
    const sc = this.scale;
    const n = sc.intervals.length;
    const swing = t + (s % 2 ? 0.03 : 0);
    const barLen = 240 / TEMPO;
    const note = (d: number) => degreeToMidi(sc, d);
    if (s === 0) {
      this.chordDeg = [0, 3, 4, 2][bar % 4] % n;
      const d = this.chordDeg;
      const chord = [d, d + 2, d + 4].concat(Math.random() < 0.5 ? [d + 6] : []);
      for (const k of chord) for (const det of [-7, 7]) this.tone('triangle', midiToHz(note(k)), t, barLen + 1, 0.032, 1.1, 0.5, 900, det);
      if (sc.drone) {
        this.tone('sine', midiToHz(sc.root - 24), t, barLen + 1.5, 0.08, 1.5, 0.2);
        this.tone('sine', midiToHz(sc.root - 17), t, barLen + 1.5, 0.04, 1.5, 0.2);
      }
    }
    if (s === 0 || s === 10) this.tone('sine', midiToHz(note(this.chordDeg) - 24), swing, 1.2, 0.15, 0.02, 0.1, 400);
    if (s % 8 === 0 || (s === 14 && Math.random() < 0.3)) this.kick(swing);
    if (s % 4 === 2) this.noiseHit(swing, 0.05, 0.035 + Math.random() * 0.03, 'highpass', 7000);
    const p = (s % 4 === 0 ? 0.5 : s % 2 === 0 ? 0.28 : 0.1) * (bar % 8 > 5 ? 0.15 : 1);
    if (Math.random() < p) {
      const moves = [-2, -1, -1, 0, 1, 1, 2];
      this.melody = Math.max(2, Math.min(n * 2 + 1, this.melody + moves[Math.floor(Math.random() * moves.length)]));
      this.tone('triangle', midiToHz(note(this.melody) + 12), swing, 1.6, 0.065, 0.005, 0.7, 2400);
      this.tone('sine', midiToHz(note(this.melody) + 24), swing, 0.8, 0.02, 0.005, 0.8);
    }
  }

  private tone(type: OscillatorType, f: number, t: number, dur: number, gain: number, attack = 0.01, send = 0.4, lowpass = 0, detune = 0): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    const env = c.createGain();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    let node: AudioNode = o;
    if (lowpass) {
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = lowpass;
      node = o.connect(lp);
    }
    node.connect(env);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    env.connect(this.master);
    const sg = c.createGain();
    sg.gain.value = send;
    env.connect(sg).connect(this.send);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  private noiseHit(t: number, dur: number, gain: number, type: BiquadFilterType, f: number, to?: number): void {
    const c = this.ctx!;
    const src = c.createBufferSource();
    const fl = c.createBiquadFilter();
    const env = c.createGain();
    src.buffer = this.noise;
    fl.type = type;
    fl.frequency.setValueAtTime(f, t);
    if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl).connect(env).connect(this.master);
    if (to) env.connect(this.send);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur);
  }

  private kick(t: number): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    const e = c.createGain();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.16);
    e.gain.setValueAtTime(0.28, t);
    e.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(e).connect(this.master);
    o.start(t);
    o.stop(t + 0.35);
  }
}
