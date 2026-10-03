"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { SceneSection } from "../SceneSection";
import { materials } from "@/lib/content";
import { frame } from "@/lib/frame";
import { useVanta } from "@/lib/store";

// SCENE 07. Macro plates. The frames are empty in the DOM: the WebGL stage renders each
// material into its rectangle (lit by the pointer, racked into focus as it arrives).
// Almost no text: one functional caption per plate, outside the image.

const byId = Object.fromEntries(materials.map((m) => [m.id, m]));

function Plate({ id, className = "", captionSide = "right", bleed }: { id: string; className?: string; captionSide?: "left" | "right"; bleed?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const webgl = useVanta((s) => s.webgl);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    frame.plates.set(id, el);
    return () => {
      frame.plates.delete(id);
    };
  }, [id]);
  return (
    <figure className={`relative ${className}`}>
      <div ref={ref} className="plate absolute inset-0 overflow-hidden" role="img" aria-label={byId[id].caption.toLowerCase()} data-plate={id}>
        {webgl === "failed" && <Image src={`/posters/plate-${id}.jpg`} alt="" fill sizes="100vw" className="object-cover" />}
      </div>
      <figcaption
        className={`absolute top-full mt-4 t-mono text-ash ${
          captionSide === "right" ? (bleed ? "right-[var(--gutter)] text-right" : "right-0 text-right") : bleed ? "left-[var(--gutter)]" : "left-0"
        } max-md:left-[var(--gutter)] max-md:right-auto max-md:text-left`}
      >
        {byId[id].caption}
      </figcaption>
    </figure>
  );
}

export function Materials() {
  return (
    <SceneSection
      index={6}
      label="Material study"
      flow={
        <div className="flow relative">
          <h2 className="sr-only">Materials</h2>
          {/* carbon, full bleed */}
          <Plate id="carbon" className="h-[100svh] w-full" bleed />
          <div className="h-[22svh]" />

          {/* billet and switchgear: an offset diptych */}
          <div className="grid grid-cols-12 items-end gap-x-[var(--gutter)] px-[var(--gutter)] max-md:grid-cols-1 max-md:gap-y-[14svh] max-md:px-0">
            <Plate id="billet" className="col-span-7 h-[76svh] max-md:col-span-1 max-md:h-[58svh]" captionSide="left" />
            <Plate id="knurl" className="col-span-4 col-start-9 h-[44svh] translate-y-[16svh] max-md:col-span-1 max-md:col-start-1 max-md:h-[40svh] max-md:translate-y-0" />
          </div>
          <div className="h-[38svh] max-md:h-[18svh]" />

          {/* titanium weld: an ultra-wide strip in a lot of dark */}
          <Plate id="weld" className="h-[34svh] w-full max-md:h-[30svh]" captionSide="left" bleed />
          <div className="h-[34svh] max-md:h-[18svh]" />

          {/* disc, pushed against the right edge */}
          <div className="flex justify-end">
            <Plate id="disc" className="h-[70svh] w-[47vw] max-md:h-[56svh] max-md:w-full" captionSide="left" />
          </div>
          <div className="h-[30svh] max-md:h-[18svh]" />

          {/* microsuede, small, off-axis */}
          <div className="pl-[13vw] max-md:pl-0">
            <Plate id="suede" className="h-[52svh] w-[34vw] max-md:h-[46svh] max-md:w-full" />
          </div>
          <div className="h-[30svh] max-md:h-[18svh]" />

          {/* paint: holds full bleed, then smears into motion */}
          <div className="relative h-[230svh]">
            <div className="sticky top-0 h-[100svh]">
              <Plate id="paint" className="h-[86svh] w-full" bleed />
            </div>
          </div>
        </div>
      }
    >
      {null}
    </SceneSection>
  );
}
