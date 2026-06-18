import { config } from "../data/config";

// Three-layer survivability: shield (regenerates), armor (flat reduction + pool),
// health. Damage drains shield -> armor -> health in that order.
export class Health {
  health: number;
  armor: number;
  shield: number; // includes temporary overshield
  baseShield: number;
  lastDamageTime = -999;

  constructor(
    readonly maxHealth: number,
    readonly maxArmor: number,
    baseShield: number,
  ) {
    this.health = maxHealth;
    this.armor = maxArmor;
    this.baseShield = baseShield;
    this.shield = baseShield;
  }

  get dead(): boolean {
    return this.health <= 0;
  }

  get total(): number {
    return this.health + this.armor + this.shield;
  }
  get totalMax(): number {
    return this.maxHealth + this.maxArmor + this.baseShield;
  }

  // Returns the amount actually removed across all pools (used for ult charge).
  takeDamage(raw: number, now: number): number {
    let dmg = raw;
    let removed = 0;

    if (this.shield > 0) {
      const a = Math.min(this.shield, dmg);
      this.shield -= a; dmg -= a; removed += a;
    }
    if (dmg > 0 && this.armor > 0) {
      const reduction = Math.min(config.combat.armorReductionPerHit, dmg * 0.5);
      dmg -= reduction;
      const a = Math.min(this.armor, dmg);
      this.armor -= a; dmg -= a; removed += a;
    }
    if (dmg > 0) {
      const a = Math.min(this.health, dmg);
      this.health -= a; removed += a;
    }
    this.lastDamageTime = now;
    return removed;
  }

  // Heals health only (not armor / shield). Returns amount healed.
  heal(amount: number): number {
    const before = this.health;
    this.health = Math.min(this.maxHealth, this.health + amount);
    return this.health - before;
  }

  addOvershield(amount: number): void {
    this.shield += amount;
  }
  clearOvershield(): void {
    this.shield = Math.min(this.shield, this.baseShield);
  }

  // Passive/base shield regen after a damage-free window.
  regen(now: number, dt: number): void {
    if (this.dead) return;
    if (this.baseShield > 0 && this.shield < this.baseShield &&
        now - this.lastDamageTime >= config.combat.shieldRegenDelay) {
      this.shield = Math.min(this.baseShield, this.shield + config.combat.shieldRegenRate * dt);
    }
  }

  reset(): void {
    this.health = this.maxHealth;
    this.armor = this.maxArmor;
    this.shield = this.baseShield;
    this.lastDamageTime = -999;
  }
}
