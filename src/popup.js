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
