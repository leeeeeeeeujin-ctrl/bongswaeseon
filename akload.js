// akbench loader: adds converted benchmark stages (a JSON file made by akbench.js convert, kept private) to the engine snapshot in memory.
// Nothing in the game files changes. Used by solver v2 when AKBENCH_STAGES=<file> is set (sim.js requires this module before anything else reads TD).
//   - enemy defs go into TD.ENEMIES, stages are appended to TD.STAGES (after the lab, so no stage index moves);
//   - TD.Game is replaced by a subclass that, on an akbench stage only: sets the stage's start cost (the engine treats a start cost of 0 as "unset"), puts each foe on its fixed AK path (o.akPath, with pauses), and holds later waves until the one before is cleared
//     (AK's wave rule; capped by maxTimeWaitingForNextWave). Every other stage plays exactly as before.
"use strict";
const fs = require("fs");

function install(TD, file) {
  if (TD.__akbench) return TD.__akbench;
  const data = typeof file === "string" ? JSON.parse(fs.readFileSync(file, "utf8")) : file;
  for (const [k, d] of Object.entries(data.enemies || {})) TD.ENEMIES[k] = d;
  for (const st of data.stages || []) {
    // the waits on a fixed path live on the array (path.waits), which JSON does not keep: put them back
    for (const w of st.waves) { const o = w[3]; if (o && o.akPath && o.akWaits && !o.akPath.waits) o.akPath.waits = o.akWaits; }
    const i = TD.STAGES.findIndex((s) => s.code === st.code); if (i >= 0) TD.STAGES[i] = st; else TD.STAGES.push(st);
  }
  const Base = TD.Game;
  const segLen = (p) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; };
  class AKGame extends Base {
    constructor(i, squad) {
      super(i, squad);
      const A = this.stage && this.stage.ak; if (!A) return;
      // AK's life pool (stage.ak.life) is NOT applied: the engine's pool is global (CFG.life) and the solver pads it and counts life lost; the report lists AK's pool
      if (A.startCost !== undefined && A.startCost !== null) this.cost = A.startCost;
      if (A.waves && A.waves.length > 1) {   // wave k+1's entries wait (t = Infinity) until wave k is cleared
        this.waves = this.stage.waves.map((w) => w.slice());
        const first = []; for (let k = 0; k <= A.waves.length; k++) { const j = this.waves.findIndex((w) => w[3].akw >= k); first.push(j < 0 ? this.waves.length : j); }
        for (const w of this.waves) if (w[3].akw > 0) w[0] = Infinity;
        this.akGate = { k: 0, clock: 0, first };
      }
    }
    akStep() {
      const G = this.akGate, W = this.stage.ak.waves, k = G.k; if (k >= W.length - 1) return;
      if (this.waveIdx < G.first[k + 1]) return;   // wave k still spawning
      const fragEnd = G.clock + W[k].span; if (this.t < fragEnd) return;
      const alive = this.enemies.some((e) => !e.dead && !e.ally) || (this.waitSpawn && this.waitSpawn.length);
      if (alive && !(W[k].maxWait >= 0 && this.t >= fragEnd + W[k].maxWait)) return;
      G.k = k + 1; G.clock = this.t + W[k].post;
      for (let j = G.first[k + 1]; j < G.first[k + 2]; j++) this.waves[j][0] = G.clock + this.waves[j][3].akrel;
    }
    update(dt) { if (this.akGate) this.akStep(); return super.update(dt); }
    routeReady(type, s, o) { if (o && o.akPath) return true; return super.routeReady(type, s, o); }
    spawn(type, s, o) {
      const n = this.enemies.length; const r = super.spawn(type, s, o);
      if (o && o.akPath) { const e = r && r.isEnemy ? r : this.enemies[n]; if (e) { const p = o.akPath; e.path = p; e.seg = 0; e.segT = 0; e.x = p[0][0]; e.y = p[0][1]; e.remain = segLen(p); } }
      return r;
    }
  }
  TD.Game = AKGame;
  TD.__akbench = { stages: (data.stages || []).map((s) => s.code), Base, AKGame };
  return TD.__akbench;
}
module.exports = { install };
