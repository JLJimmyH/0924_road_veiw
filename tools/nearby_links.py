"""找出可能漏掉的轉接：不同道路的交流道彼此很近，但路網資料（link2s）沒有轉接。

輸入：解密後的 freeways_all（JSON：{檔名: [section, ...]}），放在 repo 外。
輸出：每行一組候選「距離、道路A 交流道A、道路B 交流道B」，由近到遠。
這只是粗篩：有的是要下一般道路再上（間接相連，例如國1 五股和台65 五股端），有的可能是資料漏掉；
距離比門檻遠的（例如國1 五股到台64 五股一／二）不會列出。最後要對照實際出口標誌確認。

用法：python tools/nearby_links.py <repo 外的路徑>/freeways_all.json [距離門檻 km，預設 1.5]
"""
import json
import math
import sys


def haversine(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def main(path, limit):
    data = json.load(open(path, encoding='utf-8'))
    sections = [s for group in data.values() for s in group]
    names = {s['roadID']: s['roadName'] for s in sections}
    # 交流道的位置：用 section 起點的座標
    nodes = {}
    for s in sections:
        if s.get('startLat') and s.get('startLng'):
            nodes.setdefault((s['roadID'], s['startName']), (s['startLat'], s['startLng']))
    # 已經有轉接的（道路A 的交流道 → 道路B），兩個方向都記
    linked = set()
    for s in sections:
        for link in s.get('link2s') or []:
            linked.add((s['roadID'], s['endName'], link['roadID']))
            linked.add((link['roadID'], link['interchangeName'], s['roadID']))
    parallel = {frozenset(['000010', '00001A'])}  # 國1 和國1 高架本來就並行，不算
    items = list(nodes.items())
    rows = []
    for k, ((ra, na), pa) in enumerate(items):
        for (rb, nb), pb in items[k + 1:]:
            if ra == rb or frozenset([ra, rb]) in parallel:
                continue
            dist = haversine(pa, pb)
            if dist < limit and (ra, na, rb) not in linked and (rb, nb, ra) not in linked:
                rows.append((dist, names[ra], na, names[rb], nb))
    for dist, ra, na, rb, nb in sorted(rows):
        print(f'{dist:.2f} km\t{ra} {na}\t{rb} {nb}')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main(sys.argv[1], float(sys.argv[2]) if len(sys.argv) > 2 else 1.5)
