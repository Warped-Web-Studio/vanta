"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { frame } from "@/lib/frame";
import { vanta } from "@/lib/store";
import { Director } from "@/lib/director";
import { directorRef } from "@/lib/timelines";
import { runUpdaters } from "@/lib/ticker";
import type { Engine } from "@/lib/engine/Engine";

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}

/**
 * Client root. Owns the single RAF (gsap ticker), Lenis via the director, pointer input
 * and the WebGL engine, which is imported only after first paint.
 */
export function Experience({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const reduced = mq.matches || new URLSearchParams(location.search).has("reduced");
    vanta.setState({ reducedMotion: reduced, phase: "loading" });
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    // a fresh canvas per mount: a context that was force-lost on unmount cannot be reused
    const canvas = document.createElement("canvas");
    stageRef.current?.appendChild(canvas);

    const director = new Director(reduced);
    directorRef.current = director;
    let engine: Engine | null = null;
    let disposed = false;

    // ---------------- pointer
    const P = frame.pointer;
    let downAt = 0, downX = 0, downY = 0, lastT = performance.now();
    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      const w = window.innerWidth, h = window.innerHeight;
      const x = (e.clientX / w) * 2 - 1;
      const y = -((e.clientY / h) * 2 - 1);
      const dt = Math.max(1, now - lastT) / 1000;
      P.vx = (x - P.x) / dt;
      P.vy = (y - P.y) / dt;
      P.speed = Math.hypot(P.vx, P.vy);
      P.x = x;
      P.y = y;
      P.px = e.clientX;
      P.py = e.clientY;
      P.touch = e.pointerType === "touch";
      P.last = now;
      P.dirty = true;
      lastT = now;
    };
    const onDown = (e: PointerEvent) => {
      P.down = true;
      downAt = performance.now();
      downX = e.clientX;
      downY = e.clientY;
      onMove(e);
    };
    const onUp = (e: PointerEvent) => {
      P.down = false;
      const quick = performance.now() - downAt < 280;
      const still = Math.hypot(e.clientX - downX, e.clientY - downY) < 10;
      if (quick && still) P.tap = true;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });

    // ---------------- one ticker for everything
    gsap.ticker.lagSmoothing(0);
    const tick = (time: number, deltaMs: number) => {
      const dt = Math.min(deltaMs / 1000, 1 / 20);
      director.lenis.raf(time * 1000);
      director.update(dt);
      engine?.update(deltaMs);
      runUpdaters(dt);
    };
    gsap.ticker.add(tick);

    const onResize = () => {
      engine?.resize();
      director.measure();
    };
    window.addEventListener("resize", onResize);
    const onVis = () => {
      if (document.hidden) engine?.stop();
      else if (vanta.getState().phase === "entered") engine?.start();
    };
    document.addEventListener("visibilitychange", onVis);

    // keyboard focus landing in another scene takes the film there
    const onFocusIn = (e: FocusEvent) => {
      const sec = (e.target as HTMLElement | null)?.closest<HTMLElement>("section[data-scene]");
      if (!sec || sec.dataset.on === "1") return;
      const idx = Array.from(document.querySelectorAll("section[data-scene]")).indexOf(sec);
      if (idx >= 0) director.scrollToT(idx + (idx === 9 ? 0.6 : 0.5), true);
    };
    document.addEventListener("focusin", onFocusIn);

    // dialogs pause rendering
    const unsubDialog = vanta.subscribe((s, prev) => {
      if (s.dialog !== prev.dialog) {
        if (s.dialog) {
          engine?.stop();
          director.lenis.stop();
        } else {
          if (s.phase === "entered") engine?.start();
          director.lenis.start();
        }
      }
    });

    // ---------------- engine
    const boot = async () => {
      await document.fonts.ready;
      if (!webglAvailable()) {
        vanta.setState({ webgl: "failed", phase: "entered" });
        return;
      }
      try {
        const { Engine } = await import("@/lib/engine/Engine");
        if (disposed) return;
        vanta.getState().setStep("geometry", 0.04, "ENGINE MODULE");
        engine = new Engine(canvas);
        engine.resize();
        await engine.init((step, p, detail) => vanta.getState().setStep(step, p, detail));
        if (disposed) {
          engine.dispose();
          return;
        }
        canvas.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          vanta.setState({ webgl: "failed" });
          engine?.stop();
        });
        vanta.setState({ webgl: "ok", phase: "ready" });
        engine.start();
      } catch (err) {
        console.error(err);
        vanta.setState({ webgl: "failed", phase: "entered" });
      }
    };
    const raf = requestAnimationFrame(() => void boot());

    // dev hook for screenshot tooling
    if (new URLSearchParams(location.search).has("poster")) document.documentElement.dataset.poster = "1";
    (window as unknown as { __vanta: unknown }).__vanta = {
      go: (t: number) => director.scrollToT(t, true),
      goY: (y: number) => director.lenis.scrollTo(y, { immediate: true, force: true }),
      frame,
      state: () => vanta.getState(),
    };

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      gsap.ticker.remove(tick);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("focusin", onFocusIn);
      unsubDialog();
      director.destroy();
      directorRef.current = null;
      engine?.dispose();
      canvas.remove();
    };
  }, []);

  return (
    <>
      <div ref={stageRef} className="layer-stage" aria-hidden="true" />
      {children}
    </>
  );
}
