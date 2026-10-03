"use client";

import { useRef } from "react";
import { SceneSection } from "../SceneSection";
import { final } from "@/lib/content";
import { frame } from "@/lib/frame";
import { useSceneTimeline } from "@/lib/hooks";
import { vanta } from "@/lib/store";
import { sound } from "@/lib/audio/Sound";

// SCENE 10. The studio switches on. No distortion, no smoke: the unobstructed machine,
// which the visitor can turn by hand. Allocated, not purchased.

export function Final() {
  const drag = useRef<{ x: number; t: number; id: number } | null>(null);

  const root = useSceneTimeline(9, (tl) => {
    tl.to(".fn-in > span", { y: 0, yPercent: 0, duration: 0.14, stagger: 0.03, ease: "expo.out" }, 0.18);
    tl.to(".fn-cta", { clipPath: "inset(0 0% 0 0)", duration: 0.12, stagger: 0.04, ease: "power3.out" }, 0.28);
  });

  const onDown = (e: React.PointerEvent) => {
    if (frame.scene.index !== 9) return;
    drag.current = { x: e.clientX, t: performance.now(), id: e.pointerId };
    frame.turntable.dragging = true;
    frame.turntable.velocity = 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const now = performance.now();
    const dx = e.clientX - d.x;
    const da = dx * 0.006;
    frame.turntable.angle += da;
    frame.turntable.velocity = da / Math.max(0.008, (now - d.t) / 1000);
    d.x = e.clientX;
    d.t = now;
  };
  const onUp = () => {
    drag.current = null;
    frame.turntable.dragging = false;
    frame.turntable.velocity = Math.max(-3, Math.min(3, frame.turntable.velocity));
  };

  const open = (dialog: "allocation" | "dossier") => {
    sound.click(0.8);
    vanta.setState({ dialog });
  };

  return (
    <SceneSection index={9} label="VANTA R1: request allocation">
      <div ref={root as React.RefObject<HTMLDivElement>} className="absolute inset-0">
        {/* drag surface for the turntable */}
        <div
          className="interactive absolute inset-0 touch-pan-y"
          data-cursor="ROTATE"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-hidden="true"
        />

        <div className="pointer-events-none absolute bottom-[9svh] left-[var(--gutter)] max-md:bottom-[30svh]">
          <h2 className="fn-in mask-line">
            <span className="block from-below t-display text-[clamp(56px,10.5vw,200px)] text-bone">
              VANTA <span className="font-[300] text-ash">/</span> R1
            </span>
          </h2>
        </div>

        <div className="absolute bottom-[9svh] right-[var(--gutter)] flex flex-col items-end gap-7 max-md:bottom-[7svh] max-md:left-[var(--gutter)] max-md:items-stretch">
          <div className="text-right max-md:text-left">
            <div className="fn-in mask-line">
              <span className="block from-below t-statement text-[clamp(26px,2.6vw,46px)] text-bone">{final.price}</span>
            </div>
            <div className="fn-in mask-line mt-2">
              <span className="block from-below t-mono text-ash">{final.units}</span>
            </div>
          </div>
          <div className="interactive flex gap-3 max-md:flex-col">
            <button type="button" className="fn-cta btn-solid [clip-path:inset(0_100%_0_0)]" onClick={() => open("allocation")}>
              {final.primary}
              <span aria-hidden="true">→</span>
            </button>
            <button type="button" className="fn-cta btn-line [clip-path:inset(0_100%_0_0)]" onClick={() => open("dossier")}>
              {final.secondary}
            </button>
          </div>
        </div>

        <p className="absolute bottom-[20px] right-[var(--gutter)] t-mono text-ash/80 max-md:hidden">© 2026 VANTA. ALLOCATION BY REQUEST.</p>
      </div>
    </SceneSection>
  );
}
