/* 國道路況：轉接與終點顯示 mockup 共用資料與外框
 * 路網與轉接（link2s）取自 origin/jack 的 assets/data/freeways_all.enc；
 * 車速、CCTV、CMS、事件為示意值；「往 XX」地名為示意。 */
'use strict';

const ASSET = 'assets/freeway/';

const ROADS = {
  '100610': { name: '台61', short: '台61' },
  '100640': { name: '台64', short: '台64' },
  '100660': { name: '台66', short: '台66' },
  '100620': { name: '台62', short: '台62' },
  '000030': { name: '國道3號', short: '國3' },
  '000010': { name: '國道1號', short: '國1' },
  '000050': { name: '國道5號', short: '國5' },
  '000031': { name: '國道3甲', short: '國3甲' },
};

const DIR_LABEL = { N: '北上', S: '南下', E: '東向', W: '西向' };

// 控制地名（示意）：實作可用目標道路該方向的終點，或另建一張對照表
const TOWARD = {
  '100640|E': '新店', '100640|W': '八里',
  '100610|N': '淡水', '100610|S': '林口',
  '100660|E': '大溪', '100620|E': '瑞濱',
  '000030|N': '基隆', '000030|S': '土城',
  '000010|N': '基隆', '000010|S': '台北',
  '000050|S': '宜蘭',
  '000031|E': '深坑', '000031|W': '台北',
};

// 用路段座標算出的方位：卡片由上往下＝里程增加時，目的道路在左邊（L）還是右邊（R）。
// 全路網 261 筆轉接中 234 筆可判定左右，27 筆兩路平行（沒有值時預設右邊）。
const GEO = {
  t61: { '八里二': { '100640|E': 'R' }, '觀音': { '100660|E': 'R' } },
  t64: { '八里二': { '100610|N': 'R', '100610|S': 'L' }, '中和': { '000030|N': 'R', '000030|S': 'L' } },
  n3: {
    '瑪東系統': { '100620|E': 'R' },
    '汐止系統': { '000010|N': 'R', '000010|S': 'L' },
    '南港系統': { '000050|S': 'R' },
    '木柵': { '000031|E': 'R', '000031|W': 'L' },
  },
};

// 轉入目的方向後，還剩幾公里就到該方向終點（目標 section 起點里程到該方向最後一段終點里程）。
// 剩不到 STUB_KM 的轉接畫成「出口 往 XX」，不寫路線和方向（例如國3甲東向從木柵只剩 0.6 km 就到深坑端）。
const STUB_KM = 2;
const REMAIN_KM = {
  t61: { '八里二': { '100640|E': 28.4 }, '觀音': { '100660|E': 26.7 } },
  t64: { '八里二': { '100610|N': 4, '100610|S': 301.2 }, '中和': { '000030|N': 35.8, '000030|S': 395.8 } },
  n3: {
    '瑪東系統': { '100620|E': 16.2 },
    '汐止系統': { '000010|N': 12.3, '000010|S': 362.7 },
    '南港系統': { '000050|S': 54.7 },
    '木柵': { '000031|E': 0.6, '000031|W': 5.2 },
  },
};

// dirA＝里程增加的方向（往下走），dirB＝里程減少的方向（往上走）；
// endA＝最後一個節點是不是 dirA 真正的終點（情境只截了一段時為 false）
const SCENARIOS = {
  t64: {
    key: 't64', label: '台64 八里段', sub: '西向走到八里二就到底，左接 61 南下、右接 61 北上', road: '100640',
    dirA: 'E', dirB: 'W', dirCaption: { E: '往新店', W: '往八里' },
    nodes: [
      { name: '八里二', km: 0, tr: { W: [['100610', 'N'], ['100610', 'S']] } },
      { name: '八里', km: 1 },
      { name: '觀音山', km: 6 },
      { name: '五股一', km: 10 },
      { name: '五股二', km: 11 },
      { name: '三重', km: 14 },
      { name: '江子翠', km: 17 },
      { name: '板橋', km: 20 },
      { name: '中和一', km: 23 },
      { name: '中和', km: 24, tr: { E: [['000030', 'N'], ['000030', 'S']], W: [['000030', 'N'], ['000030', 'S']] } },
      { name: '中和二', km: 26 },
      { name: '新店端', km: 28 },
    ],
    segs: [
      { E: 75, W: 66 }, { E: 74, W: 74 }, { E: 70, W: 72 }, { E: 58, W: 77 }, { E: 45, W: 80 }, { E: 36, W: 62 },
      { E: 52, W: 66 }, { E: 61, W: 70 }, { E: 64, W: 72 }, { E: 70, W: 68 }, { E: 73, W: 75 },
    ],
    devices: [
      { lane: 'W', km: 3.2, type: 'cctv' },
      { lane: 'E', km: 12.2, type: 'cms', text: '三重 車多 慢行' },
      { lane: 'E', km: 15.5, type: 'ev', title: '事故', text: '內側車道' },
    ],
    drive: { dir: 'W', km: 2.4 }, limit: 80, speedNow: 72, endA: true,
  },
  t61: {
    key: 't61', label: '台61 八里段', sub: '北上走到淡水端是終點；八里二中途可接 64 東向', road: '100610',
    dirA: 'S', dirB: 'N', dirCaption: { S: '往林口', N: '往淡水' },
    nodes: [
      { name: '淡水端', km: 0 },
      { name: '八里一', km: 2 },
      { name: '八里二', km: 4, tr: { S: [['100640', 'E']], N: [['100640', 'E']] } },
      { name: '八里三', km: 6 },
      { name: '林口', km: 14 },
      { name: '蘆竹', km: 19 },
      { name: '竹圍', km: 22 },
      { name: '沙崙', km: 24 },
      { name: '大園', km: 29 },
      { name: '草漯', km: 33 },
      { name: '桃科', km: 38 },
      { name: '觀音', km: 42, tr: { S: [['100660', 'E']], N: [['100660', 'E']] } },
      { name: '永安', km: 47 },
    ],
    segs: [
      { S: 82, N: 79 }, { S: 86, N: 88 }, { S: 84, N: 92 }, { S: 88, N: 71 }, { S: 90, N: 55 }, { S: 87, N: 38 },
      { S: 85, N: 64 }, { S: 91, N: 83 }, { S: 89, N: 86 }, { S: 92, N: 88 }, { S: 87, N: 90 }, { S: 90, N: 89 },
    ],
    devices: [
      { lane: 'S', km: 3.1, type: 'cctv' },
      { lane: 'N', km: 5.2, type: 'cms', text: '往淡水 車多' },
      { lane: 'S', km: 16.0, type: 'cctv' },
      { lane: 'N', km: 20.5, type: 'ev', title: '事故', text: '外側車道' },
    ],
    drive: { dir: 'S', km: 2.9 }, limit: 90, speedNow: 84, endA: false,
  },
  n3: {
    key: 'n3', label: '國3 汐止段', sub: '汐止系統：南下、北上能轉的不一樣', road: '000030',
    dirA: 'S', dirB: 'N', dirCaption: { S: '往新店', N: '往基隆' },
    nodes: [
      { name: '基金', km: 0 },
      { name: '瑪東系統', km: 2, tr: { S: [['100620', 'E']], N: [['100620', 'E']] } },
      { name: '汐止系統', km: 10, tr: { S: [['000010', 'S']], N: [['000010', 'N'], ['000010', 'S']] } },
      { name: '新台五路', km: 12 },
      { name: '南港', km: 14 },
      { name: '南港系統', km: 16, tr: { S: [['000050', 'S']], N: [['000050', 'S']] } },
      { name: '南深路', km: 16 },
      { name: '木柵', km: 20, tr: { S: [['000031', 'E'], ['000031', 'W']], N: [['000031', 'E'], ['000031', 'W']] } },
      { name: '木柵休息站', km: 25, type: 'rest' },
      { name: '新店', km: 26 },
    ],
    segs: [
      { S: 78, N: 81 }, { S: 83, N: 76 }, { S: 62, N: 48 }, { S: 55, N: 35 }, { S: 67, N: 44 },
      { S: 72, N: 60 }, { S: 80, N: 74 }, { S: 86, N: 82 }, { S: 88, N: 85 },
    ],
    devices: [
      { lane: 'S', km: 11.0, type: 'cms', text: '汐止系統 車多' },
      { lane: 'N', km: 10.9, type: 'cctv' },
      { lane: 'N', km: 13.2, type: 'ev', title: '車多', text: '回堵至南港' },
    ],
    drive: { dir: 'N', km: 13.6 }, limit: 90, speedNow: 36, endA: false,
  },
};

/* ===== 小工具 ===== */
const LV_COLOR = ['#7F8C8D', '#1F8A54', '#C9A408', '#CF6515', '#D2342A'];
const LV_TEXT = ['無資料', '順暢', '車多', '壅塞', '嚴重'];
function lvl(v) {
  if (v == null) return 0;
  if (v >= 60) return 1;
  if (v >= 50) return 2;
  if (v >= 40) return 3;
  return 4;
}
function dirLabel(d) { return DIR_LABEL[d] || d; }
function towardOf(road, dir) { return TOWARD[road + '|' + dir] || ''; }
function shield(road, size = 24) {
  return `<img class="shield" src="${ASSET}${road}.png" width="${size}" height="${size}" alt="${ROADS[road] ? ROADS[road].name : road}">`;
}

/* ===== 轉接 ===== */
function trAt(sc, i, lane) {
  const tr = sc.nodes[i].tr;
  return (tr && tr[lane]) || [];
}
// 會「抵達」這個交流道的車道（第一個節點只有 dirB 抵達，最後一個只有 dirA）
function lanesArriving(sc, i) {
  const res = [];
  if (i > 0) res.push(sc.dirA);
  if (i < sc.nodes.length - 1) res.push(sc.dirB);
  return res;
}
// 依「目的道路＋方向」分組，記錄哪些車道可以轉（不再只依道路去重）
function destGroups(sc, i) {
  const map = new Map();
  for (const lane of [sc.dirA, sc.dirB]) {
    for (const [road, dir] of trAt(sc, i, lane)) {
      const k = road + '|' + dir;
      if (!map.has(k)) map.set(k, { road, dir, lanes: [] });
      map.get(k).lanes.push(lane);
    }
  }
  return [...map.values()];
}
function geoSide(sc, i, road, dir) {
  const g = GEO[sc.key] && GEO[sc.key][sc.nodes[i].name];
  return (g && g[road + '|' + dir]) || 'R';
}
function isStub(sc, i, road, dir) {
  const r = REMAIN_KM[sc.key] && REMAIN_KM[sc.key][sc.nodes[i].name];
  const km = r ? r[road + '|' + dir] : undefined;
  return km != null && km <= STUB_KM;
}

/* ===== 行車狀態 ===== */
function travelOrder(sc, dir) {
  const idx = sc.nodes.map((_, i) => i);
  return dir === sc.dirA ? idx : idx.reverse();
}
// 回傳目前位置後方一個節點＋前方 ahead 個節點的距離、時間
function driveInfo(sc, dir, km, ahead = 3) {
  const order = travelOrder(sc, dir);
  const down = dir === sc.dirA;
  const passed = order.filter(i => (down ? sc.nodes[i].km <= km : sc.nodes[i].km >= km));
  const next = order.filter(i => (down ? sc.nodes[i].km > km : sc.nodes[i].km < km)).slice(0, ahead);
  const startIdx = passed[passed.length - 1];
  let prevKm = km, prevIdx = startIdx, dist = 0, minutes = 0;
  const list = next.map(i => {
    const v = sc.segs[Math.min(prevIdx, i)][dir];
    const d = Math.abs(sc.nodes[i].km - prevKm);
    dist += d;
    minutes += (d / Math.max(v, 5)) * 60;
    prevKm = sc.nodes[i].km;
    prevIdx = i;
    return { i, node: sc.nodes[i], dist, min: Math.max(1, Math.round(minutes)) };
  });
  const times = new Map(list.map(a => [a.i, a]));
  return { startIdx, ahead: list, times, curSeg: Math.min(startIdx, next[0]) };
}

/* ===== 圖示 ===== */
const ICON = {
  back: '<svg viewBox="0 0 24 24"><path d="M20 12H5M11 5l-7 7 7 7" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.4.7-1.2 2.2-2.4 4.3-2.4 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z" fill="#fff"/></svg>',
  list: '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="2" stroke="#fff" stroke-width="1.8" fill="none"/><path d="M7 8h2M11 8h6M7 12h2M11 12h6M7 16h2M11 16h6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
  filter: '<svg viewBox="0 0 24 24"><path d="M4 7h16M7 12h10M10 17h4" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>',
  car: '<svg viewBox="0 0 24 24"><path d="M5 16v3M19 16v3M3.5 16h17v-4l-2-5.5H5.5L3.5 12z" stroke="#fff" stroke-width="1.8" fill="none" stroke-linejoin="round"/><circle cx="7.5" cy="13" r="1.3" fill="#fff"/><circle cx="16.5" cy="13" r="1.3" fill="#fff"/></svg>',
  cam: '<svg viewBox="0 0 24 24"><rect x="2.5" y="7" width="13" height="10" rx="2" stroke="#fff" stroke-width="1.8" fill="none"/><path d="M15.5 10.5l6-3v9l-6-3z" stroke="#fff" stroke-width="1.8" fill="none" stroke-linejoin="round"/></svg>',
  speedcam: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="12" rx="2.5" fill="#fff"/><circle cx="12" cy="13" r="3.6" fill="#D2342A"/><rect x="8" y="4" width="8" height="3" rx="1" fill="#fff"/></svg>',
};

/* ===== 外框 ===== */
function statusBar() {
  return '<div class="sb"><span>7:15</span><span class="r">LTE⁺ ▂▄▆ <span class="bat">100</span></span></div>';
}
function mainScreen(sc, o) {
  const small = o.mode === 'small';
  const speed = `<div class="ms-speed ${small ? 'sm' : ''}"><div class="limit">${sc.limit}</div><div><div class="speed-num">${sc.speedNow}</div><div class="speed-unit">km/h</div></div></div>`;
  const ev = `<div class="evcard"><div class="ico">${ICON.speedcam}</div><div class="t1">測速照相</div><div class="t2">450 m</div><div class="t3">限速 ${sc.limit}</div></div>`;
  const body = small ? `${speed}${o.small}${ev}` : `${speed}<div class="panel ms-big">${o.panel}</div>`;
  return `<div class="screen dk">${statusBar()}<div class="ms">${body}</div><div class="ms-bottom">${ICON.menu}${ICON.car}</div></div>`;
}
function devicesIn(sc, k, lane) {
  const a = sc.nodes[k].km, b = sc.nodes[k + 1].km;
  return sc.devices.filter(d => d.lane === lane && d.km >= Math.min(a, b) && d.km < Math.max(a, b));
}

/* ===== 主畫面小條（有事件時） ===== */
function renderSmallBar(sc, o) {
  const { dir, km, info } = o;
  const first = info.ahead[0];
  const v = sc.segs[info.curSeg][dir];
  const c = LV_COLOR[lvl(v)];
  return `<div class="smallbar" style="border:1px solid ${c}">
    <div class="rd">${shield(sc.road, 30)}<span>${dirLabel(dir)}</span></div>
    <div class="mid"><div class="now">目前<b>${km.toFixed(1)}K</b></div>
      <div class="nx"><span>${first.node.name}・${first.dist.toFixed(1)}km・${first.min}分</span></div>
      ${o.chips ? `<div class="trrow">${o.chips}</div>` : ''}</div>
    <div class="rt"><span class="lvpill" style="background:${c}">${LV_TEXT[lvl(v)]}</span><span class="spd">${v} km/h</span></div>
  </div>`;
}

/* ===== 頁面骨架：情境切換＋手機 ===== */
function buildPage(cfg) {
  const scn = document.getElementById('scn');
  const stage = document.getElementById('stage');
  const state = { key: Object.keys(SCENARIOS)[0] };
  if (new URLSearchParams(location.search).has('full')) document.body.classList.add('full'); // 檢查用：整條列表展開
  const hashKey = location.hash.slice(1); // 網址 #t61、#n3 可直接開指定情境
  if (SCENARIOS[hashKey]) state.key = hashKey;
  scn.innerHTML = Object.values(SCENARIOS).map(s => `<button data-k="${s.key}">${s.label}<small>${s.sub}</small></button>`).join('');
  scn.addEventListener('click', e => {
    const b = e.target.closest('button[data-k]');
    if (!b) return;
    state.key = b.dataset.k;
    history.replaceState(null, '', '#' + state.key);
    draw();
  });
  function draw() {
    const sc = SCENARIOS[state.key];
    scn.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === state.key));
    stage.innerHTML = cfg.render(sc).map(f => `<figure class="fig"><div class="phone">${f.html}</div><figcaption>${f.cap}</figcaption></figure>`).join('');
  }
  draw();
}
