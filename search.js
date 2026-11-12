#!/usr/bin/env node
// solver v2: the deck search (the v1 queue's job: stage x deck x criterion -> lowest rung), on the role-decomposed engine, resumable, time-limited.
//   node search.js run --stages IM-02..WL-09 --decks starter,T4,T5,T6 --crit lost1,full [--hours 5.4] [--workers 4] [--refine 150] [--keysec 60] [--keybudget 900]
//   node search.js verify [--stages ..] [--decks ..] [--order impact.json]   replay stored solutions on the current game (5 seeds); a solution that no longer meets
//                                                       its criterion is reopened (its probes are dropped); order = the impact screening's, else stage order
//   node search.js recheck [--stages ..] [--decks ..]   a second, independent search (fresh dice, double budget) at the rung just below each minimum; a clear lowers it
//   node search.js status
//   --rep K (run): replicate K of each cell, an independent search (its own dice seed; K >= 1 also starts from a seeded subset of the stored families). Files go to
//              results/jobs/rep/<STAGE>__<deck>__<crit>__rK.json and results/replays/rep/; robust.js collect takes the minimum over replicates (and the spread).
// State: results/jobs/<STAGE>__<deck>__<crit>.json (answer), .partial.json (probes so far), results/replays/<STAGE>_<deck>_<crit>.json, results/memo, results/families.
"use strict";
// a run listed on ci/skip_runs.txt (one that cannot be cancelled with this token) does nothing: its queued jobs end at once and upload nothing
{ const rid = process.env.GITHUB_RUN_ID; let skip = []; try { skip = require("fs").readFileSync(require("path").join(__dirname, "ci", "skip_runs.txt"), "utf8").split(/\s+/).filter(Boolean); } catch (e) { /* none */ }
  if (rid && skip.includes(rid)) { console.log("run " + rid + " is on ci/skip_runs.txt: nothing to do"); process.exit(0); } }
const fs = require("fs");
const path = require("path");
const E = require("./engine.js");
const R = require("./roles.js");
const G = require("./ga.js");
const Q = require("./query.js");
const { S } = R;
const argv = process.argv.slice(2); const A = { _: [] }; for (let i = 0; i < argv.length; i++) { const s = argv[i]; if (s.startsWith("--")) { const n = argv[i + 1]; if (n === undefined || n.startsWith("--")) A[s.slice(2)] = true; else { A[s.slice(2)] = n; i++; } } else A._.push(s); }
const T0 = Date.now();
const REPK = A.rep !== undefined && A.rep !== true && A.rep !== "" ? (+A.rep | 0) : null;
const JOBS0 = path.join(R.RESULTS, "jobs"), REP0 = path.join(R.RESULTS, "replays");
const JOBS = REPK === null ? JOBS0 : path.join(JOBS0, "rep"), REP = REPK === null ? REP0 : path.join(REP0, "rep"); fs.mkdirSync(JOBS, { recursive: true }); fs.mkdirSync(REP, { recursive: true });
const RSUF = REPK === null ? "" : `__r${REPK}`;
const LOGF = path.join(R.RESULTS, "logs", `search_${(A.stages || "all").replace(/[^\w.-]/g, "_")}_${(A.decks || "all").replace(/[^\w,]/g, "")}${REPK === null ? "" : "_r" + REPK}.log`); fs.mkdirSync(path.dirname(LOGF), { recursive: true });
const log = (s) => { const line = `${new Date().toISOString()} ${s}`; console.log(line); fs.appendFileSync(LOGF, line + "\n"); };
const DECKS = Q.DECKS();
const jid = (st, d, c) => `${st}__${d}__${c}`;
const jf = (st, d, c) => path.join(JOBS, jid(st, d, c) + RSUF + ".json"), pf = (st, d, c) => path.join(JOBS, jid(st, d, c) + RSUF + ".partial.json");
const cjf = (st, d, c) => path.join(JOBS0, jid(st, d, c) + ".json");   // the canonical (aggregated) answer
const slimProbe = (r) => { const { harvest, ...x } = r; return x; };
const stages = E.stageRange(A.stages), decks = (A.decks || "starter,T4,T5,T6").split(","), crits = (A.crit || "lost1,full").split(",");
const SUBSETS = { starter: [], T4: [], T5: ["starter", "T4"], T6: ["T5", "T4", "starter"], AKstart: [], AK4: ["AKstart"] };   // a bigger deck's minimum is at most a contained deck's (a guess for where to start)

async function runJob(pool, st, deck, crit, deadline, memo) {
  const done = R.readJSON(jf(st, deck, crit), null); if (done && done.done && done.gameHash === R.GAMEHASH && !A.force) return "stored";
  const part = R.readJSON(pf(st, deck, crit), { probes: {} }); const known = Object.fromEntries(Object.entries(part.probes || {}).filter(([, r]) => r.gameHash === R.GAMEHASH));
  const squad = DECKS[deck];
  // bounds and a start: full block cannot be below lost1's minimum; contained decks' minima suggest where to look first
  let lo; if (crit === "full") { const x = R.readJSON(jf(st, deck, "lost1"), null); if (x && x.done && x.gameHash === R.GAMEHASH) lo = x.min ? E.RUNGS.indexOf(x.min) : E.RUNGS.length - 1; }
  let start; for (const d of [deck, ...SUBSETS[deck]]) for (const x of [R.readJSON(jf(st, d, crit), null), REPK === null ? null : R.readJSON(cjf(st, d, crit), null)]) { if (x && x.min && x.gameHash === R.GAMEHASH) { const i = E.RUNGS.indexOf(x.min); start = start === undefined ? i : Math.min(start, i); } }
  const rs = REPK === null ? {} : { rngSeed: E.strSeed(`${st}|${deck}|${crit}|r${REPK}|${R.GAMEHASH}`), famSeed: REPK >= 1 ? E.strSeed(`fam|${st}|${deck}|r${REPK}`) : undefined, famFrac: 0.6 };
  const opt = { refineSec: +(A.refine || 150), cdFams: A.cdfams || "all", passes: 2, polish: +(A.polish || 25), deadline, log, label: deck + (REPK === null ? "" : " r" + REPK), memo, famSource: "s_" + deck + (REPK === null ? "" : "_r" + REPK), deckName: deck, known, lo, start, ...rs,
    onProbe: (lv, r) => { part.probes[lv] = slimProbe(r); R.writeJSON(pf(st, deck, crit), part); } };
  const t = Date.now(); log(`JOB ${jid(st, deck, crit)}`);
  const lad = await E.ladder(pool, st, squad, crit, opt);
  if (lad.cut) { log(`  ${jid(st, deck, crit)}: time limit inside the job; probes kept (resume with the same command)`); return "cut"; }
  const out = Object.assign({ stage: st, deck, crit, need: E.CRIT[crit], gameHash: R.GAMEHASH, done: true, finished: new Date().toISOString(), squad: lad.squadUsed || squad }, REPK === null ? {} : { rep: REPK, rngSeed: rs.rngSeed, famSeed: rs.famSeed ?? null }, lad);
  if (lad.min) {
    const kd = Math.min(deadline, Date.now() + (+(A.keybudget || 900)) * 1000);
    if (!A.nokeyops) { const k = await E.keyOps(pool, st, lad.min, squad, { plan: lad.plan }, crit, Object.assign({}, opt, { deadline: kd, keySec: +(A.keysec || 60), famSource: null, known: null, onProbe: null })); out.keyOps = k.ops; out.keySecs = k.secs; }
    const rpn = `${st}_${deck}_${crit}${REPK === null ? "" : "_r" + REPK}.json`; const rp = require("./replay2.js").writeFromResult(path.join(REP, rpn), Object.assign({}, out, { name: deck })); out.replay = (REPK === null ? "" : "rep/") + rpn; out.replayLost = rp.lost;
  }
  out.secsTotal = Math.round((Date.now() - t) / 1000);
  R.writeJSON(jf(st, deck, crit), out);
  log(`DONE ${jid(st, deck, crit)}: min ${lad.min || "none"} worst lost ${lad.worstLost ?? "-"} family ${lad.family ? lad.family.id + " [" + lad.family.tags.join(", ") + "]" : "-"} key ${(out.keyOps || []).filter((k) => k.key).map((k) => k.id).join(",") || "-"} | ${lad.evals} evals ${out.secsTotal}s`);
  return "done";
}

async function main() {
  const cmd = A._[0] || "run";
  if (cmd === "status") { let d = 0, n = 0; for (const st of stages) for (const dk of decks) for (const c of crits) { n++; const x = R.readJSON(jf(st, dk, c), null); const ok = x && x.done && x.gameHash === R.GAMEHASH; if (ok) d++;
      const p = R.readJSON(pf(st, dk, c), null); console.log(`${jid(st, dk, c).padEnd(22)} ${ok ? "done " + (x.min || "none") + (x.keyOps ? "" : " (no key ops)") : x && x.stale ? "STALE" : p ? "partial " + Object.keys(p.probes).join(",") : "pending"}`); }
    console.log(`${d}/${n} done; game ${R.GAMEHASH}`); return; }
  const nW = Math.max(1, +(A.workers || 4)); const pool = new G.Pool(nW); await pool.started;
  const deadline = T0 + (+(A.hours || 5.4)) * 3600e3;
  log(`=== search ${cmd} | game ${R.GAMEHASH} | workers ${nW} | ${A.hours || 5.4} h | ${stages.join(",")} x ${decks.join(",")} x ${crits.join(",")}${REPK === null ? "" : " | replicate " + REPK}`);
  E.LOGS.groups = path.join(R.RESULTS, "surrogate", `groups_search_${stages.join("_")}_${process.pid}.jsonl`); fs.mkdirSync(path.dirname(E.LOGS.groups), { recursive: true });
  try {
    if (cmd === "run") {
      for (const st of stages) { const memo = new E.Memo(path.join(R.RESULTS, "memo"), st, "s_" + decks.join("") + RSUF); try {
        for (const dk of decks) for (const c of crits) { if (Date.now() > deadline - 90e3) { log("time limit reached; stopping (resume with the same command)"); return; } await runJob(pool, st, dk, c, deadline, memo); } } finally { memo.flush(); } }
    } else if (cmd === "verify") {
      let list = []; for (const st of stages) for (const dk of decks) for (const c of crits) { const x = R.readJSON(jf(st, dk, c), null); if (x && x.done && x.min) list.push(x); }
      if (A.order) { const imp = R.readJSON(A.order, { order: [] }); const pr = new Map(imp.order.map((r, i) => [r.key.replace(/^v2:/, ""), i])); list.sort((a, b) => (pr.get(jid(a.stage, a.deck, a.crit)) ?? 1e9) - (pr.get(jid(b.stage, b.deck, b.crit)) ?? 1e9)); }
      for (const x of list) { if (x.gameHash === R.GAMEHASH && !A.force) continue; if (Date.now() > deadline - 60e3) break;
        const sq = E.formation(x.squad, x.plan); const rs = await pool.all([1, 2, 3, 4, 5].map((sd) => ({ code: x.stage, lvl: x.min, plan: x.plan, opt: { seed: sd, squadIds: sq, sameRung: true } })));
        const worst = Math.max(...rs.map((r) => r.lost)), ok = rs.every((r) => r.complete) && worst <= E.CRIT[x.crit];
        if (ok) { const prev = x.gameHash; x.gameHash = R.GAMEHASH; x.verified = new Date().toISOString(); x.worstLost = worst; if (prev !== R.GAMEHASH) delete x.keyOps; R.writeJSON(jf(x.stage, x.deck, x.crit), x); require("./replay2.js").writeFromResult(path.join(REP, `${x.stage}_${x.deck}_${x.crit}.json`), Object.assign({}, x, { name: x.deck })); log(`VERIFY ${jid(x.stage, x.deck, x.crit)} @${x.min}: still clears (worst lost ${worst})`); }
        else { x.stale = true; x.done = false; x.staleResult = rs.map((r) => r.lost); R.writeJSON(jf(x.stage, x.deck, x.crit), x); try { fs.unlinkSync(pf(x.stage, x.deck, x.crit)); } catch (e) { /* none */ } log(`VERIFY ${jid(x.stage, x.deck, x.crit)} @${x.min}: NO LONGER CLEARS (lost ${x.staleResult.join(" ")}); reopened`); }
      }
    } else if (cmd === "recheck") {
      for (const st of stages) { const memo = new E.Memo(path.join(R.RESULTS, "memo"), st, "s_" + decks.join("")); for (const dk of decks) for (const c of crits) {
          const x = R.readJSON(jf(st, dk, c), null); if (!x || !x.done || !x.min || x.gameHash !== R.GAMEHASH) continue; let i = E.RUNGS.indexOf(x.min);
          while (i > 0 && Date.now() < deadline - 120e3) { const lv = E.RUNGS[i - 1]; const r = await E.squadSolve(pool, st, lv, DECKS[dk], { critLost: E.CRIT[c], memo, refineSec: 2 * +(A.refine || 150), cdFams: "all", rngSeed: Date.now() & 0xffff, famSource: "s_" + dk, deckName: dk, crit: c, deadline });
            log(`RECHECK ${jid(st, dk, c)} ${lv}: ${r.cleared ? "CLEAR (minimum lowered)" : "miss (minimum confirmed)"} worst lost ${r.worstLost ?? "-"} | ${r.evals} evals ${r.secs}s`);
            x.recheck = Object.assign(x.recheck || {}, { [lv]: { cleared: r.cleared, worstLost: r.worstLost, at: new Date().toISOString() } });
            if (!r.cleared) break; Object.assign(x, { min: lv, plan: r.plan, worstLost: r.worstLost, winTime: r.winTime, family: r.family, lives: r.lives, actions: r.actions }); delete x.keyOps; i--; }
          R.writeJSON(jf(st, dk, c), x); } memo.flush(); }
    }
  } finally { pool.close(); log(`=== stop after ${((Date.now() - T0) / 60e3).toFixed(1)} min`); }
}
if (require.main === module) main().catch((e) => { log("FATAL " + (e && e.stack || e)); process.exit(1); });
