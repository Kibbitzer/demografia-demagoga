/**
 * engine.js — Motor estatístico da calculadora demográfica DF (Fase 2).
 * Puro: só depende de window.DATA_POPULACAO / DATA_RAS / TAXAS / FILTERS_CONFIG. Sem DOM.
 * API: window.Engine = { calcular(state), celulas(), phi(x), limites, normalizeState(state) }
 *
 * Convenções de dados (sem id de filtro hardcoded no cálculo, exceto os 3 eixos
 * estruturais generoUsuario/generoBuscado/orientacaoAlvo e RANGE_HANDLERS por id
 * idade/altura):
 *  - probKey "caminho.no.bloco" → número em TAXAS; "{sexo}"/"{faixa}" interpolados
 *    pelo motor; sufixo ":<índice|id>" endereça coluna da margem da faixa etária
 *    corrente (lista de ids descoberta em TAXAS.*Faixas).
 *  - sufixo ":complemento" → 1 − p da opção base (convenção de opcoesTri em filtros.js).
 *  - tri-state: 'sim' resolve o probKey da opção 'sim'; 'nao' resolve o próprio
 *    (base + ':complemento' ⇒ 1−p); valor sem probKey (ex.: 'indiferente') → fator 1.
 *  - multi: todas as opções marcadas (ou nenhuma) → 1; senão soma das probabilidades
 *    marcadas, renormalizada pela soma das resolvíveis (nunca multiplica dentro do bloco).
 *  - eixos conjuntos do modelo: multi com rateKey rendaPorIdade × escolaridadePorIdade
 *    aplica a matriz TAXAS.rendaEduBase UMA vez, inclinada por rendaIdx/educIdx da RA
 *    e renormalizada; multi estadoCivilPorIdade × tri-state filhosPorIdade aplica a
 *    matriz conjunta TAXAS.estadoCivilFilhos (condicional × margem). Qualquer outro
 *    par de filtros com o mesmo rateKey é tratado como independente (premissa
 *    documentada em TAXAS.meta.nota).
 *  - range sem handler por id: se o bloco rateKey tiver {mu,sd} → massa Φ por sexo;
 *    senão ignora com console.warn.
 */
(function () {
  'use strict';

  var W = typeof window !== 'undefined' ? window : this;

  // ---------- utilitários ----------

  function num(x) { return typeof x === 'number' && isFinite(x); }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function rel(a, b) {
    var d = Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1);
    return d < 1e-15 ? 0 : d;
  }

  function idxWhere(list, fn) {
    for (var i = 0; i < list.length; i++) if (fn(list[i], i)) return i;
    return -1;
  }

  var warned = {};
  function warn(msg) {
    if (warned[msg]) return;
    warned[msg] = 1;
    if (W.console && W.console.warn) W.console.warn('[Engine] ' + msg);
  }

  function deepCopy(v) {
    if (Array.isArray(v)) { var a = v.slice(); for (var i = 0; i < a.length; i++) a[i] = deepCopy(a[i]); return a; }
    if (v && typeof v === 'object') { var o = {}, k; for (k in v) if (Object.prototype.hasOwnProperty.call(v, k)) o[k] = deepCopy(v[k]); return o; }
    return v;
  }

  // Φ (cdf da normal padrão) — Abramowitz & Stegun 26.2.17, |erro| < 7,5e-8.
  function bphi(x) { return 0.3989422804014327 * Math.exp(-0.5 * x * x); }
  function bPhi(x) {
    if (!(x > -40)) return 0; // inclui NaN
    if (x > 40) return 1;
    var z = Math.abs(x) / Math.SQRT2;
    var t = 1 / (1 + 0.5 * z);
    var y = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
      t * (-0.18629528 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
      t * (-0.82215223 + t * 0.17087277)))))))));
    var c = x >= 0 ? 1 - 0.5 * y : 0.5 * y;
    return clamp(c, 0, 1);
  }

  // ---------- estrutura de configuração ----------

  var STRUCT_KEYS = { generoUsuario: 1, generoBuscado: 1, orientacaoAlvo: 1 };
  // auto: pool compatível = hetero se busca sexo oposto, homo se busca o mesmo; bi sempre entra.
  // "ambos" = união dos dois pools sem dupla contagem de bi (cada sexo-alvo conta sua própria fatia).
  var ORIENT_AUTO_KEYS = {
    M: { M: ['homo', 'bi'], F: ['hetero', 'bi'], ambos: ['hetero', 'bi'] },
    F: { M: ['hetero', 'bi'], F: ['homo', 'bi'], ambos: ['hetero', 'bi'] }
  };
  // eixos conjuntos do modelo (convenção estrutural sobre rateKeys de taxas, não ids de filtro)
  var RENDA_EDU_KEYS = { renda: 'rendaPorIdade', edu: 'escolaridadePorIdade', matriz: 'rendaEduBase' };
  var CIVIL_FILHOS_KEYS = { civil: 'estadoCivilPorIdade', filhos: 'filhosPorIdade', matriz: 'estadoCivilFilhos' };
  var JOINT_RATE_KEYS = { rendaPorIdade: 1, escolaridadePorIdade: 1, estadoCivilPorIdade: 1, filhosPorIdade: 1 };

  function cfgGet(id) {
    var i = idxWhere(W.FILTERS_CONFIG || [], function (f) { return f.id === id; });
    return i < 0 ? null : W.FILTERS_CONFIG[i];
  }

  function normalizeState(state) {
    var out = {}, cfg = W.FILTERS_CONFIG || [], i;
    for (i = 0; i < cfg.length; i++) out[cfg[i].id] = deepCopy(cfg[i].defaultValue);
    if (state) for (var k in state) if (Object.prototype.hasOwnProperty.call(state, k) && k in out) out[k] = deepCopy(state[k]);
    var ap = cfgGet('aparencia');
    if (ap) {
      var nota = (ap.notaMinima && num(ap.notaMinima.valor)) ? ap.notaMinima.valor : 6;
      var v = out.aparencia;
      if (typeof v === 'boolean') out.aparencia = { ativo: v, notaMinima: nota };
      else if (v && typeof v === 'object') out.aparencia = { ativo: !!v.ativo, notaMinima: num(v.notaMinima) ? v.notaMinima : nota };
      else out.aparencia = { ativo: false, notaMinima: nota };
    }
    var gcfg = cfgGet('generoBuscado');
    var valores = gcfg ? (gcfg.options || []).map(function (o) { return o.value; }) : ['M', 'F', 'ambos'];
    if (valores.indexOf(out.generoBuscado) < 0) {
      warn('generoBuscado "' + out.generoBuscado + '" desconhecido; usando ' + (gcfg ? gcfg.defaultValue : 'ambos'));
      out.generoBuscado = gcfg ? gcfg.defaultValue : 'ambos';
    }
    return out;
  }

  // ---------- tabelas derivadas com cache ----------

  var _cache = { sig: null, faixas: null, faixaBounds: null, listasIds: null, celulas: null, idxOfIdade: null, fIdxDeIdade: null, juntaRD: [] };

  function faixasList() {
    if (_cache.faixas) return _cache.faixas;
    var f = W.TAXAS.faixasIdade, bounds = [];
    for (var i = 0; i < f.length; i++) {
      var parts = String(f[i]).split('-');
      bounds.push([i ? bounds[i - 1][1] : +parts[0], parts[1] ? +parts[1] : Infinity]);
    }
    _cache.faixas = f; _cache.faixaBounds = bounds;
    return f;
  }
  function faixaIndexOf(idade) {
    faixasList();
    for (var i = 0; i < _cache.faixaBounds.length; i++) if (idade >= _cache.faixaBounds[i][0] && idade <= _cache.faixaBounds[i][1]) return i;
    return _cache.faixaBounds.length - 1;
  }
  function faixaOf(idade) { return faixasList()[faixaIndexOf(idade)]; }

  function colListas() {
    if (!_cache.listasIds) {
      _cache.listasIds = {};
      for (var k in W.TAXAS) if (/Faixas$/.test(k) && Array.isArray(W.TAXAS[k])) _cache.listasIds[k] = W.TAXAS[k];
    }
    return _cache.listasIds;
  }
  function listaComId(id) {
    var maps = colListas(), keys = Object.keys(maps);
    for (var i = 0; i < keys.length; i++) {
      var arr = maps[keys[i]];
      if (idxWhere(arr, function (e) { return e && e.id === id; }) >= 0) return arr;
    }
    return null;
  }

  // resolve "bloco:col" na linha da faixa — ver resolveOption (caminho unificado).

  // resolve um probKey → número (ou null). Convenções: {sexo}, {faixa}, ":complemento",
  // ":" e "." são passos equivalentes; se o segmento não existe no bloco e o bloco tem
  // a faixa etária corrente como chave, desce na linha da faixa e o segmento vira coluna
  // (índice numérico ou id de TAXAS.*Faixas).
  function colVal(arr, seg) {
    var v;
    if (/^\d+$/.test(seg)) v = arr[+seg];
    else { var lst = listaComId(seg); v = lst ? arr[idxWhere(lst, function (e) { return e.id === seg; })] : undefined; }
    return num(v) ? v : null;
  }

  function resolveOption(raw, sexo, faixa) {
    if (raw == null) return null;
    var key = String(raw);
    key = key.split('{sexo}').join(sexo == null ? '' : sexo);
    var comp = false;
    if (/:complemento$/.test(key)) { comp = true; key = key.slice(0, -12); }
    key = key.split('{faixa}').join(faixa == null ? '' : faixa);
    var segs = key.split(/[.:]+/).filter(function (x) { return x !== ''; });
    var cur = W.TAXAS, descida = false;
    for (var i = 0; i < segs.length && cur != null; i++) {
      var seg = segs[i];
      if (Array.isArray(cur)) { cur = colVal(cur, seg); continue; }
      if (typeof cur !== 'object') { cur = null; break; }
      if (Object.prototype.hasOwnProperty.call(cur, seg)) { cur = cur[seg]; continue; }
      if (!descida && faixa && Object.prototype.hasOwnProperty.call(cur, faixa)) {
        descida = true; cur = cur[faixa]; i--; continue;
      }
      cur = null;
    }
    if (!num(cur)) { warn('probKey não resolvido: ' + raw); return null; }
    return comp ? 1 - cur : cur;
  }

  // ---------- células RA × idade × sexo (pré-computadas) ----------

  function celulas() {
    if (_cache.celulas) return _cache.celulas;
    var P = W.DATA_POPULACAO, R = W.DATA_RAS, arr = [];
    var idades = [], homens = [], mulheres = [], i, j;
    for (i = 0; i < P.idades.length; i++) {
      var d = P.idades[i];
      idades.push(d.idade); homens.push(d.homens); mulheres.push(d.mulheres);
    }
    var pesos = R.lista.map(function (ra) { return ra.peso / 100; });
    _cache.idxOfIdade = {}; _cache.fIdxDeIdade = [];
    for (i = 0; i < idades.length; i++) { _cache.idxOfIdade[idades[i]] = i; _cache.fIdxDeIdade.push(faixaIndexOf(idades[i])); }
    for (i = 0; i < R.lista.length; i++) {
      for (j = 0; j < idades.length; j++) {
        arr.push({ ra: i, idade: idades[j], sexo: 'M', n: homens[j] * P.fator * pesos[i] });
        arr.push({ ra: i, idade: idades[j], sexo: 'F', n: mulheres[j] * P.fator * pesos[i] });
      }
    }
    _cache.celulas = arr; _cache.idades = idades; _cache.homens = homens; _cache.mulheres = mulheres;
    return arr;
  }

  // junta renda(6)×escolaridade(5) por faixa, inclinada por rendaIdx/educIdx da RA e renormalizada (soma 1).
  // Linhas na ordem de TAXAS.rendaFaixas, colunas na ordem de TAXAS.escolaridadeFaixas.
  function juntaRD(fIdx) {
    if (_cache.juntaRD[fIdx]) return _cache.juntaRD[fIdx];
    var base = W.TAXAS[RENDA_EDU_KEYS.matriz] && W.TAXAS[RENDA_EDU_KEYS.matriz][faixasList()[fIdx]];
    if (!Array.isArray(base)) return null;
    var R = W.DATA_RAS.lista, out = [];
    for (var ri = 0; ri < R.length; ri++) {
      var rIdx = R[ri].rendaIdx, eIdx = R[ri].educIdx, s = 0;
      var mat = base.map(function (row) {
        return row.map(function (v) { var t = v * rIdx * eIdx; s += t; return t; });
      });
      if (s > 0) mat = mat.map(function (row) { return row.map(function (v) { return v / s; }); });
      out.push(mat);
    }
    _cache.juntaRD[fIdx] = out;
    return out;
  }

  // ---------- handlers por tipo (genéricos; não leem id, exceto range) ----------

  function handlerMulti(cfg, val) {
    var marked = Array.isArray(val) ? val : (val != null ? [val] : []);
    var opts = cfg.options || [];
    if (!opts.length) { warn('multi ' + cfg.id + ': sem opções; ignorado'); return null; }
    if (opts.every(function (o) { return marked.indexOf(o.value) >= 0; })) return null; // indiferente
    var withPk = opts.filter(function (o) { return o.probKey != null; });
    if (!withPk.length) { warn('multi ' + cfg.id + ': opções sem probKey; ignorado'); return null; }
    if (!marked.length) return { kind: 'multi', rateKey: cfg.rateKey, markedOpts: [], allOpts: withPk, zero: true };
    var markedOpts = opts.filter(function (o) { return marked.indexOf(o.value) >= 0 && o.probKey != null; });
    if (!markedOpts.length) { warn('multi ' + cfg.id + ': nenhuma opção reconhecida; ignorado'); return null; }
    return { kind: 'multi', rateKey: cfg.rateKey, markedOpts: markedOpts, allOpts: withPk, zero: false };
  }

  function handlerTri(cfg, val) {
    var opts = cfg.options || [];
    if (val == null) return null;
    var o = opts.filter(function (x) { return x.value === val; })[0];
    if (!o) { warn('tri-state ' + cfg.id + ': valor "' + val + '" desconhecido; indiferente'); return null; }
    if (o.probKey == null) return null; // 'indiferente' e equivalentes
    var sim = opts.filter(function (x) { return x.value === 'sim'; })[0];
    if (!sim) sim = opts[0];
    return { kind: 'tri', rateKey: cfg.rateKey, value: val, opt: o, basePk: sim ? sim.probKey : null };
  }

  function handlerToggle(cfg, val) {
    var ativo = typeof val === 'boolean' ? val : !!(val && val.ativo);
    if (!ativo) return null;
    return { kind: 'toggle', cfg: cfg, val: val };
  }

  function handlerSelect(cfg) {
    warn('select não-estrutural sem handler: ' + cfg.id + ' (ignorado)');
    return null;
  }

  // handlers de range por id (eixos numéricos estruturais do produto)
  var RANGE_HANDLERS = {
    idade: function () { return { kind: 'structural' }; },
    altura: function (cfg, val) { return { kind: 'altura', cfg: cfg, lo: val[0], hi: val[1] }; }
  };

  function handlerRange(cfg, val) {
    if (!Array.isArray(val) || !num(val[0]) || !num(val[1])) return null;
    var v = val[0] <= val[1] ? val : [val[1], val[0]];
    var h = RANGE_HANDLERS[cfg.id];
    if (h) return h(cfg, v);
    var blk = cfg.rateKey ? W.TAXAS[cfg.rateKey] : null;
    if (blk && num(blk.mu) && num(blk.sd) && blk.sd > 0) {
      return { kind: 'rangePhi', cfg: cfg, lo: v[0], hi: v[1] };
    }
    warn('range sem handler para id "' + cfg.id + '": ignorado');
    return null;
  }

  var TYPE_HANDLERS = {
    'multi': handlerMulti,
    'tri-state': handlerTri,
    'toggle': handlerToggle,
    'select': handlerSelect,
    'range': handlerRange
  };

  // ---------- fatores ----------

  function optsSum(d, sexo, faixa) {
    if (d.zero) return 0;
    var sum = 0, tot = 0, i, p;
    for (i = 0; i < d.allOpts.length; i++) { p = resolveOption(d.allOpts[i].probKey, sexo, faixa); if (p != null) tot += p; }
    for (i = 0; i < d.markedOpts.length; i++) { p = resolveOption(d.markedOpts[i].probKey, sexo, faixa); if (p != null) sum += p; }
    return clamp(tot > 0 ? sum / tot : sum, 0, 1);
  }

  function alturaFator(cfg, lo, hi, sexo) {
    var pp = W.TAXAS[cfg.rateKey] && W.TAXAS[cfg.rateKey][sexo];
    if (!pp || !num(pp.mu) || !num(pp.sd) || pp.sd <= 0) return 1;
    var supLo = num(pp.min) ? pp.min : pp.mu - 3 * pp.sd;
    var supHi = num(pp.max) ? pp.max : pp.mu + 3 * pp.sd;
    var a = clamp((Math.max(lo, supLo) - pp.mu) / pp.sd, -8, 8);
    var b = clamp((Math.min(hi, supHi) - pp.mu) / pp.sd, -8, 8);
    var w = bPhi(b) - bPhi(a);
    if (w <= 0) return 0;
    var ww = bPhi((supHi - pp.mu) / pp.sd) - bPhi((supLo - pp.mu) / pp.sd);
    return ww > 0 ? clamp(w / ww, 0, 1) : 0;
  }

  // fallback genérico p/ range cujo rateKey tem {mu,sd} (global ou por sexo): massa Φ pura
  function rangePhiFator(cfg, lo, hi) {
    return function (sexo) {
      var b = W.TAXAS[cfg.rateKey];
      if (!b) return 1;
      var pp = (b[sexo] && num(b[sexo].mu) && num(b[sexo].sd) && b[sexo].sd > 0) ? b[sexo] : b;
      if (!num(pp.mu) || !num(pp.sd) || pp.sd <= 0) return 1;
      return clamp(bPhi((hi - pp.mu) / pp.sd) - bPhi((lo - pp.mu) / pp.sd), 0, 1);
    };
  }

  function appearanceFactor(cfg, val) {
    var t = W.TAXAS[cfg.rateKey];
    if (!t || !num(t.mu) || !num(t.sd) || t.sd <= 0) { warn('toggle ' + cfg.id + ': bloco rateKey sem mu/sd; ignorado'); return 1; }
    var lo = num(t.min) ? t.min : t.mu - 3 * t.sd;
    var hi = num(t.max) ? t.max : t.mu + 3 * t.sd;
    var nota = (val && typeof val === 'object' && num(val.notaMinima)) ? val.notaMinima
      : (cfg.notaMinima && num(cfg.notaMinima.valor) ? cfg.notaMinima.valor : 6);
    if (nota <= lo) return 1;
    if (nota > hi) return 0;
    var Wt = bPhi((hi - t.mu) / t.sd) - bPhi((lo - t.mu) / t.sd);
    if (!(Wt > 0)) return 0;
    return clamp((1 - bPhi((nota - t.mu) / t.sd)) / Wt, 0, 1); // normal truncada [lo,hi] renormalizada
  }

  function civilFilhoProb(faixa, civilIds, filhoCol, fallbackId) {
    var T = W.TAXAS;
    var marg = T[CIVIL_FILHOS_KEYS.civil] && T[CIVIL_FILHOS_KEYS.civil][faixa];
    var cond = T[CIVIL_FILHOS_KEYS.matriz] && T[CIVIL_FILHOS_KEYS.matriz][faixa];
    var lst = listaComId(civilIds.length ? civilIds[0] : fallbackId);
    if (!Array.isArray(marg) || !Array.isArray(cond) || !lst) return null;
    var col = filhoCol === 'nao' ? 0 : 1, q = 0, tm = 0;
    for (var i = 0; i < lst.length && i < marg.length; i++) {
      if (!num(marg[i])) continue;
      tm += marg[i];
      if (civilIds.indexOf(lst[i].id) >= 0) q += marg[i] * (num(cond[i] && cond[i][col]) ? cond[i][col] : 0);
    }
    return tm > 0 ? clamp(q / tm, 0, 1) : clamp(q, 0, 1);
  }

  // matriz fator[sexo][fIdx] — tudo que independe da RA
  function matrizFatores(dyns, civilDesc, filhosDesc, alturas) {
    var faixas = faixasList(), out = { M: [], F: [] };
    ['M', 'F'].forEach(function (s) {
      for (var fIdx = 0; fIdx < faixas.length; fIdx++) {
        var faixa = faixas[fIdx], p = 1, i, v;
        for (i = 0; i < dyns.length; i++) {
          v = dyns[i].f(s, faixa);
          if (!num(v)) continue;
          if (v <= 0) { p = 0; break; }
          p *= v > 1 ? 1 : v;
        }
        if (p > 0) {
          for (i = 0; i < alturas.length; i++) { p *= alturaFator(alturas[i].cfg, alturas[i].lo, alturas[i].hi, s); if (p <= 0) { p = 0; break; } }
        }
        if (p > 0 && (civilDesc || filhosDesc)) {
          if (civilDesc && filhosDesc) {
            v = civilFilhoProb(faixa, civilDesc.ids, filhosDesc.value, (civilDesc.d.allOpts[0] || {}).value);
          } else if (civilDesc) {
            v = optsSum(civilDesc.d, s, faixa);
          } else {
            var pf = resolveOption(filhosDesc.basePk, s, faixa);
            v = num(pf) ? clamp(filhosDesc.value === 'nao' ? 1 - pf : pf, 0, 1) : 1;
          }
          p *= num(v) ? v : 1;
        }
        out[s][fIdx] = p < 0 ? 0 : p;
      }
    });
    return out;
  }

  // ---------- calcular ----------

  function calcular(state) {
    var P = W.DATA_POPULACAO, R = W.DATA_RAS, T = W.TAXAS, CFG = W.FILTERS_CONFIG || [];
    var sig = CFG.length + '|' + Object.keys(T).length + '|' + P.idades.length + '|' +
      P.idades[P.idades.length - 1].homens + '|' + R.lista.length + '|' + R.lista[0].populacao;
    if (_cache.sig !== sig) {
      _cache = { sig: sig, faixas: null, faixaBounds: null, listasIds: null, celulas: null, idxOfIdade: null, fIdxDeIdade: null, juntaRD: [] };
    }
    celulas(); // barato; rebuild só quando a assinatura dos dados muda

    var s = normalizeState(state);
    var gu = s.generoUsuario === 'F' ? 'F' : 'M';
    var gb = s.generoBuscado;
    var alvos = gb === 'ambos' ? ['M', 'F'] : [gb];
    var alvosMap = { M: alvos.indexOf('M') >= 0, F: alvos.indexOf('F') >= 0 };

    // --- orientação (eixo estrutural) ---
    var orient = { M: 1, F: 1 };
    var ov = s.orientacaoAlvo;
    var ocfg = cfgGet('orientacaoAlvo') || { multiOptions: [] };
    var mo = ocfg.multiOptions || [];
    if (Array.isArray(ov)) {
      var markedOpts = mo.filter(function (o) { return ov.indexOf(o.value) >= 0 && o.probKey != null; });
      if (!markedOpts.length) { if (ov.length) warn('orientação manual: nenhuma opção válida marcada'); orient.M = 0; orient.F = 0; }
      else {
        alvos.forEach(function (a) {
          var t = 0;
          for (var k = 0; k < markedOpts.length; k++) { var v = resolveOption(markedOpts[k].probKey, a, null); if (v != null) t += v; }
          orient[a] = clamp(t, 0, 1);
        });
      }
    } else if (ov !== 'manual') { // 'auto' (default)
      alvos.forEach(function (a) {
        var keys = (ORIENT_AUTO_KEYS[gu] || ORIENT_AUTO_KEYS.M)[a] || [];
        var t = 0;
        for (var k2 = 0; k2 < keys.length; k2++) { var v2 = T.orientacao.porSexo[a] && T.orientacao.porSexo[a][keys[k2]]; if (num(v2)) t += v2; }
        orient[a] = clamp(t, 0, 1);
      });
    }

    // --- range de idade (eixo estrutural) ---
    var idadeCfg = cfgGet('idade') || { min: 18, max: 80 };
    var iv = Array.isArray(s.idade) && num(s.idade[0]) && num(s.idade[1]) ? s.idade : [idadeCfg.min, idadeCfg.max];
    var iLo = Math.min(iv[0], iv[1]), iHi = Math.max(iv[0], iv[1]);

    // --- demais filtros: dispatch genérico type→handler ---
    var dyns = [], alturas = [], rendaDesc = null, eduDesc = null, civilDesc = null, filhosDesc = null;
    for (var ci = 0; ci < CFG.length; ci++) {
      var cfg = CFG[ci];
      if (STRUCT_KEYS[cfg.id]) continue;
      var th = TYPE_HANDLERS[cfg.type];
      if (!th) { warn('type sem handler: ' + cfg.id + ' (' + cfg.type + ')'); continue; }
      var d = th(cfg, s[cfg.id]);
      if (!d) continue;
      if (d.kind === 'structural') continue; // idade
      if (d.kind === 'altura') { alturas.push(d); continue; }
      if (d.kind === 'rangePhi') {
        dyns.push({ f: rangePhiFator(cfg, d.lo, d.hi) });
        continue;
      }
      if (d.kind === 'toggle') {
        var ap = appearanceFactor(cfg, d.val);
        if (ap !== 1) dyns.push({ f: function (p) { return function () { return p; }; }(ap) });
        continue;
      }
      if (d.kind === 'multi') {
        var ids = d.markedOpts.map(function (o) { return o.value; });
        if (cfg.rateKey === RENDA_EDU_KEYS.renda) { rendaDesc = { ids: ids, d: d }; continue; }
        if (cfg.rateKey === RENDA_EDU_KEYS.edu) { eduDesc = { ids: ids, d: d }; continue; }
        if (cfg.rateKey === CIVIL_FILHOS_KEYS.civil) { civilDesc = { ids: ids, d: d }; continue; }
        dyns.push({ f: function (dd) { return function (sexo, faixa) { return optsSum(dd, sexo, faixa); }; }(d) });
        continue;
      }
      if (d.kind === 'tri') {
        if (cfg.rateKey === CIVIL_FILHOS_KEYS.filhos) { filhosDesc = { value: d.value, basePk: d.basePk }; continue; }
        var pk = d.opt.probKey;
        dyns.push({ f: function (p) { return function (sexo, faixa) { var v = resolveOption(p, sexo, faixa); return v == null ? 1 : clamp(v, 0, 1); }; }(pk) });
        continue;
      }
    }

    // --- junta renda × escolaridade (aplica UMA vez) ---
    var juntaAtiva = !!(rendaDesc && eduDesc);
    var riT = null, eiT = null;
    if (juntaAtiva) {
      riT = []; eiT = [];
      var lstR = T.rendaFaixas, lstE = T.escolaridadeFaixas;
      var rr, ee;
      for (rr = 0; rr < lstR.length; rr++) if (rendaDesc.ids.indexOf(lstR[rr].id) >= 0) riT.push(rr);
      for (ee = 0; ee < lstE.length; ee++) if (eduDesc.ids.indexOf(lstE[ee].id) >= 0) eiT.push(ee);
    } else {
      if (rendaDesc) dyns.push({ f: function (dd) { return function (sexo, faixa) { return optsSum(dd, sexo, faixa); }; }(rendaDesc.d) });
      if (eduDesc) dyns.push({ f: function (dd) { return function (sexo, faixa) { return optsSum(dd, sexo, faixa); }; }(eduDesc.d) });
    }

    var F2 = matrizFatores(dyns, civilDesc, filhosDesc, alturas);

    // cache do fator da junta por (ra,fIdx)
    var rdMemo = {};
    function factorRD(raIdx, fIdx) {
      var key = raIdx + '/' + fIdx, m = rdMemo[key];
      if (m != null) return m;
      var junta = juntaRD(fIdx);
      if (!junta) { rdMemo[key] = 1; return 1; }
      var mat = junta[raIdx], q = 0, a, b;
      for (a = 0; a < riT.length; a++) for (b = 0; b < eiT.length; b++) q += mat[riT[a]][eiT[b]];
      m = clamp(q, 0, 1);
      rdMemo[key] = m;
      return m;
    }

    // --- laço principal ---
    var cells = _cache.celulas;
    var nIdades = _cache.idades.length;
    var perRA = [], perIdade = [], j3;
    for (j3 = 0; j3 < R.lista.length; j3++) perRA.push(0);
    for (j3 = 0; j3 < nIdades; j3++) perIdade.push(0);
    var porGenero = { M: 0, F: 0 }, total = 0;
    for (var i2 = 0; i2 < cells.length; i2++) {
      var c = cells[i2];
      if (c.idade < iLo || c.idade > iHi) continue;
      if (!alvosMap[c.sexo]) continue;
      var di = _cache.idxOfIdade[c.idade];
      var fIdx = _cache.fIdxDeIdade[di];
      var fac = F2[c.sexo][fIdx] * orient[c.sexo];
      if (juntaAtiva) fac *= factorRD(c.ra, fIdx);
      var v = c.n * fac;
      if (v > 0) {
        total += v;
        perRA[c.ra] += v;
        perIdade[di] += v;
        porGenero[c.sexo] += v;
      }
    }

    // --- referência: base adulta e denominador (18+, gêneros buscados, orientação compatível, sem outros filtros) ---
    var baseAdulta = 0, denom = 0, fator = P.fator;
    for (j3 = 0; j3 < nIdades; j3++) {
      if (_cache.idades[j3] < 18) continue;
      baseAdulta += (_cache.homens[j3] + _cache.mulheres[j3]) * fator;
      if (alvosMap.M) denom += _cache.homens[j3] * fator * orient.M;
      if (alvosMap.F) denom += _cache.mulheres[j3] * fator * orient.F;
    }

    var porRA = R.lista.map(function (ra, idx) {
      return { id: ra.id, nome: ra.nome, populacao: ra.populacao, peso: ra.peso, candidatos: perRA[idx], pct: total > 0 ? (perRA[idx] / total) * 100 : 0 };
    });
    var somaPorRA = perRA.reduce(function (a, b) { return a + b; }, 0);
    if (rel(somaPorRA, total) > 1e-9) warn('porRA (soma=' + somaPorRA + ') diverge do total (' + total + ')');

    var porIdade = [];
    var idadesArr = _cache.idades;
    for (j3 = 0; j3 < nIdades; j3++) {
      if (idadesArr[j3] < iLo || idadesArr[j3] > iHi) continue;
      if (perIdade[j3] > 0 || alvosMap.M || alvosMap.F) porIdade.push({ idade: idadesArr[j3], total: perIdade[j3] });
    }

    return {
      total: total,
      porRA: porRA,
      porIdade: porIdade,
      porGenero: porGenero,
      base: baseAdulta,
      denominador: denom,
      umEmCada: total > 0 ? denom / total : Infinity
    };
  }

  W.Engine = {
    calcular: function (state) { return calcular(state); },
    celulas: function () { return celulas(); },
    phi: bPhi,
    normalizeState: normalizeState,
    limites: {
      get idadeMin() { var f = cfgGet('idade'); return f && num(f.min) ? f.min : 18; },
      get idadeMax() { var f = cfgGet('idade'); return f && num(f.max) ? f.max : 80; },
      get faixas() { return faixasList().slice(); },
      faixaDe: function (idade) { return faixaOf(idade); }
    }
  };
})();
