import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  ExtrudeGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  Matrix4,
  Shape,
  Path,
  TubeGeometry,
  Vector2,
  Vector3,
  Euler,
  Quaternion,
} from "three";

// Geometry toolkit for the procedural R1. Units are meters; x forward, y up, z to the
// rider's right. Everything is built in a faceted, panelled language on purpose: flat
// facets with crisp creases read as engineered rather than "modelled badly smooth".

export type Profile = [number, number][];

/** Chamfered octagon: u lateral, v vertical, both -1..1. `c` is the chamfer size. */
export function octa(c = 0.32, topFlat = 1, bottomFlat = 1): Profile {
  return [
    [0, 1],
    [1 - c * topFlat, 1],
    [1, 1 - c],
    [1, -1 + c],
    [1 - c * bottomFlat, -1],
    [0, -1],
    [-1 + c * bottomFlat, -1],
    [-1, -1 + c],
    [-1, 1 - c],
    [-1 + c * topFlat, 1],
  ];
}

/** Stealth hull section: ridged top, raked flanks, narrow keel. */
export function hull(ridge = 0.12, shoulder = 0.62, keel = 0.45): Profile {
  return [
    [0, 1],
    [0.42, 1 - ridge],
    [0.86, shoulder],
    [1, 0.08],
    [0.9, -0.5],
    [keel, -1],
    [0, -1],
    [-keel, -1],
    [-0.9, -0.5],
    [-1, 0.08],
    [-0.86, shoulder],
    [-0.42, 1 - ridge],
  ];
}

export interface Ring {
  x: number;
  y: number;
  /** half width (z) */
  w: number;
  /** half height (y) */
  h: number;
  z?: number;
  profile?: Profile;
}

/**
 * Loft cross-sections placed along x. Faces are oriented outward automatically, then
 * creased so that panel facets stay flat and their shared edges stay sharp.
 */
export function loftX(
  rings: Ring[],
  profile: Profile,
  opts: { capStart?: boolean; capEnd?: boolean; crease?: number; uvScale?: number } = {},
): BufferGeometry {
  const n = profile.length;
  const pos: number[] = [];
  const uv: number[] = [];
  const uvScale = opts.uvScale ?? 1;

  const ringPts = rings.map((r) => {
    const prof = r.profile ?? profile;
    const pts = prof.map(([u, v]) => new Vector3(r.x, r.y + v * r.h, (r.z ?? 0) + u * r.w));
    // cumulative perimeter for UV u
    const len: number[] = [0];
    for (let j = 1; j <= n; j++) len.push(len[j - 1] + pts[j % n].distanceTo(pts[j - 1]));
    const c = new Vector3(r.x, r.y, r.z ?? 0);
    return { pts, len, c };
  });

  const tri = (a: Vector3, b: Vector3, c: Vector3, ua: number[], ub: number[], uc: number[], center: Vector3) => {
    const ab = new Vector3().subVectors(b, a);
    const ac = new Vector3().subVectors(c, a);
    const nrm = new Vector3().crossVectors(ab, ac);
    const fc = new Vector3().add(a).add(b).add(c).divideScalar(3);
    const out = fc.sub(center);
    if (nrm.dot(out) < 0) {
      pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
      uv.push(ua[0], ua[1], uc[0], uc[1], ub[0], ub[1]);
    } else {
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
    }
  };

  for (let i = 0; i < rings.length - 1; i++) {
    const A = ringPts[i];
    const B = ringPts[i + 1];
    const center = new Vector3().addVectors(A.c, B.c).multiplyScalar(0.5);
    for (let j = 0; j < n; j++) {
      const j1 = (j + 1) % n;
      const a = A.pts[j], b = A.pts[j1], c = B.pts[j1], d = B.pts[j];
      const ua = [A.len[j] * uvScale, rings[i].x * uvScale];
      const ub = [A.len[j + 1] * uvScale, rings[i].x * uvScale];
      const uc = [B.len[j + 1] * uvScale, rings[i + 1].x * uvScale];
      const ud = [B.len[j] * uvScale, rings[i + 1].x * uvScale];
      tri(a, b, c, ua, ub, uc, center);
      tri(a, c, d, ua, uc, ud, center);
    }
  }

  const cap = (k: number, dir: number) => {
    const R = ringPts[k];
    const inside = R.c.clone().add(new Vector3(-dir, 0, 0)); // a point inside the volume
    for (let j = 0; j < n; j++) {
      const j1 = (j + 1) % n;
      const a = R.c, b = R.pts[j], c = R.pts[j1];
      const u0 = [0.5, 0.5];
      tri(a, b, c, u0, [b.z * uvScale, b.y * uvScale], [c.z * uvScale, c.y * uvScale], inside);
    }
  };
  if (opts.capStart) cap(0, -1);
  if (opts.capEnd) cap(rings.length - 1, 1);

  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  creaseNormals(g, opts.crease ?? 28);
  return g;
}

/**
 * Sweep a profile along a path. Profile u maps to the lateral axis, v to the in-plane
 * normal. `sizes(t)` gives half extents along the path (t 0..1).
 */
export function sweep(
  points: Vector3[],
  profile: Profile,
  sizes: (t: number) => [number, number],
  opts: { ref?: Vector3; capStart?: boolean; capEnd?: boolean; crease?: number; samples?: number; closed?: boolean } = {},
): BufferGeometry {
  const curve = new CatmullRomCurve3(points, false, "centripetal");
  const samples = opts.samples ?? Math.max(8, points.length * 6);
  const ref = opts.ref ?? new Vector3(0, 0, 1);
  const n = profile.length;
  const rings: { pts: Vector3[]; c: Vector3; t: number }[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = curve.getPointAt(t);
    const T = curve.getTangentAt(t).normalize();
    const N = new Vector3().crossVectors(ref, T).normalize();
    const U = new Vector3().crossVectors(T, N).normalize();
    const [w, h] = sizes(t);
    rings.push({
      c: p,
      t,
      pts: profile.map(([u, v]) => p.clone().addScaledVector(U, u * w).addScaledVector(N, v * h)),
    });
  }
  const pos: number[] = [];
  const uv: number[] = [];
  const push = (a: Vector3, b: Vector3, c: Vector3, center: Vector3, uvs: number[]) => {
    const nrm = new Vector3().crossVectors(new Vector3().subVectors(b, a), new Vector3().subVectors(c, a));
    const fc = new Vector3().add(a).add(b).add(c).divideScalar(3).sub(center);
    if (nrm.dot(fc) < 0) {
      pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
      uv.push(uvs[0], uvs[1], uvs[4], uvs[5], uvs[2], uvs[3]);
    } else {
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      uv.push(...uvs);
    }
  };
  const L = curve.getLength();
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i], B = rings[i + 1];
    const center = new Vector3().addVectors(A.c, B.c).multiplyScalar(0.5);
    for (let j = 0; j < n; j++) {
      const j1 = (j + 1) % n;
      const u0 = j / n, u1 = (j + 1) / n;
      const v0 = A.t * L, v1 = B.t * L;
      push(A.pts[j], A.pts[j1], B.pts[j1], center, [u0, v0, u1, v0, u1, v1]);
      push(A.pts[j], B.pts[j1], B.pts[j], center, [u0, v0, u1, v1, u0, v1]);
    }
  }
  const capAt = (R: (typeof rings)[number], inside: Vector3) => {
    for (let j = 0; j < n; j++) {
      const j1 = (j + 1) % n;
      push(R.c, R.pts[j], R.pts[j1], inside, [0.5, 0.5, 0, 0, 1, 0]);
    }
  };
  if (opts.capStart) capAt(rings[0], rings[1].c);
  if (opts.capEnd) capAt(rings[rings.length - 1], rings[rings.length - 2].c);
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  creaseNormals(g, opts.crease ?? 35);
  return g;
}

/** Extrude a 2D outline (xy) by depth along z, centred on z=0, with a small chamfer. */
export function plate(
  outline: [number, number][],
  depth: number,
  opts: { holes?: [number, number][][]; bevel?: number; curveSegments?: number } = {},
): BufferGeometry {
  const s = new Shape(outline.map(([x, y]) => new Vector2(x, y)));
  for (const h of opts.holes ?? []) s.holes.push(new Path(h.map(([x, y]) => new Vector2(x, y))));
  const bevel = opts.bevel ?? Math.min(0.003, depth * 0.3);
  const g = new ExtrudeGeometry(s, {
    depth: Math.max(0.0005, depth - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: opts.curveSegments ?? 12,
  });
  g.translate(0, 0, -depth / 2 + bevel);
  return toPlain(g);
}

/** Extrude an arbitrary Shape (for circles with holes etc.). */
export function extrudeShape(shape: Shape, depth: number, bevel = 0.0015, curveSegments = 48): BufferGeometry {
  const g = new ExtrudeGeometry(shape, {
    depth: Math.max(0.0005, depth - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments,
  });
  g.translate(0, 0, -depth / 2 + bevel);
  return toPlain(g);
}

/** Revolve (radius, axial) points around the z axis (wheel axle direction). */
export function latheZ(pts: [number, number][], segments = 72, crease = 40): BufferGeometry {
  const g = new LatheGeometry(pts.map(([r, y]) => new Vector2(r, y)), segments);
  g.rotateX(Math.PI / 2);
  const p = toPlain(g);
  creaseNormals(p, crease);
  return p;
}

/** Revolve around y (for upright cylinders such as fork tubes before orientation). */
export function latheY(pts: [number, number][], segments = 32, crease = 40): BufferGeometry {
  const g = new LatheGeometry(pts.map(([r, y]) => new Vector2(r, y)), segments);
  const p = toPlain(g);
  creaseNormals(p, crease);
  return p;
}

export function tube(points: Vector3[], radius: number, segments = 64, radial = 14): BufferGeometry {
  const curve = new CatmullRomCurve3(points, false, "centripetal");
  return toPlain(new TubeGeometry(curve, segments, radius, radial, false));
}

/** Rounded-edge box built from a chamfered octagon loft (keeps the faceted language). */
export function block(w: number, h: number, d: number, chamfer = 0.25): BufferGeometry {
  return loftX(
    [
      { x: -w / 2, y: 0, w: d / 2, h: h / 2 },
      { x: w / 2, y: 0, w: d / 2, h: h / 2 },
    ],
    octa(chamfer),
    { capStart: true, capEnd: true, crease: 20 },
  );
}

/** Cylinder along an arbitrary axis between two points. */
export function rod(a: Vector3, b: Vector3, r0: number, r1 = r0, radial = 20): BufferGeometry {
  const len = a.distanceTo(b);
  const g = latheY(
    [
      [0, 0],
      [r0, 0],
      [r1, len],
      [0, len],
    ],
    radial,
  );
  orientY(g, a, b);
  return g;
}

/** Move a +y aligned geometry so it spans a -> b. */
export function orientY(g: BufferGeometry, a: Vector3, b: Vector3) {
  const dir = new Vector3().subVectors(b, a).normalize();
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir);
  g.applyMatrix4(new Matrix4().makeRotationFromQuaternion(q));
  g.translate(a.x, a.y, a.z);
  return g;
}

export function xform(
  g: BufferGeometry,
  t: { p?: [number, number, number]; r?: [number, number, number]; s?: [number, number, number] },
) {
  const m = new Matrix4().compose(
    new Vector3(...(t.p ?? [0, 0, 0])),
    new Quaternion().setFromEuler(new Euler(...(t.r ?? [0, 0, 0]))),
    new Vector3(...(t.s ?? [1, 1, 1])),
  );
  g.applyMatrix4(m);
  return g;
}

export function mirrorZ(g: BufferGeometry): BufferGeometry {
  const m = g.clone();
  m.applyMatrix4(new Matrix4().makeScale(1, 1, -1));
  // flip winding so faces still point outward
  const p = m.getAttribute("position") as BufferAttribute;
  const nrm = m.getAttribute("normal") as BufferAttribute | undefined;
  const uv = m.getAttribute("uv") as BufferAttribute | undefined;
  for (let i = 0; i < p.count; i += 3) {
    swap(p, i + 1, i + 2);
    if (nrm) swap(nrm, i + 1, i + 2);
    if (uv) swap(uv, i + 1, i + 2);
  }
  return m;
}

function swap(a: BufferAttribute, i: number, j: number) {
  for (let k = 0; k < a.itemSize; k++) {
    const t = a.array[i * a.itemSize + k];
    a.array[i * a.itemSize + k] = a.array[j * a.itemSize + k];
    a.array[j * a.itemSize + k] = t;
  }
}

/** Non-indexed, position/normal/uv only: every piece merges cleanly. */
export function toPlain(g: BufferGeometry): BufferGeometry {
  const ni = g.index ? g.toNonIndexed() : g;
  const out = new BufferGeometry();
  out.setAttribute("position", ni.getAttribute("position"));
  if (ni.getAttribute("normal")) out.setAttribute("normal", ni.getAttribute("normal"));
  else out.computeVertexNormals();
  if (ni.getAttribute("uv")) out.setAttribute("uv", ni.getAttribute("uv"));
  else out.setAttribute("uv", new Float32BufferAttribute(new Float32Array(ni.getAttribute("position").count * 2), 2));
  if (ni !== g) ni.dispose();
  g.dispose();
  return out;
}

/**
 * Crease-angle normals for non-indexed triangle soup. Vertices are welded at 0.01 mm
 * (three's helper welds at 1 cm, far too coarse for millimetre parts in meter units).
 */
export function creaseNormals(g: BufferGeometry, angleDeg: number) {
  const pos = g.getAttribute("position").array as ArrayLike<number>;
  const count = pos.length / 3;
  const faces = count / 3;
  const fn = new Float32Array(faces * 3);
  for (let f = 0; f < faces; f++) {
    const i = f * 9;
    const ax = pos[i], ay = pos[i + 1], az = pos[i + 2];
    const bx = pos[i + 3], by = pos[i + 4], bz = pos[i + 5];
    const cx = pos[i + 6], cy = pos[i + 7], cz = pos[i + 8];
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    fn[f * 3] = nx; fn[f * 3 + 1] = ny; fn[f * 3 + 2] = nz;
  }
  const key = (i: number) =>
    `${Math.round(pos[i * 3] * 1e5)},${Math.round(pos[i * 3 + 1] * 1e5)},${Math.round(pos[i * 3 + 2] * 1e5)}`;
  const groups = new Map<string, number[]>();
  for (let i = 0; i < count; i++) {
    const k = key(i);
    let arr = groups.get(k);
    if (!arr) groups.set(k, (arr = []));
    arr.push(i);
  }
  const cosA = Math.cos((angleDeg * Math.PI) / 180);
  const out = new Float32Array(count * 3);
  for (const verts of groups.values()) {
    for (const i of verts) {
      const f = (i / 3) | 0;
      const fx = fn[f * 3], fy = fn[f * 3 + 1], fz = fn[f * 3 + 2];
      let sx = 0, sy = 0, sz = 0;
      for (const j of verts) {
        const g2 = (j / 3) | 0;
        const gx = fn[g2 * 3], gy = fn[g2 * 3 + 1], gz = fn[g2 * 3 + 2];
        if (fx * gx + fy * gy + fz * gz >= cosA) {
          sx += gx; sy += gy; sz += gz;
        }
      }
      const l = Math.hypot(sx, sy, sz) || 1;
      out[i * 3] = sx / l; out[i * 3 + 1] = sy / l; out[i * 3 + 2] = sz / l;
    }
  }
  g.setAttribute("normal", new Float32BufferAttribute(out, 3));
  return g;
}

export const V = (x: number, y: number, z = 0) => new Vector3(x, y, z);
export const deg = (d: number) => (d * Math.PI) / 180;

/** Regular polygon outline helper (for hex silencers, bolt heads). */
export function ngon(n: number, r: number, rot = 0, cx = 0, cy = 0): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

export function circlePath(r: number, cx = 0, cy = 0, seg = 32, reverse = false): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2 * (reverse ? -1 : 1);
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

/** Uniform vertex colour, used by titanium parts (their heat tint lives in vertex colours). */
export function tint(g: BufferGeometry, rgb: [number, number, number] = [0.46, 0.44, 0.42]): BufferGeometry {
  const n = g.getAttribute("position").count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set(rgb, i * 3);
  g.setAttribute("color", new Float32BufferAttribute(c, 3));
  return g;
}
