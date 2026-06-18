import * as THREE from "three";
import { Environment } from "./Environment";

// Clean facility: shooting lanes with distance markers, dummy rows, cover,
// and a couple of jump platforms. Used by Training Ground.
export class TrainingArena extends Environment {
  build(): void {
    this.skyTop = 0x10203a;
    this.skyBottom = 0x070b14;
    this.fogColor = 0x0b1422;
    this.addFloor(120, 0x12161f, true);

    // perimeter walls
    const W = 50;
    this.addBox(0, 3, -W, W * 2, 6, 1, 0x1c2436);
    this.addBox(0, 3, W, W * 2, 6, 1, 0x1c2436);
    this.addBox(-W, 3, 0, 1, 6, W * 2, 0x1c2436);
    this.addBox(W, 3, 0, 1, 6, W * 2, 0x1c2436);

    // distance markers down the central lane (10 / 20 / 30 m)
    const markerColors = [0x38e8ff, 0xffd23f, 0xff5470];
    [10, 20, 30].forEach((d, i) => {
      this.addBox(-6, 0.05, -d, 12, 0.1, 0.3, markerColors[i], { collider: false, emissive: markerColors[i] });
      this.addBox(-12, 1, -d, 0.3, 2, 0.3, markerColors[i], { emissive: markerColors[i] });
    });

    // dummy row (static)
    for (let i = 0; i < 5; i++) {
      this.dummySpots.push({ pos: new THREE.Vector3(-8 + i * 4, 0, -22) });
    }
    // moving dummies
    this.dummySpots.push({ pos: new THREE.Vector3(-10, 0, -32), path: { a: new THREE.Vector3(-14, 0, -32), b: new THREE.Vector3(-2, 0, -32), speed: 3 } });
    this.dummySpots.push({ pos: new THREE.Vector3(8, 0, -32), path: { a: new THREE.Vector3(2, 0, -32), b: new THREE.Vector3(14, 0, -32), speed: 4 } });

    // cover blocks
    this.addBox(10, 1, -8, 3, 2, 3, 0x222c40);
    this.addBox(16, 0.75, -14, 4, 1.5, 2, 0x222c40);
    this.addBox(-18, 1.25, -10, 2, 2.5, 6, 0x222c40);

    // jump platforms
    this.addBox(20, 1, 6, 4, 0.4, 4, 0x2a3550, { emissive: 0x1a2540 });
    this.addBox(26, 2.2, 2, 4, 0.4, 4, 0x2a3550, { emissive: 0x1a2540 });
    this.addBox(26, 3.4, -4, 4, 0.4, 4, 0x2a3550, { emissive: 0x1a2540 });

    // player / spawn area
    this.ffaSpawns.push(new THREE.Vector3(0, 1, 10), new THREE.Vector3(-4, 1, 12), new THREE.Vector3(4, 1, 12));
    this.teamSpawns = [this.ffaSpawns, this.ffaSpawns];
    this.scene.add(this.group);
  }
}
