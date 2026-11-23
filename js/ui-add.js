/* ===== 記賬本 · ui-add.js — 記賬頁 ===== */
(function (global) {
  'use strict';

  const CURRENCIES = ['HKD', 'CNY', 'JPY', 'TWD', 'KRW', 'THB', 'USD', 'GBP', 'EUR', 'SGD', 'MYR'];
  const SYM = { HKD: 'HK$', CNY: '¥', JPY: '¥', TWD: 'NT$', KRW: '₩', THB: '฿', USD: 'US$', GBP: '£', EUR: '€', SGD: 'S$', MYR: 'RM' };

  function draft() { return UI.state.addDraft; }

  function recentCatIds(kind) {
    const counts = {};
    Data.txns().slice(0, 120).forEach(function (t) {
      if (t.type === kind && t.categoryId) counts[t.categoryId] = (counts[t.categoryId] || 0) + 1;
    });
    return Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 4);
  }

  /* 分類次序由「設定 → 排序」決定 */
  function orderedCats(kind) {
    return Data.categories(kind);
  }

  const SHOW_CUR = ['HKD', 'CNY', 'JPY', 'USD', 'TWD'];
  const SYM_TAG = { HKD: 'HK$', CNY: 'CN¥', JPY: 'JP¥', USD: 'US$', TWD: 'NT$', KRW: '₩', THB: '฿', GBP: '£', EUR: '€', SGD: 'S$', MYR: 'RM' };

  function num(v, cur) {
    if (cur === 'JPY' || cur === 'KRW') return Math.round(v).toLocaleString('en-US');
    if (v >= 10000) return Math.round(v).toLocaleString('en-US');
    if (v >= 100) return v.toFixed(1);
    return v.toFixed(2);
  }

  /* 輸入金額即時換算成其他貨幣 */
  /* 本月還可以花多少 */
  function budgetLine() {
    const total = Data.budgetTotal();
    if (!total) return '';
    const ym = U.thisMonth();
    const sum = Data.summary(Data.txnsOfMonth(ym));
    const leftAmt = U.round2(total - sum.expense);
    const today = new Date();
    const days = U.daysInMonth(ym);
    const remain = Math.max(1, days - today.getDate() + 1);
    const perDay = leftAmt > 0 ? U.round2(leftAmt / remain) : 0;
    const cls = leftAmt < 0 ? 'warn' : '';
    return '本月剩 <b class="' + cls + '">' + U.fmtMoney(leftAmt) + '</b>　·　每日可花 <b class="' + cls + '">' +
      U.fmtMoney(perDay) + '</b>';
  }

  function convText() {
    const d = draft();
    const amt = parseFloat(d.amount) || 0;
    if (!amt) return '';
    const rates = Store.get().settings.rates || {};
    const cur = d.currency || 'HKD';
    const toHkd = cur === 'HKD' ? 1 : (Number(rates[cur]) || 1);
    const hkd = amt * toHkd;
    const out = [];
    SHOW_CUR.forEach(function (t) {
      if (t === cur) return;
      const r = Number(rates[t]) || 1;      // 1 單位 t = r HKD
      const v = hkd / r;
      out.push('<span class="cv' + (t === 'HKD' ? ' hl' : '') + '">' +
        (SYM_TAG[t] || t + ' ') + num(v, t) + '</span>');
    });
    return out.slice(0, 4).join('');
  }

  /* 換算說明（原幣 → 港幣） */
  function convNote() {
    const d = draft();
    const amt = parseFloat(d.amount) || 0;
    const cur = d.currency || 'HKD';
    if (!amt || cur === 'HKD') return '';
    const rate = Number((Store.get().settings.rates || {})[cur]) || 1;
    return '按今日匯率 1 ' + cur + ' ≈ HK$' + rate + '　·　合共 ' +
      U.fmtMoney(Math.round(amt * rate * 100) / 100, true);
  }

  function amountText() {
    const d = draft();
    const v = d.amount === '' ? '0' : d.amount;
    return v;
  }

  function rowExpense() {
    const d = draft();
    return tplRow() +
      '<div class="h-sec">分類</div>' +
      UI.chipRow(orderedCats('expense'), d.categoryId, 'c') +
      '<div class="h-sec">錢包</div>' +
      UI.chipRow(Data.wallets(), d.walletId, 'w');
  }

  /* 常用範本：最近重複出現的組合 */
  function tplRow() {
    const d = draft();
    if (d.type !== 'expense') return '';
    const map = {};
    Data.txns().slice(0, 150).forEach(function (t) {
      if (t.type !== 'expense') return;
      const k = t.categoryId + '|' + t.walletId + '|' + t.hkd;
      map[k] = (map[k] || 0) + 1;
    });
    const keys = Object.keys(map).filter(function (k) { return map[k] >= 2; })
      .sort(function (a, b) { return map[b] - map[a]; }).slice(0, 5);
    if (!keys.length) return '';
    let s = '<div class="h-sec" style="margin-top:6px">常用</div><div class="chips">';
    keys.forEach(function (k) {
      const p = k.split('|');
      const c = Data.category(p[0]);
      s += '<button class="chip" data-tpl="' + k + '"><span class="ci">' + esc(c.icon) + '</span>' +
        esc(c.name) + ' ' + U.fmtMoney(Number(p[2])) + '</button>';
    });
    return s + '</div>';
  }

  function rowIncome() {
    const d = draft();
    return '<div class="h-sec">分類</div>' +
      UI.chipRow(orderedCats('income'), d.categoryId, 'c') +
      '<div class="h-sec">存入</div>' +
      UI.chipRow(Data.wallets(), d.walletId, 'w');
  }

  function rowTransfer() {
    const d = draft();
    return '<div class="h-sec">由</div>' +
      UI.chipRow(Data.wallets(), d.walletId, 'w') +
      '<div class="h-sec">轉到</div>' +
      UI.chipRow(Data.wallets(), d.toWalletId, 'tw');
  }

  UI.screens.add = function () {
    const d = draft();
    if (!d.walletId) d.walletId = Store.get().settings.defaultWallet || 'w_octopus';
    if (!d.categoryId) d.categoryId = 'c_food';
    if (!d.currency) d.currency = (Data.wallet(d.walletId).currency) || 'HKD';

    const typeRow = '<div class="seg">' +
      ['expense', 'income', 'transfer'].map(function (t) {
        const label = t === 'expense' ? '支出' : t === 'income' ? '收入' : '轉賬';
        return '<button data-t="' + t + '" class="' + (d.type === t ? 'on' : '') + '">' + label + '</button>';
      }).join('') + '</div>';

    const amountBox = '<div class="amount-box" id="amtBox">' +
      '<span class="cur" id="curBtn" style="text-decoration:underline dotted;text-underline-offset:4px">' +
      esc(SYM[d.currency] || d.currency) + '</span>' +
      '<span class="val ' + (amountText() === '0' ? 'zero' : '') + '" id="amtVal">' + esc(amountText()) + '</span>' +
      '</div>';

    const left = budgetLine();
    const conv = (left ? '<div class="spend-left">' + left + '</div>' : '') +
      '<div class="conv-row" id="convRow">' + convText() + '</div>' +
      '<div class="conv-note" id="convLine">' + convNote() + '</div>';

    const nl = '<div class="nlbar"><button class="nl-scan" id="scanBtn" title="掃描賬單">📷</button>' +
      '<input id="nlInput" type="text" placeholder="一句記賬：午餐 45 八達通" autocomplete="off">' +
      '<button id="nlGo">記</button></div>';

    const body = d.type === 'transfer' ? rowTransfer() : (d.type === 'income' ? rowIncome() : rowExpense());

    const meta = '<div class="meta-grid">' +
      '<div><label class="fl">日期</label><input type="date" id="dateIn" value="' + esc(d.date) + '"></div>' +
      '<div><label class="fl">備註</label><input type="text" id="noteIn" placeholder="例如 與同學午餐" value="' + esc(d.note) + '"></div>' +
      '<div class="full"><label class="fl">標籤（以逗號分隔）</label><input type="text" id="tagIn" placeholder="例如 學校, 聚會" value="' + esc((d.tags || []).join(', ')) + '"></div>' +
      '</div>';

    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
    const keypad = '<div class="keywrap"><div class="keypad" id="keypad">' +
      keys.map(function (k) { return '<button class="key" data-k="' + k + '">' + k + '</button>'; }).join('') +
      '</div><button class="save-btn" id="saveBtn">記一筆</button></div>';

    return typeRow + amountBox + conv + nl + body + meta + keypad;
  };

  UI.afterRenderHooks = UI.afterRenderHooks || {};
  UI.afterRenderHooks.add = function () {
    const d = draft();

    $$('.seg [data-t]').forEach(function (b) {
      b.onclick = function () {
        d.type = b.dataset.t;
        if (d.type === 'expense' && Data.category(d.categoryId).kind === 'income') d.categoryId = 'c_food';
        if (d.type === 'income' && Data.category(d.categoryId).kind === 'expense') d.categoryId = 'i_allowance';
        UI.render();
      };
    });

    $$('[data-c]').forEach(function (b) {
      b.onclick = function () { d.categoryId = b.dataset.c; UI.render(); };
    });
    $$('[data-w]').forEach(function (b) {
      b.onclick = function () {
        d.walletId = b.dataset.w;
        // 錢包自帶貨幣：選人民幣錢包就自動用 ¥
        const w = Data.wallet(b.dataset.w);
        if (d.type !== 'transfer') d.currency = w.currency || 'HKD';
        UI.render();
      };
    });
    $$('[data-tw]').forEach(function (b) {
      b.onclick = function () { d.toWalletId = b.dataset.tw; UI.render(); };
    });

    $$('[data-tpl]').forEach(function (b) {
      b.onclick = function () {
        const p = b.dataset.tpl.split('|');
        d.categoryId = p[0];
        d.walletId = p[1];
        d.amount = String(Number(p[2]));
        UI.render();
        UI.toast('已填入常用項目，可再按「記一筆」');
      };
    });

    // 鍵盤
    $$('#keypad [data-k]').forEach(function (b) {
      b.onclick = function () {
        const k = b.dataset.k;
        if (k === '⌫') d.amount = d.amount.slice(0, -1);
        else if (k === '.') { if (d.amount.indexOf('.') < 0) d.amount = (d.amount || '0') + '.'; }
        else {
          if (d.amount === '0') d.amount = k;
          else if (d.amount.replace('.', '').length < 9) d.amount += k;
          // 小數最多兩位
          const parts = d.amount.split('.');
          if (parts[1] && parts[1].length > 2) d.amount = parts[0] + '.' + parts[1].slice(0, 2);
        }
        const el = $('#amtVal');
        if (el) {
          const v = d.amount === '' ? '0' : d.amount;
          el.textContent = v;
          el.classList.toggle('zero', v === '0');
          el.classList.remove('bump');
          void el.offsetWidth;
          el.classList.add('bump');
          setTimeout(function () { el.classList.remove('bump'); }, 180);
        }
        const cr = $('#convRow');
        if (cr) cr.innerHTML = convText();
        const cl = $('#convLine');
        if (cl) cl.textContent = convNote();
        if (navigator.vibrate && k !== '⌫') navigator.vibrate(6);
      };
    });

    $('#saveBtn').onclick = save;

    // 幣種
    const cur = $('#curBtn');
    if (cur) cur.onclick = function () {
      let html = '<h3>選擇貨幣</h3><div class="chips" style="flex-wrap:wrap;overflow:visible;gap:8px">';
      CURRENCIES.forEach(function (c) {
        const r = Store.get().settings.rates[c] || 1;
        html += '<button class="chip' + (c === d.currency ? ' on' : '') + '" data-cc="' + c + '">' +
          esc(SYM[c]) + ' ' + c + (c !== 'HKD' ? '　約 ' + r : '') + '</button>';
      });
      html += '</div><div class="help" style="margin-top:12px">外幣金額會按「設定 → 匯率」換算為港幣記錄。</div>';
      UI.sheet(html, function (root) {
        root.querySelectorAll('[data-cc]').forEach(function (b) {
          b.onclick = function () { d.currency = b.dataset.cc; UI.closeSheet(); UI.render(); };
        });
      });
    };

    // 自然語言
    const nlIn = $('#nlInput');
    if (nlIn) {
      nlIn.onkeydown = function (e) { if (e.key === 'Enter') $('#nlGo').click(); };
      $('#nlGo').onclick = function () {
        const r = NL.parse(nlIn.value);
        if (!r || !r.amount) { UI.toast('請輸入金額，例如：午餐 45 八達通'); return; }
        d.type = r.type;
        d.amount = String(r.amount);
        d.categoryId = r.categoryId || d.categoryId;
        if (r.walletId) d.walletId = r.walletId;
        d.note = r.note || '';
        d.tags = r.tags || [];
        UI.render();
        UI.toast('已自動填入，請確認後儲存');
      };
    }

    const scanBtn = $('#scanBtn');
    if (scanBtn) scanBtn.onclick = function () { UI.openScan(); };

    const dateIn = $('#dateIn');
    if (dateIn) dateIn.onchange = function () { d.date = dateIn.value || U.today(); };
    const noteIn = $('#noteIn');
    if (noteIn) noteIn.onchange = function () { d.note = noteIn.value.trim(); };
    const tagIn = $('#tagIn');
    if (tagIn) tagIn.onchange = function () {
      d.tags = tagIn.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    };
  };

  function save() {
    const d = draft();
    const amt = parseFloat(d.amount);
    if (!amt || amt <= 0) { UI.toast('請先輸入金額'); return; }
    const rates = Store.get().settings.rates || {};
    const rate = d.currency === 'HKD' ? 1 : (Number(rates[d.currency]) || 1);

    if (d.type === 'transfer') {
      if (!d.walletId || !d.toWalletId) { UI.toast('請選擇由哪個錢包轉到哪個錢包'); return; }
      if (d.walletId === d.toWalletId) { UI.toast('轉出與轉入錢包不可相同'); return; }
      Data.addTxn({
        type: 'transfer', amount: amt, currency: d.currency, rate: rate,
        hkd: U.round2(amt * rate), date: d.date, walletId: d.walletId, toWalletId: d.toWalletId,
        note: d.note, tags: d.tags
      });
    } else {
      if (!d.categoryId) { UI.toast('請選擇分類'); return; }
      if (!d.walletId) { UI.toast('請選擇錢包'); return; }
      Data.addTxn({
        type: d.type, amount: amt, currency: d.currency, rate: rate,
        hkd: U.round2(amt * rate), date: d.date, categoryId: d.categoryId,
        walletId: d.walletId, note: d.note, tags: d.tags
      });
    }

    // 重設（保留分類與錢包，方便連續記賬）
    d.amount = '';
    d.note = '';
    d.tags = [];
    d.date = U.today();
    Store.get().settings.defaultWallet = d.walletId;
    Store.get().settingsUpdatedAt = U.nowMs();
    Store.save();
    UI.render();
    UI.toast('已記錄 ' + U.fmtMoney(amt) + ' · 可繼續記下一筆');
    if (navigator.vibrate) navigator.vibrate(18);
  }

  global.__addCurrencies = CURRENCIES;
})(window);
