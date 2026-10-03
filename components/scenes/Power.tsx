"use client";

import { useEffect, useRef } from "react";
import { SceneSection } from "../SceneSection";
import { power } from "@/lib/content";
import { frame } from "@/lib/frame";
import { useFrame, useSceneTimeline } from "@/lib/hooks";
import { vanta } from "@/lib/store";

// SCENE 05. The engine alone, sectioned. Above the trace sits the live RPM; the trace
// itself is a crank-angle oscilloscope of the four cylinder pressures (twin-pulse firing:
// 0°, 90°, 290°, 380°), swept by a cursor whose speed follows the RPM.

const FIRING = [0, 90, 290, 380];

function pressure(theta: number, fire: number) {
  // theta, fire in degrees on a 720° cycle; compression rise then combustion peak
  let d = (((theta - fire) % 720) + 720) % 720;
  if (d > 360) d -= 720;
  const comp = Math.exp(-((d + 8) * (d + 8)) / (2 * 55 * 55)) * 0.35;
  const burn = d > -6 ? Math.exp(-((d - 14) * (d - 14)) / (2 * 22 * 22)) : 0;
  return comp + burn * 0.85;
}

function Trace() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const sweep = useRef(0);

  useEffect(() => {
    const c = canvas.current!;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(c.clientWidth * dpr);
      c.height = Math.round(c.clientHeight * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  useFrame((dt) => {
    if (frame.scene.index !== 4) return;
    const c = canvas.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    const W = c.width, H = c.height;
    const rpm = frame.live.rpm;
    // sweep rate follows RPM (capped so it stays legible)
    if (!vanta.getState().reducedMotion) sweep.current = (sweep.current + dt * (0.12 + (rpm / power.redline) * 1.6)) % 1;
    else sweep.current = 0.62;
    const load = 0.45 + (rpm / power.redline) * 0.55;
    g.clearRect(0, 0, W, H);

    // measurement grid: 90° divisions
    g.strokeStyle = "rgba(196,200,206,0.09)";
    g.lineWidth = 1;
    for (let k = 0; k <= 16; k++) {
      const x = Math.round((k / 16) * W) + 0.5;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(0, H - 0.5);
    g.lineTo(W, H - 0.5);
    g.stroke();

    const cur = sweep.current * W;
    const N = Math.min(900, W);
    for (let cyl = 0; cyl < 4; cyl++) {
      g.beginPath();
      for (let i = 0; i <= N; i++) {
        const x = (i / N) * W;
        const theta = (i / N) * 1440;
        const p = pressure(theta, FIRING[cyl]) + pressure(theta, FIRING[cyl] + 720);
        const y = H - 2 - p * load * (H * 0.82);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      // phosphor: bright just behind the cursor, decaying with distance
      const grad = g.createLinearGradient(0, 0, W, 0);
      const s = sweep.current;
      const a = (x: number) => {
        let d = s - x;
        if (d < 0) d += 1;
        return Math.max(0.1, 0.85 * Math.exp(-d * 3.2));
      };
      for (let k = 0; k <= 10; k++) {
        const x = k / 10;
        grad.addColorStop(x, `rgba(231,228,222,${a(x).toFixed(3)})`);
      }
      g.strokeStyle = grad;
      g.lineWidth = Math.max(1, W / 1400);
      g.stroke();
    }
    // cursor
    g.fillStyle = "#e4572e";
    g.fillRect(Math.round(cur), 0, Math.max(1, W / 1200), H);
  });

  return <canvas ref={canvas} className="block h-full w-full" aria-hidden="true" />;
}

export function Power() {
  const rpmEl = useRef<HTMLSpanElement>(null);
  const last = useRef(-1);

  const root = useSceneTimeline(4, (tl) => {
    tl.to(".pw-in > span", { y: 0, yPercent: 0, duration: 0.1, stagger: 0.03, ease: "expo.out" }, 0.2);
    tl.to(".pw-spec", { clipPath: "inset(0 0% 0 0)", duration: 0.12, stagger: 0.02, ease: "power2.out" }, 0.28);
    tl.to(".pw-trace", { clipPath: "inset(0 0% 0 0)", duration: 0.2, ease: "power2.inOut" }, 0.24);
    tl.to(".pw-in > span", { yPercent: -110, duration: 0.05, stagger: 0.01, ease: "power2.in" }, 0.9);
    tl.to(".pw-spec, .pw-trace", { opacity: 0, duration: 0.05 }, 0.9);
  });

  useFrame(() => {
    if (frame.scene.index !== 4 || !rpmEl.current) return;
    const v = Math.round(frame.live.rpm / 10) * 10;
    if (v !== last.current) {
      last.current = v;
      rpmEl.current.textContent = v.toLocaleString("en-US");
      rpmEl.current.style.color = v >= 14800 ? "var(--signal)" : "";
    }
  });

  return (
    <SceneSection index={4} label="Power: 214 hp">
      <div ref={root as React.RefObject<HTMLDivElement>} className="absolute inset-0">
        <div className="absolute bottom-[25svh] left-[var(--gutter)] max-w-[40vw] max-md:bottom-[23svh] max-md:max-w-none max-md:right-[var(--gutter)]">
          <h2>
            <span className="sr-only">214 hp. </span>
            <span className="pw-in mask-line" aria-hidden="true">
              <span className="block from-below t-display text-[clamp(36px,4.2vw,80px)] text-bone">HP</span>
            </span>
            <span className="pw-in mask-line mt-3">
              <span className="block from-below t-statement text-[clamp(15px,1.3vw,22px)] text-alloy max-md:max-w-[56vw]">{power.line}</span>
            </span>
          </h2>
          <dl className="mt-9 grid grid-cols-2 gap-x-14 gap-y-2.5 max-md:mt-6 max-md:gap-x-6">
            {power.clusters.map((cluster, ci) => (
              <div key={ci} className="pw-spec space-y-2.5 [clip-path:inset(0_100%_0_0)]">
                {cluster.map((r) => (
                  <div key={r.label}>
                    <dt className="t-mono text-ash">{r.label}</dt>
                    <dd className="t-mono text-bone">{r.value}</dd>
                  </div>
                ))}
              </div>
            ))}
          </dl>
        </div>

        <div className="absolute right-[var(--gutter)] bottom-[25svh] text-right max-md:bottom-[calc(23svh+214px)]">
          <div className="pw-in mask-line">
            <span className="block from-below flex items-baseline justify-end gap-3">
              <span ref={rpmEl} className="font-mono text-[clamp(40px,4.4vw,80px)] font-[250] leading-none tracking-[-0.04em] text-bone [font-stretch:80%] tabular-nums">
                1,400
              </span>
              <span className="t-mono text-alloy">RPM</span>
            </span>
          </div>
          <div className="pw-in mask-line mt-3">
            <span className="block from-below t-mono text-ash max-md:hidden">{power.note}</span>
          </div>
        </div>

        <div className="pw-trace absolute bottom-[7svh] left-[var(--gutter)] right-[var(--gutter)] h-[13svh] [clip-path:inset(0_100%_0_0)]">
          <div className="absolute -top-6 left-0 t-mono text-ash">CYLINDER PRESSURE, 0-1440°</div>
          <Trace />
        </div>
      </div>
    </SceneSection>
  );
}
