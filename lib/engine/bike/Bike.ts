import {
  BufferGeometry,
  Camera,
  EdgesGeometry,
  Group,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  MeshStandardMaterial,
  Plane,
  ShaderMaterial,
  Vector3,
  type Material,
  type Texture,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Builder, GROUPS, type GroupId, type NodeData } from "./builder";
import { createMatSet, createXrayMaterial, disposeMatSet, makeGroupUniforms, type GroupUniforms, type MatKey, type MatSet } from "./materials";
import type { CarbonMaps } from "./textures";
import { buildWheels } from "./parts/wheels";
import { buildFront } from "./parts/front";
import { buildBodywork } from "./parts/bodywork";
import { buildChassis } from "./parts/chassis";
import { buildEngine, buildRadiator, BORE_Z, ROD, STROKE } from "./parts/engine";
import { buildExhaust } from "./parts/exhaust";
import { buildSwingarm, buildRearSuspension, buildIntake, buildFuel, buildElectronics } from "./parts/systems";
import { D, bankDir } from "./parts/dims";

export interface BuildProgress {
  (p: number, detail: string): void;
}

interface NodeObj {
  obj: Group;
  data: NodeData;
  pivot: Vector3;
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * The procedural R1. Geometry is authored in bike space by the part builders, merged per
 * node and material, then hung on pivots so systems can separate, spin and section.
 */
export class Bike {
  readonly root = new Group();
  readonly body = new Group();
  readonly nodes = new Map<string, NodeObj>();
  readonly groupU = new Map<GroupId, GroupUniforms>();
  readonly mats = new Map<GroupId, MatSet>();
  readonly dyn = new Map<string, Mesh>();
  readonly anchors = new Map<string, { node: string; local: Vector3 }>();
  /** world-space clipping plane used to section the engine */
  readonly cut = new Plane(new Vector3(0, 0, -1), 10);
  stats = { parts: 0, verts: 0, meshes: 0 };
  private internalsMats: MatSet | null = null;
  private xray: ShaderMaterial | null = null;
  private xrayAmt = { value: 0 };
  private ghosts: LineSegments[] = [];
  private tmp = new Vector3();

  static async build(carbon: CarbonMaps, engraving: Texture | null, onProgress: BuildProgress): Promise<Bike> {
    const bike = new Bike();
    const b = new Builder();
    const steps: [string, (b: Builder) => void][] = [
      ["WHEELS", buildWheels],
      ["FRONT ASSEMBLY", buildFront],
      ["CHASSIS", buildChassis],
      ["BODYWORK", buildBodywork],
      ["ENGINE", buildEngine],
      ["COOLING", buildRadiator],
      ["EXHAUST", buildExhaust],
      ["SWINGARM", buildSwingarm],
      ["REAR SUSPENSION", buildRearSuspension],
      ["INTAKE", buildIntake],
      ["FUEL", buildFuel],
      ["ELECTRONICS", buildElectronics],
    ];
    for (let i = 0; i < steps.length; i++) {
      const [label, fn] = steps[i];
      fn(b);
      onProgress((i + 1) / (steps.length + 2), `${label}  ${b.parts} PARTS`);
      await nextFrame();
    }

    for (const g of GROUPS) {
      const gu = makeGroupUniforms();
      bike.groupU.set(g, gu);
      const set = createMatSet(gu, carbon, engraving);
      if (g === "engine") {
        // the engine shell is removed by a scanning plane in the Power scene
        for (const m of Object.values(set) as Material[]) m.clippingPlanes = [bike.cut];
      }
      bike.mats.set(g, set);
    }
    bike.internalsMats = createMatSet(bike.groupU.get("engine")!, carbon, engraving);
    const egu = bike.groupU.get("engine")!;
    bike.xray = createXrayMaterial(egu.uCutZ, bike.xrayAmt);

    for (const data of b.nodes.values()) {
      const obj = new Group();
      obj.name = data.name;
      obj.position.copy(data.spec.pivot);
      const set = bike.mats.get(data.group)!;
      for (const [key, geos] of data.geos) {
        const merged = mergeAll(geos);
        merged.translate(-data.spec.pivot.x, -data.spec.pivot.y, -data.spec.pivot.z);
        const mesh = new Mesh(merged, set[key as MatKey]);
        mesh.name = `${data.name}:${key}`;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        obj.add(mesh);
        if (data.name === "engine") {
          // x-ray ghost of the shell, shown where the scanning plane has removed it
          const ghost = new LineSegments(new EdgesGeometry(merged, 24), bike.xray!);
          ghost.matrixAutoUpdate = false;
          ghost.updateMatrix();
          ghost.visible = false;
          ghost.renderOrder = 2;
          obj.add(ghost);
          bike.ghosts.push(ghost);
        }
        bike.stats.verts += merged.getAttribute("position").count;
        bike.stats.meshes++;
      }
      for (const d of data.dynamic) {
        // pulses each need their own material so they can fire independently
        const mat = d.mat === "pulse" ? bike.internalsMats[d.mat].clone() : bike.internalsMats[d.mat];
        const mesh = new Mesh(d.geo, mat);
        mesh.name = d.name;
        mesh.visible = false;
        obj.add(mesh);
        bike.dyn.set(d.name, mesh);
        bike.stats.verts += d.geo.getAttribute("position").count;
      }
      bike.body.add(obj);
      bike.nodes.set(data.name, { obj, data, pivot: data.spec.pivot.clone() });
    }
    for (const [name, a] of b.anchors) {
      const n = bike.nodes.get(a.node)!;
      bike.anchors.set(name, { node: a.node, local: a.p.clone().sub(n.pivot) });
    }
    bike.stats.parts = b.parts;
    bike.root.add(bike.body);
    onProgress(1, `${b.parts} PARTS  ${(bike.stats.verts / 1000).toFixed(0)}K VERTS`);
    await nextFrame();
    return bike;
  }

  /**
   * Replace procedural parts with same-named objects from an authored GLB. Returns the
   * number of parts replaced.
   */
  applyGlb(root: Object3D) {
    root.updateMatrixWorld(true);
    let replaced = 0;
    for (const n of this.nodes.values()) {
      const src = root.getObjectByName(n.data.name);
      if (!src) continue;
      // drop the procedural meshes (keep animated internals)
      for (const child of [...n.obj.children]) {
        if (this.dyn.has(child.name)) continue;
        n.obj.remove(child);
        const m = child as Mesh;
        if (m.isMesh || (m as unknown as LineSegments).isLineSegments) m.geometry.dispose();
      }
      const part = src.clone(true);
      // authored in bike space: express relative to this node's pivot
      if (src.parent) part.applyMatrix4(src.parent.matrixWorld);
      part.position.sub(n.pivot);
      n.obj.add(part);
      replaced++;
    }
    return replaced;
  }

  /** 0 = assembled, 1 = fully separated. Two-stage: unbolt along the fastener axis, then travel. */
  setExplode(t: number) {
    const span = 0.38;
    for (const n of this.nodes.values()) {
      const { explode, unbolt, delay } = n.data.spec;
      const local = clamp01((t - delay) / span);
      const u = easeOutQuart(clamp01(local / 0.22));
      const m = easeInOut(clamp01((local - 0.16) / 0.84));
      n.obj.position.set(
        n.pivot.x + unbolt.x * u + explode.x * m,
        n.pivot.y + unbolt.y * u + explode.y * m,
        n.pivot.z + unbolt.z * u + explode.z * m,
      );
    }
  }

  /** settle progress (0..1) of a node's travel, used to time labels */
  nodeSettle(name: string, t: number) {
    const n = this.nodes.get(name);
    if (!n) return 0;
    return clamp01((t - n.data.spec.delay) / 0.38);
  }

  setWheelSpin(front: number, rear: number) {
    const f = this.nodes.get("wheelF");
    const r = this.nodes.get("wheelR");
    if (f) f.obj.rotation.z = -front;
    if (r) r.obj.rotation.z = -rear;
  }

  /**
   * Engine internals. `crank` in radians. Pistons follow real slider-crank kinematics
   * with the R1's 50.8 mm stroke and 105 mm rods. Returns per-cylinder TDC proximity.
   */
  setEngine(crank: number, visible: boolean, cut: number) {
    // the plane sweeps from the right side of the engine to the left, taking the shell
    this.cut.constant = cut > 0.001 ? 0.34 - cut * 0.7 : 10;
    const gu = this.groupU.get("engine");
    if (gu) {
      gu.uHatch.value = cut > 0.001 && cut < 0.999 ? 1 : 0;
      gu.uCutZ.value = this.cut.constant;
    }
    this.xrayAmt.value = Math.min(1, cut * 2);
    for (const g of this.ghosts) g.visible = cut > 0.001;
    const r = STROKE / 2;
    const banks = [D.bankF, D.bankR];
    const tdc = [0, 0, 0, 0];
    let i = 0;
    for (let bank = 0; bank < 2; bank++) {
      const a = banks[bank];
      const e = bankDir(a);
      for (let k = 0; k < 2; k++) {
        const phase = crank + (k === 0 ? 0 : Math.PI);
        const pin = this.tmp.set(D.crank.x + Math.cos(phase) * r, D.crank.y + Math.sin(phase) * r, BORE_Z[k]);
        const rel = phase - a;
        const x = r * Math.cos(rel) + Math.sqrt(ROD * ROD - r * r * Math.sin(rel) ** 2);
        const px = D.crank.x + e.x * x, py = D.crank.y + e.y * x;
        const piston = this.dyn.get(`piston${bank}${k}`);
        const rod = this.dyn.get(`rod${bank}${k}`);
        if (piston) {
          piston.visible = visible;
          piston.position.set(px + e.x * 0.012, py + e.y * 0.012, BORE_Z[k]);
          piston.rotation.z = a - Math.PI / 2;
        }
        if (rod) {
          rod.visible = visible;
          rod.position.set(pin.x, pin.y, BORE_Z[k] + (bank === 0 ? -0.011 : 0.011));
          rod.rotation.z = Math.atan2(py - pin.y, px - pin.x) - Math.PI / 2;
        }
        // four-stroke: each cylinder fires once every two crank revolutions
        const cyc = ((rel % (Math.PI * 4)) + Math.PI * 4) % (Math.PI * 4);
        tdc[i] = Math.max(0, Math.cos(cyc / 2));
        const flash = this.dyn.get(`flash${i}`);
        if (flash) {
          flash.position.set(D.crank.x + e.x * 0.152, D.crank.y + e.y * 0.152, BORE_Z[k]);
          flash.visible = visible;
        }
        i++;
      }
    }
    const c = this.dyn.get("crank");
    if (c) {
      c.visible = visible;
      c.position.set(D.crank.x, D.crank.y, 0);
      c.rotation.z = crank;
    }
    return tdc;
  }

  /** combustion pulse intensities, 0..1 per cylinder */
  setPulses(v: ArrayLike<number>) {
    for (let i = 0; i < 4; i++) {
      const m = this.dyn.get(`flash${i}`);
      if (!m) continue;
      const k = v[i] * 4;
      (m.material as MeshBasicMaterial).color.setRGB(k, k * 0.9, k * 0.78);
    }
  }

  /** spokes become a disc at speed */
  setSpokeBlur(amount: number) {
    for (const n of ["blurFL", "blurFR", "blurRL", "blurRR"]) {
      const m = this.dyn.get(n);
      if (!m) continue;
      m.visible = amount > 0.01;
      (m.material as MeshStandardMaterial).opacity = amount * 0.92;
    }
  }

  setGroupVisible(group: GroupId, v: boolean) {
    for (const n of this.nodes.values()) if (n.data.group === group) n.obj.visible = v;
  }

  /** rear ride height and pitch from the suspension setting */
  setPosture(pitch: number, lift: number) {
    // rotate about the rear contact patch
    const cx = D.rearAxle.x, cy = 0;
    this.body.rotation.z = pitch;
    const c = Math.cos(pitch), s = Math.sin(pitch);
    this.body.position.set(cx - (cx * c - cy * s), lift + cy - (cx * s + cy * c), 0);
  }

  setDim(group: GroupId, v: number) {
    const u = this.groupU.get(group);
    if (u) u.uDim.value = v;
  }
  setRim(group: GroupId, v: number) {
    const u = this.groupU.get(group);
    if (u) u.uRim.value = v;
  }
  setDrl(intensity: number) {
    const m = this.mats.get("bodywork")!.drl;
    m.color.setRGB(5.5 * intensity, 5.4 * intensity, 5.1 * intensity);
  }

  /** world position of an anchor */
  anchorWorld(name: string, out: Vector3) {
    const a = this.anchors.get(name);
    if (!a) return null;
    const n = this.nodes.get(a.node)!;
    return n.obj.localToWorld(out.copy(a.local));
  }

  /** project every anchor to pixels */
  project(camera: Camera, w: number, h: number, out: Map<string, { x: number; y: number; v: number }>) {
    for (const name of this.anchors.keys()) {
      const p = this.anchorWorld(name, this.tmp)!;
      p.project(camera);
      let rec = out.get(name);
      if (!rec) out.set(name, (rec = { x: 0, y: 0, v: 0 }));
      rec.x = (p.x * 0.5 + 0.5) * w;
      rec.y = (-p.y * 0.5 + 0.5) * h;
      rec.v = p.z < 1 && p.z > -1 ? 1 : 0;
    }
  }

  dispose() {
    for (const n of this.nodes.values()) {
      n.obj.traverse((o) => {
        if ((o as Mesh).isMesh || (o as LineSegments).isLineSegments) (o as Mesh).geometry.dispose();
      });
    }
    for (const m of this.mats.values()) disposeMatSet(m);
    this.xray?.dispose();
    if (this.internalsMats) disposeMatSet(this.internalsMats);
  }
}

function mergeAll(geos: BufferGeometry[]): BufferGeometry {
  if (geos.length === 1) return geos[0];
  const m = mergeGeometries(geos, false);
  if (!m) throw new Error("mergeGeometries failed: attribute mismatch");
  geos.forEach((g) => g.dispose());
  return m;
}
