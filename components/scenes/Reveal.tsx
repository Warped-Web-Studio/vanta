"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { SceneSection } from "../SceneSection";
import { reveal } from "@/lib/content";
import { frame } from "@/lib/frame";
import { useFrame, useSceneTimeline } from "@/lib/hooks";
import { useVanta, vanta } from "@/lib/store";

// SCENE 01. Nearly black. The copy is gated on how much of the machine the visitor has
// actually uncovered (measured on the GPU), with scroll and time as fallbacks so nothing
// is ever withheld for good.

const T1 = 0.18, T2 = 0.35, T3 = 0.5;

export function Reveal() {
  const stage = useVanta((s) => s.revealStage);
  const phase = useVanta((s) => s.phase);
  const stage2At = useRef(0);

  const root = useSceneTimeline(0, (tl) => {
    // the wind takes the copy with it as the smoke is blown out of frame
    tl.to(".rv-title-out", { xPercent: -14, clipPath: "inset(0 100% 0 0)", duration: 0.45, ease: "power2.in" }, 0.36)
      .to(".rv-side-out", { yPercent: -120, duration: 0.3, ease: "power2.in", stagger: 0.04 }, 0.34);
  });

  // gate on discovered fraction, scroll and time
  useFrame(() => {
    if (vanta.getState().phase !== "entered") return;
    const d = frame.reveal.discovered;
    const s = vanta.getState().revealStage;
    const scrolled = frame.scroll.t > 0.08;
    let next: number = s;
    if (vanta.getState().reducedMotion || scrolled || frame.engineReady === false) next = 3;
    else {
      if (d >= T1 && s < 1) next = 1;
      if (d >= T2 && s < 2) next = 2;
      if (s >= 2 && !stage2At.current) stage2At.current = performance.now();
      if ((d >= T3 || (stage2At.current && performance.now() - stage2At.current > 2500)) && s < 3) next = Math.max(next, 3);
    }
    if (next > s) vanta.setState({ revealStage: next as 0 | 1 | 2 | 3 });
  });

  useEffect(() => {
    if (phase !== "entered") return;
    const el = root.current;
    if (!el) return;
    const reduced = vanta.getState().reducedMotion;
    const show = (sel: string, delay = 0) =>
      gsap.to(el.querySelectorAll(sel), {
        y: 0,
        yPercent: 0,
        duration: reduced ? 0.01 : 1.25,
        ease: "expo.out",
        stagger: 0.07,
        delay,
      });
    const tws: gsap.core.Tween[] = [];
    if (stage >= 1) tws.push(show(".rv-a"));
    if (stage >= 2) tws.push(show(".rv-b", 0.1));
    if (stage >= 3) {
      tws.push(show(".rv-c", 0.2));
      tws.push(gsap.to(el.querySelector(".rv-rule"), { scaleX: 1, duration: reduced ? 0.01 : 1.4, ease: "expo.out", delay: 0.25 }));
    }
    return () => tws.forEach((t) => t.kill());
  }, [stage, phase, root]);

  return (
    <SceneSection index={0} label="VANTA R1, revealed">
      <div ref={root as React.RefObject<HTMLDivElement>} className="absolute inset-0">
        <h1 className="rv-title-out absolute bottom-[5svh] left-[var(--gutter)] max-md:bottom-[9svh]">
          <span className="sr-only">VANTA / R1. 99 units. $48,000.</span>
          <span aria-hidden="true" className="t-display block whitespace-nowrap text-[clamp(48px,10.4vw,200px)] text-bone max-md:text-[14.5vw]">
            <span className="mask-line inline-block align-bottom">
              <span className="rv-a inline-block from-below">VANTA</span>
            </span>{" "}
            <span className="mask-line inline-block align-bottom">
              <span className="rv-a inline-block from-below text-ash font-[300]">/</span>
            </span>{" "}
            <span className="mask-line inline-block align-bottom">
              <span className="rv-a inline-block from-below">R1</span>
            </span>
          </span>
        </h1>

        <div aria-hidden="true" className="absolute right-[var(--gutter)] top-[19svh] text-right max-md:top-[13svh]">
          <div className="rv-side-out mask-line">
            <span className="rv-b block from-below t-statement text-[clamp(22px,2.7vw,46px)] text-bone">{reveal.units}</span>
          </div>
          <div className="rv-side-out my-4 ml-auto h-px w-[min(18vw,220px)] origin-right scale-x-0 bg-bone/40 rv-rule" />
          <div className="rv-side-out mask-line">
            <span className="rv-c block from-below t-statement text-[clamp(22px,2.7vw,46px)] text-bone">{reveal.price}</span>
          </div>
        </div>
      </div>
    </SceneSection>
  );
}
