import { firefox } from "playwright";
import fs from "fs";
const src = "../src/";
const stub = fs.readFileSync("./stub.js", "utf8");
const b = await firefox.launch({ headless: true, firefoxUserPrefs: { "media.autoplay.default": 0 } });
const out = {};
for (const [name, url, store] of [["youtube", "https://www.youtube.com/watch?v=x", {}], ["generic", "http://www.nicomock.test/w", { sites: [{ domain: "nicomock.test" }] }]]) {
  const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
  await p.route(/www\.(youtube\.com|nicomock\.test)/, (r) => { const u = r.request().url(); r.fulfill({ path: u.endsWith(".wav") ? "tone.wav" : u.includes("youtube") ? "mock.html" : "site.html" }); });
  await p.addInitScript({ content: "window.__initialStore=" + JSON.stringify(store) + ";" + stub + fs.readFileSync(src + "content.js", "utf8") });
  await p.goto(url); await p.evaluate(() => { const v = document.querySelector("video"); v.currentTime = 30; v.play(); }); await p.waitForTimeout(400);
  const osd = () => p.evaluate(() => document.querySelector(".ytwc-osd")?.textContent + " @" + document.querySelector("video").currentTime.toFixed(0));
  await p.mouse.move(420, 200); await p.mouse.down({ button: "right" }); const seq = [];
  for (const d of [-100, -100, -100, 100, 100, 100, 100]) { await p.mouse.wheel(0, d); await p.waitForTimeout(60); seq.push(await osd()); }
  await p.mouse.up({ button: "right" }); await p.waitForTimeout(1300);
  await p.mouse.down({ button: "right" }); await p.mouse.wheel(0, -100); await p.waitForTimeout(60); seq.push("after hide: " + await osd()); await p.mouse.up({ button: "right" });
  await p.mouse.down(); await p.mouse.wheel(0, -100); await p.waitForTimeout(60); seq.push("speed: " + await osd()); await p.mouse.up();
  await p.mouse.down({ button: "right" }); await p.mouse.wheel(0, -100); await p.waitForTimeout(60); seq.push("seek after speed: " + await osd()); await p.mouse.up({ button: "right" });
  out[name] = seq; await p.close();
}
console.log(JSON.stringify(out, null, 1)); await b.close();
