/**
 * incerteza.js — Amostragem de Monte Carlo da incerteza das taxas (Beta/Dirichlet/Normal).
 * Puro: só depende de window.Engine / window.TAXAS / window.DATA_RAS. Sem DOM, sem fetch, sem módulo.
 * API: window.Incerteza = { amostrar(state, n), resumo(state, n) }
 *
 * Garantias:
 *  - PRNG determinístico (mulberry32, seed 20261118): mesmo state + n ⇒ mesmos números, sempre
 *    (cada chamada de amostragem re-semeia; travessia de chaves em ordem estável via Object.keys).
 *  - window.TAXAS NUNCA é mutado: deep clone é perturbado, atribuído em window.TAXAS durante o
 *    laço, e o original é restaurado em `finally`.
 *  - Engine.calcular cacheia tabelas derivadas por assinatura que NÃO cobre valores de TAXAS;
 *    um sentinela temporário em DATA_RAS.lista[0].populacao (campo de exibição, não usado no
 *    cálculo do total) é avançado a cada draw, forçando reconstrução do cache (ex.: juntaRD,
 *    derivada de rendaEduBase) com as taxas daquele draw. O sentinela é restaurado no `finally`.
 *
 * Perturbações (regras do plano):
 *  - {p,min,max} numéricos, p∈(0,1): Beta com média p, σ=(max−min)/4, κ=μ(1−μ)/σ²−1 clampado
 *    em [2,1000], α=μκ, β=(1−μ)κ; Gamma por Marsaglia-Tsang (chod).
 *  - vetores de probabilidades com confiança A/B/C no bloco pai (rendaPorIdade,
 *    escolaridadePorIdade, estadoCivilPorIdade, matrizes…): ruído Dirichlet suave
 *    (multiplicativo log-normal renormalizado, preserva soma 1); σ: A=0,05 / B=0,10 / C=0,20.
 *    Vetor = array (>=2 números ∈ [0,1]) OU objeto com >=2 valores numéricos em (0,1) que
 *    somam entre 0,98 e 1,02 (orientacao.porSexo.M/F, religiaoDF). Chaves de metadados
 *    (fonte, fonteId, nota, confianca, meta, hierarquia) nunca são perturbadas.
 *  - blocos {mu,sd} numéricos (altura.M/F, aparencia): Normal(0, 0,5) somado a mu (erro de
 *    medida); sd intacto.
 */
(function () {
  'use strict';

  var W = typeof window !== 'undefined' ? window : this;

  var SEED = 20261118;
  var N_DEFAULT = 2000, N_MIN = 20, N_MAX = 20000;
  var SIGMA_CONF = { A: 0.05, B: 0.10, C: 0.20 };

  // ---------- PRNG ----------

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

  // Box-Muller com espiga guardada por gerador (determinístico: a sequência só depende da semente).
  function randNormal(rng, estado) {
    if (estado.spare !== null) { var v = estado.spare; estado.spare = null; return v; }
    var u = 0, s = 0, x, y;
    do {
      x = 2 * rng() - 1; y = 2 * rng() - 1; s = x * x + y * y;
    } while (s >= 1 || s === 0);
    var m = Math.sqrt(-2 * Math.log(s) / s);
    estado.spare = y * m;
    return x * m;
  }

  // Gamma(shape<1,1): Marsaglia-Tsang chod.
  function gammaSmall(rng, estado, a) {
    var u = rng();
    return gamma(rng, estado, a + 1) * Math.pow(u, 1 / a);
  }

  // Gamma(a>0, escala 1): Marsaglia-Tsang (2000).
  function gamma(rng, estado, a) {
    if (a < 1) return gammaSmall(rng, estado, a);
    var d = a - 1 / 3, c = 1 / Math.sqrt(9 * d), x, v, u;
    for (;;) {
      do { x = randNormal(rng, estado); v = 1 + c * x; } while (v <= 0);
      v = v * v * v;
      u = rng();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }

  function beta(rng, estado, a, b) {
    var x = gamma(rng, estado, a), y = gamma(rng, estado, b);
    return x / (x + y);
  }

  // ---------- utilitários ----------

  function num(x) { return typeof x === 'number' && isFinite(x); }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  // chaves de metadados: nunca perturbadas (fonte cobre fonteId)
  var META_RE = /^(fonte|nota|confianca|meta|hierarquia)/;

  function deepCopy(v) {
    if (Array.isArray(v)) { var a = v.slice(); for (var i = 0; i < a.length; i++) a[i] = deepCopy(a[i]); return a; }
    if (v && typeof v === 'object') { var o = {}, k; for (k in v) if (Object.prototype.hasOwnProperty.call(v, k)) o[k] = deepCopy(v[k]); return o; }
    return v;
  }

  // linha de probabilidades: array com >=2 números ∈ [0,1] (pelo menos um > 0)
  function linhaProb(x) {
    if (!Array.isArray(x) || x.length < 2) return false;
    var algum = false;
    for (var i = 0; i < x.length; i++) {
      if (!num(x[i]) || x[i] < 0 || x[i] > 1) return false;
      if (x[i] > 0) algum = true;
    }
    return algum;
  }

  // objeto-vetor de probabilidades: >=2 valores numéricos em (0,1) (e nenhum número fora
  // de (0,1)) somando entre 0,98 e 1,02. Retorna as chaves elegíveis ou null.
  // Cobre orientacao.porSexo.M/F, religiaoDF e qualquer bloco no formato; ignora metadados.
  function vetorProbObj(x) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
    var chaves = [], soma = 0, keys = Object.keys(x), i, k, v;
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      if (META_RE.test(k)) continue;
      v = x[k];
      if (!num(v)) continue;
      if (!(v > 0 && v < 1)) return null;
      chaves.push(k); soma += v;
    }
    if (chaves.length < 2 || soma < 0.98 || soma > 1.02) return null;
    return chaves;
  }

  function sigmaDe(conf) {
    return SIGMA_CONF[typeof conf === 'string' ? conf.charAt(0).toUpperCase() : ''] || 0;
  }

  // ---------- perturbações ----------

  function perturbarP(obj, rng, estado) {
    var mu = obj.p, s = (obj.max - obj.min) / 4;
    var k = (s > 0 && isFinite(s)) ? clamp(mu * (1 - mu) / (s * s) - 1, 2, 1000) : 1000;
    var alpha = Math.max(mu * k, 1e-6), betaP = Math.max((1 - mu) * k, 1e-6);
    obj.p = clamp(beta(rng, estado, alpha, betaP), 1e-9, 1 - 1e-9);
  }

  function perturbarMuSD(obj, rng, estado) {
    obj.mu = obj.mu + randNormal(rng, estado) * 0.5; // erro de medida; sd preservado
  }

  // ruído Dirichlet suave: multiplicativo log-normal(0,σ) renormalizado ⇒ soma 1 preservada
  function ruidoDirichlet(vals, sigma, rng, estado) {
    var out = [], soma = 0, i, v;
    for (i = 0; i < vals.length; i++) {
      v = vals[i] * Math.exp(sigma * randNormal(rng, estado));
      if (!(v > 0)) v = 1e-6;
      out.push(v); soma += v;
    }
    if (!(soma > 0)) return vals.slice();
    for (i = 0; i < out.length; i++) out[i] = out[i] / soma;
    return out;
  }

  function perturbarLinha(arr, sigma, rng, estado) {
    if (!(sigma > 0)) return;
    var novo = ruidoDirichlet(arr, sigma, rng, estado);
    for (var i = 0; i < arr.length; i++) arr[i] = novo[i];
  }

  function perturbarVetorObj(no, chaves, sigma, rng, estado) {
    if (!(sigma > 0)) return;
    var vals = [], i;
    for (i = 0; i < chaves.length; i++) vals.push(no[chaves[i]]);
    var novo = ruidoDirichlet(vals, sigma, rng, estado);
    for (i = 0; i < chaves.length; i++) no[chaves[i]] = novo[i];
  }

  // travessia genérica do clone: p/min/max → Beta; mu/sd → Normal em mu; vetores → Dirichlet suave
  function percorrer(no, conf, rng, estado) {
    if (Array.isArray(no)) {
      if (linhaProb(no)) perturbarLinha(no, sigmaDe(conf), rng, estado);
      return;
    }
    if (!no || typeof no !== 'object') return;
    var confHerda = typeof no.confianca === 'string' ? no.confianca : conf;
    var chaves = Object.keys(no), i, k, v;
    var vet = vetorProbObj(no);
    if (vet) perturbarVetorObj(no, vet, sigmaDe(confHerda), rng, estado); // ex.: porSexo.M/F, religiaoDF
    for (i = 0; i < chaves.length; i++) {
      k = chaves[i];
      if (META_RE.test(k)) continue;
      v = no[k];
      if (num(v.p) && num(v.min) && num(v.max) && v.p > 0 && v.p < 1) { perturbarP(v, rng, estado); continue; }
      if (num(v.mu) && num(v.sd) && v.sd > 0) { perturbarMuSD(v, rng, estado); continue; }
      percorrer(v, confHerda, rng, estado);
    }
  }

  // clone de TAXAS totalmente perturbado (não toca no original)
  function taxaPerturbada(rngBase, base) {
    var clone = deepCopy(base || W.TAXAS);
    var estado = { spare: null };
    percorrer(clone, null, mulberry32((rngBase >>> 0) * 2 + 7), estado);
    return clone;
  }

  // ---------- API ----------

  function nEfetivo(n) {
    var v = num(n) ? Math.round(n) : N_DEFAULT;
    return clamp(v, N_MIN, N_MAX);
  }

  // n draws → [{ total, porRA: [{id, candidatos}] }]
  function amostrar(state, n) {
    var out = [];
    if (!W.Engine || typeof W.Engine.calcular !== 'function' || !W.TAXAS) return out;
    var R = W.DATA_RAS;
    var taxasOrig = W.TAXAS;
    var sentinela = R && R.lista && R.lista.length ? R.lista[0].populacao : null;
    var nN = nEfetivo(n), i, r, perturbada;
    try {
      for (i = 0; i < nN; i++) {
        if (sentinela !== null) R.lista[0].populacao = sentinela + (i + 1) * 1e-6; // invalida o cache do Engine a cada draw (1e-6 é visível no float de população do DF)
        perturbada = taxaPerturbada(SEED + i, taxasOrig);
        W.TAXAS = perturbada;
        r = W.Engine.calcular(state);
        out.push({
          total: r.total,
          porRA: (r.porRA || []).map(function (e) { return { id: e.id, candidatos: e.candidatos }; })
        });
      }
    } finally {
      W.TAXAS = taxasOrig;
      if (sentinela !== null && R && R.lista && R.lista.length) R.lista[0].populacao = sentinela;
    }
    return out;
  }

  // quantil interpolado (h=1: idx = p*(m−1))
  function quantil(ordenado, p) {
    var m = ordenado.length;
    if (!m) return NaN;
    if (m === 1) return ordenado[0];
    var idx = p * (m - 1);
    var lo = Math.floor(idx), hi = Math.ceil(idx);
    var v = ordenado[lo] + (ordenado[hi] - ordenado[lo]) * (idx - lo);
    return isFinite(v) ? v : NaN;
  }

  // resumo com intervalos p025/p975 por total e por RA; samples pode ser array ou state
  function resumo(samplesOrState, n) {
    var samples = Array.isArray(samplesOrState) ? samplesOrState : amostrar(samplesOrState, n);
    var nU = samples.length;
    var saida = {
      n: nU,
      total: { median: NaN, p025: NaN, p975: NaN },
      porRA: {}
    };
    if (!nU) return saida;
    var totais = samples.map(function (s) { return s.total; }).sort(function (a, b) { return a - b; });
    saida.total = { median: quantil(totais, 0.5), p025: quantil(totais, 0.025), p975: quantil(totais, 0.975) };
    var ids = [], porId = {}, i, j, e, lista;
    for (i = 0; i < samples.length; i++) {
      lista = samples[i].porRA || [];
      for (j = 0; j < lista.length; j++) {
        e = lista[j];
        if (!(e.id in porId)) { porId[e.id] = []; ids.push(e.id); }
        porId[e.id].push(e.candidatos);
      }
    }
    for (i = 0; i < ids.length; i++) {
      var arr = porId[ids[i]].sort(function (a, b) { return a - b; });
      saida.porRA[ids[i]] = { median: quantil(arr, 0.5), p025: quantil(arr, 0.025), p975: quantil(arr, 0.975) };
    }
    return saida;
  }

  W.Incerteza = { amostrar: amostrar, resumo: resumo };
})();
