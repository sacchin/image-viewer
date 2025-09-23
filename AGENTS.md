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

### E2Eテスト（Playwright）

#### テストの実行方法
```bash
# 全てのE2Eテストを実行（ヘッドレスモード）
npm run test:e2e

# ブラウザ表示付きでテストを実行
npm run test:e2e:headed

# デバッグモードでテストを実行（ステップ実行可能）
npm run test:e2e:debug

# 特定のテストファイルのみ実行
npx playwright test app-launch.spec.ts

# テスト結果のレポートを表示
npx playwright show-report
```

#### テストカテゴリ
- **app-launch.spec.ts**: アプリケーション起動テスト（6テスト）
  - Electronアプリの起動確認
  - ウィンドウサイズ・タイトルの検証

- **initial-ui.spec.ts**: UI初期表示テスト（9テスト）
  - 各UIコンポーネントの表示確認
  - 初期状態の検証

- **menu.spec.ts**: メニューテスト（9テスト）
  - 各メニュー項目の存在確認
  - ショートカットキーの検証

#### テスト前の準備
```bash
# アプリケーションのビルドが必要
npm run build

# テストのみ実行する場合
npm run test:e2e
```

#### CI/CD環境での実行
テストはヘッドレスモードで自動実行され、結果は以下に出力されます：
- `test-results/`: テスト結果とスクリーンショット
- `playwright-report/`: HTMLレポート
- `test-results/results.json`: JSON形式の結果

### コミット前のチェック事項
1. ビルドが成功すること: `npm run build`
2. E2Eテストが全て合格すること: `npm run test:e2e`
3. 変更内容に応じて新しいテストを追加すること

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

