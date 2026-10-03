// Contact sheet of screenshots for quick review: node scripts/sheet.mjs <dir> [cols] [width]
import { chromium } from "playwright";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
const cols = Number(process.argv[3] ?? 5);
const width = Number(process.argv[4] ?? 1800);
const files = readdirSync(dir).filter((f) => f.endsWith(".png") && !f.startsWith("_sheet")).sort((a, b) => parseFloat(a.slice(2).replace("_", ".")) - parseFloat(b.slice(2).replace("_", ".")));
const imgs = files
  .map((f) => `<figure><img src="data:image/png;base64,${readFileSync(join(dir, f)).toString("base64")}"/><figcaption>${f}</figcaption></figure>`)
  .join("");
const html = `<html><body style="margin:0;background:#222;font:12px monospace;color:#aaa">
<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px;padding:6px">${imgs}</div>
<style>figure{margin:0}img{width:100%;display:block}</style></body></html>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width, height: 800 } });
await p.setContent(html);
await p.screenshot({ path: join(dir, "_sheet.png"), fullPage: true });
await b.close();
console.log(join(dir, "_sheet.png"));
