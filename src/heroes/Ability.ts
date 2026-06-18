import type { Ability } from "../data/heroes";

// Runtime cooldown/charge tracking for one ability slot.
export class AbilityRuntime {
  readonly maxCharges: number;
  charges: number;
  private timer = 0; // seconds until one charge is restored

  constructor(readonly def: Ability) {
    this.maxCharges = def.charges ?? 1;
    this.charges = this.maxCharges;
  }

  get ready(): boolean {
    return this.charges > 0;
  }

  // 0..1 cooldown progress for the currently-recharging charge (HUD radial).
  get cooldownFrac(): number {
    if (this.charges >= this.maxCharges) return 0;
    return Math.max(0, this.timer) / this.def.cooldown;
  }

  get cdRemaining(): number {
    return this.charges >= this.maxCharges ? 0 : Math.max(0, this.timer);
  }

  update(dt: number): void {
    if (this.charges < this.maxCharges) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.charges++;
        if (this.charges < this.maxCharges) this.timer += this.def.cooldown;
      }
    }
  }

  use(): boolean {
    if (!this.ready) return false;
    const wasFull = this.charges === this.maxCharges;
    this.charges--;
    if (wasFull) this.timer = this.def.cooldown;
    return true;
  }

  reset(): void {
    this.charges = this.maxCharges;
    this.timer = 0;
  }
}
