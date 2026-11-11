#!/usr/bin/env node
// solver v2 replays: v1's long-form record (accepted by /home/claude/td/replay.js normalize()), plus `sm` (skill mastery per skill) on every squad member.
//   node replay2.js verify <file.json|dir> ...   replay each record in node from its action log alone (no planner) and compare with `expected`
//   node replay2.js pack <dir> [--out replay_data.js]  the viewer's packed form; q rows are [id, elite, lvl, pot, skillIdx, slv, mult, sm] (sm is the new 8th field;
//                                                the current viewer ignores it, see viewer_sm.patch)
"use strict";
const fs = require("fs");
const path = require("path");
const S = require("./sim.js");
const { TD } = S;
const FPS = 30, MAXF = 420 * FPS;
const formation = (squad, plan) => squad.length <= 12 ? squad : S.squadIdsOf(plan, squad);

// a record from a solved result {stage, min, plan, squad, crit, lives}
function build(stage, lvl, plan, squadIds, meta = {}) {
  const [E, L] = S.parseLv(lvl);
  const r = S.run(stage, lvl, plan, { seed: 1, squadIds, record: true, sameRung: true });
  const squad = S.buildSquad(squadIds, E, L, plan.skillIdx, true).map((c) => ({ id: c.id, elite: c.elite, lvl: c.lv, pot: c.pot, skillIdx: c.skillIdx, skill: `S${c.skillIdx + 1}`, slv: c.slv, sm: c.sm, mult: c.mult }));
  const st = TD.STAGES[S.stageIdx(stage)];
  return Object.assign({ stage, name: st.name, level: lvl, lost: r.lost, seed: 1, K: 1, variant: "none", stageMul: st.mul }, meta, {
    rng: "Math.random replaced before `new TD.Game` by im_sim's seed(n): a = n*7919, mulberry32-style step; nothing else draws from it between seeding and the game",
    stepping: "fixed g.update(1/30) per frame, max 420*30 frames; actions run at the start of a frame, before that frame's update, in log order",
    squad, squadNote: "card order = squad order (card index ci in actions); Game(stageIdx, squad) receives {id, elite, mult, pot, skillIdx, slv, sm}; skill level and mastery by rung (sim.js skillRank, slv-r1); sm[k] = mastery of skill k",
    expected: { win: r.win, rwin: r.rwin, over: r.over, life: r.life, lost: r.lost, winTime: r.tEnd, frames: r.frames, kills: r.kills, total: r.total },
    actions: r.actions, plan });
}
function writeFromResult(file, out) {
  const ids = formation(out.squad, out.plan);
  const rep = build(out.stage, out.min, out.plan, ids, { deck: out.name, criterion: out.crit === "full" ? "lost<=0 (full block)" : "lost<=1", fiveSeedLost: (out.lives || []).map((x) => x ? 10 - x : null), family: out.family ? out.family.id : null, gameHash: out.gameHash });
  fs.writeFileSync(file, JSON.stringify(rep, null, 1)); return rep;
}
// replay from the record alone: only the logged actions at their frames, the squad exactly as recorded (with slv and sm)
function replay(rep) {
  const i = S.stageIdx(rep.stage), st = TD.STAGES[i];
  S.seed(rep.seed); TD.setMap(st.map);
  const g = new TD.Game(i, rep.squad.map((c) => ({ id: c.id, elite: c.elite, mult: c.mult, pot: c.pot, skillIdx: c.skillIdx, slv: c.slv, sm: c.sm })));
  g.life += 1000;   // the solver's padded pool (identical dynamics; only game over depends on it)
  const acts = rep.actions; let j = 0, k = 0; const bad = [];
  for (k = 0; k < MAXF && !g.over; k++) {
    while (j < acts.length && acts[j].k === k) { const a = acts[j++]; let ok;
      if (a.a === "deploy") ok = !!g.deploy(a.ci, a.x, a.y, a.dir);
      else { const u = g.units.find((q) => q.id === a.uid); if (!u) ok = false; else if (a.a === "skill") ok = g.useSkill(u) !== false; else { g.retreat(u); ok = true; } }
      if (!ok) bad.push({ j: j - 1, a: a.a, id: a.id, k: a.k }); }
    g.update(1 / FPS);
  }
  const lost = 1000 + TD.CFG.life - g.life;
  return { over: g.over, lost, t: g.t, frames: k, kills: g.killed, applied: j, of: acts.length, bad, match: lost === rep.expected.lost && Math.abs(g.t - rep.expected.winTime) < 1e-6 && g.killed === rep.expected.kills && j === acts.length && !bad.length && k === rep.expected.frames };
}
function pack(rep) {
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return { c: rep.stage, n: rep.name, s: rep.seed, lv: rep.level, v: rep.variant || "base", src: "solver2",
    q: rep.squad.map((s) => [s.id, s.elite, s.lvl, s.pot || 1, s.skillIdx || 0, s.slv || 0, s.mult || 0, s.sm || 0]),
    x: [rep.expected.over, TD.CFG.life - rep.expected.lost, r3(rep.expected.winTime), rep.expected.kills, rep.expected.total],
    L: rep.actions.map((a) => a.a === "deploy" ? [r3(a.t), "d", a.id, a.x, a.y, a.dir].concat(a.summon ? [1] : []) : [r3(a.t), a.a[0], a.id, a.x === undefined ? null : a.x, a.y === undefined ? null : a.y, a.uid]) };
}
module.exports = { build, writeFromResult, replay, pack };
if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2);
  const files = []; for (const p of rest.filter((x) => !x.startsWith("--"))) { if (fs.statSync(p).isDirectory()) { for (const f of fs.readdirSync(p)) if (/\.json$/.test(f)) files.push(path.join(p, f)); } else files.push(p); }
  if (cmd === "verify") { let ok = 0; for (const f of files) { const rep = JSON.parse(fs.readFileSync(f, "utf8")); if (!rep.actions || !rep.expected || !rep.squad || typeof rep.squad[0] !== "object") continue; const r = replay(rep); if (r.match) ok++;
      console.log(`${path.basename(f)} ${rep.stage} ${rep.level}: expected lost ${rep.expected.lost} t ${rep.expected.winTime.toFixed(3)} kills ${rep.expected.kills} | replay lost ${r.lost} t ${r.t.toFixed(3)} kills ${r.kills} actions ${r.applied}/${r.of}${r.bad.length ? " BAD " + JSON.stringify(r.bad.slice(0, 2)) : ""} => ${r.match ? "REPRODUCED" : "DIFFERS"}`); }
    console.log(`${ok}/${files.length} reproduced`); }
  else if (cmd === "pack") { const i = process.argv.indexOf("--out"); const out = {}; for (const f of files) { const rep = JSON.parse(fs.readFileSync(f, "utf8")); if (rep.actions && rep.expected && typeof rep.squad[0] === "object") out[rep.stage + (rep.deck ? "_" + rep.deck : "")] = pack(rep); }
    const js = "// generated by solver2/replay2.js pack\nwindow.__BSL_REPLAYS = " + JSON.stringify(out).replace(/<\//g, "<\\/") + ";\n"; fs.writeFileSync(i > 0 ? process.argv[i + 1] : "replay_data.js", js); console.log(Object.keys(out).length, "packed"); }
  else console.log("node replay2.js verify|pack ...");
}
