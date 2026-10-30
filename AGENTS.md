# AGENTS.md

## プロジェクト概要
このプロジェクトは、Windowsデスクトップ向けの画像管理アプリケーションです。特定のWebサイトから画像をクローリングして、ローカルで管理・閲覧する機能を提供します。
 <!-- 主要ディレクトリ: `api/`, `web/`, `infra/`。 -->

## セットアップ/ビルド/テスト

### 初期セットアップ
```bash
# 依存パッケージのインストール
npm install

# アプリケーションのビルド
npm run build
```

### 開発環境での起動
```bash
# 開発モードで起動（Hot Reload対応）
npm start
```

### テスト

#### ユニットテスト（node:test + ts-node）
```bash
# すべてのユニットテストを実行（src/**/__tests__/*.test.ts）
npm run test:unit
```
- `src/renderer/utils/__tests__/scraper.test.ts`: ギャラリーHTMLのスクレイピング（フィクスチャ: `tests/fixtures/scraper/sample-gallery.html`）
- `src/main/__tests__/sanitizeFolderName.test.ts`: ダウンロード先フォルダ名のサニタイズ

#### E2Eテスト（Playwright）
```bash
# ビルドしてから全てのE2Eテストを実行（約10分）
npm run test:e2e

# ブラウザ表示付き / デバッグ（ステップ実行）
npm run test:e2e:headed
npm run test:e2e:debug

# 特定のテストファイルのみ実行（事前に npm run build が必要）
npx playwright test app-launch.spec.ts

# テスト結果のレポートを表示
npx playwright show-report
```

E2E の仕組み:
- `tests/helpers/electron-app.ts` が `dist/main/index.js` を起動する。`--user-data-dir` に一時フォルダを渡すため、
  開発者の `%APPDATA%\Electron\settings.json` を読んだり汚したりしない。
- `launch({ downloadPath })` で設定ファイルを事前に書き込み、テスト用の一時フォルダをダウンロード先（= Explore の
  ルート）として起動できる。フィクスチャ生成は `tests/helpers/fixtures.ts`（`writeTree`, `startImageServer`, `galleryHtml`）。
- ネットワーク依存の処理は **メインプロセス側** でスタブする（`tests/pages/DownloadPage.ts` が
  `electronApp.evaluate` で `ipcMain` のハンドラを差し替える）。contextBridge で公開された
  `window.electronAPI` は凍結されているため、レンダラー側で代入してもモックにならない。
- 画像ダウンロードの E2E はローカル HTTP サーバーから配信し、実際のファイルシステムで検証する。外部通信は行わない。
- VSCode のターミナルから実行する場合、環境変数 `ELECTRON_RUN_AS_NODE` はヘルパーが自動で除去する。

#### テストカテゴリ
- **app-launch.spec.ts**: アプリ起動、ウィンドウサイズ・タイトル
- **initial-ui.spec.ts**: 初期表示（サイドメニュー、パネル、ステータスバー）
- **side-menu.spec.ts** / **panel-navigation.spec.ts** / **ui-integration.spec.ts**: サイドメニューとパネル切り替え
- **image-exploration.spec.ts**: Explore パネル（フォルダツリー、ファイル一覧、プレビュー、設定連携）
- **ui-improvements.spec.ts**: doc/adr/1-8（横スクロール、矢印キー操作、深い階層の展開、ホイールズーム）
- **image-pan.spec.ts** / **image-pan-simple.spec.ts**: ズーム時のドラッグ移動とカーソル
- **download-workflow.spec.ts**: ダウンロードダイアログとジョブカード（fetch / crawl はメイン側スタブ）
- **download-folder-creation.spec.ts**: doc/adr/1-6 のフォルダ名生成を実ファイルシステムで検証

#### 静的チェック
```bash
# テストコードの型チェック（tests/tsconfig.json）
npm run typecheck:tests

# ESLint（eslint.config.js: flat config）
npm run lint
```

#### CI/CD環境での実行
テストはヘッドレスモードで自動実行され、結果は以下に出力されます：
- `test-results/`: テスト結果とスクリーンショット
- `playwright-report/`: HTMLレポート
- `test-results/results.json`: JSON形式の結果

### コミット前のチェック事項
1. ビルドが成功すること: `npm run build`
2. ユニットテストと型チェック・Lint が通ること: `npm run test:unit && npm run typecheck:tests && npm run lint`
3. E2Eテストが全て合格すること: `npm run test:e2e`
4. 変更内容に応じて新しいテストを追加すること

## コーディング規約（要点）
<!-- - TypeScript: strict。import順序はeslint-plugin-importに従う。PRごとに型エラーゼロ。
- PRタイトル: `[api] 説明…` の形式。 -->

## ガードレール / 禁止事項
<!-- - 秘密情報を追加しない。生成コードにAPIキーを埋め込まない。
- 破壊的変更は`docs/adr/`にADR追加後に実施。 -->
* 要件に **ショートカット機能を追加する** と明示された場合にのみ、ショートカット機能を実装する。

## 要件・受入基準の参照
<!-- - **実装前に**以下を必ず読む：`docs/requirements/README.md`
- 今回の作業対象がある場合、該当機能の文書を開き**受入基準(Acceptance Criteria)**を満たすテストを追加/更新すること。 -->

## PRルール
<!-- - 変更理由/影響範囲/テスト結果をPR本文に記載。 -->

## ドキュメンテーションルール
- すべてのドキュメントは英語で保存する必要があります
- ユーザに見せる際には、日本語に翻訳して出力してください。

