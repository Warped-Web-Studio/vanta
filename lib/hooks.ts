"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { onFrame } from "./ticker";
import { bindTimeline, type Timeline } from "./timelines";

export const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Run a DOM updater every frame (writes to refs only). */
export function useFrame(fn: (dt: number) => void, deps: unknown[] = []) {
  const ref = useRef(fn);
  useIsoLayoutEffect(() => {
    ref.current = fn;
  });
  useEffect(() => onFrame((dt) => ref.current(dt)), deps); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * A paused timeline scrubbed by the scene's local progress (0..1). The builder lays out
 * the scene's choreography on a 0..1 time axis.
 */
export function useSceneTimeline(index: number, build: (tl: Timeline) => void, deps: unknown[] = []) {
  const root = useRef<HTMLElement | null>(null);
  useIsoLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true, defaults: { ease: "none" } });
      build(tl);
      // normalise to exactly 1s so tl.progress(local) maps scene progress directly
      if (tl.duration() < 1) tl.set({}, {}, 1);
      tl.progress(0);
      const unbind = bindTimeline(index, tl);
      return () => unbind();
    }, root.current ?? undefined);
    return () => ctx.revert();
  }, deps);
  return root;
}
