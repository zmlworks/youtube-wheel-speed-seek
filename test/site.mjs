import { firefox } from "playwright";
import fs from "fs";
const [mode, q] = [process.argv[2], process.argv[3] || ""]; // mode: none|gen|strong
const src = "../src/";
const js = fs.readFileSync(src + "content.js", "utf8"), mainjs = fs.readFileSync(src + "main.js", "utf8");
const stub = fs.readFileSync("./stub.js", "utf8");
const browser = await firefox.launch({ headless: true, firefoxUserPrefs: { "media.autoplay.default": 0 } });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
await page.route("http://www.nicomock.test/**", (r) => { const u = new URL(r.request().url());
  r.fulfill({ path: u.pathname.endsWith(".wav") ? "tone.wav" : "site.html" }); });
const store = { sites: [{ domain: "nicomock.test", strong: mode === "strong" }] };
// content.js first (emulates isolated world which sees native accessors), then MAIN-world script
if (mode !== "none") await page.addInitScript({ content: "window.__initialStore=" + JSON.stringify(store) + ";" + stub + js });
if (mode === "strong") await page.addInitScript({ content: mainjs });
await page.goto("http://www.nicomock.test/watch" + q);
await page.evaluate(() => v.play()); await page.waitForTimeout(500);
const S = () => page.evaluate(() => ({ pageSees: v.playbackRate, real: window.__real ? __real(v) : undefined, paused: v.paused, t: +v.currentTime.toFixed(1), scrollY, fixes, osd: document.querySelector(".ytwc-osd")?.textContent, log: log.splice(0) }));
await page.evaluate(() => { const d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "playbackRate"); });
// real rate probe via mozilla audio clock: measure currentTime advance over 1s
const measure = async () => { const a = await page.evaluate(() => v.currentTime); await page.waitForTimeout(1000); const b = await page.evaluate(() => v.currentTime); return +(b - a).toFixed(2); };
const cx = 420, cy = 200, o = { mode, q };
await page.mouse.move(cx, cy); await S();
await page.mouse.click(cx, cy); await page.waitForTimeout(100); o.a_click = await S(); await page.mouse.click(cx, cy); await page.waitForTimeout(100); o.a_click2 = await S();
await page.mouse.down(); for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -100); await page.mouse.up(); await page.waitForTimeout(150);
o.b_leftWheelUp4 = await S(); o.b_mediaSecPerSec_after = await measure(); o.b_after_1s = await S();
await page.waitForTimeout(1200); o.b_after_polling = await S();
await page.evaluate(() => { v.playbackRate = 1.25; }); await page.waitForTimeout(100); o.c_pageSets125 = await S(); o.c_mediaSecPerSec = await measure();
const t0 = (await S()).t;
await page.mouse.down({ button: "right" }); await page.mouse.wheel(0, -100); await page.mouse.wheel(0, -100); await page.mouse.up({ button: "right" }); await page.waitForTimeout(150);
o.d_t0 = t0; o.d_rightWheelUp2 = await S();
await page.mouse.click(cx, cy, { button: "right" }); await page.waitForTimeout(150); o.e_plainRight = await S();
await page.mouse.down(); await page.mouse.down({ button: "middle" }); await page.mouse.up({ button: "middle" }); await page.mouse.up(); await page.waitForTimeout(150); o.f_reset = await S(); o.f_mediaSecPerSec = await measure();
await page.evaluate(() => { v.playbackRate = 1.5; }); await page.waitForTimeout(100); o.g_pageSets15_afterReset = await S();
await page.mouse.move(930, 60); await page.mouse.down(); await page.mouse.wheel(0, -100); await page.mouse.up(); await page.waitForTimeout(100);
o.h_smallVideo = await page.evaluate(() => [document.getElementById("small").playbackRate, v.playbackRate]);
await page.mouse.move(420, 600); await page.mouse.down(); await page.mouse.wheel(0, 100); await page.mouse.up(); await page.waitForTimeout(200); o.i_noVideo_scrollY = await page.evaluate(() => scrollY);
o.mainInjected = await page.evaluate(() => !!window.__ytwcMain);
console.log(JSON.stringify(o)); await browser.close();
