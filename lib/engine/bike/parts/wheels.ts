import { Shape, Path, BufferGeometry } from "three";
import type { Builder } from "../builder";
import { D } from "./dims";
import { latheZ, plate, extrudeShape, rod, ngon, V, tint } from "../geometry";

// Forged magnesium wheels: 7 split spokes, slicks, floating discs on the front.

function tireProfile(halfW: number, outerR: number): [number, number][] {
  const rr = D.rimR;
  const s = outerR - rr; // section height
  return [
    [rr + 0.004, -halfW * 0.74],
    [rr + s * 0.2, -halfW * 0.92],
    [rr + s * 0.45, -halfW],
    [rr + s * 0.7, -halfW * 0.96],
    [outerR - s * 0.18, -halfW * 0.82],
    [outerR - s * 0.07, -halfW * 0.6],
    [outerR - s * 0.015, -halfW * 0.32],
    [outerR, 0],
    [outerR - s * 0.015, halfW * 0.32],
    [outerR - s * 0.07, halfW * 0.6],
    [outerR - s * 0.18, halfW * 0.82],
    [rr + s * 0.7, halfW * 0.96],
    [rr + s * 0.45, halfW],
    [rr + s * 0.2, halfW * 0.92],
    [rr + 0.004, halfW * 0.74],
  ];
}

function rimProfile(halfW: number): [number, number][] {
  const r = D.rimR;
  return [
    [r - 0.016, -halfW + 0.004],
    [r - 0.002, -halfW],
    [r + 0.007, -halfW],
    [r + 0.007, -halfW + 0.005],
    [r - 0.003, -halfW + 0.008],
    [r - 0.012, -halfW * 0.55],
    [r - 0.02, -halfW * 0.18],
    [r - 0.02, halfW * 0.18],
    [r - 0.012, halfW * 0.55],
    [r - 0.003, halfW - 0.008],
    [r + 0.007, halfW - 0.005],
    [r + 0.007, halfW],
    [r - 0.002, halfW],
    [r - 0.016, halfW - 0.004],
    [r - 0.026, halfW * 0.5],
    [r - 0.03, 0],
    [r - 0.026, -halfW * 0.5],
    [r - 0.016, -halfW + 0.004],
  ];
}

/** one Y spoke (stem + two prongs) in the wheel plane, extruded along z */
function spoke(theta: number, depth: number): BufferGeometry[] {
  const P = (r: number, a: number): [number, number] => [Math.cos(a) * r, Math.sin(a) * r];
  const rimIn = D.rimR - 0.024;
  const out: BufferGeometry[] = [];
  // stem
  const stem: [number, number][] = [
    P(0.05, theta - 0.2),
    P(0.128, theta - 0.07),
    P(0.128, theta + 0.07),
    P(0.05, theta + 0.2),
  ];
  out.push(plate(stem, depth, { bevel: 0.003 }));
  for (const side of [-1, 1]) {
    const tip = theta + side * 0.13;
    const prong: [number, number][] = [
      P(0.112, theta + side * 0.012 - 0.03),
      P(rimIn, tip - 0.033),
      P(rimIn, tip + 0.033),
      P(0.112, theta + side * 0.012 + 0.03),
    ];
    out.push(plate(prong, depth * 0.82, { bevel: 0.0025 }));
  }
  return out;
}

function discShape(rOut: number, rIn: number, holes: number): Shape {
  const s = new Shape();
  s.absarc(0, 0, rOut, 0, Math.PI * 2, false);
  const inner = new Path();
  inner.absarc(0, 0, rIn, 0, Math.PI * 2, true);
  s.holes.push(inner);
  // cross-drilling: three staggered rows
  for (let i = 0; i < holes; i++) {
    const row = i % 3;
    const a = (i / holes) * Math.PI * 2;
    const r = rIn + (rOut - rIn) * (0.28 + row * 0.22);
    const h = new Path();
    h.absarc(Math.cos(a) * r, Math.sin(a) * r, 0.0028, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  return s;
}

function carrierShape(rOut: number, arms: number): Shape {
  // spider carrier: hub ring with arms out to the floating buttons
  const s = new Shape();
  const pts: [number, number][] = [];
  const steps = arms * 8;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const k = (i % 8) / 8;
    const arm = k < 0.3 || k > 0.92;
    const r = arm ? rOut : rOut * 0.62;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  s.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) s.lineTo(p[0], p[1]);
  s.closePath();
  const hub = new Path();
  hub.absarc(0, 0, 0.034, 0, Math.PI * 2, true);
  s.holes.push(hub);
  return s;
}

export function buildWheels(b: Builder) {
  // ---------- FRONT ----------
  {
    const c = D.frontAxle;
    b.node("wheelF", "wheels", { pivot: c, explode: V(0.95, -0.02, 0.0), delay: 0.42, unbolt: V(0, 0, 0.06) });
    const at = (g: BufferGeometry) => g.translate(c.x, c.y, c.z);
    b.add("rubber", at(latheZ(tireProfile(0.06, D.frontR), 96, 50)));
    b.add("magnesium", at(latheZ(rimProfile(0.046), 96, 35)));
    for (let i = 0; i < 7; i++) b.add("magnesium", ...spoke((i / 7) * Math.PI * 2 + 0.2, 0.02).map(at));
    b.add(
      "alu",
      at(
        latheZ(
          [
            [0.0, -0.062],
            [0.036, -0.062],
            [0.052, -0.04],
            [0.056, 0.04],
            [0.036, 0.062],
            [0.0, 0.062],
          ],
          40,
        ),
      ),
    );
    // floating discs both sides with carriers and buttons
    for (const z of [-0.072, 0.072]) {
      const disc = extrudeShape(discShape(0.165, 0.121, 54), 0.0055, 0.0006, 96);
      b.add("steel", at(disc.translate(0, 0, z)));
      const car = extrudeShape(carrierShape(0.124, 6), 0.007, 0.001, 48);
      b.add("aluDark", at(car.translate(0, 0, z - Math.sign(z) * 0.006)));
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        const p = V(Math.cos(a) * 0.123, Math.sin(a) * 0.123, z);
        b.add("alu", at(rod(p.clone().setZ(z - 0.006), p.clone().setZ(z + 0.006), 0.0055, 0.0055, 10)));
      }
    }
    for (const z of [-0.03, 0.03]) {
      const disc = latheZ([[0.045, 0], [D.rimR - 0.026, 0]], 64);
      b.dyn(`blurF${z > 0 ? "R" : "L"}`, "spokeBlur", disc.translate(0, 0, z));
    }
    b.anchor("wheels.front", V(c.x, c.y + 0.24, 0.06));
    b.anchor("axle.front", c.clone());
    b.anchor("ground.front", V(c.x, 0, 0));
  }

  // ---------- REAR ----------
  {
    const c = D.rearAxle;
    b.node("wheelR", "wheels", { pivot: c, explode: V(-0.9, -0.02, 0.0), delay: 0.46, unbolt: V(0, 0, 0.08) });
    const at = (g: BufferGeometry) => g.translate(c.x, c.y, c.z);
    b.add("rubber", at(latheZ(tireProfile(0.1, D.rearR), 96, 50)));
    b.add("magnesium", at(latheZ(rimProfile(0.077), 96, 35)));
    // spokes are dished toward the hub side (left) for the single-sided arm
    for (let i = 0; i < 7; i++)
      b.add("magnesium", ...spoke((i / 7) * Math.PI * 2 + 0.6, 0.026).map((g) => at(g.translate(0, 0, -0.012))));
    // right side: centre-lock nut, visible in the side profile
    b.add(
      "alu",
      at(
        latheZ(
          [
            [0.0, 0.0],
            [0.05, 0.0],
            [0.056, 0.03],
            [0.046, 0.046],
            [0.0, 0.05],
          ],
          48,
        ),
      ),
    );
    const nut = plate(ngon(6, 0.034, Math.PI / 6), 0.02, { bevel: 0.002 });
    b.add("titanium", at(tint(nut.translate(0, 0, 0.056), [0.46, 0.44, 0.42])));
    // left side hub drum and sprocket
    b.add(
      "aluDark",
      at(
        latheZ(
          [
            [0.0, -0.13],
            [0.07, -0.13],
            [0.075, -0.06],
            [0.05, -0.04],
            [0.0, -0.04],
          ],
          48,
        ),
      ),
    );
    const sprocket = new Shape();
    const teeth = 41;
    for (let i = 0; i <= teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? 0.112 : 0.104;
      if (i === 0) sprocket.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else sprocket.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const h = new Path();
      h.absarc(Math.cos(a) * 0.074, Math.sin(a) * 0.074, 0.018, 0, Math.PI * 2, true);
      sprocket.holes.push(h);
    }
    const hub = new Path();
    hub.absarc(0, 0, 0.042, 0, Math.PI * 2, true);
    sprocket.holes.push(hub);
    b.add("alu", at(extrudeShape(sprocket, 0.006, 0.0008, 6).translate(0, 0, -0.112)));
    // rear disc, left
    b.add("steel", at(extrudeShape(discShape(0.11, 0.078, 30), 0.005, 0.0006, 72).translate(0, 0, -0.088)));
    for (const z of [-0.045, 0.03]) {
      const disc = latheZ([[0.05, 0], [D.rimR - 0.028, 0]], 64);
      b.dyn(`blurR${z > 0 ? "R" : "L"}`, "spokeBlur", disc.translate(0, 0, z));
    }
    b.anchor("wheels.rear", V(c.x + 0.16, c.y + 0.16, 0.05));
    b.anchor("axle.rear", c.clone());
    b.anchor("ground.rear", V(c.x, 0, 0));
  }
}
