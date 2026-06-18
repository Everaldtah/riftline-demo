import * as THREE from "three";
import { Renderer } from "./Renderer";
import { Clock } from "./Clock";
import { Input } from "./Input";
import { Physics } from "./Physics";
import { Match } from "./Match";
import type { GameMode, MatchResult } from "../modes/GameMode";
import { TrainingGround } from "../modes/TrainingGround";
import { Deathmatch } from "../modes/Deathmatch";
import { ControlPoint } from "../modes/ControlPoint";
import type { Environment } from "../environments/Environment";
import { TrainingArena } from "../environments/TrainingArena";
import { RiftPlaza } from "../environments/RiftPlaza";
import { Skybridge } from "../environments/Skybridge";
import { HUD } from "../ui/HUD";
import { Menu, type MenuChoice } from "../ui/Menu";
import { HeroGallery } from "../ui/HeroGallery";
import { config } from "../data/config";

type Phase = "menu" | "gallery" | "match" | "paused" | "results";

function makeEnv(id: MenuChoice["envId"], scene: THREE.Scene, physics: Physics): Environment {
  if (id === "training") return new TrainingArena(scene, physics);
  if (id === "plaza") return new RiftPlaza(scene, physics);
  return new Skybridge(scene, physics);
}

function makeMode(id: MenuChoice["modeId"]): GameMode {
  if (id === "training") return new TrainingGround();
  if (id === "dm") return new Deathmatch();
  return new ControlPoint();
}

// Top-level controller: owns the renderer/input/clock and drives the
// MENU → HEROSELECT → MATCH → PAUSED → RESULTS state machine. A fresh Scene,
// Physics, Environment and Match are built for each match and torn down on exit.
export class Game {
  private readonly renderer: Renderer;
  private readonly clock = new Clock();
  private readonly input: Input;
  private readonly hud = new HUD();
  private readonly menu = new Menu();
  private gallery: HeroGallery | null = null;
  private galleryReturn: () => void = () => {};
  private readonly app: HTMLElement;
  private readonly fpsEl: HTMLDivElement;

  private phase: Phase = "menu";

  private scene: THREE.Scene | null = null;
  private match: Match | null = null;

  private fpsFrames = 0;
  private fpsLast = performance.now();

  constructor(app: HTMLElement) {
    this.app = app;
    this.renderer = new Renderer(app);
    this.input = new Input(this.renderer.domElement);
    this.fpsEl = this.makeFpsEl();
    app.appendChild(this.fpsEl);

    this.input.onPause = () => this.togglePause();
    this.renderer.domElement.addEventListener("click", () => {
      if (this.phase === "match") this.input.requestLock();
    });
    window.addEventListener("resize", () => this.onResize());

    this.showMenu();
    requestAnimationFrame(this.loop);
  }

  private makeFpsEl(): HTMLDivElement {
    const el = document.createElement("div");
    el.style.cssText =
      "position:fixed;top:8px;left:10px;z-index:15;font:600 12px/1 'Segoe UI',monospace;" +
      "color:#7fb6ff;background:rgba(5,8,15,.5);padding:4px 8px;border-radius:6px;" +
      "pointer-events:none;letter-spacing:1px";
    el.textContent = "— fps";
    return el;
  }

  // ---- state transitions --------------------------------------------------

  private showMenu(): void {
    this.menu.onStartProxy = (c) => this.onChooseMode(c);
    this.menu.onHeroesProxy = () => this.openGalleryBrowse();
    this.menu.showMain(this.app, (c) => this.onChooseMode(c), () => this.openGalleryBrowse());
  }

  private onChooseMode(c: MenuChoice): void {
    this.menu.hide();
    this.openGallerySelect(c);
  }

  // ---- hero gallery -------------------------------------------------------

  // Browse from the main menu: view-only, returns to the menu.
  private openGalleryBrowse(): void {
    this.phase = "gallery";
    this.galleryReturn = () => this.backToMenu();
    this.gallery = new HeroGallery({ mode: "browse", onClose: () => this.closeGallery() });
    this.gallery.open(this.app);
  }

  // After picking a mode: choose a hero, then launch the match.
  private openGallerySelect(c: MenuChoice): void {
    this.phase = "gallery";
    this.galleryReturn = () => this.backToMenu();
    this.gallery = new HeroGallery({
      mode: "select",
      onSelect: (id) => {
        this.disposeGallery();
        this.startMatch(c, id);
      },
      onClose: () => this.closeGallery(),
    });
    this.gallery.open(this.app);
  }

  // Mid-Training (H): swap the live hero, keeping position + ult charge.
  private openGallerySwitch(): void {
    if (!this.match) return;
    this.input.releaseLock();
    this.phase = "gallery";
    this.galleryReturn = () => {
      this.phase = "match";
      this.input.requestLock();
    };
    const resume = (): void => {
      this.disposeGallery();
      this.phase = "match";
      this.input.requestLock();
    };
    this.gallery = new HeroGallery({
      mode: "switch",
      initialHeroId: this.match.player.data.id,
      onSelect: (id) => {
        this.match!.changeHero(id);
        resume();
      },
      onClose: () => this.closeGallery(),
    });
    this.gallery.open(this.app);
  }

  // Cancel/Back/Esc: tear down the gallery, then run the context's return path.
  private closeGallery(): void {
    const ret = this.galleryReturn;
    this.disposeGallery();
    ret();
  }

  private disposeGallery(): void {
    this.gallery?.close();
    this.gallery = null;
  }

  private startMatch(c: MenuChoice, heroId: string): void {
    this.teardownMatch();

    const scene = new THREE.Scene();
    const physics = new Physics();
    const env = makeEnv(c.envId, scene, physics);
    env.build();

    this.addSky(scene, env.skyTop, env.skyBottom);
    this.addLights(scene);
    scene.fog = new THREE.Fog(env.fogColor, 45, 190);

    this.hud.mount(this.app);
    this.scene = scene;
    this.match = new Match(
      scene,
      physics,
      env,
      makeMode(c.modeId),
      heroId,
      this.hud,
      this.input,
      (r) => this.onMatchEnd(r),
    );
    this.phase = "match";
    this.clock.alpha = 0;
    this.input.requestLock();
  }

  private onMatchEnd(result: MatchResult): void {
    this.phase = "results";
    this.input.releaseLock();
    this.menu.showResult(this.app, result, () => this.backToMenu());
  }

  private backToMenu(): void {
    this.phase = "menu";
    this.teardownMatch();
    this.showMenu();
  }

  private togglePause(): void {
    if (this.phase === "gallery") {
      this.closeGallery();
      return;
    }
    if (this.phase === "match") {
      this.phase = "paused";
      this.input.releaseLock();
      this.menu.showPause(this.app, () => this.resume(), () => this.backToMenu());
    } else if (this.phase === "paused") {
      this.resume();
    }
  }

  private resume(): void {
    if (this.phase !== "paused") return;
    this.phase = "match";
    this.menu.hide();
    this.input.requestLock();
  }

  private teardownMatch(): void {
    this.disposeGallery();
    this.match?.dispose();
    this.match = null;
    this.hud.unmount();
    if (this.scene) {
      this.disposeScene(this.scene);
      this.scene = null;
    }
  }

  // ---- scene dressing -----------------------------------------------------

  private addSky(scene: THREE.Scene, top: number, bottom: number): void {
    const geo = new THREE.SphereGeometry(400, 24, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(top) },
        bottom: { value: new THREE.Color(bottom) },
      },
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 bottom;
        void main(){ float h = clamp(normalize(vP).y * 0.5 + 0.5, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, smoothstep(0.0, 1.0, h)), 1.0); }`,
    });
    scene.add(new THREE.Mesh(geo, mat));
  }

  private addLights(scene: THREE.Scene): void {
    scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x202830, 0.85));
    const dir = new THREE.DirectionalLight(0xffffff, 1.15);
    dir.position.set(34, 54, 22);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 220;
    dir.shadow.camera.left = -70;
    dir.shadow.camera.right = 70;
    dir.shadow.camera.top = 70;
    dir.shadow.camera.bottom = -70;
    dir.shadow.bias = -0.0004;
    scene.add(dir);
    scene.add(new THREE.AmbientLight(0x404a60, 0.5));
  }

  // ---- main loop ----------------------------------------------------------

  private loop = (): void => {
    requestAnimationFrame(this.loop);
    const scene = this.scene;
    const match = this.match;

    if (this.phase === "match" && match && scene) {
      this.clock.tick((dt) => match.step(dt));
      match.syncView();
      match.postFrame(this.input);
      this.renderer.render(scene, match.camera);
      // Training-only: H opens the live hero-swap gallery.
      if (match.isTraining && this.input.pressed(config.keys.heroGallery)) {
        this.openGallerySwitch();
      }
    } else if ((this.phase === "paused" || this.phase === "results") && scene && match) {
      // paused / results: hold the last frame behind the overlay
      match.syncView();
      this.renderer.render(scene, match.camera);
    }
    this.input.endFrame();
    this.updateFps();
  };

  private onResize(): void {
    this.renderer.three.setSize(window.innerWidth, window.innerHeight);
    const cam = this.match?.camera;
    if (cam) {
      cam.aspect = window.innerWidth / window.innerHeight;
      cam.updateProjectionMatrix();
    }
  }

  private updateFps(): void {
    this.fpsFrames++;
    const now = performance.now();
    const dt = now - this.fpsLast;
    if (dt >= 500) {
      this.fpsEl.textContent = `${Math.round((this.fpsFrames * 1000) / dt)} fps`;
      this.fpsFrames = 0;
      this.fpsLast = now;
    }
  }

  private disposeScene(scene: THREE.Scene): void {
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const sm = m as THREE.ShaderMaterial;
          if (sm.uniforms) {
            for (const u of Object.values(sm.uniforms)) {
              const v = (u as { value?: { dispose?: () => void } }).value;
              v?.dispose?.();
            }
          }
          m.dispose();
        }
      }
    });
  }
}
