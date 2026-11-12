// solver v2: roles, operator numbers at a rung, the stage context (legal squares, path coverage, enemy profile), role-slot templates, and dominance pruning.
// A role is what a square of a plan asks of whoever stands there: the tile type, a kind (block / gnb = ground non-blocker / phys / arts / heal / supp), a minimum block,
// the class it was found with, and the damage type. A slot is a plan entry with its operator replaced by that role.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const S = require("./sim.js");
const { TD } = S;

const ROOT = __dirname;
const RESULTS = process.env.SOLVER_RESULTS || path.join(ROOT, "results");
const CACHE = path.join(RESULTS, process.env.AKOPS ? "cache_akops" : "cache");   // with AK operators loaded the stage contexts hold more units: their own cache
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");
const GAMEHASH = md5(fs.readFileSync(path.join(S.GAME_DIR, "game.js")) + "" + fs.readFileSync(path.join(S.GAME_DIR, "econ.js")) + (S.SLV_RULE || "slv1")).slice(0, 12);   // same formula as v1 run_queue
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return d; } };
const writeJSON = (f, o, pretty) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const tmp = f + ".tmp" + process.pid; fs.writeFileSync(tmp, JSON.stringify(o, null, pretty === false ? 0 : 1)); fs.renameSync(tmp, f); };
const CLS = { "중장": "defender", "근위": "guard", "선봉": "vanguard", "술사": "caster", "저격": "sniper", "의무": "medic", "보조": "supporter", "특수": "specialist", "소환물": "summon" };
const defAny = (id) => S.def(id) || TD.SUMMONS[id];
const DUMMY = new Set(["vanguard", "guard", "defender", "sniper", "caster", "medic", "supporter", "specialist"]);   /* the eight stand-ins from the first builds: in no deck (designer 2026-11-13) */
const ALL = TD.UNITS.map((u) => u.id).filter((id) => !DUMMY.has(id));

function kindOf(d) {
  if (!d) return "none";
  if (d.tile === "g" || d.tile === "*") return d.block > 0 ? "block" : "gnb";
  if (d.dmg === "heal") return "heal";
  if (/^support/.test(d.range || "") ) return "supp";
  return d.dmg === "arts" ? "arts" : "phys";
}
const roleOf = (id) => { const d = defAny(id); return { tile: d.tile, kind: kindOf(d), block: d.block || 0, cls: CLS[d.cls] || d.cls, dmg: d.dmg, sub: d.sub || "" }; };

// ---- operator numbers at a rung (all units at the rung, as deck mode) ----
const OPC = new Map();
function opStats(id, lvl, skillIdx) {
  const key = id + "|" + lvl + "|" + (skillIdx === undefined ? "-" : skillIdx); if (OPC.has(key)) return OPC.get(key);
  const d = defAny(id); if (!d) return null;
  const [E, L] = S.parseLv(lvl);
  if (S.isSummon(id)) { const o = { id, kind: kindOf(d), tile: d.tile, hp: d.hp || 0, atk: d.atk || 0, def: d.def || 0, res: d.res || 0, interval: d.interval || 1, block: d.block || 0, cost: d.cost || 0, redeploy: d.redeploy || 0, dmg: d.dmg, sk: null, el: 0, rarity: 0, rangeN: 1 }; OPC.set(key, o); return o; }
  const c = S.buildSquad([id], E, L, skillIdx === undefined ? undefined : { [id]: skillIdx }, true)[0];
  const sk0 = (d.skills || [d.skill])[c.skillIdx] || d.skill;
  const sk = TD.skillAt ? TD.skillAt(sk0, c.slv, (TD.maxMastery && TD.maxMastery(d)) ? (c.sm || [])[c.skillIdx] || 0 : 0) : sk0;
  const RK = TD.rangeKeyOf(d, c.elite), R = TD.RANGE[RK] || [[0, 0]];
  const o = { id, kind: kindOf(d), tile: d.tile, cls: CLS[d.cls] || d.cls, sub: d.sub || "", rarity: d.rarity, el: c.elite, lv: c.lv, slv: c.slv, sm: c.sm, skillIdx: c.skillIdx,
    hp: d.hp * (c.mult.hp || 1), atk: d.atk * (c.mult.atk || 1), def: d.def * (c.mult.def || 1), res: d.res || 0, interval: d.interval || 1, block: d.block || 0, cost: d.cost, redeploy: d.redeploy || 70,
    dmg: d.dmg, range: d.range, rangeN: R.length, slow: d.slow || 0, sk, nSkills: (d.skills || [d.skill]).length };
  // skill numbers: uptime of a lasting skill, the attack multiple while it is up, a one-off burst, and the rest as they are
  const s = sk || {}; const sp = Math.max(1, s.sp || 1), dur = s.dur || 0;
  o.skSp = s.sp || 0; o.skInit = s.init || 0; o.skDur = dur; o.skManual = s.mode === "manual" ? 1 : 0;
  o.skUp = dur > 0 ? dur / (dur + sp) : 0;
  o.skAtk = (s.atk || 1) * (s.speed || 1) * (s.hits || 1);
  o.skBurst = s.mul ? s.mul / sp : 0;   // multiples of attack per second of SP
  o.skDef = s.def || 1; o.skCure = s.cure || 0; o.skDp = s.dp ? s.dp / sp : 0;
  OPC.set(key, o); return o;
}
// damage per second against one foe (def, res); heal per second for medics
function dpsVs(o, def, res) {
  if (!o || o.atk <= 0) return 0;
  const boost = 1 + o.skUp * (o.skAtk - 1) + o.skBurst * o.interval;
  if (o.dmg === "arts") return o.atk * Math.max(0.05, 1 - (res || 0) / 100) / o.interval * boost;
  if (o.dmg === "heal") return 0;
  return Math.max(o.atk - (def || 0), 0.05 * o.atk) / o.interval * boost;
}
const hps = (o) => o && o.dmg === "heal" ? o.atk / o.interval * (1 + o.skUp * (o.skAtk - 1)) + (o.skCure ? o.skCure * 1000 / Math.max(1, o.skSp) : 0) : 0;

// ---- the stage context: legal squares and path coverage for every unit (at elite E), the enemy profile, boss timing, road depth ----
const CTX = new Map();
function stageCtx(code, lvl) {
  const [E] = S.parseLv(lvl); const key = code + "|E" + E; if (CTX.has(key)) return CTX.get(key);
  const f = path.join(CACHE, `ctx_${GAMEHASH}_${code}_E${E}.json`);
  let c = readJSON(f, null);
  if (!c) {
    const ids = ALL.slice();
    const info = S.stageInfo(code, ids, S.lvName(E, E === 0 ? 1 : 1));
    // the enemy profile and the first boss time: one empty run, every spawned foe once (hp-weighted def/res)
    const i = S.stageIdx(code), st = TD.STAGES[i]; TD.setMap(st.map); S.seed(1);
    const g = new TD.Game(i, S.buildSquad(["vanguard"], 0, 1)); g.life += 1000; const seen = new Set(); const prof = []; let bossT = null;
    const paths = (TD.PATHS || []).map((p) => (p || []).map(([x, y]) => x * 100 + y));
    for (let k = 0; k < 420 * 30 && !g.over; k++) { for (const e of g.enemies) { if (seen.has(e.id) || e.ally) continue; seen.add(e.id); prof.push([Math.round(e.maxHp), Math.round((e.defv || 0) * (e.defMul0 || 1)), e.res || 0, e.def.flying ? 1 : 0, e.def.boss ? 1 : 0, Math.round(g.t)]); if (e.def.boss && bossT === null) bossT = Math.round(g.t); } g.update(1 / 30); }
    // road depth: BFS steps from the base over walkable tiles, as a share of the longest
    const W = info.W, H = info.H, dist = new Array(W * H).fill(-1), q = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (st.map[y][x] === "B") { dist[y * W + x] = 0; q.push([x, y]); }
    while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H || dist[Y * W + X] >= 0) continue; const ch = st.map[Y][X]; if ("#hW".includes(ch)) continue; dist[Y * W + X] = dist[y * W + x] + 1; q.push([X, Y]); } }
    const maxD = Math.max(1, ...dist);
    const cover = {}; for (const id of Object.keys(info.legal)) { cover[id] = {}; info.legal[id].forEach(([x, y], ti) => { cover[id][x * 100 + y] = info.cover[id][ti].map((v) => Math.round(v * 10) / 10); }); }
    c = { code, E, W, H, map: info.map, legal: Object.fromEntries(Object.entries(info.legal).map(([id, a]) => [id, a.map(([x, y]) => x * 100 + y)])), cover, traffic: info.traffic.map((v) => Math.round(v * 10) / 10), air: info.air.map((v) => Math.round(v * 10) / 10),
      prof, bossT, depth: dist.map((v) => v < 0 ? -1 : Math.round(v / maxD * 100) / 100), paths, totalTraffic: info.traffic.reduce((a, b) => a + b, 0) + info.air.reduce((a, b) => a + b, 0), tEnd: Math.min(400, Math.max(...st.waves.map((w) => +w[0] || 0)) + 30) };
    writeJSON(f, c, false);
  }
  c.legalSet = {}; for (const [id, a] of Object.entries(c.legal)) c.legalSet[id] = new Set(a);
  const hpSum = c.prof.reduce((a, p) => a + p[0], 0) || 1; c.hpSum = hpSum;
  CTX.set(key, c); return c;
}
// effective DPS against this stage's foes: total hp over the hp-weighted time to kill (harmonic)
function effDps(o, ctx) {
  if (!o || o.atk <= 0 || o.dmg === "heal") return 0;
  let t = 0; for (const p of ctx.prof) { if (p[3] && o.tile === "g" && !/lord|long/.test(o.range || "")) continue; const d = dpsVs(o, p[1], p[2]); t += p[0] / Math.max(1e-3, d); }
  return t > 0 ? ctx.hpSum / t : 0;
}
const legalAt = (ctx, id, x, y) => !!(ctx.legalSet[id] && ctx.legalSet[id].has(x * 100 + y));

// ---- slots: a plan with its operators replaced by roles ----
// slotsOf(plan) -> { slots: [{ x, y, d, from, until, after, prim (index of the operator's first slot), role, src, skill, skIdx }], retreats: [{ slot, t }], pol }
function templateOf(plan) {
  const first = new Map(); const slots = [];
  plan.entries.forEach((q, i) => { const isPrim = !first.has(q.id); if (isPrim) first.set(q.id, i);
    const s = { x: q.x, y: q.y, d: q.d, prim: first.get(q.id), role: roleOf(q.id), src: q.id };
    if (q.from !== undefined) s.from = q.from; if (q.until !== undefined) s.until = q.until; if (q.after) s.after = q.after;
    if (isPrim) { if (plan.skill && plan.skill[q.id]) s.skill = plan.skill[q.id]; if (plan.skillIdx && plan.skillIdx[q.id] !== undefined) s.skIdx = plan.skillIdx[q.id]; }
    if (S.isSummon(q.id)) { const summoner = plan.entries.find((r) => { const d = S.def(r.id); return d && d.summon && d.summon.id === q.id; }); s.summonOf = summoner ? first.get(summoner.id) : -1; }
    slots.push(s); });
  return { slots, retreats: (plan.retreats || []).filter((r) => first.has(r.id)).map((r) => ({ slot: first.get(r.id), t: r.t })), pol: Object.assign({ fire: 1, melt: 1, lamp: 1 }, plan.pol || {}) };
}
const primaries = (T) => T.slots.map((s, i) => [s, i]).filter(([s, i]) => s.prim === i && s.summonOf === undefined);
// a filled plan from a template and an assignment {primSlotIndex: opId}; slots without an operator (and their secondaries / summons) are dropped
function fillPlan(T, assign, lvl) {
  const [E] = S.parseLv(lvl);
  const plan = { entries: [], skill: {}, skillIdx: {}, retreats: [], pol: Object.assign({}, T.pol) };
  T.slots.forEach((s, i) => {
    let id;
    if (s.summonOf !== undefined) { const sm = assign[s.summonOf]; const d = sm && S.def(sm); if (!d || !d.summon) return; id = d.summon.id; }
    else id = assign[s.prim]; if (!id) return;
    const q = { id, x: s.x, y: s.y, d: s.d }; if (s.from !== undefined) q.from = s.from; if (s.until !== undefined) q.until = s.until; if (s.after) q.after = s.after; plan.entries.push(q);
    if (s.prim === i && s.summonOf === undefined) { if (s.skill) plan.skill[id] = Object.assign({}, s.skill); const m = S.maxSkillIdx(id, E); if (m >= 1) plan.skillIdx[id] = Math.min(m, s.skIdx === undefined ? m : s.skIdx); }
  });
  for (const r of T.retreats) { const id = assign[r.slot]; if (id) plan.retreats.push({ id, t: r.t }); }
  return plan;
}
// who may stand in a slot: tier 0 = same class and kind and at least the block; 1 = same kind; 2 = another ranged damage dealer on high ground / any blocker on the ground
function tierOf(role, id) {
  const r = roleOf(id); if (r.tile !== role.tile && !(role.tile === "*" || r.tile === "*")) return 9;
  if (r.kind === role.kind && r.cls === role.cls && r.block >= role.block) return 0;
  if (r.kind === role.kind && (r.kind !== "block" || r.block >= Math.min(2, role.block))) return 1;
  if (role.kind === "heal" || r.kind === "heal") return 9;
  if (role.tile === "h" && ["phys", "arts", "supp"].includes(r.kind) && ["phys", "arts", "supp"].includes(role.kind)) return 2;
  if (role.tile === "g" && ["block", "gnb"].includes(r.kind) && ["block", "gnb"].includes(role.kind)) return 2;
  return 9;
}
// the role-fit power of an operator (a fill-order heuristic; the surrogate ranks whole assignments)
function power(id, lvl, ctx, role) {
  const o = opStats(id, lvl); if (!o) return 0; const e = effDps(o, ctx);
  switch (role.kind) {
    case "block": return o.hp * (1 + o.def / 800) * (1 + 0.5 * o.skUp * (o.skDef - 1)) / 3000 * (0.6 + 0.4 * o.block) + e / 400;
    case "heal": return hps(o) / 150;
    case "supp": return e / 300 + o.slow * 2 + 0.5;
    case "gnb": return o.hp / 3000 + 1 / Math.max(1, o.cost);
    default: return e / 300;
  }
}
// candidates for each primary slot of a template from a squad: legal at the square, tier < 9, ranked tier first then power
function candidates(T, squad, lvl, ctx, maxTier = 2) {
  const out = {};
  for (const [s, i] of primaries(T)) {
    out[i] = squad.filter((id) => legalAt(ctx, id, s.x, s.y)).map((id) => ({ id, tier: tierOf(s.role, id), p: power(id, lvl, ctx, s.role) })).filter((c) => c.tier <= maxTier)
      .sort((a, b) => a.tier - b.tier || b.p - a.p);
  }
  return out;
}
// greedy fill: scarcest slot first; an operator is used once (and two units of the same name never together); the k-th variant takes the second choice at slot k
function fillGreedy(T, squad, lvl, ctx, opt = {}) {
  const cand = candidates(T, squad, lvl, ctx, opt.maxTier); const prim = primaries(T).map(([, i]) => i);
  const order = prim.slice().sort((a, b) => (cand[a].filter((c) => c.tier <= 1).length - cand[b].filter((c) => c.tier <= 1).length) || a - b);
  const one = (skipAt, force) => { const used = new Set(), names = new Set(), assign = {};
    if (force) for (const [i, id] of Object.entries(force)) { assign[i] = id; used.add(id); names.add(defAny(id).name); }
    for (const i of order) { if (assign[i]) continue; const c = cand[i].filter((c) => !used.has(c.id) && !names.has(defAny(c.id).name)); const pickI = skipAt === i && c.length > 1 ? 1 : 0; const p = c[pickI]; if (!p) continue; assign[i] = p.id; used.add(p.id); names.add(defAny(p.id).name); }
    return assign; };
  const out = [one(-1, opt.force)]; const seen = new Set([JSON.stringify(out[0])]);
  for (const i of order) { if (out.length >= (opt.variants || 1)) break; const a = one(i, opt.force); const k = JSON.stringify(a); if (!seen.has(k)) { seen.add(k); out.push(a); } }
  return { assigns: out, cand, order };
}

// ---- dominance pruning: inside a branch (same class and sub-branch), drop an operator whose cost, numbers and skills are all no better than another's at that rung ----
const HIGHER = new Set(["init", "dur", "atk", "def", "mul", "speed", "cure", "dp", "hp", "res", "heal", "hits", "n", "stun", "slow", "block", "range", "r", "pct"]);
const LOWER = new Set(["sp", "cd"]);
function skillLE(a, b) {   // a no better than b, both at the rung
  if (!a || !b) return !a;
  if (a.mode !== b.mode) return false;
  const nums = (s) => Object.keys(s).filter((k) => typeof s[k] === "number" && !["lv", "m"].includes(k));
  const ka = nums(a), kb = nums(b); if (ka.length !== kb.length || ka.some((k) => !kb.includes(k))) return false;
  for (const k of ka) { if (HIGHER.has(k)) { if (a[k] > b[k]) return false; } else if (LOWER.has(k)) { if (a[k] < b[k]) return false; } else if (a[k] !== b[k]) return false; }
  return true;
}
function dominated(aId, bId, lvl) {
  const A = S.def(aId), B = S.def(bId); if (!A || !B || aId === bId) return false;
  if (A.cls !== B.cls || (A.sub || "") !== (B.sub || "") || A.tile !== B.tile || A.range !== B.range || A.dmg !== B.dmg) return false;
  if (JSON.stringify(A.talent || null) !== JSON.stringify(B.talent || null)) return false;
  const a = opStats(aId, lvl), b = opStats(bId, lvl);
  if (!(b.cost <= a.cost && b.redeploy <= a.redeploy && b.hp >= a.hp && b.atk >= a.atk && b.def >= a.def && b.res >= a.res && b.interval <= a.interval && b.block >= a.block)) return false;
  const [E] = S.parseLv(lvl); const na = S.maxSkillIdx(aId, E), nb = S.maxSkillIdx(bId, E);
  for (let i = 0; i <= na; i++) { const sa = opStats(aId, lvl, i).sk; let ok = false; for (let j = 0; j <= nb && !ok; j++) if (skillLE(sa, opStats(bId, lvl, j).sk)) ok = true; if (!ok) return false; }
  // strictly worse somewhere (identical twins are both kept)
  return b.cost < a.cost || b.hp > a.hp || b.atk > a.atk || b.def > a.def || b.interval < a.interval || b.block > a.block || b.redeploy < a.redeploy || b.res > a.res;
}
function prune(squad, lvl) { const drop = []; const keep = squad.filter((a) => { const by = squad.find((b) => dominated(a, b, lvl)); if (by) drop.push([a, by]); return !by; }); return { keep, drop }; }

module.exports = { RESULTS, CACHE, GAMEHASH, readJSON, writeJSON, CLS, ALL, defAny, kindOf, roleOf, opStats, dpsVs, hps, effDps, stageCtx, legalAt, templateOf, primaries, fillPlan, tierOf, power, candidates, fillGreedy, dominated, prune, S, TD };
