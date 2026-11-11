#!/usr/bin/env node
// solver v2: impact screening after a game change (number changes, a new operator). Which stored solutions are likely affected, in what order to re-verify them,
// and which stage x deck cells a new operator could improve (re-search first).
//   node impact.js --old <gameDir> --new <gameDir> [--sources v1,v2,queries] [--out results/impact/<old>_<new>.json]
//   node impact.js --old game_v1 --new game --check     also replay every stored solution on the new game (5 seeds) and score the screening against the truth
// How: (1) the two engines' unit/enemy/stage tables are diffed field by field (and new unit ids listed); (2) every stored solution is featurized under each version
// and the surrogate's prediction compared; (3) priority = touched by a changed field (its operators, or its stage's enemies) first, by |predicted change|;
// (4) for each new operator, each stage family is filled with it forced into its best role slot and the predicted gain over the stored best is reported.
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = __dirname;
const argv = process.argv.slice(2); const A = { _: [] }; for (let i = 0; i < argv.length; i++) { const s = argv[i]; if (s.startsWith("--")) { const n = argv[i + 1]; if (n === undefined || n.startsWith("--")) A[s.slice(2)] = true; else { A[s.slice(2)] = n; i++; } } else A._.push(s); }
const abs = (p) => path.isAbsolute(p) ? p : path.join(ROOT, p);
const RESULTS = process.env.SOLVER_RESULTS || path.join(ROOT, "results");
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return d; } };

// ---- child mode: run under one game version ----
if (A.emit) {
  const R = require("./roles.js"); const SG = require("./surrogate.js"); const F = require("./families.js"); const { S, TD } = R;
  const strip = (o, depth = 0) => { if (o === null || typeof o !== "object") return typeof o === "function" ? "<fn>" : o; if (depth > 6) return "<deep>"; if (Array.isArray(o)) return o.map((v) => strip(v, depth + 1)); const r = {}; for (const k of Object.keys(o)) { if (["kf", "ak", "akPot"].includes(k)) { r[k] = JSON.stringify(o[k]); continue; } r[k] = strip(o[k], depth + 1); } return r; };
  const out = { hash: R.GAMEHASH, units: {}, enemies: {}, stages: {}, cfg: strip(TD.CFG) };
  for (const u of TD.UNITS) out.units[u.id] = strip(u); for (const [k, e] of Object.entries(TD.ENEMIES)) out.enemies[k] = strip(e);
  for (const st of TD.STAGES) if (st.code) out.stages[st.code] = { waves: JSON.stringify(st.waves), mul: JSON.stringify(st.mul || null), enemyTypes: [...new Set((st.waves || []).map((w) => w[1]).filter((x) => typeof x === "string"))] };
  const sols = readJSON(A.emit, []); const model = SG.loadModel(A.model ? abs(A.model) : undefined);
  out.pred = sols.map((s) => { try { const ok = s.plan.entries.every((q) => R.defAny(q.id)); if (!ok) return null; const ctx = R.stageCtx(s.stage, s.lvl); const x = SG.featurize(s.stage, s.lvl, s.plan, ctx, F.loadFamilies(s.stage)); const p = SG.predict(model, s.stage, x); return p ? { bad: p.lost, pw: p.pw } : { bad: null, pw: null }; } catch (e) { return { err: String(e.message) }; } });
  // new-operator fills: for each requested op, each stage's families with it forced into its best slot
  if (A.newops) { out.newFills = {}; const ops = A.newops.split(",").filter((id) => R.defAny(id));
    for (const id of ops) { out.newFills[id] = {}; for (const st of [...new Set(sols.map((s) => s.stage))]) { const lvls = [...new Set(sols.filter((s) => s.stage === st).map((s) => s.lvl))]; const best = [];
        for (const lvl of lvls) { const ctx = R.stageCtx(st, lvl); const fams = F.loadFamilies(st); for (const f of fams) { const c = R.candidates(f.T, [id], lvl, ctx, 2); const slot = Object.entries(c).filter(([, a]) => a.length).sort((a, b) => a[1][0].tier - b[1][0].tier)[0]; if (!slot) continue;
            const pool = R.ALL.filter((u) => u !== id); const { assigns } = R.fillGreedy(f.T, pool.concat([id]), lvl, ctx, { force: { [slot[0]]: id } }); const plan = R.fillPlan(f.T, assigns[0], lvl);
            const p = SG.predict(model, st, SG.featurize(st, lvl, plan, ctx, fams)); if (p) best.push({ lvl, fam: f.id, slot: +slot[0], role: f.T.slots[slot[0]].role.kind, bad: p.lost, pw: p.pw }); } }
        out.newFills[id][st] = best.sort((a, b) => a.bad - b.bad).slice(0, 3); } } }
  fs.writeFileSync(A.out, JSON.stringify(out)); process.exit(0);
}

// ---- parent ----
function solutions(sources) {
  const out = []; const want = new Set(sources.split(","));
  const S = require("./sim.js");
  if (want.has("v1")) { const dir = path.join(ROOT, "data", "v1_state"); for (const f of fs.readdirSync(path.join(dir, "jobs"))) { const j = readJSON(path.join(dir, "jobs", f)); if (!j || !j.min) continue; const L = readJSON(path.join(dir, "levels", `${j.stage}__${j.deck}.json`), { levels: {} }); const e = L.levels[j.min]; if (!e || !e.plan) continue;
      out.push({ key: `v1:${j.stage}__${j.deck}__${j.crit}`, stage: j.stage, deck: j.deck, crit: j.crit, lvl: j.min, plan: e.plan, squad: e.squad || null, src: "v1" }); } }
  if (want.has("v2")) { try { for (const f of fs.readdirSync(path.join(RESULTS, "jobs"))) { const j = readJSON(path.join(RESULTS, "jobs", f)); if (j && j.min && j.plan) out.push({ key: `v2:${j.stage}__${j.deck}__${j.crit}`, stage: j.stage, deck: j.deck, crit: j.crit, lvl: j.min, plan: j.plan, squad: j.squad, src: "v2" }); } } catch (e) { /* none */ } }
  if (want.has("queries")) { try { for (const q of fs.readdirSync(path.join(RESULTS, "queries"))) for (const f of fs.readdirSync(path.join(RESULTS, "queries", q)).filter((f) => /^[A-Z]+-\d+__\w+\.json$/.test(f))) { const j = readJSON(path.join(RESULTS, "queries", q, f)); if (j && j.min && j.plan) out.push({ key: `q:${q}:${j.stage}__${j.crit}`, stage: j.stage, deck: q, crit: j.crit, lvl: j.min, plan: j.plan, squad: j.squad, src: "query" }); } } catch (e) { /* none */ } }
  return out;
}
function diffTables(a, b) {
  const ch = [];
  const walk = (pa, x, y, pre) => { if (JSON.stringify(x) === JSON.stringify(y)) return; if (x && y && typeof x === "object" && typeof y === "object" && !Array.isArray(x)) { for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) walk(pa, x[k], y[k], pre ? pre + "." + k : k); return; } ch.push({ path: pa + (pre ? "." + pre : ""), old: x, new: y }); };
  for (const id of new Set([...Object.keys(a.units), ...Object.keys(b.units)])) { if (!a.units[id]) { ch.push({ path: `unit:${id}`, old: null, new: "(new operator)", newUnit: id }); continue; } if (!b.units[id]) { ch.push({ path: `unit:${id}`, old: "(present)", new: null }); continue; } walk(`unit:${id}`, a.units[id], b.units[id], ""); }
  for (const id of new Set([...Object.keys(a.enemies), ...Object.keys(b.enemies)])) walk(`enemy:${id}`, a.enemies[id], b.enemies[id], "");
  for (const id of new Set([...Object.keys(a.stages), ...Object.keys(b.stages)])) walk(`stage:${id}`, a.stages[id], b.stages[id], "");
  walk("cfg", a.cfg, b.cfg, "");
  return ch.filter((c) => !/\.(desc|name|nameEn|info|art|chibi|col|glyph|iconAs)$/.test(c.path));
}
async function main() {
  const oldDir = abs(A.old || "game_v1"), newDir = abs(A.new || "game"); const sols = solutions(A.sources || "v1,v2,queries");
  const tmp = path.join(RESULTS, "cache"); fs.mkdirSync(tmp, { recursive: true }); const sf = path.join(tmp, `impact_sols_${process.pid}.json`); fs.writeFileSync(sf, JSON.stringify(sols));
  const run = (dir, tag) => { const of = path.join(tmp, `impact_${tag}_${process.pid}.json`); execFileSync(process.execPath, [__filename, "--emit", sf, "--out", of].concat(A.model ? ["--model", A.model] : []).concat(tag === "new" && A.newops ? ["--newops", A.newops] : []).concat(tag === "new" && !A.newops ? ["--newops", "__auto__"] : []), { env: Object.assign({}, process.env, { SOLVER_GAME_DIR: dir }), stdio: ["ignore", "inherit", "inherit"], maxBuffer: 1 << 28 }); return readJSON(of); };
  const a = run(oldDir, "old"); let b = run(newDir, "new");
  const changes = diffTables(a, b); const newUnits = changes.filter((c) => c.newUnit).map((c) => c.newUnit);
  if (newUnits.length && !A.newops) { A.newops = newUnits.join(","); b = run(newDir, "new"); }
  const touchedUnits = new Set(changes.filter((c) => c.path.startsWith("unit:")).map((c) => c.path.split(/[:.]/)[1]));
  const touchedEnemies = new Set(changes.filter((c) => c.path.startsWith("enemy:")).map((c) => c.path.split(/[:.]/)[1]));
  const touchedStages = new Set(changes.filter((c) => c.path.startsWith("stage:")).map((c) => c.path.split(/[:.]/)[1]));
  const cfgChanged = changes.some((c) => c.path.startsWith("cfg"));
  const rows = sols.map((s, i) => { const ops = [...new Set(s.plan.entries.map((q) => q.id))]; const hit = ops.filter((id) => touchedUnits.has(id));
    const pa = a.pred[i], pb = b.pred[i]; const d = pa && pb && pa.bad !== null && pb.bad !== null ? pb.bad - pa.bad : null; const dw = pa && pb && pa.pw !== null && pb.pw !== null ? pb.pw - pa.pw : null;
    const stageHit = touchedStages.has(s.stage); const touched = hit.length > 0 || stageHit || cfgChanged;
    return { key: s.key, stage: s.stage, deck: s.deck, crit: s.crit, lvl: s.lvl, touched, changedOps: hit, stageChanged: stageHit, dBad: d === null ? null : Math.round(d * 1000) / 1000, dWin: dw === null ? null : Math.round(dw * 1000) / 1000, predOld: pa, predNew: pb,
      priority: (touched ? 10 : 0) + (d === null ? 0 : Math.max(0, d)) * 2 + (dw === null ? 0 : Math.max(0, -dw)) * 3 + hit.length * 0.2 }; });
  rows.sort((x, y) => y.priority - x.priority);
  // a new operator: per stage, its best forced fill vs the stored answers (of the decks that would contain it) -> the predicted gain; re-search the biggest gains first
  const reSearch = [];
  for (const [op, per] of Object.entries(b.newFills || {})) { const r = (b.units[op] || {}).rarity || 6; const decks = ["starter", "T4", "T5", "T6"].filter((d) => d === "T6" || (d === "T5" && r <= 5) || (d === "T4" && r <= 4));
    for (const [st, fills] of Object.entries(per)) { if (!fills.length) continue; for (const d of decks) { const stored = rows.filter((x) => x.stage === st && x.deck === d && x.predNew && x.predNew.bad !== null).map((x) => x.predNew.bad);
        const base = stored.length ? Math.min(...stored) : null; reSearch.push({ op, stage: st, deck: d, fill: fills[0], storedBad: base, gain: base === null ? null : Math.round((base - fills[0].bad) * 1000) / 1000 }); } } }
  reSearch.sort((x, y) => (y.gain ?? 99) - (x.gain ?? 99));
  const out = { old: { dir: oldDir, hash: a.hash }, new: { dir: newDir, hash: b.hash }, newOperatorReSearch: reSearch, generated: new Date().toISOString(), changes, newUnits, touchedUnits: [...touchedUnits], touchedEnemies: [...touchedEnemies], order: rows, newOperatorFills: b.newFills || null };
  // --check: replay every solution on the new game (5 seeds) and see how well the order puts the broken ones first
  if (A.check) {
    process.env.SOLVER_GAME_DIR = newDir; const G = require("./ga.js"); const S = require("./sim.js"); const pool = new G.Pool(+(A.workers || 2)); await pool.started;
    try { for (const r of rows) { const s = sols.find((x) => x.key === r.key); const squad = s.deck === "starter" && s.src === "v1" ? S.starterParty() : (s.squad || S.squadIdsOf(s.plan)); /* v1 starter mode: the whole party is the formation */ const lim = s.crit === "full" ? 0 : 1;
        const rs = await pool.all([1, 2, 3, 4, 5].map((sd) => ({ code: s.stage, lvl: s.lvl, plan: s.plan, opt: { seed: sd, squadIds: squad, sameRung: !(s.deck === "starter" && s.src === "v1") } })));
        r.truth = { lost: rs.map((x) => x.lost), holds: rs.every((x) => x.complete && x.lost <= lim) }; } } finally { pool.close(); }
    const broken = rows.filter((r) => r.truth && !r.truth.holds).length; let found = 0; const curve = [];
    rows.forEach((r, i) => { if (r.truth && !r.truth.holds) found++; if ([0.1, 0.25, 0.5].some((f) => i + 1 === Math.ceil(rows.length * f))) curve.push({ share: Math.round((i + 1) / rows.length * 100) + "%", brokenFound: found, of: broken }); });
    const S2 = require("./surrogate.js"); const withD = rows.filter((r) => r.dBad !== null && r.truth);
    out.check = { solutions: rows.length, broken, curve, touchedBroken: rows.filter((r) => r.touched && !r.truth.holds).length, untouchedBroken: rows.filter((r) => !r.touched && !r.truth.holds).length,
      spearmanDeltaVsNewLost: withD.length > 3 ? Math.round(S2.spearman(withD.map((r) => r.dBad), withD.map((r) => r.truth.lost.reduce((x, y) => x + y, 0))) * 1000) / 1000 : null };
  }
  const of = A.out ? abs(A.out) : path.join(RESULTS, "impact", `${a.hash}_${b.hash}.json`); fs.mkdirSync(path.dirname(of), { recursive: true }); fs.writeFileSync(of, JSON.stringify(out, null, 1));
  console.log(`changes: ${changes.length} fields (${touchedUnits.size} units, ${touchedEnemies.size} enemies, ${touchedStages.size} stages${cfgChanged ? ", cfg" : ""})${newUnits.length ? "; new operators " + newUnits.join(",") : ""}`);
  console.log(`solutions: ${rows.length}; touched ${rows.filter((r) => r.touched).length}; re-verify order (top 15):`); for (const r of rows.slice(0, 15)) console.log(`  ${r.key.padEnd(28)} ${r.lvl} prio ${r.priority.toFixed(2)} dBad ${r.dBad} dWin ${r.dWin} ops ${r.changedOps.join(",")}${r.truth ? " | truth " + (r.truth.holds ? "holds" : "BROKEN") + " " + r.truth.lost.join("/") : ""}`);
  if (out.check) console.log("check:", JSON.stringify(out.check));
  if (reSearch.length) { console.log(`new operators: re-search order (predicted gain over the stored answer; null = no stored answer for that deck yet):`); for (const x of reSearch.slice(0, 12)) console.log(`  ${x.op} ${x.stage} ${x.deck}: fill ${x.fill.fam} slot ${x.fill.slot} (${x.fill.role}) at ${x.fill.lvl} bad ${x.fill.bad.toFixed(2)} vs stored ${x.storedBad === null ? "-" : x.storedBad.toFixed(2)} -> gain ${x.gain}`); }
  console.log("->", of);
}
main().catch((e) => { console.error(e); process.exit(1); });
