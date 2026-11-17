/**
 * ui.js — Camada de DOM da calculadora (Fase 2).
 * Puro DOM: nunca chama Engine/Sensibilidade. Renderiza sidebar 100% a partir
 * de window.FILTERS_CONFIG (ids de filtro nunca hardcoded, exceto 'aparencia',
 * que vive no card lúdico e não aparece na sidebar).
 * API: window.UI = { init, sync, render, openMetodologia, closeMetodologia }
 */
(function () {
  'use strict';

  var W = window;
  var DOC = document;
  var BASE_DF = 3009996; // população estimada DF 2026 (denominador do %)

  // ---------- helpers ----------

  function $(sel, root) { return (root || DOC).querySelector(sel); }

  function make(tag, cls, text) {
    var n = DOC.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function setText(node, txt) {
    if (node) node.textContent = (txt == null || txt === '') ? '—' : String(txt);
  }

  function num(x) { return typeof x === 'number' && isFinite(x); }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  var fmtInt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  var fmt1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var fmt2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  // Φ — cdf da normal padrão (Abramowitz & Stegun 26.2.17), mesma da engine.
  function bPhi(x) {
    if (!(x > -40)) return 0;
    if (x > 40) return 1;
    var z = Math.abs(x) / Math.SQRT2;
    var t = 1 / (1 + 0.5 * z);
    var y = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
      t * (-0.18629528 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
      t * (-0.82215223 + t * 0.17087277)))))))));
    return clamp(x >= 0 ? 1 - 0.5 * y : 0.5 * y, 0, 1);
  }

  // fator do modificador de aparência: P(nota >= X) = 1 − Φ((X−5)/1,5)
  function fatorAparencia(nota) {
    if (!num(nota)) nota = 5;
    return Math.max(0, 1 - bPhi((nota - 5) / 1.5));
  }

  var UNIDADES = { idade: 'anos', altura: 'cm', renda: 'SM' }; // apenas exibição de sufixo

  function unidadeDe(cfg) {
    if (cfg.unidade != null) return String(cfg.unidade);
    return UNIDADES[cfg.id] || '';
  }

  // valor "neutro" (indiferente) por tipo — espelha sensibilidade.js
  function neutralValue(cfg) {
    if (cfg.type === 'multi') return (cfg.options || []).map(function (o) { return o.value; });
    if (cfg.type === 'tri-state') return 'indiferente';
    if (cfg.type === 'range') return [cfg.min, cfg.max];
    return cfg.defaultValue;
  }

  // ativo/restritivo? (espelha Sensibilidade.isAtivo; select é eixo estrutural)
  function isAtivo(cfg, val) {
    var i, opts, marked;
    if (cfg.type === 'multi') {
      opts = cfg.options || [];
      if (!opts.length) return false;
      marked = Array.isArray(val) ? val : (val != null ? [val] : []);
      for (i = 0; i < opts.length; i++) if (marked.indexOf(opts[i].value) < 0) return true;
      return false;
    }
    if (cfg.type === 'tri-state') {
      var o = (cfg.options || []).filter(function (x) { return x.value === val; })[0];
      return !!(o && o.probKey != null);
    }
    if (cfg.type === 'range') {
      if (!Array.isArray(val) || !num(val[0]) || !num(val[1])) return false;
      var lo = Math.min(val[0], val[1]), hi = Math.max(val[0], val[1]);
      return lo > cfg.min || hi < cfg.max;
    }
    if (cfg.id === 'orientacaoAlvo') {
      if (Array.isArray(val)) return val.length < (cfg.multiOptions || []).length;
      return val !== 'auto';
    }
    if (cfg.type === 'select') return val != null && val !== cfg.defaultValue;
    if (cfg.type === 'toggle') return typeof val === 'boolean' ? val : !!(val && val.ativo);
    return false;
  }

  // ---------- estado interno do módulo ----------

  var handlers = {};
  var controls = {};   // id -> { cfg, group, handle(target, role, evType), apply(val) }
  var groups = {};     // categoria -> { details, counter, ids }
  var curVals = {};    // espelho local dos valores exibidos
  var built = false;
  var metodologiaBuilt = false;
  var raRows = [];     // última res.porRA ordenada (para busca)
  var lastFocusBeforeModal = null;

  function emitChange(id, value) {
    if (handlers.onFilterChange) handlers.onFilterChange(id, value);
  }

  function cfgById(id) {
    var cfgs = W.FILTERS_CONFIG || [];
    for (var i = 0; i < cfgs.length; i++) if (cfgs[i] && cfgs[i].id === id) return cfgs[i];
    return null;
  }

  // ---------- construção da sidebar ----------

  function buildHelp(cfg) {
    var det = make('details', 'filter-help');
    det.title = 'Fonte: ' + (cfg.source || '—') + (cfg.methodologyNote ? ' — ' + cfg.methodologyNote : '');
    var sum = make('summary', null, 'i');
    sum.setAttribute('aria-label', 'Mais sobre ' + (cfg.label || cfg.id));
    det.appendChild(sum);
    var body = DOC.createDocumentFragment();
    if (cfg.source) {
      var p1 = make('p');
      p1.appendChild(make('strong', null, 'Fonte: '));
      p1.appendChild(DOC.createTextNode(cfg.source));
      body.appendChild(p1);
    }
    if (cfg.methodologyNote) body.appendChild(make('p', null, cfg.methodologyNote));
    if (cfg.ajuda) body.appendChild(make('p', null, cfg.ajuda));
    det.appendChild(body);
    return det;
  }

  function chipOption(opt, id, checked, role) {
    var lab = make('label', 'chip chip-check');
    var inp = DOC.createElement('input');
    inp.type = 'checkbox';
    inp.setAttribute('data-filter', id);
    inp.setAttribute('data-role', role || 'opt');
    inp.setAttribute('data-value', opt.value);
    inp.checked = !!checked;
    lab.appendChild(inp);
    lab.appendChild(DOC.createTextNode(opt.label != null ? opt.label : String(opt.value)));
    return lab;
  }

  function buildSelect(cfg, host) {
    var sel = DOC.createElement('select');
    sel.id = 'ctl-' + cfg.id;
    sel.className = 'select';
    sel.setAttribute('data-filter', cfg.id);
    sel.setAttribute('data-role', 'select');
    (cfg.options || []).forEach(function (opt) {
      var o = DOC.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label != null ? opt.label : String(opt.value);
      sel.appendChild(o);
    });
    sel.value = curVals[cfg.id] != null ? curVals[cfg.id] : cfg.defaultValue;
    host.appendChild(sel);

    var manualHost = null;
    if (cfg.id === 'orientacaoAlvo') {
      manualHost = make('div', 'chip-grid');
      manualHost.id = 'manual-orientacaoAlvo';
      manualHost.setAttribute('hidden', '');
      (cfg.multiOptions || []).forEach(function (opt) {
        manualHost.appendChild(chipOption(opt, cfg.id, true, 'manual-opt'));
      });
      host.appendChild(manualHost);
    }

    function manualValues() {
      var arr = [];
      if (!manualHost) return arr;
      var boxes = manualHost.querySelectorAll('input[type=checkbox]');
      for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) arr.push(boxes[i].getAttribute('data-value'));
      return arr;
    }

    return {
      handle: function (target, role) {
        if (role === 'select') {
          if (!manualHost) { curVals[cfg.id] = target.value; emitChange(cfg.id, target.value); return; }
          if (target.value === 'manual') {
            manualHost.removeAttribute('hidden');
            curVals[cfg.id] = manualValues();
          } else {
            manualHost.setAttribute('hidden', '');
            curVals[cfg.id] = 'auto';
          }
          emitChange(cfg.id, curVals[cfg.id]);
          return;
        }
        if (role === 'manual-opt') {
          curVals[cfg.id] = manualValues();
          emitChange(cfg.id, curVals[cfg.id]);
        }
      },
      apply: function (val) {
        if (Array.isArray(val)) {
          if (manualHost) {
            sel.value = 'manual';
            manualHost.removeAttribute('hidden');
            var boxes = manualHost.querySelectorAll('input[type=checkbox]');
            for (var i = 0; i < boxes.length; i++) boxes[i].checked = val.indexOf(boxes[i].getAttribute('data-value')) >= 0;
          } else {
            sel.value = cfg.defaultValue;
          }
          curVals[cfg.id] = val.slice();
        } else {
          var v = (val != null && String(val) !== '') ? String(val) : 'auto';
          sel.value = v;
          if (sel.value !== v) sel.value = cfg.defaultValue; // valor desconhecido: não deixa select "vazio"
          v = sel.value;
          if (manualHost) {
            if (v === 'manual') {
              manualHost.removeAttribute('hidden');
              var all = (cfg.multiOptions || []).map(function (o) { return o.value; });
              var bx = manualHost.querySelectorAll('input[type=checkbox]');
              for (var j = 0; j < bx.length; j++) bx[j].checked = true;
              curVals[cfg.id] = all;
            } else {
              manualHost.setAttribute('hidden', '');
              curVals[cfg.id] = v;
            }
            return;
          }
          curVals[cfg.id] = v;
        }
      }
    };
  }

  function buildRange(cfg, host) {
    var min = num(cfg.min) ? cfg.min : 0;
    var max = num(cfg.max) ? cfg.max : 100;
    var step = num(cfg.step) && cfg.step > 0 ? cfg.step : 1;

    var wrap = make('div', 'dual-range');
    var track = make('div', 'dual-range-track');
    var fill = make('div', 'dual-range-fill');
    track.appendChild(fill);
    wrap.appendChild(track);

    var loIn = DOC.createElement('input');
    loIn.type = 'range';
    loIn.min = min; loIn.max = max; loIn.step = step;
    loIn.setAttribute('data-filter', cfg.id);
    loIn.setAttribute('data-role', 'lo');
    loIn.setAttribute('aria-label', (cfg.label || cfg.id) + ' — limite mínimo');
    var hiIn = DOC.createElement('input');
    hiIn.type = 'range';
    hiIn.min = min; hiIn.max = max; hiIn.step = step;
    hiIn.setAttribute('data-filter', cfg.id);
    hiIn.setAttribute('data-role', 'hi');
    hiIn.setAttribute('aria-label', (cfg.label || cfg.id) + ' — limite máximo');
    wrap.appendChild(loIn);
    wrap.appendChild(hiIn);
    host.appendChild(wrap);

    var valsRow = make('div', 'dual-range-values');
    var out = DOC.createElement('output');
    out.id = 'out-' + cfg.id;
    valsRow.appendChild(out);
    host.appendChild(valsRow);

    var unit = unidadeDe(cfg);

    function visual() {
      var lo = clamp(parseFloat(loIn.value), min, max);
      var hi = clamp(parseFloat(hiIn.value), min, max);
      var span = (max - min) || 1;
      fill.style.left = (((lo - min) / span) * 100) + '%';
      fill.style.width = (((hi - lo) / span) * 100) + '%';
      out.textContent = lo + ' – ' + hi + (unit ? ' ' + unit : '');
    }

    function readPair() {
      var lo = parseFloat(loIn.value);
      var hi = parseFloat(hiIn.value);
      if (!num(lo)) lo = min;
      if (!num(hi)) hi = max;
      if (lo > hi) { // empurra o outro controle para manter min ≤ max
        if (this && this.role === 'lo') { hi = lo; hiIn.value = String(hi); }
        else { lo = hi; loIn.value = String(lo); }
      }
      return [lo, hi];
    }

    var lastRole = null;
    return {
      handle: function (target, role) {
        lastRole = role;
        var pair = readPair.call({ role: role });
        curVals[cfg.id] = pair;
        visual();
        emitChange(cfg.id, pair);
      },
      apply: function (val) {
        var arr = Array.isArray(val) ? val : neutralValue(cfg);
        var lo = clamp(num(arr[0]) ? arr[0] : min, min, max);
        var hi = clamp(num(arr[1]) ? arr[1] : max, min, max);
        if (lo > hi) { var t = lo; lo = hi; hi = t; }
        loIn.value = String(lo);
        hiIn.value = String(hi);
        curVals[cfg.id] = [lo, hi];
        visual();
      }
    };
  }

  function buildMulti(cfg, host) {
    var grid = make('div', 'chip-grid');
    grid.id = 'ctl-' + cfg.id;
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-labelledby', 'lbl-' + cfg.id);
    var def = Array.isArray(cfg.defaultValue) ? cfg.defaultValue : null;
    (cfg.options || []).forEach(function (opt) {
      grid.appendChild(chipOption(opt, cfg.id, def ? def.indexOf(opt.value) >= 0 : true, 'opt'));
    });
    host.appendChild(grid);

    function values() {
      var arr = [];
      var boxes = grid.querySelectorAll('input[type=checkbox]');
      for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) arr.push(boxes[i].getAttribute('data-value'));
      return arr;
    }

    return {
      handle: function () {
        // todas desmarcadas = zero candidatos; não reativa tudo.
        curVals[cfg.id] = values();
        emitChange(cfg.id, curVals[cfg.id]);
      },
      apply: function (val) {
        var arr = Array.isArray(val) ? val : (val != null ? [val] : []);
        var boxes = grid.querySelectorAll('input[type=checkbox]');
        for (var i = 0; i < boxes.length; i++) boxes[i].checked = arr.indexOf(boxes[i].getAttribute('data-value')) >= 0;
        curVals[cfg.id] = arr.slice();
      }
    };
  }

  function buildTriState(cfg, host) {
    var seg = make('div', 'segmented');
    seg.id = 'ctl-' + cfg.id;
    seg.setAttribute('role', 'radiogroup');
    seg.setAttribute('aria-labelledby', 'lbl-' + cfg.id);
    (cfg.options || [
      { value: 'sim', label: 'Sim' },
      { value: 'nao', label: 'Não' },
      { value: 'indiferente', label: 'Tanto faz' }
    ]).forEach(function (opt) {
      var lab = DOC.createElement('label');
      var inp = DOC.createElement('input');
      inp.type = 'radio';
      inp.name = 'tri-' + cfg.id;
      inp.value = opt.value;
      inp.setAttribute('data-filter', cfg.id);
      inp.setAttribute('data-role', 'tri');
      inp.checked = curVals[cfg.id] === opt.value;
      lab.appendChild(inp);
      lab.appendChild(DOC.createTextNode(opt.label != null ? opt.label : String(opt.value)));
      seg.appendChild(lab);
    });
    host.appendChild(seg);

    return {
      handle: function (target) {
        curVals[cfg.id] = target.value;
        emitChange(cfg.id, target.value);
      },
      apply: function (val) {
        var radios = seg.querySelectorAll('input[type=radio]');
        var hit = false;
        for (var i = 0; i < radios.length; i++) {
          radios[i].checked = (radios[i].value === val);
          if (radios[i].checked) hit = true;
        }
        if (!hit) { // valor desconhecido cai em "indiferente"
          for (var j = 0; j < radios.length; j++) if (radios[j].value === 'indiferente') { radios[j].checked = true; break; }
          val = 'indiferente';
        }
        curVals[cfg.id] = val;
      }
    };
  }

  function buildFilterItem(cfg, body) {
    var item = make('div', 'filter-item');
    item.setAttribute('data-filter-id', cfg.id);

    var head = make('div', 'field-head');
    var label;
    if (cfg.type === 'select') {
      label = make('label', 'filter-label', cfg.label || cfg.id);
      label.setAttribute('for', 'ctl-' + cfg.id);
    } else {
      label = make('span', 'filter-label', cfg.label || cfg.id);
      label.id = 'lbl-' + cfg.id;
    }
    head.appendChild(label);
    head.appendChild(buildHelp(cfg));
    item.appendChild(head);

    var api;
    if (cfg.type === 'select') api = buildSelect(cfg, item);
    else if (cfg.type === 'range') api = buildRange(cfg, item);
    else if (cfg.type === 'multi') api = buildMulti(cfg, item);
    else if (cfg.type === 'tri-state') api = buildTriState(cfg, item);
    else return null; // tipo não suportado na sidebar

    controls[cfg.id] = api;
    api.cfg = cfg;
    api.apply(curVals[cfg.id] != null ? curVals[cfg.id] : cfg.defaultValue); // estado inicial coerente (sliders, etc.)
    body.appendChild(item);
    return true;
  }

  function updateCounters() {
    for (var cat in groups) {
      if (!Object.prototype.hasOwnProperty.call(groups, cat)) continue;
      var g = groups[cat], n = 0;
      for (var i = 0; i < g.ids.length; i++) {
        var cfg = cfgById(g.ids[i]);
        if (cfg && isAtivo(cfg, curVals[g.ids[i]])) n++;
      }
      g.counter.textContent = n > 0 ? String(n) : '';
      if (n > 0) g.counter.removeAttribute('hidden');
      else g.counter.setAttribute('hidden', '');
    }
  }

  function buildFilters() {
    var host = $('#filters-list');
    if (!host || !Array.isArray(W.FILTERS_CONFIG)) return;

    // agrupa por category (ordem de primeira aparição); ignora toggle e 'aparencia'
    var cfgs = W.FILTERS_CONFIG.filter(function (c) {
      return c && c.id && c.id !== 'aparencia' && c.type !== 'toggle';
    });
    cfgs.forEach(function (c) { curVals[c.id] = deepCopyValue(c.defaultValue); });

    var order = [];
    cfgs.forEach(function (c) {
      var cat = c.category || 'Outros';
      if (!groups[cat]) { order.push(cat); groups[cat] = { ids: [] }; }
      groups[cat].ids.push(c.id);
    });

    order.forEach(function (cat) {
      var det = make('details', 'filter-group');
      det.open = true;
      var sum = make('summary');
      sum.appendChild(make('span', null, cat));
      var counter = make('span', 'chip');
      counter.setAttribute('hidden', '');
      counter.setAttribute('aria-label', 'filtros ativos nesta categoria');
      sum.appendChild(counter);
      det.appendChild(sum);
      var body = make('div', 'filter-group-body');
      det.appendChild(body);
      groups[cat].details = det;
      groups[cat].counter = counter;
      host.appendChild(det);
    });

    cfgs.forEach(function (cfg) {
      var g = groups[cfg.category || 'Outros'];
      if (g) buildFilterItem(cfg, bodyOf(g));
    });

    function bodyOf(g) { return g.details.querySelector('.filter-group-body'); }

    // delegação de eventos: range→input; select/checkbox/radio→change
    function onListEvent(ev) {
      var t = ev.target;
      if (!t || !t.getAttribute) return;
      var id = t.getAttribute('data-filter');
      if (!id || !controls[id]) return;
      var role = t.getAttribute('data-role') || '';
      var isRange = t.tagName === 'INPUT' && t.type === 'range';
      var isClicky = t.tagName === 'SELECT' || t.type === 'checkbox' || t.type === 'radio';
      if (isRange && ev.type !== 'input') return;
      if (isClicky && ev.type !== 'change') return;
      if (!isRange && !isClicky) return;
      controls[id].handle(t, role, ev.type);
      updateCounters();
    }
    host.addEventListener('input', onListEvent);
    host.addEventListener('change', onListEvent);
  }

  function deepCopyValue(v) {
    if (Array.isArray(v)) return v.slice();
    return v;
  }

  // ---------- KPIs ----------

  function renderKpi(res) {
    res = res || {};
    var total = num(res.total) ? res.total : 0;
    setText($('#kpi-total'), fmtInt.format(Math.round(total)));
    setText($('#kpi-pct'), fmt2.format((total / BASE_DF) * 100) + '%');
    var hab = num(res.umEmCadaHabitantes) && res.umEmCadaHabitantes > 0 ? res.umEmCadaHabitantes : null;
    setText($('#kpi-umemcada'), hab != null ? fmt1.format(hab) : '—');
    var grupo = num(res.umEmCada) && res.umEmCada > 0 ? res.umEmCada : null;
    setText($('#kpi-grupo'), grupo != null ? fmt1.format(grupo) : '—');
    setText($('#kpi-base'), num(res.base) ? fmtInt.format(Math.round(res.base)) : '—');
    setText($('#kpi-denom'), num(res.denominador) ? fmtInt.format(Math.round(res.denominador)) : '—');
    var zero = $('#aviso-zero');
    if (zero) {
      if (total < 0.5) zero.removeAttribute('hidden');
      else zero.setAttribute('hidden', '');
    }
  }

  // ---------- insights ----------

  function renderInsights(insights) {
    var host = $('#insights-list');
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    var list = Array.isArray(insights) ? insights : [];
    if (!list.length) {
      host.appendChild(make('li', 'insights-empty', 'Nenhum filtro restritivo ativo.'));
      return;
    }
    var maxRel = 0;
    list.forEach(function (e) { if (num(e.deltaRel) && Math.abs(e.deltaRel) > maxRel) maxRel = Math.abs(e.deltaRel); });
    list.forEach(function (e) {
      var li = make('li', 'insight');
      li.appendChild(make('span', 'insight-name', e.label || e.id || '—'));
      var rel = num(e.deltaRel) ? e.deltaRel : 0;
      li.appendChild(make('span', 'insight-impact', (rel >= 0 ? '+' : '−') + fmt1.format(Math.abs(rel) * 100) + '%'));
      var bar = make('div', 'insight-bar');
      var inner = make('span');
      inner.style.width = (maxRel > 0 ? clamp(Math.abs(rel) / maxRel, 0, 1) * 100 : 0) + '%';
      bar.appendChild(inner);
      li.appendChild(bar);
      var txt = make('p', 'texto', e.texto || '');
      txt.style.gridColumn = '1 / -1';
      li.appendChild(txt);
      host.appendChild(li);
    });
  }

  // ---------- tabela RA ----------

  function ensureRaHead() {
    var table = $('#table-ra');
    if (!table) return;
    var thead = table.tHead;
    if (!thead || thead.rows.length === 0) return;
    if (thead.rows[0].cells.length === 5) return;
    var cols = [
      { t: 'Região Administrativa', num: false },
      { t: 'População', num: true },
      { t: 'Peso', num: true },
      { t: 'Candidatos', num: true },
      { t: '% do total', num: true }
    ];
    var tr = thead.rows[0];
    while (tr.firstChild) tr.removeChild(tr.firstChild);
    cols.forEach(function (c) {
      var th = DOC.createElement('th');
      th.scope = 'col';
      th.textContent = c.t;
      if (c.num) th.className = 'num';
      tr.appendChild(th);
    });
  }

  function renderRaRows() {
    var body = $('#table-ra-body');
    if (!body) return;
    var term = norm(($('#search-ra') || {}).value || '');
    while (body.firstChild) body.removeChild(body.firstChild);

    var shown = raRows.filter(function (r) { return !term || norm(r.nome).indexOf(term) >= 0; });
    if (!shown.length) {
      var tr0 = DOC.createElement('tr');
      var td0 = DOC.createElement('td');
      td0.colSpan = 5;
      td0.className = 'table-empty';
      td0.textContent = raRows.length ? 'Nenhuma região encontrada para essa busca.' : 'Sem dados por região.';
      tr0.appendChild(td0);
      body.appendChild(tr0);
    } else {
      shown.forEach(function (r) {
        var tr = DOC.createElement('tr');
        var th = DOC.createElement('th');
        th.scope = 'row';
        th.textContent = r.nome || '—';
        tr.appendChild(th);
        [[num(r.populacao) ? fmtInt.format(r.populacao) : '—', true],
         [num(r.peso) ? fmt1.format(r.peso) + '%' : '—', true],
         [num(r.candidatos) ? fmtInt.format(Math.round(r.candidatos)) : '—', true],
         [num(r.pct) ? fmt1.format(r.pct) + '%' : '—', true]
        ].forEach(function (spec) {
          var td = DOC.createElement('td');
          td.textContent = spec[0];
          if (spec[1]) td.className = 'num';
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
    }

    var somaCand = 0, somaPct = 0, somaPop = 0;
    raRows.forEach(function (r) {
      if (num(r.candidatos)) somaCand += r.candidatos;
      if (num(r.pct)) somaPct += r.pct;
      if (num(r.populacao)) somaPop += r.populacao;
    });
    setText($('#table-ra-total-pop'), fmtInt.format(somaPop));
    setText($('#table-ra-total'), fmtInt.format(Math.round(somaCand)));
    setText($('#table-ra-total-pct'), raRows.length ? fmt1.format(somaPct) + '%' : '—');
  }

  function renderRa(res) {
    ensureRaHead();
    var list = (res && Array.isArray(res.porRA)) ? res.porRA.slice() : [];
    list.sort(function (a, b) {
      var ca = num(a.candidatos) ? a.candidatos : 0;
      var cb = num(b.candidatos) ? b.candidatos : 0;
      return cb - ca;
    });
    raRows = list;
    renderRaRows();
  }

  // ---------- aparência (card lúdico) ----------

  function notaAtual(state) {
    var ap = state && state.aparencia ? state.aparencia : null;
    var n = ap ? (num(ap.notaMinima) ? ap.notaMinima : (num(ap.nota) ? ap.nota : null)) : null;
    return n != null ? clamp(n, 1, 10) : 6;
  }

  function renderAparencia(state) {
    var nota = notaAtual(state);
    setText($('#aparencia-fator'), fmt1.format(fatorAparencia(nota) * 100) + '%');
    setText($('#nota-label'), fmt1.format(nota));
  }

  function applySwitch(ativo) {
    var sw = $('#switch-aparencia');
    var panel = $('#card-aparencia');
    if (sw) {
      sw.setAttribute('aria-checked', ativo ? 'true' : 'false');
      if (ativo) sw.classList.add('on'); else sw.classList.remove('on');
    }
    if (panel) {
      if (ativo) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
    }
  }

  // ---------- sync ----------

  function syncControls(state) {
    state = state || {};
    for (var id in controls) {
      if (!Object.prototype.hasOwnProperty.call(controls, id)) continue;
      if (id === 'aparencia') continue;
      var v = Object.prototype.hasOwnProperty.call(state, id) ? state[id] : controls[id].cfg.defaultValue;
      controls[id].apply(v);
    }
    updateCounters();
  }

  function sync(state) {
    state = state || {};
    syncControls(state);
    var ap = state.aparencia;
    var ativo = typeof ap === 'boolean' ? ap : !!(ap && ap.ativo);
    applySwitch(ativo);
    var nota = notaAtual(state);
    var inp = $('#input-nota');
    if (inp) inp.value = String(nota);
    renderAparencia(state);
  }

  // ---------- render ----------

  function render(res, state, insights) {
    renderKpi(res);
    renderInsights(insights);
    renderRa(res);
    if (state) sync(state);
    else renderAparencia(null);
  }

  // ---------- drawer ----------

  function isMobile() {
    return W.matchMedia && W.matchMedia('(max-width: 1023.98px)').matches;
  }

  function setDrawer(open) {
    var sidebar = $('#sidebar');
    var overlay = $('#sidebar-overlay');
    var btn = $('#btn-filtros');
    if (!sidebar) return;
    if (open) sidebar.classList.add('open'); else sidebar.classList.remove('open');
    if (overlay) { if (open) overlay.removeAttribute('hidden'); else overlay.setAttribute('hidden', ''); }
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open && isMobile()) {
      var first = $('#filters-list select, #filters-list input');
      if (first) first.focus();
    }
  }

  function drawerOpen() {
    var sidebar = $('#sidebar');
    return !!(sidebar && sidebar.classList.contains('open'));
  }

  function wireDrawer() {
    var btn = $('#btn-filtros');
    if (btn) btn.addEventListener('click', function () { setDrawer(!drawerOpen()); });
    var close = $('#btn-close-sidebar');
    if (close) close.addEventListener('click', function () {
      setDrawer(false);
      if (btn) btn.focus();
    });
    var overlay = $('#sidebar-overlay');
    if (overlay) overlay.addEventListener('click', function () { setDrawer(false); });
  }

  // ---------- modal metodologia ----------

  function buildMetodologia() {
    var host = $('#metodologia-body');
    if (!host || metodologiaBuilt) return;
    metodologiaBuilt = true;

    var cfgs = Array.isArray(W.FILTERS_CONFIG) ? W.FILTERS_CONFIG : [];
    if (cfgs.length) {
      host.appendChild(make('h3', null, 'Variáveis, fontes e confiança'));
      var wrap = make('div', 'table-wrap');
      var table = make('table', 'table');
      var thead = DOC.createElement('thead');
      var trh = DOC.createElement('tr');
      ['Filtro', 'Fonte', 'Nota metodológica', 'Confiança'].forEach(function (t) {
        var th = DOC.createElement('th');
        th.scope = 'col';
        th.textContent = t;
        trh.appendChild(th);
      });
      thead.appendChild(trh);
      table.appendChild(thead);
      var tbody = DOC.createElement('tbody');
      cfgs.forEach(function (cfg) {
        if (!cfg || !cfg.id) return;
        var tr = DOC.createElement('tr');
        var th = DOC.createElement('th');
        th.scope = 'row';
        th.textContent = cfg.label || cfg.id;
        tr.appendChild(th);
        var tdF = DOC.createElement('td');
        tdF.textContent = cfg.source || '—';
        tr.appendChild(tdF);
        var tdN = DOC.createElement('td');
        tdN.textContent = cfg.methodologyNote || cfg.ajuda || '—';
        tr.appendChild(tdN);
        var tdC = DOC.createElement('td');
        var badge = make('span', 'chip');
        var c = cfg.confianca;
        if (c === 'A') badge.classList.add('chip-good');
        else if (c === 'C') badge.classList.add('chip-bad');
        badge.textContent = (c === 'A' || c === 'B' || c === 'C') ? 'Confiança ' + c : '—';
        badge.title = c === 'A' ? 'Dado direto de fonte oficial' :
          c === 'B' ? 'Estimativa com premissas documentadas' :
          c === 'C' ? 'Proxy / premissa interna — baixo confiança' : '';
        tdC.appendChild(badge);
        tr.appendChild(tdC);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      host.appendChild(wrap);
    }

    host.appendChild(make('h3', null, 'Premissas do modelo'));
    var ul = DOC.createElement('ul');
    [
      'Independência aproximada entre filtros: cada proporção é condicionada a uma única variável; correlações reais podem deslocar o resultado.',
      'Margens recalculadas por faixa etária quando há série disponível (renda, escolaridade, estado civil, filhos).',
      'Renda × escolaridade correlacionadas pela matriz RendaEduBase quando ambos os filtros restringem.',
      'População de referência: ' + fmtInt.format(BASE_DF) + ' habitantes (DF, estimativa 2026).',
      'O modificador de aparência é premissa interna (normal μ=5, σ=1,5) sem base empírica.'
    ].forEach(function (t) { ul.appendChild(make('li', null, t)); });
    host.appendChild(ul);

    host.appendChild(make('h3', null, 'Aviso de estimativa'));
    host.appendChild(make('p', null,
      'Todos os números são ordens de grandeza derivadas de produtos de proporções populacionais — não contagens de pessoas reais. ' +
      'Combine filtros com consciência: cada restrição multiplica frações pequenas e o erro se acumula.'));
  }

  function openMetodologia() {
    var modal = $('#modal-metodologia');
    if (!modal || !modal.hasAttribute('hidden')) return; // já aberto
    buildMetodologia();
    lastFocusBeforeModal = DOC.activeElement;
    modal.removeAttribute('hidden');
    DOC.body.classList.add('modal-open');
    var closeBtn = $('#modal-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeMetodologia() {
    var modal = $('#modal-metodologia');
    if (!modal || modal.hasAttribute('hidden')) return;
    modal.setAttribute('hidden', '');
    DOC.body.classList.remove('modal-open');
    if (lastFocusBeforeModal && lastFocusBeforeModal.focus) lastFocusBeforeModal.focus();
    lastFocusBeforeModal = null;
  }

  function modalOpen() {
    var modal = $('#modal-metodologia');
    return !!(modal && !modal.hasAttribute('hidden'));
  }

  function wireModal() {
    var modal = $('#modal-metodologia');
    if (!modal) return;
    var closeBtn = $('#modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeMetodologia);
    modal.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t && t.closest && t.closest('[data-close-modal]')) closeMetodologia();
    });
  }

  // ---------- eventos globais ----------

  function wireGlobalKeys() {
    DOC.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape' && ev.key !== 'Esc') return;
      if (modalOpen()) { closeMetodologia(); return; }
      if (drawerOpen()) {
        setDrawer(false);
        var btn = $('#btn-filtros');
        if (btn) btn.focus();
      }
    });
  }

  // ---------- binding do card lúdico / topbar ----------

  function wireAparencia() {
    var sw = $('#switch-aparencia');
    if (sw) {
      sw.addEventListener('click', function () {
        var ativo = sw.getAttribute('aria-checked') !== 'true';
        if (handlers.onAppearanceToggle) handlers.onAppearanceToggle(ativo);
      });
    }
    var nota = $('#input-nota');
    if (nota) {
      nota.addEventListener('input', function () {
        var v = parseFloat(nota.value);
        if (num(v)) {
          setText($('#nota-label'), fmt1.format(v));
          setText($('#aparencia-fator'), fmt1.format(fatorAparencia(v) * 100) + '%');
        }
        if (handlers.onAppearanceNota) handlers.onAppearanceNota(v);
      });
    }
  }

  function wireTopbar() {
    var presetBtns = DOC.querySelectorAll('[data-preset]');
    for (var i = 0; i < presetBtns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          if (handlers.onPreset) handlers.onPreset(btn.getAttribute('data-preset'));
        });
      })(presetBtns[i]);
    }
    var reset = $('#btn-reset');
    if (reset) reset.addEventListener('click', function () {
      if (handlers.onReset) handlers.onReset();
    });
    var met = $('#btn-metodologia');
    if (met) met.addEventListener('click', function () {
      if (handlers.onMetodologia) handlers.onMetodologia();
    });
    var search = $('#search-ra');
    if (search) search.addEventListener('input', renderRaRows);
  }

  // ---------- API ----------

  function init(handlersIn) {
    handlers = handlersIn || {};
    if (built) return;
    built = true;
    buildFilters();
    wireDrawer();
    wireModal();
    wireGlobalKeys();
    wireAparencia();
    wireTopbar();
    ensureRaHead();
  }

  W.UI = {
    init: init,
    sync: sync,
    render: render,
    openMetodologia: openMetodologia,
    closeMetodologia: closeMetodologia
  };
})();
