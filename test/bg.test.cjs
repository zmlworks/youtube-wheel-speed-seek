const reg = new Map(); let store = { sites: [{ domain: "nicovideo.jp", strong: true }, { domain: "example.com", strong: false }, { domain: "nogrant.org" }, { domain: "youtube.com", strong: true }] };
const L = {}; const ev = (n) => ({ addListener: (f) => (L[n] = f) });
global.browser = { storage: { local: { get: async () => store }, onChanged: ev("st") },
  scripting: { getRegisteredContentScripts: async () => [...reg.values()], unregisterContentScripts: async ({ ids }) => ids.forEach((i) => reg.delete(i)),
    registerContentScripts: async (a) => a.forEach((r) => reg.set(r.id, r)) },
  permissions: { contains: async ({ origins }) => !origins[0].includes("nogrant"), onRemoved: ev("pr") },
  runtime: { onStartup: ev("su"), onInstalled: ev("oi") } };
const { sync } = require("../src/background.js");
(async () => {
  await sync(); console.log("1:", [...reg.values()].map((r) => `${r.id} world=${r.world || "ISOLATED"} ${r.matches.join(",")}`));
  store = { sites: [{ domain: "nicovideo.jp", strong: false }] }; await sync(); console.log("2 (strong off, example removed):", [...reg.keys()]);
  store = { sites: [] }; await sync(); console.log("3 (all removed):", [...reg.keys()]);
})();
