import { Hero } from "./Hero";
import { heroById } from "../data/heroes";
import type { Team } from "../engine/World";

// Builds a runtime Hero from the data table.
export function createHero(id: string, team: Team, isPlayer: boolean): Hero {
  return new Hero(heroById(id), team, isPlayer);
}
