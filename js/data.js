/* ===== 荷包記 → 記賬本 · data.js =====
 * 資料層：結構、預設資料、儲存、合併、統計工具
 */
(function (global) {
  'use strict';

  const KEY = 'hkb_ledger_v1';
  const SCHEMA = 2;

  /* ---------- 小工具 ---------- */
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function ymOf(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }
  function today() { return ymd(new Date()); }
  function thisMonth() { return ymOf(new Date()); }
  function nowMs() { return Date.now(); }
  function daysInMonth(ym) {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }
  function shiftMonth(ym, delta) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return ymOf(d);
  }
  function fmtMoney(n, forceDec) {
    n = Number(n) || 0;
    const neg = n < 0;
    const v = Math.abs(n);
    const dec = forceDec || Math.abs(v % 1) > 0.004 ? 2 : 0;
    const s = v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return (neg ? '-' : '') + '$' + s;
  }
  function fmtShort(n) {
    n = Number(n) || 0;
    const a = Math.abs(n);
    if (a >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (a >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(Math.round(n));
  }
  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function monthLabel(ym) {
    const [y, m] = ym.split('-');
    return y + ' 年 ' + Number(m) + ' 月';
  }
  function dateLabel(ds) {
    const [y, m, d] = ds.split('-').map(Number);
    const wd = ['日', '一', '二', '三', '四', '五', '六'];
    const dt = new Date(y, m - 1, d);
    return m + ' 月 ' + d + ' 日（星期' + wd[dt.getDay()] + '）';
  }

  /* ---------- 預設錢包 ---------- */
  const SEED_WALLETS = [
    { id: 'w_cash',      name: '現金',        type: 'cash',          icon: '💵', color: '#4ade80', opening: 0 },
    { id: 'w_cash_cny',  name: '人民幣現金',  type: 'cash',          icon: '💴', color: '#eab308', opening: 0, currency: 'CNY' },
    { id: 'w_octopus',   name: '八達通',      type: 'octopus',       icon: '🐙', color: '#f97316', opening: 0 },
    { id: 'w_octo_m',    name: '手機八達通',  type: 'octopus',       icon: '📱', color: '#fb923c', opening: 0 },
    { id: 'w_octo_w',    name: '八達通銀包',  type: 'emoney',        icon: '👛', color: '#f59e0b', opening: 0 },
    { id: 'w_payme',     name: 'PayMe',       type: 'emoney',        icon: '💗', color: '#ec4899', opening: 0 },
    { id: 'w_alipayhk',  name: 'AlipayHK',    type: 'emoney',        icon: '🔵', color: '#1677ff', opening: 0 },
    { id: 'w_wechat',    name: 'WeChat Pay HK', type: 'emoney',      icon: '🟢', color: '#22c55e', opening: 0 },
    { id: 'w_wechat_cn', name: '微信支付（大陸）', type: 'emoney',    icon: '💬', color: '#17b26a', opening: 0, currency: 'CNY' },
    { id: 'w_alipay_cn', name: '支付寶（大陸）', type: 'emoney',      icon: '🅰️', color: '#0b84ff', opening: 0, currency: 'CNY' },
    { id: 'w_bocpay',    name: 'BoC Pay',     type: 'emoney',        icon: '🏦', color: '#c8102e', opening: 0 },
    { id: 'w_tapngo',    name: 'Tap & Go',    type: 'emoney',        icon: '📶', color: '#e11d48', opening: 0 },
    { id: 'w_unionpay',  name: '雲閃付',      type: 'emoney',        icon: '⭐', color: '#dc2626', opening: 0 },
    { id: 'w_fps',       name: '轉數快轉賬',  type: 'bank',          icon: '⚡', color: '#38bdf8', opening: 0 },
    { id: 'w_hsbc',      name: '匯豐銀行',    type: 'bank',          icon: '🦁', color: '#db0011', opening: 0 },
    { id: 'w_boc',       name: '中銀香港',    type: 'bank',          icon: '🏛️', color: '#d21f2c', opening: 0 },
    { id: 'w_hangsen',   name: '恒生銀行',    type: 'bank',          icon: '🟩', color: '#00a650', opening: 0 },
    { id: 'w_mox',       name: 'Mox Bank',    type: 'bank',          icon: '🟣', color: '#6d28d9', opening: 0 },
    { id: 'w_za',        name: 'ZA Bank',     type: 'bank',          icon: '🔷', color: '#2563eb', opening: 0 },
    { id: 'w_cc_hsbc',   name: '匯豐信用卡',  type: 'credit',        icon: '💳', color: '#b91c1c', opening: 0 },
    { id: 'w_cc_boc',    name: '中銀信用卡',  type: 'credit',        icon: '💳', color: '#9f1239', opening: 0 }
  ];

  const WALLET_TYPES = [
    { id: 'cash',    label: '現金' },
    { id: 'octopus', label: '八達通' },
    { id: 'emoney',  label: '電子錢包' },
    { id: 'bank',    label: '銀行戶口' },
    { id: 'credit',  label: '信用卡' },
    { id: 'other',   label: '其他' }
  ];

  /* ---------- 預設分類 ---------- */
  const PALETTE_CAT = ['#f97316', '#ef4444', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
    '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e'];

  const SEED_CATS = [
    ['c_food',    '餐飲',      '🍜', 0],
    ['c_breakfast', '早餐',    '🥐', 2],
    ['c_lunch',   '午餐',      '🍱', 2],
    ['c_dinner',  '晚餐',      '🍲', 2],
    ['c_supper',  '宵夜',      '🌙', 3],
    ['c_drink',   '飲品',      '🧋', 3],
    ['c_takeaway','外賣',      '🛵', 3],
    ['c_transport','交通',     '🚇', 7],
    ['c_mtr',     '港鐵',      '🚇', 7],
    ['c_bus',     '巴士',      '🚌', 7],
    ['c_minibus', '小巴',      '🚐', 7],
    ['c_taxi',    '的士',      '🚕', 7],
    ['c_ferry',   '渡輪',      '⛴️', 8],
    ['c_shop',    '購物',      '🛍️', 9],
    ['c_digital', '電子產品',  '📱', 9],
    ['c_daily',   '日用品',    '🧴', 10],
    ['c_cloth',   '服飾',      '👕', 10],
    ['c_fun',     '娛樂',      '🎮', 11],
    ['c_movie',   '電影',      '🎬', 11],
    ['c_study',   '學習',      '📚', 12],
    ['c_tutor',   '補習',      '📝', 12],
    ['c_book',    '書籍',      '📖', 12],
    ['c_stationery', '文具',   '✏️', 13],
    ['c_phone',   '通訊',      '📡', 4],
    ['c_sub',     '訂閱服務',  '🔁', 4],
    ['c_utility', '水電煤',    '💡', 5],
    ['c_rent',    '租金',      '🏠', 5],
    ['c_medical', '醫療',      '💊', 6],
    ['c_gift',    '人情禮物',  '🎁', 13],
    ['c_travel',  '旅遊',      '✈️', 8],
    ['c_sport',   '運動',      '🏃', 6],
    ['c_pet',     '寵物',      '🐾', 11],
    ['c_save',    '儲蓄投資',  '📈', 5],
    ['c_tax',     '稅款',      '🧾', 1],
    ['c_other',   '其他',      '❓', 1]
  ];

  const SEED_INCOME = [
    ['i_allowance', '零用錢',  '🧧', 1],
    ['i_job',       '兼職',    '💼', 9],
    ['i_interest',  '利息',    '🏦', 8],
    ['i_refund',    '退款',    '↩️', 6],
    ['i_gift',      '禮金',    '🎁', 13],
    ['i_other',     '其他',    '💰', 1]
  ];

  function buildCats() {
    const out = [];
    SEED_CATS.forEach(function (c) {
      out.push({ id: c[0], name: c[1], icon: c[2], color: PALETTE_CAT[c[3] % PALETTE_CAT.length], kind: 'expense' });
    });
    SEED_INCOME.forEach(function (c) {
      out.push({ id: c[0], name: c[1], icon: c[2], color: PALETTE_CAT[c[3] % PALETTE_CAT.length], kind: 'income' });
    });
    return out;
  }

  const RATES = { HKD: 1, CNY: 1.09, JPY: 0.052, KRW: 0.0057, TWD: 0.245, THB: 0.22, USD: 7.8, GBP: 9.9, EUR: 8.5, SGD: 5.8, MYR: 1.75 };

  function freshData() {
    return {
      schema: SCHEMA,
      updatedAt: nowMs(),
      settingsUpdatedAt: nowMs(),
      wallets: SEED_WALLETS.map(function (w) {
        return Object.assign({}, w, { updatedAt: 1, deleted: false, currency: w.currency || 'HKD', note: '' });
      }),
      categories: buildCats().map(function (c) { return Object.assign({}, c, { updatedAt: 1, deleted: false }); }),
      txns: [],
      budgets: [],
      groups: [],
      settings: {
        theme: 'dark',
        baseCurrency: 'HKD',
        rates: Object.assign({}, RATES),
        ratesUpdatedAt: 0,
        pin: '',
        defaultWallet: 'w_octopus',
        lastMonth: thisMonth(),
        sync: { token: '', gistId: '', auto: true, lastSync: 0 },
        onboarded: false
      }
    };
  }

  /* ---------- 儲存 ---------- */
  let DB = null;
  let saveTimer = null;

  const Store = {
    get: function () { return DB; },
    load: function () {
      let raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          DB = migrate(parsed);
        } catch (e) {
          console.error('讀取資料失敗', e);
          DB = freshData();
        }
      } else {
        DB = freshData();
      }
      return DB;
    },
    save: function (opts) {
      if (!DB) return;
      DB.updatedAt = nowMs();
      try {
        localStorage.setItem(KEY, JSON.stringify(DB));
      } catch (e) {
        console.error('儲存失敗', e);
        if (global.UI && UI.toast) UI.toast('儲存空間不足，請先匯出備份');
        return;
      }
      if (!opts || !opts.silent) {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
          if (global.Sync && Sync.schedule) Sync.schedule();
        }, 1500);
      }
    },
    replace: function (data) { DB = migrate(data); },
    reset: function () { DB = freshData(); Store.save(); },
    exportJSON: function () { return JSON.stringify(DB, null, 2); },
    importJSON: function (text) {
      const obj = JSON.parse(text);
      if (!obj || !Array.isArray(obj.txns)) throw new Error('檔案格式不正確');
      DB = migrate(obj);
      Store.save();
      return DB;
    }
  };

  function migrate(d) {
    const base = freshData();
    const out = Object.assign({}, base, d);
    out.wallets = (Array.isArray(d.wallets) ? d.wallets : base.wallets).slice();
    out.categories = Array.isArray(d.categories) ? d.categories : base.categories;
    out.txns = Array.isArray(d.txns) ? d.txns : [];
    out.budgets = Array.isArray(d.budgets) ? d.budgets : [];
    out.groups = Array.isArray(d.groups) ? d.groups : [];
    out.settings = Object.assign({}, base.settings, d.settings || {});
    out.settings.rates = Object.assign({}, base.settings.rates, (d.settings || {}).rates || {});
    out.settings.sync = Object.assign({}, base.settings.sync, (d.settings || {}).sync || {});
    // v2：補回新增的支付方式（只執行一次）
    if (!out.settings.seededV2) {
      const have = {};
      out.wallets.forEach(function (w) { have[w.id] = true; });
      SEED_WALLETS.forEach(function (w) {
        if (!have[w.id]) {
          out.wallets.push(Object.assign({}, w, {
            updatedAt: nowMs(), deleted: false, currency: w.currency || 'HKD', note: ''
          }));
        }
      });
      out.settings.seededV2 = true;
    }
    out.schema = SCHEMA;
    return out;
  }

  /* ---------- 讀取（過濾墓碑） ---------- */
  function live(list) { return (list || []).filter(function (x) { return !x.deleted; }); }

  const Data = {
    wallets: function () { return live(DB.wallets); },
    wallet: function (id) {
      const w = (DB.wallets || []).find(function (x) { return x.id === id; });
      return w || { id: id, name: '（已刪除）', icon: '❓', color: '#667085', type: 'other', opening: 0 };
    },
    categories: function (kind) {
      return live(DB.categories).filter(function (c) { return !kind || c.kind === kind; });
    },
    category: function (id) {
      const c = (DB.categories || []).find(function (x) { return x.id === id; });
      return c || { id: id, name: '其他', icon: '❓', color: '#667085', kind: 'expense' };
    },
    txns: function () {
      return live(DB.txns).slice().sort(function (a, b) {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    },
    txnsOfMonth: function (ym) {
      return Data.txns().filter(function (t) { return t.date.slice(0, 7) === ym; });
    },
    budget: function (categoryId) {
      const b = (DB.budgets || []).find(function (x) { return x.categoryId === categoryId && !x.deleted; });
      return b ? b.amount : 0;
    },
    budgets: function () { return live(DB.budgets); },
    groups: function () { return live(DB.groups); },
    group: function (id) { return (DB.groups || []).find(function (g) { return g.id === id && !g.deleted; }); },

    /* 新增一筆 */
    addTxn: function (t) {
      const rec = {
        id: t.id || uid('t'),
        type: t.type || 'expense',          // expense | income | transfer
        amount: round2(t.amount),
        currency: t.currency || 'HKD',
        rate: t.rate || 1,
        hkd: round2(t.hkd != null ? t.hkd : (t.amount * (t.rate || 1))),
        date: t.date || today(),
        categoryId: t.categoryId || '',
        walletId: t.walletId || '',
        toWalletId: t.toWalletId || '',
        note: t.note || '',
        tags: t.tags || [],
        reconciled: !!t.reconciled,
        createdAt: t.createdAt || nowMs(),
        updatedAt: nowMs(),
        deleted: false
      };
      DB.txns.push(rec);
      Store.save();
      return rec;
    },
    updateTxn: function (id, patch) {
      const t = DB.txns.find(function (x) { return x.id === id; });
      if (!t) return null;
      Object.assign(t, patch);
      t.updatedAt = nowMs();
      if (patch.amount != null || patch.rate != null) {
        t.hkd = round2((t.amount || 0) * (t.rate || 1));
      }
      Store.save();
      return t;
    },
    removeTxn: function (id) {
      const t = DB.txns.find(function (x) { return x.id === id; });
      if (!t) return;
      t.deleted = true;
      t.updatedAt = nowMs();
      Store.save();
    },

    /* 錢包餘額（以某日之前的全部記錄計算） */
    walletBalance: function (walletId, uptoDate) {
      const w = Data.wallet(walletId);
      let bal = Number(w.opening) || 0;
      Data.txns().forEach(function (t) {
        if (uptoDate && t.date > uptoDate) return;
        if (t.type === 'income' && t.walletId === walletId) bal += t.hkd;
        else if (t.type === 'expense' && t.walletId === walletId) bal -= t.hkd;
        else if (t.type === 'transfer') {
          if (t.walletId === walletId) bal -= t.hkd;
          if (t.toWalletId === walletId) bal += t.hkd;
        }
      });
      return round2(bal);
    },

    /* 按條件彙總 */
    summary: function (list) {
      let income = 0, expense = 0;
      list.forEach(function (t) {
        if (t.type === 'income') income += t.hkd;
        else if (t.type === 'expense') expense += t.hkd;
      });
      return { income: round2(income), expense: round2(expense), net: round2(income - expense) };
    },
    byCategory: function (list, kind) {
      const map = {};
      list.forEach(function (t) {
        if (t.type !== (kind || 'expense')) return;
        const k = t.categoryId || 'c_other';
        map[k] = (map[k] || 0) + t.hkd;
      });
      return Object.keys(map).map(function (k) {
        const c = Data.category(k);
        return { id: k, name: c.name, icon: c.icon, color: c.color, value: round2(map[k]) };
      }).sort(function (a, b) { return b.value - a.value; });
    },
    byWallet: function (list, kind) {
      const map = {};
      list.forEach(function (t) {
        if (kind && t.type !== kind) return;
        if (kind === undefined && t.type === 'transfer') return;
        const k = t.walletId || '';
        map[k] = (map[k] || 0) + t.hkd;
      });
      return Object.keys(map).map(function (k) {
        const w = Data.wallet(k);
        return { id: k, name: w.name, icon: w.icon, color: w.color, value: round2(map[k]) };
      }).sort(function (a, b) { return b.value - a.value; });
    },
    dailyTotals: function (list, ym) {
      const days = daysInMonth(ym);
      const arr = new Array(days).fill(0);
      list.forEach(function (t) {
        if (t.type !== 'expense') return;
        const d = Number(t.date.slice(8, 10));
        if (d >= 1 && d <= days) arr[d - 1] += t.hkd;
      });
      return arr;
    }
  };

  /* ---------- 合併（同步用） ---------- */
  const COLLS = ['wallets', 'categories', 'txns', 'budgets', 'groups'];

  function mergeDocs(a, b) {
    const out = (a || []).slice();
    const index = {};
    out.forEach(function (r, i) { index[r.id] = i; });
    (b || []).forEach(function (r) {
      if (!r || !r.id) return;
      if (index[r.id] === undefined) {
        index[r.id] = out.length;
        out.push(r);
      } else {
        const cur = out[index[r.id]];
        if ((r.updatedAt || 0) > (cur.updatedAt || 0)) out[index[r.id]] = r;
      }
    });
    return out;
  }

  function mergeData(local, remote) {
    if (!remote) return local;
    const out = mergeData_raw(local || {}, remote);
    return migrate(out);
  }
  function mergeData_raw(local, remote) {
    const out = {};
    COLLS.forEach(function (c) { out[c] = mergeDocs(local[c], remote[c]); });
    const ls = local.settings || {};
    const rs = remote.settings || {};
    const localNewer = (local.settingsUpdatedAt || 0) >= (remote.settingsUpdatedAt || 0);
    const pick = localNewer ? ls : rs;
    const other = localNewer ? rs : ls;
    out.settings = Object.assign({}, other, pick);
    // 同步憑證永遠以本機為準，避免互相覆蓋
    out.settings.sync = Object.assign({}, pick.sync || {}, (local.settings || {}).sync || {});
    out.settings.pin = (local.settings || {}).pin || '';
    out.settingsUpdatedAt = Math.max(local.settingsUpdatedAt || 0, remote.settingsUpdatedAt || 0);
    out.updatedAt = Math.max(local.updatedAt || 0, remote.updatedAt || 0);
    out.schema = SCHEMA;
    return out;
  }

  /* ---------- 內建自然語言解析 ---------- */
  const CAT_WORDS = [
    [/(早餐|早飯)/, 'c_breakfast'], [/(午餐|午飯|lunch)/i, 'c_lunch'], [/(晚餐|晚飯|dinner)/i, 'c_dinner'],
    [/(宵夜|夜宵|夜食)/, 'c_supper'], [/(咖啡|奶茶|飲品|飲料|starbucks|星巴克|手搖)/i, 'c_drink'],
    [/(外賣|外送|foodpanda|deliveroo|keeta)/i, 'c_takeaway'],
    [/(港鐵|地鐵|mtr|地铁)/i, 'c_mtr'], [/(巴士|bus)/i, 'c_bus'], [/(小巴|van仔)/, 'c_minibus'],
    [/(的士|taxi|uber|滴滴)/i, 'c_taxi'], [/(渡輪|船|ferry)/i, 'c_ferry'], [/(交通|車費)/, 'c_transport'],
    [/(書|課本|教科書)/, 'c_book'], [/(補習|tutor)/i, 'c_tutor'], [/(文具|筆)/, 'c_stationery'],
    [/(學費|學習|課程)/, 'c_study'], [/(電影|戲票)/, 'c_movie'], [/(遊戲|game)/i, 'c_fun'],
    [/(娛樂|唱k|karaoke)/i, 'c_fun'], [/(電話費|月費|data)/i, 'c_phone'],
    [/(訂閱|netflix|spotify|youtube|icloud|chatgpt)/i, 'c_sub'],
    [/(水費|電費|煤氣|水電)/, 'c_utility'], [/(租金|租屋|房租)/, 'c_rent'],
    [/(藥|醫生|診所|醫療|hospital)/i, 'c_medical'], [/(禮物|生日|人情|禮金支出)/, 'c_gift'],
    [/(旅行|機票|酒店|旅遊)/, 'c_travel'], [/(波鞋|球鞋|運動|gym|健身)/i, 'c_sport'],
    [/(寵物|貓糧|狗糧)/, 'c_pet'], [/(股票|基金|儲蓄|投資)/, 'c_save'],
    [/(稅|報稅)/, 'c_tax'], [/(衫|褲|鞋|衣服|服飾)/, 'c_cloth'],
    [/(電子|手機|電腦|耳機|充電)/, 'c_digital'], [/(日用品|紙巾|沐浴|超市|惠康|百佳|wellcome|parknshop)/i, 'c_daily'],
    [/(購物|買)/, 'c_shop'],
    [/(食|飯|餐|麵|粉|包)/, 'c_food']
  ];
  const INCOME_WORDS = [/(零用|家用|零花)/, /(兼職|薪水|人工|糧)/, /(利息|派息)/, /(退款|退貨)/];
  const TYPE_INCOME_HINT = /(收入|收到|賺|入賬|入帳)/;

  function parseNL(text) {
    const src = String(text || '').trim();
    if (!src) return null;
    const res = { amount: 0, categoryId: '', walletId: '', note: src, type: 'expense', tags: [] };

    // 金額
    const m = src.match(/(\$|hk\$)?\s*(\d+(?:\.\d{1,2})?)/i);
    if (m) res.amount = parseFloat(m[2]);

    // 錢包（最長匹配優先）
    const wallets = Data.wallets().slice().sort(function (a, b) { return b.name.length - a.name.length; });
    for (let i = 0; i < wallets.length; i++) {
      const w = wallets[i];
      if (src.toUpperCase().indexOf(w.name.toUpperCase()) >= 0) { res.walletId = w.id; break; }
    }
    // 常見別名
    if (!res.walletId) {
      const alias = [[/八達通|octopus/i, 'w_octopus'], [/payme/i, 'w_payme'], [/支付寶|alipay/i, 'w_alipayhk'],
        [/微信|wechat/i, 'w_wechat'], [/現金|cash/i, 'w_cash'], [/信用卡|credit/i, 'w_cc_hsbc'],
        [/轉數快|fps/i, 'w_fps'], [/tap\s*&\s*go/i, 'w_tapngo'], [/雲閃付|unionpay/i, 'w_unionpay'],
        [/中銀|boc/i, 'w_boc'], [/匯豐|hsbc/i, 'w_hsbc'], [/恒生|hang\s*seng/i, 'w_hangsen'], [/mox/i, 'w_mox'], [/za\s*bank/i, 'w_za']];
      for (let i = 0; i < alias.length; i++) {
        if (alias[i][0].test(src)) { const id = alias[i][1]; if (Data.wallet(id).id === id) { res.walletId = id; break; } }
      }
    }

    // 收入
    if (TYPE_INCOME_HINT.test(src) || INCOME_WORDS.some(function (r) { return r.test(src); })) res.type = 'income';

    // 分類
    if (res.type === 'income') {
      if (/(零用|家用|零花)/.test(src)) res.categoryId = 'i_allowance';
      else if (/(兼職|薪水|人工|糧)/.test(src)) res.categoryId = 'i_job';
      else if (/(利息|派息)/.test(src)) res.categoryId = 'i_interest';
      else if (/(退款|退貨)/.test(src)) res.categoryId = 'i_refund';
      else res.categoryId = 'i_other';
    } else {
      for (let i = 0; i < CAT_WORDS.length; i++) {
        if (CAT_WORDS[i][0].test(src)) { res.categoryId = CAT_WORDS[i][1]; break; }
      }
      if (!res.categoryId) res.categoryId = 'c_other';
    }

    // 標籤 #xxx
    const tags = src.match(/#[^\s#]+/g);
    if (tags) res.tags = tags.map(function (t) { return t.slice(1); });

    // 備註：移除金額後的剩餘文字
    res.note = src.replace(/\$?\d+(\.\d{1,2})?/, '').replace(/#[^\s#]+/g, '').trim();
    return res;
  }

  /* ---------- 匯出 ---------- */
  global.Store = Store;
  global.Data = Data;
  global.U = {
    uid: uid, ymd: ymd, ymOf: ymOf, today: today, thisMonth: thisMonth, nowMs: nowMs,
    daysInMonth: daysInMonth, shiftMonth: shiftMonth, fmtMoney: fmtMoney, fmtShort: fmtShort,
    round2: round2, monthLabel: monthLabel, dateLabel: dateLabel, pad2: pad2
  };
  global.DBmerge = { mergeData: mergeData, mergeDocs: mergeDocs, COLLS: COLLS };
  global.NL = { parse: parseNL };
  global.CONST = { WALLET_TYPES: WALLET_TYPES, PALETTE_CAT: PALETTE_CAT, SEED_WALLETS: SEED_WALLETS };
})(window);
