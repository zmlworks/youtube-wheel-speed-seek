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
