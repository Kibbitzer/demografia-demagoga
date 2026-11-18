/**
 * test-incerteza.mjs — Validação de assets/js/incerteza.js, sem dependências.
 * Uso: node scripts/test-incerteza.mjs
 * Carrega assets/js/data/*.js + engine + incerteza via new Function + window falso
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

const win = {};
const src = {};
for (const name of DATA) {
  src[name] = fs.readFileSync(path.join(ROOT, 'assets/js/data', name + '.js'), 'utf8');
  new Function('window', src[name])(win);
}
src.engine = fs.readFileSync(path.join(ROOT, 'assets/js/engine.js'), 'utf8');
new Function('window', src.engine)(win);
src.inc = fs.readFileSync(path.join(ROOT, 'assets/js/incerteza.js'), 'utf8');
new Function('window', src.inc)(win);

// ---------- 0) carregamento node + browser ----------
ok(!!win.Engine && typeof win.Engine.calcular === 'function', 'engine.js: window.Engine.calcular definido via new Function + window fake');
ok(!!win.Incerteza && typeof win.Incerteza.amostrar === 'function' && typeof win.Incerteza.resumo === 'function',
  'incerteza.js: window.Incerteza.amostrar/resumo definidos');
ok(!/(^|;|\s)(import|export)[\s{*]/.test(src.inc) && !/\brequire\s*\(/.test(src.inc) && !/\bmodule\.exports\b/.test(src.inc),
  'incerteza.js: sintaxe de script clássico (sem import/export/require/module.exports)');
ok(/typeof window !== 'undefined'/.test(src.inc), "incerteza.js: fallback window via typeof guard (carrega em node e file://)");

const F = win.FILTERS_CONFIG;
const E = win.Engine;
const I = win.Incerteza;
const alturaCfg = F.find(f => f.id === 'altura');
const NEUTRAL = { idade: [18, 80], altura: [alturaCfg.min, alturaCfg.max] };
// Estado restritivo: ativa tri/multi/range recortado, onde a perturbação realmente propaga
// (no neutro, multi/todos = soma 1 invariante e altura full-range ≈ fator 1 constante).
const RESTRICTIVE = { idade: [25, 35], altura: [165, 180], renda: ['10a20'], escolaridade: ['superior'], ist: 'sim', fumante: 'nao' };
const N = 100; // n=100 para velocidade (padrão da API é 2000)

// ---------- 1) amostrar: forma básica ----------
const t0 = Date.now();
const a1 = I.amostrar(NEUTRAL, N);
const msA = Date.now() - t0;
ok(Array.isArray(a1) && a1.length === N, `amostrar: array de ${N} draws (n=${N} respeitado), ${a1.length}`);
ok(a1.every(s => typeof s.total === 'number' && Array.isArray(s.porRA)), 'amostrar: cada draw tem total numérico e porRA array');
ok(a1.every(s => s.porRA.length === win.DATA_RAS.lista.length), `amostrar: porRA com ${win.DATA_RAS.lista.length} RAs em todos os draws`);
ok(a1.every(s => s.porRA.every(e => typeof e.id === 'string' && typeof e.candidatos === 'number')), 'amostrar: entradas porRA {id, candidatos}');

// ---------- 2) determinismo: duas chamadas iguais ----------
const a2 = I.amostrar(NEUTRAL, N);
ok(JSON.stringify(a1) === JSON.stringify(a2), 'determinismo: amostrar(state,100) duas vezes → JSON idêntico');
const r1 = I.resumo(NEUTRAL, N);
const r2 = I.resumo(NEUTRAL, N);
ok(JSON.stringify(r1) === JSON.stringify(r2), 'determinismo: resumo(state,100) duas vezes → JSON idêntico');

// ---------- 3) TAXAS intacto (antes/depois idêntico) ----------
const taxasAntes = JSON.stringify(win.TAXAS);
I.amostrar(NEUTRAL, 20);
I.resumo(NEUTRAL, 20);
ok(JSON.stringify(win.TAXAS) === taxasAntes, 'TAXAS: JSON.stringify idêntico antes e depois de amostrar/resumo (sem mutação)');

// ---------- 4) quantis ordenados: p025 ≤ median ≤ p975 ----------
ok(r1.n === N, `resumo: n = ${N}`, r1.n);
ok(r1.total.p025 <= r1.total.median && r1.total.median <= r1.total.p975,
  `resumo.total: p025 ${r1.total.p025} ≤ median ${r1.total.median} ≤ p975 ${r1.total.p975}`);
const raId = win.DATA_RAS.lista[0].id;
const ra = r1.porRA[raId];
ok(!!ra, `resumo.porRA["${raId}"] presente`);
if (ra) {
  ok(ra.p025 <= ra.median && ra.median <= ra.p975,
    `resumo.porRA.${raId}: p025 ${ra.p025} ≤ median ${ra.median} ≤ p975 ${ra.p975}`);
}
ok(Object.keys(r1.porRA).length === win.DATA_RAS.lista.length, `resumo.porRA: ${Object.keys(r1.porRA).length} entradas, esperado ${win.DATA_RAS.lista.length}`);

// ---------- 5) totais finitos e ≥ 0; pertubação gera dispersão real ----------
ok(a1.every(s => isFinite(s.total) && s.total >= 0), 'totais: todos finitos e ≥ 0');
ok(a1.every(s => s.porRA.every(e => isFinite(e.candidatos) && e.candidatos >= 0)), 'porRA: candidatos finitos e ≥ 0 em todos os draws');
const base = E.calcular(NEUTRAL).total;
ok(relDiff(r1.total.median, base) <= 0.10, `median do total ${r1.total.median} ≈ baseline ${base} (rel ≤ 0,10)`);

// ---------- 5b) estado restritivo: a perturbação propaga (intervalo, draws, determinismo) ----------
// No neutro, multi/todos (soma 1) e altura full-range (fator ≈ 1) são invariantes; tri-state
// 'indiferente' desliga p. O recorte restritivo ativa Beta (ist/fumante), Dirichlet de linhas
// (renda/escolaridade/junta), Normal de altura e o objeto-vetor (orientacao.porSexo no modo auto).
const a3 = I.amostrar(RESTRICTIVE, N);
const r3 = I.resumo(RESTRICTIVE, N);
const base3 = E.calcular(RESTRICTIVE).total;
ok(r3.total.p975 > r3.total.p025, `intervalo não degenerado (restritivo): p975 ${r3.total.p975} > p025 ${r3.total.p025}`);
ok(new Set(a3.map(s => s.total)).size > N * 0.9, `draws distintos entre si — restritivo (${new Set(a3.map(s => s.total)).size}/${N})`);
ok(new Set(a1.map(s => s.total)).size > N * 0.9, `draws distintos entre si — neutro/objeto-vetor (${new Set(a1.map(s => s.total)).size}/${N})`);
ok(JSON.stringify(a3) === JSON.stringify(I.amostrar(RESTRICTIVE, N)), 'determinismo: amostrar(restritivo,100) duas vezes → JSON idêntico');
ok(relDiff(r3.total.median, base3) <= 0.10, `median restritivo ${r3.total.median} ≈ baseline ${base3} (rel ≤ 0,10)`);

// ---------- 6) clamps de n ----------
ok(I.amostrar(NEUTRAL, 5).length === 20, 'n mínimo: amostrar(state,5) → 20 draws');
ok(I.amostrar(NEUTRAL).length === 2000, 'n padrão: amostrar(state) → 2000 draws (custo maior, ok em browser)');

// ---------- 7) Engine/TAXAS ausentes: resumo vazio sem lançar ----------
const hu = {};
new Function('window', src.inc)(hu);
let lancou = false, vazio;
try { vazio = hu.Incerteza.resumo({}, 50); } catch (e) { lancou = true; }
ok(!lancou, 'sem Engine/TAXAS: resumo não lança');
ok(Array.isArray(hu.Incerteza.amostrar({}, 50)) && hu.Incerteza.amostrar({}, 50).length === 0, 'sem Engine/TAXAS: amostrar retorna array vazio');
ok(vazio && vazio.n === 0 && Number.isNaN(vazio.total.median) && Object.keys(vazio.porRA).length === 0,
  'sem Engine/TAXAS: resumo vazio {n:0, median NaN, porRA {}}');

console.log(`tempo: ${N} draws = ${msA} ms`);
report();

function report() {
  if (failures.length) {
    console.error(`FALHOU ${failures.length}/${checks} checagens:`);
    for (const f of failures) console.error('  ✗ ' + f);
    process.exit(1);
  }
  console.log(`OK ${checks} checagens`);
}
