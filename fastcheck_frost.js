// bit-identity on IM-10 (new game): fast.runBatch (snapshot branching: frost state and phase tunnels restored from checkpoints) vs sim.run, on frost-gene mutations of the seed plans
const S = require("./sim.js"), F = require("./fast.js"), G = require("./ga.js");
const keyR = (r) => JSON.stringify(Object.assign({}, r, { log: undefined, actions: undefined }));
const lv = "E1L45", ids = S.starterParty(); const sp = new G.Space("IM-10", lv, ids, S.stageInfo("IM-10", ids, lv)); const seeds = JSON.parse(require("fs").readFileSync(__dirname + "/data/frost_seeds.json"))["IM-10"];
let n = 0, bad = 0;
for (let b = 0; b < +(process.env.NB || 3); b++) { const par = sp.sanitize(b ? sp.mutate(seeds[b % 2], 2) : G.clone(seeds[0])); const kids = [par]; for (let i = 0; i < 5; i++) { const c = sp.sanitize(sp.mutate(par, 2)); c.skillIdx = par.skillIdx; kids.push(c); }
  const opt = { seed: 1 + b, squadIds: ids, sameRung: true }; const ref = kids.map((p) => S.run("IM-10", lv, p, opt)); const fb = F.runBatch("IM-10", lv, kids, opt);
  kids.forEach((p, i) => { n++; if (keyR(ref[i]) !== keyR(fb[i])) { bad++; console.log("MISMATCH", b, i, keyR(ref[i]), "\n   ", keyR(fb[i])); } }); }
console.log(`IM-10 fastcheck: ${n} plans, ${bad} mismatches; checkpoints ${F.stats.ckTaken} taken, ${F.stats.ckDirty} dirty; frames simulated ${F.stats.framesSim}/${F.stats.framesFull}`);
