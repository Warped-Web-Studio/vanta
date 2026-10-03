import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  OrthographicCamera,
  RawShaderMaterial,
  ShaderMaterial,
  WebGLRenderer,
  WebGLRenderTarget,
  GLSL3,
  type IUniform,
} from "three";

// One oversized triangle covers the viewport: cheaper than a quad and no diagonal seam.
const tri = new BufferGeometry();
tri.setAttribute("position", new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
tri.setAttribute("uv", new Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));

const cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

export const FULLSCREEN_VERT = /* glsl */ `
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export type Uniforms = Record<string, IUniform>;

/** A fullscreen shader pass. Fragment shaders are GLSL3 and write to `outColor`. */
export class Pass {
  readonly material: RawShaderMaterial;
  private mesh: Mesh;

  constructor(frag: string, uniforms: Uniforms, opts: { blending?: ShaderMaterial["blending"]; transparent?: boolean } = {}) {
    this.material = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: `precision highp float;\nprecision highp int;\n${frag}`,
      uniforms,
      depthTest: false,
      depthWrite: false,
      transparent: opts.transparent ?? false,
    });
    if (opts.blending !== undefined) this.material.blending = opts.blending;
    this.mesh = new Mesh(tri, this.material);
    this.mesh.frustumCulled = false;
  }

  get u() {
    return this.material.uniforms;
  }

  render(renderer: WebGLRenderer, target: WebGLRenderTarget | null) {
    renderer.setRenderTarget(target);
    renderer.render(this.mesh, cam);
  }

  dispose() {
    this.material.dispose();
  }
}

/** Ping-pong pair of render targets. */
export class DoubleTarget {
  read: WebGLRenderTarget;
  write: WebGLRenderTarget;
  constructor(make: () => WebGLRenderTarget) {
    this.read = make();
    this.write = make();
  }
  swap() {
    const t = this.read;
    this.read = this.write;
    this.write = t;
  }
  setSize(w: number, h: number) {
    this.read.setSize(w, h);
    this.write.setSize(w, h);
  }
  dispose() {
    this.read.dispose();
    this.write.dispose();
  }
}
