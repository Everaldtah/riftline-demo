import type { MatchResult } from "../modes/GameMode";

export interface MenuChoice {
  modeId: "training" | "dm" | "cp";
  envId: "training" | "plaza" | "skybridge";
  label: string;
}

const CHOICES: MenuChoice[] = [
  { modeId: "training", envId: "training", label: "Training Ground" },
  { modeId: "dm", envId: "plaza", label: "Deathmatch · Rift Plaza" },
  { modeId: "dm", envId: "skybridge", label: "Deathmatch · Skybridge" },
  { modeId: "cp", envId: "plaza", label: "Control Point · Rift Plaza" },
];

// Main menu, controls help, and the end-of-match results screen.
export class Menu {
  private el: HTMLDivElement | null = null;

  showMain(parent: HTMLElement, onStart: (c: MenuChoice) => void, onHeroes?: () => void): void {
    this.render(parent, (root) => {
      root.innerHTML = `
        <div class="rl-title">RIFTLINE</div>
        <div class="rl-sub">First-person hero shooter · demo</div>
        <div class="rl-row" style="margin-top:14px"></div>
        <button class="rl-btn small" id="heroesBtn" style="margin-top:8px">Heroes</button>
        <button class="rl-btn small" id="controlsBtn" style="margin-top:8px">Controls / Help</button>
        <div class="muted" style="margin-top:18px;max-width:520px;text-align:center">
          Click to lock the mouse and play. Original IP — all geometry is procedural, no external assets.
        </div>`;
      const row = root.querySelector(".rl-row") as HTMLDivElement;
      for (const c of CHOICES) {
        const b = document.createElement("button");
        b.className = "rl-btn";
        b.textContent = c.label;
        b.onclick = () => onStart(c);
        row.appendChild(b);
      }
      const hb = root.querySelector("#heroesBtn") as HTMLButtonElement;
      hb.onclick = () => onHeroes?.();
      (root.querySelector("#controlsBtn") as HTMLButtonElement).onclick = () => this.showControls(parent);
    });
  }

  showControls(parent: HTMLElement): void {
    this.render(parent, (root) => {
      root.innerHTML = `
        <div class="rl-panel">
          <h2 style="margin-bottom:14px">Controls</h2>
          <table class="controls">
            <tr><td><kbd>W A S D</kbd></td><td>Move</td><td><kbd>Mouse</kbd></td><td>Look</td></tr>
            <tr><td><kbd>Space</kbd></td><td>Jump</td><td><kbd>L-Mouse</kbd></td><td>Primary fire</td></tr>
            <tr><td><kbd>R-Mouse</kbd></td><td>Secondary / alt</td><td><kbd>Shift</kbd></td><td>Ability 1</td></tr>
            <tr><td><kbd>E</kbd></td><td>Ability 2</td><td><kbd>Q</kbd></td><td>Ultimate</td></tr>
            <tr><td><kbd>R</kbd></td><td>Reload</td><td><kbd>Tab</kbd></td><td>Scoreboard (hold)</td></tr>
            <tr><td><kbd>Esc</kbd></td><td>Pause / menu</td><td></td><td></td></tr>
          </table>
        </div>
        <button class="rl-btn small" id="back">Back</button>`;
      (root.querySelector("#back") as HTMLButtonElement).onclick = () =>
        this.showMain(parent, (c) => this.onStartProxy?.(c), () => this.onHeroesProxy?.());
    });
  }

  // allow Back from controls to reach the original start/heroes handlers
  onStartProxy: ((c: MenuChoice) => void) | null = null;
  onHeroesProxy: (() => void) | null = null;

  showPause(parent: HTMLElement, onResume: () => void, onMenu: () => void): void {
    this.render(parent, (root) => {
      root.style.background = "rgba(5,7,13,.82)";
      root.innerHTML = `
        <div class="rl-title" style="font-size:48px">PAUSED</div>
        <div class="rl-row">
          <button class="rl-btn" id="resume">Resume</button>
          <button class="rl-btn" id="menu">Main Menu</button>
        </div>`;
      (root.querySelector("#resume") as HTMLButtonElement).onclick = onResume;
      (root.querySelector("#menu") as HTMLButtonElement).onclick = onMenu;
    });
  }

  showResult(parent: HTMLElement, result: MatchResult, onContinue: () => void): void {
    this.render(parent, (root) => {
      root.innerHTML = `
        <div class="rl-title" style="color:transparent;background:linear-gradient(90deg,${result.victory ? "#7cffb2,#38e8ff" : "#ff5470,#ff8a5b"});-webkit-background-clip:text;background-clip:text">${result.title}</div>
        <div class="rl-sub">${result.subtitle}</div>
        <button class="rl-btn" id="cont" style="margin-top:16px">Continue</button>`;
      (root.querySelector("#cont") as HTMLButtonElement).onclick = onContinue;
    });
  }

  hide(): void {
    this.el?.remove();
    this.el = null;
  }

  private render(parent: HTMLElement, build: (root: HTMLDivElement) => void): void {
    this.hide();
    const root = document.createElement("div");
    root.className = "rl-screen";
    build(root);
    parent.appendChild(root);
    this.el = root;
  }
}
