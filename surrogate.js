#!/usr/bin/env node
// solver v2: the surrogate. A cheap predictor of (lost, win) for a plan at a rung, from what the plan fields: operator numbers at the rung, damage per second against
// this stage's foes (hp-weighted), path coverage of each square, block, heal per second, cost, skill numbers, timing, and the strategy family it belongs to.
// Model: gradient-boosted depth-3 regression trees on quantile bins, per stage (pure JS, no dependencies); lost by squared loss, win (a real win: lost < life) by log loss.
//   node surrogate.js extract [--memo DIR] [--out FILE]       features of every memo record (run under the game version the records were made on: SOLVER_GAME_DIR)
//   node surrogate.js train [--data f1,f2] [--out model.json] [--holdout 0.2]   train; with --holdout, report held-out accuracy (Spearman, top-k hit rate)
//   node surrogate.js eval --model m.json --data f           accuracy of a trained model on another data set (e.g. trained on v1, tested on v2)
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const R = require("./roles.js");
const F = require("./families.js");
const { S, TD } = R;

// ---- features ----
const KINDS = ["block", "gnb", "phys", "arts", "heal", "supp"];
const NAMES = ["E", "L", "nEntries", "nSecondary", "nRetreats", "nTimed", "meanFrom", "cost", "cost3", "firstBlk",
  ...KINDS.map((k) => "n_" + k), "blkHp", "blkDef", "block", "blkCov", "dps", "covDps", "dpsPhys", "dpsArts", "dps0", "dps600", "airDps", "hps", "slow",
  "skBoost", "skBurst", "skHeld", "skDef", "skCure", "skDp", "skSp", "skTimed", "minRedeploy", "polFire", "polMelt", "famD", "famQ", ...Array.from({ length: 12 }, (_, i) => "fam" + i)];
function featurize(code, lvl, plan, ctx, fams) {
  const [E, L] = S.parseLv(lvl); const f = new Array(NAMES.length).fill(0); const set = (n, v) => { f[NAMES.indexOf(n)] = v; }; const add = (n, v) => { f[NAMES.indexOf(n)] += v; };
  set("E", E); set("L", L / 60);
  const seen = new Set(); let order = 0, firstBlk = -1, sumFrom = 0, nT = 0; const W = ctx.W, tt = Math.max(1, ctx.totalTraffic);
  set("nEntries", plan.entries.length); set("nRetreats", (plan.retreats || []).length);
  for (const q of plan.entries) {
    if (q.from !== undefined) { nT++; sumFrom += q.from; }
    if (seen.has(q.id)) { add("nSecondary", 1); continue; } seen.add(q.id);
    const o = R.opStats(q.id, lvl, (plan.skillIdx || {})[q.id]); if (!o) continue;
    add("n_" + o.kind, 1); add("cost", o.cost / 100); if (order < 3) add("cost3", o.cost / 100);
    const cv = (ctx.cover[q.id] || {})[q.x * 100 + q.y]; const cov = cv ? cv[q.d] || 0 : 0;
    const e = R.effDps(o, ctx);
    if (o.kind === "block") { if (firstBlk < 0) firstBlk = order; add("blkHp", o.hp / 1e4); add("blkDef", o.def / 1e3); add("block", o.block); add("blkCov", (ctx.traffic[q.y * W + q.x] || 0) / tt * o.block * 10); }
    add("dps", e / 1e3); add("covDps", e * cov / tt / 100); if (o.dmg === "arts") add("dpsArts", e / 1e3); else add("dpsPhys", e / 1e3);
    add("dps0", R.dpsVs(o, 0, 0) / 1e3); add("dps600", R.dpsVs(o, 600, 0) / 1e3);
    if (o.tile === "h" || /lord|long/.test(o.range || "")) add("airDps", e * ((ctx.air || []).reduce((a, b) => a + b, 0) > 0 ? 1 : 0) / 1e3);
    add("hps", R.hps(o) / 1e3); add("slow", o.slow);
    add("skBoost", o.skUp * (o.skAtk - 1)); add("skBurst", o.skBurst); add("skDef", o.skUp * (o.skDef - 1)); add("skCure", o.skCure); add("skDp", o.skDp); add("skSp", (o.skSp || 0) / 100);
    const sk = (plan.skill || {})[q.id]; if (sk && sk.m === 3 && o.skManual) add("skHeld", 1); if (sk && sk.m === 1) add("skTimed", 1);
    set("minRedeploy", Math.min(f[NAMES.indexOf("minRedeploy")] || 999, o.redeploy) );
    order++;
  }
  set("firstBlk", firstBlk < 0 ? 12 : firstBlk); set("nTimed", nT); set("meanFrom", nT ? sumFrom / nT / Math.max(1, ctx.tEnd) : 0);
  set("minRedeploy", (f[NAMES.indexOf("minRedeploy")] || 0) / 100);
  const pol = Object.assign({ fire: 1, melt: 1 }, plan.pol || {}); set("polFire", pol.fire ? 1 : 0); set("polMelt", pol.melt ? 1 : 0);
  if (fams && fams.length) { const n = F.nearest(fams, plan); if (n) { set("famD", n.d); set("famQ", n.f.q / 100); const i = fams.indexOf(n.f); if (i >= 0 && i < 12 && n.d < 0.6) f[NAMES.indexOf("fam0") + i] = 1; } } else set("famD", 1);
  return f;
}

// ---- memo records -> data set ----
function* memoRecords(dir) {
  const G = require("./ga.js");
  for (const fn of fs.readdirSync(dir).filter((f) => /\.jsonl(\.gz)?$/.test(f)).sort()) {
    const raw = fs.readFileSync(path.join(dir, fn)); const txt = fn.endsWith(".gz") ? zlib.gunzipSync(raw).toString() : raw.toString();
    for (const line of txt.split("\n")) { const tab = line.indexOf("\t"); if (tab < 0) continue; const key = line.slice(0, tab);
      const parts = key.split("|"); if (parts.length < 9) continue; const [hash, code, lvl, ids, , , fps] = parts; if (fps !== "30") continue;
      let r, plan; try { r = JSON.parse(line.slice(tab + 1)); plan = G.planFromKey(parts.slice(8).join("|")); } catch (e) { continue; }
      yield { hash, code, lvl, squad: ids.split(","), plan, r, src: fn.replace(/\.jsonl(\.gz)?$/, "") }; }
  }
}
function extract(memoDir, out, opt = {}) {
  const famCache = {}; let n = 0; const lines = [];
  const life = TD.CFG.life;
  for (const m of memoRecords(memoDir)) {
    if (opt.hash && m.hash !== opt.hash) continue;
    const ctx = R.stageCtx(m.code, m.lvl); const fams = famCache[m.code] || (famCache[m.code] = F.loadFamilies(m.code));
    const x = featurize(m.code, m.lvl, m.plan, ctx, fams);
    const lost = Math.min(12, m.r.lost), win = m.r.complete && m.r.lost < life && !m.r.escortLost ? 1 : 0;
    lines.push(JSON.stringify([m.code, m.lvl, m.src, x.map((v) => Math.round(v * 1e4) / 1e4), lost, win, m.r.aborted ? 1 : 0, Math.round((m.r.kills / Math.max(1, m.r.total)) * 1000) / 1000]));
    n++;
  }
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, zlib.gzipSync(lines.join("\n") + "\n"));
  return n;
}
function loadData(files) { const rows = []; for (const f of files) { const raw = fs.readFileSync(f); const txt = f.endsWith(".gz") ? zlib.gunzipSync(raw).toString() : raw.toString(); for (const l of txt.split("\n")) if (l) rows.push(JSON.parse(l)); } return rows.map(([code, lvl, src, x, lost, win, ab, kr]) => ({ code, lvl, src, x, lost, win, ab, kr })); }

// ---- gradient-boosted trees on quantile bins ----
function bins(X, nb = 32) { const d = X[0].length; const edges = []; for (let j = 0; j < d; j++) { const v = X.map((r) => r[j]).sort((a, b) => a - b); const e = []; for (let k = 1; k < nb; k++) { const q = v[Math.floor(k * (v.length - 1) / nb)]; if (!e.length || q > e[e.length - 1]) e.push(q); } edges.push(e); } return edges; }
const binOf = (e, v) => { let lo = 0, hi = e.length; while (lo < hi) { const m = (lo + hi) >> 1; if (v > e[m]) lo = m + 1; else hi = m; } return lo; };
function fitTree(B, g, h, idx, depth, nb, minLeaf, lambda) {
  const d = B[0].length;
  const leaf = (ix) => { let G = 0, H = 0; for (const i of ix) { G += g[i]; H += h[i]; } return { v: -G / (H + lambda) }; };
  if (depth === 0 || idx.length < 2 * minLeaf) return leaf(idx);
  let best = null; let GT = 0, HT = 0; for (const i of idx) { GT += g[i]; HT += h[i]; }
  for (let j = 0; j < d; j++) {
    const G = new Float64Array(nb + 1), H = new Float64Array(nb + 1), C = new Int32Array(nb + 1);
    for (const i of idx) { const b = B[i][j]; G[b] += g[i]; H[b] += h[i]; C[b]++; }
    let gl = 0, hl = 0, cl = 0;
    for (let b = 0; b < nb; b++) { gl += G[b]; hl += H[b]; cl += C[b]; if (cl < minLeaf || idx.length - cl < minLeaf) continue; const gr = GT - gl, hr = HT - hl;
      const gain = gl * gl / (hl + lambda) + gr * gr / (hr + lambda) - GT * GT / (HT + lambda); if (!best || gain > best.gain) best = { gain, j, b }; }
  }
  if (!best || best.gain <= 1e-9) return leaf(idx);
  const L = [], Rr = []; for (const i of idx) (B[i][best.j] <= best.b ? L : Rr).push(i);
  return { j: best.j, b: best.b, l: fitTree(B, g, h, L, depth - 1, nb, minLeaf, lambda), r: fitTree(B, g, h, Rr, depth - 1, nb, minLeaf, lambda) };
}
const treeAt = (t, b) => { while (t.j !== undefined) t = b[t.j] <= t.b ? t.l : t.r; return t.v; };
function gbdt(X, y, opt = {}) {
  const rounds = opt.rounds || 120, lr = opt.lr || 0.1, depth = opt.depth || 3, nb = 32, logistic = !!opt.logistic;
  const edges = bins(X, nb); const B = X.map((r) => r.map((v, j) => binOf(edges[j], v)));
  const n = y.length; const mean = y.reduce((a, b) => a + b, 0) / Math.max(1, n);
  const base = logistic ? Math.log((mean + 1e-3) / (1 - mean + 1e-3)) : mean; const F0 = new Float64Array(n).fill(base); const trees = [];
  const idx = Array.from({ length: n }, (_, i) => i); const g = new Float64Array(n), h = new Float64Array(n);
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n; i++) { if (logistic) { const p = 1 / (1 + Math.exp(-F0[i])); g[i] = p - y[i]; h[i] = Math.max(1e-6, p * (1 - p)); } else { g[i] = F0[i] - y[i]; h[i] = 1; } }
    const sub = n > 4000 ? idx.filter(() => Math.random() < 0.7) : idx;
    const t = fitTree(B, g, h, sub, depth, nb, opt.minLeaf || 15, 1); trees.push(t);
    for (let i = 0; i < n; i++) F0[i] += lr * treeAt(t, B[i]);
  }
  return { edges, trees, base, lr, logistic };
}
function gbPredict(m, x) { const b = x.map((v, j) => binOf(m.edges[j], v)); let s = m.base; for (const t of m.trees) s += m.lr * treeAt(t, b); return m.logistic ? 1 / (1 + Math.exp(-s)) : s; }

// the regression target: life lost, plus how far short of the end the run fell (a pruned run stops at the same lost; its kill share says how far it got)
const BAD = (r) => r.lost + 3 * (1 - r.kr);
// one model per stage (lost and win), plus a pooled one for stages with little data
function train(rows, opt = {}) {
  const by = {}; for (const r of rows) (by[r.code] = by[r.code] || []).push(r);
  const model = { names: NAMES, trained: new Date().toISOString(), n: rows.length, stages: {} };
  const fit = (rs) => ({ lost: gbdt(rs.map((r) => r.x), rs.map(BAD), opt), win: gbdt(rs.map((r) => r.x), rs.map((r) => r.win), Object.assign({}, opt, { logistic: true })), n: rs.length });
  for (const [code, rs] of Object.entries(by)) if (rs.length >= 200) model.stages[code] = fit(rs.length > 20000 ? sample(rs, 20000) : rs);
  return model;
}
function sample(a, n) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b.slice(0, n); }
// predicted (lost: the BAD target, pWin) and a ranking score (higher = better): expected lost with a win bonus
function predict(model, code, x) { const m = model && model.stages[code]; if (!m) return null; const lost = gbPredict(m.lost, x), pw = gbPredict(m.win, x); return { lost, pw, s: -lost + 2 * pw }; }

// ---- accuracy: Spearman of predicted vs true lost, and how often the true best of a group of candidates is in the predicted top-k ----
function spearman(a, b) { const rk = (v) => { const o = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = new Array(v.length); let i = 0; while (i < o.length) { let j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++; for (let k = i; k <= j; k++) r[o[k][1]] = (i + j) / 2; i = j + 1; } return r; };
  const ra = rk(a), rb = rk(b), n = a.length, ma = (n - 1) / 2; let num = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { num += (ra[i] - ma) * (rb[i] - ma); da += (ra[i] - ma) ** 2; db += (rb[i] - ma) ** 2; } return num / Math.sqrt(da * db || 1); }
function evaluate(model, rows, opt = {}) {
  const k = opt.k || 5, G = opt.group || 20; const per = {}; let hits = 0, groups = 0, rnd = 0, aucN = 0, aucC = 0;
  const pred = rows.map((r) => predict(model, r.code, r.x));
  const ok = rows.map((r, i) => [r, pred[i]]).filter(([, p]) => p);
  for (const [r, p] of ok) { (per[r.code] = per[r.code] || { a: [], b: [] }).a.push(p.lost); per[r.code].b.push(BAD(r)); }
  const rho = {}; for (const [c, v] of Object.entries(per)) rho[c] = Math.round(spearman(v.a, v.b) * 1000) / 1000;
  const all = spearman(ok.map(([, p]) => p.lost), ok.map(([r]) => BAD(r)));
  // groups: candidates of one stage and rung (random groups of G); the true best = fewest lost, then most kills
  const byCell = {}; for (const [r, p] of ok) (byCell[r.code + r.lvl] = byCell[r.code + r.lvl] || []).push([r, p]);
  for (const cell of Object.values(byCell)) { const sh = sample(cell, cell.length); for (let i = 0; i + G <= sh.length; i += G) { const g = sh.slice(i, i + G);
      const tv = BAD; const bestV = Math.min(...g.map(([r]) => tv(r))); const top = g.slice().sort((a, b) => b[1].s - a[1].s).slice(0, k);
      if (top.some(([r]) => tv(r) === bestV)) hits++; groups++; rnd += Math.min(1, k * g.filter(([r]) => tv(r) === bestV).length / G); } }
  // win AUC (pairs, sampled)
  const pos = ok.filter(([r]) => r.win), neg = ok.filter(([r]) => !r.win); for (let t = 0; t < 20000 && pos.length && neg.length; t++) { const a = pos[Math.floor(Math.random() * pos.length)], b = neg[Math.floor(Math.random() * neg.length)]; aucN++; if (a[1].pw > b[1].pw) aucC++; else if (a[1].pw === b[1].pw) aucC += 0.5; }
  return { n: ok.length, spearmanAll: Math.round(all * 1000) / 1000, spearmanByStage: rho, topk: k, group: G, hitRate: groups ? Math.round(hits / groups * 1000) / 1000 : null, randomHitRate: groups ? Math.round(rnd / groups * 1000) / 1000 : null, groups, winAUC: aucN ? Math.round(aucC / aucN * 1000) / 1000 : null };
}

const MODEL_FILE = path.join(R.RESULTS, "surrogate", "model.json");
let MODEL = null;
function loadModel(f) { if (MODEL && !f) return MODEL; try { MODEL = JSON.parse(fs.readFileSync(f || MODEL_FILE, "utf8")); } catch (e) { MODEL = null; } return MODEL; }

module.exports = { NAMES, featurize, extract, loadData, train, predict, evaluate, gbdt, gbPredict, spearman, loadModel, MODEL_FILE, memoRecords };

if (require.main === module) {
  const argv = process.argv.slice(2); const A = { _: [] }; for (let i = 0; i < argv.length; i++) { const s = argv[i]; if (s.startsWith("--")) { const n = argv[i + 1]; if (n === undefined || n.startsWith("--")) A[s.slice(2)] = true; else { A[s.slice(2)] = n; i++; } } else A._.push(s); }
  const cmd = A._[0];
  if (cmd === "extract") { const t = Date.now(); const n = extract(A.memo || path.join(R.RESULTS, "memo"), A.out || path.join(R.RESULTS, "surrogate", `data_${R.GAMEHASH}.jsonl.gz`), { hash: A.hash === "any" ? null : (A.hash || R.GAMEHASH) }); console.log(`extracted ${n} records (game ${R.GAMEHASH}) in ${((Date.now() - t) / 1000).toFixed(1)} s`); }
  else if (cmd === "train") {
    const files = (A.data || "").split(",").filter(Boolean); const rows = loadData(files); const t = Date.now();
    let model, rep = null;
    if (A.holdout || A.split) { const h = +(A.holdout || 0.2); const tr = [], te = [];
      // split: random (default) | deck:<D> (every record of deck D held out: a squad the model never saw) | tail (the last share of each stage-deck log: later, better plans)
      if (A.split && A.split.startsWith("deck:")) { const d = A.split.slice(5); for (const r of rows) (r.src.endsWith("__" + d) ? te : tr).push(r); }
      else if (A.split === "tail") { const by = {}; for (const r of rows) (by[r.src] = by[r.src] || []).push(r); for (const a of Object.values(by)) a.forEach((r, i) => (i >= a.length * (1 - h) ? te : tr).push(r)); }
      else for (const r of rows) (Math.random() < h ? te : tr).push(r);
      model = train(tr); rep = evaluate(model, te); rep.split = A.split || "random"; rep.trainN = tr.length; rep.testN = te.length; }
    else model = train(rows);
    model.data = files.map((f) => path.basename(f)); model.holdout = rep;
    const out = A.out || MODEL_FILE; R.writeJSON(out, model, false);
    console.log(`trained on ${rows.length} rows in ${((Date.now() - t) / 1000).toFixed(1)} s -> ${out}`); if (rep) console.log(JSON.stringify(rep, null, 1));
  } else if (cmd === "groups") {   // in-situ accuracy from the engine's logged candidate groups (fills and descent steps): the simulated ones vs their predicted order
    const files = A._.slice(1).length ? A._.slice(1) : fs.readdirSync(path.join(R.RESULTS, "surrogate")).filter((f) => f.startsWith("groups_")).map((f) => path.join(R.RESULTS, "surrogate", f));
    let n = 0, top1 = 0, rnd = 0; const rhos = [];
    for (const f of files) for (const l of fs.readFileSync(f, "utf8").split("\n")) { if (!l) continue; const g = JSON.parse(l); const lost = g.kind === "cd" ? g.simLost : g.lost, kills = g.kind === "cd" ? g.simKills : g.kills; const pred = g.pred.slice(0, lost.length);
      if (lost.length < 3 || pred.some((p) => p === null)) continue; const bad = lost.map((x, i) => x - (kills[i] || 0) / 1000); const best = Math.min(...bad); n++;
      const pi = pred.indexOf(Math.max(...pred)); if (bad[pi] === best) top1++; rnd += bad.filter((b) => b === best).length / bad.length; rhos.push(spearman(pred.map((p) => -p), bad)); }
    const ok = rhos.filter((r) => !isNaN(r)); console.log(JSON.stringify({ groups: n, top1Hit: n ? +(top1 / n).toFixed(3) : null, randomTop1: n ? +(rnd / n).toFixed(3) : null, meanSpearman: ok.length ? +(ok.reduce((a, b) => a + b, 0) / ok.length).toFixed(3) : null }));
  } else if (cmd === "eval") { const m = loadModel(A.model); const rows = loadData(A.data.split(",")); console.log(JSON.stringify(evaluate(m, rows), null, 1)); }
  else console.log("node surrogate.js extract|train|eval (see the header)");
}
