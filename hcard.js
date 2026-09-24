/* 國道路況：一條連續的直行路（路面、速度框、雙黃線沿用團隊的橫向車道設計）
 * - 由上往下＝沿著這條路直行（里程增加往下）：北上／西向往上走，南下／東向往下走。
 * - 交流道是路上的站：出口編號牌（黃底黑字「10 汐止系統」）壓在路中間；車速夾在兩站之間，是那一段的車速。
 *   每一列都畫同一條路，整條路從頭到尾不斷開；整串包在一個區塊裡，區塊裡不再分隔。
 * - 左右兩側＝可以接去的其他道路：左邊＝往左接、右邊＝往右接（依路段座標算出的實際方位）；
 *   只有真的能接的那一側才延伸出橫向車道，站名放在路口正中央；沒得接就不畫。
 * - 路走到底畫在「前方」：往上走的畫在第一站上方，往下走的畫在最後一站下方；
 *   能轉的方向寫在終點線的兩端，只能轉一邊就只畫一邊。
 * - 只用水平、垂直的線（箭頭頭部除外）。 */
'use strict';

const HICON = {
  road: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M12 6v3M12 11v3M12 16v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="4.5" cy="6" r="1.3" fill="currentColor"/><circle cx="4.5" cy="12" r="1.3" fill="currentColor"/><circle cx="4.5" cy="18" r="1.3" fill="currentColor"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/></svg>',
  cms: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="11" rx="1.5" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M7 8.5h10M7 11.5h6M12 15v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  rest: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.7" fill="none"/><rect x="14" y="4" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.7" fill="none"/><rect x="3" y="14" width="18" height="6" rx="1" stroke="currentColor" stroke-width="1.7" fill="none"/></svg>',
};

// 順暢（綠）的速度框用沉一點的綠：大部分路段都是順暢，塗滿亮綠只會變成一片噪音
const CALM_GREEN = '#2B6B4D';

function hLiveScreen(sc, body) {
  return `<div class="screen dk">
    ${statusBar()}
    <div class="appbar2">${ICON.back}<span class="t">國道/快速道路路況</span>${ICON.heart}</div>
    <div class="tabs2"><span class="on">${HICON.road}路段</span><span>${HICON.list}事件</span><span>${HICON.map}地圖</span><span>${HICON.rest}服務區</span></div>
    <div class="roadbar2"><span class="n">${shield(sc.road, 40)}</span>${ICON.list}</div>
    <div class="content">${body}</div>
    <div class="fab2">${ICON.filter}</div>
  </div>`;
}

function hGeom(W, compact) {
  const k = compact ? 0.76 : 1;
  const r = v => Math.round(v * k);
  return {
    W, compact,
    // 主畫面（compact）的路段列與站名列壓扁一點，3 個交流道含轉向列才放得進大 panel
    roadH: compact ? r(54) + 8 : 84, bandH: r(50), boxW: r(42), boxH: r(54), gap: r(13),
    side: r(58), slotH: r(66), endH: r(44), labelH: compact ? 36 : 38,
    stubW: r(16), stubH: r(18),
  };
}
// 綠底路牌（兩側、終點線、小條共用同一種，只差尺寸與排列）：盾牌＋目標方向
// l＝橫排、m＝橫排小、v＝直排（兩側欄）、s＝小條。往 XX 只放在點開的細節裡（toward）
// t.stub（轉入後馬上到底）：一律寫「出口 往 XX」，不寫路線和方向
function hSign(t, size = 'l', compact = false, toward = false) {
  const tw = `<small>往${towardOf(t.road, t.dir)}</small>`;
  if (t.stub) return `<span class="gsign ${size} exit"><span>出口</span>${tw}</span>`;
  const sz = { l: 18, m: 16, v: compact ? 15 : 18, s: 15 }[size];
  return `<span class="gsign ${size}">${shield(t.road, sz)}<span>${dirLabel(t.dir)}</span>${toward ? tw : ''}</span>`;
}
// 哪些行駛方向能用這個轉接：兩格固定都顯示（順序同速度框：左＝往上走、右＝往下走），不能用的變暗
function hLaneChips(sc, t) {
  return `<span class="hc-lanes">${[sc.dirB, sc.dirA].map(l => `<i class="${t.lanes.includes(l) ? 'on' : ''}">${dirLabel(l)[0]}</i>`).join('')}</span>`;
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
    out[geoSide(sc, i, g.road, g.dir)].push({ ...g, only, stub: isStub(sc, i, g.road, g.dir) });
  }
  return out;
}

/* ===== 元件 ===== */
// 兩側：往左接／往右接。橫向車道已經表示往哪一側，路牌下不再畫箭頭。
// detail（路況頁點開的細節）：多寫往 XX，並用方向方塊標出哪些行駛方向能用；主畫面只看目前方向，不需要
function hSlot(sc, G, side, items, H, detail) {
  const left = side === 'L';
  const body = items.map(t => `<div class="hc-turn">${hSign(t, 'v', G.compact, detail)}${detail ? hLaneChips(sc, t) : ''}</div>`).join('');
  return `<div class="hc-slot" style="${left ? 'left' : 'right'}:0;width:${G.side}px;height:${H}px">${body}</div>`;
}
// 直行的路的左右邊界（速度框外面留一點路肩）
function hRoadX(G) {
  const cx = G.W / 2, pad = G.compact ? 7 : 10;
  return { cx, vx0: cx - G.gap - G.boxW - pad, vx1: cx + G.gap + G.boxW + pad };
}
// 每一列都畫同一條直行的路，上下列接起來就是連續的一條路；y0～y1 以外沒有路（走到底）
// gapL／gapR：那一側有橫向車道接出去，路邊線在接口斷開；extra：畫在雙黃線底下的東西
function hRoadSvg(G, H, o = {}) {
  const { cx, vx0, vx1 } = hRoadX(G);
  const y0 = o.y0 ?? 0, y1 = o.y1 ?? H;
  const edge = (x, gap) => (gap ? `M ${x} ${y0} V ${gap[0]} M ${x} ${gap[1]} V ${y1}` : `M ${x} ${y0} V ${y1}`);
  return `<rect x="${vx0}" y="${y0}" width="${cx - vx0}" height="${y1 - y0}" fill="#4d5055" opacity="${o.opUp ?? 1}"/>` +
    `<rect x="${cx}" y="${y0}" width="${vx1 - cx}" height="${y1 - y0}" fill="#4d5055" opacity="${o.opDown ?? 1}"/>` +
    `<path d="${edge(vx0, o.gapL)} ${edge(vx1, o.gapR)}" stroke="#b8bbc0" stroke-width="2.2"/>` +
    (o.extra || '') +
    `<path d="M ${cx - 3} ${y0} V ${y1} M ${cx + 3} ${y0} V ${y1}" stroke="#E5B300" stroke-width="2.6"/>`;
}
function hRow(G, H, svg, html = '') {
  return `<div class="hc-row" style="height:${H}px"><svg width="${G.W}" height="${H}" viewBox="0 0 ${G.W} ${H}">${svg}</svg>${html}</div>`;
}

// 前方的終點線：路接到這條線就停；能轉的寫在兩端，箭頭朝外；接不到別條路就只寫終點
function hEndBar(sc, G, lane, turns, pos, road) {
  const W = G.W, H = G.endH, y = H / 2, cx = W / 2;
  const { vx0, vx1 } = hRoadX(G);
  const hasL = turns.L.length > 0, hasR = turns.R.length > 0;
  const size = G.compact ? 'm' : 'l';
  let svg, label;
  if (hasL || hasR) {
    label = `${dirLabel(lane)}到底`;
    // 只能轉一邊時，封閉端的擋線畫在中間標籤外面、而且至少到路邊，才看得出那一邊不能轉
    const half = (label.length * (G.compact ? 10 : 12) + 12) / 2 + 10;
    const x0 = hasL ? 4 : Math.min(cx - half, vx0), x1 = hasR ? W - 4 : Math.max(cx + half, vx1);
    // 線寬和路邊線一致（2.2），不要比路還搶眼
    svg = `<path d="M ${x0} ${y} H ${x1}" stroke="#fff" stroke-width="2.2"/>`;
    svg += hasL ? `<path d="M ${x0 + 8} ${y - 5} L ${x0} ${y} L ${x0 + 8} ${y + 5}" stroke="#fff" stroke-width="2.2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>` : `<path d="M ${x0} ${y - 7} V ${y + 7}" stroke="#fff" stroke-width="2.2"/>`;
    svg += hasR ? `<path d="M ${x1 - 8} ${y - 5} L ${x1} ${y} L ${x1 - 8} ${y + 5}" stroke="#fff" stroke-width="2.2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>` : `<path d="M ${x1} ${y - 7} V ${y + 7}" stroke="#fff" stroke-width="2.2"/>`;
  } else {
    svg = `<path d="M ${cx - 70} ${y} H ${cx + 70} M ${cx - 70} ${y - 8} V ${y + 8} M ${cx + 70} ${y - 8} V ${y + 8}" stroke="#fff" stroke-width="2.5"/>`;
    label = `${dirLabel(lane)}終點`;
  }
  // 直行的路接到終點線為止（上緣往下、下緣往上），和相鄰的列連成一條
  const stub = pos === 'top' ? hRoadSvg(G, H, { ...road, y0: y }) : hRoadSvg(G, H, { ...road, y1: y });
  const signs = arr => arr.map(t => hSign(t, size)).join('');
  return `<div class="hc-end ${pos}" style="height:${H}px"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${stub}${svg}</svg>
    ${hasL ? `<div class="hc-end-l">${signs(turns.L)}</div>` : ''}<div class="hc-end-c">${label}</div>${hasR ? `<div class="hc-end-r">${signs(turns.R)}</div>` : ''}</div>`;
}

// 聚焦時另一個方向的半邊路面變淡
function hRoadOp(sc, focus) {
  const op = lane => (focus && focus !== lane ? 0.28 : 1);
  return { opUp: op(sc.dirB), opDown: op(sc.dirA) };
}
// 編號牌（含主畫面的距離時間）的半高：路段列要用它算速度框放在兩塊牌子正中間
const hPillHalf = G => (G.compact ? 16 : 13);

// 交流道 i 這一站：（前方的）終點線＋站名列。能接其他道路的站，編號牌直接放在路口正中央，
// 橫向車道從同一個高度往兩側接出去；沒得接的站只有一列細細的站名。
function hStation(sc, i, o) {
  const G = o.G, W = G.W, nd = sc.nodes[i], last = sc.nodes.length - 1;
  const laneUp = sc.dirB, laneDown = sc.dirA;
  const focus = o.focus || null;
  const road = hRoadOp(sc, focus);
  const { vx0, vx1 } = hRoadX(G);
  // 主畫面只標還沒到的交流道；已經開過的不再顯示轉向
  const passed = o.ahead && !o.ahead.has(i);
  // 走到底的方向：轉向畫在前方的終點線上，不放兩側
  const endLanes = passed ? [] : lanesArriving(sc, i).filter(l => hIsEnd(sc, i, l) && !(focus && focus !== l));
  const turns = passed ? { L: [], R: [] } : hTurns(sc, i, focus);
  const topEnd = endLanes.includes(laneUp) ? hEndBar(sc, G, laneUp, turns, 'top', road) : '';
  const bottomEnd = endLanes.includes(laneDown) ? hEndBar(sc, G, laneDown, turns, 'bottom', road) : '';
  const side = endLanes.length ? { L: [], R: [] } : turns;
  const nL = side.L.length, nR = side.R.length;

  // 道路真正的起點／終點（沒畫終點線時）路停在站名中間
  const ys = H => ({ y0: i === 0 && !topEnd ? H / 2 : 0, y1: i === last && sc.endA && !bottomEnd ? H / 2 : H });
  // 站名做成高速公路的出口編號牌：黃底黑字「10 汐止系統」，里程數字在前；休息站藍底白字。
  // 大家看幾 K 判斷距離，數字一定要顯示、而且要醒目。主畫面前方的站，牌子下方多一行「到這裡的距離・時間」
  const hx = o.header ? o.header(i) : '';
  const plate = `<span class="hc-plate${nd.type === 'rest' ? ' rest' : ''}"><em>${nd.km}</em>${nd.name}</span>`;
  let html = `<div class="hc-node">${plate}${hx ? `<small>${hx}</small>` : ''}</div>`;
  // 休息站：站名已經寫了、或是主畫面，就不再加標籤
  if (nd.type === 'rest' && !G.compact && !nR && !nd.name.includes('休息站')) html += '<div class="hc-lx"><span class="hc-rest">休息站</span></div>';

  // 橫向車道：灰底＋兩條路邊線（夠寬才加一條虛線），比主線簡單，不搶眼
  const ramp = (x0, x1, t, h) => `<rect x="${x0}" y="${t}" width="${x1 - x0}" height="${h}" fill="#4d5055"/>` +
    `<path d="M ${x0} ${t + 1} H ${x1} M ${x0} ${t + h - 1} H ${x1}" stroke="#b8bbc0" stroke-width="2"/>` +
    (h > 24 ? `<path d="M ${x0} ${t + h / 2} H ${x1}" stroke="#e6e7e9" stroke-width="1.6" stroke-dasharray="${G.compact ? '6 5' : '8 7'}"/>` : '');
  // 完整的轉向列：橫向車道從路口接到兩側路牌
  const full = (H, detail) => {
    const bt = (H - G.bandH) / 2, bb = bt + G.bandH;
    const extra = (nL ? ramp(G.side, vx0, bt, G.bandH) : '') + (nR ? ramp(vx1, W - G.side, bt, G.bandH) : '');
    const slots = (nL ? hSlot(sc, G, 'L', side.L, H, detail) : '') + (nR ? hSlot(sc, G, 'R', side.R, H, detail) : '');
    return hRow(G, H, hRoadSvg(G, H, { ...road, ...ys(H), gapL: nL ? [bt, bb] : null, gapR: nR ? [bt, bb] : null, extra }), html + slots);
  };
  // 路況頁收合時：路邊接出一小段車道，後面接一個可以點的小記號（只放盾牌；出口寫「出口」），看得出往哪一側能轉
  const mini = H => {
    const t = (H - G.stubH) / 2;
    const extra = (nL ? ramp(vx0 - G.stubW, vx0, t, G.stubH) : '') + (nR ? ramp(vx1, vx1 + G.stubW, t, G.stubH) : '');
    const uniq = arr => arr.filter((x, k) => arr.findIndex(y => (y.stub ? 'stub' : y.road) === (x.stub ? 'stub' : x.road)) === k);
    const mark = (arr, left) => `<span class="hc-mark" style="${left ? `right:${W - vx0 + G.stubW}px` : `left:${vx1 + G.stubW}px`}">${uniq(arr).map(x => (x.stub ? '<b>出口</b>' : shield(x.road, 18))).join('')}</span>`;
    return hRow(G, H, hRoadSvg(G, H, { ...road, ...ys(H), gapL: nL ? [t, t + G.stubH] : null, gapR: nR ? [t, t + G.stubH] : null, extra }),
      html + (nL ? mark(side.L, true) : '') + (nR ? mark(side.R, false) : ''));
  };

  let row, H;
  if (!nL && !nR) {
    H = G.labelH;
    row = hRow(G, H, hRoadSvg(G, H, { ...road, ...ys(H) }), html);
  } else if (o.collapse) {
    // 路況頁：預設只標「這裡可轉」，點一下展開成完整的轉向列（寫往 XX、標出哪些方向能用），再點收回
    H = G.labelH;
    const HF = Math.max(G.bandH + 16, Math.max(nL, nR) * (G.slotH + 14));
    row = `<div class="hc-x" onclick="this.classList.toggle('open')"><div class="hc-xc">${mini(H)}</div><div class="hc-xo">${full(HF, true)}</div></div>`;
  } else {
    H = Math.max(G.bandH + (G.compact ? 12 : 16), Math.max(nL, nR) * G.slotH);
    row = full(H, false);
  }
  return { topEnd, row, bottomEnd, H };
}

// 一個交流道＝這一站＋到下一站的路段列（車速）。每一列都畫同一條直行的路，整條路從頭到尾不斷開；
// 速度框放在上下兩塊編號牌的正中間，讀起來就是這兩站之間那一段的車速。
function hCard(sc, i, o) {
  const G = o.G, W = G.W, last = sc.nodes.length - 1;
  const laneUp = sc.dirB, laneDown = sc.dirA; // 左半邊、右半邊
  const st = hStation(sc, i, o);
  const cls = `hc${G.compact ? ' compact' : ''}`;
  if (i >= last || o.stationOnly) return `<div class="${cls}">${st.topEnd}${st.row}${st.bottomEnd}</div>`;

  const road = hRoadOp(sc, o.focus || null);
  const { cx, vx0, vx1 } = hRoadX(G);
  // 兩側：這一段的 CCTV／CMS／事件、目前位置，放在所屬方向那一側（左＝往上走、右＝往下走）
  const colL = vx0 - 10, colR = W - vx1 - 10;
  const L = o.devices ? hDevTags(sc, i, laneUp, colL) : [], R = o.devices ? hDevTags(sc, i, laneDown, colR) : [];
  if (o.you && o.you.seg === i) {
    (o.you.dir === laneUp ? L : R).push({ html: `<span class="hc-you">目前 ${o.you.km.toFixed(1)}K</span>`, h: 20 });
  }
  const colH = arr => arr.reduce((s, t) => s + t.h, 0) + Math.max(0, arr.length - 1) * 5;
  // a、b：速度框上方／下方那一站，編號牌到列邊的空白（有轉向的站比較高）
  const pill = hPillHalf(G);
  const a = st.H / 2 - pill, b = hStation(sc, i + 1, o).H / 2 - pill;
  const H = Math.round(Math.max(G.boxH + 16 + Math.abs(a - b), G.roadH, colH(L) + 8, colH(R) + 8));
  const top = Math.round((H - G.boxH + b - a) / 2);
  const op = lane => (o.focus && o.focus !== lane ? 0.28 : 1);
  // 速度框只留方向單字＋車速（km/h 在列表上方寫一次）；順暢用沉一點的綠，塞車的黃／橘／紅才跳出來
  const box = (lane, x) => {
    const v = sc.segs[i][lane], lv = lvl(v);
    return `<div class="hc-box" style="left:${x}px;top:${top}px;width:${G.boxW}px;height:${G.boxH}px;background:${lv === 1 ? CALM_GREEN : LV_COLOR[lv]};opacity:${op(lane)}"><span>${dirLabel(lane)[0]}</span><b>${v}</b></div>`;
  };
  const col = (arr, left) => (arr.length ? `<div class="hc-side ${left ? 'l' : 'r'}" style="${left ? `left:4px;width:${colL}px` : `left:${vx1 + 6}px;width:${colR}px`};height:${H}px">${arr.map(t => t.html).join('')}</div>` : '');
  const seg = hRow(G, H, hRoadSvg(G, H, road),
    box(laneUp, cx - G.gap - G.boxW) + box(laneDown, cx + G.gap) + col(L, true) + col(R, false));
  return `<div class="${cls}">${st.topEnd}${st.row}${seg}</div>`;
}

// 路段裡的 CCTV／CMS／事件：放在所屬方向那一側，所以不用再寫方向；不加框。
// CCTV 只放攝影機圖示（點開看畫面）；CMS 用看板圖示＋訊息；事件用紅點＋文字。文字最多兩行，h＝估的高度
function hDevTags(sc, i, lane, colW) {
  const textW = s => [...s].reduce((w, c) => w + (c.charCodeAt(0) > 0x2e80 ? 10 : 5.5), 0);
  return devicesIn(sc, i, lane).map(d => {
    if (d.type === 'cctv') return { html: `<span class="hc-tag cam">${ICON.cam}</span>`, h: 16 };
    const [cls, text, icon] = d.type === 'cms' ? ['cms', d.text, HICON.cms] : ['ev', `${d.title} ${d.text}`, '<i></i>'];
    const lines = Math.min(2, Math.max(1, Math.ceil((textW(text) + 16) / colW)));
    return { html: `<span class="hc-tag ${cls}">${icon}<span>${text}</span></span>`, h: lines * 13 + 4 };
  });
}

function renderHCards(sc, o) {
  const G = o.G, last = sc.nodes.length - 1;
  const from = o.from ?? 0, to = o.to ?? last;
  const cards = [];
  for (let i = from; i <= to; i++) cards.push(hCard(sc, i, o));
  // 主畫面：最後一段也要有下一站夾住；最遠那一端的路畫到邊緣被裁掉，看得出路還沒到底
  if (o.tail && to < last) cards.push(hCard(sc, to + 1, { ...o, stationOnly: true }));
  const road = hRow(G, 240, hRoadSvg(G, 240, hRoadOp(sc, o.focus || null)));
  if (o.extendTop) cards.unshift(road);
  if (o.extendBottom) cards.push(road);
  const cap = o.note === false ? '' : '<div class="hc-cap">車速為兩站之間的平均 km/h・點轉接記號看細節</div>';
  // 整串交流道包在一個區塊裡，區塊裡面不畫分隔線、不留間距
  // 路延伸出去的那一端淡出，和真正的終點線分得開
  const fade = (o.extendTop ? ' fade-top' : '') + (o.extendBottom ? ' fade-bottom' : '');
  return `<div class="hcl${fade}">${cap}<div class="hcs">${cards.join('')}</div></div>`;
}

// 主畫面：同一種畫法縮小，顯示目前位置附近，只看目前方向（對向變淡）
function hMainPanel(sc) {
  const d = sc.drive;
  const info = driveInfo(sc, d.dir, d.km, 3);
  // 從目前路段往行進方向取 3 個交流道；往下走的方向可以取到最後一個（下緣的終點線畫在那裡）
  const last = sc.nodes.length - 1;
  const up = d.dir === sc.dirB;
  let from, to;
  if (!up) {
    to = Math.min(last, info.curSeg + 2);
    from = Math.max(0, to - 2);
  } else {
    from = Math.max(0, info.curSeg - 2);
    to = Math.min(last, from + 2);
  }
  // 最遠那一端不是道路真正的終點，就讓路延伸出去
  const farEnd = up ? from : Math.min(last, to + 1);
  const cards = renderHCards(sc, {
    G: hGeom(324, true), from, to, focus: d.dir, note: false, tail: true,
    extendTop: up && farEnd > 0,
    extendBottom: !up && (farEnd < last || !sc.endA),
    you: { ...d, seg: info.curSeg },
    ahead: new Set(info.ahead.map(a => a.i)),
    header: i => { const t = info.times.get(i); return t ? `${t.dist.toFixed(1)}km・${t.min}分` : ''; },
  });
  // 放不下時裁掉最遠的那一端，目前位置一定看得到：往上走的貼齊下緣，往下走的貼齊上緣
  return `<div class="hmini${up ? ' up' : ''}"><div class="hm-head">${shield(sc.road, 20)}${dirLabel(d.dir)}（${sc.dirCaption[d.dir]}）</div>${cards}</div>`;
}

// 小條：前方第一個可以轉、或是走到底的交流道
function hSmallChips(sc, info) {
  const lane = sc.drive.dir;
  const a = info.ahead.find(x => trAt(sc, x.i, lane).length || hIsEnd(sc, x.i, lane));
  if (!a) return '';
  if (!trAt(sc, a.i, lane).length) return `<span class="cap">${a.node.name}</span><span class="endtxt">${dirLabel(lane)}終點</span>`;
  const t = hTurns(sc, a.i, lane);
  const chip = (arr, left) => arr.map(g => `<span class="sside">${left ? '←' : ''}${hSign(g, 's')}${left ? '' : '→'}</span>`).join('');
  // 要轉的交流道就是上一行寫的下一站時，不再重寫站名
  const name = a.i === info.ahead[0].i ? '' : a.node.name;
  const cap = `${name}${hIsEnd(sc, a.i, lane) ? '到底' : ''}`;
  return `${cap ? `<span class="cap">${cap}</span>` : ''}${chip(t.L, true)}${chip(t.R, false)}`;
}
