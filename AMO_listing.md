# AMO listing — YouTube Wheel Speed & Seek 1.5.1

- **Name:** YouTube Wheel Speed & Seek (26 chars)
- **Add-on ID:** youtube.wheel.control@kofu.com
- **Slug / listing URL:** [youtube-wheel-speed-seek](https://addons.mozilla.org/firefox/addon/youtube-wheel-speed-seek/) (public; current AMO version was 1.5.0 as of 2026-10-24)
- **Developer edit:** https://addons.mozilla.org/en-US/developers/addon/youtube-wheel-speed-seek/
- **Version:** 1.5.1 — strict_min_version Firefox 128 (needed for `scripting` `world: "MAIN"`)
- **Category:** Photos, Music & Videos
- **License:** MIT
- **Source code:** not minified/transpiled — the uploaded zip *is* the source; no separate source upload needed.

## What's new / リリースノート (AMO "What's new" field)

### ja
字幕が動画面扱いされなくなり、YouTube純正の字幕ドラッグが再び使えます。長押し2倍速の無効化とホイール操作は変更ありません。

### en
Captions are no longer treated as the video surface, so native YouTube caption drag works again. Hold-to-2x disable and wheel controls are unchanged.

## Summary
- **ja:** ボタンを押しながらホイールでYouTubeなどの動画の再生速度とシークを操作し、長押し2倍速を無効化します。
- **en:** Hold a mouse button and scroll to change speed or seek on YouTube and other video sites; disables hold-for-2x.

## Description (ja)
- 左ボタンを押したままホイール：再生速度を変更（0.1〜16倍、刻みは選択可）
- 左ボタン＋中クリック：1倍速に戻す
- 右ボタンを押したままホイール：シーク（秒数は選択可、+5s / -5s と表示）。ホイールを使ったときは右クリックメニューを出しません
- YouTubeの「長押しで2倍速」を無効化（通常のクリック・ダブルクリックはそのまま）
- お気に入り速度ボタン（初期値 1x / 2x / 3x、編集可）
- YouTube以外のサイトも追加可能。サイトが速度を戻してしまう場合は「強力モード」で維持
- 日本語 / English 切替、データ収集なし

## Description (en)
- Hold left button + wheel: change playback speed (0.1–16x, selectable step)
- Hold left + middle click: reset to 1x
- Hold right button + wheel: seek (selectable seconds, shown as +5s / -5s); the context menu is suppressed when the wheel was used
- Disables YouTube's press-and-hold 2x (normal click / double-click still work)
- Preferred speed buttons (1x / 2x / 3x by default, editable)
- Add other video sites; "Strong mode" keeps your speed on sites that reset it
- Japanese / English UI, no data collection

## Notes for reviewers
- Built-in host permissions: `*://*.youtube.com/*`, `*://*.youtube-nocookie.com/*` only.
- `optional_host_permissions: ["*://*/*"]` is **never requested at install**. It is requested per domain
  (`*://example.com/*`, `*://*.example.com/*`) only when the user clicks "Add current site"/"Add" in the popup,
  and removed when the user deletes the entry. `background.js` then registers `content.js` for those domains via
  `scripting.registerContentScripts`.
- `main.js` (MAIN world) is registered only for domains where the user enabled "Strong mode"; it wraps
  `HTMLMediaElement.prototype.playbackRate/defaultPlaybackRate` so the page can't override the user's chosen speed.
  It is never injected on YouTube.
- `activeTab`/`tabs.query` are used only to read the current tab's hostname for "Add current site" and to message the
  tab's content script for the preferred-speed buttons. `storage` holds settings only. No network requests, no remote code.
- v1.5.1: caption containers (`.ytp-caption-window-container`, `.caption-window`) are excluded from the video-surface
  hit test, so the hold-cancel synthetic `mouseup` and wheel handlers do not run on captions.
