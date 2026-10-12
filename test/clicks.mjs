import { firefox } from "playwright";
import fs from "fs";
const withAddon = process.argv[2] === "on";
const src = "../src/";
const stub = fs.readFileSync("./stub.js", "utf8");
const b = await firefox.launch({ headless: true, firefoxUserPrefs: { "media.autoplay.default": 0 } });
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
await p.route("https://www.youtube.com/**", (r) => r.fulfill({ path: r.request().url().endsWith(".wav") ? "tone.wav" : "mock.html" }));
if (withAddon) await p.addInitScript({ content: "window.__initialStore={};" + stub + fs.readFileSync(src + "content.js", "utf8") });
await p.goto("https://www.youtube.com/watch?v=x"); await p.evaluate(() => document.querySelector("video").play()); await p.waitForTimeout(300);
const cx = 420, cy = 200; await p.mouse.move(cx, cy);
const st = () => p.evaluate(() => ({ paused: document.querySelector("video").paused, rate: document.querySelector("video").playbackRate, log: log.splice(0) }));
let fails = []; let n = 0;
async function click(label, ms = 60) {
  const before = (await st()).paused;
  await p.mouse.down(); await p.waitForTimeout(ms); await p.mouse.up(); await p.waitForTimeout(80);
  const a = await st(); n++; if (a.paused === before) fails.push(`${label}: no toggle ${JSON.stringify(a.log)}`);
  if (a.rate !== 1 && !label.includes("rate")) fails.push(`${label}: rate ${a.rate}`);
}
const o = {};
// rapid clicks
for (let i = 0; i < 6; i++) { const before = (await st()).paused; await p.mouse.click(cx, cy); await p.waitForTimeout(260); const a = await st(); n++; if (a.paused === before) fails.push("rapid#" + i + JSON.stringify(a.log)); }
// durations 100..450
for (const ms of [100, 200, 300, 400, 450]) await click("dur" + ms, ms);
// long hold 800ms (should not trigger 2x; click toggles is acceptable)
await p.mouse.down(); await p.waitForTimeout(800); o.hold800_rate = (await st()).rate; await p.mouse.up(); await p.waitForTimeout(80); await st();
// after left wheel gesture: release should NOT toggle, next click must toggle
await p.mouse.down(); await p.mouse.wheel(0, -100); await p.mouse.up(); await p.waitForTimeout(80); o.afterWheel = await st();
await p.evaluate(() => document.querySelector("video").playbackRate = 1);
await click("after-left-wheel");
// after right-wheel seek
await p.mouse.down({ button: "right" }); await p.mouse.wheel(0, -100); await p.mouse.up({ button: "right" }); await p.waitForTimeout(80); await st();
await click("after-right-wheel");
// after plain right-click menu (first click may close menu like YouTube does; we require toggle on click)
await p.mouse.click(cx, cy, { button: "right" }); await p.waitForTimeout(100); await st();
await click("after-contextmenu");
// after fine-scrubbing on progress bar (sets RI)
await p.mouse.move(300, 432); await p.mouse.down(); await p.mouse.move(320, 400, { steps: 3 }); await p.mouse.up(); await p.mouse.move(cx, cy); await p.waitForTimeout(80); await st();
await click("after-scrub");
await click("after-scrub-2");
// after spacebar hold (speedmaster via keyboard sets RI)
await p.keyboard.down("Space"); await p.waitForTimeout(700); await p.keyboard.up("Space"); await p.waitForTimeout(80); await st();
await click("after-space-hold"); await click("after-space-hold-2");
// mouseup outside window during right hold then click
await p.mouse.down({ button: "right" }); await p.evaluate(() => window.dispatchEvent(new Event("blur"))); await p.mouse.up({ button: "right" }); await st();
await click("after-blur");
// double-click still fullscreen
await p.mouse.dblclick(cx, cy); await p.waitForTimeout(100); o.dbl = await p.evaluate(() => window.fsToggles || 0); await st();
for (let i = 0; i < 10; i++) await click("loop" + i, 30 + i * 40);
o.clicks = n; o.fails = fails;
console.log(JSON.stringify({ withAddon, ...o }, null, 1)); await b.close();
