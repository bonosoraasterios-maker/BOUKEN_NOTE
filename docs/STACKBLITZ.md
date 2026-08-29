# StackBlitz への移行手順

1. このプロジェクトZIPを展開する。
2. StackBlitzで新しい Vite / Vanilla JavaScript プロジェクトを作る。
3. プロジェクト内の初期ファイルを削除し、このフォルダ一式をアップロードする。
4. `npm install` が完了したら `npm run dev` を実行する。
5. Preview で `index.html` を確認する。

## GitHubへ保存するとき

このフォルダを1リポジトリとして保存する。`legacy/BOUKEN_NOTE_v23_46_FROZEN.html` は削除せず、移行前の復元点として残す。

## GitHub Pages

Phase 1は静的ファイルだけで動作するため、ビルド結果 `dist/` をPagesへ公開できる。まずはStackBlitz上で動作同等性を確認してから公開する。
