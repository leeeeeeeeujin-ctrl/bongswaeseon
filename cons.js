"use strict";
// placement constraints for "habitual wrong answer" searches (chapter_identity_standard.md section 7)
//   filter terms (query.js --filter, joined with ;):
//     sq=x.y+x.y            every placed unit (summons excepted) must stand on one of these squares
//     sq[저격+술사]=x.y+...   only units of these classes are bound to the squares (others are free)
//     nosq=x.y+...          no unit may stand on these squares (class scope allowed the same way)
//     noretreat             no retreats, no timed relocations (entries with until/from)
//   cons = { sq: [{cls: [..]|null, set: ["x,y", ..]}], nosq: [...same], noretreat: true }
const S = require("./sim.js");

function parseSq(body) { return body.split("+").map((p) => p.trim()).filter(Boolean).map((p) => { const m = /^(\d+)[.,](\d+)$/.exec(p); if (!m) throw new Error("bad square " + p); return m[1] + "," + m[2]; }); }

// returns true if the term was a placement term (and was stored in cons)
function parseTerm(part, cons) {
  let m;
  if (part === "noretreat") { cons.noretreat = true; return true; }
  if ((m = /^(sq|nosq)(?:\[([^\]]+)\])?=(.+)$/.exec(part))) {
    const key = m[1]; const cls = m[2] ? m[2].split("+").map((s) => s.trim()) : null;
    (cons[key] = cons[key] || []).push({ cls, set: parseSq(m[3]) });
    return true;
  }
  return false;
}

const has = (o) => !!(o && (o.sq || o.nosq || o.noretreat));
const scoped = (rule, id) => !rule.cls || rule.cls.includes(S.def(id).cls);

// may unit id stand on (x,y) under these constraints?
function allowed(o, id, x, y) {
  if (!has(o) || S.isSummon(id)) return true;
  const k = x + "," + y;
  for (const r of o.sq || []) if (scoped(r, id) && !r.set.includes(k)) return false;
  for (const r of o.nosq || []) if (scoped(r, id) && r.set.includes(k)) return false;
  return true;
}

// penalty for a whole plan (0 = keeps every placement constraint)
function pen(p, o) {
  if (!has(o)) return 0; let n = 0;
  for (const q of p.entries) if (!allowed(o, q.id, q.x, q.y)) n++;
  if (o.noretreat) { n += (p.retreats || []).length; for (const q of p.entries) if (q.until !== undefined || q.from !== undefined) n++; }
  return n * 1e7;
}

// a copy of stageInfo restricted to allowed squares (legal + cover kept index-aligned)
function restrictInfo(info, o) {
  if (!has(o) || !info || !info.legal) return info;
  const legal = {}, cover = {};
  for (const id of Object.keys(info.legal)) {
    const L = info.legal[id] || [], C = (info.cover && info.cover[id]) || [];
    const keep = L.map((t, i) => i).filter((i) => allowed(o, id, L[i][0], L[i][1]));
    legal[id] = keep.map((i) => L[i]); cover[id] = keep.map((i) => C[i] || [0, 0, 0, 0]);
  }
  return Object.assign({}, info, { legal, cover });
}

module.exports = { parseTerm, allowed, pen, restrictInfo, has };
