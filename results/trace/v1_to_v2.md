# Cause trace: v1 (life 3, S/bak_v2) -> v2 balance (/home/claude/td)

Cells are im_sim bot-sweep cells (ALLV variants, the recommended rung, im_sim's plan and squad build, seeds 1..5; value = median lives left of 3, 0 = loss). Old engine /tmp/claude-0/-home-claude/0f5894f6-5a4f-5270-947a-362dcd546bdc/scratchpad/solver2/game_v1 (md5 2c01ad7111372bbfce32047c58b30304), new /tmp/claude-0/-home-claude/0f5894f6-5a4f-5270-947a-362dcd546bdc/scratchpad/solver2/game (md5 79c4fb6c29be9c13c2a27c7d949394d3). 101 data fields differ after load.

## IM-10:base: 0 -> 2 (lives 0 0 0 0 0 -> 2 2 2 2 2)

- squad: tao, sunae, ayaki, yui, lilith, alpha, irins, lulu
- traced seed 1: leaks old [yfang@172.3, yfang@173.3, bomber@183.6] new [bomber@188.8]; falls old [none] new [none]
- first difference of any kind: frame 360 (t 12.0 s): old skill tao @12s / new kill soldier#2 @15.73s
- first material divergence: frame 750 (t 25.0 s): old kill soldier#7 @27.73s / new kill soldier#7 @25.03s
- in the next 15 s, only on old: skill ayaki @29.03s; only on new: -
- changed fields touching the cell: 12; all reverted on the new engine -> 0 (lives 0 0 0 0 0)
  - unit:ayaki.skills.0: revert only -> 0 (undoes the flip); this change alone -> 0 [unit:ayaki.skills.0.sp, unit:ayaki.skills.0.cure]
  - unit:tao.skills.0: revert only -> 0 (undoes the flip); this change alone -> 0 [unit:tao.skills.0.sp, unit:tao.skills.0.init, unit:tao.skills.0.dp]
- **minimal revert that restores 0:** `unit:tao.skills.0.dp` 8 -> 10
- with only that reverted, the run first differs from the new one at t 38.8 s: without the change kill yfang#14 @38.83s / with it kill yfang#14 @42.53s
- **verdict:** responsible: unit:tao.skills.0.dp (15 bisection runs x 5 seeds)

## IM-10:tank: 0 -> 2 (lives 0 0 0 0 0 -> 2 2 2 2 2)

- squad: tao, sunae, ayaki, yui, lilith, nana, irins, ker
- traced seed 1: leaks old [yfang@172.3, yfang@173.3, yfang@174.3] new [bomber@190.93]; falls old [none] new [none]
- first difference of any kind: frame 360 (t 12.0 s): old skill tao @12s / new kill soldier#2 @15.73s
- first material divergence: frame 750 (t 25.0 s): old kill soldier#7 @27.73s / new kill soldier#7 @25.03s
- in the next 15 s, only on old: skill ayaki @29.03s; only on new: -
- changed fields touching the cell: 13; all reverted on the new engine -> 0 (lives 0 0 0 0 0)
  - unit:tao.skills.0: revert only -> 0 (undoes the flip); this change alone -> 2 (causes the flip alone) [unit:tao.skills.0.sp, unit:tao.skills.0.init, unit:tao.skills.0.dp]
- **minimal revert that restores 0:** `unit:tao.skills.0.sp` 28 -> 24, `unit:tao.skills.0.init` 6 -> 12, `unit:tao.skills.0.dp` 8 -> 10
- with only that reverted, the run first differs from the new one at t 25 s: without the change kill soldier#7 @27.73s / with it kill soldier#7 @25.03s
- **verdict:** responsible: unit:tao.skills.0.sp, unit:tao.skills.0.init, unit:tao.skills.0.dp (22 bisection runs x 5 seeds)

## IM-10:low: 1 -> 3 (lives 1 1 1 1 1 -> 3 3 3 3 3)

- squad: tao, defender, ayaki, brick, lilith, nana, caster, hiro
- traced seed 1: leaks old [grenadier@161.13, yfang@172.3] new [none]; falls old [none] new [none]
- first difference of any kind: frame 360 (t 12.0 s): old skill tao @12s / new kill soldier#2 @16.27s
- first material divergence: frame 692 (t 23.1 s): old kill soldier#5 @23.47s / new kill soldier#6 @23.1s
- in the next 15 s, only on old: skill ayaki @28.03s; only on new: -
- changed fields touching the cell: 19; all reverted on the new engine -> 1 (lives 1 1 1 1 1)
  - unit:brick.skills.0: revert only -> 1 (undoes the flip); this change alone -> 3 (causes the flip alone) [unit:brick.skills.0.sp, unit:brick.skills.0.def]
- **minimal revert that restores 1:** `unit:brick.skills.0.sp` 35 -> 30
- with only that reverted, the run first differs from the new one at t 56 s: without the change kill soldier#17 @57.2s / with it kill drummer#18 @56.03s
- **verdict:** responsible: unit:brick.skills.0.sp (19 bisection runs x 5 seeds)

## IM-09:fire: 1 -> 3 (lives 1 1 1 1 1 -> 3 3 3 3 3)

- squad: hiro, yui, nana, alpha, sunae, lilith, lulu, irins
- traced seed 1: leaks old [iceguard@184.13] new [none]; falls old [sunae@79.97, lilith@95.73] new [sunae@77.57]
- first difference of any kind: frame 391 (t 13.0 s): old deploy yui (12,4) @13.03s / new deploy yui (12,4) @15.03s
- first material divergence: frame 889 (t 29.6 s): old kill strag#4 @33.3s / new kill yfang#11 @29.67s
- in the next 15 s, only on old: deploy alpha (11,4) @44.03s; only on new: skill yui @30.03s
- changed fields touching the cell: 13; all reverted on the new engine -> 1 (lives 1 1 1 1 1)
  - unit:hiro: revert only -> 1 (undoes the flip); this change alone -> 1 [unit:hiro.cost]
- **minimal revert that restores 1:** `unit:hiro.cost` 15 -> 13
- with only that reverted, the run first differs from the new one at t 29.6 s: without the change kill strag#4 @33.3s / with it kill yfang#11 @29.67s
- **verdict:** responsible: unit:hiro.cost (17 bisection runs x 5 seeds)

## WL-05:low: 0 -> 2 (lives 0 0 0 0 0 -> 2 2 2 2 2)

- squad: brick, nana, defender, tao, hiro, ayaki, lilith, caster
- traced seed 1: leaks old [soldier@161.87, soldier@162.3, soldier@162.4] new [grenadier@150.83]; falls old [caster@108.43, hiro@146.4] new [caster@108.43, hiro@146.4]
- first difference of any kind: frame 540 (t 18.0 s): old skill brick @18s / new skill brick @23s
- first material divergence: frame 1954 (t 65.1 s): old kill chasseur#14 @65.17s / new kill chasseur#14 @66.57s
- in the next 15 s, only on old: skill ayaki @76.03s; deploy lilith (1,5) @80.03s; only on new: deploy ayaki (5,3) @66.03s; skill brick @70.03s
- changed fields touching the cell: 19; all reverted on the new engine -> 0 (lives 0 0 0 0 0)
  - unit:tao.skills.0: revert only -> 0 (undoes the flip); this change alone -> 2 (causes the flip alone) [unit:tao.skills.0.sp, unit:tao.skills.0.init, unit:tao.skills.0.dp]
- **minimal revert that restores 0:** `unit:tao.skills.0.init` 6 -> 12
- with only that reverted, the run first differs from the new one at t 87.6 s: without the change kill soldier#18 @87.6s / with it kill soldier#26 @88.67s
- **verdict:** responsible: unit:tao.skills.0.init (22 bisection runs x 5 seeds)
