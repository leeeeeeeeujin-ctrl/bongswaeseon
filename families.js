// solver v2: the strategy-family store. A family is a role-slot template (roles.templateOf) with tags and a record of how well it did where it was found.
// Plans are clustered by slot layout (weighted Jaccard over the squares of their operators; blockers count double), and the best plan of each cluster is kept.
// Store: results/families/<STAGE>__<source>.json (one file per writer, so parallel jobs never touch the same file); loadFamilies merges all files of a stage.
"use strict";
const fs = require("fs");
const path = require("path");
const R = require("./roles.js");
const { S, TD } = R;
const FAM = path.join(R.RESULTS, "families");
const RUNGS = S.LADDER.slice().sort((a, b) => rank(a) - rank(b));
function rank(lv) { const [e, l] = S.parseLv(lv); return e * 1000 + l; }
const THRESH = +(process.env.FAM_DIST || 0.45), CAP = +(process.env.FAM_CAP || 12);

function tokens(T) { const m = new Map(); for (const [s] of R.primaries(T)) m.set(s.x * 100 + s.y, s.role.kind === "block" ? 2 : 1); return m; }
function dist(A, B) {
  const a = A instanceof Map ? A : tokens(A), b = B instanceof Map ? B : tokens(B); let inter = 0, uni = 0;
  for (const [k, w] of a) { if (b.has(k)) { inter += Math.min(w, b.get(k)); uni += Math.max(w, b.get(k)); } else uni += w; }
  for (const [k, w] of b) if (!a.has(k)) uni += w;
  return uni ? 1 - inter / uni : 0;
}
// quality: a 5-seed clear at a low rung first, then fewer lives lost; an unverified seed-1 result counts below any verified clear
function quality(rec) { const ri = RUNGS.indexOf(rec.lvl); const lost = rec.worstLost !== undefined && rec.worstLost !== null ? rec.worstLost : (rec.lost === undefined ? 9 : rec.lost) + 2;
  return -(ri < 0 ? 20 : ri) * 20 - Math.min(lost, 15) - (rec.verified ? 0 : 3); }

function tagsOf(T, ctx) {
  const prim = R.primaries(T).map(([s]) => s); const tags = [];
  const blk = prim.filter((s) => s.role.kind === "block"), rng = prim.filter((s) => s.role.tile === "h" && s.role.kind !== "heal"), heal = prim.filter((s) => s.role.kind === "heal");
  const W = ctx.W; let maxRoad = 0; ctx.traffic.forEach((v, i) => { if (v > 0 && ctx.depth[i] > maxRoad) maxRoad = ctx.depth[i]; }); maxRoad = maxRoad || 1;
  const depth = (s) => ctx.depth[s.y * W + s.x] < 0 ? -1 : ctx.depth[s.y * W + s.x] / maxRoad;
  if (!blk.length) tags.push("no blocker");
  else { const dd = blk.map(depth).filter((v) => v >= 0); const m = dd.length ? dd.reduce((a, b) => a + b, 0) / dd.length : 0.5; tags.push(m >= 0.5 ? "forward block" : "deep block"); }
  if (rng.length >= 2 * Math.max(1, blk.length)) tags.push("high-ground focus");
  // split lanes: blockers stand on the roads of different spawns and no one blocker sits on all of them
  if (blk.length >= 2 && ctx.paths.length >= 2) { const on = blk.map((s) => new Set(ctx.paths.map((p, i) => [p, i]).filter(([p]) => p.some((k) => Math.abs(((k / 100) | 0) - s.x) + Math.abs((k % 100) - s.y) <= 1)).map(([, i]) => i)));
    const uni = new Set(on.flatMap((x) => [...x])); if (uni.size >= 2 && !on.some((x) => x.size === uni.size)) tags.push("split lanes"); }
  if (!heal.length) tags.push("no medic");
  // boss answers: a timed skill near the boss, a late drop, a relocation
  if (ctx.bossT !== null && ctx.bossT !== undefined) { const b = ctx.bossT;
    if (prim.some((s) => s.skill && s.skill.m === 1 && Math.abs(s.skill.t - b) < 30)) tags.push("boss: timed skill");
    if (T.slots.some((s) => s.from !== undefined && s.from >= b - 15)) tags.push("boss: late deploy");
    if (T.retreats.length || T.slots.some((s) => s.prim !== T.slots.indexOf(s) && s.summonOf === undefined)) tags.push("boss: relocate"); }
  else if (T.retreats.length) tags.push("relocate");
  if (prim.some((s) => s.skill && s.skill.m === 3)) tags.push("skill held");
  return tags;
}

function famFile(stage, source) { return path.join(FAM, `${stage}__${source}.json`); }
function loadFile(stage, source) { return R.readJSON(famFile(stage, source), { stage, source, families: [] }); }
// every family of a stage, merged over all writers (re-clustered; the better representative wins)
function loadFamilies(stage) {
  let all = [];
  try { for (const f of fs.readdirSync(FAM)) if (f.startsWith(stage + "__") && f.endsWith(".json")) all = all.concat((R.readJSON(path.join(FAM, f), { families: [] }).families || [])); } catch (e) { /* none yet */ }
  return cluster(all, CAP);
}
function cluster(list, cap) {
  const sorted = list.slice().sort((a, b) => b.q - a.q); const out = [];
  for (const f of sorted) { const tk = tokens(f.T); const near = out.find((g) => dist(tk, g._tk) < THRESH); if (near) { near.members = (near.members || 1) + (f.members || 1); continue; } out.push(Object.assign({}, f, { _tk: tk, members: f.members || 1 })); }
  return out.slice(0, cap).map((f) => { const { _tk, ...g } = f; return g; });
}
let FID = 0;
const famId = (stage, T) => { const k = R.primaries(T).map(([s]) => s.x * 100 + s.y).sort((a, b) => a - b).join("."); let h = 0; for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `${stage}:${h.toString(36)}`; };
// add candidate plans ({plan, lvl, lost, worstLost, verified, src}) to a writer's file
function addPlans(stage, source, cands, ctx) {
  const F = loadFile(stage, source); const list = F.families.slice();
  for (const c of cands) { if (!c.plan || !c.plan.entries || !c.plan.entries.length) continue; const T = R.templateOf(c.plan); if (!R.primaries(T).length) continue;
    list.push({ id: famId(stage, T), T, tags: tagsOf(T, ctx), q: quality(c), rec: { lvl: c.lvl, lost: c.lost, worstLost: c.worstLost, verified: !!c.verified, deck: c.deck, crit: c.crit, gameHash: c.gameHash || R.GAMEHASH, ops: [...new Set(c.plan.entries.map((q) => q.id))] }, src: c.src || source }); }
  F.families = cluster(list, CAP * 2); F.updated = new Date().toISOString(); R.writeJSON(famFile(stage, source), F);
  return F.families.length;
}
function nearest(fams, plan) { const tk = tokens(R.templateOf(plan)); let best = null; for (const f of fams) { const d = dist(tk, tokens(f.T)); if (!best || d < best.d) best = { f, d }; } return best; }

module.exports = { tokens, dist, quality, tagsOf, loadFamilies, loadFile, addPlans, cluster, nearest, famId, RUNGS, rank, FAM };
