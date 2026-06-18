import type { Hero, Intent } from "../heroes/Hero";
import type { World } from "../engine/World";
import { BotAI } from "./BotAI";

// A bot is a Hero plus an AI that fills its Intent each tick.
export class Bot {
  readonly ai: BotAI;

  constructor(readonly hero: Hero) {
    this.ai = new BotAI(hero);
  }

  think(world: World, dt: number): Intent {
    return this.ai.update(world, dt);
  }
}
