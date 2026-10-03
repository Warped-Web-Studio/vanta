"use client";

import { useRef } from "react";
import { SceneSection } from "../SceneSection";
import { ninety } from "@/lib/content";
import { useSceneTimeline } from "@/lib/hooks";

// SCENE 09. Everything slows. A raking light crosses the etched plate on the monocoque.
// Ninety-nine hairlines, one per machine, are set one at a time.

export function Ninety() {
  const ticks = useRef<HTMLDivElement>(null);

  const root = useSceneTimeline(8, (tl) => {
    tl.to(".nn-big > span", { y: 0, yPercent: 0, duration: 0.16, ease: "expo.out" }, 0.08);
    tl.to(".nn-line > span", { y: 0, yPercent: 0, duration: 0.12, stagger: 0.12, ease: "expo.out" }, 0.3);
    tl.to(".nn-serial", { clipPath: "inset(0% 0 0 0)", duration: 0.2, ease: "power2.inOut" }, 0.2);
    tl.fromTo(".nn-tick", { scaleY: 0 }, { scaleY: 1, duration: 0.004, stagger: 0.0055, ease: "power1.out" }, 0.16);
    tl.to(".nn-big > span, .nn-line > span", { yPercent: -110, duration: 0.05, ease: "power2.in" }, 0.9);
    tl.to(".nn-serial, .nn-ticks", { opacity: 0, duration: 0.05 }, 0.9);
  });

  return (
    <SceneSection index={8} label="99 built">
      <div ref={root as React.RefObject<HTMLDivElement>} className="absolute inset-0">
        <h2 className="nn-big mask-line absolute left-[var(--gutter)] top-[14svh] max-md:top-[12svh]">
          <span className="block from-below t-display text-[clamp(56px,9vw,170px)] text-bone">{ninety.big}</span>
        </h2>
        <div className="absolute left-[var(--gutter)] top-[calc(14svh+min(9vw,170px)+28px)] space-y-2 max-md:top-[calc(12svh+15vw+20px)]">
          {ninety.lines.map((l) => (
            <p key={l} className="nn-line mask-line">
              <span className="block from-below t-statement text-[clamp(16px,1.45vw,26px)] text-alloy">{l}</span>
            </p>
          ))}
        </div>

        {/* vertical serial along the right edge */}
        <div
          className="nn-serial absolute right-[calc(var(--gutter)+64px)] max-md:right-[var(--gutter)] top-1/2 -translate-y-1/2 [clip-path:inset(100%_0_0_0)] max-md:top-[42%]"
          aria-hidden="true"
        >
          <div className="t-condensed text-[clamp(14px,1.1vw,18px)] tracking-[0.3em] text-bone [writing-mode:vertical-rl]">{ninety.serial}</div>
        </div>

        {/* 99 hairlines: one per machine; the first is this one */}
        <div ref={ticks} className="nn-ticks absolute bottom-[9svh] left-[var(--gutter)] right-[var(--gutter)] flex h-[46px] items-end justify-between" aria-hidden="true">
          {Array.from({ length: 99 }, (_, i) => (
            <div key={i} className={`nn-tick w-px origin-bottom ${i === 0 ? "h-full bg-signal" : i % 10 === 9 ? "h-[70%] bg-bone/70" : "h-[46%] bg-bone/35"}`} />
          ))}
        </div>
        <div className="absolute bottom-[calc(9svh+58px)] left-[var(--gutter)] t-mono text-ash" aria-hidden="true">
          001
        </div>
        <div className="absolute bottom-[calc(9svh+58px)] right-[var(--gutter)] t-mono text-ash" aria-hidden="true">
          099
        </div>
      </div>
    </SceneSection>
  );
}
