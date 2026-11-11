// worker process: loads the engine snapshot once and plays the plans it is sent
//  job {code, lvl, plan, opt}        -> one result (fast core; the recording path uses sim.run, which wraps the game's own calls)
//  job {code, lvl, plans:[...], opt} -> results for a batch of sibling plans sharing one squad (snapshot branching)
"use strict";
const S = require("./sim.js");
const F = require("./fast.js");
const ERR = (e) => ({ error: String(e && e.stack || e), win: false, life: 0, lost: 99, t: 0, kills: 0, total: 1, units: 0, spent: 0 });
process.on("message", (m) => {
  if (m.type === "run") {
    const out = m.jobs.map((j) => { try {
      if (j.plans) return F.runBatch(j.code, j.lvl, j.plans, j.opt || {});
      const o = j.opt || {}; return o.record || o.keepFx ? S.run(j.code, j.lvl, j.plan, o) : F.runOne(j.code, j.lvl, j.plan, o);
    } catch (e) { return j.plans ? j.plans.map(() => ERR(e)) : ERR(e); } });
    process.send({ type: "done", id: m.id, out });
  } else if (m.type === "exit") process.exit(0);
});
process.send({ type: "ready" });
