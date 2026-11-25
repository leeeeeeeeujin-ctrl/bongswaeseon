  // shared by the staff / lantern / pen casters: N = neutral, then wind-up W (0.22), gather T (0.36), release R (impact 0.5), follow-through F (0.68), back to N.
  // each pose: { G:[x,y], cr, hl:[x,y] (the other hand), hip:[x,y], tr (torso), hr (head), fr:[x,y] front foot, fl:[x,y] rear foot }
  const P2 = (a) => ({ x: a[0], y: a[1] });
  function cast(N, W, T, R, F, o) {
    o = o || {}; const dur = o.dur || 1.3, I = 0.5, k = (f) => [[0, f(N)], [0.22, f(W), "out"], [0.36, f(T), "io"], [I, f(R), "in2"], [0.68, f(F), "out"], [dur, f(N), "io"]];
    const sw = (a, b, c) => [[0, 0], [0.22, a, "out"], [0.36, a * 0.6], [I + 0.06, b, "in2"], [0.8, c, "io"], [dur, 0, "io"]];
    const bones = Object.assign({ effect: { sx: [[0, 0.001]], sy: [[0, 0.001]] },
      hip: { x: k((p) => p.hip[0]), y: k((p) => p.hip[1]) }, torso: { r: k((p) => p.tr), sy: [[0, 1], [0.36, 1.03, "io"], [I, 0.95, "in2"], [0.7, 1.0], [dur, 1]] }, head: { r: k((p) => p.hr) },
      hair_back: { r: sw(-4, 10, -3) }, hair_mid: { r: sw(-8, 20, -6) }, hair_tip: { r: sw(-10, 28, -9) },
      cape_tip: { r: sw(-8, 24, -6) }, skirt_hem: { r: sw(-3, 8, -2), sx: [[0, 1], [I + 0.06, 1.14, "in2"], [0.8, 0.97], [dur, 1]] },
      hat: { r: sw(-7, 9, -3) } }, o.bones || {});
    const extra = Object.assign({ G: k((p) => P2(p.G)), cr: k((p) => p.cr), ik_r: [[0, 1]], ik_l: [[0, 1]], hm_l: [[0, 1]], hand_l_at: k((p) => P2(p.hl)),
      foot_r: [[0, P2(N.fr)], [0.22, P2(W.fr), "out"], [0.36, P2(T.fr), "io"], [I - 0.03, P2(R.fr), "in2"], [0.86, P2(F.fr)], [dur - 0.16, { x: (F.fr[0] + N.fr[0]) / 2, y: -12 }], [dur, P2(N.fr), "in2"]],
      foot_l: [[0, P2(N.fl)], [0.22, P2(W.fl), "out"], [0.36, P2(T.fl), "io"], [I, P2(R.fl), "in2"], [0.9, P2(F.fl)], [dur - 0.08, { x: (F.fl[0] + N.fl[0]) / 2, y: -10 }], [dur, P2(N.fl), "in2"]],
      trail: [[0, 0], [0.38, 0], [0.39, o.trail ? 1 : 0], [0.6, o.trail ? 1 : 0], [0.61, 0]] }, o.extra || {});
    return { dur, impact: I, bones, extra };
  }
  function idleOf(N, o) {
    o = o || {}; const d = o.dur || 2.8, h = d / 2;
    return { dur: d, loop: true, bones: Object.assign({ effect: { sx: [[0, 0.001]], sy: [[0, 0.001]] },
      hip: { x: [[0, N.hip[0]]], y: [[0, N.hip[1]], [h, N.hip[1] + 4, "io"], [d, N.hip[1], "io"]] }, torso: { r: [[0, N.tr], [h, N.tr + 1.3, "io"], [d, N.tr, "io"]], sy: [[0, 1], [h, 0.99, "io"], [d, 1, "io"]] },
      head: { r: [[0, N.hr], [h + 0.2, N.hr + 2.5, "io"], [d, N.hr, "io"]] }, cape_tip: { r: [[0, 0], [h, 4, "io"], [d, 0, "io"]] }, hat: { r: [[0, 0], [h + 0.3, 1.5, "io"], [d, 0, "io"]] } }, o.bones || {}),
      extra: Object.assign({ G: [[0, P2(N.G)], [h, { x: N.G[0], y: N.G[1] + 4 }, "io"], [d, P2(N.G), "io"]], cr: [[0, N.cr], [h, N.cr + (o.sway || 2), "io"], [d, N.cr, "io"]], ik_r: [[0, 1]], ik_l: [[0, 1]], hm_l: [[0, 1]],
        hand_l_at: [[0, P2(N.hl)]], foot_r: [[0, P2(N.fr)]], foot_l: [[0, P2(N.fl)]] }, o.extra || {}) };
  }
  function hitOf(N) { const I = idleOf(N); return { dur: 0.5, bones: { effect: I.bones.effect, hip: { x: [[0, N.hip[0]], [0.1, N.hip[0] - 16, "out"], [0.5, N.hip[0], "io"]], y: [[0, N.hip[1]]] }, torso: { r: [[0, N.tr], [0.1, N.tr - 9, "out"], [0.5, N.tr, "io"]] },
    head: { r: [[0, N.hr], [0.1, N.hr - 12, "out"], [0.5, N.hr, "io"]] }, hat: { r: [[0, 0], [0.1, -10, "out"], [0.5, 0, "io"]] } },
    extra: Object.assign({}, I.extra, { G: [[0, P2(N.G)]], cr: [[0, N.cr], [0.1, N.cr - 10, "out"], [0.5, N.cr, "io"]], head: [[0, "closed"], [0.3, "closed"], [0.31, "neutral"]] }) }; }
  // knees give, she folds forward over what she holds and fades
  function dieOf(N, D) { const I = idleOf(N); return { dur: 1.7, bones: { effect: I.bones.effect,
    hip: { x: [[0, N.hip[0]], [0.3, N.hip[0] - 18, "out"], [1.2, N.hip[0] + 6, "in2"]], y: [[0, N.hip[1]], [0.3, N.hip[1] + 4], [1.2, N.hip[1] + 98, "in2"], [1.3, N.hip[1] + 94]] },
    torso: { r: [[0, N.tr], [0.3, N.tr - 12, "out"], [1.2, 30, "in2"], [1.32, 27]] }, head: { r: [[0, N.hr], [0.3, N.hr - 14, "out"], [1.2, 24, "in2"], [1.34, 20]] },
    hat: { r: [[0, 0], [0.3, -10, "out"], [1.2, 16, "in2"]] }, hair_mid: { r: [[0, 0], [0.9, -10], [1.3, 6]] }, cape_tip: { r: [[0, 0], [0.9, -16], [1.3, 8]] }, skirt_hem: { sx: [[0, 1], [1.2, 1.2, "in2"]] } },
    extra: Object.assign({}, I.extra, { G: [[0, P2(N.G)], [0.3, { x: N.G[0] - 14, y: N.G[1] - 16 }, "out"], [1.2, P2(D.G), "in2"]], cr: [[0, N.cr], [0.3, N.cr - 12], [1.2, D.cr, "in2"]],
      hand_l_at: [[0, P2(N.hl)], [1.2, P2(D.hl), "in2"]], head: [[0, "closed"]], alpha: [[0, 1], [1.25, 1], [1.7, 0]] }) }; }
