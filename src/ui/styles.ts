// Injected once at boot. All UI is a DOM overlay above the canvas.
export const UI_CSS = `
.rl-screen { position: fixed; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 18px; z-index: 20;
  background: radial-gradient(circle at 50% 30%, #0c1530, #05070d 70%); }
.rl-title { font-size: 72px; font-weight: 800; letter-spacing: 8px;
  background: linear-gradient(90deg,#38e8ff,#7c5bff); -webkit-background-clip: text;
  background-clip: text; color: transparent; text-shadow: 0 0 40px rgba(56,232,255,.25); }
.rl-sub { color:#8aa0c8; margin-top:-10px; letter-spacing:3px; font-size:13px; text-transform:uppercase; }
.rl-row { display:flex; gap:14px; flex-wrap:wrap; justify-content:center; max-width: 880px; }
.rl-btn { background:#121a2e; border:1px solid #28406a; color:#dce8ff; padding:14px 26px;
  border-radius:10px; font-size:16px; cursor:pointer; transition:.15s; min-width:170px; }
.rl-btn:hover { background:#1b2a4a; border-color:#38e8ff; transform:translateY(-2px); }
.rl-btn.small { padding:8px 16px; min-width:auto; font-size:13px; }
.rl-panel { background:rgba(10,16,30,.85); border:1px solid #223052; border-radius:14px;
  padding:24px 30px; max-width:760px; }
.rl-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
.rl-card { background:#101829; border:1px solid #243a60; border-radius:12px; padding:16px;
  cursor:pointer; transition:.15s; text-align:left; }
.rl-card:hover { border-color:#38e8ff; transform:translateY(-3px); background:#142039; }
.rl-card h3 { font-size:20px; margin-bottom:4px; }
.rl-card .role { font-size:11px; text-transform:uppercase; letter-spacing:2px; }
.rl-card .kit { color:#9fb2d6; font-size:12px; margin-top:8px; line-height:1.4; }
.rl-card .hp { font-size:12px; color:#cfe; margin-top:6px; }
.role-anchor { color:#ffb347; } .role-striker { color:#ff5470; } .role-mender { color:#7cffb2; }

/* HUD */
#hud { position:fixed; inset:0; pointer-events:none; z-index:10; font-size:14px; }
#crosshair { position:absolute; left:50%; top:50%; width:22px; height:22px;
  transform:translate(-50%,-50%); }
#crosshair .c { position:absolute; background:#dfefff; }
#crosshair .h { left:0; top:50%; width:100%; height:2px; transform:translateY(-50%); opacity:.85; }
#crosshair .v { top:0; left:50%; height:100%; width:2px; transform:translateX(-50%); opacity:.85; }
#hitmarker { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%) rotate(45deg);
  width:18px; height:18px; opacity:0; }
#hitmarker.show { opacity:1; transition:none; }
#hitmarker.fade { opacity:0; transition:opacity .25s; }
#hitmarker .m { position:absolute; background:#fff; }
#hitmarker.kill .m { background:#ff5470; }
#vignette { position:absolute; inset:0; box-shadow: inset 0 0 200px rgba(255,40,60,0); transition:.2s; }
#bottomleft { position:absolute; left:24px; bottom:22px; }
.bar { width:280px; height:14px; background:#0a0f1a; border:1px solid #2a3a5a; border-radius:7px;
  overflow:hidden; margin-top:6px; position:relative; display:flex; }
.bar .seg { height:100%; }
.bar .hpseg { background:linear-gradient(90deg,#36d97b,#7cffb2); }
.bar .arseg { background:linear-gradient(90deg,#ffb347,#ffd27a); }
.bar .shseg { background:linear-gradient(90deg,#39a0ff,#8fd0ff); }
.statline { color:#cfe0ff; font-weight:600; }
#abilities { position:absolute; right:24px; bottom:22px; display:flex; gap:12px; align-items:flex-end; }
.ability { width:62px; height:62px; background:#0d1526; border:1px solid #2a3a5a; border-radius:10px;
  position:relative; overflow:hidden; text-align:center; }
.ability .key { position:absolute; top:3px; left:0; right:0; font-size:11px; color:#8aa0c8; }
.ability .nm { position:absolute; bottom:4px; left:0; right:0; font-size:10px; color:#cfe0ff; }
.ability .cd { position:absolute; inset:0; background:rgba(5,8,15,.78); display:flex;
  align-items:center; justify-content:center; font-size:18px; font-weight:700; color:#fff; }
.ability.ready { border-color:#38e8ff; box-shadow:0 0 12px rgba(56,232,255,.35); }
.ability.ult { width:72px; height:72px; }
.ability.ult.charged { border-color:#ffd23f; box-shadow:0 0 18px rgba(255,210,63,.55); }
#ammo { position:absolute; right:24px; bottom:104px; font-size:26px; font-weight:700; color:#dce8ff; text-align:right; }
#ammo small { font-size:14px; color:#8aa0c8; }
#objective { position:absolute; top:18px; left:50%; transform:translateX(-50%); text-align:center;
  color:#dce8ff; letter-spacing:1px; }
#objective .obj { font-weight:700; } #objective .scr { color:#9fb2d6; font-size:13px; margin-top:2px; }
#killfeed { position:absolute; top:18px; right:24px; text-align:right; }
#killfeed div { background:rgba(10,16,30,.7); padding:4px 10px; border-radius:6px; margin-bottom:5px;
  font-size:13px; color:#dce8ff; }
#respawn { position:absolute; left:50%; top:45%; transform:translate(-50%,-50%); text-align:center;
  color:#fff; font-size:24px; display:none; }
#respawn .big { font-size:64px; font-weight:800; color:#ff5470; }
#training { position:absolute; left:24px; bottom:140px; display:flex; gap:8px; pointer-events:auto; flex-wrap:wrap; max-width:320px;}
#training .rl-btn { background:#101829; }
#training .rl-btn.on { background:#1d3a2a; border-color:#7cffb2; color:#bfffd9; }
#scoreboard { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
  background:rgba(8,12,22,.94); border:1px solid #28406a; border-radius:12px; padding:20px 26px;
  display:none; min-width:360px; }
#scoreboard table { width:100%; border-collapse:collapse; color:#dce8ff; }
#scoreboard td,#scoreboard th { padding:6px 12px; text-align:left; border-bottom:1px solid #1c2840; font-size:14px; }
.muted { color:#7e91b5; font-size:13px; }
kbd { background:#1a2742; border:1px solid #2c4068; border-radius:5px; padding:2px 7px; font-size:12px; }
table.controls td { padding:6px 14px; color:#cfe0ff; }

/* Hero gallery */
.gallery { position:fixed; inset:0; z-index:30; background:#070a12; }
.gallery-canvas { position:absolute; inset:0; z-index:1; display:block; cursor:grab; touch-action:none; }
.gallery-canvas:active { cursor:grabbing; }
.gallery-title { position:absolute; top:20px; left:50%; transform:translateX(-50%); z-index:2; text-align:center; pointer-events:none; }
.gallery-title span { font-size:34px; font-weight:800; letter-spacing:8px;
  background:linear-gradient(90deg,#38e8ff,#7c5bff); -webkit-background-clip:text; background-clip:text; color:transparent; }
.gallery-hint { color:#7e91b5; font-size:12px; letter-spacing:2px; margin-top:4px; text-transform:uppercase; }
.gallery-list { position:absolute; left:22px; top:50%; transform:translateY(-50%); z-index:2;
  display:flex; flex-direction:column; gap:8px; width:196px; max-height:80vh; overflow-y:auto; }
.gallery-rolehead { font-size:11px; text-transform:uppercase; letter-spacing:3px; margin-top:10px; opacity:.85; }
.gallery-rolehead:first-child { margin-top:0; }
.gallery-hero { display:flex; flex-direction:column; align-items:flex-start; text-align:left;
  background:#0e1626; border:1px solid #243a60; border-left-width:4px; border-radius:8px;
  padding:9px 12px; cursor:pointer; transition:.12s; color:#dce8ff; }
.gallery-hero:hover { background:#152138; transform:translateX(3px); }
.gallery-hero.active { background:#16243f; border-color:#38e8ff; box-shadow:0 0 14px rgba(56,232,255,.3); }
.gallery-hero .gh-name { font-size:15px; font-weight:700; }
.gallery-hero .gh-role { font-size:10px; text-transform:uppercase; letter-spacing:2px; opacity:.8; }
.gallery-hero.role-anchor { border-left-color:#ffb347; }
.gallery-hero.role-striker { border-left-color:#ff5470; }
.gallery-hero.role-mender { border-left-color:#7cffb2; }
.gallery-info { position:absolute; right:22px; top:50%; transform:translateY(-50%); z-index:2;
  width:330px; max-height:82vh; overflow-y:auto; background:rgba(10,16,30,.72); backdrop-filter:blur(6px);
  border:1px solid #223052; border-radius:14px; padding:20px 22px; }
.gi-name { font-size:28px; font-weight:800; letter-spacing:1px; }
.gi-role { font-size:12px; text-transform:uppercase; letter-spacing:3px; margin-top:2px; }
.gi-hp { color:#cfe0ff; font-size:14px; margin-top:10px; font-weight:600; }
.gi-summary { color:#9fb2d6; font-size:13px; line-height:1.45; margin-top:8px; }
.gi-row { display:flex; gap:10px; margin-top:12px; align-items:flex-start; }
.gi-key { flex:0 0 64px; font-size:11px; font-weight:700; color:#8aa0c8; background:#16203a;
  border:1px solid #2a3a5a; border-radius:5px; padding:3px 0; text-align:center; letter-spacing:1px; }
.gi-ab { color:#cfe0ff; font-size:13px; line-height:1.45; }
.gi-ab b { color:#eaf2ff; }
.gi-ab.ult b { color:#ffd23f; }
.gi-passive { margin-top:14px; font-size:12px; color:#7e91b5; border-top:1px solid #1c2840; padding-top:10px; }
.gallery-bar { position:absolute; bottom:26px; left:50%; transform:translateX(-50%); z-index:2; display:flex; gap:12px; }
.gallery-action.primary { background:linear-gradient(90deg,#1a3a5a,#123a52); border-color:#38e8ff; color:#eafcff; }
.gallery-action.ghost { background:#121a2e; }
`;
