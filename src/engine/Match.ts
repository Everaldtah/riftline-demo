import * as THREE from "three";
import { config } from "../data/config";
import { Physics } from "./Physics";
import type { World, Team, ProjectileSpec, DamageKind } from "./World";
import type { GameMode, MatchAPI, MatchResult } from "../modes/GameMode";
import type { Environment } from "../environments/Environment";
import type { Hero, Intent } from "../heroes/Hero";
import { emptyIntent } from "../heroes/Hero";
import { createHero } from "../heroes/HeroFactory";
import { Bot } from "../bots/Bot";
import { PlayerController, applyLocomotion } from "../player/PlayerController";
import { CombatSystem } from "../combat/CombatSystem";
import { AbilitySystem, setColliderSink } from "../heroes/AbilitySystem";
import { DamageNumbers } from "../combat/DamageNumbers";
import type { HUD } from "../ui/HUD";
import type { Input } from "./Input";
import { TrainingGround } from "../modes/TrainingGround";

const TRAINING_LABELS: Record<string, string> = {
  infiniteAmmo: "Infinite Ammo",
  noCooldown: "No Cooldown",
  fightBack: "Fight Back",
};

interface Particle {
  mesh: THREE.Mesh;
  life: number;
  max: number;
  grow: number;
}

// Owns one match: the player, bots, dummies, combat/ability systems, the
// environment + physics, and the game mode. Implements both the engine `World`
// (what gameplay systems call into) and the `MatchAPI` (what the mode calls to
// spawn/respawn/end). Driven one fixed step at a time by Game.
export class Match implements World, MatchAPI {
  // World / MatchAPI shared state (readonly views)
  readonly scene: THREE.Scene;
  readonly physics: Physics;
  readonly env: Environment;
  readonly player: Hero;
  readonly isFFA: boolean;
  readonly bots: Bot[] = [];

  private readonly mode: GameMode;
  private readonly hud: HUD;
  private readonly input: Input;
  private readonly onEnd: (r: MatchResult) => void;

  private actorList: Hero[] = [];
  private dummies = new Set<Hero>();
  private readonly controller: PlayerController;
  private readonly combat: CombatSystem;
  private readonly abilities: AbilitySystem;
  private readonly damageNumbers: DamageNumbers;
  private particles: Particle[] = [];

  private simTime = 0;
  private ended = false;

  constructor(
    scene: THREE.Scene,
    physics: Physics,
    env: Environment,
    mode: GameMode,
    heroId: string,
    hud: HUD,
    input: Input,
    onEnd: (r: MatchResult) => void,
  ) {
    this.scene = scene;
    this.physics = physics;
    this.env = env;
    this.mode = mode;
    this.hud = hud;
    this.input = input;
    this.onEnd = onEnd;
    this.isFFA = mode.id === "dm";

    // Wire deployable/wall/smoke colliders back into this match's Physics.
    setColliderSink((box) => this.addTempCollider(box));

    this.combat = new CombatSystem(scene);
    this.abilities = new AbilitySystem(scene);
    this.damageNumbers = new DamageNumbers(scene);

    // Local player (team 0). Its body is hidden in first-person but still lives
    // in the scene so shadows/effects resolve.
    this.player = createHero(heroId, 0, true);
    this.player.respawnAt(env.spawnFor(0, this.isFFA));
    scene.add(this.player.group);
    this.actorList.push(this.player);

    this.controller = new PlayerController(this.player);

    // Let the mode populate the world (bots / dummies / capture state).
    mode.setup(this);

    if (mode instanceof TrainingGround) {
      const flags = mode.flags;
      this.hud.buildTrainingPanel(flags, TRAINING_LABELS, (k) => {
        if (k === "infiniteAmmo" || k === "noCooldown" || k === "fightBack") flags[k] = !flags[k];
      });
    }
  }

  // ---- World views ---------------------------------------------------------

  get actors(): readonly Hero[] {
    return this.actorList;
  }
  time(): number {
    return this.simTime;
  }

  enemiesOf(team: Team): Hero[] {
    return this.actorList.filter((a) => a.team !== team);
  }
  alliesOf(hero: Hero): Hero[] {
    return this.actorList.filter((a) => a.team === hero.team && a !== hero);
  }

  // ---- World: spawning & feedback -----------------------------------------

  spawnProjectile(spec: ProjectileSpec): void {
    this.combat.spawnProjectile(spec);
  }

  damageNumber(pos: THREE.Vector3, amount: number, kind: DamageKind): void {
    this.damageNumbers.spawn(pos, amount, kind);
  }

  spawnEffect(pos: THREE.Vector3, color: number, kind: "hit" | "death" | "ability"): void {
    const size = kind === "death" ? 0.7 : kind === "ability" ? 0.5 : 0.3;
    const dur = kind === "death" ? 0.5 : kind === "ability" ? 0.35 : 0.22;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 8, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    );
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.particles.push({ mesh, life: dur, max: dur, grow: kind === "hit" ? 1.2 : 2.4 });
  }

  addTempCollider(box: THREE.Box3): { remove(): void } {
    this.physics.colliders.push(box);
    return {
      remove: () => {
        const i = this.physics.colliders.indexOf(box);
        if (i >= 0) this.physics.colliders.splice(i, 1);
      },
    };
  }

  notifyHitmarker(killed: boolean): void {
    this.hud.flashHitmarker(killed);
  }

  // ---- World: damage application ------------------------------------------
  // amount > 0 (normal/head) => DAMAGE. amount < 0 or kind "heal" => HEAL CREDIT
  // ONLY (the caller already applied Health.heal()). Returns the charge-worthy
  // amount (damage removed, or healing credited).
  dealDamage(source: Hero, target: Hero, amount: number, kind: DamageKind): number {
    if (amount < 0 || kind === "heal") {
      const healed = -amount;
      source.healingDone += healed;
      const mult = source.data.passive.id === "healingUltBonus" ? source.data.passive.params.mult : 1;
      source.addUlt(healed * mult);
      return healed;
    }

    const scaled = amount * target.incomingDamageScale(this.simTime);
    const removed = target.health.takeDamage(scaled, this.simTime);
    source.damageDealt += removed;
    source.addUlt(removed);
    if (removed > 0) this.damageNumbers.spawn(target.eye, removed, kind);

    if (target.alive && target.health.dead) this.kill(source, target);
    return removed;
  }

  private kill(source: Hero, target: Hero): void {
    target.alive = false;
    target.group.visible = false;
    target.deaths++;
    if (source !== target) source.kills++;
    this.hud.pushKill(`${source.data.name} ▸ ${target.data.name}`);
    this.spawnEffect(target.eye, target.data.accent, "death");
    // Auto-respawn only the player and bots; dummies are mode-managed.
    if (!this.dummies.has(target)) {
      target.respawnTimer = config.combat.respawnTime;
    }
  }

  // ---- MatchAPI -----------------------------------------------------------

  get world(): World {
    return this;
  }

  spawnDummy(pos: THREE.Vector3, _path?: { a: THREE.Vector3; b: THREE.Vector3; speed: number }): Hero {
    const d = createHero("bulwark", 1, false);
    d.respawnAt(pos);
    this.scene.add(d.group);
    this.actorList.push(d);
    this.dummies.add(d);
    return d;
  }

  addBot(heroId: string, team: number): Bot {
    const hero = createHero(heroId, team, false);
    hero.respawnAt(this.env.spawnFor(team, this.isFFA));
    this.scene.add(hero.group);
    this.actorList.push(hero);
    const bot = new Bot(hero);
    this.bots.push(bot);
    return bot;
  }

  removeBot(bot: Bot): void {
    const bi = this.bots.indexOf(bot);
    if (bi >= 0) this.bots.splice(bi, 1);
    const ai = this.actorList.indexOf(bot.hero);
    if (ai >= 0) this.actorList.splice(ai, 1);
    this.scene.remove(bot.hero.group);
  }

  respawn(hero: Hero, team?: number): void {
    hero.respawnAt(this.env.spawnFor(team ?? hero.team, this.isFFA));
  }

  end(result: MatchResult): void {
    if (this.ended) return;
    this.ended = true;
    this.onEnd(result);
  }

  // ---- simulation ---------------------------------------------------------

  // Advance one fixed step. Order matters — see the project handoff.
  step(dt: number): void {
    if (this.ended) return;
    this.simTime += dt;

    // 1. Build intents + integrate each actor.
    this.stepActor(this.player, this.controller.buildIntent(this.input), dt);
    for (const bot of this.bots) this.stepActor(bot.hero, bot.think(this, dt), dt);
    const empty = emptyIntent();
    for (const d of this.dummies) this.stepActor(d, empty, dt);

    // 2. World-level simulation.
    this.combat.updateProjectiles(this, dt);
    this.abilities.updateEffects(this, dt);
    this.mode.update(this, dt);

    // 3. Death/respawn timers (auto-respawn player + bots only).
    this.handleRespawns(dt);

    // 4. Visual sync.
    for (const a of this.actorList) a.syncMesh();
    this.damageNumbers.update(dt);
    this.updateParticles(dt);

    // 5. HUD.
    this.hud.update(
      this.player,
      this.mode.objectiveText(this),
      this.mode.scoreText(this),
      dt,
    );
  }

  private stepActor(hero: Hero, intent: Intent, dt: number): void {
    if (hero.alive) applyLocomotion(hero, this.physics, intent, dt);
    this.combat.updateWeapon(hero, this, intent, dt);
    this.abilities.update(hero, this, intent, dt);
    hero.updateState(this.simTime, dt);
  }

  private handleRespawns(dt: number): void {
    for (const h of this.actorList) {
      if (h.alive || this.dummies.has(h)) continue;
      h.respawnTimer -= dt;
      if (h === this.player) this.hud.setRespawn(Math.max(0, h.respawnTimer));
      if (h.respawnTimer <= 0) {
        h.respawnAt(this.env.spawnFor(h.team, this.isFFA));
        if (h === this.player) this.hud.setRespawn(null);
      }
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      const k = Math.max(0, p.life / p.max);
      p.mesh.scale.setScalar(1 + (1 - k) * p.grow);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = k * 0.9;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  // ---- render-frame hooks (called by Game once per rAF) -------------------

  get camera(): THREE.PerspectiveCamera {
    return this.controller.camera.camera;
  }

  syncView(): void {
    this.controller.syncCamera();
  }

  postFrame(input: Input): void {
    if (input.down(config.keys.scoreboard)) this.hud.showScoreboard(this.scoreRows());
    else this.hud.showScoreboard(null);
  }

  private scoreRows(): { name: string; kills: number; deaths: number; team: number }[] {
    return [
      {
        name: `${this.player.data.name} (you)`,
        kills: this.player.kills,
        deaths: this.player.deaths,
        team: this.player.team,
      },
      ...this.bots.map((b) => ({
        name: b.hero.data.name,
        kills: b.hero.kills,
        deaths: b.hero.deaths,
        team: b.hero.team,
      })),
    ];
  }

  dispose(): void {
    this.abilities.reset();
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
    this.particles.length = 0;
    this.hud.clearTrainingPanel();
  }
}
