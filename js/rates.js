/* ===== 記賬本 · rates.js — 連網自動更新匯率（open.er-api.com，免費無需金鑰）===== */
(function (global) {
  'use strict';

  const API = 'https://open.er-api.com/v6/latest/HKD';
  const MAX_AGE = 6 * 3600 * 1000; // 6 小時
  let busy = false;
  let lastErr = '';

  function cfg() { return Store.get().settings; }

  function fmtTime(ts) {
    if (!ts) return '未更新';
    const d = new Date(ts);
    const p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  async function update(opts) {
    opts = opts || {};
    const s = cfg();
    if (busy) return { ok: false, msg: '更新中' };
    if (!navigator.onLine) return { ok: false, msg: '目前離線' };
    if (s.ratesAuto === false && !opts.force) return { ok: true, msg: '手動模式', cached: true };
    if (!opts.force && s.ratesUpdatedAt && (Date.now() - s.ratesUpdatedAt) < MAX_AGE) {
      return { ok: true, msg: '仍是最新', cached: true };
    }
    busy = true;
    try {
      const res = await fetch(API, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      if (j.result !== 'success' || !j.rates) throw new Error('回應格式不正確');
      // API：1 HKD = rates[X] 單位 X → 反過來得到 1 X = ? HKD
      Object.keys(s.rates).forEach(function (cur) {
        if (cur === 'HKD') { s.rates[cur] = 1; return; }
        const r = j.rates[cur];
        if (r && r > 0) s.rates[cur] = Math.round((1 / r) * 10000) / 10000;
      });
      s.ratesUpdatedAt = Date.now();
      Store.get().settingsUpdatedAt = Date.now();
      Store.save({ silent: true });
      busy = false;
      lastErr = '';
      if (global.UI && global.UI.state && global.UI.state.tab === 'setting') global.UI.render();
      return { ok: true, msg: '匯率已更新' };
    } catch (e) {
      busy = false;
      lastErr = e.message || '更新失敗';
      return { ok: false, msg: lastErr };
    }
  }

  global.Rates = {
    update: update,
    auto: function () {
      if (cfg().ratesAuto === false) return;      // 使用者已改為手動
      setTimeout(function () { update({}); }, 1500);
    },
    label: function () { return fmtTime(cfg().ratesUpdatedAt); },
    get lastErr() { return lastErr; }
  };
})(window);
