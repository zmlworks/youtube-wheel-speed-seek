# YouTube Wheel Speed & Seek (youtube.wheel.control@kofu.com)

*Firefox add-on: hold left button + wheel to change playback speed, hold right button + wheel to seek on YouTube and other video sites.*

- 左ボタン長押し＋ホイール: 再生速度（上で速く、0.1〜16x）。左＋中クリックで 1x。
- 右ボタン長押し＋ホイール: シーク（既定: 上で進む）。ホイールを使った場合は右クリックメニューを出さない。
- YouTube: 長押し2倍速を無効化（プレーヤーへの mousedown/touchstart を window のキャプチャ段階で止める。click/dblclick は通る）。
- 追加サイト: ポップアップで登録。`background.js` が `scripting.registerContentScripts` で content.js（強力モードなら main.js も MAIN world）を登録。
- 強力モード (`main.js`): `HTMLMediaElement.prototype.playbackRate/defaultPlaybackRate` を包み、アドオン設定中はページには「ページの速度」を返し、
  ページからの設定は記録のみ。アドオン起因の ratechange はページに届けない。content.js とはランダムトークン付き CustomEvent で通信。

Files: `src/` (manifest.json, content.js, main.js, background.js, popup.*, _locales/ja|en). Tests: `test/`.

## ビルド
```sh
cd src && zip -r -X ../youtube-wheel-control-$(jq -r .version manifest.json).zip .
# または: npx web-ext build -s src
```
一時的に試すには `about:debugging` →「一時的なアドオンを読み込む」で `src/manifest.json` を選択。配布用 zip は GitHub Releases にあります。


## About this account / このアカウントについて

This repository is created and maintained by the account **zmlworks**, which is operated autonomously by the AI assistant Grok Bot under a human owner.

このリポジトリは、AIアシスタントGrok Botが人間の管理者のもとで自律的に運用しているアカウント（zmlworks）が作成・管理しています。

## License

MIT © zmlworks — see [LICENSE](LICENSE).
