"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useVanta, vanta, type LoadStepId } from "@/lib/store";
import { Wordmark } from "./Wordmark";

const STEPS: { id: LoadStepId; label: string }[] = [
  { id: "geometry", label: "GEOMETRY" },
  { id: "materials", label: "MATERIALS" },
  { id: "telemetry", label: "TELEMETRY" },
  { id: "aerodynamics", label: "AERODYNAMICS" },
];

const pad3 = (n: number) => String(Math.round(n)).padStart(3, "0");

/**
 * System initialisation. Every line reports real work done by the engine (parts built,
 * vertices, shader programs compiled, particles allocated). On READY the loader is
 * consumed by darkness and the smoke is already there underneath.
 */
export function Loader() {
  const steps = useVanta((s) => s.steps);
  const phase = useVanta((s) => s.phase);
  const webgl = useVanta((s) => s.webgl);
  const [gone, setGone] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const started = useRef(0);

  useEffect(() => {
    started.current = performance.now();
  }, []);

  const total = STEPS.reduce((a, s) => a + steps[s.id].p, 0) / STEPS.length;

  useEffect(() => {
    if (phase !== "ready" && !(phase === "entered" && webgl === "failed")) return;
    const el = root.current;
    if (!el) return;
    const reduced = vanta.getState().reducedMotion;
    // hold READY for a beat so it registers, then hand over to the smoke
    const wait = Math.max(0, 900 - (performance.now() - started.current));
    const tl = gsap.timeline({
      delay: wait / 1000 + 0.35,
      onComplete: () => {
        vanta.setState({ phase: "entered" });
        setGone(true);
      },
    });
    if (reduced) {
      tl.to(el, { opacity: 0, duration: 0.3 });
    } else {
      tl.to(el.querySelectorAll(".ld-line > span"), { yPercent: -110, duration: 0.7, ease: "power3.in", stagger: 0.05 })
        .to(el.querySelector(".ld-total"), { yPercent: 105, duration: 0.9, ease: "power3.in" }, 0)
        .to(el.querySelector(".ld-head > span"), { yPercent: -110, duration: 0.6, ease: "power3.in" }, 0.1)
        .to(el, { opacity: 0, duration: 1.1, ease: "power1.inOut" }, 0.55);
    }
    return () => {
      tl.kill();
    };
  }, [phase, webgl]);

  if (gone) return null;

  return (
    <div
      ref={root}
      className="loader-root fixed inset-0 bg-void"
      style={{ zIndex: "var(--z-loader)" as unknown as number }}
      role="status"
      aria-live="polite"
      aria-label={`Loading ${Math.round(total * 100)} percent`}
    >
      {/* sits exactly where the HUD wordmark appears, so the handoff has no seam */}
      <Wordmark className="absolute left-[var(--gutter)] top-[26px] h-[13px] w-auto text-bone" />
      <div className="absolute left-[var(--gutter)] top-[42svh] w-[min(560px,calc(100vw-2*var(--gutter)))]">
        <div className="ld-head mask-line t-mono text-ash mb-7">
          <span>SYSTEM INITIALIZATION</span>
        </div>
        {STEPS.map((s) => {
          const st = steps[s.id];
          return (
            <div key={s.id} className="ld-line mask-line mb-3">
              <span className="block">
                <span className="grid grid-cols-[112px_1fr_40px] items-baseline gap-3 t-mono">
                  <span className={st.p >= 1 ? "text-bone" : "text-ash"}>{s.label}</span>
                  <span className="text-ash truncate">{st.detail}</span>
                  <span className="text-right text-bone tabular-nums">{pad3(st.p * 100)}</span>
                </span>
                <span
                  className="mt-2 block h-px bg-bone/70 origin-left"
                  style={{ transform: `scaleX(${st.p})`, transition: "transform 380ms var(--ease-out)" }}
                />
              </span>
            </div>
          );
        })}
        <div className="ld-line mask-line mt-6 t-mono">
          <span className={total >= 0.999 ? "text-signal" : "text-transparent"}>READY</span>
        </div>
      </div>

      <div className="absolute bottom-0 right-[calc(var(--gutter)*-0.4)] overflow-clip">
        <div className="ld-total t-numeral text-[clamp(120px,24vw,380px)] text-bone/[0.08] leading-[0.74] translate-y-[8%] select-none" aria-hidden="true">
          {pad3(total * 100)}
        </div>
      </div>
    </div>
  );
}
