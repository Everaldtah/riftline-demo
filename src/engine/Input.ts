import { config } from "../data/config";

// Central input state: held keys, mouse buttons, accumulated mouse delta,
// and pointer-lock management. Bindings come from config.keys.
export class Input {
  private held = new Set<string>();
  private pressedThisFrame = new Set<string>();
  mouse = { left: false, right: false, dx: 0, dy: 0 };
  private mousePressed = { left: false, right: false };
  locked = false;
  onPause: (() => void) | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      this.held.add(e.code);
      this.pressedThisFrame.add(e.code);
      if ((config.keys.pause as readonly string[]).includes(e.code)) this.onPause?.();
      if (e.code === "Tab") e.preventDefault();
    });
    window.addEventListener("keyup", (e) => this.held.delete(e.code));

    canvas.addEventListener("mousedown", (e) => {
      if (!this.locked) return;
      if (e.button === 0) { this.mouse.left = true; this.mousePressed.left = true; }
      if (e.button === 2) { this.mouse.right = true; this.mousePressed.right = true; }
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.mouse.dx += e.movementX;
      this.mouse.dy += e.movementY;
    });
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.canvas;
    });
  }

  requestLock(): void {
    if (!this.locked) this.canvas.requestPointerLock();
  }
  releaseLock(): void {
    if (this.locked) document.exitPointerLock();
  }

  private any(codes: readonly string[], set: Set<string>): boolean {
    for (const c of codes) if (set.has(c)) return true;
    return false;
  }

  down(codes: readonly string[]): boolean { return this.any(codes, this.held); }
  pressed(codes: readonly string[]): boolean { return this.any(codes, this.pressedThisFrame); }

  leftPressed(): boolean { return this.mousePressed.left; }
  rightPressed(): boolean { return this.mousePressed.right; }

  // Call once per frame AFTER systems have read edge-triggered state.
  endFrame(): void {
    this.pressedThisFrame.clear();
    this.mousePressed.left = false;
    this.mousePressed.right = false;
    this.mouse.dx = 0;
    this.mouse.dy = 0;
  }
}
