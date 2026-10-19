const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

const HTTP_PORT = 3001; // BDS用HTTPコントロールポート
const BDS_DIR = fs.existsSync("C:\\bds") ? "C:\\bds" : path.resolve(__dirname, "..", "server");
const BDS_EXE = path.resolve(BDS_DIR, "bedrock_server.exe");

let bdsProcess = null;
const recentLogs = [];

function appendLog(line) {
  const clean = line.trim();
  if (!clean) return;
  recentLogs.push({ time: new Date().toISOString(), text: clean });
  if (recentLogs.length > 200) recentLogs.shift();
  console.log(`[BDS] ${clean}`);
}

function startBDS() {
  if (bdsProcess) {
    console.log("[Runner] BDS is already running.");
    return;
  }

  console.log(`[Runner] Starting Bedrock Dedicated Server: ${BDS_EXE}`);
  bdsProcess = spawn(BDS_EXE, [], {
    cwd: BDS_DIR,
    stdio: ["pipe", "pipe", "pipe"],
  });

  bdsProcess.stdout.on("data", (data) => {
    const text = data.toString("utf8");
    text.split(/\r?\n/).forEach(appendLog);
  });

  bdsProcess.stderr.on("data", (data) => {
    const text = data.toString("utf8");
    text.split(/\r?\n/).forEach(appendLog);
  });

  bdsProcess.on("close", (code) => {
    console.log(`[Runner] BDS exited with code ${code}`);
    bdsProcess = null;
  });

  bdsProcess.on("error", (err) => {
    console.error("[Runner] Failed to start BDS:", err);
    bdsProcess = null;
  });
}

function sendCommand(cmd) {
  return new Promise((resolve, reject) => {
    if (!bdsProcess || !bdsProcess.stdin) {
      return reject(new Error("BDS is not running"));
    }
    console.log(`[Runner] Sending command to BDS stdin: ${cmd}`);
    bdsProcess.stdin.write(cmd.replace(/^\//, "") + "\n");
    resolve({ status: "ok", command: cmd });
  });
}

// HTTP API サーバー
const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "GET" && (req.url === "/" || req.url === "/status")) {
    res.writeHead(200);
    res.end(
      JSON.stringify({
        status: bdsProcess ? "running" : "stopped",
        pid: bdsProcess ? bdsProcess.pid : null,
        recentLogs: recentLogs.slice(-30),
      })
    );
    return;
  }

  if (req.method === "POST" && req.url === "/cmd") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      let parsed = {};
      try {
        parsed = JSON.parse(body || "{}");
      } catch {
        res.writeHead(400);
        return res.end(JSON.stringify({ status: "error", message: "Invalid JSON" }));
      }

      const cmd = parsed.command;
      if (!cmd) {
        res.writeHead(400);
        return res.end(JSON.stringify({ status: "error", message: "Missing command" }));
      }

      try {
        const result = await sendCommand(cmd);
        res.writeHead(200);
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(503);
        res.end(JSON.stringify({ status: "error", message: String(err) }));
      }
    });
    return;
  }

  if (req.method === "POST" && req.url === "/restart") {
    if (bdsProcess) {
      console.log("[Runner] Restart requested: stopping current BDS...");
      bdsProcess.once("close", () => {
        console.log("[Runner] Previous BDS stopped. Starting new instance in 1s...");
        setTimeout(startBDS, 1000);
      });
      bdsProcess.stdin.write("stop\n");
    } else {
      startBDS();
    }
    res.writeHead(200);
    res.end(JSON.stringify({ status: "restarting" }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ status: "not_found" }));
});

startBDS();

server.listen(HTTP_PORT, () => {
  console.log(`[Runner] BDS Runner HTTP control listening on http://localhost:${HTTP_PORT}`);
  console.log(`[Runner] Endpoints: GET /status, POST /cmd (body: {"command":"..."}), POST /restart`);
});
