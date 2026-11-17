/**
 * test-dados.mjs — Validação dos dados da Fase 1 (sem dependências).
 * Uso: node scripts/test-dados.mjs
 * Carrega assets/js/data/*.js via new Function + window falso (código clássico IIFE, ordem real de browser: populacao, ras, taxas, filtros).
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

function loadFiles() {
  const win = {};
  for (const name of DATA) {
    const src = fs.readFileSync(path.join(ROOT, 'assets/js/data', name + '.js'), 'utf8');
    new Function('window', src)(win);
  }
  return win;
}

const win = loadFiles();
ok(!!win.DATA_POPULACAO, 'populacao.js: window.DATA_POPULACAO definido');
ok(!!win.DATA_RAS, 'ras.js: window.DATA_RAS definido');
ok(!!win.TAXAS, 'taxas.js: window.TAXAS definido');
ok(!!win.FILTERS_CONFIG, 'filtros.js: window.FILTERS_CONFIG definido');
if (failures.length) report();

const P = win.DATA_POPULACAO;
const R = win.DATA_RAS;
const T = win.TAXAS;
const F = win.FILTERS_CONFIG;

// ---------- populacao.js ----------
const somaIdades = P.idades.reduce((s, x) => s + x.homens + x.mulheres, 0);
ok(somaIdades === 2817381, `população: soma homens+mulheres = ${somaIdades}, esperado 2817381`);
ok(P.idades.length === 101, `população: 101 entradas de idade (0–100), ${P.idades.length}`);
ok(P.totalDF === 3009996, 'população: totalDF = 3009996');
ok(P.fator === 1.068367, 'população: fator = 1.068367');
ok(P.anoEscala === 2026, 'população: anoEscala = 2026');
ok(typeof P.fonte === 'string' && P.fonte.length > 0, 'população: fonte presente');
ok(typeof P.url === 'string' && P.url.startsWith('http'), 'população: url presente');
ok(P.confianca === 'A', 'população: confianca A');
ok(P.idades.every(x => Number.isInteger(x.idade) && Number.isInteger(x.homens) && Number.isInteger(x.mulheres) && x.homens >= 0 && x.mulheres >= 0), 'população: entradas de idade inteiras ≥ 0');

// ---------- ras.js ----------
const NOMES_35 = ['Plano Piloto','Gama','Taguatinga','Brazlândia','Sobradinho','Planaltina','Paranoá','Núcleo Bandeirante','Ceilândia','Guará','Cruzeiro','Samambaia','Santa Maria','São Sebastião','Recanto das Emas','Lago Sul','Riacho Fundo','Lago Norte','Candangolândia','Águas Claras','Riacho Fundo II','Sudoeste/Octogonal','Varjão','Park Way','SCIA/Estrutural','Sobradinho II','Jardim Botânico','Itapoã','SIA','Vicente Pires','Fercal','Sol Nascente/Pôr do Sol','Arniqueira','Arapoanga','Água Quente'];
ok(Array.isArray(R.lista) && R.lista.length === 35, `RAs: ${R.lista && R.lista.length} regiões, esperado 35`);
R.lista.forEach((ra, i) => {
  ok(ra.nome === NOMES_35[i], `RAs: ordem canônica na posição ${i + 1}: "${ra.nome}" != "${NOMES_35[i]}"`);
  ok(['A', 'B', 'C'].includes(ra.confianca), `RAs ${ra.nome}: confianca A|B|C`);
  ok(ra.rendaIdx >= 0.55 && ra.rendaIdx <= 2.8, `RAs ${ra.nome}: rendaIdx ${ra.rendaIdx} fora de [0,55–2,8]`);
  ok(ra.educIdx >= 0.6 && ra.educIdx <= 2.2, `RAs ${ra.nome}: educIdx ${ra.educIdx} fora de [0,6–2,2]`);
  ok(ra.populacao > 0, `RAs ${ra.nome}: populacao > 0`);
});
const somaPopRA = R.lista.reduce((s, ra) => s + ra.populacao, 0);
ok(Math.abs(somaPopRA - 3009996) <= 1, `RAs: soma populacao = ${somaPopRA}, esperado 3009996 (±1)`);
ok(Math.abs(somaPopRA - 3009996) / 3009996 <= 0.01, 'RAs: soma populacao dentro de ±1% de 3.009.996');
const somaPeso = R.lista.reduce((s, ra) => s + ra.peso, 0);
ok(Math.abs(somaPeso - 100) <= 0.05, `RAs: soma peso = ${somaPeso.toFixed(2)}, esperado 100,0 (±0,05)`);
// peso coerente com populacao (2 casas); tolera ajuste de arredondamento na maior RA
const maiorRA = R.lista.reduce((a, b) => (b.populacao > a.populacao ? b : a));
R.lista.forEach(ra => {
  const esperado = (ra.populacao / 3009996) * 100;
  const tol = ra === maiorRA ? 0.05 : 0.005;
  ok(Math.abs(ra.peso - esperado) <= tol, `RAs ${ra.nome}: peso ${ra.peso} vs esperado ${esperado.toFixed(2)}`);
});
const ids = new Set(R.lista.map(ra => ra.id));
ok(ids.size === 35, 'RAs: ids únicos');
['fonte', 'nota', 'atualizadoEm', 'confianca'].forEach(k => ok(typeof R[k] === 'string' && R[k].length > 0, `RAs: campo meta "${k}" presente`));

// ---------- taxas.js ----------
const FAIXAS = ['18-24', '25-29', '30-39', '40-49', '50+'];
const soma = a => a.reduce((x, y) => x + y, 0);
function checaMargem(matriz, nCols, rotulo) {
  matriz.forEach((linha, i) => {
    ok(Array.isArray(linha) && linha.length === nCols, `${rotulo}: linha ${i} tem ${nCols} colunas`);
    ok(Math.abs(soma(linha) - 1) <= 0.005, `${rotulo}: linha ${i} soma ${soma(linha).toFixed(4)}, esperado 1 (±0,005)`);
    ok(linha.every(v => v >= 0 && v <= 1), `${rotulo}: linha ${i} com probabilidade fora de [0,1]`);
  });
}

ok(Array.isArray(T.faixasIdade) && T.faixasIdade.join(',') === FAIXAS.join(','), 'taxas: faixasIdade = 18-24,25-29,30-39,40-49,50+');
ok(T.rendaFaixas.length === 6 && T.rendaFaixas.every(f => f.id && f.label), 'taxas: rendaFaixas = 6 com id+label');
ok(T.escolaridadeFaixas.length === 5 && T.escolaridadeFaixas.every(f => f.id && f.label), 'taxas: escolaridadeFaixas = 5 com id+label');
ok(T.estadoCivilFaixas.length === 5 && T.estadoCivilFaixas.every(f => f.id && f.label), 'taxas: estadoCivilFaixas = 5 com id+label');

checaMargem(FAIXAS.map(f => T.rendaPorIdade[f]), 6, 'rendaPorIdade');
checaMargem(FAIXAS.map(f => T.escolaridadePorIdade[f]), 5, 'escolaridadePorIdade');
FAIXAS.forEach(f => checaMargem(T.rendaEduBase[f], 5, `rendaEduBase[${f}]`));
checaMargem(FAIXAS.map(f => T.estadoCivilPorIdade[f]), 5, 'estadoCivilPorIdade');
FAIXAS.forEach(f => checaMargem(T.estadoCivilFilhos[f], 2, `estadoCivilFilhos[${f}]`));
ok(Math.abs(soma(Object.values(T.religiaoDF).filter(v => typeof v === 'number')) - 1) <= 0.005, `religiaoDF: soma ${soma(Object.values(T.religiaoDF).filter(v => typeof v === 'number')).toFixed(4)}, esperado 1`);
['M', 'F'].forEach(s => ok(Math.abs(soma(Object.values(T.orientacao.porSexo[s])) - 1) <= 0.005, `orientacao.porSexo.${s}: soma = 1`));

FAIXAS.forEach(f => {
  const b = T.filhosPorIdade[f];
  ok(b && typeof b.p === 'number' && b.p >= 0 && b.p <= 1, `filhosPorIdade[${f}]: p ∈ [0,1]`);
  ok(b && typeof b.fonte === 'string' && ['A', 'B', 'C'].includes(b.confianca), `filhosPorIdade[${f}]: fonte+confianca por faixa`);
});

function checaEscalar(obj, rotulo) {
  ok(obj.p >= obj.min && obj.p <= obj.max, `${rotulo}: p=${obj.p} fora de [${obj.min},${obj.max}]`);
}
['M', 'F'].forEach(s => checaEscalar(T.fumante[s], `fumante.${s}`));
['M', 'F'].forEach(s => checaEscalar(T.obesidade[s], `obesidade.${s}`));
['M', 'F'].forEach(s => checaEscalar(T.infidelidade[s], `infidelidade.${s}`));
FAIXAS.forEach(f => checaEscalar(T.ist.porIdade[f], `ist.${f}`));
FAIXAS.forEach(f => checaEscalar(T.antecedentes.porIdade[f], `antecedentes.${f}`));
['M', 'F'].forEach(s => {
  const a = T.altura[s];
  ok(a.min < a.mu && a.mu < a.max, `altura.${s}: mu entre min e max`);
  ok(a.sd > 0, `altura.${s}: sd > 0`);
});
ok(T.aparencia.min < T.aparencia.mu && T.aparencia.mu < T.aparencia.max && T.aparencia.sd > 0, 'aparencia: parâmetros coerentes');

const BLOCOS_TAXA = ['rendaPorIdade', 'escolaridadePorIdade', 'rendaEduBase', 'estadoCivilPorIdade', 'filhosPorIdade', 'estadoCivilFilhos', 'religiaoDF', 'orientacao', 'fumante', 'obesidade', 'ist', 'antecedentes', 'infidelidade', 'altura', 'aparencia'];
BLOCOS_TAXA.forEach(k => {
  ok(typeof T[k].fonte === 'string' && T[k].fonte.length > 0, `taxas.${k}: bloco sem "fonte"`);
  ok(['A', 'B', 'C'].includes(T[k].confianca), `taxas.${k}: bloco sem "confianca" válida`);
  ok(typeof T[k].nota === 'string' && T[k].nota.length > 0, `taxas.${k}: bloco sem "nota"`);
  if (T[k].fonteId) ok(!!T.fontes[T[k].fonteId], `taxas.${k}: fonteId "${T[k].fonteId}" não registrada em TAXAS.fontes`);
});
ok(T.meta && T.meta.anoBase === 2026, 'taxas: meta.anoBase = 2026');
Object.entries(T.fontes).forEach(([id, f]) => {
  ok(typeof f.nome === 'string' && f.nome.length > 0, `fontes.${id}: nome presente`);
  ok(['A', 'B', 'C'].includes(f.confianca), `fontes.${id}: confianca A|B|C`);
  ok(typeof f.nivel === 'string' && f.nivel.length > 0, `fontes.${id}: nivel presente`);
});

// ---------- filtros.js ----------
const IDS_OBRIG = ['generoUsuario','generoBuscado','orientacaoAlvo','idade','altura','renda','relacionamento','filhos','escolaridade','religiao','fumante','obesidade','antecedentes','ist','infidelidade','aparencia'];
const TIPOS = ['range', 'select', 'multi', 'toggle', 'tri-state'];
const CATS = ['Demografia & Compatibilidade', 'Socioeconômico', 'Físico & Estilo de Vida', 'Comportamental'];
const idsF = F.map(f => f.id);
IDS_OBRIG.forEach(id => ok(idsF.includes(id), `filtros: id obrigatório ausente: ${id}`));
F.forEach(f => {
  ok(TIPOS.includes(f.type), `filtros.${f.id}: type "${f.type}" não permitido`);
  ok(CATS.includes(f.category), `filtros.${f.id}: category "${f.category}" não exata`);
  ok(typeof f.label === 'string' && f.label.length > 0, `filtros.${f.id}: label presente`);
  ok(typeof f.source === 'string' && f.source.length > 0, `filtros.${f.id}: source presente`);
  ok(typeof f.methodologyNote === 'string' && f.methodologyNote.length > 0, `filtros.${f.id}: methodologyNote presente`);
  ok('defaultValue' in f, `filtros.${f.id}: defaultValue definido`);
  ok(['A', 'B', 'C'].includes(f.confianca), `filtros.${f.id}: confianca A|B|C`);
  if (f.rateKey) ok(!!T[f.rateKey], `filtros.${f.id}: rateKey "${f.rateKey}" inexistente em TAXAS`);
  if (f.options) f.options.forEach(o => {
    ok('value' in o && typeof o.label === 'string' && o.label.length > 0 && 'probKey' in o, `filtros.${f.id}: opção ${o.value} sem {value,label,probKey}`);
  });
  if (f.type === 'range') ok(typeof f.min === 'number' && typeof f.max === 'number' && f.min < f.max && typeof f.step === 'number', `filtros.${f.id}: range sem min/max/step`);
});
// rateKeys específicos exigidos pelo enunciado
const rateKeyEsperado = { renda: 'rendaPorIdade', relacionamento: 'estadoCivilPorIdade', filhos: 'filhosPorIdade', escolaridade: 'escolaridadePorIdade', religiao: 'religiaoDF', antecedentes: 'antecedentes', ist: 'ist', infidelidade: 'infidelidade', altura: 'altura', orientacaoAlvo: 'orientacao', aparencia: 'aparencia' };
Object.entries(rateKeyEsperado).forEach(([id, rk]) => {
  const f = F.find(x => x.id === id);
  ok(f && f.rateKey === rk, `filtros.${id}: rateKey deveria ser "${rk}"`);
});
const idade = F.find(f => f.id === 'idade');
ok(idade.min === 18 && idade.max === 80, 'filtros.idade: range 18–80');
const alturaF = F.find(f => f.id === 'altura');
ok(alturaF.min === 140 && alturaF.max === 210, 'filtros.altura: range 140–210');
ok(F.find(f => f.id === 'renda').options.length === 6, 'filtros.renda: 6 faixas');
ok(F.find(f => f.id === 'relacionamento').options.length === 5, 'filtros.relacionamento: 5 estados');
ok(F.find(f => f.id === 'escolaridade').options.length === 5, 'filtros.escolaridade: 5 níveis');
ok(F.find(f => f.id === 'religiao').options.length === 6, 'filtros.religiao: 6 opções');
ok(F.find(f => f.id === 'generoBuscado').options.length === 3, 'filtros.generoBuscado: M/F/ambos');
ok(F.find(f => f.id === 'aparencia').notaMinima != null, 'filtros.aparencia: notaMinima presente');

report();

function report() {
  if (failures.length) {
    console.error(`FALHOU ${failures.length}/${checks} checagens:`);
    for (const f of failures) console.error('  ✗ ' + f);
    process.exit(1);
  }
  console.log(`OK ${checks} checagens`);
}
