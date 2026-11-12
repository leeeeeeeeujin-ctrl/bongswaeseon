#!/usr/bin/env node
// akbench: our operators (and solver v2) on Arknights stages. PRIVATE dev-only benchmark.
// RULES: AK data (maps, waves, enemy stats) and anything converted from it (stages, replays, plans) never go into a git repo, the game folder, a test site or
// a CI artifact/log. Only derived numbers (min rung per stage/deck/criterion, life lost, win time) leave the machine or runner that made them.
// This file holds no AK data: the benchmark list below is stage codes and level file names only.
//   node akbench.js fetch --out DIR [--stages 1-7,2-3]           download the level files + enemy tables from Kengxxiao/ArknightsGameData_YoStar (raw.githubusercontent.com)
//   node akbench.js convert --raw DIR --out FILE [--stages ..]   DIR = .../en_US/gamedata ; FILE = {stages, enemies, reports} (private)
//   node akbench.js validate --file FILE [--akdata DIR] [--out F] [--quiet] headless empty-squad run of every stage: errors, every foe reaches a point, first leak vs AK's pressure clock, counts, path differences
//   node akbench.js summarize --results DIR --out F [--stages ..] numbers only from a solver results dir (jobs/*.json)
//   node akbench.js list                                          the benchmark stage codes
"use strict";
const fs = require("fs");
const path = require("path");

// the benchmark: code -> level file (AK's own ids). Mostly ordinary stages without decisive gimmicks: 2-4 per episode 1-7 and a few later ones
const BENCH = [
  ["1-2", "Obt/Main/level_main_01-02"], ["1-7", "Obt/Main/level_main_01-07"], ["1-10", "Obt/Main/level_main_01-10"],
  ["2-1", "Obt/Main/level_main_02-01"], ["2-2", "Obt/Main/level_main_02-02"], ["2-4", "Obt/Main/level_main_02-04"],
  ["3-2", "Obt/Main/level_main_03-02"], ["3-7", "Obt/Main/level_main_03-07"],
  ["4-2", "Obt/Main/level_main_04-02"], ["4-4", "Obt/Main/level_main_04-04"], ["4-5", "Obt/Main/level_main_04-05"], ["4-8", "Obt/Main/level_main_04-08"],
  ["5-1", "Obt/Main/level_main_05-01"], ["5-2", "Obt/Main/level_main_05-02"], ["5-3", "Obt/Main/level_main_05-03"], ["5-8", "Obt/Main/level_main_05-08"],
  ["6-2", "Obt/Main/level_main_06-02"], ["6-8", "Obt/Main/level_main_06-07"], ["6-12", "Obt/Main/level_main_06-11"],
  ["7-4", "Obt/Main/level_main_07-03"], ["7-6", "Obt/Main/level_main_07-05"], ["7-10", "Obt/Main/level_main_07-08"],
  ["R8-1", "Obt/Main/level_main_08-01"], ["9-6", "Obt/Main/level_main_09-05"], ["10-4", "Obt/Main/level_main_10-03"], ["13-2", "Obt/Main/level_main_13-01"],
];
const SRC = "https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData_YoStar/main/en_US/gamedata";
const TABLES = ["levels/enemydata/enemy_database.json", "excel/enemy_handbook_table.json"];
const levelFile = (id) => "levels/" + id.toLowerCase() + ".json";

const argv = process.argv.slice(2); const A = { _: [] }; for (let i = 0; i < argv.length; i++) { const s = argv[i]; if (s.startsWith("--")) { const n = argv[i + 1]; if (n === undefined || n.startsWith("--")) A[s.slice(2)] = true; else { A[s.slice(2)] = n; i++; } } else A._.push(s); }
const pick = (s) => { if (!s || s === "all") return BENCH.slice(); const want = s.split(",").map((x) => x.trim().replace(/^AK/, "")).filter(Boolean); return want.map((c) => BENCH.find((b) => b[0] === c) || (() => { throw new Error("not in the benchmark list: " + c); })()); };

async function fetchAll(out, list) {
  const files = TABLES.concat(list.map((b) => levelFile(b[1])));
  let n = 0, bytes = 0;
  for (const f of files) {
    const dst = path.join(out, f); if (fs.existsSync(dst) && fs.statSync(dst).size > 0) { n++; continue; }
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    let ok = false;
    for (let a = 0; a < 4 && !ok; a++) { try { const r = await fetch(`${SRC}/${f}`); if (!r.ok) throw new Error("HTTP " + r.status); const b = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(dst, b); bytes += b.length; ok = true; } catch (e) { if (a === 3) throw new Error(`fetch failed (${path.basename(f)}): ${e.message}`); await new Promise((r) => setTimeout(r, 2000 * (a + 1))); } }
    n++;
  }
  console.log(`fetched ${n} files (${(bytes / 1e6).toFixed(1)} MB new)`);   // file count only: no names of maps, no content
}

function convertAll(raw, list) {
  const C = require(fs.existsSync(path.join(__dirname, "convert.js")) ? "./convert.js" : "./akconvert.js");
  const db = {}; for (const e of JSON.parse(fs.readFileSync(path.join(raw, TABLES[0]), "utf8")).enemies) db[e.Key] = e.Value;
  const hb = JSON.parse(fs.readFileSync(path.join(raw, TABLES[1]), "utf8")).enemyData;
  const out = { note: "PRIVATE: converted Arknights data. Never commit, upload or copy into the game.", made: new Date().toISOString(), stages: [], enemies: {}, reports: {} };
  for (const [code, levelId] of list) {
    const lv = JSON.parse(fs.readFileSync(path.join(raw, levelFile(levelId)), "utf8"));
    const r = C.convertLevel(lv, db, hb, { code, levelId, name: code });
    r.report.approximate = C.approxReasons(r.report);
    out.stages.push(r.stage); Object.assign(out.enemies, r.enemies); out.reports[code] = r.report;
  }
  return out;
}

// ---- validation: empty squad, every foe walks in ----
function validate(file, akdata) {
  global.window = global;
  const GAME = process.env.SOLVER_GAME_DIR || path.join(__dirname, fs.existsSync(path.join(__dirname, "game")) ? "game" : "../solver2/game");
  require(path.join(GAME, "econ.js")); require(path.join(GAME, "game.js")); const TD = global.TD;
  const L = require(fs.existsSync(path.join(__dirname, "akload.js")) ? "./akload.js" : "./akload.js"); const data = JSON.parse(fs.readFileSync(file, "utf8")); L.install(TD, data);
  let ref = {}; if (akdata) { try { for (const s of JSON.parse(fs.readFileSync(path.join(akdata, "stages.json"), "utf8")).stages) if (s.group === "main") ref[s.code] = s; } catch (e) { ref = {}; } }
  const NULLFX = { push() { return 0; }, pop() {}, filter() { return NULLFX; }, [Symbol.iterator]() { return [][Symbol.iterator](); }, length: 0 };
  const rows = [];
  for (const st of data.stages) {
    const code = st.ak.code, rep = data.reports[code], i = TD.STAGES.findIndex((s) => s.code === st.code); const row = { code, ok: true, errors: [] };
    try {
      TD.setMap(st.map); let a = 7919; Math.random = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      const g = new TD.Game(i, [{ id: TD.UNITS[0].id }]); g.fx = NULLFX; g.snd = () => {}; g.life += 1e6; const life0 = g.life;
      let firstLeak = null, lastLeak = null, k = 0; const dt = 1 / 30;
      for (; k < 1200 * 30 && !g.over; k++) { const before = g.leaked; g.update(dt); if (g.leaked > before) { if (firstLeak === null) firstLeak = g.t; lastLeak = g.t; } }
      Object.assign(row, { over: g.over, t: Math.round(g.t), total: g.total, leaked: g.leaked, lifeLost: life0 - g.life, firstLeak: firstLeak && Math.round(firstLeak * 10) / 10, lastLeak: lastLeak && Math.round(lastLeak), killed: g.killed });
      if (g.over !== "win") { row.ok = false; row.errors.push("did not finish (" + g.over + ")"); }
      if (g.leaked !== g.total) { row.ok = false; row.errors.push(`only ${g.leaked}/${g.total} reached a point`); }
      const lifeWant = st.waves.reduce((s, w) => s + (TD.ENEMIES[w[1]].life || 0), 0); if (life0 - g.life !== lifeWant) row.errors.push(`life lost ${life0 - g.life} vs ${lifeWant}`);
    } catch (e) { row.ok = false; row.errors.push(String(e && e.stack || e).split("\n").slice(0, 3).join(" | ")); }
    // AK's own numbers (from the data agent's stages.json)
    const R = ref[code]; if (R) { row.akClock = R.derived.pressure_clock_s; row.akHostile = R.derived.hostile_enemies; row.akTotal = R.derived.total_enemies; row.akLastSpawn = R.derived.last_spawn_s_min;
      row.clockDiff = row.firstLeak !== null && row.akClock !== null ? Math.round((row.firstLeak - row.akClock) * 10) / 10 : null;
      if (row.akHostile !== st.waves.length) row.errors.push(`count ${st.waves.length} vs AK hostile ${row.akHostile}`);
      if (row.clockDiff !== null && Math.abs(row.clockDiff) > 3) row.errors.push(`first leak ${row.firstLeak}s vs AK clock ${row.akClock}s`); }
    // our BFS (gate -> point) vs AK's fixed path, per distinct ground path
    TD.setMap(st.map); const seen = new Set(); let worst = null, nDiff = 0, nPaths = 0;
    for (const w of st.waves) { const o = w[3]; if (!o.akPath || TD.ENEMIES[w[1]].flying) continue; const key = JSON.stringify(o.akPath.slice(0, 1).concat(o.akPath.slice(-1))) + o.akPath.length; if (seen.has(key)) continue; seen.add(key); nPaths++;
      const P = o.akPath, s = w[2], B = TD.PATHS[s] || null; const akLen = segLen(P), bfsLen = B ? segLen(B) : null;
      const sa = new Set(P.map((q) => q.join(","))), sb = new Set((B || []).map((q) => q.join(","))); let inter = 0; for (const q of sa) if (sb.has(q)) inter++; const jac = sb.size ? inter / (sa.size + sb.size - inter) : 0;
      const sameEnds = B && B[0][0] === P[0][0] && B[0][1] === P[0][1] && B[B.length - 1][0] === P[P.length - 1][0] && B[B.length - 1][1] === P[P.length - 1][1];
      const d = { akLen: Math.round(akLen * 10) / 10, bfsLen: bfsLen && Math.round(bfsLen * 10) / 10, overlap: Math.round(jac * 100) / 100, sameEnds: !!sameEnds };
      if (jac < 0.999 || !sameEnds) nDiff++;
      if (!worst || jac < worst.overlap) worst = d; }
    row.paths = { n: nPaths, differ: nDiff, worst };
    row.approximate = rep.approximate; row.flags = rep.flags;
    if (row.errors.length && row.ok) row.warn = true;
    rows.push(row);
  }
  return rows;
}
const segLen = (p) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; };

// ---- numbers only, from a solver results dir ----
function summarize(dir, list) {
  const out = []; const jobs = path.join(dir, "jobs");
  // AK stages: AK<code>__deck__crit[__rK].json -> stage "<code>"; our own stages (AK-operator decks on them): <code>__deck__crit[__rK].json -> stage "<code>", ours: true
  const files = []; for (const sub of ["", "rep"]) { const d = path.join(jobs, sub); for (const f of fs.existsSync(d) ? fs.readdirSync(d) : []) if (f.endsWith(".json")) files.push([d, f]); }
  for (const [d, f] of files) {
    const m = /^(AK)?(.+?)__(\w+)__(lost1|full)(?:__r(\w+))?(\.partial)?\.json$/.exec(f); if (!m) continue; const st = m[2]; if (list && !list.includes(st)) continue;
    const rep = m[5] === undefined ? undefined : m[5], extra = Object.assign(m[1] ? {} : { ours: true }, rep === undefined ? {} : { rep });
    let x; try { x = JSON.parse(fs.readFileSync(path.join(d, f), "utf8")); } catch (e) { continue; }
    if (m[6]) { out.push(Object.assign({ stage: st, deck: m[3], crit: m[4], partial: true }, extra, { probes: Object.fromEntries(Object.entries(x.probes || {}).map(([lv, r]) => [lv, { cleared: !!r.cleared, worstLost: r.worstLost ?? null }])) })); continue; }
    out.push({ stage: st, deck: m[3], crit: m[4], ...extra, done: !!x.done, min: x.min || null, worstLost: x.worstLost ?? null, winTime: x.winTime ?? null, lost5: x.lost5 || null, evals: x.evals ?? null, secs: x.secsTotal ?? null, gameHash: x.gameHash,
      probes: x.probes ? Object.fromEntries(Object.entries(x.probes).map(([lv, r]) => [lv, { cleared: !!r.cleared, worstLost: r.worstLost ?? null }])) : undefined });
  }
  // a finished job supersedes its partial file
  const key = (r) => `${r.stage}|${r.deck}|${r.crit}|${r.rep ?? ""}`; const done = new Set(out.filter((r) => !r.partial).map(key));
  return out.filter((r) => !r.partial || !done.has(key(r))).sort((a, b) => key(a) < key(b) ? -1 : 1);
}

async function main() {
  const cmd = A._[0] || "list";
  if (cmd === "list") { console.log(BENCH.map((b) => b[0]).join(",")); return; }
  if (cmd === "fetch") { await fetchAll(A.out || "akraw", pick(A.stages)); return; }
  if (cmd === "convert") { const list = pick(A.stages); const o = convertAll(A.raw, list); fs.mkdirSync(path.dirname(path.resolve(A.out)), { recursive: true }); fs.writeFileSync(A.out, JSON.stringify(o));
    console.log(`converted ${o.stages.length} stages`); if (A.verbose) for (const [c, r] of Object.entries(o.reports)) console.log(`  ${c}: ${r.size.join("x")} gates ${r.gates} points ${r.bases} foes ${r.nEntries} waves ${r.waves} approx ${r.approximate.length ? r.approximate.join("; ") : "-"}`); return; }
  if (cmd === "validate") { const rows = validate(A.file, A.akdata); if (A.out) fs.writeFileSync(A.out, JSON.stringify(rows, null, 1));
    if (A.quiet) { console.log(`validate: ${rows.filter((r) => r.ok).length}/${rows.length} stages ran clean`); if (rows.some((r) => !r.ok)) process.exitCode = 2; return; }   // CI: no map or wave numbers in the log
    for (const r of rows) console.log(`${r.code.padEnd(5)} ${r.ok ? (r.warn ? "WARN" : "ok  ") : "FAIL"} t ${String(r.t).padStart(4)} foes ${r.leaked}/${r.total}${r.akHostile !== undefined ? " (AK " + r.akHostile + ")" : ""} first leak ${r.firstLeak}s${r.akClock !== undefined ? " (AK " + r.akClock + "s)" : ""} paths ${r.paths.differ}/${r.paths.n} differ from BFS${r.paths.worst ? " (worst overlap " + r.paths.worst.overlap + ", AK " + r.paths.worst.akLen + " vs BFS " + r.paths.worst.bfsLen + ")" : ""}${r.errors.length ? " | " + r.errors.join("; ") : ""}`);
    return; }
  if (cmd === "summarize") { const rows = summarize(A.results, A.stages ? A.stages.split(",").map((s) => s.trim().replace(/^AK/, "")) : null); const o = { made: new Date().toISOString(), note: "derived numbers only", rows }; if (A.out) { fs.mkdirSync(path.dirname(path.resolve(A.out)), { recursive: true }); fs.writeFileSync(A.out, JSON.stringify(o, null, 1)); }
    console.log(`${rows.length} result rows`); return; }
  throw new Error("unknown command " + cmd);
}
module.exports = { BENCH, pick, convertAll, validate, summarize };
if (require.main === module) main().catch((e) => { console.error("akbench: " + (e && e.message || e)); process.exit(1); });
