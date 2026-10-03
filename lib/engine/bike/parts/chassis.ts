import { PlaneGeometry } from "three";
import type { Builder } from "../builder";
import { D, axisPt, legPt } from "./dims";
import { loftX, octa, plate, rod, sweep, mirrorZ, block, V, toPlain, tint } from "../geometry";

// Carbon monocoque: twin swept spars from the headstock to the swingarm pivot, a core
// that doubles as the airbox, a carbon subframe and machined rearsets.

export function buildChassis(b: Builder) {
  b.node("frame", "chassis", { explode: V(0, 0.04, 0), delay: 0.6 });

  const spar = [V(0.43, 0.835), V(0.3, 0.785), V(0.13, 0.705), V(-0.03, 0.6), V(-0.115, 0.51), V(-0.135, 0.44)];
  for (const s of [1, -1]) {
    const pts = spar.map((p) => p.clone().setZ(s * 0.15));
    b.add(
      "carbon",
      sweep(pts, octa(0.32), (t) => [0.018, t < 0.6 ? 0.062 - t * 0.024 : 0.048 + (t - 0.6) * 0.03], {
        capStart: true,
        capEnd: true,
        crease: 30,
        samples: 40,
      }),
    );
    // machined pivot plates
    const pp = plate(
      [
        [-0.185, 0.405],
        [-0.085, 0.4],
        [-0.06, 0.505],
        [-0.15, 0.52],
      ],
      0.012,
      { holes: [circle(-0.13, 0.44, 0.016)], bevel: 0.002 },
    );
    pp.translate(0, 0, s * 0.158);
    b.add("aluDark", pp);
  }
  // headstock core: wraps the steering head, doubles as the airbox
  b.add("carbon", loftX(
    [
      { x: 0.35, y: 0.82, w: 0.15, h: 0.06 },
      { x: 0.47, y: 0.835, w: 0.12, h: 0.07 },
    ],
    octa(0.35),
    { capStart: true, capEnd: true },
  ));
  b.add("carbon", loftX(
    [
      { x: 0.03, y: 0.768, w: 0.13, h: 0.045 },
      { x: 0.2, y: 0.778, w: 0.15, h: 0.05 },
      { x: 0.35, y: 0.8, w: 0.15, h: 0.05 },
    ],
    octa(0.4),
    { capStart: true, capEnd: true },
  ));
  b.add("aluDark", rod(axisPt(0.555), axisPt(0.7), 0.043, 0.043, 6));
  b.add("alu", rod(V(D.pivot.x, D.pivot.y, -0.175), V(D.pivot.x, D.pivot.y, 0.175), 0.012, 0.012, 12));
  b.anchor("chassis.spar", V(0.12, 0.69, 0.17));

  // ---------- carbon subframe ----------
  b.node("subframe", "chassis", { explode: V(-0.16, 0.22, 0), delay: 0.3 });
  for (const s of [1, -1]) {
    const upper = [V(-0.06, 0.63, s * 0.12), V(-0.3, 0.745, s * 0.11), V(-0.55, 0.828, s * 0.085), V(-0.7, 0.862, s * 0.06)];
    b.add("carbon", sweep(upper, octa(0.3), () => [0.009, 0.017], { capStart: true, capEnd: true, samples: 24 }));
    const lower = [V(-0.13, 0.5, s * 0.12), V(-0.27, 0.64, s * 0.112), V(-0.41, 0.78, s * 0.1)];
    b.add("carbon", sweep(lower, octa(0.3), () => [0.008, 0.013], { capStart: true, capEnd: true, samples: 16 }));
  }

  // ---------- machined rearsets ----------
  for (const s of [1, -1]) {
    b.node(s > 0 ? "rearsetR" : "rearsetL", "chassis", { explode: V(-0.02, -0.06, s * 0.42), delay: 0.26 });
    let p = plate(
      [
        [-0.2, 0.305],
        [-0.36, 0.33],
        [-0.385, 0.44],
        [-0.24, 0.472],
        [-0.17, 0.405],
      ],
      0.008,
      { holes: [circle(-0.27, 0.405, 0.021), circle(-0.335, 0.395, 0.013)], bevel: 0.0016 },
    );
    p.translate(0, 0, 0.19);
    if (s < 0) p = mirrorZ(p);
    b.add("alu", p);
    b.add("alu", rod(V(-0.315, 0.355, s * 0.19), V(-0.315, 0.355, s * 0.258), 0.0088, 0.0088, 16));
    // lever: brake on the right, shift on the left
    b.add("alu", rod(V(-0.3, 0.35, s * 0.2), V(-0.19, s > 0 ? 0.33 : 0.38, s * 0.205), 0.0045, 0.0035, 8));
    b.add("titanium", tint(rod(V(-0.27, 0.405, s * 0.18), V(-0.27, 0.405, s * 0.2), 0.006, 0.006, 6)));
  }
  b.anchor("chassis.rearset", V(-0.315, 0.36, 0.26));

  // ---------- clip-ons ride with the fork ----------
  b.node("fork", "front");
  for (const s of [1, -1]) {
    const z = s * D.forkZ;
    b.add("alu", rod(legPt(0.655, z), legPt(0.69, z), 0.0312, 0.0312, 20));
    const root = legPt(0.672, z).add(V(0, 0, s * 0.03));
    const grip0 = V(0.374, 0.882, s * 0.245);
    b.add("alu", rod(root, grip0, 0.011, 0.011, 12));
    b.add("rubber", rod(grip0, V(0.345, 0.872, s * 0.345), 0.0165, 0.0165, 16));
    b.add("alu", rod(V(0.345, 0.872, s * 0.345), V(0.343, 0.871, s * 0.355), 0.014, 0.012, 12));
    b.add("alu", rod(V(0.41, 0.892, s * 0.258), V(0.432, 0.874, s * 0.37), 0.0048, 0.004, 8));
    const sw = block(0.045, 0.04, 0.034, 0.35);
    sw.translate(0.372, 0.892, s * 0.232);
    b.add("black", sw);
  }

  // titanium serial plate riveted to the right spar, just behind the headstock
  b.node("frame", "chassis");
  {
    const ang = Math.atan2(0.13, 0.3);
    const c = V(0.292, 0.782, 0.1695);
    const plateGeo = toPlain(new PlaneGeometry(0.074, 0.026));
    plateGeo.rotateZ(ang);
    plateGeo.translate(c.x, c.y, c.z + 0.0012);
    b.add("engraved", plateGeo);
    const backing = plate(
      [
        [-0.039, -0.015],
        [0.039, -0.015],
        [0.039, 0.015],
        [-0.039, 0.015],
      ],
      0.0018,
      { bevel: 0.0005 },
    );
    backing.rotateZ(ang);
    backing.translate(c.x, c.y, c.z);
    b.add("titanium", tint(backing, [0.44, 0.42, 0.4]));
    for (const [dx, dy] of [
      [-0.034, -0.0105],
      [0.034, -0.0105],
      [-0.034, 0.0105],
      [0.034, 0.0105],
    ]) {
      const q = V(dx * Math.cos(ang) - dy * Math.sin(ang), dx * Math.sin(ang) + dy * Math.cos(ang), 0).add(c);
      b.add("titanium", tint(rod(q, q.clone().setZ(c.z + 0.0032), 0.0022, 0.0016, 10), [0.5, 0.47, 0.44]));
    }
    b.anchor("frame.serial", c);
  }
}

function circle(cx: number, cy: number, r: number, seg = 28): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < seg; i++) {
    const a = -(i / seg) * Math.PI * 2;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}
