import * as THREE from "three";
import { GameMode, type MatchAPI } from "./GameMode";

const ENEMY = ["bulwark", "vex", "lumen"];
const ALLY = ["tidewall", "cogwright"];

// 3v3 objective: hold the central point to fill your progress bar to 100%.
export class ControlPoint extends GameMode {
  readonly id = "cp";
  readonly label = "Control Point";
  readonly environmentId = "plaza" as const;

  private progress: [number, number] = [0, 0];
  private captureRate = 14; // % per second
  private radius = 5;
  private contested = false;

  setup(api: MatchAPI): void {
    for (const h of ALLY) api.addBot(h, 0);
    for (const h of ENEMY) api.addBot(h, 1);
  }

  update(api: MatchAPI, dt: number): void {
    const cp = api.env.controlPoint ?? new THREE.Vector3();
    let on0 = 0, on1 = 0;
    const consider = [api.player, ...api.bots.map((b) => b.hero)];
    for (const h of consider) {
      if (!h.alive) continue;
      const d = Math.hypot(h.pos.x - cp.x, h.pos.z - cp.z);
      if (d <= this.radius && Math.abs(h.pos.y - cp.y) < 4) {
        if (h.team === 0) on0++; else if (h.team === 1) on1++;
      }
    }
    this.contested = on0 > 0 && on1 > 0;
    if (!this.contested) {
      if (on0 > 0) this.progress[0] = Math.min(100, this.progress[0] + this.captureRate * dt);
      else if (on1 > 0) this.progress[1] = Math.min(100, this.progress[1] + this.captureRate * dt);
    }

    if (this.progress[0] >= 100 || this.progress[1] >= 100) {
      const victory = this.progress[0] >= 100;
      api.end({
        victory,
        title: victory ? "VICTORY" : "DEFEAT",
        subtitle: victory ? "Your team captured the point." : "The enemy team captured the point.",
      });
    }
  }

  objectiveText(): string {
    return this.contested ? "CONTROL POINT — CONTESTED!" : "CONTROL POINT — capture and hold the center";
  }
  scoreText(): string {
    return `YOU ${Math.floor(this.progress[0])}%  —  ENEMY ${Math.floor(this.progress[1])}%`;
  }
}
