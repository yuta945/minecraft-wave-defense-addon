import { Player, world, system, EquipmentSlot, EntityEquippableComponent } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import {
  WEAPON_REGISTRY,
  UPGRADE_SETTINGS,
  getPlayerCoins,
  deductPlayerCoins,
  createWeaponItem,
  parseWeaponFromItem,
} from "./weapons";
import { WaveManager } from "./waveManager";
import { aiDebugLog } from "./logger";

/**
 * メインメニュー画面
 */
export function openMainMenu(player: Player): void {
  const waveManager = WaveManager.getInstance();
  const coins = getPlayerCoins(player);
  const statusStr =
    waveManager.state === "idle"
      ? "§7待機中"
      : waveManager.state === "preparing"
      ? `§eWave ${waveManager.currentWave} 準備中`
      : `§cWave ${waveManager.currentWave} 進行中`;

  const form = new ActionFormData()
    .title("§6【防衛＆武器強化端末】")
    .body(
      `§f所持防衛コイン: §e${coins} C\n` +
      `§f現在の難易度: §a${waveManager.difficulty.toUpperCase()}\n` +
      `§fゲーム状態: ${statusStr}\n\n` +
      `§7操作を選択してください：`
    )
    .button("§6⚔ 武器ショップ (購入)\n§7コインで特殊武器を購入", "textures/items/red_flame_sword")
    .button("§b✨ 手持ち武器の強化 (Upgrade)\n§7手持ちのWave武器をLvアップ", "textures/items/thunder_blade")
    .button(
      waveManager.state === "idle"
        ? "§a▶ 防衛ゲーム開始\n§7Waveモンスター襲撃を開始"
        : "§c⏹ 防衛ゲーム停止\n§7現在の防衛戦をリセット",
      "textures/items/compass"
    )
    .button("§e⚙ 難易度設定\n§7Easy / Normal / Hard", "textures/ui/settings_glyph_color_2x");

  form.show(player).then((res) => {
    if (res.canceled) return;

    switch (res.selection) {
      case 0:
        openWeaponShop(player);
        break;
      case 1:
        openUpgradeShop(player);
        break;
      case 2:
        if (waveManager.state === "idle") {
          waveManager.startGame(player);
        } else {
          waveManager.stopGame();
        }
        break;
      case 3:
        openDifficultyMenu(player);
        break;
    }
  }).catch((err) => {
    aiDebugLog(`Form display error: ${String(err)}`);
  });
}

/**
 * 武器購入メニュー
 */
export function openWeaponShop(player: Player): void {
  const coins = getPlayerCoins(player);
  const weapons = Object.values(WEAPON_REGISTRY);

  const form = new ActionFormData()
    .title("§6【武器クラフト＆購入ショップ】")
    .body(`§f所持防衛コイン: §e${coins} C\n§7購入したい武器を選択してください：`);

  for (const w of weapons) {
    const canAfford = coins >= w.cost ? "§a" : "§c";
    form.button(
      `${w.name} ${canAfford}[${w.cost}C]\n§8攻:${w.baseDamage} | ${w.element.toUpperCase()}`,
      `textures/items/${w.id}`
    );
  }
  form.button("§7« 戻る", "textures/ui/arrow_left");

  form.show(player).then((res) => {
    if (res.canceled) return;
    if (res.selection === weapons.length) {
      // 戻る
      openMainMenu(player);
      return;
    }

    const selectedWeapon = weapons[res.selection!];
    if (!selectedWeapon) return;

    if (coins < selectedWeapon.cost) {
      player.sendMessage(`§c防衛コインが不足しています！ (必要: ${selectedWeapon.cost}C / 所持: ${coins}C)`);
      return;
    }

    // コイン消費 & アイテム付与
    if (deductPlayerCoins(player, selectedWeapon.cost)) {
      const weaponItem = createWeaponItem(selectedWeapon, 1);
      const inv = player.getComponent("inventory") as any;
      if (inv && inv.container) {
        inv.container.addItem(weaponItem);
      }
      player.sendMessage(`§a${selectedWeapon.name} §aを購入しました！ (-${selectedWeapon.cost}C)`);
      aiDebugLog(`Player ${player.name} bought ${selectedWeapon.name}`);
    }
  });
}

/**
 * 手持ち武器の強化（アップグレード）メニュー
 */
export function openUpgradeShop(player: Player): void {
  const equippable = player.getComponent("equippable") as EntityEquippableComponent | undefined;
  const mainhand = equippable ? equippable.getEquipment(EquipmentSlot.Mainhand) : undefined;
  const weaponInfo = parseWeaponFromItem(mainhand);

  if (!weaponInfo) {
    const form = new ActionFormData()
      .title("§b【武器強化 (Upgrade)】")
      .body(
        "§c強化したいWave武器（烈火の剣 / 雷霆の刃 / 氷皇の剣）をメインハンド（手）に持った状態で再度メニューを開いてください。"
      )
      .button("§7« 戻る", "textures/ui/arrow_left");
    form.show(player).then(() => openMainMenu(player));
    return;
  }

  const { weaponDef, level } = weaponInfo;
  const coins = getPlayerCoins(player);

  if (level >= UPGRADE_SETTINGS.maxLevel) {
    const form = new ActionFormData()
      .title("§b【武器強化 (Upgrade)】")
      .body(`§aこの武器は既に最大レベル [Lv.${level}] に到達しています！`)
      .button("§7« 戻る", "textures/ui/arrow_left");
    form.show(player).then(() => openMainMenu(player));
    return;
  }

  const upgradeCost = UPGRADE_SETTINGS.costs[level - 1];
  const nextLevel = level + 1;
  const nextDmg = weaponDef.baseDamage + (nextLevel - 1) * UPGRADE_SETTINGS.damageBonusPerLevel;

  const form = new ActionFormData()
    .title("§b【武器強化 (Upgrade)】")
    .body(
      `§f対象武器: ${weaponDef.name}\n` +
      `§f現在のレベル: §eLv.${level}\n` +
      `§f次のレベル: §aLv.${nextLevel} §7(攻撃力: ${nextDmg})\n` +
      `§f強化費用: §e${upgradeCost} 防衛コイン\n` +
      `§f所持コイン: §e${coins} C\n\n` +
      (coins >= upgradeCost ? "§a強化可能です！" : "§cコインが不足しています。")
    )
    .button(
      coins >= upgradeCost
        ? `§a✨ Lv.${nextLevel} に強化する [${upgradeCost}C]`
        : `§c❌ コイン不足 [${upgradeCost}C]`,
      "textures/ui/anvil_icon"
    )
    .button("§7« 戻る", "textures/ui/arrow_left");

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 1) {
      openMainMenu(player);
      return;
    }

    if (coins < upgradeCost) {
      player.sendMessage(`§c強化に必要なコインが不足しています！ (${upgradeCost}C 必要)`);
      return;
    }

    if (deductPlayerCoins(player, upgradeCost)) {
      const upgradedItem = createWeaponItem(weaponDef, nextLevel);
      if (equippable) {
        equippable.setEquipment(EquipmentSlot.Mainhand, upgradedItem);
      }
      player.sendMessage(`§a✨ 強化成功！ ${weaponDef.name} が §e[Lv.${nextLevel}] §aになりました！ (-${upgradeCost}C)`);
      aiDebugLog(`Player ${player.name} upgraded ${weaponDef.name} to Lv.${nextLevel}`);
    }
  });
}

/**
 * 難易度変更メニュー
 */
export function openDifficultyMenu(player: Player): void {
  const waveManager = WaveManager.getInstance();

  const form = new ActionFormData()
    .title("§e【難易度設定】")
    .body("§f難易度を選択してください（敵の出現量が変わります）：")
    .button(
      `§aEasy (初級)\n§7基準出現数: 5体〜 ${waveManager.difficulty === "easy" ? "§e[選択中]" : ""}`,
      "textures/ui/confirm"
    )
    .button(
      `§6Normal (標準)\n§7基準出現数: 12体〜 ${waveManager.difficulty === "normal" ? "§e[選択中]" : ""}`,
      "textures/ui/confirm"
    )
    .button(
      `§cHard (上級)\n§7基準出現数: 25体〜 ${waveManager.difficulty === "hard" ? "§e[選択中]" : ""}`,
      "textures/ui/confirm"
    )
    .button("§7« 戻る", "textures/ui/arrow_left");

  form.show(player).then((res) => {
    if (res.canceled || res.selection === 3) {
      openMainMenu(player);
      return;
    }

    if (res.selection === 0) waveManager.setDifficulty("easy");
    if (res.selection === 1) waveManager.setDifficulty("normal");
    if (res.selection === 2) waveManager.setDifficulty("hard");

    openMainMenu(player);
  });
}
