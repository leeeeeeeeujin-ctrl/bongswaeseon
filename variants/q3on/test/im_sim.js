// chapter 2: each stage played by a plain 3~5-star squad at its recommended training and a notch below
global.window = global; require("../econ.js"); require("../game.js");
const MAXLV = { 3: [40, 55], 4: [45, 60, 70], 5: [50, 70, 80], 6: [50, 80, 90] };
// [id, x, y, dir]: deployed in order as cost allows, redeployed when they fall (dir 0 right, 1 down, 2 left, 3 up)
const P = {
  "IM-01": [["tao", 10, 5, 3], ["sunae", 10, 4, 2], ["yui", 10, 1, 2], ["alpha", 7, 1, 1], ["lilith", 4, 1, 1], ["capy", 10, 2, 2], ["ayaki", 10, 3, 2], ["falchion", 1, 5, 3]],
  "TR-03": [["tao", 7, 4, 3], ["sunae", 7, 3, 2], ["alpha", 8, 0, 1], ["lilith", 7, 0, 1], ["ayaki", 3, 0, 1]],
  "IM-02": [["tao", 11, 2, 2], ["alpha", 9, 2, 1], ["capy", 7, 2, 1], ["sunae", 11, 5, 2], ["ayaki", 10, 1, 1], ["lilith", 11, 1, 1], ["yui", 12, 3, 3], ["lulu", 12, 2, 1]],
  "IM-03": [["tao", 6, 3, 1], ["sunae", 7, 2, 3], ["ayaki", 7, 1, 1], ["yui", 6, 3, 1], ["capy", 10, 4, 2], ["alpha", 9, 1, 2], ["lilith", 8, 1, 1], ["yui", 5, 2, 2], ["lulu", 6, 3, 1], ["lulu", 5, 2, 2]],
  "IM-04": [["ayaki", 9, 5, 0], ["sunae", 12, 5, 1], ["alpha", 4, 1, 2], ["lulu", 1, 4, 3], ["yui", 1, 2, 1], ["lilith", 3, 5, 3], ["tao", 12, 6, 2], ["falchion", 2, 5, 2]],
  "IM-05": [["tao", 12, 5, 1], ["lulu", 12, 2, 3], ["alpha", 11, 7, 2], ["lilith", 10, 4, 1], ["irins", 8, 5, 0], ["yui", 9, 6, 2], ["ayaki", 10, 3, 0], ["sunae", 12, 6, 2]],
  "IM-06": [["sunae", 5, 3, 0], ["alpha", 3, 1, 0], ["ayaki", 2, 4, 0], ["lilith", 4, 1, 1], ["yui", 2, 3, 0], ["irins", 12, 1, 2], ["capy", 8, 4, 3], ["tao", 1, 4, 3]],
  "IM-07": [["tao", 11, 1, 2], ["sunae", 11, 5, 2], ["alpha", 9, 2, 0], ["lilith", 9, 4, 0], ["ayaki", 11, 3, 1], ["lulu", 8, 0, 2], ["irins", 8, 3, 3], ["yui", 8, 1, 2]],
  "IM-08": [["tao", 4, 1, 0], ["sunae", 4, 5, 0], ["lilith", 3, 2, 0], ["alpha", 2, 4, 0], ["ayaki", 1, 1, 0], ["yui", 2, 5, 0], ["lulu", 2, 1, 0], ["irins", 7, 5, 2]],
  "IM-09": [["tao", 9, 5, 2], ["yui", 12, 4, 3], ["ayaki", 10, 6, 3], ["alpha", 11, 4, 3], ["sunae", 6, 4, 3], ["lilith", 7, 4, 1], ["lulu", 3, 5, 2], ["irins", 5, 6, 3]],
  "IM-10": [["tao", 2, 4, 0], ["sunae", 4, 2, 0], ["ayaki", 3, 3, 0], ["yui", 4, 4, 0], ["lilith", 6, 3, 1], ["alpha", 5, 3, 3], ["irins", 8, 5, 3], ["lulu", 2, 2, 0]],
  "WL-01": [["sunae", 2, 2, 0], ["yui", 3, 4, 0], ["alpha", 6, 6, 3], ["irins", 4, 3, 1], ["tao", 1, 1, 0], ["lulu", 3, 5, 0], ["lilith", 2, 3, 3], ["ayaki", 3, 3, 2]],
  "WL-02": [["sunae", 5, 5, 3], ["yui", 8, 5, 3], ["tao", 4, 5, 3], ["lilith", 5, 7, 3], ["irins", 8, 7, 3], ["lulu", 9, 5, 3], ["ayaki", 3, 5, 0], ["alpha", 10, 5, 2]],
  "WL-03": [["lulu", 7, 3, 1], ["tao", 5, 2, 3], ["alpha", 4, 4, 0], ["sunae", 3, 3, 0], ["yui", 2, 2, 0], ["irins", 6, 3, 2], ["ayaki", 3, 1, 1], ["lilith", 10, 3, 2]],   // lulu first: the east lamp is lit before the first column reaches the wagon gate
  "WL-04": [["lilith", 12, 0, 1], ["sunae", 11, 2, 0], ["lulu", 2, 6, 0], ["irins", 12, 7, 3], ["yui", 11, 5, 0], ["ayaki", 9, 3, 0], ["tao", 2, 5, 0], ["alpha", 3, 3, 3]],
  "WL-05": [["yui", 4, 4, 0], ["alpha", 1, 1, 0], ["sunae", 2, 4, 0], ["tao", 2, 1, 0], ["lulu", 4, 1, 0], ["ayaki", 5, 3, 2], ["lilith", 1, 5, 0], ["irins", 8, 4, 2]],   // one keeper and a muzzle holder: the steadiest of the plans tried (three keepers: 3, two keepers and the muzzle: 9)
  "WL-06": [["tao", 9, 1, 2], ["sunae", 9, 2, 2], ["alpha", 11, 3, 2], ["yui", 10, 4, 2], ["lulu", 9, 6, 2], ["lilith", 10, 3, 3], ["irins", 10, 5, 3], ["ayaki", 11, 5, 2]],
  "WL-07": [["yui", 3, 5, 3], ["lilith", 12, 4, 1], ["tao", 2, 5, 0], ["falchion", 12, 5, 2, { after: "picketDead" }], ["sunae", 10, 5, 3], ["lulu", 11, 5, 2], ["alpha", 1, 6, 0], ["ayaki", 8, 4, 0]],   // plan W: irins swapped for falchion (five ground squares)
  "WL-08": [["tao", 1, 3, 0], ["lulu", 2, 4, 0], ["sunae", 9, 3, 0], ["ayaki", 10, 5, 3], ["yui", 5, 3, 0], ["alpha", 8, 0, 1], ["lilith", 5, 0, 1], ["falchion", 12, 3, 2, { after: "emperorMoved" }]],   // spec 5A5: the verification's hand plan H2, the advised answer: both blocking layers ((9,3) on the gun line, (5,3) on the crest) covered from the high ground, the medic behind the first layer, the muzzle once he leaves
  // H1, the plan that loses: fire kept back by the points: [["tao", 1, 3, 0], ["lulu", 2, 4, 0], ["sunae", 9, 3, 0], ["ayaki", 8, 0, 1], ["yui", 5, 3, 0], ["lilith", 10, 5, 3], ["alpha", 2, 0, 1], ["falchion", 12, 3, 2, { after: "emperorMoved" }]]
  // before 5A4: [["yui", 5, 3, 0], ["lulu", 2, 4, 0], ["tao", 1, 3, 0], ["sunae", 2, 3, 0], ["ayaki", 5, 0, 1], ["lilith", 7, 5, 3], ["alpha", 2, 0, 1], ["falchion", 12, 3, 2, { after: "emperorMoved" }]]
  // the lab (L0): LAB-00 「버티기」: two blockers in the farm lane west of Yui, two ranged on the high ground beside it
  "LAB-00": [["alpha", 11, 3, 3], ["sunae", 3, 4, 2], ["tao", 6, 5, 3], ["lilith", 10, 5, 2]],
  // LAB-01 「지붕 위」: the four chimney keepers are the static plan (with NOBOT=1 every chimney stays stopped and Yui never gets across). Everything marked
  // { after: "lab01" } is placed and pulled back by the bot rule below: the south keeper of the gap she crosses next, and the blockers and ranged of the roof she is on
  "LAB-01": [["vanguard", 2, 1, 0], ["tao", 7, 1, 2], ["specialist", 2, 6, 0, { after: "lab01" }], ["falchion", 7, 6, 2, { after: "lab01" }],
    ["sunae", 2, 3, 0, { after: "lab01" }], ["alpha", 1, 1, 1, { after: "lab01" }], ["hiro", 2, 4, 0, { after: "lab01" }], ["lilith", 1, 6, 3, { after: "lab01" }],
    ["ker", 8, 3, 0, { after: "lab01" }], ["nana", 6, 1, 1, { after: "lab01" }], ["lulu", 7, 4, 0, { after: "lab01" }], ["irins", 6, 6, 3, { after: "lab01" }],
    ["capy", 11, 6, 3, { after: "lab01" }], ["sniper", 11, 1, 1, { after: "lab01" }]],
  // LAB-02 「네 박자」: the static plan: a keeper beside the west metronome (zone A slow), a blocker on each lane, ranged on the high ground. The bot rule presses skills only on a downbeat
  "LAB-02": [["vanguard", 2, 1, 1], ["sunae", 3, 2, 2], ["ker", 2, 4, 2], ["alpha", 5, 1, 1], ["lilith", 1, 5, 0], ["irins", 5, 5, 3], ["yui", 6, 2, 2], ["lulu", 5, 4, 2]],
  // LAB-03 「거울의 방」: a static plan in the real room; each one sets its image across the glass. The one-line answer: the row both doors' roads pass (column 1 / 11, rows 1-4)
  "LAB-03": [["sunae", 1, 1, 1], ["alpha", 2, 1, 1], ["lilith", 1, 5, 3], ["ker", 2, 2, 2], ["lulu", 2, 4, 2]],
  // LAB-04 「가면무도회」: one blocker on the only deployable square of the road (1,1), fire on the high ground and beside the road; the bot judges each held mask
  "LAB-04": [["sunae", 1, 1, 1], ["alpha", 2, 1, 1], ["lilith", 1, 5, 3], ["ker", 2, 2, 2], ["lulu", 2, 4, 2]],
  // LAB-05 「손에서 손으로」: the bot lays the chain from this pool (the coordinates are only where each one would go first; { after: "lab05" } keeps the plan loop from placing them).
  // With NOBOT=1 the first five stand as a static plan: a chain of five from the vault, facing along the way
  "LAB-05": [["specialist", 2, 1, 0, { after: "lab05" }], ["vanguard", 3, 1, 0, { after: "lab05" }], ["tao", 4, 1, 0, { after: "lab05" }], ["falchion", 5, 1, 1, { after: "lab05" }], ["hiro", 5, 2, 1, { after: "lab05" }],
    ["guard", 5, 2, 1, { after: "lab05" }], ["lulu", 5, 2, 1, { after: "lab05" }], ["sunae", 5, 2, 1, { after: "lab05" }], ["ker", 5, 2, 1, { after: "lab05" }], ["yui", 5, 2, 1, { after: "lab05" }],
    ["alpha", 7, 1, 1, { after: "lab05" }], ["lilith", 5, 4, 0, { after: "lab05" }]],
  // LAB-06 「어제의 판」: plan A is WL-08's plan (attempt 1). Plan B (LAB06_B below) is plan A moved to neighbouring squares of the same kind, each one set down only once
  // yesterday's ghost of that operator has come (so neither form of the overlap rule cancels a ghost)
  "LAB-06": [["tao", 1, 3, 0], ["lulu", 2, 4, 0], ["sunae", 9, 3, 0], ["ayaki", 10, 5, 3], ["yui", 5, 3, 0], ["alpha", 8, 0, 1], ["lilith", 5, 0, 1], ["falchion", 12, 3, 2, { after: "emperorMoved" }]],
  "WL-09": [["tao", 3, 3, 3], ["sunae", 2, 3, 0], ["alpha", 5, 2, 2], ["yui", 3, 5, 0], ["lulu", 2, 1, 0], ["ayaki", 5, 4, 2], ["lilith", 1, 5, 0], ["irins", 1, 1, 0]],
};
const REC = { "TR-03": [0, 30], "IM-01": [0, 45], "IM-02": [1, 1], "IM-03": [1, 5], "IM-04": [1, 10], "IM-05": [1, 15], "IM-06": [1, 20], "IM-07": [1, 20], "IM-08": [1, 25], "IM-09": [1, 30], "IM-10": [1, 30], "WL-01": [1, 35], "WL-02": [1, 40], "WL-03": [1, 45], "WL-04": [1, 50], "WL-05": [1, 55], "WL-06": [1, 55], "WL-07": [1, 60], "WL-08": [1, 60], "WL-09": [1, 60], "LAB-00": [1, 40], "LAB-01": [1, 40], "LAB-02": [1, 40], "LAB-03": [1, 40], "LAB-04": [1, 40], "LAB-05": [1, 40], "LAB-06": [1, 60] };
const LAB06_B = [["tao", 2, 3, 0, { after: "echoClear" }], ["lulu", 3, 2, 1, { after: "echoClear" }], ["sunae", 8, 4, 0, { after: "echoClear" }], ["ayaki", 7, 5, 3, { after: "echoClear" }],
  ["yui", 5, 2, 0, { after: "echoClear" }], ["alpha", 1, 1, 0, { after: "echoClear" }], ["lilith", 2, 0, 1, { after: "echoClear" }], ["falchion", 11, 4, 2, { after: "echoClear" }]];
const STA = TD.STAGES;
// the same placements with other squads, so a stage is not tuned to one of them: tank-heavy (the light blockers become defenders), firepower (the medic becomes a sniper,
// the vanguards guards), low-rarity (three-stars only). VARIANT=tank|fire|low picks one; ALLV=1 prints all four side by side
const VARIANTS = { base: {}, tank: { lulu: "ker", falchion: "brick", alpha: "nana" }, fire: { ayaki: "nana", tao: "hiro", falchion: "guard" },
  low: { yui: "brick", sunae: "defender", lulu: "hiro", falchion: "vanguard", alpha: "nana", irins: "caster" } };
const vary = (plan, v) => { const m = VARIANTS[v] || {}; return plan.map((q) => [m[q[0]] || q[0], ...q.slice(1)]); };
// A plan entry may carry a fifth element: { from: t } (not before game time t) and/or { after: name } (not before the named test below holds)
const AFTER = {
  echoClear: (g, q) => { const F = g._echoFirst || (g._echoFirst = g.echoQ.reduce((o, r) => (o[r.id] === undefined ? Object.assign(o, { [r.id]: r.t }) : o), {}));   // LAB-06: yesterday's first ghost of this
    return (F[q[0]] === undefined || g.t > F[q[0]]) && !g.echoQ.some((r) => r.id === q[0] && r.t <= g.t + 2); },   // operator has come, and no later one of it is due within 2 s
  lab05: (g, q) => !!process.env.NOBOT && LAB05_STATIC.has(q[0]),   // LAB-05: the plan loop places nobody while the bot runs; with NOBOT the first five stand where the plan says
  lab01: (g, q) => process.env.NOBOT ? q[2] === 6 && (q[1] === 2 || q[1] === 7) : lab01Allowed(g, q),   // LAB-01: with NOBOT only the two south keepers of the static plan, always
  emperorMoved: (g) => g.t > 1 && !g.enemies.some((e) => e.type === "emperor" && e.postUntil > g.t),   // the Emperor has left his post (or is gone)
  picketDead: (g, q) => g.t > 1 && !g.enemies.some((e) => !e.ally && !e.dead && e.postUntil > g.t && Math.round(e.x) === q[1] && Math.round(e.y) === q[2]),   // nobody of theirs holds that square any more
};
const entryOk = (g, q) => { const o = q[4]; if (!o) return true; if (o.from !== undefined && g.t < o.from) return false; if (o.after && !AFTER[o.after](g, q)) return false; return true; };
// BOT[code](g, plan): what the bot does each frame on a stage beyond its static plan (NOBOT=1 switches it off). The lamp keeper rule: a lamp that is broken (by a lamp-breaker), with one of ours
// beside it who was deployed before it went out (so cannot light it) and no fresh keeper: that operator is pulled back, unless it is holding a boss; the plan sets it down again
// when its redeploy time is over, and then it is fresh. At most one such retreat per lamp per 20 s. BOTLOG collects what it did, for the reports
const BOTLOG = { retreats: [] };
function lampKeeper(g) {
  if (!g.stage.lamps || !g.lampOff.size) return;
  const last = g._keeperT || (g._keeperT = new Map());
  for (const k of g.lampOff) { const x = k % 100, y = (k / 100) | 0; if (TD.tileAt(x, y) !== "F" || g.freshKeeper(x, y) || !(g.lampBroken && g.lampBroken.has(k))) continue;   // only a BROKEN lamp: any other a stale keeper lights in time
    if (last.has(k) && g.t - last.get(k) < 20) continue;
    const off = g.lampOffT.has(k) ? g.lampOffT.get(k) : -1;
    const u = g.units.find((q) => Math.abs(q.x - x) + Math.abs(q.y - y) === 1 && q.born <= off && !q.clone && !q.summoned && !g.enemies.some((e) => e.def.boss && !e.dead && e.blockedBy === q));
    if (!u) continue;
    last.set(k, g.t); BOTLOG.retreats.push({ t: g.t, id: u.def.id, at: [u.x, u.y], lamp: [x, y], redeploy: u.def.redeploy }); g.retreat(u); }
}
// LAB-01, the rule: the north keepers stay. The south keeper of the gap Yui crosses next stands only while she is not due to move within 8 s (then it is pulled back,
// and the next gap's keeper goes down once she has crossed). The blockers and ranged of the roof she stands on are placed; those of a roof she has left are pulled back
function lab01Allowed(g, q) {
  const V = g.vip, due = V.walking ? 0 : V.waitUntil - g.t, west = V.leg === 0 && !V.walking, mid = V.leg === 1 || (V.leg === 0 && V.walking);
  const k = q[1] + "," + q[2];
  if (k === "2,6") return west && due > 8;
  if (k === "7,6") return V.leg === 0 || (V.leg === 1 && !V.walking && due > 8);   // the one-line answer: a south bridge is open only while she crosses it
  if (["2,3", "1,1", "2,4", "1,6"].includes(k)) return V.leg === 0;
  if (["8,3", "6,1", "7,4", "6,6"].includes(k)) return mid || V.leg >= 1;
  if (["11,6", "11,1"].includes(k)) return V.leg >= 1;   // the east roof's high ground, from the time she reaches the middle roof: it thins out whoever waits there for her
  return true;
}
function lab01(g, plan) { for (const u of g.units.slice()) { const q = plan.find((p) => p[0] === u.def.id && p[1] === u.x && p[2] === u.y); if (q && q[4] && q[4].after === "lab01" && !lab01Allowed(g, q)) g.retreat(u); } }
// LAB-02, the rule: a manual skill that is ready is pressed only inside its zone's downbeat window (the plan loop's own skill presses are off for this stage while the bot is on)
function lab02(g) { for (const u of g.units) if (u.sp >= u.skill.sp && u.skillT <= 0 && u.skill.mode === "manual" && g.onBeat(g.beatZone(u.x))) g.useSkill(u); }
const BOTSKILL = new Set(["LAB-02"]);
// LAB-05, the rule: keep a chain of up to four along the shortest way from the vault (taken once, at the start): always set the next card down on the free square of that way
// nearest ahead of the paper with every square between them held, facing the next square of the way, and pull back whoever stands two or more squares behind the paper;
// one ranged operator stands on the high ground nearest the paper. A paper on the ground is picked up by whoever is set down beside it
const LAB05_STATIC = new Set(["specialist", "vanguard", "tao", "falchion", "hiro"]);
function lab05(g, plan) {
  const R = g.relay; if (R.state === "out") return;
  const FULL = g._full || (g._full = g.relayWay()), at = g.relayAt(), idxOf = (x, y) => FULL.findIndex((q) => q[0] === x && q[1] === y);
  const dirTo = (a, b) => b[0] > a[0] ? 0 : b[1] > a[1] ? 1 : b[0] < a[0] ? 2 : 3, ii = R.state === "held" ? idxOf(at[0], at[1]) : -1;
  const chain = g.units.filter((u) => !u.image && u.def.tile === "g");
  // behind the paper by two or more: pulled back (one a tick)
  if (R.state === "held" && ii >= 0) { const back = chain.filter((u) => { const k = idxOf(u.x, u.y); return k >= 0 && ii - k >= 2; }).sort((a, b) => idxOf(a.x, a.y) - idxOf(b.x, b.y))[0]; if (back) { g.retreat(back); return; } }
  const free = (x, y) => !g.unitAt(x, y) && !g.enemies.some((e) => !e.dead && !e.def.flying && Math.round(e.x) === x && Math.round(e.y) === y);
  const card = (tile) => g.cards.findIndex((c) => c.def.tile === tile && !c.deployed && c.cooldown <= 0 && !c.summonOf && plan.some((q) => q[0] === c.def.id) && !g.deployCheck(c));
  let target = null;
  if (R.state === "ground") { const cand = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [R.x + dx, R.y + dy]).filter(([x, y]) => (TD.tileAt(x, y) === "." || TD.tileAt(x, y) === "*") && free(x, y));
    cand.sort((a, b) => (idxOf(b[0], b[1]) >= 0) - (idxOf(a[0], a[1]) >= 0)); if (cand.length && !g.units.some((u) => Math.abs(u.x - R.x) + Math.abs(u.y - R.y) <= 1)) { const k = idxOf(cand[0][0], cand[0][1]); target = [cand[0], k >= 0 && FULL[k + 1] ? dirTo(FULL[k], FULL[k + 1]) : 0]; } }
  else if (R.state === "vault" || R.state === "held") { let j = ii + 1; while (j < FULL.length && g.unitAt(FULL[j][0], FULL[j][1])) j++;
    if (j < FULL.length && chain.length < 4 && free(FULL[j][0], FULL[j][1])) target = [FULL[j], FULL[j + 1] ? dirTo(FULL[j], FULL[j + 1]) : dirTo(FULL[j], R.exit)]; }
  if (target) { const c = card("g"); if (c >= 0 && g.canDeployAt(g.cards[c], target[0][0], target[0][1])) { g.deploy(c, target[0][0], target[0][1], target[1]); return; } }
  // the ranged one: on the high ground nearest the paper; moved when another is nearer by two squares or more
  const H = [[7, 1], [1, 3], [10, 3], [5, 4], [8, 5]], d = (q) => Math.abs(q[0] - at[0]) + Math.abs(q[1] - at[1]), best = H.filter((q) => !g.unitAt(q[0], q[1])).sort((a, b) => d(a) - d(b))[0], r = g.units.find((u) => u.def.tile === "h");
  if (r && best && d([r.x, r.y]) - d(best) >= 2) { g.retreat(r); return; }
  if (!r && best && g.units.length < g.deployLimit) { const c = card("h"); if (c >= 0) g.deploy(c, best[0], best[1], best[0] < at[0] ? 0 : best[0] > at[0] ? 2 : best[1] < at[1] ? 1 : 3); }
}
// LAB-04, the rule: a held mask is judged by its true kind (the reflection shows it) 1.5 s after it was first held: a guest is let through, an assassin killed
function lab04(g) { for (const e of g.enemies) if (e.mask && !e.judged && !e.passed && e.firstBlockT !== undefined && g.t - e.firstBlockT >= 1.5) g.judge(e, e.mask === "assassin" ? "kill" : "pass"); }
const BOT = { "LAB-05": lab05, "LAB-04": lab04, "LAB-02": lab02, "LAB-01": lab01, "WL-01": lampKeeper, "WL-02": lampKeeper, "WL-03": lampKeeper, "WL-05": lampKeeper, "WL-09": lampKeeper };
const HOLD = new Set(["IM-03"]);   // stages where the bot keeps a frozen operator in place under a firebottle: with no square behind the forward line, pulling back only opens the road
function run(code, e, l, plan, log) {
  const i = STA.findIndex((s) => s.code === code), st = STA[i];
  TD.setMap(st.map);
  for (const q of plan) { const c = TD.tileAt(q[1], q[2]), d = TD.UNITS.find((u) => u.id === q[0]); const ok = c === "*" || (d.tile === "g" ? c === "." || c === "~" : c === "h"); if (!ok) console.log(`  BAD ${code} ${q[0]} at ${q[1]},${q[2]} tile '${c}'`); }
  const ids = [...new Set(plan.map((q) => q[0]))];
  const g = new TD.Game(i, ids.map((id) => { const d = TD.UNITS.find((u) => u.id === id), ml = MAXLV[d.rarity], el = id === "smoqueen" ? 1 : Math.min(e, ml.length - 1), lv = id === "smoqueen" ? 40 : Math.min(l, ml[el]);
    return { id, elite: el, mult: TD.growth(d, el, lv, ml[el]), pot: 1, skillIdx: Math.min(el, (d.skills || []).length - 1) }; }));
  for (let k = 0; k < 420 * 30 && !g.over; k++) {
    for (const q of plan) { const ci = g.cards.findIndex((c) => c.def.id === q[0]); const c = g.cards[ci]; if (!c || c.deployed || c.cooldown > 0) continue; if (g.unitAt(q[1], q[2])) continue; if (!entryOk(g, q)) continue; if (!g.canDeployAt(c, q[1], q[2])) continue; if (g.deployCheck(c)) break; g.deploy(ci, q[1], q[2], q[3]); break; }
    if (!(BOTSKILL.has(code) && !process.env.NOBOT)) for (const u of g.units) if (u.sp >= u.skill.sp && u.skillT <= 0 && u.skill.mode === "manual") g.useSkill(u);
    // the fires: anyone standing where a warning shows steps off it
    for (const f of g.fires || []) if (f.st === 1) for (const u of g.units.slice()) if (f.tiles.some(([a, b]) => a === u.x && b === u.y)) g.retreat(u);
    // a frozen operator with a firebottle flame over its head is pulled back
    if (!process.env.NORET && !HOLD.has(code)) for (const e of g.enemies) if (e.def.melt && e.aiming && e.aimTgt && e.aimTgt.frozenT > 0 && g.units.includes(e.aimTgt)) g.retreat(e.aimTgt);
    const before = g.enemies.slice();
    if (BOT[code] && !process.env.NOBOT) BOT[code](g, plan);
    g.update(1 / 30);
    if (log) for (const q of before) if (q.leaked && !q._l) { q._l = 1; console.log(`   t${g.t.toFixed(0)} leak ${q.type} via ${JSON.stringify(q.path[Math.floor(q.path.length*0.6)])} ${JSON.stringify(q.path[q.path.length-3])}`); }
  }
  const goal = g.goal ? ` | ${g.goalWhy || "-"}${Object.keys(g.meters).map((id) => ` ${id} ${g.meters[id].v}`).join("")}${g.vip ? ` vip ${Math.round(g.vip.hp)}@${g.vip.x.toFixed(1)},${g.vip.y.toFixed(1)}` : ""}` : "";   // a goal stage: why it ended, its gauges, the walking ally
  return `${(g.over || "-").padEnd(4)} life ${String(g.life).padStart(2)} t${Math.round(g.t)} kills ${g.killed}/${g.total}${goal}`;
}
// the game rolls dice (who a shot picks, a dodge): each run is played under several fixed seeds, and a cell shows the median with the worst and the best beside it
const seed = (n) => { let a = n * 7919; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const NS = +(process.env.N || 5);
const many = (code, e, l, plan) => { const v = []; for (let i = 1; i <= NS; i++) { seed(i); const r = run(code, e, l, plan); v.push(/^win/.test(r) ? +r.match(/life\s+(\d+)/)[1] : /^lose/.test(r) ? 0 : -1); }
  const stall = v.filter((x) => x < 0).length, w = v.map((x) => Math.max(x, 0)).sort((x, y) => x - y); return `${w[w.length >> 1]}(${w[0]}-${w[w.length - 1]})${stall ? "~" + stall : ""}`; };
const lower = ([e, l]) => l > 20 ? [e, l - 20] : e > 0 ? [e - 1, 40] : [0, 25];
const only = process.argv[2] ? process.argv[2].split(",") : Object.keys(P);
if (process.env.PLAN) P[only[0]] = JSON.parse(process.env.PLAN);   // PLAN='[[id,x,y,dir],...]': another placement for the one stage named
if (process.env.ALLV) {   // ALLV=1: the four squads at the recommended level; with K="0.9,1,1.1" each at those multiples of the stage's hp/atk. A cell: median(worst-best), ~n = n runs never ended
  const ks = (process.env.K || "1").split(",").map(Number);
  for (const code of only) { const st = STA.find((s) => s.code === code), m0 = Object.assign({}, st.mul), rec = REC[code];
    console.log(code.padEnd(6), Object.keys(VARIANTS).map((v) => v + " " + ks.map((k) => { st.mul = { hp: m0.hp * k, atk: m0.atk * k, def: m0.def }; return many(code, rec[0], rec[1], vary(P[code], v)); }).join(" / ")).join(" | ")); st.mul = m0; }
} else if (process.env.SCAN) {   // SCAN="1,0.9,0.8": the recommended level's result at each multiple of the stage's hp/atk
  for (const code of only) { const st = STA.find((s) => s.code === code), m0 = Object.assign({}, st.mul), rec = REC[code];
    for (const k of process.env.SCAN.split(",").map(Number)) { st.mul = { hp: m0.hp * k, atk: m0.atk * k, def: m0.def }; console.log(code, "k", k, run(code, rec[0], rec[1], vary(P[code], process.env.VARIANT || "base"))); }
    st.mul = m0; }
} else if (process.env.TUNE) {
  for (const code of only) {
    const st = STA.find((s) => s.code === code), m0 = Object.assign({}, st.mul), rec = REC[code]; let best = null;
    for (const k of [2.5, 2, 1.7, 1.5, 1.35, 1.2, 1.1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.42, 0.35, 0.3, 0.25, 0.2, 0.16, 0.13, 0.1]) {
      st.mul = { hp: m0.hp * k, atk: m0.atk * k, def: m0.def };
      const r = run(code, rec[0], rec[1], P[code]); if (/^win/.test(r) && +r.match(/life\s+(\d+)/)[1] >= 8) { best = k; console.log(code, "k", k, "rec:", r, "| low:", run(code, ...lower(rec), P[code])); break; }
    }
    if (best === null) console.log(code, "no k wins");
    st.mul = m0;
  }
} else for (const code of only) {
  const rec = REC[code];
  if (STA.find((s) => s.code === code).echo) {   // LAB-06: the bot's three attempts in one process (the record is kept between them on the global)
    const key = STA.find((s) => s.code === code).echo.key; TD.echoClear(key);
    const a1 = run(code, rec[0], rec[1], P[code]), r1 = TD.echoGet(key);
    const a2 = run(code, rec[0], rec[1], LAB06_B); TD.echoSet(key, r1);
    const a3 = run(code, rec[0], rec[1], P[code]); TD.echoSet(key, r1);
    console.log(code, `attempt 1 plan A (seed ghosts): ${a1} | attempt 2 plan B (yesterday's ghosts): ${a2} | attempt 2 with plan A again (every ghost cancelled): ${a3}`); continue; }
  console.log(code, `rec E${rec[0]}L${rec[1]}: ${run(code, rec[0], rec[1], P[code], process.env.DBG === code)}`, `| low: ${run(code, ...lower(rec), P[code])}`);
}
