import * as THREE from "three";
import type { World } from "../engine/World";
import type { Hero } from "../heroes/Hero";
import type { Bot } from "../bots/Bot";
import type { Environment } from "../environments/Environment";

export interface MatchResult {
  victory: boolean;
  title: string;
  subtitle: string;
}

// The surface a GameMode uses to manipulate the running match. Implemented by Match.
export interface MatchAPI {
  readonly world: World;
  readonly env: Environment;
  readonly player: Hero;
  readonly isFFA: boolean;
  readonly bots: Bot[];
  spawnDummy(pos: THREE.Vector3, path?: { a: THREE.Vector3; b: THREE.Vector3; speed: number }): Hero;
  addBot(heroId: string, team: number): Bot;
  removeBot(bot: Bot): void;
  respawn(hero: Hero, team?: number): void;
  end(result: MatchResult): void;
}

// Common mode contract: setup once, update per fixed step, expose HUD strings.
export abstract class GameMode {
  abstract readonly id: string;
  abstract readonly label: string;
  abstract readonly environmentId: "training" | "plaza" | "skybridge";

  abstract setup(api: MatchAPI): void;
  abstract update(api: MatchAPI, dt: number): void;

  // HUD strings; default empty.
  objectiveText(_api: MatchAPI): string { return ""; }
  scoreText(_api: MatchAPI): string { return ""; }

  teardown(_api: MatchAPI): void {}
}
