import * as THREE from "three";

// Lightweight custom collision. Environment is a set of AABBs. Dynamic bodies
// (player/bots) collide as an AABB approximation of their capsule, which is
// robust for blocky procedural levels. Hitscan/LOS uses ray-vs-AABB.
export interface RayHit {
  dist: number;
  point: THREE.Vector3;
}

const _ray = new THREE.Ray();
const _tmp = new THREE.Vector3();

export class Physics {
  readonly colliders: THREE.Box3[] = [];

  addBox(box: THREE.Box3): void {
    this.colliders.push(box);
  }

  clear(): void {
    this.colliders.length = 0;
  }

  // Resolve a dynamic body against all colliders. `pos` is the feet position
  // (body extends upward by `height`). Mutates pos & vel. Returns grounded flag.
  resolve(pos: THREE.Vector3, vel: THREE.Vector3, radius: number, height: number, dt: number): boolean {
    pos.addScaledVector(vel, dt);
    let grounded = false;

    const half = new THREE.Vector3(radius, height / 2, radius);
    for (let iter = 0; iter < 3; iter++) {
      let resolvedAny = false;
      for (const box of this.colliders) {
        const center = _tmp.set(pos.x, pos.y + height / 2, pos.z);
        // overlap on each axis
        const ox = box.max.x - (center.x - half.x);
        const ox2 = (center.x + half.x) - box.min.x;
        const oy = box.max.y - (center.y - half.y);
        const oy2 = (center.y + half.y) - box.min.y;
        const oz = box.max.z - (center.z - half.z);
        const oz2 = (center.z + half.z) - box.min.z;
        if (ox <= 0 || ox2 <= 0 || oy <= 0 || oy2 <= 0 || oz <= 0 || oz2 <= 0) continue;

        // minimum penetration on each axis (signed direction)
        const px = ox < ox2 ? ox : -ox2;
        const py = oy < oy2 ? oy : -oy2;
        const pz = oz < oz2 ? oz : -oz2;
        const ax = Math.abs(px), ay = Math.abs(py), az = Math.abs(pz);

        if (ax <= ay && ax <= az) {
          pos.x += px;
          if (Math.sign(px) === Math.sign(vel.x) || vel.x * px < 0) vel.x = 0;
        } else if (ay <= ax && ay <= az) {
          pos.y += py;
          if (py > 0) { grounded = true; if (vel.y < 0) vel.y = 0; }
          else if (vel.y > 0) vel.y = 0;
        } else {
          pos.z += pz;
          if (vel.z * pz < 0) vel.z = 0;
        }
        resolvedAny = true;
      }
      if (!resolvedAny) break;
    }
    return grounded;
  }

  // Nearest hit of a ray against environment colliders.
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): RayHit | null {
    _ray.origin.copy(origin);
    _ray.direction.copy(dir).normalize();
    let best: RayHit | null = null;
    for (const box of this.colliders) {
      const p = _ray.intersectBox(box, new THREE.Vector3());
      if (p) {
        const d = origin.distanceTo(p);
        if (d <= maxDist && (!best || d < best.dist)) best = { dist: d, point: p };
      }
    }
    return best;
  }

  // True if open line of sight between two points (no collider blocks it).
  lineOfSight(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const dir = _tmp.copy(b).sub(a);
    const dist = dir.length();
    const hit = this.raycast(a, dir, dist - 0.01);
    return hit === null;
  }
}
