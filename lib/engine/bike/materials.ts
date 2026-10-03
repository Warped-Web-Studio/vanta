import {
  AdditiveBlending,
  Color,
  DoubleSide,
  ShaderMaterial,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Vector2,
  Vector3,
  type Material,
  type Texture,
} from "three";
import type { CarbonMaps } from "./textures";

// Global uniforms shared by every bike material (by reference).
export const globalU = {
  uClay: { value: 0 },
  uKeyDirView: { value: new Vector3(0.3, 0.8, 0.4).normalize() },
  uTime: { value: 0 },
};

// Per-group uniforms: each system gets its own set so it can be dimmed or highlighted.
export interface GroupUniforms {
  uDim: { value: number };
  uRim: { value: number };
  /** section view: hatch interior faces and draw the cut line at world z = uCutZ */
  uHatch: { value: number };
  uCutZ: { value: number };
}
export const makeGroupUniforms = (): GroupUniforms => ({ uDim: { value: 0 }, uRim: { value: 0 }, uHatch: { value: 0 }, uCutZ: { value: 10 } });

const HEADER = /* glsl */ `
uniform float uClay;
uniform vec3 uKeyDirView;
uniform float uDim;
uniform float uRim;
uniform float uHatch;
uniform float uCutZ;
varying vec3 vVantaWorld;
vec3 vHash33(vec3 p){
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
`;

/**
 * Patch a built-in PBR material with the VANTA hooks:
 *  - clay: a sweep (front to back) that turns the paint into a matte wind-tunnel model
 *  - rim: fresnel highlight for annotated systems
 *  - dim: lets systems recede into darkness
 *  - flake: metallic ground-coat sparkle under an untouched clearcoat
 */
function patch<T extends MeshStandardMaterial>(mat: T, gu: GroupUniforms, opts: { flake?: number; clayable?: boolean } = {}): T {
  const flake = opts.flake ?? 0;
  const clayable = opts.clayable ?? true;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uClay = globalU.uClay;
    shader.uniforms.uKeyDirView = globalU.uKeyDirView;
    shader.uniforms.uDim = gu.uDim;
    shader.uniforms.uRim = gu.uRim;
    shader.uniforms.uHatch = gu.uHatch;
    shader.uniforms.uCutZ = gu.uCutZ;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vVantaWorld;")
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvVantaWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    let frag = shader.fragmentShader.replace("#include <common>", "#include <common>\n" + HEADER);
    if (flake > 0) {
      frag = frag.replace(
        "#include <normal_fragment_maps>",
        /* glsl */ `#include <normal_fragment_maps>
        {
          float aa = clamp(1.0 - length(fwidth(vVantaWorld)) * 900.0, 0.0, 1.0);
          vec3 fl = vHash33(floor(vVantaWorld * 1400.0)) - 0.5;
          normal = normalize(normal + fl * ${flake.toFixed(3)} * aa);
        }`,
      );
    }
    frag = frag.replace(
      "#include <opaque_fragment>",
      /* glsl */ `#include <opaque_fragment>
      {
        vec3 vN = normalize(normal);
        ${
          clayable
            ? `float sweepX = mix(1.25, -1.25, uClay);
        float clayMask = smoothstep(sweepX - 0.04, sweepX + 0.04, vVantaWorld.x) * step(0.001, uClay);
        float ndl = max(dot(vN, normalize(uKeyDirView)), 0.0);
        vec3 clay = vec3(0.30, 0.305, 0.31) * (0.12 + 0.88 * ndl) + vec3(0.025) * (0.5 + 0.5 * vN.y);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, clay, clayMask);
        float band = exp(-abs(vVantaWorld.x - sweepX) * 60.0) * step(0.001, uClay) * step(uClay, 0.999);
        gl_FragColor.rgb += vec3(1.6, 1.62, 1.66) * band;`
            : ""
        }
        if (uHatch > 0.001) {
          // the scanning plane: a fine bright line where it cuts the shell
          float line = 1.0 - smoothstep(0.0006, 0.0022, abs(vVantaWorld.z - uCutZ));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.4, 1.38, 1.34), line * uHatch);
        }
        float fres = pow(1.0 - clamp(dot(vN, normalize(vViewPosition)), 0.0, 1.0), 2.5);
        gl_FragColor.rgb += uRim * fres * vec3(0.85, 0.88, 0.92) * 0.9;
        gl_FragColor.rgb *= 1.0 - uDim;
      }`,
    );
    shader.fragmentShader = frag;
  };
  mat.customProgramCacheKey = () => `vanta-${flake}-${clayable ? 1 : 0}`;
  return mat;
}

export interface MatSet {
  paint: MeshPhysicalMaterial;
  paintInner: MeshStandardMaterial;
  carbon: MeshPhysicalMaterial;
  alu: MeshPhysicalMaterial;
  aluDark: MeshPhysicalMaterial;
  titanium: MeshPhysicalMaterial;
  dlc: MeshPhysicalMaterial;
  steel: MeshPhysicalMaterial;
  rubber: MeshPhysicalMaterial;
  magnesium: MeshPhysicalMaterial;
  suede: MeshStandardMaterial;
  black: MeshStandardMaterial;
  glass: MeshPhysicalMaterial;
  drl: MeshBasicMaterial;
  tail: MeshBasicMaterial;
  screen: MeshBasicMaterial;
  engraved: MeshPhysicalMaterial;
  pulse: MeshBasicMaterial;
  spokeBlur: MeshStandardMaterial;
}

export function createMatSet(gu: GroupUniforms, carbon: CarbonMaps, engraving: Texture | null): MatSet {
  // weave repeats every 6.4 cm (16 tows of 4 mm); loft UVs are in meters
  const rep = 1 / 0.064;
  const cMaps = carbon;
  for (const t of Object.values(cMaps)) {
    if (t.repeat.x !== rep) {
      t.repeat.set(rep, rep);
      t.needsUpdate = true;
    }
  }

  const paint = patch(
    new MeshPhysicalMaterial({
      color: new Color(0x0c0d0f),
      roughness: 0.5,
      metalness: 0.28,
      clearcoat: 0.5,
      clearcoatRoughness: 0.1,
      envMapIntensity: 1.0,
      side: DoubleSide,
    }),
    gu,
    { flake: 0.38 },
  );

  const paintInner = patch(
    new MeshStandardMaterial({ color: new Color(0x050506), roughness: 0.8, metalness: 0, side: DoubleSide }),
    gu,
  );

  const carbonM = patch(
    new MeshPhysicalMaterial({
      color: new Color(0xffffff),
      map: cMaps.map,
      normalMap: cMaps.normalMap,
      normalScale: new Vector2(0.55, 0.55),
      roughnessMap: cMaps.roughnessMap,
      roughness: 1,
      metalness: 0.15,
      anisotropy: 0.75,
      anisotropyMap: cMaps.anisotropyMap,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.15,
      side: DoubleSide,
    }),
    gu,
  );

  const alu = patch(
    new MeshPhysicalMaterial({ color: new Color(0x9ea2a8), roughness: 0.32, metalness: 1, anisotropy: 0.5, envMapIntensity: 1.0 }),
    gu,
  );
  const aluDark = patch(
    new MeshPhysicalMaterial({ color: new Color(0x2c2e32), roughness: 0.34, metalness: 1, envMapIntensity: 1.0 }),
    gu,
  );
  const titanium = patch(
    new MeshPhysicalMaterial({
      color: new Color(0xffffff),
      vertexColors: true,
      roughness: 0.3,
      metalness: 1,
      anisotropy: 0.35,
      envMapIntensity: 1.05,
    }),
    gu,
  );
  const dlc = patch(
    new MeshPhysicalMaterial({ color: new Color(0x141517), roughness: 0.16, metalness: 1, clearcoat: 0.4, envMapIntensity: 1.2 }),
    gu,
  );
  const steel = patch(
    new MeshPhysicalMaterial({ color: new Color(0x8a8e93), roughness: 0.22, metalness: 1, anisotropy: 0.7, envMapIntensity: 1.1 }),
    gu,
  );
  const rubber = patch(
    new MeshPhysicalMaterial({ color: new Color(0x060607), roughness: 0.9, metalness: 0, sheen: 0.05, sheenRoughness: 0.8, envMapIntensity: 0.22 }),
    gu,
  );
  const magnesium = patch(
    new MeshPhysicalMaterial({ color: new Color(0x26272a), roughness: 0.48, metalness: 0.85, envMapIntensity: 0.9 }),
    gu,
  );
  const suede = patch(
    new MeshStandardMaterial({ color: new Color(0x121214), roughness: 0.96, metalness: 0, envMapIntensity: 0.4 }),
    gu,
  );
  const black = patch(
    new MeshStandardMaterial({ color: new Color(0x070708), roughness: 0.62, metalness: 0.1, envMapIntensity: 0.6, side: DoubleSide }),
    gu,
  );
  const glass = patch(
    new MeshPhysicalMaterial({
      color: new Color(0x0a0b0d),
      roughness: 0.04,
      metalness: 0.2,
      transparent: true,
      opacity: 0.72,
      envMapIntensity: 1.8,
      side: DoubleSide,
      depthWrite: false,
    }),
    gu,
    { clayable: false },
  );
  // emissives are HDR (>1) so the bloom pass catches them
  const drl = new MeshBasicMaterial({ color: new Color(5.5, 5.4, 5.1), toneMapped: false });
  const tail = new MeshBasicMaterial({ color: new Color(4.2, 0.5, 0.22), toneMapped: false });
  const screen = new MeshBasicMaterial({ color: new Color(0x050607), toneMapped: false });
  // machined top-clamp face with the laser-etched serial: the etch is a bump + roughness map
  const engraved = patch(
    new MeshPhysicalMaterial({
      color: new Color(0x9a958e),
      roughness: 0.82,
      roughnessMap: engraving,
      bumpMap: engraving,
      bumpScale: -0.9,
      metalness: 1,
      anisotropy: 0.4,
      envMapIntensity: 1.1,
      transparent: false,
    }),
    gu,
  );

  // combustion pulse: additive, HDR so bloom turns it into light rather than a shape
  const pulse = new MeshBasicMaterial({ color: new Color(0, 0, 0), transparent: true, blending: 2, depthWrite: false, toneMapped: false });
  // at speed the spokes become a disc: a smooth metallic blur that fades in with velocity
  const spokeBlur = new MeshStandardMaterial({ color: new Color(0x26272b), metalness: 0.85, roughness: 0.45, transparent: true, opacity: 0, depthWrite: false, envMapIntensity: 0.8 });

  return {
    pulse,
    spokeBlur,
    paint,
    paintInner,
    carbon: carbonM,
    alu,
    aluDark,
    titanium,
    dlc,
    steel,
    rubber,
    magnesium,
    suede,
    black,
    glass,
    drl,
    tail,
    screen,
    engraved,
  };
}

export type MatKey = keyof MatSet;

export function disposeMatSet(m: MatSet) {
  for (const mat of Object.values(m) as Material[]) mat.dispose();
}

/** X-ray of the removed shell drawn as engineering edges, only where the plane has passed */
export function createXrayMaterial(cutZ: { value: number }, amount: { value: number }) {
  return new ShaderMaterial({
    uniforms: { uCutZ: cutZ, uAmt: amount },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uCutZ;
      uniform float uAmt;
      varying vec3 vW;
      void main(){
        float removed = smoothstep(uCutZ - 0.003, uCutZ + 0.003, vW.z);
        gl_FragColor = vec4(vec3(0.62, 0.65, 0.7) * 0.55 * uAmt * removed, 1.0);
      }`,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
}
