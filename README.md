# image-viewer

Electron + React + TypeScript 製のデスクトップ画像ビューワーです。

## 必要環境

- Node.js 18 以上(Windows での exe ビルドは Windows 上で実行)
- npm

## セットアップ

```sh
npm install
```

## 開発(ホットリロード)

```sh
npm run dev
```

webpack-dev-server(http://localhost:8080)と Electron が同時に起動します。レンダラーは保存時に自動リロードされ、DevTools が開きます。

## テスト用ビルド(ローカルで本番相当の動作確認)

```sh
npm run build   # dist/ をクリーンして main(tsc)と renderer(webpack production)をビルド
npm start       # ビルドして dist/ から Electron を起動(パッケージなし・本番モード)
```

`npm start` は dev サーバーを使わず `dist/renderer/index.html` を読み込むため、パッケージ版に近い挙動を手早く確認できます。

## exe ファイルのビルド(Windows ポータブル版)

```sh
npm run dist
```

フルビルド後に electron-builder が実行され、以下が生成されます。

| 成果物 | 用途 |
|---|---|
| `release/image-viewer-<version>-portable.exe` | 配布物。インストール不要、ダブルクリックで起動 |
| `release/win-unpacked/image-viewer.exe` | 未圧縮版。起動が速くデバッグ向き |

設定は [package.json](package.json) の `build` セクションにあります。

### アプリアイコン

`assets/icon.ico`(256x256 以上を含むマルチサイズ推奨)を置いて再ビルドすると、自動検出されて exe のアイコンになります。無い場合は Electron のデフォルトアイコンが使われます。

### 初回ビルドの注意

- electron-builder がツール類(nsis / winCodeSign など)を `%LOCALAPPDATA%\electron-builder\Cache` にダウンロードするため、初回のみネットワークアクセスが必要です。
- winCodeSign の展開が「シンボリックリンクを作成できません」で失敗する場合は、Windows の開発者モードを有効にするか、管理者権限で一度実行してください(失敗するのは macOS 用ファイルのリンク作成のみで、Windows ビルドには不要です)。
- 生成される exe は未署名のため、配布先での初回実行時に SmartScreen の警告が出ます(「詳細情報」→「実行」で起動可能)。

## テストの実行(E2E / Playwright)

```sh
npm run test:e2e          # フルビルドしてヘッドレス実行
npm run test:e2e:headed   # ウィンドウを表示して実行
npm run test:e2e:debug    # Playwright デバッグモード
```

テストは `tests/e2e/` にあり、ビルド済みの `dist/` に対して Electron を直接起動して検証します(実行前に自動でビルドされます)。

### テストに関する注意

- テストは `%APPDATA%\Electron\settings.json`(ファイルアクセス許可リストの元データ)を読み書きします。設定を変更するテストは保存/復元ではなく settings のリセットで後始末をしてください。
- VSCode 統合ターミナルなど `ELECTRON_RUN_AS_NODE=1` が設定された環境から Electron や exe を直接起動すると、ただの Node プロセスとして起動して即終了します。起動前に `$env:ELECTRON_RUN_AS_NODE = $null`(PowerShell)で解除してください。

## ユニットテスト

現在ユニットテストは未整備です(`npm test` はプレースホルダー)。
