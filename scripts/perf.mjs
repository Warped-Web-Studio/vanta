// Loader capture, sound toggle, per-scene frame stats.
import { chromium } from "playwright";
const out = process.argv[2];
const b = await chromium.launch({ channel: "chromium", headless: true, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await page.goto("http://localhost:3000/?debug");
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(220);
  await page.screenshot({ path: `${out}/loader-${i}.png` });
}
await page.waitForFunction(() => window.__vanta?.state().phase === "entered", null, { timeout: 90000 });
await page.getByRole("button", { name: /SOUND/ }).click();
await page.waitForTimeout(300);
console.log("sound:", await page.evaluate(() => window.__vanta.state().sound));
for (const t of [0.1, 1.5, 2.5, 3.7, 4.6, 5.5, 6.3, 7.6, 8.5, 9.6]) {
  await page.evaluate((tt) => window.__vanta.go(tt), t);
  await page.waitForTimeout(1600);
  const s = await page.evaluate(() => ({ ...window.__vanta.frame.stats }));
  console.log(`t=${t}`, JSON.stringify(s));
}
console.log(errs.length ? errs.slice(0, 10) : "no errors");
await b.close();
