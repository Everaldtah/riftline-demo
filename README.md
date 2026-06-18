# RIFTLINE

A browser-based **first-person hero shooter** demo built with TypeScript, Vite, and Three.js.
Overwatch-style mechanics — heroes with roles, abilities, and ultimates — single-player vs bots.

> **Original IP.** All art is procedural geometry generated in code. There are no
> external models, textures, sprites, or audio assets. Everything renders from
> `THREE.*` primitives at runtime.

---

## Play

```bash
npm install
npm run dev      # http://localhost:5173 — click to lock the mouse and play
```

Build a static bundle:

```bash
npm run build    # type-check (tsc --noEmit) then vite build -> dist/
npm run preview  # serve the production build locally
```

Requires Node 18+ (developed on Node 22).

## Controls

| Input | Action | Input | Action |
|---|---|---|---|
| `W A S D` | Move | `Mouse` | Look |
| `Space` | Jump | `L-Mouse` | Primary fire |
| `R-Mouse` | Secondary / alt-fire | `Shift` | Ability 1 |
| `E` | Ability 2 | `Q` | Ultimate |
| `R` | Reload | `Tab` | Scoreboard (hold) |
| `Esc` | Pause / menu | | |

Click the window to capture the mouse; press `Esc` to release it.

## Heroes

Five heroes ("Team Nova") across three roles. Each has a primary weapon, two
abilities, an ultimate, and a passive.

| Hero | Role | HP | Primary | Ability 1 · 2 | Ultimate |
|---|---|---|---|---|---|
| **Bastion** | Anchor | 350 +100a | Hitscan shotgun | Aegis Shield · Bulwark Charge | Seismic Slam |
| **Kairo** | Striker | 200 | Charge blade | Seeking Star · Wind Step | Thousand Cuts |
| **Vex** | Striker | 200 | Dual pistols | Blink ×2 · Smoke | Death Mark |
| **Lumen** | Mender | 200 | Heal beam (+dmg alt) | Overshield · Radiant Flash | Radiance |
| **Oriona** | Mender | 200 | Arcane bolt | Mending Orb · Fate's Thread | Astral Orbs |

## Modes

- **Training Ground** — solo sandbox. Stationary and moving target dummies,
  distance lanes, and live DPS / HPS readouts. Toggle **Infinite Ammo**,
  **No Cooldown**, and **Fight Back** (spawns a hostile bot) from the panel.
- **Deathmatch** — free-for-all against 6 bots. First to 15 kills, or the leader
  when the 3:00 timer ends, wins.
- **Control Point** — 3v3. Two allies and three enemies fight over the central
  point; hold it to fill your capture bar to 100%.

## Maps

- **Training Arena** — clean facility: shooting lanes with 10/20/30 m markers,
  dummy rows, cover blocks, and jump platforms.
- **Rift Plaza** — urban objective map with a central control point, scattered
  cover, two opposing spawn rooms, and a raised flank route.
- **Skybridge** — compact arena of connected platforms over a void. No floor —
  falling off is lethal.

## How it works

- **Fixed-step simulation** (`src/engine/Clock.ts`): gameplay ticks at a stable
  60 Hz, decoupled from the render rate.
- **Custom collision** (`src/engine/Physics.ts`): the world is a set of AABBs.
  Dynamic bodies collide as an AABB approximation of their capsule; hitscan and
  line-of-sight use ray-vs-AABB; hit detection against actors uses
  ray-vs-capsule.
- **Data-driven heroes** (`src/data/heroes.ts`): the single source of truth.
  Abilities are a `kind` tag + numeric params interpreted by
  `src/heroes/AbilitySystem.ts`.
- **One integration layer** (`src/engine/Match.ts`) implements both the engine
  `World` (what combat/abilities/bots call into) and the `MatchAPI` (what each
  game mode uses to spawn actors and end the match).

## Project layout

```
src/
  data/        config tuning + hero roster (source of truth)
  engine/      Clock, Renderer, Input, Physics, ObjectPool, World interface, Match, Game
  combat/      Health, Projectile, DamageNumbers, CombatSystem (weapons + hit detection)
  heroes/      Hero actor, AbilityRuntime, AbilitySystem, HeroFactory
  player/      FpsCamera, PlayerController (+ shared applyLocomotion)
  bots/        Bot + BotAI (idle/seek/attack/retreat state machine)
  environments/ Environment base + TrainingArena, RiftPlaza, Skybridge
  modes/       GameMode base + TrainingGround, Deathmatch, ControlPoint
  ui/          styles, HUD, Menu, HeroGallery
  main.ts      bootstrap
```

## Status

Playable demo. Core FPS mechanics, all five heroes, three modes, and three maps
are implemented and wired end-to-end. Bots use a deliberately beatable AI so the
demo is approachable.

## License

MIT — original IP, procedural assets only.
