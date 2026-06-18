import { HEROES, type Role } from "../data/heroes";

// Display order + labels for the three roles.
const ROLE_ORDER: Role[] = ["anchor", "striker", "mender"];
const ROLE_LABEL: Record<Role, string> = {
  anchor: "Anchor",
  striker: "Striker",
  mender: "Mender",
};

// Hero picker overlay. A 3-column grid grouped by role; clicking a card
// commits the choice via onPick, Back returns to the mode menu.
export class HeroSelect {
  private el: HTMLDivElement | null = null;

  show(parent: HTMLElement, onPick: (heroId: string) => void, onBack: () => void): void {
    this.hide();
    const root = document.createElement("div");
    root.className = "rl-screen";
    root.style.gap = "10px";

    const title = document.createElement("div");
    title.className = "rl-title";
    title.style.fontSize = "44px";
    title.textContent = "CHOOSE YOUR HERO";
    root.appendChild(title);

    const sub = document.createElement("div");
    sub.className = "rl-sub";
    sub.textContent = "Anchor · Striker · Mender";
    root.appendChild(sub);

    for (const role of ROLE_ORDER) {
      const heading = document.createElement("div");
      heading.className = `role role-${role}`;
      heading.style.cssText =
        "font-size:13px;text-transform:uppercase;letter-spacing:4px;align-self:flex-start;margin:8px 0 -2px";
      heading.textContent = ROLE_LABEL[role];
      root.appendChild(heading);

      const grid = document.createElement("div");
      grid.className = "rl-grid";
      for (const h of HEROES.filter((x) => x.role === role)) {
        const card = document.createElement("button");
        card.className = "rl-card";
        card.innerHTML =
          `<h3 style="color:#${h.accent.toString(16).padStart(6, "0")}">${h.name}</h3>` +
          `<div class="role role-${role}">${ROLE_LABEL[role]}</div>` +
          `<div class="hp">${h.maxHealth}${h.armor ? ` +${h.armor} armor` : ""}${h.shield ? ` +${h.shield} shield` : ""} HP</div>` +
          `<div class="kit">${h.summary}</div>` +
          `<div class="kit" style="margin-top:6px;color:#6f86b0">① ${h.ability1.name} · ② ${h.ability2.name} · Q ${h.ultimate.name}</div>`;
        card.onclick = () => onPick(h.id);
        grid.appendChild(card);
      }
      root.appendChild(grid);
    }

    const back = document.createElement("button");
    back.className = "rl-btn small";
    back.style.marginTop = "6px";
    back.textContent = "Back";
    back.onclick = onBack;
    root.appendChild(back);

    parent.appendChild(root);
    this.el = root;
  }

  hide(): void {
    this.el?.remove();
    this.el = null;
  }
}
