// One RAF for the whole site: Lenis, the director, the engine and every DOM updater run
// from gsap's ticker in a fixed order. DOM updaters write straight to refs, never state.

type Fn = (dt: number) => void;

const updaters = new Set<Fn>();

export function onFrame(fn: Fn) {
  updaters.add(fn);
  return () => {
    updaters.delete(fn);
  };
}

export function runUpdaters(dt: number) {
  for (const fn of updaters) fn(dt);
}
