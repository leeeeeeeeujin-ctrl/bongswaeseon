#!/usr/bin/env node
// the GitHub Actions matrix for a dispatch: one job per stage (or per stage x deck for a search with split=stage-deck; per stage x deck x replicate with
// split=stage-deck-rep, replicates from `reps`: "3" = r0..r2, "3-5" = r3..r5, "1,4" = r1 and r4). mode=recover: no search jobs; the collect job merges the
// artifacts of an earlier run (its id in `extra`) and commits them.
//   node ci_matrix.js <mode> <stages> <decks> <split>   -> prints {"include":[{stage, deck, label}, ...]}
//   node ci_matrix.js --github <event>                 -> GITHUB_OUTPUT lines (matrix + every input), the inputs taken from the dispatch (env INPUTS)
//                                                         or, on a push, from ci/request.json
"use strict";
const STAGES = ["BL-01", "BL-02", "BL-03", "BL-04", "BL-05", "BL-06", "BL-07", "IM-01", "IM-02", "IM-03", "IM-04", "IM-05", "IM-06", "IM-07", "IM-08", "IM-09", "IM-10", "WL-01", "WL-02", "WL-03", "WL-04", "WL-05", "WL-06", "WL-07", "WL-08", "WL-09"];
const range = (s) => { const out = []; for (const part of (s || "IM-02..WL-09").split(",")) { const m = /^(.+)\.\.(.+)$/.exec(part.trim()); if (m) { for (let i = STAGES.indexOf(m[1]); i >= 0 && i <= STAGES.indexOf(m[2]); i++) out.push(STAGES[i]); } else if (part.trim()) out.push(part.trim()); } return [...new Set(out)]; };
const DEF = { mode: "search", stages: "IM-02..WL-09", decks: "starter,T4,T5,T6", crit: "lost1,full", squad: "", name: "", hours: "5.4", split: "stage", extra: "", reps: "", gamedir: "" };   // gamedir (request.json only): a game copy in the branch (variants/<name>); its results go to results/var/<name>
const repList = (s) => { s = String(s || "3").trim(); let m; if ((m = /^(\d+)-(\d+)$/.exec(s))) { const o = []; for (let k = +m[1]; k <= +m[2]; k++) o.push(k); return o; } if (s.includes(",")) return s.split(",").map((x) => +x); return [...Array(Math.max(1, +s || 3)).keys()]; };
let [mode, stages, decks, split, reps] = process.argv.slice(2); let IN = null;
if (mode === "--github") {
  let src = {}; if (stages === "push") {   // the request of the commit that triggered this run (GITHUB_SHA), not the branch head's: a later request pushed before this plan ran must not be read twice
    let txt = null; const sha = process.env.GITHUB_SHA, cp = require("child_process");
    if (sha) { try { cp.execSync(`git fetch -q --depth 1 origin ${sha}`, { stdio: "ignore" }); txt = cp.execSync(`git show ${sha}:ci/request.json`, { encoding: "utf8" }); } catch (e) { txt = null; } }
    try { src = JSON.parse(txt || require("fs").readFileSync("ci/request.json", "utf8")); } catch (e) { src = { mode: "none" }; } } else { try { src = JSON.parse(process.env.INPUTS || "{}") || {}; } catch (e) { src = {}; } }
  IN = Object.assign({}, DEF, src); for (const k of Object.keys(IN)) IN[k] = String(IN[k] === undefined || IN[k] === null ? "" : IN[k]).replace(/[\r\n]/g, " ");
  IN.hours = String(Math.min(5.5, Math.max(0.05, +IN.hours || 5.4)));
  [mode, stages, decks, split, reps] = [IN.mode, IN.stages, IN.decks, IN.split, IN.reps];
}
const st = mode === "akbench" || mode === "recover" ? [] : range(stages), dk = (decks || "starter,T4,T5,T6").split(",").filter(Boolean);
let inc;
if (mode === "none" || mode === "recover") inc = [{ stage: mode, deck: "none", label: mode, rep: "" }];
else if (mode === "akbench") {   // the private AK benchmark: one job per AK stage (x deck with split=stage-deck); codes from akbench.js (stage codes only, no AK data)
  // stage codes: AK benchmark codes (1-7, 4-2, ...) and/or our own stages (IM-02, IM-02..WL-09: an AK-operator deck on our stages; numbers only, like the AK ones)
  const AK = require("./akbench.js"), isAK = (s) => AK.BENCH.some((b) => b[0] === s.replace(/^AK/, ""));
  const list = !stages || stages === DEF.stages ? AK.BENCH.map((b) => b[0]) : stages.split(",").flatMap((p) => isAK(p.trim()) ? [p.trim().replace(/^AK/, "")] : range(p.trim()));
  inc = split === "stage-rep" ? list.flatMap((s) => repList(reps).map((k) => ({ stage: s, deck: dk.join(","), rep: String(k), label: `ak-${s}-r${k}` })))   // fewer, longer jobs: every deck of a stage x replicate in one job
    : split === "stage-deck-rep" ? list.flatMap((s) => dk.flatMap((d) => repList(reps).map((k) => ({ stage: s, deck: d, rep: String(k), label: `ak-${s}-${d}-r${k}` }))))
    : split === "stage-deck" ? list.flatMap((s) => dk.map((d) => ({ stage: s, deck: d, label: `ak-${s}-${d}` }))) : list.map((s) => ({ stage: s, deck: dk.join(","), label: `ak-${s}` }));
}
else if (mode === "trace") inc = [{ stage: "all", deck: "all", label: "trace" }];
else if (mode === "search" && split === "stage-deck-rep") inc = st.flatMap((s) => dk.flatMap((d) => repList(reps).map((k) => ({ stage: s, deck: d, rep: String(k), label: `${s}-${d}-r${k}` }))));
else if ((mode === "search" || mode === "recheck") && split === "stage-deck") inc = st.flatMap((s) => dk.map((d) => ({ stage: s, deck: d, label: `${s}-${d}` })));
else inc = st.map((s) => ({ stage: s, deck: dk.join(","), label: s }));
if (inc.length > 256) throw new Error("matrix too large: " + inc.length);
if (IN) { const lines = [`matrix=${JSON.stringify({ include: inc })}`]; for (const [k, v] of Object.entries(IN)) lines.push(`${k}=${v}`); process.stdout.write(lines.join("\n") + "\n"); }
else process.stdout.write(JSON.stringify({ include: inc }));
