import { HalfFloatType, LinearFilter, RGBAFormat, Vector2, WebGLRenderer, WebGLRenderTarget, type Texture } from "three";
import { Pass } from "../gl/fullscreen";

// Restrained bloom for emissives only (DRL, tail light, firing pulses). Threshold is high
// so painted and metal surfaces never glow. Dual-filter (Kawase) down/up chain.

const PREFILTER = /* glsl */ `
in vec2 vUv; out vec4 outColor;
uniform sampler2D tMap; uniform float uThreshold; uniform vec2 uTexel;
void main(){
  vec3 c = vec3(0.0);
  c += texture(tMap, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture(tMap, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
  c += texture(tMap, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
  c += texture(tMap, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  c *= 0.25;
  // clamp first: a sharp specular glint must never bloom into a disc
  c = min(c, vec3(5.5));
  float l = max(c.r, max(c.g, c.b));
  float k = max(l - uThreshold, 0.0) / max(l, 1e-4);
  outColor = vec4(c * k, 1.0);
}`;

const DOWN = /* glsl */ `
in vec2 vUv; out vec4 outColor;
uniform sampler2D tMap; uniform vec2 uTexel;
void main(){
  vec3 s = texture(tMap, vUv).rgb * 4.0;
  s += texture(tMap, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  s += texture(tMap, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
  s += texture(tMap, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
  s += texture(tMap, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  outColor = vec4(s / 8.0, 1.0);
}`;

const UP = /* glsl */ `
in vec2 vUv; out vec4 outColor;
uniform sampler2D tMap; uniform sampler2D tBase; uniform vec2 uTexel;
void main(){
  vec3 s = vec3(0.0);
  s += texture(tMap, vUv + uTexel * vec2(-2.0, 0.0)).rgb;
  s += texture(tMap, vUv + uTexel * vec2( 2.0, 0.0)).rgb;
  s += texture(tMap, vUv + uTexel * vec2(0.0, -2.0)).rgb;
  s += texture(tMap, vUv + uTexel * vec2(0.0,  2.0)).rgb;
  s += texture(tMap, vUv + uTexel * vec2(-1.0, -1.0)).rgb * 2.0;
  s += texture(tMap, vUv + uTexel * vec2( 1.0, -1.0)).rgb * 2.0;
  s += texture(tMap, vUv + uTexel * vec2(-1.0,  1.0)).rgb * 2.0;
  s += texture(tMap, vUv + uTexel * vec2( 1.0,  1.0)).rgb * 2.0;
  outColor = vec4(s / 12.0 + texture(tBase, vUv).rgb, 1.0);
}`;

export class Bloom {
  private levels: WebGLRenderTarget[] = [];
  private ups: WebGLRenderTarget[] = [];
  private pre = new Pass(PREFILTER, { tMap: { value: null }, uThreshold: { value: 2.2 }, uTexel: { value: new Vector2() } });
  private down = new Pass(DOWN, { tMap: { value: null }, uTexel: { value: new Vector2() } });
  private up = new Pass(UP, { tMap: { value: null }, tBase: { value: null }, uTexel: { value: new Vector2() } });

  constructor(private count = 4) {}

  setSize(w: number, h: number) {
    this.levels.forEach((t) => t.dispose());
    this.ups.forEach((t) => t.dispose());
    this.levels = [];
    this.ups = [];
    let lw = Math.max(1, Math.floor(w / 2)), lh = Math.max(1, Math.floor(h / 2));
    for (let i = 0; i < this.count; i++) {
      const mk = () => new WebGLRenderTarget(lw, lh, { type: HalfFloatType, format: RGBAFormat, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false });
      this.levels.push(mk());
      this.ups.push(mk());
      lw = Math.max(1, Math.floor(lw / 2));
      lh = Math.max(1, Math.floor(lh / 2));
    }
  }

  render(renderer: WebGLRenderer, src: Texture, threshold = 2.2): Texture {
    const L = this.levels;
    this.pre.u.tMap.value = src;
    this.pre.u.uThreshold.value = threshold;
    this.pre.u.uTexel.value.set(1 / (L[0].width * 2), 1 / (L[0].height * 2));
    this.pre.render(renderer, L[0]);
    for (let i = 1; i < L.length; i++) {
      this.down.u.tMap.value = L[i - 1].texture;
      this.down.u.uTexel.value.set(1 / L[i - 1].width, 1 / L[i - 1].height);
      this.down.render(renderer, L[i]);
    }
    let cur = L[L.length - 1].texture;
    for (let i = L.length - 2; i >= 0; i--) {
      this.up.u.tMap.value = cur;
      this.up.u.tBase.value = L[i].texture;
      this.up.u.uTexel.value.set(1 / L[i + 1].width, 1 / L[i + 1].height);
      this.up.render(renderer, this.ups[i]);
      cur = this.ups[i].texture;
    }
    return cur;
  }

  dispose() {
    this.levels.forEach((t) => t.dispose());
    this.ups.forEach((t) => t.dispose());
    this.pre.dispose();
    this.down.dispose();
    this.up.dispose();
  }
}
