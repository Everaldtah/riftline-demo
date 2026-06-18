import * as THREE from "three";
import { config, botLerp } from "../data/config";
import type { Hero, Intent } from "../heroes/Hero";
import { emptyIntent } from "../heroes/Hero";
import type { World } from "../engine/World";

type State = "idle" | "seek" | "attack" | "retreat";

const _dir = new THREE.Vector3();
const _fwd = new THREE.Vector3();

// Simple, beatable combat AI: idle -> seek -> attack -> retreat.
export class BotAI {
  private state: State = "idle";
  private target: Hero | null = null;
  private reactTimer = 0;
  private decisionTimer = 0;
  private wanderYaw = Math.random() * Math.PI * 2;
  private abilityCheck = 0;

  constructor(private hero: Hero) {}

  update(world: World, dt: number): Intent {
    const intent = emptyIntent();
    const hero = this.hero;
    if (!hero.alive || hero.isStunned) return intent;

    this.acquireTarget(world, dt);
    const hpFrac = hero.health.total / hero.health.totalMax;
    if (hpFrac < config.bots.retreatHealthFrac && this.target) this.state = "retreat";

    const aimError = botLerp(config.bots.aimError.easy, config.bots.aimError.hard);

    if (this.target && this.target.alive) {
      const toTarget = _dir.copy(this.target.eye).sub(hero.eye);
      const dist = toTarget.length();
      const hasLOS = world.physics.lineOfSight(hero.eye, this.target.eye);

      // aim toward target with error, smoothly
      this.aimAt(this.target, aimError, dt);

      if (this.state !== "retreat") {
        this.state = hasLOS && dist < this.weaponRange() ? "attack" : "seek";
      }

      const moveDir = _fwd.set(0, 0, 0);
      if (this.state === "retreat") {
        moveDir.copy(hero.pos).sub(this.target.pos).setY(0).normalize();
      } else if (this.state === "seek") {
        moveDir.copy(this.target.pos).sub(hero.pos).setY(0).normalize();
      } else {
        // attack: strafe a little to feel alive, keep mid-range for ranged
        const strafe = Math.sin(world.time() * 2 + this.wanderYaw) > 0 ? 1 : -1;
        const toT = _dir.copy(this.target.pos).sub(hero.pos).setY(0).normalize();
        moveDir.set(-toT.z * strafe, 0, toT.x * strafe);
        if (dist > this.weaponRange() * 0.7) moveDir.add(toT);
        moveDir.normalize();
      }
      this.avoid(world, moveDir);
      this.toLocal(moveDir, intent);

      // fire when ready, aimed, in range, after reaction delay
      this.reactTimer -= dt;
      const aimed = hero.aimDir().dot(_dir.copy(this.target.eye).sub(hero.eye).normalize()) > 0.96;
      if (this.state === "attack" && this.reactTimer <= 0 && aimed && !hero.isBlinded) {
        if (hero.data.primary.healing) intent.fireSecondary = true; // menders use damage beam vs enemies
        else intent.firePrimary = true;
      }

      // occasional ability / ult use
      this.abilityCheck -= dt;
      if (this.abilityCheck <= 0) {
        this.abilityCheck = 0.8;
        if (hero.ultReady && hasLOS) intent.ult = true;
        else if (hero.ability1.ready && Math.random() < 0.4) intent.ability1 = true;
        else if (hero.ability2.ready && Math.random() < 0.4) intent.ability2 = true;
      }

      // jump occasionally while seeking to clear small steps
      if (this.state === "seek" && Math.random() < 0.01) intent.jump = true;
    } else {
      // idle wander
      this.state = "idle";
      this.decisionTimer -= dt;
      if (this.decisionTimer <= 0) {
        this.decisionTimer = 1.5 + Math.random() * 2;
        this.wanderYaw = Math.random() * Math.PI * 2;
      }
      hero.yaw += (this.wanderYaw - hero.yaw) * Math.min(1, dt * 2);
      _fwd.set(-Math.sin(hero.yaw), 0, -Math.cos(hero.yaw));
      this.avoid(world, _fwd);
      this.toLocal(_fwd, intent);
      intent.wishZ *= 0.5; // slow wander
    }
    return intent;
  }

  private acquireTarget(world: World, dt: number): void {
    const hero = this.hero;
    if (this.target && (!this.target.alive ||
        this.target.eye.distanceTo(hero.eye) > config.bots.sightRange * 1.3)) {
      this.target = null;
    }
    if (!this.target) {
      let best: Hero | null = null; let bestD: number = config.bots.sightRange;
      for (const e of world.enemiesOf(hero.team)) {
        if (!e.alive) continue;
        const d = e.eye.distanceTo(hero.eye);
        if (d < bestD && world.physics.lineOfSight(hero.eye, e.eye)) { best = e; bestD = d; }
      }
      if (best) { this.target = best; this.reactTimer = botLerp(config.bots.reactionTime.easy, config.bots.reactionTime.hard); }
    }
    void dt;
  }

  private weaponRange(): number {
    const w = this.hero.data.primary;
    return w.kind === "beam" ? (w.range ?? 25) : Math.min(w.range ?? 60, 45);
  }

  private aimAt(target: Hero, error: number, dt: number): void {
    const hero = this.hero;
    const dir = _dir.copy(target.eye).sub(hero.eye).normalize();
    const wantYaw = Math.atan2(-dir.x, -dir.z) + (Math.random() - 0.5) * error;
    const wantPitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)) + (Math.random() - 0.5) * error;
    const turn = (3 + botLerp(0, 6)) * dt;
    let dy = wantYaw - hero.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    hero.yaw += THREE.MathUtils.clamp(dy, -turn, turn);
    hero.pitch += THREE.MathUtils.clamp(wantPitch - hero.pitch, -turn, turn);
  }

  private avoid(world: World, moveDir: THREE.Vector3): void {
    if (moveDir.lengthSq() < 0.01) return;
    const ahead = world.physics.raycast(this.hero.eye, moveDir, 2.0);
    if (ahead) {
      // steer sideways
      moveDir.set(-moveDir.z, 0, moveDir.x).normalize();
    }
  }

  private toLocal(worldDir: THREE.Vector3, intent: Intent): void {
    const yaw = this.hero.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const rx = -fz, rz = fx;
    intent.wishZ = worldDir.x * fx + worldDir.z * fz;
    intent.wishX = worldDir.x * rx + worldDir.z * rz;
  }
}
