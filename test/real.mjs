import { firefox } from "playwright";
import fs from "fs";
const withAddon = process.argv[2] === "on";
const url = process.argv[3] || "https://www.youtube.com/watch?v=jNQXAC9IVRw";
const js = fs.readFileSync("../src/content.js", "utf8");
const stub = fs.readFileSync("./stub.js", "utf8");
const browser = await firefox.launch({ headless: true, firefoxUserPrefs: { "media.autoplay.default": 0 } });
const ctx = await browser.newContext({ locale: "ja-JP", viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
if (withAddon) await page.addInitScript({ content: "window.__initialStore={};" + stub + js });
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#movie_player video", { timeout: 30000, state: "attached" }).catch(async()=>{await page.screenshot({path:"fail.png"});console.log(await page.evaluate(()=>document.title+" "+location.href+" "+!!document.querySelector("#movie_player")));process.exit(1)});
await page.waitForTimeout(4000);
const V = () => page.evaluate(() => { const v = document.querySelector("#movie_player video"); const m = document.querySelector(".ytp-contextmenu");
  return { rate: v.playbackRate, paused: v.paused, t: +v.currentTime.toFixed(2), scrollY: scrollY, menu: !!m && getComputedStyle(m).display !== "none",
    osd: document.querySelector(".ytwc-osd")?.textContent, fs: !!document.fullscreenElement, speedmaster: !!document.querySelector(".ytp-speedmaster-user-edu:not([style*='none'])") }; });
const box = await page.locator("#movie_player").boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
await page.mouse.move(cx, cy); const lp = page.locator(".ytp-large-play-button"); if (await lp.isVisible().catch(()=>false)) { await lp.click(); await page.waitForTimeout(3000); await page.mouse.move(cx, cy); }
// ensure playing
await page.evaluate(() => { const v = document.querySelector("#movie_player video"); v.muted = true; v.play().catch(()=>{}); });
await page.waitForTimeout(1500);
const out = { withAddon, start: await V() };
const esc = async () => { await page.keyboard.press("Escape"); await page.waitForTimeout(300); await page.mouse.move(cx, cy); };
// 1 long hold left 1200ms
await page.mouse.down(); await page.waitForTimeout(1200); out.hold_during = await V(); await page.mouse.up(); await page.waitForTimeout(400); out.hold_after = await V();
await page.evaluate(() => { const v = document.querySelector("#movie_player video"); if (v.paused) v.play(); }); await page.waitForTimeout(500);
// 2 short click -> pause toggle
const p0 = (await V()).paused; await page.mouse.click(cx, cy); await page.waitForTimeout(700); out.click_paused_before = p0; out.click_after = await V();
await page.mouse.click(cx, cy); await page.waitForTimeout(700); out.click2_after = await V();
// 3 left hold + wheel up x3
await page.mouse.down(); await page.waitForTimeout(100);
for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(80); }
out.lw_during = await V(); await page.mouse.up(); await page.waitForTimeout(700); out.lw_after = await V();
await page.mouse.down(); for (let i = 0; i < 2; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(80); } await page.mouse.up(); await page.waitForTimeout(500); out.lw_down2 = await V();
// middle reset
await page.mouse.down(); await page.mouse.down({ button: "middle" }); await page.mouse.up({ button: "middle" }); await page.mouse.up(); await page.waitForTimeout(500); out.middle_reset = await V();
// 4 right hold + wheel down x2
await esc();
const t0 = (await V()).t;
await page.mouse.down({ button: "right" }); await page.waitForTimeout(100);
for (let i = 0; i < 2; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(100); }
out.rw_during = await V(); await page.mouse.up({ button: "right" }); await page.waitForTimeout(500); out.rw_t0 = t0; out.rw_after = await V();
// 5 normal right click
await page.mouse.click(cx, cy, { button: "right" }); await page.waitForTimeout(600); out.rclick = await V(); await esc();
// 6 dblclick fullscreen
await page.mouse.dblclick(cx, cy); await page.waitForTimeout(1200); out.dbl = await V();
console.log(JSON.stringify(out, null, 1));
await browser.close();
