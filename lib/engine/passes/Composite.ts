import { Vector2, Vector3, type Texture } from "three";
import { Pass } from "../gl/fullscreen";
import { NOISE, TONEMAP } from "../shaders/common";

// Final composite. Everything that touches the image after the 3D render lives here:
// the smoke reveal, the aero streamlines, the speed scene's directional blur, bloom,
// AgX tonemapping, vignette, grain and the hard-cut / dissolve controls.
// Output is premultiplied so the DOM type layer behind the canvas shows through.

const FRAG = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tScene;
uniform sampler2D tDye;
uniform sampler2D tVel;
uniform sampler2D tBloom;
uniform sampler2D tAero;
uniform sampler2D tEnv;
uniform vec2 uRes;
uniform vec2 uDyeTexel;
uniform float uAspect;
uniform float uTime;
uniform float uExposure;
uniform float uSmoke;
uniform float uVignette;
uniform float uGrain;
uniform float uFlash;
uniform float uFade;
uniform float uTunnel;
uniform float uSpeed;
uniform float uEnv;
uniform float uBloom;
uniform float uAero;
uniform float uSmear;
uniform vec2 uVanish;
uniform vec3 uKey;
uniform float uReveal;
${NOISE}
${TONEMAP}

void main(){
  vec2 uv = vUv;
  vec4 back = vec4(0.0);

  // ---------- speed scene environment, blurred along the direction of travel ----------
  if (uEnv > 0.001) {
    vec2 rad = uv - uVanish;
    vec4 acc = vec4(0.0);
    float ws = 0.0;
    float jit = hash12(uv * uRes + fract(uTime) * 91.0);
    for (int i = 0; i < 24; i++) {
      // centred, so streaks have soft ends on both sides
      float t = (float(i) + jit) / 24.0 - 0.5;
      float w = 1.0 - abs(t) * 1.2;
      vec2 o = rad * t * uSpeed * 0.26 + vec2(t * uSpeed * 0.2, 0.0);
      acc += texture(tEnv, uv - o) * w;
      ws += w;
    }
    back = acc / ws * uEnv;
  }

  // ---------- wind tunnel backdrop ----------
  if (uTunnel > 0.001) {
    float g = smoothstep(-0.2, 1.1, uv.y);
    vec3 bg = mix(vec3(0.020, 0.021, 0.023), vec3(0.048, 0.051, 0.056), g);
    // soft overhead light rows reflected on the tunnel ceiling
    bg += vec3(0.012) * smoothstep(0.82, 1.0, uv.y);
    back = vec4(mix(back.rgb, bg, uTunnel), mix(back.a, 1.0, uTunnel));
  }

  // ---------- bike, possibly concealed by smoke ----------
  vec4 sc;
  float S = 0.0;
  vec3 smoke = vec3(0.0);
  if (uSmoke > 0.001) {
    vec4 d = texture(tDye, uv);
    float C = d.r;
    float ag = d.g;
    vec2 e = uDyeTexel * 2.5;
    vec2 grad = vec2(texture(tDye, uv + vec2(e.x, 0.0)).r - texture(tDye, uv - vec2(e.x, 0.0)).r,
                     texture(tDye, uv + vec2(0.0, e.y)).r - texture(tDye, uv - vec2(0.0, e.y)).r);
    vec2 vel = texture(tVel, uv).xy;
    vec2 q = uv * vec2(uAspect, 1.0);

    // edge breakup: multi-scale noise advected by the flow, only near the boundary
    float r = 1.0 - C;
    float edge = 4.0 * r * (1.0 - r);
    float n1 = snoise(vec3(q * 6.0 - vel * 0.0009, uTime * 0.11));
    float n2 = snoise(vec3(q * 17.0 - vel * 0.0016, uTime * 0.23));
    float n3 = snoise(vec3(q * 41.0, uTime * 0.37));
    float n = n1 * 0.55 + n2 * 0.3 + n3 * 0.15;
    float rr = r + n * (0.34 + ag * 0.4) * edge;
    float m = smoothstep(0.36, 0.74, rr);

    // refraction through the thin smoke at the boundary, with ~1px chromatic separation
    vec2 off = grad * (0.012 + ag * 0.012) * (edge + 0.15);
    vec2 ca = off * 0.22;
    vec4 sR = texture(tScene, uv + off + ca);
    vec4 sG = texture(tScene, uv + off);
    vec4 sB = texture(tScene, uv + off - ca);
    sc = vec4(sR.r, sG.g, sB.b, sG.a);
    // revealed areas gain a little exposure, as if the smoke had been absorbing the light
    sc.rgb *= 1.0 + 0.4 * m;

    // the smoke body: lit wisps, never a flat black mask
    float d1 = fbm4(vec3(q * 2.6 + vel * 0.0004 + n1 * 0.15, uTime * 0.045));
    float d2 = fbm3(vec3(q * 8.5 - vel * 0.0007, uTime * 0.08));
    float body = clamp(0.5 + 0.55 * d1 + 0.25 * d2, 0.0, 1.0);
    vec3 nrm = normalize(vec3(-grad * 9.0 + vec2(d1, d2) * 0.35, 1.0));
    float lit = clamp(dot(nrm, normalize(uKey)), 0.0, 1.0);
    float rim = pow(edge, 1.5) * body;
    smoke = vec3(0.0055, 0.0058, 0.0064)
          + vec3(0.034, 0.036, 0.039) * pow(lit, 2.0) * body * (0.35 + 0.65 * C)
          + vec3(0.05, 0.052, 0.056) * rim;
    // thin wisps linger over revealed areas: a dynamic opacity field
    float wisp = smoothstep(0.15, 0.95, d2 * 0.5 + 0.5 + ag * 0.3);
    S = clamp((1.0 - m) + m * wisp * 0.22, 0.0, 1.0) * uSmoke;
  } else {
    sc = texture(tScene, uv);
  }

  // ---------- layer: back (env / tunnel), aero streamlines, scene ----------
  vec4 aero = texture(tAero, uv) * uAero;
  back.rgb += aero.rgb;
  back.a = clamp(back.a + aero.a, 0.0, 1.0);
  vec4 col;
  col.rgb = sc.rgb + back.rgb * (1.0 - sc.a);
  col.a = sc.a + back.a * (1.0 - sc.a);
  col.rgb += texture(tBloom, uv).rgb * uBloom;

  // a few percent of the machine leaks through: the DRL and the rim catch glow in the smoke
  float leak = 0.07 * uSmoke;
  col.rgb = col.rgb * (1.0 - S * (1.0 - leak)) + smoke * S;
  col.a = col.a * (1.0 - S) + S;

  // horizontal smear (material plate -> motion transition)
  // (applied as an exposure streak; the plate itself is smeared in its own pass)

  vec3 c = col.a > 1e-4 ? col.rgb / col.a : vec3(0.0);
  c = tonemap(c * uExposure);
  float vig = smoothstep(1.35, 0.25, length((uv - 0.5) * vec2(uAspect, 1.0) * 1.05));
  c *= mix(1.0, vig, uVignette);
  c += (hash12(uv * uRes + fract(uTime * 7.13) * 311.0) - 0.5) * uGrain;
  c = max(c, 0.0);

  float a = clamp(col.a, 0.0, 1.0);
  // dissolve-to-black and hard cuts cover the type layer too
  float k = max(uFlash, uFade);
  outColor = vec4(c * a * (1.0 - k), a * (1.0 - k) + k);
}`;

export function createComposite() {
  return new Pass(
    FRAG,
    {
      tScene: { value: null as Texture | null },
      tDye: { value: null as Texture | null },
      tVel: { value: null as Texture | null },
      tBloom: { value: null as Texture | null },
      tAero: { value: null as Texture | null },
      tEnv: { value: null as Texture | null },
      uRes: { value: new Vector2(1, 1) },
      uDyeTexel: { value: new Vector2(1 / 512, 1 / 512) },
      uAspect: { value: 1 },
      uTime: { value: 0 },
      uExposure: { value: 1 },
      uSmoke: { value: 0 },
      uVignette: { value: 0.6 },
      uGrain: { value: 0.025 },
      uFlash: { value: 0 },
      uFade: { value: 0 },
      uTunnel: { value: 0 },
      uSpeed: { value: 0 },
      uEnv: { value: 0 },
      uBloom: { value: 0.6 },
      uAero: { value: 0 },
      uSmear: { value: 0 },
      uVanish: { value: new Vector2(0.62, 0.5) },
      uKey: { value: new Vector3(-0.4, 0.7, 0.6) },
      uReveal: { value: 0 },
    },
    { transparent: false },
  );
}
