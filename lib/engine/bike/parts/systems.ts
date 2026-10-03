import { CatmullRomCurve3, Matrix4, Vector3, TubeGeometry } from "three";
import type { Builder } from "../builder";
import { D } from "./dims";
import { block, loftX, octa, plate, rod, sweep, hull, tube, V, toPlain, deg } from "../geometry";

// Swingarm, rear suspension, intake, fuel cell and electronics.

export const DASH = {
  center: V(0.392, 1.004, 0),
  /** screen half extents: lateral, up */
  hw: 0.084,
  hh: 0.038,
};

/** basis of the TFT: x lateral, y screen-up, z facing the rider */
export function dashBasis() {
  const n = V(-0.645, 0.345, 0).normalize();
  const up = V(-n.y, n.x, 0).multiplyScalar(-1); // perpendicular in the xy plane, pointing forward-up
  if (up.y < 0) up.multiplyScalar(-1);
  return new Matrix4().makeBasis(V(0, 0, 1), up, n);
}

export function buildSwingarm(b: Builder) {
  b.node("swingarm", "swingarm", { pivot: D.pivot, explode: V(-0.46, -0.06, -0.14), delay: 0.5, unbolt: V(0, 0, -0.03) });
  const path = [
    V(-0.13, 0.44, -0.098),
    V(-0.3, 0.372, -0.112),
    V(-0.52, 0.332, -0.126),
    V(-0.668, 0.316, -0.13),
    V(-0.714, 0.315, -0.13),
  ];
  b.add(
    "aluDark",
    sweep(path, octa(0.34), (t) => [0.034, 0.088 - t * 0.036], { capStart: true, capEnd: true, crease: 30, samples: 36 }),
  );
  // lightening cut panel (machined face) on the arm's outer side
  const face = plate(
    [
      [-0.2, 0.39],
      [-0.48, 0.345],
      [-0.47, 0.37],
      [-0.21, 0.42],
    ],
    0.004,
    { bevel: 0.001 },
  );
  face.translate(0, 0, -0.149);
  b.add("alu", face);
  b.add("alu", rod(V(D.pivot.x, D.pivot.y, -0.14), V(D.pivot.x, D.pivot.y, 0.14), 0.034, 0.034, 20));
  // chain run between the 16T front and 41T rear sprockets (left side)
  const f = V(0.005, 0.36, -0.112);
  const r = D.rearAxle.clone().setZ(-0.112);
  const rf = 0.042, rr = 0.108;
  const chain: Vector3[] = [];
  const dist = Math.hypot(f.x - r.x, f.y - r.y);
  const beta = Math.atan2(f.y - r.y, f.x - r.x); // rear -> front
  const psi = Math.acos((rr - rf) / dist);
  // long wrap around the rear sprocket, away from the front one
  for (let i = 0; i <= 24; i++) {
    const a = beta + psi + ((Math.PI * 2 - 2 * psi) * i) / 24;
    chain.push(V(r.x + Math.cos(a) * rr, r.y + Math.sin(a) * rr, -0.112));
  }
  // short wrap around the front sprocket
  for (let i = 1; i < 12; i++) {
    const a = beta - psi + (2 * psi * i) / 12;
    chain.push(V(f.x + Math.cos(a) * rf, f.y + Math.sin(a) * rf, -0.112));
  }
  const curve = new CatmullRomCurve3(chain, true, "centripetal");
  b.add("black", toPlain(new TubeGeometry(curve, 160, 0.0055, 6, true)));
  // rear caliper on its hanger
  const ang = deg(300);
  const cc = V(D.rearAxle.x + Math.cos(ang) * 0.088, D.rearAxle.y + Math.sin(ang) * 0.088, -0.093);
  const cal = block(0.07, 0.036, 0.034, 0.3);
  cal.rotateZ(ang + Math.PI / 2);
  cal.translate(cc.x, cc.y, cc.z);
  b.add("magnesium", cal);
  b.anchor("swingarm.arm", V(-0.42, 0.36, -0.15));
}

export function buildRearSuspension(b: Builder) {
  b.node("shock", "rearSusp", { explode: V(-0.2, 0.44, 0), delay: 0.32, unbolt: V(0, 0.03, 0) });
  const top = V(-0.135, 0.63, 0);
  const bot = V(-0.2, 0.37, 0);
  const dir = bot.clone().sub(top).normalize();
  const mid = top.clone().addScaledVector(dir, 0.17);
  b.add("aluDark", rod(top, mid, 0.023, 0.023, 20));
  b.add("dlc", rod(mid, bot, 0.008, 0.008, 12));
  b.add("alu", rod(top.clone().addScaledVector(dir, -0.012), top.clone().addScaledVector(dir, 0.012), 0.016, 0.016, 12));
  // spring helix around the body
  const side = V(0, 0, 1);
  const perp = new Vector3().crossVectors(dir, side).normalize();
  const helix: Vector3[] = [];
  const turns = 6.5;
  for (let i = 0; i <= 140; i++) {
    const t = i / 140;
    const a = t * turns * Math.PI * 2;
    const p = top.clone().addScaledVector(dir, 0.04 + t * 0.19);
    p.addScaledVector(perp, Math.cos(a) * 0.031).addScaledVector(side, Math.sin(a) * 0.031);
    helix.push(p);
  }
  b.add("dlc", tube(helix, 0.0058, 420, 8));
  // remote reservoir
  b.add("aluDark", rod(V(-0.11, 0.6, 0.05), V(-0.13, 0.5, 0.05), 0.014, 0.014, 14));
  // linkage rocker
  const link = plate(
    [
      [-0.24, 0.35],
      [-0.17, 0.33],
      [-0.15, 0.37],
      [-0.21, 0.395],
    ],
    0.03,
  );
  b.add("alu", link);
  b.anchor("rearSusp.shock", V(-0.17, 0.5, 0.05));
}

export function buildIntake(b: Builder) {
  b.node("intake", "intake", { explode: V(0.12, 0.6, 0), delay: 0.2 });
  // ram-air ducts split around the steering head
  for (const s of [-1, 1]) {
    const path = [V(0.93, 0.787, s * 0.012), V(0.8, 0.79, s * 0.05), V(0.6, 0.8, s * 0.064), V(0.45, 0.79, s * 0.066), V(0.33, 0.73, s * 0.06), V(0.24, 0.685, s * 0.05)];
    b.add("black", sweep(path, hull(0.1, 0.5, 0.7), (t) => [0.028 + t * 0.012, 0.024 + t * 0.012], { capStart: true, capEnd: true, samples: 30 }));
  }
  b.add(
    "carbon",
    loftX(
      [
        { x: -0.02, y: 0.662, w: 0.1, h: 0.04 },
        { x: 0.12, y: 0.67, w: 0.115, h: 0.046 },
        { x: 0.27, y: 0.68, w: 0.1, h: 0.04 },
      ],
      octa(0.4),
      { capStart: true, capEnd: true },
    ),
  );
  for (const x of [0.02, 0.13]) {
    for (const z of [-0.07, 0.07]) {
      b.add("alu", rod(V(x, 0.575, z), V(x, 0.63, z), 0.019, 0.025, 18));
    }
  }
  b.anchor("intake.airbox", V(0.12, 0.7, 0.13));
}

export function buildFuel(b: Builder) {
  b.node("fuel", "fuel", { explode: V(-0.22, 0.64, 0), delay: 0.24 });
  b.add(
    "aluDark",
    loftX(
      [
        { x: -0.42, y: 0.765, w: 0.095, h: 0.04 },
        { x: -0.33, y: 0.762, w: 0.115, h: 0.05 },
        { x: -0.21, y: 0.755, w: 0.11, h: 0.048 },
        { x: -0.17, y: 0.748, w: 0.085, h: 0.036 },
      ],
      octa(0.36),
      { capStart: true, capEnd: true, crease: 26 },
    ),
  );
  b.add("alu", rod(V(-0.3, 0.79, 0), V(-0.3, 0.806, 0), 0.026, 0.026, 20));
  b.anchor("fuel.cell", V(-0.3, 0.72, 0.13));
}

export function buildElectronics(b: Builder) {
  b.node("electronics", "electronics", { explode: V(0.12, 0.86, 0), delay: 0.16 });
  const m = dashBasis();
  // TFT housing
  const housing = block(0.02, 0.092, 0.188, 0.3);
  housing.rotateY(Math.PI / 2); // x(length) -> z thickness
  const hz = housing.applyMatrix4(m);
  const c = DASH.center;
  const back = new Vector3(0, 0, -0.012).applyMatrix4(new Matrix4().extractRotation(m));
  hz.translate(c.x + back.x, c.y + back.y, c.z + back.z);
  b.add("black", hz);
  // screen face (the DOM dash is mapped onto these four corners)
  const face = plate(
    [
      [-DASH.hw, -DASH.hh],
      [DASH.hw, -DASH.hh],
      [DASH.hw, DASH.hh],
      [-DASH.hw, DASH.hh],
    ],
    0.002,
    { bevel: 0 },
  );
  face.applyMatrix4(m);
  face.translate(c.x, c.y, c.z);
  b.add("screen", face);
  const corners: [string, number, number][] = [
    ["dash.tl", -1, 1],
    ["dash.tr", 1, 1],
    ["dash.br", 1, -1],
    ["dash.bl", -1, -1],
  ];
  for (const [name, u, v] of corners) {
    // lateral u maps to world z; from the rider's seat, +z (right) is screen-right
    const p = new Vector3(u * DASH.hw, v * DASH.hh, 0.0012).applyMatrix4(m).add(c);
    b.anchor(name, p);
  }
  // battery, ECU, IMU
  const batt = block(0.12, 0.072, 0.085, 0.25);
  batt.translate(0.25, 0.655, 0);
  b.add("aluDark", batt);
  const ecu = block(0.1, 0.028, 0.075, 0.3);
  ecu.translate(-0.58, 0.8, 0);
  b.add("aluDark", ecu);
  const imu = block(0.04, 0.02, 0.04, 0.3);
  imu.translate(-0.08, 0.63, 0);
  b.add("alu", imu);
  b.add("black", tube([V(0.43, 0.985, 0.0), V(0.47, 0.9, 0.08), V(0.36, 0.8, 0.12), V(0.12, 0.79, 0.11), V(-0.25, 0.8, 0.08), V(-0.55, 0.8, 0.03)], 0.006, 80, 6));
  b.anchor("electronics.battery", V(0.25, 0.66, 0.06));
  b.anchor("electronics.dash", c.clone());
}

