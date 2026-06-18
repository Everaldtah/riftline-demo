import * as THREE from "three";
import { config } from "../data/config";
import type { Input } from "../engine/Input";
import type { Physics } from "../engine/Physics";
import type { Hero, Intent } from "../heroes/Hero";
import { emptyIntent } from "../heroes/Hero";
import { FpsCamera } from "./FpsCamera";

function moveToward(cur: number, target: number, maxDelta: number): number {
  const d = target - cur;
  if (Math.abs(d) <= maxDelta) return target;
  return cur + Math.sign(d) * maxDelta;
}

const _wish = new THREE.Vector3();

// Shared movement integrator for any Hero (player and bots). Reads wishX/wishZ
// (local) + jump from the intent, applies accel/gravity, resolves collision.
export function applyLocomotion(hero: Hero, physics: Physics, intent: Intent, dt: number): void {
  if (hero.isStunned) { intent.wishX = 0; intent.wishZ = 0; intent.jump = false; }
  const fx = -Math.sin(hero.yaw), fz = -Math.cos(hero.yaw);
  const rx = -fz, rz = fx;
  _wish.set(rx * intent.wishX + fx * intent.wishZ, 0, rz * intent.wishX + fz * intent.wishZ);
  if (_wish.lengthSq() > 1) _wish.normalize();
  const speed = hero.moveSpeed;
  const rate = (hero.grounded ? config.move.accel : config.move.accel * config.move.airControl) * dt;

  hero.vel.x = moveToward(hero.vel.x, _wish.x * speed, rate);
  hero.vel.z = moveToward(hero.vel.z, _wish.z * speed, rate);
  hero.vel.y -= config.world.gravity * dt;
  if (intent.jump && hero.grounded) hero.vel.y = config.move.jumpSpeed;

  hero.grounded = physics.resolve(hero.pos, hero.vel, config.world.playerRadius, config.world.playerHeight, dt);

  // void / fall-out safety: clamp far below the map
  if (hero.pos.y < -40) { hero.health.health = 0; }
}

// Produces player intent from input and drives the camera look.
export class PlayerController {
  readonly camera: FpsCamera;

  constructor(public hero: Hero, fov = 90) {
    this.camera = new FpsCamera(fov);
  }

  setHero(hero: Hero): void {
    this.hero = hero;
  }

  buildIntent(input: Input): Intent {
    const k = config.keys;
    this.camera.applyLook(input, this.hero);
    const intent = emptyIntent();
    intent.wishX = (input.down(k.right) ? 1 : 0) - (input.down(k.left) ? 1 : 0);
    intent.wishZ = (input.down(k.forward) ? 1 : 0) - (input.down(k.back) ? 1 : 0);
    intent.jump = input.down(k.jump);
    intent.firePrimary = input.mouse.left;
    intent.fireSecondary = input.mouse.right;
    intent.reload = input.pressed(k.reload);
    intent.ability1 = input.pressed(k.ability1);
    intent.ability2 = input.pressed(k.ability2);
    intent.ult = input.pressed(k.ultimate);
    return intent;
  }

  syncCamera(): void {
    this.camera.sync(this.hero);
  }
}
