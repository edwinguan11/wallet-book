/* ===== 記賬本 · charts.js — 純手寫 SVG 圖表，無外部依賴 ===== */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function n2(v) { return Math.round(v * 100) / 100; }
  function svgWrap(w, h, inner, cls) {
    return '<svg class="chart-svg ' + (cls || '') + '" viewBox="0 0 ' + w + ' ' + h +
      '" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">' + inner + '</svg>';
  }
  function T(x, y, s, o) {
    o = o || {};
    return '<text x="' + n2(x) + '" y="' + n2(y) + '" style="fill:' + (o.fill || 'var(--muted)') +
      ';font-size:' + (o.size || 10.5) + 'px;font-weight:' + (o.weight || 500) +
      ';text-anchor:' + (o.anchor || 'start') + '"' + (o.extra || '') + '>' + esc(s) + '</text>';
  }
  function hexAlpha(hex, a) {
    hex = String(hex || '#888').replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /* ---------- 環形圖 ---------- */
  function arcPath(cx, cy, r1, r2, a0, a1) {
    const p = function (a, r) { return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    const A = p(a0, r2), B = p(a1, r2), C = p(a1, r1), D = p(a0, r1);
    return 'M' + n2(A[0]) + ' ' + n2(A[1]) +
      ' A' + r2 + ' ' + r2 + ' 0 ' + large + ' 1 ' + n2(B[0]) + ' ' + n2(B[1]) +
      ' L' + n2(C[0]) + ' ' + n2(C[1]) +
      ' A' + r1 + ' ' + r1 + ' 0 ' + large + ' 0 ' + n2(D[0]) + ' ' + n2(D[1]) + ' Z';
  }

  function donut(items, opts) {
    opts = opts || {};
    const size = opts.size || 210;
    const cx = size / 2, cy = size / 2;
    const r2 = size * 0.44, r1 = size * 0.29;
    const total = items.reduce(function (s, i) { return s + i.value; }, 0);
    if (!total) {
      return svgWrap(size, size,
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + ((r1 + r2) / 2) + '" fill="none" stroke="var(--card2)" stroke-width="' + (r2 - r1) + '"/>' +
        T(cx, cy + 4, opts.empty || '暫無數據', { anchor: 'middle', size: 11.5 }), 'chart-donut');
    }
    let a = -Math.PI / 2;
    let paths = '';
    const pad = items.length > 1 ? 0.012 : 0;
    items.forEach(function (it) {
      const sweep = (it.value / total) * Math.PI * 2;
      if (sweep <= 0.0001) return;
      if (items.length === 1) {
        paths += '<circle cx="' + cx + '" cy="' + cy + '" r="' + ((r1 + r2) / 2) +
          '" fill="none" stroke="' + it.color + '" stroke-width="' + (r2 - r1) + '"/>';
      } else {
        paths += '<path d="' + arcPath(cx, cy, r1, r2, a + pad / 2, a + sweep - pad / 2) +
          '" fill="' + it.color + '" opacity="' + (opts.dim ? 0.45 : 1) + '"><title>' +
          esc(it.name) + ' ' + esc(opts.money || '') + '</title></path>';
      }
      a += sweep;
    });
    let center = '';
    if (opts.centerValue != null) {
      center = T(cx, cy + 2, opts.centerValue, { anchor: 'middle', size: 17, weight: 800, fill: 'var(--fg)' }) +
        T(cx, cy + 18, opts.centerLabel || '', { anchor: 'middle', size: 10 });
    }
    return svgWrap(size, size, paths + center, 'chart-donut');
  }

  /* ---------- 直條圖（可按項上色） ---------- */
  function bars(items, opts) {
    opts = opts || {};
    const W = 340, H = opts.height || 150;
    const padL = 6, padR = 6, padT = 16, padB = 26;
    const n = items.length || 1;
    const slot = (W - padL - padR) / n;
    const bw = Math.min(30, slot * 0.56);
    const max = Math.max.apply(null, items.map(function (i) { return i.value; }).concat([1]));
    let out = '';
    // 基準線
    out += '<line x1="' + padL + '" y1="' + (H - padB) + '" x2="' + (W - padR) + '" y2="' + (H - padB) +
      '" stroke="var(--line)" stroke-width="1"/>';
    items.forEach(function (it, i) {
      const h = Math.max(2, (it.value / max) * (H - padT - padB));
      const x = padL + slot * i + (slot - bw) / 2;
      const y = H - padB - h;
      const col = it.color || opts.color || 'var(--accent)';
      out += '<rect x="' + n2(x) + '" y="' + n2(y) + '" width="' + n2(bw) + '" height="' + n2(h) +
        '" rx="4" fill="' + col + '" opacity="' + (it.dim ? 0.42 : 0.95) + '"><title>' +
        esc(it.name) + ': ' + esc(it.label || '') + '</title></rect>';
      out += T(x + bw / 2, y - 5, opts.fmt ? opts.fmt(it.value) : String(Math.round(it.value)),
        { anchor: 'middle', size: 9.5, fill: 'var(--muted)' });
      out += T(x + bw / 2, H - padB + 14, it.label, { anchor: 'middle', size: 10, fill: it.dim ? 'var(--muted)' : 'var(--fg)' });
    });
    return svgWrap(W, H, out, 'chart-bars');
  }

  /* ---------- 折線（每日支出） ---------- */
  function line(values, opts) {
    opts = opts || {};
    const W = 340, H = opts.height || 140;
    const padL = 4, padR = 4, padT = 14, padB = 22;
    const n = values.length || 1;
    const max = Math.max.apply(null, values.concat([1]));
    const iw = W - padL - padR, ih = H - padT - padB;
    const px = function (i) { return padL + (n === 1 ? iw / 2 : (i / (n - 1)) * iw); };
    const py = function (v) { return padT + ih - (v / max) * ih; };

    let area = '', pts = '';
    values.forEach(function (v, i) {
      pts += (i ? ' L' : 'M') + n2(px(i)) + ' ' + n2(py(v));
    });
    area = pts + ' L' + n2(px(n - 1)) + ' ' + (padT + ih) + ' L' + n2(px(0)) + ' ' + (padT + ih) + ' Z';

    let out = '<defs><linearGradient id="lg-line" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + (opts.color || '#f5b942') + '" stop-opacity="0.32"/>' +
      '<stop offset="100%" stop-color="' + (opts.color || '#f5b942') + '" stop-opacity="0"/></linearGradient></defs>';
    out += '<line x1="' + padL + '" y1="' + (padT + ih) + '" x2="' + (W - padR) + '" y2="' + (padT + ih) +
      '" stroke="var(--line)" stroke-width="1"/>';
    out += '<path d="' + area + '" fill="url(#lg-line)"/>';
    out += '<path d="' + pts + '" fill="none" stroke="' + (opts.color || '#f5b942') + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    // 峰值標記
    let mi = 0;
    values.forEach(function (v, i) { if (v > values[mi]) mi = i; });
    if (values[mi] > 0) {
      out += '<circle cx="' + n2(px(mi)) + '" cy="' + n2(py(values[mi])) + '" r="3.4" fill="' + (opts.color || '#f5b942') + '"/>';
      out += T(px(mi), py(values[mi]) - 8, opts.fmt ? opts.fmt(values[mi]) : String(Math.round(values[mi])),
        { anchor: 'middle', size: 9.5, fill: 'var(--fg)', weight: 700 });
    }
    [0, Math.floor(n / 2), n - 1].forEach(function (i, k) {
      out += T(px(i), H - 6, String(i + 1), { anchor: k === 0 ? 'start' : (k === 2 ? 'end' : 'middle'), size: 9.5 });
    });
    return svgWrap(W, H, out, 'chart-line');
  }

  /* ---------- 堆疊柱（多錢包疊加） ---------- */
  function stacked(months, series, opts) {
    opts = opts || {};
    const W = 340, H = opts.height || 160;
    const padL = 4, padR = 4, padT = 16, padB = 26;
    const n = months.length || 1;
    const slot = (W - padL - padR) / n;
    const bw = Math.min(34, slot * 0.6);
    const totals = months.map(function (m) {
      return series.reduce(function (s, se) { return s + (m.values[se.id] || 0); }, 0);
    });
    const max = Math.max.apply(null, totals.concat([1]));
    let out = '<line x1="' + padL + '" y1="' + (H - padB) + '" x2="' + (W - padR) + '" y2="' + (H - padB) +
      '" stroke="var(--line)" stroke-width="1"/>';
    months.forEach(function (m, i) {
      const x = padL + slot * i + (slot - bw) / 2;
      let y = H - padB;
      series.forEach(function (se) {
        const v = m.values[se.id] || 0;
        if (v <= 0) return;
        const h = (v / max) * (H - padT - padB);
        y -= h;
        out += '<rect x="' + n2(x) + '" y="' + n2(y) + '" width="' + n2(bw) + '" height="' + n2(h) +
          '" fill="' + se.color + '" opacity="0.92"><title>' + esc(m.label) + ' · ' + esc(se.name) + '</title></rect>';
      });
      out += T(x + bw / 2, H - padB + 14, m.label, { anchor: 'middle', size: 9.5, fill: 'var(--fg)' });
      if (totals[i] > 0) {
        out += T(x + bw / 2, H - padB - (totals[i] / max) * (H - padT - padB) - 5,
          opts.fmt ? opts.fmt(totals[i]) : String(Math.round(totals[i])), { anchor: 'middle', size: 9, fill: 'var(--muted)' });
      }
    });
    return svgWrap(W, H, out, 'chart-stacked');
  }

  /* ---------- 熱力日曆 ---------- */
  function heatmap(values, ym, opts) {
    opts = opts || {};
    const [y, m] = ym.split('-').map(Number);
    const days = values.length;
    const first = new Date(y, m - 1, 1);
    const off = (first.getDay() + 6) % 7; // 星期一為第一欄
    const weeks = Math.ceil((off + days) / 7);
    const gap = 3;
    const cw = 42, ch = 40;
    const W = 7 * cw + 6 * gap;
    const H = weeks * (ch + gap) - gap + 16;
    const max = Math.max.apply(null, values.concat([1]));
    const wd = ['一', '二', '三', '四', '五', '六', '日'];
    let out = '';
    wd.forEach(function (w, i) {
      out += T(i * (cw + gap) + cw / 2, 10, w, { size: 9.5, anchor: 'middle' });
    });
    for (let d = 1; d <= days; d++) {
      const idx = off + d - 1;
      const col = idx % 7, row = Math.floor(idx / 7);
      const x = (cw + gap) * col, y = 16 + (ch + gap) * row;
      const v = values[d - 1] || 0;
      const t = max > 0 ? v / max : 0;
      const fill = v > 0 ? hexAlpha(opts.color || '#f5b942', 0.14 + t * 0.8) : 'var(--card2)';
      out += '<rect x="' + n2(x) + '" y="' + n2(y) + '" width="' + cw + '" height="' + ch + '" rx="6" fill="' + fill +
        '" stroke="var(--line)" stroke-width="0.6"><title>' + m + '/' + d + ' · ' +
        (opts.fmt ? esc(opts.fmt(v)) : v) + '</title></rect>';
      out += T(x + cw / 2, y + ch / 2 + 4, String(d), {
        anchor: 'middle', size: 10.5, weight: v > 0 ? 700 : 500,
        fill: t > 0.55 ? '#241a05' : (v > 0 ? 'var(--fg)' : 'var(--muted)')
      });
    }
    return svgWrap(W, H, out, 'chart-heat');
  }

  /* ---------- 桑基圖（錢包 → 分類） ---------- */
  function sankey(links, opts) {
    opts = opts || {};
    const W = 360, H = opts.height || 240;
    const nodeW = 9, pad = 7;
    const leftTot = {}, rightTot = {};
    links.forEach(function (l) {
      leftTot[l.from] = (leftTot[l.from] || 0) + l.value;
      rightTot[l.to] = (rightTot[l.to] || 0) + l.value;
    });
    const L = Object.keys(leftTot).map(function (k) { return { id: k, name: (opts.nameOf || function (x) { return x; })(k), value: leftTot[k], color: (opts.colorOf || function () { return '#f5b942'; })(k) }; })
      .sort(function (a, b) { return b.value - a.value; });
    const R = Object.keys(rightTot).map(function (k) { return { id: k, name: (opts.rightNameOf || function (x) { return x; })(k), value: rightTot[k], color: (opts.rightColorOf || function () { return '#60a5fa'; })(k) }; })
      .sort(function (a, b) { return b.value - a.value; });

    const total = L.reduce(function (s, x) { return s + x.value; }, 0) || 1;
    const usable = H - 10;
    const leftGap = Math.max(0, (usable - L.reduce(function (s, x) { return s + x.value / total * usable; }, 0)) );

    // 節點高度（按比例，最少 6px）
    function heights(arr) {
      const raw = arr.map(function (x) { return Math.max(6, x.value / total * usable * 0.92); });
      const sum = raw.reduce(function (a, b) { return a + b; }, 0);
      const avail = H - 8 - (arr.length - 1) * pad;
      const k = sum > avail ? avail / sum : 1;
      return raw.map(function (h) { return h * k; });
    }
    const lh = heights(L), rh = heights(R);
    let ly = 4, ry = 4;
    L.forEach(function (n, i) { n.y = ly; n.h = lh[i]; n.off = 0; ly += lh[i] + pad; });
    R.forEach(function (n, i) { n.y = ry; n.h = rh[i]; n.off = 0; ry += rh[i] + pad; });

    const lmap = {};
    L.forEach(function (n) { lmap[n.id] = n; });
    const rmap = {};
    R.forEach(function (n) { rmap[n.id] = n; });

    const sorted = links.slice().sort(function (a, b) {
      const ai = L.findIndex(function (n) { return n.id === a.from; });
      const bi = L.findIndex(function (n) { return n.id === b.from; });
      if (ai !== bi) return ai - bi;
      const aj = R.findIndex(function (n) { return n.id === a.to; });
      const bj = R.findIndex(function (n) { return n.id === b.to; });
      return aj - bj;
    });

    let ribbons = '';
    sorted.forEach(function (l) {
      const ln = lmap[l.from], rn = rmap[l.to];
      if (!ln || !rn) return;
      const lhgt = (l.value / ln.value) * ln.h;
      const rhgt = (l.value / rn.value) * rn.h;
      const y0 = ln.y + ln.off, y1 = rn.y + rn.off;
      ln.off += lhgt; rn.off += rhgt;
      const x0 = 2 + nodeW, x1 = W - 2 - nodeW;
      const mx = (x0 + x1) / 2;
      const d = 'M' + x0 + ' ' + n2(y0) +
        ' C' + n2(mx) + ' ' + n2(y0) + ' ' + n2(mx) + ' ' + n2(y1) + ' ' + n2(x1) + ' ' + n2(y1) +
        ' L' + n2(x1) + ' ' + n2(y1 + rhgt) +
        ' C' + n2(mx) + ' ' + n2(y1 + rhgt) + ' ' + n2(mx) + ' ' + n2(y0 + lhgt) + ' ' + n2(x0) + ' ' + n2(y0 + lhgt) + ' Z';
      ribbons += '<path d="' + d + '" fill="' + ln.color + '" opacity="0.18"><title>' +
        esc(ln.name) + ' → ' + esc(rn.name) + '</title></path>';
    });

    let nodes = '';
    const halo = ' paint-order="stroke" stroke="var(--card)" stroke-width="3" stroke-linejoin="round"';
    L.forEach(function (n) {
      nodes += '<rect x="2" y="' + n2(n.y) + '" width="' + nodeW + '" height="' + n2(n.h) + '" rx="3" fill="' + n.color + '"/>';
      if (n.h > 11) nodes += T(nodeW + 7, n.y + Math.min(n.h - 2, 12), n.name, { size: 9.5, fill: 'var(--fg)', weight: 600, extra: halo });
    });
    R.forEach(function (n) {
      nodes += '<rect x="' + (W - 2 - nodeW) + '" y="' + n2(n.y) + '" width="' + nodeW + '" height="' + n2(n.h) + '" rx="3" fill="' + n.color + '"/>';
      if (n.h > 11) nodes += T(W - nodeW - 7, n.y + Math.min(n.h - 2, 12), n.name, { size: 9.5, fill: 'var(--fg)', weight: 600, anchor: 'end', extra: halo });
    });

    return svgWrap(W, H, ribbons + nodes, 'chart-sankey');
  }

  global.Charts = { donut: donut, bars: bars, line: line, stacked: stacked, heatmap: heatmap, sankey: sankey, esc: esc, hexAlpha: hexAlpha };
})(window);
