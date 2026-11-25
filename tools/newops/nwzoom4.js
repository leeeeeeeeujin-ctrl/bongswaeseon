// close look in the real battle at 4x: the attack against a blocked enemy, the skill, the defeat. node nwzoom2.js <id>
const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const id = process.argv[2] || "unneko", X = +(process.argv[3] || 7);
(async () => { const b = await chromium.launch({ args: ["--allow-file-access-from-files"] }); const p = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 4 });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("file:///home/claude/td/index.html"); await p.waitForTimeout(3500);
  await p.evaluate((sk) => { window.__sk = sk; }, +(process.argv[4] || 1));
  await p.evaluate((id) => { window.__bslGo("sandbox"); document.getElementById("meta").hidden = true; TDB.start("sandbox", [{ id, skillIdx: (window.__sk === undefined ? 1 : window.__sk), elite: 2, slv: 7 }], () => {}); }, id);
  await p.waitForTimeout(800); for (let i = 0; i < 4; i++) { await p.mouse.click(420, 100); await p.waitForTimeout(120); }
  const ok = await p.evaluate((X) => { const g = __tdGame(); g.cost = 99; const r = g.deploy(0, X, 3, 2); for (let i = 0; i < 3; i++) setTimeout(() => { const e = g.spawn("soldier", 0); e.hp = e.maxHp = 90000; e.atk = 1; }, i * 1500); return !!r; }, X);
  const clip = { x: 380, y: 110, width: 150, height: 110 };
  const run = async (tag, n, dt) => { for (let i = 0; i < n; i++) { await p.screenshot({ path: __dirname + `/z_${id}_${tag}${i}.png`, clip }); await p.waitForTimeout(dt); } };
  await p.waitForTimeout(9000);
  const st = await p.evaluate(() => { const g = __tdGame(), u = g.units[0]; u.sp = u.skill.sp; if (u.skill.mode === "manual") g.useSkill(u); return [u.skill.id, u.skill.mode]; });
  await p.waitForTimeout(st[1] === "manual" ? 2300 : 300); await run("v", 28, 45); console.log(st, await p.evaluate(() => { const u = __tdGame().units[0]; return [u.skillT, u._nw && u._nw.av]; }));
  console.log(ok, errs.slice(0, 4)); await b.close(); })();
