const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8088;
const DIST_DIR = path.resolve(__dirname, "..", "dist");

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];

  if (url === "/" || url === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>モンスター襲撃防衛戦アドオン ダウンロード</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #12141a;
      color: #f0f2f5;
      margin: 0;
      padding: 24px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .card {
      background: #1e222d;
      border: 1px solid #2e3547;
      border-radius: 16px;
      max-width: 480px;
      width: 100%;
      padding: 24px;
      box-sizing: border-box;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    h1 {
      font-size: 20px;
      color: #ffcc00;
      margin-top: 0;
      text-align: center;
    }
    p {
      font-size: 14px;
      color: #9ba3b5;
      line-height: 1.6;
    }
    .btn {
      display: block;
      width: 100%;
      box-sizing: border-box;
      text-align: center;
      padding: 16px;
      margin: 12px 0;
      border-radius: 12px;
      font-size: 16px;
      font-weight: bold;
      text-decoration: none;
      transition: opacity 0.2s;
    }
    .btn-primary {
      background: linear-gradient(135deg, #10b981, #059669);
      color: #ffffff;
      box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
    }
    .btn-secondary {
      background: #2b3142;
      color: #cbd5e1;
      border: 1px solid #3d465d;
    }
    .guide {
      background: #161820;
      border-radius: 8px;
      padding: 14px;
      margin-top: 20px;
      font-size: 13px;
    }
    .guide-title {
      font-weight: bold;
      color: #60a5fa;
      margin-bottom: 6px;
    }
    .step {
      margin: 4px 0;
      color: #d1d5db;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>⚔️ モンスター襲撃防衛戦アドオン</h1>
    <p>Wave制モンスター防衛戦＆武器クラフト・強化アドオンの完成版パッケージです。</p>

    <a class="btn btn-primary" href="/download/vibe_addon.mcaddon">
      📥 .mcaddon をダウンロード<br>
      <span style="font-size: 12px; font-weight: normal; opacity: 0.9;">（推奨: タップしてマイクラを起動）</span>
    </a>

    <a class="btn btn-secondary" href="/download/vibe_addon_bp.mcpack">
      📦 ビヘイビアーパック (.mcpack)
    </a>

    <a class="btn btn-secondary" href="/download/vibe_addon_rp.mcpack">
      🎨 リソースパック (.mcpack)
    </a>

    <div class="guide">
      <div class="guide-title">📱 スマホへの導入手順 (iOS / Android)</div>
      <div class="step">1. 上の「.mcaddon をダウンロード」をタップ</div>
      <div class="step">2. ダウンロード完了後、ファイルを開く</div>
      <div class="step">3. アプリ一覧から「Minecraft」を選択</div>
      <div class="step">4. 自動でマイクラが起動しインポート完了！</div>
    </div>
  </div>
</body>
</html>`);
    return;
  }

  if (url.startsWith("/download/")) {
    const filename = path.basename(url);
    const filePath = path.join(DIST_DIR, filename);

    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": stat.size,
      });
      fs.createReadStream(filePath).pipe(res);
      console.log(`[DownloadServer] Served ${filename} (${stat.size} bytes)`);
      return;
    }
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[DownloadServer] Running on http://localhost:${PORT}/ and http://0.0.0.0:${PORT}/`);
});
