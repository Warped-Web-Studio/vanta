// Keyboard and form checks.
import { chromium } from "playwright";
const out = process.argv[2];
const b = await chromium.launch({ channel: "chromium", headless: true, args: ["--use-angle=metal", "--enable-gpu"] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto("http://localhost:3000");
await page.waitForFunction(() => window.__vanta?.state().phase === "entered", null, { timeout: 90000 });
await page.waitForTimeout(500);
const tabs = [];
for (let i = 0; i < 8; i++) {
  await page.keyboard.press("Tab");
  tabs.push(await page.evaluate(() => {
    const a = document.activeElement;
    return `${a.tagName.toLowerCase()} "${(a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 40)}"`;
  }));
}
console.log("tab order:", tabs.join(" | "));
// dash via keyboard
await page.evaluate(() => window.__vanta.go(5.5));
await page.waitForTimeout(1200);
await page.locator('button[aria-label^="Traction control"]').focus();
await page.keyboard.press("ArrowUp");
await page.keyboard.press("ArrowUp");
await page.keyboard.press("ArrowRight");
await page.keyboard.press("ArrowUp");
console.log("ride after keys:", JSON.stringify(await page.evaluate(() => window.__vanta.state().ride)));
await page.locator('button[aria-label^="Ride mode"]').click();
await page.keyboard.press("ArrowUp");
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/dash.png` });
console.log("ride after mode:", JSON.stringify(await page.evaluate(() => window.__vanta.state().ride)));
// allocation form
await page.evaluate(() => window.__vanta.go(9.6));
await page.waitForTimeout(1200);
await page.getByRole("button", { name: /REQUEST ALLOCATION/ }).last().click();
await page.waitForTimeout(700);
await page.getByRole("button", { name: /REQUEST ALLOCATION/ }).last().click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/form-errors.png` });
console.log("focused after invalid submit:", await page.evaluate(() => document.activeElement?.getAttribute("name")));
await page.fill('input[name="name"]', "Ines Albrecht");
await page.fill('input[name="email"]', "ines@example.com");
await page.selectOption('select[name="country"]', "Switzerland");
await page.fill('input[name="serial"]', "47");
await page.getByRole("button", { name: /REQUEST ALLOCATION/ }).last().click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/form-done.png` });
console.log("done text:", await page.locator("dialog[open]").innerText().then((t) => t.slice(0, 160).replace(/\n/g, " / ")));
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
console.log("dialog after Esc:", await page.evaluate(() => window.__vanta.state().dialog));
console.log(errs.length ? errs : "no page errors");
await b.close();
