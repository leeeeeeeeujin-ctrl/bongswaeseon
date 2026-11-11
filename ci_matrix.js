#!/usr/bin/env node
// the GitHub Actions matrix for a dispatch: one job per stage (or per stage x deck for a search with split=stage-deck)
//   node ci_matrix.js <mode> <stages> <decks> <split>   -> prints {"include":[{stage, deck, label}, ...]}
//   node ci_matrix.js --github <event>                 -> GITHUB_OUTPUT lines (matrix + every input), the inputs taken from the dispatch (env INPUTS)
//                                                         or, on a push, from ci/request.json
"use strict";
const STAGES = ["IM-02", "IM-03", "IM-04", "IM-05", "IM-06", "IM-07", "IM-08", "IM-09", "IM-10", "WL-01", "WL-02", "WL-03", "WL-04", "WL-05", "WL-06", "WL-07", "WL-08", "WL-09"];
const range = (s) => { const out = []; for (const part of (s || "IM-02..WL-09").split(",")) { const m = /^(.+)\.\.(.+)$/.exec(part.trim()); if (m) { for (let i = STAGES.indexOf(m[1]); i >= 0 && i <= STAGES.indexOf(m[2]); i++) out.push(STAGES[i]); } else if (part.trim()) out.push(part.trim()); } return [...new Set(out)]; };
const DEF = { mode: "search", stages: "IM-02..WL-09", decks: "starter,T4,T5,T6", crit: "lost1,full", squad: "", name: "", hours: "5.4", split: "stage", extra: "" };
let [mode, stages, decks, split] = process.argv.slice(2); let IN = null;
if (mode === "--github") {
  let src = {}; if (stages === "push") { try { src = JSON.parse(require("fs").readFileSync("ci/request.json", "utf8")); } catch (e) { src = { mode: "none" }; } } else { try { src = JSON.parse(process.env.INPUTS || "{}") || {}; } catch (e) { src = {}; } }
  IN = Object.assign({}, DEF, src); for (const k of Object.keys(IN)) IN[k] = String(IN[k] === undefined || IN[k] === null ? "" : IN[k]).replace(/[\r\n]/g, " ");
  IN.hours = String(Math.min(5.5, Math.max(0.05, +IN.hours || 5.4)));
  [mode, stages, decks, split] = [IN.mode, IN.stages, IN.decks, IN.split];
}
const st = range(stages), dk = (decks || "starter,T4,T5,T6").split(",").filter(Boolean);
let inc;
if (mode === "none") inc = [{ stage: "none", deck: "none", label: "none" }];
else if (mode === "trace") inc = [{ stage: "all", deck: "all", label: "trace" }];
else if ((mode === "search" || mode === "recheck") && split === "stage-deck") inc = st.flatMap((s) => dk.map((d) => ({ stage: s, deck: d, label: `${s}-${d}` })));
else inc = st.map((s) => ({ stage: s, deck: dk.join(","), label: s }));
if (inc.length > 256) throw new Error("matrix too large: " + inc.length);
if (IN) { const lines = [`matrix=${JSON.stringify({ include: inc })}`]; for (const [k, v] of Object.entries(IN)) lines.push(`${k}=${v}`); process.stdout.write(lines.join("\n") + "\n"); }
else process.stdout.write(JSON.stringify({ include: inc }));
