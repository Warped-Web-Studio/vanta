import { frame } from "../frame";

// Opt-in sound, synthesized entirely in WebAudio (nothing to download). Mechanical and
// atmospheric only: room tone, air that follows the smoke and the pointer, switchgear
// clicks, a low abstract resonance tied to RPM and firing, wind at speed. No engine loop.

function noiseBuffer(ctx: AudioContext, seconds: number, brown: boolean) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  return buf;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private air!: { gain: GainNode; filter: BiquadFilterNode };
  private wind!: { gain: GainNode; filter: BiquadFilterNode };
  private reso!: { gain: GainNode; a: OscillatorNode; b: OscillatorNode; filter: BiquadFilterNode };
  private room!: GainNode;
  private enabled = false;
  private lastScene = -1;
  private white: AudioBuffer | null = null;

  get on() {
    return this.enabled;
  }

  enable() {
    if (!this.ctx) this.build();
    if (!this.ctx) return;
    void this.ctx.resume();
    this.enabled = true;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0.063, t, 0.4); // -24 dB
  }

  disable() {
    this.enabled = false;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(0, t, 0.15);
  }

  private build() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(comp).connect(ctx.destination);

    const brown = noiseBuffer(ctx, 4, true);
    this.white = noiseBuffer(ctx, 2, false);
    const loop = (buf: AudioBuffer) => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.start();
      return s;
    };

    // room tone
    const roomF = ctx.createBiquadFilter();
    roomF.type = "lowpass";
    roomF.frequency.value = 180;
    this.room = ctx.createGain();
    this.room.gain.value = 0.32;
    loop(brown).connect(roomF).connect(this.room).connect(this.master);

    // air (smoke)
    const airF = ctx.createBiquadFilter();
    airF.type = "bandpass";
    airF.frequency.value = 900;
    airF.Q.value = 0.7;
    const airG = ctx.createGain();
    airG.gain.value = 0;
    loop(this.white).connect(airF).connect(airG).connect(this.master);
    this.air = { gain: airG, filter: airF };

    // wind (speed)
    const windF = ctx.createBiquadFilter();
    windF.type = "lowpass";
    windF.frequency.value = 400;
    const windG = ctx.createGain();
    windG.gain.value = 0;
    loop(brown).connect(windF).connect(windG).connect(this.master);
    this.wind = { gain: windG, filter: windF };

    // resonance (power): two detuned partials through a low filter
    const a = ctx.createOscillator();
    const b = ctx.createOscillator();
    a.type = "triangle";
    b.type = "sine";
    const rf = ctx.createBiquadFilter();
    rf.type = "lowpass";
    rf.frequency.value = 600;
    rf.Q.value = 2;
    const rg = ctx.createGain();
    rg.gain.value = 0;
    a.connect(rf);
    b.connect(rf);
    rf.connect(rg).connect(this.master);
    a.start();
    b.start();
    this.reso = { gain: rg, a, b, filter: rf };
  }

  /** a switchgear click: a short filtered transient and a small metallic ping */
  click(pitch = 1) {
    if (!this.enabled || !this.ctx || !this.white) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 3200 * pitch;
    f.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 0.05);
    const o = ctx.createOscillator();
    o.frequency.value = 2100 * pitch;
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.12, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(og).connect(this.master);
    o.start(t);
    o.stop(t + 0.1);
  }

  /** a soft low detent when the film locks into a new scene */
  private detent() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(96, t);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.3);
  }

  update() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const scene = frame.scene.index;
    if (scene !== this.lastScene) {
      if (this.lastScene >= 0) this.detent();
      this.lastScene = scene;
    }
    const p = frame.pointer;
    // air: rises with pointer speed in the smoke, and with the wind that clears it
    const smoke = scene === 0 ? 1 : 0;
    const agitation = Math.min(1, p.speed / 4) * smoke + (scene === 0 ? frame.scroll.energy * 0.8 : 0);
    this.air.gain.gain.setTargetAtTime(0.02 * smoke + agitation * 0.5, t, 0.08);
    this.air.filter.frequency.setTargetAtTime(500 + agitation * 2600, t, 0.1);
    // wind at speed
    const sp = scene === 7 ? Math.min(1.2, frame.live.speed / 299) : 0;
    this.wind.gain.gain.setTargetAtTime(Math.pow(sp, 1.5) * 0.9, t, 0.15);
    this.wind.filter.frequency.setTargetAtTime(300 + sp * 2800, t, 0.15);
    // resonance follows firing frequency (two pulses per revolution on a V4)
    const power = scene === 4;
    const fire = (frame.live.rpm / 60) * 2;
    this.reso.a.frequency.setTargetAtTime(Math.max(30, fire), t, 0.05);
    this.reso.b.frequency.setTargetAtTime(Math.max(30, fire * 1.503), t, 0.05);
    this.reso.filter.frequency.setTargetAtTime(200 + fire * 2.2, t, 0.1);
    const pulse = (frame.live.firing[0] + frame.live.firing[1] + frame.live.firing[2] + frame.live.firing[3]) * 0.25;
    this.reso.gain.gain.setTargetAtTime(power ? 0.1 + pulse * 0.12 : 0, t, 0.06);
    this.room.gain.setTargetAtTime(scene === 8 ? 0.16 : 0.32, t, 0.5);
  }
}

export const sound = new SoundEngine();
