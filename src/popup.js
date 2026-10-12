"use strict";
const DEFAULTS = {
  enabled: true, speedOn: true, seekOn: true, blockHold: true, middleReset: true,
  speedStep: 0.25, seekSec: 5, invertSpeed: false, invertSeek: false
};
const msg = (k) => (chrome.i18n && chrome.i18n.getMessage(k)) || k;
document.documentElement.lang = (chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage().startsWith("en")) ? "en" : "ja";
document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = msg(el.dataset.i18n); });
document.title = msg("extName");

chrome.storage.local.get(null, (s) => {
  const c = Object.assign({}, DEFAULTS, s || {});
  for (const k of Object.keys(DEFAULTS)) {
    const el = document.getElementById(k);
    if (!el) continue;
    if (el.type === "checkbox") el.checked = !!c[k];
    else el.value = String(c[k]);
    el.addEventListener("change", () => {
      let v;
      if (el.type === "checkbox") v = el.checked;
      else {
        v = Number(el.value);
        if (k === "seekSec") { v = Math.min(600, Math.max(1, Math.round(v) || 5)); el.value = v; }
        if (k === "speedStep" && !(v > 0)) v = 0.25;
      }
      chrome.storage.local.set({ [k]: v });
    });
  }
});

// ---- extra sites whitelist ----
const api = typeof browser !== "undefined" ? browser : chrome;
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
const say = (k) => { statusEl.textContent = k ? msg(k) : ""; };

function render() {
  const ul = document.getElementById("siteList");
  ul.textContent = "";
  if (!sites.length) { const li = document.createElement("li"); li.textContent = msg("noSites"); ul.appendChild(li); return; }
  sites.forEach((s, i) => {
    const li = document.createElement("li");
    const d = document.createElement("span"); d.className = "d"; d.textContent = s.domain; d.title = s.domain;
    const lb = document.createElement("label"); const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = !!s.strong;
    cb.className = "strong"; cb.addEventListener("change", () => { sites[i] = Object.assign({}, s, { strong: cb.checked }); save(); });
    lb.append(cb, document.createTextNode(msg("strong")));
    const del = document.createElement("button"); del.type = "button"; del.className = "del"; del.textContent = msg("del");
    del.addEventListener("click", () => {
      sites.splice(i, 1); save();
      // drop the host permission unless another entry still needs it
      try { api.permissions.remove({ origins: originsFor(s.domain) }); } catch (e) { /* ignore */ }
    });
    li.append(d, lb, del); ul.appendChild(li);
  });
}
function save() { chrome.storage.local.set({ sites: sites.slice() }); render(); }

// Must call permissions.request synchronously inside the click handler (user gesture).
function addDomain(d) {
  say("");
  if (!d) return say("badDomain");
  if (isYT(d)) return say("ytBuiltin");
  if (sites.some((s) => s.domain === d)) return;
  let p;
  try { p = api.permissions.request({ origins: originsFor(d) }); } catch (e) { return say("permDenied"); }
  Promise.resolve(p).then((ok) => {
    if (!ok) return say("permDenied");
    sites.push({ domain: d, strong: false }); save();
  }, () => say("permDenied"));
}
let curDomain = "";
document.getElementById("addCurrent").addEventListener("click", () => addDomain(curDomain));
document.getElementById("addBtn").addEventListener("click", () => {
  const el = document.getElementById("domainIn"); const d = normalizeInput(el.value);
  addDomain(d); if (d) el.value = "";
});
document.getElementById("domainIn").placeholder = msg("domainPh");
chrome.storage.local.get("sites", (s) => { sites = Array.isArray(s && s.sites) ? s.sites : []; render(); });
(async () => {
  const btn = document.getElementById("addCurrent");
  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    const u = new URL(tab.url);
    if (!/^https?:$/.test(u.protocol)) throw 0;
    curDomain = siteDomain(u.hostname);
    if (isYT(curDomain)) throw 0;
    document.getElementById("curDomain").textContent = "(" + curDomain + ")";
  } catch (e) { btn.disabled = true; btn.title = msg("curNA"); }
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
  pStatus.textContent = "";
  try {
    const r = await toTab({ type: "ytwc-preset", rate: presets[b.dataset.i] });
    if (!r.ok) pStatus.textContent = msg(r.reason || "noVideo"); else curRate = r.rate;
  } catch (e) { pStatus.textContent = msg("notSupported"); }
  drawPresets();
}));
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
