// solver v2: the evolutionary plan search of solver/solve.js (Pool, Space, solve), unchanged in its moves and scoring, with three additions:
//  - o.rngSeed: the search's own dice can be seeded (reproducible searches); default: time-seeded as in v1
//  - the result carries `harvest`: the best distinct seed-1 plans the search saw (for the strategy-family store), with their results
//  - o.onEval(plan, r, squadIds): called for every fresh seed-1 evaluation (the surrogate's training log; the persistent memo still gets every result)
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { fork } = require("child_process");
const ROOT = __dirname;
const GAME = process.env.SOLVER_GAME_DIR || path.join(ROOT, "game");
process.env.SOLVER_GAME_DIR = GAME;
const S = require("./sim.js");
const C = require("./cons.js");
const { TD } = S;
const defAny = (id) => S.def(id) || TD.SUMMONS[id];
const maxSk = (id, E) => S.isSummon(id) ? 0 : S.maxSkillIdx(id, E);

// ---------- worker pool ----------
class Pool {
  constructor(n) {
    this.n = n; this.ws = []; this.queue = []; this.busy = new Map(); this.cbs = new Map(); this.seq = 0; this.ready = [];
    this.started = Promise.all(Array.from({ length: n }, () => new Promise((res) => { const w = fork(path.join(ROOT, "worker.js"), [], { execArgv: ["--max-optimized-bytecode-size=1000000"], env: Object.assign({}, process.env, { SOLVER_GAME_DIR: GAME }) });
      w.on("message", (m) => { if (m.type === "ready") { this.ws.push(w); this.ready.push(w); res(); this.pump(); } else if (m.type === "done") { const cb = this.cbs.get(m.id); this.cbs.delete(m.id); this.busy.delete(w); this.ready.push(w); cb(m.out[0]); this.pump(); } });
      w.on("exit", (c) => { if (c) console.error("worker exited", c); }); })));
  }
  pump() { while (this.ready.length && this.queue.length) { const w = this.ready.shift(); const { job, cb } = this.queue.shift(); const id = ++this.seq; this.cbs.set(id, cb); this.busy.set(w, id); w.send({ type: "run", id, jobs: [job] }); } }
  run(job) { return new Promise((res) => { this.queue.push({ job, cb: res }); this.pump(); }); }
  all(jobs) { return Promise.all(jobs.map((j) => this.run(j))); }
  close() { for (const w of this.ws) w.send({ type: "exit" }); }
}

// ---------- helpers ----------
const rnd = Math.random.bind(Math);   // the engine reseeds Math.random only inside the workers; the search's own dice here
let RNG = null; const mkRng = (s) => { let a = s | 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
RNG = mkRng(Date.now() ^ 0x9e3779b9);
const reseed = (s) => { RNG = mkRng(s === undefined ? (Date.now() ^ 0x9e3779b9) : s); };
const R = () => RNG();
const ri = (n) => Math.floor(R() * n);
const pick = (a) => a[ri(a.length)];
const wpick = (items, w) => { let s = 0; for (const x of w) s += x; let r = R() * s; for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; } return items[items.length - 1]; };
const clone = (o) => JSON.parse(JSON.stringify(o));
const median = (a) => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
const keyOf = (p) => JSON.stringify([p.entries.map((q) => [q.id, q.x, q.y, q.d, q.from, q.until, q.after]), p.skill || {}, p.skillIdx || {}, (p.retreats || []).map((r) => [r.id, r.t]), p.pol || {}]);
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

// ---------- plan operators ----------
class Space {
  constructor(code, lvl, ids, info, opts = {}) {
    this.allOps = !!opts.allOps; this.squadMax = opts.squadMax || 12; this.topK = opts.topK || 0;
    this.code = code; this.lvl = lvl; this.squad = ids; this.ids = ids.concat(S.summonIds(ids)); this.info = info;
    this.maxN = {}; for (const id of this.ids) this.maxN[id] = S.isSummon(id) ? (ids.map(defAny).find((d) => d.summon && d.summon.id === id).summon.max) : 1;
    const [E] = S.parseLv(lvl); this.E = E;
    this.limit = TD.STAGES[S.stageIdx(code)].deployLimit || TD.CFG.deployLimit;
    const st = TD.STAGES[S.stageIdx(code)];
    this.tEnd = Math.min(400, Math.max(...st.waves.map((w) => +w[0] || 0)) + 30);
    this.tile = {}; for (const id of this.ids) this.tile[id] = defAny(id).tile;
    // tile weights per unit: coverage (best facing) plus a floor so every legal tile stays reachable
    this.w = {};
    for (const id of this.ids) { const cv = info.cover[id] || []; const best = cv.map((s) => Math.max(...s)); const mean = best.reduce((a, b) => a + b, 0) / Math.max(1, best.length);
      this.w[id] = best.map((b) => b + 0.15 * mean + 0.01); }
  }
  legal(id) { return this.info.legal[id] || []; }
  tileIdx(id, x, y) { return this.legal(id).findIndex(([a, b]) => a === x && b === y); }
  bestDir(id, ti) { const s = this.info.cover[id][ti]; let b = 0; for (let k = 1; k < 4; k++) if (s[k] > s[b]) b = k; return b; }
  sampleDir(id, ti) { if (R() < 0.6) return this.bestDir(id, ti); const s = this.info.cover[id][ti]; return wpick([0, 1, 2, 3], s.map((v) => v + 0.2 * (Math.max(...s) + 0.01))); }
  occupied(plan, except) { const o = new Set(); for (const q of plan.entries) if (q !== except && q.from === undefined && q.until === undefined) o.add(q.x * 100 + q.y); return o; }
  sampleTile(id, plan, except) {
    const L = this.legal(id); if (!L.length) return null; const occ = this.occupied(plan, except);
    let idx = L.map((_, i) => i).filter((i) => !occ.has(L[i][0] * 100 + L[i][1])); if (!idx.length) return null;
    if (this.topK && idx.length > this.topK) idx = idx.sort((a, b) => this.w[id][b] - this.w[id][a]).slice(0, this.topK);   // only the best-covering squares (path coverage pre-score)
    const ti = wpick(idx, idx.map((i) => this.w[id][i])); return { ti, x: L[ti][0], y: L[ti][1], d: this.sampleDir(id, ti) };
  }
  randomPlan() {
    const n = Math.min(this.ids.length, this.limit, 4 + ri(Math.min(this.ids.length, this.limit) - 3));
    const names = new Set(); const ids = this.ids.filter((id) => !S.isSummon(id)).sort(() => R() - 0.5).filter((id) => { const nm = defAny(id).name; if (names.has(nm)) return false; names.add(nm); return true; }).slice(0, n);
    const plan = { entries: [], skill: {}, skillIdx: {}, retreats: [], pol: { fire: 1, melt: 1, lamp: 1 } };
    for (const id of ids) { const t = this.sampleTile(id, plan); if (t) plan.entries.push({ id, x: t.x, y: t.y, d: t.d }); }
    // cheap and blocking first, a little: a loose prior on order the search reshuffles anyway
    plan.entries.sort((a, b) => (defAny(a.id).cost - defAny(b.id).cost) * 0.3 + (R() - 0.5) * 10);
    this.pickSkills(plan, "random");
    return plan;
  }
  // each card's skill is a search variable: any skill unlocked at this elite (S1 at E0; S1/S2 at E1; S3 at E2). mode: "random" | "s1" | "max" (im_sim's forced min(elite, n-1))
  pickSkills(plan, mode) {
    plan.skillIdx = plan.skillIdx || {};
    for (const id of new Set(plan.entries.map((q) => q.id))) { const m = maxSk(id, this.E); if (m < 1) { delete plan.skillIdx[id]; continue; }
      if (plan.skillIdx[id] !== undefined && (mode === "keep" || mode === "keepmax")) { plan.skillIdx[id] = Math.min(m, plan.skillIdx[id]); continue; }
      plan.skillIdx[id] = mode === "s1" ? 0 : (mode === "max" || mode === "keepmax") ? m : ri(m + 1); }
    return plan;
  }
  // map a plan that names units outside this squad: same class first, then same tile type; otherwise dropped
  adapt(plan) {
    const p = clone(plan); const have = new Set(this.ids); const used = new Set(p.entries.filter((q) => have.has(q.id)).map((q) => q.id)); const sub = {};
    for (const q of p.entries) { if (have.has(q.id)) continue; if (sub[q.id] === undefined) { const d = defAny(q.id); const free = this.squad.filter((id) => !used.has(id) && defAny(id).tile === d.tile);
        const c = free.find((id) => defAny(id).cls === d.cls) || free[0] || null; sub[q.id] = c; if (c) used.add(c); } q.id = sub[q.id]; }
    p.entries = p.entries.filter((q) => q.id && this.tileIdx(q.id, q.x, q.y) >= 0 || (q.id && q.after));
    p.skill = p.skill || {}; p.skillIdx = p.skillIdx || {}; p.retreats = (p.retreats || []).filter((r) => have.has(r.id)); p.pol = Object.assign({ fire: 1, melt: 1, lamp: 1 }, p.pol || {});
    return { plan: p, sub };
  }
  unused(plan, replacing) {
    const n = {}; for (const q of plan.entries) n[q.id] = (n[q.id] || 0) + 1;
    const real = new Set(plan.entries.map((q) => q.id).filter((id) => !S.isSummon(id) && id !== replacing));
    const names = new Set([...real].map((id) => defAny(id).name));
    const summonOk = (id) => plan.entries.some((q) => q.id !== replacing && defAny(q.id).summon && defAny(q.id).summon.id === id);
    return this.ids.filter((id) => (n[id] || 0) < this.maxN[id] && (S.isSummon(id) ? (!this.allOps || summonOk(id)) : (real.has(id) || (!names.has(defAny(id).name) && real.size < this.squadMax)))); }
  primary(plan) { const seen = new Set(); return plan.entries.filter((q) => { if (seen.has(q.id)) return false; seen.add(q.id); return true; }); }

  mutate(plan, phase) {
    const p = clone(plan); const k = 1 + (R() < 0.35 ? 1 : 0) + (R() < 0.12 ? 1 : 0);
    for (let i = 0; i < k; i++) this.mutateOnce(p, phase);
    return p;
  }
  mutateOnce(p, phase) {
    const ops = phase === 1
      ? [["tile", 5], ["nudge", 4], ["dir", 3], ["order", 4], ["add", 2], ["del", 1.5], ["swapUnit", 2], ["exch", 2], ["skillIdx", 2]]
      : [["tile", 1.5], ["nudge", 1.5], ["dir", 1], ["order", 2], ["add", 0.6], ["del", 0.6], ["swapUnit", 0.6], ["exch", 0.6], ["skillIdx", 1.5],
         ["from", 4], ["skill", 3], ["retreat", 1.5], ["retreatT", 2], ["relocate", 1.5], ["alt", 1], ["pol", 0.5], ["dropX", 1]];
    const op = wpick(ops.map((o) => o[0]), ops.map((o) => o[1]));
    const E = p.entries;
    const anyE = () => E.length ? pick(E) : null;
    switch (op) {
      case "tile": { const q = anyE(); if (!q) break; const t = this.sampleTile(q.id, p, q); if (t) Object.assign(q, { x: t.x, y: t.y, d: t.d }); break; }
      case "nudge": { const q = anyE(); if (!q) break; const L = this.legal(q.id); const occ = this.occupied(p, q); const near = L.map((xy, i) => [xy, i]).filter(([[x, y]]) => { const m = Math.abs(x - q.x) + Math.abs(y - q.y); return m >= 1 && m <= 2 && !occ.has(x * 100 + y); });
        if (near.length) { const [[x, y], i] = pick(near); q.x = x; q.y = y; q.d = R() < 0.5 ? q.d : this.sampleDir(q.id, i); } break; }
      case "dir": { const q = anyE(); if (!q) break; q.d = (q.d + 1 + ri(3)) % 4; break; }
      case "order": { if (E.length < 2) break; const i = ri(E.length); const [q] = E.splice(i, 1); const j = R() < 0.6 ? Math.max(0, Math.min(E.length, i + (R() < 0.5 ? -1 : 1))) : ri(E.length + 1); E.splice(j, 0, q); break; }
      case "add": { const u = this.unused(p); if (!u.length) break; const id = pick(u); const t = this.sampleTile(id, p); if (t) E.splice(ri(E.length + 1), 0, { id, x: t.x, y: t.y, d: t.d }); break; }
      case "del": { if (E.length <= 2) break; const q = pick(E); p.entries = E.filter((r) => r.id !== q.id); p.retreats = (p.retreats || []).filter((r) => r.id !== q.id); break; }
      case "swapUnit": { const q = anyE(); if (!q) break; let u = this.unused(p, q.id).filter((id) => id !== q.id && !p.entries.some((r) => r.id === id) && this.tileIdx(id, q.x, q.y) >= 0);
        if (this.allOps && R() < 0.7) { const same = u.filter((id) => defAny(id).cls === defAny(q.id).cls); if (same.length) u = same; }   // role slot kept, operator swapped
        if (!u.length) break; const id = pick(u); const old = q.id; for (const r of E) if (r.id === old) r.id = id; for (const r of p.retreats || []) if (r.id === old) r.id = id; if (p.skill[old]) { p.skill[id] = p.skill[old]; delete p.skill[old]; } break; }
      case "exch": { if (E.length < 2) break; const a = pick(E), b = pick(E); if (a === b || a.id === b.id) break; if (this.tileIdx(a.id, b.x, b.y) < 0 || this.tileIdx(b.id, a.x, a.y) < 0) break; [a.x, b.x] = [b.x, a.x]; [a.y, b.y] = [b.y, a.y]; [a.d, b.d] = [b.d, a.d]; break; }
      case "skillIdx": { const ch = E.filter((q) => maxSk(q.id, this.E) >= 1); if (!ch.length) break; const q = pick(ch); const m = maxSk(q.id, this.E); const cur = p.skillIdx[q.id] !== undefined ? p.skillIdx[q.id] : m; p.skillIdx[q.id] = (cur + 1 + ri(m)) % (m + 1); break; }
      case "from": { const q = anyE(); if (!q) break; const r = R(); if (r < 0.25) delete q.from; else if (r < 0.6 && q.from !== undefined) q.from = Math.max(0, Math.round(q.from + (R() - 0.5) * 30)); else q.from = Math.round(R() * R() * this.tEnd * 0.7); if (q.from === 0) delete q.from; if (q.until !== undefined && q.from !== undefined && q.from >= q.until) delete q.until; break; }
      case "skill": { const q = anyE(); if (!q) break; const r = R(); const cur = p.skill[q.id];
        if (r < 0.2) delete p.skill[q.id]; else if (r < 0.45 && cur && cur.m === 1) cur.t = Math.max(0, Math.round(cur.t + (R() - 0.5) * 30)); else { const m = wpick([1, 2, 3], [3, 3, 1]); p.skill[q.id] = m === 1 ? { m, t: Math.round(R() * this.tEnd) } : { m }; } break; }
      case "retreat": { p.retreats = p.retreats || []; if (p.retreats.length >= 2 || R() < 0.3) { if (p.retreats.length) p.retreats.splice(ri(p.retreats.length), 1); break; } const q = anyE(); if (!q) break; p.retreats.push({ id: q.id, t: Math.round(10 + R() * (this.tEnd - 10)) }); break; }
      case "retreatT": { const rr = p.retreats || []; if (!rr.length) break; const r = pick(rr); r.t = Math.max(1, Math.round(r.t + (R() - 0.5) * 40)); break; }
      case "relocate": {   // pull a unit back at T and set it down elsewhere when it is ready again
        p.retreats = p.retreats || []; if (p.retreats.length >= 2) break; const prim = this.primary(p); if (!prim.length) break; const q = pick(prim); if (E.filter((r) => r.id === q.id).length > 1) break;
        const T = Math.round(15 + R() * (this.tEnd - 40)); const t = this.sampleTile(q.id, p, q); if (!t) break;
        q.until = T; if (q.from !== undefined && q.from >= T) delete q.from; p.retreats.push({ id: q.id, t: T });
        E.splice(Math.min(E.length, E.indexOf(q) + 1 + ri(3)), 0, { id: q.id, x: t.x, y: t.y, d: t.d, from: T }); break; }
      case "alt": {   // a fall-back square: if the first is taken or the unit comes back later, this one is used
        const prim = this.primary(p); if (!prim.length) break; const q = pick(prim); if (E.filter((r) => r.id === q.id).length > 1) break; const t = this.sampleTile(q.id, p, q); if (!t) break;
        E.splice(E.indexOf(q) + 1 + ri(Math.max(1, E.length - E.indexOf(q))), 0, { id: q.id, x: t.x, y: t.y, d: t.d, from: Math.round(R() * this.tEnd * 0.8) }); break; }
      case "dropX": {   // drop a secondary entry / retreat
        const ids = new Set(); const sec = E.filter((q) => { if (ids.has(q.id)) return true; ids.add(q.id); return false; }); if (sec.length) { const q = pick(sec); p.entries = E.filter((r) => r !== q); const first = p.entries.find((r) => r.id === q.id); if (first) delete first.until; p.retreats = (p.retreats || []).filter((r) => r.id !== q.id || R() < 0.5); } else if ((p.retreats || []).length) p.retreats.splice(ri(p.retreats.length), 1); break; }
      case "pol": { const k = pick(["fire", "melt", "lamp"]); p.pol[k] = p.pol[k] ? 0 : 1; break; }
    }
  }
  crossover(a, b) {
    // a's order and unit set; each unit takes b's square/facing with p=0.5 when b fields it and the square is free
    const p = clone(a); const bm = new Map(); for (const q of this.primary(b)) bm.set(q.id, q);
    for (const q of this.primary(p)) { const o = bm.get(q.id); if (!o || R() < 0.5) continue; const occ = this.occupied(p, q); if (occ.has(o.x * 100 + o.y)) continue; q.x = o.x; q.y = o.y; q.d = o.d; if (o.from !== undefined) q.from = o.from; else delete q.from; }
    for (const id of Object.keys(b.skill || {})) if (R() < 0.5 && p.entries.some((q) => q.id === id)) p.skill[id] = clone(b.skill[id]);
    return p;
  }
  sanitize(p) {
    // drop entries on squares this unit can never use; keep at most 12 entries; tidy empty fields
    p.entries = p.entries.filter((q) => q.after || this.tileIdx(q.id, q.x, q.y) >= 0).slice(0, 12);
    if (this.allOps) { const real = new Set(), names = new Set(); p.entries = p.entries.filter((q) => { if (S.isSummon(q.id) || real.has(q.id)) return true; const nm = defAny(q.id).name; if (names.has(nm) || real.size >= this.squadMax) return false; names.add(nm); real.add(q.id); return true; }); }
    for (const q of p.entries) { if (q.from === 0) delete q.from; if (q.until !== undefined && q.from !== undefined && q.until <= q.from) delete q.until; }
    const ids = new Set(p.entries.map((q) => q.id));
    for (const id of Object.keys(p.skill || {})) if (!ids.has(id) || defAny(id).skills.every((s) => s.mode !== "manual")) delete p.skill[id];
    p.skillIdx = p.skillIdx || {}; for (const id of Object.keys(p.skillIdx)) if (!ids.has(id) || maxSk(id, this.E) < 1) delete p.skillIdx[id]; else p.skillIdx[id] = Math.min(p.skillIdx[id], maxSk(id, this.E));
    for (const id of ids) if (!S.isSummon(id) && maxSk(id, this.E) >= 1 && p.skillIdx[id] === undefined) p.skillIdx[id] = maxSk(id, this.E);
    p.retreats = (p.retreats || []).filter((r) => ids.has(r.id));
    return p;
  }
}

// ---------- the search ----------
async function solve(pool, code, lvl, ids, o = {}) {
  const t0 = Date.now();
  if (o.rngSeed !== undefined) reseed(o.rngSeed);
  const info = C.restrictInfo(S.stageInfo(code, ids, lvl), o.place);   /* placement constraints: only allowed squares are sampled */
  const sp = new Space(code, lvl, ids, info, { allOps: o.allOps, topK: o.allOps ? 8 : 0 });
  const maxEvals = +(o.evals || 3000), maxSec = +(o.time || 900);
  const p1Share = o.p1 !== undefined ? +o.p1 : 0.6;
  const MU = 16, LAMBDA = Math.max(8, pool.n * 8);
  const cache = new Map(); let evals = 0; let best = null; const hist = [];
  const ver = new Map();   // key -> 5-seed verification {lives, lost, wins, median, worst, units, spent, plan}
  const verbose = o.verbose !== false;
  // the squad sent to the game: the whole party (starter mode: its cards' passives count even undeployed), or in all-operators mode the plan's own units (<= 12)
  const squadFor = (plan) => o.allOps ? S.squadIdsOf(plan, o.pool || ids) : ids;   // deck mode: canonical (deck) order, so re-ordering entries keeps the same squad
  const SR = o.sameRung !== undefined ? !!o.sameRung : !!o.allOps;   // v2: every unit at the rung (no im_sim smoqueen special case) unless told otherwise
  // v2 constraints (squad queries): operators the plan must field, and per-class caps/minimums; a plan breaking one ranks below every plan that keeps them
  const CLSN = { defender: "중장", guard: "근위", vanguard: "선봉", caster: "술사", sniper: "저격", medic: "의무", supporter: "보조", specialist: "특수" };
  const constraintPen = (p) => { let pen = 0; const ids = new Set(p.entries.map((q) => q.id));
    for (const id of o.must || []) if (!ids.has(id)) pen += 1e7;
    if (o.quota) { const n = {}; for (const id of ids) { if (S.isSummon(id)) continue; const c = S.def(id).cls; n[c] = (n[c] || 0) + 1; }
      for (const [c, q] of Object.entries(o.quota)) { const k = n[CLSN[c] || c] || 0; if (q.max !== undefined && k > q.max) pen += 1e7; if (q.min !== undefined && k < q.min) pen += 1e7; } }
    return pen + C.pen(p, o.place); };
  const job = (plan, seed, prune, fps) => ({ code, lvl, plan, opt: { seed, squadIds: squadFor(plan), pruneLost: prune, sameRung: SR, fps, keepFx: o.keepFx || undefined } });
  const squadSig = (plan) => { const q = squadFor(plan); return q.join(",") + "|" + q.map((id) => (plan.skillIdx || {})[id] ?? "-").join(""); };
  const memo = o.memo || null;   // persistent plan->result memo {get(k), set(k, r)}, keyed by game hash + stage + level + squad + seed + fps + prune + plan
  const memoKey = (plan, key, prune, fps) => `${code}|${lvl}|${squadSig(plan)}|1|${fps || 30}|${prune === undefined ? "-" : prune}|${key}`;
  const BATCH = +(o.batch || 8);
  // robust score once a plan has been checked on all five seeds: all-five winners by worst then median life; partial winners below every unverified seed-1 winner
  const vscore = (v) => v.wins === 5 ? 2e6 + v.worst * 1e4 + v.median * 1e3 - v.units * 100 - v.spent : -2000 * (5 - v.wins) + v.lives.reduce((a, b) => a + b, 0) * 10 - 500 - median(v.lost) * 10;
  const scoreOf = (it) => (ver.has(it.key) ? vscore(ver.get(it.key)) : S.score(it.r)) - constraintPen(it.plan);
  const noteBest = (it) => { if (!best || it.s > best.s) { best = it; hist.push({ evals, sec: (Date.now() - t0) / 1000, s: it.s, life: ver.has(it.key) ? "v" + ver.get(it.key).worst : it.r.win ? it.r.life : -it.r.lost }); } };
  // prune threshold: a run that loses more than the incumbent's (verified worst / seed-1) life allows cannot beat it
  const pruneAt = () => { const a = pruneInc(), c = o.critLost; return a === undefined ? c : c === undefined ? a : Math.min(a, c); };   // abort past the criterion or past the incumbent
  const pruneInc = () => { if (!best) return undefined; const v = ver.get(best.key); if (v && v.wins === 5) return 10 - v.worst; return best.r.win && !v ? 10 - best.r.life : undefined; };
  const cache15 = new Map(); let evals15 = 0, memoHits = 0;
  // evaluate on seed 1: memo first, then sibling plans (same parent, same squad) go out as one batch that shares the simulated trajectory
  async function evalPlans(plans, fps) {
    const C = fps === 15 ? cache15 : cache;
    const todo = []; const out = [];
    for (const p of plans) { const par = p._par; sp.sanitize(p); const k = keyOf(p); if (C.has(k)) out.push({ plan: p, key: k, r: C.get(k) }); else { const it = { plan: p, key: k, r: null, par }; todo.push(it); out.push(it); C.set(k, null); } }
    const prune = pruneAt();
    const need = [];
    for (const it of todo) { const mk = memo && memoKey(it.plan, it.key, prune, fps); const m = mk && memo.get(mk); if (m) { it.r = m; C.set(it.key, m); memoHits++; } else { it.mk = mk; need.push(it); } }
    const groups = new Map(); for (const it of need) { const g = squadSig(it.plan) + "#" + (it.par || it.key); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(it); }
    const jobs = []; for (const arr of groups.values()) for (let i = 0; i < arr.length; i += BATCH) jobs.push(arr.slice(i, i + BATCH));
    await Promise.all(jobs.map(async (arr) => {
      const j = job(arr[0].plan, 1, prune, fps); let rs;
      if (arr.length === 1) rs = [await pool.run(j)]; else { j.plans = arr.map((it) => it.plan); delete j.plan; rs = await pool.run(j); }
      rs.forEach((r, i) => { const it = arr[i]; it.r = r; C.set(it.key, r); if (r.error) console.error(r.error); else { if (memo && it.mk) memo.set(it.mk, r); if (o.onEval && fps !== 15) o.onEval(it.plan, r, squadFor(it.plan)); } });
    }));
    if (fps === 15) evals15 += need.length; else evals += need.length;
    for (const it of out) { if (!it.r) it.r = C.get(it.key) || { win: false, life: 0, lost: 99, kills: 0, units: 99, spent: 999, aborted: true, t: 0 }; if (fps === 15) { it.s15 = S.score(it.r); continue; } it.s = scoreOf(it); noteBest(it); }
    return out;
  }
  async function verify(items) {   // seeds 2-5 for seed-1 winners not yet checked (seed 1 is the cached result)
    const todo = items.filter((it) => !ver.has(it.key) && it.r && it.r.win && !it.r.aborted);
    if (!todo.length) return 0;
    const rs = await pool.all(todo.flatMap((it) => [2, 3, 4, 5].map((sd) => job(it.plan, sd)))); evals += rs.length;
    todo.forEach((it, i) => { const all = [it.r].concat(rs.slice(i * 4, i * 4 + 4)); const lives = all.map((r) => r.win ? r.life : 0);
      ver.set(it.key, { lives, lost: all.map((r) => r.lost), wins: all.filter((r) => r.win).length, median: median(lives), worst: Math.min(...lives), units: it.r.units, spent: it.r.spent, plan: it.plan }); it.s = scoreOf(it); });
    best = null; for (const it of pop) noteBest(it); for (const it of arch.values()) noteBest(it);
    return todo.length;
  }
  const arch = new Map();   // verified plans, kept even when they fall out of the population
  const elapsed = () => (Date.now() - t0) / 1000;
  const budgetLeft = () => evals < maxEvals && elapsed() < maxSec;
  const NVG = +(o.verifyTop || 3);   // per generation: verify the top seed-1 winners of the population

  // initial population: warm-start plans (from other levels / earlier runs), the adapted seed plan, then random plans
  const init = [];
  for (const w of o.warm || []) { const a = sp.adapt(w).plan; init.push(sp.pickSkills(clone(a), "keepmax")); init.push(sp.pickSkills(clone(a), "s1")); }
  if (o.seedPlan) { const a = sp.adapt(o.seedPlan); init.push(sp.pickSkills(clone(a.plan), "max")); init.push(sp.pickSkills(clone(a.plan), "s1")); }
  while (init.length < Math.max(MU * 2, LAMBDA)) init.push(sp.randomPlan());
  let pop = [];
  pop = (await evalPlans(init)).sort((a, b) => b.s - a.s);
  const uniq = (arr) => { const s = new Set(); return arr.filter((x) => (s.has(x.key) ? false : (s.add(x.key), true))); };
  pop = uniq(pop).slice(0, MU);
  let gen = 0, lastImp = 0, lastBest = best.s, stopAt = 0;
  const tourn = () => { const a = pick(pop), b = pick(pop); return a.s >= b.s ? a : b; };
  const label = (x) => { const v = ver.get(x.key); return v ? (v.wins === 5 ? "V" + v.worst : "x" + v.wins) : x.r.win ? "W" + x.r.life : "L" + x.r.lost; };
  while (budgetLeft()) {
    gen++;
    const frac = Math.max(evals / maxEvals, elapsed() / maxSec);
    const phase = frac < p1Share && !o.timingOnly ? 1 : 2;
    let kids = [];
    const SIB = +(o.siblings || 4);   // kids come in sibling clusters from one parent: they share its prefix, so a batch simulates it once
    const KEEP = +(o.screenKeep || 0.3);
    while (kids.length < LAMBDA * (o.screen && phase === 1 ? 1 / KEEP : 1)) { if (R() < 0.2 && pop.length > 1) { kids.push(sp.mutate(sp.crossover(tourn().plan, tourn().plan), phase)); continue; }
      const par = tourn(); for (let j = 0; j < SIB; j++) { const c = sp.mutate(par.plan, phase); c._par = par.key; if (!o.allOps && R() < 0.85) c.skillIdx = clone(par.plan.skillIdx || {}); kids.push(c); } }
    if (phase === 1 && gen - lastImp > 12) { for (let i = 0; i < 6; i++) kids.push(sp.randomPlan()); lastImp = gen; }
    if (o.screen && phase === 1) {   // screening: all kids at dt 1/15, the best KEEP share at 1/30 (only those enter the population)
      const sc = await evalPlans(kids.map((k) => { const c = clone(k); c._par = k._par; return c; }), 15); const order = sc.map((x, i) => [x.s15, i]).sort((a, b) => b[0] - a[0]).slice(0, Math.ceil(kids.length * KEEP)).map((x) => x[1]);
      kids = order.map((i) => kids[i]);
    }
    const ev = await evalPlans(kids);
    pop = uniq(pop.concat(ev)).sort((a, b) => b.s - a.s).slice(0, MU);
    // robustness: check the leading seed-1 winners on seeds 2-5; their score becomes the robust one and the population re-sorts
    if (await verify(pop.filter((x) => x.r.win && !ver.has(x.key)).slice(0, NVG))) { for (const x of pop) if (ver.has(x.key)) arch.set(x.key, x); pop.sort((a, b) => b.s - a.s); }
    if (best.s > lastBest) { lastBest = best.s; lastImp = gen; }
    // early stop: once a plan wins on all five seeds with at least o.earlyLife life, polish for o.earlyStop seconds more, then stop
    const bv = ver.get(best.key);
    if (o.earlyStop !== undefined && !stopAt && bv && bv.wins === 5 && bv.worst >= (o.earlyLife || 1)) { stopAt = elapsed() + +o.earlyStop; if (verbose) console.log(`  [${code} ${lvl}] 5-seed win found at ${elapsed().toFixed(0)}s (worst life ${bv.worst}); polishing ${o.earlyStop}s`); }
    if (stopAt && elapsed() >= stopAt) break;
    if (verbose && gen % 5 === 0) console.log(`  [${code} ${lvl}] gen ${gen} ph${phase} evals ${evals} ${elapsed().toFixed(0)}s best ${label(best)} u${best.r.units} | pop ${pop.slice(0, 5).map(label).join(" ")}`);
  }
  // final verification: the best distinct finalists on 5 seeds (verified archive + the population's top seed-1 results)
  const NV = +(o.finalists || 6);
  const cand = uniq([...arch.values()].concat(pop)).sort((a, b) => b.s - a.s);
  const extra = []; for (const it of [...cache.entries()].filter(([, r]) => r && !r.aborted).map(([k, r]) => ({ key: k, r, s: S.score(r) })).sort((a, b) => b.s - a.s)) { if (extra.length >= NV) break; if (!cand.some((c) => c.key === it.key)) { it.plan = planFromKey(it.key); extra.push(it); } }
  let fin = uniq(cand.concat(extra)).slice(0, NV + 4);
  // unverified finalists (incl. seed-1 losers): run all five seeds
  const unv = fin.filter((f) => !ver.has(f.key));
  const vres = await pool.all(unv.flatMap((f) => [1, 2, 3, 4, 5].map((sd) => job(f.plan, sd)))); evals += vres.length;
  unv.forEach((f, i) => { const all = vres.slice(i * 5, i * 5 + 5); const lives = all.map((r) => r.win ? r.life : 0); ver.set(f.key, { lives, lost: all.map((r) => r.lost), wins: all.filter((r) => r.win).length, median: median(lives), worst: Math.min(...lives), units: all[0].units, spent: all[0].spent, plan: f.plan }); });
  fin = fin.map((f) => Object.assign({ plan: f.plan }, ver.get(f.key))).map((f) => Object.assign(f, { vs: (f.wins === 5 ? vscore(f) : -1e6 + f.wins * 1e4 - median(f.lost) * 100 + f.median) - constraintPen(f.plan) }));
  fin.sort((a, b) => b.vs - a.vs);
  const top = fin[0];
  const rec = await pool.run({ code, lvl, plan: top.plan, opt: { seed: 1, squadIds: squadFor(top.plan), record: true, sameRung: SR } });
  const result = { code, lvl, constraintsOk: constraintPen(top.plan) === 0, actions: rec.actions, recLost: rec.lost, recT: rec.tEnd, squad: squadFor(top.plan), win5: top.wins === 5, wins: top.wins, median: top.median, worst: top.worst, lives: top.lives, lostMedian: median(top.lost), units: top.units, spent: top.spent, plan: top.plan, log: rec.log, t: rec.t,
    harvest: harvestOf(cache, ver, o.harvestN || 40),
    evals, evals15, memoHits, secs: Math.round(elapsed()), budget: maxSec, early: !!stopAt, stopLife: o.earlyLife, gens: gen, hist, verified: ver.size, finalists: fin.slice(0, 6).map((f) => ({ wins: f.wins, median: f.median, worst: f.worst, lives: f.lives, units: f.units, plan: f.plan })) };
  if (verbose) console.log(`  [${code} ${lvl}] done: ${result.win5 ? "5-SEED WIN" : `wins ${top.wins}/5`} median ${top.median} worst ${top.worst} lives ${top.lives} units ${top.units} | ${evals} evals ${result.secs}s (${ver.size} plans checked on 5 seeds)`);
  return result;
}
// the best distinct seed-1 plans the search evaluated (verified ones carry their 5-seed record): the raw material for strategy families
function harvestOf(cache, ver, n) {
  const all = [];
  for (const [k, r] of cache.entries()) { if (!r || r.error) continue; const v = ver.get(k); all.push({ key: k, r, v, s: v ? (v.wins === 5 ? 2e6 + v.worst * 1e4 : -2000 * (5 - v.wins)) : S.score(r) }); }
  all.sort((a, b) => b.s - a.s);
  return all.slice(0, n).map((x) => ({ plan: x.v ? x.v.plan : planFromKey(x.key), lost: x.r.lost, win: x.r.win, aborted: !!x.r.aborted, kills: x.r.kills, total: x.r.total, t: x.r.t, five: x.v ? { lives: x.v.lives, wins: x.v.wins, worst: x.v.worst } : null }));
}
function planFromKey(k) { const [en, skill, skillIdx, rets, pol] = JSON.parse(k); return { entries: en.map(([id, x, y, d, from, until, after]) => { const q = { id, x, y, d }; if (from !== undefined && from !== null) q.from = from; if (until !== undefined && until !== null) q.until = until; if (after) q.after = after; return q; }), skill, skillIdx, retreats: rets.map(([id, t]) => ({ id, t })), pol }; }

// ---------- bot P plan, for comparison ----------
const IM = S.readImSim();
const pPlan = (code) => IM.P[code] ? { entries: IM.P[code].map((q) => Object.assign({ id: q[0], x: q[1], y: q[2], d: q[3] }, q[4] || {})), pol: { fire: 1, melt: IM.HOLD.includes(code) ? 0 : 1, lamp: 1 } } : null;
async function botResult(pool, code, lvl, ids) {   // ids: null = im_sim base squad (the plan's own units); else the plan adapted to that squad
  let plan = pPlan(code); if (!plan) return null; let sub = null; let squadIds;
  if (ids) { const info = S.stageInfo(code, ids, lvl); const sp = new Space(code, lvl, ids, info); const a = sp.adapt(plan); plan = a.plan; sub = a.sub; squadIds = ids; }
  const rs = await pool.all([1, 2, 3, 4, 5].map((sd) => ({ code, lvl, plan, opt: { seed: sd, squadIds } })));
  const lives = rs.map((r) => r.win ? r.life : 0);
  return { lvl, lives, median: median(lives), worst: Math.min(...lives), wins: rs.filter((r) => r.win).length, lost: rs.map((r) => r.lost), sub, units: rs[0].units };
}

module.exports = { solve, Space, Pool, pPlan, botResult, keyOf, planFromKey, clone, median, reseed, S, TD };
