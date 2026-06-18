import * as THREE from "three";
import type { Ability } from "../data/heroes";
import type { Hero, Intent } from "./Hero";
import type { World } from "../engine/World";
import { pickInCone } from "../combat/CombatSystem";

const _v = new THREE.Vector3();

interface ActiveEffect {
  tick(dt: number, world: World): boolean; // returns true when finished
  cleanup(): void;
}

// Executes data-driven abilities and owns time-based effects (deployables,
// drones, zones, smoke, reveals, channelled ults).
export class AbilitySystem {
  private effects: ActiveEffect[] = [];
  private reveals = new Map<Hero, { timer: number; marker: THREE.Mesh }>();

  constructor(private scene: THREE.Scene) {}

  reset(): void {
    for (const e of this.effects) e.cleanup();
    this.effects.length = 0;
    for (const r of this.reveals.values()) this.scene.remove(r.marker);
    this.reveals.clear();
  }

  update(hero: Hero, world: World, intent: Intent, dt: number): void {
    hero.ability1.update(dt);
    hero.ability2.update(dt);
    if (!hero.alive || hero.isStunned) return;

    if (intent.ability1 && hero.ability1.ready) {
      if (this.activate(hero, world, hero.data.ability1, false)) hero.ability1.use();
    }
    if (intent.ability2 && hero.ability2.ready) {
      if (this.activate(hero, world, hero.data.ability2, false)) hero.ability2.use();
    }
    if (intent.ult && hero.ultReady) {
      if (this.activate(hero, world, hero.data.ultimate, true)) hero.ultCharge = 0;
    }
  }

  updateEffects(world: World, dt: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      if (this.effects[i].tick(dt, world)) {
        this.effects[i].cleanup();
        this.effects.splice(i, 1);
      }
    }
    for (const [hero, r] of this.reveals) {
      r.timer -= dt;
      r.marker.position.set(hero.pos.x, hero.pos.y + 2.2, hero.pos.z);
      r.marker.visible = hero.alive && r.timer > 0;
      if (r.timer <= 0) {
        this.scene.remove(r.marker);
        this.reveals.delete(hero);
      }
    }
  }

  private activate(hero: Hero, world: World, def: Ability, isUlt: boolean): boolean {
    const p = def.params;
    const fwd = this.forwardHoriz(hero);
    world.spawnEffect(hero.eye, hero.data.accent, "ability");

    switch (def.kind) {
      case "dash": {
        hero.vel.x = fwd.x * p.speed;
        hero.vel.z = fwd.z * p.speed;
        for (const e of world.enemiesOf(hero.team)) {
          if (!e.alive) continue;
          const to = _v.copy(e.pos).sub(hero.pos);
          const along = to.dot(fwd);
          if (along > 0 && along < p.distance && to.lengthSq() - along * along < 4) {
            world.dealDamage(hero, e, p.damage, "normal");
            e.vel.addScaledVector(fwd, p.knockback);
            e.setStun(p.stun);
          }
        }
        return true;
      }
      case "blink": {
        const dir = (Math.abs(hero.vel.x) + Math.abs(hero.vel.z) > 0.5)
          ? _v.set(hero.vel.x, 0, hero.vel.z).normalize() : fwd;
        let d = p.distance;
        const env = world.physics.raycast(hero.eye, dir, d);
        if (env) d = Math.max(0, env.dist - 0.6);
        hero.pos.addScaledVector(dir, d);
        return true;
      }
      case "vault": {
        hero.vel.x = -fwd.x * p.speed;
        hero.vel.z = -fwd.z * p.speed;
        hero.vel.y = p.up;
        return true;
      }
      case "grapple": {
        const target = pickInCone(hero, world.enemiesOf(hero.team), (p.coneDeg * Math.PI) / 180, p.range, world);
        if (!target) return false;
        const dir = _v.copy(hero.pos).sub(target.pos).setY(0).normalize();
        target.vel.x = dir.x * p.pullSpeed;
        target.vel.z = dir.z * p.pullSpeed;
        target.setStun(0.3);
        return true;
      }
      case "barrier":
        this.effects.push(this.makeWall(hero, p.distance, p.width, p.height, p.duration, hero.data.accent, 0.35));
        return true;
      case "wall":
        this.effects.push(this.makeWall(hero, p.distance, p.width, p.height, p.duration, 0x3aa0ff, 0.5));
        return true;
      case "smoke":
        this.effects.push(this.makeSmoke(hero, p.distance, p.radius, p.duration));
        return true;
      case "flash": {
        const half = (p.coneDeg * Math.PI) / 180;
        for (const e of world.enemiesOf(hero.team)) {
          if (!e.alive) continue;
          const to = _v.copy(e.eye).sub(hero.eye);
          if (to.length() > p.range) continue;
          to.normalize();
          if (to.dot(hero.aimDir()) > Math.cos(half) && world.physics.lineOfSight(hero.eye, e.eye)) {
            e.setBlind(p.duration);
          }
        }
        return true;
      }
      case "overshield": {
        const allies = world.alliesOf(hero);
        const target = pickInCone(hero, allies, 0.25, p.range, world) ?? hero;
        target.grantOvershield(p.amount, p.duration);
        world.spawnEffect(target.eye, 0x7cffb2, "ability");
        return true;
      }
      case "repairPack": {
        const allies = world.alliesOf(hero).filter((a) => a.health.health < a.health.maxHealth);
        const target = pickInCone(hero, allies, 0.4, 30, world) ?? (allies.length ? allies[0] : hero);
        const healed = target.health.heal(p.heal);
        if (healed > 0) { world.dealDamage(hero, target, -healed, "heal"); world.damageNumber(target.eye, healed, "heal"); }
        return true;
      }
      case "reconDrone": {
        const land = this.groundInFront(hero, world, 10);
        this.effects.push(this.makeReconDrone(hero, land, p.radius, p.duration));
        return true;
      }
      case "healDrone": {
        const land = this.groundInFront(hero, world, 6);
        this.effects.push(this.makeHealDrone(hero, land, p.hps, p.radius, p.duration));
        return true;
      }
      case "zone": {
        const c = this.groundInFront(hero, world, 6);
        this.effects.push(this.makeZone(hero, c, p.radius, p.duration, p.dps, p.slow));
        return true;
      }
      case "radiance":
        this.effects.push(this.makeRadiance(hero, p.duration, p.hps, p.overshield, p.range));
        return true;
      case "droneSwarm": {
        for (let i = 0; i < p.count; i++) {
          const ang = (i / p.count) * Math.PI * 2;
          const c = hero.pos.clone().add(new THREE.Vector3(Math.cos(ang) * 3, 0, Math.sin(ang) * 3));
          this.effects.push(this.makeHealDrone(hero, c, p.hps, p.radius, p.duration, true));
        }
        return true;
      }
      case "aoeSlam": {
        hero.vel.y = 6;
        for (const e of world.enemiesOf(hero.team)) {
          if (!e.alive) continue;
          if (e.pos.distanceTo(hero.pos) <= p.radius) {
            world.dealDamage(hero, e, p.damage, "normal");
            e.setStun(p.stun);
          }
        }
        this.shockwave(hero.pos, p.radius, hero.data.accent);
        return true;
      }
      case "lineBeam": {
        const o = hero.eye; const dir = hero.aimDir();
        for (const e of world.enemiesOf(hero.team)) {
          if (!e.alive) continue;
          const to = _v.copy(e.eye).sub(o);
          const along = to.dot(dir);
          if (along > 0 && along < p.length && to.lengthSq() - along * along < p.width * p.width) {
            world.dealDamage(hero, e, p.damage, "normal");
          }
        }
        this.beam(o, o.clone().addScaledVector(dir, p.length), hero.data.accent);
        return true;
      }
      case "markChain": {
        const half = 0.5;
        const targets = world.enemiesOf(hero.team)
          .filter((e) => e.alive && _v.copy(e.eye).sub(hero.eye).normalize().dot(hero.aimDir()) > Math.cos(half)
            && hero.eye.distanceTo(e.eye) < p.range && world.physics.lineOfSight(hero.eye, e.eye))
          .slice(0, p.maxTargets);
        for (const t of targets) {
          world.dealDamage(hero, t, p.burst, "normal");
          this.beam(hero.eye, t.eye, hero.data.accent);
        }
        const last = targets[targets.length - 1];
        if (last) { hero.pos.x = last.pos.x; hero.pos.z = last.pos.z; }
        return targets.length > 0 || isUlt; // ults always fire even if no target
      }
      default:
        return true;
    }
  }

  // ---- effect builders ----

  private forwardHoriz(hero: Hero): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(hero.yaw), 0, -Math.cos(hero.yaw)).normalize();
  }

  private groundInFront(hero: Hero, world: World, dist: number): THREE.Vector3 {
    const fwd = this.forwardHoriz(hero);
    const p = hero.pos.clone().addScaledVector(fwd, dist);
    const down = new THREE.Vector3(p.x, p.y + 3, p.z);
    const hit = world.physics.raycast(down, new THREE.Vector3(0, -1, 0), 8);
    if (hit) p.y = hit.point.y;
    return p;
  }

  private makeWall(hero: Hero, dist: number, w: number, h: number, dur: number, color: number, opacity: number): ActiveEffect {
    const fwd = this.forwardHoriz(hero);
    const center = hero.pos.clone().addScaledVector(fwd, dist).setY(hero.pos.y + h / 2);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 0.3),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, transparent: true, opacity }),
    );
    mesh.position.copy(center);
    mesh.rotation.y = hero.yaw;
    this.scene.add(mesh);
    const box = new THREE.Box3().setFromObject(mesh);
    const col = registerCollider(box);
    let t = dur;
    return {
      tick: (dt) => { t -= dt; return t <= 0; },
      cleanup: () => { this.scene.remove(mesh); mesh.geometry.dispose(); col.remove(); },
    };
  }

  private makeSmoke(hero: Hero, dist: number, radius: number, dur: number): ActiveEffect {
    const fwd = this.forwardHoriz(hero);
    const c = hero.eye.clone().addScaledVector(fwd, dist);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x9099aa, transparent: true, opacity: 0.55 }),
    );
    mesh.position.copy(c);
    this.scene.add(mesh);
    const box = new THREE.Box3().setFromCenterAndSize(c, new THREE.Vector3(radius * 1.4, radius * 1.4, radius * 1.4));
    const col = registerCollider(box);
    let t = dur;
    return {
      tick: (dt) => { t -= dt; (mesh.material as THREE.MeshStandardMaterial).opacity = 0.55 * Math.min(1, t); return t <= 0; },
      cleanup: () => { this.scene.remove(mesh); mesh.geometry.dispose(); col.remove(); },
    };
  }

  private makeReconDrone(hero: Hero, at: THREE.Vector3, radius: number, dur: number): ActiveEffect {
    const mesh = droneMesh(0xc77dff);
    mesh.position.copy(at).setY(at.y + 1.5);
    this.scene.add(mesh);
    let t = dur;
    return {
      tick: (dt, world) => {
        t -= dt;
        for (const e of world.enemiesOf(hero.team)) {
          if (e.alive && e.pos.distanceTo(mesh.position) <= radius) this.reveal(e, 0.5);
        }
        return t <= 0;
      },
      cleanup: () => { this.scene.remove(mesh); },
    };
  }

  private makeHealDrone(hero: Hero, at: THREE.Vector3, hps: number, radius: number, dur: number, roam = false): ActiveEffect {
    const mesh = droneMesh(0xffd166);
    mesh.position.copy(at).setY(at.y + 1.6);
    this.scene.add(mesh);
    let t = dur; let bob = Math.random() * 6;
    const home = mesh.position.clone();
    return {
      tick: (dt, world) => {
        t -= dt; bob += dt * 3;
        mesh.position.y = home.y + Math.sin(bob) * 0.2;
        if (roam) { mesh.position.x = home.x + Math.cos(bob * 0.5) * 2; mesh.position.z = home.z + Math.sin(bob * 0.5) * 2; }
        for (const a of world.alliesOf(hero)) {
          if (a.alive && a.health.health < a.health.maxHealth && a.pos.distanceTo(mesh.position) <= radius) {
            const healed = a.health.heal(hps * dt);
            if (healed > 0.01) world.dealDamage(hero, a, -healed, "heal");
          }
        }
        return t <= 0;
      },
      cleanup: () => { this.scene.remove(mesh); },
    };
  }

  private makeZone(hero: Hero, c: THREE.Vector3, radius: number, dur: number, dps: number, slow: number): ActiveEffect {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.2, 24),
      new THREE.MeshStandardMaterial({ color: 0x3aa0ff, emissive: 0x3aa0ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.4 }),
    );
    mesh.position.copy(c).setY(c.y + 0.1);
    this.scene.add(mesh);
    let t = dur;
    return {
      tick: (dt, world) => {
        t -= dt;
        for (const e of world.enemiesOf(hero.team)) {
          if (e.alive && e.pos.distanceTo(c) <= radius) {
            world.dealDamage(hero, e, dps * dt, "normal");
            e.setSlow(slow, 0.3);
          }
        }
        return t <= 0;
      },
      cleanup: () => { this.scene.remove(mesh); mesh.geometry.dispose(); },
    };
  }

  private makeRadiance(hero: Hero, dur: number, hps: number, overshield: number, range: number): ActiveEffect {
    let t = dur;
    const granted = new Set<Hero>();
    return {
      tick: (dt, world) => {
        t -= dt;
        for (const a of world.alliesOf(hero).concat(hero)) {
          if (!a.alive) continue;
          if (a.pos.distanceTo(hero.pos) > range) continue;
          const healed = a.health.heal(hps * dt);
          if (healed > 0.01) world.dealDamage(hero, a, -healed, "heal");
          if (!granted.has(a)) { a.grantOvershield(overshield, dur); granted.add(a); }
        }
        return t <= 0;
      },
      cleanup: () => {},
    };
  }

  private reveal(hero: Hero, time: number): void {
    let r = this.reveals.get(hero);
    if (!r) {
      const marker = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.35),
        new THREE.MeshBasicMaterial({ color: 0xff3b3b, depthTest: false, transparent: true, opacity: 0.9 }),
      );
      marker.renderOrder = 999;
      this.scene.add(marker);
      r = { timer: 0, marker };
      this.reveals.set(hero, r);
    }
    r.timer = Math.max(r.timer, time);
  }

  private shockwave(at: THREE.Vector3, radius: number, color: number): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.3, radius, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(at).setY(at.y + 0.1);
    this.scene.add(ring);
    let t = 0.5;
    this.effects.push({
      tick: (dt) => { t -= dt; (ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, t / 0.5) * 0.7; return t <= 0; },
      cleanup: () => { this.scene.remove(ring); ring.geometry.dispose(); },
    });
  }

  private beam(a: THREE.Vector3, b: THREE.Vector3, color: number): void {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9, linewidth: 2 }));
    this.scene.add(line);
    let t = 0.25;
    this.effects.push({
      tick: (dt) => { t -= dt; (line.material as THREE.LineBasicMaterial).opacity = Math.max(0, t / 0.25); return t <= 0; },
      cleanup: () => { this.scene.remove(line); geo.dispose(); },
    });
  }
}

// Collider registration is wired by Match (which owns Physics). AbilitySystem
// emits via this indirection so it does not depend on Physics directly.
let colliderSink: ((box: THREE.Box3) => { remove(): void }) | null = null;
export function setColliderSink(fn: (box: THREE.Box3) => { remove(): void }): void {
  colliderSink = fn;
}
function registerCollider(box: THREE.Box3): { remove(): void } {
  return colliderSink ? colliderSink(box) : { remove() {} };
}

function droneMesh(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x10141c, emissive: color, emissiveIntensity: 0.8 }),
  );
  g.add(body);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.35, 0.04, 6, 16),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1 }),
  );
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  return g;
}
