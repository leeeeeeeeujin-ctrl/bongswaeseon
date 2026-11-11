#!/usr/bin/env node
// strategy-family store tools
//   node famtool.js import-v1 [--dir data/v1_state]   seed families from solver v1's per-rung best plans (all decks, all rungs; v1 game, 5-seed records)
//   node famtool.js list [STAGE,...]                  print the merged families of each stage
"use strict";
const fs = require("fs");
const path = require("path");
const R = require("./roles.js");
const F = require("./families.js");
const { S } = R;
const argv = process.argv.slice(2); const cmd = argv[0]; const opt = (k, d) => { const i = argv.indexOf("--" + k); return i >= 0 ? argv[i + 1] : d; };
const STAGES = ["IM-02", "IM-03", "IM-04", "IM-05", "IM-06", "IM-07", "IM-08", "IM-09", "IM-10", "WL-01", "WL-02", "WL-03", "WL-04", "WL-05", "WL-06", "WL-07", "WL-08", "WL-09"];
if (cmd === "import-v1") {
  const dir = path.resolve(opt("dir", path.join(__dirname, "data", "v1_state"))); const lev = path.join(dir, "levels");
  for (const st of STAGES) {
    const cands = [];
    for (const f of fs.readdirSync(lev).filter((f) => f.startsWith(st + "__"))) { const L = R.readJSON(path.join(lev, f), { levels: {} }); const deck = f.split("__")[1].replace(".json", "");
      for (const [lv, e] of Object.entries(L.levels || {})) { if (!e || !e.plan) continue; const verified = e.wins === 5; cands.push({ plan: e.plan, lvl: lv, lost: e.lives ? 10 - e.lives[0] : undefined, worstLost: verified ? 10 - e.worst : undefined, verified, deck, crit: verified && e.worst >= 10 ? "full" : verified && e.worst >= 9 ? "lost1" : "-", gameHash: e.gameHash, src: "v1:" + deck }); } }
    const ctx = R.stageCtx(st, "E1L1");
    const n = F.addPlans(st, "v1", cands, ctx); const m = F.loadFamilies(st);
    console.log(`${st}: ${cands.length} v1 plans -> ${n} clusters kept in the v1 file; merged store ${m.length} families: ${m.map((f) => `[${f.tags.join(", ")}] ${f.rec.lvl} ${f.rec.deck}`).join(" | ")}`);
  }
} else if (cmd === "import-memo") {   // the best distinct seed-1 plans of a memo directory (v1's: data/v1_state/memo), per stage
  const SG = require("./surrogate.js"); const dir = path.resolve(opt("dir", path.join(__dirname, "data", "v1_state", "memo"))); const by = {};
  for (const m of SG.memoRecords(dir)) { if (!m.r.complete || m.r.lost > 2) continue; (by[m.code] = by[m.code] || []).push({ plan: m.plan, lvl: m.lvl, lost: m.r.lost, verified: false, deck: m.src.split("__")[1], gameHash: m.hash, src: "memo:" + m.src }); }
  for (const [st, c] of Object.entries(by)) { c.sort((a, b) => F.RUNGS.indexOf(a.lvl) - F.RUNGS.indexOf(b.lvl) || a.lost - b.lost); const n = F.addPlans(st, "v1memo", c.slice(0, 400), R.stageCtx(st, "E1L1")); console.log(`${st}: ${c.length} seed-1 clears -> ${n} clusters; merged ${F.loadFamilies(st).length}`); }
} else if (cmd === "list") {
  for (const st of (argv[1] && !argv[1].startsWith("--") ? argv[1].split(",") : STAGES)) { const m = F.loadFamilies(st); console.log(`== ${st}: ${m.length} families`);
    for (const f of m) console.log(`  ${f.id} q ${f.q} members ${f.members} [${f.tags.join(", ")}] best ${f.rec.lvl} ${f.rec.deck || ""} lost ${f.rec.worstLost ?? f.rec.lost} slots ${R.primaries(f.T).map(([s]) => `${s.role.kind}@${s.x},${s.y}`).join(" ")}`); }
} else console.log("node famtool.js import-v1|list");
