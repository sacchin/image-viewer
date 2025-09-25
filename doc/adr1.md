# ADR-1: Download Dialog "Failed to fetch" エラーの解決

## 問題の原因

"Failed to fetch" エラーの原因を調査した結果、以下の問題を特定しました：

**レンダラープロセス（ブラウザ環境）から直接外部URLにfetchしようとしているため、CORSエラーが発生しています。**

### 詳細な原因：
1. `DownloadDialog.tsx` の106行目で、レンダラープロセスから直接 `fetch(trimmedUrl)` を実行している
2. ElectronアプリのCSP（Content-Security-Policy）が `default-src 'self'` に設定されており、外部リソースへのアクセスを制限している
3. ブラウザのセキュリティポリシーにより、異なるオリジンへの直接fetchがブロックされる

## 解決方法

以下の修正を実装します：

### 1. メインプロセスにfetch処理を移動
- `src/main/ipc.ts` に新しいIPCハンドラー `fetch-url` を追加
- メインプロセスから外部URLにアクセスすることで、CORSの制限を回避

### 2. プレロードスクリプトの更新
- `src/main/preload.ts` に `fetchUrl` メソッドを追加
- レンダラープロセスからメインプロセスへの通信を仲介

### 3. レンダラープロセスの修正
- `DownloadDialog.tsx` の `handleScrape` 関数を修正
- 直接fetchする代わりに、Electron APIを通じてメインプロセスに処理を委譲

### 4. TypeScript定義の追加
- `src/renderer/types/electron.d.ts` を作成または更新
- Electron APIの型定義を追加

これにより、セキュリティを保ちながら外部URLからデータを取得できるようになります。