// Single source of truth for the hero roster. All gameplay logic reads from here.
// Abilities are data-driven: a `kind` tag + numeric params interpreted by AbilitySystem.

export type Role = "anchor" | "striker" | "mender";

export type WeaponKind = "hitscan" | "projectile" | "beam" | "chargeHitscan";

export interface Weapon {
  kind: WeaponKind;
  damage: number; // per shot, or per second for beams
  fireInterval: number; // seconds between shots (for beams, the tick interval)
  spread: number; // radians of random cone
  headshotMult: number;
  ammo: number; // 0 = no ammo / infinite (beams, melee)
  reloadTime: number;
  pellets?: number; // hitscan shotguns
  range?: number; // hitscan / beam max range (default large)
  falloff?: { start: number; end: number; minFrac: number };
  projectileSpeed?: number;
  projectileGravity?: boolean;
  splashRadius?: number;
  splashDamage?: number;
  chargeTime?: number; // chargeHitscan: time to full charge
  chargedDamage?: number;
  healing?: number; // beam heal-per-second (primary fire on menders)
}

export type AbilityKind =
  | "dash"
  | "blink"
  | "vault"
  | "grapple"
  | "barrier"
  | "wall"
  | "smoke"
  | "reconDrone"
  | "healDrone"
  | "repairPack"
  | "overshield"
  | "flash"
  | "zone"
  | "markChain"
  | "lineBeam"
  | "aoeSlam"
  | "droneSwarm"
  | "radiance";

export interface Ability {
  name: string;
  kind: AbilityKind;
  cooldown: number; // seconds; 0 for ultimates (gated by ult charge instead)
  charges?: number; // abilities with multiple charges (e.g. Blink)
  params: Record<string, number>;
  desc: string;
}

export interface Passive {
  id:
    | "armorRegen"
    | "stillReduction"
    | "outOfCombatRegen"
    | "none"
    | "healingUltBonus"
    | "deployableFFImmune";
  text: string;
  params: Record<string, number>;
}

export interface HeroData {
  id: string;
  name: string;
  role: Role;
  accent: number; // hex emissive accent
  summary: string;
  maxHealth: number;
  armor: number;
  shield: number;
  moveSpeedMult: number;
  primary: Weapon;
  secondary?: Weapon;
  ability1: Ability;
  ability2: Ability;
  ultimate: Ability;
  passive: Passive;
}

export const ROLE_COLOR: Record<Role, number> = {
  anchor: 0xffb347,
  striker: 0xff5470,
  mender: 0x7cffb2,
};

export const HEROES: HeroData[] = [
  {
    id: "bulwark",
    name: "Bulwark",
    role: "anchor",
    accent: 0xffa033,
    summary: "Frontline brawler with a deployable barrier and a knockback charge.",
    maxHealth: 350,
    armor: 100,
    shield: 0,
    moveSpeedMult: 0.92,
    primary: {
      kind: "hitscan",
      damage: 90,
      fireInterval: 0.85,
      spread: 0.1,
      headshotMult: 1.5,
      ammo: 6,
      reloadTime: 1.4,
      pellets: 8,
      range: 30,
      falloff: { start: 6, end: 24, minFrac: 0.28 },
    },
    ability1: {
      name: "Barrier",
      kind: "barrier",
      cooldown: 12,
      params: { hp: 800, duration: 6, distance: 3, width: 4.5, height: 3 },
      desc: "Deploy a forward energy shield (800 HP, 6s).",
    },
    ability2: {
      name: "Charge",
      kind: "dash",
      cooldown: 7,
      params: { distance: 9, speed: 32, damage: 40, knockback: 9, stun: 0.3 },
      desc: "Dash forward, knocking back and damaging enemies hit.",
    },
    ultimate: {
      name: "Ground Slam",
      kind: "aoeSlam",
      cooldown: 0,
      params: { damage: 150, radius: 8, stun: 1.5, leap: 4 },
      desc: "Leap and slam for 150 dmg + stun in an 8m radius.",
    },
    passive: {
      id: "armorRegen",
      text: "Armor regenerates 10/s after 3s without taking damage.",
      params: { rate: 10, delay: 3 },
    },
  },
  {
    id: "tidewall",
    name: "Tidewall",
    role: "anchor",
    accent: 0x33b5ff,
    summary: "Zone-control tank with a grapple pull, solid wall, and a slowing flood.",
    maxHealth: 400,
    armor: 0,
    shield: 0,
    moveSpeedMult: 0.9,
    primary: {
      kind: "projectile",
      damage: 65,
      fireInterval: 0.9,
      spread: 0.015,
      headshotMult: 1.0,
      ammo: 5,
      reloadTime: 1.6,
      projectileSpeed: 38,
      projectileGravity: false,
      splashRadius: 2.5,
      splashDamage: 25,
      range: 60,
    },
    ability1: {
      name: "Grapple Pull",
      kind: "grapple",
      cooldown: 9,
      params: { range: 22, coneDeg: 30, pullSpeed: 26 },
      desc: "Hook the nearest enemy in a cone and pull them in.",
    },
    ability2: {
      name: "Water Wall",
      kind: "wall",
      cooldown: 11,
      params: { duration: 5, width: 6, height: 4, distance: 4 },
      desc: "Raise a solid wall barrier for 5s.",
    },
    ultimate: {
      name: "Flood",
      kind: "zone",
      cooldown: 0,
      params: { radius: 9, duration: 4, slow: 0.5, dps: 20 },
      desc: "Create a 9m zone that slows and deals 20 dmg/s for 4s.",
    },
    passive: {
      id: "stillReduction",
      text: "Takes 15% less damage while standing still for >1s.",
      params: { reduction: 0.15, delay: 1 },
    },
  },
  {
    id: "vex",
    name: "Vex",
    role: "striker",
    accent: 0xff4d6d,
    summary: "Hyper-mobile duelist: dual pistols, double blink, smoke, and a chaining ult.",
    maxHealth: 200,
    armor: 0,
    shield: 0,
    moveSpeedMult: 1.15,
    primary: {
      kind: "hitscan",
      damage: 18,
      fireInterval: 0.125,
      spread: 0.012,
      headshotMult: 2.0,
      ammo: 24,
      reloadTime: 1.2,
      range: 80,
    },
    ability1: {
      name: "Blink",
      kind: "blink",
      cooldown: 5,
      charges: 2,
      params: { distance: 6 },
      desc: "Instant 6m teleport in your movement direction (2 charges).",
    },
    ability2: {
      name: "Smoke",
      kind: "smoke",
      cooldown: 10,
      params: { radius: 5, duration: 4, distance: 8 },
      desc: "Drop a vision-blocking smoke cloud for 4s.",
    },
    ultimate: {
      name: "Death Mark",
      kind: "markChain",
      cooldown: 0,
      params: { maxTargets: 3, range: 45, burst: 120 },
      desc: "Mark up to 3 enemies, then chain-blink for 120 burst each.",
    },
    passive: {
      id: "outOfCombatRegen",
      text: "Regenerates 15 HP/s after 2s out of combat.",
      params: { rate: 15, delay: 2 },
    },
  },
  {
    id: "halcyon",
    name: "Halcyon",
    role: "striker",
    accent: 0xc77dff,
    summary: "Precision railgun marksman with recon, a dodge vault, and a piercing beam.",
    maxHealth: 200,
    armor: 0,
    shield: 0,
    moveSpeedMult: 1.05,
    primary: {
      kind: "chargeHitscan",
      damage: 35,
      fireInterval: 0.35,
      spread: 0.004,
      headshotMult: 2.0,
      ammo: 5,
      reloadTime: 1.8,
      chargeTime: 1.2,
      chargedDamage: 120,
      range: 120,
    },
    ability1: {
      name: "Recon Drone",
      kind: "reconDrone",
      cooldown: 12,
      params: { radius: 18, duration: 5, throwSpeed: 26 },
      desc: "Throw a drone that reveals enemies through walls for 5s.",
    },
    ability2: {
      name: "Vault",
      kind: "vault",
      cooldown: 6,
      params: { distance: 7, speed: 30, up: 4 },
      desc: "Quick backflip dodge with displacement.",
    },
    ultimate: {
      name: "Piercing Beam",
      kind: "lineBeam",
      cooldown: 0,
      params: { damage: 250, length: 110, width: 1.3 },
      desc: "Fire a map-length piercing beam for 250 dmg.",
    },
    passive: {
      id: "none",
      text: "No passive — a high skill-ceiling charge weapon instead.",
      params: {},
    },
  },
  {
    id: "lumen",
    name: "Lumen",
    role: "mender",
    accent: 0x7cffb2,
    summary: "Beam healer with overshields, a blinding flash, and a team-wide radiance ult.",
    maxHealth: 200,
    armor: 0,
    shield: 0,
    moveSpeedMult: 1.0,
    primary: {
      kind: "beam",
      damage: 0,
      healing: 60,
      fireInterval: 0.1,
      spread: 0,
      headshotMult: 1.0,
      ammo: 0,
      reloadTime: 0,
      range: 30,
    },
    secondary: {
      kind: "beam",
      damage: 45,
      fireInterval: 0.1,
      spread: 0,
      headshotMult: 1.0,
      ammo: 0,
      reloadTime: 0,
      range: 30,
    },
    ability1: {
      name: "Overshield",
      kind: "overshield",
      cooldown: 8,
      params: { amount: 75, duration: 5, range: 30 },
      desc: "Grant a targeted ally 75 temporary shield for 5s.",
    },
    ability2: {
      name: "Flash",
      kind: "flash",
      cooldown: 10,
      params: { coneDeg: 45, range: 14, duration: 1 },
      desc: "Blind enemies in a frontal cone for 1s.",
    },
    ultimate: {
      name: "Radiance",
      kind: "radiance",
      cooldown: 0,
      params: { duration: 5, hps: 80, overshield: 100, range: 40 },
      desc: "Heal all visible allies and grant 100 overshield for 5s.",
    },
    passive: {
      id: "healingUltBonus",
      text: "Gains 25% more ultimate charge from healing.",
      params: { mult: 1.25 },
    },
  },
  {
    id: "cogwright",
    name: "Cogwright",
    role: "mender",
    accent: 0xffd166,
    summary: "Deployable engineer: rivet gun, heal drone, instant repair pack, drone swarm.",
    maxHealth: 200,
    armor: 0,
    shield: 0,
    moveSpeedMult: 1.0,
    primary: {
      kind: "projectile",
      damage: 24,
      fireInterval: 0.18,
      spread: 0.02,
      headshotMult: 1.0,
      ammo: 25,
      reloadTime: 1.5,
      projectileSpeed: 62,
      projectileGravity: false,
      range: 70,
    },
    ability1: {
      name: "Heal Drone",
      kind: "healDrone",
      cooldown: 10,
      params: { hps: 40, radius: 6, duration: 8, throwSpeed: 18 },
      desc: "Deploy a drone that heals allies 40/s in a 6m radius for 8s.",
    },
    ability2: {
      name: "Repair Pack",
      kind: "repairPack",
      cooldown: 9,
      params: { heal: 150, throwSpeed: 26 },
      desc: "Throw a pack that instantly heals the first ally hit for 150.",
    },
    ultimate: {
      name: "Drone Swarm",
      kind: "droneSwarm",
      cooldown: 0,
      params: { count: 3, hps: 60, duration: 6, radius: 8 },
      desc: "Deploy 3 roaming drones giving heavy AoE healing for 6s.",
    },
    passive: {
      id: "deployableFFImmune",
      text: "Deployables are immune to its own team's friendly fire.",
      params: {},
    },
  },
];

export function heroById(id: string): HeroData {
  const h = HEROES.find((x) => x.id === id);
  if (!h) throw new Error(`Unknown hero id: ${id}`);
  return h;
}
