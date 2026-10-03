import { BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Builder } from "../builder";
import { D, bankDir } from "./dims";
import { block, latheZ, loftX, octa, plate, rod, V, tint } from "../geometry";

// 1,099 cc 90° V4. The shell is a stressed member; internals (pistons, rods, crank) are
// individually animated for the sectioned view in the Power scene.

export const BORE = 0.083;
export const STROKE = 0.0508;
export const ROD = 0.105;
/** bores across the crank, per bank */
export const BORE_Z = [-0.07, 0.07];

function placeOnBank(g: BufferGeometry, angle: number, dist: number) {
  g.rotateZ(angle);
  const e = bankDir(angle);
  g.translate(D.crank.x + e.x * dist, D.crank.y + e.y * dist, 0);
  return g;
}

export function buildEngine(b: Builder) {
  b.node("engine", "engine", { explode: V(0, -0.38, 0), delay: 0.62, unbolt: V(0, -0.03, 0) });

  // crankcase and sump
  b.add(
    "magnesium",
    loftX(
      [
        { x: -0.13, y: 0.38, w: 0.13, h: 0.1 },
        { x: -0.05, y: 0.37, w: 0.15, h: 0.12 },
        { x: 0.18, y: 0.37, w: 0.15, h: 0.12 },
        { x: 0.27, y: 0.385, w: 0.12, h: 0.09 },
      ],
      octa(0.3),
      { capStart: true, capEnd: true, crease: 24 },
    ),
  );
  b.add(
    "magnesium",
    loftX(
      [
        { x: -0.05, y: 0.238, w: 0.1, h: 0.034 },
        { x: 0.2, y: 0.232, w: 0.11, h: 0.034 },
      ],
      octa(0.4),
      { capStart: true, capEnd: true },
    ),
  );
  // sump fins
  for (let i = 0; i < 5; i++) {
    const f = plate(
      [
        [-0.03 + i * 0.05, 0.21],
        [0.0 + i * 0.05, 0.21],
        [0.0 + i * 0.05, 0.25],
        [-0.03 + i * 0.05, 0.25],
      ],
      0.23,
      { bevel: 0.001 },
    );
    b.add("magnesium", f.scale(1, 1, 1));
  }

  // two banks: block, head, cam cover with ribs
  for (const a of [D.bankF, D.bankR]) {
    b.add("magnesium", placeOnBank(block(0.135, 0.128, 0.3, 0.22), a, 0.165));
    b.add("aluDark", placeOnBank(block(0.076, 0.148, 0.312, 0.24), a, 0.268));
    b.add("magnesium", placeOnBank(block(0.036, 0.118, 0.276, 0.42), a, 0.322));
    for (let k = -1; k <= 1; k++) {
      const rib = block(0.012, 0.09, 0.008, 0.3);
      rib.translate(0, 0, k * 0.07);
      b.add("alu", placeOnBank(rib, a, 0.344));
    }
    // spark plug coil tops (machined) on the cam cover
    for (const z of BORE_Z) {
      const coil = rod(V(0, 0, z), V(0.03, 0, z), 0.013, 0.011, 12);
      b.add("aluDark", placeOnBank(coil, a, 0.33));
    }
  }

  // clutch cover (right) with titanium bolts, alternator cover (left)
  const clutch = latheZ(
    [
      [0, 0.148],
      [0.084, 0.148],
      [0.088, 0.158],
      [0.08, 0.171],
      [0.05, 0.176],
      [0, 0.177],
    ],
    64,
  );
  clutch.translate(0.13, 0.345, 0);
  b.add("aluDark", clutch);
  for (let k = 0; k < 8; k++) {
    const ang = (k / 8) * Math.PI * 2;
    const p = V(0.13 + Math.cos(ang) * 0.076, 0.345 + Math.sin(ang) * 0.076, 0.168);
    b.add("titanium", tint(rod(p, p.clone().setZ(0.176), 0.0045, 0.0045, 6)));
  }
  const alt = latheZ(
    [
      [0, -0.172],
      [0.05, -0.17],
      [0.068, -0.16],
      [0.07, -0.148],
      [0, -0.148],
    ],
    48,
  );
  alt.translate(-0.03, 0.41, 0);
  b.add("magnesium", alt);
  const spCover = block(0.09, 0.07, 0.03, 0.4);
  spCover.translate(0.0, 0.36, -0.158);
  b.add("magnesium", spCover);

  b.anchor("engine.heads", V(0.3, 0.6, 0.17));
  b.anchor("engine.crank", V(D.crank.x, D.crank.y, 0.16));

  // ---------- internals (dynamic, hidden until sectioned) ----------
  for (let bank = 0; bank < 2; bank++) {
    for (let k = 0; k < 2; k++) {
      // piston: authored along +y, centred at origin
      const piston = latheZ(
        [
          [0, 0.019],
          [BORE / 2 - 0.002, 0.019],
          [BORE / 2, 0.016],
          [BORE / 2, -0.016],
          [BORE / 2 - 0.004, -0.02],
          [0, -0.02],
        ],
        40,
      );
      piston.rotateX(-Math.PI / 2); // lathe axis z -> y
      b.dyn(`piston${bank}${k}`, "alu", piston);
      // connecting rod: big end at origin, small end at +y ROD
      const rodGeo = plate(
        [
          [-0.024, 0],
          [-0.011, ROD - 0.006],
          [-0.012, ROD + 0.012],
          [0.012, ROD + 0.012],
          [0.011, ROD - 0.006],
          [0.024, 0],
          [0.02, -0.024],
          [-0.02, -0.024],
        ],
        0.018,
        { bevel: 0.002 },
      );
      b.dyn(`rod${bank}${k}`, "titanium", tint(rodGeo, [0.5, 0.47, 0.44]));
    }
  }
  // combustion pulse at the top of each bore
  for (let i = 0; i < 4; i++) {
    const sph = latheZ(
      Array.from({ length: 9 }, (_, k) => {
        const a = -Math.PI / 2 + (k / 8) * Math.PI;
        return [Math.cos(a) * 0.016, Math.sin(a) * 0.016] as [number, number];
      }),
      16,
    );
    b.dyn(`flash${i}`, "pulse", sph);
  }
  // crankshaft with counterweight webs, authored around origin, axis z
  const crank: BufferGeometry[] = [rod(V(0, 0, -0.13), V(0, 0, 0.13), 0.019, 0.019, 20)];
  for (const z of [-0.105, -0.035, 0.035, 0.105]) {
    const web = plate(
      [
        [-0.045, -0.055],
        [0.045, -0.055],
        [0.03, 0.02],
        [0.0, 0.036],
        [-0.03, 0.02],
      ],
      0.016,
      { bevel: 0.002 },
    );
    web.translate(0, 0, z);
    crank.push(web);
  }
  b.dyn("crank", "steel", merge(crank));
}

function merge(gs: BufferGeometry[]) {
  const m = mergeGeometries(gs, false);
  gs.forEach((g) => g.dispose());
  return m!;
}

export function buildRadiator(b: Builder) {
  b.node("radiator", "engine", { explode: V(0.28, -0.04, 0), delay: 0.34 });
  const core = block(0.036, 0.25, 0.34, 0.12);
  core.rotateZ((-16 * Math.PI) / 180);
  core.translate(0.405, 0.6, 0);
  b.add("black", core);
  for (const s of [-1, 1]) {
    const tank = block(0.042, 0.25, 0.026, 0.3);
    tank.rotateZ((-16 * Math.PI) / 180);
    tank.translate(0.405, 0.6, s * 0.18);
    b.add("aluDark", tank);
  }
}
