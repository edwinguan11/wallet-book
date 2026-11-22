/* ===== 記賬本 · ui-settings.js — 設定頁 ===== */
(function (global) {
  'use strict';

  const ICONS = ['💵', '🐙', '📱', '👛', '💗', '🔵', '🟢', '🏦', '📶', '⭐', '⚡', '🦁', '🏛️', '🟩', '🟣', '🔷', '💳', '🧧', '🎫', '🏪'];
  const COLORS = ['#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4',
    '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#6b7280'];

  function download(name, text, mime) {
    // 在 Android App 內：交給原生儲存到「下載」資料夾
    try {
      if (window.AndroidBridge && window.AndroidBridge.saveFile) {
        const b64 = btoa(unescape(encodeURIComponent(text)));
        window.AndroidBridge.saveFile(name, mime || 'application/json', b64);
        return;
      }
    } catch (e) { /* 落回瀏覽器下載 */ }
    const blob = new Blob([text], { type: mime || 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 800);
  }

  function toCSV() {
    const head = ['日期', '類型', '分類', '錢包', '轉入錢包', '金額', '貨幣', '匯率', '港幣金額', '備註', '標籤', '已對賬'];
    const rows = [head.join(',')];
    const q = function (s) {
      s = String(s == null ? '' : s);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    Data.txns().forEach(function (t) {
      rows.push([
        t.date,
        t.type === 'expense' ? '支出' : t.type === 'income' ? '收入' : '轉賬',
        t.type === 'transfer' ? '' : Data.category(t.categoryId).name,
        Data.wallet(t.walletId).name,
        t.toWalletId ? Data.wallet(t.toWalletId).name : '',
        t.amount, t.currency || 'HKD', t.rate || 1, t.hkd,
        t.note || '', (t.tags || []).join(' '), t.reconciled ? '是' : ''
      ].map(q).join(','));
    });
    return '\ufeff' + rows.join('\r\n');
  }

  UI.screens.setting = function () {
    const db = Store.get();
    const s = db.settings;
    const ws = Data.wallets();
    const cats = Data.categories();

    const expanded = !!UI.state.walletsExpanded;
    const shownWallets = expanded ? ws : ws.slice(0, 5);

    let html = '<div class="h-sec" style="margin-top:0">錢包</div><div class="card">';
    shownWallets.forEach(function (w) {
      const bal = Data.walletBalance(w.id);
      const isCredit = w.type === 'credit';
      html += '<div class="wrow" data-ew="' + w.id + '">' +
        '<span style="font-size:17px">' + esc(w.icon) + '</span>' +
        '<span class="grow ellip">' + esc(w.name) + '<div class="mini-k">' +
        esc((CONST.WALLET_TYPES.find(function (x) { return x.id === w.type; }) || {}).label || '其他') +
        (w.currency && w.currency !== 'HKD' ? ' · ' + w.currency : '') +
        '</div></span>' +
        '<span class="mono" style="font-size:13px;' + (bal < 0 ? 'color:var(--red)' : '') + '">' +
        U.fmtMoney(bal) + '</span>' +
        '<span class="muted" style="font-size:15px">›</span></div>';
    });
    if (ws.length > 5) {
      html += '<div style="margin-top:10px"><button class="btn block" id="toggleWallets">' +
        (expanded ? '收起錢包列表' : '顯示全部 ' + ws.length + ' 個錢包') + '</button></div>';
    }
    html += '<div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
      '<button class="btn" id="orderWallet">⇅ 排序</button>' +
      '<button class="btn" id="addWallet">＋ 新增</button></div></div>';

    html += '<div class="h-sec">分類</div><div class="card">' +
      '<div class="row between"><span class="mini-k">支出 ' + Data.categories('expense').length +
      ' 個 · 收入 ' + Data.categories('income').length + ' 個</span>' +
      '<span style="display:flex;gap:6px"><button class="btn sm" id="orderCat">⇅ 排序</button>' +
      '<button class="btn sm" id="addCat">＋ 新增</button></span></div>' +
      '<div class="chips" style="flex-wrap:wrap;overflow:visible;gap:7px;margin-top:10px">';
    cats.forEach(function (c) {
      html += '<button class="chip" data-ec="' + c.id + '"><span class="ci">' + esc(c.icon) + '</span>' + esc(c.name) + '</button>';
    });
    html += '</div></div>';

    html += '<div class="h-sec">外幣匯率（兌港幣）</div><div class="card">' +
      '<div class="row between" style="margin-bottom:10px"><div class="help">記錄外幣消費時按此換算為港幣。</div>' +
      '<button class="btn sm primary" id="refreshRates">更新匯率</button></div>' +
      '<div class="mini-k" style="margin-bottom:10px">連網時自動更新（每 6 小時一次）· 上次更新：' +
      esc(Rates ? Rates.label() : '—') + '</div><div class="frm">';
    Object.keys(s.rates).forEach(function (k) {
      html += '<div class="row"><span style="width:60px;font-size:13px">' + k + '</span>' +
        '<input type="number" step="0.0001" class="rateIn" data-r="' + k + '" value="' + s.rates[k] + '" style="flex:1;padding:7px 10px"></div>';
    });
    html += '</div><div style="margin-top:10px"><button class="btn block" id="saveRates">儲存匯率</button></div></div>';

    html += '<div class="h-sec">資料</div><div class="card">' +
      '<div class="help" style="margin-bottom:12px">共 ' + Data.txns().length + ' 筆記錄。建議每週匯出一次備份。</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
      '<button class="btn" id="expJson">匯出備份（JSON）</button>' +
      '<button class="btn" id="expCsv">匯出表格（CSV）</button>' +
      '<button class="btn" id="impJson">匯入備份</button>' +
      '<button class="btn danger" id="clearAll">清除全部資料</button>' +
      '</div></div>';

    html += '<div class="h-sec">外觀與安全</div><div class="card">' +
      '<div class="row between" style="padding:6px 0"><span style="font-size:14px">深色模式</span>' +
      '<button class="btn sm" id="themeBtn">' + (s.theme === 'light' ? '目前：淺色' : '目前：深色') + '</button></div>' +
      '<div class="divider"></div>' +
      '<div class="row between" style="padding:6px 0"><span style="font-size:14px">開啟密碼鎖</span>' +
      '<button class="btn sm" id="pinBtn">' + (s.pin ? '已開啟（更改／關閉）' : '未開啟') + '</button></div></div>';

    html += '<div class="h-sec">關於</div><div class="card">' +
      '<div class="row between" style="margin-bottom:10px"><span style="font-size:14px;font-weight:600">Android App</span>' +
      '<a class="btn sm primary" href="wallet-book.apk" download>下載 APK</a></div>' +
      '<div class="help" style="margin-bottom:12px">安裝後可離線使用，資料存在手機內。App 會自動載入最新網頁版，功能更新不需要重新安裝。</div>' +
      '<div class="help"><b>記賬本</b> v1.0.0 · 香港支付方式全覆蓋<br>' +
      '所有資料預設儲存在此裝置的瀏覽器內，不會上傳到任何伺服器（同步功能只會寫入你自己的私有 Gist）。<br><br>' +
      '小提示：在手機瀏覽器選單中選擇「加到主畫面」，即可像 App 一樣使用。</div></div>';

    return html;
  };

  /* ---------- 錢包編輯 ---------- */
  function editWallet(id) {
    const isNew = !id;
    const db = Store.get();
    const w = isNew
      ? { id: U.uid('w'), name: '', type: 'emoney', icon: '💳', color: '#60a5fa', opening: 0 }
      : db.wallets.find(function (x) { return x.id === id; });
    if (!w) return;

    let html = '<h3>' + (isNew ? '新增錢包' : '編輯錢包') + '</h3><div class="frm">' +
      '<div class="two"><div><label class="fl">名稱</label><input type="text" id="wName" value="' + esc(w.name) + '" placeholder="例如 八達通"></div>' +
      '<div><label class="fl">類型</label><select id="wType">' +
      CONST.WALLET_TYPES.map(function (t) {
        return '<option value="' + t.id + '"' + (t.id === w.type ? ' selected' : '') + '>' + t.label + '</option>';
      }).join('') + '</select></div></div>' +
      '<div><label class="fl">圖示</label><div class="chips" style="flex-wrap:wrap;overflow:visible;gap:6px">' +
      ICONS.map(function (ic) {
        return '<button class="chip' + (ic === w.icon ? ' on' : '') + '" data-ic="' + ic + '" style="padding:6px 9px">' + ic + '</button>';
      }).join('') + '</div></div>' +
      '<div><label class="fl">顏色</label><div class="chips" style="flex-wrap:wrap;overflow:visible;gap:6px">' +
      COLORS.map(function (c) {
        return '<button class="chip" data-col="' + c + '" style="padding:6px 9px;' +
          (c === w.color ? 'outline:2px solid ' + c + ';outline-offset:1px;' : '') + '">' +
          '<span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:' + c + '"></span></button>';
      }).join('') + '</div></div>' +
      '<div><label class="fl">這個錢包使用的貨幣</label><select id="wCur">' +
      ['HKD', 'CNY', 'JPY', 'TWD', 'KRW', 'THB', 'USD', 'GBP', 'EUR', 'SGD', 'MYR'].map(function (cc) {
        return '<option value="' + cc + '"' + (cc === (w.currency || 'HKD') ? ' selected' : '') + '>' + cc + '</option>';
      }).join('') + '</select></div>' +
      '<div><label class="fl">期初餘額（信用卡欠款請填負數）</label>' +
      '<input type="number" id="wOpen" step="0.01" value="' + (w.opening || 0) + '"></div>' +
      '</div><div class="sheet-actions">' +
      (isNew ? '' : '<button class="btn danger" id="wDel">刪除</button>') +
      '<button class="btn primary" id="wSave">儲存</button></div>';

    UI.sheet(html, function (root) {
      let icon = w.icon, color = w.color;
      root.querySelectorAll('[data-ic]').forEach(function (b) {
        b.onclick = function () {
          icon = b.dataset.ic;
          root.querySelectorAll('[data-ic]').forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on');
        };
      });
      root.querySelectorAll('[data-col]').forEach(function (b) {
        b.onclick = function () {
          color = b.dataset.col;
          root.querySelectorAll('[data-col]').forEach(function (x) { x.style.outline = ''; });
          b.style.outline = '2px solid ' + color; b.style.outlineOffset = '1px';
        };
      });
      root.querySelector('#wSave').onclick = function () {
        const name = root.querySelector('#wName').value.trim();
        if (!name) { UI.toast('請輸入名稱'); return; }
        const patch = {
          name: name,
          type: root.querySelector('#wType').value,
          currency: root.querySelector('#wCur').value,
          icon: icon, color: color,
          opening: parseFloat(root.querySelector('#wOpen').value) || 0,
          updatedAt: U.nowMs()
        };
        if (isNew) {
          db.wallets.push(Object.assign({ id: w.id, deleted: false, currency: 'HKD', note: '' }, patch));
        } else {
          Object.assign(w, patch);
        }
        Store.save();
        UI.closeSheet();
        UI.render();
        UI.toast('已儲存');
      };
      const del = root.querySelector('#wDel');
      if (del) del.onclick = function () {
        const used = Data.txns().filter(function (t) { return t.walletId === id || t.toWalletId === id; }).length;
        UI.closeSheet();
        UI.confirm('刪除「' + w.name + '」？',
          used ? '此錢包有 ' + used + ' 筆記錄，刪除後這些記錄的錢包名稱會顯示為「已刪除」。' : '此操作無法復原。',
          function () {
            w.deleted = true; w.updatedAt = U.nowMs(); Store.save(); UI.render(); UI.toast('已刪除');
          });
      };
    });
  }

  /* ---------- 分類編輯 ---------- */
  function editCat(id) {
    const isNew = !id;
    const db = Store.get();
    const c = isNew
      ? { id: U.uid('c'), name: '', icon: '🏷️', color: '#8b5cf6', kind: 'expense' }
      : db.categories.find(function (x) { return x.id === id; });
    if (!c) return;

    const html = '<h3>' + (isNew ? '新增分類' : '編輯分類') + '</h3><div class="frm">' +
      '<div class="two"><div><label class="fl">名稱</label><input type="text" id="cName" value="' + esc(c.name) + '"></div>' +
      '<div><label class="fl">屬於</label><select id="cKind"' + (isNew ? '' : ' disabled') + '>' +
      '<option value="expense"' + (c.kind === 'expense' ? ' selected' : '') + '>支出</option>' +
      '<option value="income"' + (c.kind === 'income' ? ' selected' : '') + '>收入</option></select></div></div>' +
      '<div><label class="fl">圖示</label><div class="chips" style="flex-wrap:wrap;overflow:visible;gap:6px">' +
      ['🍜', '🍱', '☕', '🧋', '🚇', '🚌', '🚕', '🛍️', '👕', '📱', '🎮', '🎬', '📚', '✏️',
        '💡', '🏠', '💊', '🎁', '✈️', '🏃', '🐾', '📈', '🧾', '❓', '🧧', '💼', '🏦', '🏷️'].map(function (ic) {
        return '<button class="chip' + (ic === c.icon ? ' on' : '') + '" data-ic="' + ic + '" style="padding:6px 9px">' + ic + '</button>';
      }).join('') + '</div></div>' +
      '<div><label class="fl">顏色</label><div class="chips" style="flex-wrap:wrap;overflow:visible;gap:6px">' +
      COLORS.map(function (col) {
        return '<button class="chip" data-col="' + col + '" style="padding:6px 9px">' +
          '<span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:' + col + '"></span></button>';
      }).join('') + '</div></div></div>' +
      '<div class="sheet-actions">' + (isNew ? '' : '<button class="btn danger" id="cDel">刪除</button>') +
      '<button class="btn primary" id="cSave">儲存</button></div>';

    UI.sheet(html, function (root) {
      let icon = c.icon, color = c.color;
      root.querySelectorAll('[data-ic]').forEach(function (b) {
        b.onclick = function () {
          icon = b.dataset.ic;
          root.querySelectorAll('[data-ic]').forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on');
        };
      });
      root.querySelectorAll('[data-col]').forEach(function (b) {
        b.onclick = function () {
          color = b.dataset.col;
          root.querySelectorAll('[data-col]').forEach(function (x) { x.style.outline = ''; });
          b.style.outline = '2px solid ' + color;
        };
      });
      root.querySelector('#cSave').onclick = function () {
        const name = root.querySelector('#cName').value.trim();
        if (!name) { UI.toast('請輸入名稱'); return; }
        if (isNew) {
          db.categories.push({
            id: c.id, name: name, icon: icon, color: color,
            kind: root.querySelector('#cKind').value, updatedAt: U.nowMs(), deleted: false
          });
        } else {
          Object.assign(c, { name: name, icon: icon, color: color, updatedAt: U.nowMs() });
        }
        Store.save(); UI.closeSheet(); UI.render(); UI.toast('已儲存');
      };
      const del = root.querySelector('#cDel');
      if (del) del.onclick = function () {
        UI.closeSheet();
        UI.confirm('刪除分類「' + c.name + '」？', '已記錄的項目仍會保留，但會顯示為「其他」。', function () {
          c.deleted = true; c.updatedAt = U.nowMs(); Store.save(); UI.render(); UI.toast('已刪除');
        });
      };
    });
  }

  /* ---------- 同步設定 ---------- */
  function syncSetup() {
    const c = Store.get().settings.sync;
    const tokUrl = 'https://github.com/settings/tokens/new?scopes=gist&description=wallet-book';
    const html = '<h3>設定跨裝置同步</h3>' +
      '<div class="help" style="margin-bottom:12px">' +
      '同步以 GitHub 的「私有 Gist」作雲端儲存：手機與電腦看到同一份記錄，資料不經第三方伺服器。' +
      '</div>' +
      '<a class="btn primary block" href="' + tokUrl + '" target="_blank" rel="noopener" id="tokLink">① 開啟 GitHub 建立權杖</a>' +
      '<div class="help" style="margin:10px 0 14px">' +
      '開啟後：<b>Note</b> 隨便填（例如 wallet-book）→ <b>Expiration</b> 選 No expiration → ' +
      '下面權限只需勾選 <b>gist</b>（其他全部留空）→ 拉到最底按 <b>Generate token</b> → 複製 <code>ghp_...</code>。' +
      '</div>' +
      '<div class="h-sec" style="margin:0 0 8px">② 貼上權杖</div>' +
      '<div class="frm">' +
      '<div><label class="fl">GitHub 權杖（Token）</label>' +
      '<input type="password" id="sToken" value="' + esc(c.token) + '" placeholder="github_pat_... 或 ghp_..."></div>' +
      '<div><label class="fl">Gist ID</label>' +
      '<input type="text" id="sGist" value="' + esc(c.gistId) + '" placeholder="可留空，會自動尋回雲端備份"></div>' +
      '<div class="row"><label style="flex:1;font-size:13.5px"><input type="checkbox" id="sAuto"' + (c.auto ? ' checked' : '') +
      ' style="width:auto;margin-right:8px">自動同步（修改後約 4 秒）</label></div>' +
      '</div>' +
      '<div class="sheet-actions"><button class="btn" id="sMake">③ 建立新的 Gist</button>' +
      '<button class="btn primary" id="sSave">儲存並同步</button></div>';

    UI.sheet(html, function (root) {
      const save = function () {
        const s = Store.get().settings;
        s.sync.token = root.querySelector('#sToken').value.trim();
        const gv = root.querySelector('#sGist').value.trim();
        // 不要把已有的 Gist ID 清空（避免誤按儲存就斷開連線）
        s.sync.gistId = gv || (s.sync.gistId || '');
        s.sync.auto = root.querySelector('#sAuto').checked;
        Store.get().settingsUpdatedAt = U.nowMs();
        Store.save({ silent: true });
      };
      root.querySelector('#sSave').onclick = async function () {
        save();
        if (!Store.get().settings.sync.token) { UI.toast('請先貼上權杖'); return; }
        UI.closeSheet();
        UI.render();
        UI.toast('正在連接雲端備份…', 1600);
        const r = await Sync.sync({ quiet: true });
        UI.render();
        UI.toast(r.ok ? '同步完成，兩部裝置已連接' : ('同步失敗：' + r.msg), 3400);
      };
      root.querySelector('#sMake').onclick = async function () {
        save();
        if (!root.querySelector('#sToken').value.trim()) { UI.toast('請先貼上權杖'); return; }
        UI.toast('正在建立 Gist…');
        try {
          const id = await Sync.createGist();
          root.querySelector('#sGist').value = id;
          UI.closeSheet();
          UI.render();
          UI.toast('Gist 已建立，正在上傳資料…', 2200);
          const r = await Sync.sync({ quiet: true });
          UI.render();
          UI.toast(r.ok ? '同步完成，已可掃碼連接手機' : ('同步失敗：' + r.msg), 3200);
        } catch (e) {
          UI.toast('建立失敗：' + e.message, 3000);
        }
      };
    });
  }

  /* ---------- 手機掃碼同步 ---------- */
  function showSyncQR() {
    const c = Store.get().settings.sync;
    if (!c.token) { UI.toast('請先按「設定同步」貼上權杖'); return; }
    if (!c.gistId) { UI.toast('請先按「③ 建立新的 Gist」'); return; }
    const payload = JSON.stringify({ t: c.token, g: c.gistId });
    const b64 = btoa(unescape(encodeURIComponent(payload)));
    const url = location.origin + location.pathname + '#sync=' + encodeURIComponent(b64);
    let svg = '';
    try {
      const qr = window.qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      svg = qr.createSvgTag({ cellSize: 4, margin: 1 });
    } catch (e) {
      svg = '<div class="help">無法產生 QR 碼</div>';
    }
    UI.sheet('<h3>用手機掃描</h3>' +
      '<div style="background:#fff;padding:12px;border-radius:16px;max-width:260px;margin:0 auto;display:flex;justify-content:center">' +
      '<div style="width:100%">' + svg + '</div></div>' +
      '<div class="help" style="margin-top:14px">用 iPhone／Android 的相機掃描上面的碼，會自動打開記賬本並套用同一組同步設定。<br><br>' +
      '「設定 → 加到主畫面」後就像 App 一樣使用。<br><br>' +
      '<b>這個碼包含你的權杖，請勿截圖或傳給別人。</b></div>' +
      '<div class="sheet-actions"><button class="btn primary" id="qrClose">完成</button></div>',
      function (root) {
        const sv = root.querySelector('svg');
        if (sv) { sv.setAttribute('style', 'width:100%;height:auto;display:block'); sv.removeAttribute('width'); sv.removeAttribute('height'); }
        root.querySelector('#qrClose').onclick = UI.closeSheet;
      });
  }

  /* ---------- 排序（記賬頁顯示次序） ---------- */
  function openOrder(initialKind) {
    let kind = initialKind || 'expense';

    function items() {
      if (kind === 'wallet') return Data.wallets();
      return Data.categories(kind);
    }

    function move(arr, i, dir) {
      const j = i + dir;
      if (j < 0 || j >= arr.length) return;
      arr.forEach(function (o, k) { o.sort = k; });
      const a = arr[i], b2 = arr[j];
      const t = a.sort; a.sort = b2.sort; b2.sort = t;
      a.updatedAt = U.nowMs(); b2.updatedAt = U.nowMs();
      Store.save();
    }

    function draw(root) {
      const arr = items();
      const tabs = [['expense', '支出分類'], ['income', '收入分類'], ['wallet', '錢包']];
      let h = '<div class="seg three" style="margin-bottom:10px">' + tabs.map(function (t) {
        return '<button data-k="' + t[0] + '" class="' + (kind === t[0] ? 'on' : '') + '">' + t[1] + '</button>';
      }).join('') + '</div>';
      h += '<div class="help" style="margin-bottom:10px">越上面越先出現在記賬頁。用 ▲ ▼ 調整次序，會即時套用。</div>';
      h += '<div class="ord-list">';
      arr.forEach(function (it, i) {
        h += '<div class="ord-row">' +
          '<span class="ord-ic">' + esc(it.icon) + '</span>' +
          '<span class="grow ellip" style="font-size:13.5px">' + esc(it.name) + '</span>' +
          '<button class="ord-btn" data-up="' + i + '"' + (i === 0 ? ' disabled' : '') + '>▲</button>' +
          '<button class="ord-btn" data-dn="' + i + '"' + (i === arr.length - 1 ? ' disabled' : '') + '>▼</button>' +
          '</div>';
      });
      h += '</div>';
      root.innerHTML = '<h3>排序</h3>' + h +
        '<div class="sheet-actions"><button class="btn primary" id="ordDone">完成</button></div>';

      root.querySelectorAll('[data-k]').forEach(function (b) {
        b.onclick = function () { kind = b.dataset.k; draw(root); };
      });
      root.querySelectorAll('[data-up]').forEach(function (b) {
        b.onclick = function () { move(items(), +b.dataset.up, -1); draw(root); UI.render(); };
      });
      root.querySelectorAll('[data-dn]').forEach(function (b) {
        b.onclick = function () { move(items(), +b.dataset.dn, 1); draw(root); UI.render(); };
      });
      root.querySelector('#ordDone').onclick = function () { UI.closeSheet(); UI.render(); };
    }

    UI.sheet('<h3>排序</h3>', function (root) { draw(root); });
  }

  /* ---------- 密碼鎖 ---------- */
  function pinSetup() {
    const s = Store.get().settings;
    if (s.pin) {
      UI.confirm('關閉密碼鎖？', '關閉後開啟應用程式將不再要求輸入密碼。', function () {
        s.pin = ''; Store.get().settingsUpdatedAt = U.nowMs(); Store.save(); UI.render(); UI.toast('已關閉密碼鎖');
      }, '關閉');
      return;
    }
    UI.prompt({ title: '設定 4 位數字密碼', label: '密碼', placeholder: '例如 2580' }).then(function (v) {
      if (!v) return;
      if (!/^\d{4}$/.test(v)) { UI.toast('請輸入 4 位數字'); return; }
      s.pin = v; Store.get().settingsUpdatedAt = U.nowMs(); Store.save(); UI.render();
      UI.toast('密碼鎖已開啟，下次開啟需輸入');
    });
  }

  UI.afterRenderHooks.setting = function () {
    $$('[data-ew]').forEach(function (el) {
      el.onclick = function () { editWallet(el.dataset.ew); };
      el.style.cursor = 'pointer';
    });
    $$('[data-ec]').forEach(function (el) {
      el.onclick = function () { editCat(el.dataset.ec); };
    });
    const tw = $('#toggleWallets');
    if (tw) tw.onclick = function () {
      UI.state.walletsExpanded = !UI.state.walletsExpanded;
      UI.render();
    };
    const ow = $('#orderWallet'); if (ow) ow.onclick = function () { openOrder('wallet'); };
    const oc2 = $('#orderCat'); if (oc2) oc2.onclick = function () { openOrder('expense'); };
    const aw = $('#addWallet'); if (aw) aw.onclick = function () { editWallet(null); };
    const ac = $('#addCat'); if (ac) ac.onclick = function () { editCat(null); };





;
    const rr = $('#refreshRates'); if (rr) rr.onclick = async function () {
      rr.disabled = true; rr.textContent = '更新中…';
      const r = await Rates.update({ force: true });
      UI.toast(r.ok ? '匯率已更新' : ('更新失敗：' + r.msg), 2600);
      UI.render();
    };
    const sr = $('#saveRates'); if (sr) sr.onclick = function () {
      const s = Store.get().settings;
      $$('.rateIn').forEach(function (i) { s.rates[i.dataset.r] = parseFloat(i.value) || 1; });
      Store.get().settingsUpdatedAt = U.nowMs();
      Store.save(); UI.toast('匯率已儲存');
    };
    const ej = $('#expJson'); if (ej) ej.onclick = function () {
      download('記賬本備份-' + U.today() + '.json', Store.exportJSON());
      UI.toast('已匯出備份');
    };
    const ec = $('#expCsv'); if (ec) ec.onclick = function () {
      download('記賬本-' + U.today() + '.csv', toCSV(), 'text/csv;charset=utf-8');
      UI.toast('已匯出 CSV');
    };
    const ij = $('#impJson'); if (ij) ij.onclick = function () { importFile(); };
    const ca = $('#clearAll'); if (ca) ca.onclick = function () {
      UI.confirm('清除全部資料？', '所有記錄、錢包、預算與分賬群組都會被刪除。建議先匯出備份。', function () {
        Store.reset();
        UI.state.month = U.thisMonth();
        UI.render();
        UI.toast('已重設');
      }, '全部清除');
    };
    const tb = $('#themeBtn'); if (tb) tb.onclick = UI.toggleTheme;
    const pb = $('#pinBtn'); if (pb) pb.onclick = pinSetup;
  };

  function importFile() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = function () {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = function () {
        try {
          const data = Store.importJSON(rd.result);
          UI.render();
          UI.toast('已匯入 ' + data.txns.length + ' 筆記錄');
        } catch (e) {
          UI.toast('匯入失敗：' + e.message, 3000);
        }
      };
      rd.readAsText(f);
    };
    inp.click();
  }

  global.__editWallet = editWallet;
})(window);
