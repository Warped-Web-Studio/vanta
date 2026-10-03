"use client";

import { useRef } from "react";
import { SceneSection } from "../SceneSection";
import { motion } from "@/lib/content";
import { frame } from "@/lib/frame";
import { useFrame, useSceneTimeline } from "@/lib/hooks";

// SCENE 08. Controlled violence. The world streaks past and the lens compresses; the
// machine itself stays sharp and readable. Scrolling faster adds speed.

export function Motion() {
  const speed = useRef<HTMLSpanElement>(null);
  const last = useRef(-1);

  const root = useSceneTimeline(7, (tl) => {
    tl.to(".mo-in > span", { y: 0, yPercent: 0, duration: 0.1, stagger: 0.03, ease: "expo.out" }, 0.08);
    tl.to(".mo-in > span", { yPercent: -110, duration: 0.05, stagger: 0.01, ease: "power2.in" }, 0.86);
  });

  useFrame(() => {
    if (frame.scene.index !== 7 || !speed.current) return;
    const v = frame.live.speed;
    if (v !== last.current) {
      last.current = v;
      speed.current.textContent = String(Math.min(299, v)).padStart(3, "0");
    }
  });

  return (
    <SceneSection index={7} label="In motion: 299 km/h">
      <div ref={root as React.RefObject<HTMLDivElement>} className="absolute inset-0">
        <h2 className="absolute right-[var(--gutter)] top-[calc(6svh+min(29vw,45svh))] text-right max-md:top-[calc(14svh+38vw)]">
          <span className="sr-only">299 km/h, limited.</span>
          <span className="mo-in mask-line" aria-hidden="true">
            <span className="block from-below t-mono-lg text-bone">{motion.unit}</span>
          </span>
        </h2>
        <dl className="absolute bottom-[10svh] left-[var(--gutter)] space-y-2 max-md:bottom-[8svh]">
          {motion.times.map((t) => (
            <div key={t.label} className="mo-in mask-line">
              <span className="flex from-below gap-6">
                <dt className="t-mono text-ash">{t.label}</dt>
                <dd className="t-mono text-bone">{t.value}</dd>
              </span>
            </div>
          ))}
        </dl>
        <div className="absolute bottom-[9svh] right-[var(--gutter)] text-right max-md:bottom-[7svh]" aria-hidden="true">
          <div className="mo-in mask-line">
            <span className="flex from-below items-baseline justify-end gap-3">
              <span ref={speed} className="font-mono text-[clamp(48px,6vw,108px)] font-[220] leading-none tracking-[-0.05em] text-bone [font-stretch:76%] tabular-nums">
                080
              </span>
              <span className="t-mono text-alloy">KM/H</span>
            </span>
          </div>
        </div>
      </div>
    </SceneSection>
  );
}
