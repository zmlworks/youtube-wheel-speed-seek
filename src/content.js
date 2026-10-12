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
  const UI_SEL = ".ytp-chrome-bottom,.ytp-chrome-top,.ytp-popup,.ytp-settings-menu,.ytp-contextmenu," +
    ".ytp-ce-element,.ytp-cards-teaser,.ytp-videowall-still,.ytp-autonav-endscreen-countdown-overlay," +
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
  let osd = null, osdTimer = 0;
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
    osdTimer = setTimeout(() => { if (osd) osd.style.opacity = "0"; }, 900);
  }
  const fmtTime = (s) => {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`;
  };
  const fmtRate = (r) => (Math.round(r * 100) / 100).toString() + "x";

  function setRate(v, player, r, reset) {
    r = Math.min(MAX_RATE, Math.max(MIN_RATE, Math.round(r * 100) / 100));
    if (strongHere()) strongSet(v, reset ? null : r);
    else { try { v.playbackRate = r; } catch (e) { /* out of range for this browser */ } }
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

  window.addEventListener("mousedown", (e) => {
    if (!cfg.enabled || !e.isTrusted) return;
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
      // YouTube starts its 500 ms "hold = 2x" timer from a mousedown listener on the player root.
      // Swallowing mousedown here (window, capture) means that listener never runs. The default
      // action is NOT prevented, so focus/click/dblclick still happen normally.
      if (IS_YT && cfg.blockHold) e.stopImmediatePropagation();
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
      // wheel used, or a long press (would have been YouTube's 2x hold): don't let the click pause
      if (st.left.used || (IS_YT && cfg.blockHold && e.timeStamp - st.left.t0 > 500)) st.suppressClickUntil = e.timeStamp + 600;
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
      const t = Math.min(Math.max(0, v.currentTime + dir * sec), Math.max(0, dur - 0.1));
      v.currentTime = t;
      showOSD(st.right.player, (dir > 0 ? "▶▶ " : "◀◀ ") + fmtTime(t) + (isFinite(dur) ? " / " + fmtTime(dur) : ""), v);
    }
  }, optsActive);

  // button released outside the window: drop stale state
  window.addEventListener("mousemove", (e) => {
    if (st.left && !(e.buttons & 1)) st.left = null;
    if (st.right && !(e.buttons & 2)) st.right = null;
  }, { capture: true, passive: true });

  // leaving the window with a button held: reset state
  window.addEventListener("blur", () => { st.left = st.right = null; });
})();
