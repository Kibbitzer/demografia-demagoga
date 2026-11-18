/**
 * analytics.js — Funil de redução da calculadora demográfica DF.
 * Puro: só depende de window.Engine / window.FILTERS_CONFIG. Sem DOM, sem fetch.
 * API: window.Funil = { calcular(state), atribuicao(state) }
 *
 * Estágios: [base (adultos 18–80, ambos os sexos, todas as orientações),
 *            publico (gênero + orientação), ...filtros ativos na ordem de FILTERS_CONFIG].
 * Cada estágio é Engine.calcular de um estado cumulativo: começa no estado neutro N e
 * recebe o valor do usuário de um filtro por vez ⇒ barras monotonicamente decrescentes.
 * Entradas: { id, label, total, delta, deltaPct, pctBase }
 *  - delta   = total − total do estágio anterior (≤ 0)
 *  - deltaPct = delta / total anterior (0 no primeiro)
 *  - pctBase  = total / total do primeiro estágio
 */
(function () {
  'use strict';

  var W = typeof window !== 'undefined' ? window : this;

  // eixos estruturais: montados nos estágios 'base'/'publico', nunca como barra de filtro
  var ESTRUTURAIS = { generoUsuario: 1, generoBuscado: 1, orientacaoAlvo: 1 };
  var LABEL_BASE = 'Adultos 18–80';
  var LABEL_PUBLICO = 'Gênero + orientação';

  function num(x) { return typeof x === 'number' && isFinite(x); }

  function deepCopy(v) {
    if (Array.isArray(v)) { var a = v.slice(); for (var i = 0; i < a.length; i++) a[i] = deepCopy(a[i]); return a; }
    if (v && typeof v === 'object') { var o = {}, k; for (k in v) if (Object.prototype.hasOwnProperty.call(v, k)) o[k] = deepCopy(v[k]); return o; }
    return v;
  }

  function relDiff(a, b) {
    var d = Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1);
    return d < 1e-15 ? 0 : d;
  }

  // valor neutro = "não filtra" (mesma convenção de sensibilidade.js)
  function neutralValue(cfg) {
    if (cfg.type === 'multi') return (cfg.options || []).map(function (o) { return o.value; });
    if (cfg.type === 'tri-state') return 'indiferente';
    if (cfg.type === 'range') return [cfg.min, cfg.max];
    if (cfg.type === 'toggle') return false;
    return deepCopy(cfg.defaultValue);
  }

  // mesma semântica de Sensibilidade.top: filtro neutro não gera barra
  function isAtivo(cfg, val) {
    var i;
    if (cfg.type === 'multi') {
      var opts = cfg.options || [];
      if (!opts.length) return false;
      var marked = Array.isArray(val) ? val : (val != null ? [val] : []);
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
    if (cfg.type === 'toggle') return typeof val === 'boolean' ? val : !!(val && val.ativo);
    return false; // select (inclusive istCenario, structural: troca de tabela, não probabilidade)
  }

  function limitesIdade() {
    var L = W.Engine && W.Engine.limites;
    return L && num(L.idadeMin) && num(L.idadeMax) ? [L.idadeMin, L.idadeMax] : [18, 80];
  }

  // estado neutro: mantém os eixos estruturais + istCenario, zera o resto
  function neutro(s) {
    var N = {}, cfgs = W.FILTERS_CONFIG || [], i, idade = limitesIdade();
    for (i = 0; i < cfgs.length; i++) {
      var cfg = cfgs[i];
      N[cfg.id] = (ESTRUTURAIS[cfg.id] || cfg.structural) ? deepCopy(s[cfg.id]) : neutralValue(cfg);
    }
    N.idade = idade;
    return N;
  }

  function totalDe(state) {
    var r = W.Engine.calcular(state);
    return r && num(r.total) ? r.total : 0;
  }

  function calcular(state) {
    if (!W.Engine || !W.Engine.calcular || !W.Engine.normalizeState) return [];
    var s = W.Engine.normalizeState(state);
    var cfgs = W.FILTERS_CONFIG || [];
    var N = neutro(s);

    // cruza o funil: acumulador começa no neutro e recebe um filtro ativo por vez
    var cur = deepCopy(N);
    var raw = [
      { id: 'base', label: LABEL_BASE, total: totalDe(mix(N, { generoBuscado: 'ambos', orientacaoAlvo: ['hetero', 'homo', 'bi'] })) },
      { id: 'publico', label: LABEL_PUBLICO, total: totalDe(N) }
    ];
    for (var i = 0; i < cfgs.length; i++) {
      var cfg = cfgs[i];
      if (ESTRUTURAIS[cfg.id] || cfg.structural) continue;
      if (!isAtivo(cfg, s[cfg.id])) continue;
      cur[cfg.id] = deepCopy(s[cfg.id]);
      raw.push({ id: cfg.id, label: cfg.label || cfg.id, total: totalDe(cur) });
    }

    // deltas com monotonicidade garantida (arredondamento nunca cria alta)
    var out = [], prev = null, baseTotal = raw[0].total;
    for (var j = 0; j < raw.length; j++) {
      var t = raw[j].total;
      if (prev !== null && t > prev) t = prev;
      var delta = prev === null ? 0 : t - prev;
      out.push({
        id: raw[j].id, label: raw[j].label, total: t, delta: delta,
        deltaPct: (prev === null || !(prev > 0)) ? 0 : delta / prev,
        pctBase: baseTotal > 0 ? t / baseTotal : 0
      });
      prev = t;
    }

    // fechamento: último estágio deve bater com o estado completo
    var last = out[out.length - 1], full = totalDe(s);
    if (relDiff(last.total, full) > 1e-6) {
      var tt = full, p = out.length > 1 ? out[out.length - 2].total : full;
      if (out.length > 1 && tt > p) tt = p;
      last.total = tt;
      last.delta = out.length > 1 ? tt - p : 0;
      last.deltaPct = (out.length > 1 && p > 0) ? (tt - p) / p : 0;
      last.pctBase = baseTotal > 0 ? tt / baseTotal : 0;
    }
    return out;
  }

  function mix(base, over) {
    var o = deepCopy(base), k;
    for (k in over) if (Object.prototype.hasOwnProperty.call(over, k)) o[k] = over[k];
    return o;
  }

  // ---------- atribuição por Shapley (PLAN §13.3) ----------
  // Perda marginal de cada filtro ativo, média sobre N_PERM permutações (Fisher–Yates,
  // mulberry32 seed 20261118). A soma telescópica por permutação vale sempre
  // totalNeutro − totalFinal ⇒ eficiência exata: soma das médias = totalNeutro − totalFinal.
  var SEED = 20261118;
  var N_PERM = 100;

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

  function atribuicao(state) {
    var vazio = { itens: [], soma: 0, neutro: 0, final: 0 };
    if (!W.Engine || !W.Engine.calcular || !W.Engine.normalizeState) return vazio;
    var s = W.Engine.normalizeState(state);
    var cfgs = W.FILTERS_CONFIG || [], N = neutro(s), i, j;
    var ativos = [];
    for (i = 0; i < cfgs.length; i++) {
      var cfg = cfgs[i];
      if (ESTRUTURAIS[cfg.id] || cfg.structural) continue;
      if (isAtivo(cfg, s[cfg.id])) ativos.push(cfg);
    }
    var neutroTotal = totalDe(N), finalTotal = totalDe(s);
    var res = { itens: [], soma: 0, neutro: neutroTotal, final: finalTotal };
    if (!ativos.length) { res.soma = neutroTotal - finalTotal; return res; }

    var rng = mulberry32(SEED);
    var acc = new Array(ativos.length);
    for (i = 0; i < ativos.length; i++) acc[i] = 0;
    var perm = new Array(ativos.length);
    for (j = 0; j < N_PERM; j++) {
      for (i = 0; i < ativos.length; i++) perm[i] = i;
      for (i = ativos.length - 1; i > 0; i--) { // Fisher–Yates
        var r = Math.floor(rng() * (i + 1)), tmp = perm[i]; perm[i] = perm[r]; perm[r] = tmp;
      }
      var cur = deepCopy(N), prev = neutroTotal;
      for (i = 0; i < perm.length; i++) {
        var idx = perm[i];
        cur[ativos[idx].id] = deepCopy(s[ativos[idx].id]);
        var t = totalDe(cur);
        acc[idx] += prev - t; // perda marginal de entrar o filtro nesta ordem
        prev = t;
      }
    }
    for (i = 0; i < ativos.length; i++) {
      var media = acc[i] / N_PERM;
      res.itens.push({ id: ativos[i].id, label: ativos[i].label, media: media });
      res.soma += media;
    }
    res.itens.sort(function (a, b) { return b.media - a.media || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
    return res;
  }

  W.Funil = { calcular: calcular, atribuicao: atribuicao };
})();
