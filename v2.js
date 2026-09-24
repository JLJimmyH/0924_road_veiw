/* v2：從 app 原版（origin/jack 路況頁「路段」分頁）出發，只修轉接的顯示。
 * 原版膠囊左右的盾牌，意思是「左邊車道能轉、右邊車道能轉」：左＝road.directions 第一個方向（南下／東向），
 * 右＝第二個（北上／西向）。這和實際車道位置一致（北上車道在東側、南下在西側），所以版面保留，只改三件事：
 * 1. 只顯示真的能轉的方向（資料要正確，例如台61 八里二只有北上能接 64）。
 * 2. 同一條路的不同方向分開顯示：依 roadID＋方向去重，不再只依 roadID。
 * 3. 每個轉接寫目標方向：盾牌旁寫「北上」「東向」。
 * 原版（對照用）照現有資料和原本的邏輯重現：依 roadID 去重、只放盾牌（_linksAtEndpoint、_EndpointPill）。 */
'use strict';

// 這個方向的車道在交流道 i 能轉去的道路。原版：現有資料（trRaw）、依 roadID 去重；v2：正確資料、依 roadID＋方向去重
function olLinks(sc, i, lane, v2) {
  const nd = sc.nodes[i];
  const list = ((v2 ? nd.tr : nd.trRaw || nd.tr) || {})[lane] || [];
  const seen = new Set();
  return list.filter(([road, dir]) => {
    const k = v2 ? road + dir : road;
    return !seen.has(k) && seen.add(k);
  }).map(([road, dir]) => ({ road, dir }));
}

function olPill(sc, i, v2) {
  const nd = sc.nodes[i];
  const item = (t, left) => `<span class="ol-link">${left ? '‹' : ''}${shield(t.road, v2 ? 20 : 24)}${v2 ? `<small>${dirLabel(t.dir)}</small>` : ''}${left ? '' : '›'}</span>`;
  const L = olLinks(sc, i, sc.dirA, v2).map(t => item(t, true)).join('');
  const R = olLinks(sc, i, sc.dirB, v2).map(t => item(t, false)).join('');
  return `<div class="ol-pill${v2 ? ' v2' : ''}"><div class="ol-side l">${L}</div><div class="ol-c"><span>${nd.name}</span><span class="ol-km">${nd.km}km</span></div><div class="ol-side r">${R}</div></div>`;
}

function olDevice(d) {
  if (d.type === 'cctv') return `<span class="ol-dev">${ICON.cam}${d.km}K</span>`;
  if (d.type === 'cms') return `<span class="ol-dev cms">CMS ${d.text}</span>`;
  return `<span class="ol-dev ev">${d.title} ${d.text}</span>`;
}

// 一段＝兩條直式色條（左＝第一個方向、右＝第二個方向），下面接下一個交流道的膠囊；第一段上面多一個起點膠囊
function olRow(sc, i, v2) {
  const a = sc.dirA, b = sc.dirB;
  const devA = devicesIn(sc, i, a), devB = devicesIn(sc, i, b);
  const H = Math.max(157, Math.max(devA.length, devB.length) * 96);
  const strip = lane => {
    const v = sc.segs[i][lane];
    return `<div class="ol-strip" style="background:${LV_COLOR[lvl(v)]}"><b>${dirLabel(lane)}</b><strong>${v}</strong><small>km/h</small></div>`;
  };
  return `<div class="ol-pair">${i === 0 ? olPill(sc, 0, v2) : ''}
    <div class="ol-row" style="height:${H}px">
      <div class="ol-devs l">${devA.map(olDevice).join('')}</div>
      <div class="ol-strips">${strip(a)}${strip(b)}</div>
      <div class="ol-devs r">${devB.map(olDevice).join('')}</div>
    </div>${olPill(sc, i + 1, v2)}</div>`;
}

function olLiveScreen(sc, v2) {
  const rows = sc.nodes.slice(0, -1).map((_, i) => olRow(sc, i, v2)).join('');
  return `<div class="screen ol">
    ${statusBar()}
    <div class="ol-appbar">${ICON.back}<span class="t">國道/快速道路路況</span>${ICON.heart}</div>
    <div class="tabs2 ol-tabs"><span class="on">${HICON.road}路段</span><span>${HICON.list}事件</span><span>${HICON.map}地圖</span><span>${HICON.rest}服務區</span></div>
    <div class="ol-roadbar">${shield(sc.road, 36)}<span class="n">${ROADS[sc.road].name}</span>${ICON.list}</div>
    <div class="content"><div class="ol-list">${rows}</div></div>
    <div class="fab2">${ICON.filter}</div>
  </div>`;
}
