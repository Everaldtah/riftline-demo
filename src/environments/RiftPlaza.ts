import * as THREE from "three";
import { Environment } from "./Environment";

// Urban objective map: central plaza with the control point, scattered cover,
// two opposing spawn rooms, and a raised flank route. Used by Control Point
// and Deathmatch.
export class RiftPlaza extends Environment {
  build(): void {
    this.skyTop = 0x2a1840;
    this.skyBottom = 0x0a0814;
    this.fogColor = 0x130c1e;
    this.addFloor(120, 0x171320, true);

    const W = 45;
    this.addBox(0, 4, -W, W * 2, 8, 1, 0x241a36);
    this.addBox(0, 4, W, W * 2, 8, 1, 0x241a36);
    this.addBox(-W, 4, 0, 1, 8, W * 2, 0x241a36);
    this.addBox(W, 4, 0, 1, 8, W * 2, 0x241a36);

    // control point pad (visual)
    this.controlPoint = new THREE.Vector3(0, 0, 0);
    const pad = this.addBox(0, 0.05, 0, 10, 0.1, 10, 0x38e8ff, { collider: false, emissive: 0x1c6e80, opacity: 0.5 });
    pad.name = "controlPad";

    // central cover around the point
    this.addBox(-5, 1, -5, 2, 2, 2, 0x2c2440);
    this.addBox(5, 1, 5, 2, 2, 2, 0x2c2440);
    this.addBox(5, 1, -6, 3, 2, 1.5, 0x2c2440);
    this.addBox(-6, 1, 5, 1.5, 2, 3, 0x2c2440);
    // pillars
    for (const [x, z] of [[-12, -12], [12, 12], [-12, 12], [12, -12]] as const) {
      this.addBox(x, 3, z, 1.5, 6, 1.5, 0x352a4d, { emissive: 0x140e22 });
    }

    // spawn rooms (team 0 south, team 1 north)
    this.buildSpawnRoom(0, 32, 0x1c2c44);
    this.buildSpawnRoom(1, -32, 0x44243a);

    // raised flank route along the east side
    this.addBox(30, 2, 10, 8, 0.4, 4, 0x2a2240, { emissive: 0x140e22 });
    this.addBox(34, 3.4, 0, 6, 0.4, 8, 0x2a2240, { emissive: 0x140e22 });
    this.addBox(30, 2, -10, 8, 0.4, 4, 0x2a2240, { emissive: 0x140e22 });

    this.scene.add(this.group);
  }

  private buildSpawnRoom(team: number, z: number, color: number): void {
    const sign = Math.sign(z);
    this.addBox(0, 3, z + sign * 6, 16, 6, 1, color);
    this.addBox(-8, 3, z, 1, 6, 12, color);
    this.addBox(8, 3, z, 1, 6, 12, color);
    const spawns = [
      new THREE.Vector3(-4, 1, z),
      new THREE.Vector3(0, 1, z),
      new THREE.Vector3(4, 1, z),
    ];
    this.teamSpawns[team] = spawns;
    this.ffaSpawns.push(...spawns);
  }
}
