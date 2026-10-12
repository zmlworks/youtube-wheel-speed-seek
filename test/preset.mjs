import { firefox } from "playwright";
import fs from "fs";
const src = "../src/";
const js = fs.readFileSync(src + "content.js", "utf8"), mainjs = fs.readFileSync(src + "main.js", "utf8");
const stub = fs.readFileSync("./stub.js", "utf8") + ";chrome.runtime.onMessage={addListener(f){window.__ml=f}};window.__msg=(m)=>{let r;__ml(m,{},(x)=>r=x);return r};";
const browser = await firefox.launch({ headless: true, firefoxUserPrefs: { "media.autoplay.default": 0 } });
async function run(name, url, store, strong) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  await page.route(/www\.(youtube\.com|nicomock\.test)/, (r) => { const u = r.request().url();
    r.fulfill({ path: u.endsWith(".wav") ? "tone.wav" : u.includes("youtube") ? "mock.html" : "site.html" }); });
  await page.addInitScript({ content: "window.__initialStore=" + JSON.stringify(store) + ";" + stub + js });
  if (strong) await page.addInitScript({ content: mainjs });
  await page.goto(url); await page.evaluate(() => document.querySelector("video").play()); await page.waitForTimeout(400);
  const P = (m) => page.evaluate((m) => { const r = __msg(m); const v = document.querySelector("video");
    return { resp: r, pageSees: v.playbackRate, osd: document.querySelector(".ytwc-osd")?.textContent, fixes: window.fixes }; }, m);
  const speed = async () => { const a = await page.evaluate(() => document.querySelector("video").currentTime); await page.waitForTimeout(1000); return +((await page.evaluate(() => document.querySelector("video").currentTime)) - a).toFixed(2); };
  const o = { get0: await P({ type: "ytwc-get" }) };
  o.preset3 = await P({ type: "ytwc-preset", rate: 3 }); o.preset3_realSpeed = await speed(); o.preset3_later = await P({ type: "ytwc-get" });
  o.preset2 = await P({ type: "ytwc-preset", rate: 2 });
  o.preset1 = await P({ type: "ytwc-preset", rate: 1 }); o.preset1_realSpeed = await speed();
  if (strong) { await page.evaluate(() => { v.playbackRate = 1.5; }); o.afterReset_pageCanSet15 = await P({ type: "ytwc-get" }); }
  o.noVideo = await page.evaluate(() => { document.querySelectorAll("video").forEach((v) => v.style.display = "none"); return [__msg({ type: "ytwc-get" }), __msg({ type: "ytwc-get", sub: true })]; });
  console.log("=====", name); for (const k in o) console.log(" ", k, JSON.stringify(o[k]));
  await page.close();
}
await run("youtube mock", "https://www.youtube.com/watch?v=x", {}, false);
await run("generic", "http://www.nicomock.test/watch", { sites: [{ domain: "nicomock.test" }] }, false);
await run("strong+fight", "http://www.nicomock.test/watch?fight=1", { sites: [{ domain: "nicomock.test", strong: true }] }, true);
await browser.close();
