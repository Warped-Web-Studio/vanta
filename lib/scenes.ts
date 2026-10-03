export type SceneId =
  | "reveal"
  | "mass"
  | "aero"
  | "exploded"
  | "power"
  | "interface"
  | "materials"
  | "motion"
  | "ninety"
  | "final";

export type CursorState =
  | "REVEAL"
  | "INSPECT"
  | "FLOW"
  | "EXPLORE"
  | "OBSERVE"
  | "SELECT"
  | "FOCUS"
  | "VELOCITY"
  | "STILL"
  | "ROTATE";

export interface SceneDef {
  id: SceneId;
  name: string;
  /** scroll length in viewport heights: desktop, portrait */
  vh: [number, number];
  cursor: CursorState;
  /** in-flow scenes scroll their own content instead of using a fixed stage */
  flow?: boolean;
}

export const SCENES: SceneDef[] = [
  { id: "reveal", name: "Reveal", vh: [160, 140], cursor: "REVEAL" },
  { id: "mass", name: "Mass", vh: [320, 280], cursor: "INSPECT" },
  { id: "aero", name: "Air", vh: [300, 260], cursor: "FLOW" },
  { id: "exploded", name: "Systems", vh: [420, 360], cursor: "EXPLORE" },
  { id: "power", name: "Power", vh: [320, 280], cursor: "OBSERVE" },
  { id: "interface", name: "Interface", vh: [200, 230], cursor: "SELECT" },
  { id: "materials", name: "Material", vh: [0, 0], cursor: "FOCUS", flow: true },
  { id: "motion", name: "Motion", vh: [300, 260], cursor: "VELOCITY" },
  { id: "ninety", name: "Ninety-nine", vh: [260, 230], cursor: "STILL" },
  { id: "final", name: "R1", vh: [200, 200], cursor: "ROTATE" },
];

export const SCENE_INDEX: Record<SceneId, number> = Object.fromEntries(
  SCENES.map((s, i) => [s.id, i]),
) as Record<SceneId, number>;
