import * as THREE from "three";
import { config } from "../data/config";
import type { Input } from "../engine/Input";
import type { Hero } from "../heroes/Hero";

// First-person camera. Translates mouse delta into the player's yaw/pitch and
// positions itself at the player's eye, including a transient recoil kick.
export class FpsCamera {
  readonly camera: THREE.PerspectiveCamera;

  constructor(fov = 90) {
    this.camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.05, 500);
  }

  applyLook(input: Input, hero: Hero): void {
    hero.yaw -= input.mouse.dx * config.look.sensitivity;
    hero.pitch -= input.mouse.dy * config.look.sensitivity;
    const max = config.look.maxPitch;
    hero.pitch = Math.max(-max, Math.min(max, hero.pitch));
  }

  sync(hero: Hero): void {
    const eye = hero.eye;
    this.camera.position.set(eye.x, eye.y, eye.z);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = hero.yaw;
    this.camera.rotation.x = hero.pitch + hero.recoilPitch;
  }
}
