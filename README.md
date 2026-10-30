# image-viewer

Electron + React + TypeScript 製のデスクトップ画像ビューワーです。

## 必要環境

- Node.js 22 以上(`npm run test:unit` が Node のテストランナーのグロブ展開を使うため。アプリのビルドだけなら 18 以上で動作)
- npm
- Windows(`npm run build` の clean 処理と配布用 zip の作成は Windows 前提)

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

## 配布用 zip のビルド(Windows)

```sh
npm run dist
```

フルビルド後に electron-builder が実行され、以下が生成されます。

| 成果物 | 用途 |
|---|---|
| `release/image-viewer-<version>-win-x64.zip` | 配布物。任意のフォルダに展開し、中の `image-viewer.exe` を起動する |
| `release/win-unpacked/` | zip の中身と同じ展開済みフォルダ。ビルド直後の動作確認に使う |

以前のポータブル exe(単一ファイル)形式は、起動ごとに約 300MB を `%TEMP%` へ展開するため起動に 15 秒以上かかっていました。展開済みフォルダから起動する zip 形式では 1 秒前後で起動します(初回のみ Windows のファイルキャッシュとウイルススキャンの分だけ長くかかります)。

設定は [package.json](package.json) の `build` セクションにあります。アプリ本体は `dist/` と `package.json` だけがパッケージされ、実行時に必要な npm 依存はありません。

### アプリアイコン

`assets/icon.ico`(256x256 以上を含むマルチサイズ推奨)を置いて再ビルドすると、自動検出されて exe のアイコンになります。無い場合は Electron のデフォルトアイコンが使われます。

### 初回ビルドの注意

- electron-builder がツール類を `%LOCALAPPDATA%\electron-builder\Cache` にダウンロードするため、初回のみネットワークアクセスが必要です。
- winCodeSign の展開が「シンボリックリンクを作成できません」で失敗する場合は、Windows の開発者モードを有効にするか、管理者権限で一度実行してください(失敗するのは macOS 用ファイルのリンク作成のみで、Windows ビルドには不要です)。
- 生成される exe は未署名のため、別の PC で初回実行するときは SmartScreen の警告が出ます(「詳細情報」→「実行」で起動可能)。

## テスト

### ユニットテスト(node:test + ts-node)

```sh
npm run test:unit
```

対象は `src/**/__tests__/*.test.ts` です。

- `src/renderer/utils/__tests__/scraper.test.ts`: ギャラリー HTML のスクレイピング(フィクスチャは `tests/fixtures/scraper/sample-gallery.html`)
- `src/main/__tests__/sanitizeFolderName.test.ts`: ダウンロード先フォルダ名のサニタイズ

### E2E テスト(Playwright)

```sh
npm run test:e2e          # フルビルドしてヘッドレス実行(約 3 分)
npm run test:e2e:headed   # ウィンドウを表示して実行
npm run test:e2e:debug    # Playwright デバッグモード
npx playwright test app-launch.spec.ts   # 特定ファイルのみ(事前に npm run build が必要)
```

テストは `tests/e2e/` にあり、ビルド済みの `dist/` に対して Electron を直接起動して検証します。

- 各テストは `--user-data-dir` に一時フォルダを渡して起動するため、開発者の `%APPDATA%\Electron\settings.json` を読み書きしません。テスト用のダウンロード先(Explore のルート)は `launch({ downloadPath })` で起動前に設定されます。
- ネットワークに依存する処理はメインプロセス側で `ipcMain` のハンドラを差し替えてスタブします(`tests/pages/DownloadPage.ts`)。画像ダウンロードの検証はローカル HTTP サーバーから配信し、外部通信は行いません。
- VSCode 統合ターミナルなどで設定される `ELECTRON_RUN_AS_NODE=1` は、テストのヘルパーが自動で除去します。Electron や exe を手で起動する場合は `$env:ELECTRON_RUN_AS_NODE = $null`(PowerShell)で解除してください。

### 静的チェック

```sh
npm run typecheck:tests   # テストコードの型チェック
npm run lint              # ESLint(eslint.config.js)
```

`npm test` はユニットテストと E2E テストを続けて実行します。
