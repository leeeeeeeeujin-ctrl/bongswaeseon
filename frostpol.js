// Frost-stage plan genes (IM-10 v2, stage.frost), shared by sim.run and fast.js's Ctl so both stay bit-identical.
// Every gene here is inert on a stage without g.frost, and a plan without the new fields behaves exactly as before.
//  plan.feed = { b: [[x, y, th, p?], ...], w: 0 | 1 }
//      a brazier is fed (Game.feedBrazier: 10 cost, cooldown) while its hp < th * max, th in 0.3 / 0.5 / 0.7 / 1 (1 = with every 10 cost); an entry with p applies
//      from frost phase p on (default 0). Several entries may name one brazier: its threshold is the highest applicable one, its priority the first applicable entry.
//      A brazier no entry names is never fed. w = 1: no feeding while a deploy is waiting for cost.
//  plan.re   = { id: 0 }  0 = once this card's operator has fallen, it is not set down again (absent / 1 = the default: entries redeploy it as before)
//  entry.fp  = k          phase-tied timing: `from` / `until` count seconds from the start of frost phase k; the entry waits until phase k has begun
//  entry.tp  = k          `until` counts from the start of phase k instead (no limit while phase k has not begun): "stand here until phase k (+until s)"
//  retreat.fp = k         the retreat's t counts from the start of phase k
"use strict";
function newState(g) { return { ph: [], lv: g.cards.map((c) => c.level), falls: g.cards.map(() => 0), moved: g.cards.map(() => 0), lastPh: g.frost ? g.frost.phase : -1, fed: 0, nFeed: 0 }; }
function snapState(s) { return { ph: s.ph.slice(), lv: s.lv.slice(), falls: s.falls.slice(), moved: s.moved.slice(), lastPh: s.lastPh, fed: s.fed, nFeed: s.nFeed }; }
// frame start: record phase starts, and attribute card retreats that were not ours (falls; or board changes at a phase switch)
function frameStart(g, s) {
  const F = g.frost; let switched = false;
  if (F) { if (s.ph[F.phase] === undefined) s.ph[F.phase] = F.t0; if (F.phase !== s.lastPh) { switched = true; s.lastPh = F.phase; } }
  const cs = g.cards;
  for (let i = 0; i < cs.length; i++) { const L = cs[i].level; if (L !== s.lv[i]) { if (L > s.lv[i]) { if (switched) s.moved[i] += L - s.lv[i]; else s.falls[i] += L - s.lv[i]; } s.lv[i] = L; } }
}
function ourRetreat(g, s, ci) { if (ci !== undefined && g.cards[ci]) s.lv[ci] = g.cards[ci].level; }
function entryDue(g, s, q) {
  if (q.fp === undefined && q.tp === undefined) { if (q.from !== undefined && g.t < q.from) return false; if (q.until !== undefined && g.t >= q.until) return false; return true; }
  let b = 0; if (q.fp !== undefined) { b = s.ph[q.fp]; if (b === undefined) return false; }
  if (g.t < b + (q.from || 0)) return false;
  if (q.until !== undefined) { const u = q.tp !== undefined ? s.ph[q.tp] : b; if (u !== undefined && g.t >= u + q.until) return false; }
  return true;
}
function retreatDue(g, s, r) { if (r.fp === undefined) return g.t >= r.t; const b = s.ph[r.fp]; return b !== undefined && g.t >= b + r.t; }
function blockedByRe(plan, s, ci, id) { return !!(plan.re && plan.re[id] === 0 && s.falls[ci] > 0); }
function feedNext(g, plan, waiting) {
  const P = plan.feed, F = g.frost; if (!P || !F || !P.b || !P.b.length) return null;
  if (P.w && waiting) return null;
  if (g.cost < F.feed.cost) return null;
  const ph = F.phase, th = new Map(), order = [];
  for (const e of P.b) { if ((e[3] || 0) > ph) continue; const k = e[1] * 100 + e[0]; if (!th.has(k)) { th.set(k, e[2]); order.push(e); } else if (e[2] > th.get(k)) th.set(k, e[2]); }
  for (const [x, y] of order) { const k = y * 100 + x, L = g.lampHp.get(k); if (!L || L.hp >= F.max * th.get(k)) continue; if (g.feedCheck(x, y)) continue; return [x, y]; }
  return null;
}
function falls(s) { return s.falls.reduce((a, b) => a + b, 0); }
module.exports = { newState, snapState, frameStart, ourRetreat, entryDue, retreatDue, blockedByRe, feedNext, falls };
