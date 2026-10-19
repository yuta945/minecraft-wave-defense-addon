import {
  world,
  system,
  Player,
  Dimension,
  Vector3,
  Entity,
} from "@minecraft/server";
import { Difficulty, GameState } from "./types";
import { givePlayerCoins, createShopTerminalItem } from "./weapons";
import { aiDebugLog } from "./logger";

export class WaveManager {
  private static instance: WaveManager;

  public state: GameState = "idle";
  public difficulty: Difficulty = "normal";
  public currentWave: number = 0;
  public totalSpawnedInWave: number = 0;
  public arenaCenter: { dimension: Dimension; x: number; y: number; z: number } | null = null;

  private prepCountdown: number = 10;
  private tickIntervalHandle: number | null = null;

  private constructor() {
    this.initTicking();
  }

  public static getInstance(): WaveManager {
    if (!WaveManager.instance) {
      WaveManager.instance = new WaveManager();
    }
    return WaveManager.instance;
  }

  /**
   * 難易度別のモンスター出現数を計算
   */
  public calculateSpawnCount(wave: number, diff: Difficulty): number {
    switch (diff) {
      case "easy":
        // Base 5, +2 per wave
        return 5 + (wave - 1) * 2;
      case "normal":
        // Base 12, +3 per wave
        return 12 + (wave - 1) * 3;
      case "hard":
        // Base 25, +5 per wave
        return 25 + (wave - 1) * 5;
    }
  }

  /**
   * Waveに応じたモブの種類リストを取得
   */
  private getMobTypesForWave(wave: number): string[] {
    if (wave <= 2) {
      return ["minecraft:zombie"];
    } else if (wave <= 4) {
      return ["minecraft:zombie", "minecraft:spider"];
    } else if (wave <= 6) {
      return ["minecraft:zombie", "minecraft:skeleton", "minecraft:spider", "minecraft:husk"];
    } else {
      return [
        "minecraft:zombie",
        "minecraft:skeleton",
        "minecraft:spider",
        "minecraft:creeper",
        "minecraft:stray",
      ];
    }
  }

  /**
   * ゲーム開始
   */
  public startGame(hostPlayer?: Player): void {
    if (this.state !== "idle" && this.state !== "game_over") {
      if (hostPlayer) {
        hostPlayer.sendMessage("§c既に防衛ゲームは進行中です！");
      }
      return;
    }

    // アリーナ中心の決定
    if (hostPlayer) {
      this.arenaCenter = {
        dimension: hostPlayer.dimension,
        x: Math.floor(hostPlayer.location.x),
        y: Math.floor(hostPlayer.location.y),
        z: Math.floor(hostPlayer.location.z),
      };
    } else {
      const overworld = world.getDimension("overworld");
      this.arenaCenter = {
        dimension: overworld,
        x: 0,
        y: 65,
        z: 0,
      };
    }

    this.currentWave = 1;
    this.prepCountdown = 10;
    this.state = "preparing";

    aiDebugLog(`Wave Defense Started: Difficulty=${this.difficulty}, Wave=1`);
    world.sendMessage(`§6§l========================================`);
    world.sendMessage(`§e§l【モンスター防衛戦】が開始されました！`);
    world.sendMessage(`§f難易度: §a${this.difficulty.toUpperCase()} §7(基準出現数: ${this.calculateSpawnCount(1, this.difficulty)}体)`);
    world.sendMessage(`§bWave 1 出現まで: §e${this.prepCountdown} 秒`);
    world.sendMessage(`§6§l========================================`);

    // 全プレイヤーに端末アイテムを支給
    for (const p of world.getAllPlayers()) {
      try {
        const inv = p.getComponent("inventory") as any;
        if (inv && inv.container) {
          inv.container.addItem(createShopTerminalItem());
          p.sendMessage("§a[防衛戦] §fショップ・強化端末を受け取りました！右クリックで開けます。");
        }
      } catch {}
    }
  }

  /**
   * ゲーム停止・リセット
   */
  public stopGame(): void {
    this.state = "idle";
    this.clearAllWaveMobs();
    world.sendMessage("§c§l[防衛戦] ゲームが停止・リセットされました。");
    aiDebugLog("Wave Defense Stopped.");
  }

  /**
   * 難易度変更
   */
  public setDifficulty(diff: Difficulty): void {
    this.difficulty = diff;
    world.sendMessage(`§e[防衛戦] 難易度が §a${diff.toUpperCase()} §eに変更されました。`);
    aiDebugLog(`Difficulty set to ${diff}`);
  }

  /**
   * 残存Waveモンスターを全て消去
   */
  public clearAllWaveMobs(): void {
    if (!this.arenaCenter) return;
    try {
      const mobs = this.arenaCenter.dimension.getEntities({
        tags: ["wave_mob"],
      });
      for (const mob of mobs) {
        if (mob.isValid()) {
          mob.remove();
        }
      }
    } catch (err) {
      aiDebugLog(`Error clearing wave mobs: ${String(err)}`);
    }
  }

  /**
   * 現在生存しているWaveモンスターの数を取得
   */
  public getAliveMobCount(): number {
    if (!this.arenaCenter) return 0;
    try {
      const mobs = this.arenaCenter.dimension.getEntities({
        tags: ["wave_mob"],
      });
      return mobs.length;
    } catch {
      return 0;
    }
  }

  /**
   * Waveのモンスターをスポーン
   */
  public spawnWaveMobs(): void {
    if (!this.arenaCenter) return;

    const count = this.calculateSpawnCount(this.currentWave, this.difficulty);
    this.totalSpawnedInWave = count;
    const mobTypes = this.getMobTypesForWave(this.currentWave);
    const dim = this.arenaCenter.dimension;
    const cx = this.arenaCenter.x;
    const cy = this.arenaCenter.y;
    const cz = this.arenaCenter.z;

    aiDebugLog(`Spawning Wave ${this.currentWave}: Count=${count}, Types=${mobTypes.join(",")}`);

    world.sendMessage(`§c§l>>> WAVE ${this.currentWave} 襲撃開始！ (敵: ${count}体) <<<`);

    for (let i = 0; i < count; i++) {
      // 円形周囲（半径 12〜18ブロック）にランダム配置
      const angle = (i / count) * 2 * Math.PI + Math.random() * 0.5;
      const radius = 12 + Math.random() * 6;
      const spawnX = Math.round(cx + Math.cos(angle) * radius);
      const spawnZ = Math.round(cz + Math.sin(angle) * radius);
      const mobType = mobTypes[i % mobTypes.length];

      system.run(() => {
        try {
          const spawnLoc = { x: spawnX, y: cy, z: spawnZ };
          const entity = dim.spawnEntity(mobType, spawnLoc);
          entity.addTag("wave_mob");
          entity.addTag(`wave_${this.currentWave}`);

          // 出現エフェクト
          dim.spawnParticle("minecraft:portal_reverse_particle", {
            x: spawnX,
            y: cy + 1,
            z: spawnZ,
          });
        } catch (err) {
          aiDebugLog(`Failed to spawn mob ${mobType}: ${String(err)}`);
        }
      });
    }

    this.state = "active";
  }

  /**
   * Waveクリア時の処理
   */
  private onWaveClear(): void {
    const rewardCoins = 5 + this.currentWave * 2;
    aiDebugLog(`Wave ${this.currentWave} Cleared! Reward=${rewardCoins} coins`);

    world.sendMessage(`§a§l========================================`);
    world.sendMessage(`§a§l【WAVE ${this.currentWave} CLEAR!!】`);
    world.sendMessage(`§e報酬: 防衛コイン x${rewardCoins} を全防衛隊員に支給！`);
    world.sendMessage(`§6§l========================================`);

    // 全プレイヤーにコイン付与
    for (const player of world.getAllPlayers()) {
      try {
        givePlayerCoins(player, rewardCoins);
        player.onScreenDisplay.setTitle(`§a§lWAVE CLEAR!`, {
          stayDuration: 40,
          fadeInDuration: 10,
          fadeOutDuration: 10,
          subtitle: `§e+${rewardCoins} コイン獲得！ 次のWaveへ備えよう`,
        });
      } catch (err) {
        aiDebugLog(`Error giving reward to player: ${String(err)}`);
      }
    }

    // 次のWaveへの準備フェーズへ移行
    this.currentWave++;
    this.prepCountdown = 12;
    this.state = "preparing";
  }

  /**
   * 常駐ティッキング処理（毎秒チェック）
   */
  private initTicking(): void {
    this.tickIntervalHandle = system.runInterval(() => {
      if (this.state === "idle" || this.state === "game_over") return;

      const players = world.getAllPlayers();
      if (players.length === 0) return;

      if (this.state === "preparing") {
        this.prepCountdown--;
        const actionMsg = `§6§l[WAVE ${this.currentWave} 準備中] §e残り ${this.prepCountdown} 秒 §7| 難易度: §a${this.difficulty.toUpperCase()}`;
        for (const p of players) {
          try {
            p.onScreenDisplay.setActionBar(actionMsg);
          } catch {}
        }

        if (this.prepCountdown <= 0) {
          this.spawnWaveMobs();
        }
      } else if (this.state === "active") {
        const alive = this.getAliveMobCount();
        const actionMsg = `§c§l[WAVE ${this.currentWave}] §f残り敵: §e${alive} / ${this.totalSpawnedInWave}体 §7| 難易度: §a${this.difficulty.toUpperCase()}`;
        for (const p of players) {
          try {
            p.onScreenDisplay.setActionBar(actionMsg);
          } catch {}
        }

        if (alive === 0) {
          this.onWaveClear();
        }
      }
    }, 20); // 20 ticks = 1 second
  }
}
