export type Difficulty = "easy" | "normal" | "hard";

export type GameState = "idle" | "preparing" | "active" | "game_over";

export interface WeaponDef {
  id: string;
  name: string;
  baseItemType: string;
  cost: number;
  baseDamage: number;
  element: "fire" | "thunder" | "frost";
  description: string;
  particle: string;
}

export interface UpgradeConfig {
  maxLevel: number;
  costs: number[]; // Index corresponds to current level (0 -> lv1 to lv2, etc.)
  damageBonusPerLevel: number;
}
