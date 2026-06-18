// Generic free-list pool. Avoids per-frame allocation in hot paths
// (projectiles, damage numbers, particle effects).
export class ObjectPool<T> {
  private free: T[] = [];
  private active: T[] = [];

  constructor(private factory: () => T, prewarm = 0) {
    for (let i = 0; i < prewarm; i++) this.free.push(factory());
  }

  acquire(): T {
    const obj = this.free.pop() ?? this.factory();
    this.active.push(obj);
    return obj;
  }

  release(obj: T): void {
    const i = this.active.indexOf(obj);
    if (i >= 0) {
      this.active.splice(i, 1);
      this.free.push(obj);
    }
  }

  get actives(): readonly T[] {
    return this.active;
  }

  // Iterate active items, releasing any for which `fn` returns true (dead).
  sweep(fn: (obj: T) => boolean): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const o = this.active[i];
      if (fn(o)) {
        this.active.splice(i, 1);
        this.free.push(o);
      }
    }
  }
}
