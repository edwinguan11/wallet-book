/* ===== 記賬本 · ui-stats.js — 圖表頁 ===== */
(function (global) {
  'use strict';

  UI.state.statsScope = 'expense';

  function ranks(items, total) {
    if (!items.length) return '';
    let s = '<div class="rank">';
    items.slice(0, 8).forEach(function (it) {
      const pct = total > 0 ? (it.value / total) * 100 : 0;
      s += '<div class="rk"><div class="nm ellip">' + esc(it.icon || '') + ' ' + esc(it.name) + '</div>' +
        '<div class="bar"><i style="width:' + Math.max(2, pct).toFixed(1) + '%;background:' + it.color + '"></i></div>' +
        '<div class="vv">' + U.fmtMoney(it.value) + '</div>' +
        '<div class="pc">' + pct.toFixed(0) + '%</div></div>';
    });
    return s + '</div>';
  }

  function legend(items, total) {
    if (!items.length) return '';
    let s = '<div class="legend">';
    items.slice(0, 10).forEach(function (it) {
      const pct = total > 0 ? (it.value / total) * 100 : 0;
      s += '<span class="li"><i class="dot" style="background:' + it.color + '"></i>' +
        esc(it.name) + ' <b class="lv">' + pct.toFixed(0) + '%</b></span>';
    });
    return s + '</div>';
  }

  UI.screens.stats = function () {
    const ym = UI.state.month;
    const scope = UI.state.statsScope;
    const all = Data.txnsOfMonth(ym);
    const list = all.filter(function (t) { return t.type === scope; });
    const total = list.reduce(function (s, t) { return s + t.hkd; }, 0);
    const cats = Data.byCategory(list, scope);
    const sum = Data.summary(all);

    let html = UI.monthNav(ym, 'mnavStats');
    html += '<div class="seg" style="margin-bottom:14px">' +
      '<button data-s="expense" class="' + (scope === 'expense' ? 'on' : '') + '">支出分析</button>' +
      '<button data-s="income" class="' + (scope === 'income' ? 'on' : '') + '">收入分析</button>' +
      '<button data-s="all" class="' + (scope === 'all' ? 'on' : '') + '">總覽</button></div>';

    if (!all.length) {
      return html + UI.emptyBlock('📊', '本月未有數據', '記錄幾筆收支後，圖表會自動生成');
    }

    if (scope === 'all') {
      // 總覽：收入 vs 支出 + 近十二月
      html += '<div class="stats3" style="margin-bottom:12px">' +
        UI.statCard('支出', U.fmtMoney(sum.expense), 'neg') +
        UI.statCard('收入', U.fmtMoney(sum.income), 'pos') +
        UI.statCard('結餘', U.fmtMoney(sum.net), sum.net < 0 ? 'neg' : 'pos') + '</div>';

      const expCats = Data.byCategory(all, 'expense');
      const incCats = Data.byCategory(all, 'income');
      html += '<div class="card"><div class="card-h"><h3>支出結構</h3><span class="sub">' + U.monthLabel(ym) + '</span></div>' +
        Charts.donut(expCats.map(function (c) { return { name: c.name, value: c.value, color: c.color }; }),
          { centerValue: U.fmtMoney(sum.expense), centerLabel: '本月支出' }) +
        legend(expCats, sum.expense) + '</div>';
      if (incCats.length) {
        html += '<div class="card"><div class="card-h"><h3>收入來源</h3></div>' +
          Charts.donut(incCats.map(function (c) { return { name: c.name, value: c.value, color: c.color }; }),
            { centerValue: U.fmtMoney(sum.income), centerLabel: '本月收入' }) +
          legend(incCats, sum.income) + '</div>';
      }
      html += sixMonthCard('支出');
      return html;
    }

    // 單一維度
    html += '<div class="card"><div class="card-h"><h3>' + (scope === 'expense' ? '支出' : '收入') + '分類佔比</h3>' +
      '<span class="sub">共 ' + list.length + ' 筆</span></div>' +
      Charts.donut(cats.map(function (c) { return { name: c.name, value: c.value, color: c.color }; }),
        { centerValue: U.fmtMoney(total), centerLabel: scope === 'expense' ? '本月支出' : '本月收入' }) +
      legend(cats, total) + '</div>';

    html += '<div class="card"><div class="card-h"><h3>分類排行</h3><span class="sub">金額</span></div>' +
      (cats.length ? ranks(cats, total) : '<div class="empty">暫無數據</div>') + '</div>';

    html += sixMonthCard(scope === 'expense' ? '支出' : '收入');

    if (scope === 'expense') {
      const daily = Data.dailyTotals(all, ym);
      html += '<div class="card"><div class="card-h"><h3>每日支出走勢</h3><span class="sub">1 – ' + daily.length + ' 日</span></div>' +
        Charts.line(daily, { color: '#f5b942', fmt: function (v) { return U.fmtShort(v); } }) + '</div>';

      html += walletStackCard(ym);

      html += '<div class="card"><div class="card-h"><h3>日曆熱力圖</h3><span class="sub">顏色越深，花費越多</span></div>' +
        '<div style="overflow-x:auto">' + Charts.heatmap(daily, ym, { color: '#f5b942', fmt: function (v) { return U.fmtMoney(v); } }) + '</div></div>';

      html += '<div class="card"><div class="card-h"><h3>錢包流向</h3><span class="sub">錢從哪個錢包流去哪裡</span></div>' +
        sankeyCard(all) + '</div>';
    }

    return html;
  };

  /* 近六個月柱狀圖 */
  function sixMonthCard(label) {
    const cur = UI.state.month;
    const months = [];
    for (let i = 5; i >= 0; i--) months.push(U.shiftMonth(cur, -i));
    const series = months.map(function (m) {
      const list = Data.txnsOfMonth(m).filter(function (t) {
        return t.type === (label === '支出' ? 'expense' : 'income');
      });
      const v = list.reduce(function (s, t) { return s + t.hkd; }, 0);
      return { label: Number(m.slice(5)) + '月', value: v, color: m === cur ? '#f5b942' : '#6b7280', dim: m !== cur };
    });
    const avg = series.reduce(function (s, x) { return s + x.value; }, 0) / (series.length || 1);
    return '<div class="card"><div class="card-h"><h3>近六個月' + label + '</h3>' +
      '<span class="sub">月均 ' + U.fmtMoney(avg) + '</span></div>' +
      Charts.bars(series, { fmt: function (v) { return U.fmtShort(v); } }) + '</div>';
  }

  /* 各錢包堆疊柱 */
  function walletStackCard(ym) {
    const months = [];
    for (let i = 5; i >= 0; i--) months.push(U.shiftMonth(ym, -i));
    const totalsByWallet = {};
    months.forEach(function (m) {
      Data.txnsOfMonth(m).forEach(function (t) {
        if (t.type !== 'expense') return;
        totalsByWallet[t.walletId] = (totalsByWallet[t.walletId] || 0) + t.hkd;
      });
    });
    const top = Object.keys(totalsByWallet).sort(function (a, b) {
      return totalsByWallet[b] - totalsByWallet[a];
    }).slice(0, 5);
    const series = top.map(function (id) {
      const w = Data.wallet(id);
      return { id: id, name: w.name, color: w.color };
    });
    if (Object.keys(totalsByWallet).length > top.length) series.push({ id: '__other', name: '其他', color: '#6b7280' });

    const rows = months.map(function (m) {
      const values = {};
      Data.txnsOfMonth(m).forEach(function (t) {
        if (t.type !== 'expense') return;
        const k = top.indexOf(t.walletId) >= 0 ? t.walletId : '__other';
        values[k] = (values[k] || 0) + t.hkd;
      });
      return { label: Number(m.slice(5)) + '月', values: values };
    });

    return '<div class="card"><div class="card-h"><h3>各錢包每月支出</h3><span class="sub">顯示前 5 名</span></div>' +
      Charts.stacked(rows, series, { fmt: function (v) { return U.fmtShort(v); } }) +
      '<div class="legend">' + series.map(function (s) {
        return '<span class="li"><i class="dot" style="background:' + s.color + '"></i>' + esc(s.name) + '</span>';
      }).join('') + '</div></div>';
  }

  function sankeyCard(list) {
    const links = [];
    const map = {};
    list.forEach(function (t) {
      if (t.type !== 'expense') return;
      const k = t.walletId + '|' + (t.categoryId || 'c_other');
      map[k] = (map[k] || 0) + t.hkd;
    });
    Object.keys(map).forEach(function (k) {
      const parts = k.split('|');
      links.push({ from: parts[0], to: parts[1], value: map[k] });
    });
    links.sort(function (a, b) { return b.value - a.value; });
    const top = links.slice(0, 24);
    if (!top.length) return '<div class="empty">暫無數據</div>';
    return Charts.sankey(top, {
      nameOf: function (id) { return Data.wallet(id).name; },
      colorOf: function (id) { return Data.wallet(id).color; },
      rightNameOf: function (id) { return Data.category(id).name; },
      rightColorOf: function (id) { return Data.category(id).color; },
      height: 250
    });
  }

  UI.afterRenderHooks.stats = function () {
    UI.bindMonthNav('mnavStats', function () { UI.render(); });
    $$('.seg [data-s]').forEach(function (b) {
      b.onclick = function () { UI.state.statsScope = b.dataset.s; UI.render(); };
    });
  };
})(window);
