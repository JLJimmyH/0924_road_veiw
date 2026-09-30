# 國道路況：轉接顯示

haodriveo app「國道/快速道路路況」頁（之後含行車主畫面）轉接顯示的改版。這個 repo 是互動式 mockup 與交接文件；最後要實作在 haodriveo Flutter app（`origin/jack` 分支的 `lib/`）。

**先讀 [`docs/progress.md`](docs/progress.md)**：最新狀態、v2 待修清單、要請後端處理的資料、怎麼接著做。

## 核心規則（v2：沿用 app 原版版面，只修轉接）

- 版面照 app 原版：交流道是一整列的膠囊，兩站之間是兩條直式色條（左＝南下／東向、右＝北上／西向）。
- **膠囊左右＝哪個車道能轉**：左邊是左車道（南下／東向）能轉的、右邊是右車道（北上／西向）能轉的。
- 只顯示真的能轉的方向；依「路線＋方向」去重；盾牌旁寫目標方向（「北上」「東向」）。
- 終點、入口、出口、主畫面還沒做，見 progress.md。

v1（連續路面＋出口編號牌）已經不用，最後版本在 git tag `v1-final`。

## 文件

- [`docs/progress.md`](docs/progress.md)：最新狀態與待辦（先讀）。
- [`docs/decisions.md`](docs/decisions.md)：v1 時期的決定與被否決的做法（歷史紀錄）。
- [`docs/spec.md`](docs/spec.md)、[`docs/app-integration.md`](docs/app-integration.md)、[`docs/acceptance.md`](docs/acceptance.md)：v1 時期寫的，畫法不適用；資料欄位、剩餘里程演算法、app 相關程式的說明仍可參考。

## Mockup

- `index.html`：瀏覽器直接開；`#t64`／`#t61`／`#n3` 切情境，`?full` 展開整條列表。畫法在 `v2.js`，樣式在 `shared.css`（`.ol-*`），情境資料與行車計算在 `shared.js`。
- 圖片在 `assets/freeway/`（檔名＝`roadID.png`，和 app 的 `assets/images/freeway/` 相同）。
- `tools/`：從解密後的路網資料計算（剩餘里程、找可能漏掉的轉接）；資料放在 repo 外。
