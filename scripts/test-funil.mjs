/**
 * test-funil.mjs — Validação do funil (analytics.js), sem dependências.
 * Uso: node scripts/test-funil.mjs
 * Carrega assets/js/data/*.js + engine + analytics via new Function + window falso
 * (mesmo padrão de scripts/test-engine.mjs; código clássico, ordem real de browser).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = ['populacao', 'ras', 'taxas', 'filtros'];

let checks = 0;
const failures = [];

function ok(cond, msg) {
  checks++;
  if (!cond) failures.push(msg);
}

function relDiff(a, b) {
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1);
}

const warns = [];
const win = { console: { warn: (...a) => warns.push(a.join(' ')), log() {}, error: (...a) => warns.push(a.join(' ')) } };
const src = {};
for (const name of DATA) {
  src[name] = fs.readFileSync(path.join(ROOT, 'assets/js/data', name + '.js'), 'utf8');
  new Function('window', src[name])(win);
}
src.engine = fs.readFileSync(path.join(ROOT, 'assets/js/engine.js'), 'utf8');
new Function('window', src.engine)(win);
src.analytics = fs.readFileSync(path.join(ROOT, 'assets/js/analytics.js'), 'utf8');
new Function('window', src.analytics)(win);

// ---------- 0) carregamento + API ----------
ok(!!win.Funil && typeof win.Funil.calcular === 'function', 'analytics.js: window.Funil.calcular definido via new Function + window fake');
ok(!/(^|;|\s)(import|export)[\s{*]/.test(src.analytics) && !/\brequire\s*\(/.test(src.analytics) && !/\bmodule\.exports\b/.test(src.analytics),
  'analytics.js: sintaxe de script clássico (sem import/export/require/module.exports)');
ok(/typeof window !== 'undefined'/.test(src.analytics), "analytics.js: fallback window via typeof guard (carrega em node e file://)");

const E = win.Engine;
const F = win.FILTERS_CONFIG;
const FUNIL = win.Funil;
const alturaCfg = F.find(f => f.id === 'altura');
const NEUTRAL = { idade: [18, 80], altura: [alturaCfg.min, alturaCfg.max] };
const ESTRUTURAIS = { generoUsuario: 1, generoBuscado: 1, orientacaoAlvo: 1 };

// espelha a semântica de Sensibilidade/analytics: quais filtros geram barra
const ativo = (cfg, val) => {
  if (cfg.type === 'multi') {
    if (!cfg.options.length) return false;
    const marked = Array.isArray(val) ? val : (val != null ? [val] : []);
    return cfg.options.some(o => marked.indexOf(o.value) < 0);
  }
  if (cfg.type === 'tri-state') {
    const o = cfg.options.filter(x => x.value === val)[0];
    return !!(o && o.probKey != null);
  }
  if (cfg.type === 'range') {
    if (!Array.isArray(val) || !Number.isFinite(val[0]) || !Number.isFinite(val[1])) return false;
    return Math.min(val[0], val[1]) > cfg.min || Math.max(val[0], val[1]) < cfg.max;
  }
  if (cfg.type === 'toggle') return typeof val === 'boolean' ? val : !!(val && val.ativo);
  return false;
};
const esperados = st => {
  const s = E.normalizeState(st);
  const ids = ['base', 'publico'];
  for (const cfg of F) {
    if (ESTRUTURAIS[cfg.id] || cfg.structural) continue;
    if (ativo(cfg, s[cfg.id])) ids.push(cfg.id);
  }
  return ids;
};

// ---------- 1) estrutura dos estágios ----------
const casos = [
  ['neutro', {}],
  ['M→F idade 25–35 + altura 165–180', { ...NEUTRAL, generoUsuario: 'M', generoBuscado: 'F', idade: [25, 35], altura: [165, 180] }],
  ['super seletivo renda/filhos/fumante', { ...NEUTRAL, renda: ['10a20', '20mais'], filhos: 'nao', fumante: 'nao' }],
  ['tudo ativo', {
    ...NEUTRAL, generoBuscado: 'F', idade: [30, 39], altura: [170, 175],
    renda: ['20mais'], relacionamento: ['solteiro'], filhos: 'sim', escolaridade: ['superior', 'pos'],
    religiao: ['catolica'], fumante: 'nao', obesidade: 'nao', antecedentes: 'nao',
    istCenario: 'c1', ist: 'sim', infidelidade: 'nao', aparencia: { ativo: true, notaMinima: 8 }
  }],
];

for (const [rotulo, st] of casos) {
  const est = FUNIL.calcular(st);
  ok(Array.isArray(est) && est.length >= 2, `${rotulo}: retorna array com ≥ 2 estágios (${est && est.length})`);
  ok(est[0].id === 'base', `${rotulo}: primeiro estágio id 'base' (${est[0].id})`);
  ok(est[0].label === 'Adultos 18–80' && est[1].id === 'publico' && est[1].label === 'Gênero + orientação',
    `${rotulo}: base/publico com labels curtos (${est[0].label} / ${est[1].label})`);
  for (let i = 0; i < est.length; i++) {
    const s = est[i];
    const p = i > 0 ? est[i - 1] : null;
    ok(typeof s.id === 'string' && typeof s.label === 'string' && s.label.length > 0 &&
      [s.total, s.delta, s.deltaPct, s.pctBase].every(v => Number.isFinite(v)),
      `${rotulo}: estágio ${i} tem {id,label,total,delta,deltaPct,pctBase} completos`);
    ok(s.total >= 0, `${rotulo}: estágio ${s.id} total ≥ 0 (${s.total})`);
    ok(!p || s.total <= p.total + 1e-9, `${rotulo}: monotônico decrescente em ${s.id} (${s.total} ≤ ${p && p.total})`);
    ok(s.delta <= 0 && relDiff(s.delta, p ? s.total - p.total : 0) <= 1e-9,
      `${rotulo}: ${s.id} delta = total − anterior ≤ 0 (${s.delta})`);
    ok(relDiff(s.deltaPct, p && p.total > 0 ? s.delta / p.total : 0) <= 1e-9,
      `${rotulo}: ${s.id} deltaPct = delta / total anterior (${s.deltaPct})`);
    ok(relDiff(s.pctBase, est[0].total > 0 ? s.total / est[0].total : 0) <= 1e-9 && s.pctBase <= 1 + 1e-12,
      `${rotulo}: ${s.id} pctBase = total / total base (${s.pctBase})`);
  }
  ok(relDiff(est[est.length - 1].total, E.calcular(st).total) <= 1e-6,
    `${rotulo}: último estágio ${est[est.length - 1].total} ≈ Engine.calcular(state).total ${E.calcular(st).total} (rel ${relDiff(est[est.length - 1].total, E.calcular(st).total).toExponential(2)}, tol 1e-6)`);

  // filtros ativos uma vez, inativos ausentes
  const ids = est.map(x => x.id);
  const exp = esperados(st);
  ok(JSON.stringify(ids) === JSON.stringify(exp), `${rotulo}: estágios na ordem de FILTERS_CONFIG, ativos uma vez e inativos ausentes (${ids.join(',')} vs ${exp.join(',')})`);
  ok(new Set(ids).size === ids.length, `${rotulo}: ids únicos (${ids.length})`);
  for (const id of ids.slice(2)) {
    const cfg = F.find(f => f.id === id);
    ok(!!cfg && !ESTRUTURAIS[id] && !cfg.structural, `${rotulo}: estágio extra "${id}" é filtro de config não estrutural`);
    ok(cfg ? cfg.label === est.find(x => x.id === id).label : false, `${rotulo}: label de "${id}" vem do config (${cfg && cfg.label})`);
  }
}

// ---------- 2) cenário IST: C1 (só crônicas ~2%) corta muito mais que C2 (qualquer IST ~45%) ----------
const funC1 = FUNIL.calcular({ ...NEUTRAL, istCenario: 'c1', ist: 'sim' });
const funC2 = FUNIL.calcular({ ...NEUTRAL, istCenario: 'c2', ist: 'sim' });
const stC1 = funC1.find(x => x.id === 'ist');
const stC2 = funC2.find(x => x.id === 'ist');
ok(!!stC1 && !!stC2, 'ist: estágio "ist" presente nos dois cenários');
ok(stC1.total < stC2.total && relDiff(stC1.total, stC2.total) > 0.5,
  `ist: C1 reduz muito mais que C2 — total C1 ${stC1.total} < C2 ${stC2.total}`);
ok(Math.abs(stC1.delta) > Math.abs(stC2.delta), `ist: |delta| C1 ${Math.abs(stC1.delta)} > C2 ${Math.abs(stC2.delta)}`);
ok(relDiff(stC1.total, E.calcular({ ...NEUTRAL, istCenario: 'c1', ist: 'sim' }).total) <= 1e-9, 'ist: estágio C1 fecha com Engine.calcular do estado completo');
ok(!warns.some(w => /istCenario|select não-estrutural/.test(w)), `istCenario (select structural): sem avisos de console (${warns.length ? warns.join(' | ') : 'nenhum'})`);

// ---------- 3) istCenario não vira barra de funil ----------
for (const c of ['c1', 'c2', undefined]) {
  const ids = FUNIL.calcular({ ...NEUTRAL, istCenario: c, ist: 'sim' }).map(x => x.id);
  ok(ids.indexOf('istCenario') < 0, `istCenario=${c}: não gera estágio próprio (${ids.join(',')})`);
  ok(ids.indexOf('ist') >= 0, `istCenario=${c}: estágio 'ist' presente`);
}

// ---------- 4) atribuicao (Shapley): eficiência, estrutura, determinismo ----------
ok(typeof FUNIL.atribuicao === 'function', 'analytics.js: window.Funil.atribuicao definido');

function neutroManual(st) {
  // espelha Funil: eixos estruturais/seletors do usuário + defaults neutros do config
  const s = E.normalizeState(st);
  return E.normalizeState({
    generoUsuario: s.generoUsuario, generoBuscado: s.generoBuscado,
    orientacaoAlvo: s.orientacaoAlvo, istCenario: s.istCenario,
    rendaEscopo: s.rendaEscopo, modoCalculo: s.modoCalculo,
  });
}

for (const [rotulo, st] of casos) {
  const a = FUNIL.atribuicao(st);
  ok(a && Array.isArray(a.itens) && [a.soma, a.neutro, a.final].every(Number.isFinite),
    `atribuicao ${rotulo}: retorna {itens,soma,neutro,final}`);
  ok(relDiff(a.final, E.calcular(st).total) <= 1e-12, `atribuicao ${rotulo}: final = Engine.calcular(state).total`);
  ok(relDiff(a.neutro, E.calcular(neutroManual(st)).total) <= 1e-12, `atribuicao ${rotulo}: neutro = total do estado neutro`);
  ok(relDiff(a.soma, a.neutro - a.final) <= 1e-9,
    `atribuicao ${rotulo}: eficiência — soma das médias = neutro − final (${a.soma} vs ${a.neutro - a.final})`);
  ok(relDiff(a.itens.reduce((x, e) => x + e.media, 0), a.soma) <= 1e-9, `atribuicao ${rotulo}: soma bate com Σ media`);
  const idsA = a.itens.map(e => e.id);
  ok(JSON.stringify(idsA) === JSON.stringify(esperados(st).slice(2).sort((x, y) => {
    const mx = a.itens.find(e => e.id === x).media, my = a.itens.find(e => e.id === y).media;
    return my - mx || (x < y ? -1 : x > y ? 1 : 0);
  })), `atribuicao ${rotulo}: itens = filtros ativos, ordenados por media desc (${idsA.join(',')})`);
  ok(a.itens.every(e => { const cfg = F.find(f => f.id === e.id); return typeof e.media === 'number' && cfg && e.label === cfg.label; }),
    `atribuicao ${rotulo}: entry {id,label,media} com label do config`);
  ok(JSON.stringify(FUNIL.atribuicao(st)) === JSON.stringify(a), `atribuicao ${rotulo}: determinismo (seed fixa)`);
}
ok(FUNIL.atribuicao({}).itens.length === 0 && FUNIL.atribuicao({}).soma === 0, 'atribuicao neutro: sem filtros ativos ⇒ itens vazio, soma 0');

report();

function report() {
  if (failures.length) {
    console.error(`FALHOU ${failures.length}/${checks} checagens:`);
    for (const f of failures) console.error('  ✗ ' + f);
    process.exit(1);
  }
  console.log(`OK ${checks} checagens`);
}
