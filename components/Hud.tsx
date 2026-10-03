"use client";

import { useRef } from "react";
import { Wordmark } from "./Wordmark";
import { SCENES } from "@/lib/scenes";
import { frame } from "@/lib/frame";
import { useFrame } from "@/lib/hooks";
import { useVanta, vanta } from "@/lib/store";
import { directorRef } from "@/lib/timelines";
import { sound } from "@/lib/audio/Sound";
import { final } from "@/lib/content";

// Fixed instrumentation: wordmark, sound, allocation, a scene rail that is real
// navigation, and one line of telemetry that reports the engine's actual state.

export function Hud() {
  const phase = useVanta((s) => s.phase);
  const active = useVanta((s) => s.activeScene);
  const soundOn = useVanta((s) => s.sound);
  const tele = useRef<HTMLDivElement>(null);
  const last = useRef("");

  useFrame(() => {
    sound.update();
    const el = tele.current;
    if (!el || frame.telemetry === last.current) return;
    last.current = frame.telemetry;
    el.textContent = frame.telemetry;
  });

  const visible = phase === "entered";
  const toggleSound = () => {
    const next = !vanta.getState().sound;
    if (next) sound.enable();
    else sound.disable();
    vanta.setState({ sound: next });
    if (next) sound.click(1);
  };

  return (
    <div data-hud className={`transition-opacity duration-700 ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`} style={{ position: "relative", zIndex: "var(--z-hud)" as unknown as number }}>
      <a
        href="#final"
        className="sr-only focus:not-sr-only focus:fixed focus:left-[var(--gutter)] focus:top-14 focus:z-10 focus:bg-bone focus:px-3 focus:py-2 focus:text-void t-mono"
        onClick={(e) => {
          e.preventDefault();
          directorRef.current?.scrollToT(9.3, true);
          setTimeout(() => (document.querySelector("#final button") as HTMLButtonElement | null)?.focus(), 60);
        }}
      >
        Skip to allocation
      </a>

      <header className="fixed inset-x-0 top-0 flex items-start justify-between px-[var(--gutter)] pt-[22px]">
        <a
          href="#reveal"
          aria-label="VANTA, back to the start"
          onClick={(e) => {
            e.preventDefault();
            directorRef.current?.scrollToT(0);
          }}
          className="block py-1"
        >
          <Wordmark className="h-[13px] w-auto text-bone" />
        </a>
        <div className="flex items-center gap-7 max-md:gap-4">
          <button type="button" onClick={toggleSound} aria-pressed={soundOn} className="t-mono text-ash hover:text-bone py-1">
            SOUND <span className={soundOn ? "text-bone" : ""}>{soundOn ? "ON" : "OFF"}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              sound.click(0.8);
              vanta.setState({ dialog: "allocation" });
            }}
            className="t-mono text-bone py-1 max-md:hidden"
          >
            {final.primary}
          </button>
        </div>
      </header>

      <nav aria-label="Scenes" className="fixed right-[calc(var(--gutter)*0.55)] top-1/2 -translate-y-1/2 max-md:hidden">
        <ol className="flex flex-col items-end gap-[9px]">
          {SCENES.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                aria-label={`Go to ${s.name}`}
                aria-current={active === i ? "step" : undefined}
                onClick={() => directorRef.current?.scrollToScene(i)}
                className="group flex items-center gap-3 py-[3px]"
              >
                <span className={`t-mono transition-opacity duration-300 ${active === i ? "text-bone opacity-100" : "text-ash opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}>
                  {s.name.toUpperCase()}
                </span>
                <span className={`block h-px transition-[width,background-color] duration-500 ${active === i ? "w-7 bg-bone" : "w-3 bg-ash/60 group-hover:bg-bone"}`} />
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div ref={tele} aria-hidden="true" className="fixed bottom-[20px] left-[var(--gutter)] t-mono text-ash whitespace-pre" />
    </div>
  );
}
