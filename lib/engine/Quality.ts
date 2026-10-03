import type { WebGLRenderer } from "three";

// Quality tiers. The initial guess comes from the GPU string and device class; an adaptive
// monitor then steps resolution down (and expensive passes off) if frames run long.

export type Tier = 1 | 2 | 3;

export interface QualitySettings {
  tier: Tier;
  maxDpr: number;
  msaa: number;
  simRes: number;
  dyeRes: number;
  iterations: number;
  bloom: boolean;
  aeroLines: number;
  aeroPerLine: number;
  plateScale: number;
}

export function detectTier(renderer: WebGLRenderer): Tier {
  const gl = renderer.getContext();
  const coarse = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  const small = Math.min(screen.width, screen.height) < 600;
  let gpu = "";
  try {
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)).toLowerCase();
  } catch {
    /* blocked */
  }
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  if (coarse && small) return 1;
  if (/swiftshader|llvmpipe|software|basic render/.test(gpu)) return 1;
  if (/apple m|apple gpu|nvidia|geforce|rtx|radeon rx|radeon pro/.test(gpu) && cores >= 8) return 3;
  if (coarse) return 2;
  if (mem <= 4 || cores <= 4 || /intel/.test(gpu)) return 2;
  return 3;
}

export function settingsFor(tier: Tier): QualitySettings {
  switch (tier) {
    case 3:
      return { tier, maxDpr: 1.75, msaa: 4, simRes: 128, dyeRes: 1024, iterations: 16, bloom: true, aeroLines: 72, aeroPerLine: 220, plateScale: 0.75 };
    case 2:
      return { tier, maxDpr: 1.5, msaa: 2, simRes: 112, dyeRes: 640, iterations: 12, bloom: true, aeroLines: 56, aeroPerLine: 160, plateScale: 0.6 };
    default:
      return { tier, maxDpr: 1.5, msaa: 0, simRes: 64, dyeRes: 320, iterations: 8, bloom: false, aeroLines: 40, aeroPerLine: 128, plateScale: 0.75 };
  }
}

/** Watches frame times; asks for a lower DPR when sustained frames exceed budget. */
export class FrameMonitor {
  private samples: number[] = [];
  private cooldown = 2;
  scale = 1;

  /** returns true when the render scale changed */
  push(dt: number): boolean {
    this.cooldown -= dt;
    this.samples.push(dt);
    if (this.samples.length > 90) this.samples.shift();
    if (this.cooldown > 0 || this.samples.length < 60) return false;
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    if (avg > 1 / 44 && this.scale > 0.6) {
      this.scale = Math.max(0.6, this.scale - 0.15);
      this.cooldown = 2.5;
      this.samples.length = 0;
      return true;
    }
    if (avg < 1 / 58 && this.scale < 1) {
      this.scale = Math.min(1, this.scale + 0.1);
      this.cooldown = 5;
      this.samples.length = 0;
      return true;
    }
    return false;
  }
}
