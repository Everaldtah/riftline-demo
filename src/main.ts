import { UI_CSS } from "./ui/styles";
import { Game } from "./engine/Game";

// Inject the shared UI stylesheet once, then boot the game on #app.
const style = document.createElement("style");
style.textContent = UI_CSS;
document.head.appendChild(style);

const app = document.getElementById("app");
if (!app) throw new Error("RIFTLINE: #app root element not found");
new Game(app);
