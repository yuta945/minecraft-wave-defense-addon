import { ItemStack, Player, world, system, EntityInventoryComponent } from "@minecraft/server";
import { WeaponDef, UpgradeConfig } from "./types";

export const WEAPON_REGISTRY: Record<string, WeaponDef> = {
  flame_sword: {
    id: "flame_sword",
    name: "§c烈火の剣",
    baseItemType: "minecraft:iron_sword",
    cost: 10,
    baseDamage: 6,
    element: "fire",
    description: "§c攻撃時に敵を炎上させ、継続ダメージを与える。",
    particle: "minecraft:basic_flame_particle",
  },
  thunder_blade: {
    id: "thunder_blade",
    name: "§e雷霆の刃",
    baseItemType: "minecraft:golden_sword",
    cost: 25,
    baseDamage: 9,
    element: "thunder",
    description: "§e攻撃時に放電衝撃波を放ち、周囲の敵を巻き込む。",
    particle: "minecraft:electric_spark_particle",
  },
  frost_blade: {
    id: "frost_blade",
    name: "§b氷皇の剣",
    baseItemType: "minecraft:diamond_sword",
    cost: 50,
    baseDamage: 12,
    element: "frost",
    description: "§b敵に強力な鈍足と凍結追加ダメージを与える。",
    particle: "minecraft:snowflake_particle",
  },
};

export const UPGRADE_SETTINGS: UpgradeConfig = {
  maxLevel: 5,
  costs: [15, 30, 50, 80], // Lv.1->2, Lv.2->3, Lv.3->4, Lv.4->5
  damageBonusPerLevel: 3,
};

/**
 * 防衛コインの生成
 */
export function createCoinItem(amount: number = 1): ItemStack {
  const coin = new ItemStack("minecraft:gold_nugget", amount);
  coin.nameTag = "§6防衛コイン (Wave Token)";
  coin.setLore([
    "§7[防衛ミニゲーム専用通貨]",
    "§eWaveクリアや敵討伐で入手可能",
    "§fショップ端末で強力な武器や強化に使用",
  ]);
  return coin;
}

/**
 * ショップ端末アイテムの生成
 */
export function createShopTerminalItem(): ItemStack {
  const terminal = new ItemStack("minecraft:compass", 1);
  terminal.nameTag = "§6[防衛・強化端末]";
  terminal.setLore([
    "§7右クリック (スマホは画面長押し) で起動",
    "§e・武器のクラフト/購入",
    "§b・手持ち武器の強化 (Upgrade)",
    "§a・難易度設定 / ゲーム開始",
  ]);
  return terminal;
}

/**
 * 武器のItemStackを生成
 */
export function createWeaponItem(weaponDef: WeaponDef, level: number = 1): ItemStack {
  const item = new ItemStack(weaponDef.baseItemType, 1);
  item.nameTag = `${weaponDef.name} §e[Lv.${level}]`;
  const extraDmg = (level - 1) * UPGRADE_SETTINGS.damageBonusPerLevel;
  item.setLore([
    `§7ID: wave:${weaponDef.id}`,
    `§6装備レベル: §eLv.${level} / Lv.${UPGRADE_SETTINGS.maxLevel}`,
    `§c攻撃力: §f${weaponDef.baseDamage + extraDmg} §7(+${extraDmg})`,
    `§b属性: §f${weaponDef.element.toUpperCase()}`,
    weaponDef.description,
  ]);
  return item;
}

/**
 * プレイヤーのインベントリからコイン数を集計
 */
export function getPlayerCoins(player: Player): number {
  const invComp = player.getComponent("inventory") as EntityInventoryComponent | undefined;
  if (!invComp || !invComp.container) return 0;

  const container = invComp.container;
  let totalCoins = 0;

  for (let slot = 0; slot < container.size; slot++) {
    const item = container.getItem(slot);
    if (!item) continue;
    if (item.typeId === "minecraft:gold_nugget" && item.nameTag && item.nameTag.includes("防衛コイン")) {
      totalCoins += item.amount;
    }
  }
  return totalCoins;
}

/**
 * プレイヤーのインベントリからコインを消費
 */
export function deductPlayerCoins(player: Player, amount: number): boolean {
  const current = getPlayerCoins(player);
  if (current < amount) return false;

  const invComp = player.getComponent("inventory") as EntityInventoryComponent | undefined;
  if (!invComp || !invComp.container) return false;

  const container = invComp.container;
  let remainingToDeduct = amount;

  for (let slot = 0; slot < container.size; slot++) {
    const item = container.getItem(slot);
    if (!item) continue;
    if (item.typeId === "minecraft:gold_nugget" && item.nameTag && item.nameTag.includes("防衛コイン")) {
      if (item.amount <= remainingToDeduct) {
        remainingToDeduct -= item.amount;
        container.setItem(slot, undefined);
      } else {
        item.amount -= remainingToDeduct;
        container.setItem(slot, item);
        remainingToDeduct = 0;
      }
      if (remainingToDeduct <= 0) break;
    }
  }
  return true;
}

/**
 * プレイヤーにコインを付与
 */
export function givePlayerCoins(player: Player, amount: number): void {
  const invComp = player.getComponent("inventory") as EntityInventoryComponent | undefined;
  if (!invComp || !invComp.container) return;

  const container = invComp.container;
  let remaining = amount;

  while (remaining > 0) {
    const stackAmount = Math.min(remaining, 64);
    const coinStack = createCoinItem(stackAmount);
    try {
      container.addItem(coinStack);
    } catch {
      // インベントリが満杯の場合は足元にドロップ
      player.dimension.spawnItem(coinStack, player.location);
    }
    remaining -= stackAmount;
  }
}

/**
 * 手持ちアイテムからWave武器情報を抽出
 */
export function parseWeaponFromItem(item: ItemStack | undefined): { weaponDef: WeaponDef; level: number } | null {
  if (!item) return null;
  const lore = item.getLore();
  if (!lore || lore.length === 0) return null;

  const idLine = lore.find((l) => l.startsWith("§7ID: wave:"));
  if (!idLine) return null;

  const weaponId = idLine.replace("§7ID: wave:", "").trim();
  const weaponDef = WEAPON_REGISTRY[weaponId];
  if (!weaponDef) return null;

  let level = 1;
  const levelLine = lore.find((l) => l.includes("§6装備レベル:"));
  if (levelLine) {
    const match = levelLine.match(/Lv\.(\d+)/);
    if (match) {
      level = parseInt(match[1], 10);
    }
  }

  return { weaponDef, level };
}
