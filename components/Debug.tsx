"use client";

import { useEffect, useRef, useState } from "react";
import { frame } from "@/lib/frame";
import { useFrame } from "@/lib/hooks";

/** ?debug: frame rate, draw calls, triangles, DPR and quality tier. */
export function Debug() {
  const [on, setOn] = useState(false);
  const el = useRef<HTMLPreElement>(null);
  useEffect(() => {
    // read once on mount; the flag never changes during a session
    const enabled = new URLSearchParams(location.search).has("debug");
    if (enabled) requestAnimationFrame(() => setOn(true));
  }, []);
  useFrame(() => {
    if (!el.current) return;
    const s = frame.stats;
    el.current.textContent = `${s.fps} FPS  ${s.calls} CALLS  ${(s.tris / 1000).toFixed(0)}K TRIS  DPR ${s.dpr.toFixed(2)}  T${s.tier}  t ${frame.scroll.t.toFixed(3)}`;
  });
  if (!on) return null;
  return <pre ref={el} className="fixed left-[var(--gutter)] top-14 t-mono text-signal" style={{ zIndex: 9 }} />;
}
