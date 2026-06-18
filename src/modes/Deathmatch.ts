import { GameMode, type MatchAPI } from "./GameMode";

const ROSTER = ["bulwark", "tidewall", "vex", "halcyon", "lumen", "cogwright"];

// Free-for-all vs bots. First to the kill target, or highest at time limit.
export class Deathmatch extends GameMode {
  readonly id = "dm";
  readonly label = "Deathmatch";
  readonly environmentId = "plaza" as const;

  private killTarget = 15;
  private timeLeft = 180;
  private botCount = 6;

  setup(api: MatchAPI): void {
    for (let i = 0; i < this.botCount; i++) {
      const hero = ROSTER[Math.floor(Math.random() * ROSTER.length)];
      api.addBot(hero, 10 + i); // unique team per bot (FFA)
    }
  }

  update(api: MatchAPI, dt: number): void {
    this.timeLeft -= dt;
    const leader = this.leaderKills(api);
    if (leader >= this.killTarget || this.timeLeft <= 0) {
      const mine = api.player.kills;
      const top = mine >= leader; // player leads or ties for the lead
      api.end({
        victory: top,
        title: top ? "VICTORY" : "DEFEAT",
        subtitle: `You finished with ${mine} kills (leader had ${leader}).`,
      });
    }
  }

  private leaderKills(api: MatchAPI): number {
    let max = api.player.kills;
    for (const b of api.bots) max = Math.max(max, b.hero.kills);
    return max;
  }

  objectiveText(): string {
    const m = Math.max(0, Math.floor(this.timeLeft / 60));
    const s = Math.max(0, Math.floor(this.timeLeft % 60));
    return `DEATHMATCH — first to ${this.killTarget} kills · ${m}:${s.toString().padStart(2, "0")}`;
  }
  scoreText(api: MatchAPI): string {
    return `Your kills: ${api.player.kills} · Leader: ${this.leaderKills(api)}`;
  }
}
