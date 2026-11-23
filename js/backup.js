/* ===== 記賬本 · backup.js — 每週自動備份（保留 4 份） ===== */
(function (global) {
  'use strict';

  const WEEK = 7 * 24 * 3600 * 1000;
  const MAX_BACKUPS = 4;

  function nativeOk() {
    return !!(global.AndroidBridge && global.AndroidBridge.saveFile);
  }

  function fileName() {
    return '荷包記備份-' + U.today() + '.json';
  }

  function stamp() {
    const ts = Store.get().settings.lastAutoBackup || 0;
    if (!ts) return '從未備份';
    const d = new Date(ts);
    const p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function daysSince() {
    const ts = Store.get().settings.lastAutoBackup || 0;
    if (!ts) return 999;
    return Math.floor((U.nowMs() - ts) / (24 * 3600 * 1000));
  }

  /* 立即備份。native=true 時寫入手機「下載」資料夾 */
  function run(opts) {
    opts = opts || {};
    const json = Store.exportJSON();
    const name = fileName();

    if (nativeOk()) {
      try {
        const b64 = btoa(unescape(encodeURIComponent(json)));
        global.AndroidBridge.saveFile(name, 'application/json', b64);
        try { global.AndroidBridge.pruneBackups(MAX_BACKUPS); } catch (e) {}
        Store.get().settings.lastAutoBackup = U.nowMs();
        Store.save({ silent: true });
        if (!opts.quiet && global.UI) UI.toast('已備份到手機「下載」資料夾');
        if (global.UI) UI.render();
        return { ok: true, native: true, name: name };
      } catch (e) { /* 落回瀏覽器下載 */ }
    }

    try {
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 900);
      Store.get().settings.lastAutoBackup = U.nowMs();
      Store.save({ silent: true });
      if (!opts.quiet && global.UI) UI.toast('已匯出備份檔');
      if (global.UI) UI.render();
      return { ok: true, native: false, name: name };
    } catch (e) {
      if (global.UI) UI.toast('備份失敗：' + e.message, 3000);
      return { ok: false, msg: e.message };
    }
  }

  /* 開 App 時檢查：滿 7 天就自動備份（只在 App 內自動，瀏覽器會提示） */
  function auto() {
    const s = Store.get().settings;
    if (s.autoBackup === false) return;
    if (!nativeOk()) return;               // 瀏覽器自動下載會被封鎖，改為提示
    if (daysSince() < 7) return;
    setTimeout(function () { run({ quiet: true }); }, 2500);
  }

  global.Backup = {
    run: run,
    auto: auto,
    stamp: stamp,
    daysSince: daysSince,
    nativeOk: nativeOk,
    MAX: MAX_BACKUPS
  };
})(window);
