import { BufferGeometry, Vector3 } from "three";
import type { MatKey } from "./materials";

export type GroupId =
  | "bodywork"
  | "front"
  | "chassis"
  | "engine"
  | "intake"
  | "fuel"
  | "exhaust"
  | "rearSusp"
  | "swingarm"
  | "wheels"
  | "electronics";

export const GROUPS: GroupId[] = [
  "bodywork",
  "front",
  "chassis",
  "engine",
  "intake",
  "fuel",
  "exhaust",
  "rearSusp",
  "swingarm",
  "wheels",
  "electronics",
];

export interface NodeSpec {
  /** rotation pivot / local origin in bike space */
  pivot?: Vector3;
  /** exploded-view travel in meters */
  explode?: Vector3;
  /** 0..1 start of this node's travel within the explode timeline */
  delay?: number;
  /** short first move along the fastener axis before the main travel */
  unbolt?: Vector3;
}

export interface NodeData {
  name: string;
  group: GroupId;
  spec: Required<NodeSpec>;
  geos: Map<MatKey, BufferGeometry[]>;
  dynamic: { name: string; mat: MatKey; geo: BufferGeometry }[];
}

/** Collects geometry per node and material; the Bike class merges and assembles it. */
export class Builder {
  nodes = new Map<string, NodeData>();
  anchors = new Map<string, { node: string; p: Vector3 }>();
  private cur: NodeData | null = null;
  parts = 0;

  node(name: string, group: GroupId, spec: NodeSpec = {}) {
    let n = this.nodes.get(name);
    if (!n) {
      n = {
        name,
        group,
        spec: {
          pivot: spec.pivot ?? new Vector3(),
          explode: spec.explode ?? new Vector3(),
          delay: spec.delay ?? 0,
          unbolt: spec.unbolt ?? new Vector3(),
        },
        geos: new Map(),
        dynamic: [],
      };
      this.nodes.set(name, n);
    }
    this.cur = n;
    return this;
  }

  add(mat: MatKey, ...geos: BufferGeometry[]) {
    if (!this.cur) throw new Error("Builder.add before node()");
    let arr = this.cur.geos.get(mat);
    if (!arr) this.cur.geos.set(mat, (arr = []));
    arr.push(...geos);
    this.parts += geos.length;
    return this;
  }

  /** an individually animated mesh (pistons, rods, crank) */
  dyn(name: string, mat: MatKey, geo: BufferGeometry) {
    if (!this.cur) throw new Error("Builder.dyn before node()");
    this.cur.dynamic.push({ name, mat, geo });
    this.parts++;
    return this;
  }

  anchor(name: string, p: Vector3) {
    if (!this.cur) throw new Error("Builder.anchor before node()");
    this.anchors.set(name, { node: this.cur.name, p: p.clone() });
    return this;
  }
}
