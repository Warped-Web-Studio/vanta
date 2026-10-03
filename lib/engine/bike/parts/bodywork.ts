import { BufferGeometry } from "three";
import type { Builder } from "../builder";
import { loftX, hull, octa, plate, rod, mirrorZ, V, type Profile, type Ring } from "../geometry";

// Bodywork in a faceted, stealth-aircraft language: ridged hull sections, flat layered
// side panels with angular cut-outs, boxed winglets, a razor tail.

const noseRings: Ring[] = [
  { x: 0.38, y: 0.8425, w: 0.205, h: 0.1525 },
  { x: 0.46, y: 0.83, w: 0.215, h: 0.16 },
  { x: 0.56, y: 0.8275, w: 0.215, h: 0.1475 },
  { x: 0.66, y: 0.825, w: 0.205, h: 0.125 },
  { x: 0.76, y: 0.8175, w: 0.175, h: 0.0975 },
  { x: 0.84, y: 0.81, w: 0.125, h: 0.065 },
  { x: 0.9, y: 0.805, w: 0.07, h: 0.04 },
  { x: 0.935, y: 0.8, w: 0.022, h: 0.016 },
];

const tankRings: Ring[] = [
  { x: -0.2, y: 0.862, w: 0.125, h: 0.035 },
  { x: -0.08, y: 0.882, w: 0.165, h: 0.06 },
  { x: 0.06, y: 0.898, w: 0.19, h: 0.074 },
  { x: 0.2, y: 0.894, w: 0.18, h: 0.075 },
  { x: 0.31, y: 0.88, w: 0.14, h: 0.06 },
  { x: 0.37, y: 0.865, w: 0.1, h: 0.04 },
];

const seatRings: Ring[] = [
  { x: -0.47, y: 0.846, w: 0.085, h: 0.014 },
  { x: -0.36, y: 0.845, w: 0.11, h: 0.018 },
  { x: -0.24, y: 0.847, w: 0.125, h: 0.02 },
  { x: -0.17, y: 0.853, w: 0.12, h: 0.017 },
];

const tailRings: Ring[] = [
  { x: -0.995, y: 0.928, w: 0.022, h: 0.011 },
  { x: -0.9, y: 0.91, w: 0.05, h: 0.032 },
  { x: -0.78, y: 0.886, w: 0.078, h: 0.05 },
  { x: -0.62, y: 0.848, w: 0.104, h: 0.064 },
  { x: -0.47, y: 0.8, w: 0.126, h: 0.076 },
  { x: -0.32, y: 0.772, w: 0.14, h: 0.074 },
  { x: -0.22, y: 0.762, w: 0.135, h: 0.066 },
];

const bellyRings: Ring[] = [
  { x: -0.06, y: 0.21, w: 0.1, h: 0.055 },
  { x: 0.08, y: 0.195, w: 0.165, h: 0.065 },
  { x: 0.26, y: 0.205, w: 0.18, h: 0.065 },
  { x: 0.37, y: 0.24, w: 0.15, h: 0.06 },
  { x: 0.42, y: 0.275, w: 0.09, h: 0.04 },
];

const sidePanel: [number, number][] = [
  [0.7, 0.735],
  [0.6, 0.772],
  [0.4, 0.766],
  [0.22, 0.736],
  [0.08, 0.666],
  [0.0, 0.52],
  [-0.025, 0.375],
  [0.3, 0.382],
  [0.405, 0.395],
  [0.52, 0.565],
];
// carbon lower facet below the crease line, under the engine
const lowerFacet: [number, number][] = [
  [0.36, 0.33],
  [0.395, 0.385],
  [0.3, 0.37],
  [0.05, 0.36],
  [-0.03, 0.36],
  [0.03, 0.226],
  [0.33, 0.236],
];
const panelCut: [number, number][] = [
  [0.3, 0.632],
  [0.13, 0.632],
  [0.06, 0.47],
  [0.14, 0.42],
  [0.33, 0.48],
];
const panelVent: [number, number][] = [
  [0.48, 0.69],
  [0.4, 0.69],
  [0.37, 0.632],
  [0.45, 0.632],
];

const screenProfile: Profile = [
  [-1, -0.5],
  [0, 1],
  [1, -0.5],
  [1, -0.62],
  [0, 0.88],
  [-1, -0.62],
];

function lean(g: BufferGeometry, deg: number, pivotY: number) {
  g.translate(0, -pivotY, 0);
  g.rotateX((deg * Math.PI) / 180);
  g.translate(0, pivotY, 0);
  return g;
}

function airfoil(chord: number, t: number): [number, number][] {
  // leading edge at +x
  return [
    [chord, 0],
    [chord * 0.94, t * 0.75],
    [chord * 0.7, t],
    [chord * 0.25, t * 0.55],
    [0, 0.0006],
    [0, -0.0006],
    [chord * 0.3, -t * 0.35],
    [chord * 0.8, -t * 0.4],
  ];
}

export function buildBodywork(b: Builder) {
  // ---------- nose / upper fairing (open at the back: it is a shell) ----------
  b.node("nose", "bodywork", { explode: V(0.36, 0.4, 0), delay: 0.08, unbolt: V(0.03, 0.02, 0) });
  b.add("paint", loftX(noseRings, hull(0.1, 0.58, 0.6), { capEnd: true, crease: 26 }));
  // ram-air mouth
  b.add(
    "black",
    loftX(
      [
        { x: 0.925, y: 0.787, w: 0.03, h: 0.0115 },
        { x: 0.946, y: 0.787, w: 0.033, h: 0.0125 },
      ],
      octa(0.45),
      { capStart: true, capEnd: true },
    ),
  );
  // DRL light pipes: two blades per side
  for (const s of [-1, 1]) {
    b.add("drl", rod(V(0.913, 0.791, s * 0.032), V(0.826, 0.772, s * 0.124), 0.0034, 0.0028, 8));
    b.add("drl", rod(V(0.872, 0.814, s * 0.058), V(0.806, 0.803, s * 0.142), 0.0022, 0.0018, 8));
  }
  b.anchor("bodywork.nose", V(0.86, 0.84, 0.1));
  b.anchor("nose.tip", V(0.946, 0.787, 0));

  // ---------- smoked screen ----------
  b.node("screen", "bodywork", { explode: V(0.3, 0.66, 0), delay: 0.02 });
  b.add(
    "glass",
    loftX(
      [
        { x: 0.43, y: 1.033, w: 0.142, h: 0.03 },
        { x: 0.54, y: 0.995, w: 0.152, h: 0.032 },
        { x: 0.648, y: 0.955, w: 0.122, h: 0.022 },
      ],
      screenProfile,
      { capStart: true, capEnd: true, crease: 50 },
    ),
  );

  // ---------- side panels with winglets ----------
  for (const s of [1, -1]) {
    b.node(s > 0 ? "panelR" : "panelL", "bodywork", {
      explode: V(0.05, 0.03, s * 0.55),
      delay: 0.0,
      unbolt: V(0, 0, s * 0.03),
    });
    let p = plate(sidePanel, 0.006, { holes: [panelCut, panelVent], bevel: 0.0022 });
    p = lean(p, -5, 0.5);
    p.translate(0, 0, 0.222);
    b.add("paint", s > 0 ? p : mirrorZ(p));
    // lower facet: a second plane, raked inward, meeting the upper panel at a crease
    let low = plate(lowerFacet, 0.006, { bevel: 0.002 });
    low = lean(low, 14, 0.36);
    low.translate(0, 0, 0.212);
    b.add("carbon", s > 0 ? low : mirrorZ(low));

    // boxed double-element winglet
    for (const [dx, dy, ch] of [
      [0, 0, 0.15],
      [-0.035, 0.036, 0.11],
    ] as const) {
      // chord along x, thickness along y, span along z; 7° angle of attack
      const w = plate(airfoil(ch, 0.011), 0.066, { bevel: 0.0012 });
      w.rotateZ((-7 * Math.PI) / 180);
      w.translate(0.555 + dx, 0.698 + dy, 0.258);
      b.add("carbon", s > 0 ? w : mirrorZ(w));
    }
    const end = plate(
      [
        [0.54, 0.682],
        [0.715, 0.69],
        [0.712, 0.752],
        [0.6, 0.762],
      ],
      0.004,
      { bevel: 0.001 },
    );
    end.translate(0, 0, 0.292);
    b.add("carbon", s > 0 ? end : mirrorZ(end));
  }
  b.anchor("bodywork.panel", V(0.16, 0.58, 0.23));

  // ---------- belly pan ----------
  b.node("belly", "bodywork", { explode: V(0, -0.36, 0), delay: 0.06 });
  b.add("paint", loftX(bellyRings, hull(0.0, 0.4, 0.7), { capStart: true, capEnd: true, crease: 26 }));

  // ---------- tank cover ----------
  b.node("tank", "bodywork", { explode: V(0, 0.54, 0), delay: 0.12, unbolt: V(0, 0.03, 0) });
  b.add("paint", loftX(tankRings, hull(0.18, 0.5, 0.75), { capStart: true, capEnd: true, crease: 24 }));
  // carbon knee recess panels
  for (const s of [1, -1]) {
    const k = plate(
      [
        [-0.17, 0.83],
        [0.06, 0.84],
        [0.16, 0.86],
        [-0.05, 0.87],
      ],
      0.004,
      { bevel: 0.0012 },
    );
    k.translate(0, 0, 0.176);
    b.add("carbon", s > 0 ? k : mirrorZ(k));
  }
  b.anchor("bodywork.tank", V(0.1, 0.96, 0.08));

  // ---------- seat ----------
  b.node("seat", "bodywork", { explode: V(-0.04, 0.72, 0), delay: 0.1 });
  b.add("suede", loftX(seatRings, octa(0.5, 0.6, 1), { capStart: true, capEnd: true, crease: 30 }));
  b.anchor("seat.top", V(-0.3, 0.863, 0));
  b.anchor("seat.floor", V(-0.3, 0, 0));

  // ---------- tail ----------
  b.node("tail", "bodywork", { explode: V(-0.34, 0.44, 0), delay: 0.14, unbolt: V(-0.02, 0.02, 0) });
  b.add("paint", loftX(tailRings, hull(0.15, 0.55, 0.35), { capStart: true, capEnd: true, crease: 24 }));
  b.add("tail", rod(V(-0.978, 0.904, -0.032), V(-0.978, 0.904, 0.032), 0.0036, 0.0036, 8));
  for (const s of [-1, 1]) b.add("tail", rod(V(-0.97, 0.9, s * 0.02), V(-0.88, 0.879, s * 0.052), 0.0024, 0.002, 8));
  b.anchor("bodywork.tail", V(-0.8, 0.95, 0.04));
  b.anchor("tail.tip", V(-0.995, 0.928, 0));
}
