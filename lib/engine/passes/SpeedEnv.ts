import {
  AdditiveBlending,
  BoxGeometry,
  Camera,
  Color,
  HalfFloatType,
  InstancedMesh,
  LinearFilter,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  RGBAFormat,
  Scene,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
  type Texture,
} from "three";
import { Floor } from "../env/Floor";

// Environment for the motion scene, rendered on its own so the composite can blur it
// along the direction of travel while the bike stays sharp. Asphalt rushing past plus
// rhythmic tunnel lights; the world moves, the machine does not.

interface Streak {
  x0: number;
  y: number;
  z: number;
  len: number;
  thick: number;
  hue: number;
}

export class SpeedEnv {
  private scene = new Scene();
  private rt!: WebGLRenderTarget;
  private road: Floor;
  private streaks: InstancedMesh;
  private data: Streak[] = [];
  private m = new Matrix4();
  private q = new Quaternion();
  private s = new Vector3();
  private p = new Vector3();
  private readonly L = 72;

  constructor() {
    this.road = new Floor(null);
    const ru = this.road.material.uniforms;
    ru.uRoad.value = 1;
    ru.uShadow.value = 0;
    ru.uOpacity.value = 0;
    this.scene.add(this.road.mesh);

    // two rows of overhead strips every 6 m, wall light lines, panel seams, distant points
    for (let i = 0; i < 12; i++) {
      this.data.push({ x0: i * 6, y: 5.0, z: 0.0, len: 2.4, thick: 0.06, hue: 0 });
      this.data.push({ x0: i * 6 + 3, y: 5.0, z: 2.2, len: 1.4, thick: 0.04, hue: 0 });
    }
    for (let i = 0; i < 18; i++) this.data.push({ x0: i * 4 + 1.3, y: 0.85, z: -5.0, len: 1.8, thick: 0.035, hue: 0 });
    for (let i = 0; i < 18; i++) this.data.push({ x0: i * 4 + 3.1, y: 1.1, z: 6.0, len: 1.8, thick: 0.035, hue: 0 });
    for (let i = 0; i < 24; i++) this.data.push({ x0: i * 3, y: 2.2, z: -5.6, len: 0.015, thick: 2.6, hue: 2 });
    for (let i = 0; i < 24; i++) this.data.push({ x0: i * 3 + 1.5, y: 2.2, z: 6.6, len: 0.015, thick: 2.6, hue: 2 });
    for (let i = 0; i < 10; i++) this.data.push({ x0: i * 7.3 + 2, y: 2.4 + (i % 3) * 0.6, z: -9, len: 0.5, thick: 0.05, hue: 1 });
    // road studs between the machine and the lens: they become long trails across the frame
    for (let i = 0; i < 14; i++) this.data.push({ x0: i * 5.1, y: 0.02, z: 2.3, len: 0.12, thick: 0.03, hue: i % 4 === 0 ? 3 : 0 });

    const mat = new MeshBasicMaterial({ color: new Color(1, 1, 1), transparent: true, blending: AdditiveBlending, depthWrite: false });
    this.streaks = new InstancedMesh(new BoxGeometry(1, 1, 1), mat, this.data.length);
    this.data.forEach((d, i) => {
      // warm sodium for the distant points, cool white for the rest
      const c =
        d.hue === 1 ? new Color(3.2, 1.9, 1.0) : d.hue === 2 ? new Color(0.1, 0.105, 0.115) : d.hue === 3 ? new Color(3.4, 0.5, 0.25) : new Color(2.8, 2.9, 3.1);
      this.streaks.setColorAt(i, c);
    });
    this.streaks.frustumCulled = false;
    this.scene.add(this.streaks);
  }

  setSize(w: number, h: number) {
    this.rt?.dispose();
    this.rt = new WebGLRenderTarget(Math.round(w * 0.5), Math.round(h * 0.5), {
      type: HalfFloatType,
      format: RGBAFormat,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: true,
    });
  }

  render(r: WebGLRenderer, camera: Camera, travel: number, speed: number, time: number): Texture {
    const L = this.L;
    this.data.forEach((d, i) => {
      let x = (d.x0 - travel) % L;
      if (x < 0) x += L;
      x -= L * 0.6;
      // streaks lengthen with speed, near ones far more: a cheap shutter
      const near = d.z > 2 ? 14 : 2.2;
      const len = d.len * (1 + speed * near);
      this.p.set(x, d.y, d.z);
      this.s.set(len, d.thick, d.hue === 2 ? 0.02 : d.thick);
      this.m.compose(this.p, this.q, this.s);
      this.streaks.setMatrixAt(i, this.m);
    });
    this.streaks.instanceMatrix.needsUpdate = true;
    const ru = this.road.material.uniforms;
    ru.uTravel.value = travel;
    ru.uTime.value = time;
    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, false);
    r.render(this.scene, camera);
    return this.rt.texture;
  }

  dispose() {
    this.rt?.dispose();
    this.road.dispose();
    this.streaks.geometry.dispose();
    (this.streaks.material as MeshBasicMaterial).dispose();
  }
}
