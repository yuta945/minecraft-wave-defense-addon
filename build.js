const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

// 対象ゲームの指定 (例: node build.js wave-defense)
const TARGET_GAME = process.argv[2] || "wave-defense";
const GAME_DIR = fs.existsSync(path.join(__dirname, "games", TARGET_GAME))
  ? path.join(__dirname, "games", TARGET_GAME)
  : __dirname;

console.log(`[Build] Target Game: "${TARGET_GAME}" from ${GAME_DIR}`);

// 1. クライアント版（GDK/Windows 10/11）の配置先
const CLIENT_COM_MOJANG =
  "C:\\Users\\enruf\\AppData\\Roaming\\Minecraft Bedrock\\Users\\Shared\\games\\com.mojang";
const CLIENT_ADDON_DIR = path.join(
  CLIENT_COM_MOJANG,
  "development_behavior_packs",
  "vibe_addon"
);

// 2. サーバー版（BDS: Bedrock Dedicated Server）の配置先
const BDS_DIR = fs.existsSync("C:\\bds") ? "C:\\bds" : path.join(__dirname, "server");
const BDS_ADDON_DIR = path.join(BDS_DIR, "behavior_packs", "vibe_addon");
const BDS_WORLD_BP_DIR = path.join(BDS_DIR, "worlds", "Bedrock level");

function copyFolderRecursiveSync(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  const entries = fs.readdirSync(source, { withFileTypes: true });
  for (const entry of entries) {
    const curSource = path.join(source, entry.name);
    const curTarget = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyFolderRecursiveSync(curSource, curTarget);
    } else {
      fs.copyFileSync(curSource, curTarget);
    }
  }
}

async function deployTo(targetDir) {
  const scriptsDir = path.join(targetDir, "scripts");
  fs.mkdirSync(scriptsDir, { recursive: true });

  const entryPoint = fs.existsSync(path.join(GAME_DIR, "src", "main.ts"))
    ? path.join(GAME_DIR, "src", "main.ts")
    : path.join(__dirname, "src", "main.ts");

  // esbuild でバンドル出力
  await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    outfile: path.join(scriptsDir, "main.js"),
    format: "esm",
    target: "es2022",
    external: [
      "@minecraft/server",
      "@minecraft/server-ui",
      "@minecraft/server-net",
      "@minecraft/server-admin",
      "@minecraft/server-gametest",
      "@minecraft/debug-utilities",
    ],
    sourcemap: false,
    logLevel: "error",
  });

  // manifest.json をコピー
  const manifestSrc = fs.existsSync(path.join(GAME_DIR, "manifest.json"))
    ? path.join(GAME_DIR, "manifest.json")
    : path.join(__dirname, "manifest.json");

  fs.copyFileSync(manifestSrc, path.join(targetDir, "manifest.json"));

  // structures フォルダがあれば安全にコピー
  const structuresSrc = fs.existsSync(path.join(GAME_DIR, "structures"))
    ? path.join(GAME_DIR, "structures")
    : path.join(__dirname, "structures");

  if (fs.existsSync(structuresSrc)) {
    copyFolderRecursiveSync(structuresSrc, path.join(targetDir, "structures"));
  }
}

async function build() {
  try {
    // 1. クライアント版へのデプロイ
    if (fs.existsSync(CLIENT_COM_MOJANG)) {
      await deployTo(CLIENT_ADDON_DIR);
      console.log(`[Build] Deployed to Client: ${CLIENT_ADDON_DIR}`);
    }

    // 2. BDSサーバー版へのデプロイ
    if (fs.existsSync(BDS_DIR)) {
      await deployTo(BDS_ADDON_DIR);

      const bdsDevBpDir = path.join(BDS_DIR, "development_behavior_packs", "vibe_addon");
      await deployTo(bdsDevBpDir);

      // structures を BDS ルート直下にも同期
      const structuresSrc = fs.existsSync(path.join(GAME_DIR, "structures"))
        ? path.join(GAME_DIR, "structures")
        : path.join(__dirname, "structures");

      if (fs.existsSync(structuresSrc)) {
        copyFolderRecursiveSync(structuresSrc, path.join(BDS_DIR, "structures"));
      }

      // BDSのデフォルトワールド（worlds/Bedrock level）にも適用設定を作成
      fs.mkdirSync(BDS_WORLD_BP_DIR, { recursive: true });
      const worldBpJson = path.join(BDS_WORLD_BP_DIR, "world_behavior_packs.json");
      const manifestSrc = fs.existsSync(path.join(GAME_DIR, "manifest.json"))
        ? path.join(GAME_DIR, "manifest.json")
        : path.join(__dirname, "manifest.json");
      const manifest = JSON.parse(fs.readFileSync(manifestSrc, "utf8"));
      const packConfig = [
        {
          pack_id: manifest.header.uuid,
          version: manifest.header.version,
        },
      ];
      fs.writeFileSync(worldBpJson, JSON.stringify(packConfig, null, 2));

      console.log(`[Build] Deployed to BDS: ${BDS_ADDON_DIR} & ${bdsDevBpDir}`);
    }

    console.log(`[Build] [${TARGET_GAME}] Build and dual-deployment completed successfully!`);
  } catch (err) {
    console.error("[Build] Build failed with error:", err.stack || err);
    process.exit(1);
  }
}

build().catch((err) => {
  console.error("[Build] Unhandled rejection:", err.stack || err);
  process.exit(1);
});
