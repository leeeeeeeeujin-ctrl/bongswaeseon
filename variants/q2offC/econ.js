// Growth economy: what operators eat to grow, what each operation hands out, and when the supply operations are open.
// Data only; meta.js does the screens and the bookkeeping.
window.BSL_ECON = (() => {
  // the eight classes, each with a chip (E1) and a chip pack (E2)
  const CLS = [["선봉", "van"], ["근위", "grd"], ["중장", "def"], ["저격", "snp"], ["술사", "cst"], ["의무", "med"], ["보조", "sup"], ["특수", "spc"]];
  const clsKey = (cls) => (CLS.find((c) => c[0] === cls) || CLS[0])[1];
  // field materials: four kinds, each in a common grade (T1) and a refined one (T2). Three T1 and some coin refine into one T2.
  const MATS = [
    ["shard", "도자기 파편", "가면 조각", "하얀 도자기 가면이 깨진 조각. 망령이 쓰러진 자리에 남는다.", "금 간 가면", "통째로 남은 도자기 가면. 금 사이로 아직 냉기가 샌다."],
    ["casing", "녹슨 탄피", "탄피", "이백 년 전 머스킷의 탄피. 녹이 슬었는데도 화약 냄새가 난다.", "푸른 탄두", "마탄의 사거리 안에서 주운 탄두. 쥐면 푸른 불씨가 번진다."],
    ["frost", "서리 결정", "서리", "라스푸티차의 진창에서 굳은 서리. 녹지 않는다.", "영구 동토", "얼어 죽은 행렬 아래에서 캔 흙덩이. 손에 쥐면 손끝부터 언다."],
    ["cloth", "군기 천 조각", "천", "찢긴 연대기의 천 조각.", "독수리 장식", "군기 꼭대기의 황동 독수리. 황제 폐하 만세."],
  ];
  const ITEMS = {
    rec1: { n: "기초 작전기록", ic: "it-rec", tier: 1, exp: 200, d: "가사인격에게 작전 경험을 학습시킨다. 경험치 200.", src: "작전 클리어" },
    rec2: { n: "초급 작전기록", ic: "it-rec", tier: 2, exp: 400, d: "가사인격에게 작전 경험을 학습시킨다. 경험치 400.", src: "작전 클리어" },
    rec3: { n: "중급 작전기록", ic: "it-rec", tier: 3, exp: 1000, d: "가사인격에게 작전 경험을 학습시킨다. 경험치 1000.", src: "작전 클리어" },
    bk1: { n: "스킬 교본 Ⅰ", ic: "it-book", tier: 1, d: "스킬 레벨 2~4 강화에 쓴다.", src: "작전 클리어" },
    bk2: { n: "스킬 교본 Ⅱ", ic: "it-book", tier: 2, d: "스킬 레벨 5~6 강화에 쓴다.", src: "작전 클리어" },
    bk3: { n: "스킬 교본 Ⅲ", ic: "it-book", tier: 3, d: "스킬 레벨 7 강화에 쓴다.", src: "작전 클리어" },
  };
  for (const [ko, k] of CLS) {
    ITEMS["chip_" + k] = { n: ko + " 칩", ic: "it-chip", tier: 1, cls: ko, d: `${ko} 가사인격의 1차 정예화에 쓴다.`, src: "자원 수집 작전" };
    ITEMS["pack_" + k] = { n: ko + " 칩 팩", ic: "it-chip", tier: 2, cls: ko, d: `${ko} 가사인격의 2차 정예화에 쓴다.`, src: "자원 수집 작전 (난이도 2)" };
  }
  MATS.forEach(([k, n1, , d1, n2, d2], i) => {
    ITEMS["m1_" + k] = { n: n1, ic: "it-mat", tier: 1, kind: i, d: d1 + " 정예화와 스킬 강화의 기초 재료.", src: "작전 클리어 시 확률로 획득" };
    ITEMS["m2_" + k] = { n: n2, ic: "it-mat", tier: 2, kind: i, d: d2 + " 2차 정예화와 높은 스킬 강화에 쓴다.", src: "작전 클리어 시 낮은 확률로 획득 · 창고에서 가공" };
  });
  // base materials: what the reclaimed zones' walls and works are built up with (from the 자재 야적장 supply site)
  ITEMS.bm1 = { n: "보강 자재", ic: "it-bm1", tier: 1, d: "철근과 모래주머니, 쓸 만한 판자 묶음. 탈환 구역의 시설과 방벽을 보강한다.", src: "자원 수집 · 자재 야적장" };
  ITEMS.bm2 = { n: "강화 골조", ic: "it-bm2", tier: 2, d: "용접까지 끝난 철골 한 벌. 시설을 한 단계 더 끌어올릴 때 쓴다.", src: "자원 수집 · 자재 야적장 (난이도 2)" };
  ITEMS.perm = { n: "링크 허가증", ic: "it-perm", tier: 2, d: "공개 링크를 시작할 때 한 장을 쓴다. 공개 회선으로 신호를 보내 응답하는 가사인격을 찾는다.", src: "임무 보상" };
  ITEMS.rush = { n: "즉시 연결권", ic: "it-rush", tier: 3, d: "진행 중인 공개 링크 하나를 그 자리에서 완료한다.", src: "임무 보상" };
  const REFINE = { need: 3, coin: 300 };   // three of a T1 and some coin make one of its T2

  // operator EXP per level, and the coin it takes alongside
  const expNeed = (elite, lvl) => Math.round(80 + lvl * 10 + elite * 120);
  const coinPerExp = 0.5;
  // which two materials an operator's promotions and skill levels call for: picked from the id, so the same every time
  const hash = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  const matsOf = (id) => { const a = hash(id) % 4, b = (a + 1 + hash(id + "b") % 3) % 4; return [MATS[a][0], MATS[b][0]]; };
  // promotion: coin, chips (E1) or chip packs (E2), and two materials
  const PROMO_COST = {
    1: { 3: [3000, 2, 4, 2], 4: [4000, 3, 6, 4], 5: [6000, 4, 8, 5], 6: [8000, 5, 10, 6] },
    2: { 4: [18000, 2, 4, 3], 5: [24000, 3, 5, 4], 6: [32000, 4, 6, 5] },
  };
  function promoCost(id, rarity, cls, to) {
    const row = (PROMO_COST[to] || {})[rarity]; if (!row) return null;
    const [coin, chips, ma, mb] = row, [a, b] = matsOf(id), t = to === 1 ? "m1_" : "m2_";
    return { coin, items: [[(to === 1 ? "chip_" : "pack_") + clsKey(cls), chips], [t + a, ma], [t + b, mb]] };
  }
  // skill level n (2..7): books, materials, and the promotion it waits for
  const SK_COST = { 2: ["bk1", 2, "1a", 2, null, 0, 0], 3: ["bk1", 3, "1b", 3, null, 0, 0], 4: ["bk1", 5, "1a", 3, "1b", 2, 0],
    5: ["bk2", 4, "2a", 2, null, 0, 1], 6: ["bk2", 6, "2b", 3, null, 0, 1], 7: ["bk3", 6, "2a", 3, "2b", 3, 1] };
  function skillCost(id, to) {
    const r = SK_COST[to]; if (!r) return null;
    const [a, b] = matsOf(id), m = (x) => x && ("m" + x[0] + "_" + (x[1] === "a" ? a : b));
    const items = [[r[0], r[1]], [m(r[2]), r[3]]]; if (r[4]) items.push([m(r[4]), r[5]]);
    return { elite: r[6], coin: 500 * to, items };
  }
  // skill mastery M1-M3 (per skill, after the second promotion and skill level 7): Skill Books Ⅲ in the ratio the original's masteries keep to its level 7
  // (×1 / ×1.5 / ×2 of level 7's books), the refined materials, from M2 on the class's chip packs (the top tier we have), coin, and the hours in the training room.
  // Which two materials: picked from the operator and the skill, so each of an operator's skills asks for its own pair
  const MS_COST = { 1: { bk: 6, a: ["2", 4], b: ["1", 8], pack: 0, coin: 20000 }, 2: { bk: 9, a: ["2", 5], b: ["2", 4], pack: 1, coin: 40000 }, 3: { bk: 12, a: ["2", 6], b: ["2", 6], pack: 2, coin: 70000 } };
  const MS_HOURS = [8, 16, 24];
  function masteryCost(id, skillIdx, n) {
    const r = MS_COST[n]; if (!r) return null;
    const d = typeof TD !== "undefined" ? TD.UNITS.find((u) => u.id === id) : null; if (d && TD.maxMastery && TD.maxMastery(d) < n) return null;   // three-stars have none
    const [a, b] = matsOf(id + "#" + (skillIdx || 0)), items = [["bk3", r.bk], ["m" + r.a[0] + "_" + a, r.a[1]], ["m" + r.b[0] + "_" + b, r.b[1]]];
    if (r.pack && d) items.push(["pack_" + clsKey(d.cls), r.pack]);
    return { elite: 2, sl: 7, coin: r.coin, items, hours: MS_HOURS[n - 1] };
  }

  // what each operation hands out: fixed records or books, and rolls for materials (few early on)
  // not every operation hands out materials: the ones that do have one main drop, marked on the map
  const DROPS = {
    "BL-02": { main: "bk1", fixed: [["bk1", 1]], roll: [] },
    "BL-03": { main: "m1_shard", fixed: [["rec1", 2]], roll: [["m1_shard", 0.5]] },
    "BL-04": { main: "m1_casing", fixed: [], roll: [["m1_casing", 0.5]] },
    "BL-05": { main: "m1_frost", fixed: [["rec2", 1]], roll: [["m1_frost", 0.5]] },
    "BL-06": { main: "m1_cloth", fixed: [], roll: [["m1_cloth", 0.5], ["m2_cloth", 0.05]] },
    "BL-07": { main: "bk2", fixed: [["bk2", 1], ["rec2", 2]], roll: [["m2_shard", 0.1], ["m2_casing", 0.1], ["m2_frost", 0.1], ["m2_cloth", 0.1], ["bk3", 0.08]] },
    // chapter 2: the first-tier materials early on, the second tier from the headless general onward
    "IM-01": { main: "m1_frost", fixed: [["rec2", 1]], roll: [["m1_frost", 0.6], ["m2_frost", 0.05]] },
    "IM-02": { main: "m1_casing", fixed: [], roll: [["m1_casing", 0.6], ["m2_casing", 0.05]] },
    "IM-03": { main: "m1_cloth", fixed: [["rec2", 1]], roll: [["m1_cloth", 0.6], ["m2_cloth", 0.05]] },
    "IM-04": { main: "m1_shard", fixed: [], roll: [["m1_shard", 0.6], ["m2_shard", 0.05]] },
    "IM-05": { main: "bk2", fixed: [["bk2", 1], ["rec2", 2]], roll: [["m2_shard", 0.12], ["m2_casing", 0.12], ["m2_frost", 0.12], ["m2_cloth", 0.12]] },
    "IM-06": { main: "m2_casing", fixed: [], roll: [["m2_casing", 0.25], ["m1_casing", 0.5]] },
    "IM-07": { main: "m2_shard", fixed: [["rec2", 1]], roll: [["m2_shard", 0.25], ["m1_shard", 0.5]] },
    "IM-08": { main: "m2_cloth", fixed: [], roll: [["m2_cloth", 0.25], ["m1_cloth", 0.5]] },
    "IM-09": { main: "m2_frost", fixed: [["rec3", 1]], roll: [["m2_frost", 0.25], ["m1_frost", 0.5]] },
    "IM-10": { main: "bk3", fixed: [["bk2", 2], ["rec3", 2]], roll: [["m2_shard", 0.15], ["m2_casing", 0.15], ["m2_frost", 0.15], ["m2_cloth", 0.15], ["bk3", 0.12]] },
  };
  // the supply operations: four sites, two classes each; -1 gives chips, -2 chip packs
  const SUPPLY = {
    AM: { n: "탄약 집적소", cls: ["선봉", "저격"] },
    FH: { n: "야전 병원", cls: ["중장", "의무"] },
    CB: { n: "기병 막사", cls: ["근위", "특수"] },
    AR: { n: "기록 보관소", cls: ["술사", "보조"] },
    BM: { n: "자재 야적장", cls: [], mat: true, tiers: 6 },   // not chips: the base's building materials
    CN: { n: "무너진 환전소", cls: [], coin: true, tiers: 6 },   // coin, and nothing but: straight lanes, armour, drops from the air
  };
  for (const k of ["AM", "FH", "CB", "AR"]) SUPPLY[k].tiers = 2;
  // which are open on which day (0 Sunday .. 6 Saturday): two a weekday, all four on Saturday
  const OPEN = { 0: ["FH", "CB", "BM", "CN"], 1: ["AM", "FH", "BM"], 2: ["CB", "AR", "CN"], 3: ["AM", "CB", "BM"], 4: ["FH", "AR", "CN"], 5: ["AM", "AR", "BM"], 6: ["AM", "FH", "CB", "AR", "BM", "CN"] };
  // each supply operation's terms. Chips: two steps, aimed at the edge of promotion 1 and of promotion 2.
  // The six-step sites climb from promotion 0 to promotion 2 · Lv.50; the coin site's clear reward is its haul
  const SIX_REC = [[0, 20], [0, 40], [1, 20], [1, 45], [2, 20], [2, 50]];
  const CN_COIN = [1700, 2800, 4100, 5700, 7500, 10000];
  function SUPPLY_META(site, tier) {
    if (SUPPLY[site].tiers === 2) return tier === 1 ? { cost: 10, coin: 800, exp: 60, unlock: "BL-03", rec: [0, 45] } : { cost: 15, coin: 1500, exp: 90, unlock: "BL-05", rec: [1, 60] };
    const k = tier - 1;
    return { cost: [10, 15, 20, 25, 30, 36][k], coin: SUPPLY[site].coin ? CN_COIN[k] : [600, 900, 1200, 1500, 1800, 2100][k], exp: [60, 90, 120, 150, 180, 220][k],
      unlock: ["BL-02", "BL-03", "BL-05", "BL-06", "BL-07", "BL-07"][k], rec: SIX_REC[k] };
  }
  // the building materials by step: [frames, chance of one more], [girders, chance of one more]
  const BM_DROP = [[[2, 0.5], [0, 0]], [[4, 0.5], [0, 0]], [[4, 0.5], [0, 0.35]], [[5, 0.5], [1, 0]], [[6, 0.5], [1, 0.5]], [[6, 0.5], [2, 0.5]]];
  function supplyDrops(site, tier, rnd) {
    if (site === "CN") return [];   // its coin comes as the clear reward
    if (site === "BM") { const [[a, pa], [b, pb]] = BM_DROP[tier - 1], n1 = a + (rnd() < pa ? 1 : 0), n2 = b + (rnd() < pb ? 1 : 0); return [n2 && ["bm2", n2], n1 && ["bm1", n1]].filter(Boolean); }
    const cls = SUPPLY[site].cls, pick = () => cls[Math.floor(rnd() * cls.length)];
    const out = [];
    if (tier === 1) { out.push(["chip_" + clsKey(pick()), 1]); if (rnd() < 0.5) out.push(["chip_" + clsKey(pick()), 1]); }
    else { out.push(["pack_" + clsKey(pick()), 1]); out.push(["chip_" + clsKey(pick()), 1]); if (rnd() < 0.3) out.push(["pack_" + clsKey(pick()), 1]); }
    return out;
  }
  // ---------- the base: zones won back, each worked while operators stand guard ----------
  // a zone opens when its operation is cleared; out: what it makes, rate per hour at level 1 with a full guard;
  // fit: the classes that suit the post (+10% each); danger: raid strength per level
  // gathering sites: two to a chapter. A room sent to one gathers everything the place has, the first thing most;
  // yield: [item, per hour at level 1 with a full guard]; rec: the training it asks for, per room level ([promotion, level])
  const ZONES = [
    { code: "BL-01", ch: 1, n: "뒷골목 고물상", out: "coin", yield: [["coin", 300], ["m1_casing", 0.16], ["m1_cloth", 0.16]], fit: ["선봉", "특수"], rec: [[0, 30], [0, 45], [1, 25]],
      d: "불탄 차들 사이를 뒤져 팔 만한 부품을 뜯고, 흩어진 탄피와 군기 조각을 줍는다." },
    { code: "BL-04", ch: 1, n: "감시탑 집적소", out: "rec1", yield: [["rec1", 1.4], ["m1_shard", 0.16], ["m1_frost", 0.16]], fit: ["저격", "중장"], rec: [[0, 40], [1, 15], [1, 40]],
      d: "감시탑에 남은 작전 기록을 모으고, 탑 아래 흩어진 가면 조각과 서리 결정을 수거한다." },
  ];
  const BASE = {
    FAT: 24, DRAIN: 1, REST: [2, 3, 4], DORM_SLOTS: [3, 4, 5], SLOTS: 3, LVMUL: [1, 1.6, 2.4], CAPH: 12,   // fatigue max, per hour on guard, per hour in the dorm by its level
    RAID_EVERY: 5, RAID_JIT: 2,   // hours between raids, and the spread
    BUILD: { coin: 3000, items: [["bm1", 6]] },   // opening a new dispatch room (the first one comes ready)
    UP: { 2: { coin: 6000, items: [["bm1", 8]] }, 3: { coin: 16000, items: [["bm2", 5], ["bm1", 10]] } },
  };
  // base skills (기반 스킬): what each operator brings to a room. The first works from the start, the second from promotion 1.
  // t: prod (production in rooms making `out`: coin, rec1, mat, or one material), zone (one map), fat (fatigue drain, self or room),
  //    def (defence of the room), cap (storage), rest (dorm recovery per hour, self or all)
  const S_ = (n, t, v, o = {}) => Object.assign({ n, t, v }, o);
  const BASE_SKILLS = {
    belina: [S_("함성 지휘", "fat", 0.15, { room: 1 }), S_("가두 행진", "def", 0.15)],
    yui: [S_("지하 순찰", "def", 0.2), S_("철야 근무", "fat", 0.3)],
    hakuren: [S_("군기 수습", "prod", 0.4, { out: "m1_cloth" }), S_("기수의 걸음", "fat", 0.1, { room: 1 })],
    miho: [S_("여우비", "rest", 0.3, { all: 1 }), S_("신사의 축복", "prod", 0.15, { out: "all" })],
    lulu: [S_("철판 정비", "def", 0.15), S_("탄피 줍기", "prod", 0.35, { out: "m1_casing" })],
    irins: [S_("해골 감정", "prod", 0.4, { out: "m1_shard" }), S_("고문서 해독", "prod", 0.25, { out: "rec1" })],
    alpha: [S_("망루 전문", "zone", 0.4, { code: "BL-04" }), S_("사냥꾼의 눈", "def", 0.2)],
    skakea: [S_("수읽기", "prod", 0.3, { out: "rec1" }), S_("포석", "cap", 0.25)],
    ker: [S_("뿌리 내림", "fat", 0.4), S_("동토의 뿌리", "prod", 0.4, { out: "m1_frost" })],
    sunae: [S_("순애 수호", "def", 0.25), S_("기사의 맹세", "fat", 0.1, { room: 1 })],
    eungyeol: [S_("인해전술", "prod", 0.2, { out: "all" }), S_("분신 교대", "fat", 0.25, { room: 1 })],
    teka: [S_("사건의 지평선", "cap", 0.4), S_("중력 압착", "prod", 0.2, { out: "mat" })],
    capy: [S_("마이웨이", "fat", 0.5), S_("유자 나눔", "rest", 0.3, { all: 1 })],
    hiro: [S_("작은 용기", "def", 0.1), S_("고물 수리", "prod", 0.25, { out: "coin" })],
    lilith: [S_("밤의 장부", "prod", 0.2, { out: "coin" }), S_("야행성", "fat", 0.2)],
    ayaki: [S_("응급 처치", "rest", 0.4, { all: 1 }), S_("위생 관리", "fat", 0.1, { room: 1 })],
    nana: [S_("장거리 경계", "def", 0.2), S_("탄약 분류", "prod", 0.25, { out: "m1_casing" })],
    tao: [S_("단련", "fat", 0.25), S_("정신일도", "prod", 0.15, { out: "all" })],
    rabi: [S_("전령", "prod", 0.3, { out: "rec1" }), S_("희망의 노래", "rest", 0.4, { all: 1 })],
    rabi6: [S_("축복의 빛", "prod", 0.25, { out: "all" }), S_("후광", "fat", 0.2, { room: 1 })],
    falchion: [S_("먹 갈기", "prod", 0.35, { out: "rec1" }), S_("일필휘지", "def", 0.15)],
    veil: [S_("맹목의 파수", "def", 0.3), S_("붉은 장막", "cap", 0.2)],
    geomseon: [S_("도인의 여유", "fat", 0.5), S_("검기", "def", 0.2)],
    angelina: [S_("치유의 손길", "rest", 0.6, { all: 1 }), S_("나비 효과", "prod", 0.1, { out: "all" })],
    piania: [S_("휴식의 선율", "rest", 0.5, { all: 1 }), S_("작은 연주회", "fat", 0.15, { room: 1 })],
    silphy: [S_("금서 정리", "prod", 0.4, { out: "rec1" }), S_("심연 탐구", "prod", 0.25, { out: "m1_shard" })],
    smoqueen: [S_("연막", "def", 0.25), S_("연기 신호", "prod", 0.2, { out: "rec1" })],
    bongeun: [S_("박봉 협상", "prod", 0.4, { out: "coin" }), S_("자금 운용", "cap", 0.3)],
    alpha2: [S_("약탈자의 눈", "prod", 0.3, { out: "mat" }), S_("기습 대비", "def", 0.15)],
    skakea2: [S_("결정 가공", "prod", 0.35, { out: "m1_frost" }), S_("여왕의 수", "prod", 0.2, { out: "all" })],
    brick: [S_("묵묵한 벽", "def", 0.35), S_("움직이지 않음", "fat", 0.4)],
    jayeon: [S_("광합성", "rest", 0.6), S_("텃밭 가꾸기", "rest", 0.3, { all: 1 })],
    atat: [S_("낙서 기록", "prod", 0.25, { out: "rec1" }), S_("잉크 분류", "prod", 0.15, { out: "mat" })],
  };
  for (const [ko, k] of CLS) { const id = { van: "vanguard", grd: "guard", def: "defender", snp: "sniper", cst: "caster", med: "medic", sup: "supporter", spc: "specialist" }[k]; BASE_SKILLS[id] = [S_("기본 근무", "prod", 0.1, { out: "all" })]; }
  // what the operation panel shows before you go: [item, amount text, tag]
  function supplyPreview(site, tier) {
    if (site === "CN") return [];
    if (site === "BM") { const [[a, pa], [b, pb]] = BM_DROP[tier - 1], rng = (n, p) => (p ? `${n}~${n + 1}` : `${n}`); return [(b || pb) && ["bm2", b ? rng(b, pb) : "0~1", b ? "" : "확률"], ["bm1", rng(a, pa), ""]].filter(Boolean); }
    return SUPPLY[site].cls.map((c) => [(tier === 1 ? "chip_" : "pack_") + clsKey(c), tier === 1 ? "1~2" : "1", "확률"]);
  }
  const supplyKeys = (site, tier) => site === "CN" ? [] : site === "BM" ? (BM_DROP[tier - 1][1][0] || BM_DROP[tier - 1][1][1] ? ["bm2", "bm1"] : ["bm1"]) : SUPPLY[site].cls.map((c) => (tier === 1 ? "chip_" : "pack_") + clsKey(c)).concat(tier === 2 ? SUPPLY[site].cls.map((c) => "chip_" + clsKey(c)) : []);
  return { supplyPreview, supplyKeys, SIX_REC, BASE_SKILLS, CLS, clsKey, MATS, ITEMS, REFINE, expNeed, coinPerExp, matsOf, promoCost, skillCost, masteryCost, MS_HOURS, DROPS, SUPPLY, OPEN, SUPPLY_META, supplyDrops, ZONES, BASE };
})();
