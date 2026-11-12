#!/usr/bin/env node
// akops: Arknights 3★/4★ operators as 봉쇄선 units, for the PRIVATE akbench control experiment (does an AK deck clear what ours clears?).
// RULES: this file holds no AK data. It reads character_table / skill_table / range_table at run time (local private copies, or downloaded inside a CI runner)
// and writes a private JSON (S/akbench/private/akops.json, or $RUNNER_TEMP in CI). That JSON, and any plan / replay that names its operators, never goes into a
// repo, the game folder, a site, a CI artifact or a log. Only derived numbers (min rung, life lost, win time) leave the machine or runner.
//   node akops.js fetch --out DIR                      DIR/en_US/gamedata/excel/{character,skill,range}_table.json from Kengxxiao/ArknightsGameData_YoStar
//   node akops.js convert --raw EXCELDIR --out FILE    -> FILE {ops, ranges, decks, report} (rarity 3 and 4, obtainable, "char_" only)
//   node akops.js report --file FILE                   what each operator kept, approximated or dropped
//   node akops.js dps --file FILE [--ids a,b] [--def 0,200] [--lv E0L1,E1L55]   plain-attack DPS (no skill), for the spot check
// Loading: sim.js calls install(TD, FILE) when AKOPS=FILE is set (after akload). The ops join TD.UNITS in memory (ids "ak_<name>"); nothing in the game changes.
//
// MAPPING (AK -> ours)
//  stats      attributesKeyFrames [lv1, lvMax] per phase -> d.kf (hp, atk, def), linear in level exactly like TD.growth (E0 cap 40 for 3★, 45 for 4★; E1 55 / 60;
//             E2 70; our rung ladder clamps there, as for our own 3★/4★). res, block, range, interval (baseAttackTime*100/attackSpeed) per phase; cost E0 + d.eliteCost
//             (E1 - E0; E2's own cost is not expressible and is reported); respawnTime -> redeploy. No potential, no trust (as ours: pot 1, no trust).
//  profession PIONEER 선봉, WARRIOR 근위, TANK 중장, SNIPER 저격, CASTER 술사, MEDIC 의무, SUPPORT 보조, SPECIAL 특수; position MELEE -> tile "g", RANGED -> "h".
//             damage: MEDIC heal; CASTER, SUPPORT (not craftsman), artsfghter, artsprotector arts; else phys.
//  branch     charger: killCost 1 + full refund (our Vigna/rabi6 logic); centurion: cleave (hits everyone it blocks, our hiro logic); lord: may hit fliers + 80% damage
//             beyond the adjacent tiles; fastshot: airFirst; longrange: lowDefFirst; aoesniper: lob splash r 1.0 (our capy logic); splashcaster: splashArts 1.0
//             (full arts damage to foes within 1.2 of the target); slower: slow 0.8 for 0.8 s on hit (trait); sword: two blows per attack (double);
//             ringhealer: heals 3 (multiHeal); unyield: no heals from others (noHeal); stalker: dodge 0.5 (approx. of camouflage/dodge).
//             Everything else plays as its class's plain logic (listed per operator in the report).
//  skills     S1 (and S2 from E1, 4★) at the rung's skill level (sim.skillRank: E0L1 lv1, E0L20 lv2, E0L40 lv4, E1L1 lv4, E1L15 lv5, E1L30 lv6, E1L40+ lv7; E2 L20/30/40 M1-M3
//             for 4★) with AK's own numbers at that level (sp, initial sp, duration, blackboard). Effects we can express (our existing mechanics):
//               buff (dur > 0): atk -> atkMul; attack_speed -> speed; def -> defMul; base_attack_time (delta s) -> ivMul; block_cnt (+n) -> blockAdd; attack@atk_scale -> atkMul;
//                 DP over the duration (value / cost, our h_flow logic); self or in-range regen per second (hp_recovery_per_sec[_by_max_hp_ratio], our s.heal logic);
//                 "deal Arts damage" -> damage type arts while up; guardian / "heals ... instead of attacking" -> heals instead of attacking while up; range forward extend;
//                 aoesniper splash radius scale.
//               instant (dur 0): cost -> DP now (our vanguard logic); atk_scale [x times] -> the next attack's multiplier (our hr_brave logic); force -> push the foes on the
//                 two front tiles (our specialist logic: force 2 + AK force, no stun); heal_scale on a non-medic -> heal self % max HP (our defender cure); heal_scale on a
//                 medic -> heal everyone in range by heal_scale x ATK (our m_bless logic).
//             Not expressed (kept as the nearest above, or nothing; listed per skill): max_hp changes, max_target/extra targets, stun/slow/silence on attack, dodge,
//             taunt, talent_scale, summons, reinforcements, charges, poison, global range, damage_scale, "cannot be healed", projectile clouds.
//  talents    the pot-0 candidate of each talent row at the rung (phase, level). Kept when a ";"-separated part is a plain self stat: ATK/DEF/Max HP +x%, ASPD +x,
//             RES +x, DP Cost -x, "obtains n Skill Points after deployment"; and crit-like "x% chance ... to y%" as the expected value on ATK (approx). Others listed.
"use strict";
const fs = require("fs");
const path = require("path");

const SRC = "https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData_YoStar/main/en_US/gamedata/excel";
const TABLES = ["character_table.json", "skill_table.json", "range_table.json"];
// AKstart: the new-player 3★ set (tutorial gifts + the early recruit / standard banner 3★s), by AK char id; Amiya (5★) excluded
const AKSTART = ["char_123_fang", "char_240_wyvern", "char_192_falco", "char_208_melan", "char_281_popka", "char_283_midn", "char_210_stward", "char_121_lava",
  "char_120_hibisc", "char_212_ansel", "char_124_kroos", "char_211_adnach", "char_278_orchid", "char_282_catap", "char_284_spot", "char_122_beagle", "char_209_ardign"];
const PROF = { PIONEER: "선봉", WARRIOR: "근위", TANK: "중장", SNIPER: "저격", CASTER: "술사", MEDIC: "의무", SUPPORT: "보조", SPECIAL: "특수" };
const RAR = (r) => typeof r === "number" ? r + 1 : +String(r).replace("TIER_", "");
const PH = (p) => typeof p === "number" ? p : +String(p).replace("PHASE_", "");
const plain = (s) => String(s || "").replace(/<[^>]*>/g, "").replace(/\\n/g, " ").replace(/\n/g, " ");

const argv = process.argv.slice(2); const A = { _: [] }; for (let i = 0; i < argv.length; i++) { const s = argv[i]; if (s.startsWith("--")) { const n = argv[i + 1]; if (n === undefined || n.startsWith("--")) A[s.slice(2)] = true; else { A[s.slice(2)] = n; i++; } } else A._.push(s); }

async function fetchAll(out) {
  const dir = path.join(out, "en_US", "gamedata", "excel"); fs.mkdirSync(dir, { recursive: true }); let n = 0;
  for (const f of TABLES) { const dst = path.join(dir, f); if (fs.existsSync(dst) && fs.statSync(dst).size > 0) { n++; continue; }
    let ok = false; for (let a = 0; a < 4 && !ok; a++) { try { const r = await fetch(`${SRC}/${f}`); if (!r.ok) throw new Error("HTTP " + r.status); fs.writeFileSync(dst, Buffer.from(await r.arrayBuffer())); ok = true; } catch (e) { if (a === 3) throw new Error("fetch failed: " + e.message); await new Promise((r) => setTimeout(r, 2000 * (a + 1))); } }
    n++; }
  console.log(`akops: ${n} tables ready`);
  return dir;
}

// ---------- skills ----------
function convSkillLevel(L, op, ctx) {
  const bb = {}; for (const b of L.blackboard || []) bb[b.key] = b.value;
  const desc = plain(L.description);
  const st = L.skillType, mode = st === "MANUAL" || st === 1 ? "manual" : st === "AUTO" || st === 2 ? "auto" : "passive";
  const spT = L.spData.spType, spType = /ATTACK/.test(spT) || spT === 2 ? "atk" : /TAKEN|DEFENSE/.test(spT) || spT === 4 ? "hit" : undefined;
  const dur = L.duration > 0 ? L.duration : 0;
  const s = { name: L.name, desc, sp: Math.max(1, L.spData.spCost || 1), init: L.spData.initSp || 0, mode, dur };
  if (spType) s.spType = spType;
  const fx = {}, used = new Set(), miss = [];
  const take = (k) => { used.add(k); return bb[k]; };
  if (mode === "passive") { s.sp = 999; s.init = 0; s.dur = 0; miss.push("passive skill (not expressed)"); }
  else if (dur > 0) {
    if (bb.atk !== undefined) fx.atkMul = 1 + take("atk");
    if (bb["attack@atk_scale"] !== undefined && !/Arts damage to the target per second/.test(desc)) fx.atkMul = (fx.atkMul || 1) * take("attack@atk_scale");
    if (bb.attack_speed !== undefined) fx.speed = 1 + take("attack_speed") / 100;
    if (bb.def !== undefined) fx.defMul = 1 + take("def");
    if (bb.base_attack_time !== undefined) fx.ivMul = Math.max(0.15, (ctx.bat + take("base_attack_time")) / ctx.bat);
    if (bb.block_cnt !== undefined) { if (bb.block_cnt > 0) fx.blockAdd = take("block_cnt"); else miss.push("block_cnt " + bb.block_cnt); }
    const dpTot = bb.value !== undefined && bb.cost !== undefined ? (take("value"), take("cost"), bb.value) : null;
    if (dpTot) fx.dpOver = dpTot;
    else if (bb.cost !== undefined) { fx.dpNow = take("cost"); }
    if (bb["blackd_s_2[once].cost"] !== undefined) { fx.dpNow = take("blackd_s_2[once].cost"); fx.dpOver = take("blackd_s_2[period].trig_cnt") * (take("blackd_s_2[period].cost") || 1); if (bb["blackd_s_2[period].def"] !== undefined) fx.defMul = 1 + take("blackd_s_2[period].def"); take("blackd_s_2[period].interval"); }
    if (bb.hp_recovery_per_sec_by_max_hp_ratio !== undefined) fx.regenPct = take("hp_recovery_per_sec_by_max_hp_ratio");
    if (bb.hp_recovery_per_sec !== undefined) fx.regenFlat = take("hp_recovery_per_sec");
    if (bb.ability_range_forward_extend !== undefined) fx.rangeExt = take("ability_range_forward_extend");
    if (bb["attack@range_scale"] !== undefined) fx.lobScale = take("attack@range_scale");
    if (/turn into Arts damage|attacks deal Arts damage|as Arts damage|Changes damage type to Arts/.test(desc) && op.dmg === "phys") fx.dmgMode = "arts";
    if ((op.sub === "guardian" && /heal/i.test(desc)) || /heals allied units instead of attacking/.test(desc)) fx.healMode = true;
    if (/Stops attacking/.test(desc) && !fx.healMode) fx.noAttack = true;
  } else {   // instant / next attack
    if (bb.cost !== undefined) fx.dpNow = take("cost");
    if (bb.force !== undefined) { fx.push = 2 + take("force"); fx.mul = bb.atk_scale !== undefined ? take("atk_scale") : 1; }
    else if (bb.atk_scale !== undefined && op.dmg !== "heal") { fx.next = take("atk_scale"); if (bb.times) fx.times = take("times"); }
    if (bb.heal_scale !== undefined) { if (op.dmg === "heal" || op.sub === "guardian") fx.healAll = take("heal_scale"); else fx.selfHeal = take("heal_scale"); }
  }
  for (const k of Object.keys(bb)) if (!used.has(k)) miss.push(k + "=" + bb[k]);
  if (/Range \+|Attack Range becomes global|range changes|Range expands|Range reduced/i.test(desc) && !fx.rangeExt) miss.push("range change");
  s.akfx = fx;
  // the plain fields the solver's own numbers read (roles.opStats): atk, speed, def, mul, dp, cure
  if (fx.atkMul) s.atk = fx.atkMul; if (fx.speed) s.speed = fx.speed; if (fx.defMul) s.def = fx.defMul;
  if (fx.next) s.mul = fx.next * (fx.times || 1); if (fx.push) s.mul = fx.mul;
  if (fx.selfHeal) s.cure = fx.selfHeal;
  if (dur > 0) { if (fx.dpOver) s.dp = fx.dpOver; }   // spread over the duration by the engine's own s.dp loop (an instant part is paid in useSkill)
  else if (fx.dpNow) s.dp = fx.dpNow;
  s.akMiss = miss;
  const mapped = Object.keys(fx).length > 0;
  return { s, mapped, miss };
}

// ---------- talents ----------
// rows -> [{ph, lv, eff:{atk,hp,def,aspd,res,cost,sp,crit:[p,scale]}, text, kept, dropped}] (pot-0 candidates)
function convTalents(c) {
  const out = [];
  for (const [ti, t] of (c.talents || []).entries()) for (const q of t.candidates || []) {
    if (q.requiredPotentialRank) continue;
    const bb = {}; for (const b of q.blackboard || []) bb[b.key] = b.value;
    const d = plain(q.description), eff = {}, kept = [], dropped = [];
    for (const part of d.split(/;\s*/)) {
      const p = part.trim(); let m;
      if ((m = /^(?:Max HP \+([\d.]+)%(?:\s*\([^)]*\))?)$/.exec(p))) { eff.hp = (bb.max_hp ?? +m[1] / 100); kept.push(p); }
      else if ((m = /^(?:Max HP \+([\d.]+)%(?:\s*\([^)]*\))?,? ATK \+([\d.]+)%(?:\s*\([^)]*\))?)$/.exec(p))) { eff.hp = bb.max_hp; eff.atk = bb.atk; kept.push(p); }
      else if (/^ATK \+[\d.]+%(\s*\([^)]*\))?$/.test(p)) { eff.atk = bb.atk; kept.push(p); }
      else if (/^DEF \+[\d.]+%(\s*\([^)]*\))?$/.test(p)) { eff.def = bb.def; kept.push(p); }
      else if (/^ASPD \+[\d.]+(\s*\([^)]*\))?$/.test(p)) { eff.aspd = bb.attack_speed; kept.push(p); }
      else if (/^RES \+[\d.]+(\s*\([^)]*\))?$/.test(p)) { eff.res = bb.magic_resistance; kept.push(p); }
      else if (/^DP Cost -\d+$/.test(p)) { eff.cost = bb.cost; kept.push(p); }
      else if (/Immediately obtains? [\d]+.*Skill Points? after deployment/i.test(p) && bb.sp !== undefined) { eff.sp = bb.sp; kept.push(p); }
      else if (/^When attacking, has an? [\d.]+% chance to increase the (current )?damage of that attack to [\d.]+%/.test(p) && bb.prob !== undefined && bb.atk_scale !== undefined) { eff.crit = [bb.prob, bb.atk_scale]; kept.push(p + " (expected value on ATK)"); }
      else if (p) dropped.push(p);
    }
    out.push({ row: ti, ph: PH(q.unlockCondition.phase), lv: q.unlockCondition.level, eff, name: q.name, kept, dropped });
  }
  return out;
}
// the talent effects in force at (elite, level): the latest unlocked candidate of each row
function talentAt(rows, el, lv) {
  const best = {}; for (const r of rows) { if (r.ph > el || (r.ph === el && r.lv > lv)) continue; const b = best[r.row]; if (!b || r.ph > b.ph || (r.ph === b.ph && r.lv > b.lv)) best[r.row] = r; }
  const e = { atk: 1, hp: 1, def: 1, aspd: 0, res: 0, cost: 0, sp: 0 };
  for (const r of Object.values(best)) { const f = r.eff; if (f.atk) e.atk *= 1 + f.atk; if (f.hp) e.hp *= 1 + f.hp; if (f.def) e.def *= 1 + f.def; if (f.aspd) e.aspd += f.aspd; if (f.res) e.res += f.res; if (f.cost) e.cost += f.cost; if (f.sp) e.sp += f.sp;
    if (f.crit) e.atk *= 1 + f.crit[0] * (f.crit[1] - 1); }
  return e;
}

// ---------- operators ----------
function convert(raw) {
  const C = JSON.parse(fs.readFileSync(path.join(raw, "character_table.json"), "utf8"));
  const K = JSON.parse(fs.readFileSync(path.join(raw, "skill_table.json"), "utf8"));
  const RT = JSON.parse(fs.readFileSync(path.join(raw, "range_table.json"), "utf8"));
  const ops = {}, ranges = {}, report = {};
  const rangeKey = (rid, prefix) => { if (!rid || !RT[rid]) return null; const k = `${prefix}@ak${rid}`; if (!ranges[k]) ranges[k] = RT[rid].grids.map((g) => [g.col, g.row]); return k; };
  for (const [cid, c] of Object.entries(C)) {
    if (!cid.startsWith("char_") || c.isNotObtainable) continue;
    const rar = RAR(c.rarity); if (rar !== 3 && rar !== 4) continue;
    const cls = PROF[c.profession]; if (!cls) continue;
    const sub = c.subProfessionId, tile = c.position === "MELEE" ? "g" : "h";
    const dmg = c.profession === "MEDIC" ? "heal" : (c.profession === "CASTER" || (c.profession === "SUPPORT" && sub !== "craftsman") || sub === "artsfghter" || sub === "artsprotector") ? "arts" : "phys";
    const prefix = c.profession === "SUPPORT" ? "support" : sub === "lord" ? "lord" : c.profession === "SNIPER" ? "long" : c.profession === "MEDIC" ? "heal" : c.profession === "CASTER" ? "arts" : "melee";
    const ph = c.phases, kf = { hp: [], atk: [], def: [] };
    for (const p of ph) { const a = p.attributesKeyFrames[0].data, b = p.attributesKeyFrames[p.attributesKeyFrames.length - 1].data; kf.hp.push([a.maxHp, b.maxHp]); kf.atk.push([a.atk, b.atk]); kf.def.push([a.def, b.def]); }
    const d0 = ph[0].attributesKeyFrames[0].data;
    const id = "ak_" + cid.replace(/^char_\d+_/, "");
    const bat = d0.baseAttackTime * 100 / (d0.attackSpeed || 100);
    const d = { id, akop: true, akId: cid, akName: c.name, name: c.name, cls, sub, rarity: rar, tile, glyph: c.name[0], cost: d0.cost, eliteCost: ph[1] ? ph[1].attributesKeyFrames[0].data.cost - d0.cost : 0,
      hp: kf.hp[kf.hp.length - 1][1], atk: kf.atk[kf.atk.length - 1][1], def: kf.def[kf.def.length - 1][1], kf, res: d0.magicResistance || 0, resE: ph.map((p) => p.attributesKeyFrames[0].data.magicResistance || 0),
      interval: Math.round(bat * 1000) / 1000, block: tile === "g" ? d0.blockCnt : 0, range: rangeKey(ph[0].rangeId, prefix) || (tile === "g" ? "melee" : "long"), dmg, redeploy: d0.respawnTime, maxLv: ph.map((p) => p.maxLevel) };
    const rE = {}; ph.forEach((p, i) => { if (i && p.rangeId !== ph[0].rangeId) rE[i] = rangeKey(p.rangeId, prefix); }); if (Object.keys(rE).length) d.rangeE = rE;
    const bE = {}; ph.forEach((p, i) => { const b = p.attributesKeyFrames[0].data.blockCnt; if (i && tile === "g" && b > d.block) bE[i] = b; }); if (Object.keys(bE).length) d.blockE = bE;
    const notes = [];
    if (ph[2] && ph[2].attributesKeyFrames[0].data.cost !== ph[1].attributesKeyFrames[0].data.cost) notes.push(`E2 cost ${ph[2].attributesKeyFrames[0].data.cost} (we use E1's)`);
    if (new Set(d.resE).size > 1) notes.push("res per phase " + d.resE.join("/"));
    // branch traits
    const tr = {}; for (const t of (c.trait && c.trait.candidates) || []) for (const b of t.blackboard || []) tr[b.key] = b.value;
    if (sub === "charger") { d.killCost = tr.cost || 1; d.fullRefund = true; }
    else if (sub === "centurion") d.cleave = true;
    else if (sub === "lord") { d.lord = tr.atk_scale || 0.8; d.akLordFar = d.lord; }
    else if (sub === "fastshot") d.airFirst = true;
    else if (sub === "longrange") d.lowDefFirst = true;
    else if (sub === "aoesniper") d.lob = { r: 1.0, flight: 0.6 };
    else if (sub === "splashcaster") d.splashArts = 1.0;
    else if (sub === "slower") { d.slow = 0.8; d.slowDur = tr.sluggish || 0.8; }
    else if (sub === "sword") d.double = 0.15;
    else if (sub === "ringhealer") d.multiHeal = 3;
    else if (sub === "unyield") d.noHeal = true;
    else if (sub === "stalker") d.dodge = 0.5;
    const KEPT = new Set(["pioneer", "charger", "centurion", "lord", "fastshot", "longrange", "aoesniper", "splashcaster", "slower", "sword", "ringhealer", "unyield", "stalker", "fearless", "protector", "corecaster", "physician", "executor", "pusher", "guardian", "artsfghter", "artsprotector", "fighter", "closerange"]);
    if (!KEPT.has(sub)) notes.push(`branch ${sub}: trait not expressed (plain ${c.profession.toLowerCase()} logic)`);
    else if (sub === "lord") notes.push("lord: ranged hits at 80% beyond the adjacent tiles");
    else if (sub === "stalker") notes.push("stalker: camouflage as dodge 0.5 (approx.)");
    else if (sub === "guardian") notes.push("guardian: heals only during its healing skill");
    // skills
    d.skills = []; const skRep = [];
    c.skills.forEach((sref, i) => {
      const T = K[sref.skillId]; if (!T) return;
      const lv = T.levels.map((L) => convSkillLevel(L, d, { bat }));
      const base = Object.assign({ id: `${id}_s${i + 1}` }, lv[0].s);
      base.akLv = lv.map((x) => Object.assign({ id: `${id}_s${i + 1}` }, x.s));
      d.skills.push(base);
      const top = lv[Math.min(6, lv.length - 1)];
      skRep.push({ skill: `S${i + 1} ${T.levels[0].name}`, mapped: Object.keys(top.s.akfx).join(",") || "-", missing: [...new Set(lv.flatMap((x) => x.miss))].join("; ") || "-" });
    });
    if (!d.skills.length) d.skills = [{ id: id + "_none", name: "-", desc: "", sp: 999, init: 0, mode: "passive", dur: 0, akfx: {} }];
    d.akTal = convTalents(c);
    d.talent = { name: (d.akTal[0] && d.akTal[0].name) || "-", desc: d.akTal.map((r) => r.kept.join("; ")).filter(Boolean).join(" / ") };
    ops[id] = d;
    report[id] = { name: c.name, rarity: rar, cls: c.profession, sub, notes, skills: skRep, talents: d.akTal.map((r) => ({ at: `E${r.ph}L${r.lv}`, kept: r.kept, dropped: r.dropped })) };
  }
  const idOf = (cid) => Object.values(ops).find((o) => o.akId === cid);
  const decks = { AK4: Object.keys(ops).sort(), AKstart: AKSTART.map((cid) => { const o = idOf(cid); if (!o) throw new Error("AKstart op missing: " + cid); return o.id; }) };
  return { note: "PRIVATE: converted Arknights operators. Never commit, upload or copy into the game.", made: new Date().toISOString(), ops, ranges, decks, report };
}

// ---------- in-memory install ----------
function install(TD, file) {
  if (TD.__akops) return TD.__akops;
  const data = typeof file === "string" ? JSON.parse(fs.readFileSync(file, "utf8")) : file;
  for (const [k, v] of Object.entries(data.ranges)) TD.RANGE[k] = v;
  const ext = (key, n) => { const k = `${key}+${n}`; if (!TD.RANGE[k]) { const R = TD.RANGE[key] || [[0, 0]]; const add = []; const rows = new Map(); for (const [x, y] of R) rows.set(y, Math.max(rows.has(y) ? rows.get(y) : -99, x)); for (const [y, mx] of rows) for (let j = 1; j <= n; j++) add.push([mx + j, y]); TD.RANGE[k] = R.concat(add); } return k; };
  const byId = {};
  for (const d of Object.values(data.ops)) { if (TD.UNITS.find((u) => u.id === d.id)) continue; TD.UNITS.push(d); byId[d.id] = d; }
  // growth: AK keyframes (TD.growth does the interpolation) times the talents in force
  const growth0 = TD.growth;
  TD.growth = function (d, el, lv, maxLv) { const g = growth0(d, el, lv, maxLv); if (!d || !d.akop) return g; const t = talentAt(d.akTal, el, lv); return { hp: g.hp * t.hp, atk: g.atk * t.atk, def: g.def * t.def }; };
  // skill levels: AK's own numbers at the level (lv 1-7, then M1-M3)
  const skIdx = (sk, lv, m) => Math.min(sk.akLv.length - 1, (m > 0 ? 6 + m : Math.max(1, Math.min(7, lv || 1)) - 1));
  const skillAt0 = TD.skillAt;
  TD.skillAt = function (sk, lv, m) { if (sk && sk.akLv) return sk.akLv[skIdx(sk, lv, m)]; return skillAt0(sk, lv, m); };
  // one def per (op, elite, level): the skills at that level, res / interval / cost / initial SP from the talents; cached
  const LD = new Map();
  const levelDef = (d, el, lv, slv, m) => {
    const key = `${d.id}|${el}|${lv}|${slv}|${m}`; if (LD.has(key)) return LD.get(key);
    const t = talentAt(d.akTal, el, lv), o = Object.create(d);
    o.res = (d.resE[Math.min(el, d.resE.length - 1)] || 0) + t.res;
    o.interval = d.interval * 100 / (100 + t.aspd);
    o.eliteCost = d.eliteCost + (el > 0 ? t.cost : 0); if (el === 0 && t.cost) o.cost = d.cost + t.cost;
    const hp = d.kf.hp[Math.min(el, d.kf.hp.length - 1)], hpNow = (hp[0] + (hp[1] - hp[0]) * (lv - 1) / Math.max(1, d.maxLv[Math.min(el, d.maxLv.length - 1)] - 1)) * t.hp;
    o.skills = d.skills.map((sk) => { if (!sk.akLv) return sk; const s = Object.assign({}, sk.akLv[skIdx(sk, slv, m)]);
      if (t.sp) s.init = Math.min(s.sp, (s.init || 0) + t.sp);
      if (s.akfx && (s.akfx.regenFlat || s.akfx.regenPct)) s.heal = (s.akfx.regenPct || 0) + (s.akfx.regenFlat || 0) / Math.max(1, hpNow);
      return s; });
    LD.set(key, o); return o;
  };
  const Base = TD.Game;
  class AKOpsGame extends Base {
    constructor(i, squad) {
      super(i, squad);
      if (!squad || !squad.length) return;
      const valid = squad.filter((s) => TD.UNITS.find((u) => u.id === s.id));
      valid.forEach((s, k) => { const card = this.cards[k]; if (!card || !card.def.akop || card.def.id !== s.id) return;
        const m = (s.sm && s.sm[card.skillIdx]) || 0, el = card.elite, lv = s.lv || 1;
        card.def = levelDef(card.def, el, lv, card.slv, card.def.rarity >= 4 ? m : 0); card.slv = 1; card.sm = [0, 0, 0]; });
    }
    useSkill(u) {
      const s = u.skill; if (!s || !s.akfx) return super.useSkill(u);
      if (u.sp < s.sp || u.skillT > 0 || u.frozenT > 0) return false;
      const fx = s.akfx;
      if (fx.push !== undefined && !this.enemies.some((e) => !e.dead && !e.def.flying && Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) <= 1.3)) return false;
      u.sp = 0; u.skillT = s.dur; u.castT = this.t; u.castId = s.id;
      if (s.dur > 0) {
        const b = {}; if (fx.atkMul) b.atkMul = fx.atkMul; if (fx.defMul) b.defMul = fx.defMul; if (fx.speed) b.speed = fx.speed; if (fx.ivMul) b.ivMul = fx.ivMul; if (fx.blockAdd) b.blockAdd = fx.blockAdd;
        u.buff = b; u.dpGot = 0; u.healAcc = 0;
        if (fx.dmgMode || fx.healMode || fx.lobScale) { u.akDef0 = u.def; const o = Object.create(u.def); if (fx.dmgMode) o.dmg = fx.dmgMode; if (fx.healMode) { o.dmg = "heal"; o.lob = undefined; } if (fx.lobScale && u.def.lob) o.lob = { r: u.def.lob.r * fx.lobScale, flight: u.def.lob.flight }; u.def = o; }
        if (fx.rangeExt) { const c = this.cards[u.card]; u.rangeKey = ext(TD.rangeKeyOf(u.def, c ? c.elite : 0), fx.rangeExt); u.akRange = true; }
        if (fx.noAttack) u.akHold = true;
      }
      if (fx.dpNow) this.cost = Math.min(TD.CFG.maxCost, this.cost + fx.dpNow);
      if (fx.next) u.braveNext = true;
      if (fx.selfHeal) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * fx.selfHeal);
      if (fx.healAll) { const tl = this.rangeTiles(u), amt = this.stat(u, "atk") * fx.healAll; for (const a of this.units) if (this.inRange(u, a, tl)) a.hp = Math.min(a.maxHp, a.hp + amt); }
      if (fx.push !== undefined) {   // our specialist's shove: the two front tiles, damage x mul, pushed with force
        const [fx0, fy0] = TD.rotate([1, 0], u.dir), front = [[u.x, u.y], [u.x + fx0, u.y + fy0]];
        for (const e of this.enemies) { if (e.dead || e.def.flying) continue; const tx = Math.round(e.x), ty = Math.round(e.y); if (!front.some(([x, y]) => x === tx && y === ty)) continue;
          e.lastHitBy = u; this.damage(e, this.stat(u, "atk") * (fx.mul || 1), u.def.dmg === "arts" ? "arts" : "phys", u); this.shove(e, fx0, fy0, fx.push); }
      }
      return true;
    }
    endSkill(u) { const r = super.endSkill ? super.endSkill(u) : undefined; if (u.akDef0) { u.def = u.akDef0; u.akDef0 = null; } if (u.akRange) { u.rangeKey = null; u.akRange = false; } u.akHold = false; return r; }
    hit(u, e) {
      const times = u.braveNext && u.skill && u.skill.akfx && u.skill.akfx.times > 1 ? u.skill.akfx.times : 0;   // "the next attack shoots n times": n blows at the multiplier
      const far = u.def.akLordFar && Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) > 1.25, b = u.buff;
      if (far) u.buff = Object.assign({}, b, { atkMul: (b.atkMul || 1) * u.def.akLordFar });
      try { const r = super.hit(u, e); for (let k = 1; k < times; k++) if (!e.dead) this.damage(e, this.stat(u, "atk") * u.skill.akfx.next, u.def.dmg, u); return r; }
      finally { if (far) u.buff = b; }
    }
    update(dt) {
      for (const u of this.units) if (u.akHold && u.skillT > 0) { u.atkT = Math.max(u.atkT, 0.3); u.wind = null; }
      return super.update(dt);
    }
  }
  TD.Game = AKOpsGame;
  TD.__akops = { ids: Object.keys(byId), decks: data.decks, Base, levelDef, talentAt };
  return TD.__akops;
}

// ---------- DPS (plain attack, no skill) ----------
function plainDps(d, el, lv, def, res) {
  const ml = d.maxLv[Math.min(el, d.maxLv.length - 1)]; el = Math.min(el, d.kf.atk.length - 1); lv = Math.min(lv, ml);
  const t = talentAt(d.akTal, el, lv), p = d.kf.atk[el], atk = (p[0] + (p[1] - p[0]) * (lv - 1) / Math.max(1, ml - 1)) * t.atk, iv = d.interval * 100 / (100 + t.aspd);
  const hit = d.dmg === "arts" ? atk * (1 - (res || 0) / 100) : d.dmg === "heal" ? atk : Math.max(atk - def, atk * 0.05);
  return { el, lv, atk: Math.round(atk * 10) / 10, interval: Math.round(iv * 1000) / 1000, dps: Math.round(hit / iv * 10) / 10 };
}

async function main() {
  const cmd = A._[0];
  if (cmd === "fetch") { await fetchAll(A.out || "akraw"); return; }
  if (cmd === "convert") { const o = convert(A.raw); fs.mkdirSync(path.dirname(path.resolve(A.out)), { recursive: true }); fs.writeFileSync(A.out, JSON.stringify(o)); console.log(`akops: converted ${Object.keys(o.ops).length} operators (${o.decks.AKstart.length} in AKstart)`); return; }
  if (cmd === "report") { const o = JSON.parse(fs.readFileSync(A.file, "utf8")); for (const [id, r] of Object.entries(o.report)) { console.log(`${id} ${r.name} ${r.rarity}★ ${r.cls}/${r.sub}${r.notes.length ? " | " + r.notes.join("; ") : ""}`);
      for (const s of r.skills) console.log(`   ${s.skill}: kept ${s.mapped} | not expressed: ${s.missing}`); for (const t of r.talents) console.log(`   talent ${t.at}: kept ${t.kept.join("; ") || "-"} | dropped ${t.dropped.join("; ") || "-"}`); } return; }
  if (cmd === "dps") { const o = JSON.parse(fs.readFileSync(A.file, "utf8")); const ids = (A.ids || o.decks.AKstart.join(",")).split(","); const defs = (A.def || "0,200").split(",").map(Number); const lvs = (A.lv || "E0L1,E1L55").split(",");
    for (const id of ids) { const d = o.ops[id]; for (const L of lvs) { const [, e, l] = /^E(\d)L(\d+)$/.exec(L); console.log(id, L, defs.map((df) => { const r = plainDps(d, +e, +l, df, 0); return `def${df}: atk ${r.atk} / ${r.interval}s = ${r.dps}`; }).join(" | ")); } } return; }
  console.log("usage: node akops.js fetch|convert|report|dps ...");
}
module.exports = { convert, install, talentAt, plainDps, AKSTART };
if (require.main === module) main().catch((e) => { console.error("akops: " + (e && e.message || e)); process.exit(1); });
