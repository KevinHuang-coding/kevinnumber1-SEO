// =============================================
// 南坡萬 (Kevinnumber1) SEO Engine — GAS 後端 v1.0
// 基於 滿屋設計 SeoHealthCode v3.0 架構平移
// 主要差異：
//   - 品牌：瓶裝調酒 B2C + 代工 B2B（非活動佈置）
//   - 頁面：30 頁（ZH×18 + EN×12），無自訂 CPT
//   - Schema：Product + Organization + LocalBusiness
//   - 雙語完整性維度（ZH/EN 對應頁覆蓋率）
//   - Age Gate 頁排除邏輯
//   - GA4 佔位符（尚未建立 Property，暫不串接）
// =============================================

const CONFIG = {
  SITE_URL:      'https://kevinnumber1-cocktail.com.tw',
  SHEET_RESULTS: 'SEO健檢結果',
  PAGESPEED_KEY: '',
  SHEET_ID:      '',  // ← 新建 Google Sheets 後填入 ID
  // Age Gate 路徑排除清單（掃描時略過）
  AGE_GATE_PATHS: ['/age-verification/', '/age-gate/'],
  KNOWN_SNIPPETS: {
    // 待南坡萬 WPCode snippet 部署後填入
    // 'product_schema': { id: 0, name: 'Product Schema (酒款頁)', checkPage: '/products/', checkPattern: '"@type":"Product"' }
  }
};

// 南坡萬 Sitemap 結構（WP Pages only，無自訂 CPT）
const SITEMAPS = [
  { url: CONFIG.SITE_URL + '/page-sitemap.xml', type: '頁面（ZH+EN）' },
];

// ============================================================
// GSC Module 設定
// ============================================================
const GSC_CONFIG = {
  SITE_URL:        'https://kevinnumber1-cocktail.com.tw/',
  DAYS:            90,
  ROW_LIMIT:       1000,
  MAX_ROWS:        2000,   // 新站初期關鍵字少，上限調低
  SHEET_GSC_QUERY: 'GSC關鍵字',
  SHEET_GSC_PAGE:  'GSC頁面',
};

// ============================================================
// GA4 Module 設定（佔位符 — 待主公建立 Property 後填入）
// 目前 PROPERTY_ID 為空，fetch_ga4 動作會直接回傳空資料
// ============================================================
const GA4_CONFIG = {
  PROPERTY_ID:         '',   // ← 建立 GA4 Property 後填入 'properties/XXXXXXXXX'
  SHEET_GA4_OVERVIEW:  'GA4流量總覽',
  SHEET_GA4_PAGES:     'GA4落地頁',
  SHEET_GA4_EVENTS:    'GA4轉換事件',
};

// ============================================================
// 南坡萬 Schema 目標型別
// （不同於滿屋的 CreativeWork/ImageObject/Service）
// ============================================================
const NPW_SCHEMA_TARGETS = {
  // 首頁：Organization + WebSite
  'home': ['Organization', 'WebSite', 'LocalBusiness'],
  // 酒款頁：Product + BreadcrumbList
  'product': ['Product', 'BreadcrumbList'],
  // OEM/代工頁：Service + FAQPage
  'oem': ['Service', 'FAQPage', 'BreadcrumbList'],
  // 其他：至少有 BreadcrumbList
  'default': ['BreadcrumbList'],
};

// ============================================================
// 雙語頁面對應表（ZH slug → EN slug）
// ============================================================
const BILINGUAL_MAP = {
  '/':                    '/en/home/',
  '/products/':           '/en/our-products/',
  '/find-us/':            '/en/find-us/',
  '/oem/':                '/en/oem-en/',
  '/oem/standard/':       '/en/oem-en/oem-standard-en/',
  '/oem/custom/':         '/en/oem-en/oem-custom-en/',
  '/b2b-services/':       '/en/b2b-services-en/',
  '/about/':              '/en/about-en/',
  '/brewery/':            '/en/brewery-en/',
  '/news/':               '/en/news-en/',
  '/contact/':            '/en/contact-us/',
  // 酒款頁
  '/products/honey-black-tea-lychee-gin/':  '/en/our-products/honey-black-tea-lychee-gin-en/',
  '/products/gardenia-jinxuan-whisky/':     '/en/our-products/gardenia-jinxuan-whisky-en/',
  '/products/jasmine-plum-gin/':            '/en/our-products/jasmine-plum-gin-en/',
  '/products/thai-milk-oolong-rum/':        '/en/our-products/thai-milk-oolong-rum-en/',
};

// ============================================================
// Web App 進入點
// ============================================================
function doGet(e) {
  const p = (e && e.parameter) ? e.parameter : {};

  const respond = (obj) => {
    const json = JSON.stringify(obj);
    if (p.callback) {
      const out = ContentService.createTextOutput(p.callback + '(' + json + ');');
      out.setMimeType(ContentService.MimeType.JAVASCRIPT);
      return out;
    }
    const out = ContentService.createTextOutput(json);
    out.setMimeType(ContentService.MimeType.JSON);
    return out;
  };

  if (p.format === 'json')   return respond(getEngineData());
  if (p.format === 'gsc')    return respond(getGSCEngineData());
  if (p.format === 'ga4')    return respond(getGA4EngineData());
  if (p.action === 'verify') return respond(verifyTask(p.url || '', p.checkType || ''));
  if (p.action === 'scan')   { runScan(); return respond(getEngineData()); }
  if (p.action === 'fetch_gsc')  { fetchGSCData(); return respond(getGSCEngineData()); }
  if (p.action === 'fetch_ga4')  { fetchGA4Data(); return respond(getGA4EngineData()); }
  if (p.action === 'snippet_health') return respond(checkSnippetHealth());
  if (p.action === 'bilingual_check') return respond(checkBilingualCoverage());

  // TrendTracker v1.0 路由
  if (p.action === 'getWatchlistHistory') return respond(getAllWatchlistHistory(parseInt(p.days || 30)));
  if (p.action === 'getKeywordHistory')   return respond(getKeywordHistoryData(p.keyword || '', parseInt(p.days || 30)));
  if (p.action === 'getAlerts')           return respond(getAlertsData());
  if (p.action === 'getSiteTrend')        return respond(getSiteTrendData(parseInt(p.days || 90)));

  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', brand: 'Kevinnumber1 SEO Engine v1.0' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// 取得試算表
// ============================================================
function _getSpreadsheet() {
  if (CONFIG.SHEET_ID) return SpreadsheetApp.openById(CONFIG.SHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

// ============================================================
// 主資料函式
// ============================================================
function getEngineData() {
  const ss    = _getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_RESULTS);

  if (!sheet || sheet.getLastRow() <= 1) {
    return {
      overallScore: 0, pages: [], dimScores: {},
      summary: { total: 0, good: 0, warn: 0, bad: 0 },
      lastScan: null,
    };
  }

  const raw     = sheet.getDataRange().getValues();
  const headers = raw[0].map(String);
  const rows    = raw.slice(1);

  const pages = rows.map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = r[i]; });
    return obj;
  });

  const dims = ['頁面SEO', '結構化數據', '內容質量', '圖片優化', 'URL品質', 'GEO就緒度', '雙語完整性'];
  const dimScores = {};
  dims.forEach(d => {
    const vals = pages.map(p => parseFloat(p[d]) || 0).filter(v => v > 0);
    dimScores[d] = vals.length ? Math.round(vals.reduce((a, b) => a + b) / vals.length) : 0;
  });

  const weights = {
    '頁面SEO': 0.20, '結構化數據': 0.20, '內容質量': 0.15,
    '圖片優化': 0.15, 'URL品質': 0.10, 'GEO就緒度': 0.10, '雙語完整性': 0.10
  };
  const overall = Math.round(
    Object.entries(weights).reduce((s, [k, w]) => s + (dimScores[k] || 0) * w, 0)
  );

  const good = pages.filter(p => (parseFloat(p['綜合分數']) || 0) >= 80).length;
  const warn = pages.filter(p => { const s = parseFloat(p['綜合分數']) || 0; return s >= 50 && s < 80; }).length;
  const bad  = pages.filter(p => (parseFloat(p['綜合分數']) || 0) < 50).length;

  const lastScan = sheet.getRange(2, headers.indexOf('掃描時間') + 1).getValue();

  return { overallScore: overall, pages, dimScores, summary: { total: pages.length, good, warn, bad }, lastScan };
}

// ============================================================
// 全站掃描主函式
// ============================================================
function runScan() {
  const urls = _getAllUrls();
  const ss   = _getSpreadsheet();
  let sheet  = ss.getSheetByName(CONFIG.SHEET_RESULTS);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_RESULTS);

  const headers = [
    'URL', '頁面標題', '標題長度', 'Meta描述', '描述長度',
    'H1', 'H1數量', '圖片數', '有Alt圖片數', 'Schema型別',
    '頁面SEO', '結構化數據', '內容質量', '圖片優化', 'URL品質', 'GEO就緒度', '雙語完整性',
    '綜合分數', '問題摘要', '掃描時間', '語言'
  ];

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setBackground('#1a1a2e').setFontColor('#ffffff').setFontWeight('bold');

  const now  = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm');
  const rows = [];

  for (const url of urls) {
    Utilities.sleep(300);
    try {
      const result = _analyzePage(url, now);
      rows.push(result);
    } catch (err) {
      rows.push([url, 'ERROR', 0, '', 0, '', 0, 0, 0, '', 0, 0, 0, 0, 0, 0, 0, 0, err.message, now, '?']);
    }
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

// ============================================================
// 取得所有 URL（從 Sitemap）
// ============================================================
function _getAllUrls() {
  const urls = [];
  for (const sm of SITEMAPS) {
    try {
      const resp = UrlFetchApp.fetch(sm.url, { muteHttpExceptions: true });
      if (resp.getResponseCode() !== 200) continue;
      const xml  = XmlService.parse(resp.getContentText());
      const root = xml.getRootElement();
      const ns   = XmlService.getNamespace('http://www.sitemaps.org/schemas/sitemap/0.9');
      root.getChildren('url', ns).forEach(node => {
        const loc = node.getChild('loc', ns);
        if (!loc) return;
        const u = loc.getText().trim();
        // Age Gate 排除
        const isAgeGate = CONFIG.AGE_GATE_PATHS.some(p => u.includes(p));
        if (!isAgeGate && !urls.includes(u)) urls.push(u);
      });
    } catch (err) {
      console.log('Sitemap error: ' + sm.url + ' — ' + err.message);
    }
  }
  return urls;
}

// ============================================================
// 單頁分析
// ============================================================
function _analyzePage(url, now) {
  const resp = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { 'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' }
  });

  const code = resp.getResponseCode();
  if (code !== 200) {
    return [url, 'HTTP ' + code, 0, '', 0, '', 0, 0, 0, '', 0, 0, 0, 0, 0, 0, 0, 0, 'HTTP ' + code, now, '?'];
  }

  const html = resp.getContentText('UTF-8');

  // 語言判斷
  const langMatch = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
  const lang = langMatch ? langMatch[1].toLowerCase() : 'zh';
  const isEN = url.includes('/en/');

  // Title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
  const titleLen = title.length;

  // Meta description
  const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*?)["']/i)
                 || html.match(/<meta[^>]+content=["']([^"']*?)["'][^>]+name=["']description["']/i);
  const meta = metaMatch ? metaMatch[1].trim() : '';
  const metaLen = meta.length;

  // H1
  const h1Matches = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
  const h1Count = h1Matches.length;
  const h1Text = h1Count > 0 ? h1Matches[0].replace(/<[^>]+>/g, '').trim().substring(0, 80) : '';

  // Images
  const imgMatches = html.match(/<img[^>]+>/gi) || [];
  const imgTotal = imgMatches.length;
  const imgWithAlt = imgMatches.filter(img => /alt=["'][^"']+["']/i.test(img)).length;

  // Schema
  const schemaMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  const schemaTypes = [];
  schemaMatches.forEach(block => {
    try {
      const content = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
      const data = JSON.parse(content);
      _collectTypesRecursive(data, schemaTypes);
    } catch (e) {}
  });
  const schemaStr = [...new Set(schemaTypes)].join(', ');

  // ── 評分 ──
  // 1) 頁面 SEO
  let seo = 100;
  const titleMin = isEN ? 30 : 20;
  const titleMax = isEN ? 60 : 30;
  const metaMin  = isEN ? 50 : 40;
  const metaMax  = isEN ? 160 : 120;
  if (titleLen < titleMin || titleLen > titleMax) seo -= 15;
  if (metaLen < metaMin || metaLen > metaMax) seo -= 15;
  if (h1Count === 0) seo -= 20;
  if (h1Count > 1) seo -= 10;
  const seoScore = Math.max(0, seo);

  // 2) 結構化數據
  let schema = 100;
  // 判斷頁面類型應有的 Schema
  const path = url.replace(CONFIG.SITE_URL, '');
  const isHome    = (path === '/' || path === '' || path === '/en/home/');
  const isProduct = path.includes('/products/') || path.includes('/our-products/');
  const isOEM     = path.includes('/oem') || path.includes('/b2b-services');

  if (isHome) {
    if (!schemaTypes.includes('Organization')) schema -= 20;
    if (!schemaTypes.includes('LocalBusiness')) schema -= 20;
  } else if (isProduct) {
    if (!schemaTypes.includes('Product')) schema -= 30;
    if (!schemaTypes.includes('BreadcrumbList')) schema -= 10;
  } else if (isOEM) {
    if (!schemaTypes.includes('Service') && !schemaTypes.includes('FAQPage')) schema -= 20;
    if (!schemaTypes.includes('BreadcrumbList')) schema -= 10;
  } else {
    if (!schemaTypes.includes('BreadcrumbList') && schemaTypes.length === 0) schema -= 15;
  }
  const schemaScore = Math.max(0, schema);

  // 3) 內容質量（字元數估計）
  const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const charCount = textContent.length;
  const minChars = isEN ? 300 : 400;
  const contentScore = charCount >= minChars ? 100 : Math.round(charCount / minChars * 100);

  // 4) 圖片優化
  const imgScore = imgTotal === 0 ? 100 : Math.round(imgWithAlt / imgTotal * 100);

  // 5) URL 品質
  let urlScore = 100;
  if (url.match(/[^\x00-\x7F]/)) urlScore -= 30;  // 非 ASCII
  if (url.match(/[A-Z]/)) urlScore -= 10;           // 大寫
  if (url.match(/_/)) urlScore -= 10;               // 底線

  // 6) GEO 就緒度（AI 搜尋準備）
  let geo = 100;
  const hasStructuredData = schemaTypes.length > 0;
  const hasGoodMeta = metaLen >= metaMin;
  const hasFAQ = schemaTypes.includes('FAQPage');
  if (!hasStructuredData) geo -= 30;
  if (!hasGoodMeta) geo -= 20;
  if (!hasFAQ && (isOEM || isHome)) geo -= 10;
  const geoScore = Math.max(0, geo);

  // 7) 雙語完整性（ZH 頁面才計算）
  let bilingualScore = 100;
  if (!isEN) {
    // 找此 ZH 頁對應的 EN 路徑
    const zhPath = url.replace(CONFIG.SITE_URL, '') || '/';
    const enPath = BILINGUAL_MAP[zhPath];
    if (!enPath) {
      bilingualScore = 70;  // 未定義對應，扣分
    } else {
      try {
        const enUrl = CONFIG.SITE_URL + enPath;
        const enResp = UrlFetchApp.fetch(enUrl, { muteHttpExceptions: true });
        if (enResp.getResponseCode() === 200) {
          const enHtml = enResp.getContentText('UTF-8');
          const enTitle = enHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          const enMeta  = enHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*?)["']/i);
          if (!enTitle || !enTitle[1].trim()) bilingualScore -= 30;
          if (!enMeta  || !enMeta[1].trim())  bilingualScore -= 30;
        } else {
          bilingualScore = 20;  // EN 頁面 404
        }
      } catch (e) {
        bilingualScore = 50;
      }
    }
    bilingualScore = Math.max(0, bilingualScore);
  }
  // EN 頁面本身不計算雙語分（避免重複）
  if (isEN) bilingualScore = 100;

  // 綜合分數
  const overall = Math.round(
    seoScore * 0.20 + schemaScore * 0.20 + contentScore * 0.15 +
    imgScore * 0.15 + urlScore * 0.10 + geoScore * 0.10 + bilingualScore * 0.10
  );

  // 問題摘要
  const issues = [];
  if (seoScore < 80) issues.push('SEO:標題/描述不足');
  if (schemaScore < 80) issues.push('Schema:型別缺失');
  if (imgScore < 80) issues.push('圖片:Alt不足');
  if (bilingualScore < 80 && !isEN) issues.push('雙語:EN版缺內容');
  if (geoScore < 80) issues.push('GEO:結構化弱');

  return [
    url, title, titleLen, meta, metaLen, h1Text, h1Count,
    imgTotal, imgWithAlt, schemaStr,
    seoScore, schemaScore, contentScore, imgScore, urlScore, geoScore, bilingualScore,
    overall, issues.join(' | '), now, isEN ? 'EN' : 'ZH'
  ];
}

// ============================================================
// 遞迴收集 Schema 型別（同滿屋 BUG-004 修復）
// ============================================================
function _collectTypesRecursive(node, allTypes) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach(child => _collectTypesRecursive(child, allTypes));
    return;
  }
  if (node['@type']) {
    const t = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    t.forEach(type => { if (!allTypes.includes(type)) allTypes.push(type); });
  }
  if (node['@graph']) _collectTypesRecursive(node['@graph'], allTypes);
  Object.values(node).forEach(v => {
    if (v && typeof v === 'object') _collectTypesRecursive(v, allTypes);
  });
}

// ============================================================
// 雙語覆蓋率獨立檢查（可單獨呼叫）
// ============================================================
function checkBilingualCoverage() {
  const results = [];
  for (const [zhPath, enPath] of Object.entries(BILINGUAL_MAP)) {
    const zhUrl = CONFIG.SITE_URL + zhPath;
    const enUrl = CONFIG.SITE_URL + enPath;
    let zhStatus = 0, enStatus = 0, zhTitle = '', enTitle = '';
    try {
      const zhR = UrlFetchApp.fetch(zhUrl, { muteHttpExceptions: true });
      zhStatus = zhR.getResponseCode();
      const zhM = zhR.getContentText().match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      zhTitle = zhM ? zhM[1].trim() : '';
    } catch (e) {}
    Utilities.sleep(300);
    try {
      const enR = UrlFetchApp.fetch(enUrl, { muteHttpExceptions: true });
      enStatus = enR.getResponseCode();
      const enM = enR.getContentText().match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      enTitle = enM ? enM[1].trim() : '';
    } catch (e) {}
    results.push({
      zhPath, enPath,
      zhStatus, enStatus,
      zhTitle, enTitle,
      ok: zhStatus === 200 && enStatus === 200 && !!zhTitle && !!enTitle
    });
  }
  const ok    = results.filter(r => r.ok).length;
  const total = results.length;
  return { coverage: Math.round(ok / total * 100), ok, total, detail: results };
}

// ============================================================
// GSC Module（直接平移自滿屋，換 SITE_URL 即可）
// ============================================================
function getGSCEngineData() {
  const ss = _getSpreadsheet();
  const qSheet = ss.getSheetByName(GSC_CONFIG.SHEET_GSC_QUERY);
  const pSheet = ss.getSheetByName(GSC_CONFIG.SHEET_GSC_PAGE);

  if (!qSheet || qSheet.getLastRow() <= 1) {
    return { topAttack: [], topDefend: [], topCTR: [], topPotential: [], pages: [], lastFetch: null };
  }

  const qRaw = qSheet.getDataRange().getValues();
  const qH   = qRaw[0].map(String);
  const qRows = qRaw.slice(1);

  const classify = (clicks, impressions, position, ctr) => {
    if (position <= 3 && impressions > 100) return '🛡️防守型';
    if (position > 10 && impressions > 200) return '🚀攻擊型';
    if (position <= 10 && ctr < 0.03)      return '💡CTR優化';
    if (position > 5 && position <= 20)    return '⬆️潛力型';
    return '—';
  };

  const keywords = qRows.map(r => {
    const obj = {};
    qH.forEach((h, i) => { obj[h] = r[i]; });
    const clicks = parseInt(obj['點擊數'] || 0);
    const impr   = parseInt(obj['曝光數'] || 0);
    const pos    = parseFloat(obj['平均排名'] || 99);
    const ctr    = parseFloat(obj['點擊率'] || 0);
    return { keyword: String(obj['關鍵字'] || ''), clicks, impr, pos, ctr, type: classify(clicks, impr, pos, ctr) };
  }).filter(k => k.keyword);

  const top = (type, n) => keywords.filter(k => k.type === type)
    .sort((a, b) => b.impr - a.impr).slice(0, n)
    .map(k => ({ keyword: k.keyword, clicks: k.clicks, impr: k.impr, pos: k.pos.toFixed(1), ctr: (k.ctr * 100).toFixed(1) + '%' }));

  const pages = pSheet ? (() => {
    const pRaw = pSheet.getDataRange().getValues();
    const pH = pRaw[0].map(String);
    return pRaw.slice(1).map(r => {
      const obj = {};
      pH.forEach((h, i) => { obj[h] = r[i]; });
      return { url: String(obj['頁面'] || ''), clicks: parseInt(obj['點擊數'] || 0), impr: parseInt(obj['曝光數'] || 0) };
    }).filter(p => p.url).sort((a, b) => b.clicks - a.clicks).slice(0, 50);
  })() : [];

  const lastFetch = qSheet.getRange(2, 1).getValue();
  return {
    topAttack:    top('🚀攻擊型', 20),
    topDefend:    top('🛡️防守型', 20),
    topCTR:       top('💡CTR優化', 20),
    topPotential: top('⬆️潛力型', 20),
    pages, lastFetch
  };
}

function fetchGSCData() {
  const token = ScriptApp.getOAuthToken();
  const now   = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm');
  const endDate   = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
  const startDate = Utilities.formatDate(new Date(Date.now() - GSC_CONFIG.DAYS * 86400000), 'UTC', 'yyyy-MM-dd');

  function _fetchAllRows(dimension) {
    const all = []; let startRow = 0;
    while (all.length < GSC_CONFIG.MAX_ROWS) {
      const payload = {
        startDate, endDate,
        dimensions: [dimension],
        rowLimit: GSC_CONFIG.ROW_LIMIT,
        startRow,
      };
      const resp = UrlFetchApp.fetch(
        'https://www.googleapis.com/webmasters/v3/sites/' +
        encodeURIComponent(GSC_CONFIG.SITE_URL) + '/searchAnalytics/query',
        {
          method: 'post',
          contentType: 'application/json',
          headers: { Authorization: 'Bearer ' + token },
          payload: JSON.stringify(payload),
          muteHttpExceptions: true,
        }
      );
      if (resp.getResponseCode() !== 200) break;
      const data = JSON.parse(resp.getContentText());
      if (!data.rows || data.rows.length === 0) break;
      all.push(...data.rows);
      startRow += data.rows.length;
      if (data.rows.length < GSC_CONFIG.ROW_LIMIT) break;
      Utilities.sleep(500);
    }
    return all;
  }

  const ss = _getSpreadsheet();

  // 關鍵字
  const qRows = _fetchAllRows('query');
  let qSheet = ss.getSheetByName(GSC_CONFIG.SHEET_GSC_QUERY);
  if (!qSheet) qSheet = ss.insertSheet(GSC_CONFIG.SHEET_GSC_QUERY);
  qSheet.clearContents();
  const qH = ['抓取時間', '關鍵字', '點擊數', '曝光數', '點擊率', '平均排名'];
  qSheet.getRange(1, 1, 1, qH.length).setValues([qH]).setBackground('#0f4c81').setFontColor('#fff').setFontWeight('bold');
  if (qRows.length > 0) {
    qSheet.getRange(2, 1, qRows.length, qH.length).setValues(
      qRows.map(r => [now, r.keys[0], r.clicks, r.impressions, r.ctr, r.position])
    );
  }

  // 頁面
  const pRows = _fetchAllRows('page');
  let pSheet = ss.getSheetByName(GSC_CONFIG.SHEET_GSC_PAGE);
  if (!pSheet) pSheet = ss.insertSheet(GSC_CONFIG.SHEET_GSC_PAGE);
  pSheet.clearContents();
  const pH = ['抓取時間', '頁面', '點擊數', '曝光數', '點擊率', '平均排名'];
  pSheet.getRange(1, 1, 1, pH.length).setValues([pH]).setBackground('#0f4c81').setFontColor('#fff').setFontWeight('bold');
  if (pRows.length > 0) {
    pSheet.getRange(2, 1, pRows.length, pH.length).setValues(
      pRows.map(r => [now, r.keys[0], r.clicks, r.impressions, r.ctr, r.position])
    );
  }

  return { ok: true, queryCount: qRows.length, pageCount: pRows.length };
}

// ============================================================
// GA4 Module（佔位符 — PROPERTY_ID 空時回傳空資料）
// ============================================================
function getGA4EngineData() {
  if (!GA4_CONFIG.PROPERTY_ID) {
    return {
      overview: [], topPages: [], events: [],
      note: 'GA4 尚未設定 PROPERTY_ID，請建立 GA4 Property 後填入 GA4_CONFIG.PROPERTY_ID'
    };
  }
  // 待 GA4 Property 建立後啟用以下邏輯
  // （架構同滿屋 GA4 Module，留白供後續填入）
  return { overview: [], topPages: [], events: [] };
}

function fetchGA4Data() {
  if (!GA4_CONFIG.PROPERTY_ID) {
    return { ok: false, note: 'GA4 PROPERTY_ID 未設定' };
  }
  return { ok: false, note: 'GA4 Module 待啟用' };
}

// ============================================================
// snippet 健康度檢查（南坡萬初期暫時為空）
// ============================================================
function checkSnippetHealth() {
  const results = {};
  for (const [key, cfg] of Object.entries(CONFIG.KNOWN_SNIPPETS)) {
    try {
      const url  = CONFIG.SITE_URL + cfg.checkPage;
      const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      results[key] = {
        name:    cfg.name,
        healthy: resp.getResponseCode() === 200 && resp.getContentText().includes(cfg.checkPattern),
        url
      };
    } catch (e) {
      results[key] = { name: cfg.name, healthy: false, error: e.message };
    }
  }
  const allHealthy = Object.values(results).every(r => r.healthy);
  return { allHealthy, results };
}

// ============================================================
// verifyTask — 單一頁面快速驗證
// ============================================================
function verifyTask(url, checkType) {
  if (!url) return { ok: false, error: 'url 參數必填' };
  try {
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const code = resp.getResponseCode();
    if (code !== 200) return { ok: false, code, url };
    const html = resp.getContentText('UTF-8');
    switch (checkType) {
      case 'product_schema':  return { ok: html.includes('"@type":"Product"'), url, checkType };
      case 'breadcrumb':      return { ok: html.includes('"@type":"BreadcrumbList"'), url, checkType };
      case 'organization':    return { ok: html.includes('"@type":"Organization"'), url, checkType };
      case 'title':           return { ok: !!html.match(/<title[^>]*>[^<]+<\/title>/i), url, checkType };
      case 'meta_desc':       return { ok: !!html.match(/name=["']description["']/i), url, checkType };
      case 'bilingual':       return checkBilingualCoverage();
      default:                return { ok: true, code, url, checkType: 'generic' };
    }
  } catch (e) {
    return { ok: false, error: e.message, url };
  }
}
