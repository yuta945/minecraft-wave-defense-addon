# Minecraft Bedrock AI Autonomous Addon Development Environment

Minecraft 統合版（Bedrock Edition）のアドオン（TypeScript / Script API）を、AIエージェント（Antigravity）が**「コード実装 ➔ ビルド＆デプロイ ➔ マイクラ遠隔リロード ➔ 自動テスト ➔ ログ自己診断と修正」**まで完全自律・無人で実行できる開発環境です。

---

## 🏗️ 全体アーキテクチャ

```mermaid
flowchart TD
    subgraph Repo["📂 作業リポジトリ (E:\マイクラアドオン)"]
        Src["src/main.ts (TypeScript)"]
        Build["build.js (esbuild バンドラー)"]
        BDSRunner["tools/bds-runner.js (HTTP API: 3001)"]
        MCBridge["tools/mc-bridge.js (HTTP: 3000 / WS: 8080)"]
        TestScript["tools/test-addon.ps1 (自動テスト)"]
    end

    subgraph BDS["🖥️ ヘッドレス実行環境 (C:\bds)"]
        BDSProcess["Bedrock Dedicated Server (v1.21.51)"]
        BP_BDS["behavior_packs/vibe_addon"]
        World_BDS["worlds/Bedrock level"]
    end

    subgraph Client["🎮 Minecraft クライアント (Windows GDK)"]
        ClientApp["Minecraft Bedrock Edition"]
        BP_Client["development_behavior_packs/vibe_addon"]
    end

    Src -->|npm run build| Build
    Build -->|自動同期| BP_BDS
    Build -->|自動同期| BP_Client
    TestScript -->|POST /cmd 'reload'| BDSRunner
    BDSRunner -->|stdin injection| BDSProcess
    BDSProcess -->|stdout log capture| BDSRunner
    BDSRunner -->|GET /status recentLogs| TestScript
    ClientApp -.->|LAN 接続 (localhost:19132)| BDSProcess
    ClientApp -.->|/connect localhost:8080| MCBridge
```

---

## 🚀 クイックスタート

### 1. サーバー＆ブリッジの起動（初回・PC再起動時）

常駐ランナーを起動します：

```bash
# BDS サーバー（ヘッドレス無人開発環境）を起動
npm run bds
# => http://localhost:3001 で常駐監視開始
```

※ゲームクライアント（マイクラ本体）と直接WebSocketで連携したい場合は以下も起動できます：
```bash
# クライアント用 WebSocket ブリッジを起動
npm run bridge
# => http://localhost:3000 / ws://localhost:8080 で待機開始
```

---

### 2. ワンコマンド自動テスト

アドオンのビルド、サーバーへの反映、ゲーム内テスト発火、ログ検証を一発で実行します：

```bash
npm test
```
または
```powershell
powershell -ExecutionPolicy Bypass -File tools/test-addon.ps1
```

**テストの実行結果例:**
```
=== [1/4] Building and Deploying Addon ===
[Build] Deployed to Client: ...\com.mojang\development_behavior_packs\vibe_addon
[Build] Deployed to BDS: C:\bds\behavior_packs\vibe_addon
[Build] Build and dual-deployment completed successfully!

=== [2/4] Sending 'reload' to Minecraft BDS ===
Reload command dispatched: ok

=== [3/4] Triggering Autonomous Test (scriptevent ai:test ping) ===
Test event dispatched: ok

=== [4/4] Verifying Execution Logs ===
DEBUG LOG: [2026-10-19 08:00:39:718 WARN] [Scripting] [AI-DEBUG] Current world players count: 0

[PASS] All autonomous tests passed successfully without errors!
```

---

## 🛠️ ツール・エンドポイント仕様

### 1. BDS ヘッドレスランナー (`tools/bds-runner.js`)
Bedrock Dedicated Server をバックグラウンド管理し、Web API 経由で遠隔操作とログ回収を行います。

- **ポート**: `3001`
- **エンドポイント**:
  - `GET /status` : サーバー状態（`running`/`stopped`）、PID、直近ログ30件を JSON で取得。
  - `POST /cmd` : BDS の標準入力へコマンドを送信。
    ```json
    { "command": "reload" }
    ```
    ```json
    { "command": "scriptevent ai:test ping" }
    ```
  - `POST /restart` : BDS プロセスを安全に停止後、1秒後に再起動。

### 2. クライアント・WebSocketブリッジ (`tools/mc-bridge.js`)
Minecraft クライアントのチャット画面で `/connect localhost:8080` を入力して接続します。
- **HTTPポート**: `3000` (`POST /cmd` でコマンド送信)
- **WebSocketポート**: `8080`（暗号化 WebSocket `ws:encrypt` 自動対応）

---

## 📁 主要ファイル構成

```
e:\マイクラアドオン\
├── .agents/rules/
│   └── minecraft-addon-workflow.md   # AI自律開発ワークフロールール
├── .antigravityrules                 # ルール同期用ファイル
├── src/
│   └── main.ts                       # アドオンのTypeScriptソースコード
├── structures/
│   └── gametests/
│       └── mediumglass.mcstructure  # 公式GameTest用構造体
├── tools/
│   ├── bds-runner.js                 # BDS常駐管理サーバー (Port 3001)
│   ├── mc-bridge.js                  # クライアントWebSocketブリッジ (Port 3000/8080)
│   └── test-addon.ps1                # 自動テストランナースクリプト
├── build.js                          # esbuild バンドル & デュアルデプロイスクリプト
├── manifest.json                     # ビヘイビアーパック定義
└── package.json                      # npm スクリプト定義
```

---

## 🎮 人間プレイヤーの参加方法

AIがリアルタイムに開発・更新しているワールドに直接入りたい場合：
1. Minecraft Bedrock Edition を起動します。
2. 「プレイ」➔「サーバー」タブ ➔「サーバーを追加」を選択します。
3. 以下を入力して保存し、参加します：
   - **サーバー名**: `Local BDS`（自由）
   - **サーバーアドレス**: `localhost`（または `127.0.0.1`）
   - **ポート**: `19132`
4. サーバー内で動くアドオンの挙動を直接確認できます。
