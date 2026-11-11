# Cause trace: v1 (life 3, S/bak_v2) -> v2 balance (/home/claude/td)

Cells are im_sim bot-sweep cells (ALLV variants, the recommended rung, im_sim's plan and squad build, seeds 1..5; value = median lives left of 3, 0 = loss). Old engine /tmp/claude-0/-home-claude/0f5894f6-5a4f-5270-947a-362dcd546bdc/scratchpad/solver2/game_v1 (md5 2c01ad7111372bbfce32047c58b30304), new /tmp/claude-0/-home-claude/0f5894f6-5a4f-5270-947a-362dcd546bdc/scratchpad/solver2/game (md5 79c4fb6c29be9c13c2a27c7d949394d3). 102 data fields differ after load.

## IM-10:base: 0 -> 2 (lives 0 0 0 0 0 -> 2 2 2 2 2)

- squad: tao, sunae, ayaki, yui, lilith, alpha, irins, lulu
- traced seed 1: leaks old [none] new [none]; falls old [none] new [none]
- first difference of any kind: frame 360 (t 12.0 s): old skill tao @12s / new skill tao @22s
- changed fields touching the cell: 12; all reverted on the new engine -> 0 (lives 0 0 0 0 0)
  - unit:ayaki.skills.0: revert only -> 0 (undoes the flip); this change alone -> 0 [unit:ayaki.skills.0.sp, unit:ayaki.skills.0.cure]
  - unit:tao.skills.0: revert only -> 0 (undoes the flip); this change alone -> 0 [unit:tao.skills.0.sp, unit:tao.skills.0.init, unit:tao.skills.0.dp]
- **minimal revert that restores 0:** `unit:tao.skills.0.dp` 8 -> undefined
- with only that reverted, the run first differs from the new one at t 165.7 s: without the change fall yui (4,4) @165.77s / with it (nothing)
- **verdict:** responsible: unit:tao.skills.0.dp (15 bisection runs x 5 seeds)

## IM-10:tank: 0 -> 2 (lives 0 0 0 0 0 -> 2 2 2 2 2)

- squad: tao, sunae, ayaki, yui, lilith, nana, irins, ker
- traced seed 1: leaks old [none] new [none]; falls old [none] new [none]
- first difference of any kind: frame 360 (t 12.0 s): old skill tao @12s / new skill tao @22s
- changed fields touching the cell: 13; all reverted on the new engine -> 2 (lives 2 2 2 2 2)
  - unit:yui.skills.0: revert only -> 2; this change alone -> 2 (causes the flip alone) [unit:yui.skills.0.sp, unit:yui.skills.0.cure]
  - unit:ker.skills.0: revert only -> 2; this change alone -> 2 (causes the flip alone) [unit:ker.skills.0.cure]
  - unit:ker.skills.1: revert only -> 2; this change alone -> 2 (causes the flip alone) [unit:ker.skills.1.regen]
  - unit:sunae.skills.0: revert only -> 2; this change alone -> 2 (causes the flip alone) [unit:sunae.skills.0.sp]
  - unit:nana.skills.0: revert only -> 2; this change alone -> 2 (causes the flip alone) [unit:nana.skills.0.sp, unit:nana.skills.0.atk]
  - unit:tao.skills.0: revert only -> 0 (undoes the flip); this change alone -> 2 (causes the flip alone) [unit:tao.skills.0.sp, unit:tao.skills.0.init, unit:tao.skills.0.dp]
- **minimal revert that restores 0:** `unit:tao.skills.0.dp` 8 -> undefined
- with only that reverted, the run first differs from the new one at t 167.9 s: without the change fall yui (4,4) @167.97s / with it (nothing)
- **verdict:** reverting all 13 candidate data fields gives 2 (old 0, new 2): part of the cause is outside the data (code), or in fields outside this squad (18 bisection runs x 5 seeds)

## IM-10:low: 1 -> 3 (lives 1 1 1 1 1 -> 3 3 3 3 3)

- squad: tao, defender, ayaki, brick, lilith, nana, caster, hiro
- traced seed 1: leaks old [none] new [none]; falls old [none] new [none]
- first difference of any kind: frame 360 (t 12.0 s): old skill tao @12s / new skill tao @22s
- changed fields touching the cell: 19; all reverted on the new engine -> 0 (lives 0 0 0 0 0)
  - unit:brick.skills.0: revert only -> 1 (undoes the flip); this change alone -> 2 [unit:brick.skills.0.sp, unit:brick.skills.0.def]
- **minimal revert that restores 1:** `unit:brick.skills.0.sp` 35 -> 30
- **verdict:** reverting all 19 candidate data fields gives 0 (old 1, new 3): part of the cause is outside the data (code), or in fields outside this squad (19 bisection runs x 5 seeds)

## IM-09:fire: 1 -> 3 (lives 1 1 1 1 1 -> 3 3 3 3 3)

- squad: hiro, yui, nana, alpha, sunae, lilith, lulu, irins
- traced seed 1: leaks old [none] new [none]; falls old [sunae@79.97, lilith@95.73] new [sunae@77.57]
- first difference of any kind: frame 391 (t 13.0 s): old deploy yui (12,4) @13.03s / new deploy yui (12,4) @15.03s
- first material divergence: frame 2326 (t 77.5 s): old fall sunae (6,4) @79.97s / new fall sunae (6,4) @77.57s
- in the next 15 s, only on old: -; only on new: skill nana @92.17s
- changed fields touching the cell: 13; all reverted on the new engine -> 1 (lives 1 1 1 1 1)
  - unit:hiro: revert only -> 1 (undoes the flip); this change alone -> 1 [unit:hiro.cost]
- **minimal revert that restores 1:** `unit:hiro.cost` 15 -> 13
- with only that reverted, the run first differs from the new one at t 77.5 s: without the change fall sunae (6,4) @79.97s / with it fall sunae (6,4) @77.57s
- **verdict:** responsible: unit:hiro.cost (17 bisection runs x 5 seeds)

## WL-05:low: 0 -> 2 (lives 0 0 0 0 0 -> 2 2 2 2 2)

- squad: brick, nana, defender, tao, hiro, ayaki, lilith, caster
- traced seed 1: leaks old [none] new [none]; falls old [caster@108.43, hiro@146.4] new [caster@108.43, hiro@146.4]
- first difference of any kind: frame 540 (t 18.0 s): old skill brick @18s / new skill brick @23s
- changed fields touching the cell: 19; all reverted on the new engine -> 0 (lives 0 0 0 0 0)
  - unit:tao.skills.0: revert only -> 0 (undoes the flip); this change alone -> 2 (causes the flip alone) [unit:tao.skills.0.sp, unit:tao.skills.0.init, unit:tao.skills.0.dp]
- **minimal revert that restores 0:** `unit:tao.skills.0.dp` 8 -> undefined
- **verdict:** responsible: unit:tao.skills.0.dp (18 bisection runs x 5 seeds)
