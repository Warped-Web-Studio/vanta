import type { Object3D } from "three";

// Drop-in replacement for the procedural geometry. Set `product.glb` in lib/content.ts
// (for example "/models/r1.glb" in /public) and the GLB's objects replace the procedural
// parts by name (nose, panelR, panelL, tank, seat, tail, belly, screen, fork, frame, subframe, rearsetR, rearsetL, engine, radiator, exhaust,
// swingarm, shock, intake, fuel, electronics, wheelF, wheelR). Explode vectors, anchors
// and engine internals are kept from the procedural model, so author the GLB to the same
// hard points (meters, x forward, y up, wheelbase 1.428).

export async function tryLoadGlb(url: string | null): Promise<Object3D | null> {
  if (!url) return null;
  try {
    const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
    const gltf = await new GLTFLoader().loadAsync(url);
    return gltf.scene;
  } catch (err) {
    console.warn("VANTA: could not load", url, err);
    return null;
  }
}
