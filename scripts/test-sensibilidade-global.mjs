/**
 * test-sensibilidade-global.mjs — Validação de Sensibilidade.global (Sobol por MC), sem dependências.
 * Uso: node scripts/test-sensibilidade-global.mjs
 * Carrega assets/js/data/*.js + engine + sensibilidade via new Function + window falso
 * (mesmo padrão de scripts/test-engine.mjs; ordem real de browser).
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

const win = { console: { warn() {}, log() {}, error() {} } };
for (const name of DATA) {
  new Function('window', fs.readFileSync(path.join(ROOT, 'assets/js/data', name + '.js'), 'utf8'))(win);
}
new Function('window', fs.readFileSync(path.join(ROOT, 'assets/js/engine.js'), 'utf8'))(win);
const srcSens = fs.readFileSync(path.join(ROOT, 'assets/js/sensibilidade.js'), 'utf8');
new Function('window', srcSens)(win);

// ---------- 0) API ----------
const S = win.Sensibilidade;
ok(!!S && typeof S.global === 'function', 'sensibilidade.js: window.Sensibilidade.global definido via new Function + window fake');
ok(!!S && typeof S.top === 'function', 'sensibilidade.js: top() mantido na API');
ok(!/(^|;|\s)(import|export)[\s{*]/.test(srcSens) && !/\brequire\s*\(/.test(srcSens) && !/\bmodule\.exports\b/.test(srcSens),
  'sensibilidade.js: sintaxe de script clássico (sem import/export/require/module.exports)');
ok(/SEED\s*=\s*20261118/.test(srcSens), 'sensibilidade.js: semente determinística 20261118 no código');

const F = win.FILTERS_CONFIG;
const alturaCfg = F.find(f => f.id === 'altura');
const NEUTRAL = { altura: [alturaCfg.min, alturaCfg.max] };
const ESTRUTURAIS = { generoUsuario: 1, generoBuscado: 1, orientacaoAlvo: 1, idade: 1 };

// estado restritivo: muitos filtros ativos, incl. os grandes (idade fica estrutural e não entra)
const RESTRITIVO = {
  ...NEUTRAL, generoUsuario: 'M', generoBuscado: 'F', idade: [30, 39],
  altura: [170, 175], renda: ['20mais'], relacionamento: ['solteiro'], filhos: 'sim',
  escolaridade: ['superior', 'pos'], religiao: ['catolica'], fumante: 'nao',
  obesidade: 'nao', antecedentes: 'nao', istCenario: 'c1', ist: 'sim',
  infidelidade: 'nao', aparencia: { ativo: true, notaMinima: 8 },
};

// ids que devem entrar (mesma semântica de sensibilidade.js: não-estrutural + ativo)
const ativo = (cfg, val) => {
  if (cfg.type === 'multi') {
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
const sNorm = win.Engine.normalizeState(RESTRITIVO);
const esperados = F.filter(c => !ESTRUTURAIS[c.id] && !c.structural && ativo(c, sNorm[c.id])).map(c => c.id);

// ---------- 1) estrutura da saída ----------
const g = S.global(RESTRITIVO);
ok(Array.isArray(g) && g.length === esperados.length,
  `restritivo: um entry por filtro ativo (${g.length} vs ${esperados.length})`);
ok(JSON.stringify(g.map(x => x.id).slice().sort()) === JSON.stringify(esperados.slice().sort()),
  `restritivo: ids batem com os ativos (${g.map(x => x.id).join(',')})`);
let structOk = true, labelOk = true;
for (const e of g) {
  if (typeof e.id !== 'string' || typeof e.label !== 'string' ||
      ![e.S, e.S_T, e.rank].every(Number.isFinite)) structOk = false;
  const cfg = F.find(f => f.id === e.id);
  if (!cfg || cfg.label !== e.label) labelOk = false;
}
ok(structOk, 'restritivo: entries {id,label,S,S_T,rank} completos');
ok(labelOk, 'restritivo: label vem do FILTERS_CONFIG');

// ---------- 2) clamp + monotonicidade ----------
const clampOk = g.every(e => e.S >= 0 && e.S <= 1 && e.S_T >= 0 && e.S_T <= 1);
ok(clampOk, `restritivo: S e S_T em [0,1] (max S ${Math.max(...g.map(e => e.S)).toFixed(4)}, max S_T ${Math.max(...g.map(e => e.S_T)).toFixed(4)})`);
const supOk = g.every(e => e.S_T >= e.S - 1e-12);
ok(supOk, 'restritivo: S_T ≥ S para todos');
const sortedOk = g.every((e, i) => e.rank === i + 1) && g.every((e, i) => i === 0 || g[i - 1].S_T >= e.S_T - 1e-12);
ok(sortedOk, `restritivo: ordenado por S_T desc com rank 1..n (${g.map(e => e.id + ':' + e.S_T.toFixed(3)).join(' ')})`);
const somaS = g.reduce((a, e) => a + e.S, 0);
ok(somaS <= 1 + 1e-9, `restritivo: soma de S ≤ 1 (${somaS.toFixed(4)})`);

// ---------- 3) S_T > 0 em estado restritivo ----------
const top1 = g[0];
ok(g.some(e => e.S_T > 0), 'restritivo: pelo menos um S_T > 0');
ok(top1 && top1.S_T > 0.01, `restritivo: maior gargalo tem S_T relevante (${top1 && top1.id}: ${top1 && top1.S_T.toFixed(4)})`);

// ---------- 4) determinismo ----------
const g2 = S.global(RESTRITIVO);
ok(JSON.stringify(g) === JSON.stringify(g2), 'determinismo: duas chamadas idênticas (seed 20261118)');
ok(JSON.stringify(S.global({ ...RESTRITIVO })) === JSON.stringify(g), 'determinismo: estado deep-equal ⇒ mesma saída');

// ---------- 5) vazio sem filtro ativo ----------
ok(JSON.stringify(S.global({ ...NEUTRAL })) === '[]', 'neutro: sem filtro ativo ⇒ lista vazia');
ok(JSON.stringify(S.global({})) === '[]', 'vazio: estado {} ⇒ lista vazia');
ok(JSON.stringify(S.global({ generoBuscado: 'F', idade: [25, 35] })) === '[]',
  'estruturais apenas (gênero/idade): não geram entradas');

// ---------- 6) top() intacto (legado) ----------
const t = S.top(RESTRITIVO, 4);
ok(Array.isArray(t) && t.length === 4 && t.every(e => typeof e.texto === 'string' && e.texto.length > 0 &&
  Number.isFinite(e.delta) && Number.isFinite(e.deltaAbs) && e.deltaAbs >= 0),
  'top(): API legada inalterada (4 entries com delta/deltaAbs/deltaRel/texto)');
ok(JSON.stringify(S.global({ ...NEUTRAL, renda: ['20mais'] }).map(e => e.id)) === '["renda"]',
  'um filtro só: entrada única "renda"');

report();

function report() {
  if (failures.length) {
    console.error(`FALHOU ${failures.length}/${checks} checagens:`);
    for (const f of failures) console.error('  ✗ ' + f);
    process.exit(1);
  }
  console.log(`OK ${checks} checagens`);
}
