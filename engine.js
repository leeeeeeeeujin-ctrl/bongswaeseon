// solver v2: the role-decomposed search engine.
//  squadSolve(pool, stage, rung, squad): every stored strategy family is filled from the squad (role slots), the fills are ranked by the surrogate and the best simulated;
//    coordinate descent (one slot at a time over its role candidates, 2 passes) on the leading families; then a short full local refinement (squares, order, timing,
//    skills: solver v1's evolutionary search) started from the best fill of EVERY family; 5-seed verification. The strategy is re-optimized for each squad.
//  ladder(pool, stage, squad, crit): the lowest rung meeting the criterion (lost1: worst seed loses <= 1 life; full: 0), probing up from a guess and then down
//    one rung at a time (so the rung below every minimum is always re-searched).
//  keyOps(...): an operator is key when, with it removed, a role-based re-search from the families cannot meet the criterion at the same rung.
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const G = require("./ga.js");
const R = require("./roles.js");
const C = require("./cons.js");
const F = require("./families.js");
const SG = require("./surrogate.js");
const { S, TD } = R;

const CRIT = { lost1: 1, full: 0 };   // the most life a seed may lose
const RUNGS = F.RUNGS;
const STAGES = ["IM-02", "IM-03", "IM-04", "IM-05", "IM-06", "IM-07", "IM-08", "IM-09", "IM-10", "WL-01", "WL-02", "WL-03", "WL-04", "WL-05", "WL-06", "WL-07", "WL-08", "WL-09"];
const stageRange = (s) => { if (!s) return STAGES.slice(); const out = []; for (const part of s.split(",")) { const m = /^(.+)\.\.(.+)$/.exec(part); if (m) { const a = STAGES.indexOf(m[1]), b = STAGES.indexOf(m[2]); if (a < 0 || b < 0) throw new Error("unknown stage range " + part); for (let i = a; i <= b; i++) out.push(STAGES[i]); } else out.push(part); } return [...new Set(out)]; };
const median = G.median;
const now = () => Date.now();
const mkRng = (s) => { let a = s | 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const strSeed = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

// ---- persistent memo (same line format as v1: GAMEHASH|stage|rung|squad|skills|seed|fps|prune|plan \t result) ----
class Memo {
  constructor(dir, stage, tag) { this.file = path.join(dir, `${stage}__${tag}.jsonl`); this.m = new Map(); this.buf = []; fs.mkdirSync(dir, { recursive: true });
    try { for (const f of fs.readdirSync(dir).filter((f) => f.startsWith(stage + "__") && /\.jsonl(\.gz)?$/.test(f))) { const raw = fs.readFileSync(path.join(dir, f)); const txt = f.endsWith(".gz") ? zlib.gunzipSync(raw).toString() : raw.toString();
        for (const line of txt.split("\n")) { const i = line.indexOf("\t"); if (i < 0) continue; const k = line.slice(0, i); if (!k.startsWith(R.GAMEHASH + "|")) continue; try { this.m.set(k, JSON.parse(line.slice(i + 1))); } catch (e) { /* torn line */ } } } } catch (e) { /* new */ } }
  get(k) { return this.m.get(R.GAMEHASH + "|" + k); }
  set(k, r) { const key = R.GAMEHASH + "|" + k; if (this.m.has(key)) return; const v = { win: r.win, rwin: r.rwin, life: r.life, lost: r.lost, complete: r.complete, aborted: r.aborted, stall: r.stall, escortLost: r.escortLost, t: r.t, tEnd: r.tEnd, frames: r.frames, over: r.over, kills: r.kills, total: r.total, units: r.units, deploys: r.deploys, spent: r.spent };
    this.m.set(key, v); this.buf.push(key + "\t" + JSON.stringify(v)); if (this.buf.length >= 200) this.flush(); }
  flush() { if (!this.buf.length) return; fs.appendFileSync(this.file, this.buf.join("\n") + "\n"); this.buf = []; }
}

// ---- helpers ----
const formation = (squad, plan) => squad.length <= 12 ? squad : S.squadIdsOf(plan, squad);   // a squad of up to 12 is the formation (every card present); a larger pool fields the plan's own units
const squadSig = (q, plan) => q.join(",") + "|" + q.map((id) => (plan.skillIdx || {})[id] ?? "-").join("");
const CLSN = { defender: "중장", guard: "근위", vanguard: "선봉", caster: "술사", sniper: "저격", medic: "의무", supporter: "보조", specialist: "특수" };
function constraintPen(p, o) { let pen = 0; const ids = new Set(p.entries.map((q) => q.id)); for (const id of o.must || []) if (!ids.has(id)) pen += 1e7;
  if (o.quota) { const n = {}; for (const id of ids) { if (S.isSummon(id)) continue; const c = S.def(id).cls; n[c] = (n[c] || 0) + 1; } for (const [c, q] of Object.entries(o.quota)) { const k = n[CLSN[c] || c] || 0; if ((q.max !== undefined && k > q.max) || (q.min !== undefined && k < q.min)) pen += 1e7; } }
  if (S.squadIdsOf(p).length > 12) pen += 1e7; return pen + C.pen(p, o.place); }
const LOGS = { groups: null };
function logGroup(rec) { if (!LOGS.groups) return; fs.appendFileSync(LOGS.groups, JSON.stringify(rec) + "\n"); }

// evaluate plans on seed 1 (memo first); returns [{plan, r, s}]
async function evalPlans(pool, memo, code, lvl, squad, plans, prune, o = {}) {
  const sp = o.space; const out = []; const need = [];
  for (const p0 of plans) { const p = sp ? sp.sanitize(G.clone(p0)) : p0; const q = formation(squad, p); const mk = `${code}|${lvl}|${squadSig(q, p)}|1|30|${prune === undefined ? "-" : prune}|${G.keyOf(p)}`;
    const m = memo && memo.get(mk); const it = { plan: p, mk, q, r: m || null }; out.push(it); if (!m) need.push(it); }
  const rs = await pool.all(need.map((it) => ({ code, lvl, plan: it.plan, opt: { seed: 1, squadIds: it.q, pruneLost: prune, sameRung: true } })));
  need.forEach((it, i) => { it.r = rs[i]; if (memo && !rs[i].error) memo.set(it.mk, rs[i]); });
  for (const it of out) it.s = S.score(it.r) - constraintPen(it.plan, o) - (it.r.error ? 1e9 : 0);
  return { out, fresh: need.length };
}

// ---- one rung, one squad ----
async function squadSolve(pool, code, lvl, squad, o = {}) {
  const t0 = now(); const ctx = R.stageCtx(code, lvl); const model = SG.loadModel(); const critLost = o.critLost !== undefined ? o.critLost : 1;
  const memo = o.memo; let evals = 0;
  let fams = (o.fams || F.loadFamilies(code)).slice();
  // replicate searches: a seeded subset of the stored families as starting points (o.famSeed; o.famFrac of them, at least 3), so replicates do not all start from the same fills
  if (o.famSeed !== undefined && fams.length > 3) { const rg = mkRng(o.famSeed); for (let i = fams.length - 1; i > 0; i--) { const j = Math.floor(rg() * (i + 1)); [fams[i], fams[j]] = [fams[j], fams[i]]; } fams = fams.slice(0, Math.max(3, Math.ceil(fams.length * (+o.famFrac || 0.6)))); }
  const { keep, drop } = o.noPrune ? { keep: squad, drop: [] } : R.prune(squad, lvl);
  const info = S.stageInfo(code, squad, lvl); const space = new G.Space(code, lvl, squad, info, { allOps: squad.length > 12, topK: squad.length > 12 ? 8 : 0 });
  const surr = (p) => { const x = SG.featurize(code, lvl, p, ctx, fams); const pr = model && SG.predict(model, code, x); return { x, pr, s: pr ? pr.s : 0 }; };
  // 1) fill every family from the squad (variants: the second choice at one slot), rank the fills by the surrogate, simulate the best kFill of each
  const kFill = o.kFill || 2, fills = [];
  for (const f of fams) {
    const { assigns, cand, order } = R.fillGreedy(f.T, keep, lvl, ctx, { variants: o.variants || 4 });
    for (const a of assigns) { for (const id of o.must || []) if (!Object.values(a).includes(id)) { const slot = order.map((i) => [i, (cand[i].find((c) => c.id === id) || { tier: 9 }).tier]).filter((x) => x[1] < 9).sort((p, q) => p[1] - q[1])[0]; if (slot) a[slot[0]] = id; } }
    const plans = assigns.map((a) => ({ a, plan: R.fillPlan(f.T, a, lvl) })).filter((x) => x.plan.entries.length).map((x) => Object.assign(x, surr(x.plan)));
    plans.sort((p, q) => q.s - p.s); for (const x of plans.slice(0, kFill)) fills.push(Object.assign(x, { f, cand, order }));
  }
  const ev = await evalPlans(pool, memo, code, lvl, squad, fills.map((x) => x.plan), critLost, Object.assign({ space }, o)); evals += ev.fresh;
  ev.out.forEach((it, i) => { fills[i].r = it.r; fills[i].sc = it.s; fills[i].plan = it.plan; });
  logGroup({ kind: "fill", code, lvl, n: fills.length, pred: fills.map((x) => x.pr ? Math.round(x.pr.s * 1000) / 1000 : null), lost: fills.map((x) => x.r.lost), aborted: fills.map((x) => !!x.r.aborted), kills: fills.map((x) => x.r.kills) });
  // best fill per family
  const perFam = new Map(); for (const x of fills) { const b = perFam.get(x.f.id); if (!b || x.sc > b.sc) perFam.set(x.f.id, x); }
  const lead = [...perFam.values()].sort((a, b) => b.sc - a.sc);
  // 2) coordinate descent on the leading families: one slot at a time over its candidates (and leaving it empty), top cdK by the surrogate simulated
  const nCD = o.cdFams === "all" ? lead.length : +(o.cdFams || 4), passes = +(o.passes || 2), cdK = +(o.cdK || 4);
  for (const x of lead.slice(0, nCD)) {
    let cur = { a: Object.assign({}, x.a), plan: x.plan, r: x.r, sc: x.sc };
    for (let pass = 0; pass < passes; pass++) { let improved = false;
      for (const i of x.order) {
        if (o.deadline && now() > o.deadline) break;
        const used = new Map(Object.entries(cur.a).map(([k, v]) => [v, k])); const alts = [];
        for (const c of x.cand[i] || []) { if (c.id === cur.a[i]) continue; const a = Object.assign({}, cur.a); const at = used.get(c.id); if (at !== undefined) { if (!cur.a[i]) continue; a[at] = cur.a[i]; if (R.tierOf(x.f.T.slots[at].role, cur.a[i]) > 2 || !R.legalAt(ctx, cur.a[i], x.f.T.slots[at].x, x.f.T.slots[at].y)) continue; }
          a[i] = c.id; const names = Object.values(a).map((id) => R.defAny(id).name); if (new Set(names).size !== names.length) continue; alts.push(a); }
        if (cur.a[i]) { const a = Object.assign({}, cur.a); delete a[i]; alts.push(a); }
        if (!alts.length) continue;
        const cands = alts.map((a) => { const plan = R.fillPlan(x.f.T, a, lvl); return Object.assign({ a, plan }, surr(plan)); }).filter((c) => c.plan.entries.length).sort((p, q) => q.s - p.s);
        const top = cands.slice(0, cdK); const e2 = await evalPlans(pool, memo, code, lvl, squad, top.map((c) => c.plan), critLost, Object.assign({ space }, o)); evals += e2.fresh;
        logGroup({ kind: "cd", code, lvl, slot: i, n: cands.length, k: top.length, pred: cands.map((c) => c.pr ? Math.round(c.pr.s * 1000) / 1000 : null), simLost: e2.out.map((it) => it.r.lost), simKills: e2.out.map((it) => it.r.kills), simAborted: e2.out.map((it) => !!it.r.aborted), cur: { lost: cur.r.lost, kills: cur.r.kills } });
        e2.out.forEach((it, j) => { if (it.s > cur.sc) { cur = { a: top[j].a, plan: it.plan, r: it.r, sc: it.s }; improved = true; } });
      }
      if (!improved) break; }
    Object.assign(x, { cdPlan: cur.plan, cdR: cur.r, cdSc: cur.sc });
  }
  const tFill = (now() - t0) / 1000;
  // 3) local refinement from every family's best (after descent where it ran)
  const warm = lead.map((x) => ({ plan: x.cdPlan || x.plan, sc: x.cdSc !== undefined ? x.cdSc : x.sc })).sort((a, b) => b.sc - a.sc).map((w) => w.plan);
  const left = o.deadline ? Math.max(10, (o.deadline - now()) / 1000) : 1e9;
  const warmAll = (o.warmPlans || []).map((p) => G.clone(p)).concat(warm);   // o.warmPlans: plans to start from (a contained deck's answer, for the cross-deck bound)
  const seedHere = o.rngSeed !== undefined ? ((o.rngSeed ^ Math.imul(RUNGS.indexOf(lvl) + 1, 0x9e3779b1)) >>> 0) : undefined;   // one seed per rung
  const r = await G.solve(pool, code, lvl, squad, { time: Math.min(+(o.refineSec || 90), left), evals: 1e9, warm: warmAll.slice(0, 14), allOps: squad.length > 12, pool: squad, sameRung: true,
    earlyStop: +(o.polish || 20), earlyLife: 10 - critLost, critLost, memo, screen: true, p1: o.p1 !== undefined ? +o.p1 : 0.35, verbose: !!o.verbose, must: o.must, quota: o.quota, place: o.place, rngSeed: seedHere, finalists: o.finalists || 6 });
  memo && memo.flush();
  evals += r.evals;
  const near = F.nearest(fams, r.plan); const isNew = !near || near.d >= +(process.env.FAM_DIST || 0.45);
  const worstLost = r.wins === 5 ? 10 - r.worst : null;
  const cleared = r.wins === 5 && worstLost <= critLost && r.constraintsOk !== false;
  const res = { stage: code, lvl, squad, cleared, wins: r.wins, worstLost, lives: r.lives, lost5: r.lives.map((l) => l ? 10 - l : null), units: r.units, spent: r.spent, plan: r.plan, winTime: r.recT, recLost: r.recLost, actions: r.actions,
    family: isNew ? { id: "new:" + F.famId(code, R.templateOf(r.plan)), d: near ? Math.round(near.d * 100) / 100 : 1, tags: F.tagsOf(R.templateOf(r.plan), ctx), from: near ? near.f.id : null } : { id: near.f.id, d: Math.round(near.d * 100) / 100, tags: near.f.tags },
    start: { fills: fills.length, bestFill: lead[0] ? { fam: lead[0].f.id, lost: lead[0].r.lost, cdLost: lead[0].cdR ? lead[0].cdR.lost : null } : null, fams: fams.length, pruned: drop },
    evals, secs: Math.round((now() - t0) / 1000), tFill: Math.round(tFill), truncated: left < +(o.refineSec || 90), harvest: r.harvest };
  // the result's own strategy joins the store (a new family when it moved far from every stored one)
  if (o.famSource && r.wins === 5) F.addPlans(code, o.famSource, [{ plan: r.plan, lvl, lost: r.recLost, worstLost, verified: true, deck: o.deckName, crit: o.crit, src: o.famSource }].concat((r.harvest || []).filter((h) => h.five && h.five.wins === 5).slice(0, 6).map((h) => ({ plan: h.plan, lvl, lost: h.lost, worstLost: 10 - h.five.worst, verified: true, deck: o.deckName, src: o.famSource }))), ctx);
  return res;
}

// ---- the lowest rung for a squad on a stage ----
async function ladder(pool, code, squad, crit, o = {}) {
  const critLost = CRIT[crit]; const t0 = now(); const probes = {}; let evals = 0;
  const memo = o.memo || new Memo(path.join(R.RESULTS, "memo"), code, o.memoTag || "q");
  const cleared = (r) => r && r.cleared;
  const probe = async (lv) => { if (probes[lv]) return probes[lv];
    if (o.known && o.known[lv] && o.known[lv].gameHash === R.GAMEHASH) { probes[lv] = o.known[lv]; if (o.log) o.log(`  ${code} ${o.label || ""} ${crit} ${lv}: stored ${probes[lv].cleared ? "CLEAR" : "miss"}`); return probes[lv]; }
    if (o.deadline && now() > o.deadline - 20e3) return null;
    const r = await squadSolve(pool, code, lv, squad, Object.assign({}, o, { critLost, memo, crit })); evals += r.evals; r.gameHash = R.GAMEHASH; if (!r.cleared && r.truncated) return null; probes[lv] = r; if (o.onProbe) o.onProbe(lv, r);
    if (o.log) o.log(`  ${code} ${o.label || ""} ${crit} ${lv}: ${r.cleared ? "CLEAR" : "miss"} wins ${r.wins}/5 worst lost ${r.worstLost ?? "-"} family ${r.family.id} [${r.family.tags.join(", ")}] | ${r.evals} evals ${r.secs}s`);
    return r; };
  let lo = o.lo !== undefined ? o.lo : 0, start = o.start !== undefined ? o.start : guessRung(code, crit);
  start = Math.max(lo, Math.min(RUNGS.length - 1, start));
  let hi = RUNGS.length, i = start;
  // up until a clear
  for (; i < RUNGS.length; i++) { const r = await probe(RUNGS[i]); if (!r) return partial(); if (cleared(r)) { hi = i; break; } lo = i + 1; }
  // then down one rung at a time (each step down re-searches the rung below the current minimum)
  for (let j = hi - 1; hi < RUNGS.length && j >= lo; j--) { const r = await probe(RUNGS[j]); if (!r) return partial(); if (cleared(r)) hi = j; else break; }
  return finish(false);
  function partial() { return finish(true); }
  function finish(cut) { const min = hi < RUNGS.length ? RUNGS[hi] : null; const best = min ? probes[min] : null;
    return { stage: code, crit, min, cut, worstLost: best ? best.worstLost : null, winTime: best ? best.winTime : null, family: best ? best.family : null, plan: best ? best.plan : null, actions: best ? best.actions : null, lives: best ? best.lives : null,
      ops: best ? [...new Set(best.plan.entries.map((q) => q.id))].map((id) => ({ id, sk: S.isSummon(id) ? "" : `S${((best.plan.skillIdx || {})[id] ?? S.maxSkillIdx(id, S.parseLv(min)[0])) + 1}` })) : [],
      probes: Object.fromEntries(Object.entries(probes).map(([lv, r]) => [lv, { cleared: r.cleared, wins: r.wins, worstLost: r.worstLost, family: r.family.id, evals: r.evals, secs: r.secs, start: r.start }])), squadUsed: best ? best.squad : null, evals, secs: Math.round((now() - t0) / 1000) }; }
}
// a starting guess: the stored minimum of the widest deck (all operators) for this stage, else the recommended rung
function guessRung(code, crit) {
  for (const d of ["T6", "T5"]) { const j = R.readJSON(path.join(R.RESULTS, "jobs", `${code}__${d}__${crit}.json`), null) || R.readJSON(path.join(__dirname, "data", "v1_state", "jobs", `${code}__${d}__${crit}.json`), null); if (j && j.min) return Math.max(0, RUNGS.indexOf(j.min)); }
  const rec = S.readImSim().REC[code]; return rec ? Math.max(0, RUNGS.findIndex((lv) => F.rank(lv) >= rec[0] * 1000 + rec[1]) - 2) : 3;
}

// ---- key operators: remove one and re-search from the families (role-based); key when no plan meets the criterion at the same rung ----
async function keyOps(pool, code, lvl, squad, res, crit, o = {}) {
  const critLost = CRIT[crit]; const out = []; const t0 = now(); const memo = o.memo || new Memo(path.join(R.RESULTS, "memo"), code, o.memoTag || "q");
  const used = [...new Set(res.plan.entries.map((q) => q.id))].filter((id) => !S.isSummon(id));
  for (const id of used) {
    if (o.deadline && now() > o.deadline - 30e3) { out.push({ id, key: null, note: "time" }); continue; }
    const sq = squad.filter((x) => x !== id); if (!sq.length) { out.push({ id, key: true }); continue; }
    const r = await squadSolve(pool, code, lvl, sq, Object.assign({}, o, { critLost, memo, crit, refineSec: +(o.keySec || 45), cdFams: o.keyCdFams || 2, polish: 8, famSource: null, must: (o.must || []).filter((m) => m !== id) }));
    // who took its role: the operator now standing on (or nearest to) its first square
    const q0 = res.plan.entries.find((q) => q.id === id); let by = null;
    if (r.cleared) { const near = r.plan.entries.filter((q) => !S.isSummon(q.id)).map((q) => [q.id, Math.abs(q.x - q0.x) + Math.abs(q.y - q0.y)]).sort((a, b) => a[1] - b[1])[0]; by = near && near[1] <= 1 ? near[0] : "(re-planned)"; }
    const d = S.def(id); out.push({ id, name: d.name, cls: R.CLS[d.cls], rarity: d.rarity, role: R.kindOf(d), key: !r.cleared, replacedBy: by, worstLost: r.worstLost, family: r.family.id, evals: r.evals, secs: r.secs });
    if (o.log) o.log(`    key? ${id}: ${r.cleared ? "no, covered by " + by : "KEY"} (${r.evals} evals ${r.secs}s)`);
  }
  return { ops: out, secs: Math.round((now() - t0) / 1000) };
}

module.exports = { CRIT, RUNGS, STAGES, stageRange, Memo, squadSolve, ladder, keyOps, guessRung, formation, LOGS, evalPlans, strSeed, mkRng };
