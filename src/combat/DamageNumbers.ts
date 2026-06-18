import * as THREE from "three";
import type { DamageKind } from "../engine/World";

interface DNum {
  sprite: THREE.Sprite;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  life: number;
  vy: number;
  active: boolean;
}

const COLORS: Record<DamageKind, string> = {
  normal: "#ffffff",
  head: "#ffd23f",
  heal: "#7cffb2",
};

// Pooled floating world-space damage/heal text sprites.
export class DamageNumbers {
  private pool: DNum[] = [];

  constructor(private scene: THREE.Scene, size = 40) {
    for (let i = 0; i < size; i++) this.pool.push(this.make());
  }

  private make(): DNum {
    const canvas = document.createElement("canvas");
    canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.scale.set(1.2, 0.6, 1);
    sprite.visible = false;
    this.scene.add(sprite);
    return { sprite, canvas, ctx, texture, life: 0, vy: 0, active: false };
  }

  spawn(pos: THREE.Vector3, amount: number, kind: DamageKind): void {
    const d = this.pool.find((x) => !x.active) ?? this.make();
    if (!this.pool.includes(d)) this.pool.push(d);
    const { ctx, canvas } = d;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "bold 44px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.fillStyle = COLORS[kind];
    const txt = (kind === "heal" ? "+" : "") + Math.round(amount).toString();
    ctx.strokeText(txt, 64, 32);
    ctx.fillText(txt, 64, 32);
    d.texture.needsUpdate = true;
    d.sprite.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.4, (Math.random() - 0.5) * 0.5));
    d.sprite.visible = true;
    d.life = 1.0;
    d.vy = 1.4;
    d.active = true;
  }

  update(dt: number): void {
    for (const d of this.pool) {
      if (!d.active) continue;
      d.life -= dt;
      d.sprite.position.y += d.vy * dt;
      d.vy *= 1 - dt * 1.5;
      (d.sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, d.life);
      if (d.life <= 0) {
        d.active = false;
        d.sprite.visible = false;
      }
    }
  }
}
