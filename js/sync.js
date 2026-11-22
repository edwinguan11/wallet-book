/* ===== 記賬本 · sync.js — 備份碼雲端備份（kvdb.io，免登入、不會過期）===== */
(function (global) {
  'use strict';

  const ROOT = 'https://kvdb.io/';
  const DATA_KEY = 'ledger';
  let busy = false;
  let lastErr = '';
  let status = 'off';
  let timer = null;

  function cfg() { return Store.get().settings; }
  function cloud() {
    if (!cfg().cloud) cfg().cloud = { code: '', lastSync: 0, auto: true };
    if (cfg().cloud.auto === undefined) cfg().cloud.auto = true;
    return cfg().cloud;
  }
  function configured() { return !!cloud().code; }

  function setStatus(s, msg) {
    status = s;
    if (msg !== undefined) lastErr = msg;
    if (global.UI && UI.updateSyncDot) UI.updateSyncDot(s);
  }

  async function createCode() {
    const res = await fetch(ROOT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'email=wallet-book@example.com'
    });
    if (!res.ok) throw new Error('建立備份碼失敗（HTTP ' + res.status + '）');
    const id = (await res.text()).trim();
    if (!/^[A-Za-z0-9_-]{10,64}$/.test(id)) throw new Error('伺服器回應不正確');
    const c = cloud();
    c.code = id;
    c.lastSync = 0;
    Store.save({ silent: true });
    return id;
  }

  function url() {
    return ROOT + encodeURIComponent(cloud().code) + '/' + DATA_KEY;
  }

  async function backup(opts) {
    if (!configured()) return { ok: false, msg: '尚未建立備份碼' };
    if (busy) return { ok: false, msg: '進行中' };
    if (!navigator.onLine) { setStatus('off'); return { ok: false, msg: '目前離線' }; }
    busy = true;
    setStatus('busy');
    try {
      const res = await fetch(url(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Store.get())
      });
      if (!res.ok) throw new Error('上傳失敗（HTTP ' + res.status + '）');
      cloud().lastSync = Date.now();
      Store.get().settingsUpdatedAt = Date.now();
      Store.save({ silent: true });
      busy = false;
      setStatus('ok');
      if (!opts || !opts.quiet) {
        if (global.UI) UI.toast('已備份到雲端');
        if (global.UI) UI.render();
      }
      return { ok: true, msg: '已備份' };
    } catch (e) {
      busy = false;
      setStatus('err', e.message);
      if (!opts || !opts.quiet) { if (global.UI) UI.toast('備份失敗：' + e.message, 3000); }
      return { ok: false, msg: e.message };
    }
  }

  async function restore(code) {
    const c = cloud();
    if (code) c.code = String(code).trim();
    if (!c.code) return { ok: false, msg: '請輸入備份碼' };
    try {
      const res = await fetch(url(), { cache: 'no-store' });
      if (res.status === 404) return { ok: false, msg: '找不到這個備份碼' };
      if (!res.ok) return { ok: false, msg: '讀取失敗（HTTP ' + res.status + '）' };
      const text = await res.text();
      if (!text || text === 'null') return { ok: false, msg: '雲端沒有資料' };
      const obj = JSON.parse(text);
      if (!obj || !Array.isArray(obj.txns)) return { ok: false, msg: '備份格式不正確' };
      Store.replace(DBmerge.mergeData(Store.get(), obj));
      Store.save({ silent: true });
      setStatus('ok');
      return { ok: true, msg: '已還原雲端備份' };
    } catch (e) {
      return { ok: false, msg: e.message || '還原失敗' };
    }
  }

  function schedule() {
    if (!configured() || !cfg().cloud.auto) return;
    clearTimeout(timer);
    timer = setTimeout(function () { backup({ quiet: true }); }, 6000);
  }

  function label() {
    const c = cloud();
    if (!c.code) return '未啟用';
    if (status === 'err') return '備份失敗：' + lastErr;
    if (c.lastSync) {
      const d = new Date(c.lastSync);
      const p = function (n) { return String(n).padStart(2, '0'); };
      return '上次備份：' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
        ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    }
    return '已建立備份碼，尚未備份';
  }

  global.Sync = {
    configured: configured,
    createCode: createCode,
    backup: backup,
    restore: restore,
    schedule: schedule,
    label: label,
    statusText: label,
    sync: backup,
    get status() { return status; }
  };
})(window);
