"use client";

import { useRef } from "react";
import { frame } from "@/lib/frame";
import { useFrame } from "@/lib/hooks";

// Technical annotation primitives bound to points on the 3D machine. Geometry is
// recomputed every frame from projected anchors and written straight to the DOM.

export interface Prog {
  current: number[];
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Leader line from a 3D anchor to a label: a 45° run to the label's height, then a
 * horizontal run. `at` is the label position as viewport fractions (or a function).
 */
export function Callout({
  anchor,
  at,
  prog,
  index,
  align = "left",
  marker,
  children,
}: {
  /** portrait: a numbered balloon at the anchor, keyed to the label, instead of a leader */
  marker?: string;
  anchor: string;
  at: [number, number] | ((a: { x: number; y: number }) => [number, number]);
  prog: Prog;
  index: number;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  const path = useRef<SVGPathElement>(null);
  const dot = useRef<SVGCircleElement>(null);
  const label = useRef<HTMLDivElement>(null);
  const balloon = useRef<HTMLDivElement>(null);
  const len = useRef(0);

  useFrame(() => {
    const a = frame.anchors.get(anchor);
    const p = clamp01(prog.current[index] ?? 0);
    const el = path.current, d = dot.current, lb = label.current;
    if (!el || !d || !lb) return;
    if (!a || !a.v || p <= 0) {
      el.style.opacity = "0";
      d.style.opacity = "0";
      lb.style.opacity = "0";
      return;
    }
    const W = frame.viewport.w, H = frame.viewport.h;
    const [fx, fy] = typeof at === "function" ? at(a) : at;
    let lx = fx * W;
    const ly = fy * H;
    const useBalloon = !!marker && frame.viewport.portrait;
    if (balloon.current) {
      balloon.current.style.opacity = useBalloon ? String(clamp01(p * 3)) : "0";
      balloon.current.style.transform = `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
    }
    if (useBalloon) {
      el.style.opacity = "0";
      d.style.opacity = "0";
      const lp = clamp01((p - 0.3) / 0.7);
      lb.style.opacity = "1";
      lb.style.transform = `translate3d(${lx.toFixed(1)}px, ${(ly - lb.offsetHeight).toFixed(1)}px, 0)`;
      lb.style.clipPath = `inset(${(1 - lp) * 100}% 0 0 0)`;
      return;
    }
    // the label sits on top of a horizontal run that is as long as the label
    const lw = lb.offsetWidth, lh = lb.offsetHeight;
    const dir = align === "right" ? -1 : 1;
    const margin = 24;
    // keep clear of the scene rail on the right edge
    const right = frame.viewport.portrait ? margin : 132;
    if (dir > 0 && lx + lw > W - right) lx = W - right - lw;
    if (dir < 0 && lx - lw < margin) lx = margin + lw;
    const dy = ly - a.y;
    const toward = lx >= a.x ? 1 : -1;
    let ex = a.x + toward * Math.abs(dy);
    if ((toward > 0 && ex > lx) || (toward < 0 && ex < lx)) ex = lx;
    const end = lx + dir * lw;
    const dpath = `M${a.x.toFixed(1)},${a.y.toFixed(1)} L${ex.toFixed(1)},${ly.toFixed(1)} L${lx.toFixed(1)},${ly.toFixed(1)} L${end.toFixed(1)},${ly.toFixed(1)}`;
    el.setAttribute("d", dpath);
    const L = Math.hypot(ex - a.x, ly - a.y) + Math.abs(lx - ex) + lw;
    len.current = L;
    el.style.strokeDasharray = `${L} ${L}`;
    el.style.strokeDashoffset = `${L * (1 - clamp01(p * 1.6))}`;
    el.style.opacity = "1";
    d.setAttribute("cx", a.x.toFixed(1));
    d.setAttribute("cy", a.y.toFixed(1));
    d.style.opacity = String(clamp01(p * 4));
    const lp = clamp01((p - 0.45) / 0.55);
    lb.style.opacity = "1";
    const left = dir > 0 ? lx : lx - lw;
    lb.style.transform = `translate3d(${left.toFixed(1)}px, ${(ly - lh - 5).toFixed(1)}px, 0)`;
    lb.style.clipPath = `inset(${(1 - lp) * 100}% 0 0 0)`;
  });

  return (
    <>
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        <path ref={path} className="hair" style={{ opacity: 0 }} />
        <circle ref={dot} r={3} className="hair" style={{ opacity: 0 }} />
      </svg>
      <div ref={label} className="absolute left-0 top-0 whitespace-nowrap" style={{ opacity: 0 }}>
        {children}
      </div>
      {marker && (
        <div
          ref={balloon}
          className="absolute left-0 top-0 grid h-[17px] w-[17px] place-items-center rounded-full border border-bone/80 bg-void/60 font-mono text-[9px] leading-none text-bone"
          style={{ opacity: 0, borderRadius: "999px" }}
        >
          {marker}
        </div>
      )}
    </>
  );
}

/** A dimension line between two anchors, offset perpendicular by `offset` px. */
export function DimLine({
  from,
  to,
  offset,
  prog,
  index,
  label,
  vertical,
  portraitHidden,
}: {
  portraitHidden?: boolean;
  from: string;
  to: string;
  offset: number;
  prog: Prog;
  index: number;
  label: React.ReactNode;
  vertical?: boolean;
}) {
  const g = useRef<SVGGElement>(null);
  const main = useRef<SVGLineElement>(null);
  const t1 = useRef<SVGLineElement>(null);
  const t2 = useRef<SVGLineElement>(null);
  const lb = useRef<HTMLDivElement>(null);

  useFrame(() => {
    const a = frame.anchors.get(from), b = frame.anchors.get(to);
    const p = clamp01(prog.current[index] ?? 0);
    if (!g.current || !main.current || !t1.current || !t2.current || !lb.current) return;
    if (!a || !b || !a.v || !b.v || p <= 0 || (portraitHidden && frame.viewport.portrait)) {
      g.current.style.opacity = "0";
      lb.current.style.opacity = "0";
      return;
    }
    let ax = a.x, ay = a.y, bx = b.x, by = b.y;
    if (vertical) {
      // measured vertically: project both ends onto a common x
      bx = ax;
    } else {
      by = ay;
    }
    const dx = bx - ax, dy = by - ay;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    ax += nx * offset; ay += ny * offset; bx += nx * offset; by += ny * offset;
    const mx = ax + (bx - ax) * 0.5, my = ay + (by - ay) * 0.5;
    const e = clamp01(p * 1.4);
    // draws outward from the centre, like a dimension being set
    const sx = mx + (ax - mx) * e, sy = my + (ay - my) * e;
    const ex = mx + (bx - mx) * e, ey = my + (by - my) * e;
    main.current.setAttribute("x1", sx.toFixed(1));
    main.current.setAttribute("y1", sy.toFixed(1));
    main.current.setAttribute("x2", ex.toFixed(1));
    main.current.setAttribute("y2", ey.toFixed(1));
    const tk = 7;
    const tickOn = e > 0.98 ? 1 : 0;
    t1.current.setAttribute("x1", (ax - nx * tk).toFixed(1));
    t1.current.setAttribute("y1", (ay - ny * tk).toFixed(1));
    t1.current.setAttribute("x2", (ax + nx * tk).toFixed(1));
    t1.current.setAttribute("y2", (ay + ny * tk).toFixed(1));
    t2.current.setAttribute("x1", (bx - nx * tk).toFixed(1));
    t2.current.setAttribute("y1", (by - ny * tk).toFixed(1));
    t2.current.setAttribute("x2", (bx + nx * tk).toFixed(1));
    t2.current.setAttribute("y2", (by + ny * tk).toFixed(1));
    t1.current.style.opacity = String(tickOn);
    t2.current.style.opacity = String(tickOn);
    g.current.style.opacity = "1";
    const lp = clamp01((p - 0.55) / 0.45);
    lb.current.style.opacity = String(lp);
    const ox = vertical ? -12 : 0, oy = vertical ? 0 : 10;
    lb.current.style.transform = vertical
      ? `translate3d(${(mx + ox).toFixed(1)}px, ${my.toFixed(1)}px, 0) translate(-100%, -50%) rotate(-90deg) translate(50%, 0)`
      : `translate3d(${mx.toFixed(1)}px, ${(my + oy).toFixed(1)}px, 0) translate(-50%, 0)`;
  });

  return (
    <>
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        <g ref={g} style={{ opacity: 0 }}>
          <line ref={main} className="hair" />
          <line ref={t1} className="hair" />
          <line ref={t2} className="hair" />
        </g>
      </svg>
      <div ref={lb} className="absolute left-0 top-0 whitespace-nowrap t-mono text-alloy" style={{ opacity: 0, transformOrigin: "0 50%" }}>
        {label}
      </div>
    </>
  );
}
