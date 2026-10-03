"use client";

import { SceneSection } from "../SceneSection";
import { Callout, type Prog } from "../Annotations";
import { exploded } from "@/lib/content";
import { frame } from "@/lib/frame";
import { useSceneTimeline } from "@/lib/hooks";

// SCENE 04. The machine separates into its systems, slowly, as the camera rises. Labels
// appear only as each system settles, never all at once (visibility comes from the engine).

const ANCHOR: Record<string, string> = {
  bodywork: "bodywork.panel",
  electronics: "electronics.dash",
  exhaust: "exhaust.silencer",
  wheels: "wheels.front",
  chassis: "chassis.spar",
  engine: "engine.heads",
};

// leader direction per label, in px from the anchor (desktop)
const OFFSET: Record<string, [number, number]> = {
  bodywork: [110, -90],
  electronics: [-150, -70],
  exhaust: [-130, 90],
  wheels: [90, 110],
  chassis: [-140, -110],
  engine: [120, 80],
};

const labelProg: Prog = { current: frame.labelVis as unknown as number[] };

export function Exploded() {
  const root = useSceneTimeline(3, (tl) => {
    tl.to(".ex-line > span", { y: 0, yPercent: 0, duration: 0.1, stagger: 0.05, ease: "expo.out" }, 0.5);
    tl.to(".ex-line > span", { yPercent: -110, duration: 0.05, stagger: 0.02, ease: "power2.in" }, 0.92);
  });

  return (
    <SceneSection index={3} label="Exploded view: 1,186 parts">
      <div ref={root as React.RefObject<HTMLDivElement>} className="absolute inset-0">
        <h2 className="absolute bottom-[10svh] left-[var(--gutter)] max-md:bottom-auto max-md:top-[12svh]">
          <span className="ex-line mask-line">
            <span className="block from-below t-display text-[clamp(40px,4.8vw,88px)] text-bone">{exploded.line[0]}</span>
          </span>
          <span className="ex-line mask-line mt-2">
            <span className="block from-below t-statement text-[clamp(16px,1.5vw,26px)] text-ash">{exploded.line[1]}</span>
          </span>
        </h2>
        <ul className="sr-only">
          {exploded.labels.map((l) => (
            <li key={l.group}>
              {l.title}: {l.detail}
            </li>
          ))}
        </ul>
        <div aria-hidden="true">
          {exploded.labels.map((l, i) => {
            const [ox, oy] = OFFSET[l.group];
            return (
              <Callout
                key={l.group}
                index={i}
                prog={labelProg}
                anchor={ANCHOR[l.group]}
                align={ox < 0 ? "right" : "left"}
                at={(a) => {
                  const k = frame.viewport.portrait ? 0.55 : 1;
                  return [(a.x + ox * k) / frame.viewport.w, (a.y + oy * k) / frame.viewport.h];
                }}
              >
                <div className="t-mono text-bone">{l.title}</div>
                <div className="t-mono text-ash">{l.detail}</div>
              </Callout>
            );
          })}
        </div>
      </div>
    </SceneSection>
  );
}
