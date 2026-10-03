# VANTA / R1

A cinematic launch site for a fictional, 99-unit, $48,000 motorcycle. Next.js 16 (App Router), TypeScript, Tailwind v4, vanilla Three.js with custom GLSL, GSAP and Lenis.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build
```

Useful URL flags: `?debug` (frame rate, draw calls, tier), `?reduced` (forces reduced motion).

## How it works

- **One fixed WebGL stage** sits between two DOM layers. Giant type in `BackType` lives behind the transparent canvas, so the machine and the smoke occlude it. Scene copy, annotations and the dash sit above it.
- **Scroll is the timeline.** Each scene is a tall section with a fixed stage that is shown only while current (`lib/director.ts`). The engine evaluates `lib/engine/choreo/tracks.ts` as a pure function of scroll (scene index + local progress). Camera poses have desktop and portrait variants. Hard cuts and dissolves are timed rather than scroll-held, so a stopped scroll never sits on a black frame.
- **The R1 is procedural** (`lib/engine/bike/`): about 250 parts built from lofts, sweeps, lathes and extrusions in a faceted language, merged per system and material, hung on pivots for the exploded view, spinning wheels and engine kinematics.
- **Smoke** (`passes/FluidSim.ts`) is a stable-fluids solver advecting a concealment field. It has speed-dependent splats, vorticity, memory, edge-creeping reformation, and a GPU-measured "discovered" fraction that gates the hero copy.
- **Other passes:** jump-flood silhouette field with streamline particles (`AeroFlow`), speed environment with directional blur (`SpeedEnv`), scissor-rendered macro material plates with tilt-shift lens (`MaterialPlates`), contact shadow, bloom and an AgX composite.
- **Quality tiers and adaptive DPR** are in `lib/engine/Quality.ts`.
- **Fallbacks:** reduced motion holds one composition per scene. Without WebGL, stills in `public/posters/` stand in for the stage. Without JavaScript, the scenes lay out as a plain document.

## Swapping in real assets

- **Model:** set `product.glb` in `lib/content.ts` to a GLB in `/public`. Objects named like the procedural parts (`nose`, `tank`, `engine`, `wheelF` and the rest; see `lib/engine/bike/loadGlb.ts`) replace them.
- **Photography:** set `src` on an entry of `materials` in `lib/content.ts` to use a photo instead of the rendered plate.
- **Posters:** after visual changes, run `npm run posters` with the dev server running to re-capture fallback stills and the OG image.

## Verification scripts

With the dev server running:

| Command | What it does |
| --- | --- |
| `node scripts/shots.mjs <dir> [--mobile] [--reduced] [--t=0,1.5]` | Screenshots at film times |
| `node scripts/sheet.mjs <dir>` | Contact sheet of a screenshot folder |
| `node scripts/hero.mjs <prefix>` | Hero smoke interaction |
| `node scripts/a11y.mjs <dir>` | Keyboard, dash and allocation form checks |
| `node scripts/perf.mjs <dir>` | Loader frames, sound toggle, per-scene frame stats |
| `node scripts/nowebgl.mjs <dir>` | Poster fallback |

The allocation endpoint (`app/api/allocation/route.ts`) validates requests and returns a reference. It stores nothing.
