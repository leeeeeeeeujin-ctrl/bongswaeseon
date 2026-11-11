#!/usr/bin/env node
// solver v2: one table of every answer (deck searches and squad queries), the per-stage and overall rankings of squads, and the operator-balance report.
//   node rank.js            -> results/answers.json, results/ranking.json, results/report/operators.{json,md}
"use strict";
const fs = require("fs");
const path = require("path");
const R = require("./roles.js");
const E = require("./engine.js");
const { S, TD } = R;
const readJSON = R.readJSON;
const RUNGS = E.RUNGS;
const rungI = (lv) => lv ? RUNGS.indexOf(lv) : RUNGS.length + 2;   // no clear on the ladder ranks below the top rung

function answers() {
  const rows = [];
  const add = (x, source, kind) => { if (!x || !x.stage) return; const ops = x.plan ? [...new Set(x.plan.entries.map((q) => q.id))] : [];
    const [Ee] = x.min ? S.parseLv(x.min) : [0];
    rows.push({ source, kind, stage: x.stage, crit: x.crit, min: x.min || null, rung: rungI(x.min), done: !!x.done && !x.stale, stale: !!x.stale, worstLost: x.worstLost ?? null, winTime: x.winTime ? Math.round(x.winTime) : null,
      family: x.family ? x.family.id : null, tags: x.family ? x.family.tags : [], newFamily: !!(x.family && /^new:/.test(x.family.id)),
      ops: ops.map((id) => ({ id, sk: S.isSummon(id) ? "" : `S${((x.plan.skillIdx || {})[id] ?? S.maxSkillIdx(id, Ee)) + 1}` })),
      keys: (x.keyOps || []).filter((k) => k.key).map((k) => k.id), keyDone: !!x.keyOps, subs: (x.keyOps || []).filter((k) => k.key === false).map((k) => [k.id, k.replacedBy]),
      squad: x.squad || [], gameHash: x.gameHash, plan: x.plan || null, replay: x.replay || null, evals: x.evals, secs: x.secsTotal || x.secs }); };
  try { for (const f of fs.readdirSync(path.join(R.RESULTS, "jobs")).filter((f) => /__\w+__\w+\.json$/.test(f) && !f.includes("partial"))) { const x = readJSON(path.join(R.RESULTS, "jobs", f)); add(x, x.deck, "deck"); } } catch (e) { /* none */ }
  try { for (const q of fs.readdirSync(path.join(R.RESULTS, "queries"))) { const meta = readJSON(path.join(R.RESULTS, "queries", q, "query.json"), {}); for (const f of fs.readdirSync(path.join(R.RESULTS, "queries", q)).filter((f) => /^[A-Z]+-\d+__\w+\.json$/.test(f))) { const x = readJSON(path.join(R.RESULTS, "queries", q, f)); if (x) { x.replay = x.min ? `../queries/${q}/${f.replace(".json", ".replay.json")}` : null; add(x, q, "query"); } } } } catch (e) { /* none */ }
  return rows;
}
const better = (a, b) => a.rung - b.rung || (a.worstLost ?? 9) - (b.worstLost ?? 9) || (a.winTime ?? 1e9) - (b.winTime ?? 1e9);
function ranking(rows) {
  const per = {}; for (const r of rows.filter((r) => r.done)) { const k = r.stage + "|" + r.crit; (per[k] = per[k] || []).push(r); }
  const perStage = {}; for (const [k, a] of Object.entries(per)) perStage[k] = a.sort(better).map((r, i) => ({ rank: i + 1, source: r.source, kind: r.kind, min: r.min, worstLost: r.worstLost, winTime: r.winTime, family: r.family }));
  // overall: per squad and criterion, over the stages it was asked on: stages cleared, sum of rung indices (lower = better), lives lost at the minima
  const by = {}; for (const r of rows.filter((r) => r.done)) { const k = r.source + "|" + r.crit; const o = by[k] = by[k] || { source: r.source, kind: r.kind, crit: r.crit, stages: 0, cleared: 0, rungSum: 0, lostSum: 0, list: [] }; o.stages++; if (r.min) o.cleared++; o.rungSum += r.rung; o.lostSum += r.worstLost || 0; o.list.push(r.stage); }
  const overall = Object.values(by).map((o) => Object.assign(o, { meanRung: Math.round(o.rungSum / o.stages * 100) / 100 })).sort((a, b) => a.crit.localeCompare(b.crit) || b.stages - a.stages || a.meanRung - b.meanRung || a.lostSum - b.lostSum);
  return { generated: new Date().toISOString(), rungs: RUNGS, perStage, overall };
}
// operator balance: times key, times used, skills used, rung range; flags strong / unused operators and unused skills
function operatorReport(rows) {
  const ops = {}; for (const u of TD.UNITS) ops[u.id] = { id: u.id, name: u.name, cls: R.CLS[u.cls], sub: u.sub || "", rarity: u.rarity, used: 0, key: 0, keyChecked: 0, skills: {}, rungs: [], stages: new Set(), nSkills: (u.skills || [u.skill]).length };
  const done = rows.filter((r) => r.done && r.min);
  for (const r of done) { for (const o of r.ops) { const x = ops[o.id]; if (!x) continue; x.used++; x.skills[o.sk] = (x.skills[o.sk] || 0) + 1; x.rungs.push(r.rung); x.stages.add(r.stage); if (r.keyDone) x.keyChecked++; }
    for (const k of r.keys) if (ops[k]) ops[k].key++; }
  const list = Object.values(ops).map((x) => Object.assign(x, { stages: x.stages.size, rungRange: x.rungs.length ? [RUNGS[Math.min(...x.rungs)], RUNGS[Math.max(...x.rungs)]] : null, keyShare: x.keyChecked ? Math.round(x.key / x.keyChecked * 100) / 100 : null, useShare: done.length ? Math.round(x.used / done.length * 100) / 100 : 0 }));
  for (const x of list) { x.flags = []; if (x.used === 0) x.flags.push("unused"); if (x.keyShare !== null && x.keyChecked >= 4 && x.keyShare >= 0.5) x.flags.push("strong (key in half of its clears)"); if (x.useShare >= 0.6) x.flags.push("everywhere");
    for (let i = 0; i < x.nSkills; i++) if (x.used >= 3 && !x.skills["S" + (i + 1)]) x.flags.push(`S${i + 1} unused`); delete x.rungs; }
  return { generated: new Date().toISOString(), answers: done.length, operators: list.sort((a, b) => b.key - a.key || b.used - a.used) };
}
function reportMd(rep) {
  const L = ["# Operator balance report (solver v2)", "", `${rep.answers} answers (deck searches + squad queries, done, with a clear). key = a role-based re-search without the operator fails at the same rung.`, "",
    "| op | name | class | ★ | used | key | key share | skills used | rung range | stages | flags |", "|---|---|---|---|---|---|---|---|---|---|---|"];
  for (const x of rep.operators) L.push(`| ${x.id} | ${x.name} | ${x.cls}/${x.sub || "-"} | ${x.rarity} | ${x.used} | ${x.key} | ${x.keyShare ?? "-"} | ${Object.entries(x.skills).map(([k, n]) => k + "×" + n).join(" ") || "-"} | ${x.rungRange ? x.rungRange.join("–") : "-"} | ${x.stages} | ${x.flags.join("; ")} |`);
  return L.join("\n") + "\n";
}
function build() {
  const rows = answers(); const rk = ranking(rows); const rep = operatorReport(rows);
  R.writeJSON(path.join(R.RESULTS, "answers.json"), { generated: rk.generated, gameHash: R.GAMEHASH, rows: rows.map(({ plan, ...r }) => r) });
  R.writeJSON(path.join(R.RESULTS, "ranking.json"), rk);
  R.writeJSON(path.join(R.RESULTS, "report", "operators.json"), rep); fs.writeFileSync(path.join(R.RESULTS, "report", "operators.md"), reportMd(rep));
  return { rows, rk, rep };
}
module.exports = { answers, ranking, operatorReport, build };
if (require.main === module) { const { rows, rk, rep } = build(); console.log(`${rows.length} answers; ${Object.keys(rk.perStage).length} stage x criterion rankings; ${rk.overall.length} squads overall; operator report: ${rep.operators.filter((x) => x.flags.length).length} flagged`); }
