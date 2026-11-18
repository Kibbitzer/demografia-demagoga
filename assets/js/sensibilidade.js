/**
 * sensibilidade.js — Simulação de remoção de filtros (Fase 2, PLAN §5) + Sobol global (PLAN §13.4).
 * Puro: só depende de window.Engine / window.FILTERS_CONFIG. Sem DOM.
 * API: window.Sensibilidade = { top(state, n=4), global(state) }
 * Entrada de top(): { id, label, delta, deltaAbs, deltaRel, texto } — delta = totalSemFiltro − totalBase,
 * ordenado por deltaAbs desc, cortado em n. Nenhum filtro ativo → lista vazia (a mensagem fica no UI).
 * global(state): índices de sensibilidade por Monte Carlo sobre os filtros ativos ligados/desligados
 * (p=0,5, N=512, PRNG mulberry32 seed 20261118). Saída [{id,label,S,S_T,rank}] ordenada por S_T desc,
 * vazia sem filtro ativo.
 */
(function () {
  'use strict';

  var W = typeof window !== 'undefined' ? window : this;

  // eixos estruturais nunca entram na sensibilidade (ver engine STRUCT_KEYS + idade range)
  var ESTRUTURAIS = { generoUsuario: 1, generoBuscado: 1, orientacaoAlvo: 1, idade: 1 };

  var SEED = 20261118; // mesma semente de incerteza.js ⇒ resultados reprodutíveis
  var N_GLOBAL = 512;

  function num(x) { return typeof x === 'number' && isFinite(x); }

  // mulberry32 — mesmo PRNG de incerteza.js (cópia local: módulos continuam independentes)
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function deepCopy(v) {
    if (Array.isArray(v)) { var a = v.slice(); for (var i = 0; i < a.length; i++) a[i] = deepCopy(a[i]); return a; }
    if (v && typeof v === 'object') { var o = {}, k; for (k in v) if (Object.prototype.hasOwnProperty.call(v, k)) o[k] = deepCopy(v[k]); return o; }
    return v;
  }

  function neutralValue(cfg) {
    if (cfg.type === 'multi') return (cfg.options || []).map(function (o) { return o.value; });
    if (cfg.type === 'tri-state') return 'indiferente';
    if (cfg.type === 'range') return [cfg.min, cfg.max];
    if (cfg.type === 'toggle') return false;
    return cfg.defaultValue;
  }

  function isAtivo(cfg, val) {
    var i;
    if (cfg.type === 'multi') {
      var opts = cfg.options || [];
      if (!opts.length) return false;
      var marked = Array.isArray(val) ? val : (val != null ? [val] : []);
      for (i = 0; i < opts.length; i++) if (marked.indexOf(opts[i].value) < 0) return true;
      return false; // todas marcadas = indiferente
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
    if (cfg.type === 'toggle') return typeof val === 'boolean' ? val : !!(val && val.ativo);
    return false; // select: eixo estrutural
  }

  var fmtNum = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  var fmtPct = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

  function textoDo(entry) {
    var sinal = entry.delta >= 0 ? '+' : '−';
    return 'Remover ' + entry.label + ' adiciona ' + sinal + fmtNum.format(Math.abs(entry.delta)) +
      ' pessoas (' + sinal + fmtPct.format(Math.abs(entry.deltaRel) * 100) + '%)';
  }

  function top(state, n) {
    if (!W.Engine || !W.Engine.calcular) return [];
    var N = num(n) ? Math.max(1, Math.floor(n)) : 4;
    var s = W.Engine.normalizeState(state);
    var base = W.Engine.calcular(s).total;
    var cfgs = W.FILTERS_CONFIG || [], out = [], i, k;
    for (i = 0; i < cfgs.length; i++) {
      var cfg = cfgs[i];
      if (ESTRUTURAIS[cfg.id] || !isAtivo(cfg, s[cfg.id])) continue;
      var alt = {};
      for (k in s) if (Object.prototype.hasOwnProperty.call(s, k)) alt[k] = s[k];
      alt[cfg.id] = neutralValue(cfg);
      var delta = W.Engine.calcular(alt).total - base;
      var entry = {
        id: cfg.id, label: cfg.label, delta: delta,
        deltaAbs: Math.abs(delta), deltaRel: base > 0 ? delta / base : 0, texto: ''
      };
      entry.texto = textoDo(entry);
      out.push(entry);
    }
    out.sort(function (a, b) { return b.deltaAbs - a.deltaAbs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
    return out.slice(0, N);
  }

  // ---------- Sobol global por Monte Carlo (PLAN §13.4) ----------
  // Amostra N estados: cada filtro ativo ligado/desligado com p=0,5 (desligado = neutralValue).
  // Para fator binário Xi com média condicionada μb e variância condicionada Vb:
  //   S_i   = Var(E[Y|Xi]) / Var(Y) = p·(1−p)·(μ1−μ0)² / Var(Y)  (efeito principal)
  //   S_Ti  = 1 − Var(Y|Xi=0) / Var(Y)                            (fixando i, morrem interações de i)
  // S_T ≥ S é garantido por max(); ambos clampados em [0,1].

  function global(state) {
    if (!W.Engine || !W.Engine.calcular || !W.Engine.normalizeState) return [];
    var s = W.Engine.normalizeState(state);
    var cfgs = W.FILTERS_CONFIG || [], ativos = [], i, k;
    for (i = 0; i < cfgs.length; i++) {
      var cfg = cfgs[i];
      if (ESTRUTURAIS[cfg.id] || cfg.structural || !isAtivo(cfg, s[cfg.id])) continue;
      ativos.push(cfg);
    }
    if (!ativos.length) return [];

    var rng = mulberry32(SEED);
    var Y = [], X = []; // X[j][n] = filtro j ligado na amostra n
    for (i = 0; i < ativos.length; i++) X.push(new Array(N_GLOBAL));
    var mean = 0, m2 = 0;
    for (var n = 0; n < N_GLOBAL; n++) {
      var st = deepCopy(s);
      for (i = 0; i < ativos.length; i++) {
        var on = rng() < 0.5;
        X[i][n] = on;
        if (!on) st[ativos[i].id] = neutralValue(ativos[i]);
      }
      var r = W.Engine.calcular(st);
      var y = r && num(r.total) ? r.total : 0;
      Y.push(y);
      var d = y - mean; mean += d / (n + 1); m2 += d * (y - mean);
    }
    var varY = N_GLOBAL > 1 ? m2 / N_GLOBAL : 0; // variância populacional

    var out = [];
    for (i = 0; i < ativos.length; i++) {
      var n1 = 0, s1 = 0, s2 = 0, n0 = 0, t0 = 0, t2 = 0;
      for (n = 0; n < N_GLOBAL; n++) {
        if (X[i][n]) { n1++; s1 += Y[n]; s2 += Y[n] * Y[n]; }
        else { n0++; t0 += Y[n]; t2 += Y[n] * Y[n]; }
      }
      var S = 0, ST = 0;
      if (varY > 0 && n1 > 1 && n0 > 1) {
        var mu1 = s1 / n1, mu0 = t0 / n0;
        var p = n1 / N_GLOBAL;
        S = p * (1 - p) * (mu1 - mu0) * (mu1 - mu0) / varY;
        ST = 1 - (t2 / n0 - (t0 / n0) * (t0 / n0)) / varY;
      }
      S = clamp01(S); ST = clamp01(ST);
      if (ST < S) ST = S;
      out.push({ id: ativos[i].id, label: ativos[i].label, S: S, S_T: ST, rank: 0 });
    }
    out.sort(function (a, b) {
      return b.S_T - a.S_T || b.S - a.S || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
    for (i = 0; i < out.length; i++) out[i].rank = i + 1;
    return out;
  }

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  W.Sensibilidade = { top: top, global: global };
})();
