const http = require("http");
const crypto = require("crypto");
const { WebSocketServer, WebSocket } = require("ws");
const { v4: uuidv4 } = require("uuid");

const WS_PORT = 8080;
const HTTP_PORT = 3000;

// ============================================================================
// Minecraft Bedrock Native WebSocket Encryption (com.microsoft.minecraft.wsencrypt)
// Curve: secp384r1 (SPKI DER) | Cipher: AES-256-CFB8
// ============================================================================
const ASN1_HEADER = Buffer.from("3076301006072a8648ce3d020106052b81040022036200", "hex");

class CFB8Cipher {
  constructor(key, iv) {
    this.key = key;
    this.iv = Buffer.from(iv);
  }
  update(buffer) {
    const output = Buffer.allocUnsafe(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      const cipher = crypto.createCipheriv("aes-256-ecb", this.key, null);
      cipher.setAutoPadding(false);
      const encryptedIv = cipher.update(this.iv);
      output[i] = buffer[i] ^ encryptedIv[0];
      this.iv.copy(this.iv, 0, 1);
      this.iv[15] = output[i];
    }
    return output;
  }
}

class CFB8Decipher {
  constructor(key, iv) {
    this.key = key;
    this.iv = Buffer.from(iv);
    this.savedIv = null;
  }
  save() {
    this.savedIv = Buffer.from(this.iv);
  }
  restore() {
    if (this.savedIv) {
      this.savedIv.copy(this.iv);
    }
  }
  update(buffer) {
    const output = Buffer.allocUnsafe(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      const cipher = crypto.createCipheriv("aes-256-ecb", this.key, null);
      cipher.setAutoPadding(false);
      const encryptedIv = cipher.update(this.iv);
      output[i] = buffer[i] ^ encryptedIv[0];
      this.iv.copy(this.iv, 0, 1);
      this.iv[15] = buffer[i];
    }
    return output;
  }
}

class MCEncryption {
  constructor() {
    this.ecdh = crypto.createECDH("secp384r1");
    this.publicKey = this.ecdh.generateKeys();
    this.cipher = null;
    this.decipher = null;
    this.enabled = false;
    this.salt = crypto.randomBytes(16);
  }

  getHandshakeParams() {
    const spkiPubKey = Buffer.concat([ASN1_HEADER, this.publicKey]).toString("base64");
    return {
      mode: "cfb8",
      publicKey: spkiPubKey,
      salt: this.salt.toString("base64"),
    };
  }

  completeHandshake(clientPublicKeyBase64) {
    const clientPubDer = Buffer.from(clientPublicKeyBase64, "base64");
    const rawClientPub = clientPubDer.subarray(ASN1_HEADER.length);
    const sharedSecret = this.ecdh.computeSecret(rawClientPub);
    const key = crypto
      .createHash("sha256")
      .update(Buffer.concat([this.salt, sharedSecret]))
      .digest();
    const iv = key.subarray(0, 16);
    this.cipher = new CFB8Cipher(key, iv);
    this.decipher = new CFB8Decipher(key, iv);
    this.enabled = true;
  }

  encrypt(jsonString) {
    if (!this.cipher) throw new Error("Encryption not initialized");
    return this.cipher.update(Buffer.from(jsonString, "utf-8"));
  }

  decrypt(rawBuffer) {
    if (!this.decipher) throw new Error("Encryption not initialized");
    this.decipher.save();
    return this.decipher.update(Buffer.from(rawBuffer)).toString("utf-8");
  }

  restoreDecipher() {
    if (this.decipher) this.decipher.restore();
  }
}

// ============================================================================
// Bridge State
// ============================================================================
let mcSocket = null;
let mcEncryption = null;
let encryptionReadyPromise = null;
const pendingRequests = new Map();
const recentChatMessages = [];

function sendToMinecraft(payloadObj) {
  if (!mcSocket || mcSocket.readyState !== WebSocket.OPEN) {
    throw new Error("Minecraft WebSocket is not open");
  }
  const jsonStr = JSON.stringify(payloadObj);
  if (mcEncryption && mcEncryption.enabled) {
    mcSocket.send(mcEncryption.encrypt(jsonStr));
  } else {
    mcSocket.send(jsonStr);
  }
}

function initiateEncryptionHandshake(ws) {
  mcEncryption = new MCEncryption();
  const requestId = uuidv4();
  const handshakeParams = mcEncryption.getHandshakeParams();

  const packet = {
    header: {
      version: 1,
      requestId,
      messagePurpose: "ws:encrypt",
    },
    body: {
      mode: handshakeParams.mode,
      publicKey: handshakeParams.publicKey,
      salt: handshakeParams.salt,
    },
  };

  encryptionReadyPromise = new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        console.log("[MC-Bridge] Encryption handshake timed out (continuing in plaintext mode if unencrypted).");
        resolve(false);
      }
    }, 3000);

    pendingRequests.set(requestId, {
      command: "ws:encrypt",
      timer,
      resolve: (res) => {
        const clientPub = res?.response?.publicKey ?? res?.body?.publicKey;
        if (clientPub) {
          try {
            mcEncryption.completeHandshake(clientPub);
            console.log("[MC-Bridge] Encrypted WebSocket (com.microsoft.minecraft.wsencrypt / AES-256-CFB8) established!");
            // Subscribe to PlayerMessage events for extra visibility
            sendToMinecraft({
              header: {
                version: 1,
                requestId: uuidv4(),
                messagePurpose: "subscribe",
                messageType: "commandRequest",
              },
              body: {
                eventName: "PlayerMessage",
              },
            });
            resolve(true);
            return;
          } catch (err) {
            console.error("[MC-Bridge] Failed to complete encryption handshake:", err);
          }
        }
        resolve(false);
      },
    });
  });

  console.log("[MC-Bridge] Initiating ws:encrypt handshake with Minecraft...");
  ws.send(JSON.stringify(packet));
}

// 1. Minecraft接続用 WebSocketサーバー (Port 8080)
const wss = new WebSocketServer({ port: WS_PORT });

wss.on("connection", (ws, req) => {
  console.log(
    `[MC-Bridge] Minecraft client connected from ${req.socket.remoteAddress} (protocol: ${ws.protocol || "none"})`
  );
  mcSocket = ws;

  ws.on("message", (raw) => {
    let text;
    if (mcEncryption && mcEncryption.enabled) {
      try {
        text = mcEncryption.decrypt(raw);
        JSON.parse(text);
      } catch {
        mcEncryption.restoreDecipher();
        text = raw.toString("utf-8");
      }
    } else {
      text = raw.toString("utf-8");
    }

    try {
      const msg = JSON.parse(text);
      const requestId = msg?.header?.requestId;
      const purpose = msg?.header?.messagePurpose;

      if (purpose === "event" && msg?.body?.eventName === "PlayerMessage") {
        const chatEntry = {
          time: new Date().toISOString(),
          sender: msg.body.sender ?? msg.body?.properties?.Sender,
          message: msg.body.message ?? msg.body?.properties?.Message,
        };
        recentChatMessages.push(chatEntry);
        if (recentChatMessages.length > 50) recentChatMessages.shift();
        console.log(`[MC-Chat] <${chatEntry.sender}> ${chatEntry.message}`);
      }

      if (requestId && pendingRequests.has(requestId)) {
        const pending = pendingRequests.get(requestId);
        clearTimeout(pending.timer);
        pendingRequests.delete(requestId);
        pending.resolve({
          status: purpose === "error" ? "error" : "ok",
          command: pending.command,
          response: msg.body ?? msg,
        });
      } else if (purpose === "error") {
        console.error("[MC-Bridge] Minecraft WS Error:", msg);
      }
    } catch (err) {
      console.error("[MC-Bridge] Failed to parse message from Minecraft:", err);
    }
  });

  ws.on("close", () => {
    console.log("[MC-Bridge] Minecraft client disconnected.");
    if (mcSocket === ws) {
      mcSocket = null;
      mcEncryption = null;
      encryptionReadyPromise = null;
    }
  });

  ws.on("error", (err) => {
    console.error("[MC-Bridge] WebSocket error:", err);
  });

  // 接続直後に暗号化ハンドシェイクを開始
  initiateEncryptionHandshake(ws);
});

// 2. AI操作受付用 HTTPサーバー (Port 3000)
const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "GET" && (req.url === "/" || req.url === "/status")) {
    res.writeHead(200);
    res.end(
      JSON.stringify({
        status: "running",
        minecraftConnected: Boolean(mcSocket && mcSocket.readyState === WebSocket.OPEN),
        encrypted: Boolean(mcEncryption && mcEncryption.enabled),
        wsPort: WS_PORT,
        httpPort: HTTP_PORT,
        recentChatMessages: recentChatMessages.slice(-10),
      })
    );
    return;
  }

  if (req.method === "POST" && req.url === "/cmd") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      let parsed;
      try {
        parsed = JSON.parse(body || "{}");
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ status: "error", message: "Invalid JSON body" }));
        return;
      }

      const command = parsed.command;
      if (!command || typeof command !== "string") {
        res.writeHead(400);
        res.end(JSON.stringify({ status: "error", message: 'Missing "command" string in request body' }));
        return;
      }

      if (!mcSocket || mcSocket.readyState !== WebSocket.OPEN) {
        res.writeHead(503);
        res.end(
          JSON.stringify({
            status: "error",
            message: "Minecraft is not connected to WebSocket (port 8080). Run `/connect localhost:8080` in Minecraft first.",
          })
        );
        return;
      }

      if (encryptionReadyPromise) {
        await encryptionReadyPromise;
      }

      const requestId = uuidv4();
      const packet = {
        header: {
          requestId,
          messagePurpose: "commandRequest",
          version: 1,
          messageType: "commandRequest",
        },
        body: {
          origin: {
            type: "player",
          },
          commandLine: command.replace(/^\//, ""),
          version: 1,
        },
      };

      const responsePromise = new Promise((resolve) => {
        const timer = setTimeout(() => {
          if (pendingRequests.has(requestId)) {
            pendingRequests.delete(requestId);
            resolve({
              status: "ok",
              timeout: true,
              command,
              encrypted: Boolean(mcEncryption && mcEncryption.enabled),
              message: "Command sent (3s timeout reached, treated as completed)",
            });
          }
        }, 3000);

        pendingRequests.set(requestId, { resolve, timer, command });
      });

      console.log(
        `[MC-Bridge] Sending command to Minecraft (encrypted=${Boolean(mcEncryption && mcEncryption.enabled)}): /${packet.body.commandLine}`
      );
      try {
        sendToMinecraft(packet);
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ status: "error", message: String(err) }));
        return;
      }

      const result = await responsePromise;
      res.writeHead(200);
      res.end(JSON.stringify(result));
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ status: "error", message: "Not Found" }));
});

server.listen(HTTP_PORT, () => {
  console.log(`[MC-Bridge] WebSocket server listening on ws://localhost:${WS_PORT} (supports ws:encrypt AES-256-CFB8!)`);
  console.log(`[MC-Bridge] HTTP command server listening on http://localhost:${HTTP_PORT}/cmd`);
});
