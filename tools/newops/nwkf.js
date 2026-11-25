// finished keyframe drawings played as the animation. K = { k (drawing px -> rig units), frames: [{ t, img, ox, oy, cx, cy }] sorted by t, slide, xf, still }.
// Each drawing is shown from the midpoint before its time to the midpoint after it. While it is up it keeps travelling with the motion around it (its
// centre of mass slides along the line between its neighbours'), and the change to the next drawing is a short cross-fade, so the body never stands still
// between drawings. A gap flagged rig (frame.rig on its first drawing) is filled by the posed parts instead (drawRig).
(function (root) {
  "use strict";
  const put = (g, K, images, f, dx, dy, al) => { const im = images[f.img]; if (!im || !im.naturalWidth) return false; const ga = g.globalAlpha; g.globalAlpha = ga * al;
    const k = f.k || K.k; g.drawImage(im, -f.ox * k + dx, -f.oy * k + dy, im.naturalWidth * k, im.naturalHeight * k); g.globalAlpha = ga; return true; };
  function slide(K, i, t) {
    const F = K.frames, a = F[Math.max(0, i - 1)], b = F[Math.min(F.length - 1, i + 1)], f = F[i], s = K.slide === undefined ? 0.55 : K.slide;
    if (a === b || f.cx === undefined) return [0, 0];
    const dt = b.t - a.t, lim = K.lim || 26, c = (v) => Math.max(-lim, Math.min(lim, v));
    return [c((b.cx - a.cx) / dt * (t - f.t) * s * K.k), c((b.cy - a.cy) / dt * (t - f.t) * s * K.k * 0.5)];
  }
  function draw(g, K, images, t, drawRig) {
    const F = K.frames;
    if (K.still) {
      const f = F[0], im = images[f.img]; if (!im || !im.naturalWidth) { drawRig(); return { w: 0 }; }
      const b = Math.sin(t * Math.PI * 2 / (K.period || 2.6)), sy = 1 + 0.011 * b, sx = 1 - 0.006 * b;
      g.save(); g.scale(sx, sy); put(g, K, images, f, 0, 0, 1); g.restore(); return { w: 1 };
    }
    let i = 0; while (i + 1 < F.length && F[i + 1].t <= t) i++;
    const a = F[i], b = F[i + 1];
    if (!b || t <= a.t) { const o = slide(K, i, Math.max(a.t, Math.min(t, a.t))); if (!put(g, K, images, a, o[0], o[1], 1)) drawRig(); return { w: 1, i }; }
    const gap = b.t - a.t, mid = a.t + gap / 2, xf = Math.min(K.xf === undefined ? 0.034 : K.xf, gap * 0.45);
    if (a.rig) {   // drawing a, the parts, drawing b
      const hold = Math.min(gap * 0.25, 0.05), u = t - a.t, v = b.t - t;
      if (u <= hold) { const o = slide(K, i, t); put(g, K, images, a, o[0], o[1], 1); return { w: 1, i }; }
      if (v <= hold) { const o = slide(K, i + 1, t); put(g, K, images, b, o[0], o[1], 1); return { w: 1, i: i + 1 }; }
      drawRig(); const w = u < hold + xf ? 1 - (u - hold) / xf : v < hold + xf ? 1 - (v - hold) / xf : 0;
      if (w > 0) { const j = u < v ? i : i + 1, o = slide(K, j, t); put(g, K, images, F[j], o[0], o[1], w); }
      return { w, i };
    }
    const oa = slide(K, i, t), ob = slide(K, i + 1, t);
    if (t < mid - xf / 2) { put(g, K, images, a, oa[0], oa[1], 1); return { w: 1, i }; }
    if (t > mid + xf / 2) { put(g, K, images, b, ob[0], ob[1], 1); return { w: 1, i: i + 1 }; }
    const w = (t - (mid - xf / 2)) / xf;
    put(g, K, images, a, oa[0], oa[1], 1); put(g, K, images, b, ob[0], ob[1], w); return { w: 1, i };
  }
  root.NWKF = { draw };
})(typeof window !== "undefined" ? window : globalThis);
