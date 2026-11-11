#!/usr/bin/env node
// solver v2: squad queries. For a squad, per stage: the lowest rung meeting the criterion, the least life lost there, the win time, the strategy family used, the key operators.
//   node query.js --squad "<ids>|owned:<file>|deck:<starter|T4|T5|T6>|filter:<spec>" [--filter <spec>] --stages IM-02..WL-09 --crit lost1|full|both
//        [--name NAME] [--workers 4] [--hours 5.5] [--refine 90] [--cdfams 4] [--keyops all|0|N] [--keysec 45] [--keybudget 600] [--verbose]
//   filter spec (';'-separated): rarity<=N | no6 | must=a+b | ex=a+b | cost<=N | quota=medic>=1+defender<=2 | cls=guard+sniper (only these classes) | max=12
//   Results: results/queries/<name>/<STAGE>__<crit>.json (+ query.json); rankings: node rank.js; sheet: node sheet3.js
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const E = require("./engine.js");
const R = require("./roles.js");
const G = require("./ga.js");
const { S, TD } = R;

const argv = process.argv.slice(2); const A = { _: [] }; for (let i = 0; i < argv.length; i++) { const s = argv[i]; if (s.startsWith("--")) { const n = argv[i + 1]; if (n === undefined || n.startsWith("--")) A[s.slice(2)] = true; else { A[s.slice(2)] = n; i++; } } else A._.push(s); }
const T0 = Date.now();
const DECKS = () => ({ starter: S.starterParty(), T4: R.ALL.filter((id) => S.def(id).rarity <= 4), T5: R.ALL.filter((id) => S.def(id).rarity <= 5), T6: R.ALL.slice() });

// ---- squad specs ----
function parseOwned(file) {
  const txt = fs.readFileSync(file, "utf8"); let o; try { o = JSON.parse(txt); } catch (e) { return txt.split(/[\s,]+/).filter(Boolean); }
  if (Array.isArray(o)) return o.map((x) => typeof x === "string" ? x : x.id);
  if (o.ops) return Object.keys(o.ops); if (o.squad) return o.squad; return Object.keys(o);
}
function applyFilter(ids, spec, cons) {
  for (const part of spec.split(/[;&]/).map((s) => s.trim()).filter(Boolean)) {
    let m;
    if ((m = /^rarity<=(\d)$/.exec(part))) ids = ids.filter((id) => S.def(id).rarity <= +m[1]);
    else if (part === "no6") ids = ids.filter((id) => S.def(id).rarity < 6);
    else if ((m = /^must=(.+)$/.exec(part))) { cons.must = (cons.must || []).concat(m[1].split("+")); for (const id of m[1].split("+")) if (!ids.includes(id)) ids.push(id); }
    else if ((m = /^ex=(.+)$/.exec(part))) { const ex = new Set(m[1].split("+")); ids = ids.filter((id) => !ex.has(id)); }
    else if ((m = /^cost<=(\d+)$/.exec(part))) ids = ids.filter((id) => S.def(id).cost <= +m[1]);
    else if ((m = /^cls=(.+)$/.exec(part))) { const c = new Set(m[1].split("+")); ids = ids.filter((id) => c.has(R.CLS[S.def(id).cls])); }
    else if ((m = /^quota=(.+)$/.exec(part))) { cons.quota = cons.quota || {}; for (const q of m[1].split("+")) { const mm = /^(\w+)(<=|>=)(\d+)$/.exec(q); if (!mm) throw new Error("bad quota " + q); const e = cons.quota[mm[1]] = cons.quota[mm[1]] || {}; e[mm[2] === "<=" ? "max" : "min"] = +mm[3]; } }
    else throw new Error("unknown filter term: " + part);
  }
  return ids;
}
function parseSquad(spec, extraFilter) {
  const cons = {}; let ids;
  if (!spec || spec.startsWith("filter:")) ids = R.ALL.slice();
  else if (spec.startsWith("owned:")) ids = parseOwned(spec.slice(6));
  else if (spec.startsWith("deck:")) ids = DECKS()[spec.slice(5)].slice();
  else ids = spec.split(/[,\s]+/).filter(Boolean);
  if (spec && spec.startsWith("filter:")) ids = applyFilter(ids, spec.slice(7), cons);
  if (extraFilter) ids = applyFilter(ids, extraFilter, cons);
  const bad = ids.filter((id) => !S.def(id)); if (bad.length) throw new Error("unknown operators: " + bad.join(","));
  return { ids: [...new Set(ids)], cons };
}
const qidOf = (ids, cons) => crypto.createHash("md5").update(ids.slice().sort().join(",") + JSON.stringify(cons)).digest("hex").slice(0, 10);

async function main() {
  const { ids, cons } = parseSquad(A.squad, A.filter);
  const name = (A.name || ("q-" + qidOf(ids, cons))).replace(/[^\w.-]/g, "_");
  const dir = path.join(R.RESULTS, "queries", name); fs.mkdirSync(dir, { recursive: true });
  const stages = E.stageRange(A.stages || "IM-02..WL-09"); const crits = (A.crit || "lost1") === "both" ? ["lost1", "full"] : [A.crit || "lost1"];
  R.writeJSON(path.join(dir, "query.json"), { name, spec: A.squad || null, filter: A.filter || null, squad: ids, constraints: cons, gameHash: R.GAMEHASH, created: new Date().toISOString() });
  const nW = Math.max(1, +(A.workers || 4)); const pool = new G.Pool(nW); await pool.started;
  const deadline = T0 + (+(A.hours || 5.5)) * 3600e3;
  const log = (s) => { const line = `${new Date().toISOString()} ${s}`; console.log(line); fs.appendFileSync(path.join(dir, "progress.log"), line + "\n"); };
  E.LOGS.groups = path.join(R.RESULTS, "surrogate", `groups_${name}_${process.pid}.jsonl`); fs.mkdirSync(path.dirname(E.LOGS.groups), { recursive: true });
  log(`=== query ${name}: ${ids.length} operators (${ids.join(",")}) constraints ${JSON.stringify(cons)} | stages ${stages.join(",")} | ${crits.join("+")} | game ${R.GAMEHASH} | workers ${nW}`);
  const opt = { refineSec: +(A.refine || 90), cdFams: A.cdfams || 4, passes: +(A.passes || 2), polish: +(A.polish || 20), verbose: !!A.verbose, must: cons.must, quota: cons.quota, deadline, log, label: name, memoTag: "q_" + name, famSource: A.nofam ? null : "q_" + name, deckName: name };
  try {
    for (const st of stages) {
      const memo = new E.Memo(path.join(R.RESULTS, "memo"), st, "q_" + name);
      let loFull;
      for (const crit of crits) {
        const f = path.join(dir, `${st}__${crit}.json`); const prev = R.readJSON(f, null);
        if (prev && prev.done && prev.gameHash === R.GAMEHASH && !A.force) { log(`  ${st} ${crit}: stored ${prev.min || "none"}`); if (crit === "lost1" && prev.min) loFull = E.RUNGS.indexOf(prev.min); continue; }
        if (Date.now() > deadline - 60e3) { log("time limit: stopping (rerun the same command to resume)"); break; }
        const t = Date.now();
        const lad = await E.ladder(pool, st, ids, crit, Object.assign({}, opt, { memo, lo: crit === "full" && loFull !== undefined ? loFull : undefined, start: A.start ? E.RUNGS.indexOf(A.start) : undefined }));
        if (crit === "lost1" && lad.min) loFull = E.RUNGS.indexOf(lad.min);
        const out = Object.assign({ name, stage: st, crit, squad: ids, constraints: cons, gameHash: R.GAMEHASH, done: !lad.cut, finished: new Date().toISOString() }, lad);
        // key operators (role-based re-search, separate budget)
        const kmode = A.keyops === undefined ? "all" : String(A.keyops);
        if (lad.min && !lad.cut && kmode !== "0") {
          const kd = Math.min(deadline, Date.now() + (+(A.keybudget || 600)) * 1000);
          const k = await E.keyOps(pool, st, lad.min, ids, { plan: lad.plan }, crit, Object.assign({}, opt, { memo, deadline: kd, keySec: +(A.keysec || 45) }));
          out.keyOps = k.ops; out.keySecs = k.secs;
        }
        out.secsTotal = Math.round((Date.now() - t) / 1000);
        R.writeJSON(f, out);
        if (lad.min) require("./replay2.js").writeFromResult(path.join(dir, `${st}__${crit}.replay.json`), out);
        log(`DONE ${st} ${crit}: min ${lad.min || "none"} worst lost ${lad.worstLost ?? "-"} win ${lad.winTime ? Math.round(lad.winTime) + "s" : "-"} family ${lad.family ? lad.family.id + " [" + lad.family.tags.join(", ") + "]" : "-"} key ${(out.keyOps || []).filter((k) => k.key).map((k) => k.id).join(",") || "-"} | ${lad.evals} evals ${out.secsTotal}s`);
        memo.flush();
      }
    }
  } finally { pool.close(); }
  log(`=== stop after ${((Date.now() - T0) / 60e3).toFixed(1)} min`);
}
module.exports = { parseSquad, applyFilter, DECKS, qidOf };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
