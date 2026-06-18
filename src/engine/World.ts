import * as THREE from "three";
import type { Physics } from "./Physics";
import type { Hero } from "../heroes/Hero";

// Team id. 0 / 1 for team modes; in FFA each actor gets a unique positive id.
export type Team = number;

export interface ProjectileSpec {
  owner: Hero;
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  speed: number;
  damage: number;
  radius: number;
  gravity: boolean;
  lifetime: number;
  splashRadius?: number;
  splashDamage?: number;
  color: number;
}

export type DamageKind = "normal" | "head" | "heal";

// The runtime context gameplay systems (heroes, abilities, bots, modes) use.
// Implemented by Match. Keeps systems decoupled from the top-level Game.
export interface World {
  readonly scene: THREE.Scene;
  readonly physics: Physics;
  readonly actors: readonly Hero[];
  readonly isFFA: boolean;
  time(): number;

  enemiesOf(team: Team): Hero[];
  alliesOf(hero: Hero): Hero[];

  spawnProjectile(spec: ProjectileSpec): void;
  // Apply damage from `source` to `target`; returns charge-worthy amount dealt.
  dealDamage(source: Hero, target: Hero, amount: number, kind: DamageKind): number;
  damageNumber(pos: THREE.Vector3, amount: number, kind: DamageKind): void;
  spawnEffect(pos: THREE.Vector3, color: number, kind: "hit" | "death" | "ability"): void;

  // Temporary world objects (barriers, walls, drones, smoke, zones).
  addTempCollider(box: THREE.Box3): { remove(): void };

  // Player feedback hooks (no-ops for bots).
  notifyHitmarker(killed: boolean): void;
}
