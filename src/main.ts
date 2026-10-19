import { world, system, Player, DimensionLocation } from "@minecraft/server";
import * as gametest from "@minecraft/server-gametest";
import { aiDebugLog } from "./logger";
import { WaveManager } from "./waveManager";
import { initWeaponEffects } from "./weaponEffects";
import { openMainMenu } from "./shopUI";
import {
  WEAPON_REGISTRY,
  createWeaponItem,
  givePlayerCoins,
  createShopTerminalItem,
} from "./weapons";
import { runAutonomousTests } from "./testSuite";

// アドオンロード時の初期化
system.run(() => {
  aiDebugLog("Monster Wave Defense Addon Loaded Successfully!");
  initWeaponEffects();
  WaveManager.getInstance();

  world.sendMessage(
    "§6§l[モンスター襲撃防衛戦] §aアドオンが正常にロードされました！\n" +
    "§e※「コンパス」または「防衛・強化端末」を持って右クリックするとショップUIが開きます。"
  );
});

// ============================================================================
// アイテム使用イベント（右クリック / 長押し）でUIを起動
// ============================================================================
world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  const item = event.itemStack;

  if (!player || !(player instanceof Player)) return;

  // コンパスまたは防衛・強化端末
  if (
    item.typeId === "minecraft:compass" ||
    item.typeId === "minecraft:clock" ||
    (item.nameTag && item.nameTag.includes("防衛・強化端末"))
  ) {
    system.run(() => {
      openMainMenu(player);
    });
  }
});

// ============================================================================
// GameTest 公式テスト登録
// ============================================================================
gametest
  .register("ai", "smoke_test", (test) => {
    aiDebugLog("GameTest smoke_test started!");

    const blockLoc = { x: 1, y: 1, z: 1 };
    test.setBlock(blockLoc, "minecraft:gold_block");
    test.assertBlockPresent("minecraft:gold_block", blockLoc, true);

    const bot = test.spawnSimulatedPlayer({ x: 2, y: 1, z: 2 }, "GameTestBot");
    test.assert(bot !== undefined, "Failed to spawn GameTest SimulatedPlayer");

    aiDebugLog("GameTest smoke_test passed successfully!");
    test.succeed();
  })
  .maxTicks(100)
  .structureName("gametests:mediumglass");

gametest
  .register("ai", "wave_bot_combat", (test) => {
    aiDebugLog("GameTest wave_bot_combat started!");

    // 1. 仮想プレイヤー（SimulatedPlayer）を召喚
    const bot = test.spawnSimulatedPlayer({ x: 1, y: 1, z: 1 }, "WaveHeroBot");
    test.assert(bot !== undefined, "Failed to spawn WaveHeroBot");

    // 2. 特殊武器（烈火の剣）を生成し、ボットに付与
    const flameDef = WEAPON_REGISTRY["flame_sword"];
    const sword = createWeaponItem(flameDef, 1);
    bot.giveItem(sword, true);

    // 3. モンスターを召喚
    const zombie = test.spawn("minecraft:zombie", { x: 1, y: 1, z: 2 });
    test.assert(zombie !== undefined, "Failed to spawn zombie in test");

    // 4. 仮想プレイヤーがモンスターを攻撃
    test.runAfterDelay(10, () => {
      bot.attackEntity(zombie);
      aiDebugLog("WaveHeroBot attacked zombie with Flame Sword!");
    });

    // 5. コイン付与＆所持金検証
    test.runAfterDelay(25, () => {
      givePlayerCoins(bot, 20);
      const coins = getPlayerCoins(bot);
      aiDebugLog(`WaveHeroBot coin balance: ${coins} C`);
      test.assert(coins >= 20, "Bot should have at least 20 coins");

      aiDebugLog("GameTest wave_bot_combat succeeded completely!");
      test.succeed();
    });
  })
  .maxTicks(100)
  .structureName("gametests:mediumglass");

// ============================================================================
// スクリプトイベントリスナー (/scriptevent)
// ============================================================================
system.afterEvents.scriptEventReceive.subscribe(
  (event) => {
    const waveManager = WaveManager.getInstance();
    const message = (event.message || "").trim();

    // 1. AIテスト名前空間
    if (event.id === "ai:test") {
      aiDebugLog(`Received scriptevent ai:test: "${message}"`);
      runAutonomousTests(message);
      return;
    }

    // 2. Wave操作名前空間
    if (event.id.startsWith("wave:")) {
      const subCommand = event.id.replace("wave:", "");
      aiDebugLog(`Received scriptevent ${event.id} with msg="${message}"`);

      system.run(() => {
        const initiator = event.sourceEntity instanceof Player ? event.sourceEntity : world.getAllPlayers()[0];

        switch (subCommand) {
          case "start":
            waveManager.startGame(initiator);
            break;
          case "stop":
            waveManager.stopGame();
            break;
          case "difficulty":
            if (message === "easy" || message === "normal" || message === "hard") {
              waveManager.setDifficulty(message);
            } else {
              world.sendMessage("§c使用法: /scriptevent wave:difficulty <easy|normal|hard>");
            }
            break;
          case "menu":
          case "shop":
            if (initiator) {
              openMainMenu(initiator);
            }
            break;
          case "give_coin": {
            const amount = parseInt(message, 10) || 10;
            if (initiator) {
              givePlayerCoins(initiator, amount);
              initiator.sendMessage(`§a[防衛戦] 防衛コイン x${amount} を付与しました。`);
            }
            break;
          }
          case "give_weapon": {
            const def = WEAPON_REGISTRY[message] || WEAPON_REGISTRY["flame_sword"];
            if (initiator && def) {
              const weapon = createWeaponItem(def, 1);
              const inv = initiator.getComponent("inventory") as any;
              if (inv && inv.container) {
                inv.container.addItem(weapon);
                initiator.sendMessage(`§a[防衛戦] ${def.name} を付与しました。`);
              }
            }
            break;
          }
          case "terminal": {
            if (initiator) {
              const terminal = createShopTerminalItem();
              const inv = initiator.getComponent("inventory") as any;
              if (inv && inv.container) {
                inv.container.addItem(terminal);
              }
            }
            break;
          }
        }
      });
    }
  },
  {
    namespaces: ["ai", "wave"],
  }
);
