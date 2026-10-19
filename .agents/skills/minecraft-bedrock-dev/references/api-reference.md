# API & Technical Reference

## 1. BDS HTTP Runner API (`http://localhost:3001`)

Provided by `tools/bds-runner.js`.

### `GET /status`
Returns the status of the Bedrock Dedicated Server.
- **Response**:
  ```json
  {
    "status": "running" | "stopped",
    "pid": 12345,
    "recentLogs": [
      { "time": "2026-10-19T08:00:39.718Z", "text": "[Scripting] [AI-DEBUG] ..." }
    ]
  }
  ```

### `POST /cmd`
Dispatches a console slash command into BDS `stdin`.
- **Request Body**:
  ```json
  { "command": "reload" }
  ```
- **Response**:
  ```json
  { "status": "ok", "command": "reload" }
  ```

### `POST /restart`
Safely terminates the running BDS process with `stop` and spawns a fresh process once exit is confirmed.
- **Response**:
  ```json
  { "status": "restarting" }
  ```

---

## 2. Client WebSocket Bridge (`tools/mc-bridge.js`)

Used when connecting directly from a running Minecraft Bedrock Client via `/connect localhost:8080`.

- **HTTP Control Endpoint**: `http://localhost:3000/cmd`
  - Sends a JSON RPC `commandRequest` packet (version: 1) over WebSocket to the game client.
- **WebSocket Endpoint**: `ws://localhost:8080`
  - Automatically negotiates encrypted connection (`ws:encrypt` challenge protocol) if required by newer Minecraft Bedrock clients.

---

## 3. Package & API Compatibility Matrix

| Package | Version | Compatibility Notes |
| :--- | :--- | :--- |
| **BDS Server** | `1.21.51.01` | Official Windows Dedicated Server |
| **`@minecraft/server`** | `1.16.0` | Maximum stable module version supported natively by BDS 1.21.51 |
| **`@minecraft/server-gametest`** | `1.0.0-beta.1.21.50-stable` | Matches manifest dependency `1.0.0-beta` |
| **Node.js** | `v22+` | Note: Use `copyFolderRecursiveSync` instead of `fs.cpSync` on Windows to avoid stack buffer overflow issues. |
