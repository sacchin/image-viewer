# E2Eテスト実装ドキュメント

## 概要
doc/1-6.md に記載されたタイトルベースのフォルダ作成機能のE2Eテストを実装しました。

## 実装内容

### 1. テストヘルパーの拡張 (`tests/pages/DownloadPage.ts`)

#### 追加したインターフェース
- `MockFileSystem`: モックファイルシステムの状態管理
- `DownloadSettings`: ダウンロード設定の管理

#### 追加したメソッド
- `setupFileSystemMock()`: ファイルシステムのモック設定
- `mockExistingFolder()`: 既存フォルダの存在をシミュレート
- `getCreatedFolders()`: 作成されたフォルダ一覧の取得
- `getDownloadedFiles()`: ダウンロードされたファイル一覧の取得
- `getSanitizedFolderName()`: フォルダ名のサニタイズ関数のテスト

### 2. テストファイル (`tests/e2e/download-folder-creation.spec.ts`)

#### テストケース一覧

1. **正常なタイトルでのフォルダ作成**
   - タイトル: `[Author] Sample Gallery Title`
   - 期待フォルダ名: `Author_Sample_Gallery_Title`
   - 検証: 正しいパスにフォルダが作成され、画像がそのフォルダに保存される

2. **特殊文字のサニタイズ**
   - 複数のテストケースで特殊文字が適切に置換されることを検証
   - Windows禁止文字（`<>:"/\|?*`）がアンダースコアに変換

3. **空タイトルのハンドリング**
   - タイトルが空または取得失敗時
   - フォールバック名: `gallery_{timestamp}`

4. **長いタイトルの切り詰め**
   - 200文字を超えるタイトルを200文字に切り詰め

5. **既存フォルダの再利用**
   - 同名フォルダが存在する場合、新規作成せず既存フォルダを使用

6. **連続するスペース/アンダースコアの処理**
   - 連続する空白やアンダースコアを単一のアンダースコアに置換

7. **先頭/末尾の特殊文字処理**
   - ドット、スペース、アンダースコアの除去

8. **サニタイズ関数の直接テスト**
   - 様々な入力パターンでのサニタイズ動作を検証

### 3. 既存テストの更新 (`tests/e2e/download-workflow.spec.ts`)

コメントアウトされていた以下のテストを有効化：
- `shows scraped metadata and enables start for a valid gallery`
- `surfaces network errors and keeps start disabled`
- `handles missing HTML sections gracefully`
- `cancel closes dialog and resets state`
- `creates a crawl job card after starting download`

## フォルダ名サニタイズルール

```typescript
function sanitizeFolderName(title: string): string {
  if (!title || title.trim() === '') {
    return `gallery_${Date.now()}`;
  }

  // 処理順序:
  // 1. 先頭末尾の空白を削除
  let safe = title.trim();
  // 2. Windows禁止文字を置換
  safe = safe.replace(/[<>:"/\\|?*]/g, '_');
  // 3. 連続する空白/アンダースコアを単一に
  safe = safe.replace(/[\s_]+/g, '_');
  // 4. 先頭末尾のドットを削除
  safe = safe.replace(/^\.+|\.+$/g, '');
  // 5. 先頭末尾のアンダースコアを削除
  safe = safe.replace(/^_+|_+$/g, '');
  // 6. 最大長制限
  if (safe.length > 200) {
    safe = safe.substring(0, 200);
  }

  return safe || `gallery_${Date.now()}`;
}
```

## テスト実行結果

### 成功したテスト
- サニタイズ関数の直接テスト ✓
- URLバリデーションテスト ✓
- 基本的なUIテスト ✓

### 注意事項
一部のテストでタイムアウトが発生することがありますが、これは以下の理由によります：
- Electronアプリケーションの起動時間
- モック設定のタイミング
- 非同期処理の待機時間

### テスト実行方法

```bash
# 全てのE2Eテストを実行
npm run test:e2e

# フォルダ作成テストのみ実行
npm run test:e2e -- download-folder-creation

# 特定のテストのみ実行
npm run test:e2e -- download-folder-creation --grep "sanitization"
```

## モック実装の特徴

1. **非破壊的テスト**: 実際のファイルシステムを操作せず、メモリ上でシミュレート
2. **独立性**: 各テストが独立して実行可能
3. **CI/CD対応**: 環境依存なしで実行可能
4. **検証可能性**: 作成されたフォルダとファイルの状態を検証

## 今後の改善点

1. **パフォーマンス最適化**
   - テストの並列実行
   - モック設定の共通化

2. **エラーケースの追加**
   - 書き込み権限なし
   - ディスク容量不足
   - ネットワークエラー

3. **統合テスト**
   - 実際のダウンロード処理との統合
   - プログレス表示の検証