import { world, system, Player, Entity, EntityDamageCause, EntityEquippableComponent, EquipmentSlot } from "@minecraft/server";
import { parseWeaponFromItem } from "./weapons";
import { aiDebugLog } from "./logger";

export function initWeaponEffects(): void {
  world.afterEvents.entityHitEntity.subscribe((event) => {
    const attacker = event.damagingEntity;
    const target = event.hitEntity;

    if (!(attacker instanceof Player)) return;
    if (!target.isValid()) return;

    // プレイヤーが手に持っているアイテムを取得
    const equippable = attacker.getComponent("equippable") as EntityEquippableComponent | undefined;
    const mainhand = equippable ? equippable.getEquipment(EquipmentSlot.Mainhand) : undefined;
    const weaponInfo = parseWeaponFromItem(mainhand);

    if (!weaponInfo) return;

    const { weaponDef, level } = weaponInfo;
    const dim = target.dimension;
    const loc = target.location;

    system.run(() => {
      try {
        if (!target.isValid()) return;

        // 1. 属性パーティクル
        dim.spawnParticle(weaponDef.particle, {
          x: loc.x,
          y: loc.y + 1,
          z: loc.z,
        });

        // 2. 属性効果分岐
        if (weaponDef.element === "fire") {
          // 烈火の剣: 火炎付与 (4秒 + レベルごとに2秒)
          const fireDuration = 4 + level * 2;
          target.setOnFire(fireDuration, true);

          // 追加の炎上爆発エフェクト
          dim.spawnParticle("minecraft:lava_particle", {
            x: loc.x,
            y: loc.y + 0.5,
            z: loc.z,
          });
        } else if (weaponDef.element === "thunder") {
          // 雷霆の刃: 放電衝撃波 (周囲4ブロックのwave_mobへ連鎖ダメージ)
          const nearbyMobs = dim.getEntities({
            location: loc,
            maxDistance: 4 + level,
            tags: ["wave_mob"],
          });

          for (const mob of nearbyMobs) {
            if (mob.id !== target.id && mob.isValid()) {
              mob.applyDamage(3 + level * 2, {
                damagingEntity: attacker,
                cause: EntityDamageCause.magic,
              });
              dim.spawnParticle("minecraft:electric_spark_particle", {
                x: mob.location.x,
                y: mob.location.y + 1,
                z: mob.location.z,
              });
            }
          }
        } else if (weaponDef.element === "frost") {
          // 氷皇の剣: 鈍足・衰弱付与 (5秒)
          const durationTicks = 20 * (5 + level);
          target.addEffect("slowness", durationTicks, {
            amplifier: Math.min(3, level),
            showParticles: true,
          });
          target.addEffect("weakness", durationTicks, {
            amplifier: 1,
            showParticles: true,
          });

          // 氷結ダメージ
          target.applyDamage(2 + level * 2, {
            damagingEntity: attacker,
            cause: EntityDamageCause.freezing,
          });
        }
      } catch (err) {
        aiDebugLog(`Weapon effect error: ${String(err)}`);
      }
    });
  });
}
