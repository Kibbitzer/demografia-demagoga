/**
 * main.js — Orquestração: estado, handlers da UI, presets, render.
 * Carregado por último. Depende de: DATA_POPULACAO, DATA_RAS, TAXAS,
 * FILTERS_CONFIG, Engine, Sensibilidade, Charts, UI.
 */
(function () {
  'use strict';

  var DEBOUNCE_MS = 60;
  var RESIZE_MS = 150;
  var NOTA_MINIMA_DEFAULT = 6;

  var state = null;
  var timerRecompute = null;
  var timerResize = null;

  /* ---------- helpers de config ---------- */

  function cfg(id) {
    for (var i = 0; i < window.FILTERS_CONFIG.length; i++) {
      if (window.FILTERS_CONFIG[i].id === id) return window.FILTERS_CONFIG[i];
    }
    return null;
  }

  /** Todos os value ids de um filtro multi/select, lidos do config (sem recriar labels). */
  function valoresDe(id) {
    var c = cfg(id);
    var out = [];
    if (!c || !c.options) return out;
    for (var i = 0; i < c.options.length; i++) out.push(c.options[i].value);
    return out;
  }

  function ehSlider(id) {
    var c = cfg(id);
    return !!c && c.type === 'range';
  }

  function novaAparencia(ativo, notaMinima) {
    return { ativo: !!ativo, notaMinima: typeof notaMinima === 'number' ? notaMinima : NOTA_MINIMA_DEFAULT };
  }

  /* ---------- render ---------- */

  /** Título dinâmico conforme gênero do usuário. Default explícito: 'M'. */
  function atualizarTitulo() {
    var texto = state.generoUsuario === 'F'
      ? 'Quanto Sobra Para a Betinha'
      : 'Quanto Sobra Para o Betinha';
    var h1 = document.querySelector('.topbar-title');
    if (h1) h1.textContent = texto;
    document.title = texto + ' — DF';
  }

  function recompute() {
    atualizarTitulo();
    var res = Engine.calcular(state);
    var ins = Sensibilidade.top(state, 4);
    UI.render(res, state, ins);
    Charts.renderRA(res.porRA);
    if (state && window.Funil && Charts.renderFunil) Charts.renderFunil(Funil.calcular(state));
    if (state.aparencia.ativo) Charts.renderAparencia(state.aparencia.notaMinima);
  }

  /** Slider → debounce 60ms; selects/toggles/presets → imediato. */
  function recomputeImediato() {
    if (timerRecompute) { clearTimeout(timerRecompute); timerRecompute = null; }
    recompute();
  }

  function recomputeDebounced() {
    if (timerRecompute) clearTimeout(timerRecompute);
    timerRecompute = setTimeout(function () {
      timerRecompute = null;
      recompute();
    }, DEBOUNCE_MS);
  }

  /* ---------- presets ---------- */

  var PRESETS = {
    padrao: function () {
      return {
        generoUsuario: 'M',
        generoBuscado: 'F',
        orientacaoAlvo: 'auto',
        idade: [25, 35],
        altura: [155, 185],
        renda: valoresDe('renda'),
        relacionamento: ['solteiro', 'namorando', 'divorciado'],
        filhos: 'indiferente',
        escolaridade: ['superior', 'pos'],
        religiao: valoresDe('religiao'),
        fumante: 'nao',
        obesidade: 'indiferente',
        antecedentes: 'indiferente',
        ist: 'indiferente',
        infidelidade: 'indiferente',
        aparencia: novaAparencia(false, 6)
      };
    },
    super: function () {
      return {
        generoBuscado: 'F',
        idade: [25, 32],
        altura: [165, 180],
        renda: ['10a20', '20mais'],
        relacionamento: ['solteiro', 'namorando'],
        filhos: 'nao',
        escolaridade: ['superior', 'pos'],
        religiao: valoresDe('religiao'),
        fumante: 'nao',
        obesidade: 'nao',
        antecedentes: 'nao',
        ist: 'nao',
        infidelidade: 'nao',
        aparencia: novaAparencia(true, 8)
      };
    },
    livre: function () {
      var base = {
        idade: [18, 80],
        altura: [140, 210],
        renda: valoresDe('renda'),
        relacionamento: valoresDe('relacionamento'),
        escolaridade: valoresDe('escolaridade'),
        religiao: valoresDe('religiao'),
        aparencia: novaAparencia(false, 6)
      };
      base.fumante = 'indiferente';
      base.obesidade = 'indiferente';
      base.antecedentes = 'indiferente';
      base.ist = 'indiferente';
      base.infidelidade = 'indiferente';
      base.filhos = 'indiferente';
      base.orientacaoAlvo = 'auto';
      return base;
    }
  };

  function setPresetAtivo(nome) {
    var botoes = document.querySelectorAll('[data-preset]');
    for (var i = 0; i < botoes.length; i++) {
      var on = nome ? botoes[i].getAttribute('data-preset') === nome : false;
      botoes[i].classList.toggle('active', on);
      botoes[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function applyPreset(nome) {
    var factory = PRESETS[nome];
    if (!factory) return;
    var base = factory();
    var novo = Engine.normalizeState(base);
    // appearência não é chave do config normalizado pelo motor de filtros: manter objeto
    novo.aparencia = base.aparencia || novaAparencia(false, NOTA_MINIMA_DEFAULT);
    state = novo;
    UI.sync(state);
    setPresetAtivo(nome);
    recomputeImediato();
  }

  /* ---------- handlers ---------- */

  function onFilterChange(id, value) {
    if (id === 'aparencia') { onAppearanceToggle(value); return; }
    state[id] = value;
    setPresetAtivo(null);
    if (ehSlider(id)) recomputeDebounced(); else recomputeImediato();
  }

  function onAppearanceToggle(ativo) {
    state.aparencia = state.aparencia || novaAparencia(false, NOTA_MINIMA_DEFAULT);
    state.aparencia.ativo = !!ativo;
    setPresetAtivo(null);
    recomputeImediato();
  }

  function onAppearanceNota(n) {
    state.aparencia = state.aparencia || novaAparencia(false, NOTA_MINIMA_DEFAULT);
    var v = Number(n);
    if (isFinite(v)) state.aparencia.notaMinima = v;
    setPresetAtivo(null);
    recomputeDebounced();
  }

  function onReset() {
    state = Engine.normalizeState({});
    state.aparencia = novaAparencia(false, NOTA_MINIMA_DEFAULT);
    UI.sync(state);
    setPresetAtivo(null);
    recomputeImediato();
  }

  /* ---------- drawer no resize ---------- */

  /** Fecha o drawer só quando a viewport larga não usa mais o modo overlay. */
  function modoDrawer() {
    var b = document.getElementById('btn-filtros');
    if (!b) return false;
    var r = b.getBoundingClientRect();
    return r.width > 0 || r.height > 0;
  }

  function fecharDrawer() {
    if (typeof UI.fecharDrawer === 'function') { UI.fecharDrawer(); return; }
    if (typeof UI.closeDrawer === 'function') { UI.closeDrawer(); return; }
    var sb = document.getElementById('sidebar');
    var ov = document.getElementById('sidebar-overlay');
    var btn = document.getElementById('btn-filtros');
    var classes = ['open', 'aberto', 'aberta', 'is-open', 'drawer-open', 'sidebar-open'];
    if (sb) for (var i = 0; i < classes.length; i++) sb.classList.remove(classes[i]);
    if (ov) ov.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function onResize() {
    if (timerResize) clearTimeout(timerResize);
    timerResize = setTimeout(function () {
      timerResize = null;
      if (modoDrawer()) return;
      fecharDrawer();
    }, RESIZE_MS);
  }

  /* ---------- init ---------- */

  function init() {
    state = Engine.normalizeState({});
    state.aparencia = novaAparencia(false, NOTA_MINIMA_DEFAULT);

    UI.init({
      onFilterChange: onFilterChange,
      onAppearanceToggle: onAppearanceToggle,
      onAppearanceNota: onAppearanceNota,
      onMetodologia: function () { UI.openMetodologia(); },
      onReset: onReset,
      onPreset: applyPreset
    });

    UI.sync(state);
    setPresetAtivo(null);
    recomputeImediato();
    window.addEventListener('resize', onResize);
  }

  window.APP = {
    getState: function () { return state; },
    recompute: recomputeImediato,
    applyPreset: applyPreset
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
