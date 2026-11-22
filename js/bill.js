/* ===== 記賬本 · bill.js — 由 OCR 文字還原成交易記錄 ===== */
(function (global) {
  'use strict';

  const NUM_RE = /^[-−–—]?\d{1,3}(?:,\d{3})*(?:[.．,]\d{1,2})?$|^[-−–—]?\d+[.．]\d{1,2}$/;
  const DATE_RE = /(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/;
  const TIME_RE = /^\d{1,2}:\d{2}(:\d{2})?$/;

  const CAT_MAP = [
    [/九巴|龍運|巴士|kmb|bus|城巴|新巴/i, 'c_bus'],
    [/小巴|van/i, 'c_minibus'],
    [/港鐵|地鐵|mtr|機鐵/i, 'c_mtr'],
    [/的士|taxi|uber|滴滴/i, 'c_taxi'],
    [/渡輪|ferry|船/i, 'c_ferry'],
    [/零食|食物|餐|飯|麵|包|咖啡|茶|飲|cafe|starbucks|麥當勞|mcdonald|kfc|大家樂|大快活|吉野家|fairwood/i, 'c_food'],
    [/超市|惠康|百佳|wellcome|parknshop|7-?eleven|ok便利店|屈臣氏|萬寧|藥房/i, 'c_daily'],
    [/apple\.com|google|netflix|spotify|youtube|icloud|chatgpt|openai|preply|訂閱|subscription/i, 'c_sub'],
    [/話費|通訊|cmhk|china mobile|數碼通|smartone|1o1o|csl/i, 'c_phone'],
    [/書|book|文具|stationery|補習|tutor|學|course|課程/i, 'c_study'],
    [/戲|電影|cinema|movie|遊戲|game|steam|娛樂/i, 'c_fun'],
    [/衫|褲|鞋|服飾|uniqlo|h&m|zara|淘寶|taobao|拼多多|pinduoduo|購物|store|shop|merchant/i, 'c_shop'],
    [/水費|電費|煤氣|中電|港燈|水務/i, 'c_utility'],
    [/租|rent/i, 'c_rent'],
    [/醫|藥|診所|hospital|clinic/i, 'c_medical'],
    [/八達通轉入|轉入銀包|card to wallet|增值|top ?up/i, 'c_other']
  ];

  function norm(s) {
    return String(s || '')
      .replace(/[﹒．]/g, '.')
      .replace(/[−–—]/g, '-')
      .replace(/\u00a0/g, ' ')
      .trim();
  }

  function isCJK(ch) { return /[\u3400-\u9fff\uf900-\ufaff]/.test(ch); }

  function joinWords(words) {
    let out = '';
    words.forEach(function (w, i) {
      const t = norm(w.text);
      if (!t) return;
      if (i === 0 || !out) { out = t; return; }
      const a = out[out.length - 1], b = t[0];
      out += (isCJK(a) && isCJK(b)) ? t : (' ' + t);
    });
    return out;
  }

  function parseNum(t) {
    t = norm(t).replace(/,/g, '');
    if (!t) return null;
    const v = parseFloat(t.replace(/[^\d.\-]/g, ''));
    return isNaN(v) ? null : v;
  }

  function guessCategory(desc) {
    for (let i = 0; i < CAT_MAP.length; i++) {
      if (CAT_MAP[i][0].test(desc)) return CAT_MAP[i][1];
    }
    return 'c_other';
  }

  function cleanDesc(s) {
    return s
      .replace(/Octopus\s*No\.?\s*[:：]?\s*[\d\s()\-]+/gi, ' ')
      .replace(/Ref\s*[:：]?\s*\d+/gi, ' ')
      .replace(/\(\s*\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}\s*\)/g, ' ')
      .replace(/\(\s*(UnionPay|Mastercard|Visa)\s*card[^)]*\)/gi, ' ')
      .replace(/\bCNY\s*\d+(\.\d+)?/gi, ' ')
      .replace(/[©®©|¦=~_\[\]{}<>]/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function buildRows(words, width, height) {
    const list = (words || []).filter(function (w) {
      const t = norm(w.text);
      return t && w.conf > 25 && !/^[^\w\u3400-\u9fff]+$/.test(t);
    });
    list.sort(function (a, b) { return a.cy - b.cy; });

    const rows = [];
    list.forEach(function (w) {
      const h = (w.y1 - w.y0) || 20;
      let row = rows[rows.length - 1];
      if (row && Math.abs(w.cy - row.yc) < Math.max(9, h * 0.62)) {
        row.items.push(w);
      } else {
        row = { items: [w], yc: w.cy };
        rows.push(row);
      }
    });
    rows.forEach(function (r) {
      r.items.sort(function (a, b) { return a.x0 - b.x0; });
      // 合併被切開的數字：4 . 1 ／ 6 . 0 ／ - 4.1
      const merged = [];
      r.items.forEach(function (w) {
        const t = norm(w.text);
        const last = merged[merged.length - 1];
        const numericish = /^[\d.,%\-]+$/.test(t);
        const lastT = last ? norm(last.text) : '';
        const dotInvolved = /[.]/.test(t) || /[.]$/.test(lastT) || /[.,]/.test(lastT) || /[.,]/.test(t);
        if (last && numericish && /^[\d.,%\-]+$/.test(lastT) && dotInvolved &&
            (w.x0 - last.x1) < Math.max(14, (last.y1 - last.y0) * 0.55)) {
          last.text = norm(last.text) + t;
          last.x1 = w.x1; last.y1 = Math.max(last.y1, w.y1);
          last.cy = (last.y0 + last.y1) / 2;
          return;
        }
        merged.push(Object.assign({}, w));
      });
      r.items = merged;
      r.text = joinWords(r.items);
      r.plain = r.text.replace(/\s+/g, '');
      r.y = r.yc;
    });
    return { rows: rows, width: width, height: height };
  }

  function parse(input) {
    const built = buildRows(input.words, input.width, input.height);
    const rows = built.rows;
    const H = input.height || 1;

    // 0) 跳過頁首：由「交易紀錄」那一行開始
    let startIdx = 0;
    for (let i = 0; i < rows.length; i++) {
      if (/交易紀錄|交易明細|交易詳情|transaction/i.test(rows[i].text.replace(/\s+/g, ''))) { startIdx = i + 1; break; }
    }

    // 1) 找出每一筆的「錨點」＝含完整日期的行
    const anchors = [];
    rows.forEach(function (r, idx) {
      if (idx < startIdx) return;
      const m = r.text.match(DATE_RE);
      if (!m) return;
      // 排除頁首的結單日期（通常在最頂、且同一行有 Statement Date）
      if (/statement date|結單日期|月結單/i.test(r.text)) return;
      if (r.y < H * 0.12 && !/:\d{2}/.test(r.text)) return;
      anchors.push({
        idx: idx,
        date: m[1] + '-' + String(Number(m[2])).padStart(2, '0') + '-' + String(Number(m[3])).padStart(2, '0'),
        y: r.y
      });
    });

    const out = [];
    const W = input.width || 1000;
    const NOISE = /餘額|交易紀錄|最新動態|我的銀包|消費摘要|HKD|Statement|結單|月結單|WalletNumber|Balance|Amount|Transaction|Remarks|信用卡|所有|八達通Octopus|交易日期|交易詳情|備註|金額|結餘/i;

    function numsInRow(row, minX) {
      const arr = [];
      row.items.forEach(function (w) {
        const t = norm(w.text);
        if (!NUM_RE.test(t)) return;
        if (w.cx < minX) return;
        const v = parseNum(t);
        if (v === null) return;
        arr.push({ v: v, word: w, raw: t });
      });
      return arr;
    }

    anchors.forEach(function (a, ai) {
      const from = ai === 0 ? startIdx : anchors[ai - 1].idx + 1;
      const block = rows.slice(from, a.idx + 1);
      const anchorRow = rows[a.idx];

      // 金額與餘額都在最右側欄位；按閱讀順序（先上後下、同行先左後右）取第一個當金額
      let nums = [];
      block.forEach(function (r) { nums = nums.concat(numsInRow(r, W * 0.55)); });
      if (!nums.length) return;
      nums.sort(function (a, b) {
        const dy = a.word.cy - b.word.cy;
        if (Math.abs(dy) > 8) return dy;
        return a.word.x0 - b.word.x0;
      });

      // 描述：整段區塊的非數字文字（去頁首雜訊）
      const texts = [];
      block.forEach(function (r) {
        const kept = [];
        r.items.forEach(function (w) {
          const t = norm(w.text);
          if (!t) return;
          if (DATE_RE.test(t) || TIME_RE.test(t)) return;
          if (t.length >= 7 && /^\d+$/.test(t)) return;
          if (NUM_RE.test(t)) return;
          if (/^[\d\s:.\-\/%]+$/.test(t)) return;
          kept.push(t);
        });
        if (!kept.length) return;
        const lineText = joinWords(kept.map(function (t) { return { text: t }; }));
        const flatLine = lineText.replace(/\s+/g, '');
        if (NOISE.test(flatLine)) return;
        if (/\d{6,}/.test(flatLine)) return;           // 卡號 / 單號雜訊
        if (flatLine.length < 2) return;
        texts.push(lineText);
      });

      const amountWord = nums[0].word;
      const desc = cleanDesc(texts.join(' '));

      out.push({
        date: a.date,
        desc: desc || '（未命名）',
        amount: Math.abs(nums[0].v),
        balance: nums.length >= 2 ? Math.abs(nums[nums.length - 1].v) : null,
        color: amountWord.color || 'dark',
        negative: /^-/.test(nums[0].raw),
        raw: block.map(function (r) { return r.text; }).join(' ⏎ ')
      });
    });

    // 2) 用相鄰餘額差額校正金額與正負（清單通常由新到舊）
    for (let i = 0; i < out.length; i++) {
      const cur = out[i];
      const prev = i > 0 ? out[i - 1] : null;
      const next = i + 1 < out.length ? out[i + 1] : null;
      let sign = null;
      if (cur.balance != null) {
        const other = next && next.balance != null ? next.balance : (prev && prev.balance != null ? prev.balance : null);
        if (other != null) {
          const delta = (next && next.balance != null) ? (cur.balance - other) : (other - cur.balance);
          if (Math.abs(delta) > 0.001) {
            sign = delta > 0 ? 1 : -1;
            // 差額與 OCR 金額接近時，直接用差額（更準）
            if (Math.abs(Math.abs(delta) - cur.amount) <= Math.max(0.6, cur.amount * 0.08)) {
              cur.amount = Math.round(Math.abs(delta) * 100) / 100;
            }
          }
        }
      }
      if (sign === null) {
        if (cur.color === 'green') sign = 1;
        else if (cur.color === 'red') sign = -1;
        else if (cur.negative) sign = -1;
        else if (cur.isIncomeWord) sign = 1;
        else sign = -1;
      }
      cur.income = sign > 0;
    }

    // 3) 判斷類型與錢包
    const header = rows.slice(0, Math.min(rows.length, 12)).map(function (r) { return r.text; }).join(' ');
    const isWallet = /銀包|wallet/i.test(header);

    out.forEach(function (t) {
      const d = t.desc;
      const flat = d.replace(/\s+/g, '');
      t.type = t.income ? 'income' : 'expense';
      t.walletId = isWallet ? 'w_octo_w' : 'w_octopus';
      t.categoryId = guessCategory(d);

      if (/轉入銀包|cardtowallet|轉入錢包/i.test(flat)) {
        t.type = 'transfer'; t.walletId = 'w_octopus'; t.toWalletId = 'w_octo_w';
      } else if (/轉入八達通|銀包轉入|wallettocard/i.test(flat)) {
        t.type = 'transfer'; t.walletId = 'w_octo_w'; t.toWalletId = 'w_octopus';
      } else if (/增值|topup/i.test(flat)) {
        t.type = 'transfer'; t.walletId = 'w_cash'; t.toWalletId = 'w_octopus';
      }

      if (t.type === 'income' && t.categoryId === 'c_other') t.categoryId = 'i_other';
      if (t.type === 'transfer') t.categoryId = '';
    });

    // 去除重複（同日期同金額同描述）
    const seen = {};
    const uniq = out.filter(function (t) {
      const k = t.date + '|' + t.amount.toFixed(2) + '|' + t.desc;
      if (seen[k]) return false;
      seen[k] = 1;
      return true;
    });

    return { rows: uniq, source: isWallet ? '八達通銀包' : '八達通卡' };
  }

  global.Bill = { parse: parse, buildRows: buildRows };
})(typeof window !== 'undefined' ? window : globalThis);
