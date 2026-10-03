// Captures stills from the real engine for the no-WebGL fallback and the OG image.
// Usage: node scripts/posters.mjs   (dev server running)
import { chromium } from "playwright";
import { mkdirSync, copyFileSync } from "node:fs";

const SCENES = [
  ["reveal", 0.0],
  ["mass", 1.86],
  ["aero", 2.6],
  ["exploded", 3.86],
  ["power", 4.7],
  ["interface", 5.5],
  ["motion", 7.6],
  ["ninety", 8.6],
  ["final", 9.7],
];
const PLATES = ["carbon", "billet", "knurl", "weld", "disc", "suede", "paint"];
mkdirSync("public/posters/m", { recursive: true });

const browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
for (const mobile of [false, true]) {
  const page = await browser.newPage({
    viewport: mobile ? { width: 430, height: 932 } : { width: 1600, height: 1000 },
    deviceScaleFactor: mobile ? 2 : 1,
  });
  await page.goto("http://localhost:3000/?poster");
  await page.waitForFunction(() => window.__vanta?.state().phase === "entered", null, { timeout: 90000 });
  await page.waitForTimeout(800);
  const dir = mobile ? "public/posters/m" : "public/posters";
  for (const [id, t] of SCENES) {
    await page.evaluate((tt) => window.__vanta.go(tt), t);
    if (id === "reveal") {
      // part the smoke so the still reads as the hero, not as darkness
      const W = mobile ? 430 : 1600, H = mobile ? 932 : 1000;
      await page.mouse.move(W * 0.35, H * 0.5);
      for (let i = 0; i < 90; i++) {
        await page.mouse.move(W * (0.35 + Math.sin(i / 11) * 0.25 + i * 0.002), H * (0.48 + Math.cos(i / 8) * 0.12), { steps: 1 });
        await page.waitForTimeout(14);
      }
      await page.waitForTimeout(900);
    } else await page.waitForTimeout(1800);
    await page.screenshot({ path: `${dir}/${id}.jpg`, type: "jpeg", quality: 84 });
    console.log("poster", dir, id);
  }
  if (!mobile) {
    for (const id of PLATES) {
      const y = await page.evaluate((pid) => {
        const el = document.querySelector(`[data-plate="${pid}"]`);
        const r = el.getBoundingClientRect();
        return window.scrollY + r.top + r.height / 2 - innerHeight / 2;
      }, id);
      await page.evaluate((yy) => window.__vanta.goY(yy), y);
      await page.waitForTimeout(1800);
      const box = await page.evaluate((pid) => {
        const r = document.querySelector(`[data-plate="${pid}"]`).getBoundingClientRect();
        return { x: Math.max(0, r.left), y: Math.max(0, r.top), width: Math.min(innerWidth, r.width), height: Math.min(innerHeight - Math.max(0, r.top), r.height) };
      }, id);
      await page.screenshot({ path: `public/posters/plate-${id}.jpg`, type: "jpeg", quality: 86, clip: box });
      console.log("plate", id);
    }
  }
  await page.close();
}
await browser.close();
copyFileSync("public/posters/final.jpg", "app/opengraph-image.jpg");
console.log("done");
