"use strict";
const api = typeof browser !== "undefined" ? browser : chrome;
const DEFAULTS = {
  enabled: true, speedOn: true, seekOn: true, blockHold: true, middleReset: true,
  speedStep: 0.25, seekSec: 5, invertSpeed: false, invertSeek: false, swapButtons: false,
  abOn: true, abKeyA: "[", abKeyB: "]", abKeyClear: "\\"
};
// Own string table so the language can be switched at runtime (_locales cannot).
const STR = {
  ja: { enabled: "アドオンを有効にする", speedOn: "左ホールド + ホイールで速度変更", seekOn: "右ホールド + ホイールでシーク", invert: "反転", sec: "秒",
    middleReset: "左ホールド + 中クリックで1倍速に戻す", blockHold: "YouTubeの長押し2倍速を無効化", add: "追加", strong: "強力",
    speedOnR: "右ホールド + ホイールで速度変更", seekOnL: "左ホールド + ホイールでシーク", middleResetR: "右ホールド + 中クリックで1倍速に戻す",
    swapButtons: "左右反転", abOn: "区間リピート (A-B)", abKeyA: "A点を設定", abKeyB: "B点を設定（リピート開始）", abKeyClear: "区間リピート解除",
    keyUnset: "未設定", keyHint: "クリックしてキーを押す（Backspaceで未設定）",
    del: "削除", domainPh: "ドメイン（例: nicovideo.jp）", noSites: "追加サイトなし", permDenied: "権限が許可されませんでした",
    badDomain: "ドメインが正しくありません", ytBuiltin: "YouTubeは標準で対象です",
    noVideo: "動画がありません", notSupported: "このタブでは使えません（再読み込みで有効になる場合があります）",
    strongTip: "強力モード: サイトが速度を戻す場合に使用", reload: "タブを再読み込みすると有効になります" },
  en: { enabled: "Enable add-on", speedOn: "Hold left + wheel: change speed", seekOn: "Hold right + wheel: seek", invert: "Invert", sec: "s",
    middleReset: "Hold left + middle click: reset to 1x", blockHold: "Disable YouTube's hold-for-2x", add: "Add", strong: "Strong",
    speedOnR: "Hold right + wheel: change speed", seekOnL: "Hold left + wheel: seek", middleResetR: "Hold right + middle click: reset to 1x",
    swapButtons: "Swap left/right buttons", abOn: "A-B section repeat", abKeyA: "Set point A", abKeyB: "Set point B (start loop)", abKeyClear: "Clear A-B repeat",
    keyUnset: "Not set", keyHint: "Click, then press a key (Backspace: unset)",
    del: "Remove", domainPh: "Domain (e.g. nicovideo.jp)", noSites: "No extra sites", permDenied: "Permission was not granted",
    badDomain: "Invalid domain", ytBuiltin: "YouTube is built in",
    noVideo: "No video", notSupported: "Not available on this tab (try reloading it)",
    strongTip: "Strong mode: for sites that reset the speed", reload: "Reload the tab to apply" }
};
// typed numeric settings: [min, max, decimals]; invalid input restores the saved value (nothing is written)
const NUM_RANGE = { speedStep: [0.01, 4, 2], seekSec: [0.5, 3600, 1] };
const KEY_IDS = ["abKeyA", "abKeyB", "abKeyClear"];
let lang = (navigator.language || "ja").toLowerCase().startsWith("ja") ? "ja" : "en";
try { const ui = chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage(); if (ui) lang = ui.toLowerCase().startsWith("ja") ? "ja" : "en"; } catch (e) { /* ignore */ }
const msg = (k) => (STR[lang] && STR[lang][k]) || STR.en[k] || k;
let cfg = Object.assign({}, DEFAULTS);

function renderStatic() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-t]").forEach((el) => { el.textContent = msg(el.dataset.t); });
  document.getElementById("lang").textContent = lang === "ja" ? "EN" : "JA";
  document.getElementById("lang").title = lang === "ja" ? "English" : "日本語";
  document.getElementById("domainIn").placeholder = msg("domainPh");
  renderSwap(); renderKeys(); renderSites();
  document.querySelectorAll(".status").forEach((el) => { if (el.dataset.k) el.textContent = msg(el.dataset.k); });
}
// labels follow the swap setting (middle reset follows the speed button)
function renderSwap() {
  const sw = !!cfg.swapButtons;
  const set = (id, k) => { const el = document.querySelector("#" + id + " + span"); el.dataset.t = k; el.textContent = msg(k); };
  set("speedOn", sw ? "speedOnR" : "speedOn"); set("seekOn", sw ? "seekOnL" : "seekOn"); set("middleReset", sw ? "middleResetR" : "middleReset");
}
function renderKeys() {
  for (const id of KEY_IDS) { const el = document.getElementById(id); el.value = cfg[id] || ""; el.placeholder = msg("keyUnset"); el.title = msg("keyHint"); }
}
// must match content.js keyName()
function keyName(e) {
  let k = e.key;
  if (!k || k === "Unidentified" || k === "Dead" || k === "Process" || /^(Shift|Control|Alt|Meta|OS|AltGraph|CapsLock)$/.test(k)) return "";
  if (k === " ") k = "Space";
  const letter = k.length === 1 && /[a-z]/i.test(k), named = k.length > 1;
  if (letter) k = k.toUpperCase();
  return (e.ctrlKey ? "Ctrl+" : "") + (e.altKey ? "Alt+" : "") + (e.metaKey ? "Meta+" : "") + (e.shiftKey && (letter || named) ? "Shift+" : "") + k;
}
const setStatus = (el, k) => { el.dataset.k = k || ""; el.textContent = k ? msg(k) : ""; };

document.getElementById("lang").addEventListener("click", () => {
  lang = lang === "ja" ? "en" : "ja";
  chrome.storage.local.set({ uiLang: lang });
  renderStatic();
});

chrome.storage.local.get(null, (s) => {
  s = s || {};
  if (s.uiLang === "ja" || s.uiLang === "en") lang = s.uiLang;
  cfg = Object.assign({}, DEFAULTS, s);
  renderStatic();
  for (const k of Object.keys(DEFAULTS)) {
    const el = document.getElementById(k);
    if (!el) continue;
    if (KEY_IDS.includes(k)) { bindKey(el, k); continue; }
    if (el.type === "checkbox") el.checked = !!cfg[k];
    else el.value = String(cfg[k]);
    el.addEventListener("change", () => {
      let v = el.type === "checkbox" ? el.checked : Number(el.value);
      if (NUM_RANGE[k]) {
        const [lo, hi, dec] = NUM_RANGE[k], raw = el.value.trim().replace(/,/g, ".");
        v = raw === "" ? NaN : Number(raw);
        if (isFinite(v)) v = Math.round(v * 10 ** dec) / 10 ** dec;
        if (!(isFinite(v) && v >= lo && v <= hi)) { el.value = String(cfg[k]); return; } // keep the saved value
        el.value = String(v);
      }
      cfg[k] = v;
      chrome.storage.local.set({ [k]: v });
      if (k === "swapButtons") renderSwap();
    });
  }
});

// key capture fields: click, then press a key; Backspace/Delete/Esc = unset; Tab moves focus
function bindKey(el, k) {
  el.addEventListener("keydown", (e) => {
    if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) return;
    e.preventDefault(); e.stopPropagation();
    let name;
    if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && (e.key === "Backspace" || e.key === "Delete" || e.key === "Escape")) name = "";
    else { name = keyName(e); if (!name) return; }
    const upd = { [k]: name };
    // one key, one action: a key already used by another A-B action is taken away from it
    if (name) for (const o of KEY_IDS) if (o !== k && cfg[o] === name) upd[o] = "";
    Object.assign(cfg, upd);
    chrome.storage.local.set(upd);
    renderKeys();
  });
}

// ---- extra sites whitelist ----
const MULTI_SLD = /^(co|or|ne|ac|go|ed|gr|lg|ad|com|net|org|gov|edu)$/;
function siteDomain(host) {
  host = host.toLowerCase().replace(/\.$/, "");
  if (/^[\d.]+$/.test(host) || host.indexOf(".") < 0) return host;
  const p = host.split(".");
  const n = p.length >= 3 && p[p.length - 1].length === 2 && MULTI_SLD.test(p[p.length - 2]) ? 3 : 2;
  return p.slice(-n).join(".");
}
function normalizeInput(s) {
  s = (s || "").trim().toLowerCase();
  if (!s) return "";
  try { if (/^[a-z][a-z0-9+.-]*:\/\//.test(s)) s = new URL(s).hostname; } catch (e) { return ""; }
  s = s.replace(/^\*\./, "").replace(/^www\./, "").split(/[/:?#]/)[0];
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) ? s : "";
}
const isYT = (d) => /(^|\.)(youtube\.com|youtube-nocookie\.com)$/.test(d);
const originsFor = (d) => ["*://" + d + "/*", "*://*." + d + "/*"];
let sites = [];
const statusEl = document.getElementById("status");
const say = (k) => setStatus(statusEl, k);

function renderSites() {
  const ul = document.getElementById("siteList");
  ul.textContent = "";
  if (!sites.length) { const li = document.createElement("li"); li.className = "empty"; li.textContent = msg("noSites"); ul.appendChild(li); return; }
  sites.forEach((s, i) => {
    const li = document.createElement("li");
    const d = document.createElement("span"); d.className = "d"; d.textContent = s.domain; d.title = s.domain;
    const lb = document.createElement("label"); lb.title = msg("strongTip");
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = !!s.strong; cb.className = "strong";
    cb.addEventListener("change", () => { sites[i] = Object.assign({}, s, { strong: cb.checked }); save(); say("reload"); });
    lb.append(cb, document.createTextNode(msg("strong")));
    const del = document.createElement("button"); del.type = "button"; del.className = "del"; del.textContent = msg("del");
    del.addEventListener("click", () => {
      sites.splice(i, 1); save();
      try { api.permissions.remove({ origins: originsFor(s.domain) }); } catch (e) { /* ignore */ }
    });
    li.append(d, lb, del); ul.appendChild(li);
  });
}
function save() { chrome.storage.local.set({ sites: sites.slice() }); renderSites(); }
// permissions.request must be called synchronously inside the click handler (user gesture).
function addDomain(d) {
  say("");
  if (!d) return say("badDomain");
  if (isYT(d)) return say("ytBuiltin");
  if (sites.some((s) => s.domain === d)) return;
  let p;
  try { p = api.permissions.request({ origins: originsFor(d) }); } catch (e) { return say("permDenied"); }
  Promise.resolve(p).then((ok) => {
    if (!ok) return say("permDenied");
    sites.push({ domain: d, strong: false }); save(); say("reload");
  }, () => say("permDenied"));
}
document.getElementById("addBtn").addEventListener("click", () => {
  const el = document.getElementById("domainIn"); const d = normalizeInput(el.value);
  addDomain(d); if (d) el.value = "";
});
chrome.storage.local.get("sites", (s) => { sites = Array.isArray(s && s.sites) ? s.sites : []; renderSites(); });
(async () => {
  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    const u = new URL(tab.url);
    if (!/^https?:$/.test(u.protocol)) throw 0;
    const d = siteDomain(u.hostname);
    if (!isYT(d)) { const inp = document.getElementById("domainIn"); if (!inp.value) inp.value = d; }
  } catch (e) { /* not available */ }
})();

// ---- preferred speed buttons ----
const PRESET_DEFAULT = [1, 2, 3];
let presets = PRESET_DEFAULT.slice(), curRate = null, activeTabId = null;
const pStatus = document.getElementById("presetStatus");
const fmt = (r) => (Math.round(r * 100) / 100) + "x";
function drawPresets() {
  document.querySelectorAll("button.preset").forEach((b) => {
    const r = presets[b.dataset.i]; b.textContent = fmt(r);
    b.classList.toggle("cur", curRate !== null && Math.abs(curRate - r) < 0.001);
  });
  document.querySelectorAll(".presetIn").forEach((el) => { if (document.activeElement !== el) el.value = String(presets[el.dataset.i]); });
}
async function toTab(msgObj) {
  if (activeTabId === null) { const [t] = await api.tabs.query({ active: true, currentWindow: true }); activeTabId = t ? t.id : -1; }
  if (activeTabId < 0) throw new Error("notab");
  // top frame first; if it has no video, ask sub frames (only frames with a video answer)
  const top = await api.tabs.sendMessage(activeTabId, msgObj, { frameId: 0 }).catch(() => null);
  if (top && top.ok) return top;
  const any = await api.tabs.sendMessage(activeTabId, Object.assign({ sub: true }, msgObj)).catch(() => null);
  if (any && any.ok) return any;
  if (top || any) return { ok: false, reason: "noVideo" };
  throw new Error("notSupported");
}
document.querySelectorAll("button.preset").forEach((b) => b.addEventListener("click", async () => {
  setStatus(pStatus, "");
  try {
    const r = await toTab({ type: "ytwc-preset", rate: presets[b.dataset.i] });
    if (!r.ok) setStatus(pStatus, r.reason || "noVideo"); else curRate = r.rate;
  } catch (e) { setStatus(pStatus, "notSupported"); }
  drawPresets();
}));
document.getElementById("editP").addEventListener("click", () => {
  const e = document.getElementById("presetEdit"); e.hidden = !e.hidden;
});
document.querySelectorAll(".presetIn").forEach((el) => el.addEventListener("change", () => {
  let v = Math.round(Number(el.value) * 100) / 100;
  if (!(v >= 0.1 && v <= 16)) v = PRESET_DEFAULT[el.dataset.i];
  presets[el.dataset.i] = v; el.value = String(v);
  chrome.storage.local.set({ presets: presets.slice() }); drawPresets();
}));
chrome.storage.local.get("presets", (s) => {
  if (s && Array.isArray(s.presets) && s.presets.length === 3) presets = s.presets.map((x, i) => Number(x) > 0 ? Number(x) : PRESET_DEFAULT[i]);
  drawPresets();
  toTab({ type: "ytwc-get" }).then((r) => { if (r.ok) { curRate = r.rate; drawPresets(); } }, () => {});
});
