"use client";

import { useRef } from "react";
import { SceneSection } from "../SceneSection";
import { aero } from "@/lib/content";
import { frame } from "@/lib/frame";
import { useFrame, useSceneTimeline } from "@/lib/hooks";

// SCENE 03. The environment changes: a wind tunnel, the machine turned to clay, smoke
// filaments bending around its real silhouette. Scroll speed is airspeed.

export function Aero() {
  const speed = useRef<HTMLSpanElement>(null);
  const last = useRef(-1);

  const root = useSceneTimeline(2, (tl) => {
    tl.to(".ae-line > span", { y: 0, yPercent: 0, duration: 0.12, stagger: 0.04, ease: "expo.out" }, 0.14);
    tl.to(".ae-read", { clipPath: "inset(0% 0 0 0)", duration: 0.1, stagger: 0.03, ease: "power2.out" }, 0.22);
    tl.to(".ae-line > span", { yPercent: -110, duration: 0.06, stagger: 0.015, ease: "power2.in" }, 0.9);
    tl.to(".ae-read", { clipPath: "inset(100% 0 0 0)", duration: 0.05 }, 0.9);
  });

  useFrame(() => {
    if (frame.scene.index !== 2 || !speed.current) return;
    const v = frame.live.airspeed;
    if (v !== last.current) {
      last.current = v;
      speed.current.textContent = String(v).padStart(3, "0");
    }
  });

  return (
    <SceneSection index={2} label="Aerodynamics">
      <div ref={root as React.RefObject<HTMLDivElement>} className="absolute inset-0">
        <h2 className="absolute left-[var(--gutter)] top-[12svh] t-display text-[clamp(40px,5.6vw,104px)] text-bone max-md:top-[11svh] max-md:text-[12.5vw]">
          {aero.lines.map((l, i) => (
            <span key={i} className={`ae-line mask-line ${i === 1 ? "pl-[0.9em]" : ""}`}>
              <span className="block from-below">{l}</span>
            </span>
          ))}
        </h2>

        <div className="absolute bottom-[10svh] right-[var(--gutter)] text-right max-md:bottom-[8svh]">
          <div className="ae-read [clip-path:inset(100%_0_0_0)]">
            <div className="t-mono text-ash">AIRSPEED</div>
            <div className="flex items-baseline justify-end gap-3">
              <span ref={speed} className="font-mono text-[clamp(44px,5vw,88px)] font-[250] leading-none tracking-[-0.04em] text-bone [font-stretch:80%] tabular-nums">
                060
              </span>
              <span className="t-mono text-alloy">KM/H</span>
            </div>
          </div>
          <dl className="mt-7 space-y-1.5">
            {aero.readouts.map((r) => (
              <div key={r.label} className="ae-read flex justify-end gap-6 [clip-path:inset(100%_0_0_0)]">
                <dt className="t-mono text-ash">{r.label}</dt>
                <dd className="t-mono text-bone">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </SceneSection>
  );
}
