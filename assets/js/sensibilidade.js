/**
 * sensibilidade.js — Simulação de remoção de filtros (Fase 2, PLAN §5).
 * Puro: só depende de window.Engine / window.FILTERS_CONFIG. Sem DOM.
 * API: window.Sensibilidade = { top(state, n=4) }
 * Entrada de top(): { id, label, delta, deltaAbs, deltaRel, texto } — delta = totalSemFiltro − totalBase,
 * ordenado por deltaAbs desc, cortado em n. Nenhum filtro ativo → lista vazia (a mensagem fica no UI).
 */
(function () {
  'use strict';

  var W = typeof window !== 'undefined' ? window : this;

  // eixos estruturais nunca entram na sensibilidade (ver engine STRUCT_KEYS + idade range)
  var ESTRUTURAIS = { generoUsuario: 1, generoBuscado: 1, orientacaoAlvo: 1, idade: 1 };

  function num(x) { return typeof x === 'number' && isFinite(x); }

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

  W.Sensibilidade = { top: top };
})();
