import {
  AdditiveBlending,
  BufferGeometry,
  Camera,
  DataTexture,
  Float32BufferAttribute,
  FloatType,
  GLSL3,
  HalfFloatType,
  LineSegments,
  LinearFilter,
  MeshBasicMaterial,
  NearestFilter,
  OrthographicCamera,
  RawShaderMaterial,
  RGBAFormat,
  Scene,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
  type Texture,
} from "three";
import { DoubleTarget, Pass } from "../gl/fullscreen";
import { NOISE } from "../shaders/common";

// Wind tunnel visualisation. The bike's silhouette (from the live camera) is turned into
// a distance field by jump flooding; particles released from a smoke rake on the right
// follow a freestream that is deflected tangentially around that field, speed up over the
// body and break into curl-noise turbulence in the wake. They are drawn as 1px filaments
// into a slowly fading trail buffer: thin and quiet, like smoke in a real tunnel.

const HEAD = /* glsl */ `in vec2 vUv;\nout vec4 outColor;\n`;

const JFA_INIT = /* glsl */ `${HEAD}
uniform sampler2D uMask;
void main(){
  float m = texture(uMask, vUv).a;
  outColor = m > 0.5 ? vec4(vUv, 0.0, 1.0) : vec4(-10.0, -10.0, 0.0, 1.0);
}`;

const JFA_STEP = /* glsl */ `${HEAD}
uniform sampler2D uSeeds;
uniform vec2 uStep;
uniform float uAspect;
void main(){
  vec2 best = vec2(-10.0);
  float bd = 1e9;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 s = texture(uSeeds, vUv + vec2(float(x), float(y)) * uStep).xy;
    if (s.x < -1.0) continue;
    vec2 d = (vUv - s) * vec2(uAspect, 1.0);
    float dd = dot(d, d);
    if (dd < bd) { bd = dd; best = s; }
  }
  outColor = vec4(best, 0.0, 1.0);
}`;

const UPDATE = /* glsl */ `${HEAD}
uniform sampler2D uState;
uniform sampler2D uSeeds;
uniform sampler2D uMask;
uniform float uAspect;
uniform float uSpeed;
uniform float dt;
uniform float uTime;
uniform float uLines;
uniform vec2 uRake; // y range of the rake
${NOISE}
float mask(vec2 p){ return texture(uMask, p).a; }
void main(){
  vec4 s = texture(uState, vUv);
  vec2 pos = s.xy;
  float age = s.z;
  float line = floor(vUv.y * uLines);
  float rakeY = mix(uRake.x, uRake.y, (line + 0.5) / uLines);

  vec2 v = vec2(-1.0, 0.0);
  vec2 seed = texture(uSeeds, pos).xy;
  float stagn = 0.0;
  if (seed.x > -1.0) {
    vec2 dv = (pos - seed) * vec2(uAspect, 1.0);
    float d = length(dv);
    vec2 n = dv / max(d, 1e-5);
    float infl = exp(-d / 0.04);
    float vn = dot(v, n);
    if (vn < 0.0) v -= n * vn * clamp(infl * 1.8, 0.0, 1.0);
    v *= 1.0 + infl * 0.55;
    // approaching the nose head-on: the flow slows (stagnation)
    stagn = clamp(-vn, 0.0, 1.0) * infl;
    v *= 1.0 - stagn * 0.6;
  }
  // wake: anything with the body upstream (to the right) gets turbulence
  float wake = 0.0;
  for (int i = 1; i <= 6; i++) wake = max(wake, mask(pos + vec2(0.045 * float(i), 0.0)) * (1.0 - float(i) * 0.12));
  vec2 turb = curl2(vec3(pos * vec2(uAspect, 1.0) * 7.0, uTime * 0.9));
  v += turb * wake * 0.42;
  v.y -= wake * 0.06;
  // a hint of free-stream unsteadiness everywhere
  v += curl2(vec3(pos * vec2(uAspect, 1.0) * 2.0, uTime * 0.2)) * 0.012;

  pos += v * dt * 0.3 * uSpeed;
  age += dt;

  float inside = mask(pos);
  if (pos.x < -0.03 || pos.y < -0.05 || pos.y > 1.05 || inside > 0.5 || age > 9.0) {
    float h = hash12(vec2(vUv.x * 911.0, uTime));
    pos = vec2(1.02 + h * 0.04, rakeY + (hash12(vec2(uTime, vUv.x * 37.0)) - 0.5) * 0.0012);
    age = 0.0;
  }
  outColor = vec4(pos, age, stagn);
}`;

const FADE = /* glsl */ `${HEAD}
uniform sampler2D uTrail;
uniform float uFade;
void main(){ outColor = texture(uTrail, vUv) * uFade; }`;

const LINE_VERT = /* glsl */ `
in vec2 ref;      // particle texel
in float isHead;  // 0 = previous position, 1 = current
uniform sampler2D uPrev;
uniform sampler2D uCur;
out float vAlpha;
out float vStag;
void main(){
  vec4 a = texture(uPrev, ref);
  vec4 b = texture(uCur, ref);
  vec4 s = isHead > 0.5 ? b : a;
  // do not draw the jump when a particle respawns
  float jump = step(0.06, distance(a.xy, b.xy));
  vAlpha = (1.0 - jump) * smoothstep(0.0, 0.5, b.z) * smoothstep(1.05, 0.85, b.x);
  vStag = b.w;
  gl_Position = vec4(s.xy * 2.0 - 1.0, 0.0, 1.0);
}`;

const LINE_FRAG = /* glsl */ `
precision highp float;
in float vAlpha;
in float vStag;
uniform float uIntensity;
out vec4 outColor;
void main(){
  vec3 bone = vec3(0.86, 0.85, 0.82);
  vec3 signal = vec3(0.89, 0.34, 0.18);
  vec3 c = mix(bone, signal * 1.6, clamp(vStag * 2.2, 0.0, 1.0));
  float a = vAlpha * uIntensity;
  outColor = vec4(c * a, a);
}`;

export class AeroFlow {
  private mask!: WebGLRenderTarget;
  private seeds!: DoubleTarget;
  private state: DoubleTarget;
  private trail!: DoubleTarget;
  private initP = new Pass(JFA_INIT, { uMask: { value: null } });
  private stepP = new Pass(JFA_STEP, { uSeeds: { value: null }, uStep: { value: new Vector2() }, uAspect: { value: 1 } });
  private updateP: Pass;
  private fadeP = new Pass(FADE, { uTrail: { value: null }, uFade: { value: 0.95 } });
  private lines: LineSegments;
  private lineScene = new Scene();
  private lineCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private white = new MeshBasicMaterial({ color: 0xffffff });
  private aspect = 1;
  private time = 0;
  private maskSize = new Vector2(256, 144);
  private seeded = false;

  constructor(private renderer: WebGLRenderer, private nLines: number, private perLine: number) {
    const floatOk = renderer.extensions.has("EXT_color_buffer_float");
    const mkState = () =>
      new WebGLRenderTarget(perLine, nLines, {
        type: floatOk ? FloatType : HalfFloatType,
        format: RGBAFormat,
        minFilter: NearestFilter,
        magFilter: NearestFilter,
        depthBuffer: false,
      });
    this.state = new DoubleTarget(mkState);
    this.updateP = new Pass(UPDATE, {
      uState: { value: null },
      uSeeds: { value: null },
      uMask: { value: null },
      uAspect: { value: 1 },
      uSpeed: { value: 1 },
      dt: { value: 0.016 },
      uTime: { value: 0 },
      uLines: { value: nLines },
      uRake: { value: new Vector2(0.24, 0.8) },
    });

    // line geometry: two vertices per particle
    const n = nLines * perLine;
    const ref = new Float32Array(n * 2 * 2);
    const head = new Float32Array(n * 2);
    for (let j = 0; j < nLines; j++) {
      for (let i = 0; i < perLine; i++) {
        const k = j * perLine + i;
        const u = (i + 0.5) / perLine, v = (j + 0.5) / nLines;
        ref.set([u, v, u, v], k * 4);
        head[k * 2] = 0;
        head[k * 2 + 1] = 1;
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("ref", new Float32BufferAttribute(ref, 2));
    g.setAttribute("isHead", new Float32BufferAttribute(head, 1));
    g.setAttribute("position", new Float32BufferAttribute(new Float32Array(n * 2 * 3), 3));
    const mat = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: `precision highp float;\n${LINE_VERT}`,
      fragmentShader: LINE_FRAG,
      uniforms: { uPrev: { value: null }, uCur: { value: null }, uIntensity: { value: 0.22 } },
      transparent: true,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
    this.lines = new LineSegments(g, mat);
    this.lines.frustumCulled = false;
    this.lineScene.add(this.lines);
  }

  setSize(w: number, h: number) {
    this.aspect = w / h;
    const mw = 256;
    this.maskSize.set(mw, Math.max(32, Math.round(mw / this.aspect)));
    this.mask?.dispose();
    this.seeds?.dispose();
    this.trail?.dispose();
    this.mask = new WebGLRenderTarget(this.maskSize.x, this.maskSize.y, { type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter });
    this.seeds = new DoubleTarget(
      () => new WebGLRenderTarget(this.maskSize.x, this.maskSize.y, { type: HalfFloatType, minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: false }),
    );
    const tw = Math.round(w * 0.75), th = Math.round(h * 0.75);
    this.trail = new DoubleTarget(
      () => new WebGLRenderTarget(tw, th, { type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false }),
    );
  }

  private seed() {
    // scatter the initial particles along their rake lines so the field starts full
    const r = this.renderer;
    const n = this.nLines * this.perLine;
    const data = new Float32Array(n * 4);
    for (let j = 0; j < this.nLines; j++) {
      for (let i = 0; i < this.perLine; i++) {
        const k = (j * this.perLine + i) * 4;
        data[k] = Math.random() * 1.05;
        data[k + 1] = 0.24 + (0.8 - 0.24) * ((j + 0.5) / this.nLines);
        data[k + 2] = 1 + Math.random() * 3;
        data[k + 3] = 0;
      }
    }
    const tex = new DataTexture(data, this.perLine, this.nLines, RGBAFormat, FloatType);
    tex.needsUpdate = true;
    const blit = new Pass(`in vec2 vUv; out vec4 outColor; uniform sampler2D t; void main(){ outColor = texture(t, vUv); }`, { t: { value: tex } });
    blit.render(r, this.state.read);
    blit.render(r, this.state.write);
    blit.dispose();
    tex.dispose();
  }

  step(r: WebGLRenderer, scene: Scene, camera: Camera, dt: number, speed: number, reduced: boolean): Texture {
    if (!this.seeded) {
      this.seeded = true;
      this.seed();
    }
    this.time += dt;
    // 1. silhouette from the live camera (bike only, flat white)
    const prevOverride = scene.overrideMaterial;
    const layers = camera.layers.mask;
    scene.overrideMaterial = this.white;
    camera.layers.set(0);
    r.setRenderTarget(this.mask);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, false);
    r.render(scene, camera);
    camera.layers.mask = layers;
    scene.overrideMaterial = prevOverride;

    // 2. jump flood
    this.initP.u.uMask.value = this.mask.texture;
    this.initP.render(r, this.seeds.write);
    this.seeds.swap();
    let k = Math.max(this.maskSize.x, this.maskSize.y) / 2;
    this.stepP.u.uAspect.value = this.aspect;
    while (k >= 1) {
      this.stepP.u.uSeeds.value = this.seeds.read.texture;
      this.stepP.u.uStep.value.set(k / this.maskSize.x, k / this.maskSize.y);
      this.stepP.render(r, this.seeds.write);
      this.seeds.swap();
      k = Math.floor(k / 2);
    }

    // 3. advance particles
    const u = this.updateP.u;
    u.uState.value = this.state.read.texture;
    u.uSeeds.value = this.seeds.read.texture;
    u.uMask.value = this.mask.texture;
    u.uAspect.value = this.aspect;
    u.uSpeed.value = reduced ? 0.35 : 0.45 + speed * 0.9;
    u.dt.value = dt;
    u.uTime.value = this.time;
    this.updateP.render(r, this.state.write);
    this.state.swap();

    // 4. fade the trail and draw this frame's filaments
    this.fadeP.u.uTrail.value = this.trail.read.texture;
    this.fadeP.u.uFade.value = Math.pow(0.9 - Math.min(0.12, speed * 0.05), dt * 60);
    this.fadeP.render(r, this.trail.write);
    const lm = this.lines.material as RawShaderMaterial;
    lm.uniforms.uPrev.value = this.state.write.texture;
    lm.uniforms.uCur.value = this.state.read.texture;
    r.setRenderTarget(this.trail.write);
    r.render(this.lineScene, this.lineCam);
    this.trail.swap();
    return this.trail.read.texture;
  }

  dispose() {
    this.mask?.dispose();
    this.seeds?.dispose();
    this.state.dispose();
    this.trail?.dispose();
    this.initP.dispose();
    this.stepP.dispose();
    this.updateP.dispose();
    this.fadeP.dispose();
    this.lines.geometry.dispose();
    (this.lines.material as RawShaderMaterial).dispose();
    this.white.dispose();
  }
}
