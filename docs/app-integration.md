# 寫進 haodriveo app

> ⚠ 這份還是最早「卡片盒」版本的寫法，部分過時。最新畫法以 `hcard.js` 和 [`progress.md`](progress.md) 為準；資料欄位、演算法、app 相關程式的說明仍可參考。

以 app repo 的 `origin/jack` 分支為準（`finn-test` 比較舊）。畫法看 [`spec.md`](spec.md)，外觀對照 mockup 的 `index.html`。每一步做到完成條件才進下一步。

## 相關程式（先讀懂）

| 檔案 | 現在做什麼 | 這次要動的地方 |
|---|---|---|
| `lib/model/RoadSectionModel.dart` | `RoadSectionLinkModel`（`roadID`、`dir`、`interchangeName`、`sectionID`）、`RoadSectionModel.link2s` | 加 `side`、`remainKm` |
| `lib/provider/RoadDataProvider.dart` | 載入 `assets/data/freeways_all.enc` | 資料沒帶 `side`／`remainKm` 時在載入後補算 |
| `lib/pages/live/RoadLiveListModeWidfet.dart` | 路況頁「路段」分頁：`_buildSectionPairs` 把兩個方向依 index 配對；`_SectionRow` 畫直式色條與裝置；`_EndpointPill` 在交流道膠囊左右放 `_RoadSectionLinkButton`；`_linksAtEndpoint` 依 `roadID` 去重；`_openRoadSectionLink` 點了跳到目標道路 | 換成卡片元件 |
| `lib/pages/home/section/SectionWidget.dart` | 主畫面路段 panel：`_buildFutureBPanel` 依 `SectionPanelMode` 切換；`_buildTimelineNodeRow`／`_buildRoadLinkBadge` 畫前方朝上的時間軸與只有盾牌的轉接；`_uniqueRoadLinks` 依 `roadID` 去重；`_buildNormalSmallSectionBar` 是有事件時的小條 | 時間軸模式改用卡片元件；小條改寫法 |
| `lib/pages/home/widgets/MainRemindWidget.dart` | 直向時大 panel 佔螢幕高 55%、小條高 80 | 尺寸沿用 |
| `lib/pages/home/map/map_section_floating_widget.dart` | 地圖模式的浮動路段 | 也要跟著換成同一種卡片，才是同一套看法 |

方向判斷用方向代碼：S／E＝往下走（dirA），N／W＝往上走（dirB）。不要依 `road.directions` 的順序推。

## 步驟

### 1. 資料：每筆 link 有 `side` 與 `remainKm`

- `RoadSectionLinkModel` 加 `side`（`'L'`／`'R'`）與 `remainKm`（double），`fromJson`／`toJson`／`fromDbRow` 都要帶。`link2s` 在 `AppDatabase` 的 freeway section 資料表是 TEXT（JSON）欄位（DB_VERSION 19 加的），JSON 裡多欄位不用改 schema；但使用者手機裡已經存好的舊資料沒有這兩個欄位，要確認資料更新時會重新匯入，或讀取時缺值就補算。
- 優先請後端在產生 `freeways_all` 時算好（演算法見 spec §7，參考實作 `tools/link_geometry.py`）。後端還沒做之前，在 `RoadDataProvider` 解完 bundle 後用同樣演算法補算。
- **完成條件**：`test/road_section_link_test.dart` 新增案例全部通過：台64 西向八里二的 61 北上 `side == 'R'`、61 南下 `side == 'L'`；台61 八里二的 64 東向 `side == 'R'`；國3 木柵的國3甲東向 `remainKm` 約 0.6、國3甲西向約 5.2；bundle 中每一筆 link 都有 `side` 與 `remainKm`。

### 2. 去重與分組

- 把 `_linksAtEndpoint`（路況頁）與 `_uniqueRoadLinks`（主畫面）改成依 `roadID + dir` 去重，並記下哪些抵達方向能接（spec §3）。
- **完成條件**：台64 八里二得到兩筆（61 北上、61 南下）；國3 汐止系統得到「國1 南下：南下、北上都能接」「國1 北上：只有北上能接」。

### 3. 卡片元件

- 新增一個共用 widget（例如 `lib/pages/live/widgets/RoadInterchangeCard.dart`），參數：節點、路段車速／顏色、左右轉向、終點、聚焦方向、目前位置、尺寸比例（1 或 0.76）、表頭右側內容。畫法照 spec §2、§4；路面用 `CustomPainter` 畫直行的路、雙黃線與橫向車道，只用水平垂直線。
- 路況頁用它取代 `_SectionRow`＋`_EndpointPill`：一個交流道一張卡，最後一個交流道只有表頭。CCTV／CMS／事件改成卡片底下的小標籤列。
- 點路牌沿用 `_openRoadSectionLink`，帶目標 `dir`，跳過去後高亮目標方向。
- 拿掉每張卡兩側的「西向 ←」「東向 →」與表頭的「[61] ›」。
- **完成條件**：路況頁三個情境（台64、台61、國3）逐張卡和 mockup 一致：沒得接的卡片兩側完全空白；能接的那一側才有橫向車道＋直排路牌＋朝外箭頭；「僅北上」出現在國3 汐止系統右側。

### 4. 走到底

- 依 spec §5 判斷與畫終點線；dirA 的終點只有在該道路真的結束時才畫（完整道路的最後一個交流道才算）。
- **完成條件**：台64 八里二上緣「← [61]南下 往林口 ─ 西向到底 ─ [61]北上 往淡水 →」；台64 新店端下緣「東向終點」；台61 淡水端上緣「北上終點」；只能轉一邊時另一端的擋線露在中間標籤外。

### 5. 出口

- `remainKm ≤ 2` 的轉接路牌改成「出口 往 XX」（spec §6）。
- **完成條件**：國3 木柵右側是「出口 往深坑」，左側國3甲西向維持一般路牌；國3 新化系統的國8 東向、竹田系統的台88 東向也是出口寫法。

### 6. 主畫面

- `SectionWidget` 的時間軸模式（`currentSection`、`upcomingRoute`、`upcomingRouteRight`）改用卡片元件縮小（比例 0.76），規則見 spec §8：3 張卡的取法、聚焦、已開過不標轉向、目前位置標在表頭、表頭右側距離時間。休息站、避車彎模式與 VD 車道 panel 維持原樣。
- 小條 `_buildNormalSmallSectionBar` 改成寫前方第一個「能接或走到底」的交流道（spec §8）。
- 地圖浮動路段（`map_section_floating_widget.dart`）用同一個元件。
- **完成條件**：[`acceptance.md`](acceptance.md) 的主畫面案例全部符合，特別是往下走開到終點前（台64 東向 27K）看得到「東向終點」、剛開過中和時中和不再顯示國3 轉向。

### 7. 驗收

- 逐條跑 [`acceptance.md`](acceptance.md)，每條附截圖或 widget test。
- **完成條件**：全部案例通過；和 mockup 不一致的地方要回報，不要自行改規則（改規則先看 [`decisions.md`](decisions.md)）。

## 取得路網資料（算 `side`／`remainKm`、對照資料時用）

`assets/data/freeways_all.enc` 是加密檔；這個 repo 是公開的，所以不放解密方式、金鑰和解密後的資料。在 app repo 裡沿用 `RoadDataProvider` 載入時的解密流程，寫一個暫時的 Dart test，把每個 section 的 `toJson()`（含 `segments`、`link2s`）依原本的檔名分組輸出成 JSON，給 `tools/link_geometry.py` 讀。解出來的 JSON 放在兩個 repo 以外的暫存資料夾；那個暫時的 test 不要 commit，用完就刪。
