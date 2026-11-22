/* ===== 記賬本 · ui-scan.js — 掃描賬單截圖 → 自動記賬 ===== */
(function (global) {
  'use strict';

  function readFile(file) {
    return new Promise(function (res, rej) {
      const fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  }

  function loadImg(src) {
    return new Promise(function (res, rej) {
      const im = new Image();
      im.onload = function () { res(im); };
      im.onerror = rej;
      im.src = src;
    });
  }

  UI.openScan = function () {
    let rows = [];
    let detected = '';
    let imgEl = null;

    const html =
      '<h3>掃描賬單</h3>' +
      '<div class="help" style="margin-bottom:12px">上傳八達通、銀行 App 或月結單的截圖，系統會自動辨識日期、商戶與金額。<b>辨識後請核對金額</b>，確認才匯入。</div>' +
      '<input type="file" id="scanFile" accept="image/*" style="display:none">' +
      '<div id="scanDrop" class="scan-drop"><div style="font-size:26px">🖼️</div>' +
      '<div style="font-size:13.5px;font-weight:600;margin-top:6px">點一下選擇截圖</div>' +
      '<div class="mini-k" style="margin-top:3px">支援相簿照片或即時拍攝</div></div>' +
      '<div id="scanPrev" style="display:none;margin-top:12px"><img id="scanImg" style="width:100%;border-radius:12px;border:1px solid var(--line)"></div>' +
      '<div id="scanProg" class="help" style="text-align:center;margin-top:10px"></div>' +
      '<div id="scanList" style="margin-top:6px"></div>' +
      '<div class="sheet-actions" id="scanActions" style="display:none">' +
      '<button class="btn" id="scanClose">取消</button>' +
      '<button class="btn primary" id="scanImport">匯入</button></div>';

    UI.sheet(html, function (root) {
      const fileIn = root.querySelector('#scanFile');
      const drop = root.querySelector('#scanDrop');
      const prev = root.querySelector('#scanPrev');
      const prog = root.querySelector('#scanProg');
      const list = root.querySelector('#scanList');
      const actions = root.querySelector('#scanActions');

      drop.onclick = function () { fileIn.click(); };

      fileIn.onchange = async function () {
        const f = fileIn.files && fileIn.files[0];
        if (!f) return;
        const src = await readFile(f);
        imgEl = await loadImg(src);
        root.querySelector('#scanImg').src = src;
        prev.style.display = '';
        drop.style.display = 'none';
        await run(src);
      };

      async function run(src) {
        prog.textContent = '正在辨識…（首次使用需下載約 36MB 高精度辨識資料）';
        list.innerHTML = '';
        actions.style.display = 'none';
        try {
          const res = await OCR.recognize(imgEl, function (m) {
            if (m.status === 'loading language traineddata' || m.status === 'loading tesseract core') {
              prog.textContent = '首次使用，正在下載高精度辨識資料（約 36MB）…';
            } else if (m.status === 'recognizing text' && typeof m.progress === 'number') {
              prog.textContent = '辨識中… ' + Math.round(m.progress * 100) + '%';
            }
          });
          const parsed = Bill.parse(res);
          detected = parsed.source;
          rows = parsed.rows.map(function (r) {
            return {
              on: true, date: r.date, desc: r.desc, amount: r.amount,
              type: r.type, walletId: r.walletId, toWalletId: r.toWalletId,
              categoryId: r.categoryId, low: r.amount < 0.5
            };
          });
          render();
        } catch (e) {
          prog.textContent = '辨識失敗：' + (e.message || e);
        }
      }

      function render() {
        prog.textContent = rows.length
          ? ('辨識到 ' + rows.length + ' 筆（' + detected + '）· 請核對金額')
          : '沒有辨識到交易，請試另一張截圖或放大後再試';

        if (!rows.length) { actions.style.display = 'none'; return; }

        let h = '';
        if (/月結單|statement/i.test(detected)) {
          h += '<div class="help" style="color:var(--accent);margin-bottom:8px">月結單格式較複雜，辨識率較低，請逐筆核對。</div>';
        }
        h += '<div class="row between" style="padding:6px 2px"><span class="mini-k">全選</span>' +
          '<button class="btn sm" id="toggleAll">全部取消</button></div>';
        rows.forEach(function (r, i) {
          const c = Data.category(r.categoryId);
          h += '<div class="scan-row' + (r.on ? '' : ' off') + '" data-i="' + i + '">' +
            '<button class="scan-chk" data-chk="' + i + '">' + (r.on ? '✓' : '') + '</button>' +
            '<div class="scan-main">' +
            '<input class="scan-desc" data-desc="' + i + '" value="' + esc(r.desc) + '">' +
            '<div class="scan-meta">' + esc(r.date.slice(5)) + ' · ' +
            '<button class="scan-cat" data-cat="' + i + '">' + esc(c.icon) + ' ' + esc(c.name) + '</button>' +
            ' · ' + (r.type === 'transfer' ? '轉賬' : r.type === 'income' ? '收入' : '支出') + '</div></div>' +
            '<input class="scan-amt" type="number" step="0.01" data-amt="' + i + '" value="' + r.amount + '">' +
            '</div>';
        });
        list.innerHTML = h;
        actions.style.display = '';

        root.querySelectorAll('[data-chk]').forEach(function (b) {
          b.onclick = function () {
            const i = +b.dataset.chk;
            rows[i].on = !rows[i].on;
            b.textContent = rows[i].on ? '✓' : '';
            b.parentElement.classList.toggle('off', !rows[i].on);
            updateImport();
          };
        });
        root.querySelectorAll('[data-amt]').forEach(function (inp) {
          inp.oninput = function () { rows[+inp.dataset.amt].amount = parseFloat(inp.value) || 0; };
        });
        root.querySelectorAll('[data-desc]').forEach(function (inp) {
          inp.oninput = function () { rows[+inp.dataset.desc].desc = inp.value; };
        });
        root.querySelectorAll('[data-cat]').forEach(function (b) {
          b.onclick = function () {
            const i = +b.dataset.cat;
            UI.pickCategory(rows[i].type === 'income' ? 'income' : 'expense', rows[i].categoryId, function (cid) {
              rows[i].categoryId = cid;
              const c = Data.category(cid);
              b.textContent = c.icon + ' ' + c.name;
            });
          };
        });
        const ta = root.querySelector('#toggleAll');
        if (ta) ta.onclick = function () {
          const allOn = rows.every(function (r) { return r.on; });
          rows.forEach(function (r) { r.on = !allOn; });
          render();
        };
        root.querySelector('#scanImport').onclick = doImport;
        updateImport();
      }

      function updateImport() {
        const n = rows.filter(function (r) { return r.on && r.amount > 0; }).length;
        const b = root.querySelector('#scanImport');
        if (b) { b.textContent = '匯入 ' + n + ' 筆'; b.disabled = n === 0; }
      }

      function doImport() {
        let n = 0;
        rows.forEach(function (r) {
          if (!r.on || !r.amount || r.amount <= 0) return;
          if (r.type === 'transfer') {
            Data.addTxn({
              type: 'transfer', amount: r.amount, hkd: r.amount, date: r.date,
              walletId: r.walletId || 'w_octopus', toWalletId: r.toWalletId || 'w_octo_w',
              note: r.desc === '（未命名）' ? '' : r.desc
            });
          } else {
            Data.addTxn({
              type: r.type, amount: r.amount, hkd: r.amount, date: r.date,
              categoryId: r.categoryId || 'c_other', walletId: r.walletId || 'w_octopus',
              note: r.desc === '（未命名）' ? '' : r.desc
            });
          }
          n++;
        });
        UI.closeSheet();
        UI.state.month = (rows[0] && rows[0].date ? rows[0].date.slice(0, 7) : U.thisMonth());
        UI.go('list');
        UI.toast('已匯入 ' + n + ' 筆記錄', 2600);
      }
    });
  };
})(window);
