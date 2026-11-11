// akbench converter: an Arknights level file (+ the enemy database and handbook) -> a 봉쇄선 stage object, for a PRIVATE dev-only benchmark.
// This file holds no AK data; it reads AK files given to it at run time (local copies, or downloaded in a CI runner) and returns plain objects.
// Converted stages must never be committed, copied into the game, or uploaded anywhere (see akbench.js for the rules).
//
// Tile mapping (AK tile fields -> our tile chars):
//   tile_start                                  -> "S" (a gate)
//   tile_end                                    -> "B" (a defence point)
//   tile_flystart                               -> the char its fields give (usually "#"); fliers start there through their own fixed path. If a map has no
//                                                  ground start at all, the first flystart becomes "S" (the engine needs one gate)
//   tile_hole                                   -> "#" (walled off: ground foes route round it; a shove into a hole does not kill; flagged)
//   LOWLAND, passable (ALL/WALK_ONLY), MELEE/ALL -> "." (ground, melee deployable)   [ALL = melee+ranged: "*", flagged "ground_all"]
//   LOWLAND, passable, NONE                     -> "," (road only)
//   LOWLAND, passable, RANGED                   -> "*" (flagged: ours lets melee stand there too)
//   HIGHLAND, RANGED/ALL                        -> "h" (high ground, ranged deployable)
//   HIGHLAND, MELEE                             -> "h" (flagged)
//   LOWLAND, not passable, MELEE/ALL (fences)   -> "#" (flagged: we have no melee square that foes cannot walk)
//   anything else                               -> "#"
//   special tileKeys (healing, infection, grass, volcano, telin/telout, gazebo, bigforce, defup, crates, ...) keep the plain mapping and are flagged.
// Routes: every AK route becomes a fixed path (start, checkpoints, end) laid tile by tile with AK's own rule (8-neighbour Dijkstra between checkpoints,
//   diagonal steps only with both side squares walkable, when the route allows diagonals); fliers fly straight between checkpoints. WAIT_FOR_SECONDS
//   becomes a pause at that point; WAIT_FOR_PLAY_TIME / _FRAGMENT_TIME / _WAVE_TIME become a pause computed from the instant-kill timeline; DISAPPEAR..APPEAR_AT_POS
//   is walked straight (flagged). The loader (akload.js) puts the path on each foe at spawn (o.akPath); without the loader a foe uses the gate's BFS path.
// Waves: AK's model (waves in order, fragments in order, actions in parallel; unit k of an action at fragment start + preDelay + k*interval). Wave 1 times are
//   exact; later waves start when the previous one is cleared (the loader's gate; capped by maxTimeWaitingForNextWave) - their static times are the
//   instant-kill timeline. SPAWN actions only; unharmful (always-count-as-killed) units are left out; hidden groups only if a NORMAL/ALL rune enables them;
//   random groups keep the heaviest pack; branches are ignored.
// Enemies: AK stats at the stage's level (db level 0, then the level row, then overwrittenData; defined fields only), NORMAL/ALL ebuff_attribute runes applied.
//   hp maxHp, atk, def, res magicResistance, speed moveSpeed * moveMultiplier (tiles/s), interval baseAttackTime * 100 / attackSpeed, ranged rangeRadius
//   (applyWay RANGED), phys for ranged PHYSIC dealers, weight blockCnt (1 if undefined), mass from massLevel, life lifePointReduce, flying motion FLY,
//   elite/boss from levelType. Abilities (talents, skills, handbook abilityList) are NOT reproduced; they are listed in the stage report.
"use strict";

const WALK = new Set(["ALL", "WALK_ONLY"]);
const STD_TILES = new Set(["tile_road", "tile_wall", "tile_forbidden", "tile_start", "tile_end", "tile_flystart", "tile_floor", "tile_hole", "tile_fence", "tile_fence_bound", "tile_empty"]);
const MASS = (m) => (m === undefined || m === null ? 2 : m <= 0 ? 1 : m === 1 ? 2 : m <= 3 ? 3 : m <= 5 ? 4 : 5);   // AK massLevel -> ours (strag 1, soldier 2, heavy 3, boss 4)

function tileChar(t) {
  const k = t.tileKey, h = t.heightType, b = t.buildableType, p = WALK.has(t.passableMask);
  if (k === "tile_start") return { c: "S" };
  if (k === "tile_end") return { c: "B" };
  if (k === "tile_hole") return { c: "#", flag: "hole" };
  if (h === "LOWLAND" && p) {
    if (b === "MELEE") return { c: "." };
    if (b === "ALL") return { c: "*", flag: "ground_all" };
    if (b === "RANGED") return { c: "*", flag: "ground_ranged" };
    return { c: "," };
  }
  if (h === "HIGHLAND" && (b === "RANGED" || b === "ALL")) return { c: "h" };
  if (h === "HIGHLAND" && b === "MELEE") return { c: "h", flag: "high_melee" };
  if (h === "LOWLAND" && !p && (b === "MELEE" || b === "ALL")) return { c: "#", flag: "unwalkable_melee" };
  if (h === "HIGHLAND" && p) return { c: "#", flag: "walkable_high" };
  return { c: "#" };
}

// ---- enemies ----
function merge(dst, ed) {
  if (!ed) return;
  for (const k of ["name", "lifePointReduce", "levelType", "motion", "applyWay", "notCountInTotal", "rangeRadius", "talentBlackboard", "skills"]) { const f = ed[k]; if (f && typeof f === "object" && "m_defined" in f) { if (f.m_defined) dst[k] = f.m_value; } else if (f !== undefined && f !== null && (k === "talentBlackboard" || k === "skills")) dst[k] = f; }
  for (const [k, f] of Object.entries(ed.attributes || {})) if (f && f.m_defined) dst[k] = f.m_value;
}
function enemyStats(ref, db) {
  const rows = db[ref.id] || [], out = { id: ref.id, level: ref.level || 0, inDb: rows.length > 0 };
  const base = rows.find((r) => r.level === 0); if (base) merge(out, base.enemyData);
  if (ref.level) { const r = rows.find((q) => q.level === ref.level); if (r) merge(out, r.enemyData); else out.levelMissing = true; }
  if (ref.overwrittenData) { merge(out, ref.overwrittenData); out.overwritten = true; }
  if (out.lifePointReduce === undefined) out.lifePointReduce = 1;
  if (!out.levelType) out.levelType = "NORMAL";
  return out;
}
function runeMul(level) {   // NORMAL/ALL difficulty runes that scale every foe's stats
  const m = { atk: 1, def: 1, max_hp: 1, move_speed: 1, attack_speed: 0 }, other = [];
  for (const r of level.runes || []) { if (!["NORMAL", "ALL"].includes(r.difficultyMask)) continue;
    if (r.key === "ebuff_attribute" && !(r.blackboard || []).some((b) => b.key === "enemy")) { for (const b of r.blackboard || []) if (b.key in m) m[b.key] = b.key === "attack_speed" ? m[b.key] + b.value : m[b.key] * b.value; }
    else other.push(r.key); }
  return { m, other };
}
function enemyDef(st, hb, mm, rm) {
  const h = hb || {}, dmg = (h.damageType || [])[0] || null;
  const ranged = st.applyWay === "RANGED" && st.rangeRadius > 0;
  const aspd = (st.attackSpeed || 100) + rm.attack_speed;
  const d = { name: st.name || st.id, hp: Math.round((st.maxHp || 1) * rm.max_hp), atk: Math.round((st.atk || 0) * rm.atk), def: Math.round((st.def || 0) * rm.def), res: st.magicResistance || 0,
    speed: Math.round((st.moveSpeed || 0) * mm * rm.move_speed * 1000) / 1000, interval: Math.round((st.baseAttackTime || 2) * 100 / Math.max(1, aspd) * 100) / 100,
    weight: st.blockCnt !== undefined && st.blockCnt > 0 ? st.blockCnt : 1, mass: MASS(st.massLevel), life: st.lifePointReduce, ak: { id: st.id, level: st.level } };
  if (st.motion === "FLY") d.flying = true;
  if (ranged) { d.ranged = st.rangeRadius; if (dmg === "PHYSIC") d.phys = true; }
  if (st.levelType === "ELITE") d.elite = true;
  if (st.levelType === "BOSS") d.boss = true;
  const notes = [];
  if (st.applyWay === "NONE" || dmg === "NO_DAMAGE") { d.atk = 0; d.interval = 99; }
  if (dmg === "HEAL") { d.atk = 0; d.interval = 99; notes.push("healer (heals not reproduced, set harmless)"); }
  if (dmg === "MAGIC" && !ranged && d.atk > 0) notes.push("melee arts damage (ours: physical)");
  if (ranged && dmg === "MAGIC" && d.phys) delete d.phys;
  if (st.hpRecoveryPerSec > 0) notes.push(`regen ${st.hpRecoveryPerSec}/s (not reproduced)`);
  if (st.epDamageResistance || st.epResistance) notes.push("elemental stats (not reproduced)");
  if (st.talentBlackboard && st.talentBlackboard.length) notes.push("talents: " + [...new Set(st.talentBlackboard.map((b) => b.key.split(".")[0]))].slice(0, 4).join("/"));
  if (st.skills && st.skills.length) notes.push("skills: " + st.skills.map((s) => s.prefabKey).slice(0, 4).join("/"));
  const ab = (h.abilityList || []).length; if (ab) notes.push(`${ab} handbook abilities`);
  if (st.levelMissing) notes.push("level row missing (base stats)");
  if (!st.inDb) notes.push("not in the enemy database");
  // what kind of ability (for the approximate flag): decisive kinds change what a squad needs; the rest shift numbers a little
  const txt = [(h.abilityList || []).map((a) => a.text || "").join(" "), (st.talentBlackboard || []).map((b) => b.key).join(" "), (st.skills || []).map((s) => s.prefabKey).join(" ")].join(" ").replace(/<[^>]*>/g, "");
  const kinds = [];
  for (const [k, rx] of Object.entries(KINDS)) if (rx.test(txt)) kinds.push(k);
  if (st.hpRecoveryPerSec > 0) kinds.push("regen");
  if (st.levelType === "BOSS") kinds.push("boss");
  return { d, notes, abilities: ab, dmg, kinds };
}
const KINDS = { stealth: /invisib|stealth|camouflag/i, reborn: /reborn|deathrattle|revive|rebirth/i, dmgres: /dmg_res|greatly reduced|refract|damage immun|shield/i, control: /paraly|stun|lasso|freez|sleep|silence|bind/i,
  aura: /aura|increases the atk|defup|inspire[sd]? (allied|nearby)|increases the atk and def/i, mobility: /blink|move behind|teleport|charge|dash/i, splash: /area damage|surrounding|cardinal tiles|two targets|additional target/i };
const DECISIVE = new Set(["stealth", "reborn", "dmgres", "control", "mobility", "boss"]);

// ---- map and paths ----
class Grid {
  constructor(md) { this.m = md.map; this.tiles = md.tiles; this.H = this.m.length; this.W = this.H ? this.m[0].length : 0; }
  tile(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H ? this.tiles[this.m[y][x]] : null; }
  walk(x, y) { const t = this.tile(x, y); return !!t && WALK.has(t.passableMask); }
  // AK (row, col) with row 0 at the bottom -> our (x, y) with y 0 at the top
  xy(pos) { return [pos.col, this.H - 1 - pos.row]; }
  // the octile shortest path (a list of squares) from a to b; null if there is none
  path(a, b, diag) {
    const W = this.W, key = (x, y) => y * W + x, dist = new Map([[key(a[0], a[1]), 0]]), prev = new Map();
    const heap = [[0, a[0], a[1]]], S2 = Math.SQRT2;
    const push = (n) => { heap.push(n); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    while (heap.length) {
      const [d, x, y] = pop(); if (d > dist.get(key(x, y)) + 1e-9) continue;
      if (x === b[0] && y === b[1]) { const out = [[x, y]]; let k = key(x, y); while (prev.has(k)) { k = prev.get(k); out.push([k % W, (k / W) | 0]); } return out.reverse(); }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = x + dx, ny = y + dy, dg = dx && dy;
        if (dg && !(diag && this.walk(x + dx, y) && this.walk(x, y + dy))) continue;
        if (!this.walk(nx, ny) && !(nx === b[0] && ny === b[1])) continue;
        const nd = d + (dg ? S2 : 1), nk = key(nx, ny);
        if (nd < (dist.has(nk) ? dist.get(nk) : 1e18) - 1e-9) { dist.set(nk, nd); prev.set(nk, key(x, y)); push([nd, nx, ny]); }
      }
    }
    return null;
  }
}
const segLen = (p) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; };

// a route -> { pts: [[x,y]...], legs: [{i, kind, v}], flags } ; pts are the squares walked (tile centres), legs mark waits at point index i
function routeGeometry(g, rt) {
  const fly = rt.motionMode === "FLY", diag = rt.allowDiagonalMove !== false, flags = new Set();
  let pos = g.xy(rt.startPosition); const pts = [pos.slice()], waits = []; let hidden = false;
  const go = (dst) => {
    if (dst[0] === pos[0] && dst[1] === pos[1]) return;
    if (hidden || fly) { pts.push(dst.slice()); pos = dst; return; }
    const p = g.path(pos, dst, diag);
    if (!p) { flags.add("unreachable_leg"); pts.push(dst.slice()); } else for (const q of p.slice(1)) pts.push(q);
    pos = dst;
  };
  for (const cp of rt.checkpoints || []) {
    const p = cp.position ? g.xy(cp.position) : pos;
    switch (cp.type) {
      case "MOVE": case "PATROL_MOVE": go(p); if (cp.type === "PATROL_MOVE") flags.add("patrol"); break;
      case "WAIT_FOR_SECONDS": waits.push({ i: pts.length - 1, kind: "s", v: cp.time }); break;
      case "WAIT_FOR_PLAY_TIME": waits.push({ i: pts.length - 1, kind: "play", v: cp.time }); break;
      case "WAIT_CURRENT_FRAGMENT_TIME": waits.push({ i: pts.length - 1, kind: "frag", v: cp.time }); break;
      case "WAIT_CURRENT_WAVE_TIME": waits.push({ i: pts.length - 1, kind: "wave", v: cp.time }); break;
      case "DISAPPEAR": hidden = true; flags.add("disappear"); break;
      case "APPEAR_AT_POS": hidden = false; go(p); break;
      default: flags.add("cp_" + cp.type);
    }
  }
  go(g.xy(rt.endPosition));
  return { pts, waits, fly, flags: [...flags], len: segLen(pts), start: g.xy(rt.startPosition), end: g.xy(rt.endPosition) };
}

// ---- waves (AK timing; the instant-kill timeline = the real one for wave 1) ----
function activeActions(frag, enabled) {
  const acts = frag.actions.filter((a) => a.actionType === "SPAWN" && (!a.hiddenGroup || enabled.has(a.hiddenGroup)));
  const plain = [], groups = new Map();
  for (const a of acts) { if (a.randomSpawnGroupKey) { if (!groups.has(a.randomSpawnGroupKey)) groups.set(a.randomSpawnGroupKey, []); groups.get(a.randomSpawnGroupKey).push(a); } else plain.push(a); }
  const out = plain.slice();
  for (const opts of groups.values()) { const packs = new Map(); opts.forEach((a, i) => { const k = a.randomSpawnGroupPackKey || "#" + i; if (!packs.has(k)) packs.set(k, []); packs.get(k).push(a); });
    let best = null, bw = -1; for (const p of packs.values()) { const w = Math.max(...p.map((a) => a.weight || 0)); if (w > bw) { bw = w; best = p; } } out.push(...best); }
  return { acts: out, random: groups.size > 0 };
}

// level: the AK level JSON; db: {enemyId: rows}; hb: handbook enemyData; meta: {code, name, levelId}
function convertLevel(level, db, hb, meta) {
  const md = level.mapData, g = new Grid(md), H = g.H, W = g.W, opt = level.options || {};
  const flags = new Set(), tileFlags = {}, special = {};
  const rows = [];
  for (let y = 0; y < H; y++) { let r = ""; for (let x = 0; x < W; x++) { const t = g.tile(x, y), m = tileChar(t); r += m.c; if (m.flag) tileFlags[m.flag] = (tileFlags[m.flag] || 0) + 1; if (!STD_TILES.has(t.tileKey)) special[t.tileKey] = (special[t.tileKey] || 0) + 1; } rows.push(r); }
  // gates: the engine wants at least one; fly-only maps get their first flystart as a gate
  const findAll = (ch) => { const o = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rows[y][x] === ch) o.push([x, y]); return o; };
  if (!findAll("S").length) { outer: for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g.tile(x, y).tileKey === "tile_flystart") { rows[y] = rows[y].slice(0, x) + "S" + rows[y].slice(x + 1); flags.add("flystart_as_gate"); break outer; } }
  const gates = findAll("S"), bases = findAll("B");
  if (!bases.length) flags.add("no_defence_point");
  const gateOf = (p) => { let best = 0, bd = 1e9; gates.forEach((q, i) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = i; } }); return best; };
  // runes
  const rune = runeMul(level); for (const k of rune.other) flags.add("rune:" + k);
  let maxCost = opt.maxCost; for (const r of level.runes || []) if (["NORMAL", "ALL"].includes(r.difficultyMask) && r.key === "cbuff_max_cost") { const b = (r.blackboard || []).find((q) => q.key === "value"); if (b) maxCost = b.value; }
  const enabled = new Set(); for (const r of level.runes || []) if (["NORMAL", "ALL"].includes(r.difficultyMask) && r.key === "level_hidden_group_enable") for (const b of r.blackboard || []) if (b.valueStr) enabled.add(b.valueStr);
  for (const r of level.runes || []) if (["NORMAL", "ALL"].includes(r.difficultyMask) && r.key === "level_hidden_group_disable") for (const b of r.blackboard || []) if (b.valueStr) enabled.delete(b.valueStr);
  // enemies
  const mm = opt.moveMultiplier || 0.5, enemies = {}, enemyNotes = {}, keyOf = {};
  const tag = String(meta.code).replace(/[^\w-]/g, "_");
  for (const ref of level.enemyDbRefs || []) {
    const st = enemyStats(ref, db), h = hb[ref.id] || null, e = enemyDef(st, h, mm, rune.m);
    const key = `ak_${tag}_${ref.id.replace(/^enemy_/, "")}`; keyOf[ref.id] = key; enemies[key] = e.d; enemyNotes[key] = { notes: e.notes, abilities: e.abilities, dmg: e.dmg, kinds: e.kinds };
  }
  // routes
  const geo = (level.routes || []).map((rt) => rt ? routeGeometry(g, rt) : null);
  // waves -> entries
  const entries = [], waves = [];
  let clock = 0, randomUsed = false, unharmful = 0, nTotal = 0;
  for (let wi = 0; wi < (level.waves || []).length; wi++) {
    const w = level.waves[wi], wave0 = clock; let cur = clock + (w.preDelay || 0), block = 0;
    for (const fr of w.fragments || []) {
      const fs = cur + (fr.preDelay || 0); const { acts, random } = activeActions(fr, enabled); randomUsed = randomUsed || random;
      let span = 0; for (const a of fr.actions) span = Math.max(span, (a.preDelay || 0) + Math.max(a.count - 1, 0) * (a.interval || 0));
      let fend = fs + span;
      for (const a of acts) {
        if (a.blockFragment) flags.add("blockFragment");
        const key = keyOf[a.key]; const r = geo[a.routeIndex];
        if (!key) { flags.add("enemy_not_in_refs"); continue; }
        if (!r) { flags.add("missing_route"); continue; }
        for (let k = 0; k < a.count; k++) {
          const t = fs + (a.preDelay || 0) + k * (a.interval || 0);
          nTotal++;
          if (a.isUnharmfulAndAlwaysCountAsKilled) { unharmful++; continue; }
          entries.push({ t, key, route: a.routeIndex, wave: wi, rel: t - wave0, frag: fs, waveStart: wave0, dontBlock: !!a.dontBlockWave });
          block = Math.max(block, t);
        }
      }
      cur = fend;
    }
    let end = Math.max(cur, block); if ((w.maxTimeWaitingForNextWave ?? -1) >= 0) end = Math.min(end, cur + w.maxTimeWaitingForNextWave);
    waves.push({ start: wave0, span: cur - wave0, post: w.postDelay || 0, maxWait: w.maxTimeWaitingForNextWave ?? -1 });
    clock = end + (w.postDelay || 0);
  }
  if (randomUsed) flags.add("random_groups");
  if ((level.branches && Object.keys(level.branches).length)) flags.add("branches_ignored");
  if (waves.length > 1) flags.add("multi_wave_gate");
  for (const q of [...((level.predefines || {}).characterInsts || []), ...((level.predefines || {}).tokenInsts || [])]) flags.add("predefined:" + String((q.inst || {}).characterKey || "?").replace(/^(trap|char|token)_\d+_/, ""));
  // the fixed paths (with pauses) per entry; shared between entries with the same route and pause timing
  const pathCache = new Map(), routeFlags = new Set();
  const pathFor = (en) => {
    const r = geo[en.route], d = enemies[en.key]; let waits = {};
    if (r.waits.length) { const sp = d.speed > 0 ? d.speed : 0.5; let tt = en.t, last = 0;
      for (const wq of r.waits) { tt += segLen(r.pts.slice(last, wq.i + 1)) / sp; last = wq.i;
        const v = wq.kind === "s" ? wq.v : Math.max(0, (wq.kind === "play" ? wq.v : wq.kind === "frag" ? en.frag + wq.v : en.waveStart + wq.v) - tt);
        if (v > 0) { waits[wq.i] = (waits[wq.i] || 0) + Math.round(v * 100) / 100; tt += v; } } }
    const k = en.route + "|" + JSON.stringify(waits); if (pathCache.has(k)) return pathCache.get(k);
    const p = r.pts.map((q) => q.slice()); if (Object.keys(waits).length) p.waits = waits;
    const out = { pts: p, waits: Object.keys(waits).length ? waits : null }; pathCache.set(k, out); return out;
  };
  const waveRows = [];
  for (const en of entries.sort((a, b) => a.t - b.t || a.wave - b.wave)) {
    const r = geo[en.route]; for (const f of r.flags) routeFlags.add(f);
    const P = pathFor(en);
    waveRows.push([Math.round(en.t * 1000) / 1000, en.key, gateOf(r.start), { akPath: P.pts, akWaits: P.waits, akw: en.wave, akrel: Math.round(en.rel * 1000) / 1000 }]);
  }
  for (const f of routeFlags) flags.add("route:" + f);
  if (Object.keys(special).length) flags.add("special_tiles");
  const stage = {
    code: "AK" + meta.code, name: meta.name || meta.code, map: rows, bg: null, hz: 0.5, boss: ["", ""], desc: "", lose: "",
    waves: waveRows, startCost: opt.initialCost || undefined, costRate: opt.costIncreaseTime ? 1 / opt.costIncreaseTime : 1, deployLimit: opt.characterLimit || 8,
    ak: { code: meta.code, levelId: meta.levelId, life: opt.maxLifePoint, startCost: opt.initialCost, maxCost, waves, nTotal, unharmful },
  };
  // the report (numbers and flags only)
  const used = new Set(waveRows.map((w) => w[1]));
  const foes = [...used].map((k) => ({ key: k, n: waveRows.filter((w) => w[1] === k).length, boss: !!enemies[k].boss, elite: !!enemies[k].elite, flying: !!enemies[k].flying, notes: enemyNotes[k].notes, abilities: enemyNotes[k].abilities, kinds: enemyNotes[k].kinds }));
  const hpAll = waveRows.reduce((s, w) => s + enemies[w[1]].hp, 0);
  const hpAb = waveRows.reduce((s, w) => s + (enemyNotes[w[1]].kinds.some((k) => DECISIVE.has(k)) ? enemies[w[1]].hp : 0), 0);
  const nAb = waveRows.filter((w) => enemyNotes[w[1]].kinds.some((k) => DECISIVE.has(k))).length;
  const report = { code: meta.code, levelId: meta.levelId, size: [W, H], gates: gates.length, bases: bases.length, tileFlags, special, flags: [...flags].sort(),
    routes: geo.map((r, i) => r ? { i, fly: r.fly, len: Math.round(r.len * 100) / 100, flags: r.flags } : null).filter(Boolean),
    nEntries: waveRows.length, nTotal, unharmful, waves: waves.length, bosses: foes.filter((f) => f.boss).reduce((s, f) => s + f.n, 0), fliers: foes.filter((f) => f.flying).reduce((s, f) => s + f.n, 0),
    abilityHpShare: hpAll ? Math.round(hpAb / hpAll * 100) / 100 : 0, abilityShare: waveRows.length ? Math.round(nAb / waveRows.length * 100) / 100 : 0,
    kinds: [...new Set(foes.flatMap((f) => f.kinds))].sort(), decisive: [...new Set(foes.flatMap((f) => f.kinds.filter((k) => DECISIVE.has(k))))].sort(), foes, life: opt.maxLifePoint, startCost: opt.initialCost, deployLimit: opt.characterLimit, maxCost };
  return { stage, enemies, report };
}

// the approximate flag: a stage whose result leans on what we do not reproduce
function approxReasons(rep) {
  const why = [];
  if (rep.bosses) why.push("boss");
  const share = Math.max(rep.abilityHpShare, rep.abilityShare);
  if (share >= 0.2 && rep.decisive.filter((k) => k !== "boss").length) why.push(`${rep.decisive.filter((k) => k !== "boss").join("/")} on ${Math.round(share * 100)}% of foes`);
  const sp = Object.keys(rep.special || {}).filter((k) => !/^tile_(rcm_|grass)/.test(k)); if (sp.length) why.push("special tiles: " + sp.map((k) => k.replace(/^tile_/, "")).join(","));
  if ((rep.special || {}).tile_grass) why.push("grass (stealth squares)");
  for (const f of rep.flags) if (/^(route:disappear|branches_ignored|blockFragment|rune:|random_groups|route:unreachable_leg)/.test(f) || /^predefined:.*(ballis|gun|cannon|catapult|mortar)/.test(f)) why.push(f.replace(/^predefined:/, "device ignored: "));
  if (rep.tileFlags.hole) why.push("holes");
  return why;
}

module.exports = { convertLevel, approxReasons, tileChar, Grid, routeGeometry, segLen, MASS };
