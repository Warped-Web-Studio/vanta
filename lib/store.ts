import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { dash, type RideMode } from "./content";

export type LoadStepId = "geometry" | "materials" | "telemetry" | "aerodynamics";

export interface LoadStep {
  p: number;
  detail: string;
}

export type DashParam = "mode" | "tc" | "eb" | "sus";

export interface VantaState {
  phase: "boot" | "loading" | "ready" | "entered";
  steps: Record<LoadStepId, LoadStep>;
  webgl: "pending" | "ok" | "failed";
  reducedMotion: boolean;
  tier: 1 | 2 | 3;

  revealStage: 0 | 1 | 2 | 3;
  activeScene: number;

  sound: boolean;
  dialog: null | "allocation" | "dossier";

  ride: {
    mode: RideMode;
    tc: number;
    eb: number;
    sus: number;
    focus: DashParam;
  };

  setStep: (id: LoadStepId, p: number, detail?: string) => void;
  setRide: (patch: Partial<VantaState["ride"]>) => void;
  applyMode: (mode: RideMode) => void;
}

const step = (): LoadStep => ({ p: 0, detail: "" });

export const vanta = createStore<VantaState>((set) => ({
  phase: "boot",
  steps: {
    geometry: step(),
    materials: step(),
    telemetry: step(),
    aerodynamics: step(),
  },
  webgl: "pending",
  reducedMotion: false,
  tier: 3,

  revealStage: 0,
  activeScene: 0,

  sound: false,
  dialog: null,

  ride: { mode: "TRACK", ...pick(dash.presets.TRACK), focus: "mode" },

  setStep: (id, p, detail) =>
    set((s) => ({
      steps: { ...s.steps, [id]: { p, detail: detail ?? s.steps[id].detail } },
    })),
  setRide: (patch) => set((s) => ({ ride: { ...s.ride, ...patch } })),
  applyMode: (mode) =>
    set((s) => ({ ride: { ...s.ride, mode, ...pick(dash.presets[mode]) } })),
}));

function pick(p: { tc: number; eb: number; sus: number }) {
  return { tc: p.tc, eb: p.eb, sus: p.sus };
}

export function useVanta<T>(selector: (s: VantaState) => T): T {
  return useStore(vanta, selector);
}
