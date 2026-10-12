import { firefox } from "playwright";
import fs from "fs";
const stub = fs.readFileSync("./stub.js", "utf8");
const browser = await firefox.launch({ headless: true });
const res = {};
for (const lang of ["ja", "en"]) {
  const m = JSON.parse(fs.readFileSync(`../src/_locales/${lang}/messages.json`, "utf8"));
  const page = await browser.newPage({ viewport: { width: 320, height: 600 }, deviceScaleFactor: 2 });
  await page.addInitScript({ content: "window.__initialStore={uiLang:'"+lang+"',sites:[{domain:'nicovideo.jp',strong:true}]};" + stub +
    `;chrome.i18n={getMessage:(k)=>(${JSON.stringify(m)}[k]||{}).message||"",getUILanguage:()=>"${lang}"};
    window.__permReq=[];window.__permRem=[];chrome.permissions={request:(o)=>{__permReq.push(o.origins);return Promise.resolve(!o.origins[0].includes('deny'))},remove:(o)=>{__permRem.push(o.origins);return Promise.resolve(true)}};
    chrome.tabs={query:async()=>[{id:7,url:'https://live.nicovideo.jp/watch/lv1'}]};window.__sent=[];window.__tabMode='ok';window.__tabRate=2;
    chrome.tabs.sendMessage=async(id,m,o)=>{__sent.push([id,m,o]);if(__tabMode==='none')throw new Error('no receiver');if(__tabMode==='novideo')return m.sub?undefined:{ok:false,reason:'noVideo'};if(m.type==='ytwc-preset')__tabRate=m.rate;return {ok:true,rate:__tabRate}};` });
  await page.goto("../src/popup.html"); await page.waitForTimeout(300);
  const r = {}; const sites = () => page.evaluate(() => JSON.stringify(__store.sites));
  r.curBtn = await page.textContent("#addCurrent"); r.prefill = await page.inputValue("#domainIn"); r.seekOpts = await page.evaluate(() => [...document.querySelectorAll("#seekSec option")].map(o=>o.textContent).join(","));
  await page.click("#addCurrent"); await page.waitForTimeout(100); r.addCurrentDup = await sites();
  await page.fill("#domainIn", "https://www.example.co.jp/path?x"); await page.click("#addBtn"); await page.waitForTimeout(100); r.addTyped = await sites();
  await page.fill("#domainIn", "deny.com"); await page.click("#addBtn"); await page.waitForTimeout(100); r.denied = [await sites(), await page.textContent("#status")];
  await page.fill("#domainIn", "m.youtube.com"); await page.click("#addBtn"); await page.waitForTimeout(100); r.yt = await page.textContent("#status");
  await page.click("li:nth-child(2) input.strong"); await page.waitForTimeout(100); r.strongToggle = await sites();
  await page.click("li:nth-child(2) button.del"); await page.waitForTimeout(100); r.deleted = [await sites(), await page.evaluate(() => JSON.stringify(__permRem))];
  r.permReq = await page.evaluate(() => JSON.stringify(__permReq));
  r.highlightOnOpen = await page.evaluate(() => [...document.querySelectorAll("button.preset")].map((b) => b.textContent + (b.classList.contains("cur") ? "*" : "")).join(" "));
  await page.click("button.preset[data-i='2']"); await page.waitForTimeout(100);
  r.click3x = await page.evaluate(() => [JSON.stringify(__sent.at(-1)), [...document.querySelectorAll("button.preset.cur")].map((b) => b.textContent).join()]);
  await page.click("#editP"); await page.fill(".presetIn[data-i='1']", "1.5"); await page.locator(".presetIn[data-i='1']").dispatchEvent("change"); await page.waitForTimeout(100);
  r.edit = await page.evaluate(() => [JSON.stringify(__store.presets), document.querySelector("button.preset[data-i='1']").textContent]);
  await page.fill(".presetIn[data-i='1']", "99"); await page.locator(".presetIn[data-i='1']").dispatchEvent("change"); await page.waitForTimeout(100);
  r.editInvalid = await page.evaluate(() => JSON.stringify(__store.presets));
  await page.evaluate(() => __tabMode = 'novideo'); await page.click("button.preset[data-i='0']"); await page.waitForTimeout(100); r.noVideo = await page.textContent("#presetStatus");
  await page.evaluate(() => __tabMode = 'none'); await page.click("button.preset[data-i='0']"); await page.waitForTimeout(100); r.unsupported = await page.textContent("#presetStatus");
  await page.evaluate(() => { __tabMode = 'ok'; document.getElementById("status").textContent = "";document.getElementById("status").dataset.k=''; document.getElementById("presetStatus").textContent = ""; document.getElementById('presetEdit').hidden = true; document.getElementById('domainIn').value = 'nicovideo.jp'; });
  await page.click("button.preset[data-i='1']"); await page.waitForTimeout(100); await page.evaluate(() => { document.getElementById('presetEdit').hidden = true; document.getElementById('domainIn').value = 'nicovideo.jp'; });
  await page.selectOption('#seekSec', '10'); await page.waitForTimeout(50); r.seekSaved = await page.evaluate(() => __store.seekSec); await page.selectOption('#seekSec', '5');
  // language toggle: switch, check re-render + persistence, switch back
  r.toggle = await page.evaluate(async () => { const b = document.getElementById("lang"); const before = [b.textContent, document.querySelector("[data-t=invert]").textContent];
    b.click(); await new Promise((z) => setTimeout(z, 50));
    const after = [b.textContent, document.querySelector("[data-t=invert]").textContent, document.querySelector("#seekSec option").textContent, document.querySelector("#siteList li .strong").parentNode.textContent, __store.uiLang];
    b.click(); await new Promise((z) => setTimeout(z, 50)); return { before, after, back: __store.uiLang }; });
  res[lang] = r;
  const h = await page.evaluate(() => document.body.scrollHeight); await page.setViewportSize({ width: 320, height: h });
  await page.screenshot({ path: `../docs/popup-${lang}.png` }); await page.close();
}
console.log(JSON.stringify(res, null, 1)); await browser.close();
