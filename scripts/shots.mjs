// Screenshot harness for visual verification.
// Usage: node scripts/shots.mjs [outDir] [--mobile] [--t=0,1.5,2.5] [--reduced] [--drag]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--")) ?? "shots";
const mobile = args.includes("--mobile");
const reduced = args.includes("--reduced");
const drag = args.includes("--drag");
const tArg = args.find((a) => a.startsWith("--t="));
const times = tArg ? tArg.slice(4).split(",").map(Number) : [0, 0.5, 1.4, 2.5, 3.6, 4.6, 5.5, 6.2, 7.5, 8.5, 9.5];
const url = args.find((a) => a.startsWith("--url="))?.slice(6) ?? "http://localhost:3000";
const wait = Number(args.find((a) => a.startsWith("--wait="))?.slice(7) ?? 1600);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  channel: "chromium",
  headless: true,
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-webgpu"],
});
const context = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  deviceScaleFactor: mobile ? 2 : 1,
  isMobile: mobile,
  hasTouch: mobile,
  reducedMotion: reduced ? "reduce" : "no-preference",
});
const page = await context.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") errors.push(`[${m.type()}] ${m.text()}`);
});
page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));

await page.goto(url, { waitUntil: "load" });
await page.waitForFunction(() => window.__vanta && window.__vanta.state().phase === "entered", null, { timeout: 90000 });
const info = await page.evaluate(() => ({ tier: window.__vanta.state().tier, webgl: window.__vanta.state().webgl }));
console.log("ready", info);
await page.waitForTimeout(800);

for (const t of times) {
  await page.evaluate((tt) => window.__vanta.go(tt), t);
  await page.waitForTimeout(400);
  if (drag && t < 1) {
    // a slow sweep then a fast flick across the bike
    const W = mobile ? 390 : 1440, H = mobile ? 844 : 900;
    await page.mouse.move(W * 0.3, H * 0.55);
    for (let i = 0; i <= 40; i++) await page.mouse.move(W * (0.3 + i * 0.01), H * (0.55 - Math.sin(i / 6) * 0.08), { steps: 2 });
    for (let i = 0; i <= 10; i++) await page.mouse.move(W * (0.75 - i * 0.05), H * (0.4 + i * 0.02));
  }
  await page.waitForTimeout(wait);
  const name = `${out}/${mobile ? "m" : "d"}-${String(t).replace(".", "_")}.png`;
  await page.screenshot({ path: name });
  console.log("shot", name, await page.evaluate(() => window.__vanta.frame.telemetry));
}
console.log(errors.length ? errors.slice(0, 30).join("\n") : "no console errors");
await browser.close();
