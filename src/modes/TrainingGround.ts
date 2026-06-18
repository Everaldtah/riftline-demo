import * as THREE from "three";
import { GameMode, type MatchAPI } from "./GameMode";
import type { Hero } from "../heroes/Hero";
import type { Bot } from "../bots/Bot";

interface Mover { hero: Hero; a: THREE.Vector3; b: THREE.Vector3; speed: number; t: number; dir: number; }

// Solo sandbox: target dummies, distance lanes, toggles, and live readouts.
export class TrainingGround extends GameMode {
  readonly id = "training";
  readonly label = "Training Ground";
  readonly environmentId = "training" as const;

  flags = { infiniteAmmo: true, noCooldown: false, fightBack: false };

  private dummies: Hero[] = [];
  private movers: Mover[] = [];
  private deadTimers = new Map<Hero, number>();
  private fightBot: Bot | null = null;
  private allyDummy: Hero | null = null;

  // live readouts
  dps = 0;
  hps = 0;
  private lastDamage = 0;
  private lastHealing = 0;

  setup(api: MatchAPI): void {
    for (const spot of api.env.dummySpots) {
      const d = api.spawnDummy(spot.pos, spot.path);
      this.dummies.push(d);
      if (spot.path) {
        this.movers.push({ hero: d, a: spot.path.a.clone(), b: spot.path.b.clone(), speed: spot.path.speed, t: 0, dir: 1 });
      }
    }
    // a friendly dummy so healers can test (sits at reduced health)
    this.allyDummy = api.spawnDummy(new THREE.Vector3(3, 1, 8));
    this.allyDummy.team = api.player.team;
    this.lastDamage = api.player.damageDealt;
    this.lastHealing = api.player.healingDone;
  }

  update(api: MatchAPI, dt: number): void {
    const p = api.player;

    // toggles
    if (this.flags.infiniteAmmo) { p.ammo = p.data.primary.ammo; p.reloadTimer = 0; }
    if (this.flags.noCooldown) {
      p.ability1.reset(); p.ability2.reset();
      p.ultCharge = Math.max(p.ultCharge, 1500);
    }

    // fight-back bot
    if (this.flags.fightBack && !this.fightBot) {
      this.fightBot = api.addBot("vex", api.isFFA ? 99 : 1);
      this.fightBot.hero.team = this.dummies[0]?.team ?? 1;
    } else if (!this.flags.fightBack && this.fightBot) {
      api.removeBot(this.fightBot);
      this.fightBot = null;
    }

    // moving dummies
    for (const m of this.movers) {
      if (!m.hero.alive) continue;
      m.t += (m.speed / m.a.distanceTo(m.b)) * dt * m.dir;
      if (m.t >= 1) { m.t = 1; m.dir = -1; }
      if (m.t <= 0) { m.t = 0; m.dir = 1; }
      m.hero.pos.lerpVectors(m.a, m.b, m.t);
    }

    // keep ally dummy slightly hurt so healing is observable
    if (this.allyDummy && this.allyDummy.alive) {
      if (this.allyDummy.health.health > this.allyDummy.health.maxHealth * 0.5) {
        this.allyDummy.health.health -= 8 * dt;
      }
    }

    // dummy respawn
    for (const d of this.dummies) {
      if (!d.alive) {
        const t = (this.deadTimers.get(d) ?? 1.5) - dt;
        if (t <= 0) { api.respawn(d, d.team); this.deadTimers.delete(d); }
        else this.deadTimers.set(d, t);
      }
    }

    // readouts (smoothed)
    const dDmg = (p.damageDealt - this.lastDamage) / dt;
    const dHeal = (p.healingDone - this.lastHealing) / dt;
    this.lastDamage = p.damageDealt;
    this.lastHealing = p.healingDone;
    this.dps += (dDmg - this.dps) * Math.min(1, dt * 4);
    this.hps += (dHeal - this.hps) * Math.min(1, dt * 4);
  }

  objectiveText(): string {
    return "TRAINING GROUND — free practice. Toggles below • Esc for menu";
  }
  scoreText(api: MatchAPI): string {
    return `DMG ${Math.round(api.player.damageDealt)} · DPS ${Math.round(this.dps)} · HPS ${Math.round(this.hps)}`;
  }
}
