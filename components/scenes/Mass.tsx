"use client";

import { useRef, useState } from "react";
import { SceneSection } from "../SceneSection";
import { Callout, DimLine, type Prog } from "../Annotations";
import { mass } from "@/lib/content";
import { frame } from "@/lib/frame";
import { useFrame, useSceneTimeline } from "@/lib/hooks";

// SCENE 02. A strict side profile on a long lens. The giant numeral behind the machine
// starts at the class reference and counts down as each saving is annotated on the bike.

const DESKTOP_AT: [number, number][] = [
  [0.47, 0.22],
  [0.47, 0.88],
  [0.27, 0.88],
  [0.68, 0.22],
  [0.66, 0.88],
];
const PORTRAIT_AT: [number, number][] = [
  [0.06, 0.805],
  [0.06, 0.831],
  [0.06, 0.857],
  [0.06, 0.883],
  [0.06, 0.909],
];

export function Mass() {
  // 0..2 dimensions, 3..7 callouts, 8 remainder
  const [prog] = useState<Prog>(() => ({ current: new Array(9).fill(0) }));
  const shown = useRef(-1);

  const root = useSceneTimeline(1, (tl) => {
    const p = prog.current;
    tl.to(".ms-line > span", { y: 0, yPercent: 0, duration: 0.08, stagger: 0.015, ease: "power3.out" }, 0.02);
    tl.to(".ms-unit > span", { y: 0, yPercent: 0, duration: 0.06, ease: "power3.out" }, 0.05);
    [0, 1, 2].forEach((i) => tl.to(p, { [i]: 1, duration: 0.07 }, 0.04 + i * 0.03));
    mass.callouts.forEach((_, i) => tl.to(p, { [3 + i]: 1, duration: 0.1 }, 0.14 + i * 0.12));
    tl.to(p, { 8: 1, duration: 0.06 }, 0.75);
    tl.to(".ms-rem", { clipPath: "inset(0 0% 0 0)", duration: 0.06 }, 0.75);
    // exit before the clay sweep begins
    tl.to(p, { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, duration: 0.06 }, 0.88);
    tl.to(".ms-fade", { opacity: 0, duration: 0.06 }, 0.88);
  });

  useFrame(() => {
    if (frame.scene.index !== 1) return;
    const p = prog.current;
    let kg: number = mass.reference;
    mass.callouts.forEach((c, i) => (kg -= c.kg * Math.min(1, p[3 + i] * 1.2)));
    kg -= mass.remainder.kg * p[8];
    const v = Math.round(kg);
    if (v !== shown.current) {
      shown.current = v;
      const el = document.getElementById("bt-mass");
      if (el) el.textContent = String(v);
    }
  });

  const at = (i: number) => (frame.viewport.portrait ? PORTRAIT_AT[i] : DESKTOP_AT[i]);

  return (
    <SceneSection index={1} label="Mass: 164 kg dry">
      <div ref={root as React.RefObject<HTMLDivElement>} className="absolute inset-0">
        <h2 className="sr-only">164 kg dry. 37 kg under the class reference.</h2>
        <ul className="sr-only">
          {mass.callouts.map((c) => (
            <li key={c.id}>
              {c.label}, minus {c.kg} kg
            </li>
          ))}
          <li>
            {mass.remainder.label}, minus {mass.remainder.kg} kg
          </li>
        </ul>

        <p aria-hidden="true" className="ms-fade absolute left-[var(--gutter)] top-[13svh] max-w-[30ch] t-statement text-[clamp(18px,1.55vw,28px)] text-bone max-md:top-[15svh] max-md:max-w-[22ch]">
          {mass.line.split(". ").map((s, i, arr) => (
            <span key={i} className="ms-line mask-line">
              <span className="block from-below">{i < arr.length - 1 ? `${s}.` : s}</span>
            </span>
          ))}
        </p>

        <div aria-hidden="true" className="ms-fade absolute left-[var(--gutter)] bottom-[9svh] flex items-baseline gap-5 max-md:bottom-auto max-md:top-[41svh] max-md:gap-3">
          <span className="ms-unit mask-line">
            <span className="block from-below t-display text-[clamp(40px,5vw,92px)] text-bone">KG</span>
          </span>
          <span className="ms-unit mask-line">
            <span className="block from-below t-display text-[clamp(40px,5vw,92px)] text-ash">DRY.</span>
          </span>
        </div>

        <div aria-hidden="true" className="ms-fade">
          {mass.dimensions.map((d, i) => (
            <DimLine
              key={d.id}
              index={i}
              prog={prog}
              from={d.id === "wheelbase" ? "ground.rear" : d.id === "seat" ? "seat.floor" : "tail.tip"}
              to={d.id === "wheelbase" ? "ground.front" : d.id === "seat" ? "seat.top" : "nose.tip"}
              offset={d.id === "wheelbase" ? 22 : d.id === "seat" ? -34 : -44}
              vertical={d.id === "seat"}
              portraitHidden={d.id !== "wheelbase"}
              label={
                <>
                  <span className="text-ash">{d.label}</span>&nbsp;&nbsp;{d.value}
                </>
              }
            />
          ))}
          {mass.callouts.map((c, i) => (
            <Callout key={c.id} index={3 + i} prog={prog} anchor={c.anchor} at={() => at(i)} marker={String(i + 1)}>
              <div className="flex flex-col max-md:flex-row max-md:items-baseline max-md:gap-3">
                <span className="hidden t-mono text-ash max-md:inline">{i + 1}</span>
                <div className="t-mono-lg text-bone">−{c.kg.toFixed(1)} KG</div>
                <div className="t-mono text-ash">{c.label}</div>
              </div>
            </Callout>
          ))}
        </div>

        <div aria-hidden="true" className="ms-rem ms-fade absolute right-[var(--gutter)] bottom-[9svh] text-right [clip-path:inset(0_100%_0_0)] max-md:left-[var(--gutter)] max-md:right-auto max-md:bottom-[6.2svh] max-md:flex max-md:items-baseline max-md:gap-3 max-md:text-left">
          <div className="t-mono-lg text-bone">−{mass.remainder.kg.toFixed(1)} KG</div>
          <div className="t-mono text-ash max-md:max-w-[58vw] max-md:truncate">{mass.remainder.label}</div>
        </div>
      </div>
    </SceneSection>
  );
}
