#!/usr/bin/env node
// solver v2: cause tracing. When a cell's result flips between two game versions, replay the same plan on both, find the first frame where the runs diverge
// materially (an operator falls, a foe leaks, a kill comes earlier or later), and name the changed field(s) responsible by bisection over the data diff.
//   node trace.js --old <gameDir> --new <gameDir> --cells IM-10:base,IM-09:fire [--out results/trace/<name>.md]
//   node trace.js --old <gameDir> --new <gameDir> --auto [--only up]   sweep every cell on both engines and trace each one that moved (after every game change)
// A cell is an im_sim bot-sweep cell: stage x VARIANT (base|tank|fire|low) at the stage's recommended rung, im_sim's own plan P and squad build, seeds 1..N (N=5);
// value = median lives left (0 = a loss), as in im_sim ALLV. (A solver plan can be traced too: --plan file.json --stage X --level E1L1.)
// Bisection: the new engine is run with subsets of the changed data fields set back to their old values (post-load objects: units, enemies, stages, CFG). Code-only
// changes cannot be reverted that way; if reverting every data field does not restore the old value, the report says the cause is in the code.
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = __dirname;
const argv = process.argv.slice(2); const A = { _: [] }; for (let i = 0; i < argv.length; i++) { const s = argv[i]; if (s.startsWith("--")) { const n = argv[i + 1]; if (n === undefined || n.startsWith("--")) A[s.slice(2)] = true; else { A[s.slice(2)] = n; i++; } } else A._.push(s); }
const abs = (p) => path.isAbsolute(p) ? p : path.join(ROOT, p);
const RESULTS = process.env.SOLVER_RESULTS || path.join(ROOT, "results");

// ================= child: one engine, optional reverts, run cells =================
if (A.child) {
  const job = JSON.parse(fs.readFileSync(A.child, "utf8"));
  const dir = job.dir; global.window = global; require(path.join(dir, "econ.js")); require(path.join(dir, "game.js")); const TD = global.TD;
  const src = fs.readFileSync(path.join(dir, "test", "im_sim.js"), "utf8");
  const grab = (name) => { const i = src.indexOf(`const ${name} = {`); if (i < 0) return {}; let d = 0; const j = src.indexOf("{", i); for (let k = j; k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}") { d--; if (!d) return Function(`return (${src.slice(j, k + 1)})`)(); } } return {}; };
  const P = grab("P"), REC = grab("REC"), VARIANTS = grab("VARIANTS"); const MAXLV = { 3: [40, 55], 4: [45, 60, 70], 5: [50, 70, 80], 6: [50, 80, 90] };
  const HOLD = new Set(/HOLD = new Set\(\[([^\]]*)\]/.exec(src) ? JSON.parse(`[${/HOLD = new Set\(\[([^\]]*)\]/.exec(src)[1]}]`) : []);
  const BOTSTAGES = /const BOT = \{([^}]*)\}/.exec(src); const LAMP = new Set(BOTSTAGES ? [...BOTSTAGES[1].matchAll(/"([A-Z]+-\d+)": lampKeeper/g)].map((m) => m[1]) : []);
  // post-load data, for diffing
  const strip = (o, depth = 0) => { if (o === null || typeof o !== "object") return typeof o === "function" ? "<fn>" : o; if (depth > 7) return "<deep>"; if (Array.isArray(o)) return o.map((v) => strip(v, depth + 1)); const r = {}; for (const k of Object.keys(o)) r[k] = strip(o[k], depth + 1); return r; };
  const roots = { unit: Object.fromEntries(TD.UNITS.map((u) => [u.id, u])), enemy: TD.ENEMIES, stage: Object.fromEntries(TD.STAGES.filter((s) => s.code).map((s) => [s.code, s])), cfg: { CFG: TD.CFG }, summon: TD.SUMMONS };
  if (job.dump) { const out = {}; for (const [k, v] of Object.entries(roots)) out[k] = strip(v); fs.writeFileSync(job.out, JSON.stringify(out)); process.exit(0); }
  // reverts: [{path: ["unit","guard","skill","atk"], value, del}]
  for (const r of job.reverts || []) { let o = roots[r.path[0]]; for (let i = 1; i < r.path.length - 1 && o; i++) o = o[r.path[i]]; if (!o) continue; const k = r.path[r.path.length - 1]; if (r.del) delete o[k]; else o[k] = JSON.parse(JSON.stringify(r.value)); }
  const seedF = (n) => { let a = n * 7919; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const lampKeeper = (g) => { if (!g.stage.lamps || !g.lampOff.size) return; const last = g._keeperT || (g._keeperT = new Map());
    for (const k of g.lampOff) { const x = k % 100, y = (k / 100) | 0; if (TD.tileAt(x, y) !== "F" || g.freshKeeper(x, y) || !(g.lampBroken && g.lampBroken.has(k))) continue; if (last.has(k) && g.t - last.get(k) < 20) continue;
      const off = g.lampOffT.has(k) ? g.lampOffT.get(k) : -1; const u = g.units.find((q) => Math.abs(q.x - x) + Math.abs(q.y - y) === 1 && q.born <= off && !q.clone && !q.summoned && !g.enemies.some((e) => e.def.boss && !e.dead && e.blockedBy === q)); if (!u) continue; last.set(k, g.t); g.retreat(u); } };
  // im_sim run(), with an event log (falls, leaks, kills, deploys, skills, retreats)
  function runCell(code, variant, sd, record) {
    const i = TD.STAGES.findIndex((s) => s.code === code), st = TD.STAGES[i]; const rec = REC[code]; const [e, l] = rec;
    const m = VARIANTS[variant] || {}; const plan = P[code].map((q) => [m[q[0]] || q[0], ...q.slice(1)]);
    seedF(sd); TD.setMap(st.map);
    const ids = [...new Set(plan.map((q) => q[0]))];
    const g = new TD.Game(i, ids.map((id) => { const d = TD.UNITS.find((u) => u.id === id), ml = MAXLV[d.rarity], el = id === "smoqueen" ? 1 : Math.min(e, ml.length - 1), lv = id === "smoqueen" ? 40 : Math.min(l, ml[el]); return { id, elite: el, mult: TD.growth(d, el, lv, ml[el]), pot: 1, skillIdx: Math.min(el, (d.skills || []).length - 1) }; }));
    // fx and sound are left as im_sim leaves them (faithful to the sweep)
    const ev = []; let k = 0; const seenDead = new Set();
    if (record) { const ret = g.retreat.bind(g), dep = g.deploy.bind(g), sk = g.useSkill.bind(g);
      g.retreat = (u, refund = true) => { if (g.units.includes(u)) ev.push({ k, t: +g.t.toFixed(2), a: refund === false ? "fall" : "retreat", id: u.def.id, x: u.x, y: u.y, hp: Math.round(u.hp) }); return ret(u, refund); };
      g.deploy = (ci, x, y, d) => { const u = dep(ci, x, y, d); if (u) ev.push({ k, t: +g.t.toFixed(2), a: "deploy", id: u.def.id, x, y }); return u; };
      g.useSkill = (u) => { const r = sk(u); if (r !== false) ev.push({ k, t: +g.t.toFixed(2), a: "skill", id: u.def.id }); return r; }; }
    for (k = 0; k < 420 * 30 && !g.over; k++) {
      for (const q of plan) { const ci = g.cards.findIndex((c) => c.def.id === q[0]); const c = g.cards[ci]; if (!c || c.deployed || c.cooldown > 0) continue; if (g.unitAt(q[1], q[2])) continue; if (q[4] && q[4].from !== undefined && g.t < q[4].from) continue; if (!g.canDeployAt(c, q[1], q[2])) continue; if (g.deployCheck(c)) break; g.deploy(ci, q[1], q[2], q[3]); break; }
      for (const u of g.units) if (u.sp >= u.skill.sp && u.skillT <= 0 && u.skill.mode === "manual") g.useSkill(u);
      for (const f of g.fires || []) if (f.st === 1) for (const u of g.units.slice()) if (f.tiles.some(([a, b]) => a === u.x && b === u.y)) g.retreat(u);
      if (!HOLD.has(code)) for (const en of g.enemies) if (en.def.melt && en.aiming && en.aimTgt && en.aimTgt.frozenT > 0 && g.units.includes(en.aimTgt)) g.retreat(en.aimTgt);
      if (LAMP.has(code)) lampKeeper(g);
      const alive = record ? g.enemies.filter((en) => !en.dead && !en.ally) : null;
      g.update(1 / 30);
      // a foe of the frame before that is gone or dead now: leaked (it reached the base) or killed; foes spawned and gone inside one frame are caught on the next scan
      if (record) { const still = new Set(g.enemies.filter((en) => !en.dead).map((en) => en.id)); for (const en of alive.concat(g.enemies.filter((x) => x.dead))) if (!seenDead.has(en.id) && (en.dead || !still.has(en.id))) { seenDead.add(en.id); ev.push({ k, t: +g.t.toFixed(2), a: en.leaked ? "leak" : "kill", id: en.type, eid: en.id }); } }
    }
    return { over: g.over, life: g.life, t: Math.round(g.t), kills: g.killed, total: g.total, ev: record ? ev : undefined };
  }
  const out = {};
  for (const c of job.cells) { const res = []; for (let sd = 1; sd <= (job.N || 5); sd++) res.push(runCell(c.stage, c.variant, sd, job.record && (job.recordSeed === undefined || job.recordSeed === sd)));
    const lives = res.map((r) => r.over === "win" ? r.life : 0); const w = lives.slice().sort((a, b) => a - b);
    out[c.stage + ":" + c.variant] = { value: w[w.length >> 1], lives, runs: res.map((r) => ({ over: r.over, life: r.life, t: r.t, kills: r.kills, total: r.total })), ev: job.record ? res.map((r) => r.ev) : undefined, squad: [...new Set(P[c.stage].map((q) => (VARIANTS[c.variant] || {})[q[0]] || q[0]))] }; }
  fs.writeFileSync(job.out, JSON.stringify(out)); process.exit(0);
}

// ================= parent =================
const TMP = path.join(RESULTS, "cache"); fs.mkdirSync(TMP, { recursive: true });
let NJ = 0;
function child(job) { const f = path.join(TMP, `trace_job_${process.pid}_${NJ++}.json`); job.out = f + ".out"; fs.writeFileSync(f, JSON.stringify(job)); execFileSync(process.execPath, [__filename, "--child", f], { stdio: ["ignore", "inherit", "inherit"] }); const o = JSON.parse(fs.readFileSync(job.out, "utf8")); fs.unlinkSync(f); fs.unlinkSync(job.out); return o; }
function leafDiff(a, b, pre, out) {
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  if (a && b && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b)) { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) leafDiff(a[k], b[k], pre.concat([k]), out); return out; }
  out.push({ path: pre, old: a, new: b }); return out;
}
const COSMETIC = /^(desc|name|nameEn|info|art|chibi|col|glyph|iconAs|alias|deployAnim)$/;
const pathStr = (p) => p[0] + ":" + p.slice(1).join(".");
const revertsOf = (chs) => chs.map((c) => c.old === undefined ? { path: c.path, del: true } : { path: c.path, value: c.old });
// the material events of a run, as comparable keys
const mat = (e) => ["fall", "leak", "kill"].includes(e.a);
function firstDivergence(ea, eb, onlyMaterial) {
  const A1 = ea.filter((e) => !onlyMaterial || mat(e)), B1 = eb.filter((e) => !onlyMaterial || mat(e));
  const key = (e) => `${e.a}:${e.id}${e.a === "kill" || e.a === "leak" ? "#" + e.eid : ""}`;
  for (let i = 0; i < Math.max(A1.length, B1.length); i++) { const a = A1[i], b = B1[i];
    if (!a || !b || key(a) !== key(b) || Math.abs(a.k - b.k) > 30) return { i, old: a || null, new: b || null, frame: Math.min(a ? a.k : 1e9, b ? b.k : 1e9) }; }
  return null;
}
// a short description of what one side did that the other did not, around the divergence
function contrast(ea, eb, frame, n = 6) { const near = (e) => e.k >= frame - 30 && e.k <= frame + 450; const ka = new Set(ea.filter(near).map((e) => e.a + ":" + e.id)), kb = new Set(eb.filter(near).map((e) => e.a + ":" + e.id));
  return { onlyOld: ea.filter((e) => near(e) && !kb.has(e.a + ":" + e.id) && e.a !== "kill").slice(0, n), onlyNew: eb.filter((e) => near(e) && !ka.has(e.a + ":" + e.id) && e.a !== "kill").slice(0, n) }; }

function traceCell(cell, oldDir, newDir, chsAll) {
  const [stage, variant] = cell.split(":"); const c = [{ stage, variant }];
  const vOld = child({ dir: oldDir, cells: c, record: true })[cell], vNew = child({ dir: newDir, cells: c, record: true })[cell];
  const rep = { cell, old: { value: vOld.value, lives: vOld.lives }, new: { value: vNew.value, lives: vNew.lives }, squad: vNew.squad };
  // the seed that moved most
  let sd = 0, best = -1; vOld.lives.forEach((l, i) => { const d = Math.abs(vNew.lives[i] - l); if (d > best) { best = d; sd = i; } }); rep.seed = sd + 1;
  const ea = vOld.ev[sd], eb = vNew.ev[sd];
  rep.firstAny = firstDivergence(ea, eb, false); rep.firstMaterial = firstDivergence(ea, eb, true);
  rep.leaks = { old: ea.filter((e) => e.a === "leak").map((e) => `${e.id}@${e.t}`), new: eb.filter((e) => e.a === "leak").map((e) => `${e.id}@${e.t}`) };
  rep.falls = { old: ea.filter((e) => e.a === "fall").map((e) => `${e.id}@${e.t}`), new: eb.filter((e) => e.a === "fall").map((e) => `${e.id}@${e.t}`) };
  if (rep.firstMaterial) rep.contrast = contrast(ea, eb, rep.firstMaterial.frame);
  // candidate fields: changes on the squad's units (and their summons), the stage, the enemies, CFG
  const squad = new Set(vNew.squad);
  const rel = chsAll.filter((ch) => (ch.path[0] === "unit" && squad.has(ch.path[1])) || ch.path[0] === "enemy" || (ch.path[0] === "stage" && ch.path[1] === stage) || ch.path[0] === "cfg" || ch.path[0] === "summon");
  rep.candidates = rel.map((ch) => ({ field: pathStr(ch.path), old: ch.old, new: ch.new }));
  const value = (reverts) => child({ dir: newDir, cells: c, reverts: revertsOf(reverts) })[cell];
  const target = vOld.value, now = vNew.value, isOld = (v) => v.value === target && (v.value !== now);
  let tests = 0; const T = (rs) => { tests++; return value(rs); };
  if (!rel.length) { rep.verdict = "no changed data field touches this cell: the cause is in the code (game.js logic)"; rep.tests = tests; return rep; }
  const all = T(rel); rep.allReverted = { value: all.value, lives: all.lives };
  if (!isOld(all)) { rep.verdict = `reverting all ${rel.length} candidate data fields gives ${all.value} (old ${target}, new ${now}): part of the cause is outside the data (code), or in fields outside this squad`; }
  // groups: by unit (or enemy/stage/cfg root), then ddmin inside the group(s) needed
  const groupKey = (ch) => ch.path[0] + ":" + ch.path[1] + (ch.path[0] === "unit" && /^skills?$/.test(ch.path[2] || "") ? "." + (ch.path[2] === "skill" ? "skills.0" : ch.path[2] + "." + ch.path[3]).replace("skills.skills", "skills") : "");
  const groups = {}; for (const ch of rel) { const g = groupKey(ch); (groups[g] = groups[g] || []).push(ch); }
  rep.groups = {};
  // necessity: revert one group only (new engine otherwise) -> back to old?   sufficiency: revert everything except one group -> still new?
  for (const [g, chs] of Object.entries(groups)) { const nec = T(chs); const rest = rel.filter((ch) => !chs.includes(ch)); const suf = rest.length ? T(rest) : { value: now, lives: vNew.lives };
    rep.groups[g] = { fields: chs.map((ch) => pathStr(ch.path)), revertOnly: { value: nec.value, lives: nec.lives }, applyOnly: { value: suf.value, lives: suf.lives }, necessary: nec.value === target, sufficient: suf.value === now }; }
  // minimal field set that restores the old value (ddmin over fields, starting from the necessary groups or all)
  let set = Object.entries(rep.groups).filter(([, v]) => v.necessary).flatMap(([g]) => groups[g]); if (!set.length) set = isOld(all) ? rel.slice() : [];
  if (set.length) { let n = 2; while (set.length >= 2) { const sz = Math.ceil(set.length / n); let reduced = false;
      for (let i = 0; i < set.length; i += sz) { const comp = set.slice(0, i).concat(set.slice(i + sz)); if (comp.length && isOld(T(comp))) { set = comp; n = Math.max(n - 1, 2); reduced = true; break; } }
      if (!reduced) { if (n >= set.length) break; n = Math.min(set.length, n * 2); } }
    rep.minimalRevert = set.map((ch) => ({ field: pathStr(ch.path), old: ch.old, new: ch.new })); }
  // the effect of the responsible fields alone on the event stream: the old engine run with only those changes reverted (new engine + revert = "new without the cause")
  if (rep.minimalRevert && rep.minimalRevert.length) { const w = child({ dir: newDir, cells: c, reverts: revertsOf(set), record: true, recordSeed: sd + 1 })[cell]; const ew = w.ev[sd]; const d = firstDivergence(ew, eb, true); rep.causeEffect = d ? { frame: d.frame, t: +(d.frame / 30).toFixed(1), withoutCause: d.old, withCause: d.new } : null; }
  rep.tests = tests;
  if (!rep.verdict) rep.verdict = rep.minimalRevert && rep.minimalRevert.length ? `responsible: ${rep.minimalRevert.map((m) => m.field).join(", ")}` : "no single data group restores the old value; interaction of several groups";
  return rep;
}
function md(reps, meta) {
  const L = [`# Cause trace: ${meta.oldLabel} -> ${meta.newLabel}`, "", `Cells are im_sim bot-sweep cells (ALLV variants, the recommended rung, im_sim's plan and squad build, seeds 1..5; value = median lives left of ${meta.life}, 0 = loss). Old engine ${meta.oldDir} (md5 ${meta.oldMd5}), new ${meta.newDir} (md5 ${meta.newMd5}). ${meta.nChanges} data fields differ after load.`, ""];
  for (const r of reps) {
    L.push(`## ${r.cell}: ${r.old.value} -> ${r.new.value} (lives ${r.old.lives.join(" ")} -> ${r.new.lives.join(" ")})`, "");
    L.push(`- squad: ${r.squad.join(", ")}`);
    L.push(`- traced seed ${r.seed}: leaks old [${r.leaks.old.join(", ") || "none"}] new [${r.leaks.new.join(", ") || "none"}]; falls old [${r.falls.old.join(", ") || "none"}] new [${r.falls.new.join(", ") || "none"}]`);
    if (r.firstAny) L.push(`- first difference of any kind: frame ${r.firstAny.frame} (t ${(r.firstAny.frame / 30).toFixed(1)} s): old ${fmtE(r.firstAny.old)} / new ${fmtE(r.firstAny.new)}`);
    if (r.firstMaterial) L.push(`- first material divergence: frame ${r.firstMaterial.frame} (t ${(r.firstMaterial.frame / 30).toFixed(1)} s): old ${fmtE(r.firstMaterial.old)} / new ${fmtE(r.firstMaterial.new)}`);
    if (r.contrast) L.push(`- in the next 15 s, only on old: ${r.contrast.onlyOld.map(fmtE).join("; ") || "-"}; only on new: ${r.contrast.onlyNew.map(fmtE).join("; ") || "-"}`);
    L.push(`- changed fields touching the cell: ${r.candidates.length}${r.allReverted ? `; all reverted on the new engine -> ${r.allReverted.value} (lives ${r.allReverted.lives.join(" ")})` : ""}`);
    if (r.groups) for (const [g, v] of Object.entries(r.groups)) if (v.necessary || v.sufficient) L.push(`  - ${g}: revert only -> ${v.revertOnly.value}${v.necessary ? " (undoes the flip)" : ""}; this change alone -> ${v.applyOnly.value}${v.sufficient ? " (causes the flip alone)" : ""} [${v.fields.join(", ")}]`);
    if (r.minimalRevert) L.push(`- **minimal revert that restores ${r.old.value}:** ${r.minimalRevert.map((m) => `\`${m.field}\` ${JSON.stringify(m.new)} -> ${JSON.stringify(m.old)}`).join(", ")}`);
    if (r.causeEffect) L.push(`- with only that reverted, the run first differs from the new one at t ${r.causeEffect.t} s: without the change ${fmtE(r.causeEffect.withoutCause)} / with it ${fmtE(r.causeEffect.withCause)}`);
    L.push(`- **verdict:** ${r.verdict} (${r.tests} bisection runs x 5 seeds)`, "");
  }
  return L.join("\n");
}
function fmtE(e) { return e ? `${e.a} ${e.id}${e.eid !== undefined ? "#" + e.eid : ""}${e.x !== undefined ? ` (${e.x},${e.y})` : ""} @${e.t}s` : "(nothing)"; }

if (require.main === module) {
  const oldDir = abs(A.old || "game_v1"), newDir = abs(A.new || "game");
  let cells = (A.cells || "IM-10:base,IM-10:tank,IM-10:low,IM-09:fire,WL-05:low").split(",");
  // --auto: the whole bot sweep (every stage of im_sim's P x base/tank/fire/low) on both engines; every cell whose value moved is traced
  if (A.auto) { const STG = (A.stages || "IM-02,IM-03,IM-04,IM-05,IM-06,IM-07,IM-08,IM-09,IM-10,WL-01,WL-02,WL-03,WL-04,WL-05,WL-06,WL-07,WL-08,WL-09").split(","); const all = STG.flatMap((st) => ["base", "tank", "fire", "low"].map((v) => ({ stage: st, variant: v })));
    const a = child({ dir: oldDir, cells: all }), b = child({ dir: newDir, cells: all }); cells = Object.keys(b).filter((k) => a[k] && a[k].value !== b[k].value);
    console.log(`sweep: ${all.length} cells, ${cells.length} moved: ${cells.map((k) => `${k} ${a[k].value}->${b[k].value}`).join(", ")}`); if (A.only === "up") cells = cells.filter((k) => b[k].value > a[k].value); }
  const t0 = Date.now();
  const dOld = child({ dir: oldDir, dump: true }), dNew = child({ dir: newDir, dump: true });
  const chs = []; for (const root of Object.keys(dNew)) leafDiff(dOld[root], dNew[root], [root], chs);
  // fields new in the new version that its code reads where the old code had a constant: their "old value" is that constant (else a revert would read undefined)
  const skillAt = (p) => { let o = dNew; for (const k of p.slice(0, -1)) o = o && o[k]; return o; };
  const EQUIV = { dp: (sk) => ({ to_breath: 10, b_chant: 12 })[sk && sk.id] ?? 12, healMul: () => 0.45, ivMul: () => 1.5, sleepEvery: () => 3, sleepDur: () => 2 };
  for (const c of chs) { const k = c.path[c.path.length - 1]; if (c.old === undefined && EQUIV[k]) { c.old = EQUIV[k](skillAt(c.path)); c.equiv = true; } }
  const changes = chs.filter((c) => !c.path.some((p) => COSMETIC.test(String(p))) && !(c.path[0] === "unit" && c.path[2] === "talent") && JSON.stringify(c.old) !== JSON.stringify(c.new));
  const reps = []; for (const cell of cells) { const r = traceCell(cell, oldDir, newDir, changes); reps.push(r); console.log(`${cell}: ${r.old.value} -> ${r.new.value} | ${r.verdict}`); }
  const md5 = (f) => require("crypto").createHash("md5").update(fs.readFileSync(f)).digest("hex");
  const meta = { oldLabel: A.oldLabel || path.basename(oldDir), newLabel: A.newLabel || path.basename(newDir), oldDir, newDir, oldMd5: md5(path.join(oldDir, "game.js")), newMd5: md5(path.join(newDir, "game.js")), nChanges: changes.length, life: 3 };
  const outMd = abs(A.out || path.join(RESULTS, "trace", `trace_${meta.oldMd5.slice(0, 8)}_${meta.newMd5.slice(0, 8)}.md`)); fs.mkdirSync(path.dirname(outMd), { recursive: true });
  fs.writeFileSync(outMd, md(reps, meta)); fs.writeFileSync(outMd.replace(/\.md$/, ".json"), JSON.stringify({ meta, changes: changes.map((c) => ({ field: pathStr(c.path), old: c.old, new: c.new })), reps }, null, 1));
  console.log(`-> ${outMd} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
module.exports = { firstDivergence, leafDiff };
