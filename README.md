# 南坡萬 (Kevinnumber1) SEO Engine

> 台灣茶調酒自有品牌 × 雞尾酒分級代工 — SEO 監控與健檢系統

基於 **滿屋設計 SEO Engine v3.0** 架構平移，針對南坡萬雙主軸（B2C 瓶裝調酒 + B2B 代工）客製化。

## 架構

| 檔案 | 說明 |
|---|---|
| `SeoHealthCode_NPW.gs` | GAS 後端主程式（健檢掃描 + GSC 串接 + 雙語完整性檢查） |
| `TrendTracker_NPW.gs` | 關鍵字排名歷史快照模組（種子詞 50 個） |
| `index.html` | GitHub Pages 前端儀表板 |

## 與滿屋設計版本的主要差異

| 面向 | 滿屋設計 | 南坡萬 |
|---|---|---|
| Schema 型別 | CreativeWork + Service | Product + Organization + LocalBusiness |
| 頁面類型 | 作品集 CPT + 服務頁 | WP Pages（ZH × 18 + EN × 12）|
| 雙語維度 | 無 | **新增**（ZH/EN 對應頁覆蓋率）|
| Age Gate 排除 | 無 | **新增** |
| TrendTracker 初始化 | 依 GSC Top-100 | 手動種子詞（新站初期）|

## 快速部署步驟

1. **建立 Google Sheets** → 複製 ID 填入 `SeoHealthCode_NPW.gs` 第 21 行 `SHEET_ID`
2. **建立 GAS 專案**（container-bound 到上述 Sheets）→ 新增 `SeoHealthCode_NPW.gs` + `TrendTracker_NPW.gs`
3. **設定 OAuth scope**（`appsscript.json`）：`webmasters.readonly`
4. **部署 Web App** → 執行身分：你的帳號，存取：所有人
5. **複製 Web App URL** → 貼入 `index.html` 第 735 行 `GAS_URL`
6. **推送更新後的 index.html** → GitHub Pages 自動發布
7. **初始化 TrendTracker** → GAS 執行 `initKeywordWatchlistNPW()` → `backfillHistory()` → `setupDailySnapshotTrigger()`

## GSC 屬性

- 網址：`https://kevinnumber1-cocktail.com.tw/`
- 狀態：待主公在 Search Console 完成 DNS TXT 驗證

## GA4

- 狀態：**尚未建立 Property**（GAS 程式碼已保留佔位符）
- 建立後：填入 `GA4_CONFIG.PROPERTY_ID`，並在 `appsscript.json` 新增 `analytics.readonly` scope
