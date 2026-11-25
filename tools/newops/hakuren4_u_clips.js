// Hakuren (other aspect): arms folded, she does nothing; the air does it. Calm drawings, and at the peak of a burst the blown drawings
// (hair_blown, skirt_flared, tail_flung) take over by scaling their bones up while the calm ones shrink away.
(function (root) {
  "use strict";
  const P = (x, y) => ({ x, y }), FR = P(134, 0), FL = P(53, 0), Z = 0.001;
  const calm = { blow_hair: { sx: [[0, Z]], sy: [[0, Z]] }, blow_skirt: { sx: [[0, Z]], sy: [[0, Z]] }, blow_tail: { sx: [[0, Z]], sy: [[0, Z]] } };
  const EX = { G: [[0, P(100, -280)]], cr: [[0, 0]], foot_r: [[0, FR]], foot_l: [[0, FL]] };
  const C = {};
  C.idle = { dur: 3.2, loop: true, bones: Object.assign({ hip: { y: [[0, 0], [1.6, 3, "io"], [3.2, 0, "io"]] }, torso: { r: [[0, 0], [1.6, 1, "io"], [3.2, 0, "io"]] }, head: { r: [[0, 0], [1.8, 1.5, "io"], [3.2, 0, "io"]] },
      hair_mid: { r: [[0, 0], [1.6, 2, "io"], [3.2, 0, "io"]] }, hair_tip: { r: [[0, 0], [1.8, 3, "io"], [3.2, 0, "io"]] },
      tail: { r: [[0, 0], [1.6, 6, "io"], [3.2, 0, "io"]] }, tail_mid: { r: [[0, 0], [1.6, -8, "io"], [3.2, 0, "io"]] }, tail_tip: { r: [[0, 0], [1.6, 10, "io"], [3.2, 0, "io"]] } }, calm),
    extra: Object.assign({}, EX) };
  // k = strength; t0 = the moment the air goes out (impact)
  const burst = (dur, t0, k) => {
    const a = t0 - 0.34, p = t0, q = t0 + 0.14, s = t0 + 0.5, on = p - 0.02, off = s - 0.06;
    const swapIn = [[0, Z], [on, Z], [on + 0.001, 1], [off, 1], [off + 0.001, Z]], swapOut = [[0, 1], [on, 1], [on + 0.001, Z], [off, Z], [off + 0.001, 1]];
    return { dur, impact: p, bones: {
      hip: { y: [[0, 0], [a, 0], [p - 0.06, 6, "io"], [q, -5 * k, "out"], [s, 2, "io"], [dur, 0, "io"]] },
      torso: { r: [[0, 0], [p - 0.06, 3, "io"], [q, -4 * k, "out"], [s, 1, "io"], [dur, 0, "io"]], sy: [[0, 1], [p - 0.06, 0.97, "io"], [q, 1.03, "out"], [s, 1], [dur, 1]] },
      head: { r: [[0, 0], [p - 0.06, 6, "io"], [q, -7 * k, "out"], [s, 1, "io"], [dur, 0, "io"]] },
      hair_back: { r: [[0, 0], [p - 0.06, -4, "io"], [q, 8 * k, "out"], [s, -2, "io"], [dur, 0, "io"]], sx: swapOut, sy: swapOut },
      hair_mid: { r: [[0, 0], [p - 0.04, -5], [s + 0.05, -3, "io"], [dur, 0, "io"]] }, hair_tip: { r: [[0, 0], [p - 0.02, -6], [s + 0.1, -4, "io"], [dur, 0, "io"]] },
      blow_hair: { sx: swapIn, sy: swapIn, r: [[0, 0], [q, 6 * k, "out"], [s, -3, "io"]] },
      skirt: { sx: swapOut, sy: swapOut }, skirt_hem: { sx: [[0, 1], [p - 0.06, 0.94, "io"], [s, 1.06, "out"], [dur, 1, "io"]] },
      blow_skirt: { sx: swapIn, sy: swapIn },
      tail: { r: [[0, 0], [p - 0.06, -10, "io"], [q, 14 * k, "out"], [s, -8, "io"], [dur, 0, "io"]], sx: swapOut, sy: swapOut },
      tail_mid: { r: [[0, 0], [s + 0.06, 6, "io"], [dur, 0, "io"]] }, tail_tip: { r: [[0, 0], [s + 0.1, -6, "io"], [dur, 0, "io"]] },
      blow_tail: { sx: swapIn, sy: swapIn, r: [[0, 0], [q, -10 * k, "out"], [s, 6, "io"]] },
    }, extra: Object.assign({}, EX, { head: [[0, "neutral"], [a + 0.08, "closed"], [p - 0.02, "neutral"], [s - 0.1, "closed"], [s + 0.22, "neutral"]], blink: [[0, 0]],
      foot_r: [[0, FR], [p - 0.14, FR], [p - 0.06, P(140, -10), "out"], [p, P(146, 0), "in2"], [s, P(146, 0)], [dur - 0.12, P(140, -6)], [dur, FR, "in2"]] }) };
  };
  C.attack = burst(1.4, 0.5, 1);
  C.skill = burst(1.9, 0.8, 1.5);
  C.skill.bones.hip.y = [[0, 0], [0.4, 4, "io"], [0.8, -10, "out"], [1.2, -14, "io"], [1.5, 2, "io"], [1.9, 0, "io"]];
  C.die = { dur: 1.7, bones: Object.assign({
    hip: { y: [[0, 0], [0.4, 6, "io"], [1.2, 90, "in2"], [1.3, 86]] }, torso: { r: [[0, 0], [0.4, -3, "io"], [1.2, 12, "in2"]] },
    head: { r: [[0, 0], [0.4, 6, "io"], [1.2, 18, "in2"], [1.34, 15]] }, tail: { r: [[0, 0], [1.2, 30, "io"]] }, hair_tip: { r: [[0, 0], [1.3, 6]] } }, calm),
    extra: Object.assign({}, EX, { head: [[0, "closed"]], blink: [[0, 0]], alpha: [[0, 1], [1.25, 1], [1.7, 0]] }) };
  root.HAKUREN4_MY = { CLIPS: C };
})(typeof window !== "undefined" ? window : globalThis);
