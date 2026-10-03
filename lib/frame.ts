// Continuous, per-frame values shared between the director, the engine and DOM
// updaters. Deliberately a mutable singleton: none of this may enter React state.

export interface AnchorPoint {
  x: number;
  y: number;
  /** 0 when behind the camera or the anchor's part is hidden */
  v: number;
}

export const frame = {
  time: 0,
  dt: 0.016,

  viewport: { w: 1440, h: 900, dpr: 1, portrait: false },

  scroll: {
    y: 0,
    velocity: 0,
    /** normalised |velocity|, smoothed */
    energy: 0,
    /** scene index + local progress, e.g. 2.35 = 35% through scene 2 */
    t: 0,
  },

  scene: {
    index: 0,
    local: 0,
  },

  pointer: {
    /** normalised device coords, -1..1, y up */
    x: 0,
    y: 0,
    /** pixels */
    px: 0,
    py: 0,
    /** velocity in ndc per second */
    vx: 0,
    vy: 0,
    speed: 0,
    /** smoothed pointer for parallax */
    sx: 0,
    sy: 0,
    down: false,
    touch: false,
    /** ms timestamp of last movement */
    last: 0,
    /** a fresh movement sample is waiting to be splatted */
    dirty: false,
    /** tap/press event waiting to be consumed */
    tap: false,
  },

  reveal: { discovered: 0, field: 1 },

  /** telemetry string for the HUD; written by the engine */
  telemetry: "",

  anchors: new Map<string, AnchorPoint>(),

  /** projected corners of the TFT dash: tl, tr, br, bl in px */
  dashQuad: new Float32Array(8),
  dashQuadValid: false,

  /** live values the DOM reads */
  live: {
    airspeed: 0,
    rpm: 1400,
    speed: 0,
    explode: 0,
    rotation: 0,
    /** firing pulse per cylinder, 0..1 */
    firing: new Float32Array(4),
    focus: 0,
  },

  /** visibility of each exploded-view label (content.exploded.labels order) */
  labelVis: new Float32Array(8),

  /** DOM frames that the WebGL stage renders material plates into */
  plates: new Map<string, HTMLElement>(),

  /** drag rotation for the final turntable, radians */
  turntable: { angle: 0, velocity: 0, dragging: false },

  /** set by the engine when WebGL is running */
  engineReady: false,

  /** engine statistics for the ?debug overlay */
  stats: { fps: 0, calls: 0, tris: 0, dpr: 1, tier: 3 },
};

export type Frame = typeof frame;
