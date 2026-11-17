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
    cadoudal:{ name: "조르주 카두달", info: ["목 없는 장군. 단두대 아래에 한참 섰다가 언덕을 돌아 아래쪽 길로 온다. 팔이 길어, 막는 이가 없으면 바로 옆 칸(고지 포함)의 가사인격을 벤다. 세 번째 공격마다 둘레 한 칸을 모두 휩쓴다(고지 포함, 1초 전 붉은 원). 목에서 푸른 불이 타, 그가 1.5칸 안에 있는 화로는 불기운을 잃는다.", "막히지 않았을 때는 2칸 안 고지의 가사인격에게 갈고리를 던져 끌어내린다(1.5초 전 표시, 맞으면 퇴각). 체력 2/3·1/3에 호각으로 진지 전체를 깨우고 게릴라 둘을 곁에 불러내며(모두 방어 지점으로 곧장 달려온다), 절반 아래부터는 성심 깃발을 올려 둘레의 반란군을 빠르고 세게 만들며 돌격으로 저지를 뚫는다."],
      hp: 9000, atk: 460, def: 180, res: 20, speed: 0.5, interval: 2.4, weight: 2, mass: 4, life: 3, boss: true, noMul: true,
      reachHigh: 1, sweep: { every: 3, r: 1, mul: 0.65, wind: 1.0 }, hook: { every: 15, r: 2.3, wind: 1.5, dmg: 300 }, rally: { at: 0.5, r: 2.2, speed: 1.3, atk: 1.2 },
      charge: { every: 9, dur: 1.6, mult: 2.6, hit: 2, breach: { at: 0.5, push: 1.1 } }, call: { at: [0.66, 0.33], type: "chouang", n: 2, rouse: true, direct: true, dash: 1.4 }, coldfire: 1.5 },   /* coldfire: a brazier within 1.5 of him gives no warmth */   // direct: whoever he calls or rouses takes the shortest way to the point; dash: at a run
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
    // ---- chapter 3, the lamps and the wall: ladders, ramparts and what uses the dark (figures borrowed, recoloured) ----
    escalader: { name: "사다리병", info: ["사다리를 타고 담장 위로 올라와 담장을 따라 걷는다. 담장 위의 가사인격만 막을 수 있다."],
      hp: 1900, atk: 280, def: 100, res: 0, speed: 0.9, interval: 1.9, weight: 1, mass: 2, life: 1, climb: true },
    wallgunner: { name: "담장 엽병", info: ["담장 위에 오르면 사거리가 한 칸 늘어난다."],
      hp: 1500, atk: 460, def: 130, res: 20, speed: 0.85, interval: 2.3, weight: 1, mass: 2, life: 1, ranged: 2.4, phys: true, rscale: true, climb: true },
    sapper: { name: "공병", info: ["담장 위에 선 가사인격부터 노린다."],
      hp: 2600, atk: 420, def: 180, res: 10, speed: 0.7, interval: 2.4, weight: 1, mass: 2, life: 1, ranged: 2.2, phys: true, wallFirst: true },
    staker: { name: "말뚝병", info: ["담장 위 빈 칸에 말뚝을 박아 자리를 빼앗는다. 말뚝은 부술 수 있다."],
      hp: 1700, atk: 200, def: 120, res: 0, speed: 0.85, interval: 2.0, weight: 1, mass: 2, life: 1, climb: true, stake: { hp: 2500 } },
    nightblade: { name: "야습병", info: ["어둠 속에 있는 동안 공격력이 계속 오른다. 빛 속에서는 가라앉는다."],
      hp: 2000, atk: 260, def: 90, res: 0, speed: 0.9, interval: 1.8, weight: 1, mass: 2, life: 1, darkGrow: { rate: 0.06, cap: 1.2 } },
    // ---- chapter 3, second pass: the rest of the line-up for the lamps and the wall (figures borrowed, recoloured) ----
    gloomrunner: { name: "그늘 달음꾼", info: ["어둠 속에서는 훨씬 빨리 달린다."],
      hp: 1300, atk: 240, def: 150, res: 20, speed: 1.0, interval: 1.7, weight: 1, mass: 1, life: 1, darkRun: 1.6 },   /* darkRun: its speed times this on a dark square */
    nightfowler: { name: "어둠의 엽병", info: ["어둠 속에서 쏘면 마법 피해가 된다."],
      hp: 2200, atk: 300, def: 100, res: 0, speed: 0.9, interval: 2.4, weight: 1, mass: 2, life: 1, ranged: 2.0, phys: true, darkArts: true },   /* darkArts: shots fired from a dark square are arts */
    lanternist: { name: "초롱 술사", info: ["숨어 있다가, 힘을 모으는 동안만 모습을 드러낸다. 다 모으면 한 명과 그 둘레를 함께 태운다."],
      hp: 4200, atk: 380, def: 220, res: 50, speed: 0.7, interval: 6, weight: 1, mass: 2, life: 1, ranged: 2.2, aim: 3, burn: { time: 3, splash: 1.2, mult: 2.6 } },   /* burn: unseen but while it charges (its aim, burn.time); the shot is arts x mult on the target and all of ours within splash of it */
    longrifle3: { name: "청금 저격수", info: ["판 어디든 쏜다. 불빛 속에 선 가사인격만 겨눌 수 있다. 네 발째는 두 배로 아프다."],
      hp: 5000, atk: 360, def: 150, res: 30, speed: 0.8, interval: 3.6, weight: 1, mass: 2, life: 1, ranged: 20, phys: true, elite: true, litOnly: true, fourth: 2 },   /* litOnly: aims only at ours on a lit square (or spotted by the balloon); fourth: every fourth shot times this */
    nightmare: { name: "악몽 추종자", info: ["등 뒤 칸이 어두운 가사인격을 모두 함께 친다."],
      hp: 9000, atk: 900, def: 600, res: 20, speed: 0.7, interval: 3.2, weight: 2, mass: 3, life: 2, elite: true, fearBehind: true },   /* fearBehind: each blow also strikes every one of ours whose square behind them is dark */
    crawler: { name: "기는 것", info: ["막을 수 없다. 지나가는 동안 쓰러뜨려야 한다."],
      hp: 1500, atk: 0, def: 100, res: 30, speed: 1.2, interval: 99, weight: 1, mass: 1, life: 1, unblockable: true },
    ambusher3: { name: "매복병", info: ["숨어서 온다. 모습을 드러내는 첫 일격이 아주 아프다."],
      hp: 3600, atk: 520, def: 200, res: 20, speed: 1.0, interval: 2.2, weight: 1, mass: 2, life: 1, ambush: true, firstBlow: 2.5, climb: true },   /* unseen until its first blow, which is times firstBlow (the key "ambusher" is chapter 1's hedge fowler) */
    seer: { name: "조준 술사", info: ["한 명을 오래 겨눈 뒤 크게 친다. 겨눔은 그 칸의 불빛이 꺼지면 풀린다."],
      hp: 5200, atk: 420, def: 180, res: 40, speed: 0.8, interval: 1.6, weight: 1, mass: 2, life: 1, ranged: 4, litOnly: true, lock: { time: 6, mult: 4, dur: 6, every: 1.6, rest: 4 } },   /* lock: see seerStep (rest: it walks on that long after a volley before it locks again) */
    wagon: { name: "수송 수레", info: ["저지 수가 넷은 되어야 세울 수 있다. 곁의 적 넷까지 태워 간다."],
      hp: 14000, atk: 0, def: 900, res: 10, speed: 0.3, interval: 99, weight: 4, mass: 4, life: 2, carry: 4, noClimb: true },   /* carry: see wagonStep; noClimb: it keeps to the ground even where every foe climbs */
    balloon: { name: "관측 기구", info: ["방어 지점으로 오지 않는다. 판 위를 돌며 아래에 선 가사인격에게 표식을 찍고, 저격수와 술사는 표식부터 노린다. 담장 위나 고지의 원거리만 닿는다."],
      hp: 6000, atk: 0, def: 100, res: 20, speed: 0.35, interval: 99, weight: 0, mass: 0, life: 0, flying: true, highOnly: true, spot: { every: 5, r: 1.5, dur: 8 } },   /* flies the wave's loop for the whole stage; see the spot step */
    stake: { name: "말뚝", hp: 2500, atk: 0, def: 0, res: 0, speed: 0, interval: 99, weight: 0, mass: 99, life: 0, noMul: true, noFight: true },   /* planted by the staker (plantStake); never sent in a wave */
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
    // the gun retaker (chapter 3): a Guard grenadier with the gunners' facings, sent to win back a gun we have taken (def.retake: retakeStep)
    gunretaker: { name: "포 되찾는 자", info: ["포병 견장을 단 근위 척탄병. 빼앗긴 포를 되찾으러 온다.", "우리 손에 넘어간 포의 포구 앞 칸으로 곧장 간다. 그 칸이 비어 있으면 닿는 즉시 포가 적의 것으로 돌아가고(남아 있던 시간과 상관없이), 그 자리에 보초로 선다. 누가 서 있으면 평범하게 싸운다. 우리 포가 없으면 보병처럼 걷는다."],
      hp: 2600, atk: 250, def: 200, res: 20, speed: 0.7, interval: 2.2, weight: 1, mass: 2, life: 1, retake: true },
    cuirassier: { name: "말에서 내린 흉갑기병", info: ["돌격이 지나간 자리에 남은 기병. 흉갑을 입어 단단하다.", "돌격이 여러 번 지나간 뒤부터, 줄의 먼 쪽 끝에 남는다."],
      hp: 4800, atk: 520, def: 380, res: 10, speed: 0.7, interval: 2.4, weight: 2, mass: 3, life: 1 },
    kingarmour: { name: "빈 왕좌의 갑주", info: ["대관식용 갑주. 관은 얹혀 있는데 머리가 없다. 셋 몫으로 저지된다. 그가 닿으면, 막고 있던 적을 놓고 그를 붙든다.", "어둠 속에서 쓰러뜨리면 5초 뒤 체력 절반으로 다시 일어난다(두 번까지). 등불 아래에서 끝내야 한다. 둘레 2.2칸의 빈 갑주들은 빨라지고 세진다."],
      hp: 12000, atk: 560, def: 420, res: 20, speed: 0.38, interval: 2.4, weight: 3, mass: 4, life: 3, boss: true, noMul: true, claim: true, revive: { pct: 0.5, delay: 5, n: 2 }, rally: { r: 2.2, speed: 1.2, atk: 1.15 }, lantern: true,
      call: { at: [0.5], darkNear: true } },   // at half his strength the lamp nearest him goes out, once; he calls nobody
    // the eagle-bearer: the Guard's standard, at his own scale (noMul). He plants the eagle in the square and the Guard forms on it: everyone round him marches faster and hits
    // harder; at two thirds and one third of his strength he raises it again — three of the line fall in behind him, and the blizzard blows out of the gate on his signal
    eagle:   { name: "독수리 기수", info: ["근위대의 독수리 군기를 든 거구. 셋 몫으로 저지된다.", "군기의 서리: 받는 피해가 절반이다. 따뜻한 칸의 가사인격에게 막혀 있는 동안에는 풀린다. 군기 둘레 2.4칸의 적은 북소리처럼 빨라지고 세진다. 체력이 2/3, 1/3로 줄 때마다 군기를 치켜들어 뒤따르던 보병 셋을 불러 세우고, 바람이 거꾸로 돌아 눈보라가 불어온다."],
      hp: 13000, atk: 620, def: 400, res: 30, speed: 0.4, interval: 2.2, weight: 3, mass: 4, life: 3, boss: true, noMul: true,
      rally: { r: 2.4, speed: 1.25, atk: 1.2 }, call: { at: [0.66, 0.33], type: "soldier", n: 3, gust: true }, frostGuard: 0.5, patterns: true },   /* the standard raised brings a gust (and, on a stage with wind.flip, turns the wind about); his frost halves what he takes unless one of ours on a warm square holds him; patterns: at each gust he reads the braziers (patternStart) */
    // the bocage: a fowler down in the hedge, unseen until the muzzle flash gives him away
    ambusher:{ name: "매복 엽총수", info: ["생울타리에 숨은 엽총수. 첫 발을 쏘기 전까지는 보이지 않는다.", "총성이 나면 그제야 모습을 드러낸다. 숨어 있는 동안에는 막고 있는 가사인격만 공격할 수 있다."], hp: 900, atk: 230, def: 40, res: 0, speed: 0.55, interval: 2.8, weight: 1, mass: 1, life: 1, ranged: 2.4, ambush: true },
    // ---- chapter 2's own roster, modelled on the original's winter (Yeti Squadron) and Ursus guerrilla foes, at their scale ----
    snowsniper: { name: "설원 저격수", info: ["흰 외투를 두른 저격수. 멀리서 쏘고, 마법에도 잘 버틴다. 얼어붙은 상대를 먼저 노리고, 두 배의 피해를 준다.", "눈보라가 부는 동안에는 모습을 감춘다. 숨어 있는 동안에는 막고 있는 가사인격만 공격할 수 있다."],
      hp: 1500, atk: 480, def: 150, res: 50, speed: 0.8, interval: 2.7, weight: 1, mass: 2, life: 1, ranged: 3.0, phys: true, snowcloak: true, vsFrozen: 2, snowproof: true, rscale: true },   // the ranged rank and file fight at their own scale (rscale: the stage's rmul, not its mul): at full scale any of them is a match for a lone vanguard
    yfang: { name: "설원 사냥개", info: ["눈 위를 달리는 굶주린 개. 아주 빠르다.", "얼어붙은 상대를 물면 공격력이 1.5배가 된다. 눈보라 속에서도 느려지지 않고, 바람을 등지고 달릴 때는 1.4배 빨라진다."],
      hp: 3150, atk: 350, def: 0, res: 30, speed: 1.6, interval: 1.4, weight: 1, mass: 1, life: 1, vsFrozen: 1.5, snowproof: true, tail: 1.4 },
    yrazor: { name: "설원 사냥개 우두머리", info: ["무리를 이끄는 큰 개. 빠르고 질기다.", "얼어붙은 상대를 물면 공격력이 1.5배가 된다. 눈보라 속에서도 느려지지 않고, 바람을 등지고 달릴 때는 1.4배 빨라진다."],
      hp: 4650, atk: 430, def: 0, res: 30, speed: 1.6, interval: 1.4, weight: 1, mass: 2, life: 1, vsFrozen: 1.5, snowproof: true, elite: true, tail: 1.4 },
    chouan: { name: "슈앙 게릴라", info: ["왕당파 게릴라. 덤불과 눈 속을 오래 걸어온 단단한 보병.", "막는 이가 없으면 짧은 사거리의 엽총으로 쏜다."],
      hp: 3300, atk: 330, def: 150, res: 20, speed: 0.93, interval: 2.0, weight: 1, mass: 2, life: 1 },
    // chapter 2's Chouan from IM-02 on: the same man, but he does what his card says — nobody holding him, he stops and lets fly with the fowling piece at short range (IM-01 and TR-03 keep the plain one)
    chouang: { name: "슈앙 게릴라", info: ["엽총을 든 왕당파 게릴라. 오래 걸어온 단단한 보병.", "사거리 1.6칸. 고지의 가사인격도 쏜다."],
      hp: 3300, atk: 330, def: 150, res: 20, speed: 0.93, interval: 2.0, weight: 1, mass: 2, life: 1, ranged: 1.6, phys: true },
    frostgun: { name: "서리 사수", info: ["총신을 얼음으로 감싼 황제군 사수. 얼음 탄을 쏘아 마법 피해를 준다. 사거리 2.6칸.", "맞으면 동상이 쌓인다. 두 번 쌓이면 얼어붙는다. 따뜻한 칸(켜진 화로 곁)의 가사인격에게는 동상이 쌓이지 않는다. 눈보라 속에서도 느려지지 않는다."],
      hp: 1200, atk: 240, def: 100, res: 40, speed: 0.8, interval: 2.4, weight: 1, mass: 2, life: 1, ranged: 2.6, frost: 1, snowproof: true, rscale: true },
    iceguard: { name: "빙갑 근위병", info: ["얼음을 갑옷처럼 두른 근위대의 망령. 방어력과 마법 저항이 모두 매우 높고, 몹시 느리다.", "한 번에 셋을 저지해야 멈춘다. 오래 붙잡아 두고 깎아 내야 한다. 눈보라 속에서도 느려지지 않는다. 따뜻한 칸(켜진 화로 곁)의 가사인격에게 막혀 있는 동안에만 얼음이 녹아 방어력과 마법 저항이 크게 떨어진다."],
      hp: 18000, atk: 820, def: 1000, res: 60, speed: 0.25, interval: 3.2, weight: 3, mass: 4, life: 2, elite: true, snowproof: true, thaw: { def: 0.35, res: 0.5 } },
    /* 2-6's own (recolours): the snow blade, a line soldier in white who is hidden while the blizzard blows (snowcloak), and the guard captain, the ice-clad guard a size up (miniboss: a marker only) */
    snowblade: { name: "설원 습격병", info: ["흰 외투를 두른 근접병.", "눈보라가 부는 동안에는 모습을 감춘다. 숨어 있는 동안에는 막고 있는 가사인격만 공격할 수 있다."],
      hp: 2200, atk: 300, def: 120, res: 10, speed: 0.9, interval: 1.8, weight: 1, mass: 2, life: 1, snowcloak: true, snowproof: true },
    icecaptain: { name: "빙갑 근위대장", info: ["근위대의 지휘관.", "따뜻한 칸의 가사인격에게 막히면 얼음 갑옷이 녹는다."],
      hp: 16000, atk: 700, def: 800, res: 50, speed: 0.3, interval: 3.0, weight: 2, mass: 4, life: 3, elite: true, miniboss: true, snowproof: true, thaw: { def: 0.4, res: 0.5 } },
    /* 2-10 v2's own (recolours, stage.frost): the mortar man who lobs shells from far off at the braziers first (lob: the shell lands on the square and the four beside it; siege: he stands while something is in reach),
       the standard bearer who never fights but lifts every other foe's attack and defence while he lives, anywhere (aura, stacking), and the frost marshal, a second mid-boss who makes the blizzard bite harder (stormMul) */
    mortar: { name: "박격포병", info: ["아주 먼 곳에서 포탄을 던진다. 화로부터 노린다.", "물리 피해. 사거리 6칸. 떨어진 칸과 그 상하좌우 칸을 함께 친다. 사거리 안에 무언가 있으면 멈춰 서서 쏜다."],
      hp: 2600, atk: 520, def: 150, res: 0, speed: 0.5, interval: 5.0, weight: 1, mass: 2, life: 1, ranged: 6.0, splash: 1.0, lob: true, siege: true, fireFirst: true, phys: true },
    standard: { name: "군기병", info: ["살아 있는 동안 모든 적의 공격력과 방어력을 올린다. 거리는 상관없다.", "직접 공격하지 않는다. 군기병 하나당 다른 모든 적의 공격력과 방어력 +15%, 겹쳐 쌓인다."],
      hp: 3800, atk: 0, def: 300, res: 20, speed: 0.45, interval: 2.0, weight: 1, mass: 2, life: 1, noFight: true, aura: { atk: 0.15, def: 0.15 } },
    frostmarshal: { name: "서리 원수", info: ["근위대를 거느린 서리의 원수.", "그가 살아 있는 동안 눈보라가 가사인격에게 주는 피해가 1.25배가 된다."],
      hp: 22000, atk: 800, def: 900, res: 50, speed: 0.28, interval: 3.2, weight: 3, mass: 5, life: 3, elite: true, miniboss: true, snowproof: true, stormMul: 1.25 },
    molotov: { name: "슈앙 화염병 투척병", info: ["독한 술병에 불을 붙여 던지는 반란군. 저지를 무시하고 2.5칸 안으로 던지며, 터진 자리와 바로 옆 칸에 마법 피해를 준다. 던지기 전 1초 동안 목표 위에 불꽃 표시가 뜬다.", "얼어붙은 가사인격을 먼저 노린다. 얼어 있는 상대가 맞으면 얼음이 녹으며 0.8초 동안 4번, 매번 최대 체력의 20%만큼 고정 피해를 입는다. 병이 꺼진 화로 바로 곁에서 터지면 그 화로에 불이 붙는다."],
      hp: 950, atk: 300, def: 60, res: 10, speed: 0.85, interval: 7, weight: 1, mass: 1, life: 1, ranged: 2.5, aim: 1.0, splash: 1.0, melt: { n: 4, pct: 0.2, gap: 0.2 }, rscale: true },
    chxelite: { name: "슈앙 명사수", info: ["오래 싸워 온 왕당파 명사수. 처음부터 길목을 차지하고 버틴다. 웬만한 선봉은 맞붙어도 이긴다.", "물리 피해. 사거리 2.4칸. 근위나 중장으로 붙거나, 둘 이상이 함께 덤벼야 한다."],
      hp: 2000, atk: 560, def: 120, res: 30, speed: 0.85, interval: 2.4, weight: 1, mass: 2, life: 1, ranged: 2.4, phys: true, elite: true, noMul: true },
    /* the long rifle (2-5, a marksman recoloured): he stands on the last steps before the point and shells whoever of ours stands on the ground, far across the hill; he cannot aim up at a rise (def.groundOnly) */
    chxlong: { name: "슈앙 장총수", info: ["긴 강선총을 받쳐 놓고 쏘는 왕당파 저격수. 방어 지점 앞에 자리를 잡고 서서, 언덕 건너편까지 쏜다.", "물리 피해. 사거리 4.3칸. 지상에 선 가사인격만 노리고(가장 나중에 선 쪽부터), 고지는 겨누지 못한다. 정해진 때가 되면 뒤쪽부터 하나씩 일어나 방어 지점으로 걸어 들어간다. 그 전에 쓰러뜨리자."],
      hp: 5200, atk: 300, def: 110, res: 20, speed: 0.6, interval: 3.4, weight: 1, mass: 2, life: 1, ranged: 4.3, phys: true, elite: true, noMul: true, groundOnly: true },
    chxbow: { name: "슈앙 엽총수", info: ["왕당파 엽총수. 길을 걸으며 가사인격부터 쏜다.", "물리 피해. 사거리 2.4칸."],
      hp: 1300, atk: 420, def: 110, res: 20, speed: 0.85, interval: 2.3, weight: 1, mass: 2, life: 1, ranged: 2.4, phys: true, rscale: true },
    yshield: { name: "설원 중장병", info: ["얼음을 덧댄 큰 방패를 든 중장병. 느리지만 아주 단단하다.", "눈보라가 부는 동안에는 얼음 갑주가 두꺼워져 방어력이 1.5배가 된다. 불 곁의 가사인격에게 막혀 있으면 얼음 갑주가 녹아 방어력이 크게 떨어진다."],
      hp: 7000, atk: 520, def: 900, res: 30, speed: 0.5, interval: 2.6, weight: 1, mass: 3, life: 1, iceArmor: 1.5, snowproof: true, thaw: { def: 0.4 } },
    // the winter's own: frost that sticks, the white that hides, the cold that maddens, and bombs of ice from the air
    frosthound: { name: "서리 사냥개", info: ["얼음 송곳니를 가진 사냥개. 물리면 몸이 굳는다(동상).", "동상은 공격 속도를 늦추고, 두 번 쌓이면 얼어붙어 잠시 아무것도 못 하게 된다. 얼어붙은 상대는 더 깊이 문다(피해 1.5배).", "눈보라 속에서도 느려지지 않는다."], hp: 950, atk: 200, def: 30, res: 20, speed: 1.6, interval: 1.4, weight: 1, mass: 1, life: 1, frost: 1 , vsFrozen: 1.5, snowproof: true },
    frostmage: { name: "서리 술사", info: ["냉기를 쏘는 망령 술사. 마법 피해를 준다.", "맞으면 동상이 쌓인다. 두 번 쌓이면 얼어붙는다."], hp: 1300, atk: 210, def: 60, res: 40, speed: 0.6, interval: 2.6, weight: 1, mass: 2, life: 1, ranged: 2.2, frost: 1 , snowproof: true },
    icestalker: { name: "설원 척후병", info: ["흰 망토를 두른 척후병. 얼음 위에 서 있으면 보이지 않는다.", "얼음 위에 숨어 있는 동안에는 막고 있는 가사인격만 공격할 수 있다. 얼음을 벗어나면 드러난다."], hp: 1500, atk: 260, def: 120, res: 10, speed: 0.8, interval: 1.6, weight: 1, mass: 2, life: 1, iceHide: true , snowproof: true },
    berserk: { name: "동상 광인", info: ["추위에 미쳐 버린 병사. 체력이 계속 줄어든다.", "대신 시간이 갈수록 공격력과 공격 속도가 미쳐 날뛴다. 눈보라를 맞는 동안에는 세 배로 빨리, 더 높이 미쳐 오른다. 따뜻한 칸의 가사인격에게 막히면 가라앉는다(광기도, 체력이 줄어드는 것도 멈춘다)."], hp: 3600, atk: 260, def: 80, res: 0, speed: 0.75, interval: 1.6, weight: 1, mass: 2, life: 1, frenzy: { drain: 0.025, rate: 0.06, cap: 1.5, wind: { rate: 3, cap: 2.5 } } },
    bomber: { name: "얼음폭탄 드론", info: ["얼음 폭탄을 매단 드론(명일방주의 밤테일 기준). 근거리 가사인격은 막을 수 없다. 천천히 날아온다.", "가사인격이 사거리(2칸) 안에 들어오면 폭탄을 한 번 던진다. 폭탄은 목표와 주변 0.8칸 안의 모두에게 공격력 100%의 물리 피해를 주고 동상을 쌓는다. 던지고 나면 이동 속도가 두 배가 된다. 던지기 전에 떨어뜨리자.", "켜진 화로가 사거리 안에 있으면 가사인격보다 먼저 화로에 던진다. 화로는 꺼지고 둘레의 가사인격에게 동상이 쌓인다. 꺼진 화로는 그 옆에 새로 세운 가사인격이 5초 버티면 다시 붙는다."],
      hp: 4000, atk: 800, def: 150, res: 30, speed: 0.51, interval: 99, weight: 1, mass: 0, life: 1, flying: true,
      bomber: { range: 2, r: 0.8, mul: 1, frost: 1, fall: 0.9, arm: 0.6, dash: 2 } },
    // the straggler by the fire (chapter 2, a straggler recoloured): a lit brazier within ember.see, and he leaves the road to sit on a warm ground square beside it (def.ember: emberStep)
    emberstrag: { name: "불 쬐는 낙오병", info: ["모스크바 퇴각 행렬에서 처진 병사. 불만 보면 주저앉는다. 싸우지 않는다.", "켜진 화로가 4칸 안에 있으면 길을 벗어나 그 화로가 데우는 빈 지상 칸에 주저앉는다. 앉아 있는 동안 그 칸에는 가사인격을 세울 수 없다. 화로가 꺼지거나 60초가 지나면 일어나 방어 지점으로 달려간다."],
      hp: 1400, atk: 130, def: 0, res: 0, speed: 0.42, interval: 2.0, weight: 1, mass: 1, life: 1, ember: { see: 4, run: 1.2, max: 60 }, noFight: true },
    // the frost sack (chapter 2, a line soldier recoloured): a sack of snow and ice on his back; when he falls it bursts over the braziers and men beside him (def.douse)
    frostsack: { name: "서리 자루병", info: ["눈과 얼음을 자루에 가득 지고 오는 보병.", "쓰러지면 자루가 터져, 1.5칸 안의 화로를 끄고 둘레의 가사인격에게 동상을 쌓는다. 불에서 먼 곳에서 잡자."],
      hp: 2000, atk: 220, def: 120, res: 0, speed: 0.85, interval: 2.0, weight: 1, mass: 2, life: 1, douse: { r: 1.5, frost: 1 } },
    // the infernal machine (rue Saint-Nicaise, 1800): a cart with a barrel of powder, rolled on until it bursts — over everyone near it
    cart:    { name: "지옥 기계", info: ["화약통을 실은 수레. 공격하지 않고 그저 굴러온다. 덮개를 씌워, 한 번 막히기 전까지는 고지에서 쏘는 공격에 30%만 다친다.", "부서지거나, 막힌 채 도화선이 다 타면 터진다. 주위의 적과 아군을 가리지 않는다. 적에게는 훨씬 큰 피해를 준다. 눈보라가 부는 동안에는 도화선이 타지 않는다. 터지면 2칸 안의 꺼진 화로가 다시 붙는다."], hp: 2600, atk: 0, def: 300, res: 60, speed: 0.36, interval: 99, weight: 2, mass: 4, life: 1, bomb: { r: 1.45, dmg: 1100, fuse: 3.5, foe: 2.4, windStop: true, relight: 2.0 }, cover: 0.3 },   // foe: packed for the column it was meant for — their own men take it far worse than ours
    // Marshal Ney: the sniper who never misses. Unseen on his perch at first, then down the road shooting as he walks;
    // every third round is a heavy one, and each time he is cut down a third he sweeps the field and puts three rounds into whoever stands furthest forward
    ney:     { name: "미셸 네", hp: 26000, atk: 600, def: 380, res: 30, speed: 0.34, interval: 2.6, weight: 2, mass: 4, life: 3, boss: true,
      sniper: { every: 3, strong: 2.0, aim: 0.9 }, stealth: { reveal: 16 }, perch: { at: [1, 3], until: 36 },
      scan: { at: [2 / 3, 1 / 3], sweep: 2.4, gap: 0.45, mark: 0.75, near: 0.08 } },
    /* ---- chapter 4 「발푸르기스의 밤」 (E04): the roofs on the witches' night. Every figure is an existing one recoloured (see EN_POSED / EN_TINT / AIR_ART in the page).
       The abilities below are read only by the chapter-4 code (ch4Init / ch4Step / ch4Hit / ch4Taken), which runs only on a stage with stage.ch4 */
    lemure: { name: "레무르", info: ["잿빛 망령. 느리고 약하지만 떼로 온다.", "다리가 끊긴 지붕에 갇히면 남보다 일찍(20초) 뛰어넘는다."],
      hp: 1300, atk: 170, def: 60, res: 0, speed: 0.55, interval: 2.0, weight: 1, mass: 1, life: 1, leapAfter: 20 },
    roofcat: { name: "지붕 고양이", info: ["검은 고양이. 아주 빠르다. 세 번째 공격마다 상처를 남겨 4초 동안 피를 흘리게 한다.", "천창(땅굴)을 타고 배치 칸을 건너뛰기도 한다."],
      hp: 1100, atk: 210, def: 20, res: 20, speed: 1.6, interval: 1.3, weight: 1, mass: 1, life: 1, bleed: { every: 3, dur: 4, pct: 0.3 } },
    wisp: { name: "도깨비불", info: ["푸른 불덩이. 저지되는 순간 터져 둘레의 가사인격에게 마법 피해를 준다.", "저지하지 않고 쏘아 떨어뜨리면 터지지 않는다."],
      hp: 900, atk: 0, def: 0, res: 50, speed: 1.3, interval: 99, weight: 1, mass: 1, life: 1, burst: { r: 1.2, dmg: 450 } },
    crow: { name: "까마귀 사역마", info: ["마녀의 까마귀. 날아다녀서 다리가 필요 없고, 근거리 가사인격은 막을 수 없다.", "유이부터 노린다."],
      hp: 900, atk: 260, def: 30, res: 30, speed: 1.1, interval: 1.6, weight: 0, mass: 0, life: 1, flying: true, vipFly: true },
    broom: { name: "빗자루 마녀", info: ["빗자루를 탄 마녀. 공격할 때마다 막아선 가사인격을 넘어 그 뒤로 내려앉는다.", "한 겹의 저지로는 멈추지 않는다. 두 겹째를 세워 두자."],
      hp: 2400, atk: 300, def: 80, res: 30, speed: 0.85, interval: 2.0, weight: 1, mass: 2, life: 1, hopBlock: { dist: 1.25, grace: 1.5 } },
    pickpocket: { name: "소매치기", info: ["붉은 두건의 소매치기. 사거리 2.2칸. 사거리 안의 유이를 먼저 쏜다.", "세 번째로 맞힐 때마다 코스트 1을 가져간다."],
      hp: 1300, atk: 230, def: 60, res: 10, speed: 0.75, interval: 2.4, weight: 1, mass: 1, life: 1, ranged: 2.2, phys: true, rscale: true, vipFirst: true, stealCost: { every: 3, n: 1 } },
    dancer: { name: "연기 두른 춤꾼", info: ["흰 가면의 춤꾼. 빠르다. 연기 다리를 건너면 12초 동안 연기를 둘러 보이지 않는다(막고 있는 가사인격만 칠 수 있다).", "축제의 불꽃이 터지면 드러난다."],
      hp: 1700, atk: 260, def: 80, res: 10, speed: 1.15, interval: 1.4, weight: 1, mass: 2, life: 1, cloak: { dur: 12 } },
    clown: { name: "불 뿜는 광대", info: ["연기를 두른 채 오는 광대. 숨어 있는 동안은 걷기만 하고 공격하지 않는다.", "축제로 드러나면 사거리 2.5칸에서 불을 뿜는다(마법 피해). 드러내지 말고 막아서 잡는 것도 방법이다."],
      hp: 2600, atk: 320, def: 100, res: 30, speed: 0.7, interval: 2.6, weight: 1, mass: 2, life: 1, ranged: 2.5, cloak: { dur: 12, start: true }, seenOnly: true },
    paperlamp: { name: "풍등", info: ["떠서 지나가기만 하는 종이 등. 공격하지 않고, 지나가도 목숨이 줄지 않는다.", "축제 중에 떨어뜨리면 가까운 시민의 공포가 가라앉는다."],
      hp: 1000, atk: 0, def: 0, res: 0, speed: 0.5, interval: 99, weight: 0, mass: 0, life: 0, flying: true, festCalm: { r: 2.5, by: 30 } },
    skulker: { name: "검댕 도둑", info: ["검댕을 뒤집어쓴 도둑. 연기 다리를 건너면 12초 동안 보이지 않는다.", "판 위에 있는 동안 코스트 회복이 25% 느려진다(여럿이면 겹친다)."],
      hp: 1800, atk: 200, def: 100, res: 10, speed: 0.85, interval: 2.0, weight: 1, mass: 2, life: 1, cloak: { dur: 12 }, costRegen: 0.25 },
    cauldron: { name: "가마솥", info: ["걸어 다니는 무쇠 가마솥. 느리고 아주 단단하며 둘 몫으로 저지된다. 처음 막아선 가사인격을 삼키고 코스트 3을 가져간다.", "15초 안에 쓰러뜨리면 삼킨 가사인격이 체력 절반으로 그 자리에 돌아온다."],
      hp: 4500, atk: 350, def: 400, res: 20, speed: 0.4, interval: 3.0, weight: 2, mass: 3, life: 1, swallow: { cost: 3, window: 15 } },
    sharpshooter: { name: "집회 사수", info: ["검붉은 옷의 석궁 사수. 사거리 2.8칸. 사거리 안의 유이를 먼저 쏜다.", "네 번째 화살은 맞은 칸과 그 상하좌우를 함께 맞히고, 맞은 수만큼 코스트를 가져간다."],
      hp: 1700, atk: 380, def: 100, res: 30, speed: 0.7, interval: 2.8, weight: 1, mass: 2, life: 1, ranged: 2.8, phys: true, rscale: true, vipFirst: true, cross: { every: 4 } },
    stallwitch: { name: "노점 마녀", info: ["장터 천을 두른 큰 마녀. 셋 몫으로 저지되고, 무거워서 밀려 떨어지지 않는다. 12초마다 도깨비불을 하나 내놓는다.", "축제가 아닐 때는 받는 피해가 70% 줄어든다."],
      hp: 9000, atk: 400, def: 300, res: 30, speed: 0.35, interval: 2.8, weight: 3, mass: 4, life: 1, festOnly: 0.3, summon: { type: "wisp", every: 12 } },
    shadow: { name: "브로켄의 그림자", info: ["산꼭대기의 거대한 그림자. 셋 몫으로 저지되고 밀려 떨어지지 않는다.", "열린 굴뚝에서 2칸 안이나 연기 다리 위(연기 속)에서는 피해를 받지 않는다. 굴뚝을 막아 다리를 끊으면 연기 밖에 선다."],
      hp: 12000, atk: 600, def: 350, res: 30, speed: 0.4, interval: 2.8, weight: 3, mass: 4, life: 2, elite: true, smokeProof: 2 },
    acolyte: { name: "종복 사제", info: ["검은 옷의 사제. 마법으로 친다.", "판 위에 있는 동안 코스트 상한이 10 줄어든다(여럿이면 겹친다)."],
      hp: 2600, atk: 280, def: 100, res: 40, speed: 0.75, interval: 2.0, weight: 1, mass: 2, life: 1, artsMelee: true, costCap: 10 },
    float: { name: "가장행렬 수레", info: ["꽃으로 꾸민 큰 수레. 셋 몫으로 저지되고, 몇 초마다 내달려 막아선 가사인격에게 크게 부딪친다.", "축제가 아닐 때는 받는 피해가 70% 줄어든다."],
      hp: 5500, atk: 450, def: 250, res: 20, speed: 0.9, interval: 2.2, weight: 3, mass: 4, life: 1, festOnly: 0.3, charge: { every: 8, dur: 1.2, mult: 2.0, hit: 2.5 } },
    magicshot: { name: "마탄 사수", info: ["은빛 총의 사수. 탄은 여섯 발뿐이고, 한 발 한 발이 멀리서 크게 들어온다(사거리 4.5칸). 사거리 안의 유이를 먼저 쏜다.", "연기 다리 바로 곁에 선 상대에게는 절반이 빗나간다."],
      hp: 4000, atk: 700, def: 150, res: 30, speed: 0.6, interval: 4.0, weight: 1, mass: 2, life: 1, ranged: 4.5, phys: true, elite: true, vipFirst: true, ammo: 6, missNear: 0.5 },
    lantchild: { name: "불씨 든 아이", info: ["불씨를 든 시민 아이. 적이 아니다. 아무도 이 아이를 공격하지 않고, 다치지도 않는다.", "가장 가까운 점화구로 가서 도화선에 불을 붙이고 돌아간다. 20초 동안 막혀 있으면 그냥 돌아간다."],
      hp: 1000, atk: 0, def: 0, res: 0, speed: 0.7, interval: 99, weight: 1, mass: 1, life: 0, child: true, invuln: true, giveUp: 20 },
    volland: { name: "융커 볼란트", info: ["붉은 깃털 모자의 신사. 죽지 않고 막히지 않으며, 밤공기 위도 걸어 유이에게 곧장 온다. 지나가며 닿은 가사인격은 6초 동안 침묵한다. 판에 있는 동안 10초마다 시민 하나를 부른다.", "축제의 불꽃이 터지는 순간 그가 연기 밖(열린 굴뚝 바로 둘레 밖, 다리 밖)에 있으면 관심이 한 칸 깎이고 물러난다. 세 칸을 다 깎으면 떠난다. 유이에게 닿으면 그녀가 크게 다치고, 그는 물러났다가 다시 온다."],
      hp: 99999, atk: 0, def: 0, res: 0, speed: 0.32, interval: 99, weight: 9, mass: 9, life: 0, boss: true, noMul: true, invuln: true, flying: true, volland: { land: 4, reach: 0.34, call: 10, callFear: 0.25, silence: 6, smoke: 1 } },
    /* ---- chapter 5 「악마의 트릴」 (E05): the devil's orchestra on the beat. Every figure is an existing one recoloured (EN_POSED / EN_TINT / EN_ART in the page).
       def.c5 holds the abilities, read only by the chapter-5 code (ch5Init / ch5Step / ch5Strike / ch5Taken ...), which runs only on a stage with stage.ch5.
       "fast" / "slow" below: the tempo of the zone the foe stands in. down: what its attack on the fourth beat of its zone's bar does */
    vghost: { name: "바이올린 망령", info: ["검은 연미복의 망령 악사. 박마다 한 칸씩 걷는다.", "마디의 넷째 박에 켜는 활은 1.8배로 들어간다."],
      hp: 1700, atk: 210, def: 100, res: 0, speed: 0.85, interval: 2.0, weight: 1, mass: 2, life: 1, c5: { down: { mul: 1.8 } } },
    offhound: { name: "엇박 사냥개", info: ["은빛 사냥개. 박과 박 사이(반 박)에 뛴다.", "쉼표 칸에서도 서지 않는다."],
      hp: 1100, atk: 220, def: 20, res: 20, speed: 1.0, interval: 1.3, weight: 1, mass: 1, life: 1, c5: { offbeat: true } },
    trumpet: { name: "트럼펫", info: ["놋쇠 나팔을 든 악단원. 넷째 박에 맞은 칸과 그 상하좌우를 함께 친다.", "빠른 구역에서는 마법 피해가 된다."],
      hp: 2300, atk: 290, def: 150, res: 0, speed: 0.85, interval: 2.0, weight: 1, mass: 2, life: 1, c5: { down: { cross: true }, fastArts: true } },
    horn: { name: "호른", info: ["놋쇠 호른 주자. 사거리 1.5칸의 원거리. 넷째 박에는 둘을 친다.", "빠른 구역에서는 마법 피해가 된다."],
      hp: 1500, atk: 270, def: 100, res: 20, speed: 0.8, interval: 2.2, weight: 1, mass: 2, life: 1, ranged: 1.5, phys: true, rscale: true, c5: { down: { extra: 1 }, fastArts: true } },
    busker: { name: "거리 악사", info: ["줄무늬 조끼의 거리 악사. 사거리 1.9칸의 원거리.", "흐름 밖에 선 가사인격은 두 번 친다."],
      hp: 1600, atk: 250, def: 80, res: 20, speed: 0.8, interval: 2.2, weight: 1, mass: 2, life: 1, ranged: 1.9, phys: true, rscale: true, c5: { offFlux: { hits: 2 } } },
    drunk: { name: "취객 관객", info: ["붉은 얼굴의 취객. 빠르다(박마다 두 칸).", "흐름 밖에 선 가사인격에게는 마법 피해가 더 들어간다."],
      hp: 1900, atk: 230, def: 60, res: 0, speed: 1.3, interval: 1.3, weight: 1, mass: 2, life: 1, c5: { offFlux: { arts: 0.6 } } },
    cello: { name: "첼로", info: ["나뭇결 빛깔의 거대한 악기 망령. 둘 몫으로 저지되고, 느리며 아주 단단하다. 무거워서 밀려 떨어지지 않는다.", "흐름 위에 있는 동안만 방어와 마법 저항이 꺾인다."],
      hp: 8000, atk: 480, def: 900, res: 50, speed: 0.4, interval: 3.0, weight: 2, mass: 4, life: 1, c5: { fluxWeak: { def: 0.2, res: 0.3 } } },
    organ: { name: "오르간 주자", info: ["보랏빛 오르간 주자. 사거리 2.2칸의 마법. 한 번에 둘을 친다.", "흐름 밖에 선 대상에게는 둘레 한 칸까지 번진다."],
      hp: 1800, atk: 280, def: 80, res: 40, speed: 0.7, interval: 2.6, weight: 1, mass: 2, life: 1, ranged: 2.2, rscale: true, c5: { two: true, offFlux: { splash: 0.6 } } },
    violin1: { name: "제1 바이올린", info: ["흰 연미복의 수석 바이올린. 사거리 3칸의 원거리.", "흐름 위에 서 있으면 넷째 박마다 그 흐름 줄에 선 가사인격 전부를 벤다. 조율기의 방패 면에서 멈춘다."],
      hp: 2400, atk: 360, def: 120, res: 40, speed: 0.6, interval: 3.4, weight: 1, mass: 2, life: 1, ranged: 3.0, phys: true, rscale: true, c5: { fluxChain: true } },
    timpani: { name: "팀파니", info: ["구릿빛 북을 멘 고수. 넷째 박에 둘레 한 칸 전체를 친다.", "빠른 구역에서는 둘레 두 칸까지 넓어진다."],
      hp: 2200, atk: 250, def: 120, res: 20, speed: 0.7, interval: 2.4, weight: 1, mass: 2, life: 1, c5: { down: { aoe: 1 }, fastAoe: 1 } },
    prima: { name: "프리마돈나", info: ["흰 드레스의 가수. 걷지 않고 제자리에서 노래한다. 한 소절(여덟 박)을 마칠 때마다 판 위의 적 전부를 회복시킨다.", "기절하면 소절이 처음부터 다시. 느린 구역에서는 소절이 길어진다. 막이 내리면(190초) 무대를 내려와 걷는다."],
      hp: 4200, atk: 0, def: 150, res: 40, speed: 0.5, interval: 99, weight: 1, mass: 2, life: 2, noFight: true, c5: { phrase: { beats: 8, pct: 0.12 } } },
    heckler: { name: "야유꾼", info: ["야회복의 야유꾼. 공격력은 없다. 사거리 2.5칸 안의 흐름 위에 선 가사인격을 골라 한 마디 동안 기절시킨다.", "그 칸에서 흐름이 8초 동안 끊긴다(그 뒤로는 흐름 밖)."],
      hp: 1800, atk: 0, def: 60, res: 30, speed: 0.8, interval: 99, weight: 1, mass: 1, life: 1, noFight: true, c5: { heckle: { r: 2.5, every: 8, cut: 8 } } },
    crescendo: { name: "크레셴도", info: ["금빛 나팔의 망령. 저지되지 않고 걸은 칸마다 공격력이 오르고(머리 위 숫자), 첫 일격에 다 쏟는다.", "느린 구역에서 맞은 그 일격은 한 마디 동안 기절시킨다. 가벼워서 잘 밀린다."],
      hp: 1500, atk: 160, def: 60, res: 0, speed: 0.85, interval: 1.6, weight: 1, mass: 1, life: 1, c5: { cres: { per: 0.15, cap: 40 }, slowStun: true } },
    contrabass: { name: "콘트라베이스", info: ["검은 나무빛의 거대한 현악기 망령. 무겁다. 넷째 박에 자기 칸의 가로줄과 세로줄 전체를 친다.", "흐름이 지나는 칸에서 그 줄 공격이 막힌다."],
      hp: 6000, atk: 420, def: 500, res: 20, speed: 0.45, interval: 3.0, weight: 2, mass: 4, life: 1, c5: { lineShot: true } },
    kapell: { name: "악장", info: ["검은 연미복의 악장(정예). 저지되지 않는다. 지나가며 한 칸 둘레의 둘을 한꺼번에 친다.", "지나간 칸에 8초 동안 잔향이 남아 그 칸에는 새로 배치할 수 없다(이미 선 가사인격은 그대로)."],
      hp: 7000, atk: 400, def: 300, res: 30, speed: 0.6, interval: 2.4, weight: 1, mass: 3, life: 2, elite: true, unblockable: true, ranged: 1.5, phys: true, c5: { two: true, residue: 8 } },
    tuner5: { name: "조율사", info: ["회색 작업복의 조율사. 공격력은 없다. 사거리 2.2칸 안의 조율기나 메트로놈 지킴이를 음소거한다(그 동안 조율기는 꺼지고, 지킴이는 메트로놈에 영향이 없다).", "음소거하는 동안은 그 자리에 선다."],
      hp: 2200, atk: 0, def: 150, res: 20, speed: 0.7, interval: 99, weight: 1, mass: 2, life: 1, noFight: true, c5: { mute: { r: 2.2 } } },
    echo: { name: "메아리", info: ["푸른 유리빛의 빈 갑주. 가사인격의 공격을 먼저 받는다(도발).", "마디의 첫 박에 받은 피해를 때린 쪽에 그대로 돌려준다. 느린 구역에서는 첫 박이 길다."],
      hp: 3400, atk: 290, def: 380, res: 20, speed: 0.6, interval: 2.4, weight: 1, mass: 3, life: 1, taunt: true, c5: { reflect: 1 } },
    ariel: { name: "대공 아리엘", info: ["흰 가발의 대공. 싸우지 않는다. 지휘단 위에서 네 악장 열여섯 마디의 곡을 지휘한다. 칠 수 없고 닿을 수 없다.", "네 구역이 모두 느린 채로 한 마디(8초)가 지나면 줄 하나가 끊긴다(악장마다 하나). 곡이 끝날 때 줄이 남아 있으면 목숨이 전부 빠진다."],
      hp: 99999, atk: 0, def: 0, res: 0, speed: 0, interval: 99, weight: 9, mass: 9, life: 0, boss: true, noMul: true, flying: true, noFight: true, c5: { ariel: true } },
    ear: { name: "대공의 귀", info: ["귀 모양의 그림자. 공격하지 않고 칠 수 없으며, 방어 지점에 닿지 않는다. 마디마다 두 칸씩 판을 가로지른다.", "둘레 2칸 안의 가사인격이 첫 박이 아닌 때에 스킬을 쓰면(자동 발동 포함) 불협이 1 오른다."],
      hp: 99999, atk: 0, def: 0, res: 0, speed: 0, interval: 99, weight: 0, mass: 0, life: 0, noMul: true, flying: true, noFight: true, c5: { ear: { r: 2 } } },
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
  const STORM_SPAN = 1e4, LAMP_HP = { calm: 3, reach: 1.2 };
  /* the eagle's two patterns (def.patterns, 2-10): split: the braziers' share of health that picks A (at or over) or B (under); A: warmth reach, our burn a second (share of max HP, arts),
     the share of his max HP that must come off him to end it; B: what a frozen operator loses a second, the freeze-over clock, squares per freeze, reach round him, the squares kept clear round a point, the thaw after */
  const PAT = { split: 0.5, reach: 2.5, burn: 0.015, breakAt: 0.05, frozen: 0.06, iceEvery: 4, iceN: 2, iceR: 2.5, iceSafe: 1.5, thaw: 2 };   /* the endless gust is kept this far from its end; a struck brazier mends only after calm s unstruck; foes this near a lit brazier strike it */
  const FROST_LOSE = "모든 화로가 꺼졌습니다. 얼어붙었습니다.";
  const FRZ = { unfog: 1.5, clear: 3, finalDps: 0.06, cost: 10, hp: 900, cd: 4, warm: 1 };   /* stage.frost (2-10 v2): the fog's fade, the clearing's length, the final storm's own damage and the brazier feed when the stage leaves them out */
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
    gallows: [ // IM-05 (drawn by 유진 in the map editor, 2026-11-13): four pieces of road that only the tunnels join. Top left: the long road from (2,1) down a two-wide block and round to the point from below.
               // Top middle: the short road from (10,1). Right: a dead end from (13,3) that ends in a tunnel mouth. Bottom left: a strip where what went under on the right comes up, walks four squares past the rise (1,5), and goes under again.
               // Tunnels (stage.tunnels): (4,1)>(5,3), (5,5)>(7,7), (12,6)>(2,6), (0,4)>(9,6). Ground squares: (5,2) (4,4) (6,6) (9,2) (12,5); rises: (1,5) (11,5). The last steps to the point (7,4), (8,5), (8,6), (9,6) take nobody
      "################",
      "##S,,####,S#####",
      "###,,.#,,.######",
      "####,,#,####,S##",
      ",###.,#,B###,###",
      ",h###,,#,##h.###",
      ",,,###.,,,##,###",
      "#######,########",
    ],
    camp: [    // parked (the stage before the designer's own board): IM-05: the rebels' camp on the execution hill (the loop road of the original's 5-3 / 4-4 laid round a hill). The hill top (#) is ringed by rises; the scaffold with
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
    street: [  // parked (IM-06 now plays on square6). IM-06: rue Saint-Nicaise (the one long lane of the original's 1-7, with a side square). The street is two rows: the roadway (y=3) and the doorsteps above it (y=2),
               // under the balconies (the rises). The east gate is at the far end, our defence point at the west end. The fountain square (5..11, 0..1) opens off the north side: the carts
               // come down the alley at (6,0) and go round the fountain (W) by the west or the east; the back alley (6,5) comes up from the south into the middle of the street
      "######S,,,,###",
      "#h#hh,.,W,.,h#",
      "#.,.,,,.,,,.,#",
      "B,.,,.,,,.,,,S",
      "#.h.h#.#h#.h.#",
      "######S#######",
    ],
    square6: [  /* IM-06 (2-6): the fountain square of rue Saint-Nicaise. One gate in the middle (8,3), our point at the west end (4,3); three braziers (5,2) (7,5) (10,5).
                   The guard drops into the middle and stands on the squares round the gate, then walks to the point, the outermost first. The street map above is parked */
      "########,#####",
      "######h,,,hh##",
      "#####F.,,,,,h#",
      "####B,.,S,,.,#",
      "#####h,,,.,h##",
      "#####WhF,,FW##",
      "########,h####",
    ],
    detour: [  // IM-07 (the designer's own, reworked in the map editor from a reference board, 2026-11-13): one gate (0,4), two points (8,1) (9,1). The high road runs east along row 4 over the mud
               // and turns north to the points. The long way round turns south at (2,4), goes under at (0,6), comes up at (0,1), walks the top row, goes under again at (6,1), comes up at (4,6)
               // and walks the bottom row past the brazier's square (7,6) and up the right side. Raised walls shelter (5,5) (6,5) (8,5) from the west wind; the brazier (7,5) keeps the mud square (7,4) warm
      "###########",
      ",,,,,.,#BB#",
      "#x,W,x#W,,#",
      "##W#W,WW,,#",
      "S,,,.~~~,,#",
      "##,#Wh.Fh,#",
      ",,,#,,,.,,#",
      "###########",
    ],
    shadow: [  // parked for 2-7 (still the story stage IM-ST1's board): the crossroads (the two parallel roads of the origi the crossroads (the two parallel roads of the original's annihilation maps, with a spine of high ground between them). The north road (y=1-2) and the south
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
      "B,,#F,,,,,.,,#",
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
    /* IM-10 as it was until 2026-11-18: parked, no stage uses it (IM-10 now plays on frostgate) */
    gate: [    // IM-10: the square before the city gate (the two lanes and central high ground of the original's annihilation 1, Chernobog). The gate opens between its towers (W, x=12)
               // onto two roads (y=2 and y=4) that cross the square to the defence point in the west; the monument (4,3)/(7,3) with its steps (the rises) stands between them (a brazier F at each end), and the
               // gate's throat (10,3) joins them. The side streets bring the carts down from the north (5,0) and up from the south (5,6). The wind blows out of the gate, down both roads
      "#####S,,######",
      "#h,.,,.,h,.hW#",
      "#,.,.,,.,,.,,S",
      "B,,hFhhFh,.,W#",
      "#,.,.,,.,,.,,S",
      "#h,.,,.,h,.hW#",
      "#####S,,######",
    ],
    /* IM-10 v2 (2026-11-18, the frost stage): the square before the capital's gate, 19x11. The defence point B (9,5); the first brazier (9,3) under the wall north of it.
       Phase 0 opens the middle and its two gates (5,3), (13,7); phase 1 turns those into braziers and opens the ring with gates (3,5), (15,5), (9,1); phase 2 turns those into braziers,
       opens the wall (9,7), closes (3,3) and (15,7), digs a tunnel (2,8)>(8,8) and opens the seven outer gates. The phases are in stage.frost.phases */
    frostgate: [
      "########SWS########",
      "#Wh,,,,,,S,,,,,,hW#",
      "S,,,WhW.,W,.WhW,,,S",
      "#WW,WS.,.F.,.hW,WW#",
      "#h.,,,,,,.,,,,,,.h#",
      "W..S,,.,.B.,.,.S..W",
      "#h.,,,,,,.,,,.,,.h#",
      "#WW,Wh.,.W.,.SW,WW#",
      "S,,,WhW.,,,.WhW,,,S",
      "#Wh,,,,,,,,,,,,,hW#",
      "#########S#########",
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
    // chapter 3, third cut (2026-11-13): the rampart boards. T a wall top ours may stand on, m a wall top nobody of ours stands on, H a ladder, x a low fence.
    // Every foe on foot climbs here (stage.climbAll). Tunnel mouths are plain road; the stage's `tunnels` joins them
    wl1: [   // WL-01: the hill maze: the point in the middle, three gates, two lamps, no wall
      "#S#########",
      "#,...#hhh##",
      "#hh.hFh.h##",
      "#h...B..h##",
      "#..hhhh.h##",
      "#h..h#h...S",
      "S..hF#hhhh#",
      "###########",
    ],
    wl2: [   // WL-02: the fort: the yard gate and both outer gates must all cross the wall to reach the point
      "############",
      "B,.HTTTT#F##",
      "##TTT,,TTT##",
      "##FS....HT##",
      "##TTT,,TTT##",
      "S,,HTTTTH,,S",
      "#####F######",
    ],
    wl3: [   // WL-03: two walls crossed in turn; ladders at both ends and in the middle, the lower wall is the way round
      "###S#S#S###",
      "#..,.H.,..#",
      "#HTTTTTTTH#",
      "F.........F",
      "#TTTT.TTTT#",
      "#TTTH.HTTT#",
      "#H..,B,..H#",
      "#####F#####",
    ],
    wl4: [   // WL-04: two long streets with a wall and ladders between them; lamps only at the street ends
      "############",
      "#F##########",
      "#,,,,,,,,,S#",
      "##HTT.xh##,#",
      "S,.......,.#",
      "####HTTh##.F",
      "B,.........#",
      "############",
    ],
    wl5: [   // WL-05: four gates inside the board and a tunnel (11,3) -> (0,3); a block of wall splits the two west points
      "############",
      "#B..T,,,hhF#",
      "#.H..,S,,.h#",
      ",.TT,,,,S,,,",
      "#.TTF,,,S,,#",
      "#.H..,S,,.h#",
      "#B..h,,,hh##",
      "############",
    ],
    wl6: [   // WL-06: the farm: the yard gate empties only by ladder, the outer road goes round by the west
      "#########S##",
      "#.,,,,,,,,F#",
      "#.TTTmTmTmT#",
      "F.TxFS#x#xH#",
      "#.T,,,,,HT.#",
      "#BTTTTTTTT.B",
      "######F#####",
    ],
    wl7: [   // WL-07: the long loop: down from the top gates over the walls, round the south wall by the east ladder, up the west road
      "####B#SSS##",
      "#T...#,,,H#",
      "#T.#FTTTTT#",
      "#T.TSH....#",
      "#T.T,,..,,#",
      "#TH#S....H#",
      "##mmmmTTTT#",
      "###########",
    ],
    wl8: [   // WL-08: the fortress on the ridge: tunnel (12,7) -> (0,7), a gate in the inner yard, two points
      "#############",
      "#TTB......,,S",
      "F..B......,,S",
      "#.TTTTTTTH.T#",
      "#.T,.......T#",
      "#.TSHTTTTH.T#",
      "S,T##S#FT####",
      ",,TH........,",
      "#############",
    ],
    wl9: [   // WL-09: before the palace: three points, four gates, tunnel (10,1) -> (2,2)
      "######S###S#",
      "B..T##,,.#,#",
      "##,TH.,#,..#",
      "#F.,,T.,.hh#",
      "#TT##Hx.#F.#",
      "B...,,....,S",
      "###TTxhh#..#",
      "B...,,....,S",
      "############",
    ],
  };
  /* chapter 4's boards: the design's letters become the engine's own, so no new tile letter reaches the engine (the same letter can mean something else on another
     chapter's boards): i / o (a skylight's mouths, the tunnel itself is in stage.tunnels) -> ",", u -> "." and v -> "," (a fuse's squares, listed in stage.fuses), p -> "_" (the
     plank's slot, listed in stage.plank), f (the igniter) and P (the box) -> "W" (the page draws them from stage.fuses). C (chimney), ^ (smoke bridge), _ (night air) are LAB-01's */
  const CH4MAP = (rows) => rows.map((r) => r.replace(/[iov]/g, ",").replace(/u/g, ".").replace(/p/g, "_").replace(/[fP]/g, "W"));
  const CH4 = (o) => Object.assign({ ch4: true, ep: 4, bg: null, hz: 0.5, leap: { after: 30, warn: 5, dur: 3, retry: 5 }, rmul: { hp: 1, atk: 0.9 }, boss: ["", ""] }, o, { map: CH4MAP(o.map) });
  /* chapter 5's boards: the design's letters become the engine's own: G (a tuba, listed in stage.tubas, drawn by the page) -> "W", Q (a resonance square, gathered into
     stage.reso) -> ".". M (metronome) and R (rest) are LAB-02's own. Tuba facings: 0 east, 1 south, 2 west, 3 north */
  const CH5MAP = (rows) => rows.map((r) => r.replace(/G/g, "W").replace(/Q/g, "."));
  const CH5 = (o) => { const reso = []; o.map.forEach((r, y) => [...r].forEach((c, x) => { if (c === "Q") reso.push([x, y]); }));
    return Object.assign({ ch5: true, ep: 5, bg: null, hz: 0.5, rmul: { hp: 1, atk: 0.9 }, boss: ["", ""], meters: { noise: { v: 0, min: 0, max: 4, label: "불협" } }, fallMeter: { meter: "noise", by: 1 } }, o, { map: CH5MAP(o.map), reso }); };
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
        [40, "snowblade", 1, 2, 2.5], [42, "yfang", 2, 4, 1.5], [52, "yrazor", 0, 1], [53, "yfang", 2, 5, 1.1],
        [70, "yfang", 0, 6, 1], [70, "yfang", 1, 6, 1], [71, "yfang", 2, 5, 1],
        [95, "snowblade", 1, 2, 1.8], [96, "yrazor", 2, 2, 2], [102, "yfang", 0, 7, 1], [108, "yrazor", 1, 3, 2], [114, "yfang", 2, 6, 0.9], [116, "yrazor", 0, 1]]); })(),
      boss: ["", ""], desc: "생울타리 사이의 길. 아래쪽 길에는 처음부터 설원 저격수들이 빼곡히 자리를 잡고 오래 버팁니다. 눈보라는 남쪽, 아래쪽 길에서 불어옵니다. 빠른 적이 길을 돌파해 옵니다. 저격수는 마법에 강하고 멀리서 쏘며, 얼어붙은 가사인격에게 훨씬 큰 피해를 줍니다. 눈보라가 부는 동안에는 모습을 감춥니다. 아래쪽 길로도 적이 오니, 저격수를 일찍 쓰러뜨려야 화망을 세울 수 있습니다. 생울타리는 올라온 벽이라 눈보라를 막습니다.",
      lose: "저격수는 눈보라가 그친 사이에 물리 화력으로 하나씩 잡으세요. 저격수가 남아 있는 동안 고지대에 세운 가사인격은 계속 노려집니다." },
    { code: "IM-03", name: "지옥 종대", map: MAP_C2.village, bg: null, hz: 0.5, ep: 2, startCost: 16, mul: { hp: 0.17, atk: 0.23, def: 0.7 }, rmul: { hp: 0.47, atk: 0.25 },
      wind: { dir: 3, first: 22, every: 32, dur: 14 },   // from the south, up the hounds' road: whoever holds a square shelters the rise behind it
      // gates: 0 the east (round over the north road: the firebottles), 1 the west (the ice-clad guards wait beside it), 2 the south (hounds and frost gunners)
      // the frost gunner first, the firebottles four to six seconds behind him (and now two or three together, with infantry in front of them); two lulls (34-44, 78-90);
      // the ice-clad guards still set the clock: they stir at 50/58 and come round the long way
      waves: W1([[0.5, "iceguard", 1, 1, 0, { at: [3, 3], wait: 50, via: [[5, 2]] }], [0.5, "iceguard", 1, 1, 0, { at: [3, 4], wait: 58, via: [[5, 2]] }],   // by (5,2): the new forward square can take one of them
        [4, "yfang", 2, 3, 1.6], [11, "chouang", 0, 1], [12, "frostgun", 2, 1], [16, "chouang", 0, 2, 1.5], [17.5, "molotov", 0, 1], [24, "yfang", 2, 3, 1.4], [30, "chxbow", 0, 1],
        [44, "frostgun", 2, 1], [47, "chouang", 0, 4, 1.5], [50, "molotov", 0, 2, 1.5], [54, "yfang", 2, 4, 1.2], [60, "strag", 1, 6, 1.2], [66, "frostgun", 2, 1], [69, "snowblade", 0, 3, 1.5], [70.5, "molotov", 0, 1], [74, "yrazor", 2, 2, 2],
        [90, "yfang", 2, 4, 1.2], [96, "frostgun", 2, 1], [99, "chouang", 0, 4, 1.5], [102, "molotov", 0, 2, 1.5], [106, "snowblade", 1, 3, 2], [112, "frostgun", 2, 1], [113, "yfang", 2, 4, 1.1],
        [116, "chouang", 0, 3, 1.2], [120, "yrazor", 2, 1], [121, "yfang", 2, 4, 1], [124.5, "molotov", 0, 2, 1.5]]),
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
    { code: "IM-05", name: "목 없는 장군", map: MAP_C2.gallows, bg: null, hz: 0.5, ep: 2, startCost: 22, mul: { hp: 0.47, atk: 0.45, def: 0.72 }, rmul: { hp: 0.8, atk: 0.5 },
      // gates: 0 the long road (top left), 1 the short road (top middle), 2 the dead end on the right (its only way on is the tunnel). The clock is the three long rifles on the last steps
      // before the point: they shell whoever of ours stands on the ground, and get up one by one from the rear (80 / 105 / 130) to walk the two or three steps in. Only the rise (11,5), looking west,
      // reaches them, and the fowlers from gate 2 walk right past that rise (and then past the other, on the strip) shooting at it. The long road's men come five ways, taught in this order:
      // RIGHT column (met on (5,2) and (6,6)), LEFT column (met on (4,4) and (6,6)), T2 (left column, then under (6,6): met only on (4,4)), T1 (under the block: met only on (6,6)), TT (both tunnels: met nowhere, struck in passing)
      tunnels: [{ a: [4, 1], b: [5, 3], t: 3 }, { a: [5, 5], b: [7, 7], t: 3 }, { a: [12, 6], b: [2, 6], t: 5 }, { a: [0, 4], b: [9, 6], t: 5 }],
      waves: (() => { const RIFLE = (x, y, until) => ({ at: [x, y], until }), LEFT = { via: [[4, 4]] }, T2 = { via: [[4, 4]], tun: true }, T1 = { via: [[6, 6]], tun: true }, TT = { tun: true }, R = { tun: true };
        return W1([[0.5, "chxlong", 0, 1, 0, RIFLE(9, 6, 80)], [0.5, "chxlong", 0, 1, 0, RIFLE(8, 6, 105)], [0.5, "chxlong", 0, 1, 0, RIFLE(8, 5, 130)],
        /* the opening (0-48): nothing comes up by the point yet. The fowlers start at once; the road shows its right column, then its left, then the short road; one hound alone under (6,6) */
        [8, "chxbow", 2, 1, 0, R], [12, "chouang", 0, 1], [20, "chouang", 0, 1, 0, LEFT], [22, "chxbow", 2, 1, 0, R], [30, "chouang", 0, 2, 2], [34, "chouang", 1, 1], [38, "chxbow", 2, 2, 2.5, R], [44, "yfang", 0, 1, 0, T2],
        /* the tunnels (50-96): the dogs run both tunnels and can only be struck in passing; hounds under the block are met on (6,6); the first rifle gets up at 80 */
        [52, "chouang", 0, 2, 2, LEFT], [56, "dog", 0, 2, 1.6, TT], [64, "chxbow", 2, 2, 2.5, R], [70, "dog", 0, 2, 1.6, TT], [74, "chouang", 1, 2, 6], [80, "yfang", 0, 2, 1.4, T1], [86, "chouang", 0, 2, 2], [92, "chxbow", 2, 2, 2.5, R],
        /* the press (96-135): no general on this board (the designer, 2026-11-13). The road's left column and the tunnels run together; the second rifle at 105, the third at 130 */
        [98, "chouang", 0, 2, 2, LEFT], [102, "dog", 0, 2, 1.6, TT], [106, "chouang", 0, 2, 2], [110, "chouang", 1, 1], [116, "yrazor", 0, 1, 0, T1], [120, "chxbow", 2, 2, 2.5, R], [126, "dog", 0, 2, 1.6, TT], [130, "chouang", 0, 1],
        /* the last of it (135-170) */
        [138, "chouang", 1, 2, 6], [144, "chxbow", 2, 2, 2.5, R], [150, "yfang", 0, 1, 0, T2], [154, "dog", 0, 3, 1.6, TT], [158, "chouang", 0, 1], [164, "yrazor", 0, 1, 0, T1]]); })(),
      boss: ["", ""], desc: "처형장 언덕. 길이 네 토막으로 끊겨 있고, 토막 사이는 땅굴로만 이어집니다. 땅굴을 탄 적은 그 사이의 배치 칸을 건너뜁니다. 방어 지점 바로 앞 세 칸에는 슈앙 장총수 셋이 처음부터 서서 지상의 가사인격을 쏘고(고지는 못 겨눕니다), 80초, 105초, 130초에 뒤쪽부터 하나씩 걸어 들어옵니다. 오른쪽 길의 엽총수는 두 고지 곁을 차례로 지나며 고지를 쏩니다.",
      lose: "동쪽 고지 (11,5)에서 서쪽을 보면 장총수에 닿습니다. 그 고지를 쏘는 엽총수는 바로 옆 (12,5)에서 막으세요. 땅굴 둘을 다 타는 사냥개는 막을 칸이 없으니, (5,2)·(4,4)·(6,6)에서 지나가는 것을 치세요." },
    { code: "IM-06", name: "생니카즈 거리", map: MAP_C2.square6, bg: null, hz: 0.5, ep: 2, startCost: 16, mul: { hp: 1.0, atk: 1.15, def: 0.85 }, rmul: { hp: 0.95, atk: 0.9 }, hard: true, entryFx: true,
      storm: { dir: 1, gauge: 100, drain: 0.45 },   /* the blizzard from the north that does not stop until the gauge runs out */
      lamps: { fire: true, hp: 1200, regen: 40, relightAt: 0.5 },   /* braziers that foes beside them strike; out at 0, lit again by themselves at half */
      // one gate (8,3). The guard drops in between 2 and 8 s, each one walks to its square round the gate and stands there until its time, the outer ring first, then the inner
      // ring, the two frost gunners and last the captain on (9,3). Four small bands come in through the same gate meanwhile
      waves: (() => { const P = (x, y, t) => ({ via: [[x, y, { until: t }]] }), N = (x, y, t) => ({ via: [[x, y, { until: t }], [6, 2]] });   /* N: leaves by the north side of the square, past the warm square (6,2) */
        /* nobody waits within reach of a brazier: the fires are struck only by those who walk past them. The five who leave while the storm still blows (30-74) go by (6,2), the one warm
           ground square, except the one from (8,6), who walks up past the brazier (7,5) first. After that they come by every way */
        const SQUAD = [["snowblade", N(8, 0, 24)], ["snowblade", N(12, 3, 32)], ["snowblade", N(8, 6, 40)], ["snowblade", N(11, 2, 48)], ["snowblade", N(7, 1, 56)], ["snowblade", P(9, 1, 78)], ["snowblade", P(8, 1, 84)],
          ["snowblade", P(10, 3, 90)], ["snowblade", P(10, 2, 96)], ["snowblade", P(8, 4, 102)], ["snowblade", P(9, 2, 108)], ["snowblade", P(7, 3, 114)],
          ["frostgun", P(8, 2, 120)], ["frostgun", P(9, 4, 124)], ["icecaptain", N(9, 3, 132)]];   /* the captain comes by (6,2): held there beside a lit brazier, his ice thaws */
        return W1(SQUAD.map(([type, o], i) => [+(2 + i * 0.4).toFixed(1), type, 0, 1, 0, o]).concat([
          [88, "yfang", 0, 2, 1.5], [100, "snowblade", 0, 2, 2], [116, "snowblade", 0, 2, 2], [128, "yfang", 0, 3, 1.2]])); })(),
      boss: ["", ""], desc: "생니카즈 거리의 분수 광장. 눈보라가 그치지 않습니다. 켜진 화로가 많을수록 눈보라 게이지가 빨리 줄고, 다 줄면 그칩니다. 근위대가 광장 한가운데에 한꺼번에 나타나 서 있다가, 바깥쪽부터 하나씩 방어 지점으로 걸어옵니다. 설원 습격병은 눈보라 속에서 보이지 않습니다. 적은 지나가다 곁의 화로를 부숩니다. 화로는 스스로 회복하고, 절반까지 차면 다시 켜집니다.",
      lose: "눈보라가 부는 동안에는 화로 곁의 따뜻한 칸에만 설 수 있습니다. 화로를 치는 적부터 떼어 내세요." },
    { code: "IM-07", name: "반란의 그늘", map: MAP_C2.detour, bg: null, hz: 0.5, ep: 2, startCost: 10, mul: { hp: 0.67, atk: 0.74, def: 0.75 }, rmul: { hp: 0.8, atk: 0.6 },
      wind: { dir: 0, first: 40, every: 34, dur: 12 }, lamps: { fire: true },
      tunnels: [{ a: [0, 6], b: [0, 1], t: 5 }, { a: [6, 1], b: [4, 6], t: 5 }],
      // the waves keep the reference board's shape: few foes, long gaps on the high road, and a long way round that the slow and the strong take. Two gunners stand on the bottom row until 40;
      // three shield-bearers walk to the pocket in the bottom left and stand there until 100 / 110 / 130 before they go round; three gunners stand at the head of the road, then turn off after them
      waves: (() => { const ROUND = { via: [[2, 6], [5, 1], [7, 6]], tun: true }, POCKET = (x, y, t) => ({ via: [[x, y, { until: t }], [5, 1], [7, 6]], tun: true }), HEAD = (x, t) => ({ via: [[x, 4, { until: t }], [2, 6], [5, 1], [7, 6]], tun: true });
        return W1([[0.5, "frostgun", 0, 1, 0, { at: [6, 6], until: 40 }], [0.5, "frostgun", 0, 1, 0, { at: [7, 6], until: 40 }],
        [3, "yshield", 0, 1, 0, POCKET(1, 6, 100)], [6, "yshield", 0, 1, 0, POCKET(2, 6, 110)], [9, "yshield", 0, 1, 0, POCKET(2, 5, 130)],
        [17, "soldier", 0, 2, 3], [25, "soldier", 0, 1, 0, ROUND], [44, "soldier", 0, 2, 2, ROUND], [54, "frostgun", 0, 1, 0, HEAD(3, 77)], [57, "frostgun", 0, 1, 0, HEAD(2, 89)], [60, "frostgun", 0, 1, 0, HEAD(1, 101)],
        [86, "soldier", 0, 2, 3], [102, "frostgun", 0, 2, 3], [102, "grenadier", 0, 1, 0, ROUND], [122, "soldier", 0, 2, 2], [135, "soldier", 0, 3, 7],
        [162, "frostgun", 0, 2, 2], [182, "soldier", 0, 2, 11], [187, "grenadier", 0, 1, 0, ROUND], [202, "frostgun", 0, 3, 15], [209, "soldier", 0, 3, 11]]); })(),
      boss: ["", ""], desc: "갈림길. 큰길은 진창을 건너 동쪽 끝에서 북쪽 방어 지점으로 꺾습니다. 느리고 단단한 적은 (2,4)에서 남쪽으로 꺾어 땅굴로 들어가, 왼쪽 위로 나와 맨 윗줄을 걷고, 다시 땅굴을 타고 아랫줄 (4,6)으로 나와 오른쪽 줄로 올라옵니다. 눈보라는 서쪽에서 불어옵니다. 올라온 벽 뒤의 칸은 바람을 피하고, 화로 곁의 진창 (7,4)는 얼지 않습니다.",
      lose: "큰길은 (4,4)와 화로 곁의 진창에서 받고, 돌아오는 적은 윗줄 (5,1)과 아랫줄 (7,6)에서 받으세요." },
    { code: "IM-ST1", name: "불 꺼진 밤", map: MAP_C2.shadow, bg: null, hz: 0.5, ep: 2, story: true, startCost: 10, mul: { hp: 1, atk: 1, def: 1 }, waves: [],
      boss: ["", ""], desc: "갈림길의 반란군은 거의 남지 않았다. 검문소를 앞둔 밤, 불을 피우지 못한 채 모여 앉은 사람들.", lose: "" },
    { code: "IM-08", name: "황제가 죽었다", map: MAP_C2.barrier, bg: null, hz: 0.5, ep: 2, startCost: 10, mul: { hp: 0.445, atk: 0.69, def: 0.76 },
      wind: { dir: 2, first: 52, every: 46, dur: 12 },   /* from the east, through the gap: the barrier (W) takes it on rows 2 and 4, the two round roads (1, 5) and the gap row (3) take all of it */
      lamps: { r: 1, fire: true },   /* the checkpoint brazier (4,3): it can be put out (a drone), and only someone set down beside it afterwards lights it again */
      // gates: 0 the north-east road (the gendarmes: hounds, pikemen, frost gunners, the drones), 1 the south-east road (the Emperor's column). Everything comes through the one gap (7,3);
      // the gendarmes then go round the checkpoint house by the north (vias), the column by the south. Two frost gunners stand on the wall either side of the gap until late.
      // The maddened are let loose from just behind the gap (MAD), so they reach us at the height of their frenzy. Three surges: 5-42, 55-110, 122-178
      vias: { 0: [[5, 2]], 1: [[5, 4]] },   /* the mouths: each column comes out of the gap past a square by the checkpoint brazier */
      waves: (() => { const POST = (x, y) => ({ at: [x, y], until: 130 }), MAD = (x, y, t, via) => ({ at: [x, y], wait: t + 1, via, hp: 2.5 }), N = [[5, 2]], S = [[5, 4]], HOV_N = { air: [[9, 2, 4], [3, 2, 7], [0, 3]] }, HOV_S = { air: [[9, 4, 4], [2, 4, 7], [0, 3]] };
        return W1([[0.5, "frostgun", 0, 1, 0, POST(7, 1)], [0.5, "frostgun", 1, 1, 0, POST(7, 5)],
        [7, "yfang", 0, 2, 1.5], [12, "soldier", 1, 3, 2], [22, "lancer", 0, 1], [30, "yfang", 1, 3, 1.3], [36, "soldier", 0, 2, 2], [41, "frostgun", 0, 1],
        [55, "berserk", 1, 1, 0, MAD(8, 3, 55, S)], [60, "bomber", 0, 1, 0, HOV_N], [66, "lancer", 1, 2, 2], [74, "strag", 1, 5, 0.8], [76, "frostgun", 0, 1], [84, "yshield", 0, 1], [86, "soldier", 1, 3, 1.4], [91, "frostgun", 1, 1],
        [97, "berserk", 0, 1, 0, MAD(8, 2, 97, N)], [97, "berserk", 1, 1, 0, MAD(8, 4, 97, S)], [100, "yfang", 0, 4, 1], [102, "bomber", 1, 1, 0, HOV_S],
        [122, "iceguard", 1, 1, 0, { at: [8, 3], wait: 123, via: S }], [126, "lancer", 0, 3, 1.5], [134, "soldier", 1, 4, 1.3], [140, "frostgun", 1, 1], [136, "yrazor", 0, 1], [144, "berserk", 0, 1, 0, MAD(8, 2, 144, N)], [144, "berserk", 1, 1, 0, MAD(8, 4, 144, S)], [146, "bomber", 0, 2, 5, HOV_N],
        [154, "yfang", 1, 4, 1], [156, "frostgun", 0, 1], [164, "lancer", 1, 3, 1.5], [166, "soldier", 0, 3, 1.3], [170, "frostgun", 0, 1], [172, "yrazor", 1, 1]]); })(),
      boss: ["", ""], desc: "세관 성벽 앞의 검문소. \"황제가 죽었다\"는 소문에 헌병대가 길을 막았습니다. 차단벽에 난 틈 하나(7,3)로 두 길의 적이 모두 빠져나온 뒤, 검문소 화로 곁 (5,2)·(5,4)를 지나 검문소 건물을 북쪽이나 남쪽으로 돌아 방어 지점으로 옵니다. 헌병대(북동쪽)는 북쪽으로, 황제군 종대(남동쪽)는 남쪽으로 돕니다. 52초부터 46초마다 동쪽, 틈 너머에서 눈보라가 불어옵니다. 차단벽이 화로 곁 두 줄을 가려 주고, 두 우회로와 틈의 줄로는 그대로 들이칩니다. 화로(F) 둘레 여덟 칸은 얼지 않습니다. 틈 양옆 성벽 위에는 서리 사수 둘이 올라서서 틈 앞뒤를 겨누다가, 130초가 지나면 내려와 걸어옵니다. 창병은 몇 초마다 창을 낮추고 내달리며, 그 뒤 첫 일격이 두 배로 들어갑니다. 동상 광인은 돌풍과 함께 틈 바로 뒤에서 풀려납니다. 눈보라를 맞는 동안에는 세 배로 빨리, 더 높이 미쳐 오르고, 불 곁의 가사인격에게 막히면 가라앉습니다. 얼음폭탄 드론은 벽을 넘어 우리 고지 위에 잠시 떠 있고, 켜진 화로가 가까우면 화로부터 끕니다. 꺼진 화로는 바로 아래 (4,4)에 새로 세운 가사인격이 6초 버티면 다시 붙습니다.",
      lose: "성벽 위 사수는 바로 옆 칸 (6,1)·(6,5)에 근거리 가사인격을 세워 쓰러뜨릴 수 있습니다. 사수가 사라지면 벽 너머 마당을 보는 고지 (9,2)·(9,4)도 쓸 수 있습니다. 동상 광인은 우회로 끝에서 받지 말고, 검문소 화로 곁 (5,2)·(5,4)에서 붙잡으세요. 차단벽이 바람을 막아 주고, 불 곁에서 막힌 광인은 가라앉습니다. 화로를 끄러 오는 드론은 던지기 전에 떨어뜨리고, 꺼지면 (4,4)에 새로 세워 다시 붙이세요. 빙갑 근위병도 불 곁에서 막아야 얼음이 녹습니다." },
    { code: "IM-09", name: "세관 성벽", map: MAP_C2.wall, bg: null, hz: 0.5, ep: 2, startCost: 12, mul: { hp: 0.61, atk: 0.51, def: 0.78 }, rmul: { hp: 0.85, atk: 0.8 },
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
    { code: "IM-10", name: "지옥 기계", map: MAP_C2.frostgate, bg: null, hz: 0.5, ep: 2, startCost: 20, mul: { hp: 0.3, atk: 0.3, def: 0.7 }, rmul: { hp: 0.48, atk: 0.42 }, hard: true,
      /* 2026-11-18, the frost stage (stage.frost, spec 2-10 v2): the cold is the boss. Directions: 0 from the west, 1 from the north, 2 from the east, 3 from the south */
      frost: { braziers: { hp: 3000, drain: [5, 9, 14, 20], feed: { cost: 10, hp: 900, cd: 4 }, warm: 1 }, finalDps: 0.03,
        storm: [{ dirs: [1] }, { dirs: [1] }, { dirs: [1, 0] }, { dirs: [0, 1, 2, 3] }],
        phases: [{ open: [[4, 2, 14, 8]] },
          { open: [[2, 1, 16, 9]], set: [[5, 3, "F"], [13, 7, "F"]], when: "clear" },
          { open: [[0, 0, 18, 10]], set: [[3, 5, "F"], [15, 5, "F"], [9, 1, "F"], [9, 7, ","], [3, 3, "W"], [15, 7, "W"]], tunnels: [{ a: [2, 8], b: [8, 8], t: 4 }], when: "clear" },
          { final: true, time: 70, when: "clear" }] },
      /* waves: times from each phase's start, gates by square. Posts (at/until, via until) count from the phase's start too (frostShift) */
      waves: (() => { const G = (ph, x, y, o) => Object.assign({ ph, gate: [x, y] }, o || {}), POST = (ph, gx, gy, x, y, t) => G(ph, gx, gy, { at: [x, y], until: t });
          /* EAST: out of the north gate along the top row and down the east side (15,2)-(15,4). Snow blades are hidden while the blizzard blows, so one that stopped within reach of (9,3) could not be struck
             at all; this way they pass two squares from it and come up against whoever holds (12,5) */
          /* the phase-2 mortars stand on (8,1) and (11,9): a mortar stands wherever something is in reach, and at its gate it could be reached by nobody; (8,1) is in reach of a sniper on (5,2), (12,6) of one on (13,8) */
          /* W3: the way in along row 3 from the west to (7,3): whoever holds (8,3) holds them there on a warm square (the ice of shields, ice guards and the frost marshal's men thaws), too far
             from (9,3) to strike it. E3 / EAST3: in along row 3 from the east to (11,3) and down column 11 to (10,5); they pass (9,3) at two squares. Coming down columns 8 or 10 instead, a foe stops
             within reach of (9,3) before anyone can hold him */
          /* ROW9: the east gate of the bottom row comes along row 9 and in along row 7 to (12,7): held there, west of the brazier (13,7), it is out of reach of it */
          const ROW9 = { via: [[15, 9], [11, 7], [12, 7]] };
          const W3 = { via: [[6, 5], [7, 4], [7, 3]] }, E3 = { via: [[12, 4], [11, 3]] }, EAST3 = { via: [[15, 2], [12, 4], [11, 3]] }, EAST = { via: [[15, 2]] };
        return W1([
        /* phase 0: the two gates in the middle, soldiers and stragglers in ones and twos (the east gate a little later), two hounds to end it */
        [2, "soldier", 0, 1, 0, G(0, 5, 3)], [8, "strag", 0, 2, 1.5, G(0, 5, 3)], [14, "soldier", 0, 1, 0, G(0, 5, 3)], [20, "strag", 0, 1, 0, G(0, 5, 3)], [25, "strag", 0, 1, 0, G(0, 13, 7)],
        [27, "soldier", 0, 1, 0, G(0, 13, 7)], [29, "strag", 0, 2, 1.5, G(0, 13, 7)], [32, "yfang", 0, 1, 0, G(0, 5, 3)], [34, "yfang", 0, 1, 0, G(0, 13, 7)],
        /* phase 1: the ring. Four frost gunners stand at the edge of it from the first second and leave one by one; the first mortar from the east, the first standard bearer from the west behind shields
           (they come in along row 3, W3); everything from the north gate goes round by the east and in along row 3 (EAST3), past (9,3) at two squares; some bands go by (5,4) and (13,6)
           and stop at the new braziers; the guard captain last */
        [0.5, "frostgun", 0, 1, 0, POST(1, 15, 5, 16, 4, 18)], [0.5, "frostgun", 0, 1, 0, Object.assign(POST(1, 3, 5, 2, 4, 28), W3)], [0.5, "frostgun", 0, 1, 0, POST(1, 15, 5, 16, 6, 38)], [0.5, "frostgun", 0, 1, 0, Object.assign(POST(1, 3, 5, 3, 9, 48), W3)],
        [4, "mortar", 0, 1, 0, G(1, 15, 5)], [6, "yshield", 0, 2, 3, G(1, 3, 5, Object.assign({ hp: 0.3 }, W3))], [14, "standard", 0, 1, 0, G(1, 3, 5, W3)],
        [8, "snowblade", 0, 3, 3, G(1, 9, 1, EAST3)], [18, "soldier", 0, 2, 2, G(1, 3, 5, { via: [[5, 4]] })], [22, "soldier", 0, 2, 2, G(1, 15, 5, { via: [[13, 6]] })],
        [28, "strag", 0, 2, 1.2, G(1, 9, 1, EAST3)], [34, "yfang", 0, 2, 1.5, G(1, 15, 5)], [40, "grenadier", 0, 1, 0, G(1, 3, 5, { via: [[5, 4]] })], [46, "snowblade", 0, 2, 3, G(1, 9, 1, EAST3)],
        [52, "soldier", 0, 2, 2, G(1, 15, 5, { via: [[13, 6]] })], [58, "soldier", 0, 2, 2, G(1, 3, 5, W3)], [40, "icecaptain", 0, 1, 0, G(1, 9, 1, Object.assign({ hp: 0.2, atk: 0.6 }, EAST3))],
        /* phase 2: all seven outer gates. Two gunners posted on the outer rows, a mortar north (8,1) and one south (12,6), a standard bearer behind shields from the south-west and one from the north-east (both
           in along row 3), the eagle bearer from the north gate at 45 (down column 8), the frost marshal from the south gate at 80 (round by the west, in along row 3), an ice guard from
           the south-east along the whole bottom row and one from the south-west (both in along row 3 from the west), hounds through the tunnel (and then in along row 3), grenadiers; the second
           standard bearer comes down column 8 (he never strikes, so he walks on to whoever holds (8,3)); the bottom row from the east comes in by (12,7). What comes from the north gates passes (9,1) and strikes it, then
           stops on column 8 or 10 within reach of (9,3) (the brazier (9,1) cuts the top row, so there is no other way down from the north-west). Snow blades only where they pass no brazier within reach (they cannot be struck while hidden) */
        [0.5, "frostgun", 0, 1, 0, POST(2, 10, 0, 12, 1, 30)], [0.5, "frostgun", 0, 1, 0, POST(2, 9, 10, 6, 9, 40)],
        [3, "soldier", 0, 3, 2, G(2, 0, 2)], [8, "yshield", 0, 2, 2.5, G(2, 0, 8, Object.assign({ hp: 0.5 }, W3))], [13, "standard", 0, 1, 0, G(2, 0, 8, W3)], [58, "soldier", 0, 2, 1.5, G(2, 0, 2)],
        [8, "mortar", 0, 1, 0, POST(2, 8, 0, 8, 1, 999)], [18, "grenadier", 0, 2, 3, G(2, 8, 0)], [45, "eagle", 0, 1, 0, G(2, 8, 0, { hp: 0.3, atk: 0.25 })],
        [52, "frostgun", 0, 2, 2, G(2, 10, 0)], [68, "yfang", 0, 3, 1, G(2, 10, 0)], [72, "strag", 0, 3, 1, G(2, 10, 0)],
        [58, "yshield", 0, 2, 2.5, G(2, 18, 2, Object.assign({ hp: 0.5 }, E3))], [63, "standard", 0, 1, 0, G(2, 0, 2)],
        [5, "soldier", 0, 3, 2, G(2, 18, 8, ROW9)], [0.5, "iceguard", 0, 1, 0, G(2, 18, 8, { via: [[15, 9], [3, 9], [6, 5], [7, 4], [7, 3]], hp: 0.25 })], [62, "grenadier", 0, 1, 0, G(2, 18, 8, ROW9)], [62, "grenadier", 0, 1, 0, G(2, 10, 0)],
        [40, "iceguard", 0, 1, 0, G(2, 0, 8, Object.assign({ hp: 0.25 }, W3))], [22, "yfang", 0, 4, 1, G(2, 0, 8, Object.assign({ tun: true }, W3))],
        [26, "soldier", 0, 3, 1.5, G(2, 10, 0)], [30, "snowblade", 0, 2, 2, G(2, 18, 8, ROW9)], [34, "mortar", 0, 1, 0, POST(2, 9, 10, 12, 6, 999)], [80, "frostmarshal", 0, 1, 0, G(2, 9, 10, Object.assign({ hp: 0.3 }, W3))]]); })(),
      boss: ["", ""], desc: "수도의 성문. 눈보라가 그치지 않고, 화로가 모두 꺼지면 얼어 죽습니다. 적을 지울 때마다 안개가 걷히고 적이 나오던 자리에 화로가 놓입니다. 화로를 누르면 코스트 10으로 장작을 넣을 수 있습니다. 화로 곁에서는 얼지 않습니다. 마지막에는 적이 오지 않고 눈보라만 사방에서 밀려옵니다.",
      lose: "바람이 들어오는 쪽 화로 옆에 가사인격을 세우면 그 방향의 눈보라가 막힙니다. 지킬 화로를 고르세요." },
    // a side branch shown under IM-01 and open with chapter 2: the terminal's lesson on the blizzard, with a fixed squad (lines by 유진)
    { code: "TR-03", name: "눈보라 학습", map: MAP_C2.lesson, bg: null, hz: 0.5, ep: 2, branch: "IM-01", startCost: 30, mul: { hp: 0.245, atk: 0.262, def: 0.5 },
      wind: { dir: 3, first: 30, every: 34, dur: 14, durs: [10] },
      waves: W1([[3, "strag", 1, 3, 1.5], [9, "chouan", 0, 1, 2], [22, "chouan", 1, 1, 1.6], [30, "strag", 1, 4, 1.2], [38, "yshield", 0, 1, 1.5], [46, "chouan", 0, 2, 1.4],
        [52, "soldier", 1, 2, 3], [60, "strag", 0, 4, 1], [66, "chouan", 1, 2, 1.2], [74, "yshield", 1, 1, 1.2], [82, "soldier", 0, 2, 3], [90, "chouan", 0, 2, 1]]),
      boss: ["", ""], desc: "눈보라를 막는 법을 익힙니다. 남쪽에서 번져 오는 눈보라 앞을 가사인격이 막으면 그 뒤는 얼지 않습니다. 올라온 벽 뒤는 안전하고, 진창은 막든 말든 얼어붙습니다.",
      lose: "맨 아래 줄 빈칸에 선봉을 바람막이로 세우세요. 두 길 사이 올라온 벽 뒤(위쪽 길)는 처음부터 안전합니다." },
    // ======== chapter 3 (working title 「쏘지 않은 탄환」): the capital, the Emperor who came back, the confessor ========
    // ---- chapter 3 (second cut) ----
    // chapter 3, third cut (2026-11-13): the lamps and the wall, on the rampart boards (MAP_C3.wl1 .. wl9). Rules on every one: every foe on foot climbs (climbAll),
    // a lamp lights the eight squares round it (lamps.r 1, Chebyshev) and nobody of ours is set down in the dark (darkDeploy false); the torch card from WL-04 on.
    // The chapter's question: when the light decides where we may stand and the wall decides where they may walk, where do we stand?
    // WL-01. Question: how far do we let a foe walk in the dark before somebody meets it? (type: strike in passing; formula broken: "shooters on the high ground")
    // gates: 0 the north lane (1,0), 1 the east lane (10,5), 2 the south-west lane (0,6). The point (5,3) sits between the two lamps' light; the rises round it are lit and see
    // nothing in the dark. A blade asleep on the east lane and a picket on the north lane from the start; some wait in the dark pockets beside the light and grow there.
    // The gloom runners (first alone at 26 s from the east) take the place of half the dogs: the long dark lanes are where they run fastest
    { code: "WL-01", name: "불 꺼진 거리", map: MAP_C3.wl1, bg: null, hz: 0.5, ep: 3, startCost: 10, mul: { hp: 0.8, atk: 0.8, def: 0.85 }, rmul: { hp: 1, atk: 0.9 },
      climbAll: true, lamps: { r: 1, darkDeploy: false },
      waves: (() => { const NW = { via: [[1, 4]] }, SX = { via: [[3, 5]] }, N8 = (t) => ({ via: [[3, 1, { until: t }]] }), S8 = (t) => ({ via: [[2, 5, { until: t }]] }), E8 = (t) => ({ via: [[7, 3, { until: t }]] });
        /* the blades that wait do it on the dark square just past a lit pocket: (3,1) beside (4,1), (2,5) beside (3,5), (7,3) before (6,3) */
        return W1([[0.5, "nightblade", 1, 1, 0, { at: [7, 4], sleepDark: true, wait: 62 }], [0.5, "soldier", 0, 1, 0, { at: [2, 1], until: 40 }],
        [6, "nightblade", 0, 1], [16, "soldier", 2, 2, 2.5], [26, "gloomrunner", 1, 1],
        [36, "nightblade", 0, 1, 0, N8(58)], [44, "soldier", 1, 2, 2], [50, "nightblade", 2, 1, 0, S8(70)], [56, "chasseur", 0, 1], [62, "gloomrunner", 2, 2, 1.5], [68, "nightblade", 1, 1, 0, E8(86)], [74, "soldier", 0, 2, 2, NW], [80, "strag", 2, 3, 1],
        [96, "nightblade", 0, 2, 2, N8(118)], [100, "gloomrunner", 2, 2, 2], [104, "nightblade", 2, 2, 2, S8(124)], [108, "chasseur", 1, 1], [112, "dog", 2, 3, 1.2, SX], [116, "nightblade", 1, 1, 0, E8(132)], [122, "soldier", 0, 2, 2, NW], [128, "gloomrunner", 1, 2, 1.3], [134, "chasseur", 2, 1], [138, "soldier", 1, 2, 2],
        [146, "strag", 0, 3, 1], [150, "nightblade", 2, 2, 2, S8(166)], [156, "soldier", 1, 2, 2], [160, "nightblade", 0, 1, 0, N8(172)], [168, "gloomrunner", 2, 2, 1.3], [174, "nightblade", 1, 1]]); })(),
      boss: ["", ""], desc: "언덕 사이 골목 한가운데의 방어 지점. 등 둘레 여덟 칸만 밝고, 어두운 칸에는 아무도 세울 수 없습니다. 야습병은 어둠 속에 있는 동안 점점 세집니다. 적은 북쪽, 동쪽, 남서쪽 골목에서 옵니다.",
      lose: "고지에서는 어둠 속이 보이지 않습니다. 어두운 골목 바로 옆의 밝은 칸 (4,1)·(3,5)에 지상 가사인격을 세우면, 지나가거나 기다리는 적을 칠 수 있습니다." },
    // WL-02. Question: the one square every way crosses: can one pair of hands hold it? (type: cross the wall; formula broken: "one heavy holds the road")
    // gates: 0 the yard (3,3), 1 the west road (0,5), 2 the east road (11,5); the point (0,1) outside the fort. Every lit square is a wall top. Every way crosses the wall top (8,2)
    // above the yard ladder and leaves by the ladder (3,1); the west road walks the south wall (4..7,5) first, under the south lamp. A wall gunner on the east wall and a picket
    // in the yard from the start. The north wall (4..7,1) runs along the sunken floor: a foe shoved off it there falls.
    // Pass 2: the wall gunner on the east wall now stays until 92 s; the dark fowler comes first alone at 44 s from the yard, its shots arts while it stands in the dark; gloom runners for most dogs
    { code: "WL-02", name: "빵집 앞 줄", map: MAP_C3.wl2, bg: null, hz: 0.5, ep: 3, startCost: 12, mul: { hp: 0.95, atk: 0.95, def: 0.85 }, rmul: { hp: 1, atk: 0.9 },
      climbAll: true, lamps: { r: 1, darkDeploy: false },
      waves: (() => { const YE = { via: [[9, 3]] }, WE = { via: [[9, 4]] }, E2 = { via: [[3, 2]] }, WY = (t) => ({ via: [[2, 4, { until: t }]] });
        return W1([[0.5, "wallgunner", 2, 1, 0, { at: [9, 4], until: 92 }], [0.5, "soldier", 0, 1, 0, { at: [5, 3], until: 28 }],
        [6, "escalader", 0, 1], [18, "soldier", 1, 2, 2.5], [28, "gloomrunner", 2, 1],
        [36, "escalader", 1, 2, 2], [44, "nightfowler", 0, 1, 0, YE], [50, "soldier", 1, 2, 2, WY(62)], [58, "escalader", 2, 1, 0, E2], [64, "dog", 1, 2, 1.4], [72, "escalader", 0, 1], [78, "grenadier", 1, 1],
        [96, "escalader", 1, 2, 2], [100, "soldier", 0, 2, 2], [104, "nightfowler", 2, 1, 0, E2], [108, "soldier", 1, 2, 2, WE], [112, "escalader", 2, 1], [118, "gloomrunner", 1, 3, 1.2], [124, "grenadier", 1, 1], [130, "escalader", 1, 2, 2, WY(140)], [136, "wallgunner", 2, 1],
        [146, "soldier", 0, 2, 2, YE], [152, "gloomrunner", 1, 2, 1.3], [158, "escalader", 2, 1, 0, E2], [166, "escalader", 1, 2, 2], [172, "soldier", 2, 1], [178, "grenadier", 1, 1]]); })(),
      boss: ["", ""], desc: "요새 밖의 방어 지점. 밝은 칸은 모두 담장 위입니다. 사다리병뿐 아니라 모든 적이 사다리를 타고 담장을 넘어옵니다. 적은 안마당과 서쪽 길, 동쪽 길에서 옵니다.",
      lose: "모든 길이 안마당 사다리 위 (8,2)를 지나지만, 서쪽 길의 적은 그 전에 남쪽 담장을 걷습니다. 한 칸에 다 받지 말고 남쪽 담장에도 저지선을 두세요." },
    // WL-03. Question: which square do we take first, when the enemy is coming for the squares and not for us? (type: beat a clock; formula broken: "set the blockers down first")
    // gates: 0 (3,0), 1 (5,0), 2 (7,0) on the north edge; the point (5,6). Every way comes down one of the two end ladders (1,2)/(9,2) onto the lit feet (1,3)/(9,3), crosses
    // the dark middle and goes down the gap (5,4)-(5,5) or round over the lower wall. The only lit wall tops are (1,4) and (9,4); two stakers stand on the lower wall in the dark from
    // the start and leave for them, the west one at 16 s, the east one at 34 s.
    // Pass 2: the lapis marksman stands in the dark at (8,3) from the start (at half its attack here) and shoots whoever of ours stands in the light, until 130 s; only a ground operator on the lit
    // ladder foot (9,3) beside it can strike it there; the ambusher first alone at 84 s (both ambushers at 0.7 of their attack here);
    // gloom runners in place of the dogs
    { code: "WL-03", name: "경찰청 뒷마당", map: MAP_C3.wl3, bg: null, hz: 0.5, ep: 3, startCost: 16, mul: { hp: 1.2, atk: 1.2, def: 0.85 }, rmul: { hp: 1, atk: 0.9 },
      climbAll: true, lamps: { r: 1, darkDeploy: false },
      waves: (() => { const TOP = { via: [[2, 2]] }, TOPE = { via: [[8, 2]] }, RW = { via: [[1, 4], [2, 6]] }, RE = { via: [[9, 4], [8, 6]] }, MID = (t) => ({ via: [[5, 3, { until: t }]] });
        const STAKE = (x, t, side) => ({ at: [x, 4], until: t, via: [[side, 4], [side < 5 ? 2 : 8, 6]] });
        return W1([[0.5, "staker", 0, 1, 0, STAKE(3, 16, 1)], [0.5, "staker", 2, 1, 0, STAKE(7, 34, 9)], [0.5, "longrifle3", 2, 1, 0, { at: [8, 3], until: 130, atk: 0.5 }],
        [14, "soldier", 0, 1], [26, "gloomrunner", 0, 2, 1.5], [36, "soldier", 1, 1, 0, TOP],
        [38, "staker", 1, 1, 0, TOP], [46, "soldier", 2, 2, 2], [52, "wallgunner", 0, 1], [58, "escalader", 1, 2, 2, TOPE], [66, "gloomrunner", 0, 2, 1.4], [74, "staker", 2, 1, 0, RE], [84, "ambusher3", 1, 1, 0, { atk: 0.7 }],
        [94, "soldier", 0, 2, 2, MID(110)], [98, "escalader", 2, 2, 2], [104, "staker", 0, 1, 0, RW], [108, "wallgunner", 1, 1, 0, TOP], [114, "gloomrunner", 2, 2, 1.2], [120, "soldier", 1, 2, 2, TOPE], [126, "escalader", 0, 1, 0, RW], [132, "staker", 2, 1, 0, RE],
        [142, "soldier", 2, 1], [144, "ambusher3", 2, 1, 0, { via: [[9, 4], [8, 6]], atk: 0.7 }], [150, "gloomrunner", 0, 2, 1.3], [156, "wallgunner", 2, 1], [162, "escalader", 1, 2, 2, TOP], [170, "soldier", 0, 2, 2]]); })(),
      boss: ["", ""], desc: "담장 두 겹 사이의 뒷마당. 밝은 칸은 양 끝 사다리 아래와 그 곁 담장 위, 넷뿐입니다. 말뚝병은 담장 위의 밝은 빈 칸에 말뚝을 박아 그 칸을 빼앗습니다. 적은 북쪽 문 셋에서 옵니다.",
      lose: "아래 담장의 어둠 속에 말뚝병 둘이 처음부터 서 있다가 (1,4)·(9,4)로 갑니다. 저지선보다 먼저 그 두 칸에 지상 가사인격을 세우세요. 담장 위에서도 바로 아래 칸을 칠 수 있습니다." },
    // WL-04. Question: when the only light is at the far gate, where do we make our own? (type: make your own ground; formula broken: "take everything at the gate")
    // gates: 0 the north street's east end (10,2), 1 the middle street's west end (0,4); the point (0,6) at the west end of the south street. The lamps stand at the street ends:
    // the only lit squares anyone can stand on are (10,4)-(10,6) by gate 0. The north street has two short cuts down to the middle street: the gap (5,3) and the ladder (2,3);
    // the middle street goes down to the south street only by the ladder (4,5). A wall gunner stands on the wall (3,3) from the start; drones set men down on the south street.
    // Pass 2: the lapis marksman stands on the north street (7,2) from the start until 140 s (at 0.6 of its attack here); the lanternist first alone at 78 s (both at half attack here); gloom runners for the dogs
    { code: "WL-04", name: "성당 계단", map: MAP_C3.wl4, bg: null, hz: 0.5, ep: 3, startCost: 12, mul: { hp: 1.4, atk: 1.4, def: 0.85 }, rmul: { hp: 1, atk: 0.9 },
      climbAll: true, lamps: { r: 1, darkDeploy: false }, torch: true,
      waves: (() => { const GAP = { via: [[5, 3]] }, LAD = { via: [[2, 3]] }, MID = { via: [[9, 4]] }, WALL = (t) => ({ via: [[3, 3, { until: t }]] }), AIR = (x, type) => ({ land: [x, 6], drop: type });
        return W1([[0.5, "wallgunner", 1, 1, 0, { at: [3, 3], until: 60 }], [0.5, "longrifle3", 0, 1, 0, { at: [7, 2], until: 140, atk: 0.6 }],
        [8, "soldier", 0, 2, 2.5], [20, "gloomrunner", 1, 1], [28, "soldier", 1, 1],
        [36, "wallgunner", 0, 1, 0, GAP], [44, "soldier", 0, 2, 2, LAD], [52, "gloomrunner", 0, 2, 1.4, GAP], [58, "escalader", 1, 2, 2, WALL(70)], [66, "drone", 0, 1, 0, AIR(7, "soldier")], [72, "soldier", 0, 2, 2, MID], [78, "lanternist", 0, 1, 0, { atk: 0.5 }],
        [96, "escalader", 0, 2, 2, GAP], [100, "soldier", 1, 2, 2], [104, "wallgunner", 0, 1, 0, LAD], [110, "drone", 1, 2, 3, AIR(6, "escalader")], [114, "gloomrunner", 0, 3, 1.2, GAP], [120, "escalader", 0, 2, 2, MID], [126, "soldier", 1, 2, 2], [132, "wallgunner", 0, 1, 0, GAP], [138, "escalader", 0, 2, 2, LAD],
        [148, "soldier", 0, 2, 2], [154, "gloomrunner", 1, 2, 1.3], [160, "drone", 0, 2, 3, AIR(8, "soldier")], [166, "escalader", 0, 2, 2, GAP], [174, "lanternist", 1, 1, 0, { atk: 0.5 }]]); })(),
      boss: ["", ""], desc: "세 줄 길. 등은 길 끝에만 있어서, 처음에 밝은 칸은 동쪽 문 곁의 셋뿐입니다. 횃불 카드를 어두운 칸에 놓으면 둘레 아홉 칸이 40초 동안 밝아집니다. 윗길의 적은 가운데 틈과 사다리로 지름길을 탑니다.",
      lose: "모든 길은 방어 지점 앞 아랫길의 사다리 아래 (4,6)으로 모입니다. 문 곁이 아니라 그 둘레를 횃불로 밝혀 세우세요. 횃불은 30초마다 다시 쓸 수 있습니다." },
    // WL-05. Question: when the road goes under the board, which way does our line face? (type: two fronts; formula broken: "behind the line is safe")
    // gates (all inside the board): 0 (6,2), 1 (8,3), 2 (8,4), 3 (6,5); points (1,1) and (1,6) in the west, the block of wall (2..3,3..4) between them. The tunnel (11,3) -> (0,3):
    // whoever of the east gates goes by it comes up between the two points, behind any line that faces the gates. The lamp (4,4) lights the south way and the wall block;
    // the north way and the tunnel's mouth are dark. Drones set men down beside the north point (2,1). Two pickets stand between the inner gates from the start and leave by both ways.
    // Pass 2: the observation balloon circles over the west half for the whole stage, marking whoever stands under it; the lapis marksman stands on the north road (7,1)
    // from the start until 150 s (0.6 attack here) and aims at the marked first; the crawler (nobody can hold it) first alone at 22 s; gloom runners for the dogs and ladder men
    { code: "WL-05", name: "대성당 앞", map: MAP_C3.wl5, bg: null, hz: 0.5, ep: 3, startCost: 24, mul: { hp: 0.7, atk: 0.7, def: 0.85 }, rmul: { hp: 1, atk: 0.9 },
      climbAll: true, lamps: { r: 1, darkDeploy: false }, torch: true,
      tunnels: [{ a: [11, 3], b: [0, 3], t: 5 }],
      waves: (() => { const TUN = { tun: true }, TUNS = { tun: true, via: [[1, 4]] }, WALL = { via: [[2, 4]] }, AIR = (type) => ({ land: [2, 1], drop: type }), POST = (x, y, t) => ({ at: [x, y], until: t });
        return W1([[0.5, "balloon", 0, 1, 0, { loop: [[3, 1], [3, 6], [6, 6], [6, 1]] }], [0.5, "longrifle3", 0, 1, 0, { at: [7, 1], until: 150, atk: 0.6 }], [0.5, "soldier", 1, 1, 0, POST(7, 3, 34)], [0.5, "soldier", 2, 1, 0, POST(7, 4, 40)],
        [12, "sapper", 3, 1], [22, "crawler", 0, 1], [34, "soldier", 1, 1, 0, TUN],
        [36, "soldier", 2, 2, 2], [44, "sapper", 0, 1, 0, WALL], [50, "gloomrunner", 2, 2, 1.4, TUNS], [56, "gloomrunner", 1, 1], [62, "drone", 0, 1, 0, AIR("soldier")], [68, "soldier", 3, 2, 2], [74, "soldier", 2, 2, 2],
        [94, "sapper", 2, 1], [98, "gloomrunner", 0, 1], [104, "soldier", 1, 2, 2, TUNS], [110, "crawler", 3, 2, 1.5], [114, "drone", 2, 1, 0, AIR("gloomrunner")], [120, "sapper", 1, 1, 0, TUN], [126, "soldier", 0, 1], [132, "soldier", 3, 2, 2], [138, "crawler", 2, 1, 0, TUN],
        [148, "sapper", 0, 1, 0, WALL], [154, "gloomrunner", 1, 1, 0, TUN], [160, "soldier", 3, 2, 2], [166, "drone", 1, 1, 0, AIR("soldier")], [172, "gloomrunner", 2, 2, 2, TUNS], [178, "soldier", 0, 2, 2]]); })(),
      boss: ["", ""], desc: "판 안쪽에 문이 넷, 서쪽에 방어 지점이 둘입니다. 동쪽 끝 땅굴은 두 방어 지점 사이 (0,3)으로 이어지고, 땅굴로 간 적은 그 사이 칸을 건너뜁니다. 땅굴 어귀와 북쪽 길은 어둡습니다.",
      lose: "문을 바라보는 저지선 뒤로 땅굴의 적이 올라옵니다. 횃불로 땅굴 어귀 (1,3)을 밝혀 서쪽을 보고 막으세요. 공병은 담장 위의 가사인격부터 쏩니다." },
    // a story-only entry: the confessional (no battle, no cost)
    { code: "WL-ST", name: "고해실", map: MAP_C3.nave, bg: null, hz: 0.5, ep: 3, story: true, startCost: 10, mul: { hp: 1, atk: 1, def: 1 }, waves: [],
      boss: ["", ""], desc: "대관식이 끝난 밤. 성당 뒷문은 열려 있었고, 고해실에는 불이 켜져 있었다.", lose: "" },
    // WL-06. Question: which light do we keep, when keeping it means standing where they walk? (type: keep a light alive; formula broken: "the point's doorstep is the last line")
    // gates: 0 the north road (9,0), 1 the yard (5,3); points: (1,5) west, (11,5) east. The north road goes round by the west to the west point under the west lamp (0,3).
    // The yard empties only by the ladder (8,4): its foes walk the whole wall round (south wall, west wall, north wall) and come down the ladder (10,3) to the east point,
    // whose doorstep is dark. The snuffers walk the same way and put out every lamp they pass that nobody stands right beside: the south lamp (6,6) is kept only from (6,5),
    // the yard lamp (4,3) from (4,2)/(3,3), the north-east lamp (10,1) from (10,2). A wall gunner sits on the north wall from the start.
    // Pass 2: the lapis marksman stands on the north road by its gate (9,1) from the start until 150 s (0.6 attack here); the seer (half attack here) first alone at 86 s from the yard, again at 146 s;
    // gloom runners for the dogs
    { code: "WL-06", name: "우구몽 농장", map: MAP_C3.wl6, bg: null, hz: 0.5, ep: 3, startCost: 14, mul: { hp: 1, atk: 1, def: 0.85 }, rmul: { hp: 1, atk: 0.9 },
      climbAll: true, lamps: { r: 1, darkDeploy: false }, torch: true,
      waves: (() => { const E4 = { via: [[9, 4]] }, SW = (t) => ({ via: [[7, 5, { until: t }]] }), NW = (t) => ({ via: [[1, 2, { until: t }]] }), NWALL = (t) => ({ via: [[6, 2, { until: t }]] });
        return W1([[0.5, "longrifle3", 0, 1, 0, { at: [9, 1], until: 150, atk: 0.6 }], [0.5, "wallgunner", 1, 1, 0, { at: [7, 2], until: 70 }], [0.5, "soldier", 0, 1, 0, { at: [3, 1], until: 30 }],
        [10, "snuffer", 1, 1], [18, "soldier", 0, 2, 2.5], [28, "gloomrunner", 1, 1],
        [36, "escalader", 1, 2, 2, E4], [44, "soldier", 0, 2, 2, NW(54)], [50, "snuffer", 1, 1, 0, SW(62)], [56, "gloomrunner", 0, 2, 1.4], [62, "escalader", 1, 2, 2], [70, "wallgunner", 0, 1], [76, "soldier", 1, 2, 2, NWALL(90)], [86, "seer", 1, 1, 0, { atk: 0.5 }],
        [96, "snuffer", 1, 1], [100, "soldier", 0, 2, 2], [104, "escalader", 1, 2, 2, E4], [110, "gloomrunner", 0, 3, 1.2], [116, "wallgunner", 1, 1], [122, "snuffer", 1, 1, 0, SW(134)], [128, "soldier", 0, 2, 2, NW(140)], [134, "escalader", 1, 2, 2],
        [146, "seer", 1, 1, 0, { atk: 0.5 }], [148, "gloomrunner", 1, 2, 1.3], [152, "soldier", 0, 2, 2], [158, "snuffer", 1, 1, 0, NWALL(170)], [164, "escalader", 1, 2, 2, E4], [172, "soldier", 0, 2, 2]]); })(),
      boss: ["", ""], desc: "농장. 안마당 문에서 나온 적은 사다리 (8,4)로만 나가, 담장 위를 한 바퀴 돌아 동쪽 방어 지점으로 내려옵니다. 북쪽 길의 적은 서쪽으로 돕니다. 소등부는 지나가며 곁의 등을 끕니다. 등 바로 옆 칸에 누가 서 있으면 끄지 못합니다.",
      lose: "동쪽 방어 지점 앞은 어두워서 설 수 없습니다. 남쪽 담장의 등은 (6,5)에 선 가사인격만 지킬 수 있고, 그 칸은 안마당의 적이 모두 지나는 담장 위입니다." },
    // a story-only entry between the two farms: the empty saddle (no battle, no cost)
    { code: "WL-ST2", name: "빈 안장", map: MAP_C3.farm, bg: null, hz: 0.5, ep: 3, story: true, startCost: 10, mul: { hp: 1, atk: 1, def: 1 }, waves: [], boss: ["", ""], desc: "돌격과 돌격 사이. 헛간 벽 틈으로, 안장이 빈 말 한 마리가 보였다.", lose: "" },
    // WL-07. Question: the one lamp is at the end of the road; will it still be burning when they get there? (type: defence in depth along one long road; formula broken: "what is lit stays lit")
    // gates: 0-2 the three north gates (6..8,0), 3 the yard gate (4,3), 4 the south yard gate (4,5); the point (4,0). The long loop: down the ladder (9,1), west along the north wall,
    // down (5,3) into the yard, out by the ladder (9,5), west along the south wall, up the west road by the ladder (2,5) to the point. The yard gates join it in the yard.
    // The only lamp (4,2) lights the point's doorstep; the lamp-breakers walk the north wall right past it and break it whoever stands by. Two pickets in the yard from the start. The blades come after the first lamp-breaker: whatever reaches a dark doorstep reaches it at full strength.
    // Pass 2: the balloon circles the yard all stage; the lapis marksman stands by the north gates (7,1) from the start until 160 s (0.6 attack here); the nightmare (half health, 0.7 attack here), one, at 150 s right after the second lamp-breaker:
    // once the lamp is broken every back is to the dark. Gloom runners for the dogs and ladder men
    { code: "WL-07", name: "라에생트", map: MAP_C3.wl7, bg: null, hz: 0.5, ep: 3, startCost: 14, mul: { hp: 1.3, atk: 1.3, def: 0.85 }, rmul: { hp: 1, atk: 0.9 },
      climbAll: true, lamps: { r: 1, darkDeploy: false }, torch: true,
      waves: (() => { const MID = { via: [[6, 4]] }, SPUR = (t) => ({ via: [[1, 4, { until: t }]] }), SOUTH = (t) => ({ via: [[6, 6, { until: t }]] }), POST = (x, y, t) => ({ at: [x, y], until: t });
        return W1([[0.5, "balloon", 0, 1, 0, { loop: [[2, 1], [2, 4], [8, 4], [8, 1]] }], [0.5, "longrifle3", 2, 1, 0, { at: [7, 1], until: 160, atk: 0.6 }], [0.5, "soldier", 3, 1, 0, POST(7, 4, 30)], [0.5, "soldier", 4, 1, 0, POST(8, 4, 44)],
        [6, "soldier", 0, 1], [16, "gloomrunner", 2, 2, 1.5], [26, "soldier", 3, 1, 0, MID],
        [34, "soldier", 1, 2, 2], [42, "soldier", 4, 2, 2], [50, "nightblade", 0, 1], [56, "gloomrunner", 3, 2, 1.4, MID], [62, "soldier", 2, 2, 2, SPUR(100)], [70, "gloomrunner", 4, 1], [150, "nightmare", 1, 1, 0, { hp: 0.5, atk: 0.7 }],
        [96, "nightblade", 0, 2, 2], [100, "lampbreaker", 2, 1], [106, "nightblade", 3, 2, 2], [112, "gloomrunner", 1, 3, 1.2], [118, "nightblade", 4, 2, 2, SOUTH(132)], [124, "nightblade", 2, 2, 2], [130, "soldier", 0, 2, 2], [136, "gloomrunner", 4, 2, 2, MID],
        [146, "lampbreaker", 0, 1], [150, "nightblade", 3, 2, 2], [156, "gloomrunner", 2, 2, 1.3], [162, "nightblade", 1, 2, 2, SPUR(180)], [170, "nightblade", 4, 2, 2]]); })(),
      boss: ["", ""], desc: "북쪽 문의 적은 사다리로 북쪽 담장에 올라 안마당으로 내려왔다가, 남쪽 담장을 돌아 서쪽 길로 방어 지점까지 갑니다. 등은 방어 지점 앞의 하나뿐입니다. 등 깨는 자는 곁에 누가 서 있어도 등을 깹니다.",
      lose: "등 깨는 자는 북쪽 담장을 걸어 등 곁을 지납니다. 횃불로 북쪽 담장 가운데를 밝혀 거기서 쏘세요. 북쪽 문의 적은 그 담장과 바로 아래 안마당 줄을 차례로 지납니다." },
    // WL-08. Question: when every square we can stand on is behind the points, which way is the front? (type: inside out; formula broken: "the medic stands behind")
    // gates: 0 the upper road (12,1), 1 the second road (12,2), 2 the yard (3,5), 3 the west road (0,6), 4 the lower road (5,6); points (3,1) and (3,2), side by side. The open field before
    // the points is dark. The only lit squares near the points are behind them, by the west lamp (0,2), which only (1,2) keeps. The yard's foes walk the yard wall (5..8,5) under the south lamp,
    // the lower road's go up the west wall and along the north wall to the ladder (9,3), or east under the lamp to the tunnel (12,7) -> (0,7) and up the west road behind the points.
    // Drones set men down on the west road (1,4). A sapper sits in the dark yard from the start.
    // Pass 2: the lapis marksman stands on the upper road (11,1) from the start until 100 s (0.6 attack here); the supply wagon (0.35 health here) rolls in alone on the second road at
    // 178 s, last, behind the last soldiers; only a block of four (the defender's smite) stops it. Gloom runners for the night raiders and ladder men
    { code: "WL-08", name: "몽생장 능선", map: MAP_C3.wl8, bg: null, hz: 0.5, ep: 3, startCost: 16, mul: { hp: 1.2, atk: 1.2, def: 0.85 }, rmul: { hp: 1, atk: 0.9 },
      climbAll: true, lamps: { r: 1, darkDeploy: false }, torch: true,
      tunnels: [{ a: [12, 7], b: [0, 7], t: 5 }],
      waves: (() => { const TUN = { via: [[12, 7]], tun: true }, UP = { via: [[10, 4]] }, YW = (t) => ({ via: [[7, 4, { until: t }]] }), AIR = (type) => ({ land: [1, 4], drop: type });
        return W1([[0.5, "longrifle3", 0, 1, 0, { at: [11, 1], until: 100, atk: 0.6 }], [0.5, "sapper", 2, 1, 0, { at: [7, 4], until: 60 }],
        [14, "soldier", 1, 2, 2.5], [26, "gloomrunner", 0, 1], [32, "snuffer", 3, 1],
        [36, "gloomrunner", 2, 2, 2], [42, "soldier", 4, 2, 2, TUN], [48, "gloomrunner", 0, 1], [54, "soldier", 1, 2, 2], [60, "drone", 1, 1, 0, AIR("soldier")], [66, "soldier", 4, 2, 2], [72, "soldier", 3, 2, 2], [78, "sapper", 2, 1, 0, YW(90)],
        [96, "gloomrunner", 4, 2, 2, TUN], [100, "soldier", 0, 2, 2, UP], [104, "snuffer", 3, 1], [108, "soldier", 2, 2, 2], [112, "drone", 0, 2, 3, AIR("gloomrunner")], [118, "soldier", 1, 2, 2], [124, "sapper", 4, 1], [130, "soldier", 4, 2, 2, TUN], [136, "gloomrunner", 1, 2, 2],
        [146, "gloomrunner", 2, 2, 2], [152, "soldier", 3, 2, 2], [158, "soldier", 0, 2, 2], [164, "gloomrunner", 4, 2, 2, TUN], [170, "drone", 1, 1, 0, AIR("soldier")], [176, "soldier", 1, 2, 2], [178, "wagon", 1, 1, 0, { hp: 0.35 }]]); })(),
      boss: ["", ""], desc: "능선의 성채. 방어 지점 둘이 나란히 있고, 그 앞 들판은 어둡습니다. 밝은 칸은 방어 지점 뒤의 서쪽 등 곁과 남쪽 등 곁뿐입니다. 아랫길의 적은 땅굴 (12,7)로 서쪽 끝 (0,7)에 나와 방어 지점 뒤로 올라오거나, 담장을 돌아 윗길로 넘어갑니다.",
      lose: "방어 지점 뒤의 서쪽 길도 앞입니다. 서쪽 등은 (1,2)에 선 가사인격만 지킬 수 있습니다. 들판 쪽은 횃불로 밝혀 막으세요." },
    // WL-09. Question: he gets up again if he falls in the dark, and he puts out the nearest lamp when he is half gone: where do we let him fall? (type: the boss hunt; formula broken:
    // "hit the boss as hard and as soon as you can"). The boss's question: where will he fall? Empty armour, like him, gets up again if it falls in the dark.
    // gates: 0 (6,0), 1 (10,0), 2 (11,5), 3 (11,7); points (0,1), (0,5), (0,7). The tunnel (10,1) -> (2,2) comes up right before the top point. The east lamp (9,4) lights the squares
    // where the gates 1-3 come in; the west lamp (1,3) the top point's way. The crowned armour comes last from gate 1, the farthest from the points, on foot down the middle road.
    // Pass 2: the balloon circles the middle and bottom roads all stage; the lapis marksman stands by the tunnel mouth (10,2) from the start until 190 s, after the crowned armour (0.6 attack here);
    // gloom runners for the open-road stragglers, the night raiders and the lamp-snuffers (the crowned armour still puts a lamp out)
    { code: "WL-09", name: "튈르리", map: MAP_C3.wl9, bg: null, hz: 0.5, ep: 3, startCost: 20, mul: { hp: 1, atk: 1, def: 0.85 }, rmul: { hp: 1, atk: 0.9 },
      climbAll: true, lamps: { r: 1, darkDeploy: false }, torch: true,
      tunnels: [{ a: [10, 1], b: [2, 2], t: 5 }],
      waves: (() => { const TUN = { tun: true }, UP = { via: [[10, 6], [9, 5]] }, DOWN = { via: [[9, 6]] }, WALL = (t) => ({ via: [[3, 1, { until: t }]] }), EDGE = (t) => ({ via: [[9, 5, { until: t }]] });
        return W1([[0.5, "balloon", 0, 1, 0, { loop: [[3, 5], [3, 7], [9, 7], [9, 5]] }], [0.5, "longrifle3", 1, 1, 0, { at: [10, 2], until: 190, atk: 0.6 }], [0.5, "armour", 2, 1, 0, { at: [8, 5], until: 40 }], [0.5, "soldier", 3, 1, 0, { at: [9, 7], until: 84 }],
        [16, "soldier", 2, 1], [26, "soldier", 0, 1], [34, "armour", 3, 1, 0, UP],
        [40, "soldier", 1, 1], [46, "gloomrunner", 2, 1], [52, "strag", 1, 2, 2, TUN], [58, "gloomrunner", 0, 1, 0, WALL(70)], [64, "armour", 3, 1], [70, "soldier", 2, 2, 2, DOWN], [76, "soldier", 1, 1],
        [94, "armour", 2, 1], [98, "soldier", 0, 2, 2], [102, "gloomrunner", 3, 1, 0, UP], [106, "strag", 1, 3, 1.5, TUN], [112, "gloomrunner", 2, 2, 2, EDGE(120)], [118, "soldier", 3, 2, 2], [124, "kingarmour", 1, 1], [130, "armour", 0, 1],
        [140, "gloomrunner", 3, 2, 2, UP], [146, "soldier", 2, 2, 2], [152, "gloomrunner", 0, 3, 1.2], [158, "armour", 1, 1], [166, "soldier", 2, 2, 2], [174, "soldier", 3, 2, 2, DOWN]]); })(),
      boss: ["경고: 빈 왕좌", "빈 왕좌의 갑주 · WARNING"], desc: "궁 앞. 방어 지점 셋, 문 넷. 오른쪽 위 문 바로 아래의 땅굴은 맨 위 방어 지점 코앞 (2,2)로 나옵니다. 빈 갑주는 어둠 속에서 쓰러지면 다시 일어납니다. 빈 왕좌의 갑주는 마지막에, 방어 지점에서 가장 먼 북동쪽 문으로 걸어옵니다.",
      lose: "왕좌의 갑주는 체력이 절반이 되면 가장 가까운 등을 끕니다. 등 곁이 아니라 횃불로 밝힌 칸에서 쓰러뜨리세요. (6,6)에 놓은 횃불 하나가 가운데 길과 아랫길을 함께 비춥니다." },
    // ---- chapter 4 「발푸르기스의 밤」 (E04-01 .. E04-10): the roofs over the witches' night. Board letters from the design (scratchpad chplan/04/maps.js) go through CH4MAP;
    // the chapter's rules are switched on by stage.ch4 (game.js ch4Init / ch4Step). Every gate number below is the order of the S squares on the board, row by row
    // E04-01 「네 굴뚝」 11x7: 연기 다리 넷 가운데 어느 것을 끊어야 두 문의 적이 한 칸 (1,4)로 모이는가. gates 0 (5,0) middle roof, 1 (9,0) east roof; point (0,5). The cats go by the skylight (9,3)->(1,3) (tun). Two lemures stand on (2,2) and (1,2) till 35 s and 55 s
    CH4({ code: "E04-01",
      name: "네 굴뚝",
      startCost: 12,
      mul: { hp: 1, atk: 1, def: 0.85 },
      map: ["#####SW##S#","#h.C_.,hC,#","#,,^^,.,^,#","Woh__h,,_i#","W..C_,,.C,#","B,,^^,,,^.#","#WW####W###"],
      chimneys: [{ at: [3, 1], bridge: [[3, 2], [4, 2]] }, { at: [3, 4], bridge: [[3, 5], [4, 5]] }, { at: [8, 1], bridge: [[8, 2]] }, { at: [8, 4], bridge: [[8, 5]] }],
      tunnels: [{ a: [9, 3], b: [1, 3], t: 4 }],
      waves: (() => { const T = { tun: true }, SE = { via: [[8, 5]] }, NE = { via: [[8, 2]] }, SW = { via: [[3, 5]] };
        return W1([[0.5, "lemure", 0, 1, 0, { at: [2, 2], until: 35 }], [0.5, "lemure", 0, 1, 0, { at: [1, 2], until: 55 }],
          [8, "lemure", 0, 2, 3], [15, "lemure", 1, 2, 3, SE], [20, "roofcat", 1, 1, 0, T], [20.5, "roofcat", 0, 1, 0, { at: [9, 5], until: 21, via: [[8, 2]] }], [20.5, "roofcat", 0, 1, 0, { at: [9, 5], until: 21.5 }],
          [30, "wisp", 0, 2, 2.5, SW], [38, "sweep", 1, 1], [46, "lemure", 1, 3, 2.5, NE], [56, "roofcat", 1, 2, 1.5, T], [64, "wisp", 1, 2, 2, SE],
          [74, "lemure", 0, 3, 2, SW], [84, "sweep", 0, 1], [92, "roofcat", 1, 2, 1.2], [102, "wisp", 0, 2, 2], [112, "lemure", 1, 3, 2, SE], [124, "roofcat", 1, 1, 0, T], [132, "sweep", 1, 1],
          [140, "lemure", 0, 2, 2.5], [148, "wisp", 1, 2, 2, NE], [158, "roofcat", 1, 2, 1.2, T], [166, "lemure", 0, 3, 2]]); })(),
      desc: "지붕 셋. 굴뚝 옆 칸에 서면 그 굴뚝의 연기 다리가 4초 뒤 끊기고, 떠나면 6초 뒤 이어집니다. 다리가 끊긴 지붕의 적은 30초 뒤 뛰어넘습니다. 고양이는 천창을 탑니다.",
      lose: "다리 넷을 다 끊으면 한꺼번에 뜁니다. 서남 굴뚝 하나만 막아 모든 길이 (1,4)를 지나게 하세요." }),
    // E04-02 「지붕 위」 12x7: 방어 지점은 서쪽 끝에 남고 유이는 동쪽 끝으로 걸어간다. 그녀가 건널 다리를 언제 열고 언제 닫는가. gates 0 (6,0) middle roof, 1 (10,1) east roof; point (0,3). Yui walks west roof -> middle (6,4) -> east (10,4) -> (10,5). Three crows sit on the east roof till she reaches (6,4)
    CH4({ code: "E04-02",
      name: "지붕 위",
      startCost: 18,
      mul: { hp: 1.4, atk: 1.2, def: 0.85 },
      map: ["######S##W##","#h.C_h,.C,S#","#,,^^,,,^.,W","B,,_W.h,W,h#","W,.C_,,.^,,#","#h,^^,.,C.,W","##W####W####"],
      chimneys: [{ at: [3, 1], bridge: [[3, 2], [4, 2]] }, { at: [3, 4], bridge: [[3, 5], [4, 5]] }, { at: [8, 1], bridge: [[8, 2]] }, { at: [8, 5], bridge: [[8, 4]] }],
      vip: { name: "유이", hp: 10000, def: 120, at: [1, 3], sprite: "yui", route: [{ to: [6, 4], wait: 40 }, { to: [10, 4], wait: 40 }, { to: [10, 5], wait: 0 }], speed: 0.6 },
      goal: { win: [{ k: "clear" }], lose: [{ k: "life" }, { k: "vipDead" }], text: { win: "적을 모두 막아 낸다.", lose: "목숨이 다하거나 유이가 쓰러진다." }, hud: [{ vip: true }] },
      waves: (() => { const V = { aim: "vip" }, NW = { via: [[3, 2]] }, SW = { via: [[3, 5]] };
        return W1([[0.5, "crow", 1, 1, 0, { roost: [10, 2], wakeLeg: 1, until: 130 }], [0.5, "crow", 1, 1, 0, { roost: [9, 3], wakeLeg: 1, until: 130 }], [0.5, "crow", 1, 1, 0, { roost: [9, 1], wakeLeg: 1, until: 130 }],
          [8, "lemure", 0, 2, 3, NW], [16, "lemure", 0, 2, 3, SW], [24, "lemure", 1, 2, 2.5], [32, "broom", 0, 1, 0, NW], [40, "lemure", 1, 2, 2],
          [50, "lemure", 0, 2, 2, V], [58, "broom", 1, 1, 0, V], [66, "sweep", 0, 1], [72, "lemure", 1, 3, 2, V], [82, "crow", 1, 2, 2],
          [92, "broom", 0, 1, 0, V], [100, "lemure", 0, 2, 2, SW], [108, "lemure", 1, 2, 2, V], [118, "sweep", 1, 1], [126, "crow", 0, 2, 2],
          [136, "broom", 1, 1, 0, V], [144, "lemure", 0, 3, 2, NW], [156, "lemure", 1, 2, 2, V], [166, "broom", 0, 1]]); })(),
      desc: "방어 지점은 서쪽 끝, 유이는 동쪽 끝까지 걸어갑니다. 그녀도 연기 다리가 있어야 건넙니다. 까마귀는 날아서 유이를 노립니다.",
      lose: "굴뚝을 계속 막으면 유이가 묶입니다. 그녀가 건너는 동안만 다리를 여세요." }),
    // E04-03 「잠옷 바람의 사람들」 12x7: 지붕에 선 시민 넷은 둘레 8칸에 적이 머무는 동안 공포가 찬다. 유이 곁 2칸만 차지 않는다. 유이는 45초에 서쪽 지붕에서 동쪽 지붕으로 건너간다. gates 0 (8,0) east roof, 1 (0,5) west roof; points (3,0) west, (11,5) east. Yui crosses at 45 s. Two pickpockets wait on (10,2), (10,4) till 60 s and 85 s
    CH4({ code: "E04-03",
      name: "잠옷 바람의 사람들",
      startCost: 14,
      mul: { hp: 1, atk: 1, def: 0.85 },
      map: ["#W#B####S###","#.,,C_h,,.W#","#h,,.^^,.,,#","W,.h,WW,h,.#","#,,h.W_C.,,#","S,,,,^^,,.,B","###WW###W###"],
      chimneys: [{ at: [4, 1], bridge: [[5, 2], [6, 2]] }, { at: [7, 4], bridge: [[6, 5], [5, 5]] }],
      citizens: [[1, 3], [2, 1], [4, 5], [9, 3]],
      citRules: { rate: 6.5 },
      vip: { name: "유이", hp: 7000, def: 120, at: [3, 2], sprite: "yui", route: [{ to: [7, 2], wait: 45 }, { to: [9, 2], wait: 45 }], speed: 0.6 },
      goal: { win: [{ k: "clear" }], lose: [{ k: "life" }, { k: "vipDead" }], text: { win: "적을 모두 막아 낸다.", lose: "목숨이 다하거나 유이가 쓰러진다." }, hud: [{ vip: true }] },
      waves: (() => { const N = { via: [[5, 2]] }, S = { via: [[5, 5]] }, V = { aim: "vip" };
        return W1([[0.5, "pickpocket", 0, 1, 0, { at: [10, 2], until: 60 }], [0.5, "pickpocket", 0, 1, 0, { at: [10, 4], until: 85 }],
          [8, "lemure", 1, 2, 3], [16, "lemure", 0, 2, 3], [24, "roofcat", 1, 2, 1.5], [32, "lemure", 0, 2, 2, N], [40, "pickpocket", 1, 1],
          [48, "lemure", 1, 2, 2, S], [56, "roofcat", 0, 2, 1.5], [64, "lemure", 0, 2, 2, V], [72, "pickpocket", 0, 1], [80, "lemure", 1, 3, 2],
          [92, "roofcat", 1, 2, 1.5, S], [100, "lemure", 0, 2, 2], [110, "pickpocket", 1, 1, 0, N], [118, "lemure", 0, 2, 2, V], [128, "roofcat", 0, 2, 1.2],
          [138, "lemure", 1, 2, 2], [148, "pickpocket", 0, 1], [158, "lemure", 0, 2, 2, S]]); })(),
      desc: "지붕 위에 잠옷 바람의 시민 넷이 서 있습니다. 둘레에 적이 머무는 동안 겁이 차고, 가득 차면 달아나 목숨이 하나 줄어듭니다. 유이 곁 두 칸의 시민은 겁먹지 않습니다.",
      lose: "시민 곁에서 적을 오래 붙들지 마세요. 유이가 없는 쪽에서는 시민에게서 떨어진 칸에서 받으세요." }),
    // E04-04 「마녀의 부엌」 12x7: 연기를 두른 적은 축제의 불꽃이 터져야 보인다. 도화선은 4칸(4초), 축제는 20초, 다시 붙이기까지 40초. 무엇이 다리를 건넌 직후에 터뜨릴 것인가. gates 0 (10,1) north, 1 (11,4) south; points (0,2), (0,5). Two clowns stand cloaked on (8,3), (8,4) till 70 s and 90 s; the child comes at 45 s and 125 s
    CH4({ code: "E04-04",
      name: "마녀의 부엌",
      startCost: 24,
      mul: { hp: 0.65, atk: 0.8, def: 0.85 },
      map: ["########W###","#h,.,.C,,,S#","B,,W,,^,.,,#","W,hW,h_h,Wi#","W,.,,.C,,W,S","B,.,,,^vuvv#","#oW##h#P##f#"],
      chimneys: [{ at: [6, 1], bridge: [[6, 2]] }, { at: [6, 4], bridge: [[6, 5]] }],
      tunnels: [{ a: [10, 3], b: [1, 6], t: 4 }],
      fuses: [{ from: [10, 6], path: [[10, 5], [9, 5], [8, 5], [7, 5]], box: [7, 6] }],
      waves: (() => { const T = { tun: true }, N = { via: [[6, 2]] }, S = { via: [[6, 5]] };
        return W1([[0.5, "clown", 1, 1, 0, { at: [8, 3], until: 70 }], [0.5, "clown", 1, 1, 0, { at: [8, 4], until: 90 }],
          [8, "lemure", 0, 2, 3, N], [16, "dancer", 1, 2, 2, S], [24, "lemure", 1, 2, 2.5], [32, "dancer", 0, 3, 1.5, N], [45, "lantchild", 1, 1],
          [52, "dancer", 1, 3, 1.5, S], [60, "roofcat", 0, 1, 0, T], [68, "lemure", 0, 2, 2], [78, "dancer", 0, 3, 1.5, N], [88, "clown", 1, 1, 0, S],
          [98, "lemure", 1, 2, 2, S], [106, "dancer", 1, 3, 1.5], [116, "roofcat", 0, 2, 1.2, N], [125, "lantchild", 1, 1], [132, "dancer", 0, 3, 1.5, N], [146, "clown", 0, 1, 0, N],
          [154, "lemure", 1, 2, 2], [162, "dancer", 1, 3, 1.5, S]]); })(),
      desc: "점화구를 누르면 도화선이 1초에 한 칸씩 탑니다. 폭죽 상자에 닿으면 20초 축제: 연기를 두른 적이 드러나지만 우리 편은 조금씩 다치고, 광대는 드러나면 불을 뿜습니다. 다시 붙이려면 40초.",
      lose: "광대는 숨은 채로 막아서 잡고, 축제는 춤꾼 떼가 다리를 건넌 뒤에 쓰세요. 도화선 칸에 서 있으면 불이 그 앞에서 멈춥니다." }),
    // E04-05 「널다리」 12x8: 판자 한 장(카드)을 판자 자리 (6,4)나 (1,4)에 깔면 그 자리로 누구나 건넌다. 유이는 판자가 있어야 빨리 건너지만 그 판자는 문0의 적에게도 지름길이다. gates 0 (5,0), 1 (11,1) north roof; point (0,6) south roof. Plank slots (1,4), (6,4). Paper lamps cross at 30 s with soot thieves under them; two broom witches land on (9,5) at 80 s
    CH4({ code: "E04-05",
      name: "널다리",
      startCost: 24,
      mul: { hp: 1, atk: 1, def: 0.85 },
      map: ["#W###S##W#W#","#,,.,,,h,,,S","#h,W,.,,.W.#","#,,,C.,h,,C#","#p_^WWp__^_#","W,.,,h,.,,,#","B,,,.,,W,.,W","##W##W######"],
      chimneys: [{ at: [4, 3], bridge: [[3, 4]] }, { at: [10, 3], bridge: [[9, 4]] }],
      plank: { slots: [[1, 4], [6, 4]], cd: 15 },
      vip: { name: "유이", hp: 7000, def: 120, at: [2, 1], sprite: "yui", route: [{ to: [6, 3], wait: 35 }, { to: [6, 5], wait: 35 }, { to: [10, 6], wait: 0 }], speed: 0.6 },
      goal: { win: [{ k: "clear" }], lose: [{ k: "life" }, { k: "vipDead" }], text: { win: "적을 모두 막아 낸다.", lose: "목숨이 다하거나 유이가 쓰러진다." }, hud: [{ vip: true }] },
      waves: (() => { const W = { via: [[3, 4]] }, E = { via: [[9, 4]] }, V = { aim: "vip" };
        return W1([[8, "lemure", 0, 2, 3, W], [16, "lemure", 1, 2, 3], [24, "roofcat", 0, 2, 1.5, E],
          [30, "paperlamp", 0, 6, 1.2], [31, "skulker", 0, 4, 1.8, W], [46, "lemure", 1, 2, 2], [54, "skulker", 1, 2, 2], [62, "lemure", 0, 2, 2, V],
          [72, "roofcat", 1, 2, 1.5], [80, "broom", 0, 2, 0.8, { at: [9, 5], until: 81, landFx: true }], [90, "skulker", 0, 2, 2, E], [98, "lemure", 1, 3, 2],
          [108, "paperlamp", 1, 4, 1.5], [109, "skulker", 1, 2, 2], [120, "broom", 1, 1, 0, E], [128, "lemure", 0, 2, 2, W], [138, "roofcat", 1, 2, 1.2, E],
          [148, "skulker", 0, 2, 2], [158, "lemure", 1, 2, 2]]); })(),
      desc: "판자 카드: 판자 자리에 깔면 그 칸으로 누구나 건넙니다. 바로 깔리고 바로 거둬지며, 거두면 15초 뒤 다시 쓸 수 있습니다. 유이는 판자가 있어야 남쪽으로 빨리 건넙니다.",
      lose: "판자는 적에게도 지름길입니다. 유이가 건널 때만 깔고, 건너면 바로 거두세요." }),
    // E04-06 「여덟 시의 고해」 12x8: 방어 지점이 가운데 지붕 한복판에 있고 문 셋이 양 날개에 있다. 천창 둘은 날개 끝에서 가운데 지붕의 반대편으로 솟는다. 방어 지점의 네 앞 칸 가운데 세울 수 있는 것은 북쪽 (6,2) 하나. gates 0 (0,1), 1 (11,3), 2 (0,6); the point (6,3) in the middle. Skylights (10,1)->(6,6), (1,5)->(5,1). Three crossbowmen wait on the east wing till 70, 95, 120 s
    CH4({ code: "E04-06",
      name: "여덟 시의 고해",
      startCost: 30,
      mul: { hp: 0.48, atk: 0.65, def: 0.85 },
      map: ["######W##W##","S,.C,o,h_,i#","#,,^,,.,C.,W","#h,Wh,B,^,,S","W,._.,,,_h,W","#i,C.,h.C,,#","S,,^,,o,^,,#","####W#WW####"],
      chimneys: [{ at: [3, 1], bridge: [[3, 2]] }, { at: [3, 5], bridge: [[3, 6]] }, { at: [8, 2], bridge: [[8, 3]] }, { at: [8, 5], bridge: [[8, 6]] }],
      tunnels: [{ a: [10, 1], b: [6, 6], t: 4 }, { a: [1, 5], b: [5, 1], t: 4 }],
      rmul: { hp: 0.6, atk: 0.5 },
      waves: (() => { const T = { tun: true }, SE = { via: [[8, 6]] };
        return W1([[0.5, "sharpshooter", 1, 1, 0, { at: [10, 5], until: 70 }], [0.5, "sharpshooter", 1, 1, 0, { at: [10, 4], until: 95 }], [0.5, "sharpshooter", 1, 1, 0, { at: [10, 2], until: 120 }],
          [8, "lemure", 0, 2, 3], [14, "lemure", 2, 2, 3], [22, "roofcat", 1, 2, 1.5, T], [30, "cauldron", 0, 1], [38, "lemure", 1, 2, 2.5, SE], [46, "roofcat", 2, 2, 1.5, T],
          [54, "lemure", 2, 2, 2], [62, "cauldron", 1, 1], [70, "lemure", 0, 3, 2], [80, "roofcat", 1, 2, 1.2, T], [88, "sweep", 2, 1], [96, "cauldron", 2, 1],
          [104, "lemure", 1, 2, 2, SE], [112, "roofcat", 2, 2, 1.2, T], [120, "lemure", 0, 2, 2], [130, "cauldron", 0, 1], [138, "roofcat", 1, 2, 1.2, T], [148, "lemure", 2, 3, 2], [158, "sweep", 0, 1]]); })(),
      desc: "방어 지점이 가운데 지붕 한복판에 있고, 문 셋은 양 날개에 있습니다. 천창 둘은 날개 끝에서 방어 지점 반대편으로 솟습니다. 가마솥은 막아선 가사인격을 삼킵니다.",
      lose: "굴뚝 넷을 다 막으면 천창으로 오는 적을 받을 손이 없습니다. 가마솥은 막지 말고 고지에서 깎으세요." }),
    // E04-07 「브로켄 오르는 길」 13x8: 세 단을 지그재그로 오르는 27칸 외길. 브로켄의 그림자는 열린 굴뚝에서 2칸 안(연기 속)에서는 맞지 않는다. 굴뚝을 막아 다리 머리에 30초 세워 둔 동안만 깎을 수 있다. gates 0 (12,4) middle tier, 1 (0,6) bottom tier; point (12,1) top tier. Skylight (5,6)->(6,3). A shadow stands on (1,4) till 90 s; the second comes at 140 s
    // board change from the design: the skylight's mouth (6,3) lay between the middle and the top tier and joined them on foot (the 27-square road became 15); the mouth is moved up to (6,2) and (6,3) is night air
    CH4({ code: "E04-07",
      name: "브로켄 오르는 길",
      startCost: 28,
      mul: { hp: 0.55, atk: 0.7, def: 0.85 },
      map: ["##W####WhW###","#h,,.,,,,,,,B","W,.W,,o.,.,,#","#^C_W____h__#","#,,.uvv,.,,,S","#___f_P___C^#","S,,.,i,,.,.,#","#############"],
      chimneys: [{ at: [2, 3], bridge: [[1, 3]] }, { at: [10, 5], bridge: [[11, 5]] }],
      tunnels: [{ a: [5, 6], b: [6, 2], t: 4 }],
      fuses: [{ from: [4, 5], path: [[4, 4], [5, 4], [6, 4]], box: [6, 5] }],
      waves: (() => { const T = { tun: true };
        return W1([[0.5, "shadow", 0, 1, 0, { at: [1, 4], until: 90 }],
          [8, "lemure", 1, 2, 3], [16, "lemure", 0, 2, 3], [24, "roofcat", 1, 2, 1.5, T], [32, "dancer", 1, 2, 2], [42, "stallwitch", 0, 1], [50, "lemure", 1, 2, 2],
          [58, "roofcat", 1, 2, 1.2, T], [66, "dancer", 0, 2, 2], [76, "lemure", 1, 3, 2], [86, "stallwitch", 1, 1], [96, "roofcat", 1, 2, 1.2, T], [104, "dancer", 1, 2, 2],
          [114, "lemure", 0, 2, 2], [124, "lemure", 1, 2, 2], [132, "dancer", 0, 2, 1.5], [140, "shadow", 1, 1], [150, "roofcat", 1, 2, 1.2, T], [160, "lemure", 0, 2, 2]]); })(),
      desc: "세 단을 굽이 오르는 외길. 브로켄의 그림자는 열린 굴뚝 2칸 안과 연기 다리 위에서는 맞지 않습니다. 그 굴뚝을 막아 다리를 끊으면 그는 다리 머리에서 연기 밖에 섭니다.",
      lose: "그림자가 다리 머리에 묶인 30초가 깎는 시간입니다. 화력을 방어 지점 앞이 아니라 막은 굴뚝의 다리 머리로 돌리세요." }),
    // E04-08 「집회」 13x8: 고리 지붕 한가운데 섬에 문이 있다. 코스트를 치는 적 셋(소매치기는 훔치고, 검댕 도둑은 회복을 늦추고, 종복 사제는 상한을 깎는다)이 함께 온다. gates 0 (9,0), 1 (5,3) the island's door, 2 (0,6); points (0,1), (12,6). Four lemures stand round the island's door till 40 s and 75 s, when the acolytes come out
    CH4({ code: "E04-08",
      name: "집회",
      startCost: 24,
      mul: { hp: 0.6, atk: 0.7, def: 0.85 },
      map: ["##W#h##W#S###","B,,,.,,,.,i,#","Woh_C^_h___,#","#.__,S,.^^^,#","#,^^.,,._C_,#","#.C_h_^C_h_.#","S,,.,,,,,.,,B","#W##W####W#W#"],
      chimneys: [{ at: [4, 2], bridge: [[5, 2]] }, { at: [9, 4], bridge: [[8, 3], [9, 3], [10, 3]] }, { at: [2, 5], bridge: [[2, 4], [3, 4]] }, { at: [7, 5], bridge: [[6, 5]] }],
      tunnels: [{ a: [10, 1], b: [1, 2], t: 4 }],
      citizens: [[2, 1], [11, 4], [6, 6]],
      waves: (() => { const T = { tun: true };
        return W1([[0.5, "lemure", 1, 1, 0, { at: [4, 3], until: 40 }], [0.5, "lemure", 1, 1, 0, { at: [6, 3], until: 40 }], [0.5, "lemure", 1, 1, 0, { at: [5, 4], until: 75 }], [0.5, "lemure", 1, 1, 0, { at: [6, 4], until: 75 }],
          [8, "pickpocket", 0, 1], [14, "lemure", 2, 2, 3], [22, "skulker", 2, 2, 2], [30, "roofcat", 0, 2, 1.5], [40, "acolyte", 1, 1], [46, "lemure", 2, 2, 2],
          [54, "skulker", 1, 2, 2], [62, "pickpocket", 2, 1], [75, "acolyte", 1, 1], [80, "lemure", 0, 2, 2], [88, "roofcat", 2, 2, 1.2], [96, "skulker", 0, 2, 2],
          [104, "acolyte", 0, 1], [112, "lemure", 1, 2, 2], [120, "pickpocket", 0, 1], [128, "roofcat", 0, 1, 0, T], [136, "skulker", 2, 2, 2], [146, "acolyte", 1, 1],
          [154, "lemure", 2, 3, 2], [164, "lemure", 0, 2, 2]]); })(),
      desc: "고리 지붕 한가운데 섬에 문이 있습니다. 소매치기는 코스트를 훔치고, 검댕 도둑은 회복을 늦추고, 종복 사제는 코스트 상한을 깎습니다.",
      lose: "비싼 가사인격을 기다리지 말고 값싼 가사인격부터 넓게 세우세요. 섬 문에서 나오는 사제를 먼저 잡으세요." }),
    // E04-09 「바다 축제」 13x8: 배 네 척. 걸어서 이어지는 길은 연기 다리 둘과 우리가 깔 판자 자리 둘뿐이고, 적은 물밑(터널)으로 건넌다. 문이 있는 배에서는 문 옆이 곧 물밑 입구다. 유이는 북서 배에서 남동 배까지 간다. gates 0 (11,1) north-east boat, 1 (0,5) south-west boat; points (0,1), (12,5). Under the water: (9,2)->(3,2), (1,6)->(11,6). The magic marksman stands on (10,2) till 100 s; three wisps land on (8,4) at 60 s
    CH4({ code: "E04-09",
      name: "바다 축제",
      startCost: 24,
      mul: { hp: 0.6, atk: 0.75, def: 0.85 },
      map: ["#W##W##W#####","B,.,,_,,.,,S#","#h,o.p,.Wi,h#","#_^CW__hW^C_#","#,,.,W,,,,.,W","S,W,.pvu.,,,B","#i,,h_fP,h,o#","########W####"],
      chimneys: [{ at: [3, 3], bridge: [[2, 3]] }, { at: [10, 3], bridge: [[9, 3]] }],
      tunnels: [{ a: [9, 2], b: [3, 2], t: 4 }, { a: [1, 6], b: [11, 6], t: 4 }],
      fuses: [{ from: [6, 6], path: [[6, 5], [7, 5]], box: [7, 6] }],
      plank: { slots: [[5, 2], [5, 5]], cd: 15 },
      vip: { name: "유이", hp: 7000, def: 60, at: [3, 1], sprite: "yui", route: [{ to: [6, 1], wait: 30 }, { to: [9, 5], wait: 40 }, { to: [10, 6], wait: 0 }], speed: 0.6 },
      goal: { win: [{ k: "clear" }], lose: [{ k: "life" }, { k: "vipDead" }], text: { win: "적을 모두 막아 낸다.", lose: "목숨이 다하거나 유이가 쓰러진다." }, hud: [{ vip: true }] },
      waves: (() => { const T = { tun: true }, V = { aim: "vip" };
        return W1([[0.5, "magicshot", 0, 1, 0, { at: [10, 2], until: 100 }],
          [8, "lemure", 0, 2, 3, T], [16, "lemure", 1, 2, 3], [24, "roofcat", 0, 2, 1.5, T], [32, "dancer", 1, 2, 2], [40, "float", 0, 1, 0], [48, "lemure", 1, 2, 2],
          [60, "wisp", 0, 3, 0.4, { at: [8, 4], until: 61, landFx: true }], [66, "roofcat", 1, 2, 1.5], [74, "lemure", 0, 2, 2], [96, "float", 0, 1, 0], [90, "dancer", 0, 2, 2, T],
          [100, "lemure", 1, 2, 2], [108, "roofcat", 0, 2, 1.2, T], [118, "lantchild", 1, 1], [124, "float", 0, 1, 0], [134, "lemure", 1, 2, 2, V], [144, "dancer", 0, 2, 1.5, T], [154, "lemure", 0, 2, 2, T]]); })(),
      desc: "배 네 척. 걸어서 이어지는 길은 연기 다리 둘과 판자 자리 둘뿐이고, 적은 물밑으로 건넙니다. 가장행렬 수레는 축제 동안에만 제대로 다칩니다.",
      lose: "첫 줄은 물밑 출구입니다. 수레가 올 때까지 도화선 칸을 밟아 불을 붙들어 두세요." }),
    // E04-10 「융커 볼란트」 13x8: 볼란트는 죽지 않고 막히지 않는다. 축제의 불꽃이 터지는 순간 그가 연기 밖에 있으면 '관심'이 한 칸 깎인다. 세 번 다가오는 동안 세 번 맞혀 물러나게 한다. 축제는 시민을 놀라게 하고 광대를 깨운다. gates 0 (6,0) north, 1 (0,2) west, 2 (12,5) east; point (6,6). Junker Voland lands on (2,2) at 60 s, (10,2) at 120 s, (6,1) at 180 s; each time two broom witches land beside Yui
    CH4({ code: "E04-10",
      name: "융커 볼란트",
      startCost: 28,
      mul: { hp: 0.4, atk: 0.55, def: 0.85 },
      map: ["#####WS######","#h,W.,,.oW,h#","S,,^,h,vv^,i#","W,.C,,,uPC.,W","W,h_.,hv,_,,#","#,,^,,,f,^.,S","Wi.Co.B,.C,h#","##########W##"],
      chimneys: [{ at: [3, 3], bridge: [[3, 2]] }, { at: [9, 3], bridge: [[9, 2]] }, { at: [3, 6], bridge: [[3, 5]] }, { at: [9, 6], bridge: [[9, 5]] }],
      tunnels: [{ a: [1, 6], b: [8, 1], t: 4 }, { a: [11, 2], b: [4, 6], t: 4 }],
      fuses: [{ from: [7, 5], path: [[7, 4], [7, 3], [7, 2], [8, 2]], box: [8, 3] }],
      citizens: [[5, 1], [4, 5], [10, 4], [1, 4]],
      vip: { name: "유이", hp: 7000, def: 120, at: [6, 3], sprite: "yui", route: [{ to: [4, 3], wait: 60 }, { to: [6, 5], wait: 60 }, { to: [8, 4], wait: 60 }], speed: 0.6 },
      meters: { interest: { v: 3, min: 0, max: 3, label: "관심" } },
      vollandRing: [[2, 2], [10, 2], [6, 1]],
      goal: { win: [{ k: "clear" }], lose: [{ k: "life" }, { k: "vipDead" }], text: { win: "적을 모두 막아 낸다.", lose: "목숨이 다하거나 유이가 쓰러진다." }, hud: [{ vip: true }, { meter: "interest" }] },
      waves: (() => { const T = { tun: true }, V = { aim: "vip" };
        return W1([[8, "lemure", 1, 2, 3], [16, "lemure", 2, 2, 3], [24, "dancer", 0, 2, 2], [32, "roofcat", 1, 2, 1.5, T], [40, "clown", 2, 1], [48, "lemure", 0, 2, 2],
          [60, "volland", 1, 1, 0, { vfrom: [2, 2] }], [62, "broom", 0, 1, 0, { at: [5, 4], until: 63, landFx: true }], [62, "broom", 0, 1, 0, { at: [8, 5], until: 63, landFx: true }],
          [70, "dancer", 2, 2, 2], [80, "lemure", 1, 2, 2, V], [90, "roofcat", 2, 2, 1.2, T], [100, "clown", 0, 1], [108, "lemure", 2, 2, 2],
          [120, "volland", 2, 1, 0, { vfrom: [10, 2] }], [122, "broom", 0, 1, 0, { at: [5, 5], until: 123, landFx: true }], [122, "broom", 0, 1, 0, { at: [8, 5], until: 123, landFx: true }],
          [132, "dancer", 1, 2, 2], [140, "lemure", 0, 2, 2], [150, "roofcat", 1, 2, 1.2, T], [160, "lantchild", 0, 1], [168, "lemure", 2, 2, 2, V],
          [180, "volland", 0, 1, 0, { vfrom: [6, 1] }], [182, "broom", 0, 1, 0, { at: [5, 4], until: 183, landFx: true }], [182, "broom", 0, 1, 0, { at: [5, 5], until: 183, landFx: true }],
          [192, "dancer", 2, 2, 2], [200, "lemure", 1, 2, 2], [210, "clown", 2, 1]]); })(),
      boss: ["경고: 융커 볼란트", "융커 볼란트 · WARNING"],
      desc: "융커 볼란트는 죽지 않고 막히지 않습니다. 축제의 불꽃이 터지는 순간 그가 연기 밖에 있으면 관심이 한 칸 깎이고 물러납니다. 관심 셋을 다 깎으면 떠납니다.",
      lose: "그가 오는 쪽 굴뚝만 막아 연기를 걷고, 축제는 그가 유이에게 다가올 때를 위해 아껴 두세요. 도화선 칸에 서 있으면 불이 그 앞에서 멈춥니다." }),
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

  /* chapter 3's rampart: "T" a wall top ours may stand on (any class), "m" a wall top nobody of ours stands on, "H" a ladder (nobody of ours stands on it either).
     Only a foe whose def has climb: true walks them, and only by a ladder: ground <-> H <-> T/m, never straight between ground and T/m. For every other foe they are
     as shut as "h". CLIMB_USE is on while a climber's way is worked out (as TUN_USE is for the tunnels); the default routes (PATHS) are worked out with it off */
  const WALLTOP = (c) => c === "T" || c === "m", ONWALL = (c) => c === "T" || c === "m" || c === "H";
  let CLIMB_USE = false;
  let CLIMB_ALL = false;   /* stage.climbAll: every foe on foot climbs (the default routes too). Set by each Game as it starts, before its board is laid */
  const RAMPART = { out: 1.3, in: 0.7, ladder: 2.5, reach: 1.0 };
  const WALL_DROP = { stun: 2, pct: 0.3 };   /* a foe shoved off a rampart top onto the ground: stunned this long, and this share of its max hp gone */   /* out/in: what one of ours on T deals to / takes from foes on the ground; ladder: seconds up or down; reach: a ranged climber's extra range on the wall */
  const STAKE_CARD = { def: { tile: "g" } };   /* asks canDeployAt whether a square is free and could take one of ours (the staker's rule) */
  function climbStep(a, b) { if (WALLTOP(b)) return WALLTOP(a) || a === "H"; if (b === "H") return walkable(a) || ONWALL(a); return walkable(b) && !WALLTOP(a); }
  const walkC = (c) => walkable(c) || (CLIMB_USE && ONWALL(c));

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
        if (!(CLIMB_USE ? climbStep(tileAt(x, y), tileAt(nx, ny)) : walkable(tileAt(nx, ny))) || prev.has(key(nx, ny))) continue;
        prev.set(key(nx, ny), [x, y]);
        q.push([nx, ny]);
      }
      if (TUN_USE && TUN_OUT.size) for (const [nx, ny] of TUN_OUT.get(y * 1000 + x) || []) { if (prev.has(key(nx, ny))) continue; prev.set(key(nx, ny), [x, y]); q.push([nx, ny]); }   /* a tunnel: one step to its far mouth */
    }
    const path = [];
    if (!prev.has(key(...to))) return null;   // no way through on foot (a drone-only gate)
    let cur = to;
    while (cur) { path.push(cur); cur = prev.get(key(...cur)); }
    return path.reverse();
  }
  const PATHS = [], AIR_PATHS = [];
  /* quick routes (tunnels): a foe stepping onto a tunnel mouth goes underground and comes up at the paired exit after t seconds; while under it can be neither seen, struck nor blocked.
     stage.tunnels: [{ a: [x, y], b: [x, y], t: seconds, both: false }] (one way a -> b unless both). Mouths sit on walkable squares; pathfinding counts the passage as one step */
  const TUN = new Map(), TUN_OUT = new Map();
  let TUN_USE = false;   /* only a foe sent with the wave option `tun: true` paths through the tunnels (spawn turns this on while it works out that one's way) */
  function setTunnels(list) {
    TUN.clear(); TUN_OUT.clear();
    for (const q of list || []) { const add = (a, b) => { TUN.set(a[0] + "," + a[1] + ">" + b[0] + "," + b[1], { t: q.t === undefined ? 3 : q.t, a, b }); const k = a[1] * 1000 + a[0]; if (!TUN_OUT.has(k)) TUN_OUT.set(k, []); TUN_OUT.get(k).push(b); };
      add(q.a, q.b); if (q.both) add(q.b, q.a); }
  }
  const tunAt = (a, b) => TUN.size ? TUN.get(a[0] + "," + a[1] + ">" + b[0] + "," + b[1]) || null : null;
  const VIA = new Map();   // routes through waypoints, built once per map
  function viaPath(s, via) {
    const k = (TUN_USE ? "T" : "") + (CLIMB_USE ? "C" : "") + s + ":" + JSON.stringify(via);
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
    CLIMB_USE = CLIMB_ALL; PATHS.length = 0; PATHS.push(...SPAWNS.map((s) => bfsPath(s, BASE))); VIA.clear(); CLIMB_USE = false;
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
      if (this.stage.frost) this.stage = this.frostStage(this.stage);   /* 2-10 v2: a frost stage plays on its own copy of the stage whose braziers have health and never mend (frostStage) */
      /* a second wave held back (stage.wave2 { at, bossPct, waves }): it starts at `at` s or when the boss falls to bossPct of his strength, whichever comes first; its times count from then */
      this.w2 = this.stage.wave2 ? { at: this.stage.wave2.at, pct: this.stage.wave2.bossPct, list: W1(this.stage.wave2.waves), done: false, t: null } : null;
      if (this.w2) this.waves = this.waves.slice();
      // board shifts (a wall that opens at a set time): such a stage plays on its own copy of the rows, so the stage's map stays as written and a new game starts shut again
      this.rows = this.stage.shifts && this.stage.map ? this.stage.map.slice() : null;
      this.shifts = (this.stage.shifts || []).map((q) => ({ t: q.when ? Infinity : q.t, when: q.when, warn: q.warn || 0, set: q.set, banner: q.banner, tiles: q.set.map(([x, y]) => [x, y]), warned: false, done: false }));
      CLIMB_ALL = !!this.stage.climbAll; setTunnels(this.stage.tunnels); setMap(this.rows || this.stage.map || MAP0);
      this.costRate = this.stage.costRate !== undefined ? this.stage.costRate : CFG.costPerSec;
      if (this.stage.startCost) this.cost = this.stage.startCost;
      this.hold = !!(this.stage.tutorial || this.stage.sandbox);
      if (this.stage.sandbox) { this.life = 99; this.cost = CFG.maxCost; }   // a scripted stage ends only when its script lets go; the training room never ends
      this.killed = 0; this.leaked = 0; this.total = this.waves.filter((w) => !(w[3] && (w[3].ally || w[3].loop))).length + (this.w2 ? this.w2.list.length : 0);   // those who stand with us are not counted among the foe this.over = null;
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
      this.pat = null; this.summon = new Set(); this.iced = new Map();   /* the eagle's pattern running (patternStart), the summoned braziers of pattern A (keys y*100+x, overlays on their own tile), the squares frozen over in pattern B (key -> thaw time) */
      this.lampOff = new Set(); this.volleys = []; this.shells = []; this.lampEv = ((this.stage.lamps && this.stage.lamps.events) || []).map((e) => ({ t: e.t, off: e.off, warn: e.warn || 5 }));
      // Two kinds of dead lamp. A lamp BROKEN by a lamp-breaker lights again only when an operator deployed after it went out stands right beside it for
      // stage.lamps.relight seconds (6 by default) without a break. Any other dead lamp (an order such as "lights out", a snuffer, the clock, out from the start) lights
      // that way too, and also by itself stage.lamps.relightStale seconds (14 by default) after it went out if one of ours who was already standing there still is.
      // lampOffT holds the game time each lamp went out (key y*100+x; a lamp out from the start has -1); lampBroken holds the keys of the broken ones; freshAt holds
      // the time a fresh keeper's clock will run out; relightAt holds, for the lamps that will light, the earlier of the two times (the page shows the count).
      this.lampOffT = new Map(); this.relightAt = new Map(); this.freshAt = new Map(); this.lampBroken = new Set();
      if (this.stage.lamps) for (const [x, y] of this.stage.lamps.off || []) { this.lampOff.add(y * 100 + x); this.lampOffT.set(y * 100 + x, -1); }
      /* the ember (불씨, chapter 2 from IM-05: stage.ember): a card, not an operator. Set down beside a brazier that is out, it lights it at once and is gone; cost 5, again after 25 s, as often as you like */
      this.emberCard = this.stage.ember ? Object.assign({ cost: 5, cd: 25, cdT: 0, used: 0 }, typeof this.stage.ember === "object" ? this.stage.ember : {}) : null;
      /* the torch (stage.torch, chapter 3): the ember card's slot and way of use; set down on a dark square it lights that square and those within r for dur seconds */
      if (!this.emberCard && this.stage.torch) this.emberCard = Object.assign({ cost: 6, cd: 30, dur: 40, r: 1, cdT: 0, used: 0 }, typeof this.stage.torch === "object" ? this.stage.torch : {}, { torch: true });
      this.torches = [];
      this.darkNoDeploy = !!(this.stage.lamps && !this.stage.lamps.fire && this.stage.lamps.darkDeploy === false);
      this.horns = this.stage.horns ? this.stage.horns.map((q) => Object.assign({ done: false }, q)) : null;
      if (this.stage.volleys) this.volleys = this.stage.volleys.map((v) => Object.assign({ next: v.first, st: 0 }, v));
      if (this.stage.wind) { const w = this.stage.wind; this.wind = { dir: w.dir, every: w.every, warn: w.warn || 4, dur: w.dur || w.every * 0.5, durs: w.durs || null, n: 0, curDur: 0, step: w.step || BLIZ.step, next: w.first || w.every, warned: false, blowing: false, end: 0, front: null, adv: 0, dirs: w.dirs || null, turns: (w.turns || []).map((q) => Object.assign({ warn: 4, done: false, warned: false }, q)), flip: !!w.flip, pendingDir: null }; }   /* turns: [{ t, dir, warn }] the wind turns at t (warned before, arrows the new way); flip: a boss's standard turns it about */
      /* the endless blizzard (stage.storm, 2-6): one gust from the first tick that does not end on its own; its end is pushed back every tick while the gauge lasts.
         The gauge falls by drain each second for every brazier lit at that moment (none lit: it stands still); at 0 the gust passes as any gust does and no other comes */
      this.storm = null;
      if (this.stage.storm) { const S = this.stage.storm; this.storm = { gauge: S.gauge, max: S.gauge, drain: S.drain, lit: 0, ended: false, endT: null }; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (this.lampLit(x, y)) this.storm.lit++;
        this.wind = { dir: S.dir, every: Infinity, warn: 4, dur: STORM_SPAN, durs: null, n: 0, curDur: 0, step: S.step || BLIZ.step, next: 0, warned: true, blowing: false, end: 0, front: null, adv: 0, dirs: null, turns: [], flip: false, pendingDir: null, storm: true }; }
      /* braziers that can be struck (stage.lamps.hp, 2-6): key y*100+x -> { hp, hitAt }. At 0 the brazier goes out (not broken); unstruck for LAMP_HP.calm s it mends regen a second, and an out one lights again at relightAt of its max */
      this.lampHp = null;
      if (this.stage.lamps && this.stage.lamps.hp) { this.lampHp = new Map(); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tileAt(x, y) === "F") this.lampHp.set(y * 100 + x, { hp: this.stage.lamps.hp, hitAt: -99 }); }
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
      this.ch4 = null; if (this.stage.ch4) this.ch4Init();
      this.frost = null; if (this.stage.frost) this.frostInit();   /* 2-10 v2 (stage.frost): fog and phases, the blizzard that grows, braziers you feed (frostInit) */
      this.ch5 = null; if (this.stage.ch5) this.ch5Init();   /* chapter 5 (stage.ch5): zones of any shape on the beat, the flow, the tuner card, the orchestra's rules (ch5Init) */   /* chapter 4 (stage.ch4): citizens, fuses and the festival, the plank card, the leaping roofs for every foe (ch4Init) */
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
      if (e.aim === "metro" && this.beat) { const ms = this.beat.zones.filter((z) => this.ch5 ? !!z.metronome : z.x1 >= T[0]).map((z) => z.metronome); const p = ms.length ? this.bfsTo(T, (x, y) => ms.some((m) => near1(x, y, m[0], m[1]))) : null; return p; }   // the baton: the nearest metronome ahead
      if (e.aim === "chimney") { const kept = this.chimneys.filter((c) => c.kept); const p = kept.length ? this.bfsTo(T, (x, y) => kept.some((c) => near1(x, y, c.at[0], c.at[1]))) : null; return p || toVip(); }   // the sweep: the nearest stopped chimney, else the ally
      if (e.aim === "fuse" && this.ch4) { const F = this.ch4.fuses; return F.length ? this.bfsTo(T, (x, y) => F.some((f) => Math.abs(f.from[0] - x) + Math.abs(f.from[1] - y) === 1)) : null; }   /* chapter 4: the child, to the nearest igniter */
      if (e.aim === "home" && e.home) return bfsPath(T, e.home);   /* chapter 4: the child, back out by its own gate */
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
      if (!p && this.ch4 && e.aim !== undefined) { TUN_USE = !!e.tun; p = bfsPath(T, BASE); TUN_USE = false; }   /* chapter 4: no way to what it is after: it makes for a point instead (and strands only if there is no way there either) */
      if (!p && e.aim !== undefined && this.stage.leap && this.vip && !this.vip.dead) { p = this.nearWay(T, [Math.round(this.vip.x), Math.round(this.vip.y)]); aimed = !!p; e.stranded = !!p; }   // lab L1: no way to her: the nearest square of its own roof
      if (!p && this.ch4 && this.stage.leap && e.aim === undefined && !e.def.flying) { TUN_USE = !!e.tun; p = bfsPath(T, BASE); TUN_USE = false;   /* chapter 4: any foe on foot with no way to a point stands at the end of its roof nearest one, and leaps in the end */
        if (!p) { const br = this.ch4Bridge(T, e), nb = br ? br.near : nearBase(T); TUN_USE = !!e.tun; p = br ? bfsPath(T, br.near) : null; if (!p) p = this.nearWay(T, nb); TUN_USE = false; aimed = !!p; e.stranded = !!p; e.leapTo = br ? br.far : null; } }
      if (!e.stranded) e.standT = 0;
      if (!p) { TUN_USE = !!e.tun; p = bfsPath(T, BASE); TUN_USE = false; }
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
        case "clear": return !this.loopDef && this.waveIdx >= this.waves.length && !(this.extra && this.extra.length) && !(this.waitSpawn && this.waitSpawn.length) && this.enemies.every((e) => e.ally || e.stake || e.loop) && !this.hold && !(this.march && !this.march.part.final);
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
    bridgeEnds(c) { const a = c.bridge[0], b = c.bridge[c.bridge.length - 1]; let dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]);
      if (!dx && !dy) { const roof = (x, y) => { const t = tileAt(x, y); return walkable(t) && t !== "^"; }; if (roof(a[0] - 1, a[1]) && roof(a[0] + 1, a[1])) dx = 1; else dy = 1; }   /* chapter 4: a one-square bridge: the axis with roof on both sides */
      return [[a[0] - dx, a[1] - dy], [b[0] + dx, b[1] + dy]]; }
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
      const after = e.def.leapAfter || L.after;   /* chapter 4: the lemures leap sooner */
      e.standT = (e.standT || 0) + dt; e.leapWarn = e.standT >= after - L.warn;
      if (e.standT < after) return false;
      const T = [Math.round(e.x), Math.round(e.y)], roof = this.reach(T); let best = this.ch4 && e.leapTo && !walkable(tileAt(e.leapTo[0], e.leapTo[1])) ? null : this.ch4 && e.leapTo ? e.leapTo.slice() : null, bd = best ? -1 : 1e9;   /* chapter 4: over the bridge it was waiting at */
      if (!best || bd >= 0) for (const c of this.chimneys) { if (c.bridge.every(([x, y]) => walkable(tileAt(x, y)))) continue;
        const [a, b] = this.bridgeEnds(c), na = roof.has(a[1] * W + a[0]), nb = roof.has(b[1] * W + b[0]); if (na === nb) continue;
        const near = na ? a : b, far = na ? b : a, d = Math.hypot(near[0] - e.x, near[1] - e.y); if (d < bd) { bd = d; best = far; } }
      if (!best) return false;
      if (this.unitAt(best[0], best[1])) { e.standT = after - (L.retry || 5); return false; }
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
    beatZone(x, y) { if (this.ch5) return this.ch5Zone(x, y);   /* chapter 5: zones by squares */
      const Z = this.beat.zones, rx = Math.round(x); return Z.find((z) => rx >= z.x0 && rx <= z.x1) || (rx < Z[0].x0 ? Z[0] : Z[Z.length - 1]); }
    beatLen(z) { return [2.0, 1.4, 0.9][z.level]; }   // slow, normal, fast
    // the zones' clocks: a keeper beside the metronome makes its zone a level slower, a baton beside it a level faster (both: they cancel)
    beatStep(dt) {
      if (this.ch5) return this.ch5Beat(dt);   /* chapter 5: its own clocks */
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
        if (u && this.canHold(u, e) && this.blockLoad(u) + e.def.weight <= this.stat(u, "block")) { e.blockedBy = u; e.blockedAt = this.t; return true; } }
      return false;
    }
    // a foe's step on the beat: it stands in the middle of its square and on each beat of its zone hops to the next square of its road (0.25 s). Slow (speed under 0.6, after
    // any slowing): every second beat; fast (over 1.2): two squares; a charge: three. Landing on a rest it waits for the zone's downbeat. Returns true at the end of its road
    beatMove(e, dt, slow) {
      const z = this.beatZone(e.x, e.y), zn = this.ch5 && e.def.c5 && e.def.c5.offbeat ? z.hn : z.n; if (e.chargeT > 0) e.chargeQueued = true;   /* chapter 5: the off-beat hound keeps the half beats */
      if (!e.hop) {
        { const u = this.unitAt(Math.round(e.x), Math.round(e.y)); if (u && this.canHold(u, e) && this.blockLoad(u) + e.def.weight <= this.stat(u, "block")) { e.blockedBy = u; e.blockedAt = this.t; return false; } }   // one of ours set down on its very square holds it at once
        const skipped = e.beatSeen !== undefined && this.t - e.beatSeen > dt * 1.5; e.beatSeen = this.t;
        if (skipped) { e.bn = zn; e.bz = z.id; return e.seg >= e.path.length - 1; }   // it was held, aiming or pausing until now: it moves on the next beat, not on one it missed
        if (e.bz !== z.id) { e.bz = z.id; e.bn = zn; return e.seg >= e.path.length - 1; }   // just came into this zone: it waits for this zone's next beat
        if (e.bn === zn) return e.seg >= e.path.length - 1;
        e.bn = zn; const down = z.n % 4 === 0, sp = e.def.speed * (1 - (slow || 0));
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
        if (e.path.waits && e.path.waits[e.seg] && e.waitedAt !== e.seg) { e.waitedAt = e.seg; e.pauseT = typeof e.path.waits[e.seg] === "object" ? Math.max(0.01, e.path.waits[e.seg].until - this.t) : e.path.waits[e.seg]; e.hop.left = 0; }
        if (tileAt(Math.round(e.x), Math.round(e.y)) === "R" && !(this.ch5 && e.def.c5 && e.def.c5.offbeat)) { e.restUntilDown = true; e.hop.left = 0; this.fx.push({ k: "rest", x: e.x, y: e.y, t: 0, life: 0.8 }); }
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
      if (this.wind.turns.length || this.wind.pendingDir !== null) this.windTurns();
      const w = this.wind, t = this.t, [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][w.dir], horiz = dy === 0, lines = horiz ? H : W, len = horiz ? W : H;
      if (!w.blowing) {
        if (!w.warned && t >= w.next - w.warn) { w.warned = true;
          if (w.dirs) { const nd = w.dirs[Math.min(w.n, w.dirs.length - 1)]; if (nd !== w.dir) { this.fx.push({ k: "windturn", dir: nd, from: w.dir, t: 0, life: w.warn + 1 }); w.dir = nd; } }   /* stage.wind.dirs: gust n comes from dirs[n] (the last one stays) */
          this.fx.push({ k: "windwarn", dir: w.dir, t: 0, life: w.warn }); }
        if (t < w.next) return;
        w.curDur = (w.durs && w.durs[w.n]) || w.dur; w.n++;   // a stage may make the first ones short
        w.blowing = true; w.warned = false; w.end = t + w.curDur; w.front = new Array(lines).fill(0); w.adv = t; w.next += w.every; w.done = new Array(lines).fill(false);
        this.fx.push({ k: "gust", dir: w.dir, t: 0, life: w.curDur, storm: !!w.storm }); this.snd("wind");
        this.patternStart();   /* the eagle reads the braziers as the gust comes */
        // the rasputitsa freezes over the moment it blows, sheltered or not: no one can be set down on the mud, and whoever stands in it freezes
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tileAt(x, y) === "~") { this.drift.set(y * 100 + x, w.end + 1.5);
          const u = this.unitAt(x, y); if (u && !u.blizFrozen && !this.warmAt(x, y)) { u.blizFrozen = true; u.wind = null; u.frozenT = Math.max(u.frozenT || 0, w.curDur + 0.05); this.fx.push({ k: "freeze", x: u.x, y: u.y, t: 0, life: 0.8 }); } }
      }
      if (t >= w.end) {   // it passes: the snow melts off, the frozen thaw
        w.blowing = false; w.front = null;
        if (w.pendingDir !== null) { const from = w.dir; w.dir = w.pendingDir; w.pendingDir = null; this.fx.push({ k: "windturn", dir: w.dir, from, t: 0, life: 2.5 }); }   /* turned about while it blew: the new way from now on */
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
        if ((c === "." || c === "~" || c === "=" || c === "h" || c === "*" || c === "x") && !this.warmAt(x, y)) this.drift.set(y * 100 + x, w.end + 1.5);
        w.front[a] = i + 1;   // a rise is snowed over like anywhere else: only a raised wall or someone standing there holds it
      }
    }
    /* the endless blizzard (stage.storm): run before windStep each tick. While the gauge lasts the gust's end is kept STORM_SPAN ahead, so every gust rule holds;
       the gauge falls by drain a second for each lit brazier; at 0 the gust's end is set to now, windStep lets it pass, and no gust comes after it */
    stormStep(dt) { const S = this.storm, w = this.wind; if (S.ended) return;
      let n = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (this.lampLit(x, y)) n++;
      S.lit = n; S.gauge = Math.max(0, S.gauge - S.drain * n * dt);
      if (w.blowing) { w.end = this.t + STORM_SPAN; w.curDur = STORM_SPAN; }
      if (S.gauge <= 0) { S.ended = true; S.endT = this.t; w.next = Infinity; w.warned = true; if (w.blowing) w.end = this.t;
        for (const f of this.fx) if (f.k === "gust" && f.storm) f.life = Math.min(f.life, f.t + 1.2);   /* the snow streams thin out over a second */
        this.fx.push({ k: "stormend", t: 0, life: 2.5 }); } }
    /* braziers that can be struck (stage.lamps.hp): the lit brazier a foe would strike instead of walking on — the nearest one within LAMP_HP.reach of it. Any foe on foot
       who is not held, not asleep, not on our side and not underground; walking, at its post or waiting at a waypoint alike */
    fireTarget(e) { if (!this.lampHp || e.def.flying || e.blockedBy || e.heldBy || e.waiting || e.hired || e.ally || e.underT > 0 || e.hp <= 0 || e.def.atk <= 0 || e.def.noFight) return null;
      let best = null, bd = (e.def.fireFirst ? this.foeReach(e) : LAMP_HP.reach) + 1e-6;   /* the mortar looks for a brazier as far as he can throw */
      for (const [k] of this.lampHp) { const x = k % 100, y = (k / 100) | 0; if (!this.lampLit(x, y)) continue; const d = Math.hypot(x - e.x, y - e.y); if (d <= bd) { bd = d; best = [x, y]; } }
      return best; }
    strikeFire(e, f) { if (e.def.lob) return this.lobShell(e, f[0], f[1]); const k = f[1] * 100 + f[0], L = this.lampHp.get(k); if (!L) return;
      L.hp = Math.max(0, L.hp - e.def.atk * (e.atkMul || 1) * this.auraMul(e, "atk")); L.hitAt = this.t; e.face = f[0] >= e.x ? 1 : -1; e.hitAt = this.t;
      this.fx.push(e.def.ranged ? { k: "bolt", x0: e.x, y0: e.y, x1: f[0], y1: f[1], foe: true, t: 0, life: 0.25 } : { k: "firehit", x: f[0], y: f[1], t: 0, life: 0.4 });
      if (e.def.ranged) e.firedAt = this.t;
      if (L.hp <= 0 && this.snuff(f[0], f[1], e, true)) this.lampBroken.delete(k); }   /* out, but not broken: it lights again by itself (lampHpStep), no keeper needed */
    lampHpStep(dt) { if (this.pat && this.pat.kind === "B") return;   /* the dead fire: no brazier mends by itself */
      const LS = this.stage.lamps, max = LS.hp, regen = LS.regen || 0, at = (LS.relightAt || 0.5) * max;
      for (const [k, L] of this.lampHp) { if (this.t - L.hitAt < LAMP_HP.calm || L.hp >= max) continue;
        L.hp = Math.min(max, L.hp + regen * dt); const x = k % 100, y = (k / 100) | 0;
        if (L.hp >= at && this.lampOff.has(k)) this.relight(x, y); } }
    /* the eagle's two patterns (def.patterns, 2-10). As any gust starts, while such a foe is on the board (alive, not asleep on a post) and none is running, he reads the
       braziers: R = their health over their max (lit or out; a stage without health counts lit ones as whole). R >= PAT.split: A, the great fire; under: B, the dead fire. No brazier: nothing */
    patternStart() { if (this.pat) return; const boss = this.enemies.find((e) => e.def.patterns && !e.dead && e.hp > 0 && !e.waiting && !e.ally && !e.hired); if (!boss) return;
      const fires = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tileAt(x, y) === "F") fires.push([x, y]); if (!fires.length) return;
      const LS = this.stage.lamps || {}; let have = 0, max = 0;
      for (const [x, y] of fires) { const L = this.lampHp && this.lampHp.get(y * 100 + x); max += L ? LS.hp : 1; have += L ? L.hp : (this.lampLit(x, y) ? 1 : 0); }
      const R = have / max, w = this.wind;
      if (R >= PAT.split) {   /* A: three more braziers on the stage's summon squares, lit and whole; every lit one warms all within 2.5; ours burn; it breaks when 12% of his max hp has come off him */
        this.pat = { kind: "A", boss, R, t0: this.t, last: boss.hp, taken: 0, need: boss.maxHp * PAT.breakAt };
        for (const [x, y] of LS.summon || []) { const k = y * 100 + x; if (tileAt(x, y) === "F" || this.summon.has(k) || x < 0 || y < 0 || x >= W || y >= H) continue;
          this.summon.add(k); this.lampOff.delete(k); this.lampOffT.delete(k); if (this.lampHp) this.lampHp.set(k, { hp: LS.hp, hitAt: -99 }); this.fx.push({ k: "relight", x, y, t: 0, life: 0.9 }); }
      } else {   /* B: every brazier out at 0; no mending, no keeper, only the ember; the gust does not end; he cannot be held; squares round him freeze over */
        this.pat = { kind: "B", boss, R, t0: this.t, end0: w ? w.end : this.t, nextIce: this.t + PAT.iceEvery };
        for (const [x, y] of fires) { const k = y * 100 + x; if (this.lampLit(x, y) && this.snuff(x, y, boss, true)) this.lampBroken.delete(k); const L = this.lampHp && this.lampHp.get(k); if (L) { L.hp = 0; L.hitAt = this.t; } }
        boss.noBlock = true; boss.blockedBy = null;
        if (w && w.blowing) { w.end = this.t + STORM_SPAN; for (const f of this.fx) if (f.k === "gust" && f.life - f.t > 0) { f.storm = true; f.life = f.t + STORM_SPAN; } }
      }
      this.lampV = (this.lampV || 0) + 1; this.fx.push({ k: "pattern", kind: this.pat.kind, x: boss.x, y: boss.y, t: 0, life: 2 }); }
    patternStep(dt) { const P = this.pat, e = P.boss, gone = e.dead || e.hp <= 0 || !this.enemies.includes(e);
      if (P.kind === "A") {
        if (!gone) { P.taken += Math.max(0, P.last - e.hp); P.last = e.hp; }
        if (gone || P.taken >= P.need) return this.patternEnd();
        for (const u of this.units.slice()) if (u.hp > 0) this.damage(u, u.maxHp * PAT.burn * dt, "arts", null, null);   /* the price: ours burn, 3% of max HP a second before resistance */
        return; }
      if (gone) return this.patternEnd();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tileAt(x, y) === "F" && this.lampLit(x, y)) return this.patternEnd();   /* a brazier lit again (the ember) */
      const w = this.wind; if (w && w.blowing) { w.end = this.t + STORM_SPAN; w.curDur = Math.max(w.curDur, STORM_SPAN); }   /* the blizzard does not pass */
      e.noBlock = true; e.blockedBy = null;
      while (this.t >= P.nextIce) { P.nextIce += PAT.iceEvery;   /* two squares near him freeze over: nobody can stand there; whoever does falls */
        const near = (x, y) => BASES.some((b) => Math.hypot(b[0] - x, b[1] - y) <= PAT.iceSafe + 1e-9), cand = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = tileAt(x, y); if (!(c === "." || c === "h" || c === "*" || c === "x" || c === "~") || this.iceAt(x, y) || near(x, y) || Math.hypot(x - e.x, y - e.y) > PAT.iceR + 1e-9) continue; cand.push([x, y]); }
        for (let n = 0; n < PAT.iceN && cand.length; n++) { const [x, y] = cand.splice(Math.floor(Math.random() * cand.length), 1)[0]; this.iced.set(y * 100 + x, Infinity); this.fx.push({ k: "iceover", x, y, t: 0, life: 0.9 });
          const u = this.unitAt(x, y); if (u) u.hp = 0; } } }   /* the normal death (the sweep at the end of the tick) */
    patternEnd() { const P = this.pat; if (!P) return; this.pat = null; const w = this.wind;
      if (P.kind === "A") { for (const k of this.summon) { this.lampOff.delete(k); this.lampOffT.delete(k); this.relightAt.delete(k); this.freshAt.delete(k); this.lampBroken.delete(k); if (this.lampHp) this.lampHp.delete(k); }
        this.summon.clear(); }
      else { P.boss.noBlock = false;
        if (w && w.blowing) { w.end = Math.max(this.t, P.end0); w.curDur = Math.max(1, w.end - this.t); for (const f of this.fx) if (f.k === "gust" && f.life - f.t > 0) f.life = f.t + Math.max(1.2, w.end - this.t);
          if (w.every < Infinity) w.next = Math.max(w.next, w.end + Math.max(0, w.every - w.dur)); }   /* after a long dead fire the next gust keeps its usual calm before it */
        for (const [k] of this.iced) this.iced.set(k, this.t + PAT.thaw); }
      this.lampV = (this.lampV || 0) + 1; this.fx.push({ k: "pattern", kind: P.kind, end: true, x: P.boss.x, y: P.boss.y, t: 0, life: 2 }); }
    /* ---- 2-10 v2: the cold itself is the boss (stage.frost). Nothing here runs on a stage without frost ----
       The stage plays on its own copy whose braziers have health (frost.braziers.hp) and never mend or light again. The board is fogged outside the opened rectangles; phases open
       one after another when the one before is clear (all its waves sent, every foe of it dead or through). The blizzard blows from the first tick in every direction its level lists:
       an operator on a cold square the wind reaches freezes (the chapter-2 rule, its frozen loss included); in the final phase it also bites every operator (finalDps). A lit
       brazier loses drain[level] a second for each direction that reaches it (the square beside it on the windward side is not a wall, raised wall or one of ours). */
    frostStage(st) { const B = st.frost.braziers || {};
      return Object.assign({}, st, { lamps: Object.assign({}, st.lamps || {}, { fire: true, hp: B.hp || 3000, regen: 0, relightAt: 0 }) }); }
    frostInit() { const F = this.stage.frost, B = F.braziers || {}, PH = F.phases && F.phases.length ? F.phases : [{}];
      if (!this.rows) this.rows = (this.stage.map || MAP).slice(); setMap(this.rows);
      this.frost = { phase: 0, t0: 0, level: 0, dirs: [1], final: false, endAt: null, clearT: null, lost: false, lit: 0, held: {}, open: [], all: !PH[0].open, max: B.hp || 3000, drain: B.drain || [0],
        feed: Object.assign({ cost: FRZ.cost, hp: FRZ.hp, cd: FRZ.cd }, B.feed || {}), warm: B.warm !== undefined ? B.warm : FRZ.warm, storm: F.storm && F.storm.length ? F.storm : [{ dirs: [1] }],
        feedAt: new Map(), skipped: [], tun: (this.stage.tunnels || []).slice(), tunAt: [], phases: PH };
      this.wind = { dir: 1, every: Infinity, warn: 4, dur: STORM_SPAN, durs: null, n: 1, curDur: STORM_SPAN, step: BLIZ.step, next: Infinity, warned: true, blowing: true, end: Infinity, front: null, adv: 0, dirs: null, turns: [], flip: false, pendingDir: null, storm: true, frost: true };
      const now = [];   /* every wave carries its phase (wave option ph, 0 when left out); a later phase's waves are held back and sent with times counted from that phase's start */
      for (const w of this.waves) { const o = Object.assign({}, w[3] || {}); o.ph = o.ph || 0; const ww = [w[0], w[1], w[2], o]; if (o.ph === 0) now.push(ww); else (this.frost.held[o.ph] || (this.frost.held[o.ph] = [])).push(ww); }
      this.waves = now.sort((a, b) => a[0] - b[0]); this.waveIdx = 0;
      this.frostPhase(0, true); }
    frostPhase(p, first) { const R = this.frost, P = R.phases[p] || {}; R.phase = p; R.t0 = this.t; R.final = !!P.final;
      for (const r of P.open || []) R.open.push({ r: [Math.min(r[0], r[2]), Math.min(r[1], r[3]), Math.max(r[0], r[2]), Math.max(r[1], r[3])], at: first ? -99 : this.t });
      let changed = false;
      if (P.set && P.set.length) { this.frostSet(P.set); changed = true; }
      if (P.tunnels && P.tunnels.length) { for (const q of P.tunnels) { R.tun.push(q); R.tunAt.push({ q, at: this.t }); } setTunnels(R.tun); setMap(this.rows || MAP); changed = true; }
      if (changed && !first) this.frostReplan();
      this.frostLevel(P.final ? R.storm.length - 1 : Math.min(p, R.storm.length - 1));
      const list = R.held[p]; if (list && list.length) { const rest = this.waves.slice(this.waveIdx).concat(list.map((w) => [w[0] + this.t, w[1], w[2], this.frostShift(w[3], this.t)])); rest.sort((a, b) => a[0] - b[0]); this.waves = this.waves.slice(0, this.waveIdx).concat(rest); R.held[p] = []; }
      if (P.final) R.endAt = this.t + (P.time || 60);
      if (!first) this.fx.push({ k: "frostphase", final: R.final, n: p, t: 0, life: 2.5 });
      this.lampV = (this.lampV || 0) + 1; }
    /* a held wave's own clock (a post's until, a numeric wait, a via square's until) counts from its phase's start too */
    frostShift(o, t0) { if (!o || !t0) return o; const q = Object.assign({}, o); if (typeof q.until === "number") q.until += t0; if (typeof q.wait === "number") q.wait += t0;
      if (q.via) q.via = q.via.map((v) => v[2] && typeof v[2] === "object" && typeof v[2].until === "number" ? [v[0], v[1], Object.assign({}, v[2], { until: v[2].until + t0 })] : v);
      return q; }
    /* the eagle bearer on a frost stage (IM-10 v2): no patterns, no calls, no gust, no rally; a standard bearer with a stronger aura, announced as a mid-boss. Other stages keep him as he is */
    frostEagle(D) { return this._frostEagle || (this._frostEagle = Object.assign({}, D, { patterns: false, call: null, rally: null, aura: { atk: 0.25, def: 0.25 }, miniboss: true, frostBanner: "독수리 기수 접근" })); }
    frostLevel(n) { const R = this.frost, L = R.storm[n] || R.storm[R.storm.length - 1], dirs = L.dirs && L.dirs.length ? L.dirs.slice() : [1], w = this.wind;
      R.level = n; R.dirs = dirs; w.dir = dirs[0]; w.blowing = true;
      for (const f of this.fx) if (f.k === "gust" && f.frost) f.life = Math.min(f.life, f.t + 1.2);
      for (const d of dirs) this.fx.push({ k: "gust", dir: d, t: 0, life: STORM_SPAN, storm: true, frost: true }); }
    /* a phase's set: each square becomes its tile. One of ours on a square that no longer takes it is retreated the normal way; a gate (or anything) turned into "F" is a lit brazier at full health */
    frostSet(list) { const R = this.frost; if (!this.rows) this.rows = MAP.slice();
      for (const [x, y, ch] of list) { if (x < 0 || y < 0 || x >= W || y >= H) continue; const was = tileAt(x, y), k = y * 100 + x; if (was === ch) continue;
        for (const u of this.units.slice()) if (u.x === x && u.y === y && !this.tileFor(u.def, ch)) this.retreat(u);
        this.rows[y] = this.rows[y].slice(0, x) + ch + this.rows[y].slice(x + 1);
        if (was === "F") { this.lampHp.delete(k); this.lampOff.delete(k); this.lampOffT.delete(k); this.lampBroken.delete(k); R.feedAt.delete(k); }
        if (ch === "F") { this.lampHp.set(k, { hp: R.max, hitAt: -99 }); this.lampOff.delete(k); this.lampOffT.delete(k); this.lampBroken.delete(k); this.fx.push({ k: "relight", x, y, t: 0, life: 0.9 }); } }
      setMap(this.rows); this.boardVer++; }
    tileFor(d, ch) { const c = ch === "~" || ch === "=" ? "." : ch; return c === "*" || c === "T" || (d.tile === "g" ? c === "." || c === "x" : c === "h"); }
    /* after the board changed: a foe on a square that cannot be walked any more is set on the nearest one that can; every foe on foot then finds its way by the board as it now is */
    frostReplan() { for (const e of this.enemies) { if (e.dead || e.def.flying || e.hired || e.ally || e.boarded || e.underT > 0 || e.loop || e.stake) continue;
        const X = Math.round(e.x), Y = Math.round(e.y);
        if (!walkable(tileAt(X, Y))) { const q = this.nearWalk(X, Y); if (q) { e.x = q[0]; e.y = q[1]; e.blockedBy = null; e.relocated = (e.relocated || 0) + 1; this.fx.push({ k: "entry", x: q[0], y: q[1], t: 0, life: 0.5 }); } }
        this.replan(e); } }
    nearWalk(X, Y) { let best = null, bd = 1e9; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (walkable(tileAt(x, y))) { const d = Math.hypot(x - X, y - Y); if (d < bd - 1e-9) { bd = d; best = [x, y]; } } return best; }
    /* which gate a wave comes from: by coordinate ({ gate: [x, y] }) or by number in the gate list as it is now (gates read left to right, top to bottom); none, or one in the fog: it is not sent */
    frostGate(s, o) { let i = s; if (o && o.gate) i = SPAWNS.findIndex((q) => q[0] === o.gate[0] && q[1] === o.gate[1]);
      const g = SPAWNS[i], at = o && o.at ? o.at : g;
      if (!g || this.fogAt(at[0], at[1])) { this.frost.skipped.push({ t: +this.t.toFixed(2), s, gate: o && o.gate, why: g ? "fog" : "nogate" }); this.total = Math.max(0, this.total - 1); return -1; }
      return i; }
    fogAt(x, y) { const R = this.frost; if (!R || R.all || R.clearT !== null) return false; x = Math.round(x); y = Math.round(y); return !R.open.some((q) => x >= q.r[0] && x <= q.r[2] && y >= q.r[1] && y <= q.r[3]); }
    frostPhaseClear(p) { for (let i = this.waveIdx; i < this.waves.length; i++) { const o = this.waves[i][3]; if (o && o.ph === p) return false; }
      if (this.waitSpawn && this.waitSpawn.some((w) => w.o && w.o.ph === p)) return false;
      if (this.frost.held[p] && this.frost.held[p].length) return false;
      return !this.enemies.some((e) => !e.dead && e.hp > 0 && e.ph === p && !e.ally && !e.stake && !e.loop && !e.hired); }
    /* how many of the blowing directions reach a brazier: the square beside it on the side each one comes from is not a wall ("#"), a raised wall ("W") or one of ours (the edge of the board lets it in) */
    frostReach(x, y) { const V = [[1, 0], [0, 1], [-1, 0], [0, -1]]; let n = 0;
      for (const d of this.frost.dirs) { const a = x - V[d][0], b = y - V[d][1]; if (a >= 0 && b >= 0 && a < W && b < H) { const c = tileAt(a, b); if (c === "#" || c === "W" || this.unitAt(a, b)) continue; } n++; }
      return n; }
    frostMul() { let m = 1; for (const e of this.enemies) if (e.def.stormMul && !e.dead && e.hp > 0 && !e.ally && !e.hired) m = Math.max(m, e.def.stormMul); return m; }   /* the frost marshal alive: the blizzard bites ours harder */
    frostStep(dt) { const R = this.frost; if (R.clearT !== null) return;
      if (!R.final) { const nx = R.phases[R.phase + 1];   /* the next phase opens when this one is clear; a numeric when opens it that many seconds after this phase began, clear or not */
        if (nx && typeof nx.when === "number" ? this.t >= R.t0 + nx.when : this.frostPhaseClear(R.phase)) { if (nx) this.frostPhase(R.phase + 1); else if (R.lit) return this.frostClearing(); } }   /* a board without a final phase is won when its last phase is clear */
      if (R.final && this.t >= R.endAt && R.lit) return this.frostClearing();
      const dirs = R.dirs, mul = this.frostMul();
      for (const u of this.units) { if (u.blizFrozen || (u.frostImm || 0) > this.t || this.warmAt(u.x, u.y)) continue;   /* the chapter-2 rule: cold and in the wind, frozen until the storm lifts */
        if (dirs.some((d) => this.windHitsDir(u.x, u.y, d))) { u.blizFrozen = true; u.wind = null; u.frozenT = STORM_SPAN; this.fx.push({ k: "freeze", x: u.x, y: u.y, t: 0, life: 0.8 }); } }
      if (R.final) { const dps = (this.stage.frost.finalDps !== undefined ? this.stage.frost.finalDps : FRZ.finalDps) * mul; if (dps > 0) for (const u of this.units.slice()) if (u.hp > 0) this.damage(u, u.maxHp * dps * dt, "true", null); }   /* the last storm bites everyone, warm or not */
      const drain = R.drain[Math.min(R.level, R.drain.length - 1)] || 0; let lit = 0, any = false;
      for (const [k, L] of this.lampHp) { const x = k % 100, y = (k / 100) | 0; if (tileAt(x, y) !== "F") continue; any = true; if (!this.lampLit(x, y)) { L.reach = 0; continue; }
        const n = this.frostReach(x, y); L.reach = n;
        if (n && drain) { L.hp = Math.max(0, L.hp - drain * n * dt); if (L.hp <= 0) { if (this.snuff(x, y, null, true)) this.lampBroken.delete(k); continue; } }
        lit++; }
      R.lit = lit;
      if (any && !lit) { this.over = "lose"; R.lost = true; this.frostWhy = FROST_LOSE; } }
    frostClearing() { const R = this.frost; R.clearT = this.t; this.wind.blowing = false;
      for (const f of this.fx) if (f.k === "gust" && f.frost) f.life = Math.min(f.life, f.t + FRZ.clear);
      for (const u of this.units) if (u.blizFrozen) { u.blizFrozen = false; u.frozenT = 0; u.frostN = 0; this.fx.push({ k: "freeze", x: u.x, y: u.y, t: 0, life: 0.6 }); }
      this.fx.push({ k: "frostclear", t: 0, life: FRZ.clear + 0.5 }); this.lampV = (this.lampV || 0) + 1; }
    /* tapping a lit brazier: its one skill, the feed (cost in, health up to its max, a few seconds between uses) */
    feedCheck(x, y) { const R = this.frost, k = y * 100 + x; if (!R || tileAt(x, y) !== "F" || !this.lampHp.has(k)) return "화로가 아닙니다";
      if (!this.lampLit(x, y)) return "꺼진 화로에는 넣을 수 없습니다";
      if ((R.feedAt.get(k) || -99) > this.t) return "재사용 대기 중";
      if (this.cost < R.feed.cost) return "코스트 부족";
      return null; }
    feedBrazier(x, y) { if (this.feedCheck(x, y)) return false; const R = this.frost, k = y * 100 + x, L = this.lampHp.get(k);
      this.cost -= R.feed.cost; L.hp = Math.min(R.max, L.hp + R.feed.hp); R.feedAt.set(k, this.t + R.feed.cd); this.fx.push({ k: "relight", x, y, t: 0, life: 0.9 }); this.lampV = (this.lampV || 0) + 1; return true; }
    /* the standard bearers' aura: 1 + their share for every one alive (another foe's, never his own) */
    auraMul(e, k) { if (!this.auras) return 1; let m = 1; for (const q of this.auras) if (q !== e && !q.dead && q.hp > 0) m += q.def.aura[k] || 0; return m; }
    /* the mortar's shell: the square and the four beside it; ours there are struck, and so is a lit brazier there */
    lobShell(e, x, y) { const atk = e.def.atk * (e.atkMul || 1), tiles = [[x, y], [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const u of this.units.slice()) if (tiles.some(([a, b]) => a === u.x && b === u.y)) { this.damage(u, atk, "phys", null, e); u.flash = 0.2; }
      for (const [a, b] of tiles) { const k = b * 100 + a, L = this.lampHp && this.lampHp.get(k); if (!L || !this.lampLit(a, b)) continue; L.hp = Math.max(0, L.hp - atk * this.auraMul(e, "atk")); L.hitAt = this.t; this.fx.push({ k: "firehit", x: a, y: b, t: 0, life: 0.4 }); if (L.hp <= 0 && this.snuff(a, b, e, true)) this.lampBroken.delete(k); }
      e.face = x >= e.x ? 1 : -1; e.hitAt = this.t; e.firedAt = this.t; e.aiming = false; e.shells = (e.shells || 0) + 1;
      this.fx.push({ k: "bolt", x0: e.x, y0: e.y, x1: x, y1: y, foe: true, t: 0, life: 0.4 }); this.fx.push({ k: "blast", tiles, t: 0, life: 0.5 }); this.snd("boom"); }
    iceAt(x, y) { const u = this.iced && this.iced.get(y * 100 + x); return u !== undefined && u > this.t; }
    /* the wind turns (stage.wind.turns): warned q.warn s before with arrows the new way; it turns at q.t, or as soon as the gust then blowing has passed */
    windTurns() { const w = this.wind, t = this.t;
      for (const q of w.turns) { if (q.done) continue;
        if (!q.warned && t >= q.t - q.warn) { q.warned = true; this.fx.push({ k: "windturn", dir: q.dir, from: w.dir, t: 0, life: q.warn + 1 }); }
        if (t >= q.t && !w.blowing) { q.done = true; w.dir = q.dir; } } }
    smokeAt(x, y) { const v = this.smoke.get(y * 100 + x); return v !== undefined && v <= this.t; }
    clearSmoke(x, y, dur) { const k = y * 100 + x; if (this.smoke.has(k) && this.smoke.get(k) <= this.t) { this.smoke.set(k, this.t + dur); this.fx.push({ k: "unsmoke", x, y, t: 0, life: 0.9 }); } }
    calling() { return !!(this.calls && this.calls.until > this.t); }
    callStep() { const c = this.calls;
      if (!c.warned && this.t >= c.next - c.warn) { c.warned = true; this.fx.push({ k: "callwarn", x: c.at[0], y: c.at[1], t: 0, life: c.warn }); }
      if (this.t >= c.next) { c.until = this.t + c.dur; c.next += c.every; c.warned = false; this.fx.push({ k: "calling", x: c.at[0], y: c.at[1], t: 0, life: c.dur }); } }
    lampLit(x, y) { return (tileAt(x, y) === "F" || (!!this.summon && this.summon.size > 0 && this.summon.has(y * 100 + x))) && !this.lampOff.has(y * 100 + x); }
    isSummon(x, y) { return !!this.summon && this.summon.has(y * 100 + x); }   /* a brazier the eagle's great fire set on this square (pattern A) */
    lampGuarded(x, y) { return this.units.some((u) => Math.abs(u.x - x) + Math.abs(u.y - y) === 1); }   // someone stands right by it (above, below, left or right): nobody puts it out
    darkAt(x, y) { const L = this.stage.lamps; if (!L || L.fire) return false; const r = L.r || 1;
      if (this.torches && this.torches.length) for (const q of this.torches) if (Math.max(Math.abs(q.x - x), Math.abs(q.y - y)) <= q.r) return false;   /* a torch burning near */ for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (this.lampLit(x + dx, y + dy)) return false; return true; }
    // force: put it out even if somebody stands by it. The time it went out is kept. A lamp put out by a lamp-breaker (by.def.snuff === "force") is broken:
    // only someone deployed after that can light it again
    snuff(x, y, by, force) { const fire = !!(this.stage.lamps && this.stage.lamps.fire); if (!this.lampLit(x, y) || (!force && !fire && this.lampGuarded(x, y))) return false; const k = y * 100 + x; this.lampOff.add(k); this.lampOffT.set(k, this.t);
      if ((by && by.def && by.def.snuff === "force") || fire) this.lampBroken.add(k); else this.lampBroken.delete(k);   /* a brazier put out (chapter 2): only someone set down beside it after that lights it again */
      this.relightAt.delete(k); this.freshAt.delete(k); this.lampV = (this.lampV || 0) + 1; this.fx.push({ k: "snuff", x, y, t: 0, life: 0.9 });
      if (this.lampHp && this.lampHp.has(k)) this.lampHp.get(k).hp = 0;   /* a brazier with health that anything puts out (a frost bomb, a standard) is at nothing: it mends and lights again by itself like one beaten out */
      return true; }
    relight(x, y) { if (this.frost) return false;   /* a frost stage: a brazier that has gone out stays out */
      if (tileAt(x, y) !== "F" || (this.pat && this.pat.kind === "B" && !this._ember) || !this.lampOff.delete(y * 100 + x)) return false;   /* the dead fire: only the ember lights one */ this.lampOffT.delete(y * 100 + x); this.relightAt.delete(y * 100 + x); this.freshAt.delete(y * 100 + x); this.lampBroken.delete(y * 100 + x); this.lampV = (this.lampV || 0) + 1; this.fx.push({ k: "relight", x, y, t: 0, life: 0.9 });
      const r = (this.stage.lamps && this.stage.lamps.r) || 1; for (const e of this.enemies) if (e.ally && e.waiting && !e.dead && Math.max(Math.abs(e.x - x), Math.abs(e.y - y)) <= r) this.wake(e);   // the light finds whoever was left tied up in the dark: they are loose, and on our side
      return true; }
    // A fresh keeper of a lamp that is out: one of ours right beside it (above, below, left or right) who was deployed after the lamp went out
    freshKeeper(x, y) { const off = this.lampOffT.has(y * 100 + x) ? this.lampOffT.get(y * 100 + x) : -1; return this.units.some((u) => Math.abs(u.x - x) + Math.abs(u.y - y) === 1 && u.born > off); }
    // A stale keeper of a lamp that is out: one of ours right beside it who was already deployed when it went out (and so has stood there ever since)
    staleKeeper(x, y) { const off = this.lampOffT.has(y * 100 + x) ? this.lampOffT.get(y * 100 + x) : -1; return this.units.some((u) => Math.abs(u.x - x) + Math.abs(u.y - y) === 1 && u.born <= off); }
    // the relight clocks, over every lamp that is out. The fresh clock runs while a fresh keeper stands by it and lights the lamp when it runs out; with no fresh keeper
    // it starts over. It belongs to the lamp, so two fresh keepers in turn without a gap keep it running. A lamp that is not broken also lights relightStale seconds
    // after it went out while a stale keeper stands by it. relightAt holds whichever comes first
    relightStep() { if (this.pat && this.pat.kind === "B") return; const L = this.stage.lamps || {}, R = L.relight || (L.fire ? 5 : 6), RS = L.relightStale || 14;
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
        if (sh.when && !sh.done) { const v = this.volleys[sh.when.volley]; if (v) { const n = v.nShot || 0;   /* the gun's shots while it is theirs are counted (a gun of ours does not count) */
          if (!sh.warned && n >= sh.when.shots - 1 && v.st === 1 && !v.ours) { sh.warned = true; this.fx.push({ k: "shiftwarn", tiles: sh.tiles, t: 0, life: Math.max(0.5, v.next - this.t) }); }
          else if (sh.warned && n < sh.when.shots && (v.st !== 1 || v.ours)) sh.warned = false;
          if (n >= sh.when.shots) sh.t = this.t; } }
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
    // the gun retaker (def.retake): checked once a second while nobody holds him
    retakeStep(e) { e.retakeAt = this.t + 1; const ex = Math.round(e.x), ey = Math.round(e.y);
      if (e.retaking && !e.retaking.ours) { e.retaking = null; e.aimHold = false; const p = bfsPath([ex, ey], BASE); if (p) { e.path = [[e.x, e.y]].concat(p.length > 1 ? p.slice(1) : [[ex, ey]]); e.seg = 0; e.segT = 0; this.advance(e, 0); e.remain = segLen(e.path); } return; }   /* the gun is theirs again (by someone else): back to the march */
      if (e.retaking) { const v = e.retaking, [mx, my] = v.muzzle; if (Math.hypot(e.x - mx, e.y - my) < 0.2 && !this.units.some((u) => u.x === mx && u.y === my)) {
          v.ours = false; v.lingerUntil = undefined; v.heldBy = null; v.st = 0; v.next = Math.max(v.next, this.t + (v.warn || 3) + 2); this.fx.push({ k: "gunlost", x: mx, y: my, t: 0, life: 1.2 });
          e.retook = true; e.x = mx; e.y = my; e.path = [[mx, my], [mx, my]]; e.seg = 0; e.segT = 0; e.postUntil = 1e9; e.aimHold = true; } return; }
      let best = null, bd = 1e9; for (const v of this.volleys) if (v.ours && v.muzzle) { const p = bfsPath([ex, ey], v.muzzle); if (p && p.length < bd) { bd = p.length; best = { v, p }; } }
      if (!best) return;
      e.retaking = best.v; e.aimHold = true; e.path = [[e.x, e.y]].concat(best.p.length > 1 ? best.p.slice(1) : [best.v.muzzle.slice()]); e.seg = 0; e.segT = 0; e.waitedAt = undefined; this.advance(e, 0); e.remain = segLen(e.path); }
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
    // the blizzard is blowing down this square's line and nothing stands between the square and the side it blows from: no raised wall, none of ours, none of our rebels
    windHits(x, y) { const w = this.wind; if (!w || !w.blowing) return false; if (this.frost) return this.frost.dirs.some((d) => this.windHitsDir(x, y, d));   /* a frost storm blows from every direction of its level */
      return this.windHitsDir(x, y, w.dir); }
    windHitsDir(x, y, dir) { const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][dir], X = Math.round(x), Y = Math.round(y);
      if (X < 0 || Y < 0 || X >= W || Y >= H) return false;
      for (let cx = dx > 0 ? 0 : dx < 0 ? W - 1 : X, cy = dy > 0 ? 0 : dy < 0 ? H - 1 : Y; cx !== X || cy !== Y; cx += dx, cy += dy) {
        const cc = tileAt(cx, cy); if (cc === "W" || this.unitAt(cx, cy) || this.enemies.some((q) => q.ally && !q.dead && !q.def.flying && Math.round(q.x) === cx && Math.round(q.y) === cy)) return false; }
      return true; }
    // held by one of ours who stands beside a lit brazier: the ice on it thaws (def.thaw)
    thawed(e) { return !!(e && e.def.thaw && this.warmHeld(e)); }
    warmHeld(e) { return !!(e && e.blockedBy && this.units.includes(e.blockedBy) && this.warmAt(e.blockedBy.x, e.blockedBy.y)); }   /* held by one of ours who stands on a warm square */
    /* the braziers' warmth (chapter 2, R2): a lit brazier (F) warms the four squares beside it (above, below, left, right). In a gust the square on the side the wind
       comes from goes cold, and the warmth lies down with the wind: up to three squares downwind of the brazier, cut short only by a raised wall (W) or the edge of the board; it passes over sunken ground, high ground and another brazier.
       warmTiles(gust, dir) gives that set (keys y*100+x) for either state, so the page can show where the warmth will lie before a gust comes. On a stage whose
       lamps are street lamps (chapter 3: lamps without fire) nothing is warm */
    warmTiles(gust, dir) { const out = new Set(); if (this.stage.lamps && !this.stage.lamps.fire) return out;
      if (this.frost) { const r = this.frost.warm; for (const [k] of this.lampHp) { const fx = k % 100, fy = (k / 100) | 0; if (!this.lampLit(fx, fy)) continue;   /* a frost stage: every square within warm (each way, corners too) of a lit brazier; no plume */
          for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) { const x = fx + a, y = fy + b; if (x >= 0 && y >= 0 && x < W && y < H) out.add(y * 100 + x); } } return out; } const V = [[1, 0], [0, 1], [-1, 0], [0, -1]], [wx, wy] = gust ? V[dir] : [0, 0];
      const A = this.pat && this.pat.kind === "A", R = Math.floor(PAT.reach);
      for (let fy = 0; fy < H; fy++) for (let fx = 0; fx < W; fx++) { if ((MAP[fy][fx] !== "F" && !this.summon.has(fy * 100 + fx)) || this.lampOff.has(fy * 100 + fx) || this.coldFire(fx, fy)) continue;
        if (A) { for (let b = -R; b <= R; b++) for (let a = -R; a <= R; a++) { const x = fx + a, y = fy + b; if (x >= 0 && y >= 0 && x < W && y < H && Math.hypot(a, b) <= PAT.reach + 1e-9) out.add(y * 100 + x); } continue; }   /* the great fire: every square within 2.5, in calm and gust alike */
        for (const [a, b] of V) { if (gust && a === -wx && b === -wy) continue; const x = fx + a, y = fy + b; if (x >= 0 && y >= 0 && x < W && y < H) out.add(y * 100 + x); }
        if (gust) for (let k = 1; k <= 3; k++) { const x = fx + wx * k, y = fy + wy * k; if (x < 0 || y < 0 || x >= W || y >= H) break; const c = tileAt(x, y); if (c === "W") break; if (c !== "F") out.add(y * 100 + x); } }
      return out; }
    warmSet() { const w = this.wind, g = !!(w && w.blowing), key = this.t + "|" + (this.lampV || 0) + "|" + g + "|" + (w ? w.dir : -1) + "|" + (this.pat ? this.pat.kind : "");
      if (this._warmKey !== key) { this._warmKey = key; this._warm = this.warmTiles(g, w ? w.dir : 0); } return this._warm; }
    warmAt(x, y) { if (this.stage.lamps && !this.stage.lamps.fire) return false; return this.warmSet().has(Math.round(y) * 100 + Math.round(x)); }   // on a warm square nobody freezes
    /* the blue fire at the general's neck: a brazier he stands near (def.coldfire squares) gives no warmth while he is there */
    coldFire(x, y) { for (const e of this.enemies) if (e.def.coldfire && !e.dead && !e.ally && e.hp > 0 && !e.waiting && Math.hypot(e.x - x, e.y - y) <= e.def.coldfire) return true; return false; }
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
    /* running with the wind at its back in a gust (def.tail): the leg it is on points the way the wind blows */
    tailOf(e) { const a = e.path[e.seg], b = e.path[e.seg + 1]; if (!a || !b) return 1; const [wx, wy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][this.wind.dir], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return L > 1e-9 && ((b[0] - a[0]) * wx + (b[1] - a[1]) * wy) / L > 0.7 ? e.def.tail : 1; }
    /* the frost sack bursts (def.douse): the braziers within r go out, and the frost takes those of ours within r */
    douse(e) { const D = e.def.douse; let any = false;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (this.lampLit(x, y) && Math.hypot(x - e.x, y - e.y) <= D.r + 0.01) { this.snuff(x, y, e, true); any = true; }
      for (const u of this.units.slice()) if (Math.hypot(u.x - e.x, u.y - e.y) <= D.r + 0.01) this.frostHit(u, D.frost);
      this.fx.push({ k: "douse", x: e.x, y: e.y, r: D.r, t: 0, life: 0.9 }); return any; }
    emberStep(e) { e.emberAt = this.t + 0.5; const D = e.def.ember, ex = Math.round(e.x), ey = Math.round(e.y);
      const toBase = () => { const p = bfsPath([ex, ey], BASE); if (p) { e.path = [[e.x, e.y]].concat(p.length > 1 ? p.slice(1) : [[ex, ey]]); e.seg = 0; e.segT = 0; this.advance(e, 0); e.remain = segLen(e.path); } };
      const run = () => { e.sitting = null; e.emberGo = null; e.postUntil = 0; e.aimHold = false; e.emberDone = true; e.dashMul = D.run / e.def.speed; toBase(); };
      if (e.sitting) { if (!this.lampLit(e.sitting[0], e.sitting[1]) || this.t >= e.sitUntil) { run(); this.fx.push({ k: "wake", e, x: e.x, y: e.y, t: 0, life: 0.9 }); } return; }
      if (e.emberGo) { const [sx, sy] = e.emberGo.sq; if (!this.lampLit(e.emberGo.f[0], e.emberGo.f[1]) || this.units.some((u) => u.x === sx && u.y === sy)) { e.emberGo = null; e.aimHold = false; toBase(); return; }
        if (Math.hypot(e.x - sx, e.y - sy) < 0.15) { e.sitting = e.emberGo.f; e.emberGo = null; e.postUntil = 1e9; e.sitUntil = this.t + (D.max || 60); e.x = sx; e.y = sy; e.path = [[sx, sy], [sx, sy]]; e.seg = 0; e.segT = 0; e.aimHold = true; } return; }
      const taken = (x, y) => this.units.some((u) => u.x === x && u.y === y) || this.enemies.some((q) => q !== e && !q.dead && ((q.emberGo && q.emberGo.sq[0] === x && q.emberGo.sq[1] === y) || ((q.sitting || q.postUntil > this.t || q.waiting) && Math.round(q.x) === x && Math.round(q.y) === y)));
      let best = null; for (let fy = 0; fy < H; fy++) for (let fx = 0; fx < W; fx++) if (this.lampLit(fx, fy) && Math.hypot(fx - e.x, fy - e.y) <= D.see) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const x = fx + dx, y = fy + dy;
        if (tileAt(x, y) !== "." || taken(x, y)) continue; const p = bfsPath([ex, ey], [x, y]); if (!p) continue; if (!best || p.length < best.score) best = { score: p.length, p, f: [fx, fy], sq: [x, y] }; }   /* only a ground square the brazier warms */
      if (!best) return;
      e.emberGo = { f: best.f, sq: best.sq }; e.aimHold = true; e.path = [[e.x, e.y]].concat(best.p.length > 1 ? best.p.slice(1) : [best.sq.slice()]); e.seg = 0; e.segT = 0; e.waitedAt = undefined; this.advance(e, 0); e.remain = segLen(e.path); }
    // the infernal machine goes off: everything close by, theirs and ours alike
    explode(e) {
      if (e.boomed) return; e.boomed = true;
      const b = e.def.bomb, dmg = b.dmg * (e.atkMul || 1);
      for (const u of this.units.slice()) if (Math.hypot(u.x - e.x, u.y - e.y) <= b.r) this.damage(u, dmg, "true", null, e);
      for (const q of this.enemies) if (q !== e && !q.dead && !q.def.flying && Math.hypot(q.x - e.x, q.y - e.y) <= b.r) { this.damage(q, dmg * (q.def.bomb ? 1 : b.foe || 1), "true", null); q.flash = 0.25; }
      this.fx.push({ k: "boom", x: e.x, y: e.y, r: b.r, t: 0, life: 0.9 }); this.snd("boom");
      if (b.relight && this.lampOff.size && this.stage.lamps && this.stage.lamps.fire) for (const k of [...this.lampOff]) { const x = k % 100, y = (k / 100) | 0; if (tileAt(x, y) === "F" && Math.hypot(x - e.x, y - e.y) <= b.relight) this.relight(x, y); }   /* the blast lights the braziers near it again */
    }
    emberCheck() { const E = this.emberCard; if (!E) return "없음"; if (E.tuner) return this.tunerCheck();   /* chapter 5: the tuner card */ if (E.plank) return E.cdT > 0 && !(this.ch4 && this.ch4.plank) ? "재사용 대기 중" : null;   /* chapter 4: the plank card */ if (E.cdT > 0) return "재사용 대기 중"; if (this.cost < E.cost) return "코스트 부족"; return null; }
    /* the brazier an ember set down on (x, y) would light: the square must be right beside one (above, below, left, right) */
    emberTarget(x, y) { if (this.emberCard && this.emberCard.plank) return this.plankTarget(x, y); if (this.emberCard && this.emberCard.tuner) return this.tunerTarget(x, y);
      if (this.emberCard && this.emberCard.torch) return x >= 0 && y >= 0 && x < W && y < H && this.darkAt(x, y) ? [x, y] : null;   /* the torch: any dark square */
      if (x < 0 || y < 0 || x >= W || y >= H || tileAt(x, y) === "F") return null;
      for (const [a, b] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const fx = x + a, fy = y + b; if (tileAt(fx, fy) === "F" && this.lampOff.has(fy * 100 + fx)) return [fx, fy]; } return null; }
    useEmber(x, y, dir) { if (this.emberCard && this.emberCard.plank) return this.usePlank(x, y); if (this.emberCard && this.emberCard.tuner) return this.placeTuner(x, y, dir);   /* chapter 4: lay or take up the plank */
      if (this.emberCheck()) return false; const f = this.emberTarget(x, y); if (!f) return false; const E = this.emberCard;
      if (E.torch) { this.cost -= E.cost; E.cdT = E.cd; E.used++; this.torches.push({ x, y, r: E.r, t0: this.t, until: this.t + E.dur }); this.lampV = (this.lampV || 0) + 1; this.fx.push({ k: "torch", x, y, t: 0, life: 0.9 }); return true; }
      this.cost -= E.cost; E.cdT = E.cd; E.used++; this._ember = true; this.relight(f[0], f[1]); this._ember = false; this.fx.push({ k: "ember", x: f[0], y: f[1], from: [x, y], t: 0, life: 0.9 });
      const L = this.lampHp && this.lampHp.get(f[1] * 100 + f[0]); if (L) L.hp = Math.max(L.hp, this.stage.lamps.hp * 0.5);   /* a brazier with health lit by the ember has at least half of it */
      if (this.pat && this.pat.kind === "B") this.patternEnd(); return true; }
    get deployed() { return this.units.filter((u) => !u.clone).length; }   // a drawn summon takes a place too; only a skill's short-lived double does not
    unitAt(x, y) { return this.units.find((u) => u.x === x && u.y === y); }
    canDeployAt(card, x, y, lightOK) {
      if (this.onlyTile && (x !== this.onlyTile[0] || y !== this.onlyTile[1])) return false;
      const c0 = tileAt(x, y), c = c0 === "~" || c0 === "=" ? "." : c0;
      if (c !== "*" && c !== "T" && (card.def.tile === "g" ? c !== "." && c !== "x" : c !== "h")) return false;   /* "T": a rampart top, for any class (chapter 3) */   /* "x": a low fence (chapter 2): ground operators stand on it, no foe walks it, the wind blows over it */
      if (this.fireAt(x, y)) return false;   // a burning square: nobody can be set down in the fire
      if (this.driftAt(x, y)) return false;   // snowed under by the last gust
      if (this.frost && this.fogAt(x, y)) return false;   /* a frost stage: nobody is set down in the fog */
      if (this.iceAt(x, y)) return false;   /* frozen over by the eagle's dead fire (pattern B) */
      if (this.enemies.some((q) => !q.dead && !q.def.flying && (q.waiting || q.ally || q.stake || q.postUntil > this.t) && Math.round(q.x) === x && Math.round(q.y) === y)) return false;   // somebody is waiting, posted or standing with us on that square
      for (let i = this.waveIdx; i < this.waves.length; i++) { const o = this.waves[i][3]; if (this.waves[i][0] <= 1 && o && o.at && (o.until !== undefined || o.wait || o.ally) && o.at[0] === x && o.at[1] === y) return false; }   // a post is kept free for the one who has not come to it yet
      if (this.enemies.some((q) => q.perched && q.x === x && q.y === y)) return false;   // somebody is already up there
      if (this.vip && !this.vip.dead && Math.round(this.vip.x) === x && Math.round(this.vip.y) === y) return false;   // lab: nobody is set down on the walking ally
      if (this.vipSquares.length && this.vipSquares.some((q) => q[0] === x && q[1] === y)) return false;   // ...nor on a square where she stands or will wait
      if (this.ch4 && this.ch4.cit.some((c) => !c.gone && c.x === x && c.y === y)) return false;   /* chapter 4: nobody is set down on a citizen */
      if (this.stage.foeLand && this.stage.foeLand.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)) return false;   /* the enemy's ground (stage.foeLand: [x0, y0, x1, y1] boxes): nobody is set down there */
      if (this.mirror && x >= this.mirror.x) return false;   // lab L3: only the real room, left of the glass
      if (this.darkNoDeploy && !lightOK && this.darkAt(x, y)) return false;   /* stage.lamps.darkDeploy false: nobody is set down in the dark */
      if (this.ch5 && this.ch5NoDeploy(x, y)) return false;   /* chapter 5: the kapellmeister's echo, the tuner's square */
      return !this.unitAt(x, y);
    }
    /* refused only because the square is dark (the page says why) */
    deployDark(card, x, y) { return !!this.darkNoDeploy && this.darkAt(x, y) && this.canDeployAt(card, x, y, true); }
    /* the staker's stake: a held, harmless foe-side object on a rampart square. It keeps the square from us until broken; it is no foe (not counted, not needed for the win) */
    plantStake(e, x, y) { const S = ENEMIES.stake, hp = (e.def.stake && e.def.stake.hp) || S.hp; e.staked = true;
      this.enemies.push({ id: this.uid++, isEnemy: true, type: "stake", def: S, path: [[x, y], [x, y]], seg: 0, segT: 0, x, y, hp, maxHp: hp, defv: S.def, res: S.res, blockedBy: null, atkT: 99,
        slowT: 0, slowAmt: 0, stunT: 0, flash: 0, remain: 1e9, hold: true, stake: true, postUntil: 0, born: this.t });
      this.fx.push({ k: "stake", x, y, t: 0, life: 0.6 }); }
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
      for (const q of this.enemies) if (q.waiting && !q.ally && !q.sleepDark && Math.max(Math.abs(Math.round(q.x) - x), Math.abs(Math.round(q.y) - y)) <= 1) this.wake(q);   // setting someone down beside it stirs it (those tied up on our side are loosed only by the light)
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
    /* one of ours standing on a rampart top (T): high ground for the rules that ask (ground foes neither hold it nor cut at it, it does not see into the dark), but a ground
       operator there still holds the climbers that walk the wall top through its square */
    onRamp(u) { return !!u && !u.isEnemy && tileAt(u.x, u.y) === "T"; }
    canHold(u, e) { if (e.def && e.def.unblockable) return false; if (this.onRamp(u)) return this.onGround(u) && this.climber(e.def); return this.onGround(u); }
    rangeTiles(u, dir = u.dir) { const c = this.cards[u.card]; return RANGE[u.rangeKey || rangeKeyOf(u.def, c ? c.elite : 0)].map((o) => { const [dx, dy] = rotate(o, dir); return [u.x + dx, u.y + dy]; }); }
    inRange(u, e, tiles = this.rangeTiles(u)) {
      if (e.isEnemy && e.downUntil > this.t) return false;
      if (e.underT > 0) return false;   /* underground in a tunnel */
      if (this.frost && e.isEnemy && !u.isEnemy && this.fogAt(e.x, e.y)) return false;   /* a frost stage: a foe in the fog cannot be made out */   // lying where it fell: there is nothing to strike yet
      if (e.mask && !e.judged) return false;   // lab L3 (LAB-04): a masked figure not judged for killing is never struck
      if (e.noTarget && !u.isEnemy) return false;   /* chapter 4: the child with the ember and the gentleman are nobody's target */
      if (e.ghost && !u.isEnemy) return false;   // lab L5: a ghost is not ours to heal or help
      if (!u.isEnemy && this.smoke.size && this.smokeAt(u.x, u.y) && Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) > 1.5) return false;   // in the smoke: no further than the next square
      if (e.stake && !u.isEnemy && u.def.tile === "g" && !this.onRamp(u)) return false;   /* a stake on the wall top: only melee up on the rampart, or ranged, reach it */
      if (e.stealth && e.blockedBy !== u) return false;   // 은신: only the one holding it back can find it
      if (e.isEnemy && e.def.highOnly && !u.isEnemy && !(tileAt(u.x, u.y) === "h" || this.onRamp(u))) return false;   /* the balloon: only from a rise or a rampart top */
      if (e.dim && !u.isEnemy && (u.def.tile !== "g" || this.onRamp(u) || Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y)) > 1.5)) return false;   // held or met in the dark: only those on the ground right beside it can make it out; nobody up on a rise sees into the dark
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
      if (k === "interval" && !u.isEnemy && this.beat) v *= this.beatLen(this.beatZone(u.x, u.y)) / this.beat.base;   // lab L2: a slow zone slows us too   // 동상: stiff fingers
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
      if (this.ch5) { raw = this.ch5Taken(target, raw, type, fromUnit); if (!(raw > 0)) return 0; }   /* chapter 5: the archduke and his ear are not harmed; the echo gives back */
      if (this.ch4) { if (target.isEnemy) { raw = this.ch4Taken(target, raw); if (!(raw > 0)) return 0; } else if (fromEnemy && this.ch4Miss(fromEnemy, target)) return 0; }   /* chapter 4: smoke, the festival, the unharmed; the marksman's misses */
      if (this._beatAmpU && fromUnit === this._beatAmpU) raw *= 1.3;   // lab L2: an instant skill started on the downbeat
      if (target.isEnemy && (target.crownUntil > this.t || target.downUntil > this.t)) return 0;
      if (target.underT > 0) return 0;   /* underground in a tunnel */
      if (target.mask && !target.judged) return 0;   // lab L3 (LAB-04): nor harmed by a blast   // a boss between his two stages, or an armour still lying where it fell: nothing harms them
      if (fromEnemy && !target.isEnemy && this.auras) raw *= this.auraMul(fromEnemy, "atk");   /* the standard bearers lift every other foe's blows */
      if (fromEnemy && !target.isEnemy && target.markT > this.t) raw *= target.markAmp || 1;   // pointed out by an informer
      if (fromUnit && target.isEnemy && this.onRamp(fromUnit) && !ONWALL(tileAt(Math.round(target.x), Math.round(target.y)))) raw *= RAMPART.out;   /* from the rampart down onto the ground */
      if (fromEnemy && !target.isEnemy && this.onRamp(target) && !ONWALL(tileAt(Math.round(fromEnemy.x), Math.round(fromEnemy.y)))) raw *= RAMPART.in;   /* from the ground up at the rampart */
      if (target.isEnemy && target.def.cover && !target.uncovered && fromUnit && fromUnit.def && fromUnit.def.tile === "h") raw *= target.def.cover;   /* the cart's cover: shots from the high ground glance off until it has been held */
      if (fromEnemy && fromEnemy.def.vsFrozen && !target.isEnemy && target.frozenT > 0) raw *= fromEnemy.def.vsFrozen;   // fangs into the frozen
      if (fromEnemy && !target.isEnemy && this.firelit(fromEnemy) && this.warmAt(target.x, target.y)) raw *= 1.5;   /* stage.firelight: lit up by the fire, an easy mark */
      if (fromEnemy && fromEnemy.def.frost && !target.isEnemy && raw > 0 && !this.warmAt(target.x, target.y)) this.frostHit(target, fromEnemy.def.frost);   /* by a lit brazier the frost does not stick */
      if (target.isEnemy && target.waiting && !target.ally) this.wake(target);   // (those tied up on our side are loosed by the light, not by a blow)
      let dmg;
      if (type === "true") dmg = raw;
      else if (type === "arts") dmg = raw * (1 - Math.max(0, (target.res !== undefined ? target.res : (target.def.res || 0)) * (target.isEnemy && target.def.thaw && target.def.thaw.res && this.thawed(target) ? target.def.thaw.res : 1) - (target.erodeT > 0 ? ERODE.resDown : 0)) / 100);   // 침식 eats into magic resistance
      else {
        let def = target.isEnemy ? target.defv : this.stat(target, "def"); if (target.isEnemy && this.auras) def *= this.auraMul(target, "def");   /* ...and their guard */
        const thaw = target.isEnemy && this.thawed(target); if (target.isEnemy && target.def.iceArmor && this.wind && this.wind.blowing && !thaw) def *= target.def.iceArmor; if (thaw && target.def.thaw.def) def *= target.def.thaw.def;   /* held by one of ours beside a lit brazier, the ice on it thaws */
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
      if (target.isEnemy && target.def.frostGuard && !this.warmHeld(target)) dmg *= target.def.frostGuard;   /* the eagle's frost: gone while one of ours on a warm square holds him */
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
      e.shove = { x0: e.x, y0: e.y, dx, dy, dist, done: 0, t: 0, dur: 0.16 + 0.12 * dist, wallStun, fromWall: WALLTOP(tileAt(Math.round(e.x), Math.round(e.y))) };
      this.fx.push({ k: "shove", x: e.x, y: e.y, dx, dy, dist, e, t: 0, life: 0.5 });
      return dist;
    }
    stepShove(e, dt) {
      const sh = e.shove; sh.t += dt;
      const q = Math.min(1, sh.t / sh.dur), want = sh.dist * (1 - (1 - q) * (1 - q));
      let wall = false, fall = false;
      while (sh.done < want - 1e-6) {
        const nd = Math.min(want, sh.done + 0.05), nx = sh.x0 + sh.dx * nd, ny = sh.y0 + sh.dy * nd, tx = Math.round(nx), ty = Math.round(ny), c = tileAt(tx, ty);
        const onWall = WALLTOP(tileAt(Math.round(sh.x0 + sh.dx * sh.done), Math.round(sh.y0 + sh.dy * sh.done)));
        if ((c === "#" || (c === "_" && this.ch4)) && tx >= 0 && ty >= 0 && tx < W && ty < H && this.voidFalls(e)) { sh.done = nd; fall = true; break; }   /* chapter 4: the night air between the roofs is no footing either */   /* the sunken floor: no footing, over it goes */
        if (!(walkable(c) || (onWall && WALLTOP(c) && this.climber(e.def)))) { wall = true; break; }   /* a climber on the wall top slides along it; anything else solid stops the slide */
        sh.done = nd;
      }
      e.x = sh.x0 + sh.dx * sh.done; e.y = sh.y0 + sh.dy * sh.done;
      if (fall) { e.shove = null; e.hp = 0; e.fell = true; this.fx.push({ k: "voidfall", x: e.x, y: e.y, e, t: 0, life: 0.7 }); return; }   /* dies where it fell; counted like any other kill */
      if (sh.fromWall && !sh.landed && walkable(tileAt(Math.round(e.x), Math.round(e.y)))) {   /* shoved off a rampart top onto the ground: a hard landing */
        sh.landed = true; e.stunT = Math.max(e.stunT || 0, WALL_DROP.stun); e.hp -= e.maxHp * WALL_DROP.pct; e.flash = 0.2;
        this.fx.push({ k: "num", x: e.x, y: e.y, v: Math.round(e.maxHp * WALL_DROP.pct), true: true, t: 0, life: 1.0 }); this.fx.push({ k: "shovewall", x: e.x, y: e.y, dx: sh.dx, dy: sh.dy, t: 0, life: 0.4 }); }
      if (q >= 1 || wall) {
        e.shove = null;
        if (wall) this.fx.push({ k: "shovewall", x: e.x, y: e.y, dx: sh.dx, dy: sh.dy, t: 0, life: 0.4 });
        if (wall && sh.wallStun) { e.stunT = Math.max(e.stunT || 0, e.def.boss ? sh.wallStun * 0.5 : sh.wallStun); this.fx.push({ k: "a2wall", x: e.x, y: e.y, dx: sh.dx, dy: sh.dy, t: 0, life: 0.6 }); }
        this.repath(e);
      }
    }
    /* the sunken floor (chapter 2 on: a stage with no background art, unless stage.voidFall is false): a foe shoved onto "#" falls; bosses, fliers and the very heavy do not */
    voidFalls(e) { return !this.stage.bg && this.stage.voidFall !== false && !e.def.boss && !e.def.flying && !((e.def.mass !== undefined ? e.def.mass : 2) >= 4); }
    // a new road to the base from where the foe stands now
    repath(e) {
      const T = [Math.round(e.x), Math.round(e.y)];
      TUN_USE = !!e.tun; CLIMB_USE = this.climber(e.def); const p = (walkC(tileAt(T[0], T[1])) ? bfsPath(T, BASE) : null) || []; TUN_USE = false; CLIMB_USE = false;   // no way to the point at all (a lab board): the same as standing off the road
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
    /* ---- chapter 3, second pass ---- */
    /* lit for a marksman that needs light (def litOnly): a lamp's or a torch's light on the square, or the balloon's mark on the one standing there */
    litFor(u) { return !this.darkAt(u.x, u.y) || u.spotT > this.t; }
    /* the balloon: round its loop at its own pace, for as long as it flies */
    balloonStep(e, dt) { const L = e.loop; let step = e.def.speed * dt;
      for (let n = 0; n <= L.length && step > 1e-9; n++) { const q = L[e.loopI % L.length], dx = q[0] - e.x, dy = q[1] - e.y, d = Math.hypot(dx, dy);
        if (d <= step) { e.x = q[0]; e.y = q[1]; e.loopI = (e.loopI + 1) % L.length; step -= d; }
        else { e.x += dx / d * step; e.y += dy / d * step; if (Math.abs(dx) > 1e-6) e.face = dx > 0 ? 1 : -1; step = 0; } } }
    /* the balloon's spotting: every few seconds the one of ours nearest under it (within spot.r) is marked for spot.dur */
    spotStep(e, dt) { const S = e.def.spot; if (e.spotCD === undefined) e.spotCD = S.every * 0.5;
      if ((e.spotCD -= dt) > 0) return; e.spotCD = S.every;
      let tg = null, bd = S.r; for (const u of this.units) { const d = Math.hypot(u.x - e.x, u.y - e.y); if (d <= bd) { bd = d; tg = u; } }
      if (!tg) return; tg.spotT = this.t + S.dur; tg.spotBy = e;
      this.fx = this.fx.filter((f) => !(f.k === "marked" && f.u === tg)); this.fx.push({ k: "marked", e, u: tg, x: tg.x, y: tg.y, label: "관측", t: 0, life: S.dur }); }
    /* the seer: it locks on to one of ours in reach that stands in the light (the marked first); unbroken for lock.time it strikes arts x lock.mult, then shoots every
       lock.every for lock.dur, then walks on for lock.rest before it looks again. The lock breaks if the one it holds leaves, falls, goes out of reach or into the dark, or the seer is stunned or shoved */
    seerStep(e, dt) { const L = e.def.lock, ok = (u) => !!u && this.units.includes(u) && Math.hypot(u.x - e.x, u.y - e.y) <= this.foeReach(e) && this.litFor(u);
      const atk = e.def.atk * (e.atkMul || 1) * (e.weakT > 0 ? 1 - e.weakAmt : 1);
      if (e.lockU && !ok(e.lockU)) { this.breakLock(e); return; }
      if (e.lockU) { e.aiming = true; e.aimTgt = e.lockU; e.face = e.lockU.x >= e.x ? 1 : -1;
        if (e.volleyT > 0) { e.volleyT -= dt;
          if ((e.lockAtk -= dt) <= 0) { e.lockAtk = L.every; this.damage(e.lockU, atk, "arts", null, e); this.fx.push({ k: "bolt", x0: e.x, y0: e.y, x1: e.lockU.x, y1: e.lockU.y, foe: true, t: 0, life: 0.25 }); }
          if (e.volleyT <= 0) { e.lockU = null; e.aiming = false; e.aimTgt = null; e.lockCD = L.rest; }
          return; }
        if ((e.lockT += dt) >= L.time) { const u = e.lockU; this.damage(u, atk * L.mult, "arts", null, e); this.fx.push({ k: "bolt", x0: e.x, y0: e.y, x1: u.x, y1: u.y, foe: true, t: 0, life: 0.35 }, { k: "sweep", x: u.x, y: u.y, r: 0.2, t: 0, life: 0.5 });
          if (e.lockFx) e.lockFx.t = e.lockFx.life; e.lockFx = null; e.volleyT = L.dur; e.lockAtk = L.every; }
        return; }
      e.aiming = false; e.aimTgt = null;
      if ((e.lockCD -= dt) > 0) return;
      const tg = e.blockedBy && ok(e.blockedBy) ? e.blockedBy : e.blockedBy || e.heldBy ? null : this.rangedTarget(e);
      if (!tg) { e.lockCD = 0.25; return; }
      e.lockU = tg; e.lockT = 0; e.volleyT = 0; e.aiming = true; e.aimTgt = tg;
      e.lockFx = { k: "hookmark", e, u: tg, x: tg.x, y: tg.y, label: "겨눔", t: 0, life: L.time }; this.fx.push(e.lockFx); }
    breakLock(e) { if (e.lockFx) e.lockFx.t = e.lockFx.life; e.lockFx = null; e.lockU = null; e.lockT = 0; e.volleyT = 0; e.aiming = false; e.aimTgt = null; e.lockCD = 1; }
    /* the lanternist: unseen except while it charges (its aim) or is held */
    burnShow(e) { const on = !e.aiming && !e.blockedBy && !e.heldBy; if (on !== !!e.stealth) { e.stealth = on; if (!on) e.revealT = this.t; }
      if (e.aiming && e.aimTgt && !e.burnWarn) { e.burnWarn = true; this.fx.push({ k: "sweepwarn", e, x: e.aimTgt.x, y: e.aimTgt.y, r: e.def.burn.splash - 0.5, label: "불길", t: 0, life: Math.max(0.3, e.atkT) }); }
      if (!e.aiming) e.burnWarn = false; }
    burnShot(e, target) { const B = e.def.burn, raw = e.def.atk * B.mult * (e.atkMul || 1) * (e.weakT > 0 ? 1 - e.weakAmt : 1);
      e.atkT = e.def.interval; e.firedAt = this.t; e.aiming = false; e.burnWarn = false; if (!e.blockedBy && !e.heldBy) e.stealth = true;
      this.damage(target, raw, "arts", null, e);
      for (const u of this.units.slice()) if (u !== target && this.units.includes(u) && Math.hypot(u.x - target.x, u.y - target.y) <= B.splash) this.damage(u, raw, "arts", null, e);
      this.fx.push({ k: "bolt", x0: e.x, y0: e.y, x1: target.x, y1: target.y, foe: true, t: 0, life: 0.25 }, { k: "sweep", x: target.x, y: target.y, r: B.splash - 0.5, t: 0, life: 0.5 }); }
    /* the nightmare's blow: every other one of ours whose square behind them (against their facing) is dark is struck as well */
    fearStrike(e, target, raw) { for (const u of this.units.slice()) { if (u === target || !this.units.includes(u)) continue;
        const [fx, fy] = rotate([1, 0], u.dir), bx = u.x - fx, by = u.y - fy;
        if (bx < 0 || by < 0 || bx >= W || by >= H || !this.darkAt(bx, by)) continue;
        this.damage(u, raw, "phys", null, e); u.flash = 0.2; this.fx.push({ k: "hookhit", x: u.x, y: u.y, label: "악몽", t: 0, life: 0.6 }); } }
    /* the wagon: foes on foot that touch it get in (up to carry; not elites or bosses, and each only once); held or broken, it lets them out where it stands */
    wagonStep(e) { if (e.blockedBy && !e.blockedBy.isEnemy && this.stat(e.blockedBy, "block") < e.def.weight) e.blockedBy = null;   /* held only while the holder's block is at least its weight (a skill's extra block run out: it rolls on) */
      if (e.blockedBy || e.heldBy) { if (e.riders.length) this.unload(e); return; }
      for (const q of this.enemies) { if (e.riders.length >= e.def.carry) break;
        if (q === e || q.dead || q.boarded || q.rode || q.hp <= 0 || q.def.flying || q.def.elite || q.def.boss || q.def.carry || q.ally || q.hired || q.stake || q.hold || q.waiting || q.postUntil > this.t || q.blockedBy || q.heldBy || q.climbT > 0 || q.underT > 0 || q.shove || q.loop) continue;
        if (Math.hypot(q.x - e.x, q.y - e.y) > 0.5) continue;
        q.boarded = true; q.rode = true; q.aiming = false; q.aimTgt = null; e.riders.push(q); this.boardedN = (this.boardedN || 0) + 1; this.fx.push({ k: "land", x: q.x, y: q.y, t: 0, life: 0.5 }); } }
    unload(e) { e.riders.forEach((q, i) => { q.boarded = false; q.path = e.path; q.seg = e.seg; q.segT = e.segT; this.advance(q, 0); q.remain = e.remain; q.blockedBy = null;
        q.x = e.x + [0.25, -0.25, 0.2, -0.2][i & 3]; q.y = e.y + [0.2, -0.2, -0.25, 0.25][i & 3]; q.stunT = 0.4 + i * 0.5; if (!this.enemies.includes(q)) this.enemies.push(q);
        this.fx.push({ k: "land", x: q.x, y: q.y, t: 0, life: 0.8 }); }); e.riders = []; }
    cargoLeak(e) { for (const q of e.riders) { q.dead = true; q.leaked = true; this.life -= q.def.life; this.leaked++; } e.riders = []; }
    /* does a foe of this def walk the ladders and wall tops? (its def's climb, or every foe on foot on a stage with climbAll) */
    climber(d) { return !!d && !d.flying && !d.noClimb && (!!d.climb || CLIMB_ALL); }
    // can a foot soldier's way from its gate be built now? (a gate that is still shut has none). Flyers, posts, landings and drops do not ask
    routeReady(type, s, o) { const d = ENEMIES[type]; if (!d || d.flying || (o && (o.at || o.land || o.drops || o.loop))) return true;
      if (d.noClimb) { const q = this.routeOf(type, s, o); return !!(q && q.length); }
      if (o && o.aim !== undefined && this.stage.leap) return true;
      if (this.stage.ch4 && this.stage.leap) return true;   /* chapter 4: a gate whose bridges are down still lets its foes out onto their roof (spawn finds their way) */
      if ((o && o.tun) || this.climber(d)) { const q = this.routeOf(type, s, o); return !!(q && q.length); }   /* a gate whose only way out is the sewer: its way exists only with the tunnels open */
      if (this.relay) return d.collector ? this.relay.state === "ground" || this.relay.state === "held" : true;   // lab L4: no road to a point here; a collector comes only while the paper is out   // lab L1: an aimed foe on a board where foes leap comes in even with no road to the point (it finds its own way)
      const p = o && o.via ? viaPath(s, o.via) : this.stage.vias && this.stage.vias[s] ? viaPath(s, this.stage.vias[s]) : PATHS[s]; return !!(p && p.length); }
    /* the way a foe of this type sent from gate s with options o will walk (the page draws the same line as its preview) */
    routeOf(type, s, o) { const d = ENEMIES[type];
      if (o && o.loop) return [...o.loop.map((q) => q.slice()), o.loop[0].slice()];   /* the balloon's round over the board (wave option loop), drawn closed */
      if (d && d.noClimb && !d.flying && !(o && (o.at || o.land || o.drops || o.tun))) { const pts = [SPAWNS[s], ...((o && o.via) || []).map((q) => [q[0], q[1]]), BASE]; let p = [];   /* the wagon: the ground way even where every foe climbs (none: no way) */
        for (let i = 0; i < pts.length - 1; i++) { const q = bfsPath(pts[i], pts[i + 1]); if (!q) return null; p = p.concat(i ? q.slice(1) : q); } return p; }
      if (o && o.tun) TUN_USE = true;   /* this one goes by the sewers: its way is worked out with the tunnels open */
      if (this.climber(d)) CLIMB_USE = true;   /* a climber: its way is worked out with the ladders and wall tops open (its own shortest way, not the gate's default route) */
      let path = o && o.tun && !o.at && !o.via && !d.flying ? bfsPath(SPAWNS[s], BASE) : o && o.at ? atPath(o.at, o.via) : o && o.land ? [SPAWNS[s].slice(), o.land.slice()] : o && o.drops ? [SPAWNS[s].slice(), ...o.drops.map((q) => q[0].slice()), BASE.slice()] : d.flying ? (o && o.air ? airPath(s, o.air) : AIR_PATHS[s]) : o && o.via ? viaPath(s, o.via) : this.stage.vias && this.stage.vias[s] ? viaPath(s, this.stage.vias[s]) : CLIMB_USE ? viaPath(s, []) : PATHS[s];   // a stage may send a gate's foot soldiers by its own way
      TUN_USE = false; CLIMB_USE = false; return path; }
    spawn(type, s, o) {
      const d = this.frost && ENEMIES[type] && ENEMIES[type].patterns ? this.frostEagle(ENEMIES[type]) : ENEMIES[type];
      let path = this.routeOf(type, s, o); const noRoad = !path;
      if (!path) path = AIR_PATHS[s];   // a foot soldier sent through a gate only drones use: let it float in rather than break
      this.enemies.push({ id: this.uid++, isEnemy: true, type, def: d, path, seg: 0, segT: 0, x: path[0][0], y: path[0][1],
        hp: d.hp, maxHp: d.hp, defv: d.def, res: d.res, blockedBy: null, atkT: d.interval * 0.5,
        slowT: 0, slowAmt: 0, stunT: 0, flash: 0, remain: segLen(path) });
      const e = this.enemies[this.enemies.length - 1];
      const rm = d.rscale ? this.stage.rmul || { hp: 1, atk: 1 } : null; if (rm) { e.hp = e.maxHp = Math.round(e.hp * rm.hp); e.atkMul = rm.atk; }   // the ranged rank and file: their own scale, which an early stage may ease
      const mul = this.stage.mul; if (mul && !d.noMul && !d.rscale) { e.hp = e.maxHp = Math.round(e.hp * (mul.hp || 1)); e.atkMul = mul.atk || 1; if (mul.def) e.defMul0 = mul.def; }   // early stages field weaker men
      if (o && o.land) { e.land = o.land; e.drop = o.drop || "soldier"; }
      if (o && o.tun) e.tun = true;
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
      if (o && o.sleepDark) { e.hold = true; e.waiting = true; e.sleepDark = true; e.postUntil = 0; e.litT = 0; }   /* asleep on its post while its square is dark (see the update) */
      if (o && o.wait) { e.hold = true; e.waiting = true; e.postUntil = 0; if (typeof o.wait === "number") e.holdUntil = o.wait; }   // standing about on the board until someone comes near, hits it, or its time comes
      if (o && o.ally && o.wait && this.stage.lamps) { const r = this.stage.lamps.r || 1, ex = Math.round(e.x), ey = Math.round(e.y); let lit = false;   // tied up on our side but already in reach of a lit lamp: loose at once
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (this.lampLit(ex + dx, ey + dy)) lit = true;
        if (lit) this.wake(e); }
      e.born = this.t;
      if (this.frost) { e.ph = o && o.ph !== undefined ? o.ph : this.frost.phase; if (d.elite || d.miniboss) this.fx.push({ k: "frostboss", type, text: d.frostBanner, x: e.x, y: e.y, t: 0, life: 2.2 }); }   /* a frost stage: whose phase it is; a mid-boss is announced */
      if (this.stage.entryFx) this.fx.push({ k: "entry", x: e.x, y: e.y, t: 0, life: 0.5 });   /* 2-6: each one drops into the middle of the board with a dark ring closing on the square */
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
      if (o && o.loop) { e.loop = o.loop; e.loopI = 1; e.remain = 99; }   /* flies its round for the whole stage; never makes for a point */
      if (d.carry) e.riders = [];
      if (d.lock) e.lockCD = 1;
      if (!d.boss) for (const q of this.enemies) if (q.stealth && q.def.stealth && !q.dead && q !== e && ++q.mins >= q.def.stealth.reveal) this.reveal(q);
      if (this.ch4) this.ch4Spawn(e, s, o, noRoad);
      if (this.ch5) this.ch5Spawn(e, s, o);   /* chapter 5: posts released by a trigger, the drop from the chandelier, the ear's line, the archduke on his stand */   /* chapter 4: posts on the roofs, roosting crows, the child, the gentleman; a foe with no way yet finds its roof's end */
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
        if (this.lampOff.size && this.stage.lamps && this.stage.lamps.fire) for (const k of [...this.lampOff]) { const fx = k % 100, fy = (k / 100) | 0; if (tileAt(fx, fy) === "F" && Math.abs(fx - Math.round(x)) + Math.abs(fy - Math.round(y)) <= 1) this.relight(fx, fy); }   /* the bottle bursting beside a brazier that is out lights it (both ways: theirs too) */
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
      if (this.ch4 && e.def.vipFirst && this.vip && !this.vip.dead && Math.hypot(this.vip.x - e.x, this.vip.y - e.y) <= this.foeReach(e)) return this.vip;   /* chapter 4: Yui first, when she is in reach */
      let best = null, bd = 1e9; const FL = this.firelit(e), LT = !!(e.def.melt && this.stage.lamps && this.stage.lamps.fire && this.lampOff.size);
      for (const u of this.units) { if (this.smoke.size && this.smokeAt(u.x, u.y)) continue;   /* hidden in the smoke */
        if (e.def.groundOnly && (!this.onGround(u) || this.onRamp(u))) continue;   /* the long rifle cannot aim up at a rise (nor a rampart) */
        if (FL && !this.warmAt(u.x, u.y)) continue;   /* stage.firelight: in the dark this marksman cannot pick anyone out */
        if (e.def.litOnly && !this.litFor(u)) continue;   /* the long rifle and the seer: only ours in the light (or under the balloon's mark) */
        const d = Math.hypot(u.x - e.x, u.y - e.y), key = (u.def.unseen ? 1e6 : 0) - (u.seq || 0) * 100 + d - ((e.def.vsFrozen || e.def.melt) && u.frozenT > 0 ? 1e5 : 0) - (u.markT > this.t ? 2e5 : 0) - (LT && this.lighting(u) ? 3e5 : 0) - (e.def.wallFirst && this.onRamp(u) ? 4e5 : 0) - (e.def.litOnly && u.spotT > this.t ? 5e5 : 0); if (d <= this.foeReach(e) && key < bd) { bd = key; best = u; } }   // those who feed on the frozen look for them first
      return best;
    }
    /* a ranged foe's reach: a climber (def climb) standing on a wall top or a ladder sees and shoots a square further */
    foeReach(e) { return e.def.ranged + (e.def.climb && ONWALL(tileAt(Math.round(e.x), Math.round(e.y))) ? RAMPART.reach : 0); }
    /* the night (stage.firelight: [enemy types]): those marksmen see only ours who stand in a brazier's warmth, and hit them half again as hard */
    firelit(e) { return !!(e && this.stage.firelight && this.stage.firelight.includes(e.type)); }
    /* one of ours in the middle of lighting a brazier: set down beside (above, below, left, right) a brazier that is out, after it went out (the firebottle goes for them first) */
    lighting(u) { for (const [a, b] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const x = u.x + a, y = u.y + b, k = y * 100 + x; if (tileAt(x, y) === "F" && this.lampOff.has(k) && u.born > (this.lampOffT.has(k) ? this.lampOffT.get(k) : -1)) return true; } return false; }
    advance(e, dist) {
      // move along the path; returns true when the base is reached
      while (dist > 0 && e.seg < e.path.length - 1) {
        const a = e.path[e.seg], b = e.path[e.seg + 1];
        const tn = !e.def.flying && tunAt(a, b);
        if (tn) { e.seg++; e.segT = 0; e.underT = tn.t; e.underFrom = a.slice(); dist = 0; if (this.fx) this.fx.push({ k: "tunin", x: a[0], y: a[1], t: 0, life: 0.6 }); break; }   /* into the tunnel: up again at b after t s */
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const left = (1 - e.segT) * L;
        if (dist < left) { e.segT += dist / L; dist = 0; }
        else { dist -= left; e.seg++; e.segT = 0; }
      }
      if (dist < 0) {   // pushed backwards
        let back = -dist;
        while (back > 0 && (e.seg > 0 || e.segT > 0)) {
          if (e.segT <= 0 && e.seg > 0 && tunAt(e.path[e.seg - 1], e.path[e.seg])) break;   /* nobody is pushed back down a tunnel */
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
      if (this.frost && this.frost.clearT !== null) { this.t += dt; for (const f of this.fx) f.t += dt; this.fx = this.fx.filter((f) => f.t < f.life); if (this.t >= this.frost.clearT + FRZ.clear) this.over = "win"; return; }   /* the blizzard lifts: the board clears, then the stage is won */
      if (this.march && this.march.choose) return;   // the road forks: everything waits for the choice
      this.t += dt;
      if (this.march) { this.marchStep(); if (this.march.choose) return; if (this.bar) this.barrageStep(dt); }
      if (this.fires.length) this.fireStep(dt);
      if (this.storm && !this.frost) this.stormStep(dt);   /* a frost stage's own blizzard takes the place of stage.storm and stage.wind */
      this.auras = null; for (const q of this.enemies) if (q.def.aura && !q.dead && q.hp > 0 && !q.ally && !q.hired) (this.auras || (this.auras = [])).push(q);   /* the standard bearers alive this tick */
      if (this.frost) this.frostStep(dt); else if (this.wind) this.windStep();
      if (this.pat) this.patternStep(dt);
      if (this.lampHp && !this.frost) this.lampHpStep(dt);
      if (this.shifts.length) this.shiftStep();
      if (this.volleys.length) this.volleyStep();
      if (this.shells.length) this.shellStep();
      if (this.calls) this.callStep();
      if (this.stage.lamps && this.lampOff.size && !this.lampHp) this.relightStep();   /* a brazier with health lights again only by mending (lampHpStep) */
      if (this.emberCard && this.emberCard.cdT > 0) this.emberCard.cdT = Math.max(0, this.emberCard.cdT - dt);
      if (this.torches.length && this.torches.some((q) => this.t >= q.until)) { this.torches = this.torches.filter((q) => this.t < q.until); this.lampV = (this.lampV || 0) + 1; }   /* a torch burnt down */
      if (this.lampEv.length) for (const ev of this.lampEv) { if (!ev.warned && this.t >= ev.t - ev.warn) { ev.warned = true; for (const [x, y] of ev.off || []) if (this.lampLit(x, y) && !this.lampGuarded(x, y)) this.fx.push({ k: "flicker", x, y, t: 0, life: ev.warn }); }
        if (!ev.done && this.t >= ev.t) { ev.done = true; for (const [x, y] of ev.off || []) this.snuff(x, y); } }   // a lamp that gutters out by the clock
      for (const b of this.bombs) if ((b.t -= dt) <= 0 && !b.done) {   // a frost bomb lands: a burst of ice over everyone close by
        b.done = true;
        for (const u of this.units.slice()) if (Math.hypot(u.x - b.x, u.y - b.y) <= b.r + 0.01) { this.damage(u, b.dmg, b.type || "arts", null); this.frostHit(u, b.frost); }
        if (b.fire) { this.snuff(b.fire[0], b.fire[1], null, true); for (const u of this.units.slice()) if (Math.max(Math.abs(u.x - b.fire[0]), Math.abs(u.y - b.fire[1])) <= 1) this.frostHit(u, b.frost); }   /* the brazier is out, and the cold takes those round it */
        this.fx.push({ k: "frostboom", x: b.x, y: b.y, r: b.r, t: 0, life: 0.8 }); this.snd("boom");
      }
      if (this.bombs.length) this.bombs = this.bombs.filter((b) => !b.done);
      // cost
      this.costAcc += dt * this.costRate * (this.ch4 ? this.ch4.costMul : 1);   /* chapter 4: the soot thieves slow it */
      while (this.costAcc >= 1) { this.costAcc -= 1; if (this.cost < (this.ch4 ? this.ch4.cap : CFG.maxCost)) this.cost++; }   /* chapter 4: the acolytes lower the cap */
      for (const c of this.cards) if (c.cooldown > 0) c.cooldown = Math.max(0, c.cooldown - dt);
      // spawns
      if (this.w2 && !this.w2.done && (this.t >= this.w2.at || (this.w2.pct && this.enemies.some((q) => q.def.boss && !q.dead && !q.ally && q.hp <= q.maxHp * this.w2.pct)))) {
        const W2 = this.w2; W2.done = true; W2.t = this.t; const rest = this.waves.slice(this.waveIdx).concat(W2.list.map((w) => [w[0] + this.t, ...w.slice(1)]));
        rest.sort((a, b) => a[0] - b[0]); this.waves = this.waves.slice(0, this.waveIdx).concat(rest); this.fx.push({ k: "wave2", t: 0, life: 2.5 }); }   /* the second wave comes on */
      if (this.horns) for (const hn of this.horns) if (!hn.done && this.t >= hn.t) { hn.done = true; let n = hn.n || 99; const by = this.enemies.find((q) => q.def.boss && !q.dead && !q.ally);
        for (const q of this.enemies) if (n > 0 && q.waiting && !q.dead && !q.ally) { this.wake(q); n--; }
        this.fx.push({ k: "call", x: by ? by.x : (BASE[0] + W) / 2, y: by ? by.y : H / 2, rouse: true, horn: true, t: 0, life: 1.4 }); }   /* stage.horns [{ t, n }]: the horn at t rouses n of the sleepers (in the order they lay down) */
      while (this.waveIdx < this.waves.length && this.waves[this.waveIdx][0] <= this.t) {
        let [, type, s, o] = this.waves[this.waveIdx++];
        if (this.frost && (s = this.frostGate(s, o)) < 0) continue;   /* a frost stage: a gate named by its square; nothing comes out of the fog */
        if (!this.routeReady(type, s, o)) { (this.waitSpawn || (this.waitSpawn = [])).push({ type, s, o, next: this.t + 1, since: this.t }); continue; }   // its way is still shut: it waits behind the gate
        this.spawn(type, s, o);
      }
      if (this.waitSpawn && this.waitSpawn.length) for (const w of this.waitSpawn.slice()) if (this.t >= w.next) {   // tried again every second; it comes in the moment its way is open
        if (this.frost && w.o && w.o.gate) { const i = SPAWNS.findIndex((q) => q[0] === w.o.gate[0] && q[1] === w.o.gate[1]); if (i >= 0) w.s = i; }   /* the gate list may have changed since */
        if (this.routeReady(w.type, w.s, w.o)) { this.waitSpawn.splice(this.waitSpawn.indexOf(w), 1); this.spawn(w.type, w.s, w.o); }
        else if (w.o && w.o.shut && this.t >= (w.since || 0) + (w.o.shut.after || 4)) { this.waitSpawn.splice(this.waitSpawn.indexOf(w), 1); this.spawn(w.type, w.o.shut.s, w.o.shut); }   /* the gate holds: round by the other way */
        else w.next = this.t + 1; }
      if (this.extra) while (this.extra.length && this.extra[0][0] <= this.t) { const [, type, s] = this.extra.shift(); this.spawn(type, s); }
      if (this.loopDef) this.loopStep();   // lab: waves without end
      if (this.vip) this.vipStep(dt);   // lab: the ally who walks
      if (this.chimneys.length) this.chimneyStep(dt);   // lab L1: the chimneys and their bridges
      if (this.ch4) this.ch4Step(dt);   /* chapter 4: citizens, fuses, festival, cost pressure, the foes' own rules */
      if (this.ch5) this.ch5Step(dt);   /* chapter 5: the flow, mutes, heckles, the ear, the archduke's song */
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
            for (const q of this.enemies) if (q !== e && !q.dead && !q.hired && !q.stake && !q.def.flying && !q.def.bomb && q.hp > 0 && q.hp < q.maxHp && Math.hypot(q.x - e.x, q.y - e.y) <= e.def.mend.r) { q.hp = Math.min(q.maxHp, q.hp + q.maxHp * e.def.mend.pct); n++; }
            if (n) this.fx.push({ k: "mend", x: e.x, y: e.y, r: e.def.mend.r, t: 0, life: 0.8 }); }
        }
      }
      for (const e of this.enemies) {
        if (e.boarded) continue;   /* riding in a wagon: off the board until it lets them out */
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
        if (e.sleepDark && e.waiting) { const dk = this.darkAt(Math.round(e.x), Math.round(e.y)); e.litT = dk ? 0 : (e.litT || 0) + dt;   /* asleep in the dark (wave option sleepDark): up and walking once its square has been lit 1.5 s (a lamp or a torch; one of ours beside it is no light) */
          if (this.stage.lamps && !this.stage.lamps.fire) { const on = dk && !this.units.some((u) => Math.max(Math.abs(u.x - e.x), Math.abs(u.y - e.y)) <= 1.2); e.dim = dk && !on; e.stealth = on; }   /* the dark hides it as it hides a foe on the move */
          if (e.litT >= 1.5) this.wake(e); }
        if (e.hold) continue;   // held in place by a script (the tutorial) or standing where the stage set it
        if (e.def.frenzy) { const F = e.def.frenzy;   /* the cold eats it as it rages */
          if (F.wind) { const calm = !!(e.blockedBy && this.warmAt(e.blockedBy.x, e.blockedBy.y)), gust = !calm && this.windHits(e.x, e.y); e.calm = calm; e.gusted = gust;   /* held by one of ours beside a lit brazier: calmed (no frenzy, no more drain); out in the blizzard: it rises three times as fast, and higher */
            if (!calm) { e.frenzyAcc = Math.min(F.wind.cap, (e.frenzyAcc || 0) + F.rate * (gust ? F.wind.rate : 1) * dt); e.hp -= e.maxHp * F.drain * dt; } e.frenzyM = calm ? 1 : 1 + Math.min(gust ? F.wind.cap : F.cap, e.frenzyAcc || 0); }
          else { e.frenzyM = 1 + Math.min(F.cap, F.rate * (this.t - e.born)); e.hp -= e.maxHp * F.drain * dt; } }
        if (e.def.snowcloak) { const on = !!(this.wind && this.wind.blowing); if (on !== !!e.stealth) { e.stealth = on; if (!on) { e.revealT = this.t; this.fx.push({ k: "icereveal", x: e.x, y: e.y, t: 0, life: 0.6 }); } } }   // white in the white-out
        if (this.stage.lamps && !this.stage.lamps.fire && !e.def.flying && !e.def.boss && !e.ally && !e.def.lantern && !e.def.burn && !(e.def.firstBlow && !e.shown)) { const dk = this.darkAt(Math.round(e.x), Math.round(e.y)), on = dk && !e.blockedBy && !this.units.some((u) => Math.max(Math.abs(u.x - e.x), Math.abs(u.y - e.y)) <= 1.2); e.dim = dk && !on; if (on !== !!e.stealth) { e.stealth = on; if (!on) { e.revealT = this.t; } } }   // out of the lamplight: unseen — unless someone holds it or it stands right beside one of ours, and then only those beside it can strike
        if (e.def.carry) this.wagonStep(e);
        if (e.def.spot) this.spotStep(e, dt);
        if (e.def.darkGrow) { const G = e.def.darkGrow; e.darkM = Math.max(0, Math.min(G.cap, (e.darkM || 0) + (this.darkAt(Math.round(e.x), Math.round(e.y)) ? G.rate : -G.rate) * dt)); }   /* the night raider: stronger every second in the dark, back down in the light */
        if (e.def.stake && !e.staked && !(e.climbT > 0)) { const sx = Math.round(e.x), sy = Math.round(e.y); if (tileAt(sx, sy) === "T" && this.canDeployAt(STAKE_CARD, sx, sy)) this.plantStake(e, sx, sy); }   /* the staker: the first empty rampart square it steps on gets its stake */
        if (e.def.snuff) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.snuff(Math.round(e.x) + dx, Math.round(e.y) + dy, e, e.def.snuff === "force");   // the snuffer: every lamp he passes that nobody stands by goes out (the lamp-breaker breaks it even so)
        if (e.def.mark) { const M = e.def.mark; if (e.markCD === undefined) e.markCD = M.every * 0.4;   // the informer: he points someone out, and for a while they are hit harder and shot at first
          if ((e.markCD -= dt) <= 0) { let tg = null; for (const high of [true, false]) { for (const u of this.units) if ((tileAt(u.x, u.y) === "h" || this.onRamp(u)) === high && Math.hypot(u.x - e.x, u.y - e.y) <= M.r && (!tg || this.stat(u, "atk") > this.stat(tg, "atk"))) tg = u; if (tg) break; }   // an operator up on high ground first
            if (tg) { e.markCD = M.every; tg.markT = this.t + M.dur; tg.markAmp = M.amp; this.fx.push({ k: "marked", e, u: tg, x: tg.x, y: tg.y, t: 0, life: M.dur }); } else e.markCD = 0.5; } }
        if (e.def.retake && !e.retook && !e.blockedBy && this.t >= (e.retakeAt || 0)) this.retakeStep(e);
        if (e.def.ember && !e.emberDone && !e.blockedBy && this.t >= (e.emberAt || 0)) this.emberStep(e);
        if (e.unsmoke && this.smoke.size) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.clearSmoke(Math.round(e.x) + dx, Math.round(e.y) + dy, e.unsmoke);   // it beats the smoke away as it passes
        if (e.def.iceHide) { const c = tileAt(Math.round(e.x), Math.round(e.y)), on = c === "=" || c === "-" || (!!this.stage.snowHide && this.driftAt(Math.round(e.x), Math.round(e.y)));   /* stage.snowHide: white on the snow the gust left too */ if (on !== !!e.stealth) { e.stealth = on; if (!on) this.fx.push({ k: "icereveal", x: e.x, y: e.y, t: 0, life: 0.6 }); } }   // white on white
        if (e.def.bomber && !e.dropped) {   // drifting in slowly: the moment someone is below and in reach, the one frost bomb goes, and it bolts
          const B = e.def.bomber; if (e.bombT === undefined) e.bombT = B.arm;
          if ((e.bombT -= dt) <= 0) {
            let tg = null, bd = B.range; for (const u of this.units) { const d0 = Math.hypot(u.x - e.x, u.y - e.y); if (d0 <= bd) { bd = d0; tg = u; } }
            let fz = null; if (this.stage.lamps && this.stage.lamps.fire && this.stage.lamps.drones !== false) { let fd = B.range; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (this.lampLit(x, y)) { const d0 = Math.hypot(x - e.x, y - e.y); if (d0 <= fd) { fd = d0; fz = [x, y]; } } }
            if (fz) { this.bombs.push({ x: fz[0], y: fz[1], t: B.fall, r: B.r, dmg: e.def.atk * B.mul * (e.atkMul || 1), frost: B.frost, type: "phys", fire: fz }); this.fx.push({ k: "bombdrop", x0: e.x, y0: e.y, x1: fz[0], y1: fz[1], t: 0, life: B.fall }); e.dropped = true; }   /* a lit brazier in reach comes first */
            else if (tg) { this.bombs.push({ x: tg.x, y: tg.y, t: B.fall, r: B.r, dmg: e.def.atk * B.mul * (e.atkMul || 1), frost: B.frost, type: "phys" }); this.fx.push({ k: "bombdrop", x0: e.x, y0: e.y, x1: tg.x, y1: tg.y, t: 0, life: B.fall }); e.dropped = true; }
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
        if (e.shove) { if (e.lockU) this.breakLock(e); this.stepShove(e, dt); continue; }   // mid-slide: no walking, no fighting
        if (e.heldBy && (e.heldBy.dead || !e.heldBy.hired || !this.enemies.includes(e.heldBy))) e.heldBy = null;
        e.slowT = Math.max(0, e.slowT - dt);
        if (e.def.falter && !e.faltered && this.phaseOn(e, e.def.falter) && e.hp > 0 && e.hp <= e.maxHp * e.def.falter.at) {   // the body changes hands for a moment: he stops where he stands, and so does everyone round him
          const F = e.def.falter; e.faltered = true; e.stunT = Math.max(e.stunT || 0, F.dur); e.falterT = this.t + F.dur; e.chargeT = 0;
          for (const q of this.enemies) if (q !== e && !q.dead && !q.hired && Math.hypot(q.x - e.x, q.y - e.y) <= F.r) q.stunT = Math.max(q.stunT || 0, F.dur * 0.6);
          this.fx.push({ k: "falter", e, x: e.x, y: e.y, t: 0, life: F.dur }); }
        if (e.def.boss && !e.enraged && e.hp <= e.maxHp * RAGE.at) { e.enraged = true; this.fx.push({ k: "enrage", e, x: e.x, y: e.y, t: 0, life: 1.0 }); }
        if (e.def.sniper && this.neyStep(e, dt)) continue;
        if (e.stunT > 0) { if (e.lockU) this.breakLock(e); e.stunT -= dt; continue; }
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
          if (cl.gust && this.wind && this.wind.flip) { const w = this.wind, nd = (w.dir + 2) % 4; if (w.blowing) w.pendingDir = nd; else { this.fx.push({ k: "windturn", dir: nd, from: w.dir, t: 0, life: w.warn + 1 }); w.dir = nd; } }   /* the standard raised turns the wind about (stage.wind.flip) */
          if (cl.gust && this.wind && !this.wind.blowing) { this.wind.next = Math.min(this.wind.next, this.t + this.wind.warn); this.wind.warned = false; }   // the standard raised: the wind answers it
          this.fx.push({ k: "call", x: e.x, y: e.y, rouse: !!cl.rouse, gust: !!cl.gust, dark: !!only("dark"), rapid: !!only("rapid"), near: !!cl.darkNear, barrage: !!cl.barrage, t: 0, life: 1.4 });
        }
        if (e.blockedBy && (!this.units.includes(e.blockedBy) || e.noBlock)) e.blockedBy = null;   /* noBlock: the eagle in his dead fire (pattern B), nobody can hold him */
        if ((e.aim !== undefined || e.noWay || (this.ch4 && e.stranded)) && this.t >= (e.replanAt || 0) && !e.blockedBy && !e.heldBy && !e.leap && !e.hop && !e.def.flying) this.replan(e);   /* chapter 4: a foe stranded on its roof looks again once a second (a bridge may be back) */   // lab: an aimed foe (or one whose road was cut) looks again once a second
        if (this.stage.leap && (e.stranded || e.leap) && this.leapStep(e, dt)) continue;   // lab L1: stranded on its roof, it leaps across in the end
        if (e.def.sweeper && this.chimneys.length) this.sweepStep(e, dt);   // lab L1: the sweep at work beside a chimney
        if (e.def.rally && e.def.rally.at && !e.rallied && e.hp <= e.maxHp * e.def.rally.at) { e.rallied = true; this.fx.push({ k: "call", x: e.x, y: e.y, rally: true, t: 0, life: 1.6 }); }   // past half: the banner of the Sacred Heart goes up
        if (e.def.callshot && !e.ally && e.hp > 0) this.shotStep(e, dt);
        if (e.def.hook && !(e.windT > 0) && !e.blockedBy && !(e.pauseT > 0)) {   // free of any blocker: now and then he throws the hook at someone up on a rise
          if (e.hookCD === undefined) e.hookCD = e.def.hook.every * 0.5;
          if ((e.hookCD -= dt) <= 0) {
            let tg = null; for (const u of this.units) if ((tileAt(u.x, u.y) === "h" || this.onRamp(u)) && Math.hypot(u.x - e.x, u.y - e.y) <= e.def.hook.r && (!tg || this.stat(u, "atk") > this.stat(tg, "atk"))) tg = u;
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
          if (e.def.cover && !e.uncovered) e.uncovered = true;   /* held: the cover is off */
          if (!(e.def.bomb.windStop && this.wind && this.wind.blowing) && (e.fuseT -= dt) <= 0) e.hp = 0;   /* the fuse does not burn in the blizzard */
        }
        e.fireTgt = this.lampHp ? this.fireTarget(e) : null;   /* a lit brazier within reach (stage.lamps.hp): it stops and strikes that instead */
        // a ranged foe keeps walking between shots; when the next one is due it stops, shoulders the gun and takes aim, then walks on
        if (e.def.ranged && !e.def.lock && !(e.underT > 0) && !e.fireTgt && !e.ammoOut && !(e.def.seenOnly && e.stealth) && (e.def.melt || (!e.blockedBy && !e.heldBy))) {   // the firebottle man takes aim even when someone has hold of him
          let tg = this.rangedTarget(e); const held = e.blockedBy || e.heldBy;
          if (held && !(tg && tg.frozenT > 0)) tg = held;
          if (tg && !e.aimTgt) e.atkT = Math.max(e.atkT, e.def.aim || RANGED_AIM);   // the sights first: never a snap shot
          e.aimTgt = tg; if (tg) e.face = tg.x >= e.x ? 1 : -1;
          e.aiming = !!tg && e.atkT <= (e.def.aim || RANGED_AIM);
          if (e.def.melt && e.aiming && e.markT !== tg) { e.markT = tg; this.fx.push({ k: "mmark", e, u: tg, x: tg.x, y: tg.y, t: 0, life: e.atkT + 0.5 }); }   // the bottle lit and raised: a flame over whoever it is meant for
        } else { e.aimTgt = null; e.aiming = false; }
        if (e.def.lock) this.seerStep(e, dt);
        if (e.def.burn) this.burnShow(e);
        const settling = e.def.ranged && e.firedAt !== undefined && this.t - e.firedAt < RANGED_HOLD;   // the kick of the shot: he stays put a moment
        if (e.drops && e.hoverT > 0) {   // an airship holding over its drop point: the men go down the ropes one by one
          e.hoverT -= dt; const q = e.drops[e.dropI - 1];
          while (q && q.left > 0 && e.hoverT <= q.next) {
            q.left--; q.next -= AIR_DROP.gap; e.cargo--;
            const m = this.spawn(q.type, 0), off = [[0, 0], [0.3, -0.25], [-0.3, 0.25], [0.3, 0.25]][q.n - q.left - 1 & 3];
            CLIMB_USE = this.climber(m.def); m.path = bfsPath(q.at, BASE) || [q.at.slice(), BASE.slice()]; CLIMB_USE = false; m.seg = 0; m.segT = 0; m.x = q.at[0] + off[0] * 0.5; m.y = q.at[1] + off[1] * 0.5; m.remain = segLen(m.path); m.dropT = this.t;   /* a climber set down from the air finds its way over the ladders too */
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
        } else if (e.underT > 0) { e.underT -= dt; if (e.underT <= 0) { e.underT = 0; this.fx.push({ k: "tunout", x: e.x, y: e.y, t: 0, life: 0.6 }); }   /* underground: out of sight and reach until it comes up */
        } else if (e.climbT > 0) { e.climbT -= dt;   /* on a ladder: going up or down it, and it can be struck meanwhile */
        } else if (e.pauseT > 0) { e.pauseT -= dt;   // stopped at a waypoint of its route: looking the ground over
        } else if (e.loop) { this.balloonStep(e, dt);
        } else if (this.beat && !e.def.flying && !e.blockedBy && !e.heldBy && ((!e.aiming && !settling) || e.hop) && !(e.postUntil > this.t) && !e.noWay) {   // lab L2: on the beat (a hop once begun is finished)
          const reached = this.beatMove(e, dt, slow);
          if (reached && !e.blockedBy && !e.heldBy && !e.aimHold) { e.dead = true; e.leaked = true; if (e.leakTo) this.meter(e.leakTo.meter, e.leakTo.by); else this.life -= e.def.life; this.leaked++; this.fx.push({ k: "leak", t: 0, life: 0.8 }); continue; }
        } else if (!e.blockedBy && !e.heldBy && !e.aiming && !settling && !(e.postUntil > this.t) && !e.noWay && !e.fireTgt && !(e.def.siege && e.aimTgt)) {   /* the mortar stands while something is in reach */
          const step = e.def.speed * (1 - slow) * (e.dashMul || 1) * (this.calls && this.calls.until > this.t && !e.def.flying ? this.calls.speed : 1) * (rally ? rally.speed : 1) * (e.chargeT > 0 ? ch.mult : 1) * (e.dropped ? e.def.bomber.dash : 1) * (e.def.tail && this.wind && this.wind.blowing ? this.tailOf(e) : 1) * (e.def.darkRun && this.darkAt(Math.round(e.x), Math.round(e.y)) ? e.def.darkRun : 1) * dt;
          const sx = e.x, sy = e.y, sseg = e.seg, st = e.segT;
          let reached = this.advance(e, step);
          if (e.path.waits && e.path.waits[e.seg] && e.waitedAt !== e.seg) { e.waitedAt = e.seg; e.pauseT = typeof e.path.waits[e.seg] === "object" ? Math.max(0.01, e.path.waits[e.seg].until - this.t) : e.path.waits[e.seg]; }
          if (e.climbAt !== e.seg && e.seg < e.path.length - 1 && tileAt(Math.round(e.path[e.seg][0]), Math.round(e.path[e.seg][1])) === "H" && this.climber(e.def)) {   /* come onto a ladder: it stops there while it goes up or down */
            const nx = e.path[e.seg + 1], pv = e.path[Math.max(0, e.seg - 1)]; e.climbAt = e.seg; e.segT = 0; this.advance(e, 0); e.climbT = e.climbDur = RAMPART.ladder;
            e.climbUp = WALLTOP(tileAt(Math.round(nx[0]), Math.round(nx[1]))); e.climbFrom = WALLTOP(tileAt(Math.round(pv[0]), Math.round(pv[1]))); }
          if (!e.def.flying && !(e.underT > 0)) {   /* just gone underground: nobody can take hold of it */
            const tx = Math.round(e.x), ty = Math.round(e.y);
            const u = this.unitAt(tx, ty);
            if (e.def.claim && u && this.canHold(u, e) && !(e.breachT > this.t && e.breachFrom === u)) this.claimBlocker(e, u);   // a boss is never walked past: a full blocker lets go of others to take him
            if (u && this.canHold(u, e) && !e.passed && !e.noBlock && !(e.breachT > this.t && e.breachFrom === u) && this.blockLoad(u) + e.def.weight <= this.stat(u, "block")) {
              e.blockedBy = u; e.blockedAt = this.t;
              if (this.ch4 && e.def.burst) this.ch4Burst(e);   /* chapter 4: the will-o'-wisp bursts the moment it is held */
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
            const q = this.spawn(e.drop, 0); CLIMB_USE = this.climber(q.def); q.path = bfsPath(e.land, BASE) || [e.land.slice(), BASE.slice()]; CLIMB_USE = false; q.seg = 0; q.segT = 0; q.x = e.land[0]; q.y = e.land[1]; q.remain = segLen(q.path); q.dropT = this.t;
            this.total++; this.fx.push({ k: "land", x: e.land[0], y: e.land[1], t: 0, life: 0.8 }); continue;
          }
          if (reached && e.toEscort && this.escort && !e.blockedBy && !e.heldBy) { e.dead = true; e.leaked = true; this.escort.hp -= e.def.life; this.leaked++; this.fx.push({ k: "escorthit", x: this.escort.x, y: this.escort.y, t: 0, life: 0.9 }); continue; }
          if (reached && !e.blockedBy && !e.heldBy && !e.aimHold) { if (e.riders && e.riders.length) this.cargoLeak(e); if (e.def.bomb) this.explode(e); e.dead = true; e.leaked = true; if (e.leakTo) this.meter(e.leakTo.meter, e.leakTo.by); else this.life -= e.def.life; this.leaked++; this.fx.push({ k: "leak", t: 0, life: 0.8 }); continue; }
        }
        if (!e.def.sniper) e.atkT -= dt;   // the marshal keeps his own count
        if (e.fireTgt && e.atkT <= 0 && !e.def.sniper && !e.sitting) { this.strikeFire(e, e.fireTgt); e.atkT = e.def.interval / (e.frenzyM || 1); }
        else if (e.atkT <= 0 && e.def.atk > 0 && !e.def.sniper && !e.sitting && !e.def.noFight && !(e.def.lock && (e.lockU || !e.blockedBy)) && !(e.def.seenOnly && e.stealth) && !e.def.vipFly) {   /* chapter 4: the clown does not fight while hidden; the crow fights in ch4Step */
          let target = e.def.melt ? e.aimTgt || e.blockedBy || e.heldBy : e.blockedBy || e.heldBy;
          if (!target && e.def.ranged) target = e.aimTgt;
          if (!target && e.def.reachHigh) { const R = e.def.reachHigh, ex = Math.round(e.x), ey = Math.round(e.y);   // a long arm: nobody holding him, he cuts at whoever stands within reach — up on a rise too — the weakest first
            for (const u of this.units) if (Math.max(Math.abs(u.x - ex), Math.abs(u.y - ey)) <= R && (!target || u.hp < target.hp)) target = u; if (target) e.reachHit = true; }
          if (!target && e.aim !== undefined) target = this.aimStrike(e);   // lab: what it was sent for, beside it
          if (target && e.def.collector && this.relay && (this.relay.state !== "held" || target !== this.relay.holder || e.carrying)) target = null;   // lab L4: the collector strikes nobody but the holder
          if (target && target.isMirror) { e.atkT = e.def.interval / (e.frenzyM || 1); this.hitMirror(e, target.sq, e.def.atk * (e.enraged ? RAGE.atk : 1) * (e.atkMul || 1)); }   // lab L3: a blow on the glass
          else if (target && target.isVip) { e.atkT = e.def.interval / (e.frenzyM || 1); this.hitVip(e, e.def.atk * (e.enraged ? RAGE.atk : 1) * (e.atkMul || 1)); if (this.ch4) { if (e.def.ranged) { this.fx.push({ k: "bolt", x0: e.x, y0: e.y, x1: target.x, y1: target.y, foe: true, t: 0, life: 0.25 }); e.firedAt = this.t; e.aiming = false; } this.ch4Hit(e, target); } }
          else if (target && this.ch5 && e.def.c5) this.ch5Strike(e, target, false);   /* chapter 5: the orchestra's blows (flow, tempo, fourth beat) */
          else if (target && e.def.sweep && (e.swings = (e.swings || 0) + 1) % e.def.sweep.every === 0) { e.windT = e.def.sweep.wind; e.windK = "sweep"; e.atkT = e.def.interval; this.fx.push({ k: "sweepwarn", e, x: e.x, y: e.y, r: e.def.sweep.r, t: 0, life: e.def.sweep.wind }); target = null; }
          else if (target && e.def.lob && !target.isEnemy && !target.isVip && !target.isMirror) { e.atkT = e.def.interval / (e.frenzyM || 1); this.lobShell(e, target.x, target.y); }   /* the mortar's shell */
          else if (target && e.def.burn) this.burnShot(e, target);
          else if (target) {
            e.atkT = e.def.interval / (e.frenzyM || 1);
            const reach = e.reachHit; e.reachHit = false;   // a cut in passing at someone he is not held by: lighter, and it does not spend the charge
            const hit = reach ? 0.7 : (e.charged && !e.def.ranged ? e.def.charge.hit : 1) * (e.frenzyM || 1) * (e.rallyT > this.t ? e.rallyBy.atk : 1);
            const br = !reach && e.charged && e.def.charge && e.def.charge.breach, breach = br && this.phaseOn(e, br) && target === e.blockedBy && !target.isEnemy && e.hp <= e.maxHp * br.at ? br : null;   // the charge that carries him through the line
            if (e.charged && !reach) { e.charged = false; if (hit > 1) this.fx.push({ k: "trample", x: target.x, y: target.y, t: 0, life: 0.6 }); }
            const more = (e.def.fourth && (e.shotN = (e.shotN || 0) + 1) % 4 === 0 ? e.def.fourth : 1) * (e.def.firstBlow && !e.shown ? e.def.firstBlow : 1);   /* the long rifle's fourth shot; the ambusher's first blow */
            if (e.def.melt) this.throwBottle(e, target);
            else this.damage(target, e.def.atk * hit * more * (1 + (e.darkM || 0)) * (e.weakT > 0 ? 1 - e.weakAmt : 1) * (e.enraged ? RAGE.atk : 1) * (e.atkMul || 1), (e.def.ranged && (!e.def.phys || (e.def.darkArts && this.darkAt(Math.round(e.x), Math.round(e.y))))) || e.def.artsMelee ? "arts" : "phys", null, e);
            if (this.ch4) this.ch4Hit(e, target);   /* chapter 4: stolen cost, the cross, bleeding, the cauldron, the broom's hop, the marksman's rounds */
            if (e.def.darkGrow) e.darkM = 0;   /* the night raider spends what it stored on the blow */
            if (e.def.fearBehind && !target.isEnemy) this.fearStrike(e, target, e.def.atk * hit * (e.weakT > 0 ? 1 - e.weakAmt : 1) * (e.enraged ? RAGE.atk : 1) * (e.atkMul || 1));
            if (breach) { e.breachFrom = target; e.breachT = this.t + 1.2; e.blockedBy = null; this.advance(e, breach.push); this.fx.push({ k: "breach", x: e.x, y: e.y, t: 0, life: 1.0 }); }
            if (e.def.ranged) { if (!e.def.melt) this.fx.push({ k: "bolt", x0: e.x, y0: e.y, x1: target.x, y1: target.y, foe: true, t: 0, life: 0.25 }); e.firedAt = this.t; e.aiming = false; e.markT = null; }
            if (e.def.ambush && (e.stealth || !e.shown)) { e.shown = true; if (e.stealth) { e.stealth = false; e.revealT = this.t; this.fx.push({ k: "ambush", e, x: e.x, y: e.y, t: 0, life: 0.9 }); } }   // the muzzle flash gives him away
          } else e.atkT = 0.2;
        }
      }
      if (this.boardedN) { this.enemies = this.enemies.filter((q) => !q.boarded); this.boardedN = 0; }
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
        if (u.blizFrozen) { u.hp -= u.maxHp * (this.pat && this.pat.kind === "B" ? PAT.frozen : BLIZ.dmg) * (this.frost ? this.frostMul() : 1) * dt; u.flash = Math.max(u.flash || 0, 0.04); }   // frozen in the blizzard: the cold eats at them
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
          { const sk = (!!a.stake) - (!!b.stake); if (sk) return sk; }   /* a stake only when no foe is in reach */
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
      for (const e of this.enemies) if (!e.dead && !e.stake && e.hp <= 0 && e.lastHitBy && e.lastHitBy.skill.id === "b_roar" && e.lastHitBy.skillT > 0) { this.cost = Math.min(CFG.maxCost, this.cost + 1); this.fx.push({ k: "dp", x: e.x, y: e.y, t: 0, life: 0.8 }); }
      for (const e of this.enemies) if (!e.dead && !e.stake && e.hp <= 0 && e.lastHitBy && e.lastHitBy.def && e.lastHitBy.def.reclaim && Math.random() < e.lastHitBy.def.reclaim) { this.cost = Math.min(CFG.maxCost, this.cost + 1); this.fx.push({ k: "boreclaim", x: e.x, y: e.y, t: 0, life: 0.9 }); }   // 시간 회수
      for (const e of this.enemies) if (!e.dead && !e.stake && e.hp <= 0 && e.lastHitBy && e.lastHitBy.def && e.lastHitBy.def.wardKill && this.units.includes(e.lastHitBy)) this.addWard(e.lastHitBy, e.lastHitBy.def.wardKill);   // 서사 왜곡: every one he finishes adds to the shell
      const BF = this.stage.bossFlee;   // a boss who quits the field at a share of his strength instead of dying on it (a stage switches this on: { on: true, at: 0.3 })
      if (BF && BF.on) for (const e of this.enemies) if (e.def.boss && !e.dead && e.hp > 0 && e.hp <= e.maxHp * BF.at) { e.dead = true; e.fled = true; this.killed++; this.bossFledT = this.t; this.snd("retreat"); this.fx.push({ k: "die", x: e.x, y: e.y, boss: true, e, fled: true, t: 0, life: 0.5 }); }
      for (let more = true; more;) { more = false; for (const e of this.enemies) if (!e.dead && e.hp <= 0 && e.def.bomb && !e.boomed) { this.explode(e); more = true; } }   // a cart broken open goes up where it stands, and may set off the next
      for (const e of this.enemies) if (!e.dead && e.hp <= 0) { e.dead = true; if (!e.ally && !e.stake && !e.loop) this.killed++; this.snd("die");
        if (this.ch4) this.ch4Death(e);   /* chapter 4: a paper lamp downed in the festival, a cauldron's swallowed one given back */
        if (e.riders && e.riders.length) this.unload(e);   /* the wagon broken: whoever rode in it gets out there */
        if (e.def.spot) { for (const u of this.units) if (u.spotBy === e) u.spotT = 0; this.fx = this.fx.filter((f) => !(f.k === "marked" && f.e === e)); }   /* the balloon down: its marks go with it */
        if (e.def.douse && !e.ally) this.douse(e);   /* the frost sack bursts where he falls */
        if (e.def.call && e.def.call.rapid && !e.ally) for (const v of this.volleys) if (v.rapidUntil > this.t) { v.rapidUntil = this.t;   // "every gun" dies with the one who gave it: the guns go back to their own time
          if (v.shotT !== undefined && v.next < v.shotT + v.every) { v.next = v.shotT + v.every; v.st = 0; } }
        if (e.stake) this.fx.push({ k: "stakebreak", x: e.x, y: e.y, t: 0, life: 0.7 });   /* a stake broken: its square is free again */
        if (!e.stake && e.lastHitBy && e.lastHitBy.def && e.lastHitBy.def.killCost && this.units.includes(e.lastHitBy)) { this.cost = Math.min(CFG.maxCost, this.cost + e.lastHitBy.def.killCost); this.fx.push({ k: "killcost", x: e.lastHitBy.x, y: e.lastHitBy.y, n: e.lastHitBy.def.killCost, t: 0, life: 1.0 }); }   /* 돌격: every kill pays a point back */ this.fx.push({ k: "die", x: e.x, y: e.y, boss: !!e.def.boss, e, t: 0, life: 0.5 }); }
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
      else if (this.waveIdx >= this.waves.length && !(this.extra && this.extra.length) && !(this.waitSpawn && this.waitSpawn.length) && this.enemies.every((e) => e.ally || e.stake || e.loop) && !this.hold && !(this.march && !this.march.part.final) && !this.frost) this.over = "win";   /* a frost stage is won only when its blizzard lifts (frostStep) */
      if (this.echo && this.over) this.echoSave();   // lab L5: the attempt is over: its record is kept
    }
  }

  /* ---- chapter 4 「발푸르기스의 밤」 (E04): everything below runs only on a stage with stage.ch4 (this.ch4 is null elsewhere).
     stage.citizens [[x, y], ...] + stage.citRules { rate, max, calm }: citizens whose fear fills while foes linger beside them; full, they run and a life is lost.
     stage.fuses [{ from, path, box }] + stage.festival { dur, cd, tick, pct, frightMul }: pressing the igniter lights the fuse, one square a second; one of ours standing on the
     next square holds the fire; at the box the festival opens (every cloak off, festOnly foes take full harm, ours lose pct of max HP every tick s, citizens fear twice as fast).
     stage.plank { slots, cd }: the plank card (the ember card's slot): lay it on a slot and anyone walks there; take it up and it is ready again cd s later.
     With stage.leap every foe on foot that has no way to a point stands at its roof's end and leaps (not only the aimed ones, as in LAB-01) */
  Object.assign(Game.prototype, {
    ch4Init() {
      const S = this.stage, CR = S.citRules || {};
      this.waves = this.waves.slice();   /* the gentleman's later approaches are added to this game's own copy */
      this.ch4 = { costMul: 1, cap: CFG.maxCost, fest: null, festCdUntil: 0, plank: null, gulps: [], nextCall: 0,
        cit: (S.citizens || []).map((c, i) => ({ i, x: c[0], y: c[1], f: 0, gone: false, goneT: 0 })), citRate: CR.rate || 2.5, citMax: CR.max || 100, calm: CR.calm || 2,
        fuses: (S.fuses || []).map((f, i) => ({ i, from: f.from.slice(), path: f.path.map((q) => q.slice()), box: f.box ? f.box.slice() : null, lit: false, pos: -1, stepT: 0 })),
        fd: Object.assign({ dur: 20, cd: 40, tick: 2, pct: 0.03, frightMul: 2 }, S.festival || {}) };
      if (S.plank) this.emberCard = { plank: true, cost: 0, cd: S.plank.cd || 15, cdT: 0, used: 0, slots: S.plank.slots.map((q) => q.slice()) };
    },
    festOn() { return !!(this.ch4 && this.ch4.fest && this.t < this.ch4.fest.until); },
    /* in the smoke: on a smoke bridge, or within r squares (each way) of a chimney whose bridge is up */
    inSmoke(x, y, r) { const rx = Math.round(x), ry = Math.round(y); if (tileAt(rx, ry) === "^") return true;
      return this.chimneys.some((c) => !c.shut && Math.max(Math.abs(c.at[0] - rx), Math.abs(c.at[1] - ry)) <= (r || 2)); },
    plankTarget(x, y) { const E = this.emberCard, P = this.ch4.plank; if (P) return P[0] === x && P[1] === y ? [x, y] : null; return E.slots.some((q) => q[0] === x && q[1] === y) && E.cdT <= 0 ? [x, y] : null; },
    usePlank(x, y) { const E = this.emberCard, C = this.ch4;
      if (C.plank) { if (C.plank[0] !== x || C.plank[1] !== y || !this.setTile(x, y, "_")) return false; C.plank = null; E.cdT = E.cd; E.used++; this.fx.push({ k: "plankup", x, y, t: 0, life: 0.7 }); return true; }
      if (E.cdT > 0 || !E.slots.some((q) => q[0] === x && q[1] === y)) return false;
      if (!this.setTile(x, y, ",")) return false; C.plank = [x, y]; this.fx.push({ k: "plank", x, y, t: 0, life: 0.7 }); return true; },
    /* the igniter at (x, y) (or the fuse it starts): lit if no fuse burns, no festival is on and the festival's wait is over */
    igniteAt(x, y, by) { const C = this.ch4; if (!C) return false; const f = C.fuses.find((q) => q.from[0] === x && q.from[1] === y); if (!f) return false;
      if (f.lit || this.festOn() || this.t < C.festCdUntil || C.fuses.some((q) => q.lit)) return false;
      f.lit = true; f.pos = -1; f.stepT = 1; f.by = by ? "child" : "us"; this.fx.push({ k: "ignite", x, y, t: 0, life: 0.8 }); this.snd("chime"); return true; },
    festStart() { const C = this.ch4, D = C.fd; C.fest = { until: this.t + D.dur, tickT: 0, t0: this.t }; C.festCdUntil = this.t + D.cd;
      for (const e of this.enemies) if (e.def.cloak) { if (e.def.cloak.start && e.cloakPerm) e.recloak = true; e.cloakPerm = false; e.cloakUntil = 0; if (e.stealth) { e.stealth = false; e.revealT = this.t; } }   /* the clowns' smoke closes round them again when the festival is over */
      for (const e of this.enemies) if (e.def.volland && !e.dead && !e.vret && !(e.underT > 0)) { const out = !this.inSmoke(e.x, e.y, e.def.volland.smoke);
        if (out) { this.meter("interest", -1); e.vret = "hit"; this.fx.push({ k: "vhit", x: e.x, y: e.y, t: 0, life: 1.4 }); } else this.fx.push({ k: "vsmoke", x: e.x, y: e.y, t: 0, life: 1.2 }); }
      this.fx.push({ k: "festival", t: 0, life: 2.0 }); this.snd("boom"); },
    ch4Spawn(e, s, o, noRoad) { const d = e.def;
      if (d.child || d.volland) e.noTarget = true;
      if (d.cloak && d.cloak.start) { e.cloakPerm = true; e.stealth = true; }
      if (o && o.roost) { e.x = o.roost[0]; e.y = o.roost[1]; e.path = [o.roost.slice(), o.roost.slice()]; e.seg = 0; e.segT = 0; e.remain = 0; e.hold = true; e.waiting = true; e.postUntil = 0; e.aimHold = true;
        e.wakeLeg = o.wakeLeg; if (o.until !== undefined) e.holdUntil = o.until; }
      if (o && o.landFx) this.fx.push({ k: "land", x: e.x, y: e.y, t: 0, life: 0.8 });
      if (d.child) { e.aim = "fuse"; e.home = SPAWNS[s].slice(); this.replan(e); }
      if (d.volland) { const at = (o && o.vfrom) || SPAWNS[s]; e.x = at[0]; e.y = at[1]; e.vfrom = at.slice(); e.vT = d.volland.land; e.path = [at.slice(), at.slice()]; e.seg = 0; e.segT = 0; e.remain = 0; e.aimHold = true; e.nextCall = this.t + d.volland.call;
        if ((this.meters.interest ? this.meters.interest.v : 1) <= 0) e.hp = 0; else this.fx.push({ k: "vland", x: at[0], y: at[1], t: 0, life: d.volland.land }); }
      if (!d.flying && !d.child && !(o && (o.roost || o.aim !== undefined)) && (noRoad || (o && o.at && !bfsPath([Math.round(e.x), Math.round(e.y)], BASE))) && !(e.postUntil > this.t)) this.replan(e);
    },
    /* what a foe takes after the chapter's rules (0: nothing) */
    ch4Taken(e, raw) { const d = e.def;
      if (d.invuln) return 0;
      if (d.smokeProof && this.inSmoke(e.x, e.y, d.smokeProof)) { if (!(e.smokeFxT > this.t)) { e.smokeFxT = this.t + 0.8; this.fx.push({ k: "smokeguard", x: e.x, y: e.y, t: 0, life: 0.6 }); } return 0; }
      if (d.festOnly && !this.festOn()) raw *= d.festOnly;
      return raw; },
    /* the marksman's round goes wide of one standing right beside a smoke bridge (half the time) */
    ch4Miss(e, u) { const m = e.def.missNear; if (!m || u.isVip) return false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (tileAt(u.x + dx, u.y + dy) === "^") { if (Math.random() < m) { this.fx.push({ k: "miss", x: u.x, y: u.y, t: 0, life: 0.7 }); return true; } return false; }
      return false; },
    ch4Hit(e, target) { const d = e.def, C = this.ch4; e.hitN = (e.hitN || 0) + 1;
      if (d.ammo && e.hitN >= d.ammo) { e.ammoOut = true; e.aimTgt = null; e.aiming = false; }
      if (!target || target.isVip || target.isEnemy) return;
      const atk = d.atk * (e.atkMul || 1);
      if (d.stealCost && e.hitN % d.stealCost.every === 0) { const n = Math.min(this.cost, d.stealCost.n); this.cost -= n; if (n) this.fx.push({ k: "steal", x: target.x, y: target.y, n, t: 0, life: 1.0 }); }
      if (d.cross && e.hitN % d.cross.every === 0) { let n = 1; for (const u of this.units.slice()) if (u !== target && Math.abs(u.x - target.x) + Math.abs(u.y - target.y) === 1) { this.damage(u, atk, "phys", null, e); n++; }
        const k = Math.min(this.cost, n); this.cost -= k; this.fx.push({ k: "cross", x: target.x, y: target.y, n: k, t: 0, life: 0.9 }); }
      if (d.bleed && e.hitN % d.bleed.every === 0) { target.bleedUntil = this.t + d.bleed.dur; target.bleedDps = atk * d.bleed.pct; }
      if (d.swallow && !e.gulped && target === e.blockedBy && !target.summoned && !target.clone && this.units.includes(target)) {
        e.gulped = true; const i = this.units.indexOf(target); this.units.splice(i, 1); for (const q of this.enemies) if (q.blockedBy === target) q.blockedBy = null;
        this.cost = Math.max(0, this.cost - d.swallow.cost); C.gulps.push({ e, u: target, until: this.t + d.swallow.window }); this.fx.push({ k: "gulp", x: target.x, y: target.y, t: 0, life: 1.0 }); this.snd("down"); }
      if (d.hopBlock && target === e.blockedBy && this.units.includes(target) && (e.hops || 0) < (d.hopBlock.n || 1)) { e.hops = (e.hops || 0) + 1; e.breachFrom = target; e.breachT = this.t + d.hopBlock.grace; e.blockedBy = null; const x0 = e.x, y0 = e.y; this.advance(e, d.hopBlock.dist);
        this.fx.push({ k: "leap", e, x0, y0, x1: e.x, y1: e.y, t: 0, life: 0.5 }); }
    },
    /* chapter 4: the cut bridge a stranded foe should wait at: of the cut bridges with one end on its own roof, the one whose far end is nearest a point counting every bridge
       as standing (so it gathers at the head of the bridge that leads on, not under the point on the wrong roof) */
    ch4Bridge(T, e) { const roof = this.reach(T), BR = new Set(); for (const c of this.chimneys) for (const [x, y] of c.bridge) BR.add(y * W + x);
      const dist = (from) => { const key = (x, y) => y * W + x, seen = new Map([[key(from[0], from[1]), 0]]), q = [from]; while (q.length) { const [x, y] = q.shift(), d = seen.get(key(x, y)); if (tileAt(x, y) === "B") return d;
          for (const [dx, dy] of [[1, 0], [0, 1], [0, -1], [-1, 0]]) { const nx = x + dx, ny = y + dy, k = key(nx, ny); if (seen.has(k) || !(walkable(tileAt(nx, ny)) || BR.has(k))) continue; seen.set(k, d + 1); q.push([nx, ny]); } } return 1e9; };
      let best = null; for (const c of this.chimneys) { if (c.bridge.every(([x, y]) => walkable(tileAt(x, y)))) continue; const [a, b] = this.bridgeEnds(c), na = roof.has(a[1] * W + a[0]), nb = roof.has(b[1] * W + b[0]); if (na === nb) continue;
        const near = na ? a : b, far = na ? b : a, d = dist(far); if (!best || d < best.d) best = { near, far, d }; }
      return best && best.d < 1e9 ? best : null; },
    ch4Burst(e) { const d = e.def; if (e.boomed) return; e.boomed = true; const dmg = d.burst.dmg * (e.atkMul || 1);
      for (const u of this.units.slice()) if (Math.hypot(u.x - e.x, u.y - e.y) <= d.burst.r) this.damage(u, dmg, "arts", null, e);
      e.hp = 0; this.fx.push({ k: "boom", x: e.x, y: e.y, r: d.burst.r, t: 0, life: 0.7 }); this.snd("boom"); },
    ch4Death(e) { const d = e.def, C = this.ch4;
      for (const G of C.gulps.slice()) if (G.e === e && this.t < G.until) { C.gulps.splice(C.gulps.indexOf(G), 1); const u = G.u;   /* the cauldron down in time: the one it swallowed is back, at half strength */
        if (!this.unitAt(u.x, u.y)) { u.hp = Math.max(1, u.maxHp * 0.5); this.units.push(u); this.fx.push({ k: "deploy", x: u.x, y: u.y, t: 0, life: 0.5 }); } else { u.hp = 0; this.units.push(u); this.retreat(u, false); } }
      if (d.festCalm && this.festOn()) for (const c of C.cit) if (!c.gone && Math.hypot(c.x - e.x, c.y - e.y) <= d.festCalm.r) { c.f = Math.max(0, c.f - d.festCalm.by); this.fx.push({ k: "calm", x: c.x, y: c.y, t: 0, life: 0.8 }); }
    },
    /* the gentleman's own way: over the board's walkable squares and the night air (never walls, chimneys or the drop), to the square beside Yui */
    vollandWay(from, to) { const key = (x, y) => y * W + x, ok = (c) => walkable(c) || c === "_", prev = new Map([[key(from[0], from[1]), null]]), q = [from]; let end = null;
      while (q.length) { const [x, y] = q.shift(); if (x === to[0] && y === to[1]) { end = [x, y]; break; }
        for (const [dx, dy] of [[1, 0], [0, 1], [0, -1], [-1, 0]]) { const nx = x + dx, ny = y + dy; if (!ok(tileAt(nx, ny)) || prev.has(key(nx, ny))) continue; prev.set(key(nx, ny), [x, y]); q.push([nx, ny]); } }
      if (!end) return null; const p = []; for (let c = end; c; c = prev.get(key(c[0], c[1]))) p.push(c); return p.reverse(); },
    ch4Step(dt) {
      const C = this.ch4, V = this.vip && !this.vip.dead ? this.vip : null, fest = this.festOn(), cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
      let sk = 0, pr = 0; for (const e of this.enemies) if (!e.dead && e.hp > 0) { if (e.def.costRegen) sk += e.def.costRegen; if (e.def.costCap) pr += e.def.costCap; }
      C.costMul = Math.max(0.25, 1 - sk); C.cap = Math.max(10, CFG.maxCost - pr);
      /* the fuses */
      for (const f of C.fuses) if (f.lit) { f.stepT += dt; if (f.stepT < 1) continue;
        const nx = f.pos + 1; if (nx < f.path.length) { if (this.unitAt(f.path[nx][0], f.path[nx][1])) { f.stepT = 1; f.held = true; continue; } f.held = false; f.pos = nx; f.stepT = 0; }
        else { f.lit = false; f.pos = -1; f.stepT = 0; f.held = false; this.festStart(); } }
      if (C.fest && this.t >= C.fest.until) C.fest = null;
      if (fest && C.fest) { C.fest.tickT += dt; if (C.fest.tickT >= C.fd.tick) { C.fest.tickT -= C.fd.tick; for (const u of this.units.slice()) if (!u.clone) { u.hp -= u.maxHp * C.fd.pct; u.flash = 0.12; } } }
      /* the citizens */
      for (const c of C.cit) { if (c.gone) continue;
        const calm = !!V && cheb(V.x, V.y, c.x, c.y) <= C.calm;
        let n = 0; for (const e of this.enemies) if (!e.dead && e.hp > 0 && !e.def.flying && !e.def.child && !e.hold && !(e.postUntil > this.t) && !(e.underT > 0) && cheb(e.x, e.y, c.x, c.y) <= 1.5) n++;
        if (calm) c.f = Math.max(0, c.f - C.citRate * dt); else c.f += C.citRate * n * (fest ? C.fd.frightMul : 1) * dt;
        if (c.f >= C.citMax) { c.f = C.citMax; c.gone = true; c.goneT = this.t; this.life -= 1; this.leaked++; this.fx.push({ k: "citflee", x: c.x, y: c.y, t: 0, life: 1.5 }); this.fx.push({ k: "leak", t: 0, life: 0.8 }); } }
      /* the swallowed: back at half strength if the cauldron fell in time, else fallen */
      for (const G of C.gulps.slice()) { const gone = !G.e.leaked && (G.e.dead || G.e.hp <= 0 || !this.enemies.includes(G.e));
        if (gone || G.e.leaked || this.t >= G.until) { C.gulps.splice(C.gulps.indexOf(G), 1); const u = G.u;
          if (gone && this.t < G.until && !this.unitAt(u.x, u.y)) { u.hp = Math.max(1, u.maxHp * 0.5); this.units.push(u); this.fx.push({ k: "deploy", x: u.x, y: u.y, t: 0, life: 0.5 }); }
          else { u.hp = 0; this.units.push(u); this.retreat(u, false); } } }
      for (const u of this.units) { if (u.bleedUntil > this.t) u.hp -= (u.bleedDps || 0) * dt; if (u.silUntil > this.t) { u.atkT = Math.max(u.atkT || 0, 0.25); u.wind = null; } }   /* bleeding; silenced by the gentleman: no attacks */
      /* the foes' own rules */
      for (const e of this.enemies) { if (e.dead || e.hp <= 0 || e.boarded) continue; const d = e.def;
        if (e.wakeLeg !== undefined && e.waiting && V && V.leg >= e.wakeLeg) this.wake(e);
        if (e.postUntil > 0 && this.t >= e.postUntil && !e.postGone && !d.flying) { e.postGone = true; if (e.aim === undefined) this.replan(e); }   /* off its post: its way from the board as it stands now */
        if (d.cloak && e.recloak && !fest) { e.recloak = false; e.cloakPerm = true; }
        if (d.cloak) { if (!e.leap && tileAt(Math.round(e.x), Math.round(e.y)) === "^" && !fest) e.cloakUntil = this.t + d.cloak.dur;
          const on = !fest && (!!e.cloakPerm || this.t < (e.cloakUntil || 0)); if (on !== !!e.stealth) { e.stealth = on; if (!on) e.revealT = this.t; } }
        if (d.burst && e.blockedBy && !e.boomed) { this.ch4Burst(e); continue; }
        if (d.summon && !e.hold && !(e.postUntil > this.t)) { e.sumT = (e.sumT || 0) + dt; if (e.sumT >= d.summon.every) { e.sumT = 0; const T = [Math.round(e.x), Math.round(e.y)];
          if (walkable(tileAt(T[0], T[1]))) { const q = this.spawn(d.summon.type, 0); q.x = e.x + 0.2; q.y = e.y; q.path = [[q.x, q.y], T]; q.seg = 0; q.segT = 0; this.replan(q); q.stunT = 0.6; this.total++; this.fx.push({ k: "land", x: q.x, y: q.y, t: 0, life: 0.6 }); } } }
        if (d.child && !e.hold) { if (e.blockedBy) { e.blkT = (e.blkT || 0) + dt; if (e.blkT >= d.giveUp && e.aim === "fuse") { e.aim = "home"; e.blockedBy = null; e.passed = true; this.replan(e); } }   /* turned back: nobody holds it again */
          if (e.aim === "fuse" && !e.blockedBy && e.remain < 0.05) { const f = C.fuses.find((q) => Math.abs(q.from[0] - Math.round(e.x)) + Math.abs(q.from[1] - Math.round(e.y)) <= 1);
            if (f) { this.igniteAt(f.from[0], f.from[1], e); e.aim = "home"; e.passed = true; this.replan(e); } }
          if (e.aim === "home" && e.remain < 0.05 && Math.abs(e.x - e.home[0]) + Math.abs(e.y - e.home[1]) < 0.3) { e.dead = true; this.killed++; this.fx.push({ k: "wake", e, x: e.x, y: e.y, t: 0, life: 0.6 }); continue; } }
        if (d.vipFly && !e.hold) { if (V) { const dd = Math.hypot(V.x - e.x, V.y - e.y); e.aimHold = true;
            if (dd > 0.45) { e.path = [[e.x, e.y], [V.x, V.y]]; e.seg = 0; e.segT = 0; e.remain = dd; }
            else { e.path = [[e.x, e.y], [e.x, e.y]]; e.seg = 0; e.segT = 0; e.remain = 0; e.vT = (e.vT === undefined ? d.interval * 0.5 : e.vT) - dt;
              if (e.vT <= 0) { e.vT = d.interval; e.face = V.x >= e.x ? 1 : -1; e.hitAt = this.t; this.hitVip(e, d.atk * (e.atkMul || 1)); } } }
          else if (e.aimHold) { e.aimHold = false; const b = nearBase([e.x, e.y]); e.path = [[e.x, e.y], b]; e.seg = 0; e.segT = 0; e.remain = Math.hypot(b[0] - e.x, b[1] - e.y); } }
        if (d.volland) this.vollandStep(e, dt, V);
      }
    },
    /* the gentleman: he lands (vT s), walks to Yui by his own way, and goes back where he came from once the festival has caught him out of the smoke (vret "hit") or once
       he has reached her (vret "reach": she loses reach of her max HP). Back where he came from he leaves; while interest is left another approach is added 30 s later */
    vollandStep(e, dt, V) { const VD = e.def.volland, C = this.ch4;
      e.stealth = false;
      if (e.vT > 0) { e.vT -= dt; e.path = [[e.x, e.y], [e.x, e.y]]; e.seg = 0; e.segT = 0; e.remain = 0; return; }
      if (!e.vret && V) { if (Math.hypot(V.x - e.x, V.y - e.y) < 0.6) { V.hp -= V.maxHp * VD.reach; V.hitAt = this.t; this.fx.push({ k: "num", x: V.x, y: V.y, v: Math.round(V.maxHp * VD.reach), t: 0, life: 0.9 });
          if (V.hp <= 0 && !V.dead) { V.hp = 0; V.dead = true; this.fx.push({ k: "vipdown", x: V.x, y: V.y, t: 0, life: 1.5 }); } e.vret = "reach"; }
        else if (this.t >= (e.repT || 0)) { e.repT = this.t + 0.5; const p = this.vollandWay([Math.round(e.x), Math.round(e.y)], [Math.round(V.x), Math.round(V.y)]); if (p) { e.path = [[e.x, e.y]].concat(p.slice(1)); e.seg = 0; e.segT = 0; this.advance(e, 0); } }
        for (const u of this.units) if (Math.hypot(u.x - e.x, u.y - e.y) < 0.75 && !(u.silUntil > this.t)) { u.silUntil = this.t + VD.silence; this.fx.push({ k: "silence", x: u.x, y: u.y, t: 0, life: 0.8 }); }
        if (this.t >= e.nextCall) { e.nextCall = this.t + VD.call; let best = null, bd = 1e9; for (const c of C.cit) { if (c.gone || (V && Math.max(Math.abs(V.x - c.x), Math.abs(V.y - c.y)) <= C.calm)) continue; const dd = Math.hypot(c.x - e.x, c.y - e.y); if (dd < bd) { bd = dd; best = c; } }
          if (best) { best.f += C.citMax * (VD.callFear || 0.4); this.fx.push({ k: "vcall", x: best.x, y: best.y, ex: e.x, ey: e.y, t: 0, life: 1.0 }); } } }
      if (e.vret && !e.backing) { e.backing = true; const p = this.vollandWay([Math.round(e.x), Math.round(e.y)], e.vfrom); e.path = p ? [[e.x, e.y]].concat(p.slice(1)) : [[e.x, e.y], e.vfrom.slice()]; e.seg = 0; e.segT = 0; this.advance(e, 0); e.dashMul = 1.6; }
      if (e.backing && e.remain < 0.05) { e.dead = true; this.killed++; this.fx.push({ k: "vgone", x: e.x, y: e.y, t: 0, life: 1.0 });
        if ((this.meters.interest ? this.meters.interest.v : 0) > 0 && !this.waves.slice(this.waveIdx).some((w) => w[1] === "volland")) {
          const ring = this.stage.vollandRing || [e.vfrom]; const i = ring.findIndex((q) => q[0] === e.vfrom[0] && q[1] === e.vfrom[1]), nx = ring[(i + 1) % ring.length];
          const rest = this.waves.slice(this.waveIdx).concat([[this.t + 30, "volland", 0, { vfrom: nx.slice() }]]).sort((a, b) => a[0] - b[0]); this.waves = this.waves.slice(0, this.waveIdx).concat(rest); this.total++; } }
    },
  });
  /* ---- chapter 5 「악마의 트릴」 (E05): everything below runs only on a stage with stage.ch5 (this.ch5 is null elsewhere). It sits on LAB-02's beat (this.beat):
     stage.ch5beat { zones: [{ id, rects: [[x0, y0, x1, y1], ...], metronome: [x, y] | null }] }: zones of any shape (a square goes to the first zone that holds it), each with its
       own clock; one of ours beside its metronome slows it a level, a baton beside it speeds it a level. No zones: one zone over the whole board, no metronome.
     stage.tubas [{ at: [x, y], dir: 0..3 }]: the flow ("흐름") runs from each tuba square by square until "#", "W", "M" or the edge. Where it meets a resonance square
       (stage.reso) with one of ours on it, a new flow starts in that one's facing; where it meets the tuner (the card) it turns into the tuner's facing.
       On a stage with tubas: ours off the flow fill their skill points at half speed, and only ours on the flow get the downbeat bonus.
     stage.tuner { cost, dur, cd }: the tuner card (the ember card's slot): set down on an empty square ours could stand on, facing a way; it shields that face from ranged
       blows (the flow-borne bow included) and turns the flow; gone after dur s, ready again cd s later. Tap it to turn it a quarter.
     stage.meters.noise + stage.fallMeter: the discord gauge; when it is full a life is lost and it starts again from nothing.
     stage.ch5trig { name: { type, rect: [x0, y0, x1, y1], t } }: a wave option evt: name keeps a foe on its post until a foe of that type comes into rect (or until t).
     stage.ariel { mvLen, bars, slowBar, rest }: the boss's song (E05-10) */
  const CH5_FROZEN = 2;   /* a heckled one: stunned for this many of its zone's beats x 2 (one bar = four beats; see heckle) */
  Object.assign(Game.prototype, {
    ch5Init() {
      const S = this.stage, ZS = (S.ch5beat && S.ch5beat.zones && S.ch5beat.zones.length) ? S.ch5beat.zones : [{ id: "A", rects: [[0, 0, W - 1, H - 1]], metronome: null }];
      this.beat = { base: 1.4, zones: ZS.map((z) => { const xs = z.rects.flatMap((r) => [r[0], r[2]]);
        return { id: z.id, rects: z.rects.map((r) => r.slice()), x0: Math.min(...xs), x1: Math.max(...xs), metronome: z.metronome ? z.metronome.slice() : null, level: 1, ph: 0, n: 0, hn: 0, lastDown: 0, kept: false, batoned: false, off: 0 }; }) };
      this.waves = this.waves.slice();
      this.ch5 = { flux: new Set(), lines: [], cuts: [], residue: new Map(), muted: new Set(), tunerMuted: false, tuner: null, levelOff: 0, freezeUntil: 0, fired: {},
        tubas: (S.tubas || []).map((q) => ({ at: q.at.slice(), dir: q.dir })), reso: (S.reso || []).map((q) => q.slice()), sp: new Map(), ariel: null };
      if (S.tuner) this.emberCard = { tuner: true, cost: S.tuner.cost || 0, dur: S.tuner.dur || 40, cd: S.tuner.cd || 30, cdT: 0, used: 0 };
      if (S.ariel) this.ch5.ariel = Object.assign({ mvLen: 45, mvN: 4, slowBar: 8, rest: 5.6, mv: 0, cut: 0, cutMv: -1, since: null, done: false, ended: false, lastBeatN: -1 }, S.ariel);
      this.ch5Flow();
    },
    /* the zone a square belongs to */
    ch5Zone(x, y) { const Z = this.beat.zones, rx = Math.round(x), ry = Math.round(y === undefined ? 0 : y);
      return Z.find((z) => z.rects.some((r) => rx >= r[0] && rx <= r[2] && ry >= r[1] && ry <= r[3])) || Z[0]; },
    ch5Key(x, y) { return y * 100 + x; },
    onFlux(x, y) { return !!this.ch5 && this.ch5.flux.has(this.ch5Key(Math.round(x), Math.round(y))); },
    /* off the flow, on a stage that has one (where there is no tuba the flow rules are off) */
    ch5Off(u) { return !!this.ch5 && this.ch5.tubas.length > 0 && !this.onFlux(u.x, u.y); },
    tunerOn() { const T = this.ch5 && this.ch5.tuner; return !!T && this.t < T.until && !this.ch5.tunerMuted; },
    /* the flow: every tuba's line, square by square, with the turns and branches; lines keep their squares in order for the bow */
    ch5Flow() {
      const C = this.ch5, flux = new Set(), lines = [], seen = new Set(), D = [[1, 0], [0, 1], [-1, 0], [0, -1]];
      const cut = (x, y) => C.cuts.some((q) => q.until > this.t && q.x === x && q.y === y);
      const T = this.tunerOn() ? C.tuner : null;
      const run = (x, y, dir) => { const line = []; lines.push(line);
        for (let k = 0; k < 60; k++) { x += D[dir][0]; y += D[dir][1]; const c = tileAt(x, y);
          if (c === "#" || c === "W" || c === "M" || x < 0 || y < 0 || x >= W || y >= H || cut(x, y)) break;
          const sk = (y * 100 + x) * 4 + dir; if (seen.has(sk)) break; seen.add(sk);
          line.push([x, y]); flux.add(y * 100 + x);
          if (T && T.x === x && T.y === y && T.dir !== dir) { dir = T.dir; continue; }   /* the tuner turns it */
          if (C.reso.some((q) => q[0] === x && q[1] === y)) { const u = this.unitAt(x, y); if (u && u.dir !== dir) run(x, y, u.dir); }   /* a resonance square with one of ours on it: a new flow her way */
        } };
      for (const tb of C.tubas) run(tb.at[0], tb.at[1], tb.dir);
      C.flux = flux; C.lines = lines.filter((l) => l.length);
    },
    /* nobody of ours set down on a square under the echo of the kapellmeister, nor on the tuner */
    ch5NoDeploy(x, y) { const C = this.ch5, r = C.residue.get(y * 100 + x); if (r && r > this.t) return true; const T = C.tuner; return !!T && this.t < T.until && T.x === x && T.y === y; },
    /* the zones' clocks (in place of the lab's beatStep) */
    ch5Beat(dt) {
      const C = this.ch5; if (C.freezeUntil > this.t) return;
      for (const z of this.beat.zones) {
        if (z.metronome) { const [mx, my] = z.metronome, near = (x, y) => Math.abs(x - mx) + Math.abs(y - my) === 1;
          z.kept = this.units.some((u) => near(u.x, u.y) && !C.muted.has(u.id) && !u.ghost); z.batoned = this.enemies.some((e) => !e.dead && e.def.baton && !e.hop && near(Math.round(e.x), Math.round(e.y))); }
        else { z.kept = false; z.batoned = false; }
        z.level = Math.max(0, Math.min(2, 1 + C.levelOff - (z.kept ? 1 : 0) + (z.batoned ? 1 : 0)));
        const ph0 = z.ph; z.ph += dt / this.beatLen(z);
        if (ph0 < 0.5 && z.ph >= 0.5) z.hn++;   /* the half beat (the off-beat hounds) */
        while (z.ph >= 1) { z.ph -= 1; z.n++; if (z.n % 4 === 0) z.lastDown = this.t; this.ch5OnBeat(z); }
      }
    },
    /* a beat of zone z: the fourth beat's blows, the singer's phrase, the third movement's sore flow */
    ch5OnBeat(z) {
      const b = z.n % 4, inZ = (e) => this.ch5Zone(e.x, e.y) === z;
      for (const e of this.enemies) { if (e.dead || e.hp <= 0 || !e.def.c5 || e.stunT > 0 || e.underT > 0 || !inZ(e)) continue; const c = e.def.c5;
        if (c.phrase) { e.phB = (e.phB || 0) + 1; if (e.phB >= c.phrase.beats) { e.phB = 0; this.ch5Phrase(e); } }
        if (b !== 3) continue;
        if (c.fluxChain) { if (this.onFlux(e.x, e.y)) this.ch5Bow(e); continue; }
        if (c.lineShot) { this.ch5Lines(e); continue; }
        if (c.down) { const tg = e.blockedBy || (e.def.ranged ? this.rangedTarget(e) : null) || (c.down.aoe ? this.units.find((u) => Math.max(Math.abs(u.x - Math.round(e.x)), Math.abs(u.y - Math.round(e.y))) <= c.down.aoe) : null);
          if (tg && !tg.isEnemy && (e.blockedBy || Math.hypot(tg.x - e.x, tg.y - e.y) <= (e.def.ranged || 1.5))) { this.ch5Strike(e, tg, true); e.atkT = Math.max(e.atkT, e.def.interval * 0.6); } }
      }
      const A = this.ch5.ariel; if (A && A.mv === 2 && b === 0) for (const u of this.units.slice()) if (this.onFlux(u.x, u.y) && this.ch5Zone(u.x, u.y) === z) { this.damage(u, u.maxHp * 0.03, "true", null, null); u.flash = 0.15; }   /* the third movement: the flow hurts */
    },
    /* the prima donna's phrase is done: every foe on the board is mended */
    ch5Phrase(e) { const p = e.def.c5.phrase.pct; for (const q of this.enemies) if (!q.dead && q.hp > 0 && !q.def.c5?.ariel && !q.def.c5?.ear && q.hp < q.maxHp) q.hp = Math.min(q.maxHp, q.hp + q.maxHp * p);
      this.fx.push({ k: "c5phrase", x: e.x, y: e.y, t: 0, life: 1.2 }); },
    /* the tuner's shield: a ranged blow from e at u crosses the tuner's square from the side it faces */
    ch5Shield(e, u) { if (!this.tunerOn()) return false; const T = this.ch5.tuner, D = [[1, 0], [0, 1], [-1, 0], [0, -1]][T.dir];
      if ((e.x - T.x) * D[0] + (e.y - T.y) * D[1] <= 0.3) return false;   /* the foe is not on the shielded side */
      if ((u.x - T.x) * D[0] + (u.y - T.y) * D[1] > 0) return false;   /* the one it aims at is not behind the shield */
      const ax = e.x, ay = e.y, bx = u.x, by = u.y, L2 = (bx - ax) ** 2 + (by - ay) ** 2; if (L2 < 1e-6) return false;
      const k = Math.max(0, Math.min(1, ((T.x - ax) * (bx - ax) + (T.y - ay) * (by - ay)) / L2)), px = ax + k * (bx - ax), py = ay + k * (by - ay);
      return Math.hypot(px - T.x, py - T.y) <= 0.55; },
    /* the first violin's bow: every one of ours on the flow line it stands on, both ways from it, up to a tuner that faces it */
    ch5Bow(e) { const ex = Math.round(e.x), ey = Math.round(e.y), T = this.tunerOn() ? this.ch5.tuner : null, hit = new Set();
      for (const L of this.ch5.lines) { const i = L.findIndex((q) => q[0] === ex && q[1] === ey); if (i < 0) continue;
        for (const s of [-1, 1]) for (let j = i + s; j >= 0 && j < L.length; j += s) { const [x, y] = L[j];
          if (T && T.x === x && T.y === y) { const D = [[1, 0], [0, 1], [-1, 0], [0, -1]][T.dir]; if ((ex - x) * D[0] + (ey - y) * D[1] > 0) break; }
          const u = this.unitAt(x, y); if (u) hit.add(u); } }
      const atk = e.def.atk * (e.atkMul || 1) * 1.2;
      for (const u of hit) { this.damage(u, atk, "phys", null, e); u.flash = 0.2; this.fx.push({ k: "bolt", x0: e.x, y0: e.y, x1: u.x, y1: u.y, foe: true, t: 0, life: 0.3 }); }
      this.fx.push({ k: "c5bow", x: e.x, y: e.y, n: hit.size, t: 0, life: 0.8 }); },
    /* the double bass: its row and its column, each way until a wall, the edge, or a flow square (which stops it) */
    ch5Lines(e) { const ex = Math.round(e.x), ey = Math.round(e.y), atk = e.def.atk * (e.atkMul || 1); let n = 0;
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) for (let k = 1; k < 20; k++) { const x = ex + dx * k, y = ey + dy * k, c = tileAt(x, y);
        if (x < 0 || y < 0 || x >= W || y >= H || c === "W" || c === "M") break; if (this.onFlux(x, y)) break;
        const u = this.unitAt(x, y); if (u && !this.ch5Shield(e, u)) { this.damage(u, atk, "phys", null, e); u.flash = 0.2; n++; } }
      const u0 = this.unitAt(ex, ey); if (u0) { this.damage(u0, atk, "phys", null, e); n++; }
      this.fx.push({ k: "c5lines", x: ex, y: ey, t: 0, life: 0.6 }); },
    /* a blow of a chapter-5 foe (its regular one, or the fourth beat's when acc) */
    ch5Strike(e, tg, acc) {
      const c = e.def.c5 || {}, z = this.ch5Zone(e.x, e.y), fast = z.level === 2, slow = z.level === 0;
      if (!acc) e.atkT = e.def.interval / (e.frenzyM || 1);
      if (!tg || tg.isEnemy || !this.units.includes(tg)) return;
      if (e.def.ranged && !e.blockedBy && this.ch5Shield(e, tg)) { this.fx.push({ k: "c5block", x: tg.x, y: tg.y, t: 0, life: 0.5 }); e.firedAt = this.t; e.aiming = false; return; }
      let atk = e.def.atk * (e.atkMul || 1) * (e.enraged ? RAGE.atk : 1); const D = acc ? c.down : null;
      let type = (e.def.ranged && !e.def.phys) || e.def.artsMelee ? "arts" : "phys"; if (c.fastArts && fast) type = "arts";
      let stun = 0; if (c.cres && e.cres) { atk *= 1 + c.cres.per * e.cres; if (c.slowStun && slow) stun = 4 * this.beatLen(z); this.fx.push({ k: "c5cres", x: tg.x, y: tg.y, n: e.cres, t: 0, life: 0.9 }); e.cres = 0; }
      if (D && D.mul) atk *= D.mul;
      let tgs = [tg]; const reach = e.blockedBy ? 1.5 : (e.def.ranged || 1.5) + 0.01;
      if (c.two || (D && D.extra)) { const o = this.units.filter((u) => u !== tg && Math.hypot(u.x - e.x, u.y - e.y) <= reach && !(e.def.ranged && this.ch5Shield(e, u))).sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y))[0]; if (o) tgs.push(o); }
      if (D && D.cross) for (const u of this.units) if (u !== tg && Math.abs(u.x - tg.x) + Math.abs(u.y - tg.y) === 1) tgs.push(u);
      if (D && D.aoe) { const r = D.aoe + (fast ? c.fastAoe || 0 : 0); tgs = this.units.filter((u) => Math.max(Math.abs(u.x - Math.round(e.x)), Math.abs(u.y - Math.round(e.y))) <= r); this.fx.push({ k: "c5aoe", x: e.x, y: e.y, r, t: 0, life: 0.6 }); }
      for (const u of tgs) { if (!this.units.includes(u)) continue; const off = c.offFlux && this.ch5Off(u);
        const hits = off && c.offFlux.hits ? c.offFlux.hits : 1;
        for (let h = 0; h < hits; h++) this.damage(u, atk, type, null, e);
        if (off && c.offFlux.arts) this.damage(u, atk * c.offFlux.arts, "arts", null, e);
        if (off && c.offFlux.splash) for (const q of this.units.slice()) if (q !== u && Math.max(Math.abs(q.x - u.x), Math.abs(q.y - u.y)) <= 1) this.damage(q, atk * c.offFlux.splash, type, null, e);
        if (stun && this.units.includes(u)) { u.st5Until = Math.max(u.st5Until || 0, this.t + stun); this.fx.push({ k: "c5stun", x: u.x, y: u.y, t: 0, life: 0.8 }); }
        u.flash = 0.15; if (e.def.ranged) this.fx.push({ k: "bolt", x0: e.x, y0: e.y, x1: u.x, y1: u.y, foe: true, t: 0, life: 0.25 }); }
      if (acc) this.fx.push({ k: "c5acc", x: e.x, y: e.y, t: 0, life: 0.5 });
      if (e.def.ranged) { e.firedAt = this.t; e.aiming = false; }
    },
    /* harm to a foe (or to ours) on a chapter-5 stage: the boss and the ear are not to be harmed; the echo gives back what it takes on its zone's first beat */
    ch5Taken(target, raw, type, fromUnit) {
      if (target.isEnemy && target.def.c5 && (target.def.c5.ariel || target.def.c5.ear)) return 0;
      if (target.isEnemy && target.def.c5 && target.def.c5.reflect && fromUnit && !fromUnit.isEnemy && raw > 0 && this.units.includes(fromUnit) && type !== "heal") {
        const z = this.ch5Zone(target.x, target.y); if (z.n % 4 === 0 && z.n > 0) { this.damage(fromUnit, raw * target.def.c5.reflect, type === "arts" ? "arts" : "phys", null, target); fromUnit.flash = 0.2; this.fx.push({ k: "c5reflect", x: target.x, y: target.y, ux: fromUnit.x, uy: fromUnit.y, t: 0, life: 0.5 }); } }
      return raw;
    },
    /* a skill goes off: on the downbeat (and, where there is a flow, on the flow) it is "on the beat"; under the ear, off the downbeat, the discord rises */
    ch5Skill(u) { const on = this.onBeat(this.ch5Zone(u.x, u.y));
      if (!on) for (const e of this.enemies) if (!e.dead && e.def.c5 && e.def.c5.ear && Math.max(Math.abs(u.x - e.x), Math.abs(u.y - e.y)) <= e.def.c5.ear.r + 0.01) { this.meter("noise", 1); this.fx.push({ k: "c5ear", x: u.x, y: u.y, t: 0, life: 1.0 }); break; }
      return on && !this.ch5Off(u); },
    ch5Spawn(e, s, o) {
      const c = e.def.c5;
      if (c && c.fluxWeak) { e.def5 = e.defv; e.res5 = e.res; }
      if (o && o.evt) { e.evt = o.evt; e.postUntil = 1e9; }
      if (o && o.fall) { e.postUntil = this.t + o.fall; e.stunT = Math.max(e.stunT || 0, o.fall); this.fx.push({ k: "land", x: e.x, y: e.y, t: 0, life: 0.8 }); }
      if (c && c.ear) { const L = o && o.ear ? o.ear : [[0, Math.round(H / 2)], [W - 1, Math.round(H / 2)]]; e.earPath = L.map((q) => q.slice()); e.earI = 0; e.x = L[0][0]; e.y = L[0][1]; e.postUntil = 1e9; e.noTarget = true; e.path = [[e.x, e.y], [e.x, e.y]]; }
      if (c && c.ariel) { const at = (o && o.at) || [6.5, 4]; e.x = at[0]; e.y = at[1]; e.path = [[e.x, e.y], [e.x, e.y]]; e.postUntil = 1e9; e.noTarget = true; e.remain = 99; }
      if (c && c.phrase) e.phB = 0;
    },
    /* the chapter's rules, once a tick, before the foes move */
    ch5Step(dt) {
      const C = this.ch5, cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
      if (C.cuts.length) C.cuts = C.cuts.filter((q) => q.until > this.t);
      const T = C.tuner; if (T && this.t >= T.until) { C.tuner = null; this.fx.push({ k: "c5tunerout", x: T.x, y: T.y, t: 0, life: 0.6 }); }
      /* the tuners (조율사): the nearest tuner card or keeper in reach is muted while he stands */
      C.muted.clear(); C.tunerMuted = false;
      for (const e of this.enemies) { if (e.dead || e.hp <= 0 || !e.def.c5 || !e.def.c5.mute || e.stunT > 0 || e.underT > 0) { if (e.def.c5 && e.def.c5.mute) e.muteTgt = null; continue; }
        const R = e.def.c5.mute.r; let best = null, bd = 1e9;
        if (C.tuner && this.t < C.tuner.until) { const d = Math.hypot(C.tuner.x - e.x, C.tuner.y - e.y); if (d <= R && d < bd) { bd = d; best = { tuner: true, x: C.tuner.x, y: C.tuner.y }; } }
        for (const z of this.beat.zones) if (z.metronome) for (const u of this.units) if (Math.abs(u.x - z.metronome[0]) + Math.abs(u.y - z.metronome[1]) === 1) { const d = Math.hypot(u.x - e.x, u.y - e.y); if (d <= R && d < bd) { bd = d; best = u; } }
        e.muteTgt = best; if (best) { if (best.tuner) C.tunerMuted = true; else C.muted.add(best.id); if (!(e.postUntil > this.t + 0.2) && !e.evt) e.postUntil = this.t + 0.15; } }
      this.ch5Flow();
      /* the tempo's own rules: a batoned (fast) zone mends its foes a little; the cello weakens on the flow */
      for (const e of this.enemies) { if (e.dead || e.hp <= 0 || e.boarded) continue; const c = e.def.c5;
        const z = this.ch5Zone(e.x, e.y); if (z.batoned && z.level === 2 && !(c && (c.ariel || c.ear)) && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.012 * dt);
        if (!c) continue;
        if (c.fluxWeak) { const on = this.onFlux(e.x, e.y); e.defv = e.def5 * (on ? c.fluxWeak.def : 1); e.res = e.res5 * (on ? c.fluxWeak.res : 1); e.fluxWeakOn = on; }
        if (c.cres) { const sq = Math.round(e.x) * 100 + Math.round(e.y); if (e.cresSq !== undefined && e.cresSq !== sq && !e.blockedBy && !(e.postUntil > this.t)) e.cres = Math.min(c.cres.cap, (e.cres || 0) + 1); e.cresSq = sq; }
        if (c.residue && !(e.underT > 0)) { const k = Math.round(e.y) * 100 + Math.round(e.x); C.residue.set(k, this.t + c.residue); }
        if (c.phrase && e.stunT > 0) e.phB = 0;
        if (c.phrase && this.stage.ch5PrimaWalk && this.t >= this.stage.ch5PrimaWalk && e.postUntil > this.t && !e.walking5) { e.walking5 = true; e.postUntil = this.t; }
        if (c.heckle && !(e.underT > 0) && !(e.stunT > 0)) { if (e.heckT === undefined) e.heckT = c.heckle.every * 0.5; e.heckT -= dt;
          if (e.heckT <= 0) { let tg = null, bd = 1e9; for (const u of this.units) { if (!this.onFlux(u.x, u.y) || u.st5Until > this.t || this.ch5Shield(e, u)) continue; const d = Math.hypot(u.x - e.x, u.y - e.y); if (d <= c.heckle.r && d < bd) { bd = d; tg = u; } }
            if (tg) { e.heckT = c.heckle.every; const zz = this.ch5Zone(tg.x, tg.y); tg.st5Until = this.t + 4 * this.beatLen(zz); C.cuts.push({ x: tg.x, y: tg.y, until: this.t + c.heckle.cut }); this.fx.push({ k: "c5heckle", x: tg.x, y: tg.y, ex: e.x, ey: e.y, t: 0, life: 1.0 }); }
            else e.heckT = 0.5; } }
        if (c.two && e.def.unblockable && !(e.underT > 0) && !(e.stunT > 0)) { e.k5T = (e.k5T === undefined ? e.def.interval * 0.5 : e.k5T) - dt;   /* the kapellmeister strikes as he walks: the two nearest within reach */
          if (e.k5T <= 0) { const tg = this.units.filter((u) => Math.hypot(u.x - e.x, u.y - e.y) <= e.def.ranged + 0.01).sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y))[0];
            if (tg) { e.k5T = e.def.interval; this.ch5Strike(e, tg, false); } else e.k5T = 0.3; } }
        if (c.ear) this.ch5EarStep(e, dt);
      }
      /* the triggers: posts that wait for someone to come by */
      for (const nm in (this.stage.ch5trig || {})) { if (C.fired[nm]) continue; const tr = this.stage.ch5trig[nm];
        const hit = (tr.t !== undefined && this.t >= tr.t) || this.enemies.some((e) => !e.dead && e.type === tr.type && !(e.underT > 0) && Math.round(e.x) >= tr.rect[0] && Math.round(e.x) <= tr.rect[2] && Math.round(e.y) >= tr.rect[1] && Math.round(e.y) <= tr.rect[3]);
        if (hit) { C.fired[nm] = this.t; for (const e of this.enemies) if (e.evt === nm) { e.evt = null; e.postUntil = this.t; } this.fx.push({ k: "c5rise", t: 0, life: 1.2 }); } }
      /* ours: stunned by a heckler or the crescendo's blow; skill points at half off the flow */
      for (const u of this.units) {
        if (u.st5Until > this.t) { u.atkT = Math.max(u.atkT || 0, 0.25); u.wind = null; }
        if (C.freezeUntil > this.t) { u.atkT = Math.max(u.atkT || 0, 0.25); u.wind = null; }
        const last = C.sp.get(u.id); if (last !== undefined && u.sp > last && !(u.skillT > 0) && (this.ch5Off(u) || u.st5Until > this.t || C.freezeUntil > this.t)) u.sp = last + (u.sp - last) * (this.ch5Off(u) && !(u.st5Until > this.t) && !(C.freezeUntil > this.t) ? 0.5 : 0);
        C.sp.set(u.id, u.sp); }
      if (C.freezeUntil > this.t) for (const e of this.enemies) if (!e.dead && !(e.def.c5 && (e.def.c5.ariel || e.def.c5.ear))) e.stunT = Math.max(e.stunT || 0, Math.min(0.2, C.freezeUntil - this.t));
      /* the discord: full, it costs a life and starts again */
      const N = this.meters.noise; if (N && N.max !== undefined && N.v >= N.max) { N.v = 0; this.life -= 1; this.fx.push({ k: "c5discord", t: 0, life: 1.6 }); this.fx.push({ k: "leak", t: 0, life: 0.8 }); }
      if (C.ariel) this.arielStep(dt);
    },
    /* the ear drifts along its line, two squares to its zone's bar; at the end it is gone (no life lost) */
    ch5EarStep(e, dt) { const P = e.earPath; if (!P || e.earI >= P.length - 1) { e.dead = true; e.hp = 0; this.killed--; return; }
      const z = this.ch5Zone(e.x, e.y), v = 2 / (4 * this.beatLen(z)), a = P[e.earI], b = P[e.earI + 1], dx = b[0] - e.x, dy = b[1] - e.y, d = Math.hypot(dx, dy), st = v * dt * (this.ch5.freezeUntil > this.t ? 0 : 1);
      if (d <= st) { e.x = b[0]; e.y = b[1]; e.earI++; } else { e.x += dx / d * st; e.y += dy / d * st; } e.face = dx >= 0 ? 1 : -1; void a; },
    /* the archduke's song: movements of mvLen s; four strings; all four zones slow for one bar (slowBar s) cuts one, once a movement. Fourth movement: every zone a level faster.
       Every cut stops every metronome for one bar (rest s: foes and ours stand still). The song's end with a string left: everyone hurt, every life gone */
    arielStep() {
      const A = this.ch5.ariel, C = this.ch5; if (A.done || A.ended) return;
      const boss = this.enemies.find((e) => !e.dead && e.def.c5 && e.def.c5.ariel); if (!boss) return;
      const mv = Math.min(A.mvN - 1, Math.floor(this.t / A.mvLen)); if (mv !== A.mv) { A.mv = mv; this.fx.push({ k: "c5move", n: mv + 1, t: 0, life: 2.0 }); }
      C.levelOff = A.mv >= 3 ? 1 : 0;
      const Z = this.beat.zones, allSlow = Z.every((z) => z.kept && !z.batoned);
      if (allSlow && A.cutMv !== A.mv && C.freezeUntil <= this.t) { if (A.since === null) A.since = this.t; if (this.t - A.since >= A.slowBar) { A.cut++; A.cutMv = A.mv; A.since = null; C.freezeUntil = this.t + A.rest; this.fx.push({ k: "c5cut", n: A.cut, x: boss.x, y: boss.y, t: 0, life: 2.0 }); this.snd("chime");
        if (A.cut >= 4) { A.done = true; boss.dead = true; boss.hp = 0; boss.fled = true; this.fx.push({ k: "c5bow2", x: boss.x, y: boss.y, t: 0, life: 2.5 }); } } }
      else if (!allSlow) A.since = null;
      if (!A.done && this.t >= A.mvLen * A.mvN) { A.ended = true; for (const u of this.units.slice()) this.damage(u, u.maxHp * 0.5, "true", null, null); this.life -= (this.stage.lifeMax || CFG.life); this.fx.push({ k: "c5finale", t: 0, life: 2.5 }); boss.dead = true; boss.hp = 0; }
    },
    /* the tuner card: set it down on an empty square ours could stand on (dir: 0 east, 1 south, 2 west, 3 north; left out: facing the nearest gate); tap the one set down to turn it */
    tunerCheck() { const E = this.emberCard; if (!E || !E.tuner) return "없음"; if (this.ch5.tuner && this.t < this.ch5.tuner.until) return null; if (E.cdT > 0) return "재사용 대기 중"; if (this.cost < E.cost) return "코스트 부족"; return null; },
    tunerTarget(x, y) { const T = this.ch5.tuner; if (T && this.t < T.until) return T.x === x && T.y === y ? [x, y] : null; const c = tileAt(x, y);
      if (c !== "." && c !== "h" && c !== "*" && c !== "x") return null; if (this.unitAt(x, y) || this.ch5NoDeploy(x, y)) return null; return [x, y]; },
    placeTuner(x, y, dir) { const E = this.emberCard, C = this.ch5, T = C.tuner;
      if (T && this.t < T.until) { if (T.x !== x || T.y !== y) return false; T.dir = dir !== undefined ? dir : (T.dir + 1) % 4; this.ch5Flow(); this.fx.push({ k: "c5tuner", x, y, t: 0, life: 0.5 }); return true; }
      if (this.tunerCheck() || !this.tunerTarget(x, y)) return false;
      if (dir === undefined) { let best = null, bd = 1e9; for (const s of SPAWNS) { const d = Math.hypot(s[0] - x, s[1] - y); if (d < bd) { bd = d; best = s; } } dir = !best ? 0 : Math.abs(best[0] - x) >= Math.abs(best[1] - y) ? (best[0] >= x ? 0 : 2) : (best[1] >= y ? 1 : 3); }
      this.cost -= E.cost; E.used++; E.cdT = E.dur + E.cd; C.tuner = { x, y, dir, until: this.t + E.dur }; this.ch5Flow(); this.fx.push({ k: "c5tuner", x, y, t: 0, life: 0.7 }); return true; },
  });
  // lab L2: on a stage with a beat, a manual skill started within 0.2 s of its zone's downbeat is "on the beat" (맞음): a timed one lasts 30% longer, an instant one hits 30%
  // harder; a deployment on the downbeat halves that card's next redeploy time. Stages without a beat go straight through to the methods as they are
  { const useSkill0 = Game.prototype.useSkill, deploy0 = Game.prototype.deploy, retreat0 = Game.prototype.retreat;
    Game.prototype.useSkill = function (u) {
      let on5 = false; if (this.ch5) { if (u.sp < u.skill.sp || u.skillT > 0 || u.frozenT > 0 || u.st5Until > this.t) return false; on5 = this.ch5Skill(u); }   /* chapter 5: stunned ones cannot; the ear; the bonus only on the flow */
      if (!this.beat || u.skill.mode !== "manual") return useSkill0.call(this, u);
      const on = this.ch5 ? on5 : this.onBeat(this.beatZone(u.x)); if (on && !u.skill.dur) this._beatAmpU = u;
      let r; try { r = useSkill0.call(this, u); } finally { this._beatAmpU = null; }
      if (on && r !== false) { if (u.skillT > 0) u.skillT *= 1.3; u.beatHitT = this.t; this.fx.push({ k: "onbeat", x: u.x, y: u.y, t: 0, life: 1.0 }); this.snd("chime"); }
      return r; };
    { const useSkillB = Game.prototype.useSkill;   // lab L3: the image in the glass uses its skill when its operator does
      Game.prototype.useSkill = function (u) { const r = useSkillB.call(this, u); if (this.mirror && r !== false && !u.image) { const im = this.units.find((q) => q.image && q.owner === u); if (im && !(im.skillT > 0)) { im.sp = im.skill.sp; useSkillB.call(this, im); } } return r; }; }
    Game.prototype.deploy = function (cardIdx, x, y, dir) {
      const r = deploy0.call(this, cardIdx, x, y, dir);
      if (this.beat && r !== false && this.units.some((u) => u.x === x && u.y === y && u.card === cardIdx) && this.onBeat(this.beatZone(x, y))) { this.cards[cardIdx].beatRd = true; this.fx.push({ k: "onbeat", x, y, deploy: true, t: 0, life: 1.0 }); }
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
  root.TD = { echoGet, echoSet, echoClear, setTunnels, BASES, MAP0, get W() { return W; }, get H() { return H; }, get MAP() { return MAP; }, bfsPath, viaPath, atPath, STATUS, HOLY, ERODE, rangeKeyOf, eliteCost, potOf, potList, growth, AKSTAT, SANDBOX, TUTORIAL, MAP_TUT, setMap, nameOf, revealAt, skillAt, skillDesc, skillFields, maxMastery, SK_CURVE, SKILL_LV, near, Game, UNITS, SUMMONS, ENEMIES, WAVES, STAGES, CFG, RANGE, PATHS, AIR_PATHS, SPAWNS, BASE, tileAt, rotate };
})(typeof window !== "undefined" ? window : globalThis);
