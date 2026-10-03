import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";
import type { Builder } from "../builder";
import { D, bankDir } from "./dims";
import { tube, sweep, plate, rod, ngon, V, tint, type Profile } from "../geometry";

// Titanium 4-2-1. The heat tint is baked into vertex colours (used as F0 by the metal):
// violet and blue at the ports, bronze and straw further down, raw titanium beyond.

const STOPS: [number, [number, number, number]][] = [
  [0.0, [0.17, 0.22, 0.46]],
  [0.035, [0.3, 0.19, 0.42]],
  [0.075, [0.52, 0.31, 0.19]],
  [0.12, [0.66, 0.52, 0.3]],
  [0.19, [0.52, 0.5, 0.47]],
  [0.27, [0.45, 0.43, 0.41]],
];

export function heatTint(d: number): [number, number, number] {
  if (d <= STOPS[0][0]) return STOPS[0][1];
  for (let i = 1; i < STOPS.length; i++) {
    const [d1, c1] = STOPS[i];
    const [d0, c0] = STOPS[i - 1];
    if (d <= d1) {
      const t = (d - d0) / (d1 - d0);
      const s = t * t * (3 - 2 * t);
      return [c0[0] + (c1[0] - c0[0]) * s, c0[1] + (c1[1] - c0[1]) * s, c0[2] + (c1[2] - c0[2]) * s];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

/** tube with heat tint by distance from its start (uv.x runs along the path) */
function header(points: Vector3[], r: number, offset = 0): BufferGeometry {
  const g = tube(points, r, 72, 14);
  let L = 0;
  for (let i = 1; i < points.length; i++) L += points[i].distanceTo(points[i - 1]);
  const uv = g.getAttribute("uv");
  const n = uv.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set(heatTint(offset + uv.getX(i) * L), i * 3);
  g.setAttribute("color", new Float32BufferAttribute(col, 3));
  return g;
}

const HEX: Profile = ngon(6, 1, Math.PI / 6).map(([x, y]) => [x, y] as [number, number]);

export function buildExhaust(b: Builder) {
  b.node("exhaust", "exhaust", { explode: V(-0.05, -0.28, 0.36), delay: 0.28, unbolt: V(0.02, -0.03, 0) });

  const ef = bankDir(D.bankF);
  const er = bankDir(D.bankR);
  const headF = V(D.crank.x + ef.x * 0.27, D.crank.y + ef.y * 0.27);
  const headR = V(D.crank.x + er.x * 0.27, D.crank.y + er.y * 0.27);
  const portF = headF.clone().add(V(Math.sin(D.bankF), -Math.cos(D.bankF)).multiplyScalar(0.07));
  const portR = headR.clone().add(V(-0.743, -0.669).multiplyScalar(0.07));

  for (const z of [-0.065, 0.065]) {
    const k = Math.sign(z);
    b.add(
      "titanium",
      header(
        [
          portF.clone().setZ(z),
          V(0.37, 0.452, z * 1.1),
          V(0.372, 0.35, z * 1.15),
          V(0.33, 0.245, z),
          V(0.23, 0.172, z * 0.8),
          V(0.1, 0.152, z * 0.5),
          V(0.0, 0.152, z * 0.3),
        ],
        0.019,
      ),
    );
    b.add(
      "titanium",
      header(
        [
          portR.clone().setZ(z * 0.75),
          V(-0.205, 0.47, k * 0.05),
          V(-0.21, 0.36, k * 0.052),
          V(-0.165, 0.24, k * 0.048),
          V(-0.08, 0.168, k * 0.035),
          V(0.0, 0.152, k * 0.02),
        ],
        0.0185,
      ),
    );
    // port flanges
    b.add("titanium", tint(rod(portF.clone().setZ(z).addScaledVector(ef, 0.004), portF.clone().setZ(z).addScaledVector(ef, -0.012), 0.027, 0.027, 6)));
  }
  // collector to silencer
  b.add(
    "titanium",
    header(
      [V(0.0, 0.152, 0), V(-0.1, 0.165, 0.05), V(-0.165, 0.215, 0.125)],
      0.029,
      0.24,
    ),
  );
  // hexagonal silencer
  const sil = [V(-0.16, 0.215, 0.135), V(-0.31, 0.29, 0.155), V(-0.45, 0.365, 0.168)];
  const sGeo = sweep(sil, HEX, (t) => [0.05 - t * 0.008, 0.05 - t * 0.008], {
    capStart: true,
    capEnd: false,
    crease: 40,
    samples: 18,
  });
  // the outlet end takes a blue-violet heat tint
  {
    const uv = sGeo.getAttribute("uv");
    let maxV = 0;
    for (let i = 0; i < uv.count; i++) maxV = Math.max(maxV, uv.getY(i));
    const col = new Float32Array(uv.count * 3);
    for (let i = 0; i < uv.count; i++) {
      const fromEnd = maxV - uv.getY(i);
      const c = fromEnd < 0.09 ? heatTint(0.02 + fromEnd * 1.6) : ([0.43, 0.415, 0.4] as [number, number, number]);
      col.set(c, i * 3);
    }
    sGeo.setAttribute("color", new Float32BufferAttribute(col, 3));
  }
  b.add("titanium", sGeo);
  // carbon heat shield on the outer face
  const shield = sweep(
    [V(-0.2, 0.25, 0.192), V(-0.3, 0.3, 0.205), V(-0.4, 0.348, 0.214)],
    [
      [-1, -0.3],
      [0, 1],
      [1, -0.3],
      [1, -0.5],
      [0, 0.75],
      [-1, -0.5],
    ],
    () => [0.012, 0.04],
    { capStart: true, capEnd: true, samples: 10, ref: V(0, 0, 1) },
  );
  b.add("carbon", shield);
  // carbon end cap and outlet
  const dir = sil[2].clone().sub(sil[1]).normalize();
  const cap = sweep(
    [sil[2].clone().addScaledVector(dir, -0.002), sil[2].clone().addScaledVector(dir, 0.03)],
    HEX,
    (t) => [0.05 - t * 0.008, 0.05 - t * 0.008],
    { capStart: true, capEnd: true, samples: 1 },
  );
  b.add("carbon", cap);
  b.add("black", rod(sil[2].clone().addScaledVector(dir, 0.02), sil[2].clone().addScaledVector(dir, 0.05), 0.021, 0.021, 18));
  b.add("titanium", tint(rod(sil[2].clone().addScaledVector(dir, 0.028), sil[2].clone().addScaledVector(dir, 0.052), 0.023, 0.023, 18), [0.38, 0.36, 0.42]));
  // hanger strap
  const strap = plate(
    [
      [-0.345, 0.335],
      [-0.315, 0.33],
      [-0.29, 0.43],
      [-0.32, 0.435],
    ],
    0.006,
  );
  strap.translate(0, 0, 0.175);
  b.add("alu", strap);

  b.anchor("exhaust.silencer", V(-0.34, 0.31, 0.215));
  b.anchor("exhaust.headers", portF.clone().setZ(0.08));
}
