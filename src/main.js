// MAIN-world helper, injected ONLY on whitelisted sites with "strong mode" on (never on YouTube).
// Hides the add-on's playback speed from the page: the page keeps seeing/setting its own "page rate",
// and ratechange events caused by the add-on never reach page listeners.
(() => {
  "use strict";
  if (window.__ytwcMain || /(^|\.)(youtube\.com|youtube-nocookie\.com)$/.test(location.hostname)) return;
  Object.defineProperty(window, "__ytwcMain", { value: true });
  const P = HTMLMediaElement.prototype;
  const RATE = Object.getOwnPropertyDescriptor(P, "playbackRate");
  const DEF = Object.getOwnPropertyDescriptor(P, "defaultPlaybackRate");
  const st = new WeakMap(); // el -> { override, pageRate, pageDefault, pending }
  const S = (el) => { let s = st.get(el); if (!s) { s = { override: null, pageRate: null, pageDefault: null, pending: 0 }; st.set(el, s); } return s; };

  Object.defineProperty(P, "playbackRate", {
    configurable: true, enumerable: RATE.enumerable,
    get: function playbackRate() {
      const s = st.get(this);
      return s && s.override !== null ? s.pageRate : RATE.get.call(this);
    },
    set: function playbackRate(v) {
      const s = st.get(this);
      if (s && s.override !== null) {
        const n = Number(v);
        if (!isFinite(n)) return RATE.set.call(this, v); // let native throw the same error
        s.pageRate = n; // recorded, not applied
        return;
      }
      RATE.set.call(this, v);
    }
  });
  Object.defineProperty(P, "defaultPlaybackRate", {
    configurable: true, enumerable: DEF.enumerable,
    get: function defaultPlaybackRate() {
      const s = st.get(this);
      return s && s.override !== null && s.pageDefault !== null ? s.pageDefault : DEF.get.call(this);
    },
    set: function defaultPlaybackRate(v) {
      const s = st.get(this);
      if (s && s.override !== null) { s.pageDefault = Number(v); return; }
      DEF.set.call(this, v);
    }
  });

  // ratechange doesn't bubble, but a window capture listener added first runs before any page listener.
  window.addEventListener("ratechange", (e) => {
    const s = st.get(e.target);
    if (s && s.pending > 0) { s.pending--; e.stopImmediatePropagation(); }
  }, true);

  function apply(el, cmd) {
    const s = S(el);
    const cur = RATE.get.call(el);
    if (cmd.op === "set") {
      if (s.override === null) { s.pageRate = cur; s.pageDefault = null; }
      s.override = Number(cmd.rate);
      if (cur !== s.override) { s.pending++; RATE.set.call(el, s.override); }
    } else if (cmd.op === "reset") {
      const pr = s.pageRate;
      s.override = null;
      // back to 1x; page sees the change only if its own value differed
      if (cur !== 1) { if (pr === 1) s.pending++; RATE.set.call(el, 1); }
    }
  }

  // Re-apply if something native (e.g. a new source/load) resets the real rate while overriding.
  window.addEventListener("loadstart", (e) => {
    const s = st.get(e.target);
    if (s && s.override !== null) setTimeout(() => { if (s.override !== null && RATE.get.call(e.target) !== s.override) { s.pending++; RATE.set.call(e.target, s.override); } }, 0);
  }, true);

  // Handshake: accept exactly one token from the isolated content script.
  let token = null;
  function onInit(e) {
    if (token || typeof e.detail !== "string") return;
    token = e.detail;
    window.removeEventListener("ytwc-init", onInit, true);
    window.addEventListener("ytwc-" + token, (ev) => {
      ev.stopImmediatePropagation();
      const el = ev.target;
      if (!(el instanceof HTMLMediaElement)) return;
      try { apply(el, JSON.parse(ev.detail)); } catch (x) { /* ignore */ }
    }, true);
  }
  window.addEventListener("ytwc-init", onInit, true);
  window.dispatchEvent(new Event("ytwc-ready"));
})();
