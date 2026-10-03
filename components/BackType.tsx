"use client";

import { useRef } from "react";
import { frame } from "@/lib/frame";
import { useFrame } from "@/lib/hooks";
import { mass, motion, power } from "@/lib/content";
import { useVanta } from "@/lib/store";
import { SCENES } from "@/lib/scenes";

// Giant type that lives BEHIND the transparent WebGL stage, so the machine and the smoke
// physically occlude it. Decorative only (aria-hidden); the readable copy is in the scenes.

export function BackType() {
  const webgl = useVanta((s) => s.webgl);
  const speedRef = useRef<HTMLDivElement>(null);
  const skew = useRef(0);

  useFrame((dt) => {
    // the motion numeral shears and slips with velocity: type caught in the slipstream
    const el = speedRef.current;
    if (!el || frame.scene.index !== 7) return;
    const v = Math.min(1.2, frame.live.speed / 299);
    skew.current += (v - skew.current) * Math.min(1, dt * 4);
    el.style.transform = `translate3d(${(-skew.current * 4).toFixed(2)}vw, 0, 0) skewX(${(-skew.current * 14).toFixed(2)}deg)`;
  });

  return (
    <div className="layer-back" aria-hidden="true">
      {webgl === "failed" &&
        SCENES.filter((s) => !s.flow).map((s) => (
          // no WebGL: stills captured from the real engine stand in for the stage
          <picture key={s.id} data-back={s.id} className="back-item poster">
            <source media="(max-aspect-ratio: 100/108)" srcSet={`/posters/m/${s.id}.jpg`} />
            <img src={`/posters/${s.id}.jpg`} alt="" className="h-full w-full object-cover" />
          </picture>
        ))}
      <div data-back="reveal" className="back-item">
        <div id="bt-r1" className="t-numeral absolute right-[6vw] top-[50%] -translate-y-[46%] text-[min(74svh,52vw)] leading-[0.74] text-[#15171a] max-md:right-[-6vw] max-md:top-[38%]">
          R1
        </div>
      </div>
      <div data-back="mass" className="back-item">
        <div id="bt-mass" className="t-numeral absolute left-[-1.6vw] bottom-[24svh] text-[min(43vw,66svh)] leading-[0.74] text-[#1b1e22] max-md:bottom-auto max-md:top-[24svh] max-md:text-[44vw]">
          {mass.reference}
        </div>
      </div>
      <div data-back="power" className="back-item">
        <div id="bt-power" className="t-numeral absolute left-[-1vw] top-[11svh] text-[min(36vw,58svh)] leading-[0.74] text-[#17191c] max-md:top-[8svh] max-md:text-[46vw]">
          {power.hp}
        </div>
      </div>
      <div data-back="motion" className="back-item">
        <div ref={speedRef} className="absolute right-[-3vw] top-[6svh] origin-bottom-left max-md:top-[14svh]">
          <div className="t-numeral text-[min(40vw,62svh)] leading-[0.74] text-[#16181b] max-md:text-[52vw]">{motion.top}</div>
        </div>
      </div>
    </div>
  );
}
