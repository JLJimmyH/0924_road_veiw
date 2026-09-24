"""算出每筆轉接（link2s）的左右（side）與轉入後剩餘里程（remainKm）。

輸入：解密後的 freeways_all（JSON：{檔名: [section, ...]}，section 含 roadID、dir、sectionID、
startName、endName、startKm、endKm、segments、link2s）。取得方式見 docs/app-integration.md。
輸出：JSON 陣列，每筆轉接一列。演算法說明見 docs/spec.md §7。

用法：python tools/link_geometry.py <repo 外的路徑>/freeways_all.json > <repo 外的路徑>/link_geometry.json
（解密後的資料和輸出都不要放進這個公開 repo）
"""
import collections
import json
import math
import sys

PARALLEL_DEG = 30   # |rel| < 30 或 > 150 視為平行，預設畫右側
STUB_KM = 2         # 轉入後剩不到這個里程就畫成「出口」
SPAN = 6            # 取交流道附近幾個座標點算方位角
KM_INCREASING = {'S', 'E'}


def points(section):
    out = []
    for seg in section.get('segments') or []:
        for key in ('latLng1', 'latLng2'):
            v = seg.get(key)
            if isinstance(v, list) and len(v) == 2:
                out.append((v[0], v[1]))
            elif isinstance(v, dict):
                out.append((v.get('lat', v.get('latitude')), v.get('lng', v.get('longitude'))))
    return [p for p in out if p[0] is not None and p[1] is not None]


def bearing(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    y = math.sin(lo2 - lo1) * math.cos(la2)
    x = math.cos(la1) * math.sin(la2) - math.sin(la1) * math.cos(la2) * math.cos(lo2 - lo1)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def heading(section, at_end):
    p = points(section)
    if len(p) < 2:
        return None
    if at_end:
        return bearing(p[max(0, len(p) - 1 - SPAN)], p[-1])
    return bearing(p[0], p[min(len(p) - 1, SPAN)])


def main(path):
    data = json.load(open(path, encoding='utf-8'))
    sections = [s for group in data.values() for s in group]
    by_id = {(s['roadID'], s['sectionID']): s for s in sections}
    by_dir = collections.defaultdict(list)
    for s in sections:
        by_dir[(s['roadID'], s['dir'])].append(s)

    rows = []
    for s in sections:
        for link in s.get('link2s') or []:
            target = by_id.get((link['roadID'], link['sectionID']))
            row = {
                'roadID': s['roadID'], 'dir': s['dir'], 'sectionID': s['sectionID'],
                'interchangeName': link['interchangeName'],
                'targetRoadID': link['roadID'], 'targetDir': link['dir'], 'targetSectionID': link['sectionID'],
                'side': 'R', 'relDeg': None, 'parallel': None, 'remainKm': None, 'stub': None, 'targetEndName': None,
            }
            if target:
                # 左右：目前道路「里程增加方向」的走向 vs 目標 section 開頭的走向
                h_cur = heading(s, at_end=True)
                h_tgt = heading(target, at_end=False)
                if h_cur is not None and h_tgt is not None:
                    if s['dir'] not in KM_INCREASING:
                        h_cur = (h_cur + 180) % 360
                    rel = (h_tgt - h_cur + 540) % 360 - 180
                    parallel = abs(rel) < PARALLEL_DEG or abs(rel) > 180 - PARALLEL_DEG
                    row['relDeg'] = round(rel, 1)
                    row['parallel'] = parallel
                    # 在里程增加方向的左手邊（rel < 0）→ 卡片右側；右手邊 → 左側
                    row['side'] = 'R' if parallel or rel < 0 else 'L'
                # 剩餘里程：目標方向最遠終點里程 − 目標 section 起點里程
                seq = by_dir[(link['roadID'], link['dir'])]
                pick = max if link['dir'] in KM_INCREASING else min
                last = pick(seq, key=lambda x: x.get('endKm') or 0)
                remain = abs((last.get('endKm') or 0) - (target.get('startKm') or 0))
                row['remainKm'] = round(remain, 1)
                row['stub'] = remain <= STUB_KM
                row['targetEndName'] = last.get('endName')
            rows.append(row)
    json.dump(rows, sys.stdout, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main(sys.argv[1])
