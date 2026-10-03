import Lenis from "lenis";
import { frame } from "./frame";
import { vanta } from "./store";
import { SCENES } from "./scenes";
import { sceneTimelines } from "./timelines";

interface Section {
  el: HTMLElement;
  top: number;
  height: number;
  /** in-flow scenes end when their last content reaches the bottom of the viewport */
  flow: boolean;
}

/**
 * Maps scroll to the film. Each scene section is a scroll range; its stage is fixed and
 * only marked on while the scene is current, so the page never simply slides. Scene
 * timelines (DOM choreography) are scrubbed by the scene's local progress.
 */
export class Director {
  lenis: Lenis;
  private sections: Section[] = [];
  private current = -1;
  private lastY = 0;
  private ro: ResizeObserver;

  constructor(reduced: boolean) {
    this.lenis = new Lenis({
      lerp: reduced ? 1 : 0.075,
      smoothWheel: !reduced,
      wheelMultiplier: 0.85,
      touchMultiplier: 1,
      syncTouch: false,
      autoRaf: false,
    });
    this.ro = new ResizeObserver(() => this.measure());
    this.ro.observe(document.body);
    this.measure();
  }

  measure() {
    const els = Array.from(document.querySelectorAll<HTMLElement>("section[data-scene]"));
    const y = window.scrollY;
    this.sections = els.map((el) => {
      const r = el.getBoundingClientRect();
      return { el, top: r.top + y, height: r.height, flow: el.classList.contains("scene-flow") };
    });
  }

  /** scroll position (px) for a film time t */
  yFor(t: number) {
    const i = Math.max(0, Math.min(this.sections.length - 1, Math.floor(t)));
    const s = this.sections[i];
    if (!s) return 0;
    const local = t - i;
    const last = i === this.sections.length - 1;
    const span = last || s.flow ? Math.max(1, s.height - window.innerHeight) : s.height;
    return s.top + local * span;
  }

  scrollToT(t: number, immediate = false) {
    this.lenis.scrollTo(this.yFor(t), { immediate, duration: immediate ? 0 : 1.6, force: true });
  }

  scrollToScene(i: number) {
    this.scrollToT(i + (i === 0 ? 0 : 0.02));
  }

  update(dt: number) {
    const y = this.lenis.animatedScroll ?? window.scrollY;
    const vh = window.innerHeight;
    const v = (y - this.lastY) / Math.max(dt, 1 / 240);
    this.lastY = y;
    frame.scroll.y = y;
    frame.scroll.velocity = v;
    const e = Math.min(1, Math.abs(v) / (vh * 2.2));
    frame.scroll.energy += (e - frame.scroll.energy) * Math.min(1, dt * (e > frame.scroll.energy ? 6 : 2.2));

    let t = 0;
    const n = this.sections.length;
    for (let i = 0; i < n; i++) {
      const s = this.sections[i];
      const last = i === n - 1;
      const span = last || s.flow ? Math.max(1, s.height - vh) : s.height;
      if (y < s.top + span || last) {
        const local = Math.min(0.99999, Math.max(0, (y - s.top) / span));
        t = i + local;
        break;
      }
    }
    frame.scroll.t = t;
    const idx = Math.floor(t);
    const local = t - idx;
    frame.scene.index = idx;
    frame.scene.local = local;

    if (idx !== this.current) {
      // settle the timelines of the scene we left, at the end it was left from
      const prev = this.current;
      if (prev >= 0) {
        for (const tl of sceneTimelines.get(prev) ?? []) tl.progress(idx > prev ? 1 : 0);
        this.sections[prev]?.el.setAttribute("data-on", "0");
      }
      this.sections[idx]?.el.setAttribute("data-on", "1");
      this.current = idx;
      vanta.setState({ activeScene: idx });
      document.documentElement.dataset.activeScene = SCENES[idx]?.id ?? "";
    }
    for (const tl of sceneTimelines.get(idx) ?? []) tl.progress(local);
  }

  destroy() {
    this.ro.disconnect();
    this.lenis.destroy();
  }
}
