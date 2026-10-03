import {
  CanvasTexture,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from "three";

// Procedural textures generated at load time, so nothing is downloaded.

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface CarbonMaps {
  map: DataTexture;
  normalMap: DataTexture;
  anisotropyMap: DataTexture;
  roughnessMap: DataTexture;
}

/**
 * 2x2 twill. Each tow is either warp (runs along u) or weft (along v). The anisotropy
 * direction follows the tow, which produces the checkered sheen that flips with view
 * angle, the defining look of real lacquered carbon.
 */
export function carbonTwill(size = 512, cells = 16, seed = 7): CarbonMaps {
  const rand = rng(seed);
  const col = new Uint8Array(size * size * 4);
  const nrm = new Uint8Array(size * size * 4);
  const ani = new Uint8Array(size * size * 4);
  const rough = new Uint8Array(size * size * 4);
  const cell = size / cells;
  // per-tow tone variation
  const tone: number[] = [];
  for (let i = 0; i < cells * cells; i++) tone.push(0.82 + rand() * 0.36);
  // fibre striation noise
  const fib = new Float32Array(size);
  for (let i = 0; i < size; i++) fib[i] = rand();

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ci = Math.floor(x / cell), cj = Math.floor(y / cell);
      const warp = ((ci + cj) & 3) < 2;
      const lx = (x % cell) / cell; // 0..1 inside the cell
      const ly = (y % cell) / cell;
      // across-tow coordinate and along-tow coordinate
      const across = warp ? ly : lx;
      const along = warp ? lx : ly;
      const gap = Math.min(across, 1 - across);
      const edge = smooth(0.0, 0.07, gap); // dark seam between tows
      const crown = Math.sin(across * Math.PI); // cylindrical cross-section
      const striation = warp ? fib[y] : fib[x];
      const t = tone[cj * cells + ci];
      const lum = (0.055 + crown * 0.03 + striation * 0.012) * t * edge;
      const i = (y * size + x) * 4;
      const v = Math.round(Math.min(1, lum) * 255);
      col[i] = v;
      col[i + 1] = v;
      col[i + 2] = Math.round(v * 1.06);
      col[i + 3] = 255;

      // normal: tilt across the tow, slight dip where it dives under the crossing tow
      const slope = Math.cos(across * Math.PI) * 0.55;
      const dive = Math.sin(along * Math.PI * 2) * 0.12;
      let nx = warp ? dive : slope;
      let ny = warp ? slope : dive;
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      nrm[i] = Math.round((nx * 0.5 + 0.5) * 255);
      nrm[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      nrm[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      nrm[i + 3] = 255;

      // anisotropy: direction in tangent space encoded 0..1, strength in blue
      ani[i] = warp ? 255 : 128;
      ani[i + 1] = warp ? 128 : 255;
      ani[i + 2] = Math.round(255 * (0.55 + crown * 0.45) * edge);
      ani[i + 3] = 255;

      const r = 0.32 + (1 - edge) * 0.4 + striation * 0.08;
      rough[i] = rough[i + 1] = rough[i + 2] = Math.round(r * 255);
      rough[i + 3] = 255;
    }
  }
  const mk = (data: Uint8Array, srgb: boolean) => {
    const t = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
    t.wrapS = t.wrapT = RepeatWrapping;
    t.magFilter = LinearFilter;
    t.minFilter = LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
    t.needsUpdate = true;
    return t;
  };
  return {
    map: mk(col, true),
    normalMap: mk(nrm, false),
    anisotropyMap: mk(ani, false),
    roughnessMap: mk(rough, false),
  };
}

function smooth(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Concentric lathe marks for machined faces (brake carriers, clamps): roughness only. */
export function latheMarks(size = 256, seed = 3): DataTexture {
  const rand = rng(seed);
  const rings = new Float32Array(size);
  for (let i = 0; i < size; i++) rings[i] = rand();
  const d = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - size / 2, dy = y - size / 2;
      const r = Math.min(size - 1, Math.floor(Math.hypot(dx, dy) * 2));
      const v = 0.22 + rings[r % size] * 0.14;
      const i = (y * size + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = Math.round(v * 255);
      d[i + 3] = 255;
    }
  }
  const t = new DataTexture(d, size, size, RGBAFormat, UnsignedByteType);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

/**
 * Laser-etched serial plate: a roughness/bump map. The background is polished titanium
 * (dark = smooth), the etched characters are frosted (light = rough) and slightly recessed.
 */
export function engravingTexture(lines: { text: string; size: number; y: number; weight?: number; x?: number; spacing?: number }[], w = 1024, h = 360): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = "#3a3a3a";
  g.fillRect(0, 0, w, h);
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font-martian").trim() || "monospace";
  g.fillStyle = "#ffffff";
  g.textBaseline = "middle";
  for (const l of lines) {
    g.font = `${l.weight ?? 500} ${l.size}px ${family}`;
    if ("letterSpacing" in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${l.spacing ?? 0}px`;
    g.fillText(l.text, w * (l.x ?? 0.075), l.y * h);
  }
  // a hairline frame, etched like the characters
  g.strokeStyle = "#ffffff";
  g.lineWidth = 3;
  g.strokeRect(w * 0.035, h * 0.08, w * 0.93, h * 0.84);
  const t = new CanvasTexture(c);
  t.colorSpace = NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter;
  t.anisotropy = 8;
  return t;
}

/** Sidewall lettering on the slicks: alpha mask only. */
export function sidewallTexture(text: string): CanvasTexture {
  const w = 2048, h = 64;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#fff";
  g.font = `600 30px ${getComputedStyle(document.body).getPropertyValue("--font-martian") || "monospace"}`;
  g.textBaseline = "middle";
  const seg = w / 2;
  for (let k = 0; k < 2; k++) g.fillText(text, k * seg + 60, h / 2);
  const t = new CanvasTexture(c);
  t.colorSpace = NoColorSpace;
  t.wrapS = RepeatWrapping;
  return t;
}
