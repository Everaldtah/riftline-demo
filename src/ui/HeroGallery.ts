import * as THREE from "three";
import { HEROES, heroById, type HeroData, type Role } from "../data/heroes";
import { createHero } from "../heroes/HeroFactory";
import type { Hero } from "../heroes/Hero";

const ROLE_ORDER: Role[] = ["anchor", "striker", "mender"];
const ROLE_LABEL: Record<Role, string> = { anchor: "Anchor", striker: "Striker", mender: "Mender" };

export type GalleryMode = "browse" | "select" | "switch";

export interface GalleryOptions {
  mode: GalleryMode;
  initialHeroId?: string;
  onSelect?: (heroId: string) => void;
  onClose?: () => void;
}

// Full-screen 3D hero viewer + selector. Owns its own WebGL context, scene, and
// orbit camera so it is fully decoupled from the running match. The hero model
// is the exact in-game mesh (built via createHero) on a pedestal; drag to orbit,
// scroll to zoom. A DOM overlay lists the roster and shows the focused hero's
// full ability kit. Three modes drive the action button: browse (view only),
// select (pick to start a match), switch (swap hero mid-Training).
export class HeroGallery {
  private root: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private mannequin: Hero | null = null;
  private pedestal = new THREE.Group();
  private rafId = 0;

  private focusedId: string;
  private readonly mode: GalleryMode;
  private readonly onSelect: (heroId: string) => void;
  private readonly onClose: () => void;

  // orbit state
  private target = new THREE.Vector3(0, 0.95, 0);
  private radius = 3.6;
  private azimuth = Math.PI * 0.25;
  private polar = Math.PI * 0.42;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  constructor(opts: GalleryOptions) {
    this.mode = opts.mode;
    this.focusedId = opts.initialHeroId ?? HEROES[0].id;
    this.onSelect = opts.onSelect ?? (() => undefined);
    this.onClose = opts.onClose ?? (() => undefined);
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  }

  open(parent: HTMLElement): void {
    this.buildScene();
    this.buildDom(parent);
    this.focusHero(this.focusedId);
    this.addListeners();
    this.loop();
  }

  // ---- 3D scene -----------------------------------------------------------

  private buildScene(): void {
    this.scene.background = new THREE.Color(0x070a12);
    this.scene.fog = new THREE.Fog(0x070a12, 14, 40);

    this.scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x141822, 1.0));
    const dir = new THREE.DirectionalLight(0xffffff, 1.5);
    dir.position.set(4, 7, 5);
    this.scene.add(dir);
    this.scene.add(new THREE.AmbientLight(0x4a5570, 0.6));
    // rim light from behind for separation
    const rim = new THREE.DirectionalLight(0x38e8ff, 0.8);
    rim.position.set(-5, 3, -4);
    this.scene.add(rim);

    // pedestal
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.3, 0.18, 32),
      new THREE.MeshStandardMaterial({ color: 0x121a2e, roughness: 0.6, metalness: 0.3 }),
    );
    disc.position.y = -0.09;
    this.pedestal.add(disc);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.03, 10, 48),
      new THREE.MeshStandardMaterial({ color: 0x38e8ff, emissive: 0x38e8ff, emissiveIntensity: 1 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.0;
    this.pedestal.add(ring);
    this.scene.add(this.pedestal);

    const grid = new THREE.GridHelper(40, 40, 0x1c2840, 0x121a2e);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.4;
    grid.position.y = -0.18;
    this.scene.add(grid);
  }

  focusHero(id: string): void {
    this.focusedId = id;
    if (this.mannequin) {
      this.scene.remove(this.mannequin.group);
      this.mannequin.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mm) => mm.dispose());
        }
      });
    }
    // Non-player hero → body visible, standing on the pedestal at the origin.
    const hero = createHero(id, 0, false);
    this.mannequin = hero;
    this.scene.add(hero.group);
    this.updateInfoPanel();
    this.highlightList();
  }

  // ---- DOM overlay --------------------------------------------------------

  private listEl: HTMLDivElement | null = null;
  private infoEl: HTMLDivElement | null = null;

  private buildDom(parent: HTMLElement): void {
    const root = document.createElement("div");
    root.className = "gallery";

    const canvas = document.createElement("canvas");
    canvas.className = "gallery-canvas";
    root.appendChild(canvas);
    this.canvas = canvas;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = false;
    this.renderer = renderer;

    // title
    const title = document.createElement("div");
    title.className = "gallery-title";
    title.innerHTML = `<span>HERO GALLERY</span><div class="gallery-hint">Drag to rotate · Scroll to zoom${
      this.mode === "switch" ? " · H / Esc to cancel" : ""
    }</div>`;
    root.appendChild(title);

    // left roster
    const list = document.createElement("div");
    list.className = "gallery-list";
    for (const role of ROLE_ORDER) {
      const head = document.createElement("div");
      head.className = `role role-${role} gallery-rolehead`;
      head.textContent = ROLE_LABEL[role];
      list.appendChild(head);
      for (const h of HEROES.filter((x) => x.role === role)) {
        const b = document.createElement("button");
        b.className = `gallery-hero role-${role}`;
        b.dataset.id = h.id;
        b.innerHTML = `<span class="gh-name">${h.name}</span><span class="gh-role">${ROLE_LABEL[role]}</span>`;
        b.onclick = () => this.focusHero(h.id);
        list.appendChild(b);
      }
    }
    root.appendChild(list);
    this.listEl = list;

    // right info panel (filled by updateInfoPanel)
    const info = document.createElement("div");
    info.className = "gallery-info";
    root.appendChild(info);
    this.infoEl = info;

    // bottom action bar
    const bar = document.createElement("div");
    bar.className = "gallery-bar";
    if (this.mode === "select") {
      bar.appendChild(this.actionBtn("Select", "primary", () => this.onSelect(this.focusedId)));
    } else if (this.mode === "switch") {
      bar.appendChild(this.actionBtn("Switch Hero", "primary", () => this.onSelect(this.focusedId)));
    }
    bar.appendChild(this.actionBtn(this.mode === "switch" ? "Cancel" : "Back", "ghost", () => this.onClose()));
    root.appendChild(bar);

    parent.appendChild(root);
    this.root = root;
  }

  private actionBtn(label: string, kind: "primary" | "ghost", fn: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.className = `rl-btn gallery-action ${kind}`;
    b.textContent = label;
    b.onclick = fn;
    return b;
  }

  private updateInfoPanel(): void {
    if (!this.infoEl) return;
    const h = heroById(this.focusedId);
    const hp = `${h.maxHealth}${h.armor ? ` +${h.armor} armor` : ""}${h.shield ? ` +${h.shield} shield` : ""}`;
    const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
    this.infoEl.innerHTML = `
      <div class="gi-name" style="color:${hex(h.accent)}">${h.name}</div>
      <div class="role role-${h.role} gi-role">${h.title} · ${ROLE_LABEL[h.role]}</div>
      <div class="gi-hp">${hp} HP</div>
      <div class="gi-summary">${h.summary}</div>
      <div class="gi-row"><span class="gi-key">L-MOUSE</span><span class="gi-ab">${weaponText(h)}</span></div>
      <div class="gi-row"><span class="gi-key">SHIFT</span><span class="gi-ab"><b>${h.ability1.name}</b> — ${h.ability1.desc}</span></div>
      <div class="gi-row"><span class="gi-key">E</span><span class="gi-ab"><b>${h.ability2.name}</b> — ${h.ability2.desc}</span></div>
      <div class="gi-row"><span class="gi-key">Q</span><span class="gi-ab ult"><b>${h.ultimate.name}</b> — ${h.ultimate.desc}</span></div>
      <div class="gi-passive">Passive: ${h.passive.text}</div>`;
  }

  private highlightList(): void {
    if (!this.listEl) return;
    for (const b of Array.from(this.listEl.querySelectorAll<HTMLButtonElement>(".gallery-hero"))) {
      b.classList.toggle("active", b.dataset.id === this.focusedId);
    }
  }

  // ---- interaction --------------------------------------------------------

  private addListeners(): void {
    const c = this.canvas!;
    c.addEventListener("pointerdown", (e) => {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      this.azimuth -= (e.clientX - this.lastX) * 0.006;
      this.polar = THREE.MathUtils.clamp(this.polar - (e.clientY - this.lastY) * 0.006, 0.25, 1.45);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    c.addEventListener("pointerup", (e) => {
      this.dragging = false;
      c.releasePointerCapture(e.pointerId);
    });
    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.radius = THREE.MathUtils.clamp(this.radius + e.deltaY * 0.004, 2.2, 7);
    }, { passive: false });
    this.onResize = this.onResize.bind(this);
    window.addEventListener("resize", this.onResize);
  }

  private onResize(): void {
    if (!this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private loop = (): void => {
    this.rafId = requestAnimationFrame(this.loop);
    // gentle auto-spin while not dragging
    if (!this.dragging) this.azimuth += 0.003;
    const sp = Math.sin(this.polar);
    this.camera.position.set(
      this.target.x + this.radius * sp * Math.sin(this.azimuth),
      this.target.y + this.radius * Math.cos(this.polar),
      this.target.z + this.radius * sp * Math.cos(this.azimuth),
    );
    this.camera.lookAt(this.target);
    if (this.mannequin) this.mannequin.syncMesh();
    this.renderer?.render(this.scene, this.camera);
  };

  close(): void {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    window.removeEventListener("resize", this.onResize);
    if (this.mannequin) {
      this.scene.remove(this.mannequin.group);
      this.mannequin = null;
    }
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mm) => mm.dispose());
      }
    });
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer = null;
    this.root?.remove();
    this.root = null;
    this.canvas = null;
  }
}

function weaponText(h: HeroData): string {
  const w = h.primary;
  const kind = w.kind === "beam" ? (w.healing ? "Heal beam" : "Beam") : w.kind === "hitscan" ? "Hitscan" : w.kind === "projectile" ? "Projectile" : "Charge hitscan";
  const dmg = w.healing ? `${w.healing} HP/s` : `${w.damage} dmg`;
  return `<b>${kind}</b> — ${dmg}${h.secondary ? " (R-Mouse: dmg beam)" : ""}`;
}
