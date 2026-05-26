// ============================================================
// TrendTracker v1.0 — 南坡萬 (Kevinnumber1) 版
// 基於 滿屋設計 TrendTracker v1.0 平移
// 關鍵字清單換為南坡萬核心詞
// ============================================================

const TREND_CONFIG = {
  SHEET_HISTORY:    '關鍵字排名歷史',
  SHEET_WATCHLIST:  '監控關鍵字清單',
  SHEET_ALERTS:     '排名警示紀錄',
  SHEET_SITE_TREND: '全站指標趨勢',
  MAX_WATCHLIST:    80,    // 南坡萬新站，先監控 80 個
  ALERT_DAYS:       7,
};

// ============================================================
// 南坡萬核心關鍵字預設清單（取代由 GSC 自動抓 Top-100）
// 因新站初期 GSC 數據不足，先手動設定種子詞
// ============================================================
const NPW_SEED_KEYWORDS = [
  // B2C — 台灣茶調酒
  '台灣茶調酒', '茶調酒', '瓶裝調酒', '台灣調酒', '手工調酒',
  '茶酒', '台灣茶酒', '台灣特色調酒', '茶基底調酒',
  // B2C — 品牌 + 產品
  '南坡萬', 'kevinnumber1', '蜜香紅茶琴酒', '梔子花金萱威士忌',
  '茉莉香片脆梅琴酒', '泰奶烏龍蘭姆酒',
  // B2C — 長尾
  '蜜香紅茶調酒', '金萱威士忌', '烏龍蘭姆', '台灣茶酒禮盒',
  '調酒禮盒', '台灣特色禮盒', '好喝調酒推薦',
  // B2C — 場景
  '伴手禮調酒', '送禮調酒', '婚禮調酒', '生日禮物調酒',
  '台灣味調酒', '茶感調酒',
  // B2B — OEM / 代工
  '調酒代工', '調酒 OEM', '瓶裝調酒代工', '酒類代工',
  '客製調酒', '貼牌調酒', '調酒貼牌',
  // B2B — 英文（EN 頁面）
  'cocktail OEM Taiwan', 'Taiwan cocktail manufacturer',
  'bottled cocktail OEM', 'private label cocktail Taiwan',
  'Taiwan tea cocktail', 'RTD cocktail Taiwan',
  // 品牌問題
  '台灣調酒品牌', '台灣手工酒', '小批量調酒',
  // Where to Buy
  '買台灣茶調酒', '哪裡買調酒', '台灣調酒哪裡買',
  // 長尾競品比較
  '台灣調酒推薦', '特色台灣酒', '茶入調酒',
];

// ============================================================
// Step B2：南坡萬專用初始化（直接用種子詞，不依賴 GSC）
// ============================================================
function initKeywordWatchlistNPW() {
  const ss = _getSpreadsheet();
  let sheet = ss.getSheetByName(TREND_CONFIG.SHEET_WATCHLIST);
  if (!sheet) sheet = ss.insertSheet(TREND_CONFIG.SHEET_WATCHLIST);
  sheet.clearContents();

  const now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd');
  const watchHeaders = ['關鍵字', '加入日期', '備註', '啟用'];
  sheet.getRange(1, 1, 1, watchHeaders.length).setValues([watchHeaders])
    .setBackground('#1a1a2e').setFontColor('#ffffff').setFontWeight('bold');

  const dataRows = NPW_SEED_KEYWORDS.map(kw => {
    let note = '';
    if (['台灣茶調酒','茶調酒','瓶裝調酒','南坡萬','kevinnumber1'].includes(kw)) note = '核心詞';
    else if (kw.includes('OEM') || kw.includes('代工') || kw.includes('manufacturer')) note = 'B2B';
    else if (/[a-zA-Z]/.test(kw)) note = 'EN頁';
    return [kw, now, note, 'Y'];
  });

  sheet.getRange(2, 1, dataRows.length, watchHeaders.length).setValues(dataRows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, watchHeaders.length);

  const msg = `✅ 南坡萬監控清單初始化：${dataRows.length} 個關鍵字。接著執行 backfillHistory()`;
  console.log(msg);
  return msg;
}

// ============================================================
// 以下函式直接沿用滿屋 TrendTracker v1.0 邏輯
// （_getSpreadsheet / _fmtDate 已在 SeoHealthCode_NPW.gs 定義）
// ============================================================

function _fmtDate(val) {
  if (!val && val !== 0) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Taipei', 'yyyy-MM-dd');
  }
  return String(val).slice(0, 10);
}

function backfillHistory() {
  const ss = _getSpreadsheet();
  const wSheet = ss.getSheetByName(TREND_CONFIG.SHEET_WATCHLIST);
  if (!wSheet || wSheet.getLastRow() <= 1) {
    throw new Error('請先執行 initKeywordWatchlistNPW()');
  }

  const wRaw  = wSheet.getDataRange().getValues().slice(1);
  const keywords = wRaw
    .filter(r => String(r[3]).toUpperCase() === 'Y' && r[0])
    .map(r => String(r[0]));

  let hSheet = ss.getSheetByName(TREND_CONFIG.SHEET_HISTORY);
  if (!hSheet) hSheet = ss.insertSheet(TREND_CONFIG.SHEET_HISTORY);
  if (hSheet.getLastRow() <= 1) {
    hSheet.clearContents();
    const h = ['日期', '關鍵字', '點擊數', '曝光數', '點擊率', '平均排名', '抓取時間'];
    hSheet.getRange(1, 1, 1, h.length).setValues([h])
      .setBackground('#1a1a2e').setFontColor('#fff').setFontWeight('bold');
  }

  const token = ScriptApp.getOAuthToken();
  const endDate   = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');

  const existingKeys = new Set();
  if (hSheet.getLastRow() > 1) {
    const existing = hSheet.getRange(2, 1, hSheet.getLastRow() - 1, 2).getValues();
    existing.forEach(r => existingKeys.add(_fmtDate(r[0]) + '|' + String(r[1])));
  }

  const newRows = [];
  const now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm');

  for (const kw of keywords.slice(0, 50)) {
    Utilities.sleep(600);
    try {
      const startDate = Utilities.formatDate(new Date(Date.now() - 90 * 86400000), 'UTC', 'yyyy-MM-dd');
      const resp = UrlFetchApp.fetch(
        'https://www.googleapis.com/webmasters/v3/sites/' +
        encodeURIComponent(GSC_CONFIG.SITE_URL) + '/searchAnalytics/query',
        {
          method: 'post', contentType: 'application/json',
          headers: { Authorization: 'Bearer ' + token },
          payload: JSON.stringify({
            startDate, endDate,
            dimensions: ['date', 'query'],
            dimensionFilterGroups: [{
              filters: [{ dimension: 'query', operator: 'equals', expression: kw }]
            }],
            rowLimit: 90,
          }),
          muteHttpExceptions: true,
        }
      );
      if (resp.getResponseCode() !== 200) continue;
      const data = JSON.parse(resp.getContentText());
      if (!data.rows) continue;
      data.rows.forEach(row => {
        const date = row.keys[0];
        const key  = date + '|' + kw;
        if (existingKeys.has(key)) return;
        existingKeys.add(key);
        newRows.push([date, kw, row.clicks, row.impressions, row.ctr, row.position, now]);
      });
    } catch (e) {
      console.log('backfill error for: ' + kw + ' — ' + e.message);
    }
  }

  if (newRows.length > 0) {
    hSheet.getRange(hSheet.getLastRow() + 1, 1, newRows.length, 7).setValues(newRows);
  }

  const msg = `✅ backfill 完成：${newRows.length} 筆歷史數據寫入。接著執行 setupDailySnapshotTrigger()`;
  console.log(msg);
  return msg;
}

function setupDailySnapshotTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'dailySnapshot')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('dailySnapshot')
    .timeBased().atHour(3).everyDays(1).create();

  return '✅ 每日凌晨 3 點快照觸發器已設定';
}

function dailySnapshot() {
  const ss     = _getSpreadsheet();
  const wSheet = ss.getSheetByName(TREND_CONFIG.SHEET_WATCHLIST);
  if (!wSheet || wSheet.getLastRow() <= 1) return;

  const keywords = wSheet.getDataRange().getValues().slice(1)
    .filter(r => String(r[3]).toUpperCase() === 'Y' && r[0])
    .map(r => String(r[0]));

  let hSheet = ss.getSheetByName(TREND_CONFIG.SHEET_HISTORY);
  if (!hSheet) hSheet = ss.insertSheet(TREND_CONFIG.SHEET_HISTORY);

  const token   = ScriptApp.getOAuthToken();
  const today   = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
  const nowStr  = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm');

  const existing = hSheet.getLastRow() > 1
    ? new Set(hSheet.getRange(2, 1, hSheet.getLastRow() - 1, 2).getValues()
        .map(r => _fmtDate(r[0]) + '|' + String(r[1])))
    : new Set();

  const newRows = [];
  for (const kw of keywords) {
    Utilities.sleep(400);
    try {
      const resp = UrlFetchApp.fetch(
        'https://www.googleapis.com/webmasters/v3/sites/' +
        encodeURIComponent(GSC_CONFIG.SITE_URL) + '/searchAnalytics/query',
        {
          method: 'post', contentType: 'application/json',
          headers: { Authorization: 'Bearer ' + token },
          payload: JSON.stringify({
            startDate: today, endDate: today,
            dimensions: ['date', 'query'],
            dimensionFilterGroups: [{
              filters: [{ dimension: 'query', operator: 'equals', expression: kw }]
            }],
            rowLimit: 1,
          }),
          muteHttpExceptions: true,
        }
      );
      if (resp.getResponseCode() !== 200) continue;
      const data = JSON.parse(resp.getContentText());
      if (!data.rows || !data.rows[0]) continue;
      const row = data.rows[0];
      const key = today + '|' + kw;
      if (!existing.has(key)) {
        newRows.push([today, kw, row.clicks, row.impressions, row.ctr, row.position, nowStr]);
      }
    } catch (e) { console.log('snapshot error: ' + kw); }
  }
  if (newRows.length > 0) {
    hSheet.getRange(hSheet.getLastRow() + 1, 1, newRows.length, 7).setValues(newRows);
  }
  _updateSiteTrend();
  checkRankingAlerts();
}

function _updateSiteTrend() {
  const token = ScriptApp.getOAuthToken();
  const end   = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
  const start = Utilities.formatDate(new Date(Date.now() - 90 * 86400000), 'UTC', 'yyyy-MM-dd');

  const resp = UrlFetchApp.fetch(
    'https://www.googleapis.com/webmasters/v3/sites/' +
    encodeURIComponent(GSC_CONFIG.SITE_URL) + '/searchAnalytics/query',
    {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({ startDate: start, endDate: end, dimensions: ['date'], rowLimit: 90 }),
      muteHttpExceptions: true,
    }
  );
  if (resp.getResponseCode() !== 200) return;
  const data = JSON.parse(resp.getContentText());
  if (!data.rows) return;

  const ss = _getSpreadsheet();
  let tSheet = ss.getSheetByName(TREND_CONFIG.SHEET_SITE_TREND);
  if (!tSheet) tSheet = ss.insertSheet(TREND_CONFIG.SHEET_SITE_TREND);
  tSheet.clearContents();
  const h = ['日期', '點擊數', '曝光數', '點擊率', '平均排名'];
  tSheet.getRange(1, 1, 1, h.length).setValues([h]).setBackground('#1a1a2e').setFontColor('#fff').setFontWeight('bold');
  tSheet.getRange(2, 1, data.rows.length, h.length).setValues(
    data.rows.map(r => [r.keys[0], r.clicks, r.impressions, r.ctr, r.position])
  );
}

function checkRankingAlerts() {
  const ss     = _getSpreadsheet();
  const hSheet = ss.getSheetByName(TREND_CONFIG.SHEET_HISTORY);
  if (!hSheet || hSheet.getLastRow() <= 1) return { dropCount: 0, riseCount: 0, alerts: [] };

  const raw  = hSheet.getDataRange().getValues().slice(1);
  const byKW = {};
  raw.forEach(r => {
    const kw = String(r[1]);
    if (!byKW[kw]) byKW[kw] = [];
    byKW[kw].push({ date: _fmtDate(r[0]), pos: parseFloat(r[5]) || 99 });
  });

  const alerts = [];
  const N = TREND_CONFIG.ALERT_DAYS;

  for (const [kw, records] of Object.entries(byKW)) {
    const sorted = records.filter(r => r.date && r.pos < 99)
      .sort((a, b) => a.date < b.date ? -1 : 1);
    if (sorted.length < N) continue;
    const recent = sorted.slice(-N).map(r => r.pos);
    let drop = true, rise = true;
    for (let i = 1; i < recent.length; i++) {
      if (recent[i] <= recent[i-1]) drop = false;
      if (recent[i] >= recent[i-1]) rise = false;
    }
    if (drop) alerts.push({ keyword: kw, type: 'drop', positions: recent, lastPos: recent[recent.length-1] });
    if (rise) alerts.push({ keyword: kw, type: 'rise', positions: recent, lastPos: recent[recent.length-1] });
  }

  // 寫入警示工作表
  const ss2 = _getSpreadsheet();
  let aSheet = ss2.getSheetByName(TREND_CONFIG.SHEET_ALERTS);
  if (!aSheet) aSheet = ss2.insertSheet(TREND_CONFIG.SHEET_ALERTS);
  if (aSheet.getLastRow() <= 1) {
    aSheet.clearContents();
    const h = ['偵測日期', '關鍵字', '類型', '最新排名', '7天排名趨勢'];
    aSheet.getRange(1, 1, 1, h.length).setValues([h]).setBackground('#1a1a2e').setFontColor('#fff').setFontWeight('bold');
  }

  const today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd');
  if (alerts.length > 0) {
    const newRows = alerts.map(a => [
      today, a.keyword, a.type === 'drop' ? '🔴連續下滑' : '🟢連續上升',
      a.lastPos.toFixed(1), a.positions.map(p => p.toFixed(0)).join('→')
    ]);
    aSheet.getRange(aSheet.getLastRow() + 1, 1, newRows.length, 5).setValues(newRows);
  }

  const dropCount = alerts.filter(a => a.type === 'drop').length;
  const riseCount = alerts.filter(a => a.type === 'rise').length;
  return { dropCount, riseCount, alerts };
}

// TrendTracker 前端呼叫函式
function getAllWatchlistHistory(days) {
  days = days || 30;
  const ss = _getSpreadsheet();
  const hSheet = ss.getSheetByName(TREND_CONFIG.SHEET_HISTORY);
  if (!hSheet || hSheet.getLastRow() <= 1) return { keywords: [], dates: [], series: [] };

  const cutoff = Utilities.formatDate(new Date(Date.now() - days * 86400000), 'UTC', 'yyyy-MM-dd');
  const raw    = hSheet.getDataRange().getValues().slice(1);
  const byKW   = {};

  raw.forEach(r => {
    const date = _fmtDate(r[0]);
    if (!date || date < cutoff) return;
    const kw  = String(r[1]);
    const pos = parseFloat(r[5]) || null;
    if (!byKW[kw]) byKW[kw] = {};
    if (pos) byKW[kw][date] = pos;
  });

  const allDates = [...new Set(raw.map(r => _fmtDate(r[0])).filter(d => d >= cutoff))].sort();
  const series   = Object.entries(byKW).map(([kw, dateMap]) => ({
    keyword: kw,
    data: allDates.map(d => dateMap[d] || null)
  })).sort((a, b) => {
    const lastA = a.data.filter(v => v).pop() || 99;
    const lastB = b.data.filter(v => v).pop() || 99;
    return lastA - lastB;
  });

  return { keywords: series.map(s => s.keyword), dates: allDates, series };
}

function getKeywordHistoryData(keyword, days) {
  days = days || 30;
  const ss = _getSpreadsheet();
  const hSheet = ss.getSheetByName(TREND_CONFIG.SHEET_HISTORY);
  if (!hSheet || !keyword) return { dates: [], positions: [] };

  const cutoff = Utilities.formatDate(new Date(Date.now() - days * 86400000), 'UTC', 'yyyy-MM-dd');
  const raw    = hSheet.getDataRange().getValues().slice(1);
  const points = raw
    .filter(r => _fmtDate(r[0]) >= cutoff && String(r[1]) === keyword)
    .map(r => ({ date: _fmtDate(r[0]), pos: parseFloat(r[5]) || null }))
    .sort((a, b) => a.date < b.date ? -1 : 1);

  return { dates: points.map(p => p.date), positions: points.map(p => p.pos) };
}

function getAlertsData() {
  return checkRankingAlerts();
}

function getSiteTrendData(days) {
  days = days || 90;
  const ss = _getSpreadsheet();
  const tSheet = ss.getSheetByName(TREND_CONFIG.SHEET_SITE_TREND);
  if (!tSheet || tSheet.getLastRow() <= 1) return { dates: [], clicks: [], impressions: [], ctrs: [], avgPositions: [] };

  const cutoff = Utilities.formatDate(new Date(Date.now() - days * 86400000), 'UTC', 'yyyy-MM-dd');
  const raw = tSheet.getDataRange().getValues().slice(1)
    .filter(r => _fmtDate(r[0]) >= cutoff)
    .sort((a, b) => _fmtDate(a[0]) < _fmtDate(b[0]) ? -1 : 1);

  return {
    dates:        raw.map(r => _fmtDate(r[0])),
    clicks:       raw.map(r => parseInt(r[1]) || 0),
    impressions:  raw.map(r => parseInt(r[2]) || 0),
    ctrs:         raw.map(r => parseFloat(r[3]) || 0),
    avgPositions: raw.map(r => parseFloat(r[4]) || null),
  };
}
