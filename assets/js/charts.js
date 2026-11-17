/**
 * charts.js — Gráficos Chart.js 4 (Fase 2, PLAN §4/§5).
 * API: window.Charts = { renderRA(porRA), renderAparencia(notaMin), destroy() }
 * Requer assets/vendor/chart.umd.min.js carregado antes; sem Chart.js → fallback CSS/textual.
 * Sem estado global além do registro de instâncias. Sem fetch. Sem type=module.
 */
(function () {
  'use strict';

  var W = typeof window !== 'undefined' ? window : this;

  var nfInt = new Intl.NumberFormat('pt-BR');
  var nf1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var nfDen = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });

  var instances = {}; // canvasId -> Chart instance (único estado global)

  var MU = 5, SD = 1.5, XMIN = 1, XMAX = 10, NPTS = 121;

  // ---------- helpers ----------

  function varColor(name, fallback) {
    try {
      var v = W.getComputedStyle(W.document.documentElement).getPropertyValue(name);
      v = (v || '').trim();
      return v || fallback;
    } catch (e) { return fallback; }
  }

  function alpha(hex, a) {
    var m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
    if (!m) return hex;
    var n = parseInt(m[1], 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function canvasFor(id) {
    return W.document ? W.document.getElementById(id) : null;
  }

  function destroyOn(canvas) {
    if (W.Chart && W.Chart.getChart) {
      var prev = W.Chart.getChart(canvas);
      if (prev) prev.destroy();
    }
    delete instances[canvas.id];
  }

  function el(tag, styles, text) {
    var node = W.document.createElement(tag);
    if (styles) for (var k in styles) if (Object.prototype.hasOwnProperty.call(styles, k)) node.style[k] = styles[k];
    if (text != null) node.textContent = text;
    return node;
  }

  // ---------- fallback (sem Chart.js) ----------

  function fallbackDiv(canvas) {
    var wrap = canvas.parentNode || canvas;
    var fb = wrap.querySelector('.chart-fallback');
    if (!fb) {
      fb = el('div', {
        display: 'flex', flexDirection: 'column', gap: '4px',
        position: 'absolute', inset: '0', overflow: 'auto', padding: '4px 0',
        fontFamily: 'inherit', fontSize: '12px', color: varColor('--slate', '#334155')
      });
      fb.className = 'chart-fallback';
      wrap.appendChild(fb);
    }
    fb.innerHTML = '';
    canvas.style.display = 'none';
    return fb;
  }

  function clearFallback(canvas) {
    var wrap = canvas.parentNode;
    var fb = wrap ? wrap.querySelector('.chart-fallback') : null;
    if (fb) fb.parentNode.removeChild(fb);
    canvas.style.display = '';
  }

  function fallbackRA(rows) {
    var canvas = canvasFor('chart-ra');
    if (!canvas) return;
    var fb = fallbackDiv(canvas);
    var max = 0, i;
    for (i = 0; i < rows.length; i++) if (rows[i].candidatos > max) max = rows[i].candidatos;
    if (!max) return;
    var indigo = varColor('--indigo', '#6366f1');
    for (i = 0; i < Math.min(rows.length, 10); i++) {
      var r = rows[i];
      var line = el('div', { display: 'flex', alignItems: 'center', gap: '8px', lineHeight: '1.4' });
      line.appendChild(el('span', { flex: '0 0 36%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, r.nome));
      var track = el('div', { flex: '1 1 auto', height: '10px', background: alpha(indigo, 0.12), borderRadius: '4px' });
      track.appendChild(el('div', {
        height: '100%', width: (100 * r.candidatos / max).toFixed(1) + '%',
        background: alpha(indigo, 0.75), borderRadius: '4px'
      }));
      line.appendChild(track);
      line.appendChild(el('span', { flex: '0 0 auto', color: varColor('--muted', '#64748b') },
        nfInt.format(r.candidatos) + ' · ' + nf1.format(r.pct || 0) + '%'));
      fb.appendChild(line);
    }
  }

  function erf(x) { // Abramowitz & Stegun 7.1.26
    var s = x < 0 ? -1 : 1;
    x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-x * x);
    return s * y;
  }

  function tailProb(min) { return (1 - erf((min - MU) / (SD * Math.SQRT2))) / 2; }

  function dens(x) { var z = (x - MU) / SD; return Math.exp(-0.5 * z * z) / (SD * Math.sqrt(2 * Math.PI)); }

  function fallbackAparencia(notaMin) {
    var canvas = canvasFor('chart-aparencia');
    if (!canvas) return;
    var fb = fallbackDiv(canvas);
    fb.appendChild(el('p', { margin: '0' },
      'Chart.js indisponível — resumo textual. Normal μ = ' + nf1.format(MU) + ', σ = ' + nf1.format(SD) +
      '. Nota ≥ ' + nf1.format(notaMin) + ': ~' + nfInt.format(Math.round(tailProb(notaMin) * 100)) + '% da população.'));
    // curva textual (aspas ASCII): '#' = cauda selecionada (x ≥ notaMin), '·' = resto
    var linhas = [], ROWS = 7, COLS = 37, c, r;
    for (r = ROWS; r >= 0; r--) {
      var s = '';
      for (c = 0; c < COLS; c++) {
        var x = XMIN + c * (XMAX - XMIN) / (COLS - 1);
        var h = ROWS * dens(x) / dens(MU);
        s += h >= r ? (x >= notaMin ? '#' : '·') : ' ';
      }
      linhas.push(s);
    }
    fb.appendChild(el('pre', {
      margin: '6px 0 0', fontFamily: 'monospace', fontSize: '10px', lineHeight: '1',
      color: varColor('--emerald-strong', '#047857'), overflow: 'hidden'
    }, linhas.join('\n')));
  }

  // ---------- renderRA: barras horizontais ----------

  function renderRA(porRA) {
    var canvas = canvasFor('chart-ra');
    if (!canvas) return;

    var rows = (Array.isArray(porRA) ? porRA : []).filter(function (r) {
      return r && typeof r.candidatos === 'number' && isFinite(r.candidatos);
    }).slice().sort(function (a, b) { return b.candidatos - a.candidatos; }).slice(0, 35);

    if (!W.Chart) { if (rows.length) fallbackRA(rows); return; }
    clearFallback(canvas);
    destroyOn(canvas);
    if (!rows.length) return;

    var indigo = varColor('--indigo', '#6366f1');
    var emerald = varColor('--emerald', '#10b981');
    var border = varColor('--border', '#e2e8f0');
    var muted = varColor('--muted', '#64748b');

    instances[canvas.id] = new W.Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map(function (r) { return r.nome; }),
        datasets: [{
          label: 'Candidatos',
          data: rows.map(function (r) { return r.candidatos; }),
          backgroundColor: alpha(indigo, 0.75),
          hoverBackgroundColor: alpha(emerald, 0.85),
          borderColor: indigo,
          borderWidth: 1,
          borderRadius: 3,
          barPercentage: 0.85
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false, // altura controlada por CSS (.chart-wrap)
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: alpha(border, 0.9), drawTicks: false },
            border: { display: false },
            ticks: { color: muted, callback: function (v) { return nfInt.format(v); } }
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: varColor('--slate', '#334155'), font: { size: 11 } }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var r = rows[ctx.dataIndex];
                return nfInt.format(r.candidatos) + ' candidatos · ' + nf1.format(r.pct || 0) + '%';
              }
            }
          }
        }
      }
    });
  }

  // ---------- renderAparencia: curva normal + cauda ----------

  function pontos() {
    var out = [], i;
    for (i = 0; i < NPTS; i++) {
      var x = XMIN + i * (XMAX - XMIN) / (NPTS - 1);
      out.push({ x: x, y: dens(x) });
    }
    return out;
  }

  function renderAparencia(notaMin) {
    var canvas = canvasFor('chart-aparencia');
    if (!canvas) return;
    notaMin = (typeof notaMin === 'number' && isFinite(notaMin))
      ? Math.min(XMAX, Math.max(XMIN, notaMin)) : MU;

    if (!W.Chart) { fallbackAparencia(notaMin); return; }
    clearFallback(canvas);

    var curva = pontos();
    var cauda = curva.map(function (p) { return { x: p.x, y: p.x >= notaMin ? p.y : null }; });

    var existente = W.Chart.getChart(canvas);
    if (existente && instances[canvas.id] === existente) {
      // re-render barato: só troca a área sombreada
      existente.data.datasets[1].data = cauda;
      existente.data.datasets[1].label = 'Nota ≥ ' + nf1.format(notaMin);
      existente.update('none');
      return;
    }
    destroyOn(canvas);

    var indigo = varColor('--indigo', '#6366f1');
    var emerald = varColor('--emerald', '#10b981');
    var border = varColor('--border', '#e2e8f0');
    var muted = varColor('--muted', '#64748b');

    instances[canvas.id] = new W.Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Densidade',
            data: curva,
            borderColor: indigo,
            borderWidth: 2,
            pointRadius: 0,
            tension: 0,
            fill: false
          },
          {
            label: 'Nota ≥ ' + nf1.format(notaMin),
            data: cauda,
            borderColor: 'transparent',
            backgroundColor: alpha(emerald, 0.28),
            fill: 'origin',
            pointRadius: 0,
            tension: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            type: 'linear',
            min: XMIN,
            max: XMAX,
            grid: { color: alpha(border, 0.9), drawTicks: false },
            border: { display: false },
            ticks: { stepSize: 1, color: muted, callback: function (v) { return nfInt.format(v); } }
          },
          y: { display: false, beginAtZero: true }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: function (items) { return 'Nota ' + nf1.format(items[0].parsed.x); },
              label: function (item) {
                if (item.parsed.y == null) return '';
                return 'Densidade ' + nfDen.format(item.parsed.y);
              }
            }
          }
        }
      }
    });
  }

  // ---------- destroy ----------

  function destroy() {
    Object.keys(instances).forEach(function (id) {
      var c = instances[id];
      if (c) c.destroy();
    });
    instances = {};
  }

  W.Charts = {
    renderRA: renderRA,
    renderAparencia: renderAparencia,
    destroy: destroy
  };
})();
