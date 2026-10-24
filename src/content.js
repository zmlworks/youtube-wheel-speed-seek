(() => {
  "use strict";
  if (window.__ytWheelControl) return;
  window.__ytWheelControl = true;

  const DEFAULTS = {
    enabled: true, speedOn: true, seekOn: true, blockHold: true, middleReset: true,
    speedStep: 0.25, seekSec: 5, invertSpeed: false, invertSeek: false, sites: []
  };
  const HOST = location.hostname;
  const IS_YT = /(^|\.)(youtube\.com|youtube-nocookie\.com)$/.test(HOST);
  const hostMatch = (d) => HOST === d || HOST.endsWith("." + d);
  const strongHere = () => !IS_YT && (cfg.sites || []).some((x) => x && x.strong && hostMatch(x.domain));
  // native getter captured at start (content scripts see native accessors anyway via Xray)
  const RATE = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "playbackRate");
  const realRate = (v) => RATE.get.call(v);

  // ---- strong mode bridge to MAIN-world script (main.js) ----
  const TOKEN = Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
  function sendInit() { window.dispatchEvent(new CustomEvent("ytwc-init", { detail: TOKEN })); }
  if (!IS_YT) {
    window.addEventListener("ytwc-ready", sendInit, { once: true });
    sendInit();
  }
  function strongSet(v, r) {
    // main.js answers on the element; if it isn't there, fall back to direct set
    v.dispatchEvent(new CustomEvent("ytwc-" + TOKEN, { detail: JSON.stringify({ op: r === null ? "reset" : "set", rate: r }) }));
  }
  const MIN_RATE = 0.1, MAX_RATE = 16;
  const cfg = Object.assign({}, DEFAULTS);
  try {
    chrome.storage.local.get(null, (s) => { Object.assign(cfg, s || {}); });
    chrome.storage.local.onChanged
      ? chrome.storage.local.onChanged.addListener((c) => { for (const k in c) cfg[k] = c[k].newValue; })
      : chrome.storage.onChanged.addListener((c) => { for (const k in c) cfg[k] = c[k].newValue; });
  } catch (e) { /* storage unavailable */ }

  // UI parts of the player where we must not interfere (seek bar, buttons, menus, ads, end screens)
  // Caption windows are draggable; must not run hold-cancel synthetic mouseup on them
  const UI_SEL = ".ytp-chrome-bottom,.ytp-chrome-top,.ytp-popup,.ytp-settings-menu,.ytp-contextmenu," +
    ".ytp-ce-element,.ytp-cards-teaser,.ytp-videowall-still,.ytp-autonav-endscreen-countdown-overlay," +
    ".ytp-caption-window-container,.caption-window," +
    "button,a,input,select,textarea,[role=button],[role=slider],.ytp-ad-overlay-container,.ytp-paid-content-overlay";
  const PLAYER_SEL = "#movie_player,.html5-video-player";

  // generic sites: largest <video> whose box contains the point
  function videoAt(x, y) {
    let best = null, area = 0;
    const list = document.querySelectorAll("video");
    for (const v of list) {
      const r = v.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom && r.width * r.height > area) { best = v; area = r.width * r.height; }
    }
    return best;
  }
  const playerOf = (t) => (t && t.closest ? t.closest(PLAYER_SEL) : null);
  const videoOf = (p) => (p ? p.querySelector("video") : null);
  // Point is over the "video surface" of a player (not its controls)
  function surface(t, e) {
    if (!IS_YT) {
      const v = videoAt(e.clientX, e.clientY);
      return v ? { player: null, video: v } : null;
    }
    if (!t || !t.closest) return null;
    const p = playerOf(t);
    if (!p) return t.tagName === "VIDEO" ? { player: t.parentElement, video: t } : null;
    if (t.closest(UI_SEL) && p.contains(t.closest(UI_SEL))) return null;
    const v = videoOf(p);
    return v ? { player: p, video: v } : null;
  }

  // ---- state ----
  const st = {
    left: null,   // {player, video, used, t0}
    right: null,  // {player, video, used, deferred, x, y, target}
    suppressClickUntil: 0,
    suppressMenuUntil: 0,
    acc: 0,
    passMenu: false
  };

  // ---- OSD ----
  let osd = null, osdTimer = 0, seekAcc = 0;
  function showOSD(player, text, video) {
    let host = player, pos = "absolute", top = "12%", left = "50%";
    if (!host) {
      host = document.fullscreenElement || document.body || document.documentElement;
      pos = "fixed";
      const r = video.getBoundingClientRect();
      top = Math.max(0, r.top + r.height * 0.12) + "px"; left = (r.left + r.width / 2) + "px";
    }
    if (!osd || !osd.isConnected || osd.parentNode !== host) {
      if (osd) osd.remove();
      osd = document.createElement("div");
      osd.className = "ytwc-osd";
      osd.setAttribute("style", "position:absolute;top:12%;left:50%;transform:translateX(-50%);z-index:2147483647;" +
        "background:rgba(0,0,0,.72);color:#fff;font:600 22px/1.2 'Roboto','Arial',sans-serif;padding:8px 16px;" +
        "border-radius:8px;pointer-events:none;transition:opacity .25s;opacity:0;white-space:nowrap");
      host.appendChild(osd);
    }
    osd.style.position = pos; osd.style.top = top; osd.style.left = left;
    osd.textContent = text;
    osd.style.opacity = "1";
    clearTimeout(osdTimer);
    osdTimer = setTimeout(() => { if (osd) osd.style.opacity = "0"; seekAcc = 0; }, 900);
  }
  const fmtRate = (r) => (Math.round(r * 100) / 100).toString() + "x";

  function setRate(v, player, r, reset) {
    r = Math.min(MAX_RATE, Math.max(MIN_RATE, Math.round(r * 100) / 100));
    if (strongHere()) strongSet(v, reset ? null : r);
    else { try { v.playbackRate = r; } catch (e) { /* out of range for this browser */ } }
    seekAcc = 0;
    showOSD(player, fmtRate(realRate(v)), v);
  }

  // wheel delta -> -1/0/+1 notches (accumulates touchpad pixel deltas)
  function notch(e) {
    let d = e.deltaY || e.deltaX;
    if (e.deltaMode === 0) {
      if (Math.sign(d) !== Math.sign(st.acc)) st.acc = 0;
      st.acc += d;
      if (Math.abs(st.acc) < 30) return 0;
      d = st.acc; st.acc = 0;
    }
    return d > 0 ? 1 : d < 0 ? -1 : 0; // +1 = wheel down
  }

  const opts = { capture: true };
  const optsActive = { capture: true, passive: false };

  let holdCancel = null;
  function cancelHold() {
    const h = holdCancel; if (!h) return; holdCancel = null;
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, composed: true, button: 0, buttons: 0, clientX: h.x, clientY: h.y, view: window }));
  }
  // runs after the page's own mousedown handlers (bubble phase on window); setTimeout above is the fallback
  window.addEventListener("mousedown", (e) => { if (e.isTrusted && e.button === 0) cancelHold(); }, false);

  window.addEventListener("mousedown", (e) => {
    if (!e.isTrusted) return;
    if (e.button === 0) st.suppressClickUntil = 0; // never carry a stale "drop next click" into a new press
    if (!cfg.enabled) return;
    if (e.button === 1 && st.left && cfg.middleReset && cfg.speedOn) {
      e.preventDefault(); e.stopImmediatePropagation();
      st.left.used = true;
      setRate(st.left.video, st.left.player, 1, true);
      return;
    }
    const s = surface(e.target, e);
    if (!s) return;
    if (e.button === 0) {
      st.left = { player: s.player, video: s.video, used: false, t0: e.timeStamp };
      // YouTube's hold-for-2x: its drag helper (g.mj) starts a 500 ms timer on mousedown and cancels it on
      // dragend (mouseup on document). v1.0-1.3 swallowed the mousedown, but YouTube's click handler ignores
      // clicks while Rd.RI is set, and RI is only cleared by the player's own mousedown handler, so after
      // seek-bar scrubbing / spacebar-hold every click on the video was ignored. Now the mousedown reaches
      // YouTube normally, and right after it we end the drag with a synthetic mouseup -> no 2x timer.
      if (IS_YT && cfg.blockHold) { holdCancel = { x: e.clientX, y: e.clientY }; setTimeout(cancelHold, 0); }
    } else if (e.button === 2) {
      st.right = { player: s.player, video: s.video, used: false, deferred: false, target: e.target, x: e.clientX, y: e.clientY, sx: e.screenX, sy: e.screenY };
    }
  }, opts);

  window.addEventListener("touchstart", (e) => {
    if (IS_YT && cfg.enabled && cfg.blockHold && e.isTrusted && surface(e.target, e)) e.stopImmediatePropagation();
  }, { capture: true, passive: true });

  window.addEventListener("mouseup", (e) => {
    if (!e.isTrusted) return;
    if (e.button === 0 && st.left) {
      // only a press during which the wheel / middle button was used swallows its click
      if (st.left.used) st.suppressClickUntil = e.timeStamp + 600;
      st.left = null;
    } else if (e.button === 2 && st.right) {
      const r = st.right;
      st.right = null;
      if (r.used) { st.suppressMenuUntil = e.timeStamp + 600; return; }
      if (r.deferred) {
        // Linux/macOS fire contextmenu on mousedown; we held it back. No wheel used -> replay it
        // so YouTube's own menu opens.
        st.passMenu = true;
        try {
          r.target.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, composed: true,
            button: 2, buttons: 0, clientX: r.x, clientY: r.y, screenX: r.sx, screenY: r.sy, view: window }));
        } finally { st.passMenu = false; }
      }
    }
  }, opts);

  window.addEventListener("click", (e) => {
    if (e.button === 0 && st.suppressClickUntil && e.timeStamp <= st.suppressClickUntil) {
      st.suppressClickUntil = 0;
      e.preventDefault(); e.stopImmediatePropagation();
    }
  }, opts);

  window.addEventListener("contextmenu", (e) => {
    if (st.passMenu || !cfg.enabled || !cfg.seekOn) return;
    if (st.right) {
      // fired while the button is still held (Linux/mac): hold back until we know if wheel is used
      st.right.deferred = true;
      e.preventDefault(); e.stopImmediatePropagation();
    } else if (st.suppressMenuUntil && e.timeStamp <= st.suppressMenuUntil) {
      st.suppressMenuUntil = 0;
      e.preventDefault(); e.stopImmediatePropagation();
    }
  }, opts);

  window.addEventListener("wheel", (e) => {
    if (!cfg.enabled) return;
    const leftHeld = !!st.left, rightHeld = !!st.right;
    if (leftHeld && cfg.speedOn) {
      e.preventDefault(); e.stopImmediatePropagation();
      const n = notch(e); if (!n) return;
      st.left.used = true;
      const dir = (cfg.invertSpeed ? 1 : -1) * n; // default: wheel up (n=-1) = faster
      const v = st.left.video, step = Number(cfg.speedStep) || 0.25;
      let r = realRate(v) + dir * step;
      r = Math.round(r / step) * step || (dir > 0 ? step : MIN_RATE);
      setRate(v, st.left.player, r);
    } else if (rightHeld && cfg.seekOn) {
      e.preventDefault(); e.stopImmediatePropagation();
      const n = notch(e); if (!n) return;
      st.right.used = true;
      const dir = (cfg.invertSeek ? 1 : -1) * n; // default (v1.1): wheel up = forward
      const v = st.right.video, sec = Number(cfg.seekSec) || 5;
      const dur = isFinite(v.duration) ? v.duration : Infinity;
      const cur = v.currentTime;
      const t = Math.min(Math.max(0, cur + dir * sec), Math.max(0, dur - 0.1));
      v.currentTime = t;
      // net seek amount while the OSD stays visible: +5s, +10s, ... reverse subtracts
      seekAcc = Math.round((seekAcc + (t - cur)) * 10) / 10;
      showOSD(st.right.player, (seekAcc > 0 ? "+" : seekAcc < 0 ? "-" : "±") + Math.abs(seekAcc) + "s", v);
    }
  }, optsActive);

  // ---- preset speed buttons in the popup ----
  let lastVideo = null, lastMove = 0;
  window.addEventListener("mousemove", (e) => {
    if (e.timeStamp - lastMove < 150) return; lastMove = e.timeStamp;
    const s = surface(e.target, e); if (s) lastVideo = s.video;
  }, { capture: true, passive: true });
  function targetVideo() {
    const vis = (v) => { const r = v.getBoundingClientRect(); return r.width > 40 && r.height > 30; };
    if (lastVideo && lastVideo.isConnected && vis(lastVideo)) return lastVideo;
    let best = null, score = 0;
    for (const v of document.querySelectorAll("video")) {
      if (!vis(v)) continue;
      const r = v.getBoundingClientRect();
      const sc = r.width * r.height * (v.paused ? 1 : 4) * (v.readyState > 0 ? 2 : 1);
      if (sc > score) { score = sc; best = v; }
    }
    return best;
  }
  try {
    chrome.runtime.onMessage.addListener((m, sender, send) => {
      if (!m || (m.type !== "ytwc-preset" && m.type !== "ytwc-get")) return false;
      const v = targetVideo();
      if (!v) { if (!m.sub) send({ ok: false, reason: "noVideo" }); return false; }
      if (m.type === "ytwc-preset") {
        const r = Number(m.rate);
        if (!(r > 0)) return false;
        setRate(v, IS_YT ? playerOf(v) : null, r, r === 1);
      }
      send({ ok: true, rate: realRate(v) });
      return false;
    });
  } catch (e) { /* no runtime (tests) */ }

  // button released outside the window: drop stale state
  window.addEventListener("mousemove", (e) => {
    if (st.left && !(e.buttons & 1)) st.left = null;
    if (st.right && !(e.buttons & 2)) st.right = null;
  }, { capture: true, passive: true });

  // leaving the window with a button held: reset state
  window.addEventListener("blur", () => { st.left = st.right = null; });
})();
