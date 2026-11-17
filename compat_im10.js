// backward compatibility of the frost-gene change: every stored solver2 answer (results/jobs/*.json with a plan, one per stage x deck x crit) is played
// by the pre-change code (bak_im10/) and by the current code, on the SAME snapshot (default ./game, the pre-change snapshot), seed 2; plus fast.runOne
// and the plan key (memo key) must be unchanged. usage: node compat_im10.js [maxPlans]
const fs = require("fs"), path = require("path");
const N = require("./sim.js"), NF = require("./fast.js"), NG = require("./ga.js");
const O = require("./bak_im10/sim.js"), OF = require("./bak_im10/fast.js"), OG = require("./bak_im10/ga.js");
const keyR = (r) => JSON.stringify([r.win, r.rwin, r.life, r.lost, r.complete, r.aborted, r.stall, r.t, r.tEnd, r.frames, r.over, r.kills, r.total, r.units, r.deploys, r.spent]);
const J = path.join(__dirname, "results/jobs"); const files = fs.readdirSync(J).filter((f) => /^[A-Z]+-\d+__\w+__\w+\.json$/.test(f)).sort();
let n = 0, bad = 0, keyBad = 0; const max = +(process.argv[2] || 1e9); const per = {};
for (const f of files) { if (n >= max) break; const x = JSON.parse(fs.readFileSync(path.join(J, f))); if (!x.plan || !x.min || N.stageIdx(x.stage) < 0) continue; if (O.TD.STAGES[O.stageIdx(x.stage)].frost) continue;
  const sq = x.squad && x.squad.length <= 12 ? x.squad : N.squadIdsOf(x.plan, x.squad); const opt = { seed: 2, squadIds: sq, sameRung: true };
  const a = O.run(x.stage, x.min, x.plan, opt), b = N.run(x.stage, x.min, x.plan, opt), d = NF.runOne(x.stage, x.min, x.plan, opt), c = OF.runOne(x.stage, x.min, x.plan, opt);
  n++; per[x.stage] = (per[x.stage] || 0) + 1;
  if (!(keyR(a) === keyR(b) && keyR(b) === keyR(d) && keyR(c) === keyR(d) && JSON.stringify(a.log) === JSON.stringify(b.log))) { bad++; console.log("DIFF", f, keyR(a), keyR(b), keyR(d)); }
  if (OG.keyOf(x.plan) !== NG.keyOf(x.plan)) { keyBad++; console.log("KEY DIFF", f); } }
console.log(`compat (snapshot ${N.GAME_DIR}): ${n} stored answers over ${Object.keys(per).length} stages, ${bad} results differ, ${keyBad} plan keys differ`);
