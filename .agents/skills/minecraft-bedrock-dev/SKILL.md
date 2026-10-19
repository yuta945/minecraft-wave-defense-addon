---
name: minecraft-bedrock-dev
description: >-
  Develops, builds, tests, and debugs Minecraft Bedrock Edition (Windows) add-ons
  using TypeScript and Script API. Use when implementing gameplay features, editing
  add-on code, reloading Minecraft, running autonomous GameTest or ScriptEvent tests,
  or inspecting Bedrock Dedicated Server (BDS) console and ContentLog files.
---

# Minecraft Bedrock Add-on Development Skill

This skill provides comprehensive instructions and automated procedures for developing, deploying, testing, and debugging Minecraft Bedrock Script API add-ons in this repository.

---

## 1. Environment & Paths Quick Reference

- **Working Directory (Repo Root)**: `E:\マイクラアドオン`
- **BDS Server Directory**: `C:\bds` (Bedrock Dedicated Server v1.21.51)
  - *CRITICAL*: Always run BDS from `C:\bds` (pure ASCII path) to avoid Windows `fopen("server.properties")` encoding failures.
- **Client Add-on Path**: `C:\Users\enruf\AppData\Roaming\Minecraft Bedrock\Users\Shared\games\com.mojang\development_behavior_packs\vibe_addon`
- **BDS Add-on Path**: `C:\bds\behavior_packs\vibe_addon`
- **BDS Control Port**: `http://localhost:3001` (`tools/bds-runner.js`)
- **Client Bridge Port**: `http://localhost:3000` / WebSocket `8080` (`tools/mc-bridge.js`)

---

## 2. Autonomous Testing Workflow (The 5-Step Loop)

Whenever modifying code (e.g., `src/main.ts`), execute the following loop autonomously:

### Step 1: Implementation
1. Add trace logging with `aiDebugLog("[AI-DEBUG] ...")` (defined in `src/main.ts`).
   *Note: Windows Bedrock / BDS buffers logs in 4096-byte blocks. `aiDebugLog` flushes this buffer immediately.*
2. Ensure world modifications / entity spawns inside event handlers are wrapped in `system.run(() => { ... })` to avoid Minecraft Read-Only Mode exceptions.
3. Handle test triggers in `system.afterEvents.scriptEventReceive` under namespace `ai` (ID `ai:test`).

### Step 2: Build & Dual Deployment
Run the build script:
```bash
node build.js
```
This compiles TypeScript via `esbuild` and synchronously copies `main.js`, `manifest.json`, and `structures/` to both `C:\bds` and the local Bedrock client.

### Step 3: Trigger Reload & Test
Run the automated test runner:
```powershell
powershell -ExecutionPolicy Bypass -File tools/test-addon.ps1
```
Or dispatch commands manually via HTTP:
```powershell
# Reload scripts in BDS
Invoke-RestMethod -Uri "http://localhost:3001/cmd" -Method Post -ContentType "application/json" -Body '{"command": "reload"}'
Start-Sleep -Seconds 2
# Trigger autonomous test event
Invoke-RestMethod -Uri "http://localhost:3001/cmd" -Method Post -ContentType "application/json" -Body '{"command": "scriptevent ai:test ping"}'
```

### Step 4: Verify Logs
Fetch recent server stdout logs from the BDS runner:
```powershell
(Invoke-RestMethod -Uri "http://localhost:3001/status").recentLogs | Select-Object -Last 20 | ForEach-Object { $_.text }
```
- Verify `[AI-DEBUG]` appears.
- Check that NO errors (`[Error]`, `TypeError`, `ReferenceError`, `SyntaxError`) exist.

### Step 5: Self-Correction
If an error is detected in Step 4, automatically return to Step 1 to diagnose and fix the issue (up to 5 iterations) without asking user intervention.

---

## 3. Server Management & Troubleshooting

### Check BDS Runner Status
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/status"
```

### Restart BDS Server Safely
If the BDS server needs a clean restart to reload structure files or world settings:
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/restart" -Method Post
```
*(The runner automatically waits for the process to exit before starting a new one).*

For further architecture details and API references, see [references/api-reference.md](./references/api-reference.md).
