/* ===== 記賬本 · ui-core.js — 版面骨架、彈層、提示 ===== */
(function (global) {
  'use strict';

  const UI = {
    state: {
      tab: 'add',
      month: U.thisMonth(),
      addType: 'expense',
      addDraft: { amount: '', categoryId: '', walletId: '', date: U.today(), note: '', tags: [] },
      statsScope: 'expense',
      sheet: null
    },
    screens: {},
    toastTimer: null
  };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return Charts.esc(s); }
  function h(strings) { return strings; }

  /* ---------- 提示 ---------- */
  UI.toast = function (msg, ms) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(UI.toastTimer);
    UI.toastTimer = setTimeout(function () { el.classList.remove('show'); }, ms || 1900);
  };

  /* ---------- 彈層 ---------- */
  UI.sheet = function (html, onMount) {
    UI.closeSheet();
    const mask = document.createElement('div');
    mask.className = 'sheet-mask';
    mask.id = 'sheetMask';
    mask.innerHTML = '<div class="sheet" role="dialog"><div class="grab"></div>' + html + '</div>';
    document.body.appendChild(mask);
    mask.addEventListener('click', function (e) {
      if (e.target === mask) UI.closeSheet();
    });
    const mount = function () {
      if (typeof onMount === 'function') onMount(mask);
    };
    setTimeout(mount, 0);
    return mask;
  };
  UI.closeSheet = function () {
    const m = $('#sheetMask');
    if (m) m.remove();
  };
  UI.confirm = function (title, text, onYes, yesLabel) {
    UI.sheet(
      '<h3>' + esc(title) + '</h3><div class="help">' + esc(text || '') + '</div>' +
      '<div class="sheet-actions"><button class="btn" data-x="no">取消</button>' +
      '<button class="btn danger" data-x="yes">' + esc(yesLabel || '確定刪除') + '</button></div>',
      function (root) {
        root.querySelector('[data-x="no"]').onclick = UI.closeSheet;
        root.querySelector('[data-x="yes"]').onclick = function () { UI.closeSheet(); onYes(); };
      }
    );
  };
  UI.prompt = function (opts) {
    return new Promise(function (resolve) {
      UI.sheet(
        '<h3>' + esc(opts.title || '') + '</h3>' +
        '<div class="frm"><div><label class="fl">' + esc(opts.label || '名稱') + '</label>' +
        '<input type="text" id="prIn" value="' + esc(opts.value || '') + '" placeholder="' + esc(opts.placeholder || '') + '"></div></div>' +
        '<div class="sheet-actions"><button class="btn" data-x="no">取消</button>' +
        '<button class="btn primary" data-x="yes">' + esc(opts.ok || '確定') + '</button></div>',
        function (root) {
          const inp = root.querySelector('#prIn');
          setTimeout(function () { inp.focus(); inp.select(); }, 60);
          root.querySelector('[data-x="no"]').onclick = function () { UI.closeSheet(); resolve(null); };
          root.querySelector('[data-x="yes"]').onclick = function () { const v = inp.value.trim(); UI.closeSheet(); resolve(v); };
          inp.onkeydown = function (e) { if (e.key === 'Enter') { const v = inp.value.trim(); UI.closeSheet(); resolve(v); } };
        }
      );
    });
  };

  /* ---------- 主題 ---------- */
  UI.applyTheme = function (t) {
    const light = t === 'light';
    document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', light ? '#f4f6fa' : '#0b0d12');
    // 通知 Android 外殼同步狀態欄與底色，避免淺色主題仍舊黑框
    try {
      if (window.AndroidBridge && window.AndroidBridge.setTheme) {
        window.AndroidBridge.setTheme(light ? 'light' : 'dark');
      }
    } catch (e) {}
  };
  UI.toggleTheme = function () {
    const s = Store.get().settings;
    s.theme = s.theme === 'light' ? 'dark' : 'light';
    s.updatedAt = U.nowMs();
    Store.get().settingsUpdatedAt = U.nowMs();
    Store.save();
    UI.applyTheme(s.theme);
    UI.render();
  };

  /* ---------- 導航 ---------- */
  const TABS = [
    { id: 'add', label: '記賬', icon: '✏️' },
    { id: 'list', label: '記錄', icon: '📋' },
    { id: 'stats', label: '圖表', icon: '📊' },
    { id: 'settle', label: '結算', icon: '🧮' },
    { id: 'setting', label: '設定', icon: '⚙️' }
  ];

  UI.go = function (tab) {
    UI.closeSheet();
    UI.state.tab = tab;
    UI.render();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  };

  UI.render = function () {
    const view = $('#view');
    if (!view) return;
    const fn = UI.screens[UI.state.tab] || UI.screens.add;
    view.innerHTML = fn();
    const hook = (UI.afterRenderHooks || {})[UI.state.tab];
    if (typeof hook === 'function') hook();
    if (typeof UI.afterRender === 'function') UI.afterRender(UI.state.tab);
    $$('.tabbar button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.tab === UI.state.tab);
    });
    document.body.dataset.tab = UI.state.tab;

    // 分頁切換過渡（同一頁重繪不播放，避免閃爍）
    const order = ['add', 'list', 'stats', 'settle', 'setting'];
    const tab = UI.state.tab;
    if (tab !== UI._prevTab) {
      const back = order.indexOf(tab) < order.indexOf(UI._prevTab || tab);
      view.classList.remove('page-in', 'back');
      void view.offsetWidth;          // 強制重排，讓動畫重新播放
      if (back) view.classList.add('back');
      view.classList.add('page-in');
      UI._prevTab = tab;
    }
  };

  /* ---------- 月份切換（通用） ---------- */
  UI.monthNav = function (ym, id) {
    return '<div class="mnav" id="' + id + '">' +
      '<button data-mv="-1">‹</button>' +
      '<div class="mv">' + U.monthLabel(ym) + '</div>' +
      '<button data-mv="1">›</button>' +
      '</div>';
  };
  UI.bindMonthNav = function (id, onChange) {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelectorAll('[data-mv]').forEach(function (b) {
      b.onclick = function () {
        UI.state.month = U.shiftMonth(UI.state.month, Number(b.dataset.mv));
        onChange();
      };
    });
  };

  /* ---------- 分類/錢包 選擇彈層 ---------- */
  UI.pickCategory = function (kind, current, cb) {
    const cats = Data.categories(kind);
    let html = '<h3>選擇分類</h3><div class="chips" style="flex-wrap:wrap;overflow:visible;gap:8px">';
    cats.forEach(function (c) {
      html += '<button class="chip' + (c.id === current ? ' on' : '') + '" data-c="' + c.id + '">' +
        '<span class="ci">' + esc(c.icon) + '</span>' + esc(c.name) + '</button>';
    });
    html += '</div>';
    UI.sheet(html, function (root) {
      root.querySelectorAll('[data-c]').forEach(function (b) {
        b.onclick = function () { UI.closeSheet(); cb(b.dataset.c); };
      });
    });
  };

  UI.pickWallet = function (current, cb, opts) {
    opts = opts || {};
    const ws = Data.wallets();
    let html = '<h3>' + esc(opts.title || '選擇錢包') + '</h3><div class="chips" style="flex-wrap:wrap;overflow:visible;gap:8px">';
    ws.forEach(function (w) {
      html += '<button class="chip' + (w.id === current ? ' on' : '') + '" data-w="' + w.id + '">' +
        '<span class="ci">' + esc(w.icon) + '</span>' + esc(w.name) + '</button>';
    });
    html += '</div>';
    UI.sheet(html, function (root) {
      root.querySelectorAll('[data-w]').forEach(function (b) {
        b.onclick = function () { UI.closeSheet(); cb(b.dataset.w); };
      });
    });
  };

  /* ---------- 小元件 ---------- */
  UI.chipRow = function (items, activeId, attr, extra) {
    let s = '<div class="chips">';
    items.forEach(function (it) {
      s += '<button class="chip' + (it.id === activeId ? ' on' : '') + '" data-' + attr + '="' + it.id + '">' +
        '<span class="ci">' + esc(it.icon || '') + '</span>' + esc(it.name) + '</button>';
    });
    return s + '</div>';
  };

  UI.statCard = function (k, v, cls) {
    return '<div class="stat"><div class="k">' + esc(k) + '</div><div class="v ' + (cls || '') + '">' + esc(v) + '</div></div>';
  };

  UI.emptyBlock = function (icon, title, sub) {
    return '<div class="empty"><span class="big">' + esc(icon) + '</span><b>' + esc(title) + '</b><br>' + esc(sub || '') + '</div>';
  };

  global.UI = UI;
  global.$ = $;
  global.$$ = $$;
  global.esc = esc;
})(window);
