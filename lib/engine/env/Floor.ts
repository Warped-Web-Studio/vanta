import {
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Texture,
  Vector3,
  Color,
} from "three";
import { NOISE } from "../shaders/common";

// The studio floor: near-black concrete that only exists where light falls on it, a
// contact shadow, a turntable / tunnel grid that fades in for the aero scene, and a
// moving asphalt mode for the speed scene. Output is premultiplied alpha so whatever
// sits behind the canvas (type) shows through where the floor is not lit.

export class Floor {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;

  constructor(shadow: Texture | null) {
    this.material = new ShaderMaterial({
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      uniforms: {
        tShadow: { value: shadow },
        uShadowBounds: { value: new Vector3(1.6, 0.8, 0) },
        uShadow: { value: 0.92 },
        uColor: { value: new Color(0.018, 0.018, 0.02) },
        uOpacity: { value: 0.85 },
        uSpot: { value: new Vector3(0.1, 0.0, 2.6) },
        uGrid: { value: 0 },
        uRoad: { value: 0 },
        uTravel: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main(){
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tShadow;
        uniform vec3 uShadowBounds;
        uniform float uShadow;
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform vec3 uSpot;
        uniform float uGrid;
        uniform float uRoad;
        uniform float uTravel;
        uniform float uTime;
        varying vec3 vWorld;
        ${NOISE}
        void main(){
          vec2 p = vWorld.xz;
          // pool of light under the bike
          float r = length((p - uSpot.xy) * vec2(0.62, 1.0));
          float pool = exp(-r * r / (uSpot.z * 0.55));
          // concrete grain
          float g = fbm3(vec3(p * 9.0, 0.0)) * 0.5 + 0.5;
          vec3 col = uColor * (0.75 + g * 0.5) * (0.25 + pool * 1.6);
          float a = pool * uOpacity;

          // tunnel turntable: fine engineering grid
          if (uGrid > 0.001) {
            vec2 q = p * 4.0;
            vec2 gl = abs(fract(q) - 0.5) / fwidth(q);
            float line = 1.0 - min(min(gl.x, gl.y), 1.0);
            vec2 q2 = p;
            vec2 gl2 = abs(fract(q2) - 0.5) / fwidth(q2);
            float major = 1.0 - min(min(gl2.x, gl2.y), 1.0);
            float ring = abs(length(p) - 1.55);
            float disc = 1.0 - smoothstep(0.0, 0.004 / max(fwidth(length(p)) * 60.0, 0.01), ring);
            float fade = exp(-dot(p, p) * 0.06);
            vec3 gc = vec3(0.07, 0.075, 0.08) * (line * 0.35 + major * 0.7 + disc * 0.8) * fade;
            col = mix(col, vec3(0.05, 0.053, 0.058) * fade + gc, uGrid);
            a = mix(a, fade * 0.98, uGrid);
          }

          // asphalt rushing past, with the tunnel lights smeared across it
          if (uRoad > 0.001) {
            vec2 q = vec2(p.x + uTravel, p.y);
            float ag = snoise(vec3(q * 34.0, 0.0)) * 0.5 + 0.5;
            float ag2 = snoise(vec3(q * 4.0, 3.0)) * 0.5 + 0.5;
            vec3 road = vec3(0.034) * (0.55 + ag * 0.45) * (0.7 + ag2 * 0.6);
            float lane = step(abs(p.y + 1.15), 0.05) * step(0.55, fract(q.x * 0.11));
            float edgeL = step(abs(p.y - 2.6), 0.06);
            road += vec3(0.22) * (lane + edgeL);
            // reflections of the overhead strips on slightly polished asphalt
            float rl = pow(max(0.0, sin(q.x * 6.2831 / 6.0)), 18.0) * exp(-abs(p.y - 0.6) * 1.2);
            float rw = pow(max(0.0, sin((q.x + 1.3) * 6.2831 / 4.0)), 30.0) * (exp(-abs(p.y + 5.0) * 0.8) + exp(-abs(p.y - 6.0) * 0.8));
            road += vec3(0.32, 0.33, 0.35) * rl * (0.6 + ag * 0.6) + vec3(0.12) * rw;
            float fade = exp(-abs(p.y) * 0.14) * smoothstep(42.0, 6.0, abs(p.x));
            col = mix(col, road, uRoad);
            a = mix(a, fade, uRoad);
          }

          // contact shadow
          vec2 suv = (p / uShadowBounds.xy) * 0.5 + 0.5;
          float sh = 0.0;
          if (suv.x > 0.0 && suv.x < 1.0 && suv.y > 0.0 && suv.y < 1.0) sh = texture2D(tShadow, suv).r;
          sh *= uShadow;
          col *= 1.0 - sh;
          a = max(a, sh);
          gl_FragColor = vec4(col * a, a);
        }`,
    });
    this.mesh = new Mesh(new PlaneGeometry(80, 40), this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = -1;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
