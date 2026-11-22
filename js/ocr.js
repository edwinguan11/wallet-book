/* ===== 記賬本 · ocr.js — 離線 OCR（tesseract.js，本地檔案） ===== */
(function (global) {
  'use strict';

  const V = 'js/vendor/';
  let workerP = null;
  let libP = null;

  function loadScript(src) {
    return new Promise(function (res, rej) {
      const s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = function () { rej(new Error('無法載入辨識引擎')); };
      document.head.appendChild(s);
    });
  }

  function ensureLib() {
    if (global.Tesseract) return Promise.resolve();
    if (!libP) libP = loadScript(V + 'tesseract.min.js');
    return libP;
  }

  function getWorker(onProgress) {
    if (workerP) return workerP;
    workerP = ensureLib().then(function () {
      return global.Tesseract.createWorker(['chi_tra', 'eng'], 1, {
        workerPath: V + 'worker.min.js',
        corePath: V + 'tesseract-core-lstm.wasm.js',
        langPath: V + 'lang-hq',
        gzip: true,
        logger: function (m) {
          if (onProgress && m && m.status) onProgress(m);
        }
      });
    }).catch(function (e) {
      workerP = null;
      throw e;
    });
    return workerP;
  }

  /* 影像前處理：灰階（亮度），小圖才放大。實測原尺寸＋灰階準確度最高 */
  function preprocess(img, opts) {
    opts = opts || {};
    const small = img.naturalWidth < 900;
    const scale = small ? 2 : 1;
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);

    const color = document.createElement('canvas');
    color.width = w; color.height = h;
    const cctx = color.getContext('2d');
    cctx.imageSmoothingEnabled = true;
    cctx.imageSmoothingQuality = 'high';
    cctx.drawImage(img, 0, 0, w, h);

    const proc = document.createElement('canvas');
    proc.width = w; proc.height = h;
    const pctx = proc.getContext('2d');
    pctx.drawImage(color, 0, 0);

    const imgData = pctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    pctx.putImageData(imgData, 0, 0);
    return { proc: proc, color: color, width: w, height: h };
  }

  /* 由原圖 bbox 判斷文字顏色：red / green / dark */
  function colorAt(colorCanvas, b) {
    const ctx = colorCanvas.getContext('2d');
    const x = Math.max(0, Math.floor(b.x0));
    const y = Math.max(0, Math.floor(b.y0));
    const w = Math.min(colorCanvas.width - x, Math.ceil(b.x1 - b.x0));
    const h = Math.min(colorCanvas.height - y, Math.ceil(b.y1 - b.y0));
    if (w <= 0 || h <= 0) return 'dark';
    let data;
    try { data = ctx.getImageData(x, y, w, h).data; } catch (e) { return 'dark'; }
    let red = 0, green = 0, dark = 0, total = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], bl = data[i + 2];
      const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
      total++;
      if (mx > 245 && mn > 245) continue;            // 白底
      if (mx - mn > 45) {                            // 有顏色
        if (r === mx && r - Math.max(g, bl) > 40) red++;
        else if (g === mx && g - Math.max(r, bl) > 25) green++;
      } else if (mx < 140) dark++;
    }
    if (red > green * 1.5 && red > total * 0.02) return 'red';
    if (green > red * 1.5 && green > total * 0.02) return 'green';
    return 'dark';
  }

  function flatten(data) {
    const out = [];
    (data.blocks || []).forEach(function (b) {
      (b.paragraphs || []).forEach(function (p) {
        (p.lines || []).forEach(function (l) {
          (l.words || []).forEach(function (w) { out.push(w); });
        });
      });
    });
    return out;
  }

  async function recognize(img, onProgress) {
    const p = preprocess(img);
    const worker = await getWorker(onProgress);
    const res = await worker.recognize(p.proc, {}, { blocks: true });
    const words = flatten(res.data).map(function (w) {
      return {
        text: w.text,
        conf: w.confidence,
        x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1,
        cx: (w.bbox.x0 + w.bbox.x1) / 2,
        cy: (w.bbox.y0 + w.bbox.y1) / 2,
        color: colorAt(p.color, w.bbox)
      };
    });
    return { words: words, width: p.width, height: p.height, text: res.data.text };
  }

  global.OCR = { recognize: recognize, getWorker: getWorker };
})(window);
