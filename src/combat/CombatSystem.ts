import * as THREE from "three";
import type { Weapon } from "../data/heroes";
import type { Hero, Intent } from "../heroes/Hero";
import type { World, ProjectileSpec } from "../engine/World";
import { ObjectPool } from "../engine/ObjectPool";
import { Projectile } from "./Projectile";

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

// Closest distance (squared) from a ray (origin o, unit dir d, t>=0) to a
// segment [a,b]. Returns the hit distance `t` along the ray if within radius r.
function rayCapsule(o: THREE.Vector3, d: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, r: number): { t: number; point: THREE.Vector3 } | null {
  const ba = _v.copy(b).sub(a);
  const ao = _w.copy(o).sub(a);
  const baba = ba.dot(ba);
  const bad = ba.dot(d);
  const baao = ba.dot(ao);
  const dao = d.dot(ao);
  const denom = baba - bad * bad;
  let t: number; // along ray
  let s: number; // along segment
  if (Math.abs(denom) > 1e-6) {
    t = (bad * baao - baba * dao) / denom;
  } else {
    t = -dao;
  }
  if (t < 0) t = 0;
  s = (baao + t * bad) / baba;
  s = Math.max(0, Math.min(1, s));
  // recompute closest point on ray given clamped s
  const segPt = new THREE.Vector3().copy(a).addScaledVector(ba, s);
  // project segPt onto ray
  t = Math.max(0, segPt.clone().sub(o).dot(d));
  const rayPt = new THREE.Vector3().copy(o).addScaledVector(d, t);
  if (rayPt.distanceToSquared(segPt) <= r * r) {
    return { t, point: rayPt };
  }
  return null;
}

// Pick the candidate whose direction from `hero.eye` is within `maxAngle` of aim,
// has LOS, and is within range. Returns closest-to-crosshair.
export function pickInCone(hero: Hero, candidates: Hero[], maxAngle: number, range: number, world: World): Hero | null {
  const eye = hero.eye;
  const aim = hero.aimDir();
  let best: Hero | null = null;
  let bestDot = Math.cos(maxAngle);
  for (const c of candidates) {
    if (!c.alive || c === hero) continue;
    const to = _v.copy(c.eye).sub(eye);
    const dist = to.length();
    if (dist > range) continue;
    to.normalize();
    const dot = to.dot(aim);
    if (dot > bestDot && world.physics.lineOfSight(eye, c.eye)) {
      bestDot = dot;
      best = c;
    }
  }
  return best;
}

interface HitResult {
  hit: boolean;
  killed: boolean;
}

export class CombatSystem {
  readonly projectiles: ObjectPool<Projectile>;
  // tracks previous primary-held state per hero for charge-weapon release detection
  private heldPrev = new WeakMap<Hero, boolean>();

  constructor(private scene: THREE.Scene) {
    this.projectiles = new ObjectPool<Projectile>(() => {
      const p = new Projectile();
      this.scene.add(p.mesh);
      return p;
    }, 32);
  }

  spawnProjectile(spec: ProjectileSpec): void {
    const p = this.projectiles.acquire();
    p.spawn(spec.owner, spec.origin, _v.copy(spec.dir).multiplyScalar(spec.speed), spec.color,
      spec.damage, spec.radius, spec.gravity, spec.lifetime, spec.splashRadius ?? 0, spec.splashDamage ?? 0);
  }

  // Per-hero weapon stepping driven by intent.
  updateWeapon(hero: Hero, world: World, intent: Intent, dt: number): void {
    if (!hero.alive || hero.isStunned) { this.heldPrev.set(hero, false); return; }
    hero.fireTimer = Math.max(0, hero.fireTimer - dt);

    // reload handling
    if (hero.reloadTimer > 0) {
      hero.reloadTimer -= dt;
      if (hero.reloadTimer <= 0) hero.ammo = hero.data.primary.ammo;
    }
    const primary = hero.data.primary;
    const secondary = hero.data.secondary;

    if (intent.reload && primary.ammo > 0 && hero.ammo < primary.ammo && hero.reloadTimer <= 0) {
      hero.reloadTimer = primary.reloadTime;
    }

    // mender damage beam on secondary
    if (secondary && secondary.kind === "beam" && intent.fireSecondary) {
      this.fireBeam(hero, world, secondary, dt);
      this.heldPrev.set(hero, false);
      return;
    }

    if (primary.kind === "beam") {
      if (intent.firePrimary) this.fireBeam(hero, world, primary, dt);
      return;
    }

    if (primary.kind === "chargeHitscan") {
      this.updateCharge(hero, world, primary, intent.firePrimary);
      return;
    }

    // automatic / semi-auto hitscan & projectile
    if (intent.firePrimary && hero.fireTimer <= 0 && hero.reloadTimer <= 0) {
      if (primary.ammo > 0 && hero.ammo <= 0) {
        hero.reloadTimer = primary.reloadTime;
      } else {
        this.fireOnce(hero, world, primary);
        hero.fireTimer = primary.fireInterval;
        if (primary.ammo > 0) {
          hero.ammo--;
          if (hero.ammo <= 0) hero.reloadTimer = primary.reloadTime;
        }
      }
    }
  }

  private updateCharge(hero: Hero, world: World, w: Weapon, held: boolean): void {
    const prev = this.heldPrev.get(hero) ?? false;
    if (held && hero.reloadTimer <= 0 && hero.ammo > 0) {
      hero.charge = Math.min(1, hero.charge + (1 / (w.chargeTime ?? 1)) * (1 / 60));
    }
    // fire on release
    if (prev && !held && hero.charge > 0 && hero.fireTimer <= 0 && hero.ammo > 0) {
      const dmg = w.damage + (((w.chargedDamage ?? w.damage) - w.damage) * hero.charge);
      this.hitscanShot(hero, world, w, dmg);
      hero.fireTimer = w.fireInterval;
      hero.charge = 0;
      hero.ammo--;
      if (hero.ammo <= 0) hero.reloadTimer = w.reloadTime;
    }
    if (!held) hero.charge = 0;
    this.heldPrev.set(hero, held);
  }

  private fireOnce(hero: Hero, world: World, w: Weapon): void {
    if (w.kind === "hitscan") {
      this.hitscanShot(hero, world, w, w.damage);
    } else if (w.kind === "projectile") {
      const dir = this.spreadDir(hero.aimDir(), w.spread);
      this.spawnProjectile({
        owner: hero, origin: hero.eye.addScaledVector(dir, 0.6), dir,
        speed: w.projectileSpeed ?? 40, damage: w.damage, radius: 0.16,
        gravity: !!w.projectileGravity, lifetime: 3,
        splashRadius: w.splashRadius, splashDamage: w.splashDamage,
        color: hero.data.accent,
      });
    }
  }

  // One hitscan trigger pull (handles shotgun pellets), returns hit summary.
  private hitscanShot(hero: Hero, world: World, w: Weapon, damage: number): HitResult {
    const pellets = w.pellets ?? 1;
    const perPellet = damage / pellets;
    let any: HitResult = { hit: false, killed: false };
    for (let i = 0; i < pellets; i++) {
      const dir = this.spreadDir(hero.aimDir(), w.spread);
      const r = this.singleRay(hero, world, w, dir, perPellet);
      if (r.hit) any.hit = true;
      if (r.killed) any.killed = true;
    }
    if (hero.isPlayer && any.hit) world.notifyHitmarker(any.killed);
    // visual tracer
    this.tracer(hero.eye, hero.aimDir(), w.range ?? 80, hero.data.accent);
    return any;
  }

  private singleRay(hero: Hero, world: World, w: Weapon, dir: THREE.Vector3, dmg: number): HitResult {
    const origin = hero.eye;
    const maxDist = w.range ?? 80;
    const env = world.physics.raycast(origin, dir, maxDist);
    const envDist = env ? env.dist : maxDist;
    let best: { hero: Hero; t: number; head: boolean } | null = null;
    for (const target of world.enemiesOf(hero.team)) {
      if (!target.alive) continue;
      const cap = target.capsule();
      const hit = rayCapsule(origin, dir, cap.a, cap.b, cap.r);
      if (hit && hit.t < envDist && (!best || hit.t < best.t)) {
        best = { hero: target, t: hit.t, head: hit.point.y > cap.headY };
      }
    }
    if (!best) return { hit: false, killed: false };
    let final = dmg;
    if (w.falloff) {
      const { start, end, minFrac } = w.falloff;
      if (best.t > start) {
        const f = Math.max(minFrac, 1 - ((best.t - start) / (end - start)) * (1 - minFrac));
        final *= f;
      }
    }
    if (best.head) final *= w.headshotMult;
    const before = best.hero.alive;
    world.dealDamage(hero, best.hero, final, best.head ? "head" : "normal");
    return { hit: true, killed: before && best.hero.health.dead };
  }

  private fireBeam(hero: Hero, world: World, w: Weapon, dt: number): void {
    const range = w.range ?? 30;
    if (w.healing) {
      const allies = world.alliesOf(hero);
      const target = pickInCone(hero, allies.length ? allies : [hero], 0.12, range, world) ?? hero;
      if (target.health.health < target.health.maxHealth) {
        const healed = target.health.heal(w.healing * dt);
        if (healed > 0) {
          world.dealDamage(hero, target, -healed, "heal"); // negative -> heal credit path
        }
      }
      this.beamLine(hero.eye, target.eye, hero.data.accent);
    } else {
      const target = pickInCone(hero, world.enemiesOf(hero.team), 0.06, range, world);
      if (target) {
        world.dealDamage(hero, target, w.damage * dt, "normal");
        this.beamLine(hero.eye, target.eye, 0xff5470);
      }
    }
  }

  private spreadDir(dir: THREE.Vector3, spread: number): THREE.Vector3 {
    if (spread <= 0) return dir.clone();
    const d = dir.clone();
    const up = Math.abs(d.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const right = new THREE.Vector3().crossVectors(d, up).normalize();
    const realUp = new THREE.Vector3().crossVectors(right, d).normalize();
    const a = (Math.random() - 0.5) * 2 * spread;
    const b = (Math.random() - 0.5) * 2 * spread;
    return d.addScaledVector(right, a).addScaledVector(realUp, b).normalize();
  }

  // --- transient visual tracers/beams (cheap line segments, auto-fade) ---
  private tracers: { line: THREE.Line; life: number }[] = [];
  private tracer(from: THREE.Vector3, dir: THREE.Vector3, len: number, color: number): void {
    const to = from.clone().addScaledVector(dir, len);
    this.addLine(from, to, color, 0.06);
  }
  private beamLine(from: THREE.Vector3, to: THREE.Vector3, color: number): void {
    this.addLine(from, to, color, 0.04);
  }
  private addLine(from: THREE.Vector3, to: THREE.Vector3, color: number, life: number): void {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }));
    this.scene.add(line);
    this.tracers.push({ line, life });
  }

  updateProjectiles(world: World, dt: number): void {
    this.projectiles.sweep((p) => {
      if (!p.active) return true;
      if (p.gravity) p.vel.y -= 24 * dt;
      const step = _v.copy(p.vel).multiplyScalar(dt);
      const len = step.length();
      const dir = _w.copy(step).normalize();
      const origin = p.mesh.position;
      const env = world.physics.raycast(origin, dir, len + p.radius);
      let hitPoint: THREE.Vector3 | null = null;
      let directTarget: Hero | null = null;
      let bestT = env ? env.dist : Infinity;
      for (const target of world.enemiesOf(p.owner!.team)) {
        if (!target.alive) continue;
        const cap = target.capsule();
        const hit = rayCapsule(origin, dir, cap.a, cap.b, cap.r + p.radius);
        if (hit && hit.t <= len + p.radius && hit.t < bestT) {
          bestT = hit.t; directTarget = target; hitPoint = hit.point;
        }
      }
      if (directTarget) {
        world.dealDamage(p.owner!, directTarget, p.damage, "normal");
        this.explode(world, p, hitPoint ?? origin);
        if (p.owner!.isPlayer) world.notifyHitmarker(directTarget.health.dead);
        return true;
      }
      if (env && env.dist <= len + p.radius) {
        this.explode(world, p, env.point);
        return true;
      }
      p.mesh.position.addScaledVector(p.vel, dt);
      p.life -= dt;
      if (p.life <= 0) { p.deactivate(); return true; }
      return false;
    });

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      (t.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, t.life / 0.06) * 0.8;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        (t.line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }
  }

  private explode(world: World, p: Projectile, at: THREE.Vector3): void {
    world.spawnEffect(at, (p.mesh.material as THREE.MeshStandardMaterial).color.getHex(), "hit");
    if (p.splashRadius > 0) {
      for (const target of world.enemiesOf(p.owner!.team)) {
        if (!target.alive) continue;
        const d = target.eye.distanceTo(at);
        if (d <= p.splashRadius) {
          const f = 1 - d / p.splashRadius;
          world.dealDamage(p.owner!, target, p.splashDamage * f, "normal");
        }
      }
    }
    p.deactivate();
  }
}
