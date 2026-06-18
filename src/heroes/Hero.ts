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
    switch (this.data.id) {
      case "bastion": this.buildBastion(); break;
      case "kairo": this.buildKairo(); break;
      case "vex": this.buildVex(); break;
      case "lumen": this.buildLumen(); break;
      case "oriona": this.buildOriona(); break;
      default: this.buildGeneric(); break;
    }
  }

  // PBR material helper. emissive defaults to none (0x000000 → no glow).
  private mat(color: number, roughness: number, metalness: number, emissive = 0x000000, ei = 1): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity: ei });
  }

  private addPart(geo: THREE.BufferGeometry, matr: THREE.Material, x: number, y: number, z: number, shadow = false): THREE.Mesh {
    const m = new THREE.Mesh(geo, matr);
    m.position.set(x, y, z);
    if (shadow) m.castShadow = true;
    this.group.add(m);
    return m;
  }

  // BASTION — "The Bulwark": bulky silver/gold knight, full helm, greatshield + warhammer.
  private buildBastion(): void {
    const h = config.world.playerHeight, r = config.world.playerRadius;
    const silver = this.mat(0xb9c2d0, 0.35, 0.85);
    const dark = this.mat(0x404654, 0.5, 0.6);
    const gold = this.mat(0xd4af37, 0.3, 0.9, 0x3a2c00, 0.5);

    // armored legs
    this.addPart(new THREE.CylinderGeometry(r * 0.52, r * 0.42, h * 0.5, 10), dark, -r * 0.5, h * 0.25, 0, true);
    this.addPart(new THREE.CylinderGeometry(r * 0.52, r * 0.42, h * 0.5, 10), dark, r * 0.5, h * 0.25, 0, true);
    // broad tapered torso
    this.addPart(new THREE.CylinderGeometry(r * 1.15, r * 0.95, h * 0.44, 12), silver, 0, h * 0.6, 0, true);
    // gold belt
    this.addPart(new THREE.CylinderGeometry(r * 1.0, r * 1.0, 0.12, 12), gold, 0, h * 0.4, 0);
    // lion emblem (pulsing accent)
    this.band = this.addPart(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 16),
      this.mat(0xffcf57, 0.25, 0.9, 0xd4af37, 1.2), 0, h * 0.64, r * 1.08);
    this.band.rotation.x = Math.PI / 2;
    // pauldrons
    this.addPart(new THREE.SphereGeometry(r * 0.55, 12, 10), silver, -r * 1.05, h * 0.78, 0, true);
    this.addPart(new THREE.SphereGeometry(r * 0.55, 12, 10), silver, r * 1.05, h * 0.78, 0, true);
    // full helm
    this.addPart(new THREE.SphereGeometry(r * 0.72, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), silver, 0, h * 0.86, 0, true);
    // gold visor slit
    this.addPart(new THREE.BoxGeometry(r * 1.05, 0.08, 0.1), this.mat(0xffe27a, 0.3, 0.3, 0xffcf57, 1.4), 0, h * 0.88, r * 0.5);
    // crest
    this.addPart(new THREE.BoxGeometry(0.08, 0.24, 0.5), gold, 0, h * 1.03, 0);

    // GREATSHIELD (left side)
    const shield = new THREE.Group();
    const sFace = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.08, 6), silver);
    sFace.rotation.x = Math.PI / 2; shield.add(sFace);
    const sRim = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 8, 6), gold); sRim.rotation.x = Math.PI / 2; shield.add(sRim);
    const sBoss = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), gold); sBoss.position.set(0, 0, 0.05); shield.add(sBoss);
    shield.position.set(r * 1.0, h * 0.58, r * 0.25); shield.rotation.y = -0.5; this.group.add(shield);

    // WARHAMMER (right side)
    const hammer = new THREE.Group();
    hammer.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.95, 8), dark)); // handle
    const hh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.24), this.mat(0xcdd4de, 0.3, 0.85)); hh.position.y = 0.5; hammer.add(hh);
    const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.26, 8), gold); hb.rotation.z = Math.PI / 2; hb.position.set(-0.13, 0.5, 0); hammer.add(hb);
    hammer.position.set(-r * 1.0, h * 0.48, -r * 0.3); hammer.rotation.z = 0.18; this.group.add(hammer);
  }

  // KAIRO — "The Wind Blade": green ninja, face mask, trailing scarf, twin curved swords, throwing star.
  private buildKairo(): void {
    const h = config.world.playerHeight, r = config.world.playerRadius;
    const green = this.mat(0x2a7d3f, 0.6, 0.2);
    const dark = this.mat(0x14211a, 0.7, 0.1);
    const silver = this.mat(0xc6cdd6, 0.4, 0.85);
    const skin = this.mat(0xb88a5c, 0.8, 0.0);
    const scarfGreen = this.mat(0x36b54e, 0.5, 0.1, 0x0c3b14, 0.35);

    this.addPart(new THREE.CylinderGeometry(r * 0.42, r * 0.36, h * 0.5, 8), dark, -r * 0.45, h * 0.25, 0, true);
    this.addPart(new THREE.CylinderGeometry(r * 0.42, r * 0.36, h * 0.5, 8), dark, r * 0.45, h * 0.25, 0, true);
    this.addPart(new THREE.CapsuleGeometry(r * 0.78, h * 0.26, 4, 10), green, 0, h * 0.6, 0, true);
    // glowing sash (accent)
    this.band = this.addPart(new THREE.TorusGeometry(r * 0.85, 0.07, 8, 18), this.mat(0x6cff8f, 0.4, 0.2, 0x3fd86a, 1.3), 0, h * 0.5, 0);
    this.band.rotation.x = Math.PI / 2; this.band.scale.y = 0.5;
    // head + lower-face mask + headband
    this.addPart(new THREE.SphereGeometry(r * 0.62, 14, 12), skin, 0, h * 0.85, 0, true);
    this.addPart(new THREE.SphereGeometry(r * 0.64, 14, 10, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), green, 0, h * 0.85, 0);
    const hb = this.addPart(new THREE.TorusGeometry(r * 0.63, 0.05, 6, 16), dark, 0, h * 0.9, 0); hb.rotation.x = Math.PI / 2; hb.scale.y = 0.6;
    // trailing scarf (segments drape back over the shoulders)
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.36), scarfGreen);
      seg.position.set(0, h * 0.92 - i * 0.12, 0.18 + i * 0.22);
      seg.rotation.x = -0.25 - i * 0.12;
      this.group.add(seg);
    }
    // twin curved swords slung over the shoulders
    const mkSword = (side: number): void => {
      const g = new THREE.Group();
      const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 6), silver); blade.position.y = 0.5; g.add(blade);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.07), dark); guard.position.y = 0.04; g.add(guard);
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.18, 6), green); hilt.position.y = -0.08; g.add(hilt);
      g.position.set(side * r * 0.95, h * 0.55, -r * 0.2); g.rotation.z = side * 0.18; g.rotation.x = -0.3;
      this.group.add(g);
    };
    mkSword(-1); mkSword(1);
    // throwing star on the hip
    const star = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 5), silver);
    star.rotation.x = Math.PI / 2; star.position.set(r * 0.82, h * 0.4, r * 0.3); this.group.add(star);
  }

  // VEX — "The Anarchist": purple/black, spiky hair, visor goggles, dual rifles.
  private buildVex(): void {
    const h = config.world.playerHeight, r = config.world.playerRadius;
    const purp = this.mat(0x6a3aa0, 0.5, 0.2);
    const dark = this.mat(0x140c1c, 0.6, 0.1);
    const skin = this.mat(0xc99b7a, 0.8, 0.0);
    const hairMat = this.mat(0x241634, 0.6, 0.1);
    const accent = this.mat(0xb06bff, 0.4, 0.2, 0xb06bff, 1.2);

    this.addPart(new THREE.CylinderGeometry(r * 0.4, r * 0.34, h * 0.5, 8), dark, -r * 0.42, h * 0.25, 0, true);
    this.addPart(new THREE.CylinderGeometry(r * 0.4, r * 0.34, h * 0.5, 8), dark, r * 0.42, h * 0.25, 0, true);
    // tight crop top (midriff exposed) — torso sits high
    this.addPart(new THREE.CapsuleGeometry(r * 0.74, h * 0.2, 4, 10), purp, 0, h * 0.68, 0, true);
    // chest core (accent)
    this.band = this.addPart(new THREE.SphereGeometry(0.12, 12, 10), accent, 0, h * 0.72, r * 0.7);
    // head
    this.addPart(new THREE.SphereGeometry(r * 0.58, 14, 12), skin, 0, h * 0.86, 0, true);
    // spiky hair
    const spikes = [[0, 0.05], [0.13, 0.0], [-0.13, 0.0], [0.08, 0.1], [-0.08, 0.1], [0, 0.13]];
    for (const [x, z] of spikes) {
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.21, 6), hairMat);
      s.position.set(x, h * 1.02, z); s.rotation.x = (z - 0.05) * 2; this.group.add(s);
    }
    // visor goggles
    this.addPart(new THREE.BoxGeometry(r * 0.92, 0.09, 0.08), this.mat(0xc9a6ff, 0.3, 0.3, 0xb06bff, 1.6), 0, h * 0.88, r * 0.5);
    // dual rifles
    const mkRifle = (side: number): void => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.55), dark); g.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8), this.mat(0x3a2a4a, 0.5, 0.3));
      barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.02, -0.4); g.add(barrel);
      const glow = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.1), accent); glow.position.set(0, 0.08, -0.1); g.add(glow);
      g.position.set(side * r * 0.7, h * 0.66, -r * 0.5); g.rotation.y = side * 0.1;
      this.group.add(g);
    };
    mkRifle(-1); mkRifle(1);
  }

  // LUMEN — "The Beacon": white/gold/teal robes, horned headpiece, staff w/ glowing orb, floating orbs.
  private buildLumen(): void {
    const h = config.world.playerHeight, r = config.world.playerRadius;
    const white = this.mat(0xeef2f7, 0.5, 0.1);
    const gold = this.mat(0xd9b345, 0.4, 0.85, 0x3a2c00, 0.4);
    const teal = this.mat(0x2dd4bf, 0.3, 0.2, 0x2dd4bf, 1.4);
    const hair = this.mat(0x2a2230, 0.7, 0.0);

    // flowing robe (cone skirt)
    const robe = new THREE.Mesh(new THREE.ConeGeometry(r * 1.15, h * 0.95, 16, 1, true), white);
    robe.position.y = h * 0.48; robe.castShadow = true; this.group.add(robe);
    // upper bodice
    this.addPart(new THREE.CylinderGeometry(r * 0.7, r * 0.85, h * 0.32, 12), white, 0, h * 0.66, 0);
    // gold collar (accent)
    this.band = this.addPart(new THREE.TorusGeometry(r * 0.6, 0.06, 8, 18), this.mat(0xffe27a, 0.3, 0.85, 0xd4af37, 1.0), 0, h * 0.8, 0);
    this.band.rotation.x = Math.PI / 2; this.band.scale.y = 0.6;
    // head + back hair
    this.addPart(new THREE.SphereGeometry(r * 0.56, 16, 14), this.mat(0xf0d2b6, 0.8, 0), 0, h * 0.9, 0, true);
    this.addPart(new THREE.SphereGeometry(r * 0.58, 14, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), hair, 0, h * 0.92, -r * 0.1);
    // halo + curved horns
    this.addPart(new THREE.TorusGeometry(r * 0.62, 0.04, 8, 24), gold, 0, h * 1.02, 0).rotation.x = Math.PI / 2;
    const mkHorn = (side: number): void => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.34, 10), gold);
      horn.position.set(side * r * 0.45, h * 1.08, 0); horn.rotation.z = side * 0.5; this.group.add(horn);
    };
    mkHorn(-1); mkHorn(1);
    // staff: gold shaft + glowing teal orb
    const staff = new THREE.Group();
    staff.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 8), gold));
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 14), teal); orb.position.y = 0.72; staff.add(orb);
    staff.position.set(r * 0.85, h * 0.5, r * 0.05); staff.rotation.z = -0.12; this.group.add(staff);
    // floating orbs (teal + gold)
    this.addPart(new THREE.SphereGeometry(0.11, 14, 12), teal, -r * 0.95, h * 0.85, r * 0.2);
    this.addPart(new THREE.SphereGeometry(0.11, 14, 12), this.mat(0xffe27a, 0.3, 0.3, 0xffcf57, 1.4), r * 0.5, h * 1.14, -r * 0.4);
  }

  // ORIONA — "The Fateweaver": deep violet, hooded cowl over a shadowed face, long cape, crystal staff + orbs.
  private buildOriona(): void {
    const h = config.world.playerHeight, r = config.world.playerRadius;
    const purp = this.mat(0x6a2fb0, 0.5, 0.2);
    const dpurp = this.mat(0x3a1a66, 0.6, 0.1);
    const silver = this.mat(0xb8c0cc, 0.4, 0.85);
    const accent = this.mat(0x8a4bff, 0.3, 0.2, 0x8a4bff, 1.5);

    this.addPart(new THREE.CylinderGeometry(r * 0.4, r * 0.34, h * 0.5, 8), dpurp, -r * 0.42, h * 0.25, 0, true);
    this.addPart(new THREE.CylinderGeometry(r * 0.4, r * 0.34, h * 0.5, 8), dpurp, r * 0.42, h * 0.25, 0, true);
    this.addPart(new THREE.CylinderGeometry(r * 0.7, r * 0.88, h * 0.42, 12), purp, 0, h * 0.6, 0, true);
    // silver trim + chest crystal (accent)
    const trim = this.addPart(new THREE.TorusGeometry(r * 0.74, 0.05, 8, 16), silver, 0, h * 0.7, 0); trim.rotation.x = Math.PI / 2; trim.scale.y = 0.6;
    this.band = this.addPart(new THREE.OctahedronGeometry(0.12), accent, 0, h * 0.72, r * 0.8);
    // long flowing cape behind
    const cape = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 1.0, h * 0.95, 14, 1, true), dpurp);
    cape.position.set(0, h * 0.5, r * 0.35); cape.castShadow = true; this.group.add(cape);
    // shadowed face inside the hood + glowing eyes
    this.addPart(new THREE.SphereGeometry(r * 0.42, 12, 10), this.mat(0x0a0612, 0.9, 0), 0, h * 0.85, 0);
    const eyeMat = this.mat(0xb788ff, 0.3, 0.2, 0x8a4bff, 2.0);
    this.addPart(new THREE.BoxGeometry(0.03, 0.03, 0.06), eyeMat, -r * 0.13, h * 0.87, r * 0.36);
    this.addPart(new THREE.BoxGeometry(0.03, 0.03, 0.06), eyeMat, r * 0.13, h * 0.87, r * 0.36);
    // hood cowl (open cone) over the head
    const hood = new THREE.Mesh(new THREE.ConeGeometry(r * 0.8, h * 0.52, 16, 1, true), purp);
    hood.position.set(0, h * 0.95, 0); hood.rotation.x = 0.08; this.group.add(hood);
    // crystal staff + floating orbs
    const staff = new THREE.Group();
    staff.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.25, 8), silver));
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), accent); crystal.position.y = 0.7; staff.add(crystal);
    staff.position.set(r * 0.8, h * 0.5, r * 0.1); staff.rotation.z = -0.1; this.group.add(staff);
    this.addPart(new THREE.SphereGeometry(0.1, 14, 12), accent, -r * 0.9, h * 0.8, r * 0.25);
    this.addPart(new THREE.SphereGeometry(0.1, 14, 12), accent, r * 0.5, h * 1.16, -r * 0.35);
  }

  // Generic fallback (should not be reached with the current roster).
  private buildGeneric(): void {
    const h = config.world.playerHeight, r = config.world.playerRadius, accent = this.data.accent;
    this.addPart(new THREE.CapsuleGeometry(r, h - 2 * r, 6, 12), this.mat(0x1b2233, 0.7, 0.2), 0, h / 2, 0, true);
    this.band = this.addPart(new THREE.CylinderGeometry(r + 0.04, r + 0.04, 0.22, 12, 1, true),
      this.mat(accent, 0.4, 0.2, accent, 0.9), 0, h * 0.62, 0);
    this.addPart(new THREE.SphereGeometry(r * 0.7, 12, 10), this.mat(0x2a3550, 0.6, 0.2), 0, h - r * 0.6, 0, true);
    this.addPart(new THREE.BoxGeometry(0.14, 0.14, 0.7), this.mat(0x10141c, 0.6, 0.2, accent, 0.25), r + 0.05, h * 0.62, -0.25);
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

  // still-reduction passive factor for incoming damage (1 = no reduction).
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
