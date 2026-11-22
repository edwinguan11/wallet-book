/* ===== 記賬本 · boot.js — 啟動 ===== */
(function (global) {
  'use strict';

  let pinBuf = '';

  UI.updateSyncDot = function (st) {
    const dot = document.getElementById('syncDot');
    if (!dot) return;
    dot.className = 'sync-dot' + (st === 'ok' ? ' on' : st === 'err' ? ' err' : st === 'busy' ? ' busy' : '');
  };

  function buildShell() {
    const tabs = [
      { id: 'add', label: '記賬', icon: '✏️' },
      { id: 'list', label: '記錄', icon: '📋' },
      { id: 'stats', label: '圖表', icon: '📊' },
      { id: 'settle', label: '結算', icon: '🧮' },
      { id: 'setting', label: '設定', icon: '⚙️' }
    ];
    const nav = document.getElementById('tabbar');
    nav.innerHTML = tabs.map(function (t) {
      return '<button data-tab="' + t.id + '"><span class="ti">' + t.icon + '</span>' + t.label + '</button>';
    }).join('');
    nav.querySelectorAll('button').forEach(function (b) {
      b.onclick = function () { UI.go(b.dataset.tab); };
    });

    document.getElementById('themeBtnTop').onclick = UI.toggleTheme;
    document.getElementById('syncBtnTop').onclick = function () {
      if (!Sync.configured()) {
        UI.state.tab = 'setting';
        UI.render();
        UI.toast('請先在下方設定同步');
        return;
      }
      Sync.sync();
    };
  }

  /* ---------- 密碼鎖 ---------- */
  function showLock(onOk) {
    const el = document.getElementById('lock');
    el.classList.remove('hidden');
    pinBuf = '';
    const dots = el.querySelector('.dots');
    const draw = function () {
      dots.innerHTML = [0, 1, 2, 3].map(function (i) {
        return '<i class="' + (i < pinBuf.length ? 'f' : '') + '"></i>';
      }).join('');
    };
    draw();
    const kp = el.querySelector('.kp');
    kp.innerHTML = '';
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].forEach(function (k) {
      const b = document.createElement('button');
      b.textContent = k;
      if (!k) b.style.visibility = 'hidden';
      b.onclick = function () {
        if (k === '⌫') pinBuf = pinBuf.slice(0, -1);
        else if (k) {
          if (pinBuf.length < 4) pinBuf += k;
          if (pinBuf.length === 4) {
            if (pinBuf === Store.get().settings.pin) {
              el.classList.add('hidden');
              onOk && onOk();
              return;
            } else {
              pinBuf = '';
              el.querySelector('.lg').style.transform = 'translateX(-6px)';
              setTimeout(function () { el.querySelector('.lg').style.transform = ''; }, 160);
              if (navigator.vibrate) navigator.vibrate([25, 40, 25]);
            }
          }
        }
        draw();
      };
      kp.appendChild(b);
    });
  }

  /* ---------- 以一鍵連結／ QR 碼設定同步 ---------- */
  function applyHashSync() {
    const h = location.hash || '';
    const m = h.match(/sync=([^&]+)/);
    if (!m) return false;
    try {
      const json = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
      const db = Store.get();
      if (json.t) db.settings.sync.token = json.t;
      if (json.g) db.settings.sync.gistId = json.g;
      db.settings.sync.auto = true;
      db.settingsUpdatedAt = U.nowMs();
      Store.save({ silent: true });
      history.replaceState(null, '', location.pathname + location.search);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------- 啟動 ---------- */
  function boot() {
    Store.load();
    const hashApplied = applyHashSync();
    UI.applyTheme(Store.get().settings.theme);
    UI.state.month = U.thisMonth();
    buildShell();

    const start = function () {
      UI.render();
      UI.updateSyncDot(Sync.configured() ? (Sync.status === 'ok' ? 'ok' : '') : 'off');
      if (hashApplied) {
        UI.toast('同步設定已套用，正在同步…', 2400);
        setTimeout(function () { Sync.sync(); }, 900);
      } else if (Sync.configured()) {
        setTimeout(function () { Sync.sync({ quiet: true }); }, 1200);
      }
      if (!Store.get().settings.onboarded) {
        setTimeout(showWelcome, 700);
      }
    };

    if (Store.get().settings.pin) showLock(start);
    else start();

    // Service worker
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    }

    // 回到前景時自動同步
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && Sync.configured()) Sync.sync({ quiet: true });
    });

    // 避免 iOS 雙擊放大
    let lastTouch = 0;
    document.addEventListener('touchend', function (e) {
      const now = Date.now();
      if (now - lastTouch <= 300) e.preventDefault();
      lastTouch = now;
    }, { passive: false });
  }

  function showWelcome() {
    const html = '<h3>歡迎使用記賬本</h3>' +
      '<div class="help">' +
      '<b>三個步驟開始記賬：</b><br>' +
      '1. 輸入金額<br>' +
      '2. 選擇分類與付款的錢包（八達通、PayMe、AlipayHK 等）<br>' +
      '3. 按「記一筆」<br><br>' +
      '<b>幾個重要觀念：</b><br>' +
      '· 八達通「增值」請記為轉賬，不要記成支出，否則會重複計算。<br>' +
      '· 信用卡簽賬時記錄支出，找卡數時記轉賬。<br>' +
      '· 在「結算 → 朋友分賬」可以處理聚餐、旅行的 AA 分賬。<br><br>' +
      '想換手機／電腦共用同一份資料，請到「設定 → 設定同步」。' +
      '</div><div class="sheet-actions"><button class="btn primary" id="okGo">開始使用</button></div>';
    UI.sheet(html, function (root) {
      root.querySelector('#okGo').onclick = function () {
        Store.get().settings.onboarded = true;
        Store.get().settingsUpdatedAt = U.nowMs();
        Store.save({ silent: true });
        UI.closeSheet();
      };
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
