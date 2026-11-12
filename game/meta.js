// Lobby and everything around the battles: the main menu, operations, squads, operators, headhunting, base.
// DOM drawn on a fixed 1280x720 sheet that is scaled to the stage like the battle canvas.
(function () {
  "use strict";
  const TD = window.TD, B = window.TDB, ART = B.art;
  const host = document.getElementById("meta");
  const VW = 1280, VH = 720;

  // ---------- data ----------
  const RAR_COL = { 6: "#ff8a1f", 5: "#ffcf24", 4: "#c19bff", 3: "#58b6ff" };
  const MAXLV = { 3: [40, 55], 4: [45, 60, 70], 5: [50, 70, 80], 6: [50, 80, 90] };
  const PROMO = [0, 4000, 18000];   // coins to reach E1, E2
  // one entry per stage in TD.STAGES; each opens once the one before it has a star
  const STAGE_META = [
    { cost: 6, first: { orb: 1200 }, coin: 900, exp: 60, squad: 4, rec: "정예화 0 · Lv.1" },   // early stages: a small fixed squad, to learn the rules
    { cost: 6, first: { orb: 1200 }, coin: 1000, exp: 70, rec: "정예화 0 · Lv.1" },
    { cost: 8, first: { orb: 1500 }, coin: 1200, exp: 80, rec: "정예화 0 · Lv.5" },
    { cost: 8, first: { orb: 1500 }, coin: 1300, exp: 90, rec: "정예화 0 · Lv.15" },
    { cost: 10, first: { orb: 1800 }, coin: 1500, exp: 100, rec: "정예화 0 · Lv.15" },
    { cost: 10, first: { orb: 1800 }, coin: 1600, exp: 110, rec: "정예화 0 · Lv.30" },
    { cost: 12, first: { orb: 2400 }, coin: 2000, exp: 140, rec: "정예화 0 · Lv.45" },
    { cost: 3, first: { orb: 600 }, coin: 600, exp: 40, rec: "고정 편성", branch: 0,   // TR-01: a side lesson hanging under BL-01
      fixed: [["yui", 0, 30], ["ayaki", 0, 30], ["sunae", 0, 30], ["alpha", 0, 30]] },   // a fixed squad, as the original's lessons: [id, elite, level], owned or not
    { cost: 3, first: { orb: 600 }, coin: 600, exp: 40, rec: "고정 편성", branch: 4,   // TR-02: casters and slowers, under BL-05
      fixed: [["sunae", 0, 30], ["lilith", 0, 30], ["teka", 0, 30], ["ayaki", 0, 30]] },
    // chapter 2 「지옥 기계」: opens once BL-07 is cleared (in TD.STAGES it sits after the lessons, so it names what it follows)
    { ep: 2, after: "BL-07", cost: 12, first: { orb: 2400 }, coin: 2100, exp: 150, rec: "정예화 0 · Lv.45" },
    { ep: 2, cost: 12, first: { orb: 2400 }, coin: 2200, exp: 155, rec: "정예화 1 · Lv.15" },
    { ep: 2, cost: 12, first: { orb: 2400 }, coin: 2300, exp: 160, rec: "정예화 1 · Lv.20" },
    { ep: 2, cost: 15, first: { orb: 2400 }, coin: 2400, exp: 170, rec: "정예화 1 · Lv.25" },   // IM-04: Smoke turns up only after it, in the story
    { ep: 2, cost: 15, first: { orb: 3000 }, coin: 2800, exp: 190, rec: "정예화 1 · Lv.30" },
    { ep: 2, cost: 15, first: { orb: 2400 }, coin: 2600, exp: 180, rec: "정예화 1 · Lv.35" },
    { ep: 2, cost: 15, first: { orb: 2400 }, coin: 2700, exp: 185, rec: "정예화 1 · Lv.35" },
    { ep: 2, story: "IM-ST1:story", cost: 0, first: { orb: 0 }, coin: 0, exp: 0, rec: "" },   // IM-ST1: a story-only entry after the crossroads; reading it counts as clearing it, and it costs nothing
    { ep: 2, cost: 18, first: { orb: 2400 }, coin: 2800, exp: 195, rec: "정예화 1 · Lv.40" },
    { ep: 2, cost: 18, first: { orb: 2400 }, coin: 2900, exp: 200, rec: "정예화 1 · Lv.45" },
    { ep: 2, cost: 18, first: { orb: 3600 }, coin: 3400, exp: 230, rec: "정예화 1 · Lv.45" },
    { ep: 2, cost: 3, first: { orb: 600 }, coin: 600, exp: 40, rec: "고정 편성", branch: "IM-01", open: "BL-07",   // TR-03: the blizzard lesson, under IM-01, open with chapter 2
      fixed: [["tao", 0, 30], ["sunae", 0, 30], ["alpha", 0, 30], ["lilith", 0, 30], ["ayaki", 0, 30]] },
    // chapter 3 (working title 「쏘지 않은 탄환」): opens once IM-10 is cleared (in TD.STAGES it sits after TR-03, so it names what it follows)
    { ep: 3, after: "IM-10", cost: 18, first: { orb: 2400 }, coin: 3000, exp: 210, rec: "정예화 1 · Lv.50" },
    { ep: 3, cost: 18, first: { orb: 2400 }, coin: 3100, exp: 215, rec: "정예화 1 · Lv.55" },
    { ep: 3, cost: 18, first: { orb: 2400 }, coin: 3200, exp: 220, rec: "정예화 1 · Lv.60" },
    { ep: 3, cost: 18, first: { orb: 2400 }, coin: 3300, exp: 225, rec: "정예화 1 · Lv.65" },
    { ep: 3, cost: 21, first: { orb: 3000 }, coin: 3600, exp: 240, rec: "정예화 1 · Lv.70" },
    { ep: 3, story: "WL-ST:story", cost: 0, first: { orb: 0 }, coin: 0, exp: 0, rec: "" },   // WL-ST: the confessional, a story-only entry
    { ep: 3, cost: 21, first: { orb: 2400 }, coin: 3500, exp: 235, rec: "정예화 1 · Lv.70" },
    { ep: 3, story: "WL-ST2:story", cost: 0, first: { orb: 0 }, coin: 0, exp: 0, rec: "" },   // WL-ST2: the empty saddle, a story-only entry
    { ep: 3, cost: 21, first: { orb: 2400 }, coin: 3600, exp: 240, rec: "정예화 2 · Lv.1" },
    { ep: 3, cost: 24, first: { orb: 3600 }, coin: 4000, exp: 260, rec: "정예화 2 · Lv.1" },
    { ep: 3, cost: 24, first: { orb: 3600 }, coin: 4200, exp: 270, rec: "정예화 2 · Lv.1" },
    // the supply operations (자원 수집): open on their days, once the story is far enough along
    // (the same order as the supply operations in TD.STAGES)
    ...Object.keys(window.BSL_ECON.SUPPLY).flatMap((site) => Array.from({ length: window.BSL_ECON.SUPPLY[site].tiers }, (_, k) => k + 1).map((tier) => { const sm = window.BSL_ECON.SUPPLY_META(site, tier);
      return { cost: sm.cost, first: { orb: 0 }, coin: sm.coin, exp: sm.exp, rec: `정예화 ${sm.rec[0]} · Lv.${sm.rec[1]}`, supply: site, tier,
        unlockAt: sm.unlock }; })),
    // the lab (실험실): one entry per lab stage, at the very end as in TD.STAGES. Always open, free, and they give nothing; only the lab menu lists them
    ...TD.STAGES.filter((q) => q.lab).map(() => ({ ep: 0, lab: true, cost: 0, first: { orb: 0 }, coin: 0, exp: 0, rec: "" })),
  ].map((m) => { if (typeof m.branch === "string") m.branch = TD.STAGES.findIndex((q) => q.code === m.branch); return m; }).map((m, i) => Object.assign(m, { ep: m.lab ? 0 : m.ep || (m.supply ? 0 : 1), unlock: m.lab ? () => true : m.supply ? (s) => ((s.stages[m.unlockAt] || {}).stars || 0) > 0 : m.open ? (s) => ((s.stages[m.open] || {}).stars || 0) > 0 : m.branch !== undefined ? (s) => ((s.stages[TD.STAGES[m.branch].code] || {}).stars || 0) > 0
    : m.after ? (s) => ((s.stages[m.after] || {}).stars || 0) > 0
    : i === 0 ? () => true : (s) => ((s.stages[TD.STAGES[i - 1].code] || {}).stars || 0) > 0 }))
  // a stage already cleared on this save stays open whatever sits before it now (a story entry added later must not shut a stage behind it)
  .map((m, i) => { const base = m.unlock; m.unlock = (s) => base(s) || ((s.stages[TD.STAGES[i].code] || {}).stars || 0) > 0; return m; });
  // the main story's episodes: their names and their backdrops
  const EPISODES = { 1: { no: "01", t: "망자의 행진", en: "THE MARCH OF THE DEAD", art: "st_war" }, 2: { no: "02", t: "지옥 기계", en: "THE INFERNAL MACHINE", art: "st_lane" }, 3: { no: "03", t: "쏘지 않은 탄환", en: "THE UNFIRED BULLET", art: "st_parade" } };   // chapter 3: a working title and a borrowed backdrop until its own is drawn
  const epArt = (n) => ART[(EPISODES[n] || EPISODES[1]).art] || ART.st_war || ART.bg;
  const POOL = { 6: ["rabi6", "veil", "eungyeol", "smoqueen", "angelina"], 5: ["geomseon", "belina", "yui", "rabi", "piania", "silphy", "bongeun", "alpha2", "skakea2"], 4: ["falchion", "atat", "hakuren", "miho", "lulu", "irins", "alpha", "skakea", "ker", "sunae", "teka"], 3: ["brick", "jayeon", "capy", "hiro", "lilith", "ayaki", "nana", "tao"] };
  const DUMMY_OPS = new Set(["vanguard", "guard", "defender", "sniper", "caster", "medic", "supporter", "specialist"]);   /* the eight stand-ins from the first builds (로완, 카이, 브람, 세라, 이오, 미르, 노바, 제트): never offered on trial */
  const PULL = 600, STAM_EVERY = 360;
  // the archive's banners, after the original's: a standard one with no rate-up, and a pick-up whose featured six and five take half of their rarity;
  // each keeps its own pity, and on the pick-up 150 links without the featured six make the next six the featured one
  const BANNERS = {
    pick: { n: "연막과 총성", tag: "PICK UP", ko: "지정 픽업", col: "#ff8a1f", up: { 6: "smoqueen", 5: "bongeun" }, art: ["bongeun", "smoqueen"], spark: 150 },
    std: { n: "통상 링크", tag: "STANDARD", ko: "통상", col: "#7fe3ff", up: {}, art: ["angelina"] },
  };
  const NEWS = "pick";   // the banner the lobby's news board points at
  // the start link: one fixed ten (placeholders until the new operators and their scripts arrive)
  const START_FIXED = ["hiro", "lilith", "tao", "capy", "ayaki", "hakuren", "sunae", "alpha", "atat", "teka"];   // orb per pull, seconds per stamina point
  const def = (id) => TD.UNITS.find((u) => u.id === id);
  const SAVE_KEY = "bsl_save_v1";
  function freshSave() {
    const ops = {};
    ops.yui = { lvl: 1, elite: 0, pot: 1, skill: 0, got: Date.now() };
    return {
      v: 1, name: "", started: false, uid: String(Math.floor(100000 + Math.random() * 899999)), lvl: 1, exp: 0,
      res: { coin: 3000, orb: 0, ticket: 0, start: 0, stam: 82, stamAt: Date.now() },
      ops, squads: [["yui"], [], [], []], cur: 0, guide: 0, startDone: false,
      stages: {}, pity: 0, pulls: 0, newbie: 10, assistant: "yui", log: [], stv: 2,
    };
  }
  let S;
  try { S = JSON.parse(localStorage.getItem(SAVE_KEY)) || null; } catch (e) { S = null; }
  if (!S || S.v !== 1) S = freshSave();
  S.inv = S.inv || {};
  // the story entry IM-ST1 was slid in before IM-08: a save from before that moves its "last operation" index along with it, once
  if (!S.stv) { const k = TD.STAGES.findIndex((q) => q.code === "IM-ST1"); if (k >= 0 && typeof S.last === "number" && S.last >= k) S.last++; S.stv = 1; }
  // the story entry WL-ST2 was slid in before WL-07: a save from before that (version 1) moves its "last operation" index along with it, once. S.last is the only record
  // kept by stage index; clears, stars, first clears, scenes seen and the supply records are all kept by stage code and need nothing
  if (S.stv < 2) { const k = TD.STAGES.findIndex((q) => q.code === "WL-ST2"); if (k >= 0 && typeof S.last === "number" && S.last >= k) S.last++; S.stv = 2; }
  for (const id of Object.keys(S.ops)) { if (!def(id)) { delete S.ops[id]; continue; } const o = S.ops[id], mx = MAXLV[def(id).rarity]; o.elite = Math.min(o.elite, mx.length - 1); o.lvl = Math.min(o.lvl, mx[o.elite]); if (!Array.isArray(o.sm)) o.sm = [0, 0, 0]; }
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage may be off */ }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage may be off */ } }
  const stamMax = () => 80 + S.lvl * 2;
  function tickStamina() {
    const now = Date.now(), max = stamMax();
    if (S.res.stam >= max) { S.res.stamAt = now; return; }
    const gain = Math.floor((now - S.res.stamAt) / 1000 / STAM_EVERY);
    if (gain > 0) { S.res.stam = Math.min(max, S.res.stam + gain); S.res.stamAt += gain * STAM_EVERY * 1000; }
  }
  const maxLv = (id, e) => MAXLV[def(id).rarity][e];
  const maxElite = (id) => MAXLV[def(id).rarity].length - 1;
  // growth multiplier on hp/atk/def: E0 Lv1 = 0.8 … E2 max = 1.1
  // growth as in the original: stats climb in a straight line within each promotion phase and promotion keeps them where they were;
  // a fresh operator stands at under half of what it will be at the top
  // growth: each number follows the stand-in operator of the original, promotion by promotion ({ hp, atk, def } as shares of the final)
  function mult(id) { const o = S.ops[id]; return TD.growth(def(id), o.elite, o.lvl, maxLv(id, o.elite)); }
  const lvCost = (o) => 15 + o.lvl * 5 + o.elite * 30;
  const fmt = (n) => n.toLocaleString("en-US");
  const playerExpNeed = () => 300 + S.lvl * 150;

  // ---------- dom helpers ----------
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  // a description with {용어} in it: each term becomes an underlined word that opens its explanation when tapped
  const ST = () => (window.TD && TD.STATUS) || {};
  // figures in a description in the original's blue (only in the text, never inside a tag)
  const numHtml = (html) => html.replace(/(<[^>]+>)|([+\-]?\d+(?:\.\d+)?%?)/g, (m, tag, num) => tag || `<b class="nb">${num}</b>`);
  const kwHtml = (str) => esc(str).replace(/\{([^}]+)\}/g, (_, n) => `<span class="kw" data-kw="${n}" style="color:${(ST()[n] || {}).col || "#ffd27a"}">${n}</span>`);
  // menu sounds: back, tabs, the rest of the buttons a plain click
  document.addEventListener("pointerdown", (ev) => {
    if (!window.SFX || !ev.target.closest || host.hidden) return; const t = ev.target.closest(".btn, .node, .tb, .ms-tab"); if (!t) return;
    if (t.classList.contains("dis")) return SFX.play("ui_err", 0.5);
    if (t.classList.contains("back") || t.classList.contains("bk") || t.classList.contains("zm-bk")) return SFX.play("ui_back", 0.6);
    if (t.matches(".tb, .ms-tab, .dp-tabs .btn, .rv-tabs .t, .tag")) return SFX.play("ui_tab", 0.6);
    if (t.matches(".node")) return SFX.play("ui_sel", 0.6);
    SFX.play("ui_click", 0.5);
  }, true);
  document.addEventListener("click", (ev) => {
    const old = document.querySelector(".kwpop"); if (old) old.remove();
    const t = ev.target.closest && ev.target.closest(".kw"); if (!t) return;
    ev.stopPropagation(); ev.preventDefault();
    const n = t.dataset.kw, d = ST()[n]; if (!d) return;
    const pop = h("div", "kwpop", `<b style="color:${d.col}">${esc(n)}</b>${kwHtml(d.desc)}`); pop.style.borderLeftColor = d.col; document.body.appendChild(pop);
    const r = t.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    pop.style.left = Math.max(8, Math.min(innerWidth - pw - 8, r.left)) + "px";
    pop.style.top = (r.bottom + 6 + ph > innerHeight ? r.top - ph - 6 : r.bottom + 6) + "px";
  }, true);
  const stars = (n, col) => `<span class="stars" style="color:${col || RAR_COL[n]}">${"★".repeat(n)}</span>`;
  const icon = {};
  const clsIcon = (id, size = 28, col = "#fff") => { const k = id + size + col; return icon[k] || (icon[k] = B.classIcon(id, size, col)); };

  // ---------- styles ----------
  const css = `
  #meta { position:absolute; inset:0; overflow:hidden; z-index:5; background:#08090b; }
  #meta[hidden] { display:none !important; }
  .sheet { position:absolute; left:0; top:0; width:${VW}px; height:${VH}px; transform-origin:0 0; color:#e8eaee; font-family:"Noto Sans KR",sans-serif; overflow:hidden; background:#121316; }
  .sheet * { box-sizing:border-box; } .sheet { touch-action:none; -webkit-user-drag:none; } .sheet img { -webkit-user-drag:none; user-select:none; }
  .en { font-family:"Oswald","Arial Narrow",sans-serif; letter-spacing:.04em; }
  .scr { position:absolute; inset:0; }
  .fixed-sq { position:absolute; left:50%; top:150px; transform:translateX(-50%); display:flex; gap:18px; }
  .fixed-sq .oc { position:relative; pointer-events:none; }
  .boot { position:absolute; inset:0; z-index:90; background:#0b0c0e; transition:opacity .45s ease; }
  .boot.out { opacity:0; pointer-events:none; }
  .bt-mk { position:absolute; left:50%; top:220px; width:200px; margin-left:-100px; opacity:.9; } .bt-mk svg { display:block; width:100%; }
  .bt-bot { position:absolute; left:80px; right:80px; bottom:64px; }
  .bt-ln { display:flex; justify-content:space-between; align-items:baseline; font-size:17px; color:#c8ccd4; margin-bottom:10px; } .bt-n { font-size:18px; color:#fff; letter-spacing:.04em; }
  .bt-bar { height:3px; background:rgba(255,255,255,.12); } .bt-bar i { display:block; height:100%; width:0; background:#fff; transition:width .2s linear; }
  .bt-err { margin-top:18px; } .bt-err .m { font-size:16px; color:#ffb3b8; line-height:1.6; }
  .bt-err .row { display:flex; gap:12px; margin-top:14px; } .bt-err .btn { padding:12px 26px; font-size:17px; font-weight:700; background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.25); }
  .bt-err .bt-re { background:#f2f3f5; color:#0b0c0e; }
  .scr-out { pointer-events:none; animation:scrOut .3s ease forwards; }
  .scr-in { animation:scrIn .35s ease both; }
  @keyframes scrOut { to { opacity:0; } }
  @keyframes scrIn { from { opacity:0; } to { opacity:1; } }
  .btn { cursor:pointer; user-select:none; }
  .btn:active { filter:brightness(1.25); }
  .stars { letter-spacing:-2px; font-size:16px; text-shadow:0 0 6px rgba(0,0,0,.6); }
  /* lobby */
  .lobby-bg { position:absolute; inset:0; background:radial-gradient(ellipse at 30% 60%, var(--lbg,#2a2d34) 0%, #121316 70%); transition:background .4s; }
  .lobby-bg::after { content:""; position:absolute; inset:0; background:repeating-linear-gradient(115deg, rgba(255,255,255,.025) 0 2px, transparent 2px 22px); }
  .assist { position:absolute; left:-30px; bottom:-90px; height:860px; filter:drop-shadow(0 0 40px rgba(0,0,0,.6)); animation:breathe 6s ease-in-out infinite; pointer-events:none; }
  .assist.full { left:10px; bottom:-40px; height:780px; -webkit-mask-image:linear-gradient(90deg,#000 70%,transparent); mask-image:linear-gradient(90deg,#000 70%,transparent); }
  @keyframes breathe { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-6px) } }
  .res { position:absolute; right:22px; top:22px; display:flex; gap:10px; }
  .chip { height:34px; padding:0 14px 0 8px; background:rgba(10,11,13,.82); border:1px solid rgba(255,255,255,.14); display:flex; align-items:center; gap:8px; font-size:18px; }
  .sheet .chip b.ii { background:none !important; width:26px; height:26px; margin:-2px 0; } .chip b.ii .icn { filter:drop-shadow(0 1px 1px rgba(0,0,0,.5)); }
  .chip b { width:20px; height:20px; display:inline-grid; place-items:center; font-size:14px; font-weight:900; color:#111; }
  .sbtn { height:36px; padding:0 14px; background:rgba(10,11,13,.8); border:1px solid rgba(255,255,255,.18); display:flex; align-items:center; font-size:16px; }
  /* top bar for sub screens */
  .top { position:absolute; left:0; right:0; top:0; height:64px; display:flex; align-items:center; gap:10px; padding:0 22px; background:linear-gradient(180deg,rgba(0,0,0,.75),transparent); z-index:3; }
  .top .back, .top .home { width:50px; height:40px; background:rgba(20,21,24,.9); border:1px solid rgba(255,255,255,.2); display:grid; place-items:center; font-size:21px; }
  .top .ttl { font-size:24px; font-weight:900; margin-left:10px; } .top .ttl small { font-size:15px; color:#8a8f99; margin-left:10px; font-weight:500; }
  .top .res { position:static; margin-left:auto; }
  /* terminal, after the original: a chapter backdrop with the stages pinned on it as tags, the operation panel sliding in from the right */
  .term-bg { position:absolute; inset:0; background:#0c0d10 center/cover; filter:brightness(.62) saturate(.55); }
  .term-shade { position:absolute; inset:0; background:linear-gradient(180deg,rgba(0,0,0,.5),rgba(0,0,0,0) 22%,rgba(0,0,0,0) 78%,rgba(0,0,0,.55)); pointer-events:none; }
  .ep { position:absolute; right:30px; bottom:20px; display:flex; gap:2px; } .ep > div { position:relative; background:rgba(60,62,68,.72); padding:8px 18px 6px; text-align:center; } .ep > div.nx, .ep > div.pv { background:rgba(24,25,28,.9); padding:8px 12px 6px; }
  .ep .pg { position:absolute; right:6px; top:4px; font-size:13px; color:#ffd27a; }
  .ep .s { font-size:18px; font-weight:700; color:#e8eaee; } .ep .t { font-size:34px; font-weight:400; line-height:1; } .ep .k { font-size:13px; color:#9aa0aa; letter-spacing:.08em; }
  .strip { position:absolute; left:0; top:120px; right:0; height:420px; overflow-x:auto; overflow-y:hidden; scrollbar-width:none; transition:right .25s; }
  .strip.narrow { right:520px; } .strip::-webkit-scrollbar { display:none; }
  .track { position:relative; height:100%; }
  .track svg { position:absolute; left:0; top:0; pointer-events:none; }
  .node { position:absolute; width:124px; height:44px; filter:drop-shadow(0 3px 5px rgba(0,0,0,.45)); }
  .node .lab { height:9px; margin-left:18px; background:#151515; color:#fff; font-size:7px; letter-spacing:.06em; line-height:9px; text-align:center; }
  .node .box { position:relative; height:33px; padding-left:24px; display:flex; align-items:center; background:linear-gradient(90deg,#fdfdfd 0,#f1f1f2 70%,#dedfe1 100%); color:#1c1c1c; }
  .node .hx { position:absolute; left:-15px; top:2px; width:30px; height:29px; clip-path:polygon(25% 2%,75% 2%,100% 50%,75% 98%,25% 98%,0 50%); background:linear-gradient(#7d8086,#55585e); display:grid; place-items:center; }
  .node .hx i { width:22px; height:21px; clip-path:inherit; background:linear-gradient(#f4f5f6,#c9cbcf); }
  .node.next .hx { background:linear-gradient(#56c8ff,#1a8fd6); } .node.next .hx i { background:#2aa7ec; box-shadow:inset 0 0 0 2px #fff; }
  .node .c { font-size:23px; font-weight:500; letter-spacing:.01em; line-height:1; }
  .node.sel .box { background:linear-gradient(90deg,#8e9095,#6f7277); color:#2a2a2a; } .node.sel .hx { filter:grayscale(1) brightness(.85); }
  .node.tr .box { background:linear-gradient(90deg,#1d1e21 0,#2a2b2f 100%); color:#fff; } .node.tr .lab { background:#e9eaec; color:#151515; } .node.tr.sel .box { background:linear-gradient(90deg,#55585e,#43464b); color:#ddd; }   /* a lesson, as the original's TR stages: the tag in black */
  .node.st .box { background:linear-gradient(90deg,#efe6cf 0,#e4d8b8 70%,#cfc3a0 100%); color:#2a241c; } .node.st .lab { background:#5a4528; color:#f3ead6; } .node.st .c { font-size:19px; } .node.st.sel .box { background:linear-gradient(90deg,#8e8572,#6f685a); color:#2a241c; }   /* a story entry: a paper tag, as the original's ST stages */
  .node.st.next .hx { background:linear-gradient(#e8c77a,#b8882a); } .node.st.next .hx i { background:#d9a93f; box-shadow:inset 0 0 0 2px #fff; }
  .node .dm { position:absolute; right:-34px; top:-5px; width:50px; height:50px; border-radius:50%; background:radial-gradient(#3a3d43,#1b1c1f 70%); border:2px solid #9a9da3; box-shadow:0 0 0 2px rgba(0,0,0,.55),0 3px 6px rgba(0,0,0,.5); display:grid; place-items:center; overflow:hidden; }
  .node .dm svg { width:38px; height:38px; } .node .dm.t2 { border-color:#5fb3ff; } .node .dm.t3 { border-color:#d9a8ff; } .node.sel .dm { filter:brightness(.8); }
  @keyframes hxPulse { 50% { filter:brightness(1.35); } }
  .detail { position:absolute; right:0; top:0; bottom:0; width:540px; background:linear-gradient(90deg,rgba(10,11,13,0),rgba(10,11,13,.9) 18%,rgba(10,11,13,.95)); padding:96px 36px 30px 90px; }
  .detail .hd { display:flex; align-items:flex-end; gap:12px; background:linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,.55) 20%); margin:0 -36px 0 -40px; padding:10px 36px 10px 40px; }
  .detail .hd .op { font-size:14px; color:#c8ccd4; letter-spacing:.06em; } .detail .hd .c { font-size:40px; font-weight:800; line-height:1; } .detail .hd .n { font-size:30px; font-weight:900; margin-top:4px; }

  .recbar { display:flex; background:linear-gradient(90deg,#c0392b,#d2553f); color:#fff; font-size:15px; font-weight:800; padding:2px 10px; } .recbar b { margin-left:8px; color:#ffe2a8; }
  .detail p { color:#d8dbe0; font-size:16px; line-height:1.65; margin:8px 0 0; }
  .intel { display:flex; gap:12px; margin:22px 0 16px; justify-content:flex-end; }
  .ibox { width:168px; height:106px; position:relative; background:#1a1c20; border:1px solid rgba(255,255,255,.35); cursor:pointer; overflow:hidden; }
  .ibox .h { position:absolute; left:8px; top:6px; font-size:17px; font-weight:800; z-index:2; text-shadow:0 1px 3px #000; }
  .ibox .th { position:absolute; inset:0; background:center/cover; opacity:.55; display:flex; } .ibox .th span { flex:1; background:center/cover no-repeat; }
  .ibox:hover { border-color:#2ec5f2; }
  .go { position:absolute; right:36px; bottom:28px; width:260px; height:78px; background:linear-gradient(90deg,#118bc4,#24a8e8); color:#fff; display:flex; flex-direction:column; justify-content:center; align-items:flex-end; padding-right:26px; }
  .go .a { font-size:28px; font-weight:900; } .go .b { font-size:17px; font-weight:700; } .go.dis { background:#4a4b50; color:#999; }
  /* full-screen sheets over a blurred stage */
  .fs { position:absolute; inset:0; z-index:20; background:#0b0c0e; overflow:hidden; }
  .fs .blur { position:absolute; inset:-30px; background:center/cover; filter:blur(14px) brightness(.45) saturate(.6); }
  .fs .stripes { position:absolute; inset:0; background:repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 3px,rgba(0,0,0,0) 3px 9px); }
  .fs .bk { position:absolute; left:20px; top:16px; width:120px; height:46px; background:rgba(30,32,36,.92); display:grid; place-items:center; font-size:26px; z-index:3; }
  .ftabs { position:absolute; right:30px; top:18px; display:flex; z-index:3; } .ftabs div { width:104px; height:46px; display:grid; place-items:center; background:rgba(10,11,13,.92); color:#8a8f99; font-size:19px; font-weight:700; }
  .ftabs div.on { background:#126d9a; color:#fff; }
  .fgrid { position:absolute; left:70px; top:100px; width:620px; bottom:30px; display:grid; grid-template-columns:repeat(4,138px); grid-auto-rows:138px; gap:16px; align-content:start; overflow-y:auto; }
  .fcard { position:relative; background:#1d1f24; border:2px solid rgba(255,255,255,.18); }
  .fcard.on { border:4px solid #fff; } .fcard .im { position:absolute; inset:4px; background:center/contain no-repeat; } .fcard .im.sil { filter:brightness(0) drop-shadow(0 0 2px rgba(255,255,255,.5)); }
  .fcard .tg { position:absolute; left:0; top:0; background:#111; color:#fff; font-size:18px; font-weight:700; padding:2px 12px; z-index:2; }
  .fcard .cnt { position:absolute; right:6px; bottom:4px; color:#ff9aa2; font-weight:800; font-size:17px; text-shadow:0 1px 3px #000; }
  .fsep { position:absolute; left:712px; top:100px; bottom:30px; width:2px; background:rgba(255,255,255,.25); }
  .fdet { position:absolute; left:744px; right:34px; top:92px; }
  .fdet .cat { color:#7fb7a8; font-size:18px; font-weight:700; } .fdet .nmr { display:flex; align-items:center; gap:10px; margin:4px 0; }
  .fdet .nmr .tg { background:#111; color:#fff; font-size:18px; padding:3px 14px; } .fdet .nmr .n { font-size:28px; font-weight:900; }
  .fdet .at { color:#8a8f99; font-size:21px; font-weight:700; margin-bottom:12px; }
  .fdet .mid { display:flex; gap:12px; } .fdet .pt { width:136px; flex:none; } .fdet .pt .im { width:136px; height:136px; background:#1d1f24 center/contain no-repeat; border:1px solid rgba(255,255,255,.15); }
  .fdet .pt .im.sil { filter:brightness(0) drop-shadow(0 0 2px rgba(255,255,255,.5)); }
  .fdet .wt { margin-top:6px; background:#111; display:flex; justify-content:space-between; padding:4px 10px; font-size:16px; } .fdet .wt b { font-size:19px; }
  .gr8 { flex:1; display:grid; grid-template-columns:1fr 1fr; gap:6px; } .gr8 div { background:rgba(30,32,36,.95); display:flex; justify-content:space-between; align-items:center; padding:6px 10px; font-size:15px; color:#c8ccd4; }
  .gr8 b { font-size:21px; color:#fff; }
  .fdet .ds { margin-top:16px; font-style:italic; color:#c8ccd4; font-size:16px; line-height:1.7; }
  .mframe { position:absolute; left:50%; top:50%; width:1000px; height:563px; transform:translate(-50%,-50%); border:8px solid #111; box-shadow:0 10px 40px rgba(0,0,0,.6); background:#111 center/cover; }
  .mframe .cap { position:absolute; left:0; right:0; bottom:10px; text-align:center; font:700 18px/1 "Courier New",monospace; letter-spacing:.2em; color:#fff; text-shadow:0 1px 2px #000; }
  .mframe .cd { position:absolute; right:16px; top:12px; font:700 15px/1 "Courier New",monospace; letter-spacing:.12em; color:#fff; text-shadow:0 1px 2px #000; }
  .mpt { position:absolute; width:44px; height:44px; transform:translate(-50%,-62%); border:3px solid; }
  .mpt::before { content:""; position:absolute; left:8px; top:-12px; width:44px; height:44px; border:2px solid; border-color:inherit; opacity:.55; }
  .mpt.r { border-color:#ff3b4a; background:rgba(255,59,74,.18); } .mpt.b { border-color:#3aa8ff; background:rgba(58,168,255,.18); }
  /* squads */
  .card img.art, .slot img.art { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:60% 15%; }
  .bar .nm { font-size:19px; font-weight:900; } .bar .lv { font-size:15px; color:#c8ccd4; }
  .rtop { position:absolute; left:0; right:0; top:0; height:4px; }
  .cls { position:absolute; left:6px; top:10px; width:28px; height:28px; }
  .el { position:absolute; right:6px; top:10px; font-size:14px; padding:1px 6px; background:rgba(0,0,0,.7); border:1px solid rgba(255,255,255,.3); }
  .skb { position:absolute; right:6px; bottom:56px; display:flex; gap:3px; } .skb span { width:26px; height:22px; font-size:13px; display:grid; place-items:center; background:rgba(0,0,0,.7); border:1px solid rgba(255,255,255,.25); } .skb span.on { background:#ffd400; color:#111; font-weight:900; }
  /* roster */
  .grid { position:absolute; left:40px; right:40px; top:84px; bottom:20px; overflow:auto; display:grid; grid-template-columns:repeat(auto-fill, 150px); gap:12px; align-content:start; padding-bottom:20px; }
  .card { position:relative; width:150px; height:210px; background:#1a1b1f; border:1px solid rgba(255,255,255,.14); overflow:hidden; }
  /* operator card (shared by the list and the squad picker) */
  .oc { position:relative; width:124px; height:276px; flex:none; filter:drop-shadow(0 4px 6px rgba(0,0,0,.35)); }
  .oc-art { position:absolute; left:0; right:0; top:8px; bottom:0; overflow:hidden; background:linear-gradient(#cfd2d8,#8d929b); clip-path:polygon(0 0, 100% 0, 100% 100%, 0 100%); }
  .oc-art img { width:100%; height:100%; object-fit:cover; object-position:50% 12%; transition:transform .3s; }
  .oc:hover .oc-art img { transform:scale(1.05); }
  .oc-glow { position:absolute; left:0; right:0; top:54%; bottom:20%; pointer-events:none;
    background:linear-gradient(180deg, transparent 0, color-mix(in srgb, var(--rc) 35%, transparent) 55%, color-mix(in srgb, var(--rc) 70%, #fff 10%) 100%); opacity:.85; }
  .oc.e1 .oc-glow { background:radial-gradient(circle, rgba(255,255,255,.75) 0 1px, transparent 1.6px) 0 0/5px 5px, linear-gradient(180deg, transparent 0, rgba(150,190,230,.45) 50%, rgba(200,225,250,.85) 100%);
    -webkit-mask-image:linear-gradient(180deg, transparent, #000 45%); mask-image:linear-gradient(180deg, transparent, #000 45%); opacity:1; }
  .oc.e2 .oc-glow { background:radial-gradient(circle, rgba(255,250,190,.9) 0 .9px, transparent 1.4px) 0 0/4px 4px, linear-gradient(180deg, transparent 0, rgba(255,140,0,.5) 35%, #f5a800 70%, #e8d000 100%);
    -webkit-mask-image:linear-gradient(180deg, transparent, #000 40%); mask-image:linear-gradient(180deg, transparent, #000 40%); opacity:1; }
  .oc-wedge { position:absolute; left:0; right:0; bottom:0; height:30%; background:linear-gradient(180deg,#2b2a2c,#151416 60%); clip-path:polygon(0 0, 100% 34%, 100% 100%, 0 100%); }
  .oc-top { position:absolute; left:-3px; top:0; height:30px; display:flex; align-items:center; gap:3px; z-index:2; }
  .oc-top i { width:30px; height:30px; display:grid; place-items:center; background:#2a292b; box-shadow:2px 2px 0 rgba(0,0,0,.35); }
  .oc-top i img { width:21px; height:21px; }
  .oc-top span { font-size:14px; letter-spacing:-1.5px; color:#ffd21c; -webkit-text-stroke:.6px #5a3c00; text-shadow:0 1px 2px rgba(0,0,0,.7); margin-top:2px; }
  .oc-em { position:absolute; left:6px; bottom:25%; width:44px; height:36px; color:#fff; filter:drop-shadow(0 2px 2px rgba(0,0,0,.55)); z-index:1; } .oc-em svg { width:100%; height:100%; display:block; }
  .oc-pt { position:absolute; right:5px; bottom:24%; width:18px; height:20px; display:grid; place-items:center; font-size:13px; font-weight:700; color:#16171a; background:rgba(255,255,255,.88); clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%); }
  .oc-lv { position:absolute; left:5px; bottom:25px; }
  .oc-sk { position:absolute; right:5px; bottom:30px; width:26px; height:26px; } .oc-sk .sk-ic { box-shadow:0 0 0 1px rgba(255,255,255,.5); }
  .oc-n { position:absolute; left:6px; right:6px; bottom:4px; text-align:right; font-size:18px; font-weight:900; line-height:1.2; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .oc .lvr .tk { fill:rgba(0,0,0,.4); stroke:rgba(255,255,255,.28); stroke-width:2.5; } .oc .lvr .ar { stroke-width:2.5; }
  .oc .lvr b { font-size:7px; top:17%; } .oc .lvr span { font-size:18px; top:38%; font-weight:500; }
  .oc-as { position:absolute; right:0; top:8px; padding:2px 7px; background:#23a3e6; color:#fff; font-size:13px; font-weight:900; z-index:2; }
  /* the light rooms (list, squads, hub), after the original: misty white, a faint mark in the corner */
  .lt-bg { position:absolute; inset:0; background:radial-gradient(70% 80% at 48% 42%, #fbfbfc 0, #e3e4e7 48%, #b9bcc2 100%); }
  .lt-bg::after { content:""; position:absolute; inset:0; background:repeating-linear-gradient(115deg, rgba(0,0,0,.022) 0 1px, transparent 1px 9px); }
  .lt-wm { position:absolute; left:-8px; bottom:-26px; font-size:118px; font-weight:700; letter-spacing:.02em; color:transparent; -webkit-text-stroke:1.5px rgba(40,44,52,.12); white-space:nowrap; pointer-events:none; transform:rotate(-8deg); transform-origin:0 100%; }
  .rs-own { position:absolute; left:640px; top:14px; height:44px; padding:0 22px; display:flex; align-items:center; gap:8px; background:#f28c4a; border-radius:22px; box-shadow:0 3px 8px rgba(0,0,0,.25); color:#fff; transform:translateX(-50%); }
  .rs-own svg { width:18px; height:18px; } .rs-own b { font-size:22px; font-weight:500; }
  .rs-own.on { background:#fff; color:#e8742c; box-shadow:0 0 0 3px #f28c4a, 0 3px 8px rgba(0,0,0,.25); } .rs-own.zero { background:#b9bcc2; }
  .oc-mk { position:absolute; right:-6px; top:-4px; width:20px; height:20px; transform:rotate(45deg); background:#f28c4a; border:2px solid #fff; box-shadow:0 1px 3px rgba(0,0,0,.4); z-index:3; }
  .oc-mk::after { content:""; position:absolute; inset:4px; background:#fff; }
  .rs-sort { position:absolute; right:100px; top:10px; height:50px; display:flex; align-items:center; background:#2b2c2f; box-shadow:0 3px 10px rgba(0,0,0,.3); }
  .rs-sort .rk { width:62px; height:100%; display:grid; place-items:center; background:#3a3b3f; } .rs-sort .rk svg { width:24px; height:24px; }
  .rs-sort > div.btn { position:relative; width:96px; height:100%; display:grid; place-items:center; font-size:17px; color:#c8ccd4; }
  .rs-sort > div.btn.on { color:#4fc3ff; font-weight:700; }
  .rs-sort > div.btn i { position:absolute; left:50%; bottom:7px; width:16px; height:8px; margin-left:-8px; border:solid #4fc3ff; border-width:0 2px 2px 0; transform:skewX(0); clip-path:none; }
  .rs-sort > div.btn i { border:0; background:none; } .rs-sort > div.btn i::before { content:""; position:absolute; left:3px; top:-2px; width:8px; height:8px; border:solid #4fc3ff; border-width:0 2px 2px 0; transform:rotate(45deg); }
  .rs-sort > b { width:1px; height:22px; background:rgba(255,255,255,.18); }
  .rs-cls { position:absolute; right:0; top:0; bottom:0; width:82px; padding-top:66px; display:flex; flex-direction:column; background:linear-gradient(90deg, rgba(24,25,28,.88), rgba(14,15,17,.96)); box-shadow:-4px 0 14px rgba(0,0,0,.25); }
  .rs-cls > div { flex:1; position:relative; display:grid; place-items:center; color:#fff; opacity:.75; }
  .rs-cls > div:hover { opacity:1; background:rgba(255,255,255,.05); }
  .rs-cls > div.on { opacity:1; background:linear-gradient(90deg, rgba(79,195,255,.22), transparent); } .rs-cls > div.on::before { content:""; position:absolute; left:0; top:12%; bottom:12%; width:3px; background:#4fc3ff; }
  .rs-cls > div img { width:30px; height:30px; } .rs-cls .all { font-style:normal; font-size:19px; font-weight:700; } .rs-cls > div.on .all { color:#4fc3ff; }
  .rs-row { position:absolute; left:22px; right:96px; top:80px; bottom:8px; display:grid; grid-auto-flow:column; grid-template-rows:repeat(2, 276px); grid-auto-columns:124px; gap:20px 16px; overflow-x:auto; overflow-y:hidden; align-content:start; padding:6px 6px 8px; scrollbar-width:thin; scrollbar-color:rgba(0,0,0,.25) transparent; }
  /* squads */
  .slots { position:absolute; left:223px; top:70px; display:grid; grid-template-columns:repeat(6, 124px); grid-template-rows:repeat(2, 266px); gap:16px 18px; }
  .oc.slot { width:124px; height:266px; }
  .slot.empty { position:relative; display:block; background:linear-gradient(180deg, rgba(255,255,255,.55), rgba(255,255,255,.2)); box-shadow:inset 0 0 0 1.5px rgba(80,84,92,.25); clip-path:polygon(0 8px, 100% 8px, 100% 100%, 0 100%); }
  .slot.empty i { position:absolute; left:50%; top:50%; width:34px; height:34px; margin:-17px 0 0 -17px; }
  .slot.empty i::before, .slot.empty i::after { content:""; position:absolute; background:rgba(60,64,72,.45); } .slot.empty i::before { left:15px; top:0; width:4px; height:34px; } .slot.empty i::after { top:15px; left:0; height:4px; width:34px; }
  .slot.empty.far { opacity:.45; } .slot.empty:hover { background:linear-gradient(180deg, rgba(255,255,255,.8), rgba(255,255,255,.35)); }
  .slot.bench > :not(.bn-lab) { filter:grayscale(1) brightness(.5); } .slot .bn-lab { position:absolute; left:0; right:0; top:40%; display:grid; place-items:center; height:30px; background:rgba(0,0,0,.6); color:#fff; font-weight:900; font-size:16px; letter-spacing:.1em; z-index:3; }
  .sq-arr { position:absolute; top:268px; width:60px; height:110px; }
  .sq-arr::before { content:""; position:absolute; top:22px; width:62px; height:62px; border:solid rgba(255,255,255,.95); border-width:0 0 4px 4px; filter:drop-shadow(0 0 3px rgba(0,0,0,.35)); }
  .sq-arr.l { left:130px; } .sq-arr.l::before { left:24px; transform:rotate(45deg); } .sq-arr.r { right:130px; } .sq-arr.r::before { right:24px; transform:rotate(-135deg); }
  .sq-tabs { position:absolute; left:196px; right:196px; bottom:10px; height:48px; display:flex; gap:12px; }
  .sq-tabs > div { flex:1; position:relative; display:flex; align-items:center; justify-content:center; gap:8px; border-top:6px solid #45474d; background:linear-gradient(transparent, rgba(255,255,255,.35)); color:#2b2c2f; font-size:20px; font-weight:900; }
  .sq-tabs > div small { font-size:16px; color:#7a7e86; font-weight:500; }
  .sq-tabs > div.on { background:#1d8bd0; color:#fff; border-top-color:#f2f3f5; } .sq-tabs > div.on small { color:#cfe9ff; }
  .sq-quick { position:absolute; right:84px; top:12px; width:250px; height:44px; display:flex; align-items:center; background:#2b2c2f; color:#fff; font-size:19px; font-weight:700; box-shadow:0 3px 8px rgba(0,0,0,.3); }
  .sq-quick i { width:66px; height:100%; display:grid; place-items:center; background:#1d8bd0; margin-right:16px; } .sq-quick i svg { width:30px; height:24px; }
  .sq-trash { position:absolute; right:18px; top:12px; width:56px; height:44px; display:grid; place-items:center; background:#a0161c; box-shadow:0 3px 8px rgba(0,0,0,.3); } .sq-trash svg { width:24px; height:24px; }
  .sq-stage { position:absolute; left:50%; top:16px; transform:translateX(-50%); height:38px; padding:0 18px; display:flex; align-items:center; gap:10px; background:#2b2c2f; color:#fff; font-size:18px; font-weight:700; box-shadow:0 3px 8px rgba(0,0,0,.3); }
  .sq-stage span { font-size:21px; font-weight:500; color:#4fc3ff; } .sq-stage i { font-style:normal; margin-left:10px; font-size:17px; color:#c8ccd4; }
  .sq-go { left:auto; right:0; bottom:10px; width:180px; height:62px; } .sq-go .a { font-size:24px; }
  .cap-note { position:absolute; left:223px; top:614px; color:#2b2c2f; font-size:16px; font-weight:700; } .cap-note b { color:#d0451b; margin-right:6px; }
  .emk { display:block; width:30px; height:22px; color:#e8eaee; filter:drop-shadow(0 1px 2px rgba(0,0,0,.9)); margin-bottom:-2px; } .emk svg { width:100%; height:100%; display:block; }
  .emk.e0 { color:#b9bec7; } .emk.e2 { color:#ffe08a; }
  .lvr { position:relative; flex:none; } .lvr svg { position:absolute; inset:0; width:100%; height:100%; }
  .lvr .tk { fill:rgba(8,9,11,.72); stroke:rgba(255,255,255,.2); stroke-width:3; } .lvr .ar { fill:none; stroke:#f2f3f5; stroke-width:3; }
  .lvr.max .ar { stroke:#ffd400; }
  .lvr b { position:absolute; left:0; right:0; top:15%; text-align:center; font:600 8px "Oswald",sans-serif; letter-spacing:.12em; color:#aab0ba; }
  .lvr span { position:absolute; left:0; right:0; top:41%; text-align:center; font-size:18px; font-weight:600; line-height:1; color:#fff; letter-spacing:0; }
  .lvr.max span { color:#ffd400; }
  /* operator list */
  .card.in { outline:2px solid #ffd400; } .card .tag { position:absolute; left:0; top:44px; background:#ffd400; color:#111; font-size:13px; font-weight:900; padding:1px 6px; }
  /* operator detail */
  .stats { display:grid; grid-template-columns:1fr 1fr; gap:4px 26px; margin:12px 0 14px; font-size:17px; } .stats div { display:flex; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,.08); padding:3px 0; } .stats span { color:#9aa0aa; }
  .sk { border:1px solid rgba(255,255,255,.12); padding:10px 12px; margin-bottom:8px; } .sk.on { border-color:#ffd400; } .sk .h { display:flex; justify-content:space-between; font-weight:900; } .sk .h span { color:#9aa0aa; font-weight:500; font-size:14px; } .sk p { margin:6px 0 0; color:#c8ccd4; font-size:15px; line-height:1.6; }
  .link { font-size:14px; color:#9aa0aa; display:flex; gap:8px; align-items:center; } .link .en { color:#e8eaee; font-size:17px; }
  .sub-nm { font-size:14px; font-weight:700; color:#c8ccd4; margin-left:6px; letter-spacing:0; }
  .kw { text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; cursor: pointer; font-weight: 700; }
  .kwpop { position: fixed; z-index: 999; max-width: 300px; background: rgba(14,15,18,.97); border: 1px solid rgba(255,255,255,.22); border-left: 3px solid #ffd27a; padding: 10px 12px; font-size:15px; line-height: 1.6; color: #d8dbe0; box-shadow: 0 6px 24px rgba(0,0,0,.6); }
  .kwpop b { display: block; margin-bottom: 4px; font-size:16px; }
  /* headhunting */
  .hh-bg { position:absolute; inset:0; background:linear-gradient(110deg,#1a0f08,#08080a 60%); }
  .hh-art { position:absolute; right:-40px; bottom:-80px; height:840px; -webkit-mask:linear-gradient(90deg,transparent,#000 22%); mask:linear-gradient(90deg,transparent,#000 22%); } .hh-shade { position:absolute; inset:0; background:linear-gradient(90deg,rgba(12,12,14,.96) 0,rgba(12,12,14,.85) 38%,rgba(12,12,14,0) 62%); pointer-events:none; } .hh-art.back { right:360px; height:760px; bottom:-60px; filter:brightness(.55) saturate(.8); -webkit-mask:linear-gradient(90deg,transparent,#000 30%,#000 70%,transparent); mask:linear-gradient(90deg,transparent,#000 30%,#000 70%,transparent); }
  .hh-info { position:absolute; left:60px; top:110px; width:560px; }
  .hh-info .t { font-size:54px; font-weight:900; line-height:1.05; } .hh-info .s { color:#ffb36b; font-size:18px; margin:10px 0 20px; }
  .hh-info .rate { font-size:16px; color:#c8ccd4; line-height:1.9; }
  .hh-info .ups { display:flex; flex-direction:column; gap:8px; margin:14px 0 18px; } .hh-info .up { position:relative; height:62px; padding:6px 10px 6px 74px; background:linear-gradient(90deg,rgba(20,22,26,.92),rgba(20,22,26,.5)); border-left:4px solid #ff8a1f; }
  .hh-info .up i { position:absolute; left:6px; top:5px; width:52px; height:52px; background:center 15%/cover; } .hh-info .up span { display:block; font-size:12px; color:#ffcf3a; letter-spacing:1px; } .hh-info .up b { font-size:21px; font-weight:900; } .hh-info .up em { position:absolute; right:12px; top:20px; font-style:normal; font-size:15px; color:#ffb36b; }
  .pull { position:absolute; bottom:40px; width:250px; height:86px; display:flex; flex-direction:column; justify-content:center; align-items:center; clip-path:polygon(6% 0,100% 0,94% 100%,0 100%); }
  .pull .a { font-size:26px; font-weight:900; } .pull .b { font-size:16px; }
  .pull.p1 { left:60px; background:#e8eaee; color:#111; } .pull.p10 { left:330px; background:#ff8a1f; color:#111; } .pull.dis { filter:grayscale(1) brightness(.6); }
  .pity { position:absolute; left:60px; bottom:140px; color:#9aa0aa; font-size:15px; }
  /* the start link: everyone talks at once, and the terminal cuts them off */
  .chat { position:absolute; inset:0; z-index:8; background:rgba(4,6,9,.86); overflow:hidden; }
  .chat .feed { position:absolute; left:260px; right:260px; bottom:150px; display:flex; flex-direction:column; gap:10px; }
  .chat .ln { display:flex; align-items:center; gap:14px; animation:chatIn .18s ease-out both; }
  .chat .ln.cut .t::after { content:""; display:inline-block; width:14px; height:3px; margin-left:4px; background:#e8eaee; vertical-align:middle; animation:gpulse .3s infinite; }
  .chat .ic { width:58px; height:58px; border-radius:50%; flex:none; background-size:cover; background-position:center 18%; border:2px solid rgba(255,255,255,.35); box-shadow:0 0 0 3px rgba(0,0,0,.4); }
  .chat .bb { background:rgba(22,26,32,.92); border-left:4px solid var(--c, #8aa); padding:9px 18px 10px; border-radius:2px; max-width:900px; }
  .chat .bb .n { font-size:15px; color:var(--c, #8aa); font-weight:700; letter-spacing:.04em; }
  .chat .bb .t { font-size:21px; color:#eef1f5; line-height:1.45; }
  .chat .ln.old { animation:none; opacity:.45; filter:saturate(.5); transition:opacity .2s; }
  .chat .glitch { position:absolute; inset:0; background:repeating-linear-gradient(0deg, rgba(127,227,255,.07) 0 2px, transparent 2px 5px); animation:chatGl .12s steps(2) infinite; pointer-events:none; }
  .chat .sysbox { position:absolute; left:230px; right:230px; top:340px; padding:30px 40px 26px 96px; background:linear-gradient(90deg, rgba(6,18,26,.97), rgba(6,14,20,.92)); border-top:2px solid rgba(127,227,255,.75); border-left:5px solid #7fe3ff; animation:chatIn .25s ease-out both; }
  .chat .sysbox .lt { position:absolute; left:96px; top:9px; font-size:14px; color:rgba(127,227,255,.8); letter-spacing:.06em; }
  .chat .sysbox .gt { font-size:22px; font-weight:600; color:#eef6fa; line-height:1.9; }
  .chat .sysbox .hex { position:absolute; left:28px; top:50%; width:44px; height:44px; margin-top:-22px; }
  .chat .sysbox ruby rt { font-size:13px; color:#7fe3ff; } .chat .sysbox ruby { color:#7fe3ff; font-weight:700; }
  .chat .more { position:absolute; bottom:40px; left:0; right:0; text-align:center; color:#7fe3ff; font-size:16px; animation:gpulse 1s infinite; }
  @keyframes chatIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
  @keyframes chatGl { 0% { transform:translateX(0); } 50% { transform:translateX(3px); } }
  .card .epi, .slot .epi { font-size:13px; line-height:1.3; color:#e6d3a0; letter-spacing:.04em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; opacity:.9; }
  .reveal { position:absolute; inset:0; background:#050506; display:flex; align-items:center; justify-content:center; gap:10px; }
  .rv { width:112px; height:400px; position:relative; overflow:hidden; opacity:0; transform:translateY(40px) skewX(-6deg); animation:rvin .45s forwards; border:1px solid rgba(255,255,255,.15); }
  .rv img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:60% 20%; }
  .rv .glow { position:absolute; inset:0; mix-blend-mode:screen; }
  .rv .nw { position:absolute; left:6px; top:8px; background:#ffd400; color:#111; font-size:14px; font-weight:900; padding:1px 6px; }
  .rv .nm { position:absolute; left:0; right:0; bottom:0; padding:28px 6px 8px; background:linear-gradient(transparent,#000); font-weight:900; text-align:center; font-size:17px; }
  @keyframes rvin { to { opacity:1; transform:none; } }
  .flash { position:absolute; inset:0; pointer-events:none; animation:fl .9s forwards; } @keyframes fl { from { opacity:1 } to { opacity:0 } }
  /* base: the reclaimed zones */
  .bs-bg { position:absolute; inset:0; background:linear-gradient(180deg,rgba(8,9,11,.55),rgba(8,9,11,.9)), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M40 0H0v40' fill='none' stroke='%23ffffff' stroke-opacity='.05'/%3E%3C/svg%3E"), #101216; }
  .bs-ttl { position:absolute; left:320px; top:22px; } .bs-ttl small { display:block; font-size:13px; letter-spacing:.2em; color:#7f8590; } .bs-ttl b { font-size:28px; font-weight:900; }
  .bs-dorm { position:absolute; left:36px; top:100px; width:300px; height:536px; overflow:hidden; background:#1a1b1f; box-shadow:0 8px 18px rgba(0,0,0,.4); }
  .bs-dorm .im { position:absolute; inset:0; background:center/cover; filter:brightness(.75); } .bs-dorm .sh { position:absolute; inset:0; background:linear-gradient(180deg,rgba(0,0,0,.6),rgba(0,0,0,0) 30%,rgba(0,0,0,0) 45%,rgba(0,0,0,.9) 80%); }
  .bs-dorm .tp { position:absolute; left:18px; top:14px; right:18px; } .bs-dorm .tp small { display:block; font-size:13px; letter-spacing:.2em; color:#ffcf8a; } .bs-dorm .tp b { font-size:32px; font-weight:900; }
  .bs-dorm .lv, .bs-z .lv { position:absolute; right:0; top:4px; font-size:18px; font-weight:700; background:rgba(0,0,0,.6); padding:2px 8px; }
  .bs-dorm .rs { position:absolute; left:16px; right:16px; bottom:54px; display:flex; flex-wrap:wrap; gap:8px; }
  .bs-dorm .r { width:48px; } .bs-dorm .r i { display:block; width:48px; height:48px; border-radius:50%; background:#2a2c31 center 12%/cover; border:2px solid rgba(255,255,255,.6); }
  .bs-dorm .r.e i { border-style:dashed; border-color:rgba(255,255,255,.3); }
  .bs-dorm .fb, .bz-pn .fb, .bz-pk .fb { height:5px; background:rgba(255,255,255,.15); margin-top:4px; } .bs-dorm .fb b, .bz-pn .fb i, .bz-pk .fb i { display:block; height:100%; }
  .bs-dorm .ft { position:absolute; left:16px; right:16px; bottom:16px; font-size:16px; color:#d8dbe0; }
  .bs-grid { position:absolute; left:356px; top:100px; display:grid; grid-template-columns:repeat(3,282px); grid-auto-rows:260px; gap:14px; }
  .bs-z { position:relative; overflow:hidden; background:#1c1d21; box-shadow:0 6px 14px rgba(0,0,0,.4); border:1px solid rgba(255,255,255,.08); }
  .bs-z .im { position:absolute; left:0; right:0; top:0; height:118px; background:center/cover; } .bs-z .im::after { content:""; position:absolute; inset:0; background:linear-gradient(180deg,rgba(0,0,0,0) 40%,#1c1d21); }
  .bs-z .st { position:absolute; left:0; top:8px; font-size:15px; font-weight:900; padding:2px 10px; } .bs-z .st.on { background:#2fa84f; } .bs-z .st.stop { background:#d23b3b; } .bs-z .st.off { background:#55575c; }
  .bs-z .nm { position:absolute; left:12px; right:12px; top:100px; font-size:20px; font-weight:900; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } .bs-z .nm b { font-size:15px; color:#8fd3ff; margin-right:8px; font-weight:700; }
  .bs-z .pr { position:absolute; left:12px; right:12px; top:138px; display:flex; align-items:center; gap:8px; }
  .bs-z .pr > i, .bz-pn .pr > i { width:38px; height:38px; flex:none; display:grid; place-items:center; } .bs-z .pr > i svg, .bz-pn .pr > i svg { width:100%; height:100%; }
  .bs-z .pr .cn, .bz-pn .pr .cn { font-style:normal; font-size:24px; font-weight:900; color:#ffd36a; background:radial-gradient(#5a4a1c,#2a220c); border-radius:50%; border:2px solid #d9b24a; }
  .bs-z .pr .bar { flex:1; height:8px; background:rgba(255,255,255,.12); } .bs-z .pr .bar i { display:block; height:100%; background:linear-gradient(90deg,#2aa7ec,#7fd4ff); }
  .bs-z .pr span { font-size:17px; font-weight:700; } .bs-z .pr small { font-size:13px; color:#8a909a; }
  .bs-z .gd { position:absolute; left:12px; right:12px; bottom:12px; display:flex; align-items:center; gap:8px; }
  .bs-z .gd > i { width:50px; height:50px; border-radius:50%; background:#2a2c31 center 12%/cover; position:relative; box-shadow:0 0 0 3px #1c1d21, 0 0 0 5px rgba(255,255,255,.15); }
  .bs-z .gd > i:not(.e)::after { content:""; position:absolute; inset:-5px; border-radius:50%; background:conic-gradient(var(--c) var(--f), transparent 0); -webkit-mask:radial-gradient(circle, transparent 27px, #000 28px); mask:radial-gradient(circle, transparent 27px, #000 28px); }
  .bs-z .gd > i.e { border:2px dashed rgba(255,255,255,.25); box-shadow:none; } .bs-z .gd > i.out { filter:grayscale(1) brightness(.6); }
  .bs-z .wn { margin-left:auto; text-align:right; line-height:1.1; } .bs-z .wn small { display:block; font-size:13px; color:#8a909a; } .bs-z .wn b { font-size:24px; }
  .wn.ok b, .dg .w.ok b { color:#5fd36a; } .wn.mid b, .dg .w.mid b { color:#f2c14e; } .wn.bad b, .dg .w.bad b { color:#ff5a4a; }
  .bs-z.lk { cursor:default; } .bs-z.lk .im { height:100%; filter:grayscale(1) brightness(.35); } .bs-z.lk .im::after { display:none; }
  .bs-z .lkt { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; font-size:17px; color:#b8bcc4; } .bs-z .lkt b { font-size:26px; color:#fff; }
  .bs-ft { position:absolute; left:356px; right:48px; bottom:22px; height:48px; display:flex; align-items:center; gap:16px; }
  .bs-ft .lg { flex:1; display:flex; align-items:center; gap:10px; font-size:16px; color:#c8ccd4; background:rgba(0,0,0,.4); height:100%; padding:0 16px; white-space:nowrap; overflow:hidden; }
  .bs-ft .lg span { color:#7f8590; } .bs-ft .lg b { color:#8fd3ff; } .bs-ft .lg em { font-style:normal; color:#ff8a7a; }
  .bs-q { position:absolute; left:470px; top:34px; width:34px; height:34px; border-radius:50%; border:1.5px solid rgba(255,255,255,.5); display:grid; place-items:center; font-size:19px; font-weight:900; color:#d8dbe0; }
  .bs-help { width:640px !important; } .bs-help p { margin:8px 0; font-size:16px; } .bs-help p b { color:#8fd3ff; margin-right:6px; }
  .bs-all { width:200px; height:100%; background:linear-gradient(90deg,#118bc4,#24a8e8); display:grid; place-items:center; font-size:20px; font-weight:900; }
  .bm-pin { position:absolute; width:22px; height:22px; margin:-11px 0 0 -11px; transform:rotate(45deg); background:#4fb8ff; border:2px solid #e8f6ff; box-shadow:0 0 10px rgba(79,184,255,.8); z-index:2; }
  .bm-pin.home { background:#ffb35a; border-color:#fff3e0; box-shadow:0 0 12px rgba(255,180,90,.9); width:26px; height:26px; margin:-13px 0 0 -13px; }
  .bm-pin.lk { background:#4a2a2a; border-color:#a05050; box-shadow:none; cursor:default; }
  .bm-lk { position:absolute; width:120px; text-align:center; font-size:14px; color:#c88; text-shadow:0 1px 3px #000; } .bm-lk b { display:block; font-size:17px; color:#e9b0a8; }
  .bm-c { position:absolute; width:230px; padding:8px 10px 8px; background:rgba(12,16,20,.86); border:1px solid rgba(120,190,230,.35); box-shadow:0 6px 14px rgba(0,0,0,.5); z-index:3; backdrop-filter:blur(2px); }
  .bm-c::after { content:""; position:absolute; left:114px; width:1px; height:18px; background:rgba(120,190,230,.6); }
  .bm-c.up::after { bottom:-19px; } .bm-c.dn::after { top:-19px; } .bm-c.dorm { width:220px; border-color:rgba(255,190,110,.45); } .bm-c.dorm::after { left:109px; top:-21px; height:20px; background:rgba(255,190,110,.6); }
  .bm-c .hd { display:flex; align-items:baseline; gap:6px; font-size:17px; font-weight:900; white-space:nowrap; } .bm-c .hd b { font-size:14px; color:#8fd3ff; } .bm-c .hd span { margin-left:auto; font-size:14px; color:#9aa0aa; font-weight:700; }
  .bm-c.dorm .hd b { font-size:18px; color:#ffcf8a; } .bm-c.dorm .hd small { font-size:14px; color:#c8ccd4; }
  .bm-c .pr { display:flex; align-items:center; gap:6px; margin-top:6px; } .bm-c .pr > i { width:26px; height:26px; flex:none; display:grid; place-items:center; } .bm-c .pr > i svg { width:100%; height:100%; }
  .bm-c .pr .cn { font-style:normal; font-size:16px; font-weight:900; color:#ffd36a; background:radial-gradient(#5a4a1c,#2a220c); border-radius:50%; border:1.5px solid #d9b24a; }
  .bm-c .pr .bar { flex:1; height:6px; background:rgba(255,255,255,.12); } .bm-c .pr .bar i { display:block; height:100%; background:linear-gradient(90deg,#2aa7ec,#7fd4ff); } .bm-c .pr em { font-style:normal; font-size:15px; font-weight:700; min-width:44px; text-align:right; }
  .bm-c .gd { display:flex; align-items:center; gap:6px; margin-top:7px; }
  .bm-c .gd > i { width:34px; height:34px; border-radius:50%; background:#2a2c31 center 12%/cover; position:relative; flex:none; }
  .bm-c .gd > i:not(.e)::after { content:""; position:absolute; inset:-3px; border-radius:50%; background:conic-gradient(var(--c) var(--f), rgba(255,255,255,.12) 0); -webkit-mask:radial-gradient(circle, transparent 17px, #000 18px); mask:radial-gradient(circle, transparent 17px, #000 18px); }
  .bm-c .gd > i.e { border:1.5px dashed rgba(255,255,255,.25); } .bm-c .gd > i.out { filter:grayscale(1) brightness(.55); }
  .bm-c .st { font-size:12px; font-weight:900; padding:1px 6px; margin-left:2px; white-space:nowrap; } .bm-c .st.on { background:#2fa84f; } .bm-c .st.stop { background:#d23b3b; } .bm-c .st.off { background:#55575c; }
  .bm-c .wn { margin-left:auto; text-align:right; line-height:1; } .bm-c .wn b { font-size:19px; display:block; } .bm-c .wn small { font-size:11px; color:#8a909a; }
  .bm-c .ft { margin-top:6px; font-size:14px; color:#c8ccd4; }
  /* the base, after the original: a pale blueprint floor with the rooms as tiles */
  .ib-bg { position:absolute; inset:0; background:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='236'%3E%3Cg fill='none' stroke='%23b9bcc1' stroke-width='1'%3E%3Cpath d='M8 0v14M1 7h14M228 222v14M221 229h14'/%3E%3Cpath d='M110 100l20 20M130 100l-20 20' stroke='%23d0d2d5'/%3E%3C/g%3E%3Ctext x='150' y='60' font-size='9' fill='%23b9bcc1' font-family='sans-serif' transform='rotate(-90 150 60)'%3EINFRA07%3C/text%3E%3C/svg%3E"),
    linear-gradient(rgba(0,0,0,.045) 1px, transparent 1px) 0 0/40px 40px, linear-gradient(90deg, rgba(0,0,0,.045) 1px, transparent 1px) 0 0/40px 40px, #e7e8ea; }
  .ib-bg.dim { filter:brightness(.25); }
  .ib-res { position:absolute; right:20px; top:16px; display:flex; gap:8px; } .ib-res .c { display:flex; align-items:center; height:40px; background:#1d1f23; padding-right:14px; }
  .ib-res .c > i { width:44px; height:40px; display:grid; place-items:center; background:#2c2f35; margin-right:12px; } .ib-res .c svg { width:30px; height:30px; } .ib-res .c b { font-size:21px; font-weight:500; color:#fff; min-width:44px; text-align:right; }
  .ib-res .cn { font-style:normal; font-size:20px; font-weight:900; color:#ffd36a; }
  .ib-al { position:absolute; right:20px; top:66px; width:170px; height:52px; background:#d8423c; color:#fff; display:flex; align-items:center; gap:10px; padding:0 14px; }
  .ib-al i { font-style:normal; font-size:28px; } .ib-al b { font-size:30px; font-weight:500; margin-left:auto; } .ib-al small { position:absolute; left:10px; bottom:2px; font-size:9px; letter-spacing:.1em; opacity:.8; }
  .ib-all { position:absolute; left:28px; top:96px; width:230px; height:70px; background:#2f86b5; color:#fff; display:flex; align-items:center; justify-content:space-between; padding:0 22px; box-shadow:0 3px 8px rgba(0,0,0,.2); }
  .ib-all b { font-size:24px; font-weight:900; } .ib-all i { font-style:normal; font-size:30px; }
  .ib-gd { position:absolute; left:28px; top:178px; width:230px; height:52px; background:#8d9096; color:#fff; display:flex; align-items:center; justify-content:space-between; padding:0 18px; } .ib-gd b { font-size:20px; font-weight:900; } .ib-gd span { font-size:15px; opacity:.85; }
  .ib-gd { width:150px; } .ib-gd.lg { left:186px; width:150px; background:#6f7278; }
  .ib-ch { position:absolute; left:148px; width:66px; background:#2a2c30; color:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; line-height:1; }
  .ib-ch small { font-size:10px; letter-spacing:.08em; color:#9aa0aa; } .ib-ch b { font-size:30px; font-weight:400; } .ib-ch.lk { background:#bfc2c6; } .ib-ch.lk b, .ib-ch.lk small { color:#8a8d92; }
  .ib-rm { position:absolute; background:linear-gradient(135deg,#2c2e33,#24262a); color:#fff; box-shadow:0 0 0 3px rgba(0,0,0,.12), 0 4px 8px rgba(0,0,0,.25); overflow:hidden; }
  .ib-rm::before { content:""; position:absolute; inset:0; background:repeating-linear-gradient(60deg,rgba(255,255,255,.025) 0 2px,transparent 2px 14px); pointer-events:none; }
  .ib-rm .bar { position:absolute; left:0; top:0; bottom:0; width:12px; background:var(--rc); }
  .ib-rm .art { position:absolute; inset:0; background:var(--art) center 60%/cover; opacity:.32; filter:saturate(.7); -webkit-mask:linear-gradient(90deg,transparent 0,#000 40%); mask:linear-gradient(90deg,transparent 0,#000 40%); }
  .ib-rm .tt { position:absolute; left:22px; top:8px; font-size:24px; font-weight:900; display:flex; align-items:center; gap:6px; }
  .ib-rm .lv { display:flex; gap:2px; } .ib-rm .lv i { width:5px; height:15px; background:#fff; } .ib-rm .lv i.o { background:rgba(255,255,255,.2); }
  .ib-rm .st { position:absolute; left:22px; top:40px; font-size:14px; font-weight:800; color:#c8ccd4; }
  .ib-rm .ic { position:absolute; right:-14px; top:-14px; width:56px; height:56px; border-radius:50%; background:#1b1c1f; border:3px solid var(--rc); display:grid; place-items:center; } .ib-rm .ic > i { width:34px; height:34px; display:grid; place-items:center; margin:6px 6px 0 0; } .ib-rm .ic svg { width:100%; height:100%; }
  .ib-rm .ic.ready { animation:icReady 1.4s ease-in-out infinite; box-shadow:0 0 0 3px rgba(255,255,255,.9), 0 0 14px var(--rc); }
  @keyframes icReady { 50% { transform:scale(1.08); } }
  .gain { position:absolute; left:50%; top:96px; transform:translateX(-50%); display:flex; gap:18px; background:rgba(12,13,15,.88); border:1px solid rgba(255,255,255,.2); padding:8px 22px; z-index:90; pointer-events:none; animation:gainIn 1.9s ease forwards; }
  .gain span { display:flex; align-items:center; gap:6px; } .gain i { width:30px; height:30px; display:grid; place-items:center; font-style:normal; } .gain i svg { width:100%; height:100%; } .gain .cn { font-size:22px; font-weight:900; color:#ffd36a; } .gain b { font-size:21px; color:#fff; }
  @keyframes gainIn { 0% { opacity:0; transform:translate(-50%,8px); } 12% { opacity:1; transform:translate(-50%,0); } 80% { opacity:1; } 100% { opacity:0; transform:translate(-50%,-6px); } }
  .ib-rm .ic .cn { font-style:normal; font-size:24px; font-weight:900; color:#ffd36a; } .ib-rm .ic.none { border-color:#6f747d; font-size:26px; color:#9aa0aa; }
  .ib-rm .gn { position:absolute; right:10px; bottom:14px; font-size:28px; line-height:1; } .ib-rm .gn b { font-weight:400; } .ib-rm .gn small { font-size:16px; color:#9aa0aa; }
  .ib-rm .sg { position:absolute; left:22px; right:70px; bottom:8px; display:flex; gap:3px; } .ib-rm .sg i { flex:1; height:5px; background:rgba(255,255,255,.18); } .ib-rm .sg i.on { background:var(--rc); }
  .ib-rm.empty { background:rgba(255,255,255,.4); border:2px dashed #9a9ea4; box-shadow:none; color:#4a4d52; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; }
  .ib-rm.empty::before { display:none; } .ib-rm.empty b { font-size:34px; font-weight:300; line-height:1; } .ib-rm.empty span { font-size:16px; font-weight:800; } .ib-rm.empty em { font-style:normal; display:flex; align-items:center; gap:2px; font-size:14px; } .ib-rm.empty em svg { width:22px; height:22px; } .ib-rm.empty em i { font-style:normal; margin-right:6px; }
  .ib-rm.lock { background:transparent; border:1px solid #c4c7cb; box-shadow:none; color:#a4a7ac; display:grid; place-items:center; text-align:center; font-size:13px; letter-spacing:.04em; cursor:default; } .ib-rm.lock::before { display:none; }
  .ib-rm .gn .pp { width:16px; height:16px; fill:#c8ccd4; margin-right:4px; vertical-align:2px; }
  .ib-rm.dorm .gn small { color:#9aa0aa; }
  .ib-cor { position:absolute; width:62px; height:52px; background:#111; color:#4fd8b0; display:flex; align-items:center; justify-content:center; gap:1px; box-shadow:0 2px 5px rgba(0,0,0,.3); }
  .ib-cor i { font-style:normal; font-size:9px; letter-spacing:-2px; } .ib-cor svg { width:26px; height:26px; fill:#4fd8b0; }
  .ib-cc { position:absolute; left:890px; top:104px; width:358px; height:136px; background:linear-gradient(135deg,#2a2b2f,#1b1c1f); color:#fff; overflow:hidden; box-shadow:0 0 0 3px rgba(0,0,0,.12), 0 4px 8px rgba(0,0,0,.25); }
  .ib-cc::before { content:""; position:absolute; inset:0; background:linear-gradient(rgba(255,180,90,.08) 1px,transparent 1px) 0 0/16px 16px, linear-gradient(90deg,rgba(255,180,90,.08) 1px,transparent 1px) 0 0/16px 16px; }
  .ib-cc .tt { position:absolute; left:24px; top:14px; font-size:30px; font-weight:900; } .ib-cc .sub { position:absolute; left:26px; top:54px; font-size:10px; letter-spacing:.1em; color:#9aa0aa; }
  .ib-cc .vv { position:absolute; right:22px; top:6px; font-size:72px; font-weight:300; color:#ffb44a; line-height:1; } .ib-cc .vv small { font-size:18px; color:#c8ccd4; margin-right:4px; }
  .ib-cc .ss { position:absolute; left:24px; bottom:12px; display:flex; gap:22px; } .ib-cc .ss small { display:block; font-size:12px; color:#9aa0aa; } .ib-cc .ss b { font-size:22px; font-weight:500; }
  .ib-yd { position:absolute; width:290px; height:108px; background:#3b3d42; color:#fff; padding:12px 18px; box-shadow:0 0 0 3px rgba(0,0,0,.12); background-image:repeating-linear-gradient(45deg,rgba(0,0,0,.12) 0 10px,transparent 10px 20px); }
  .ib-yd .tt { font-size:22px; font-weight:900; } .ib-yd .st { font-size:14px; color:#f0d9a8; margin-top:4px; } .ib-yd .yg { position:absolute; right:16px; bottom:12px; font-size:16px; font-weight:800; color:#8fd3ff; }
  .ib-log { width:680px !important; } .ib-log .ls { max-height:380px; overflow-y:auto; font-size:15px; } .ib-log .ls div { display:flex; gap:10px; padding:5px 0; border-bottom:1px solid rgba(255,255,255,.06); color:#c8ccd4; }
  .ib-log .ls div.bad { color:#ff8a7a; } .ib-log span { color:#7f8590; } .ib-log em { font-style:normal; color:#8fd3ff; } .ib-log small { margin-left:auto; color:#7f8590; }
  .ib-nz { position:absolute; left:50%; top:46%; transform:translate(-50%,-50%); text-align:center; color:#fff; display:flex; flex-direction:column; align-items:center; gap:8px; }
  .ib-nz small { font-size:14px; letter-spacing:.2em; color:#8fd3ff; } .ib-nz b { font-size:30px; font-weight:900; } .ib-nz span { font-size:16px; color:#b8bcc4; } .ib-nz .btn { margin-top:10px; padding:10px 34px; background:linear-gradient(90deg,#118bc4,#24a8e8); font-size:19px; font-weight:900; }
  .bz-pn .zr { display:flex; align-items:flex-start; gap:10px; } .bz-pn .zr p { flex:1; } .bz-pn .zr .chg { flex:none; margin-top:8px; padding:5px 12px; border:1px solid rgba(143,211,255,.6); color:#8fd3ff; font-size:14px; font-weight:800; }
  .sk-box .lack { font-size:14px; color:#f2c14e; }
  .modal.bz-zp .box { position:relative; width:1000px; padding:20px 24px; } .bz-zp .hd b { font-size:24px; font-weight:900; } .bz-zp .hd span { display:block; margin-top:4px; font-size:15px; color:#9aa0aa; }
  .bz-zp .zl { margin-top:14px; display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
  .bz-zp .zc { position:relative; height:170px; background:#1c1d21; border:1px solid rgba(255,255,255,.12); overflow:hidden; }
  .bz-zp .zc .im { position:absolute; inset:0; background:center/cover; opacity:.45; } .bz-zp .zc .tx { position:absolute; inset:0; padding:12px 14px; background:linear-gradient(90deg,rgba(0,0,0,.8),rgba(0,0,0,.2)); }
  .bz-zp .zc .tx > b { font-size:15px; color:#8fd3ff; } .bz-zp .zc .n { font-size:21px; font-weight:900; } .bz-zp .zc .o { display:flex; align-items:center; gap:6px; margin-top:8px; font-size:16px; } .bz-zp .zc .o > i { width:30px; height:30px; display:grid; place-items:center; } .bz-zp .zc .o svg { width:100%; height:100%; }
  .bz-zp .zc .o .cn { font-style:normal; font-size:18px; font-weight:900; color:#ffd36a; background:radial-gradient(#5a4a1c,#2a220c); border-radius:50%; border:1.5px solid #d9b24a; }
  .bz-zp .zc .dg { position:absolute; left:14px; bottom:10px; font-size:14px; color:#b8bcc4; } .bz-zp .zc .dg b { color:#ff9a7a; }
  .bz-zp .zc .tag { position:absolute; right:0; top:10px; font-size:13px; font-weight:900; background:#55575c; padding:2px 8px; } .bz-zp .zc .tag.on { background:#2fa84f; }
  .bz-zp .zc.on { border:2px solid #2aa7ec; } .bz-zp .zc.lk, .bz-zp .zc.used { opacity:.55; }
  .ib-i { position:absolute; left:322px; top:16px; width:46px; height:46px; background:#2a2c30; color:#fff; font-size:24px; font-weight:900; font-family:serif; display:grid; place-items:center; border-radius:4px; }
  .ib-rm.dorm.lock { font-size:13px; }
  .ib-pend { position:absolute; left:0; right:0; bottom:0; height:62px; background:linear-gradient(180deg,#26282c,#1c1d20); display:flex; align-items:center; gap:10px; padding-left:20px; box-shadow:0 -2px 8px rgba(0,0,0,.25); }
  .ib-pend .pl { display:flex; align-items:center; gap:8px; font-size:20px; font-weight:800; color:#9aa0aa; padding-right:20px; border-right:2px solid rgba(255,255,255,.15); height:40px; } .ib-pend .pl i { font-style:normal; width:28px; height:28px; border:2px solid #9aa0aa; border-radius:50%; display:grid; place-items:center; font-size:15px; }
  .ib-pend .pi { position:relative; height:44px; min-width:140px; display:flex; align-items:center; justify-content:center; padding:0 16px; color:#6f747d; font-size:19px; font-weight:900; margin-top:6px; }
  .ib-pend .pi.on { color:#fff; } .ib-pend .pi.on.warn { background:#13806e; } .ib-pend .pi.on.bad { background:#a8322c; }
  .ib-pend .pi em { position:absolute; left:50%; top:-14px; transform:translateX(-50%); white-space:nowrap; font-style:normal; font-size:15px; font-weight:800; background:#2aa7ec; color:#fff; padding:1px 10px; border-radius:10px; }
  /* a room's own view */
  .rv-bg { position:absolute; inset:0; background:#141517; }
  .rv-nb { position:absolute; background:#202226 center/cover; filter:brightness(.45) saturate(.6); overflow:hidden; } .rv-nb span { position:absolute; left:12px; bottom:10px; font-size:16px; font-weight:800; color:#fff; text-shadow:0 1px 3px #000; }
  .rv-nb.plan { background:#0f1519 linear-gradient(rgba(143,211,255,.08) 1px,transparent 1px) 0 0/20px 20px; } .rv-nb:hover { filter:brightness(.6); }
  .rv-nb.l { left:0; top:140px; width:236px; height:300px; } .rv-nb.r { right:0; top:140px; width:256px; height:300px; } .rv-nb.d { left:450px; right:0; bottom:0; height:170px; }
  .rv-fr { position:absolute; left:270px; top:86px; width:716px; height:408px; background:#fff; clip-path:polygon(0 0,calc(100% - 30px) 0,100% 30px,100% 100%,0 100%); }
  .rv-fr .bz-cv { left:7px; top:7px; width:calc(100% - 14px); height:calc(100% - 14px); clip-path:polygon(0 0,calc(100% - 26px) 0,100% 26px,100% 100%,0 100%); } .rv-fr.nz { display:grid; place-items:center; border:7px solid #fff; background:#0f1519 linear-gradient(rgba(143,211,255,.06) 1px,transparent 1px) 0 0/20px 20px; }
  .rv-fr .ib-nz { position:static; transform:none; }
  .rv-nm { position:absolute; left:322px; top:16px; height:46px; display:flex; align-items:center; gap:10px; background:#2a2c30; padding:0 16px; font-size:22px; color:#fff; }
  .rv-nm > i { width:22px; height:22px; transform:rotate(45deg); } .rv-nm .lv { display:flex; gap:3px; } .rv-nm .lv u { width:6px; height:20px; background:#f5c400; } .rv-nm .lv u.o { background:rgba(255,255,255,.2); }
  .rv-tabs { position:absolute; left:0; top:86px; width:132px; background:rgba(40,42,46,.95); z-index:4; } .rv-tabs .t { height:128px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:#fff; border-bottom:1px solid rgba(255,255,255,.1); }
  .rv-tabs .t svg { width:52px; height:52px; } .rv-tabs .t b { font-size:19px; font-weight:900; } .rv-tabs .t.on { background:#3a3d42; box-shadow:inset 4px 0 #2aa7ec; }
  .rv-dw { position:absolute; left:132px; top:86px; width:430px; max-height:600px; background:rgba(22,23,26,.97); border:1px solid rgba(255,255,255,.12); padding:18px 20px; z-index:4; transform:translateX(-20px); opacity:0; pointer-events:none; transition:.2s; overflow:auto; }
  .rv-dw.open { transform:none; opacity:1; pointer-events:auto; }
  .rv-dw .hd { font-size:22px; font-weight:900; margin-bottom:8px; } .rv-dw .hd small { display:block; font-size:13px; color:#8fd3ff; letter-spacing:.1em; font-weight:700; margin-top:2px; }
  .rv-dw p { font-size:15px; color:#b8bcc4; line-height:1.55; margin:4px 0 10px; }
  .rv-dw .kv { display:flex; justify-content:space-between; font-size:16px; padding:6px 0; border-bottom:1px solid rgba(255,255,255,.07); } .rv-dw .kv span { color:#9aa0aa; } .rv-dw .kv b.ok { color:#5fd36a; } .rv-dw .kv b.mid { color:#f2c14e; } .rv-dw .kv b.bad { color:#ff5a4a; }
  .rv-dw .lgs { margin-top:8px; font-size:14px; color:#c8ccd4; } .rv-dw .lgs span { color:#7f8590; margin-right:8px; } .rv-dw .lgs .bad { color:#ff8a7a; }
  .rv-dw .bt2 { display:flex; gap:10px; margin-top:14px; } .rv-dw .up, .rv-dw .chg { flex:1; margin-top:14px; height:46px; display:grid; place-items:center; font-size:17px; font-weight:900; background:#2a2c31; border:1px solid rgba(255,255,255,.3); } .rv-dw .bt2 .up, .rv-dw .bt2 .chg { margin-top:0; } .rv-dw .up { background:linear-gradient(90deg,#118bc4,#24a8e8); border:none; }
  .rv-dw .sl { display:flex; flex-wrap:wrap; gap:10px; }
  .rv-dw .s { position:relative; width:118px; height:156px; background:#202227; border:1px solid rgba(255,255,255,.15); overflow:hidden; }
  .rv-dw .s .im { position:absolute; left:0; right:0; top:0; height:108px; background:center 10%/cover; } .rv-dw .s .im::after { content:""; position:absolute; inset:0; background:linear-gradient(180deg,rgba(0,0,0,0) 60%,#202227); }
  .rv-dw .s em { position:absolute; left:4px; top:4px; font-style:normal; font-size:12px; font-weight:900; background:#e0a400; color:#221800; padding:1px 5px; }
  .rv-dw .s .nm { position:absolute; left:6px; right:6px; top:100px; font-size:15px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .rv-dw .s .fb { position:absolute; left:6px; right:6px; top:126px; height:5px; background:rgba(255,255,255,.15); } .rv-dw .s .fb i { display:block; height:100%; } .rv-dw .s .ft { position:absolute; left:6px; top:134px; font-size:13px; color:#b8bcc4; }
  .rv-dw .s.e { display:flex; flex-direction:column; align-items:center; justify-content:center; border-style:dashed; color:#8a909a; } .rv-dw .s.e b { font-size:34px; font-weight:300; line-height:1; } .rv-dw .s.e span { font-size:14px; }
  .rv-dw .s.out .im { filter:grayscale(1) brightness(.55); } .rv-dw .s.out .ft { color:#ff6a5a; font-weight:700; }
  .rv-cd { position:absolute; left:0; bottom:0; width:440px; height:200px; background:rgba(38,40,44,.96); padding:24px 26px; z-index:3; }
  .rv-cd::before { content:""; position:absolute; left:16px; top:14px; width:12px; height:12px; border-left:2px solid #9aa0aa; border-top:2px solid #9aa0aa; }
  .rv-cd .ic { position:absolute; left:28px; top:30px; width:100px; height:100px; border-radius:50%; background:radial-gradient(#3a3d43,#1b1c1f 70%); border:3px solid #6a6e75; display:grid; place-items:center; } .rv-cd .ic > i { width:62px; height:62px; display:grid; place-items:center; } .rv-cd .ic svg { width:100%; height:100%; }
  .rv-cd .ic .cn { font-style:normal; font-size:44px; font-weight:900; color:#ffd36a; } .rv-cd .ic b { position:absolute; right:8px; bottom:6px; font-size:16px; text-shadow:0 1px 3px #000; } .rv-cd .ic.dorm { font-size:34px; font-weight:900; color:#8fd3ff; }
  .rv-cd .tx { position:absolute; left:146px; top:60px; } .rv-cd .tx b { display:block; font-size:24px; font-weight:900; } .rv-cd .tx span { font-size:19px; color:#c8ccd4; }
  .rv-cd .rt { position:absolute; right:26px; top:24px; text-align:right; } .rv-cd .rt em { display:block; font-style:normal; font-size:18px; font-weight:900; color:#f5c400; } .rv-cd .rt em.stop { color:#ff5a4a; } .rv-cd .rt span { font-size:18px; color:#c8ccd4; }
  .rv-cd .pb { position:absolute; left:28px; right:26px; bottom:22px; height:7px; background:rgba(255,255,255,.12); } .rv-cd .pb i { display:block; height:100%; background:#c8ccd4; }
  .rv-cd .get { position:absolute; right:26px; bottom:42px; padding:6px 22px; background:linear-gradient(90deg,#118bc4,#24a8e8); font-size:17px; font-weight:900; } .rv-cd .get.dis { background:#3a3c41; color:#888; }
  .rv-eye { position:absolute; right:30px; bottom:30px; width:64px; height:64px; display:grid; place-items:center; z-index:5; } .rv-eye svg { width:52px; height:52px; filter:drop-shadow(0 2px 4px #000); }
  .rv-only .rv-tabs, .rv-only .rv-dw, .rv-only .rv-cd, .rv-only .rv-nm, .rv-only .rv-nb { opacity:0; pointer-events:none; } .rv-only .rv-fr { left:0; top:0; width:1280px; height:720px; clip-path:none; background:#000; } .rv-only .rv-fr .bz-cv { left:0; top:0; width:100%; height:100%; clip-path:none; } .rv-only .top { opacity:.5; }
  /* base skills */
  .ski { display:inline-grid; place-items:center; width:26px; height:26px; border-radius:50%; font-style:normal; font-size:15px; font-weight:900; color:#1b1c1f; background:#f5c400; box-shadow:0 0 0 2px rgba(0,0,0,.4); vertical-align:middle; }
  .ski.big { width:34px; height:34px; font-size:19px; }
  .ski.c { background:#f5c400; } .ski.r { background:#4fb8ff; } .ski.m { background:#8ed42a; } .ski.a { background:#ffffff; } .ski.z { background:#ff9a3c; } .ski.f { background:#5fd3a8; } .ski.d { background:#ff6a5a; } .ski.p { background:#b48aff; } .ski.s { background:#9ad8ff; }
  .ski.lk { filter:grayscale(1) brightness(.5); }
  .bz-sel { position:absolute; inset:0; z-index:70; background:linear-gradient(90deg,#d9dadd 0,#d9dadd 440px,#f2f2f3 440px); color:#1b1c1f; }
  .bz-sel .bk { position:absolute; left:20px; top:16px; width:110px; height:46px; background:#2a2c30; color:#fff; font-size:34px; display:grid; place-items:center; }
  .bz-sel .lp { position:absolute; left:0; top:80px; width:440px; bottom:0; padding:0 26px; }
  .bz-sel .rt { display:flex; justify-content:space-between; align-items:baseline; background:#c4c6ca; padding:10px 14px; } .bz-sel .rt b { font-size:22px; font-weight:900; } .bz-sel .rt span { font-size:17px; font-weight:800; color:#4a4d52; }
  .bz-sel .fo { margin-top:12px; background:#ececed; border:1px solid #c4c6ca; padding:14px; min-height:220px; } .bz-sel .fo.none { display:grid; place-items:center; color:#8a8d92; font-size:17px; }
  .bz-sel .fo .nm { font-size:30px; font-weight:900; } .bz-sel .fo .fb { display:flex; align-items:center; gap:8px; margin:6px 0 10px; background:#55585e; padding:4px 10px; border-radius:4px; }
  .bz-sel .fo .fb .sm { font-style:normal; width:24px; height:24px; border-radius:50%; background:#f5c400; display:grid; place-items:center; font-size:16px; } .bz-sel .fo .fb .bar { flex:1; height:6px; background:rgba(255,255,255,.25); } .bz-sel .fo .fb .bar b { display:block; height:100%; } .bz-sel .fo .fb span { color:#fff; font-size:18px; }
  .bz-sel .sk { margin-top:10px; } .bz-sel .sk .tag { display:inline-flex; align-items:center; gap:6px; background:#2a2c30; color:#fff; padding:3px 10px 3px 4px; font-size:17px; } .bz-sel .sk.fit .tag { background:#1f6f9c; }
  .bz-sel .sk p { margin:5px 0 0; font-size:16px; line-height:1.45; color:#2a2c30; } .bz-sel .sk p em { font-style:normal; font-weight:900; color:#1a8fd6; } .bz-sel .sk.lk { opacity:.55; } .bz-sel .sk .no { color:#8a8d92; }
  .bz-sel .pv { margin-top:12px; background:#2a2c30; color:#fff; padding:10px 14px; } .bz-sel .pv .lb { font-size:14px; color:#9aa0aa; margin-bottom:4px; }
  .bz-sel .pv .kv { display:flex; justify-content:space-between; font-size:16px; padding:3px 0; } .bz-sel .pv .kv span { color:#c8ccd4; } .bz-sel .pv em { font-style:normal; color:#4fb8ff; margin-left:6px; } .bz-sel .pv b.ok { color:#5fd36a; } .bz-sel .pv b.mid { color:#f2c14e; } .bz-sel .pv b.bad { color:#ff5a4a; }
  .bz-sel .rp { position:absolute; left:460px; right:20px; top:14px; bottom:0; }
  .bz-sel .tabs { display:flex; align-items:center; background:#1d1f23; height:52px; padding:0 10px; } .bz-sel .tb { color:#c8ccd4; font-size:18px; font-weight:800; padding:0 22px; height:100%; display:grid; place-items:center; } .bz-sel .tb.on { color:#4fb8ff; box-shadow:inset 0 -3px #4fb8ff; }
  .bz-sel .cnt { margin-left:auto; color:#fff; font-size:20px; padding-right:10px; }
  .bz-sel .gl { position:absolute; left:0; right:0; top:64px; bottom:84px; overflow-y:auto; display:grid; grid-template-columns:repeat(5,1fr); gap:10px; align-content:start; padding:2px; }
  .bz-sel .pc { position:relative; height:220px; background:#2a2c30; overflow:hidden; box-shadow:0 2px 5px rgba(0,0,0,.25); }
  .bz-sel .pc .im { position:absolute; inset:0 0 56px 0; background:center 12%/cover; } .bz-sel .pc .im::after { content:""; position:absolute; inset:0; background:linear-gradient(180deg,rgba(0,0,0,0) 60%,rgba(20,21,24,.95)); }
  .bz-sel .pc.on { box-shadow:0 0 0 4px #2aa7ec; } .bz-sel .pc.on .im { filter:brightness(.8) sepia(.3) hue-rotate(170deg) saturate(1.4); }
  .bz-sel .pc .no { position:absolute; right:8px; top:4px; font-size:54px; font-weight:400; color:#fff; text-shadow:0 2px 6px #000; line-height:1; }
  .bz-sel .pc .pt { position:absolute; left:0; top:6px; background:rgba(20,21,24,.85); color:#fff; font-size:13px; font-weight:800; padding:2px 8px; }
  .bz-sel .pc .sk { position:absolute; left:6px; bottom:56px; display:flex; gap:4px; margin:0; } .bz-sel .pc .sk span { opacity:.45; } .bz-sel .pc .sk span.fit { opacity:1; filter:drop-shadow(0 0 4px rgba(255,255,255,.8)); }
  .bz-sel .pc .fb { position:absolute; left:8px; right:8px; bottom:42px; height:5px; background:rgba(255,255,255,.2); } .bz-sel .pc .fb b { display:block; height:100%; }
  .bz-sel .pc .nm { position:absolute; left:8px; right:8px; bottom:10px; color:#fff; font-size:18px; font-weight:900; text-align:right; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .bz-sel .pc.out .im { filter:grayscale(1) brightness(.5); }
  .bz-sel .ft { position:absolute; left:0; right:0; bottom:16px; display:flex; justify-content:space-between; } .bz-sel .ft .btn { height:56px; display:grid; place-items:center; font-size:22px; font-weight:900; padding:0 40px; }
  .bz-sel .ft .clr { background:#3a3c41; color:#fff; } .bz-sel .ft .ok { background:linear-gradient(90deg,#118bc4,#24a8e8); color:#fff; padding:0 70px; }
  /* the crew table in a room */
  .rv-dw .crew { display:flex; gap:8px; } .rv-dw .cc { position:relative; width:118px; height:150px; background:#202227 center 12%/cover; border:1px solid rgba(255,255,255,.15); overflow:hidden; }
  .rv-dw .cc::after { content:""; position:absolute; inset:0; background:linear-gradient(180deg,rgba(0,0,0,0) 50%,rgba(15,16,18,.95)); } .rv-dw .cc > * { position:relative; z-index:1; }
  .rv-dw .cc .st { position:absolute; left:0; right:0; bottom:20px; text-align:center; font-size:14px; font-weight:900; color:#fff; } .rv-dw .cc .st.out { color:#ff6a5a; }
  .rv-dw .cc .fb2 { position:absolute; left:6px; right:6px; bottom:8px; height:5px; background:rgba(255,255,255,.2); } .rv-dw .cc .fb2 b { display:block; height:100%; }
  .rv-dw .cc .sk2 { position:absolute; left:4px; top:4px; display:flex; gap:3px; } .rv-dw .cc .sk2 .ski { width:22px; height:22px; font-size:13px; }
  .rv-dw .cc.e { display:grid; place-items:center; border-style:dashed; color:#8a909a; font-size:30px; } .rv-dw .cc.e::after { display:none; }
  .rv-dw .tb2 { margin-top:12px; width:100%; border-collapse:collapse; font-size:16px; } .rv-dw .tb2 td { padding:6px 4px; border-bottom:1px solid rgba(255,255,255,.08); } .rv-dw .tb2 td:first-child { color:#c8ccd4; font-weight:800; }
  .rv-dw .tb2 .b0 { text-align:right; color:#fff; } .rv-dw .tb2 .b1 { text-align:right; width:90px; } .rv-dw .tb2 .b1 i { font-style:normal; display:inline-block; min-width:64px; text-align:center; padding:1px 6px; background:#4fb8ff; color:#0b1a24; font-weight:900; }
  .rv-dw .tb2 .b1 i.n { background:#5fd3a8; } .rv-dw .tb2 .b1 i.z { background:#55575c; color:#c8ccd4; }
  .rv-dw .skl { margin-top:10px; font-size:14px; color:#b8bcc4; } .rv-dw .skl div { display:flex; align-items:center; gap:6px; padding:3px 0; } .rv-dw .skl b { color:#fff; } .rv-dw .skl em { font-style:normal; color:#4fb8ff; font-weight:800; margin-left:auto; }
  .rv-dw .chg2 { margin-top:12px; height:44px; display:grid; place-items:center; font-size:17px; font-weight:900; background:linear-gradient(90deg,#118bc4,#24a8e8); }
  /* choosing a gathering site: the chapter map */
  .zm { position:absolute; inset:0; z-index:70; background:#0c0d10; overflow:hidden; }
  .zm .zm-ln { display:none; }
  .zm .zm-strip { top:150px; }
  .zm .node.plain { opacity:.5; pointer-events:none; filter:grayscale(.6); } .zm .node.plain .box { background:linear-gradient(90deg,#9a9ca0,#7d7f84); }
  .zm .node.site { z-index:2; } .zm .node.site .box { box-shadow:0 0 0 2px #2aa7ec, 0 0 16px rgba(42,167,236,.6); }
  .zm .node .zys { position:absolute; right:-36px; top:46px; display:flex; gap:3px; } .zm .node .zys i { width:28px; height:28px; border-radius:50%; background:radial-gradient(#4a4d53,#26282c 70%); border:1.5px solid #b8bcc4; display:grid; place-items:center; } .zm .node .zys svg { width:22px; height:22px; }
  .zm-pn .gt .lb span { font-weight:500; color:#7f8590; margin-left:6px; font-size:12px; }
  .zm-pn .gt .it { margin-top:6px; } .zm-pn .gt .it.sub > i { width:40px; height:40px; } .zm-pn .gt .it.sub > i svg { width:28px; height:28px; } .zm-pn .gt .it em { margin-left:auto; font-style:normal; font-size:20px; color:#4fb8ff; white-space:nowrap; } .zm-pn .gt .it em small { font-size:12px; color:#7f8590; }
  .zm-pn .gt .it.sub b { font-size:16px; } .zm-pn .row3 b { font-size:18px !important; color:#ffb48a !important; } .zm-pn .row3 i { display:block; margin:2px 0 0 !important; }
  .zm-pn .oth { margin-top:8px; font-size:14px; color:#8fd3ff; }
  .zm-bk { position:absolute; left:20px; top:16px; width:110px; height:46px; background:rgba(30,32,36,.92); color:#fff; font-size:34px; display:grid; place-items:center; z-index:3; }
  .zm-ttl { position:absolute; left:160px; top:14px; color:#fff; } .zm-ttl small { display:block; font-size:13px; letter-spacing:.16em; color:#8fd3ff; } .zm-ttl b { font-size:30px; font-weight:900; } .zm-ttl span { display:block; font-size:15px; color:#c8ccd4; margin-top:2px; }
  .zm .node.lk { filter:grayscale(1) brightness(.6); } .zm .node.lk .box { background:linear-gradient(90deg,#6a6c70,#55575c); color:#ddd; }
  .zm .node.here .hx { background:linear-gradient(#ffcf5a,#e09a10); } .zm .node.here .hx i { background:#f5b52a; box-shadow:inset 0 0 0 2px #fff; }
  .zm .node .dm .cn { font-style:normal; font-size:26px; font-weight:900; color:#ffd36a; }
  .zm .zt { position:absolute; left:18px; top:52px; font-size:13px; font-weight:900; background:#3a3c41; color:#fff; padding:2px 8px; white-space:nowrap; } .zm .zt.on { background:#e09a10; color:#221400; } .zm .zt.lk { background:#7a2a2a; }
  .zm-pn { position:absolute; right:0; top:0; bottom:0; width:470px; background:linear-gradient(90deg,rgba(10,11,13,.6),rgba(10,11,13,.94) 14%,rgba(10,11,13,.97)); padding:24px 30px 24px 56px; color:#fff; transition:transform .24s, opacity .24s; }
  .zm-pn.in { animation:zmIn .26s ease both; } .zm-pn.swap { animation:zmSw .22s ease both; } .zm-pn.out { opacity:0; transform:translateX(30px); }
  @keyframes zmIn { from { transform:translateX(100%); } } @keyframes zmSw { from { opacity:0; transform:translateX(24px); } }
  .zm-pn .im { position:relative; height:180px; background:center/cover; box-shadow:0 0 0 2px rgba(255,255,255,.25); } .zm-pn .im span { position:absolute; left:0; bottom:0; background:rgba(0,0,0,.75); font-size:22px; padding:2px 12px; }
  .zm-pn .hd { margin-top:12px; } .zm-pn .hd small { display:block; font-size:14px; color:#8fd3ff; } .zm-pn .hd b { font-size:28px; font-weight:900; }
  .zm-pn p { font-size:15px; color:#b8bcc4; line-height:1.55; margin:6px 0 10px; }
  .zm-pn .gt { background:rgba(255,255,255,.06); padding:10px 12px; } .zm-pn .gt .lb { font-size:14px; font-weight:900; color:#9aa0aa; margin-bottom:6px; }
  .zm-pn .gt .it { display:flex; align-items:center; gap:12px; } .zm-pn .gt .it > i { width:54px; height:54px; flex:none; border-radius:50%; background:radial-gradient(#3a3d43,#1b1c1f 70%); border:2px solid #6a6e75; display:grid; place-items:center; } .zm-pn .gt .it > i svg { width:40px; height:40px; }
  .zm-pn .gt .it .cn { font-style:normal; font-size:28px; font-weight:900; color:#ffd36a; } .zm-pn .gt .it b { display:block; font-size:19px; } .zm-pn .gt .it span { font-size:13px; color:#9aa0aa; line-height:1.4; }
  .zm-pn .row3 { display:flex; gap:10px; margin-top:10px; } .zm-pn .row3 > div { flex:1; background:rgba(255,255,255,.06); padding:8px 12px; } .zm-pn .row3 small { display:block; font-size:13px; color:#9aa0aa; } .zm-pn .row3 b { font-size:26px; color:#ff9a7a; } .zm-pn .row3 i { font-style:normal; font-size:12px; color:#7f8590; margin-left:6px; }
  .zm-pn .cl { display:flex; align-items:center; gap:4px; margin-top:4px; } .zm-pn .cl img { width:26px; height:26px; } .zm-pn .cl em { font-style:normal; font-size:14px; margin-right:6px; }
  .zm-pn .go2 { position:absolute; left:56px; right:30px; bottom:24px; height:62px; background:linear-gradient(90deg,#118bc4,#24a8e8); display:grid; place-items:center; font-size:22px; font-weight:900; }
  .zm-pn .go2.dis { background:#3a3c41; color:#888; } .zm-pn .go2.on { background:#e09a10; color:#221400; }
  /* the room's corner card names where it gathers, and opens the map */
  .rv-cd.site { cursor:pointer; } .rv-cd .site { position:absolute; left:0; right:0; top:0; height:30px; background:var(--sbg) center/cover; } .rv-cd .site::after { content:""; position:absolute; inset:0; background:linear-gradient(90deg,rgba(38,40,44,.95),rgba(38,40,44,.4)); }
  .rv-cd .site span { position:relative; z-index:1; display:flex; align-items:center; gap:8px; height:100%; padding-left:38px; font-size:14px; font-weight:800; color:#e8eaee; } .rv-cd .site span b { color:#8fd3ff; } .rv-cd .site span i { font-style:normal; margin-left:auto; margin-right:14px; color:#8fd3ff; }
  .rv-cd .sub { position:absolute; left:146px; bottom:40px; display:flex; gap:14px; } .rv-cd .sub span { display:flex; align-items:center; gap:4px; } .rv-cd .sub i { width:26px; height:26px; display:grid; place-items:center; } .rv-cd .sub svg { width:100%; height:100%; } .rv-cd .sub b { font-size:16px; color:#c8ccd4; }
  .rv-cd.site .ic { top:42px; } .rv-cd.site .tx { top:48px; } .rv-cd.site .tx span { display:block; font-size:17px; margin-top:2px; } .rv-cd.site .rt { top:40px; }
  /* missions */
  .ms-bg::after { content:""; position:absolute; left:0; right:0; top:0; height:80px; background:#1d1f23; }
  .ms-bg { position:absolute; inset:0; background:linear-gradient(rgba(0,0,0,.045) 1px, transparent 1px) 0 0/40px 40px, linear-gradient(90deg, rgba(0,0,0,.045) 1px, transparent 1px) 0 0/40px 40px, linear-gradient(90deg,#26282c 0,#26282c 250px,#e4e5e8 250px); }
  .ms-side { position:absolute; left:0; top:96px; width:250px; }
  .ms-tab { position:relative; height:96px; padding:20px 26px; color:#c8ccd4; border-bottom:1px solid rgba(255,255,255,.06); }
  .ms-tab small { display:block; font-size:13px; letter-spacing:.2em; color:#8a8f98; } .ms-tab b { font-size:26px; font-weight:900; color:#fff; } .ms-tab.on b { color:#1b1c1f; }
  .ms-tab.on { background:#e4e5e8; color:#1b1c1f; box-shadow:inset 6px 0 #2aa7ec; } .ms-tab.on small { color:#2aa7ec; }
  .ms-tab .dot { position:absolute; right:22px; top:34px; min-width:26px; height:26px; border-radius:13px; background:#d8423c; color:#fff; font-style:normal; font-size:16px; display:grid; place-items:center; padding:0 6px; }
  .ms-hd { position:absolute; left:280px; right:36px; top:90px; height:56px; display:flex; align-items:center; gap:20px; color:#1b1c1f; }
  .ms-hd .tt b { font-size:30px; font-weight:900; } .ms-hd .tt span { margin-left:10px; font-size:22px; color:#4a4d52; font-weight:700; }
  .ms-hd .rs { font-size:18px; color:#2a2c30; background:#fff; border:1px solid #c9cbcf; padding:4px 12px; } .ms-hd .rs b { color:#1b1c1f; }
  .ms-all { margin-left:auto; height:48px; padding:0 30px; display:grid; place-items:center; background:linear-gradient(90deg,#118bc4,#24a8e8); color:#fff; font-size:19px; font-weight:900; } .ms-all.dis { background:#b8bbc0; color:#eee; }
  .ms-list { position:absolute; left:280px; right:36px; top:158px; bottom:20px; overflow-y:auto; display:flex; flex-direction:column; gap:12px; padding-right:4px; }
  .ms-row { position:relative; flex:none; min-height:118px; background:#fbfbfc; color:#1b1c1f; display:flex; align-items:center; gap:20px; padding:12px 18px 12px 34px; border:1px solid #c9cbcf; box-shadow:0 2px 0 #c9cbcf; }
  .ms-row .bar { position:absolute; left:0; top:0; bottom:0; width:12px; background:#9a9da3; }
  .ms-row.ready { background:#e6f4fd; border-color:#2aa7ec; box-shadow:0 2px 0 #2aa7ec; } .ms-row.ready .bar { background:#2aa7ec; }
  .ms-row.done { background:#dcdde0; border-color:#c4c6ca; box-shadow:none; } .ms-row.done .bar { background:#b4b6ba; } .ms-row.done .tx, .ms-row.done .rw { opacity:.45; }
  .ms-row .tx { flex:1; min-width:0; } .ms-row .tx b { display:block; font-size:24px; font-weight:900; line-height:1.2; } .ms-row .tx span { display:block; font-size:17px; color:#4a4d52; margin-top:3px; }
  .ms-row .pg { display:flex; align-items:center; gap:12px; margin-top:10px; } .ms-row .pb { flex:1; max-width:380px; height:12px; background:#d4d6da; border-radius:6px; overflow:hidden; } .ms-row .pb i { display:block; height:100%; background:linear-gradient(90deg,#1a8fd6,#4fb8ff); border-radius:6px; }
  .ms-row.ready .pb i { background:linear-gradient(90deg,#14a06a,#3fd39a); } .ms-row .pg em { font-style:normal; font-size:22px; font-weight:800; color:#1b1c1f; min-width:90px; } .ms-row .pg em small { font-size:16px; color:#6f747d; font-weight:600; }
  .ms-row .rw { display:flex; gap:10px; } .ms-row .rw .idot { width:74px; height:74px; } .ms-row .rw .idot b { font-size:16px !important; }
  .ms-row .act { width:150px; height:64px; display:grid; place-items:center; font-size:22px; font-weight:900; background:#3a3c41; color:#fff; }
  .ms-row.ready .act { background:linear-gradient(90deg,#118bc4,#24a8e8); animation:msPulse 1.6s ease-in-out infinite; }
  .ms-row.done .act { background:transparent; color:#2fa84f; border:3px solid #2fa84f; transform:rotate(-8deg); width:120px; height:52px; font-size:20px; }
  .ms-sum { position:absolute; left:280px; top:90px; } 
  @keyframes msPulse { 50% { filter:brightness(1.2); } }
  /* public link */
  .rc-bg { position:absolute; inset:0; background:radial-gradient(ellipse at 70% 40%, rgba(42,167,236,.18), transparent 60%), repeating-linear-gradient(0deg, rgba(143,211,255,.05) 0 1px, transparent 1px 6px), #0e1216; }
  .rc-ttl { position:absolute; left:320px; top:14px; color:#fff; } .rc-ttl small { display:block; font-size:13px; letter-spacing:.2em; color:#8fd3ff; } .rc-ttl b { font-size:28px; font-weight:900; } .rc-ttl span { display:block; font-size:14px; color:#9aa0aa; }
  .rc-grid { position:absolute; left:60px; right:60px; top:110px; bottom:40px; display:grid; grid-template-columns:1fr 1fr; gap:18px; }
  .rc-s { position:relative; background:linear-gradient(135deg,#1c2228,#151a1f); border:1px solid rgba(143,211,255,.25); color:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; overflow:hidden; }
  .rc-s::before { content:""; position:absolute; inset:0; background:linear-gradient(rgba(143,211,255,.06) 1px,transparent 1px) 0 0/24px 24px, linear-gradient(90deg,rgba(143,211,255,.06) 1px,transparent 1px) 0 0/24px 24px; pointer-events:none; }
  .rc-s .no { position:absolute; left:18px; top:10px; font-size:40px; font-weight:300; color:rgba(143,211,255,.5); }
  .rc-s .plus { width:64px; height:64px; border:2px solid #8fd3ff; color:#8fd3ff; font-size:44px; font-weight:300; display:grid; place-items:center; transform:rotate(45deg); } .rc-s .plus i { font-style:normal; transform:rotate(-45deg); line-height:1; }
  .rc-s.idle b { font-size:24px; font-weight:900; margin-top:14px; } .rc-s span { font-size:15px; color:#9aa0aa; }
  .rc-s.run .tags { display:flex; gap:6px; } .rc-s.run .tags i { font-style:normal; font-size:15px; font-weight:800; background:#2a6f9c; padding:3px 10px; }
  .rc-s.run .cd { font-size:58px; font-weight:300; letter-spacing:.04em; color:#e8f6ff; } .rc-s .pb { width:60%; height:5px; background:rgba(255,255,255,.12); } .rc-s .pb i { display:block; height:100%; background:#4fb8ff; }
  .rc-s .rush { position:absolute; right:14px; bottom:12px; display:flex; align-items:center; gap:4px; font-size:15px; font-weight:800; background:#3a2a56; border:1px solid #b48aff; padding:4px 12px 4px 6px; } .rc-s .rush svg { width:24px; height:24px; }
  .rc-s.done { border-color:#ffd36a; box-shadow:inset 0 0 40px rgba(255,211,106,.25); animation:rcGlow 1.6s ease-in-out infinite; } .rc-s.done .dn { font-size:16px; letter-spacing:.3em; color:#ffd36a; } .rc-s.done b { font-size:30px; font-weight:900; }
  @keyframes rcGlow { 50% { box-shadow:inset 0 0 70px rgba(255,211,106,.4); } }
  .rc-m .box { width:640px !important; position:relative; } .rc-m .hd small { display:block; font-size:12px; letter-spacing:.2em; color:#8fd3ff; } .rc-m .hd b { font-size:24px; font-weight:900; }
  .rc-m .lb { font-size:15px; font-weight:900; color:#c8ccd4; margin-bottom:6px; display:flex; align-items:center; gap:8px; } .rc-m .lb span { font-weight:500; color:#7f8590; font-size:13px; }
  .rc-m .tm { margin-top:12px; } .rc-m .dg { display:flex; align-items:center; gap:10px; } .rc-m .col { display:flex; flex-direction:column; align-items:center; } .rc-m .col b { font-size:46px; font-weight:300; line-height:1.1; }
  .rc-m .ar { width:56px; height:26px; display:grid; place-items:center; background:#2a2c31; font-size:14px; } .rc-m .dg > span { font-size:40px; color:#7f8590; }
  .rc-m .tm p { font-size:13px !important; color:#9aa0aa !important; margin:6px 0 0 !important; }
  .rc-m .tg { margin-top:14px; } .rc-m .ref { margin-left:auto; font-size:13px; padding:3px 10px; background:#2a2c31; border:1px solid rgba(255,255,255,.25); } .rc-m .ref.off { color:#6f747d; border:none; background:none; }
  .rc-m .tl { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; } .rc-m .tag { height:46px; display:grid; place-items:center; background:#e8eaee; color:#1b1c1f; font-size:17px; font-weight:900; }
  .rc-m .tag.on { background:#2aa7ec; color:#fff; box-shadow:0 0 0 2px #fff inset; } .rc-m .tag.sp { color:#a86b00; } .rc-m .tag.sp.on { background:#e09a10; color:#221400; }
  .rc-m .fl { margin-top:8px; font-size:14px; color:#9aa0aa; } .rc-m .fl b { font-size:18px; } .rc-m .fl .r3 { color:#c8ccd4; } .rc-m .fl .r4 { color:#c49aff; } .rc-m .fl .r5 { color:#ffd36a; } .rc-m .fl .r6 { color:#ff9a3c; }
  .rc-m .ft { display:flex; align-items:center; gap:10px; margin-top:16px; } .rc-m .cost { flex:1; display:flex; align-items:center; gap:6px; font-size:15px; color:#c8ccd4; } .rc-m .cost i { width:32px; height:32px; } .rc-m .cost svg { width:100%; height:100%; } .rc-m .cost b.short { color:#ff6a5a; }
  .rc-m .ft .btn.n, .rc-m .ft .btn.ok { width:140px; height:48px; display:grid; place-items:center; font-weight:900; font-size:18px; } .rc-m .ft .n { background:#3a3b40; color:#ddd; } .rc-m .ft .ok { background:linear-gradient(90deg,#118bc4,#24a8e8); color:#fff; } .rc-m .ft .ok.dis { background:#2a2b2f; color:#777; }
  .rc-rv { position:absolute; inset:0; z-index:88; background:#06080a; overflow:hidden; animation:rcIn .4s ease both; }
  .rc-rv .fx { position:absolute; inset:-20%; background:conic-gradient(from 0deg, transparent, rgba(143,211,255,.25), transparent 30%); animation:rcSpin 6s linear infinite; }
  .rc-rv.r5 .fx { background:conic-gradient(from 0deg, transparent, rgba(255,211,106,.35), transparent 30%); } .rc-rv.r6 .fx { background:conic-gradient(from 0deg, transparent, rgba(255,140,60,.45), transparent 30%); }
  .rc-rv .im { position:absolute; left:50%; top:-20px; height:760px; transform:translateX(-40%); -webkit-mask-image:linear-gradient(90deg,transparent,#000 20%,#000 80%,transparent),linear-gradient(180deg,#000 75%,transparent); -webkit-mask-composite:source-in; mask-image:linear-gradient(90deg,transparent,#000 20%,#000 80%,transparent),linear-gradient(180deg,#000 75%,transparent); mask-composite:intersect; animation:rcArt .9s cubic-bezier(.2,.8,.2,1) both; }
  .rc-rv .nm { position:absolute; left:80px; bottom:90px; color:#fff; animation:rcNm .6s .4s ease both; } .rc-rv .nm .st { font-size:34px; color:#ffd36a; letter-spacing:4px; } .rc-rv.r3 .nm .st { color:#c8ccd4; } .rc-rv.r4 .nm .st { color:#c49aff; }
  .rc-rv .nm b { display:block; font-size:54px; font-weight:900; } .rc-rv .nm span { font-size:18px; color:#c8ccd4; } .rc-rv .nm i { display:inline-block; margin-left:12px; font-style:normal; font-size:18px; font-weight:900; padding:2px 10px; background:#ffd400; color:#111; } .rc-rv .nm i.pt { background:#2a6f9c; color:#fff; }
  .rc-rv .tap { position:absolute; right:40px; bottom:30px; font-size:15px; color:#7f8590; }
  @keyframes rcIn { from { opacity:0; } } @keyframes rcSpin { to { transform:rotate(360deg); } } @keyframes rcArt { from { opacity:0; transform:translateX(-30%) scale(1.06); filter:brightness(3); } } @keyframes rcNm { from { opacity:0; transform:translateY(20px); } }
  /* lobby skins: a background and a set of tiles each, picked in the personal settings */
  .lb-scene { position:absolute; inset:0; overflow:hidden; } .lb-scene .img { position:absolute; inset:-24px; background:center/cover; animation:lbDrift 40s ease-in-out infinite alternate; }
  @keyframes lbDrift { to { transform:translate(-14px,-8px) scale(1.03); } }
  .lb-scene .grade, .lb-scene .over { position:absolute; inset:0; pointer-events:none; } .lb-fx { position:absolute; inset:0; width:1280px; height:720px; pointer-events:none; }
  .lb-art.cut { left:70px; -webkit-mask-image:linear-gradient(180deg,#000 82%,transparent 99%); mask-image:linear-gradient(180deg,#000 82%,transparent 99%); filter:drop-shadow(0 0 2px rgba(0,0,0,.6)) drop-shadow(0 18px 30px rgba(0,0,0,.55)); }
  .sk-base .lb-vig, .sk-shelter .lb-vig, .sk-archive .lb-vig, .sk-line .lb-vig { background:linear-gradient(90deg,rgba(8,9,11,.35) 0,rgba(8,9,11,0) 25%,rgba(8,9,11,0) 52%,rgba(8,9,11,.2) 64%,rgba(8,9,11,.45) 100%), linear-gradient(180deg,rgba(0,0,0,.35),transparent 14%,transparent 84%,rgba(0,0,0,.35)); }
  /* 테오히 기본 — the archive terminal: a dim teal room, scan lines, glass tiles with corner brackets */
  .sk-base .lb-scene .img { background-image:var(--bgimg); filter:none; }
  .sk-base .lb-scene .grade { background:linear-gradient(120deg,rgba(10,40,44,.25),rgba(4,10,14,0) 50%,rgba(4,16,20,.4)); }
  .sk-base .lb-scene .over { background:repeating-linear-gradient(0deg,rgba(47,208,214,.05) 0 1px,transparent 1px 4px); }
  .sk-base .lb-scene .over::after { content:""; position:absolute; left:0; right:0; height:120px; background:linear-gradient(180deg,transparent,rgba(47,208,214,.08),transparent); animation:lbScan 7s linear infinite; }
  @keyframes lbScan { from { top:-120px; } to { top:720px; } }
  .sk-base .lt { background:rgba(10,22,26,.78); border:1px solid rgba(47,208,214,.35); backdrop-filter:blur(3px); box-shadow:inset 0 0 20px rgba(47,208,214,.08); }
  .sk-base .lt.teal { background:linear-gradient(135deg,rgba(31,143,149,.85),rgba(20,90,96,.85)); }
  /* 피난처 — the shelter: the dorm's lamplight behind, tiles like boards pinned to the wall with tape */
  .sk-shelter .lb-scene .img { background-image:var(--bgimg); filter:none; }
  .sk-shelter .lb-scene .grade { background:radial-gradient(ellipse at 30% 40%,rgba(255,170,80,.18),transparent 60%), linear-gradient(180deg,rgba(30,18,8,.1),rgba(20,12,6,.35)); }
  .sk-shelter .lt { background:rgba(42,30,20,.86); border:1px solid rgba(242,193,78,.3); border-radius:4px; box-shadow:0 6px 14px rgba(0,0,0,.45); }
  .sk-shelter .lt.teal { background:linear-gradient(135deg,rgba(150,108,40,.9),rgba(100,70,22,.9)); }
  .sk-shelter .lt .lb small, .sk-shelter .lt .deco { color:rgba(242,193,78,.75); } .sk-shelter .lt .deco { color:rgba(242,193,78,.18); }
  /* 아카이브 — the archive: an eclipse over the empty station, violet glass with a lattice of glyphs */
  .sk-archive .lb-scene .img { background-image:var(--bgimg); filter:none; }
  .sk-archive .lb-scene .grade { background:linear-gradient(110deg,rgba(40,20,70,.3),rgba(10,6,20,0) 45%,rgba(24,12,44,.45)); }
  .sk-archive .lb-scene .over { background:radial-gradient(circle at 18% 22%,rgba(180,138,255,.18),transparent 30%); }
  .sk-archive .lt { background:rgba(22,14,38,.8); border:1px solid rgba(180,138,255,.45); outline:1px solid rgba(180,138,255,.15); outline-offset:3px; backdrop-filter:blur(3px); }
  .sk-archive .lt.teal { background:linear-gradient(135deg,rgba(95,67,163,.88),rgba(55,36,110,.88)); }
  .sk-archive .lt .lb small { color:#d6c4ff; } .sk-archive .lt .deco { color:rgba(180,138,255,.22); }
  /* 봉쇄선 — the line: the burning field and the dead army behind, black tiles with hazard tape and cut corners, embers rising */
  .sk-line .lb-scene .img { background-image:var(--bgimg); filter:none; }
  .sk-line .lb-scene .grade { background:linear-gradient(180deg,rgba(40,6,4,.15),rgba(10,2,2,0) 40%,rgba(30,6,2,.4)); }
  .sk-line .lt { background:rgba(14,10,10,.86); border:1px solid rgba(255,122,69,.35); }
  .sk-line .lt.teal { background:linear-gradient(135deg,rgba(150,52,30,.9),rgba(96,30,16,.9)); }
  .sk-line .lt .lb small { color:#ffb08a; } .sk-line .lt .deco { color:rgba(255,122,69,.2); }
  /* the painted plates (generated, cut to shape): every lobby tile wears its skin's frame, sliced so the corners never stretch */
  .sk-base { --frame:url("data:image/webp;base64,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"); }
  .sk-shelter { --frame:url("data:image/webp;base64,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"); }
  .sk-archive { --frame:url("data:image/webp;base64,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"); }
  .sk-line { --frame:url("data:image/webp;base64,UklGRthFAABXRUJQVlA4WAoAAAAQAAAAVwIABgEAQUxQSLkJAAABCnvY/yly28zurU6+kx0Zw8xgh5mZmRNJYWZO/Cg+lVtjmZnb/5i5lRxmZpDCMds6HezO89zuzM5d+Vcl9/3tLyIkMZIkSZF716h6Epqo7GaPOeAPR30EsCkNkdRTkDTNYAJXxVWHQDmYZgI0HdKzriuD1Uya0aUlLs1xahWaUJrUoSFN5m3FWluWMz2JQzzbuXO6tJpYk/tyGS1V0KN2K/Vz7J3crRru2YghA3th80NUmr2lZDBcccZuW17HNu/kTi5xr3J1o/T8mG3knQ1ceolKsbQXUj1mZqItc7g3GdiS2VmzdXbnqN0t4U0P2vyaUnd6Y+cwp/Rzxo1G2iZ1aEh3SWznEWhli1qR9qDNr0uNt2dKSy1hZlvzd/PULO3S4j3h4qTS5Hwpg5vdA7e3dkzA5frP72rTpwaHFmNpIoLs//DqwcWwOYRksESAd0d0io+BmRuJXGS8lJYfuEub3o3UtKyXpoZ8oPKmNhy8m63eBXfj1qWKJZYEQ0a2Va8m2pjSWAeftaVtzrtSG/KU7TwitmUtajKtpV3WeGnJMWRdji3/X4f2Z/1M+qUlWOxwhTymj/mLftJp1Rx38iv5oJXzS3WNuVJFLEMnRBUMHXK6UcUIVmfmDAktgYGIW2fVzKs5BKdY4XQtbYmSgS2ZmxNVpGgNb1MqDo1Ns4pEe1vQUpeGoGo9j9zKFrUmbZYWz7GlzPZgIVdS0wLOPdBgV0erdyu/heNiHXIdtoVLw2RfwICkCSOYcJR+GQLMkbgaOgRiU5H0xbmkh7nESMS+VGlKcKpiCZ+yHjQdl0MzbZOmN8SySkjC1rWoNWmjMD1exE7NgT0/g9PSRq6tDJnhvGpE/MIHp6pc66pjEVOKjxSV35r5ZbpGKgNlfmBaKzZPXaJDJhar+t7JXtPFoHCTrkTUAtf50aaLnN/uKRFNL1abLnpQk37dgGS2+6Y0U/QC9eVndMQkY50fKzQxOtXXNCfmNDN9fMec7zhYfUvXQqYaUH31gCDnWv2Grmq6Maq93aM6natlZsrZmK9QgWuViceQL1PiO1dpZzrGVynkrGSd+LqtSjqfwNfMtG4+8G2zSj/FlfuovEGAq+7VIROR1Wj5XqrDeC7yKp2cU9F0bFezGKcgJOtYuW+8ZflvVEhpMCNafljmK/QnvyopTXko7ykMRBVqohbtGO+WND3Bh5MV2xMVIX+zwyMpmLmoiIqVBapitO0/RMwHyIrbakRFkBvkOk2B3xMV3nW8pkZMRJXlooAL/6SJ6nVfwFU/YUqahvzsldcGDTqw8XA9oqT7akvPUQEAn3cfaUBLVuK7kcdtxPSQbIRyAsnfoSsU9Tg/1vntl7hGUnRGmpmkkNV1qiLj9wbiF8nqJigTFbec+DpR8bkLXyEqPnXeq0TFh88apqsDtf2nXSd+kaxucmWiYuYWy4mKr17yMlExv+dVomJhL1XxebJ6H9A6soqqDpQvExVese3/63PI9/U5O265nKj45uUvExVzThuhqrsn0NWBxlvh0dVNZ5mo6Jq8mqj4Blk9brbX9kup6m5/jKgIutaMs/q9hx85a5iouOTwN6lqB5VxVq/P+ewFr4yz+vlIi/re74qFZMVnyOpApdNGxlm9rj7XNTrO6nWqu269jKj41hUvERXdU1fT1e+5GG/1cyHa/tP2n/ems4as3rcYktX7Fl+Z0GCP7ZZExERVb6FywDcvf52a5hH/Ou8pdBeOWlKnpikXFYAA/VwhJlYVFODlVYmcGI3x+eQV9YimHo9lZqYpVkf/J3n+qO0/3Nb/fYtkBRdpiojv6fRIijqXcn5Mhah2Mu8UrlETKwsx2JprJHUgL/97HdHU42ZFJqvHY1fR1eP8bf9p+0/bf9r+837ATCAoVosCUCQoGAoBfh7ViQnw3/Jeg6c1NRFGHwl85amdxyKS2vH8PamJsP7cbj6rHK6shbREhp9ODzyFnh+UmZjM+LDGHB/jCjlR3y/mzjo9wfvH9EdUxVweoyn8w0fqEUkR4I9cpymyQaoCf28/yLirx83+SFT4+70kIU29jmIejzE5cTByQH9YoSd2iBngMjUR8ucDv3FTI6cPYeGiAjqnPq5DWqLCR8Y7gDzAVUqiqmXDzG+QYfpDukpJ4yGoeACMrsfp6BOEH+8yBpB5U++nomlVy1RkKqGlSEZVY1iLtFS1FKc0igRUzYyq71mLD+oq9QyYVS+t+BjtFIVhVhnT04r3Uc60qjOzmgUbPvcX+4ZpjSLhVMX2hc74yfFIKRbJpiiMolH11CZTEetQJJ4qOvGDC070OhTSptMeoJitqmVacu4Fyss2/fkjKkD6VnyUXorCMKsABzlMLiq4FPleYplGId872ax2nQ+bTsWQUABX7zOqQG6TX5zz0K0XXdqvcm5b8b6q+1aP6GEs2zNvfS4yd+mzQ2c/+JTqcJp2qF11KBJxKPIPv37/6/wDV0T+8ckddPjDKnS91CANQzOAGBnluZ2UB6OGo7dWwHlAH3wnPDXjgOc0R5XEMipWR8euf2x4ZVneXCOjw0sqq4Zj3yiPSmwmS4bfjDMYKVY2Eo7qGsbeLK+J87TaTN5Z9tqwxeVvmckta2w4Kv8yZo1WtzLbqCx/J9mmzKk51mzD77b4fIxpZjFOyvLkXiJ3NpI4L8NZ9tbS7G3JMjNGlq2SzO6IdrDMkSRlZpGRpczxNWNTlgxXxsprjBfNV6GZLRfk2Oiq03KBMQr+N66bnXUo31NN+Nmhv2peMngXOMVPqT7eqCBHTpEi77b+SN8F3Nt3TKFLYll27TvKyCBSlA37Ni988VXNfHJh6pGNPK2WZe9tT+sz7OEtD01JzrJbH/jciYV/GbsarW5ltqJstU+yTRPPdWmOJdveBd69xedj8h8HM04ucZ9tCvs29rYqFOPVnR2fl0nnMh8ykw+a1XeOGaOH1wX3sM0L/jKY6t8KNycvlrUKlw5+Tqad/ZunPtc1cSNb2t7CrufrzxfOWv3XxUODT2nmpYOLgSHopN/qznnGn4IBM2+YOLC4kwE4p7Q7gN7SHDbtH9jfm79oE4XLiwpyJD4oIgvlGmV6uFypbG7USHjM5teVBq5REy/HP8KTdi2J4QKZeb5K88hF82Wur/6FvLzY2myzTkFCf24zzZl1EuQo/MM8ZWd1WmNvVnJ1H4/PSzB3kZy3z6Ke/WSuGWOBrCOLWGxmaFr/49ytgE1saRficCkdpGYeohp28+zSngowL8iB2bYr9bBtbnzix+axm9gCASCZoBk99V+3nohA/YPNJF1k1oe8jEvTURERI4AlAmCEZp616qX+9ddb4OUSAABWUDgg+DsAAFDfAJ0BKlgCBwE+YTCUR6QjIiOjs3mwgAwJZ20VlTfP7/93qblINw+f5xY63chTAG24EXMGqljzNyoj63dWfezyn9U/h93Bu18v6V+Nx2nmp9V+dT0neYB+mHT88xH3Ae9f6WP9N6gH9v6lzn6v3P+GH+4f+HqAP//sn/lP+g/cPxR/Qfc/2ysHfxngx94s93aD+0+IX7a9B+Dk4O91Pun/b9QH9Pzn/hvUB7+XxCfXfYE/R3/b9oj/f/+vnL/a/+T7B36+f+L15P//7qv3f///usfsf/6hk2s4KQwMz5pZteyAmHjV39VSoiSKP6F9VfB44IqsCr5WBnNGfDv82xkPsWsxMvsswc8iShjS+hq7dsEJm2pnBh99LLf1UhVXSX0CP3JixdMHDHJb9F+HwJv+GGrnNghxnXKou5TCeR1l+VJ8henRDjfJDmj0HO0UxlhNGyg94nLv8Z2rliKmYlpmam6xJ3h35NV5ggE4cv9n/17hj3h/oeBLWANiD6NtWA8HjwcwJFlYHbCFd9p9Tx68vh84Xwh2e7I18EBzQUxCrFFuDc4oT+2EHAQAoUsEy/PGIlRIyXfLOB/2iFO+WjQo/Rpisp58aMgU47O5iIB35PmlbEClXMXKjCaiu79an56D2SLhXPLwjnB2IB5ftyHJvXbtL732/Fqu68Cvzr53zDQk0fmn+iUduYkaGV4JfV6c3n3Q19OCDUH7IUmymoqN+L4bxP7O6dVurRYdFTpY1++XIeWo3Lv2wuxpXxuy3i9UfsyykrPcEG8SpTGu30FxUUkDRotntdno54jJe3Zb/Fn/aaUcomZJ1zimTaGgdiELi1vDkiNtCvfQjAb4hghWO8b3aNk7LtXW3PXJRwjPlajQj31Ggu4m9BSDy2/dZSNCzR7wTqb3AV7TMTI9PX9VhEGRdmGSKXqhIumnM9xcKG/E1rNxiw7rkUmqFHBKoqEByOIAR+jIAEeUM5o6kQGlb8trwOwpKObSAikyHKdS8W6Jn+K2/aStbezobRVQIGPimi7zx1LWzsr2rNJD+LZsSJBPyNgXe7Kjwt45bPKXaL4Z7qqaD9WZaFm8gvbIIFvTGBxQBJUVS3eBA/ZH+1gQfeR12qyP5ySeW5qMMIdYzu3bntKa2yd9CFVZmMrvpLKg9xPRLNQYdudtWTNEEuRMY8ELA26AoBsMKEgaami+UcaxtsORkYqtpmzpDuDTUkJuyYJ4CKvf/HHx2Wd7h8Yh9K09tMBdqfZAZJ4BRDEp1NzUDRYfYJPqKRu2hgbHIMkTP8roWQ3gL5g0B0xffX/ktNOxKnRs0mBITo0km939LUOrLdkoBX2BM05+uNhUaaFdfCegpyWhlqoQsku7nrqRuijUMuwgG5zcu0b6pouDhO9Yz+ROe0pxHkwdV1ZyDyc2PRfAwqVBSQpdIeYXxgCP5HfV9lWGq6CD2pKiemW5a7273ZMJ3i5YZ7aWg5VA6vYk+/rK4YCTtaUYcRu2Kyy7jPjD4w+wlwUIuUwatEMLagbyhFwcpsrkr7c9q8aaqSHbCq2uzJXTUf4BdiJezfzFbytOzq7jOTnxatkM2Vh+PTD0crE4TmHE/KVnoPP4BCV0/AYOCkpnCDsvsHwZd/dvRf2Oc6fqdvcRkTJhlRHUKaJxK0H/1czXv9dnKbVPcVNIknNXE3Siw0+7r+Qq91RQy9crkemhPrBCupSB/7ZtWmIoyHbu89DnKNe88wS01BPSzEDuKl8uCvnC0EQP798ukXuV0rlQZ2oOc5/h7gDpt1Wc58jwU85cGv+dtXP9Og6h2JuKTIKHDVnMU/09d4yOPuSYMYzZ8G3w9Dn3Q6bIKk+Anay2rjhAvjRF8jFRn8XCWpHEmVp3CVtVtC7RU/SpafPTyUqGFUr05nOo3OF2RoBeZ8hniJliVhCzEerv3ZmWpXB7LXKzqDFHpIKRyogGZrawgL7X9Bw1hkp5kl/sN9r8jfJFOtvfU0Y3ByhQ3Q09Yjfw8D4H/PHduN//dNDNA5B8VNEP2t3bqHTCE0c/W6vXAHt7Ifbhwn2xtz3F0vm2SC7wDPJifprEG+gj8cYY7gq8JWKrSOqLTvU0mQUFxL4zgXKOd7gBqy7iFgYz/5mtB665w8ADTsMNfNUl1y6WUUfjiXU9dw9D8EFhjv+hi1E6vEu0ivFpDyd16l1ir1/PqXP6/nCBtFjDaW/9o1kLbSvPL3KvARC+5klTqf5+rrYvlnvDv/K+BkproKgJJWOOvCX3ylKbeFagoMcN9pZ4Osq6pMApHGzuyuV3+JesazRnKvj18dcIkdjC/G2oN38qqxDtrZBtrePiBroV4Lk/uY2cXAeDLJ4JleZIlWuoBAwq749BJyathUn6quhqT/R+KgFm2wlFnNT5MztLfCA4ZAAA/v8+Bffqp7RYc5iFEDhX+fEaCOyTP+01fBUGLxDQFASZ4oVjXJ/7LbyX0hnVtxVka33nLZzbbAJBGFuqOvf92JSYycvI1dt9cfmYryMgD27YSngGbh1r7mFfCf4iGYkL0yO1oXN4WCpPsrg9gy/ZJwoAZZ8z6AM1LARdqY2stC3Q3/+lICu22k0uk7oLkvui1nryvdFx/rn2Wil4nkz+bvtK6zqwFJRooUb8p9Pnap+XSxNWEhYBsd+0LerpbO0sJUuYoeVYcfF1l7PP+yx+vJutP8zFNDABqzOaXHZBsjWN5edNmj0pJECiT0o3YA3rHj2G8q/2LunKjQ04AnupQjs7jLXelI54etJsaFAhzhm8mdWxMCi3sRFc4wuUSvFMdhubxj8tiAC0mT+CBbw4KCM1IxSzn7nie+zucXttoAO8fXgOhABrq2ZRgfRHQkVICFm8/jw5dGtiB3ea9UIZT3AmOm26guqnuVI7ViRcyvlffyh5sENt0IpliK6SdiTZQNWrcqe1E7lNrjuTnManpsoAlWXakR3vKzVSwigXp2ZjkEqTgIl7NAicXSYflZ6g/RH4NINmUgMNaxpPzF64QllSC7E2urOheDWuR5potgdyxe8x/jGHce0nyFtxperI7kRUlL9WMGGqBPYMmaiwOC0G/0QZkXm1TFQfNQSKjC1X9KIifxdaYUKhGmnVUrhNwI6UzRceLpKz3WkozacEp4OkOY6mRriBpfvo6cP4DftuTGwpHftwqrmTNDPqiGD/5y9r2hxxTkbHkxoYqDmmndDBTInn8hRQ7A8wuoXGQAvoU2IIVQGiP+FytDvW4Zd7t2ISD/hDqRo1vN+16uxOdLOkiRaiSJdL6TkBCpHjITn8lMC9yf9Ll0mT1sRgI2rRKkGKZ87E+sive/LpmJPfi96gdv6R8jsSli8vnp4uRfHibXpDiWXEYNn9FN1k2+/eRxdDuWEzlYd2iauR/Kj5kvoxSBFMrNws8OxVJzDq4TYSGZOvhLF7+jDPcTxV79AaHLGo4g61Kia62RIrtss4Q15afYRlv0eQY6irs9GHw1h3De/MLuZMV5d5+qi651qaGP0NRXCdC+5T+Fk/NnrWUqdruD1va+PW52S0+kMwWjkFZMePxQBJg0wFSrMOtfDDyMfq1EkkEFdtpdNY6PYMt625xMq0CLM38pZf+AbSZ9O7ntA3UFiFmPR2E4U6lJyJlnMbwFZvbA/HNyZVYgkKV+uIDcIMK21QhJGFqNNzTNugedCmXJWW0DIgpJPvzXSWkDPD8DSmog+NMwO4emTXh7vM8TVIyNvNMDuBPyxP8yalHeoT227SRPx+xMFGz7NWOYTouhOkUXlH5DzGCwCD8Bskee5GMVENaeJg2mF62LOV9C8pLNH99JbZfvb0TNyAUu4ubAmLyI6QcY1Z4fL0MRj5PVAxU2SRyRMefthM9MfFsCy+mQjEE2rjudQkLgw1E2DhJoql/KbfEMi+2lzOPhmwpFjjecyAjDUigf/Z4ynDFnqDD9fLicmdA6pS1a5/hTab71bnD4w1nJ6qpj27DW2PQSaDJrfKQ8PHmCnH4FIPaTMs44hr7wrOxZwJHcKdqyCEjBR4Ov124dSjGI545/EVreMBKYqwLdATnQJuqdhU6AnqMc+RPFA3BnkVjuexU13XzjJ6oLcS34eG9O1P+rVmynwZ7HjFjn0Az90f4vr8Pbl4De60NhgnZXMDrdIh219KVPngdH/m4vo+qcMwLz8xrR+oPR/Z+SjOYIVCu+6Vo4pqvmMOfgmmJWuxJOdnYIys6Di0zWftzLwoirwXTejJVltpGGCGGX1QVvhO5TOpY01bHLSKQ9V4+w0kP0LH9Q2Sap2fax/HF4re3VkaPMDaR1gUH/ght0oVNBFqT8M3Ki/DbWukS2a/AwMPcFgbwuEFIRwJk2fmpQbL6E482qT9UzSv6H/GFuHIrPOz5qMctYIHBJxNL1artkFF4d9fJCpAWw2BaLBIUm7SuBOm3cxj9SGRmCxobQmuyuVBCmVu8Mo+b2U4tTGAVtByBM5LtqeUSc0eeAtTJv8FjjgcOoq9Z//mqyH9CXiWX5OVfxg+SzOPFEBCcIVaT1rwDQ4j4YBFpoz2kg++QYIvkoZ2EUuxhGrzvVErbVUzfJRj+RK8OvZXM+MTWM3dRxP/Q8stTpG0O8ITqLLN4gmAEFwLu5yOBQzLg7MOJH2ovKmxz9wtnbyUpYH152zyQ/kTV24etNDfu3dAJLmucWGFbSpOgOnm2v3GpnfsK6+JdylxwQOECmDoQR9jJmg+/lIRp/PxY3iR0WcM78vejRZO2qIs39Q/0k+vQNv4uxE8WPeCtemxiY1gnQ5K84xn0MgP4wx/ePWsNT3zHam/LrQ+DpCJpnPc+c4ilc/o69I+lty2SdLZGVRt0iLQE09308P0f728ixFstcfYmeDe0l+sfqPHkTezfggYzJaROAcQx99++7XnfneiRyWj3FfOLJwhiywXp6fecNUMVZsGNf+j1HYRezNHDk0dZdI5JDDcDa/PyTS3l/C2XwREnXYIJNG8ThTJ8k9OxS5ZcYyuHADa31cCwUSdTwtWNfioJ8mAKxLr8hM//lfeinaexpN6t9i6yhAhenXqk6q4YwAH3abE3Vv4TyHypsUhWyYbebWKNigV4XA8xgAaPrLMETOYWc81ThqJARdkQHBv8fbb4QyfXfj7bE6e4e3rU5xfwn2c/rn6xNW7eWzkAQj5KFcmrt/ESCYrLgdodRyrEQ1m8v6LdtUVEqjC+ESnZlCVwXUXm8TkGH6PN2TeWkTZ5hQ+KgFv+t6GlYZV7y7PNo0LRFn2pb2n2TL7bn7e8UvNOMlIl6n/uQZau8H/Wp5nHq1SYNfq76wjwMbk1Yr0PgD8fM6nFR3apogYhM1LaqmmnCYwadkfTsB9K467AK10kECVHDrf1cO6KaJkomOTni5bqfNOmzpn9zOrSNz2yqDI4m3g1SYnoRhMepmsLfDkzDQqVD9JpblzfpekhMKZoTiUTZoeyYozL04NzUqa1WLeOYjhH4P6+QkMzb79B/rQnc/cZgZXPWv/PxtUCJIzmUyFge1RTnRrVLY2N3PL/iShALAjFZOWVxaSgNwrWg0yERzsbPHNy/P9Sh19qr+F/wsjXJIp6HGSpArZtcnbCtchkJhTsHXeC+U1FJVdAIWRnY5zqqiHrPkHncKk3iD2CQ74e7F0YzhMea+g9cgOxecnZ0rl0M7u9NZf+mfsF33iSkPb3elNykRXS3OFeeViwNpv42fbcnfzP6J0p0FDyo1pK7UUUivH9vMVwS4S1K1x91rea/h7Mi3ZHIS8flGr2CeLAsqH/6NRVQNYoehzch2EfRxIXDl7bq18GIU/sRIpuMnY49xoBmY5aOGhQS2Zqfl/2GLUr5HMKww6E2eFeiZDbtWO2IyWpEvJ878P03oUicMDxbfzSFHURsk0FZBzruQrPlGGUKDuGLUtNX/zS+rs7Lhr0Yv1bBPfWOggsu5pm5SaD2tQLTOycdEm/X8y6nQM7M014+e1KshwWayQLaFr9BMljtrByFa/N4HHD92+UBoE3WGbuv0IVXB+F5QjvsZB+XNdlv05yW9Bm13POu4beZfb0Tw2KfWeBuDo2TGeP8AnxAAkk1Etv3tjm2PwqJkdJxLWpPF/LxdKKTMllk2DWBMKq8werzkmdNQ3iEvnMJ2WuoxJR6wJUrOVjNZsfKWnRyP92dsVvZMYOJ3WtfiXH9azGy1uX7GOqvl2+C5KE4Y6sbOss8ce4L/O1BidoEK3E41eKBu4Gm38U3cnpLb+Q9IHxwUL3VKDTXJczXwktYIcoXGc/8FWIfMam0ss1a7IGxnuuKydA7z+5ieKrHSBnjwlk+mYbhvgalPhLZPg+I7bDwsj/YbVXDrLHNC/0A94AsqjBFTuk0dpw9CXDHY+hVbmbutDyECQiZyK57We5P2p595bNlA4kYbVV4w8VZVyICKgp1N/Nh2DGmW09MhK6ImrQiyXlvalxbUGqMXoloyEiIU8KCiLFGjnbKV+Iz4bCOvETBWKhORvnYDgm4AlXESalCboxAqCyyiRMyG1t8UDfyNid4aX/vPO/mGOrgLp3+Twmvg6r+9KNp3Z/XHIx1fbPNFGwMTB7tjqZLuvzi5y6GXi8MvJI9Qi6Qof45pmenqPtKf3uLykPoKzCFpjL0v/+jcL+MbESidd5ZZsMQ68mw+JID7R53/Xku+ma7TDQ3ULha0eHd5eJkMpz68DLAYvSzDdan+Vi7OPxYIEMKrteEzaihK6hS6w4fhAYpZQTcdK7+zsteBN2bme8RVIIs7dqIgEC1RYPGSM+OZb/6a1jiRn5w4DxV1jytf8unJZElin9FiO1rf2wcPqh5NZ53GoAOSfvSWIpNtAQMxX9HI4XtHnikL2W6OlI/pqlTkCbg+lG1f5WK7cJeHcNRUYF6cTeprnYzjPPbV7af8xJxEiAmeXiqPG275TfIO2+SBiA/zUS6sgiRSAlQHPkpz9Qhy97adIGlEDYOishvsx5IXSX2NxDbyyWwzkOGK9b86wY2ct3DTC7Q2czClF1xv09nThSkcGFGq+XVOFx+DdxZs7/M8JwRR4zyGcAwCkfbF79KF1kQzK7DXN8IqiEHHdASUs1kLJi6sgNo1LKaeY0sh/1E2r/GQDDy9r2zKyZZF4xGe8AbiWrKbSyb6yQysMHgFUYmKUaEMIpCsHsjlgl3o0c3gtnR12DjN1Crjg4YEF2IjuGF4G6iiF1s8IFSxd8ujCF4gmNdNDVn9sUjKQQcLiAZnqrjt43M1o9DzKAaMSQW3Q0eeBqFXTRlUJvKMLfPIu3pWl8rqXrSAATzPw8auTeyYdEFnM6Zrvhp6lF2xKxubAqTuGzPFLEY8yEayTtPzlgLtDW58Biq7bRnd67qxT1Jw1hNxUHQ+BIRSpcjes6f+5tchyobhOYbqWInbnfUPtjwM59bcCydrCE9spCVIgkArfWlYqO7eXFSEfhUsk+2tQaKqcY9tCQp9iYyJGOmqoJM8za31UqpbqnEWl3H/h8c3xTEgI824645NXTFz+k8O0lBSB8/YTSRVhKQuBab7fM4opplfXioyIRdC2B4DEMPnAe2U2felNY4ERW3zg5cFkw+ko3K8DVgYl8zhpes1l+eFPqPZD2I55u/YpxFyoJjhngaJMtdDyd+6EoCrpQQof0y/jQRySmEomwVeltZODNuqvia2e2ng1wF44dGgJXAwHouG+iI27QgJ3O/SIjdW175q18APH16c1wE7YKOSDuy86OdQ2f1GfzkDFA8PYlidgwsbw+XrguCuTwbYk2+ZU7ydxdapyUdVkEn9procxV37m7nXCTV4YhJa1F4x7j8vW/VzhvZX1m0t0R3Skgj03r3cKtGL6So8ysZPAm+C6odjYNzs8RUH/jHi8TDK0wSMLGv2P15nDbjv6VHPTIibEhAKBhkUbSKrgTWNgDCwmmSMUWIK/3RnV+xLdbw/+w1OiR/VozOdcb+mfSKhhmbnn1t27OvZ2MEBusQ2lHlCSceQEvVmQjDg08KzhIT99bf/jeFS5+fl6XvbZ1MFAQ46RsE5OPjgFNn+Olh3f8g0806Y/odz742V94M14V9EWkduHju0f1vPrVp3f4FsGYy/SUsx4ElTmJrsMwM2zHoe7mtmy112yqa2ayyFknQayD7ELUJaFttb0rvel/zp9P3trtsFy6R7YId4JPLdJfdXHB7MN3zOg7460+sfMYagw14BGm07Reodxc+N1AL+7g6lTlKgOc4BHBG9imV7jscZS3UwSBYzKeSv+vTEmQn5HLSrVXRYEE2CCYYyx4GRPfpahelehilc4+j97mg0lJODyfgM1asoQRU94HDlbByCTpPOHv0/W6A63RrGLVDRexJFliV37cztoVrkBANd97J1jrUTgZHOYVsfXd3s1HThb7Qi0fZW1zSGkOqP0zmZTsT4kbogKo3Nwzy/wFHh+TdHtS7pZcAZbIrGXP/ZoAFxe+6nFdoWfwQaI1cljNgmPmhSkh8WOLvRosTDPN1USvPbl4wHbtQOeAZCGyhpEmzSgfbik6oUznM/7i6/zMzY+Q2FXxh+VguirgDd4F2q7gc+atqviyGYi0LwBXc1IU4KMlY+Ay+ciAjSqaQzqy0dqcXBRuy8/ge9UwmuwIZx68tCKnKnGCrz2kp2msuTz3IIJAUeOnE40FkmUpSBhBLSR3XpQbjXxZkDJEEqPGV2G6RAfE5TAr6hE+OXCoHP+6C6WeTw+ycxrZE80eE+7wkHZD+livreIS4lcPlxlsLYSrKQaPuANftzPDEwS3RbapQsDZx3NzJyggY9weQqyCJejVUIj1lUXpPybXSIIOf63W83P2/jDmlIYb6gr3y2G8WBaX65a5RiLm5eZReU6EFHPPq3C99Rhaz18HfKNnfTSx+WFwFtCpadhNhICdEkGtm2Vf97xOjoJNoWHkYwGfMP3TbR3E3yLtf4btWWGsc5iR1vsz7YexNPnFTcSIaGsEdQ+8vbcpPkq58mG4bMgSYsWUcllckzlh+93twyyDMj4hTf8rdpZD85v0sY8CPyd/1/phFNVmX4Q0LGY31kJI4Uln2xVV6+r9M3sPFzIDHsmyetF+uJxRnx+xvjFc83VP//h+b/WS3+yAMFTKQvCFaHfl2IK5RHg8Fqf2ZcXhy+49hLy/qOu9k5YgfULRADF3kxkPAeBgnyTu5269VwBUCW27+kz75+nsg6xZXnP/aDpmTOgEMZYcQFL0tk4JJILW/JuaBdEM4UcCi1/5nk3y+3UoFT2muU4VnpUb9ioyNaVIvAQM+xxGpy1RW2/14ZrI9LqElrBnha6xzaVMWoh2PvMCKVVmbaIpM6SPvkBAax8eajuHxynfKlAXzn5fnLz9OumcW1wwY25IyS3op63BbXa2rtuicNZ/8umReDGSOe7iNv+11dMw7axcrM4FJBsdVmDspHuGFNI7m+3QV9p0US1gF63E3jduzl4/mV63jpI4UYJ7VWqL89XPIQxFcv7OD6PNLTDgCGhfFbWN4B42r86Qj24p7H4WjHSAoYLADuayccz3zdhkmxJMrXFlEbLDP6b0VQ1rhs7KSa2roEBrhlPyFiKVOU/zp5cpEUEDYzZRMjBsMFMiJNS9Z1EdQabF08M13guplnlsjwjoDwIuHiVIlC7KFMbJzuWHtZedDCajk9KBdSsTlzAhbvmytj16dj+rrtuxvKMXajGPfNbiJhfuqExZoweOAnY0NBTnlrG2x5WAesWxxGfGI6lE5+Nj4b6E2nm5HDFrClvuW0wCeNKJTPkQY7FjBfCtS7uJTwUTVwYNWwrleCE1EkRn+zNLWzrcPuX3LhU0s9JlIDC/rtnb7NQTYzYAJ8hC7Aki8hJIL+ChDUkOwhimMw78e0NHHZhmNiR7ay23/afYmj+X7pRyYGVMNxDNd7o2/BuyBa6+9mNjI1gwm+r4iF+gBHZRzKGDktC1+OM6+SkxcFZHVRLP0Z11nsKiDkFd3fK9rORhlhrzbg1DqgqMGRgTRUTVpOec7QpPHjVIHx6hZRYApmgmxePvd4WwP9GZK6gM6sHsmk2ibmmOzzubGKAq2ohGOdUgk0CcdGm/d252t6NiOjSzMO1YxDVgtnj9JZGDjf0QrXzpheWN5Uu5qjigB4GCoQw6yEjmMCB0i2i3/HnXpSKD+OZM3F9oAAsFLj6opXxUgISySOFU634x/Lu9BgOdzxXpZQIzmMtgdi4fBypJjMUK8iQwAPbYcBpHyeVKDPFmdSEkZfmy2ImtsIIUTJmS9Y/1F+wN4QgnqQwJ7x/JC340wdtKU0NEBfgvzfPsW3LgGvDL47btYpCpiNI/sCd5cV/RJT6edcCe35NlXbDtd5gIm+t+oDZKU8Yp/DK0Duqgnl5G+3qGSfYAvdLnQz8/5t6M2TY8guS5fhdOQQUGwq726o4HttA1NMcx7hcnnhYhJJLySgqq2q+N3GesdSM/nD66qvy6fXSwhGecioOQzk2N3KnO3BtIArqxUiyqXHfZ16kFejO9OPQnM4DsgzIlO09fx37UVpmNT1Stv0b+WVfGe1fjCtmBDq36XbaXBHAH2CArKf+At2a2M1yeEPfSbXaP/yfJBaCkG+Cdg16gZXNmFrxR0qyoKgJlLsBqSVjsDvyhpOG/GHNOG3+FX7o1ghEZP5GwXT6QDS8FL93MAVVj0Tu2buyAEHCrBzadj7oLtnU+DAOfRhihpeAmyLUdmM1lEhzQnPRB9aF/wERRJalxeQqmUlg1SBoc8Z4Txs4n+FdgxShAmTT/+h8M1lREcADaZotRMtOADvuUQGAiFrZ77lhei9KCl+cl5B7isFfndNVPTj4SigCFuzj7AHqetugMdEa+cHJkcUoDNCX8J1YclQOOZkg2Sn+9EN9WQGKx5OsOb52IGl7OFyBx3jsbZZeoJ93WZspe5UJDvnXUV1CAA33gLgGiGTm/z87Dpkw+QaBpjYtf5e7mE8lJxbk0YUw2l9F/HYRvzFXn5YzjNNL2w9HfaZWxOmSMMIyLqev4vjDhP7sHRSg2sQ9V66DNXJN6okUi/4EonWn+BovWsCEjo1QIyyODFh5bljZ+diVOk7t79TQtarkd5IUJT7i0n/pr7SsT8LmrT1F9lYpdtnK71dK3QxdacDUZPKGDCqPg5Z+V6AbCkuqP4sIygD+ZIpVD+2t7CuTFYLHSaAxM8cZA6C8eBr172WNZoBshO/u4/jqIc+nHxcRT/2K9PC8hNcLXAqttnKGJf9Nd7UP9NhYiI5G83D5Y6bCL/ZksLqNyRJQCs0HcIucZr70Mx2tFTBsYSDdhaINoXPaFvuB5rAi+nbi+jJpBVCARoX76B4J3ngsffAzHmP2om8alep7WSCHSRmH+VZy6vYjDiCwX+PJskhGkHeaQNWH0vQqlGXSY1I7E4S5URCPa4vlb4B1M/aKjH2fxIIfQ+hvoMe8zPqxMcXYtkFnRmSFOcQ/pqLD2/ZCsYxOXHyYoo7ZNz6Vuu7dxcwdwhjpkfoz6iJoPCiaM265o212M8fphm8kBS+lWBepOCeS7hi/GWgZ1U98JGL84Pj8W/xT7fvEwd31gRhQYdsbO+WfRBC5YIJSExjFZRUyplMdZHcBMyP8hOGyEBv4Qa2vgUKpe6YM54VGoJgGNzsI+MUaoC9VxQlzoIDYthI9rDJWoyuC2A4ii1X3phfcZygCH7X8MqgrThqq28Wqy9qa/xaCXPSshjFeDyt8t/SfbFkJJYcfqsCQvYBqVYUSXFkwlLO19t16Buq80vcXkrfBP1mEPN/ixt5jIbVvsDO2dwUulkIDJbNqv4gst9nOPBr02B5cNaTSh2lqRkLBptyd/yWc+c9ORbyt2up7/WGC6Zgr3ib9sRg7lTrhgFt2Tm4Prjg67QcGboTKDE0JMHqWfgytIk1Vi4G2hQ8AmRIyFBT9jeZPevFX5fdluE+raA8xqw5P5Cq/nUGjQGWGFn069r0fmvfof61j8Q/2oULVLqTQRF0WLio1jlC9BZn2iu5dr5hWXHo1JbPSkEZqjLGBbduWO17aKUK3K0C3i98RGRMZe/0KaDeg86nQVWiUAAHtdQkS+j1UAtgbvIMt1BmlW8cNrBQsgPGBCy1GKTADjkqKsMorDWpc7rQqx3z42rj+XEvusCsYUzG56AChmpSbs9Bc7rMCQVseHl5mRgMxylHOICzFjf57R9lzF+wdC+BUWhj0gflEUL2GO9fZ9OnCCJwV8slxQjjjzeFMR6WoenNDL/Gq2bFmsNtKWC1v2inWBtMWhV39lSqQ+GgVM7jF67LB5JNDDcddIeaRnYFNIQ6Hs//+h/3REB4824r6OwZxiK4RdL3Us687MzijcyTC3II1BjKfywHCmJ3RUh2n+qYBsFFIqklTW2CoBz9GSQc5ZdGAKIA5Q9y2LofZMoKVgFtKgKAQmc6kgs9p8dxsK7SlbsAVtxd9oSa5nTctoDdEIA6/qqJHDdLEozZwAwqfpi5N88Doi+OrXE9CBULnUepsgaf0KRX8XyKpmnCBUNU9QiexziY9QLmq2KEiUErKPPDIcOLMHk8+BB9EITawBaALJ1vsq2+1BhpDHEy68X7EW56D+anzpIpmuUu+ajEaJkjB1q1sw0ttzEVvKW97tGyM8K1SdAEKtGupZSUp30Yy5dWmbW3K6jN2SO6dVJgi8waTTGWu25Shv87q9XpzTOs/QP5qJLRVYzt+pDIKlte6egNLGbDbrIvI0f8E//1E+gQHKQ51aKXQpVSwZDX5sPwxQiVpVhp2sTpTd0OpJQN6oWVxw1WcA8AHaVkYNahwhyI/94qDQauJhQGJWZ1t4awI7IhEjCHe1/erGSO4lW3DM0O4F5w86cydan+hznCWmhhk0gsZ3Aj4EW0UWxYSwUW+WWxnl/5wxUS4JeCVUitsgASmyYlgGRazHcIyFPt2hdQTe4SYV1Jkkov/S7rjRO1vCsu3ueZNyvH/qs7hDAXueTdSSACKemyTu1976yH5kxJfKHQkKlES0mktJkc5B5w8DPx0EP2tEqk56kMNJXlGkXJJL8ClotQPmMgDHtq32+Snzziiep9nl/21hEZuPvDQpMqRtXvDkTeh1HJMkZj262awO5GBWzbKsp2xVpH0M/utOgzaVgOfeW7pK10abqFz6Q7feI8y3IBk0VCXBoi1LgDPP/OLgkudelRFF7WCTsLB081bgFYviwFZZcnFJomwt7/LYblllM0MnpRX6PBJ/upeQFTv6O+6ID0+aa48sLcuapK0xV+nE4Da2tUi5Vidpgh7ddUimL7uQ5HWg1Z2f/z6+knYxDPOHz0yCeDDh883ekWwEzx93K1DYain9B70LnSXORUYN8Lgiy61mFRmiAOoTmm8vBi9PgVdnNzbYCqD8nxsOnt4OQZqqOQUJjQyY55t6ngx7bIbEg1XKGi/jTRuFu80LL41s3ueHX3tBimgzoTadiUOIDFvF2f3dNU3U+a+MiIO3Oi6WhL/vn6G7UwVY1GDDLSFr7TIzZ5E1G67m1EgntzLei6c7dD3AwCbhyB2Y3XEFurWsQ4QtIBWeZ/LV7AF2BRMjNvg5aLI3nvf3oxdRbUU6XevBwYrcADzg1jQ7LQhb8SUpMTXcdcw0vLnqOtf+LhY2uR+20hhfeLdQJHkJDLXBeSUMybDgOLWusR5OlUnMAbuPS2TceSE9WOFBAXVxPgUxrLTQgDAvopWv/TK1nc2UlpTQa2HSEYEtkJMTmYNrnOBpa0nZn5oehKEJZkSsd9/VyNh2KyertXn2eP+g52TfiSnzGDdNIZws1XWPC1bNSRpkOARKxmBsGFDsfklTsCxKLG9ZorVbO8NhgIkC6Y1z+eJIeLgygqCywVd5USLW5fBIfbBf791v5KhsOh7NIQ0arP5kQs9HGf5VMr8+jAjtEXou0CM7e7R47kIt0GtxKMtYFzrb3G5AHFQVVYUk30oRDBN9ZXo/LO7ZpNjQ/lXPLQqP1t4hH4oSE4Pogbjvt55vvPnJJDG0dewhsHVElpsfcyQSyNzuSbT4s/xeFtjYpVsqClFVo2Xvox4ow/DHjnmREOHX0Fv7crqMOocGUlINEVALmunzbTC53mVBqLD5HgMLXWQdvyCdlBwdrMlqU739uqU7iTTBdEeZZkI7h8J2zbkx2ZLXNCdn0Sa5WTL3J84UtfInUMNIoYG2EEQmxDJaIGb3beQIMDhIOLLVjEerijwZhyV3srISjK0etV2bcVxxwjO5pp5LHer2g1D7NORSzzmOr/KqC9/9ju7z5/AaCsC37jUPQo1Qhsz+kHS/0dkKuMwqUWCxzCnlg2/ZJcJy/o7UVXuR1nPfgKRHlI/4E0IjN7n4QjoazFJveqhW9G6IxDxjgVh/I4mZBHoIXJs3PqDKIGnWz/cw0gPjOom+RcgZ77HF89FDzMTGjQCoSRR8il/VhMgzqE/XvdlM/eH52E/F8hwfQWCrTI2g5ZSQFXRuTMxFE9V9Vh5ETx6WeZIh9NoXCcX+o/it3IcqusTCdrnVxC+LxNqrJtha+fMazn5ySqk4Rv2j4xvx3G4UZTHu3QnXidmfoGdhIGICZOSmjDFkfH0WyNcG7Wk2uOpl3zA9rNJFgvaFKNQwUEbQWm4kQtVxixjFV2CUwl4ryxHrTazkf9iPGB9ug7KtALclUoGrPq5HKQ9cbtj5/kWt34tIIse+lIMqy/TiZ5GpOD3noSZp6frwy+GfidMao2XXLb3z3tZbIY8RZ7tjc0V6UkNNBEM5KQRuoC6ITtd4UBJmI6C0Xi3kkCntrDHq12g0I3HRYwuAGoj6zouJIRJ4221bGara7l7XZJ3WvnLazkzZbApFwOh/L95USN5lipKeDSMCO/Zo2Xu9SO6oWqNOlsL9DIq7CGl6yUbJZvPVKqSBFTjlrQAAyXkLe1bT8BjiaGRpmnyc4tDwD3Z7eqx5lHG3EpZ1QkE5VUnOID9P3I8BLDbJAEIb2zjXeXf2PsBAT7ISmB51v6Ik81UBQbSSEmxt4SD2gvnkxnfcMaNqTKcNS9DNgXTcqyrIntN7kehqeLxGM0q1HBEtwJTlhlvKuQDyrzRDXQDC/bshnLA7N7EMQ6QRLrxFPPiGfp1eKcyl8ypa+/5+Ef2zfuGWU6rbbP0zSpwQ/JwGys5vaJ4c3ajTGq+TWwPU8aaYgxHp0tcnMhbtsCUIkaC91sHsL/tU7xES+HIdOsvyALGVg1ufFFQzz+eGGYbC6zZxBCyJ0AJtNpilSfDUt4H/luvhFxEAxNpUYSx5+Vl3hWe6iYowvPZXvegO/Yla+Cl/bzesyWkhg56xuW1kn8b+C0jk6h4es9TwiGWLmt/7d0DfRQdKqm2tulL5g/DTcRr7/tDCOgMoIPOZfEwmepi9S5Jgm2Qb2NOM38Qlxyeg/Oa4MrYmsPJth7Kjc4KBF/mUV/fx7cyTNTbRUFzZClt1mfiwYUcaQat3W+NF463vMF80PBGMVh+pTEADTwqNQ2acgMiX044y7HMQXe5djYRwRy03Krp01a9cBEy1w8kK6BanN4ZO3auFkS8aIFKLRVXdKZvhk7ZcMiOZbP5GBixQT4OCQeoCHdrQRUCqSDOpsjVZ+TDK5HgTmRU0fF8DqoYLAoX0yZ6dPcPHr0rI8MNw/Jukkumnz/t/BPLTmtoIbzo0a9rL9YYeFgIt8Ppw3YN8kMWfg4uatHyD11+/ZpZd3/dfQiLXHMYkqB1BOhzeaSZpmMt3Pz45px1gKNQMDqor/C+bk9fFHjVBMpv2JPJnzYoUM0ipB/JqVKata3NcVgsj6WSicSh8amG9YOYa1BZAMKfpMn0L/29/U3UXTSayPHedvGL3aMgxhNozG9nw8oOxfj+4NWqL6mGQDlydgFqXMVIh8FXsKQoEFY+bXnfnvkN320kNbov6w8HG2txeQ3V5npk6Qo3ms0MAozPgVCfu9hdlTQZrzB7+exLMNbcRyVpk75JeXj/rafMJWkCd/HJR4cDAUd987L273rC3quH94CF3HXA29EulFzMZmuD3XRuenmFONoxQDRc8g/sJXDNBScGwR0MZyEt5dgUlUnYEY4fcfT77Cv0Biw6Ief/q5xusbVq4FRmkEKWlpvYj6UY0h7QPd4e4PBLcKTjbOaNWW5Y6QbUfNWVl2ZWUhNiqohpEkfy36Id0/DA1MGB0JL5AcNi+XKryIPwr+ybKUWVd1t+1zg7o5uEWQntYeXV9eOIxZteLgNYAs2iGIbVfMiB88FsppGBVqcoWJ+k+dYKbxePR0Y4/uIIUVZK84tz6muwBwT25PpS2gVWv5qJAJXwvVggwHpKPYCOtzO0nUcAEaqG186291822akv+wwXc4tQMzc9Zmb4LBkZRwtZLyuI4BSGPyKUtpWejGC2haV+uhbkAaKDiZQJjm7O+9dMSIFjdBasEEJXJ0PmdX5z1jnl+Ek38O6lZsrJcGCEGCeIWroUeyOvJ1u36wA+aUn+29ROp0Uz8+YXyGaYaDtnGsXzZVActwY4Rjy+/wpOg3O9DjHKsuu/zry/EWLwpAEFfrMCHSRCiUpJFjpdb0Jb4racgLRM9bA/22WXTd8vZlUyhJXMKYvvE0J8rKEuYooQ+xB5f66Lf0MC1sWHr84SNtJxRw1jzVdV0yAiWZ3pke/6LZj8HbMg5OfbKwmJUVSptSjGrIM94vCtmTVzjm+lgkCr8bP+bAk5s+zbygVpVB5Wt7DAjKC1rRGbN7B5S77mQjnX2/97Gjnt92Yo/kJn3LfW0n5458oyGA08Jij/PKyCcJwHhIw55l6/Hd9b1pgbtAJuXDF6qb4Gs7TYz5yiTpJ0DqDaQ6LJxmFO9t+FvjPUrMaD9Mb2xqAKKZEkgx99czzCth/50trzgXWEi1r6d6DiSXFbSzWFpu647yqDpzK2F1n4pQJP9q2rkDi+ksGvlVcDd173YVQa7HxvbE9pv8dOmuQGWlu/pJpHOPnVTB+J0uiU7u6Fu1FXNnBgxLTOWwE1LUkElFbISxp4vAII6cZJK2NSJMTKePKoZ5B2T4mIqB24Az94fpbanaIpQX7DT2teJlmfDZK2KZ9L4Xexotg9WjknUWtxgI+XDc7ef04TdkDya8NIU4lZ/4AYWKOMU+ziAmqDIiLYk/UoT7xw17AFTDbjGncataqzGqGrwf6Dj3ZAC6pVCwKoMwrQXuXt0pxzoB8lId671Rf5TBLUDdRy3hmxZZ7Y9tdcn5cNSir8wKS3ffmVPBpNnAr9ZJkBEJJKtb+62tkrx7nunzRz3R33HwLglZW/txfz6mSv/O6E6FKgHf9iacnm//lendbKmh6nCBENjr9cwwiD7RBPZ1DCvXjSu5BHOQbQlrWaqIdHAM8y6IFNmDGy8kRTha+Yu5vYBlnsEZY2PZ98aGLyGrqfBOrOq6ASQB0XwPeoB5hMUCsAuWUEaLljTZm4LO3ifIQ1bOGjH/8Oqq0gqAPiDLjnmtFs4EV6jJ+8U0plJ2evl1HRyun/ACo26iXTuk9K+XdcGhSIrPnvv5AYPDuzj6dtoKk67avlxQus8k2M7WbI0+6Qq3rpzPqtXq5szXMpaMfgejziZFCnbhxwKGDQwt39OfKiudBiBydRTbsLRBnY70Ep9hL+l4mVPkB92ckEB24al9TT/golrDgkvZEZ1m26JcJ9JJszlvvyOxCttCr6xQ3EHp6QWZZjiZPu6CgsjDPe8Gk6yGaqXUI2V93pyjjw82GA5qvnu8ht3D9NOZz/VKKQ5+xPlt4AvVjv5UWNuhMCR9GJE0eCFcnJXmNbKaV8qfNo+ucRN27Bqb0da2IVIY9KNnJ4RHj2hIu/ncvq/4IJvB/q+DEsNRRBJjO2NYtA4M3rKnT8MRm66mr1/VfNfnQxfTxviDRoqsMLTN5A0MCUu9zDceeUCB/0hmwItRoz0eirmhX9mQZqYCPNiLlfyNxQOl0XxNRNZ29ZOxn15FYlPIvI1Y5MvacrXM4VXDIuQ0ct4Uv65gQx6WmEhA6PPVZtu6fswOcJljFkl7nULtMd/CVEo3QBfy15oFOzK7DGQZjm6XYU4hHPdRRPqxJHWhuCfkuOvJccjkAIQQLsT8OOAT0WLnPVFa4LkHdGYNBd6v5eQ/vmL7FjlzBreeeED5TozjoGrvXgFUIVKT8RSC9RPPaNiZ5CIoK7ooL0pqLzdlnKGjRleH0e02mbwioHKi507hlgETveG3UQSEmywbOIHL6OMgBBGR3N1kRgNj0iX32xjXYGPDaF8rhNwjAS8XZOGHZ22SfecTnhCPkuRcXI4IGTH4XKoC0ih7QiG72HOMzAQgZvV/jPyojdULPlwc6+W+oXd+JxjAoEB5AkT3QmjybiLfTG2emfGMTgUPrLwVUT/S1WCzKAW4lsXy9Hz84w/HTDPjZrJW9sKQ8P3f3S8/fgmGka4z3in1GnW/1zNMBYz+qWOO5XQR/Y4VULUOLR/5xfUOpnUeV5ZQ0blSZVCcYL+eIo8zUJCDgy4sQiDarapS3lOeWxQ6wdrYq6fkBJZuMCdQknh6R+zudDs9g0bcSl5UOi5VctW+A487S9kMMQEja5vxXeVf52n5oRGuLJVurQHypsar4mF6tly7Js6AHjyg4IL22u/F8jaGhZFXaVHu7T0OoTasiDg9W0Q5EiX/HU90Whkshrl5FZsTB2YPYPKyWBUkEsVdAXdjplo6pPsbRfhoVCJ9DLX2TTgl/Gc0I2I5RBQt82DvDrskJs4NT0bii8iP5xrrIvgc9Qyu2SvogsKJFDGb+a/fVYZUvHSa1hpayNhfIAQ1ay4nXYMm2tApiuJ26eAoX+5f+l+jlt5SPfWvMIC+VLOa7ib0v7rTPmaqDYj6TvQhlWdxQlMQWPMi019jZZptKu6MXS5dKjc9k3aXgiUGsXxXc4Sn4q1q6iLmKItDd4i78cb7G0cN7mCb6e7JUEc+Y3wEvirOz/bNJNlVYjdpEXJqMde1tN62v1pMbbETARtir/cU25uDz88anX15f9z09jl+gme6f2DHmKDTjP6Sz4UKiV8YPF/DCuPwoMalYRc2O6a0SHsVsGFmYYuia3QvJbiHuyRFFF2zBpWW2Z4XjKVF3DgX2oAkneChNitox7q8H5O+d3VK7XxItDFJmkdSUDjU3ao8GvSR47BYbAsdBc5N2GMNMseO1jMSfwdvibbWLdo1KSZqOPz5IYbo/ZPvXOr2uy5MFfFm8GiGLvJzqYUFP0vjemv+gGM4RrzIwRwD6sUZp/CH9rOxhUG/SFHcU43i70PXs4wIthp+Qk7TfV3ncoKhB88raZHewW6BGxZZmaxl8fkJMa19eTZ1qXZGCffuV6hG1rYWimMZMsxKnIT//g8d9DPicK+cN14Nbib/E1p9mx1HfBTYPjs5qIEzE41CLTvLp09m/63pC36hGVCxK9Yo9uA/eCPCVbWGLRKYyBFLwpJWx7tPT59Ud4gOXdNdc0jHgnZ7rNH8okRvi9sra4bvT1nFAJijPqUe84jBCkrM2zYplhPSzrs8p4tU9No+zBqeVlQqto3HRhd0Xln2wUToUC9rM1dgF4LDybj8rAx0Uer3syNmgILYWmE+/NWBDIDwG6ZsVr5sxQtzpi45tF18QNTcxMDD2oeg7cR3+t38+EyPTENOtbUuHxFAdI1/K8xYnPsNFGXo5Pwvaq07U9UAa2yOPrOsepnvrwJ6mnClj6XvVMCVXKZYNJukcW2kHlVei5FyINM9va4YEjdcYXeoySXtpVHtODM6mK3ArHt4rlExopisMFNWOYMNv2W2MDRjaOlDVWQ46s6VuDwXpaOAXlkkO3yQRsA44qABAtn78byUyYHOqNgZL/EiDa4i2azNI9R6zgid+EgOTbLhqRjCtjKzXnjlyDWr51ll9D1kiP91wVdaa0Ty+1IOTcgkfzRqwctAJGZdmlF5ZLaoEbgzanriV4k3ktKLGfkSFeDTs2wFOHA9QcleEpyVHmQ0Df9lMnCctMjR00WLcoYOoMjwKXWzhKpnI2CYrxgeTwmX1+bGqQHXD/4lFrTGFPjnofZNdiodrM2v5gccygkACrE/ja6WCFNe0meCPeT8hSCoNqxt64DBO5A9C3AGudetGktIW7YzAOc7S/WBbQNDNFt4MXV7g7TWBT/xMJ9kxa823avcN/H64qgVK9rk70pjmlHF2LO9qtFywgUEDlePYTDZSv1H9XhfNm0aWXEgqT3FOL7Ls/WgFYOHhamHiU/TxlhWELF4gxWR9CdgXcepKkcI1Rj44Buxg9VaZmVJvvX+E9nzxnazWtVuCeIvKenMC5JJL1XGZJrSmxTaxffwYmreV8IIc1H230BdGWoDsjgbOpqmdNoW33WcXQASVQxpzUNynk5l7F2wggPx/WwyzY+XdL7AM2H0SAXEJ2qx/7WI6c6346dpc7Jg3QVUBqfiM6UbakH7fxKNxGDzIyX2T5lNjA9YFFAOIEVChD7XwAQQkX3KwX9q3Zc/ImlPLoMExuud/x9ltdSSMXJG0ZT05Rc24z33r++jN/e5X/p1FKEM6PzcNGdESQ9l0FA+d7OYfWiCMm/3oc10JAMWBDT9Sf5rFbWO1dabJizNYPus54xFwAAAA="); }
  .lt:not(.ev) { background:transparent !important; border:none !important; box-shadow:none !important; backdrop-filter:none !important; outline:none !important; }
  .lt:not(.ev)::before { content:""; position:absolute; inset:0; z-index:0; pointer-events:none; border:20px solid transparent; border-image:var(--frame) 64 fill / 20px stretch; opacity:1; }
  .sk-line .lt:not(.ev)::before { border-image:var(--frame) 74 fill / 24px stretch; } .sk-shelter .lt:not(.ev)::before { border-image:var(--frame) 70 fill / 22px stretch; }
  .lt > * { z-index:1; } .lt .lb { z-index:2; }
  .lt.teal::after { content:""; position:absolute; inset:9px; z-index:0; pointer-events:none; background:linear-gradient(135deg,var(--t0),var(--t1)); opacity:.62; mix-blend-mode:screen; }
  .lt.stam::after { content:""; position:absolute; inset:9px; z-index:0; pointer-events:none; background:rgba(0,0,0,.35); }
  .lt .bar { left:14px; top:18px; bottom:18px; }
  /* a zone or the dorm, the scene behind the panel */
  .bz-cv { position:absolute; inset:0; width:1280px; height:720px; }
  .bz-pn { position:absolute; right:0; top:0; bottom:0; width:470px; background:linear-gradient(90deg,rgba(10,11,13,0),rgba(10,11,13,.88) 12%,rgba(10,11,13,.94)); padding:80px 28px 20px 70px; transition:transform .3s, opacity .3s; overflow:hidden; }
  .bz-hide .bz-pn { transform:translateX(100%); opacity:0; } .bz-hide .top { opacity:.4; }
  .bz-eye { position:absolute; right:20px; top:18px; width:46px; height:46px; border-radius:50%; background:rgba(0,0,0,.6); border:1px solid rgba(255,255,255,.3); display:grid; place-items:center; font-size:24px; z-index:3; }
  .bz-pn .hd { position:relative; } .bz-pn .hd small { display:block; font-size:14px; letter-spacing:.16em; color:#8fd3ff; } .bz-pn .hd b { font-size:30px; font-weight:900; }
  .bz-pn .hd .lv { margin-left:10px; font-size:20px; color:#c8ccd4; }
  .bz-pn .hd .up { position:absolute; right:0; top:18px; padding:6px 14px; background:#2a2c31; border:1px solid rgba(255,255,255,.3); font-size:16px; font-weight:700; }
  .bz-pn p { font-size:15px; color:#b8bcc4; line-height:1.55; margin:6px 0 10px; }
  .bz-pn .sec { margin-top:12px; } .bz-pn .lb { font-size:16px; font-weight:900; color:#fff; border-left:4px solid #2aa7ec; padding-left:8px; margin-bottom:8px; } .bz-pn .lb span { font-size:14px; color:#8a909a; font-weight:500; margin-left:8px; }
  .bz-pn .pr { display:flex; align-items:center; gap:10px; } .bz-pn .pr > div:nth-child(2) { flex:1; } .bz-pn .pr b { display:block; font-size:18px; } .bz-pn .pr span { font-size:14px; color:#9aa0aa; } .bz-pn .pr em { font-style:normal; color:#4fb8ff; font-weight:700; }
  .bz-pn .get { padding:8px 20px; background:linear-gradient(90deg,#118bc4,#24a8e8); font-size:17px; font-weight:900; } .bz-pn .get.dis { background:#3a3c41; color:#888; }
  .bz-pn .bar { position:relative; height:20px; background:rgba(255,255,255,.1); margin-top:8px; } .bz-pn .bar i { display:block; height:100%; background:linear-gradient(90deg,#1a6f9c,#2aa7ec); }
  .bz-pn .bar span { position:absolute; inset:0; display:grid; place-items:center; font-size:14px; font-weight:700; }
  .bz-pn .sl { display:flex; gap:10px; } .bz-pn .sl.wrap { flex-wrap:wrap; }
  .bz-pn .s { position:relative; width:112px; height:150px; background:#202227; border:1px solid rgba(255,255,255,.15); overflow:hidden; }
  .bz-pn .s .im { position:absolute; left:0; right:0; top:0; height:104px; background:center 10%/cover; } .bz-pn .s .im::after { content:""; position:absolute; inset:0; background:linear-gradient(180deg,rgba(0,0,0,0) 60%,#202227); }
  .bz-pn .s em { position:absolute; left:4px; top:4px; font-style:normal; font-size:12px; font-weight:900; background:#e0a400; color:#221800; padding:1px 5px; }
  .bz-pn .s .nm { position:absolute; left:6px; right:6px; top:96px; font-size:15px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .bz-pn .s .fb { position:absolute; left:6px; right:6px; top:120px; margin:0; } .bz-pn .s .ft { position:absolute; left:6px; right:6px; top:128px; font-size:13px; color:#b8bcc4; }
  .bz-pn .s.e { display:flex; flex-direction:column; align-items:center; justify-content:center; border-style:dashed; color:#8a909a; } .bz-pn .s.e b { font-size:34px; font-weight:300; line-height:1; } .bz-pn .s.e span { font-size:14px; }
  .bz-pn .s.out .im { filter:grayscale(1) brightness(.55); } .bz-pn .s.out .ft { color:#ff6a5a; font-weight:700; }
  .bz-pn.dorm .s { width:104px; height:146px; }
  .bz-pn .dg { display:flex; gap:8px; } .bz-pn .dg > div { flex:1; background:rgba(255,255,255,.06); padding:6px 10px; } .bz-pn .dg small { display:block; font-size:13px; color:#8a909a; } .bz-pn .dg b { font-size:24px; }
  .bz-pn .nr { font-size:14px; color:#9aa0aa; margin-top:6px; }
  .bz-pn .lgs { margin-top:6px; font-size:14px; color:#c8ccd4; } .bz-pn .lgs div { padding:2px 0; } .bz-pn .lgs span { color:#7f8590; margin-right:8px; } .bz-pn .lgs .bad { color:#ff8a7a; } .bz-pn .lgs .no { color:#6f747d; }
  .modal.bz-pk .box { position:relative; width:1060px; max-height:600px; padding:20px 24px; display:flex; flex-direction:column; }
  .bz-pk .hd b { font-size:24px; font-weight:900; } .bz-pk .hd span { margin-left:12px; font-size:15px; color:#9aa0aa; }
  .bz-pk .gl { margin-top:14px; display:grid; grid-template-columns:repeat(6,1fr); gap:10px; overflow-y:auto; padding-right:6px; }
  .bz-pk .pc { position:relative; height:180px; background:#202227; border:1px solid rgba(255,255,255,.12); overflow:hidden; }
  .bz-pk .pc.on { border:2px solid #2aa7ec; box-shadow:0 0 12px rgba(42,167,236,.5); }
  .bz-pk .pc .im { position:absolute; left:0; right:0; top:0; height:118px; background:center 10%/cover; }
  .bz-pk .pc .nm { position:absolute; left:6px; right:6px; top:118px; font-size:15px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .bz-pk .pc .cl { position:absolute; left:6px; right:6px; top:140px; display:flex; align-items:center; gap:4px; font-size:13px; } .bz-pk .pc .cl img { width:18px; height:18px; } .bz-pk .pc .cl em { font-style:normal; font-size:12px; font-weight:900; background:#e0a400; color:#221800; padding:0 4px; } .bz-pk .pc .cl span { margin-left:auto; color:#8fd3ff; }
  .bz-pk .pc .fb { position:absolute; left:6px; right:44px; top:164px; margin:0; } .bz-pk .pc .ft { position:absolute; right:6px; top:157px; font-size:12px; color:#b8bcc4; }
  .bz-pk .pc .pt { position:absolute; left:0; top:6px; font-size:12px; font-weight:800; background:rgba(0,0,0,.75); padding:2px 6px; }
  /* results */
  .rz-bg { position:absolute; inset:0; background:#121317 center/cover; transform:scale(1.04); }
  .rz-art { position:absolute; left:560px; top:-40px; height:800px; animation:rzArt .7s ease both;
    -webkit-mask-image:linear-gradient(90deg, transparent 0%, #000 24%, #000 78%, transparent 100%), linear-gradient(180deg, #000 70%, transparent 100%); -webkit-mask-composite:source-in;
    mask-image:linear-gradient(90deg, transparent 0%, #000 24%, #000 78%, transparent 100%), linear-gradient(180deg, #000 70%, transparent 100%); mask-composite:intersect; }
  .rz-art.chibi { left:700px; top:120px; height:520px; -webkit-mask-image:none; mask-image:none; }
  @keyframes rzArt { from { opacity:0; transform:translateX(40px); } to { opacity:1; transform:none; } }
  .rz-dim { position:absolute; inset:0; background:linear-gradient(90deg, rgba(6,7,9,.86) 0%, rgba(6,7,9,.55) 36%, rgba(6,7,9,0) 58%); pointer-events:none; }
  .rz-wm { position:absolute; left:-120px; top:236px; width:190px; opacity:.1; } .rz-wm svg { width:100%; display:block; }
  .rz-l { position:absolute; left:52px; top:64px; animation:rzIn .5s ease both; }
  @keyframes rzIn { from { opacity:0; transform:translateX(-24px); } to { opacity:1; transform:none; } }
  .rz-op { display:flex; align-items:baseline; gap:12px; } .rz-op small { font-size:16px; letter-spacing:.04em; } .rz-op b { font-size:46px; font-weight:400; line-height:1; }
  .rz-nm { font-size:24px; font-weight:700; margin-top:6px; }
  .rz-big { font-size:82px; font-weight:900; line-height:1; margin-top:30px; letter-spacing:-.01em; text-shadow:5px 6px 0 rgba(255,255,255,.14); }
  .rz-en { font-size:21px; font-weight:600; margin-top:8px; } .rz-en.bad { color:#ff7b84; }
  .rz-md { display:flex; gap:16px; margin-top:14px; }
  .rz-md svg { width:58px; height:64px; fill:rgba(255,255,255,.06); stroke:rgba(255,255,255,.28); stroke-width:2; }
  .rz-md svg .in { fill:none; stroke:rgba(255,255,255,.2); stroke-width:2.4; stroke-linejoin:round; }
  .rz-md svg.on { fill:#2bc8ec; stroke:#9df0ff; filter:drop-shadow(0 0 10px rgba(60,210,255,.7)); animation:rzMd .45s cubic-bezier(.3,1.6,.5,1) both; }
  .rz-md svg.on .in { stroke:#0c4e66; }
  @keyframes rzMd { from { opacity:0; transform:scale(1.6); } to { opacity:1; transform:none; } }
  .rz-lv { position:absolute; left:48px; top:452px; display:flex; align-items:flex-end; gap:12px; }
  .rz-lv .n { position:relative; color:#2ea4ff; font-size:46px; line-height:.9; } .rz-lv .n small { position:absolute; left:2px; top:-13px; font-size:13px; color:#2ea4ff; }
  .rz-exp { position:relative; width:250px; height:22px; background:rgba(255,255,255,.32); margin-bottom:2px; }
  .rz-exp i { position:absolute; left:0; top:0; bottom:0; background:#1f8fe6; transition:width 1.1s ease .6s; }
  .rz-exp span { position:absolute; left:6px; top:0; line-height:22px; font-size:17px; } .rz-exp span small { font-size:9px; opacity:.8; } .rz-exp em { font-style:normal; color:rgba(255,255,255,.7); }
  .rz-lv .up { color:#ffd400; font-size:16px; letter-spacing:.1em; margin-bottom:4px; }
  .rz-rw { position:absolute; left:52px; top:500px; display:flex; gap:10px; }
  .rz-it { display:flex; align-items:center; gap:6px; height:38px; padding:0 14px 0 6px; background:rgba(14,15,18,.72); border:1px solid rgba(255,255,255,.14); }
  .rz-it .icn { width:28px; height:28px; } .rz-it b { font-size:19px; font-weight:500; }
  .rz-tap { position:absolute; inset:0; }
  .od-ib.od-wd { left:350px; } .od-wd svg { width:30px; height:30px; }
  .wd-m .box { width:720px !important; } .wd-hd h3 { display:inline-block; margin:0 14px 0 0 !important; } .wd-hd h3::after { content:"·"; margin-left:14px; color:#6a6f78; } .wd-hd b { font-size:22px; font-weight:900; } .wd-hd span { display:block; font-size:14px; color:#9aa0aa; margin-top:4px; }
  .wd-slots { display:flex; gap:12px; margin-top:12px; } .wd-s { flex:1; background:#1b1c20; border:1px solid rgba(255,255,255,.12); padding:8px; display:flex; flex-direction:column; gap:4px; }
  .wd-s .im { height:320px; background:#121316 center 15%/cover; } .wd-s b { font-size:16px; } .wd-s span { font-size:13px; color:#8a8f98; }
  .wd-s.on { border:2px solid #2aa7ec; box-shadow:0 0 14px rgba(42,167,236,.4); } .wd-s.on span { color:#4fb8ff; } .wd-s.lk .im { filter:grayscale(1) brightness(.4); } .wd-s.soon .im { background:repeating-linear-gradient(135deg,#1a1b1f 0 10px,#222328 10px 20px); }
  .wd-m .row { margin-top:12px; } .wd-auto.on { border-color:#2aa7ec !important; color:#4fb8ff; }
  .dev-lv h3 small { font-size:14px; color:#ff9a3c; margin-left:8px; } .dev-lv .gl { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:12px 0; }
  .dev-lv .pz { height:78px; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#25272c; border:1px solid rgba(255,255,255,.18); }
  .dev-lv .sl { display:flex; align-items:center; gap:10px; margin-bottom:12px; } .dev-lv .sl span { font-size:15px; font-weight:800; width:80px; } .dev-lv .sl em { font-style:normal; font-size:13px; color:#9aa0aa; }
  .dev-lv .sz { width:64px; height:44px; display:grid; place-items:center; background:#25272c; border:1px solid rgba(255,255,255,.18); } .dev-lv .sz b { font-size:22px; }
  .dev-lv .pz small { font-size:12px; color:#9aa0aa; } .dev-lv .pz b { font-size:28px; line-height:1; } .dev-lv .pz span { font-size:15px; color:#cfd3da; }
  .ps-open.dev { border-color:#ff9a3c !important; color:#ffb36b; }
  .gfx { margin:4px 0 10px; } .gfx .gr { display:flex; align-items:center; gap:14px; margin:8px 0; } .gfx .gr > span { width:72px; font-size:16px; font-weight:800; }
  .gfx .sg { display:flex; flex:1; border:1px solid rgba(255,255,255,.25); } .gfx .sg .btn { flex:1; height:38px; display:grid; place-items:center; font-size:15px; font-weight:700; color:#c8ccd4; border-left:1px solid rgba(255,255,255,.12); }
  .gfx .sg .btn:first-child { border-left:0; } .gfx .sg .btn.on { background:#2aa7ec; color:#fff; } .gfx .gn { margin:4px 0 0 86px; font-size:12.5px; color:#8a8f98; line-height:1.5; }
  .ps-open { margin:10px 0 4px; height:46px; display:grid; place-items:center; background:#2a2c31; border:1px solid rgba(143,211,255,.5); color:#8fd3ff; font-size:17px; font-weight:800; }
  .ps-m .box { width:760px !important; } .ps-sec { margin-top:14px; } .ps-sec .lb { font-size:17px; font-weight:900; margin-bottom:8px; } .ps-sec .lb span { font-size:13px; font-weight:500; color:#8a8f98; margin-left:8px; }
  .ps-list { display:flex; flex-direction:column; gap:6px; max-height:170px; overflow-y:auto; } .ps-none { color:#8a8f98; font-size:15px; padding:14px; background:rgba(255,255,255,.04); text-align:center; }
  .ps-it { display:flex; align-items:center; gap:12px; padding:10px 14px; background:#202227; border:1px solid rgba(255,255,255,.1); } .ps-it i { font-style:normal; width:24px; text-align:center; color:#8fd3ff; } .ps-it b { font-size:17px; } .ps-it span { margin-left:auto; font-size:13px; color:#8a8f98; }
  .ps-it.on { border-color:#2aa7ec; background:#1a2a36; } .ps-it.lk { opacity:.5; }
  .ps-skins { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
  .ps-sk { padding:10px; background:#202227; border:1px solid rgba(255,255,255,.1); display:flex; flex-direction:column; gap:4px; } .ps-sk .sw { display:flex; height:54px; gap:4px; } .ps-sk .sw i:first-child { flex:2; background:linear-gradient(135deg,var(--s0),var(--s1)); } .ps-sk .sw i:last-child { flex:1; background:#1c1f24; box-shadow:inset 4px 0 var(--sa); }
  .ps-sk b { font-size:16px; } .ps-sk span { font-size:12px; color:#8a8f98; } .ps-sk.on { border-color:var(--sa); box-shadow:0 0 0 2px var(--sa); } .ps-sk.lk { opacity:.45; }
  .vol { display:flex; align-items:center; gap:14px; margin:6px 0 4px; font-size:17px; } .vol input { flex:1; accent-color:#2aa7ec; height:28px; } .vol b { width:40px; text-align:right; }
  .toast { position:absolute; left:50%; top:90px; transform:translateX(-50%); background:rgba(0,0,0,.85); border:1px solid rgba(255,255,255,.2); padding:10px 22px; font-size:17px; z-index:95; animation:fl 2.4s forwards; pointer-events:none; }
  .modal { position:absolute; inset:0; background:rgba(0,0,0,.7); display:grid; place-items:center; z-index:70; }
  .modal .box { width:520px; background:#16171a; border:1px solid rgba(255,255,255,.2); padding:24px 28px; } .modal .box h3 { margin:0 0 10px; font-size:22px; } .modal .box p { color:#c8ccd4; line-height:1.7; }
  .modal .row { display:flex; gap:10px; margin-top:16px; } .modal .row div { flex:1; height:44px; display:grid; place-items:center; background:#e8eaee; color:#111; font-weight:900; } .modal .row div.n { background:#3a3b40; color:#ddd; } .modal .row div.dis { background:#2a2b2f; color:#777; border:1px solid #444; }

  /* the terminal's guide */
  .guide { position:absolute; inset:0; z-index:9; cursor:pointer; }
  .guide.dim { background:rgba(2,6,10,.55); }
  .guide .hole { position:absolute; box-shadow:0 0 0 3000px rgba(2,6,10,.62); border:2px solid #7fe3ff; animation:gpulse 1.2s ease-in-out infinite; pointer-events:none; }
  @keyframes gpulse { 50% { border-color:rgba(127,227,255,.3); } }
  .guide .finger { position:absolute; width:28px; height:28px; border-radius:50%; background:rgba(255,255,255,.92); box-shadow:0 0 0 8px rgba(255,255,255,.25); pointer-events:none; animation:gtap 1.1s ease-in-out infinite; }
  @keyframes gtap { 50% { transform:translate(-8px,-8px) scale(.85); } }
  .guide .gbox { position:absolute; left:230px; width:820px; padding:30px 40px 22px 92px; background:linear-gradient(90deg, rgba(6,18,26,.95), rgba(6,14,20,.88)); border-top:2px solid rgba(127,227,255,.75); border-left:5px solid #7fe3ff; pointer-events:none; }
  .guide .gbox.gb-low { bottom:70px; } .guide .gbox.gb-top { top:90px; } .guide .gbox.gb-mid { top:280px; }
  .guide .gbox .lt { position:absolute; left:92px; top:8px; font-size:14px; color:rgba(127,227,255,.8); letter-spacing:.06em; }
  .guide .gbox .gt { font-size:21px; font-weight:600; color:#eef6fa; line-height:1.9; }
  .guide .gbox ruby rt { font-size:13px; color:#7fe3ff; } .guide .gbox ruby { color:#7fe3ff; font-weight:700; }
  .guide .gbox .ar { position:absolute; right:20px; bottom:10px; color:#7fe3ff; font-size:15px; animation:gpulse 1s infinite; }
  .ghint { position:absolute; inset:0; z-index:96; pointer-events:none; } .ghint .gbox { position:absolute; left:40px; width:760px; top:118px; padding:24px 34px 16px 86px; background:linear-gradient(90deg, rgba(6,18,26,.96), rgba(6,14,20,.9)); border-top:2px solid rgba(127,227,255,.75); border-left:5px solid #7fe3ff; }
  .ghint .lt { position:absolute; left:86px; top:6px; font-size:13px; color:rgba(127,227,255,.8); letter-spacing:.06em; } .ghint .gt { font-size:19px; font-weight:600; color:#eef6fa; line-height:1.8; } .ghint ruby rt { font-size:12px; color:#7fe3ff; } .ghint ruby { color:#7fe3ff; font-weight:700; }
  .ghint.side .gbox { left:24px; width:400px; top:236px; padding:22px 20px 14px 70px; } .ghint.side .lt { left:70px; } .ghint.side .gt { font-size:16px; } .ghint.side .hex { left:16px; width:34px; height:34px; margin-top:-17px; }
  .ghint .hex { position:absolute; left:22px; top:50%; width:40px; height:40px; margin-top:-20px; }
  .guide .gbox .hex { position:absolute; left:26px; top:50%; width:44px; height:44px; margin-top:-22px; }
  .gift { position:absolute; inset:0; z-index:10; background:rgba(0,0,0,.72); display:grid; place-items:center; }
  .gift .gb { width:640px; background:#121418; border-top:3px solid #7fe3ff; padding:24px 30px 28px; text-align:center; animation:gin .35s ease-out; }
  @keyframes gin { from { transform:translateY(20px); opacity:0; } }
  .gift .gh { color:#7fe3ff; font-size:15px; letter-spacing:.2em; } .gift .gtt { font-size:26px; font-weight:900; margin:6px 0 18px; }
  .gift .its { display:flex; justify-content:center; gap:16px; margin-bottom:22px; }
  .gift .it { width:140px; padding:16px 8px 12px; background:#1c1f25; border:1px solid rgba(255,255,255,.12); }
  .gift .it .ic .gi { display:inline-block; width:52px; height:52px; }
  .gift .it .ic b { display:inline-grid; place-items:center; width:44px; height:44px; color:#111; font-weight:900; font-size:18px; }
  .gift .it .n { font-size:22px; margin-top:8px; } .gift .it .l { font-size:15px; color:#9aa0aa; margin-top:2px; }
  .gift .ok { display:inline-block; width:220px; height:48px; line-height:48px; background:#e8eaee; color:#111; font-weight:900; font-size:19px; }
  .bn-tabs { position:absolute; left:0; top:120px; display:flex; flex-direction:column; gap:8px; }
  .bn-tabs .bn { width:200px; height:64px; background:rgba(14,15,18,.85); border-left:4px solid transparent; padding:10px 16px; }
  .bn-tabs .bn.on { background:rgba(232,234,238,.95); color:#111; border-left-color:#ff8a1f; }
  .bn-tabs .bn .s { font-size:13px; color:#9aa0aa; } .bn-tabs .bn .t { font-size:20px; font-weight:900; }
  .pull.start { background:#7fe3ff !important; color:#071016 !important; }
  .bn-tabs ~ .hh-info { left:240px; } .bn-tabs ~ .pull.p1 { left:240px; } .bn-tabs ~ .pull.p10 { left:510px; } .bn-tabs ~ .pull.start { left:240px; }

  /* story */
  .story { position:absolute; inset:0; background:#000; overflow:hidden; z-index:60; }   /* over every screen's own layers */
  .story .place { position:absolute; left:70px; top:54px; display:flex; align-items:center; gap:14px; font-size:20px; font-weight:600; letter-spacing:.18em; color:#e8ecf2; text-shadow:0 1px 6px rgba(0,0,0,.9); opacity:0; animation:plIn 1.2s .5s ease-out forwards; transition:opacity 1s; }
  .story .place::before, .story .place::after { content:""; width:26px; height:1px; background:rgba(232,236,242,.75); }
  .story .place.out { opacity:0 !important; animation:none; }
  @keyframes plIn { from { opacity:0; transform:translateX(-12px); } to { opacity:1; transform:none; } }
  .story .bg { position:absolute; inset:-20px; background:#000 center/cover no-repeat; transition:opacity .8s, filter .8s; }
  .story canvas { position:absolute; inset:0; width:100%; height:100%; }
  .story .dlg { position:absolute; left:0; right:0; bottom:0; height:220px; background:linear-gradient(transparent, rgba(0,0,0,.78) 30%, rgba(0,0,0,.92)); padding:62px 220px 0 220px; }
  .story .who { position:absolute; left:200px; top:30px; font-size:26px; font-weight:900; padding-left:14px; border-left:4px solid #ffd400; }
  .story .who small { font-size:17px; color:#9aa0aa; margin-left:10px; font-weight:500; }
  .story .txt { font-size:22px; line-height:1.75; color:#f0f1f3; min-height:80px; white-space:pre-wrap; }
  .story .txt ruby.fr rt { font-size:14px; color:#9fc6ff; letter-spacing:.08em; } .story .txt ruby.fr { ruby-align:center; }
  .story .nar .txt { text-align:center; }
  .story .dlg.mono { top:0; height:auto; background:none; padding:0 200px; display:flex; flex-direction:column; justify-content:center; }
  .story .dlg.mono .txt { text-align:center; font-size:24px; color:#d8dbe0; letter-spacing:.02em; min-height:0; }
  .story .dlg.sys .txt { font-family:"Oswald","Noto Sans KR",monospace; color:#7fe6ff; text-align:center; letter-spacing:.08em; text-shadow:0 0 12px rgba(80,220,255,.6); }
  .story .dlg.sys { background:linear-gradient(transparent, rgba(0,20,30,.75) 30%, rgba(0,15,25,.9)); }
  .story .cg { position:absolute; inset:0; background:#000 center/cover no-repeat; opacity:0; transform:scale(1); transition:opacity .5s, transform 9s ease-out; }
  .story .who.rb { top:6px; }
  .story .who ruby rt { font-size:14px; font-weight:500; color:#9fb0c8; letter-spacing:.18em; padding-bottom:2px; }
  .story .dlg.cold .txt { color:#d9def7; letter-spacing:.08em; }
  .story .dlg.cold .who { border-color:#8fa2ff; }
  .story .dlg.cold { background:linear-gradient(transparent, rgba(4,6,14,.82) 30%, rgba(4,6,14,.95)); }
  .story .arrow { position:absolute; right:240px; bottom:34px; width:0; height:0; border-left:9px solid transparent; border-right:9px solid transparent; border-top:12px solid #fff; animation:bob 1s infinite; }
  @keyframes bob { 50% { transform:translateY(5px); } }
  .story .ctl { position:absolute; right:22px; top:18px; display:flex; gap:8px; z-index:6; }   /* above the blackout */
  .story .ctl div { height:34px; min-width:68px; padding:0 12px; display:grid; place-items:center; background:rgba(0,0,0,.6); border:1px solid rgba(255,255,255,.35); font-size:16px; letter-spacing:.06em; }
  .story .ctl div.on { background:#ffd400; color:#111; border-color:#ffd400; }
  .story .choices { position:absolute; right:60px; top:200px; display:flex; flex-direction:column; gap:12px; z-index:2; }
  .story .choices div { min-width:420px; padding:14px 26px; background:rgba(12,13,15,.9); border:1px solid rgba(255,255,255,.4); font-size:20px; clip-path:polygon(0 0,100% 0,96% 100%,0 100%); }
  .story .choices div:hover { background:#ffd400; color:#111; }
  .story .title { position:absolute; inset:0; display:flex; flex-direction:column; justify-content:center; padding-left:140px; background:rgba(0,0,0,.55); opacity:0; transition:opacity 1s; }
  .story .title .a { font-size:21px; color:#ffd400; letter-spacing:.3em; } .story .title .b { font-size:72px; font-weight:900; margin-top:6px; } .story .title .c { width:420px; height:2px; background:linear-gradient(90deg,#fff,transparent); margin-top:18px; }
  .story .black { position:absolute; inset:0; background:#000; pointer-events:none; opacity:0; transition:opacity .7s; z-index:4; }
  /* documents handed over in a scene: a note, a leaflet, a newspaper, a wanted poster */
  .story .sdoc { position:absolute; right:150px; top:70px; width:430px; padding:26px 30px 22px; color:#2a241c; pointer-events:none; opacity:0; transform:translateY(18px) rotate(1.5deg); transition:opacity .45s, transform .45s; box-shadow:0 18px 40px rgba(0,0,0,.6); z-index:1; }
  .story .sdoc.in { opacity:1; transform:rotate(-1deg); }
  .story .sdoc h4 { margin:0 0 12px; font-size:24px; font-weight:900; letter-spacing:.02em; }
  .story .sdoc p { margin:0 0 7px; font-size:17px; line-height:1.55; }
  .story .sdoc .ft { margin-top:12px; font-size:14px; opacity:.75; }
  .story .sdoc .st { position:absolute; right:22px; bottom:18px; padding:6px 12px; border:3px solid rgba(170,30,30,.8); color:rgba(170,30,30,.85); font-weight:900; font-size:18px; transform:rotate(-9deg); letter-spacing:.08em; }
  .story .sdoc.note { background:linear-gradient(#efe6cf, #e4d8b8); }
  .story .sdoc.note p { font-size:18px; font-weight:600; border-bottom:1px solid rgba(80,60,30,.18); padding-bottom:3px; }
  .story .sdoc.poster { background:radial-gradient(ellipse at 50% 40%, #e9dcc0, #cdb88f); text-align:center; border:2px solid #6b5636; }
  .story .sdoc.poster, .story .sdoc.wanted { padding-bottom:64px; }
  .story .sdoc.poster h4 { color:#8a1c1c; font-size:30px; }
  .story .sdoc.paper { background:#e8e4da; font-family:"Noto Serif KR",serif; border-top:6px double #333; }
  .story .sdoc.paper h4 { font-size:28px; border-bottom:2px solid #333; padding-bottom:8px; }
  .story .sdoc.wanted { background:radial-gradient(ellipse at 50% 35%, #ead9b6, #c9ae7c); text-align:center; border:3px solid #5a4528; }
  .story .sdoc.alert { right:auto; left:50%; margin-left:-235px; top:62px; width:470px; transform:none; color:#cfefff; background:linear-gradient(rgba(6,16,22,.92), rgba(6,16,22,.86)); border:1px solid rgba(127,227,255,.6); box-shadow:0 0 0 1px rgba(255,70,60,.25), 0 18px 40px rgba(0,0,0,.6); font-family:"Noto Sans KR",sans-serif; padding:18px 22px 16px; }
  .story .sdoc.alert.in { transform:none; animation:alertIn .5s steps(4) both; }
  @keyframes alertIn { 0% { opacity:0; clip-path:inset(0 0 100% 0); } 100% { opacity:1; clip-path:inset(0 0 0 0); } }
  .story .sdoc.alert h4 { font-family:Oswald,"Noto Sans KR",sans-serif; font-size:19px; font-weight:600; letter-spacing:.12em; color:#ff6a5c; border-bottom:1px solid rgba(255,90,80,.5); padding-bottom:8px; margin-bottom:12px; animation:alertBlink 1s steps(2) infinite; }
  @keyframes alertBlink { 50% { color:#ffb0a8; } }
  .story .sdoc.alert p { display:flex; gap:12px; align-items:baseline; font-size:16px; margin-bottom:9px; }
  .story .sdoc.alert p b { flex:0 0 auto; min-width:84px; font-family:Oswald,"Noto Sans KR",sans-serif; font-weight:600; font-size:13px; letter-spacing:.06em; color:#06141a; background:#7fe3ff; padding:1px 8px; text-align:center; }
  .story .sdoc.alert p:first-of-type b { background:#ff6a5c; }
  .story .sdoc.alert .ft { color:#7fe3ff; opacity:.8; font-family:Oswald,"Noto Sans KR",sans-serif; letter-spacing:.08em; font-size:12px; }
  .story .sdoc.wanted h4 { font-size:40px; letter-spacing:.2em; color:#3a2a14; }
  .story .sdoc.wanted .pic { width:150px; height:150px; margin:4px auto 12px; background:#3a2e20 center/contain no-repeat; border:3px solid #5a4528; }
  .story .flashw { position:absolute; inset:0; pointer-events:none; opacity:0; z-index:4; }
  .story .log { position:absolute; inset:0; background:rgba(0,0,0,.9); z-index:7; overflow:auto; padding:80px 200px 40px; }
  .story .log .l { margin-bottom:18px; } .story .log .l b { display:block; color:#ffd400; font-size:17px; } .story .log .l span { font-size:19px; color:#e8eaee; line-height:1.6; } .story .log .l.me span { color:#9fd4ff; }
  .nm-ask { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:28px; animation:fl2 1.6s; }
  @keyframes fl2 { from { opacity:0 } to { opacity:1 } }
  .nm-ask .q { font-size:26px; color:#d8dbe0; letter-spacing:.06em; }
  .nm-in { width:420px; height:56px; background:transparent; border:0; border-bottom:2px solid rgba(255,255,255,.5); color:#fff; font-size:28px; text-align:center; font-family:"Noto Sans KR",sans-serif; outline:none; }
  .nm-in:focus { border-color:#ffd400; }
  .nm-ok { width:180px; height:46px; display:grid; place-items:center; border:1px solid rgba(255,255,255,.6); font-size:18px; letter-spacing:.2em; }
  .nm-ok:hover { background:#fff; color:#000; }
  .nm-hint { height:20px; color:#ff8a8a; font-size:16px; }
  .linking { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; }
  .linking .l { font-size:16px; color:#7fe6ff; letter-spacing:.6em; }
  .linking .t { font-size:24px; color:#e8eaee; letter-spacing:.08em; }
  .linking .dots::after { content:"---"; display:inline-block; overflow:hidden; vertical-align:bottom; width:0; animation:dots 1.2s steps(4) infinite; }
  @keyframes dots { to { width:1.6em } }
  .linking .bar { width:360px; height:2px; background:rgba(255,255,255,.12); } .linking .bar i { display:block; height:100%; width:0; background:#7fe6ff; box-shadow:0 0 10px #7fe6ff; animation:lk 2.6s ease-in forwards; }
  @keyframes lk { to { width:100% } }
  .shake { animation:shk .45s; } @keyframes shk { 20% { transform:translate(-8px,4px) } 40% { transform:translate(7px,-5px) } 60% { transform:translate(-5px,3px) } 80% { transform:translate(3px,-2px) } }
  /* ===== v3: the original's chrome ===== */
  .top { height:64px; padding:0; gap:0; background:none; pointer-events:none; } .top > * { pointer-events:auto; }
  .top .slab { position:absolute; left:16px; top:10px; height:50px; display:flex; background:rgba(34,36,41,.94); box-shadow:0 2px 10px rgba(0,0,0,.4); }
  .top .back, .top .home { width:auto; height:50px; border:0; background:none; display:grid; place-items:center; }
  .top .back { width:96px; } .top .back svg { width:22px; height:34px; }
  .top .home { width:170px; border-left:2px solid rgba(255,255,255,.25); margin:9px 0; height:32px; } .top .home svg { width:120px; height:44px; margin-top:-6px; }
  .top .ttl { position:absolute; left:304px; top:14px; margin:0; font-size:22px; font-weight:900; text-shadow:0 1px 4px #000; white-space:nowrap; }
  .top .ttl small { display:block; font-size:13px; color:#9aa0aa; margin:0; letter-spacing:.14em; }
  .res { position:absolute; right:24px; top:14px; display:flex; gap:22px; align-items:center; }
  .top .res { position:absolute; margin:0; }
  .chip { height:auto; padding:0; background:none; border:0; gap:8px; font-size:24px; font-weight:700; text-shadow:0 1px 4px #000; }
  .chip .en { letter-spacing:.01em; }
  .chip b { width:26px; height:26px; font-size:16px; box-shadow:0 0 0 2px rgba(0,0,0,.35); }
  .chip .pl { width:24px; height:24px; border-radius:50%; background:#fff; color:#111; display:grid; place-items:center; font-size:21px; font-weight:900; line-height:1; margin-left:2px; }
  .top .chip { font-size:21px; } .top .chip b { width:22px; height:22px; } .top .chip .pl { width:20px; height:20px; font-size:18px; }
  /* ===== v3 lobby ===== */
  .lb-art { position:absolute; left:120px; top:-40px; height:820px; animation:breathe 6s ease-in-out infinite; pointer-events:auto; cursor:pointer; filter:drop-shadow(0 0 30px rgba(0,0,0,.5)); }
  .lb-art.full { left:60px; -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 12%,#000 78%,transparent); mask-image:linear-gradient(90deg,transparent 0,#000 12%,#000 78%,transparent); }
  .lb-vig { position:absolute; inset:0; pointer-events:none; background:linear-gradient(90deg,rgba(8,9,11,.82) 0,rgba(8,9,11,.15) 30%,rgba(8,9,11,0) 45%,rgba(8,9,11,.35) 60%,rgba(8,9,11,.85) 100%), linear-gradient(180deg,rgba(0,0,0,.55),transparent 18%,transparent 80%,rgba(0,0,0,.5)); }
  .lb-icons { position:absolute; left:22px; top:14px; display:flex; gap:20px; align-items:center; }
  .lb-icons .ib { width:46px; height:46px; display:grid; place-items:center; } .lb-icons .ib svg { width:40px; height:40px; filter:drop-shadow(0 1px 3px #000); }
  .lb-lv { position:absolute; left:40px; top:226px; width:150px; height:150px; }
  .lb-lv svg { position:absolute; inset:0; } .lb-lv .n { position:absolute; left:0; right:0; top:34px; text-align:center; font-size:58px; font-weight:600; line-height:1; }
  .lb-lv .l { position:absolute; left:0; right:0; top:98px; text-align:center; font-size:19px; color:#d8dbe0; }
  .lb-lvbar { position:absolute; left:0; top:340px; width:220px; height:44px; background:rgba(40,42,46,.85); }
  .lb-name { position:absolute; left:40px; top:388px; font-size:34px; font-weight:900; letter-spacing:.12em; text-shadow:0 2px 6px #000; white-space:nowrap; }
  .lb-id { position:absolute; left:42px; top:436px; font-size:17px; color:#d8dbe0; text-shadow:0 1px 3px #000; }
  .lb-rb { position:absolute; top:398px; width:52px; height:52px; border-radius:50%; background:rgba(30,32,36,.85); border:2px solid rgba(255,255,255,.35); display:grid; place-items:center; }
  .lb-rb svg { width:28px; height:28px; }
  .lb-news { position:absolute; left:20px; top:578px; width:300px; height:126px; overflow:hidden; background:#111 center 20%/cover; border:2px solid rgba(255,255,255,.2); }
  .lb-news .bn { position:absolute; left:6px; top:6px; background:#d4253f; color:#fff; font-size:14px; font-weight:700; padding:2px 8px; letter-spacing:.08em; transform:skewX(-10deg); }
  .lb-news .tt { position:absolute; left:10px; bottom:8px; font-size:24px; font-weight:900; text-shadow:0 2px 6px #000; } .lb-news .tt small { display:block; font-size:14px; color:#ffcf7a; }
  .lb-news .nw { position:absolute; right:8px; bottom:8px; background:#ff3b30; color:#fff; font-size:15px; font-weight:700; padding:1px 8px; }
  .lb-small { position:absolute; left:330px; width:170px; height:58px; background:rgba(28,30,34,.92); display:flex; align-items:center; justify-content:space-between; padding:0 14px; }
  .lb-small svg { width:30px; height:30px; } .lb-small span { font-size:20px; font-weight:900; }
  .lab-l { position:absolute; left:110px; right:110px; top:96px; bottom:30px; overflow-y:auto; color:#2b2c2f; }
  .lab-h { font-size:34px; font-weight:900; color:#2b2c2f; margin:0 0 6px 4px; } .lab-h small { font-size:16px; color:#8a8f99; margin-left:12px; letter-spacing:.1em; }
  .lab-note { font-size:17px; font-weight:700; color:#d0451b; margin:0 0 14px 4px; }
  .lab-r { position:relative; display:flex; align-items:center; gap:22px; background:rgba(255,255,255,.88); border-left:6px solid #2b2c2f; padding:14px 160px 14px 20px; margin-bottom:12px; box-shadow:0 3px 8px rgba(0,0,0,.12); }
  .lab-r .c { font-size:30px; font-weight:700; color:#2b2c2f; min-width:120px; } .lab-r .n { font-size:24px; font-weight:900; } .lab-r .d { font-size:16px; color:#555a63; margin:4px 0 6px; }
  .lab-r .g { font-size:15px; font-weight:600; margin-top:2px; } .lab-r .g b { display:inline-block; width:78px; } .lab-r .g b.w { color:#2f8f3a; } .lab-r .g b.l { color:#c0392b; }
  .lab-echo { margin-top:8px; } .lab-echo .eh { font-size:14px; font-weight:800; color:#5a3fa8; margin-bottom:4px; } .lab-echo .eb { display:flex; gap:12px; align-items:flex-start; }
  .lab-echo .lab-el { display:flex; flex-wrap:wrap; gap:4px 12px; font-size:13px; max-width:300px; } .lab-echo .lab-el b { color:#7a5cc8; }
  .sk-m { position:absolute; left:2px; top:2px; z-index:2; padding:0 5px; font-size:13px; font-weight:700; color:#1a1a1a; background:#ffd27a; }
  .sk-up .ms { display:inline-block; margin-top:8px; padding:6px 16px; font-size:16px; font-weight:800; background:#3a3020; border:1px solid #ffd27a; color:#ffd27a; }
  .su-chg, .su-chg .nb { color:#ffb52e !important; }
  .su-msn { margin-top:12px; padding:8px 14px; font-size:17px; background:rgba(40,36,26,.9); color:#e8e2d0; } .su-msn b { color:#ffd27a; }
  .su-ms { margin-top:10px; display:flex; flex-wrap:wrap; align-items:center; gap:6px 14px; padding:8px 12px; background:rgba(58,48,32,.85); font-size:17px; } .su-ms b { color:#ffd27a; }
  .su-ms.done { color:#ffd27a; } .su-ms .msgo { margin-left:auto; padding:6px 16px; font-weight:800; background:#c9a24a; color:#141414; }
  .rq { display:flex; flex-wrap:wrap; gap:4px 12px; font-size:14px; color:#9aa0aa; } .rq i { font-style:normal; } .rq .ok { color:#7fe0a0; } .rq .ng { color:#ff8a7a; } .rq span { color:#c8ccd4; }
  .ib-tr { position:absolute; left:14px; top:148px; width:112px; height:398px; box-sizing:border-box; padding:16px 8px; display:flex; flex-direction:column; align-items:center; background:#2b2d33; color:#fff; box-shadow:0 0 0 1px rgba(255,255,255,.35); }
  .ib-tr .bar { position:absolute; left:0; top:0; bottom:0; width:6px; background:#c9a24a; } .ib-tr small { font-size:11px; letter-spacing:.12em; color:#c9a24a; }
  .ib-tr .tt { font-size:24px; font-weight:900; margin-top:2px; } .ib-tr .pf { width:96px; height:113px; margin-top:14px; background:#15161a center/cover; }
  .ib-tr .st { margin-top:12px; font-size:15px; line-height:1.45; text-align:center; color:#d8dbe0; } .ib-tr .st b { color:#ffd27a; font-size:20px; } .ib-tr .cd { margin-top:8px; font-size:18px; color:#fff; }
  .ib-tr.done { box-shadow:0 0 0 3px #ffd27a; } .ib-tr .badge { right:6px; top:6px; }
  .lt-trd { right:6px; bottom:6px; top:auto !important; width:auto !important; padding:0 8px; font-size:14px !important; background:#c9a24a !important; color:#141414 !important; border-radius:3px; }
  .tr-title { position:absolute; left:60px; top:100px; color:#1d1f24; } .tr-title small { display:block; font-size:13px; letter-spacing:.14em; color:#7a6a3a; } .tr-title b { font-size:32px; font-weight:900; margin-right:14px; } .tr-title span { font-size:16px; color:#555a62; }
  .tr-slot { position:absolute; left:60px; top:170px; width:520px; height:500px; box-sizing:border-box; padding:22px; background:rgba(32,34,39,.96); color:#fff; box-shadow:0 0 0 1px rgba(255,255,255,.2); }
  .tr-slot .hd { font-size:24px; font-weight:900; color:#ffd27a; } .tr-slot .idle { margin-top:120px; text-align:center; font-size:20px; line-height:1.7; color:#b8bec8; }
  .tr-slot .who { display:flex; gap:18px; margin-top:14px; } .tr-slot .who img { width:140px; height:165px; object-fit:cover; background:#15161a; }
  .tr-slot .nm { font-size:24px; font-weight:800; } .tr-slot .sk { display:flex; align-items:center; gap:10px; margin-top:10px; font-size:18px; } .tr-slot .sk .ic { position:relative; width:56px; height:56px; }
  .tr-slot .ml { margin-top:10px; font-size:40px; font-weight:700; color:#ffd27a; }
  .tr-slot .pg { height:10px; margin-top:16px; background:#3a3c42; } .tr-slot .pg i { display:block; height:100%; background:#ffd27a; } .tr-slot .cd { margin-top:8px; font-size:34px; }
  .tr-slot .df, .tr-sk .df { display:flex; flex-wrap:wrap; gap:4px 14px; margin-top:8px; font-size:15px; color:#c8ccd4; } .tr-slot .df s, .tr-sk .df s { color:#8a909a; } .tr-slot .df b, .tr-sk .df b { color:#ffb52e; }
  .tr-slot .acts { position:absolute; left:22px; right:22px; bottom:22px; display:flex; gap:12px; } .tr-slot .acts .btn { flex:1; display:flex; align-items:center; justify-content:center; gap:8px; padding:12px; font-size:20px; font-weight:800; }
  .tr-slot .rush { background:#3a2a56; border:1px solid #b48aff; } .tr-slot .rush i { width:26px; height:26px; } .tr-slot .claim { background:#c9a24a; color:#141414; } .tr-slot .dis, .tr-go .dis { opacity:.45; }
  .tr-pick { position:absolute; left:610px; top:100px; right:40px; bottom:24px; display:flex; flex-direction:column; gap:10px; color:#fff; }
  .tr-ops { display:flex; flex-wrap:wrap; gap:8px; max-height:236px; overflow-y:auto; scrollbar-width:none; padding:3px; }
  .tr-op { position:relative; width:84px; height:110px; background:#15161a center/cover; box-shadow:0 0 0 1px rgba(0,0,0,.4); } .tr-op.on { box-shadow:0 0 0 3px #ffd27a; } .tr-op.no { filter:grayscale(.85) brightness(.6); }
  .tr-op b { position:absolute; left:0; right:0; bottom:0; padding:2px 0; font-size:12px; text-align:center; background:rgba(0,0,0,.72); } .tr-op em { position:absolute; left:2px; top:2px; font-size:11px; font-style:normal; color:#ffd27a; text-shadow:0 1px 2px #000; }
  .tr-none { color:#555a62; font-size:18px; }
  .tr-sks { flex:1; display:flex; flex-direction:column; gap:8px; overflow-y:auto; scrollbar-width:none; }
  .tr-sk { display:grid; grid-template-columns:70px 1fr; gap:12px; padding:10px 14px; background:rgba(44,45,49,.95); } .tr-sk.on { box-shadow:inset 4px 0 0 #ffd27a; }
  .tr-sk .ic { position:relative; width:64px; height:64px; } .tr-sk .nm { font-size:18px; font-weight:800; } .tr-sk .nm em { margin-left:10px; font-style:normal; color:#ffd27a; font-size:16px; }
  .tr-go { display:flex; align-items:center; gap:12px; padding:10px 14px; background:rgba(28,29,33,.96); } .tr-cost { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  .tr-go .tm { font-size:18px; color:#ffd27a; margin-left:auto; } .tr-go .trgo { padding:12px 22px; font-size:19px; font-weight:800; background:#c9a24a; color:#141414; }
  .lab-clr { display:inline-block; margin-top:6px; padding:4px 12px; background:#e8e2f8; color:#5a3fa8; font-size:14px; font-weight:800; }
  .lab-go { position:absolute; right:20px; top:50%; transform:translateY(-50%); width:120px; height:54px; background:#2b2c2f; color:#fff; font-size:22px; font-weight:900; display:grid; place-items:center; }
  .lb-date { position:absolute; right:26px; top:6px; font-size:16px; color:#c8ccd4; letter-spacing:.08em; text-shadow:0 1px 3px #000; }
  .lb-ui > .res { top:26px; }
  .lb-panel { position:absolute; left:650px; top:76px; width:610px; height:628px; transform:perspective(1500px) rotateY(-16deg) rotateZ(-1.5deg); transform-origin:100% 50%; }
  .lt { position:absolute; background:rgba(28,31,36,.9); border:1px solid rgba(255,255,255,.12); overflow:hidden; cursor:pointer; transition:transform .12s, filter .12s; }
  .lt:hover { filter:brightness(1.15); } .lt:active { transform:scale(.98); }
  .lt .lb { position:absolute; left:16px; bottom:12px; font-size:24px; font-weight:900; text-shadow:0 2px 6px #000; z-index:2; }
  .lt .lb small { display:block; font-size:13px; font-weight:700; color:#8fd3d6; letter-spacing:.18em; font-family:"Oswald",sans-serif; }
  .lt .bar { position:absolute; left:8px; top:14px; bottom:14px; width:4px; background:var(--acc,#2fd0d6); }
  .lt .deco { position:absolute; left:22px; top:10px; font-family:"Oswald",sans-serif; font-weight:700; font-size:40px; color:rgba(47,208,214,.22); letter-spacing:.06em; line-height:1; white-space:nowrap; pointer-events:none; }
  .lt .emb { position:absolute; right:22px; top:50%; transform:translateY(-50%); width:110px; height:96px; opacity:.85; }
  .lt.teal { background:linear-gradient(135deg,var(--t0,#1f8f95),var(--t1,#146f74)); border-color:rgba(255,255,255,.18); } .lt.teal .bar { background:#fff; }
  .lt.lock { filter:grayscale(.6) brightness(.7); } .lt.lock .lk { position:absolute; right:12px; top:10px; font-size:13px; letter-spacing:.14em; color:#9aa0aa; font-family:"Oswald",sans-serif; }
  .lt.stam { background:rgba(22,24,28,.95); }
  .lt.stam .num { position:absolute; left:40px; top:26px; font-size:84px; font-weight:600; line-height:1; letter-spacing:-.02em; }
  .lt.stam .pl { position:absolute; left:8px; top:56px; width:30px; height:30px; border-radius:50%; background:#2b2e34; border:2px solid #fff; display:grid; place-items:center; font-size:22px; font-weight:900; }
  .lt.stam .cap { position:absolute; left:16px; right:16px; bottom:12px; height:34px; background:#2b2e34; display:flex; justify-content:center; align-items:center; gap:4px; font-size:19px; font-weight:900; white-space:nowrap; }
  .lt.op .cur { position:absolute; left:20px; bottom:14px; display:flex; gap:12px; align-items:center; font-size:21px; font-weight:900; z-index:2; }
  .lt.op .cur b { background:#4a4d54; font-size:15px; padding:4px 8px; color:#d8dbe0; } .lt.op .cur .en { color:#fff; }
  .lt.op .big { position:absolute; left:22px; top:16px; font-family:"Oswald",sans-serif; font-weight:700; font-size:46px; letter-spacing:.04em; color:var(--acc,#2fd0d6); line-height:1; }
  .lt.op .ko { position:absolute; left:24px; top:72px; font-size:28px; font-weight:900; }
  .lt.ev { background:#111 center/cover; } .lt.ev .lb { font-size:22px; } .lt.ev::after { content:""; position:absolute; inset:0; background:linear-gradient(90deg,rgba(0,0,0,.7),rgba(0,0,0,.05)); }
  .lt .badge { position:absolute; right:-2px; top:-2px; min-width:30px; height:30px; background:#e8551b; color:#fff; font-size:18px; font-weight:700; display:grid; place-items:center; padding:0 6px; z-index:3; }
  .lt .sub { position:absolute; top:44px; bottom:8px; background:rgba(255,255,255,.12); display:flex; align-items:center; gap:10px; padding:0 14px; font-size:20px; font-weight:900; }
  .lt .sub:hover { background:rgba(255,255,255,.22); } .lt .sub svg { width:34px; height:34px; } .lt .sub.lockd { opacity:.45; }
  .lt .hdr { position:absolute; left:14px; top:10px; font-size:20px; font-weight:900; display:flex; gap:8px; align-items:center; } .lt .hdr svg { width:22px; height:22px; }
  /* operator file */
  .od-bg { background:radial-gradient(70% 90% at 52% 40%, #3a3d45 0, #1c1d22 55%, #0d0e10 100%) !important; }
  .od-blur { position:absolute; inset:-40px; width:calc(100% + 80px); height:calc(100% + 80px); object-fit:cover; object-position:50% 30%; filter:blur(22px) brightness(.7) saturate(.9); pointer-events:none; }
  .rgb { height:96px; display:grid; place-items:center; } .rgb i { position:absolute; border:1.5px solid rgba(255,255,255,.75); } .rgb i.me { background:#fff; border-color:#fff; }
  .emk.big { width:50px; height:38px; }
  .pot-hex { width:36px; height:40px; display:grid; place-items:center; background:#e8eaee; color:#111; font-size:21px; font-weight:700; clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%); flex:none; }
  .pot-hex.big { width:58px; height:64px; font-size:32px; }
  .sk-ic { width:100%; height:100%; display:grid; place-items:center; position:relative; overflow:hidden; background:linear-gradient(150deg, color-mix(in srgb, var(--sc) 88%, #fff) 0, var(--sc) 45%, color-mix(in srgb, var(--sc) 55%, #000) 100%); }
  .sk-ic.img { background-size:800% 800%; background-repeat:no-repeat; } .sk-ic.img::after { display:none; }
  .sk-ic::after { content:""; position:absolute; inset:0; background:linear-gradient(118deg, transparent 0 58%, rgba(255,255,255,.28) 58% 66%, transparent 66%); pointer-events:none; }
  .sk-ic svg { width:70%; height:70%; position:relative; z-index:1; filter:drop-shadow(1px 1px 0 rgba(0,0,0,.35)); }
  .bx-ic { width:34px; height:34px; display:grid; place-items:center; color:#c8ccd4; } .bx-ic img, .bx-ic svg { width:30px; height:30px; }
  /* operator file v2 */
  .od-ill { position:absolute; left:190px; top:-8px; width:900px; height:auto; transform:none; -webkit-mask-image:linear-gradient(90deg, transparent 0, #000 18%); mask-image:linear-gradient(90deg, transparent 0, #000 18%); pointer-events:none; }
  .od-ill.chibi { width:auto; height:640px; top:auto; bottom:0; left:330px; right:auto; }
  .od-wash { position:absolute; inset:0; pointer-events:none; background:linear-gradient(90deg, rgba(246,247,249,.9) 0, rgba(246,247,249,.62) 20%, rgba(246,247,249,.18) 31%, rgba(246,247,249,0) 40%), linear-gradient(270deg, rgba(10,11,13,.55) 0, transparent 30%); }
  .odl { position:absolute; left:14px; top:184px; width:340px; }
  .odl-tab { display:inline-flex; align-items:center; gap:6px; height:24px; padding:0 34px 0 8px; background:linear-gradient(90deg,#fff 60%,transparent); color:#111; font-size:18px; font-weight:900; }
  .odl-tab i { font-style:normal; color:#555; font-size:16px; }
  .odl-g { display:grid; grid-template-columns:110px 120px; gap:3px 18px; margin-top:6px; }
  .odl-g > div { display:flex; align-items:center; gap:3px; height:23px; background:linear-gradient(90deg, rgba(255,255,255,.95) 50%, rgba(255,255,255,0)); }
  .odl-g i { width:23px; height:23px; display:grid; place-items:center; background:#222; color:#fff; flex:none; } .odl-g i svg { width:15px; height:15px; }
  .odl-g b { font-size:19px; font-weight:500; color:#333; letter-spacing:.01em; } .odl-g b.w { font-family:"Noto Sans KR",sans-serif; font-size:17px; font-weight:700; }
  .odl-st { margin-top:34px; font-size:22px; letter-spacing:-2px; color:#fff; -webkit-text-stroke:1px #8a8f99; text-shadow:0 1px 3px rgba(0,0,0,.25); }
  .odl-en { font-family:"Oswald",sans-serif; font-size:24px; font-weight:500; line-height:1; color:#fff; -webkit-text-stroke:.8px #555a63; paint-order:stroke fill; text-shadow:0 2px 4px rgba(0,0,0,.25); margin-top:2px; }
  .odl-en.ko { font-family:"Noto Sans KR",sans-serif; font-size:18px; font-weight:700; }
  .odl-nm { font-size:70px; font-weight:900; line-height:1.05; color:#fff; -webkit-text-stroke:2px #6c717b; paint-order:stroke fill; letter-spacing:-.02em; text-shadow:0 3px 8px rgba(0,0,0,.25); white-space:nowrap; }
  .odl-hid { font-size:14px; color:#555; font-weight:700; }
  .odl-foot { display:flex; gap:6px; margin-top:12px; height:74px; }
  .odl-ci { width:74px; display:grid; place-items:center; background:rgba(28,29,32,.92); border:1px solid rgba(255,255,255,.35); }
  .odl-rg { width:118px; position:relative; background:rgba(70,72,78,.9); display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .odl-rg .rgb { height:46px; } .odl-rg .rgb i { border-color:#fff; } .odl-rg span { font-size:14px; color:#fff; margin-top:2px; }
  .odl-tags { width:118px; display:flex; flex-direction:column; gap:4px; }
  .odl-tags span { flex:1; display:grid; place-items:center; background:repeating-linear-gradient(135deg, rgba(60,62,68,.95) 0 6px, rgba(52,54,60,.95) 6px 12px); color:#fff; font-size:17px; font-weight:700; }
  .odr { position:absolute; right:32px; top:70px; bottom:12px; width:306px; overflow-y:auto; overflow-x:hidden; scrollbar-width:none; display:flex; flex-direction:column; gap:24px; }
  .odr::-webkit-scrollbar { display:none; }
  .odr > * { flex:none; }
  .odr-pg { display:flex; flex-direction:column; gap:12px; padding-bottom:12px; } .odr-pg > * { flex:none; }
  .odr-lv { position:relative; height:118px; }
  .odr-lv .lvr { position:absolute; left:0; top:0; z-index:1; } .odr-lv .lvr .tk { fill:rgba(0,0,0,.45); stroke:rgba(255,255,255,.35); stroke-width:4; } .odr-lv .lvr .ar { stroke-width:4; }
  .odr-lv .lvr b { font-size:14px; top:16%; } .odr-lv .lvr span { font-size:40px; top:33%; font-weight:400; }
  .odr-cap { position:absolute; left:72px; top:86px; font-size:22px; color:#fff; text-shadow:0 1px 3px #000; }
  .odr-exp { position:absolute; left:58px; right:0; top:22px; height:42px; padding:0 14px 0 46px; display:flex; align-items:center; gap:8px; background:rgba(40,41,45,.86); }
  .odr-exp small { font-size:12px; color:#aab0ba; letter-spacing:.1em; } .odr-exp b { font-size:18px; color:#ffd27a; font-weight:500; }
  .odr-exp i { margin-left:auto; font-style:normal; font-size:28px; color:#fff; font-weight:300; } .odr-exp em { margin-left:auto; font-style:normal; font-size:14px; padding:1px 6px; background:rgba(255,255,255,.18); color:#c8ccd4; }
  .odr-row { display:flex; gap:8px; height:68px; }
  .odr-el, .odr-pt { position:relative; background:rgba(40,41,45,.86); display:flex; align-items:center; }
  .odr-el { flex:1.1; padding-left:4px; } .odr-pt { flex:1; padding-left:10px; }
  .odr-el .em { width:66px; height:52px; color:#fff; margin-top:-14px; filter:drop-shadow(0 2px 3px rgba(0,0,0,.6)); } .odr-el .em svg { width:100%; height:100%; }
  .odr-el .tx { font-size:18px; font-weight:900; display:flex; flex-direction:column; align-items:flex-start; gap:2px; } .odr-el em { font-style:normal; font-size:13px; padding:0 5px; background:rgba(255,255,255,.2); color:#c8ccd4; }
  .odr-pt .tx { flex:1; height:100%; display:flex; flex-direction:column; align-items:flex-end; justify-content:center; padding-right:10px; } .odr-pt small { font-size:13px; color:#c8ccd4; } .odr-pt i { font-style:normal; font-size:30px; line-height:1; font-weight:300; }
  .odr-el:hover, .odr-pt:hover, .odr-br:hover { background:rgba(56,58,63,.9); }
  .odr-skb { position:relative; padding:12px 12px 16px; background:rgba(40,41,45,.86); }
  .odr-sk { display:flex; gap:10px; }
  .sk-t { position:relative; width:62px; height:62px; box-shadow:0 0 0 1px rgba(255,255,255,.25); }
  .sk-t.on { box-shadow:0 0 0 2px #fff; } .sk-t.open { box-shadow:0 0 0 2px #4fc3ff; } .sk-t.lock .sk-ic { filter:grayscale(1) brightness(.5); }
  .sk-ck { position:absolute; right:-2px; top:-2px; width:18px; height:18px; background:#23a3e6; clip-path:polygon(0 0,100% 0,100% 100%); }
  .sk-ck::after { content:""; position:absolute; right:2px; top:2px; width:6px; height:3px; border:solid #fff; border-width:0 0 2px 2px; transform:rotate(-45deg); }
  .sk-sp { position:absolute; left:0; right:0; bottom:0; display:flex; justify-content:flex-end; gap:3px; padding:0 2px; background:linear-gradient(transparent, rgba(0,0,0,.75)); font-size:13px; color:#fff; }
  .sk-sp span:last-child { color:#b8f05a; }
  .sk-lk { position:absolute; left:0; right:0; top:22px; text-align:center; font-size:12px; color:#c8ccd4; }
  .odr-dn { position:absolute; left:50%; bottom:4px; width:0; height:0; margin-left:-5px; border:5px solid transparent; border-top-color:rgba(255,255,255,.4); border-bottom:0; }
  .odr-skb.unf > .odr-dn { transform:rotate(180deg); }
  .odr-br > .odr-dn { left:auto; right:10px; margin:0; }
  .odr-fold.open .odr-fi { margin-top:12px; padding-top:10px; }
  .sx-n { font-size:18px; font-weight:900; }
  .sx-tags { display:flex; gap:4px; margin:4px 0 6px; } .sx-tags span { font-size:13px; font-weight:700; padding:1px 6px; color:#fff; background:#5a8f2b; } .sx-tags span.a { background:#d0702a; } .sx-tags span.t { background:#3a3c42; }
  .odr-br { position:relative; padding:12px 12px 14px; background:rgba(40,41,45,.86); display:grid; grid-template-columns:1fr auto; gap:8px 10px; }
  .odr-br .b1 { display:flex; align-items:center; gap:10px; padding-right:10px; border-right:1px solid rgba(255,255,255,.2); }
  .odr-br .bi { width:44px; height:44px; display:grid; place-items:center; background:rgba(0,0,0,.35); } .odr-br .b1 b { font-size:18px; }
  .odr-br .b2 { display:flex; align-items:center; gap:8px; }
  .odr-br .mbox { width:64px; height:56px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; border:1.5px solid rgba(255,255,255,.5); background:rgba(0,0,0,.3); color:#fff; } .odr-br .mbox svg { width:24px; height:24px; } .odr-br .mbox span { font-size:9px; }
  .odr-br .mst { display:flex; flex-direction:column; gap:6px; font-size:14px; color:#c8ccd4; } .odr-br .mst i { font-style:normal; font-size:19px; color:#fff; }
  .odr-br .b3 { grid-column:1 / -1; display:flex; flex-direction:column; align-items:stretch; gap:6px; }
  .odr-br .tl { display:flex; flex-wrap:wrap; align-items:center; gap:6px; } .odr-br .tl > span { align-self:flex-start; } .odr-br .tl em { font-style:normal; font-size:13px; color:#9aa0aa; }
  .odr-br .tl.lk { opacity:.6; }
  .odr-br .fx { flex-basis:100%; display:grid; grid-template-rows:0fr; transition:grid-template-rows .3s ease; } .odr-br .fx > div { overflow:hidden; min-height:0; }
  .odr-br.open .fx { grid-template-rows:1fr; }
  .odr-br .fx.tr { grid-column:1 / -1; }
  .odr-br .fx p { margin:4px 0 2px; font-size:15px; line-height:1.6; color:#e2e5ea; }
  .odr-br.open > .odr-dn { transform:rotate(180deg); }
  .odr-br .b3 span { padding:2px 6px; background:#e8eaee; color:#16171a; font-size:16px; font-weight:900; } .odr-br .b3 span.lk { background:#55575d; color:#9aa0aa; }
  .odr-fold { display:grid; grid-template-rows:0fr; transition:grid-template-rows .3s ease; } .odr-fold.open { grid-template-rows:1fr; } .odr-fold.now { transition:none; }
  .odr-fi { overflow:hidden; min-height:0; }
  .sx-d { font-size:15px; line-height:1.65; color:#e2e5ea; }
  .sx-use { margin-top:10px; height:32px; display:grid; place-items:center; font-size:15px; font-weight:900; background:#e8eaee; color:#16171a; } .sx-use.on { background:#23a3e6; color:#fff; } .sx-use.lk { background:#2e3035; color:#7d828b; }
  /* level up v2 */
  .lu-ill { position:absolute; left:140px; bottom:-120px; height:960px; pointer-events:none; -webkit-mask-image:linear-gradient(90deg, transparent 0, #000 12%, #000 86%, transparent 100%); mask-image:linear-gradient(90deg, transparent 0, #000 12%, #000 86%, transparent 100%); }
  .lu-ill.chibi { height:640px; bottom:0; left:200px; }
  .lu-box { position:absolute; left:38px; top:302px; width:576px; height:120px; display:flex; background:rgba(20,21,24,.78); }
  .lu-tag { position:absolute; left:0; top:-26px; height:24px; padding:0 10px; background:rgba(20,21,24,.78); font-size:15px; letter-spacing:.06em; display:grid; place-items:center; }
  .lu-l { width:260px; padding:8px 16px; display:flex; flex-direction:column; justify-content:center; gap:1px; border-right:1px solid rgba(255,255,255,.2); }
  .lu-l > div { display:flex; align-items:center; height:23px; font-size:16px; }
  .lu-l span { width:84px; } .lu-l b { width:52px; font-size:18px; font-weight:400; } .lu-l i { width:30px; font-style:normal; color:#9aa0aa; } .lu-l b.up { color:#ffd84a; }
  .lu-r { flex:1; padding:12px 18px; display:flex; flex-direction:column; gap:6px; }
  .lu-tg, .lu-c { display:flex; align-items:baseline; justify-content:space-between; padding-bottom:4px; border-bottom:1px solid rgba(255,255,255,.25); font-size:17px; }
  .lu-tg b { font-size:21px; font-weight:400; } .lu-c b { font-size:19px; font-weight:400; color:#ffd27a; } .lu-c.short b { color:#ff5a5a; }
  .lu-note { font-size:14px; color:#ffd84a; }
  .lu-items { position:absolute; left:44px; bottom:30px; display:flex; gap:18px; }
  .lu-it { position:relative; width:84px; height:84px; border-radius:50%; background:radial-gradient(circle at 50% 40%, #5a5f69, #26282d 70%); box-shadow:0 0 0 3px #c9a64a, 0 4px 10px rgba(0,0,0,.5); display:grid; place-items:center; }
  .lu-it .cn { width:44px; height:44px; border-radius:50%; background:#e6c35a; color:#5a3d00; font-weight:900; font-size:22px; display:grid; place-items:center; margin-top:-10px; }
  .lu-it b { position:absolute; left:0; right:0; bottom:6px; text-align:center; font-size:18px; font-weight:500; text-shadow:0 1px 3px #000; } .lu-it.short { box-shadow:0 0 0 3px #e04848, 0 4px 10px rgba(0,0,0,.5); }
  .lu-strip { position:absolute; left:884px; top:0; bottom:0; width:206px; background:repeating-linear-gradient(135deg, rgba(255,255,255,.03) 0 2px, transparent 2px 8px), linear-gradient(180deg, rgba(14,15,17,.85), rgba(30,31,35,.92)); box-shadow:0 0 30px rgba(0,0,0,.4); cursor:ns-resize; user-select:none; touch-action:none; display:flex; flex-direction:column; align-items:center; }
  .lu-up { height:84px; font-size:76px; line-height:84px; font-weight:500; color:rgba(255,255,255,.22); -webkit-text-stroke:1px rgba(255,255,255,.35); cursor:pointer; } .lu-up.b { font-size:96px; color:rgba(255,255,255,.55); height:110px; line-height:110px; }
  .lu-ring { position:relative; margin-top:8px; }
  .lu-ring .lvr .tk { fill:rgba(0,0,0,.25); stroke:rgba(255,255,255,.55); stroke-width:6; } .lu-ring .lvr .ar { stroke:#ffd400; stroke-width:6; }
  .lu-ring .lvr b { font-size:21px; top:17%; } .lu-ring .lvr span { font-size:74px; top:30%; font-weight:400; color:#fff; }
  .lu-tgt { position:absolute; left:166px; top:70px; height:24px; padding:0 30px 0 22px; background:linear-gradient(90deg,#f2f3f5,rgba(242,243,245,0)); color:#555; font-size:13px; display:grid; place-items:center; clip-path:polygon(12px 0,100% 0,100% 100%,12px 100%,0 50%); }
  .lu-chev { margin-top:34px; width:58px; cursor:pointer; } .lu-chev svg { width:100%; display:block; }
  .lu-hint { margin-top:8px; text-align:center; font-size:16px; font-weight:700; line-height:1.3; width:150px; }
  .lu-max { position:absolute; left:1094px; top:136px; height:36px; padding:0 14px 0 22px; display:flex; align-items:center; gap:18px; background:#26282c; font-size:18px; clip-path:polygon(10px 0,100% 0,100% 100%,10px 100%,0 50%); cursor:pointer; } .lu-max b { font-weight:400; }
  .lu-go { position:absolute; left:1104px; bottom:198px; right:0; height:46px; display:flex; align-items:center; gap:22px; padding-left:28px; background:linear-gradient(90deg,#1c5d8c,#164a70); color:#fff; font-size:19px; font-weight:700; box-shadow:0 3px 8px rgba(0,0,0,.4); }
  .lu-go i { width:30px; height:24px; color:#9fd2ff; } .lu-go i svg { width:100%; height:100%; } .lu-go.dis { background:#3a3c42; color:#80858e; } .lu-go.dis i { color:#80858e; }
  /* promotion v2 */
  .pr-bg { background:#0c0c0e !important; } .od-blur.dk { filter:blur(26px) brightness(.25); }
  .pr-ill { position:absolute; left:50%; top:30px; height:900px; transform:translateX(-50%); pointer-events:none; filter:brightness(.8); -webkit-mask-image:linear-gradient(90deg, transparent 0, #000 22%, #000 78%, transparent 100%); mask-image:linear-gradient(90deg, transparent 0, #000 22%, #000 78%, transparent 100%); }
  .pr-ill.chibi { height:600px; top:60px; }
  .pr-vig { position:absolute; inset:0; pointer-events:none; background:radial-gradient(42% 70% at 50% 40%, transparent 35%, rgba(10,10,12,.78) 72%, #0a0a0c 100%); }
  .pr-band { position:absolute; left:0; right:0; top:296px; height:118px; background:linear-gradient(90deg, rgba(40,40,42,.7), rgba(28,28,30,.72)); }
  .pr-n1 { position:absolute; left:72px; top:18px; text-align:center; } .pr-n1 b { display:block; font-size:44px; line-height:1; font-weight:400; } .pr-n1 span { font-size:19px; font-weight:700; }
  .pr-sm { position:absolute; left:190px; top:24px; width:86px; height:70px; color:#fff; } .pr-sm svg { width:100%; height:100%; }
  .pr-line { position:absolute; left:310px; right:880px; top:59px; height:3px; background:linear-gradient(90deg, rgba(255,255,255,.1), rgba(255,255,255,.6)); }
  .pr-big { position:absolute; left:430px; top:-14px; width:170px; height:136px; color:#fff; filter:drop-shadow(0 3px 6px rgba(0,0,0,.6)); } .pr-big svg { width:100%; height:100%; }
  .pr-n2 { position:absolute; left:596px; top:12px; text-align:center; } .pr-n2 b { display:block; font-size:62px; line-height:1; font-weight:400; } .pr-n2 span { font-size:21px; font-weight:700; }
  .pr-gain { position:absolute; left:716px; top:16px; font-size:16px; font-weight:700; line-height:1.55; } .pr-gain em { font-style:normal; color:#3fb6ff; } .pr-gain b { font-weight:400; color:#fff; }
  .pr-mats { position:absolute; left:38px; bottom:36px; display:flex; gap:26px; align-items:flex-end; }
  .pr-m { position:relative; width:84px; height:84px; border-radius:50%; display:grid; place-items:center; background:radial-gradient(circle at 50% 40%, #4c5059, #1e2024 70%); box-shadow:0 0 0 3px #3a98d8, 0 4px 10px rgba(0,0,0,.5); }
  .pr-m.lv { background:none; box-shadow:none; } .pr-m.lv .lvr span { font-size:32px; top:22%; } .pr-m.lv .lvr b { display:none; } .pr-m.lv small { position:absolute; top:48px; left:0; right:0; text-align:center; font-size:13px; }
  .pr-m .cn { width:42px; height:42px; border-radius:50%; background:#e6c35a; color:#5a3d00; font-weight:900; font-size:21px; display:grid; place-items:center; }
  .pr-m > b { position:absolute; left:50%; bottom:-30px; transform:translateX(-50%); min-width:80px; padding:1px 6px; text-align:center; background:#2e8fd6; color:#fff; font-size:18px; font-weight:500; }
  .pr-m > b.no { background:#c93a3a; }
  .pr-ask { position:absolute; right:64px; bottom:46px; width:520px; display:flex; flex-direction:column; align-items:center; gap:28px; }
  .pr-ask .q { font-size:21px; font-weight:700; color:#c8ccd4; }
  .pr-bt { display:flex; width:100%; }
  .pr-x, .pr-ok { flex:1; height:56px; display:grid; place-items:center; } .pr-x { background:repeating-linear-gradient(135deg,#2a2b2e 0 6px,#232427 6px 12px); } .pr-ok { background:repeating-linear-gradient(135deg,#2a8ed6 0 6px,#2482c6 6px 12px); }
  .pr-x svg, .pr-ok svg { width:38px; height:38px; } .pr-ok.dis { background:#3a3c42; } .pr-ok.dis path { stroke:#80858e; }
  /* hub v2 */
  .oh-fog::before { content:""; position:absolute; inset:0; background:radial-gradient(60% 50% at 70% 40%, rgba(255,255,255,.9), transparent 70%); }
  .oh-art { position:absolute; left:0; top:0; width:820px; height:720px; -webkit-mask-image:linear-gradient(90deg, #000 45%, transparent 96%), linear-gradient(180deg, #000 62%, transparent 94%); -webkit-mask-composite:source-in; mask-image:linear-gradient(90deg, #000 45%, transparent 96%), linear-gradient(180deg, #000 62%, transparent 94%); mask-composite:intersect; }
  .oh-wm { position:absolute; left:760px; top:180px; text-align:center; color:transparent; -webkit-text-stroke:1.2px rgba(60,64,72,.16); font-size:44px; font-weight:700; line-height:1.15; letter-spacing:.08em; pointer-events:none; }
  .oh-wm::before { content:""; position:absolute; left:50%; top:-70px; width:120px; height:120px; margin-left:-60px; border:1.2px solid rgba(60,64,72,.14); transform:rotate(45deg); }
  .oh-art .im { position:absolute; inset:0; background-size:cover; background-position:40% 40%; filter:saturate(.95) contrast(1.05); }
  .oh-title { position:absolute; left:28px; top:250px; color:#fff; text-shadow:0 2px 12px rgba(0,0,0,.6); }
  .oh-title small { display:block; font-size:18px; font-weight:700; margin-left:4px; } .oh-title b { display:block; font-size:58px; font-weight:900; line-height:1.1; -webkit-text-stroke:1px rgba(0,0,0,.25); }
  .oh-title span { display:block; font-size:15px; letter-spacing:.2em; margin:4px 0 0 4px; opacity:.85; }
  .oh-bar2 { position:absolute; left:14px; top:420px; width:410px; height:92px; display:flex; filter:drop-shadow(0 4px 8px rgba(0,0,0,.3)); }
  .oh-bar2 .ic { width:52px; background:#2b2c2f; color:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; } .oh-bar2 .ic svg { width:28px; height:28px; } .oh-bar2 .ic span { font-size:14px; color:#ffb35c; }
  .oh-bar2 .tx { flex:1; padding:14px 16px; background:linear-gradient(90deg,#f4f4f5,#e6e7ea); color:#2a2b2e; font-size:16px; font-weight:700; white-space:nowrap; clip-path:polygon(0 0, calc(100% - 26px) 0, 100% 50%, calc(100% - 26px) 100%, 0 100%); }
  .oh-bar2 .tx b { font-weight:500; font-size:18px; }
  .oh-bar2 .tr { position:relative; margin:16px 30px 0 4px; height:3px; background:#9a9da3; } .oh-bar2 .tr i { display:block; height:100%; background:#2a2b2e; }
  .oh-bar2 .tr em { position:absolute; top:-8px; width:14px; height:14px; margin-left:-7px; border:2px solid #f2b600; background:#fff; transform:rotate(45deg); }
  .oh-bar2 .gt { position:absolute; right:12px; top:50%; width:16px; height:16px; margin-top:-8px; border:solid #2a2b2e; border-width:4px 4px 0 0; transform:rotate(45deg); }
  .oh-last2 { position:absolute; left:906px; top:434px; width:242px; filter:drop-shadow(0 4px 8px rgba(0,0,0,.3)); }
  .oh-last2 .hd { height:24px; padding:0 10px; background:#2b2c2f; color:#fff; font-size:16px; font-weight:700; display:flex; align-items:center; }
  .oh-last2 .bd { position:relative; height:66px; padding:0 12px; display:flex; align-items:center; justify-content:space-between; background:repeating-linear-gradient(45deg, rgba(0,0,0,.035) 0 2px, transparent 2px 6px), #f3f4f6; color:#222; }
  .oh-last2 .pl { padding:2px 16px; border-radius:12px; background:#55575c; color:#fff; font-size:15px; font-weight:700; }
  .oh-last2 .cd { text-align:right; } .oh-last2 .cd b { display:block; font-size:26px; font-weight:600; line-height:1; } .oh-last2 .cd small { font-size:14px; font-weight:700; }
  .oh-nav2 { position:absolute; left:0; right:0; bottom:0; height:82px; background:linear-gradient(transparent, rgba(0,0,0,.08)); }
  .oh-nav2 > div { position:absolute; bottom:12px; width:110px; height:64px; margin-left:-55px; display:grid; place-items:center; }
  .oh-nav2 i { width:34px; height:34px; color:#4a4c52; display:block; } .oh-nav2 i svg { width:100%; height:100%; display:block; }
  .oh-nav2 > div.on i { display:none; }
  .oh-nav2 > div.on b { position:relative; font-size:20px; font-weight:900; color:#fff; text-shadow:0 1px 4px rgba(0,0,0,.6); }
  .oh-nav2 > div.on::before { content:""; position:absolute; left:50%; top:50%; width:58px; height:58px; margin:-29px 0 0 -29px; transform:rotate(45deg); background:rgba(120,124,132,.35); border:1px solid rgba(255,255,255,.5); }
  .oh-nav2 > div.on::after { content:""; position:absolute; left:50%; top:-6px; margin-left:-9px; border:9px solid transparent; border-top:11px solid #fff; border-bottom:0; filter:drop-shadow(0 1px 2px rgba(0,0,0,.4)); }
  .oh-nav2 > div:not(.on) b { display:none; }
  .oh-nav2.dk i { color:#c8ccd4; }
  /* story select */
  .ch-bg2 { position:absolute; inset:0; background:#16171a; } .ch-bg2 .im { position:absolute; inset:0; background-size:cover; background-position:center 35%; filter:grayscale(.85) brightness(.3) blur(3px); }
  .ch-bg2::after { content:""; position:absolute; inset:0; background:linear-gradient(90deg, rgba(10,10,12,.6), transparent 60%), linear-gradient(0deg, rgba(10,10,12,.85), transparent 35%); }
  .sf { font-family:"Times New Roman","Noto Serif KR",Georgia,serif; font-weight:400; letter-spacing:0; }
  .ch-hd { position:absolute; left:110px; top:138px; display:flex; align-items:center; gap:14px; }
  .ch-hd .rk { width:52px; height:52px; display:grid; place-items:center; opacity:.8; } .ch-hd .rk svg { width:40px; height:40px; }
  .ch-hd .k { font-size:17px; font-weight:700; color:#e8eaee; } .ch-hd .k .sf { font-size:26px; }
  .ch-hd .t { font-size:34px; font-weight:900; margin-top:2px; }
  .ch-act { position:absolute; left:420px; top:244px; text-align:right; } .ch-act .sf { font-size:30px; color:#e8eaee; } .ch-act .en { font-size:15px; letter-spacing:.06em; color:#8a8f99; }
  .ch-rec { position:absolute; right:34px; top:22px; height:34px; padding:0 22px 0 12px; display:flex; align-items:center; gap:14px; border-radius:17px; background:#f2f3f5; color:#2a2b2e; font-size:17px; font-weight:900; box-shadow:0 2px 8px rgba(0,0,0,.4); }
  .ch-rec i { width:20px; height:20px; } .ch-rec i svg { width:100%; height:100%; } .ch-rec i svg path:first-child { fill:#2a2b2e; }
  .ch-row2 { position:absolute; left:0; right:0; top:200px; height:320px; overflow-x:auto; overflow-y:hidden; display:flex; gap:38px; align-items:center; padding:0 60px 0 622px; scrollbar-width:none; }
  .ch-row2::-webkit-scrollbar { display:none; }
  .ch-line { position:absolute; left:0; top:178px; width:2400px; height:30px; pointer-events:none; background:linear-gradient(transparent 46%, rgba(255,255,255,.55) 48%, rgba(255,255,255,.55) 52%, transparent 54%), linear-gradient(176deg, transparent 47%, rgba(255,255,255,.25) 49%, transparent 51%); filter:drop-shadow(0 0 4px rgba(255,255,255,.6)); }
  .ch-sq { position:relative; flex:none; width:246px; height:246px; overflow:hidden; background:#202125; border:3px solid rgba(255,255,255,.85); box-shadow:0 6px 20px rgba(0,0,0,.6); }
  .ch-sq .im { position:absolute; inset:0; background-size:cover; background-position:55% 40%; transition:transform .35s; } .ch-sq.open:hover .im { transform:scale(1.05); }
  .ch-sq .sh { position:absolute; inset:0; background:linear-gradient(180deg, rgba(40,90,130,.15), rgba(10,14,20,.55) 60%, rgba(8,10,14,.9)); }
  .ch-sq:not(.open) { border-color:rgba(255,255,255,.35); } .ch-sq:not(.open) .sh { background:repeating-linear-gradient(135deg, rgba(255,255,255,.03) 0 2px, transparent 2px 12px), linear-gradient(#2a2b30,#141518); }
  .ch-sq .epn { position:absolute; left:14px; top:150px; padding:2px 3px; border:1.5px solid #fff; font-size:9px; line-height:1.05; text-align:center; }
  .ch-sq .t { position:absolute; left:0; right:0; top:146px; text-align:center; font-size:34px; font-weight:900; text-shadow:0 2px 8px rgba(0,0,0,.7); }
  .ch-sq .e { position:absolute; left:0; right:0; top:192px; text-align:center; font-size:17px; letter-spacing:.06em; font-weight:600; }
  .ch-sq:not(.open) .t, .ch-sq:not(.open) .e, .ch-sq:not(.open) .epn { color:#5a5d64; border-color:#5a5d64; }
  .ch-sq .pin { position:absolute; right:-2px; top:-2px; width:40px; height:40px; background:#fff; transform:rotate(45deg) translate(-4px,-22px); }
  .ch-sq .pg { position:absolute; right:10px; bottom:8px; font-size:15px; color:#c8ccd4; }
  /* squad picker v2 */
  .pk-l { position:absolute; left:0; top:0; bottom:0; width:300px; padding:72px 0 0; background:linear-gradient(180deg,#f4f5f7,#e4e6e9); box-shadow:4px 0 14px rgba(0,0,0,.25); color:#222; display:flex; flex-direction:column; }
  .pk-hd { position:relative; padding:0 14px; } .pk-hd small { display:block; font-size:15px; color:#666; height:16px; }
  .pk-hd .nm { display:flex; align-items:baseline; justify-content:space-between; } .pk-hd .nm b { font-size:28px; font-weight:900; }
  .pk-hd .nm span { font-size:34px; color:#1d8bd0; font-weight:400; } .pk-hd .nm i { font-style:normal; font-size:14px; color:#666; margin-right:2px; } .pk-hd .nm em { font-style:normal; font-size:21px; color:#333; }
  .pk-grow { margin-top:6px; width:150px; height:40px; display:flex; align-items:center; gap:10px; padding-left:10px; background:linear-gradient(90deg,#2b2c2f,#3a3c40); color:#fff; font-size:18px; font-weight:900; box-shadow:0 3px 6px rgba(0,0,0,.3); border-bottom:3px solid #1d8bd0; }
  .pk-grow i { width:22px; height:22px; } .pk-grow i svg { width:100%; height:100%; }
  .pk-st { display:flex; gap:10px; padding:12px 14px 10px; }
  .pk-st .rg { width:92px; height:94px; background:#7a7d83; color:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; } .pk-st .rg .rgb { height:48px; } .pk-st .rg span { font-size:13px; margin-top:4px; }
  .pk-st .g { flex:1; display:grid; grid-template-columns:1fr 1fr; gap:3px 4px; align-content:center; }
  .pk-st .g > div { display:flex; align-items:center; gap:3px; height:20px; background:#fff; } .pk-st .g i { width:20px; height:20px; display:grid; place-items:center; background:#2b2c2f; color:#fff; flex:none; } .pk-st .g i svg { width:13px; height:13px; }
  .pk-st .g b { font-size:16px; font-weight:500; color:#333; } .pk-st .g b.w { font-family:"Noto Sans KR"; font-size:14px; font-weight:700; }
  .pk-tabs { display:flex; height:40px; } .pk-tabs > div { flex:1; display:grid; place-items:center; font-size:18px; font-weight:900; background:#2b2c2f; color:#fff; } .pk-tabs > div.on { background:#f4f5f7; color:#222; }
  .pk-body { flex:1; overflow-y:auto; scrollbar-width:none; padding:8px 0 70px; } .pk-body::-webkit-scrollbar { display:none; }
  .pk-skr { display:flex; gap:10px; padding:10px 12px; border-bottom:1px solid rgba(0,0,0,.08); }
  .pk-skr .ic { position:relative; width:58px; height:58px; flex:none; } .pk-skr .ic span { position:absolute; right:2px; bottom:1px; font-size:14px; color:#b8f05a; text-shadow:0 1px 2px #000; }
  .pk-skr .tg { display:flex; flex-wrap:wrap; gap:3px; } .pk-skr .tg span { font-size:12px; font-weight:700; padding:1px 5px; color:#fff; background:#5a8f2b; } .pk-skr .tg span.a { background:#d0702a; } .pk-skr .tg span.t { background:#55575d; }
  .pk-skr .nm { font-size:16px; font-weight:900; margin-top:3px; } .pk-skr .ds { font-size:14px; line-height:1.5; color:#333; margin-top:1px; }
  .pk-skr.on { background:#fff; box-shadow:inset 0 0 0 3px #29a3e8; } .pk-skr.lock { opacity:.45; }
  .pk-tr { padding:10px 14px; border-bottom:1px solid rgba(0,0,0,.08); } .pk-tr .h { font-size:16px; font-weight:900; display:flex; align-items:center; gap:4px; } .pk-tr .h span { padding:1px 6px; background:#2b2c2f; color:#fff; }
  .pk-tr p { margin:4px 0 0; font-size:14px; line-height:1.55; color:#333; } .pk-tr.lk { opacity:.5; }
  .pk-empty2 { margin-top:160px; text-align:center; color:#777; }
  .pk-sort2 { right:14px; } .pk-cb { position:relative; width:84px; height:100%; display:grid; place-items:center; font-size:16px; color:#c8ccd4; background:#3a3b3f; margin-left:6px; } .pk-cb span { position:absolute; right:10px; } .pk-cb.on { color:#4fc3ff; }
  .pk-clsrow { position:absolute; right:14px; top:64px; height:46px; display:flex; background:rgba(24,25,28,.94); box-shadow:0 3px 10px rgba(0,0,0,.3); z-index:3; }
  .pk-clsrow > div { width:48px; display:grid; place-items:center; opacity:.75; color:#fff; } .pk-clsrow > div.on { opacity:1; background:rgba(79,195,255,.18); } .pk-clsrow > div.on b { color:#4fc3ff; } .pk-clsrow b { font-size:15px; font-weight:700; }
  .pk-grid2 { position:absolute; left:312px; right:0; top:68px; bottom:70px; display:grid; grid-auto-flow:column; grid-template-rows:repeat(2, 276px); grid-auto-columns:124px; gap:12px 14px; overflow-x:auto; overflow-y:hidden; padding:4px 14px; scrollbar-width:none; }
  .pk-grid2::-webkit-scrollbar { display:none; }
  .pk-grid2 .oc.pk-on::after { content:""; position:absolute; left:-3px; right:-3px; top:5px; bottom:-3px; border:4px solid #29a3e8; background:rgba(41,163,232,.28); pointer-events:none; z-index:3; }
  .pk-grid2 .oc.pk-focus::after { background:rgba(41,163,232,.12); border-color:#7fd3ff; }
  .pk-num { position:absolute; right:6px; top:14px; z-index:4; font-size:58px; font-weight:600; line-height:1; color:#fff; -webkit-text-stroke:1.5px rgba(20,60,90,.5); text-shadow:0 2px 6px rgba(0,0,0,.4); }
  .pk-onehint { position:absolute; left:740px; bottom:20px; transform:translateX(-50%); z-index:6; background:rgba(20,22,26,.88); color:#e8eaee; font-size:15px; padding:6px 16px; border-left:3px solid #2aa7ec; }
  .pk-onehint b { color:#4fc3ff; font-size:18px; margin-right:2px; } .pk-other { opacity:.55; }
  .pk-clr { position:absolute; left:326px; bottom:12px; height:46px; padding:0 22px 0 6px; display:flex; align-items:center; gap:12px; background:#2b2c2f; color:#fff; font-size:19px; font-weight:700; box-shadow:0 3px 8px rgba(0,0,0,.3); }
  .pk-clr i { width:36px; height:36px; border-radius:50%; background:#3a3c40; display:grid; place-items:center; } .pk-clr i svg { width:20px; height:20px; }
  .pk-ok2 { position:absolute; right:22px; bottom:10px; width:260px; height:50px; display:flex; align-items:center; justify-content:center; gap:14px; background:#1d8bd0; color:#fff; font-size:22px; font-weight:900; box-shadow:0 3px 8px rgba(0,0,0,.3); }
  .pk-ok2 i { width:34px; height:34px; } .pk-ok2 i svg { width:100%; height:100%; }
  .icn { width:100%; height:100%; display:block; overflow:visible; filter:drop-shadow(0 1px 2px rgba(0,0,0,.45)); }
  .itm-m { position:absolute; inset:0; z-index:85; background:rgba(0,0,0,.6); display:grid; place-items:center; animation:scrIn .2s ease both; }
  .itm-b { position:relative; width:560px; display:flex; gap:22px; padding:26px 30px 24px; background:linear-gradient(180deg,#26282c,#1a1b1e); border-top:3px solid #f2f3f5; box-shadow:0 20px 50px rgba(0,0,0,.6); }
  .itm-b .ic { width:108px; height:108px; flex:none; display:grid; place-items:center; border-radius:50%; background:radial-gradient(circle at 50% 38%, #5a5e68, #1f2125 72%); box-shadow:inset 0 0 0 2px rgba(255,255,255,.15); padding:20px; }
  .itm-b .n { font-size:24px; font-weight:900; } .itm-b .hv { font-size:15px; color:#aab0ba; margin-top:2px; } .itm-b .hv b { font-size:19px; color:#fff; font-weight:500; margin-left:4px; }
  .itm-b p { margin:10px 0 12px; font-size:16px; line-height:1.65; color:#d6d9de; }
  .itm-b .src { font-size:15px; color:#c8ccd4; } .itm-b .src span { display:inline-block; margin-right:10px; padding:1px 8px; background:#e8eaee; color:#1a1b1e; font-weight:900; font-size:14px; }
  .itm-x { position:absolute; right:12px; top:8px; width:30px; height:30px; display:grid; place-items:center; font-size:19px; color:#aab0ba; }
  .rw-b { position:relative; width:520px; padding:20px 26px 22px; background:linear-gradient(180deg,#26282c,#1a1b1e); border-top:3px solid #f2f3f5; box-shadow:0 20px 50px rgba(0,0,0,.6); }
  .rw-h { display:flex; align-items:baseline; gap:12px; margin-bottom:6px; } .rw-h b { font-size:22px; } .rw-h span { font-size:15px; color:#8a909a; }
  .rw-sec { padding:12px 0; border-top:1px solid rgba(255,255,255,.08); } .rw-sec .lb { font-size:15px; font-weight:900; color:#c8ccd4; margin-bottom:8px; }
  .rw-sec .row { display:flex; gap:22px; } .rw-sec p { margin:8px 0 0; font-size:14px; color:#8a909a; }
  .rw-it { position:relative; width:84px; text-align:center; }
  .rw-it .ci { width:72px; height:72px; margin:0 auto; border-radius:50%; padding:14px; background:radial-gradient(circle at 50% 38%, #585c66, #1f2125 72%); box-shadow:0 0 0 2px #c9a64a; }
  .rw-it b { position:absolute; left:0; right:0; top:50px; font-size:16px; font-weight:500; text-shadow:0 1px 3px #000; }
  .rw-it em { position:absolute; left:50%; top:-6px; transform:translateX(-50%); white-space:nowrap; font-style:normal; font-size:12px; font-weight:700; padding:0 5px; background:#ff7a3c; color:#fff; }
  .rw-it span { display:block; margin-top:6px; font-size:14px; color:#c8ccd4; } .rw-it.got { opacity:.5; } .rw-it.got em { background:#55585f; }
  .rw-it:hover .ci { box-shadow:0 0 0 2px #fff; }
  /* stage panel v3 */
  .detail.in { animation:dIn .38s cubic-bezier(.2,.7,.2,1) both; } .detail.swap { animation:dSwap .3s ease both; } .detail.out { animation:dOut .26s ease forwards; pointer-events:none; }
  @keyframes dIn { from { transform:translateX(70px); opacity:0; } } @keyframes dSwap { from { opacity:0; transform:translateX(16px); } } @keyframes dOut { to { transform:translateX(70px); opacity:0; } }
  .ep { transition:opacity .25s; } .ep.hide { display:flex !important; opacity:0; pointer-events:none; }
  .medals { display:flex; gap:4px; margin-left:auto; } .medals svg { width:38px; height:42px; filter:drop-shadow(0 2px 3px rgba(0,0,0,.5)); }
  .detail .row2 { display:flex; gap:14px; margin:14px 0 6px; position:relative; z-index:20; } .detail .row2 .tx { flex:1; min-width:0; }
  .detail .row2 .tx p { line-height:1.6; height:6.4em; overflow-y:auto; margin-bottom:0; padding-right:8px; scrollbar-width:thin; scrollbar-color:rgba(255,255,255,.35) transparent; overscroll-behavior:contain; }   /* the brief keeps one size: a long one scrolls inside it instead of pushing the panel down */
  .detail .row2 .tx p.more { -webkit-mask-image:linear-gradient(#000 74%, transparent); mask-image:linear-gradient(#000 74%, transparent); }
  .storyb { position:relative; width:78px; flex:none; text-align:center; } .storyb .ic { width:62px; height:62px; margin:0 auto; } .storyb .ic .icn { filter:drop-shadow(0 2px 4px rgba(0,0,0,.6)); }
  .storyb .t { display:inline-block; margin-top:4px; padding:2px 8px; background:#111; color:#fff; font-size:15px; font-weight:700; border:1px solid rgba(255,255,255,.25); }
  .st-pop { position:absolute; left:0; top:100%; margin-top:6px; width:250px; z-index:5; background:#f2f3f5; box-shadow:0 8px 24px rgba(0,0,0,.6); text-align:left; }
  .st-pop > div { display:flex; align-items:center; gap:10px; padding:10px 12px; color:#1c1d20; border-bottom:1px solid rgba(0,0,0,.08); }
  .st-pop span { font-size:12px; letter-spacing:.14em; color:#8a8f99; width:46px; } .st-pop b { font-size:17px; } .st-pop i { margin-left:auto; font-style:normal; font-size:14px; color:#1d8bd0; font-weight:700; }
  .st-pop > div.lk { opacity:.55; } .st-pop > div.lk i { color:#8a8f99; } .st-pop > div:not(.lk):hover { background:#fff; }
  .ibox .lens { position:absolute; right:8px; bottom:6px; width:42px; height:42px; z-index:2; } .ibox .mg { display:none; }
  .rwrow { display:flex; align-items:center; gap:14px; margin:0 -36px 0 -40px; padding:10px 0 18px 30px; background:linear-gradient(90deg,rgba(0,0,0,0),rgba(0,0,0,.6) 22%); }
  .rwrow .l { width:52px; display:flex; flex-direction:column; align-items:center; gap:2px; font-size:15px; color:#d8dbe0; } .rwrow .l i { width:26px; height:26px; }
  .rwc { position:relative; width:62px; height:62px; border-radius:50%; padding:12px; background:radial-gradient(circle at 50% 38%, #585c66, #1f2125 72%); box-shadow:0 0 0 2px #c9a64a, 0 3px 6px rgba(0,0,0,.5); }
  .rwc > i { display:block; width:100%; height:100%; margin-top:-6px; }
  .rwc b { position:absolute; left:-8px; right:-8px; bottom:4px; text-align:center; font-size:15px; font-weight:500; text-shadow:0 1px 2px #000, 0 0 4px #000; }
  .rwc em { position:absolute; left:50%; bottom:-15px; transform:translateX(-50%); white-space:nowrap; font-style:normal; font-size:12px; font-weight:700; padding:0 5px; background:#ff7a3c; color:#fff; }
  .rwc.got { opacity:.55; } .rwc.got em { background:#55585f; } .rwc:hover { box-shadow:0 0 0 2px #fff, 0 3px 6px rgba(0,0,0,.5); }
  /* growth items: one rim colour per grade, the same on every circle they are drawn in */
  .rwc.t1, .idot.t1, .rw-it.t1 .ci { --tr:#a7adb6; } .rwc.t2, .idot.t2, .rw-it.t2 .ci { --tr:#7ccf3e; } .rwc.t3, .idot.t3, .rw-it.t3 .ci { --tr:#3fa7f0; }
  .rwc.t1, .rwc.t2, .rwc.t3 { box-shadow:0 0 0 2px var(--tr), 0 3px 6px rgba(0,0,0,.5); }
  .rw-it.t1 .ci, .rw-it.t2 .ci, .rw-it.t3 .ci { box-shadow:0 0 0 2px var(--tr); }
  .rz-it.t1 { border-color:#a7adb6; } .rz-it.t2 { border-color:#7ccf3e; } .rz-it.t3 { border-color:#3fa7f0; }
  /* item info: larger type, and where to get it */
  .itm-b { width:640px; max-height:640px; }
  .itm-b .tx { flex:1; min-width:0; display:flex; flex-direction:column; }
  .itm-b .n { font-size:28px; } .itm-b .hv { font-size:17px; } .itm-b p { font-size:18px; line-height:1.6; }
  .itm-b .srcs { display:flex; flex-direction:column; min-height:0; }
  .itm-b .srcs .lb { font-size:17px; font-weight:900; color:#9aa0aa; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,.18); }
  .itm-b .srcs .sl { max-height:250px; overflow-y:auto; overscroll-behavior:contain; touch-action:pan-y; padding-right:4px; }
  .itm-b .sr { display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid rgba(255,255,255,.08); }
  .itm-b .sr .kd { flex:none; padding:2px 8px; font-size:15px; font-weight:900; background:#3a3c42; color:#d8dbe0; }
  .itm-b .sr b { flex:1; min-width:0; font-size:18px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .itm-b .sr em { flex:none; font-style:normal; font-size:16px; font-weight:700; padding:2px 8px; background:#2b2d31; color:#c8ccd4; } .itm-b .sr em.hot { background:#1e6fa8; color:#fff; }
  .itm-b .sr .sgo { flex:none; height:36px; padding:0 14px; display:grid; place-items:center; font-size:17px; font-weight:900; background:#e8eaee; color:#16171a; }
  .itm-b .sr.lk { opacity:.55; } .itm-b .sr.lk .sgo { background:#3a3c42; color:#9aa0aa; }
  /* the skill box: collapsed in the column, raised over it in larger type */
  .odr-skb { padding:10px 12px 12px; }
  .sk-hd { font-size:17px; font-weight:900; margin-bottom:8px; color:#e8eaee; }
  .sk-rk { display:flex; align-items:center; gap:8px; margin-top:10px; padding-top:8px; border-top:1px solid rgba(255,255,255,.14); }
  .sk-rk span, .sk-up .rk span { font-size:17px; color:#9aa0aa; letter-spacing:.06em; } .sk-rk b { font-size:26px; font-weight:500; line-height:1; }
  .sk-rk .up { margin-left:auto; width:44px; height:34px; display:grid; place-items:center; background:rgba(255,255,255,.1); }
  .sk-rk .up i, .sk-up .rk .up i { font-style:normal; font-size:26px; font-weight:300; line-height:1; } .sk-rk .up em, .sk-up .rk .up em { font-style:normal; font-size:14px; color:#c8ccd4; }
  .sk-up { position:absolute; right:32px; top:66px; width:380px; z-index:4; padding:14px 16px 16px; background:rgba(30,31,35,.96); box-shadow:0 12px 30px rgba(0,0,0,.55); transition:transform .22s ease, opacity .22s ease; }
  .sk-up.in { transform:translateY(160px); opacity:0; } .sk-up.out { transform:translateY(120px); opacity:0; }
  .sk-up .hd { display:flex; align-items:center; gap:8px; font-size:19px; font-weight:900; padding-bottom:10px; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,.14); } .sk-up .hd i { font-style:normal; font-size:14px; }
  .sk-up .tl { display:flex; gap:16px; } .sk-up .cell { display:flex; flex-direction:column; align-items:center; gap:6px; width:90px; }
  .sk-t.big { width:80px; height:80px; } .sk-t.big .sk-sp { font-size:16px; }
  .sk-nm { font-size:17px; font-weight:800; text-align:center; line-height:1.2; }
  .sk-up .tg { margin:14px 0 8px; } .sk-up .tg span { font-size:16px; padding:2px 8px; }
  .sk-up .ds { font-size:18px; line-height:1.65; color:#eef0f3; }
  .nb { color:#4fb8ff; font-weight:700; }
  .sk-up .lf { margin-top:8px; font-size:16px; color:#ffd27a; }
  .sk-up .us { margin-top:14px; height:42px; display:grid; place-items:center; font-size:18px; font-weight:900; border:1.5px solid rgba(255,255,255,.35); color:#e8eaee; } .sk-up .us.on { background:#23a3e6; border-color:#23a3e6; color:#fff; } .sk-up .us.lk { color:#7d828b; }
  .sk-up .rk { display:flex; align-items:center; gap:10px; margin-top:14px; } .sk-up .rk b { font-size:34px; font-weight:500; line-height:1; }
  .sk-up .rk .up { margin-left:auto; height:46px; padding:0 18px; display:flex; align-items:center; gap:10px; background:#3a3c42; font-size:18px; font-weight:900; clip-path:polygon(0 0,calc(100% - 12px) 0,100% 50%,calc(100% - 12px) 100%,0 100%); padding-right:26px; }
  /* skill level up screen */
  .su-shade { position:absolute; inset:0; background:linear-gradient(90deg, rgba(10,11,13,.55), rgba(10,11,13,.82) 55%); }
  .su-cur { position:absolute; left:70px; top:200px; width:560px; }
  .su-cur .cap { display:inline-block; padding:8px 34px; font-size:22px; font-weight:900; background:rgba(120,122,128,.85); }
  .su-cur .bp { position:relative; height:250px; display:flex; align-items:center; justify-content:center; gap:30px; background:rgba(70,72,76,.9) repeating-linear-gradient(0deg, rgba(255,255,255,.07) 0 1px, transparent 1px 22px), repeating-linear-gradient(90deg, rgba(255,255,255,.07) 0 1px, transparent 1px 22px); background-blend-mode:normal; border:2px solid rgba(255,255,255,.6); }
  .su-cur .a { position:relative; font-size:150px; font-weight:300; color:rgba(160,220,255,.55); -webkit-text-stroke:2px rgba(160,220,255,.7); line-height:1; }
  .su-cur .a .dot { position:absolute; left:50%; top:74%; width:40px; height:40px; margin:-20px 0 0 -20px; opacity:.85; border-radius:50%; background:#2a9ad6; box-shadow:0 0 0 8px rgba(255,255,255,.75); }
  .su-cur .ar { font-size:70px; color:#fff; letter-spacing:-.1em; }
  .su-cur .b { position:relative; font-size:180px; font-weight:500; color:#fff; line-height:1; padding:0 18px; } .su-cur .b .br { position:absolute; inset:-6px -4px; border:3px solid rgba(255,255,255,.7); clip-path:polygon(0 0,22% 0,22% 3px,3px 3px,3px 22%,0 22%, 0 78%,3px 78%,3px calc(100% - 3px),22% calc(100% - 3px),22% 100%,0 100%, 100% 100%,78% 100%,78% calc(100% - 3px),calc(100% - 3px) calc(100% - 3px),calc(100% - 3px) 78%,100% 78%, 100% 22%,calc(100% - 3px) 22%,calc(100% - 3px) 3px,78% 3px,78% 0,100% 0); }
  .su-cur .mxw { font-size:90px; font-weight:700; color:#ffd27a; }
  .su-list { position:absolute; left:680px; top:40px; right:40px; bottom:150px; overflow-y:auto; display:flex; flex-direction:column; gap:12px; scrollbar-width:none; }
  .su-sk { position:relative; flex:none; display:grid; grid-template-columns:120px 1fr; grid-template-rows:auto auto; gap:6px 18px; padding:16px 20px; background:rgba(44,45,49,.94); overflow:hidden; }
  .su-sk .ic { position:relative; width:104px; height:104px; grid-row:1; } .su-sk .ic .sp { position:absolute; right:-4px; bottom:-2px; font-size:18px; color:#b8f05a; text-shadow:0 1px 3px #000; }
  .su-sk .nm { grid-row:2; grid-column:1; font-size:18px; font-weight:800; text-align:center; width:104px; }
  .su-sk .tx { grid-row:1 / 3; grid-column:2; position:relative; z-index:1; } .su-sk .sx-tags span { font-size:16px; padding:2px 8px; }
  .su-sk .ds { margin-top:8px; font-size:19px; line-height:1.55; color:#f0f2f5; }
  .su-sk .df { margin-top:8px; display:flex; flex-wrap:wrap; gap:6px 16px; font-size:17px; color:#c8ccd4; } .su-sk .df s { color:#8a909a; } .su-sk .df b { color:#4fb8ff; font-weight:600; }
  .su-sk .gh { position:absolute; right:14px; top:-14px; font-size:150px; font-weight:300; color:rgba(255,255,255,.07); line-height:1; pointer-events:none; }
  .su-sk.lk { opacity:.6; } .su-sk.on { box-shadow:inset 3px 0 0 #23a3e6; }
  .su-cost { position:absolute; left:110px; bottom:28px; display:flex; gap:30px; }
  .su-cost .cel { display:flex; flex-direction:column; align-items:center; gap:10px; }
  .su-cost .idot { width:96px; height:96px; padding:18px; } .su-cost .idot > b { display:none; }
  .su-cost .idot.coin > i.cn { width:46px; height:46px; margin:7px auto 0; font-size:24px; }
  .su-cost em { font-style:normal; min-width:84px; padding:2px 10px; text-align:center; font-size:21px; font-weight:500; background:#2a9ad6; color:#fff; } .su-cost em.short { background:#c0392b; }
  .su-cost .ring { width:96px; height:96px; border-radius:50%; display:flex; flex-direction:column; align-items:center; justify-content:center; background:radial-gradient(circle at 50% 40%, #4a4d55, #1c1d21 72%); box-shadow:0 0 0 4px #f2c21c; }
  .su-cost .ring b { font-size:40px; font-weight:500; line-height:1; } .su-cost .ring span { font-size:16px; font-weight:800; }
  .su-cost .cel.short .ring { box-shadow:0 0 0 4px #e04848; } .su-cost .cel.short em { background:#c0392b; }
  .su-foot { position:absolute; right:40px; bottom:40px; width:500px; display:flex; flex-direction:column; align-items:center; gap:12px; }
  .su-q { font-size:24px; font-weight:900; text-shadow:0 2px 6px rgba(0,0,0,.6); } .su-q b { color:#4fb8ff; font-weight:600; }
  .su-yn { display:flex; width:100%; height:64px; } .su-yn .btn { flex:1; display:grid; place-items:center; font-size:34px; font-weight:900; }
  .su-yn .no { background:rgba(30,31,35,.92); color:#fff; } .su-yn .yes { background:linear-gradient(90deg,#1e8fd6,#2aa7ec); color:#fff; } .su-yn .yes.dis { background:#3a3c42; color:#80858e; }
  .itm-b.t1 { border-top-color:#a7adb6; } .itm-b.t2 { border-top-color:#7ccf3e; } .itm-b.t3 { border-top-color:#3fa7f0; }
  .idot { position:relative; width:72px; height:72px; flex:none; border-radius:50%; padding:14px; background:radial-gradient(circle at 50% 38%, #585c66, #1f2125 72%); box-shadow:0 0 0 2px var(--tr,#c9a64a), 0 3px 8px rgba(0,0,0,.5); }
  .idot > i { display:block; width:100%; height:100%; margin-top:-6px; }
  .idot > i.cn { width:36px; height:36px; margin:-4px auto 0; border-radius:50%; background:#e6c35a; color:#5a3d00; font-weight:900; font-size:20px; font-style:normal; display:grid; place-items:center; }
  .idot > b { position:absolute; left:-10px; right:-10px; bottom:3px; text-align:center; font-size:16px; font-weight:500; color:#fff; text-shadow:0 1px 2px #000, 0 0 4px #000; white-space:nowrap; }
  .idot > b small { font-size:13px; color:#c8ccd4; }
  .idot.short { box-shadow:0 0 0 2px #e04848, 0 3px 8px rgba(0,0,0,.5); } .idot.short > b { color:#ff7a7a; }
  .idot > em { position:absolute; left:50%; bottom:-15px; transform:translateX(-50%); white-space:nowrap; font-style:normal; font-size:12px; font-weight:700; padding:0 5px; background:#ff7a3c; color:#fff; }
  .lu-items .idot, .pr-mats .idot { width:84px; height:84px; padding:16px; box-shadow:0 0 0 3px var(--tr,#c9a64a), 0 4px 10px rgba(0,0,0,.5); }
  .lu-items .idot.short, .pr-mats .idot.short { box-shadow:0 0 0 3px #e04848, 0 4px 10px rgba(0,0,0,.5); }
  .lu-items .idot > b, .pr-mats .idot > b { font-size:18px; bottom:5px; }
  .sk-cost { display:flex; flex-wrap:wrap; justify-content:center; gap:16px 18px; margin:16px 0 20px; }
  .sk-box, .drop-box { width:520px; } .sk-box p, .drop-box p { font-size:15px; line-height:1.6; color:#c8ccd4; }
  .sx-lv { margin-left:8px; padding:0 6px; font-size:14px; font-weight:500; background:#3a3c42; color:#fff; vertical-align:2px; }
  .sx-lvfx { margin-top:6px; font-size:14px; color:#ffd27a; }
  .sx-up { margin-top:6px; height:30px; display:grid; place-items:center; font-size:15px; font-weight:900; background:#2e3035; color:#e8eaee; border:1px solid rgba(255,255,255,.18); } .sx-up.lk { color:#7d828b; }
  .itm-rf { display:flex; align-items:center; flex-wrap:wrap; gap:10px 12px; margin-top:16px; padding-top:14px; border-top:1px solid rgba(255,255,255,.15); }
  .itm-rf .lb { width:100%; font-size:14px; font-weight:900; color:#aab0ba; letter-spacing:.06em; }
  .itm-rf .idot { width:58px; height:58px; padding:11px; } .itm-rf .idot > b { font-size:14px; } .itm-rf .ar { font-style:normal; font-size:21px; color:#c8ccd4; }
  .itm-rf .rf { height:32px; padding:0 14px; display:grid; place-items:center; font-size:15px; font-weight:900; background:#e8eaee; color:#16171a; } .itm-rf .rf:first-of-type { margin-left:auto; }
  .itm-rf .rf.dis { background:#3a3c42; color:#7d828b; }
  /* chips: the die with its class's mark */
  .chipc { position:relative; display:block; width:100%; height:100%; filter:drop-shadow(0 1px 2px rgba(0,0,0,.45)); }
  .chipc svg { display:block; width:100%; height:100%; }
  .chipc img { position:absolute; left:34.4%; top:34.4%; width:31.2%; height:31.2%; background:#26343e; }
  .chipc.t2 img { left:43.8%; top:28.1%; width:31.2%; height:28.1%; background:#3a2a08; object-fit:contain; }
  /* 자원 수집 */
  .sp-bg { position:absolute; inset:0; background:radial-gradient(ellipse at 50% 45%, #e9eaec 0, #cfd1d4 62%, #a9acb1 100%); }
  .sp-bg::after { content:""; position:absolute; inset:0; opacity:.5; background:repeating-radial-gradient(circle at 20% 30%, rgba(0,0,0,.025) 0 1px, transparent 1px 7px), repeating-radial-gradient(circle at 70% 60%, rgba(0,0,0,.02) 0 1px, transparent 1px 11px); }
  .sp-week { position:absolute; left:50%; top:22px; transform:translateX(-50%); display:flex; align-items:center; gap:8px; }
  .sp-week > div { position:relative; width:32px; height:32px; display:grid; place-items:center; border:3px solid #3a3c40; background:#f2f3f4; }
  .sp-week > div b { font-size:15px; font-weight:900; color:#3a3c40; }
  .sp-week > div.sat { border-color:#c99a10; } .sp-week > div.sat b { color:#a07a00; }
  .sp-week > div.on { background:#f6c21c; border-color:#f6c21c; box-shadow:0 0 0 2px #fff, 0 2px 6px rgba(0,0,0,.3); } .sp-week > div.on b { color:#1a1a1a; }
  .sp-week > div i { position:absolute; top:36px; left:50%; transform:translateX(-50%); font-style:normal; font-size:12px; font-weight:800; color:#3a3c40; letter-spacing:.05em; }
  .sp-week > span { margin-left:12px; font-size:17px; font-weight:800; color:#3a3c40; letter-spacing:.04em; }
  .sp-row2 { position:absolute; left:50%; top:100px; transform:translateX(-50%); display:flex; gap:12px; }
  .sp-c { position:relative; width:180px; height:500px; overflow:hidden; background:#38393d; box-shadow:0 8px 18px rgba(0,0,0,.35); }
  .sp-c .art { position:absolute; left:0; right:0; top:0; height:330px; overflow:hidden; background:var(--c0); }
  .sp-c .tiles { position:absolute; left:-130px; top:-110px; width:500px; transform:rotate(-30deg); display:flex; flex-wrap:wrap; gap:10px; }
  .sp-c .pl { width:110px; height:72px; position:relative; background:var(--c1); box-shadow:0 2px 4px rgba(0,0,0,.35); overflow:hidden; }
  .sp-c .pl:nth-child(4n+2) { background:var(--c2); } .sp-c .pl:nth-child(5n) { background:var(--c3); }
  .sp-c .pl i { position:absolute; left:6px; top:8px; width:52px; height:52px; display:block; }
  .sp-c .pl b { position:absolute; right:6px; top:6px; font-size:16px; font-weight:800; color:var(--tx); opacity:.85; }
  .sp-c .pl span { position:absolute; right:6px; bottom:6px; font-size:13px; font-weight:900; color:var(--tx); opacity:.7; }
  .sp-c.am { --c0:#f2a20c; --c1:#1d1d1f; --c2:#f7b52a; --c3:#2b2b2e; --tx:#ffd23c; }
  .sp-c.fh { --c0:#e8e6e2; --c1:#d93a46; --c2:#f4f3f0; --c3:#b82734; --tx:#2a2a2a; }
  .sp-c.cb { --c0:#1a6f8c; --c1:#20a7d6; --c2:#0f4f66; --c3:#7fdcff; --tx:#e8fbff; }
  .sp-c.cn { --c0:#c9962a; --c1:#2a2416; --c2:#e0b13c; --c3:#3a3120; --tx:#ffe08a; }
  .sp-c.bm { --c0:#6b6458; --c1:#2c2a26; --c2:#8a8170; --c3:#3e3a33; --tx:#f0d9a8; }
  .sp-c .ft .cl .mt { font-size:14px; font-weight:900; padding:4px 10px; border:1.5px solid rgba(255,255,255,.7); }
  .sp-c.ar { --c0:#463a86; --c1:#6c5cc8; --c2:#2c2458; --c3:#a99af0; --tx:#f1edff; }
  .sp-c .art::after { content:""; position:absolute; inset:0; background:linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,.35)); }
  .sp-c .bd { position:absolute; left:0; right:0; top:306px; height:34px; display:flex; align-items:center; justify-content:center; gap:8px; font-size:18px; font-weight:900; z-index:1; }
  .sp-c .bd.on { background:#2aa7ec; color:#fff; } .sp-c .bd.sat { background:linear-gradient(90deg,#fff07a,#f6c21c 50%,#fff07a); color:#3a2c00; }
  .sp-c .bd.sat i { width:22px; height:22px; border-radius:50%; background:#e0a400; color:#fff; font-style:normal; font-size:15px; display:grid; place-items:center; }
  .sp-c .bd.off, .sp-c .bd.lk { background:#55575c; color:#d8dbe0; }
  .sp-c .ft { position:absolute; left:0; right:0; top:340px; bottom:0; display:flex; flex-direction:column; align-items:center; padding-top:12px; color:#fff; }
  .sp-c .ft .cl { display:flex; gap:8px; margin-bottom:6px; } .sp-c .ft .cl img { width:28px; height:28px; padding:3px; border:1.5px solid rgba(255,255,255,.7); } .sp-c .ft .cl .it { width:38px; height:38px; display:grid; place-items:center; } .sp-c .ft .cl .it svg { width:36px; height:36px; }
  .sp-c .ft b { font-size:25px; font-weight:900; letter-spacing:.02em; } .sp-c .ft span.dy { margin-top:0; font-size:13px; color:#aeb3bb; } .sp-c .ft span { margin-top:4px; font-size:15px; font-weight:700; color:#e2e5ea; }
  .sp-c .dots { display:flex; gap:3px; margin-top:12px; } .sp-c .dots i { width:9px; height:9px; border:1.5px solid #9a9da3; } .sp-c .dots i.o { background:#e2e5ea; border-color:#e2e5ea; } .sp-c .dots i.t { background:#f6c21c; border-color:#f6c21c; }
  .sp-c.shut .art { filter:grayscale(.85) brightness(.6); } .sp-c.shut .ft { opacity:.6; }
  .sp-c:not(.shut):hover { box-shadow:0 0 0 3px #fff, 0 8px 18px rgba(0,0,0,.35); }
  .sm-bg { filter:blur(1.5px) brightness(.62) saturate(.75); transform:scale(1.03); }
  .sm-name { position:absolute; left:40px; top:84px; color:#fff; text-shadow:0 2px 8px rgba(0,0,0,.6); }
  .sm-name small { display:block; font-size:14px; letter-spacing:.2em; opacity:.85; } .sm-name b { display:block; font-size:38px; font-weight:900; line-height:1.15; } .sm-name span { font-size:16px; color:#d8dbe0; }
  .sm-map { position:absolute; inset:0; transition:transform .38s cubic-bezier(.2,.7,.2,1); }
  .sm-map svg { position:absolute; left:0; top:0; pointer-events:none; filter:drop-shadow(0 1px 3px rgba(0,0,0,.5)); }
  .sm-map.side { transform:translateX(-200px); } .sm-map.many.side { transform:none; }
  .sm-map .node { transform:scale(1.25); transform-origin:left center; } .sm-map .node.lk { filter:grayscale(1) brightness(.7); }
  /* 창고 */
  .dp-bg { position:absolute; inset:0; background:linear-gradient(160deg,#2b2d32,#17181b 70%); }
  .dp-wm { position:absolute; right:30px; bottom:10px; font-size:120px; font-weight:800; color:rgba(255,255,255,.04); letter-spacing:.05em; }
  .dp-tabs { position:absolute; left:28px; top:96px; display:flex; flex-direction:column; gap:8px; }
  .dp-tabs > div { width:120px; height:46px; display:grid; place-items:center; font-size:18px; font-weight:900; background:rgba(255,255,255,.07); color:#c8ccd4; border-left:4px solid transparent; }
  .dp-tabs > div.on { background:#f2f3f5; color:#16171a; border-left-color:#23a3e6; }
  .dp-grid { position:absolute; left:180px; right:30px; top:90px; bottom:24px; overflow-y:auto; display:flex; flex-wrap:wrap; align-content:flex-start; gap:18px 14px; padding:10px 6px; }
  .dp-it { width:112px; display:flex; flex-direction:column; align-items:center; }
  .dp-it .ci { position:relative; width:96px; height:96px; border-radius:50%; padding:18px; background:radial-gradient(circle at 50% 38%, #6a6f7a, #2a2c31 72%); box-shadow:0 0 0 3px var(--tr,#c9a64a), 0 4px 10px rgba(0,0,0,.5); }
  .dp-it.t1 { --tr:#a7adb6; } .dp-it.t2 { --tr:#7ccf3e; } .dp-it.t3 { --tr:#3fa7f0; }
  .dp-it .ci b { position:absolute; right:-6px; bottom:-2px; min-width:34px; padding:1px 7px; text-align:center; background:#0d0e10; color:#fff; font-size:17px; font-weight:500; border:1px solid rgba(255,255,255,.25); }
  .dp-it > span { margin-top:10px; font-size:15px; font-weight:700; color:#eceef2; text-align:center; line-height:1.3; }
  .dp-it:hover .ci { box-shadow:0 0 0 3px #fff, 0 4px 10px rgba(0,0,0,.5); }
  .dp-none { width:100%; padding-top:120px; text-align:center; color:#9aa0aa; font-size:17px; }
  .tm-bts { position:absolute; right:36px; bottom:28px; display:flex; filter:drop-shadow(0 4px 8px rgba(0,0,0,.5)); }
  .tm-bts .wm { position:absolute; left:-30px; top:4px; width:170px; height:70px; opacity:.16; transform:rotate(-8deg); } .tm-bts .wm svg { width:100%; height:100%; }
  .tm-pr { position:relative; overflow:hidden; width:150px; height:76px; display:flex; flex-direction:column; justify-content:center; align-items:flex-end; padding-right:16px;
    background:linear-gradient(115deg, transparent 62%, rgba(255,255,255,.5) 62% 66%, transparent 66%), linear-gradient(180deg,#f6f6f7,#cfd1d5); color:#2a2b2e; }
  .tm-pr.sw .a { font-size:22px; }
  .sw-box .sw-n { display:flex; align-items:center; gap:12px; margin:14px 0 10px; } .sw-box .sw-n b { font-size:34px; min-width:46px; text-align:center; } .sw-box .sw-n span { color:#9aa0aa; margin-left:-6px; }
  .sw-box .sw-b { width:44px; height:40px; display:grid; place-items:center; background:#2a2c31; border:1px solid rgba(255,255,255,.2); font-size:22px; font-weight:900; } .sw-box .sw-max { width:auto; padding:0 14px; font-size:16px; }
  .sw-box .sw-r { display:flex; gap:22px; color:#c8ccd4; font-size:17px; } .sw-box .sw-r b { color:#fff; font-size:19px; } .sw-box .sw-r small { color:#8a8f99; }
  .tm-pr .wm { color:#2a2b2e; } .tm-pr .a { position:relative; font-size:26px; font-weight:900; letter-spacing:.02em; } .tm-pr .b { position:relative; font-size:13px; font-weight:700; color:#6b6f77; } .tm-pr.dis { filter:grayscale(1); opacity:.55; }
  .tm-bts .go { position:relative; right:auto; bottom:auto; overflow:hidden; width:236px; height:76px; padding-right:18px; align-items:flex-end;
    background:linear-gradient(115deg, transparent 58%, rgba(255,255,255,.18) 58% 63%, transparent 63%), linear-gradient(180deg,#2fb0f0,#0f78bf 70%,#0b64a3); color:#fff; box-shadow:inset 0 1px 0 rgba(255,255,255,.35); }
  .tm-bts .go .wm { color:#fff; } .tm-bts .go .a { position:relative; font-size:30px; font-weight:900; letter-spacing:.04em; text-shadow:0 2px 4px rgba(0,0,0,.25); }
  .tm-bts .go .b { position:relative; display:flex; align-items:center; gap:4px; margin-top:2px; padding:0 8px 0 4px; background:rgba(0,0,0,.35); font-size:18px; } .tm-bts .go .b i { width:18px; height:18px; }
  .tm-bts .go.st { background:linear-gradient(115deg, transparent 58%, rgba(255,255,255,.18) 58% 63%, transparent 63%), linear-gradient(180deg,#d9b25a,#a87c22 70%,#8a6418); }   /* the story entry's one button, in the paper tag's gold */
  .tm-stam { position:absolute; z-index:6; right:26px; top:14px; height:42px; display:flex; align-items:center; gap:10px; }
  .tm-stam i { display:block; width:34px; height:34px; } .tm-stam b { font-size:30px; font-weight:500; color:#fff; text-shadow:0 1px 4px #000; }
  .sq-go.prc { background:linear-gradient(90deg,#55585f,#6b6f77); } .sq-stage b { margin-left:8px; padding:1px 8px; background:#e8eaee; color:#2a2b2e; font-size:15px; }
  /* operator archive */
  .of-bg { background:linear-gradient(90deg,#3a3c42 0,#6c6f76 40%,#d9dade 62%,#e6e7ea 100%) !important; }
  .of-ill { position:absolute; left:-40px; top:-8px; width:900px; pointer-events:none; -webkit-mask-image:linear-gradient(90deg, #000 62%, transparent 92%); mask-image:linear-gradient(90deg, #000 62%, transparent 92%); }
  .of-ill.chibi { width:auto; height:640px; top:auto; bottom:0; left:120px; }
  .of-wash { position:absolute; inset:0; pointer-events:none; background:linear-gradient(0deg, rgba(10,11,13,.55) 0, transparent 34%); }
  .of-id { position:absolute; left:18px; bottom:64px; color:#fff; }
  .of-id .cl { display:flex; align-items:flex-end; gap:6px; margin-bottom:10px; }
  .of-id .cl small { display:block; font-size:14px; letter-spacing:.06em; color:rgba(255,255,255,.75); -webkit-text-stroke:.3px rgba(0,0,0,.4); line-height:1; }
  .of-id .cl b { font-size:34px; font-weight:900; line-height:1.05; -webkit-text-stroke:1px #2a2b2e; paint-order:stroke fill; }
  .of-id .cl i { width:52px; height:52px; display:grid; place-items:center; background:#1e1f22; border:1px solid rgba(255,255,255,.4); }
  .of-id .en2 { font-family:"Oswald",sans-serif; font-size:26px; font-weight:500; line-height:1; -webkit-text-stroke:.6px #3a3c42; paint-order:stroke fill; } .of-id .en2.ko { font-family:"Noto Sans KR"; font-size:18px; font-weight:700; }
  .of-id .nm { font-size:64px; font-weight:900; line-height:1.05; -webkit-text-stroke:2px #3a3c42; paint-order:stroke fill; letter-spacing:-.02em; }
  .of-cred { position:absolute; left:12px; bottom:10px; display:flex; gap:8px; }
  .of-cred > div { height:40px; min-width:200px; display:flex; align-items:center; gap:10px; padding:0 14px 0 6px; background:rgba(30,31,34,.82); color:#fff; font-size:18px; font-weight:700; }
  .of-cred i { width:28px; height:28px; display:grid; place-items:center; color:#c8ccd4; } .of-cred i svg { width:22px; height:22px; } .of-cred span { flex:1; text-align:center; } .of-cred em { font-style:normal; font-size:22px; color:#8a8f99; }
  .of-r { position:absolute; right:0; top:0; bottom:0; width:540px; }
  .of-r.menu { padding:62px 26px 0 70px; display:flex; flex-direction:column; gap:22px; }
  .of-card { display:flex; height:110px; box-shadow:0 0 0 1.5px #2b2c2f, 0 4px 10px rgba(0,0,0,.15); background:repeating-linear-gradient(45deg, rgba(0,0,0,.03) 0 2px, transparent 2px 9px), #e9eaed; }
  .of-card:hover { background-color:#f4f5f7; }
  .of-card .tb, .of-hd .tb { width:44px; flex:none; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding:14px 0 8px; background:linear-gradient(90deg,#2b2c2f,#3d3e43); color:#fff; }
  .tb i { width:28px; height:28px; } .tb i svg { width:100%; height:100%; } .tb em { font-style:normal; font-size:21px; color:#9aa0aa; line-height:1; }
  .of-card .it { flex:1; display:grid; place-items:center; } .of-card .it svg { height:104px; filter:drop-shadow(0 4px 4px rgba(0,0,0,.35)); }
  .of-r.page { display:flex; flex-direction:column; }
  .of-hd { position:relative; height:110px; margin:58px 0 0 0; display:flex; background:linear-gradient(90deg,#2b2c2f,#3c3d42); box-shadow:0 4px 12px rgba(0,0,0,.35); }
  .of-hd .tb { background:none; } .of-hd .it { position:absolute; left:210px; top:-10px; } .of-hd .it svg { height:140px; filter:drop-shadow(0 4px 6px rgba(0,0,0,.6)); }
  .of-hd .ln { position:absolute; left:330px; top:52px; width:70px; height:1.5px; background:#c8ccd4; } .of-hd b { position:absolute; left:412px; top:36px; font-size:24px; color:#e8eaee; font-weight:700; }
  .of-tabs { position:absolute; right:0; top:200px; display:flex; flex-direction:column; gap:40px; z-index:2; }
  .of-tabs > div { width:44px; height:110px; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding:14px 0 8px; background:linear-gradient(90deg,#2b2c2f,#3d3e43); color:#fff; box-shadow:-2px 2px 8px rgba(0,0,0,.3); }
  .of-tabs i { width:28px; height:28px; } .of-tabs i svg { width:100%; height:100%; } .of-tabs em { font-style:normal; font-size:21px; color:#9aa0aa; }
  .of-body { flex:1; overflow-y:auto; scrollbar-width:none; padding:16px 64px 30px 4px; color:#1d1e21; } .of-body::-webkit-scrollbar { display:none; }
  .of-body .sh { margin:14px 0 6px; padding:3px 14px; background:linear-gradient(90deg,#4a4c52,#6c6f76); color:#fff; font-size:18px; font-weight:900; }
  .of-body .sb { padding:0 14px; font-size:17px; line-height:1.75; } .of-body .sb p { margin:4px 0; } .of-body .sb.lk { color:#8a8f99; }
  .of-body .nil { padding:40px 14px; color:#6b6f77; text-align:center; }
  .od-ib { position:absolute; left:290px; top:10px; width:50px; height:50px; display:grid; place-items:center; background:rgba(34,36,41,.94); box-shadow:0 3px 8px rgba(0,0,0,.35); z-index:6; }
  .od-ib i { width:30px; height:30px; border-radius:50%; border:2.5px solid #fff; display:grid; place-items:center; color:#fff; font:700 17px "Georgia",serif; font-style:normal; }
  .odm { position:absolute; inset:0; z-index:8; background:rgba(0,0,0,.66); display:grid; place-items:center; }
  .odm-box { position:relative; width:620px; max-height:560px; display:flex; flex-direction:column; background:#141518; border-top:3px solid #ffd400; box-shadow:0 20px 60px rgba(0,0,0,.6); }
  .odm-hd { padding:16px 22px 12px; display:flex; align-items:baseline; gap:10px; border-bottom:1px solid rgba(255,255,255,.08); } .odm-hd b { font-size:21px; } .odm-hd em { font-style:normal; font-size:13px; letter-spacing:.24em; color:#6f747d; }
  .odm-x { position:absolute; right:10px; top:10px; width:36px; height:36px; color:#aab0ba; } .odm-x svg { width:100%; height:100%; }
  .odm-sc { padding:14px 22px 20px; overflow:auto; }
  .odm-note { margin-top:8px; font-size:14px; color:#6f747d; }
  .skm { display:flex; gap:14px; padding:12px; margin-bottom:8px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07); }
  .skm .sk-ic { width:64px; height:64px; flex:none; } .skm.on { border-color:#ffd400; background:rgba(255,212,0,.06); } .skm.lock { opacity:.5; } .skm.at { box-shadow:inset 3px 0 0 #7fe3ff; }
  .skm-t { flex:1; } .skm-n { font-size:18px; font-weight:900; display:flex; align-items:center; gap:8px; } .skm-n .en { font-size:15px; color:#8a909a; font-weight:500; }
  .skm-n i { margin-left:auto; font-style:normal; font-size:13px; padding:2px 8px; background:#ffd400; color:#111; } .skm-n i.lk { background:#3a3c42; color:#aab0ba; }
  .skm-m { font-size:13px; color:#8a909a; margin:2px 0 6px; } .skm-d { font-size:15px; line-height:1.65; color:#d0d4db; }
  .tlm { padding:12px 14px; margin-bottom:8px; background:rgba(255,255,255,.04); border-left:3px solid #ffd400; } .tlm.lock { border-left-color:#3a3c42; opacity:.6; } .tlm.tr { border-left-color:#7fb8ff; }
  .tlm-k { font-size:13px; color:#8a909a; margin-bottom:2px; }
  .tlm-n { font-size:17px; font-weight:900; display:flex; align-items:center; gap:6px; } .tlm-n i { font-style:normal; font-size:13px; color:#8a909a; margin-left:auto; font-weight:500; }
  .tlm-d { margin-top:4px; font-size:15px; line-height:1.65; color:#d0d4db; }
  .ptm-top { display:flex; gap:16px; align-items:center; padding:4px 0 14px; } .ptm-top b { display:block; font-size:18px; } .ptm-top span { font-size:14px; color:#8a909a; }
  .ptm { display:flex; align-items:center; gap:14px; padding:8px 12px; margin-bottom:5px; background:rgba(255,255,255,.03); color:#7d828b; }
  .ptm .pot-hex { width:28px; height:31px; font-size:17px; background:#3a3c42; color:#9aa0aa; } .ptm.on { color:#e8eaee; } .ptm.on .pot-hex { background:#e8eaee; color:#111; }
  .ptm span { flex:1; font-size:16px; } .ptm i { font-style:normal; font-size:13px; color:#ffd400; }
  .arw { width:28px; height:28px; color:#8a909a; }
  /* level up */
  /* promotion */
  /* operations hub */
  /* main theme */
  .hideui .lb-ui { opacity:0; pointer-events:none; } .lb-ui { transition:opacity .3s; }
  `;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  const sheet = h("div", "sheet"); host.appendChild(sheet);
  function fit() {   // the menus keep their 16:9 page, as large as fits, centred (a wide phone shows dark bars at the sides)
    const w = host.clientWidth, hh = host.clientHeight, sc = hh > 50 ? Math.min(w / VW, hh / VH) : w / VW;
    sheet.style.transform = `translate(${Math.max(0, (w - VW * sc) / 2)}px, ${hh > 50 ? Math.max(0, (hh - VH * sc) / 2) : 0}px) scale(${sc})`;
  }
  window.addEventListener("resize", fit); if (window.ResizeObserver) new ResizeObserver(fit).observe(host.parentElement);

  // ---------- line icons, drawn here so they keep crisp at any size ----------
  const ICON = {
    back: `<svg viewBox="0 0 22 34"><path d="M18 3 L4 17 L18 31" fill="none" stroke="#fff" stroke-width="4"/></svg>`,
    home: `<svg viewBox="0 0 120 44"><g fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.2"><path d="M20 30 L40 8 L60 4 L80 8 L100 30 L80 40 L60 42 L40 40 Z M40 8 L60 22 L80 8 M20 30 L60 22 L100 30 M40 40 L60 22 L80 40 M60 4 L60 22"/></g><path d="M48 26 L60 15 L72 26 L72 38 L64 38 L64 30 L56 30 L56 38 L48 38 Z" fill="#fff"/></svg>`,
    gear: `<svg viewBox="0 0 40 40"><path fill="#fff" d="M17 2h6l1 5 4 2 4-3 4 4-3 4 2 4 5 1v6l-5 1-2 4 3 4-4 4-4-3-4 2-1 5h-6l-1-5-4-2-4 3-4-4 3-4-2-4-5-1v-6l5-1 2-4-3-4 4-4 4 3 4-2z"/><circle cx="20" cy="20" r="7" fill="#1a1c20"/></svg>`,
    warn: `<svg viewBox="0 0 40 40"><path d="M20 3 L38 36 H2 Z" fill="#fff"/><rect x="18" y="13" width="4" height="13" fill="#1a1c20"/><rect x="18" y="29" width="4" height="4" fill="#1a1c20"/></svg>`,
    mail: `<svg viewBox="0 0 40 40"><rect x="3" y="9" width="34" height="23" fill="#fff"/><path d="M3 9 L20 23 L37 9" fill="none" stroke="#1a1c20" stroke-width="2.5"/></svg>`,
    eye: `<svg viewBox="0 0 30 30"><path d="M3 15 Q15 3 27 15 Q15 27 3 15 Z" fill="none" stroke="#fff" stroke-width="2.4"/><circle cx="15" cy="15" r="4" fill="#fff"/><path d="M5 25 L25 5" stroke="#fff" stroke-width="2.4"/></svg>`,
    swap: `<svg viewBox="0 0 30 30"><path d="M6 12 A10 10 0 0 1 24 10 M24 18 A10 10 0 0 1 6 20" fill="none" stroke="#fff" stroke-width="2.6"/><path d="M24 4 L25 11 L18 11 Z M6 26 L5 19 L12 19 Z" fill="#fff"/></svg>`,
    rook: `<svg viewBox="0 0 30 30"><path d="M8 4h3v3h3V4h2v3h3V4h3v7l-3 2v9h3v4H8v-4h3v-9l-3-2z" fill="#fff"/></svg>`,
    friend: `<svg viewBox="0 0 30 30"><path d="M4 4 L13 15 L4 26 M13 4 L22 15 L13 26" fill="none" style="stroke:var(--acc,#2fd0d6)" stroke-width="3"/></svg>`,
    file: `<svg viewBox="0 0 30 30"><path d="M15 3 L27 15 L15 27 L3 15 Z" style="fill:var(--acc,#2fd0d6)"/><path d="M15 9 L21 15 L15 21 L9 15 Z" fill="#1c1e22"/></svg>`,
    drill: `<svg viewBox="0 0 30 30"><circle cx="15" cy="15" r="11" fill="none" style="stroke:var(--acc,#2fd0d6)" stroke-width="3"/><circle cx="15" cy="15" r="4" style="fill:var(--acc,#2fd0d6)"/><path d="M15 1v6M15 23v6M1 15h6M23 15h6" style="stroke:var(--acc,#2fd0d6)" stroke-width="3"/></svg>`,
    squadE: `<svg viewBox="0 0 110 96"><g fill="none" style="stroke:var(--acc,#2fd0d6)" stroke-width="7"><path d="M55 8 L102 88 H8 Z"/><path d="M55 34 L80 78 H30 Z"/></g></svg>`,
    opE: `<svg viewBox="0 0 110 96"><g fill="none" style="stroke:var(--acc,#2fd0d6)" stroke-width="7"><path d="M55 6 L100 88 M55 6 L10 88 M28 58 H82"/><path d="M40 88 L55 62 L70 88"/></g></svg>`,
    shopE: `<svg viewBox="0 0 110 96"><g fill="none" stroke="rgba(255,255,255,.35)" stroke-width="6"><path d="M30 6 H80 L104 48 L80 90 H30 L6 48 Z"/><path d="M40 28 H70 L82 48 L70 68 H40 L28 48 Z"/></g></svg>`,
    link1: `<svg viewBox="0 0 34 34"><rect x="5" y="5" width="24" height="24" fill="none" stroke="#fff" stroke-width="3"/><rect x="11" y="11" width="12" height="12" fill="#fff"/></svg>`,
    link2: `<svg viewBox="0 0 34 34"><path d="M17 2 L32 17 L17 32 L2 17 Z" fill="none" stroke="#fff" stroke-width="3"/><path d="M17 9 L25 17 L17 25 L9 17 Z" fill="#fff"/></svg>`,
    task: `<svg viewBox="0 0 110 96"><g fill="none" style="stroke:var(--acc,#2fd0d6)" stroke-width="7"><path d="M14 10 H96 V86 H14 Z"/><path d="M55 26 V62 M38 48 L55 66 L72 48"/></g></svg>`,
    base: `<svg viewBox="0 0 110 96"><g fill="none" style="stroke:var(--acc,#2fd0d6)" stroke-width="7"><path d="M10 86 V30 H40 V12 H70 V30 H100 V86 Z"/><path d="M40 86 V56 H70 V86"/></g></svg>`,
    depot: `<svg viewBox="0 0 110 96"><g fill="none" stroke="rgba(255,255,255,.35)" stroke-width="6"><path d="M10 34 L55 10 L100 34 V86 H10 Z"/><path d="M28 86 V50 H82 V86 M28 64 H82"/></g></svg>`,
    lens: `<svg viewBox="0 0 30 30"><circle cx="12" cy="12" r="8" fill="none" stroke="#fff" stroke-width="3"/><path d="M18 18 L27 27" stroke="#fff" stroke-width="4"/></svg>`,
  };
  // ---------- personal settings: the main track and the lobby's skin, from what has been heard and earned ----------
  const SKINS = [
    { id: "base", n: "테오히 기본", d: "기본 스킨", acc: "#2fd0d6", t: ["#1f8f95", "#146f74"], bg: "#2a2d34", img: "lb_base", fx: "data", ok: () => true },
    { id: "shelter", n: "피난처", d: "파견실 2곳 가동", acc: "#f2c14e", t: ["#9a7420", "#6b5010"], bg: "#33291a", img: "lb_shelter", fx: "dust", ok: () => !!(S.base && S.base.rooms && S.base.rooms.filter((R) => R.built && R.zone).length >= 2) },
    { id: "archive", n: "아카이브", d: "가사인격 10명과 링크", acc: "#b48aff", t: ["#5f43a3", "#3f2b78"], bg: "#2a2438", img: "lb_archive", fx: "glyph", ok: () => Object.keys(S.ops).length >= 10 },
    { id: "line", n: "봉쇄선", d: "BL-07 클리어", acc: "#ff7a45", t: ["#a8402a", "#742617"], bg: "#3a2320", img: "lb_line", fx: "ember", ok: () => ((S.stages["BL-07"] || {}).stars || 0) > 0 },
  ];
  const skinOf = () => SKINS.find((k) => k.id === S.skin && k.ok()) || SKINS[0];
  // the operator standing in the lobby, cut out of their painting (masks made once, offline) so the skin's scene shows behind
  const CUT = {"w":320,"h":428,"cols":8,"idx":{"a2_e0":0,"a2_e2":1,"a_e0":2,"a_e2":3,"al_e0":4,"al_e2":5,"an_e0":6,"an_e2":7,"ay_e0":8,"b_e0":9,"b_e2":10,"bk_e0":11,"bo_e0":12,"bo_e2":13,"cb_e0":14,"eg_e0":15,"eg_e2":16,"fc_e0":17,"fc_e2":18,"g_e0":19,"gs_e0":20,"gs_e2":21,"h_e0":22,"h_e2":23,"hr_e0":24,"ir_e0":25,"ir_e2":26,"jy_e0":27,"k2_e0":28,"k2_e2":29,"ke_e0":30,"ke_e2":31,"l_e0":32,"l_e2":33,"ll_e0":34,"m_e0":35,"m_e2":36,"nn_e0":37,"pn_e0":38,"pn_e2":39,"r6_e0":40,"r6_e2":41,"rb_e0":42,"rb_e2":43,"sk_e0":44,"sk_e2":45,"sl_e0":46,"sl_e2":47,"sn_e0":48,"sn_e2":49,"sq_e0":50,"sq_e2":51,"tk_e0":52,"tk_e2":53,"to_e0":54,"vl_e0":55,"vl_e2":56},"head":{"a2_e0":[0.696,0.299],"a2_e2":[0.385,0.082],"a_e0":[0.506,0.281],"a_e2":[0.514,0.222],"al_e0":[0.51,0.195],"al_e2":[0.473,0.16],"an_e0":[0.514,0.156],"an_e2":[0.488,0.165],"ay_e0":[0.547,0.216],"b_e0":[0.527,0.195],"b_e2":[0.827,0.565],"bk_e0":[0.55,0.273],"bo_e0":[0.597,0.114],"bo_e2":[0.531,0.154],"cb_e0":[0.474,0.257],"eg_e0":[0.683,0.267],"eg_e2":[0.541,0.134],"fc_e0":[0.443,0.08],"fc_e2":[0.339,0.084],"g_e0":[0.512,0.206],"gs_e0":[0.567,0.137],"gs_e2":[0.515,0.167],"h_e0":[0.498,0.214],"h_e2":[0.496,0.2],"hr_e0":[0.549,0.128],"ir_e0":[0.623,0.195],"ir_e2":[0.564,0.08],"jy_e0":[0.525,0.342],"k2_e0":[0.511,0.152],"k2_e2":[0.505,0.141],"ke_e0":[0.218,0.659],"ke_e2":[0.508,0.081],"l_e0":[0.484,0.206],"l_e2":[0.505,0.18],"ll_e0":[0.534,0.272],"m_e0":[0.503,0.24],"m_e2":[0.506,0.198],"nn_e0":[0.347,0.217],"pn_e0":[0.423,0.253],"pn_e2":[0.455,0.181],"r6_e0":[0.484,0.156],"r6_e2":[0.506,0.158],"rb_e0":[0.409,0.213],"rb_e2":[0.426,0.184],"sk_e0":[0.503,0.203],"sk_e2":[0.516,0.187],"sl_e0":[0.546,0.276],"sl_e2":[0.57,0.242],"sn_e0":[0.509,0.172],"sn_e2":[0.419,0.131],"sq_e0":[0.878,0.904],"sq_e2":[0.58,0.198],"tk_e0":[0.506,0.203],"tk_e2":[0.501,0.176],"to_e0":[0.501,0.382],"vl_e0":[0.722,0.175],"vl_e2":[0.54,0.08]},"box":{"a2_e0":[0.012,0.146,0.989,0.999],"a2_e2":[0.0,0.008,0.998,0.996],"a_e0":[0.161,0.089,0.928,0.924],"a_e2":[0.0,0.055,0.855,0.999],"al_e0":[0.319,0.058,0.962,0.977],"al_e2":[0.0,0.037,0.981,0.999],"an_e0":[0.025,0.05,0.917,0.999],"an_e2":[0.0,0.0,0.998,0.999],"ay_e0":[0.116,0.078,0.803,0.975],"b_e0":[0.047,0.046,0.859,0.981],"b_e2":[0.031,0.015,0.984,0.992],"bk_e0":[0.058,0.21,0.748,0.999],"bo_e0":[0.022,0.037,0.972,0.999],"bo_e2":[0.0,0.053,0.998,0.999],"cb_e0":[0.178,0.198,0.82,0.939],"eg_e0":[0.375,0.203,0.802,0.975],"eg_e2":[0.0,0.06,0.998,0.999],"fc_e0":[0.0,0.0,0.984,0.999],"fc_e2":[0.0,0.008,0.998,0.999],"g_e0":[0.0,0.029,0.881,0.981],"gs_e0":[0.0,0.062,0.973,0.999],"gs_e2":[0.272,0.054,0.806,0.999],"h_e0":[0.253,0.011,0.95,0.979],"h_e2":[0.0,0.009,0.998,0.999],"hr_e0":[0.0,0.069,0.966,0.953],"ir_e0":[0.0,0.027,0.942,0.999],"ir_e2":[0.0,0.0,0.998,0.999],"jy_e0":[0.25,0.04,0.756,0.893],"k2_e0":[0.028,0.049,0.953,0.999],"k2_e2":[0.0,0.037,0.998,0.999],"ke_e0":[0.288,0.107,0.817,0.497],"ke_e2":[0.0,0.002,0.998,0.999],"l_e0":[0.278,0.029,0.931,0.953],"l_e2":[0.0,0.009,0.998,0.999],"ll_e0":[0.112,0.118,0.866,0.933],"m_e0":[0.127,0.135,0.941,0.954],"m_e2":[0.0,0.0,0.998,0.999],"nn_e0":[0.047,0.165,0.97,0.814],"pn_e0":[0.038,0.124,0.738,0.999],"pn_e2":[0.0,0.053,0.969,0.999],"r6_e0":[0.0,0.0,0.995,0.999],"r6_e2":[0.0,0.047,0.998,0.999],"rb_e0":[0.006,0.098,0.98,0.999],"rb_e2":[0.0,0.044,0.998,0.999],"sk_e0":[0.141,0.084,0.9,0.964],"sk_e2":[0.0,0.069,0.998,0.999],"sl_e0":[0.008,0.048,0.983,0.999],"sl_e2":[0.0,0.0,0.998,0.999],"sn_e0":[0.047,0.106,0.844,0.965],"sn_e2":[0.0,0.062,0.998,0.999],"sq_e0":[0.075,0.029,0.998,0.999],"sq_e2":[0.0,0.008,0.998,0.999],"tk_e0":[0.0,0.107,0.873,0.999],"tk_e2":[0.0,0.013,0.998,0.999],"to_e0":[0.191,0.131,0.914,0.95],"vl_e0":[0.03,0.12,0.998,0.806],"vl_e2":[0.0,0.0,0.998,0.999]},"face":{"a2_e0":0.233,"a_e0":0.209,"a_e2":0.203,"al_e0":0.173,"al_e2":0.164,"an_e0":0.147,"an_e2":0.159,"ay_e0":0.172,"b_e0":0.142,"b_e2":0.081,"bo_e2":0.162,"eg_e0":0.119,"g_e0":0.108,"gs_e2":0.12,"h_e0":0.145,"h_e2":0.17,"ir_e0":0.202,"jy_e0":0.159,"k2_e0":0.166,"k2_e2":0.147,"ke_e0":0.086,"l_e0":0.214,"l_e2":0.202,"ll_e0":0.167,"m_e0":0.156,"m_e2":0.166,"pn_e0":0.172,"pn_e2":0.172,"r6_e0":0.147,"r6_e2":0.134,"rb_e0":0.148,"rb_e2":0.161,"sk_e0":0.191,"sk_e2":0.177,"sl_e0":0.236,"sl_e2":0.231,"sq_e0":0.078,"sq_e2":0.169,"tk_e0":0.147,"tk_e2":0.152,"to_e0":0.273}};
  const artKey = (url) => { const m = /a\/([\w]+)\.webp/.exec(url || ""); return m ? m[1] : null; };
  const CUT_CACHE = {};
  function cutArt(url) {
    const k = artKey(url); if (!k || CUT.idx[k] === undefined || !ART.z_cut_atlas) return Promise.resolve(null);
    if (CUT_CACHE[k]) return CUT_CACHE[k];
    const ld = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
    return (CUT_CACHE[k] = Promise.all([ld(url), ld(ART.z_cut_atlas)]).then(([im, at]) => {
      const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext("2d");
      // the mask is stored as grey (smaller): scaled up and turned into transparency here
      const mc = document.createElement("canvas"); mc.width = c.width; mc.height = c.height; const mg = mc.getContext("2d"); mg.imageSmoothingQuality = "high"; if ("filter" in mg) mg.filter = "blur(1.2px)";
      const i = CUT.idx[k]; mg.drawImage(at, (i % CUT.cols) * CUT.w, Math.floor(i / CUT.cols) * CUT.h, CUT.w, CUT.h, 0, 0, c.width, c.height);
      const md = mg.getImageData(0, 0, c.width, c.height), px = md.data; for (let j = 0; j < px.length; j += 4) { px[j + 3] = px[j]; } mg.putImageData(md, 0, 0);
      g.drawImage(im, 0, 0); g.globalCompositeOperation = "destination-in"; g.drawImage(mc, 0, 0);
      // where the figure runs into the painting's own edge, it fades instead of stopping at a straight line
      g.globalCompositeOperation = "destination-out"; const W = c.width, H = c.height, e = Math.round(W * 0.07);
      for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [[0, 0, e, 0, 0, 0, e, H], [W, 0, W - e, 0, W - e, 0, e, H], [0, 0, 0, e, 0, 0, W, e]]) { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(rx, ry, rw, rh); }
      return c.toDataURL("image/webp", 0.92);
    }).catch(() => null));
  }
  // every operator stands the same size in the lobby: the face is brought to one size and one place, whatever the painting's framing;
  // a painting cut off at the bottom is kept tall enough to reach the bottom of the screen
  function lobbyFit(url) {
    const k = artKey(url), bx = CUT.box[k] || [0, 0, 1, 1], AR = 640 / 857, FX = 330, FY = 206;
    let [hx, hy] = headOf(url), fw = CUT.face[k];
    if (fw && (hy < bx[1] - 0.02 || hy > bx[1] + (bx[3] - bx[1]) * 0.4)) fw = 0;   // a "face" found outside the figure's head is a mistake
    let h;
    if (fw) h = 108 / fw / AR;   // the face 108px wide
    else { hx = (bx[0] + bx[2]) / 2; hy = bx[1] + (bx[3] - bx[1]) * 0.09; h = 640 / Math.max(0.3, bx[3] - bx[1]); }   // no face to go by: the figure's height
    if (bx[3] > 0.96) h = Math.max(h, (735 - FY) / Math.max(0.2, 1 - hy));   // cut off at the bottom: no edge showing
    h = Math.max(700, Math.min(1300, h)); const w = h * AR;
    return { height: h + "px", left: (FX - hx * w) + "px", top: (FY - hy * h) + "px" };
  }
  // where a painting's face is, as fractions of it (detected offline); for crops that must keep the face in view
  const headOf = (url) => CUT.head[artKey(url)] || [0.5, 0.2];
  function applySkin() { const k = skinOf(); SKINS.forEach((q) => sheet.classList.toggle("sk-" + q.id, q === k)); sheet.style.setProperty("--acc", k.acc); sheet.style.setProperty("--t0", k.t[0]); sheet.style.setProperty("--t1", k.t[1]); sheet.style.setProperty("--lbg", k.bg); }
  const mainTrack = () => { const heard = BGM.LIST.filter((q) => (S.bgmSeen || {})[q.id] || q.free); return heard.find((q) => q.id === S.bgmMain) || heard[0] || null; };
  let booted = false;   // nothing plays under the loading screen
  // the main theme has one place: the terminal's menu screens. Anything else in front of them (loading, the name prompt, scenes,
  // operations, training) is outside that place, and a watcher silences it there without each of those having to say so
  const onMenu = () => booted && !host.hidden && !!SCREENS[route.name] && S.started && !!(S.tutorialDone || S.startDone)
    && !sheet.querySelector(".story, .nm-ask, .reveal .chat");
  function playMain() {
    if (!window.BGM) return;
    if (!onMenu()) return BGM.stop();
    const t = mainTrack(); if (!t) return; (S.bgmSeen = S.bgmSeen || {})[t.id] = 1; BGM.play(t.id);
  }
  setInterval(() => { if (window.BGM && BGM.cur && !onMenu()) BGM.stop(); }, 250);
  // each skin's air: data motes, dust in the lamplight, glyphs, embers
  function lobbyFx(host, kind) {
    const cv = h("canvas", "lb-fx"); host.appendChild(cv); const q = Math.min(1.5, window.devicePixelRatio || 1); cv.width = 1280 * q; cv.height = 720 * q;
    const g = cv.getContext("2d"), P = [], rr = (a, b) => a + Math.random() * (b - a), N = { data: 40, dust: 46, glyph: 22, ember: 60 }[kind] || 30;
    const mk = (init) => { const p = { x: rr(0, 1280), y: init ? rr(0, 720) : kind === "ember" || kind === "data" ? 740 : rr(0, 720), a: 0, life: rr(4, 10), t: 0, s: rr(0.8, 2.4), vx: rr(-6, 6), vy: kind === "ember" ? rr(-60, -25) : kind === "data" ? rr(-22, -8) : rr(-5, 5), r: rr(0, 6.28), w: rr(0, 6) }; if (init) p.t = rr(0, p.life); return p; };
    for (let i = 0; i < N; i++) P.push(mk(true));
    let last = performance.now(), acc = 0;
    const fr = (now) => {
      if (!cv.isConnected) return; requestAnimationFrame(fr); const dt = Math.min(0.1, (now - last) / 1000); last = now; acc += dt; if (acc < 1 / 30) return; const st = acc; acc = 0;
      g.setTransform(q, 0, 0, q, 0, 0); g.clearRect(0, 0, 1280, 720); g.globalCompositeOperation = "lighter";
      for (let i = 0; i < P.length; i++) {
        const p = P[i]; p.t += st; if (p.t > p.life) { P[i] = mk(false); continue; }
        p.x += (p.vx + Math.sin(p.t * 1.3 + p.w) * (kind === "ember" ? 14 : 4)) * st; p.y += p.vy * st; const al = Math.sin(p.t / p.life * Math.PI);
        if (kind === "ember") { g.fillStyle = `rgba(255,${120 + (p.w * 15 | 0)},60,${al * 0.9})`; g.beginPath(); g.arc(p.x, p.y, p.s, 0, 6.29); g.fill(); }
        else if (kind === "dust") { g.fillStyle = `rgba(255,220,170,${al * 0.45})`; g.beginPath(); g.arc(p.x, p.y, p.s * 0.8, 0, 6.29); g.fill(); }
        else if (kind === "glyph") { g.strokeStyle = `rgba(190,150,255,${al * 0.5})`; g.lineWidth = 1.2; const R = 5 + p.s * 3; g.save(); g.translate(p.x, p.y); g.rotate(p.r + p.t * 0.2); g.beginPath(); for (let k = 0; k < 6; k++) { const a2 = k * Math.PI / 3; g.lineTo(Math.cos(a2) * R, Math.sin(a2) * R); } g.closePath(); g.stroke(); g.restore(); }
        else { g.fillStyle = `rgba(80,230,235,${al * 0.55})`; g.fillRect(p.x, p.y, 2, 2 + p.s * 3); }
      }
    };
    requestAnimationFrame(fr);
  }
  window.__bslSkin = (id) => { S.skin = id; save(); go("lobby"); render(); };   // test hook
  window.__bslAsst = (id) => { if (!S.ops[id]) S.ops[id] = { lvl: 1, elite: 0, pot: 1, skill: 0, got: Date.now() }; S.assistant = id; save(); go("lobby"); render(); };
  function wardrobe(cur) {   // one operator at a time, opened from their file
    const m = h("div", "modal wd-m"), b = h("div", "box"); m.appendChild(b); sheet.appendChild(m);
    const close = () => { m.remove(); render(); };
    const draw = () => {
      const o = S.ops[cur], e2ok = o.elite >= 2, le = lookElite(cur), auto = o.look === undefined;
      const slot = (e, lab) => { const lock = e === 2 && !e2ok, on = !auto && o.look === e || auto && le === e; return `<div class="btn wd-s${on ? " on" : ""}${lock ? " lk" : ""}" data-e="${e}"><div class="im" style="background-image:url(${B.portrait(cur, "full", e)})"></div><b>${lab}</b><span>${lock ? "정예화 2 달성 시 해금" : on ? (auto ? "착용 중 · 자동" : "착용 중") : "착용하기"}</span></div>`; };
      b.innerHTML = `<div class="wd-hd"><h3>옷장</h3><b>${esc(nm(cur).main)}</b><span>${cur === "geomseon" ? "작전에서도 고른 모습(노인 / 젊은 모습)으로 나옵니다" : "로비, 상세 화면, 작전 카드에 고른 일러스트가 쓰입니다"}</span></div>
          <div class="wd-slots">${slot(0, cur === "geomseon" ? "노인의 모습 · 정예화 0" : "정예화 0")}${hasE2(cur) ? slot(2, cur === "geomseon" ? "반로환동 · 정예화 2" : "정예화 2") : ""}<div class="wd-s lk soon"><div class="im"></div><b>스킨</b><span>준비 중</span></div></div>
          <div class="row"><div class="btn wd-auto${auto ? " on" : ""}">정예화에 맞춰 자동</div><div class="btn wd-x">닫기</div></div>`;
      b.querySelectorAll(".wd-s:not(.soon)").forEach((x) => x.onclick = () => { const e = +x.dataset.e; if (e === 2 && !e2ok) return toast("정예화 2 달성 시 해금됩니다"); o.look = e; save(); draw(); });
      b.querySelector(".wd-auto").onclick = () => { delete o.look; save(); draw(); };
      b.querySelector(".wd-x").onclick = close;
    };
    m.onclick = (e) => { if (e.target === m) close(); };
    draw();
  }
  function personalBox() {
    const m = h("div", "modal ps-m"), b = h("div", "box"); m.appendChild(b); sheet.appendChild(m);
    const draw = () => {
      const tracks = BGM.LIST, mt = mainTrack();
      b.innerHTML = `<h3>개인 설정</h3>
        <div class="ps-sec"><div class="lb">메인 배경음악 <span>스토리 장면이 아니면 이 곡이 나옵니다</span></div>
          <div class="ps-list">${tracks.length ? tracks.map((q) => { const got = (S.bgmSeen || {})[q.id] || q.free; return `<div class="btn ps-it${got ? "" : " lk"}${mt && mt.id === q.id ? " on" : ""}" data-b="${q.id}"><i>${mt && mt.id === q.id ? "♪" : got ? "▶" : "🔒"}</i><b>${got ? esc(q.n) : "???"}</b><span>${got ? esc(q.d || "") : "아직 듣지 못한 곡"}</span></div>`; }).join("") : '<div class="ps-none">수록된 곡을 준비 중입니다</div>'}</div></div>
        <div class="ps-sec"><div class="lb">UI 스킨 <span>진행도에 따라 열립니다</span></div>
          <div class="ps-skins">${SKINS.map((k) => `<div class="btn ps-sk${k.ok() ? "" : " lk"}${skinOf().id === k.id ? " on" : ""}" data-s="${k.id}" style="--sa:${k.acc};--s0:${k.t[0]};--s1:${k.t[1]}"><div class="sw"><i></i><i></i></div><b>${esc(k.n)}</b><span>${k.ok() ? (skinOf().id === k.id ? "사용 중" : "사용 가능") : "🔒 " + esc(k.d)}</span></div>`).join("")}</div></div>
        <div class="row"><div class="btn">닫기</div></div>`;
      b.querySelectorAll(".ps-it").forEach((it) => it.onclick = () => { const q = BGM.LIST.find((x) => x.id === it.dataset.b); if (!((S.bgmSeen || {})[q.id] || q.free)) return toast("아직 듣지 못한 곡입니다"); S.bgmMain = q.id; save(); playMain(); draw(); });
      b.querySelectorAll(".ps-sk").forEach((it) => it.onclick = () => { const k = SKINS.find((x) => x.id === it.dataset.s); if (!k.ok()) return toast(`${k.d} 시 열립니다`); S.skin = k.id; save(); applySkin(); draw(); });
      b.querySelector(".row .btn").onclick = () => { m.remove(); render(); };
    };
    m.onclick = (e) => { if (e.target === m) { m.remove(); render(); } };
    draw();
  }
  function settingsBox() {
    const m = h("div", "modal"), b = h("div", "box", `<h3>설정</h3><div class="vol"${window.SFX && SFX.off ? ' style="display:none"' : ""}><span>효과음</span><input type="range" min="0" max="100" value="${Math.round((window.SFX ? SFX.vol : 0.7) * 100)}"><b class="en">${Math.round((window.SFX ? SFX.vol : 0.7) * 100)}</b></div><p>저장 데이터는 이 브라우저에 보관됩니다.</p>`), row = h("div", "row");
    b.querySelector(".vol").insertAdjacentHTML("beforebegin", `<div class="vol bgm"><span>배경음악</span><input type="range" min="0" max="100" value="${Math.round(BGM.vol * 100)}"><b class="en">${Math.round(BGM.vol * 100)}</b></div>`);
    const br = b.querySelector(".vol.bgm input"); br.oninput = () => { b.querySelector(".vol.bgm b").textContent = br.value; BGM.setVol(br.value / 100); };
    // graphics: quality (auto steps down on a slow device; a fixed level stays put) and the frame rate
    if (window.TDB && TDB.gfx) {
      const gx = TDB.gfx(), Ql = [["auto", "자동"], ["2", "높음"], ["1", "보통"], ["0", "낮음"]], Fl = [[60, "60"], [30, "30"]];
      const gb = h("div", "gfx", `<div class="gr"><span>화질</span><div class="sg">${Ql.map(([k, l]) => `<div class="btn${gx.mode === k ? " on" : ""}" data-q="${k}">${l}</div>`).join("")}</div></div>
        <div class="gr"><span>프레임</span><div class="sg">${Fl.map(([k, l]) => `<div class="btn${gx.fps === k ? " on" : ""}" data-f="${k}"><b class="en">${l}</b></div>`).join("")}</div></div>
        <div class="gn">${gx.mode === "auto" ? `자동: 지금 ${["낮음", "보통", "높음"][gx.q]}${gx.q < gx.def ? " (기기가 느려 낮춰짐 · 자동을 다시 누르면 기본으로)" : ""} · 자동은 보통 아래로는 내려가지 않습니다` : "고정한 화질은 느려져도 바뀌지 않습니다."}<br>30프레임은 배터리와 발열을 줄입니다.</div>`);
      b.insertBefore(gb, b.querySelector(".vol"));
      gb.querySelectorAll("[data-q]").forEach((x) => x.onclick = () => { TDB.setGfx({ mode: x.dataset.q }); m.remove(); settingsBox(); });
      gb.querySelectorAll("[data-f]").forEach((x) => x.onclick = () => { TDB.setGfx({ fps: +x.dataset.f }); m.remove(); settingsBox(); });
    }
    const pb = h("div", "btn ps-open", "개인 설정 · 배경음악과 UI 스킨 ›"); pb.onclick = () => { m.remove(); personalBox(); }; b.insertBefore(pb, b.querySelector("p"));
    if (!window.BSL_PUBLIC) { const db = h("div", "btn ps-open dev", "실험용 · 가사인격 일괄 레벨 설정 ›"); db.onclick = () => { m.remove(); devLevels(); }; b.insertBefore(db, b.querySelector("p")); }   // only in the private build
    const vr = b.querySelector(".vol:not(.bgm) input"); vr.oninput = () => { b.querySelector(".vol:not(.bgm) b").textContent = vr.value; if (window.SFX) SFX.setVol(vr.value / 100); }; vr.onchange = () => window.SFX && SFX.play("ui_ok", 0.8);
    const rs = h("div", "btn n", "데이터 초기화"); rs.onclick = () => { m.remove(); confirmBox("데이터 초기화", "보유 가사인격, 재화, 작전 기록이 처음 상태로 돌아갑니다.", "초기화", () => { S = freshSave(); save(); render(); firstStart(); }); };
    const ok = h("div", "btn", "닫기"); ok.onclick = () => m.remove();
    row.append(rs, ok); b.appendChild(row); m.appendChild(b); sheet.appendChild(m);
  }
  // for trying the supply operations at their recommended training: every owned operator set at once (the private build only).
  // the first use keeps a copy of how they were, to put back
  function devLevels() {
    const P = [[0, 20], [0, 40], [0, 45], [1, 20], [1, 45], [1, 60], [2, 20], [2, 50], [2, 90]];   // levels; skill levels below
    const m = h("div", "modal"), b = h("div", "box dev-lv", `<h3>일괄 레벨 설정 <small>실험용 · 비공개 판에만 있음</small></h3><p>보유한 가사인격 ${Object.keys(S.ops).length}명을 한꺼번에 맞춥니다. 등급의 한계를 넘는 값은 최대치로 잘립니다(3성은 정예화 1까지).</p>
      <div class="gl">${P.map(([e, l]) => `<div class="btn pz" data-e="${e}" data-l="${l}"><small>정예화</small><b class="en">${e}</b><span class="en">Lv.${l}</span></div>`).join("")}</div>
      <div class="sl"><span>스킬 레벨</span>${[1, 4, 7].map((v) => `<div class="btn sz" data-s="${v}"><b class="en">${v}</b></div>`).join("")}<em>5 이상은 정예화 1부터</em></div>
      <div class="row"><div class="btn n rb"${S._devBak ? "" : ' style="opacity:.4"'}>처음 상태로 되돌리기</div><div class="btn ok">닫기</div></div>`);
    b.querySelectorAll(".pz").forEach((x) => x.onclick = () => {
      if (!S._devBak) S._devBak = JSON.parse(JSON.stringify(S.ops));
      const e = +x.dataset.e, l = +x.dataset.l;
      for (const id of Object.keys(S.ops)) { if (!def(id)) continue; const o = S.ops[id], el = Math.min(e, maxElite(id)); o.elite = el; o.lvl = Math.min(l, maxLv(id, el)); o.xp = 0; if (o.skill > el) o.skill = 0; }
      save(); m.remove(); render(); toast(`전원 정예화 ${e} · Lv.${l}(등급 한계 내)로 맞췄습니다`);
    });
    b.querySelectorAll(".sz").forEach((x) => x.onclick = () => {
      if (!S._devBak) S._devBak = JSON.parse(JSON.stringify(S.ops));
      const v = +x.dataset.s; for (const id of Object.keys(S.ops)) { const o = S.ops[id]; o.sl = Math.min(v, o.elite >= 1 ? 7 : 4); }
      save(); m.remove(); render(); toast(`전원 스킬 레벨 ${v}(정예화 0은 4까지)로 맞췄습니다`);
    });
    b.querySelector(".rb").onclick = () => { if (!S._devBak) return toast("되돌릴 기록이 없습니다"); for (const id of Object.keys(S._devBak)) if (S.ops[id]) { const o = S.ops[id], k = S._devBak[id]; for (const f of ["elite", "lvl", "xp", "sl", "skill"]) { if (k[f] === undefined) delete o[f]; else o[f] = k[f]; } } delete S._devBak; save(); m.remove(); render(); toast("처음 상태로 되돌렸습니다"); };
    b.querySelector(".ok").onclick = () => m.remove();
    m.onclick = (ev) => { if (ev.target === m) m.remove(); };
    m.appendChild(b); sheet.appendChild(m);
  }
  function noticeBox() {
    const m = h("div", "modal"), b = h("div", "box", `<h3>공지</h3><p>제1장 「망자의 행진」 개방 중.<br>새 적 「낙오병」이 분수 광장에 나타났습니다.</p>`), row = h("div", "row");
    const ok = h("div", "btn", "확인"); ok.onclick = () => m.remove(); row.append(ok); b.appendChild(row); m.appendChild(b); sheet.appendChild(m);
  }
  // the file: every scene already seen, to watch again
  function filesBox() {
    const keys = Object.keys(STORIES).filter((k) => (S.seen || {})[k]);
    const label = (k) => k === "prologue" ? "프롤로그" : k === "TR-00:after" ? "링크 학습 이후" : k === "START:link" ? "첫 링크" : k.replace(":before", " · 작전 전").replace(":after", " · 작전 후").replace(":story", " · 막간");
    const m = h("div", "modal"), b = h("div", "box", `<h3>파일 · 열람 기록</h3>`);
    const list = h("div", ""); Object.assign(list.style, { maxHeight: "360px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", margin: "10px 0" });
    if (!keys.length) list.appendChild(h("p", "", "아직 열람한 기록이 없습니다."));
    for (const k of keys) { const r = h("div", "btn sbtn", "▶ " + esc(label(k))); r.onclick = () => { m.remove(); playStory(k, () => render()); }; list.appendChild(r); }
    const row = h("div", "row"), ok = h("div", "btn", "닫기"); ok.onclick = () => m.remove(); row.append(ok);
    b.append(list, row); m.appendChild(b); sheet.appendChild(m);
  }
  function toast(msg) { if (window.SFX && /부족|없습니다|열립니다|닫혀/.test(msg)) SFX.play("ui_err", 0.5); const t = h("div", "toast", esc(msg)); sheet.appendChild(t); setTimeout(() => t.remove(), 2400); }
  function confirmBox(title, body, yes, onYes) {
    const m = h("div", "modal"), b = h("div", "box", `<h3>${esc(title)}</h3><p>${body}</p>`), row = h("div", "row");
    const n = h("div", "btn n", "취소"), y = h("div", "btn", esc(yes));
    n.onclick = () => m.remove(); y.onclick = () => { m.remove(); onYes(); };
    row.append(n, y); b.appendChild(row); m.appendChild(b); sheet.appendChild(m);
  }
  function resChips(withStam = true) {
    tickStamina();
    const r = S.res, d = h("div", "res");
    const chip = (k, txt, plus) => { const c = h("div", "btn chip", `<b class="ii">${icn(ITEM[k].ic)}</b><span class="en">${txt}</span>${plus ? '<i class="pl">+</i>' : ""}`); c.onclick = () => itemInfo(k, HAVE[k]()); d.appendChild(c); return c; };
    if (withStam) chip("stam", `${r.stam}/${stamMax()}`);
    chip("coin", fmt(r.coin)); chip("orb", fmt(r.orb), true);
    const tk = chip("ticket", r.ticket, true); tk.onclick = () => go("gacha");
    return d;
  }
  // the original's bar: one slab with back and home, the screen's name beside it, the purse on the right
  function topBar(title, sub, back, opt = {}) {
    const t = h("div", "top"), slab = h("div", "slab");
    const b = h("div", "btn back", ICON.back); b.onclick = back || (() => go("lobby"));
    const hm = h("div", "btn home", ICON.home); hm.onclick = () => go("lobby");
    slab.append(b, hm); t.append(slab);
    if (title) t.appendChild(h("div", "ttl", `<small class="en">${esc(sub || "")}</small>${esc(title)}`));
    if (opt.res !== false) t.appendChild(resChips(opt.stam !== false));
    return t;
  }

  // drag to scroll: the page around the game blocks the browser's own touch panning, so the menus move their scrolling areas themselves
  (() => {
    let d = null, glide = 0;
    const scroller = (t) => { for (let e = t; e && e !== sheet; e = e.parentElement) { const cs = getComputedStyle(e);
      const x = /(auto|scroll)/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 2, y = /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2;
      if (x || y) return { e, x, y }; } return null; };
    sheet.addEventListener("pointerdown", (ev) => {
      if (ev.button > 0 || ev.target.closest("input, .lu-strip")) return;
      const sc = scroller(ev.target); if (!sc) return;
      cancelAnimationFrame(glide);
      d = { sc, x: ev.clientX, y: ev.clientY, moved: false, vx: 0, vy: 0, t: performance.now(), id: ev.pointerId };
    });
    window.addEventListener("pointermove", (ev) => {
      if (!d || ev.pointerId !== d.id) return;
      const k = sheet.getBoundingClientRect().width / VW, dx = (ev.clientX - d.x) / k, dy = (ev.clientY - d.y) / k;
      if (!d.moved && Math.hypot(dx, dy) < 7) return;
      d.moved = true; const now = performance.now(), dt = Math.max(1, now - d.t);
      if (d.sc.x) { d.sc.e.scrollLeft -= dx; d.vx = -dx / dt; } if (d.sc.y) { d.sc.e.scrollTop -= dy; d.vy = -dy / dt; }
      d.x = ev.clientX; d.y = ev.clientY; d.t = now;
    });
    window.addEventListener("pointerup", () => {
      if (!d) return; const m = d; d = null;
      if (!m.moved) return;
      const stop = (e) => { e.stopPropagation(); e.preventDefault(); }; window.addEventListener("click", stop, { capture: true, once: true }); setTimeout(() => window.removeEventListener("click", stop, true), 60);
      let vx = m.vx * 16, vy = m.vy * 16;
      const step = () => { vx *= 0.92; vy *= 0.92; if (m.sc.x) m.sc.e.scrollLeft += vx; if (m.sc.y) m.sc.e.scrollTop += vy; if (Math.abs(vx) + Math.abs(vy) > 0.4) glide = requestAnimationFrame(step); };
      glide = requestAnimationFrame(step);
    });
  })();

  // ---------- screens ----------
  let route = { name: "lobby" };
  // moving to another screen is never a cut: the old one fades out as the new one fades in
  let wipe = false;
  const toStage = (i) => STAGE_META[i].lab ? go("lab") : go(STAGE_META[i].supply ? "supplymap" : "terminal", i);   // a lab stage goes back to the lab menu   // back to the map an operation was picked from
  const shutToday = (i) => !!STAGE_META[i].supply && !EC.OPEN[new Date().getDay()].includes(STAGE_META[i].supply);
  function go(name, arg) { wipe = route.name !== name; if (!/^(roster|opdetail|levelup|promote)$/.test(name)) rsMark = null; route = { name, arg }; render(); }
  function render() {
    const old = wipe ? sheet.querySelector(":scope > .scr") : null; wipe = false;
    for (const c of [...sheet.children]) if (c !== old) c.remove();
    const scr = h("div", "scr"); sheet.appendChild(scr);
    (SCREENS[route.name] || SCREENS.lobby)(scr, route.arg);
    applySkin(); if (!sheet.querySelector(".story")) playMain();
    if (old) {
      old.classList.add("scr-out"); scr.classList.add("scr-in");
      setTimeout(() => { old.remove(); scr.classList.remove("scr-in"); }, 360);
    }
    fit();
    if (S.guide) runGuide();
    else if (S.bguide) runBaseGuide();
  }

  // the wardrobe: which illustration an operator wears (promotion 0 or 2 for now; skins later). "auto" follows the promotion
  const hasE2 = (id) => { const d = def(id); return d && (d.art === true || (d.art && d.art.e2)) || id === "geomseon"; };
  const lookElite = (id) => { const o = S.ops[id]; if (!o) return 0; if (o.look === 0) return 0; if (o.look === 2 && o.elite >= 2) return 2; return o.elite; };
  const opArt = (id, kind) => B.portrait(id, kind, lookElite(id));
  const nm = (id) => TD.nameOf(def(id), S.ops[id] ? S.ops[id].elite : 0);
  const epHtml = (id, big) => { const r = nm(id).ruby; return r ? `<div class="${big ? "ep-big" : "epi"}">${esc(r)}</div>` : ""; };   // the epithet: its own quiet line over the name, never squeezed onto it
  const nameHtml = (id, big) => { const n = nm(id); return `${esc(n.main)}${n.sub ? `<span class="sub-nm"${big ? ' style="font-size:21px"' : ""}>${esc(n.sub)}</span>` : ""}`; };
  const curStage = () => { let i = 0; STAGE_META.forEach((m, k) => { if (m.unlock(S) && m.branch === undefined && !m.supply && !m.lab) i = k; }); return i; };
  const MAIN = () => TD.STAGES.filter((q, i) => STAGE_META[i].branch === undefined && !STAGE_META[i].supply && !STAGE_META[i].lab);   // the story's own operations   // side branches never become "current"

  const SCREENS = {
    lobby(el) {
      const sk = skinOf(), scene = h("div", "lb-scene", `<div class="img" style="--bgimg:url(${ART[sk.img] || ART.bg})"></div><div class="grade"></div><div class="over"></div>`); el.appendChild(scene);
      lobbyFx(scene, sk.fx);
      const ad = def(S.assistant), a = h("img", "lb-art" + (ad.art ? " full" : "")), src = opArt(S.assistant, "full"); el.appendChild(a);
      if (ad.art && CUT.idx[artKey(src)] !== undefined) { a.style.opacity = 0; cutArt(src).then((u) => { if (u) { a.src = u; a.classList.remove("full"); a.classList.add("cut"); Object.assign(a.style, lobbyFit(src)); } else a.src = src; a.style.transition = "opacity .4s"; a.style.opacity = 1; }); }
      else a.src = src;
      el.appendChild(h("div", "lb-vig"));
      const ui = h("div", "lb-ui"); el.appendChild(ui);
      // top left: settings and notices
      const ic = h("div", "lb-icons");
      const gear = h("div", "btn ib", ICON.gear); gear.onclick = () => settingsBox();
      const warn = h("div", "btn ib", ICON.warn); warn.onclick = () => noticeBox();
      ic.append(gear, warn); ui.appendChild(ic);
      // the commander: level ring, name, id
      const need = playerExpNeed(), f = Math.min(1, S.exp / need), R = 66, C = 2 * Math.PI * R;
      ui.appendChild(h("div", "lb-lvbar"));
      ui.appendChild(h("div", "lb-lv", `<svg viewBox="0 0 150 150"><circle cx="75" cy="75" r="70" fill="rgba(20,21,24,.88)"/><circle cx="75" cy="75" r="${R}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="4"/>
        <circle cx="75" cy="75" r="${R}" fill="none" stroke="#ffd400" stroke-width="5" stroke-dasharray="${(C * f).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 75 75)"/></svg><div class="n en">${S.lvl}</div><div class="l en">LV</div>`));
      ui.appendChild(h("div", "lb-name", esc(S.name)));
      ui.appendChild(h("div", "lb-id en", "ID: " + esc(S.uid)));
      const nw = Math.min(330, 40 + S.name.length * 40);
      const eye = h("div", "btn lb-rb", ICON.eye); eye.style.left = (nw + 50) + "px";
      eye.onclick = (ev) => { ev.stopPropagation(); el.classList.add("hideui"); setTimeout(() => { el.onclick = () => { el.classList.remove("hideui"); el.onclick = null; }; }, 50); };
      const sw = h("div", "btn lb-rb", ICON.swap); sw.style.left = (nw + 114) + "px"; sw.onclick = () => go("roster", { pickAssistant: true });
      ui.append(eye, sw);
      // news: the archive's current pick-up
      const nb = BANNERS[NEWS], news = h("div", "btn lb-news", `<div class="bn en">BREAKING NEWS</div><div class="tt"><small>아카이브 ${nb.ko}</small>${esc(nb.n)}</div>${S.res.start > 0 ? '<div class="nw en">NEW</div>' : ""}`);
      news.style.backgroundImage = `url(${opArt(nb.art[nb.art.length - 1], "full")})`; news.onclick = () => go("gacha", { banner: NEWS }); ui.appendChild(news);
      const s1 = h("div", "btn lb-small", `${ICON.drill}<span>훈련장</span>`); s1.style.top = "578px"; s1.onclick = () => go("sandbox");
      const s2 = h("div", "btn lb-small", `${ICON.file}<span>파일</span>`); s2.style.top = "646px"; s2.onclick = () => filesBox();
      const s3 = h("div", "btn lb-small", `${ICON.drill}<span>실험실</span>`); s3.style.top = "510px"; s3.onclick = () => go("lab");   // the lab: prototype stages, outside every chapter
      ui.append(s1, s2, s3);
      // top right: the date, and the purse
      const dt = new Date(), p2 = (n) => String(n).padStart(2, "0");
      ui.appendChild(h("div", "lb-date en", `${dt.getFullYear()}/${p2(dt.getMonth() + 1)}/${p2(dt.getDate())} ${p2(dt.getHours())}:${p2(dt.getMinutes())}`));
      const rc = resChips(false); ui.appendChild(rc);
      // the tilted board of tiles on the right
      const pn = h("div", "lb-panel"); ui.appendChild(pn);
      const tile = (cls, x, y, w, hh, html, fn) => { const t = h("div", "btn lt " + cls, html); Object.assign(t.style, { left: x + "px", top: y + "px", width: w + "px", height: hh + "px" }); t.onclick = fn; pn.appendChild(t); return t; };
      const ci = curStage(), cs = TD.STAGES[ci], locked = () => toast("아직 접근 권한이 없습니다");
      tile("stam", 0, 0, 176, 178, `<i class="pl">+</i><div class="num en">${S.res.stam}</div><div class="cap">기력<span class="en" style="color:#9aa0aa;font-weight:500">/${stamMax()}</span></div>`, () => toast(`기력은 ${STAM_EVERY / 60}분마다 1 회복됩니다`));
      tile("op lt-op", 186, 0, 250, 178, `<div class="bar"></div><div class="big en">TERMINAL</div><div class="ko">작전</div><div class="cur"><b>현재</b><span class="en">${cs.code}</span>${esc(cs.name)}</div>`, () => go("ops"));
      const e1 = tile("ev", 446, 0, 164, 84, `<div class="lb" style="font-size:19px"><small>ARCHIVE</small>${esc(nb.n)}</div>`, () => go("gacha", { banner: NEWS })); e1.style.backgroundImage = `url(${opArt(nb.art[0], "full")})`; e1.style.backgroundPosition = "center 18%";
      const e2 = tile("ev", 446, 94, 164, 84, `<div class="lb" style="font-size:19px"><small>EPISODE 01</small>망자의 행진</div>`, () => go("chapters")); e2.style.backgroundImage = `url(${ART.st_war || ART.bg})`;
      tile("", 0, 192, 296, 140, `<div class="bar"></div><div class="deco en">SQUADS</div><div class="emb">${ICON.squadE}</div><div class="lb"><small>SQUADS</small>편성</div>`, () => go("squads"));
      tile("", 306, 192, 304, 140, `<div class="bar"></div><div class="deco en">OPERATOR</div><div class="emb">${ICON.opE}</div><div class="lb"><small>OPERATOR · ${Object.keys(S.ops).length}</small>가사인격</div>`, () => go("roster"));
      tile("teal", 0, 346, 224, 136, `<div class="emb" style="opacity:.6">${ICON.shopE}</div><div class="lb"><small style="color:#d6fbfc">STORE</small>상점</div>`, locked);
      const rec = tile("teal", 234, 346, 376, 136, `<div class="hdr">${ICON.link1}링크</div>`, () => {});
      const rcN = S.rc ? S.rc.slots.filter((q) => q.st === "done" || (q.st === "run" && Date.now() >= q.end)).length : 0;
      const sa = h("div", "btn sub", `${ICON.link1}공개 링크${rcN ? `<i class="badge en" style="right:4px;top:4px">${rcN}</i>` : ""}`); Object.assign(sa.style, { left: "10px", width: "170px" }); sa.onclick = (e) => { e.stopPropagation(); go("recruit"); };
      const sb = h("div", "btn sub lt-hh", `${ICON.link2}아카이브${S.res.start > 0 ? '<i class="badge en" style="right:4px;top:4px">N</i>' : ""}`); Object.assign(sb.style, { left: "190px", width: "176px", position: "absolute" });
      sb.onclick = (e) => { e.stopPropagation(); go("gacha"); };
      rec.append(sa, sb);
      { const nm2 = misReady("day").length + misReady("week").length + misReady("main").length; tile("", 0, 496, 236, 128, `<div class="bar"></div><div class="emb" style="width:90px">${ICON.task}</div><div class="lb"><small>MISSION</small>임무</div>${nm2 ? `<i class="badge en" style="right:6px;top:6px">${nm2}</i>` : ""}`, () => go("missions")); }
      if (baseOpen()) { baseTick(); tile("lt-base", 246, 496, 230, 128, `<div class="bar"></div><div class="emb" style="width:90px">${ICON.base}</div><div class="lb"><small>BASE</small>기반시설</div>${baseAlert() ? '<i class="badge en" style="right:6px;top:6px">!</i>' : ""}${trainDone() ? '<i class="badge lt-trd">특화 완료</i>' : ""}`, () => go("base")); }
      else tile("lock", 246, 496, 230, 128, `<div class="bar"></div><div class="emb" style="width:90px">${ICON.base}</div><div class="lb"><small>BASE</small>기반시설</div><div class="lk en">LOCKED</div>`, () => toast("BL-07을 클리어하면 열립니다"));
      tile("", 486, 496, 124, 128, `<div class="emb" style="width:70px;right:14px">${ICON.depot}</div><div class="lb" style="font-size:21px"><small>DEPOT</small>창고</div>${S.econGiftNew ? '<i class="badge en" style="right:6px;top:6px">N</i>' : ""}`, () => go("depot"));
    },

    // the operations hub, after the original: a light, foggy room; the current chapter's art on the left with its bar,
    // the last operation in a card at the lower right, and the kinds of operation as bare icons along the bottom
    ops(el) {
      el.appendChild(h("div", "lt-bg oh-fog"));
      const ci = curStage(), cs = TD.STAGES[ci], ep = STAGE_META[ci].ep || 1, E = EPISODES[ep], epS = MAIN().filter((q) => (STAGE_META[TD.STAGES.indexOf(q)].ep || 1) === ep), n = epS.length;
      const done = epS.filter((s) => ((S.stages[s.code] || {}).stars || 0) > 0).length;
      el.appendChild(h("div", "oh-art", `<div class="im" style="background-image:url(${epArt(ep)})"></div>`));
      el.appendChild(h("div", "oh-wm en", "THEOHI ·<br>OPERATION"));
      el.appendChild(h("div", "oh-title", `<small>메인 테마</small><b>${E.t}</b><span class="en">EPISODE ${E.no} · ${E.en}</span>`));
      el.appendChild(topBar("", "", null, { res: false }));
      const bar = h("div", "btn oh-bar2", `<div class="ic">${OPS_IC.main}<span class="en">${done}/${n}</span></div>
        <div class="tx"><div>&lt;${E.t}&gt; 작전 진행 중 · 현재 <b class="en">${cs.code}</b></div><div class="tr"><i style="width:${(done / n * 100).toFixed(1)}%"></i><em style="left:${(done / n * 100).toFixed(1)}%"></em></div></div><div class="gt"></div>`);
      bar.onclick = () => go("terminal", ci); el.appendChild(bar);
      const li = S.last !== undefined && TD.STAGES[S.last] && !STAGE_META[S.last].supply ? S.last : ci, ls = TD.STAGES[li];
      const last = h("div", "btn oh-last2", `<div class="hd">지난 작전 바로가기</div><div class="bd"><span class="pl">메인</span><div class="cd"><b class="en">${ls.code}</b><small>${esc(ls.name)}</small></div></div>`);
      last.onclick = () => go("terminal", li); el.appendChild(last);
      opsNav(el, "ops");
    },

    // main story, after the original: a dark room, the part's name on the left, the episodes as square plates strung on a thin light line
    chapters(el) {
      el.appendChild(h("div", "ch-bg2", `<div class="im" style="background-image:url(${ART.st_war || ART.bg})"></div>`));
      el.appendChild(topBar("", "", () => go("ops"), { res: false }));
      const n = MAIN().length, done = MAIN().filter((s) => ((S.stages[s.code] || {}).stars || 0) > 0).length, ci = curStage();
      el.appendChild(h("div", "ch-hd", `<div class="rk">${ICON.rook}</div><div><div class="k"><span class="sf">Main Story</span> / 메인 스토리</div><div class="t">불타는 밤</div></div>`));
      el.appendChild(h("div", "ch-act", `<div class="sf">Nox Ardens</div><div class="en">THE NIGHT THAT BURNS</div>`));
      const rec = h("div", "btn ch-rec", `<i>${ICON.file}</i><span>서사 수록</span>`); rec.onclick = () => filesBox(); el.appendChild(rec);
      const row = h("div", "ch-row2"); el.appendChild(row);
      row.appendChild(h("div", "ch-line"));
      row.addEventListener("wheel", (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { row.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
      const epOpen = (k) => TD.STAGES.some((q, i) => STAGE_META[i].ep === k && STAGE_META[i].branch === undefined && STAGE_META[i].unlock(S));
      const epProg = (k) => { const l = TD.STAGES.filter((q, i) => STAGE_META[i].ep === k && STAGE_META[i].branch === undefined); return [l.filter((q) => ((S.stages[q.code] || {}).stars || 0) > 0).length, l.length]; };
      const EPS = [1, 2, 3].map((k) => epOpen(k) ? Object.assign({ k, img: epArt(k), open: true }, EPISODES[k]) : { k, no: EPISODES[k].no, t: "???", en: "NOT YET RECEIVED" }).concat([{ no: "04", t: "???", en: "NOT YET RECEIVED" }]);
      for (const e of EPS) {
        const [done, n] = e.open ? epProg(e.k) : [0, 0];
        const c = h("div", "btn ch-sq" + (e.open ? " open" : ""), (e.img ? `<div class="im" style="background-image:url(${e.img})"></div>` : "") + `<div class="sh"></div>
          <div class="epn en">EP<br>${e.no}</div><div class="t">${esc(e.t)}</div><div class="e en">${e.en}</div>${e.open ? `<div class="pin"></div><div class="pg en">${done}/${n}</div>` : ""}`);
        c.onclick = e.open ? () => go("terminal", (STAGE_META[ci].ep || 1) === e.k ? ci : { ep: e.k }) : () => toast("아직 수신되지 않은 기록입니다");
        row.appendChild(c);
      }
      opsNav(el, "story");
    },

    terminal(el, sel = -1) {
      // one episode at a time: the one the picked stage is in, or the one asked for, or the one the story is at now
      let EP = typeof sel === "object" && sel ? sel.ep : sel >= 0 ? (STAGE_META[sel].ep || 1) : (STAGE_META[curStage()].ep || 1);
      if (typeof sel === "object") sel = -1;
      if (!EPISODES[EP]) EP = 1;
      const bg = h("div", "term-bg"); bg.style.backgroundImage = `url(${epArt(EP)})`; el.appendChild(bg);   // one backdrop for the whole chapter
      el.appendChild(h("div", "term-shade"));
      el.appendChild(topBar("", "", () => go("chapters"), { res: false }));
      tickStamina();
      const stb = h("div", "btn tm-stam", `<i>${icn("it-stam")}</i><b class="en">${S.res.stam}/${stamMax()}</b>`); stb.onclick = () => itemInfo("stam", S.res.stam); el.appendChild(stb);
      // the stages that have opened, at different heights, joined by straight runs from one to the next
      const strip = h("div", "strip"), track = h("div", "track"), GAP = 214, X0 = 110, n = TD.STAGES.length;
      const inEp = (i) => (STAGE_META[i].ep || 1) === EP;
      const isMain = (i) => STAGE_META[i].branch === undefined && !STAGE_META[i].supply && !STAGE_META[i].lab && inEp(i);
      const epMain = TD.STAGES.map((q, i) => i).filter((i) => isMain(i)), slot = (i) => epMain.indexOf(i);
      const shown = epMain.filter((i) => STAGE_META[i].unlock(S)).length;
      const cleared = (i) => ((S.stages[TD.STAGES[i].code] || {}).stars || 0) > 0;
      const YS = [150, 236, 128, 222, 140, 232, 150];
      // a branch sits below the stage it comes off, a little to the right
      const nx = (i) => isMain(i) ? X0 + slot(i) * GAP : X0 + slot(STAGE_META[i].branch) * GAP + 96;
      const ny = (i) => isMain(i) ? YS[slot(i) % YS.length] : 318, cx = (i) => nx(i) + 50, cy = (i) => ny(i) + 26;
      track.style.width = (X0 * 2 + shown * GAP + 760) + "px";
      const mainIdx = TD.STAGES.map((q, i) => i).filter((i) => isMain(i)).slice(0, shown);
      const branchIdx = TD.STAGES.map((q, i) => i).filter((i) => STAGE_META[i].branch !== undefined && inEp(i) && STAGE_META[i].unlock(S));
      track.innerHTML = `<svg width="${X0 * 2 + n * GAP + 760}" height="420"><path d="${mainIdx.map((i, k) => (k ? "L" : "M") + cx(i) + " " + cy(i)).join(" ")}" stroke="rgba(255,255,255,.85)" stroke-width="2.5" fill="none"/>`
        + branchIdx.map((i) => { const f = STAGE_META[i].branch; return `<path d="M${cx(f)} ${cy(f)} L${cx(f)} ${cy(i)} L${cx(i)} ${cy(i)}" stroke="rgba(255,255,255,.55)" stroke-width="2" stroke-dasharray="6 5" fill="none"/>`; }).join("") + `</svg>`;
      const nodes = [], dm = (c) => { const k = (EC.DROPS[c] || {}).main; return k && ITEM[k] ? `<div class="dm t${ITEM[k].tier || 0}">${icn(ITEM[k].ic)}</div>` : ""; };   // the main drop, in a disc at the tag's end
      TD.STAGES.forEach((st, i) => {
        if (!STAGE_META[i].unlock(S) || STAGE_META[i].supply || STAGE_META[i].lab || !inEp(i)) return;
        const story = !!STAGE_META[i].story;   // a story-only entry: tagged STORY, nothing hangs off it
        const nd = h("div", "btn node" + (cleared(i) ? " clear" : " next") + (isMain(i) ? "" : " tr") + (story ? " st" : ""), `<div class="lab en">${story ? "STORY" : isMain(i) ? "OPERATION" : "TUTORIAL"}</div><div class="box"><div class="hx"><i></i></div><div class="c en">${st.code}</div></div>${story ? "" : dm(st.code)}`);
        Object.assign(nd.style, { left: nx(i) + "px", top: ny(i) + "px" });
        nd.onclick = (ev) => { ev.stopPropagation(); pick(i, true); };
        nodes[i] = nd; track.appendChild(nd);
      });
      strip.appendChild(track); el.appendChild(strip);
      const nextEp = EPISODES[EP + 1], nextOpen = nextEp && TD.STAGES.some((q, i) => STAGE_META[i].ep === EP + 1 && STAGE_META[i].unlock(S));
      const epb = h("div", "ep", `${EP > 1 ? `<div class="btn pv"><div class="s">◀</div><div class="k en">EPISODE</div><div class="t en">${EPISODES[EP - 1].no}</div></div>` : ""}<div><div class="s">현재 진행도</div><div class="k en">EPISODE</div><div class="t en">${EPISODES[EP].no}</div></div><div class="btn nx"><div class="s">▶</div><div class="k en">EPISODE</div><div class="t en">${nextEp ? nextEp.no : String(EP + 1).padStart(2, "0")}</div></div>`);
      epb.querySelector(".nx").onclick = () => nextOpen ? go("terminal", { ep: EP + 1 }) : toast("아직 수신되지 않은 기록입니다");
      if (epb.querySelector(".pv")) epb.querySelector(".pv").onclick = () => go("terminal", { ep: EP - 1 });
      el.appendChild(epb);
      // picking a stage never rebuilds the screen: the map glides so the stage sits left of the panel, and the panel slides in
      const home = () => { const f = epMain.findIndex((i) => !cleared(i)); return Math.max(0, X0 + (f < 0 ? Math.max(0, shown - 1) : f) * GAP - (strip.clientWidth / 2 - 90)); };
      let cur = -1, panel = null;
      const pick = (i, anim) => {
        if (i === cur) return;
        cur = i; route.arg = i;
        nodes.forEach((nd, k) => nd && nd.classList.toggle("sel", k === i));
        epb.classList.add("hide");
        const left = Math.max(0, nx(i) - 330);
        if (anim) strip.scrollTo({ left, behavior: "smooth" }); else requestAnimationFrame(() => { strip.scrollLeft = left; });
        const np = stagePanel(el, i); np.classList.add(anim ? (panel ? "swap" : "in") : "now");
        if (panel) { const old = panel; old.classList.add("out"); setTimeout(() => old.remove(), 260); }
        el.appendChild(np); panel = np;
      };
      const unpick = () => {
        if (cur < 0) return; cur = -1; route.arg = { ep: EP };
        nodes.forEach((nd) => nd && nd.classList.remove("sel"));
        const old = panel; panel = null; old.classList.add("out"); setTimeout(() => old.remove(), 260);
        epb.classList.remove("hide"); strip.scrollTo({ left: home(), behavior: "smooth" });
      };
      strip.onclick = unpick;   // a tap on the map closes the panel, as in the original
      if (sel >= 0) pick(sel, false); else requestAnimationFrame(() => { strip.scrollLeft = home(); });
    },

    // 자원 수집, after the original's 물자 비축: a pale concrete room, the week across the top, a tall card per site —
    // its chips laid out in rows on the art, a band when it is open, its name and its days below
    // 임무, after the original: the kinds down the left, the list on the right with progress, rewards and a button that takes you there or pays out
    missions(el, tab = "day") {
      misState(); save();
      el.appendChild(h("div", "ms-bg"));
      el.appendChild(topBar("", "", () => go("lobby")));
      const TABS = [["day", "일일 임무", "DAILY"], ["week", "주간 임무", "WEEKLY"], ["main", "메인 임무", "MAIN"]];
      const side = h("div", "ms-side"); el.appendChild(side);
      for (const [k, l, e] of TABS) { const n = misReady(k).length, t = h("div", "btn ms-tab" + (k === tab ? " on" : ""), `<small class="en">${e}</small><b>${l}</b>${n ? `<i class="dot en">${n}</i>` : ""}`); t.onclick = () => { route.arg = k; render(); }; side.appendChild(t); }
      const list = tab === "day" ? DAILY : tab === "week" ? WEEKLY : MAIN_MIS;
      const rows = list.map((q) => ({ q, p: misProg(q, tab), c: misClaimed(q, tab) })).sort((a, b) => ((a.c ? 2 : a.p >= a.q.goal ? 0 : 1) - (b.c ? 2 : b.p >= b.q.goal ? 0 : 1)));
      const done = rows.filter((r) => r.c).length;
      const hd = h("div", "ms-hd", `<div class="tt"><b>${TABS.find((t) => t[0] === tab)[1]}</b><span class="en">${done}/${rows.length}</span></div>${tab !== "main" ? `<div class="rs">초기화까지 <b class="en">${hrsTxt(nextReset(tab === "week") - Date.now())}</b></div>` : ""}`);
      const all = h("div", "btn ms-all" + (misReady(tab).length ? "" : " dis"), "모두 수령"); hd.appendChild(all); el.appendChild(hd);
      all.onclick = () => { const rd = misReady(tab); if (!rd.length) return toast("수령할 보상이 없습니다"); const got = []; for (const q of rd) { claimMis(q, tab); got.push(...q.rw); } save(); render(); gainToast(mergeItems(got)); };
      const ls = h("div", "ms-list"); el.appendChild(ls);
      for (const { q, p, c } of rows) {
        const ok = p >= q.goal && !c;
        const r = h("div", "ms-row" + (c ? " done" : ok ? " ready" : ""), `<div class="bar"></div><div class="tx"><b>${esc(q.n)}</b><span>${esc(q.d)}</span>
          <div class="pg"><div class="pb"><i style="width:${p / q.goal * 100}%"></i></div><em class="en">${fmt(p)}<small>/${fmt(q.goal)}</small></em></div></div>
          <div class="rw">${q.rw.map(([k, n]) => itemDot(k, n, { text: fmt(n) })).join("")}</div>
          <div class="btn act">${c ? "완료" : ok ? "보상 수령" : q.go ? "이동 ›" : "진행 중"}</div>`);
        wireDots(r);
        r.querySelector(".act").onclick = () => {
          if (c) return; if (ok) { claimMis(q, tab); save(); render(); gainToast(q.rw); return; }
          if (q.go) q.go(); else toast("진행 중인 임무입니다");
        };
        ls.appendChild(r);
      }
    },

    // 공개 링크: four slots; an empty one opens the settings, a running one counts down, a finished one is touched to see who answered
    recruit(el) {
      const g = rcState(); save();
      el.appendChild(h("div", "rc-bg"));
      el.appendChild(topBar("", "", () => go("lobby"), { res: false }));
      el.appendChild(h("div", "rc-ttl", `<small class="en">PUBLIC LINK</small><b>공개 링크</b><span>공개 회선으로 신호를 보내, 태그에 맞는 가사인격의 응답을 기다립니다.</span>`));
      const pr = h("div", "ib-res", [["perm", inv("perm")], ["rush", inv("rush")]].map(([k, n]) => `<div class="btn c" data-k="${k}"><i>${icn(ITEM[k].ic)}</i><b class="en">${fmt(n)}</b></div>`).join(""));
      pr.querySelectorAll(".c").forEach((c) => c.onclick = () => itemInfo(c.dataset.k, inv(c.dataset.k))); el.appendChild(pr);
      const grid = h("div", "rc-grid"); el.appendChild(grid);
      g.slots.forEach((sl, i) => {
        const c = h("div", "btn rc-s " + sl.st);
        if (sl.st === "idle") c.innerHTML = `<div class="no en">0${i + 1}</div><div class="plus"><i>+</i></div><b>공개 링크 시작</b><span>링크 허가증 1장</span>`;
        else if (sl.st === "run") {
          const left = Math.max(0, sl.end - Date.now()), s2 = Math.floor(left / 1000), p = (n) => String(n).padStart(2, "0");
          c.innerHTML = `<div class="no en">0${i + 1}</div><div class="tags">${(sl.sel.length ? sl.sel : ["태그 없음"]).map((t) => `<i>${t}</i>`).join("")}</div><div class="cd en" data-end="${sl.end}">${p(Math.floor(s2 / 3600))}:${p(Math.floor(s2 / 60) % 60)}:${p(s2 % 60)}</div><div class="pb"><i style="width:${(1 - left / (sl.dur * 60e3)) * 100}%"></i></div><div class="btn rush">${icn("it-rush")}즉시 완료</div>`;
        } else c.innerHTML = `<div class="no en">0${i + 1}</div><div class="dn en">LINK COMPLETE</div><b>링크 완료</b><span>터치해서 응답한 가사인격을 확인하세요</span>`;
        c.onclick = () => sl.st === "idle" ? rcStart(i) : sl.st === "done" ? rcReveal(i) : null;
        const rb = c.querySelector(".rush"); if (rb) rb.onclick = (e) => { e.stopPropagation(); if (inv("rush") < 1) return toast("즉시 연결권이 없습니다"); takeItems([["rush", 1]]); sl.st = "done"; sl.end = Date.now(); save(); render(); };
        grid.appendChild(c);
      });
      // the clocks tick while the screen is open
      const tick = () => { if (!grid.isConnected) return; let fin = false; grid.querySelectorAll(".cd").forEach((d) => { const left = +d.dataset.end - Date.now(), s2 = Math.max(0, Math.floor(left / 1000)), p = (n) => String(n).padStart(2, "0"); d.textContent = `${p(Math.floor(s2 / 3600))}:${p(Math.floor(s2 / 60) % 60)}:${p(s2 % 60)}`; if (left <= 0) fin = true; }); if (fin) { render(); return; } setTimeout(tick, 1000); };
      setTimeout(tick, 1000);
    },

    // 기반시설, after the original's base: a pale blueprint floor, three dispatch rooms and a dorm to each chapter, corridors between,
    // and along the bottom what is waiting to be dealt with; every room a tile, touched to open
    base(el) {
      baseTick(); const b = baseState(); save();
      el.appendChild(h("div", "ib-bg"));
      el.appendChild(topBar("", "", () => go("lobby"), { res: false }));
      const inf = h("div", "btn ib-i", "i"); inf.onclick = () => baseHelp(); el.appendChild(inf);
      // the base's own purse: its two materials and coin
      const pr = h("div", "ib-res", [["bm1", inv("bm1")], ["bm2", inv("bm2")]].map(([k, n]) => `<div class="btn c" data-k="${k}"><i>${icn(ITEM[k].ic)}</i><b class="en">${fmt(n)}</b></div>`).join("") + `<div class="btn c" data-k="coin"><i class="cn">₵</i><b class="en">${fmt(S.res.coin)}</b></div>`);
      pr.querySelectorAll(".c").forEach((c) => c.onclick = () => itemInfo(c.dataset.k, c.dataset.k === "coin" ? S.res.coin : inv(c.dataset.k))); el.appendChild(pr);
      const nAl = baseAlerts();
      if (nAl) { const al = h("div", "btn ib-al", `<i>⚠</i><b class="en">${nAl}</b><small class="en">EMERGENCY</small>`); al.onclick = () => baseLog(); el.appendChild(al); }
      el.appendChild(trainTile());
      const X0 = 222, Y0 = 130, W = 176, HH = 124, GX = 8, GY = 22, COR = `<i>◂◂</i><svg viewBox="0 0 24 24"><circle cx="13" cy="4" r="2.4"/><path d="M11 8l-4 4 2 1 3-3 1 4-3 5 2 1 3-5 3 3 2-1-4-5-1-4 3 2 2-1-5-4z"/></svg><i>▸▸</i>`;
      for (let ch = 1; ch <= 3; ch++) {
        const y = Y0 + (ch - 1) * (HH + GY), open = ch <= CHAPTERS && baseOpen();
        el.appendChild(Object.assign(h("div", "ib-ch" + (open ? "" : " lk"), `<small class="en">EPISODE</small><b class="en">${String(ch).padStart(2, "0")}</b>`), { style: `top:${y}px;height:${HH}px` }));
        for (let k = 0; k < 3; k++) {
          const r = (ch - 1) * 3 + k, t = roomTile(r);
          Object.assign(t.style, { left: X0 + k * (W + GX) + "px", top: y + "px", width: W + "px", height: HH + "px" }); el.appendChild(t);
        }
        el.appendChild(Object.assign(h("div", "ib-cor", COR), { style: `left:${X0 + 3 * (W + GX)}px;top:${y + HH / 2 - 26}px` }));
        // the chapter's dorm
        const dx = X0 + 3 * (W + GX) + 70, dt = h("div", "btn ib-rm dorm");
        Object.assign(dt.style, { left: dx + "px", top: y + "px", width: "300px", height: HH + "px" });
        if (ch === 1 && open) {
          const dr = b.dorm, cap = BB.DORM_SLOTS[dr.lv - 1];
          dt.style.setProperty("--rc", "#d8dbe0"); if (ART.rm_dorm) dt.style.setProperty("--art", `url(${ART.rm_dorm})`);
          dt.innerHTML = `<div class="art"></div><div class="bar"></div><div class="tt">숙소<span class="lv">${"<i></i>".repeat(dr.lv)}${"<i class=o></i>".repeat(3 - dr.lv)}</span></div><div class="st">${dr.rest.length ? `휴식 중 · 회복 ${BB.REST[dr.lv - 1]}/시간` : "사용 가능"}</div>
            <div class="gn en"><svg class="pp" viewBox="0 0 20 20"><circle cx="10" cy="6" r="4"/><path d="M2 19c0-5 4-7 8-7s8 2 8 7z"/></svg><b>${dr.rest.length}</b><small>/${cap}</small></div><div class="sg">${Array.from({ length: cap }, (_, q) => `<i class="${dr.rest[q] ? "on" : ""}"></i>`).join("")}</div>`;
          dt.onclick = () => go("dorm");
        } else { dt.classList.add("lock"); dt.innerHTML = `<span>숙소<br>EPISODE ${String(ch).padStart(2, "0")} 수신 후 개방</span>`; dt.onclick = () => toast("다음 장이 열리면 숙소가 늘어납니다"); }
        el.appendChild(dt);
        el.appendChild(Object.assign(h("div", "ib-cor", COR), { style: `left:${dx + 308}px;top:${y + HH / 2 - 26}px` }));
      }
      // what is waiting: things to collect, guards who have dropped, rooms with nobody on watch, raids that got through
      const ready = b.rooms.filter((R, r) => roomAvail(r) && R.built && storeReady(R)).length;
      const tired = b.rooms.reduce((a, R, r) => a + (roomAvail(r) && working(R) ? R.g.filter((id) => fatOf(id) <= 0).length : 0), 0);
      const empty = b.rooms.filter((R, r) => roomAvail(r) && R.built && (!R.zone || !R.g.length)).length;
      const lost = b.log.filter((l) => !l.ok && l.t > (b.seen || 0)).length;
      const bar = h("div", "ib-pend", `<div class="pl"><i>✓</i>처리 대기</div>`); el.appendChild(bar);
      const item = (n, tag, label, fn, cls = "") => { const d = h("div", "btn pi" + (n ? " on " + cls : ""), `${n ? `<em class="en">${tag}</em>` : ""}<b>${label}</b>`); d.onclick = n ? fn : () => toast("처리할 일이 없습니다"); bar.appendChild(d); };
      item(ready, `${ready}곳 수령`, "획득 가능", () => { baseTick(); const got = b.rooms.map((R, r) => collectRoom(r)).filter(Boolean).flat(); save(); render(); if (got.length) gainToast(mergeItems(got)); });
      item(tired, `${tired}명 탈진`, "교체 필요", () => { const r = b.rooms.findIndex((R, k) => roomAvail(k) && working(R) && R.g.some((id) => fatOf(id) <= 0)); go("room", r); }, "warn");
      item(empty, `${empty}곳 공백`, "경계 공백", () => { const r = b.rooms.findIndex((R, k) => roomAvail(k) && R.built && (!R.zone || !R.g.length)); go("room", r); }, "warn");
      item(lost, `${lost}건`, "습격 피해", () => baseLog(), "bad");
      if (!b.intro) { b.intro = 1; save(); if (!S.bguide) baseHelp(); }   // the guide explains it as it goes
    },

    // a room, after the original: the room itself framed in the middle, its neighbours showing round it,
    // 설비 정보 and 배치 정보 down the left, what it makes in the corner
    room(el, r) {
      baseTick(); save(); const b = baseState(), R = b.rooms[r];
      if (!R || !R.built || !roomAvail(r)) return go("base");
      roomShell(el, r);
    },
    dorm(el) {
      baseTick(); save(); roomShell(el, "dorm");
    },
    // 훈련실: one slot. Pick an operator and a skill on the right; its next mastery is trained in real time on the left, then claimed
    train(el, arg) {
      arg = arg || {}; if (arg.id && S.ops[arg.id]) { trainSel.id = arg.id; trainSel.i = arg.i || 0; }
      const back = arg.back ? () => go(arg.back[0], arg.back[1]) : () => go("base");
      el.appendChild(h("div", "ib-bg"));
      el.appendChild(topBar("", "", back, { res: false }));
      el.appendChild(h("div", "tr-title", `<small class="en">TRAINING ROOM</small><b>훈련실</b><span>스킬 특화 · 정예화 2 · 스킬 레벨 7 이후</span>`));
      const T = S.train, slot = h("div", "tr-slot"); el.appendChild(slot);
      if (T && S.ops[T.id]) {
        const d = def(T.id), x0 = d.skills[T.i], done = trainDone(), tot = T.end - T.start, left = Math.max(0, T.end - Date.now());
        slot.innerHTML = `<div class="hd">${done ? "훈련 완료" : "훈련 중"}</div><div class="who"><img src="${opArt(T.id, "card")}" alt=""><div class="wt"><div class="nm">${esc(TD.nameOf(d, S.ops[T.id].elite).main)}</div>
          <div class="sk"><div class="ic">${skIcon(d, T.i)}</div><span>${esc(x0.name)}</span></div><div class="ml en">M${T.n - 1} → M${T.n}</div></div></div>
          <div class="pg"><i style="width:${tot > 0 ? Math.round(100 * (1 - left / tot)) : 100}%"></i></div><div class="cd en" data-end="${T.end}">${hms(left)}</div>
          <div class="df">${skDiff(TD.skillAt(x0, 7, T.n - 1), TD.skillAt(x0, 7, T.n)).map(([lab, p, q]) => `<span>${lab} <s class="en">${p}</s> → <b class="en">${q}</b></span>`).join("")}</div>
          <div class="acts">${done ? `<div class="btn claim">수령</div>` : `<div class="btn rush${inv("rush") ? "" : " dis"}"><i>${icn("it-rush")}</i>즉시 완료 <small class="en">${inv("rush")}</small></div>`}</div>`;
        const cl = slot.querySelector(".claim"); if (cl) cl.onclick = () => { trainClaim(); render(); };
        const ru = slot.querySelector(".rush"); if (ru) ru.onclick = () => { if (trainRush()) render(); };
        const tick = () => { if (!slot.isConnected) return; const l2 = S.train ? S.train.end - Date.now() : 0, c2 = slot.querySelector(".cd"); if (c2) c2.textContent = hms(Math.max(0, l2)); if (S.train && l2 <= 0 && !slot.querySelector(".claim")) { render(); return; } setTimeout(tick, 1000); };
        if (!done) setTimeout(tick, 1000);
      } else slot.innerHTML = `<div class="hd">대기 중</div><div class="idle">훈련실이 비어 있습니다.<br>오른쪽에서 가사인격과 스킬을 골라<br>특화 훈련을 시작하세요.</div>`;
      // the picker: operators who could ever be mastered (four stars and up), then their skills
      const pk = h("div", "tr-pick"); el.appendChild(pk);
      const ids = Object.keys(S.ops).filter((id) => def(id) && TD.maxMastery(def(id)) > 0).sort((a, b) => (S.ops[b].elite - S.ops[a].elite) || ((S.ops[b].sl || 1) - (S.ops[a].sl || 1)) || def(b).rarity - def(a).rarity);
      if (!trainSel.id || !ids.includes(trainSel.id)) { trainSel.id = ids[0] || null; trainSel.i = 0; }
      const ops = h("div", "tr-ops", ids.map((id) => { const o = S.ops[id], ok = o.elite >= 2 && (o.sl || 1) >= 7; return `<div class="btn tr-op${id === trainSel.id ? " on" : ""}${ok ? "" : " no"}" data-id="${id}" style="background-image:url(${opArt(id, "card")})"><em class="en">${(o.sm || []).map((m) => m ? "M" + m : "").filter(Boolean).join(" ")}</em><b>${esc(TD.nameOf(def(id), o.elite).main)}</b></div>`; }).join("") || `<div class="tr-none">4성 이상 가사인격이 없습니다</div>`);
      ops.querySelectorAll(".tr-op").forEach((c) => c.onclick = () => { trainSel.id = c.dataset.id; trainSel.i = 0; render(); });
      pk.appendChild(ops);
      if (!trainSel.id) return;
      const id = trainSel.id, d = def(id), o = S.ops[id], sks = h("div", "tr-sks"); pk.appendChild(sks);
      d.skills.forEach((x0, i) => {
        const mm = smOf(id, i), a = skAt(id, i), b = mm < 3 ? TD.skillAt(x0, 7, mm + 1) : a, df = mm < 3 ? skDiff(TD.skillAt(x0, 7, mm), b) : [];
        const r = h("div", "btn tr-sk" + (i === trainSel.i ? " on" : ""), `<div class="ic">${skIcon(d, i)}${mm ? `<div class="sk-m en">M${mm}</div>` : ""}</div><div class="tx"><div class="nm">${esc(x0.name)}<em class="en">${mm >= 3 ? "M3 완료" : `M${mm} → M${mm + 1}`}</em></div>
          ${mm < 3 ? `<div class="df">${df.map(([lab, p, q]) => `<span>${lab} <s class="en">${p}</s> → <b class="en">${q}</b></span>`).join("")}</div>${trainReq(id, i, mm + 1)}` : ""}</div>`);
        r.onclick = () => { trainSel.i = i; render(); };
        sks.appendChild(r);
      });
      const i = Math.min(trainSel.i, d.skills.length - 1), n = smOf(id, i) + 1;
      if (n <= 3) {
        const c = EC.masteryCost(id, i, n), go2 = h("div", "tr-go", `<div class="tr-cost">${c.items.map(([k, q]) => itemDot(k, q, { text: `${fmt(inv(k))}<small>/${q}</small>`, short: inv(k) < q })).join("")}<div class="idot coin${S.res.coin < c.coin ? " short" : ""}"><i class="cn">₵</i><b class="en">${fmt(c.coin)}</b></div></div>
          <div class="tm en">${TRAIN_H[n - 1] >= 1 ? TRAIN_H[n - 1] + "시간" : Math.round(TRAIN_H[n - 1] * 3600) + "초"}</div><div class="btn trgo${trainWhy(id, i, n) ? " dis" : ""}">특화 ${n} 훈련 시작</div>`);
        wireDots(go2);
        go2.querySelector(".trgo").onclick = () => { if (trainStart(id, i, n)) render(); };
        pk.appendChild(go2);
      }
    },

    supply(el) {
      el.appendChild(h("div", "sp-bg"));
      el.appendChild(topBar("", "", () => go("ops"), { res: false }));
      const DAYN = "일월화수목금토", WEEK = [1, 2, 3, 4, 5, 6, 0], today = new Date().getDay(), open = EC.OPEN[today];
      el.appendChild(h("div", "sp-week", WEEK.map((d) => `<div class="${d === today ? "on" : ""}${d === 6 ? " sat" : ""}"><b>${DAYN[d]}</b>${d === today ? '<i class="en">TODAY</i>' : ""}</div>`).join("") + `<span class="en">SCHEDULE</span>`));
      const row = h("div", "sp-row2"); el.appendChild(row);
      const idxOf = (site, tier) => TD.STAGES.findIndex((q) => q.supply === site && q.tier === tier);
      for (const site of Object.keys(EC.SUPPLY)) {
        const sp = EC.SUPPLY[site], on = open.includes(site), i1 = idxOf(site, 1), unlocked = STAGE_META[i1].unlock(S);
        const days = WEEK.filter((d) => EC.OPEN[d].includes(site));
        const reps = sp.cls.map((c) => CLS_REP[c]);
        // the art: chip plates in slanted rows, the two classes taking turns (the materials yard: its two materials)
        let plates = ""; for (let k = 0; k < 28; k++) { const t = (k + Math.floor(k / 4)) % 2, tr = k % 3 === 0 ? 2 : 1; plates += sp.coin ? `<div class="pl"><i>${icn("it-coin")}</i><b class="en">${site}-${1 + (k * 5) % 6}</b><span>주화</span></div>` : sp.mat ? `<div class="pl"><i>${icn("it-bm" + tr)}</i><b class="en">${site}-${tr}</b><span>${tr === 1 ? "자재" : "골조"}</span></div>` : `<div class="pl"><i>${icn("chipc-" + tr + "-" + reps[t])}</i><b class="en">${site}-${tr}</b><span>${sp.cls[t]}</span></div>`; }
        const band = !unlocked ? `<div class="bd lk">${esc(STAGE_META[i1].unlockAt)} 클리어 후 개방</div>` : today === 6 ? `<div class="bd sat"><i class="en">S</i>토요일 전체 개방</div>` : on ? `<div class="bd on">오늘 개방</div>` : `<div class="bd off">오늘 닫힘</div>`;
        const c = h("div", "btn sp-c " + site.toLowerCase() + (on && unlocked ? "" : " shut"), `<div class="art"><div class="tiles">${plates}</div></div>${band}
          <div class="ft"><div class="cl">${sp.coin ? `<i class="it">${icn("it-coin")}</i>` : sp.mat ? `<i class="it">${icn("it-bm1")}</i><i class="it">${icn("it-bm2")}</i>` : reps.map((r, k) => `<i class="it">${icn("chipc-1-" + r)}</i>`).join("")}</div><b>${sp.coin ? "주화" : sp.mat ? "기반시설 자재" : esc(sp.cls.join("·")) + " 칩"}</b><span>${esc(sp.n)}</span><span class="dy">${days.map((d) => DAYN[d]).join("")} 개방</span>
          <div class="dots">${WEEK.map((d) => `<i class="${days.includes(d) ? "o" : ""}${d === today ? " t" : ""}"></i>`).join("")}</div></div>`);
        c.onclick = () => { if (!unlocked) return toast(`${STAGE_META[i1].unlockAt} 클리어 후 열립니다`); if (!on) return toast(`오늘은 닫혀 있습니다 · ${days.map((d) => DAYN[d]).join("")}요일 개방`); go("supplymap", site); };
        row.appendChild(c);
      }
      opsNav(el, "supply");
    },

    // one supply site: its ground, blurred, the -1 and -2 joined by a line; picking one slides in the operation panel
    supplymap(el, arg) {
      const site = typeof arg === "string" ? arg : STAGE_META[arg] && STAGE_META[arg].supply, sel = typeof arg === "number" ? arg : -1;
      const NT = EC.SUPPLY[site].tiers, ids = Array.from({ length: NT }, (_, k) => TD.STAGES.findIndex((q) => q.supply === site && q.tier === k + 1));
      const bg = h("div", "term-bg sm-bg"); bg.style.backgroundImage = `url(${ART[{ AM: "st_war", FH: "st_underpass", CB: "st_lane", AR: "st_room", BM: "st_mart", CN: "st_station" }[site]] || ART.bg})`; el.appendChild(bg);
      el.appendChild(h("div", "term-shade"));
      el.appendChild(topBar("", "", () => go("supply"), { res: false }));
      tickStamina();
      const stb = h("div", "btn tm-stam", `<i>${icn("it-stam")}</i><b class="en">${S.res.stam}/${stamMax()}</b>`); stb.onclick = () => itemInfo("stam", S.res.stam); el.appendChild(stb);
      el.appendChild(h("div", "sm-name", `<small class="en">SUPPLY · ${site}</small><b>${esc(EC.SUPPLY[site].n)}</b><span>${EC.SUPPLY[site].coin ? "주화" : EC.SUPPLY[site].mat ? "기반시설 강화 자재" : EC.SUPPLY[site].cls.join(" · ") + " 칩"}</span>`));
      const map = h("div", "sm-map"); el.appendChild(map);
      const POS = NT === 2 ? [[300, 400], [760, 230]] : [[70, 500], [190, 360], [310, 500], [430, 360], [550, 500], [670, 360]];   // six steps zigzag on the left, clear of the panel
      if (NT > 2) map.classList.add("many");
      map.innerHTML = `<svg width="1280" height="720"><path d="${POS.slice(0, NT).map((p, k) => (k ? "L" : "M") + (p[0] + 50) + " " + (p[1] + 26)).join(" ")}" stroke="rgba(255,255,255,.9)" stroke-width="3" fill="none"/></svg>`;
      const nodes = ids.map((i, k) => {
        const m = STAGE_META[i], ok = m.unlock(S), st = (S.stages[TD.STAGES[i].code] || {}).stars || 0;
        const nd = h("div", "btn node" + (st ? " clear" : " next") + (ok ? "" : " lk"), `<div class="lab en">OPERATION</div><div class="box"><div class="hx"><i></i></div><div class="c en">${TD.STAGES[i].code}</div></div>`);
        Object.assign(nd.style, { left: POS[k][0] + "px", top: POS[k][1] + "px" });
        nd.onclick = (e) => { e.stopPropagation(); if (!ok) return toast(`${m.unlockAt} 클리어 후 열립니다`); pick(i, true); };
        map.appendChild(nd); return nd;
      });
      let cur = -1, panel = null;
      const pick = (i, anim) => {
        if (i === cur) return; cur = i; route.arg = i;
        nodes.forEach((nd, k) => nd.classList.toggle("sel", ids[k] === i));
        map.classList.add("side");
        const np = stagePanel(el, i); np.classList.add(anim ? (panel ? "swap" : "in") : "now");
        if (panel) { const old = panel; old.classList.add("out"); setTimeout(() => old.remove(), 260); }
        el.appendChild(np); panel = np;
      };
      map.onclick = () => { if (cur < 0) return; cur = -1; route.arg = site; nodes.forEach((nd) => nd.classList.remove("sel")); map.classList.remove("side"); const old = panel; panel = null; old.classList.add("out"); setTimeout(() => old.remove(), 260); };
      if (sel >= 0) pick(sel, false);
    },

    // 창고: everything the growth economy has handed out, by kind; materials refine here
    depot(el, tab = "all") {
      el.appendChild(h("div", "dp-bg")); el.appendChild(h("div", "dp-wm en", "DEPOT"));
      el.appendChild(topBar("", "", () => go("lobby"), { res: false }));
      if (S.econGiftNew) { S.econGiftNew = 0; save(); toast("성장 재료 첫 보급이 창고에 도착했습니다"); }
      const TABS = [["all", "전체"], ["grow", "육성"], ["chip", "칩"], ["mat", "재료"]];
      const kind = (k) => /^(rec|bk)/.test(k) ? "grow" : /^(chip|pack)_/.test(k) ? "chip" : "mat";
      const tb = h("div", "dp-tabs"); el.appendChild(tb);
      for (const [k, lab] of TABS) { const b = h("div", "btn" + (k === tab ? " on" : ""), lab); b.onclick = () => { route.arg = k; render(); }; tb.appendChild(b); }
      const grid = h("div", "dp-grid"); el.appendChild(grid);
      const keys = Object.keys(EC.ITEMS).filter((k) => inv(k) > 0 && (tab === "all" || kind(k) === tab));
      const order = (k) => ["grow", "chip", "mat"].indexOf(kind(k)) * 100 + (ITEM[k].tier || 1) * 10;
      keys.sort((a, b) => order(a) - order(b));
      if (!keys.length) grid.appendChild(h("div", "dp-none", "보관 중인 물품이 없습니다"));
      for (const k of keys) {
        const c = h("div", "btn dp-it t" + (ITEM[k].tier || 1), `<div class="ci">${icn(ITEM[k].ic)}<b class="en">${fmt(inv(k))}</b></div><span>${esc(ITEM[k].n)}</span>`);
        c.onclick = () => itemInfo(k, inv(k), () => render());
        grid.appendChild(c);
      }
    },

    // the squad check before a battle, like the original's pre-deploy screen
    prep(el, sel) {
      const practice = typeof sel === "object" && !!sel.practice; if (typeof sel === "object") sel = sel.sel;
      const s = TD.STAGES[sel], m = STAGE_META[sel];
      if (m.lab) return labPrep(el, sel);   // a lab stage: its own squad check, which spends nothing
      el.appendChild(h("div", "lt-bg")); el.appendChild(h("div", "lt-wm en", "SQUAD·CHECK"));
      el.appendChild(topBar("", "", () => toStage(sel), { res: false }));
      el.appendChild(h("div", "sq-stage", `<span class="en">${s.code}</span>${esc(s.name)}${practice ? `<b>연습</b>` : `<i class="en">⚡ ${S.res.stam}</i>`}`));
      if (m.fixed) {   // a lesson: its own squad, shown but not editable
        const row = h("div", "fixed-sq"); el.appendChild(row);
        const keep = {};
        for (const [id, elite, lvl] of m.fixed) {   // the cards read the save, so the ones not owned stand in for the moment
          if (!S.ops[id]) { keep[id] = true; S.ops[id] = { lvl, elite, pot: 1, skill: 0, got: 0 }; }
          const c = opCard(id); c.onclick = null; row.appendChild(c);
        }
        for (const id in keep) delete S.ops[id];
        el.appendChild(h("div", "cap-note", `<b>고정 편성</b> · 이 작전은 정해진 가사인격으로 출전합니다`));
      } else squadView(el, () => go("prep", practice ? { sel, practice } : sel), { prep: sel });
      if (m.guest) el.appendChild(h("div", "cap-note", `<b>지원 가사인격</b> · ${m.guest.map(([id, e, l]) => `${esc(nm(id).main)} (정예화 ${e} · Lv.${l})`).join(", ")}이(가) 이번 작전에 함께합니다`));
      if (m.squad) {
        el.querySelectorAll(".slots .slot").forEach((s, i) => { if (i >= m.squad && !s.classList.contains("empty")) { s.classList.add("bench"); s.appendChild(h("div", "bn-lab", "출전 불가")); } });
        el.appendChild(h("div", "cap-note", `<b>출전 인원 제한 ${m.squad}명</b> · 편성 앞쪽 ${m.squad}명만 출전합니다`));
      }
      tickStamina();
      const ok = (practice || S.res.stam >= m.cost) && (m.fixed || squadIds().length > 0);
      const g = h("div", "btn go sq-go" + (ok ? "" : " dis") + (practice ? " prc" : ""), practice ? `<div class="a">연습 개시</div><div class="b">보상 · 기록 없음</div>` : `<div class="a">작전 개시</div><div class="b">⚡ -${m.cost}</div>`);
      g.onclick = () => {
        if (!m.fixed && !squadIds().length) return toast("편성에 가사인격이 없습니다");
        if (practice) return launch(sel, true);
        if (S.res.stam < m.cost) return toast("기력이 부족합니다");
        S.res.stam -= m.cost; save();
        const key = s.code + ":before";
        if (STORIES[key] && !(S.seen || {})[key]) { (S.seen = S.seen || {})[key] = 1; save(); playStory(key, () => launch(sel)); }
        else launch(sel);
      };
      el.appendChild(g);
    },

    // the lab (실험실): every lab stage, each with its code, name, how it is won and lost, the first sentence of its description and a start button. Always open;
    // nothing here touches the story, the purse or the records
    lab(el) {
      el.appendChild(h("div", "lt-bg")); el.appendChild(h("div", "lt-wm en", "LAB"));
      el.appendChild(topBar("", "", () => go("lobby"), { res: false }));
      const box = h("div", "lab-l"); el.appendChild(box);
      box.appendChild(h("div", "lab-h", `실험실<small class="en">LAB</small>`));
      box.appendChild(h("div", "lab-note", "실험 중인 판입니다. 그림과 수치는 임시입니다."));
      TD.STAGES.forEach((s, i) => { if (!STAGE_META[i] || !STAGE_META[i].lab) return;
        const gt = s.goal && s.goal.text, parts = (s.desc || "").split(/(?<=[.!?])\s/), one = parts[0].length < 12 && parts[1] ? parts[0] + " " + parts[1] : parts[0];   // a very short first sentence takes the next one with it
        const row = h("div", "lab-r", `<div class="c en">${esc(s.code)}</div><div class="tx"><div class="n">${esc(s.name)}</div><div class="d">${esc(one)}</div>
          ${gt ? `<div class="g"><b class="w">이기는 법</b>${esc(gt.win || "")}</div><div class="g"><b class="l">지는 법</b>${esc(gt.lose || "")}</div>` : ""}</div>`);
        const go1 = h("div", "btn lab-go", "시작"); go1.onclick = () => go("prep", i); row.appendChild(go1);
        if (s.echo) {   // lab L5: yesterday's placements on a small board, with their times, and a button that forgets them (back to the seed)
          const stored = TD.echoGet(s.echo.key), recs = stored && stored.length ? stored : s.echo.seed.map(([t, id, x, y]) => ({ t, id, x, y })), Wd = s.map[0].length, Hd = s.map.length, cs = 16;
          const name = (id) => { const d = TD.UNITS.find((u) => u.id === id); return d ? TD.nameOf(d, 1).main : id; };
          const svg = `<svg width="${Wd * cs}" height="${Hd * cs}" viewBox="0 0 ${Wd * cs} ${Hd * cs}">${s.map.map((r, y) => [...r].map((c, x) => `<rect x="${x * cs}" y="${y * cs}" width="${cs - 1}" height="${cs - 1}" fill="${c === "#" || c === "W" ? "#3a3c42" : c === "h" ? "#9aa0aa" : c === "S" ? "#c0454f" : c === "B" ? "#3f8fe0" : c === "," ? "#6a625a" : "#c8ccd4"}"/>`).join("")).join("")}
            ${recs.map((r, n) => `<circle cx="${r.x * cs + cs / 2}" cy="${r.y * cs + cs / 2}" r="6" fill="#7a5cc8" stroke="#fff" stroke-width="1.5"/><text x="${r.x * cs + cs / 2}" y="${r.y * cs + cs / 2 + 3}" font-size="8" text-anchor="middle" fill="#fff">${n + 1}</text>`).join("")}</svg>`;
          const eb = h("div", "lab-echo", `<div class="eh">${stored && stored.length ? "어제의 배치" : "어제의 배치 (기본 기록)"}</div><div class="eb">${svg}<div class="lab-el">${recs.map((r, n) => `<span><b>${n + 1}</b> ${Math.floor(r.t)}초 ${esc(name(r.id))}</span>`).join("")}</div></div>`);
          const clr = h("div", "btn lab-clr", "기록 지우기"); clr.onclick = () => { TD.echoClear(s.echo.key); toast("기록을 지웠습니다. 기본 기록으로 돌아갑니다."); render(); }; eb.appendChild(clr);
          row.querySelector(".tx").appendChild(eb);
        }
        box.appendChild(row); });
    },

    // squads, after the original: a light room, twelve cards in two rows, arrows to page through the squads, their tabs along the bottom
    squads(el, arg = {}) {
      el.appendChild(h("div", "lt-bg")); el.appendChild(h("div", "lt-wm en", "SQUAD"));
      el.appendChild(topBar("", "", arg.back !== undefined ? () => go("prep", arg.back) : null, { res: false }));
      squadView(el, () => go("squads", arg), arg);
      const qb = h("div", "btn sq-quick", `<i><svg viewBox="0 0 30 24"><circle cx="9" cy="7" r="5" fill="#fff"/><path d="M1 23c0-6 4-9 8-9s8 3 8 9z" fill="#fff"/><path d="M19 10h10M24 5v10" stroke="#fff" stroke-width="2.6"/></svg></i><span>빠른 편성</span>`);
      qb.onclick = () => go("roster", { slot: 0, ret: arg }); el.appendChild(qb);
      const tr = h("div", "btn sq-trash", `<svg viewBox="0 0 24 24"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v8M14 10v8" fill="none" stroke="#fff" stroke-width="2"/></svg>`);
      tr.onclick = () => { if (!S.squads[S.cur].length) return; confirmBox("편성 비우기", `제${S.cur + 1}편성의 가사인격을 모두 내립니다.`, "비우기", () => { S.squads[S.cur] = []; save(); render(); }); }; el.appendChild(tr);
    },

    roster(el, arg = {}) {
      if (arg.slot !== undefined) return pickSquad(el, arg);   // editing a squad: the original's selection screen
      el.appendChild(h("div", "lt-bg")); el.appendChild(h("div", "lt-wm en", "ARCHIVE·0614"));
      el.appendChild(topBar(arg.pickAssistant ? "보조 가사인격 선택" : "", "", null, { res: false }));
      // the operator list, after the original: a light room, two rows running sideways, sorting in a dark bar at the top,
      // the classes as bare icons down a dark strip on the right edge
      const pill = h("div", "btn rs-own"); el.appendChild(pill);
      const bar = h("div", "rs-sort"); el.appendChild(bar);
      const side = h("div", "rs-cls"); el.appendChild(side);
      const grid = h("div", "rs-row"); el.appendChild(grid);
      grid.addEventListener("wheel", (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { grid.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
      const SORTS = [["lvl", "레벨"], ["rar", "적성"], ["got", "획득"]];
      const draw = () => {
        side.innerHTML = "";
        for (const [lab, cls, rep] of PICK_CLS) {
          const on = pickState.cls === cls;
          const b = h("div", "btn" + (on ? " on" : ""), cls ? `<img src="${clsIcon(rep, 30, on ? "#4fc3ff" : "#fff")}" alt="${lab}" title="${lab}">` : `<i class="all en">ALL</i>`);
          b.onclick = () => { pickState.cls = cls; draw(); grid.scrollLeft = 0; }; side.appendChild(b);
        }
        bar.innerHTML = `<div class="rk">${ICON.rook}</div>`;
        SORTS.forEach(([k, lab], i) => { const on = pickState.sort === k; const b = h("div", "btn" + (on ? " on" : ""), `${lab}${on ? `<i></i>` : ""}`); b.onclick = () => { pickState.sort = k; draw(); }; if (i) bar.appendChild(h("b", "")); bar.appendChild(b); });
        // the orange button, as in the original: the newly linked and those whose potential rose from a duplicate. a tap lists only them,
        // and once looked at they leave the count
        const all = pickOrder(), fresh = all.filter((id) => (S.fresh || {})[id]);
        const ids = rsMark ? all.filter((id) => rsMark.includes(id)) : all;
        pill.className = "btn rs-own" + (rsMark ? " on" : "") + (fresh.length || rsMark ? "" : " zero");
        pill.innerHTML = `<svg viewBox="0 0 20 20"><path d="M10 1l9 9-9 9-9-9z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 6l4 4-4 4-4-4z" fill="currentColor"/></svg><b class="en">${rsMark ? rsMark.length : fresh.length}</b>`;
        pill.onclick = () => {
          if (rsMark) { rsMark = null; draw(); grid.scrollLeft = 0; return; }
          if (!fresh.length) return toast("새로 링크했거나 잠재능력이 오른 가사인격이 없습니다");
          rsMark = fresh.slice(); S.fresh = {}; save(); draw(); grid.scrollLeft = 0;
        };
        grid.innerHTML = "";
        for (const id of ids) {
          const c = opCard(id);
          if (S.assistant === id) c.appendChild(h("div", "oc-as", "보조"));
          c.onclick = () => { if (S.fresh && S.fresh[id]) { delete S.fresh[id]; save(); } if (arg.pickAssistant) { S.assistant = id; save(); go("lobby"); } else go("opdetail", id); };
          grid.appendChild(c);
        }
      };
      draw();
    },

    // the operator file, after the original: the illustration fills the screen; on the left the numbers (redeploy and attack speed in
    // words), the name huge, class, range and tags along the bottom; on the right a column of dark plates — level, promotion and
    // potential, the skills (a tap unfolds one), and the branch, module and talents (a tap brings up the trait and talents in full)
    opdetail(el, id) {
      const d = def(id), o = S.ops[id], r = d.rarity, n = nm(id);
      const mL = maxLv(id, o.elite), me = maxElite(id);
      el.appendChild(h("div", "lobby-bg od-bg"));
      if (d.art) { const bl = h("img", "od-blur"); bl.src = opArt(id, "full"); el.appendChild(bl); }
      const art = h("img", "od-ill"); art.src = opArt(id, "full"); if (!d.art) art.classList.add("chibi"); el.appendChild(art);
      el.appendChild(h("div", "od-wash"));
      el.appendChild(topBar("", "", () => go("roster"), { res: false }));
      const ib = h("div", "btn od-ib", `<i>i</i>`); ib.title = "기록"; ib.onclick = () => go("opfile", id); el.appendChild(ib);
      if (d.art || id === "geomseon") { const wb = h("div", "btn od-ib od-wd", `<svg viewBox="0 0 24 24"><path d="M12 4a2 2 0 0 1 2 2c0 1-1 1.6-2 2.2V9l9 6.5c.8.6.4 1.5-.5 1.5H3.5c-.9 0-1.3-.9-.5-1.5L12 9" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>`); wb.title = "옷장"; wb.onclick = () => wardrobe(id); el.appendChild(wb); }
      // ---- left ----
      const sv = odStats(id, o.elite, o.lvl);
      const L = h("div", "odl"); el.appendChild(L);
      const cell = (ic, v, word) => `<div><i>${STAT_IC[ic]}</i><b class="${word ? "w" : "en"}">${v}</b></div>`;
      L.innerHTML = `<div class="odl-tab">스탯<i>»</i></div>
        <div class="odl-g">${cell("hp", sv.hp)}${cell("rd", rdWord(sv.rd), 1)}${cell("atk", sv.atk)}${cell("cost", sv.cost)}${cell("def", sv.def)}${cell("blk", sv.block)}${cell("res", sv.res)}${cell("spd", spdWord(sv.interval), 1)}</div>
        <div class="odl-st">${"★".repeat(r)}</div>
        ${d.nameEn && n.revealed ? `<div class="odl-en">${esc(d.nameEn)}</div>` : n.ruby ? `<div class="odl-en ko">${esc(n.ruby)}</div>` : ""}
        <div class="odl-nm">${esc(n.main)}</div>${n.revealed ? "" : `<div class="odl-hid">진명 ??? · 정예화 ${TD.revealAt(d)} 달성 시 드러남</div>`}
        <div class="odl-foot"><div class="odl-ci"><img src="${clsIcon(id, 44)}" alt="${esc(d.cls)}"></div>
          <div class="odl-rg">${rangeBox(TD.rangeKeyOf(d, o.elite))}<span>공격 범위</span></div>
          <div class="odl-tags">${odTags(d).slice(0, 2).map((t) => `<span>${esc(t)}</span>`).join("")}</div></div>`;
      // ---- right: a column that scrolls ----
      const R0 = h("div", "odr"); el.appendChild(R0);
      const R = h("div", "odr-pg"); R0.appendChild(R);   // the first page fills the column; the full text waits below it
      const full = o.lvl >= mL;
      const lvb = h("div", "btn odr-lv", `${lvRing(o.lvl, mL, 92)}<div class="odr-cap en">/${mL}</div>
        <div class="odr-exp"><small class="en">NEXT</small><b class="en">${full ? "-/-" : fmt(o.xp || 0) + "/" + fmt(EC.expNeed(o.elite, o.lvl))}</b>${full ? `<em class="en">MAX</em>` : `<i>+</i>`}</div>`);
      lvb.onclick = () => go("levelup", id);
      R.appendChild(lvb);
      const row2 = h("div", "odr-row"); R.appendChild(row2);
      const elb = h("div", "btn odr-el", `<div class="em">${ELITE_SVG[o.elite]}</div><div class="tx">정예화${o.elite >= me ? `<em class="en">MAX</em>` : ""}</div>`);
      elb.onclick = () => go("promote", id);
      const ptb = h("div", "btn odr-pt", `<div class="pm"><div class="pot-hex en">${o.pot || 1}</div></div><div class="tx"><small>잠재능력</small><i>+</i></div>`);
      ptb.onclick = () => potModal(id);
      row2.append(elb, ptb);
      // skills: the tiles and the rank here; a tap on a tile lifts the box up over the column, in larger type
      const sk = h("div", "odr-skb"); R.appendChild(sk);
      if (odOpen.id !== id) { odOpen.id = id; odOpen.at = -1; odOpen.br = false; }
      const tileHtml = (i, big) => {
        const x0 = d.skills[i], x = skAt(id, i), lock = i > o.elite && r4(d), mm = smOf(id, i);
        return `<div class="btn sk-t${big ? " big" : ""}${o.skill === i ? " on" : ""}${lock ? " lock" : ""}${odOpen.at === i ? " open" : ""}" data-i="${i}">${skIcon(d, i)}${o.skill === i ? `<div class="sk-ck"></div>` : ""}${lock ? `<div class="sk-lk">정예화 ${i}</div>` : ""}${mm ? `<div class="sk-m en">M${mm}</div>` : ""}
          <div class="sk-sp en">${x.dur ? `<span>▶${x.ammo ? x.dur + "발" : x.dur}</span>` : ""}<span>⚡${x.sp}</span></div></div>${big ? `<div class="sk-nm">${esc(x0.name)}</div>` : ""}`;
      };
      let raised = null;
      const lift = (i) => {
        odOpen.at = i;
        const x0 = d.skills[i], xl = skAt(id, i), sl = o.sl || 1, mm = smOf(id, i), lock = i > o.elite && r4(d), on = o.skill === i;
        const fresh = !raised; if (fresh) { raised = h("div", "sk-up"); el.appendChild(raised); }
        raised.innerHTML = `<div class="btn hd"><i>▲</i>스킬</div>
          <div class="tl">${d.skills.map((_, k) => `<div class="cell">${tileHtml(k, true)}</div>`).join("")}</div>
          <div class="tg sx-tags">${skTags(xl)}</div>
          <div class="ds">${numHtml(kwHtml(TD.skillDesc(xl)))}</div>
          ${sl > 1 || mm ? `<div class="lf">스킬 레벨 ${sl}${mm ? ` · 특화 ${mm}` : ""} · ${skDiff(x0, xl).map(([lab, p, q]) => `${lab} ${p}→${q}`).join(" · ")}</div>` : ""}
          ${sl >= 7 && TD.maxMastery(d) ? `<div class="btn ms">${mm >= 3 ? "특화 3 완료" : `특화 ${mm + 1} · 훈련실`}</div>` : ""}
          <div class="btn us${on ? " on" : ""}${lock ? " lk" : ""}">${on ? "작전에서 사용 중" : lock ? `정예화 ${i} 이후 사용 가능` : "디폴트 스킬로 지정"}</div>
          <div class="rk"><span class="en">RANK</span><b class="en">${sl}</b><div class="btn up${sl >= 7 ? " mx" : ""}">${sl >= 7 ? "<em>MAX</em>" : "<i>+</i>"}<span>스킬 레벨 업</span></div></div>`;
        raised.querySelector(".hd").onclick = drop;
        raised.querySelectorAll(".sk-t").forEach((t) => t.onclick = () => lift(+t.dataset.i));
        raised.querySelector(".us").onclick = () => { if (lock || on) return; o.skill = i; save(); lift(i); paint(); };
        raised.querySelector(".rk .up").onclick = () => go("skillup", id);
        const msb = raised.querySelector(".ms"); if (msb) msb.onclick = () => { if (mm >= 3) return toast("특화를 모두 마쳤습니다"); go("train", { id, i, back: ["opdetail", id] }); };
        if (fresh) { raised.classList.add("in"); requestAnimationFrame(() => raised.classList.remove("in")); }
        paint();
      };
      const drop = () => { odOpen.at = -1; if (raised) { const r0 = raised; raised = null; r0.classList.add("out"); setTimeout(() => r0.remove(), 220); } paint(); };
      const paint = () => {
        const sl = o.sl || 1;
        sk.innerHTML = `<div class="sk-hd">스킬</div><div class="odr-sk">${d.skills.map((_, k) => tileHtml(k, false)).join("")}</div>
          <div class="sk-rk"><span class="en">RANK</span><b class="en">${sl}</b><div class="btn up">${sl >= 7 ? "<em>MAX</em>" : "<i>+</i>"}</div></div>`;
        sk.querySelectorAll(".sk-t").forEach((t) => t.onclick = () => lift(+t.dataset.i));
        sk.querySelector(".sk-rk .up").onclick = () => go("skillup", id);
      };
      paint();
      if (odOpen.at >= 0 && d.skills[odOpen.at]) lift(odOpen.at);
      // branch, module and talents. a tap unfolds the box in place: the branch's trait under its name, each talent's text under its tag
      const br = h("div", "btn odr-br" + (odOpen.br ? " open" : ""));
      const tals = (d.talents || [d.talent]).filter(Boolean);
      br.innerHTML = `<div class="b1"><div class="bi"><img src="${clsIcon(id, 34)}" alt=""></div><b>${esc(d.sub || d.cls)}</b></div>
        <div class="b2"><div class="mbox">${MOD_IC}<span class="en">ORIGINAL</span></div><div class="mst"><span class="en">STAGE -</span><span>관리 <i>+</i></span></div></div>
        ${d.sub ? `<div class="fx tr"><div><p>${kwHtml((ST()[d.sub] || {}).desc || "")}</p></div></div>` : ""}
        <div class="b3">${tals.map((T) => { const lk = (T.elite || 0) > o.elite;
          return `<div class="tl${lk ? " lk" : ""}"><span>${esc(T.name)}</span>${lk ? `<em>정예화 ${T.elite} 해금</em>` : ""}<div class="fx"><div><p>${kwHtml(T.desc)}</p></div></div></div>`; }).join("")}</div><i class="odr-dn"></i>`;
      R.appendChild(br);
      br.onclick = (ev) => { if (ev.target.closest(".kw")) return; odOpen.br = !odOpen.br; br.classList.toggle("open", odOpen.br); };
      // an unfolded skill folds again when the column is scrolled down; otherwise the wheel scrolls the column
      const shut = () => { if (odOpen.at >= 0) { odOpen.at = -1; paint(true); return true; } return false; };
      R0.addEventListener("wheel", (e) => { if (e.deltaY > 0 && shut()) e.preventDefault(); }, { passive: false });
      let ty = null; R0.addEventListener("touchstart", (e) => { ty = e.touches[0].clientY; }, { passive: true });
      R0.addEventListener("touchmove", (e) => { if (ty !== null && ty - e.touches[0].clientY > 24) { ty = null; shut(); } }, { passive: true });
    },

    // the operator's archive, after the original: the illustration on the left with the class and name, the illustrator
    // along the bottom; on the right three records. picking one lifts it to the top and opens its pages; the others step aside as tabs
    opfile(el, arg) {
      const id = typeof arg === "object" ? arg.id : arg, tab = typeof arg === "object" ? arg.tab : null;
      const d = def(id), o = S.ops[id], n = nm(id), X = (window.BSL_OPTEXT || {})[id] || {};
      const LB = Object.assign({ basic: "기본정보", profile: "개인 이력", record: "기록" }, (window.BSL_OPTEXT || {})._labels || {});   // section names, set in the file editor
      el.appendChild(h("div", "lt-bg of-bg"));
      const art = h("img", "of-ill"); art.src = opArt(id, "full"); if (!d.art) art.classList.add("chibi"); el.appendChild(art);
      el.appendChild(h("div", "of-wash"));
      el.appendChild(topBar("", "", () => go("opdetail", id), { res: false }));
      const CLS_EN = { 선봉: "VANGUARD", 근위: "GUARD", 중장: "DEFENDER", 저격: "SNIPER", 술사: "CASTER", 의무: "MEDIC", 보조: "SUPPORTER", 특수: "SPECIALIST" };
      el.appendChild(h("div", "of-id", `<div class="cl"><div><small class="en">${CLS_EN[d.cls] || ""}</small><b>${esc(d.cls)}</b></div><i><img src="${clsIcon(id, 40)}" alt=""></i></div>
        ${d.nameEn && n.revealed ? `<div class="en2">${esc(d.nameEn)}</div>` : n.ruby ? `<div class="en2 ko">${esc(n.ruby)}</div>` : ""}<div class="nm">${esc(n.main)}</div>`));
      el.appendChild(h("div", "of-cred", `<div><i>${OF_IC.file}</i><span>${esc(X.illustrator || "미상")}</span></div>`));
      const R = h("div", "of-r"); el.appendChild(R);
      const CARDS = [["file", "파일", OF_IC.file, OF_ITEM.file], ["record", "기록", OF_IC.tape, OF_ITEM.tape], ["module", "모듈", OF_IC.mod, OF_ITEM.case]];
      const open = (k) => {
        R.innerHTML = "";
        if (!k) {   // the three records, stacked
          R.className = "of-r menu";
          for (const [key, lab, ic, item] of CARDS) { const c = h("div", "btn of-card", `<div class="tb"><i>${ic}</i><em>+</em></div><div class="it">${item}</div>`); c.onclick = () => open(key); R.appendChild(c); }
          return;
        }
        R.className = "of-r page";
        const [, lab, ic, item] = CARDS.find((c) => c[0] === k);
        R.appendChild(h("div", "of-hd", `<div class="tb"><i>${ic}</i><em>+</em></div><div class="it">${item}</div><div class="ln"></div><b>${lab}</b>`));
        const tabs = h("div", "of-tabs"); R.appendChild(tabs);
        for (const [key, , ic2] of CARDS) if (key !== k) { const t = h("div", "btn", `<i>${ic2}</i><em>+</em>`); t.onclick = () => open(key); tabs.appendChild(t); }
        const body = h("div", "of-body"); R.appendChild(body);
        if (k === "file") {
          const sec = (title, html) => `<div class="sh">${title}</div><div class="sb">${html}</div>`;
          const kv = (rows) => rows.map(([a, b]) => `<div>[${esc(a)}] ${esc(b)}</div>`).join("");
          body.innerHTML = X.basic ? sec(LB.basic, kv(X.basic)) + (X.profile || []).map((p, i) => sec(i ? `${LB.profile} ${i + 1}` : LB.profile, `<p>${esc(p)}</p>`)).join("")
            : sec(LB.basic, kv([["코드네임", nm(id).main], ["분류", d.cls + (d.sub ? " · " + d.sub : "")]])) + `<p class="nil">이 가사인격의 파일은 아직 정리 중입니다.</p>`;
        } else if (k === "record") {
          const rs = X.records || [];
          body.innerHTML = rs.length ? rs.map((p, i) => { const lk = i >= 1 && o.elite < 1; return `<div class="sh">${LB.record} ${i + 1}${lk ? " · 정예화 1 해금" : ""}</div><div class="sb${lk ? " lk" : ""}"><p>${lk ? "정예화 1 이후 열람할 수 있습니다." : esc(p)}</p></div>`; }).join("") : `<p class="nil">열람할 수 있는 기록이 없습니다.</p>`;
        } else if (k === "module") {
          body.innerHTML = `<p class="nil">모듈 시스템이 열리지 않았습니다.</p>`;
        }
      };
      open(tab);
    },

    // level up, after the original: the illustration behind; on the right a dark strip that works as a drum — slide it (or roll the
    // wheel) to pick the target level, the next levels stacked above; on the left what the numbers become; the price in a circle below
    levelup(el, id) {
      const d = def(id), o = S.ops[id], mL = maxLv(id, o.elite), me = maxElite(id);
      el.appendChild(h("div", "lobby-bg od-bg"));
      if (d.art) { const bl = h("img", "od-blur"); bl.src = opArt(id, "full"); el.appendChild(bl); }
      const art = h("img", "od-ill"); art.src = opArt(id, "full"); if (!d.art) art.classList.add("chibi"); el.appendChild(art);
      el.appendChild(topBar("", "", () => go("opdetail", id), { res: false }));
      // a target level is in reach when the records cover its EXP and the coin covers what the records cost to read
      const can = (to) => { const e = expTo(o, to); if (!e) return true; const pl = recPlan(e); return !!pl && coinFor(e) <= S.res.coin; };
      let reach = o.lvl; while (reach < mL && can(reach + 1)) reach++;
      let to = Math.min(mL, o.lvl + 1);
      const box = h("div", "lu-box"); el.appendChild(box);
      const coin = h("div", "lu-items"); el.appendChild(coin);
      const strip = h("div", "lu-strip"); el.appendChild(strip);
      const maxf = h("div", "lu-max en", `MAX<b>${mL}</b>`); el.appendChild(maxf);
      const btn = h("div", "btn lu-go", `<i><svg viewBox="0 0 30 24"><path d="M3 13l12-9 12 9M3 21l12-9 12 9" fill="none" stroke="currentColor" stroke-width="3"/></svg></i><span>레벨업</span>`); el.appendChild(btn);
      const draw = () => {
        const a = odStats(id, o.elite, o.lvl), b = odStats(id, o.elite, to), need = expTo(o, to), pl = need ? recPlan(need) : { use: {}, exp: 0 }, cost = coinFor(need);
        const short = !pl || cost > S.res.coin;
        const ln = (k, lab) => `<div><span>${lab}</span><b class="en">${a[k]}</b><i>⇢</i><b class="en${b[k] > a[k] ? " up" : ""}">${b[k]}</b></div>`;
        box.innerHTML = `<div class="lu-tag en">UPDATE -</div><div class="lu-l">${ln("hp", "최대 체력")}${ln("atk", "공격")}${ln("def", "방어")}${ln("res", "마법 저항")}</div>
          <div class="lu-r"><div class="lu-tg"><span>목표 레벨</span><b class="en">LV ${to}</b></div><div class="lu-c${!pl ? " short" : ""}"><span>필요 경험치</span><b class="en">${fmt(need)}</b></div><div class="lu-c${cost > S.res.coin ? " short" : ""}"><span>필요 주화</span><b class="en">${fmt(cost)}</b></div>
          ${o.lvl >= mL ? `<div class="lu-note">${o.elite < me ? "정예화하면 레벨 상한이 오릅니다" : "최대 레벨입니다"}</div>` : !pl ? `<div class="lu-note">작전기록이 부족합니다</div>` : cost > S.res.coin ? `<div class="lu-note">주화가 부족합니다</div>` : ""}</div>`;
        const use = (pl && pl.use) || {};
        coin.innerHTML = RECS.slice().reverse().map(([k]) => itemDot(k, inv(k), { text: use[k] ? `${use[k]}<small>/${fmt(inv(k))}</small>` : fmt(inv(k)), short: !inv(k) })).join("")
          + `<div class="lu-it${cost > S.res.coin ? " short" : ""}"><div class="cn">₵</div><b class="en">${S.res.coin >= 10000 ? (S.res.coin / 10000).toFixed(1) + "만" : fmt(S.res.coin)}</b></div>`;
        wireDots(coin);
        const nx = EC.expNeed(o.elite, o.lvl);
        strip.innerHTML = `<div class="lu-up en">${to + 2 <= mL ? to + 2 : ""}</div><div class="lu-up b en">${to + 1 <= mL ? to + 1 : ""}</div>
          <div class="lu-ring">${lvRing(to, mL, 168)}<div class="lu-tgt en">TARGET</div></div>
          <div class="lu-chev"><svg viewBox="0 0 60 44"><path d="M4 6l26 18L56 6M4 22l26 18 26-18" fill="none" stroke="#fff" stroke-width="7"/></svg></div>
          <div class="lu-hint">EXP ${fmt(o.xp || 0)}/${fmt(nx)} · 위아래로 밀어 목표 레벨 선택</div>`;
        btn.classList.toggle("dis", to === o.lvl || short);
      };
      const step = (k) => { const n = Math.max(o.lvl, Math.min(mL, to + k)); if (n !== to) { to = n; draw(); } };
      strip.addEventListener("wheel", (e) => { e.preventDefault(); step(e.deltaY < 0 ? 1 : -1); }, { passive: false });
      let dy = null, acc = 0;
      strip.addEventListener("pointerdown", (e) => { dy = e.clientY; acc = 0; strip.setPointerCapture(e.pointerId); });
      strip.addEventListener("pointermove", (e) => { if (dy === null) return; acc += dy - e.clientY; dy = e.clientY; const k = Math.trunc(acc / 18); if (k) { acc -= k * 18; step(k); } });
      strip.addEventListener("pointerup", () => { dy = null; });
      strip.addEventListener("click", (e) => { if (e.target.closest(".lu-up.b")) step(1); else if (e.target.closest(".lu-up")) step(2); else if (e.target.closest(".lu-chev")) step(-1); });
      maxf.onclick = () => { to = Math.max(o.lvl, reach > o.lvl ? reach : mL); draw(); };
      btn.onclick = () => {
        if (to === o.lvl) return toast(o.lvl >= mL ? (o.elite < me ? "정예화하면 레벨 상한이 오릅니다" : "최대 레벨입니다") : "목표 레벨을 정하세요");
        const need = expTo(o, to), pl = recPlan(need), cost = coinFor(need);
        if (!pl) return toast("작전기록이 부족합니다"); if (cost > S.res.coin) return toast("주화가 부족합니다");
        takeItems(Object.entries(pl.use)); S.res.coin -= cost;
        o.xp = to >= mL ? 0 : pl.exp - need; o.lvl = to;   // what the last record ran over carries into the next level bump("lvup");
        save(); toast(`LV ${to} 달성`); go("opdetail", id);
      };
      draw();
    },

    // promotion, after the original: a band across the middle — this stage, the next one large with what it brings — and below,
    // what it takes in circles, and the question with ✕ and ✓
    // skill level up, after the original: the level now and next as a blueprint on the left, every skill at the next level on
    // the right, what it costs along the bottom, and a plain yes or no
    skillup(el, id) {
      const d = def(id), o = S.ops[id];
      el.appendChild(h("div", "lobby-bg od-bg"));
      if (d.art) { const bl = h("img", "od-blur"); bl.src = opArt(id, "full"); el.appendChild(bl); }
      el.appendChild(h("div", "su-shade"));
      el.appendChild(topBar("", "", () => go("opdetail", id), { res: false }));
      const sl = o.sl || 1, to = sl + 1, mx = sl >= 7, c = mx ? null : EC.skillCost(id, to), msOn = mx && TD.maxMastery(d) > 0;
      el.appendChild(h("div", "su-cur", `<div class="cap">현재 스킬 레벨</div><div class="bp">
        <div class="a en">${sl}${mx ? "" : '<i class="dot"></i>'}</div>${mx ? `<div class="mxw en">MAX</div>` : `<div class="ar">›››</div><div class="b en">${to}<i class="br"></i></div>`}</div>${msOn ? `<div class="su-msn">레벨 7 이후에는 스킬마다 <b>특화</b>(M1~M3)를 훈련실에서 진행합니다</div>` : ""}`));
      const list = h("div", "su-list"); el.appendChild(list);
      d.skills.forEach((x0, i) => {
        const mm = smOf(id, i), a = skAt(id, i), b = mx ? (msOn && mm < 3 ? TD.skillAt(x0, 7, mm + 1) : a) : TD.skillAt(x0, to, 0), lock = i > o.elite && r4(d);
        const df = skDiff(a, b), msRow = msOn ? (mm >= 3 ? `<div class="su-ms done">특화 <b class="en">M3</b> 완료</div>`
          : `<div class="su-ms"><span>특화 <b class="en">M${mm}</b> → <b class="en">M${mm + 1}</b></span>${trainReq(id, i, mm + 1)}<div class="btn msgo">훈련실</div></div>`) : "";
        const row = h("div", "su-sk" + (lock ? " lk" : "") + (o.skill === i ? " on" : ""), `<div class="ic">${skIcon(d, i)}<div class="sp en">⚡${b.sp}</div>${mm ? `<div class="sk-m en">M${mm}</div>` : ""}</div><div class="nm">${esc(x0.name)}</div>
          <div class="tx"><div class="sx-tags">${skTags(b)}</div><div class="ds">${chgHtml(b, df)}</div>
          ${df.length ? `<div class="df">${df.map(([lab, p, q]) => `<span>${lab} <s class="en">${p}</s> → <b class="en">${q}</b></span>`).join("")}</div>` : ""}${msRow}</div>
          <div class="gh en">${mx ? (msOn ? "M" + Math.min(3, mm + 1) : sl) : to}</div>`);
        const gb = row.querySelector(".su-ms .msgo"); if (gb) gb.onclick = () => go("train", { id, i, back: ["skillup", id] });
        list.appendChild(row);
      });
      const foot = h("div", "su-foot"); el.appendChild(foot);
      if (mx) { foot.innerHTML = `<div class="su-q">스킬 레벨이 최대입니다${msOn ? " · 특화는 훈련실에서" : TD.maxMastery(d) ? "" : " (3성은 특화가 없습니다)"}</div>`; return; }
      const eOk = o.elite >= c.elite, ok = eOk && hasItems(c.items) && S.res.coin >= c.coin;
      const need = h("div", "su-cost", `${c.elite ? `<div class="cel${eOk ? "" : " short"}"><div class="ring"><b class="en">${c.elite}</b><span>정예화</span></div><em class="en">${o.elite}/${c.elite}</em></div>` : ""}
        ${c.items.map(([k, n]) => `<div class="cel">${itemDot(k, n, { text: "" })}<em class="en${inv(k) < n ? " short" : ""}">${fmt(inv(k))}/${n}</em></div>`).join("")}
        <div class="cel"><div class="btn idot coin" data-k="coin"><i class="cn">₵</i></div><em class="en${S.res.coin < c.coin ? " short" : ""}">${fmt(c.coin)}</em></div>`);
      el.appendChild(need); wireDots(need);
      foot.innerHTML = `<div class="su-q">레벨 <b class="en">${sl}</b> → <b class="en">${to}</b>, 계속하시겠습니까?</div><div class="su-yn"><div class="btn no">✕</div><div class="btn yes${ok ? "" : " dis"}">✓</div></div>`;
      foot.querySelector(".no").onclick = () => go("opdetail", id);
      foot.querySelector(".yes").onclick = () => {
        if (!eOk) return toast(`정예화 ${c.elite} 이후 강화할 수 있습니다`); if (!ok) return toast("재료가 부족합니다");
        takeItems(c.items); S.res.coin -= c.coin; o.sl = to; save();
        toast(`스킬 레벨 ${to} 달성`); render();
      };
    },

    promote(el, id) {
      const d = def(id), o = S.ops[id], mL = maxLv(id, o.elite), me = maxElite(id), nx = o.elite + 1;
      el.appendChild(h("div", "lobby-bg od-bg pr-bg"));
      if (d.art) { const bl = h("img", "od-blur dk"); bl.src = opArt(id, "full"); el.appendChild(bl); }
      const art = h("img", "od-ill"); art.src = opArt(id, "full"); if (!d.art) art.classList.add("chibi"); el.appendChild(art);
      el.appendChild(h("div", "pr-vig"));
      el.appendChild(topBar("", "", () => go("opdetail", id), { res: false }));
      const band = h("div", "pr-band"); el.appendChild(band);
      if (o.elite >= me) {
        band.innerHTML = `<div class="pr-big">${ELITE_SVG[o.elite]}</div><div class="pr-n2"><b class="en">${o.elite}</b><span>정예화 단계</span></div><div class="pr-gain"><div>정예화를 모두 마쳤습니다</div></div>`;
        return;
      }
      const gains = ["최대 스탯 상승", `최대 레벨 <b class="en">${maxLv(id, nx)}</b>`];
      if (TD.rangeKeyOf(d, nx) !== TD.rangeKeyOf(d, o.elite)) gains.push("<em>공격 범위</em> 확장");
      if (d.skills[nx] && r4(d)) gains.push(`신규 스킬 <em>${esc(d.skills[nx].name)}</em> 획득`);
      for (const T of d.talents || [d.talent]) if (T && (T.elite || 0) === nx) gains.push(`신규 재능 <em>${esc(T.name)}</em> 획득`);
      if (d.blockE && d.blockE[nx]) gains.push(`저지 가능 수 <em>${d.blockE[nx]}</em>`);
      if (d.art && d.art.e2 && nx === 2) gains.push("<em>새 일러스트</em> 개방");
      if (TD.revealAt(d) === nx) gains.push("<em>진명</em> 해방");
      const dc = TD.eliteCost(d, nx) - TD.eliteCost(d, o.elite); if (dc) gains.push(`배치 코스트 +${dc}`);
      band.innerHTML = `<div class="pr-n1"><b class="en">${o.elite}</b><span>정예화 단계</span></div><div class="pr-sm">${ELITE_SVG[o.elite]}</div><i class="pr-line"></i>
        <div class="pr-big">${ELITE_SVG[nx]}</div><div class="pr-n2"><b class="en">${nx}</b><span>정예화 단계</span></div><div class="pr-gain">${gains.map((g) => `<div>${g}</div>`).join("")}</div>`;
      const pc = EC.promoCost(id, d.rarity, d.cls, nx) || { coin: PROMO[nx], items: [] }, need = pc.coin, lvOk = o.lvl >= mL, coinOk = S.res.coin >= need, matOk = hasItems(pc.items);
      const mats = h("div", "pr-mats"); el.appendChild(mats);
      mats.innerHTML = `<div class="pr-m lv">${lvRing(o.lvl, mL, 78)}<small>레벨</small><b class="en ${lvOk ? "" : "no"}">${o.lvl}/${mL}</b></div>
        <div class="pr-m"><div class="cn">₵</div><b class="en ${coinOk ? "" : "no"}">${fmt(need)}</b></div>
        ${pc.items.map(([k, n]) => itemDot(k, n, { text: `${fmt(inv(k))}<small>/${n}</small>`, short: inv(k) < n })).join("")}`;
      wireDots(mats);
      const ask = h("div", "pr-ask", `<div class="q">계속 진행하시겠습니까?</div>`); el.appendChild(ask);
      const no = h("div", "btn pr-x", `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="#fff"/><path d="M14 14l12 12M26 14L14 26" stroke="#222" stroke-width="3.6"/></svg>`); no.onclick = () => go("opdetail", id);
      const ok = h("div", "btn pr-ok" + (lvOk && coinOk && matOk ? "" : " dis"), `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="#fff"/><path d="M12 20l6 6 10-11" fill="none" stroke="#1f8fd0" stroke-width="3.6"/></svg>`);
      ok.onclick = () => {
        if (!lvOk) return toast(`정예화 ${o.elite} · LV ${mL}에 도달해야 합니다`); if (!coinOk) return toast("주화가 부족합니다"); if (!matOk) return toast("재료가 부족합니다");
        S.res.coin -= need; takeItems(pc.items); o.elite = nx; o.lvl = 1; o.xp = 0; save(); go("opdetail", id); if (o.elite === TD.revealAt(d)) revealName(id); else toast(`정예화 ${nx} 달성`);
      };
      const bt = h("div", "pr-bt"); bt.append(no, ok); ask.appendChild(bt);
    },

    gacha(el, arg = {}) {
      const hasStart = !S.startDone && S.res.start > 0;
      const ban = arg.banner && (arg.banner === "start" || BANNERS[arg.banner]) ? arg.banner : (hasStart ? "start" : NEWS);
      el.appendChild(h("div", "hh-bg"));
      const arts = ban === "start" ? ["atat"] : BANNERS[ban].art;
      arts.forEach((id, i) => { const a = h("img", "hh-art" + (arts.length > 1 && i < arts.length - 1 ? " back" : "")); a.src = opArt(id, "full"); el.appendChild(a); });
      el.appendChild(h("div", "hh-shade"));
      el.appendChild(topBar("아카이브", "ARCHIVE"));
      const tabs = h("div", "bn-tabs"); el.appendChild(tabs);
      const tab = (k, t, s2) => { const b = h("div", "btn bn" + (ban === k ? " on" : ""), `<div class="s en">${s2}</div><div class="t">${t}</div>`); b.onclick = () => go("gacha", { banner: k }); tabs.appendChild(b); };
      if (hasStart) tab("start", "스타트 링크", "START");
      for (const k of Object.keys(BANNERS)) tab(k, BANNERS[k].n, BANNERS[k].tag);
      if (ban === "start") {
        el.appendChild(h("div", "hh-info", `<div class="s en" style="color:#7fe3ff;font-size:16px;margin:0">START LINK · 1회 한정</div>
          <div class="t">스타트 링크</div><div class="s">수신 중단 보상으로 지급된 스타트 수신권 전용 링크입니다.</div>
          <div class="rate">10회 링크 1회 한정 · 링크 대상 고정<br>스타트 수신권 보유: ${S.res.start}</div>`));
        const p10 = h("div", "btn pull p10 start" + (S.res.start > 0 ? "" : " dis"), `<div class="a">10회</div><div class="b">스타트 수신권 1</div>`);
        p10.onclick = () => { if (S.res.start <= 0) return; showPulls(el, pullStart(), { banner: NEWS, start: true }); };
        el.appendChild(p10);
        return;
      }
      const bn = BANNERS[ban], st = banSt(ban), u6 = bn.up[6], u5 = bn.up[5];
      const ups = [u6 && `<div class="up"><i style="background-image:url(${opArt(u6, "card")})"></i><span>${"★".repeat(6)}</span><b>${esc(nm(u6).main)}</b><em>링크 6 중 50%</em></div>`, u5 && `<div class="up"><i style="background-image:url(${opArt(u5, "card")})"></i><span>${"★".repeat(5)}</span><b>${esc(nm(u5).main)}</b><em>링크 5 중 50%</em></div>`].filter(Boolean).join("");
      const info = h("div", "hh-info", `<div class="s en" style="color:${bn.col};font-size:16px;margin:0">${bn.tag} · ${bn.ko}</div>
        <div class="t">${esc(bn.n)}</div>${ups ? `<div class="ups">${ups}</div>` : `<div class="s">모든 가사인격이 같은 확률로 출현합니다. 확률 상승 대상 없음.</div>`}
        <div class="rate">적성 링크별 확률 · 6: 2% · 5: 8% · 4: 50% · 3: 40%<br>50회 연속 링크 6이 나오지 않으면 이후 회당 링크 6 확률 +2%<br>배너마다 따로 계산<br>${bn.spark ? `${bn.spark}회 안에 ${esc(nm(u6).main)} 미획득 시 다음 링크 6은 ${esc(nm(u6).main)} 확정${st.gotF ? " (획득 완료)" : ` · 현재 ${Math.min(st.n, bn.spark)}/${bn.spark}`}<br>` : ""}${S.newbie > 0 ? "첫 10회 안에 링크 5 이상 1명 확정 · " : ""}중복 획득 시 잠재 +1</div>`);
      el.appendChild(info);
      el.appendChild(h("div", "pity", `링크 6 미획득 ${st.pity}회 · 현재 링크 6 확률 ${sixRate(ban)}%`));
      const can1 = S.res.ticket > 0 || S.res.orb >= PULL, can10 = S.res.orb >= PULL * 10 || S.res.ticket >= 10;
      const p1 = h("div", "btn pull p1" + (can1 ? "" : " dis"), `<div class="a">1회</div><div class="b">${S.res.ticket > 0 ? "아카이브 수신권 1" : "합성옥 " + PULL}</div>`);
      const p10 = h("div", "btn pull p10" + (can10 ? "" : " dis"), `<div class="a">10회</div><div class="b">${S.res.ticket >= 10 ? "수신권 10" : "합성옥 " + fmt(PULL * 10)}</div>`);
      p1.onclick = () => { if (!can1) return toast("합성옥이 부족합니다"); if (S.res.ticket > 0) S.res.ticket--; else S.res.orb -= PULL; showPulls(el, pullN(ban, 1), { banner: ban }); };
      p10.onclick = () => { if (!can10) return toast("합성옥이 부족합니다"); if (S.res.ticket >= 10) S.res.ticket -= 10; else S.res.orb -= PULL * 10; showPulls(el, pullN(ban, 10), { banner: ban }); };
      el.append(p1, p10);
    },

    sandbox(el) {
      el.appendChild(h("div", "lobby-bg"));
      el.appendChild(topBar("훈련장 편성", "TRAINING", () => go("lobby")));
      const all = TD.UNITS.filter((u) => !u.summon && u.rarity && (S.ops[u.id] || !DUMMY_OPS.has(u.id))).map((u) => u.id).sort((a, c) => (S.ops[c] ? 1 : 0) - (S.ops[a] ? 1 : 0) || def(c).rarity - def(a).rarity);   /* every operator: yours as they stand first, the rest on trial at full promotion */
      let sel = (S.sbSquad || []).filter((q) => def(q.id));
      if (!S.sbSquad) sel = all.slice(0, 12).map((id) => ({ id, s: S.ops[id] ? S.ops[id].skill : 0 }));
      const keep = () => { S.sbSquad = sel; save(); };
      const bar = h("div", ""); Object.assign(bar.style, { position: "absolute", left: "40px", right: "40px", bottom: "16px", display: "flex", gap: "10px", alignItems: "center", zIndex: "5" });
      const cnt = h("div", "en", ""); cnt.style.cssText = "flex:1;color:#ccc;font-size:17px";
      const clr = h("div", "btn sbtn", "전체 해제"); clr.onclick = () => { sel = []; keep(); go("sandbox"); };
      const st = h("div", "btn sbtn", "훈련 시작"); Object.assign(st.style, { background: "#ffd400", color: "#111", height: "48px", padding: "0 34px", fontSize: "18px", fontWeight: "900" });
      st.onclick = () => sel.length ? startSandbox(sel) : toast("가사인격을 1명 이상 선택하세요");
      bar.append(cnt, clr, st); el.appendChild(bar);
      const grid = h("div", "grid"); grid.style.bottom = "76px"; el.appendChild(grid);
      const paint = () => { cnt.textContent = `${sel.length} / 12`; };
      for (const id of all) {
        const d = def(id), c = h("div", "btn card"), fn = nm(id);
        const ns = Math.min((d.skills || []).length, sbOp(id).elite + 1);   /* skills open with promotion, as everywhere else */
        c.innerHTML = `<img class="art" src="${opArt(id, "card")}"><div class="rtop" style="background:${RAR_COL[d.rarity]}"></div><img class="cls" src="${clsIcon(id, 28)}">
          <div class="bar"><div>${stars(d.rarity)}</div><div class="nm">${esc(fn.main)}</div><div class="lv en">${fn.sub ? esc(fn.sub) : ""}</div></div>`;
        const tag = h("div", "tag en", ""); c.appendChild(tag);
        if (!S.ops[id]) { const tr = h("div", "en", "체험"); Object.assign(tr.style, { position: "absolute", left: "4px", top: "40px", background: "#111c", color: "#9cf", border: "1px solid #9cf", fontSize: "12px", fontWeight: "900", padding: "1px 6px", borderRadius: "3px" }); c.appendChild(tr); }
        const sk = h("div", "en", ""); Object.assign(sk.style, { position: "absolute", right: "4px", top: "40px", background: "#111c", color: "#ffd400", border: "1px solid #ffd400", fontSize: "13px", fontWeight: "900", padding: "2px 7px", borderRadius: "3px" });
        c.appendChild(sk);
        const upd = () => {
          const i = sel.findIndex((q) => q.id === id);
          c.classList.toggle("in", i >= 0); tag.textContent = i >= 0 ? String(i + 1) : ""; tag.hidden = i < 0;
          sk.hidden = i < 0 || ns < 2; if (i >= 0) sk.textContent = "S" + (sel[i].s + 1);
        };
        sk.onclick = (ev) => { ev.stopPropagation(); const q = sel.find((q) => q.id === id); q.s = (q.s + 1) % ns; keep(); upd(); };
        c.onclick = () => {
          const i = sel.findIndex((q) => q.id === id);
          if (i >= 0) { sel.splice(i, 1); keep(); go("sandbox"); return; }
          if (sel.length >= 12) return toast("최대 12명까지 편성할 수 있습니다");
          sel.push({ id, s: Math.min(S.ops[id] ? S.ops[id].skill : 0, Math.max(0, ns - 1)) }); keep(); upd(); paint();
        };
        upd(); grid.appendChild(c);
      }
      paint();
    },


    // after a battle: what was earned
    // the results, after the original: the battle blurred behind, the outcome and its medals on the left, the commander's level under them,
    // one of the squad standing on the right; a tap anywhere goes back to the map
    result(el, r) {
      const s = TD.STAGES[r.stageIdx], rw = r.reward || {}, win = r.win;
      const bg = h("div", "rz-bg"); if (r.shot) bg.style.backgroundImage = `url(${r.shot})`; el.appendChild(bg);
      const ids = squadIds().filter((id) => S.ops[id]), withArt = ids.filter((id) => def(id).art), pick = (withArt.length ? withArt : ids)[Math.floor(Math.random() * Math.max(1, (withArt.length ? withArt : ids).length))] || S.assistant;
      const a = h("img", "rz-art" + (def(pick).art ? "" : " chibi")); a.src = opArt(pick, "full"); el.appendChild(a);
      el.appendChild(h("div", "rz-dim"));
      el.appendChild(h("div", "rz-wm", EMBLEM_SVG));
      const hexes = [0, 1, 2].map((i) => `<svg viewBox="0 0 60 66" class="${i < r.stars ? "on" : ""}" style="animation-delay:${0.35 + i * 0.18}s"><path d="M30 2l26 15v32L30 64 4 49V17z"/><path class="in" d="M30 14l6 12h-12zM18 38l6-12 6 12zM42 38l-6-12-6 12zM30 33v-7M24 38l6-5 6 5"/></svg>`).join("");
      const need = playerExpNeed(), f = Math.min(1, S.exp / need), f0 = rw.lvup ? 0 : Math.max(0, (S.exp - (rw.exp || 0)) / need);
      const items = [rw.coin && ["coin", rw.coin], rw.orb && ["orb", rw.orb], rw.refund && ["stam", rw.refund], ...(rw.items || [])].filter(Boolean)
        .map(([k, n]) => `<div class="rz-it t${(ITEM[k] || {}).tier || 0}">${icn(ITEM[k].ic)}<b class="en">+${fmt(n)}</b></div>`).join("");
      const box = h("div", "rz-l", `<div class="rz-op"><small class="en">OPERATION</small><b class="en">${esc(s.code)}</b></div>
        <div class="rz-nm">${esc(s.name)}</div>
        <div class="rz-big">${win ? "작전 종료" : "작전 실패"}</div>
        <div class="rz-en en${win ? "" : " bad"}">${win ? "MISSION RESULTS" : "MISSION FAILED"}</div>
        ${win ? `<div class="rz-md">${hexes}</div>` : ""}`);
      el.appendChild(box);
      const lv = h("div", "rz-lv", `<div class="n en"><small>LV</small>${S.lvl}</div><div class="rz-exp"><i style="width:${(f0 * 100).toFixed(1)}%"></i><span class="en"><small>EXP</small> ${fmt(S.exp)}<em>/${fmt(need)}</em></span></div>${rw.lvup ? '<div class="up en">LEVEL UP</div>' : ""}`);
      el.appendChild(lv);
      if (items) el.appendChild(h("div", "rz-rw", items));
      requestAnimationFrame(() => requestAnimationFrame(() => { const i = lv.querySelector(".rz-exp i"); if (i) i.style.width = (f * 100).toFixed(1) + "%"; }));
      const tap = h("div", "rz-tap"); el.appendChild(tap);
      setTimeout(() => { tap.onclick = () => toStage(r.stageIdx); }, 600);   // not on the tap that ended the battle
    },
  };

  // ---------- the squad picker, after the original: class tabs and sorting on the left and top, numbered picks in the grid,
  // and on the right the one in focus, whose skill is chosen right there ----------
  const PICK_CLS = [["전체", null, "guard"], ["선봉", "선봉", "vanguard"], ["근위", "근위", "guard"], ["중장", "중장", "defender"], ["저격", "저격", "sniper"], ["술사", "술사", "caster"], ["의무", "의무", "medic"], ["보조", "보조", "supporter"], ["특수", "특수", "specialist"]];
  const pickState = { cls: null, sort: "lvl" };
  let rsMark = null;   // while set, the list shows only these (the ones the orange button gathered)
  const pickOrder = () => {
    const ids = Object.keys(S.ops).filter((id) => def(id) && (!pickState.cls || def(id).cls === pickState.cls));
    const key = { lvl: (id) => S.ops[id].elite * 1000 + S.ops[id].lvl, rar: (id) => def(id).rarity * 100000 + S.ops[id].elite * 1000 + S.ops[id].lvl, got: (id) => S.ops[id].got || 0 }[pickState.sort];
    return ids.sort((a, b) => key(b) - key(a) || def(b).rarity - def(a).rarity || a.localeCompare(b));
  };
  // the squad picker, after the original: on the left a light panel for the one in focus (name, level, numbers, and its skills to choose
  // from), the cards in two rows on the right, picks framed in blue with their order in big numerals; clear and confirm along the bottom
  function pickSquad(el, arg) {
    el.appendChild(h("div", "lt-bg"));
    const picked = (S.squads[S.cur] || []).filter((id) => S.ops[id]).slice(0, 12);
    // one: opened from a single slot. The slot's operator starts selected on the left (skills a tap away); tapping another card
    // puts them in that slot instead (one already in the squad trades places with it). The quick-squad button opens the whole selection
    const one = !!arg.one, slot = Math.min(arg.slot || 0, picked.length);
    let focus = picked[arg.slot] || (one ? null : picked[0]) || null, ptab = "skill", clsOpen = false;
    const panel = h("div", "pk-l"); el.appendChild(panel);
    el.appendChild(topBar("", "", () => backToSquad(arg.ret), { res: false }));
    const bar = h("div", "rs-sort pk-sort2"); el.appendChild(bar);
    const clsRow = h("div", "pk-clsrow"); el.appendChild(clsRow);
    const grid = h("div", "pk-grid2"); el.appendChild(grid);
    grid.addEventListener("wheel", (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { grid.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
    const clr = h("div", "btn pk-clr", `<i><svg viewBox="0 0 24 24"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15" fill="none" stroke="#fff" stroke-width="2"/></svg></i><span>${one ? "이 칸 비우기" : "선택 초기화"}</span>`);
    clr.onclick = () => { if (one) { if (picked[slot]) picked.splice(slot, 1); focus = null; } else picked.length = 0; draw(); }; el.appendChild(clr);
    if (one) el.appendChild(h("div", "pk-onehint", `<b class="en">${slot + 1}</b>번 칸 · 다른 가사인격을 누르면 이 칸이 바뀝니다`));
    const ok = h("div", "btn pk-ok2", `<i><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="#fff"/><path d="M12 20l6 6 10-11" fill="none" stroke="#1d8bd0" stroke-width="3.6"/></svg></i><span>확인</span>`);
    ok.onclick = () => { S.squads[S.cur] = picked.slice(); save(); backToSquad(arg.ret); }; el.appendChild(ok);
    const SORTS = [["lvl", "레벨"], ["rar", "적성"], ["got", "획득"]];
    const draw = () => {
      bar.innerHTML = `<div class="rk">${ICON.rook}</div>`;
      SORTS.forEach(([k, lab], i) => { const on = pickState.sort === k; const b = h("div", "btn" + (on ? " on" : ""), `${lab}${on ? "<i></i>" : ""}`); b.onclick = () => { pickState.sort = k; draw(); }; if (i) bar.appendChild(h("b", "")); bar.appendChild(b); });
      const cb = h("div", "btn pk-cb" + (pickState.cls ? " on" : ""), `직군<span>≡</span>`); cb.onclick = () => { clsOpen = !clsOpen; draw(); }; bar.appendChild(cb);
      clsRow.innerHTML = ""; clsRow.hidden = !clsOpen;
      for (const [lab, cls, rep] of PICK_CLS) { const on = pickState.cls === cls; const b = h("div", "btn" + (on ? " on" : ""), cls ? `<img src="${clsIcon(rep, 24, on ? "#4fc3ff" : "#fff")}" alt="${lab}" title="${lab}">` : `<b class="en">ALL</b>`); b.onclick = () => { pickState.cls = cls; draw(); grid.scrollLeft = 0; }; clsRow.appendChild(b); }
      grid.innerHTML = "";
      for (const id of pickOrder()) {
        const c = opCard(id), at = picked.indexOf(id);
        if (at >= 0) { c.classList.add("pk-on"); c.appendChild(h("div", "pk-num en", String(at + 1))); if (one && at !== slot) c.classList.add("pk-other"); }
        if (id === focus) c.classList.add("pk-focus");
        if (one) c.onclick = () => {
          const k = picked.indexOf(id);
          if (k === slot) { focus = id; return draw(); }   // the one already here: just show them
          if (k < 0) { const twin = picked.find((q, j) => j !== slot && sameSelf(q, id)); if (twin) return toast("같은 인물의 다른 모습은 함께 편성할 수 없습니다"); }
          if (k >= 0) { picked[k] = picked[slot]; picked[slot] = id; if (!picked[k]) picked.splice(k, 1); }   // trade places
          else if (slot < picked.length) picked[slot] = id; else picked.push(id);
          focus = id; draw();
        };
        else c.onclick = () => {
          const k = picked.indexOf(id);
          if (k < 0) {
            const twin = picked.find((q) => sameSelf(q, id)); if (twin) return toast("같은 인물의 다른 모습은 함께 편성할 수 없습니다");
            if (picked.length >= 12) return toast("최대 12명까지 편성할 수 있습니다");
            picked.push(id); focus = id;
          } else { picked.splice(k, 1); focus = id; }   // a picked card comes off at the first tap, as in the original
          draw();
        };
        grid.appendChild(c);
      }
      drawPanel();
    };
    const drawPanel = () => {
      panel.innerHTML = "";
      if (!focus) { panel.appendChild(h("div", "pk-empty2", "가사인격을 선택하세요")); return; }
      const d = def(focus), o = S.ops[focus], n = nm(focus), sv = odStats(focus, o.elite, o.lvl);
      const head = h("div", "pk-hd", `<small class="en">${esc(d.nameEn && n.revealed ? d.nameEn : n.ruby || "")}</small><div class="nm"><b>${esc(n.main)}</b><span class="en"><i>LV</i>${o.lvl}<em>/${maxLv(focus, o.elite)}</em></span></div>`);
      const grow = h("div", "btn pk-grow", `<i>${ICON.rook}</i>육성하기`); grow.onclick = () => go("opdetail", focus); head.appendChild(grow);
      panel.appendChild(head);
      const cell = (ic, v, w) => `<div><i>${STAT_IC[ic]}</i><b class="${w ? "w" : "en"}">${v}</b></div>`;
      panel.appendChild(h("div", "pk-st", `<div class="rg">${rangeBox(TD.rangeKeyOf(d, o.elite))}<span>공격 범위</span></div>
        <div class="g">${cell("hp", sv.hp)}${cell("rd", rdWord(sv.rd), 1)}${cell("atk", sv.atk)}${cell("cost", sv.cost)}${cell("def", sv.def)}${cell("blk", sv.block)}${cell("res", sv.res)}${cell("spd", spdWord(sv.interval), 1)}</div>`));
      const tabs = h("div", "pk-tabs");
      for (const [k, lab] of [["skill", "스킬"], ["sub", "세부분류+"]]) { const b = h("div", "btn" + (ptab === k ? " on" : ""), lab); b.onclick = () => { ptab = k; drawPanel(); }; tabs.appendChild(b); }
      panel.appendChild(tabs);
      const body = h("div", "pk-body"); panel.appendChild(body);
      if (ptab === "skill") d.skills.forEach((sk, k) => {
        const lock = k > o.elite && r4(d), on = o.skill === k;
        const row = h("div", "btn pk-skr" + (on ? " on" : "") + (lock ? " lock" : ""), `<div class="ic">${skIcon(d, k)}<span class="en">⚡${sk.sp}</span></div><div class="tx"><div class="tg">${skTags(sk)}</div><div class="nm">${esc(sk.name)}</div><div class="ds">${lock ? `정예화 ${k} 이후 사용 가능` : kwHtml(TD.skillDesc(skAt(focus, k)))}</div></div>`);
        row.onclick = (ev) => { if (ev.target.closest(".kw")) return; if (lock) return toast(`정예화 ${k} 이후 사용 가능`); o.skill = k; save(); draw(); };
        body.appendChild(row);
      });
      else {
        if (d.sub) body.appendChild(h("div", "pk-tr", `<div class="h"><img src="${clsIcon(focus, 18, "#222")}" alt=""> ${esc(d.cls)} · ${esc(d.sub)}</div><p>${kwHtml((ST()[d.sub] || {}).desc || "")}</p>`));
        (d.talents || [d.talent]).filter(Boolean).forEach((T) => body.appendChild(h("div", "pk-tr" + ((T.elite || 0) > o.elite ? " lk" : ""), `<div class="h"><span>${esc(T.name)}</span></div><p>${kwHtml(T.desc)}</p>`)));
      }
    };
    draw();
  }
  // picking someone for a slot returns to wherever the slot was opened from: the pre-battle check, or the squad screen
  function backToSquad(ret) { if (ret && ret.prep !== undefined) go("prep", ret.prep); else go("squads", ret || {}); }
  // the elite emblem, drawn: a plain chevron, a doubled one, and the winged mark of the final promotion
  // the promotion marks, after the original: nothing at E0, a crossed stroke at E1, the doubled crossed chevrons at E2
  const ELITE_SVG = [
    `<svg viewBox="0 0 40 32"><path d="M8 9l12 12 12-12" fill="none" stroke="currentColor" stroke-width="2.4" opacity=".7"/></svg>`,
    `<svg viewBox="0 0 40 32"><g stroke="currentColor" stroke-width="5" stroke-linecap="butt"><path d="M5 3l24 26"/><path d="M35 3L14 26"/></g></svg>`,
    `<svg viewBox="0 0 40 32"><g fill="none" stroke="currentColor" stroke-linecap="butt"><path d="M3 3l19 26" stroke-width="4.6"/><path d="M37 3L18 29" stroke-width="4.6"/><path d="M11 3l9 12.5L29 3" stroke-width="4"/></g><path d="M20 15.5l-3.2-4.4h6.4z" fill="currentColor"/></svg>`];
  const eliteMark = (e, cls = "") => `<i class="emk e${e} ${cls}">${ELITE_SVG[e] || ELITE_SVG[0]}</i>`;
  // the level dial: the arc is how far into this promotion's levels; it turns gold at the cap
  function lvRing(lv, max, size = 46) {
    const r = size / 2 - 3, C = 2 * Math.PI * r, f = Math.max(0.02, Math.min(1, lv / max)), full = lv >= max;
    return `<div class="lvr${full ? " max" : ""}" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="tk"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ar" stroke-dasharray="${(C * f).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><b>LV</b><span class="en">${lv}</span></div>`;
  }
  const potMark = (p) => p > 1 ? `<div class="pmk en" title="잠재 ${p}">${p}</div>` : "";
  // an operator card after the original: tall art; the class box and stars on top; below, a glow (gold dots at E2) under a black wedge
  // that carries the level dial, the skill in use and the name; the promotion mark sits big on the seam
  function opCard(id) {
    const d = def(id), o = S.ops[id], n = nm(id), mL = maxLv(id, o.elite);
    const c = h("div", "btn oc e" + o.elite + " r" + d.rarity);
    c.style.setProperty("--rc", RAR_COL[d.rarity]);
    c.innerHTML = `<div class="oc-art"><img src="${opArt(id, "card")}" alt=""></div><div class="oc-glow"></div><div class="oc-wedge"></div>
      <div class="oc-top"><i><img src="${clsIcon(id, 22)}" alt=""></i><span>${"★".repeat(d.rarity)}</span></div>
      ${o.elite ? `<div class="oc-em">${ELITE_SVG[o.elite]}</div>` : ""}${(o.pot || 1) > 1 ? `<div class="oc-pt en">${o.pot}</div>` : ""}
      <div class="oc-lv">${lvRing(o.lvl, mL, 38)}</div><div class="oc-sk">${skIcon(d, o.skill || 0)}</div>
      <div class="oc-n">${esc(n.main)}</div>${(S.fresh || {})[id] ? `<div class="oc-mk" title="새로 링크했거나 잠재능력이 올랐습니다"></div>` : ""}`;
    return c;
  }
  const OPS_IC = {
    main: `<svg viewBox="0 0 40 40"><path d="M6 8h12l2 3h14v21H6z" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M12 20h16M12 26h10" stroke="currentColor" stroke-width="2.6"/></svg>`,
    drill: `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="13" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="20" cy="20" r="5" fill="currentColor"/><path d="M20 3v8M20 29v8M3 20h8M29 20h8" stroke="currentColor" stroke-width="2.6"/></svg>`,
    sup: `<svg viewBox="0 0 40 40"><path d="M6 14l14-8 14 8v14l-14 8-14-8z" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M6 14l14 8 14-8M20 22v14" stroke="currentColor" stroke-width="2.6" fill="none"/></svg>`,
    ann: `<svg viewBox="0 0 40 40"><path d="M20 4l4 10 11 1-8 7 3 11-10-6-10 6 3-11-8-7 11-1z" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>`,
    ev: `<svg viewBox="0 0 40 40"><path d="M8 6h24v28l-12-7-12 7z" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M14 14h12M14 20h8" stroke="currentColor" stroke-width="2.6"/></svg>`,
  };
  const odOpen = { id: null, at: -1, br: false };   // which skill is unfolded on the operator file
  const MOD_IC = `<svg viewBox="0 0 30 30"><path d="M15 3l10 6v12l-10 6-10-6V9z" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15 9l5 3v6l-5 3-5-3v-6z" fill="currentColor"/></svg>`;
  // the bottom row of the operations rooms: bare icons; the one you are in shows its name in a diamond with a marker above
  function opsNav(el, at) {
    const nav = h("div", "oh-nav2" + (at === "story" ? " dk" : "")); el.appendChild(nav);
    const NAV = [["ops", "작전", OPS_IC.ev, () => go("ops")], ["story", "스토리", OPS_IC.main, () => go("chapters")], ["supply", "자원 수집", OPS_IC.sup, () => go("supply")], ["drill", "훈련장", OPS_IC.drill, () => go("sandbox")]];
    NAV.forEach(([k, lab, ic, fn], i) => { const b = h("div", "btn" + (k === at ? " on" : ""), `<i>${ic}</i><b>${lab}</b>`); b.style.left = (128 + i * 220) + "px"; b.onclick = k === at ? null : fn; nav.appendChild(b); });
  }
  // ---------- drawn icons, kept in one sprite: items with facets, rims and glints; medals; the lens; the story badge ----------
  const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <linearGradient id="g-orb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc58a"/><stop offset=".45" stop-color="#ff6d2c"/><stop offset="1" stop-color="#b52a0a"/></linearGradient>
    <linearGradient id="g-rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4c2"/><stop offset=".45" stop-color="#e0ad3a"/><stop offset="1" stop-color="#7c4f0c"/></linearGradient>
    <linearGradient id="g-face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6d064"/><stop offset="1" stop-color="#b9801a"/></linearGradient>
    <linearGradient id="g-stam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8f0ff"/><stop offset=".5" stop-color="#2fa8e2"/><stop offset="1" stop-color="#11558f"/></linearGradient>
    <linearGradient id="g-tk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#b9d6de"/></linearGradient>
    <linearGradient id="g-exp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f88a"/><stop offset=".55" stop-color="#c6d82c"/><stop offset="1" stop-color="#6f8a12"/></linearGradient>
    <linearGradient id="g-md" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fdcff"/><stop offset=".5" stop-color="#1c9fe0"/><stop offset="1" stop-color="#0b5f9c"/></linearGradient>
    <radialGradient id="g-glass" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity=".05"/></radialGradient>
    <symbol id="it-orb" viewBox="0 0 64 64"><path d="M32 3 55 25 32 61 9 25z" fill="url(#g-orb)"/><path d="M32 3 55 25 32 31z" fill="#ffe2c4" opacity=".55"/><path d="M32 3 9 25 32 31z" fill="#fff" opacity=".38"/>
      <path d="M9 25 32 31v30z" fill="#6e1704" opacity=".35"/><path d="M55 25 32 31v30z" fill="#a52f0a" opacity=".22"/><path d="M32 3 55 25 32 61 9 25z" fill="none" stroke="#4a1203" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M17 22l7-8" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="44" cy="40" r="1.6" fill="#fff" opacity=".8"/></symbol>
    <symbol id="it-coin" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="url(#g-rim)"/><circle cx="32" cy="32" r="28" fill="none" stroke="#5e3a06" stroke-width="1.4"/><circle cx="32" cy="32" r="21" fill="url(#g-face)"/>
      <circle cx="32" cy="32" r="18.5" fill="none" stroke="#fff3c6" stroke-width="1.2" opacity=".7"/><path d="M32 16l9 9-9 23-9-23z" fill="#7c4f0c" opacity=".85"/><path d="M32 16l9 9h-9z" fill="#fff4c2" opacity=".75"/>
      <path d="M12 27a21 21 0 0 1 14-14" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".75"/></symbol>
    <symbol id="it-stam" viewBox="0 0 64 64"><path d="M32 3l25 14.5v29L32 61 7 46.5v-29z" fill="url(#g-stam)"/><path d="M32 3l25 14.5v29L32 61 7 46.5v-29z" fill="none" stroke="#0a3a63" stroke-width="1.6"/>
      <path d="M32 9l20 11.5v23L32 55 12 43.5v-23z" fill="none" stroke="#dff7ff" stroke-width="1.2" opacity=".55"/><path d="M36 13 21 35h10l-4 16 16-23H33z" fill="#fff" stroke="#0a3a63" stroke-width="1.6" stroke-linejoin="round"/></symbol>
    <symbol id="it-ticket" viewBox="0 0 64 64"><g transform="rotate(-14 32 32)"><path d="M8 16h48v10a6 6 0 0 0 0 12v10H8V38a6 6 0 0 0 0-12z" fill="url(#g-tk)" stroke="#2c5560" stroke-width="1.6"/>
      <path d="M8 16h48v7H8z" fill="#2fb3bf"/><path d="M40 23v25" stroke="#2c5560" stroke-width="1.2" stroke-dasharray="3 3"/><path d="M24 26l7 7-7 7-7-7z" fill="#2c5560"/><path d="M24 29l4 4-4 4-4-4z" fill="#2fb3bf"/></g></symbol>
    <symbol id="it-exp" viewBox="0 0 64 64"><path d="M10 14h38l8 8v28H10z" fill="url(#g-exp)" stroke="#3d4d08" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 40h46v10H10z" fill="#2b2f1a" opacity=".85"/>
      <text x="33" y="48.5" text-anchor="middle" font-family="Oswald,sans-serif" font-size="10" font-weight="700" fill="#e9f56a">EXP</text><path d="M18 22h20M18 28h14M18 34h22" stroke="#3d4d08" stroke-width="2.4" opacity=".6"/></symbol>
    <symbol id="md-on" viewBox="0 0 44 48"><path d="M22 2l19 11v22L22 46 3 35V13z" fill="url(#g-md)" stroke="#c8f2ff" stroke-width="1.6"/><path d="M22 7l15 8.6v17L22 41 7 32.6v-17z" fill="none" stroke="#fff" stroke-width="1" opacity=".45"/>
      <g fill="#fff"><path d="M22 13l2.6 6.5L22 22l-2.6-2.5z"/><path d="M22 35l-2.6-6.5L22 26l2.6 2.5z"/><path d="M12 18.5l6.8 1.6 1.2 3.4-3.6.4z"/><path d="M32 29.5l-6.8-1.6-1.2-3.4 3.6-.4z"/><path d="M32 18.5l-4.3 5.4-3.6-.4 1.2-3.4z"/><path d="M12 29.5l4.3-5.4 3.6.4-1.2 3.4z"/><circle cx="22" cy="24" r="2.2"/></g></symbol>
    <symbol id="md-off" viewBox="0 0 44 48"><path d="M22 2l19 11v22L22 46 3 35V13z" fill="rgba(10,12,16,.55)" stroke="#e8eaee" stroke-width="2"/>
      <g fill="rgba(255,255,255,.3)"><path d="M22 13l2.6 6.5L22 22l-2.6-2.5z"/><path d="M22 35l-2.6-6.5L22 26l2.6 2.5z"/><path d="M12 18.5l6.8 1.6 1.2 3.4-3.6.4z"/><path d="M32 29.5l-6.8-1.6-1.2-3.4 3.6-.4z"/><path d="M32 18.5l-4.3 5.4-3.6-.4 1.2-3.4z"/><path d="M12 29.5l4.3-5.4 3.6.4-1.2 3.4z"/><circle cx="22" cy="24" r="2.2"/></g></symbol>
    <symbol id="ic-lens" viewBox="0 0 48 48"><circle cx="20" cy="20" r="13" fill="url(#g-glass)"/><circle cx="20" cy="20" r="13" fill="none" stroke="#fff" stroke-width="4.6"/>
      <path d="M13 15a8 8 0 0 1 6-5" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none" opacity=".8"/><path d="M30 30l4 4" stroke="#fff" stroke-width="5"/><path d="M33 33l10 10" stroke="#fff" stroke-width="8" stroke-linecap="round"/></symbol>
    <symbol id="ic-story" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#f2f3f4"/><circle cx="32" cy="32" r="30" fill="none" stroke="#b9bcc1" stroke-width="2"/><circle cx="32" cy="32" r="24" fill="none" stroke="#d6d8dc" stroke-width="1.2"/>
      <path d="M14 22c6-3 12-3 17 1v22c-5-4-11-4-17-1z" fill="#2a2b2e"/><path d="M50 22c-6-3-12-3-17 1v22c5-4 11-4 17-1z" fill="#2a2b2e"/><path d="M18 27c3-1 6-1 9 1M18 32c3-1 6-1 9 1M37 28c3-2 6-2 9-1M37 33c3-2 6-2 9-1" stroke="#f2f3f4" stroke-width="1.4" fill="none"/></symbol>
    <symbol id="wm-net" viewBox="0 0 120 50"><g fill="none" stroke="currentColor" stroke-width="2"><path d="M20 30 L40 8 L60 4 L80 8 L100 30 L80 40 L60 42 L40 40 Z M40 8 L60 22 L80 8 M20 30 L60 22 L100 30 M40 40 L60 22 L80 40 M60 4 L60 22"/></g><g fill="currentColor"><circle cx="60" cy="22" r="3"/><circle cx="40" cy="8" r="2"/><circle cx="80" cy="8" r="2"/><circle cx="20" cy="30" r="2"/><circle cx="100" cy="30" r="2"/></g></symbol>
    <linearGradient id="g-t1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b6e36a"/><stop offset=".55" stop-color="#5f8f1c"/><stop offset="1" stop-color="#33520a"/></linearGradient>
    <symbol id="it-bm1" viewBox="0 0 64 64"><g stroke="#33520a" stroke-width="1.6"><rect x="6" y="38" width="52" height="16" rx="7" fill="url(#g-t1)"/><rect x="12" y="24" width="40" height="16" rx="7" fill="url(#g-t1)"/></g><path d="M10 12h44v8H10z" fill="#c9a36a" stroke="#6b4e22" stroke-width="1.4"/><path d="M14 16h36" stroke="#6b4e22" stroke-width="1" opacity=".6"/><path d="M14 44c6 2 30 2 36 0M18 30c6 2 22 2 28 0" stroke="#fff" stroke-width="1.6" fill="none" opacity=".45"/></symbol>
    <symbol id="it-bm2" viewBox="0 0 64 64"><g stroke="#124f86" stroke-width="1.6"><path d="M6 14h52v8H38v20h20v8H6v-8h20V22H6z" fill="url(#g-t2)"/></g><path d="M8 16h48" stroke="#fff" stroke-width="1.6" opacity=".5"/><circle cx="12" cy="46" r="1.8" fill="#e9eef2"/><circle cx="52" cy="46" r="1.8" fill="#e9eef2"/><circle cx="12" cy="18" r="1.8" fill="#e9eef2"/><circle cx="52" cy="18" r="1.8" fill="#e9eef2"/></symbol>
    <symbol id="it-perm" viewBox="0 0 64 64"><rect x="10" y="8" width="44" height="50" rx="3" fill="url(#g-t2)" stroke="#124f86" stroke-width="1.6"/><rect x="16" y="14" width="32" height="22" fill="#e8f6ff" opacity=".9"/><path d="M22 30l6-10 4 6 3-4 5 8z" fill="#1a6f9c"/><path d="M16 42h32M16 48h22" stroke="#fff" stroke-width="2.4" opacity=".8"/><circle cx="46" cy="49" r="5" fill="#ffd36a" stroke="#8a6a00"/></symbol>
    <symbol id="it-rush" viewBox="0 0 64 64"><path d="M32 6l20 10v18c0 12-9 20-20 24C21 54 12 46 12 34V16z" fill="url(#g-t3)" stroke="#5a2a86" stroke-width="1.6"/><path d="M35 14L22 36h10l-3 16 14-24H33z" fill="#fff6c8" stroke="#8a6a00" stroke-width="1.2"/></symbol>
    <symbol id="it-rec1" viewBox="0 0 64 64"><path d="M8 16h18l5 5h25v31H8z" fill="url(#g-t1)" stroke="#33520a" stroke-width="1.6"/><rect x="14" y="28" width="36" height="16" fill="#1d2228" opacity=".85"/><g fill="#e9eef2"><rect x="16" y="30" width="4" height="3"/><rect x="16" y="39" width="4" height="3"/><rect x="23" y="30" width="4" height="3"/><rect x="23" y="39" width="4" height="3"/><rect x="30" y="30" width="4" height="3"/><rect x="30" y="39" width="4" height="3"/><rect x="37" y="30" width="4" height="3"/><rect x="37" y="39" width="4" height="3"/><rect x="44" y="30" width="4" height="3"/><rect x="44" y="39" width="4" height="3"/></g><path d="M8 16h18l5 5H8z" fill="#fff" opacity=".35"/></symbol>
    <symbol id="it-book1" viewBox="0 0 64 64"><path d="M12 10h34a6 6 0 0 1 6 6v38H18a6 6 0 0 1-6-6z" fill="url(#g-t1)" stroke="#33520a" stroke-width="1.6"/><path d="M12 48a6 6 0 0 0 6 6h34v-6z" fill="#f2f0e6"/><path d="M24 20h20M24 26h14" stroke="#fff" stroke-width="2.6" opacity=".75"/><text x="34" y="44" font-size="13" font-weight="900" text-anchor="middle" fill="#fff" font-family="serif">Ⅰ</text></symbol>
    <linearGradient id="g-t2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fd2ff"/><stop offset=".55" stop-color="#2f8fd8"/><stop offset="1" stop-color="#124f86"/></linearGradient>
    <symbol id="it-rec2" viewBox="0 0 64 64"><path d="M8 16h18l5 5h25v31H8z" fill="url(#g-t2)" stroke="#124f86" stroke-width="1.6"/><rect x="14" y="28" width="36" height="16" fill="#1d2228" opacity=".85"/><g fill="#e9eef2"><rect x="16" y="30" width="4" height="3"/><rect x="16" y="39" width="4" height="3"/><rect x="23" y="30" width="4" height="3"/><rect x="23" y="39" width="4" height="3"/><rect x="30" y="30" width="4" height="3"/><rect x="30" y="39" width="4" height="3"/><rect x="37" y="30" width="4" height="3"/><rect x="37" y="39" width="4" height="3"/><rect x="44" y="30" width="4" height="3"/><rect x="44" y="39" width="4" height="3"/></g><path d="M8 16h18l5 5H8z" fill="#fff" opacity=".35"/></symbol>
    <symbol id="it-book2" viewBox="0 0 64 64"><path d="M12 10h34a6 6 0 0 1 6 6v38H18a6 6 0 0 1-6-6z" fill="url(#g-t2)" stroke="#124f86" stroke-width="1.6"/><path d="M12 48a6 6 0 0 0 6 6h34v-6z" fill="#f2f0e6"/><path d="M24 20h20M24 26h14" stroke="#fff" stroke-width="2.6" opacity=".75"/><text x="34" y="44" font-size="13" font-weight="900" text-anchor="middle" fill="#fff" font-family="serif">Ⅱ</text></symbol>
    <linearGradient id="g-t3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d6b2ff"/><stop offset=".55" stop-color="#9a5ee0"/><stop offset="1" stop-color="#552a8f"/></linearGradient>
    <symbol id="it-rec3" viewBox="0 0 64 64"><path d="M8 16h18l5 5h25v31H8z" fill="url(#g-t3)" stroke="#552a8f" stroke-width="1.6"/><rect x="14" y="28" width="36" height="16" fill="#1d2228" opacity=".85"/><g fill="#e9eef2"><rect x="16" y="30" width="4" height="3"/><rect x="16" y="39" width="4" height="3"/><rect x="23" y="30" width="4" height="3"/><rect x="23" y="39" width="4" height="3"/><rect x="30" y="30" width="4" height="3"/><rect x="30" y="39" width="4" height="3"/><rect x="37" y="30" width="4" height="3"/><rect x="37" y="39" width="4" height="3"/><rect x="44" y="30" width="4" height="3"/><rect x="44" y="39" width="4" height="3"/></g><path d="M8 16h18l5 5H8z" fill="#fff" opacity=".35"/><path d="M44 8l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L35 15l6-1z" fill="#fff4b8"/></symbol>
    <symbol id="it-book3" viewBox="0 0 64 64"><path d="M12 10h34a6 6 0 0 1 6 6v38H18a6 6 0 0 1-6-6z" fill="url(#g-t3)" stroke="#552a8f" stroke-width="1.6"/><path d="M12 48a6 6 0 0 0 6 6h34v-6z" fill="#f2f0e6"/><path d="M24 20h20M24 26h14" stroke="#fff" stroke-width="2.6" opacity=".75"/><text x="34" y="44" font-size="13" font-weight="900" text-anchor="middle" fill="#fff" font-family="serif">Ⅲ</text></symbol>
    <linearGradient id="g-chip" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8f3f8"/><stop offset=".5" stop-color="#8fb0c4"/><stop offset="1" stop-color="#3c5566"/></linearGradient>
    <linearGradient id="g-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2b8"/><stop offset=".5" stop-color="#e2b23c"/><stop offset="1" stop-color="#7c560c"/></linearGradient>
    <symbol id="it-chip1" viewBox="0 0 64 64"><g fill="#9aa8b2"><rect x="18" y="8" width="3" height="8"/><rect x="18" y="48" width="3" height="8"/><rect x="8" y="18" width="8" height="3"/><rect x="48" y="18" width="8" height="3"/><rect x="26" y="8" width="3" height="8"/><rect x="26" y="48" width="3" height="8"/><rect x="8" y="26" width="8" height="3"/><rect x="48" y="26" width="8" height="3"/><rect x="34" y="8" width="3" height="8"/><rect x="34" y="48" width="3" height="8"/><rect x="8" y="34" width="8" height="3"/><rect x="48" y="34" width="8" height="3"/><rect x="42" y="8" width="3" height="8"/><rect x="42" y="48" width="3" height="8"/><rect x="8" y="42" width="8" height="3"/><rect x="48" y="42" width="8" height="3"/></g><rect x="14" y="14" width="36" height="36" rx="4" fill="url(#g-chip)" stroke="#2a3a46" stroke-width="1.6"/><rect x="22" y="22" width="20" height="20" fill="#26343e"/><path d="M26 32h12M32 26v12" stroke="#7fe3ff" stroke-width="2.4"/></symbol>
    <symbol id="it-chip2" viewBox="0 0 64 64"><rect x="10" y="22" width="40" height="34" rx="4" fill="#7c560c"/><rect x="14" y="16" width="40" height="34" rx="4" fill="#b8892a"/><rect x="18" y="10" width="40" height="34" rx="4" fill="url(#g-gold)" stroke="#5a3d08" stroke-width="1.6"/><rect x="28" y="18" width="20" height="18" fill="#3a2a08"/><path d="M32 27h12M38 21v12" stroke="#ffe08a" stroke-width="2.4"/></symbol>
    <symbol id="it-shard1" viewBox="0 0 64 64"><path d="M14 40l16-26 8 22z" fill="#f4f2ec" stroke="#8a8478" stroke-width="1.5"/><path d="M36 44l14-18 4 24z" fill="#e2dfd6" stroke="#8a8478" stroke-width="1.5"/><path d="M20 50l10-6 6 10z" fill="#d6d2c8" stroke="#8a8478" stroke-width="1.5"/></symbol>
    <symbol id="it-shard2" viewBox="0 0 64 64"><path d="M14 18c8-8 28-8 36 0 2 14-2 30-18 38C16 48 12 32 14 18z" fill="#f6f4ee" stroke="#6f6a60" stroke-width="1.8"/><path d="M22 28h7M35 28h7" stroke="#1b1d22" stroke-width="3.5" stroke-linecap="round"/><path d="M32 10l-3 12 5 8-4 10 3 12" fill="none" stroke="#5a7aa0" stroke-width="2"/><circle cx="25" cy="28" r="2" fill="#7fd0ff"/><circle cx="39" cy="28" r="2" fill="#7fd0ff"/></symbol>
    <symbol id="it-casing1" viewBox="0 0 64 64"><g transform="rotate(-25 32 32)"><rect x="24" y="14" width="16" height="36" rx="2" fill="#b8892a" stroke="#5c3e08" stroke-width="1.6"/><rect x="22" y="46" width="20" height="6" fill="#8a6418"/><path d="M27 18v26" stroke="#ffe2a0" stroke-width="2" opacity=".6"/><circle cx="30" cy="30" r="3" fill="#6a4a1a" opacity=".6"/><circle cx="35" cy="38" r="2" fill="#7a3a12" opacity=".6"/></g></symbol>
    <symbol id="it-casing2" viewBox="0 0 64 64"><g transform="rotate(-25 32 32)"><path d="M24 26c0-10 4-16 8-18 4 2 8 8 8 18v24H24z" fill="#3b7fd0" stroke="#123a6a" stroke-width="1.6"/><path d="M28 24c0-6 2-10 4-12" stroke="#d8f2ff" stroke-width="2.4" fill="none"/></g><circle cx="32" cy="22" r="10" fill="#7fd0ff" opacity=".35"/></symbol>
    <symbol id="it-frost1" viewBox="0 0 64 64"><path d="M32 8l8 14-8 34-8-34z" fill="#d8f2ff" stroke="#3a7aa8" stroke-width="1.6"/><path d="M14 30l12 4-6 14z" fill="#b8e4ff" stroke="#3a7aa8" stroke-width="1.4"/><path d="M50 26l-10 8 8 12z" fill="#c8ecff" stroke="#3a7aa8" stroke-width="1.4"/><path d="M32 8l3 16" stroke="#fff" stroke-width="2"/></symbol>
    <symbol id="it-frost2" viewBox="0 0 64 64"><path d="M10 24l22-12 22 12v20L32 56 10 44z" fill="#3a3f4a" stroke="#1a1d24" stroke-width="1.6"/><path d="M10 24l22 12 22-12M32 36v20" stroke="#9fdcff" stroke-width="1.6" fill="none"/><path d="M16 22l6 4M40 18l6 4M22 44l4 2" stroke="#e8f8ff" stroke-width="2.4" stroke-linecap="round"/></symbol>
    <symbol id="it-cloth1" viewBox="0 0 64 64"><path d="M14 10v46" stroke="#5a4630" stroke-width="3"/><path d="M16 12c10-4 18 4 32 0v24c-14 4-22-4-32 0z" fill="#c23a3a" stroke="#6a1414" stroke-width="1.5"/><path d="M16 12c10-4 18 4 32 0v8c-14 4-22-4-32 0z" fill="#2a4aa8"/><path d="M40 36l6 8 2-8" fill="#c23a3a"/></symbol>
    <symbol id="it-cloth2" viewBox="0 0 64 64"><path d="M32 14c-4 0-6 4-6 8l-14-6c2 10 8 16 16 18v12h8V34c8-2 14-8 16-18l-14 6c0-4-2-8-6-8z" fill="url(#g-gold)" stroke="#5a3d08" stroke-width="1.6"/><circle cx="32" cy="22" r="2.4" fill="#5a3d08"/><rect x="24" y="48" width="16" height="6" fill="#7c560c"/></symbol>
  </defs></svg>`;
  document.body.insertAdjacentHTML("beforeend", SPRITE);
  // our mark (not the original's): a hexagon holding a link diamond over the line it keeps; the battle draws the same on its canvas
  const EMBLEM_SVG = `<svg viewBox="-100 -100 200 200"><path d="M0-96 83-48v96L0 96-83 48v-96z" fill="#0b0c0e" stroke="#fff" stroke-width="4"/><path d="M0-83 72-41.5v83L0 83-72 41.5v-83z" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.5"/>
    <path d="M0-49 33-16 0 17-33-16z" fill="none" stroke="#fff" stroke-width="7.5"/><path d="M0-28.5 12.5-16 0-3.5-12.5-16z" fill="#fff"/><rect x="-66" y="-18.5" width="24" height="5" fill="#fff"/><rect x="42" y="-18.5" width="24" height="5" fill="#fff"/>
    <text x="0" y="48" fill="#fff" font-family="Oswald, sans-serif" font-weight="700" font-size="20" text-anchor="middle">BLOCKADE</text><text x="0" y="64" fill="rgba(255,255,255,.75)" font-family="Oswald, sans-serif" font-weight="500" font-size="9" text-anchor="middle">TEOHI ARCHIVE · LINE 0614</text></svg>`;
  const icn = (id, cls = "") => {
    if (id.startsWith("chipc-")) { const [, t, rep] = id.split("-");   // a chip: the chip, with its class's mark on the die
      return `<span class="icn chipc t${t} ${cls}"><svg viewBox="0 0 64 64"><use href="#it-chip${t}"/></svg><img src="${clsIcon(rep, 48, t === "2" ? "#ffe08a" : "#9feaff")}" alt=""></span>`; }
    return `<svg class="icn ${cls}" viewBox="0 0 64 64"><use href="#${id}"/></svg>`;
  };
  const CLS_REP = { 선봉: "vanguard", 근위: "guard", 중장: "defender", 저격: "sniper", 술사: "caster", 의무: "medic", 보조: "supporter", 특수: "specialist" };
  const ITEM = {
    orb: { n: "합성옥", ic: "it-orb", d: "아카이브에서 가사인격체와 링크할 때 쓰는 결정. 600개로 링크 1회를 실행할 수 있다.", src: "작전 첫 클리어 · 수신 선물" },
    coin: { n: "주화", ic: "it-coin", d: "가사인격의 레벨업과 정예화에 드는 통화.", src: "작전 클리어 · 받은 별이 많을수록 더 많이" },
    stam: { n: "기력", ic: "it-stam", d: "작전을 개시할 때 소모한다. 6분마다 1씩 회복되고, 수신자 레벨이 오르면 가득 찬다.", src: "시간 경과 · 레벨 업" },
    ticket: { n: "아카이브 수신권", ic: "it-ticket", d: "합성옥 없이 아카이브 링크 1회를 실행한다.", src: "수신 선물" },
    start: { n: "스타트 수신권", ic: "it-ticket", d: "처음 한 번, 10회 연속 링크를 실행한다.", src: "수신 중단 보상" },
    exp: { n: "수신자 경험치", ic: "it-exp", d: "수신자 레벨을 올린다. 레벨이 오르면 기력 상한이 늘고 기력이 가득 찬다.", src: "작전 클리어" },
  };
  // a resource's card: what it is, what it is for, where it comes from
  // where an item comes from: each operation that hands it out (sure or by chance), the supply sites for chips, refining for the
  // finer materials — each with a way straight there
  function sourcesOf(k) {
    const out = [], DAYN = "일월화수목금토", today = new Date().getDay();
    if (!EC.ITEMS[k]) return out;
    TD.STAGES.forEach((st, i) => {
      const m = STAGE_META[i]; if (!m || m.lab) return;
      if (m.supply) {
        const sp = EC.SUPPLY[m.supply], keys = EC.supplyKeys(m.supply, m.tier);
        if (!keys.includes(k)) return;
        const days = [1, 2, 3, 4, 5, 6, 0].filter((d) => EC.OPEN[d].includes(m.supply)), on = EC.OPEN[today].includes(m.supply);
        out.push({ kind: "자원 수집", label: `${st.code} ${sp.n}`, tag: on ? "오늘 개방" : days.map((d) => DAYN[d]).join("") + " 개방", hot: on, ok: m.unlock(S), lock: m.unlockAt + " 클리어 필요", go: () => go("supplymap", i), p: on ? 0 : 1 });
        return;
      }
      const dr = EC.DROPS[st.code]; if (!dr) return;
      const f = dr.fixed.find((x) => x[0] === k), r = dr.roll.find((x) => x[0] === k); if (!f && !r) return;
      out.push({ kind: "작전", label: `${st.code} ${st.name}`, tag: f ? `고정 ×${f[1]}` : r[1] >= 0.3 ? "가끔" : r[1] >= 0.12 ? "드묾" : "희귀", hot: !!f, ok: m.unlock(S), lock: "미개방", go: () => go("terminal", i), p: f ? 0 : 1 - r[1] });
    });
    out.sort((a, b) => (b.ok - a.ok) || (a.p - b.p));
    if (k.startsWith("m2_")) out.push({ kind: "창고", label: "가공 · 하위 재료 3개와 주화", tag: "가공 가능", hot: true, ok: true, go: () => go("depot", "mat") });
    return out;
  }
  function itemInfo(k, have, after) {
    const it = ITEM[k]; if (!it) return;
    const m = h("div", "itm-m"); m.onclick = (e) => { if (e.target === m) m.remove(); };
    const srcs = sourcesOf(k);
    m.innerHTML = `<div class="itm-b t${it.tier || 0}"><div class="ic">${icn(it.ic)}</div><div class="tx"><div class="n">${esc(it.n)}</div>${have !== undefined ? `<div class="hv">보유 <b class="en">${fmt(have)}</b></div>` : ""}
      <p>${esc(it.d)}</p>${srcs.length ? `<div class="srcs"><div class="lb">획득 방법</div><div class="sl">${srcs.map((q, i) => `<div class="sr${q.ok ? "" : " lk"}"><span class="kd">${q.kind}</span><b>${esc(q.label)}</b>${q.tag ? `<em class="${q.hot ? "hot" : ""}">${esc(q.tag)}</em>` : ""}<div class="btn sgo" data-i="${i}">${q.ok ? "바로가기 ›" : esc(q.lock || "미개방")}</div></div>`).join("")}</div></div>` : `<div class="src"><span>획득 경로</span>${esc(it.src)}</div>`}</div></div>`;
    m.querySelectorAll(".srcs .sgo").forEach((b) => b.onclick = () => { const q = srcs[+b.dataset.i]; if (!q.ok) return toast(q.lock ? `${q.lock}` : "아직 열리지 않았습니다"); m.remove(); document.querySelectorAll(".itm-m, .modal").forEach((x) => x.remove()); q.go(); });
    const x = h("div", "btn itm-x", "✕"); x.onclick = () => m.remove(); m.firstChild.appendChild(x);
    // a refined material: three of its common grade and some coin make one, here
    if (k.startsWith("m2_")) {
      const lo = "m1_" + k.slice(3), R = EC.REFINE, most = Math.min(Math.floor(inv(lo) / R.need), Math.floor(S.res.coin / R.coin));
      const rf = h("div", "itm-rf", `<div class="lb">가공</div>${itemDot(lo, R.need, { text: `${fmt(inv(lo))}<small>/${R.need}</small>`, short: inv(lo) < R.need })}<div class="idot coin${S.res.coin < R.coin ? " short" : ""}"><i class="cn">₵</i><b class="en">${R.coin}</b></div><i class="ar">→</i>${itemDot(k, 1, { text: "1" })}`);
      const one = h("div", "btn rf" + (most ? "" : " dis"), "1개 가공"), all = h("div", "btn rf" + (most > 1 ? "" : " dis"), `최대 ${Math.max(most, 1)}개`);
      const doIt = (n) => { if (!n) return toast("재료가 부족합니다"); takeItems([[lo, R.need * n]]); S.res.coin -= R.coin * n; addItems([[k, n]]); save(); m.remove(); toast(`${it.n} ${n}개 가공 완료`); after && after(); itemInfo(k, inv(k), after); };
      one.onclick = () => doIt(Math.min(1, most)); all.onclick = () => doIt(most);
      rf.append(one, all); m.firstChild.querySelector(".tx").appendChild(rf);
      wireDots(rf);
    }
    sheet.appendChild(m);
  }
  const HAVE = { orb: () => S.res.orb, coin: () => S.res.coin, stam: () => S.res.stam, ticket: () => S.res.ticket, start: () => S.res.start, exp: () => S.exp };
  // ---------- the growth economy: records, books, chips, materials ----------
  const EC = window.BSL_ECON;
  const icOf = (k, it) => k === "perm" ? "it-perm" : k === "rush" ? "it-rush" : k.startsWith("bm") ? "it-bm" + it.tier : k.startsWith("rec") ? "it-rec" + it.tier : k.startsWith("bk") ? "it-book" + it.tier : k.startsWith("chip_") ? "chipc-1-" + CLS_REP[it.cls] : k.startsWith("pack_") ? "chipc-2-" + CLS_REP[it.cls] : "it-" + k.slice(3) + it.tier;
  for (const k in EC.ITEMS) { ITEM[k] = Object.assign({}, EC.ITEMS[k], { ic: icOf(k, EC.ITEMS[k]) }); HAVE[k] = () => inv(k); }
  const inv = (k) => (S.inv && S.inv[k]) || 0;
  const addItems = (list) => { S.inv = S.inv || {}; for (const [k, n] of list) if (k && n) S.inv[k] = (S.inv[k] || 0) + n; };
  const hasItems = (list) => list.every(([k, n]) => !k || inv(k) >= n);
  const takeItems = (list) => { for (const [k, n] of list) if (k && n) S.inv[k] = inv(k) - n; };
  const mergeItems = (list) => { const m = {}; for (const [k, n] of list) if (k && n) m[k] = (m[k] || 0) + n; return Object.entries(m); };
  // an item in a small circle with a count under it: the shape every cost and reward is drawn in
  const itemDot = (k, n, opt = {}) => `<div class="btn idot t${(ITEM[k] || {}).tier || 1}${opt.short ? " short" : ""}" data-k="${k}"><i>${icn(ITEM[k].ic)}</i><b class="en">${opt.text !== undefined ? opt.text : fmt(n)}</b>${opt.tag ? `<em>${opt.tag}</em>` : ""}</div>`;
  const wireDots = (root) => root.querySelectorAll(".idot").forEach((c) => c.onclick = (e) => { e.stopPropagation(); itemInfo(c.dataset.k, HAVE[c.dataset.k] ? HAVE[c.dataset.k]() : undefined); });
  // ---------- missions: daily (reset at 04:00), weekly (Monday 04:00), and the one-time main line ----------
  const dayKey = (t = Date.now()) => { const d = new Date(t - 4 * HR); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  const weekKey = (t = Date.now()) => { const d = new Date(t - 4 * HR); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dayKey(d.getTime() + 4 * HR); };
  const nextReset = (week) => { const n = new Date(Date.now() - 4 * HR); n.setHours(0, 0, 0, 0); n.setDate(n.getDate() + (week ? 7 - ((n.getDay() + 6) % 7) : 1)); return n.getTime() + 4 * HR; };
  function misState() {
    const m = S.mis || (S.mis = { dk: "", wk: "", d: {}, w: {}, dc: {}, wc: {}, mc: {} });
    const dk = dayKey(), wk = weekKey();
    if (m.dk !== dk) { m.dk = dk; m.d = { login: 1 }; m.dc = {}; }
    if (m.wk !== wk) { m.wk = wk; m.w = {}; m.wc = {}; }
    return m;
  }
  function bump(k, n = 1) { const m = misState(); m.d[k] = (m.d[k] || 0) + n; m.w[k] = (m.w[k] || 0) + n; }
  const DAILY = [
    { id: "login", n: "출근 기록", d: "오늘 처음으로 접속한다", k: "login", goal: 1, rw: [["coin", 1000]] },
    { id: "run3", n: "작전 수행", d: "작전을 3회 클리어한다 (반복 소탕 포함)", k: "run", goal: 3, rw: [["rec1", 3], ["coin", 1500]], go: () => go("ops") },
    { id: "stam", n: "기력 사용", d: "기력을 100 사용한다", k: "stam", goal: 100, rw: [["orb", 200]], go: () => go("ops") },
    { id: "lvup", n: "가사인격 육성", d: "가사인격 레벨업을 1회 한다", k: "lvup", goal: 1, rw: [["rec1", 2]], go: () => go("roster") },
    { id: "supply", n: "자원 수집", d: "자원 수집 작전을 1회 클리어한다", k: "supply", goal: 1, rw: [["coin", 2000]], go: () => go("supply") },
    { id: "collect", n: "기반 물자 수령", d: "기반시설에서 물자를 2회 수령한다", k: "collect", goal: 2, rw: [["bm1", 2]], go: () => go("base") },
    { id: "recruit", n: "공개 링크", d: "공개 링크를 1회 시작한다", k: "recruit", goal: 1, rw: [["coin", 1000], ["perm", 1]], go: () => go("recruit") },
  ];
  const WEEKLY = [
    { id: "w_run", n: "주간 작전", d: "작전을 25회 클리어한다", k: "run", goal: 25, rw: [["orb", 600]], go: () => go("ops") },
    { id: "w_stam", n: "주간 기력", d: "기력을 800 사용한다", k: "stam", goal: 800, rw: [["rec2", 6], ["coin", 8000]], go: () => go("ops") },
    { id: "w_supply", n: "물자 비축", d: "자원 수집 작전을 8회 클리어한다", k: "supply", goal: 8, rw: [["bm1", 6], ["bm2", 1]], go: () => go("supply") },
    { id: "w_collect", n: "기반 운영", d: "기반시설에서 물자를 12회 수령한다", k: "collect", goal: 12, rw: [["coin", 12000]], go: () => go("base") },
    { id: "w_recruit", n: "회선 개방", d: "공개 링크를 6회 시작한다", k: "recruit", goal: 6, rw: [["perm", 4], ["rush", 1]], go: () => go("recruit") },
    { id: "w_daily", n: "성실 근무", d: "일일 임무 보상을 20회 받는다", k: "dailyDone", goal: 20, rw: [["orb", 600], ["ticket", 1]] },
  ];
  const cleared = (code) => ((S.stages[code] || {}).stars || 0) > 0;
  const opsWith = (f) => Object.keys(S.ops).filter((id) => f(S.ops[id])).length;
  const MAIN_MIS = [
    ...["BL-01", "BL-02", "BL-03", "BL-04", "BL-05", "BL-06", "BL-07"].map((c, i) => ({ id: "m_" + c, n: `작전 ${c}`, d: `${c} ${(TD.STAGES.find((q) => q.code === c) || {}).name || ""}를 클리어한다`, prog: () => cleared(c) ? 1 : 0, goal: 1, rw: i === 6 ? [["orb", 1200], ["rush", 2]] : [["orb", 300], ["perm", 1]], go: () => go("ops") })),
    { id: "m_lv30", n: "첫 성장", d: "가사인격 1명을 레벨 30까지 올린다", prog: () => opsWith((o) => o.elite > 0 || o.lvl >= 30), goal: 1, rw: [["rec2", 5]], go: () => go("roster") },
    { id: "m_e1", n: "첫 정예화", d: "가사인격 1명을 정예화 1 한다", prog: () => opsWith((o) => o.elite >= 1), goal: 1, rw: [["orb", 600], ["bm1", 4]], go: () => go("roster") },
    { id: "m_e1x3", n: "정예 분대", d: "가사인격 3명을 정예화 1 한다", prog: () => opsWith((o) => o.elite >= 1), goal: 3, rw: [["orb", 900]], go: () => go("roster") },
    { id: "m_sk4", n: "숙련", d: "가사인격 1명의 스킬 레벨을 4로 올린다", prog: () => opsWith((o) => (o.sl || 1) >= 4), goal: 1, rw: [["bk2", 2]], go: () => go("roster") },
    { id: "m_ops10", n: "식구가 늘다", d: "가사인격 10명과 링크한다", prog: () => Object.keys(S.ops).length, goal: 10, rw: [["perm", 3]], go: () => go("gacha") },
    { id: "m_room2", n: "기반 확장", d: "파견실 2곳을 가동한다", prog: () => S.base && S.base.rooms ? S.base.rooms.filter((R) => R.built && R.zone).length : 0, goal: 2, rw: [["bm2", 2], ["coin", 10000]], go: () => go("base") },
    { id: "m_recruit", n: "공개 회선", d: "공개 링크를 1회 완료한다", prog: () => (S.rcDone || 0), goal: 1, rw: [["rush", 1]], go: () => go("recruit") },
  ];
  const misProg = (q, tab) => { const m = misState(); return Math.min(q.goal, tab === "main" ? q.prog() : (tab === "day" ? m.d : m.w)[q.k] || 0); };
  const misClaimed = (q, tab) => { const m = misState(); return !!(tab === "day" ? m.dc : tab === "week" ? m.wc : m.mc)[q.id]; };
  const misReady = (tab) => (tab === "day" ? DAILY : tab === "week" ? WEEKLY : MAIN_MIS).filter((q) => !misClaimed(q, tab) && misProg(q, tab) >= q.goal);
  function grant(list) { for (const [k, n] of list) { if (k === "coin") S.res.coin += n; else if (k === "orb") S.res.orb += n; else if (k === "ticket") S.res.ticket += n; else addItems([[k, n]]); } }
  function claimMis(q, tab) {
    const m = misState(); (tab === "day" ? m.dc : tab === "week" ? m.wc : m.mc)[q.id] = 1; grant(q.rw);
    if (tab === "day") { m.w.dailyDone = (m.w.dailyDone || 0) + 1; }
  }
  // ---------- 공개 링크, after the original's recruitment: pick up to three of five tags, set the time, wait; whoever answers the call joins ----------
  const RC_TRAIT = { rabi6: ["코스트+", "화력"], veil: ["화력", "생존"], eungyeol: ["방어", "소환"], smoqueen: ["감속", "디버프"], angelina: ["치유", "지원"],
    geomseon: ["화력", "범위공격"], belina: ["코스트+", "지원"], yui: ["방어", "생존"], rabi: ["화력", "지원"], piania: ["치유", "지원"], silphy: ["디버프", "감속"], bongeun: ["화력"], alpha2: ["빠른재배치", "화력"], skakea2: ["범위공격", "소환"],
    falchion: ["코스트+", "화력"], atat: ["소환", "디버프"], hakuren: ["코스트+", "지원"], miho: ["치유"], lulu: ["생존", "화력"], irins: ["범위공격"], alpha: ["화력"], skakea: ["강제이동", "디버프"], ker: ["방어", "감속"], sunae: ["방어", "치유"], teka: ["감속", "강제이동"],
    brick: ["방어"], jayeon: ["감속"], capy: ["범위공격"], hiro: ["화력"], lilith: ["화력"], ayaki: ["치유"], nana: ["화력"], tao: ["코스트+"] };
  const RC_POOL = () => Object.entries(POOL).flatMap(([r, ids]) => ids.map((id) => id)).filter((id) => def(id));
  const rcTags = (id) => { const d = def(id), t = [d.cls, d.range === "melee" ? "근거리" : "원거리", ...(RC_TRAIT[id] || [])]; if (d.rarity === 5) t.push("특별 채용"); if (d.rarity === 6) t.push("고급 특별 채용"); return t; };
  const RC_ALL = ["근거리", "원거리", "선봉", "근위", "중장", "저격", "술사", "의무", "보조", "특수", "화력", "방어", "치유", "지원", "감속", "생존", "디버프", "범위공격", "소환", "코스트+", "강제이동", "빠른재배치"];
  function rollTags() {
    const pick = RC_ALL.slice().sort(() => Math.random() - 0.5).slice(0, 5);
    if (Math.random() < 0.12) pick[4] = "특별 채용"; if (Math.random() < 0.04) pick[3] = "고급 특별 채용";
    return pick;
  }
  function rcState() {
    const g = S.rc || (S.rc = { slots: [], ref: {}, gift: 0 });
    for (let i = 0; i < 4; i++) if (!g.slots[i]) g.slots[i] = { st: "idle", tags: rollTags() };
    if (!g.gift) { g.gift = 1; addItems([["perm", 10], ["rush", 3]]); }
    for (const sl of g.slots) if (sl.st === "run" && Date.now() >= sl.end) sl.st = "done";
    return g;
  }
  // who answers: everyone who carries every chosen tag; time and the rarity tags decide how high it can go
  function rcResult(sel, mins) {
    let c = RC_POOL().filter((id) => sel.every((t) => rcTags(id).includes(t)));
    if (sel.length && !c.length) {   // nobody carries them all: those who carry the most of them
      const hit = (id) => sel.filter((t) => rcTags(id).includes(t)).length, best = Math.max(...RC_POOL().map(hit));
      c = best > 0 ? RC_POOL().filter((id) => hit(id) === best) : [];
    }
    if (!sel.length || !c.length) c = RC_POOL().filter((id) => def(id).rarity <= 4);
    if (!sel.includes("고급 특별 채용")) c = c.filter((id) => def(id).rarity < 6);
    if (mins < 240 && !sel.includes("특별 채용")) c = c.filter((id) => def(id).rarity < 5);
    if (mins >= 460 && c.some((id) => def(id).rarity >= 4)) c = c.filter((id) => def(id).rarity >= 4);   // a long call keeps the three-stars away
    if (!c.length) c = RC_POOL().filter((id) => def(id).rarity === 3);
    const W = { 3: 50, 4: 40, 5: 10, 6: 10 }, rars = [...new Set(c.map((id) => def(id).rarity))], tot = rars.reduce((a, r) => a + W[r], 0);
    let x = Math.random() * tot, rr = rars[0]; for (const r of rars) { x -= W[r]; if (x <= 0) { rr = r; break; } }
    const pool = c.filter((id) => def(id).rarity === rr); return pool[Math.floor(Math.random() * pool.length)];
  }
  // the lowest rarity this combination can give, for the hint under the tags
  function rcFloor(sel, mins) { if (!sel.length) return 3; let c = RC_POOL().filter((id) => sel.every((t) => rcTags(id).includes(t))); if (!c.length) return 3; if (!sel.includes("고급 특별 채용")) c = c.filter((id) => def(id).rarity < 6); if (mins < 240 && !sel.includes("특별 채용")) c = c.filter((id) => def(id).rarity < 5); if (mins >= 460 && c.some((id) => def(id).rarity >= 4)) c = c.filter((id) => def(id).rarity >= 4); return c.length ? Math.min(...c.map((id) => def(id).rarity)) : 3; }
  function rcStart(i) {
    const g = rcState(), sl = g.slots[i]; let sel = [], mins = 540;
    const mo = h("div", "modal rc-m"), bx = h("div", "box"); mo.appendChild(bx); sheet.appendChild(mo);
    const today = dayKey(), canRef = g.ref[i] !== today;
    const paint = () => {
      const fl = rcFloor(sel, mins), hh = Math.floor(mins / 60), mm = mins % 60;
      bx.innerHTML = `<div class="hd"><small class="en">PUBLIC LINK · SLOT ${i + 1}</small><b>공개 링크 설정</b></div>
        <div class="tm"><div class="lb">링크 시간</div><div class="dg"><div class="col"><div class="btn ar" data-d="60">▲</div><b class="en">${String(hh).padStart(2, "0")}</b><div class="btn ar" data-d="-60">▼</div></div><span class="en">:</span><div class="col"><div class="btn ar" data-d="10">▲</div><b class="en">${String(mm).padStart(2, "0")}</b><div class="btn ar" data-d="-10">▼</div></div></div>
          <p>${mins < 240 ? "4시간 미만이면 ★5 이상은 응답하지 않습니다 (특별 채용 태그 제외)" : mins >= 460 ? "7시간 40분 이상이면 ★3이 응답하지 않습니다" : "길게 둘수록 높은 등급이 응답합니다"}</p></div>
        <div class="tg"><div class="lb">태그 <span>최대 3개</span>${canRef ? '<div class="btn ref">⟳ 태그 갱신</div>' : '<div class="ref off">오늘 갱신함</div>'}</div><div class="tl">${sl.tags.map((t) => `<div class="btn tag${sel.includes(t) ? " on" : ""}${/특별/.test(t) ? " sp" : ""}" data-t="${t}">${t}</div>`).join("")}</div>
          <div class="fl">이 조합의 최저 등급 <b class="r${fl}">${"★".repeat(fl)}</b></div></div>
        <div class="ft"><div class="cost"><i>${icn("it-perm")}</i><span>링크 허가증</span><b class="en${inv("perm") < 1 ? " short" : ""}">${inv("perm")}/1</b></div><div class="btn n">취소</div><div class="btn ok${inv("perm") < 1 ? " dis" : ""}">링크 시작</div></div>`;
      bx.querySelectorAll(".ar").forEach((a) => a.onclick = () => { mins = Math.max(60, Math.min(540, mins + +a.dataset.d)); paint(); });
      bx.querySelectorAll(".tag").forEach((t) => t.onclick = () => { const k = t.dataset.t, n = sel.indexOf(k); if (n >= 0) sel.splice(n, 1); else if (sel.length < 3) sel.push(k); else toast("태그는 3개까지 고를 수 있습니다"); paint(); });
      const ref = bx.querySelector(".btn.ref"); if (ref) ref.onclick = () => { sl.tags = rollTags(); g.ref[i] = today; sel = []; save(); mo.remove(); rcStart(i); };
      bx.querySelector(".n").onclick = () => mo.remove();
      bx.querySelector(".ok").onclick = () => {
        if (inv("perm") < 1) return toast("링크 허가증이 부족합니다");
        takeItems([["perm", 1]]); Object.assign(sl, { st: "run", sel: sel.slice(), dur: mins, end: Date.now() + mins * 60e3, res: rcResult(sel, mins) });
        bump("recruit"); save(); mo.remove(); render();
      };
    };
    mo.onclick = (e) => { if (e.target === mo) mo.remove(); };
    paint();
  }
  function rcReveal(i) {
    const g = rcState(), sl = g.slots[i], id = sl.res; if (!id || !def(id)) { sl.st = "idle"; sl.tags = rollTags(); save(); return render(); }
    const isNew = !S.ops[id];
    if (isNew) S.ops[id] = { lvl: 1, elite: 0, pot: 1, skill: 0, got: Date.now() }; else if (S.ops[id].pot < 6) S.ops[id].pot++; else S.res.coin += 1000;
    (S.fresh = S.fresh || {})[id] = 1; S.rcDone = (S.rcDone || 0) + 1;
    Object.assign(sl, { st: "idle", tags: rollTags(), sel: null, res: null, end: 0 }); save();
    const r = def(id).rarity, mo = h("div", "rc-rv r" + r); if (window.SFX) SFX.play("reveal", 0.8);
    mo.innerHTML = `<div class="fx"></div><img class="im" src="${opArt(id, "full")}" alt=""><div class="nm"><div class="st">${"★".repeat(r)}</div><b>${esc(nm(id).main)}</b><span>${def(id).cls} · ${rcTags(id).filter((t) => !/채용/.test(t) && t !== def(id).cls).join(" · ")}</span>${isNew ? '<i class="nw en">NEW</i>' : '<i class="pt">잠재 +1</i>'}</div><div class="tap">화면을 터치하면 닫힙니다</div>`;
    mo.onclick = () => { mo.remove(); render(); }; sheet.appendChild(mo);
  }
  // ---------- the base: dispatch rooms, three to a chapter, each sent to guard one reclaimed map ----------
  // a room makes what its map makes while someone guards it; guards tire by the hour and stop at zero; raids come every few hours
  // and are beaten off with a chance that falls when the guard is weaker than the map's danger; the dorm is where they rest
  const BZ = EC.ZONES, BB = EC.BASE, HR = 3600e3, ROOMS = 9, CHAPTERS = 1;   // three rooms for each chapter; only the first chapter is out
  const zoneIdx = (code) => TD.STAGES.findIndex((q) => q.code === code);
  const zoneOpen = (z) => ((S.stages[z.code] || {}).stars || 0) > 0;
  const baseOpen = () => BZ.some(zoneOpen) && (((S.stages["BL-07"] || {}).stars || 0) > 0 || !!(S.base && S.base.intro));
  const zDef = (code) => BZ.find((z) => z.code === code);
  const roomCh = (r) => Math.floor(r / 3) + 1;
  const roomAvail = (r) => roomCh(r) <= CHAPTERS && baseOpen();
  function baseState() {
    let b = S.base;
    if (!b || !b.rooms) b = S.base = { rooms: [], dorm: (b && b.dorm) || { lv: 1, rest: [] }, fat: (b && b.fat) || {}, t: Date.now(), log: [], seen: 0, intro: b && b.intro };
    for (let r = 0; r < ROOMS; r++) if (!b.rooms[r]) b.rooms[r] = { built: r === 0, lv: 1, zone: null, g: [], store: {}, nr: 0 };   // the first room comes ready
    for (const R of b.rooms) { if (typeof R.store !== "object" || !R.store) R.store = {}; if (R.zone && !zDef(R.zone)) { R.zone = null; R.store = {}; } }   // older saves: one number, or a map that is no longer a site
    const own = (id) => !!S.ops[id];
    for (const R of b.rooms) R.g = R.g.filter(own);
    b.dorm.rest = b.dorm.rest.filter(own);
    return b;
  }
  const fatOf = (id) => { const f = S.base && S.base.fat[id]; return f === undefined ? BB.FAT : f; };
  const postOf = (id) => { const b = baseState(); for (let r = 0; r < ROOMS; r++) if (b.rooms[r].g.includes(id)) return r; return b.dorm.rest.includes(id) ? "dorm" : null; };
  const opPow = (id) => { const o = S.ops[id]; return o ? o.elite * 50 + o.lvl : 0; };   // training as one number: promotion 1 counts as fifty levels
  const trainTxt = (v) => { const e = Math.floor(v / 50), l = Math.round(v - e * 50); return `정예화 ${e} · Lv.${Math.max(1, l)}`; };
  const roomOf = (r) => baseState().rooms[r];
  const working = (R) => R.built && R.zone && zoneOpen(zDef(R.zone));
  const activeG = (r) => roomOf(r).g.filter((id) => fatOf(id) > 0);
  // ---------- base skills ----------
  const skillsOf = (id) => (EC.BASE_SKILLS[id] || []).map((sk, i) => Object.assign({ i, locked: i > 0 && !(S.ops[id] && S.ops[id].elite >= 1) }, sk));
  const liveSkills = (id) => skillsOf(id).filter((sk) => !sk.locked);
  const outLabel = (o) => o === "all" ? "" : o === "coin" ? "주화 " : o === "rec1" ? "작전기록 " : o === "mat" ? "재료 " : (ITEM[o] ? ITEM[o].n + " " : "");
  const skDesc = (sk) => {
    const pc = `+${Math.round(sk.v * 100)}%`;
    if (sk.t === "prod") return [`파견실 배치 시, ${outLabel(sk.out)}생산력 `, pc];
    if (sk.t === "zone") return [`${sk.code} 보호 시, 생산력 `, pc];
    if (sk.t === "fat") return [`파견실 배치 시, ${sk.room ? "같은 방 전원의" : "자신의"} 피로 소모 `, `-${Math.round(sk.v * 100)}%`];
    if (sk.t === "def") return ["파견실 배치 시, 방의 방어력 ", pc];
    if (sk.t === "cap") return ["파견실 배치 시, 보관 한도 ", pc];
    if (sk.t === "rest") return [`숙소 배치 시, ${sk.all ? "숙소 전원의" : "자신의"} 피로 회복 `, `+${sk.v}/시간`];
    return ["", ""];
  };
  const SK_IC = { prod: (sk) => sk.out === "coin" ? ["₵", "c"] : sk.out === "rec1" ? ["≡", "r"] : sk.out === "all" ? ["▲", "a"] : ["◆", "m"], zone: () => ["⌖", "z"], fat: () => ["♥", "f"], def: () => ["⛨", "d"], cap: () => ["▣", "p"], rest: () => ["☾", "s"] };
  const bsIcon = (sk, big) => { const [g2, c] = SK_IC[sk.t](sk); return `<i class="ski ${c}${sk.locked ? " lk" : ""}${big ? " big" : ""}">${g2}</i>`; };
  const prodHits = (sk, k) => sk.out === "all" || sk.out === k || (sk.out === "mat" && k.startsWith("m1_"));
  // does a skill do anything in this room?
  const skFits = (sk, R) => {
    if (!R) return sk.t === "rest"; if (!R.zone) return false;
    if (sk.t === "prod") return zDef(R.zone).yield.some(([k]) => prodHits(sk, k));
    if (sk.t === "zone") return sk.code === R.zone;
    return sk.t === "fat" || sk.t === "def" || sk.t === "cap";
  };
  // what a room's guards add up to: production, defence, storage (fractions) and the fatigue drain the room takes off everyone
  function roomFx(r, act) {
    const R = roomOf(r), fx = { prod: 0, def: 0, cap: 0, roomFat: 0, sk: [] }; act = act || activeG(r);
    for (const id of act) for (const sk of liveSkills(id)) { if (!skFits(sk, R)) continue;
      if (sk.t === "prod" || sk.t === "zone") fx.sk.push(sk); else if (sk.t === "def") fx.def += sk.v; else if (sk.t === "fat" && sk.room) fx.roomFat += sk.v; }
    fx.prodOf = (k) => fx.sk.reduce((a, sk) => a + (sk.t === "zone" || prodHits(sk, k) ? sk.v : 0), 0);
    fx.prod = R.zone ? fx.prodOf(zDef(R.zone).out) : 0;   // the main yield's bonus, for display
    for (const id of R.g) for (const sk of liveSkills(id)) if (sk.t === "cap") fx.cap += sk.v;   // storage holds whether they are awake or not
    return fx;
  }
  const drainOf = (id, r, act) => { const self = liveSkills(id).filter((sk) => sk.t === "fat" && !sk.room).reduce((a, sk) => a + sk.v, 0); return BB.DRAIN * Math.max(0.2, 1 - self - roomFx(r, act).roomFat); };
  const restOf = (id) => { const b = baseState(); let v = BB.REST[b.dorm.lv - 1]; for (const sk of liveSkills(id)) if (sk.t === "rest" && !sk.all) v += sk.v; for (const o of b.dorm.rest) for (const sk of liveSkills(o)) if (sk.t === "rest" && sk.all) v += sk.v; return v; };
  // per hour, with these guards on their feet: k one yield (the main one if not given)
  function zRate(r, act, k) {
    const R = roomOf(r); if (!working(R)) return 0; const z = zDef(R.zone); act = act || activeG(r); const n = act.length; if (!n) return 0;
    k = k || z.out; const y = z.yield.find((q) => q[0] === k); if (!y) return 0;
    const fit = act.filter((id) => z.fit.includes(def(id).cls)).length;
    return y[1] * BB.LVMUL[R.lv - 1] * [0, 0.45, 0.75, 1][Math.min(3, n)] * (1 + 0.1 * fit + roomFx(r, act).prodOf(k));
  }
  const zCap = (r, k) => { const R = roomOf(r); if (!R.zone) return 1; const z = zDef(R.zone), y = z.yield.find((q) => q[0] === (k || z.out)); return y[1] * BB.LVMUL[R.lv - 1] * BB.CAPH * (1 + roomFx(r).cap); };
  const sv = (R, k) => (R.store && R.store[k]) || 0;
  const storeFrac = (r) => { const R = roomOf(r); if (!R.zone) return 0; return Math.max(...zDef(R.zone).yield.map(([k]) => sv(R, k) / zCap(r, k))); };
  const storeReady = (R) => !!R.zone && zDef(R.zone).yield.some(([k]) => sv(R, k) >= 1);
  const zDanger = (r) => { const R = roomOf(r); if (!R.zone) return 0; const [e, l] = zDef(R.zone).rec[R.lv - 1]; return e * 50 + l; };   // the training asked for
  const zPow = (r, act) => { act = act || activeG(r); if (!act.length) return 0; return act.reduce((a, id) => a + opPow(id), 0) / act.length * (1 + roomFx(r, act).def); };   // the guard's average training, with their defence skills
  const zWin = (r, act) => { const p = zPow(r, act), d = zDanger(r); return p <= 0 ? 0 : Math.max(0.1, Math.min(1, Math.pow(p / d, 2))); };   // short of what is asked: the odds fall with the square of the shortfall
  // bring everything up to now: production, fatigue and raids in quarter-hour steps (two weeks at most)
  function baseTick() {
    const b = baseState(), now = Date.now();
    let t = Math.min(b.t || now, now); if (now - t > 14 * 24 * HR) t = now - 14 * 24 * HR;
    while (t < now) {
      const t2 = Math.min(now, t + HR / 4), dh = (t2 - t) / HR;
      b.rooms.forEach((R, r) => {
        if (!working(R)) return;
        if (!R.nr) R.nr = t + (BB.RAID_EVERY + Math.random() * BB.RAID_JIT) * HR;
        const act = R.g.filter((id) => fatOf(id) > 0);
        for (const [k] of zDef(R.zone).yield) R.store[k] = Math.min(zCap(r, k), sv(R, k) + zRate(r, act, k) * dh);
        for (const id of act) b.fat[id] = Math.max(0, fatOf(id) - drainOf(id, r, act) * dh);
        if (t2 >= R.nr) {
          const at = R.nr; R.nr += (BB.RAID_EVERY + Math.random() * BB.RAID_JIT) * HR; if (R.nr <= t2) R.nr = t2 + BB.RAID_EVERY * HR;
          if (!R.g.length && !storeReady(R)) return;   // nothing there for them to take
          const p = zWin(r, act), ok = Math.random() < p;
          if (!ok) { for (const k in R.store) R.store[k] *= 0.5; for (const id of R.g) b.fat[id] = Math.max(0, fatOf(id) - 3); }
          b.log.unshift({ t: at, r, c: R.zone, ok, p: Math.round(p * 100) });
        }
      });
      for (const id of b.dorm.rest) b.fat[id] = Math.min(BB.FAT, fatOf(id) + restOf(id) * dh);
      t = t2;
    }
    b.t = now; b.log = b.log.slice(0, 40);
  }
  function setPost(id, where) {
    const b = baseState();
    for (const R of b.rooms) R.g = R.g.filter((x) => x !== id);
    b.dorm.rest = b.dorm.rest.filter((x) => x !== id);
    if (where === "dorm") b.dorm.rest.push(id); else if (where !== null && where !== undefined) b.rooms[where].g.push(id);
  }
  function collectRoom(r) {   // everything in store that has come to a whole one: a list, or null
    const R = roomOf(r); if (!R.zone) return null; const out = [];
    for (const [k] of zDef(R.zone).yield) { const n = Math.floor(sv(R, k)); if (n < 1) continue; R.store[k] -= n; if (k === "coin") S.res.coin += n; else addItems([[k, n]]); out.push([k, n]); }
    if (out.length) bump("collect");
    return out.length ? out : null;
  }
  // what was just collected, shown for a moment and out of the way (no box to close)
  function gainToast(list) {
    if (window.SFX) SFX.play("coin", 0.8);
    const t = h("div", "gain", list.map(([k, n]) => `<span>${k === "coin" ? '<i class="cn">₵</i>' : `<i>${icn(ITEM[k].ic)}</i>`}<b class="en">+${fmt(n)}</b></span>`).join(""));
    sheet.appendChild(t); setTimeout(() => t.remove(), 1900);
  }
  const outIc = (k) => k === "coin" ? `<i class="cn">₵</i>` : `<i>${icn(ITEM[k].ic)}</i>`;
  const outN = (k) => k === "coin" ? "주화" : ITEM[k].n;
  const numF = (v, k) => k === "coin" ? fmt(Math.floor(v)) : v > 0 && v < 1 ? v.toFixed(2) : (Math.floor(v * 10) / 10).toFixed(1);
  const roomTrouble = (R, r) => working(R) && R.g.length > 0 && R.g.every((id) => fatOf(id) <= 0);
  const baseAlerts = () => { if (!S.base || !S.base.rooms) return 0; const b = S.base; return b.log.filter((l) => !l.ok && l.t > (b.seen || 0)).length + b.rooms.filter(roomTrouble).length; };
  const baseAlert = () => baseAlerts() > 0;
  // ---------- skill mastery (M1-M3) and the training room ----------
  // S.ops[id].sm: each skill's mastery (a save from before has none: zeros). S.train: the one slot, { id, i, n, start, end } (ms), or null
  const TRAIN_H = EC.MS_HOURS.slice();   // hours of training for M1 / M2 / M3
  const smOf = (id, i) => { const o = S.ops[id], d = def(id); return o && d && Array.isArray(o.sm) && TD.maxMastery(d) ? o.sm[i] || 0 : 0; };
  const smList = (id) => [0, 1, 2].map((i) => smOf(id, i));
  const skAt = (id, i) => { const d = def(id), o = S.ops[id] || {}; return TD.skillAt(d.skills[i], o.sl || 1, smOf(id, i)); };
  // every number that differs between two states of a skill: [label, before, after]
  const skDiff = (a, b) => { const fa = TD.skillFields(a), fb = TD.skillFields(b); return fb.map(([k, lab, t], j) => [lab, fa[j][2], t, k]).filter(([, p, q]) => p !== q); };
  // a skill's text with the numbers that change in this step coloured
  const chgHtml = (b, df) => { const keys = new Set(df.map((r) => r[3]));
    return numHtml(kwHtml(TD.skillDesc(b, (k, t) => keys.has(k) ? "\u0001" + t + "\u0002" : t))).replace(/\u0001([\s\S]*?)\u0002/g, '<span class="su-chg">$1</span>'); };
  const hms = (ms) => { const s2 = Math.max(0, Math.floor(ms / 1000)), p = (n) => String(n).padStart(2, "0"); return `${p(Math.floor(s2 / 3600))}:${p(Math.floor(s2 / 60) % 60)}:${p(s2 % 60)}`; };
  const trainSel = { id: null, i: 0 };
  const trainDone = () => !!(S.train && Date.now() >= S.train.end);
  // why operator id's skill i cannot start mastery n now ("" when it can)
  function trainWhy(id, i, n) {
    const d = def(id), o = S.ops[id]; if (!o || !d) return "보유하지 않은 가사인격입니다";
    if (!TD.maxMastery(d)) return "3성 가사인격은 특화 훈련을 할 수 없습니다";
    if (n > 3) return "특화를 모두 마쳤습니다";
    if (o.elite < 2) return "정예화 2 이후 특화 훈련을 할 수 있습니다";
    if ((o.sl || 1) < 7) return "스킬 레벨 7 이후 특화 훈련을 할 수 있습니다";
    if (smOf(id, i) !== n - 1) return `특화 ${n - 1}을 먼저 마쳐야 합니다`;
    if (S.train) return "훈련실이 이미 사용 중입니다";
    const c = EC.masteryCost(id, i, n); if (!c || !hasItems(c.items) || S.res.coin < c.coin) return "재료가 부족합니다";
    return "";
  }
  // the requirement line: E2, skill level 7, the mastery before, the materials (green when met)
  function trainReq(id, i, n) {
    const o = S.ops[id] || {}, c = EC.masteryCost(id, i, n); if (!c) return "";
    const it = (ok, t) => `<i class="${ok ? "ok" : "ng"}">${ok ? "✓" : "✕"} ${t}</i>`;
    return `<div class="rq">${it(o.elite >= 2, "정예화 2")}${it((o.sl || 1) >= 7, "스킬 레벨 7")}${n > 1 ? it(smOf(id, i) >= n - 1, "특화 " + (n - 1)) : ""}${it(hasItems(c.items) && S.res.coin >= c.coin, "재료")}<span class="en">${TRAIN_H[n - 1] >= 1 ? TRAIN_H[n - 1] + "h" : Math.round(TRAIN_H[n - 1] * 3600) + "s"}</span></div>`;
  }
  function trainStart(id, i, n) {
    const why = trainWhy(id, i, n); if (why) { toast(why); return false; }
    const c = EC.masteryCost(id, i, n); takeItems(c.items); S.res.coin -= c.coin;
    const now = Date.now(); S.train = { id, i, n, start: now, end: now + TRAIN_H[n - 1] * HR }; save();
    toast(`특화 ${n} 훈련을 시작했습니다`); return true;
  }
  function trainClaim() {
    if (!trainDone()) return false; const T = S.train, o = S.ops[T.id];
    if (o) { if (!Array.isArray(o.sm)) o.sm = [0, 0, 0]; o.sm[T.i] = Math.max(o.sm[T.i] || 0, T.n); }
    S.train = null; save(); toast(`특화 ${T.n} 달성`); return true;
  }
  function trainRush() {   // 즉시 완료: the rush ticket ends the training at once
    if (!S.train || trainDone()) return false; if (inv("rush") < 1) { toast("즉시 연결권이 없습니다"); return false; }
    takeItems([["rush", 1]]); S.train.end = Date.now(); save(); toast("훈련을 즉시 완료했습니다"); return true;
  }
  function trainTile() {
    const T = S.train && S.ops[S.train.id] ? S.train : null, done = trainDone(), t = h("div", "btn ib-tr" + (done ? " done" : ""));
    t.innerHTML = `<div class="bar"></div><small class="en">TRAINING</small><div class="tt">훈련실</div>${T ? `<div class="pf" style="background-image:url(${opArt(T.id, "card")})"></div>
      <div class="st">${esc(def(T.id).skills[T.i].name)}<br><b class="en">M${T.n}</b></div><div class="cd en">${done ? "완료" : hms(T.end - Date.now())}</div>` : `<div class="st">특화 훈련<br>대기 중</div>`}${done ? '<i class="badge en">!</i>' : ""}`;
    t.onclick = () => go("train");
    if (T && !done) { const tick = () => { if (!t.isConnected) return; const c = t.querySelector(".cd"); if (trainDone()) { render(); return; } if (c) c.textContent = hms(S.train.end - Date.now()); setTimeout(tick, 1000); }; setTimeout(tick, 1000); }
    return t;
  }
  const fatCol = (f) => f > 12 ? "#5fd36a" : f > 4 ? "#f2c14e" : f > 0 ? "#ff7a45" : "#d23b3b";
  const hrsTxt = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`; };
  const clockTxt = (t) => { const d = new Date(t), p = (n) => String(n).padStart(2, "0"); return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
  const OUT_COL = { coin: "#f5c400", rec1: "#2aa7ec" };   // a room's colour follows what it makes: coin gold, records blue, materials green
  const roomCol = (R) => !R.zone ? "#8a8f98" : OUT_COL[zDef(R.zone).out] || "#8ed42a";
  // the picker, after the original's: every operator as a card with their base skills, the chosen ones numbered in order;
  // the left shows whoever was touched last, with their skills spelled out, and what the room would do with this choice
  function guardPicker(target, slotIdx, after) {
    baseTick();
    const b = baseState(), isD = target === "dorm", R = isD ? null : b.rooms[target], z = R && R.zone ? zDef(R.zone) : null;
    const cap = isD ? BB.DORM_SLOTS[b.dorm.lv - 1] : BB.SLOTS;
    let sel = (isD ? b.dorm.rest : R.g).slice(), focus = sel[0] || null, sortBy = "eff";
    const score = (id) => skillsOf(id).filter((sk) => !sk.locked && skFits(sk, R)).reduce((a, sk) => a + (sk.t === "rest" ? sk.v / 2 : sk.v), 0) + (z && z.fit.includes(def(id).cls) ? 0.1 : 0);
    const mo = h("div", "bz-sel"); sheet.appendChild(mo);
    const draw = () => {
      const ids = Object.keys(S.ops).sort((a, c) => (sortBy === "fat" ? fatOf(c) - fatOf(a) : sortBy === "pow" ? opPow(c) - opPow(a) : (score(c) - score(a)) || (fatOf(c) - fatOf(a))) || (opPow(c) - opPow(a)));
      const fo = focus && S.ops[focus] ? focus : null;
      // what the room would do with this choice
      let prev = "";
      if (isD) { const per = sel.length ? sel.map((id) => { const save2 = b.dorm.rest; b.dorm.rest = sel; const v = restOf(id); b.dorm.rest = save2; return v; }) : []; prev = `<div class="kv"><span>피로 회복/시간</span><b class="en">${per.length ? (per.reduce((a, v) => a + v, 0) / per.length).toFixed(1) : "-"}</b></div><div class="kv"><span>정원</span><b class="en">${sel.length}/${cap}</b></div>`; }
      else if (z) {
        const act = sel.filter((id) => fatOf(id) > 0), fx = roomFx(target, act), save2 = R.g; R.g = sel; const rate = zRate(target, act), win = zWin(target, act), dr = act.length ? act.reduce((a, id) => a + drainOf(id, target, act), 0) / act.length : BB.DRAIN; R.g = save2;
        prev = `<div class="kv"><span>생산력</span><b class="en">${numF(rate, z.out === "coin" ? "coin" : "x")}/시간 <em>+${Math.round(fx.prod * 100)}%</em></b></div><div class="kv"><span>피로 소모/시간</span><b class="en">${dr.toFixed(2)}</b></div><div class="kv"><span>격퇴 확률</span><b class="en ${win >= 1 ? "ok" : win >= 0.6 ? "mid" : "bad"}">${Math.round(win * 100)}%</b></div>`;
      }
      mo.innerHTML = `<div class="lp"><div class="rt"><b>${isD ? "숙소" : `파견실 ${target + 1}`}</b><span>${z ? esc(z.n) : isD ? "휴식" : ""}</span></div>
          ${fo ? `<div class="fo"><div class="nm">${esc(nm(fo).main)}</div><div class="fb"><i class="sm">☺</i><div class="bar"><b style="width:${fatOf(fo) / BB.FAT * 100}%;background:${fatCol(fatOf(fo))}"></b></div><span class="en">${Math.floor(fatOf(fo))}/${BB.FAT}</span></div>
            <div class="sks">${skillsOf(fo).map((sk) => { const [d1, d2] = skDesc(sk); return `<div class="sk${sk.locked ? " lk" : ""}${skFits(sk, R) ? " fit" : ""}"><div class="tag">${bsIcon(sk)}<b>${esc(sk.n)}</b></div><p>${sk.locked ? "정예화 1 달성 시 해금 · " : ""}${esc(d1)}<em>${esc(d2)}</em></p></div>`; }).join("") || '<p class="no">기반 스킬 없음</p>'}</div></div>` : '<div class="fo none">가사인격을 선택하세요</div>'}
          <div class="pv"><div class="lb">배치 결과</div>${prev}</div></div>
        <div class="rp"><div class="tabs">${[["eff", "효율"], ["fat", "컨디션"], ["pow", "육성도"]].map(([k, l]) => `<div class="btn tb${sortBy === k ? " on" : ""}" data-k="${k}">${l}</div>`).join("")}<span class="cnt en">${sel.length}/${cap}</span></div>
          <div class="gl">${ids.map((id) => { const p = postOf(id), f = fatOf(id), n = sel.indexOf(id), here = isD ? p === "dorm" : p === target;
            const tag = n >= 0 ? "" : p === "dorm" && !isD ? "휴식 중" : typeof p === "number" && !here ? `파견실 ${p + 1}` : "";
            return `<div class="btn pc${n >= 0 ? " on" : ""}${f <= 0 && !isD ? " out" : ""}" data-id="${id}"><div class="im" style="background-image:url(${opArt(id, "card")})"></div>
              ${n >= 0 ? `<div class="no en">${n + 1}</div>` : ""}${tag ? `<div class="pt">${tag}</div>` : ""}
              <div class="sk">${skillsOf(id).map((sk) => `<span class="${skFits(sk, R) && !sk.locked ? "fit" : ""}">${bsIcon(sk)}</span>`).join("")}</div>
              <div class="fb"><b style="width:${f / BB.FAT * 100}%;background:${fatCol(f)}"></b></div><div class="nm">${esc(nm(id).main)}</div></div>`; }).join("")}</div>
          <div class="ft"><div class="btn clr">선택 초기화</div><div class="btn ok">확인</div></div></div>
        <div class="btn bk">‹</div>`;
      mo.querySelectorAll(".tb").forEach((t) => t.onclick = () => { sortBy = t.dataset.k; draw(); });
      mo.querySelectorAll(".pc").forEach((c) => c.onclick = () => {
        const id = c.dataset.id, n = sel.indexOf(id); focus = id;
        if (n >= 0) sel.splice(n, 1); else if (sel.length < cap) sel.push(id); else { const out = sel.pop(); sel.push(id); toast(`${nm(out).main} 대신 ${nm(id).main}`); }   // full: the new one takes the last one's place
        const gl = mo.querySelector(".gl"), st = gl.scrollTop; draw(); mo.querySelector(".gl").scrollTop = st;
      });
      mo.querySelector(".clr").onclick = () => { sel = []; draw(); };
      mo.querySelector(".bk").onclick = () => mo.remove();
      mo.querySelector(".ok").onclick = () => {
        try { baseTick(); } catch (e) { console.error(e); } const before = isD ? b.dorm.rest.slice() : R.g.slice();
        for (const id of before) if (!sel.includes(id)) setPost(id, null);
        for (const id of sel) setPost(id, target);
        save(); mo.remove(); toast(sel.length ? `${sel.length}명 배치 완료` : "배치 해제");
        try { after && after(); } catch (e) { console.error(e); go(isD ? "dorm" : "room", isD ? undefined : target); }
      };
    };
    draw();
  }
  // building a room, or raising one (or the dorm) a level: base materials from the 자재 야적장, and coin
  function costBox(title, what, c, yes, onYes) {
    const ok = hasItems(c.items) && S.res.coin >= c.coin;
    const mo = h("div", "modal"), bx = h("div", "box sk-box");
    bx.innerHTML = `<h3>${title}</h3><p>${what}</p><div class="sk-cost">${c.items.map(([k, n]) => itemDot(k, n, { text: `${fmt(inv(k))}<small>/${n}</small>`, short: inv(k) < n })).join("")}${c.coin ? `<div class="idot coin${S.res.coin < c.coin ? " short" : ""}"><i class="cn">₵</i><b class="en">${fmt(c.coin)}</b></div>` : ""}</div>${ok ? "" : `<p class="lack">보강 자재는 자원 수집의 「자재 야적장」에서 얻을 수 있습니다. 재료 아이콘을 누르면 바로 갈 수 있습니다.</p>`}`;
    wireDots(bx);
    const row = h("div", "row"), n = h("div", "btn n", "취소"), y = h("div", "btn" + (ok ? "" : " dis"), ok ? yes : "재료 부족");
    n.onclick = () => mo.remove();
    y.onclick = () => { if (!ok) return toast("재료가 부족합니다"); baseTick(); takeItems(c.items); S.res.coin -= c.coin; mo.remove(); onYes(); save(); };
    row.append(n, y); bx.appendChild(row); mo.appendChild(bx); mo.onclick = (e) => { if (e.target === mo) mo.remove(); }; sheet.appendChild(mo);
  }
  function buildBox(r, after) {
    costBox(`파견실 ${r + 1} 건설`, "새 파견실을 엽니다. 연 뒤에 채집지를 고르고 경계 인원을 배치하세요.", BB.BUILD, "건설", () => { roomOf(r).built = true; toast(`파견실 ${r + 1} 건설 완료`); after && after(); });
  }
  function upgradeBox(target, after) {
    const b = baseState(), isD = target === "dorm", R = isD ? null : b.rooms[target], lv = isD ? b.dorm.lv : R.lv, to = lv + 1, c = BB.UP[to]; if (!c) return toast("최고 레벨입니다");
    const what = isD ? `숙소 정원 ${BB.DORM_SLOTS[lv - 1]} → ${BB.DORM_SLOTS[to - 1]}, 회복 ${BB.REST[lv - 1]} → ${BB.REST[to - 1]}/시간`
      : `채집량 ×${BB.LVMUL[lv - 1]} → ×${BB.LVMUL[to - 1]} · 보관 한도 증가${R.zone ? ` · 권장 육성도 ${trainTxt(zDef(R.zone).rec[lv - 1][0] * 50 + zDef(R.zone).rec[lv - 1][1])} → ${trainTxt(zDef(R.zone).rec[to - 1][0] * 50 + zDef(R.zone).rec[to - 1][1])}` : " · 권장 육성도 상승"}`;
    costBox(`${isD ? "숙소" : "파견실 " + (target + 1)} 강화 Lv.${lv} → ${to}`, what, c, "강화", () => { if (isD) b.dorm.lv = to; else R.lv = to; toast(`Lv.${to} 강화 완료`); after && after(); });
  }
  // choosing where a room gathers, on the operations map itself: the chapter's stages along their line, dragged sideways like the terminal;
  // two of them are gathering sites (the disc shows what they yield); touching one slides its panel in, touching the map takes it away
  function zonePicker(r, after) {
    const b = baseState(), R = b.rooms[r];
    const mo = h("div", "zm"); sheet.appendChild(mo);
    mo.innerHTML = `<div class="term-bg" style="background-image:url(${ART.st_war || ART.bg})"></div><div class="term-shade"></div>
      <div class="zm-ttl"><small class="en">DISPATCH ROOM ${r + 1} · GATHERING SITE</small><b>채집지 선택</b><span>장마다 채집지는 두 곳입니다. 지키면서 그곳의 자원을 채집합니다.</span></div><div class="btn zm-bk">‹</div>`;
    mo.querySelector(".zm-bk").onclick = () => mo.remove();
    const main = TD.STAGES.map((q, i) => i).filter((i) => STAGE_META[i].branch === undefined && !STAGE_META[i].supply && !STAGE_META[i].story && !STAGE_META[i].lab);   // story entries hold no ground
    const GAP = 214, X0 = 110, YS = [150, 236, 128, 222, 140, 232, 150], nx = (k) => X0 + k * GAP, ny = (k) => YS[k % YS.length];
    const strip = h("div", "strip zm-strip"), track = h("div", "track"); track.style.width = (X0 * 2 + main.length * GAP + 520) + "px";
    track.innerHTML = `<svg width="${X0 * 2 + main.length * GAP + 520}" height="420"><path d="${main.map((i, k) => (k ? "L" : "M") + (nx(k) + 50) + " " + (ny(k) + 26)).join(" ")}" stroke="rgba(255,255,255,.8)" stroke-width="2.5" fill="none"/></svg>`;
    strip.appendChild(track); mo.appendChild(strip);
    const here = (code) => b.rooms.map((q, k) => k !== r && q.built && q.zone === code ? k + 1 : 0).filter(Boolean);
    let pn = null, cur = -1; const nodes = [];
    const close = () => { if (cur < 0) return; cur = -1; nodes.forEach((n) => n && n.classList.remove("sel")); if (pn) { const o = pn; pn = null; o.classList.add("out"); setTimeout(() => o.remove(), 240); } };
    const pick = (k, anim) => {
      const i = main[k], st = TD.STAGES[i], z = zDef(st.code); if (!z) return; cur = k;
      nodes.forEach((n, q) => n && n.classList.toggle("sel", q === k));
      const left = Math.max(0, nx(k) - 330); if (anim) strip.scrollTo({ left, behavior: "smooth" }); else requestAnimationFrame(() => { strip.scrollLeft = left; });
      const open = zoneOpen(z), on = R.zone === z.code, others = here(z.code), [re, rl] = z.rec[R.lv - 1];
      const np = h("div", "zm-pn", `<div class="im" style="background-image:url(${ART[st.bg] || ART.bg})"><span class="en">${z.code}</span></div>
        <div class="hd"><small>${esc(st.name)}</small><b>${esc(z.n)}</b></div><p>${esc(z.d)}</p>
        <div class="gt"><div class="lb">채집 자원 <span>파견실 Lv.${R.lv} · 3명 경계 기준</span></div>${z.yield.map(([k2, v], q) => `<div class="it${q ? " sub" : ""}">${outIc(k2)}<div><b>${outN(k2)}</b><span>${q ? "부산물" : "주 자원"}</span></div><em class="en">${numF(v * BB.LVMUL[R.lv - 1], k2 === "coin" ? "coin" : "x")}<small>/시간</small></em></div>`).join("")}</div>
        <div class="row3"><div><small>권장 육성도</small><b>정예화 ${re} · Lv.${rl}</b><i>미달 시 격퇴 확률 하락</i></div><div><small>적합 직군</small><span class="cl">${z.fit.map((c) => `<img src="${clsIcon(CLS_REP[c], 26)}" alt="${c}"><em>${c}</em>`).join("")}</span></div></div>
        ${others.length ? `<div class="oth">파견실 ${others.join(", ")}도 이곳에서 채집 중</div>` : ""}
        <div class="btn go2${!open ? " dis" : on ? " on" : ""}">${!open ? `${z.code} 클리어 후 탈환` : on ? "현재 채집 중" : "이곳에서 채집"}</div>`);
      np.onclick = (e) => e.stopPropagation();
      np.querySelector(".go2").onclick = () => {
        if (!open) return toast(`${z.code}을 클리어하면 탈환됩니다`); if (on) return mo.remove();
        baseTick(); const got = collectRoom(r); R.zone = z.code; R.store = {}; R.nr = 0; save(); mo.remove(); after && after(); if (got) gainToast(got);
      };
      np.classList.add(pn ? "swap" : "in"); if (pn) { const o = pn; o.classList.add("out"); setTimeout(() => o.remove(), 240); }
      mo.appendChild(np); pn = np;
    };
    main.forEach((i, k) => {
      const st = TD.STAGES[i], z = zDef(st.code), cleared = ((S.stages[st.code] || {}).stars || 0) > 0;
      if (!z) {   // an ordinary stage: on the line, but nothing to gather there
        const nd = h("div", "node plain" + (cleared ? " clear" : " lk"), `<div class="lab en">OPERATION</div><div class="box"><div class="hx"><i></i></div><div class="c en">${st.code}</div></div>`);
        Object.assign(nd.style, { left: nx(k) + "px", top: ny(k) + "px" }); track.appendChild(nd); return;
      }
      const on = R.zone === z.code, others = here(z.code);
      const nd = h("div", "btn node site" + (cleared ? " clear" : " lk") + (on ? " here" : ""), `<div class="lab en">GATHERING</div><div class="box"><div class="hx"><i></i></div><div class="c en">${st.code}</div></div>
        <div class="dm t${(ITEM[z.out] || {}).tier || 1}">${z.out === "coin" ? '<i class="cn">₵</i>' : icn(ITEM[z.out].ic)}</div>
        <div class="zys">${z.yield.slice(1).map(([k2]) => `<i>${icn(ITEM[k2].ic)}</i>`).join("")}</div>
        ${on ? '<div class="zt on">채집 중</div>' : !cleared ? '<div class="zt lk">미탈환</div>' : others.length ? `<div class="zt">파견실 ${others.join("·")}</div>` : ""}`);
      Object.assign(nd.style, { left: nx(k) + "px", top: ny(k) + "px" });
      nd.onclick = (e) => { e.stopPropagation(); pick(k, true); }; nodes[k] = nd; track.appendChild(nd);
    });
    mo.onclick = (e) => { if (!e.target.closest(".zm-bk")) close(); };   // touching the map takes the panel away, as on the terminal
    const start = main.findIndex((i) => TD.STAGES[i].code === R.zone);
    if (start >= 0) pick(start, false); else { const f = main.findIndex((i) => zDef(TD.STAGES[i].code) && zoneOpen(zDef(TD.STAGES[i].code))); if (f >= 0) pick(f, false); }
  }
  // ---------- the rooms themselves: a painted cross-section for each kind of work, and where people go in it ----------
  // positions are fractions of the picture; f: the floor band (top, bottom) feet stand in; a: the bubble at that spot
  const ROOM_SET = {
    coin: { key: "rm_coin", k: 0.23, f: [0.72, 0.84], lamps: [[0.21, 0.23, 0.17], [0.5, 0.23, 0.17], [0.79, 0.23, 0.17]],
      spots: [{ x: 0.16, y: 0.75, a: "?" }, { x: 0.36, y: 0.74, a: "!" }, { x: 0.5, y: 0.74, a: "…" }, { x: 0.63, y: 0.74, a: "!" }, { x: 0.79, y: 0.75, a: "₵" }, { x: 0.92, y: 0.77, a: "…" }, { x: 0.45, y: 0.82, a: "♪" }, { x: 0.68, y: 0.82, a: "?" }] },
    rec1: { key: "rm_rec", k: 0.23, f: [0.72, 0.84], lamps: [[0.21, 0.23, 0.17], [0.5, 0.23, 0.17], [0.79, 0.23, 0.17]],
      spots: [{ x: 0.17, y: 0.74, a: "…" }, { x: 0.3, y: 0.74, a: "!" }, { x: 0.42, y: 0.74, a: "?" }, { x: 0.55, y: 0.74, a: "…" }, { x: 0.68, y: 0.74, a: "!" }, { x: 0.81, y: 0.75, a: "…" }, { x: 0.48, y: 0.82, a: "♪" }, { x: 0.88, y: 0.8, a: "?" }] },
    mat: { key: "rm_mat", k: 0.23, f: [0.74, 0.95], lamps: [[0.29, 0.13, 0.2], [0.72, 0.13, 0.2]],
      spots: [{ x: 0.1, y: 0.76, a: "?" }, { x: 0.26, y: 0.76, a: "!" }, { x: 0.42, y: 0.77, a: "…" }, { x: 0.62, y: 0.76, a: "!" }, { x: 0.75, y: 0.77, a: "…" }, { x: 0.9, y: 0.8, a: "?" }, { x: 0.33, y: 0.88, a: "♪" }, { x: 0.6, y: 0.9, a: "…" }] },
    dorm: { key: "rm_dorm", k: 0.23, f: [0.74, 0.95], lamps: [[0.29, 0.13, 0.2], [0.72, 0.13, 0.2], [0.95, 0.74, 0.1]],
      spots: [{ x: 0.12, y: 0.75, a: "z" }, { x: 0.33, y: 0.75, a: "z" }, { x: 0.5, y: 0.77, a: "♪" }, { x: 0.6, y: 0.77, a: "♪" }, { x: 0.72, y: 0.76, a: "…" }, { x: 0.84, y: 0.76, a: "♪" }, { x: 0.93, y: 0.79, a: "…" }, { x: 0.4, y: 0.88, a: "?" }, { x: 0.68, y: 0.9, a: "…" }] },
  };
  const roomSetOf = (key) => key === "dorm" ? ROOM_SET.dorm : (() => { const R = baseState().rooms[key]; if (!R || !R.zone) return null; const o = zDef(R.zone).out; return o === "coin" ? ROOM_SET.coin : o === "rec1" ? ROOM_SET.rec1 : ROOM_SET.mat; })();
  // the people in a room: they go from one spot to another and do a little there; the spent ones sit down where they are
  function roomScene(fr, set, ids, tiredOf) {
    const W = 1280, H = 720, sp = set.spots.map((p) => ({ x: p.x * W, y: p.y * H, a: p.a })), taken = new Set();
    const depth = (y) => 0.9 + (y - set.f[0] * H) / ((set.f[1] - set.f[0]) * H) * 0.18;
    const free = () => { const f = sp.filter((p) => !taken.has(p)); return f[Math.floor(Math.random() * f.length)] || sp[0]; };
    const order = sp.slice().sort(() => Math.random() - 0.5);
    return livingScene(fr, { bg: ART[set.key] || ART.st_room, zoom: 1.02, fx: "dust", k: set.k * H, speed: 75, chat: true, lamp: set.lamps.map(([x, y, r]) => [x * W, y * H, r * W]),
      actors: ids.map((id, i) => { const p = order[i % order.length]; taken.add(p); return { id, x: p.x, y: p.y, spot: p, sc: depth(p.y), tired: tiredOf(id) }; }),
      next: (a) => { taken.delete(a.spot); const p = free(); taken.add(p); a.spot = p; a.sc = depth(p.y); return [p.x + (Math.random() - 0.5) * 20, p.y + (Math.random() - 0.5) * 6, p.a]; } });
  }
  // ---------- the base's tiles and rooms ----------
  function roomTile(r) {
    const b = baseState(), R = b.rooms[r], t = h("div", "btn ib-rm"), ch = roomCh(r);
    if (!roomAvail(r)) { t.classList.add("lock"); t.innerHTML = `<span>파견실<br>EPISODE ${String(ch).padStart(2, "0")} 수신 후 개방</span>`; t.onclick = () => toast("다음 장이 열리면 파견실이 늘어납니다"); return t; }
    if (!R.built) { t.classList.add("empty"); t.innerHTML = `<b>+</b><span>파견실 건설</span><em>${BB.BUILD.items.map(([k2, n]) => `${icn(ITEM[k2].ic)}<i class="en">×${n}</i>`).join("")}</em>`; t.onclick = () => buildBox(r, render); return t; }
    const z = R.zone && zDef(R.zone), act = activeG(r), col = roomCol(R), frac = storeFrac(r);
    const stt = !z ? ["채집지 미지정", "#9aa0aa"] : !R.g.length ? ["경계 인원 없음", "#ff9a3c"] : !act.length ? ["채집 정지", "#ff4a3a"] : frac >= 0.999 ? ["보관 가득", "#ff9a3c"] : [`${z.code} 채집 중 ▸▸`, col];
    const seg = 5, fill = z ? Math.round(Math.min(1, frac) * seg) : 0;
    t.style.setProperty("--rc", col);
    const rs = roomSetOf(r); if (rs && ART[rs.key]) t.style.setProperty("--art", `url(${ART[rs.key]})`);
    t.innerHTML = `<div class="art"></div><div class="bar"></div><div class="tt">파견실<span class="lv">${"<i></i>".repeat(R.lv)}${"<i class=o></i>".repeat(3 - R.lv)}</span></div><div class="st" style="color:${stt[1]}">${stt[0]}</div>
      ${z ? `<div class="ic${storeReady(R) ? " ready" : ""}">${outIc(z.out)}</div>` : '<div class="ic none">+</div>'}
      <div class="gn en"><svg class="pp" viewBox="0 0 20 20"><circle cx="10" cy="6" r="4"/><path d="M2 19c0-5 4-7 8-7s8 2 8 7z"/></svg><b>${R.g.length}</b><small>/${BB.SLOTS}</small></div>
      <div class="sg">${Array.from({ length: seg }, (_, q) => `<i class="${q < fill ? "on" : ""}"></i>`).join("")}</div>`;
    t.onclick = () => go("room", r);
    const ic = t.querySelector(".ic.ready"); if (ic) ic.onclick = (e) => { e.stopPropagation(); baseTick(); const g = collectRoom(r); save(); render(); if (g) gainToast(g); };   // the full disc collects on the spot
    return t;
  }
  function baseHelp() {
    const mo = h("div", "modal"), bx = h("div", "box bs-help", `<h3>기반시설 안내</h3>
      <p><b>파견실</b> 장마다 파견실 3칸과 숙소 하나가 열립니다. 첫 파견실은 바로 쓸 수 있고, 나머지는 보강 자재로 건설합니다.</p>
      <p><b>보호 구역</b> 파견실마다 지킬 탈환 구역(클리어한 맵)을 하나 고릅니다. 그 구역의 물자(주화·작전기록·재료)가 쌓입니다.</p>
      <p><b>경계 배치</b> 가사인격을 경계에 세워야 생산이 진행됩니다. 인원이 많고 적합 직군일수록 빨라집니다. 경계 중에도 작전에는 그대로 데려갈 수 있습니다.</p>
      <p><b>피로</b> 경계 중에는 피로가 시간당 ${BB.DRAIN}씩 줄어듭니다. 0이 되면 탈진해서 경계를 서지 못하고, 전원이 탈진하면 생산이 멈춥니다. 숙소로 교체해 쉬게 하세요.</p>
      <p><b>습격</b> 몇 시간마다 습격이 옵니다. 경계 인원의 평균 육성도(정예화·레벨, 방어 스킬 포함)가 채집지의 권장 육성도보다 낮으면 격퇴 확률이 떨어지고, 뚫리면 보관 물자 절반을 잃습니다.</p>
      <p><b>건설과 강화</b> 자원 수집의 「자재 야적장」에서 얻는 보강 자재·강화 골조로 합니다. 강화하면 생산량이 늘지만 위험도도 올라갑니다.</p>`), row = h("div", "row"), ok = h("div", "btn", "확인"), rp = h("div", "btn", "튜토리얼 다시 보기");
    ok.onclick = () => mo.remove(); rp.onclick = () => { mo.remove(); S.bguide = 2; save(); go("base"); }; row.append(rp, ok); bx.appendChild(row); mo.appendChild(bx); mo.onclick = (e) => { if (e.target === mo) mo.remove(); }; sheet.appendChild(mo);
  }
  function baseLog() {
    const b = baseState(); b.seen = Date.now(); save();
    const mo = h("div", "modal"), bx = h("div", "box ib-log", `<h3>습격 기록</h3><div class="ls">${b.log.map((l) => `<div class="${l.ok ? "" : "bad"}"><span class="en">${clockTxt(l.t)}</span><b>파견실 ${l.r + 1}</b><em class="en">${l.c}</em>${l.ok ? "습격 격퇴" : "방어 실패 · 보관 물자 절반 손실"}<small class="en">${l.p}%</small></div>`).join("") || "<div>기록 없음</div>"}</div>`);
    const row = h("div", "row"), ok = h("div", "btn", "확인"); ok.onclick = () => { mo.remove(); render(); }; row.appendChild(ok); bx.appendChild(row); mo.appendChild(bx); sheet.appendChild(mo);
  }
  // the room view: frame in the middle, neighbours round it, drawers on the left, the product in the corner
  function roomShell(el, key) {
    const b = baseState(), isD = key === "dorm", R = isD ? null : b.rooms[key], z = R && R.zone ? zDef(R.zone) : null;
    el.appendChild(h("div", "rv-bg"));
    // neighbours: the rooms either side in the base's order, and the dorm (or the first room) below
    const order = b.rooms.map((q, r) => r).filter((r) => roomAvail(r) && b.rooms[r].built).concat(["dorm"]);
    const at = order.indexOf(key), prev = order[(at - 1 + order.length) % order.length], next = order[(at + 1) % order.length];
    const nbArt = (k) => { const st = roomSetOf(k); return st ? ART[st.key] : null; };
    const nbName = (k) => k === "dorm" ? "숙소" : `파견실 ${k + 1}`;
    for (const [k, cls] of [[prev, "l"], [next, "r"], [isD ? order[0] : "dorm", "d"]]) {
      if (k === undefined || k === key || (cls !== "d" && order.length < 2)) continue;
      const a = nbArt(k), n = h("div", "btn rv-nb " + cls + (a ? "" : " plan"), `<span>${nbName(k)}</span>`); if (a) n.style.backgroundImage = `url(${a})`;
      n.onclick = () => k === "dorm" ? go("dorm") : go("room", k); el.appendChild(n);
    }
    const fr = h("div", "rv-fr"); el.appendChild(fr);
    // the scene inside the frame
    if (isD) roomScene(fr, ROOM_SET.dorm, b.dorm.rest, () => false);
    else if (z) roomScene(fr, roomSetOf(key), R.g, (id) => fatOf(id) <= 0);
    else {
      fr.classList.add("nz"); fr.innerHTML = `<div class="ib-nz"><small class="en">DISPATCH ROOM ${key + 1}</small><b>채집지를 고르세요</b><span>탈환한 맵 가운데 한 곳을 골라, 지키면서 그곳의 자원을 채집합니다.</span><div class="btn">채집지 선택</div></div>`;
      fr.querySelector(".btn").onclick = () => zonePicker(key, render);
    }
    // the bar: back, home, the room's name and level
    const top = topBar("", "", () => go("base"), { res: false }); el.appendChild(top);
    const lvl = isD ? b.dorm.lv : R.lv;
    const nm2 = h("div", "rv-nm", `<i style="background:${isD ? "#d8dbe0" : roomCol(R)}"></i><b>${isD ? "숙소" : `파견실 ${key + 1}`}${z ? ` · ${esc(z.n)}` : ""}</b><span class="lv">${"<u></u>".repeat(lvl)}${"<u class=o></u>".repeat(3 - lvl)}</span>`); el.appendChild(nm2);
    // drawers
    const tabs = h("div", "rv-tabs", `<div class="btn t" data-t="fac"><svg viewBox="0 0 24 24"><path d="M3 3h12v4h-4v4h4v10H3z M17 3h4v6h-4z M17 13h4v8h-4z" fill="#fff"/></svg><b>설비 정보</b></div><div class="btn t" data-t="crew"><svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="3" fill="#fff"/><circle cx="12" cy="6" r="3" fill="#fff"/><circle cx="18" cy="6" r="3" fill="#fff"/><path d="M1 21v-7c0-2 2-4 5-4s5 2 5 4v7z M13 13h10v2H13z M13 17h10v2H13z" fill="#fff"/></svg><b>배치 정보</b></div>`);
    el.appendChild(tabs);
    const dw = h("div", "rv-dw"); el.appendChild(dw);
    const openTab = (t) => {
      tabs.querySelectorAll(".t").forEach((x) => x.classList.toggle("on", x.dataset.t === t && !dw.classList.contains("on" + t)));
      if (dw.dataset.t === t && dw.classList.contains("open")) { dw.classList.remove("open"); dw.dataset.t = ""; return; }
      dw.dataset.t = t; dw.classList.add("open"); dw.innerHTML = t === "fac" ? facHtml() : crewHtml(); wireDw(t);
    };
    tabs.querySelectorAll(".t").forEach((x) => x.onclick = () => openTab(x.dataset.t));
    const facHtml = () => {
      if (isD) return `<div class="hd">설비 정보<small class="en">DORMITORY</small></div><p>탈환 구역 경계를 마친 가사인격이 쉬는 곳. 여기 있는 동안 피로가 회복됩니다.</p>
        <div class="kv"><span>레벨</span><b class="en">Lv.${b.dorm.lv}</b></div><div class="kv"><span>정원</span><b class="en">${BB.DORM_SLOTS[b.dorm.lv - 1]}</b></div><div class="kv"><span>피로 회복</span><b class="en">${BB.REST[b.dorm.lv - 1]}/시간</b></div>
        <div class="btn up">${BB.UP[b.dorm.lv + 1] ? "시설 강화" : "최고 레벨"}</div>`;
      if (!z) return `<div class="hd">설비 정보<small class="en">DISPATCH ROOM ${key + 1}</small></div><p>아직 보호할 구역이 정해지지 않았습니다.</p><div class="btn chg">구역 선택</div><div class="btn up">${BB.UP[R.lv + 1] ? "시설 강화" : "최고 레벨"}</div>`;
      const act = activeG(key), win = zWin(key, act);
      return `<div class="hd">설비 정보<small class="en">DISPATCH ROOM ${key + 1} · ${R.zone}</small></div><p>${esc(z.d)}</p>
        <div class="kv"><span>보호 구역</span><b>${R.zone} ${esc(z.n)}</b></div><div class="kv"><span>레벨</span><b class="en">Lv.${R.lv} · 생산 ×${BB.LVMUL[R.lv - 1]}</b></div>
        <div class="kv"><span>권장 육성도</span><b>${trainTxt(zDanger(key))}</b></div><div class="kv"><span>경계 평균 (방어 보정)</span><b>${act.length ? trainTxt(zPow(key, act)) : "-"}</b></div>
        <div class="kv"><span>격퇴 확률</span><b class="en ${win >= 1 ? "ok" : win >= 0.6 ? "mid" : "bad"}">${Math.round(win * 100)}%</b></div>
        <div class="kv"><span>다음 습격</span><b>${R.nr ? hrsTxt(R.nr - Date.now()) + " 후" : "경계 시작 후"}</b></div>
        <div class="lgs">${b.log.filter((l) => l.r === key).slice(0, 3).map((l) => `<div class="${l.ok ? "" : "bad"}"><span class="en">${clockTxt(l.t)}</span>${l.ok ? "습격 격퇴" : "방어 실패 · 물자 절반 손실"}</div>`).join("")}</div>
        <div class="bt2"><div class="btn chg">구역 변경</div><div class="btn up">${BB.UP[R.lv + 1] ? "시설 강화" : "최고 레벨"}</div></div>`;
    };
    const crewHtml = () => {
      const cap = isD ? BB.DORM_SLOTS[b.dorm.lv - 1] : BB.SLOTS, list = isD ? b.dorm.rest : R.g;
      if (!isD && !z) return `<div class="hd">배치 정보</div><p>먼저 보호할 구역을 고르세요.</p>`;
      const cards = Array.from({ length: cap }, (_, k) => { const id = list[k]; if (!id) return `<div class="btn cc e">+</div>`; const f = fatOf(id), out = f <= 0 && !isD;
        return `<div class="btn cc" style="background-image:url(${opArt(id, "card")})"><div class="sk2">${skillsOf(id).filter((sk) => !sk.locked && skFits(sk, R)).map((sk) => bsIcon(sk)).join("")}</div><div class="st${out ? " out" : ""}">${isD ? (f >= BB.FAT ? "회복 완료" : "휴식 중") : out ? "탈진" : "업무 중"}</div><div class="fb2"><b style="width:${f / BB.FAT * 100}%;background:${fatCol(f)}"></b></div></div>`; }).join("");
      const pill = (v, cls = "") => `<i class="${v ? cls : "z"}">${v}</i>`;
      let rows = "", skl = [];
      if (isD) {
        const base = BB.REST[b.dorm.lv - 1], avg = list.length ? list.reduce((a, id) => a + restOf(id), 0) / list.length : base;
        rows = `<tr><td>피로 회복/h</td><td class="b0 en">${base}</td><td class="b1 en">${pill(avg - base > 0.001 ? "+" + (avg - base).toFixed(1) : 0)}</td></tr><tr><td>정원</td><td class="b0 en">${list.length}/${cap}</td><td></td></tr>`;
        for (const id of list) for (const sk of liveSkills(id)) if (sk.t === "rest") skl.push([id, sk]);
      } else {
        const act = activeG(key), fx = roomFx(key, act), raw = act.length ? zRate(key, act) / (1 + 0.1 * act.filter((id) => z.fit.includes(def(id).cls)).length + fx.prod) : 0;
        const dr = act.length ? act.reduce((a, id) => a + drainOf(id, key, act), 0) / act.length : BB.DRAIN, basePow = act.length ? act.reduce((a, id) => a + opPow(id), 0) / act.length : 0;
        rows = `<tr><td>피로 소모/h</td><td class="b0 en">${BB.DRAIN}</td><td class="b1 en">${pill(BB.DRAIN - dr > 0.001 ? "-" + (BB.DRAIN - dr).toFixed(2) : 0, "n")}</td></tr>
          <tr><td>채집량/h</td><td class="b0 en">${numF(raw, z.out === "coin" ? "coin" : "x")}</td><td class="b1 en">${pill(fx.prod ? "+" + Math.round(fx.prod * 100) + "%" : 0)}</td></tr>
          <tr><td>평균 육성도</td><td class="b0">${basePow ? trainTxt(basePow).replace("정예화 ", "E").replace(" · ", " ") : "-"}</td><td class="b1 en">${pill(fx.def ? "+" + Math.round(fx.def * 100) + "%" : 0)}</td></tr>
          <tr><td>보관 한도</td><td class="b0 en">${numF(zCap(key) / (1 + fx.cap), z.out)}</td><td class="b1 en">${pill(fx.cap ? "+" + Math.round(fx.cap * 100) + "%" : 0)}</td></tr>`;
        for (const id of list) for (const sk of liveSkills(id)) if (skFits(sk, R)) skl.push([id, sk]);
      }
      return `<div class="hd">배치 인원<small class="en">ATTENDANCE</small></div><div class="crew">${cards}</div><table class="tb2">${rows}</table>
        <div class="skl">${skl.map(([id, sk]) => { const [, d2] = skDesc(sk); return `<div>${bsIcon(sk)}<b>${esc(sk.n)}</b>${esc(nm(id).main)}<em>${esc(d2)}</em></div>`; }).join("") || "<div>적용 중인 기반 스킬 없음</div>"}</div>
        <div class="btn chg2">인원 교체</div>`;
    };
    const wireDw = (t) => {
      const up = dw.querySelector(".up"); if (up) up.onclick = () => upgradeBox(isD ? "dorm" : key, render);
      const chg = dw.querySelector(".chg"); if (chg) chg.onclick = () => zonePicker(key, render);
      dw.querySelectorAll(".cc, .chg2").forEach((c) => c.onclick = () => guardPicker(isD ? "dorm" : key, 0, render));
    };
    fr.onclick = (e) => { if (!e.target.closest(".btn")) openTab("crew"); };   // touching the room shows who is in it
    // the corner card: what it makes and when the next one comes
    const cd = h("div", "rv-cd"); el.appendChild(cd);
    if (isD) {
      const n = b.dorm.rest.length, full = b.dorm.rest.filter((id) => fatOf(id) >= BB.FAT).length;
      cd.innerHTML = `<div class="ic dorm">Zz</div><div class="tx"><b>휴식</b><span>피로 회복 ${BB.REST[b.dorm.lv - 1]}/시간</span></div><div class="rt"><em>${n ? "휴식 중" : "비어 있음"}</em><span class="en">${full}/${n} 회복 완료</span></div><div class="pb"><i style="width:${n ? full / n * 100 : 0}%"></i></div>`;
    } else if (z) {
      const act = activeG(key), rate = zRate(key, act), m = z.out, cap = zCap(key, m), left = rate > 0 ? (m === "coin" ? 0 : (1 - (sv(R, m) % 1)) / rate * HR) : 0;
      const hms = (ms) => { const s2 = Math.max(0, Math.round(ms / 1000)), p = (n) => String(n).padStart(2, "0"); return `${p(Math.floor(s2 / 3600))}:${p(Math.floor(s2 / 60) % 60)}:${p(s2 % 60)}`; };
      cd.classList.add("site"); cd.style.setProperty("--sbg", `url(${ART[TD.STAGES[zoneIdx(R.zone)].bg] || ART.bg})`);
      cd.innerHTML = `<div class="site"><span>채집지 <b class="en">${R.zone}</b>${esc(TD.STAGES[zoneIdx(R.zone)].name)}<i>변경 ›</i></span></div><div class="ic">${outIc(m)}<b class="en">${numF(sv(R, m), m)}</b></div><div class="tx"><b>${outN(m)}</b><span class="en">${m === "coin" ? `시간당 ${numF(rate, "coin")}` : rate > 0 ? `다음 1개 ${hms(left)}` : "채집 정지"}</span></div>
        <div class="sub">${z.yield.slice(1).map(([k]) => `<span>${outIc(k)}<b class="en">${numF(sv(R, k), k)}</b></span>`).join("")}</div>
        <div class="rt"><em class="${rate > 0 ? "" : "stop"}">${rate > 0 ? "채집 중" : R.g.length ? "채집 정지" : "경계 없음"}</em><span class="en">${numF(sv(R, m), m)}/${numF(cap, m)}</span></div><div class="pb"><i style="width:${Math.min(100, storeFrac(key) * 100)}%"></i></div><div class="btn get${storeReady(R) ? "" : " dis"}">수령</div>`;
      cd.querySelector(".get").onclick = (e) => { e.stopPropagation(); baseTick(); const g = collectRoom(key); save(); if (!g) return toast("아직 수령할 만큼 쌓이지 않았습니다"); render(); gainToast(g); };
      cd.onclick = () => zonePicker(key, render);   // the card is the way to the map
    } else cd.remove();
    const eye = h("div", "btn rv-eye", `<svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" fill="none" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="3.5" fill="#fff"/></svg>`);
    eye.onclick = () => el.classList.toggle("rv-only"); el.appendChild(eye);
    if (!isD && !z) zonePicker(key, render);
  }
  // the shelter drawn as its own floor plan: bunks, the mess table, the lounge, the workshop; where the residents go and what they do there
  const DORM_SPOTS = [
    { x: 130, y: 250, a: "z" }, { x: 230, y: 250, a: "z" }, { x: 330, y: 250, a: "z" },            // bunks
    { x: 500, y: 215, a: "♪" }, { x: 600, y: 215, a: "♪" }, { x: 700, y: 215, a: "♪" }, { x: 560, y: 330, a: "…" },   // the mess
    { x: 160, y: 560, a: "…" }, { x: 260, y: 570, a: "♪" }, { x: 380, y: 480, a: "?" },             // the lounge
    { x: 560, y: 560, a: "!" }, { x: 700, y: 520, a: "…" }, { x: 640, y: 640, a: "!" },             // the workshop
  ];
  const DORM_LAMPS = [[230, 200, 190], [600, 210, 210], [250, 540, 220], [630, 540, 200]];
  let DORM_ART = null;
  function dormArt() {
    if (DORM_ART) return DORM_ART;
    const c = document.createElement("canvas"); c.width = 1280; c.height = 720; const g = c.getContext("2d");
    g.fillStyle = "#0b1115"; g.fillRect(0, 0, 1280, 720);
    g.strokeStyle = "rgba(140,200,220,.05)"; g.lineWidth = 1; for (let x = 0; x <= 1280; x += 20) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, 720); g.stroke(); } for (let y = 0; y <= 720; y += 20) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(1280, y + 0.5); g.stroke(); }
    // floors: planks in the bunk room, tiles in the mess, a rug in the lounge, concrete in the workshop
    const room = (x, y, w, hh, col) => { g.fillStyle = col; g.fillRect(x, y, w, hh); };
    room(70, 110, 320, 270, "#1b1712"); room(390, 110, 400, 270, "#161b1e"); room(70, 380, 400, 310, "#181513"); room(470, 380, 320, 310, "#15181a");
    g.strokeStyle = "rgba(255,255,255,.035)"; for (let y = 118; y < 380; y += 16) { g.beginPath(); g.moveTo(70, y); g.lineTo(390, y); g.stroke(); }
    for (let x = 390; x < 790; x += 28) for (let y = 110; y < 380; y += 28) { g.strokeRect(x + 0.5, y + 0.5, 28, 28); }
    g.fillStyle = "#3a2420"; g.beginPath(); g.roundRect(120, 470, 260, 150, 10); g.fill(); g.strokeStyle = "#6a4030"; g.lineWidth = 3; g.beginPath(); g.roundRect(132, 482, 236, 126, 6); g.stroke();
    // furniture, as a plan shows it
    const box = (x, y, w, hh, f, s) => { g.fillStyle = f; g.fillRect(x, y, w, hh); g.strokeStyle = s || "#5a7884"; g.lineWidth = 1.5; g.strokeRect(x + 0.5, y + 0.5, w, hh); };
    for (const bx of [100, 200, 300]) { box(bx, 130, 64, 100, "#2a3238"); box(bx + 6, 136, 52, 22, "#d8d2c4", "#8a8478"); box(bx + 4, 162, 56, 62, "#34505c"); }   // bunks: pillow, blanket
    box(450, 240, 300, 46, "#4a3626", "#8a6a4a");   // the mess table and its stools
    for (let k = 0; k < 6; k++) { g.fillStyle = "#3a2a1e"; g.beginPath(); g.arc(475 + k * 50, 228, 8, 0, 6.29); g.fill(); g.beginPath(); g.arc(475 + k * 50, 298, 8, 0, 6.29); g.fill(); }
    box(400, 120, 380, 30, "#2a2e32"); for (let k = 0; k < 3; k++) { g.strokeStyle = "#7a8a94"; g.beginPath(); g.arc(440 + k * 40, 135, 9, 0, 6.29); g.stroke(); }   // the counter and the stove
    box(100, 410, 170, 44, "#3c4a5a", "#7890a8"); box(100, 410, 170, 14, "#4a5c70", "#7890a8");   // the sofa, a low table, the old television, the shelf
    box(150, 500, 90, 50, "#4a3626", "#8a6a4a"); box(390, 400, 60, 20, "#111", "#8a94a0"); box(76, 600, 30, 80, "#3a2a1e", "#8a6a4a");
    for (let k = 0; k < 5; k++) box(78, 604 + k * 15, 26, 10, ["#8a3a3a", "#3a6a8a", "#8a7a3a", "#4a7a4a", "#6a4a8a"][k], "rgba(0,0,0,.3)");
    box(500, 400, 160, 50, "#3a3f44", "#8a94a0");   // the workbench, crates, the radio with its aerial
    for (const [x, y] of [[700, 420], [740, 420], [720, 460], [700, 600], [740, 640]]) { box(x, y, 36, 36, "#5a4630", "#9a7a50"); g.strokeStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 36, y + 36); g.moveTo(x + 36, y); g.lineTo(x, y + 36); g.stroke(); }
    box(500, 620, 60, 40, "#2a3a30", "#6a9a7a"); g.strokeStyle = "#6a9a7a"; g.beginPath(); g.moveTo(552, 620); g.lineTo(570, 596); g.stroke();
    // walls, with the doorways left open
    g.strokeStyle = "#8fd3ff"; g.lineWidth = 5; g.lineCap = "square";
    const wall = (pts) => { g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.stroke(); };
    wall([[70, 110], [790, 110], [790, 690], [70, 690], [70, 110]]);
    g.lineWidth = 3; wall([[390, 110], [390, 200]]); wall([[390, 290], [390, 380]]); wall([[70, 380], [180, 380]]); wall([[280, 380], [560, 380]]); wall([[660, 380], [790, 380]]); wall([[470, 380], [470, 470]]); wall([[470, 570], [470, 690]]);
    g.fillStyle = "#0b1115"; g.fillRect(380, 682, 120, 16); g.strokeStyle = "#ffb35a"; g.lineWidth = 3; g.beginPath(); g.moveTo(380, 690); g.lineTo(500, 690); g.setLineDash([6, 6]); g.stroke(); g.setLineDash([]);   // the way out
    // the labels a plan has
    g.fillStyle = "rgba(143,211,255,.55)"; g.font = "bold 14px sans-serif";
    g.fillText("침실", 80, 372); g.fillText("식당", 400, 372); g.fillText("휴게실", 116, 682 - 8); g.fillText("작업실", 480, 682 - 8);
    g.fillStyle = "rgba(255,179,90,.8)"; g.font = "12px sans-serif"; g.fillText("출입구", 418, 710);
    g.fillStyle = "rgba(143,211,255,.4)"; g.font = "11px sans-serif"; g.fillText("SHELTER · FLOOR PLAN · B1", 76, 102);
    return (DORM_ART = c);
  }
  // ---------- a walk for the chibis outside battle: the standing frame cut at the hips, the legs stepping, the body bobbing over them ----------
  // (the puppets only know how to stand and fight, so a walk is built from their standing frame, as the enemies' marching is)
  const WALKERS = {}, WALK_TRY = {};
  function walkerOf(id) {
    if (WALKERS[id]) return WALKERS[id];
    if ((WALK_TRY[id] || 0) > 6) return null;
    const KR = 200, W = 440, H = 480, FX = 220, FY = 440;
    const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
    try { B.drawChar(g, id, FX, FY, KR, { t: 1.0, face: 1 }); } catch (e) { WALK_TRY[id] = (WALK_TRY[id] || 0) + 1; return null; }
    const d = g.getImageData(0, 0, W, H).data;
    let top = H, bot = 0, n = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x += 2) if (d[(y * W + x) * 4 + 3] > 60) { n++; if (y < top) top = y; if (y > bot) bot = y; }
    if (n < 800) { WALK_TRY[id] = (WALK_TRY[id] || 0) + 1; return null; }   // the puppet has not loaded its pictures yet
    const hgt = bot - top, al = (x, y) => d[(y * W + x) * 4 + 3] > 90;
    const SPECIAL = { capy: "glide", skakea: "glide", piania: "glide", nana: "glide", teka: "float", smoqueen: "float", brick: "hop" };   // on wheels, on a chair, at a piano, kneeling; hovering; a brick
    if (SPECIAL[id]) return (WALKERS[id] = { KR, FX, FY, hgt, src: c, kind: SPECIAL[id] });
    // in each row, the solid run through the middle (small gaps closed, so two legs count as one run): weapons, tails and hammers off to the side stay out of it
    const runAt = (y) => { let c0 = -1; for (let dx = 0; dx < 40 && c0 < 0; dx++) { if (al(FX + dx, y)) c0 = FX + dx; else if (al(FX - dx, y)) c0 = FX - dx; } if (c0 < 0) return null;
      let l = c0, r = c0, gap = 0; for (let x = c0; x >= 0; x--) { if (al(x, y)) { l = x; gap = 0; } else if (++gap > 7) break; } gap = 0; for (let x = c0; x < W; x++) { if (al(x, y)) { r = x; gap = 0; } else if (++gap > 7) break; } return [l, r]; };
    const foot = []; for (let y = Math.round(bot - hgt * 0.06); y < bot - 1; y++) { const rn = runAt(y); if (rn) foot.push(rn); }
    if (!foot.length) return (WALKERS[id] = { KR, FX, FY, hgt, src: c, kind: "waddle" });
    const fl = Math.min(...foot.map((r) => r[0])), fr = Math.max(...foot.map((r) => r[1])), fw = fr - fl;
    // the hip: going up from the feet, where the run widens into a skirt or a coat (or a quarter of the height for plain legs)
    let hip = Math.round(bot - hgt * 0.25);
    for (let y = Math.round(bot - hgt * 0.07); y > bot - hgt * 0.25; y--) { const rn = runAt(y); if (rn && rn[1] - rn[0] > fw * 1.7 + 6) { hip = y + 2; break; } }
    const legLen = bot - hip, narrow = legLen > hgt * 0.13;
    let sx = 0, sn = 0; for (let y = Math.round(bot - hgt * 0.06); y < bot - 1; y++) for (let x = fl; x <= fr; x++) if (al(x, y)) { sx += x; sn++; }
    const split = Math.round(sn ? sx / sn : (fl + fr) / 2), L0 = Math.max(0, fl - 6), R0 = Math.min(W, fr + 7), ov = 3, keep = Math.round(legLen * 0.28);
    const body = document.createElement("canvas"); body.width = W; body.height = H; const bg2 = body.getContext("2d"); bg2.drawImage(c, 0, 0);
    bg2.clearRect(L0, hip + keep, R0 - L0, H);   // the legs come out of the body; the rest (a tail, a weapon's head) stays
    const legs = [[L0, split], [split, R0]].map(([x0, x1]) => {
      const lc = document.createElement("canvas"); lc.width = Math.max(1, x1 - x0); lc.height = bot - hip + ov + 8;
      lc.getContext("2d").drawImage(c, x0, hip - ov, lc.width, lc.height, 0, 0, lc.width, lc.height);
      return { c: lc, x0, y0: hip - ov, px: (x1 - x0) / 2, py: ov + 1 };
    });
    const out = { KR, FX, FY, hgt, src: c, kind: "legs", body, legs, amp: narrow ? 1 : 0.6 };
    return (WALKERS[id] = out);
  }
  window.__tdWalkSheet = (ids) => {   // test hook: every walker at four phases on one sheet
    const c = document.createElement("canvas"), cols = 8, cw = 150, chh = 170; c.width = cols * cw; c.height = Math.ceil(ids.length * 4 / cols) * chh; const g = c.getContext("2d"); g.fillStyle = "#555"; g.fillRect(0, 0, c.width, c.height);
    ids.forEach((id, i) => { const w = walkerOf(id); for (let p = 0; p < 4; p++) { const n = i * 4 + p, x = (n % cols) * cw + cw / 2, y = Math.floor(n / cols) * chh + chh - 14; g.fillStyle = "#fff"; g.font = "11px sans-serif"; g.fillText(id + (w ? " " + w.kind : " -"), x - 70, y + 12); if (w) drawWalker(g, w, x, y, 110, 1, p * Math.PI / 2, 1); } });
    return c.toDataURL();
  };
  // draw it with the foot at (x, y); ph: step phase, amp: 0 standing .. 1 striding
  function drawWalker(g, w, x, y, k, face, ph, amp) {
    const s = k / w.KR; g.save(); g.translate(x, y); g.scale(s * face, s);
    if (w.kind === "legs") {
      const bob = -Math.abs(Math.sin(ph)) * 7 * amp, sw = Math.sin(ph) * 0.42 * amp * w.amp;
      const legAt = (L, a, lift, dark) => {
        g.save(); g.translate(L.x0 + L.px - w.FX, L.y0 + L.py - w.FY + bob * 0.35); g.rotate(a); g.translate(-L.px, -L.py - lift);
        if (dark) g.filter = "brightness(.72)"; g.drawImage(L.c, 0, 0); g.filter = "none"; g.restore();
      };
      legAt(w.legs[0], -sw, Math.max(0, -Math.cos(ph)) * 9 * amp, true);
      g.save(); g.translate(0, bob); g.rotate(0.035 * amp + Math.sin(ph * 2) * 0.012 * amp); g.drawImage(w.body, -w.FX, -w.FY); g.restore();
      legAt(w.legs[1], sw, Math.max(0, Math.cos(ph)) * 9 * amp, false);
    } else if (w.kind === "glide") { g.translate(0, -Math.abs(Math.sin(ph)) * 3 * amp); g.rotate(0.03 * amp); g.drawImage(w.src, -w.FX, -w.FY);
    } else if (w.kind === "float") { g.translate(0, -10 * amp + Math.sin(ph * 0.5) * 4 * amp); g.rotate(0.06 * amp); g.drawImage(w.src, -w.FX, -w.FY);
    } else if (w.kind === "hop") { const u = Math.abs(Math.sin(ph * 0.5)); g.translate(0, -u * 40 * amp); g.scale(1 + (1 - u) * 0.06 * amp, 1 - (1 - u) * 0.08 * amp); g.drawImage(w.src, -w.FX, -w.FY);
    } else {   // a long skirt or a robe: a little side-to-side waddle instead
      const bob = -Math.abs(Math.sin(ph)) * 8 * amp; g.translate(0, bob); g.rotate(Math.sin(ph) * 0.07 * amp + 0.03 * amp);
      g.scale(1, 1 + Math.abs(Math.cos(ph)) * 0.025 * amp); g.drawImage(w.src, -w.FX, -w.FY);
    }
    g.restore();
  }
  // emotes over a head: a speech bubble that pops in, or for some, the sign itself floating up
  function drawEmote(g, x, y, k, e, clock) {
    const age = e.age, life = e.life, a = Math.min(1, age / 0.12) * Math.min(1, (life - age) / 0.35);
    if (a <= 0) return;
    const pop = age < 0.25 ? 1 + Math.sin(age / 0.25 * Math.PI) * 0.25 : 1, R = Math.max(14, k * 0.13) * pop;
    g.save(); g.globalAlpha = a;
    if (e.c === "z") {   // three z's drifting up and away
      for (let i = 0; i < 3; i++) { const u = ((age * 0.6 + i / 3) % 1); g.globalAlpha = a * Math.sin(u * Math.PI); g.fillStyle = "#cfe6ff"; g.strokeStyle = "rgba(20,30,50,.8)"; g.lineWidth = 3;
        g.font = `900 ${Math.round(R * (0.8 + u * 0.6))}px sans-serif`; g.textAlign = "center"; const zx = x + u * k * 0.25, zy = y - u * k * 0.35; g.strokeText("z", zx, zy); g.fillText("z", zx, zy); }
      g.restore(); return;
    }
    if (e.c === "♪") {   // notes bobbing up
      for (let i = 0; i < 2; i++) { const u = ((age * 0.7 + i * 0.5) % 1); g.globalAlpha = a * Math.sin(u * Math.PI); g.fillStyle = i ? "#ffd36a" : "#8fd3ff"; g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = 3;
        g.font = `900 ${Math.round(R * 1.3)}px sans-serif`; g.textAlign = "center"; const nx = x + Math.sin(u * 6 + i) * k * 0.08 + i * k * 0.12, ny = y - u * k * 0.3; g.strokeText("♪", nx, ny); g.fillText("♪", nx, ny); }
      g.restore(); return;
    }
    // the bubble
    g.translate(x, y); g.scale(pop, pop);
    const r = Math.max(14, k * 0.13);
    g.fillStyle = "#fff"; g.strokeStyle = "rgba(0,0,0,.55)"; g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(0, 0, r * 1.25, r, 0, 0, Math.PI * 2); g.moveTo(-r * 0.4, r * 0.8); g.lineTo(-r * 0.75, r * 1.55); g.lineTo(r * 0.1, r * 0.9); g.closePath(); g.stroke(); g.fill();
    g.beginPath(); g.ellipse(0, 0, r * 1.25 - 1.5, r - 1.5, 0, 0, Math.PI * 2); g.fill();
    if (e.c === "…") { for (let i = 0; i < 3; i++) { const on = Math.floor(age * 4) % 4 > i; g.fillStyle = on ? "#444" : "#c8c8c8"; g.beginPath(); g.arc((i - 1) * r * 0.5, 0, r * 0.15, 0, 6.29); g.fill(); } }
    else { g.fillStyle = { "!": "#f08a1c", "?": "#3a8fd6", "₵": "#d9a400", "♥": "#ff5a7a", "💧": "#4fb8ff" }[e.c] || "#333"; g.font = `900 ${Math.round(r * 1.3)}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(e.c, 0, r * 0.05); }
    g.restore();
  }
  // ---------- the living picture behind a zone or the dorm ----------
  // a painting that breathes (a slow drift, a little parallax under the finger), weather of embers and smoke or dust in the lamplight,
  // and the operators themselves: guards on the zone's own ground, residents going about the dorm
  function livingScene(el, opt) {
    const cv = h("canvas", "bz-cv"); el.appendChild(cv);
    const q = Math.min(1.5, (window.devicePixelRatio || 1)); cv.width = Math.round(1280 * q); cv.height = Math.round(720 * q);
    const g = cv.getContext("2d"), img = opt.bgCanvas || new Image(); if (!opt.bgCanvas) img.src = opt.bg;
    const rr = (a, b) => a + Math.random() * (b - a);
    const actors = opt.actors.map((a, i) => Object.assign({ face: Math.random() < 0.5 ? 1 : -1, t0: rr(0, 10), mode: "idle", until: rr(0.6, 3), tx: a.x, ty: a.y, emo: null, ph: 0, amp: 0 }, a));
    const parts = [];
    let px = 0, py = 0, tpx = 0, tpy = 0, last = performance.now(), clock = 0, acc = 0;
    cv.addEventListener("pointermove", (e) => { const r = cv.getBoundingClientRect(); tpx = ((e.clientX - r.left) / r.width - 0.5) * 2; tpy = ((e.clientY - r.top) / r.height - 0.5) * 2; });
    const spawn = () => {
      if (opt.fx === "fire") {
        if (Math.random() < 0.5) parts.push({ k: "ember", x: rr(0, 1280), y: rr(500, 760), vx: rr(-8, 14), vy: rr(-40, -18), life: rr(3, 6), age: 0, s: rr(1.2, 2.6), w: rr(0, 6) });
        if (Math.random() < 0.06) parts.push({ k: "smoke", x: rr(-100, 1200), y: rr(100, 600), vx: rr(6, 16), vy: rr(-6, -2), life: rr(8, 14), age: 0, s: rr(80, 180) });
      } else {
        if (Math.random() < 0.25) parts.push({ k: "dust", x: rr(0, 1280), y: rr(0, 720), vx: rr(-4, 4), vy: rr(-3, 3), life: rr(5, 9), age: 0, s: rr(0.8, 1.8), w: rr(0, 6) });
      }
    };
    for (let i = 0; i < 120; i++) { spawn(); for (const p of parts) p.age += 0.1; }
    // each person: walking somewhere, working at a spot, resting, talking, or just standing about and looking round
    const emote = (a, c, life = 2.4, delay = 0) => { a.emo = { c, age: -delay, life }; };
    const ACT = { "!": "work", "₵": "work", "z": "rest", "♪": "happy", "…": "think", "?": "think" };
    const think = (a, dt) => {
      a.until -= dt;
      if (a.emo) { a.emo.age += dt; if (a.emo.age > a.emo.life) a.emo = null; }
      const sp = (opt.speed || 60) * (a.sc || 1);
      if (a.mode === "walk") {
        const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
        a.amp = Math.min(1, a.amp + dt * 6);
        if (d < 2) { a.mode = a.act ? ACT[a.act] || "idle" : "idle"; a.until = a.pal ? 0 : a.mode === "rest" ? rr(6, 10) : rr(3.5, 7); if (a.act) emote(a, a.act, a.mode === "rest" ? a.until : 2.6, 0.3); a.act = null; }
        else { const v = Math.min(d, sp * dt * Math.min(1, a.amp * 1.5)); a.x += dx / d * v; a.y += dy / d * v; if (Math.abs(dx) > 2) a.face = dx >= 0 ? 1 : -1; a.ph += v / ((opt.k || 120) * (a.sc || 1) * 0.16); }
        return;
      }
      a.amp = Math.max(0, a.amp - dt * 5);
      for (const o of actors) {   // nobody stands inside anybody: a step aside when too close
        if (o === a || o.mode === "walk") continue; const dx = a.x - o.x, gap = (opt.k || 120) * 0.5 * (a.sc || 1);
        if (Math.abs(dx) < gap && Math.abs(a.y - o.y) < gap * 0.5 && !a.tired) { a.x += (dx >= 0 ? 1 : -1) * Math.min(gap - Math.abs(dx), 40 * dt); a.x = Math.max(60, Math.min(1220, a.x)); }
      }
      if (a.mode === "idle" && Math.random() < dt * 0.15) a.face = -a.face;   // looks round now and then
      if (a.until > 0 || a.tired) return;
      if (a.pal) {   // arrived beside someone: turn to each other and talk a while, taking turns
        const o = a.pal; a.pal = null; a.face = o.x >= a.x ? 1 : -1; a.mode = "chat";
        if (o.mode !== "walk" && !o.tired) { o.face = -a.face; o.mode = "chat"; o.until = Math.max(o.until, 5); emote(o, ["♪", "!", "…"][Math.floor(Math.random() * 3)], 2, 1.6); }
        emote(a, ["…", "?", "♪"][Math.floor(Math.random() * 3)], 2); a.until = rr(4, 6); return;
      }
      const others = actors.filter((o) => o !== a && !o.tired && o.mode !== "walk" && o.mode !== "chat" && !actors.some((q) => q.pal === o));
      if (opt.chat && others.length && Math.random() < 0.16) {   // go over to someone
        const o = others[Math.floor(Math.random() * others.length)], side = a.x < o.x ? -1 : 1;
        a.tx = Math.max(60, Math.min(1220, o.x + side * (opt.k || 120) * 0.62 * (o.sc || 1))); a.ty = o.y + rr(-4, 4); a.pal = o; a.mode = "walk";
        o.until = Math.max(o.until, Math.hypot(a.tx - a.x, a.ty - a.y) / sp + 1.5); return;   // the other one waits to be talked to
      }
      const n = opt.next(a); if (n) { a.tx = n[0]; a.ty = n[1]; a.act = n[2] || null; a.mode = "walk"; } else a.until = rr(2, 5);
    };
    const frame = (now) => {
      if (!cv.isConnected) return;
      requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000); last = now; acc += dt; if (acc < 1 / 32) return;   // thirty frames is plenty for a picture that breathes
      const st = acc; acc = 0; clock += st;
      px += (tpx - px) * Math.min(1, st * 2); py += (tpy - py) * Math.min(1, st * 2);
      for (let i = 0; i < (opt.fx === "fire" ? 2 : 1); i++) spawn();
      g.setTransform(q, 0, 0, q, 0, 0); g.fillStyle = "#08090b"; g.fillRect(0, 0, 1280, 720);
      // the painting: a slow breath of scale and a drift, the finger's parallax on top
      const sc = (opt.zoom || 1.06) + Math.sin(clock * 0.13) * 0.012 * (opt.zoom ? 0.4 : 1), ox = Math.sin(clock * 0.07) * 10 - px * 14, oy = Math.cos(clock * 0.09) * 6 - py * 8;
      const hw = 664 / sc, hh = 380 / sc, ccx = Math.max(hw, Math.min(1280 - hw, opt.cx || 640)), ccy = Math.max(hh, Math.min(720 - hh, opt.cy || 360));   // a framed view keeps the painting filling it
      g.save(); g.translate(640 + ox, 360 + oy); g.scale(sc, sc); g.translate(-ccx, -ccy);
      if (opt.bgCanvas || (img.complete && img.naturalWidth)) g.drawImage(img, 0, 0, 1280, 720);
      if (opt.tint) { g.fillStyle = opt.tint; g.fillRect(0, 0, 1280, 720); }
      if (opt.lamp) {   // warm pools of light that breathe a little, like lamps on a weak line
        g.globalCompositeOperation = "lighter";
        for (const [lx, ly, lr] of opt.lamp) { const fl = 0.18 + Math.sin(clock * 3 + lx) * 0.02 + (Math.random() < 0.02 ? -0.08 : 0), gr = g.createRadialGradient(lx, ly, 0, lx, ly, lr); gr.addColorStop(0, `rgba(255,190,110,${fl})`); gr.addColorStop(1, "rgba(255,190,110,0)"); g.fillStyle = gr; g.fillRect(lx - lr, ly - lr, lr * 2, lr * 2); }
        g.globalCompositeOperation = "source-over";
      }
      // the people, back to front
      for (const a of actors) think(a, st);
      actors.slice().sort((a, b) => a.y - b.y).forEach((a) => {
        const k = (opt.k || 120) * (a.sc || 1), t = clock + a.t0;
        g.save(); g.globalAlpha = 0.32; g.fillStyle = "#000"; g.beginPath(); g.ellipse(a.x, a.y, k * 0.26 * (1 - Math.abs(Math.sin(a.ph)) * 0.12 * a.amp), k * 0.065, 0, 0, Math.PI * 2); g.fill(); g.restore();
        const w = a.amp > 0.04 ? walkerOf(a.id) : null;
        g.save();
        if (w) drawWalker(g, w, a.x, a.y, k, a.face, a.ph, a.amp);
        else {
          let tt = t;
          g.translate(a.x, a.y);
          if (a.tired) { g.scale(1, 0.9); g.rotate(a.face * 0.06); g.globalAlpha = 0.85; g.filter = "brightness(.62) saturate(.5)"; tt = 0; }
          else if (a.mode === "work") { const b = Math.max(0, Math.sin(t * 6.5)); g.rotate(a.face * (0.07 + b * 0.04)); g.scale(1 + b * 0.015, 1 - b * 0.035); }   // bent to the task, a steady rhythm
          else if (a.mode === "rest") { g.rotate(-a.face * 0.05); g.scale(1, 0.97 + Math.sin(t * 1.2) * 0.012); tt = t * 0.45; }   // leaning back, breathing slow
          else if (a.mode === "happy") { const hp = Math.abs(Math.sin(t * 3.4)); g.translate(0, -hp * k * 0.06); g.scale(1 - hp * 0.02, 1 + hp * 0.03); }   // a little bounce on the toes
          else if (a.mode === "think") { g.rotate(Math.sin(t * 0.8) * 0.025); }
          else if (a.mode === "chat") { g.rotate(Math.sin(t * 2.2) * 0.02); g.scale(1, 1 + Math.max(0, Math.sin(t * 4.4)) * 0.012); }
          g.translate(-a.x, -a.y);
          try { B.drawChar(g, a.id, a.x, a.y, k, { t: tt, face: a.face }); } catch (e) { /* a puppet still loading */ }
        }
        g.restore();
        const hx = a.x + a.face * k * 0.18, hy = a.y - k * 1.32;
        if (a.tired) drawEmote(g, hx, hy, k, { c: "z", age: (clock % 6) + 0.3, life: 99 }, clock);
        else if (a.emo && a.emo.age >= 0) drawEmote(g, hx, hy, k, a.emo, clock);
      });
      g.restore();
      // weather
      g.save();
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.age += st; if (p.age > p.life) { parts.splice(i, 1); continue; }
        p.x += p.vx * st + (p.w !== undefined ? Math.sin(clock * 1.3 + p.w) * 0.4 : 0); p.y += p.vy * st;
        const a = Math.sin(p.age / p.life * Math.PI);
        if (p.k === "ember") { g.globalCompositeOperation = "lighter"; g.fillStyle = `rgba(255,${140 + Math.floor(p.w * 10)},60,${a * 0.9})`; g.beginPath(); g.arc(p.x, p.y, p.s, 0, 6.29); g.fill(); }
        else if (p.k === "smoke") { g.globalCompositeOperation = "source-over"; const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s); gr.addColorStop(0, `rgba(40,38,40,${a * 0.22})`); gr.addColorStop(1, "rgba(40,38,40,0)"); g.fillStyle = gr; g.fillRect(p.x - p.s, p.y - p.s, p.s * 2, p.s * 2); }
        else { g.globalCompositeOperation = "lighter"; g.fillStyle = `rgba(255,230,190,${a * 0.5})`; g.beginPath(); g.arc(p.x, p.y, p.s, 0, 6.29); g.fill(); }
      }
      g.restore();
      if (opt.fx === "fire") {   // the fires' light along the bottom, never quite steady
        const fl = 0.10 + Math.sin(clock * 5.3) * 0.02 + Math.sin(clock * 11.7) * 0.015, gr = g.createLinearGradient(0, 720, 0, 380);
        gr.addColorStop(0, `rgba(255,110,40,${fl})`); gr.addColorStop(1, "rgba(255,110,40,0)"); g.globalCompositeOperation = "lighter"; g.fillStyle = gr; g.fillRect(0, 380, 1280, 340); g.globalCompositeOperation = "source-over";
      }
      const vg = g.createRadialGradient(640, 360, 300, 640, 360, 820); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.55)"); g.fillStyle = vg; g.fillRect(0, 0, 1280, 720);
    };
    requestAnimationFrame(frame);
    return { cv, actors };
  }
  // where guards stand on a zone: the open squares nearest the protected point, as the battle camera sees them
  function zoneSpots(code) {
    const i = zoneIdx(code), st = TD.STAGES[i], rows = st.map; if (!rows) return { spots: [[500, 450], [640, 470], [780, 450]], k: 110, all: [] };
    let bx = 0, by = 0; rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === "B") { bx = x; by = y; } }));
    const P = (x, y) => B.project(i, x, y), w = Math.hypot(P(1, 0)[0] - P(0, 0)[0], P(1, 0)[1] - P(0, 0)[1]);
    // only squares left of the panel and clear of the top bar count; of those, the ones nearest the protected point
    const open = []; rows.forEach((r, y) => [...r].forEach((c, x) => { const q = P(x, y); if (c === "." && q[0] > 110 && q[0] < 760 && q[1] > 200 && q[1] < 690) open.push([x, y, Math.hypot(x - bx, y - by)]); }));
    open.sort((a, b) => a[2] - b[2]);
    if (!open.length) return { spots: [[420, 470], [540, 500], [660, 470]], all: [[420, 470], [540, 500], [660, 470]], k: w * 0.95 };
    return { spots: open.slice(0, 3).map(([x, y]) => P(x, y)), all: open.slice(0, 10).map(([x, y]) => P(x, y)), k: w * 0.95 };
  }
  // what one clear of an operation hands out besides coin: its records or books, rolls for materials; a supply operation, its chips
  function rollDrops(sel) {
    const s = TD.STAGES[sel], m = STAGE_META[sel];
    if (m.supply) return EC.supplyDrops(m.supply, m.tier, Math.random);
    const dr = EC.DROPS[s.code]; if (!dr) return [];
    const out = dr.fixed.slice();
    for (const [k, p] of dr.roll) if (Math.random() < p) out.push([k, k.startsWith("m1_") && Math.random() < 0.3 ? 2 : 1]);
    return out;
  }
  // operator experience: the records needed to cover some EXP, biggest first, without wasting a big one where small ones do
  const RECS = [["rec3", 1000], ["rec2", 400], ["rec1", 200]];
  function recPlan(need) {
    const use = {}; let rem = need;
    for (const [k, v] of RECS) { const n = Math.min(inv(k), Math.floor(rem / v)); if (n) { use[k] = n; rem -= n * v; } }
    if (rem > 0) { for (const [k, v] of RECS.slice().reverse()) if (inv(k) - (use[k] || 0) > 0) { use[k] = (use[k] || 0) + 1; rem -= v; break; } }
    if (rem > 0) return null;
    return { use, exp: need - rem };
  }
  const recExp = () => RECS.reduce((a, [k, v]) => a + inv(k) * v, 0);
  const expTo = (o, to) => { let e = -(o.xp || 0); for (let lv = o.lvl; lv < to; lv++) e += EC.expNeed(o.elite, lv); return Math.max(0, e); };
  const coinFor = (exp) => Math.round(exp * EC.coinPerExp);

  // a stage's rewards in full, by kind, each item tappable for its card
  function rewardSheet(sel) {
    const s = TD.STAGES[sel], m = STAGE_META[sel], rec = S.stages[s.code] || {}, dp = dropPreview(sel);
    const w = h("div", "itm-m rw-m"); w.onclick = (e) => { if (e.target === w) w.remove(); };
    const cell = (k, n, tag, got) => `<div class="btn rw-it${got ? " got" : ""}" data-k="${k}"><div class="ci">${icn(ITEM[k].ic)}</div><b class="en">${n}</b>${tag ? `<em>${tag}</em>` : ""}<span>${ITEM[k].n}</span></div>`;
    w.innerHTML = `<div class="rw-b"><div class="rw-h"><b>보상</b><span class="en">${s.code} ${esc(s.name)}</span></div>
      ${m.first.orb ? `<div class="rw-sec"><div class="lb">첫 클리어 보상</div><div class="row">${cell("orb", fmt(m.first.orb), rec.clears ? "획득 완료" : "", !!rec.clears)}</div></div>` : ""}
      <div class="rw-sec"><div class="lb">고정 보상</div><div class="row">${cell("coin", fmt(m.coin), "")}${cell("exp", fmt(m.exp), "")}${dp.filter((d) => !d[2]).map(([k, n]) => cell(k, n, "")).join("")}</div></div>
      ${dp.some((d) => d[2]) ? `<div class="rw-sec"><div class="lb">확률 보상</div><div class="row">${dp.filter((d) => d[2]).map(([k, n, t]) => cell(k, n || "", t)).join("")}</div>${m.supply ? `<p>${EC.SUPPLY[m.supply].mat ? "보강 자재는 클리어할 때마다 나오고, 강화 골조는 확률로 더해진다." : "클리어할 때마다 칩이 하나 이상 나온다."}</p>` : `<p>재료는 확률로 나온다. 높은 등급일수록 드물다.</p>`}</div>` : ""}
      <div class="rw-sec"><div class="lb">평가 보상</div><div class="row">${cell("coin", "+200", "별 1개마다")}</div><p>받은 별 하나마다 주화 200이 더해진다. 실패하면 소모한 기력 중 ${m.cost - 1}을 돌려받는다.</p></div></div>`;
    const x = h("div", "btn itm-x", "✕"); x.onclick = () => w.remove(); w.firstChild.appendChild(x);
    w.querySelectorAll(".rw-it").forEach((c) => c.onclick = () => itemInfo(c.dataset.k, HAVE[c.dataset.k]()));
    sheet.appendChild(w);
  }
  // what an operation shows it gives: the sure things first, then what it may drop
  function dropPreview(sel) {
    const s = TD.STAGES[sel], m = STAGE_META[sel];
    if (m.supply) return EC.supplyPreview(m.supply, m.tier);
    const dr = EC.DROPS[s.code]; if (!dr) return [];
    const all = [...dr.fixed.map(([k, n]) => [k, n, ""]), ...dr.roll.slice().sort((a, b) => b[1] - a[1]).map(([k, p]) => [k, "", p >= 0.3 ? "가끔" : p >= 0.12 ? "드묾" : "희귀"])];
    return all.sort((a, b) => (b[0] === dr.main) - (a[0] === dr.main));   // the main drop leads
  }
  // what came out of a sweep: a box of everything gained
  function dropBox(title, list, lv) {
    if (window.SFX) SFX.play("reward", 0.7);
    const mo = h("div", "modal"), bx = h("div", "box drop-box");
    bx.innerHTML = `<h3>${esc(title)}</h3>${lv ? `<p>수신자 레벨이 올랐습니다.</p>` : ""}<div class="sk-cost">${list.map(([k, n]) => itemDot(k, n, { text: "+" + fmt(n) })).join("")}</div>`;
    wireDots(bx);
    const row = h("div", "row"), ok = h("div", "btn", "확인"); ok.onclick = () => mo.remove(); row.appendChild(ok); bx.appendChild(row);
    mo.appendChild(bx); mo.onclick = (e) => { if (e.target === mo) mo.remove(); }; sheet.appendChild(mo);
  }
  // skill level: books and materials (and from 5 on, the first promotion), shared by all of an operator's skills
  function skillUpBox(id, after) {
    const o = S.ops[id], to = (o.sl || 1) + 1, c = EC.skillCost(id, to); if (!c) return;
    const eOk = o.elite >= c.elite, ok = eOk && hasItems(c.items) && S.res.coin >= c.coin;
    const mo = h("div", "modal"), bx = h("div", "box sk-box");
    bx.innerHTML = `<h3>스킬 레벨 ${to - 1} → ${to}</h3><p>모든 스킬에 적용됩니다. 레벨마다 스킬의 효과 수치가 오르고, 필요 SP가 줄고, 초기 SP와 지속 시간이 늘어납니다.${c.elite ? `<br>정예화 ${c.elite} 이후 강화할 수 있습니다.` : ""}</p>
      <div class="sk-cost">${c.items.map(([k, n]) => itemDot(k, n, { text: `${fmt(inv(k))}<small>/${n}</small>`, short: inv(k) < n })).join("")}<div class="idot coin${S.res.coin < c.coin ? " short" : ""}"><i class="cn">₵</i><b class="en">${fmt(c.coin)}</b></div></div>`;
    wireDots(bx);
    const row = h("div", "row"), no = h("div", "btn n", "취소"), yes = h("div", "btn" + (ok ? "" : " dis"), eOk ? "강화" : `정예화 ${c.elite} 필요`);
    no.onclick = () => mo.remove();
    yes.onclick = () => { if (!eOk) return toast(`정예화 ${c.elite} 이후 강화할 수 있습니다`); if (!ok) return toast("재료가 부족합니다");
      takeItems(c.items); S.res.coin -= c.coin; o.sl = to; save(); mo.remove(); toast(`스킬 레벨 ${to} 달성`); after && after(); };
    row.append(no, yes); bx.appendChild(row); mo.appendChild(bx); mo.onclick = (e) => { if (e.target === mo) mo.remove(); }; sheet.appendChild(mo);
  }
  // 반복 소탕: an operation already won with three stars, cleared again without playing — stamina in, the usual rewards out
  function sweepBox(sel) {
    tickStamina();
    const s = TD.STAGES[sel], m = STAGE_META[sel], rec = S.stages[s.code] || {};
    const most = Math.min(10, Math.floor(S.res.stam / m.cost));
    if (most < 1) return toast(`기력이 부족합니다 (필요 ${m.cost})`);
    let n = Math.min(most, 1);
    const per = m.coin + 3 * 200;
    const mo = h("div", "modal"), bx = h("div", "box sw-box");
    const paint = () => {
      bx.innerHTML = `<h3>반복 소탕 <span class="en" style="color:#9aa0aa;font-size:17px;margin-left:8px">${s.code} ${esc(s.name)}</span></h3>
        <p>별 3개로 클리어한 작전을 다시 치르지 않고 마칩니다. 보상은 별 3개 클리어와 같습니다.</p>
        <div class="sw-n"><div class="btn sw-b" data-d="-1">−</div><b class="en">${n}</b><span>회</span><div class="btn sw-b" data-d="1">+</div><div class="btn sw-b sw-max" data-d="99">최대</div></div>
        <div class="sw-r"><span>기력 <b class="en">-${m.cost * n}</b> <small>(${S.res.stam} 보유)</small></span><span>주화 <b class="en">+${fmt(per * n)}</b></span><span>경험 <b class="en">+${fmt(m.exp * n)}</b></span></div>`;
      const row = h("div", "row"), no = h("div", "btn n", "취소"), ok = h("div", "btn", "소탕 시작");
      no.onclick = () => mo.remove();
      ok.onclick = () => {
        mo.remove(); tickStamina(); if (S.res.stam < m.cost * n) return toast("기력이 부족합니다");
        S.res.stam -= m.cost * n; S.res.coin += per * n; S.exp += m.exp * n; bump("run", n); bump("stam", m.cost * n); if (m.supply) bump("supply", n);
        let got = []; for (let i = 0; i < n; i++) got = got.concat(rollDrops(sel)); got = mergeItems(got); addItems(got);
        let lv = false; while (S.exp >= playerExpNeed()) { S.exp -= playerExpNeed(); S.lvl++; lv = true; S.res.stam = Math.max(S.res.stam, stamMax()); }
        rec.clears = (rec.clears || 0) + n; S.stages[s.code] = rec; save();
        render(); dropBox(`반복 소탕 ${n}회 완료`, [["coin", per * n], ["exp", m.exp * n], ...got], lv);
      };
      row.append(no, ok); bx.appendChild(row);
      bx.querySelectorAll(".sw-b").forEach((b) => b.onclick = () => { n = Math.max(1, Math.min(most, +b.dataset.d === 99 ? most : n + +b.dataset.d)); paint(); });
    };
    paint(); mo.appendChild(bx); mo.onclick = (e) => { if (e.target === mo) mo.remove(); }; sheet.appendChild(mo);
  }
  // the operation panel, after the original
  function stagePanel(el, sel) {
    const s = TD.STAGES[sel], m = STAGE_META[sel], rec = S.stages[s.code] || {};
    const d = h("div", "detail");
    if (m.story) {   // a story-only entry: no squad, no cost, no reward; reading it through counts as clearing it, and it can be read again
      const read = (rec.stars || 0) > 0;
      d.innerHTML = `<div class="hd"><div><div class="op en">STORY <span class="c">${s.code}</span></div><div class="n">${esc(s.name)}</div></div></div>
        <div class="row2"><div class="tx"><div class="recbar">막간<b>${read ? "열람 완료" : "미열람"}</b></div><p>${esc(s.desc)}</p></div></div>`;
      d.onclick = (ev) => ev.stopPropagation();
      const bts = h("div", "tm-bts"), g = h("div", "btn go st", `<i class="wm"><svg viewBox="0 0 120 50"><use href="#wm-net"/></svg></i><div class="a">${read ? "다시 열람" : "스토리 열람"}</div><div class="b"><span>기력 소모 없음</span></div>`);
      g.onclick = () => {
        (S.seen = S.seen || {})[m.story] = 1; save();
        playStory(m.story, () => { const r = S.stages[s.code] || (S.stages[s.code] = { stars: 0, clears: 0 }); r.clears++; r.stars = Math.max(r.stars, 1); save(); go("terminal", sel); });
      };
      bts.append(g); d.appendChild(bts); return d;
    }
    const kinds = foeKinds(s), seen = (k) => !!(S.seen || {})["foe:" + k];
    const keys = [[s.code + ":before", "작전 전"], [s.code + ":after", "작전 후"]].filter(([k]) => STORIES[k]);
    d.innerHTML = `<div class="hd"><div><div class="op en">OPERATION <span class="c">${s.code}</span></div><div class="n">${esc(s.name)}</div></div>
        <div class="medals">${[1, 2, 3].map((k) => `<svg viewBox="0 0 44 48"><use href="#${(rec.stars || 0) >= k ? "md-on" : "md-off"}"/></svg>`).join("")}</div></div>
      <div class="row2">${keys.length ? `<div class="btn storyb"><div class="ic">${icn("ic-story")}</div><div class="t">▶스토리</div></div>` : ""}
        <div class="tx"><div class="recbar">추천 평균 레벨<b>${m.rec || "LV.1"}</b></div><p>${esc(s.desc)}</p></div></div>
      <div class="intel"><div class="btn ibox foes"><div class="h">적 정보</div><div class="th">${kinds.slice(0, 3).map(({ k }) => `<span style="background-image:url(${B.foeIcon(k)});${seen(k) ? "" : "filter:brightness(0)"}"></span>`).join("")}</div><i class="lens">${icn("ic-lens")}</i></div>
        <div class="btn ibox map"><div class="h">맵</div><div class="th" style="background-image:url(${mapImg(s)})"></div><i class="lens">${icn("ic-lens")}</i></div></div>
      <div class="rwrow"><div class="btn l"><span>보상</span><i>${icn("ic-lens")}</i></div>
        ${m.first.orb ? `<div class="btn rwc${rec.clears ? " got" : ""}" data-k="orb"><i>${icn("it-orb")}</i><b class="en">${fmt(m.first.orb)}</b><em>${rec.clears ? "획득 완료" : "첫 클리어"}</em></div>` : ""}
        <div class="btn rwc" data-k="coin"><i>${icn("it-coin")}</i><b class="en">${fmt(m.coin)}+</b></div>
        ${dropPreview(sel).slice(0, m.first.orb ? 3 : 4).map(([k, n, tag]) => `<div class="btn rwc t${ITEM[k].tier || 1}" data-k="${k}"><i>${icn(ITEM[k].ic)}</i><b class="en">${n}</b>${tag ? `<em>${tag}</em>` : ""}</div>`).join("")}</div>`;
    { const bp = d.querySelector(".row2 .tx p"), more = () => bp.classList.toggle("more", bp.scrollTop + bp.clientHeight < bp.scrollHeight - 2); bp.onscroll = more; requestAnimationFrame(more); }   // fade the foot while there is more below
    d.onclick = (ev) => ev.stopPropagation();
    d.querySelector(".ibox.foes").onclick = () => foeSheet(el, s);
    d.querySelector(".ibox.map").onclick = () => mapSheet(el, s);
    d.querySelector(".rwrow .l").onclick = () => rewardSheet(sel);
    d.querySelectorAll(".rwc").forEach((c) => c.onclick = () => itemInfo(c.dataset.k, HAVE[c.dataset.k]()));
    // the story button holds both halves: the one before the operation (once it has been started) and the one after (once cleared)
    const sb = d.querySelector(".storyb");
    if (sb) sb.onclick = (ev) => {
      ev.stopPropagation();
      const old = d.querySelector(".st-pop"); if (old) return old.remove();
      const pop = h("div", "st-pop");
      for (const [k, lab] of keys) {
        const ok = !!(S.seen || {})[k];
        const r = h("div", "btn" + (ok ? "" : " lk"), `<span class="en">${k.endsWith("before") ? "BEFORE" : "AFTER"}</span><b>${lab}</b><i>${ok ? "▶" : k.endsWith("before") ? "작전 개시 후 열림" : "클리어 후 열림"}</i>`);
        r.onclick = () => { if (!ok) return; pop.remove(); playStory(k); };
        pop.appendChild(r);
      }
      sb.appendChild(pop);
    };
    const bts = h("div", "tm-bts");
    // before three stars: practise for free; at three stars the left button sweeps the operation instead, as many times as the stamina allows
    const sweep = (rec.stars || 0) >= 3;
    const pr = h("div", "btn tm-pr" + (sweep ? " sw" : ""), `<i class="wm"><svg viewBox="0 0 120 50"><use href="#wm-net"/></svg></i><div class="a">${sweep ? "반복 소탕" : "연습"}</div><div class="b">${sweep ? `기력 -${m.cost} / 회` : "기력 소모 없음"}</div>`);
    pr.onclick = () => shutToday(sel) ? toast("오늘은 닫혀 있는 작전입니다") : sweep ? sweepBox(sel) : go("prep", { sel, practice: true });
    const g = h("div", "btn go", `<i class="wm"><svg viewBox="0 0 120 50"><use href="#wm-net"/></svg></i><div class="a">작전개시</div><div class="b"><i>${icn("it-stam")}</i><span class="en">-${m.cost}</span></div>`);
    g.onclick = () => shutToday(sel) ? toast("오늘은 닫혀 있는 작전입니다") : go("prep", sel);
    bts.append(pr, g); d.appendChild(bts);
    return d;
  }
  // the archive's icons, and its four records drawn as objects: a file, a recorder, a video tape on a notebook, a case
  const OF_IC = {
    file: `<svg viewBox="0 0 30 30"><path d="M8 4h8l2 2h4v20H8z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M11 11h8M11 15h8M11 19h4" stroke="currentColor" stroke-width="2"/><circle cx="21" cy="21" r="3" fill="currentColor"/><path d="M16 28c0-3 2-4 5-4s5 1 5 4" fill="currentColor"/></svg>`,
    tape: `<svg viewBox="0 0 30 30"><rect x="9" y="3" width="12" height="24" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="15" cy="10" r="2.6" fill="currentColor"/><circle cx="15" cy="19" r="2.6" fill="currentColor"/></svg>`,
    mod: `<svg viewBox="0 0 30 30"><path d="M15 3l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="currentColor"/></svg>`,
  };
  const OF_ITEM = {
    file: `<svg viewBox="0 0 160 110"><g transform="rotate(-6 80 55)"><rect x="40" y="18" width="88" height="70" fill="#d8d4c8"/><rect x="34" y="12" width="88" height="72" fill="#f4f3ef" stroke="#b9b6ad"/><path d="M44 26h40M44 34h56M44 42h48" stroke="#c9c6bd" stroke-width="3"/><rect x="104" y="20" width="10" height="56" fill="#2f8fd6"/><path d="M60 62l10-14 10 14z" fill="#3a3c42"/></g></svg>`,
    tape: `<svg viewBox="0 0 160 110"><rect x="26" y="16" width="108" height="80" fill="#f2f2f0" stroke="#b9b9b5"/><path d="M26 22h108" stroke="#8a8a86" stroke-dasharray="3 3"/><rect x="40" y="38" width="80" height="44" rx="3" fill="#1f2022"/><rect x="52" y="44" width="56" height="18" fill="#e8e05a"/><path d="M56 50h40M56 56h28" stroke="#5a8f2b" stroke-width="2.5"/><rect x="44" y="84" width="88" height="5" fill="#3aa65a" transform="rotate(-8 88 86)"/></svg>`,
    case: `<svg viewBox="0 0 160 110"><rect x="30" y="20" width="100" height="72" rx="6" fill="#4b5240"/><rect x="36" y="26" width="88" height="60" rx="4" fill="#3d4334"/><rect x="48" y="30" width="34" height="46" fill="#efeee8"/><path d="M52 36h26M52 42h22M52 48h26" stroke="#c23a2a" stroke-width="2.5"/><rect x="86" y="34" width="8" height="40" fill="#c23a2a"/><rect x="98" y="34" width="20" height="10" fill="#7a9ac0"/></svg>`,
  };
  // ---------- operator file helpers ----------
  const r4 = (d) => d.skills.length > 1 && d.rarity >= 4;
  const ARROW = `<svg viewBox="0 0 24 24" class="arw"><path d="M4 12h14M12 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>`;
  const STAT_IC = {
    hp: `<svg viewBox="0 0 20 20"><path d="M8 2h4v6h6v4h-6v6H8v-6H2V8h6z" fill="currentColor"/></svg>`,
    atk: `<svg viewBox="0 0 20 20"><path d="M16 2l2 2-9 9-2-2zM5 11l4 4-1.5 1.5-1.2-1.2L3.5 18 2 16.5l2.7-2.8-1.2-1.2z" fill="currentColor"/></svg>`,
    def: `<svg viewBox="0 0 20 20"><path d="M10 1l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V4z" fill="currentColor"/></svg>`,
    res: `<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 4l1.6 4.4L16 10l-4.4 1.6L10 16l-1.6-4.4L4 10l4.4-1.6z" fill="currentColor"/></svg>`,
    rd: `<svg viewBox="0 0 20 20"><circle cx="10" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 6v5l3 2M8 1h4" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
    cost: `<svg viewBox="0 0 20 20"><path d="M10 1l8 4.5v9L10 19l-8-4.5v-9z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 6l4 2.3v4.4L10 15l-4-2.3V8.3z" fill="currentColor"/></svg>`,
    blk: `<svg viewBox="0 0 20 20"><path d="M3 3h14v14H3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 7h6v6H7z" fill="currentColor"/></svg>`,
    spd: `<svg viewBox="0 0 20 20"><path d="M2 4l7 6-7 6zM10 4l7 6-7 6z" fill="currentColor"/></svg>`,
  };
  // the growth multiplier at any point, for previews: straight lines inside each promotion, as mult() does for the current one
  function multAt(id, e, lv) { return TD.growth(def(id), e, lv, maxLv(id, e)); }
  function odStats(id, e, lv) {
    const d = def(id), o = S.ops[id], pt = TD.potOf(d, o.pot), mu = multAt(id, e, lv), s = (k) => Math.round(d[k] * mu[k] * (pt[k] || 1));
    const blk = d.blockE ? Object.keys(d.blockE).reduce((b, k) => e >= +k ? d.blockE[k] : b, d.block) : d.block;
    return { hp: s("hp"), atk: s("atk"), def: s("def"), res: d.res + (pt.res || 0), block: blk, interval: d.interval, cost: Math.max(1, d.cost + TD.eliteCost(d, e) - pt.cost), rd: d.redeploy - pt.redeploy };
  }
  // the original speaks of redeploy time and attack speed in words
  const rdWord = (t) => t <= 20 ? "매우 빠름" : t <= 40 ? "빠름" : t <= 60 ? "보통" : t <= 80 ? "느림" : "매우 느림";
  const spdWord = (t) => t < 0.9 ? "매우 빠름" : t < 1.1 ? "빠름" : t < 1.22 ? "보통" : t < 1.5 ? "다소 느림" : t < 2.5 ? "느림" : "매우 느림";
  const skTags = (s) => `<span class="${s.spType === "atk" ? "a" : ""}">${s.spType === "hit" ? "피격 회복" : s.spType === "atk" ? "공격 회복" : "자연 회복"}</span><span class="t">${s.mode === "auto" ? "자동 발동" : "수동 발동"}</span>${s.dur ? `<span class="t">${s.ammo ? "탄약 " + s.dur + "발" : "⏱ " + s.dur + "초"}</span>` : ""}<span class="t">SP ${s.init !== undefined ? s.init + "/" : ""}${s.sp}</span>`;
  // the range as the original draws it: the operator's own tile filled, the reach in outline, facing right
  function rangeBox(key) {
    const R = (TD.RANGE[key] || [[0, 0]]).concat([[0, 0]]);
    const xs = R.map((p) => p[0]), ys = R.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const w = x1 - x0 + 1, hh = y1 - y0 + 1, c = Math.min(15, Math.floor(84 / Math.max(w, hh, 4)));
    const set = new Set(R.map((p) => p[0] + "," + p[1]));
    let cells = "";
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const me = x === 0 && y === 0; if (me || set.has(x + "," + y)) cells += `<i class="${me ? "me" : ""}" style="left:${(x - x0) * (c + 2)}px;top:${(y - y0) * (c + 2)}px;width:${c}px;height:${c}px"></i>`; }
    return `<div class="rgb"><div style="position:relative;width:${w * (c + 2) - 2}px;height:${hh * (c + 2) - 2}px">${cells}</div></div>`;
  }
  function odTags(d) {
    const t = [d.tile === "h" ? "원거리" : "근거리"];
    t.push(d.dmg === "heal" ? "치유" : d.dmg === "arts" ? "마법 피해" : "물리 피해");
    if (d.block >= 3) t.push("방어"); if (d.cleave || d.range === "arts" && d.splash) t.push("범위 공격");
    if (d.redeploy <= 25) t.push("쾌속 재배치");
    if (d.cost <= 12 && d.cls === "선봉") t.push("코스트 회복");
    return t;
  }
  const skMeta = (s) => `${s.mode === "auto" ? "자동 발동" : "수동 발동"} · ${s.spType === "hit" ? "피격 회복" : s.spType === "atk" ? "공격 회복" : "자동 회복"} · SP ${s.init !== undefined ? s.init + " / " : ""}${s.sp}${s.dur ? (s.ammo ? " · 탄약 " + s.dur + "발" : " · " + s.dur + "초") : ""}`;
  // a skill's tile: no painted icons yet, so a mark of its own drawn from the operator's colour and the skill's nature
  const SK_KIND = [
    ["cost", /코스트/, "#d99a00"], ["heal", /회복|치료|치유/, "#2f9a4c"], ["guard", /방어력|받는 피해|보호막|대신 받/, "#2766c4"],
    ["ctrl", /이동 속도|기절|묶|정지|중력|밀어|끌어/, "#178a9c"], ["summon", /소환|낙서|사역마|고용/, "#7440b8"], ["ammo", /탄약/, "#b8202a"],
    ["burst", /주위|범위|모두|전원/, "#c42a22"], ["fast", /공격 속도/, "#c43a22"], ["hit", /./, "#b51f2a"]];
  const SK_GLYPH = {
    cost: `<path d="M20 5l13 7.5v15L20 35 7 27.5v-15z" fill="none" stroke="#fff" stroke-width="3"/><path d="M20 12v16M12 20h16" stroke="#fff" stroke-width="4"/>`,
    heal: `<path d="M15 6h10v9h9v10h-9v9H15v-9H6V15h9z" fill="#fff"/>`,
    guard: `<path d="M20 4l13 5v9c0 9-6 14-13 18-7-4-13-9-13-18V9z" fill="#fff"/><path d="M20 10v20" stroke="rgba(0,0,0,.35)" stroke-width="3"/>`,
    ctrl: `<path d="M20 4v32M6 12l28 16M6 28l28-16" stroke="#fff" stroke-width="3.4"/><circle cx="20" cy="20" r="5" fill="#fff"/>`,
    summon: `<circle cx="20" cy="11" r="6" fill="#fff"/><path d="M8 35c0-9 5-15 12-15s12 6 12 15z" fill="#fff"/>`,
    ammo: `<path d="M8 32V16l3-6 3 6v16zM17 32V12l3-6 3 6v20zM26 32V16l3-6 3 6v16z" fill="#fff"/>`,
    burst: `<path d="M20 2l4 11 11-5-5 11 11 4-11 4 5 11-11-5-4 11-4-11-11 5 5-11L2 22l11-4-5-11 11 5z" fill="#fff"/>`,
    fast: `<path d="M5 8l11 12-11 12h7l11-12L12 8zM18 8l11 12-11 12h7l11-12L25 8z" fill="#fff"/>`,
    hit: `<path d="M30 3l7 3-24 31-6-3z" fill="#fff"/><path d="M19 5l5 2-17 24-4-2z" fill="#fff" opacity=".75"/>`,
  };
  function skKind(s) { const t = (s.name || "") + " " + TD.skillDesc(s); for (const k of SK_KIND) if (k[1].test(t)) return k; return SK_KIND[SK_KIND.length - 1]; }
  // a skill's icon: the painted one from the atlas (8 by 8, in this order); the drawn mark stays as the fallback
  const SKIC_IDS = ["e_mercy", "e_pray", "e_judge", "d_paint", "d_swap", "b_chant", "b_roar", "h_flow", "h_none", "m_bless", "m_rain", "l_strike", "l_ban", "i_welcome", "i_maze", "a_scout", "a_hire", "k_e4", "k_mate", "ke_view", "ke_unity", "sn_cheer", "sn_smite", "eg_insight", "eg_under", "eg_gate", "tk_haste", "tk_field", "cb_wave", "hr_brave", "ll_prank", "ay_eden", "nn_focus", "to_breath", "rb_star", "rb_self", "r6_strike", "r6_twin", "r6_star", "fc_cut", "fc_flip", "vl_draw", "vl_echo", "vl_light", "gs_one", "gs_rain", "an_vine", "an_grove", "an_save", "pn_root", "pn_eternal", "sl_nyala", "sl_astra", "sq_puff", "sq_screen", "sq_star", "bo_rush", "bo_armory", "a2_all", "a2_chain", "k2_place", "k2_fate", "bk_just", "jy_proof"];
  function skIcon(d, i) {
    const sk = d.skills[i] || {}, at = SKIC_IDS.indexOf(sk.id);
    if (at >= 0 && ART.skic_atlas) return `<div class="sk-ic img" style="background-image:url(${ART.skic_atlas});background-position:${(at % 8) * 100 / 7}% ${Math.floor(at / 8) * 100 / 7}%"></div>`;
    const [k, , c] = skKind(sk);
    return `<div class="sk-ic" style="--sc:${c}"><svg viewBox="0 0 40 40">${SK_GLYPH[k]}</svg></div>`;
  }
  // the file's pop-ups: a sheet over the screen, closed by its ✕ or a tap outside
  function odModal(title, en, body) {
    const m = h("div", "odm"), b = h("div", "odm-box");
    b.innerHTML = `<div class="odm-hd"><b>${title}</b><em class="en">${en}</em></div>`;
    const x = h("div", "btn odm-x", `<svg viewBox="0 0 40 40"><path d="M11 11l18 18M29 11L11 29" stroke="currentColor" stroke-width="4"/></svg>`); x.onclick = () => m.remove(); b.appendChild(x);
    const sc = h("div", "odm-sc"); sc.appendChild(body); b.appendChild(sc);
    m.onclick = (e) => { if (e.target === m) m.remove(); };
    m.appendChild(b); sheet.appendChild(m); return m;
  }
  function talentModal(id) {
    const d = def(id), o = S.ops[id], w = h("div", "");
    if (d.sub) w.appendChild(h("div", "tlm tr", `<div class="tlm-k">세부 직군 특성</div><div class="tlm-n"><img src="${clsIcon(id, 18, "#9fd0ff")}" alt=""> ${esc(d.cls)} · ${esc(d.sub)}</div><div class="tlm-d">${kwHtml((ST()[d.sub] || {}).desc || "")}</div>`));
    (d.talents || [d.talent]).filter(Boolean).forEach((T, k) => { const lock = (T.elite || 0) > o.elite;
      w.appendChild(h("div", "tlm" + (lock ? " lock" : ""), `<div class="tlm-k">제${k + 1}재능</div><div class="tlm-n">${esc(T.name)}${lock ? `<i>정예화 ${T.elite} 해금</i>` : ""}</div><div class="tlm-d">${kwHtml(T.desc)}</div>`)); });
    odModal("특성 · 재능", "TRAIT · TALENT", w);
  }
  function potModal(id) {
    const d = def(id), o = S.ops[id], p = o.pot || 1, w = h("div", "");
    w.appendChild(h("div", "ptm-top", `<div class="pot-hex big en">${p}</div><div><b>잠재능력 ${p} / 6</b><span>같은 가사인격과 다시 링크하면 잠재능력이 1 오릅니다.</span></div>`));
    TD.potList(d).forEach(([txt], i) => w.appendChild(h("div", "ptm" + (p >= i + 2 ? " on" : ""), `<div class="pot-hex en">${i + 2}</div><span>${esc(txt)}</span>${p >= i + 2 ? `<i>적용 중</i>` : ""}`)));
    odModal("잠재능력", "POTENTIAL", w);
  }
  // two faces of one person (same true name) never stand on the field together
  const sameSelf = (a, b) => a !== b && def(a) && def(b) && def(a).name === def(b).name;
  const squadIds = () => (S.squads[S.cur] || []).filter((id, i, arr) => S.ops[id] && !arr.slice(0, i).some((q) => sameSelf(q, id)));
  // the squad as the original lays it out: two rows of six cards, big thin arrows to either side, the squads as tabs along the bottom
  function squadView(el, re, arg = {}) {
    const g = h("div", "slots"); el.appendChild(g);
    const sq = S.squads[S.cur];
    for (let i = 0; i < 12; i++) {
      const id = sq[i];
      if (!id || !S.ops[id]) {
        const e = h("div", "btn slot empty", `<i></i>`); if (i > sq.length) e.classList.add("far");
        e.onclick = () => go("roster", { slot: Math.min(i, sq.length), one: true, ret: arg });   // one slot: whoever is tapped fills it
        g.appendChild(e); continue;
      }
      const s = opCard(id); s.classList.add("slot");
      s.onclick = () => go("roster", { slot: i, one: true, ret: arg });   // this slot only: swap who stands in it, or change their skill
      g.appendChild(s);
    }
    const turn = (k) => { S.cur = (S.cur + k + S.squads.length) % S.squads.length; save(); re(); };
    const lf = h("div", "btn sq-arr l"), rt = h("div", "btn sq-arr r"); lf.onclick = () => turn(-1); rt.onclick = () => turn(1); el.append(lf, rt);
    const t = h("div", "sq-tabs");
    S.squads.forEach((q, i) => { const b = h("div", "btn" + (i === S.cur ? " on" : ""), `제${i + 1}편성<small class="en">${q.length}</small>`); b.onclick = () => { S.cur = i; save(); re(); }; t.appendChild(b); });
    el.appendChild(t);
  }

  // the true name surfaces: the alias fades and the full name writes itself in over the new illustration
  function revealName(id) {
    const d = def(id), n = TD.nameOf(d, 9);
    const v = h("div", "reveal btn"); v.style.flexDirection = "column"; v.style.gap = "0";
    const art = h("img", ""); art.src = opArt(id, "full"); Object.assign(art.style, { position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 20%", opacity: "0", transition: "opacity 1.6s" });
    v.appendChild(art);
    const shade = h("div", ""); Object.assign(shade.style, { position: "absolute", inset: "0", background: "linear-gradient(0deg,rgba(0,0,0,.85),transparent 55%)" }); v.appendChild(shade);
    const a = h("div", "", esc(d.alias)); Object.assign(a.style, { position: "absolute", bottom: "150px", fontSize: "30px", color: "#c8ccd4", transition: "opacity 1s, letter-spacing 1.4s", letterSpacing: ".1em" });
    const t = h("div", "", `${esc(n.main)}<span style="font-size:30px;color:#c8ccd4;margin-left:14px">${esc(n.sub)}</span>`); Object.assign(t.style, { position: "absolute", bottom: "70px", fontSize: "64px", fontWeight: "900", opacity: "0", transform: "translateY(16px)", transition: "opacity 1.2s, transform 1.2s" });
    const k = h("div", "en", "TRUE NAME"); Object.assign(k.style, { position: "absolute", bottom: "160px", color: "#ffd400", fontSize: "14px", opacity: "0", transition: "opacity 1s" });
    v.append(a, t, k); sheet.appendChild(v);
    setTimeout(() => { art.style.opacity = 1; }, 50);
    setTimeout(() => { a.style.opacity = 0; a.style.letterSpacing = ".6em"; }, 900);
    setTimeout(() => { t.style.opacity = 1; t.style.transform = "none"; k.style.opacity = 1; }, 1700);
    setTimeout(() => { v.onclick = () => v.remove(); }, 1900);
  }


  // ---------- the enemy file: who walks on in a stage, and how hard they hit ----------
  function foeKinds(s) {   // the kinds in a stage, in the order they first appear, with how many of each
    const out = [], ws = s.march ? Object.values(s.march.parts).flatMap((p) => p.waves.flatMap((w) => Array(w[3] || 1).fill(w))) : s.waves;   // the march: every part's foes
    for (const w of ws) { let f = out.find((q) => q.k === w[1]); if (!f) out.push(f = { k: w[1], n: 0 }); f.n++; }
    return out;
  }
  const foeIco = (k, seen, cls = "") => { const d = TD.ENEMIES[k] || {}; return `<div class="fi${d.boss ? " boss" : ""} ${cls}"><i class="${seen ? "" : "sil"}" style="background-image:url(${B.foeIcon ? B.foeIcon(k) : ""})"></i></div>`; };
  // the original's letter grades, E to S
  function grade(v, cuts) { const L = ["E", "D", "C", "B", "A", "S"]; let i = 0; while (i < cuts.length && v >= cuts[i]) i++; return L[i]; }
  const FOE_CODE = { soldier: "01", dog: "02", strag: "03", hexer: "04", drone: "05", hound: "06", rebel: "07", shooter: "08", scout: "09", airship: "10", shield: "11", heavy: "E1", ney: "B1", boss: "B2", cadoudal: "B3" };
  const FOE_CAT = { soldier: "대육군 망령", hexer: "대육군 망령", heavy: "대육군 망령", hound: "대육군 망령", strag: "대육군 망령", airship: "대육군 망령", shield: "대육군 망령", boss: "대육군 망령", ney: "대육군 망령",
    dog: "망령 짐승", drone: "기계", rebel: "슈앙 망령", shooter: "슈앙 망령", scout: "슈앙 망령", cadoudal: "슈앙 망령" };
  function foeGrades(d) {
    return [["생명", grade(d.hp, [800, 1500, 2500, 4000, 8000])], ["이동 속도", grade(d.speed, [0.4, 0.6, 0.8, 1.2, 1.6])],
      ["공격력", d.atk ? grade(d.atk, [120, 200, 300, 450, 700]) : "-"], ["공격 속도", d.atk ? grade(1 / d.interval, [0.3, 0.4, 0.55, 0.7, 1.0]) : "-"],
      ["방어력", grade(d.def, [30, 100, 200, 400, 700])], ["마법 저항", grade(d.res, [5, 20, 35, 50, 70])]];
  }
  const foeAtk = (k, d) => !d.atk ? "공격 없음" : k === "ney" ? "원거리 저격" : d.ranged ? "원거리 마법" : "근거리 물리";
  // the enemy file, full screen over the blurred stage: cards on the left, the chosen one's page on the right
  function foeSheet(el, s, pick = 0, tab = "all") {
    const o = h("div", "fs"), seen = (k) => !!(S.seen || {})["foe:" + k];
    const all = foeKinds(s), kinds = all.filter(({ k }) => { const d = TD.ENEMIES[k]; return tab === "all" || (tab === "elite" ? d.elite && !d.boss : d.boss); });
    o.innerHTML = `<div class="blur" style="background-image:url(${mapImg(s)})"></div><div class="fsep"></div>`;
    const bk = h("div", "btn bk", "‹"); bk.onclick = () => o.remove(); o.appendChild(bk);
    const tabs = h("div", "ftabs"); [["all", "전체"], ["elite", "정예"], ["boss", "리더"]].forEach(([k, t]) => { const b = h("div", "btn" + (tab === k ? " on" : ""), t); b.onclick = () => { o.remove(); foeSheet(el, s, 0, k); }; tabs.appendChild(b); });
    o.appendChild(tabs);
    const grid = h("div", "fgrid"), det = h("div", "fdet");
    const show = (i) => {
      grid.querySelectorAll(".fcard").forEach((c, j) => c.classList.toggle("on", j === i));
      if (!kinds[i]) { det.innerHTML = ""; return; }
      const { k, n } = kinds[i], d = TD.ENEMIES[k], sn = seen(k);
      det.innerHTML = sn ? `<div class="cat">${FOE_CAT[k] || "적"}</div><div class="nmr"><span class="tg en">${FOE_CODE[k] || "--"}</span><span class="n">${esc(d.name)}</span></div><div class="at">${foeAtk(k, d)}</div>
        <div class="mid"><div class="pt"><div class="im" style="background-image:url(${B.foeIcon(k)})"></div><div class="wt"><span>무게</span><b class="en">${d.weight}</b></div></div>
        <div class="gr8">${foeGrades(d).map(([a, b]) => `<div>${a}<b class="en">${b}</b></div>`).join("")}</div></div>
        <div class="ds">${(d.info || []).map(esc).join(" ")}${n ? `<br><span style="font-style:normal;color:#ff9aa2">이 작전에서 ${n}회 등장</span>` : ""}</div>`
        : `<div class="cat">???</div><div class="nmr"><span class="tg en">${FOE_CODE[k] || "--"}</span><span class="n">???</span></div><div class="at">정보 없음</div>
        <div class="mid"><div class="pt"><div class="im sil" style="background-image:url(${B.foeIcon(k)})"></div></div></div><div class="ds">아직 조우하지 않은 적입니다. 작전에서 처음 마주치면 기록됩니다.</div>`;
    };
    kinds.forEach(({ k, n }, i) => { const c = h("div", "btn fcard", `<div class="tg en">${FOE_CODE[k] || "--"}</div><div class="im${seen(k) ? "" : " sil"}" style="background-image:url(${B.foeIcon(k)})"></div><div class="cnt en">×${n}</div>`); c.onclick = () => show(i); grid.appendChild(c); });
    o.append(grid, det); el.appendChild(o);
    show(Math.min(pick, kinds.length - 1));
  }
  const MAP_EN = { "BL-01": "BURNING-BACKSTREET", "BL-02": "COLLAPSED-UNDERPASS", "BL-03": "DRY-FOUNTAIN-SQUARE", "BL-04": "WATCHTOWER-PARK", "BL-05": "MART-LOADING-DOCK", "BL-06": "STATION-FORECOURT", "BL-07": "THE-BLOCKADE-LINE" };
  // the picture of an operation's ground: its painting, or for the march (BL-07) the whole field it crosses
  const mapImg = (s) => (s.march && ART[s.march.tex]) || ART[s.bg] || (s.map ? boardPic(s.map) : ART.bg);
  // a board with no painting of its own: drawn as a plan, the way the terminal would show it
  const BOARD_PIC = new Map();
  function boardPic(rows) {
    const key = rows.join("|"); if (BOARD_PIC.has(key)) return BOARD_PIC.get(key);
    const Wd = rows[0].length, Hd = rows.length, c = document.createElement("canvas"); c.width = 1280; c.height = 720; const g = c.getContext("2d");
    const bg = g.createLinearGradient(0, 0, 0, 720); bg.addColorStop(0, "#1a2027"); bg.addColorStop(1, "#0e1216"); g.fillStyle = bg; g.fillRect(0, 0, 1280, 720);
    const k = Math.min(1100 / Wd, 600 / Hd), ox = (1280 - k * Wd) / 2, oy = (720 - k * Hd) / 2;
    const COL = { ".": "#5a606a", "*": "#5d6b7a", "~": "#4c3d2c", "=": "#93adbb", "-": "#5e7d90", ",": "#3e3833", h: "#a3a8b0", S: "#a8323d", B: "#2f6cb0", "#": "#20242a", W: "#6a625a" };
    rows.forEach((r, y) => [...r].forEach((ch, x) => { g.fillStyle = COL[ch] || "#20242a"; g.fillRect(ox + x * k + 2, oy + y * k + 2, k - 4, k - 4);
      if (ch === "h") { g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(ox + x * k + 2, oy + y * k + 2, k - 4, 6); }
      if (ch === "*") { g.strokeStyle = "rgba(160,220,255,.45)"; g.lineWidth = 2; g.strokeRect(ox + x * k + 6, oy + y * k + 6, k - 12, k - 12); }
      if (ch === "S" || ch === "B") { g.strokeStyle = "#fff"; g.lineWidth = 3; g.strokeRect(ox + x * k + 8, oy + y * k + 8, k - 16, k - 16); } }));
    const u = c.toDataURL("image/jpeg", 0.85); BOARD_PIC.set(key, u); return u;
  }
  function mapSheet(el, s) {
    const o = h("div", "fs"), idx = TD.STAGES.indexOf(s), K = 1000 / 1280;
    const img = mapImg(s), pts = (s.march || !s.bg ? [] : B.points ? B.points(idx) : []).map(([ch, x, y]) => { const [px, py] = B.project(idx, x, y); return `<div class="mpt ${ch === "S" ? "r" : "b"}" style="left:${px * K}px;top:${py * K}px"></div>`; }).join("");
    o.innerHTML = `<div class="blur" style="background-image:url(${img})"></div><div class="stripes"></div>
      <div class="mframe" style="background-image:url(${img})${s.march ? ";background-size:contain;background-repeat:no-repeat" : ""}">${pts}<div class="cd">//${s.code}-${String(idx * 37 + 109).padStart(3, "0")}</div><div class="cap">//${MAP_EN[s.code] || s.code}</div></div>`;
    o.onclick = () => o.remove();
    el.appendChild(o);
  }

  // ---------- headhunting ----------
  const banSt = (k) => { const g = (S.gacha = S.gacha || {}); if (!g[k]) g[k] = { pity: k === "std" ? (S.pity || 0) : 0, n: 0, gotF: 0 }; return g[k]; };
  function sixRate(k) { return 2 + Math.max(0, banSt(k).pity - 49) * 2; }
  function pullOne(k, force5) {
    const bn = BANNERS[k], st = banSt(k), six = sixRate(k) / 100;
    let r = Math.random(), rar;
    if (r < six) rar = 6; else if (r < six + 0.08) rar = 5; else if (r < six + 0.58) rar = 4; else rar = 3;
    if (force5 && rar < 5) rar = 5;
    if (!POOL[rar].length) rar = 5;
    st.pity = rar === 6 ? 0 : st.pity + 1; st.n++;
    let id;
    const up = bn.up[rar];
    if (up && rar === 6 && bn.spark && !st.gotF && st.n >= bn.spark) id = up;   // the 150-link promise
    else if (up && Math.random() < 0.5) id = up;
    else { const p = POOL[rar]; id = p[Math.floor(Math.random() * p.length)]; }
    if (id === bn.up[6]) st.gotF = 1;
    return id;
  }
  function pullN(k, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const force = S.newbie === 1 && !S.newbieGot;   // the first ten pulls always hold a five-star or better
      const id = pullOne(k, force);
      if (S.newbie > 0) { S.newbie--; if (def(id).rarity >= 5) S.newbieGot = true; }
      const isNew = !S.ops[id];
      if (isNew) S.ops[id] = { lvl: 1, elite: 0, pot: 1, skill: 0, got: Date.now() };
      else if (S.ops[id].pot < 6) S.ops[id].pot++;
      else S.res.coin += 1000;
      if (isNew || S.ops[id].pot > 1) (S.fresh = S.fresh || {})[id] = 1;
      out.push({ id, isNew });
      S.pulls++;
    }
    save();
    return out;
  }
  function pullStart() {
    const out = [];
    for (const id of START_FIXED) {
      const isNew = !S.ops[id];
      if (isNew) S.ops[id] = { lvl: 1, elite: 0, pot: 1, skill: 0, got: Date.now() };
      else if (S.ops[id].pot < 6) S.ops[id].pot++;
      (S.fresh = S.fresh || {})[id] = 1;
      out.push({ id, isNew }); S.pulls++;
    }
    S.res.start = 0; S.startDone = true;
    const sq = S.squads[S.cur];   // new links join the current squad straight away
    for (const r of out) if (!sq.includes(r.id) && !sq.some((q) => sameSelf(q, r.id)) && sq.length < 12) sq.push(r.id);
    if (S.guide === 2) S.guide = 3;
    save();
    return out;
  }
  function showPulls(el, res, back) {
    const best = Math.max(...res.map((r) => def(r.id).rarity));
    const v = h("div", "reveal"); el.appendChild(v);
    const fl = h("div", "flash"); fl.style.background = `radial-gradient(circle, ${RAR_COL[best]} 0%, transparent 70%)`; v.appendChild(fl);
    const order = res.length > 1 ? res.slice().sort((a, b) => def(a.id).rarity - def(b.id).rarity) : res;
    order.forEach((r, i) => {
      const d = def(r.id), c = h("div", "rv");
      c.style.animationDelay = (0.35 + i * 0.12) + "s";
      c.style.borderColor = RAR_COL[d.rarity];
      const fu = d.art ? opArt(r.id, "full") : opArt(r.id, "card"), [hx] = headOf(fu), bw = res.length === 1 ? 300 : 112, bh = res.length === 1 ? 460 : 400, iw = bh * 640 / 857;
      const px = iw > bw ? Math.max(0, Math.min(100, (bw / 2 - hx * iw) / (bw - iw) * 100)) : 50;   // slide the painting so the face sits in the middle of the strip
      c.innerHTML = `<img src="${fu}" style="object-position:${px.toFixed(1)}% 0%"><div class="glow" style="background:linear-gradient(0deg, ${RAR_COL[d.rarity]}66, transparent 45%)"></div>${r.isNew ? '<div class="nw">NEW</div>' : ""}<div class="nm">${stars(d.rarity)}<br>${esc(nm(r.id).main)}</div>`;
      if (res.length === 1) { c.style.width = "300px"; c.style.height = "460px"; }
      v.appendChild(c);
    });
    const hint = h("div", "", "화면을 눌러 계속"); Object.assign(hint.style, { position: "absolute", bottom: "30px", left: "0", right: "0", textAlign: "center", color: "#888" }); v.appendChild(hint);
    setTimeout(() => { v.classList.add("btn"); v.onclick = () => back && back.start ? startChatter(() => playStory("START:link", () => go("gacha", back))) : go("gacha", back); }, 600);
  }
  // the start link: ten of them wake at once and all talk over each other, until the terminal shuts the line
  const CHATTER = [
    ["lilith", "#c05ad8", "이 몸을 멋대로 소환한 대가는 네놈의---- 히로?!", 1],
    ["hiro", "#ffb04a", "여기는-----", 1],
    ["sunae", "#d02a3a", "오오오오오오옷--- 네놈 백령 사인을 일으켜 이 순애의 현장에 나를", 1],
    ["hakuren", "#cfd8e8", "시끄러워서 좋네~"],
    ["alpha", "#9aa4b0", "윽, 사람이 너무 많은 걸. 무장은 저리 치워."],
    ["tao", "#e8c060", "죄, 죄송합니다! 팔꿈치가 그만—", 1],
    ["ayaki", "#ff9ab8", "좋지 않아요. 으아아아 대포가 머리 위에---!!", 1],
    ["capy", "#ffc840", "(놀란 삑삑거림)"],
    ["teka", "#8a9aff", "아악---!!", 1],
    ["alpha", "#9aa4b0", "보지만 말고 밀어 깔려 죽기 전에!!"],
    ["atat", "#ff5a4a", "@@@@@!! @@@!!", 1],
    ["lilith", "#c05ad8", "이 몸의 힘으로 지켜주마!! 데스 스타----", 1],
    ["hakuren", "#cfd8e8", "시체도 좋아~"],
    [["alpha", "teka"], "#9aa4b0", "좋은 게 아니잖아!!"],
  ];
  const chatLine = (id, col, text) => { const ids = Array.isArray(id) ? id : [id];   // two voices at once get two faces, overlapped
    return `<div style="display:flex">${ids.map((q, k) => `<div class="ic" style="background-image:url(${opArt(q, "card")})${k ? ";margin-left:-22px" : ""}"></div>`).join("")}</div><div class="bb" style="--c:${col}"><div class="n">${ids.map((q) => esc(nm(q).main)).join(" · ")}</div><div class="t">${esc(text)}</div></div>`; };
  function startChatter(done) {
    const el = h("div", "chat"); sheet.appendChild(el);
    const feed = h("div", "feed"); el.appendChild(feed);
    let i = 0, timer = null, ended = false;
    const step = () => {
      if (i >= CHATTER.length) return cut();
      const [id, col, text, cutOff] = CHATTER[i++];
      const ln = h("div", "ln" + (cutOff ? " cut" : ""), chatLine(id, col, text));
      feed.appendChild(ln);
      [...feed.children].forEach((c, k, all) => { if (k < all.length - 3) c.classList.add("old"); });
      while (feed.children.length > 7) feed.firstChild.remove();
      timer = setTimeout(step, i < 6 ? 520 : i < 11 ? 380 : 280);   // the first round tumbles in fast; the second, faster still
    };
    const cut = () => {   // the line goes dead: a burst of static, then the terminal's voice
      if (ended) return; ended = true; clearTimeout(timer);
      el.appendChild(h("div", "glitch"));
      setTimeout(() => {
        feed.remove(); el.querySelector(".glitch").remove();
        el.appendChild(h("div", "sysbox", `<svg class="hex" viewBox="-22 -22 44 44"><polygon points="0,-20 17.3,-10 17.3,10 0,20 -17.3,10 -17.3,-10" fill="none" stroke="#7fe3ff" stroke-width="2.5"/><circle r="6" fill="#7fe3ff"/></svg><div class="lt en">LINK TERMINAL</div><div class="gt">${rubyHtml("사용자의 [정신력|코스트]을 고려해 링크 차단.\n별 일이 없는 이상 수신된 가사인격체는 비가시 상태입니다.")}</div>`));
        el.appendChild(h("div", "more", "▼"));
        setTimeout(() => { el.onclick = () => { el.remove(); done(); }; }, 500);
      }, 420);
    };
    el.onclick = () => { if (!ended) { clearTimeout(timer); while (i < CHATTER.length) { const [id, col, text] = CHATTER[i++]; feed.appendChild(h("div", "ln old", chatLine(id, col, text))); while (feed.children.length > 7) feed.firstChild.remove(); } cut(); } };   // a tap skips to the cut
    setTimeout(step, 250);
  }


  // ---------- the terminal's guide: a dimmed screen, one lit target, a line from the link terminal ----------
  // lines use [base|ruby] like the battle tutorial
  const rubyHtml = (s) => esc(s).replace(/\[([^|\]]+)\|([^\]]+)\]/g, "<ruby>$1<rt>$2</rt></ruby>").replace(/\n/g, "<br>");
  // is it (or something holding it) still mid-way through a one-off entrance animation? looping pulses don't count
  const moving = (el) => { for (let e = el; e && e !== sheet; e = e.parentElement) if (e.getAnimations && e.getAnimations().some((an) => an.playState === "running" && an.effect && an.effect.getComputedTiming().iterations !== Infinity)) return true; return false; };
  let gStepN = 0;
  function guideStep(o) {
    const my = ++gStepN;
    const old = sheet.querySelector(".guide"); if (old) old.remove();
    if (typeof o.target === "string") o = Object.assign({}, o, { target: sheet.querySelector(o.target) });
    if (o.target && !o.target.isConnected) {   // the part was drawn again since: find its new copy by its classes
      const cls = [...o.target.classList].map((c) => "." + CSS.escape(c)).join(""), nt = cls && sheet.querySelector(cls);
      if (!nt) return; const oldT = o.target; o = Object.assign({}, o, { target: nt }); if (!o.onTarget) o.onTarget = () => nt.click(); void oldT;
    }
    // a screen still sliding in would put the lit hole where the button is not yet: measure once it has settled
    if (o.target && (sheet.querySelector(".scr-in, .scr-out") || moving(o.target))) { const wait = h("div", "guide"); sheet.appendChild(wait); return setTimeout(() => { if (my === gStepN) { wait.remove(); guideStep(o); } }, 120); }
    const gd = h("div", "guide" + (o.target ? "" : " dim")); sheet.appendChild(gd);
    let hole = null;
    if (o.target) {
      const sr = sheet.getBoundingClientRect(), k = sr.width / VW, r = o.target.getBoundingClientRect();
      hole = { x: (r.left - sr.left) / k - 6, y: (r.top - sr.top) / k - 6, w: r.width / k + 12, h: r.height / k + 12 };
      const hd = h("div", "hole"); Object.assign(hd.style, { left: hole.x + "px", top: hole.y + "px", width: hole.w + "px", height: hole.h + "px" }); gd.appendChild(hd);
      const fg = h("div", "finger"); Object.assign(fg.style, { left: hole.x + hole.w * 0.62 + "px", top: hole.y + hole.h * 0.62 + "px" }); gd.appendChild(fg);
    }
    if (o.text) {
      const at = o.at || (hole && hole.y > 380 ? "top" : "low");
      const box = h("div", "gbox gb-" + at, `<svg class="hex" viewBox="-22 -22 44 44"><polygon points="0,-20 17.3,-10 17.3,10 0,20 -17.3,10 -17.3,-10" fill="none" stroke="#7fe3ff" stroke-width="2.5"/><circle r="6" fill="#7fe3ff"/></svg><div class="lt en">LINK TERMINAL</div><div class="gt">${rubyHtml(fill(o.text))}</div>${o.tap ? '<div class="ar">▼</div>' : ""}`);
      if (o.pos) { box.style.top = box.style.bottom = "auto"; Object.assign(box.style, o.pos); }
      gd.appendChild(box);
    }
    const t0 = performance.now();
    gd.onclick = (ev) => {
      ev.stopPropagation();
      if (performance.now() - t0 < 350) return;
      if (hole) {
        const sr = sheet.getBoundingClientRect(), k = sr.width / VW, x = (ev.clientX - sr.left) / k, y = (ev.clientY - sr.top) / k;
        if (x >= hole.x && y >= hole.y && x <= hole.x + hole.w && y <= hole.y + hole.h) { gd.remove(); o.onTarget ? o.onTarget() : o.target.click(); }
        return;
      }
      if (o.tap) { gd.remove(); o.next && o.next(); }
    };
  }
  // items shown in a reward box: [kind, amount, label]
  const ITEM_ICON = { bm1: `<i class="gi">${icn("it-bm1")}</i>`, orb: `<i class="gi">${icn("it-orb")}</i>`, coin: `<i class="gi">${icn("it-coin")}</i>`, ticket: `<i class="gi">${icn("it-ticket")}</i>`, start: `<i class="gi">${icn("it-ticket")}</i>` };
  function giftBox(title, items, done) {
    const m = h("div", "gift"); sheet.appendChild(m);
    m.innerHTML = `<div class="gb"><div class="gh en">RECEIVED</div><div class="gtt">${esc(title)}</div><div class="its">${items.map(([k, n, lab]) => `<div class="it"><div class="ic">${ITEM_ICON[k] || ""}</div><div class="n en">×${fmt(n)}</div><div class="l">${esc(lab)}</div></div>`).join("")}</div><div class="btn ok">수령</div></div>`;
    m.querySelector(".ok").onclick = () => { m.remove(); done(); };
  }
  function seq(steps, done) {
    let i = 0;
    const nx = () => {
      if (i >= steps.length) return done && done();
      const s = steps[i++];
      if (s.gift) giftBox(s.gift[0], s.gift[1], () => { s.apply && s.apply(); nx(); });
      else guideStep(Object.assign({ tap: true, next: nx }, s.target && !s.onTarget ? { onTarget: nx } : {}, s));   // a lit step moves on when its target is touched
    };
    nx();
  }
  // ---------- the base's guide, straight after chapter 1's last scene: the base tile, room 1, a site, guards, then what to watch ----------
  function startBaseGuide() {
    playStory("BASE:intro", () => { const b = baseState(); b.intro = 1; S.bguide = 1; save(); go("lobby"); });
  }
  function guideHint(text, pos) {   // a line that stays up while a picker is open and lets every touch through
    const o = sheet.querySelector(".ghint"); if (o) o.remove();
    const d = h("div", "ghint" + (pos ? " " + pos : ""), `<div class="gbox"><svg class="hex" viewBox="-22 -22 44 44"><polygon points="0,-20 17.3,-10 17.3,10 0,20 -17.3,10 -17.3,-10" fill="none" stroke="#7fe3ff" stroke-width="2.5"/><circle r="6" fill="#7fe3ff"/></svg><div class="lt en">LINK TERMINAL</div><div class="gt">${rubyHtml(text)}</div></div>`); sheet.appendChild(d);
    const t = setInterval(() => { if (!d.isConnected) return clearInterval(t); if (!sheet.querySelector(".zm, .bz-sel, .modal")) { clearInterval(t); d.remove(); runBaseGuide(); } }, 300);   // the picker went away without a render
  }
  function runBaseGuide() {
    const g = S.bguide, r = route.name, q = (sel) => sheet.querySelector(sel);
    const oh = q(".ghint"); if (oh) oh.remove();
    requestAnimationFrame(() => {
      if (S.bguide !== g || route.name !== r || q(".story")) return;
      const b = baseState(), R0 = b.rooms[0], to = (n) => { S.bguide = n; save(); };
      const room1 = () => [...sheet.querySelectorAll(".ib-rm")].find((t) => !t.classList.contains("dorm"));
      if (r === "lobby") {
        guideStep({ target: q(".lt-base"), text: g === 1 ? "탈환 구역 관리를 위한 [기반시설|BASE] 단말이 개방되었습니다." : "[기반시설|BASE]로 이동합니다.", onTarget: () => { if (g < 2) to(2); go("base"); } });
      } else if (r === "base" && g <= 2) {
        to(2);
        seq([
          { text: "장마다 [파견실|DISPATCH ROOM] 3칸과 숙소 하나가 열립니다.\n첫 파견실은 바로 쓸 수 있습니다." },
          { text: "파견실 하나가 탈환 구역 하나를 맡습니다.\n그 구역을 지키는 동안, 그곳의 물자가 쌓입니다." },
        ], () => guideStep({ target: room1(), text: "파견실 1로 들어갑니다.", onTarget: () => { to(3); go("room", 0); } }));
      } else if (r === "base" && g < 6) {
        guideStep({ target: room1(), text: "파견실 1로 돌아갑니다.", onTarget: () => go("room", 0) });
      } else if (r === "base" && g === 6) {
        const gift = !S.bgGift;
        seq([
          { text: "파견실 2, 3은 「보강 자재」로 건설합니다.\n보강 자재는 자원 수집의 「자재 야적장」에서 얻을 수 있습니다." },
          ...(gift ? [{ gift: ["기반시설 개방 지원", [["bm1", BB.BUILD.items[0][1], "보강 자재"], ["coin", BB.BUILD.coin, "주화"]]], apply: () => { addItems([["bm1", BB.BUILD.items[0][1]]]); S.res.coin += BB.BUILD.coin; S.bgGift = 1; } }, { text: "두 번째 파견실을 지을 수 있는 자재를 지급했습니다." }] : []),
          { text: "기반시설 안내는 화면 위쪽의 「i」 버튼에서 다시 볼 수 있습니다.\n안내를 종료합니다." },
        ], () => { S.bguide = 0; save(); render(); });
      } else if (r === "room" && route.arg === 0) {
        if (g === 3 && R0.zone) { to(4); return runBaseGuide(); }
        if (g === 4 && R0.g.length) { to(5); return runBaseGuide(); }
        if (g === 3) {
          if (q(".zm, .bz-sel, .modal")) guideHint("먼저 지킬 [채집지|SITE]를 고릅니다.\n지도에서 탈환한 구역을 누르고 「이곳에서 채집」을 선택하십시오.");
          else guideStep({ target: q(".ib-nz .btn"), text: "먼저 지킬 [채집지|SITE]를 고릅니다.", onTarget: () => q(".ib-nz .btn").click() });
        } else if (g === 4) {
          guideStep({ target: q('.rv-tabs .t[data-t="crew"]'), text: "채집지가 정해졌습니다. 이제 경계를 세웁니다.\n[배치 정보|ATTENDANCE]를 엽니다.", onTarget: () => {
            q('.rv-tabs .t[data-t="crew"]').click();
            setTimeout(() => guideStep({ target: q(".rv-dw .chg2"), text: "「인원 교체」에서 경계를 설 가사인격을 고릅니다.", onTarget: () => { q(".rv-dw .chg2").click(); setTimeout(() => guideHint("최대 3명까지 세울 수 있습니다.\n많을수록, 적합 직군일수록 채집이 빨라집니다.\n고른 뒤 「확인」을 누르십시오.", "side"), 50); } }), 380);
          } });
        } else if (g === 5) {
          const cd = q(".rv-cd");
          seq([
            { target: cd, text: "경계가 서면 채집이 시작됩니다. 쌓인 물자는 여기서 [수령|COLLECT]합니다.\n카드를 누르면 채집지를 바꿀 수 있습니다." },
            { text: "경계 중에는 [피로|FATIGUE]가 시간당 " + BB.DRAIN + "씩 줄어듭니다.\n0이 되면 탈진하고, 전원이 탈진하면 채집이 멈춥니다." },
            { text: "지친 가사인격은 숙소로 보내 쉬게 하십시오.\n경계 중에도 작전에는 그대로 데려갈 수 있습니다." },
            { text: "몇 시간마다 망령의 [습격|RAID]이 옵니다.\n경계 인원이 채집지의 권장 육성도보다 약하면 격퇴 확률이 떨어지고, 뚫리면 보관 물자 절반을 잃습니다." },
          ], () => guideStep({ target: q(".top .back"), text: "기반시설 화면으로 돌아갑니다.", onTarget: () => { to(6); go("base"); } }));
        }
      }
    });
  }
  function runGuide() {
    const gd = S.guide, r = route.name, q = (sel) => sheet.querySelector(sel);
    requestAnimationFrame(() => {
      if (S.guide !== gd || route.name !== r) return;
      if (gd === 1 && r === "lobby") {
        seq([
          { text: "---테오히 아카이브 0614에 접속합니다.\n수신자에게 도착한 웰컴 선물 세트." },
          { gift: ["웰컴 선물 세트", [["orb", 3000, "합성옥"], ["coin", 20000, "주화"], ["ticket", 2, "아카이브 수신권"]]], apply: () => { S.res.orb += 3000; S.res.coin += 20000; S.res.ticket += 2; } },
          { text: "수신 중단에 대한 보상 수신권 도착.\n10회 연속 링크를 1회 실행할 수 있습니다." },
          { gift: ["수신 중단 보상", [["start", 1, "스타트 수신권 (10회 링크)"]]], apply: () => { S.res.start = 1; } },
        ], () => { S.guide = 2; save(); render(); });
      } else if (gd === 2 && r === "lobby") {
        guideStep({ target: q(".lt-hh"), text: "[아카이브|ARCHIVE]에서 수신권을 사용해\n가사인격체와 링크할 수 있습니다.", onTarget: () => go("gacha", { banner: "start" }) });
      } else if (gd === 2 && r === "gacha") {
        if (!q(".pull.start")) return go("gacha", { banner: "start" });
        guideStep({ target: q(".pull.start"), text: "스타트 수신권으로 10회 링크를 실행합니다.", pos: { left: "560px", top: "560px", width: "640px" } });
      } else if (gd === 3 && r === "gacha") {
        seq([{ text: "링크된 가사인격체는 현재 편성에 자동으로 등록되었습니다." }], () => guideStep({ target: q(".top .home"), text: "단말 메인 화면으로 돌아갑니다." }));
      } else if (gd === 3 && r === "lobby") {
        guideStep({ target: q(".lt-op"), text: "목적지 「마트」를 작전 경로로 등록했습니다.\n[작전|OPERATION]에서 이동을 개시합니다.", onTarget: () => { S.guide = 4; save(); go("terminal", 0); } });
      } else if (gd === 4 && r === "terminal") {
        guideStep({ target: q(".detail .go"), text: "작전 정보를 확인하고 개시하십시오.", pos: { left: "40px", top: "600px", width: "700px" } });
      } else if (gd === 4 && r === "prep") {
        guideStep({ target: q(".btn.go"), text: "편성을 확인했다면, 작전을 개시합니다.", pos: { left: "40px", bottom: "16px", top: "auto", width: "760px" }, onTarget: () => { S.guide = 0; save(); q(".btn.go").click(); } });
      }
    });
  }

  // ---------- story scenes ----------
  // a script is a list of steps:
  //   { bg }  { show, at: "l"|"c"|"r", expr, face }  { hide }  { say, text, expr }  { nar }  { me }   (the commander's own line)
  //   { place: "지하보도 계단" } (a small location caption, top-left, for a few seconds)
  //   { choice: [[label, [steps…]], …] }  { title: [small, big] }  { black: true|false }  { flash }  { shake }  { wait }
  const STORY_BG = { station: "st_station", lane: "st_lane", parade: "st_parade", ruins: "bg", room: "st_room", war: "st_war", mart: "st_mart", underpass: "st_underpass" };
  const CAST = {   // who can appear: operators by id (their shown name follows their promotion) or plain figures
    cadoudal: { name: "조르주 카두달", img: "en_cadoudal", h: 620 },
    ney: { name: "미셸 네", img: "ney_stand", h: 640 },   // speaks from afar; not shown standing
    rider: { name: "목 없는 척후기병", img: "en_rider", h: 480 },
    soldier: { name: "전열 보병", img: "atl_ens", rect: [1374, 0, 334, 419], h: 470 },   // the same figures the battle draws: a frame off their pose atlas
    soldier2: { name: "전열 보병", img: "atl_ens", rect: [0, 0, 346, 418], h: 440 },
    dog: { name: "사냥개", img: "atl_dog", rect: [1531, 0, 381, 177], h: 210 },
  };
  const STORIES = window.BSL_STORIES || {};
  // illustrated standing sprites for the story: base image plus face patches (x, y in the base image's pixels)
  const STAND = window.BSL_STAND || {};
  const IMGC = {};
  const imgOf = (k) => { if (!IMGC[k]) { const im = new Image(); if (window.__loadImg && ART[k]) window.__loadImg(im, ART[k]); else im.src = ART[k] || ""; IMGC[k] = im; } return IMGC[k]; };
  const fill = (s) => String(s).replace(/\{name\}/g, S.name || "지휘관");
  function speaker(id) {
    if (!id) return { main: "" };
    if (CAST[id]) return { main: CAST[id].name };
    if (def(id)) { const n = TD.nameOf(def(id), S.ops[id] ? S.ops[id].elite : 0); return { main: n.main, sub: n.sub, ruby: n.ruby }; }
    return { main: id };
  }
  // a scene's weather: soft snow drifting down, or a blizzard driving across from the right.
  // The blizzard is layered: a white-out that breathes with the gusts, soft banks of blown snow rolling through,
  // fine crisp grains streaking in their thousands, a few big blurred flakes right in front of the eye, and snow snaking along the ground.
  const BLOB = (() => { const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"), gr = g.createRadialGradient(128, 128, 0, 128, 128, 127);
    gr.addColorStop(0, "rgba(236,243,250,.55)"); gr.addColorStop(0.5, "rgba(236,243,250,.22)"); gr.addColorStop(1, "rgba(236,243,250,0)"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return c; })();
  const BOKEH = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 31);
    gr.addColorStop(0, "rgba(255,255,255,.95)"); gr.addColorStop(0.35, "rgba(250,252,255,.6)"); gr.addColorStop(1, "rgba(240,246,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c; })();
  function storyWeather(wg, kind, flakes, dt) {
    const bl = kind === "blizzard", t = (flakes.t = (flakes.t || 0) + dt);
    if (!bl) {   // gentle snow
      while (flakes.length < 160) { const z = Math.random(); flakes.push({ x: Math.random() * VW, y: Math.random() * VH, z, ph: Math.random() * 6.28 }); }
      wg.save(); wg.fillStyle = "#fff";
      for (const f of flakes) { const sp = 0.35 + f.z; f.x += (-14 * sp + Math.sin(t + f.ph) * 10) * dt; f.y += (40 + 45 * sp) * dt;
        if (f.y > VH + 10) { f.y = -10; f.x = Math.random() * VW * 1.2; }
        wg.globalAlpha = 0.4 + 0.5 * f.z; wg.beginPath(); wg.arc(f.x, f.y, 1 + f.z * 2.2, 0, 6.283); wg.fill(); }
      wg.restore(); return;
    }
    // wind: a steady drive from the right that surges every few seconds
    const gust = 0.55 + 0.3 * Math.sin(t * 0.8) + 0.35 * Math.max(0, Math.sin(t * 0.31 - 1.2)) ** 2, W = 520 + 900 * gust;
    if (!flakes.init) {
      flakes.init = true;
      flakes.grains = Array.from({ length: 900 }, () => ({ x: Math.random() * VW, y: Math.random() * VH, z: Math.random(), ph: Math.random() * 6.28 }));
      flakes.near = Array.from({ length: 14 }, () => ({ x: Math.random() * VW, y: Math.random() * VH, s: 18 + Math.random() * 26, ph: Math.random() * 6.28 }));
      flakes.fog = Array.from({ length: 9 }, (_, i) => ({ x: Math.random() * VW * 1.5, y: 60 + (i % 5) * 150 + Math.random() * 60, w: 700 + Math.random() * 600, h: 200 + Math.random() * 160, v: 0.45 + Math.random() * 0.5 }));
      flakes.snake = Array.from({ length: 70 }, () => ({ x: Math.random() * VW, y: VH - Math.random() * 150, v: 0.8 + Math.random() * 0.8, ph: Math.random() * 6.28 }));
    }
    wg.save();
    // the air goes white with the surges, thickest toward where the wind comes from
    const wo = wg.createLinearGradient(VW, 0, 0, 0); wo.addColorStop(0, `rgba(222,232,242,${0.14 + 0.2 * gust})`); wo.addColorStop(1, `rgba(222,232,242,${0.03 + 0.08 * gust})`);
    wg.fillStyle = wo; wg.fillRect(0, 0, VW, VH);
    // banks of blown snow rolling through
    for (const f of flakes.fog) { f.x -= W * 0.55 * f.v * dt; if (f.x < -f.w) { f.x = VW + Math.random() * 300; f.y = 40 + Math.random() * (VH - 120); }
      wg.globalAlpha = 0.35 + 0.55 * gust; wg.drawImage(BLOB, f.x, f.y - f.h / 2 + Math.sin(t * 0.7 + f.v * 9) * 18, f.w, f.h); }
    // fine grains: three depths, each one stroke of streaks along the wind (longer in the surges, a little turbulence per grain)
    wg.globalAlpha = 1; wg.lineCap = "round";
    for (const [z0, z1, lw, al] of [[0, 0.55, 1.5, 0.5], [0.55, 0.88, 2.3, 0.75], [0.88, 1.01, 3.4, 0.9]]) {
      wg.beginPath();
      for (const f of flakes.grains) { if (f.z < z0 || f.z >= z1) continue;
        const sp = 0.35 + f.z * 0.95, vx = -W * sp * (0.85 + 0.3 * Math.sin(f.ph * 5)), vy = (170 + 160 * Math.sin(f.ph + t * 1.3)) * sp;
        f.x += vx * dt; f.y += vy * dt;
        if (f.x < -40 || f.y > VH + 30) { if (Math.random() < 0.75) { f.x = VW + Math.random() * 60; f.y = Math.random() * VH; } else { f.x = Math.random() * VW; f.y = -20; } }
        const L = (0.003 + 0.007 * f.z) * (0.7 + 0.45 * gust), wb = Math.sin(t * 9 + f.ph * 3) * 2.5 * f.z; wg.moveTo(f.x, f.y + wb); wg.lineTo(f.x - vx * L, f.y - vy * L); }
      wg.strokeStyle = `rgba(245,249,255,${al})`; wg.lineWidth = lw; wg.stroke();
    }
    // snow snaking low along the ground
    wg.beginPath();
    for (const f of flakes.snake) { f.x -= W * 1.1 * f.v * dt; const y = f.y + Math.sin(f.x * 0.012 + f.ph) * 10; if (f.x < -80) { f.x = VW + Math.random() * 100; f.y = VH - Math.random() * 150; }
      wg.moveTo(f.x, y); wg.lineTo(f.x + 40 + 30 * f.v, y - 2); }
    wg.strokeStyle = `rgba(240,246,252,${0.18 + 0.2 * gust})`; wg.lineWidth = 3; wg.stroke();
    // a few big soft flakes right in front of the eye
    for (const f of flakes.near) { const vx = -W * 1.9, vy = 260 + 120 * Math.sin(f.ph + t); f.x += vx * dt; f.y += vy * dt;
      if (f.x < -120 || f.y > VH + 60) { f.x = VW + 60 + Math.random() * 400; f.y = Math.random() * VH * 0.9; }
      wg.save(); wg.translate(f.x, f.y); wg.rotate(Math.atan2(vy, vx)); wg.globalAlpha = 0.55; const L = 1.8 + gust; wg.drawImage(BOKEH, -f.s * L, -f.s * 0.7, f.s * 2 * L, f.s * 1.4); wg.restore(); }
    wg.restore();
  }
  // the terrain sheets a scene can open: places, zones and lines in the archive's own drawing, marked and routed as the talk goes
  const REGION = {
    c2: {
      head: ["TEOHI ARCHIVE · 지형 자료", "외곽 — 수도 구간"],
      places: {
        capital: { x: 250, y: 260, label: "수도", sub: "세관 성벽 · 빵", icon: "city" },
        bocage: { x: 560, y: 210, label: "생울타리 지대", sub: "시야 극히 불량", icon: "zone" },
        camp: { x: 600, y: 390, label: "반란군 진지", sub: "목 없는 장군", icon: "camp" },
        line: { x: 820, y: 300, label: "옛 봉쇄선", sub: "미셸 네 · 비어 있음", icon: "line" },
        here: { x: 930, y: 330, label: "현재 위치", sub: "얼어붙은 진창", icon: "here" },
        light: { x: 1090, y: 250, label: "등대", sub: "1장 · 봉쇄선", icon: "tower" },
      },
      routes: { rebel: ["camp", "capital"], ours: ["here", "bocage", "capital"], retreat: ["light", "line", "capital"] },
    },
  };
  // the map off a dead straggler: a French staff map of 1812 (printed in French, blood on one corner), scanned by the terminal.
  // The paper is drawn once into its own canvas — relief shaded from a height field, contours, hachures on the range, forests, rivers,
  // roads, towns, cartouche, compass and scale — and the terminal's marks go over it live, swept in by the scan and lit as the talk goes.
  // Map space is 1000 x 420, west on the left.
  const FM = {
    ridge: [[505, -20], [492, 40], [500, 100], [486, 160], [478, 220], [470, 275], [480, 330], [492, 380], [486, 440]],
    passes: { small: [88, 112], big: [252, 298] },
    niemen: [[1020, 300], [940, 286], [880, 300], [800, 292], [720, 280], [640, 283], [560, 277], [515, 274], [470, 276], [430, 282], [380, 292], [320, 300], [250, 296], [170, 306], [90, 300], [-20, 310]],
    berez: [[780, -20], [720, 30], [640, 74], [565, 95], [500, 101], [445, 108], [385, 128], [345, 175], [330, 235], [322, 296]],
    roadA: [[860, 172], [770, 205], [690, 238], [600, 258], [530, 268], [470, 270], [418, 288], [330, 322], [200, 332], [0, 336]],
    roadB: [[860, 172], [740, 132], [620, 100], [548, 90], [492, 100], [420, 118], [345, 150]],
    city: [860, 172], kovno: [418, 288], light: [442, 262], bridge: [492, 100], here: [292, 348],
    snipe: [[466, 44], [452, 152], [440, 232], [446, 318]],
    villages: [["Smolensk", 690, 238], ["Viazma", 772, 204], ["Borisov", 552, 86], ["Studianka", 470, 82], ["Vilna", 372, 296], ["Gumbinnen", 180, 333], ["Kalouga", 820, 262], ["Vitebsk", 610, 140]],
  };
  const fmRidgeX = (y) => { const R = FM.ridge; for (let i = 1; i < R.length; i++) if (y <= R[i][1]) { const u = (y - R[i - 1][1]) / (R[i][1] - R[i - 1][1]); return R[i - 1][0] + (R[i][0] - R[i - 1][0]) * u; } return R[R.length - 1][0]; };
  const fmPass = (y) => { let v = 0; for (const [a, b] of Object.values(FM.passes)) { const m = (a + b) / 2, hw = (b - a) / 2 + 6, d = Math.abs(y - m) / hw; v = Math.max(v, Math.exp(-(d ** 4))); } return v; };
  const fmSeg = (px, py, P) => { let best = 1e9; for (let i = 1; i < P.length; i++) { const [ax, ay] = P[i - 1], [bx, by] = P[i], dx = bx - ax, dy = by - ay, u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))), ex = ax + dx * u - px, ey = ay + dy * u - py; best = Math.min(best, ex * ex + ey * ey); } return Math.sqrt(best); };
  const fmHash = (i, j) => { let n = Math.imul(i, 374761393) + Math.imul(j, 668265263) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const fmVN = (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return (fmHash(i, j) * (1 - u) + fmHash(i + 1, j) * u) * (1 - v) + (fmHash(i, j + 1) * (1 - u) + fmHash(i + 1, j + 1) * u) * v; };
  const fmFbm = (x, y) => { let a = 0, w = 0.5; for (let o = 0; o < 4; o++) { a += w * fmVN(x, y); x *= 2.03; y *= 2.03; w *= 0.5; } return a; };
  const fmLen = (P) => { const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); return L; };
  const fmPart = (g, P, u) => { const L = fmLen(P), end = L[L.length - 1] * u; g.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) { if (L[i] <= end) { g.lineTo(P[i][0], P[i][1]); continue; } const f = (end - L[i - 1]) / (L[i] - L[i - 1]); g.lineTo(P[i - 1][0] + (P[i][0] - P[i - 1][0]) * f, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * f); return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * f, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * f, Math.atan2(P[i][1] - P[i - 1][1], P[i][0] - P[i - 1][0])]; } const n = P.length; return [P[n - 1][0], P[n - 1][1], Math.atan2(P[n - 1][1] - P[n - 2][1], P[n - 1][0] - P[n - 2][0])]; };
  let FM_CV = null;
  function fmBuild() {
    const S = 1.6, CW = 1600, CH = 672, GS = 2, GW = 501, GH = 211;
    // the height field: low rolling country, the range running north-south broken at the two river gaps, valleys cut by the rivers
    const Hf = new Float32Array(GW * GH);
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const x = i * GS, y = j * GS, pass = fmPass(y), wob = 26 * (fmFbm(y / 45, 3.7) - 0.5) + 10 * (fmFbm(x / 30, y / 30) - 0.5), wd = 30 + 26 * fmFbm(y / 38, 9.1), d = (x - fmRidgeX(y) - wob) / wd;
      let r = Math.exp(-d * d) * (0.45 + 0.95 * fmFbm(x / 16, y / 16)) + Math.exp(-((d / 2.6) ** 2)) * 0.28 * (0.6 + fmFbm(x / 40, y / 40)); r *= 1 - 0.82 * pass;
      const dn = fmSeg(x, y, FM.niemen), db = fmSeg(x, y, FM.berez);
      Hf[j * GW + i] = 0.2 * fmFbm(x / 70 + 7, y / 70) + r - 0.16 * Math.exp(-((dn / 18) ** 2)) - 0.1 * Math.exp(-((db / 13) ** 2)); }
    const hAt = (x, y) => { const fx = Math.max(0, Math.min(GW - 1.001, x / GS)), fy = Math.max(0, Math.min(GH - 1.001, y / GS)), i = fx | 0, j = fy | 0, u = fx - i, v = fy - j;
      return (Hf[j * GW + i] * (1 - u) + Hf[j * GW + i + 1] * u) * (1 - v) + (Hf[(j + 1) * GW + i] * (1 - u) + Hf[(j + 1) * GW + i + 1] * u) * v; };
    const c = document.createElement("canvas"); c.width = CW; c.height = CH; const g = c.getContext("2d");
    // paper, relief shading and contours, pixel by pixel
    const im = g.createImageData(CW, CH), D = im.data, L = [-0.6, -0.6, 0.53];
    for (let py = 0; py < CH; py++) for (let px = 0; px < CW; px++) {
      const x = px / S, y = py / S, h = hAt(x, y), gx = (hAt(x + 1, y) - hAt(x - 1, y)) / 2, gy = (hAt(x, y + 1) - hAt(x, y - 1)) / 2;
      const nx = -gx * 26, ny = -gy * 26, nl = Math.hypot(nx, ny, 1), shade = (nx * L[0] + ny * L[1] + L[2]) / nl;
      const grain = fmVN(px / 3, py / 3) * 0.6 + fmVN(px / 41, py / 41) * 0.8 + fmVN(px / 160 + 3, py / 160) * 0.9;
      let r = 222 + grain * 14, gg = 208 + grain * 13, b = 172 + grain * 10;
      const edge = Math.min(px, py, CW - px, CH - py); if (edge < 60) { const e = (60 - edge) / 60; r -= 34 * e * e; gg -= 36 * e * e; b -= 34 * e * e; }   // worn, darkened edges
      let ink = Math.max(0, 0.53 - shade) * 1.1 + Math.max(0, h - 0.35) * 0.18;   // shadowed slopes in sepia
      const K = 10, cc = (h * K) % 1, gm = Math.hypot(gx, gy) * K / S;
      if (h > 0.1 && Math.min(cc, 1 - cc) < gm * 0.75) ink += Math.round(h * K) % 5 === 0 ? 0.3 : 0.16;   // contour lines, every fifth one heavier
      ink = Math.min(0.7, ink); const hi = Math.max(0, shade - 0.62) * 0.5;
      const k4 = (py * CW + px) * 4; D[k4] = r * (1 - ink) + 92 * ink + 255 * hi; D[k4 + 1] = gg * (1 - ink) + 64 * ink + 255 * hi; D[k4 + 2] = b * (1 - ink) + 36 * ink + 240 * hi; D[k4 + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    g.save(); g.scale(S, S); g.lineCap = "round"; g.lineJoin = "round";
    const rnd = (n) => fmHash(n, 77);
    const path = (P) => { g.beginPath(); P.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); };
    // stains: water, age, and the dead man's blood in the lower-left corner
    for (let i = 0; i < 3; i++) { const x = rnd(i) * 1000, y = rnd(i + 20) * 420, rr = 30 + rnd(i + 40) * 70, sg = g.createRadialGradient(x, y, rr * 0.6, x, y, rr); sg.addColorStop(0, "rgba(150,110,60,.05)"); sg.addColorStop(0.92, "rgba(120,80,40,.06)"); sg.addColorStop(1, "rgba(120,80,40,0)"); g.fillStyle = sg; g.beginPath(); g.arc(x, y, rr, 0, 6.283); g.fill(); }
    // hachures on the range: short strokes down the fall line, heavier where it is steeper
    for (let y = -4; y < 424; y += 3.2) for (let x = 380; x < 600; x += 3.2) { const gx = (hAt(x + 1, y) - hAt(x - 1, y)) / 2, gy = (hAt(x, y + 1) - hAt(x, y - 1)) / 2, s = Math.hypot(gx, gy); if (s < 0.012) continue;
      const l = Math.min(4.5, 1.2 + s * 160), ux = -gx / s, uy = -gy / s; g.strokeStyle = `rgba(78,52,28,${Math.min(0.75, 0.15 + s * 22)})`; g.lineWidth = Math.min(1.1, 0.35 + s * 18); g.beginPath(); g.moveTo(x, y); g.lineTo(x + ux * l, y + uy * l); g.stroke(); }
    // forests: a pale green wash and little tree marks, kept off the rivers, the range and the towns
    const woods = [[620, 200, 60], [740, 90, 70], [900, 260, 60], [690, 330, 70], [580, 360, 50], [940, 110, 50], [230, 200, 55], [120, 120, 50], [380, 380, 45], [160, 390, 40], [800, 380, 50]];
    for (const [wx, wy, wr] of woods) { const wg2 = g.createRadialGradient(wx, wy, 0, wx, wy, wr); wg2.addColorStop(0, "rgba(105,128,72,.16)"); wg2.addColorStop(1, "rgba(105,128,72,0)"); g.fillStyle = wg2; g.beginPath(); g.ellipse(wx, wy, wr * 1.2, wr * 0.8, 0, 0, 6.283); g.fill();
      for (let i = 0; i < wr * 2.2; i++) { const a = rnd(wx + i * 7) * 6.283, rr = Math.sqrt(rnd(wy + i * 13)) * wr, x = wx + Math.cos(a) * rr * 1.2, y = wy + Math.sin(a) * rr * 0.8;
        if (fmSeg(x, y, FM.niemen) < 9 || fmSeg(x, y, FM.berez) < 7 || Math.abs(x - fmRidgeX(y)) < 34 || Math.hypot(x - FM.city[0], y - FM.city[1]) < 44 || fmSeg(x, y, FM.roadA) < 4) continue;
        g.strokeStyle = "rgba(64,76,40,.7)"; g.lineWidth = 0.6; g.beginPath(); g.arc(x, y, 1.5, 0, 6.283); g.stroke(); g.beginPath(); g.moveTo(x, y + 1.5); g.lineTo(x, y + 3); g.stroke(); } }
    // marsh along the lower Berezina
    g.strokeStyle = "rgba(60,90,120,.55)"; g.lineWidth = 0.6;
    for (let i = 0; i < 60; i++) { const P = FM.berez[6 + (i % 3)], x = P[0] - 20 + rnd(i + 300) * 50, y = P[1] - 15 + rnd(i + 400) * 40; g.beginPath(); for (let k = -1; k <= 1; k++) { g.moveTo(x + k * 2, y); g.lineTo(x + k * 2.6, y - 2.5 - (k === 0 ? 1 : 0)); } g.moveTo(x - 4, y + 0.4); g.lineTo(x + 4, y + 0.4); g.stroke(); }
    // rivers: a pale wash, then the ink line
    for (const [P, w] of [[FM.niemen, 4.2], [FM.berez, 2.4]]) { path(P); g.strokeStyle = "rgba(120,160,190,.35)"; g.lineWidth = w + 5; g.stroke(); path(P); g.strokeStyle = "rgba(48,82,120,.85)"; g.lineWidth = w; g.stroke(); }
    g.fillStyle = "rgba(120,160,190,.45)"; g.strokeStyle = "rgba(48,82,120,.8)"; g.lineWidth = 0.8; for (const [x, y, a, b] of [[655, 168, 14, 7], [250, 250, 10, 5], [760, 345, 12, 6]]) { g.beginPath(); g.ellipse(x, y, a, b, 0.3, 0, 6.283); g.fill(); g.stroke(); }
    // roads: the old post road as a double line, the northern road dotted
    path(FM.roadA); g.strokeStyle = "rgba(96,52,30,.85)"; g.lineWidth = 3; g.stroke(); path(FM.roadA); g.strokeStyle = "rgba(226,212,176,1)"; g.lineWidth = 1.4; g.stroke();
    path(FM.roadB); g.setLineDash([3, 3]); g.strokeStyle = "rgba(96,52,30,.75)"; g.lineWidth = 1.4; g.stroke(); g.setLineDash([]);
    // Moscow: earthwork ring with bastions, the Kremlin, built-up blocks in carmine
    { const [x, y] = FM.city; g.beginPath(); for (let i = 0; i <= 16; i++) { const a = i / 16 * 6.283, rr = (i % 2 ? 40 : 46) + 3 * Math.sin(i * 1.7); i ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.75) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.75); } g.closePath();
      g.fillStyle = "rgba(170,60,50,.12)"; g.fill(); g.strokeStyle = "rgba(80,40,25,.9)"; g.lineWidth = 1.4; g.stroke();
      g.fillStyle = "rgba(160,45,40,.55)"; for (let i = 0; i < 70; i++) { const a = rnd(i + 900) * 6.283, rr = 8 + Math.sqrt(rnd(i + 950)) * 30, bx = x + Math.cos(a) * rr, by = y + Math.sin(a) * rr * 0.72; g.save(); g.translate(bx, by); g.rotate(a); g.fillRect(-2.2, -1.3, 4.4 + (i % 3), 2.6); g.restore(); }
      g.beginPath(); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283 - 1.57; g.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 5); } g.closePath(); g.fillStyle = "rgba(232,220,190,1)"; g.fill(); g.strokeStyle = "rgba(80,40,25,.95)"; g.lineWidth = 1.1; g.stroke();
      g.strokeStyle = "rgba(48,82,120,.8)"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x + 60, y + 20); g.bezierCurveTo(x + 20, y + 30, x + 10, y - 2, x - 30, y + 14); g.lineTo(x - 70, y + 60); g.stroke(); }
    // Kovno and its lighthouse on the crag over the gorge; villages
    { const [x, y] = FM.kovno; g.fillStyle = "rgba(160,45,40,.6)"; for (let i = 0; i < 14; i++) g.fillRect(x - 9 + (i % 5) * 4, y - 4 + ((i / 5) | 0) * 3.5, 3, 2.4); g.strokeStyle = "rgba(80,40,25,.9)"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x + 2, y - 10); g.lineTo(x + 2, y - 4); g.moveTo(x, y - 8); g.lineTo(x + 4, y - 8); g.stroke(); }
    { const [x, y] = FM.light; g.fillStyle = "rgba(70,40,25,.95)"; g.beginPath(); g.moveTo(x - 2.5, y + 3); g.lineTo(x - 1.4, y - 8); g.lineTo(x + 1.4, y - 8); g.lineTo(x + 2.5, y + 3); g.closePath(); g.fill(); g.beginPath(); g.arc(x, y - 9.5, 1.8, 0, 6.283); g.fill();
      g.strokeStyle = "rgba(70,40,25,.7)"; g.lineWidth = 0.6; for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.45; g.beginPath(); g.moveTo(x + Math.cos(a) * 4, y - 9.5 + Math.sin(a) * 4); g.lineTo(x + Math.cos(a) * 8, y - 9.5 + Math.sin(a) * 8); g.stroke(); } }
    { const [x, y] = FM.bridge; g.strokeStyle = "rgba(70,40,25,.9)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 6, y - 4); g.lineTo(x - 1, y - 1); g.moveTo(x + 1, y + 1); g.lineTo(x + 6, y + 4); g.stroke(); }   // the bridge, broken
    for (const [, x, y] of FM.villages) { g.fillStyle = "rgba(160,45,40,.7)"; g.beginPath(); g.arc(x, y, 2, 0, 6.283); g.fill(); g.strokeStyle = "rgba(80,40,25,.9)"; g.lineWidth = 0.6; g.stroke(); }
    // lettering, the way the engravers did it: towns upright, waters in italic, the range in spaced capitals along its crest
    const SER = "Georgia, 'Times New Roman', 'Noto Serif KR', serif";
    const word = (txt, x, y, font, col, rot = 0, sp = 0) => { g.save(); g.translate(x, y); g.rotate(rot); g.font = font; g.fillStyle = col; g.textAlign = "center"; g.textBaseline = "middle";
      if (!sp) g.fillText(txt, 0, 0); else { const ch = [...txt], w = ch.reduce((a, c2) => a + g.measureText(c2).width + sp, -sp); let cx = -w / 2; for (const c2 of ch) { const cw = g.measureText(c2).width; g.fillText(c2, cx + cw / 2, 0); cx += cw + sp; } } g.restore(); };
    const INK = "rgba(52,34,20,.92)", BLUE = "rgba(40,72,112,.9)";
    word("MOSCOU", FM.city[0], FM.city[1] + 46, `700 13px ${SER}`, INK, 0, 3);
    word("Kowno", FM.kovno[0] - 20, FM.kovno[1] + 12, `600 9px ${SER}`, INK);
    word("Phare", FM.light[0] - 12, FM.light[1] - 16, `italic 7px ${SER}`, INK);
    for (const [n, x, y] of FM.villages) word(n, x, y - 7, `italic 7px ${SER}`, INK);
    word("Pont détruit", FM.bridge[0] + 2, FM.bridge[1] + 11, `italic 6.5px ${SER}`, INK);
    word("NIÉMEN", 760, 297, `italic 600 10px ${SER}`, BLUE, -0.12, 4); word("Niémen", 210, 312, `italic 600 9px ${SER}`, BLUE, 0.05, 2);
    word("Bérézina", 610, 74, `italic 600 8.5px ${SER}`, BLUE, 0.42, 1.5); word("Bérézina", 352, 148, `italic 600 7.5px ${SER}`, BLUE, 1.1, 1);
    for (const [txt, y] of [["MONTS", 175], ["VALDAÏ", 360]]) word(txt, fmRidgeX(y) + 34, y, `600 10px ${SER}`, "rgba(70,46,24,.85)", Math.PI / 2 - 0.1, 5);
    word("Route de Paris", 90, 344, `italic 7.5px ${SER}`, INK); g.strokeStyle = INK; g.lineWidth = 0.8; g.beginPath(); g.moveTo(42, 344); g.lineTo(28, 344); g.moveTo(32, 341); g.lineTo(28, 344); g.lineTo(32, 347); g.stroke();
    // cartouche, scale, compass, the neat line with its degree ticks
    { g.fillStyle = "rgba(232,220,190,.92)"; g.fillRect(22, 40, 222, 64); g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(22, 40, 222, 64); g.lineWidth = 0.5; g.strokeRect(25.5, 43.5, 215, 57);
      word("CARTE DU THÉÂTRE DE LA GUERRE", 133, 58, `700 9.5px ${SER}`, INK, 0, 0.6); word("entre Moscou et le Niémen", 133, 73, `italic 9px ${SER}`, INK);
      word("Dressée au Dépôt de la Guerre · 1812", 133, 89, `6.5px ${SER}`, INK); }
    { const x0 = 770, y0 = 400; g.strokeStyle = INK; g.lineWidth = 0.7; for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? "rgba(232,220,190,1)" : INK; g.fillRect(x0 + i * 24, y0, 24, 3.5); } g.strokeRect(x0, y0, 120, 3.5);
      for (let i = 0; i <= 5; i++) word(String(i * 10), x0 + i * 24, y0 - 5, `6px ${SER}`, INK); word("Échelle de 50 Lieues", x0 + 60, y0 + 10, `italic 6.5px ${SER}`, INK); }
    { const x = 950, y = 370; g.strokeStyle = INK; g.lineWidth = 0.6; g.beginPath(); g.arc(x, y, 16, 0, 6.283); g.stroke(); g.beginPath(); g.arc(x, y, 13, 0, 6.283); g.stroke();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, l = i % 2 ? 11 : 22; g.fillStyle = i === 0 ? INK : "rgba(52,34,20,.55)"; g.beginPath(); g.moveTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.lineTo(x + Math.cos(a + 1.3) * 3, y + Math.sin(a + 1.3) * 3); g.lineTo(x + Math.cos(a - 1.3) * 3, y + Math.sin(a - 1.3) * 3); g.closePath(); g.fill(); }
      word("N", x, y - 28, `700 8px ${SER}`, INK); }
    g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(8, 8, 984, 404); g.lineWidth = 0.4; g.strokeRect(11, 11, 978, 398);
    for (let x = 60; x < 1000; x += 60) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x, 11); g.moveTo(x, 409); g.lineTo(x, 412); g.stroke(); } for (let y = 60; y < 420; y += 60) { g.beginPath(); g.moveTo(8, y); g.lineTo(11, y); g.moveTo(989, y); g.lineTo(992, y); g.stroke(); }
    // the folds: the sheet was carried folded in eight
    for (const fx of [250, 500, 750]) { g.fillStyle = "rgba(70,50,30,.10)"; g.fillRect(fx - 1.2, 0, 1.2, 420); g.fillStyle = "rgba(255,250,235,.22)"; g.fillRect(fx, 0, 1, 420); }
    g.fillStyle = "rgba(70,50,30,.10)"; g.fillRect(0, 209, 1000, 1.2); g.fillStyle = "rgba(255,250,235,.22)"; g.fillRect(0, 210.2, 1000, 1);
    // blood, dried brown, soaked in from the corner where it lay against him
    for (let i = 0; i < 9; i++) { const x = 30 + rnd(i + 600) * 90, y = 360 + rnd(i + 620) * 60, rr = 6 + rnd(i + 640) * 22, bg2 = g.createRadialGradient(x, y, 0, x, y, rr); bg2.addColorStop(0, "rgba(70,22,12,.5)"); bg2.addColorStop(0.7, "rgba(84,30,16,.34)"); bg2.addColorStop(1, "rgba(110,34,22,0)"); g.fillStyle = bg2; g.beginPath(); g.arc(x, y, rr, 0, 6.283); g.fill(); }
    for (let i = 0; i < 14; i++) { g.fillStyle = "rgba(90,24,16,.5)"; g.beginPath(); g.arc(120 + rnd(i + 700) * 70, 340 + rnd(i + 720) * 70, 0.8 + rnd(i + 740) * 1.8, 0, 6.283); g.fill(); }
    g.restore();
    return c;
  }
  function foundMap(g, st, t) {
    if (!FM_CV) FM_CV = fmBuild();
    const X0 = 110, Y0 = 40, W0 = 1060, H0 = 440, F = FM, hi = (q) => st.hi.includes(q), pulse = 0.5 + 0.5 * Math.sin(t * 4), age = t - st.since;
    const z0 = Math.max(1, (st.cam || [500, 210, 1])[2]), hw = 500 / z0, hh = 207 / z0;   // the camera never looks past the paper
    const tc = st.cam ? [Math.max(hw, Math.min(1000 - hw, st.cam[0])), Math.max(hh, Math.min(420 - hh, st.cam[1])), z0] : [500, 210, 1];
    st.cc = st.cc || tc.slice(); for (let i = 0; i < 3; i++) st.cc[i] += (tc[i] - st.cc[i]) * 0.07;
    const [cx, cy, z] = st.cc, k = (W0 / 1000) * z, scan = st.raw ? 0 : st.scan ? Math.min(1.25, age / 1.9) : 1.25, seen = (x) => scan * 1000 >= x;
    const px = (n) => n / k;   // so marks keep their size on screen at any zoom
    g.save(); g.globalAlpha = st.a;
    g.fillStyle = "#121010"; g.fillRect(X0 - 8, Y0 - 8, W0 + 16, H0 + 16);
    g.save(); g.beginPath(); g.rect(X0, Y0, W0, H0); g.clip();
    g.translate(X0 + W0 / 2, Y0 + H0 / 2); g.scale(k, k); g.translate(-cx, -cy);
    g.drawImage(FM_CV, 0, 0, 1000, 420);
    if (!st.raw) {
      g.lineCap = "round"; g.lineJoin = "round";
      // the sweep
      if (st.scan && scan < 1.2) { const sx = scan * 1000, sg = g.createLinearGradient(sx - 90, 0, sx, 0); sg.addColorStop(0, "rgba(127,227,255,0)"); sg.addColorStop(1, "rgba(127,227,255,.28)"); g.fillStyle = sg; g.fillRect(sx - 90, 0, 90, 420); g.fillStyle = "rgba(170,240,255,.95)"; g.fillRect(sx, 0, px(2), 420); }
      g.fillStyle = "rgba(6,16,24,.42)"; g.fillRect(0, 0, Math.min(1000, scan * 1000), 420);   // the scanned part goes dark and cold, so the marks stand out
      g.shadowColor = "rgba(0,0,0,.85)"; g.shadowBlur = 6;
      // the burning city, as the terminal reads it: heat
      if (seen(F.city[0])) { const [x, y] = F.city, hg = g.createRadialGradient(x, y, 4, x, y, 52 + 6 * pulse); hg.addColorStop(0, `rgba(255,120,40,${0.45 + 0.15 * pulse})`); hg.addColorStop(0.6, "rgba(255,60,30,.18)"); hg.addColorStop(1, "rgba(255,60,30,0)"); g.fillStyle = hg; g.beginPath(); g.arc(x, y, 60, 0, 6.283); g.fill(); }
      // Ney's line along the western foot of the range, its teeth facing east
      if (seen(470)) { const on = hi("line"), col = `rgba(255,96,80,${on ? 1 : 0.8})`; g.strokeStyle = col; g.lineWidth = px(on ? 3.6 : 2.4); g.setLineDash([px(10), px(6)]); g.lineDashOffset = -t * px(24);
        g.beginPath(); for (let y = 0; y <= 420; y += 6) { const x = fmRidgeX(y) - 24; y ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.setLineDash([]);
        g.beginPath(); for (let y = 6; y < 420; y += 14) { const x = fmRidgeX(y) - 24; g.moveTo(x, y); g.lineTo(x + 6, y); } g.stroke(); }
      // the two gaps
      const bracket = (x0, y0, x1, y1, on) => { const L = 9; g.strokeStyle = `rgba(255,212,0,${on ? 0.75 + 0.25 * pulse : 0.7})`; g.lineWidth = px(on ? 3.4 : 2.2); g.beginPath();
        for (const [ax, ay, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) { g.moveTo(ax + sx * L, ay); g.lineTo(ax, ay); g.lineTo(ax, ay + sy * L); } g.stroke(); };
      if (seen(470)) { bracket(fmRidgeX(100) - 34, 82, fmRidgeX(100) + 34, 118, hi("passes") || hi("smallpass")); bracket(fmRidgeX(275) - 38, 246, fmRidgeX(275) + 38, 304, hi("passes") || hi("bigpass")); }
      // all the ground the lighthouse holds
      if (hi("range")) { const [x, y] = F.light; g.fillStyle = `rgba(255,70,60,${0.14 + 0.08 * pulse})`; g.beginPath(); g.arc(x, y, 58, 0, 6.283); g.fill(); g.strokeStyle = "rgba(255,90,80,.9)"; g.lineWidth = px(2); g.setLineDash([px(6), px(5)]); g.stroke(); g.setLineDash([]); }
      // the rifle posts on the west slopes, every one looking east
      if (hi("snipe")) for (const [x, y] of F.snipe) { const cg2 = g.createLinearGradient(x, y, x + 80, y); cg2.addColorStop(0, "rgba(255,80,66,.6)"); cg2.addColorStop(1, "rgba(255,70,60,0)"); g.fillStyle = cg2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 80, y - 22); g.lineTo(x + 80, y + 22); g.closePath(); g.fill();
        g.strokeStyle = "rgba(255,90,80,.95)"; g.lineWidth = px(1.8); g.beginPath(); g.arc(x, y, 5, 0, 6.283); g.moveTo(x - 9, y); g.lineTo(x - 3, y); g.moveTo(x + 3, y); g.lineTo(x + 9, y); g.moveTo(x, y - 9); g.lineTo(x, y - 3); g.moveTo(x, y + 3); g.lineTo(x, y + 9); g.stroke(); }
      // the way an army usually goes, and the way people would run from a fallen capital
      const route = (P, col, dash, w = 3.2) => { const u = Math.min(1, age / 1.3); g.strokeStyle = col; g.lineWidth = px(w); if (dash) g.setLineDash([px(12), px(7)]); g.beginPath(); const [ex, ey, an] = fmPart(g, P, u); g.stroke(); g.setLineDash([]);
        g.fillStyle = col; g.save(); g.translate(ex, ey); g.rotate(an); g.scale(px(1), px(1)); g.beginPath(); g.moveTo(9, 0); g.lineTo(-9, -8); g.lineTo(-9, 8); g.closePath(); g.fill(); g.restore(); };
      if (hi("attack")) route([F.here, [330, 322], F.kovno, [470, 270], [530, 268], [600, 258], [690, 238], [770, 205], [818, 186]], "rgba(127,227,255,.95)", true);
      if (hi("flee")) { route([[822, 186], [770, 205], [690, 238], [600, 258], [530, 268], [478, 270]], "rgba(245,245,245,.92)", false, 4); route([[828, 150], [740, 132], [620, 100], [548, 90], [500, 99]], "rgba(245,245,245,.92)", false, 4);
        if (age > 1.3) for (const [x, y] of [[470, 271], [492, 99]]) { g.strokeStyle = "rgba(255,60,50,.95)"; g.lineWidth = px(4); const d = 9; g.beginPath(); g.moveTo(x - d, y - d); g.lineTo(x + d, y + d); g.moveTo(x + d, y - d); g.lineTo(x - d, y + d); g.stroke(); } }
      // the imperial capital is not on this sheet at all: only the road off its western edge
      if (hi("capital")) { const y = 336, u = Math.min(1, age / 1.0); g.strokeStyle = `rgba(127,227,255,${0.7 + 0.3 * pulse})`; g.lineWidth = px(4); g.setLineDash([px(12), px(7)]); g.lineDashOffset = t * px(30); g.beginPath(); g.moveTo(200, y - 4); g.lineTo(200 - 190 * u, y - 4); g.stroke(); g.setLineDash([]);
        g.fillStyle = "rgba(127,227,255,.95)"; g.save(); g.translate(14, y - 4); g.scale(px(1), px(1)); g.beginPath(); g.moveTo(-10, 0); g.lineTo(8, -10); g.lineTo(8, 10); g.closePath(); g.fill(); g.restore(); }
      // where we stand
      if (seen(F.here[0])) { const [x, y] = F.here; g.strokeStyle = `rgba(255,212,0,${0.9 - 0.6 * ((t * 0.8) % 1)})`; g.lineWidth = px(2); g.beginPath(); g.arc(x, y, px(8 + 18 * ((t * 0.8) % 1)), 0, 6.283); g.stroke();
        g.fillStyle = "#ffd400"; g.save(); g.translate(x, y); g.scale(px(1), px(1)); g.beginPath(); g.moveTo(0, 2); g.lineTo(-9, -14); g.lineTo(9, -14); g.closePath(); g.fill(); g.restore(); }
      // the terminal's tags: a leader line and a small dark plate, constant size on screen; dim until the talk turns to them
      const tag = (x, y, dx, dy, txt, sub, on, col = "127,227,255") => { if (!seen(x)) return; g.save(); g.translate(x, y); g.scale(px(1), px(1));
        const A = on ? 1 : 0.9; g.globalAlpha = st.a * A; g.strokeStyle = `rgba(${col},.9)`; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(dx, dy); g.stroke(); g.fillStyle = `rgba(${col},1)`; g.beginPath(); g.arc(0, 0, 2.6, 0, 6.283); g.fill();
        g.font = `${on ? 700 : 600} ${on ? 16 : 13}px 'Noto Sans KR', sans-serif`; const w1 = g.measureText(txt).width; g.font = `500 11px 'Noto Sans KR', sans-serif`; const w2 = sub ? g.measureText(sub).width : 0;
        const w = Math.max(w1, w2) + 16, hgt = sub ? (on ? 42 : 38) : (on ? 26 : 22), bx = dx < 0 ? dx - w : dx, by = dy - hgt / 2;
        g.fillStyle = "rgba(4,10,14,.94)"; g.fillRect(bx, by, w, hgt); g.strokeStyle = `rgba(${col},${on ? 0.95 : 0.5})`; g.lineWidth = on ? 1.6 : 1; g.strokeRect(bx + 0.5, by + 0.5, w - 1, hgt - 1);
        g.fillStyle = on ? "#fff" : `rgba(${col},1)`; g.textBaseline = "top"; g.font = `${on ? 700 : 600} ${on ? 16 : 13}px 'Noto Sans KR', sans-serif`; g.fillText(txt, bx + 8, by + 4);
        if (sub) { g.font = `500 11px 'Noto Sans KR', sans-serif`; g.fillStyle = `rgba(${col},.9)`; g.fillText(sub, bx + 8, by + (on ? 24 : 21)); } g.restore(); };
      tag(F.city[0], F.city[1], -30, -70, "수도 · 함락", "열원 다수 · 1812 모스크바 재현", hi("city"), "255,150,110");
      tag(fmRidgeX(370), 370, 70, 18, "발다이 산맥", "", hi("ridge"));
      tag(F.bridge[0], F.bridge[1], 70, -40, "베레지나 다리", "붕괴 · 도하 불가", hi("smallpass"));
      tag(fmRidgeX(286), 290, 80, 40, "니에멘 협곡", "", hi("bigpass"));
      tag(F.light[0], F.light[1] - 10, -60, -46, "코브노 등대", hi("range") ? "방어 구역 전체" : "", hi("light") || hi("range"));
      tag(F.here[0], F.here[1], -70, 34, "현재 위치 · 외곽", "", hi("here"), "255,212,0");
      if (hi("line")) tag(fmRidgeX(190) - 24, 190, -90, -10, "봉쇄선", "미셸 네", true, "255,110,100");
      if (hi("capital")) tag(30, 332, 40, -60, "제도(帝都) 방면", "지도 밖 · 서쪽 약 1,600km", true);
    }
    g.restore();
    g.strokeStyle = "#7fe3ff"; g.lineWidth = 3; for (const [ax, ay, sx, sy] of [[X0, Y0, 1, 1], [X0 + W0, Y0, -1, 1], [X0, Y0 + H0, 1, -1], [X0 + W0, Y0 + H0, -1, -1]]) { g.beginPath(); g.moveTo(ax + sx * 26, ay); g.lineTo(ax, ay); g.lineTo(ax, ay + sy * 26); g.stroke(); }
    g.font = "600 13px Oswald, 'Noto Sans KR', sans-serif"; g.fillStyle = "rgba(10,20,26,.82)"; g.fillRect(X0, Y0, 300, 26); g.fillStyle = "#7fe3ff"; g.textBaseline = "alphabetic";
    g.fillText(st.raw ? "노획물 · 낙오병의 지도" : scan < 1 ? "SCANNING · 지형 검출 중" : "TEOHI ARCHIVE · 노획 지도 해석", X0 + 12, Y0 + 18);
    g.restore();
  }
  function regionMap(g, st, t) {
    if (st.key === "found") return foundMap(g, st, t);
    const R = REGION[st.key]; if (!R) return;
    const X0 = 90, Y0 = 70, W0 = 1100, H0 = 400, a = st.a;
    g.save(); g.globalAlpha = a;
    g.fillStyle = "rgba(4,12,18,.88)"; g.fillRect(X0, Y0, W0, H0);
    g.strokeStyle = "rgba(127,227,255,.5)"; g.lineWidth = 1.5; g.strokeRect(X0 + 0.5, Y0 + 0.5, W0, H0);
    g.strokeStyle = "rgba(127,227,255,.07)"; g.lineWidth = 1; for (let x = X0 + 50; x < X0 + W0; x += 50) { g.beginPath(); g.moveTo(x, Y0); g.lineTo(x, Y0 + H0); g.stroke(); } for (let y = Y0 + 50; y < Y0 + H0; y += 50) { g.beginPath(); g.moveTo(X0, y); g.lineTo(X0 + W0, y); g.stroke(); }
    g.strokeStyle = "#7fe3ff"; g.lineWidth = 3; for (const [cx, cy, sx, sy] of [[X0, Y0, 1, 1], [X0 + W0, Y0, -1, 1], [X0, Y0 + H0, 1, -1], [X0 + W0, Y0 + H0, -1, -1]]) { g.beginPath(); g.moveTo(cx + sx * 22, cy); g.lineTo(cx, cy); g.lineTo(cx, cy + sy * 22); g.stroke(); }
    g.font = "600 13px Oswald, 'Noto Sans KR', sans-serif"; g.fillStyle = "rgba(127,227,255,.75)"; g.fillText(R.head[0], X0 + 18, Y0 + 24);
    g.font = "700 18px 'Noto Sans KR', sans-serif"; g.fillStyle = "#e6f6ff"; g.fillText(R.head[1], X0 + 18, Y0 + 48);
    const P0 = R.places, scan = (t * 0.25) % 1; g.fillStyle = "rgba(127,227,255,.05)"; g.fillRect(X0, Y0 + H0 * scan, W0, 3);
    const hi = (id) => st.hi.includes(id), pulse = 0.5 + 0.5 * Math.sin(t * 4);
    // the hedge country, hatched; the river by the lighthouse
    { const p = P0.bocage; g.save(); g.beginPath(); g.ellipse(p.x, p.y + 20, 140, 70, -0.15, 0, Math.PI * 2); g.clip(); g.strokeStyle = `rgba(150,200,150,${hi("bocage") ? 0.55 : 0.25})`; g.lineWidth = 1.5; for (let i = -30; i < 30; i++) { g.beginPath(); g.moveTo(p.x - 160 + i * 12, p.y + 100); g.lineTo(p.x - 60 + i * 12, p.y - 70); g.stroke(); } g.restore(); }
    g.strokeStyle = "rgba(110,170,220,.45)"; g.lineWidth = 3; g.beginPath(); g.moveTo(1040, Y0); for (let y = Y0; y <= Y0 + H0; y += 20) g.lineTo(1030 + Math.sin(y / 30) * 14, y); g.stroke();
    // the old line, dashed, with nobody on it
    { const p = P0.line; g.setLineDash([10, 8]); g.strokeStyle = `rgba(255,120,120,${hi("line") ? 0.9 : 0.45})`; g.lineWidth = 2.5; g.beginPath(); g.moveTo(p.x, Y0 + 30); g.lineTo(p.x - 20, Y0 + H0 - 30); g.stroke(); g.setLineDash([]); }
    // routes, drawn out as they are named
    const rt = t - st.routeT;
    st.route.forEach((rk, ri) => {
      const ids = R.routes[rk]; if (!ids) return; const pts = ids.map((id) => P0[id]);
      let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      const show = Math.min(1, Math.max(0, rt - ri * 0.4) / 1.4) * L, col = rk === "rebel" ? "255,110,90" : rk === "retreat" ? "200,200,210" : "127,227,255";
      g.strokeStyle = `rgba(${col},.9)`; g.lineWidth = 3.5; if (rk !== "rebel") g.setLineDash([12, 8]); g.lineDashOffset = -t * 30;
      g.beginPath(); g.moveTo(pts[0].x, pts[0].y); let left = show, end = pts[0];
      for (let i = 1; i < pts.length && left > 0; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y), u = Math.min(1, left / d); end = { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * u, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * u }; g.lineTo(end.x, end.y); left -= d; }
      g.stroke(); g.setLineDash([]);
      if (show >= L) { const b = pts[pts.length - 1], c = pts[pts.length - 2], ang = Math.atan2(b.y - c.y, b.x - c.x); g.fillStyle = `rgba(${col},.95)`; g.save(); g.translate(b.x - Math.cos(ang) * 30, b.y - Math.sin(ang) * 30); g.rotate(ang); g.beginPath(); g.moveTo(10, 0); g.lineTo(-8, -8); g.lineTo(-8, 8); g.closePath(); g.fill(); g.restore(); }
    });
    // the places
    for (const id in P0) {
      const p = P0[id], on = hi(id), c = id === "camp" ? "255,120,100" : id === "here" ? "255,212,0" : "127,227,255";
      g.fillStyle = `rgba(${c},${on ? 0.95 : 0.7})`; g.strokeStyle = `rgba(${c},${on ? 1 : 0.7})`; g.lineWidth = 2;
      if (p.icon === "city") { g.beginPath(); g.arc(p.x, p.y, 34, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(p.x, p.y, 24, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(p.x, p.y, 6, 0, Math.PI * 2); g.fill(); }
      else if (p.icon === "camp") { g.beginPath(); g.moveTo(p.x, p.y - 16); g.lineTo(p.x + 14, p.y + 10); g.lineTo(p.x - 14, p.y + 10); g.closePath(); g.stroke(); g.beginPath(); g.arc(p.x, p.y + 2, 4, 0, Math.PI * 2); g.fill(); }
      else if (p.icon === "here") { const b = 4 * Math.sin(t * 5); g.beginPath(); g.moveTo(p.x, p.y + 4 + b); g.lineTo(p.x - 11, p.y - 16 + b); g.lineTo(p.x + 11, p.y - 16 + b); g.closePath(); g.fill(); }
      else if (p.icon === "tower") { g.fillRect(p.x - 5, p.y - 22, 10, 26); g.beginPath(); g.arc(p.x, p.y - 26, 7, 0, Math.PI * 2); g.fill(); }
      else if (p.icon === "line") { g.beginPath(); g.moveTo(p.x - 9, p.y - 9); g.lineTo(p.x + 9, p.y + 9); g.moveTo(p.x + 9, p.y - 9); g.lineTo(p.x - 9, p.y + 9); g.stroke(); }
      else { g.beginPath(); g.arc(p.x, p.y, 5, 0, Math.PI * 2); g.fill(); }
      if (on) { g.strokeStyle = `rgba(${c},${0.35 + 0.45 * pulse})`; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, 44 + 8 * pulse, 0, Math.PI * 2); g.stroke(); }
      const ly = p.y + (p.icon === "city" ? 56 : 34);
      g.textAlign = "center"; g.font = `${on ? 800 : 600} ${on ? 20 : 17}px 'Noto Sans KR', sans-serif`; g.fillStyle = on ? "#fff" : "rgba(230,240,250,.8)"; g.fillText(p.label, p.x, ly);
      g.font = "500 13px 'Noto Sans KR', sans-serif"; g.fillStyle = `rgba(${c},.85)`; g.fillText(p.sub, p.x, ly + 18); g.textAlign = "left";
    }
    g.restore();
  }
  window.__bslPlay = (key) => playStory(key, () => {});   // for checking a scene on its own
  window.__bslGo = (r, a) => go(r, a);   // for checking a screen on its own
  function playStory(key, done, opt = {}) {
    if (window.BGM) BGM.stop();   // story scenes keep their own music (none yet): the main track waits
    const script = STORIES[key]; if (!script) { done && done(); return; }
    const box = h("div", "story"); sheet.appendChild(box);
    const bg = h("div", "bg"); box.appendChild(bg);
    const cv = h("canvas"); cv.width = VW; cv.height = VH; box.appendChild(cv); const g = cv.getContext("2d");
    const wcv = h("canvas"); wcv.width = VW; wcv.height = VH; box.appendChild(wcv); const wg = wcv.getContext("2d");   // weather and the terrain sheet, over the figures
    const sdoc = h("div", "sdoc"); box.appendChild(sdoc);
    let weather = null, flakes = [], smap = null;
    const dlg = h("div", "dlg"), who = h("div", "who"), txt = h("div", "txt"), arrow = h("div", "arrow"); dlg.append(who, txt, arrow); box.appendChild(dlg);
    const black = h("div", "black"), fl = h("div", "flashw"), monoBg = h("div", "black"); box.append(black, fl, monoBg);
    Object.assign(monoBg.style, { zIndex: 4, opacity: 0, transition: "opacity .35s", background: "#000" });   // a monologue line darkens what is behind it
    const ctl = h("div", "ctl"); const bAuto = h("div", "btn en", "AUTO"), bLog = h("div", "btn en", "LOG"), bSkip = h("div", "btn en", "SKIP"); ctl.append(bAuto, bLog, bSkip); box.appendChild(ctl);
    const chars = {};   // id -> { at, expr, face, a (alpha), x }
    const log = [];
    let auto = false, typing = null, waitClick = false, ended = false, stack = [{ list: script, i: 0 }], speakingId = null;
    const X = { l: 330, c: 640, r: 950, ll: 200, rr: 1080 };
    let t0 = performance.now();
    let lastT = 0;
    function frame(now) {
      if (ended) return;
      const t = (now - t0) / 1000, dt = Math.min(0.05, t - lastT); lastT = t;
      g.clearRect(0, 0, VW, VH);
      wg.clearRect(0, 0, VW, VH);
      if (weather) storyWeather(wg, weather, flakes, dt);
      if (smap) { smap.a += ((smap.out ? 0 : 1) - smap.a) * 0.12; if (smap.out && smap.a < 0.02) smap = null; else regionMap(wg, smap, t); }
      const ids = Object.keys(chars).sort((a, b) => (a === speakingId) - (b === speakingId));
      for (const id of ids) {
        const c = chars[id];
        c.a += ((c.out ? 0 : 1) - c.a) * 0.15; c.x += (X[c.at] - c.x) * 0.15;
        if (c.out && c.a < 0.02) { delete chars[id]; continue; }
        g.save(); g.globalAlpha = c.a;
        if (speakingId && id !== speakingId && "filter" in g) g.filter = "brightness(0.5) saturate(0.7)";
        const sd = STAND[id];
        if (sd && ART[sd.img]) {   // an illustrated standing sprite, framed from the head down past the knees, breathing a little
          const im = imgOf(sd.img);
          if (im.complete && im.naturalWidth) {
            const R = sd.r || [0, 0, im.naturalWidth, im.naturalHeight];   // a figure may be one cell of a sheet
            const sc = sd.h / R[3], br = 1 + Math.sin(t * 1.6) * 0.004, f = c.face === -1 ? -1 : 1;
            g.translate(c.x, sd.top + sd.h); g.scale(f * sc, sc * br); g.translate(-R[2] / 2, -R[3]);
            g.drawImage(im, R[0], R[1], R[2], R[3], 0, 0, R[2], R[3]);
            const fk = sd.faces && sd.faces[c.expr || "neutral"];
            if (fk && ART[fk.img]) { const fi = imgOf(fk.img); if (fi.complete) { if (fk.r) g.drawImage(fi, fk.r[0], fk.r[1], fk.r[2], fk.r[3], fk.x, fk.y, fk.r[2], fk.r[3]); else g.drawImage(fi, fk.x, fk.y); } }
          }
        } else if (CAST[id]) {
          const ci = imgOf(CAST[id].img);
          if (ci.complete && ci.naturalWidth) { const R = CAST[id].rect, f = c.face === 1 ? 1 : -1;
            if (R) { const sc = CAST[id].h / R[3]; g.translate(c.x, 700); g.scale(f * sc, sc); g.drawImage(ci, R[0], R[1], R[2], R[3], -R[2] / 2, -R[3], R[2], R[3]); }   // atlas frames face right
            else { const sc = CAST[id].h / ci.naturalHeight; g.translate(c.x, 700); g.scale(f * sc, sc); g.drawImage(ci, -ci.naturalWidth / 2, -ci.naturalHeight); } }
        } else B.drawChar(g, id, c.x, 900, 520, { t, expr: c.expr, face: c.face, mem: (c.mem = c.mem || {}) });
        g.restore();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    // a monologue line belongs to the dark: it leaves when the scene changes
    const dropMono = () => { monoBg.style.opacity = 0; if (dlg.classList.contains("mono")) { dlg.style.visibility = "hidden"; txt.textContent = ""; } };
    function type(name, sub, text, kind, o = {}) {
      dlg.style.visibility = "";
      dlg.className = "dlg" + (kind === "nar" ? " nar" : "") + (kind === "mono" ? " mono" : "") + (kind === "sys" ? " sys" : "") + (o.tone ? " " + o.tone : "");
      dlg.style.zIndex = kind === "mono" || black.style.opacity === "1" ? 5 : "";   // a monologue line, or any line said in the dark, shows over the blackout
      monoBg.style.opacity = kind === "mono" ? 0.82 : 0;
      const nm = o.ruby ? `<ruby>${esc(name)}<rt>${esc(o.ruby)}</rt></ruby>` : esc(name);
      who.className = "who" + (o.ruby ? " rb" : "");
      who.style.display = name ? "" : "none"; who.innerHTML = name ? `${nm}${sub ? `<small>${esc(sub)}</small>` : ""}` : "";
      if (kind === "me") who.style.borderColor = "#7fc8ff"; else who.style.borderColor = "#ffd400";
      // "[인간|악마]" in a line: the word with its reading over it (furigana); it types in as one piece
      const toks = []; text.replace(/\[([^\]|]+)\|([^\]]+)\]|([\s\S])/gu, (m, base, rb, ch) => { toks.push(ch !== undefined ? esc(ch) : `<ruby class="fr">${esc(base)}<rt>${esc(rb)}</rt></ruby>`); return ""; });
      const plain = text.replace(/\[([^\]|]+)\|([^\]]+)\]/g, "$1($2)");
      log.push({ name: name || (kind === "sys" ? "LINK" : ""), text: plain, me: kind === "me" });
      txt.innerHTML = ""; arrow.style.display = "none";
      let n = 0;
      clearInterval(typing);
      typing = setInterval(() => { n++; txt.innerHTML = toks.slice(0, n).join(""); if (n >= toks.length) finishType(); }, o.tone === "cold" ? 62 : 28);
      function finishType() { clearInterval(typing); typing = null; txt.innerHTML = toks.join(""); arrow.style.display = ""; waitClick = true; if (auto) setTimeout(() => { if (auto && waitClick) next(); }, 900 + plain.length * 45); }
      txt.finish = finishType;
    }
    function next() {
      if (ended) return;
      waitClick = false;
      while (stack.length && stack[stack.length - 1].i >= stack[stack.length - 1].list.length) stack.pop();
      if (!stack.length) return end();
      const top = stack[stack.length - 1], s = top.list[top.i++];
      if (s.bg !== undefined || s.black !== undefined || s.cg !== undefined) dropMono();
      if (s.bg !== undefined) { bg.style.opacity = 0; setTimeout(() => { bg.style.backgroundImage = s.bg ? `url(${ART[STORY_BG[s.bg] || s.bg] || ""})` : "none"; bg.style.opacity = 1; }, s.cut ? 0 : 400); return setTimeout(next, s.cut ? 0 : 500); }
      if (s.weather !== undefined) { weather = s.weather; if (!weather) flakes = []; return next(); }   // snow over the scene, or a blizzard, or nothing
      if (s.map !== undefined) {   // the terrain sheet: opened, re-marked, or put away
        if (s.map === null) { if (smap) smap.out = true; return next(); }
        const prev = smap && !smap.out ? smap : null;
        smap = { key: s.map, hi: s.hi || [], route: s.route || [], a: prev ? prev.a : 0, since: performance.now() / 1000 - t0, routeT: (prev && JSON.stringify(prev.route) === JSON.stringify(s.route || [])) ? prev.routeT : performance.now() / 1000 - t0,
          cam: s.cam || (prev && prev.cam), cc: prev && prev.cc, scan: !!s.scan, raw: !!s.raw };
        return next();
      }
      if (s.doc !== undefined) {   // a document handed over: shown at the side until the next one or until put away
        sdoc.classList.remove("in");
        if (!s.doc) return next();
        const d = s.doc;
        setTimeout(() => {
          sdoc.className = "sdoc " + (d.kind || "note");
          sdoc.innerHTML = `${d.pic ? `<div class="pic" style="background-image:url(${ART[d.pic] || ""})"></div>` : ""}<h4>${esc(fill(d.title || ""))}</h4>${(d.lines || []).map((l) => { const [q, r] = String(l).split("|"); return r === undefined ? `<p>${esc(fill(l))}</p>` : `<p><b>${esc(q)}</b>${esc(fill(r))}</p>`; }).join("")}${d.foot ? `<div class="ft">${esc(d.foot)}</div>` : ""}${d.stamp ? `<div class="st">${esc(d.stamp)}</div>` : ""}`;
          requestAnimationFrame(() => sdoc.classList.add("in"));
        }, 120);
        return next();
      }
      if (s.show) { chars[s.show] = Object.assign(chars[s.show] && !chars[s.show].out ? chars[s.show] : { a: 0, x: X[s.at || "c"] + (s.at === "l" ? -60 : 60) }, { at: s.at || "c", expr: s.expr, face: s.face, out: false }); return next(); }
      if (s.hide) { if (chars[s.hide]) chars[s.hide].out = true; return next(); }
      if (s.place) {   // where we are now: a small caption top-left for a few seconds; the scene goes on under it
        const pl = h("div", "place", `<span>${esc(s.place)}</span>`); box.appendChild(pl); setTimeout(() => pl.classList.add("out"), 3800); setTimeout(() => pl.remove(), 5000);
        return next();
      }
      if (s.black !== undefined) { if (s.black) dlg.style.visibility = "hidden"; black.style.transition = `opacity ${s.slow || 0.7}s`; black.style.opacity = s.black ? 1 : 0; return setTimeout(next, (s.slow || 0.7) * 1000); }
      if (s.flash) { fl.style.background = s.flash === true ? "#fff" : s.flash; fl.style.transition = "none"; fl.style.opacity = 0.9; requestAnimationFrame(() => { fl.style.transition = "opacity .8s"; fl.style.opacity = 0; }); return next(); }
      if (s.shake) { box.classList.remove("shake"); void box.offsetWidth; box.classList.add("shake"); return s.shake > 1 ? setTimeout(next, 450) : next(); }
      if (s.wait) return setTimeout(next, s.wait * 1000);
      if (s.title) {
        const tl = h("div", "title", `<div class="a en">${esc(s.title[0])}</div><div class="b">${esc(s.title[1])}</div><div class="c"></div>`); box.appendChild(tl); dlg.style.visibility = "hidden";   // the title stands alone
        requestAnimationFrame(() => { tl.style.opacity = 1; });
        setTimeout(() => { tl.style.opacity = 0; setTimeout(() => { tl.remove(); next(); }, 1000); }, 2400); return;
      }
      if (s.choice) {
        // loop: picking an option that leads nowhere plays its lines and brings the remaining options back;
        // only an option marked as the way forward (third element true) moves the scene on
        dlg.style.visibility = "hidden";
        const cb = h("div", "choices");
        s.choice.forEach((opt, k) => {
          const [label, sub, exit] = opt;
          const c = h("div", "btn", esc(fill(label)));
          c.onclick = (ev) => {
            ev.stopPropagation(); cb.remove(); dlg.style.visibility = "";
            log.push({ name: S.name || "지휘관", text: fill(label), me: true });
            const steps = (sub || []).slice();
            if (s.loop && !exit) steps.push({ choice: s.choice.filter((_, j) => j !== k), loop: true });
            if (steps.length) stack.push({ list: steps, i: 0 });
            next();
          };
          cb.appendChild(c);
        });
        box.appendChild(cb); return;
      }
      if (s.cg !== undefined) {   // a full-screen cutscene still, slowly pushing in
        const old = box.querySelector(".cg"); if (old) { old.style.opacity = 0; setTimeout(() => old.remove(), 600); }
        if (s.cg) {
          const c = h("div", "cg"); c.style.backgroundImage = `url(${ART[s.cg] || ""})`; if (s.cell) { const [cx, cy] = s.cell, [gw, gh] = s.grid || [2, 2]; c.style.backgroundSize = `${gw * 100}% ${gh * 100}%`; c.style.backgroundPosition = `${gw > 1 ? cx / (gw - 1) * 100 : 0}% ${gh > 1 ? cy / (gh - 1) * 100 : 0}%`; }   /* one still out of a sheet of them */ if (s.origin) c.style.transformOrigin = s.origin; if (s.speed) c.style.transition = `opacity .5s, transform ${s.speed}s ease-out`; box.insertBefore(c, wcv);
          requestAnimationFrame(() => { c.style.opacity = 1; c.style.transform = `scale(${s.zoom || 1.08})`; });
        }
        return setTimeout(next, s.cut ? 0 : 300);
      }
      if (s.say) {
        speakingId = s.say; if (s.expr !== undefined && chars[s.say]) chars[s.say].expr = s.expr;
        const sp = speaker(s.say); return type(sp.main, s.ruby ? "" : sp.sub, fill(s.text), "say", { ruby: s.ruby, tone: s.tone });
      }
      if (s.nar) { speakingId = null; return type("", "", fill(s.nar), "nar"); }
      if (s.me) { speakingId = null; return type(S.name || "지휘관", "", fill(s.me), "me"); }
      if (s.sys) { speakingId = null; return type("", "", fill(s.sys), "sys"); }
      if (s.mono !== undefined) { speakingId = null; return type("", "", fill(s.mono), "mono"); }
      next();
    }
    function end() {
      if (ended) return; ended = true; clearInterval(typing);
      if (opt.cut) { done && done(); setTimeout(() => box.remove(), 100); return; }   // straight into whatever comes next, no fade back to the lobby
      box.style.transition = "opacity .6s"; box.style.opacity = 0; setTimeout(() => { box.remove(); done && done(); }, 600);
    }
    box.onclick = () => { if (typing) return txt.finish(); if (waitClick) next(); };
    bAuto.onclick = (ev) => { ev.stopPropagation(); auto = !auto; bAuto.classList.toggle("on", auto); if (auto && waitClick) next(); };
    bSkip.onclick = (ev) => { ev.stopPropagation(); confirmBox("스토리 건너뛰기", "남은 스토리를 건너뜁니다. 작전 화면에서 언제든 다시 볼 수 있습니다.", "건너뛰기", end); };
    bLog.onclick = (ev) => {
      ev.stopPropagation();
      const l = h("div", "log btn"); l.innerHTML = log.map((e) => `<div class="l${e.me ? " me" : ""}">${e.name ? `<b>${esc(e.name)}</b>` : ""}<span>${esc(e.text)}</span></div>`).join("") || "<div style='color:#888'>아직 기록이 없습니다</div>";
      l.onclick = (e2) => { e2.stopPropagation(); l.remove(); }; box.appendChild(l); l.scrollTop = 1e9;
    };
    next();
  }

  // level-0 training straight after the prologue: Yui alone, on the terminal's training grid
  function startTutorial() {
    host.hidden = true;
    const o = S.ops.yui;
    B.start("tutorial", [{ id: "yui", skillIdx: 0, mult: mult("yui"), elite: o ? o.elite : 0, pot: o ? o.pot : 1 }], () => {
      host.hidden = false; S.tutorialDone = true; save(); render();
      (S.seen = S.seen || {})["TR-00:after"] = 1;
      playStory("TR-00:after", () => { S.guide = 1; save(); render(); });
    }, { playerName: S.name });
  }

  // the training room: your own operators as they stand, endless cost, foes on demand
  // operators you don't have can be tried too, at full promotion and level with skill level 7 (no mastery)
  function sbOp(id) { if (S.ops[id]) return S.ops[id]; const e = def(id).rarity <= 3 ? 1 : 2; return { elite: e, lvl: maxLv(id, e), sl: 7, pot: 1, skill: 0 }; }
  function startSandbox(sel) {
    // the training room fields your own operators as they are now
    const squad = sel.filter((q) => def(q.id)).slice(0, 12).map((q) => { const own = !!S.ops[q.id], o = sbOp(q.id); return { id: q.id, skillIdx: Math.min(q.s || 0, o.elite, Math.max(0, (def(q.id).skills || []).length - 1)), mult: own ? mult(q.id) : TD.growth(def(q.id), o.elite, o.lvl, maxLv(q.id, o.elite)), elite: o.elite, look: own ? lookElite(q.id) : o.elite, pot: o.pot || 1, slv: o.sl || 1, sm: own ? smList(q.id) : [0, 0, 0] }; });
    host.hidden = true;
    B.start("sandbox", squad, () => { host.hidden = false; render(); });
  }

  // ---------- the lab ----------
  // the squad check for a lab stage: the stage's fixed squad if it has one, else the current squad as for any operation; no stamina, no rewards
  function labPrep(el, sel) {
    const s = TD.STAGES[sel], m = STAGE_META[sel];
    el.appendChild(h("div", "lt-bg")); el.appendChild(h("div", "lt-wm en", "SQUAD·CHECK"));
    el.appendChild(topBar("", "", () => go("lab"), { res: false }));
    el.appendChild(h("div", "sq-stage", `<span class="en">${s.code}</span>${esc(s.name)}<b>실험</b>`));
    if (m.fixed) { const row = h("div", "fixed-sq"); el.appendChild(row); const keep = {};
      for (const [id, elite, lvl] of m.fixed) { if (!S.ops[id]) { keep[id] = true; S.ops[id] = { lvl, elite, pot: 1, skill: 0, got: 0 }; } const c = opCard(id); c.onclick = null; row.appendChild(c); }
      for (const id in keep) delete S.ops[id];
      el.appendChild(h("div", "cap-note", `<b>고정 편성</b> · 이 판은 정해진 가사인격으로 출전합니다`)); }
    else squadView(el, () => go("prep", sel), { prep: sel });
    const ok = m.fixed || squadIds().length > 0;
    const g = h("div", "btn go sq-go prc" + (ok ? "" : " dis"), `<div class="a">실험 개시</div><div class="b">보상 · 기록 없음</div>`);
    g.onclick = () => { if (!m.fixed && !squadIds().length) return toast("편성에 가사인격이 없습니다"); launchLab(sel); };
    el.appendChild(g);
  }
  // a lab battle: the progress pointer, stamina, clears, rewards, missions and the scenes-seen list are all left as they were; the stage's script plays every time
  function launchLab(sel) {
    const m = STAGE_META[sel], fx = m.fixed;
    const squad = fx ? fx.map(([id, elite, lvl]) => ({ id, skillIdx: 0, mult: TD.growth(def(id), elite, lvl, maxLv(id, elite)), elite, pot: 1 }))
      : squadIds().slice(0, m.squad || 12).map((id) => ({ id, skillIdx: S.ops[id].skill, mult: mult(id), elite: S.ops[id].elite, look: lookElite(id), pot: S.ops[id].pot, slv: S.ops[id].sl || 1, sm: smList(id) }));
    host.hidden = true;
    B.start(sel, squad, (r) => { host.hidden = false; if (r.quit) return go("lab"); go("result", Object.assign({}, r, { reward: { lab: true } })); },
      { seen: {}, mark: () => {}, practice: false, cost: 0, me: S.name || "지휘관", lab: true });
  }

  // ---------- battles ----------
  function launch(sel, practice) {
    S.last = sel; save();
    const cap = STAGE_META[sel].squad || 12, fx = STAGE_META[sel].fixed;
    const squad = fx ? fx.map(([id, elite, lvl]) => ({ id, skillIdx: 0, mult: TD.growth(def(id), elite, lvl, maxLv(id, elite)), elite, pot: 1 }))   // the lesson's own squad
      : squadIds().slice(0, cap).map((id) => ({ id, skillIdx: S.ops[id].skill, mult: mult(id), elite: S.ops[id].elite, look: lookElite(id), pot: S.ops[id].pot, slv: S.ops[id].sl || 1, sm: smList(id) }));
    for (const [id, elite, lvl, sk] of STAGE_META[sel].guest || []) if (!squad.some((q) => q.id === id))   // a guest for this operation, as she stands in the story (the squad's own copy goes instead, if it is there)
      squad.push({ id, skillIdx: sk || 0, mult: TD.growth(def(id), elite, lvl, maxLv(id, elite)), elite, pot: 1, guest: true });
    host.hidden = true;
    const seenOpt = { seen: Object.assign({}, S.seen || {}), mark: (k) => { (S.seen = S.seen || {})[k] = 1; save(); }, practice: !!practice, cost: practice ? 0 : STAGE_META[sel].cost, me: S.name || "지휘관" };   // what this save has already been shown in battle; the give-up box's refund
    B.start(sel, squad, (r) => {
      host.hidden = false;
      const m = STAGE_META[sel], s = TD.STAGES[sel], rec = S.stages[s.code] || (S.stages[s.code] = { stars: 0, clears: 0 });
      const reward = {};
      if (practice) reward.practice = true;
      else if (r.win) {
        const first = rec.clears === 0;
        rec.clears++; rec.stars = Math.max(rec.stars, r.stars);
        reward.coin = m.coin + r.stars * 200; S.res.coin += reward.coin;
        if (first && m.first.orb) { reward.orb = m.first.orb; S.res.orb += reward.orb; }
        reward.items = mergeItems(rollDrops(sel)); addItems(reward.items);
        reward.exp = m.exp; S.exp += m.exp;
        bump("run"); bump("stam", m.cost); if (m.supply) bump("supply");   // for the missions
        while (S.exp >= playerExpNeed()) { S.exp -= playerExpNeed(); S.lvl++; reward.lvup = true; S.res.stam = Math.max(S.res.stam, stamMax()); }
      } else { reward.refund = m.cost - 1; S.res.stam += reward.refund; }
      save();
      if (r.quit) { toStage(sel); if (reward.refund) toast(`기력 ${reward.refund} 반환`); return; }   // giving up goes straight back to the map
      if (practice) return go("result", Object.assign({}, r, { reward }));
      const key = s.code + ":after", res = Object.assign({}, r, { reward });
      if (r.win && STORIES[key] && !(S.seen || {})[key]) { (S.seen = S.seen || {})[key] = 1; save(); go("result", res); playStory(key, key === "BL-07:after" ? startBaseGuide : undefined); }
      else go("result", res);
    }, seenOpt);
  }

  // first start: the name, the link, then the prologue
  function firstStart() {
    const el = h("div", "scr"); el.style.background = "#000"; sheet.appendChild(el);
    el.innerHTML = `<div class="nm-ask">
      <div class="q">당신의 이름은 무엇으로 기억되었습니까</div>
      <input class="nm-in" maxlength="12" autocomplete="off" spellcheck="false">
      <div class="btn nm-ok">확인</div><div class="nm-hint"></div></div>`;
    const inp = el.querySelector(".nm-in"), ok = el.querySelector(".nm-ok"), hint = el.querySelector(".nm-hint");
    setTimeout(() => inp.focus(), 300);
    const submit = () => {
      const v = inp.value.trim().replace(/[<>&"]/g, "");
      if (!v) { hint.textContent = "이름을 입력해 주세요"; return; }
      S.name = v; save();
      el.innerHTML = `<div class="linking"><div class="l en">LINK</div><div class="t">링크 접속 중<span class="dots"></span></div><div class="bar"><i></i></div></div>`;
      setTimeout(() => {
        // the story opens on black over this screen, so the lobby never shows through in between
        playStory("prologue", () => { S.started = true; save(); startTutorial(); }, { cut: true });
        setTimeout(() => el.remove(), 400);
      }, 2800);
    };
    ok.onclick = submit; inp.onkeydown = (e) => { if (e.key === "Enter") submit(); };
  }

  setInterval(() => { if (!host.hidden && route.name === "lobby") { const c = sheet.querySelector(".res"); if (c) { const n = resChips(); c.replaceWith(n); } } }, 30000);
  // loading: every picture is its own file, and a battle or a screen drawn before they arrive breaks; so the game opens on a check
  // that waits for all of them (and the fonts), asks again for any that failed, and lets the player retry or go on if some never come
  function bootLoad(done) {
    const el = h("div", "boot", `<div class="bt-mk">${EMBLEM_SVG}</div>
      <div class="bt-bot"><div class="bt-ln"><span class="bt-t">리소스 확인 중</span><span class="bt-n en">0%</span></div><div class="bt-bar"><i></i></div>
      <div class="bt-err" hidden><div class="m"></div><div class="row"><div class="btn bt-re">다시 시도</div><div class="btn bt-go">그대로 진행</div></div></div></div>`);
    sheet.appendChild(el);
    const A = window.__tdAssets, bar = el.querySelector(".bt-bar i"), num = el.querySelector(".bt-n"), lab = el.querySelector(".bt-t"), err = el.querySelector(".bt-err");
    let t0 = performance.now(), fontsOk = !document.fonts, ended = false;
    if (document.fonts) document.fonts.ready.then(() => { fontsOk = true; });
    const finish = () => { if (ended) return; ended = true; el.classList.add("out"); setTimeout(() => el.remove(), 500); done(); };
    const tick = () => {
      if (ended) return;
      const st = A ? A.status() : { total: 0, ok: 0, bad: 0 }, f = st.total ? st.ok / st.total : 1;
      bar.style.width = (f * 100).toFixed(1) + "%"; num.textContent = `${Math.floor(f * 100)}%  ·  ${st.ok}/${st.total}`;
      const late = performance.now() - t0;
      if (f >= 1 && (fontsOk || late > 4000)) { lab.textContent = "확인 완료"; return setTimeout(finish, Math.max(150, 600 - late)); }   // fonts get a few seconds, then the system ones do
      if (f < 1 && (st.ok + st.bad >= st.total || late > 45000)) {   // everything has answered (or it has taken too long), and some are missing
        lab.textContent = "확인 중단"; err.hidden = false;
        err.querySelector(".m").textContent = `리소스 ${st.total - st.ok}개를 불러오지 못했습니다. 그대로 진행하면 일부 화면이나 전투가 제대로 표시되지 않을 수 있습니다.`;
        return;
      }
      setTimeout(tick, 120);
    };
    err.querySelector(".bt-re").onclick = () => { err.hidden = true; lab.textContent = "리소스 다시 확인 중"; t0 = performance.now(); if (A) A.retry(); tick(); };
    err.querySelector(".bt-go").onclick = finish;
    tick();
  }
  render();
  bootLoad(() => { booted = true; if (!S.started) firstStart(); else playMain(); });
})();
