// Hero interaction test: slow sweep, fast flick, then wait for the reveal copy.
import { chromium } from "playwright";
const out = process.argv[2] ?? "hero";
const b = await chromium.launch({ channel: "chromium", headless: true, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3000");
await page.waitForFunction(() => window.__vanta?.state().phase === "entered", null, { timeout: 90000 });
await page.waitForTimeout(600);
const shot = async (n) => page.screenshot({ path: `${out}-${n}.png` });
await shot("0-entered");
// slow, deliberate sweep across the machine
await page.mouse.move(560, 520);
for (let i = 0; i < 120; i++) {
  await page.mouse.move(560 + i * 5, 520 - Math.sin(i / 14) * 90, { steps: 1 });
  await page.waitForTimeout(16);
}
await shot("1-slow");
// a fast flick back
for (let i = 0; i < 8; i++) await page.mouse.move(1160 - i * 90, 380 + i * 25);
await page.waitForTimeout(250);
await shot("2-fast");
for (let i = 0; i < 80; i++) {
  await page.mouse.move(700 + Math.cos(i / 9) * 260, 470 + Math.sin(i / 7) * 160, { steps: 1 });
  await page.waitForTimeout(16);
}
await page.waitForTimeout(3200);
await shot("3-copy");
console.log(await page.evaluate(() => ({ stage: window.__vanta.state().revealStage, d: window.__vanta.frame.reveal.discovered })));
await page.waitForTimeout(5000);
await shot("4-reformed");
await b.close();
