import { firefox } from "playwright";
import fs from "fs";
const stub = fs.readFileSync("./stub.js", "utf8");
const browser = await firefox.launch({ headless: true });
const res = {};
for (const lang of ["ja", "en"]) {
  const page = await browser.newPage({ viewport: { width: 320, height: 700 }, deviceScaleFactor: 2 });
  await page.addInitScript({ content: "window.__initialStore={uiLang:'"+lang+"',sites:[{domain:'nicovideo.jp',strong:true}]};" + stub +
    `;chrome.i18n={getMessage:()=>"",getUILanguage:()=>"${lang}"};
    window.__permReq=[];chrome.permissions={request:(o)=>{__permReq.push(o.origins);return Promise.resolve(true)},remove:()=>Promise.resolve(true)};
    chrome.tabs={query:async()=>[{id:7,url:'https://live.nicovideo.jp/watch/lv1'}],sendMessage:async()=>({ok:true,rate:1})};` });
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await page.goto(new URL("../src/popup.html", import.meta.url).href); await page.waitForTimeout(300);
  const r = {}; const st = () => page.evaluate(() => JSON.parse(JSON.stringify(__store)));
  r.addCurrentGone = await page.evaluate(() => !document.getElementById("addCurrent"));
  r.addBtnLeftOfInput = await page.evaluate(() => document.getElementById("addBtn").getBoundingClientRect().right <= document.getElementById("domainIn").getBoundingClientRect().left);
  r.prefill = await page.inputValue("#domainIn");
  r.initial = [await page.inputValue("#speedStep"), await page.inputValue("#seekSec")];
  const typ = async (sel, v) => { await page.fill(sel, v); await page.press(sel, "Enter"); await page.waitForTimeout(50); return [await page.inputValue(sel), (await st())[sel.slice(1)]]; };
  r.step007 = await typ("#speedStep", "0.07");
  r.stepEmpty = await typ("#speedStep", "");
  r.stepZero = await typ("#speedStep", "0");
  r.stepAbc = await typ("#speedStep", "abc");
  r.step9 = await typ("#speedStep", "9");
  r.seek7 = await typ("#seekSec", "7");
  r.seekComma = await typ("#seekSec", "2,5");
  r.seek0 = await typ("#seekSec", "0");
  r.seekEmpty = await typ("#seekSec", "");
  r.labelsBefore = await page.evaluate(() => ["speedOn","seekOn","middleReset"].map((i) => document.querySelector("#"+i+" + span").textContent));
  await page.click("#swapButtons"); await page.waitForTimeout(50);
  r.swapStored = (await st()).swapButtons;
  r.labelsSwapped = await page.evaluate(() => ["speedOn","seekOn","middleReset"].map((i) => document.querySelector("#"+i+" + span").textContent));
  // language toggle keeps swapped labels
  await page.click("#lang"); await page.waitForTimeout(50);
  r.labelsSwappedOtherLang = await page.evaluate(() => ["speedOn","seekOn","middleReset"].map((i) => document.querySelector("#"+i+" + span").textContent));
  await page.click("#lang"); await page.waitForTimeout(50);
  if (lang === "ja") {
    await page.click("#swapButtons"); await page.waitForTimeout(50);
    r.keysInitial = KEYS(await st());
    await page.click("#abKeyA"); await page.keyboard.press("Shift+KeyQ"); await page.waitForTimeout(50);
    r.keyShiftQ = [await page.inputValue("#abKeyA"), (await st()).abKeyA];
    await page.click("#abKeyB"); await page.keyboard.press("Shift+KeyQ"); await page.waitForTimeout(50);
    r.dupMovesToB = [await page.inputValue("#abKeyA"), await page.inputValue("#abKeyB"), (await st()).abKeyA, (await st()).abKeyB];
    await page.click("#abKeyB"); await page.keyboard.press("Backspace"); await page.waitForTimeout(50);
    r.backspaceUnset = [await page.inputValue("#abKeyB"), JSON.stringify((await st()).abKeyB), await page.getAttribute("#abKeyB", "placeholder")];
    await page.click("#abKeyA"); await page.keyboard.press("BracketLeft"); await page.click("#abKeyB"); await page.keyboard.press("BracketRight"); await page.waitForTimeout(50);
    r.restored = KEYS(await st());
    await page.click("#abKeyClear"); await page.keyboard.press("Shift"); await page.waitForTimeout(50); r.modifierOnlyIgnored = (await st()).abKeyClear;
    // restore defaults for the screenshot
    await page.evaluate(() => { for (const k of ["speedStep","seekSec","swapButtons"]) delete __store[k]; });
    await page.reload(); await page.waitForTimeout(300);
  } else { await page.click("#swapButtons"); await page.reload(); await page.waitForTimeout(300); }
  res[lang] = r;
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  const h = await page.evaluate(() => document.body.scrollHeight); await page.setViewportSize({ width: 320, height: h });
  await page.screenshot({ path: `../docs/popup-${lang}.png` });
  if (lang === "ja") {
    await page.click("#swapButtons"); await page.evaluate(() => document.activeElement.blur()); await page.waitForTimeout(50);
    await page.screenshot({ path: `../docs/popup-ja-swap.png` });
  }
  await page.close();
}
function KEYS(s) { return [s.abKeyA, s.abKeyB, s.abKeyClear]; }
console.log(JSON.stringify(res, null, 1)); await browser.close();
