# ぼうけんノート Engine v1

LiveCodes の1ファイル構成から、複数ファイル型の開発基盤へ移すための **Phase 1（厨房作成）** です。

## この版で完了したこと

- v23.46 原本を `legacy/` に凍結保存
- v23.46 + Parts Phase1 を実行母体として外部ファイル化
- HTML / CSS / JavaScript / 画像 / BGM / SE を分離
- Base64 埋め込み素材を実ファイルへ抽出
- StackBlitz / Vite でそのまま起動できる構成を追加
- 将来のデータ駆動化用に `data/` を用意

## 重要

**Phase 1 ではゲーム内容を変えないことを最優先にしています。**

現在の実戦ロジックは `js/game.js` に残っています。`data/*.js` は Phase 2 で順次、実戦ロジックの正本へ切り替えるための移行先です。まだ現在の戦闘処理を上書きしません。

## 起動

```bash
npm install
npm run dev
```

StackBlitz ではこのフォルダ（またはZIP）を JavaScript/Vite プロジェクトとして読み込んでください。

## フォルダ

- `index.html` : ゲーム画面
- `css/game.css` : 現行CSSを順序維持で外部化
- `js/game.js` : 現行の主要ゲームロジック
- `js/patch-*.js` : v23.46 の後段パッチ（実行順維持）
- `data/` : キャラ・敵・技・ミッション・エリアの移行先
- `images/` : 画像素材
- `sounds/` : BGM / SE
- `legacy/` : 凍結した原本
- `docs/` : 移行状況・次工程

## 次工程（Phase 2）

1. `CHARACTER_DEFS` を `data/characters.js` を正本に変更
2. 敵定義を `data/enemies.js` へ一本化
3. ミッション定義を `data/missions.js` へ一本化
4. `js/game.js` を `battle.js / missions.js / save.js / ui.js` に分割
5. 固定index依存をキャラクターID依存へ置換
6. 動作同等性確認後に v23.46 legacy adapter を縮小

以後は「コード全文を再生成」ではなく、対象ファイルだけを変更します。
