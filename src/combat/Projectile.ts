import * as THREE from "three";
import type { Hero } from "../heroes/Hero";

// Pooled projectile entity. Pure state + a reusable emissive mesh; motion and
// collision are driven by CombatSystem so it has world access.
export class Projectile {
  readonly mesh: THREE.Mesh;
  active = false;
  owner: Hero | null = null;
  vel = new THREE.Vector3();
  damage = 0;
  radius = 0.15;
  gravity = false;
  life = 0;
  splashRadius = 0;
  splashDamage = 0;

  constructor() {
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.4 }),
    );
    this.mesh.visible = false;
  }

  spawn(owner: Hero, origin: THREE.Vector3, vel: THREE.Vector3, color: number,
        damage: number, radius: number, gravity: boolean, life: number,
        splashRadius = 0, splashDamage = 0): void {
    this.owner = owner;
    this.mesh.position.copy(origin);
    this.vel.copy(vel);
    this.damage = damage;
    this.radius = radius;
    this.gravity = gravity;
    this.life = life;
    this.splashRadius = splashRadius;
    this.splashDamage = splashDamage;
    this.mesh.scale.setScalar(radius);
    const m = this.mesh.material as THREE.MeshStandardMaterial;
    m.color.setHex(color);
    m.emissive.setHex(color);
    this.mesh.visible = true;
    this.active = true;
  }

  deactivate(): void {
    this.active = false;
    this.mesh.visible = false;
    this.owner = null;
  }
}
