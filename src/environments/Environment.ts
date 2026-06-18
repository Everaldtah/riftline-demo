import * as THREE from "three";
import type { Physics } from "../engine/Physics";

export interface DummySpot {
  pos: THREE.Vector3;
  path?: { a: THREE.Vector3; b: THREE.Vector3; speed: number };
}

// Base map. Subclasses build procedural geometry, register colliders, and
// expose spawn points + (optionally) a control point and dummy positions.
export abstract class Environment {
  readonly group = new THREE.Group();
  skyTop = 0x0b1224;
  skyBottom = 0x05070d;
  fogColor = 0x0a0f1c;

  teamSpawns: [THREE.Vector3[], THREE.Vector3[]] = [[], []];
  ffaSpawns: THREE.Vector3[] = [];
  controlPoint: THREE.Vector3 | null = null;
  dummySpots: DummySpot[] = [];

  constructor(protected scene: THREE.Scene, protected physics: Physics) {}

  abstract build(): void;

  protected addBox(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number,
                   color: number, opts: { collider?: boolean; emissive?: number; opacity?: number } = {}): THREE.Mesh {
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.85,
      metalness: 0.1,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissive ? 0.6 : 0,
      transparent: opts.opacity !== undefined,
      opacity: opts.opacity ?? 1,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    mesh.position.set(cx, cy, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    if (opts.collider !== false) {
      const box = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(cx, cy, cz), new THREE.Vector3(sx, sy, sz));
      this.physics.addBox(box);
    }
    return mesh;
  }

  protected addFloor(size: number, color: number, grid = true): void {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ color, roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);
    // floor collider: a thin box just below y=0
    this.physics.addBox(new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(size, 1, size)));
    if (grid) {
      const g = new THREE.GridHelper(size, size / 2, 0x223052, 0x152038);
      (g.material as THREE.Material).transparent = true;
      (g.material as THREE.Material).opacity = 0.5;
      this.group.add(g);
    }
  }

  spawnFor(team: number, isFFA: boolean): THREE.Vector3 {
    const list = isFFA ? this.ffaSpawns : this.teamSpawns[team] ?? this.ffaSpawns;
    const pick = list[Math.floor(Math.random() * list.length)] ?? new THREE.Vector3(0, 1, 0);
    return pick.clone();
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mm) => mm.dispose());
      }
    });
  }
}
