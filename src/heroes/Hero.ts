import * as THREE from "three";
import type { HeroData } from "../data/heroes";
import { config } from "../data/config";
import { Health } from "../combat/Health";
import { AbilityRuntime } from "./Ability";
import type { Team } from "../engine/World";

// Per-frame intent produced by the player (input) or a bot (AI).
export interface Intent {
  wishX: number; // local strafe -1..1
  wishZ: number; // local forward -1..1 (forward = -Z in view space convention)
  jump: boolean;
  firePrimary: boolean; // held
  fireSecondary: boolean; // held
  reload: boolean; // edge
  ability1: boolean; // edge
  ability2: boolean; // edge
  ult: boolean; // edge
}

export function emptyIntent(): Intent {
  return { wishX: 0, wishZ: 0, jump: false, firePrimary: false, fireSecondary: false,
    reload: false, ability1: false, ability2: false, ult: false };
}

// Runtime actor. Wraps hero data + health + transform + ability/weapon state.
// Both the local player and bots are Heroes; what differs is who fills Intent.
export class Hero {
  readonly health: Health;
  readonly ability1: AbilityRuntime;
  readonly ability2: AbilityRuntime;
  readonly group = new THREE.Group();

  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  grounded = false;
  alive = true;

  ultCharge = 0;
  ammo: number;
  reloadTimer = 0;
  fireTimer = 0; // time until next allowed shot
  charge = 0; // charge-weapon accumulation (0..1)

  // status effects
  stunTimer = 0;
  blindTimer = 0;
  slowTimer = 0;
  slowFactor = 1;
  overshieldTimer = 0;

  respawnTimer = 0;
  deathTimer = 0;

  // recoil kick handed to FpsCamera (player only)
  recoilPitch = 0;

  // scoreboard stats
  kills = 0;
  deaths = 0;
  damageDealt = 0;
  healingDone = 0;

  spawnPoint = new THREE.Vector3();
  private band!: THREE.Mesh;

  constructor(readonly data: HeroData, public team: Team, readonly isPlayer: boolean) {
    this.health = new Health(data.maxHealth, data.armor, data.shield);
    this.ability1 = new AbilityRuntime(data.ability1);
    this.ability2 = new AbilityRuntime(data.ability2);
    this.ammo = data.primary.ammo;
    this.buildMesh();
    this.group.visible = !isPlayer; // first-person: hide own body
  }

  private buildMesh(): void {
    const h = config.world.playerHeight;
    const r = config.world.playerRadius;
    const accent = this.data.accent;

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(r, h - 2 * r, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x1b2233, roughness: 0.7, metalness: 0.2 }),
    );
    body.position.y = h / 2;
    body.castShadow = true;
    this.group.add(body);

    // role-colored emissive chest band
    this.band = new THREE.Mesh(
      new THREE.CylinderGeometry(r + 0.04, r + 0.04, 0.22, 12, 1, true),
      new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.9, side: THREE.DoubleSide }),
    );
    this.band.position.y = h * 0.62;
    this.group.add(this.band);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.7, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x2a3550, roughness: 0.6 }),
    );
    head.position.y = h - r * 0.6;
    head.castShadow = true;
    this.group.add(head);

    // simple weapon block to show facing/accent
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x10141c, emissive: accent, emissiveIntensity: 0.25 }),
    );
    gun.position.set(r + 0.05, h * 0.62, -0.25);
    this.group.add(gun);
  }

  get eye(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, this.pos.y + config.world.eyeHeight, this.pos.z);
  }

  // Vertical capsule segment for hit detection (a=lower, b=upper).
  capsule(): { a: THREE.Vector3; b: THREE.Vector3; r: number; headY: number } {
    const r = config.world.playerRadius;
    const a = new THREE.Vector3(this.pos.x, this.pos.y + r, this.pos.z);
    const b = new THREE.Vector3(this.pos.x, this.pos.y + config.world.playerHeight - r, this.pos.z);
    return { a, b, r, headY: this.pos.y + config.world.playerHeight * 0.72 };
  }

  aimDir(): THREE.Vector3 {
    const cp = Math.cos(this.pitch);
    return new THREE.Vector3(
      -Math.sin(this.yaw) * cp,
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * cp,
    ).normalize();
  }

  get moveSpeed(): number {
    return config.move.walkSpeed * this.data.moveSpeedMult * this.slowFactor;
  }
  get ultReady(): boolean {
    return this.ultCharge >= config.combat.ultCost;
  }
  get isStunned(): boolean {
    return this.stunTimer > 0;
  }
  get isBlinded(): boolean {
    return this.blindTimer > 0;
  }

  addUlt(points: number): void {
    if (!this.ultReady) this.ultCharge = Math.min(config.combat.ultCost, this.ultCharge + points);
  }
  setStun(t: number): void { this.stunTimer = Math.max(this.stunTimer, t); }
  setBlind(t: number): void { this.blindTimer = Math.max(this.blindTimer, t); }
  setSlow(factor: number, t: number): void { this.slowFactor = factor; this.slowTimer = Math.max(this.slowTimer, t); }
  grantOvershield(amount: number, dur: number): void {
    this.health.addOvershield(amount);
    this.overshieldTimer = Math.max(this.overshieldTimer, dur);
  }

  // Tick timers & passive regen. Movement/weapons/abilities handled elsewhere.
  updateState(now: number, dt: number): void {
    if (!this.alive) return;
    this.stunTimer = Math.max(0, this.stunTimer - dt);
    this.blindTimer = Math.max(0, this.blindTimer - dt);
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) this.slowFactor = 1;
    }
    if (this.overshieldTimer > 0) {
      this.overshieldTimer -= dt;
      if (this.overshieldTimer <= 0) this.health.clearOvershield();
    }
    this.health.regen(now, dt);
    this.applyPassive(now, dt);
    this.recoilPitch *= Math.max(0, 1 - dt * 8); // recoil recovery
  }

  private applyPassive(now: number, dt: number): void {
    const p = this.data.passive;
    const since = now - this.health.lastDamageTime;
    if (p.id === "armorRegen" && since >= p.params.delay && this.health.armor < this.health.maxArmor) {
      this.health.armor = Math.min(this.health.maxArmor, this.health.armor + p.params.rate * dt);
    } else if (p.id === "outOfCombatRegen" && since >= p.params.delay) {
      this.health.heal(p.params.rate * dt);
    }
  }

  // Tidewall still-reduction factor for incoming damage (1 = no reduction).
  incomingDamageScale(_now: number): number {
    const p = this.data.passive;
    if (p.id === "stillReduction") {
      const still = this.vel.x * this.vel.x + this.vel.z * this.vel.z < 0.5;
      if (still) return 1 - p.params.reduction;
    }
    return 1;
  }

  syncMesh(): void {
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    this.group.visible = this.alive && !this.isPlayer;
    if (this.alive) {
      const ready = this.ultReady ? 1.6 : 0.9;
      (this.band.material as THREE.MeshStandardMaterial).emissiveIntensity = ready;
    }
  }

  respawnAt(p: THREE.Vector3): void {
    this.pos.copy(p);
    this.vel.set(0, 0, 0);
    this.health.reset();
    this.alive = true;
    this.ammo = this.data.primary.ammo;
    this.reloadTimer = 0;
    this.fireTimer = 0;
    this.charge = 0;
    this.stunTimer = this.blindTimer = this.slowTimer = 0;
    this.slowFactor = 1;
    this.overshieldTimer = 0;
    this.ability1.reset();
    this.ability2.reset();
  }
}
