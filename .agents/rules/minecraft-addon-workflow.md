# Minecraft Bedrock Add-on AI自律開発ワークフロー & 環境仕様書

このドキュメントは、本プロジェクトにおいてAIエージェントが自律的にアドオン（TypeScript / Script API）の開発・テスト・修正を行うためのマスター規約です。**プロジェクト内のいかなるチャット・セッションでもこのルールに厳格に従ってください。**

---

## 1. ディレクトリ構造と重要パス

| 役割 | パス | 備考 |
| :--- | :--- | :--- |
| **作業ディレクトリ (Repo Root)** | `E:\マイクラアドオン` | ソースコード、ビルド設定、開発ツール |
| **BDSサーバー (本体インストール先)** | `C:\bds` | **【重要】** BDSバイナリは非ASCII（日本語）パスで `server.properties` 読み込みに失敗するため、必ず純ASCIIパス `C:\bds` に配置・運用すること |
| **BDS側 アドオン配置先** | `C:\bds\behavior_packs\vibe_addon` | `build.js` により自動同期される |
| **BDS側 ワールド設定** | `C:\bds\worlds\Bedrock level\world_behavior_packs.json` | アドオンのUUIDとバージョンが登録済 |
| **クライアント側 (GDK版 com.mojang)** | `C:\Users\enruf\AppData\Roaming\Minecraft Bedrock\Users\Shared\games\com.mojang` | クライアント用ゲームデータ |
| **クライアント側 アドオン配置先** | `.../development_behavior_packs/vibe_addon` | `build.js` により自動同期される |
| **クライアント側 ログ出力先** | `C:\Users\enruf\AppData\Roaming\Minecraft Bedrock\logs` | `ContentLog*.txt` が出力される |

---

## 2. 開発ツール・ランナー・ポート一覧

### ① BDS ランナー (`tools/bds-runner.js`)
- **役割**: ヘッドレスの Bedrock Dedicated Server をバックグラウンド管理し、HTTP経由でstdinコマンド注入とstdoutログ収集を行う常駐デーモン。
- **HTTPポート**: `3001`
- **主要エンドポイント**:
  - `GET http://localhost:3001/status` : サーバー状態（`running`/`stopped`）、PID、直近のコンソールログ（末尾30行）を取得。
  - `POST http://localhost:3001/cmd` : BDSの標準入力へスラッシュコマンドを送信（例: `{"command": "reload"}`）。
  - `POST http://localhost:3001/restart` : BDSプロセスを安全に停止（`stop`）し、プロセス終了を待機した後に再起動。
- **起動方法**: `node tools/bds-runner.js`（※常駐デーモンのためバックグラウンドタスクとして起動）

### ② クライアント・WebSocketブリッジ (`tools/mc-bridge.js`)
- **役割**: Minecraft Bedrock クライアント（ゲーム内 `/connect localhost:8080`）と接続し、HTTP経由でゲーム内コマンドを実行するブリッジ。
- **HTTPポート**: `3000` (`POST /cmd` でコマンド送信)
- **WebSocketポート**: `8080`（暗号化通信 `ws:encrypt` 自動ハンドシェイク対応）
- **起動方法**: `node tools/mc-bridge.js`

### ③ ワンストップ自動テストランナー (`tools/test-addon.ps1`)
- **役割**: 「ビルド＆デプロイ ➔ BDS遠隔リロード ➔ スクリプトイベント遠隔発火 ➔ ログ自動判定」を1コマンドで完走させる自動化スクリプト。
- **実行方法**:
  ```powershell
  powershell -ExecutionPolicy Bypass -File tools/test-addon.ps1
  ```
  または npm 経由:
  ```bash
  npm test
  ```

---

## 3. 必須デバッグループ（AI自律開発フロー）

コードの追加・修正を行う際は、人間の指示を待たずに以下のサイクルを自律的に回すこと：

```
[Step A: 実装・修正] (src/main.ts 等)
       ↓
[Step B: ビルド＆同期] (node build.js)
       ↓
[Step C: テスト実行] (powershell -ExecutionPolicy Bypass -File tools/test-addon.ps1)
       ↓
[Step D: ログ自己判定]
       ├─ [エラー検出] ➔ 自動で Step A に戻って修正 (最大5回試行)
       └─ [PASS確認]  ➔ ユーザーへ完了報告
```

### Step A: 実装の鉄則
1. **トレースログは `aiDebugLog` を使用**:
   Minecraft Bedrockのログは4KB単位でバッファリングされるため、`src/main.ts` に定義された `aiDebugLog(msg)` 関数を使って4KBパディングを付与し、即時フラッシュさせること。
2. **遠隔テストトリガーの実装**:
   `system.afterEvents.scriptEventReceive`（ID: `ai:test`）を購読し、テスト用メッセージ（`ping`, `run`, `simulated` 等）を受け取った際に動作検証コードが走るように実装すること。
3. **ワールド変更タイミングの厳守 (Read-Only Mode回避)**:
   イベントリスナー（特に `beforeEvents`）内でブロック設置・エンティティ操作を行うと例外が発生するため、必ず `system.run(() => { ... })` で遅延ラップすること。

### Step B: ビルド＆デプロイ
- `node build.js` を実行する。
- クライアント（`development_behavior_packs/vibe_addon`）とBDS（`C:\bds\behavior_packs\vibe_addon`）の両方に、esbuildバンドル済みの `scripts/main.js`、`manifest.json`、`structures/` が自動で再帰同期される。

### Step C & D: テスト実行と判定
- `powershell -ExecutionPolicy Bypass -File tools/test-addon.ps1` を実行する。
- スクリプトが自動的に以下をチェックする：
  - `[Error]`, `TypeError`, `ReferenceError`, `SyntaxError`, `Unhandled Promise` などのエラーログがないか。
  - `[AI-DEBUG]` マーカーが出力されているか。
- エラーが1行でもあれば、即座に修正モードへ移行する。

---

## 4. 既知の落とし穴とノウハウ集

1. **BDSの配置パス（絶対厳守）**:
   - BDSの `bedrock_server.exe` はCランタイムの内部文字コード処理の制約により、パス中に全角文字や日本語（例: `e:\マイクラアドオン`）が含まれると `fopen("server.properties")` に失敗し、`Could not load server.properties file` となって起動不能になります。
   - そのため、**BDS本体は常に `C:\bds` で運用**し、本リポジトリからは `build.js` 経由でデプロイします。
2. **GameTest Framework と構造体ファイル**:
   - GameTest（`.register(...)`）でテストを行う場合、指定した `.structureName("namespace:name")` に対応する `.mcstructure` ファイルが `structures/namespace/name.mcstructure` に実在する必要があります。
   - 公式のセル構造体 `gametests:mediumglass` が `structures/gametests/mediumglass.mcstructure` として配置済です。
3. **SimulatedPlayer（仮想プレイヤー）のスコープ**:
   - `spawnSimulatedPlayer` は、標準の `world.getDimension()` 上では呼び出せず、GameTest Framework の `test.spawnSimulatedPlayer` 内でのみ生成可能です。
4. **ポート競合とプロセス残存**:
   - BDSが停止した際にポート 19132 やファイルハンドルがつかまれたままになるのを防ぐため、再起動時は必ず `POST http://localhost:3001/restart` を使用すること（プロセス終了を検知してから次を立ち上げる安全機構を内蔵）。
   - 手動で強制終了する場合は `Get-Process -Name "*bedrock*" | Stop-Process -Force` を使用する。
