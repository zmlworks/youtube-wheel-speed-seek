import { chromium } from "playwright";
import fs from "fs";
const b = await chromium.launch(); const p = await b.newPage();
const V = ["A", "B", "C-light", "C-dark"], S = [128, 48, 32, 16];
for (const v of V) { const d = "data:image/svg+xml;base64," + Buffer.from(fs.readFileSync(v + ".svg")).toString("base64");
  for (const s of S) { await p.setViewportSize({ width: s, height: s });
    await p.setContent(`<body style="margin:0;background:transparent"><img src="${d}" width=${s} height=${s} style="display:block">`);
    await p.screenshot({ path: `${v}-${s}.png`, omitBackground: true }); } }
const row = (bg, fc) => V.filter((v) => !(bg === "#f9f9fb" ? v === "C-dark" : v === "C-light")).map((v) => `<div style="background:${bg};padding:10px 14px;display:flex;gap:14px;align-items:center"><b style="font:20px sans-serif;color:${fc};width:20px">${v[0]}</b>${S.map((s) => `<img src="${v}-${s}.png" width=${s}>`).join("")}<img src="${v}-32.png" width=96 style="image-rendering:pixelated"><img src="${v}-16.png" width=96 style="image-rendering:pixelated"></div>`).join("");
fs.writeFileSync("cmp.html", `<body style="margin:0;display:flex"><div>${row("#f9f9fb", "#222")}</div><div>${row("#2b2a33", "#eee")}</div></body>`);
await p.setViewportSize({ width: 1000, height: 400 }); await p.goto("file://" + process.cwd() + "/cmp.html");
await p.screenshot({ path: "../docs/icon_proposals.png", fullPage: true }); await b.close();
