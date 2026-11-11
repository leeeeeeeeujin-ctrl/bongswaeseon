#!/usr/bin/env node
// speed of this machine for the solver: W worker processes each play the same full run (im_sim's IM-05 plan at E1L15, 30 fps, no pruning) N times
//   node bench2.js [--workers W] [--n 6]  -> evals/s for the whole machine, ms per eval per worker
"use strict";
const os = require("os");
const G = require("./ga.js");
const argv = process.argv.slice(2); const opt = (k, d) => { const i = argv.indexOf("--" + k); return i >= 0 ? +argv[i + 1] : d; };
(async () => {
  const W = opt("workers", os.cpus().length), N = opt("n", 6); const pool = new G.Pool(W); await pool.started;
  const plan = G.pPlan("IM-05"); const jobs = Array.from({ length: W * N }, () => ({ code: "IM-05", lvl: "E1L15", plan, opt: { seed: 1 } }));
  await pool.all(jobs.slice(0, W));   // warm-up
  const t = Date.now(); const rs = await pool.all(jobs); const s = (Date.now() - t) / 1000; pool.close();
  const out = { host: os.hostname(), cpus: os.cpus().length, model: (os.cpus()[0] || {}).model, workers: W, evals: rs.length, secs: Math.round(s * 100) / 100, evalsPerSec: Math.round(rs.length / s * 100) / 100, msPerEvalPerWorker: Math.round(s * 1000 * W / rs.length), lost: rs[0].lost, frames: rs[0].frames };
  console.log(JSON.stringify(out));
})();
