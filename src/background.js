"use strict";
// Keeps dynamically registered content scripts in sync with the whitelist in storage.
const api = typeof browser !== "undefined" ? browser : chrome;
const PREFIX = "ytwc-";
const originsFor = (d) => ["*://" + d + "/*", "*://*." + d + "/*"];
const idOf = (kind, d) => PREFIX + kind + "-" + d;

async function sync() {
  const { sites = [] } = await api.storage.local.get("sites");
  const have = (await api.scripting.getRegisteredContentScripts()).map((s) => s.id).filter((id) => id.startsWith(PREFIX));
  if (have.length) await api.scripting.unregisterContentScripts({ ids: have });
  const regs = [];
  for (const s of sites) {
    if (!s || !s.domain || /(^|\.)(youtube\.com|youtube-nocookie\.com)$/.test(s.domain)) continue;
    const origins = originsFor(s.domain);
    if (!(await api.permissions.contains({ origins }))) continue;
    regs.push({ id: idOf("gen", s.domain), matches: origins, js: ["content.js"], runAt: "document_start", allFrames: true, persistAcrossSessions: true });
    if (s.strong) regs.push({ id: idOf("main", s.domain), matches: origins, js: ["main.js"], runAt: "document_start", allFrames: true, world: "MAIN", persistAcrossSessions: true });
  }
  for (const r of regs) {
    try { await api.scripting.registerContentScripts([r]); } catch (e) { console.warn("ytwc register failed", r.id, e); }
  }
  return regs.map((r) => r.id);
}
let chain = Promise.resolve();
const queue = () => (chain = chain.then(sync, sync));
api.storage.onChanged.addListener((c, area) => { if (area === "local" && c.sites) queue(); });
api.permissions.onRemoved && api.permissions.onRemoved.addListener(queue);
api.runtime.onStartup.addListener(queue);
api.runtime.onInstalled.addListener(queue);
if (typeof module !== "undefined") module.exports = { sync };
