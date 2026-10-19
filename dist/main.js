// src/main.ts
import { world, system } from "@minecraft/server";
import * as gametest from "@minecraft/server-gametest";
function aiDebugLog(message) {
  console.warn(`[AI-DEBUG] ${message}`);
  const pad = ".".repeat(220);
  for (let i = 0; i < 20; i++) {
    console.warn(`[AI-FLUSH:${i}] ${pad}`);
  }
  console.warn(`[AI-DEBUG-END] ${message}`);
}
system.run(() => {
  aiDebugLog("Addon Loaded Successfully!");
  world.sendMessage("\xA7a[Vibe Coding Addon] \xA7fAddon Loaded Successfully! (Reloaded)");
});
gametest.register("ai", "smoke_test", (test) => {
  aiDebugLog("GameTest smoke_test started!");
  const blockLoc = { x: 1, y: 1, z: 1 };
  test.setBlock(blockLoc, "minecraft:gold_block");
  test.assertBlockPresent("minecraft:gold_block", blockLoc, true);
  const bot = test.spawnSimulatedPlayer({ x: 2, y: 1, z: 2 }, "GameTestBot");
  test.assert(bot !== void 0, "Failed to spawn GameTest SimulatedPlayer");
  aiDebugLog("GameTest smoke_test passed successfully!");
  test.succeed();
}).maxTicks(100).structureName("gametest:fabric_square");
var activeBot = null;
function runSimulatedPlayerTest() {
  system.run(() => {
    aiDebugLog("Initiating SimulatedPlayer Autonomous Test...");
    const overworld = world.getDimension("overworld");
    try {
      overworld.runCommand("tickingarea add circle 0 65 0 2 ai_test_area");
    } catch {
    }
    const spawnLoc = {
      dimension: overworld,
      x: 0,
      y: 65,
      z: 0
    };
    try {
      if (activeBot) {
        try {
          activeBot.disconnect();
        } catch {
        }
        activeBot = null;
      }
      if (typeof overworld.spawnSimulatedPlayer === "function") {
        activeBot = overworld.spawnSimulatedPlayer(spawnLoc, "AIBot_Tester");
        aiDebugLog(`SimulatedPlayer spawned: ${activeBot.name}`);
        system.runTimeout(() => {
          if (activeBot) {
            activeBot.jump();
            activeBot.runCommand("say [AI-DEBUG] Hello from SimulatedPlayer!");
            aiDebugLog("SimulatedPlayer jumped and spoke in chat!");
            aiDebugLog("Autonomous Bot Test Passed!");
          }
        }, 20);
      } else {
        aiDebugLog("spawnSimulatedPlayer not available in standard dimension. Falling back to player/world test.");
      }
    } catch (err) {
      aiDebugLog(`SimulatedPlayer test notice: ${String(err)}`);
    }
    const players = world.getAllPlayers();
    aiDebugLog(`Current world players count: ${players.length}`);
    for (const player of players) {
      player.sendMessage("\xA7b[AI-TEST] \xA7aAutonomous test triggered!");
      try {
        player.dimension.spawnParticle("minecraft:totem_particle", player.location);
      } catch {
      }
    }
    world.sendMessage("\xA7e[Vibe Coding Addon] \xA7aAutonomous self-test executed!");
  });
}
system.afterEvents.scriptEventReceive.subscribe(
  (event) => {
    if (event.id !== "ai:test") return;
    const message = (event.message || "").trim();
    aiDebugLog(`Received scriptevent ai:test with message: "${message}"`);
    if (message === "simulated" || message === "bot") {
      runSimulatedPlayerTest();
    } else if (message === "gametest") {
      system.run(() => {
        try {
          world.getDimension("overworld").runCommand("gametest run ai:smoke_test");
          aiDebugLog("Triggered /gametest run ai:smoke_test");
        } catch (err) {
          aiDebugLog(`Failed to run gametest: ${String(err)}`);
        }
      });
    } else if (message === "ping" || message === "run" || message === "") {
      runSimulatedPlayerTest();
    }
  },
  {
    namespaces: ["ai"]
  }
);
export {
  aiDebugLog,
  runSimulatedPlayerTest
};
