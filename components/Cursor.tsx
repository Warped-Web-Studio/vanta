"use client";

import { useEffect, useRef } from "react";
import { frame } from "@/lib/frame";
import { useFrame } from "@/lib/hooks";
import { SCENES } from "@/lib/scenes";
import { vanta } from "@/lib/store";

// A restrained cursor: a 1px reticle and a state label in the utility face. Fine
// pointers only; touch, reduced motion and form fields keep the native cursor.

export function Cursor() {
  const enabled = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const override = useRef<string | null>(null);
  const lastLabel = useRef("");

  useEffect(() => {
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;
    enabled.current = true;
    document.documentElement.dataset.customCursor = "1";
    const onOver = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      const tagged = t?.closest<HTMLElement>("[data-cursor]");
      if (tagged) override.current = tagged.dataset.cursor ?? null;
      else if (t?.closest("button, a, [role=button], summary")) override.current = "SELECT";
      else override.current = null;
    };
    window.addEventListener("pointerover", onOver, { passive: true });
    return () => {
      window.removeEventListener("pointerover", onOver);
      delete document.documentElement.dataset.customCursor;
    };
  }, []);

  useFrame(() => {
    const el = root.current;
    if (!el || !enabled.current) return;
    const p = frame.pointer;
    el.style.transform = `translate3d(${p.px}px, ${p.py}px, 0)`;
    const st = vanta.getState();
    const hidden = st.phase !== "entered" || st.dialog !== null || p.touch || p.last === 0;
    el.style.opacity = hidden ? "0" : "1";
    const text = override.current ?? SCENES[frame.scene.index]?.cursor ?? "";
    if (text !== lastLabel.current && label.current) {
      lastLabel.current = text;
      label.current.textContent = text;
    }
  });

  return (
    <div
      ref={root}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 transition-opacity duration-300"
      style={{ zIndex: "var(--z-cursor)" as unknown as number, opacity: 0 }}
    >
      <div className="absolute -left-[7px] top-0 h-px w-[15px] bg-bone mix-blend-difference" />
      <div className="absolute left-0 -top-[7px] h-[15px] w-px bg-bone mix-blend-difference" />
      <span ref={label} className="absolute left-[14px] top-[8px] t-mono text-[9.5px] text-bone/80 mix-blend-difference" />
    </div>
  );
}
