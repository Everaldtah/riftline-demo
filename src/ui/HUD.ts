import { config } from "../data/config";
import type { Hero } from "../heroes/Hero";

// DOM overlay HUD, updated each frame from the player Hero.
export class HUD {
  readonly root: HTMLDivElement;
  private hitmarker: HTMLDivElement;
  private killfeed: HTMLDivElement;
  private respawn: HTMLDivElement;
  private training: HTMLDivElement;
  private scoreboard: HTMLDivElement;
  private hitTimer = 0;

  constructor() {
    this.root = document.createElement("div");
    this.root.id = "hud";
    this.root.innerHTML = `
      <div id="crosshair"><div class="c h"></div><div class="c v"></div></div>
      <div id="hitmarker">
        <div class="m" style="left:0;top:48%;width:100%;height:3px"></div>
        <div class="m" style="top:0;left:48%;height:100%;width:3px"></div>
      </div>
      <div id="vignette"></div>
      <div id="objective"><div class="obj"></div><div class="scr"></div></div>
      <div id="killfeed"></div>
      <div id="bottomleft">
        <div class="statline"></div>
        <div class="bar"><div class="seg hpseg"></div><div class="seg arseg"></div><div class="seg shseg"></div></div>
      </div>
      <div id="ammo"></div>
      <div id="abilities">
        <div class="ability a1"><div class="key">SHIFT</div><div class="nm"></div><div class="cd"></div></div>
        <div class="ability a2"><div class="key">E</div><div class="nm"></div><div class="cd"></div></div>
        <div class="ability ult"><div class="key">Q</div><div class="nm">ULT</div><div class="cd"></div></div>
      </div>
      <div id="respawn"><div>You were eliminated</div><div class="big">0</div></div>
      <div id="training"></div>
      <div id="scoreboard"></div>`;
    this.hitmarker = this.q("#hitmarker");
    this.killfeed = this.q("#killfeed");
    this.respawn = this.q("#respawn");
    this.training = this.q("#training");
    this.scoreboard = this.q("#scoreboard");
  }

  private q<T extends HTMLElement>(sel: string): T {
    return this.root.querySelector(sel) as T;
  }

  mount(parent: HTMLElement): void { parent.appendChild(this.root); }
  unmount(): void { this.root.remove(); }

  update(p: Hero, objective: string, score: string, dt: number): void {
    const h = p.health;
    const max = h.totalMax;
    this.q(".hpseg").style.width = `${(h.health / max) * 100}%`;
    this.q(".arseg").style.width = `${(h.armor / max) * 100}%`;
    this.q(".shseg").style.width = `${(h.shield / max) * 100}%`;
    this.q(".statline").textContent =
      `${p.data.name}  ·  ${Math.ceil(h.health)}${h.armor > 0 ? " +" + Math.ceil(h.armor) + "a" : ""}${h.shield > 0 ? " +" + Math.ceil(h.shield) + "s" : ""}`;

    // ammo
    const prim = p.data.primary;
    const ammoEl = this.q("#ammo");
    if (prim.ammo > 0) {
      ammoEl.innerHTML = p.reloadTimer > 0 ? `<small>RELOADING…</small>` : `${p.ammo}<small> / ${prim.ammo}</small>`;
    } else ammoEl.innerHTML = `<small>∞</small>`;

    this.ability(".a1", p.ability1.def.name, p.ability1.cdRemaining, p.ability1.ready, p.ability1.charges, p.ability1.maxCharges);
    this.ability(".a2", p.ability2.def.name, p.ability2.cdRemaining, p.ability2.ready, p.ability2.charges, p.ability2.maxCharges);

    const ultEl = this.q<HTMLDivElement>(".ult");
    const pct = Math.floor((p.ultCharge / config.combat.ultCost) * 100);
    ultEl.classList.toggle("charged", p.ultReady);
    (ultEl.querySelector(".cd") as HTMLDivElement).textContent = p.ultReady ? "READY" : `${pct}%`;
    (ultEl.querySelector(".cd") as HTMLDivElement).style.fontSize = p.ultReady ? "13px" : "16px";

    this.q(".obj").textContent = objective;
    this.q(".scr").textContent = score;

    // low-health vignette
    const frac = h.health / h.maxHealth;
    const v = frac < 0.4 ? (0.4 - frac) / 0.4 : 0;
    this.q("#vignette").style.boxShadow = `inset 0 0 200px rgba(255,40,60,${(v * 0.8).toFixed(2)})`;

    // hitmarker fade
    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0) { this.hitmarker.classList.remove("show"); this.hitmarker.classList.add("fade"); }
    }
  }

  private ability(sel: string, name: string, cd: number, ready: boolean, charges: number, maxCharges: number): void {
    const el = this.q<HTMLDivElement>(sel);
    el.classList.toggle("ready", ready);
    (el.querySelector(".nm") as HTMLDivElement).textContent = name;
    const cdEl = el.querySelector(".cd") as HTMLDivElement;
    if (maxCharges > 1) {
      cdEl.textContent = charges > 0 ? `${charges}` : `${Math.ceil(cd)}`;
      cdEl.style.background = charges > 0 ? "transparent" : "rgba(5,8,15,.78)";
    } else {
      cdEl.textContent = ready ? "" : `${Math.ceil(cd)}`;
      cdEl.style.background = ready ? "transparent" : "rgba(5,8,15,.78)";
    }
  }

  flashHitmarker(killed: boolean): void {
    this.hitmarker.classList.remove("fade");
    this.hitmarker.classList.add("show");
    this.hitmarker.classList.toggle("kill", killed);
    this.hitTimer = killed ? 0.4 : 0.12;
  }

  pushKill(text: string): void {
    const d = document.createElement("div");
    d.textContent = text;
    this.killfeed.prepend(d);
    while (this.killfeed.children.length > 5) this.killfeed.lastChild!.remove();
    setTimeout(() => d.remove(), 4500);
  }

  setRespawn(seconds: number | null): void {
    if (seconds === null) { this.respawn.style.display = "none"; return; }
    this.respawn.style.display = "block";
    (this.respawn.querySelector(".big") as HTMLDivElement).textContent = `${Math.ceil(seconds)}`;
  }

  buildTrainingPanel(flags: Record<string, boolean>, labels: Record<string, string>, onToggle: (k: string) => void): void {
    this.training.innerHTML = "";
    for (const key of Object.keys(labels)) {
      const b = document.createElement("button");
      b.className = "rl-btn small" + (flags[key] ? " on" : "");
      b.textContent = labels[key];
      b.onclick = () => { onToggle(key); b.classList.toggle("on", flags[key]); };
      this.training.appendChild(b);
    }
  }
  clearTrainingPanel(): void { this.training.innerHTML = ""; }

  showScoreboard(rows: { name: string; kills: number; deaths: number; team: number }[] | null): void {
    if (!rows) { this.scoreboard.style.display = "none"; return; }
    rows.sort((a, b) => b.kills - a.kills);
    this.scoreboard.style.display = "block";
    this.scoreboard.innerHTML =
      `<table><tr><th>Player</th><th>Team</th><th>K</th><th>D</th></tr>` +
      rows.map((r) => `<tr><td>${r.name}</td><td>${r.team}</td><td>${r.kills}</td><td>${r.deaths}</td></tr>`).join("") +
      `</table>`;
  }
}
