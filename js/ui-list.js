/* ===== 記賬本 · ui-list.js — 記錄頁 ===== */
(function (global) {
  'use strict';

  UI.state.listQuery = '';
  UI.state.listCat = '';
  UI.state.listWallet = '';

  function matches(t) {
    const q = UI.state.listQuery.trim().toLowerCase();
    if (UI.state.listCat && t.categoryId !== UI.state.listCat) return false;
    if (UI.state.listWallet && t.walletId !== UI.state.listWallet) return false;
    if (!q) return true;
    const c = Data.category(t.categoryId);
    const w = Data.wallet(t.walletId);
    const hay = [t.note, c.name, w.name, (t.tags || []).join(' '), String(t.hkd), String(t.amount)].join(' ').toLowerCase();
    return hay.indexOf(q) >= 0;
  }

  function txnRow(t) {
    const c = Data.category(t.categoryId);
    const w = Data.wallet(t.walletId);
    let icon = c.icon, title = c.name, sub = w.name;
    let amtCls = 'neg', amtText = '-' + U.fmtMoney(t.hkd);

    if (t.type === 'income') {
      amtCls = 'pos';
      amtText = '+' + U.fmtMoney(t.hkd);
    } else if (t.type === 'transfer') {
      const to = Data.wallet(t.toWalletId);
      icon = '🔄'; title = '轉賬'; sub = w.name + ' → ' + to.name;
      amtCls = 'muted'; amtText = U.fmtMoney(t.hkd);
    }
    if (t.note) title = t.note;
    const meta = [];
    if (t.note) meta.push(c.name);
    meta.push(sub);
    if (t.currency && t.currency !== 'HKD') meta.push(SYM2(t.currency) + t.amount);
    if (t.reconciled) meta.push('已對賬');
    if ((t.tags || []).length) meta.push((t.tags || []).map(function (x) { return '#' + x; }).join(' '));

    return '<div class="txn" data-id="' + t.id + '">' +
      '<div class="ic">' + esc(icon) + '</div>' +
      '<div class="grow"><div class="t1 ellip">' + esc(title) + '</div>' +
      '<div class="t2 ellip">' + esc(meta.join(' · ')) + '</div></div>' +
      '<div class="amt ' + amtCls + '">' + amtText + '</div>' +
      '</div>';
  }
  function SYM2(c) { return { CNY: '¥', JPY: '¥', TWD: 'NT$', KRW: '₩', THB: '฿', USD: 'US$', GBP: '£', EUR: '€', SGD: 'S$', MYR: 'RM' }[c] || c + ' '; }

  UI.screens.list = function () {
    const ym = UI.state.month;
    const all = Data.txnsOfMonth(ym);
    const list = all.filter(matches);
    const sum = Data.summary(all);

    let html = UI.monthNav(ym, 'mnavList');
    html += '<div class="stats3" style="margin-bottom:12px">' +
      UI.statCard('支出', U.fmtMoney(sum.expense), 'neg') +
      UI.statCard('收入', U.fmtMoney(sum.income), 'pos') +
      UI.statCard('結餘', U.fmtMoney(sum.net), sum.net < 0 ? 'neg' : 'pos') +
      '</div>';

    html += '<div class="filters"><input id="qIn" type="search" placeholder="搜尋備註、分類、錢包、金額" value="' + esc(UI.state.listQuery) + '">' +
      '<button class="btn sm" id="filterBtn">篩選' + ((UI.state.listCat || UI.state.listWallet) ? ' •' : '') + '</button></div>';

    if (UI.state.listCat || UI.state.listWallet) {
      html += '<div class="chips" style="margin-bottom:6px">';
      if (UI.state.listCat) {
        html += '<button class="chip on" data-clear="cat">' + esc(Data.category(UI.state.listCat).name) + ' ✕</button>';
      }
      if (UI.state.listWallet) {
        html += '<button class="chip on" data-clear="wallet">' + esc(Data.wallet(UI.state.listWallet).name) + ' ✕</button>';
      }
      html += '</div>';
    }

    if (!list.length) {
      return html + UI.emptyBlock('🗒️', '本月未有記錄', all.length ? '沒有符合篩選的記錄' : '回到「記賬」頁記錄第一筆支出');
    }

    // 按日期分組
    const groups = {};
    list.forEach(function (t) { (groups[t.date] = groups[t.date] || []).push(t); });
    const dates = Object.keys(groups).sort().reverse();

    dates.forEach(function (d) {
      const items = groups[d];
      let dayOut = 0, dayIn = 0;
      items.forEach(function (t) {
        if (t.type === 'expense') dayOut += t.hkd;
        if (t.type === 'income') dayIn += t.hkd;
      });
      html += '<div class="daygroup"><div class="dayhead"><span>' + esc(U.dateLabel(d)) + '</span>' +
        '<span class="daytot">' + (dayOut ? '−' + U.fmtMoney(dayOut) : '') +
        (dayIn ? '　+' + U.fmtMoney(dayIn) : '') + '</span></div>';
      items.forEach(function (t) { html += txnRow(t); });
      html += '</div>';
    });

    return html;
  };

  UI.afterRenderHooks.list = function () {
    UI.bindMonthNav('mnavList', function () { UI.render(); });

    const q = $('#qIn');
    if (q) {
      q.oninput = function () {
        UI.state.listQuery = q.value;
        const pos = q.selectionStart;
        UI.render();
        const q2 = $('#qIn');
        if (q2) { q2.focus(); q2.setSelectionRange(pos, pos); }
      };
    }
    const fb = $('#filterBtn');
    if (fb) fb.onclick = openFilters;
    $$('[data-clear]').forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.clear === 'cat') UI.state.listCat = '';
        else UI.state.listWallet = '';
        UI.render();
      };
    });

    $$('.txn').forEach(function (el) {
      el.onclick = function () { editTxn(el.dataset.id); };
    });
  };

  function openFilters() {
    const cats = Data.categories();
    const ws = Data.wallets();
    let html = '<h3>篩選</h3><div class="h-sec" style="margin-top:0">分類</div>' +
      '<div class="chips" style="flex-wrap:wrap;overflow:visible;gap:8px">' +
      '<button class="chip' + (!UI.state.listCat ? ' on' : '') + '" data-fc="">全部</button>';
    cats.forEach(function (c) {
      html += '<button class="chip' + (UI.state.listCat === c.id ? ' on' : '') + '" data-fc="' + c.id + '">' +
        esc(c.icon) + ' ' + esc(c.name) + '</button>';
    });
    html += '</div><div class="h-sec">錢包</div><div class="chips" style="flex-wrap:wrap;overflow:visible;gap:8px">' +
      '<button class="chip' + (!UI.state.listWallet ? ' on' : '') + '" data-fw="">全部</button>';
    ws.forEach(function (w) {
      html += '<button class="chip' + (UI.state.listWallet === w.id ? ' on' : '') + '" data-fw="' + w.id + '">' +
        esc(w.icon) + ' ' + esc(w.name) + '</button>';
    });
    html += '</div><div class="sheet-actions"><button class="btn primary" id="fDone">完成</button></div>';

    UI.sheet(html, function (root) {
      root.querySelectorAll('[data-fc]').forEach(function (b) {
        b.onclick = function () { UI.state.listCat = b.dataset.fc; UI.closeSheet(); UI.render(); };
      });
      root.querySelectorAll('[data-fw]').forEach(function (b) {
        b.onclick = function () { UI.state.listWallet = b.dataset.fw; UI.closeSheet(); UI.render(); };
      });
      root.querySelector('#fDone').onclick = UI.closeSheet;
    });
  }

  /* ---------- 編輯彈層 ---------- */
  function editTxn(id) {
    const t = Store.get().txns.find(function (x) { return x.id === id; });
    if (!t) return;
    const isTransfer = t.type === 'transfer';
    const cats = Data.categories(t.type === 'income' ? 'income' : 'expense');
    const ws = Data.wallets();

    let html = '<h3>編輯記錄</h3><div class="frm">' +
      '<div class="two"><div><label class="fl">金額</label>' +
      '<input type="number" id="eAmt" step="0.01" value="' + t.amount + '"></div>' +
      '<div><label class="fl">日期</label><input type="date" id="eDate" value="' + t.date + '"></div></div>' +
      '<div><label class="fl">類型</label><select id="eType">' +
      '<option value="expense"' + (t.type === 'expense' ? ' selected' : '') + '>支出</option>' +
      '<option value="income"' + (t.type === 'income' ? ' selected' : '') + '>收入</option>' +
      '<option value="transfer"' + (isTransfer ? ' selected' : '') + '>轉賬</option>' +
      '</select></div>';

    html += '<div id="eCatWrap"' + (isTransfer ? ' style="display:none"' : '') + '>' +
      '<label class="fl">分類</label><select id="eCat">';
    cats.forEach(function (c) {
      html += '<option value="' + c.id + '"' + (c.id === t.categoryId ? ' selected' : '') + '>' + esc(c.icon + ' ' + c.name) + '</option>';
    });
    html += '</select></div>';

    html += '<div><label class="fl">' + (isTransfer ? '由' : '錢包') + '</label><select id="eWal">';
    ws.forEach(function (w) {
      html += '<option value="' + w.id + '"' + (w.id === t.walletId ? ' selected' : '') + '>' + esc(w.icon + ' ' + w.name) + '</option>';
    });
    html += '</select></div>';

    html += '<div id="eToWrap"' + (isTransfer ? '' : ' style="display:none"') + '><label class="fl">轉到</label><select id="eTo">';
    ws.forEach(function (w) {
      html += '<option value="' + w.id + '"' + (w.id === t.toWalletId ? ' selected' : '') + '>' + esc(w.icon + ' ' + w.name) + '</option>';
    });
    html += '</select></div>';

    html += '<div><label class="fl">備註</label><input type="text" id="eNote" value="' + esc(t.note || '') + '"></div>' +
      '<div><label class="fl">標籤（逗號分隔）</label><input type="text" id="eTag" value="' + esc((t.tags || []).join(', ')) + '"></div>' +
      '</div>';

    html += '<div class="sheet-actions"><button class="btn danger" id="eDel">刪除</button>' +
      '<button class="btn primary" id="eSave">儲存</button></div>';

    UI.sheet(html, function (root) {
      const typeSel = root.querySelector('#eType');
      const catSel = root.querySelector('#eCat');
      typeSel.onchange = function () {
        const v = typeSel.value;
        root.querySelector('#eCatWrap').style.display = v === 'transfer' ? 'none' : '';
        root.querySelector('#eToWrap').style.display = v === 'transfer' ? '' : 'none';
        const k = v === 'income' ? 'income' : 'expense';
        catSel.innerHTML = Data.categories(k).map(function (c) {
          return '<option value="' + c.id + '">' + esc(c.icon + ' ' + c.name) + '</option>';
        }).join('');
      };
      root.querySelector('#eDel').onclick = function () {
        UI.closeSheet();
        UI.confirm('刪除這筆記錄？', '此操作會即時生效，無法復原。', function () {
          Data.removeTxn(id);
          UI.render();
          UI.toast('已刪除');
        });
      };
      root.querySelector('#eSave').onclick = function () {
        const amt = parseFloat(root.querySelector('#eAmt').value);
        if (!amt || amt <= 0) { UI.toast('金額不正確'); return; }
        const type = typeSel.value;
        const patch = {
          type: type,
          amount: amt,
          hkd: U.round2(amt * (t.rate || 1)),
          date: root.querySelector('#eDate').value || t.date,
          walletId: root.querySelector('#eWal').value,
          toWalletId: type === 'transfer' ? root.querySelector('#eTo').value : '',
          note: root.querySelector('#eNote').value.trim(),
          tags: root.querySelector('#eTag').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
        };
        if (type !== 'transfer') patch.categoryId = catSel.value;
        Data.updateTxn(id, patch);
        UI.closeSheet();
        UI.render();
        UI.toast('已更新');
      };
    });
  }

  global.__editTxn = editTxn;
})(window);
