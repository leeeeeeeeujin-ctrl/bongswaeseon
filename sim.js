// solver v2 copy of solver/sim.js (adds rwin = a real win with the game's own life pool). Shared simulation core for the solver: loads the engine snapshot, builds squads at a level, and plays a plan headlessly
// with the same frame loop as test/im_sim.js (deploy order with cost breaks, manual skills, bot reflexes), extended with
// timed deploys (from/until), per-unit skill timing, and timed retreats.
"use strict";
const fs = require("fs");
const path = require("path");

const GAME_DIR = process.env.SOLVER_GAME_DIR || path.join(__dirname, "game");
global.window = global;
require(path.join(GAME_DIR, "econ.js"));
require(path.join(GAME_DIR, "game.js"));
const TD = global.TD;

const MAXLV = { 3: [40, 55], 4: [45, 60, 70], 5: [50, 70, 80], 6: [50, 80, 90] };   // same table as im_sim / meta
const FPS = 30, MAXT = 420;
const LIFE_PAD = 1000;
const NOOP = () => {};
const NULLFX = { push() { return 0; }, pop() { return undefined; }, filter() { return NULLFX; }, [Symbol.iterator]() { return [][Symbol.iterator](); }, length: 0 };   // the run is played with a padded life pool so a losing plan still plays out every wave (smooth fitness); real life = 10 - lost

// im_sim's P plans and REC levels, read (not executed) from the snapshot's test/im_sim.js
function readImSim() {
  const src = fs.readFileSync(path.join(GAME_DIR, "test", "im_sim.js"), "utf8");
  const grab = (name) => { const i = src.indexOf(`const ${name} = {`); if (i < 0) return {}; let d = 0, j = src.indexOf("{", i);
    for (let k = j; k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}") { d--; if (!d) return Function(`return (${src.slice(j, k + 1)})`)(); } } return {}; };
  return { P: grab("P"), REC: grab("REC"), VARIANTS: grab("VARIANTS"), HOLD: /HOLD = new Set\(\[([^\]]*)\]/.exec(src) ? JSON.parse(`[${/HOLD = new Set\(\[([^\]]*)\]/.exec(src)[1]}]`) : [] };
}

// the new-save default party (meta.js freshSave + the fixed start link pullStart): yui + START_FIXED
function starterParty() {
  try { const src = fs.readFileSync(path.join(GAME_DIR, "meta.js"), "utf8"); const m = /START_FIXED = (\[[^\]]*\])/.exec(src);
    const fixed = JSON.parse(m[1].replace(/'/g, '"')); const first = /ops\.(\w+) = \{ lvl: 1/.exec(src); return [first ? first[1] : "yui", ...fixed]; }
  catch (e) { return ["yui", "hiro", "lilith", "tao", "capy", "ayaki", "hakuren", "sunae", "alpha", "atat", "teka"]; }
}

const LADDER = ["E0L1", "E0L20", "E0L40", "E1L1", "E1L15", "E1L30", "E1L45", "E1L60", "E2L1", "E2L20", "E2L40"];   // E2 rungs: 3★ stay at E1 max; skill level by rung (skillRank)
const parseLv = (s) => { const m = /^E(\d)L(\d+)$/.exec(s); return [+m[1], +m[2]]; };
const lvName = (e, l) => `E${e}L${l}`;
const def = (id) => TD.UNITS.find((u) => u.id === id);
const stageIdx = (code) => TD.STAGES.findIndex((s) => s.code === code);

// squad at a level, as im_sim builds it (elite capped by rarity, level capped by the phase's max, pot 1, skill level 1)
// skills: optional {id: skillIdx}; default is im_sim's min(elite, nSkills-1)
function buildSquad(ids, e, l, skills, sameRung) {   // sameRung: no im_sim special case for smoqueen (all-operators mode: every unit at the rung)
  return ids.map((id) => { const d = def(id), ml = MAXLV[d.rarity], sq = id === "smoqueen" && !sameRung, el = sq ? 1 : Math.min(e, ml.length - 1), lv = sq ? 40 : Math.min(l, ml[el]);
    const maxSk = Math.min(el, (d.skills || []).length - 1), sk = skills && skills[id] !== undefined ? Math.max(0, Math.min(maxSk, skills[id])) : maxSk;
    const k = skillRank(el, lv, d.rarity); return { id, elite: el, lv, mult: TD.growth(d, el, lv, ml[el]), pot: 1, skillIdx: sk, slv: k.slv, sm: [k.m, k.m, k.m] }; });
}
// skill level by rung (designer, 2026-11-12): roughly what a player has at that level. E0 caps at lv4, E1 at lv7; E2 L20/30/40 = M1/M2/M3; 3★ stop at lv7 with no mastery
const SLV_RULE = "slv-r1";
function skillRank(el, lv, rarity) {
  let slv, m = 0;
  if (el === 0) slv = lv >= 40 ? 4 : lv >= 20 ? 2 : 1;
  else if (el === 1) slv = lv >= 40 ? 7 : lv >= 30 ? 6 : lv >= 15 ? 5 : 4;
  else { slv = 7; m = lv >= 40 ? 3 : lv >= 30 ? 2 : lv >= 20 ? 1 : 0; }
  if (rarity <= 3) m = 0;
  return { slv, m };
}
const maxSkillIdx = (id, e) => { const d = def(id), ml = MAXLV[d.rarity], el = Math.min(e, ml.length - 1); return Math.min(el, (d.skills || []).length - 1); };

const seed = (n) => { let a = n * 7919; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

// seed-plan-only conditions carried over from im_sim's AFTER table (used only when a P plan is replayed / used as a seed)
const AFTER = {
  emperorMoved: (g) => g.t > 1 && !g.enemies.some((e) => e.type === "emperor" && e.postUntil > g.t),
  picketDead: (g, q) => g.t > 1 && !g.enemies.some((e) => !e.ally && !e.dead && e.postUntil > g.t && Math.round(e.x) === q.x && Math.round(e.y) === q.y),
};

// im_sim's lamp-keeper reflex (generic: acts only on a stage with lamps)
function lampKeeper(g, log) {
  if (!g.stage.lamps || !g.lampOff.size) return;
  const last = g._keeperT || (g._keeperT = new Map());
  for (const k of g.lampOff) { const x = k % 100, y = (k / 100) | 0; if (TD.tileAt(x, y) !== "F" || g.freshKeeper(x, y) || !(g.lampBroken && g.lampBroken.has(k))) continue;
    if (last.has(k) && g.t - last.get(k) < 20) continue;
    const off = g.lampOffT.has(k) ? g.lampOffT.get(k) : -1;
    const u = g.units.find((q) => Math.abs(q.x - x) + Math.abs(q.y - y) === 1 && q.born <= off && !q.clone && !q.summoned && !g.enemies.some((e) => e.def.boss && !e.dead && e.blockedBy === q));
    if (!u) continue;
    last.set(k, g.t); g._why = "lamp"; if (log) log.push({ t: g.t, a: "retreat", id: u.def.id, x: u.x, y: u.y, why: "lamp" }); g.retreat(u); }
}

/*
 A plan (genome):
 {
   entries: [{ id, x, y, d, from?, until?, after? }],   // ordered; each frame the first entry whose card is ready, tile free and legal is deployed (cost shortfall waits: im_sim semantics)
   skill:   { id: { m: 0|1|2|3, t } },                // manual skills: 0 asap (im_sim), 1 first ready moment at/after t, 2 when ready and a foe is in range, 3 never
   skillIdx:{ id: k },                                // which skill (only where the level allows a choice)
   retreats:[{ id, t }],                              // pull that unit back at time t (if it is on the field); entries then redeploy it as usual
   pol:     { fire: 1, melt: 1, lamp: 1 }             // im_sim's reflexes, each switchable
 }
*/
const isSummon = (id) => !!TD.SUMMONS[id];
function squadIdsOf(plan, pool) {
  const s = new Set(plan.entries.map((q) => q.id).filter((id) => !isSummon(id))); return pool ? pool.filter((id) => s.has(id)) : [...s];
}
// the summon ids a squad can field (atat's scribbles): they get entries of their own, deployed from the summon card while the summoner is out
const summonIds = (ids) => [...new Set(ids.map((id) => def(id)).filter((d) => d && d.summon).map((d) => d.summon.id))];

function run(code, lvl, plan, opt = {}) {
  const [E, L] = typeof lvl === "string" ? parseLv(lvl) : lvl;
  const i = stageIdx(code), st = TD.STAGES[i];
  if (opt.seed !== undefined) seed(opt.seed);
  TD.setMap(st.map);
  const ids = opt.squadIds || squadIdsOf(plan);
  const squad = buildSquad(ids, E, L, plan.skillIdx, opt.sameRung);
  const g = new TD.Game(i, squad);
  if (!opt.keepFx) { g.fx = NULLFX; g.snd = NOOP; }   // the visual-effects list and sound queue are never read by the game logic: skipped headless
  g.life += LIFE_PAD;
  const life0 = g.life;
  const pol = Object.assign({ fire: 1, melt: 1, lamp: 1 }, plan.pol || {});
  const log = opt.record ? [] : null;
  const rets = (plan.retreats || []).map((r) => Object.assign({ done: false }, r)).sort((a, b) => a.t - b.t);
  const sk = plan.skill || {};
  const entries = plan.entries;
  const cardIdx = new Map(); g.cards.forEach((c, k) => { if (!cardIdx.has(c.def.id)) cardIdx.set(c.def.id, k); });
  let spent = 0, deploys = 0; const used = new Set();
  const prune = opt.pruneLost;   // abort once more life than this is lost (cannot beat the incumbent)
  let aborted = false;
  const fps = opt.fps || FPS, N = MAXT * fps;   // opt.fps: a finer step to compare with the browser (which sub-steps at 1/60)
  // exact action trace (record mode): the game's own deploy / useSkill / retreat are wrapped on this instance, and only calls made by this
  // loop outside g.update (depth 0) are logged, with the frame and game time, after the game accepted them; engine-internal calls (a fall, a torn drawing) are not
  let k = 0, depth = 0; const actions = opt.record ? [] : null;
  if (actions) {
    const dep = g.deploy.bind(g), sk0 = g.useSkill.bind(g), ret = g.retreat.bind(g), upd = g.update.bind(g);
    g.update = (dt) => { depth++; try { return upd(dt); } finally { depth--; } };   // whatever the engine does inside a tick (auto skills, falls) is not an action
    g.deploy = (ci, x, y, dir) => { if (depth) return dep(ci, x, y, dir); depth++; const c0 = g.cost, card = g.cards[ci]; let u; try { u = dep(ci, x, y, dir); } finally { depth--; }
      if (u) actions.push({ t: g.t, k, a: "deploy", ci, id: card.def.id, x, y, dir, uid: u.id, cost: c0 - g.cost, summon: card.summonOf !== undefined || undefined }); return u; };
    g.useSkill = (u) => { if (depth) return sk0(u); depth++; let r; try { r = sk0(u); } finally { depth--; } if (r !== false) actions.push({ t: g.t, k, a: "skill", ci: u.card, id: u.def.id, uid: u.id }); return r; };
    g.retreat = (u, refund) => { if (depth || !g.units.includes(u)) return ret(u, refund); depth++; const e = { t: g.t, k, a: "retreat", ci: u.card, id: u.def.id, uid: u.id, x: u.x, y: u.y, why: g._why }; try { ret(u, refund); } finally { depth--; } actions.push(e); };
  }
  for (k = 0; k < N && !g.over; k++) {
    // timed retreats
    for (const r of rets) { if (r.done || g.t < r.t) continue; r.done = true; const u = g.units.find((q) => q.def.id === r.id && !q.clone && !q.summoned); if (u) { g._why = "plan"; if (log) log.push({ t: g.t, a: "retreat", id: r.id, x: u.x, y: u.y, why: "plan" }); g.retreat(u); } }
    // deploys (im_sim order semantics)
    for (const q of entries) {
      let ci = cardIdx.get(q.id);
      if (ci === undefined) { if (!isSummon(q.id)) continue; ci = g.cards.findIndex((c) => c.summonOf !== undefined && c.def.id === q.id && c.active); if (ci < 0) continue;
        const c = g.cards[ci]; if (c.charges <= 0 || c.placeT > 0) continue; }
      const c = g.cards[ci];
      if (c.summonOf === undefined && (c.deployed || c.cooldown > 0)) continue;
      if (q.from !== undefined && g.t < q.from) continue;
      if (q.until !== undefined && g.t >= q.until) continue;
      if (g.unitAt(q.x, q.y)) continue;
      if (q.after && AFTER[q.after] && !AFTER[q.after](g, q)) continue;
      if (!g.canDeployAt(c, q.x, q.y)) continue;
      if (g.deployCheck(c)) break;
      const cost = g.costOf(c); const u = g.deploy(ci, q.x, q.y, q.d);
      if (u) { spent += cost; deploys++; used.add(q.id); if (log) log.push({ t: g.t, a: "deploy", id: q.id, x: q.x, y: q.y, d: q.d, cost, n: deploys }); }
      break;
    }
    // manual skills
    for (const u of g.units) {
      if (!(u.sp >= u.skill.sp && u.skillT <= 0 && u.skill.mode === "manual")) continue;
      const s = sk[u.def.id], m = s ? s.m : 0;
      if (m === 3) continue;
      if (m === 1 && g.t < s.t) continue;
      if (m === 2) { let any = false; const tiles = g.rangeTiles(u); for (const e of g.enemies) if (!e.dead && !e.ally && (e.blockedBy === u || g.inRange(u, e, tiles))) { any = true; break; } if (!any) continue; }
      if (g.useSkill(u) !== false && log) log.push({ t: g.t, a: "skill", id: u.def.id });
    }
    if (pol.fire) for (const f of g.fires || []) if (f.st === 1) for (const u of g.units.slice()) if (f.tiles.some(([a, b]) => a === u.x && b === u.y)) { g._why = "fire"; if (log) log.push({ t: g.t, a: "retreat", id: u.def.id, x: u.x, y: u.y, why: "fire" }); g.retreat(u); }
    if (pol.melt) for (const e of g.enemies) if (e.def.melt && e.aiming && e.aimTgt && e.aimTgt.frozenT > 0 && g.units.includes(e.aimTgt)) { g._why = "melt"; if (log) log.push({ t: g.t, a: "retreat", id: e.aimTgt.def.id, x: e.aimTgt.x, y: e.aimTgt.y, why: "melt" }); g.retreat(e.aimTgt); }
    if (pol.lamp) lampKeeper(g, log);
    g.update(1 / fps);
    if (prune !== undefined && life0 - g.life > prune) { aborted = true; break; }
  }
  const lost = life0 - g.life;
  const escortLost = !!(g.escort && g.escort.hp <= 0);
  const complete = g.over === "win";
  const win = complete && lost < 10 && !escortLost;
  const life = win ? 10 - lost : 0;
  return { win, rwin: complete && lost < TD.CFG.life && !escortLost, life, lost, complete, aborted, stall: !g.over && !aborted, escortLost, t: Math.round(g.t), tEnd: g.t, frames: k, over: g.over, kills: g.killed, total: g.total, units: used.size, deploys, spent, log, actions };
}

// fitness: winners first by life, then fewer units, then less cost; losers by total life lost (the padded pool lets them play every wave), then kills
function score(r) {
  if (r.win) return 1e6 + r.life * 1e4 - r.units * 100 - r.spent;
  if (r.aborted) return -1e6 + r.t * 10 + r.kills;   // pruned (past the criterion or the incumbent): longer survival and more kills rank higher
  const pen = r.escortLost ? 50 : 0;
  return -(r.lost + pen) * 1000 + r.kills * 10 - r.units * 1 - (r.stall ? 5000 : 0);
}

// static facts about a stage for the search: the legal tiles per unit (engine canDeployAt on a fresh game), and how much
// foe traffic each tile carries (one empty run), so placements and facings can be sampled where they matter
function stageInfo(code, ids, lvl) {
  const [E, L] = parseLv(lvl);
  const i = stageIdx(code), st = TD.STAGES[i];
  TD.setMap(st.map);
  seed(1);
  const g = new TD.Game(i, buildSquad(ids, E, L));
  g.life += LIFE_PAD;
  const W = st.map[0].length, H = st.map.length;
  const legal = {};
  const fake = summonIds(ids).map((sid) => ({ def: TD.SUMMONS[sid], summonOf: -1, elite: 0 }));
  for (const c of g.cards.concat(fake)) { if (c.summonOf !== undefined && c.summonOf !== -1) continue; const a = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g.canDeployAt(c, x, y)) a.push([x, y]); legal[c.def.id] = a; }
  // foe traffic: enemy-seconds per tile with nobody deployed (ground and air separately)
  const traffic = new Float64Array(W * H), air = new Float64Array(W * H);
  for (let k = 0; k < MAXT * FPS && !g.over; k++) {
    // sample the board every 0.2 s (6 frames)
    if (k % 6 === 0) for (const e of g.enemies) { if (e.dead || e.ally) continue; const x = Math.round(e.x), y = Math.round(e.y); if (x < 0 || y < 0 || x >= W || y >= H) continue; (e.def.flying ? air : traffic)[y * W + x] += 0.2; }
    g.update(1 / FPS);
  }
  // range-coverage score per unit/tile/facing (ground traffic always; air counts for ranged units)
  const cover = {};
  for (const c of g.cards.concat(fake)) { if (c.summonOf !== undefined && c.summonOf !== -1) continue; const id = c.def.id, d = c.def; const RK = TD.rangeKeyOf(d, c.elite), R = TD.RANGE[RK] || [[0, 0]];
    cover[id] = legal[id].map(([x, y]) => { const s = [0, 1, 2, 3].map((dir) => { let v = 0; for (const o of R) { const [dx, dy] = TD.rotate(o, dir); const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; v += traffic[Y * W + X] + (d.tile === "h" ? air[Y * W + X] : 0); }
        if (d.block > 0) v += 3 * traffic[y * W + x]; return v; }); return s; }); }
  return { W, H, legal, cover, traffic: Array.from(traffic), air: Array.from(air), map: st.map.slice(), name: st.name, code, emptyLost: LIFE_PAD + 10 - g.life - 10 };
}

module.exports = { SLV_RULE, skillRank, isSummon, summonIds, TD, GAME_DIR, MAXLV, LADDER, parseLv, lvName, def, stageIdx, buildSquad, maxSkillIdx, seed, run, score, stageInfo, readImSim, starterParty, squadIdsOf, AFTER };
