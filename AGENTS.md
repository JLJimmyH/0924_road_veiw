# 國道路況：轉接與終點顯示

haodriveo app「國道/快速道路路況」頁與行車主畫面的新畫法。這個 repo 是互動式 mockup 與交接文件；最後要實作在 haodriveo Flutter app（`origin/jack` 分支的 `lib/`）。

**先讀 [`docs/progress.md`](docs/progress.md)**：最新狀態、所有待辦（包含還沒做的新需求）、怎麼接著做。

## 核心規則（v1，`index.html`＋`hcard.js`）

- **一條連續的直行路**，由上往下＝里程增加；北上／西向往上走、南下／東向往下走。整串包在一個大區塊裡，區塊內不分隔。
- **交流道**：路上只放黃底的出口編號牌，只寫里程數字（休息站藍底）；站名放在路右邊固定的站名欄。
- **車速**夾在兩站之間＝那一段的平均車速；速度框只寫方向單字＋車速。
- **左右＝接其他道路**，依地圖方位；只有真的能接的那一側才畫。路況頁收合成記號、點開才看路牌（方向方塊 `[北][南]` 標出哪些方向能用）；主畫面直接放小路牌。
- **終點**一律叫「{方向}終點」，畫在前方；能不能轉看終點線兩端。
- **出口**：轉入後 2 km 內就到終點的轉接，寫「出口 往 XX」。
- **主畫面**＝同一種畫法縮小，聚焦目前行駛方向。
- 只用水平、垂直的線（箭頭頭部除外）。

v2（`v2.html`＋`v2.js`）是另一條路線：沿用 app 原版版面，只修轉接顯示，見 `docs/progress.md`。

## 文件

- [`docs/progress.md`](docs/progress.md)：最新狀態與待辦（先讀）。
- [`docs/decisions.md`](docs/decisions.md)：早期定案的決定與被否決的做法（之後的決定記在 progress.md）。
- [`docs/spec.md`](docs/spec.md)、[`docs/app-integration.md`](docs/app-integration.md)、[`docs/acceptance.md`](docs/acceptance.md)：**還是卡片版的寫法，部分過時**；資料欄位、左右與剩餘里程的演算法、app 相關程式仍可參考，畫法以 `hcard.js` 和 progress.md 為準。

## Mockup

- `index.html`（v1）、`v2.html`（v2）：瀏覽器直接開；`#t64`／`#t61`／`#n3` 切情境，`?full` 展開整條列表，`&expand` 把轉接記號全部展開。
- `shared.js`：情境資料與行車計算；`shared.css`：顏色與尺寸；圖片在 `assets/freeway/`（檔名＝`roadID.png`，和 app 的 `assets/images/freeway/` 相同）。
- `tools/link_geometry.py`：從解密後的路網資料算出每筆轉接的左右與剩餘里程（資料放在 repo 外）。
