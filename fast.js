// Fast evaluation core: the same frame loop as sim.run (bit-identical results), restructured so that a batch of sibling plans can share one
// simulated trajectory until their decisions first differ ("snapshot branching").
//  - the per-frame policy is a generator that yields each action before it is applied; all plans of a batch decide on the SAME game state,
//    the first plan's action is applied, and a plan stays attached while its decisions are identical (so its game state is identical too);
//  - at frame starts (every CK frames, when the state holds no closures) the game is deep-cloned with the RNG state: a checkpoint;
//  - a plan that diverges at frame k is resumed from the latest checkpoint (<= k) and simulated alone from there.
"use strict";
const S = require("./sim.js");
const { TD } = S;
const FPS = 30, MAXT = 420, LIFE_PAD = 1000, CK = +(process.env.FAST_CK || 30);
const NOOP = () => {};
const NULLFX = { push() { return 0; }, pop() { return undefined; }, filter() { return NULLFX; }, [Symbol.iterator]() { return [][Symbol.iterator](); }, length: 0 };

// ---- RNG with exposed state (same generator and seeding as im_sim / sim.js seed()) ----
const RNG = { a: 0 };
const rngFn = () => { let a = RNG.a | 0; a = a + 0x6D2B79F5 | 0; RNG.a = a; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function seed(n) { RNG.a = n * 7919; Math.random = rngFn; }

// ---- deep clone of a game state; static data (defs, stages, ranges, paths...) is shared. Returns null if the state holds a closure ----
const STATIC = new WeakSet();
(function walk() {
  const seen = new Set(); const stack = [TD.UNITS, TD.ENEMIES, TD.STAGES, TD.SUMMONS, TD.RANGE, TD.CFG, TD.WAVES, TD.STATUS, TD.HOLY, TD.ERODE, TD.SKILL_LV, TD.MAP0, TD.MAP_TUT, TD.TUTORIAL, TD.SANDBOX, TD.PATHS, TD.AIR_PATHS, TD.SPAWNS, TD.BASE, TD.BASES, NULLFX];
  while (stack.length) { const o = stack.pop(); if (!o || (typeof o !== "object" && typeof o !== "function") || seen.has(o)) continue; seen.add(o); STATIC.add(o);
    if (typeof o === "function") continue; if (o instanceof Map) { for (const [k, v] of o) { stack.push(k); stack.push(v); } continue; } if (o instanceof Set) { for (const v of o) stack.push(v); continue; }
    for (const k of Object.keys(o)) stack.push(o[k]); }
  STATIC.add(NOOP);
})();
class Dirty extends Error {}
function cloneState(root) {
  const extra = new Set(); for (const a of [TD.PATHS, TD.AIR_PATHS, TD.SPAWNS, TD.BASES]) for (const p of a) extra.add(p);   // refilled by setMap: the current inner arrays are static too
  const memo = new Map();
  const cl = (o) => {
    if (o === null || typeof o !== "object") { if (typeof o === "function" && !STATIC.has(o)) throw new Dirty(); return o; }
    if (STATIC.has(o) || extra.has(o)) return o;
    const m = memo.get(o); if (m !== undefined) return m;
    let c;
    if (Array.isArray(o)) { c = new Array(o.length); memo.set(o, c); for (let i = 0; i < o.length; i++) c[i] = cl(o[i]); const ks = Object.keys(o); if (ks.length !== o.length) for (const k of ks) if (!(k >>> 0 === +k && +k < o.length)) c[k] = cl(o[k]); return c; }
    if (o instanceof Map) { c = new Map(); memo.set(o, c); for (const [k, v] of o) c.set(cl(k), cl(v)); return c; }
    if (o instanceof Set) { c = new Set(); memo.set(o, c); for (const v of o) c.add(cl(v)); return c; }
    if (ArrayBuffer.isView(o)) { c = o.slice(); memo.set(o, c); return c; }
    c = Object.create(Object.getPrototypeOf(o)); memo.set(o, c);
    for (const k of Object.keys(o)) c[k] = cl(o[k]);
    return c;
  };
  try { return cl(root); } catch (e) { if (e instanceof Dirty) return null; throw e; }
}

// ---- the plan policy (im_sim semantics, as sim.run) ----
const AFTER = S.AFTER;
class Ctl {
  constructor(plan, g) {
    this.entries = plan.entries; this.sk = plan.skill || {}; this.pol = Object.assign({ fire: 1, melt: 1, lamp: 1 }, plan.pol || {});
    this.rets = (plan.retreats || []).map((r) => Object.assign({ done: false }, r)).sort((a, b) => a.t - b.t);
    this.cardIdx = new Map(); g.cards.forEach((c, k) => { if (!this.cardIdx.has(c.def.id)) this.cardIdx.set(c.def.id, k); });
    this.spent = 0; this.deploys = 0; this.used = new Set();
  }
  snap() { return { d: this.rets.map((r) => r.done), spent: this.spent, deploys: this.deploys, used: [...this.used] }; }
  restore(s) { this.rets.forEach((r, i) => { r.done = s.d[i]; }); this.spent = s.spent; this.deploys = s.deploys; this.used = new Set(s.used); }
  // yields [kind, ...] before each action; receives the action's result
  *frame(g) {
    for (const r of this.rets) { if (r.done || g.t < r.t) continue; r.done = true; const u = g.units.find((q) => q.def.id === r.id && !q.clone && !q.summoned); if (u) yield ["R", u]; }
    for (const q of this.entries) {
      let ci = this.cardIdx.get(q.id);
      if (ci === undefined) { if (!S.isSummon(q.id)) continue; ci = g.cards.findIndex((c) => c.summonOf !== undefined && c.def.id === q.id && c.active); if (ci < 0) continue;
        const c = g.cards[ci]; if (c.charges <= 0 || c.placeT > 0) continue; }
      const c = g.cards[ci];
      if (c.summonOf === undefined && (c.deployed || c.cooldown > 0)) continue;
      if (q.from !== undefined && g.t < q.from) continue;
      if (q.until !== undefined && g.t >= q.until) continue;
      if (g.unitAt(q.x, q.y)) continue;
      if (q.after && AFTER[q.after] && !AFTER[q.after](g, q)) continue;
      if (!g.canDeployAt(c, q.x, q.y)) continue;
      if (g.deployCheck(c)) break;
      const cost = g.costOf(c); const u = yield ["D", ci, q.x, q.y, q.d];
      if (u) { this.spent += cost; this.deploys++; this.used.add(q.id); }
      break;
    }
    for (const u of g.units) {
      if (!(u.sp >= u.skill.sp && u.skillT <= 0 && u.skill.mode === "manual")) continue;
      const s = this.sk[u.def.id], m = s ? s.m : 0;
      if (m === 3) continue;
      if (m === 1 && g.t < s.t) continue;
      if (m === 2) { let any = false; const tiles = g.rangeTiles(u); for (const e of g.enemies) if (!e.dead && !e.ally && (e.blockedBy === u || g.inRange(u, e, tiles))) { any = true; break; } if (!any) continue; }
      yield ["S", u];
    }
    if (this.pol.fire) for (const f of g.fires || []) if (f.st === 1) for (const u of g.units.slice()) if (f.tiles.some(([a, b]) => a === u.x && b === u.y)) yield ["F", u];
    if (this.pol.melt) for (const e of g.enemies) if (e.def.melt && e.aiming && e.aimTgt && e.aimTgt.frozenT > 0 && g.units.includes(e.aimTgt)) yield ["M", e.aimTgt];
    if (this.pol.lamp && g.stage.lamps && g.lampOff.size) {
      const last = g._keeperT || (g._keeperT = new Map());
      for (const k of g.lampOff) { const x = k % 100, y = (k / 100) | 0; if (TD.tileAt(x, y) !== "F" || g.freshKeeper(x, y) || !(g.lampBroken && g.lampBroken.has(k))) continue;
        if (last.has(k) && g.t - last.get(k) < 20) continue;
        const off = g.lampOffT.has(k) ? g.lampOffT.get(k) : -1;
        const u = g.units.find((q) => Math.abs(q.x - x) + Math.abs(q.y - y) === 1 && q.born <= off && !q.clone && !q.summoned && !g.enemies.some((e) => e.def.boss && !e.dead && e.blockedBy === q));
        if (!u) continue;
        yield ["L", u, k]; }
    }
  }
}
function apply(g, a) {
  switch (a[0]) {
    case "R": g._why = "plan"; g.retreat(a[1]); return undefined;
    case "D": return g.deploy(a[1], a[2], a[3], a[4]);
    case "S": g.useSkill(a[1]); return undefined;
    case "F": g._why = "fire"; g.retreat(a[1]); return undefined;
    case "M": g._why = "melt"; g.retreat(a[1]); return undefined;
    case "L": g._keeperT.set(a[2], g.t); g._why = "lamp"; g.retreat(a[1]); return undefined;
  }
}
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
function frameAlone(g, ctl) { const it = ctl.frame(g); let r = it.next(); while (!r.done) r = it.next(apply(g, r.value)); }

function setup(code, lvl, plan, opt) {
  const [E, L] = typeof lvl === "string" ? S.parseLv(lvl) : lvl;
  const i = S.stageIdx(code), st = TD.STAGES[i];
  seed(opt.seed !== undefined ? opt.seed : 1);
  TD.setMap(st.map);
  const ids = opt.squadIds || S.squadIdsOf(plan);
  const g = new TD.Game(i, S.buildSquad(ids, E, L, plan.skillIdx, opt.sameRung));
  g.fx = NULLFX; g.snd = NOOP;
  g.life += LIFE_PAD;
  return { g, st, life0: g.life };
}
function result(g, life0, ctl, k, aborted) {
  const lost = life0 - g.life, escortLost = !!(g.escort && g.escort.hp <= 0), complete = g.over === "win", win = complete && lost < 10 && !escortLost;
  return { win, rwin: complete && lost < TD.CFG.life && !escortLost, life: win ? 10 - lost : 0, lost, complete, aborted, stall: !g.over && !aborted, escortLost, t: Math.round(g.t), tEnd: g.t, frames: k, over: g.over, kills: g.killed, total: g.total, units: ctl.used.size, deploys: ctl.deploys, spent: ctl.spent };
}
// continue one plan alone from frame k0 (its frame-k0 actions not yet taken)
function runFrom(g, ctl, k0, life0, opt) {
  const fps = opt.fps || FPS, N = MAXT * fps, prune = opt.pruneLost; let k = k0, aborted = false;
  for (; k < N && !g.over; k++) { frameAlone(g, ctl); g.update(1 / fps); if (prune !== undefined && life0 - g.life > prune) { aborted = true; break; } }
  return result(g, life0, ctl, k, aborted);
}
function runOne(code, lvl, plan, opt = {}) { const { g, life0 } = setup(code, lvl, plan, opt); return runFrom(g, new Ctl(plan, g), 0, life0, opt); }

// all plans must give the same squad (same units, order, skills); plans[0] is the trunk
const stats = { batches: 0, plans: 0, framesSim: 0, framesFull: 0, ckTaken: 0, ckDirty: 0 };
function runBatch(code, lvl, plans, opt = {}) {
  if (plans.length === 1) { const r = runOne(code, lvl, plans[0], opt); stats.plans++; stats.framesSim += r.frames; stats.framesFull += r.frames; return [r]; }
  const { g, st, life0 } = setup(code, lvl, plans[0], opt);
  const fps = opt.fps || FPS, N = MAXT * fps, prune = opt.pruneLost;
  const ctls = plans.map((p) => new Ctl(p, g));
  let att = plans.map((_, i) => i).slice(1); const det = []; let ck = null; let k = 0, aborted = false;
  for (; k < N && !g.over; k++) {
    if (att.length && (!ck || k - ck.k >= CK)) { const c = cloneState(g); if (c) { ck = { g: c, rng: RNG.a, k, ctl: new Map(att.map((i) => [i, ctls[i].snap()])) }; stats.ckTaken++; } else stats.ckDirty++; }
    if (!att.length) frameAlone(g, ctls[0]);
    else {
      const gens = new Map(att.map((i) => [i, ctls[i].frame(g)])); const its0 = ctls[0].frame(g);
      let r0 = its0.next(); const rc = new Map(); for (const [i, it] of gens) rc.set(i, it.next());
      for (;;) {
        for (const [i, r] of rc) { if (r.done !== r0.done || (!r.done && !same(r.value, r0.value))) { det.push({ i, ck }); gens.delete(i); rc.delete(i); } }
        if (r0.done) break;
        const res = apply(g, r0.value);
        r0 = its0.next(res); for (const [i, it] of gens) rc.set(i, it.next(res));
      }
      att = [...gens.keys()];
    }
    g.update(1 / fps);
    if (prune !== undefined && life0 - g.life > prune) { aborted = true; break; }
  }
  const out = new Array(plans.length);
  out[0] = result(g, life0, ctls[0], k, aborted);
  for (const i of att) out[i] = result(g, life0, ctls[i], k, aborted);
  stats.batches++; stats.plans += plans.length; stats.framesSim += out[0].frames;
  for (const i of [0, ...att]) stats.framesFull += out[i].frames;
  // the diverged plans: from their checkpoint, alone
  for (const { i, ck: c } of det) {
    if (!c) { const r = runOne(code, lvl, plans[i], opt); out[i] = r; stats.framesSim += r.frames; stats.framesFull += r.frames; continue; }   // no clean checkpoint yet: from the start
    const gc = cloneState(c.g); RNG.a = c.rng; Math.random = rngFn; if (gc.rows || TD.MAP !== st.map) TD.setMap(gc.rows || st.map);
    ctls[i].restore(c.ctl.get(i));
    const r = runFrom(gc, ctls[i], c.k, life0, opt); out[i] = r; stats.framesSim += r.frames - c.k; stats.framesFull += r.frames;
  }
  return out;
}
module.exports = { runOne, runBatch, cloneState, seed, RNG, stats, Ctl };
