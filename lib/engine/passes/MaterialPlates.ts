import {
  HalfFloatType,
  LinearFilter,
  RGBAFormat,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
  type Texture,
} from "three";
import { Pass } from "../gl/fullscreen";
import { NOISE, TONEMAP } from "../shaders/common";
import { frame } from "../../frame";
import { materials as plateContent } from "../../content";

// Macro material study. Each plate is a small "photograph" rendered from an analytic
// heightfield: surface detail in millimetres, anisotropic GGX for machined and woven
// surfaces, a studio softbox in reflection, then a tilt-shift depth-of-field pass with
// lens vignette and grain. The pointer moves the light; scroll slides the macro rig.
// Any plate is replaced by /public/media/materials/<id>.avif when content.ts lists it.

const PRELUDE = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform vec2 uRes;
uniform float uAspect;
uniform float uTime;
uniform vec2 uLight;
uniform float uSlide;
${NOISE}
const float PI = 3.14159265;

vec3 envBox(vec3 R, float rough){
  vec2 s = R.xy / (R.z + 1.0);
  vec2 c = vec2(-uLight.x * 0.3, -0.02 - uLight.y * 0.16);
  float w = 0.012 + rough * 0.45;
  vec2 d = s - c;
  float box = smoothstep(0.2 + w, 0.2 - w, abs(d.x)) * smoothstep(0.09 + w, 0.09 - w, abs(d.y));
  // soft falloff inside the box, like a diffusion panel
  box *= 0.75 + 0.25 * (1.0 - smoothstep(0.0, 0.2, length(d / vec2(0.2, 0.09)) - 0.6));
  float strip = smoothstep(0.012 + w, 0.0, abs(s.y - 0.2 + uLight.y * 0.06)) * smoothstep(0.42, 0.25, abs(s.x - c.x * 0.5));
  float amb = 0.008 + 0.02 * clamp(R.y * 0.5 + 0.5, 0.0, 1.0);
  return vec3(1.0, 0.985, 0.96) * (box * 2.4 + strip * 0.9) + vec3(amb);
}

vec3 fres(vec3 F0, float c){ return F0 + (1.0 - F0) * pow(1.0 - c, 5.0); }

// key light + softbox reflection, anisotropic along T
// a macro lens has perspective: the view vector varies across the frame, so a flat
// surface catches the softbox in only part of the picture, as in a real product shot
vec3 viewDir(){ return normalize(vec3((vUv - 0.5) * vec2(uAspect, 1.0) * 0.85, 1.0)); }

vec3 shade(vec3 N, vec3 base, float metal, float rough, vec3 T, float aniso, float ao){
  vec3 V = viewDir();
  vec3 L = normalize(vec3(uLight.x * 0.85, 0.5 + uLight.y * 0.4, 0.62));
  vec3 H = normalize(L + V);
  float NdL = max(dot(N, L), 0.0);
  float NdV = max(dot(N, V), 1e-3);
  float NdH = max(dot(N, H), 0.0);
  vec3 F0 = mix(vec3(0.04), base, metal);
  float a = max(rough * rough, 0.0015);
  float at = a * (1.0 + aniso * 3.0);
  float ab = a * max(1.0 - aniso * 0.85, 0.08);
  vec3 B = normalize(cross(N, T));
  vec3 Tn = cross(B, N);
  float th = dot(Tn, H), bh = dot(B, H);
  float dd = th * th / (at * at) + bh * bh / (ab * ab) + NdH * NdH;
  float D = 1.0 / (PI * at * ab * dd * dd);
  vec3 F = fres(F0, max(dot(H, V), 0.0));
  vec3 spec = D * F * 0.25 * NdL * 2.6;
  vec3 diff = base * (1.0 - metal) * NdL * 0.8;
  vec3 R = reflect(-V, N);
  vec3 e = envBox(R, rough);
  if (aniso > 0.01) {
    // fibres and tool marks smear the reflection perpendicular to their direction
    float k = aniso * 0.55;
    e = (e + envBox(normalize(R + B * k * 0.5), rough) + envBox(normalize(R - B * k * 0.5), rough)
           + envBox(normalize(R + B * k), rough) + envBox(normalize(R - B * k), rough)) * 0.2;
  }
  vec3 refl = e * fres(F0, NdV) * mix(0.5, 1.0, metal);
  return (diff + spec + refl) * ao;
}

// plate coordinates in millimetres (frame is ~30 mm tall at 1:1)
vec2 mm(){ return (vUv - 0.5) * vec2(uAspect, 1.0) * 30.0; }
vec2 mmScaled(float h){ return (vUv - 0.5) * vec2(uAspect, 1.0) * h; }

#define NORMAL_FROM(hfun, p, e) normalize(vec3(-(hfun(p + vec2(e, 0.0)) - hfun(p - vec2(e, 0.0))) / (2.0 * e), -(hfun(p + vec2(0.0, e)) - hfun(p - vec2(0.0, e))) / (2.0 * e), 1.0))
`;

// ---------------------------------------------------------------- 1. carbon twill
const CARBON = /* glsl */ `${PRELUDE}
// Fibre shading (Kajiya-Kay): a tow lights up when its fibres run perpendicular to the
// half vector, so warp and weft swap brightness as the light moves. That flip is what
// makes real carbon look like carbon. A glassy lacquer sits on top.
void main(){
  vec2 p = mmScaled(46.0);
  vec2 q = p / 3.3 + vec2(uSlide * 1.4, 0.0);
  vec2 cell = floor(q), f = fract(q);
  bool warp = mod(cell.x + cell.y, 4.0) < 2.0;
  float across = warp ? f.y : f.x;
  // along the whole two-cell float of the tow, not just this cell
  float run = warp ? fract((q.x + mod(cell.y, 4.0)) * 0.5) : fract((q.y + mod(cell.x, 4.0)) * 0.5);
  float seam = smoothstep(0.0, 0.07, min(across, 1.0 - across));
  float ends = smoothstep(0.0, 0.12, run) * smoothstep(1.0, 0.88, run);
  // fibres are never perfectly straight: a few degrees of waviness per tow
  float wav = snoise(vec3(q * 0.7 + cell * 1.7, 4.0)) * 0.09;
  vec3 T = warp ? normalize(vec3(1.0, wav, 0.0)) : normalize(vec3(wav, 1.0, 0.0));
  // tow cross-section tilts the fibre normals across its width
  float tilt = (across - 0.5) * 1.1;
  vec3 Nt = normalize(warp ? vec3(0.0, tilt, 1.0) : vec3(tilt, 0.0, 1.0));
  vec3 V = viewDir();
  vec3 L = normalize(vec3(uLight.x * 0.9, 0.55 + uLight.y * 0.35, 0.7));
  vec3 H = normalize(L + V);
  float th = dot(T, H);
  float s = sqrt(max(0.0, 1.0 - th * th));
  float fil = 0.8 + 0.2 * sin(across * 420.0 + snoise(vec3(q * 1.5, 2.0)) * 0.4);
  float shade = max(dot(Nt, L), 0.0);
  // the float rises out of the weave and dives back in: sheen peaks mid-run
  float arch = pow(sin(run * PI), 0.8);
  float sheen = (pow(s, 120.0) * 0.22 + pow(s, 12.0) * 0.022) * fil * (0.35 + 0.65 * shade) * arch;
  float tone = 0.85 + 0.3 * hash12(cell);
  vec3 c = vec3(0.012, 0.0125, 0.014) * tone + vec3(0.95, 0.96, 1.0) * sheen;
  c *= seam * mix(0.7, 1.0, ends);
  // lacquer: a glassy coat over the weave with the faintest orange peel
  vec3 Nc = normalize(vec3(snoise(vec3(p * 0.35, 1.0)) * 0.003, snoise(vec3(p * 0.35, 7.0)) * 0.003, 1.0));
  vec3 Rc = reflect(-V, Nc);
  c += envBox(Rc, 0.025) * fres(vec3(0.04), max(dot(Nc, V), 0.0)) * 0.55;
  outColor = vec4(c, 1.0);
}`;

// ---------------------------------------------------------------- 2. billet + titanium torx
const BILLET = /* glsl */ `${PRELUDE}
const vec2 C0 = vec2(-90.0, 14.0);
vec2 bolt(int i){ return i == 0 ? vec2(-8.0, -3.0) : i == 1 ? vec2(14.0, 6.5) : vec2(30.0, -9.0); }
float torx(vec2 d){
  float a = atan(d.y, d.x);
  float r = 1.55 + 0.42 * cos(6.0 * a);
  return length(d) - r;
}
float h(vec2 p){
  p.x += uSlide * 8.0;
  float r = length(p - C0);
  float face = sin(r * 7.0) * 0.0012 + snoise(vec3(r * 30.0, 0.0, 0.0)) * 0.0006;
  // step down into a pocket with a 45 degree chamfer
  float e = dot(p, normalize(vec2(0.35, 1.0))) + 9.5;
  float pocket = -clamp(-e, 0.0, 0.7);
  float hh = face + pocket;
  for (int i = 0; i < 3; i++) {
    vec2 d = p - bolt(i);
    float dl = length(d);
    float washer = smoothstep(5.6, 5.4, dl) * 0.35;
    float head = smoothstep(4.3, 4.1, dl) * (0.9 + 0.5 * sqrt(max(0.0, 1.0 - dl * dl / 18.0)));
    float rec = smoothstep(0.08, -0.08, torx(d)) * 1.3;
    hh = max(hh, washer + head - rec);
  }
  return hh;
}
void main(){
  vec2 p = mm();
  vec2 ps = p + vec2(uSlide * 8.0, 0.0);
  vec3 N = NORMAL_FROM(h, p, 0.03);
  float r = length(ps - C0);
  vec3 T = normalize(vec3(-(ps.y - C0.y), ps.x - C0.x, 0.0));
  vec3 base = vec3(0.86, 0.87, 0.88);
  float metal = 1.0, rough = 0.26, aniso = 0.75, ao = 1.0;
  for (int i = 0; i < 3; i++) {
    vec2 d = ps - bolt(i);
    float dl = length(d);
    if (dl < 5.6) {
      base = dl < 4.3 ? vec3(0.52, 0.5, 0.47) : vec3(0.6, 0.6, 0.6);
      rough = dl < 4.3 ? 0.2 : 0.32;
      aniso = 0.2;
      T = normalize(vec3(-d.y, d.x, 0.0));
      if (torx(d) < 0.0) { ao = 0.08; base = vec3(0.2); }
      ao *= mix(0.55, 1.0, smoothstep(5.6, 5.0, dl) + smoothstep(4.3, 4.6, dl) * 0.0);
    }
  }
  float e = dot(ps, normalize(vec2(0.35, 1.0))) + 9.5;
  if (e < -0.7) { ao *= 0.55; rough = 0.42; }
  outColor = vec4(shade(N, base, metal, rough, T, aniso, ao), 1.0);
}`;

// ---------------------------------------------------------------- 3. titanium TIG weld
const WELD = /* glsl */ `${PRELUDE}
float bead(vec2 p){ return exp(-pow(p.y / 3.0, 2.0) * 2.2); }
float h(vec2 p){
  p.x += uSlide * 14.0;
  float tube = sqrt(max(0.0, 1.0 - pow(p.y / 26.0, 2.0))) * 5.0;
  float b = bead(p);
  float phase = (p.x - 0.75 * p.y * p.y / 3.0) / 1.05;
  float ripple = 0.5 + 0.5 * sin(phase * PI * 2.0);
  return tube + b * (0.9 + 0.16 * ripple) + snoise(vec3(p * 2.0, 0.0)) * 0.004;
}
vec3 tint(float d){
  vec3 base = vec3(0.47, 0.45, 0.43);
  vec3 c = vec3(0.62, 0.6, 0.57);
  c = mix(c, vec3(0.72, 0.58, 0.32), smoothstep(2.8, 4.5, d));
  c = mix(c, vec3(0.58, 0.33, 0.2), smoothstep(4.5, 6.2, d));
  c = mix(c, vec3(0.34, 0.2, 0.42), smoothstep(6.2, 7.6, d));
  c = mix(c, vec3(0.2, 0.29, 0.56), smoothstep(7.6, 9.2, d));
  c = mix(c, vec3(0.36, 0.47, 0.58), smoothstep(9.2, 11.5, d));
  return mix(c, base, smoothstep(11.5, 16.0, d));
}
void main(){
  vec2 p = mm();
  vec3 N = NORMAL_FROM(h, p, 0.025);
  float d = abs(p.y) + snoise(vec3((p.x + uSlide * 14.0) * 0.25, 0.0, 2.0)) * 0.6;
  vec3 T = vec3(1.0, 0.0, 0.0);
  float b = bead(p);
  float rough = mix(0.3, 0.2, b);
  outColor = vec4(shade(N, tint(d), 1.0, rough, T, 0.35 * (1.0 - b), 1.0), 1.0);
}`;

// ---------------------------------------------------------------- 4. cross-drilled floating disc
const DISC = /* glsl */ `${PRELUDE}
const vec2 C0 = vec2(-150.0, -6.0);
float spin(){ return uTime * 0.012 + uSlide * 0.07; }
// distance to the nearest cross-drilled hole (three staggered rows)
float holes(vec2 p){
  vec2 d = p - C0;
  float rad = length(d);
  float ang = atan(d.y, d.x) + spin();
  vec2 pc = vec2(cos(ang), sin(ang)) * rad;
  float m = 1e9;
  for (int k = 0; k < 3; k++) {
    float rr = 127.0 + float(k) * 13.0;
    float stepA = 0.07;
    float off = float(k) * stepA / 3.0;
    float ai = (floor((ang - off) / stepA) + 0.5) * stepA + off;
    m = min(m, length(pc - vec2(cos(ai), sin(ai)) * rr) - 2.4);
  }
  return m;
}
float h(vec2 p){
  float rad = length(p - C0);
  float band = smoothstep(117.0, 118.0, rad) * smoothstep(167.0, 166.0, rad);
  float grind = snoise(vec3(rad * 18.0, 0.0, 0.0)) * 0.002;
  float ho = holes(p);
  float hole = smoothstep(0.2, -0.3, ho) * band;
  float chamfer = smoothstep(0.5, 0.0, ho) * 0.25 * band;
  float carrier = step(rad, 117.5) * 0.6;
  return band * (1.0 + grind) - hole * 1.6 - chamfer + carrier;
}
void main(){
  vec2 p = mm();
  float rad = length(p - C0);
  vec3 N = NORMAL_FROM(h, p, 0.03);
  vec2 d = p - C0;
  vec3 T = normalize(vec3(-d.y, d.x, 0.0));
  float ho = holes(p);
  vec3 base = vec3(0.6, 0.61, 0.62);
  float rough = 0.24, aniso = 0.8, ao = 1.0, metal = 1.0;
  if (rad < 117.5) { base = vec3(0.12, 0.125, 0.13); rough = 0.36; aniso = 0.4; }
  if (rad > 167.0) { base = vec3(0.0); ao = 0.0; }
  // faint heat bluing toward the outer edge of the braking band
  base = mix(base, vec3(0.38, 0.42, 0.58), smoothstep(150.0, 166.0, rad) * 0.35 * step(117.5, rad));
  if (ho < 0.0 && rad > 117.5 && rad < 167.0) ao = 0.04;
  outColor = vec4(shade(N, base, metal, rough, T, aniso, ao), 1.0);
}`;

// ---------------------------------------------------------------- 5. perforated microsuede with stitching
const SUEDE = /* glsl */ `${PRELUDE}
float perf(vec2 p){
  vec2 g = vec2(2.3, 2.0);
  vec2 q = p / g;
  q.x += mod(floor(q.y), 2.0) * 0.5;
  vec2 f = fract(q) - 0.5;
  return length(f * g) - 0.46;
}
float h(vec2 p){
  p.y += uSlide * 6.0;
  float fib = fbm3(vec3(p * 9.0, 0.0)) * 0.03 + snoise(vec3(p * 38.0, 1.0)) * 0.01;
  float hole = smoothstep(0.12, -0.12, perf(p)) * 0.6;
  float seam = -exp(-pow((p.y + 8.0) / 0.5, 2.0)) * 0.35;
  return fib - hole + seam;
}
void main(){
  vec2 p = mm();
  vec2 ps = p + vec2(0.0, uSlide * 6.0);
  vec3 N = NORMAL_FROM(h, p, 0.03);
  float ao = perf(ps) < 0.0 ? 0.05 : 1.0;
  vec3 c = shade(N, vec3(0.03, 0.03, 0.032), 0.0, 0.94, vec3(1.0, 0.0, 0.0), 0.0, ao);
  // fibre sheen at grazing angles
  c += vec3(0.05, 0.05, 0.055) * pow(1.0 - N.z, 3.0) * ao;
  // double-needle stitching in alloy thread
  for (int k = 0; k < 2; k++) {
    float y = -9.6 + float(k) * 3.2;
    float along = fract((ps.x + float(k) * 0.9) / 2.6);
    float stitch = smoothstep(0.32, 0.26, abs(ps.y - y)) * smoothstep(0.08, 0.14, along) * smoothstep(0.82, 0.74, along);
    vec3 thread = vec3(0.42, 0.43, 0.45) * (0.5 + 0.8 * max(dot(N, normalize(vec3(uLight, 0.7))), 0.0));
    c = mix(c, thread, stitch);
  }
  outColor = vec4(c, 1.0);
}`;

// ---------------------------------------------------------------- 6. knurled switchgear
const KNURL = /* glsl */ `${PRELUDE}
const float R = 10.0;
float h(vec2 p){
  p.x += uSlide * 7.0;
  if (abs(p.y) >= R) return -5.0;
  float arc = asin(clamp(p.y / R, -1.0, 1.0)) * R + uTime * 0.6;
  float pitch = 1.0;
  float g1 = abs(fract((p.x + arc) / pitch) - 0.5);
  float g2 = abs(fract((p.x - arc) / pitch) - 0.5);
  float pyr = min(g1, g2) * 0.55;
  float knurled = step(p.x, 12.0);
  float lathe = sin(length(vec2(p.x - 40.0, p.y)) * 9.0) * 0.002;
  return mix(lathe, pyr, knurled);
}
void main(){
  vec2 p = mm();
  vec2 ps = p + vec2(uSlide * 7.0, 0.0);
  if (abs(ps.y) >= R) { outColor = vec4(vec3(0.0), 1.0); return; }
  float z = sqrt(R * R - ps.y * ps.y);
  vec3 N0 = normalize(vec3(0.0, ps.y / R, z / R));
  vec3 Nd = NORMAL_FROM(h, p, 0.02);
  vec3 N = normalize(N0 + vec3(Nd.xy, 0.0));
  bool knurled = ps.x < 12.0;
  vec3 T = knurled ? vec3(0.0, 1.0, 0.0) : normalize(vec3(-ps.y, ps.x - 40.0, 0.0));
  float edge = smoothstep(R, R - 1.2, abs(ps.y));
  vec3 c = shade(N, vec3(0.84, 0.85, 0.86), 1.0, knurled ? 0.3 : 0.22, T, knurled ? 0.2 : 0.7, edge);
  // the end face shoulder
  c *= mix(0.4, 1.0, smoothstep(0.0, 0.5, abs(ps.x - 12.0)));
  outColor = vec4(c, 1.0);
}`;

// ---------------------------------------------------------------- 7. satin noir over metallic ground coat
const PAINT = /* glsl */ `${PRELUDE}
vec3 voro(vec2 p){
  vec2 n = floor(p), f = fract(p);
  float md = 8.0; vec2 mid = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = hash22(n + g);
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < md) { md = d; mid = n + g; }
  }
  return vec3(mid, md);
}
void main(){
  vec2 p = mm();
  p.x += uSlide * 10.0;
  // two facets meeting at a crease: the stealth language at the scale of a paint chip
  float s = dot(p, normalize(vec2(-0.42, 1.0))) - 3.0;
  vec3 Na = normalize(vec3(0.0, 0.3, 1.0));
  vec3 Nb = normalize(vec3(0.06, -0.26, 1.0));
  float k = smoothstep(-0.7, 0.7, s);
  // the radiused crease rolls through every angle between the two planes
  vec3 N = normalize(mix(Nb, Na, k) + vec3(0.0, (k * (1.0 - k)) * 1.6, 0.0) * sign(s));
  vec3 base = shade(N, vec3(0.012, 0.012, 0.014), 0.0, 0.34, vec3(1.0, 0.0, 0.0), 0.0, 1.0);
  // satin clearcoat: a broad, soft sheet of the softbox
  vec3 V = viewDir();
  base += envBox(reflect(-V, N), 0.32) * 0.05;
  // metallic flakes: sparse tiny mirrors under the satin; only a few catch the light
  vec3 v = voro(p * 12.0);
  float isFlake = step(0.55, hash12(v.xy + 3.1));
  vec2 rnd = hash22(v.xy) - 0.5;
  vec3 Nf = normalize(N + vec3(rnd * 0.34, 0.0));
  vec3 L = normalize(vec3(uLight.x * 0.85, 0.5 + uLight.y * 0.4, 0.62));
  vec3 H = normalize(L + V);
  float glint = pow(max(dot(Nf, H), 0.0), 420.0) * 3.2 * smoothstep(0.3, 0.05, v.z) * isFlake;
  vec3 flake = vec3(0.92, 0.93, 0.95) * glint + vec3(0.035) * isFlake * pow(max(dot(Nf, H), 0.0), 60.0);
  outColor = vec4(base + flake, 1.0);
}`;

const IMAGE = /* glsl */ `${PRELUDE}
uniform sampler2D tImage;
uniform vec2 uImageSize;
void main(){
  vec2 uv = vUv;
  float ia = uImageSize.x / uImageSize.y;
  vec2 scale = uAspect > ia ? vec2(1.0, ia / uAspect) : vec2(uAspect / ia, 1.0);
  uv = (uv - 0.5) * scale * 0.92 + 0.5 + vec2(uSlide * 0.03, 0.0);
  outColor = vec4(pow(texture(tImage, uv).rgb, vec3(1.0)), 1.0);
}`;

// ---------------------------------------------------------------- lens: tilt-shift DOF, smear, grain
const LENS = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tPlate;
uniform vec2 uTexel;
uniform float uFocusLine;
uniform float uDefocus;
uniform float uSmear;
uniform float uTime;
uniform float uAspect;
uniform float uLinearIn;
${NOISE}
${TONEMAP}
void main(){
  float coc = clamp(abs(vUv.y - uFocusLine) * 0.85 * min(1.0, uAspect * 1.4) - 0.1, 0.0, 1.0) * 0.011 + uDefocus * 0.018;
  vec3 acc = vec3(0.0);
  float ws = 0.0;
  const float GA = 2.39996;
  for (int i = 0; i < 28; i++) {
    float r = sqrt((float(i) + 0.5) / 28.0) * coc;
    float a = float(i) * GA;
    vec2 o = vec2(cos(a), sin(a)) * r * vec2(1.0 / uAspect, 1.0);
    o.x += (float(i) / 27.0 - 0.5) * uSmear * 0.35;
    vec3 s = texture(tPlate, vUv + o).rgb;
    float w = 1.0 + dot(s, vec3(0.3)) * 0.6; // brighter samples bloom into bokeh
    acc += s * w;
    ws += w;
  }
  vec3 c = acc / ws;
  // lateral chromatic aberration toward the edges
  vec2 dc = (vUv - 0.5) * 0.0011;
  c.r = mix(c.r, texture(tPlate, vUv + dc).r, 0.5);
  c.b = mix(c.b, texture(tPlate, vUv - dc).b, 0.5);
  if (uLinearIn > 0.5) c = tonemap(c * 1.05);
  float vig = smoothstep(1.2, 0.3, length((vUv - 0.5) * vec2(uAspect, 1.0) * 0.95));
  c *= mix(0.55, 1.0, vig);
  c += (hash12(vUv / uTexel + fract(uTime * 9.1) * 97.0) - 0.5) * 0.03;
  outColor = vec4(max(c, 0.0), 1.0);
}`;

const SOURCES: Record<string, string> = {
  carbon: CARBON,
  billet: BILLET,
  weld: WELD,
  disc: DISC,
  suede: SUEDE,
  knurl: KNURL,
  paint: PAINT,
};

interface PlateState {
  surface: Pass;
  rt: WebGLRenderTarget | null;
  image: Texture | null;
  focus: number;
}

export class MaterialPlates {
  private plates = new Map<string, PlateState>();
  private lens = new Pass(LENS, {
    tPlate: { value: null },
    uTexel: { value: new Vector2() },
    uFocusLine: { value: 0.5 },
    uDefocus: { value: 0 },
    uSmear: { value: 0 },
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uLinearIn: { value: 1 },
  });

  constructor(private scale: number) {
    const loader = new TextureLoader();
    for (const item of plateContent) {
      const image = item.src ? loader.load(item.src) : null;
      if (image) image.colorSpace = SRGBColorSpace;
      const src = image ? IMAGE : SOURCES[item.id];
      const uniforms: Record<string, { value: unknown }> = {
        uRes: { value: new Vector2() },
        uAspect: { value: 1 },
        uTime: { value: 0 },
        uLight: { value: new Vector2() },
        uSlide: { value: 0 },
      };
      if (image) {
        uniforms.tImage = { value: image };
        uniforms.uImageSize = { value: new Vector2(1, 1) };
      }
      this.plates.set(item.id, { surface: new Pass(src, uniforms), rt: null, image, focus: 0 });
    }
  }

  render(r: WebGLRenderer, dpr: number, time: number, reduced: boolean, sceneLocal: number) {
    const vw = frame.viewport.w, vh = frame.viewport.h;
    const p = frame.pointer;
    for (const [id, st] of this.plates) {
      const el = frame.plates.get(id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > vh || rect.width < 2 || rect.height < 2) {
        st.focus = 0;
        continue;
      }
      const w = Math.max(16, Math.round(rect.width * dpr * this.scale));
      const h = Math.max(16, Math.round(rect.height * dpr * this.scale));
      if (!st.rt || st.rt.width !== w || st.rt.height !== h) {
        st.rt?.dispose();
        st.rt = new WebGLRenderTarget(w, h, { type: HalfFloatType, format: RGBAFormat, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false });
      }
      // the rig position: -1 entering from below, +1 leaving at the top
      const center = (rect.top + rect.height / 2) / vh;
      const slide = (0.5 - center) * 2;
      // focus pulls in as the plate arrives, the way a macro lens racks onto its subject
      const a = Math.abs(slide);
      const target = 1 - Math.min(1, Math.max(0, (a - 0.45) / 0.65));
      st.focus = reduced ? 1 : st.focus + (target - st.focus) * Math.min(1, frame.dt * 4);
      const u = st.surface.u;
      u.uRes.value.set(w, h);
      u.uAspect.value = rect.width / rect.height;
      u.uTime.value = reduced ? 0 : time;
      // light follows the pointer, relative to the plate when it is over it
      const lx = (p.px - (rect.left + rect.width / 2)) / (rect.width * 0.6);
      const ly = -(p.py - (rect.top + rect.height / 2)) / (rect.height * 0.6);
      (u.uLight.value as Vector2).set(Math.max(-1, Math.min(1, lx * 0.6 + p.sx * 0.4)), Math.max(-1, Math.min(1, ly * 0.6 + p.sy * 0.4)));
      u.uSlide.value = reduced ? 0 : slide;
      if (st.image && st.image.image) {
        const img = st.image.image as HTMLImageElement;
        (u.uImageSize.value as Vector2).set(img.width || 1, img.height || 1);
      }
      st.surface.render(r, st.rt);

      // lens pass into the plate's rectangle on screen
      const L = this.lens.u;
      L.tPlate.value = st.rt.texture;
      L.uTexel.value.set(1 / w, 1 / h);
      L.uFocusLine.value = 0.5 + slide * 0.18;
      L.uDefocus.value = (1 - st.focus) * 0.8;
      // the last plate smears into the motion scene
      L.uSmear.value = id === "paint" && !reduced ? Math.max(0, (sceneLocal - 0.9) / 0.1) * 0.25 : 0;
      L.uTime.value = time;
      L.uAspect.value = rect.width / rect.height;
      L.uLinearIn.value = st.image ? 0 : 1;
      r.setRenderTarget(null);
      const x = rect.left, y = vh - rect.bottom;
      r.setViewport(x, y, rect.width, rect.height);
      r.setScissor(x, y, rect.width, rect.height);
      r.setScissorTest(true);
      this.lens.render(r, null);
      r.setScissorTest(false);
      r.setViewport(0, 0, vw, vh);
    }
  }

  dispose() {
    for (const st of this.plates.values()) {
      st.surface.dispose();
      st.rt?.dispose();
      st.image?.dispose();
    }
    this.lens.dispose();
  }
}
