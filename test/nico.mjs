import { firefox } from "playwright";
import fs from "fs";
const strong = process.argv[2] === "strong";
const src = "../src/";
const stub = fs.readFileSync("./stub.js", "utf8");
const browser = await firefox.launch({ headless: true, firefoxUserPrefs: { "media.autoplay.default": 0 } });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: "ja-JP" });
await page.addInitScript({ content: "window.__md=[];addEventListener('error',e=>window.__err=String(e.message));addEventListener('mousedown',e=>__md.push(e.button+':'+e.clientX+','+e.clientY+' vids:'+[...document.querySelectorAll('video')].map(v=>{const r=v.getBoundingClientRect();return [r.left,r.top,r.width,r.height].map(Math.round).join('/')}).join(';')),true);addEventListener('wheel',e=>__md.push('wheelcap '+e.target.tagName),true);addEventListener('blur',e=>__md.push('blur'),true);addEventListener('mouseup',e=>__md.push('up'),true);addEventListener('mousemove',e=>__md.push('mm'+e.buttons),true);window.__rc=[];addEventListener('ratechange',e=>__rc.push(e.target.playbackRate),true)" });
await page.addInitScript({ content: "window.__initialStore=" + JSON.stringify({ sites: [{ domain: "nicovideo.jp", strong }] }) + ";" + stub + fs.readFileSync(src + "content.js", "utf8") });
if (strong) await page.addInitScript({ content: fs.readFileSync(src + "main.js", "utf8") });
await page.goto("https://www.nicovideo.jp/watch/sm9", { waitUntil: "domcontentloaded", timeout: 45000 });
const ok = await page.waitForSelector("video", { timeout: 30000, state: "attached" }).then(() => true, () => false);
await page.waitForTimeout(5000);
const info = await page.evaluate(() => { const v = [...document.querySelectorAll("video")].sort((a, b) => b.clientWidth - a.clientWidth)[0];
  return v ? { n: document.querySelectorAll("video").length, w: v.clientWidth, h: v.clientHeight, paused: v.paused, t: v.currentTime, rs: v.readyState, src: (v.currentSrc || "").slice(0, 40) } : null; });
console.log("video found:", ok, info, await page.title());
await page.screenshot({ path: "nico.png" });
if (info && info.w > 100) {
  await page.evaluate(() => { document.querySelectorAll("iframe[src*=imasdk]").forEach(f => f.style.pointerEvents = "none"); const v = [...document.querySelectorAll("video")].sort((a, b) => b.clientWidth - a.clientWidth)[0]; v.muted = true; v.play().catch(()=>{}); }); await page.waitForTimeout(1500);
  const box = await page.evaluate(() => { const v = [...document.querySelectorAll("video")].sort((a, b) => b.clientWidth - a.clientWidth)[0]; const r = v.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(box.x, box.y); await page.mouse.down(); for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -100); await page.mouse.up();
  const probe = () => page.evaluate(() => { const v = [...document.querySelectorAll("video")].sort((a, b) => b.clientWidth - a.clientWidth)[0];
    return { pageSees: v.playbackRate, real: Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "playbackRate").get.toString().includes("override") ? "patched" : v.playbackRate, osd: document.querySelector(".ytwc-osd")?.textContent, t: v.currentTime, paused: v.paused }; });
  console.log("dbg", await page.evaluate(() => ({ flag: window.__ytWheelControl, efp: (e=>e.tagName+"."+e.className)(document.elementFromPoint(408,324)), frames: (e=>String(e.src).slice(0,80)+e.tagName+" pe="+getComputedStyle(e).pointerEvents+" "+e.getBoundingClientRect().width)(document.elementFromPoint(408,324)), rc: window.__rc, osdN: document.querySelectorAll(".ytwc-osd").length, fsEl: String(document.fullscreenElement), err: window.__err, md: window.__md })));console.log("after", await probe()); await page.waitForTimeout(3000); console.log("3s later", await probe());
}
await browser.close();
