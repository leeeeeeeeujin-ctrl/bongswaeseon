// Battle logic for a grid tower-defence prototype. No DOM in here, so it also runs in node
// for headless balance tests. Coordinates are in tiles; tile (x,y) has its centre at (x,y).
(function (root) {
  "use strict";

  const MAP0 = [
    "#hhhh..hhhh##",
    "S....h.....h#",
    "#hh..h.hhh.h#",
    "#h..........B",
    "#hh.hhh.hh..#",
    "S...h......h#",
    "##hhh..hhhh##",
  ];
  // the link terminal's training grid: one straight corridor, the intrusion point on the left, the receiver on the right
  const MAP_TUT = [
    "#############",
    "#############",
    "##hhhhhhhhh##",
    "#S.........B#",
    "##hhhhhhhhh##",
    "#############",
    "#############",
  ];
  let MAP = MAP0;

  // dir: 0 right, 1 down, 2 left, 3 up. Ranges are written facing right.
  const box = (x0, x1, y0, y1) => { const r = []; for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) r.push([x, y]); return r; };
  const RANGE = {
    melee: [[0, 0], [1, 0]],
    self: [[0, 0]],
    around: box(-1, 1, -1, 1),
    long: box(0, 3, -1, 1),
    arts: box(0, 2, -1, 1).concat([[3, 0]]),
    heal: box(0, 3, -1, 1),
    support: box(0, 2, -1, 1),
    lob: box(0, 4, -1, 1),
    support2: box(-1, 2, -1, 1),   // a support reach that also covers the line behind her
    slastra: box(-1, 3, -2, 2).filter(([x, y]) => !(x === 3 && y !== 0) && !(Math.abs(y) === 2 && x >= 1)),   // Silphy's 아스트라: her own reach grown — a tile wider beside and behind her, and one more straight ahead
    front3: box(1, 3, -1, 1),
    ansave: box(-1, 3, -2, 2),   // 구원: the sphere of light spreads a row wider each side and a tile further ahead
    sqstar: box(-1, 3, -2, 2).filter(([x, y]) => !(Math.abs(y) === 2 && (x === -1 || x === 3))),   // 죽음의 성좌: her reach grown a row out on each side and one more ahead   // the board she lays down ahead of her
    deadeye: box(0, 4, -1, 1).concat([[1, -2], [2, -2], [3, -2], [1, 2], [2, 2], [3, 2]]),   // 저격수: a wide field of fire once promoted
    lord: [[0, 0], [1, 0], [2, 0], [3, 0], [1, -1], [1, 1], [2, -1], [2, 1]],   // a lord's reach: the blade at hand, and the cut that flies on down the line
  };

  const UNITS = [
    { id: "vanguard", cls: "선봉", name: "로완", glyph: "선", tile: "g", cost: 9, hp: 1450, atk: 360, def: 240, res: 0, interval: 1.0, block: 2, range: "melee", dmg: "phys", redeploy: 70,
      skill: { name: "보급 신호", desc: "즉시 배치 코스트 +{dp}", sp: 34, init: 4, mode: "manual", dur: 0, dp: 8 } },
    { id: "guard", cls: "근위", name: "카이", glyph: "근", tile: "g", cost: 13, hp: 2300, atk: 560, def: 320, res: 0, interval: 1.1, block: 2, range: "melee", dmg: "phys", redeploy: 70,
      skill: { name: "맹습", desc: "{dur}초간 공격력 +{atk+%}", sp: 25, init: 0, mode: "auto", dur: 8, atk: 1.4, scale: { atk: "B" } } },
    { id: "defender", cls: "중장", name: "브람", glyph: "중", tile: "g", cost: 16, hp: 3400, atk: 380, def: 620, res: 10, interval: 1.2, block: 3, range: "self", dmg: "phys", redeploy: 70,
      skill: { name: "철벽", desc: "{dur}초간 방어력 +{def+%}, 저지 +1, 체력 {cure%} 회복", sp: 32, init: 12, mode: "manual", dur: 10, def: 1.6, cure: 0.15, scale: { def: "D", cure: "H" } } },
    { id: "sniper", cls: "저격", name: "세라", glyph: "저", tile: "h", cost: 9, hp: 1200, atk: 470, def: 110, res: 0, interval: 1.0, block: 0, range: "long", dmg: "phys", redeploy: 70, airFirst: true,
      skill: { name: "속사", desc: "{dur}초간 공격 속도 {speed}배", sp: 20, init: 4, mode: "auto", dur: 10, speed: 1.6, scale: { speed: "C" } } },
    { id: "caster", cls: "술사", name: "이오", glyph: "술", tile: "h", cost: 16, hp: 1100, atk: 600, def: 80, res: 15, interval: 1.6, block: 0, range: "arts", dmg: "arts", redeploy: 70,
      skill: { name: "폭렬", desc: "범위 안 모든 적에게 공격력 {mul%} 마법 피해", sp: 24, init: 10, mode: "manual", dur: 0, mul: 2.6, scale: { mul: "A" } } },
    { id: "medic", cls: "의무", name: "미르", glyph: "의", tile: "h", cost: 15, hp: 1150, atk: 420, def: 90, res: 10, interval: 2.2, block: 0, range: "heal", dmg: "heal", redeploy: 70,
      skill: { name: "응급 처치", desc: "범위 안 모든 아군 체력 {cure%} 회복", sp: 25, init: 6, mode: "auto", dur: 0, cure: 0.12, scale: { cure: "H" } } },
    { id: "supporter", cls: "보조", name: "노바", glyph: "보", tile: "h", cost: 10, hp: 1150, atk: 300, def: 90, res: 15, interval: 1.4, block: 0, range: "support", dmg: "arts", slow: 0.35, redeploy: 70,
      skill: { name: "중력장", desc: "{dur}초간 범위 안 적 이동 속도 -{slow%}", sp: 22, init: 8, mode: "manual", dur: 6, slow: 0.65, scale: { slow: "F" } } },
    { id: "specialist", cls: "특수", name: "제트", glyph: "특", tile: "g", cost: 6, hp: 1300, atk: 430, def: 200, res: 0, interval: 0.9, block: 1, range: "melee", dmg: "phys", redeploy: 18,
      skill: { name: "밀쳐내기", desc: "앞쪽 적을 밀어내고(힘 {force}) {stun}초 기절, 공격력 {mul%} 피해", sp: 14, init: 14, mode: "manual", dur: 0, mul: 1.5, force: 3, stun: 1, scale: { mul: "A", force: "K", stun: "G" } } },
    { id: "yui", cls: "중장", name: "서브테러", nameEn: "Subterror", glyph: "서", noTrueName: true, tile: "g", cost: 17, hp: 3700, atk: 430, def: 640, res: 15, interval: 1.3, windup: 0.5, block: 3, range: "melee", dmg: "phys", redeploy: 70, deployAnim: 1.0, defaultSkill: 2,
      art: true, talent: { name: "외신의 편린", desc: "주위 8칸의 아군이 받는 피해 -10%" },
      skills: [
        { id: "e_mercy", name: "자애의 손길", desc: "피격 시 SP 1 회복. 발동 시 자신과 주위 8칸 중 체력 비율이 가장 낮은 아군의 체력을 공격력의 {cure%}만큼 회복", sp: 5, init: 0, mode: "auto", spType: "hit", dur: 0, cure: 1.4, scale: { cure: "E" } },
        { id: "e_pray", name: "고해의 기도", desc: "{dur}초간 공격하지 않음. 받는 피해 -{taken-%}, 주위 8칸의 아군이 받는 피해의 50%를 대신 받음", sp: 30, init: 15, mode: "manual", dur: 15, taken: 0.5, scale: { taken: "R" } },
        { id: "e_judge", name: "편린의 심판", desc: "{dur}초간 공격하지 않고 초당 최대 체력 2%를 잃음. 주위 2칸 적의 이동 속도 -{slow%}. 종료 시 그동안 받은 모든 피해의 {mul%}를 주위 2칸의 적에게 고정 피해로 돌려주고 밀쳐냄(힘 {force}, {stun}초 기절)", sp: 40, init: 20, mode: "manual", dur: 12, slow: 0.6, force: 3, stun: 0.8, mul: 1, scale: { slow: "F", force: "K", stun: "G", mul: "A" } },
      ] },
    { id: "atat", cls: "보조", name: "@@@", nameEn: "@@@", glyph: "@", tile: "h", cost: 8, hp: 1180, atk: 410, def: 95, res: 15, interval: 1.9, windup: 0.33, block: 0, range: "support", dmg: "arts", redeploy: 70, deployAnim: 1.0,
      rarity: 4, iconAs: "supporter", col: "#e2464a", art: { e0: "a_e0", card: "a_card", e2: "a_e2", card2: "a_card2" }, summon: { id: "scribble", max: 2, maxE: [2, 3, 3], hpE: [950, 1150, 1350], atkE: [300, 340, 380], back: 15 }, paper: true,
      talent: { name: "그려진 아이", desc: "배치 중 소환물 '낙서'를 지상에 2개(정예화 1부터 3개)까지 배치 가능(찢어지면 15초 뒤 다시). 낙서의 체력·공격력은 정예화할수록 오른다. 종이 몸: 척탄병에게 받는 피해 +50%" },
      skills: [
        { id: "d_paint", name: "덧칠", desc: "자신의 낙서 전원의 체력을 {cure%} 회복하고 {dur}초간 공격력 +{atk+%}. 찢어진 낙서 1개를 즉시 다시 그릴 수 있게 됨", sp: 20, init: 8, mode: "auto", dur: 15, cure: 0.5, atk: 1.6, scale: { cure: "H", atk: "B" } },
        { id: "d_swap", name: "붉은 머플러", desc: "낙서 하나와 자리를 바꿔 {dur}초간 지상에서 싸움. 최대 체력 +100%, 공격력 +{atk+%}, 방어력 +{def+%}, 저지 2, 공격 속도 +{speed+%}, 머플러로 근접 공격. 끝나면 원래 자리로 돌아감", sp: 25, init: 12, mode: "manual", dur: 20, atk: 1.8, def: 2.5, speed: 1.35, scale: { atk: "B", def: "D", speed: "C" } },
      ] },
    { id: "belina", cls: "선봉", name: "벨이나", nameEn: "Belina", glyph: "벨", tile: "g", cost: 11, hp: 2150, atk: 470, def: 350, res: 0, interval: 1.05, windup: 0.32, block: 2, range: "melee", dmg: "phys", redeploy: 70, deployAnim: 0.9,
      rarity: 5, iconAs: "vanguard", col: "#d9402e", art: { e0: "b_e0", card: "b_card", e2: "b_e2", card2: "b_card2" },
      talent: { name: "시위대 회장", desc: "배치 중 아군 [선봉] 전원 방어력 +8%" },
      skills: [
        { id: "b_chant", name: "구호", desc: "피격 시 SP 1 회복. 발동 시 즉시 코스트 +{dp}", sp: 30, init: 6, mode: "auto", spType: "hit", dur: 0, dp: 12 },
        { id: "b_roar", name: "1억 명의 함성", desc: "피격 시 SP 1 회복. {dur}초 동안 코스트 +{roarDp}을 나눠 얻고 아군 [선봉] 전원 공격력·방어력 +{atk+%}. 지속 중 자신이 적을 처치할 때마다 코스트 +1", sp: 30, init: 8, mode: "manual", spType: "hit", dur: 10, atk: 1.25, roarDp: 10, scale: { atk: "B" } },
      ] },
    // Hakuren: a standard bearer who does nothing at all — no attack, no block; the flow of things brings the cost (and the cure) to her side
    { id: "hakuren", cls: "선봉", name: "하쿠렌", nameEn: "Hakuren", glyph: "하", tile: "g", cost: 8, hp: 1450, atk: 0, def: 230, res: 0, interval: 1.0, block: 0, range: "around", dmg: "phys", redeploy: 70, deployAnim: 0.9,
      rarity: 4, iconAs: "vanguard", col: "#d9c79a", art: { e0: "h_e0", card: "h_card", e2: "h_e2", card2: "h_card2" }, noAttack: true, unseen: true,
      talent: { name: "여기에 있을 뿐", desc: "적을 공격하지도 저지하지도 않는다. 원거리 적은 사거리 안에 다른 아군이 있으면 하쿠렌을 노리지 않는다" },
      skills: [
        { id: "h_flow", name: "긍정적 흐름", desc: "{dur}초 동안 코스트 +{dp}를 나눠 얻는다", sp: 26, init: 8, mode: "auto", dur: 8, dp: 14 },
        { id: "h_none", name: "그녀는 아무것도 하지 않았다", desc: "{dur}초 동안 코스트 +{dp}을 나눠 얻고, 주위 8칸 아군의 HP를 매초 최대 HP의 {heal%}씩 회복한다", sp: 32, init: 16, mode: "manual", dur: 16, dp: 10, heal: 0.03, scale: { heal: "H" } },
      ] },
    // Miho: the land god of the fox mountain. Weak single heals carried by slow fox-fire, but they spill onto everyone around
    { id: "miho", cls: "의무", name: "미호", nameEn: "Miho", glyph: "미", tile: "h", cost: 16, hp: 1180, atk: 300, def: 95, res: 15, interval: 2.85, block: 0, range: "heal", dmg: "heal", redeploy: 70, deployAnim: 0.9,
      rarity: 4, iconAs: "medic", col: "#e8e2da", art: { e0: "m_e0", card: "m_card", e2: "m_e2", card2: "m_card2" }, healFlight: 0.95, splash: 0.3,
      talent: { name: "여우비", desc: "치료 시 대상 주위 8칸의 다른 아군도 치료량의 30%만큼 회복. 치료는 느린 여우불로 날아가 도착할 때 적용된다" },
      skills: [
        { id: "m_bless", name: "자연의 축복", desc: "사거리 내 모든 아군의 HP를 공격력의 {cure%}만큼 즉시 회복한다", sp: 20, init: 6, mode: "auto", dur: 0, cure: 0.6, scale: { cure: "E" } },
        { id: "m_rain", name: "추억의 비", desc: "{dur}초 동안 사거리에 비를 내린다. 비 속의 아군은 매초 공격력의 {cure%}만큼 회복하고, 적은 공격력 -{weak%}. 지속 중 일반 치료를 하지 않는다", sp: 40, init: 15, mode: "manual", dur: 15, rain: true, cure: 0.15, weak: 0.25, scale: { cure: "E", weak: "P" } },
      ] },
    // Lulu (he): the middle of three warrior siblings from the Steel Mountains. Plate armour that only gets heavier the longer he stands
    { id: "lulu", cls: "근위", name: "루루", nameEn: "Lulu", glyph: "루", tile: "g", cost: 17, hp: 2550, atk: 400, def: 330, res: 0, interval: 1.25, windup: 0.36, block: 2, range: "melee", dmg: "phys", redeploy: 70, deployAnim: 0.9,
      rarity: 4, iconAs: "guard", col: "#b9a6e6", art: { e0: "l_e0", card: "l_card", e2: "l_e2", card2: "l_card2" }, grow: { every: 10, step: 0.05, max: 6 },
      talent: { name: "판금숙련", desc: "배치 후 10초마다 공격력·방어력 +5% (최대 6회, +30%). 받는 상태이상 지속시간 -50%" },
      skills: [
        { id: "l_strike", name: "강타", desc: "공격 {sp}회마다 자동 발동: 다음 공격이 공격력의 {mul%}(판금숙련 1단계마다 +10%) 일격이 되고, 자신의 HP를 공격력의 {cure%}만큼 회복", sp: 6, init: 0, mode: "auto", spType: "atk", dur: 0, mul: 2.0, cure: 0.8, scale: { mul: "A", cure: "E" } },
        { id: "l_ban", name: "신념의 검", desc: "{dur}초 동안 공격력 +{atk+%}, 받는 피해 -{taken-%}", sp: 40, init: 8, mode: "manual", spType: "atk", dur: 20, atk: 1.4, taken: 0.6, scale: { atk: "B", taken: "R" } },
      ] },
    // Irins: the mistress of a labyrinth-mansion. A showman on stage, a shut-in off it
    { id: "irins", cls: "술사", name: "아이린스", nameEn: "Irins", glyph: "아", tile: "h", cost: 17, hp: 1150, atk: 580, def: 85, res: 15, interval: 1.6, windup: 0.3, block: 0, range: "arts", dmg: "arts", redeploy: 70, deployAnim: 1.0,
      rarity: 4, iconAs: "caster", col: "#c4243a", art: { e0: "ir_e0", card: "ir_card", e2: "ir_e2", card2: "ir_card2" },
      talent: { name: "미궁의 주인", desc: "공격하지 않는 동안 1.2초마다 해골 사역마가 하나씩 모인다(최대 3). 다음 공격 때 모두 함께 날아가 각각 공격력의 50% 마법 피해" }, fam: { every: 1.2, max: 3, mul: 0.5 },
      skills: [
        { id: "i_welcome", name: "어서 오게, 손님~!", desc: "다음 공격이 공격력 {mul%} 마법 피해를 주고, 발밑의 함정에 빠뜨려 {bind}초간 묶는다(보스는 {bind*0.5}초)", sp: 10, init: 3, mode: "auto", dur: 0, mul: 2, bind: 2, scale: { mul: "A", bind: "G" } },
        { id: "i_maze", name: "미궁의 저택", desc: "{dur}초 동안 사거리 안의 적은 이동 속도 -{maze.slow%}, 매초 공격력의 {maze.dot%} 마법 피해. 끝나면 5초 동안 이불 속에 틀어박혀 공격하지 않는다", sp: 35, init: 15, mode: "manual", dur: 15, maze: { slow: 0.55, dot: 0.4, hiki: 5 }, scale: { "maze.slow": "F", "maze.dot": "A" } },
      ] },
    // Alpha: a small masked mercenary-for-hire. A gun for the far ones, a machete for the near ones
    { id: "alpha", cls: "저격", name: "알파", nameEn: "Alpha", glyph: "알", tile: "h", cost: 10, hp: 1250, atk: 490, def: 120, res: 0, interval: 1.0, windup: 0.2, block: 0, range: "long", dmg: "phys", redeploy: 70, deployAnim: 0.95, airFirst: true,
      rarity: 4, iconAs: "sniper", col: "#e6e1d6", art: { e0: "al_e0", card: "al_card", e2: "al_e2", card2: "al_card2" },
      talent: { name: "만능 용병", desc: "가까운 적에게는 총 대신 마체테로 베어 공격력의 130% 피해. 치명상을 입으면 배치당 한 번 HP 1로 버티고 1.5초간 피해를 받지 않는다 —「장난은 여기까지.」" },
      skills: [
        { id: "a_scout", name: "현장 파악", desc: "{dur}초 동안 같은 적을 연달아 공격할 때마다 공격력 +{per%}(최대 +{per*5%}). 대상이 바뀌면 처음부터", sp: 25, init: 10, mode: "auto", dur: 20, per: 0.1, scale: { per: "A" } },
        { id: "a_hire", name: "고용", desc: "사거리 안의 일반 적 중 HP가 가장 낮은 하나를 {dur}초 동안 고용한다. 고용된 적은 HP가 모두 회복되고 받는 피해 -{taken-%}, 그 자리에 멈춰 다가오는 적을 2명까지 막고 공격한다. 계약이 끝나면 다시 적이 된다. 보스와 정예(척탄병 등)는 고용되지 않는다", sp: 30, init: 12, mode: "manual", dur: 15, taken: 0.6, scale: { taken: "R" } },
      ] },
    // Skakea: a young tactician of Incella. Every fight is a game of chess to her; she pushes the pieces where she wants them
    { id: "skakea", cls: "특수", name: "스카케아", nameEn: "Skakea", glyph: "스", tile: "g", cost: 17, hp: 1650, atk: 480, def: 260, res: 0, interval: 1.2, windup: 0.3, block: 2, range: "melee", dmg: "phys", redeploy: 70, deployAnim: 1.0,
      rarity: 4, iconAs: "specialist", col: "#d8dde8", art: { e0: "sk_e0", card: "sk_card", e2: "sk_e2", card2: "sk_card2" }, board: { per: 0.5, mul: 0.3 },
      talent: { name: "체스판", desc: "배치 중 공격 범위의 바닥이 체스판이 된다. 체스판 위에서 적이 이동하면 반 칸마다 공격력의 30% 마법 피해를 입는다" },
      skills: [
        { id: "k_e4", name: "E4 오프닝", desc: "다음 공격이 공격력 {mul%} 물리 피해를 주고 대상을 앞으로 밀어낸다(힘 {force}). 무거운 적일수록 덜 밀린다", sp: 6, init: 2, mode: "auto", dur: 0, mul: 1.3, force: 2, scale: { mul: "A", force: "K" } },
        { id: "k_mate", name: "시공간 체크메이트", desc: "앞 2칸 안의 지상 적 전원에게 공격력 {mul%} 물리 피해를 주고 앞으로 밀어낸다(힘 {force}). 무거운 적일수록 덜 밀린다", sp: 20, init: 8, mode: "manual", dur: 0, mul: 1.5, force: 3, scale: { mul: "A", force: "K" } },
      ] },
    // Ker: head of the Harmony Council, older than the earth-god. An old tree does not fall; it grows back
    { id: "ker", cls: "중장", name: "케르", nameEn: "Ker", glyph: "케", tile: "g", cost: 17, hp: 3300, atk: 360, def: 600, res: 10, interval: 1.3, windup: 0.42, block: 3, range: "melee", dmg: "phys", redeploy: 70, deployAnim: 1.0,
      rarity: 4, iconAs: "defender", col: "#7aa64a", art: { e0: "ke_e0", card: "ke_card", e2: "ke_e2", card2: "ke_card2" }, regen: 0.015,
      talent: { name: "태고의 지혜", desc: "매초 최대 체력의 1.5%를 회복한다" },
      skills: [
        { id: "ke_view", name: "흐름의 관조", desc: "피격 시 SP 1 회복. 최대 체력의 {cure%}를 즉시 회복한다", sp: 10, init: 3, mode: "auto", spType: "hit", dur: 0, cure: 0.2, scale: { cure: "H" } },
        { id: "ke_unity", name: "만물 동화", desc: "{dur}초 동안 방어력 +{def+%}, 「태고의 지혜」의 회복량 {regen}배", sp: 35, init: 15, mode: "manual", dur: 20, def: 1.5, regen: 2, scale: { def: "D", regen: "B" } },
      ] },
    // The Pure-Love Knight: appears out of nowhere to guard pure love from every impure threat. Solemn, and a little ridiculous
    { id: "sunae", cls: "중장", name: "순애기사", nameEn: "Pure Love Knight", glyph: "순", tile: "g", cost: 17, hp: 3100, atk: 420, def: 640, res: 0, interval: 1.4, windup: 0.25, block: 3, range: "melee", dmg: "phys", redeploy: 70, deployAnim: 1.0,
      rarity: 4, iconAs: "defender", col: "#a8263a", art: { e0: "sn_e0", card: "sn_card", e2: "sn_e2", card2: "sn_card2" }, guard: 0.2,
      talent: { name: "순애 수호", desc: "상하좌우로 붙어 있는 아군이 받는 피해의 20%를 대신 받는다" },
      skills: [
        { id: "sn_cheer", name: "응원하마", desc: "자신과 주위 8칸 아군의 방어력이 {time}초 동안 {def+%} 오른다", sp: 28, init: 5, mode: "auto", dur: 0, def: 1.3, time: 10, scale: { def: "D" } },
        { id: "sn_smite", name: "순애의 적을 처단하겠다", desc: "{dur}초 동안 저지 +1, 공격력 +{atk+%}. 「순애 수호」로 대신 받는 피해가 40%로 늘어난다", sp: 30, init: 12, mode: "manual", dur: 15, atk: 1.6, scale: { atk: "B" } },
      ] },
    // Kim Eungyeol: the deadpan high-schooler of Gionkirr, the first 지뢰. Nothing swung at him reaches him; whatever he flicks hits like a cannon; there are a great many of him
    { id: "eungyeol", cls: "중장", name: "김은결", nameEn: "Kim Eungyeol", glyph: "결", tile: "g", cost: 30, hp: 4600, atk: 540, def: 640, res: 10, interval: 1.2, windup: 0.3, block: 3, range: "melee", dmg: "phys", redeploy: 80, deployAnim: 0.9,
      rarity: 6, iconAs: "defender", col: "#45454e", art: { e0: "eg_e0", card: "eg_card", e2: "eg_e2", card2: "eg_card2" }, noHeal: true, thorns: 0.6, wardKill: 0.1,
      talent: { name: "서사 왜곡", desc: "적을 처치할 때마다 최대 체력 10%의 {보호막}을 얻는다. 보호막이 남아 있는 동안 자신을 공격한 적에게 공격력 60%의 {마법 피해}를 되돌린다" },
      skills: [
        { id: "eg_insight", name: "절대적 직관", desc: "피격 시 SP 1 회복. 다음 공격이 저지 중인 모든 적에게 공격력 {mul%}의 물리 피해를 준다. 발동부터 그 공격까지 저지 중인 적의 방어력 -30%", sp: 12, init: 4, mode: "auto", spType: "hit", dur: 0, mul: 2.2, scale: { mul: "A" } },
        { id: "eg_under", name: "궁극의 이해", desc: "{dur}초 동안 공격력 +{atk+%}. 「서사 왜곡」으로 되돌리는 피해 {thorns}배, 보호막이 없어도 되돌린다", sp: 35, init: 15, mode: "manual", dur: 20, atk: 1.4, thorns: 2, scale: { atk: "B", thorns: "B" } },
        { id: "eg_gate", name: "수문장", desc: "최대 체력 {ward%}의 {보호막}을 얻는다. {dur}초 동안 자신의 주위 2칸 안에 들어온 일반 지상 적은 그 범위를 벗어나려 하면 안쪽으로 끌려온다", sp: 50, init: 20, mode: "manual", dur: 12, ward: 0.4, scale: { ward: "H" } },
      ] },
    // Teka, the Holy Distorter: a priestess of Seur who bends gravity and light instead of praying with them
    { id: "teka", cls: "보조", name: "테카", nameEn: "Teka", glyph: "테", tile: "h", cost: 12, hp: 1150, atk: 380, def: 90, res: 20, interval: 1.6, windup: 0.3, block: 0, range: "support2", dmg: "arts", slow: 0.25, redeploy: 70, deployAnim: 1.0,
      rarity: 4, iconAs: "supporter", col: "#9a8cff", art: { e0: "tk_e0", card: "tk_card", e2: "tk_e2", card2: "tk_card2" }, splash: { chance: 0.2 },
      talent: { name: "마력을 머금은 지평선", desc: "평타가 20% 확률로 대상 주위 1칸의 적 모두에게 피해를 주고 감속시킨다" },
      skills: [
        { id: "tk_haste", name: "세 수 앞서서", desc: "{dur}초 동안 공격 속도 +{speed+%}", sp: 30, init: 8, mode: "auto", dur: 15, speed: 1.4, scale: { speed: "C" } },
        { id: "tk_field", name: "데우스 엑스 마키나", desc: "{dur}초 동안 공격을 멈추고 사거리 전체에 중력장을 펼친다. 중력장 안의 적은 이동 속도 -{slow%}", sp: 30, init: 10, mode: "manual", dur: 15, slow: 0.65, scale: { slow: "F" } },
      ] },
    // My-Way Capybara: a chubby capybara in shades with a bird on its head, who lobs yuzu over the wall at its own pace
    { id: "capy", cls: "저격", name: "마이웨이 카피바라", nameEn: "My-Way Capybara", glyph: "카", tile: "h", cost: 21, hp: 1300, atk: 560, def: 110, res: 0, interval: 2.6, windup: 0.45, block: 0, range: "lob", dmg: "phys", redeploy: 70, deployAnim: 1.0,
      rarity: 3, iconAs: "sniper", col: "#f2c230", art: { e0: "cb_e0", card: "cb_card" }, lob: { r: 1.0, flight: 0.6 },
      talent: { name: "유자 포격", desc: "대포로 유자를 쏘아 올려, 떨어진 자리 주위 1칸의 적 모두에게 물리 피해를 준다" },
      skills: [
        { id: "cb_wave", name: "마이웨이 행운의 파도", desc: "다음 포격에 유자를 한 바구니째 장전해 공격력 {mul%}, 범위가 주위 1.6칸으로 넓어진다", sp: 10, init: 3, mode: "auto", dur: 0, mul: 1.5, scale: { mul: "A" } },
      ] },
    // the little hero and the little demon lord, bound by a contract neither quite understands — each fights harder with the other near
    { id: "hiro", cls: "근위", name: "히로", nameEn: "Hiro", glyph: "히", tile: "g", cost: 15, hp: 2100, atk: 520, def: 300, res: 0, interval: 1.15, windup: 0.32, block: 2, blockE: { 2: 3 }, cleave: true, range: "melee", dmg: "phys", redeploy: 70, deployAnim: 1.0,
      rarity: 3, iconAs: "guard", col: "#d6e0f0", pair: "lilith", art: { e0: "hr_e0", card: "hr_card" },
      talent: { name: "운명의 서약", desc: "리리스가 배치되어 있으면 공격력 +10%" },
      skills: [
        { id: "hr_brave", name: "순수 용기의 검", desc: "다음 공격이 공격력 {mul%} 물리 피해를 준다", sp: 6, init: 2, mode: "auto", dur: 0, mul: 1.6, scale: { mul: "A" } },
      ] },
    { id: "lilith", cls: "술사", name: "리리스", nameEn: "Lilith", glyph: "리", tile: "h", cost: 16, hp: 1050, atk: 560, def: 70, res: 15, interval: 1.6, windup: 0.3, block: 0, range: "arts", dmg: "arts", redeploy: 70, deployAnim: 1.0,
      rarity: 3, iconAs: "caster", col: "#b05cff", pair: "hiro", art: { e0: "ll_e0", card: "ll_card" },
      talent: { name: "운명의 서약", desc: "히로가 배치되어 있으면 공격력 +10%" },
      skills: [
        { id: "ll_prank", name: "마왕의 장난", desc: "다음 공격이 대상 주위 1칸의 적 모두에게 공격력 {mul%} 마법 피해를 준다", sp: 6, init: 2, mode: "auto", dur: 0, mul: 1.3, scale: { mul: "A" } },
      ] },
    // Ayaki: a perfectly ordinary freshman whose kindness somehow always ends well
    { id: "ayaki", cls: "의무", name: "아야키", nameEn: "Ayaki", glyph: "아", tile: "h", cost: 15, hp: 1100, atk: 380, def: 80, res: 10, interval: 2.4, block: 0, range: "heal", dmg: "heal", redeploy: 70, deployAnim: 1.0,
      rarity: 3, iconAs: "medic", col: "#ffd9e6", happy: 0.2, art: { e0: "ay_e0", card: "ay_card" },
      talent: { name: "해피 엔딩", desc: "체력이 50% 이하인 아군을 치료할 때 치료량 +20%" },
      skills: [
        { id: "ay_eden", name: "결과", desc: "범위 안 모든 아군의 체력을 {cure%} 회복한다", sp: 25, init: 6, mode: "auto", dur: 0, cure: 0.12, scale: { cure: "H" } },
      ] },
    // Nana: a quiet sniper in a black metal suit and a four-lens night-vision helmet, with an anti-materiel rifle
    { id: "nana", cls: "저격", name: "나나", nameEn: "Nana", glyph: "나", tile: "h", cost: 17, hp: 1150, atk: 980, def: 100, res: 0, interval: 2.2, windup: 0.35, block: 0, range: "long", rangeE: { 1: "deadeye" }, dmg: "phys", pierce: 0.2, redeploy: 70, deployAnim: 1.0, lowDefFirst: true,
      rarity: 3, iconAs: "sniper", col: "#7fe0a0", art: { e0: "nn_e0", card: "nn_card" },
      talent: { name: "대물 저격탄", desc: "공격이 대상 방어력의 20%를 무시한다" },
      skills: [
        { id: "nn_focus", name: "야간 투시", desc: "{dur}초 동안 공격력 +{atk+%}", sp: 25, init: 6, mode: "auto", dur: 10, atk: 1.3, scale: { atk: "B" } },
      ] },
    // Tao: a polite young heir of the Spirit Fist, bandaged fists and nothing else
    { id: "tao", cls: "선봉", name: "타오", nameEn: "Tao", glyph: "타", tile: "g", cost: 9, hp: 1500, atk: 380, def: 250, res: 0, interval: 0.9, windup: 0.14, block: 2, range: "melee", dmg: "phys", dodge: 0.15, redeploy: 70, deployAnim: 1.0,
      rarity: 3, iconAs: "vanguard", col: "#4fc6b8", art: { e0: "to_e0", card: "to_card" },
      talent: { name: "정신권", desc: "적의 물리 공격을 15% 확률로 회피한다" },
      skills: [
        { id: "to_breath", name: "정신일도", desc: "즉시 배치 코스트 +{dp}, {dur}초 동안 평타가 잽과 영기 장타의 2연타가 된다", sp: 28, init: 6, mode: "manual", dur: 8, dp: 8 },
      ] },
    // Rabi, saint of the many stars: holy, nature and time in one smiling body — and she fights with her fists and her feet
    { id: "rabi", cls: "근위", name: "라비", nameEn: "Rabi", glyph: "라", tile: "g", cost: 8, hp: 2000, atk: 360, def: 300, res: 15, interval: 0.85, windup: 0.18, double: 0.16, dblMul: 0.5, block: 1, range: "melee", dmg: "phys", redeploy: 70, deployAnim: 1.1, holy: 0.1,
      rarity: 5, iconAs: "guard", col: "#e8dcff", art: { e0: "rb_e0", card: "rb_card", e2: "rb_e2", card2: "rb_card2" },
      talent: { name: "뭇별의 축복", desc: "잽과 돌려차기의 2연타로 싸운다. 한 타격마다 공격력 50%의 물리 피해를 주고, 적중할 때마다 대상에게 공격력 10%의 {신성 손상}을 쌓는다" },
      skills: [
        { id: "rb_star", name: "뭇별님 또 한 놈 갑니다~", desc: "다음 공격이 시간을 가속한 날아차기가 되어 공격력 {mul%} 물리 피해를 주고, 대상을 멀리 날려 보낸다(힘 {force}, 보스에게는 통하지 않음). 벽에 부딪힌 적은 {stun}초 {기절}(무거운 적은 최대 0.5초)", sp: 8, init: 1, mode: "auto", spType: "atk", dur: 0, mul: 1.4, force: 4, stun: 1, scale: { mul: "A", force: "K", stun: "G" } },
        { id: "rb_self", name: "호오 이젠 정당방위랍니다~?", desc: "{dur}초 동안 저지 중인 적의 공격을 {neg%} 확률로 시공간을 비틀어 무효로 하고, 그때마다 드롭킥으로 받아쳐 공격력 {ctr%} 물리 피해와 공격력 {holy%}의 {신성 손상}을 준다", sp: 36, init: 4, mode: "manual", spType: "atk", dur: 15, neg: 0.35, ctr: 1.5, holy: 0.6, scale: { neg: "I", ctr: "A", holy: "A" } },
      ] },
    // Rabi, as the vanguard star: she comes down first, kicks her way through, and every foe she drops pays her back
    { id: "rabi6", cls: "선봉", name: "라비", nameEn: "Rabi", glyph: "라", tile: "g", cost: 11, hp: 2500, atk: 640, def: 380, res: 10, interval: 1.05, windup: 0.3, combo: 0.16, block: 1, range: "melee", dmg: "phys", redeploy: 70, deployAnim: 1.1,
      killCost: 1, fullRefund: true, vanSp: 4, holyAura: 0.2, chibi: "rabi",
      rarity: 6, iconAs: "vanguard", col: "#ffe9b0", art: { e0: "r6_e0", card: "r6_card", e2: "r6_e2", card2: "r6_card2" },
      talent: { name: "뭇별의 선봉", desc: "편성 시 모든 선봉의 초기 SP +4. 자신과 사방 4칸의 아군이 주는 피해의 20%를 {신성 손상}으로 준다" },
      skills: [
        { id: "r6_strike", name: "별빛 강타", desc: "다음 공격이 공격력 {mul%} 물리 피해", sp: 4, init: 1, mode: "auto", spType: "atk", dur: 0, mul: 1.6, scale: { mul: "A" } },
        { id: "r6_twin", name: "또 한 놈 갑니다~", desc: "다음 공격이 2연타가 되고, 각 타격이 공격력 {mul%} 물리 피해", sp: 6, init: 1, mode: "auto", spType: "atk", dur: 0, mul: 1.3, scale: { mul: "A" } },
        { id: "r6_star", name: "그대가 뭇별에 닿기를", desc: "{dur}초 동안 공격력 +{atk+%}, 방어력 +{def+%}. 공격이 3연타가 되는 대신 공격 간격 +{ivMul+%}", sp: 35, init: 10, mode: "manual", dur: 15, atk: 1.3, def: 1.5, ivMul: 1.7, scale: { atk: "B", def: "D" } },
      ] },
    // Falchion, the black-and-white warrior: blind behind a yin-yang mask, he reads the colour of a heart; black cuts erode, white cuts mend
    { id: "falchion", cls: "선봉", name: "팔시온", nameEn: "Falchion", glyph: "팔", tile: "g", cost: 9, hp: 1900, atk: 480, def: 300, res: 0, interval: 1.05, windup: 0.24, block: 1, range: "melee", dmg: "phys", redeploy: 70, deployAnim: 1.0,
      killCost: 1, fullRefund: true, xhit: true, rarity: 4, iconAs: "vanguard", col: "#e6e6e6", art: { e0: "fc_e0", card: "fc_card", e2: "fc_e2", card2: "fc_card2" },
      talent: { name: "흑백의 눈", desc: "공격이 흑과 백으로 번갈아 나간다. 흑의 일격은 피해의 40%를 {침식 손상}으로 주고, 백의 일격은 피해의 20%만큼 자신을 회복한다" },
      skills: [
        { id: "fc_cut", name: "일도양단", desc: "다음 공격이 공격력 {mul%} 물리 피해가 되고, 흑과 백의 효과를 함께 낸다", sp: 4, init: 1, mode: "auto", spType: "atk", dur: 0, mul: 1.8, scale: { mul: "A" } },
        { id: "fc_flip", name: "음양 반전", desc: "{dur}초 동안 공격력 +{atk+%}. 공격이 흑과 백의 2연격이 되고, 흑의 일격은 피해의 {erode%}를 {침식 손상}으로, 백의 일격은 피해의 {cure%}만큼 자신을 회복한다", sp: 22, init: 8, mode: "auto", dur: 12, atk: 1.4, erode: 0.6, cure: 0.3, scale: { atk: "B", erode: "I", cure: "I" } },
      ] },
    // Veil, 『눈 가린 정의』: the blind iaido master of Seur, one-armed under a red cloak; his draw is faster than sight
    { id: "veil", cls: "근위", name: "베일", nameEn: "Veil", glyph: "베", tile: "g", cost: 18, hp: 3100, atk: 760, def: 400, res: 10, interval: 1.5, windup: 0.18, block: 2, range: "lord", lord: 0.8, dmg: "phys", redeploy: 80, deployAnim: 1.0,
      xhit: true, rarity: 6, iconAs: "guard", col: "#d8323a", art: { e0: "vl_e0", card: "vl_card", e2: "vl_e2", card2: "vl_card2" },
      talent: { name: "속죄의 검", desc: "자신이 주는 피해의 15%를 {신성 손상}으로 준다. {성흔} 상태의 적에게 주는 피해 +30%" },
      skills: [
        { id: "vl_draw", name: "발도", desc: "다음 공격이 범위 안의 모든 적을 공격력 {mul%}로 벤다", sp: 5, init: 2, mode: "auto", spType: "atk", dur: 0, mul: 1.6, scale: { mul: "A" } },
        { id: "vl_echo", name: "반향정위", desc: "{dur}초 동안 공격 속도 +{speed+%}. 멀리 있는 적도 공격력 100%로 베고, 한 번에 2명을 벤다", sp: 30, init: 12, mode: "manual", dur: 15, speed: 1.35, scale: { speed: "C" } },
        { id: "vl_light", name: "광속일섬", desc: "칼을 거두고 1초 동안 집중한 뒤(받는 피해 -50%), 범위 안의 모든 적에게 공격력 {mul%}의 발도를 5연속으로 날린다. {성흔} 상태의 적은 성흔이 처음부터 다시 타오른다", sp: 40, init: 18, mode: "manual", dur: 0, mul: 1.5, scale: { mul: "A" } },
      ] },
    // the Sword Immortal: a hermit of the peaks whose swords fly at a thought
    { id: "geomseon", cls: "근위", name: "검선", nameEn: "Sword Immortal", glyph: "검", tile: "g", cost: 17, hp: 2500, atk: 620, def: 330, res: 10, interval: 1.3, windup: 0.2, block: 2, range: "lord", lord: 0.8, dmg: "phys", redeploy: 70, deployAnim: 1.0,
      xhit: true, rarity: 5, iconAs: "guard", col: "#8fd6e8", art: { e0: "gs_e0", card: "gs_card", e2: "gs_e2", card2: "gs_card2" },   // the old hermit; young again (반로환동) at the final promotion
      talent: { name: "어검술", desc: "비행 적에게 주는 피해 +50%" },
      skills: [
        { id: "gs_one", name: "일검", desc: "다음 공격이 공격력 {mul%} 물리 피해. 거리에 상관없이 온전한 위력으로 벤다", sp: 4, init: 1, mode: "auto", spType: "atk", dur: 0, mul: 2, scale: { mul: "A" } },
        { id: "gs_rain", name: "만검귀종", desc: "비검 8자루를 범위 안의 적들에게 차례로 내리꽂는다. 한 자루마다 공격력 {mul%} 물리 피해", sp: 26, init: 10, mode: "manual", dur: 0, mul: 1.2, scale: { mul: "A" } },
      ] },
    // Angelina Celeste, the Spirit Mage of Harvan: second daughter of a fallen house of mages; nature and holy magic, the 방호학파 of warding spells
    { id: "angelina", cls: "의무", name: "안젤리나", nameEn: "Angelina", glyph: "안", tile: "h", cost: 16, hp: 1600, atk: 430, def: 130, res: 20, interval: 2.85, block: 0, range: "support2", dmg: "heal", redeploy: 70, deployAnim: 1.0, multiHeal: 3,
      rarity: 6, iconAs: "medic", col: "#8ab8ff", art: { e0: "an_e0", card: "an_card", e2: "an_e2", card2: "an_card2" },
      talents: [
        { name: "세계수의 숨결", desc: "아군 최대 3명을 동시에 치료한다. 치료할 아군이 없으면 범위 안의 적 1명에게 공격력 60%의 {마법 피해}를 준다. 최근 8초 안에 아군이 적을 {성흔} 상태로 만들었다면 치료량 +35%", elite: 0 },
        { name: "방호학파", desc: "치료하고 넘친 만큼을 {보호막}으로 바꾼다 (대상 최대 체력의 20%까지)", elite: 2 },
      ],
      skills: [
        { id: "an_vine", name: "나무 덩굴 속박", desc: "범위 안의 지상 적 최대 {n}명을 덩굴로 {bind}초간 {속박}하고 공격력 {mul%}의 {마법 피해}를 준다", sp: 16, init: 8, mode: "auto", dur: 0, mul: 1.2, bind: 3, n: 2, scale: { mul: "A", bind: "G", n: "N" } },
        { id: "an_grove", name: "세계수의 가호", desc: "{dur}초 동안 공격력 +{atk+%}, 치료 대상 +2명, 범위 안의 아군이 매초 최대 체력의 {regen%}를 회복한다", sp: 40, init: 15, mode: "auto", dur: 20, atk: 1.2, regen: 0.01, scale: { atk: "B", regen: "H" } },
        { id: "an_save", name: "빛과 자연의 권능: 구원", desc: "{dur}초 동안 공격 범위 확대, 범위 안의 아군 전원을 매초 공격력 {cure%}만큼 계속 치료하고, 넘친 치료량은 모두 {보호막}이 된다 (최대 체력의 {ward%}까지). 발동 시와 5초마다 범위 안의 적을 밀쳐낸다(힘 {force})", sp: 60, init: 25, mode: "manual", dur: 20, cure: 0.35, ward: 0.4, force: 3, scale: { cure: "E", ward: "H", force: "K" } },
      ] },
    // Pianía: the avatar of an ancient healing goddess, who speaks only through the piano under the world tree
    { id: "piania", cls: "의무", name: "피아니아", nameEn: "Pianía", glyph: "피", tile: "h", cost: 15, hp: 1500, atk: 400, def: 120, res: 15, interval: 2.85, block: 0, range: "support2", dmg: "heal", redeploy: 70, deployAnim: 1.0, regenAura: 0.01, multiHeal: 3,
      rarity: 5, iconAs: "medic", col: "#ffb070", art: { e0: "pn_e0", card: "pn_card", e2: "pn_e2", card2: "pn_card2" },
      talent: { name: "평화의 선율", desc: "아군 최대 3명을 동시에 치료한다. 범위 안의 아군은 매초 최대 체력의 1%를 회복한다" },
      skills: [
        { id: "pn_root", name: "근원의 울림", desc: "다음 치료가 범위 안의 아군 전원에게 공격력의 {chord%}만큼 적용된다", sp: 8, init: 4, mode: "auto", dur: 0, chord: 1, scale: { chord: "E" } },
        { id: "pn_eternal", name: "영원한 평화의 멜로디", desc: "{dur}초 동안 공격 속도 +{speed+%}, 대신 한 번의 치료량 -{healMul-%}", sp: 35, init: 18, mode: "manual", dur: 20, speed: 3, healMul: 0.55, scale: { speed: "C" } },
      ] },
    // Silphy, the baby succubus: the holy city drained every bit of her magic into plain good luck, and now she is its mascot guide
    { id: "silphy", cls: "보조", name: "실피", nameEn: "Silphy", glyph: "실", tile: "h", cost: 10, hp: 1200, atk: 450, def: 100, res: 20, interval: 1.6, windup: 0.3, block: 0, range: "support", rangeE: { 1: "support2" }, dmg: "arts", slow: 0.3, redeploy: 70, deployAnim: 1.0, gateBind: { dur: 0.6, cd: 5 },
      rarity: 5, iconAs: "supporter", col: "#8a4fd8", art: { e0: "sl_e0", card: "sl_card", e2: "sl_e2", card2: "sl_card2" },
      talent: { name: "시공간 게이트", desc: "공격하면 대상의 발밑에 게이트가 열려 촉수가 0.6초 동안 묶는다 (같은 적은 5초에 한 번)" },
      skills: [
        { id: "sl_nyala", name: "텐타클 - 나이알라", desc: "다음 공격이 대상 주위 1칸의 적 모두를 덩굴 촉수로 {bind}초 동안 묶고 공격력 {mul%} 마법 피해. 묶인 적이 피해를 받으면 최면액이 터져 3초 동안 공격력 -{weak%}", sp: 12, init: 3, mode: "auto", dur: 0, mul: 1.6, bind: 0.6, weak: 0.3, scale: { mul: "A", bind: "G", weak: "P" } },
        { id: "sl_astra", name: "텐타클 - 아스트라", desc: "{dur}초 동안 공격 속도가 느려지는 대신 공격 범위가 넓어진다. 공격할 때마다 범위 안에서 수비 지점에 가장 가까운 적부터 가장 먼 적까지 이은 선을 따라 신성 촉수가 차례로 내리찍어, 닿은 적 모두에게 공격력 {mul%} 마법 피해를 주고 {stun}초 동안 기절시킨다", sp: 35, init: 15, mode: "manual", dur: 15, mul: 1.3, stun: 0.5, scale: { mul: "A", stun: "G" } },
      ] },
    // Smoqueen (Elzbeta Radvina): president of the Witches' Association, a recluse with a frail body and a hawk's eyes; she fights with nothing but the smoke from her pipe
    { id: "smoqueen", cls: "보조", name: "스모퀸", nameEn: "Smoqueen", glyph: "퀸", tile: "h", cost: 11, hp: 1350, atk: 520, def: 110, res: 25, interval: 1.6, windup: 0.3, block: 0, range: "support", rangeE: { 1: "support2" }, dmg: "arts", redeploy: 70, deployAnim: 1.0,
      rarity: 6, iconAs: "supporter", col: "#6a5a8a", art: { e0: "sq_e0", card: "sq_card", e2: "sq_e2", card2: "sq_card2" }, sleepFirst: true, sleepEvery: 4, sleepDur: 1.2,
      talents: [
        { name: "연기 마법", desc: "공격한 피해의 40%만큼 {침식 손상}을 쌓는다. 네 번째 공격마다 대상을 1.2초 동안 {졸음} 상태로 만든다", elite: 0 },
        { name: "깊은 잠", desc: "{졸음} 상태의 적에게 쌓는 {침식 손상}이 2배가 된다", elite: 2 },
      ],
      skills: [
        { id: "sq_puff", name: "담배 타임", desc: "{dur}초 동안 공격 속도 +{speed+%}", sp: 35, init: 10, mode: "auto", dur: 20, speed: 1.4, scale: { speed: "C" } },
        { id: "sq_screen", name: "연막", desc: "{dur}초 동안 공격하지 않는다. 공격 범위 안의 아군이 공격받으면 받은 피해의 {erode%}만큼 공격한 적에게 {침식 손상}을 쌓는다", sp: 25, init: 10, mode: "auto", dur: 15, erode: 1, scale: { erode: "A" } },
        { id: "sq_star", name: "죽음의 성좌", desc: "{탄약} 12발. 공격 범위 확대, 공격 속도 +{speed+%}, 공격 대상 3명. 공격마다 대상 하나에 재 덩어리 4개를 연달아 떨어뜨리고, 하나하나가 공격력 {per%}의 {마법 피해}를 준다. 스킬이 끝날 때까지 공격 범위 안 적의 {졸음}이 풀리지 않는다(보스는 최대 3초). 스킬이 끝나면(다시 눌러 끝낼 수 있음) 잠든 적에게 공격력 {wake%}의 {마법 피해}를 주고 깨운다", sp: 40, init: 20, mode: "manual", dur: 12, ammo: true, cancel: true, speed: 1.6, per: 0.2, wake: 1.8, scale: { speed: "C", per: "A", wake: "A" } },
      ] },
    // Park Bong-eun, team leader of the Time Management Bureau's collection team: polite, expressionless, and here to take back the time you didn't need
    { id: "bongeun", cls: "저격", name: "박봉은", nameEn: "Park Bong-eun", glyph: "봉", tile: "h", cost: 11, hp: 1550, atk: 330, def: 140, res: 0, interval: 0.55, windup: 0.1, block: 0, range: "long", dmg: "phys", redeploy: 70, deployAnim: 1.45, airFirst: true,
      ghost: { per: 0.25, max: 2, every: 3, cap: 10 },
      rarity: 5, iconAs: "sniper", col: "#3fd8e8", art: { e0: "bo_e0", card: "bo_card", e2: "bo_e2", card2: "bo_card2" },
      talent: { name: "과거의 잔영", desc: "공격할 때마다 과거의 자신이 잔영으로 나타나 공격력 25%의 추가 사격을 한다. 끊지 않고 3번 공격할 때마다 잔영이 1명 늘어난다(최대 2명)" },
      skills: [
        { id: "bo_rush", name: "진짜 졸라짱짱쎈 콤보", desc: "공격 시 SP 1 회복. 자동 발동: 다음 3번의 공격이 콤보가 된다. 스타터 공격력 {m1%}, 두번째 {m2%}에 잔영 전원 일제 사격, 막타 {m3%}에 대상의 시간을 {stop}초 멈춘다(보스는 {stop*0.5}초)", sp: 8, init: 3, mode: "auto", spType: "atk", dur: 0, m1: 1.2, m2: 1.5, m3: 2.4, stop: 1, scale: { m1: "A", m2: "A", m3: "A", stop: "G" } },
        { id: "bo_armory", name: "마검 '봉★평'", desc: "지금까지 나타난 잔영의 수만큼(최소 3, 최대 10) 등 뒤에 포탈이 열리고, 과거의 무구가 범위 안의 적에게 내리꽂혀 폭발한다. 하나마다 공격력 {mul%} 물리 피해, 주위 1칸에 공격력 {splash%}", sp: 30, init: 12, mode: "manual", dur: 0, mul: 1, splash: 0.4, scale: { mul: "A", splash: "A" } },
      ] },
    // Alpha, as the duelist: the same iron-masked boy, all parries and short blades, in and out of the line before anyone can pin him
    { id: "alpha2", cls: "특수", name: "알파", nameEn: "Alpha", glyph: "알", tile: "g", cost: 7, hp: 1800, atk: 400, def: 260, res: 0, interval: 1.05, windup: 0.2, double: 0.16, block: 1, range: "melee", dmg: "phys", redeploy: 18, deployAnim: 1.0, parry: 0.2, dblFx: true,
      rarity: 5, iconAs: "specialist", col: "#ff8a3a", art: { e0: "a2_e0", card: "a2_card", e2: "a2_e2", card2: "a2_card2" },
      talent: { name: "+PARRY", desc: "저지 중인 적의 공격을 20% 확률로 받아넘기고, 즉시 공격력 150% 물리 피해로 반격한다. 기본 공격은 마체테와 단검의 2연격(피해는 한 번)" },
      skills: [
        { id: "a2_all", name: "다 들어와!", desc: "배치 직후 자동 발동. {dur}초 동안 공격력 +{atk+%}, 공격 속도 +{speed+%}", sp: 40, init: 40, mode: "auto", dur: 10, onDeploy: true, atk: 1.4, speed: 1.2, scale: { atk: "B", speed: "C" } },
        { id: "a2_chain", name: "비살상 제압", desc: "배치 후 주위 1칸에 적이 있으면 자동 발동. 그 적들을 사슬로 묶어 가장 가까운 벽 쪽으로 약하게 밀어내고(힘 {force}) 공격력 {mul%} 물리 피해. 벽에 부딪힌 적은 {stun}초 기절", sp: 40, init: 40, mode: "auto", dur: 0, onDeploy: true, mul: 1, force: 2, stun: 2, scale: { mul: "A", force: "K", stun: "G" } },
      ] },
    // Skakea, as the tactician: the spacetime chess piece her mother left her turns the field ahead into a board where every move is hers
    { id: "skakea2", cls: "술사", name: "스카케아", nameEn: "Skakea", glyph: "스", tile: "h", cost: 18, hp: 1250, atk: 610, def: 90, res: 20, interval: 1.6, windup: 0.3, block: 0, range: "arts", dmg: "arts", redeploy: 70, deployAnim: 1.0, splashArts: 0.3,
      rarity: 5, iconAs: "caster", col: "#cfe0ff", art: { e0: "k2_e0", card: "k2_card", e2: "k2_e2", card2: "k2_card2" },
      talent: { name: "어머니의 별빛 유산", desc: "공격이 대상 주위 1칸의 적에게도 공격력 30%의 마법 피해를 준다" },
      skills: [
        { id: "k2_place", name: "전략적 기물 배치", desc: "다음 공격이 대상 위로 룩을 떨어뜨려 공격력 {mul%} 마법 피해를 주고 {stun}초 동안 {기절}시킨다", sp: 9, init: 2, mode: "auto", dur: 0, mul: 2.2, stun: 0.6, scale: { mul: "A", stun: "G" } },
        { id: "k2_fate", name: "운명의 수순", desc: "발동 순간 공격 범위 안의 적(보스 제외)을 체스 말처럼 재배치해 체력이 낮은 적일수록 앞자리에 세우고, 옮겨진 적에게 공격력 {mul%} 마법 피해와 {stun}초 {기절}. 이어서 {dur}초 동안 자신 앞 3칸(폭 3칸)의 바닥이 체스판이 되어 그 위의 적은 이동 속도 -{maze.slow%}, 매초 공격력 {maze.dot%} 마법 피해", sp: 35, init: 15, mode: "manual", dur: 15, maze: { slow: 0.45, dot: 0.6, hiki: 0 }, mul: 1.2, stun: 0.6, scale: { mul: "A", stun: "G", "maze.slow": "F", "maze.dot": "A" } },
      ] },
    // the Brick: an ordinary old red clay brick. it does not move. it does not break. now and then it hops onto a foe's foot
    { id: "brick", cls: "중장", name: "벽돌", nameEn: "Brick", glyph: "벽", tile: "g", cost: 16, hp: 3000, atk: 300, def: 680, res: 0, interval: 1.4, windup: 0.4, block: 3, range: "self", dmg: "phys", redeploy: 70, deployAnim: 1.0,
      rarity: 3, iconAs: "defender", col: "#c0523a", lowDef: 0.2, art: { e0: "bk_e0", card: "bk_card" },
      talent: { name: "꺾이지 않는 의지", desc: "체력이 50% 이하일 때 방어력 +20%" },
      skills: [
        { id: "bk_just", name: "그냥 벽돌", desc: "{dur}초 동안 공격하지 않고 방어력 +{def+%}", sp: 35, init: 12, mode: "manual", dur: 12, def: 1.8, scale: { def: "D" } },
      ] },
    // Jayeon the magician: a stern little mage with an orb-tipped staff, proving the old magic one spell at a time
    { id: "jayeon", cls: "보조", name: "자연", nameEn: "Jayeon", glyph: "자", tile: "h", cost: 10, hp: 1100, atk: 360, def: 90, res: 20, interval: 1.6, windup: 0.3, block: 0, range: "support", rangeE: { 1: "support2" }, dmg: "arts", slow: 0.8, slowDur: 0.8, redeploy: 70, deployAnim: 1.0,
      rarity: 3, iconAs: "supporter", col: "#ff8fc8", spLuck: 0.1, art: { e0: "jy_e0", card: "jy_card" },
      talent: { name: "마력 순환", desc: "공격할 때 10% 확률로 스킬 포인트 +1" },
      skills: [
        { id: "jy_proof", name: "고대 마법 증명", desc: "다음 공격이 대상 주위 1칸의 적 모두에게 공격력 {mul%} 마법 피해를 주고, {slowT}초 동안 이동 속도 -{slow%}", sp: 10, init: 3, mode: "auto", dur: 0, mul: 1.5, slow: 0.4, slowT: 2, scale: { mul: "A", slow: "F", slowT: "G" } },
      ] },
  ];
  // summons: drawn by an operator, not dealt from the deck
  const SUMMONS = {
    scribble: { id: "scribble", cls: "소환물", name: "낙서", glyph: "낙", tile: "g", cost: 3, hp: 950, atk: 300, def: 150, res: 0, interval: 1.2, block: 1, range: "melee", dmg: "phys", redeploy: 8, paper: true, iconAs: "guard", col: "#f0c040",
      skills: [{ id: "none", name: "-", desc: "", sp: 999, init: 0, mode: "auto", dur: 0 }], talent: { name: "종이 인형", desc: "척탄병에게 받는 피해 +50%" } },
  };
  const TALENTS = {
    vanguard: ["전장 감각", "배치 후 10초 안에 처치하면 코스트 +1"], guard: ["돌파", "체력 50% 이하의 적에게 공격력 +15%"],
    defender: ["불굴", "체력 50% 이하일 때 방어력 +20%"], sniper: ["대공 사격", "공중 유닛에게 공격력 +40%"],
    caster: ["공명", "마법 피해가 적의 마법 저항 10을 무시"], medic: ["응급 의료", "체력 30% 이하 아군 치유량 +30%"],
    supporter: ["중력 계측", "감속 지속 시간 +0.5초"], specialist: ["재정비", "재배치 시간 -4초"],
  };
  // every operator is a partial persona of someone: only the face that fits the role is called up.
  // the alias is what shows; the true name surfaces only at the final promotion (E2; E1 for three-stars)
  const ALIAS = { angelina: "세라프", smoqueen: "스모크", eungyeol: "지뢰", skakea2: "체크메이트", alpha2: "패리", bongeun: "리클레임", silphy: "어비스", piania: "레퀴엠", rabi: "스타라이트", rabi6: "스타폴", falchion: "모노크롬", veil: "에코", geomseon: "스카이블레이드", brick: "코너스톤", jayeon: "아케인", nana: "나이트비전", tao: "스피릿 피스트", hiro: "리틀 브레이브", lilith: "리틀 데몬", ayaki: "해피엔딩", capy: "시트러스", teka: "이벤트 호라이즌", sunae: "퓨어하트", ker: "그로브", skakea: "나이트", irins: "라비린스", alpha: "하이어", yui: "서브테러", atat: "페이퍼 차일드", belina: "랠리", hakuren: "플로우", miho: "선샤워", lulu: "플레이트", vanguard: "플래그", guard: "블레이드", defender: "월",
    sniper: "스코프", caster: "스파크", medic: "밴디지", supporter: "그래비티", specialist: "훅" };
  const revealAt = (d) => d.rarity <= 3 ? 1 : 2;
  // { main, sub, full, revealed } for a given promotion
  // the small line over a true name once it surfaces: what the world called them
  const KEEP_SUB = {};   // who still wears "더 <codename>" after the true name
  const ALWAYS_RUBY = { yui: "가사인격체 — 범용" };
  const TRUE_RUBY = { hiro: "작은 용사님과 마왕님", lilith: "작은 용사님과 마왕님", sunae: "백령", teka: "신성한 왜곡자" };
  function nameOf(d, elite) {
    if (d.noTrueName) return { main: d.name, sub: "", full: d.name, revealed: true, ruby: ALWAYS_RUBY[d.id] || "" };   // no true name to reveal
    const alias = d.alias || ALIAS[d.id] || d.name;
    const revealed = elite === undefined || elite >= revealAt(d);
    if (ALWAYS_RUBY[d.id]) return { main: revealed ? d.name : alias, sub: "", full: revealed ? d.name : alias, revealed, ruby: ALWAYS_RUBY[d.id] };   // the guide agent is what it is from the start
    // once the true name is back it stands alone; the codename is not tacked on after it (only those given a line of their own keep one)
    return revealed ? { main: d.name, sub: KEEP_SUB[d.id] ? "더 " + alias : "", full: d.name, revealed, ruby: d.ruby || "" } : { main: alias, sub: "", full: alias, revealed };
  }
  for (const u of UNITS) {
    if (!u.skills) u.skills = [u.skill];
    if (!u.talent && !u.talents) u.talent = { name: TALENTS[u.id][0], desc: TALENTS[u.id][1] };
    if (!u.rarity) u.rarity = u.id === "yui" ? 5 : 3;   // Yui is the starting operator; the stock squad are three-star dummies
    if (!u.alias) u.alias = ALIAS[u.id];
    if (!u.ruby && TRUE_RUBY[u.id]) u.ruby = TRUE_RUBY[u.id];

  }
  // ---------- numbers after the original ----------
  // each operator stands in for one of the original's of the same branch and rarity, and takes that one's numbers:
  // health, attack and defence at every promotion's first and last level (kf), resistance, and the potential bonuses.
  // where an operator swings at its own pace, its attack is scaled so the damage per second matches the stand-in;
  // a pace far from the stand-in's (more than ~40% off) gives way to the stand-in's own
  const AKSTAT = {"vanguard":{"ak":"Fang","kf":{"hp":[[742,1060],[1060,1325]],"atk":[[157,235],[235,325]],"def":[[130,187],[187,260]]},"res":0.0,"int":1.05,"p4":["def",20.0],"p5":["rd",-6.0]},"guard":{"ak":"Midnight","kf":{"hp":[[879,1256],[1256,1653]],"atk":[[252,372],[372,497]],"def":[[162,222],[222,282]]},"res":10.0,"int":1.3,"p4":["atk",22.0],"p5":null},"defender":{"ak":"Beagle","kf":{"hp":[[1144,1526],[1526,2035]],"atk":[[184,236],[236,295]],"def":[[242,362],[362,490]]},"res":0.0,"int":1.2,"p4":["def",28.0],"p5":["rd",-6.0]},"sniper":{"ak":"Kroos","kf":{"hp":[[545,826],[826,1060]],"atk":[[154,258],[258,375]],"def":[[52,88],[88,126]]},"res":0.0,"int":1.0,"p4":["atk",21.0],"p5":null},"caster":{"ak":"Steward","kf":{"hp":[[592,847],[847,1100]],"atk":[[249,357],[357,470]],"def":[[38,65],[65,90]]},"res":15.0,"int":1.6,"p4":["atk",23.0],"p5":["rd",-6.0]},"medic":{"ak":"Ansel","kf":{"hp":[[634,907],[907,1135]],"atk":[[156,257],[257,362]],"def":[[60,81],[81,109]]},"res":0.0,"int":2.85,"p4":["atk",20.0],"p5":null},"supporter":{"ak":"Orchid","kf":{"hp":[[553,738],[738,935]],"atk":[[192,283],[283,378]],"def":[[44,64],[64,83]]},"res":15.0,"int":1.9,"p4":["atk",19.0],"p5":["rd",-6.0]},"specialist":{"ak":"Gravel","kf":{"hp":[[663,885],[885,1107],[1107,1420]],"atk":[[176,256],[256,352],[352,452]],"def":[[151,216],[216,281],[281,335]]},"res":0.0,"int":0.93,"p4":["rd",-2.0],"p5":null},"yui":{"ak":"Nearl","kf":{"hp":[[1154,1560],[1560,2001],[2001,2780]],"atk":[[191,273],[273,369],[369,462]],"def":[[240,353],[353,471],[471,575]]},"res":10.0,"int":1.2,"p4":["def",25.0],"p5":null},"atat":{"ak":"Deepcolor","kf":{"hp":[[472,638],[638,829],[829,1050]],"atk":[[181,259],[259,346],[346,403]],"def":[[53,77],[77,103],[103,125]]},"res":15.0,"int":1.6,"p4":["aspd",8.0],"p5":["rd",-6.0]},"belina":{"ak":"Texas","kf":{"hp":[[727,996],[996,1365],[1365,1950]],"atk":[[203,299],[299,410],[410,500]],"def":[[139,208],[208,274],[274,343]]},"res":0.0,"int":1.05,"p4":["atk",24.0],"p5":["rd",-6.0]},"hakuren":{"ak":"Myrtle","kf":{"hp":[[658,902],[902,1142],[1142,1565]],"atk":[[231,331],[331,436],[436,520]],"def":[[138,193],[193,255],[255,300]]},"res":0.0,"int":1.3,"p4":["def",22.0],"p5":null},"miho":{"ak":"Gavial","kf":{"hp":[[851,1167],[1167,1374],[1374,1580]],"atk":[[159,262],[262,364],[364,450]],"def":[[66,96],[96,121],[121,152]]},"res":0.0,"int":2.85,"p4":["atk",23.0],"p5":null},"lulu":{"ak":"Cutter","kf":{"hp":[[990,1357],[1357,1763],[1763,2320]],"atk":[[233,338],[338,439],[439,571]],"def":[[142,204],[204,266],[266,325]]},"res":0.0,"int":1.3,"p4":["atk",21.0],"p5":null},"irins":{"ak":"Haze","kf":{"hp":[[619,885],[885,1150],[1150,1420]],"atk":[[253,362],[362,483],[483,583]],"def":[[42,71],[71,98],[98,110]]},"res":20.0,"int":1.6,"p4":["hp",100.0],"p5":null},"alpha":{"ak":"Jessica","kf":{"hp":[[604,864],[864,1108],[1108,1320]],"atk":[[163,272],[272,389],[389,475]],"def":[[54,91],[91,130],[130,154]]},"res":0.0,"int":1.0,"p4":["atk",24.0],"p5":["rd",-6.0]},"skakea":{"ak":"Shaw","kf":{"hp":[[824,1099],[1099,1392],[1392,1785]],"atk":[[252,351],[351,469],[469,580]],"def":[[151,229],[229,302],[302,365]]},"res":0.0,"int":1.2,"p4":["hp",140.0],"p5":["rd",-6.0]},"ker":{"ak":"Cuora","kf":{"hp":[[1221,1629],[1629,2173],[2173,3105]],"atk":[[193,248],[248,310],[310,365]],"def":[[249,372],[372,503],[503,690]]},"res":0.0,"int":1.2,"p4":["def",27.0],"p5":["rd",-6.0]},"sunae":{"ak":"Cuora","kf":{"hp":[[1221,1629],[1629,2173],[2173,3105]],"atk":[[193,248],[248,310],[310,365]],"def":[[249,372],[372,503],[503,690]]},"res":0.0,"int":1.2,"p4":["def",27.0],"p5":["rd",-6.0]},"eungyeol":{"ak":"Mudrock","kf":{"hp":[[1677,2207],[2207,2867],[2867,3928]],"atk":[[370,515],[515,687],[687,882]],"def":[[229,347],[347,463],[463,602]]},"res":10.0,"int":1.6,"p4":["def",29.0],"p5":null},"teka":{"ak":"Podenco","kf":{"hp":[[528,724],[724,930],[930,1163]],"atk":[[208,306],[306,408],[408,492]],"def":[[43,62],[62,80],[80,96]]},"res":20.0,"int":1.9,"p4":["atk",21.0],"p5":null},"capy":{"ak":"Catapult","kf":{"hp":[[736,920],[920,1150]],"atk":[[340,487],[487,617]],"def":[[51,67],[67,85]]},"res":0.0,"int":2.8,"p4":["atk",27.0],"p5":["rd",-6.0]},"hiro":{"ak":"Popukar","kf":{"hp":[[1130,1449],[1449,1858]],"atk":[[263,366],[366,495]],"def":[[126,181],[181,245]]},"res":0.0,"int":1.2,"p4":["atk",23.0],"p5":null},"lilith":{"ak":"Steward","kf":{"hp":[[592,847],[847,1100]],"atk":[[249,357],[357,470]],"def":[[38,65],[65,90]]},"res":15.0,"int":1.6,"p4":["atk",23.0],"p5":["rd",-6.0]},"ayaki":{"ak":"Ansel","kf":{"hp":[[634,907],[907,1135]],"atk":[[156,257],[257,362]],"def":[[60,81],[81,109]]},"res":0.0,"int":2.85,"p4":["atk",20.0],"p5":null},"nana":{"ak":"Ambriel","kf":{"hp":[[785,1020],[1020,1276],[1276,1595]],"atk":[[437,608],[608,801],[801,977]],"def":[[60,80],[80,100],[100,122]]},"res":0.0,"int":2.7,"p4":["aspd",6.0],"p5":null},"tao":{"ak":"Fang","kf":{"hp":[[742,1060],[1060,1325]],"atk":[[157,235],[235,325]],"def":[[130,187],[187,260]]},"res":0.0,"int":1.05,"p4":["def",20.0],"p5":["rd",-6.0]},"rabi":{"ak":"Indra","kf":{"hp":[[1213,1640],[1640,2103],[2103,2565]],"atk":[[218,321],[321,429],[429,530]],"def":[[151,217],[217,294],[294,350]]},"res":0.0,"int":0.78,"p4":["atk",23.0],"p5":null},"rabi6":{"ak":"Bagpipe","kf":{"hp":[[975,1355],[1355,1738],[1738,2484]],"atk":[[250,369],[369,492],[492,586]],"def":[[173,241],[241,313],[313,382]]},"res":0.0,"int":1.0,"p4":["atk",25.0],"p5":null},"falchion":{"ak":"Vigna","kf":{"hp":[[724,1006],[1006,1291],[1291,1845]],"atk":[[248,355],[355,468],[468,558]],"def":[[152,218],[218,287],[287,351]]},"res":0.0,"int":1.0,"p4":["atk",24.0],"p5":null},"veil":{"ak":"SilverAsh","kf":{"hp":[[1075,1536],[1536,2022],[2022,2560]],"atk":[[297,444],[444,577],[577,713]],"def":[[189,259],[259,329],[329,397]]},"res":10.0,"int":1.3,"p4":["atk",26.0],"p5":null},"geomseon":{"ak":"Lappland","kf":{"hp":[[987,1410],[1410,1856],[1856,2350]],"atk":[[285,426],[426,554],[554,685]],"def":[[173,238],[238,302],[302,365]]},"res":15.0,"int":1.3,"p4":["atk",25.0],"p5":null},"angelina":{"ak":"Nightingale","kf":{"hp":[[796,1076],[1076,1346],[1346,1705]],"atk":[[132,210],[210,280],[280,350]],"def":[[80,107],[107,140],[140,169]]},"res":5.0,"int":2.85,"p4":["res",10.0],"p5":null},"piania":{"ak":"Ptilopsis","kf":{"hp":[[751,1016],[1016,1271],[1271,1610]],"atk":[[122,198],[198,268],[268,335]],"def":[[71,95],[95,124],[124,150]]},"res":0.0,"int":2.85,"p4":["atk",21.0],"p5":["rd",-6.0]},"silphy":{"ak":"Shamare","kf":{"hp":[[677,996],[996,1347],[1347,1728]],"atk":[[184,263],[263,338],[338,408]],"def":[[48,70],[70,92],[92,105]]},"res":25.0,"int":1.6,"p4":["res",8.0],"p5":null},"smoqueen":{"ak":"Gnosis","kf":{"hp":[[798,1174],[1174,1587],[1587,2035]],"atk":[[205,294],[294,377],[377,455]],"def":[[61,88],[88,116],[116,132]]},"res":25.0,"int":1.6,"p4":["atk",33.0],"p5":null},"bongeun":{"ak":"Kroos the Keen Glint","kf":{"hp":[[679,971],[971,1246],[1246,1520]],"atk":[[169,283],[283,411],[411,502]],"def":[[61,103],[103,148],[148,176]]},"res":0,"int":1.0,"p4":null,"p5":null,"fast":0.4},"alpha2":{"ak":"Projekt Red","kf":{"hp":[[703,938],[938,1173],[1173,1505]],"atk":[[204,301],[301,413],[413,530]],"def":[[135,194],[194,253],[253,302]]},"res":0.0,"int":0.93,"p4":["rd",-2.0],"p5":null},"skakea2":{"ak":"Amiya","kf":{"hp":[[699,958],[958,1198],[1198,1480]],"atk":[[276,390],[390,514],[514,612]],"def":[[48,81],[81,110],[110,121]]},"res":20.0,"int":1.6,"p4":["atk",30.0],"p5":["cost",-1.0]},"brick":{"ak":"Beagle","kf":{"hp":[[1144,1526],[1526,2035]],"atk":[[184,236],[236,295]],"def":[[242,362],[362,490]]},"res":0.0,"int":1.2,"p4":["def",28.0],"p5":["rd",-6.0]},"jayeon":{"ak":"Orchid","kf":{"hp":[[553,738],[738,935]],"atk":[[192,283],[283,378]],"def":[[44,64],[64,83]]},"res":15.0,"int":1.9,"p4":["atk",19.0],"p5":["rd",-6.0]}};
  for (const d of UNITS) {
    const a = AKSTAT[d.id]; if (!a) continue;
    const phases = (d.rarity || 3) <= 3 ? 2 : 3;
    let r = d.interval / a.int;
    if (a.fast) r = Math.pow(r, a.fast);   // a quick shooter by nature keeps its pace and gives up less attack, as the original's fast guards do (Fighters: 0.6x the pace, ~0.82x the attack)
    else if (r < 0.7 || r > 1.4) { d.interval = a.int; d.windup = Math.min(d.windup || 0.3, a.int * 0.4); r = 1; }
    const kf = { hp: a.kf.hp.slice(0, phases), atk: a.kf.atk.slice(0, phases).map((p) => p.map((v) => d.atk === 0 ? 0 : Math.round(v * r))), def: a.kf.def.slice(0, phases) };
    d.kf = kf; d.ak = a.ak; d.akPot = [a.p4, a.p5];
    d.hp = kf.hp[phases - 1][1]; d.atk = kf.atk[phases - 1][1]; d.def = kf.def[phases - 1][1]; d.res = a.res;
  }
  // growth: where each number stands at a promotion and level, as a share of the final number (straight lines inside a promotion)
  function growth(d, elite, lvl, maxLv) {
    const out = {};
    for (const k of ["hp", "atk", "def"]) {
      if (!d.kf) { out[k] = 1; continue; }
      const p = d.kf[k][Math.min(elite, d.kf[k].length - 1)], last = d.kf[k][d.kf[k].length - 1][1];
      const v = p[0] + (p[1] - p[0]) * (lvl - 1) / Math.max(1, maxLv - 1);
      out[k] = last ? v / last : 1;
    }
    return out;
  }
  const mOf = (m, k) => (m && typeof m === "object") ? (m[k] || 1) : (m || 1);
  // the "around" area used by the new operator's skills: her tile plus the 8 neighbours
  const near = (a, b) => Math.max(Math.abs(Math.round(a.x) - Math.round(b.x)), Math.abs(Math.round(a.y) - Math.round(b.y))) <= 1;

  const ENEMIES = {
    soldier: { name: "전열 보병", info: ["총검을 꽂고 같은 걸음으로 행군하는 망령 병사.", "막는 자가 없으면 방어 포인트까지 걸어온다."], hp: 1650, atk: 200, def: 100, res: 0, speed: 0.85, interval: 2.0, weight: 1, mass: 2, life: 1 },
    // the stragglers: frozen ghosts left behind on the retreat from Moscow — slow, frail, and never alone (an Originium Slug's place)
    strag:   { name: "낙오병", info: ["모스크바 퇴각 행렬에서 얼어 죽은 낙오병. 느리고 약하다.", "하지만 끝없이 몰려온다. 여럿을 함께 쓸어 내자."], hp: 700, atk: 130, def: 0, res: 0, speed: 0.42, interval: 2.0, weight: 0, mass: 1, life: 1 },
    dog:     { name: "사냥개", info: ["대열보다 먼저 풀려나 빠르게 달려드는 사냥개.", "약하지만 빠르다. 길목을 먼저 막아 두자."], hp: 820, atk: 190, def: 0, res: 20, speed: 1.75, interval: 1.4, weight: 1, mass: 1, life: 1 },   // the ghost army's hounds: fast, thin, come in packs
    hound:   { name: "흉갑기병", info: ["갑옷을 두른 기병. 빠르고 단단하다.", "정면에서 받아 낼 저지 가사인격이 필요하다."], hp: 1700, atk: 250, def: 150, res: 0, speed: 1.45, interval: 1.6, weight: 1, mass: 2, life: 1 },
    heavy:   { name: "척탄병", info: ["거대한 방패를 든 정예 척탄병. 방어력이 매우 높다.", "물리 공격은 잘 통하지 않는다. 술사의 마법이 답이다."], hp: 6000, atk: 600, def: 800, res: 0, speed: 0.48, interval: 2.6, weight: 1, mass: 3, life: 1, elite: true },
    drone:   { name: "정찰 드론", info: ["하늘을 나는 정찰 드론. 근거리 가사인격은 막을 수 없다.", "병사를 실어 나르기도 한다. 저격으로 떨어뜨리자."], hp: 800, atk: 0, def: 50, res: 0, speed: 0.9, interval: 99, weight: 0, mass: 0, life: 1, flying: true },
    hexer:   { name: "척후병", info: ["멀리서 총을 쏘는 척후병.", "사거리 안에 가사인격이 들어오면 멈춰 서서 조준한다."], hp: 1400, atk: 220, def: 100, res: 0, speed: 0.7, interval: 2.8, weight: 1, mass: 2, life: 1, ranged: 2.2 },
    // the shield bearers the balloon corps sets down beside every place to stand: whoever is in reach hits the shield first
    shield:  { name: "방패병", info: ["커다란 방패를 앞세운 망령 보병.", "주변 가사인격의 공격을 먼저 받아 낸다. 마법으로 뚫자."], hp: 2600, atk: 180, def: 420, res: 0, speed: 0.6, interval: 2.2, weight: 1, mass: 2, life: 1, taunt: true },
    // the balloon corps: a slow, heavy airship that carries men over the lines and lets them down on ropes, one stop after another
    airship: { name: "수송 비행선", info: ["병사를 싣고 전장 위를 건너는 비행선. 느리지만 단단하다.", "멈춰 설 때마다 병사를 내려보낸다. 내리기 전에 떨어뜨리자."], hp: 3800, atk: 0, def: 120, res: 10, speed: 0.4, interval: 99, weight: 0, mass: 0, life: 1, flying: true, carrier: true },
    boss:    { name: "독수리 기수", hp: 16000, atk: 850, def: 450, res: 30, speed: 0.42, interval: 2.2, weight: 2, mass: 4, life: 3, boss: true },
    // the Chouans: ghosts of the royalist peasant war, led by their headless general
    rebel:   { name: "망령 농민", info: ["쇠스랑을 든 망령 농민. 하나하나는 약하다.", "무리 지어 몰려온다."], hp: 750, atk: 140, def: 20, res: 0, speed: 0.75, interval: 1.5, weight: 1, mass: 1, life: 1 },
    shooter: { name: "게릴라 엽총수", info: ["숲에 숨어 싸우던 게릴라 엽총수.", "멀리서 쏜다. 사거리 안에 오래 두지 말자."], hp: 820, atk: 170, def: 30, res: 0, speed: 0.62, interval: 3.0, weight: 1, mass: 1, life: 1, ranged: 1.9 },
    scout:   { name: "목 없는 척후기병", info: ["목 없는 척후기병. 아주 빠르다.", "놓치면 그대로 방어 포인트까지 달려간다."], hp: 620, atk: 120, def: 0, res: 0, speed: 1.45, interval: 1.1, weight: 1, mass: 1, life: 1 },
    // the headless general: a boss at his own scale (noMul), fought in three movements — the stand under the blade, the horn that rouses the whole camp (and brings his
    // riders up behind him), and from half his strength the charge that breaks through whoever holds him and carries him a square past them
    cadoudal:{ name: "조르주 카두달", info: ["목 없는 장군. 단두대 아래에 한참 섰다가 언덕을 돌아 아래쪽 길로 온다. 팔이 길어, 막는 이가 없으면 바로 옆 칸(고지 포함)의 가사인격을 벤다. 세 번째 공격마다 둘레 한 칸을 모두 휩쓴다(고지 포함, 1초 전 붉은 원).", "막히지 않았을 때는 2칸 안 고지의 가사인격에게 갈고리를 던져 끌어내린다(1.5초 전 표시, 맞으면 퇴각). 체력 2/3·1/3에 호각으로 진지 전체를 깨우고 게릴라 둘을 곁에 불러내며(모두 방어 지점으로 곧장 달려온다), 절반 아래부터는 성심 깃발을 올려 둘레의 반란군을 빠르고 세게 만들며 돌격으로 저지를 뚫는다."],
      hp: 9000, atk: 460, def: 180, res: 20, speed: 0.5, interval: 2.4, weight: 2, mass: 4, life: 3, boss: true, noMul: true,
      reachHigh: 1, sweep: { every: 3, r: 1, mul: 0.65, wind: 1.0 }, hook: { every: 15, r: 2.3, wind: 1.5, dmg: 300 }, rally: { at: 0.5, r: 2.2, speed: 1.3, atk: 1.2 },
      charge: { every: 9, dur: 1.6, mult: 2.6, hit: 2, breach: { at: 0.5, push: 1.1 } }, call: { at: [0.66, 0.33], type: "chouang", n: 2, rouse: true, direct: true, dash: 1.4 } },   // direct: whoever he calls or rouses takes the shortest way to the point; dash: at a run
    // ---- the second half of the chapter: the Emperor's line and the Guard (figures borrowed from the roster, recoloured — see EN_POSED in the page) ----
    grenadier: { name: "근위 척탄병", info: ["곰가죽 모자의 노근위대 척탄병. 단단하고 느리며, 둘 몫으로 저지된다.", "물리 피해. 방어력이 높으니 마법이나 수레의 폭발로 깎자."],
      hp: 5200, atk: 430, def: 440, res: 20, speed: 0.6, interval: 2.4, weight: 2, mass: 3, life: 1 },
    drummer: { name: "근위 고수", info: ["북을 치며 걷는 근위대의 늙은 고수. 스스로는 거의 싸우지 못한다.", "북소리가 닿는 2칸 안의 아군은 발이 빨라지고 공격이 세지며, 눈보라에도 느려지지 않는다. 먼저 떨어뜨리자."],
      hp: 1500, atk: 110, def: 60, res: 10, speed: 0.85, interval: 2.5, weight: 1, mass: 1, life: 1, rally: { r: 2.2, speed: 1.3, atk: 1.2 } },
    vicar: { name: "선서 거부 사제", info: ["공화국에 선서하기를 거부하고 반란군을 따라나선 시골 사제. 십자가를 들고 걷는다.", "2.5초마다 둘레 2칸 안의 반란군을 최대 체력의 6%만큼 치료한다. 마법에 강하다. 사제부터 쓰러뜨리자."],
      hp: 2600, atk: 160, def: 60, res: 45, speed: 0.8, interval: 2.4, weight: 1, mass: 2, life: 1, mend: { r: 2.2, pct: 0.06, every: 2.5 } },
    lancer: { name: "황제군 창병", info: ["긴 창을 겨눈 보병. 몇 초마다 창을 낮추고 내달린다.", "내달린 뒤의 첫 일격은 두 배로 들어간다. 저지수가 넉넉한 중장으로 받자."],   // on foot (the game has no cavalry): the key stays "lancer"
      hp: 2300, atk: 330, def: 170, res: 0, speed: 0.95, interval: 1.8, weight: 1, mass: 2, life: 1, charge: { every: 7, dur: 1.2, mult: 2.4, hit: 2 } },
    // ---- chapter 3 (the capital): the night police and what walks the dark streets (figures borrowed, recoloured) ----
    chasseur: { name: "근위 엽병", info: ["짧은 기병총을 든 근위 엽병. 걸으며 가사인격부터 쏜다.", "사거리 2.4칸. 등불 밖에서는 보이지 않은 채로 쏜다."],
      hp: 1500, atk: 460, def: 130, res: 20, speed: 0.85, interval: 2.3, weight: 1, mass: 2, life: 1, ranged: 2.4, phys: true, rscale: true },
    snuffer: { name: "소등부", info: ["긴 소등 막대를 든 야경꾼. 지나가는 길의 가로등을 끈다.", "바로 옆 칸에 가사인격이 선 등은 못 끈다. 어둠 속에서도 보인다. 꺼진 등은 옆 칸에 서 있으면 다시 켜진다(새로 배치된 이는 6초, 서 있던 이는 14초)."],
      hp: 1900, atk: 160, def: 90, res: 10, speed: 0.75, interval: 2.2, weight: 1, mass: 2, life: 1, snuff: true, lantern: true },
    // the lab (L1): the chimney sweep, drawn as the snuffer in soot grey. He makes for the nearest stopped chimney, and five seconds beside it clear it
    sweep: { name: "굴뚝 청소부", info: ["검댕투성이 굴뚝 청소부. 막아 둔 굴뚝을 뚫으러 온다.", "막힌 굴뚝 옆에 5초 서 있으면 연기 다리가 바로 돌아오고, 그 굴뚝은 20초 동안 막을 수 없다."],
      hp: 2200, atk: 120, def: 90, res: 10, speed: 0.8, interval: 2.2, weight: 1, mass: 2, life: 1, sweeper: { dur: 5, block: 20 } },
    // the lab (L2): the conductor's baton, drawn as the drummer in pale gold. No attack; he makes for the nearest metronome ahead and, beside it, speeds its zone up until killed
    baton: { name: "지휘봉", info: ["지휘봉을 든 악단원. 싸우지 않는다.", "메트로놈 옆 칸에 서면 그 구역의 박자가 한 단계 빨라진다. 쓰러질 때까지 그 자리에 있다."],
      hp: 900, atk: 0, def: 0, res: 10, speed: 1.0, interval: 2.5, weight: 1, mass: 1, life: 1, baton: true },
    // the lab (L3, LAB-04): a masked figure on its way to the ball, drawn as the informer in a white half-mask. A guest or an assassin (the wave says which); nobody of ours
    // strikes one until it is judged: let through, it walks to the door; judged for killing, it is a normal foe that fights back
    masked: { name: "가면 쓴 사람", info: ["가면을 쓴 무도회 손님. 겉모습으로는 손님인지 자객인지 알 수 없다.", "가사인격은 스스로 공격하지 않는다. 막아 세운 뒤 눌러서 통과시키거나 처치하자. 맨얼굴은 거울 속에서만 보인다."],
      hp: 1500, atk: 0, def: 60, res: 20, speed: 0.7, interval: 1.6, weight: 1, mass: 1, life: 1, masked: true },
    // the lab (L4): the collector, drawn as the informer in grey-green. He is about only while the relay's paper is out of the vault: lying, he picks it up (2 s) and carries
    // it back; held, he strikes the one who holds it (and nobody else)
    collector: { name: "회수인", info: ["원문을 되찾으러 온 회수인. 원문이 금고 밖에 있을 때만 나타난다.", "떨어진 원문은 2초 만에 주워 금고로 가져간다. 원문을 든 가사인격만 친다. 들고 가다 쓰러지면 그 자리에 떨어뜨린다."],
      hp: 2400, atk: 380, def: 60, res: 20, speed: 0.9, interval: 1.6, weight: 1, mass: 1, life: 1, collector: true },
    // The lamp-breaker is the snuffer with an iron hook. He breaks the lamps beside him even when one of ours stands by them, and a broken lamp needs a keeper for a while.
    lampbreaker: { name: "등 깨는 자", info: ["쇠갈고리를 든 야경꾼. 지키는 이가 있어도 등을 깨뜨린다.", "깨진 등은 지키던 이가 다시 켤 수 없다. 꺼진 뒤 옆 칸에 새로 배치된 가사인격이 6초 서 있어야 켜진다."],
      hp: 2600, atk: 160, def: 90, res: 10, speed: 0.75, interval: 2.2, weight: 1, mass: 2, life: 1, snuff: "force", lantern: true },
    mouchard: { name: "밀고자", info: ["경찰청의 끄나풀. 싸우지 않고 가사인격 하나를 지목한다.", "지목되면 10초간 피해 1.6배, 원거리 적의 표적이 된다. 고지의 가사인격부터 지목한다."],
      hp: 1900, atk: 0, def: 60, res: 20, speed: 0.6, interval: 99, weight: 1, mass: 1, life: 1, mark: { r: 4.5, dur: 10, amp: 1.6, every: 9 } },
    // WL-05's master of the coronation guns: he fights like an officer of the Guard, but his orders are the danger. At two thirds he calls "lights out" (every lamp goes dark,
    // kept or not) and at one third "every gun"; each time two of the line come up. His called shots look for a medic first. The men round him keep step. At his own scale (noMul)
    colonel: { name: "의장 포병 대령", info: ["대관식의 예포를 맡은 근위 포병 대령. 둘레 2.2칸의 적은 빨라지고 세진다. 둘 몫으로 저지된다.", "문 아래 서 있는 동안은 포를 멈추거나 빼앗을 수 없다. 걸으면서는 12초마다 한 명을 가리켜 그 자리에 포탄을 부른다(의무 가사인격부터). 체력이 2/3가 되면 \"소등\": 모든 등이 꺼진다. 지키던 이가 그대로 서 있으면 14초, 새로 배치된 이는 6초 만에 다시 켠다. 1/3이 되면 \"전 포문\"(30초 동안 포가 9초마다 쏜다)."],
      hp: 16000, atk: 480, def: 240, res: 20, speed: 0.45, interval: 2.2, weight: 2, mass: 4, life: 3, boss: true, noMul: true,
      rally: { r: 2.2, speed: 1.2, atk: 1.15 }, gunner: true, callshot: { every: 12, warn: 3, r: 3.5, pct: 0.35, delay: 2.0 }, call: { at: [0.66, 0.33], type: "soldier", n: 2, dark: "all", rapid: { every: 9, dur: 30 }, only: { dark: 0, rapid: 1 } } },
    // WL-08, the Emperor, the thing in the bottle that wears him. He commands from his post until late (his gun cannot be silenced while he stands on its muzzle square);
    // when he comes down everyone round him keeps step. He fights in two stages. In the first, at half his strength, he orders everything at once (every charge and gun on
    // the board is laid together, and the line falls in behind him). When he first falls he sets the crown on his head once more: three seconds untouchable, then the second
    // stage opens with the same order and he breaks once through whoever holds him. In the second stage, at half, he stands still for six seconds with his guard down.
    // Reaching a point loses the operation (life 10).
    emperor: { name: "황제", info: ["관을 쓴 쪽. 능선 건너 지휘 위치에 서 있다가, 근위대가 꺾이면 직접 내려온다. 둘 몫으로 저지된다. 그가 닿으면, 막고 있던 적을 놓고 그를 붙든다. 둘레 2.4칸의 적은 빨라지고 세진다. 방어 지점에 닿으면 작전은 실패한다.", "체력이 절반이 되면 \"전군\": 모든 돌격과 포격이 한꺼번에 예고되고 포도탄이 능선마루를 넘는다. 명한 뒤 4초 동안은 걸음을 멈춘다. 쓰러지면 관을 다시 쓰고 일어난다(3초 동안 피해를 받지 않는다). 일어나며 다시 \"전군\"을 명하고, 막아선 가사인격을 한 번 뚫는다. 그 뒤 체력이 7할로 줄면 6초 멈춰 서며 방어가 무너진다. 빼앗은 포는 한 발마다 그의 최대 체력의 10%를 깎는다."],
      hp: 10000, atk: 640, def: 300, res: 30, speed: 0.4, interval: 2.2, weight: 2, mass: 4, life: 10, boss: true, noMul: true, gunner: true, claim: true,
      rally: { r: 2.4, speed: 1.25, atk: 1.2 }, call: { at: [0.5], phase: 1, type: "soldier", n: 2, barrage: true, gate: 1, via: [[11, 4], [7, 4], [2, 4]], stall: 4 },   // stall: after the order he stands 4 s with his arm raised
      phase2: { hp: 8000, invul: 3, def: 220, atk: 640, speed: 0.5, barrage: true }, falter: { at: 0.7, phase: 2, dur: 6, r: 3, bare: true },
      charge: { every: 1e9, dur: 1.6, mult: 1.0, hit: 2, breach: { at: 1, phase: 2, push: 0.55 } } },   // the charge is kept only for the breach: he never charges on his own
    // WL-09, the phantom army the confessor rings up out of the palace armoury (Faust II, act 4): old armour with nobody in it
    armour: { name: "빈 갑주", info: ["아무도 들어 있지 않은 옛 갑옷. 느리고 단단하다.", "어둠 속에서 쓰러지면 5초 뒤 다시 일어난다(한 번)."],
      hp: 4200, atk: 420, def: 480, res: 10, speed: 0.6, interval: 2.4, weight: 1, mass: 3, life: 1, revive: { pct: 0.5, delay: 5, n: 1 } },
    // A cuirassier left on foot where a charge has passed (WL-08). A charge volley with "leave" sets him down at the far end of its line.
    cuirassier: { name: "말에서 내린 흉갑기병", info: ["돌격이 지나간 자리에 남은 기병. 흉갑을 입어 단단하다.", "돌격이 여러 번 지나간 뒤부터, 줄의 먼 쪽 끝에 남는다."],
      hp: 4800, atk: 520, def: 380, res: 10, speed: 0.7, interval: 2.4, weight: 2, mass: 3, life: 1 },
    kingarmour: { name: "빈 왕좌의 갑주", info: ["대관식용 갑주. 관은 얹혀 있는데 머리가 없다. 셋 몫으로 저지된다. 그가 닿으면, 막고 있던 적을 놓고 그를 붙든다.", "어둠 속에서 쓰러뜨리면 5초 뒤 체력 절반으로 다시 일어난다(두 번까지). 등불 아래에서 끝내야 한다. 둘레 2.2칸의 빈 갑주들은 빨라지고 세진다."],
      hp: 12000, atk: 560, def: 420, res: 20, speed: 0.38, interval: 2.4, weight: 3, mass: 4, life: 3, boss: true, noMul: true, claim: true, revive: { pct: 0.5, delay: 5, n: 2 }, rally: { r: 2.2, speed: 1.2, atk: 1.15 }, lantern: true,
      call: { at: [0.5], darkNear: true } },   // at half his strength the lamp nearest him goes out, once; he calls nobody
    // the eagle-bearer: the Guard's standard, at his own scale (noMul). He plants the eagle in the square and the Guard forms on it: everyone round him marches faster and hits
    // harder; at two thirds and one third of his strength he raises it again — three of the line fall in behind him, and the blizzard blows out of the gate on his signal
    eagle:   { name: "독수리 기수", info: ["근위대의 독수리 군기를 든 거구. 셋 몫으로 저지된다.", "군기 둘레 2.4칸의 적은 북소리처럼 빨라지고 세진다. 체력이 2/3, 1/3로 줄 때마다 군기를 치켜들어 뒤따르던 보병 셋을 불러 세우고, 성문에서 눈보라가 불어온다."],
      hp: 13000, atk: 620, def: 400, res: 30, speed: 0.4, interval: 2.2, weight: 3, mass: 4, life: 3, boss: true, noMul: true,
      rally: { r: 2.4, speed: 1.25, atk: 1.2 }, call: { at: [0.66, 0.33], type: "soldier", n: 3, gust: true } },
    // the bocage: a fowler down in the hedge, unseen until the muzzle flash gives him away
    ambusher:{ name: "매복 엽총수", info: ["생울타리에 숨은 엽총수. 첫 발을 쏘기 전까지는 보이지 않는다.", "총성이 나면 그제야 모습을 드러낸다. 숨어 있는 동안에는 막고 있는 가사인격만 공격할 수 있다."], hp: 900, atk: 230, def: 40, res: 0, speed: 0.55, interval: 2.8, weight: 1, mass: 1, life: 1, ranged: 2.4, ambush: true },
    // ---- chapter 2's own roster, modelled on the original's winter (Yeti Squadron) and Ursus guerrilla foes, at their scale ----
    snowsniper: { name: "설원 저격수", info: ["흰 외투를 두른 저격수. 멀리서 쏘고, 마법에도 잘 버틴다. 얼어붙은 상대를 먼저 노리고, 두 배의 피해를 준다.", "눈보라가 부는 동안에는 모습을 감춘다. 숨어 있는 동안에는 막고 있는 가사인격만 공격할 수 있다."],
      hp: 1500, atk: 480, def: 150, res: 50, speed: 0.8, interval: 2.7, weight: 1, mass: 2, life: 1, ranged: 3.0, phys: true, snowcloak: true, vsFrozen: 2, snowproof: true, rscale: true },   // the ranged rank and file fight at their own scale (rscale: the stage's rmul, not its mul): at full scale any of them is a match for a lone vanguard
    yfang: { name: "설원 사냥개", info: ["눈 위를 달리는 굶주린 개. 아주 빠르다.", "얼어붙은 상대를 물면 공격력이 1.5배가 된다. 눈보라 속에서도 느려지지 않는다."],
      hp: 3150, atk: 350, def: 0, res: 30, speed: 1.6, interval: 1.4, weight: 1, mass: 1, life: 1, vsFrozen: 1.5, snowproof: true },
    yrazor: { name: "설원 사냥개 우두머리", info: ["무리를 이끄는 큰 개. 빠르고 질기다.", "얼어붙은 상대를 물면 공격력이 1.5배가 된다. 눈보라 속에서도 느려지지 않는다."],
      hp: 4650, atk: 430, def: 0, res: 30, speed: 1.6, interval: 1.4, weight: 1, mass: 2, life: 1, vsFrozen: 1.5, snowproof: true, elite: true },
    chouan: { name: "슈앙 게릴라", info: ["왕당파 게릴라. 덤불과 눈 속을 오래 걸어온 단단한 보병.", "막는 이가 없으면 짧은 사거리의 엽총으로 쏜다."],
      hp: 3300, atk: 330, def: 150, res: 20, speed: 0.93, interval: 2.0, weight: 1, mass: 2, life: 1 },
    // chapter 2's Chouan from IM-02 on: the same man, but he does what his card says — nobody holding him, he stops and lets fly with the fowling piece at short range (IM-01 and TR-03 keep the plain one)
    chouang: { name: "슈앙 게릴라", info: ["엽총을 든 왕당파 게릴라. 오래 걸어온 단단한 보병.", "사거리 1.6칸. 고지의 가사인격도 쏜다."],
      hp: 3300, atk: 330, def: 150, res: 20, speed: 0.93, interval: 2.0, weight: 1, mass: 2, life: 1, ranged: 1.6, phys: true },
    frostgun: { name: "서리 사수", info: ["총신을 얼음으로 감싼 황제군 사수. 얼음 탄을 쏘아 마법 피해를 준다. 사거리 2.6칸.", "맞으면 동상이 쌓인다. 두 번 쌓이면 얼어붙는다. 눈보라 속에서도 느려지지 않는다."],
      hp: 1200, atk: 240, def: 100, res: 40, speed: 0.8, interval: 2.4, weight: 1, mass: 2, life: 1, ranged: 2.6, frost: 1, snowproof: true, rscale: true },
    iceguard: { name: "빙갑 근위병", info: ["얼음을 갑옷처럼 두른 근위대의 망령. 방어력과 마법 저항이 모두 매우 높고, 몹시 느리다.", "한 번에 셋을 저지해야 멈춘다. 오래 붙잡아 두고 깎아 내야 한다. 눈보라 속에서도 느려지지 않는다."],
      hp: 18000, atk: 820, def: 1000, res: 60, speed: 0.25, interval: 3.2, weight: 3, mass: 4, life: 2, elite: true, snowproof: true },
    molotov: { name: "슈앙 화염병 투척병", info: ["독한 술병에 불을 붙여 던지는 반란군. 저지를 무시하고 2.5칸 안으로 던지며, 터진 자리와 바로 옆 칸에 마법 피해를 준다. 던지기 전 1초 동안 목표 위에 불꽃 표시가 뜬다.", "얼어붙은 가사인격을 먼저 노린다. 얼어 있는 상대가 맞으면 얼음이 녹으며 0.8초 동안 4번, 매번 최대 체력의 20%만큼 고정 피해를 입는다."],
      hp: 950, atk: 300, def: 60, res: 10, speed: 0.85, interval: 7, weight: 1, mass: 1, life: 1, ranged: 2.5, aim: 1.0, splash: 1.0, melt: { n: 4, pct: 0.2, gap: 0.2 }, rscale: true },
    chxelite: { name: "슈앙 명사수", info: ["오래 싸워 온 왕당파 명사수. 처음부터 길목을 차지하고 버틴다. 웬만한 선봉은 맞붙어도 이긴다.", "물리 피해. 사거리 2.4칸. 근위나 중장으로 붙거나, 둘 이상이 함께 덤벼야 한다."],
      hp: 2000, atk: 560, def: 120, res: 30, speed: 0.85, interval: 2.4, weight: 1, mass: 2, life: 1, ranged: 2.4, phys: true, elite: true, noMul: true },
    chxbow: { name: "슈앙 엽총수", info: ["왕당파 엽총수. 길을 걸으며 가사인격부터 쏜다.", "물리 피해. 사거리 2.4칸."],
      hp: 1300, atk: 420, def: 110, res: 20, speed: 0.85, interval: 2.3, weight: 1, mass: 2, life: 1, ranged: 2.4, phys: true, rscale: true },
    yshield: { name: "설원 중장병", info: ["얼음을 덧댄 큰 방패를 든 중장병. 느리지만 아주 단단하다.", "눈보라가 부는 동안에는 얼음 갑주가 두꺼워져 방어력이 1.5배가 된다."],
      hp: 7000, atk: 520, def: 900, res: 30, speed: 0.5, interval: 2.6, weight: 1, mass: 3, life: 1, iceArmor: 1.5, snowproof: true },
    // the winter's own: frost that sticks, the white that hides, the cold that maddens, and bombs of ice from the air
    frosthound: { name: "서리 사냥개", info: ["얼음 송곳니를 가진 사냥개. 물리면 몸이 굳는다(동상).", "동상은 공격 속도를 늦추고, 두 번 쌓이면 얼어붙어 잠시 아무것도 못 하게 된다. 얼어붙은 상대는 더 깊이 문다(피해 1.5배).", "눈보라 속에서도 느려지지 않는다."], hp: 950, atk: 200, def: 30, res: 20, speed: 1.6, interval: 1.4, weight: 1, mass: 1, life: 1, frost: 1 , vsFrozen: 1.5, snowproof: true },
    frostmage: { name: "서리 술사", info: ["냉기를 쏘는 망령 술사. 마법 피해를 준다.", "맞으면 동상이 쌓인다. 두 번 쌓이면 얼어붙는다."], hp: 1300, atk: 210, def: 60, res: 40, speed: 0.6, interval: 2.6, weight: 1, mass: 2, life: 1, ranged: 2.2, frost: 1 , snowproof: true },
    icestalker: { name: "설원 척후병", info: ["흰 망토를 두른 척후병. 얼음 위에 서 있으면 보이지 않는다.", "얼음 위에 숨어 있는 동안에는 막고 있는 가사인격만 공격할 수 있다. 얼음을 벗어나면 드러난다."], hp: 1500, atk: 260, def: 120, res: 10, speed: 0.8, interval: 1.6, weight: 1, mass: 2, life: 1, iceHide: true , snowproof: true },
    berserk: { name: "동상 광인", info: ["추위에 미쳐 버린 병사. 체력이 계속 줄어든다.", "대신 시간이 갈수록 공격력과 공격 속도가 미쳐 날뛴다. 오래 붙잡아 두지 말자."], hp: 3600, atk: 260, def: 80, res: 0, speed: 0.75, interval: 1.6, weight: 1, mass: 2, life: 1, frenzy: { drain: 0.025, rate: 0.06, cap: 1.5 } },
    bomber: { name: "얼음폭탄 드론", info: ["얼음 폭탄을 매단 드론(명일방주의 밤테일 기준). 근거리 가사인격은 막을 수 없다. 천천히 날아온다.", "가사인격이 사거리(2칸) 안에 들어오면 폭탄을 한 번 던진다. 폭탄은 목표와 주변 0.8칸 안의 모두에게 공격력 100%의 물리 피해를 주고 동상을 쌓는다. 던지고 나면 이동 속도가 두 배가 된다. 던지기 전에 떨어뜨리자."],
      hp: 4000, atk: 800, def: 150, res: 30, speed: 0.51, interval: 99, weight: 1, mass: 0, life: 1, flying: true,
      bomber: { range: 2, r: 0.8, mul: 1, frost: 1, fall: 0.9, arm: 0.6, dash: 2 } },
    // the infernal machine (rue Saint-Nicaise, 1800): a cart with a barrel of powder, rolled on until it bursts — over everyone near it
    cart:    { name: "지옥 기계", info: ["화약통을 실은 수레. 공격하지 않고 그저 굴러온다.", "부서지거나, 막힌 채 도화선이 다 타면 터진다. 주위의 적과 아군을 가리지 않는다. 적에게는 훨씬 큰 피해를 준다."], hp: 2600, atk: 0, def: 300, res: 60, speed: 0.36, interval: 99, weight: 2, mass: 4, life: 1, bomb: { r: 1.45, dmg: 1100, fuse: 3.5, foe: 2.4 } },   // foe: packed for the column it was meant for — their own men take it far worse than ours
    // Marshal Ney: the sniper who never misses. Unseen on his perch at first, then down the road shooting as he walks;
    // every third round is a heavy one, and each time he is cut down a third he sweeps the field and puts three rounds into whoever stands furthest forward
    ney:     { name: "미셸 네", hp: 26000, atk: 600, def: 380, res: 30, speed: 0.34, interval: 2.6, weight: 2, mass: 4, life: 3, boss: true,
      sniper: { every: 3, strong: 2.0, aim: 0.9 }, stealth: { reveal: 16 }, perch: { at: [1, 3], until: 36 },
      scan: { at: [2 / 3, 1 / 3], sweep: 2.4, gap: 0.45, mark: 0.75, near: 0.08 } },
  };
  // the waves Ney calls in when he is cut down a third: [delay, type, spawn]
  const NEY_CALL = [
    [[0, "hound", 0], [1.2, "hound", 1], [5, "soldier", 1], [8, "hexer", 0], [11, "soldier", 0]],
    [[0, "heavy", 0], [3, "hound", 1], [4, "hound", 0], [8, "hexer", 1], [11, "soldier", 0], [14, "soldier", 1]],
  ];
  const RAGE = { at: 0.3, atk: 1.3 };
  const MUD = 0.4;
  const THIN_ICE = 0.3;   // what thin ice takes off the armour of whoever stands on it
  const FROST = { slow: 1.35, dur: 7, freeze: 3, imm: 3 };
  const BLIZ = { step: 1.1, dmg: 0.03, slow: 0.35 };   // the blizzard: how fast its front creeps a square, the share of max HP a frozen operator loses each second, how much it slows the foe   // 동상: attack interval x slow for dur; at two, frozen for freeze, then a moment's grace   // the rasputitsa: how much slower a foe wades through mud
  const FIRE = { pct: 0.07, min: 60 };   // a burning square: what share of an operator's health it takes a second (at least this much)
  const NEY_ROUNDS = 6;   // BL-07: the marked rounds he has at the lighthouse — a revolver's cylinder; the seventh is not his
  // BL-07, the march to the lighthouse: a big field fought one part at a time. Each part is held for a while, then the defence point
  // moves on: a short window to pull operators back (whoever is still out is pulled out by force, no refund, the redeploy timer running),
  // then the next part — the player picks which way where the road forks. The horde behind follows into the next part; the life is shared.
  // Ney is out of sight until the last part: every so often he sweeps the field and puts three rounds around the biggest foe on the ground.
  const BARRAGE = { sweep: 1.6, mark: 1.0, gap: 0.45, n: 3, r: 1.05, dmg: 900 };
  // the parts sit side by side on one big field: "at" is each part's corner on it
  const MARCH7 = { start: "p0", window: 10, tex: "map_c7", parts: {
    p0: { at: [2, 8], name: "진창 강둑", en: "MUDBANK", hold: 45, next: ["p1a", "p1b"], rear: [0, 1, 2], barrage: { first: 9, every: 16 },
      map: ["##S,,#######", "#,,,,,hhhh#.", "S,,,,.....,B", "#,,,,.....,.", "##,,,,hhhh,.", "#S,,,,,....."],
      waves: [[4, "strag", 1, 2, 1.4], [10, "soldier", 0, 1, 3], [14, "strag", 2, 3, 1.2], [20, "dog", 1, 2, 1], [25, "soldier", 2, 1, 2.5], [28, "strag", 0, 3, 1],
        [34, "soldier", 1, 2, 2], [38, "dog", 0, 1, 0.9], [40, "strag", 1, 3, 0.9], [42, "heavy", 1]] },
    p1a: { at: [6, 1], name: "뒷골목", en: "BACKSTREETS", desc: "좁은 골목과 지붕 고지대. 머리 위로 드론이 넘어옵니다.", hold: 55, next: ["p2a", "p2b"], rear: [0, 1], barrage: { first: 8, every: 15 },
      map: ["#hhh#hhh#hh#", "S,,,,.,,,.,,", "#hh,hh,hh,,B", "#hh,hh.hh,hh", "#,,.,,,.,,hh", "S,hh#hhh#hh#"],
      waves: [[2, "soldier", 0, 2, 2.5], [6, "strag", 1, 3, 1.2], [12, "drone", 0, 2, 3], [18, "soldier", 1, 2, 2], [24, "heavy", 0], [28, "strag", 0, 4, 1],
        [34, "drone", 1, 3, 2], [38, "soldier", 0, 2, 2], [44, "hexer", 1, 2, 3], [48, "strag", 1, 4, 0.9], [52, "heavy", 1]] },
    p1b: { at: [5, 14], name: "선착장", en: "DOCKS", desc: "부두 길 하나로 사냥개 무리가 쏟아집니다.", hold: 55, next: ["p2a", "p2b"], rear: [0, 1], barrage: { first: 8, every: 15 },
      map: ["S,,,,,,,,,,B", "S,..,,..,,..", "hh.#hh.#hh.#", "##.###.###.#", "##.###.###.#", "##.###.###.#"],
      waves: [[2, "dog", 1, 3, 0.8], [6, "strag", 0, 3, 1.2], [10, "soldier", 0, 2, 2.5], [16, "dog", 0, 3, 0.7], [20, "heavy", 1], [26, "dog", 0, 4, 0.7],
        [30, "strag", 1, 4, 1], [36, "soldier", 0, 2, 2], [42, "dog", 1, 4, 0.6], [48, "heavy", 0], [50, "strag", 0, 4, 0.9]] },
    p2a: { at: [18, 2], name: "다리", en: "BRIDGE", desc: "다리 위 외길. 앞에서 중장병과 방패병이 밀고 옵니다.", hold: 60, next: ["p3"], rear: [0, 2], front: [1], barrage: { first: 8, every: 14 },
      map: ["#,###########", "#,##h###h##h#", "S,..,,B,.,.,S", "#,##h###h####", "#S###########"],
      waves: [[2, "strag", 0, 4, 1], [6, "soldier", 2, 2, 2.5], [10, "shield", 1], [12, "hexer", 1], [16, "dog", 0, 2, 1], [24, "heavy", 1], [28, "strag", 2, 4, 1],
        [30, "shield", 1], [34, "hexer", 1, 2, 3], [40, "soldier", 0, 3, 2], [46, "heavy", 1], [50, "shield", 1], [52, "strag", 0, 4, 0.8], [56, "dog", 2, 3, 0.8]] },
    p2b: { at: [17, 12], name: "창고가", en: "WAREHOUSES", desc: "창고 사이 골목. 척후병이 앞쪽에서 쏘아 댑니다.", hold: 60, next: ["p3"], rear: [0, 2], front: [1], barrage: { first: 8, every: 14 },
      map: ["S,h#S,######", ",.##,.######", ",.##,,h#####", "h,##.,######", ",,##,,,#####", "#,h#.,,,,..B", "#S,.,,hhhhh#"],
      waves: [[2, "strag", 0, 4, 1], [6, "soldier", 2, 2, 2.5], [10, "hexer", 1, 2, 3], [14, "shield", 1], [18, "dog", 2, 2, 1], [24, "heavy", 0], [28, "hexer", 1, 2, 3],
        [30, "strag", 2, 4, 1], [36, "shield", 1], [40, "soldier", 2, 3, 2], [46, "hexer", 1, 2, 2.5], [50, "heavy", 2], [52, "strag", 0, 4, 0.8], [56, "shield", 1]] },
    p3: { at: [19, 7], name: "등대 아래", en: "THE LIGHTHOUSE", final: true, rear: [], front: [0, 1],
      map: ["############", "#########,h#", ",,hh,..,,,#S", "B,..,,,,,,,S", "#.,h#####hh#"],
      waves: [[0, "ney", 0, 1, 0, { perch: [10, 1], seen: true, scanEvery: 30, atk: 0.75 }], [8, "shield", 0], [12, "hexer", 1], [20, "soldier", 0, 2, 3], [30, "shield", 1], [36, "hexer", 0],
        [44, "heavy", 1], [54, "soldier", 0, 2, 3], [64, "shield", 0], [70, "hexer", 1], [82, "soldier", 1, 2, 3], [94, "shield", 1], [100, "hexer", 0], [110, "heavy", 0]] },
  } };
  const SQ_RAIN = { n: 4, per: 0.2, first: 0.22, gap: 0.08 };   // 죽음의 성좌: four clinkers a mark, a fifth of her attack each   // every boss: on its last legs it hits harder

  // [time, enemy, spawn]
  const WAVES1 = (() => {   // the first night: rebels and scouts, then the headless captain himself
    const w = [];
    const add = (t, type, s, n = 1, gap = 0) => { for (let i = 0; i < n; i++) w.push([t + i * gap, type, s]); };
    add(8, "rebel", 0, 3, 4);
    add(16, "soldier", 1, 2, 5);     // the line infantry are in it too: a three-way brawl at the crossing
    add(60, "soldier", 0, 2, 4);
    add(24, "rebel", 1, 3, 3.5);
    add(36, "scout", 0, 2, 2);
    add(46, "shooter", 1, 2, 4);
    add(56, "rebel", 0, 4, 2.5);
    add(66, "scout", 1, 3, 1.6);
    add(78, "shooter", 0, 2, 3);
    add(84, "rebel", 1, 4, 2.5);
    add(98, "cadoudal", 0);
    add(104, "scout", 1, 3, 2);
    add(112, "rebel", 0, 3, 2.5);
    add(120, "shooter", 1, 2, 3);
    return w.sort((a, b) => a[0] - b[0]);
  })();
  const WAVES = (() => {
    const w = [];
    const add = (t, type, s, n = 1, gap = 0) => { for (let i = 0; i < n; i++) w.push([t + i * gap, type, s]); };
    add(6, "soldier", 0, 4, 4);
    add(22, "hound", 1, 3, 2);
    add(34, "soldier", 1, 4, 3.5);
    add(48, "drone", 0, 2, 3);
    add(56, "hound", 0, 4, 1.5);
    add(66, "heavy", 1);
    add(70, "soldier", 1, 3, 3);
    add(84, "hexer", 0, 2, 4);
    add(90, "drone", 1, 3, 2.5);
    add(100, "soldier", 0, 5, 2.5);
    add(104, "hound", 1, 5, 1.2);
    add(118, "heavy", 0);
    add(122, "hexer", 1, 2, 3);
    add(134, "drone", 0, 4, 2);
    add(142, "soldier", 1, 4, 2);
    add(150, "boss", 0);
    add(154, "heavy", 1);
    add(156, "hound", 0, 6, 1);
    add(166, "hexer", 1, 3, 2.5);
    add(172, "drone", 1, 3, 2);
    return w.sort((a, b) => a[0] - b[0]);
  })();

  const WAVES_NEY = (() => {   // the marshal's road: the line comes on while he waits up on the rise, unseen
    const w = [];
    const add = (t, type, s, n = 1, gap = 0) => { for (let i = 0; i < n; i++) w.push([t + i * gap, type, s]); };
    add(1, "ney", 0);
    add(6, "soldier", 0, 3, 4);
    add(14, "soldier", 1, 3, 4);
    add(24, "hexer", 0, 2, 4);
    add(30, "hound", 1, 3, 1.5);
    add(40, "soldier", 0, 4, 3);
    add(52, "heavy", 1);
    add(60, "hexer", 1, 2, 3);
    add(70, "hound", 0, 4, 1.2);
    add(82, "soldier", 1, 4, 2.5);
    add(95, "heavy", 0);
    add(100, "hexer", 0, 3, 2.5);
    add(112, "soldier", 1, 5, 2);
    add(125, "hound", 0, 5, 1);
    return w.sort((a, b) => a[0] - b[0]);
  })();
  // chapter 1 maps, laid out in the map sheet (맵 설계도) and carried over as they were drawn
  const MAP_C1 = {   // the outer squares nobody would use are cut away, so each board is only as big as its fight
    alley: [   // 설계도 BL-04: one gate, a narrow way in
      "hhhhhhh##.",
      "B.......#.",
      "hhhhhh..S.",
      "########..",
    ],
    twin: [    // 설계도 BL-05: two roads, three gates, five places to stand
      "S############",
      "......hhhhhhh",
      "#####........",
      "S###########B",
      ".####........",
      "........hhhhh",
      "S#######hhhhh",
    ],
    plaza: [   // 설계도 BL-11: one gate in the middle of an open square; they come round both sides (no outer ring: the design means it)
      ".h...hhh",
      ".......h",
      "S...h..B",
      ".......h",
      ".h....hh",
    ],
    tower: [   // 설계도 BL-09: the middle gate only drones use
      "S...hhhhhhhhh",
      "###......hhhh",
      "####hhhh.....",
      "S###hhhhhhh.B",
      "####h........",
      "####h.#####hh",
      "S.....#####hh",
    ],
    pincer: [  // 설계도 BL-10: both gates beside the base; the ground in front of each is no place to stand
      "......,,S",
      ".........",
      "....hhh##",
      "......,,B",
      "....#hh##",
      ".........",
      "......,,S",
    ],
    drop: [    // 설계도 BL-08: the airships put men down beside the few places left to stand; the heavy ones come along the bottom
      ",,,,,,,,,.###",
      "S,,,,,#h,,###",
      ",,,,.,#h.,###",
      "####h,##,,..B",
      ",,,,,.,,,,,,,",
      "S,,hh#####hhh",
    ],
  };

  // ---------- chapter 2 「지옥 기계」: the outskirts, the bocage, the rebellion's road to the capital ----------
  // "~" mud (the rasputitsa): anyone may stand on it, the foe wades through it slowly
  const MAP_C2 = {
    mud: [     // IM-01: two roads meet on a frozen-thaw causeway of mud (it freezes whenever the blizzard blows, so it cannot be held then) and part again
               // for the two gates of the base. The wind comes up from the south. Raised walls shelter the two rises over the causeway; a windbreak at the far
               // bottom corner keeps the whole column before the base clear; the rest of the bottom row is rises that only get snowed over.
      "#hhh#hh#hhh#",
      "S..hhhhhh..B",
      "#h.~~~~~~.h#",
      "#h.~~~~~~.h#",
      "S..hWhhWh..B",
      "#.hh#hh#hh.#",
    ],
    lesson: [  // TR-03: the blizzard lesson. Two straight roads west to east; the wind comes up from the south. The bottom row: four open squares to stand a windbreak on,
               // the rest rises that are only snowed over. Two stretches of raised wall between the roads shelter the upper road behind them. Mud on the upper road.
      "#hhh#hhhh#h#",
      "S...~~~....B",
      "#hWWhh#WWh.#",
      "S..........B",
      "#.hh.hh.hh.#",
    ],
    mudYujin: [   // parked: 유진's own IM-01 (drawn in the map editor) — four gates, three defence points, the hounds' gate six squares from a base; kept for a later stage
      "S,,,,,,S####",
      "#,,,,hh,,~##",
      "S,##..~~~,,B",
      "####h.....h#",
      "####h.~~~..B",
      "####..###.W#",   // (10,5): a raised wall, so the blizzard stops there as it did when every wall stopped it
      "S,,,..hhh..B",
    ],
    bocage: [  // IM-02 (drawn by 유진 in the map editor): the hedgerows. Gates top and left feed a plaza that drains east along the third row; the bottom road
               // (walk-only) runs under a ridge of rises, and the white snipers hold it from the start. Hedges stand up as raised walls (W).
      "###S##########",
      "#h,,WhhhWhhh##",
      "#,,,..hhWh...#",
      "#,,.,......h.#",
      "S,.,,hhhhhhhB#",
      "#hhWhh,,,,,.B#",   // (11,5): one square of ground before the lower gate, the only place to stop anything on the bottom road
      "S,,,,,,,###W##",
      "####W#########",
    ],
    village: [ // IM-03 (yujin's design): the defence point in the middle of the burnt village; the firebottles come round over the north road, the hounds and frost gunners up from the south, the ice-clad guards wait in the west
      "#WWWWW,,,,,,,#",
      ",.,,,,,hhh##,#",
      ",#h##.,.,B#,,S",
      ",hS,#,.,,,#WW#",
      ",,,,h.,W,,h###",   // (7,4): a standing wall — the wind up the hounds' road stops there, so the forward square (7,2) and the rise behind it are out of it
      "######,####W##",
      "######S#######",
      "##############",
    ],
    field: [   // IM-04 (yujin's design): the Champ de Mars at night. Two gates in the middle of the ice, one each at the east and the south-west; two defence points at opposite corners. Everyone circles the ice before making for a point
      "##############",
      "#,,Wh,,,,#####",
      "B.-----S---,,#",
      "#,-=--S.--=-,S",
      "#.----------,#",
      "S,.hW,,,,h,W.#",
      "#####,,,,,,,.B",
      "##############",
    ],
    camp: [    // IM-05: the rebels' camp on the execution hill (the loop road of the original's 5-3 / 4-4 laid round a hill). The hill top (#) is ringed by rises; the scaffold with
               // the guillotine (W W) crowns it, and the camp's own gate (6,1) opens right under the blade. The ring road is two squares wide all round: the sunken road comes in at
               // the top left, the ravine at the bottom left, and both sides run east to the defence point (13,3). Ground squares lie along the ring at three depths on each side —
               // far (3,x), middle (9,x), near (12,x) — and the camp sleeps on the far and middle ones; the fowlers posted at (4,2)/(4,5) cover the whole western half
      "#####hWWh##h##",
      "S,,.,,S,,.,,.#",
      "#.,,.h,,h.,,.#",
      "#,.h######h.,B",
      "#,.h######h.,#",
      "#.,,.h,,h.,,.#",
      "S,,.,,,,,.,,.#",
      "###########h##",   // (11,0)/(11,7): two rises that see the last squares before the point from two squares off — out of the general's reach
    ],
    street: [  // IM-06: rue Saint-Nicaise (the one long lane of the original's 1-7, with a side square). The street is two rows: the roadway (y=3) and the doorsteps above it (y=2),
               // under the balconies (the rises). The east gate is at the far end, our defence point at the west end. The fountain square (5..11, 0..1) opens off the north side: the carts
               // come down the alley at (6,0) and go round the fountain (W) by the west or the east; the back alley (6,5) comes up from the south into the middle of the street
      "######S,,,,###",
      "#h#hh,.,W,.,h#",
      "#.,.,,,.,,,.,#",
      "B,.,,.,,,.,,,S",
      "#.h.h#.#h#.h.#",
      "######S#######",
    ],
    shadow: [  // IM-07: the crossroads (the two parallel roads of the original's annihilation maps, with a spine of high ground between them). The north road (y=1-2) and the south
               // road (y=4-5) run east to the defence point; the wall lane along the top (y=0) is the hounds' way round. Our rebels hold the two road mouths at the west end and stand in
               // the wind from the west; the white snipers lie on the two westernmost rises (1,2)/(1,4) and cover the mouths. The central spine (y=3) sees both roads and the wall lane
      "###,,.,,.,,.,#",
      "S,.,,.,,.,,.,#",
      "#h,h.,h.,h,.,#",
      "##h##h##h##h,B",
      "#h,h.,h.,h,.,#",
      "S,.,,.,,.,,.,#",
      "##############",
    ],
    barrier: [ // IM-08: the checkpoint before the customs wall (the one-gap barrier of the original's 2-8). The wall (W, x=7) crosses the board with one gap at (7,3); the gendarmes'
               // watch posts are the two rises on the wall beside it (7,1)/(7,5). East of the wall an open yard where the two roads (y=0, y=6) arrive; west of it the way splits round the
               // checkpoint house (3..4,3 and 3,4) by the north or the south and comes to the defence point along the open ground before it (x=1..2) — no single square to plug there
      "#######W,.,,,S",
      "#h.,.,.h,,.h,#",
      "#,,h,.,W,h,,.#",
      "B,,##,,,,,.,,#",
      "#,h#..,W,h,,.#",
      "#,.,.,.h,,.h,#",
      "#######W,.,,,S",
    ],
    wall: [    // IM-09: the customs wall (W). The boulevard outside (y=1-2), the road inside (y=4-5); the toll gate (6,3) with the customs-house brazier (F) at (5,2), and the broken
               // corner (12,3) with the watchman's brazier in the breach itself (13,3), warming the squares outside and inside it. The blizzard comes from the north: the wall takes it,
               // but it pours down the gate column: outside, only the squares by a fire are safe; inside, everything but the square under the gate. The rise (11,4) looks into the corner. The snipers' perches are the rises on the boulevard's far side (y=0) and the customs roofs (4,2)/(10,2)
      "#h##h###h##h##",
      "S,,.,,,,,.,,,#",
      "#.,.hF.,.,h,.#",
      "#WWWWW,WWWWW,F",
      "#h.,.,.h,,.h.#",
      "S,,.,,,,,.,,,B",
      "##h##h#h##h###",
    ],
    gate: [    // IM-10: the square before the city gate (the two lanes and central high ground of the original's annihilation 1, Chernobog). The gate opens between its towers (W, x=12)
               // onto two roads (y=2 and y=4) that cross the square to the defence point in the west; the monument (4,3)/(7,3) with its steps (the rises) stands between them, and the
               // gate's throat (10,3) joins them. The side streets bring the carts down from the north (5,0) and up from the south (5,6). The wind blows out of the gate, down both roads
      "#####S,,######",
      "#h,.,,.,h,.hW#",
      "#,.,.,,.,,.,,S",
      "B,,h#hh#h,.,W#",
      "#,.,.,,.,,.,,S",
      "#h,.,,.,h,.hW#",
      "#####S,,######",
    ],
  };
  // ---------- chapter 3 (working title 「쏘지 않은 탄환」): inside the capital. On these boards F is a gas lamp: it lights the squares round it ----------
  const MAP_C3 = {
    // chapter 3, second cut. What the boards share: a lamp (F) lights two squares round it and is kept only by whoever stands right beside it (above, below, left, right);
    // every street is two squares wide with nothing standing in it, and no square that one can stand on is crossed by every route. What they do not share: their outline
    lamps1: [  // WL-01: two streets east to west (the lit pockets of the original's Near Light boards). The lamps hang on the house fronts; each street has a stretch with none.
               // The cross street (6-7,3) lets a column change streets in the dark; both streets come down column 1 to the point
      "#F#h###h##F###",
      "#..,.,,.,,.,,S",
      "#,.,.,,.,,.,,#",
      "B,hhh#,,##hF##",
      "#,,.,.,,.,,.,#",
      "#,..,.,,.,,.,S",
      "#####Fh##h####",
    ],
    lamps2: [  // WL-02: the bread queue. The point is the baker's double door at the bottom; the street runs across the top (gates west and east, an alley from the north),
               // and two flights of steps come down into the little square before the door
      "###hF####S####",
      "#h,.,,.,,,.,h#",
      "S.,.,,.,,.,..S",
      "#F#h,,#h,,#F##",
      "##,.,.,,.,.,##",
      "##hh..,,..hh##",
      "###F,,,,,,F###",
      "#####hBBh#####",
    ],
    lamps3: [  // WL-03: the yard behind the prefecture. Two points: the cell door in the west (0,3) and the wagon gate in the south (7,6). The north gate and the main gate (east).
               // The two lamps in the middle (4,2) and (7,2) are out when the operation opens; the Guard's marksmen sit in the dark on (6,3) and (1,1), and the prisoners are
               // tied up under the dead east lamp (7,2)
      "#####S########",
      "#h.h,,,,,hF.,#",
      "#,.,F.,F,,,.,S",
      "B,,.,,h.,,h,,#",
      "#,.,h.,,,.,.,#",
      "#hF.,,.,,,.h##",
      "#######B######",
    ],
    steps: [   // WL-04: the church steps (the bombardment lanes of the original's episode 10). Two streets, each two wide: the inner row of each (y=2, y=5) lies under a gun,
               // the outer row (y=1, y=6) does not. The guns (W) stand at the east end, their muzzle squares (11,2)/(11,5) a step in from the two gates. A double point in the west
      "#######S####h#",
      "h,.,.,,,,.,.,#",
      "#,.,.,,.,,,.,W",
      "B,#h#,##,h##,S",
      "B,###,h#,##h,S",
      "#,.,.,,.,,,.,W",
      "h,.,.,,.,.,.,#",
      "############h#",
    ],
    nave: [    // WL-05: the square before the cathedral. The door (7,0) between the two saluting guns (W), which fire south down the columns x=4 and x=10; the point is in the
               // south-west, so every route crosses both lines of fire. Three lamps
      "####W##S##W###",
      "#h.,.,.,,,.,h#",
      "#,F.,,.,F.,.,S",
      "#,,,.h,.,,.,,#",
      "B,.,.,,,h.,.,S",
      "#h.,..F,.,.,h#",
      "##############",
    ],
    farm: [    // WL-06: the farm on the right of the line. For once they come from the west and the point is in the east. The open field north of the farm is two wide (the horse
               // rides its outer row), the farm's own lane runs between its walls, the field to the south is one wide. The gaps in the walls (6-7,3) and (6-7,5) are where
               // a line becomes a square
      "##############",
      "S,,.,,.,,.,,,#",
      "#,,.,,.,,.,,,#",
      "#h###h..##hh,#",
      "S,,.,,,.,,.,,B",
      "#h###h..#.hh,#",
      "S,,.,,..,.,,,#",
      "##############",
    ],
    sainte: [  // WL-07: the farm in the centre, seen end on: they come down from the north by two lanes either side of the farm, and there is a point at the foot of each.
               // The horse rides the outer column of each lane (x=2, x=11); the gun (W, bottom right) fires west along the cross road (y=5) in front of both points.
               // The farm's yard is ours at first. Its north gate (D at (6,1) and (7,1)) breaks at 100 s, and then the yard becomes a third lane that comes out on the cross
               // road between the two points
      "###S##S###S###",
      "#h,,##DD##,,h#",
      "#,.,#h.,h#,.,S",
      "#,..h#..#h..,#",
      "#h..#h,,h#..h#",
      "#,..,,..,,...W",
      "#h,,#h##h#,,h#",
      "###B######B###",
    ],
    ridge: [   // WL-08: the ridge. Three roads east to west and a double point; the crest runs down column 4. The gun (W) fires along the upper centre row (y=3) and its shot
               // stops at the crest; the horse rides the outer rows (y=1, y=6) from end to end. The Emperor's post is the gun's own muzzle square (12,3)
      "##h##h##h#####",
      "#h,.,.,,.,,.,S",
      "#,,.,.,,.,,.,#",
      "B..,,.,,,.,,.W",
      "B,.,,.,,.,,.,S",
      "##,h##.h##h#,#",
      "##,.,..,.,,.,S",
      "###h###h######",
    ],
    palace: [  // WL-09: the palace court at night. The court runs round the dry fountain in the middle; two lamps stand on the fountain's ends, a third on the south wall.
               // The palace door in the north, two gates in the east, the point in the west
      "#######S######",
      "#h.,,.,,.,,.,#",
      "#,,.,h##h,.,,S",
      "#,..F####F.,,#",
      "B,,.,h##h,.,,S",
      "#h,.,,..,.,.,#",
      "#######F######",
    ],
  };
  const W1 = (list) => { const w = []; for (const [t, type, s, n = 1, gap = 0, o] of list) for (let i = 0; i < n; i++) w.push(o ? [t + i * gap, type, s, Array.isArray(o) ? o[i % o.length] : o] : [t + i * gap, type, s]); return w.sort((a, b) => a[0] - b[0]); };
  // parked for a later stage: 유진's IM-01 as it was played (map MAP_C2.mudYujin; gates 0 top-left, 1 the hounds' gate, 2 middle-left, 3 bottom-left)
  const PARKED_IM01_YUJIN = () => ({ map: MAP_C2.mudYujin, startCost: 14, mul: { hp: 0.68, atk: 0.86, def: 0.65 }, wind: { dir: 3, first: 22, every: 36, dur: 16 },
    waves: (() => { const BOT = { via: [[10, 6]] }; return W1([[4, "strag", 0, 3, 1.5], [8, "frosthound", 1, 1], [12, "rebel", 2, 3, 2], [18, "strag", 3, 3, 1.5], [24, "frosthound", 1, 2, 1.6],
      [30, "rebel", 0, 4, 1.6], [36, "strag", 3, 4, 1.2, BOT], [44, "scout", 2, 2, 1.4], [50, "frosthound", 1, 3, 1.5], [56, "rebel", 3, 4, 1.4], [62, "soldier", 0, 2, 3],
      [68, "strag", 2, 5, 0.9], [74, "frosthound", 1, 3, 1.3], [80, "scout", 3, 3, 1.1, BOT], [86, "rebel", 0, 5, 1.1], [92, "soldier", 3, 2, 3],
      [98, "frosthound", 1, 4, 1.2], [104, "rebel", 2, 4, 1.2], [106, "strag", 3, 4, 1, BOT]]); })() });
  void PARKED_IM01_YUJIN;
  const UP = { via: [[2, 0], [4, 0]] }, DOWN = { via: [[2, 4], [5, 4]] };
  const RANGED_AIM = 0.7, RANGED_HOLD = 0.35;   // how long a rifleman stands with his sights up before each shot, and stays put after it
  const AIR_DROP = { hover: 2.2, lead: 0.5, gap: 0.45 };   // an airship's stop: how long it holds, when the first man goes, the gap between men
  // BL-06: the ones the first airships already set down before the operation opens, each on the mud beside a place to stand
  const GARRISON6 = [[8, 1, "shield"], [9, 1, "hexer"], [5, 2, "shield"], [6, 4, "shield"], [4, 4, "hexer"], [10, 4, "shield"], [9, 4, "hexer"]];
  // BL-06's airship runs: the stops on each crossing, [where, who, how many] — each stop sits beside a place to stand
  const AIR = { a: { drops: [[[8, 1], "shield", 1], [[9, 3], "hexer", 1]] }, b: { drops: [[[5, 2], "shield", 1], [[4, 4], "hexer", 1]] },
    c: { drops: [[[6, 4], "shield", 1], [[9, 3], "hexer", 1]] }, e: { drops: [[[5, 2], "hexer", 1], [[8, 1], "shield", 1]] } };
  const LAND = [{ land: [9, 1], drop: "soldier" }, { land: [2, 2], drop: "dog" }, { land: [7, 4], drop: "soldier" }];
  // ---------- the supply operations' own boards ----------
  // "*" is open ground anyone may stand on; a board may hold several defence points (each lane its own)
  const MAP_FARM = {
    // 탄약 집적소 (vanguards, snipers): two long ground lanes that meet just before the gate, high ground everywhere else,
    // and two gates in the corners that only fliers use. Little cost at the start and fast feet early: vanguards pay for the rest
    am: [
      "S##hhhhhhhh##",
      "###hhhhhhhhh#",
      "S..........h#",
      "hhhhh.hhhh..B",
      "S..........h#",
      "###hhhhhhhhh#",
      "S##hhhhhhhh##",
    ],
    // 야전 병원 (defenders, medics): two corridors of nothing but ground, riflemen shooting down them; three perches in the wall between
    fh: [
      "S..........h#",
      "#h##h###h#..B",
      "S..........h#",
    ],
    // 기병 막사 (guards, specialists): an open stable yard of bare ground, three gates, two perches; cavalry and crowds come straight at you
    cb: [
      "S.....##....",
      "....h.##....",
      "S..........B",
      "....h.##....",
      "S.....##....",
    ],
    // 기록 보관소 (casters, supporters): two lanes walled by shelves you can stand on; armour that shrugs off blades, and runners
    ar: [
      "#hhhhhhhhh##",
      "S..........B",
      "#hh#hh#hh#.#",
      "S..........#",
      "#hhhhhhhhh##",
    ],
    // 자재 야적장: the yard's entrance, its crane lanes, and the girder stacks deep inside
    bm1: [
      "S...hhh....",
      "....hhh.hh.",
      "..........B",
      "..hh..hhh..",
      "S.hh..hhh..",
    ],
    bm2: [
      "S,,..hhh....",
      "....hhhh..h.",
      "S,,.......hB",
      "....hhhh..h.",
      "S,,..hhh....",
    ],
    bm3: [
      "S,..hhh..hh..",
      "...hhhhh.hh..",
      "..h......h...",
      "S,...hh.....B",
      "..h......h...",
      "...hhhhh.hh..",
      "S,..hhh..hh..",
    ],
    // 무너진 환전소: straight lanes, each to its own gate, all open ground (near or far, anyone stands anywhere)
    cn3: [
      "B*********S",
      "##*##*##*##",
      "B*********S",
      "##*##*##*##",
      "B*********S",
    ],
    cn5: [
      "B*********S",
      "B*********S",
      "B*********S",
      "B*********S",
      "B*********S",
    ],
    cn7: [
      "B**********S",
      "B**********S",
      "B**********S",
      "B**********S",
      "B**********S",
      "B**********S",
      "B**********S",
    ],
  };
  // one wave entry per lane: lanes(t, type, [lane, ...], n, gap, opts)
  const LANES = (t, type, ls, n = 1, gap = 0, o) => ls.map((l, k) => [t + k * 0.6, type, l, n, gap, o]);
  // a drone from a lane's gate that sets its man down near that lane's defence point
  const DROP = (t, lane, x, type) => [t, "drone", lane, 1, 0, { land: [x, -1], lane, drop: type }];   // the row is filled in from the board
  // standing on the lane when the operation opens, walking once the clock passes `until`
  const PRE = (lane, type, adv, until) => [0, type, lane, 1, 0, { pre: { adv, until } }];
  const FARM = {
    AM: { n: "탄약 집적소", map: "am", tiers: [
      { mul: { hp: 0.81, atk: 0.77, def: 0.9 }, startCost: 6, waves: [[3, "dog", 1, 3, 1], [5, "dog", 2, 3, 1], [12, "drone", 0, 2, 3], [16, "drone", 3, 2, 3], [22, "soldier", 1, 3, 2.5], [24, "soldier", 2, 3, 2.5],
        [34, "drone", 0, 3, 2], [36, "drone", 3, 3, 2], [44, "dog", 1, 4, 0.8], [46, "dog", 2, 4, 0.8], [54, "airship", 0, 1, 0, { drops: [[[5, 3], "soldier", 2]] }], [62, "drone", 3, 4, 1.5], [64, "drone", 0, 4, 1.5],
        [72, "hexer", 1, 2, 3], [74, "hexer", 2, 2, 3], [84, "drone", 0, 5, 1.2], [86, "drone", 3, 5, 1.2], [92, "dog", 1, 5, 0.7], [94, "dog", 2, 5, 0.7]],
        desc: "버려진 탄약 집적소. 선봉·저격 칩이 남아 있습니다. 시작 코스트가 적은데 사냥개가 일찍 달려오고, 구석의 두 입구로는 드론이 계속 넘어옵니다.", lose: "선봉으로 코스트를 벌고, 고지대마다 저격을 세워 드론을 떨어뜨리세요." },
      { mul: { hp: 0.75, atk: 0.62, def: 1.15 }, startCost: 6, waves: [[3, "dog", 1, 4, 0.9], [4, "dog", 2, 4, 0.9], [10, "drone", 0, 3, 2], [12, "drone", 3, 3, 2], [20, "soldier", 1, 4, 2], [22, "soldier", 2, 4, 2],
        [30, "airship", 0, 1, 0, { drops: [[[5, 3], "shield", 1], [[7, 2], "soldier", 1]] }], [34, "drone", 3, 4, 1.5], [40, "dog", 1, 5, 0.7], [42, "dog", 2, 5, 0.7], [50, "airship", 3, 1, 0, { drops: [[[5, 3], "shield", 1], [[7, 4], "soldier", 1]] }],
        [56, "drone", 0, 5, 1.2], [58, "drone", 3, 5, 1.2], [66, "hexer", 1, 3, 2.5], [68, "hexer", 2, 3, 2.5], [76, "airship", 0, 1, 0, { drops: [[[5, 3], "heavy", 1]] }], [82, "drone", 0, 6, 1], [84, "drone", 3, 6, 1],
        [90, "dog", 1, 6, 0.6], [92, "dog", 2, 6, 0.6], [100, "airship", 3, 1, 0, { drops: [[[7, 2], "shield", 1], [[7, 4], "shield", 1]] }]],
        desc: "탄약 집적소 깊은 곳. 선봉·저격 칩 팩이 보관되어 있습니다. 비행선이 방패병과 척탄병을 길 한가운데 내려놓습니다.", lose: "비행선은 내리기 전에 저격 여럿으로 떨어뜨려야 합니다. 선봉으로 코스트를 일찍 확보하세요." } ] },
    FH: { n: "야전 병원", map: "fh", tiers: [
      { mul: { hp: 0.45, atk: 1.12, def: 0.9 }, deployLimit: 7, waves: [[4, "soldier", 0, 3, 2.5], [6, "soldier", 1, 3, 2.5], [16, "hexer", 0, 2, 3], [18, "hexer", 1, 2, 3], [28, "hound", 0, 2, 2], [30, "hound", 1, 2, 2],
        [40, "shooter", 0, 3, 2], [42, "shooter", 1, 3, 2], [52, "heavy", 0], [54, "soldier", 1, 4, 2], [64, "hexer", 0, 3, 2], [66, "hexer", 1, 3, 2], [76, "hound", 0, 3, 1.5], [78, "heavy", 1], [88, "shooter", 0, 4, 1.5], [90, "shooter", 1, 4, 1.5]],
        desc: "무너진 야전 병원. 중장·의무 칩이 남아 있습니다. 서 있을 고지대가 거의 없는 두 복도로, 척후병과 엽총수가 멀리서 쏘며 다가옵니다.", lose: "두 복도 모두 중장으로 막고, 의무로 버티게 하세요. 고지대는 세 칸뿐입니다." },
      { mul: { hp: 0.83, atk: 0.97, def: 1.15 }, deployLimit: 7, waves: [[4, "hound", 0, 2, 2], [5, "hound", 1, 2, 2], [12, "hexer", 0, 3, 2.5], [14, "hexer", 1, 3, 2.5], [24, "heavy", 0], [26, "shooter", 1, 4, 1.6],
        [36, "hound", 0, 3, 1.4], [38, "hound", 1, 3, 1.4], [48, "shooter", 0, 4, 1.4], [50, "heavy", 1], [60, "hexer", 0, 4, 1.8], [62, "hexer", 1, 4, 1.8], [72, "heavy", 0], [74, "heavy", 1],
        [82, "hound", 0, 4, 1.2], [84, "hound", 1, 4, 1.2], [94, "shooter", 0, 5, 1.2], [96, "shooter", 1, 5, 1.2]],
        desc: "야전 병원 지하 창고. 중장·의무 칩 팩이 보관되어 있습니다. 흉갑기병과 척탄병이 복도를 밀고, 뒤에서는 총탄이 쏟아집니다.", lose: "막는 중장이 버티지 못하면 끝입니다. 의무를 둘 이상, 중장을 두 복도에 하나씩." } ] },
    CB: { n: "기병 막사", map: "cb", tiers: [
      { mul: { hp: 1.44, atk: 1.36, def: 0.9 }, waves: [[4, "rebel", 0, 4, 0.8], [6, "rebel", 2, 4, 0.8], [14, "scout", 1, 3, 1], [22, "hound", 0, 2, 2], [24, "hound", 2, 2, 2], [32, "rebel", 1, 6, 0.6],
        [40, "scout", 0, 3, 0.8], [42, "scout", 2, 3, 0.8], [50, "hound", 1, 3, 1.5], [58, "rebel", 0, 6, 0.5], [60, "rebel", 2, 6, 0.5], [70, "hound", 0, 3, 1.2], [72, "hound", 2, 3, 1.2], [82, "scout", 1, 5, 0.6]],
        desc: "텅 빈 기병 막사. 근위·특수 칩이 남아 있습니다. 고지대가 두 칸뿐인 맨땅 마당으로, 기병과 농민 무리가 세 입구에서 몰려옵니다.", lose: "땅 위에서 직접 베어 낼 근위가 필요합니다. 빠른 척후기병은 입구 가까이서 끊으세요." },
      { mul: { hp: 1.59, atk: 1.43, def: 1.15 }, waves: [[3, "scout", 0, 3, 0.8], [4, "scout", 2, 3, 0.8], [10, "hound", 1, 3, 1.5], [18, "rebel", 0, 6, 0.5], [20, "rebel", 2, 6, 0.5], [30, "hound", 0, 3, 1.2], [32, "hound", 2, 3, 1.2],
        [42, "scout", 1, 5, 0.6], [50, "heavy", 1], [52, "rebel", 0, 8, 0.4], [54, "rebel", 2, 8, 0.4], [64, "hound", 0, 4, 1], [66, "hound", 2, 4, 1], [76, "scout", 0, 4, 0.6], [78, "scout", 2, 4, 0.6], [86, "hound", 1, 5, 0.9]],
        desc: "기병 막사의 마구간. 근위·특수 칩 팩이 보관되어 있습니다. 흉갑기병이 쉼 없이 돌격합니다.", lose: "흉갑기병은 단단하고 빠릅니다. 근위를 여럿, 저지가 높은 자리부터." } ] },
    AR: { n: "기록 보관소", map: "ar", tiers: [
      { mul: { hp: 0.63, atk: 0.59, def: 1 }, waves: [[4, "shield", 0, 2, 3], [6, "dog", 1, 3, 1], [16, "heavy", 0], [20, "dog", 1, 4, 0.8], [28, "shield", 1, 2, 3], [34, "scout", 0, 3, 0.8],
        [44, "heavy", 1], [46, "shield", 0, 2, 2.5], [56, "dog", 0, 5, 0.7], [58, "scout", 1, 4, 0.7], [68, "heavy", 0], [70, "heavy", 1], [80, "dog", 0, 5, 0.6], [82, "dog", 1, 5, 0.6]],
        desc: "불탄 기록 보관소. 술사·보조 칩이 남아 있습니다. 칼이 잘 들지 않는 방패병과 척탄병 사이로 사냥개가 내달립니다.", lose: "방패병과 척탄병은 술사의 마법으로, 사냥개와 척후기병은 감속자로 늦춰 잡으세요." },
      { mul: { hp: 0.94, atk: 0.81, def: 1.2 }, waves: [[4, "shield", 0, 2, 3], [6, "dog", 1, 3, 1], [16, "shield", 1, 2, 3], [22, "dog", 0, 3, 0.8], [30, "heavy", 0], [34, "scout", 1, 3, 0.7], [42, "heavy", 1], [44, "shield", 0, 2, 2.5],
        [54, "dog", 0, 4, 0.6], [56, "dog", 1, 4, 0.6], [64, "heavy", 0], [66, "shield", 1, 3, 2], [76, "scout", 0, 4, 0.6], [78, "scout", 1, 4, 0.6], [86, "heavy", 0], [87, "heavy", 1], [92, "dog", 0, 5, 0.5], [94, "dog", 1, 5, 0.5]],
        desc: "기록 보관소 서고. 술사·보조 칩 팩이 보관되어 있습니다. 척탄병이 둘씩, 그 사이로 발 빠른 것들이 섞여 옵니다.", lose: "물리 공격은 거의 통하지 않습니다. 술사를 여럿, 감속자로 시간을 버세요." } ] },
    BM: { n: "자재 야적장", tiers: [
      { map: "bm1", mul: { hp: 1.0, atk: 1.1, def: 0.5 }, waves: [[4, "strag", 0, 4, 0.9], [6, "strag", 1, 4, 0.9], [16, "soldier", 0, 2, 3], [24, "strag", 1, 6, 0.6], [32, "soldier", 1, 3, 2], [40, "strag", 0, 6, 0.5], [44, "hexer", 1, 1], [52, "strag", 0, 6, 0.5], [54, "strag", 1, 6, 0.5]],
        desc: "자재 야적장 입구. 보강 자재가 쌓여 있습니다. 낙오병이 무더기로 넘어옵니다.", lose: "여럿을 한꺼번에 때리는 공격으로 쓸어 내세요." },
      { map: "bm1", mul: { hp: 1.65, atk: 1.76, def: 0.8 }, waves: [[4, "strag", 0, 5, 0.7], [6, "strag", 1, 5, 0.7], [14, "soldier", 0, 3, 2], [22, "hexer", 1, 2, 3], [28, "strag", 0, 8, 0.5], [30, "strag", 1, 8, 0.5], [40, "heavy", 0], [46, "soldier", 1, 4, 1.6], [56, "strag", 0, 8, 0.4], [58, "strag", 1, 8, 0.4], [64, "soldier", 0, 3, 1.5]],
        desc: "자재 야적장 입구. 보강 자재가 쌓여 있습니다. 낙오병 무리 뒤로 척탄병이 따라옵니다.", lose: "척탄병은 술사의 마법으로." },
      { map: "bm2", mul: { hp: 0.63, atk: 0.63, def: 1.0 }, waves: [[4, "strag", 0, 6, 0.6], [5, "strag", 2, 6, 0.6], [12, "soldier", 1, 4, 1.8], [22, "drone", 1, 2, 2], [26, "heavy", 0], [30, "strag", 2, 8, 0.4], [40, "hexer", 1, 3, 2], [48, "strag", 0, 8, 0.4], [50, "strag", 2, 8, 0.4], [58, "heavy", 2], [62, "soldier", 1, 5, 1.4], [72, "strag", 1, 10, 0.35]],
        desc: "크레인 구역. 보강 자재와 강화 골조가 섞여 있습니다. 세 입구 앞은 진창이라 설 수 없습니다.", lose: "세 갈래가 모이는 가운데를 두텁게 막으세요." },
      { map: "bm2", mul: { hp: 0.55, atk: 0.48, def: 1.1 }, waves: [[3, "strag", 0, 8, 0.5], [4, "strag", 2, 8, 0.5], [12, "soldier", 1, 5, 1.5], [20, "heavy", 0], [22, "heavy", 2], [30, "drone", 1, 3, 1.5], [36, "strag", 1, 10, 0.35], [44, "hexer", 0, 3, 2], [46, "hexer", 2, 3, 2], [56, "heavy", 1], [58, "soldier", 0, 5, 1.2], [60, "soldier", 2, 5, 1.2], [70, "strag", 0, 10, 0.3], [72, "strag", 2, 10, 0.3]],
        desc: "크레인 구역. 강화 골조가 쌓여 있습니다. 척탄병이 양쪽 입구에서 동시에 들어옵니다.", lose: "척탄병 둘을 동시에 받을 술사가 필요합니다." },
      { map: "bm3", mul: { hp: 0.71, atk: 0.57, def: 1.2 }, waves: [[3, "strag", 0, 8, 0.45], [4, "strag", 2, 8, 0.45], [10, "soldier", 1, 5, 1.4], [18, "drone", 1, 2, 2, { land: [8, 3], drop: "shield" }], [24, "heavy", 0], [26, "heavy", 2], [34, "strag", 1, 12, 0.3],
        [42, "hexer", 0, 3, 1.8], [44, "hexer", 2, 3, 1.8], [52, "drone", 1, 2, 2, { land: [8, 3], drop: "heavy" }], [58, "soldier", 0, 6, 1.1], [60, "soldier", 2, 6, 1.1], [70, "heavy", 1], [72, "strag", 0, 12, 0.28], [74, "strag", 2, 12, 0.28]],
        desc: "철골 더미 안쪽. 강화 골조가 많이 남아 있습니다. 드론이 야적장 한복판에 병력을 내려놓습니다.", lose: "가운데 착지 지점 곁을 먼저 차지해 두세요." },
      { map: "bm3", mul: { hp: 0.93, atk: 0.65, def: 1.35 }, waves: [[3, "strag", 0, 10, 0.4], [4, "strag", 2, 10, 0.4], [10, "soldier", 1, 6, 1.2], [16, "drone", 1, 3, 1.5, { land: [8, 3], drop: "shield" }], [22, "heavy", 0], [24, "heavy", 2], [30, "hound", 1, 4, 1], [36, "strag", 1, 14, 0.25],
        [44, "hexer", 0, 4, 1.5], [46, "hexer", 2, 4, 1.5], [52, "drone", 1, 3, 1.5, { land: [8, 3], drop: "heavy" }], [60, "heavy", 0], [61, "heavy", 2], [64, "soldier", 1, 8, 0.9], [74, "strag", 0, 14, 0.25], [76, "strag", 2, 14, 0.25], [80, "heavy", 1]],
        desc: "철골 더미 안쪽 깊은 곳. 강화 골조가 가장 많이 남아 있습니다. 척탄병이 셋, 하늘에서도 내려옵니다.", lose: "척탄병이 몰리기 전에 낙오병 무리를 범위 공격으로 정리하세요." } ] },
    CN: { n: "무너진 환전소", tiers: [
      { map: "cn3", mul: { hp: 0.5, atk: 0.55, def: 0.45 }, waves: [PRE(1, "shield", 4, 22), ...LANES(4, "soldier", [0, 2], 2, 3), [16, "shield", 1, 1], ...LANES(26, "soldier", [0, 1, 2], 2, 2.5), [36, "heavy", 0], DROP(42, 2, 3, "soldier"), ...LANES(48, "shield", [1, 2], 1),
        [58, "heavy", 2], DROP(62, 0, 3, "soldier"), ...LANES(68, "soldier", [0, 1, 2], 3, 2)],
        desc: "무너진 환전소의 금고 복도. 주화가 흩어져 있습니다. 세 줄의 복도 끝마다 방어 지점이 있고, 칸마다 근거리·원거리 누구든 설 수 있습니다.", lose: "줄마다 막을 자리를 하나씩. 척탄병과 방패병은 술사의 마법으로." },
      { map: "cn3", mul: { hp: 0.55, atk: 0.6, def: 0.75 }, waves: [PRE(1, "heavy", 4, 24), ...LANES(4, "soldier", [0, 2], 2, 2.5), [14, "shield", 1], DROP(22, 0, 3, "soldier"), ...LANES(28, "shield", [0, 2], 1, 3), [38, "heavy", 0],
        DROP(42, 2, 3, "soldier"), DROP(44, 1, 3, "soldier"), ...LANES(50, "soldier", [0, 1, 2], 3, 1.8), [60, "heavy", 2], DROP(66, 1, 2, "shield"), ...LANES(72, "shield", [0, 1, 2], 1), [80, "heavy", 1]],
        desc: "무너진 환전소의 금고 복도. 주화가 흩어져 있습니다. 척탄병이 시작부터 복도에 서 있습니다.", lose: "처음부터 서 있는 척탄병이 움직이기 전에 술사를 깔아 두세요." },
      { map: "cn5", deployLimit: 9, mul: { hp: 0.75, atk: 0.75, def: 1.0 }, waves: [PRE(2, "heavy", 4, 30), ...LANES(4, "soldier", [1, 3], 2, 3), [14, "shield", 2], ...LANES(24, "soldier", [0, 4], 2, 3), DROP(30, 2, 3, "soldier"), ...LANES(38, "shield", [1, 3], 1),
        [46, "heavy", 0], [48, "heavy", 4], DROP(52, 1, 2, "soldier"), DROP(54, 3, 2, "soldier"), ...LANES(60, "soldier", [0, 1, 2, 3, 4], 2, 2), [72, "heavy", 2], DROP(76, 0, 3, "heavy"), ...LANES(84, "shield", [0, 2, 4], 1), ...LANES(90, "soldier", [1, 3], 3, 1.5)],
        desc: "환전소 대금고. 주화가 쌓여 있습니다. 다섯 줄의 복도 끝마다 방어 지점이 있습니다.", lose: "가운데 줄부터 막고, 원거리를 줄 사이에 세워 두 줄을 함께 보게 하세요." },
      { map: "cn5", deployLimit: 9, mul: { hp: 0.38, atk: 0.35, def: 1.1 }, waves: [PRE(2, "heavy", 4, 26), PRE(0, "shield", 5, 34), ...LANES(4, "soldier", [1, 3], 2, 2.5), [12, "shield", 2, 1], DROP(20, 2, 2, "soldier"), ...LANES(26, "shield", [0, 4], 1), ...LANES(32, "soldier", [1, 3], 2, 2),
        DROP(40, 1, 3, "shield"), DROP(42, 3, 3, "shield"), ...LANES(48, "heavy", [0, 4], 1), ...LANES(56, "soldier", [0, 1, 2, 3, 4], 2, 1.6), DROP(64, 2, 2, "heavy"), ...LANES(70, "shield", [1, 3], 2, 2), ...LANES(80, "heavy", [0, 2, 4], 1), ...LANES(88, "soldier", [0, 4], 3, 1.2)],
        desc: "환전소 대금고 안쪽. 주화가 많이 쌓여 있습니다. 척탄병이 시작부터 복도를 막고 있고, 드론이 방어 지점 코앞에 병력을 내립니다.", lose: "방어 지점 바로 앞 칸을 비워 두지 마세요. 착륙한 적은 거기서 바로 걸어 들어옵니다." },
      { map: "cn7", deployLimit: 10, mul: { hp: 0.81, atk: 0.72, def: 1.2 }, waves: [PRE(3, "heavy", 4, 30), ...LANES(4, "soldier", [2, 4], 2, 3), [12, "shield", 3], ...LANES(22, "soldier", [1, 5], 2, 2.5), DROP(28, 3, 2, "shield"), ...LANES(36, "shield", [2, 4], 1),
        ...LANES(44, "soldier", [0, 6], 2, 2.5), ...LANES(50, "heavy", [1, 5], 1), DROP(56, 2, 2, "soldier"), DROP(58, 4, 2, "soldier"), ...LANES(64, "soldier", [0, 1, 2, 3, 4, 5, 6], 2, 1.8), ...LANES(76, "heavy", [0, 3, 6], 1),
        DROP(82, 1, 2, "heavy"), DROP(84, 5, 2, "heavy"), ...LANES(92, "shield", [1, 2, 4, 5], 1), ...LANES(98, "soldier", [0, 3, 6], 3, 1.4)],
        desc: "환전소 지하 금고. 주화가 가득합니다. 일곱 줄의 복도 끝마다 방어 지점이 있습니다.", lose: "줄 사이 칸의 원거리 하나가 세 줄을 봅니다. 근거리는 척탄병이 나오는 줄부터." },
      { map: "cn7", deployLimit: 10, mul: { hp: 0.88, atk: 0.76, def: 1.35 }, waves: [PRE(3, "heavy", 4, 26), PRE(1, "shield", 5, 36), PRE(5, "shield", 5, 36), ...LANES(4, "soldier", [2, 4], 3, 2.5), [12, "heavy", 3], ...LANES(20, "soldier", [1, 5], 2, 2.2), DROP(26, 3, 2, "heavy"),
        ...LANES(34, "shield", [2, 3, 4], 1), ...LANES(42, "soldier", [0, 6], 3, 2), ...LANES(48, "heavy", [1, 5], 1), DROP(54, 2, 2, "shield"), DROP(56, 4, 2, "shield"), ...LANES(62, "soldier", [0, 1, 2, 3, 4, 5, 6], 2, 1.6),
        ...LANES(74, "heavy", [0, 2, 4, 6], 1), DROP(80, 1, 2, "heavy"), DROP(82, 5, 2, "heavy"), ...LANES(90, "shield", [0, 1, 5, 6], 2, 2), ...LANES(98, "heavy", [3], 1), ...LANES(100, "soldier", [1, 2, 4, 5], 3, 1.2)],
        desc: "환전소 지하 금고 가장 깊은 곳. 주화가 산더미입니다. 척탄병이 시작부터 서 있고, 하늘에서도 계속 내려옵니다.", lose: "척탄병을 녹일 술사 여럿과, 착륙 지점 앞을 지킬 근거리가 필요합니다." } ] },
  };
  const FARM_LEAD = 8;
  const FARM_HARD = 1.25;   // over the scripted test squad's limit: a person plays the board better than the script does   // seconds of quiet before the first wave, to get a line down
  const FARM_STAGES = [], FARM_START = { AM: 8, FH: 20, CB: 16, AR: 20, BM: 16, CN: 18 };   // the cost a supply operation opens with
  for (const site of ["AM", "FH", "CB", "AR", "BM", "CN"]) FARM[site].tiers.forEach((t, k) => {
    const map = MAP_FARM[t.map || FARM[site].map], gates = []; map.forEach((r, y) => [...r].forEach((c, x) => { if (c === "S") gates.push([x, y]); }));
    for (const w of t.waves) { const o = w[5]; if (o && o.land && o.land[1] < 0) o.land = [o.land[0], gates[o.lane][1]]; }
    FARM_STAGES.push(Object.assign({ code: `${site}-${k + 1}`, name: FARM[site].n, supply: site, tier: k + 1, map, bg: null, hz: 0.5, boss: ["", ""], startCost: site === "CN" ? [18, 18, 25, 25, 30, 30][k] : FARM_START[site] + (FARM[site].tiers.length === 2 && k === 1 ? 6 : 0),
      costRate: (site === "CN" && k >= 2) || (FARM[site].tiers.length === 2 && k === 1) ? 1.3 : undefined }, t, { map, mapKey: t.map || FARM[site].map, mul: { hp: t.mul.hp * FARM_HARD, atk: t.mul.atk * FARM_HARD, def: t.mul.def }, waves: W1(t.waves.map((w) => w[0] > 0 ? [w[0] + FARM_LEAD, ...w.slice(1)] : w)) }));
  });

  // ---- lab L5: the stored record of the last attempt at an echo stage. In the browser it is localStorage under the stage's key; headless (no localStorage) a plain object on the
  // global. A storage that throws reads as no record (the stage falls back to its seed) and a failed write is dropped, without an error
  const ECHO_MEM = root.__labEcho || (root.__labEcho = {});
  const echoLS = () => { try { return typeof root.localStorage !== "undefined" ? root.localStorage : null; } catch (e) { return undefined; } };
  function echoGet(key) { const ls = echoLS(); if (ls === undefined) return null; try { const v = ls ? ls.getItem(key) : ECHO_MEM[key]; return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function echoSet(key, rec) { const ls = echoLS(); if (ls === undefined) return false; try { const v = JSON.stringify(rec); if (ls) ls.setItem(key, v); else ECHO_MEM[key] = v; return true; } catch (e) { return false; } }
  function echoClear(key) { const ls = echoLS(); if (ls === undefined) return false; try { if (ls) ls.removeItem(key); else delete ECHO_MEM[key]; return true; } catch (e) { return false; } }
  // ---- the lab (실험실): rough prototype stages for trying new systems. They sit at the very end of STAGES, are marked lab, and appear only in the lab menu ----
  const LAB_STAGES = [
    // LAB-00 「버티기」: the farm board (WL-06's), turned into a hold-out. Yui stands in the farm lane and walks three squares east at 40 s; the lane's soldiers and the lancer make
    // for her, the south field's soldiers for the nearest of ours, and the north field's hounds run for the point, where each one adds to the panic gauge instead of costing life.
    // Gates: 0 the north field, 1 the farm lane, 2 the south field. The waves of the first 30 s come again every 30 s, a little stronger each time
    { code: "LAB-00", name: "버티기", lab: true, map: MAP_C3.farm, bg: null, hz: 0.5, startCost: 20, mul: { hp: 0.8, atk: 0.9, def: 0.85 },
      goal: { win: [{ k: "time", t: 90 }], lose: [{ k: "vipDead" }, { k: "meter", id: "panic", op: ">=", v: 6 }],
        text: { win: "유이가 90초 동안 버틴다.", lose: "유이가 쓰러지거나, 적 여섯이 동쪽 끝에 닿는다." }, hud: [{ vip: true }, { meter: "panic" }, { time: 90 }] },
      meters: { panic: { v: 0, min: 0, max: 6, label: "동요" } },
      vip: { name: "유이", hp: 6000, def: 100, at: [7, 4], sprite: "yui", route: [{ to: [10, 4], wait: 40 }], speed: 0.6 },
      loop: { from: 0, period: 30, grow: 0.15 },
      waves: W1([[4, "soldier", 1, 3, 2, { aim: "vip" }], [10, "dog", 0, 3, 1.5, { leak: { meter: "panic", by: 1 } }], [18, "soldier", 2, 2, 2, { aim: "unit" }], [24, "lancer", 1, 1, 0, { aim: "vip" }]]),
      boss: ["", ""], desc: "농장 안길 한가운데에 유이가 서 있습니다. 농장 안길의 병사와 창병은 유이를 노리고, 남쪽 들판의 병사는 가장 가까운 가사인격을 노립니다. 북쪽 들판의 사냥개가 동쪽 끝에 닿으면 동요가 1 오릅니다. 40초에 유이가 동쪽으로 세 칸 걸어갑니다. 적은 30초마다 조금 더 강해져서 다시 옵니다.",
      lose: "농장 안길 서쪽에서 병사를 막고, 북쪽 들판의 사냥개는 고지에서 쏘아 쓰러뜨리세요." },
    // LAB-01 「지붕 위」 (chapter 4 prototype): three roofs over night air, joined by smoke bridges. One of ours beside a chimney cuts its bridge; Yui needs a bridge too.
    // Every foe makes for her; stranded on its roof it leaps across after 30 s. Gates: 0 (12,1), 1 (13,4). B (0,3) is only Yui's doorway: nothing aims at it.
    // Every time below is the spec's plus 15 s (the safe opening of the lab's second addendum)
    { code: "LAB-01", name: "지붕 위", lab: true, bg: null, hz: 0.5, startCost: 22, mul: { hp: 0.8, atk: 0.9, def: 0.85 },
      map: ["##############",
            "#h.C__h.C__hS#",
            "#,,,^^,.,^^,,#",
            "B,.,__.,.__.,#",
            "#,.,__,.,__,,S",
            "#,,,^^,,,^^,,#",
            "#h.C__h.C__h,#",
            "##############"],
      chimneys: [{ at: [3, 1], bridge: [[4, 2], [5, 2]] }, { at: [3, 6], bridge: [[4, 5], [5, 5]] }, { at: [8, 1], bridge: [[9, 2], [10, 2]] }, { at: [8, 6], bridge: [[9, 5], [10, 5]] }],
      leap: { after: 30, warn: 5, dur: 3, retry: 5 },
      vip: { name: "유이", hp: 7000, def: 120, at: [1, 3], sprite: "yui", route: [{ to: [7, 3], wait: 45 }, { to: [11, 3], wait: 45 }, { to: [12, 6], wait: 20 }], speed: 0.6 },
      goal: { win: [{ k: "vipAt", at: [12, 6] }], lose: [{ k: "vipDead" }], text: { win: "유이가 동쪽 지붕 끝까지 건너간다. 적은 끝없이 온다.", lose: "유이가 쓰러진다." }, hud: [{ vip: true }] },
      loop: { from: 15, period: 60, grow: 0.12 },
      waves: W1([[20, "soldier", 1, 2, 2, { aim: "vip" }], [29, "dog", 0, 2, 1.5, { aim: "vip" }], [39, "soldier", 0, 3, 1.6, { aim: "vip" }], [47, "sweep", 1, 1, 0, { aim: "vip" }],
        [55, "lancer", 1, 1, 0, { aim: "vip" }], [63, "soldier", 1, 3, 1.5, { aim: "vip" }], [71, "chasseur", 0, 1, 0, { aim: "vip" }]]),
      boss: ["", ""], desc: "지붕 셋. 굴뚝 옆 칸에 서면 그 굴뚝이 내는 연기 다리가 4초 뒤 끊기고, 떠나면 6초 뒤 다시 이어집니다. 유이도 다리가 있어야 건넙니다.",
      lose: "다리를 전부 끊으면 적이 30초 뒤 뛰어서 건넙니다. 유이가 건널 다리 하나만 열고 그 앞을 막으세요. 굴뚝 청소부는 막은 굴뚝을 뚫으러 옵니다." },
    // LAB-02 「네 박자」 (chapter 5 prototype): foes hop one square per beat. Two zones, each with its metronome: one of ours beside it slows the zone (and our own attacks in
    // it), a baton beside it speeds it up. Gates 0 (0,2), 1 (0,4); points (13,2), (13,4). Every foe that reaches a point, and every fall of ours, adds 1 to the noise gauge.
    // Every time below is the spec's plus 15 s
    { code: "LAB-02", name: "네 박자", lab: true, bg: null, hz: 0.5, startCost: 22, mul: { hp: 0.85, atk: 0.9, def: 0.85 },
      map: ["##############",
            "#h.M#h..h#M.h#",
            "S,,.,,.,,.,,,B",
            "#,.,,R,.,R.,,#",
            "S,.,,.,,.,,.,B",
            "#h..#h..h#..h#",
            "##############"],
      beat: { base: 1.4, zones: [{ id: "A", x0: 1, x1: 6, metronome: [3, 1] }, { id: "B", x0: 7, x1: 12, metronome: [10, 1] }] },
      meters: { noise: { v: 0, min: 0, max: 8, label: "불협" } }, fallMeter: { meter: "noise", by: 1 },
      goal: { win: [{ k: "time", t: 165 }], lose: [{ k: "meter", id: "noise", op: ">=", v: 8 }],
        text: { win: "곡이 끝날 때까지(165초) 불협을 8 아래로 지킨다.", lose: "적이 동쪽 끝에 닿거나 가사인격이 쓰러질 때마다 불협이 1 오른다. 8이면 끝." }, hud: [{ meter: "noise" }, { time: 165 }] },
      waves: (() => { const L = { leak: { meter: "noise", by: 1 } }; return W1([[19, "soldier", 0, 3, 2.8, L], [27, "soldier", 1, 3, 2.8, L], [37, "dog", 0, 3, 1.4, L], [45, "baton", 1, 1, 0, L], [51, "grenadier", 0, 1, 0, L],
        [59, "soldier", 1, 4, 2.8, L], [71, "lancer", 0, 2, 2.8, L], [79, "baton", 0, 1, 0, L], [85, "dog", 1, 4, 1.4, L], [95, "grenadier", 1, 1, 0, L], [101, "soldier", 0, 4, 1.4, L],
        [113, "chasseur", 1, 2, 2.8, L], [121, "baton", 1, 1, 0, L], [125, "lancer", 1, 2, 2.8, L], [135, "soldier", 0, 5, 1.4, L], [143, "grenadier", 0, 1, 0, L], [149, "dog", 1, 4, 1.4, L]]); })(),
      boss: ["", ""], desc: "적은 박자에만 한 칸씩 움직입니다. 메트로놈 옆 칸에 서면 그 구역이 느려집니다(우리 공격도 함께). 첫 박에 누른 스킬은 30% 더 갑니다.",
      lose: "서쪽 구역을 느리게 잡아 적을 오래 때리고, 지휘봉은 메트로놈에 닿기 전에 잡으세요. 쉼표 칸에 선 적은 다음 첫 박까지 멈춥니다." },
    // LAB-03 「거울의 방」 (chapter 6 prototype): the real room left of the glass, the room in the glass right of it. Each operator set down on the left sets a 60% image on the
    // mirrored square; the glass can be broken by grenadiers sent at it. Gates: 0 the glass room's (12,3), 1 the real room's (0,4); points (0,1) real, (12,1) glass.
    // The spec's map had each point walled in by the high ground beside it ("Bh"); the high ground and the square next to it are swapped ("B.h") so both points can be reached.
    // Every time below is the spec's plus 15 s
    { code: "LAB-03", name: "거울의 방", lab: true, bg: null, hz: 0.5, startCost: 24, mul: { hp: 0.8, atk: 0.9, def: 0.85 },
      map: ["#############",
            "B.h.,,|,,.h.B",
            "#,.,,.|.,,.,#",
            "#,,.,,|,,.,,S",
            "S,.,,.|.,,.,#",
            "#h.,,.|.,,.h#",
            "#############"],
      mirror: { x: 6, pct: 0.6, hp: 3000 },
      goal: { win: [{ k: "clear" }], lose: [{ k: "life" }], text: { win: "두 방의 적을 모두 막는다.", lose: "어느 방이든 방어 지점에 적이 닿아 목숨이 다한다." }, hud: [{ life: true }] },
      waves: (() => { const L = 1, R = 0, MI = { aim: "mirror" }; return W1([[20, "soldier", L, 2, 2], [23, "dog", R, 3, 1.4], [33, "soldier", R, 2, 2], [39, "chasseur", L, 1, 0], [45, "grenadier", R, 1, 0, MI],
        [53, "dog", L, 3, 1.3], [61, "lancer", R, 2, 2], [69, "soldier", L, 3, 1.5], [75, "grenadier", R, 1, 0, MI], [81, "soldier", R, 4, 1.4], [89, "grenadier", L, 1, 0], [97, "dog", R, 4, 1.2],
        [105, "lancer", L, 2, 2], [111, "soldier", R, 3, 1.4], [119, "chasseur", R, 2, 2], [125, "grenadier", L, 1, 0]]); })(),
      boss: ["", ""], desc: "거울 왼쪽에 가사인격을 세우면 거울 속 방의 같은 자리에 상(像)이 섭니다(능력치 60%). 거울 속 방은 상으로만 막을 수 있습니다. 거울을 치는 척탄병이 거울을 깨면, 그 줄의 상은 사라지고 길이 이어집니다.",
      lose: "왼쪽에 좋은 자리가 오른쪽에도 좋은 자리인지 보세요. 거울 앞에 선 척탄병부터 잡으세요." },
    // LAB-04 「가면무도회」 (chapter 6 prototype): LAB-03's board, but the room in the glass only shows: there each masked figure's reflection walks bare-faced (a guest
    // warm, an assassin red with a knife). Nobody of ours strikes a mask unjudged; held, it is let through or killed by a tap (12 s and it goes through by itself).
    // 22 figures from the real gate (1), 14 guests and 8 assassins in a fixed order, singly every 5 s, then in pairs 1.5 s apart. Times are the spec's plus 15 s
    { code: "LAB-04", name: "가면무도회", lab: true, bg: null, hz: 0.5, startCost: 24, mul: { hp: 1, atk: 1, def: 1 },
      map: ["#############",
            "B.h.,,|,,.h.B",
            "#,.,,.|.,,.,#",
            "#,,.,,|,,.,,S",
            "S,.,,.|.,,.,#",
            "#h.,,.|.,,.h#",
            "#############"],
      mirror: { x: 6, pct: 0.6, hp: 3000, display: true }, masks: true,
      meters: { in: { v: 0, min: 0, max: 14, label: "들어간 손님" }, knife: { v: 0, min: 0, max: 3, label: "들어간 자객" }, blood: { v: 0, min: 0, max: 3, label: "쓰러진 손님" } },
      goal: { win: [{ k: "clear" }, { k: "count", id: "in", op: ">=", v: 10 }], lose: [{ k: "count", id: "knife", op: ">=", v: 3 }, { k: "count", id: "blood", op: ">=", v: 3 }],
        text: { win: "손님 열 명 이상을 무도장에 들여보낸다.", lose: "자객 셋이 들어가거나, 손님 셋을 쓰러뜨린다." }, hud: [{ meter: "in" }, { meter: "knife" }, { meter: "blood" }] },
      waves: (() => { const K = "GAGGAGGAGAGGAGGAGAGGAG".split("").map((c) => ({ mask: c === "A" ? "assassin" : "guest" })),
          T = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 75, 76.5, 85, 86.5, 95, 96.5, 105, 106.5, 113, 114.5, 121, 122.5];
        return T.map((t, n) => [t, "masked", 1, K[n]]); })(),
      boss: ["", ""], desc: "가면 쓴 사람들이 무도장으로 갑니다. 손님은 들여보내고 자객은 막아야 합니다. 맨얼굴은 거울 속에서만 보입니다. 막아 세운 뒤 눌러서 통과시키거나 처치하세요. 들어간 손님 한 명마다 코스트 3을 받습니다.",
      lose: "거울 속 같은 자리를 보세요. 붉은 쪽이 자객입니다. 12초 안에 정하지 않으면 그냥 지나갑니다." },
    // LAB-05 「손에서 손으로」 (chapter 7 prototype): operators cannot walk; the paper goes hand to hand, each holder passing it to the one on the square it faces, from the
    // vault (1,1) to the exit (12,1), with at most five of ours down at once. The spec's map alternated '.' with walk-only ',' (no chain was possible); every ',' is '.' here.
    // B at (0,1) behind the vault only keeps the engine's point lookup alive: no road reaches it, and every foe here aims at something or holds a post.
    // Gates after setMap: 0 (13,3), 1 (0,4) (the spec's G0 is (0,4)). Every time below is the spec's plus 15 s
    { code: "LAB-05", name: "손에서 손으로", lab: true, bg: null, hz: 0.5, startCost: 30, deployLimit: 5, mul: { hp: 0.8, atk: 0.9, def: 0.85 },
      map: ["##############",
            "BV....#h....E#",
            "#.....#......#",
            "#h..#....#h..S",
            "S...#h...#...#",
            "#.......h....#",
            "##############"],
      relay: { item: "계약 원문", from: [1, 1], exit: [12, 1], pass: 2, limit: 5 },
      meters: { back: { v: 0, min: 0, max: 3, label: "되돌아감" }, out: { v: 0, min: 0, max: 1, label: "전달" } },
      goal: { win: [{ k: "count", id: "out", op: ">=", v: 1 }], lose: [{ k: "count", id: "back", op: ">=", v: 3 }, { k: "time", t: 255 }],
        text: { win: "계약 원문을 출구까지 옮긴다. 가사인격은 걷지 못하니, 옆 칸의 가사인격에게 건네서.", lose: "원문이 금고로 세 번 되돌아가거나, 255초가 지난다." }, hud: [{ meter: "back" }, { time: 255 }] },
      waves: (() => { const G0 = 1, G1 = 0, U = { aim: "unit" }, POST = (x, y) => ({ at: [x, y], until: 1e9 });
        return W1([[0.5, "grenadier", G1, 1, 0, POST(5, 3)], [0.5, "soldier", G1, 1, 0, POST(7, 3)], [0.5, "soldier", G1, 1, 0, POST(10, 2)],
          [35, "dog", G0, 2, 1.5, U], [50, "collector", G1, 1, 0], [65, "soldier", G1, 3, 1.6, U], [85, "collector", G0, 1, 0], [100, "lancer", G0, 2, 2, U], [115, "collector", G1, 1, 0],
          [130, "grenadier", G1, 1, 0, U], [145, "collector", G0, 1, 0], [165, "soldier", G0, 4, 1.4, U], [185, "collector", G1, 1, 0], [205, "dog", G1, 4, 1.2, U]]); })(),
      boss: ["", ""], desc: "금고의 원문을 출구까지. 원문은 든 가사인격이 바라보는 칸의 가사인격에게 건네집니다(2초). 다섯 명까지만 설 수 있으니, 뒤를 물려 앞에 다시 세우세요.",
      lose: "원문을 든 가사인격이 쓰러지면 원문이 그 자리에 떨어집니다. 회수인이 주워 가기 전에 옆 칸에 누군가 세우세요. 길 위의 보초는 먼저 치워야 사슬을 이을 수 있습니다." },
    // LAB-06 「어제의 판」 (chapter 9 prototype): the last attempt comes back. Every deployment of an attempt is recorded; the next attempt starts with those as ghosts at half
    // strength, at the same times on the same squares (the seed when there is no record: four placements round the crest). The ridge as it stands (no guns, no crest rule,
    // no Emperor). Waves: WL-08's table without the Emperor, every count +1 (a gap of 0 becomes 1.5 s, so the extra one does not stand inside the first), every time +15 s
    { code: "LAB-06", name: "어제의 판", lab: true, map: MAP_C3.ridge, bg: null, hz: 0.5, startCost: 24, mul: { hp: 1.1, atk: 1.225, def: 0.85 }, rmul: { hp: 1, atk: 0.75 },   // WL-08's hp/atk x1.25: plan A with no ghosts loses at t158
      echo: { pct: 0.5, key: "lab_echo_LAB-06", seed: [[25, "defender", 5, 3, 0, null], [40, "guard", 5, 4, 0, null], [55, "sniper", 3, 5, 3, null], [75, "caster", 7, 5, 3, null]] },   // the seed: two blockers and two ranged round the crest, as the basic operators (so a squad of one's own seldom cancels them)
      goal: { win: [{ k: "clear" }], lose: [{ k: "life" }], text: { win: "모든 적을 막는다. 혼자서는 모자라게 만들어진 판이다.", lose: "목숨이 다한다. 진 판의 배치는 다음 도전에 유령으로 돌아온다." }, hud: [{ life: true }] },
      waves: (() => { const N1 = { via: [[12, 1], [2, 1], [1, 3]] }, N2 = { via: [[12, 2], [7, 2], [2, 2], [1, 3]] }, C3 = { via: [[11, 3], [7, 3], [2, 3]] }, C4 = { via: [[11, 4], [7, 4], [2, 4]] }, S5 = { via: [[12, 6], [2, 6], [2, 4]] }, S6 = { via: [[12, 6], [2, 6], [2, 4]] };
        return W1([[20, "soldier", 0, 3, 2, N2], [33, "soldier", 2, 3, 2, S6], [45, "soldier", 1, 3, 2, C4], [55, "chasseur", 0, 2, 1.5, N1], [61, "lancer", 1, 2, 1.5, C3], [75, "soldier", 1, 4, 1.5, C4], [81, "lancer", 0, 3, 2, N1], [87, "grenadier", 1, 2, 1.5, C3], [95, "soldier", 2, 4, 1.5, S6], [97, "drummer", 2, 2, 1.5, S5], [105, "chasseur", 1, 2, 1.5, C4], [111, "lancer", 2, 2, 1.5, S5], [117, "soldier", 0, 4, 1.4, N2], [139, "soldier", 0, 4, 1.4, N1], [143, "soldier", 2, 3, 1.5, S6], [153, "drummer", 2, 2, 1.5, S6], [171, "chasseur", 2, 2, 1.5, S6], [181, "soldier", 1, 4, 1.4, C4], [187, "grenadier", 0, 2, 1.5, N2], [191, "soldier", 2, 4, 1.4, S5], [199, "lancer", 1, 3, 2, C4], [205, "soldier", 0, 4, 1.3, N1]]); })(),
      boss: ["", ""], desc: "이 판은 직전 도전에서 내가 둔 배치가 같은 시각, 같은 자리에 유령으로 재현된 채 시작합니다(능력치 절반). 유령과 같은 칸에 세우거나 같은 가사인격을 세우면 그 유령은 사라집니다.",
      lose: "어제 선 자리를 비켜서 세우면 둘이 함께 싸웁니다. 어제 뚫린 길을 오늘 메우세요." },
  ];

  const STAGES = [
    { code: "BL-01", name: "마트로 가는 길", map: MAP_C1.alley, bg: "bg_c1_alley", cam: [0.8368, 14.6214, 1553.44, 640.28, 285.49], hz: 0.5, mul: { hp: 0.7, atk: 0.85, def: 0.5 },
      waves: W1([[5, "soldier", 0, 2, 5], [16, "dog", 0, 3, 1.5], [26, "soldier", 0, 3, 3], [38, "dog", 0, 4, 1.2], [48, "soldier", 0, 3, 2.5],
        [58, "dog", 0, 3, 1], [60, "soldier", 0, 2, 3], [72, "soldier", 0, 4, 2], [76, "dog", 0, 4, 1]]),
      boss: ["", ""], desc: "좁은 길목 하나로 병사와 사냥개가 밀려옵니다. 입구 앞을 근거리 가사인격으로 막고, 뒤에서 받쳐 주십시오.",
      lose: "사냥개는 빠르지만 약합니다. 길목 바로 앞을 막으면 됩니다." },
    { code: "BL-02", name: "무너진 지하보도", map: MAP_C1.twin, bg: "bg_c1_twin", cam: [0.86, 13.5, 916.35, 640, 264.27], hz: 0.5, mul: { hp: 0.55, atk: 0.7, def: 0.8 }, deployLimit: 5,
      waves: W1([[4, "dog", 0, 2, 1.5], [10, "dog", 2, 2, 1.5], [18, "soldier", 0, 3, 3], [26, "soldier", 2, 3, 3], [34, "hexer", 1, 2, 3],
        [44, "dog", 0, 4, 1], [48, "soldier", 2, 3, 2.5], [58, "soldier", 0, 3, 2], [60, "dog", 2, 3, 1], [70, "hexer", 0, 2, 3], [72, "hexer", 2, 2, 3],
        [82, "soldier", 2, 4, 2], [84, "dog", 0, 4, 1], [96, "soldier", 0, 4, 2], [98, "soldier", 2, 4, 2]]),
      boss: ["", ""], desc: "위아래 두 갈래 길로 적이 번갈아 몰려옵니다. 배치는 다섯 명까지. 사거리가 긴 저격과 빠르게 깔 수 있는 선봉으로 두 길을 모두 막으십시오.",
      lose: "고지대 저격 하나로 두 길을 모두 볼 수 있는 자리가 있습니다." },
    { code: "BL-03", name: "분수 광장", map: MAP_C1.plaza, bg: "bg_c1_plaza", cam: [0.86, 13.5, 1297.37, 640, 263.09], hz: 0.5, mul: { hp: 0.82, atk: 0.9, def: 1 },
      waves: W1([
        // the square is already full when the line goes up: stragglers stand frozen on both ways round the fountain, and start walking when the column arrives
        [0, "strag", 0, 5, 0, [4.1, 4.6, 5.1, 5.6, 6.1].map((adv) => Object.assign({ pre: { adv, until: 14 } }, UP))],
        [0, "strag", 0, 5, 0, [4.4, 5.0, 5.6, 6.2, 6.8].map((adv) => Object.assign({ pre: { adv, until: 14 } }, DOWN))],
        [14, "strag", 0, 3, 0.8, UP], [16, "strag", 0, 3, 0.8, DOWN], [26, "soldier", 0, 2, 2], [34, "strag", 0, 6, 0.5, UP], [36, "strag", 0, 6, 0.5, DOWN],
        [46, "soldier", 0, 3, 1.5, UP], [48, "soldier", 0, 3, 1.5, DOWN], [56, "hexer", 0, 2, 2], [62, "strag", 0, 10, 0.4], [70, "strag", 0, 8, 0.5, UP], [72, "strag", 0, 8, 0.5, DOWN],
        [84, "soldier", 0, 4, 1, UP], [86, "soldier", 0, 4, 1, DOWN], [96, "strag", 0, 12, 0.35, UP], [98, "strag", 0, 12, 0.35, DOWN]]),
      boss: ["", ""], desc: "마른 분수에서 쏟아진 낙오병들이 위아래로 갈라져 몰려옵니다. 느리고 약하지만 끝도 없이 나옵니다. 범위 공격으로 한꺼번에 쓸어 내십시오.",
      lose: "하나씩 막아서는 끝이 없습니다. 카피바라의 포격처럼 여럿을 함께 때리는 공격이 답입니다." },
    { code: "BL-04", name: "감시탑 아래", map: MAP_C1.tower, bg: "bg_c1_tower", cam: [0.86, 13.5, 916.35, 640, 264.27], hz: 0.5, mul: { hp: 0.62, atk: 0.85, def: 0.9 },
      waves: W1([[5, "soldier", 0, 3, 3], [12, "soldier", 2, 3, 3], [22, "drone", 1, 2, 3], [30, "dog", 0, 3, 1.2], [34, "dog", 2, 3, 1.2],
        [44, "drone", 1, 3, 2], [46, "hexer", 0, 2, 3], [56, "soldier", 2, 4, 2], [58, "soldier", 0, 4, 2], [70, "drone", 1, 4, 1.5], [72, "dog", 2, 4, 1],
        [84, "hexer", 2, 2, 3], [86, "soldier", 0, 4, 2], [96, "drone", 1, 3, 1.5], [98, "dog", 0, 5, 0.8], [100, "dog", 2, 5, 0.8]]),
      boss: ["", ""], desc: "위아래 길로는 병사가, 가운데로는 드론이 날아옵니다. 드론은 근거리로 막을 수 없으니 저격 가사인격으로 떨어뜨리십시오.",
      lose: "드론은 저격이 우선으로 노립니다. 고지대에 저격 하나는 꼭 두세요." },
    { code: "BL-05", name: "협공", map: MAP_C1.pincer, bg: "bg_c1_pincer", cam: [0.86, 13.5, 1223.68, 640, 246.25], hz: 0.5, mul: { hp: 0.55, atk: 0.76, def: 0.8 },
      waves: W1([[5, "soldier", 0, 3, 2.5], [8, "soldier", 1, 3, 2.5], [18, "dog", 0, 4, 1], [20, "dog", 1, 4, 1], [30, "hexer", 0, 2, 3], [32, "hexer", 1, 2, 3], [34, "soldier", 0, 4, 2],
        [46, "soldier", 1, 5, 1.6], [48, "dog", 0, 5, 0.8], [60, "soldier", 0, 5, 1.6], [62, "soldier", 1, 5, 1.6], [66, "hexer", 0, 2, 3],
        [78, "dog", 1, 6, 0.7], [80, "dog", 0, 6, 0.7], [92, "soldier", 0, 6, 1.4], [94, "soldier", 1, 6, 1.4], [96, "hexer", 1, 3, 2.5],
        [110, "dog", 0, 6, 0.6], [110, "dog", 1, 6, 0.6], [114, "soldier", 0, 5, 1.5], [116, "soldier", 1, 5, 1.5]]),
      boss: ["", ""], desc: "방어 지점 바로 곁의 두 입구에서 적이 동시에 나옵니다. 입구와 방어 지점 앞은 배치할 수 없습니다. 양쪽 물량을 끝까지 버티십시오.",
      lose: "두 길이 만나는 가운데를 두텁게 막으세요." },
    { code: "BL-06", name: "낙하 지점", map: MAP_C1.drop, bg: "bg_c1_drop", cam: [0.86, 13.5, 942.04, 640, 271.14], hz: 0.5, mul: { hp: 0.55, atk: 0.72, def: 0.8 },
      waves: W1([...GARRISON6.map(([x, y, ty]) => [0.2, ty, 0, 1, 0, { at: [x, y], until: 112 }]), [10, "soldier", 1, 2, 4], [22, "airship", 0, 1, 0, AIR.a], [36, "dog", 1, 3, 1.2],
        [48, "airship", 0, 1, 0, AIR.b], [58, "heavy", 1], [70, "airship", 0, 1, 0, AIR.c], [84, "soldier", 1, 3, 2], [100, "airship", 0, 1, 0, AIR.e], [108, "dog", 1, 2, 1]]),
      boss: ["", ""], desc: "땅길이 막히자 정규군이 비행선으로 넘어옵니다. 지상에 설 수 있는 자리는 몇 곳뿐이고, 비행선은 그 곁마다 방패병과 척후병을 내려놓습니다. 방패병은 사거리 안 가사인격의 공격을 먼저 받아 냅니다.",
      lose: "비행선은 저격으로 미리 떨어뜨리고, 방패병은 술사의 마법으로 뚫으세요. 착지 지점 곁의 자리는 내리기 전에 먼저 차지해 두세요." },
    { code: "BL-07", name: "봉쇄선", march: MARCH7, waves: [], startCost: 25, costRate: 1.4, mul: { hp: 0.6, atk: 0.74, def: 0.75 }, boss: ["경고: 마탄의 사수", "미셸 네 · WARNING"],
      desc: "뒤에서 몰려오는 물량과 함께 마탄의 사수가 지키는 선을 넘습니다. 한 구간을 버티면 방어 지점이 다음 구간으로 옮겨 가고, 갈림길에서는 길을 고를 수 있습니다. 마탄의 사수는 주기적으로 전장을 훑어 가장 큰 적 주위에 포격을 가합니다.",
      lose: "포격은 가장 체력이 많은 적 주위에 떨어집니다. 그 적을 막고 있는 가사인격은 포격 전에 빼 두세요. 구간 이동 전에 퇴각시키면 코스트를 돌려받습니다." },
    // a side branch under BL-01: the terminal's lesson on defenders, medics and who the ranged foes shoot at
    { code: "TR-01", name: "방어선 학습", map: MAP_C1.alley, bg: "bg_c1_alley", cam: [0.8368, 14.6214, 1553.44, 640.28, 285.49], hz: 0.5, branch: 0, startCost: 45, mul: { hp: 0.45, atk: 0.5, def: 0.3 },   // a lesson: few and soft, spaced out, no heavies
      waves: W1([[4, "soldier", 0, 1], [12, "soldier", 0, 2, 4], [24, "hexer", 0, 1], [34, "soldier", 0, 2, 3], [44, "hexer", 0, 1], [52, "soldier", 0, 2, 3], [60, "hexer", 0, 2, 4], [72, "soldier", 0, 3, 2.5]]),
      boss: ["", ""], desc: "중장으로 길을 막고, 의무로 버티게 하는 법을 익힙니다. 원거리 적은 가장 마지막에 배치된 가사인격을 먼저 노립니다.",
      lose: "중장 뒤에 의무를 두고, 원거리 적이 나오면 중장을 마지막에 배치해 표적을 넘기세요." },
    // a side branch under BL-05: casters against armour, and slowing what runs
    { code: "TR-02", name: "화력 학습", map: MAP_C1.alley, bg: "bg_c1_alley", cam: [0.8368, 14.6214, 1553.44, 640.28, 285.49], hz: 0.5, branch: 4, startCost: 40, mul: { hp: 0.45, atk: 0.45, def: 1 },   // the armour stays whole: that is the lesson
      waves: W1([[4, "soldier", 0, 1], [12, "heavy", 0, 1], [32, "soldier", 0, 2, 3], [42, "dog", 0, 3, 1.4], [56, "heavy", 0, 1], [62, "dog", 0, 4, 1.1], [76, "soldier", 0, 2, 3], [80, "heavy", 0, 1], [86, "dog", 0, 4, 1]]),
      boss: ["", ""], desc: "방어력이 높은 적은 술사의 마법으로, 빠른 적은 감속자로 늦춰 잡는 법을 익힙니다.",
      lose: "척탄병은 물리 공격이 거의 통하지 않습니다. 술사를 고지대에 두고, 감속자로 사냥개의 발을 묶으세요." },
    // ---- chapter 2 「지옥 기계」: the winter's gimmicks (blizzard and drifts, thin ice, frost, the white that hides, the cold that maddens,
    //      the sleepers, the frost bombs) laid over the rebellion's own (the hedge, the burning village, the infernal machine, the rebels on our side) ----
    { code: "IM-01", name: "얼어붙은 진창", map: MAP_C2.mud, bg: null, hz: 0.5, ep: 2, startCost: 14, mul: { hp: 0.435, atk: 0.525, def: 0.65 },
      wind: { dir: 3, first: 24, every: 32, dur: 14, durs: [12] },   // from the south
      // gates: 0 the upper road, 1 the lower; both cross the causeway
      waves: W1([[3, "strag", 0, 3, 1.4], [8, "chouan", 1, 1, 1.6], [14, "strag", 1, 3, 1.2], [20, "chouan", 0, 2, 1.4], [26, "yshield", 1, 1, 1.4], [32, "soldier", 0, 2, 3],
        [38, "chouan", 1, 2, 1.1], [46, "strag", 0, 5, 1], [52, "yshield", 0, 1, 1.2], [56, "soldier", 1, 2, 3], [62, "chouan", 0, 2, 1], [70, "strag", 1, 5, 0.8],
        [76, "yshield", 1, 1, 1], [82, "soldier", 0, 3, 2.5], [88, "chouan", 1, 2, 1], [94, "strag", 0, 5, 0.8], [98, "soldier", 1, 3, 2.5], [104, "chouan", 0, 2, 1]]),
      boss: ["", ""], desc: "밤사이 얼어붙은 라스푸티차. 두 길이 진창 둑길에서 만났다가 다시 갈라집니다. 남쪽에서 주기적으로 눈보라가 불어와, 한 칸씩 북쪽으로 번지며 칸을 눈으로 덮습니다(배치 불가). 앞을 막아선 가사인격은 얼어붙지만 그 뒤는 지켜집니다. 고지는 막아 주지 못하고, 올라온 벽만 막습니다. 진창은 눈보라가 불면 막든 말든 얼어붙습니다.",
      lose: "눈보라가 부는 동안 진창 둑길은 지킬 수 없습니다. 둑길 출구와 방어 지점 앞을 지키고, 맨 아래 오른쪽 빈칸에 바람막이를 세우세요. 올라온 벽 위쪽 고지는 처음부터 안전합니다." },
    { code: "IM-02", name: "생울타리", map: MAP_C2.bocage, bg: null, hz: 0.5, ep: 2, startCost: 16, mul: { hp: 0.336, atk: 0.416, def: 0.8 }, rmul: { hp: 0.81, atk: 0.45 },
      wind: { dir: 3, first: 22, every: 32, dur: 14 },   // from the south, up from the bottom road
      // gates: 0 the top, 1 the left (both into the plaza), 2 the bottom road. POST: the white snipers already on the bottom road, holding it until late
      // three surges with lulls between: the packs learn the plaza (6-30), all three gates at once at 70, the last push 95-116; the ten snipers hold the bottom road until 120 (after the last wave)
      waves: (() => { const POST = (x, y, i) => ({ at: [x, y], until: 120 }), posts = [[2, 6], [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [7, 5], [8, 5], [9, 5], [10, 5]];   // the designer's ten: every bottom-road square but two, held until after the last wave
        return W1([...posts.map(([x, y], i) => [0.5, "snowsniper", 2, 1, 0, POST(x, y, i)]),
        [6, "yfang", 1, 4, 1.2], [14, "chouang", 0, 1], [24, "yfang", 0, 4, 1.1],
        [40, "chouang", 1, 1], [42, "yfang", 2, 2, 1.5], [52, "yrazor", 0, 1], [53, "yfang", 2, 4, 1.1],
        [70, "yfang", 0, 4, 1], [70, "yfang", 1, 4, 1], [71, "yfang", 2, 3, 1],
        [95, "chouang", 1, 1], [96, "yrazor", 2, 1], [102, "yfang", 0, 5, 1], [108, "yrazor", 1, 2, 2], [114, "yfang", 2, 5, 0.9], [116, "yrazor", 0, 1]]); })(),
      boss: ["", ""], desc: "생울타리 사이의 길. 아래쪽 길에는 처음부터 설원 저격수들이 빼곡히 자리를 잡고 오래 버팁니다. 눈보라는 남쪽, 아래쪽 길에서 불어옵니다. 빠른 적이 길을 돌파해 옵니다. 저격수는 마법에 강하고 멀리서 쏘며, 얼어붙은 가사인격에게 훨씬 큰 피해를 줍니다. 눈보라가 부는 동안에는 모습을 감춥니다. 아래쪽 길로도 적이 오니, 저격수를 일찍 쓰러뜨려야 화망을 세울 수 있습니다. 생울타리는 올라온 벽이라 눈보라를 막습니다.",
      lose: "저격수는 눈보라가 그친 사이에 물리 화력으로 하나씩 잡으세요. 저격수가 남아 있는 동안 고지대에 세운 가사인격은 계속 노려집니다." },
    { code: "IM-03", name: "지옥 종대", map: MAP_C2.village, bg: null, hz: 0.5, ep: 2, startCost: 16, mul: { hp: 0.17, atk: 0.23, def: 0.7 }, rmul: { hp: 0.47, atk: 0.25 },
      wind: { dir: 3, first: 22, every: 32, dur: 14 },   // from the south, up the hounds' road: whoever holds a square shelters the rise behind it
      // gates: 0 the east (round over the north road: the firebottles), 1 the west (the ice-clad guards wait beside it), 2 the south (hounds and frost gunners)
      // the frost gunner first, the firebottles four to six seconds behind him (and now two or three together, with infantry in front of them); two lulls (34-44, 78-90);
      // the ice-clad guards still set the clock: they stir at 50/58 and come round the long way
      waves: W1([[0.5, "iceguard", 1, 1, 0, { at: [3, 3], wait: 50, via: [[5, 2]] }], [0.5, "iceguard", 1, 1, 0, { at: [3, 4], wait: 58, via: [[5, 2]] }],   // by (5,2): the new forward square can take one of them
        [4, "yfang", 2, 2, 1.6], [11, "chouang", 0, 1], [12, "frostgun", 2, 1], [16, "chouang", 0, 2, 1.5], [17.5, "molotov", 0, 1], [24, "yfang", 2, 2, 1.4], [30, "chxbow", 0, 1],
        [44, "frostgun", 2, 1], [47, "chouang", 0, 2, 1.5], [48.5, "molotov", 0, 2, 1.5], [54, "yfang", 2, 3, 1.2], [60, "strag", 1, 3, 1.2], [66, "frostgun", 2, 1], [69, "soldier", 0, 2, 1.5], [70.5, "molotov", 0, 1], [74, "yrazor", 2, 1],
        [90, "yfang", 2, 3, 1.2], [96, "frostgun", 2, 1], [99, "chouang", 0, 2, 1.5], [100.5, "molotov", 0, 2, 1.5], [106, "soldier", 1, 2, 2], [112, "frostgun", 2, 1], [113, "yfang", 2, 3, 1.1],
        [116, "chouang", 0, 2, 1.2], [120, "yrazor", 2, 1], [121, "yfang", 2, 3, 1], [124.5, "molotov", 0, 2, 1.5]]),
      boss: ["", ""], desc: "불탄 수도 외곽 시가 한가운데를 지킵니다. 동쪽에서는 화염병 투척병이 북쪽 길을 돌아오고, 남쪽에서는 사냥개와 서리 사수가 올라옵니다. 서쪽에는 빙갑 근위병 둘이 쉬다가 움직입니다. 눈보라는 북쪽에서 불어옵니다. 무너지지 않은 성당 벽(올라온 벽) 아래 서쪽은 바람을 피할 수 있습니다. 화염병 투척병은 얼어붙은 가사인격을 먼저 노리고, 얼어 있는 채로 맞으면 얼음이 녹으며 큰 피해를 연달아 입습니다.",
      lose: "화염병 투척병은 북쪽 길 위에서 먼저 쓰러뜨리세요. 서리 사수의 동상도 얼음입니다. 빙갑 근위병은 느리니, 셋을 저지할 수 있는 중장으로 오래 붙잡아 두세요." },
    { code: "IM-04", name: "밤의 연병장", map: MAP_C2.field, bg: null, hz: 0.5, ep: 2, startCost: 20, mul: { hp: 0.187, atk: 0.245, def: 0.7 },
      // gates: 0 and 1 the middle of the ice, 2 the east, 3 the south-west. Everyone goes once round the ice first: the middle ones then make for either point,
      // the south-west for the south-east point, the east for the north-west one. POST: tough riflemen holding the squares in front of the points and the gates
      // three steps: the hounds alone on the south-west round, to learn the posts on (16-36); the white scouts and the drones on both sides (48-88); everything, and at 120 the
      // marksmen still sitting get up and walk for the points (100-134)
      waves: (() => { const CA = { via: [[11, 2], [11, 4], [2, 4], [2, 2], [0, 2]] }, CB = { via: [[2, 2], [2, 4], [11, 4], [11, 2], [13, 6]] }, LB = { via: [[2, 4], [2, 2], [11, 2], [11, 4], [13, 6]] }, RA = { via: [[11, 2], [2, 2], [2, 4], [11, 4], [0, 2]] },
        POST = (x, y) => ({ at: [x, y], until: 120 });   // late on they give up the square and walk for the point
        return W1([...[[1, 1], [1, 3], [1, 5], [12, 4], [12, 6], [7, 4], [8, 3]].map(([x, y]) => [0.5, "chxelite", 0, 1, 0, POST(x, y)]),   // the designer's seven: the squares before both points and the gates, and the middle of the ice
        [16, "yfang", 3, 2, 1.4, LB], [24, "yfang", 3, 3, 1.3, LB], [32, "chouang", 2, 2, 1.5, RA],
        [48, "icestalker", 0, 2, 2.5, CA], [54, "bomber", 2, 1, 0, { air: [[11, 2], [2, 2], [2, 4], [0, 2]] }], [58, "icestalker", 1, 2, 2.5, CB], [64, "yshield", 0, 1, 0, CA], [70, "yfang", 3, 3, 1.1, LB],
        [76, "chouang", 2, 2, 1.2, RA], [78, "bomber", 3, 1, 0, { air: [[2, 4], [11, 4], [11, 2], [13, 6]] }], [82, "icestalker", 1, 3, 2, CB],
        [100, "yshield", 1, 1, 0, CB], [101, "soldier", 2, 2, 2, RA], [106, "icestalker", 0, 2, 2, CA], [108, "yfang", 3, 3, 1, LB], [112, "bomber", 0, 2, 3, { air: [[11, 2], [11, 4], [2, 4], [2, 2], [0, 2]] }],
        [118, "chouang", 2, 3, 1, RA], [119, "yshield", 0, 1, 0, CA], [126, "icestalker", 1, 3, 2, CB], [128, "yfang", 3, 4, 0.9, LB], [132, "soldier", 2, 3, 1.5, RA], [134, "yshield", 1, 1, 0, CB]]); })(),
      boss: ["", ""], desc: "밤의 마르스 연병장. 적은 얼음판 한가운데와 동쪽, 남서쪽에서 나와 얼음판을 한 바퀴 돈 뒤 방어 지점으로 갑니다. 방어 지점은 북서쪽과 남동쪽, 둘입니다. 방어 지점과 출입구 앞, 그리고 얼음판 한가운데에는 단단한 엽총수 일곱이 처음부터 앉아 있다가, 120초가 지나면 남은 엽총수가 모두 일어나 방어 지점으로 걸어옵니다. 흰 망토의 설원 척후병은 빙판 위에서는 보이지 않습니다. 얼음폭탄 드론은 얼음판을 한 바퀴 돈 뒤 반대편 방어 지점으로 날아가고, 폭탄을 한 번 떨어뜨리면 바로 빠져나갑니다.",
      lose: "앉아 있는 엽총수는 선봉과 근위를 바로 옆 칸에 붙여 쓰러뜨리세요. 그 칸을 되찾아야 방어 지점 앞이 막힙니다." },
    { code: "IM-05", name: "목 없는 장군", map: MAP_C2.camp, bg: null, hz: 0.5, ep: 2, startCost: 12, mul: { hp: 0.47, atk: 0.45, def: 0.72 }, rmul: { hp: 0.9, atk: 0.85 },
      // gates: 0 the sunken road (top side), 1 the camp's own gate under the guillotine, 2 the ravine (bottom side). Three surges: the scouts (6-34), the general and his column (48-100),
      // the whole camp (112-175). SLEEP: the camp asleep on the far and middle squares of both sides (and its priest by the best rise): it wakes when someone is set down beside it,
      // when it is hit, or when the general sounds his horn. POST: three fowlers, two holding the western half until late and the third on the east rise (10,4) over the point. bossFlee: switch `on` to make him quit the field at that share
      // of his strength instead of falling (the designer has not decided yet: off)
      bossFlee: { on: false, at: 0.3, text: ["카두달 퇴각", "언덕 너머로 물러났습니다"] },
      vias: { 0: [[3, 1]], 2: [[3, 6]] },   // the mouths: each side road files past its far camp fire
      waves: (() => { const SLEEP = (x, y) => ({ at: [x, y], wait: 150 }), POST = (x, y) => ({ at: [x, y], until: 150 }),   // whoever the horn has not roused is up by 150 anyway
        ROW2 = { via: [[3, 1], [9, 2]] }, ROW5 = { via: [[3, 6], [9, 5]] }, UP = { via: [[9, 1]] }, DOWN = { via: [[3, 1], [2, 4], [3, 6], [9, 6]] },
        BOSS = { via: [[6, 1, 10], [3, 1], [1, 2], [2, 4], [3, 6], [9, 6]] };   // under the blade a long moment, then west about the hill and in along the bottom side (only those he calls or rouses run straight for the point)
        return W1([[0, "chouang", 1, 1, 0, SLEEP(3, 1)], [0, "chouang", 1, 1, 0, SLEEP(9, 1)], [0, "chouang", 1, 1, 0, SLEEP(3, 6)], [0, "chouang", 1, 1, 0, SLEEP(9, 6)], [0, "vicar", 1, 1, 0, SLEEP(9, 2)],
        [0.5, "chxbow", 0, 1, 0, POST(4, 2)], [0.5, "chxbow", 2, 1, 0, POST(4, 5)], [0.5, "chxbow", 1, 1, 0, POST(10, 4)],
        [8, "yfang", 2, 2, 1.6], [14, "chouang", 0, 2, 2], [24, "yfang", 2, 3, 1.3, ROW5], [30, "chouang", 0, 2, 2, ROW2],
        [48, "chouang", 0, 2, 2], [50, "chxbow", 0, 1], [56, "yrazor", 2, 1], [57, "yfang", 2, 3, 1.2], [66, "cadoudal", 1, 1, 0, BOSS], [72, "molotov", 0, 2, 2], [84, "chouang", 2, 3, 1.5], [86, "vicar", 2, 1], [92, "yfang", 0, 3, 1],
        [112, "chouang", 0, 2, 1.5], [118, "yfang", 2, 4, 1], [128, "chouang", 1, 2, 1.2, UP], [129, "chouang", 1, 2, 1.2, DOWN], [138, "molotov", 2, 1], [140, "yrazor", 2, 1],
        [148, "chxbow", 0, 1], [150, "chouang", 0, 2, 1.3, ROW2], [152, "vicar", 0, 1, 0, ROW2], [158, "chouang", 2, 2, 1.5], [160, "yfang", 0, 2, 1], [168, "yrazor", 2, 1], [172, "chouang", 1, 2, 1.2, DOWN]]); })(),
      boss: ["경고: 목 없는 장군", "조르주 카두달 · WARNING"], desc: "처형장 언덕의 반란군 진지. 언덕을 두 칸 폭의 길이 한 바퀴 두르고, 단두대 바로 아래가 진지의 출입구입니다. 서쪽 움푹한 길로는 슈앙 종대가 위쪽 길을, 남서쪽 골짜기로는 사냥개 무리가 아래쪽 길을 타고 동쪽 방어 지점으로 옵니다. 길 위의 설 자리는 양쪽 모두 먼 곳·가운데·방어 지점 앞, 세 군데입니다. 두 길의 적은 모두 먼 곳의 모닥불 자리 (3,1)·(3,6)을 지나갑니다. 먼 곳과 가운데 자리에는 반란군이 모닥불 곁에서 자고 있고, 옆에 가사인격을 세우거나 공격하면 깨어납니다. 서쪽 절반은 엽총수 둘이 지키고, 방어 지점을 내려다보는 동쪽 고지 (10,4)에도 엽총수 하나가 먼저 올라가 있습니다. 카두달은 단두대 아래에 한참 서 있다가 언덕을 서쪽으로 돌아 아래쪽 길로 옵니다. 그가 부르거나 깨운 반란군은 돌지 않고 방어 지점으로 곧장 달려옵니다. 막는 이가 없으면 옆 칸 고지의 가사인격까지 베고, 세 번째 공격마다 둘레 한 칸을 휩쓸며, 2칸 안 고지에 갈고리를 던져 끌어내립니다. 체력이 줄 때마다 호각을 불어 진지 전체를 깨우고, 절반 아래부터는 깃발을 올려 둘레의 반란군을 북돋우며 돌격으로 저지를 뚫고 지나갑니다.",
      lose: "처음에는 방어 지점 앞 (12,2)·(12,5)에서 받고(그 바로 앞 (12,1)·(12,6)에 한 겹을 더 세울 수 있습니다), 잠든 반란군은 준비가 됐을 때 하나씩 깨워 정리하세요. 호각이 울리면 남은 진지가 한꺼번에 일어납니다. 카두달은 한 겹으로는 못 막습니다. 아래쪽 길 가운데 (9,6)과 방어 지점 앞 (12,6)·(12,5)에 겹쳐 서세요. 막혀 있는 동안에는 갈고리를 던지지 못합니다. 붉은 원이 뜨면 옆 고지의 가사인격을 잠깐 물리거나 치료를 붙이세요. 사제는 곁의 반란군을 계속 치료하니 먼저 쓰러뜨리세요. 동쪽 고지 (10,4)의 엽총수는 바로 옆 (11,4)에 근거리 가사인격을 세우면 쓰러뜨릴 수 있습니다. 먼 곳의 모닥불 자리 (3,1)·(3,6)은 두 길의 길목입니다. 자는 반란군을 깨워 쓰러뜨리고 그 칸에 서면 길 하나를 언덕 서쪽에서 통째로 받을 수 있습니다. 다만 엽총수 (4,2)·(4,5)의 사거리 안이고, 카두달도 두 칸을 모두 지나갑니다." },
    { code: "IM-06", name: "생니카즈 거리", map: MAP_C2.street, bg: null, hz: 0.5, ep: 2, startCost: 10, mul: { hp: 0.83, atk: 0.88, def: 0.74 }, rmul: { hp: 0.95, atk: 0.9 },
      // gates: 0 the carts' alley from the north (into the square), 1 the street from the east gate (the escort), 2 the back alley from the south. Three surges: one cart alone to be
      // learnt on (5-40), carts with their escorts (52-108: each cart leaves a few seconds before the men who will bunch up behind it), carts against the shield-bearers, with the drones
      // and a cart up the back alley (120-175). A cart goes round the fountain by the west and onto the street at (6,3); EAST sends it round the other way and in at (10,3)
      waves: (() => { const EAST = { via: [[10, 1], [10, 2]] }, STEPS = { via: [[6, 1], [5, 2], [1, 2]] }, DOOR = { via: [[9, 3], [7, 2], [1, 2]] }, SLEEP = (x, y, t) => ({ at: [x, y], wait: t }),   // the bomb-makers get up of their own accord late on
        HOV_W = { air: [[11, 4, 4], [4, 4, 6], [1, 1, 4], [0, 3]] }, HOV_E = { air: [[12, 1, 5], [8, 4, 6], [0, 3]] };
        return W1([[0, "chouang", 0, 1, 0, SLEEP(6, 1, 112)], [0, "chxbow", 0, 1, 0, SLEEP(10, 1, 126)], [0.5, "chxbow", 2, 1, 0, { at: [4, 4], until: 112 }],
        [5, "soldier", 1, 3, 2.2], [16, "cart", 0], [26, "soldier", 1, 2, 2], [34, "chouang", 0, 2, 1.5, STEPS],
        [52, "cart", 0, 1, 0, EAST], [55, "soldier", 1, 3, 1.5], [62, "molotov", 2, 1], [70, "frostgun", 1, 1], [78, "cart", 0], [81, "chouang", 0, 3, 1.5, STEPS], [90, "soldier", 1, 4, 1.4, DOOR], [96, "bomber", 1, 1, 0, HOV_E], [100, "yfang", 2, 3, 1.2],
        [120, "yshield", 1, 1], [122, "cart", 0, 1, 0, EAST], [128, "molotov", 2, 2, 2], [136, "soldier", 1, 4, 1.4], [142, "cart", 0], [144, "chouang", 0, 3, 1.4, STEPS], [150, "frostgun", 1, 2, 2.5], [152, "bomber", 1, 1, 0, HOV_W],
        [158, "yshield", 1, 1], [160, "cart", 2], [166, "yfang", 2, 4, 1], [170, "soldier", 1, 3, 1.3]]); })(),
      boss: ["", ""], desc: "생니카즈 거리. 발코니(고지)가 내려다보는 골목이 동쪽 성문에서 서쪽 우리 자리까지 이어집니다. 차도 위쪽으로는 문간 한 줄이 나란히 붙어 있습니다. 광장에서 내려온 반란군은 이 문간 줄을 따라 걷고, 호위 보병과 수레는 차도로 옵니다. 북쪽 분수 광장으로 반란군이 화약 수레(지옥 기계)를 굴려 내려보내고, 수레는 분수를 서쪽이나 동쪽으로 돌아 골목에 들어섭니다. 동쪽에서는 호위 보병이 골목을 따라 오고, 남쪽 뒷골목은 골목 한가운데로 이어집니다. 수레는 부서지거나, 막힌 채 도화선이 다 타면 터져 둘레의 적과 아군을 가리지 않습니다. 광장에는 폭탄꾼 둘이 쉬고 있습니다. 우리 자리 바로 앞 남쪽 발코니 (4,4)에는 엽총수 하나가 먼저 올라가 있다가, 112초가 지나면 내려와 걸어옵니다. 나중에는 방패를 든 중장병이 오는데, 수레의 폭발은 방어력을 무시합니다.",
      lose: "수레는 광장에서 원거리로 미리 부수거나, 호위 보병이나 중장병 한가운데서 터지게 하세요. 수레를 막아 세울 칸의 바로 옆 발코니는 비워 두는 편이 안전합니다. 광장을 내려다보는 발코니 (3,1)·(12,1)이 수레를 일찍 잡기 좋습니다. 차도와 문간 줄을 한 칸으로 다 막을 수는 없습니다. 우리 자리 앞 (2,3)과 (1,2)에 나눠 서거나, 광장 출구 (6,1)·동쪽 (9,3)·뒷골목 (6,4)에서 길마다 따로 받으세요." },
    { code: "IM-07", name: "반란의 그늘", map: MAP_C2.shadow, bg: null, hz: 0.5, ep: 2, startCost: 10, mul: { hp: 0.67, atk: 0.74, def: 0.75 },
      wind: { dir: 0, first: 40, every: 34, dur: 12 },
      // gates: 0 the north road, 1 the south road; WALL: the hounds' way round by the wall lane along the top. Our rebels (white rings) hold both road mouths and stand in the wind.
      // Three surges: the line comes on and the rebels hold it alone (5-45, the first gust at 40 shows what they shelter); the drums come up and the mouths give way (58-112);
      // the ice-clad guard on the south road, the drums on the north and the pack on the wall lane all at once (124-180)
      waves: (() => { const ALLY = (x, y) => ({ at: [x, y], ally: true }), ALLYK = (x, y) => ({ at: [x, y], ally: true, hp: 0.73, atk: 0.86 }), WALL = { via: [[3, 0], [8, 0]] }, ROW2 = { via: [[4, 2], [11, 2]] }, ROW4 = { via: [[4, 4], [11, 4]] };
        return W1([[0, "chouang", 0, 1, 0, ALLYK(1, 1)], [0, "chouang", 0, 1, 0, ALLYK(2, 1)], [0, "chxbow", 0, 1, 0, ALLY(3, 1)], [0, "chouang", 1, 1, 0, ALLYK(1, 5)], [0, "chouang", 1, 1, 0, ALLYK(2, 5)], [0, "chxbow", 1, 1, 0, ALLY(3, 5)],
        [0.5, "snowsniper", 0, 1, 0, { at: [1, 2], until: 80 }], [0.5, "snowsniper", 1, 1, 0, { at: [1, 4], until: 80 }],
        [5, "soldier", 0, 3, 2.5], [12, "strag", 1, 4, 1.5], [22, "soldier", 1, 2, 2.5], [30, "yfang", 0, 2, 1.4, WALL], [36, "soldier", 0, 2, 2, ROW2],
        [58, "soldier", 0, 4, 1.2], [60, "drummer", 0, 1], [66, "frostgun", 1, 1], [74, "yfang", 0, 3, 1.2, WALL], [82, "soldier", 1, 2, 1.3, ROW4], [85, "frostgun", 1, 1, 0, ROW4], [84, "drummer", 1, 1, 0, ROW4], [90, "yshield", 0, 1], [96, "strag", 1, 6, 0.9], [104, "frostgun", 0, 2, 3, ROW2], [106, "yfang", 0, 2, 1.2, WALL], [110, "iceguard", 1, 1, 0, { hp: 0.55 }],
        [124, "yrazor", 0, 1, 0, WALL], [125, "yfang", 0, 4, 1, WALL], [130, "soldier", 0, 5, 1.2], [133, "drummer", 0, 1], [138, "soldier", 1, 2, 1.4, ROW4], [141, "frostgun", 1, 1, 0, ROW4], [146, "frostgun", 0, 1], [148, "strag", 1, 6, 0.8],
        [156, "yfang", 0, 3, 1, WALL], [158, "soldier", 0, 3, 1.3, ROW2], [162, "frostgun", 0, 1, 0, ROW2], [166, "soldier", 1, 5, 1.2], [168, "drummer", 1, 1], [174, "yrazor", 0, 1, 0, WALL]]); })(),
      boss: ["", ""], desc: "갈림길. 북쪽 길과 남쪽 길이 나란히 동쪽 방어 지점으로 이어지고, 두 길 사이에는 양쪽을 다 내려다보는 고지가 줄지어 있습니다. 맨 위 담벼락 길은 아무도 지키지 않는 사냥개의 우회로입니다. 흰 고리를 두른 반란군이 서쪽 두 길목을 붙잡고 황제군을 막아섭니다. 이번 작전 동안 우리 편이고, 서쪽에서 번져 오는 눈보라도 몸으로 막아 그 줄의 뒤쪽을 지켜 줍니다. 그들이 쓰러지면 그 뒤부터 눈에 덮입니다. 서쪽 끝 두 고지에는 설원 저격수가 엎드려 길목 근처를 겨누다가, 80초가 지나면 일어나 걸어옵니다. 북을 치는 고수가 오면 둘레의 적이 빨라지고 세지며, 눈보라에도 느려지지 않습니다.",
      lose: "반란군이 버티는 동안 뒤에서 화력을 보태세요. 가운데 줄 고지는 맨 서쪽 (2,3)에 누가 서 있어야 눈보라를 피합니다. 길목이 뚫리면 (4,2)·(4,4)나 (2,1)·(2,5)에 가사인격을 세워 바람막이 겸 저지선으로 쓰세요. 고수는 대열 한가운데에서 걸어옵니다. 먼저 쏘세요. 담벼락 길의 사냥개는 (5,0)·(8,0)·(11,0)에서 막습니다. 반란군 바로 뒤 (5,0)·(5,1)과 남쪽 길 (5,5)에 서면 세 길을 모두 앞에서 받습니다." },
    // a story-only entry between the crossroads and the checkpoint: no battle, no cost (the board is only here so the stage list stays one shape)
    { code: "IM-ST1", name: "불 꺼진 밤", map: MAP_C2.shadow, bg: null, hz: 0.5, ep: 2, story: true, startCost: 10, mul: { hp: 1, atk: 1, def: 1 }, waves: [],
      boss: ["", ""], desc: "갈림길의 반란군은 거의 남지 않았다. 검문소를 앞둔 밤, 불을 피우지 못한 채 모여 앉은 사람들.", lose: "" },
    { code: "IM-08", name: "황제가 죽었다", map: MAP_C2.barrier, bg: null, hz: 0.5, ep: 2, startCost: 10, mul: { hp: 0.52, atk: 0.64, def: 0.76 },
      // gates: 0 the north-east road (the gendarmes: hounds, pikemen, frost gunners, the drones), 1 the south-east road (the Emperor's column). Everything comes through the one gap (7,3);
      // the gendarmes then go round the checkpoint house by the north (vias), the column by the south. Two frost gunners stand on the wall either side of the gap until late.
      // The maddened are let loose from just behind the gap (MAD), so they reach us at the height of their frenzy. Three surges: 5-42, 55-110, 122-178
      vias: { 0: [[6, 1]] },
      waves: (() => { const POST = (x, y) => ({ at: [x, y], until: 130 }), MAD = (x, y, t, via) => ({ at: [x, y], wait: t + 1, via }), N = [[6, 1]], HOV_N = { air: [[9, 2, 4], [3, 2, 7], [0, 3]] }, HOV_S = { air: [[9, 4, 4], [2, 4, 7], [0, 3]] };
        return W1([[0.5, "frostgun", 0, 1, 0, POST(7, 1)], [0.5, "frostgun", 1, 1, 0, POST(7, 5)],
        [7, "yfang", 0, 2, 1.5], [12, "soldier", 1, 3, 2], [22, "lancer", 0, 1], [30, "yfang", 1, 3, 1.3], [36, "soldier", 0, 2, 2], [41, "frostgun", 0, 1],
        [55, "berserk", 1, 1, 0, MAD(8, 3, 55)], [60, "bomber", 0, 1, 0, HOV_N], [66, "lancer", 1, 2, 2], [74, "strag", 1, 5, 0.8], [76, "frostgun", 0, 1], [84, "yshield", 0, 1], [86, "soldier", 1, 3, 1.4], [91, "frostgun", 1, 1],
        [94, "berserk", 0, 1, 0, MAD(8, 2, 94, N)], [94, "berserk", 1, 1, 0, MAD(8, 4, 94)], [100, "yfang", 0, 4, 1], [102, "bomber", 1, 1, 0, HOV_S],
        [122, "iceguard", 1, 1, 0, MAD(8, 3, 122)], [126, "lancer", 0, 3, 1.5], [134, "soldier", 1, 4, 1.3], [140, "frostgun", 1, 1], [136, "yrazor", 0, 1], [144, "berserk", 0, 1, 0, MAD(8, 2, 144, N)], [144, "berserk", 1, 1, 0, MAD(8, 4, 144)], [146, "bomber", 0, 2, 5, HOV_N],
        [154, "yfang", 1, 4, 1], [156, "frostgun", 0, 1], [164, "lancer", 1, 3, 1.5], [166, "soldier", 0, 3, 1.3], [170, "frostgun", 0, 1], [172, "yrazor", 1, 1]]); })(),
      boss: ["", ""], desc: "세관 성벽 앞의 검문소. \"황제가 죽었다\"는 소문에 헌병대가 길을 막았습니다. 차단벽에 난 틈 하나(7,3)로 두 길의 적이 모두 빠져나온 뒤, 검문소 건물을 북쪽이나 남쪽으로 돌아 방어 지점으로 옵니다. 헌병대(북동쪽)는 북쪽으로, 황제군 종대(남동쪽)는 남쪽으로 돕니다. 틈 양옆 성벽 위에는 서리 사수 둘이 올라서서 틈 앞뒤를 겨누다가, 130초가 지나면 내려와 걸어옵니다. 창병은 몇 초마다 창을 낮추고 내달리며, 그 뒤 첫 일격이 두 배로 들어갑니다. 동상 광인은 틈 바로 뒤에서 풀려나 금세 미쳐 날뜁니다. 체력은 저절로 줄지만 오래 둘수록 감당할 수 없습니다. 얼음폭탄 드론은 벽을 넘어 우리 고지 위에 잠시 떠 있습니다.",
      lose: "성벽 위 사수는 바로 옆 칸 (6,1)·(6,5)에 근거리 가사인격을 세워 쓰러뜨릴 수 있습니다. 사수가 사라지면 벽 너머 마당을 보는 고지 (9,2)·(9,4)도 쓸 수 있습니다. 방어 지점 바로 앞에는 설 자리가 없으니, 북쪽과 남쪽 우회로를 각각 막아야 합니다. 동상 광인은 막자마자 화력을 모으세요." },
    { code: "IM-09", name: "세관 성벽", map: MAP_C2.wall, bg: null, hz: 0.5, ep: 2, startCost: 12, mul: { hp: 0.44, atk: 0.45, def: 0.78 }, rmul: { hp: 0.85, atk: 0.8 },
      wind: { dir: 1, first: 30, every: 32, dur: 12 },   // from the north: the wall takes it, but it pours down the gate column and the corner column
      // gates: 0 the boulevard outside (the slow and the armoured turn in at the toll gate, the hounds and the maddened run on round the corner), 1 the road inside (the Guard, and its carts:
      // each cart leaves a few seconds before the men who will bunch up behind it). Two white snipers lie on the customs roofs until late. Three surges: 5-42, 56-112, 124-178
      vias: { 0: [[12, 3]] },
      waves: (() => { const GATE = { via: [[6, 3]] }, CORNER = { via: [[12, 3]] }, POST = (x, y) => ({ at: [x, y], until: 90 });
        return W1([[0.5, "snowsniper", 0, 1, 0, POST(4, 2)], [0.5, "snowsniper", 0, 1, 0, POST(10, 2)], [0.5, "grenadier", 1, 1, 0, { at: [12, 4], until: 124, hp: 1.5, atk: 1.2 }],
        [5, "strag", 0, 4, 1.2, GATE], [10, "soldier", 1, 2, 2.5], [18, "yfang", 0, 3, 1.3, CORNER], [28, "grenadier", 1, 1],
        [58, "cart", 1], [60, "soldier", 1, 3, 1.5], [64, "frostgun", 0, 1, 0, GATE], [72, "yfang", 0, 3, 1.2, CORNER], [74, "yrazor", 0, 1, 0, CORNER], [80, "grenadier", 1, 2, 3], [88, "yshield", 0, 1, 0, GATE], [90, "berserk", 0, 1, 0, CORNER],
        [98, "strag", 0, 6, 0.8, GATE], [100, "soldier", 1, 4, 1.4], [106, "cart", 1], [109, "grenadier", 1, 1],
        [124, "iceguard", 1, 1], [128, "yfang", 0, 4, 1, CORNER], [130, "frostgun", 0, 2, 2.5, GATE], [136, "cart", 1], [139, "soldier", 1, 3, 1.3], [144, "berserk", 0, 2, 3, CORNER],
        [152, "grenadier", 1, 2, 2.5], [154, "drummer", 1, 1], [160, "yrazor", 0, 2, 2, CORNER], [162, "strag", 0, 6, 0.8, GATE], [168, "cart", 1], [171, "soldier", 1, 3, 1.2], [174, "yfang", 0, 3, 1, CORNER]]); })(),
      boss: ["", ""], desc: "성 안을 두른 세관 성벽. 바깥 큰길의 적은 통행세 문(6,3)으로 꺾어 들거나 동쪽 무너진 모퉁이(12,3)로 돌아 들어오고, 성 안 길로는 근위대와 화약 수레가 옵니다. 눈보라는 북쪽에서 불어와 성벽이 막아 주지만, 문 아래와 모퉁이 아래로는 그대로 들이칩니다. 화로(F) 둘레 여덟 칸은 얼지 않습니다. 세관 건물의 화로는 문 바깥 칸 (6,2)를, 무너진 모퉁이의 화로는 모퉁이 바깥 (12,2)와 안쪽 (12,4)를 덥힙니다. 성벽 바깥의 나머지 칸과 문 바로 아래 (6,4)는 눈보라마다 얼어붙습니다. 세관 지붕 (4,2)·(10,2)에는 설원 저격수가 엎드려 있다가 90초가 지나면 일어나 걸어옵니다. 곰가죽 모자의 근위 척탄병은 단단하고 둘 몫으로 저지됩니다. 모퉁이 안쪽 (12,4)에는 척탄병 하나가 처음부터 초소를 지키다가, 124초가 지나면 방어 지점으로 걸어옵니다.",
      lose: "문은 바깥 (6,2)에서 막으면 얼지 않지만 저격수가 겨누고, 안쪽 (6,4)에서 막으면 눈보라마다 얼어붙습니다. 모퉁이로 들어오는 적은 바깥 (12,2)나 안쪽 (12,4)에서 막습니다. 바깥은 저격수 (10,2)의 사거리 안이고, 안쪽은 방어 지점 바로 곁이지만 초소의 척탄병부터 쓰러뜨려야 설 수 있습니다. 성벽 그늘의 고지 (11,4)가 모퉁이를 내려다봅니다. 수레는 근위대 한가운데서 터지게 하세요." },
    { code: "IM-10", name: "지옥 기계", map: MAP_C2.gate, bg: null, hz: 0.5, ep: 2, startCost: 12, mul: { hp: 0.46, atk: 0.46, def: 0.8 },
      wind: { dir: 2, first: 36, every: 36, dur: 12 },   // out of the gate, from the east: down both roads; the towers shelter the rows beside and between them
      vias: { 1: [[10, 2]], 2: [[10, 4]] },   // the mouths: each gate road files through the windbreak square before the towers
      // gates: 0 the north side street (carts), 1 the gate's upper road, 2 the gate's lower road, 3 the south side street (carts and hounds). Four movements: the Guard comes out (4-44),
      // pikemen, carts and the first drums (58-92), the eagle (96: he plants the standard in the gate's throat, then comes down the lower road, halting once more below the monument;
      // twice he raises it — grenadiers behind him, the blizzard out of the gate), and everything at once (130-190).
      // Posts: two snipers on the tower rises (11,1) and (11,5) from the start, aiming in front of the gate; at 130 they come down and walk in with the rest
      waves: (() => { const EAGLE = { via: [[10, 4], [10, 3, 9], [7, 4, 5], [2, 4]] }, CROSS = { via: [[10, 2], [10, 3], [7, 4]] }, HOV_P = { air: [[10, 1, 4], [6, 3, 6], [3, 3, 5], [0, 3]] }, HOV_S = { air: [[11, 5, 4], [8, 3, 5], [1, 5, 5], [0, 3]] };
        return W1([[0.5, "snowsniper", 1, 1, 0, { at: [11, 1], until: 130, hp: 0.8, atk: 0.6 }], [0.5, "snowsniper", 2, 1, 0, { at: [11, 5], until: 130, hp: 0.8, atk: 0.6 }],
        [5, "soldier", 1, 2, 2.5], [12, "soldier", 2, 2, 2.5], [18, "cart", 0], [24, "grenadier", 1, 1], [30, "yfang", 3, 3, 1.3], [38, "soldier", 2, 3, 1.4], [40, "drummer", 2, 1],
        [58, "lancer", 1, 2, 2], [62, "cart", 3], [64, "yshield", 2, 1], [70, "frostgun", 1, 1], [78, "grenadier", 2, 2, 3], [80, "drummer", 2, 1], [86, "bomber", 1, 1, 0, HOV_P], [90, "cart", 0], [92, "chouang", 0, 3, 1.4],
        [96, "eagle", 2, 1, 0, EAGLE], [100, "soldier", 1, 4, 1.5], [110, "yfang", 3, 4, 1], [112, "lancer", 2, 2, 2],
        [130, "grenadier", 1, 2, 3], [134, "cart", 0], [135, "cart", 3], [140, "grenadier", 2, 2, 2.5], [143, "drummer", 2, 1], [148, "frostgun", 1, 2, 2.5], [150, "bomber", 2, 2, 6, HOV_S], [156, "yshield", 1, 1, 0, CROSS], [168, "yfang", 3, 3, 1],
        [164, "lancer", 1, 2, 1.5], [172, "soldier", 1, 6, 1.2], [175, "drummer", 1, 1], [180, "cart", 3], [182, "yrazor", 3, 1], [184, "grenadier", 1, 1]]); })(),
      boss: ["경고: 황제의 독수리", "독수리 기수 · WARNING"], desc: "성문 앞 광장. 근위대가 두 탑 사이 성문에서 쏟아져 나와 위쪽 길과 아래쪽 길로 광장을 건너옵니다. 두 길 사이에는 기념비와 그 계단(고지)이 있고, 성문 목 (10,3)이 두 길을 잇습니다. 반란군의 지옥 기계는 북쪽과 남쪽 골목에서 광장 서쪽으로 굴러 내려옵니다. 눈보라는 성문에서, 동쪽에서 불어와 두 길을 따라 들이치고, 탑 뒤의 줄과 가운데 줄은 바람을 피합니다. 길 위에 선 가사인격은 얼어붙는 대신 그 뒤를 지켜 줍니다. 두 탑 위 (11,1)·(11,5)에는 설원 저격수가 올라가 성문 앞을 겨누다가, 130초가 지나면 내려와 걸어옵니다. 독수리 기수는 성문 목에 군기를 꽂고 한참 서 있다가 아래쪽 길로 오고, 기념비 아래 (7,4)에서 한 번 더 멈춰 섭니다. 군기 둘레의 적은 빨라지고 세집니다. 체력이 2/3, 1/3로 줄 때마다 군기를 치켜들어 보병을 불러 세우고, 성문에서 눈보라가 한 번 더 불어옵니다.",
      lose: "성문 가까운 (10,2)·(10,4)에 선 가사인격은 눈보라를 맞는 대신 그 뒤의 길 전체를 지켜 줍니다. 이 두 칸은 성문에서 나오는 근위대가 모두 지나는 길목이기도 합니다(골목의 수레와 사냥개는 그 뒤로 들어옵니다). 탑 위 저격수의 사거리 안이니, 저격수부터 쓰러뜨리세요. 독수리 기수의 체력을 깎을 때는 눈보라가 곧 불어온다는 것을 먼저 떠올리세요. 수레는 기념비 옆을 지날 때 그의 곁에서 터뜨리면 크게 아픕니다. 북과 군기 둘레의 적은 훨씬 빠르니, 고수를 먼저 떨어뜨리세요." },
    // a side branch shown under IM-01 and open with chapter 2: the terminal's lesson on the blizzard, with a fixed squad (lines by 유진)
    { code: "TR-03", name: "눈보라 학습", map: MAP_C2.lesson, bg: null, hz: 0.5, ep: 2, branch: "IM-01", startCost: 30, mul: { hp: 0.245, atk: 0.262, def: 0.5 },
      wind: { dir: 3, first: 30, every: 34, dur: 14, durs: [10] },
      waves: W1([[3, "strag", 1, 3, 1.5], [9, "chouan", 0, 1, 2], [22, "chouan", 1, 1, 1.6], [30, "strag", 1, 4, 1.2], [38, "yshield", 0, 1, 1.5], [46, "chouan", 0, 2, 1.4],
        [52, "soldier", 1, 2, 3], [60, "strag", 0, 4, 1], [66, "chouan", 1, 2, 1.2], [74, "yshield", 1, 1, 1.2], [82, "soldier", 0, 2, 3], [90, "chouan", 0, 2, 1]]),
      boss: ["", ""], desc: "눈보라를 막는 법을 익힙니다. 남쪽에서 번져 오는 눈보라 앞을 가사인격이 막으면 그 뒤는 얼지 않습니다. 올라온 벽 뒤는 안전하고, 진창은 막든 말든 얼어붙습니다.",
      lose: "맨 아래 줄 빈칸에 선봉을 바람막이로 세우세요. 두 길 사이 올라온 벽 뒤(위쪽 길)는 처음부터 안전합니다." },
    // ======== chapter 3 (working title 「쏘지 않은 탄환」): the capital, the Emperor who came back, the confessor ========
    // ---- chapter 3 (second cut) ----
    // act 1, the Prefect's order: the dark. A street lamp lights two squares round it; whatever stands outside the light cannot be seen, and once it is held or met there only
    // those right beside it can strike it. A lamp is kept by whoever stands right beside it (above, below, left, right)
    { code: "WL-01", name: "불 꺼진 거리", map: MAP_C3.lamps1, bg: null, hz: 0.5, ep: 3, startCost: 10, mul: { hp: 1.31, atk: 1.23, def: 0.85 }, rmul: { hp: 1, atk: 0.75 },
      lamps: { r: 2, events: [{ t: 80, off: [[1, 0]] }, { t: 125, off: [[5, 6]] }] },   // the two lamps nearest the point run dry in turn, unless somebody is standing by them
      // gates: 0 the upper street, 1 the lower. No surges here: a patrol every eight seconds or so, now on one street, now on the other, and from 76 on some of them change
      // streets by the cross street, in the dark
      waves: (() => { const U1 = { via: [[11, 1], [1, 1]] }, U2 = { via: [[10, 1], [9, 2], [2, 2]] }, L4 = { via: [[12, 4], [3, 4]] }, L5 = { via: [[11, 4], [10, 5], [2, 5], [1, 4]] },
        X = { via: [[10, 1], [7, 2], [7, 4], [3, 4]] }, Y = { via: [[11, 4], [6, 4], [6, 2], [2, 2]] };
        return W1([[5, "soldier", 0, 2, 2, U2], [16, "soldier", 1, 2, 2, L4], [26, "dog", 0, 2, 1.4, U2], [34, "soldier", 1, 2, 2, L4], [42, "chasseur", 0, 1, 0, U2], [50, "dog", 1, 2, 1.3, L4],
        [58, "soldier", 0, 2, 1.6, U1], [62, "chasseur", 0, 1, 0, U1], [64, "soldier", 1, 3, 1.6, L5], [72, "grenadier", 0, 1, 0, U2], [78, "dog", 0, 3, 1.2, X], [86, "chasseur", 1, 1, 0, L4], [92, "soldier", 1, 3, 1.5, Y], [100, "soldier", 0, 3, 1.5, U2],
        [110, "grenadier", 1, 1, 0, L4], [116, "dog", 1, 3, 1.1, L5], [124, "soldier", 0, 3, 1.4, U1], [130, "chasseur", 0, 1, 0, U2], [134, "soldier", 1, 2, 1.4, L4], [142, "dog", 0, 3, 1, U1],
        [148, "grenadier", 0, 1, 0, U2], [152, "soldier", 1, 3, 1.3, L5], [156, "chasseur", 1, 1, 0, L5], [158, "soldier", 0, 3, 1.3, X], [164, "grenadier", 1, 1, 0, L4], [170, "soldier", 0, 3, 1.3, U1], [172, "dog", 1, 3, 1, L5]]); })(),
      boss: ["", ""], desc: "성 안의 밤거리. 가로등 넷이 둘레 두 칸씩을 비춥니다. 등불 밖의 적은 보이지 않고, 어둠 속에서 막아 세운 적은 곁 칸의 근거리 가사인격만 칠 수 있습니다. 80초와 125초에 등 둘이 기름이 떨어져 꺼집니다. 두 길의 순찰대는 각각 동쪽 등 아래 (10,1)·(11,4)를 지나 들어옵니다.",
      lose: "저지선은 등불 아래에 세우세요. 깜빡이는 등은 바로 옆 칸에 누군가 서 있으면 꺼지지 않습니다. 꺼진 등은, 꺼진 뒤 옆 칸에 새로 배치된 가사인격이 6초 서 있으면 다시 켜집니다. 동쪽 등 아래 (10,1)·(11,4)는 순찰대가 줄지어 지나는 길목입니다. 거기서 막으면 한 칸으로 길 하나를 받지만, 방어 지점에서 멀어 뚫리면 다시 세울 틈이 없습니다." },
    { code: "WL-02", name: "빵집 앞 줄", map: MAP_C3.lamps2, bg: null, hz: 0.5, ep: 3, startCost: 12, mul: { hp: 1.12, atk: 1.12, def: 0.85 }, rmul: { hp: 1, atk: 0.75 },
      lamps: { r: 2 },
      // gates: 0 the north alley (it drops into the street's dark middle), 1 the west end of the street, 2 the east end. Four rounds, each led by a lamplighter's opposite:
      // the snuffer walks his round — street lamp, then down the steps to the door lamp — and what follows him comes through the dark he leaves. Short and tight: over by 165
      waves: (() => { const WS = { via: [[2, 1], [4, 1], [4, 3], [4, 6]] }, W2 = { via: [[5, 2], [5, 5]] }, ES = { via: [[11, 1], [9, 1], [9, 3], [9, 6]] }, E2 = { via: [[8, 2], [8, 5]] },
        NE = { via: [[9, 3], [8, 5]] }, NW = { via: [[9, 1], [5, 1], [5, 5]] }, NS = { via: [[9, 3], [9, 6]] };
        return W1([[5, "soldier", 1, 2, 2, W2], [10, "soldier", 2, 2, 2, E2], [18, "snuffer", 1, 1, 0, WS], [26, "dog", 0, 2, 1.4, NE],
        [44, "snuffer", 2, 1, 0, ES], [46, "soldier", 2, 3, 1.5, E2], [52, "chasseur", 1, 1, 0, W2], [58, "dog", 0, 3, 1.2, NW], [64, "grenadier", 1, 1, 0, WS], [70, "soldier", 1, 2, 1.5, W2], [73, "chasseur", 1, 1, 0, W2],
        [84, "snuffer", 1, 1, 0, WS], [85, "snuffer", 0, 1, 0, NS], [88, "soldier", 2, 4, 1.4, ES], [94, "lancer", 1, 2, 2, W2], [100, "chasseur", 2, 1, 0, E2], [106, "dog", 0, 3, 1.1, NE], [110, "grenadier", 2, 1, 0, E2],
        [124, "snuffer", 1, 1, 0, WS], [125, "snuffer", 2, 1, 0, ES], [128, "grenadier", 1, 1, 0, W2], [132, "soldier", 2, 3, 1.3, E2], [136, "chasseur", 2, 1, 0, E2], [136, "dog", 0, 3, 1, NW], [140, "chasseur", 1, 1, 0, WS], [142, "chasseur", 2, 1, 0, ES],
        [146, "soldier", 1, 3, 1.3, W2], [150, "drummer", 2, 1, 0, E2], [154, "lancer", 2, 2, 2, E2], [158, "grenadier", 0, 1, 0, NE]]); })(),
      boss: ["", ""], desc: "빵집 앞. 방어 지점은 아래쪽 한가운데의 두 짝 문입니다. 소등부가 큰길의 등부터 문 옆 등까지 돌며, 옆 칸에 아무도 없는 등을 전부 끕니다. 꺼진 등은, 꺼진 뒤 옆 칸에 새로 배치된 가사인격이 6초 서 있으면 다시 켜집니다.",
      lose: "문 옆 등 둘은 그 곁의 고지에서만 지킬 수 있습니다. 여덟 자리로 다섯 등을 다 지킬 수는 없습니다. 소등부를 먼저 쓰러뜨려도 됩니다." },
    { code: "WL-03", name: "경찰청 뒷마당", map: MAP_C3.lamps3, bg: null, hz: 0.5, ep: 3, startCost: 12, mul: { hp: 1.39, atk: 1.24, def: 0.85 }, rmul: { hp: 1, atk: 0.75 },
      lamps: { r: 2, off: [[4, 2], [7, 2]], relight: 4 },   // here a fresh keeper lights a lamp in 4 s
      // gates: 0 the north gate, 1 the main gate (east). Points: the cell door (0,3) and the wagon gate (7,6). POST: the Guard's marksmen in the dark, one over each point.
      // TIED: the rebels taken last night, under the dead east lamp (7,2): light it and they are loose, and they hold the way to the wagon gate.
      // Three movements: a look at both points (6-34), the informers with marksmen behind them (50-92), and a snuffer for the one lamp that was burning by the gate (110-160)
      waves: (() => { const POST = (x, y) => ({ at: [x, y], until: 150, hp: 1.5 }), TIED = (x, y) => ({ at: [x, y], ally: true, wait: true, hp: 0.44, atk: 0.56 }),
        EW = { via: [[11, 2], [3, 3], [0, 3]] }, ES = { via: [[11, 2], [9, 4], [8, 4], [7, 4], [7, 5], [7, 6]] }, NW = { via: [[5, 2], [2, 2], [0, 3]] }, NS = { via: [[5, 3], [5, 4], [7, 6]] }, SN = { via: [[11, 1], [9, 2], [5, 3], [3, 3], [0, 3]] };
        return W1([[0.5, "chasseur", 1, 1, 0, POST(6, 3)], [0.5, "chasseur", 1, 1, 0, POST(1, 1)], [0, "chouang", 1, 1, 0, TIED(7, 4)], [0, "chouang", 1, 1, 0, TIED(8, 4)], [0, "chouang", 1, 1, 0, TIED(6, 4)],
        [6, "soldier", 1, 3, 2, EW], [18, "dog", 0, 2, 1.4, NS], [20, "soldier", 1, 2, 2, ES], [26, "mouchard", 1, 1, 0, EW], [34, "soldier", 0, 2, 2, NW],
        [50, "grenadier", 1, 1, 0, ES], [54, "mouchard", 0, 1, 0, NW], [56, "chasseur", 1, 1, 0, EW], [62, "soldier", 1, 4, 1.4, EW], [70, "dog", 0, 3, 1.2, NW], [76, "soldier", 0, 3, 1.5, NS], [84, "lancer", 1, 2, 2, ES], [88, "mouchard", 1, 1, 0, ES], [92, "chasseur", 0, 1, 0, NS],
        [110, "snuffer", 1, 1, 0, SN], [112, "grenadier", 1, 2, 3, EW], [118, "mouchard", 0, 1, 0, NS], [120, "soldier", 0, 3, 1.4, NW], [126, "dog", 1, 4, 1.1, ES], [134, "chasseur", 1, 2, 3, EW], [140, "soldier", 1, 4, 1.3, ES], [142, "drummer", 1, 1, 0, ES],
        [148, "lancer", 0, 2, 2, NW], [152, "mouchard", 1, 1, 0, EW], [156, "grenadier", 0, 1, 0, NS], [160, "soldier", 1, 4, 1.3, EW]]); })(),
      boss: ["", ""], desc: "경찰청 뒷마당, 동트기 전. 방어 지점은 서쪽 유치장 문과 남쪽 마차 문, 둘입니다. 가운데 등 둘은 꺼져 있고, 그 어둠 속 고지 두 곳에서 근위 엽병이 겨누고 있습니다. 꺼진 동쪽 등 아래에는 반란군 셋이 묶여 있습니다. 밀고자가 지목한 가사인격은 10초 동안 1.6배로 맞습니다.",
      lose: "꺼진 등 옆 칸에 가사인격을 배치하고 4초를 버티면 등이 켜집니다. 동쪽 등이 켜지면 묶인 셋이 풀려 남쪽 문 앞을 막습니다. 북서쪽 고지의 엽병은 등으로 비출 수 없으니 근거리 가사인격을 곁에 붙이세요. 정문으로 들어오는 적은 모두 정문 등 아래 (11,2)를, 북문으로 들어오는 적은 (5,2)를 지납니다." },
    // act 2, the Emperor's order: grapeshot. A gun fires down its line on a timetable, warned first. It takes a third of whatever of ours stands in the line, armour or no,
    // and far less of theirs. Stand on the square before the muzzle and it is silent; hold that square eight seconds and the gun is ours, firing only at them
    { code: "WL-04", name: "성당 계단", map: MAP_C3.steps, bg: null, hz: 0.5, ep: 3, startCost: 14, mul: { hp: 1.06, atk: 1.166, def: 0.85 }, rmul: { hp: 1, atk: 0.75 },
      // every third shot of each gun goes down the outer row of its street; a gun of ours fires every 13 s down both rows and takes 30% of each foe's strength
      volleys: [{ first: 30, every: 26, warn: 4, dmg: 700, pct: 0.35, foe: 0.3, mine: 1.7, mineEvery: 13, minePct: 0.3, capture: 8, linger: 20, muzzle: [11, 2], gun: [13, 2], tiles: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((x) => [x, 2]),
                  alt: { every: 3, tiles: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((x) => [x, 1]) } },
                { first: 43, every: 26, warn: 4, dmg: 700, pct: 0.35, foe: 0.3, mine: 1.7, mineEvery: 13, minePct: 0.3, capture: 8, linger: 20, muzzle: [11, 5], gun: [13, 5], tiles: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((x) => [x, 5]),
                  alt: { every: 3, tiles: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((x) => [x, 6]) } }],   // thirteen seconds apart: a round every thirteen
      // gates: 0 the north alley, 1 the upper east gate, 2 the lower. The pickets: a grenadier of the gun crews on each muzzle square. CROWD: the royalist sections, come out for the wrong
      // king on the right day (13 Vendémiaire, before this very church): they stand with us in the two lines of fire. A platoon comes in behind every round: the guns are the clock
      waves: (() => { const NF = { via: [[12, 2], [2, 2], [1, 3]] }, NO = { via: [[12, 1], [1, 1], [1, 3]] }, SF = { via: [[12, 5], [2, 5], [1, 4]] }, SO = { via: [[12, 6], [1, 6], [1, 4]] },
        XS = { via: [[12, 2], [8, 2], [8, 5], [2, 5], [1, 4]] }, AL = { via: [[7, 2], [5, 2], [5, 5], [1, 4]] }, CROWD = (x, y) => ({ at: [x, y], ally: true });
        return W1([[0.5, "grenadier", 1, 1, 0, { at: [11, 2], until: 150 }], [0.5, "grenadier", 2, 1, 0, { at: [11, 5], until: 150 }], [0, "chouang", 1, 1, 0, CROWD(5, 2)], [0, "chouang", 1, 1, 0, CROWD(6, 2)], [0, "chouang", 2, 1, 0, CROWD(8, 5)], [0, "chouang", 2, 1, 0, CROWD(9, 5)],
        [8, "soldier", 1, 2, 2.5, NF], [16, "soldier", 2, 2, 2, SO], [24, "dog", 0, 2, 1.4, AL],
        [32, "soldier", 1, 3, 1.6, NO], [36, "grenadier", 2, 1, 0, SF], [45, "soldier", 2, 2, 1.6, SF], [48, "chasseur", 2, 1, 0, SF], [50, "chasseur", 1, 1, 0, NO],
        [58, "lancer", 1, 2, 2, NF], [62, "dog", 0, 3, 1.2, AL], [71, "soldier", 2, 4, 1.4, SO], [76, "mouchard", 1, 1, 0, NO], [84, "grenadier", 1, 1, 0, NF], [88, "soldier", 1, 2, 1.5, XS], [91, "chasseur", 1, 1, 0, XS], [97, "soldier", 2, 3, 1.5, SF], [99, "drummer", 2, 1, 0, SF],
        [110, "grenadier", 2, 1, 0, SO], [114, "chasseur", 2, 1, 0, SF], [123, "soldier", 1, 3, 1.3, NF], [128, "chasseur", 1, 1, 0, NF], [127, "dog", 0, 4, 1, AL], [136, "lancer", 2, 2, 2, SF], [140, "soldier", 1, 4, 1.3, NO], [142, "drummer", 1, 1, 0, NO],
        [149, "grenadier", 1, 1, 0, XS], [153, "chasseur", 1, 1, 0, NF], [162, "soldier", 2, 4, 1.2, SF], [167, "chasseur", 2, 1, 0, SF], [166, "grenadier", 1, 1, 0, NF]]); })(),
      boss: ["", ""], desc: "성당 계단 앞. 대포 두 문이 두 길에 포도탄을 쏩니다(26초마다, 4초 전 표시). 두 발은 안쪽 줄, 세 발째는 바깥 줄입니다. 줄 위의 가사인격은 최대 체력의 35%를 잃고, 근위대는 거의 다치지 않습니다. 길 한가운데의 왕당파 시민 넷도 함께 맞습니다. 포구 앞 칸에 서면 포가 멈추고, 8초를 지키면 빼앗습니다.",
      lose: "포구 앞은 척탄병이 지킵니다(150초에 스스로 내려옵니다). 술사로 먼저 쓰러뜨리세요. 빼앗은 포는 13초마다 그 길의 두 줄을 모두 쏘아, 적마다 최대 체력의 30%를 깎습니다. 자리를 떠나도 20초 동안은 우리 편입니다. 포 하나를 빼앗고 남은 길에 힘을 모으세요." },
    { code: "WL-05", name: "대성당 앞", map: MAP_C3.nave, bg: null, hz: 0.5, ep: 3, startCost: 14, mul: { hp: 1.23, atk: 1.12, def: 0.85 }, rmul: { hp: 1, atk: 0.75 },
      lamps: { r: 2 },
      volleys: [{ first: 34, every: 26, warn: 4, dmg: 700, pct: 0.35, foe: 0.3, mine: 1.7, capture: 8, linger: 20, muzzle: [4, 1], gun: [4, 0], tiles: [2, 3, 4, 5].map((y) => [4, y]) },
                { first: 47, every: 26, warn: 4, dmg: 700, pct: 0.35, foe: 0.3, mine: 1.7, capture: 8, linger: 20, muzzle: [10, 1], gun: [10, 0], tiles: [2, 3, 4, 5].map((y) => [10, y]) }],
      // gates: 0 the cathedral door, 1 the upper east gate, 2 the lower. The colonel comes out early (70) and stands under the door between his guns for twenty-two seconds:
      // while he stands there no gun can be silenced or taken. Then he walks, pointing: a called shot every twelve seconds. At two thirds, "lights out"; at one third, "every gun"
      waves: (() => { const POST = (x, y) => ({ at: [x, y], until: 150 }), BOSS = { via: [[7, 1, 22], [7, 3], [4, 4], [2, 4]] },
        N1 = { via: [[11, 1], [2, 1], [1, 3]] }, M1 = { via: [[11, 2], [4, 3], [1, 3]] }, M2 = { via: [[11, 4], [4, 4], [2, 4]] }, S2 = { via: [[11, 5], [2, 5]] }, DS = { via: [[7, 3], [4, 4], [2, 4]] },
        SN1 = { via: [[9, 1], [7, 1], [2, 1], [1, 3]] }, SN2 = { via: [[9, 4], [7, 4], [4, 4], [2, 4]] };
        return W1([[0.5, "soldier", 0, 1, 0, POST(4, 1)], [0.5, "soldier", 0, 1, 0, POST(10, 1)],
        [6, "soldier", 1, 2, 2, M1], [22, "soldier", 2, 2, 2, M2], [30, "snuffer", 1, 1, 0, SN1], [34, "dog", 2, 2, 1.5, S2], [42, "chasseur", 2, 1, 0, M2],
        [48, "grenadier", 1, 1, 0, M1], [52, "soldier", 2, 3, 1.5, S2], [58, "mouchard", 1, 1, 0, N1], [62, "lancer", 1, 2, 2, N1],
        [70, "colonel", 0, 1, 0, BOSS], [74, "soldier", 1, 3, 1.5, N1], [86, "dog", 2, 3, 1.2, S2], [94, "chasseur", 1, 1, 0, M1], [104, "snuffer", 1, 1, 0, SN1], [112, "soldier", 1, 2, 1.5, N1],
        [124, "grenadier", 2, 1, 0, S2], [136, "lancer", 1, 2, 2, N1], [146, "soldier", 2, 3, 1.4, M2], [148, "drummer", 2, 1, 0, M2], [156, "chasseur", 2, 1, 0, S2], [160, "soldier", 0, 3, 1.4, DS],
        [166, "grenadier", 1, 1, 0, M1], [172, "soldier", 2, 4, 1.3, M2], [174, "mouchard", 2, 1, 0, M2], [180, "dog", 1, 4, 1, N1], [184, "grenadier", 0, 1, 0, DS]]); })(),
      boss: ["경고: 대관식의 예포", "의장 포병 대령 · WARNING"], desc: "대성당 앞 광장. 예포 두 문이 남쪽으로 쏘고, 모든 길이 그 두 줄을 가로지릅니다. 70초에 의장 포병 대령이 성당 문으로 나옵니다. 문 아래 서 있는 22초 동안은 포를 멈추거나 빼앗을 수 없습니다.",
      lose: "대령은 둘 몫으로 저지됩니다. 가리킴 표시는 의무 가사인격부터 노립니다. 맞으면 최대 체력의 35%를 잃고 2초 동안 손이 멎으니, 그 곁 칸을 비워 두세요. \"소등\"에는 모든 등이 꺼집니다. 등 옆에 서 있던 가사인격은 14초 만에, 새로 세운 가사인격은 6초 만에 다시 켭니다. 등 셋을 다 지키려 들지 말고, 둘만 지키고 남는 한 명은 대령이 걸어 나온 뒤 포구 앞에 세우세요. \"전 포문\"은 대령을 쓰러뜨리면 멈춥니다." },
    // a story-only entry: the confessional (no battle, no cost)
    { code: "WL-ST", name: "고해실", map: MAP_C3.nave, bg: null, hz: 0.5, ep: 3, story: true, startCost: 10, mul: { hp: 1, atk: 1, def: 1 }, waves: [],
      boss: ["", ""], desc: "대관식이 끝난 밤. 성당 뒷문은 열려 있었고, 고해실에는 불이 켜져 있었다.", lose: "" },
    // act 3, Waterloo: the cavalry charge and the square. Horsemen ride down a line from off the board (no cavalry stands on the board): whoever has one of ours right beside
    // them is in a square and loses little; whoever stands alone loses most of what they have
    { code: "WL-06", name: "우구몽 농장", map: MAP_C3.farm, bg: null, hz: 0.5, ep: 3, startCost: 10, mul: { hp: 0.94, atk: 0.98, def: 0.85 }, rmul: { hp: 1, atk: 0.75 },
      volleys: [{ kind: "charge", first: 28, every: 30, warn: 5, dmg: 1100, pct: 0.6, tiles: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((x) => [x, 1]),
                  alt: { every: 2, tiles: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((x) => [x, 2]) } },   // the north charge rides the two rows of the field in turn
                { kind: "charge", first: 43, every: 30, warn: 5, dmg: 1100, pct: 0.6, tiles: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((x) => [x, 6]) }],
      // gates (all in the west): 0 the north field, 1 the farm lane, 2 the south field. Columns of foot, thick and regular, and pikemen at their head; some turn in through
      // the gaps in the farm wall. The north field first (5-40), then all three (50-100), then everything with the Guard down the lane (116-170)
      // POST: a Guard chasseur already up on the farm wall rise before the point (11,3) from the start; at 116 he comes down and walks in with the rest
      waves: (() => { const N1 = { via: [[11, 1], [12, 1]] }, N2 = { via: [[3, 1], [4, 2], [11, 2]] }, S = { via: [[11, 6]] }, NX = { via: [[3, 1], [6, 2], [6, 3], [6, 4]] }, SX = { via: [[7, 6], [7, 5], [7, 4]] };
        return W1([[0.5, "chasseur", 1, 1, 0, { at: [11, 3], until: 116, hp: 1.4 }],
        [5, "soldier", 0, 2, 2, N1], [14, "soldier", 0, 2, 2, N2], [24, "lancer", 0, 1, 0, N1], [36, "soldier", 1, 2, 2], [44, "chasseur", 0, 1, 0, N2],
        [54, "soldier", 2, 2, 2, S], [60, "soldier", 0, 2, 1.5, N2], [63, "chasseur", 0, 1, 0, N2], [66, "grenadier", 1, 1], [72, "lancer", 2, 1, 0, S], [78, "soldier", 0, 2, 1.5, NX], [84, "soldier", 1, 2, 1.5], [86, "drummer", 1, 1], [94, "chasseur", 2, 1, 0, S], [100, "lancer", 0, 2, 2, N1], [104, "soldier", 2, 2, 1.5, SX],
        [118, "grenadier", 0, 1, 0, N2], [122, "soldier", 0, 3, 1.4, N1], [126, "soldier", 2, 3, 1.4, S], [134, "grenadier", 1, 1], [136, "chasseur", 1, 1], [142, "lancer", 0, 2, 2, N2], [146, "lancer", 2, 2, 2, S], [152, "soldier", 1, 2, 1.4], [154, "drummer", 1, 1], [156, "chasseur", 1, 1],
        [160, "soldier", 0, 2, 1.4, NX], [164, "grenadier", 2, 1, 0, S], [170, "soldier", 0, 3, 1.3, N1], [172, "soldier", 2, 2, 1.4, S]]); })(),
      boss: ["", ""], desc: "능선 오른쪽 끝의 농장. 적은 서쪽에서 오고 방어 지점은 동쪽입니다. 흉갑기병이 북쪽 들판의 두 줄을 번갈아, 그리고 남쪽 들판을 따라 돌격합니다(30초마다, 5초 전 표시). 혼자 서 있으면 최대 체력의 60%를 잃고 2초 동안 흐트러집니다. 바로 옆 칸에 다른 가사인격이 있으면 방진으로 15%만 잃습니다. 방어 지점 앞 농장 담 위 (11,3)에는 근위 엽병 하나가 먼저 올라가 있다가, 116초가 지나면 내려와 걸어옵니다.",
      lose: "북쪽 들판은 위아래 두 칸을 나란히 막으면 그대로 방진입니다. 남쪽 들판은 담의 틈에 한 명을 붙이세요. 농장 안길에는 돌격이 오지 않습니다. 북쪽 들판의 종대는 모두 바깥 줄 (3,1)을 지난 뒤에 두 줄로 갈라집니다. (3,1)·(3,2)에 나란히 서면 북쪽 들판을 들머리에서 받습니다." },
    // a story-only entry between the two farms: the empty saddle (no battle, no cost)
    { code: "WL-ST2", name: "빈 안장", map: MAP_C3.farm, bg: null, hz: 0.5, ep: 3, story: true, startCost: 10, mul: { hp: 1, atk: 1, def: 1 }, waves: [], boss: ["", ""], desc: "돌격과 돌격 사이. 헛간 벽 틈으로, 안장이 빈 말 한 마리가 보였다.", lose: "" },
    { code: "WL-07", name: "라에생트", map: MAP_C3.sainte, bg: null, hz: 0.5, ep: 3, startCost: 14, mul: { hp: 1.1, atk: 1.1, def: 0.85 }, rmul: { hp: 1, atk: 0.75 },
      volleys: [{ kind: "charge", first: 30, every: 32, warn: 5, dmg: 1100, pct: 0.6, tiles: [1, 2, 3, 4, 5, 6].map((y) => [2, y]) },
                { kind: "charge", first: 46, every: 32, warn: 5, dmg: 1100, pct: 0.6, tiles: [1, 2, 3, 4, 5, 6].map((y) => [11, y]) },
                { first: 62, every: 32, warn: 4, dmg: 700, pct: 0.22, foe: 0.3, mine: 1.7, mineEvery: 13, minePct: 0.2, pack: 1.6, capture: 8, linger: 20, muzzle: [12, 5], gun: [13, 5], tiles: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((x) => [x, 5]) }],   // the gun on the cross road from 62 on: a packed square takes more of it
      shifts: [{ t: 100, warn: 12, set: [[6, 1, ","], [7, 1, ","]], banner: ["농장 문이 부서졌다", "THE GATE IS DOWN"] }],   // the farm's north gate breaks at 100 s
      // gates: 0 the west lane's head (3,0), 1 the farm gate (6,0), 2 the east lane's head (10,0), 3 the east side (13,2). Points: the foot of each lane. POST: the gun's picket.
      // Three movements: the two lanes in turn (5-50); the gun and the cross road (60-94); the gate falls at 100 and the yard is the main road (102-176)
      waves: (() => { const WA = { via: [[2, 1], [2, 6], [3, 7]] }, WB = { via: [[2, 1], [2, 2], [3, 3], [3, 6], [3, 7]] }, EA = { via: [[11, 1], [11, 6], [10, 7]] }, EB = { via: [[11, 1], [11, 2], [10, 3], [10, 6], [10, 7]] }, EG = { via: [[11, 2], [11, 6], [10, 7]] },
        WX = { via: [[2, 1], [2, 2], [3, 3], [3, 5], [9, 5], [10, 6], [10, 7]] }, MW = { via: [[6, 1], [6, 2], [6, 4], [6, 5], [3, 5], [3, 6], [3, 7]] }, ME = { via: [[6, 1], [6, 2], [7, 3], [7, 4], [7, 5], [10, 5], [10, 6], [10, 7]] }, POST = (x, y) => ({ at: [x, y], until: 150 });
        return W1([[0.5, "soldier", 3, 1, 0, Object.assign(POST(12, 5), { hp: 2, atk: 1.3 })],   // the gun's picket is a picked man
        [10, "soldier", 0, 2, 2, WB], [18, "soldier", 0, 2, 2, WA], [26, "lancer", 0, 1, 0, WB], [34, "soldier", 2, 2, 2, EB], [44, "soldier", 3, 2, 2, EG], [50, "chasseur", 2, 1, 0, EA],
        [60, "soldier", 2, 2, 1.5, EB], [63, "chasseur", 2, 1, 0, EB], [64, "grenadier", 0, 1, 0, WB], [70, "lancer", 3, 1, 0, EG], [76, "soldier", 0, 2, 1.5, WX], [84, "soldier", 2, 2, 1.5, EA], [86, "drummer", 2, 1, 0, EB], [94, "chasseur", 0, 1, 0, WA],
        [102, "soldier", 1, 3, 1.4, MW], [104, "soldier", 1, 2, 1.4, ME], [108, "lancer", 1, 2, 2, ME], [114, "mouchard", 3, 1, 0, EG], [118, "grenadier", 1, 1, 0, MW], [122, "soldier", 0, 2, 1.4, WB], [125, "chasseur", 0, 1, 0, WB], [128, "soldier", 2, 3, 1.4, EA], [134, "soldier", 1, 2, 1.4, ME], [137, "chasseur", 1, 1, 0, ME], [138, "lancer", 0, 1, 0, WA],
        [144, "chasseur", 1, 1, 0, MW], [146, "lancer", 1, 2, 2, MW], [150, "grenadier", 1, 1, 0, ME], [152, "drummer", 1, 1, 0, MW], [156, "soldier", 1, 3, 1.4, MW], [160, "lancer", 2, 2, 2, EB], [164, "soldier", 0, 2, 1.5, WX], [168, "grenadier", 2, 1, 0, EA], [172, "soldier", 1, 2, 1.3, ME], [175, "chasseur", 1, 1, 0, ME], [176, "lancer", 1, 1, 0, MW]]); })(),
      boss: ["", ""], desc: "능선 한가운데의 농장. 적은 북쪽에서 두 길로 내려오고, 방어 지점은 두 길의 끝, 둘입니다. 두 길의 바깥 줄에는 기병 돌격, 방어 지점 앞을 가로지르는 길에는 포도탄이 옵니다(붙어 선 가사인격은 1.6배). 가운데 농장은 우리 고지입니다. 100초에 농장의 북쪽 문이 부서지면, 안뜰이 세 번째 길이 되어 가로지르는 길 한복판으로 이어집니다.",
      lose: "동쪽 끝 고지에서 보초를 쓰러뜨리고, 포가 처음 쏘기 전(62초)에 포구 앞 칸을 8초 지켜 포를 빼앗으세요. 서쪽은 안쪽 칸(문 쪽)부터 세우세요. 두 길의 적은 바깥 줄로 내려오다 (2,2)·(11,2)에서 갈라지고, 문이 부서진 뒤 안뜰의 적은 모두 (6,2)를 지납니다. 이 세 칸이 길목입니다. (2,2)·(11,2)는 돌격이 지나는 줄이니 바로 아래 칸에 한 명을 더 세워 방진을 만드세요. 그다음 두 방어 지점 앞, 가로지르는 길 위에 둘씩 세우면 세 길이 모두 그 앞을 지납니다. 빼앗은 포는 13초마다 그 길 위의 적을 최대 체력의 20%씩 깎습니다." },
    { code: "WL-08", name: "몽생장 능선", map: MAP_C3.ridge, bg: null, hz: 0.5, ep: 3, startCost: 12, mul: { hp: 2.38, atk: 1.39, def: 0.85 }, rmul: { hp: 1, atk: 0.75 }, crest: 4,
      volleys: [{ kind: "charge", first: 34, every: 34, warn: 5, dmg: 1100, pct: 0.6, tiles: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((x) => [x, 1]) },
                { kind: "charge", first: 51, every: 34, warn: 5, dmg: 1100, pct: 0.6, tiles: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((x) => [x, 6]) },
                { first: 68, every: 34, warn: 4, dmg: 700, pct: 0.3, foe: 0.3, mine: 1.7, pack: 1.6, capture: 8, linger: 20, muzzle: [12, 3], gun: [13, 3], mineEvery: 8, bossPct: 0.10, full: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((x) => [x, 3]), tiles: [5, 6, 7, 8, 9, 10, 11].map((x) => [x, 3]) }],   // the shot stops at the crest: west of column 5 the centre is in dead ground
      // gates: 0 the upper road, 1 the centre, 2 the lower. The Emperor stands at his post on the gun's muzzle square from the first moment (in plain sight) until 118, then comes
      // down the centre. Four movements: the line (5-45), horse and gun (60-108), the Guard and the Emperor himself (118-160: the centre is left to him, and the outer roads carry only light foot), and what is left (165-195)
      waves: (() => { const N1 = { via: [[12, 1], [2, 1], [1, 3]] }, N2 = { via: [[11, 1], [10, 2], [7, 2], [2, 2], [1, 3]] }, C3 = { via: [[11, 4], [11, 3], [7, 3], [2, 3]] }, C4 = { via: [[11, 4], [7, 4], [2, 4]] }, S5 = { via: [[12, 6], [2, 6], [2, 4]] }, S6 = { via: [[12, 6], [2, 6], [2, 4]] },
        POST = { at: [12, 3], until: 118, seen: true, via: [[5, 3], [2, 3]] };
        return W1([[0.5, "emperor", 1, 1, 0, POST],
        [5, "soldier", 0, 2, 2, N2], [18, "soldier", 2, 2, 2, S6], [30, "soldier", 1, 2, 2, C4], [40, "chasseur", 0, 1, 0, N1], [46, "lancer", 1, 1, 0, C3],
        [60, "soldier", 1, 3, 1.5, C4], [66, "lancer", 0, 2, 2, N1], [72, "grenadier", 1, 1, 0, C3], [80, "soldier", 2, 3, 1.5, S6], [82, "drummer", 2, 1, 0, S5], [90, "chasseur", 1, 1, 0, C4], [96, "lancer", 2, 1, 0, S5], [102, "soldier", 0, 3, 1.4, N2],
        [124, "soldier", 0, 3, 1.4, N1], [128, "soldier", 2, 2, 1.5, S6], [138, "drummer", 2, 1, 0, S6], [156, "chasseur", 2, 1, 0, S6],   // his descent: no weight-2 men and no lancers on the outer roads
        [166, "soldier", 1, 3, 1.4, C4], [172, "grenadier", 0, 1, 0, N2], [176, "soldier", 2, 3, 1.4, S5], [184, "lancer", 1, 2, 2, C4], [190, "soldier", 0, 3, 1.3, N1]]); })(),
      boss: ["경고: 황제", "관을 쓴 쪽 · WARNING"], desc: "능선. 길 셋이 서쪽의 방어 지점으로 옵니다. 바깥 두 줄에는 기병 돌격, 가운데 길의 위쪽 줄에는 포도탄이 옵니다. 포도탄은 능선마루를 넘지 못합니다. 황제는 포구 앞에서 지휘하다가 118초에 가운데 길로 내려옵니다. 황제가 방어 지점에 닿으면 작전은 실패합니다.",
      lose: "황제는 둘 몫으로 저지됩니다. 그가 닿으면 가사인격은 막던 적을 놓고 그를 붙듭니다. 저지선은 둘: 능선마루 동쪽의 포격 줄 위와, 능선마루. 화력과 의무는 방어 지점 앞에 남기지 말고 그 두 줄을 내려다보는 고지에 올리세요. 쓰러뜨려도 관을 다시 쓰고 한 번 일어나며, 그때 첫 줄을 뚫습니다. 그가 떠난 포구 앞 칸을 8초 지키면 포는 우리 것이고, 8초마다 그의 체력을 10%씩 깎습니다. \"전군\"에는 포도탄도 능선마루를 넘습니다. 멈춰 선 6초에 모든 것을 쏟으세요. 위쪽 길과 가운데 길의 적은 각각 (11,1)·(11,4)를 지나 들어옵니다. 황제의 포구 바로 곁이라 오래 버틸 자리는 아니지만, 첫 물결은 거기서 끊을 수 있습니다." },
    { code: "WL-09", name: "튈르리", map: MAP_C3.palace, bg: null, hz: 0.5, ep: 3, startCost: 12, mul: { hp: 1.14, atk: 1.09, def: 0.85 }, rmul: { hp: 1, atk: 0.75 },
      lamps: { r: 2 },
      // gates: 0 the palace door, 1 the upper east gate, 2 the lower. The Emperor is beaten; the confessor rings the armoury awake. Empty armour that falls in the dark gets up again:
      // one alone under a lamp and one alone in the dark to show it (5-40), with snuffers (55-105), then the crowned armour comes out of the door (118) — and at 126 Cadoudal's
      // raid arrives: he and his last men stand in the court on our side (RAID) for what is left
      waves: (() => { const RAID = (x, y) => ({ at: [x, y], ally: true }), RAIDK = (x, y) => ({ at: [x, y], ally: true, hp: 0.79, atk: 0.9 }),
        DW = { via: [[5, 1], [2, 2], [2, 3]] }, DE = { via: [[9, 1], [10, 2], [10, 4], [9, 5], [3, 5]] }, N = { via: [[10, 2], [9, 1], [2, 1], [1, 2], [1, 3]] }, S = { via: [[10, 4], [10, 5], [3, 5]] }, S2 = { via: [[10, 4], [9, 5], [6, 5], [4, 4], [3, 4], [3, 3], [2, 3]] },
        SNA = { via: [[10, 2], [10, 4], [8, 5], [4, 4], [3, 4]] }, SNB = { via: [[10, 2], [9, 1], [4, 2], [3, 2], [2, 3]] };
        return W1([[1, "armour", 2, 1, 0, { at: [11, 5], fallen: 5, until: 14, via: [[3, 5]] }], [12, "soldier", 1, 3, 2, N], [20, "armour", 0, 1, 0, DW], [30, "chasseur", 1, 1, 0, N], [36, "soldier", 2, 2, 2, S2],
        [55, "snuffer", 2, 1, 0, SNA], [57, "armour", 2, 2, 3, S], [66, "soldier", 1, 2, 1.5, N], [69, "chasseur", 1, 1, 0, N], [74, "armour", 0, 1, 0, DE], [80, "lancer", 2, 1, 0, S2], [88, "lampbreaker", 1, 1, 0, SNB], [90, "armour", 1, 2, 3, N], [98, "mouchard", 0, 1, 0, DW], [102, "soldier", 2, 2, 1.4, S], [105, "chasseur", 2, 1, 0, S],
        [118, "kingarmour", 0, 1, 0, { via: [[7, 1, 6], [5, 1], [2, 2], [2, 3]] }], [122, "armour", 1, 1, 0, N], [124, "armour", 2, 1, 0, S],
        [126, "cadoudal", 0, 1, 0, RAID(8, 5)], [126, "chouang", 0, 1, 0, RAIDK(5, 5)], [126, "chouang", 0, 1, 0, RAIDK(4, 4)], [126, "chouang", 0, 1, 0, RAIDK(4, 2)], [126, "chxbow", 0, 1, 0, RAID(2, 2)], [126, "chxbow", 0, 1, 0, RAID(2, 5)],
        [134, "snuffer", 1, 1, 0, SNA], [136, "soldier", 2, 3, 1.3, S2], [140, "chasseur", 2, 1, 0, S2], [142, "armour", 1, 1, 3, N], [150, "chasseur", 2, 1, 0, S], [150, "snuffer", 2, 1, 0, SNA], [156, "armour", 2, 2, 3, S], [162, "lancer", 1, 2, 2, N], [170, "armour", 0, 1, 3, DE], [170, "snuffer", 1, 1, 0, SNB], [176, "soldier", 1, 3, 1.3, N], [180, "chasseur", 1, 1, 0, N], [182, "armour", 2, 1, 0, S2]]); })(),
      boss: ["경고: 빈 왕좌", "빈 왕좌의 갑주 · WARNING"], desc: "궁의 안뜰, 밤. 빈 갑주는 어둠 속에서 쓰러뜨리면 5초 뒤 다시 일어납니다. 등불 아래에서 쓰러뜨려야 끝납니다. 등은 셋. 소등부와, 지키는 이가 있어도 등을 깨는 자가 옵니다. 118초에 빈 왕좌의 갑주가 나오고, 126초에 카두달이 우리 편으로 뛰어듭니다.",
      lose: "빈 갑주는 등불이 비추는 칸에서 막으세요. 동쪽 두 문의 적은 모두 동쪽 등 곁의 (10,2)·(10,4)를 지납니다. 등지기를 (10,3)에 세우면 세 칸이 한 줄로 붙습니다. 등 깨는 자가 깬 등은 지키던 이가 다시 켤 수 없습니다. 새로 세운 가사인격이 6초를 버텨야 합니다. 왕좌의 갑주가 끈 등은 지키던 이도 14초 만에 다시 켭니다. 빈 왕좌의 갑주는 체력이 절반이 되면 가장 가까운 등을 끕니다." },
    // ---- supply (자원 수집): built from the farm tables below, in the order the meta side counts them (AM FH CB AR, BM, CN) ----
    ...FARM_STAGES,
    ...LAB_STAGES,   // the lab: always last, so no stage before it moves
  ];
  // level-0 training: no timed waves (the tutorial script spawns and paces everything), no passive cost
  const TUTORIAL = { code: "TR-00", name: "링크 학습", map: MAP_TUT, waves: [], holo: true, tutorial: true, costRate: 0, mul: { hp: 0.45, atk: 0.8, def: 0.3 },
    boss: ["", ""], desc: "", lose: "" };
  // the training room: the first map, no waves, endless cost; the UI adds tools to spawn foes and charge skills
  const SANDBOX = { code: "SIM", name: "훈련장", waves: [], sandbox: true, costRate: 20, boss: ["", ""], desc: "", lose: "" };
  // skill level (1-7) and mastery (M1-M3, after E2 and level 7). Level 1 with no mastery is the def itself. Above it every scalable number of the skill
  // (the fields its scale map names) grows by its class, after the original's ratios (scratchpad/skillscale/proposal.md):
  //  A hit/dot ×ATK, B buff multiplier, C attack-speed multiplier, D DEF multiplier, E heal ×ATK, H share of max HP, G seconds of CC, I chance/share,
  //  F slow (the remaining speed shrinks), R damage-taken multiplier, P a foe's ATK down, K push force (+1 at M3), N a target cap (+1 at lv7, +2 at M3)
  // Each class's factor on the lv1 value at lv7 / M1 / M2 / M3; the levels between go in even steps from 1 to the lv7 factor (G holds until lv7, as the original)
  const SKILL_LV = { sp: 0.03, init: 1, dur: 0.04 };
  const SK_CURVE = { A: [1.30, 1.40, 1.50, 1.60], B: [1.22, 1.27, 1.33, 1.40], C: [1.18, 1.21, 1.25, 1.29], D: [1.23, 1.27, 1.32, 1.38], E: [1.35, 1.45, 1.55, 1.65],
    H: [1.30, 1.40, 1.50, 1.60], G: [1.20, 1.30, 1.40, 1.50], I: [1.33, 1.38, 1.43, 1.50], F: [0.87, 0.83, 0.79, 0.75], R: [0.87, 0.83, 0.79, 0.75], P: [1.45, 1.50, 1.60, 1.75] };
  // short SP costs follow the original's integer patterns (lv1 -> lv7, M1, M2, M3); longer ones a factor (manual / auto)
  const SK_SHORT = { 3: [3, 3, 2, 2], 4: [3, 3, 3, 2], 5: [4, 4, 4, 3], 6: [5, 5, 4, 4], 7: [6, 5, 5, 5], 8: [7, 7, 7, 6], 10: [8, 8, 7, 7], 12: [10, 9, 9, 8] };
  const SK_SPF = { manual: [0.82, 0.80, 0.77, 0.72], auto: [0.80, 0.77, 0.74, 0.67] }, SK_DURF = [1.24, 1.28, 1.32, 1.36];
  const pyRound = (x) => { const f = Math.floor(x), d = x - f; return d > 0.5 ? f + 1 : d < 0.5 ? f : (f % 2 === 0 ? f : f + 1); };   // half to even, as the table script
  const r05 = (x) => pyRound(x * 20 + 1e-9) / 20, r01 = (x) => pyRound(x * 10 + 1e-9) / 10, rN = (x, n) => +x.toFixed(n);   // rounded on the exact value, as Python's round(x, n)
  // the factor for step q: q 1..6 are lv2..lv7, q 7..9 are M1..M3
  const skF = (c, q) => q >= 6 ? SK_CURVE[c][q - 6] : 1 + (SK_CURVE[c][0] - 1) * q / 6;
  function skScale(v, c, q) {
    if (q <= 0) return v;
    if (c === "K") return q >= 9 ? v + 1 : v;
    if (c === "N") return v + (q >= 9 ? 2 : q >= 6 ? 1 : 0);
    if (c === "G") return q < 6 ? v : r01(v * skF(c, q));
    const f = skF(c, q);
    if (c === "A" || c === "E") return v >= 1 ? r05(v * f) : rN(v * f, 2);
    if (c === "B" || c === "C" || c === "D" || c === "R") return r05(v * f);
    if (c === "H") return rN(v * f, v < 0.1 ? 3 : 2);
    if (c === "I") return Math.min(0.9, r05(v * f));
    if (c === "P") return Math.min(0.6, r05(v * f));
    if (c === "F") return Math.min(0.85, r05(1 - (1 - v) * f));
    return v;
  }
  const maxMastery = (d) => (d && d.rarity >= 4) ? 3 : 0;   // three-stars (no second promotion) stop at level 7
  function skillAt(sk, lv, m) {
    lv = Math.max(1, Math.min(7, lv || 1)); m = Math.max(0, Math.min(3, m || 0)); if (m > 0) lv = 7;
    if (lv === 1 && !m) return sk;
    if (!sk || sk.mode === "passive") return sk;
    const q = m ? 6 + m : lv - 1, o = Object.assign({}, sk, { lv, m, base: sk });
    const sp1 = sk.sp, auto = sk.mode === "auto", f = SK_SPF[auto ? "auto" : "manual"];
    const spAt = (qq) => { if (qq <= 0) return sp1; if (SK_SHORT[sp1]) { const t = SK_SHORT[sp1]; return qq >= 6 ? t[qq - 6] : pyRound(sp1 + (t[0] - sp1) * qq / 6); }
      return Math.max(1, pyRound(sp1 * (qq >= 6 ? f[qq - 6] : 1 - (1 - f[0]) * qq / 6))); };
    const i1 = sk.init || 0;
    // between lv1 and lv7 the SP points come off on the levels where the initial SP does not rise, so every level shows a change (a skill whose only numbers are
    // its SP, like a flat DP gain, still moves at each step when it can)
    if (q >= 1 && q <= 5) {
      const sp7 = spAt(6), D = sp1 - sp7;
      if (D > 0 && D <= 6) {
        const iRaw = (k) => auto ? Math.min(Math.max(i1, Math.floor(sp1 / 2)), i1 + k) : Math.min(spAt(9), i1 + k);
        const free = [], rise = []; for (let k = 1; k <= 6; k++) (iRaw(k) > iRaw(k - 1) ? rise : free).push(k);
        const pick = (arr, n) => Array.from({ length: n }, (_, j) => arr[Math.floor((j + 0.5) * arr.length / n)]);
        const at = D <= free.length ? pick(free, D) : free.concat(pick(rise, D - free.length));
        o.sp = sp1 - at.filter((k) => k <= q).length;
      } else o.sp = spAt(q);
    } else o.sp = spAt(q);
    const n = Math.min(q, 6) + (m || 0) * (auto ? 0 : 1);
    const want = auto ? Math.min(Math.max(i1, Math.floor(sp1 / 2)), o.sp, i1 + n) : Math.min(spAt(9), i1 + n);
    o.init = Math.min(o.sp, Math.max(want, Math.min(i1, o.sp)));   // never below its lv1 start (capped at this level's SP)
    if (sk.dur && !sk.ammo) o.dur = r01(sk.dur * (q >= 6 ? SK_DURF[q - 6] : 1 + SKILL_LV.dur * q));
    for (const key in sk.scale || {}) {
      const c = sk.scale[key], path = key.split(".");
      if (path.length === 2) { o[path[0]] = Object.assign({}, o[path[0]]); o[path[0]][path[1]] = skScale(sk[path[0]][path[1]], c, q); }
      else o[key] = skScale(sk[key], c, q);
    }
    return o;
  }
  // a skill's text with its numbers filled in: {k} the number, {k%} as a share, {k+%} the rise a multiplier gives, {k-%} the cut it gives, {k*n...} times n first.
  // mark(key) may wrap a filled number (the skill-up screen colours what changes)
  const skNum = (x) => String(+(+x).toFixed(2));
  function skillDesc(sk, mark) {
    if (!sk || !sk.desc) return (sk && sk.desc) || "";
    return sk.desc.replace(/\{([A-Za-z][\w.]*)(\*[\d.]+)?(\+%|-%|%)?\}/g, (all, key, mul, kind) => {
      const path = key.split("."); let v = path.length === 2 ? (sk[path[0]] || {})[path[1]] : sk[key];
      if (typeof v !== "number") return all;
      if (mul) v *= +mul.slice(1);
      const t = kind === "%" ? skNum(Math.round(v * 1000) / 10) + "%" : kind === "+%" ? skNum(Math.round((v - 1) * 1000) / 10) + "%" : kind === "-%" ? skNum(Math.round((1 - v) * 1000) / 10) + "%" : skNum(v);
      return mark ? mark(key, t) : t;
    });
  }
  // every number of a skill that a level or a mastery can change, for the before/after lists: [key, label, value text]
  const SK_FIELD_LABEL = { sp: "필요 SP", init: "초기 SP", dur: "지속", mul: "피해 배율", atk: "공격력", def: "방어력", speed: "공격 속도", heal: "회복량", cure: "회복량", slow: "감속", stun: "기절", bind: "속박", force: "밀어내기 힘",
    taken: "받는 피해", weak: "적 공격력 감소", per: "배율", regen: "회복", ward: "보호막", thorns: "반사 배율", neg: "무효 확률", ctr: "반격 배율", holy: "신성 손상", erode: "침식", chord: "치료 배율",
    spill: "전원 치료", m1: "스타터", m2: "두번째", m3: "막타", stop: "시간 정지", splash: "폭발", wake: "기상 피해", n: "대상 수", slowT: "감속 시간", "maze.slow": "감속", "maze.dot": "초당 피해" };
  const SK_PCT = { A: 1, E: 1, H: 1, I: 1, P: 1, F: 1 };
  function skillFields(sk) {
    const base = sk.base || sk, out = [["sp", SK_FIELD_LABEL.sp, String(sk.sp)], ["init", SK_FIELD_LABEL.init, String(sk.init || 0)]];
    if (base.dur && !base.ammo) out.push(["dur", SK_FIELD_LABEL.dur, skNum(sk.dur) + "초"]);
    for (const key in base.scale || {}) {
      const c = base.scale[key], path = key.split("."), v = path.length === 2 ? sk[path[0]][path[1]] : sk[key];
      const t = c === "G" ? skNum(v) + "초" : c === "K" || c === "N" ? skNum(v) : c === "R" ? "-" + skNum(Math.round((1 - v) * 1000) / 10) + "%" : (c === "B" || c === "C" || c === "D") ? "×" + skNum(v) : skNum(Math.round(v * 1000) / 10) + "%";
      out.push([key, SK_FIELD_LABEL[key] || key, t]);
    }
    return out;
  }
  const CFG = { startCost: 10, costPerSec: 1, maxCost: 99, life: 3, deployLimit: 8, retreatRefund: 0.5 };

  let W = MAP0[0].length, H = MAP0.length;   // the board size: each map brings its own
  const tileAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? "#" : MAP[y][x];
  const walkable = (c) => c === "." || c === "," || c === "S" || c === "B" || c === "*" || c === "~" || c === "=" || c === "-" || c === "^" || c === "R" || c === "E";   // "^": a smoke bridge (the lab's chimneys): anyone walks it, nobody stands on it   // "R": a rest (the lab's beat): walked, never stood on; a foe landing there waits for the downbeat   // "E": the relay's exit (lab): walked, never stood on   // "=": thin ice (stand on it and the armour suffers), "-": an ice sheet nobody can stand on   // "~": mud (the rasputitsa): ground anyone may stand on, where the foe wades slowly   // "*": open ground anyone can stand on, near or far   // ",": ground the foe walks but nobody can stand on

  function findAll(ch) { const r = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (MAP[y][x] === ch) r.push([x, y]); return r; }
  const SPAWNS = [], BASE = [0, 0], BASES = [];   // BASE: the first defence point (and the one most boards have); BASES: all of them

  function bfsPath(from, to0) {
    let to = to0;
    const key = (x, y) => y * W + x;
    const prev = new Map([[key(...from), null]]);
    const q = [from];
    while (q.length) {
      const [x, y] = q.shift();
      if (to === BASE ? MAP[y] && MAP[y][x] === "B" : x === to[0] && y === to[1]) { to = [x, y]; break; }   // asked for "the base": whichever defence point comes first
      for (const [dx, dy] of [[1, 0], [0, 1], [0, -1], [-1, 0]]) {
        const nx = x + dx, ny = y + dy;
        if (!walkable(tileAt(nx, ny)) || prev.has(key(nx, ny))) continue;
        prev.set(key(nx, ny), [x, y]);
        q.push([nx, ny]);
      }
    }
    const path = [];
    if (!prev.has(key(...to))) return null;   // no way through on foot (a drone-only gate)
    let cur = to;
    while (cur) { path.push(cur); cur = prev.get(key(...cur)); }
    return path.reverse();
  }
  const PATHS = [], AIR_PATHS = [];
  const VIA = new Map();   // routes through waypoints, built once per map
  function viaPath(s, via) {
    const k = s + ":" + JSON.stringify(via);
    if (VIA.has(k)) return VIA.get(k);
    let pts = [SPAWNS[s], ...via.map((p) => [p[0], p[1]]), BASE], path = [], waits = null;
    for (let i = 0; i < pts.length - 1; i++) { const seg = bfsPath(pts[i], pts[i + 1]); if (!seg) { path = PATHS[s]; waits = null; break; } path = path.concat(i ? seg.slice(1) : seg);
      const w = i < via.length ? via[i][2] : 0; if (w) { waits = waits || {}; waits[path.length - 1] = w; } }   // a waypoint may carry a pause: [x, y, seconds]
    if (waits) path = Object.assign(path.slice(), { waits });
    VIA.set(k, path); return path;
  }
  // the way from a square on the board (a garrison's post, a sleeper's fire) through waypoints to the base: the same as viaPath, but from a square rather than a gate
  function atPath(at, via) {
    let pts = [at.slice(), ...(via || []).map((p) => [p[0], p[1]]), BASE], path = [], waits = null;
    for (let i = 0; i < pts.length - 1; i++) { const seg = bfsPath(pts[i], pts[i + 1]); if (!seg) return bfsPath(at, BASE) || [at.slice(), BASE.slice()]; path = path.concat(i ? seg.slice(1) : seg);
      const w = via && i < via.length ? via[i][2] : 0; if (w) { waits = waits || {}; waits[path.length - 1] = w; } }
    return waits ? Object.assign(path, { waits }) : path;
  }
  function airPath(s, air) {   // a flier's own route: [x, y] points, or [x, y, seconds] to hover there a while
    const path = [SPAWNS[s].slice(), ...air.map((p) => [p[0], p[1]])], waits = {};
    air.forEach((p, i) => { if (p[2]) waits[i + 1] = p[2]; });
    return Object.keys(waits).length ? Object.assign(path, { waits }) : path;
  }
  // switch the board: the arrays above are refilled in place so everything holding them sees the new map
  const nearBase = (p) => BASES.reduce((a, b) => (!a || Math.hypot(b[0] - p[0], b[1] - p[1]) < Math.hypot(a[0] - p[0], a[1] - p[1]) ? b : a), null).slice();   // a flier makes for the closest
  function setMap(rows) {
    MAP = rows; W = rows[0].length; H = rows.length;
    SPAWNS.length = 0; SPAWNS.push(...findAll("S"));
    BASES.length = 0; BASES.push(...findAll("B")); BASE[0] = BASES[0][0]; BASE[1] = BASES[0][1];
    PATHS.length = 0; PATHS.push(...SPAWNS.map((s) => bfsPath(s, BASE))); VIA.clear();
    AIR_PATHS.length = 0; AIR_PATHS.push(...SPAWNS.map((s) => [s, nearBase(s)]));
  }
  setMap(MAP0);

  function rotate([dx, dy], dir) {
    switch (dir) { case 0: return [dx, dy]; case 1: return [-dy, dx]; case 2: return [-dx, -dy]; default: return [dy, -dx]; }
  }

  // promotion makes an operator dearer to field: +2 cost at elite 1 (six-stars: at elite 2). Fast-redeploy specialists stay cheap
  // a supporter's back line opens only once promoted: rangeE maps elite -> wider range
  function rangeKeyOf(d, elite) { let r = d.range; if (d.rangeE) for (const k in d.rangeE) if ((elite || 0) >= +k) r = d.rangeE[k]; return r; }
  // like the original: promotion to E1 adds 2 to the deployment cost; the heavy-armoured lines (protectors, guardians, juggernauts), swordmasters and artillery add 2 more at E2
  const E2_COST = new Set(["프로텍터", "가디언", "저거너트", "소드마스터", "포격사수"]);
  function eliteCost(d, elite) {
    if (!d || d.summoned || !elite) return 0;
    if (d.eliteCost !== undefined) return d.eliteCost;
    return 2 + (elite >= 2 && E2_COST.has(d.sub) ? 2 : 0);
  }
  // potential (duplicates), as in the original: P2 cost -1, P3 redeploy -4s (fast-redeploy -2s), P4 a flat stat by class,
  // P5 three-stars redeploy -6s / higher rarities a second small stat (in place of a talent upgrade), P6 cost -1
  const POT_STAT = { 선봉: ["def", 0.07], 근위: ["atk", 0.04], 중장: ["def", 0.04], 저격: ["atk", 0.05], 술사: ["atk", 0.05], 의무: ["atk", 0.05], 보조: ["atk", 0.04], 특수: ["hp", 0.08] };
  const STAT_KO = { atk: "공격력", def: "방어력", hp: "최대 체력" };
  // P2 cost -1, P3 redeploy -4s (fast-redeploy -2s), P4 the stand-in's own bonus (a flat number), P5 the stand-in's if it is a number,
  // otherwise (a talent upgrade in the original) a small flat bonus in its place, P6 cost -1
  function potSteps(d) {
    const fast = d.redeploy <= 25, st = POT_STAT[d.cls] || ["atk", 0.04];
    const fix = (p) => {
      if (!p) return null;
      if (p[0] === "aspd") return ["atk", Math.round(d.atk * p[1] / 100)];   // attack speed becomes the attack it is worth
      if (p[0] === "cost") return null;
      return p;
    };
    let p4 = d.akPot ? fix(d.akPot[0]) : null; if (!p4 || p4[0] === "rd") p4 = [st[0], Math.round(d[st[0]] * st[1])];
    let p5 = d.akPot ? fix(d.akPot[1]) : null;
    if (!p5) p5 = (d.rarity || 3) <= 3 ? ["rd", -6] : p4[0] === "atk" ? ["hp", Math.round(d.hp * 0.04)] : ["atk", Math.round(d.atk * 0.03)];
    return [["cost", -1], ["rd", fast ? -2 : -4], p4, p5, ["cost", -1]];
  }
  function potOf(d, pot) {
    pot = Math.max(1, Math.min(6, pot || 1));
    const r = { cost: 0, redeploy: 0, atk: 1, def: 1, hp: 1, res: 0 };
    potSteps(d).slice(0, pot - 1).forEach(([k, v]) => {
      if (k === "cost") r.cost -= v; else if (k === "rd") r.redeploy -= v; else if (k === "res") r.res += v;
      else if (d[k]) r[k] += v / d[k];
    });
    return r;
  }
  const POT_KO = { cost: "배치 코스트", rd: "재배치 시간", hp: "최대 체력", atk: "공격력", def: "방어력", res: "마법 저항" };
  function potList(d) { return potSteps(d).map(([k, v]) => [POT_KO[k] + " " + (v > 0 ? "+" : "") + v + (k === "rd" ? "초" : "")]); }
  function segLen(p) { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; }

  class Game {
    // squad: optional [{ id, skillIdx, mult, elite }] from the lobby; without it every operator comes along
    constructor(stageIdx, squad) {
      this.t = 0; this.cost = CFG.startCost; this.costAcc = 0; this.life = CFG.life;
      this.units = []; this.enemies = []; this.fx = []; this.sfx = []; this.heals = []; this.shots = []; this.pulls = []; this.later = []; this.waveIdx = 0; this.uid = 1;
      const pick = squad && squad.length ? squad.map((s) => ({ s, def: UNITS.find((u) => u.id === s.id) })).filter((p) => p.def) : UNITS.map((def) => ({ s: {}, def }));
      this.cards = pick.map(({ s, def: u }) => ({ def: u, cooldown: 0, deployed: false, level: 0, mult: s.mult || 1,
        skillIdx: s.skillIdx !== undefined ? Math.min(s.skillIdx, u.skills.length - 1) : u.defaultSkill !== undefined ? u.defaultSkill : u.skills.length - 1, elite: s.elite !== undefined ? s.elite : 2, look: s.look, pot: potOf(u, s.pot), slv: s.slv || 1, sm: Array.isArray(s.sm) ? s.sm.slice(0, 3) : [0, 0, 0] }));   // sm: each skill's mastery (0-3)
      if (stageIdx === "tutorial") { this.stageIdx = -1; this.stage = TUTORIAL; }
      else if (stageIdx === "sandbox") { this.stageIdx = -2; this.stage = SANDBOX; }
      else { this.stageIdx = Math.max(0, Math.min(STAGES.length - 1, stageIdx || 0)); this.stage = STAGES[this.stageIdx]; }
      this.waves = this.stage.waves;
      // board shifts (a wall that opens at a set time): such a stage plays on its own copy of the rows, so the stage's map stays as written and a new game starts shut again
      this.rows = this.stage.shifts && this.stage.map ? this.stage.map.slice() : null;
      this.shifts = (this.stage.shifts || []).map((q) => ({ t: q.t, warn: q.warn || 0, set: q.set, banner: q.banner, tiles: q.set.map(([x, y]) => [x, y]), warned: false, done: false }));
      setMap(this.rows || this.stage.map || MAP0);
      this.costRate = this.stage.costRate !== undefined ? this.stage.costRate : CFG.costPerSec;
      if (this.stage.startCost) this.cost = this.stage.startCost;
      this.hold = !!(this.stage.tutorial || this.stage.sandbox);
      if (this.stage.sandbox) { this.life = 99; this.cost = CFG.maxCost; }   // a scripted stage ends only when its script lets go; the training room never ends
      this.killed = 0; this.leaked = 0; this.total = this.waves.filter((w) => !(w[3] && w[3].ally)).length;   // those who stand with us are not counted among the foe this.over = null;
      if (this.stage.march) { this.stage = Object.assign({}, this.stage); this.march = { def: this.stage.march, n: 0, route: [] }; this.loadPart(this.stage.march.start); }
      this.deployLimit = this.stage.deployLimit || CFG.deployLimit;
      // the villages that burn on a timetable: warned, then alight, then (if it says) burnt out
      this.fires = (this.stage.fires || []).map((f) => ({ at: f.at, warn: f.warn !== undefined ? f.warn : 4, dur: f.dur || 0, tiles: f.tiles, st: 0 }));
      this.bombs = []; this.drift = new Map();
      // the gas lamps (chapter 3): on a stage with `lamps`, every F is a street lamp. It lights the squares within `r` of it (a square each way by default); a foe standing
      // in the dark cannot be seen — only whoever holds it can strike it. A lamp-snuffer puts out the lamps he passes; an operator set down beside a lamp lights it and keeps it
      // chapter 4: someone to keep (an escort standing on a square of the board: every foe that reaches it costs it, and at nothing the operation is lost), smoke
      // (squares where ours cannot be picked out by a foe's gun — and cannot see past the next square themselves), and the call (now and then every foe on the board
      // hurries for a point, and ours in line with that point are slowed at their work; nobody of ours is moved)
      const ES = this.stage.escort; this.escort = ES ? { x: ES.at[0], y: ES.at[1], hp: ES.life || 3, max: ES.life || 3, name: ES.name || "" } : null;
      this.smoke = new Map(); for (const [x, y] of this.stage.smoke || []) this.smoke.set(y * 100 + x, 0);   // key -> the time until which it is blown away (0: lying there)
      const CL = this.stage.calls; this.calls = CL ? { next: CL.first, every: CL.every, dur: CL.dur || 2.5, warn: CL.warn || 4, speed: CL.speed || 1.8, slow: CL.slow || 1.3, at: CL.at || (ES && ES.at), until: 0, warned: false } : null;
      this.lampOff = new Set(); this.volleys = []; this.shells = []; this.lampEv = ((this.stage.lamps && this.stage.lamps.events) || []).map((e) => ({ t: e.t, off: e.off, warn: e.warn || 5 }));
      // Two kinds of dead lamp. A lamp BROKEN by a lamp-breaker lights again only when an operator deployed after it went out stands right beside it for
      // stage.lamps.relight seconds (6 by default) without a break. Any other dead lamp (an order such as "lights out", a snuffer, the clock, out from the start) lights
      // that way too, and also by itself stage.lamps.relightStale seconds (14 by default) after it went out if one of ours who was already standing there still is.
      // lampOffT holds the game time each lamp went out (key y*100+x; a lamp out from the start has -1); lampBroken holds the keys of the broken ones; freshAt holds
      // the time a fresh keeper's clock will run out; relightAt holds, for the lamps that will light, the earlier of the two times (the page shows the count).
      this.lampOffT = new Map(); this.relightAt = new Map(); this.freshAt = new Map(); this.lampBroken = new Set();
      if (this.stage.lamps) for (const [x, y] of this.stage.lamps.off || []) { this.lampOff.add(y * 100 + x); this.lampOffT.set(y * 100 + x, -1); }
      if (this.stage.volleys) this.volleys = this.stage.volleys.map((v) => Object.assign({ next: v.first, st: 0 }, v));
      if (this.stage.wind) { const w = this.stage.wind; this.wind = { dir: w.dir, every: w.every, warn: w.warn || 4, dur: w.dur || w.every * 0.5, durs: w.durs || null, n: 0, curDur: 0, step: w.step || BLIZ.step, next: w.first || w.every, warned: false, blowing: false, end: 0, front: null, adv: 0 }; }
      // lab stages (L0): a stage may name its own win and lose conditions (goal), keep gauges (meters), bring an ally who walks (vip) and repeat its waves without end (loop).
      // None of the stages before the lab sets any of these, so for them all four stay empty and nothing below changes how they play
      this.goal = this.stage.goal || null; this.meters = {};
      for (const id in this.stage.meters || {}) { const m = this.stage.meters[id]; this.meters[id] = { v: m.v || 0, min: m.min, max: m.max, label: m.label || id }; }
      const VP = this.stage.vip;
      this.vip = VP ? { isVip: true, name: VP.name || "", sprite: VP.sprite || "yui", hp: VP.hp, maxHp: VP.hp, def: VP.def || 0, x: VP.at[0], y: VP.at[1], speed: VP.speed || 0.6,
        route: (VP.route || []).map((r) => ({ to: r.to.slice(), wait: r.wait || 0 })), leg: 0, waitUntil: VP.route && VP.route.length ? VP.route[0].wait || 0 : Infinity, path: null, seg: 0, segT: 0, walking: false, tryAt: 0, waitFx: false, dead: false, face: 1, hitAt: -9 } : null;
      this.loopDef = this.stage.loop ? { from: this.stage.loop.from || 0, period: this.stage.loop.period, grow: this.stage.loop.grow || 0, n: 0, q: [] } : null;
      this.noUnitsSince = null; this.everDeployed = false;
      // the squares where the walking ally stands or will wait: nobody is set down on them (so she never ends a walk on one of ours)
      this.vipSquares = VP ? [VP.at, ...(VP.route || []).map((r) => r.to)].map((q) => [q[0], q[1]]) : [];
      this.boardVer = 0;   // counts the times squares changed (setTile), so the page knows to redraw the board
      // lab L1: chimneys. While one of ours stands right beside a chimney it is stopped; after close seconds its smoke bridge is gone, and open seconds after nobody stops it
      // the bridge is back. brokenUntil: a chimney sweep cleared it and it cannot be stopped before then
      // lab L2: the beat. Each zone keeps its own clock: ph runs from 0 to 1 over one beat, n counts the beats (n % 4 === 0 is a downbeat), lastDown is the game time of the last one
      const BT = this.stage.beat; this.beat = BT ? { base: BT.base || 1.4, zones: BT.zones.map((z) => ({ id: z.id, x0: z.x0, x1: z.x1, metronome: z.metronome.slice(), level: 1, ph: 0, n: 0, lastDown: 0, kept: false, batoned: false })) } : null;
      // lab L3: the mirror. Column mirror.x is glass ("|"); every square of it has hp. Operators go down only left of it; each one sets a mirrored image right of it
      const MI = this.stage.mirror; this.mirror = MI ? { x: MI.x, pct: MI.pct || 0.6, display: !!MI.display, sq: [] } : null;
      if (MI) for (let y = 0; y < H; y++) if (tileAt(MI.x, y) === "|") this.mirror.sq.push({ x: MI.x, y, hp: MI.hp || 3000, max: MI.hp || 3000, broken: false });
      // lab L4: the relay. The paper is in exactly one place: the vault, on the ground (x, y), in an operator's hands (holder), carried by a collector (carrier), or out.
      // job: the hand-over in progress ({ kind: "take" | "pass" | "deliver", by, to, t }); an operator does not hand it back to the one it came from (unit.relayFrom)
      const RL = this.stage.relay; this.relay = RL ? { name: RL.item, from: RL.from.slice(), exit: RL.exit.slice(), pass: RL.pass || 2, state: "vault", x: RL.from[0], y: RL.from[1], holder: null, carrier: null, job: null } : null;
      // lab L5: the echo. rec: this attempt's deployments as they happen ({ t, id, mult, elite, skillIdx, slv, x, y, dir, until }); q: yesterday's, still to come as ghosts
      const EC = this.stage.echo; this.echo = null;
      if (EC) { const stored = echoGet(EC.key), src = Array.isArray(stored) && stored.length ? stored : (EC.seed || []).map(([t, id, x, y, dir, until]) => ({ t, id, x, y, dir, until: until === undefined ? null : until, seed: true }));
        this.echo = { key: EC.key, pct: EC.pct || 0.5, rec: [], saved: false, fromSeed: src !== stored, q: src.map((r) => Object.assign({}, r)).sort((a, b) => a.t - b.t) }; }
      this.chimneys = (this.stage.chimneys || []).map((c, i) => ({ i, at: c.at.slice(), bridge: c.bridge.map((q) => q.slice()), close: c.close || 4, open: c.open || 6, stopT: 0, freeT: 0, kept: false, shut: false, brokenUntil: -1 }));
    }
    // ---- lab (L0): gauges, the walking ally, enemies with an aim, squares that change, waves without end, and the goal tests ----
    // a gauge: add delta, keep it inside its bounds (a count is a gauge with none), return the new value
    meter(id, delta) { const m = this.meters[id] || (this.meters[id] = { v: 0, min: undefined, max: undefined, label: id }); m.v += delta || 0;
      if (m.min !== undefined) m.v = Math.max(m.min, m.v); if (m.max !== undefined) m.v = Math.min(m.max, m.v); return m.v; }
    // somebody stands on that square: one of ours, the walking ally, or a foe on foot
    occupied(x, y) { const V = this.vip; return this.units.some((u) => u.x === x && u.y === y) || (!!V && !V.dead && ((Math.round(V.x) === x && Math.round(V.y) === y) || (V.walking && V.path && V.path.slice(V.seg, V.seg + 2).some((q) => q[0] === x && q[1] === y))))
      || this.enemies.some((q) => !q.dead && !q.def.flying && Math.round(q.x) === x && Math.round(q.y) === y); }
    // change one square of this game's own copy of the rows (never the stage's strings). A square somebody stands on cannot be made unwalkable: then nothing changes and it
    // returns false, and the caller decides what to do. With defer the routes are not rebuilt yet (the caller calls boardChanged once it has set every square)
    setTile(x, y, ch, defer) {
      if (x < 0 || y < 0 || x >= W || y >= H) return false;
      const was = tileAt(x, y); if (was === ch) return true;
      if (walkable(was) && !walkable(ch) && this.occupied(x, y)) return false;
      if (!this.rows) this.rows = MAP.slice();
      this.rows[y] = this.rows[y].slice(0, x) + ch + this.rows[y].slice(x + 1);
      if (!defer) this.boardChanged();
      return true;
    }
    // after squares change: the gates, the points, the routes and the waypoint cache from the board as it now stands; then every foe on foot whose road ahead crosses a square
    // that can no longer be walked finds a new one from where it stands (and the walking ally does the same)
    boardChanged() {
      setMap(this.rows || MAP); this.boardVer++;
      const cut = (p, from) => { for (let i = Math.max(1, from); i < p.length; i++) if (!walkable(tileAt(Math.round(p[i][0]), Math.round(p[i][1])))) return true; return false; };
      for (const e of this.enemies) if (!e.dead && !e.def.flying && !e.hired && e.path && (e.noWay || cut(e.path, e.seg + 1))) this.replan(e);   // one left with no way tries again at once
      const V = this.vip; if (V && V.walking && V.path && cut(V.path, V.seg + 1)) { V.path = null; V.tryAt = this.t; }
    }
    // a walk over the board from a square to the nearest square that passes the test; null when none can be reached
    bfsTo(from, test) {
      const key = (x, y) => y * W + x, prev = new Map([[key(from[0], from[1]), null]]), q = [from]; let end = null;
      while (q.length) { const [x, y] = q.shift(); if (test(x, y)) { end = [x, y]; break; }
        for (const [dx, dy] of [[1, 0], [0, 1], [0, -1], [-1, 0]]) { const nx = x + dx, ny = y + dy; if (!walkable(tileAt(nx, ny)) || prev.has(key(nx, ny))) continue; prev.set(key(nx, ny), [x, y]); q.push([nx, ny]); } }
      if (!end) return null;
      const path = []; for (let c = end; c; c = prev.get(key(c[0], c[1]))) path.push(c); return path.reverse();
    }
    // where an aimed foe is going: a way to the square beside (or on) what it is after. "vip": the walking ally; "unit": the nearest of ours by walking distance (and if
    // nobody of ours is down, the ally if there is one); [x, y]: that square. Null when it should make for the point as usual
    aimWay(e, T) {
      const V = this.vip && !this.vip.dead ? this.vip : null, near1 = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by) <= 1;
      const toVip = () => V ? this.bfsTo(T, (x, y) => near1(x, y, Math.round(V.x), Math.round(V.y))) : null;
      if (Array.isArray(e.aim)) return walkable(tileAt(e.aim[0], e.aim[1])) ? bfsPath(T, e.aim) : null;
      if (e.aim === "item" && this.relay) { const R = this.relay; if (e.carrying) return this.bfsTo(T, (x, y) => near1(x, y, R.from[0], R.from[1]) && !(x === R.from[0] && y === R.from[1]));   // lab L4: carrying it home: to the vault
        if (R.state === "ground") return this.bfsTo(T, (x, y) => near1(x, y, R.x, R.y)); if (R.state === "held") return this.bfsTo(T, (x, y) => near1(x, y, R.holder.x, R.holder.y)); return null; }
      if (e.aim === "mirror" && this.mirror) { const st = this.mirror.sq.filter((q) => !q.broken); return st.length ? this.bfsTo(T, (x, y) => st.some((q) => near1(x, y, q.x, q.y))) : null; }   // lab L3: the nearest standing square of glass
      if (e.aim === "metro" && this.beat) { const ms = this.beat.zones.filter((z) => z.x1 >= T[0]).map((z) => z.metronome); const p = ms.length ? this.bfsTo(T, (x, y) => ms.some((m) => near1(x, y, m[0], m[1]))) : null; return p; }   // the baton: the nearest metronome ahead
      if (e.aim === "chimney") { const kept = this.chimneys.filter((c) => c.kept); const p = kept.length ? this.bfsTo(T, (x, y) => kept.some((c) => near1(x, y, c.at[0], c.at[1]))) : null; return p || toVip(); }   // the sweep: the nearest stopped chimney, else the ally
      if (e.aim === "vip") return toVip();
      if (e.aim === "unit") { if (this.units.length) return this.bfsTo(T, (x, y) => this.units.some((u) => near1(x, y, u.x, u.y))); return toVip(); }
      return null;
    }
    // a new road from the square the foe stands on: to its aim if it has one, else to the point. With no way at all it stands where it is and tries again every second
    replan(e) {
      const T = [Math.round(e.x), Math.round(e.y)]; e.replanAt = this.t + 1;
      if (!walkable(tileAt(T[0], T[1]))) return;
      let p = e.aim !== undefined ? this.aimWay(e, T) : null; let aimed = !!p;
      e.stranded = false;
      if (!p && e.aim !== undefined && this.stage.leap && this.vip && !this.vip.dead) { p = this.nearWay(T, [Math.round(this.vip.x), Math.round(this.vip.y)]); aimed = !!p; e.stranded = !!p; }   // lab L1: no way to her: the nearest square of its own roof
      if (!e.stranded) e.standT = 0;
      if (!p) p = bfsPath(T, BASE);
      if (!p) { if (!e.noWay) { e.noWay = true; this.fx.push({ k: "noway", x: e.x, y: e.y, t: 0, life: 1 }); } return; }
      e.noWay = false; e.aimHold = aimed;
      e.path = [[e.x, e.y]].concat(p.length > 1 ? p.slice(1) : [T]); e.seg = 0; e.segT = 0; e.waitedAt = undefined; this.advance(e, 0);
    }
    // what an aimed foe that nobody holds strikes: the ally or one of ours, beside it (above, below, left or right) or on its own square
    aimStrike(e) {
      const ex = Math.round(e.x), ey = Math.round(e.y), V = this.vip && !this.vip.dead ? this.vip : null, near1 = (x, y) => Math.abs(x - ex) + Math.abs(y - ey) <= 1;
      if (e.aim === "item" && this.relay) { const H = this.relay.state === "held" ? this.relay.holder : null; return H && near1(H.x, H.y) ? H : null; }   // lab L4: the collector strikes only the one who holds it
      if (e.aim === "mirror" && this.mirror) return this.mirror.sq.find((q) => !q.broken && near1(q.x, q.y)) ? { isMirror: true, sq: this.mirror.sq.find((q) => !q.broken && near1(q.x, q.y)) } : null;
      if (e.aim === "unit" && this.units.length) { let best = null; for (const u of this.units) if (near1(u.x, u.y) && (!best || u.hp < best.hp)) best = u; return best; }
      if ((e.aim === "vip" || e.aim === "unit") && V && near1(Math.round(V.x), Math.round(V.y))) return V;
      return null;
    }
    // a blow on the walking ally: the foe's attack less her defence, never under 5% of it
    hitVip(e, atk) { const V = this.vip, d = Math.max(atk * 0.05, atk - V.def); V.hp -= d; V.hitAt = this.t; e.face = V.x >= e.x ? 1 : -1; e.hitAt = this.t;
      this.fx.push({ k: "num", x: V.x, y: V.y, v: Math.round(d), t: 0, life: 0.8 }); if (V.hp <= 0 && !V.dead) { V.hp = 0; V.dead = true; this.fx.push({ k: "vipdown", x: V.x, y: V.y, t: 0, life: 1.5 }); } }
    // the walking ally: she stands, and after each leg's wait walks to its square by the shortest way over the board as it stands; with none she waits and tries every second
    vipStep(dt) {
      const V = this.vip; if (V.dead) return;
      if (!V.walking) { const L = V.route[V.leg]; if (!L || this.t < V.waitUntil) return; V.walking = true; V.path = null; V.tryAt = this.t; V.waitFx = false; }
      const L = V.route[V.leg];
      if (!V.path) { if (this.t < V.tryAt) return; V.tryAt = this.t + 1;
        const p = bfsPath([Math.round(V.x), Math.round(V.y)], L.to);
        if (!p) { if (!V.waitFx) { V.waitFx = true; this.fx.push({ k: "vipwait", x: V.x, y: V.y, t: 0, life: 1.2 }); } return; }
        V.path = [[V.x, V.y]].concat(p.slice(1)); V.seg = 0; V.segT = 0; }
      let dist = V.speed * dt;
      while (dist > 0 && V.seg < V.path.length - 1) { const a = V.path[V.seg], b = V.path[V.seg + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), left = (1 - V.segT) * len;
        if (len < 1e-6 || dist >= left) { dist -= left; V.seg++; V.segT = 0; } else { V.segT += dist / len; dist = 0; } }
      const a = V.path[V.seg], b = V.path[Math.min(V.seg + 1, V.path.length - 1)]; if (b[0] !== a[0]) V.face = b[0] > a[0] ? 1 : -1;
      V.x = a[0] + (b[0] - a[0]) * V.segT; V.y = a[1] + (b[1] - a[1]) * V.segT;
      if (V.seg >= V.path.length - 1) { V.x = L.to[0]; V.y = L.to[1]; V.walking = false; V.path = null; V.leg++; const N = V.route[V.leg]; V.waitUntil = N ? this.t + N.wait : Infinity; }
    }
    // waves without end: from loop.from + loop.period on, every period the entries in [from, from + period) come again, each repeat stronger by grow
    loopStep() {
      const L = this.loopDef;
      while (this.t >= L.from + (L.n + 1) * L.period) { L.n++; const k = 1 + L.grow * L.n;
        for (const w of this.waves) if (w[0] >= L.from && w[0] < L.from + L.period) { L.q.push([w[0] + L.n * L.period, w[1], w[2], w[3], k]); if (!(w[3] && w[3].ally)) this.total++; }
        L.q.sort((a, b) => a[0] - b[0]); }
      while (L.q.length && L.q[0][0] <= this.t) { const [, type, s, o, k] = L.q.shift(); const e = this.spawn(type, s, o); e.hp = e.maxHp = Math.round(e.maxHp * k); e.atkMul = (e.atkMul || 1) * k; }
    }
    // one goal condition (see stage.goal)
    goalHolds(q) {
      const V = this.vip, cmp = (v) => q.op === "<=" ? v <= q.v : v >= q.v;
      switch (q.k) {
        case "clear": return !this.loopDef && this.waveIdx >= this.waves.length && !(this.extra && this.extra.length) && !(this.waitSpawn && this.waitSpawn.length) && this.enemies.every((e) => e.ally) && !this.hold && !(this.march && !this.march.part.final);
        case "life": return this.life <= 0;
        case "time": return this.t >= q.t;
        case "meter": case "count": return cmp(this.meters[q.id] ? this.meters[q.id].v : 0);
        case "vipAt": return !!V && !V.dead && !V.walking && Math.abs(V.x - q.at[0]) < 0.01 && Math.abs(V.y - q.at[1]) < 0.01;
        case "vipDead": return !!V && V.dead;
        case "noUnits": return this.noUnitsSince !== null && this.t - this.noUnitsSince >= q.s;
      }
      return false;
    }
    // lab L1: the chimneys' clocks. A bridge square that is to go waits until nobody stands on it; one that is to come back comes at once
    chimneyStep(dt) {
      let changed = false;
      for (const c of this.chimneys) {
        c.kept = this.t >= c.brokenUntil && this.units.some((u) => Math.abs(u.x - c.at[0]) + Math.abs(u.y - c.at[1]) === 1);
        if (c.kept) { c.stopT += dt; c.freeT = 0; } else { c.freeT += dt; c.stopT = 0; }
        if (!c.shut && c.kept && c.stopT >= c.close) c.shut = true;
        if (c.shut && !c.kept && c.freeT >= c.open) c.shut = false;
        const want = c.shut ? "_" : "^";
        for (const [x, y] of c.bridge) if (tileAt(x, y) !== want && this.setTile(x, y, want, true)) changed = true;
      }
      if (changed) this.boardChanged();
    }
    // the two squares a bridge joins: the walkable squares just past its first and its last square, along its line
    bridgeEnds(c) { const a = c.bridge[0], b = c.bridge[c.bridge.length - 1], dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]); return [[a[0] - dx, a[1] - dy], [b[0] + dx, b[1] + dy]]; }
    // every square that can be walked to from here (a roof)
    reach(from) { const seen = new Set([from[1] * W + from[0]]), q = [from]; while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of [[1, 0], [0, 1], [0, -1], [-1, 0]]) { const nx = x + dx, ny = y + dy, k = ny * W + nx; if (!walkable(tileAt(nx, ny)) || seen.has(k)) continue; seen.add(k); q.push([nx, ny]); } } return seen; }
    // with no way to what it is after: the way to the square of its own roof nearest to it (used where the stage lets foes leap)
    nearWay(T, goal) { const all = this.reach(T); let best = null, bd = 1e9; for (const k of all) { const x = k % W, y = (k / W) | 0, d = Math.hypot(x - goal[0], y - goal[1]); if (d < bd - 1e-9) { bd = d; best = [x, y]; } } return best ? bfsPath(T, best) : null; }
    // lab L1: a foe stranded on its roof stands; after stage.leap.after seconds of standing it leaps (dur seconds in the air) to the far end of the nearest missing bridge of
    // its roof. It cannot come down on a square one of ours stands on: then it waits retry seconds more. Returns true while it is in the air
    leapStep(e, dt) {
      const L = this.stage.leap;
      if (e.leap) { e.leap.t += dt; const u = Math.min(1, e.leap.t / e.leap.dur); e.x = e.leap.from[0] + (e.leap.to[0] - e.leap.from[0]) * u; e.y = e.leap.from[1] + (e.leap.to[1] - e.leap.from[1]) * u;
        if (u >= 1) { e.x = e.leap.to[0]; e.y = e.leap.to[1]; e.leap = null; e.stranded = false; e.standT = 0; e.leapWarn = false; this.replan(e); } return true; }
      if (!e.stranded || e.blockedBy || e.heldBy || e.remain > 0.05) { e.leapWarn = false; return false; }
      e.standT = (e.standT || 0) + dt; e.leapWarn = e.standT >= L.after - L.warn;
      if (e.standT < L.after) return false;
      const T = [Math.round(e.x), Math.round(e.y)], roof = this.reach(T); let best = null, bd = 1e9;
      for (const c of this.chimneys) { if (c.bridge.every(([x, y]) => walkable(tileAt(x, y)))) continue;
        const [a, b] = this.bridgeEnds(c), na = roof.has(a[1] * W + a[0]), nb = roof.has(b[1] * W + b[0]); if (na === nb) continue;
        const near = na ? a : b, far = na ? b : a, d = Math.hypot(near[0] - e.x, near[1] - e.y); if (d < bd) { bd = d; best = far; } }
      if (!best) return false;
      if (this.unitAt(best[0], best[1])) { e.standT = L.after - (L.retry || 5); return false; }
      e.leap = { t: 0, dur: L.dur || 3, from: [e.x, e.y], to: best.slice() }; e.leapWarn = false; e.blockedBy = null;
      this.fx.push({ k: "leap", e, x0: e.x, y0: e.y, x1: best[0], y1: best[1], t: 0, life: e.leap.dur }); return true;
    }
    // lab L1: the chimney sweep stands beside a stopped chimney for def.sweeper.dur seconds and clears it: its bridge is back at once and nobody can stop it for def.sweeper.block
    sweepStep(e, dt) {
      const S = e.def.sweeper, ex = Math.round(e.x), ey = Math.round(e.y), c = this.chimneys.find((q) => q.kept && Math.abs(q.at[0] - ex) + Math.abs(q.at[1] - ey) === 1);
      if (!c || e.remain > 0.05) { e.sweepT = 0; return; }
      e.sweepT = (e.sweepT || 0) + dt;
      if (e.sweepT >= S.dur) { e.sweepT = 0; c.brokenUntil = this.t + S.block; c.kept = false; c.shut = false; c.stopT = 0; this.fx.push({ k: "swept", x: c.at[0], y: c.at[1], t: 0, life: 1.2 }); this.chimneyStep(0); this.replan(e); }
    }
    // ---- lab L3: the mirror ----
    // the square across the glass from (x, y)
    mirrorOf(x) { return 2 * this.mirror.x - x; }
    // a square of glass is struck. Broken, it is road (",") from then on: the images in its row are gone (and none can be set there), and every foe of the room in the glass
    // makes for the real room's point through the gap
    hitMirror(e, q, atk) {
      q.hp -= atk; e.face = q.x >= e.x ? 1 : -1; e.hitAt = this.t; this.fx.push({ k: "num", x: q.x, y: q.y, v: Math.round(atk), t: 0, life: 0.8 });
      if (q.hp > 0 || q.broken) return;
      q.hp = 0; q.broken = true; this.setTile(q.x, q.y, ","); this.fx.push({ k: "glassbreak", x: q.x, y: q.y, t: 0, life: 1.2 }); this.snd("down");
      for (const u of this.units.slice()) if (u.image && u.y === q.y) this.retreat(u, false);
      for (const f of this.enemies) if (!f.dead && f.room === "R" && f.aim === undefined && !f.def.flying) this.toRealPoint(f);
    }
    // a foe of the room in the glass, once the glass has a gap: its way to the real room's point (the first B left of the glass)
    toRealPoint(e) { const B = BASES.find((b) => b[0] < this.mirror.x); if (!B) return; const T = [Math.round(e.x), Math.round(e.y)], p = walkable(tileAt(T[0], T[1])) ? bfsPath(T, B) : null;
      if (!p) return; e.path = [[e.x, e.y]].concat(p.length > 1 ? p.slice(1) : [T]); e.seg = 0; e.segT = 0; e.goalReal = true; this.advance(e, 0); }
    // the image in the glass of an operator just set down: across the glass, facing the other way, on a square of the same kind in a row whose glass still stands;
    // pct of the operator's health, attack and defence; free, and outside the deploy limit (a clone). It goes when the operator goes
    mirrorImage(u) {
      const M = this.mirror, x = this.mirrorOf(u.x), y = u.y, c = tileAt(x, y), fits = c === "*" || (u.def.tile === "g" ? c === "." || c === "~" || c === "=" : c === "h");
      if (M.display || !fits || M.sq.some((q) => q.y === y && q.broken) || this.unitAt(x, y)) return null;
      const hp = Math.round(u.maxHp * M.pct);
      const im = Object.assign({}, u, { id: this.uid++, x, y, dir: u.dir === 0 ? 2 : u.dir === 2 ? 0 : u.dir, hp, maxHp: hp, blocked: [], buff: {}, image: true, clone: true, expire: Infinity, owner: u, imgPct: M.pct, atkT: u.def.interval * 0.4, skillT: 0 });
      this.units.push(im); this.fx.push({ k: "imageup", x, y, t: 0, life: 0.6 }); return im;
    }
    // ---- lab L5: the echo ----
    get echoQ() { return this.echo ? this.echo.q : []; }
    // yesterday's deployment comes back as a ghost: pct of the recorded stats, free, outside the deploy limit (a clone), never ours to retreat or heal; it leaves at its
    // recorded time. If one of ours stands on its square, or the same operator is on the board, it does not come ("어제의 나는 사라졌다")
    echoStep() {
      const E = this.echo;
      while (E.q.length && E.q[0].t <= this.t) { const r = E.q.shift();
        if (this.unitAt(r.x, r.y) || this.units.some((u) => !u.ghost && !u.image && u.def.id === r.id)) { this.fx.push({ k: "echogone", x: r.x, y: r.y, id: r.id, t: 0, life: 1.6 }); continue; }
        if (r.until !== null && r.until !== undefined && r.until <= this.t) continue;
        this.makeGhost(r); }
      for (const u of this.units) if (u.ghost && u.skill.mode === "manual" && u.sp >= u.skill.sp && !(u.skillT > 0)) this.useSkill(u);   // a ghost presses its skill the moment it is ready
    }
    makeGhost(r) {
      const d = UNITS.find((q) => q.id === r.id); if (!d) return null;
      const ML = { 3: [40, 55], 4: [45, 60, 70], 5: [50, 70, 80], 6: [50, 80, 90] }, mult = r.mult || growth(d, 1, 40, (ML[d.rarity] || [40, 55])[1]), pct = this.echo.pct;   // the seed: as at elite 1, level 40
      const sk = skillAt(d.skills[r.skillIdx || 0] || d.skills[0], r.slv || 1, maxMastery(d) ? r.m || 0 : 0), mh = Math.max(1, Math.round(d.hp * mOf(mult, "hp") * pct));
      const u = { id: this.uid++, card: undefined, def: d, skill: sk, x: r.x, y: r.y, dir: r.dir, hp: mh, maxHp: mh, mult, hpMul: 1, potAtk: 1, potDef: 1, potRes: 0, paid: 0, sp: sk.init, skillT: 0, stored: 0,
        atkT: d.interval * 0.4, blocked: [], buff: {}, flash: 0, swing: 0, born: this.t, seq: (this.deploySeq = (this.deploySeq || 0) + 1), ghost: true, clone: true, imgPct: pct, expire: r.until === null || r.until === undefined ? Infinity : r.until };
      this.units.push(u); this.fx.push({ k: "echoup", x: r.x, y: r.y, t: 0, life: 0.8 }); return u;
    }
    // the attempt is over (won, lost, or given up after at least one deployment): its record replaces the stored one. Once per attempt
    echoSave() { const E = this.echo; if (!E || E.saved || !E.rec.length) return false; E.saved = true; return echoSet(E.key, E.rec.map((r) => { const o = Object.assign({}, r); delete o.uid; return o; })); }
    // ---- lab L4: the relay ----
    // where the paper is, as a square (the holder's or the carrier's when it is held or carried)
    relayAt() { const R = this.relay; return R.state === "held" ? [R.holder.x, R.holder.y] : R.state === "carried" ? [Math.round(R.carrier.x), Math.round(R.carrier.y)] : [R.x, R.y]; }
    // the shortest chain from the paper to the exit over squares an operator of the ground can stand on ('.', '*'): from the paper's square (or a square beside it) to a square
    // beside the exit. The page draws it dotted; the bot lays its chain along it
    relayWay() {
      const R = this.relay, [ix, iy] = this.relayAt(), ok = (x, y) => { const c = tileAt(x, y); return c === "." || c === "*"; }, key = (x, y) => y * W + x, N = [[1, 0], [0, 1], [-1, 0], [0, -1]];
      const starts = (ok(ix, iy) && R.state === "held" ? [[ix, iy]] : []).concat(N.map(([dx, dy]) => [ix + dx, iy + dy]).filter(([x, y]) => ok(x, y)));
      const prev = new Map(starts.map((q) => [key(q[0], q[1]), null])), q = starts.slice(); let end = null;
      while (q.length) { const [x, y] = q.shift(); if (Math.abs(x - R.exit[0]) + Math.abs(y - R.exit[1]) === 1) { end = [x, y]; break; }
        for (const [dx, dy] of N) { const nx = x + dx, ny = y + dy; if (!ok(nx, ny) || prev.has(key(nx, ny))) continue; prev.set(key(nx, ny), [x, y]); q.push([nx, ny]); } }
      if (!end) return null; const p = []; for (let c = end; c; c = prev.get(key(c[0], c[1]))) p.push(c); return p.reverse();
    }
    relayPutBack() { const R = this.relay; R.state = "vault"; R.x = R.from[0]; R.y = R.from[1]; R.holder = null; R.carrier = null; R.job = null; this.meter("back", 1); this.fx.push({ k: "relayback", x: R.x, y: R.y, t: 0, life: 1.4 });
      for (const e of this.enemies) if (e.def.collector && !e.dead) { e.dead = true; e.vanished = true; }   // the collectors are about only while the paper is out
      for (const u of this.units) u.relayFrom = null; }
    relayDrop(x, y) { const R = this.relay; R.state = "ground"; R.x = x; R.y = y; R.holder = null; R.carrier = null; R.job = null; this.fx.push({ k: "relaydrop", x, y, t: 0, life: 1.0 }); }
    // each tick: take, pass or deliver (each pass seconds; an interrupted hand-over starts again), the collectors' pick-up and carry back
    relayStep(dt) {
      const R = this.relay; if (R.state === "out") return;
      const near1 = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by) <= 1, job = (kind, by, to) => { if (!R.job || R.job.kind !== kind || R.job.by !== by || R.job.to !== to) R.job = { kind, by, to, t: 0 }; R.job.t += dt; return R.job.t >= R.pass; };
      if (R.state === "vault" || R.state === "ground") {
        const u = this.units.find((q) => !q.image && (R.state === "ground" ? near1(q.x, q.y, R.x, R.y) : Math.abs(q.x - R.x) + Math.abs(q.y - R.y) === 1));
        if (u) { if (job("take", u, null)) { R.state = "held"; R.holder = u; R.job = null; u.relayFrom = null; this.fx.push({ k: "relaytake", x: u.x, y: u.y, t: 0, life: 0.8 }); } }
        else R.job = null;
        if (R.state === "ground") for (const e of this.enemies) { if (!e.def.collector || e.dead || e.carrying) continue;   // a collector beside it (or on it) picks it up in 2 s
          if (near1(Math.round(e.x), Math.round(e.y), R.x, R.y) && e.remain <= 0.05) { e.pickT = (e.pickT || 0) + dt; if (e.pickT >= 2) { R.state = "carried"; R.carrier = e; R.job = null; e.carrying = true; e.pickT = 0; this.replan(e); this.fx.push({ k: "relaygrab", x: e.x, y: e.y, t: 0, life: 0.8 }); break; } } else e.pickT = 0; }
      } else if (R.state === "held") {
        const h = R.holder;
        if (Math.abs(h.x - R.exit[0]) + Math.abs(h.y - R.exit[1]) === 1) { if (job("deliver", h, null)) { R.state = "out"; R.holder = null; R.job = null; this.meter("out", 1); this.fx.push({ k: "relayout", x: R.exit[0], y: R.exit[1], t: 0, life: 2 }); } return; }
        const [fx, fy] = rotate([1, 0], h.dir), to = this.unitAt(h.x + fx, h.y + fy);
        if (to && !to.image && to !== h.relayFrom) { if (job("pass", h, to)) { R.holder = to; to.relayFrom = h; R.job = null; this.fx.push({ k: "relaypass", x0: h.x, y0: h.y, x1: to.x, y1: to.y, t: 0, life: 0.6 }); } }
        else R.job = null;
      } else if (R.state === "carried") {
        const e = R.carrier, [vx, vy] = R.from;
        if (Math.abs(Math.round(e.x) - vx) + Math.abs(Math.round(e.y) - vy) === 1 && e.remain <= 0.05) this.relayPutBack();
      }
    }
    // ---- lab L3 (LAB-04): the masks ----
    // judge a masked figure: "pass" lets it through (nobody blocks it any more and it walks to the door), "kill" makes it a normal foe (it fights back)
    judge(e, how) {
      if (!e || !e.mask || e.judged || e.passed || e.dead) return false;
      if (how === "pass") { e.passed = true; e.blockedBy = null; this.fx.push({ k: "judged", e, pass: true, x: e.x, y: e.y, t: 0, life: 1.0 }); }
      else if (how === "kill") { e.judged = true; e.def = Object.assign({}, e.def, { atk: 300 }); e.atkT = Math.max(e.atkT, 0.6); this.fx.push({ k: "judged", e, pass: false, x: e.x, y: e.y, t: 0, life: 1.0 }); }
      else return false;
      return true;
    }
    // each tick: the reflection's square across the glass; the 12 s since it was first held (then it is let through by itself)
    maskStep() {
      const mx = this.mirror ? this.mirror.x : 6;
      for (const e of this.enemies) { if (!e.mask || e.dead) continue; e.reflX = 2 * mx - e.x; e.reflY = e.y;
        if (e.blockedBy && e.firstBlockT === undefined) e.firstBlockT = this.t;
        if (!e.judged && !e.passed && e.firstBlockT !== undefined && this.t - e.firstBlockT >= 12) { this.judge(e, "pass"); e.autoPass = true; } }
    }
    // ---- lab L2: the beat ----
    // the zone a square belongs to (one left of the first zone is in the first, one right of the last in the last)
    beatZone(x) { const Z = this.beat.zones, rx = Math.round(x); return Z.find((z) => rx >= z.x0 && rx <= z.x1) || (rx < Z[0].x0 ? Z[0] : Z[Z.length - 1]); }
    beatLen(z) { return [2.0, 1.4, 0.9][z.level]; }   // slow, normal, fast
    // the zones' clocks: a keeper beside the metronome makes its zone a level slower, a baton beside it a level faster (both: they cancel)
    beatStep(dt) {
      for (const z of this.beat.zones) {
        const [mx, my] = z.metronome, near = (x, y) => Math.abs(x - mx) + Math.abs(y - my) === 1;
        z.kept = this.units.some((u) => near(u.x, u.y)); z.batoned = this.enemies.some((e) => !e.dead && e.def.baton && !e.hop && near(Math.round(e.x), Math.round(e.y)));
        z.level = Math.max(0, Math.min(2, 1 - (z.kept ? 1 : 0) + (z.batoned ? 1 : 0)));
        z.ph += dt / this.beatLen(z);
        while (z.ph >= 1) { z.ph -= 1; z.n++; if (z.n % 4 === 0) z.lastDown = this.t; }
      }
    }
    // inside the downbeat window of a zone: within 0.2 s of the last downbeat or of the next one
    onBeat(z) { const L = this.beatLen(z), toNext = (1 - z.ph) * L + ((4 - (z.n % 4)) % 4 === 0 ? 3 : (4 - (z.n % 4)) - 1) * L; return (z.n > 0 && this.t - z.lastDown <= 0.2) || toNext <= 0.2; }
    // a blocker on the square the foe stands on or on the next one of its road takes it (if it has room); then it does not hop
    beatBlock(e) {
      const ex = Math.round(e.x), ey = Math.round(e.y); let i = e.seg + 1; while (i < e.path.length && Math.round(e.path[i][0]) === ex && Math.round(e.path[i][1]) === ey) i++;
      const nx = e.path[i], sq = nx ? [[ex, ey], [Math.round(nx[0]), Math.round(nx[1])]] : [[ex, ey]];
      for (const [x, y] of sq) { const u = this.unitAt(x, y);
        if (u && this.onGround(u) && this.blockLoad(u) + e.def.weight <= this.stat(u, "block")) { e.blockedBy = u; e.blockedAt = this.t; return true; } }
      return false;
    }
    // a foe's step on the beat: it stands in the middle of its square and on each beat of its zone hops to the next square of its road (0.25 s). Slow (speed under 0.6, after
    // any slowing): every second beat; fast (over 1.2): two squares; a charge: three. Landing on a rest it waits for the zone's downbeat. Returns true at the end of its road
    beatMove(e, dt, slow) {
      const z = this.beatZone(e.x); if (e.chargeT > 0) e.chargeQueued = true;
      if (!e.hop) {
        { const u = this.unitAt(Math.round(e.x), Math.round(e.y)); if (u && this.onGround(u) && this.blockLoad(u) + e.def.weight <= this.stat(u, "block")) { e.blockedBy = u; e.blockedAt = this.t; return false; } }   // one of ours set down on its very square holds it at once
        const skipped = e.beatSeen !== undefined && this.t - e.beatSeen > dt * 1.5; e.beatSeen = this.t;
        if (skipped) { e.bn = z.n; e.bz = z.id; return e.seg >= e.path.length - 1; }   // it was held, aiming or pausing until now: it moves on the next beat, not on one it missed
        if (e.bz !== z.id) { e.bz = z.id; e.bn = z.n; return e.seg >= e.path.length - 1; }   // just came into this zone: it waits for this zone's next beat
        if (e.bn === z.n) return e.seg >= e.path.length - 1;
        e.bn = z.n; const down = z.n % 4 === 0, sp = e.def.speed * (1 - (slow || 0));
        if (e.restUntilDown) { if (!down) return false; e.restUntilDown = false; }
        if (sp < 0.6) { e.beatOdd = !e.beatOdd; if (e.beatOdd) return false; }
        let n = sp > 1.2 ? 2 : 1; if (e.chargeQueued) { n = 3; e.chargeQueued = false; }
        if (e.seg >= e.path.length - 1) return true;
        if (this.beatBlock(e)) return false;
        e.hop = { left: n, n };
      }
      let d = e.hop.n / 0.25 * dt;
      while (d > 1e-9 && e.hop && e.hop.left > 0) {
        const a = e.path[e.seg], b = e.path[e.seg + 1]; if (!b) { e.hop = null; break; }
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-9) { e.seg++; e.segT = 0; continue; }
        const rem = (1 - e.segT) * L;
        if (d < rem) { this.advance(e, d); d = 0; break; }
        this.advance(e, rem); d -= rem; e.hop.left--;
        if (e.path.waits && e.path.waits[e.seg] && e.waitedAt !== e.seg) { e.waitedAt = e.seg; e.pauseT = e.path.waits[e.seg]; e.hop.left = 0; }
        if (tileAt(Math.round(e.x), Math.round(e.y)) === "R") { e.restUntilDown = true; e.hop.left = 0; this.fx.push({ k: "rest", x: e.x, y: e.y, t: 0, life: 0.8 }); }
        if (e.hop.left > 0 && this.beatBlock(e)) e.hop.left = 0;
      }
      if (e.hop && e.hop.left <= 0) e.hop = null;
      return !e.hop && e.seg >= e.path.length - 1;
    }
    // the stage's own ending: lost when any lose condition holds (tested first), won when every win condition does
    goalStep() {
      if (this.units.length) { this.everDeployed = true; this.noUnitsSince = null; } else if (this.everDeployed && this.noUnitsSince === null) this.noUnitsSince = this.t;
      const G = this.goal, lost = (G.lose || []).find((q) => this.goalHolds(q));
      if (lost) { this.over = "lose"; this.goalWhy = lost.k; this.life = Math.max(0, this.life); this.escortLost = lost.k === "vipDead"; }
      else if ((G.win || []).length && G.win.every((q) => this.goalHolds(q))) this.over = "win";
    }
    driftAt(x, y) { const u = this.drift && this.drift.get(y * 100 + x); return !!u && u > this.t; }
    // the blizzard (walls: "W" stands up and stops it; "#" is sunken ground it blows over; rises are snowed over too; mud freezes all at once): it blows in from one side of the board and, for as long as it lasts, its front creeps square by square along every line.
    // Each empty square it reaches is snowed under (nobody can be set down there) until it ends. A raised wall stops it (a rise does not: it is snowed over too);
    // so does an operator — who freezes where they stand, unable to act and losing health, until it passes. Pull them back and the front moves on.
    // While it blows, every foe on foot is slowed, except those made for the cold.
    windStep() {
      const w = this.wind, t = this.t, [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][w.dir], horiz = dy === 0, lines = horiz ? H : W, len = horiz ? W : H;
      if (!w.blowing) {
        if (!w.warned && t >= w.next - w.warn) { w.warned = true; this.fx.push({ k: "windwarn", dir: w.dir, t: 0, life: w.warn }); }
        if (t < w.next) return;
        w.curDur = (w.durs && w.durs[w.n]) || w.dur; w.n++;   // a stage may make the first ones short
        w.blowing = true; w.warned = false; w.end = t + w.curDur; w.front = new Array(lines).fill(0); w.adv = t; w.next += w.every; w.done = new Array(lines).fill(false);
        this.fx.push({ k: "gust", dir: w.dir, t: 0, life: w.curDur }); this.snd("wind");
        // the rasputitsa freezes over the moment it blows, sheltered or not: no one can be set down on the mud, and whoever stands in it freezes
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tileAt(x, y) === "~") { this.drift.set(y * 100 + x, w.end + 1.5);
          const u = this.unitAt(x, y); if (u && !u.blizFrozen && !this.warmAt(x, y)) { u.blizFrozen = true; u.wind = null; u.frozenT = Math.max(u.frozenT || 0, w.curDur + 0.05); this.fx.push({ k: "freeze", x: u.x, y: u.y, t: 0, life: 0.8 }); } }
      }
      if (t >= w.end) {   // it passes: the snow melts off, the frozen thaw
        w.blowing = false; w.front = null;
        for (const [k, until] of this.drift) if (until > t + 1.5) this.drift.set(k, t + 1.5);
        for (const u of this.units) if (u.blizFrozen) { u.blizFrozen = false; u.frozenT = 0; u.frostN = 0; this.fx.push({ k: "freeze", x: u.x, y: u.y, t: 0, life: 0.6 }); }
        return;
      }
      if (t < w.adv) return;
      w.adv = t + w.step;
      for (let a = 0; a < lines; a++) {
        if (w.done[a]) continue;
        const i = w.front[a]; if (i >= len) { w.done[a] = true; continue; }
        const j = (dx > 0 || dy > 0) ? i : len - 1 - i, x = horiz ? j : a, y = horiz ? a : j, c = tileAt(x, y);
        if (c === "W") { w.done[a] = true; continue; }   // a raised wall takes the wind; sunken ground (#) lets it blow straight over
        const u = this.unitAt(x, y);
        if (u) {   // it reaches someone standing there: they freeze, and hold it back
          if ((u.frostImm || 0) > t || this.warmAt(u.x, u.y)) continue;   // just thawed (the firebottle), or by a brazier: it holds the wind without freezing (the firebottle): steaming still, it holds the wind a moment before the ice takes it again
          if (!u.blizFrozen) { u.blizFrozen = true; u.wind = null; this.fx.push({ k: "freeze", x: u.x, y: u.y, t: 0, life: 0.8 }); }
          u.frozenT = Math.max(u.frozenT || 0, w.end - t + 0.05); continue;
        }
        if (this.enemies.some((q) => q.ally && !q.dead && !q.def.flying && Math.round(q.x) === x && Math.round(q.y) === y)) continue;   // our rebels stand in its way too, and they are used to the cold
        if ((c === "." || c === "~" || c === "=" || c === "h" || c === "*") && !this.warmAt(x, y)) this.drift.set(y * 100 + x, w.end + 1.5);
        w.front[a] = i + 1;   // a rise is snowed over like anywhere else: only a raised wall or someone standing there holds it
      }
    }
    smokeAt(x, y) { const v = this.smoke.get(y * 100 + x); return v !== undefined && v <= this.t; }
    clearSmoke(x, y, dur) { const k = y * 100 + x; if (this.smoke.has(k) && this.smoke.get(k) <= this.t) { this.smoke.set(k, this.t + dur); this.fx.push({ k: "unsmoke", x, y, t: 0, life: 0.9 }); } }
    calling() { return !!(this.calls && this.calls.until > this.t); }
    callStep() { const c = this.calls;
      if (!c.warned && this.t >= c.next - c.warn) { c.warned = true; this.fx.push({ k: "callwarn", x: c.at[0], y: c.at[1], t: 0, life: c.warn }); }
      if (this.t >= c.next) { c.until = this.t + c.dur; c.next += c.every; c.warned = false; this.fx.push({ k: "calling", x: c.at[0], y: c.at[1], t: 0, life: c.dur }); } }
    lampLit(x, y) { return tileAt(x, y) === "F" && !this.lampOff.has(y * 100 + x); }
    lampGuarded(x, y) { return this.units.some((u) => Math.abs(u.x - x) + Math.abs(u.y - y) === 1); }   // someone stands right by it (above, below, left or right): nobody puts it out
    darkAt(x, y) { const L = this.stage.lamps; if (!L) return false; const r = L.r || 1; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (this.lampLit(x + dx, y + dy)) return false; return true; }
    // force: put it out even if somebody stands by it. The time it went out is kept. A lamp put out by a lamp-breaker (by.def.snuff === "force") is broken:
    // only someone deployed after that can light it again
    snuff(x, y, by, force) { if (!this.lampLit(x, y) || (!force && this.lampGuarded(x, y))) return false; const k = y * 100 + x; this.lampOff.add(k); this.lampOffT.set(k, this.t);
      if (by && by.def && by.def.snuff === "force") this.lampBroken.add(k); else this.lampBroken.delete(k);
      this.relightAt.delete(k); this.freshAt.delete(k); this.fx.push({ k: "snuff", x, y, t: 0, life: 0.9 }); return true; }
    relight(x, y) { if (tileAt(x, y) !== "F" || !this.lampOff.delete(y * 100 + x)) return false; this.lampOffT.delete(y * 100 + x); this.relightAt.delete(y * 100 + x); this.freshAt.delete(y * 100 + x); this.lampBroken.delete(y * 100 + x); this.fx.push({ k: "relight", x, y, t: 0, life: 0.9 });
      const r = (this.stage.lamps && this.stage.lamps.r) || 1; for (const e of this.enemies) if (e.ally && e.waiting && !e.dead && Math.max(Math.abs(e.x - x), Math.abs(e.y - y)) <= r) this.wake(e);   // the light finds whoever was left tied up in the dark: they are loose, and on our side
      return true; }
    // A fresh keeper of a lamp that is out: one of ours right beside it (above, below, left or right) who was deployed after the lamp went out
    freshKeeper(x, y) { const off = this.lampOffT.has(y * 100 + x) ? this.lampOffT.get(y * 100 + x) : -1; return this.units.some((u) => Math.abs(u.x - x) + Math.abs(u.y - y) === 1 && u.born > off); }
    // A stale keeper of a lamp that is out: one of ours right beside it who was already deployed when it went out (and so has stood there ever since)
    staleKeeper(x, y) { const off = this.lampOffT.has(y * 100 + x) ? this.lampOffT.get(y * 100 + x) : -1; return this.units.some((u) => Math.abs(u.x - x) + Math.abs(u.y - y) === 1 && u.born <= off); }
    // the relight clocks, over every lamp that is out. The fresh clock runs while a fresh keeper stands by it and lights the lamp when it runs out; with no fresh keeper
    // it starts over. It belongs to the lamp, so two fresh keepers in turn without a gap keep it running. A lamp that is not broken also lights relightStale seconds
    // after it went out while a stale keeper stands by it. relightAt holds whichever comes first
    relightStep() { const L = this.stage.lamps || {}, R = L.relight || 6, RS = L.relightStale || 14;
      for (const k of [...this.lampOff]) { const x = k % 100, y = (k / 100) | 0;
        if (tileAt(x, y) !== "F") continue;
        if (!this.freshKeeper(x, y)) this.freshAt.delete(k); else if (!this.freshAt.has(k)) this.freshAt.set(k, this.t + R);
        let at = this.freshAt.has(k) ? this.freshAt.get(k) : Infinity;
        if (!this.lampBroken.has(k) && this.staleKeeper(x, y)) at = Math.min(at, this.lampOffT.get(k) + RS);
        if (at === Infinity) { this.relightAt.delete(k); continue; }
        this.relightAt.set(k, at);
        if (this.t >= at) this.relight(x, y); } }
    // A boss order (a call, a falter, a breach) with a key "phase" works only in that stage of a two-stage boss (stage 1 unless set), and none works while he is
    // crowning himself between the stages
    phaseOn(e, o) { if (e.crownUntil !== undefined && !e.crowned) return false; return !o || o.phase === undefined || (e.phase || 1) === o.phase; }
    // "all guns, all squadrons": every line on the board is laid at once, and a gun with a "full" line fires down all of it the next time
    barrage() { for (const v of this.volleys) { if (!v.st && !v.ours) v.next = Math.min(v.next, this.t + (v.warn || 3)); if (v.full) v.useFull = true; } }
    // an operator is put off their stroke (caught alone by a charge, or hit by a called shot): their next attack comes that many seconds later
    stagger(u, s) { u.atkT = Math.max(u.atkT || 0, 0) + s; u.wind = null; }
    // board shifts (stage.shifts): warned shift.warn seconds before, then at shift.t each listed square becomes its new character on this game's copy of the rows and the
    // routes are worked out again. Only a wall opening onto road is allowed, and nobody may stand on the square. Those already walking keep the way they were given
    shiftStep() {
      for (const sh of this.shifts) {
        if (!sh.warned && this.t >= sh.t - sh.warn) { sh.warned = true; this.fx.push({ k: "shiftwarn", tiles: sh.tiles, t: 0, life: sh.warn }); }
        if (sh.done || this.t < sh.t || !this.rows) continue;
        sh.done = true;
        for (const [x, y, ch] of sh.set) {
          if (walkable(tileAt(x, y)) || !walkable(ch)) { console.error("shift: only a wall may open onto road", x, y, tileAt(x, y), ch); continue; }
          if (this.units.some((u) => u.x === x && u.y === y) || this.enemies.some((q) => !q.dead && !q.def.flying && Math.round(q.x) === x && Math.round(q.y) === y)) console.error("shift: somebody stands on", x, y);
          this.setTile(x, y, ch, true);   // a wall opening onto road: nobody standing there can stop that
        }
        this.boardChanged();   // the gates, the points, the routes and the waypoint cache, from the board as it now stands (opening a wall leaves nobody's road cut, so nobody re-plans)
        this.fx.push({ k: "shift", tiles: sh.tiles, banner: sh.banner, t: 0, life: 2 });
      }
    }
    // grapeshot (chapter 3): a gun at the end of a line of squares fires down it on a timetable — warned first, then everything standing in the line is hit, theirs and ours
    volleyStep() {
      const locked = this.enemies.some((e) => !e.dead && e.def.gunner && !e.ally && (e.pauseT > 0 || e.postUntil > this.t));   // their gunnery officer stands at his post: nobody takes a gun from under him
      for (const v of this.volleys) {
        if (v.until !== undefined && this.t > v.until) continue;
        const holder = v.muzzle && !locked ? this.units.find((u) => u.x === v.muzzle[0] && u.y === v.muzzle[1]) : null;
        if (holder) { if (v.heldBy !== holder) { v.heldBy = holder; v.heldAt = this.t; } v.lingerUntil = undefined; }
        else { v.heldBy = null;
          if (v.ours && v.linger && !locked && v.lingerUntil === undefined) v.lingerUntil = this.t + v.linger;   // a gun of ours left alone stays ours for v.linger seconds
          if (v.ours && !(v.linger && !locked && this.t < v.lingerUntil)) { v.ours = false; v.lingerUntil = undefined; v.st = 0; v.next = Math.max(v.next, this.t + (v.warn || 3) + 2); this.fx.push({ k: "gunlost", x: v.muzzle[0], y: v.muzzle[1], t: 0, life: 1.2 }); } }
        // whoever stands on the square before the muzzle silences the gun at once; whoever holds it long enough (v.capture seconds) has taken it: from then on it fires
        // for us — on its own timetable, down its own line, and only at them — for as long as that square is held
        if (holder && v.capture && !v.ours && this.t - v.heldAt >= v.capture) { v.ours = true; v.st = 0; v.next = Math.max(this.t + (v.warn || 3) + 1, Math.min(v.next, this.t + 8)); this.fx.push({ k: "gunours", x: v.muzzle[0], y: v.muzzle[1], t: 0, life: 1.6 }); }
        v.held = !!holder && !v.ours; v.capT = holder && v.capture && !v.ours ? (this.t - v.heldAt) / v.capture : 0;
        if (v.held) { if (v.st) v.st = 0; v.next = Math.max(v.next, this.t + 1); continue; }
        // the line for this shot is fixed when it is warned: v.full instead of v.tiles once after a barrage call; every v.alt.every-th shot of theirs goes down v.alt.tiles
        // (full wins over alt); a gun of ours fires down v.tiles and v.alt.tiles together
        if (v.st === 0 && this.t >= v.next - (v.warn || 3)) { v.st = 1; v.shotTiles = v.useFull && v.full ? v.full : v.ours && v.alt ? v.tiles.concat(v.alt.tiles) : v.alt && ((v.nShot || 0) + 1) % v.alt.every === 0 ? v.alt.tiles : v.tiles; v.useFull = false; this.fx.push({ k: "firewarn", tiles: v.shotTiles, grape: true, charge: v.kind === "charge", ours: !!v.ours, t: 0, life: v.warn || 3 }); }
        if (v.st === 1 && this.t >= v.next) { v.st = 0; v.next += this.t < (v.rapidUntil || 0) ? v.rapid : v.ours && v.mineEvery ? v.mineEvery : v.every; v.shotT = this.t; this.snd("boom"); const tiles = v.shotTiles || v.tiles;
          if (!v.ours) v.nShot = (v.nShot || 0) + 1;   // their shots are counted for v.alt
          // a cavalry charge (kind "charge": horsemen from off the board, down the line): whoever stands in a square — another of ours right beside them — takes a quarter;
          // whoever stands alone takes all of it. Grapeshot is the other way about: it takes a share of what a body can bear (v.pct of full health, armour or no), a packed
          // square (v.pack) more, and it does not spare those who stand with us; their own men, further from the muzzle than they look, get off lighter (v.foe)
          const beside = (u) => this.units.some((q) => q !== u && Math.abs(q.x - u.x) + Math.abs(q.y - u.y) === 1), on = (x, y) => tiles.some(([a, b]) => a === x && b === y);
          if (!v.ours) { for (const u of this.units.slice()) if (on(u.x, u.y)) { const sq = beside(u), base = v.pct ? u.maxHp * v.pct : v.dmg;
              this.damage(u, base * (v.kind === "charge" ? (sq ? 0.25 : 1) : (sq && v.pack ? v.pack : 1)), v.pct ? "true" : "phys", null); u.flash = 0.2; if (v.kind === "charge") { if (!sq) this.stagger(u, 2.0); this.fx.push({ k: "square", x: u.x, y: u.y, ok: sq, t: 0, life: 0.9 }); } }
            if (v.kind !== "charge") for (const e of this.enemies) if (!e.dead && e.ally && !e.def.flying && on(Math.round(e.x), Math.round(e.y))) { this.damage(e, v.pct ? e.maxHp * v.pct * 1.4 : v.dmg, "true", null); e.flash = 0.2; } }
          // a shot of our gun takes at least v.minePct of a common foe's full strength, and at least v.bossPct of a boss's (of the stage he is in)
          if (v.kind !== "charge") for (const e of this.enemies) if (!e.dead && !e.def.flying && !e.ally && on(Math.round(e.x), Math.round(e.y))) { let amt = v.dmg * (v.ours ? v.mine || 1.5 : v.foe || 1);
            if (v.ours) { const p = e.def.boss ? v.bossPct : v.minePct; if (p) amt = Math.max(amt, p * e.maxHp); }
            this.damage(e, amt, "true", null); e.flash = 0.2; }
          this.fx.push({ k: "grape", tiles, charge: v.kind === "charge", ours: !!v.ours, from: v.muzzle || tiles[0], t: 0, life: v.kind === "charge" ? 0.8 : 0.5 });
          if (v.kind === "charge" && v.leave && (v.nCharge = (v.nCharge || 0) + 1) >= v.leave.from) this.leaveRiders(v); }
      }
    }
    // a charge with "leave": from its v.leave.from-th pass on, it leaves v.leave.n men of v.leave.type behind on the square of its line furthest from every point
    leaveRiders(v) { const L = v.leave, far = (p) => { const q = bfsPath(p, BASE); return q ? q.length : -1; };
      const at = v.tiles.filter(([x, y]) => walkable(tileAt(x, y))).map((p) => [p, far(p)]).filter((q) => q[1] > 0).sort((a, b) => b[1] - a[1])[0];
      if (!at) return; const [x, y] = at[0];
      for (let n = 0; n < (L.n || 1); n++) { const m = this.spawn(L.type, 0); m.path = bfsPath([x, y], BASE); m.seg = 0; m.segT = 0; m.x = x; m.y = y; m.remain = segLen(m.path); m.stunT = 0.3 + n * 0.6; this.total++;
        this.fx.push({ k: "land", x, y, t: 0, life: 0.8 }); } }
    // a called shot (the gunnery colonel): he points at a healer within reach first (an operator whose attack heals), otherwise at whoever hits hardest within reach;
    // that square and the four beside it are marked, and a few seconds on the round lands
    shotStep(e, dt) { const C = e.def.callshot; if (e.shotCD === undefined) e.shotCD = C.every * 0.6;
      if (e.postUntil > this.t || e.waiting || e.pauseT > 0) return;   // not while he stands at his post
      if ((e.shotCD -= dt) > 0) return;
      let best = null; let ba = -1; for (const heal of [true, false]) { for (const u of this.units) { const a = this.stat(u, "atk"); if ((u.def.dmg === "heal") === heal && Math.hypot(u.x - e.x, u.y - e.y) <= C.r && a > ba) { best = u; ba = a; } } if (best) break; }
      if (!best) { e.shotCD = 1; return; }
      e.shotCD = C.every; const tiles = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [best.x + a, best.y + b]);
      this.shells.push({ at: this.t + C.warn, tiles, pct: C.pct, delay: C.delay || 0 }); this.fx.push({ k: "firewarn", tiles, grape: true, t: 0, life: C.warn }); this.fx.push({ k: "point", e, x: e.x, y: e.y, tx: best.x, ty: best.y, t: 0, life: 0.9 }); }
    shellStep() { for (const sh of this.shells) if (!sh.done && this.t >= sh.at) { sh.done = true; this.snd("boom");
        for (const u of this.units.slice()) if (sh.tiles.some(([a, b]) => a === u.x && b === u.y)) { this.damage(u, u.maxHp * sh.pct, "true", null); u.flash = 0.2; if (sh.delay) this.stagger(u, sh.delay); }
        this.fx.push({ k: "grape", tiles: sh.tiles, from: sh.tiles[0], t: 0, life: 0.5 }); }
      this.shells = this.shells.filter((q) => !q.done); }
    blizzardOn() { return !!(this.wind && this.wind.blowing); }
    warmAt(x, y) { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (tileAt(x + dx, y + dy) === "F") return true; return false; }   // beside a brazier (F) nobody freezes
    // 동상: one more stack; two make an operator freeze solid for a while
    frostHit(u, n) {
      if (!u || u.isEnemy || !this.units.includes(u) || u.frozenT > 0 || (u.frostImm || 0) > this.t) return;
      u.frostN = (u.frostN || 0) + (n || 1); u.frostT = FROST.dur;
      if (u.frostN >= 2) { u.frostN = 0; u.frostT = 0; u.frozenT = u.def.id === "lulu" ? FROST.freeze * 0.5 : FROST.freeze; u.wind = null; this.fx.push({ k: "freeze", x: u.x, y: u.y, t: 0, life: 0.8 }); }
    }
    wake(e) { if (!e.waiting) return; e.waiting = false; e.hold = false; e.holdUntil = undefined; e.postUntil = 0; this.fx.push({ k: "wake", e, x: e.x, y: e.y, t: 0, life: 0.9 }); }
    fireAt(x, y) { return !!this.fires && this.fires.some((f) => f.st === 2 && f.tiles.some(([a, b]) => a === x && b === y)); }
    fireStep(dt) {
      for (const f of this.fires) {
        if (f.st === 0 && this.t >= f.at - f.warn) { f.st = 1; this.fx.push({ k: "firewarn", tiles: f.tiles, t: 0, life: f.warn }); }
        if (f.st === 1 && this.t >= f.at) { f.st = 2; f.lit = this.t; this.snd("boom"); }
        if (f.st === 2 && f.dur && this.t >= f.at + f.dur) f.st = 3;
      }
      for (const u of this.units) if (this.fireAt(u.x, u.y)) { this.damage(u, Math.max(FIRE.min, u.maxHp * FIRE.pct) * dt, "true", null); u.flash = Math.max(u.flash || 0, 0.05); }
    }
    // the infernal machine goes off: everything close by, theirs and ours alike
    explode(e) {
      if (e.boomed) return; e.boomed = true;
      const b = e.def.bomb, dmg = b.dmg * (e.atkMul || 1);
      for (const u of this.units.slice()) if (Math.hypot(u.x - e.x, u.y - e.y) <= b.r) this.damage(u, dmg, "true", null, e);
      for (const q of this.enemies) if (q !== e && !q.dead && !q.def.flying && Math.hypot(q.x - e.x, q.y - e.y) <= b.r) { this.damage(q, dmg * (q.def.bomb ? 1 : b.foe || 1), "true", null); q.flash = 0.25; }
      this.fx.push({ k: "boom", x: e.x, y: e.y, r: b.r, t: 0, life: 0.9 }); this.snd("boom");
    }
    get deployed() { return this.units.filter((u) => !u.clone).length; }   // a drawn summon takes a place too; only a skill's short-lived double does not
    unitAt(x, y) { return this.units.find((u) => u.x === x && u.y === y); }
    canDeployAt(card, x, y) {
      if (this.onlyTile && (x !== this.onlyTile[0] || y !== this.onlyTile[1])) return false;
      const c0 = tileAt(x, y), c = c0 === "~" || c0 === "=" ? "." : c0;
      if (c !== "*" && (card.def.tile === "g" ? c !== "." : c !== "h")) return false;
      if (this.fireAt(x, y)) return false;   // a burning square: nobody can be set down in the fire
      if (this.driftAt(x, y)) return false;   // snowed under by the last gust
      if (this.enemies.some((q) => !q.dead && !q.def.flying && (q.waiting || q.ally || q.postUntil > this.t) && Math.round(q.x) === x && Math.round(q.y) === y)) return false;   // somebody is waiting, posted or standing with us on that square
      for (let i = this.waveIdx; i < this.waves.length; i++) { const o = this.waves[i][3]; if (this.waves[i][0] <= 1 && o && o.at && (o.until !== undefined || o.wait || o.ally) && o.at[0] === x && o.at[1] === y) return false; }   // a post is kept free for the one who has not come to it yet
      if (this.enemies.some((q) => q.perched && q.x === x && q.y === y)) return false;   // somebody is already up there
      if (this.vip && !this.vip.dead && Math.round(this.vip.x) === x && Math.round(this.vip.y) === y) return false;   // lab: nobody is set down on the walking ally
      if (this.vipSquares.length && this.vipSquares.some((q) => q[0] === x && q[1] === y)) return false;   // ...nor on a square where she stands or will wait
      if (this.mirror && x >= this.mirror.x) return false;   // lab L3: only the real room, left of the glass
      return !this.unitAt(x, y);
    }
    // like the original: every retreat or fall makes the next deployment 50% dearer, up to double
    costOf(card) { return Math.min(CFG.maxCost, Math.round(Math.max(1, card.def.cost + eliteCost(card.def, card.elite) - (card.pot ? card.pot.cost : 0)) * (1 + 0.5 * Math.min(card.level, 2)))); }
    deployCheck(card) {
      if (card.summonOf !== undefined) {   // a summon card: only while its summoner is on the field, no deploy limit
        if (!card.active) return "소환사 없음";
        if (card.charges <= 0) return card.chargeT.length ? "재배치 대기 중" : "남은 소환물 없음";
        if (card.placeT > 0) return "재배치 대기 중";
        if (this.deployed >= this.deployLimit && !this.stage.sandbox) return "배치 가능 인원 부족";
        if (this.cost < this.costOf(card)) return "코스트 부족";
        return null;
      }
      if (card.deployed) return "이미 배치됨";
      if (card.cooldown > 0) return "재배치 대기 중";
      if (this.deployed >= this.deployLimit && !this.stage.sandbox) return "배치 가능 인원 부족";
      if (this.cost < this.costOf(card)) return "코스트 부족";
      return null;
    }
    deploy(cardIdx, x, y, dir) {
      const card = this.cards[cardIdx];
      if (this.deployCheck(card) || !this.canDeployAt(card, x, y)) return false;
      if (this.onlyDir !== undefined && dir !== this.onlyDir) return false;
      const d = card.def;
      const paid = this.costOf(card);
      this.cost -= paid;
      if (card.summonOf !== undefined) {   // her drawing: drawn where you put it, a line from her hand
        card.charges--;
        card.placeT = d.redeploy;   // the next drawing needs a moment
        const o = card.owner, SM = o.def.summon || {}, oe = card.ownerElite || 0;
        const sHp = SM.hpE ? SM.hpE[Math.min(oe, SM.hpE.length - 1)] : d.hp, sAtk = SM.atkE ? SM.atkE[Math.min(oe, SM.atkE.length - 1)] : d.atk;   // the drawing follows her promotion
        const s = { id: this.uid++, card: cardIdx, def: d, skill: d.skills[0], x, y, dir, hp: sHp, maxHp: sHp, mult: { atk: sAtk / d.atk }, sp: 0, skillT: 0, stored: 0,
          atkT: d.interval * 0.5, blocked: [], buff: {}, flash: 0, swing: 0, born: this.t, summoned: true, owner: o, seq: (this.deploySeq = (this.deploySeq || 0) + 1) };
        this.units.push(s);
        this.fx.push({ k: "draw", x, y, ox: o.x, oy: o.y, t: 0, life: 0.7 });
        return s;
      }
      card.deployed = true;
      for (const q of this.enemies) if (q.waiting && !q.ally && Math.max(Math.abs(Math.round(q.x) - x), Math.abs(Math.round(q.y) - y)) <= 1) this.wake(q);   // setting someone down beside it stirs it (those tied up on our side are loosed only by the light)
      const sk = skillAt(d.skills[card.skillIdx] || d.skills[0], card.slv, maxMastery(d) && card.sm ? card.sm[card.skillIdx] || 0 : 0);
      const pt = card.pot || {};
      const mh = Math.round(d.hp * mOf(card.mult, "hp") * (pt.hp || 1));
      const u = { id: this.uid++, card: cardIdx, def: d, skill: sk, x, y, dir, hp: mh, maxHp: mh, mult: card.mult || 1, hpMul: pt.hp || 1, potAtk: pt.atk || 1, potDef: pt.def || 1, potRes: pt.res || 0, paid, sp: sk.init, skillT: 0, stored: 0,
        atkT: d.interval * 0.4, blocked: [], buff: {}, flash: 0, swing: 0, born: this.t, seq: (this.deploySeq = (this.deploySeq || 0) + 1) };   // seq: deploy order, for who draws the ranged fire
      if (d.summon) {   // her summon card joins the deck while she is out
        let sc = this.cards.find((c) => c.summonOf === cardIdx);
        if (!sc) { sc = { def: SUMMONS[d.summon.id], summonOf: cardIdx, cooldown: 0, deployed: false, level: 0, skillIdx: 0, elite: 0 }; this.cards.push(sc); }
        const oe = Math.max(0, Math.min(2, card.elite || 0)), SM = d.summon;   // @@@: more drawings once promoted (2/3/3), and they are drawn as strong as she is
        Object.assign(sc, { active: true, owner: u, ownerElite: oe, charges: SM.maxE ? SM.maxE[Math.min(oe, SM.maxE.length - 1)] : SM.max, chargeT: [], cooldown: 0, placeT: 0 });
      }
      if (d.cls === "선봉" && this.cards.some((c) => c.def.vanSp)) u.sp = Math.min(sk.sp, u.sp + Math.max(...this.cards.map((c) => c.def.vanSp || 0)));   // 뭇별의 선봉: the vanguards come in charged
      this.units.push(u);
      this.fx.push({ k: "deploy", x, y, t: 0, life: 0.5 });
      return u;
    }
    summonCard(owner) { return this.cards.find((c) => c.owner === owner && c.active); }
    retreat(u, refund = true) {
      const i = this.units.indexOf(u);
      if (i < 0) return; this.snd(refund ? "retreat" : "down");
      this.units.splice(i, 1);
      for (const e of this.enemies) if (e.blockedBy === u) e.blockedBy = null;
      if (u.clone) { this.fx.push({ k: "egpoof", x: u.x, y: u.y, t: 0, life: 0.7 }); return; }   // one of the many of him: gone in a puff
      if (u.summoned) {   // the drawing tears; its owner may draw it again later
        const sc = this.cards[u.card];
        if (sc && sc.active && this.units.includes(u.owner)) sc.chargeT.push(u.owner.def.summon.back);
        this.fx.push({ k: "tear", x: u.x, y: u.y, t: 0, life: 0.7 });
        return;
      }
      for (const s of this.units.filter((q) => q.owner === u)) this.retreat(s, false);   // her drawings go with her
      for (const c of this.cards) if (c.owner === u) { c.active = false; c.owner = null; }
      const card = this.cards[u.card];
      card.deployed = false;
      card.cooldown = Math.max(1, u.def.redeploy - (card.pot ? card.pot.redeploy : 0));
      const first = Math.max(1, u.def.cost + eliteCost(u.def, card.elite) - (card.pot ? card.pot.cost : 0));
      card.level++;
      if (refund) this.cost = Math.min(CFG.maxCost, this.cost + (u.def.fullRefund ? first : Math.floor((u.paid || first) * CFG.retreatRefund)));   // a killbang gets back what its first deployment cost
      if (refund && this.march && this.march.phase === "move") card.cooldown = Math.min(card.cooldown, 5);   // pulled back in good order while the line moves: ready again by the next part
      this.fx.push({ k: refund ? "retreat" : "down", el: card.elite, x: u.x, y: u.y, id: u.def.id, dir: u.dir, t: 0, life: 0.6 });
    }
    // standing on a ground tile right now (she steps down during her second skill)
    onGround(u) { return u.ground !== undefined ? u.ground : u.def.tile === "g"; }
    rangeTiles(u, dir = u.dir) { const c = this.cards[u.card]; return RANGE[u.rangeKey || rangeKeyOf(u.def, c ? c.elite : 0)].map((o) => { const [dx, dy] = rotate(o, dir); return [u.x + dx, u.y + dy]; }); }
    inRange(u, e, tiles = this.rangeTiles(u)) {
      if (e.isEnemy && e.downUntil > this.t) return false;   // lying where it fell: there is nothing to strike yet
      if (e.mask && !e.judged) return false;   // lab L3 (LAB-04): a masked figure not judged for killing is never struck
      if (e.ghost && !u.isEnemy) return false;   // lab L5: a ghost is not ours to heal or help
      if (!u.isEnemy && this.smoke.size && this.smokeAt(u.x, u.y) && Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) > 1.5) return false;   // in the smoke: no further than the next square
      if (e.stealth && e.blockedBy !== u) return false;   // 은신: only the one holding it back can find it
      if (e.dim && !u.isEnemy && (u.def.tile !== "g" || Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) > 1.5)) return false;   // held or met in the dark: only those on the ground right beside it can make it out; nobody up on a rise sees into the dark
      // a foe has a little body, not a point: it counts on every tile its body overlaps, so one standing on a tile edge
      // (as a blocked foe does, held at the edge of its blocker's tile) can be reached from either side of that edge
      const R = 0.2, xs = [Math.round(e.x - R), Math.round(e.x + R)], ys = [Math.round(e.y - R), Math.round(e.y + R)];
      if (tiles.some(([x, y]) => (x === xs[0] || x === xs[1]) && (y === ys[0] || y === ys[1]))) return true;
      if (this.beat && e.blockedBy === u && tiles.some(([x, y]) => x === u.x && y === u.y)) return true;   // lab L2: held from the next square (foes stand square-centred on the beat), it is within its blocker's own reach
      const b = e.blockedBy; return !!(b && !b.isEnemy && b !== u && tiles.some(([x, y]) => x === b.x && y === b.y));   // and a held foe is on its blocker's tile too
    }
    stat(u, k) {
      let v = u.def[k];
      if ((k === "atk" || k === "def") && u.mult) v *= mOf(u.mult, k);   // growth from the lobby
      if (k === "res" && u.potRes) v += u.potRes;
      if ((k === "atk" || k === "def") && u.imgPct) v *= u.imgPct;   // lab L3: an image in the glass has its share of the operator's attack and defence
      if (k === "atk" && u.potAtk) v *= u.potAtk; else if (k === "def" && u.potDef) v *= u.potDef;   // potential
      if (k === "def" && u.defMul0) v *= u.defMul0;   // an early stage's thinner armour
      if ((k === "atk" || k === "def") && u.def.grow && !u.isEnemy) v *= 1 + u.def.grow.step * this.growth(u);   // Lulu: heavier the longer he stands
      const b = u.buff;
      if (k === "atk" && b.atkMul) v *= b.atkMul;
      if (k === "def" && b.defMul) v *= b.defMul;
      if (k === "def" && u.cheerT > 0) v *= u.cheerDef;
      if (k === "def" && u.def.lowDef && !u.isEnemy && u.hp <= u.maxHp * 0.5) v *= 1 + u.def.lowDef;   // 꺾이지 않는 의지   // 응원하마
      if (k === "interval" && b.speed) v /= b.speed;
      if (k === "interval" && b.ivMul) v *= b.ivMul;   // 그대가 뭇별에 닿기를: three blows, a slower beat
      if (k === "interval" && !u.isEnemy && this.calls && this.calls.until > this.t && (u.x === this.calls.at[0] || u.y === this.calls.at[1])) v *= this.calls.slow;   // the call: in line with the one called, hands falter
      if (k === "interval" && !u.isEnemy && u.frostN > 0) v *= FROST.slow;
      if (k === "interval" && !u.isEnemy && this.beat) v *= this.beatLen(this.beatZone(u.x)) / this.beat.base;   // lab L2: a slow zone slows us too   // 동상: stiff fingers
      if (k === "def" && !u.isEnemy && tileAt(u.x, u.y) === "=") v *= 1 - THIN_ICE;   // thin ice under the feet
      if (k === "atk" && u.def.pair && !u.isEnemy && this.units.some((q) => q.def.id === u.def.pair)) v *= 1.1;   // 운명의 서약
      if (k === "block" && b.blockAdd) v += b.blockAdd;
      if (k === "block" && u.def.blockE && this.cards && this.cards[u.card]) for (const e in u.def.blockE) if (this.cards[u.card].elite >= +e) v = Math.max(v, u.def.blockE[e]);   // 공격수: a third at the final promotion
      // Belina: her presence steadies everyone; her roar lifts them
      if ((k === "atk" || k === "def") && !u.isEnemy && u.def.cls === "선봉") {
        for (const q of this.units) if (q.def.id === "belina") {
          if (k === "def") v *= 1.08;
          if (q.skill.id === "b_roar" && q.skillT > 0) v *= q.skill.atk;
        }
      }
      return v;
    }
    // status effects on operators go through here: Lulu's talent halves them, his S2 shrugs them off entirely
    afflict(u, key, dur) { if (u.buff && u.buff.immune && u.skillT > 0) return 0; if (u.def.id === "lulu") dur *= 0.5; u[key] = Math.max(u[key] || 0, dur); return dur; }
    growth(u) { const g = u.def.grow; return g ? Math.min(g.max, Math.floor(Math.max(0, this.t - u.born) / g.every)) : 0; }
    damage(target, raw, type, fromUnit, fromEnemy) {
      if (this._beatAmpU && fromUnit === this._beatAmpU) raw *= 1.3;   // lab L2: an instant skill started on the downbeat
      if (target.isEnemy && (target.crownUntil > this.t || target.downUntil > this.t)) return 0;
      if (target.mask && !target.judged) return 0;   // lab L3 (LAB-04): nor harmed by a blast   // a boss between his two stages, or an armour still lying where it fell: nothing harms them
      if (fromEnemy && !target.isEnemy && target.markT > this.t) raw *= target.markAmp || 1;   // pointed out by an informer
      if (fromEnemy && fromEnemy.def.vsFrozen && !target.isEnemy && target.frozenT > 0) raw *= fromEnemy.def.vsFrozen;   // fangs into the frozen
      if (fromEnemy && fromEnemy.def.frost && !target.isEnemy && raw > 0) this.frostHit(target, fromEnemy.def.frost);
      if (target.isEnemy && target.waiting && !target.ally) this.wake(target);   // (those tied up on our side are loosed by the light, not by a blow)
      let dmg;
      if (type === "true") dmg = raw;
      else if (type === "arts") dmg = raw * (1 - Math.max(0, (target.res !== undefined ? target.res : (target.def.res || 0)) - (target.erodeT > 0 ? ERODE.resDown : 0)) / 100);   // 침식 eats into magic resistance
      else {
        let def = target.isEnemy ? target.defv : this.stat(target, "def");
        if (target.isEnemy && target.def.iceArmor && this.wind && this.wind.blowing) def *= target.def.iceArmor;
        if (target.isEnemy && target.def.falter && target.def.falter.bare && target.falterT > this.t) def = 0;   // while he falters his guard is down   // the ice on the shield thickens in the white-out
        if (fromUnit && fromUnit.def.pierce && target.isEnemy) def *= 1 - fromUnit.def.pierce;   // 대물 저격탄: armor is no excuse
        if (target.isEnemy && target.blockedBy && target.blockedBy.egSee) def *= 0.7;   // 절대적 직관: the weak point, seen at once
        dmg = Math.max(raw - def, raw * 0.05);
      }
      if (!target.isEnemy && type === "arts") dmg = raw * (1 - this.stat(target, "res") / 100);
      if (type === "true") dmg = raw;
      if (!target.isEnemy && target.def.paper && fromEnemy && fromEnemy.type === "heavy") { dmg *= 1.5; this.fx.push({ k: "burn", x: target.x, y: target.y, t: 0, life: 0.1 }); }   // paper burns
      if (!target.isEnemy && fromEnemy) this.snd("hurt");
      if (!target.isEnemy) dmg = this.shield(target, dmg);
      if (target.hired) dmg *= target.hired.taken !== undefined ? target.hired.taken : 0.6;   // a paid man fights for his life
      if (!target.isEnemy && target.dmgCutT > this.t) dmg *= 0.5;   // 광속일섬: still as stone while he gathers himself
      if (!target.isEnemy && target.def.dodge && fromEnemy && Math.random() < target.def.dodge) {   // 정신권: he simply isn't where the blow lands
        this.fx.push({ k: "tododge", x: target.x, y: target.y, t: 0, life: 0.6 }); return 0;
      }
      if (!target.isEnemy && target.skill && target.skill.id === "rb_self" && target.skillT > 0 && fromEnemy && fromEnemy.blockedBy === target && !fromEnemy.dead && Math.random() < target.skill.neg) {   // 호오 이젠 정당방위랍니다~?: the blow lands in twisted time, and she answers it
        this.fx.push({ k: "rbwarp", x: target.x, y: target.y, t: 0, life: 0.5 });
        if (!(target.counterCD > this.t)) {
          target.counterCD = this.t + 0.65; target.counterT = this.t; target.atkT = Math.max(target.atkT, 0.5); target.wind = null;
          fromEnemy.lastHitBy = target; this.damage(fromEnemy, this.stat(target, "atk") * target.skill.ctr, target.def.dmg, target); this.addHoly(fromEnemy, this.stat(target, "atk") * target.skill.holy);
          this.fx.push({ k: "rbcounter", x: fromEnemy.x, y: fromEnemy.y, ux: target.x, uy: target.y, uid: target.id, t: 0, life: 0.6 });
        }
        return 0;
      }
      if (!target.isEnemy && target.def.parry && fromEnemy && fromEnemy.blockedBy === target && !fromEnemy.dead && Math.random() < target.def.parry) {   // +PARRY
        fromEnemy.lastHitBy = target; this.damage(fromEnemy, this.stat(target, "atk") * 1.5, "phys", target);
        target.parryT = this.t; this.fx.push({ k: "a2parry", x: target.x, y: target.y, ex: fromEnemy.x, ey: fromEnemy.y, uid: target.id, t: 0, life: 0.7 }); return 0;
      }

      if (!target.isEnemy && target.def.id === "alpha") {   // 「장난은 여기까지.」: once per deployment he refuses to go down
        if (target.gritT > 0) dmg = 0;
        else if (!target.gritUsed && target.hp - dmg < 1) { dmg = Math.max(0, target.hp - 1); target.gritUsed = true; target.gritT = 1.5; this.fx.push({ k: "agrit", x: target.x, y: target.y, t: 0, life: 1.6 }); }
      }
      if (!target.isEnemy && fromEnemy && !fromEnemy.dead && dmg > 0) for (const q of this.units) if (q.skill.id === "sq_screen" && q.skillT > 0 && this.inRange(q, target, this.rangeTiles(q))) {   // 연막: the smoke round whoever was hit eats into the one who hit them
        this.addErode(fromEnemy, dmg * q.skill.erode); this.fx.push({ k: "sqreflect", x: fromEnemy.x, y: fromEnemy.y, ux: target.x, uy: target.y, t: 0, life: 0.6 }); break;
      }
      if (!target.isEnemy && target.def.thorns && fromEnemy && !fromEnemy.dead && dmg > 0) {   // 서사 왜곡: whatever hits him while the story still holds goes back where it came from
        const sk2 = target.skill && target.skill.id === "eg_under" && target.skillT > 0;
        if (target.ward > 0 || sk2) { target.stopT = this.t; fromEnemy.lastHitBy = target; fromEnemy.bonkT = this.t; this.damage(fromEnemy, this.stat(target, "atk") * target.def.thorns * (sk2 ? target.skill.thorns : 1), "arts", target);
          this.fx.push({ k: "egthorn", x: fromEnemy.x, y: fromEnemy.y, ux: target.x, uy: target.y, big: sk2, t: 0, life: 0.5 }); }
      }
      if (!target.isEnemy && target.ward > 0 && dmg > 0) { const a = Math.min(target.ward, dmg); target.ward -= a; dmg -= a; if (target.ward <= 0) { target.ward = 0; this.fx.push({ k: "egwardbreak", x: target.x, y: target.y, t: 0, life: 0.6 }); } }   // 보호막 takes it first
      target.hp -= dmg;
      if (!target.isEnemy) this.onHurt(target, dmg);
      if (target.isEnemy && fromUnit && !fromUnit.isEnemy && type !== "true" && dmg > 0) {   // 뭇별의 선봉: her blows and those of the four beside her carry starlight
        const src = this.units.find((q) => q.def.holyAura && (q === fromUnit || Math.abs(q.x - fromUnit.x) + Math.abs(q.y - fromUnit.y) === 1));
        if (src) this.addHoly(target, dmg * src.def.holyAura);
      }
      if (target.isEnemy && target.holyT > 0 && fromUnit && !fromUnit.isEnemy && type !== "true") {   // 성흔: every blow an operator lands burns a little more
        target.hp -= this.stat(fromUnit, "atk") * HOLY.onHit; this.fx.push({ k: "num", x: target.x, y: target.y, v: Math.round(this.stat(fromUnit, "atk") * HOLY.onHit), holy: true, t: 0, life: 0.8 });
      }
      if (target.isEnemy && dmg > 0) {
        if (target.nyalaT > 0 && !target.hypnoDone && this.t >= (target.nyalaFrom || 0)) {   // 나이알라: struck while bound, the vine sprays its sleeping sap
          target.hypnoDone = true; target.weakT = Math.max(target.weakT || 0, 3); target.weakAmt = Math.max(target.weakAmt || 0, target.nyalaWeak);
          this.fx.push({ k: "slhypno", x: target.x, y: target.y, t: 0, life: 0.9 });
        }
      }
      if (!target.isEnemy && target.def.counter && fromEnemy && fromEnemy.blockedBy === target && !fromEnemy.dead && target.hp > 0 && Math.random() < target.def.counter) {   // 정당방위
        fromEnemy.lastHitBy = target; this.damage(fromEnemy, this.stat(target, "atk"), "arts", target);
        this.fx.push({ k: "rbcounter", x: fromEnemy.x, y: fromEnemy.y, ux: target.x, uy: target.y, t: 0, life: 0.6 });
      }
      target.flash = 0.12;
      this.fx.push({ k: "num", x: target.x, y: target.y, v: Math.round(dmg), arts: type === "arts", holy: type === "true", foe: !target.isEnemy, t: 0, life: 0.8 });
      return dmg;
    }
    // 신성 손상: builds on a foe; at full it bursts into 성흔, and nothing more builds until that has run out
    addHoly(e, amt) {
      if (e.dead || e.hired || e.holyT > 0) return;
      e.holy = (e.holy || 0) + amt; e.holyShow = this.t;
      if (e.holy >= HOLY.max * (e.def.boss ? 2 : 1)) { e.holy = 0; e.holyT = HOLY.dur; e.holyAcc = 0; this.holyBurstT = this.t; this.fx.push({ k: "rbholy", x: e.x, y: e.y, e, t: 0, life: 1.2 }); }
    }
    // 침식 손상: builds on a foe; at full it bursts — a heavy blow of magic — and leaves its resistance eaten away for a while
    addErode(e, amt) {
      if (e.dead || e.hired || e.erodeT > 0 || !(amt > 0)) return;
      e.erode = (e.erode || 0) + amt; e.erodeShow = this.t;
      if (e.erode >= ERODE.max * (e.def.boss ? 2 : 1)) { e.erode = 0; e.erodeT = ERODE.dur; this.fx.push({ k: "erburst", x: e.x, y: e.y, e, t: 0, life: 1.0 }); this.damage(e, ERODE.burst, "arts", null); }
    }
    // a lord's cut at range carries less: the blade at hand is the whole of it
    near1(u, e) { return e.blockedBy === u || (!e.def.flying && Math.hypot(e.x - u.x, e.y - u.y) <= 1.15); }
    // the newer operators strike through here
    hitX(u, e) {
      const d = u.def, sk = u.skill, on = u.skillT > 0, A = this.stat(u, "atk"), tiles = this.rangeTiles(u);
      const inR = () => this.enemies.filter((q) => !q.dead && !q.hired && this.inRange(u, q, tiles));
      if (sk.spType === "atk" && u.skillT <= 0 && !u.cutNext && !u.drawNext && !u.oneNext) u.sp = Math.min(sk.sp, u.sp + 1);
      if (d.id === "falchion") {
        const flip = sk.id === "fc_flip" && on;   // 음양 반전: every attack is black then white
        const black = flip ? !u.hitN : (u.yy = !u.yy), both = !!u.cutNext, big = !!u.cutNext; u.cutNext = false;
        const dealt = this.damage(e, A * (big ? sk.mul : 1), "phys", u);
        if (black || both) this.addErode(e, dealt * (flip ? sk.erode : 0.4));
        if (!black || both) u.hp = Math.min(u.maxHp, u.hp + dealt * (flip ? sk.cure : 0.2));
        this.fx.push({ k: "fchit", x: e.x, y: e.y, ux: u.x, uy: u.y, black, both, big, flip, uid: u.id, t: 0, life: 0.5 });
        return;
      }
      if (d.id === "veil") {
        const echo = sk.id === "vl_echo" && on, draw = !!u.drawNext; u.drawNext = false;
        let tg = [e];
        if (draw) tg = inR(); else if (echo) { const o = inR().filter((q) => q !== e).sort((a, b) => a.remain - b.remain)[0]; if (o) tg.push(o); }
        if (!tg.includes(e)) tg.unshift(e);
        for (const q of tg) this.veilCut(u, q, A * (draw ? sk.mul : 1), echo);
        this.fx.push({ k: "vlcut", x: e.x, y: e.y, ux: u.x, uy: u.y, far: !this.near1(u, e), draw, tg: tg.map((q) => [q.x, q.y]), uid: u.id, t: 0, life: 0.5 });
        return;
      }
      if (d.id === "geomseon") {
        const one = !!u.oneNext; u.oneNext = false;
        const far = !this.near1(u, e);
        e.lastHitBy = u; this.damage(e, A * (one ? sk.mul : 1) * (far && !one ? d.lord : 1) * (e.def.flying ? 1.5 : 1), "phys", u);   // 어검술: the flying swords are surest against what flies
        const o = null;
        this.fx.push({ k: "gshit", x: e.x, y: e.y, ux: u.x, uy: u.y, far, one, o: o ? [o.x, o.y] : null, uid: u.id, t: 0, life: 0.5 });
      }
    }
    veilCut(u, q, amt, full) {
      q.lastHitBy = u;
      const m = (this.near1(u, q) || full ? 1 : u.def.lord) * (q.holyT > 0 ? 1.3 : 1);
      const dealt = this.damage(q, amt * m, "phys", u);
      this.addHoly(q, dealt * 0.15);
      return dealt;
    }
    // 운명의 수순: the pieces in her reach trade squares so the weakest stands at the front (bosses do not play along)
    rearrange(u, tiles) {
      const pool = this.enemies.filter((e) => !e.dead && !e.hired && !e.def.boss && !e.def.flying && !e.shove && this.inRange(u, e, tiles));
      if (pool.length < 2) return;
      const slots = pool.map((e) => ({ x: e.x, y: e.y, path: e.path, seg: e.seg, segT: e.segT, remain: e.remain, blockedBy: e.blockedBy, heldBy: e.heldBy })).sort((a, b) => a.remain - b.remain);
      const order = pool.slice().sort((a, b) => a.hp - b.hp), moves = [];
      order.forEach((e, i) => {
        const sl = slots[i]; if (Math.abs(sl.x - e.x) + Math.abs(sl.y - e.y) > 0.01) moves.push({ x0: e.x, y0: e.y, x1: sl.x, y1: sl.y });
        Object.assign(e, sl); e.prevX = e.x; e.swapT = this.t;
        e.stunT = Math.max(e.stunT || 0, u.skill.stun); e.lastHitBy = u; this.damage(e, this.stat(u, "atk") * u.skill.mul, "arts", u);
      });
      this.fx.push({ k: "k2swap", moves, x: u.x, y: u.y, uid: u.id, t: 0, life: 1.0 });
    }
    // a skill that can be stopped by pressing it again
    cancelSkill(u) { if (!(u.skillT > 0) || !u.skill.cancel) return false; u.skillT = 0; this.endSkill(u); u.buff = {}; u.field = null; return true; }
    // 재능: the first is open from the start, the second only after the second promotion
    talentOn(u, i) { const T = u.def.talents; if (!T) return i === 0; const t = T[i]; if (!t) return false; const c = this.cards && this.cards[u.card]; return (c ? c.elite : 2) >= (t.elite || 0); }
    // 졸음: asleep where it stands — the same as a stun, it only looks different
    sleep(e, dur, u) { if (e.dead || e.hired) return; if (e.def.boss) dur *= 0.4; e.stunT = Math.max(e.stunT || 0, dur); e.sleepT = Math.max(e.sleepT || 0, dur); e.sleepBy = u; this.fx.push({ k: "sqsleep", x: e.x, y: e.y, e, t: 0, life: 0.8 }); }
    // Smoqueen's smoke: magic damage, erosion, and every third puff puts the target to sleep
    hitSQ(u, e, extra) {
      const A = this.stat(u, "atk");
      if (u.skill.id === "sq_star" && u.skillT > 0) {   // 죽음의 성좌: the rune rains clinkers on each mark, one after another, and every one that lands burns in its own share
        const sl = u.sqN % (u.def.sleepEvery || 3) === 0, R = SQ_RAIN;
        for (let i = 0; i < R.n; i++) {
          const land = this.t + R.first + i * R.gap + Math.random() * 0.03;
          this.fx.push({ k: "sqclink", e, uid: u.id, land, i, sleep: sl && i === 0, x1: e.x, y1: e.y, t: 0, life: 0.6 });
          this.later.push({ at: land, f: () => {
            if (e.dead || e.hired || !this.units.includes(u)) return;   // it lands on empty ground
            e.lastHitBy = u; const dealt = this.damage(e, A * u.skill.per, "arts", u);
            this.addErode(e, dealt * 0.4 * (this.talentOn(u, 1) && e.sleepT > 0 ? 2 : 1));
            if (sl && i === 0) this.sleep(e, u.def.sleepDur || 2, u);
          } });
        }
        return;
      }
      const dealt = this.damage(e, A, "arts", u);
      this.addErode(e, dealt * 0.4 * (this.talentOn(u, 1) && e.sleepT > 0 ? 2 : 1));
      const sl = u.sqN % (u.def.sleepEvery || 3) === 0;   // every n-th puff (the talent's rhythm) puts the target to sleep
      if (sl) this.sleep(e, u.def.sleepDur || 2, u);
      this.fx.push({ k: "sqpuff", x0: u.x, y0: u.y, x1: e.x, y1: e.y, uid: u.id, e, extra: !!extra, sleep: sl, t: 0, life: 0.5 });
    }
    // a cure from Angelina: what spills over the top becomes a ward (방호학파), up to a share of the target's HP
    healAN(u, a, amt) {
      if (a.def.noHeal) return;
      if (this.anHolyOn()) amt *= 1.35;   // 세계수의 숨결: a foe burst into 성흔 not long ago — the holy in the air answers her
      const over = Math.max(0, a.hp + amt - a.maxHp); a.hp = Math.min(a.maxHp, a.hp + amt);
      const save = u.skill.id === "an_save" && u.skillT > 0, cap = save ? u.skill.ward : this.talentOn(u, 1) ? 0.2 : 0;
      if (over > 0 && cap > 0) { const top = (a.hpTop || a.maxHp) * cap; if ((a.ward || 0) < top) { a.ward = Math.min(top, (a.ward || 0) + over); a.anWardT = this.t; } }
    }
    // 구원: the sphere of light thrusts every foe in her reach outward
    anPush(u) { const tl = this.rangeTiles(u); for (const e of this.enemies) if (!e.dead && !e.hired && this.inRange(u, e, tl)) { const dx = e.x - u.x, dy = e.y - u.y; this.shove(e, Math.abs(dx) + Math.abs(dy) < 0.05 ? 1 : dx, dy, u.skill.force); } this.fx.push({ k: "anpush", x: u.x, y: u.y, uid: u.id, t: 0, life: 0.8 }); }
    anHolyOn() { return this.holyBurstT !== undefined && this.t - this.holyBurstT < 8; }
    // 속박: bound by vines where it stands — a stun that looks like one
    bindVine(e, dur, u) { if (e.dead || e.hired || e.def.flying) return; e.stunT = Math.max(e.stunT || 0, e.def.boss ? dur * 0.5 : dur); e.vineT = this.t; e.vineDur = e.def.boss ? dur * 0.5 : dur; }
    // 보호막: a layer that soaks damage before HP does (it does not stack past his top HP)
    addWard(u, f) { const top = u.hpTop || u.maxHp; u.ward = Math.min(top, (u.ward || 0) + top * f); this.fx.push({ k: "egward", x: u.x, y: u.y, t: 0, life: 0.7 }); }
    // 나는 군단이다: up to two more of him turn up on the free ground beside him
    legion(u) {
      const d = u.def, m = 0.6, spots = [];
      const F = [[1, 0], [0, 1], [-1, 0], [0, -1]][u.dir] || [1, 0], cand = [];   // the free ground within two squares, nearest and most in front first
      for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
        const x = u.x + dx, y = u.y + dy; if ((!dx && !dy) || tileAt(x, y) !== "." || this.unitAt(x, y)) continue;
        cand.push([x, y, Math.max(Math.abs(dx), Math.abs(dy)) * 2 + Math.abs(dx) + Math.abs(dy) - (dx * F[0] + dy * F[1]) * 0.6]);
      }
      cand.sort((a, b) => a[2] - b[2]); for (const c of cand.slice(0, 4)) spots.push([c[0], c[1]]);
      const cd = Object.assign({}, d, { hp: Math.round(d.hp * m), atk: Math.round(d.atk * m), def: Math.round(d.def * m), deployAnim: 0.6, clone: true,
        skills: [{ id: "eg_none", name: "분신", desc: "", sp: 999, init: 0, mode: "passive", dur: 0 }] });
      for (const [x, y] of spots) {
        const hp = Math.round(cd.hp * mOf(u.mult, "hp"));
        this.units.push({ id: this.uid++, card: u.card, def: cd, skill: cd.skills[0], x, y, dir: u.dir, hp, maxHp: hp, mult: u.mult || 1, sp: 0, skillT: 0, stored: 0,
          atkT: cd.interval * 0.5, blocked: [], buff: {}, flash: 0, swing: 0, born: this.t, summoned: true, clone: true, owner: u, expire: this.t + u.skill.dur });
        this.fx.push({ k: "egclone", x, y, ox: u.x, oy: u.y, t: 0, life: 0.8 });
      }
      this.fx.push({ k: "eglegion", x: u.x, y: u.y, uid: u.id, n: spots.length, t: 0, life: 1.0 });
    }
    // damage taken by an operator after the new operator's talent and 2nd skill
    shield(t, dmg) {
      if (t.buff && t.buff.dmgTaken) dmg *= t.buff.dmgTaken;
      // 순애 수호: the knight beside you takes part of the blow
      if (t.def && !t.def.guard) {
        const kn = this.units.find((q) => q !== t && q.def.guard && Math.abs(q.x - t.x) + Math.abs(q.y - t.y) === 1 && q.hp > 0);
        if (kn) {
          const part = dmg * (kn.skill.id === "sn_smite" && kn.skillT > 0 ? 0.4 : kn.def.guard);
          kn.hp -= part; kn.flash = 0.12; this.onHurt(kn, part); dmg -= part;
          this.fx.push({ k: "snguard", x0: t.x, y0: t.y, x1: kn.x, y1: kn.y, kid: kn.id, t: 0, life: 0.5 });
        }
      }
      for (const g of this.units) if (g !== t && g.def.id === "yui" && near(g, t)) { dmg *= 0.9; break; }
      if (t.skill.id === "e_pray" && t.skillT > 0) return dmg * t.skill.taken;
      const g = this.units.find((g) => g !== t && g.skill.id === "e_pray" && g.skillT > 0 && near(g, t));
      if (g) {
        const share = dmg * 0.5;
        const taken = share * g.skill.taken;            // her own cut applies to what she takes over
        g.hp -= taken; g.flash = 0.12;
        this.onHurt(g, taken);
        this.fx.push({ k: "aura", x0: t.x, y0: t.y, x1: g.x, y1: g.y, t: 0, life: 0.7 });
        this.fx.push({ k: "num", x: g.x, y: g.y, v: Math.round(taken), foe: true, t: 0, life: 0.8 });
        return dmg - share;
      }
      return dmg;
    }
    onHurt(u, dmg) {
      if (u.skill.id === "e_judge" && u.skillT > 0) u.stored += dmg;
      if (u.skill.spType === "hit" && u.skillT <= 0) u.sp = Math.min(u.skill.sp, u.sp + 1);
    }
    // tiles a skill reaches (for the red skill-range display)
    skillRangeTiles(u) {
      const id = u.skill.id;
      if (id === "e_judge") return this.judgeArea(u);
      if (id === "k_mate") return this.mateArea(u);
      if (id === "eg_gate") { const r = []; for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) r.push([u.x + dx, u.y + dy]); return r; }
      if (id === "e_mercy" || id === "e_pray") { const r = []; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) r.push([u.x + dx, u.y + dy]); return r; }
      if (u.def.id === "vanguard") return [[u.x, u.y]];
      const SK = { sl_astra: "slastra", k2_fate: "front3", sq_star: "sqstar", an_save: "ansave" }[id];   // skills that reach a different area than the operator's own range
      if (SK) return RANGE[SK].map((o) => { const [dx, dy] = rotate(o, u.dir); return [u.x + dx, u.y + dy]; });
      return this.rangeTiles(u);
    }
    // 시공간 체크메이트 lands: two files' worth of pieces are swept back
    mateGo(u) {
      const area = this.mateArea(u);
      for (const e of this.enemies) {
        if (e.dead || e.hired || e.def.flying) continue;
        if (!area.some(([x, y]) => x === Math.round(e.x) && y === Math.round(e.y))) continue;
        this.damage(e, this.stat(u, "atk") * u.skill.mul, "phys", u);
        this.skPush(u, e, u.skill.force);
      }
      this.fx.push({ k: "skmate", x: u.x, y: u.y, dir: u.dir, area, uid: u.id, t: 0, life: 1.0 });
    }
    // 시공간 체크메이트 reaches the two tiles straight ahead of her
    mateArea(u) { const [fx, fy] = rotate([1, 0], u.dir); return [[u.x + fx, u.y + fy], [u.x + fx * 2, u.y + fy * 2]]; }
    // a shove: the foe slides off in a direction for a distance set by force against its mass,
    // stops at walls, then finds its own way to the base from wherever it ended up
    shove(e, dx, dy, force, wallStun) {
      if (e.dead || e.hp <= 0 || e.def.flying || e.hired || e.hold) return 0;
      const L = Math.hypot(dx, dy); if (L < 1e-6) return 0; dx /= L; dy /= L;
      const d = force - (e.def.mass !== undefined ? e.def.mass : 2);
      const dist = (d >= 4 ? 2.5 : d <= -3 ? 0.1 : [0.15, 0.3, 0.6, 1.0, 1.5, 2.0][d + 2]) * (0.85 + 0.1 * force);
      e.blockedBy = null; e.heldBy = null;
      e.shove = { x0: e.x, y0: e.y, dx, dy, dist, done: 0, t: 0, dur: 0.16 + 0.12 * dist, wallStun };
      this.fx.push({ k: "shove", x: e.x, y: e.y, dx, dy, dist, e, t: 0, life: 0.5 });
      return dist;
    }
    stepShove(e, dt) {
      const sh = e.shove; sh.t += dt;
      const q = Math.min(1, sh.t / sh.dur), want = sh.dist * (1 - (1 - q) * (1 - q));
      let wall = false;
      while (sh.done < want - 1e-6) {
        const nd = Math.min(want, sh.done + 0.05), nx = sh.x0 + sh.dx * nd, ny = sh.y0 + sh.dy * nd;
        if (!walkable(tileAt(Math.round(nx), Math.round(ny)))) { wall = true; break; }
        sh.done = nd;
      }
      e.x = sh.x0 + sh.dx * sh.done; e.y = sh.y0 + sh.dy * sh.done;
      if (q >= 1 || wall) {
        e.shove = null;
        if (wall) this.fx.push({ k: "shovewall", x: e.x, y: e.y, dx: sh.dx, dy: sh.dy, t: 0, life: 0.4 });
        if (wall && sh.wallStun) { e.stunT = Math.max(e.stunT || 0, e.def.boss ? sh.wallStun * 0.5 : sh.wallStun); this.fx.push({ k: "a2wall", x: e.x, y: e.y, dx: sh.dx, dy: sh.dy, t: 0, life: 0.6 }); }
        this.repath(e);
      }
    }
    // a new road to the base from where the foe stands now
    repath(e) {
      const T = [Math.round(e.x), Math.round(e.y)];
      const p = (walkable(tileAt(T[0], T[1])) ? bfsPath(T, BASE) : null) || [];   // no way to the point at all (a lab board): the same as standing off the road
      e.path = p.length > 1 && p[0][0] === T[0] && p[0][1] === T[1] ? [[e.x, e.y]].concat(p.slice(1)) : [[e.x, e.y], T, BASE.slice()].filter((v, i, a) => i === 0 || v[0] !== a[i - 1][0] || v[1] !== a[i - 1][1]);
      e.seg = 0; e.segT = 0; this.advance(e, 0);
    }
    skPush(u, e, force) { const [fx, fy] = rotate([1, 0], u.dir); return this.shove(e, fx, fy, force); }
    judgeArea(u) {
      const r = [];
      for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) if (Math.abs(dx) + Math.abs(dy) <= 2) r.push([u.x + dx, u.y + dy]);
      return r;
    }
    // swap two units' tiles; whoever was blocked by one is now held by the other (as far as it can hold)
    swapPlaces(a, b) {
      const ax = a.x, ay = a.y;
      a.x = b.x; a.y = b.y; b.x = ax; b.y = ay;
      for (const e of this.enemies) if (e.blockedBy === a || e.blockedBy === b) {
        const h = this.unitAt(Math.round(e.x), Math.round(e.y));
        e.blockedBy = (h === a || h === b) && this.onGround(h) ? h : null;
      }
      for (const e of this.enemies) if (e.blockedBy && this.blockLoad(e.blockedBy) > this.stat(e.blockedBy, "block")) e.blockedBy = null;
      a.swapT = this.t; b.swapT = this.t; a.wind = null; b.wind = null;
      this.fx.push({ k: "swap", x0: ax, y0: ay, x1: a.x, y1: a.y, t: 0, life: 0.6 });
    }
    endSkill(u) {
      if (u.skill.id === "sq_star") {   // 죽음의 성좌 ends: every sleeper in her reach takes the dream's bill, and wakes
        const tiles = this.rangeTiles(u), A = this.stat(u, "atk") / ((u.buff && u.buff.atkMul) || 1);
        for (const e of this.enemies) if (!e.dead && e.sleepT > 0 && this.inRange(u, e, tiles)) { e.sleepT = 0; e.stunT = 0; e.lastHitBy = u; this.damage(e, A * u.skill.wake, "arts", u); this.fx.push({ k: "sqwake", x: e.x, y: e.y, t: 0, life: 0.8 }); }
        this.fx.push({ k: "sqend", x: u.x, y: u.y, uid: u.id, t: 0, life: 1.0 }); u.rangeKey = undefined;
      }
      if (u.skill.id === "sl_astra" || u.skill.id === "an_save") u.rangeKey = undefined;
      if (u.skill.maze) { u.hikiT = u.skill.maze.hiki; u.hikiStart = this.t; u.wind = null; }   // the show is over: under the duvet she goes
      if (u.skill.id === "a_scout") { u.stack = 0; u.lastTgt = null; }
      if (u.skill.id === "d_swap" && u.home) {
        const doll = this.unitAt(u.home.x, u.home.y);
        u.ground = undefined; u.rangeKey = undefined;
        if (doll && doll.owner === u) this.swapPlaces(u, doll);
        else { for (const e of this.enemies) if (e.blockedBy === u) e.blockedBy = null; const x0 = u.x, y0 = u.y; u.x = u.home.x; u.y = u.home.y; u.swapT = this.t; this.fx.push({ k: "swap", x0, y0, x1: u.x, y1: u.y, t: 0, life: 0.6 }); }
        const hpF = u.hp / u.maxHp; u.maxHp = Math.round(u.def.hp * mOf(u.mult, "hp") * (u.hpMul || 1)); u.hp = Math.max(1, u.maxHp * hpF);
        u.home = null;
      }
      if (u.skill.id === "e_judge") {
        const area = this.judgeArea(u), v = Math.round(u.stored * u.skill.mul), hits = [];
        for (const e of this.enemies) {
          if (!area.some(([x, y]) => x === Math.round(e.x) && y === Math.round(e.y))) continue;
          hits.push({ x: e.x, y: e.y, fly: !!e.def.flying, e });
          e.hp -= v; e.flash = 0.2;
          this.fx.push({ k: "num", x: e.x, y: e.y, v, true: true, t: 0, life: 1.1 });
          if (!e.def.flying) { this.shove(e, e.x - u.x || rotate([1, 0], u.dir)[0], e.y - u.y || rotate([1, 0], u.dir)[1], u.skill.force); e.stunT = Math.max(e.stunT, u.skill.stun); }
        }
        this.fx.push({ k: "shock", x: u.x, y: u.y, v, hits, area, t: 0, life: 1.0 });
        u.stored = 0;
      }
    }
    // can a foot soldier's way from its gate be built now? (a gate that is still shut has none). Flyers, posts, landings and drops do not ask
    routeReady(type, s, o) { const d = ENEMIES[type]; if (!d || d.flying || (o && (o.at || o.land || o.drops))) return true;
      if (o && o.aim !== undefined && this.stage.leap) return true;
      if (this.relay) return d.collector ? this.relay.state === "ground" || this.relay.state === "held" : true;   // lab L4: no road to a point here; a collector comes only while the paper is out   // lab L1: an aimed foe on a board where foes leap comes in even with no road to the point (it finds its own way)
      const p = o && o.via ? viaPath(s, o.via) : this.stage.vias && this.stage.vias[s] ? viaPath(s, this.stage.vias[s]) : PATHS[s]; return !!(p && p.length); }
    spawn(type, s, o) {
      const d = ENEMIES[type];
      let path = o && o.at ? atPath(o.at, o.via) : o && o.land ? [SPAWNS[s].slice(), o.land.slice()] : o && o.drops ? [SPAWNS[s].slice(), ...o.drops.map((q) => q[0].slice()), BASE.slice()] : d.flying ? (o && o.air ? airPath(s, o.air) : AIR_PATHS[s]) : o && o.via ? viaPath(s, o.via) : this.stage.vias && this.stage.vias[s] ? viaPath(s, this.stage.vias[s]) : PATHS[s];   // a stage may send a gate's foot soldiers by its own way
      if (!path) path = AIR_PATHS[s];   // a foot soldier sent through a gate only drones use: let it float in rather than break
      this.enemies.push({ id: this.uid++, isEnemy: true, type, def: d, path, seg: 0, segT: 0, x: path[0][0], y: path[0][1],
        hp: d.hp, maxHp: d.hp, defv: d.def, res: d.res, blockedBy: null, atkT: d.interval * 0.5,
        slowT: 0, slowAmt: 0, stunT: 0, flash: 0, remain: segLen(path) });
      const e = this.enemies[this.enemies.length - 1];
      const rm = d.rscale ? this.stage.rmul || { hp: 1, atk: 1 } : null; if (rm) { e.hp = e.maxHp = Math.round(e.hp * rm.hp); e.atkMul = rm.atk; }   // the ranged rank and file: their own scale, which an early stage may ease
      const mul = this.stage.mul; if (mul && !d.noMul && !d.rscale) { e.hp = e.maxHp = Math.round(e.hp * (mul.hp || 1)); e.atkMul = mul.atk || 1; if (mul.def) e.defMul0 = mul.def; }   // early stages field weaker men
      if (o && o.land) { e.land = o.land; e.drop = o.drop || "soldier"; }
      if (o && o.at) e.postUntil = o.until || 1e9;   // a garrison: it holds its square (and fights from it) until then
      if (o && o.drops) { e.drops = o.drops.map(([at, type, n]) => ({ at, type, n: n || 1 })); e.dropI = 0; e.hoverT = 0; e.cargo = e.drops.reduce((a, q) => a + q.n, 0); }
      if (o && o.escort && this.escort) { const at = [this.escort.x, this.escort.y], pts = [SPAWNS[s], ...(o.via || []).map((q) => [q[0], q[1]]), at]; let pp = [];   // this one is after the one we keep, not the point
        for (let i = 0; i < pts.length - 1; i++) { const seg = bfsPath(pts[i], pts[i + 1]); if (!seg) { pp = null; break; } pp = pp.concat(i ? seg.slice(1) : seg); }
        if (pp) { e.path = pp; e.remain = segLen(pp); e.toEscort = true; } }
      if (e.def.unsmoke) e.unsmoke = e.def.unsmoke;
      if (o && o.pre) { this.advance(e, o.pre.adv); e.hold = true; e.holdUntil = o.pre.until; }   // already out on the square when the operation opens: they stand there until the column comes   // a drone carrying a man: it sets him down and is gone
      if (d.charge) e.chargeCD = d.charge.every * 0.6;
      if (d.perch) {   // he starts up on the rise and later walks down onto the nearest road
        const [px, py] = (o && o.perch) || d.perch.at; let best = null;
        PATHS.forEach((pp) => pp.forEach((q, j) => { const dd = Math.hypot(q[0] - px, q[1] - py) + segLen(pp.slice(j)); if (!best || dd < best.d) best = { d: dd, pp, j }; }));   // the shortest way from the rise to the base
        e.path = [[px, py], ...best.pp.slice(best.j)]; e.x = px; e.y = py; e.remain = segLen(e.path);
        e.perched = true; e.perchUntil = this.t + (o && o.perch ? 1e9 : d.perch.until);
        if (o && o.perch) { e.perchFire = true; e.path = [[px, py], [px, py]]; e.remain = 99; }   // the lighthouse: he never comes down, and shoots from up there
      }
      if (d.stealth && !(o && o.seen)) { e.stealth = true; e.mins = 0; }
      else if (d.boss && o && o.seen) this.bossRevealT = this.t;   // in plain sight from the start: the warning comes at once
      if (d.ambush && !(o && o.seen)) e.stealth = true;   // down in the hedge until he fires
      if (o && o.ally) { e.hired = { t: 1e9, by: null }; e.ally = true; }   // on our side for the whole operation: it holds its ground and fights what comes
      if (o && o.wait) { e.hold = true; e.waiting = true; e.postUntil = 0; if (typeof o.wait === "number") e.holdUntil = o.wait; }   // standing about on the board until someone comes near, hits it, or its time comes
      if (o && o.ally && o.wait && this.stage.lamps) { const r = this.stage.lamps.r || 1, ex = Math.round(e.x), ey = Math.round(e.y); let lit = false;   // tied up on our side but already in reach of a lit lamp: loose at once
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (this.lampLit(ex + dx, ey + dy)) lit = true;
        if (lit) this.wake(e); }
      e.born = this.t;
      if (o && o.at && o.fallen && d.revive) {   // already down on its square, as if it had just fallen in the dark with a rising left: it gets up after o.fallen seconds and that rising is spent
        e.rose = (e.rose || 0) + 1; e.hp = e.downHp = Math.round(e.maxHp * d.revive.pct); e.downUntil = this.t + o.fallen; e.stunT = Math.max(e.stunT || 0, o.fallen);
        this.fx.push({ k: "rise", e, x: e.x, y: e.y, t: 0, life: o.fallen }); }
      if (o && o.scanEvery) { e.scanEvery = o.scanEvery; e.nextScan = this.t + o.scanEvery * 0.6; }
      if (o && o.scanNear) e.scanNear = true;
      if (o && o.leak) e.leakTo = o.leak;   // lab: reaching a point adds to a gauge instead of costing life
      if (o && o.aim !== undefined && !d.flying) { e.aim = d.sweeper && this.chimneys.length ? "chimney" : o.aim; this.replan(e); }
      if (d.baton && this.beat && !d.flying) { e.aim = "metro"; this.replan(e); }   // lab L2: the baton makes for a metronome
      if (d.collector && this.relay) { e.aim = "item"; this.replan(e); }   // lab L4: the collector makes for the paper
      if (d.masked && this.stage.masks) { e.mask = (o && o.mask) || "guest"; e.leakTo = { meter: e.mask === "assassin" ? "knife" : "in", by: 1 }; }   // lab L3 (LAB-04): through the door, a guest counts in, an assassin counts a knife
      if (this.mirror) { e.room = SPAWNS[s] && SPAWNS[s][0] > this.mirror.x ? "R" : "L"; if (e.room === "R" && e.aim === undefined && this.mirror.sq.some((q) => q.broken)) this.toRealPoint(e); }   // lab L3   // lab: it makes for the walking ally, for one of ours, or for a square   // BL-07's lighthouse: the three nearest him, not the three furthest along
      if (o && o.atk) e.atkMul = (e.atkMul || 1) * o.atk;
      if (o && o.hp) e.hp = e.maxHp = Math.round(e.maxHp * o.hp);   // this entry's own HP scale on top of the stage's (a picket stronger than the line; an ally kept as it was)
      if (d.sniper) { e.shots = 0; e.scanned = 0; e.scanQ = 0; e.atkT = d.interval; }
      if (!d.boss) for (const q of this.enemies) if (q.stealth && q.def.stealth && !q.dead && q !== e && ++q.mins >= q.def.stealth.reveal) this.reveal(q);
      return e;
    }
    reveal(e) {
      if (!e.stealth) return;
      e.stealth = false; e.revealT = this.t; this.bossRevealT = this.t;
      this.fx.push({ k: "neyreveal", e, x: e.x, y: e.y, t: 0, life: 1.2 });
    }
    // the marshal's turn: returns true when it has used the whole step (perched, sweeping, or taking aim)
    neyStep(e, dt) {
      const d = e.def, S = d.scan;
      if (e.hp <= 0) return true;   // already falling: whatever he owed dies with him (the men he called still come)
      for (let i = 0; i < S.at.length; i++) if (!(e.scanned & (1 << i)) && e.hp <= e.maxHp * S.at[i]) {   // cut down a third: a sweep is owed, and a wave comes on
        e.scanned |= 1 << i; e.scanQ++;
        this.extra = (this.extra || []).concat(NEY_CALL[i].map(([dt2, ty, sp]) => [this.t + 1.5 + dt2, ty, sp])).sort((a, b) => a[0] - b[0]);
        this.total += NEY_CALL[i].length;
      }
      if (e.scanEvery && this.t >= e.nextScan) { e.scanQ++; e.nextScan = this.t + e.scanEvery; }   // the lighthouse: a sweep every so often
      if (e.scanEvery && (e.spent || 0) >= NEY_ROUNDS) e.scanQ = 0;   // the lighthouse's magic rounds are six: once they are spent, no more sweeps
      if (!e.scan && e.scanQ > 0) {
        e.scanQ--; e.scan = { t: 0, marks: null, fired: 0 }; e.aim = null;
        this.fx.push({ k: "neyscan", e, x: e.x, y: e.y, t: 0, life: S.sweep });
      }
      if (e.scan) {   // the sweep runs left to right across the whole field; nothing interrupts it
        const sc = e.scan; sc.t += dt;
        if (!sc.marks && sc.t >= S.sweep) {
          sc.marks = this.units.filter((u) => !u.def.unseen).sort(e.scanNear ? (a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y) || a.y - b.y : (a, b) => a.x - b.x || a.y - b.y).slice(0, e.scanEvery ? Math.max(0, Math.min(3, NEY_ROUNDS - (e.spent || 0))) : 3).map((u) => ({ u, x: u.x, y: u.y }));
          sc.marks.forEach((m, i) => this.fx.push({ k: "neymark", e, u: m.u, x: m.x, y: m.y, t: 0, life: S.mark + i * S.gap + 0.1 }));
        }
        if (sc.marks) while (sc.fired < sc.marks.length && sc.t >= S.sweep + S.mark + sc.fired * S.gap) {
          const m = sc.marks[sc.fired++]; this.neyFire(e, m.u, "x", m.x, m.y);
        }
        if (sc.marks && sc.fired >= sc.marks.length && sc.t >= S.sweep + S.mark + sc.marks.length * S.gap + 0.4) { e.scan = null; e.atkT = d.interval * 0.6; }
        return true;
      }
      if (e.perched && !e.perchFire) {   // up on the rise, waiting; then he climbs down
        if (this.t < e.perchUntil) return true;
        e.perched = false; this.fx.push({ k: "neydown", e, x: e.x, y: e.y, t: 0, life: 0.8 });
      }
      if (e.stunT > 0) return false;
      if (e.aim) {   // the heavy round: he stops, takes his time, and the line of sight shows
        e.aim.t += dt;
        if (!this.units.includes(e.aim.u)) e.aim = null;
        else if (e.aim.t >= d.sniper.aim) { this.neyFire(e, e.aim.u, "s"); e.aim = null; e.atkT = d.interval; }
        return true;
      }
      e.atkT -= dt;
      if (e.atkT <= 0) {
        const pool = this.units.filter((u) => !u.def.unseen);
        const tgt = e.blockedBy && this.units.includes(e.blockedBy) ? e.blockedBy
          : pool.sort((a, b) => (b.seq || 0) - (a.seq || 0))[0];   // as any marksman: the one put down last draws his fire (a summon too)
        if (!tgt) { e.atkT = 0.3; return !!e.perchFire; }
        e.shots++;
        if (e.shots % d.sniper.every === 0) { e.aim = { u: tgt, t: 0 }; this.fx.push({ k: "neyaim", e, u: tgt, t: 0, life: d.sniper.aim }); return true; }
        this.neyFire(e, tgt, "n"); e.atkT = d.interval;
      }
      return !!e.perchFire;   // on the lighthouse he never walks
    }
    neyFire(e, u, kind, mx, my) {
      e.face = (u ? u.x : mx) >= e.x ? 1 : -1; e.fireT = this.t; e.fireKind = kind;
      const here = u && this.units.includes(u);
      const x1 = here ? u.x : mx, y1 = here ? u.y : my;
      this.fx.push({ k: "neyshot", e, kind, x0: e.x, y0: e.y, x1, y1, miss: !here, t: 0, life: kind === "n" ? 0.35 : 0.6 });
      if (!here) { if (kind === "x") e.spent = (e.spent || 0) + 1; return; }   // he stepped out of the way in time
      const rage = e.enraged ? RAGE.atk : 1;
      if (kind === "x") e.spent = (e.spent || 0) + 1;   // one of the six is gone for good
      if (kind === "x") {   // the sweep's rounds: a defender is left hanging on, anyone else is gone
        const dmg = u.def.cls === "중장" ? Math.max(0, u.hp - u.maxHp * e.def.scan.near) : u.hp + u.maxHp;
        this.damage(u, dmg, "true", null, e);
      } else this.damage(u, e.def.atk * (kind === "s" ? e.def.sniper.strong : 1) * rage * (e.weakT > 0 ? 1 - e.weakAmt : 1) * (e.atkMul || 1), "arts", null, e);   // blue ghost-fire: armour does not stop it, magic resistance does
    }
    // ---------- the march (BL-07) ----------
    loadPart(id) {
      const M = this.march, P = M.def.parts[id];
      if (!M.big) {   // the whole field, every part stamped at its place (what is drawn)
        let BW = 0, BH = 0; for (const q of Object.values(M.def.parts)) { BW = Math.max(BW, q.at[0] + q.map[0].length); BH = Math.max(BH, q.at[1] + q.map.length); }
        const g = Array.from({ length: BH }, () => Array(BW).fill("#"));
        for (const q of Object.values(M.def.parts)) q.map.forEach((row, y) => [...row].forEach((c, x) => { g[q.at[1] + y][q.at[0] + x] = c; }));
        M.big = g.map((r) => r.join("")); M.bigW = BW; M.bigH = BH;
      }
      M.id = id; M.part = P; M.n++; M.route.push(id); M.t0 = this.t; M.phase = "fight"; M.choose = null; M.moveAt = P.hold ? this.t + P.hold : null;
      M.rect = [P.at[0], P.at[1], P.map[0].length, P.map.length];
      // the field the game plays on: only this part is open, everything else is out of bounds
      const lg = Array.from({ length: M.bigH }, () => Array(M.bigW).fill("#"));
      P.map.forEach((row, y) => [...row].forEach((c, x) => { lg[P.at[1] + y][P.at[0] + x] = c; }));
      const logic = lg.map((r) => r.join(""));
      this.stage.map = logic; this.stage.bg = P.bg || "-"; this.stage.cam = P.cam; this.stage.hz = P.hz;   // no painting yet: the plain board
      setMap(logic);
      if (this.waves.length > this.waveIdx) this.total -= this.waves.length - this.waveIdx;   // what never came of the last part's waves
      const off = (o) => o && o.perch ? Object.assign({}, o, { perch: [o.perch[0] + P.at[0], o.perch[1] + P.at[1]] }) : o;
      this.waves = W1(P.waves.map((w) => [w[0] + this.t, w[1], w[2], w[3], w[4], off(w[5])].filter((v, i) => i < 4 || v !== undefined))); this.waveIdx = 0; this.total += this.waves.length;
      this.bar = P.barrage ? { next: this.t + P.barrage.first, cur: null } : null;
      // the horde from the part before comes on behind, a few at a time
      const carry = M.carry || []; M.carry = null;
      if (carry.length && P.rear.length) {
        this.extra = (this.extra || []).concat(carry.map((ty, k) => [this.t + 6 + k * 0.9, ty, P.rear[k % P.rear.length]])).sort((a, b) => a[0] - b[0]);
      } else this.total -= carry.length;   // the last part: what followed them falls away
    }
    marchStep() {
      const M = this.march, P = M.part;
      if (M.phase === "fight" && M.moveAt !== null && this.t >= M.moveAt) { M.phase = "move"; M.moveEnd = this.t + M.def.window; this.fx.push({ k: "mmove", t: 0, life: 2.2 }); }
      if (M.phase === "move" && this.t >= M.moveEnd) {
        for (const u of this.units.slice()) if (!u.summoned && !u.clone && this.units.includes(u)) this.retreat(u, false);   // still out: pulled out, nothing back
        for (const u of this.units.slice()) this.retreat(u, false);
        M.carry = this.enemies.filter((e) => !e.dead && !e.def.boss && !e.hired).map((e) => e.type);
        this.enemies = []; this.extra = [];
        M.phase = "choose";
        if (P.next.length === 1) this.loadPart(P.next[0]); else M.choose = P.next.slice();
      }
    }
    marchGo(id) { const M = this.march; if (!M || !M.choose || !M.choose.includes(id)) return; this.loadPart(id); }
    // Ney's barrage: a sweep over the whole field, then three rounds around the biggest foe on the ground
    barrageStep(dt) {
      const B = this.bar, P = this.march.part.barrage;
      if (!B.cur) {
        if (this.t < B.next || this.march.phase !== "fight") return;
        B.cur = { t: 0, tgt: null, fired: 0 }; this.fx.push({ k: "nbscan", t: 0, life: BARRAGE.sweep });
      }
      const c = B.cur; c.t += dt;
      if (!c.tgts && c.t >= BARRAGE.sweep) {
        const foes = this.enemies.filter((e) => !e.dead && e.hp > 0 && !e.def.flying && !e.hired).sort((a, b) => b.hp - a.hp).slice(0, BARRAGE.n);
        const ops = foes.length < BARRAGE.n ? this.units.filter((u) => !u.def.unseen).sort((a, b) => b.hp - a.hp).slice(0, BARRAGE.n - foes.length) : [];
        c.tgts = foes.concat(ops).map((q, i) => ({ q, x: q.x, y: q.y }));
        if (!c.tgts.length) { B.cur = null; B.next = this.t + P.every; return; }
        c.tgts.forEach((m, i) => this.fx.push({ k: "nbmark", e: m.q, op: !m.q.isEnemy, x: m.x, y: m.y, t: 0, life: BARRAGE.mark + BARRAGE.gap * i + 0.15 }));
      }
      if (c.tgts) {
        for (const m of c.tgts) if (!m.q.dead && (this.enemies.includes(m.q) || this.units.includes(m.q))) { m.x = m.q.x; m.y = m.q.y; }   // each round follows its mark while it lives
        while (c.fired < c.tgts.length && c.t >= BARRAGE.sweep + BARRAGE.mark + c.fired * BARRAGE.gap) {
          const m = c.tgts[c.fired++], x = m.x, y = m.y;
          this.fx.push({ k: "nbshell", x, y, t: 0, life: 0.7 });
          for (const e of this.enemies) if (!e.dead && !e.def.flying && Math.hypot(e.x - x, e.y - y) <= BARRAGE.r) { this.damage(e, BARRAGE.dmg, "true", null); e.flash = 0.2; }
          for (const u of this.units) if (Math.hypot(u.x - x, u.y - y) <= BARRAGE.r) { this.damage(u, BARRAGE.dmg, "true", null); u.flash = 0.2; }
        }
        if (c.fired >= c.tgts.length) { B.cur = null; B.next = this.t + P.every; }
      }
    }
    // the firebottle: it arcs over, bursts on the square (and the ones beside it), and whoever it finds frozen melts out of the ice in a rush of steam that scalds them again and again
    throwBottle(e, tg) {
      const x = tg.x, y = tg.y, D = e.def, fly = 0.45, atk = D.atk * (e.atkMul || 1);
      this.fx.push({ k: "lob", x0: e.x, y0: e.y, x1: x, y1: y, t: 0, life: fly }); this.snd("throw");
      this.later.push({ at: this.t + fly, f: () => {
        this.fx.push({ k: "boom", x, y, r: D.splash, t: 0, life: 0.6 }); this.snd("boom");
        for (const u of this.units.slice()) {
          if (Math.hypot(u.x - x, u.y - y) > D.splash + 0.01) continue;
          const frozen = u.frozenT > 0;
          this.damage(u, atk, "arts", null, e); u.flash = 0.2;
          if (!frozen || !this.units.includes(u)) continue;
          u.blizFrozen = false; u.frozenT = 0; u.frostN = 0; u.frostImm = this.t + FROST.imm;   // the ice goes all at once
          this.fx.push({ k: "melt", x: u.x, y: u.y, t: 0, life: D.melt.n * D.melt.gap + 0.6 });
          for (let i = 0; i < D.melt.n; i++) this.later.push({ at: this.t + i * D.melt.gap, f: () => { if (!this.units.includes(u)) return; this.damage(u, u.maxHp * D.melt.pct, "true", null, null); u.flash = 0.15; } });
        }
      } });
    }
    // the original's rule: of those in range, the one deployed last draws the fire (the unseen only when nothing else is there)
    rangedTarget(e) {
      let best = null, bd = 1e9;
      for (const u of this.units) { if (this.smoke.size && this.smokeAt(u.x, u.y)) continue;   /* hidden in the smoke */ const d = Math.hypot(u.x - e.x, u.y - e.y), key = (u.def.unseen ? 1e6 : 0) - (u.seq || 0) * 100 + d - ((e.def.vsFrozen || e.def.melt) && u.frozenT > 0 ? 1e5 : 0) - (u.markT > this.t ? 2e5 : 0); if (d <= e.def.ranged && key < bd) { bd = key; best = u; } }   // those who feed on the frozen look for them first
      return best;
    }
    advance(e, dist) {
      // move along the path; returns true when the base is reached
      while (dist > 0 && e.seg < e.path.length - 1) {
        const a = e.path[e.seg], b = e.path[e.seg + 1];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const left = (1 - e.segT) * L;
        if (dist < left) { e.segT += dist / L; dist = 0; }
        else { dist -= left; e.seg++; e.segT = 0; }
      }
      if (dist < 0) {   // pushed backwards
        let back = -dist;
        while (back > 0 && (e.seg > 0 || e.segT > 0)) {
          const a = e.path[e.seg], b = e.path[Math.min(e.seg + 1, e.path.length - 1)];
          const L = Math.max(1e-6, Math.hypot(b[0] - a[0], b[1] - a[1]));
          const done = e.segT * L;
          if (back < done) { e.segT -= back / L; back = 0; }
          else { back -= done; if (e.seg > 0) { e.seg--; e.segT = 1; } else { e.segT = 0; break; } }
        }
      }
      const a = e.path[e.seg], b = e.path[Math.min(e.seg + 1, e.path.length - 1)];
      e.x = a[0] + (b[0] - a[0]) * e.segT; e.y = a[1] + (b[1] - a[1]) * e.segT;
      let rem = (1 - e.segT) * Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let i = e.seg + 1; i < e.path.length - 1; i++) rem += Math.hypot(e.path[i + 1][0] - e.path[i][0], e.path[i + 1][1] - e.path[i][1]);
      e.remain = rem;
      return e.seg >= e.path.length - 1;
    }
    snd(k) { if (this.sfx.length < 24) this.sfx.push(k); }   // a sound for the page to play
    hit(u, e) {
      e.lastHitBy = u; u.lastTarget = e; u.lastHitT = this.t; this.snd("atk:" + u.def.id);
      if (u.def.dblFx && u.hitN === 1) { this.fx.push({ k: "a2hit", x: e.x, y: e.y, ux: u.x, uy: u.y, n: 1, uid: u.id, t: 0, life: 0.35 }); return; }   // the second of the two blows is only seen: the pair deals its damage once
      let mul = u.def.double && u.def.dblMul !== undefined ? u.def.dblMul : 1;   // a two-blow fighter: each blow carries its share of ATK
      if (u.def.xhit) return this.hitX(u, e);
      if (u.def.id === "smoqueen") return this.hitSQ(u, e);
      if (u.skill.id === "sl_astra" && u.skillT > 0) {   // 아스트라: a line from the foe nearest the defence point to the farthest, and tentacles slam down along it one after another
        const tiles = this.rangeTiles(u), foes = this.enemies.filter((q) => !q.dead && !q.hired && this.inRange(u, q, tiles)).sort((a, b) => a.remain - b.remain);
        const a = foes[0] || e, b = foes[foes.length - 1] || e, L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.round(L / 0.55) + 1);
        const vol = { hit: new Set() };
        for (let i = 0; i < n; i++) {
          const q = n === 1 ? 0 : i / (n - 1);
          this.shots.push({ u, e: { dead: true }, slam: true, vol, x1: a.x + (b.x - a.x) * q, y1: a.y + (b.y - a.y) * q, t: 0, dur: 0.3 + i * 0.06 + 0.22, amt: this.stat(u, "atk") * u.skill.mul, stun: u.skill.stun });
        }
        this.fx.push({ k: "slline", x0: a.x, y0: a.y, x1: b.x, y1: b.y, n, uid: u.id, t: 0, life: 0.3 + n * 0.06 + 1.0 });
        return;
      }
      if (u.def.lob) {   // a yuzu is lobbed: it lands, and hurts, only when it comes down
        const big = !!u.basketNext; u.basketNext = false;
        const sh = { u, e, lob: true, big, amt: this.stat(u, "atk") * (big ? u.skill.mul : 1), r: big ? 1.6 : u.def.lob.r, t: 0, dur: u.def.lob.flight + (big ? 0.15 : 0), x1: e.x, y1: e.y };
        this.shots.push(sh); this.fx.push({ k: "cblob", x0: u.x, y0: u.y, sh, uid: u.id, big, t: 0, life: sh.dur + 0.05 });
        if (u.skill.spType === "atk" && u.skillT <= 0) u.sp = Math.min(u.skill.sp, u.sp + 1);
        return;
      }
      if (u.def.id === "irins") {
        if (u.trapNext) {   // 어서 오게, 손님~!: the floor opens under the guest
          u.trapNext = false; mul = u.skill.mul;
          const d = e.def.boss ? u.skill.bind * 0.5 : u.skill.bind; e.stunT = Math.max(e.stunT, d); e.trapT = d;
          this.fx.push({ k: "itrap", x: e.x, y: e.y, e, t: 0, life: d + 0.4 });
        }
        this.fx.push({ k: "ibolt", x0: u.x, y0: u.y, x1: e.x, y1: e.y, uid: u.id, big: mul > 1, t: 0, life: 0.3 });
        if (u.fam > 0) {   // the familiars that gathered while she waited all fly at once
          const pool = this.enemies.filter((q) => !q.dead && !q.hired && q !== e && this.inRange(u, q));
          for (let i = 0; i < u.fam; i++) {
            const tg = i === 0 || !pool.length ? e : pool[(i - 1) % pool.length];
            this.shots.push({ u, e: tg, amt: this.stat(u, "atk") * u.def.fam.mul, t: 0, dur: 0.32 + i * 0.08, idx: i, n: u.fam, uid: u.id, x1: tg.x, y1: tg.y });
          }
          u.fam = 0; u.famT = 0;
        }
      }
      if (u.strikeR6) { u.strikeR6 = false; mul = u.skill.mul; }
      if (u.twinR6 && u._hits === 2) { mul = u.skill.mul; if (u.hitN === 1) u.twinR6 = false; }
      if (u.starNext) {   // 뭇별님 또 한 놈 갑니다~: the time-quickened flying kick to the chin, and off the foe goes like a star
        u.starNext = false; mul = u.skill.mul; u.hitN = 2; u.skipSecond = true;
        let dx = e.x - u.x, dy = e.y - u.y; if (Math.hypot(dx, dy) < 0.2) { const p = e.path && e.path[e.seg]; dx = p ? e.x - p[0] : rotate([1, 0], u.dir)[0]; dy = p ? e.y - p[1] : rotate([1, 0], u.dir)[1]; }
        u.launchAt = this.t; if (!e.def.boss) this.pulls.push({ e, dx, dy, at: this.t + 0.06, force: (e.def.mass >= 3 ? Math.min(4, u.skill.force) : u.skill.force), stun: (e.def.mass >= 3 ? Math.min(0.5, u.skill.stun) : u.skill.stun), launch: true });   // heavies (mass ≥3) never fly further than the lv1 kick, so M3 cannot lock them   // a boss takes the kick but does not fly
        this.fx.push({ k: "rbstar", x: e.x, y: e.y, ux: u.x, uy: u.y, t: 0, life: 0.9 });
      }
      if (u.braveNext) { u.braveNext = false; mul = u.skill.mul; this.fx.push({ k: "hrbrave", x: e.x, y: e.y, ux: u.x, uy: u.y, t: 0, life: 0.6 }); }
      if (u.rookNext) {   // 전략적 기물 배치: a rook drops out of the sky onto the square
        u.rookNext = false; u.rookAt = this.t; mul = u.skill.mul; e.stunT = Math.max(e.stunT || 0, u.skill.stun);
        this.fx.push({ k: "k2rook", x: e.x, y: e.y, t: 0, life: 0.9 });
      }
      if (u.def.splashArts) {   // 어머니의 별빛 유산
        for (const q of this.enemies) if (q !== e && !q.dead && !q.hired && Math.max(Math.abs(q.x - e.x), Math.abs(q.y - e.y)) <= 1.2) { q.lastHitBy = u; this.damage(q, this.stat(u, "atk") * u.def.splashArts, "arts", u); }
      }
      if (u.stealNext) {   // 이 무기는 이제 제 겁니다.: and he walks off with it
        u.stealNext = false; mul = 2; e.weakT = Math.max(e.weakT || 0, 8); e.weakAmt = Math.max(e.weakAmt || 0, 0.4);
        this.fx.push({ k: "a2steal", x: e.x, y: e.y, ux: u.x, uy: u.y, t: 0, life: 1.0 });
      }
      let comboI = -1;
      if (u.comboN > 0) {   // 진짜 졸라짱짱쎈 콤보: starter, second, finisher — each harder than the last
        comboI = 3 - u.comboN; u.comboN--; mul = [u.skill.m1, u.skill.m2, u.skill.m3][comboI]; u.swingVar = [0, 2, 5][comboI];
        if (comboI === 2) { const d = e.def.boss ? u.skill.stop * 0.5 : u.skill.stop; e.stunT = Math.max(e.stunT || 0, d); }   // the finisher stops the target's time
        this.fx.push({ k: "bocombo", x: e.x, y: e.y, ux: u.x, uy: u.y, uid: u.id, i: comboI, t: 0, life: 1.0 });
      } else u.swingVar = undefined;
      if (u.def.ghost) {   // 과거의 잔영: every shot, past moments of him appear and fire too; keep firing and more of them join
        const G = u.def.ghost;
        if (this.t - (u.lastShotT === undefined ? -9 : u.lastShotT) > 1.5) u.streak = 0;
        u.streak = (u.streak || 0) + 1; u.lastShotT = this.t; u.swingN = (u.swingN || 0) + 1;
        const n = comboI === 1 ? G.max : Math.min(G.max, 1 + Math.floor((u.streak - 1) / G.every));   // the second blow: every ghost fires at once
        const pool = this.enemies.filter((q) => !q.dead && !q.hired && this.inRange(u, q));
        const tg = [];
        for (let i = 0; i < n; i++) {
          const q = i % 2 === 1 && pool.length > 1 ? pool[(i + u.swingN) % pool.length] : e;
          q.lastHitBy = u; this.damage(q, this.stat(u, "atk") * G.per, "phys", u); tg.push([q.x, q.y]);
        }
        u.ghostRec = Math.min(G.cap, (u.ghostRec || 0) + 1);
        this.fx.push({ k: "boghost", uid: u.id, n, v: u.swingN, tg, x0: u.x, y0: u.y, volley: comboI === 1, t: 0, life: 0.5 });
      }
      if (u.def.gateBind) {   // 시공간 게이트: a gate opens under the target and a vine holds it for a moment
        const G = u.def.gateBind;
        if (!(e.gateCD > this.t)) { e.gateCD = this.t + G.cd; e.stunT = Math.max(e.stunT || 0, e.def.boss ? G.dur * 0.5 : G.dur); this.fx.push({ k: "slgate", x: e.x, y: e.y, t: 0, life: 0.8 }); }
      }
      if (u.nyalaNext) {   // 텐타클 - 나이알라: vines burst up around the target and bind everyone there
        u.nyalaNext = false; mul = u.skill.mul;
        for (const q of this.enemies) if (!q.dead && !q.hired && !q.def.flying && Math.max(Math.abs(q.x - e.x), Math.abs(q.y - e.y)) <= 1.2) {
          q.stunT = Math.max(q.stunT || 0, q.def.boss ? u.skill.bind * 0.5 : u.skill.bind); q.nyalaT = 2; q.nyalaWeak = u.skill.weak; q.nyalaFrom = this.t + 0.05; q.hypnoDone = false;
          if (q !== e) { q.lastHitBy = u; this.damage(q, this.stat(u, "atk") * u.skill.mul, "arts", u); }
        }
        this.fx.push({ k: "slnyala", x: e.x, y: e.y, t: 0, life: 2.2 }); u.nyalaFx = this.t;
      }
      if (u.proofNext) {   // 고대 마법 증명: the circle opens under the foe and everyone standing in it is proven slow
        u.proofNext = false;
        for (const q of this.enemies) if (!q.dead && !q.hired && Math.max(Math.abs(q.x - e.x), Math.abs(q.y - e.y)) <= 1.2) {
          if (q !== e) { q.lastHitBy = u; this.damage(q, this.stat(u, "atk") * u.skill.mul, "arts", u); }
          q.slowAmt = Math.max(q.slowT > 0 ? q.slowAmt || 0 : 0, u.skill.slow); q.slowT = Math.max(q.slowT, u.skill.slowT); q.slowBy = u.def.id;
        }
        mul = u.skill.mul; this.fx.push({ k: "jyproof", x: e.x, y: e.y, t: 0, life: 1.0 });
      }
      if (u.def.spLuck && u.skillT <= 0 && u.sp < u.skill.sp && Math.random() < u.def.spLuck) { u.sp = Math.min(u.skill.sp, u.sp + 1); this.fx.push({ k: "jyluck", x: u.x, y: u.y, t: 0, life: 0.6 }); }   // 마력 순환
      if (u.prankNext) {   // 마왕의 장난: the spell bursts over everyone around the target
        u.prankNext = false;
        for (const q of this.enemies) if (q !== e && !q.dead && !q.hired && Math.max(Math.abs(q.x - e.x), Math.abs(q.y - e.y)) <= 1.2) { q.lastHitBy = u; this.damage(q, this.stat(u, "atk") * u.skill.mul, "arts", u); }
        mul = u.skill.mul; this.fx.push({ k: "llprank", x: e.x, y: e.y, t: 0, life: 0.8 });
      }
      let pushes = null;
      if (u.def.id === "skakea") {
        if (u.e4Next) {   // E4: the pawn's two-square opening move
          u.e4Next = false; mul = u.skill.mul; pushes = [[e, u.skill.force]];
          this.fx.push({ k: "ske4", x: e.x, y: e.y, ux: u.x, uy: u.y, dir: u.dir, uid: u.id, t: 0, life: 0.6 });
        } else this.fx.push({ k: "skhit", x: e.x, y: e.y, ux: u.x, uy: u.y, uid: u.id, t: 0, life: 0.35 });
      }
      if (u.def.id === "alpha") {
        if (u.skill.id === "a_scout" && u.skillT > 0) {   // 현장 파악: the longer he watches one target, the better he hits it
          u.stack = u.lastTgt === e ? Math.min(5, (u.stack || 0) + 1) : 0; u.lastTgt = e; mul *= 1 + u.skill.per * u.stack;
        }
        if (u.meleeNow) { mul *= 1.3; this.fx.push({ k: "amachete", x: e.x, y: e.y, ux: u.x, uy: u.y, uid: u.id, t: 0, life: 0.4 }); }
        else this.fx.push({ k: "ashot", x0: u.x, y0: u.y, x1: e.x, y1: e.y, uid: u.id, stack: u.skillT > 0 ? u.stack || 0 : -1, t: 0, life: 0.3 });
      }
      if (u.strikeNext) { mul = u.skill.mul + 0.1 * this.growth(u); u.strikeNext = false; this.fx.push({ k: "lstrike", x: e.x, y: e.y, ux: u.x, uy: u.y, t: 0, life: 0.6 });
        u.hp = Math.min(u.maxHp, u.hp + this.stat(u, "atk") * u.skill.cure); this.fx.push({ k: "heal", x: u.x, y: u.y, t: 0, life: 0.7 }); }
      else {   // an ordinary blow fills the skill (the strike itself does not count toward the next one)
        if (u.def.id === "lulu") this.fx.push({ k: "lcut", x: e.x, y: e.y, ux: u.x, uy: u.y, gold: u.skill.id === "l_ban" && u.skillT > 0, t: 0, life: 0.4 });
        if (u.skill.spType === "atk" && u.skillT <= 0) u.sp = Math.min(u.skill.sp, u.sp + 1);
      }
      if (u.skill.id === "l_ban" && u.skillT > 0) this.fx.push({ k: "lbanhit", x: e.x, y: e.y, t: 0, life: 0.4 });
      this.damage(e, this.stat(u, "atk") * mul, u.def.dmg, u);
      if (u.def.cleave) for (const q of this.enemies) if (q !== e && !q.dead && !q.hired && q.blockedBy === u) { q.lastHitBy = u; this.damage(q, this.stat(u, "atk") * mul, u.def.dmg, u); if (u.def.id === "hiro") this.fx.push({ k: "hrhit", x: q.x, y: q.y, ux: u.x, uy: u.y, uid: u.id, t: 0, life: 0.4 }); }   // 공격수: everyone it is holding takes the blow
      if (u.def.holy) this.addHoly(e, this.stat(u, "atk") * u.def.holy);   // 뭇별의 축복
      if (pushes) for (const [q, n] of pushes) this.skPush(u, q, n);
      if (u.def.slow) { e.slowAmt = Math.max(e.slowT > 0 ? e.slowAmt || 0 : 0, u.def.slow); e.slowT = Math.max(e.slowT, u.def.slowDur || 1.0); e.slowBy = u.def.id; }
      if (u.def.splash && Math.random() < u.def.splash.chance) {   // 마력을 머금은 지평선: the well of gravity swallows the foes around it too
        for (const q of this.enemies) if (q !== e && !q.dead && !q.hired && Math.max(Math.abs(q.x - e.x), Math.abs(q.y - e.y)) <= 1.2) {
          this.damage(q, this.stat(u, "atk"), u.def.dmg, u); q.slowAmt = Math.max(q.slowT > 0 ? q.slowAmt : 0, u.def.slow || 0); q.slowT = Math.max(q.slowT, u.def.slowDur || 1.0); q.slowBy = u.def.id;
        }
        this.fx.push({ k: "tkwell", x: e.x, y: e.y, t: 0, life: 0.6 });
      }
      if (u.def.id === "atat") this.fx.push({ k: "ink", x0: u.x, y0: u.y, x1: e.x, y1: e.y, melee: !!u.ground, t: 0, life: 0.3 });
      else if (u.def.id === "scribble") this.fx.push({ k: "crayon", x: e.x, y: e.y, t: 0, life: 0.35 });
      else if (u.def.id === "irins" || u.def.id === "alpha" || u.def.id === "skakea") { /* their own shots */ }
      else if (u.def.id === "eungyeol") { e.bonkT = this.t; this.fx.push({ k: "eghit", x: e.x, y: e.y, ux: u.x, uy: u.y, uid: u.id, v: u.egV || 0, t: 0, life: 0.4 }); }
      else if (u.def.id === "ker") this.fx.push({ k: "kehit", x: e.x, y: e.y, t: 0, life: 0.4 });
      else if (u.def.id === "lilith") this.fx.push({ k: "llbolt", x0: u.x, y0: u.y, x1: e.x, y1: e.y, uid: u.id, t: 0, life: 0.35 });
      else if (u.def.id === "rabi" || u.def.id === "rabi6") { if (u.hitN !== 2 || u.def.id === "rabi6") this.fx.push({ k: "rbhit", x: e.x, y: e.y, ux: u.x, uy: u.y, n: u.hitN || 0, r6: u.def.id === "rabi6", m: mul, h: u._hits || 1, star: u.skill.id === "r6_star" && u.skillT > 0, t: 0, life: 0.4 }); }
      else if (u.def.id === "skakea2") this.fx.push({ k: "k2bolt", x0: u.x, y0: u.y, x1: e.x, y1: e.y, uid: u.id, t: 0, life: 0.35 });
      else if (u.def.id === "alpha2") this.fx.push({ k: "a2hit", x: e.x, y: e.y, ux: u.x, uy: u.y, n: u.hitN || 0, uid: u.id, t: 0, life: 0.35 });
      else if (u.def.id === "bongeun") this.fx.push({ k: "boshot", x0: u.x, y0: u.y, x1: e.x, y1: e.y, uid: u.id, t: 0, life: 0.35 });
      else if (u.def.id === "silphy") { if (u.nyalaFx !== this.t) this.fx.push({ k: "slwhip", x0: u.x, y0: u.y, x1: e.x, y1: e.y, uid: u.id, t: 0, life: 0.35 }); }
      else if (u.def.id === "jayeon") this.fx.push({ k: "jybolt", x0: u.x, y0: u.y, x1: e.x, y1: e.y, uid: u.id, t: 0, life: 0.35 });
      else if (u.def.id === "brick") this.fx.push({ k: "bkslam", x: e.x, y: e.y, ux: u.x, uy: u.y, t: 0, life: 0.4 });
      else if (u.def.id === "nana") this.fx.push({ k: "nnshot", x0: u.x, y0: u.y, x1: e.x, y1: e.y, uid: u.id, t: 0, life: 0.4 });
      else if (u.def.id === "tao") this.fx.push({ k: "tohit", x: e.x, y: e.y, ux: u.x, uy: u.y, n: u.swingN || 0, t: 0, life: 0.35 });
      else if (u.def.id === "hiro") this.fx.push({ k: "hrhit", x: e.x, y: e.y, ux: u.x, uy: u.y, uid: u.id, t: 0, life: 0.4 });
      else if (u.def.id === "teka") this.fx.push({ k: "tkbolt", x0: u.x, y0: u.y, x1: e.x, y1: e.y, uid: u.id, t: 0, life: 0.3 });
      else if (u.def.id === "sunae") this.fx.push({ k: "snhit", x: e.x, y: e.y, ux: u.x, uy: u.y, uid: u.id, big: u.skill.id === "sn_smite" && u.skillT > 0, t: 0, life: 0.4 });
      else if (u.def.tile === "h") this.fx.push({ k: "bolt", x0: u.x, y0: u.y, x1: e.x, y1: e.y, arts: u.def.dmg === "arts", t: 0, life: 0.2 });
      else if (u.def.id !== "lulu") this.fx.push({ k: "slash", x: e.x, y: e.y, heavy: !!u.def.windup, bash: u.def.id === "yui", paint: u.def.id === "belina", ux: u.x, uy: u.y, dir: u.dir, face: u.face, t: 0, life: u.def.windup ? 0.45 : 0.2 });
    }
    blockLoad(u) { return this.enemies.reduce((s, e) => s + (e.blockedBy === u ? e.def.weight : 0), 0); }
    // claim (a def flag, the Emperor's): when he reaches one of ours on the ground who could hold him by block count alone but whose hands are full, that operator
    // lets go of as many of those it holds as needed (the most recently taken first, never another claimer) and takes him. Those let go walk on at once
    claimBlocker(e, u) { const B = this.stat(u, "block"), W = e.def.weight; let load = this.blockLoad(u);
      if (B < W || load + W <= B) return false;
      const held = this.enemies.filter((q) => q.blockedBy === u && !q.def.claim).sort((a, b) => (b.blockedAt || 0) - (a.blockedAt || 0)), drop = [];
      for (const q of held) { if (load + W <= B) break; drop.push(q); load -= q.def.weight; }
      if (load + W > B) return false;
      for (const q of drop) q.blockedBy = null;
      this.fx.push({ k: "claim", x: u.x, y: u.y, t: 0, life: 0.9 }); return true; }
    useSkill(u) {
      const s = u.skill;
      if (u.sp < s.sp || u.skillT > 0 || u.frozenT > 0) return false;   // nobody frozen can act
      u.sp = 0;
      u.skillT = s.dur;
      u.castT = this.t; u.castId = s.id;
      const tiles = this.rangeTiles(u);
      const foes = this.enemies.filter((e) => this.inRange(u, e, tiles) && (!e.def.flying || !this.onGround(u)) && (!e.hired || s.id === "a_hire"));
      if (s.id !== "e_mercy") this.fx.push({ k: "skill", x: u.x, y: u.y, t: 0, life: 0.9, name: s.name });
      switch (s.id || u.def.id) {
        case "e_mercy": {
          let best = u;
          for (const a of this.units) if (near(u, a) && a.hp / a.maxHp < best.hp / best.maxHp) best = a;
          best.hp = Math.min(best.maxHp, best.hp + this.stat(u, "atk") * s.cure);
          this.fx.push({ k: "mercy", x: best.x, y: best.y, ux: u.x, uy: u.y, t: 0, life: 0.9 });
          break;
        }
        case "e_pray": break;
        case "d_paint": {
          for (const s of this.units) if (s.owner === u) { s.hp = Math.min(s.maxHp, s.hp + s.maxHp * u.skill.cure); s.buff.atkMul = u.skill.atk; s.buffT = s.dur = u.skill.dur; this.fx.push({ k: "paint", x: s.x, y: s.y, t: 0, life: 0.8 }); }
          const sc = this.summonCard(u);
          if (sc && sc.chargeT.length) { sc.chargeT.sort((a, b) => a - b).shift(); sc.charges++; }   // a torn drawing comes back at once
          break;
        }
        case "d_swap": {   // trade places with one of her drawings and fight on the ground for a while
          const dolls = this.units.filter((q) => q.owner === u);
          if (!dolls.length) { u.sp = s.sp; u.skillT = 0; u.castT = undefined; this.fx.pop(); return false; }
          dolls.sort((a, b) => this.blockLoad(b) - this.blockLoad(a) || b.born - a.born);
          const d = dolls[0];
          u.home = { x: u.x, y: u.y };
          u.ground = true; u.rangeKey = "melee";
          this.swapPlaces(u, d);
          u.buff = { atkMul: s.atk, defMul: s.def, blockAdd: 2, speed: s.speed };
          const hpF = u.hp / u.maxHp; u.maxHp = Math.round(u.def.hp * mOf(u.mult, "hp") * (u.hpMul || 1)) * 2; u.hp = u.maxHp * hpF;
          break;
        }
        case "e_judge": u.stored = 0; break;
        case "vanguard": this.cost = Math.min(CFG.maxCost, this.cost + s.dp); break;
        case "b_chant": this.cost = Math.min(CFG.maxCost, this.cost + s.dp); this.fx.push({ k: "chant", x: u.x, y: u.y, t: 0, life: 1.2 }); break;
        case "l_strike": u.strikeNext = true; this.fx.pop(); break;
        case "i_welcome": u.trapNext = true; break;
        case "k_e4": u.e4Next = true; break;
        case "hr_brave": u.braveNext = true; this.fx.pop(); break;
        case "nn_focus": u.buff = { atkMul: s.atk }; break;
        case "to_breath": this.cost = Math.min(CFG.maxCost, this.cost + s.dp); u.buff = {}; this.fx.push({ k: "tobreath", x: u.x, y: u.y, t: 0, life: 1.0 }); break;
        case "ll_prank": u.prankNext = true; this.fx.pop(); break;
        case "jy_proof": u.proofNext = true; this.fx.pop(); break;
        case "pn_root": u.chordNext = true; this.fx.pop(); break;
        case "sl_nyala": u.nyalaNext = true; this.fx.pop(); break;
        case "bo_rush": u.comboN = 3; this.fx.pop(); this.fx.push({ k: "borush", x: u.x, y: u.y, uid: u.id, t: 0, life: 1.0 }); break;
        case "bo_armory": {   // 마검 '봉★평': one portal for every afterimage he has left behind, and a weapon of the past out of each
          const n = Math.min(u.def.ghost.cap, Math.max(3, u.ghostRec || 0)); u.ghostRec = 0;
          const pool = foes.length ? foes : this.enemies.filter((e) => !e.dead && !e.hired && this.inRange(u, e, tiles));
          for (let i = 0; i < n; i++) {
            const tg = pool.length ? pool[i % pool.length] : null;
            const tx = tg ? tg.x : tiles[i % tiles.length][0], ty = tg ? tg.y : tiles[i % tiles.length][1];
            const l = 0.75 + i * 0.13, fl = 1.3 + Math.random() * 0.5;   // each one leaves its portal in turn and takes its own slow way to the mark
            this.shots.push({ u, e: tg || { dead: true, x: tx, y: ty }, amt: this.stat(u, "atk") * s.mul, splash: s.splash, t: 0, l, fl, dur: l + fl, armory: true, idx: i, n, w: i % 8, path: i % 5, seed: Math.random(), x1: tx + (Math.random() - 0.5) * 0.3, y1: ty + (Math.random() - 0.5) * 0.3 });
          }
          u.armoryT = 0.75 + n * 0.13 + 1.2;   // arms spread to open the way, then hands behind his back while the past does the work
          this.fx.push({ k: "boarmory", x: u.x, y: u.y, uid: u.id, n, t: 0, life: 1.6 }); break;
        }
        case "a2_all": u.buff = { atkMul: s.atk, speed: s.speed }; this.fx.pop(); this.fx.push({ k: "a2all", x: u.x, y: u.y, uid: u.id, t: 0, life: 1.0 }); break;
        case "a2_chain": {   // 비살상 제압: a chain around each foe next to him, its other end driven into the nearest wall, and it reels them in
          this.fx.pop(); const links = [];
          for (const e of this.enemies) {
            if (e.dead || e.hired || e.def.flying || Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) > 1.3) continue;
            let best = null;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let d = 0.05; d <= 2.5; d += 0.05) {
              if (!walkable(tileAt(Math.round(e.x + dx * d), Math.round(e.y + dy * d)))) { if (!best || d < best.d) best = { dx, dy, d }; break; }
            }
            if (!best) { const ax = e.x - u.x, ay = e.y - u.y; best = Math.abs(ax) >= Math.abs(ay) ? { dx: Math.sign(ax) || 1, dy: 0, d: 2.5 } : { dx: 0, dy: Math.sign(ay) || 1, d: 2.5 }; }
            e.stunT = Math.max(e.stunT || 0, 0.3); e.blockedBy = null;
            e.lastHitBy = u; this.damage(e, this.stat(u, "atk") * s.mul, "phys", u);
            this.pulls.push({ e, dx: best.dx, dy: best.dy, at: this.t + 0.28, force: s.force, stun: s.stun });
            links.push({ e, ax: e.x + best.dx * best.d, ay: e.y + best.dy * best.d, dx: best.dx, dy: best.dy });
          }
          this.fx.push({ k: "a2chain", x: u.x, y: u.y, uid: u.id, links, t: 0, life: 1.6 }); break;
        }
        case "k2_place": u.rookNext = true; this.fx.pop(); break;
        case "k2_fate": this.rearrange(u, tiles); u.field = RANGE.front3.map((o) => { const [dx, dy] = rotate(o, u.dir); return [u.x + dx, u.y + dy]; }); u.fieldSlow = s.maze.slow; u.mazeAcc = 0; this.fx.push({ k: "k2fate", x: u.x, y: u.y, uid: u.id, t: 0, life: 1.2 }); break;
        case "a2_draw": {   // the absurdly long name, and an absurdly big blade for one swing
          for (const e of this.enemies) if (!e.dead && !e.hired && Math.max(Math.abs(Math.round(e.x) - u.x), Math.abs(Math.round(e.y) - u.y)) <= 1) { e.lastHitBy = u; this.damage(e, this.stat(u, "atk") * 3.2, "phys", u); }
          this.fx.push({ k: "a2draw", x: u.x, y: u.y, uid: u.id, t: 0, life: 1.2 }); break;
        }
        case "sl_astra": u.rangeKey = "slastra"; u.buff = { speed: 0.6 }; this.fx.push({ k: "slastra", x: u.x, y: u.y, uid: u.id, t: 0, life: 1.2 }); break;
        case "an_vine": {   // 나무 덩굴 속박: roots break the ground under up to two and bind them
          const tl = this.rangeTiles(u), foes = this.enemies.filter((e) => !e.dead && !e.hired && !e.def.flying && this.inRange(u, e, tl)).sort((a, b) => a.remain - b.remain).slice(0, s.n);
          if (!foes.length) { u.sp = u.skill.sp; u.castT = undefined; this.fx.pop(); return false; }   // nobody to bind: hold it
          for (const e of foes) { e.lastHitBy = u; this.damage(e, this.stat(u, "atk") * s.mul, "arts", u); this.bindVine(e, s.bind, u); this.fx.push({ k: "anvine", x: e.x, y: e.y, e, t: 0, life: 3.2 }); }
          break; }
        case "an_grove": u.buff = { atkMul: s.atk, healN: 2, regen: s.regen }; this.fx.push({ k: "angrove", x: u.x, y: u.y, uid: u.id, t: 0, life: 1.2 }); break;
        case "an_save": u.rangeKey = "ansave"; u.buff = {}; u.anPushT = this.t; this.anPush(u); this.fx.push({ k: "ansave", x: u.x, y: u.y, uid: u.id, t: 0, life: 1.6 }); break;
        case "pn_eternal": u.buff = { speed: s.speed, healMul: s.healMul }; this.fx.push({ k: "pneternal", x: u.x, y: u.y, uid: u.id, t: 0, life: 1.4 }); break;
        case "rb_star": u.starNext = true; this.fx.pop(); break;
        case "r6_strike": u.strikeR6 = true; this.fx.pop(); break;
        case "fc_cut": u.cutNext = true; this.fx.pop(); break;
        case "fc_flip": u.buff = { atkMul: s.atk }; this.fx.pop(); this.fx.push({ k: "fcflip", x: u.x, y: u.y, uid: u.id, t: 0, life: 1.0 }); break;
        case "vl_draw": u.drawNext = true; this.fx.pop(); break;
        case "vl_echo": u.buff = { speed: s.speed }; this.fx.pop(); this.fx.push({ k: "vlecho", x: u.x, y: u.y, uid: u.id, t: 0, life: 1.0 }); break;
        case "vl_light": {   // 광속일섬: the blade goes home, a breath, and then five draws too fast to see
          // with the screen up, the screen fires the draws on its own beat (the battle is held still meanwhile); without it they land on these timers
          this.fx.pop(); u.wind = null; u.atkT = 1.2; u.dmgCutT = this.t + 1.2; u.vlT = this.t; u.vlDone = [];
          this.fx.push({ k: "vllight", x: u.x, y: u.y, uid: u.id, t: 0, life: 1.8 });
          u.vlFire = (i) => {
            if (u.vlDone[i] || !this.units.includes(u)) return; u.vlDone[i] = true;
            const tl = this.rangeTiles(u), A = this.stat(u, "atk");
            const tg = this.enemies.filter((q) => !q.dead && !q.hired && this.inRange(u, q, tl));
            for (const q of tg) { if (i === 0 && q.holyT > 0) { q.holyT = HOLY.dur; this.fx.push({ k: "rbholy", x: q.x, y: q.y, e: q, t: 0, life: 1.2 }); } this.veilCut(u, q, A * s.mul, true); }
            this.fx.push({ k: "vldraw5", x: u.x, y: u.y, i, tg: tg.map((q) => [q.x, q.y]), uid: u.id, t: 0, life: 0.5 });
          };
          for (let i = 0; i < 5; i++) this.later.push({ at: this.t + 1.05 + i * 0.14, f: () => u.vlFire(i) });
          break;
        }
        case "gs_one": u.oneNext = true; this.fx.pop(); break;
        case "gs_rain": {   // 만검귀종: the swords leave their sheath on the wind and come down one by one
          this.fx.pop(); const tl = this.rangeTiles(u); u.castT = this.t;
          this.fx.push({ k: "gsrain", x: u.x, y: u.y, uid: u.id, t: 0, life: 1.6 });
          for (let i = 0; i < 8; i++) this.later.push({ at: this.t + 0.35 + i * 0.1, f: () => {
            if (!this.units.includes(u)) return;
            const tg = this.enemies.filter((q) => !q.dead && !q.hired && this.inRange(u, q, this.rangeTiles(u)));
            if (!tg.length) return; const q = tg[i % tg.length];
            q.lastHitBy = u; this.damage(q, this.stat(u, "atk") * s.mul * (q.def.flying ? 1.5 : 1), "phys", u);
            this.fx.push({ k: "gssword", x: q.x, y: q.y, i, t: 0, life: 0.5 });
          } });
          break;
        }
        case "r6_twin": u.dblNext = true; u.twinR6 = true; this.fx.pop(); break;
        case "r6_star": u.buff = { atkMul: s.atk, defMul: s.def, ivMul: s.ivMul }; this.fx.pop(); this.fx.push({ k: "r6star", x: u.x, y: u.y, uid: u.id, t: 0, life: 1.0 }); break;
        case "rb_self": this.fx.pop(); this.fx.push({ k: "rbself", x: u.x, y: u.y, uid: u.id, t: 0, life: 1.0 }); break;
        case "bk_just": u.buff = { defMul: s.def }; this.fx.push({ k: "bkjust", x: u.x, y: u.y, t: 0, life: 1.0 }); break;
        case "ay_eden": for (const a of this.units) if (this.inRange(u, a, tiles)) { a.hp = Math.min(a.maxHp, a.hp + a.maxHp * s.cure); this.fx.push({ k: "heal", x: a.x, y: a.y, t: 0, life: 0.7 }); } this.fx.push({ k: "ayeden", x: u.x, y: u.y, t: 0, life: 1.0 }); break;
        case "cb_wave": u.basketNext = true; break;
        case "sn_cheer": for (const a of this.units) if (a === u || near(u, a)) { a.cheerT = s.time; a.cheerDef = s.def; this.fx.push({ k: "sncheer", x: a.x, y: a.y, t: 0, life: 0.8 }); } this.fx.push({ k: "sncheerc", x: u.x, y: u.y, t: 0, life: 1.0 }); break;
        case "sn_smite": u.buff = { atkMul: s.atk, blockAdd: 1 }; this.fx.push({ k: "snsmite", x: u.x, y: u.y, t: 0, life: 1.2 }); break;
        case "ke_view": u.hp = Math.min(u.maxHp, u.hp + u.maxHp * s.cure); this.fx.push({ k: "kebloom", x: u.x, y: u.y, uid: u.id, t: 0, life: 1.0 }); break;
        case "ke_unity": u.buff = { defMul: s.def }; this.fx.push({ k: "keunity", x: u.x, y: u.y, uid: u.id, t: 0, life: 1.2 }); break;
        case "k_mate": u.matePending = this.t + 0.55; u.atkT = Math.max(u.atkT, 0.9); u.wind = null; break;
        case "i_maze": u.field = tiles; u.fieldSlow = s.maze.slow; u.mazeAcc = 0; this.fx.push({ k: "imaze", x: u.x, y: u.y, uid: u.id, tiles, t: 0, life: 1.2 }); break;
        case "a_scout": u.stack = 0; u.lastTgt = null; break;
        case "a_hire": {   // a contract for the weakest ordinary foe in reach; bosses and elites won't sign
          const pick = foes.filter((e) => !e.def.boss && !e.def.elite && !e.def.flying && !e.hired && e.def.atk > 0 && !e.dead).sort((a, b) => a.hp - b.hp)[0];
          if (!pick) { u.sp = s.sp; u.skillT = 0; u.castT = undefined; this.fx.pop(); return false; }
          pick.hired = { t: s.dur, by: u, taken: s.taken }; pick.hp = pick.maxHp; pick.blockedBy = null; pick.heldBy = null; pick.atkT = 0.6;
          for (const q of this.enemies) if (q.heldBy === pick) q.heldBy = null;
          u.hireTarget = pick;
          this.fx.push({ k: "ahire", x0: u.x, y0: u.y, x1: pick.x, y1: pick.y, e: pick, uid: u.id, t: 0, life: 1.2 });
          break;
        }   // no banner: it is just his next swing
        case "sq_puff": u.buff = { speed: s.speed }; break;
        case "sq_screen": u.wind = null; this.fx.push({ k: "sqscreen", x: u.x, y: u.y, uid: u.id, t: 0, life: 1.2 }); break;
        case "sq_star": u.rangeKey = "sqstar"; u.buff = { speed: s.speed }; this.fx.push({ k: "sqstar", x: u.x, y: u.y, uid: u.id, t: 0, life: 1.4 }); break;
        case "eg_insight": u.egBurst = true; u.egSee = true; this.fx.pop(); break;   // no banner: it is just his next kick
        case "eg_under": u.buff = { atkMul: s.atk }; this.fx.push({ k: "egunder", x: u.x, y: u.y, uid: u.id, t: 0, life: 1.2 }); break;
        case "eg_gate": this.addWard(u, s.ward); this.fx.push({ k: "eggate", x: u.x, y: u.y, uid: u.id, t: 0, life: 1.0 }); break;
        case "l_ban": u.buff = { dmgTaken: s.taken, atkMul: s.atk }; this.fx.push({ k: "lban", x: u.x, y: u.y, t: 0, life: 1.0 }); break;
        case "m_bless": {
          const amt = this.stat(u, "atk") * s.cure;
          for (const a of this.units) if (this.inRange(u, a, tiles)) { a.hp = Math.min(a.maxHp, a.hp + amt); this.fx.push({ k: "heal", x: a.x, y: a.y, t: 0, life: 0.7 }); }
          this.fx.push({ k: "bless", x: u.x, y: u.y, tiles, t: 0, life: 1.2 });
          break;
        }
        case "m_rain": u.healAcc = 0; this.fx.push({ k: "rainstart", x: u.x, y: u.y, t: 0, life: 0.6 }); break;
        case "h_flow": case "h_none": u.dpGot = 0; u.healAcc = 0; this.fx.push({ k: "flow", x: u.x, y: u.y, t: 0, life: s.dur, u }); break;
        case "b_roar": u.roarDP = 0; this.fx.push({ k: "roar", x: u.x, y: u.y, t: 0, life: s.dur }); break;
        case "guard": u.buff.atkMul = s.atk; break;
        case "defender": u.buff.defMul = s.def; u.buff.blockAdd = 1; u.hp = Math.min(u.maxHp, u.hp + u.maxHp * s.cure); break;
        case "sniper": u.buff.speed = s.speed; break;
        case "caster":
          for (const e of foes) this.damage(e, this.stat(u, "atk") * s.mul, "arts", u);
          this.fx.push({ k: "blast", tiles, t: 0, life: 0.5 });
          break;
        case "medic":
          for (const a of this.units) if (this.inRange(u, a, tiles)) { a.hp = Math.min(a.maxHp, a.hp + a.maxHp * s.cure); this.fx.push({ k: "heal", x: a.x, y: a.y, t: 0, life: 0.7 }); }
          break;
        case "supporter": u.field = tiles; u.fieldSlow = s.slow; break;
        case "tk_haste": u.buff = { speed: s.speed }; this.fx.push({ k: "tkhaste", x: u.x, y: u.y, uid: u.id, t: 0, life: 1.0 }); break;
        case "tk_field": u.field = tiles; u.fieldSlow = s.slow; u.wind = null; this.fx.push({ k: "tkfield", x: u.x, y: u.y, uid: u.id, tiles, t: 0, life: 1.0 }); break;
        case "specialist": {
          const [fx, fy] = rotate([1, 0], u.dir);
          const front = [[u.x, u.y], [u.x + fx, u.y + fy]];
          for (const e of this.enemies) {
            if (e.def.flying) continue;
            const tx = Math.round(e.x), ty = Math.round(e.y);
            if (!front.some(([x, y]) => x === tx && y === ty)) continue;
            this.damage(e, this.stat(u, "atk") * s.mul, "phys", u);
            this.shove(e, fx, fy, s.force); e.stunT = Math.max(e.stunT, s.stun);
          }
          this.fx.push({ k: "push", x: u.x, y: u.y, dir: u.dir, t: 0, life: 0.45 });
          break;
        }
      }
      return true;
    }
    update(dt) {
      if (this.over) return;
      if (this.march && this.march.choose) return;   // the road forks: everything waits for the choice
      this.t += dt;
      if (this.march) { this.marchStep(); if (this.march.choose) return; if (this.bar) this.barrageStep(dt); }
      if (this.fires.length) this.fireStep(dt);
      if (this.wind) this.windStep();
      if (this.shifts.length) this.shiftStep();
      if (this.volleys.length) this.volleyStep();
      if (this.shells.length) this.shellStep();
      if (this.calls) this.callStep();
      if (this.stage.lamps && this.lampOff.size) this.relightStep();
      if (this.lampEv.length) for (const ev of this.lampEv) { if (!ev.warned && this.t >= ev.t - ev.warn) { ev.warned = true; for (const [x, y] of ev.off || []) if (this.lampLit(x, y) && !this.lampGuarded(x, y)) this.fx.push({ k: "flicker", x, y, t: 0, life: ev.warn }); }
        if (!ev.done && this.t >= ev.t) { ev.done = true; for (const [x, y] of ev.off || []) this.snuff(x, y); } }   // a lamp that gutters out by the clock
      for (const b of this.bombs) if ((b.t -= dt) <= 0 && !b.done) {   // a frost bomb lands: a burst of ice over everyone close by
        b.done = true;
        for (const u of this.units.slice()) if (Math.hypot(u.x - b.x, u.y - b.y) <= b.r + 0.01) { this.damage(u, b.dmg, b.type || "arts", null); this.frostHit(u, b.frost); }
        this.fx.push({ k: "frostboom", x: b.x, y: b.y, r: b.r, t: 0, life: 0.8 }); this.snd("boom");
      }
      if (this.bombs.length) this.bombs = this.bombs.filter((b) => !b.done);
      // cost
      this.costAcc += dt * this.costRate;
      while (this.costAcc >= 1) { this.costAcc -= 1; if (this.cost < CFG.maxCost) this.cost++; }
      for (const c of this.cards) if (c.cooldown > 0) c.cooldown = Math.max(0, c.cooldown - dt);
      // spawns
      while (this.waveIdx < this.waves.length && this.waves[this.waveIdx][0] <= this.t) {
        const [, type, s, o] = this.waves[this.waveIdx++];
        if (!this.routeReady(type, s, o)) { (this.waitSpawn || (this.waitSpawn = [])).push({ type, s, o, next: this.t + 1 }); continue; }   // its way is still shut: it waits behind the gate
        this.spawn(type, s, o);
      }
      if (this.waitSpawn && this.waitSpawn.length) for (const w of this.waitSpawn.slice()) if (this.t >= w.next) {   // tried again every second; it comes in the moment its way is open
        if (this.routeReady(w.type, w.s, w.o)) { this.waitSpawn.splice(this.waitSpawn.indexOf(w), 1); this.spawn(w.type, w.s, w.o); } else w.next = this.t + 1; }
      if (this.extra) while (this.extra.length && this.extra[0][0] <= this.t) { const [, type, s] = this.extra.shift(); this.spawn(type, s); }
      if (this.loopDef) this.loopStep();   // lab: waves without end
      if (this.vip) this.vipStep(dt);   // lab: the ally who walks
      if (this.chimneys.length) this.chimneyStep(dt);   // lab L1: the chimneys and their bridges
      if (this.beat) this.beatStep(dt);   // lab L2: the zones' beat clocks
      if (this.relay) this.relayStep(dt);   // lab L4: the hand-overs, the collectors' pick-up and carry back
      if (this.echo) this.echoStep();   // lab L5: yesterday's deployments, as ghosts
      // enemies move / attack
      const gates = this.units.filter((u) => u.skill.id === "eg_gate" && u.skillT > 0 && this.units.includes(u));   // 수문장: nobody small leaves his yard
      // the drum and the cross: a drummer (or the eagle) keeps everyone round him in step — faster, bolder, deaf to the blizzard; a priest mends the men round him
      for (const e of this.enemies) {
        if (e.dead || e.hold || e.hired || e.hp <= 0) continue;
        if (e.def.rally && (!e.def.rally.at || e.hp <= e.maxHp * e.def.rally.at)) for (const q of this.enemies) if (q !== e && !q.dead && !q.hired && !q.def.flying && !q.def.bomb && Math.hypot(q.x - e.x, q.y - e.y) <= e.def.rally.r) { q.rallyT = this.t + 0.4; q.rallyBy = e.def.rally; }
        if (e.def.mend) {
          if (e.mendT === undefined) e.mendT = e.def.mend.every * 0.5;
          if ((e.mendT -= dt) <= 0) { e.mendT = e.def.mend.every; let n = 0;
            for (const q of this.enemies) if (q !== e && !q.dead && !q.hired && !q.def.flying && !q.def.bomb && q.hp > 0 && q.hp < q.maxHp && Math.hypot(q.x - e.x, q.y - e.y) <= e.def.mend.r) { q.hp = Math.min(q.maxHp, q.hp + q.maxHp * e.def.mend.pct); n++; }
            if (n) this.fx.push({ k: "mend", x: e.x, y: e.y, r: e.def.mend.r, t: 0, life: 0.8 }); }
        }
      }
      for (const e of this.enemies) {
        e.flash = Math.max(0, e.flash - dt);
        if (e.weakT > 0) e.weakT -= dt;
        if (e.nyalaT > 0) e.nyalaT -= dt;
        if (e.erodeT > 0) { e.erodeT -= dt; if (e.erodeT <= 0) e.erodeT = 0; }   // 침식
        if (e.holyT > 0) {   // 성흔: it burns steadily while it lasts
          e.holyT -= dt; e.holyAcc = (e.holyAcc || 0) + dt;
          if (e.holyAcc >= 1) { e.holyAcc -= 1; this.damage(e, HOLY.dps, "true", null); }
          if (e.holyT <= 0) e.holyT = 0;
        }
        if (e.hold && e.holdUntil !== undefined && this.t >= e.holdUntil) { e.hold = false; e.holdUntil = undefined; if (e.waiting) { e.waiting = false; this.fx.push({ k: "wake", e, x: e.x, y: e.y, t: 0, life: 0.9 }); } }
        if (e.hold) continue;   // held in place by a script (the tutorial) or standing where the stage set it
        if (e.def.frenzy) { const F = e.def.frenzy; e.frenzyM = 1 + Math.min(F.cap, F.rate * (this.t - e.born)); e.hp -= e.maxHp * F.drain * dt; }   // the cold eats it as it rages
        if (e.def.snowcloak) { const on = !!(this.wind && this.wind.blowing); if (on !== !!e.stealth) { e.stealth = on; if (!on) { e.revealT = this.t; this.fx.push({ k: "icereveal", x: e.x, y: e.y, t: 0, life: 0.6 }); } } }   // white in the white-out
        if (this.stage.lamps && !e.def.flying && !e.def.boss && !e.ally && !e.def.lantern) { const dk = this.darkAt(Math.round(e.x), Math.round(e.y)), on = dk && !e.blockedBy && !this.units.some((u) => Math.max(Math.abs(u.x - e.x), Math.abs(u.y - e.y)) <= 1.2); e.dim = dk && !on; if (on !== !!e.stealth) { e.stealth = on; if (!on) { e.revealT = this.t; } } }   // out of the lamplight: unseen — unless someone holds it or it stands right beside one of ours, and then only those beside it can strike
        if (e.def.snuff) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.snuff(Math.round(e.x) + dx, Math.round(e.y) + dy, e, e.def.snuff === "force");   // the snuffer: every lamp he passes that nobody stands by goes out (the lamp-breaker breaks it even so)
        if (e.def.mark) { const M = e.def.mark; if (e.markCD === undefined) e.markCD = M.every * 0.4;   // the informer: he points someone out, and for a while they are hit harder and shot at first
          if ((e.markCD -= dt) <= 0) { let tg = null; for (const high of [true, false]) { for (const u of this.units) if ((tileAt(u.x, u.y) === "h") === high && Math.hypot(u.x - e.x, u.y - e.y) <= M.r && (!tg || this.stat(u, "atk") > this.stat(tg, "atk"))) tg = u; if (tg) break; }   // an operator up on high ground first
            if (tg) { e.markCD = M.every; tg.markT = this.t + M.dur; tg.markAmp = M.amp; this.fx.push({ k: "marked", e, u: tg, x: tg.x, y: tg.y, t: 0, life: M.dur }); } else e.markCD = 0.5; } }
        if (e.unsmoke && this.smoke.size) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.clearSmoke(Math.round(e.x) + dx, Math.round(e.y) + dy, e.unsmoke);   // it beats the smoke away as it passes
        if (e.def.iceHide) { const c = tileAt(Math.round(e.x), Math.round(e.y)), on = c === "=" || c === "-"; if (on !== !!e.stealth) { e.stealth = on; if (!on) this.fx.push({ k: "icereveal", x: e.x, y: e.y, t: 0, life: 0.6 }); } }   // white on white
        if (e.def.bomber && !e.dropped) {   // drifting in slowly: the moment someone is below and in reach, the one frost bomb goes, and it bolts
          const B = e.def.bomber; if (e.bombT === undefined) e.bombT = B.arm;
          if ((e.bombT -= dt) <= 0) {
            let tg = null, bd = B.range; for (const u of this.units) { const d0 = Math.hypot(u.x - e.x, u.y - e.y); if (d0 <= bd) { bd = d0; tg = u; } }
            if (tg) { this.bombs.push({ x: tg.x, y: tg.y, t: B.fall, r: B.r, dmg: e.def.atk * B.mul * (e.atkMul || 1), frost: B.frost, type: "phys" }); this.fx.push({ k: "bombdrop", x0: e.x, y0: e.y, x1: tg.x, y1: tg.y, t: 0, life: B.fall }); e.dropped = true; }
            else e.bombT = 0.15;
          }
        }
        if (e.trapT > 0) e.trapT -= dt;
        if (e.hired) {   // under contract: it stands its ground and fights whatever comes along the path
          e.hired.t -= dt; e.slowT = 0;
          if (e.hired.t <= 0) { e.hired = null; e.unhiredT = this.t; this.fx.push({ k: "aunhire", x: e.x, y: e.y, e, t: 0, life: 0.8 }); for (const q of this.enemies) if (q.heldBy === e) q.heldBy = null; }
          else {
            if (e.stunT > 0) { e.stunT -= dt; continue; }
            e.atkT -= dt;
            if (e.atkT <= 0) {
              let best = null, bd = e.def.ranged ? e.def.ranged : 1.3;
              for (const q of this.enemies) if (q !== e && !q.hired && !q.dead && !q.def.flying) { const d = Math.hypot(q.x - e.x, q.y - e.y); if (d <= bd) { bd = d; best = q; } }
              if (best) {
                e.atkT = e.def.interval; e.face = best.x >= e.x ? 1 : -1; e.hitAt = this.t;
                this.damage(best, e.def.atk, "phys", null, e); best.lastHitBy = e.hired.by;
                this.fx.push(e.def.ranged ? { k: "bolt", x0: e.x, y0: e.y, x1: best.x, y1: best.y, t: 0, life: 0.25 } : { k: "hirehit", x: best.x, y: best.y, x0: e.x, y0: e.y, t: 0, life: 0.3 });
              } else e.atkT = 0.2;
            }
            continue;
          }
        }
        if (e.shove) { this.stepShove(e, dt); continue; }   // mid-slide: no walking, no fighting
        if (e.heldBy && (e.heldBy.dead || !e.heldBy.hired || !this.enemies.includes(e.heldBy))) e.heldBy = null;
        e.slowT = Math.max(0, e.slowT - dt);
        if (e.def.falter && !e.faltered && this.phaseOn(e, e.def.falter) && e.hp > 0 && e.hp <= e.maxHp * e.def.falter.at) {   // the body changes hands for a moment: he stops where he stands, and so does everyone round him
          const F = e.def.falter; e.faltered = true; e.stunT = Math.max(e.stunT || 0, F.dur); e.falterT = this.t + F.dur; e.chargeT = 0;
          for (const q of this.enemies) if (q !== e && !q.dead && !q.hired && Math.hypot(q.x - e.x, q.y - e.y) <= F.r) q.stunT = Math.max(q.stunT || 0, F.dur * 0.6);
          this.fx.push({ k: "falter", e, x: e.x, y: e.y, t: 0, life: F.dur }); }
        if (e.def.boss && !e.enraged && e.hp <= e.maxHp * RAGE.at) { e.enraged = true; this.fx.push({ k: "enrage", e, x: e.x, y: e.y, t: 0, life: 1.0 }); }
        if (e.def.sniper && this.neyStep(e, dt)) continue;
        if (e.stunT > 0) { e.stunT -= dt; continue; }
        const ch = e.def.charge;
        if (ch) {   // the headless captain spurs his horse: a burst of speed, and the first blow after it lands double
          if (e.chargeT > 0) { e.chargeT -= dt; if (e.blockedBy) { e.chargeT = 0; e.atkT = Math.min(e.atkT, 0.25); } }
          else if (!e.blockedBy && !(e.pauseT > 0) && (e.chargeCD -= dt) <= 0) { e.chargeT = ch.dur; e.chargeCD = ch.every; e.charged = true; this.fx.push({ k: "charge", e, x: e.x, y: e.y, t: 0, life: ch.dur }); }
          else if (ch.breach && this.phaseOn(e, ch.breach) && e.blockedBy && !e.charged && e.hp <= e.maxHp * ch.breach.at) {
            if (ch.every >= 1e8 && !e.breachArmed) { e.breachArmed = true; e.chargeCD = 0; }   // a charge kept only for the breach: it comes the first time he is held past that mark, and once
            if ((e.chargeCD -= dt) <= 0) { e.chargeCD = ch.every; e.charged = true; e.atkT = Math.max(e.atkT, 1.0); this.fx.push({ k: "charge", e, x: e.x, y: e.y, held: true, t: 0, life: 1.0 }); } }   // held, and past half his strength: he rears, and the next blow carries him through
        }
        const cl = e.def.call;
        if (cl && this.phaseOn(e, cl)) for (let i = 0; i < cl.at.length; i++) if (!(e.called & (1 << i)) && e.hp > 0 && e.hp <= e.maxHp * cl.at[i]) {   // calls his riders back from the dark
          e.called = (e.called || 0) | (1 << i);
          if (cl.type) for (let n = 0; n < cl.n; n++) {
            if (cl.gate !== undefined) { const g = this.spawn(cl.type, cl.gate, cl.via ? { via: cl.via } : undefined); g.stunT = 0.2 + n * 0.9; this.total++; continue; }   // sent for, not brought: they come in by a gate of their own
            const s = this.spawn(cl.type, 0);
            if (cl.direct) {   // called up where he stands, and off by the shortest way to the point (at a run, if the call says so)
              const at = [Math.round(e.x), Math.round(e.y)]; s.path = bfsPath(at, BASE) || e.path.slice(e.seg); s.seg = 0; s.segT = 0; this.advance(s, 0); s.remain = segLen(s.path);
              s.x += (n % 2 ? 0.25 : -0.25); s.stunT = 0.3 + n * 0.5;   // they come up one after another
            } else { s.path = e.path; s.seg = e.seg; s.segT = e.segT; this.advance(s, -0.6 - n * 0.7); }
            if (cl.dash) s.dashMul = cl.dash;
            this.total++;
          }
          if (cl.rouse) for (const q of this.enemies) if (q.waiting && !q.dead) { this.wake(q);   // the horn: the whole camp is on its feet
            if (cl.direct) { const at = [Math.round(q.x), Math.round(q.y)], p = bfsPath(at, BASE); if (p) { q.path = p; q.seg = 0; q.segT = 0; this.advance(q, 0); } }   // ...and makes straight for the point
            if (cl.dash) q.dashMul = cl.dash; }
          if (cl.barrage) this.barrage();
          if (cl.stall) { e.stunT = Math.max(e.stunT || 0, cl.stall); e.stallUntil = this.t + cl.stall; e.stallDur = cl.stall; }   // after the order he stands still a while with his arm raised (no change to his defence); stallUntil/stallDur are for the page
          const only = (k) => cl[k] && (!cl.only || cl.only[k] === undefined || cl.only[k] === i);
          if (only("rapid")) for (const v of this.volleys) if (v.kind !== "charge") { v.rapid = cl.rapid.every; v.rapidUntil = this.t + cl.rapid.dur; }   // "every gun": for a while they fire as fast as they can be served   // "all guns, all squadrons": every line on the board is laid at once
          if (only("dark")) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) this.snuff(x, y, e, cl.dark === "all");   // "lights out": every lamp nobody stands by ("all": every lamp, kept or not)
          if (cl.darkNear) { let best = null, bd = 1e9; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (this.lampLit(x, y)) { const d = Math.hypot(x - e.x, y - e.y); if (d < bd) { bd = d; best = [x, y]; } }
            if (best) this.snuff(best[0], best[1], e, true); }   // the lamp nearest him goes out, kept or not
          if (cl.gust && this.wind && !this.wind.blowing) { this.wind.next = Math.min(this.wind.next, this.t + this.wind.warn); this.wind.warned = false; }   // the standard raised: the wind answers it
          this.fx.push({ k: "call", x: e.x, y: e.y, rouse: !!cl.rouse, gust: !!cl.gust, dark: !!only("dark"), rapid: !!only("rapid"), near: !!cl.darkNear, barrage: !!cl.barrage, t: 0, life: 1.4 });
        }
        if (e.blockedBy && !this.units.includes(e.blockedBy)) e.blockedBy = null;
        if ((e.aim !== undefined || e.noWay) && this.t >= (e.replanAt || 0) && !e.blockedBy && !e.heldBy && !e.leap && !e.hop) this.replan(e);   // lab: an aimed foe (or one whose road was cut) looks again once a second
        if (this.stage.leap && (e.stranded || e.leap) && this.leapStep(e, dt)) continue;   // lab L1: stranded on its roof, it leaps across in the end
        if (e.def.sweeper && this.chimneys.length) this.sweepStep(e, dt);   // lab L1: the sweep at work beside a chimney
        if (e.def.rally && e.def.rally.at && !e.rallied && e.hp <= e.maxHp * e.def.rally.at) { e.rallied = true; this.fx.push({ k: "call", x: e.x, y: e.y, rally: true, t: 0, life: 1.6 }); }   // past half: the banner of the Sacred Heart goes up
        if (e.def.callshot && !e.ally && e.hp > 0) this.shotStep(e, dt);
        if (e.def.hook && !(e.windT > 0) && !e.blockedBy && !(e.pauseT > 0)) {   // free of any blocker: now and then he throws the hook at someone up on a rise
          if (e.hookCD === undefined) e.hookCD = e.def.hook.every * 0.5;
          if ((e.hookCD -= dt) <= 0) {
            let tg = null; for (const u of this.units) if (tileAt(u.x, u.y) === "h" && Math.hypot(u.x - e.x, u.y - e.y) <= e.def.hook.r && (!tg || this.stat(u, "atk") > this.stat(tg, "atk"))) tg = u;
            if (tg) { e.hookCD = e.def.hook.every; e.windT = e.def.hook.wind; e.windK = "hook"; e.hookTgt = tg; this.fx.push({ k: "hookmark", e, u: tg, x: tg.x, y: tg.y, t: 0, life: e.def.hook.wind }); }
            else e.hookCD = 0.5;
          }
        }
        let field = 0;
        for (const u of this.units) if (u.field && u.skillT > 0 && u.field.some(([x, y]) => x === Math.round(e.x) && y === Math.round(e.y))) field = Math.max(field, u.fieldSlow || 0.65);
        const rally = e.rallyT > this.t ? e.rallyBy : null;   // in step with the drum
        const mud = !e.def.flying && tileAt(Math.round(e.x), Math.round(e.y)) === "~" ? MUD : 0;   // wading through the rasputitsa
        const bliz = !e.def.flying && !e.def.snowproof && !rally && this.wind && this.wind.blowing ? BLIZ.slow : 0;   // wading against the blizzard
        const slow = Math.max(field, mud, bliz, e.slowT > 0 ? e.slowAmt : 0);
        if (e.def.bomb && e.blockedBy) {   // held up: the fuse is lit, and it burns down
          if (e.fuseT === undefined) e.fuseT = e.def.bomb.fuse;
          if ((e.fuseT -= dt) <= 0) e.hp = 0;
        }
        // a ranged foe keeps walking between shots; when the next one is due it stops, shoulders the gun and takes aim, then walks on
        if (e.def.ranged && (e.def.melt || (!e.blockedBy && !e.heldBy))) {   // the firebottle man takes aim even when someone has hold of him
          let tg = this.rangedTarget(e); const held = e.blockedBy || e.heldBy;
          if (held && !(tg && tg.frozenT > 0)) tg = held;
          if (tg && !e.aimTgt) e.atkT = Math.max(e.atkT, e.def.aim || RANGED_AIM);   // the sights first: never a snap shot
          e.aimTgt = tg; if (tg) e.face = tg.x >= e.x ? 1 : -1;
          e.aiming = !!tg && e.atkT <= (e.def.aim || RANGED_AIM);
          if (e.def.melt && e.aiming && e.markT !== tg) { e.markT = tg; this.fx.push({ k: "mmark", e, u: tg, x: tg.x, y: tg.y, t: 0, life: e.atkT + 0.5 }); }   // the bottle lit and raised: a flame over whoever it is meant for
        } else { e.aimTgt = null; e.aiming = false; }
        const settling = e.def.ranged && e.firedAt !== undefined && this.t - e.firedAt < RANGED_HOLD;   // the kick of the shot: he stays put a moment
        if (e.drops && e.hoverT > 0) {   // an airship holding over its drop point: the men go down the ropes one by one
          e.hoverT -= dt; const q = e.drops[e.dropI - 1];
          while (q && q.left > 0 && e.hoverT <= q.next) {
            q.left--; q.next -= AIR_DROP.gap; e.cargo--;
            const m = this.spawn(q.type, 0), off = [[0, 0], [0.3, -0.25], [-0.3, 0.25], [0.3, 0.25]][q.n - q.left - 1 & 3];
            m.path = bfsPath(q.at, BASE) || [q.at.slice(), BASE.slice()]; m.seg = 0; m.segT = 0; m.x = q.at[0] + off[0] * 0.5; m.y = q.at[1] + off[1] * 0.5; m.remain = segLen(m.path); m.dropT = this.t;
            this.total++; this.fx.push({ k: "land", x: m.x, y: m.y, t: 0, life: 0.8 });
          }
        } else if (e.windT > 0) {   // winding up a sweep or a throw of the hook: he stands still, and it shows
          e.windT -= dt;
          if (e.windT <= 0) {
            if (e.windK === "sweep") {   // the sabre goes right round: everyone within reach, on the road or up on a rise
              const S = e.def.sweep, atk = e.def.atk * S.mul * (e.enraged ? RAGE.atk : 1) * (e.atkMul || 1);
              for (const u of this.units.slice()) if (Math.max(Math.abs(u.x - Math.round(e.x)), Math.abs(u.y - Math.round(e.y))) <= S.r) { this.damage(u, atk, "phys", null, e); u.flash = 0.2; }
              this.fx.push({ k: "sweep", x: e.x, y: e.y, r: S.r, t: 0, life: 0.5 }); e.atkT = e.def.interval;
            } else if (e.windK === "hook") {   // the hook: whoever it was thrown at comes down off the rise and out of the fight
              const u = e.hookTgt; if (u && this.units.includes(u)) { this.damage(u, e.def.hook.dmg * (e.atkMul || 1), "phys", null, e); if (this.units.includes(u)) this.retreat(u); this.fx.push({ k: "hookhit", x: u.x, y: u.y, t: 0, life: 0.6 }); }
              e.hookTgt = null;
            }
            e.windK = null;
          }
        } else if (e.pauseT > 0) { e.pauseT -= dt;   // stopped at a waypoint of its route: looking the ground over
        } else if (this.beat && !e.def.flying && !e.blockedBy && !e.heldBy && ((!e.aiming && !settling) || e.hop) && !(e.postUntil > this.t) && !e.noWay) {   // lab L2: on the beat (a hop once begun is finished)
          const reached = this.beatMove(e, dt, slow);
          if (reached && !e.blockedBy && !e.heldBy && !e.aimHold) { e.dead = true; e.leaked = true; if (e.leakTo) this.meter(e.leakTo.meter, e.leakTo.by); else this.life -= e.def.life; this.leaked++; this.fx.push({ k: "leak", t: 0, life: 0.8 }); continue; }
        } else if (!e.blockedBy && !e.heldBy && !e.aiming && !settling && !(e.postUntil > this.t) && !e.noWay) {
          const step = e.def.speed * (1 - slow) * (e.dashMul || 1) * (this.calls && this.calls.until > this.t && !e.def.flying ? this.calls.speed : 1) * (rally ? rally.speed : 1) * (e.chargeT > 0 ? ch.mult : 1) * (e.dropped ? e.def.bomber.dash : 1) * dt;
          const sx = e.x, sy = e.y, sseg = e.seg, st = e.segT;
          let reached = this.advance(e, step);
          if (e.path.waits && e.path.waits[e.seg] && e.waitedAt !== e.seg) { e.waitedAt = e.seg; e.pauseT = e.path.waits[e.seg]; }
          if (!e.def.flying) {
            const tx = Math.round(e.x), ty = Math.round(e.y);
            const u = this.unitAt(tx, ty);
            if (e.def.claim && u && this.onGround(u) && !(e.breachT > this.t && e.breachFrom === u)) this.claimBlocker(e, u);   // a boss is never walked past: a full blocker lets go of others to take him
            if (u && this.onGround(u) && !e.passed && !(e.breachT > this.t && e.breachFrom === u) && this.blockLoad(u) + e.def.weight <= this.stat(u, "block")) {
              e.blockedBy = u; e.blockedAt = this.t;
              // stop at the edge of the blocker's tile
              const d = Math.hypot(e.x - u.x, e.y - u.y);
              if (d < 0.45) { e.x = sx; e.y = sy; e.seg = sseg; e.segT = st; this.advance(e, 0); }
            }
            // a hired foe in the way holds up to two of its old comrades
            if (!e.blockedBy) for (const h of this.enemies) if (h.hired && !h.waiting && h !== e && Math.hypot(h.x - e.x, h.y - e.y) < 0.62 && e.remain > h.remain - 0.05) {
              const load = this.enemies.reduce((s2, q) => s2 + (q.heldBy === h ? q.def.weight : 0), 0);
              if (load + e.def.weight <= 2) { e.heldBy = h; e.x = sx; e.y = sy; e.seg = sseg; e.segT = st; this.advance(e, 0); break; }
            }
          }
          if (gates.length && !e.def.boss && !e.def.elite && !e.def.flying && !e.hired) for (const gu of gates) {
            const inside = Math.max(Math.abs(e.x - gu.x), Math.abs(e.y - gu.y)) <= 2.45;
            if (e.gateIn === gu.id && !inside) {   // it tried to walk out: it is dragged back in by the heels
              const ox = e.x, oy = e.y; this.advance(e, -0.9); reached = false;
              e.stunT = Math.max(e.stunT || 0, 0.35); e.pullT = this.t; e.pullFrom = [ox - e.x, oy - e.y];
              this.fx.push({ k: "egpull", e, uid: gu.id, x: e.x, y: e.y, x0: ox, y0: oy, ux: gu.x, uy: gu.y, t: 0, life: 0.5 });
            } else if (inside) e.gateIn = gu.id;
          }
          if (e.drops && e.dropI < e.drops.length && e.seg >= e.dropI + 1) {   // over the next drop point: stop and let them down
            const q = e.drops[e.dropI++]; q.left = q.n; q.next = AIR_DROP.hover - AIR_DROP.lead;
            e.hoverT = AIR_DROP.hover; e.seg = e.dropI; e.segT = 0; this.advance(e, 0); e.x = q.at[0]; e.y = q.at[1]; e.remain = segLen(e.path.slice(e.seg));
          }
          if (reached && e.land) {   // touchdown: the drone drops its man here and pulls away
            e.dead = true; e.landed = true; this.killed++;
            const q = this.spawn(e.drop, 0); q.path = bfsPath(e.land, BASE) || [e.land.slice(), BASE.slice()]; q.seg = 0; q.segT = 0; q.x = e.land[0]; q.y = e.land[1]; q.remain = segLen(q.path); q.dropT = this.t;
            this.total++; this.fx.push({ k: "land", x: e.land[0], y: e.land[1], t: 0, life: 0.8 }); continue;
          }
          if (reached && e.toEscort && this.escort && !e.blockedBy && !e.heldBy) { e.dead = true; e.leaked = true; this.escort.hp -= e.def.life; this.leaked++; this.fx.push({ k: "escorthit", x: this.escort.x, y: this.escort.y, t: 0, life: 0.9 }); continue; }
          if (reached && !e.blockedBy && !e.heldBy && !e.aimHold) { if (e.def.bomb) this.explode(e); e.dead = true; e.leaked = true; if (e.leakTo) this.meter(e.leakTo.meter, e.leakTo.by); else this.life -= e.def.life; this.leaked++; this.fx.push({ k: "leak", t: 0, life: 0.8 }); continue; }
        }
        if (!e.def.sniper) e.atkT -= dt;   // the marshal keeps his own count
        if (e.atkT <= 0 && e.def.atk > 0 && !e.def.sniper) {
          let target = e.def.melt ? e.aimTgt || e.blockedBy || e.heldBy : e.blockedBy || e.heldBy;
          if (!target && e.def.ranged) target = e.aimTgt;
          if (!target && e.def.reachHigh) { const R = e.def.reachHigh, ex = Math.round(e.x), ey = Math.round(e.y);   // a long arm: nobody holding him, he cuts at whoever stands within reach — up on a rise too — the weakest first
            for (const u of this.units) if (Math.max(Math.abs(u.x - ex), Math.abs(u.y - ey)) <= R && (!target || u.hp < target.hp)) target = u; if (target) e.reachHit = true; }
          if (!target && e.aim !== undefined) target = this.aimStrike(e);   // lab: what it was sent for, beside it
          if (target && e.def.collector && this.relay && (this.relay.state !== "held" || target !== this.relay.holder || e.carrying)) target = null;   // lab L4: the collector strikes nobody but the holder
          if (target && target.isMirror) { e.atkT = e.def.interval / (e.frenzyM || 1); this.hitMirror(e, target.sq, e.def.atk * (e.enraged ? RAGE.atk : 1) * (e.atkMul || 1)); }   // lab L3: a blow on the glass
          else if (target && target.isVip) { e.atkT = e.def.interval / (e.frenzyM || 1); this.hitVip(e, e.def.atk * (e.enraged ? RAGE.atk : 1) * (e.atkMul || 1)); }
          else if (target && e.def.sweep && (e.swings = (e.swings || 0) + 1) % e.def.sweep.every === 0) { e.windT = e.def.sweep.wind; e.windK = "sweep"; e.atkT = e.def.interval; this.fx.push({ k: "sweepwarn", e, x: e.x, y: e.y, r: e.def.sweep.r, t: 0, life: e.def.sweep.wind }); target = null; }
          else if (target) {
            e.atkT = e.def.interval / (e.frenzyM || 1);
            const reach = e.reachHit; e.reachHit = false;   // a cut in passing at someone he is not held by: lighter, and it does not spend the charge
            const hit = reach ? 0.7 : (e.charged && !e.def.ranged ? e.def.charge.hit : 1) * (e.frenzyM || 1) * (e.rallyT > this.t ? e.rallyBy.atk : 1);
            const br = !reach && e.charged && e.def.charge && e.def.charge.breach, breach = br && this.phaseOn(e, br) && target === e.blockedBy && !target.isEnemy && e.hp <= e.maxHp * br.at ? br : null;   // the charge that carries him through the line
            if (e.charged && !reach) { e.charged = false; if (hit > 1) this.fx.push({ k: "trample", x: target.x, y: target.y, t: 0, life: 0.6 }); }
            if (e.def.melt) this.throwBottle(e, target);
            else this.damage(target, e.def.atk * hit * (e.weakT > 0 ? 1 - e.weakAmt : 1) * (e.enraged ? RAGE.atk : 1) * (e.atkMul || 1), e.def.ranged && !e.def.phys ? "arts" : "phys", null, e);
            if (breach) { e.breachFrom = target; e.breachT = this.t + 1.2; e.blockedBy = null; this.advance(e, breach.push); this.fx.push({ k: "breach", x: e.x, y: e.y, t: 0, life: 1.0 }); }
            if (e.def.ranged) { if (!e.def.melt) this.fx.push({ k: "bolt", x0: e.x, y0: e.y, x1: target.x, y1: target.y, foe: true, t: 0, life: 0.25 }); e.firedAt = this.t; e.aiming = false; e.markT = null; }
            if (e.stealth && e.def.ambush) { e.stealth = false; e.revealT = this.t; this.fx.push({ k: "ambush", e, x: e.x, y: e.y, t: 0, life: 0.9 }); }   // the muzzle flash gives him away
          } else e.atkT = 0.2;
        }
      }
      // 체스판: every half tile an enemy travels across her board costs it a little arts damage
      const boards = this.units.filter((u) => u.def.board && !(u.def.deployAnim && this.t - u.born < u.def.deployAnim));
      for (const e of this.enemies) {
        const px = e._bx, py = e._by; e._bx = e.x; e._by = e.y;
        if (!boards.length || px === undefined || e.dead || e.hired || e.def.flying) continue;
        const tx = Math.round(e.x), ty = Math.round(e.y), d = Math.min(0.25, Math.hypot(e.x - px, e.y - py));
        if (d <= 0) continue;
        const u = boards.find((b) => this.rangeTiles(b).some(([x, y]) => x === tx && y === ty)); if (!u) continue;
        e.boardAcc = (e.boardAcc || 0) + d;
        if (e.boardAcc >= u.def.board.per) {
          e.boardAcc -= u.def.board.per;
          this.damage(e, this.stat(u, "atk") * u.def.board.mul, "arts", u);
          this.fx.push({ k: "skstep", x: e.x, y: e.y, t: 0, life: 0.4 });
        }
      }
      // units
      for (const c of this.cards) if (c.summonOf !== undefined && c.active) {
        for (let i = 0; i < c.chargeT.length; i++) c.chargeT[i] -= dt;
        while (c.chargeT.length && Math.min(...c.chargeT) <= 0) { c.chargeT.splice(c.chargeT.indexOf(Math.min(...c.chargeT)), 1); c.charges++; }
        c.placeT = Math.max(0, (c.placeT || 0) - dt);
        c.cooldown = Math.max(c.placeT, c.charges > 0 || !c.chargeT.length ? 0 : Math.min(...c.chargeT));
      }
      for (const e of this.enemies) if (e.sleepT > 0) { e.sleepT = Math.max(0, e.sleepT - dt); if (e.stunT <= 0) e.sleepT = 0; }
      for (const u of this.units) if (u.skill.id === "sq_star" && u.skillT > 0) { const tl = this.rangeTiles(u); for (const e of this.enemies) if (!e.dead && e.sleepT > 0 && this.inRange(u, e, tl)) {
        if (e.def.boss) { if (e._sqCast !== u.castT) { e._sqCast = u.castT; e._sqHold = 0; } if ((e._sqHold += dt) > 3) continue; }   // a boss can only be held under for 3 seconds a cast
        e.sleepT = Math.max(e.sleepT, 0.3); e.stunT = Math.max(e.stunT, 0.3); } }   // 죽음의 성좌: nobody in her reach wakes until she is done
      for (const u of this.units.slice()) {
        if (u.clone && this.t >= u.expire) { this.retreat(u, false); continue; }
        if (u.def.noHeal) { if (u.hpTop === undefined) u.hpTop = u.maxHp; u.maxHp = Math.max(1, Math.ceil(u.hp)); }   // 저거너트: nobody else's cure takes on him — what he has lost stays lost
        if (u.matePending && this.t >= u.matePending) { u.matePending = 0; this.mateGo(u); }
        if (u.cheerT > 0) u.cheerT -= dt;
        if (u.def.regen && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * u.def.regen * dt * (u.skill.id === "ke_unity" && u.skillT > 0 ? u.skill.regen : 1));   // 태고의 지혜: the old tree mends
        if (u.buffT > 0) { u.buffT -= dt; if (u.buffT <= 0) { u.buffT = 0; u.buff = {}; } }
        u.flash = Math.max(0, u.flash - dt);
        u.swing = Math.max(0, u.swing - dt);
        if (u.frostT > 0) { u.frostT -= dt; if (u.frostT <= 0) { u.frostT = 0; u.frostN = 0; } }
        if (u.blizFrozen) { u.hp -= u.maxHp * BLIZ.dmg * dt; u.flash = Math.max(u.flash || 0, 0.04); }   // frozen in the blizzard: the cold eats at them
        if (u.frozenT > 0) { u.frozenT -= dt; if (u.frozenT <= 0) { u.frozenT = 0; u.frostImm = this.t + FROST.imm; u.blizFrozen = false; } }
        if (u.gritT > 0) u.gritT -= dt;
        const s = u.skill;
        if (u.skillT > 0) {
          if (!s.ammo) u.skillT -= dt;   // an ammo skill counts shots, not seconds
          if (s.id === "an_save") {   // 구원: everyone in the light mends without pause, and the overflow hardens into wards
            const tl = this.rangeTiles(u), per = this.stat(u, "atk") * s.cure * dt;
            for (const a of this.units) if (this.inRange(u, a, tl)) this.healAN(u, a, per);
            if (this.t - u.anPushT >= 5) { u.anPushT = this.t; this.anPush(u); }
          }
          if (s.id === "e_judge") {
            // bleeds 2% max HP a second (never lethal), every point lost is stored
            const d = Math.min(u.maxHp * 0.02 * dt, Math.max(0, u.hp - 1));
            u.hp -= d; u.stored += d;
            const area = this.judgeArea(u);
            for (const e of this.enemies) if (area.some(([x, y]) => x === Math.round(e.x) && y === Math.round(e.y))) { e.slowT = Math.max(e.slowT, 0.25); e.slowAmt = Math.max(e.slowT > 0 ? e.slowAmt : 0, s.slow); }
          }
          if (s.id === "b_roar") {   // 10 DP spread over the roar
            const due = Math.min(s.roarDp, Math.floor((s.dur - u.skillT) / s.dur * s.roarDp + 1e-6));
            while (u.roarDP < due) { u.roarDP++; this.cost = Math.min(CFG.maxCost, this.cost + 1); }
          }
          if (s.dp) {   // cost spread evenly over the skill
            const due = Math.min(s.dp, Math.floor((s.dur - Math.max(0, u.skillT)) / s.dur * s.dp + 1e-6));
            while (u.dpGot < due) { u.dpGot++; this.cost = Math.min(CFG.maxCost, this.cost + 1); }
          }
          if (s.maze) {   // the labyrinth: everyone lost inside it bleeds a little every second
            if ((u.mazeAcc = (u.mazeAcc || 0) + dt) >= 1) {
              u.mazeAcc -= 1;
              for (const e of this.enemies) if (!e.hired && !e.def.flying && u.field && u.field.some(([x, y]) => x === Math.round(e.x) && y === Math.round(e.y))) { this.damage(e, this.stat(u, "atk") * s.maze.dot, "arts", u); e.lastHitBy = u; }
            }
          }
          if (s.rain) {   // the rain: a slow cure for allies under it, the foes lose heart
            const area = this.rangeTiles(u), inA = (x, y) => area.some(([ax, ay]) => ax === Math.round(x) && ay === Math.round(y));
            for (const e of this.enemies) if (inA(e.x, e.y)) { e.weakT = 0.3; e.weakAmt = s.weak; }
            if ((u.healAcc = (u.healAcc || 0) + dt) >= 1) {
              u.healAcc -= 1;
              for (const a of this.units) if (a.hp < a.maxHp && inA(a.x, a.y)) { a.hp = Math.min(a.maxHp, a.hp + this.stat(u, "atk") * s.cure); this.fx.push({ k: "heal", x: a.x, y: a.y, t: 0, life: 0.6 }); }
            }
          }
          if (s.heal && (u.healAcc = (u.healAcc || 0) + dt) >= 1) {   // a slow cure for everyone around her
            u.healAcc -= 1;
            const area = this.rangeTiles(u);
            for (const a of this.units) if (a.hp < a.maxHp && area.some(([x, y]) => x === a.x && y === a.y)) { a.hp = Math.min(a.maxHp, a.hp + a.maxHp * s.heal); this.fx.push({ k: "heal", x: a.x, y: a.y, t: 0, life: 0.6 }); }
          }
          if (u.skillT <= 0) { u.skillT = 0; this.endSkill(u); u.buff = {}; u.field = null; }
        } else if (u.hikiT > 0) {   // under the duvet: no attacks, no skill points, nothing
          u.hikiT -= dt; if (u.hikiT <= 0) { u.hikiT = 0; u.hikiEnd = this.t; }
          u.atkT = Math.max(u.atkT, 0.3); u.wind = null; continue;
        } else if (u.frozenT > 0) {   // frozen solid: no skill points gather and no skill goes off
        } else {
          if (s.spType !== "hit" && s.spType !== "atk") u.sp = Math.min(s.sp, u.sp + dt);
          if (s.mode === "auto" && u.sp >= s.sp && !(s.onDeploy && this.t - u.born < (u.def.deployAnim || 0.35))) {
            // healers only fire when someone is hurt; attackers only when a target exists
            const tiles = this.rangeTiles(u);
            const need = s.id === "b_chant" || s.id === "h_flow" ? true
              : s.id === "m_bless" ? this.units.some((a) => this.inRange(u, a, tiles) && a.hp < a.maxHp * 0.8) : s.id === "d_paint" ? this.units.some((q) => q.owner === u) || (this.summonCard(u) || {}).chargeT.length > 0
              : s.id === "e_mercy" ? this.units.some((a) => near(u, a) && a.hp < a.maxHp * 0.95)
              : s.id === "ke_view" ? u.hp < u.maxHp * 0.75
              : s.id === "a2_all" ? true
              : s.id === "a2_chain" ? this.enemies.some((e) => !e.dead && !e.hired && !e.def.flying && Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) <= 1.3)
              : s.id === "pn_root" ? this.units.filter((a) => this.inRange(u, a, tiles) && a.hp < a.maxHp * 0.9).length >= 2
              : s.id === "an_grove" ? this.units.some((a) => this.inRange(u, a, tiles) && a.hp < a.maxHp * 0.8)
              : s.id === "an_vine" ? this.enemies.some((e) => !e.dead && !e.hired && !e.def.flying && this.inRange(u, e, tiles))
              : u.def.id === "medic" ? this.units.some((a) => this.inRange(u, a, tiles) && a.hp < a.maxHp * 0.7)
              : this.enemies.some((e) => !e.dead && this.inRange(u, e, tiles));
            if (need) this.useSkill(u);
          }
        }
        if ((u.def.regenAura || (u.buff && u.buff.regen)) && (u.auraAcc = (u.auraAcc || 0) + dt) >= 1) {   // 평화의 선율: everyone within her reach mends a little every second
          u.auraAcc -= 1; const at = this.rangeTiles(u);
          for (const a of this.units) if (a.hp < a.maxHp && this.inRange(u, a, at)) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * ((u.def.regenAura || 0) + ((u.buff && u.buff.regen) || 0)));
        }
        if (u.def.deployAnim && this.t - u.born < u.def.deployAnim) continue;   // still landing
        if (u.def.fam && !u.wind && (u.atkStart === undefined || this.t - u.atkStart > 1.0)) {   // her familiars gather while she waits
          if ((u.fam || 0) < u.def.fam.max) { u.famT = (u.famT || 0) + dt; if (u.famT >= u.def.fam.every) { u.famT = 0; u.fam = (u.fam || 0) + 1; u.famAt = this.t; } }
        }
        if (u.def.noAttack) continue;   // she never strikes
        if (u.summoned && tileAt(u.x, u.y) === "h") { u.wind = null; continue; }   // a drawing lifted onto high ground only waits
        if (s.rain && u.skillT > 0) { u.atkT = Math.max(u.atkT, 0.3); continue; }
        if ((s.id === "e_judge" || s.id === "e_pray" || s.id === "tk_field" || s.id === "bk_just" || s.id === "sq_screen") && u.skillT > 0) { u.atkT = Math.max(u.atkT, 0.3); u.wind = null; continue; }
        if (u.frozenT > 0) { u.atkT = Math.max(u.atkT, 0.2); u.wind = null; continue; }   // frozen solid: no blows
        if (u.armoryT > 0) { u.armoryT -= dt; u.atkT = Math.max(u.atkT, 0.2); u.wind = null; continue; }   // 마검 '봉★평': he does not shoot while the armory is open   // no attacks while judging or praying
        // wind-up: the blow lands at the animation's impact frame, like the original
        if (u.wind) {
          u.wind.t += dt;
          // 신념의 검: the first of the two cuts lands partway through the wind-up
          if (u.def.id === "lulu" && !u.atkHeavy && !u.wind.pre && u.wind.t >= 0.19) {   // 소드마스터: the first of every two cuts
            u.wind.pre = true; const e0 = u.wind.target;
            if (e0 && !e0.dead && this.inRange(u, e0, this.rangeTiles(u))) this.hit(u, e0);
          }
          const wu = u.wind.w || u.def.windup;
          if (u.wind.t < wu) continue;
          u.meleeNow = !!u.wind.melee;
          let e = u.wind.target;
          const tiles0 = this.rangeTiles(u);
          if (e.dead || e.hired || !this.inRange(u, e, tiles0)) e = this.enemies.find((q) => !q.dead && !q.hired && this.inRange(u, q, tiles0) && (!q.def.flying || !this.onGround(u) || u.def.lord));
          const second = !!u.wind.second, hitI = u.wind.hitI || 0, spent = (u.wind.spent || 0) + wu;
          if (!hitI) u._hits = u.def.double ? 2 : u.skill.id === "r6_star" && u.skillT > 0 ? 3 : u.skill.id === "fc_flip" && u.skillT > 0 ? 2 : u.skill.id === "to_breath" && u.skillT > 0 ? 2 : u.dblNext ? 2 : 1;   // how many blows this attack is
          if (!hitI && u.dblNext) u.dblNext = false;
          u.wind = null;
          u.atkT = Math.max(0.05, this.stat(u, "interval") - spent);
          if (e && u.egBurst) {   // 절대적 직관: one scuff of the shoe, and the grit finds every one of them he holds
            u.egBurst = false; u.swing = 0.18;
            const held = this.enemies.filter((q) => q.blockedBy === u && !q.dead); if (!held.includes(e)) held.push(e);
            for (const q of held) { q.lastHitBy = u; q.bonkT = this.t; this.damage(q, this.stat(u, "atk") * u.skill.mul, "phys", u); this.fx.push({ k: "eghit", x: q.x, y: q.y, ux: u.x, uy: u.y, uid: u.id, v: 2, big: true, t: 0, life: 0.4 }); }
            u.egSee = false;
          } else if (e) { u.swing = 0.18; u.hitN = hitI; this.hit(u, e);
            if (u.skill.id === "sq_star" && u.skillT > 0) {   // 죽음의 성좌: two more puffs go out with it, to the ones still awake first
              const more = this.enemies.filter((q) => q !== e && !q.dead && !q.hired && this.inRange(u, q, tiles0)).sort((a, b) => ((a.sleepT > 0) - (b.sleepT > 0)) || a.remain - b.remain).slice(0, 2);
              for (const q of more) this.hitSQ(u, q, true);
            }
            if (u.skill.ammo && u.skillT > 0 && --u.skillT <= 0) { u.skillT = 0; this.endSkill(u); u.buff = {}; u.field = null; }   // 탄약: one shot spent; the last one ends it
          }
          const gap = u.def.double || u.def.combo || 0.18;
          if (u.skipSecond) u.skipSecond = false;
          else if (e && hitI + 1 < u._hits && !e.dead) u.wind = { t: 0, w: gap / (u.buff.speed || 1), target: e, second: true, hitI: hitI + 1, spent };   // the next blow follows the last
          continue;
        }
        u.atkT -= dt;
        if (u.atkT > 0) continue;
        const tiles = this.rangeTiles(u);
        if (u.def.dmg === "heal") {
          let best = null;
          for (const a of this.units) if (a.hp < a.maxHp && this.inRange(u, a, tiles) && (!best || a.hp / a.maxHp < best.hp / best.maxHp)) best = a;
          if (best && u.def.healFlight) {   // a slow fox-fire: the cure lands when it arrives
            u.atkT = this.stat(u, "interval"); u.atkStart = this.t;
            this.heals.push({ u, a: best, amt: this.stat(u, "atk"), x0: u.x, y0: u.y, t: 0, dur: u.def.healFlight, seed: Math.random() * 9 });
          } else if (best && u.def.multiHeal) {   // 평화의 선율: the melody reaches up to three at once (everyone, on the root chord) and mends them where they stand
            u.atkT = this.stat(u, "interval"); u.atkStart = this.t; u.atkTarget = best;
            const hurt = this.units.filter((a) => a.hp < a.maxHp && this.inRange(u, a, tiles)).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
            const n = u.chordNext ? hurt.length : u.def.multiHeal + ((u.buff && u.buff.healN) || 0), amt = this.stat(u, "atk") * ((u.buff && u.buff.healMul) || 1) * (u.chordNext ? u.skill.chord : 1);
            if (u.def.id === "angelina") { const tg = hurt.slice(0, n); for (const a of tg) this.healAN(u, a, amt); this.fx.push({ k: "anheal", uid: u.id, x: u.x, y: u.y, to: tg.map((a) => [a.x, a.y, a.id]), t: 0, life: 0.9 }); }
            else for (const a of hurt.slice(0, n)) { a.hp = Math.min(a.maxHp, a.hp + amt); this.fx.push({ k: "pnbloom", x: a.x, y: a.y, small: !!(u.buff && u.buff.healMul), t: 0, life: 0.7 }); }
            if (u.chordNext) { u.chordNext = false; u.chordAt = this.t; this.fx.push({ k: "pnchord", x: u.x, y: u.y, uid: u.id, t: 0, life: 1.0 }); }
          } else if (best) {
            u.atkT = this.stat(u, "interval"); u.atkStart = this.t; u.atkTarget = best;
            const low = u.def.happy && best.hp / best.maxHp <= 0.5;   // 해피 엔딩
            best.hp = Math.min(best.maxHp, best.hp + this.stat(u, "atk") * (low ? 1 + u.def.happy : 1));
            if (u.def.id === "piania") {   // a phrase of melody carries the cure; the root chord, or the endless melody, carries it to everyone
              this.fx.push({ k: "pnheal", x0: u.x, y0: u.y, x1: best.x, y1: best.y, uid: u.id, t: 0, life: 0.6 });
              const all = u.chordNext ? u.skill.chord : u.skill.id === "pn_eternal" && u.skillT > 0 ? 0.4 : 0;   // (not reached: Pianía heals through the multi-heal branch above)
              if (all) {
                for (const a of this.units) if (a !== best && a.hp < a.maxHp && this.inRange(u, a, tiles)) { a.hp = Math.min(a.maxHp, a.hp + this.stat(u, "atk") * all); this.fx.push({ k: "heal", x: a.x, y: a.y, t: 0, life: 0.6 }); }
                if (u.chordNext) { u.chordNext = false; this.fx.push({ k: "pnchord", x: u.x, y: u.y, uid: u.id, t: 0, life: 1.0 }); }
              }
            }
            if (u.def.id === "ayaki") this.fx.push({ k: "ayheal", x0: u.x, y0: u.y, x1: best.x, y1: best.y, uid: u.id, low, t: 0, life: 0.5 });
            this.fx.push({ k: "bolt", x0: u.x, y0: u.y, x1: best.x, y1: best.y, heal: true, t: 0, life: 0.3 });
            this.fx.push({ k: "heal", x: best.x, y: best.y, t: 0, life: 0.6 });
          } else if (u.def.id === "angelina") {   // 세계수의 숨결: nobody to mend, so the breath turns on a foe
            const foe = this.enemies.filter((e) => !e.dead && !e.hired && this.inRange(u, e, tiles)).sort((a, b) => a.remain - b.remain)[0];
            if (foe) { u.atkT = this.stat(u, "interval"); u.atkStart = this.t; u.atkTarget = foe; foe.lastHitBy = u; this.damage(foe, this.stat(u, "atk") * 0.6, "arts", u); this.fx.push({ k: "anray", x0: u.x, y0: u.y, x1: foe.x, y1: foe.y, e: foe, uid: u.id, t: 0, life: 0.5 }); }
            else u.atkT = 0.2;
          } else u.atkT = 0.2;
          continue;
        }
        const cands = this.enemies.filter((e) => !e.dead && !e.hired && this.inRange(u, e, tiles) && (!e.def.flying || !this.onGround(u) || u.def.lord));
        if (!cands.length) { u.atkT = 0.15; continue; }
        cands.sort((a, b) => {
          if (this.onGround(u)) { const ab = (a.blockedBy === u) - (b.blockedBy === u); if (ab) return -ab; }
          if (u.def.airFirst) { const af = (!!a.def.flying) - (!!b.def.flying); if (af) return -af; }
          { const tt = (!!a.def.taunt) - (!!b.def.taunt); if (tt) return -tt; }   // 방패병: the shield in reach is hit first
          if (u.def.lowDefFirst) { const dd = (a.defv || 0) - (b.defv || 0); if (dd) return dd; }   // 저격수: the softest target in reach
          if (u.def.sleepFirst) { const sl = (a.sleepT > 0) - (b.sleepT > 0); if (sl) return sl; }   // 스모퀸: the ones still awake first
          return a.remain - b.remain;
        });
        const e = cands[0];
        if (u.def.windup) {
          if (u.def.id === "smoqueen") u.sqN = (u.sqN || 0) + 1;
          if (u.def.id === "eungyeol") u.egV = u.egBurst ? 2 : (u.egV + 1 + (Math.random() * 2 | 0)) % 3 || 0;   // flick, lob or scuff — never the same twice running
          u.wind = { t: 0, target: e }; u.atkStart = this.t; u.atkHeavy = !!(u.strikeNext || u.trapNext || u.basketNext); u.swingN = (u.swingN || 0) + 1;
          if (u.def.id === "skakea") u.skClip = u.e4Next ? "e4" : "attack";
          if (u.def.id === "alpha" && !e.def.flying && Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) <= 1.25) { u.wind.melee = true; u.wind.w = 0.27; }   // too close for the gun
          u.atkMelee = !!u.wind.melee; u.atkTarget = e;
          continue;
        }
        u.atkT = this.stat(u, "interval");
        u.swing = 0.18;
        this.hit(u, e);
      }
      // things set to happen a beat later (a skill's volley of cuts or swords)
      if (this.later.length) { for (const l of this.later) if (!l.done && this.t >= l.at) { l.done = true; l.f(); } this.later = this.later.filter((l) => !l.done); }
      // 비살상 제압: the chains go taut on time
      for (const pl of this.pulls) if (!pl.done && this.t >= pl.at) { pl.done = true; if (!pl.e.dead) { const d = this.shove(pl.e, pl.dx, pl.dy, pl.force, pl.stun); if (pl.launch && pl.e.shove) pl.e.shove.launch = true; } }
      this.pulls = this.pulls.filter((pl) => !pl.done);
      // fox-fire in flight
      for (const h of this.heals) {
        h.t += dt;
        if (h.t < h.dur) continue;
        h.done = true;
        if (!this.units.includes(h.a)) continue;
        h.a.hp = Math.min(h.a.maxHp, h.a.hp + h.amt);
        this.fx.push({ k: "kheal", x: h.a.x, y: h.a.y, t: 0, life: 0.7 });
        const sp = h.u.def.splash || 0;
        if (sp) for (const b of this.units) if (b !== h.a && b.hp < b.maxHp && Math.abs(b.x - h.a.x) <= 1 && Math.abs(b.y - h.a.y) <= 1) { b.hp = Math.min(b.maxHp, b.hp + h.amt * sp); this.fx.push({ k: "ksplash", x: b.x, y: b.y, x0: h.a.x, y0: h.a.y, t: 0, life: 0.6 }); }
      }
      this.heals = this.heals.filter((h) => !h.done);
      for (const sh of this.shots) {   // familiars in flight: they bite when they arrive
        sh.t += dt; if (!sh.e.dead && (sh.armory ? sh.t < sh.dur - 0.08 : sh.t < sh.dur * 0.7)) { sh.x1 = sh.e.x; sh.y1 = sh.e.y; }   // the weapons of the past keep tracking right to the end   // a lob stops steering as it comes down
        if (sh.t < sh.dur) continue;
        sh.done = true;
        if (sh.lob) {
          for (const q of this.enemies) if (!q.dead && !q.hired && Math.hypot(q.x - sh.x1, q.y - sh.y1) <= sh.r + 0.05) { q.lastHitBy = sh.u; this.damage(q, sh.amt, "phys", sh.u); }
          this.fx.push({ k: "cbsplat", x: sh.x1, y: sh.y1, r: sh.r, big: sh.big, t: 0, life: sh.big ? 1.0 : 0.7 });
          continue;
        }
        if (sh.slam) {   // a tentacle comes down: everyone under it is hit once per volley and stunned for a moment
          for (const q of this.enemies) if (!q.dead && !q.hired && !q.def.flying && !sh.vol.hit.has(q) && Math.hypot(q.x - sh.x1, q.y - sh.y1) <= 0.6) {
            sh.vol.hit.add(q); q.lastHitBy = sh.u; this.damage(q, sh.amt, "arts", sh.u); q.stunT = Math.max(q.stunT || 0, q.def.boss ? sh.stun * 0.5 : sh.stun);
          }
          this.fx.push({ k: "slslam", x: sh.x1, y: sh.y1, t: 0, life: 0.5 });
          continue;
        }
        if (sh.armory) {   // a weapon of the past lands and bursts
          const x = sh.e.dead ? sh.x1 : sh.e.x, y = sh.e.dead ? sh.y1 : sh.e.y;
          if (!sh.e.dead && this.enemies.includes(sh.e)) { sh.e.lastHitBy = sh.u; this.damage(sh.e, sh.amt, "phys", sh.u); }
          for (const q of this.enemies) if (q !== sh.e && !q.dead && !q.hired && Math.max(Math.abs(q.x - x), Math.abs(q.y - y)) <= 1.2) { q.lastHitBy = sh.u; this.damage(q, this.stat(sh.u, "atk") * sh.splash, "phys", sh.u); }
          this.fx.push({ k: "boboom", x, y, t: 0, life: 0.6 });
          continue;
        }
        if (sh.e.dead || !this.enemies.includes(sh.e)) continue;
        sh.e.lastHitBy = sh.u; this.damage(sh.e, sh.amt, "arts", sh.u);
        this.fx.push({ k: "ifamhit", x: sh.e.x, y: sh.e.y, t: 0, life: 0.4 });
      }
      this.shots = this.shots.filter((h) => !h.done);
      // deaths
      // A two-stage boss (def.phase2): the first time he falls he does not die. He stands where he is for phase2.invul seconds, taking no harm from anything (his blocker
      // keeps him), and then rises with his second-stage strength, armour, attack and pace. Whatever he had marked off in the first stage starts over for the second
      for (const e of this.enemies) if (!e.dead && e.def.phase2) { const P = e.def.phase2;
        if (e.crownUntil !== undefined && !e.crowned) {
          if (this.t < e.crownUntil) { e.hp = 1; e.stunT = Math.max(e.stunT || 0, e.crownUntil - this.t); continue; }
          e.crowned = true; const mul = this.stage.mul, hp = Math.round(P.hp * (!e.def.noMul && mul ? mul.hp || 1 : 1));
          e.def = Object.assign({}, e.def, { def: P.def !== undefined ? P.def : e.def.def, atk: P.atk !== undefined ? P.atk : e.def.atk, speed: P.speed !== undefined ? P.speed : e.def.speed });
          e.maxHp = e.hp = hp; e.defv = e.def.def; e.stunT = 0;
          if (P.barrage) { this.barrage(); this.fx.push({ k: "call", x: e.x, y: e.y, rouse: false, gust: false, dark: false, rapid: false, near: false, barrage: true, t: 0, life: 1.4 }); }
        } else if (e.hp <= 0 && !(e.phase >= 2)) {
          e.phase = 2; e.hp = 1; e.crownUntil = this.t + (P.invul || 0); e.stunT = Math.max(e.stunT || 0, P.invul || 0); e.chargeT = 0; e.charged = false; e.windT = 0; e.windK = null;
          e.called = 0; e.faltered = false; e.falterT = 0; e.breachArmed = false;   // the first stage's marks do not carry over
          this.fx.push({ k: "crown", e, x: e.x, y: e.y, t: 0, life: P.invul || 0 });
        } }
      for (const e of this.enemies) if (!e.dead && e.downUntil > this.t) e.hp = e.downHp;   // an armour still lying down takes no harm
      // the empty armour (chapter 3's last night): struck down in the dark it only falls apart, and stands up again; struck down in the lamplight it stays down
      for (const e of this.enemies) if (!e.dead && e.hp <= 0 && e.def.revive && (e.rose || 0) < (e.def.revive.n || 1) && this.stage.lamps && this.darkAt(Math.round(e.x), Math.round(e.y))) {
        e.rose = (e.rose || 0) + 1; e.hp = Math.round(e.maxHp * e.def.revive.pct); e.stunT = Math.max(e.stunT || 0, e.def.revive.delay); this.fx.push({ k: "rise", e, x: e.x, y: e.y, t: 0, life: e.def.revive.delay }); }
      for (const e of this.enemies) if (!e.dead && e.hp <= 0 && e.lastHitBy && e.lastHitBy.def && e.lastHitBy.def.id === "skakea" && !e.capNoted) { e.capNoted = true; this.fx.push({ k: "skcap", x: e.x, y: e.y, type: e.type, t: 0, life: 1.0 }); }
      for (const e of this.enemies) if (!e.dead && e.hp <= 0 && e.lastHitBy && e.lastHitBy.skill.id === "b_roar" && e.lastHitBy.skillT > 0) { this.cost = Math.min(CFG.maxCost, this.cost + 1); this.fx.push({ k: "dp", x: e.x, y: e.y, t: 0, life: 0.8 }); }
      for (const e of this.enemies) if (!e.dead && e.hp <= 0 && e.lastHitBy && e.lastHitBy.def && e.lastHitBy.def.reclaim && Math.random() < e.lastHitBy.def.reclaim) { this.cost = Math.min(CFG.maxCost, this.cost + 1); this.fx.push({ k: "boreclaim", x: e.x, y: e.y, t: 0, life: 0.9 }); }   // 시간 회수
      for (const e of this.enemies) if (!e.dead && e.hp <= 0 && e.lastHitBy && e.lastHitBy.def && e.lastHitBy.def.wardKill && this.units.includes(e.lastHitBy)) this.addWard(e.lastHitBy, e.lastHitBy.def.wardKill);   // 서사 왜곡: every one he finishes adds to the shell
      const BF = this.stage.bossFlee;   // a boss who quits the field at a share of his strength instead of dying on it (a stage switches this on: { on: true, at: 0.3 })
      if (BF && BF.on) for (const e of this.enemies) if (e.def.boss && !e.dead && e.hp > 0 && e.hp <= e.maxHp * BF.at) { e.dead = true; e.fled = true; this.killed++; this.bossFledT = this.t; this.snd("retreat"); this.fx.push({ k: "die", x: e.x, y: e.y, boss: true, e, fled: true, t: 0, life: 0.5 }); }
      for (let more = true; more;) { more = false; for (const e of this.enemies) if (!e.dead && e.hp <= 0 && e.def.bomb && !e.boomed) { this.explode(e); more = true; } }   // a cart broken open goes up where it stands, and may set off the next
      for (const e of this.enemies) if (!e.dead && e.hp <= 0) { e.dead = true; if (!e.ally) this.killed++; this.snd("die");
        if (e.def.call && e.def.call.rapid && !e.ally) for (const v of this.volleys) if (v.rapidUntil > this.t) { v.rapidUntil = this.t;   // "every gun" dies with the one who gave it: the guns go back to their own time
          if (v.shotT !== undefined && v.next < v.shotT + v.every) { v.next = v.shotT + v.every; v.st = 0; } }
        if (e.lastHitBy && e.lastHitBy.def && e.lastHitBy.def.killCost && this.units.includes(e.lastHitBy)) { this.cost = Math.min(CFG.maxCost, this.cost + e.lastHitBy.def.killCost); this.fx.push({ k: "killcost", x: e.lastHitBy.x, y: e.lastHitBy.y, n: e.lastHitBy.def.killCost, t: 0, life: 1.0 }); }   /* 돌격: every kill pays a point back */ this.fx.push({ k: "die", x: e.x, y: e.y, boss: !!e.def.boss, e, t: 0, life: 0.5 }); }
      if (this.relay && this.relay.state === "carried" && (this.relay.carrier.dead || this.relay.carrier.hp <= 0)) { const e = this.relay.carrier; e.carrying = false; this.relayDrop(Math.round(e.x), Math.round(e.y)); }   // lab L4: the carrier falls: it lies where he fell
      if (this.stage.masks) this.maskStep();   // lab L3 (LAB-04): reflections (where the figures stand after this tick's moves) and the 12 s rule
      if (this.stage.masks) for (const e of this.enemies) if (e.dead && e.mask === "guest" && !e._counted) { e._counted = true;   // lab L3 (LAB-04): a guest who went in brings 3 cost; one killed is blood
        if (e.leaked) { this.cost = Math.min(CFG.maxCost, this.cost + 3); this.fx.push({ k: "killcost", x: e.x, y: e.y, n: 3, t: 0, life: 1.0 }); } else this.meter("blood", 1); }
      this.enemies = this.enemies.filter((e) => !e.dead);
      for (const u of this.units.slice()) if (u.hp <= 0) { if (this.stage.fallMeter && !u.summoned && !u.clone) this.meter(this.stage.fallMeter.meter, this.stage.fallMeter.by); this.retreat(u, false); }   // lab L2: a fall adds to a gauge
      for (const f of this.fx) f.t += dt;
      this.fx = this.fx.filter((f) => f.t < f.life);
      if (this.goal) this.goalStep();   // lab: the stage's own win and lose conditions in place of the two below
      else if (this.life <= 0 || (this.escort && this.escort.hp <= 0)) { this.life = Math.max(0, this.life); this.over = "lose"; this.escortLost = !!(this.escort && this.escort.hp <= 0); }
      else if (this.waveIdx >= this.waves.length && !(this.extra && this.extra.length) && !(this.waitSpawn && this.waitSpawn.length) && this.enemies.every((e) => e.ally) && !this.hold && !(this.march && !this.march.part.final)) this.over = "win";
      if (this.echo && this.over) this.echoSave();   // lab L5: the attempt is over: its record is kept
    }
  }

  // lab L2: on a stage with a beat, a manual skill started within 0.2 s of its zone's downbeat is "on the beat" (맞음): a timed one lasts 30% longer, an instant one hits 30%
  // harder; a deployment on the downbeat halves that card's next redeploy time. Stages without a beat go straight through to the methods as they are
  { const useSkill0 = Game.prototype.useSkill, deploy0 = Game.prototype.deploy, retreat0 = Game.prototype.retreat;
    Game.prototype.useSkill = function (u) {
      if (!this.beat || u.skill.mode !== "manual") return useSkill0.call(this, u);
      const on = this.onBeat(this.beatZone(u.x)); if (on && !u.skill.dur) this._beatAmpU = u;
      let r; try { r = useSkill0.call(this, u); } finally { this._beatAmpU = null; }
      if (on && r !== false) { if (u.skillT > 0) u.skillT *= 1.3; u.beatHitT = this.t; this.fx.push({ k: "onbeat", x: u.x, y: u.y, t: 0, life: 1.0 }); this.snd("chime"); }
      return r; };
    { const useSkillB = Game.prototype.useSkill;   // lab L3: the image in the glass uses its skill when its operator does
      Game.prototype.useSkill = function (u) { const r = useSkillB.call(this, u); if (this.mirror && r !== false && !u.image) { const im = this.units.find((q) => q.image && q.owner === u); if (im && !(im.skillT > 0)) { im.sp = im.skill.sp; useSkillB.call(this, im); } } return r; }; }
    Game.prototype.deploy = function (cardIdx, x, y, dir) {
      const r = deploy0.call(this, cardIdx, x, y, dir);
      if (this.beat && r !== false && this.units.some((u) => u.x === x && u.y === y && u.card === cardIdx) && this.onBeat(this.beatZone(x))) { this.cards[cardIdx].beatRd = true; this.fx.push({ k: "onbeat", x, y, deploy: true, t: 0, life: 1.0 }); }
      return r; };
    Game.prototype.deploy = (function (deployB) { return function (cardIdx, x, y, dir) { const r = deployB.call(this, cardIdx, x, y, dir); if (this.mirror && r && !r.summoned) this.mirrorImage(r); return r; }; })(Game.prototype.deploy);   // lab L3
    Game.prototype.deploy = (function (deployC) { return function (cardIdx, x, y, dir) { const r = deployC.call(this, cardIdx, x, y, dir);   // lab L5: every deployment of ours goes into the record
      if (this.echo && r && !r.summoned) { const c = this.cards[cardIdx]; this.echo.rec.push({ t: +this.t.toFixed(4), id: r.def.id, mult: c.mult, elite: c.elite, skillIdx: c.skillIdx, slv: c.slv, m: c.sm ? c.sm[c.skillIdx] || 0 : 0, x, y, dir, until: null, uid: r.id }); }
      return r; }; })(Game.prototype.deploy);
    Game.prototype.retreat = function (u, refund = true) {
      if (this.relay && this.relay.state === "held" && this.relay.holder === u) this.relayDrop(u.x, u.y);   // lab L4: the holder goes: the paper lies on its square
      if (this.echo && !u.ghost && this.units.includes(u)) { const r = this.echo.rec.find((q) => q.uid === u.id && q.until === null); if (r) r.until = +this.t.toFixed(4); }   // lab L5: the time it left the board
      if (this.relay) for (const q of this.units) if (q.relayFrom === u) q.relayFrom = null;
      if (this.relay && this.relay.job && (this.relay.job.by === u || this.relay.job.to === u)) this.relay.job = null;
      const c = this.beat && !u.summoned && this.cards[u.card]; const r = retreat0.call(this, u, refund);
      if (c && c.beatRd && c.cooldown > 0) { c.cooldown *= 0.5; c.beatRd = false; }
      return r; }; }
  // statuses and terms that skill texts link to: {이름} in a description becomes a tappable word that opens this explanation
  const STATUS = {
    "신성 손상": { col: "#ffd27a", desc: "적에게 쌓이는 원소 손상. 1000(보스는 2000)이 쌓이면 터지며 {성흔} 상태가 된다. 성흔이 끝날 때까지는 다시 쌓이지 않는다." },
    "성흔": { col: "#ffe9a0", desc: "10초 동안 매초 100의 {고정 피해}를 입고, 가사인격에게 공격받을 때마다 그 가사인격 공격력 10%의 {고정 피해}를 추가로 입는다." },
    "고정 피해": { col: "#f2f2f2", desc: "방어력과 마법 저항을 무시하고 그대로 들어가는 피해." },
    "기절": { col: "#ffe066", desc: "이동할 수 없고 공격할 수 없다." },
    "속박": { col: "#8fd88a", desc: "덩굴에 묶여 움직일 수도 공격할 수도 없다. {기절}과 같다. 보스는 지속시간이 절반이 된다." },
    "탄약": { col: "#ffcf6a", desc: "탄약형 스킬. 공격할 때마다 1발을 쓰고, 다 쓰면 스킬이 끝난다." },
    "졸음": { col: "#c9b6ff", desc: "잠들어 이동할 수 없고 공격할 수 없다. {기절}과 같다. 보스는 지속시간이 40%로 줄어든다." },
    // 세부 분류: what every operator of that branch shares
    "척후병": { col: "#9fd0ff", sub: 1, desc: "적을 2명까지 저지한다. 코스트를 즉시 회복하는 스킬로 작전 초반을 연다." },
    "돌격수": { col: "#9fd0ff", sub: 1, desc: "적을 1명 저지한다. 적을 처치하면 코스트 +1. 직접 퇴각하면 첫 배치 코스트를 전부 돌려받는다." },
    "기수": { col: "#9fd0ff", sub: 1, desc: "싸우는 대신 압도적인 양의 코스트를 회복한다." },
    "로드": { col: "#9fd0ff", sub: 1, desc: "적을 2명 저지한다. 멀리 있는 적에게는 공격력 80%의 원거리 공격을 하며, 비행 적도 공격할 수 있다." },
    "파이터": { col: "#9fd0ff", sub: 1, desc: "가볍고 빠른 근접 격투가. 공격 속도가 매우 빠르고 스킬이 공격으로 충전된다." },
    "소드마스터": { col: "#9fd0ff", sub: 1, desc: "적을 2명 저지한다. 한 번의 공격으로 두 번 벤다." },
    "공격수": { col: "#9fd0ff", sub: 1, desc: "저지 중인 적 모두를 동시에 공격한다. 2정예화하면 저지 수 +1." },
    "저거너트": { col: "#9fd0ff", sub: 1, desc: "적을 3명 저지한다. 다른 유닛에게 치료받을 수 없다." },
    "보호막": { col: "#e8eaf0", desc: "체력보다 먼저 피해를 대신 받는다. 다 깎이면 사라진다." },
    "프로텍터": { col: "#9fd0ff", sub: 1, desc: "적을 3명 저지한다. 높은 방어력으로 앞을 막는다." },
    "가디언": { col: "#9fd0ff", sub: 1, desc: "적을 3명 저지한다. 아군을 치료하는 스킬을 가진다." },
    "명사수": { col: "#9fd0ff", sub: 1, desc: "비행 적을 우선 공격한다. 공격 속도가 빠르다." },
    "저격수": { col: "#9fd0ff", sub: 1, desc: "사거리가 넓고 공격력이 높지만 느리다. 범위 안에서 방어력이 가장 낮은 적을 우선 공격한다." },
    "포격사수": { col: "#9fd0ff", sub: 1, desc: "공격이 작은 범위에 물리 피해를 준다." },
    "코어 캐스터": { col: "#9fd0ff", sub: 1, desc: "적 하나에게 마법 피해를 준다." },
    "메딕": { col: "#9fd0ff", sub: 1, desc: "아군 한 명을 치료한다." },
    "멀티 타겟 메딕": { col: "#9fd0ff", sub: 1, desc: "아군을 최대 3명까지 동시에 치료한다." },
    "감속자": { col: "#9fd0ff", sub: 1, desc: "공격이 마법 피해를 주고, 맞은 적을 0.8초 동안 {정지}시킨다." },
    "소환사": { col: "#9fd0ff", sub: 1, desc: "전장에 따로 배치할 수 있는 소환물을 가진다." },
    "약화자": { col: "#9fd0ff", sub: 1, desc: "공격이 마법 피해를 주고, 스킬이나 재능으로 적을 약화시킨다." },
    "푸쉬마스터": { col: "#9fd0ff", sub: 1, desc: "적을 밀쳐내는 데 능하다." },
    "처형자": { col: "#9fd0ff", sub: 1, desc: "적을 1명 저지한다. 배치 코스트가 낮고 재배치 시간이 매우 짧다(18초)." },
    "정지": { col: "#bfe4ff", desc: "이동 속도가 80% 느려진다." },
    "침식 손상": { col: "#a58cff", desc: "적에게 쌓이는 원소 손상. 1000(보스는 2000)이 쌓이면 터지며 즉시 1500의 {마법 피해}를 입고 {침식} 상태가 된다. 침식이 끝날 때까지는 다시 쌓이지 않는다." },
    "침식": { col: "#c3b2ff", desc: "8초 동안 마법 저항 -25." },
    "마법 피해": { col: "#7fc8ff", desc: "방어력은 무시하지만 마법 저항만큼 줄어드는 피해." },
  };
  // every operator's 세부 분류
  const SUBOF = {"belina": "척후병", "tao": "척후병", "rabi6": "돌격수", "falchion": "돌격수", "hakuren": "기수", "veil": "로드", "geomseon": "로드", "rabi": "파이터", "lulu": "소드마스터", "hiro": "공격수", "yui": "가디언", "sunae": "프로텍터", "ker": "프로텍터", "eungyeol": "저거너트", "brick": "프로텍터", "bongeun": "명사수", "alpha": "명사수", "nana": "저격수", "capy": "포격사수", "skakea2": "코어 캐스터", "irins": "코어 캐스터", "lilith": "코어 캐스터", "piania": "멀티 타겟 메딕", "angelina": "멀티 타겟 메딕", "miho": "메딕", "ayaki": "메딕", "teka": "감속자", "jayeon": "감속자", "atat": "소환사", "silphy": "약화자", "smoqueen": "약화자", "skakea": "푸쉬마스터", "alpha2": "처형자"};
  for (const d of UNITS) if (SUBOF[d.id]) d.sub = SUBOF[d.id];
  for (const d of UNITS) if (d.sub === "감속자") { d.slow = 0.8; d.slowDur = 0.8; }   // the trait as written: every hit holds the target at a fifth of its pace for 0.8s ({정지})
  for (const d of UNITS) if (d.cls === "저격" && d.sub !== "저격수" && d.sub !== "포격사수") d.airFirst = true;   // the marksmen take what flies first; the long rifles and the guns keep to their own
  for (const d of UNITS) { if (d.talents) d.talent = d.talents[0]; else if (d.talent) d.talents = [Object.assign({ elite: 0 }, d.talent)]; }   // 제1·제2 재능: every operator has a list; the second opens at the second promotion
  const HOLY = { max: 1000, dur: 10, dps: 100, onHit: 0.1 };
  const ERODE = { max: 1000, burst: 1500, dur: 8, resDown: 25 };
  root.TD = { echoGet, echoSet, echoClear, BASES, MAP0, get W() { return W; }, get H() { return H; }, get MAP() { return MAP; }, bfsPath, viaPath, atPath, STATUS, HOLY, ERODE, rangeKeyOf, eliteCost, potOf, potList, growth, AKSTAT, SANDBOX, TUTORIAL, MAP_TUT, setMap, nameOf, revealAt, skillAt, skillDesc, skillFields, maxMastery, SK_CURVE, SKILL_LV, near, Game, UNITS, SUMMONS, ENEMIES, WAVES, STAGES, CFG, RANGE, PATHS, AIR_PATHS, SPAWNS, BASE, tileAt, rotate };
})(typeof window !== "undefined" ? window : globalThis);
