/* 國道路況：橫向車道卡片（依團隊提案的外觀）
 * - 卡片由上往下＝沿著這條路直行（里程增加往下）：北上／西向往上走，南下／東向往下走；
 *   直行的路畫成速度框後面一條垂直的路。
 * - 卡片左右兩側＝可以接去的其他道路：左邊＝往左接、右邊＝往右接（依路段座標算出的實際方位）；
 *   只有真的能接的那一側才延伸出橫向車道，沒得接就不畫。
 * - 路走到底畫在「前方」：往上走的方向畫在最上面那張卡的上緣，往下走的畫在最後一張卡的下緣；
 *   能轉的方向寫在終點線的兩端，只能轉一邊就只畫一邊。
 * - 沒得轉的卡片兩側不畫東西；只用水平、垂直的線。 */
'use strict';

const HICON = {
  road: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M12 6v3M12 11v3M12 16v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="4.5" cy="6" r="1.3" fill="currentColor"/><circle cx="4.5" cy="12" r="1.3" fill="currentColor"/><circle cx="4.5" cy="18" r="1.3" fill="currentColor"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/></svg>',
  rest: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.7" fill="none"/><rect x="14" y="4" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.7" fill="none"/><rect x="3" y="14" width="18" height="6" rx="1" stroke="currentColor" stroke-width="1.7" fill="none"/></svg>',
};

function hLiveScreen(sc, body) {
  return `<div class="screen dk">
    ${statusBar()}
    <div class="appbar2">${ICON.back}<span class="t">國道/快速道路路況</span>${ICON.heart}</div>
    <div class="tabs2"><span class="on">${HICON.road}路段</span><span>${HICON.list}事件</span><span>${HICON.map}地圖</span><span>${HICON.rest}服務區</span></div>
    <div class="roadbar2">${shield(sc.road, 38)}<span class="n">${ROADS[sc.road].name}</span>${ICON.list}</div>
    <div class="content">${body}</div>
    <div class="fab2">${ICON.filter}</div>
  </div>`;
}

function hGeom(W, compact) {
  const k = compact ? 0.76 : 1;
  const r = v => Math.round(v * k);
  return {
    W, compact,
    roadH: r(92), bandH: r(62), boxW: r(48), boxH: r(76), gap: r(13),
    side: r(58), slotH: r(78), endH: r(44),
  };
}
function hSign(road, dir, size = 'l') {
  const sz = { l: 20, m: 18, s: 15 }[size];
  const tw = size === 'l' ? `<small>往${towardOf(road, dir)}</small>` : '';
  return `<span class="gsign ${size}">${shield(road, sz)}<span>${dirLabel(dir)}</span>${tw}</span>`;
}
function hArrow(toLeft, w, h = 10) {
  const m = h / 2;
  const d = toLeft ? `M ${w - 1} ${m} H 3 M 8 ${m - 4} L 2 ${m} L 8 ${m + 4}` : `M 1 ${m} H ${w - 3} M ${w - 8} ${m - 4} L ${w - 2} ${m} L ${w - 8} ${m + 4}`;
  return `<svg class="harr" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${d}" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/* ===== 轉向資料 ===== */
// 這個方向在這個交流道是不是走到底：往上走的在第一個交流道、往下走的在最後一個（要是真的終點）
function hIsEnd(sc, i, lane) {
  return lane === sc.dirB ? i === 0 : i === sc.nodes.length - 1 && sc.endA;
}
// 交流道 i 可以接去的道路，依方位分左右；focus 時只算那個方向
function hTurns(sc, i, focus) {
  const arriving = lanesArriving(sc, i);
  const out = { L: [], R: [] };
  for (const g of destGroups(sc, i)) {
    if (focus && !g.lanes.includes(focus)) continue;
    const only = !focus && arriving.some(l => !g.lanes.includes(l)) ? g.lanes : null; // 不是每個方向都能轉時註明
    out[geoSide(sc, i, g.road, g.dir)].push({ ...g, only });
  }
  return out;
}

/* ===== 元件 ===== */
// 兩側：往左接／往右接
function hSlot(sc, G, side, items, H) {
  const left = side === 'L';
  const body = items.map(t => `<div class="hc-turn">
      ${shield(t.road, G.compact ? 18 : 22)}<b>${dirLabel(t.dir)}</b>${G.compact ? '' : `<small>往${towardOf(t.road, t.dir)}</small>`}
      ${hArrow(left, G.compact ? 24 : 32)}${t.only ? `<em>僅${t.only.map(dirLabel).join('、')}</em>` : ''}</div>`).join('');
  return `<div class="hc-slot" style="${left ? 'left' : 'right'}:0;width:${G.side}px;height:${H}px">${body}</div>`;
}
// 前方的終點線：能轉的寫在兩端，箭頭朝外；接不到別條路就只寫終點
function hEndBar(sc, G, lane, turns, pos) {
  const W = G.W, H = G.endH, y = H / 2, cx = W / 2;
  const hasL = turns.L.length > 0, hasR = turns.R.length > 0;
  const size = G.compact ? 'm' : 'l';
  let svg, label;
  if (hasL || hasR) {
    const x0 = hasL ? 4 : cx - 34, x1 = hasR ? W - 4 : cx + 34;
    svg = `<path d="M ${x0} ${y} H ${x1}" stroke="#fff" stroke-width="3"/>`;
    svg += hasL ? `<path d="M ${x0 + 9} ${y - 6} L ${x0} ${y} L ${x0 + 9} ${y + 6}" stroke="#fff" stroke-width="3" fill="none" stroke-linejoin="round" stroke-linecap="round"/>` : `<path d="M ${x0} ${y - 8} V ${y + 8}" stroke="#fff" stroke-width="3"/>`;
    svg += hasR ? `<path d="M ${x1 - 9} ${y - 6} L ${x1} ${y} L ${x1 - 9} ${y + 6}" stroke="#fff" stroke-width="3" fill="none" stroke-linejoin="round" stroke-linecap="round"/>` : `<path d="M ${x1} ${y - 8} V ${y + 8}" stroke="#fff" stroke-width="3"/>`;
    label = `${dirLabel(lane)}到底`;
  } else {
    svg = `<path d="M ${cx - 70} ${y} H ${cx + 70} M ${cx - 70} ${y - 8} V ${y + 8} M ${cx + 70} ${y - 8} V ${y + 8}" stroke="#fff" stroke-width="3.5"/>`;
    label = `${dirLabel(lane)}終點`;
  }
  const signs = arr => arr.map(t => hSign(t.road, t.dir, size)).join('');
  return `<div class="hc-end ${pos}" style="height:${H}px"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svg}</svg>
    ${hasL ? `<div class="hc-end-l">${signs(turns.L)}</div>` : ''}<div class="hc-end-c">${label}</div>${hasR ? `<div class="hc-end-r">${signs(turns.R)}</div>` : ''}</div>`;
}

function hCard(sc, i, o) {
  const G = o.G, W = G.W, cx = W / 2, nd = sc.nodes[i];
  const laneUp = sc.dirB, laneDown = sc.dirA; // 左半邊、右半邊
  const focus = o.focus || null;
  const hx = o.header ? o.header(i) : '';
  const head = `<div class="hc-h"><span class="hc-n">${nd.name}</span><span class="hc-km">${nd.km} km</span>${nd.type === 'rest' ? '<span class="hc-rest">休息站</span>' : ''}<span class="hc-hx">${hx}</span></div>`;
  const cls = `hc${G.compact ? ' compact' : ''}`;
  const dim = lane => !!(focus && focus !== lane);
  const op = lane => (dim(lane) ? 0.28 : 1);

  // 走到底的方向：轉向畫在前方的終點線上，不放兩側
  const endLanes = lanesArriving(sc, i).filter(l => hIsEnd(sc, i, l) && !dim(l));
  const turns = hTurns(sc, i, focus);
  const topEnd = endLanes.includes(laneUp) ? hEndBar(sc, G, laneUp, turns, 'top') : '';
  const bottomEnd = endLanes.includes(laneDown) ? hEndBar(sc, G, laneDown, turns, 'bottom') : '';
  const sideTurns = endLanes.length ? { L: [], R: [] } : turns;
  const dev = o.devices ? hDevRow(sc, i) : '';
  if (i >= sc.nodes.length - 1) return `<div class="${cls} last">${head}${bottomEnd}</div>`;

  const nL = sideTurns.L.length, nR = sideTurns.R.length;
  const H = Math.max(G.roadH, Math.max(nL, nR) * G.slotH);
  const bt = (H - G.bandH) / 2, bb = bt + G.bandH, mid = H / 2;
  const L0 = G.side, R0 = W - G.side;
  const boxL = cx - G.gap - G.boxW, boxR = cx + G.gap;

  // 直行的路：速度框後面一條垂直的路，中央雙黃線
  const pad = G.compact ? 7 : 10;
  const vx0 = boxL - pad, vx1 = boxR + G.boxW + pad;
  let svg = `<rect x="${vx0}" y="0" width="${cx - vx0}" height="${H}" fill="#4d5055" opacity="${op(laneUp)}"/>` +
    `<rect x="${cx}" y="0" width="${vx1 - cx}" height="${H}" fill="#4d5055" opacity="${op(laneDown)}"/>`;
  // 往左、往右接其他道路：只有真的能接的那一側才延伸出橫向車道，路邊線在接口斷開
  const q = G.bandH / 4;
  const edge = (x, open) => (open ? `M ${x} 0 V ${bt} M ${x} ${bb} V ${H}` : `M ${x} 0 V ${H}`);
  svg += `<path d="${edge(vx0, nL)} ${edge(vx1, nR)}" stroke="#b8bbc0" stroke-width="2.2"/>`;
  const ext = (x0, x1) => `<rect x="${x0}" y="${bt}" width="${x1 - x0}" height="${G.bandH}" fill="#4d5055"/>` +
    `<path d="M ${x0} ${bt + 1} H ${x1} M ${x0} ${bt + 2 * q} H ${x1} M ${x0} ${bb - 1} H ${x1}" stroke="#b8bbc0" stroke-width="2.2"/>` +
    `<path d="M ${x0} ${bt + q} H ${x1} M ${x0} ${bt + 3 * q} H ${x1}" stroke="#e6e7e9" stroke-width="1.8" stroke-dasharray="${G.compact ? '7 6' : '10 8'}"/>`;
  if (nL) svg += ext(L0, vx0);
  if (nR) svg += ext(vx1, R0);
  svg += `<path d="M ${cx - 3} 0 V ${H} M ${cx + 3} 0 V ${H}" stroke="#E5B300" stroke-width="2.6"/>`;

  // 速度框：▲往上走、▼往下走
  const box = (lane, x, mark) => {
    const v = sc.segs[i][lane];
    return `<div class="hc-box" style="left:${x}px;top:${mid - G.boxH / 2}px;width:${G.boxW}px;height:${G.boxH}px;background:${LV_COLOR[lvl(v)]};opacity:${op(lane)}"><span>${dirLabel(lane)}<i>${mark}</i></span><b>${v}</b><small>km/h</small></div>`;
  };
  let html = box(laneUp, boxL, '▲') + box(laneDown, boxR, '▼');
  if (nL) html += hSlot(sc, G, 'L', sideTurns.L, H);
  if (nR) html += hSlot(sc, G, 'R', sideTurns.R, H);

  if (o.you) {
    const a = sc.nodes[i].km, b = sc.nodes[i + 1].km;
    if (o.you.km >= Math.min(a, b) && o.you.km <= Math.max(a, b)) {
      const up = o.you.dir === laneUp; // 標在該方向那一側的路外面
      const pos = up ? `left:${vx0 - 4}px;transform:translate(-100%,-50%)` : `left:${vx1 + 4}px;transform:translate(0,-50%)`;
      html += `<div class="hc-you" style="${pos};top:${mid}px">${up ? '▲' : '▼'} 目前 ${o.you.km.toFixed(1)}K</div>`;
    }
  }
  return `<div class="${cls}">${head}${topEnd}<div class="hc-road" style="height:${H}px"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svg}</svg>${html}</div>${dev}</div>`;
}

function hDevRow(sc, i) {
  if (i >= sc.nodes.length - 1) return '';
  const items = [sc.dirB, sc.dirA].flatMap(l => devicesIn(sc, i, l).map(d => {
    if (d.type === 'cctv') return `<span>${ICON.cam}CCTV ${d.km}K・${dirLabel(l)}</span>`;
    if (d.type === 'cms') return `<span class="cms">CMS ${d.text}・${dirLabel(l)}</span>`;
    return `<span class="ev">${d.title} ${d.text}・${dirLabel(l)}</span>`;
  }));
  return items.length ? `<div class="hc-dev">${items.join('')}</div>` : '';
}

function renderHCards(sc, o) {
  const from = o.from ?? 0, to = o.to ?? sc.nodes.length - 1;
  const cards = [];
  for (let i = from; i <= to; i++) cards.push(hCard(sc, i, o));
  const note = o.note === false ? '' : '<div class="hc-note">註：速度為即時平均速率，單位 km/h</div>';
  return `<div class="hcl">${cards.join('')}${note}</div>`;
}

// 主畫面：同一種卡片縮小，顯示目前位置附近，只看目前方向（對向變淡）
function hMainPanel(sc) {
  const d = sc.drive;
  const info = driveInfo(sc, d.dir, d.km, 3);
  const idx = [info.curSeg, ...info.ahead.slice(0, 2).map(a => a.i)];
  const from = Math.min(...idx), to = Math.min(sc.nodes.length - 2, Math.max(Math.max(...idx), from + 2));
  const cards = renderHCards(sc, {
    G: hGeom(324, true), from, to, focus: d.dir, you: d, note: false,
    header: i => { const t = info.times.get(i); return t ? `<span class="hc-t">${t.dist.toFixed(1)}km・${t.min}分</span>` : ''; },
  });
  return `<div class="hmini"><div class="hm-head">${shield(sc.road, 20)}${ROADS[sc.road].name} ${dirLabel(d.dir)}（${sc.dirCaption[d.dir]}）</div>${cards}</div>`;
}

// 小條：前方第一個可以轉的交流道
function hSmallChips(sc, info) {
  const lane = sc.drive.dir;
  const a = info.ahead.find(x => trAt(sc, x.i, lane).length);
  if (!a) return '';
  const t = hTurns(sc, a.i, lane);
  const chip = (arr, left) => arr.map(g => `<span class="sside">${left ? '←' : ''}${hSign(g.road, g.dir, 's')}${left ? '' : '→'}</span>`).join('');
  return `<span class="cap">${a.node.name}${hIsEnd(sc, a.i, lane) ? '到底' : ''}</span>${chip(t.L, true)}${chip(t.R, false)}`;
}
