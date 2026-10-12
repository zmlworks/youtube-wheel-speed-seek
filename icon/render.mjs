import { chromium as firefox } from "playwright";
import fs from "fs";
const big = fs.readFileSync("icon.svg", "utf8"), small = fs.readFileSync("icon-small.svg", "utf8"); const b = await firefox.launch({ headless: true });
const p = await b.newPage();
for (const s of [16, 32, 48, 96, 128]) {
  await p.setViewportSize({ width: s, height: s });
  await p.setContent(`<style>body{margin:0;background:transparent}</style><img src="data:image/svg+xml;base64,${Buffer.from(s <= 16 ? fs.readFileSync("icon-16.svg","utf8") : s <= 32 ? small : big).toString("base64")}" width=${s} height=${s} style="display:block">`);
  await p.screenshot({ path: `icon${s}.png`, omitBackground: true });
}
const sizes = [16, 32, 48, 96, 128]; const cell = (bg) => `<div style="background:${bg};padding:16px;display:flex;gap:20px;align-items:center">${sizes.map((s) => `<img src="./icon${s}.png" width=${s}>`).join("")}<span style="font:14px sans-serif;color:${bg === "#fff" ? "#333" : "#ddd"};display:flex;gap:6px;align-items:center">toolbar <img src="./icon32.png" width=16></span></div>`;
await p.setViewportSize({ width: 520, height: 340 });
fs.writeFileSync("render.html", `<body style="margin:0">${cell("#fff")}${cell("#f0f0f4")}${cell("#2b2a33")}${cell("#000")}<div style="padding:8px;background:#888;display:flex;gap:10px"><img src="icon16.png" width=128 style="image-rendering:pixelated"><img src="icon32.png" width=128 style="image-rendering:pixelated"></div></body>`);
await p.goto("./render.html"); await p.screenshot({ path: "../docs/icon_preview.png", fullPage: true });
await b.close();
