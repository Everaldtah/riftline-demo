// Fixed-timestep accumulator. Keeps simulation deterministic and decoupled
// from render rate; exposes an interpolation alpha for smooth rendering.
import { config } from "../data/config";

export class Clock {
  private last = performance.now() / 1000;
  private acc = 0;
  readonly step = 1 / config.sim.hz;
  alpha = 0;

  // Calls `sim(dt)` zero or more times for elapsed fixed steps.
  tick(sim: (dt: number) => void): void {
    const now = performance.now() / 1000;
    let frame = now - this.last;
    this.last = now;
    if (frame > 0.25) frame = 0.25; // avoid spiral of death after tab-out
    this.acc += frame;
    let steps = 0;
    while (this.acc >= this.step && steps < config.sim.maxSubSteps) {
      sim(this.step);
      this.acc -= this.step;
      steps++;
    }
    if (steps === config.sim.maxSubSteps) this.acc = 0; // drop backlog
    this.alpha = this.acc / this.step;
  }
}
