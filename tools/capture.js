const { spawn } = require("child_process");
const path = require("path");

const scriptPath = path.join(__dirname, "capture-mc.ps1");
const outputFile = path.join(__dirname, "..", "docs", "screenshots", "mc_ingame_latest.png");

console.log(`[Capture] Launching screenshot capture...`);
const ps = spawn("powershell", ["-ExecutionPolicy", "Bypass", "-File", scriptPath, "-OutputFile", outputFile], {
  stdio: "inherit",
});

ps.on("close", (code) => {
  if (code === 0) {
    console.log(`[Capture] Screenshot saved to: ${outputFile}`);
  } else {
    console.error(`[Capture] Screenshot failed with exit code ${code}`);
  }
  process.exit(code);
});
