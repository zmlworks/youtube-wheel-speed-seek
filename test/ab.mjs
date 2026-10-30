import { firefox } from "playwright";
import fs from "fs";
const js = fs.readFileSync("../src/content.js", "utf8");
const stub = fs.readFileSync("./stub.js", "utf8");
const browser = await firefox.launch({ headless: true, firefoxUserPrefs: { "media.autoplay.default": 0 } });
async function run(url, store) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await page.route(/www\.(youtube\.com|nicomock\.test)/, (r) => { const u = r.request().url();
    r.fulfill({ path: u.includes(".wav") ? "tone.wav" : u.includes("youtube") ? "mock.html" : "site.html" }); });
  await page.addInitScript({ content: "window.__initialStore=" + JSON.stringify(store) + ";" + stub + js +
    ";window.__keys=[];addEventListener('keydown',(e)=>__keys.push(e.key));" });
  await page.goto(url);
  await page.evaluate(() => { const v = document.querySelector("video"); v.loop = false; v.play(); }); await page.waitForTimeout(300);
  const S = () => page.evaluate(() => { const v = document.querySelector("video"); return { t: +v.currentTime.toFixed(2), rate: v.playbackRate, osd: document.querySelector(".ytwc-osd")?.textContent, keysSeenByPage: __keys.splice(0) }; });
  const seek = (t) => page.evaluate((t) => { document.querySelector("video").currentTime = t; }, t);
  await page.mouse.move(300, 200);
  const o = {};
  if (store.swapButtons) {
    await page.mouse.down({ button: "right" }); await page.mouse.wheel(0, -100); await page.mouse.wheel(0, -100); o.swapRightWheel = await S();
    await page.mouse.down({ button: "middle" }); await page.mouse.up({ button: "middle" }); await page.mouse.up({ button: "right" }); await page.waitForTimeout(150);
    o.swapRightMiddleReset = await S();
    o.menuAfter = await page.evaluate(() => { const m = document.querySelector(".ytp-contextmenu"); return m ? getComputedStyle(m).display : "n/a"; });
  }
  await seek(2); await page.keyboard.press("BracketLeft"); o.setA = await S();
  await seek(4); await page.keyboard.press("BracketRight"); o.setB = await S();
  await seek(3.6); await page.waitForTimeout(900); o.afterLoop = await S(); // should have wrapped to ~2.x
  const ts = []; for (let i = 0; i < 25; i++) { ts.push(await page.evaluate(() => +document.querySelector("video").currentTime.toFixed(2))); await page.waitForTimeout(100); }
  o.maxSeen = Math.max(...ts); o.minSeen = Math.min(...ts);
  // B < A: set A after B -> swapped
  await page.keyboard.press("Backslash"); await seek(6); await page.keyboard.press("BracketLeft"); await seek(4); await page.keyboard.press("BracketRight"); o.B_lt_A_swapped = await S();
  await page.keyboard.press("Backslash"); o.clear = await S();
  await seek(6.5); await page.waitForTimeout(800); o.noLoopAfterClear = await S();
  // typing in an input is ignored
  await page.evaluate(() => { const i = document.createElement("input"); i.id = "tx"; document.body.prepend(i); });
  await page.focus("#tx"); await page.keyboard.press("BracketLeft"); o.typing = [await page.inputValue("#tx"), await S()];
  await page.evaluate(() => document.activeElement.blur());
  // src change resets A/B
  await seek(2); await page.keyboard.press("BracketLeft"); await seek(3); await page.keyboard.press("BracketRight"); await page.waitForTimeout(100);
  await page.evaluate(() => { const v = document.querySelector("video"); v.src = v.src.replace("tone.wav", "tone.wav?2"); v.play(); });
  await page.waitForTimeout(400); await seek(3.5); await page.waitForTimeout(800); o.afterSrcChange_noLoop = await S();
  // unrelated key reaches page
  await page.keyboard.press("k"); o.otherKey = await S();
  await page.close(); return o;
}
const out = {
  yt: await run("https://www.youtube.com/watch?v=x", {}),
  ytSwap: await run("https://www.youtube.com/watch?v=x", { swapButtons: true }),
  generic_en: await run("http://www.nicomock.test/watch", { sites: [{ domain: "nicomock.test" }], uiLang: "en" }),
  disabled: await run("https://www.youtube.com/watch?v=x", { abOn: false })
};
console.log(JSON.stringify(out, null, 0).replace(/\},"/g, '},\n"'));
await browser.close();
