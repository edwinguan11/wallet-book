/* ===== 記賬本 · ui-settle.js — 結算頁（月結／預算／對賬／分賬） ===== */
(function (global) {
  'use strict';

  UI.state.settleTab = 'month';

  /* ---------- 主畫面 ---------- */
  UI.screens.settle = function () {
    const tabs = [
      ['month', '月度結算'], ['budget', '預算'], ['recon', '對賬'],
      ['split', '朋友分賬'], ['loan', '借貸'], ['goal', '儲蓄目標']
    ];
    let html = '<div class="seg six" style="margin-bottom:14px">' + tabs.map(function (t) {
      return '<button data-st="' + t[0] + '" class="' + (UI.state.settleTab === t[0] ? 'on' : '') + '">' + t[1] + '</button>';
    }).join('') + '</div>';

    const tab = UI.state.settleTab;
    if (tab === 'month') html += viewMonth();
    else if (tab === 'budget') html += viewBudget();
    else if (tab === 'recon') html += viewRecon();
    else if (tab === 'loan') html += viewLoan();
    else if (tab === 'goal') html += viewGoal();
    else html += viewSplit();
    return html;
  };

  /* ================= 月度結算 ================= */
  function viewMonth() {
    const ym = UI.state.month;
    const all = Data.txnsOfMonth(ym);
    const sum = Data.summary(all);
    const days = U.daysInMonth(ym);
    const todayD = U.today();
    const elapsed = todayD.slice(0, 7) === ym ? Number(todayD.slice(8, 10)) : days;
    const avg = elapsed > 0 ? sum.expense / elapsed : 0;
    const cats = Data.byCategory(all, 'expense');
    const totalExp = sum.expense || 1;

    let html = UI.monthNav(ym, 'mnavSettle');

    html += '<div class="stats3" style="margin-bottom:12px">' +
      UI.statCard('總收入', U.fmtMoney(sum.income), 'pos') +
      UI.statCard('總支出', U.fmtMoney(sum.expense), 'neg') +
      UI.statCard('淨結餘', U.fmtMoney(sum.net), sum.net < 0 ? 'neg' : 'pos') + '</div>';

    html += '<div class="card"><div class="row between" style="font-size:12.5px;color:var(--muted)">' +
      '<span>日均支出</span><b style="color:var(--fg);font-size:14px">' + U.fmtMoney(avg) + '</b></div>' +
      '<div class="divider"></div>' +
      '<div class="row between" style="font-size:12.5px;color:var(--muted)">' +
      '<span>記錄筆數</span><b style="color:var(--fg);font-size:14px">' + all.length + ' 筆</b></div>' +
      '<div class="divider"></div>' +
      '<div class="row between" style="font-size:12.5px;color:var(--muted)">' +
      '<span>最高單筆支出</span><b style="color:var(--fg);font-size:14px">' +
      U.fmtMoney(all.filter(function (t) { return t.type === 'expense'; }).reduce(function (m, t) { return Math.max(m, t.hkd); }, 0)) +
      '</b></div></div>';

    // 分類結算
    html += '<div class="card"><div class="card-h"><h3>分類結算</h3><span class="sub">' + cats.length + ' 個分類</span></div>';
    if (!cats.length) html += '<div class="empty">本月暫無支出</div>';
    else {
      html += '<table class="tbl"><thead><tr><th>分類</th><th>金額</th><th>佔比</th></tr></thead><tbody>';
      cats.forEach(function (c) {
        html += '<tr><td>' + esc(c.icon) + ' ' + esc(c.name) + '</td><td>' + U.fmtMoney(c.value) +
          '</td><td>' + ((c.value / totalExp) * 100).toFixed(1) + '%</td></tr>';
      });
      html += '<tr><td><b>合計</b></td><td><b>' + U.fmtMoney(sum.expense) + '</b></td><td><b>100%</b></td></tr>';
      html += '</tbody></table>';
    }
    html += '</div>';

    // 錢包結算
    const rows = walletFlows(ym);
    html += '<div class="card"><div class="card-h"><h3>錢包結算</h3><span class="sub">期初 · 收支 · 期末</span></div>' +
      '<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>錢包</th><th>期初</th><th>收入</th><th>支出</th><th>轉賬</th><th>期末</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      const w = Data.wallet(r.id);
      const closeCls = r.close < 0 ? 'neg' : '';
      html += '<tr><td class="ellip" style="max-width:120px">' + esc(w.icon) + ' ' + esc(w.name) + '</td>' +
        '<td>' + U.fmtMoney(r.open) + '</td>' +
        '<td class="pos">' + (r.income ? '+' + U.fmtMoney(r.income) : '—') + '</td>' +
        '<td class="neg">' + (r.expense ? '−' + U.fmtMoney(r.expense) : '—') + '</td>' +
        '<td>' + (r.transfer ? (r.transfer > 0 ? '+' : '') + U.fmtMoney(r.transfer) : '—') + '</td>' +
        '<td class="' + closeCls + '"><b>' + U.fmtMoney(r.close) + '</b></td></tr>';
    });
    html += '</tbody></table></div>' +
      '<div class="help" style="margin-top:10px">信用卡顯示負數代表欠款；八達通等預付卡顯示可用餘額。</div></div>';

    return html;
  }

  function walletFlows(ym) {
    const start = ym + '-01';
    const all = Data.txns();
    const wallets = Data.wallets();
    return wallets.map(function (w) {
      let open = Number(w.opening) || 0;
      let income = 0, expense = 0, transfer = 0;
      all.forEach(function (t) {
        const inMonth = t.date.slice(0, 7) === ym;
        const before = t.date < start;
        if (t.type === 'expense' && t.walletId === w.id) {
          if (inMonth) expense += t.hkd; else if (before) open -= t.hkd;
        } else if (t.type === 'income' && t.walletId === w.id) {
          if (inMonth) income += t.hkd; else if (before) open += t.hkd;
        } else if (t.type === 'transfer') {
          if (t.walletId === w.id) { if (inMonth) transfer -= t.hkd; else if (before) open -= t.hkd; }
          if (t.toWalletId === w.id) { if (inMonth) transfer += t.hkd; else if (before) open += t.hkd; }
        }
      });
      return {
        id: w.id, open: U.round2(open), income: U.round2(income), expense: U.round2(expense),
        transfer: U.round2(transfer), close: U.round2(open + income - expense + transfer)
      };
    }).filter(function (r) {
      return r.open !== 0 || r.income || r.expense || r.transfer;
    });
  }

  /* ================= 預算 ================= */
  function viewBudget() {
    const ym = UI.state.month;
    const budgets = Data.budgets();
    const all = Data.txnsOfMonth(ym);
    const spentByCat = {};
    all.forEach(function (t) {
      if (t.type === 'expense') spentByCat[t.categoryId] = (spentByCat[t.categoryId] || 0) + t.hkd;
    });

    let totalBudget = 0, totalSpent = 0;
    budgets.forEach(function (b) {
      totalBudget += b.amount;
      totalSpent += spentByCat[b.categoryId] || 0;
    });

    let html = UI.monthNav(ym, 'mnavBudget');

    html += '<div class="card"><div class="card-h"><h3>本月預算</h3>' +
      '<span class="sub">' + (totalBudget ? ((totalSpent / totalBudget) * 100).toFixed(0) + '% 已用' : '未設定') + '</span></div>' +
      '<div class="row between"><div><div class="mini-k">已用 / 預算</div>' +
      '<div style="font-size:19px;font-weight:800;margin-top:2px">' + U.fmtMoney(totalSpent) +
      ' <span style="font-size:13px;color:var(--muted);font-weight:600">/ ' + U.fmtMoney(totalBudget) + '</span></div></div>' +
      '<div style="text-align:right"><div class="mini-k">剩餘</div>' +
      '<div style="font-size:19px;font-weight:800;margin-top:2px" class="' + (totalBudget - totalSpent < 0 ? 'neg' : 'pos') + '">' +
      U.fmtMoney(totalBudget - totalSpent) + '</div></div></div>' +
      '<div class="prog" style="height:11px;margin-top:12px"><i class="' +
      (totalSpent / (totalBudget || 1) > 1 ? 'over' : totalSpent / (totalBudget || 1) > 0.85 ? 'warn' : '') +
      '" style="width:' + Math.min(100, totalBudget ? (totalSpent / totalBudget) * 100 : 0).toFixed(1) + '%"></i></div>' +
      '<div style="margin-top:14px"><button class="btn block" id="setBudget">設定分類預算</button></div></div>';

    const withBudget = budgets.slice().sort(function (a, b) {
      const pa = (spentByCat[a.categoryId] || 0) / (a.amount || 1);
      const pb = (spentByCat[b.categoryId] || 0) / (b.amount || 1);
      return pb - pa;
    });

    if (!withBudget.length) {
      return html + UI.emptyBlock('🎯', '尚未設定預算', '為每個分類設定每月上限，超支時會即時提示');
    }

    html += '<div class="card"><div class="card-h"><h3>分類預算</h3><span class="sub">紅色為超支</span></div>';
    withBudget.forEach(function (b) {
      const c = Data.category(b.categoryId);
      const spent = spentByCat[b.categoryId] || 0;
      const pct = b.amount ? (spent / b.amount) * 100 : 0;
      const cls = pct > 100 ? 'over' : pct > 85 ? 'warn' : '';
      html += '<div style="margin-bottom:14px"><div class="row between" style="font-size:13px">' +
        '<span>' + esc(c.icon) + ' ' + esc(c.name) + '</span>' +
        '<span><b>' + U.fmtMoney(spent) + '</b> <span class="muted">/ ' + U.fmtMoney(b.amount) + '</span></span></div>' +
        '<div class="prog"><i class="' + cls + '" style="width:' + Math.min(100, pct).toFixed(1) + '%"></i></div>' +
        '<div class="mini-k" style="margin-top:3px">' +
        (spent > b.amount ? '超支 ' + U.fmtMoney(spent - b.amount) : '剩餘 ' + U.fmtMoney(b.amount - spent)) +
        ' · ' + pct.toFixed(0) + '%</div></div>';
    });
    html += '</div>';
    return html;
  }

  function openBudgetEditor() {
    const cats = Data.categories('expense');
    let html = '<h3>設定每月預算</h3><div class="help" style="margin-bottom:12px">留空或填 0 表示不設上限。</div>' +
      '<div class="frm" style="max-height:52vh;overflow-y:auto">';
    cats.forEach(function (c) {
      const v = Data.budget(c.id);
      html += '<div class="row"><span style="width:120px;font-size:13.5px">' + esc(c.icon) + ' ' + esc(c.name) +
        '</span><input type="number" class="bIn" data-c="' + c.id + '" value="' + (v || '') +
        '" placeholder="0" style="flex:1;padding:8px 10px"></div>';
    });
    html += '</div><div class="sheet-actions"><button class="btn" data-x="no">取消</button>' +
      '<button class="btn primary" data-x="yes">儲存</button></div>';

    UI.sheet(html, function (root) {
      root.querySelector('[data-x="no"]').onclick = UI.closeSheet;
      root.querySelector('[data-x="yes"]').onclick = function () {
        root.querySelectorAll('.bIn').forEach(function (inp) {
          const cid = inp.dataset.c;
          const val = parseFloat(inp.value) || 0;
          const db = Store.get();
          let rec = db.budgets.find(function (x) { return x.categoryId === cid; });
          if (val > 0) {
            if (rec) { rec.amount = val; rec.deleted = false; rec.updatedAt = U.nowMs(); }
            else db.budgets.push({ id: U.uid('b'), categoryId: cid, amount: val, updatedAt: U.nowMs(), deleted: false });
          } else if (rec) { rec.deleted = true; rec.updatedAt = U.nowMs(); }
        });
        Store.save();
        UI.closeSheet();
        UI.render();
        UI.toast('預算已更新');
      };
    });
  }

  /* ================= 對賬 ================= */
  function viewRecon() {
    const ym = UI.state.month;
    let html = UI.monthNav(ym, 'mnavRecon');
    const all = Data.txnsOfMonth(ym).filter(function (t) { return t.type !== 'transfer'; });
    const byWallet = {};
    all.forEach(function (t) { (byWallet[t.walletId] = byWallet[t.walletId] || []).push(t); });

    const ids = Object.keys(byWallet);

    // 餘額核對：輸入錢包真實餘額，找出漏記
    html += '<div class="card"><div class="card-h"><h3>餘額核對</h3><span class="sub">找出漏記</span></div>' +
      '<div class="help" style="margin-bottom:10px">輸入錢包 App 顯示的真實餘額，系統會比對並找出差額。</div>';
    Data.wallets().slice(0, 8).forEach(function (w) {
      const bal = Data.walletBalance(w.id);
      html += '<div class="wrow"><span style="font-size:15px">' + esc(w.icon) + '</span>' +
        '<span class="grow ellip" style="font-size:13px">' + esc(w.name) + '</span>' +
        '<span class="mono mini-k">' + U.fmtMoney(bal) + '</span>' +
        '<button class="btn sm" data-wdetail="' + w.id + '">明細</button>' +
        '<button class="btn sm" data-chkbal="' + w.id + '">核對</button></div>';
    });
    html += '</div>';

    if (!ids.length) {
      return html + UI.emptyBlock('✅', '本月沒有需要對賬的記錄', '所有支出與收入均已記錄');
    }

    html += '<div class="card"><div class="card-h"><h3>對賬進度</h3><span class="sub">' + U.monthLabel(ym) + '</span></div>';
    let totalN = 0, doneN = 0;
    ids.forEach(function (id) {
      const arr = byWallet[id];
      totalN += arr.length;
      doneN += arr.filter(function (t) { return t.reconciled; }).length;
    });
    const pct = totalN ? (doneN / totalN) * 100 : 0;
    html += '<div class="row between" style="font-size:13px"><span>已對賬 ' + doneN + ' / ' + totalN + ' 筆</span>' +
      '<b>' + pct.toFixed(0) + '%</b></div>' +
      '<div class="prog" style="height:10px"><i style="width:' + pct.toFixed(1) + '%"></i></div></div>';

    ids.forEach(function (id) {
      const arr = byWallet[id].slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      const w = Data.wallet(id);
      const un = arr.filter(function (t) { return !t.reconciled; });
      html += '<div class="card"><div class="card-h"><h3>' + esc(w.icon) + ' ' + esc(w.name) + '</h3>' +
        '<span class="sub">' + arr.length + ' 筆 · 未對 ' + un.length + '</span></div>';

      html += '<table class="tbl"><tbody>';
      arr.slice(0, 40).forEach(function (t) {
        const sign = t.type === 'income' ? '+' : '−';
        html += '<tr><td style="width:56px" class="muted">' + esc(t.date.slice(5)) + '</td>' +
          '<td class="ellip" style="max-width:130px">' + esc(t.note || Data.category(t.categoryId).name) + '</td>' +
          '<td class="' + (t.type === 'income' ? 'pos' : 'neg') + '">' + sign + U.fmtMoney(Math.abs(t.hkd)) + '</td>' +
          '<td style="width:74px"><button class="btn sm ' + (t.reconciled ? '' : 'ghost') + '" data-rid="' + t.id + '">' +
          (t.reconciled ? '✓ 已對' : '對賬') + '</button></td></tr>';
      });
      html += '</tbody></table>';
      if (un.length) {
        html += '<div style="margin-top:10px"><button class="btn sm block" data-reconall="' + id + '">全部標記為已對賬（' + un.length + ' 筆）</button></div>';
      }
      html += '</div>';
    });
    return html;
  }

  /* ================= 朋友分賬（AA） ================= */
  function viewSplit() {
    const groups = Data.groups();
    let html = '';
    if (!groups.length) {
      html += UI.emptyBlock('👥', '尚未建立分賬群組', '例如「旅行」、「同學聚餐」，記錄誰先付款、各自應付多少');
    }
    groups.forEach(function (g) {
      const stat = groupStat(g);
      html += '<div class="card" data-gid="' + g.id + '" style="cursor:pointer">' +
        '<div class="row between"><div><div style="font-size:15px;font-weight:700">' + esc(g.name) + '</div>' +
        '<div class="mini-k">' + g.members.length + ' 位成員 · ' + g.items.length + ' 筆支出 · 總額 ' + U.fmtMoney(stat.total) + '</div></div>' +
        '<div style="text-align:right">' +
        (stat.openCount ? '<span class="pill no">未結清 ' + stat.openCount + '</span>' : '<span class="pill ok">已結清</span>') +
        '</div></div></div>';
    });
    html += '<button class="btn primary block" id="newGroup" style="margin-top:6px">＋ 建立分賬群組</button>';
    html += '<div class="card" style="margin-top:14px"><div class="card-h"><h3>分賬使用方法</h3></div>' +
      '<div class="help">1. 建立群組並填寫成員名稱（例如「小明, 阿華, 我」）。<br>' +
      '2. 每次付款時輸入金額、選擇誰先付款、勾選共同分攤的成員。<br>' +
      '3. 系統會自動計算每個人的淨額，並給出「誰應該付給誰多少」的最簡轉賬方案。<br>' +
      '4. 完成轉賬後標記為已結清。</div></div>';
    return html;
  }

  function groupStat(g) {
    const bal = groupBalances(g);
    let total = 0;
    g.items.forEach(function (it) { total += Number(it.amount) || 0; });
    let openCount = 0;
    Object.keys(bal).forEach(function (k) { if (Math.abs(bal[k]) > 0.5) openCount++; });
    return { total: U.round2(total), openCount: openCount, balances: bal };
  }

  function groupBalances(g) {
    const bal = {};
    g.members.forEach(function (m) { bal[m.id] = 0; });
    (g.items || []).forEach(function (it) {
      const amt = Number(it.amount) || 0;
      if (bal[it.payerId] === undefined) bal[it.payerId] = 0;
      bal[it.payerId] += amt;
      const shares = it.shares || [];
      const wsum = shares.reduce(function (s, sh) { return s + (Number(sh.weight) || 1); }, 0) || 1;
      shares.forEach(function (sh) {
        if (bal[sh.memberId] === undefined) bal[sh.memberId] = 0;
        bal[sh.memberId] -= amt * ((Number(sh.weight) || 1) / wsum);
      });
    });
    (g.settled || []).forEach(function (s) {
      if (bal[s.from] === undefined) bal[s.from] = 0;
      if (bal[s.to] === undefined) bal[s.to] = 0;
      bal[s.from] += Number(s.amount) || 0;
      bal[s.to] -= Number(s.amount) || 0;
    });
    Object.keys(bal).forEach(function (k) { bal[k] = U.round2(bal[k]); });
    return bal;
  }

  /* 最簡轉賬方案 */
  function simplify(bal, members) {
    const name = {};
    members.forEach(function (m) { name[m.id] = m.name; });
    const list = Object.keys(bal).map(function (k) { return { id: k, v: bal[k], name: name[k] || k }; });
    const debtors = list.filter(function (x) { return x.v < -0.5; }).map(function (x) { return { id: x.id, name: x.name, v: -x.v }; });
    const creditors = list.filter(function (x) { return x.v > 0.5; }).map(function (x) { return { id: x.id, name: x.name, v: x.v }; });
    debtors.sort(function (a, b) { return b.v - a.v; });
    creditors.sort(function (a, b) { return b.v - a.v; });
    const out = [];
    let i = 0, j = 0;
    let guard = 0;
    while (i < debtors.length && j < creditors.length && guard++ < 200) {
      const pay = Math.min(debtors[i].v, creditors[j].v);
      if (pay > 0.5) out.push({ from: debtors[i].id, fromName: debtors[i].name, to: creditors[j].id, toName: creditors[j].name, amount: U.round2(pay) });
      debtors[i].v -= pay;
      creditors[j].v -= pay;
      if (debtors[i].v <= 0.5) i++;
      if (creditors[j].v <= 0.5) j++;
    }
    return out;
  }

  /* ================= 錢包餘額明細 ================= */
  function openWalletDetail(wid) {
    const w = Data.wallet(wid);
    const all = Data.txns();
    let income = 0, expense = 0, tin = 0, tout = 0, ni = 0, ne = 0, nt = 0;
    const rows = [];
    all.forEach(function (t) {
      let delta = 0;
      if (t.type === 'income' && t.walletId === wid) { delta = t.hkd; income += t.hkd; ni++; }
      else if (t.type === 'expense' && t.walletId === wid) { delta = -t.hkd; expense += t.hkd; ne++; }
      else if (t.type === 'transfer') {
        if (t.walletId === wid) { delta -= t.hkd; tout += t.hkd; nt++; }
        if (t.toWalletId === wid) { delta += t.hkd; tin += t.hkd; nt++; }
      }
      if (delta !== 0) rows.push({ t: t, delta: delta });
    });
    const opening = Number(w.opening) || 0;
    const calc = U.round2(opening + income - expense + tin - tout);

    let h = '<h3>' + esc(w.icon) + ' ' + esc(w.name) + ' 餘額明細</h3>' +
      '<div class="frm" style="gap:6px">' +
      '<div class="row between"><span>期初餘額</span><b class="mono">' + U.fmtMoney(opening) + '</b></div>' +
      '<div class="row between"><span>收入（' + ni + ' 筆）</span><b class="mono pos">+' + U.fmtMoney(income) + '</b></div>' +
      '<div class="row between"><span>支出（' + ne + ' 筆）</span><b class="mono neg">−' + U.fmtMoney(expense) + '</b></div>' +
      '<div class="row between"><span>轉入</span><b class="mono pos">+' + U.fmtMoney(tin) + '</b></div>' +
      '<div class="row between"><span>轉出</span><b class="mono neg">−' + U.fmtMoney(tout) + '</b></div>' +
      '<div class="divider"></div>' +
      '<div class="row between"><span style="font-weight:700">現時餘額</span><b class="mono" style="font-size:17px">' + U.fmtMoney(calc) + '</b></div>' +
      '</div>';

    rows.sort(function (a, b) { return a.t.date < b.t.date ? 1 : -1; });
    h += '<div class="h-sec">最近 12 筆</div><table class="tbl"><tbody>';
    rows.slice(0, 12).forEach(function (r) {
      const t = r.t;
      const label = t.note || (t.type === 'transfer' ? '轉賬' : Data.category(t.categoryId).name);
      h += '<tr><td class="muted" style="width:52px">' + esc(t.date.slice(5)) + '</td>' +
        '<td class="ellip" style="max-width:120px">' + esc(label) + '</td>' +
        '<td class="' + (r.delta > 0 ? 'pos' : 'neg') + '">' + (r.delta > 0 ? '+' : '−') + U.fmtMoney(Math.abs(r.delta)) + '</td></tr>';
    });
    h += '</tbody></table>';

    h += '<div class="sheet-actions"><button class="btn" id="wdDup">找出可疑重複</button>' +
      '<button class="btn primary" id="wdClose">關閉</button></div>';

    UI.sheet(h, function (root) {
      root.querySelector('#wdClose').onclick = UI.closeSheet;
      root.querySelector('#wdDup').onclick = function () { UI.closeSheet(); findDuplicates(wid); };
    });
  }

  /* 找出同一錢包、同日期、同金額的重複記錄 */
  function findDuplicates(wid) {
    const map = {};
    Data.txns().forEach(function (t) {
      if (t.type === 'transfer') return;
      if (wid && t.walletId !== wid) return;
      const k = t.date + '|' + t.hkd.toFixed(2) + '|' + t.type;
      (map[k] = map[k] || []).push(t);
    });
    const dups = Object.keys(map).map(function (k) { return map[k]; })
      .filter(function (arr) { return arr.length > 1; })
      .sort(function (a, b) { return b[0].hkd - a[0].hkd; });

    if (!dups.length) {
      UI.sheet('<h3>沒有發現重複</h3><div class="help">同一天、同一金額、同一錢包的記錄沒有重複。</div>' +
        '<div class="sheet-actions"><button class="btn primary" id="dClose">明白</button></div>',
        function (root) { root.querySelector('#dClose').onclick = UI.closeSheet; });
      return;
    }

    let h = '<h3>可疑重複（' + dups.length + ' 組）</h3>' +
      '<div class="help" style="margin-bottom:10px">同一天、同一金額、同一類型出現多次。可能係重複匯入或重複記賬。</div>';
    dups.slice(0, 12).forEach(function (arr, gi) {
      const t = arr[0];
      h += '<div class="card tight" style="margin-bottom:8px">' +
        '<div class="row between" style="margin-bottom:6px"><b>' + esc(t.date) + ' · ' + U.fmtMoney(t.hkd) + ' × ' + arr.length + '</b>' +
        '<span class="mini-k">' + esc(Data.wallet(t.walletId).name) + '</span></div>';
      arr.forEach(function (x, i) {
        h += '<div class="row between" style="font-size:12.5px;padding:3px 0">' +
          '<span class="ellip muted">' + esc(x.note || Data.category(x.categoryId).name) + '</span>' +
          '<button class="btn sm ghost" data-rm="' + x.id + '">刪除</button></div>';
      });
      h += '</div>';
    });
    h += '<div class="sheet-actions"><button class="btn primary" id="dClose">關閉</button></div>';
    UI.sheet(h, function (root) {
      root.querySelector('#dClose').onclick = function () { UI.closeSheet(); UI.render(); };
      root.querySelectorAll('[data-rm]').forEach(function (b) {
        b.onclick = function () {
          Data.removeTxn(b.dataset.rm);
          UI.closeSheet(); UI.render();
          UI.toast('已刪除一筆');
        };
      });
    });
  }

  /* ================= 借貸 ================= */
  function viewLoan() {
    const st = Data.loanStats();
    const list = Data.loans();
    let html = '<div class="stats3" style="margin-bottom:12px">' +
      UI.statCard('別人欠我', U.fmtMoney(st.receivable), 'pos') +
      UI.statCard('我欠別人', U.fmtMoney(st.payable), 'neg') +
      UI.statCard('淨額', U.fmtMoney(st.net), st.net < 0 ? 'neg' : 'pos') + '</div>';

    html += '<button class="btn primary block" id="addLoan" style="margin-bottom:12px">＋ 新增借貸記錄</button>';

    if (!list.length) {
      return html + UI.emptyBlock('🤝', '尚未有借貸記錄', '借錢給同學、或向朋友借錢，都可以在這裡記錄，自動計算誰欠誰');
    }

    html += '<div class="card"><div class="card-h"><h3>記錄</h3><span class="sub">' +
      list.filter(function (l) { return !l.settled; }).length + ' 筆未結清</span></div>';
    list.forEach(function (l) {
      const out = l.direction !== 'in';
      html += '<div class="wrow" data-loan="' + l.id + '">' +
        '<span style="font-size:15px">' + (out ? '📤' : '📥') + '</span>' +
        '<span class="grow ellip"><span style="font-size:13.5px">' + esc(l.person) + '</span>' +
        '<div class="mini-k">' + esc(l.date) + (l.note ? ' · ' + esc(l.note) : '') + '</div></span>' +
        '<span class="mono" style="font-size:13px;color:' + (out ? 'var(--green)' : 'var(--red)') + '">' +
        (out ? '+' : '−') + U.fmtMoney(l.amount) + '</span>' +
        '<button class="btn sm ' + (l.settled ? 'ghost' : '') + '" data-setloan="' + l.id + '">' +
        (l.settled ? '已清' : '結清') + '</button></div>';
    });
    html += '</div>';
    return html;
  }

  function editLoan(id) {
    const isNew = !id;
    const db = Store.get();
    const l = isNew
      ? { id: U.uid('ln'), person: '', amount: 0, direction: 'out', date: U.today(), note: '', settled: false }
      : db.loans.find(function (x) { return x.id === id; });
    if (!l) return;

    UI.sheet('<h3>' + (isNew ? '新增借貸' : '編輯借貸') + '</h3><div class="frm">' +
      '<div><label class="fl">對象</label><input type="text" id="lnPerson" value="' + esc(l.person) + '" placeholder="例如 小明"></div>' +
      '<div class="two"><div><label class="fl">金額</label><input type="number" id="lnAmt" step="0.01" value="' + (l.amount || '') + '"></div>' +
      '<div><label class="fl">日期</label><input type="date" id="lnDate" value="' + esc(l.date) + '"></div></div>' +
      '<div><label class="fl">方向</label><select id="lnDir">' +
      '<option value="out"' + (l.direction !== 'in' ? ' selected' : '') + '>我借出（對方欠我）</option>' +
      '<option value="in"' + (l.direction === 'in' ? ' selected' : '') + '>我借入（我欠對方）</option>' +
      '</select></div>' +
      '<div><label class="fl">備註</label><input type="text" id="lnNote" value="' + esc(l.note || '') + '"></div>' +
      '</div><div class="sheet-actions">' + (isNew ? '' : '<button class="btn danger" id="lnDel">刪除</button>') +
      '<button class="btn primary" id="lnSave">儲存</button></div>', function (root) {
      root.querySelector('#lnSave').onclick = function () {
        const person = root.querySelector('#lnPerson').value.trim();
        const amt = parseFloat(root.querySelector('#lnAmt').value);
        if (!person) { UI.toast('請輸入對象'); return; }
        if (!amt || amt <= 0) { UI.toast('請輸入金額'); return; }
        const rec = {
          person: person, amount: U.round2(amt),
          direction: root.querySelector('#lnDir').value,
          date: root.querySelector('#lnDate').value || U.today(),
          note: root.querySelector('#lnNote').value.trim(),
          updatedAt: U.nowMs()
        };
        if (isNew) {
          db.loans.push(Object.assign({ id: l.id, settled: false, deleted: false }, rec));
        } else Object.assign(l, rec);
        Store.save(); UI.closeSheet(); UI.render(); UI.toast('已儲存');
      };
      const d = root.querySelector('#lnDel');
      if (d) d.onclick = function () {
        UI.closeSheet();
        UI.confirm('刪除這筆借貸？', '', function () {
          l.deleted = true; l.updatedAt = U.nowMs(); Store.save(); UI.render();
        });
      };
    });
  }

  /* ================= 儲蓄目標 ================= */
  function viewGoal() {
    const goals = Data.goals();
    let html = '<button class="btn primary block" id="addGoal" style="margin-bottom:12px">＋ 新增儲蓄目標</button>';
    if (!goals.length) {
      return html + UI.emptyBlock('🎯', '還沒有儲蓄目標', '例如「買相機 $3000」，設定後可以看到進度與還差多少');
    }
    goals.forEach(function (g) {
      const pct = g.target > 0 ? Math.min(100, (g.saved / g.target) * 100) : 0;
      const left = Math.max(0, g.target - g.saved);
      html += '<div class="card"><div class="row between" style="margin-bottom:8px">' +
        '<div><div style="font-size:15px;font-weight:700">' + esc(g.name) + '</div>' +
        '<div class="mini-k">已存 ' + U.fmtMoney(g.saved) + ' / ' + U.fmtMoney(g.target) + '</div></div>' +
        '<div style="text-align:right"><div style="font-size:17px;font-weight:800">' + pct.toFixed(0) + '%</div>' +
        '<div class="mini-k">' + (left > 0 ? '還差 ' + U.fmtMoney(left) : '已達成 🎉') + '</div></div></div>' +
        '<div class="prog" style="height:11px"><i class="' + (pct >= 100 ? '' : 'warn') + '" style="width:' + pct.toFixed(1) + '%"></i></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">' +
        '<button class="btn sm" data-goaladd="' + g.id + '">存入</button>' +
        '<button class="btn sm ghost" data-goaledit="' + g.id + '">編輯</button></div></div>';
    });
    return html;
  }

  function editGoal(id) {
    const isNew = !id;
    const db = Store.get();
    const g = isNew ? { id: U.uid('gl'), name: '', target: 0, saved: 0 } : db.goals.find(function (x) { return x.id === id; });
    if (!g) return;
    UI.sheet('<h3>' + (isNew ? '新增儲蓄目標' : '編輯目標') + '</h3><div class="frm">' +
      '<div><label class="fl">目標名稱</label><input type="text" id="glName" value="' + esc(g.name) + '" placeholder="例如 買相機"></div>' +
      '<div class="two"><div><label class="fl">目標金額</label><input type="number" id="glTarget" step="1" value="' + (g.target || '') + '"></div>' +
      '<div><label class="fl">已存金額</label><input type="number" id="glSaved" step="1" value="' + (g.saved || 0) + '"></div></div>' +
      '</div><div class="sheet-actions">' + (isNew ? '' : '<button class="btn danger" id="glDel">刪除</button>') +
      '<button class="btn primary" id="glSave">儲存</button></div>', function (root) {
      root.querySelector('#glSave').onclick = function () {
        const name = root.querySelector('#glName').value.trim();
        const target = parseFloat(root.querySelector('#glTarget').value);
        const saved = parseFloat(root.querySelector('#glSaved').value) || 0;
        if (!name || !target) { UI.toast('請填寫名稱與目標金額'); return; }
        const rec = { name: name, target: U.round2(target), saved: U.round2(saved), updatedAt: U.nowMs() };
        if (isNew) db.goals.push(Object.assign({ id: g.id, deleted: false }, rec));
        else Object.assign(g, rec);
        Store.save(); UI.closeSheet(); UI.render(); UI.toast('已儲存');
      };
      const d = root.querySelector('#glDel');
      if (d) d.onclick = function () {
        UI.closeSheet();
        UI.confirm('刪除這個目標？', '', function () {
          g.deleted = true; g.updatedAt = U.nowMs(); Store.save(); UI.render();
        });
      };
    });
  }

  function depositGoal(id) {
    const g = Store.get().goals.find(function (x) { return x.id === id; });
    if (!g) return;
    UI.prompt({ title: '存入「' + g.name + '」', label: '金額（會同時記一筆儲蓄支出）', placeholder: '例如 500', ok: '存入' }).then(function (v) {
      const amt = parseFloat(v);
      if (!amt || amt <= 0) return;
      g.saved = U.round2((Number(g.saved) || 0) + amt);
      g.updatedAt = U.nowMs();
      Data.addTxn({
        type: 'expense', amount: amt, hkd: amt, date: U.today(),
        categoryId: 'c_save', walletId: Store.get().settings.defaultWallet || 'w_octopus',
        note: '儲蓄：' + g.name
      });
      Store.save(); UI.render(); UI.toast('已存入 ' + U.fmtMoney(amt));
    });
  }

  /* ---------- 群組詳情 ---------- */
  function openGroup(gid) {
    const g = Data.group(gid);
    if (!g) return;
    const bal = groupBalances(g);
    const plan = simplify(bal, g.members);

    let html = '<div class="row between" style="margin-bottom:6px"><h3 style="margin:0">' + esc(g.name) + '</h3>' +
      '<button class="btn sm ghost" id="gClose">關閉</button></div>';

    html += '<div class="h-sec" style="margin-top:6px">成員淨額</div><div style="display:flex;flex-wrap:wrap;gap:8px">';
    g.members.forEach(function (m) {
      const v = bal[m.id] || 0;
      const cls = Math.abs(v) < 0.5 ? 'dim' : v > 0 ? 'ok' : 'no';
      const label = Math.abs(v) < 0.5 ? '已平' : v > 0 ? '應收 ' + U.fmtMoney(v) : '應付 ' + U.fmtMoney(-v);
      html += '<span class="pill ' + cls + '">' + esc(m.name) + ' · ' + label + '</span>';
    });
    html += '</div>';

    html += '<div class="h-sec">支出明細</div>';
    if (!g.items.length) html += '<div class="empty" style="padding:20px">尚未新增支出</div>';
    else {
      html += '<table class="tbl"><tbody>';
      g.items.slice().reverse().forEach(function (it) {
        const payer = (g.members.find(function (m) { return m.id === it.payerId; }) || {}).name || '?';
        html += '<tr><td class="ellip" style="max-width:130px">' + esc(it.desc || '支出') + '<div class="mini-k">' +
          esc(payer) + ' 先付 · ' + esc(it.date || '') + '</div></td><td>' + U.fmtMoney(it.amount) + '</td>' +
          '<td style="width:34px"><button class="btn sm ghost" data-delitem="' + it.id + '">✕</button></td></tr>';
      });
      html += '</tbody></table>';
    }
    html += '<button class="btn block" id="addItem" style="margin-top:10px">＋ 新增一筆共同支出</button>';

    html += '<div class="h-sec">最簡結算方案</div>';
    if (!plan.length) html += '<div class="pill ok">全部已結清</div>';
    else {
      html += '<div class="frm">';
      plan.forEach(function (p) {
        html += '<div class="row between" style="font-size:13.5px;padding:8px 0;border-bottom:1px solid var(--line)">' +
          '<span><b>' + esc(p.fromName) + '</b> → <b>' + esc(p.toName) + '</b></span>' +
          '<span><b class="pos">' + U.fmtMoney(p.amount) + '</b></span>' +
          '<button class="btn sm" data-settle="' + p.from + '|' + p.to + '|' + p.amount + '">已付</button></div>';
      });
      html += '</div>';
    }

    html += '<div class="sheet-actions"><button class="btn danger" id="gDel">刪除群組</button></div>';

    UI.sheet(html, function (root) {
      root.querySelector('#gClose').onclick = UI.closeSheet;
      root.querySelector('#addItem').onclick = function () { UI.closeSheet(); openAddItem(gid); };
      root.querySelector('#gDel').onclick = function () {
        UI.closeSheet();
        UI.confirm('刪除群組「' + g.name + '」？', '群組內所有分賬記錄會一併刪除。', function () {
          g.deleted = true; g.updatedAt = U.nowMs(); Store.save(); UI.render(); UI.toast('已刪除群組');
        });
      };
      root.querySelectorAll('[data-delitem]').forEach(function (b) {
        b.onclick = function () {
          g.items = g.items.filter(function (x) { return x.id !== b.dataset.delitem; });
          g.updatedAt = U.nowMs(); Store.save(); UI.closeSheet(); openGroup(gid);
        };
      });
      root.querySelectorAll('[data-settle]').forEach(function (b) {
        b.onclick = function () {
          const p = b.dataset.settle.split('|');
          g.settled = g.settled || [];
          g.settled.push({ id: U.uid('s'), from: p[0], to: p[1], amount: Number(p[2]), date: U.today(), updatedAt: U.nowMs() });
          g.updatedAt = U.nowMs(); Store.save(); UI.closeSheet(); openGroup(gid); UI.render();
          UI.toast('已記錄結清');
        };
      });
    });
  }

  function openAddItem(gid) {
    const g = Data.group(gid);
    let html = '<h3>新增共同支出</h3><div class="frm">' +
      '<div><label class="fl">說明</label><input type="text" id="iDesc" placeholder="例如 晚餐"></div>' +
      '<div class="two"><div><label class="fl">金額</label><input type="number" id="iAmt" step="0.01" inputmode="decimal"></div>' +
      '<div><label class="fl">日期</label><input type="date" id="iDate" value="' + U.today() + '"></div></div>' +
      '<div><label class="fl">誰先付款</label><select id="iPayer">' +
      g.members.map(function (m) { return '<option value="' + m.id + '">' + esc(m.name) + '</option>'; }).join('') +
      '</select></div>' +
      '<div><label class="fl">共同分攤（可設權重）</label><div id="iShares">' +
      g.members.map(function (m) {
        return '<div class="row" style="margin-bottom:6px"><label style="flex:1;font-size:13.5px">' +
          '<input type="checkbox" checked data-share="' + m.id + '" style="width:auto;margin-right:7px">' + esc(m.name) + '</label>' +
          '<input type="number" step="0.5" min="0.5" value="1" data-weight="' + m.id + '" style="width:66px;padding:5px 8px"></div>';
      }).join('') + '</div></div></div>' +
      '<div class="sheet-actions"><button class="btn" data-x="no">取消</button>' +
      '<button class="btn primary" data-x="yes">新增</button></div>';

    UI.sheet(html, function (root) {
      root.querySelector('[data-x="no"]').onclick = UI.closeSheet;
      root.querySelector('[data-x="yes"]').onclick = function () {
        const amt = parseFloat(root.querySelector('#iAmt').value);
        if (!amt || amt <= 0) { UI.toast('請輸入正確金額'); return; }
        const shares = [];
        g.members.forEach(function (m) {
          const cb = root.querySelector('[data-share="' + m.id + '"]');
          const wt = root.querySelector('[data-weight="' + m.id + '"]');
          if (cb && cb.checked) shares.push({ memberId: m.id, weight: Math.max(0.5, parseFloat(wt.value) || 1) });
        });
        if (!shares.length) { UI.toast('請至少選擇一位分攤成員'); return; }
        g.items.push({
          id: U.uid('gi'), desc: root.querySelector('#iDesc').value.trim(),
          amount: U.round2(amt), date: root.querySelector('#iDate').value || U.today(),
          payerId: root.querySelector('#iPayer').value, shares: shares, createdAt: U.nowMs()
        });
        g.updatedAt = U.nowMs();
        Store.save();
        UI.closeSheet();
        openGroup(gid);
        UI.render();
        UI.toast('已加入分賬');
      };
    });
  }

  function newGroup() {
    const html = '<h3>建立分賬群組</h3><div class="frm">' +
      '<div><label class="fl">群組名稱</label><input type="text" id="gName" placeholder="例如 東京旅行"></div>' +
      '<div><label class="fl">成員（以逗號分隔）</label><input type="text" id="gMembers" placeholder="我, 小明, 阿華"></div>' +
      '</div><div class="sheet-actions"><button class="btn" data-x="no">取消</button>' +
      '<button class="btn primary" data-x="yes">建立</button></div>';
    UI.sheet(html, function (root) {
      root.querySelector('[data-x="no"]').onclick = UI.closeSheet;
      root.querySelector('[data-x="yes"]').onclick = function () {
        const name = root.querySelector('#gName').value.trim() || '新群組';
        const members = root.querySelector('#gMembers').value.split(/[,，、]/)
          .map(function (s) { return s.trim(); }).filter(Boolean);
        if (members.length < 2) { UI.toast('最少需要兩位成員'); return; }
        const g = {
          id: U.uid('g'), name: name,
          members: members.map(function (n) { return { id: U.uid('m'), name: n }; }),
          items: [], settled: [], createdAt: U.nowMs(), updatedAt: U.nowMs(), deleted: false
        };
        Store.get().groups.push(g);
        Store.save();
        UI.closeSheet();
        UI.render();
        openGroup(g.id);
      };
    });
  }

  /* ---------- 綁定 ---------- */
  UI.afterRenderHooks.settle = function () {
    $$('.seg [data-st]').forEach(function (b) {
      b.onclick = function () { UI.state.settleTab = b.dataset.st; UI.render(); };
    });
    UI.bindMonthNav('mnavSettle', function () { UI.render(); });
    UI.bindMonthNav('mnavBudget', function () { UI.render(); });
    UI.bindMonthNav('mnavRecon', function () { UI.render(); });

    const sb = $('#setBudget');
    if (sb) sb.onclick = openBudgetEditor;

    $$('[data-rid]').forEach(function (b) {
      b.onclick = function () {
        const t = Store.get().txns.find(function (x) { return x.id === b.dataset.rid; });
        if (!t) return;
        t.reconciled = !t.reconciled;
        t.updatedAt = U.nowMs();
        Store.save();
        UI.render();
      };
    });
    $$('[data-reconall]').forEach(function (b) {
      b.onclick = function () {
        const wid = b.dataset.reconall;
        Store.get().txns.forEach(function (t) {
          if (t.walletId === wid && !t.reconciled && !t.deleted && t.date.slice(0, 7) === UI.state.month) {
            t.reconciled = true; t.updatedAt = U.nowMs();
          }
        });
        Store.save(); UI.render(); UI.toast('已全部標記');
      };
    });
    $$('[data-gid]').forEach(function (el) {
      el.onclick = function () { openGroup(el.dataset.gid); };
    });
    const ng = $('#newGroup');
    if (ng) ng.onclick = newGroup;

    // 借貸
    const al = $('#addLoan'); if (al) al.onclick = function () { editLoan(null); };
    $$('[data-loan]').forEach(function (el) {
      el.onclick = function (e) {
        if (e.target.hasAttribute('data-setloan')) return;
        editLoan(el.dataset.loan);
      };
    });
    $$('[data-setloan]').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        const l = Store.get().loans.find(function (x) { return x.id === b.dataset.setloan; });
        if (!l) return;
        l.settled = !l.settled;
        l.settledDate = l.settled ? U.today() : '';
        l.updatedAt = U.nowMs();
        Store.save(); UI.render();
      };
    });

    // 儲蓄目標
    const ag = $('#addGoal'); if (ag) ag.onclick = function () { editGoal(null); };
    $$('[data-goaladd]').forEach(function (b) { b.onclick = function () { depositGoal(b.dataset.goaladd); }; });
    $$('[data-goaledit]').forEach(function (b) { b.onclick = function () { editGoal(b.dataset.goaledit); }; });

    $$('[data-wdetail]').forEach(function (b) {
      b.onclick = function () { openWalletDetail(b.dataset.wdetail); };
    });

    // 餘額核對
    $$('[data-chkbal]').forEach(function (b) {
      b.onclick = function () {
        const wid = b.dataset.chkbal;
        const w = Data.wallet(wid);
        const calc = Data.walletBalance(wid);
        UI.prompt({
          title: w.name + ' 餘額核對',
          label: '輸入 App／卡上顯示的真實餘額（目前推算 HK$' + calc.toFixed(2) + '）',
          placeholder: '例如 123.4', ok: '核對'
        }).then(function (v) {
          if (v === null || v === '') return;
          const real = parseFloat(v);
          if (isNaN(real)) return;
          const diff = U.round2(real - calc);
          if (Math.abs(diff) < 0.01) { UI.toast('完全一致，沒有漏記'); return; }
          UI.confirm('差額 ' + U.fmtMoney(Math.abs(diff)),
            diff > 0 ? '實際餘額比記錄多，可能漏記了收入或支出記多了。要建立一筆校正記錄嗎？'
                     : '實際餘額比記錄少，可能漏記了支出。要建立一筆校正記錄嗎？',
            function () {
              Data.addTxn({
                type: diff > 0 ? 'income' : 'expense',
                amount: Math.abs(diff), hkd: Math.abs(diff), date: U.today(),
                categoryId: diff > 0 ? 'i_other' : 'c_other',
                walletId: wid, note: '餘額校正'
              });
              UI.render(); UI.toast('已建立校正記錄');
            }, '建立校正');
        });
      };
    });
  };

  global.__openGroup = openGroup;
})(window);
