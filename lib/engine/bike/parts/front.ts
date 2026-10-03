import { Matrix4, Vector3, BufferGeometry } from "three";
import type { Builder } from "../builder";
import { AXIS, AXIS_N, D, axisPt, legPt } from "./dims";
import { block, plate, rod, sweep, hull, V, tint } from "../geometry";

// Front assembly: USD fork, machined triple clamps, radial monobloc calipers, fender.

/** place geometry authored in a local frame (x = lateral z, y = forward n, z = up the axis) */
function onAxis(g: BufferGeometry, origin: Vector3) {
  const m = new Matrix4().makeBasis(new Vector3(0, 0, 1), AXIS_N, AXIS);
  g.applyMatrix4(m);
  g.translate(origin.x, origin.y, origin.z);
  return g;
}

function clampOutline(halfSpan: number, depth: number): [number, number][] {
  // in local (lateral, forward): wraps both legs and the stem behind them
  const f = 0.035; // forward of leg centres
  const r = -0.03 - depth; // behind the stem
  return [
    [-halfSpan - 0.034, f * 0.4],
    [-halfSpan - 0.02, f],
    [halfSpan + 0.02, f],
    [halfSpan + 0.034, f * 0.4],
    [halfSpan + 0.03, -0.03],
    [0.05, r + 0.012],
    [0.03, r],
    [-0.03, r],
    [-0.05, r + 0.012],
    [-halfSpan - 0.03, -0.03],
  ];
}

export function buildFront(b: Builder) {
  b.node("fork", "front", {
    pivot: axisPt(0.6),
    explode: V(0.55, 0.08, 0),
    delay: 0.36,
    unbolt: V(0, 0.05, 0),
  });

  for (const side of [-1, 1]) {
    const z = side * D.forkZ;
    // inner slider (lower), DLC with machined foot
    b.add("dlc", rod(legPt(0.03, z), legPt(0.36, z), 0.0215, 0.0215, 28));
    // outer tube (upper), larger, black anodised
    b.add("aluDark", rod(legPt(0.3, z), legPt(0.735, z), 0.028, 0.028, 28));
    // dust seal ring
    b.add("rubber", rod(legPt(0.295, z), legPt(0.312, z), 0.0292, 0.0292, 28));
    // top cap with adjusters
    b.add("alu", rod(legPt(0.735, z), legPt(0.752, z), 0.022, 0.018, 18));
    // axle foot
    const foot = block(0.05, 0.11, 0.05, 0.3);
    foot.rotateZ(Math.PI / 2 - (90 - 24.1) * (Math.PI / 180));
    const fp = legPt(0.035, z);
    foot.translate(fp.x - 0.005, fp.y + 0.01, fp.z);
    b.add("alu", foot);

    // radial caliper: behind the leg, straddling the disc
    const ang = (205 * Math.PI) / 180;
    const cr = 0.142;
    const cc = V(D.frontAxle.x + Math.cos(ang) * cr, D.frontAxle.y + Math.sin(ang) * cr, side * 0.077);
    const cal = block(0.112, 0.052, 0.04, 0.32);
    cal.rotateZ(ang + Math.PI / 2);
    cal.translate(cc.x, cc.y, cc.z);
    b.add("magnesium", cal);
    // caliper bridge bolts
    for (const k of [-0.035, 0.035]) {
      const t = V(Math.cos(ang + Math.PI / 2), Math.sin(ang + Math.PI / 2), 0).multiplyScalar(k);
      const p = cc.clone().add(t);
      b.add("titanium", tint(rod(p.clone().setZ(side * 0.06), p.clone().setZ(side * 0.1), 0.004, 0.004, 6)));
    }
    // mount lugs from foot to caliper
    const lug = plate(
      [
        [0, -0.02],
        [0.07, -0.012],
        [0.07, 0.012],
        [0, 0.02],
      ],
      0.012,
    );
    lug.rotateZ(ang);
    lug.translate(legPt(0.05).x, legPt(0.05).y, side * 0.094);
    b.add("alu", lug);
  }

  // triple clamps (machined billet) with the steering stem
  const top = axisPt(0.7);
  const bot = axisPt(0.585);
  const holes = (span: number): [number, number][][] => [
    circle(-span, 0, 0.0282),
    circle(span, 0, 0.0282),
    circle(0, -0.03, 0.018),
  ];
  const topClamp = plate(clampOutline(D.forkZ, 0.012), 0.024, { holes: holes(D.forkZ), bevel: 0.0025 });
  // the clamp outline is authored relative to the leg line, which sits FORK_OFFSET ahead of the axis
  b.add("alu", onAxis(topClamp, top.clone().addScaledVector(AXIS_N, 0.03)));
  const botClamp = plate(clampOutline(D.forkZ, 0.02), 0.04, { holes: holes(D.forkZ), bevel: 0.003 });
  b.add("alu", onAxis(botClamp, bot.clone().addScaledVector(AXIS_N, 0.03)));
  b.add("aluDark", rod(axisPt(0.56), axisPt(0.72), 0.018, 0.018, 16));
  // steering damper body across the top clamp
  b.add("aluDark", rod(axisPt(0.715, -0.08).addScaledVector(AXIS_N, -0.05), axisPt(0.715, 0.08).addScaledVector(AXIS_N, -0.05), 0.011, 0.011, 14));
  b.anchor("front.topclamp", top.clone().addScaledVector(AXIS, 0.014));

  // carbon front fender: a thin swept hull over the tyre
  const pts: Vector3[] = [];
  for (let i = 0; i <= 8; i++) {
    const a = ((20 + i * 15) * Math.PI) / 180;
    pts.push(V(D.frontAxle.x + Math.cos(a) * 0.33, D.frontAxle.y + Math.sin(a) * 0.33, 0));
  }
  b.add(
    "carbon",
    sweep(pts, hull(0.2, 0.3, 0.9), (t) => [0.072 - Math.abs(t - 0.5) * 0.03, 0.012], {
      capStart: true,
      capEnd: true,
      crease: 30,
    }),
  );
}

function circle(cx: number, cy: number, r: number, seg = 28): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < seg; i++) {
    const a = -(i / seg) * Math.PI * 2;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}
