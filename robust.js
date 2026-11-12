#!/usr/bin/env node
// solver v2: robust cell values from replicate searches (search.js run --rep K), with cross-deck bounds.
//   node robust.js collect [--stages IM-05..IM-10] [--enforce] [--hours 1] [--workers N] [--tag NAME] [--nocanon]
//     1. every done replicate on the current game (results/jobs/rep/*__rK.json; a canonical results/jobs/<cell>.json that is not itself an aggregate is moved
//        there as replicate "c" first) -> per (stage, deck, crit): value = MIN over replicates (each minimum is an upper bound, so more searches only tighten it),
//        spread = max - min in rungs over the replicates that found a clear, and the list of replicate minima
//     2. "full" (spec) = min(the full cells' value, the lowest rung at which any lost1 replicate cleared with worst lost 0); lost1 = min(lost1, full)
//     3. cross-deck bounds (a deck that contains another can field its plan): T6 <= T5 <= T4, T5 <= starter (and T6 <= starter). A violation is resolved by
//        replaying the lower deck's plan with the higher deck (5 seeds) and, with --enforce, by a search at that rung warm-started from that plan
//     4. writes results/robust/<tag>.json + .txt, merges results/robust/latest.json, and (unless --nocanon) the canonical results/jobs/<cell>.json = the best
//        replicate with a `robust` record (rank.js and sheet3.js read those)
//   node robust.js table [--stages ..] [--file results/robust/latest.json]      print the table again
"use strict";
{ const fs0 = require("fs"), p0 = require("path"); let sk = []; try { sk = fs0.readFileSync(p0.join(__dirname, "ci", "skip_runs.txt"), "utf8").split(/\s+/).filter(Boolean); } catch (e) { sk = []; } if (process.env.GITHUB_RUN_ID && sk.includes(process.env.GITHUB_RUN_ID)) { console.log("skipped: run " + process.env.GITHUB_RUN_ID + " is listed in ci/skip_runs.txt (a duplicate run)"); process.exit(0); } }   // duplicate runs that cannot be cancelled with this token end here
// a run listed on ci/skip_runs.txt (one that cannot be cancelled with this token) does nothing: its queued jobs end at once and upload nothing
{ const rid = process.env.GITHUB_RUN_ID; let skip = []; try { skip = require("fs").readFileSync(require("path").join(__dirname, "ci", "skip_runs.txt"), "utf8").split(/\s+/).filter(Boolean); } catch (e) { /* none */ }
  if (rid && skip.includes(rid)) { require("child_process").execSync("git checkout -- results && git clean -fdq results", { stdio: "inherit" }); console.log("run " + rid + " is on ci/skip_runs.txt: results/ restored to the branch head, nothing collected"); process.exit(0); } }
const fs = require("fs");
const path = require("path");
const R = require("./roles.js");
const E = require("./engine.js");
const G = require("./ga.js");
const Q = require("./query.js");
const argv = process.argv.slice(2); const A = { _: [] }; for (let i = 0; i < argv.length; i++) { const s = argv[i]; if (s.startsWith("--")) { const n = argv[i + 1]; if (n === undefined || n.startsWith("--")) A[s.slice(2)] = true; else { A[s.slice(2)] = n; i++; } } else A._.push(s); }
const RUNGS = E.RUNGS, NR = RUNGS.length;
const JOBS = path.join(R.RESULTS, "jobs"), RJOBS = path.join(JOBS, "rep"), OUT = path.join(R.RESULTS, "robust"), REPL = path.join(R.RESULTS, "replays");
const DECKS = ["starter", "T4", "T5", "T6"], CRITS = ["lost1", "full"];
const CONTAINS = { T5: ["starter", "T4"], T6: ["T5", "T4", "starter"] };   // T5 holds every starter and T4 card; T6 holds all
const ri = (lv) => lv ? RUNGS.indexOf(lv) : NR;
const rn = (i) => i >= NR ? "none" : RUNGS[i];
const cid = (st, d, c) => `${st}__${d}__${c}`;

function loadReps(st, d, c, H) {
  fs.mkdirSync(RJOBS, { recursive: true });
  const canon = path.join(JOBS, cid(st, d, c) + ".json"); const x = R.readJSON(canon, null);
  if (x && x.done && x.gameHash === H && !x.robust) {   // a plain (non-replicate) answer on this game: keep it as replicate "c"
    const to = path.join(RJOBS, cid(st, d, c) + "__rc.json"); if (!fs.existsSync(to)) { x.rep = "c"; R.writeJSON(to, x); const p = R.readJSON(path.join(JOBS, cid(st, d, c) + ".partial.json"), null); if (p) R.writeJSON(path.join(RJOBS, cid(st, d, c) + "__rc.partial.json"), p); } }
  const reps = [];
  for (const f of fs.readdirSync(RJOBS).filter((f) => f.startsWith(cid(st, d, c) + "__r") && f.endsWith(".json") && !f.includes(".partial."))) {
    const j = R.readJSON(path.join(RJOBS, f), null); if (!j || !j.done || j.gameHash !== H) continue;
    const part = R.readJSON(path.join(RJOBS, f.replace(/\.json$/, ".partial.json")), { probes: {} });
    reps.push({ rep: String(j.rep ?? f.match(/__r(\w+)\.json$/)[1]), i: ri(j.min), worstLost: j.worstLost, job: j, file: f, probes: j.probes || {}, pprobes: part.probes || {} });
  }
  return reps.sort((a, b) => a.i - b.i || (a.worstLost ?? 9) - (b.worstLost ?? 9));
}

async function collect() {
  const H = A.hash || R.GAMEHASH; const stages = E.stageRange(A.stages);
  const tag = A.tag || `robust_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;
  const cells = {}; const T = {};   // T[stage][deck][crit] = {i, src, plan, squad}
  for (const st of stages) { T[st] = {}; for (const d of DECKS) { T[st][d] = {}; for (const c of CRITS) {
    const reps = loadReps(st, d, c, H); if (!reps.length) continue;
    const found = reps.filter((r) => r.i < NR).map((r) => r.i);
    const cell = { stage: st, deck: d, crit: c, gameHash: H, nReps: reps.length, reps: reps.map((r) => ({ rep: r.rep, min: rn(r.i), worstLost: r.worstLost ?? null, family: r.job.family ? r.job.family.id : null })),
      valueJob: rn(reps[0].i), spread: found.length ? Math.max(...found) - Math.min(...found) : null, nNone: reps.length - found.length };
    cells[cid(st, d, c)] = cell; const b = reps[0];
    T[st][d][c] = { i: b.i, src: `rep ${b.rep}`, plan: b.job.plan, squad: b.job.squad, best: b, reps };
  } } }
  // 2. full (spec): min(full value, lowest lost1 rung cleared with worst lost 0); lost1 bounded by full
  for (const st of stages) for (const d of DECKS) {
    const L = T[st][d].lost1, F = T[st][d].full; if (!L) continue; let zi = NR, zplan = null, zrep = null;
    for (const r of L.reps) for (const [lv, p] of Object.entries(r.probes)) { if (p.cleared && p.worstLost === 0 && ri(lv) < zi) { zi = ri(lv); const pp = r.pprobes[lv]; zplan = pp && pp.plan ? pp.plan : (lv === r.job.min ? r.job.plan : null); zrep = r.rep; } }
    const c = cells[cid(st, d, "full")]; const fi = F ? F.i : NR;
    if (zi < fi) { T[st][d].full = Object.assign({}, F || {}, { i: zi, src: `lost1 rep ${zrep} cleared with 0 lost`, plan: zplan, squad: L.squad }); }
    if (c) c.fullFromLost1 = zi < NR ? rn(zi) : null; else if (zi < NR) cells[cid(st, d, "full")] = { stage: st, deck: d, crit: "full", gameHash: H, nReps: 0, reps: [], valueJob: "none", spread: null, fullFromLost1: rn(zi) };
    const F2 = T[st][d].full; if (F2 && F2.i < L.i) { T[st][d].lost1 = Object.assign({}, L, { i: F2.i, src: "full clear (" + F2.src + ")", plan: F2.plan, squad: F2.squad }); }
  }
  // 3. cross-deck bounds
  const nW = Math.max(1, +(A.workers || require("os").cpus().length)); let pool = null; const deadline = Date.now() + (+(A.hours || 1)) * 3600e3; const bounds = [];
  const DK = Q.DECKS();
  for (const st of stages) for (const c of CRITS) for (const Hd of ["T5", "T6"]) {
    const hcell = T[st][Hd][c]; if (!hcell) continue;
    const lows = CONTAINS[Hd].map((Ld) => [Ld, T[st][Ld][c]]).filter(([, x]) => x && x.i < hcell.i).sort((a, b) => a[1].i - b[1].i);
    if (!lows.length) continue;
    const [Ld, lc] = lows[0]; const lv = RUNGS[lc.i]; const rec = { stage: st, crit: c, high: Hd, highWas: rn(hcell.i), low: Ld, lowAt: lv, result: null };
    if (!lc.plan) { rec.result = "no stored plan for the lower deck at that rung"; bounds.push(rec); continue; }
    if (!pool) { pool = new G.Pool(nW); await pool.started; }
    const sq = E.formation(DK[Hd], lc.plan);
    const rs = await pool.all([1, 2, 3, 4, 5].map((sd) => ({ code: st, lvl: lv, plan: lc.plan, opt: { seed: sd, squadIds: sq, sameRung: true } })));
    const worst = Math.max(...rs.map((r) => r.lost)); const ok = rs.every((r) => r.complete) && worst <= E.CRIT[c];
    if (ok) { T[st][Hd][c] = Object.assign({}, hcell, { i: lc.i, src: `bound from ${Ld} (its plan replayed with ${Hd}, worst lost ${worst})`, plan: lc.plan, squad: DK[Hd], boundLost: worst }); rec.result = `replayed: clears, worst lost ${worst}`; }
    else if (A.enforce && Date.now() < deadline - 300e3) {
      const r = await E.squadSolve(pool, st, lv, DK[Hd], { critLost: E.CRIT[c], warmPlans: [lc.plan], refineSec: +(A.refine || 300), cdFams: 2, polish: 25, crit: c, deckName: Hd, famSource: null, rngSeed: E.strSeed(`bound|${st}|${Hd}|${c}|${lv}`), deadline });
      if (r.cleared) { T[st][Hd][c] = Object.assign({}, hcell, { i: lc.i, src: `bound from ${Ld} (warm-started search at ${lv}, worst lost ${r.worstLost})`, plan: r.plan, squad: DK[Hd], boundLost: r.worstLost }); rec.result = `warm search: CLEAR, worst lost ${r.worstLost}`; }
      else rec.result = `replay lost ${rs.map((r) => r.lost).join(" ")}; warm search: miss (worst lost ${r.worstLost ?? "-"}); violation stands`;
    } else rec.result = `replay lost ${rs.map((r) => r.lost).join(" ")}; ${A.enforce ? "no time left for a warm search" : "warm search not run (no --enforce)"}`;
    bounds.push(rec); console.log(`BOUND ${st} ${c} ${Hd} ${rec.highWas} > ${Ld} ${lv}: ${rec.result}`);
  }
  if (pool) pool.close();
  // 4. outputs
  for (const st of stages) for (const d of DECKS) for (const c of CRITS) { const x = T[st][d][c], cell = cells[cid(st, d, c)]; if (!x || !cell) continue; cell.value = rn(x.i); cell.source = x.src; }
  const doc = { tag, gameHash: H, made: new Date().toISOString(), rule: "value = min over replicates; full = min(full, lost1 cleared with 0 lost); cross-deck bounds T6<=T5<=T4, T5<=starter", cells: Object.values(cells), bounds };
  fs.mkdirSync(OUT, { recursive: true }); R.writeJSON(path.join(OUT, tag + ".json"), doc);
  const latestF = path.join(OUT, "latest.json"); const latest = R.readJSON(latestF, { cells: [] }); const m = new Map(latest.cells.map((x) => [cid(x.stage, x.deck, x.crit) + "|" + x.gameHash, x]));
  for (const x of doc.cells) m.set(cid(x.stage, x.deck, x.crit) + "|" + x.gameHash, Object.assign({ tag }, x));
  R.writeJSON(latestF, { made: doc.made, cells: [...m.values()] });
  const txt = table(doc.cells, stages, H) + "\n" + (bounds.length ? "bounds:\n" + bounds.map((b) => `  ${b.stage} ${b.crit} ${b.high} ${b.highWas} > ${b.low} ${b.lowAt}: ${b.result}`).join("\n") + "\n" : "bounds: none violated\n") + noise(doc.cells);
  fs.writeFileSync(path.join(OUT, tag + ".txt"), txt); console.log(txt);
  if (!A.nocanon) for (const st of stages) for (const d of DECKS) for (const c of CRITS) { const x = T[st][d][c], cell = cells[cid(st, d, c)]; if (!x || !x.best || !cell) continue;
    const j = Object.assign({}, x.best.job, { min: rn(x.i), plan: x.plan || x.best.job.plan, squad: x.squad || x.best.job.squad, robust: { tag, value: cell.value, source: cell.source, reps: cell.reps, spread: cell.spread, fullFromLost1: cell.fullFromLost1 ?? null } });
    if (x.i !== x.best.i) { delete j.keyOps; j.worstLost = x.boundLost ?? j.worstLost; }
    R.writeJSON(path.join(JOBS, cid(st, d, c) + ".json"), j); }
}

function table(cells, stages, H) {
  const g = (st, d, c) => cells.find((x) => x.stage === st && x.deck === d && x.crit === c && (!H || x.gameHash === H));
  const lines = [`game ${H}; cell = robust value [replicate minima; spread]`];
  for (const st of stages) { const parts = []; for (const d of DECKS) { const l = g(st, d, "lost1"), f = g(st, d, "full"); if (!l && !f) continue;
      const fmt = (x) => x ? `${x.value || x.valueJob}${x.source && /bound/.test(x.source) ? "*" : ""} [${x.reps.map((r) => r.min).join(",")}${x.spread !== null && x.spread !== undefined ? "; s" + x.spread : ""}]` : "-";
      parts.push(`${d}: ${fmt(l)} / ${fmt(f)}${f && f.fullFromLost1 ? " (lost1-0lost " + f.fullFromLost1 + ")" : ""}`); }
    if (parts.length) lines.push(`${st.padEnd(6)} | ${parts.join(" | ")}`); }
  return lines.join("\n") + "\n(* = lowered by a cross-deck bound)";
}
function noise(cells) {
  const sp = cells.filter((x) => x.nReps >= 2 && x.spread !== null && x.spread !== undefined); if (!sp.length) return "noise: fewer than 2 replicates per cell\n";
  const hist = {}; for (const x of sp) hist[x.spread] = (hist[x.spread] || 0) + 1; const mean = sp.reduce((a, x) => a + x.spread, 0) / sp.length;
  const byDeck = {}; for (const x of sp) (byDeck[x.deck] = byDeck[x.deck] || []).push(x.spread);
  return `noise: ${sp.length} cells with >= 2 replicates; spread histogram (rungs: cells) ${Object.entries(hist).map(([k, v]) => k + ":" + v).join(" ")}; mean ${mean.toFixed(2)}; max ${Math.max(...sp.map((x) => x.spread))}; ` +
    `by deck ${Object.entries(byDeck).map(([d, a]) => d + " " + (a.reduce((p, q) => p + q, 0) / a.length).toFixed(2)).join(", ")}; cells with a 'none' replicate: ${cells.filter((x) => x.nNone).length}\n`;
}

if (require.main === module) {
  const cmd = A._[0] || "collect";
  if (cmd === "collect") collect().catch((e) => { console.error(e); process.exit(1); });
  else if (cmd === "table") { const doc = R.readJSON(A.file || path.join(OUT, "latest.json"), { cells: [] }); const stages = E.stageRange(A.stages); console.log(table(doc.cells, stages, A.hash || R.GAMEHASH)); console.log(noise(doc.cells.filter((x) => stages.includes(x.stage) && x.gameHash === (A.hash || R.GAMEHASH)))); }
}
module.exports = { collect, table, noise };
