// The whole film as data. Every value the engine animates is a keyframe track over
// t = scene index + local progress (0..10). Evaluation is a pure function of t, so scroll
// is fully reversible; "step" keys are hard cuts and repeated values are holds.

export interface Pose {
  /** look-at target */
  tx: number;
  ty: number;
  tz: number;
  /** azimuth around y: 0 = right side, +PI/2 = head on */
  az: number;
  el: number;
  dist: number;
  fov: number;
  roll: number;
  /** composition shift as a fraction of the frame (subject moves right / up) */
  sx: number;
  sy: number;
  /** subject width in meters that must fit horizontally (portrait safety) */
  fit: number;
}

const P = (p: Partial<Pose>): Pose => ({
  tx: 0,
  ty: 0.55,
  tz: 0,
  az: 0,
  el: 0.05,
  dist: 6,
  fov: 24,
  roll: 0,
  sx: 0,
  sy: 0,
  fit: 0,
  ...p,
});

export const POSES = {
  desktop: {
    hero: P({ tx: 0.08, ty: 0.56, az: 0.66, el: 0.045, dist: 4.5, fov: 27, sx: 0.06, sy: -0.02, roll: -0.012 }),
    side: P({ tx: -0.02, ty: 0.56, az: 0.0, el: 0.012, dist: 10.4, fov: 14.2, sx: 0.1, sy: -0.03, fit: 2.4 }),
    sideSlow: P({ tx: -0.02, ty: 0.56, az: 0.0, el: 0.012, dist: 10.0, fov: 14.2, sx: 0.1, sy: -0.03, fit: 2.4 }),
    aero: P({ tx: 0.05, ty: 0.55, az: 0.0, el: 0.03, dist: 11.2, fov: 14.2, sx: -0.04, sy: -0.06, fit: 2.4 }),
    aeroEnd: P({ tx: 0.05, ty: 0.55, az: 0.035, el: 0.03, dist: 10.6, fov: 14.2, sx: -0.04, sy: -0.06, fit: 2.4 }),
    explodeA: P({ tx: 0.0, ty: 0.78, az: 0.6, el: 0.3, dist: 6.2, fov: 25, sx: 0.05, sy: 0.0, fit: 3.2 }),
    explodeB: P({ tx: 0.02, ty: 0.86, az: 0.82, el: 0.4, dist: 7.4, fov: 25, sx: 0.1, sy: 0.02, fit: 3.9 }),
    engine: P({ tx: 0.08, ty: 0.44, az: 0.34, el: 0.12, dist: 1.32, fov: 24, sx: 0.16, sy: 0.02, fit: 0.8 }),
    engine2: P({ tx: 0.08, ty: 0.44, az: 0.5, el: 0.16, dist: 1.24, fov: 24, sx: 0.16, sy: 0.02, fit: 0.8 }),
    cockpit: P({ tx: 0.392, ty: 1.0, az: -1.52, el: 0.42, dist: 0.36, fov: 38, sx: 0.0, sy: 0.04 }),
    cockpit2: P({ tx: 0.392, ty: 1.0, az: -1.47, el: 0.44, dist: 0.33, fov: 38, sx: 0.0, sy: 0.04 }),
    motion: P({ tx: 0.12, ty: 0.5, az: 0.92, el: -0.015, dist: 4.9, fov: 31, sx: -0.06, sy: -0.02 }),
    motionFast: P({ tx: 0.12, ty: 0.5, az: 0.86, el: -0.02, dist: 8.6, fov: 18.5, sx: -0.06, sy: -0.02 }),
    macro: P({ tx: 0.292, ty: 0.782, tz: 0.17, az: 0.34, el: 0.2, dist: 0.2, fov: 30, sx: 0.16, sy: 0.02, roll: 0.0 }),
    macro2: P({ tx: 0.296, ty: 0.784, tz: 0.17, az: 0.2, el: 0.15, dist: 0.18, fov: 30, sx: 0.16, sy: 0.02 }),
    final: P({ tx: 0.02, ty: 0.56, az: 0.58, el: 0.085, dist: 5.1, fov: 24, sx: 0.1, sy: 0.07, fit: 2.6 }),
  },
  // Portrait is its own choreography: narrower azimuths, stacked compositions, wider lenses
  portrait: {
    hero: P({ tx: 0.18, ty: 0.6, az: 1.08, el: 0.05, dist: 4.4, fov: 38, sx: 0.0, sy: 0.04, roll: -0.01 }),
    side: P({ tx: -0.02, ty: 0.56, az: 0.0, el: 0.01, dist: 9.6, fov: 30, sx: 0.0, sy: -0.11, fit: 2.25 }),
    sideSlow: P({ tx: -0.02, ty: 0.56, az: 0.0, el: 0.01, dist: 9.2, fov: 30, sx: 0.0, sy: -0.11, fit: 2.25 }),
    aero: P({ tx: 0.05, ty: 0.55, az: 0.0, el: 0.03, dist: 9.8, fov: 30, sx: 0.0, sy: -0.05, fit: 2.3 }),
    aeroEnd: P({ tx: 0.05, ty: 0.55, az: 0.03, el: 0.03, dist: 9.6, fov: 30, sx: 0.0, sy: -0.05, fit: 2.3 }),
    explodeA: P({ tx: 0.0, ty: 0.82, az: 1.0, el: 0.34, dist: 6.5, fov: 40, sx: 0.0, sy: 0.04, fit: 2.6 }),
    explodeB: P({ tx: 0.0, ty: 0.88, az: 1.2, el: 0.44, dist: 7.6, fov: 40, sx: 0.0, sy: 0.06, fit: 3.0 }),
    engine: P({ tx: 0.07, ty: 0.44, az: 0.4, el: 0.14, dist: 1.9, fov: 36, sx: 0.0, sy: 0.2, fit: 0.72 }),
    engine2: P({ tx: 0.07, ty: 0.44, az: 0.55, el: 0.18, dist: 1.8, fov: 36, sx: 0.0, sy: 0.2, fit: 0.72 }),
    cockpit: P({ tx: 0.392, ty: 1.0, az: -1.57, el: 0.46, dist: 0.46, fov: 52, sx: 0.0, sy: 0.12 }),
    cockpit2: P({ tx: 0.392, ty: 1.0, az: -1.54, el: 0.48, dist: 0.44, fov: 52, sx: 0.0, sy: 0.12 }),
    motion: P({ tx: 0.2, ty: 0.55, az: 1.16, el: -0.01, dist: 4.4, fov: 40, sx: 0.0, sy: 0.04 }),
    motionFast: P({ tx: 0.2, ty: 0.55, az: 1.1, el: -0.02, dist: 7.6, fov: 26, sx: 0.0, sy: 0.04 }),
    macro: P({ tx: 0.292, ty: 0.782, tz: 0.17, az: 0.34, el: 0.2, dist: 0.26, fov: 40, sx: 0.0, sy: 0.12 }),
    macro2: P({ tx: 0.296, ty: 0.784, tz: 0.17, az: 0.2, el: 0.15, dist: 0.24, fov: 40, sx: 0.0, sy: 0.12 }),
    final: P({ tx: 0.05, ty: 0.58, az: 0.95, el: 0.1, dist: 4.9, fov: 36, sx: 0.0, sy: 0.13, fit: 1.62 }),
  },
};

export type PoseName = keyof typeof POSES.desktop;

type Ease = "linear" | "inOut" | "out" | "in" | "step" | "mech";
type Key<T> = [number, T, Ease?];

const easeFn: Record<Ease, (x: number) => number> = {
  linear: (x) => x,
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  out: (x) => 1 - Math.pow(1 - x, 3),
  in: (x) => x * x * x,
  step: () => 0,
  // long settle, like a motion-control rig easing into a mark
  mech: (x) => (x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2),
};

/** find the segment around t; the ease of a key applies to the segment arriving at it */
function seg<T>(keys: Key<T>[], t: number): [T, T, number] {
  if (t <= keys[0][0]) return [keys[0][1], keys[0][1], 0];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return [last[1], last[1], 0];
  for (let i = 1; i < keys.length; i++) {
    const k1 = keys[i];
    if (t < k1[0]) {
      const k0 = keys[i - 1];
      const ease = k1[2] ?? "inOut";
      if (ease === "step") return [k0[1], k0[1], 0];
      const x = (t - k0[0]) / (k1[0] - k0[0]);
      return [k0[1], k1[1], easeFn[ease](x)];
    }
  }
  return [last[1], last[1], 0];
}

export function num(keys: Key<number>[], t: number) {
  const [a, b, x] = seg(keys, t);
  return a + (b - a) * x;
}

const lerpAngle = (a: number, b: number, x: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * x;
};

export function pose(keys: Key<PoseName>[], t: number, portrait: boolean, out: Pose): Pose {
  const set = portrait ? POSES.portrait : POSES.desktop;
  const [an, bn, x] = seg(keys, t);
  const a = set[an], b = set[bn];
  out.tx = a.tx + (b.tx - a.tx) * x;
  out.ty = a.ty + (b.ty - a.ty) * x;
  out.tz = a.tz + (b.tz - a.tz) * x;
  out.az = lerpAngle(a.az, b.az, x);
  out.el = a.el + (b.el - a.el) * x;
  // distance interpolates geometrically: a dolly feels linear in perceived scale
  out.dist = Math.exp(Math.log(a.dist) + (Math.log(b.dist) - Math.log(a.dist)) * x);
  out.fov = a.fov + (b.fov - a.fov) * x;
  out.roll = a.roll + (b.roll - a.roll) * x;
  out.sx = a.sx + (b.sx - a.sx) * x;
  out.sy = a.sy + (b.sy - a.sy) * x;
  out.fit = a.fit + (b.fit - a.fit) * x;
  return out;
}

// ------------------------------------------------------------------ the film

export const CAMERA: Key<PoseName>[] = [
  [0.0, "hero"],
  [0.32, "hero"],
  [0.96, "side", "mech"],
  [1.92, "sideSlow", "linear"],
  [2.12, "aero"],
  [2.97, "aeroEnd", "linear"],
  [3.0, "explodeA", "step"],
  [3.82, "explodeB", "inOut"],
  [3.9, "explodeB"],
  [4.32, "engine", "mech"],
  [4.95, "engine2", "linear"],
  [5.0, "cockpit", "step"],
  [5.95, "cockpit2", "linear"],
  [7.0, "motion", "step"],
  [7.72, "motionFast", "inOut"],
  [7.98, "motionFast"],
  [8.0, "macro", "step"],
  [8.78, "macro2", "linear"],
  [9.22, "final", "mech"],
];

export const TRACKS = {
  /** composite smoke visibility */
  smoke: [
    [0, 1],
    [0.96, 1],
    [1.0, 0, "linear"],
  ] as Key<number>[],
  /** concealment the field relaxes toward */
  smokeTarget: [
    [0, 1],
    [0.3, 1],
    [0.78, 0],
  ] as Key<number>[],
  /** lateral wind that blows the smoke out of frame */
  wind: [
    [0.26, 0],
    [0.48, 1],
    [0.86, 1.2],
    [0.98, 0],
  ] as Key<number>[],
  exposure: [
    [0, 0.6],
    [0.3, 0.62],
    [0.9, 1.0],
    [1.9, 1.0],
    [2.1, 1.12],
    [2.97, 1.12],
    [3.0, 1.15, "step"],
    [3.9, 1.15],
    [4.3, 1.2],
    [5.0, 0.95, "step"],
    [7.0, 1.0, "step"],
    [8.0, 0.85, "step"],
    [8.84, 0.5],
    [9.0, 0.72, "out"],
    [9.08, 0.92, "out"],
    [9.18, 1.34, "out"],
  ] as Key<number>[],
  clay: [
    [1.88, 0],
    [2.1, 1, "inOut"],
    [2.97, 1],
    [3.0, 0, "step"],
  ] as Key<number>[],
  tunnel: [
    [1.9, 0],
    [2.14, 1],
    [2.97, 1],
    [3.0, 0, "step"],
  ] as Key<number>[],
  aero: [
    [2.08, 0],
    [2.24, 1],
    [2.97, 1],
    [3.0, 0, "step"],
  ] as Key<number>[],
  /** airspeed in km/h; scroll velocity adds on top */
  airspeed: [
    [2.0, 60],
    [2.3, 120],
    [2.9, 270],
  ] as Key<number>[],
  explode: [
    [3.04, 0],
    [3.84, 1, "inOut"],
    [4.98, 1],
    [5.0, 0, "step"],
  ] as Key<number>[],
  dimOthers: [
    [3.88, 0],
    [4.24, 0.95],
    [4.98, 0.95],
    [5.0, 0, "step"],
  ] as Key<number>[],
  cut: [
    [4.06, 0],
    [4.4, 1, "mech"],
    [4.98, 1],
    [5.0, 0, "step"],
  ] as Key<number>[],
  rpm: [
    [4.28, 1400],
    [4.88, 15200, "in"],
    [4.98, 15200],
  ] as Key<number>[],
  bike: [
    [5.98, 1],
    [6.0, 0, "step"],
    [6.98, 0],
    [7.0, 1, "step"],
  ] as Key<number>[],
  speed: [
    [7.0, 0.15],
    [7.2, 0.45],
    [7.72, 1],
    [7.84, 1],
    [7.98, 0.1, "out"],
  ] as Key<number>[],
  road: [
    [6.98, 0],
    [7.0, 1, "step"],
    [7.96, 1],
    [7.98, 0, "step"],
  ] as Key<number>[],
  /** studio lights switching on, 0..1 */
  lights: [
    [8.84, 0],
    [8.99, 0],
    [9.0, 0.34, "step"],
    [9.07, 0.34],
    [9.08, 0.68, "step"],
    [9.15, 0.68],
    [9.16, 1, "step"],
  ] as Key<number>[],
  /** scroll-driven approach to a dissolve; the engine adds a timed fade-up after the cut */
  fade: [
    [4.84, 0],
    [4.995, 0.94, "in"],
    [5.0, 0, "step"],
    [7.82, 0],
    [7.995, 0.94, "in"],
    [8.0, 0, "step"],
  ] as Key<number>[],
  vignette: [
    [0, 0.85],
    [1, 0.55],
    [2, 0.35],
    [3, 0.6],
    [8, 0.9],
    [9, 0.5],
  ] as Key<number>[],
  floor: [
    [0, 0.6],
    [1, 0.9],
    [9, 0.9],
    [9.2, 1.2],
  ] as Key<number>[],
};

/** scene boundaries that cut the camera, and how the cut is dressed */
export const CUTS: { t: number; kind: "flash" | "dip" | "none" }[] = [
  { t: 3.0, kind: "flash" },
  { t: 5.0, kind: "dip" },
  { t: 6.0, kind: "flash" },
  { t: 7.0, kind: "none" },
  { t: 8.0, kind: "dip" },
];
