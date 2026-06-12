# assets

electron-builder の buildResources ディレクトリです。

`icon.ico`(256x256 以上を含むマルチサイズ推奨)をこのディレクトリに置くと、
`npm run dist` 時に自動検出されて exe のアプリアイコンになります。
無い場合は Electron のデフォルトアイコンが使われます。
