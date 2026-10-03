import { chromium } from "playwright";
const out = process.argv[2];
const b = await chromium.launch({ channel: "chromium", headless: true, args: ["--disable-webgl", "--disable-3d-apis"] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto("http://localhost:3000");
await page.waitForFunction(() => window.__vanta?.state().phase === "entered", null, { timeout: 60000 });
console.log(await page.evaluate(() => window.__vanta.state().webgl));
for (const t of [0, 1.5, 4.6, 6.2, 9.6]) {
  await page.evaluate((tt) => window.__vanta.go(tt), t);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/n-${String(t).replace(".", "_")}.png` });
}
console.log(errs.length ? errs : "no page errors");
await b.close();
