import type { gsap as GSAP } from "gsap";

export type Timeline = ReturnType<typeof GSAP.timeline>;

// Scene components register their (paused) DOM timelines here; the director scrubs them
// with the scene's local progress. A module-level registry avoids effect-order coupling
// between the scenes and the Experience root that creates the director.
export const sceneTimelines = new Map<number, Set<Timeline>>();

export function bindTimeline(index: number, tl: Timeline) {
  let set = sceneTimelines.get(index);
  if (!set) sceneTimelines.set(index, (set = new Set()));
  set.add(tl);
  return () => {
    set!.delete(tl);
  };
}

// The director instance, for components that need to scroll (rail, skip links).
export const directorRef: { current: { scrollToScene(i: number): void; scrollToT(t: number, immediate?: boolean): void } | null } = {
  current: null,
};
