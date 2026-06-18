import * as THREE from "three";
import { Environment } from "./Environment";

// Stretch map: compact elevated arena of connected platforms over a void.
// No floor — falling off is lethal (handled by the void clamp in locomotion).
export class Skybridge extends Environment {
  build(): void {
    this.skyTop = 0x123042;
    this.skyBottom = 0x05121a;
    this.fogColor = 0x08161f;

    const plat = (x: number, z: number, w: number, d: number) =>
      this.addBox(x, 0, z, w, 1, d, 0x1a2738, { emissive: 0x0d1a26 });

    plat(0, 0, 14, 14); // center
    plat(0, -18, 8, 8);
    plat(0, 18, 8, 8);
    plat(-18, 0, 8, 8);
    plat(18, 0, 8, 8);
    // connecting bridges
    plat(0, -9, 3, 10);
    plat(0, 9, 3, 10);
    plat(-9, 0, 10, 3);
    plat(9, 0, 10, 3);
    // a couple of high perches
    this.addBox(-18, 2.5, 0, 4, 0.4, 4, 0x223450, { emissive: 0x101c30 });
    this.addBox(18, 2.5, 0, 4, 0.4, 4, 0x223450, { emissive: 0x101c30 });

    const spawns = [
      new THREE.Vector3(0, 2, -16), new THREE.Vector3(0, 2, 16),
      new THREE.Vector3(-16, 2, 0), new THREE.Vector3(16, 2, 0),
      new THREE.Vector3(0, 2, 0),
    ];
    this.ffaSpawns.push(...spawns);
    this.teamSpawns = [spawns, spawns];
    this.scene.add(this.group);
  }
}
