const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

// ==============================================================================
// 1. カラーユーティリティ
// ==============================================================================
function parseColor(val) {
  if (!val || val === "transparent" || val === "none") {
    return [0, 0, 0, 0];
  }
  if (Array.isArray(val)) {
    return [val[0] || 0, val[1] || 0, val[2] || 0, val[3] !== undefined ? val[3] : 255];
  }
  if (typeof val === "string" && val.startsWith("#")) {
    let hex = val.slice(1);
    if (hex.length === 3) {
      hex = hex.split("").map((c) => c + c).join("");
    }
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        255,
      ];
    }
    if (hex.length === 8) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        parseInt(hex.slice(6, 8), 16),
      ];
    }
  }
  return [0, 0, 0, 255];
}

// ==============================================================================
// 2. ミニビットマップフォント (5x7)
// ==============================================================================
const FONT_5X7 = {
  " ": [0,0,0,0,0],
  "!": [0,0,0x5f,0,0],
  "\"": [0,0x07,0,0x07,0],
  "#": [0x14,0x7f,0x14,0x7f,0x14],
  "$": [0x24,0x2a,0x7f,0x2a,0x12],
  "%": [0x23,0x13,0x08,0x64,0x62],
  "&": [0x36,0x49,0x55,0x22,0x50],
  "'": [0,0x05,0x03,0,0],
  "(": [0,0x1c,0x22,0x41,0],
  ")": [0,0x41,0x22,0x1c,0],
  "*": [0x14,0x08,0x3e,0x08,0x14],
  "+": [0x08,0x08,0x3e,0x08,0x08],
  ",": [0,0x50,0x30,0,0],
  "-": [0x08,0x08,0x08,0x08,0x08],
  ".": [0,0x60,0x60,0,0],
  "/": [0x20,0x10,0x08,0x04,0x02],
  "0": [0x3e,0x51,0x49,0x45,0x3e],
  "1": [0,0x42,0x7f,0x40,0],
  "2": [0x42,0x61,0x51,0x49,0x46],
  "3": [0x21,0x41,0x45,0x4b,0x31],
  "4": [0x18,0x14,0x12,0x7f,0x10],
  "5": [0x27,0x45,0x45,0x45,0x39],
  "6": [0x3c,0x4a,0x49,0x49,0x30],
  "7": [0x01,0x71,0x09,0x05,0x03],
  "8": [0x36,0x49,0x49,0x49,0x36],
  "9": [0x06,0x49,0x49,0x29,0x1e],
  ":": [0,0x36,0x36,0,0],
  ";": [0,0x56,0x36,0,0],
  "<": [0x08,0x14,0x22,0x41,0],
  "=": [0x14,0x14,0x14,0x14,0x14],
  ">": [0x41,0x22,0x14,0x08,0],
  "?": [0x02,0x01,0x51,0x09,0x06],
  "@": [0x32,0x49,0x79,0x41,0x3e],
  "A": [0x7e,0x11,0x11,0x11,0x7e],
  "B": [0x7f,0x49,0x49,0x49,0x36],
  "C": [0x3e,0x41,0x41,0x41,0x22],
  "D": [0x7f,0x41,0x41,0x22,0x1c],
  "E": [0x7f,0x49,0x49,0x49,0x41],
  "F": [0x7f,0x09,0x09,0x09,0x01],
  "G": [0x3e,0x41,0x49,0x49,0x7a],
  "H": [0x7f,0x08,0x08,0x08,0x7f],
  "I": [0,0x41,0x7f,0x41,0],
  "J": [0x20,0x40,0x41,0x3f,0x01],
  "K": [0x7f,0x08,0x14,0x22,0x41],
  "L": [0x7f,0x40,0x40,0x40,0x40],
  "M": [0x7f,0x02,0x0c,0x02,0x7f],
  "N": [0x7f,0x04,0x08,0x10,0x7f],
  "O": [0x3e,0x41,0x41,0x41,0x3e],
  "P": [0x7f,0x09,0x09,0x09,0x06],
  "Q": [0x3e,0x41,0x51,0x21,0x5e],
  "R": [0x7f,0x09,0x19,0x29,0x46],
  "S": [0x46,0x49,0x49,0x49,0x31],
  "T": [0x01,0x01,0x7f,0x01,0x01],
  "U": [0x3f,0x40,0x40,0x40,0x3f],
  "V": [0x1f,0x20,0x40,0x20,0x1f],
  "W": [0x7f,0x20,0x18,0x20,0x7f],
  "X": [0x63,0x14,0x08,0x14,0x63],
  "Y": [0x07,0x08,0x70,0x08,0x07],
  "Z": [0x61,0x51,0x49,0x45,0x43],
  "[": [0,0x7f,0x41,0x41,0],
  "\\": [0x02,0x04,0x08,0x10,0x20],
  "]": [0,0x41,0x41,0x7f,0],
  "^": [0x04,0x02,0x01,0x02,0x04],
  "_": [0x40,0x40,0x40,0x40,0x40],
  "`": [0,0x01,0x02,0x04,0],
  "a": [0x20,0x54,0x54,0x54,0x78],
  "b": [0x7f,0x48,0x44,0x44,0x38],
  "c": [0x38,0x44,0x44,0x44,0x20],
  "d": [0x38,0x44,0x44,0x48,0x7f],
  "e": [0x38,0x54,0x54,0x54,0x18],
  "f": [0x08,0x7e,0x09,0x01,0x02],
  "g": [0x0c,0x52,0x52,0x52,0x3e],
  "h": [0x7f,0x08,0x04,0x04,0x78],
  "i": [0,0x44,0x7d,0x40,0],
  "j": [0x20,0x40,0x44,0x3d,0],
  "k": [0x7f,0x10,0x28,0x44,0],
  "l": [0,0x41,0x7f,0x40,0],
  "m": [0x7c,0x04,0x18,0x04,0x78],
  "n": [0x7c,0x08,0x04,0x04,0x78],
  "o": [0x38,0x44,0x44,0x44,0x38],
  "p": [0x7c,0x14,0x14,0x14,0x08],
  "q": [0x08,0x14,0x14,0x18,0x7c],
  "r": [0x7c,0x08,0x04,0x04,0x08],
  "s": [0x48,0x54,0x54,0x54,0x20],
  "t": [0x04,0x3f,0x44,0x40,0x20],
  "u": [0x3c,0x40,0x40,0x20,0x7c],
  "v": [0x1c,0x20,0x40,0x20,0x1c],
  "w": [0x3c,0x40,0x30,0x40,0x3c],
  "x": [0x44,0x28,0x10,0x28,0x44],
  "y": [0x0c,0x50,0x50,0x50,0x3c],
  "z": [0x44,0x64,0x54,0x4c,0x44],
};

// ==============================================================================
// 3. 描画コンテキスト
// ==============================================================================
class DrawingContext {
  constructor(width, height, bgColor = [24, 24, 27, 255]) {
    this.width = width;
    this.height = height;
    this.png = new PNG({ width, height });
    this.fill(bgColor);
  }

  setPixel(x, y, color) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (y * this.width + x) * 4;
    const alpha = (color[3] !== undefined ? color[3] : 255) / 255;
    if (alpha <= 0) return;

    if (alpha >= 1) {
      this.png.data[idx] = color[0];
      this.png.data[idx + 1] = color[1];
      this.png.data[idx + 2] = color[2];
      this.png.data[idx + 3] = 255;
    } else {
      const invAlpha = 1 - alpha;
      this.png.data[idx] = Math.round(color[0] * alpha + this.png.data[idx] * invAlpha);
      this.png.data[idx + 1] = Math.round(color[1] * alpha + this.png.data[idx + 1] * invAlpha);
      this.png.data[idx + 2] = Math.round(color[2] * alpha + this.png.data[idx + 2] * invAlpha);
      this.png.data[idx + 3] = 255;
    }
  }

  fill(color) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = (y * this.width + x) * 4;
        this.png.data[idx] = color[0];
        this.png.data[idx + 1] = color[1];
        this.png.data[idx + 2] = color[2];
        this.png.data[idx + 3] = color[3] !== undefined ? color[3] : 255;
      }
    }
  }

  fillRect(x, y, w, h, color) {
    for (let cy = y; cy < y + h; cy++) {
      for (let cx = x; cx < x + w; cx++) {
        this.setPixel(cx, cy, color);
      }
    }
  }

  strokeRect(x, y, w, h, color, lineWidth = 1) {
    this.fillRect(x, y, w, lineWidth, color);
    this.fillRect(x, y + h - lineWidth, w, lineWidth, color);
    this.fillRect(x, y, lineWidth, h, color);
    this.fillRect(x + w - lineWidth, y, lineWidth, h, color);
  }

  drawText(text, startX, startY, color = [255, 255, 255, 255], scale = 2) {
    let cursorX = startX;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === "\n") {
        startY += 8 * scale + 2;
        cursorX = startX;
        continue;
      }
      const bitmap = FONT_5X7[char] || FONT_5X7["?"];
      for (let col = 0; col < 5; col++) {
        const bits = bitmap[col] || 0;
        for (let row = 0; row < 7; row++) {
          if ((bits & (1 << row)) !== 0) {
            this.fillRect(cursorX + col * scale, startY + row * scale, scale, scale, color);
          }
        }
      }
      cursorX += (5 + 1) * scale;
    }
  }

  drawImage(srcPng, dstX, dstY, scale = 1, showGrid = false) {
    for (let sy = 0; sy < srcPng.height; sy++) {
      for (let sx = 0; sx < srcPng.width; sx++) {
        const sidx = (sy * srcPng.width + sx) * 4;
        const color = [
          srcPng.data[sidx],
          srcPng.data[sidx + 1],
          srcPng.data[sidx + 2],
          srcPng.data[sidx + 3],
        ];
        if (color[3] > 0) {
          this.fillRect(dstX + sx * scale, dstY + sy * scale, scale, scale, color);
        }
        if (showGrid && scale >= 6) {
          this.strokeRect(dstX + sx * scale, dstY + sy * scale, scale, scale, [255, 255, 255, 20]);
        }
      }
    }
    if (showGrid) {
      this.strokeRect(dstX, dstY, srcPng.width * scale, srcPng.height * scale, [255, 255, 255, 80], 2);
    }
  }

  save(outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const buffer = PNG.sync.write(this.png);
    fs.writeFileSync(outputPath, buffer);
  }
}

// ==============================================================================
// 4. ドット絵生成コア (Grid -> PNG)
// ==============================================================================
function renderPixelGrid(grid, palette) {
  const height = grid.length;
  const width = grid[0].length;
  const png = new PNG({ width, height });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const colorKey = String(grid[y][x]);
      const rawColor = palette[colorKey] || "transparent";
      const [r, g, b, a] = parseColor(rawColor);
      const idx = (y * width + x) * 4;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }
  return png;
}

// ==============================================================================
// 5. スマホ向け提案ボード（UI Proposal Sheet）生成
// ==============================================================================
function generateProposalBoard(assetEntries, outputPath) {
  const width = 1080;
  const cardHeight = 440;
  const headerHeight = 120;
  const totalHeight = headerHeight + assetEntries.length * (cardHeight + 20) + 40;

  const ctx = new DrawingContext(width, totalHeight, [18, 18, 22, 255]); // ダークスレート

  // --- ヘッダー描画 ---
  ctx.fillRect(0, 0, width, headerHeight - 10, [28, 28, 36, 255]);
  ctx.strokeRect(0, 0, width, headerHeight - 10, [60, 60, 75, 255], 2);
  ctx.drawText("MINECRAFT BEDROCK ADDON: ASSET PROPOSAL SHEET", 30, 25, [80, 200, 255, 255], 3);
  ctx.drawText("PIXEL-ART & UI MOCKUP PROPOSALS (SMARTPHONE VIEW)", 30, 65, [180, 180, 195, 255], 2);

  // --- 各案のカード描画 ---
  assetEntries.forEach((asset, idx) => {
    const cardY = headerHeight + idx * (cardHeight + 20);
    const cardW = width - 60;
    const cardX = 30;

    // カード背景 (Minecraft UIスレート風)
    ctx.fillRect(cardX, cardY, cardW, cardHeight, [34, 34, 44, 255]);
    ctx.strokeRect(cardX, cardY, cardW, cardHeight, [75, 75, 95, 255], 2);

    // タイトルバナー
    ctx.fillRect(cardX + 2, cardY + 2, cardW - 4, 44, [48, 48, 62, 255]);
    ctx.drawText(asset.name || asset.id, cardX + 20, cardY + 12, [255, 230, 100, 255], 3);

    // 1. 拡大プレビュー (12x Scale, 192x192)
    const scale = 12;
    const previewX = cardX + 30;
    const previewY = cardY + 70;
    const previewSize = asset.width * scale;

    ctx.fillRect(previewX - 4, previewY - 4, previewSize + 8, previewSize + 8, [20, 20, 25, 255]);
    ctx.drawImage(asset.png, previewX, previewY, scale, true);
    ctx.drawText(`ZOOM (${scale}X)`, previewX + 10, previewY + previewSize + 15, [160, 160, 180, 255], 2);

    // 2. 原寸 ＆ マイクラ風インベントリスロットプレビュー (72x72)
    const slotX = previewX + previewSize + 50;
    const slotY = cardY + 90;
    const slotSize = 80;

    // スロット枠 (Minecraftのインベントリスロット風: 上左暗め、下右明るめ)
    ctx.fillRect(slotX, slotY, slotSize, slotSize, [139, 139, 139, 255]);
    ctx.fillRect(slotX + 4, slotY + 4, slotSize - 8, slotSize - 8, [55, 55, 55, 255]);
    ctx.fillRect(slotX + 6, slotY + 6, slotSize - 12, slotSize - 12, [198, 198, 198, 255]);
    ctx.fillRect(slotX + 10, slotY + 10, slotSize - 20, slotSize - 20, [139, 139, 139, 255]);

    // スロット内に3倍拡大で配置
    const inSlotScale = 3;
    const inSlotOffset = Math.round((slotSize - 20 - asset.width * inSlotScale) / 2) + 10;
    ctx.drawImage(asset.png, slotX + inSlotOffset, slotY + inSlotOffset, inSlotScale, false);
    ctx.drawText("SLOT PREVIEW", slotX, slotY + slotSize + 15, [160, 160, 180, 255], 2);

    // 原寸 (1X, 16x16)
    const actualX = slotX + slotSize + 40;
    const actualY = slotY + 20;
    ctx.strokeRect(actualX - 2, actualY - 2, asset.width + 4, asset.height + 4, [100, 100, 100, 255]);
    ctx.drawImage(asset.png, actualX, actualY, 1, false);
    ctx.drawText("ACTUAL (1X)", actualX - 5, actualY + asset.height + 15, [160, 160, 180, 255], 2);

    // 3. カラーパレット一覧
    const paletteX = actualX + 120;
    const paletteY = cardY + 70;
    ctx.drawText("COLOR PALETTE:", paletteX, paletteY, [200, 200, 220, 255], 2);

    const keys = Object.keys(asset.palette);
    keys.forEach((key, pidx) => {
      const px = paletteX + (pidx % 4) * 85;
      const py = paletteY + 30 + Math.floor(pidx / 4) * 60;
      const colorVal = asset.palette[key];
      const parsed = parseColor(colorVal);

      // スウォッチ枠
      ctx.fillRect(px, py, 28, 28, parsed[3] === 0 ? [30, 30, 35, 255] : parsed);
      ctx.strokeRect(px, py, 28, 28, [200, 200, 200, 255], 1);
      if (parsed[3] === 0) {
        // 透過記号
        ctx.fillRect(px + 4, py + 4, 20, 2, [255, 50, 50, 255]);
      }
      ctx.drawText(`[${key}]`, px + 34, py + 6, [220, 220, 220, 255], 2);
    });

    // 4. メタ情報・説明
    const descY = cardY + cardHeight - 55;
    ctx.fillRect(cardX + 10, descY, cardW - 20, 40, [26, 26, 34, 255]);
    ctx.drawText(`ID: ${asset.id} | Size: ${asset.width}x${asset.height} | Colors: ${keys.length}`, cardX + 25, descY + 12, [130, 220, 160, 255], 2);
  });

  ctx.save(outputPath);
  console.log(`[PixelEngine] Proposal board generated at: ${outputPath}`);
}

// ==============================================================================
// 6. メイン実行処理
// ==============================================================================
async function main() {
  const targetGame = process.argv[2] || "wave-defense";
  const gameDir = fs.existsSync(path.join(__dirname, "..", "games", targetGame))
    ? path.join(__dirname, "..", "games", targetGame)
    : path.resolve(__dirname, "..");

  const pixelDataDir = fs.existsSync(path.join(gameDir, "assets", "pixel-data"))
    ? path.join(gameDir, "assets", "pixel-data")
    : path.join(__dirname, "..", "assets", "pixel-data");

  const texturesItemDir = path.join(gameDir, "textures", "items");
  if (!fs.existsSync(texturesItemDir)) {
    fs.mkdirSync(texturesItemDir, { recursive: true });
  }

  const rootTexturesDir = path.join(__dirname, "..", "textures", "items");
  if (!fs.existsSync(rootTexturesDir)) {
    fs.mkdirSync(rootTexturesDir, { recursive: true });
  }

  const proposalPath = path.join(__dirname, "..", "docs", "screenshots", "ui_proposal.png");

  if (!fs.existsSync(pixelDataDir)) {
    console.error(`[PixelEngine] Error: Directory not found: ${pixelDataDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(pixelDataDir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.log(`[PixelEngine] No JSON asset files found in ${pixelDataDir}`);
    return;
  }

  const renderedAssets = [];

  for (const file of files) {
    const filePath = path.join(pixelDataDir, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const png = renderPixelGrid(data.grid, data.palette);

      // リソースパックのアイテムテクスチャへ出力 (ゲーム内 & ルート両方)
      const outPngPath = path.join(texturesItemDir, `${data.id}.png`);
      fs.writeFileSync(outPngPath, PNG.sync.write(png));

      const rootPngPath = path.join(rootTexturesDir, `${data.id}.png`);
      fs.writeFileSync(rootPngPath, PNG.sync.write(png));
      console.log(`[PixelEngine] Exported texture: ${outPngPath}`);

      renderedAssets.push({
        ...data,
        png,
      });
    } catch (err) {
      console.error(`[PixelEngine] Error processing ${file}:`, err);
    }
  }

  // スマホ提案用ボード画像を生成
  if (renderedAssets.length > 0) {
    generateProposalBoard(renderedAssets, proposalPath);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  renderPixelGrid,
  generateProposalBoard,
  DrawingContext,
};
