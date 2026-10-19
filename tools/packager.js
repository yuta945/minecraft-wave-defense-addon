const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const { PNG } = require("pngjs");
const { DrawingContext, renderPixelGrid } = require("./pixel-engine");

const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const MARKETING_DIR = path.join(DIST_DIR, "marketing");

// ==============================================================================
// 1. pack_icon.png (256x256) の自動生成
// ==============================================================================
function generatePackIcon(sampleAsset, outputPath) {
  const size = 256;
  const ctx = new DrawingContext(size, size, [30, 32, 40, 255]);

  // マイクラ風外枠
  ctx.strokeRect(4, 4, size - 8, size - 8, [70, 75, 90, 255], 4);
  ctx.strokeRect(8, 8, size - 16, size - 16, [110, 115, 135, 255], 2);

  if (sampleAsset && sampleAsset.png) {
    // 中央に10倍拡大で配置 (160x160)
    const scale = 10;
    const px = Math.round((size - sampleAsset.width * scale) / 2);
    const py = Math.round((size - sampleAsset.height * scale) / 2) - 10;
    ctx.drawImage(sampleAsset.png, px, py, scale, false);
  }

  // 下部バナーテキスト
  ctx.fillRect(12, size - 44, size - 24, 30, [15, 15, 20, 220]);
  ctx.drawText("VIBE ADDON", 45, size - 36, [255, 215, 0, 255], 3);

  ctx.save(outputPath);
  console.log(`[Packager] Generated pack_icon.png at: ${outputPath}`);
}

// ==============================================================================
// 2. マーケット用サムネイル (1920x1080) の自動生成
// ==============================================================================
function generateMarketThumbnail(assets, outputPath) {
  const width = 1920;
  const height = 1080;
  const ctx = new DrawingContext(width, height, [18, 20, 26, 255]); // ダークブルーブラック

  // 背景装飾（幾何学グリッド風ライン）
  for (let y = 0; y < height; y += 40) {
    ctx.fillRect(0, y, width, 1, [26, 30, 42, 255]);
  }
  for (let x = 0; x < width; x += 40) {
    ctx.fillRect(x, 0, 1, height, [26, 30, 42, 255]);
  }

  // ヘッダー・メインタイトル
  ctx.fillRect(100, 80, width - 200, 140, [28, 32, 44, 255]);
  ctx.strokeRect(100, 80, width - 200, 140, [80, 180, 255, 255], 4);
  ctx.drawText("MINECRAFT MARKETPLACE EDITION", 140, 110, [80, 200, 255, 255], 5);
  ctx.drawText("CUSTOM EXPANSION ADDON PACK", 140, 165, [255, 220, 100, 255], 4);

  // ピクセルアート展示（横並びで大きく拡大）
  if (assets.length > 0) {
    const cardWidth = Math.min(500, Math.floor((width - 300) / assets.length));
    assets.forEach((asset, i) => {
      const cardX = 150 + i * (cardWidth + 60);
      const cardY = 280;
      const cardH = 680;

      ctx.fillRect(cardX, cardY, cardWidth, cardH, [35, 38, 52, 255]);
      ctx.strokeRect(cardX, cardY, cardWidth, cardH, [100, 110, 140, 255], 3);

      // アイテム名
      ctx.fillRect(cardX + 3, cardY + 3, cardWidth - 6, 60, [50, 55, 75, 255]);
      ctx.drawText(asset.name || asset.id, cardX + 20, cardY + 20, [255, 255, 255, 255], 3);

      // メイン画像 (16倍拡大, 256x256)
      const scale = 16;
      const imgX = cardX + Math.round((cardWidth - asset.width * scale) / 2);
      const imgY = cardY + 100;
      ctx.drawImage(asset.png, imgX, imgY, scale, false);

      // バッジ
      ctx.fillRect(cardX + 30, cardY + 400, cardWidth - 60, 50, [20, 140, 80, 255]);
      ctx.drawText("PRO QUALITY PIXEL ART", cardX + 45, cardY + 416, [255, 255, 255, 255], 2);

      // 詳細
      ctx.drawText(`Format: Bedrock Add-on`, cardX + 30, cardY + 480, [180, 180, 200, 255], 2);
      ctx.drawText(`Resolution: 16x16 HD Pixel`, cardX + 30, cardY + 520, [180, 180, 200, 255], 2);
      ctx.drawText(`Multiplayer & Dedicated Ready`, cardX + 30, cardY + 560, [180, 180, 200, 255], 2);
    });
  }

  // フッター
  ctx.fillRect(100, height - 70, width - 200, 40, [24, 28, 38, 255]);
  ctx.drawText("READY FOR MINECRAFT BEDROCK EDITION WINDOWS / MOBILE / CONSOLE", 130, height - 58, [140, 145, 165, 255], 2);

  ctx.save(outputPath);
  console.log(`[Packager] Generated Marketplace Thumbnail at: ${outputPath}`);
}

// ==============================================================================
// 3. ZIP / MCPACK / MCADDON 作成
// ==============================================================================
function createArchive(sourceDir, outZipPath) {
  return new Promise((resolve, reject) => {
    const tempZip = outZipPath.replace(/\.(mcpack|mcaddon)$/i, ".zip");
    if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip);
    if (fs.existsSync(outZipPath)) fs.unlinkSync(outZipPath);

    const { exec } = require("child_process");
    const cmd = `powershell -Command "Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${tempZip}' -Force"`;
    exec(cmd, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || stdout || err.message));
      try {
        fs.renameSync(tempZip, outZipPath);
        resolve();
      } catch (rErr) {
        reject(rErr);
      }
    });
  });
}

// ==============================================================================
// 4. ストア説明文 (日英) の出力
// ==============================================================================
function generateStoreListings(assets, outDir) {
  const jaText = `# Vibe Coding Expansion Add-on (統合版アドオン)

## 概要
最新の Minecraft Bedrock Edition (統合版) 向けに設計された、高品質な自律拡張アドオンです。
専用のカスタムアイテム、高解像度ピクセルアート、そして滑らかなゲームプレイ体験を提供します！

## 主な特徴
- **職人品質のドット絵**: 16x16 / 32x32 で細部までこだわり抜いたカラーパレット設計。
- **マルチプレイ・BDS完全対応**: ローカルプレイはもちろん、Bedrock Dedicated Server (BDS) でも安定動作。
- **最新 Script API 搭載**: クリーンで軽量な TypeScript エンジンを採用。

## 収録アイテム
${assets.map((a) => `- **${a.name || a.id}**: 独自の特殊効果とサウンドを搭載`).join("\n")}

## インストール手順
1. ダウンロードした \`.mcaddon\` ファイルをダブルクリック（またはタップ）します。
2. Minecraft が自動的に起動し、インポートが完了します。
3. ワールド設定でビヘイビアーパックとリソースパックの両方を有効化し、実験的機能の「ベータAPI」をオンにしてお楽しみください！
`;

  const enText = `# Vibe Coding Expansion Add-on

## Overview
A professionally crafted, high-performance expansion add-on designed for Minecraft Bedrock Edition.
Featuring custom pixel-art weapons, smooth Script API logic, and seamless multiplayer support!

## Key Features
- **Authentic Pixel Art**: Handcrafted color palettes perfectly tailored to Minecraft's vanilla aesthetic.
- **Dedicated Server Ready**: Fully compatible with both singleplayer and Bedrock Dedicated Servers (BDS).
- **Modern Script API**: Lightweight and reliable TypeScript-powered backend.

## Included Items
${assets.map((a) => `- **${a.name || a.id}**: Unique custom item with visual effects`).join("\n")}

## Installation
1. Double-click or tap the downloaded \`.mcaddon\` file.
2. Minecraft will automatically launch and import the package.
3. Enable both Behavior and Resource packs in your world settings, and toggle Beta APIs ON!
`;

  fs.writeFileSync(path.join(outDir, "store_listing_ja.md"), jaText, "utf8");
  fs.writeFileSync(path.join(outDir, "store_listing_en.md"), enText, "utf8");
  console.log(`[Packager] Store listings generated in JA and EN.`);
}

// ==============================================================================
// 5. メインパッケージング処理
// ==============================================================================
async function packageAddon() {
  const targetGame = process.argv[2] || "wave-defense";
  const gameDir = fs.existsSync(path.join(ROOT_DIR, "games", targetGame))
    ? path.join(ROOT_DIR, "games", targetGame)
    : ROOT_DIR;

  console.log(`=== [Packager] Starting Release Packaging for [${targetGame}] ===`);

  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.mkdirSync(MARKETING_DIR, { recursive: true });

  // 1. ピクセルデータの収集
  const pixelDataDir = fs.existsSync(path.join(gameDir, "assets", "pixel-data"))
    ? path.join(gameDir, "assets", "pixel-data")
    : path.join(ROOT_DIR, "assets", "pixel-data");

  const assets = [];
  if (fs.existsSync(pixelDataDir)) {
    const files = fs.readdirSync(pixelDataDir).filter((f) => f.endsWith(".json"));
    for (const f of files) {
      const data = JSON.parse(fs.readFileSync(path.join(pixelDataDir, f), "utf8"));
      data.png = renderPixelGrid(data.grid, data.palette);
      assets.push(data);
    }
  }

  // 2. pack_icon.png の生成
  const packIconPath = path.join(gameDir, "pack_icon.png");
  generatePackIcon(assets[0], packIconPath);
  fs.copyFileSync(packIconPath, path.join(ROOT_DIR, "pack_icon.png"));

  // 3. 一時ビルド・ステージング
  const stagingBpDir = path.join(DIST_DIR, "staging_bp");
  const stagingRpDir = path.join(DIST_DIR, "staging_rp");
  fs.mkdirSync(stagingBpDir, { recursive: true });
  fs.mkdirSync(stagingRpDir, { recursive: true });

  // BPコピー
  const manifestPath = fs.existsSync(path.join(gameDir, "manifest.json"))
    ? path.join(gameDir, "manifest.json")
    : path.join(ROOT_DIR, "manifest.json");

  fs.copyFileSync(manifestPath, path.join(stagingBpDir, "manifest.json"));
  fs.copyFileSync(packIconPath, path.join(stagingBpDir, "pack_icon.png"));

  const bpScriptsDir = path.join(stagingBpDir, "scripts");
  fs.mkdirSync(bpScriptsDir, { recursive: true });
  const clientBpDir = path.join(
    "C:\\Users\\enruf\\AppData\\Roaming\\Minecraft Bedrock\\Users\\Shared\\games\\com.mojang\\development_behavior_packs\\vibe_addon"
  );
  if (fs.existsSync(path.join(clientBpDir, "scripts", "main.js"))) {
    fs.copyFileSync(path.join(clientBpDir, "scripts", "main.js"), path.join(bpScriptsDir, "main.js"));
  }

  // RP作成
  const rpManifest = {
    format_version: 2,
    header: {
      name: "Vibe Coding Addon Resource Pack",
      description: "Resource Pack for Vibe Coding Addon",
      uuid: "e48ac21c-68cc-4372-a567-0e02b2c3d480",
      version: [1, 0, 0],
      min_engine_version: [1, 21, 0],
    },
    modules: [
      {
        type: "resources",
        uuid: "a81deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7e",
        version: [1, 0, 0],
      },
    ],
  };
  fs.writeFileSync(path.join(stagingRpDir, "manifest.json"), JSON.stringify(rpManifest, null, 2));
  fs.copyFileSync(packIconPath, path.join(stagingRpDir, "pack_icon.png"));

  const rpTexturesDir = path.join(stagingRpDir, "textures", "items");
  fs.mkdirSync(rpTexturesDir, { recursive: true });
  const rootTexturesDir = path.join(ROOT_DIR, "textures", "items");
  if (fs.existsSync(rootTexturesDir)) {
    fs.readdirSync(rootTexturesDir).forEach((file) => {
      fs.copyFileSync(path.join(rootTexturesDir, file), path.join(rpTexturesDir, file));
    });
  }

  // 4. .mcpack / .mcaddon の圧縮
  const bpPackPath = path.join(DIST_DIR, "vibe_addon_bp.mcpack");
  const rpPackPath = path.join(DIST_DIR, "vibe_addon_rp.mcpack");
  const addonPath = path.join(DIST_DIR, "vibe_addon.mcaddon");

  await createArchive(stagingBpDir, bpPackPath);
  console.log(`[Packager] Created Behavior Pack: ${bpPackPath}`);

  await createArchive(stagingRpDir, rpPackPath);
  console.log(`[Packager] Created Resource Pack: ${rpPackPath}`);

  // mcaddon は BP と RP をまとめた ZIP
  const stagingAddonDir = path.join(DIST_DIR, "staging_addon");
  fs.mkdirSync(stagingAddonDir, { recursive: true });
  fs.copyFileSync(bpPackPath, path.join(stagingAddonDir, "vibe_addon_bp.mcpack"));
  fs.copyFileSync(rpPackPath, path.join(stagingAddonDir, "vibe_addon_rp.mcpack"));
  await createArchive(stagingAddonDir, addonPath);
  console.log(`[Packager] Created Combined Add-on: ${addonPath}`);

  // 5. マーケティング素材の生成
  const thumbPath = path.join(MARKETING_DIR, "thumbnail_1920x1080.png");
  generateMarketThumbnail(assets, thumbPath);
  generateStoreListings(assets, MARKETING_DIR);

  console.log("=== [Packager] Release Packaging Completed Successfully! ===");
}

if (require.main === module) {
  packageAddon().catch((err) => {
    console.error("[Packager] Packaging failed:", err);
    process.exit(1);
  });
}

module.exports = { packageAddon };
