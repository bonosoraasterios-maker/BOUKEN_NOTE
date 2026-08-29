# Migration Status

## Source of truth

- 上位仕様: ぼうけんノート 仕様書・ロードマップ v1.2
- 凍結実装: `legacy/BOUKEN_NOTE_v23_46_FROZEN.html`
- 現在の実行母体: v23.46 + Parts Phase1 を外部ファイル化した `index.html`

## Phase 1 — 完了

- [x] 原本凍結
- [x] HTML外部化
- [x] CSS外部化
- [x] JavaScript外部化
- [x] 画像ファイル化
- [x] BGM/SEファイル化
- [x] StackBlitz/Vite起動構成
- [x] データ層の移行先を作成

## Phase 2 — 次工程

- [ ] characters.js を実ランタイムへ接続
- [ ] enemies.js を実ランタイムへ接続
- [ ] skills.js を実ランタイムへ接続
- [ ] missions.js を実ランタイムへ接続
- [ ] battle / save / ui / missions の責務分割
- [ ] 固定index依存解消
- [ ] 同等性テスト

## ルール

Phase 2 の各変更は1機能ずつ行い、正常版へいつでも戻せる単位でコミットする。
