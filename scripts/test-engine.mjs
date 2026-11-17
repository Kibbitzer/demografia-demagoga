/**
 * test-engine.mjs — Validação do motor (engine.js) e sensibilidade (sensibilidade.js), sem dependências.
 * Uso: node scripts/test-engine.mjs
 * Carrega assets/js/data/*.js + engine + sensibilidade via new Function + window falso
 * (mesmo padrão de scripts/test-dados.mjs; código clássico, ordem real de browser).
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

const win = {};
const src = {};
for (const name of DATA) {
  src[name] = fs.readFileSync(path.join(ROOT, 'assets/js/data', name + '.js'), 'utf8');
  new Function('window', src[name])(win);
}
src.engine = fs.readFileSync(path.join(ROOT, 'assets/js/engine.js'), 'utf8');
new Function('window', src.engine)(win);
src.sens = fs.readFileSync(path.join(ROOT, 'assets/js/sensibilidade.js'), 'utf8');
new Function('window', src.sens)(win);

// ---------- 0) carregamento node + browser ----------
ok(!!win.Engine && typeof win.Engine.calcular === 'function', 'engine.js: window.Engine.calcular definido via new Function + window fake');
ok(!!win.Sensibilidade && typeof win.Sensibilidade.top === 'function', 'sensibilidade.js: window.Sensibilidade.top definido');
for (const name of ['engine', 'sens']) {
  ok(!/(^|;|\s)(import|export)[\s{*]/.test(src[name]) && !/\brequire\s*\(/.test(src[name]) && !/\bmodule\.exports\b/.test(src[name]),
    `${name}.js: sintaxe de script clássico (sem import/export/require/module.exports)`);
  ok(/typeof window !== 'undefined'/.test(src[name]), `${name}.js: fallback window via typeof guard (carrega em node e file://)`);
}

const P = win.DATA_POPULACAO;
const T = win.TAXAS;
const F = win.FILTERS_CONFIG;
const E = win.Engine;

// baseline "sem filtros": indiferente, idade 18–80, altura faixa total do filtro (fator 1),
// generoUsuario M / generoBuscado ambos / orientacaoAlvo auto (defaults de filtros.js)
const alturaCfg = F.find(f => f.id === 'altura');
const NEUTRAL = { idade: [18, 80], altura: [alturaCfg.min, alturaCfg.max] };
const base = E.calcular(NEUTRAL);
ok(base.total > 0, `baseline: total > 0 (${base.total})`);

// ---------- 1) sem filtros = soma direta de adultos 18+ do pool compatível ----------
// espelha ORIENT_AUTO_KEYS do motor para gu=M: alvos M → homo+bi; alvos F → hetero+bi
const om = T.orientacao.porSexo.M.homo + T.orientacao.porSexo.M.bi;
const of = T.orientacao.porSexo.F.hetero + T.orientacao.porSexo.F.bi;
let esperado = 0;
for (const d of P.idades) {
  if (d.idade >= 18 && d.idade <= 80) esperado += (d.homens * om + d.mulheres * of) * P.fator;
}
ok(esperado > 0, `baseline: soma direta esperada > 0 (${esperado})`);
ok(relDiff(base.total, esperado) <= 1e-6, `baseline: total ${base.total} vs soma direta ${esperado} (rel ${relDiff(base.total, esperado).toExponential(2)}, tol 1e-6)`);

// ---------- 2) idade 25–29 ----------
const r25 = E.calcular({ ...NEUTRAL, idade: [25, 29] });
ok(r25.total > 0 && r25.total <= base.total + 1e-9 * base.total, `idade 25–29: total ${r25.total} ≤ total 18–80 ${base.total}`);
ok(r25.porIdade.length === 5, `idade 25–29: porIdade tem 5 entradas (25,26,27,28,29), ${r25.porIdade.length}`);
const somaPorIdade = r25.porIdade.reduce((s, x) => s + x.total, 0);
ok(relDiff(somaPorIdade, r25.total) <= 1e-9, `idade 25–29: soma porIdade ${somaPorIdade} = total ${r25.total} (rel ${relDiff(somaPorIdade, r25.total).toExponential(2)})`);
ok(r25.porIdade.every(x => x.idade >= 25 && x.idade <= 29), 'idade 25–29: porIdade só contém idades do intervalo');

// ---------- 3) soma porRA = total (±1) ----------
const somaRA = base.porRA.reduce((s, x) => s + x.candidatos, 0);
ok(Math.abs(somaRA - base.total) <= 1, `porRA: soma ${somaRA} vs total ${base.total} (diff ${Math.abs(somaRA - base.total).toExponential(2)}, tol ±1)`);
ok(base.porRA.length === win.DATA_RAS.lista.length, `porRA: ${base.porRA.length} RAs, esperado ${win.DATA_RAS.lista.length}`);

// ---------- 4) monotonicidade: cada filtro restritivo reduz ou mantém o total ----------
const restritivos = [
  ['renda (só 20+ SM)', { ...NEUTRAL, renda: ['20mais'] }],
  ['filhos (sim)', { ...NEUTRAL, filhos: 'sim' }],
  ['fumante (sim)', { ...NEUTRAL, fumante: 'sim' }],
  ['IST (sim)', { ...NEUTRAL, ist: 'sim' }],
  ['altura (170–175)', { ...NEUTRAL, altura: [170, 175] }],
];
for (const [rotulo, st] of restritivos) {
  const t = E.calcular(st).total;
  ok(t <= base.total + 1e-9 * base.total && t >= 0, `monotonicidade ${rotulo}: total ${t} ≤ ${base.total}`);
  ok(t < base.total, `monotonicidade ${rotulo}: estritamente menor (p<1 por construção)`);
}

// ---------- 5) altura ----------
// faixa 145–210 cobre todo o suporte masculino (150–200) e quase todo o feminino;
// o suporte feminino começa em 140 ⇒ corta ~0,6% dele. Limite 0,99×total reflete os dados reais
// (o 0,999 do enunciado supunha suporte ≥145 também no sexo F).
const rWide = E.calcular({ ...NEUTRAL, altura: [145, 210] }).total;
ok(rWide >= 0.99 * base.total && rWide <= base.total + 1e-9 * base.total, `altura 145–210: total ${rWide} ≈ base ${base.total} (razão ${(rWide / base.total).toFixed(5)}, ≥0,99)`);
const rNarrow = E.calcular({ ...NEUTRAL, altura: [165, 172] }).total;
ok(rNarrow < rWide, `altura estreita 165–172 (${rNarrow}) < faixa ampla 145–210 (${rWide})`);
ok(rNarrow < base.total, `altura estreita 165–172: menor que base sem altura`);

// ---------- 6) aparência ----------
const rOff = E.calcular({ ...NEUTRAL, aparencia: false }).total;
ok(relDiff(rOff, base.total) <= 1e-12, `aparência desligada: total ${rOff} = base ${base.total}`);
const rNota8 = E.calcular({ ...NEUTRAL, aparencia: { ativo: true, notaMinima: 8 } }).total;
ok(rNota8 < base.total && rNota8 > 0, `aparência nota 8 ligada: 0 < ${rNota8} < ${base.total}`);

// ---------- 7) sensibilidade top(state, n) ----------
const Filtro = id => F.find(f => f.id === id);
const neutralOf = cfg => {
  if (cfg.type === 'multi') return cfg.options.map(o => o.value);
  if (cfg.type === 'tri-state') return 'indiferente';
  if (cfg.type === 'range') return [cfg.min, cfg.max];
  if (cfg.type === 'toggle') return false;
  return cfg.defaultValue;
};
const stSens = {
  ...NEUTRAL,
  renda: ['20mais'],
  relacionamento: ['solteiro', 'namorando'],
  fumante: 'sim',
  ist: 'sim',
  altura: [170, 175],
  aparencia: { ativo: true, notaMinima: 8 },
};
const baseSens = E.calcular(stSens).total;
const top4 = win.Sensibilidade.top(stSens, 4);
ok(top4.length === 4, `sensibilidade: top(st,4) retorna 4 entradas (com 6 ativos), ${top4.length}`);
for (let i = 1; i < top4.length; i++) {
  ok(top4[i - 1].deltaAbs >= top4[i].deltaAbs - 1e-9, `sensibilidade: ordenado por deltaAbs desc na posição ${i} (${top4[i - 1].deltaAbs} ≥ ${top4[i].deltaAbs})`);
}
for (const e of top4) {
  const cfg = Filtro(e.id);
  ok(!!cfg, `sensibilidade: id retornado "${e.id}" existe em FILTERS_CONFIG`);
  const recalc = E.calcular({ ...stSens, [e.id]: neutralOf(cfg) }).total - baseSens;
  ok(relDiff(e.delta, recalc) <= 1e-9, `sensibilidade.${e.id}: delta ${e.delta} = recálculo real ${recalc} (rel ${relDiff(e.delta, recalc).toExponential(2)})`);
  ok(e.deltaAbs === Math.abs(e.delta), `sensibilidade.${e.id}: deltaAbs = |delta|`);
  ok(e.delta > 0, `sensibilidade.${e.id}: remover filtro restritivo aumenta o total (${e.delta})`);
  ok(typeof e.texto === 'string' && e.texto.startsWith('Remover ') && e.texto.includes(cfg.label), `sensibilidade.${e.id}: texto formatado presente`);
}
const topAll = win.Sensibilidade.top(stSens, 10);
ok(topAll.length === 6, `sensibilidade: n=10 retorna todos os 6 filtros ativos, ${topAll.length}`);
ok(new Set(topAll.map(e => e.id)).size === 6, 'sensibilidade: ids únicos na lista completa');
const topNeut = win.Sensibilidade.top(NEUTRAL, 4);
ok(Array.isArray(topNeut) && topNeut.length === 0, `sensibilidade: nenhum filtro ativo → lista vazia (${topNeut.length})`);

report();

function report() {
  if (failures.length) {
    console.error(`FALHOU ${failures.length}/${checks} checagens:`);
    for (const f of failures) console.error('  ✗ ' + f);
    process.exit(1);
  }
  console.log(`OK ${checks} checagens`);
}
