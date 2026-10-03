import {
  HalfFloatType,
  LinearFilter,
  OrthographicCamera,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { Pass } from "../gl/fullscreen";

// Contact shadow: the bike seen from below by an orthographic camera, with darkness by
// proximity to the floor, then blurred. Only re-rendered when the bike actually moves.

export const SHADOW_BOUNDS = new Vector2(1.6, 0.8);

const BLUR = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tMap;
uniform vec2 uDir;
void main(){
  float w[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
  vec4 s = texture(tMap, vUv) * w[0];
  for (int i = 1; i < 5; i++) {
    s += texture(tMap, vUv + uDir * float(i)) * w[i];
    s += texture(tMap, vUv - uDir * float(i)) * w[i];
  }
  outColor = s;
}`;

export class ContactShadow {
  readonly target: WebGLRenderTarget;
  private temp: WebGLRenderTarget;
  private cam: OrthographicCamera;
  private depthMat: ShaderMaterial;
  private blur: Pass;
  dirty = true;

  constructor(size = 512) {
    const opts = { type: HalfFloatType, format: RGBAFormat, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: true };
    this.target = new WebGLRenderTarget(size, size / 2, opts);
    this.temp = new WebGLRenderTarget(size, size / 2, { ...opts, depthBuffer: false });
    this.cam = new OrthographicCamera(-SHADOW_BOUNDS.x, SHADOW_BOUNDS.x, SHADOW_BOUNDS.y, -SHADOW_BOUNDS.y, 0, 0.95);
    this.cam.position.set(0, 0, 0);
    this.cam.rotation.x = Math.PI / 2;
    this.cam.layers.set(0);
    this.cam.updateMatrixWorld();
    this.depthMat = new ShaderMaterial({
      vertexShader: /* glsl */ `
        varying float vH;
        void main(){
          vec4 w = modelMatrix * vec4(position, 1.0);
          vH = w.y;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        varying float vH;
        void main(){
          float d = clamp(1.0 - vH / 0.95, 0.0, 1.0);
          gl_FragColor = vec4(pow(d, 3.2), 0.0, 0.0, 1.0);
        }`,
      side: 2,
    });
    this.blur = new Pass(BLUR, { tMap: { value: null }, uDir: { value: new Vector2() } });
  }

  render(renderer: WebGLRenderer, scene: Scene) {
    if (!this.dirty) return;
    this.dirty = false;
    const prevOverride = scene.overrideMaterial;
    const prevBg = scene.background;
    scene.overrideMaterial = this.depthMat;
    scene.background = null;
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, false);
    renderer.render(scene, this.cam);
    scene.overrideMaterial = prevOverride;
    scene.background = prevBg;
    const w = this.target.width, h = this.target.height;
    for (let i = 0; i < 2; i++) {
      const s = 1 + i * 1.6;
      this.blur.u.tMap.value = this.target.texture;
      this.blur.u.uDir.value.set(s / w, 0);
      this.blur.render(renderer, this.temp);
      this.blur.u.tMap.value = this.temp.texture;
      this.blur.u.uDir.value.set(0, (s * 2) / h);
      this.blur.render(renderer, this.target);
    }
  }

  dispose() {
    this.target.dispose();
    this.temp.dispose();
    this.depthMat.dispose();
    this.blur.dispose();
  }
}
