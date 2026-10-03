import {
  BackSide,
  BoxGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  WebGLRenderer,
  type Texture,
} from "three";

// Image-based light built from emissive panels, then prefiltered with PMREM. A long
// overhead strip is the key (it draws the long specular along tank and fairing), two
// cold vertical strips behind are the rims, and there is deliberately no fill.

export type EnvVariant = "studio" | "final" | "tunnel";

function panel(w: number, h: number, color: Color) {
  return new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color, side: 2 }));
}

export function buildEnv(renderer: WebGLRenderer, variant: EnvVariant): Texture {
  const scene = new Scene();
  const room = new Mesh(
    new BoxGeometry(16, 8, 16),
    new MeshBasicMaterial({ color: new Color(variant === "tunnel" ? 0.035 : 0.004, variant === "tunnel" ? 0.037 : 0.004, variant === "tunnel" ? 0.04 : 0.0045), side: BackSide }),
  );
  room.position.y = 3.5;
  scene.add(room);

  const add = (m: Mesh, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    scene.add(m);
  };

  if (variant === "tunnel") {
    // evenly spaced overhead rows: a neutral, analytic light for the clay model
    for (let i = -3; i <= 3; i++) add(panel(9, 0.28, new Color(2.2, 2.25, 2.35)), 0, 3.4, i * 1.3, Math.PI / 2);
    add(panel(12, 2.5, new Color(0.25, 0.26, 0.28)), 0, 1.2, -6, 0, 0);
    add(panel(12, 2.5, new Color(0.18, 0.19, 0.2)), 0, 1.2, 6, 0, Math.PI);
  } else {
    const key = variant === "final" ? 11 : 8;
    // key strip runs along the bike's length
    add(panel(7.5, 0.42, new Color(key, key * 0.985, key * 0.95)), 0.2, 3.7, 0.5, Math.PI / 2);
    // broad, dim overhead softbox slightly forward
    add(panel(3.4, 2.4, new Color(0.9, 0.9, 0.88).multiplyScalar(variant === "final" ? 1.6 : 0.9)), 1.4, 3.5, -0.8, Math.PI / 2);
    // cold rim strips behind
    const rim = new Color(0.72, 0.84, 1.0).multiplyScalar(variant === "final" ? 5 : 3.6);
    add(panel(0.32, 4.4, rim), -3.4, 2.2, -3.2, 0, Math.PI / 4);
    add(panel(0.32, 4.4, rim), 3.6, 2.2, -3.0, 0, -Math.PI / 4);
    // a low kicker that catches the lower edges of the bodywork
    add(panel(6, 0.18, new Color(0.9, 0.92, 0.95).multiplyScalar(variant === "final" ? 1.6 : 0.8)), 0, 0.35, 4.2, 0, Math.PI);
    if (variant === "final") {
      add(panel(7.5, 0.3, new Color(5, 5, 4.9)), 0, 3.7, -1.4, Math.PI / 2);
      add(panel(0.3, 4.4, new Color(2.2, 2.2, 2.2)), 4.2, 2.2, 2.6, 0, -2.3);
    }
  }
  // floor bounce
  add(panel(16, 16, new Color(0.012, 0.012, 0.013)), 0, 0, 0, -Math.PI / 2);

  const pmrem = new PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.035);
  pmrem.dispose();
  scene.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      (m.material as MeshBasicMaterial).dispose();
    }
  });
  return rt.texture;
}
