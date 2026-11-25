// one rigged trial operator in the training ground at phone size: frames through an attack; node nwshot.js <id>
const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const id = process.argv[2] || "unneko";
(async () => { const b = await chromium.launch({ args: ["--allow-file-access-from-files"] }); const p = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("file:///home/claude/td/index.html"); await p.waitForTimeout(3000);
  await p.evaluate((id) => { window.__bslGo("sandbox"); document.getElementById("meta").hidden = true; TDB.start("sandbox", [{ id, skillIdx: 1, elite: 2, slv: 7 }, { id: "yui", skillIdx: 0, elite: 2, slv: 7 }], () => {}); }, id);
  await p.waitForTimeout(800); for (let i = 0; i < 4; i++) { await p.mouse.click(420, 100); await p.waitForTimeout(120); }
  const info = await p.evaluate(() => { const g = __tdGame(); g.cost = 99; const out = [];
    for (let ci = 0; ci < g.cards.length; ci++) { let done = false; for (let y = 2; y < TD.H && !done; y++) for (let x = 5; x < TD.W && !done; x++) if (g.canDeployAt(g.cards[ci], x, y) && g.deploy(ci, x, y, 2)) { done = true; out.push([g.cards[ci].def.id, x, y]); } }
    return out; });
  await p.evaluate(() => { const g = __tdGame(); window.__sp = setInterval(() => { for (let i = 0; i < 2; i++) { const e = g.spawn("heavy", i); e.hp = e.maxHp = 30000; } }, 2500); const e = g.spawn("heavy", 0); e.hp = e.maxHp = 30000; });
  for (let i = 0; i < 12; i++) { await p.waitForTimeout(i < 4 ? 2500 : 170); if (i >= 3) await p.screenshot({ path: __dirname + `/shot_${id}_${i - 3}.png` }); }
  console.log(JSON.stringify(info), errs.slice(0, 5)); await b.close(); })();
