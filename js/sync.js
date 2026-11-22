/* ===== 記賬本 · sync.js — 以 GitHub Gist 作跨裝置同步 ===== */
(function (global) {
  'use strict';

  const FILE = 'wallet-book-data.json';
  const API = 'https://api.github.com';
  let status = 'off';   // off | ok | busy | err
  let timer = null;
  let running = false;
  let lastErr = '';

  function cfg() { return Store.get().settings.sync || {}; }

  function headers() {
    const c = cfg();
    return {
      'Authorization': 'Bearer ' + c.token,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };
  }

  function setStatus(s, msg) {
    status = s;
    if (msg) lastErr = msg;
    if (global.UI && UI.updateSyncDot) UI.updateSyncDot(s);
  }

  function configured() {
    const c = cfg();
    return !!(c.token && c.gistId);
  }

  async function pull() {
    const c = cfg();
    const res = await fetch(API + '/gists/' + encodeURIComponent(c.gistId), {
      headers: headers(), cache: 'no-store'
    });
    if (!res.ok) {
      let detail = '';
      try { const b = await res.json(); detail = b && b.message ? b.message : ''; } catch (e) {}
      if (res.status === 401) throw new Error('權杖無效或已過期' + (detail ? '（' + detail + '）' : ''));
      if (res.status === 404) throw new Error('找不到 Gist，請重新建立');
      throw new Error('讀取失敗（HTTP ' + res.status + '）' + (detail ? '：' + detail : ''));
    }
    const json = await res.json();
    const f = json.files && json.files[FILE];
    if (!f) return null;
    let content = f.content;
    if (f.truncated && f.raw_url) {
      const raw = await fetch(f.raw_url, { headers: { Authorization: 'Bearer ' + c.token }, cache: 'no-store' });
      content = await raw.text();
    }
    try { return JSON.parse(content); } catch (e) { return null; }
  }

  async function push(data) {
    const c = cfg();
    const res = await fetch(API + '/gists/' + encodeURIComponent(c.gistId), {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(data) } } })
    });
    if (!res.ok) {
      let detail = '';
      try { const b = await res.json(); detail = b && b.message ? b.message : ''; } catch (e) {}
      throw new Error('寫入失敗（HTTP ' + res.status + '）' + (detail ? '：' + detail : ''));
    }
    return true;
  }

  async function createGist() {
    const c = cfg();
    const res = await fetch(API + '/gists', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        description: '記賬本資料（請勿刪除）',
        public: false,
        files: { [FILE]: { content: JSON.stringify(Store.get()) } }
      })
    });
    if (!res.ok) throw new Error('建立 Gist 失敗（HTTP ' + res.status + '）');
    const json = await res.json();
    const s = Store.get().settings;
    s.sync.gistId = json.id;
    Store.get().settingsUpdatedAt = U.nowMs();
    Store.save({ silent: true });
    return json.id;
  }

  async function doSync(opts) {
    const c = cfg();
    if (!c.token || !c.gistId) { setStatus('off'); return { ok: false, msg: '未設定同步' }; }
    if (running) return { ok: false, msg: '同步進行中' };
    running = true;
    setStatus('busy');
    try {
      const remote = await pull();
      if (remote) {
        const merged = DBmerge.mergeData(Store.get(), remote);
        Store.replace(merged);
        Store.get().updatedAt = U.nowMs();
        // 保存到本機（不觸發再次同步）
        try { localStorage.setItem('hkb_ledger_v1', JSON.stringify(Store.get())); } catch (e) {}
      }
      await push(Store.get());
      const s = Store.get().settings;
      s.sync.lastSync = U.nowMs();
      Store.get().settingsUpdatedAt = U.nowMs();
      try { localStorage.setItem('hkb_ledger_v1', JSON.stringify(Store.get())); } catch (e) {}
      setStatus('ok');
      if (!opts || !opts.quiet) {
        if (global.UI) UI.toast('同步完成');
        if (global.UI) UI.render();
      }
      running = false;
      return { ok: true, msg: '同步完成' };
    } catch (e) {
      console.error(e);
      setStatus('err', e.message);
      running = false;
      if (!opts || !opts.quiet) {
        if (global.UI) UI.toast('同步失敗：' + e.message, 3000);
      }
      return { ok: false, msg: e.message };
    }
  }

  function schedule() {
    const c = cfg();
    if (!c.auto || !c.token || !c.gistId) return;
    clearTimeout(timer);
    timer = setTimeout(function () { doSync({ quiet: true }); }, 4000);
  }

  function statusText() {
    const c = cfg();
    if (!c.token || !c.gistId) return '未啟用';
    if (status === 'err') return '同步失敗：' + lastErr;
    if (c.lastSync) {
      const d = new Date(c.lastSync);
      const p = function (n) { return String(n).padStart(2, '0'); };
      return '上次同步：' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
        ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    }
    return '已設定，尚未同步';
  }

  global.Sync = {
    pull: pull, push: push, sync: doSync, schedule: schedule, createGist: createGist,
    configured: configured, statusText: statusText,
    get status() { return status; },
    FILE: FILE
  };
})(window);
