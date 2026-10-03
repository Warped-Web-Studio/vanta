"use client";

import { SceneSection } from "../SceneSection";
import { Dash } from "../dash/Dash";
import { dash } from "@/lib/content";
import { useSceneTimeline } from "@/lib/hooks";

// SCENE 06. The rider's point of view. The display is live software mapped onto the
// machine's own screen; the switchgear drives it, and the machine answers.

export function Interface() {
  const root = useSceneTimeline(5, (tl) => {
    tl.to(".if-line > span", { y: 0, yPercent: 0, duration: 0.12, ease: "expo.out" }, 0.1);
    tl.to(".if-line > span", { yPercent: -110, duration: 0.06, ease: "power2.in" }, 0.92);
  });

  return (
    <SceneSection index={5} label="Interface: the instrument display">
      <div ref={root as React.RefObject<HTMLDivElement>} className="absolute inset-0">
        <h2 className="if-line mask-line absolute left-[var(--gutter)] top-[12svh] max-md:top-[11svh]">
          <span className="block from-below t-statement text-[clamp(18px,1.6vw,28px)] text-bone">{dash.line}</span>
        </h2>
        <Dash />
      </div>
    </SceneSection>
  );
}
