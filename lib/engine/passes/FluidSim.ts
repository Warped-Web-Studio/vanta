import {
  Color,
  HalfFloatType,
  LinearFilter,
  NearestFilter,
  RGBAFormat,
  UnsignedByteType,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
  type Texture,
} from "three";
import { DoubleTarget, Pass } from "../gl/fullscreen";
import { NOISE } from "../shaders/common";

// The smoke. A stable-fluids solver (vorticity confinement + Jacobi pressure projection)
// advects a CONCEALMENT field: 1 = smoke, 0 = clear air. Pointer splats inject momentum
// and clear the field; the field remembers, then creeps back in from the edges. A second,
// persistent "discovered" map records how much of the bike silhouette has ever been seen.

const HEAD = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
`;

const SPLAT = /* glsl */ `${HEAD}
uniform sampler2D uTarget;
uniform vec2 uPoint;
uniform vec2 uDir;
uniform vec3 uColor;
uniform float uRadius;
uniform float uStretch;
uniform float uAspect;
uniform float uRagged;
uniform float uTime;
uniform float uMode; // 0 add, 1 subtract-and-clamp (concealment)
${NOISE}
void main(){
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  vec2 d = normalize(uDir + vec2(1e-6));
  float along = dot(p, d);
  float across = dot(p, vec2(-d.y, d.x));
  float g = exp(-(along * along / (1.0 + uStretch) + across * across) / uRadius);
  vec4 base = texture(uTarget, vUv);
  if (uMode < 0.5) {
    outColor = vec4(base.xyz + uColor * g, 1.0);
  } else {
    // ragged edge: noise eats into the gaussian so the hole never reads as a circle
    float n = fbm3(vec3(vUv * vec2(uAspect, 1.0) * 22.0, uTime * 0.6)) * 0.5 + 0.5;
    float gg = smoothstep(0.0, 1.0, g * (1.0 - uRagged + uRagged * 1.7 * n));
    float c = clamp(base.r - uColor.r * gg, 0.0, 1.0);
    // .g carries "agitation" that the composite uses to roughen recent edges
    float ag = clamp(base.g + gg * uColor.g, 0.0, 1.0);
    outColor = vec4(c, ag, base.b, 1.0);
  }
}`;

const CURL = /* glsl */ `${HEAD}
uniform sampler2D uVelocity;
uniform vec2 uTexel;
void main(){
  float L = texture(uVelocity, vUv - vec2(uTexel.x, 0.0)).y;
  float R = texture(uVelocity, vUv + vec2(uTexel.x, 0.0)).y;
  float T = texture(uVelocity, vUv + vec2(0.0, uTexel.y)).x;
  float B = texture(uVelocity, vUv - vec2(0.0, uTexel.y)).x;
  outColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`;

const VORTICITY = /* glsl */ `${HEAD}
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform vec2 uTexel;
uniform float uCurlStrength;
uniform float dt;
void main(){
  float L = texture(uCurl, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uCurl, vUv + vec2(uTexel.x, 0.0)).x;
  float T = texture(uCurl, vUv + vec2(0.0, uTexel.y)).x;
  float B = texture(uCurl, vUv - vec2(0.0, uTexel.y)).x;
  float C = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= uCurlStrength * C;
  force.y *= -1.0;
  vec2 v = texture(uVelocity, vUv).xy + force * dt;
  outColor = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
}`;

const DIVERGENCE = /* glsl */ `${HEAD}
uniform sampler2D uVelocity;
uniform vec2 uTexel;
void main(){
  vec2 vL = vUv - vec2(uTexel.x, 0.0);
  vec2 vR = vUv + vec2(uTexel.x, 0.0);
  vec2 vT = vUv + vec2(0.0, uTexel.y);
  vec2 vB = vUv - vec2(0.0, uTexel.y);
  float L = texture(uVelocity, vL).x;
  float R = texture(uVelocity, vR).x;
  float T = texture(uVelocity, vT).y;
  float B = texture(uVelocity, vB).y;
  vec2 C = texture(uVelocity, vUv).xy;
  if (vL.x < 0.0) L = -C.x;
  if (vR.x > 1.0) R = -C.x;
  if (vT.y > 1.0) T = -C.y;
  if (vB.y < 0.0) B = -C.y;
  outColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

const CLEAR = /* glsl */ `${HEAD}
uniform sampler2D uTexture;
uniform float uValue;
void main(){ outColor = uValue * texture(uTexture, vUv); }`;

const PRESSURE = /* glsl */ `${HEAD}
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexel;
void main(){
  float L = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float T = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  float B = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float div = texture(uDivergence, vUv).x;
  outColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}`;

const GRADIENT = /* glsl */ `${HEAD}
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 uTexel;
void main(){
  float L = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float R = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float T = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  float B = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  vec2 v = texture(uVelocity, vUv).xy - vec2(R - L, T - B);
  outColor = vec4(v, 0.0, 1.0);
}`;

const ADVECT_VEL = /* glsl */ `${HEAD}
uniform sampler2D uVelocity;
uniform vec2 uTexel;
uniform float dt;
uniform float uDissipation;
uniform vec2 uWind;
uniform float uTime;
uniform float uAspect;
${NOISE}
void main(){
  vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * uTexel;
  vec2 v = texture(uVelocity, coord).xy / (1.0 + uDissipation * dt);
  // wind gusts are not uniform: modulate by large-scale noise so the smoke tears
  float gust = 0.55 + 0.9 * (snoise(vec3(vUv * vec2(uAspect, 1.0) * 1.6, uTime * 0.4)) * 0.5 + 0.5);
  v += uWind * gust * dt;
  outColor = vec4(v, 0.0, 1.0);
}`;

const ADVECT_DYE = /* glsl */ `${HEAD}
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uTexel;     // velocity texel
uniform vec2 uDyeTexel;
uniform float dt;
uniform float uTime;
uniform float uAspect;
uniform float uDrift;
uniform float uReform;   // 1/seconds
uniform float uTarget;   // concealment the field relaxes toward
uniform float uBoundary; // concealment entering from the edges
${NOISE}
void main(){
  vec2 vel = texture(uVelocity, vUv).xy;
  vec2 q = vUv * vec2(uAspect, 1.0);
  // ambient, domain-warped curl drift keeps the smoke alive when nobody touches it
  vec2 warp = vec2(snoise(vec3(q * 1.3, uTime * 0.03)), snoise(vec3(q * 1.3 + 7.1, uTime * 0.03)));
  vec2 drift = curl2(vec3(q * 2.1 + warp * 0.6, uTime * 0.045)) * uDrift;
  vec2 coord = vUv - dt * (vel * uTexel + drift * 0.012);
  vec4 s = texture(uSource, coord);
  float c = s.r;
  if (coord.x < 0.0 || coord.x > 1.0 || coord.y < 0.0 || coord.y > 1.0) c = uBoundary;

  // creep: dense neighbourhoods refill clear pockets faster, so smoke closes in from the
  // edges as wisps instead of fading uniformly
  float n = 0.0;
  n += texture(uSource, coord + vec2(uDyeTexel.x * 4.0, 0.0)).r;
  n += texture(uSource, coord - vec2(uDyeTexel.x * 4.0, 0.0)).r;
  n += texture(uSource, coord + vec2(0.0, uDyeTexel.y * 4.0)).r;
  n += texture(uSource, coord - vec2(0.0, uDyeTexel.y * 4.0)).r;
  n *= 0.25;
  float edge = clamp(n - c, 0.0, 1.0);
  float m = 0.4 + 1.2 * (fbm3(vec3(q * 4.2, uTime * 0.06)) * 0.5 + 0.5);
  float k = uReform * dt * m * (0.3 + 3.2 * edge);
  c += (uTarget - c) * clamp(k, 0.0, 1.0);
  float ag = s.g * (1.0 - 0.9 * dt);
  outColor = vec4(clamp(c, 0.0, 1.0), ag, 0.0, 1.0);
}`;

const DISCOVER = /* glsl */ `${HEAD}
uniform sampler2D uPrev;
uniform sampler2D uDye;
uniform sampler2D uScene;
uniform float uReset;
void main(){
  float bike = step(0.5, texture(uScene, vUv).a);
  float seen = (1.0 - texture(uDye, vUv).r) * bike;
  float prev = texture(uPrev, vUv).r * (1.0 - uReset);
  outColor = vec4(max(prev, step(0.55, seen)), bike, 0.0, 1.0);
}`;

const REDUCE = /* glsl */ `${HEAD}
uniform sampler2D uDiscovered;
uniform vec2 uSrcTexel;
void main(){
  vec2 acc = vec2(0.0);
  for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++) {
    vec2 o = (vec2(float(x), float(y)) - 3.5) / 8.0 / 16.0;
    vec2 s = texture(uDiscovered, vUv + o).rg;
    acc += vec2(s.r * s.g, s.g);
  }
  outColor = vec4(acc / 64.0, 0.0, 1.0);
}`;

export interface FluidConfig {
  simRes: number;
  dyeRes: number;
  iterations: number;
}

export class FluidSim {
  velocity!: DoubleTarget;
  dye!: DoubleTarget;
  pressure!: DoubleTarget;
  divergence!: WebGLRenderTarget;
  curl!: WebGLRenderTarget;
  discovered!: DoubleTarget;
  reduce: WebGLRenderTarget;
  private passes: Record<string, Pass>;
  private simSize = new Vector2();
  private dyeSize = new Vector2();
  private aspect = 1;
  readBuf = new Uint8Array(16 * 16 * 4);
  discoveredFraction = 0;
  private reading = false;
  time = 0;

  // live parameters, set by the engine every frame
  params = {
    curl: 22,
    velDissipation: 0.55,
    reform: 0.17,
    target: 1,
    boundary: 1,
    drift: 1,
    wind: new Vector2(),
  };

  constructor(private renderer: WebGLRenderer, public cfg: FluidConfig) {
    this.passes = {
      splat: new Pass(SPLAT, {
        uTarget: { value: null },
        uPoint: { value: new Vector2() },
        uDir: { value: new Vector2(1, 0) },
        uColor: { value: [0, 0, 0] },
        uRadius: { value: 0.001 },
        uStretch: { value: 0 },
        uAspect: { value: 1 },
        uRagged: { value: 0.6 },
        uTime: { value: 0 },
        uMode: { value: 0 },
      }),
      curl: new Pass(CURL, { uVelocity: { value: null }, uTexel: { value: new Vector2() } }),
      vorticity: new Pass(VORTICITY, {
        uVelocity: { value: null },
        uCurl: { value: null },
        uTexel: { value: new Vector2() },
        uCurlStrength: { value: 20 },
        dt: { value: 0.016 },
      }),
      divergence: new Pass(DIVERGENCE, { uVelocity: { value: null }, uTexel: { value: new Vector2() } }),
      clear: new Pass(CLEAR, { uTexture: { value: null }, uValue: { value: 0.8 } }),
      pressure: new Pass(PRESSURE, { uPressure: { value: null }, uDivergence: { value: null }, uTexel: { value: new Vector2() } }),
      gradient: new Pass(GRADIENT, { uPressure: { value: null }, uVelocity: { value: null }, uTexel: { value: new Vector2() } }),
      advectVel: new Pass(ADVECT_VEL, {
        uVelocity: { value: null },
        uTexel: { value: new Vector2() },
        dt: { value: 0.016 },
        uDissipation: { value: 0.5 },
        uWind: { value: new Vector2() },
        uTime: { value: 0 },
        uAspect: { value: 1 },
      }),
      advectDye: new Pass(ADVECT_DYE, {
        uVelocity: { value: null },
        uSource: { value: null },
        uTexel: { value: new Vector2() },
        uDyeTexel: { value: new Vector2() },
        dt: { value: 0.016 },
        uTime: { value: 0 },
        uAspect: { value: 1 },
        uDrift: { value: 1 },
        uReform: { value: 0.17 },
        uTarget: { value: 1 },
        uBoundary: { value: 1 },
      }),
      discover: new Pass(DISCOVER, { uPrev: { value: null }, uDye: { value: null }, uScene: { value: null }, uReset: { value: 0 } }),
      reduce: new Pass(REDUCE, { uDiscovered: { value: null }, uSrcTexel: { value: new Vector2() } }),
    };
    this.reduce = new WebGLRenderTarget(16, 16, { type: UnsignedByteType, format: RGBAFormat, depthBuffer: false });
    this.allocate(16 / 9);
  }

  private makeTarget(w: number, h: number, linear = true, byte = false) {
    return new WebGLRenderTarget(w, h, {
      type: byte ? UnsignedByteType : HalfFloatType,
      format: RGBAFormat,
      minFilter: linear ? LinearFilter : NearestFilter,
      magFilter: linear ? LinearFilter : NearestFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
  }

  allocate(aspect: number) {
    this.aspect = aspect;
    const res = (r: number) => (aspect >= 1 ? [Math.round(r * aspect), r] : [r, Math.round(r / aspect)]);
    const [sw, sh] = res(this.cfg.simRes);
    const [dw, dh] = res(this.cfg.dyeRes);
    this.simSize.set(sw, sh);
    this.dyeSize.set(dw, dh);
    this.disposeTargets();
    this.velocity = new DoubleTarget(() => this.makeTarget(sw, sh));
    this.pressure = new DoubleTarget(() => this.makeTarget(sw, sh, false));
    this.divergence = this.makeTarget(sw, sh, false);
    this.curl = this.makeTarget(sw, sh, false);
    this.dye = new DoubleTarget(() => this.makeTarget(dw, dh));
    const [cw, ch] = res(128);
    this.discovered = new DoubleTarget(() => this.makeTarget(cw, ch, true, true));
    this.fill(this.dye.read, 1);
    this.fill(this.dye.write, 1);
  }

  /** set a target to a constant value (red channel) */
  fill(t: WebGLRenderTarget, v: number) {
    const r = this.renderer;
    r.setRenderTarget(t);
    r.setClearColor(new Color(v, 0, 0), 1);
    r.clear(true, false, false);
    r.setRenderTarget(null);
  }

  resetDiscovered() {
    this.passes.discover.u.uReset.value = 1;
  }

  /**
   * Inject one splat. `dir` and `force` are in sim texels per second, `clear` 0..1 is how
   * much concealment is removed at the centre.
   */
  splat(x: number, y: number, dx: number, dy: number, radius: number, stretch: number, clear: number, agitation = 0.6) {
    const s = this.passes.splat;
    s.u.uPoint.value.set(x, y);
    s.u.uDir.value.set(dx, dy);
    s.u.uRadius.value = radius;
    s.u.uStretch.value = stretch;
    s.u.uAspect.value = this.aspect;
    s.u.uTime.value = this.time;
    // momentum
    s.u.uMode.value = 0;
    s.u.uColor.value = [dx, dy, 0];
    s.u.uTarget.value = this.velocity.read.texture;
    s.render(this.renderer, this.velocity.write);
    this.velocity.swap();
    // concealment
    if (clear > 0) {
      s.u.uMode.value = 1;
      s.u.uColor.value = [clear, agitation, 0];
      s.u.uRadius.value = radius * 0.8;
      s.u.uTarget.value = this.dye.read.texture;
      s.render(this.renderer, this.dye.write);
      this.dye.swap();
    }
  }

  step(dt: number, sceneTex: Texture | null) {
    const r = this.renderer;
    const P = this.passes;
    const tx = 1 / this.simSize.x, ty = 1 / this.simSize.y;
    this.time += dt;
    const prevAutoClear = r.autoClear;
    r.autoClear = false;

    P.curl.u.uVelocity.value = this.velocity.read.texture;
    P.curl.u.uTexel.value.set(tx, ty);
    P.curl.render(r, this.curl);

    P.vorticity.u.uVelocity.value = this.velocity.read.texture;
    P.vorticity.u.uCurl.value = this.curl.texture;
    P.vorticity.u.uTexel.value.set(tx, ty);
    P.vorticity.u.uCurlStrength.value = this.params.curl;
    P.vorticity.u.dt.value = dt;
    P.vorticity.render(r, this.velocity.write);
    this.velocity.swap();

    P.divergence.u.uVelocity.value = this.velocity.read.texture;
    P.divergence.u.uTexel.value.set(tx, ty);
    P.divergence.render(r, this.divergence);

    P.clear.u.uTexture.value = this.pressure.read.texture;
    P.clear.u.uValue.value = 0.8;
    P.clear.render(r, this.pressure.write);
    this.pressure.swap();

    P.pressure.u.uDivergence.value = this.divergence.texture;
    P.pressure.u.uTexel.value.set(tx, ty);
    for (let i = 0; i < this.cfg.iterations; i++) {
      P.pressure.u.uPressure.value = this.pressure.read.texture;
      P.pressure.render(r, this.pressure.write);
      this.pressure.swap();
    }

    P.gradient.u.uPressure.value = this.pressure.read.texture;
    P.gradient.u.uVelocity.value = this.velocity.read.texture;
    P.gradient.u.uTexel.value.set(tx, ty);
    P.gradient.render(r, this.velocity.write);
    this.velocity.swap();

    P.advectVel.u.uVelocity.value = this.velocity.read.texture;
    P.advectVel.u.uTexel.value.set(tx, ty);
    P.advectVel.u.dt.value = dt;
    P.advectVel.u.uDissipation.value = this.params.velDissipation;
    P.advectVel.u.uWind.value.copy(this.params.wind);
    P.advectVel.u.uTime.value = this.time;
    P.advectVel.u.uAspect.value = this.aspect;
    P.advectVel.render(r, this.velocity.write);
    this.velocity.swap();

    P.advectDye.u.uVelocity.value = this.velocity.read.texture;
    P.advectDye.u.uSource.value = this.dye.read.texture;
    P.advectDye.u.uTexel.value.set(tx, ty);
    P.advectDye.u.uDyeTexel.value.set(1 / this.dyeSize.x, 1 / this.dyeSize.y);
    P.advectDye.u.dt.value = dt;
    P.advectDye.u.uTime.value = this.time;
    P.advectDye.u.uAspect.value = this.aspect;
    P.advectDye.u.uDrift.value = this.params.drift;
    P.advectDye.u.uReform.value = this.params.reform;
    P.advectDye.u.uTarget.value = this.params.target;
    P.advectDye.u.uBoundary.value = this.params.boundary;
    P.advectDye.render(r, this.dye.write);
    this.dye.swap();

    if (sceneTex) {
      P.discover.u.uPrev.value = this.discovered.read.texture;
      P.discover.u.uDye.value = this.dye.read.texture;
      P.discover.u.uScene.value = sceneTex;
      P.discover.render(r, this.discovered.write);
      this.discovered.swap();
      P.discover.u.uReset.value = 0;
    }
    r.autoClear = prevAutoClear;
  }

  /** async readback of the discovered fraction of the bike silhouette (~3 Hz) */
  sample() {
    if (this.reading) return;
    const r = this.renderer;
    this.passes.reduce.u.uDiscovered.value = this.discovered.read.texture;
    this.passes.reduce.render(r, this.reduce);
    this.reading = true;
    r.readRenderTargetPixelsAsync(this.reduce, 0, 0, 16, 16, this.readBuf)
      .then(() => {
        let seen = 0, area = 0;
        for (let i = 0; i < 256; i++) {
          seen += this.readBuf[i * 4];
          area += this.readBuf[i * 4 + 1];
        }
        this.discoveredFraction = area > 0 ? seen / area : 0;
      })
      .catch(() => {})
      .finally(() => {
        this.reading = false;
      });
  }

  get dyeTexel() {
    return new Vector2(1 / this.dyeSize.x, 1 / this.dyeSize.y);
  }
  get dyeTexture() {
    return this.dye.read.texture;
  }
  get velocityTexture() {
    return this.velocity.read.texture;
  }

  private disposeTargets() {
    this.velocity?.dispose();
    this.pressure?.dispose();
    this.divergence?.dispose();
    this.curl?.dispose();
    this.dye?.dispose();
    this.discovered?.dispose();
  }

  dispose() {
    this.disposeTargets();
    this.reduce.dispose();
    Object.values(this.passes).forEach((p) => p.dispose());
  }
}
