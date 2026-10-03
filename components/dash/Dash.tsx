"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { dash as dashContent, type RideMode } from "@/lib/content";
import { frame } from "@/lib/frame";
import { useFrame } from "@/lib/hooks";
import { useVanta, vanta, type DashParam } from "@/lib/store";
import { sound } from "@/lib/audio/Sound";

// The R1's TFT, as embedded vehicle software rather than a web dashboard. It is mapped
// onto the 3D screen's four projected corners with a homography, so it sits in the
// machine. Changing a setting changes the machine: posture, DRL, telemetry.

const W = 880, H = 400;
const SEGMENTS = 44;
const REDLINE = 15200;
const SHIFT_AT = 13800;
const PARAMS: DashParam[] = ["mode", "tc", "eb", "sus"];
const RANGE = { tc: [0, 8], eb: [1, 3], sus: [1, 3] } as const;

/** projective map from the dash rectangle to the screen quad (Heckbert) */
function quadMatrix(q: Float32Array) {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let a, b, c, d, e, f, g, h;
  if (Math.abs(dx3) < 1e-6 && Math.abs(dy3) < 1e-6) {
    a = x1 - x0; b = x3 - x0; c = x0; d = y1 - y0; e = y3 - y0; f = y0; g = 0; h = 0;
  } else {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / den;
    h = (dx1 * dy3 - dx3 * dy1) / den;
    a = x1 - x0 + g * x1; b = x3 - x0 + h * x3; c = x0;
    d = y1 - y0 + g * y1; e = y3 - y0 + h * y3; f = y0;
  }
  return `matrix3d(${a / W},${d / W},0,${g / W},${b / H},${e / H},0,${h / H},0,0,1,0,${c},${f},0,1)`;
}

// ---------- graph curves (normalised 0..1 points, 48 samples)
const N = 48;
function curve(param: DashParam, ride: { mode: RideMode; tc: number; eb: number; sus: number }): number[] {
  const out: number[] = [];
  for (let i = 0; i < N; i++) {
    const x = i / (N - 1);
    let y = 0;
    if (param === "mode") {
      const peak = { RACE: 1, TRACK: 1, ROAD: 0.92, WET: 0.7 }[ride.mode];
      const early = ride.mode === "RACE" ? 1.15 : ride.mode === "WET" ? 0.7 : 1;
      y = peak * Math.pow(Math.sin(Math.min(1, x * 1.08) * Math.PI * 0.62), 1.2 / early) * (1 - Math.max(0, x - 0.86) * 1.6);
    } else if (param === "tc") {
      // wheel slip trace; the controller clips everything above its threshold
      const raw = 0.25 + 0.35 * Math.abs(Math.sin(x * 9.3)) * Math.sin(x * 3.1 + 0.4) + 0.38 * Math.exp(-((x - 0.62) ** 2) / 0.004);
      const thr = 1 - (ride.tc / 8) * 0.62;
      y = ride.tc === 0 ? raw : Math.min(raw, thr);
    } else if (param === "eb") {
      // engine braking torque vs rpm, shallower at higher settings
      const k = { 1: 1, 2: 0.66, 3: 0.38 }[ride.eb as 1 | 2 | 3];
      y = Math.min(1, Math.pow(x, 1.3) * k * 1.1);
    } else {
      // damping force vs shaft velocity: A1 firm, A3 compliant
      const k = { 1: 1, 2: 0.74, 3: 0.52 }[ride.sus as 1 | 2 | 3];
      y = Math.min(1, (1 - Math.exp(-x * 4.2)) * k + x * 0.15 * k);
    }
    out.push(Math.max(0, Math.min(1, y)));
  }
  return out;
}

const GRAPH_LABEL: Record<DashParam, [string, string]> = {
  mode: ["TORQUE", "RPM"],
  tc: ["REAR SLIP", "TIME"],
  eb: ["ENGINE BRAKING", "RPM"],
  sus: ["DAMPING FORCE", "SHAFT VELOCITY"],
};

export function Dash() {
  const ride = useVanta((s) => s.ride);
  const holder = useRef<HTMLDivElement>(null);
  const segs = useRef<HTMLDivElement>(null);
  const rpmText = useRef<HTMLSpanElement>(null);
  const graphPath = useRef<SVGPathElement>(null);
  const thrLine = useRef<SVGLineElement>(null);
  const glare = useRef<HTMLDivElement>(null);
  const pts = useRef<number[]>(curve(ride.focus, ride));
  const blip = useRef({ rpm: 0 });
  const [announce, setAnnounce] = useState("");

  // morph the graph and blip the revs whenever a setting changes
  useEffect(() => {
    const target = curve(ride.focus, ride);
    const obj = { t: 0 };
    const from = pts.current.slice();
    const tw = gsap.to(obj, {
      t: 1,
      duration: 0.6,
      ease: "expo.out",
      onUpdate: () => {
        pts.current = from.map((v, i) => v + (target[i] - v) * obj.t);
      },
    });
    return () => {
      tw.kill();
    };
  }, [ride]);

  useFrame(() => {
    const el = holder.current;
    if (!el) return;
    const on = frame.scene.index === 5 && frame.dashQuadValid;
    el.style.visibility = on ? "visible" : "hidden";
    if (!on) return;
    el.style.transform = quadMatrix(frame.dashQuad);

    // idle with a little life, plus any blip from a mode change
    const idle = 1400 + Math.sin(frame.time * 7.3) * 18 + Math.sin(frame.time * 2.1) * 12;
    const rpm = Math.max(idle, blip.current.rpm);
    const lit = Math.round((rpm / REDLINE) * SEGMENTS);
    const s = segs.current;
    if (s) {
      for (let i = 0; i < SEGMENTS; i++) {
        const seg = s.children[i] as HTMLElement;
        const on = i < lit;
        const shift = ((i + 1) / SEGMENTS) * REDLINE >= SHIFT_AT;
        seg.style.opacity = on ? "1" : "0.16";
        seg.style.background = shift ? "var(--signal)" : "var(--bone)";
      }
    }
    if (rpmText.current) rpmText.current.textContent = (Math.round(rpm / 10) * 10).toLocaleString("en-US");

    // graph
    if (graphPath.current) {
      const gw = 360, gh = 96;
      let d = "";
      pts.current.forEach((v, i) => {
        const x = (i / (N - 1)) * gw;
        const y = gh - v * gh;
        d += `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
      });
      graphPath.current.setAttribute("d", d);
    }
    if (thrLine.current) {
      const r = vanta.getState().ride;
      const show = r.focus === "tc" && r.tc > 0;
      const y = 96 - (1 - (r.tc / 8) * 0.62) * 96;
      thrLine.current.setAttribute("y1", y.toFixed(1));
      thrLine.current.setAttribute("y2", y.toFixed(1));
      thrLine.current.style.opacity = show ? "1" : "0";
    }
    if (glare.current) {
      glare.current.style.transform = `translate3d(${(frame.pointer.sx * 120).toFixed(1)}px, 0, 0) skewX(-18deg)`;
    }
  });

  // ---------- interaction
  const act = useMemo(
    () => ({
      focus(p: DashParam, quiet = false) {
        if (vanta.getState().ride.focus === p) return;
        vanta.getState().setRide({ focus: p });
        if (!quiet) sound.click(0.5);
      },
      step(dir: 1 | -1) {
        const r = vanta.getState().ride;
        if (r.focus === "mode") {
          const modes = dashContent.modes;
          const i = (modes.indexOf(r.mode) + (dir > 0 ? 1 : modes.length - 1)) % modes.length;
          vanta.getState().applyMode(modes[i]);
          // a blip of the throttle when the map changes, as the real ECU does on a mode swap
          gsap.killTweensOf(blip.current);
          gsap
            .timeline()
            .to(blip.current, { rpm: 12600, duration: 0.22, ease: "power3.out" })
            .to(blip.current, { rpm: 0, duration: 0.9, ease: "power2.in" });
          setAnnounce(`Ride mode ${modes[i]}`);
        } else {
          const [lo, hi] = RANGE[r.focus];
          const v = Math.max(lo, Math.min(hi, r[r.focus] + dir));
          vanta.getState().setRide({ [r.focus]: v });
          setAnnounce(`${labelFor(r.focus)} ${r.focus === "sus" ? "A" : ""}${v}`);
        }
        sound.click(dir > 0 ? 0.9 : 0.75);
      },
      next(dir: 1 | -1) {
        const r = vanta.getState().ride;
        const i = (PARAMS.indexOf(r.focus) + (dir > 0 ? 1 : PARAMS.length - 1)) % PARAMS.length;
        vanta.getState().setRide({ focus: PARAMS[i] });
        sound.click(0.6);
      },
    }),
    [],
  );

  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key;
    if (k === "ArrowUp") act.step(1);
    else if (k === "ArrowDown") act.step(-1);
    else if (k === "ArrowRight") act.next(1);
    else if (k === "ArrowLeft") act.next(-1);
    else if (k.toLowerCase() === "m") {
      act.focus("mode");
      act.step(1);
    } else return;
    e.preventDefault();
  };

  const preset = dashContent.presets[ride.mode];

  return (
    <>
      <div
        ref={holder}
        className="interactive absolute left-0 top-0 origin-top-left select-none"
        style={{ width: W, height: H, visibility: "hidden" }}
        role="group"
        aria-label="Instrument display. Arrow keys change the selected setting."
        onKeyDown={onKey}
      >
        <div className="relative h-full w-full overflow-hidden bg-[#040506] text-bone">
          {/* LCD pixel grid */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.22] [background-image:linear-gradient(rgba(0,0,0,0.9)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.9)_1px,transparent_1px)] [background-size:3px_3px]" />

          {/* rev bar */}
          <div ref={segs} className="absolute left-[28px] right-[28px] top-[24px] flex h-[22px] gap-[4px]">
            {Array.from({ length: SEGMENTS }, (_, i) => (
              <div key={i} className="h-full flex-1" style={{ transform: `scaleY(${0.45 + (i / SEGMENTS) * 0.55})`, transformOrigin: "bottom" }} />
            ))}
          </div>
          <div className="absolute left-[28px] right-[28px] top-[52px] flex justify-between font-mono text-[11px] tracking-[0.05em] text-ash [font-stretch:80%]">
            {[0, 3, 6, 9, 12, 15].map((k) => (
              <span key={k}>{k}</span>
            ))}
          </div>

          {/* mode block */}
          <div className="absolute left-[28px] top-[94px]">
            <div className="font-mono text-[11px] tracking-[0.08em] text-ash [font-stretch:80%]">MODE</div>
            <button
              type="button"
              onClick={() => act.focus("mode")}
              onFocus={() => act.focus("mode", true)}
              aria-pressed={ride.focus === "mode"}
              aria-label={`Ride mode ${ride.mode}`}
              className={`mt-1 px-2 py-0.5 -ml-2 font-display text-[54px] font-[780] leading-none tracking-[-0.03em] [font-stretch:118%] ${ride.focus === "mode" ? "bg-bone text-void" : "text-bone"}`}
            >
              {ride.mode}
            </button>
            <div className="mt-3 font-mono text-[12px] tracking-[0.06em] text-alloy [font-stretch:80%]">MAP {preset.map}</div>
          </div>

          {/* gear */}
          <div className="absolute left-1/2 top-[86px] -translate-x-1/2 text-center">
            <div className="font-display text-[150px] font-[860] leading-[0.8] [font-stretch:125%]">N</div>
            <div className="mt-3 flex items-baseline justify-center gap-2 font-mono text-[12px] text-ash [font-stretch:80%]">
              <span ref={rpmText} className="text-[16px] text-bone tabular-nums">1,400</span> RPM
            </div>
          </div>

          {/* parameters */}
          <div className="absolute right-[28px] top-[94px] w-[176px] space-y-[6px]">
            {(["tc", "eb", "sus"] as const).map((p) => {
              const v = ride[p];
              const max = RANGE[p][1];
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => act.focus(p)}
                  onFocus={() => act.focus(p, true)}
                  aria-pressed={ride.focus === p}
                  aria-label={`${labelFor(p)} ${p === "sus" ? "A" : ""}${v} of ${p === "sus" ? "A" : ""}${max}`}
                  className={`flex w-full items-center justify-between px-2 py-1.5 font-mono text-[14px] tracking-[0.05em] [font-stretch:80%] ${ride.focus === p ? "bg-bone text-void" : "text-bone"}`}
                >
                  <span className={ride.focus === p ? "text-void" : "text-ash"}>{p === "tc" ? "TC" : p === "eb" ? "EB" : "SUS"}</span>
                  <span className="flex items-center gap-[3px]">
                    {Array.from({ length: max - RANGE[p][0] + 1 }, (_, k) => (
                      <span key={k} className="block h-[10px] w-[5px]" style={{ background: "currentColor", opacity: k + RANGE[p][0] <= v ? 1 : 0.2 }} />
                    ))}
                    <span className="ml-2 w-[22px] text-right tabular-nums">{p === "sus" ? `A${v}` : v}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* graph */}
          <div className="absolute bottom-[26px] left-[28px] right-[28px] flex items-end justify-between">
            <div>
              <div className="font-mono text-[11px] tracking-[0.08em] text-ash [font-stretch:80%]">{GRAPH_LABEL[ride.focus][0]}</div>
              <svg width={360} height={96} className="mt-2 overflow-visible" aria-hidden="true">
                <line x1={0} y1={96} x2={360} y2={96} stroke="rgba(196,200,206,0.25)" />
                {[0.25, 0.5, 0.75].map((k) => (
                  <line key={k} x1={k * 360} y1={0} x2={k * 360} y2={96} stroke="rgba(196,200,206,0.08)" />
                ))}
                <line ref={thrLine} x1={0} x2={360} stroke="var(--signal)" strokeDasharray="4 4" />
                <path ref={graphPath} fill="none" stroke="var(--bone)" strokeWidth={1.6} />
              </svg>
              <div className="mt-1 font-mono text-[10px] tracking-[0.08em] text-ash [font-stretch:80%]">{GRAPH_LABEL[ride.focus][1]}</div>
            </div>
            <div className="text-right font-mono text-[12px] leading-[1.7] tracking-[0.06em] text-alloy [font-stretch:80%]">
              <div>
                <span className="text-ash">SPEED</span> 0 KM/H
              </div>
              <div>
                <span className="text-ash">SUS</span> A{ride.sus} <span className="text-ash">SAG</span> {[0, 31, 34, 38][ride.sus]} MM
              </div>
            </div>
          </div>

          {/* smoked glass reflection, follows the pointer */}
          <div ref={glare} className="pointer-events-none absolute -inset-y-10 left-[30%] w-[22%] bg-gradient-to-r from-transparent via-white/[0.045] to-transparent" />
        </div>
      </div>
      <div className="sr-only" aria-live="polite">
        {announce}
      </div>
      <Switchgear act={act} />
    </>
  );
}

function labelFor(p: DashParam) {
  return p === "tc" ? "Traction control" : p === "eb" ? "Engine braking" : p === "sus" ? "Suspension" : "Ride mode";
}

function Switchgear({ act }: { act: { step(d: 1 | -1): void; next(d: 1 | -1): void; focus(p: DashParam, quiet?: boolean): void } }) {
  const btn =
    "grid h-12 min-w-12 place-items-center border border-bone/25 bg-void/70 px-3 t-mono text-bone transition-[transform,border-color] duration-150 hover:border-bone active:translate-y-px";
  return (
    <div
      className="interactive absolute bottom-[8svh] left-[var(--gutter)] max-md:bottom-[5svh] max-md:left-1/2 max-md:-translate-x-1/2"
      role="toolbar"
      aria-label="Switchgear"
    >
      <div className="mb-3 t-mono text-ash max-md:text-center">SWITCHGEAR</div>
      <div className="flex gap-2">
        <button type="button" className={btn} onClick={() => act.next(-1)} aria-label="Previous setting">
          ◂
        </button>
        <button type="button" className={btn} onClick={() => act.step(-1)} aria-label="Decrease">
          −
        </button>
        <button type="button" className={btn} onClick={() => act.step(1)} aria-label="Increase">
          +
        </button>
        <button type="button" className={btn} onClick={() => act.next(1)} aria-label="Next setting">
          ▸
        </button>
        <button type="button" className={`${btn} ml-3`} onClick={() => {
            act.focus("mode");
            act.step(1);
          }}>
          MODE
        </button>
      </div>
    </div>
  );
}
