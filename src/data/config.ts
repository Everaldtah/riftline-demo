// Global tuning. Every magic number in gameplay logic should live here or in heroes.ts.

export const config = {
  sim: {
    hz: 60, // fixed simulation timestep
    maxSubSteps: 5,
  },
  world: {
    gravity: 24, // m/s^2 (snappier than real gravity for shooter feel)
    eyeHeight: 1.7,
    playerRadius: 0.4,
    playerHeight: 1.8,
  },
  move: {
    walkSpeed: 6.0, // base; per-hero scalar multiplies this
    sprintMult: 1.0, // sprint disabled by default (set >1 to enable)
    airControl: 0.35,
    accel: 60,
    friction: 10,
    jumpSpeed: 9.0,
  },
  look: {
    sensitivity: 0.0022,
    maxPitch: (89 * Math.PI) / 180,
  },
  combat: {
    ultCost: 1500, // charge points to fill an ultimate
    shieldRegenDelay: 4.0, // seconds without damage before shield regenerates
    shieldRegenRate: 30, // shield points / second
    armorReductionPerHit: 5, // flat reduction applied to each hit, capped at half the damage
    headshotMultiplierDefault: 2.0,
    respawnTime: 4.0,
    deathCamTime: 1.2,
  },
  bots: {
    // single difficulty knob; 0 = easy, 1 = hard
    difficulty: 0.45,
    // derived behavior is interpolated from these endpoints
    reactionTime: { easy: 0.55, hard: 0.12 }, // seconds before reacting
    aimError: { easy: 0.12, hard: 0.02 }, // radians of random aim spread
    fireRateScalar: { easy: 0.6, hard: 1.0 },
    sightRange: 60,
    retreatHealthFrac: 0.3,
  },
  keys: {
    forward: ["KeyW"],
    back: ["KeyS"],
    left: ["KeyA"],
    right: ["KeyD"],
    jump: ["Space"],
    ability1: ["ShiftLeft", "ShiftRight"],
    ability2: ["KeyE"],
    ultimate: ["KeyQ"],
    reload: ["KeyR"],
    scoreboard: ["Tab"],
    pause: ["Escape"],
  },
} as const;

export type Config = typeof config;

// Interpolate a bot tuning value from the difficulty knob.
export function botLerp(easy: number, hard: number): number {
  return easy + (hard - easy) * config.bots.difficulty;
}
