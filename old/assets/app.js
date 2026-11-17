// Funil demográfico do DF: estado da UI, cálculo e gráficos.
// Todo número vem de data/*.json; no código só existem os limites 18–100 dos sliders de idade.
import chartXkcd from './vendor/chart.xkcd.esm.js';

const $ = (seletor) => document.querySelector(seletor);
const nf = new Intl.NumberFormat('pt-BR');
const fmt = (valor) => nf.format(Math.round(valor));
const pct = (valor, casas = 1) => `${(valor * 100).toFixed(casas).replace('.', ',')}%`;

const IDADE_UI = { min: 18, max: 100 };
const IST = { c1: 'ist_cronica', c2: 'qualquer_ist' };
const CENARIOS = ['sem', 'c1', 'c2'];
const SEXOS = ['mulheres', 'homens', 'ambos'];
const PRESET_EXIGIR = ['nao_vive_em_uniao', 'superior_completo'];
const PRESET_EXCLUIR = [
  'historico_infidelidade',
  'antecedentes_criminais',
  'ist_cronica',
  'orientacao_exclusiva',
  'obesidade',
];

const dados = {};
const estado = {
  sexo: 'mulheres',
  idadeMin: 25,
  idadeMax: 29,
  exigir: new Set(),
  excluir: new Set(),
  escala: true,
  rendaPiso: 0,
  rendaTeto: null,
  rendaSemTeto: true,
  ras: new Set(),
};

const refs = {
  escala: null,
  rendaPiso: null,
  rendaTeto: null,
  rendaSemTeto: null,
  raTodas: null,
  ras: new Map(),
  prevalencias: new Map(),
  ops: new Map(),
  ist: new Map(),
};

let porId = new Map();
let midAnterior = null;
let rotuloDelta = null;

// ---------- carga ----------

async function carregar(caminho) {
  const resp = await fetch(caminho);
  if (!resp.ok) throw new Error(`${caminho} (HTTP ${resp.status})`);
  return resp.json();
}

async function iniciar() {
  let pacotes;
  try {
    pacotes = await Promise.all([
      carregar('data/populacao.json'),
      carregar('data/filtros.json'),
      carregar('data/fontes.json'),
      carregar('data/renda_pc.json'),
      carregar('data/ra.json'),
    ]);
  } catch (erro) {
    $('#contador').textContent = '—';
    $('#aviso').textContent = `Não foi possível carregar os dados: ${erro.message}. Sirva a página por HTTP e recarregue.`;
    return;
  }
  [dados.populacao, dados.filtros, dados.fontes, dados.rendaPc, dados.ra] = pacotes;
  porId = new Map((dados.filtros.filtros ?? []).map((f) => [f.id, f]));

  montarEscala();
  montarRAs();
  montarFiltros();
  montarFontes();
  aplicarPreset();
  aplicarURL();
  ligarEventos();
  $('#delta').textContent = 'Acione um filtro para ver o impacto da última mudança.';
  atualizar();
}

// ---------- helpers de prevalência ----------

function prevalencia(f, sexo) {
  const p = f.prevalencia ? f.prevalencia[sexo] : null;
  if (!p) return null;
  if (typeof p.padrao === 'number') return [p.padrao, p.padrao];
  return [Math.min(p.min, p.max), Math.max(p.min, p.max)];
}

function disponivel(f) {
  if (estado.sexo === 'ambos') {
    return Boolean(prevalencia(f, 'mulheres') && prevalencia(f, 'homens') && f.disponivel_homens !== false);
  }
  if (estado.sexo === 'homens') {
    return Boolean(prevalencia(f, 'homens') && f.disponivel_homens !== false);
  }
  return Boolean(prevalencia(f, 'mulheres'));
}

function operacao(f) {
  if (estado.exigir.has(f.id)) return 'exigir';
  if (estado.excluir.has(f.id)) return 'excluir';
  return 'ignorar';
}

function aplicarOperacao(id, op) {
  estado.exigir.delete(id);
  estado.excluir.delete(id);
  if (op === 'exigir') estado.exigir.add(id);
  else if (op === 'excluir') estado.excluir.add(id);
}

function fatorFiltro(f, sexo) {
  const p = prevalencia(f, sexo);
  if (!p) return null;
  const op = operacao(f);
  if (op === 'ignorar') return [1, 1];
  if (op === 'exigir') return p;
  return [1 - p[1], 1 - p[0]];
}

function rotuloCurto(texto, limite = 18) {
  const s = String(texto ?? '').trim();
  if (s.length <= limite) return s;
  const corte = s.slice(0, limite - 1);
  const espaco = corte.lastIndexOf(' ');
  return `${espaco > limite / 2 ? corte.slice(0, espaco) : corte}…`;
}

function inteiro(valor, min, max) {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number.parseInt(valor, 10);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

// ---------- população base ----------

function base(sexo) {
  const idades = dados.populacao.idades ?? [];
  let soma = 0;
  for (const linha of idades) {
    if (linha.idade < estado.idadeMin || linha.idade > estado.idadeMax) continue;
    if (sexo === 'mulheres' || sexo === 'ambos') soma += linha.mulheres ?? 0;
    if (sexo === 'homens' || sexo === 'ambos') soma += linha.homens ?? 0;
  }
  return soma;
}

function distribuicaoRenda(sexo, idade) {
  const dadosSexo = dados.rendaPc?.dados?.[sexo];
  if (!dadosSexo) return null;
  const chaveIdade = idade <= 69 ? String(idade) : '70+';
  return dadosSexo[chaveIdade] ?? dadosSexo['70+'] ?? null;
}

function cdfRenda(bins, x) {           // pessoas com renda < x
  const largura = dados.rendaPc.bin.largura;
  let acc = 0;
  for (const [k, v] of Object.entries(bins)) {
    if (k.endsWith('+')) { const ini = Number(k.slice(0, -1)); if (x > ini) acc += v; continue; }
    const ini = Number(k) * largura, fim = ini + largura;
    if (fim <= x) acc += v;
    else if (ini < x) acc += v * (x - ini) / largura;
  }
  return acc;
}

function fracaoRenda(sexo) {
  // média ponderada pela população de cada idade da faixa selecionada
  const piso = Math.max(0, estado.rendaPiso || 0);
  const teto = estado.rendaSemTeto ? Infinity : (estado.rendaTeto ?? Infinity);
  if (!dados.rendaPc) return 1;
  const idades = dados.populacao.idades.filter(l => l.idade >= estado.idadeMin && l.idade <= estado.idadeMax);
  let somaPeso = 0, somaFrac = 0;
  for (const linha of idades) {
    const pop = linha[sexo] ?? 0;
    const bins = distribuicaoRenda(sexo, linha.idade);
    if (!pop || !bins) continue;
    const total = Object.values(bins).reduce((a, b) => a + b, 0);
    if (!total) continue;
    const frac = Math.max(0, Math.min(1, (cdfRenda(bins, teto) - cdfRenda(bins, piso)) / total));
    somaPeso += pop; somaFrac += pop * frac;
  }
  return somaPeso ? somaFrac / somaPeso : 1;
}

function fatorRAs() {
  const ras = dados.ra.ras ?? [];
  if (!ras.length) return 1;
  const total = dados.ra.total?.peso || ras.reduce((soma, ra) => soma + (ra.peso ?? 0), 0);
  if (!total) return 1;
  let soma = 0;
  for (const ra of ras) if (estado.ras.has(ra.id)) soma += ra.peso ?? 0;
  return Math.min(1, soma / total);
}

// ---------- cenário de IST ----------

function cenarioAtual() {
  if (estado.excluir.has(IST.c2)) return 'c2';
  if (estado.excluir.has(IST.c1)) return 'c1';
  return 'sem';
}

function definirCenario(cenario) {
  if (!CENARIOS.includes(cenario)) return;
  aplicarOperacao(IST.c1, 'ignorar');
  aplicarOperacao(IST.c2, 'ignorar');
  if (cenario === 'c1') aplicarOperacao(IST.c1, 'excluir');
  if (cenario === 'c2') aplicarOperacao(IST.c2, 'excluir');
}

// ---------- cálculo ----------

function somaSexos(atual, sexos, lado) {
  return sexos.reduce((soma, sexo) => soma + atual[sexo][lado], 0);
}

function calcular() {
  const fator = estado.escala ? (dados.populacao.escala_2026?.fator ?? 1) : 1;
  const sexos = estado.sexo === 'ambos' ? ['mulheres', 'homens'] : [estado.sexo];
  const b = { mulheres: base('mulheres') * fator, homens: base('homens') * fator };
  const baseTotal = sexos.reduce((soma, sexo) => soma + b[sexo], 0);

  const cadeia = (dados.filtros.filtros ?? []).filter(
    (f) => (estado.exigir.has(f.id) || estado.excluir.has(f.id)) && disponivel(f),
  );

  const atual = {};
  for (const sexo of sexos) atual[sexo] = { lo: b[sexo], hi: b[sexo] };

  const passos = [{ rotulo: 'Base', lo: baseTotal, hi: baseTotal }];
  for (const f of cadeia) {
    for (const sexo of sexos) {
      const fx = fatorFiltro(f, sexo);
      atual[sexo].lo *= fx[0];
      atual[sexo].hi *= fx[1];
    }
    passos.push({ rotulo: rotuloCurto(f.rotulo), lo: somaSexos(atual, sexos, 'lo'), hi: somaSexos(atual, sexos, 'hi') });
  }

  const fracoes = {};
  let rendaPeso = 0, rendaAcum = 0;
  for (const sexo of sexos) {
    fracoes[sexo] = fracaoRenda(sexo);
    const peso = b[sexo] || 0;
    rendaPeso += peso; rendaAcum += peso * fracoes[sexo];
  }
  const renda = rendaPeso ? rendaAcum / rendaPeso : 1;
  for (const sexo of sexos) {
    atual[sexo].lo *= fracoes[sexo];
    atual[sexo].hi *= fracoes[sexo];
  }
  if (renda < 0.99995) passos.push({ rotulo: 'Renda', lo: somaSexos(atual, sexos, 'lo'), hi: somaSexos(atual, sexos, 'hi') });

  const regioes = fatorRAs();
  if (regioes < 0.99995) {
    for (const sexo of sexos) {
      atual[sexo].lo *= regioes;
      atual[sexo].hi *= regioes;
    }
    passos.push({ rotulo: 'Regiões', lo: somaSexos(atual, sexos, 'lo'), hi: somaSexos(atual, sexos, 'hi') });
  }

  return {
    lo: somaSexos(atual, sexos, 'lo'),
    hi: somaSexos(atual, sexos, 'hi'),
    base: baseTotal,
    escala: estado.escala,
    passos,
  };
}

// ---------- montagem da UI ----------

function montarEscala() {
  const ancora = document.querySelector('label[for="idade-min"]') ?? $('#idade-min');
  const secao = ancora.closest('section');

  const rotulo = document.createElement('label');
  rotulo.setAttribute('for', 'escala-2026');
  rotulo.textContent = 'Escala 2026';

  const caixa = document.createElement('input');
  caixa.type = 'checkbox';
  caixa.id = 'escala-2026';
  caixa.checked = true;

  secao.insertBefore(rotulo, ancora);
  secao.insertBefore(caixa, ancora);
  refs.escala = caixa;
}

function montarRAs() {
  const container = $('#ras');
  container.replaceChildren();
  const total = dados.ra.total?.peso ?? 100;

  refs.raTodas = document.createElement('input');
  refs.raTodas.type = 'checkbox';
  refs.raTodas.id = 'ra-todas';
  refs.raTodas.checked = true;
  const linhaTodas = document.createElement('label');
  linhaTodas.className = 'filtro';
  linhaTodas.append(refs.raTodas, document.createTextNode(' Todas as regiões'));
  container.append(linhaTodas);

  for (const ra of dados.ra.ras ?? []) {
    const caixa = document.createElement('input');
    caixa.type = 'checkbox';
    caixa.id = `ra-${ra.id}`;
    caixa.dataset.ra = ra.id;
    caixa.checked = true;

    const peso = document.createElement('span');
    peso.className = 'filtro-taxa';
    peso.textContent = total ? pct((ra.peso ?? 0) / total) : '';

    const rotulo = document.createElement('label');
    rotulo.className = 'filtro';
    rotulo.append(caixa, document.createTextNode(` ${ra.nome} `), peso);

    refs.ras.set(ra.id, caixa);
    container.append(rotulo);
  }
}

function linhaFiltro(f) {
  const linha = document.createElement('div');
  linha.className = 'filtro';

  const nome = document.createElement('span');
  nome.textContent = f.rotulo;

  const prev = document.createElement('span');
  prev.className = 'filtro-taxa';

  const selo = document.createElement('span');
  selo.className = 'selo';
  selo.textContent = `${f.confianca ?? '—'}${f.verificado === false ? ' · fonte não verificada' : ''}`;

  linha.append(nome, prev, selo);

  const opcoes = [
    ['ignorar', 'Ignorar'],
    ['exigir', 'Só quem tem'],
    ['excluir', 'Só quem não tem'],
  ];
  const radios = new Map();
  for (const [valor, texto] of opcoes) {
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = `op-${f.id}`;
    radio.value = valor;
    radio.dataset.filtro = f.id;

    const rotulo = document.createElement('label');
    rotulo.append(radio, document.createTextNode(` ${texto}`));
    linha.append(rotulo);
    radios.set(valor, radio);
  }

  if (f.nota) linha.title = f.nota;

  refs.prevalencias.set(f.id, prev);
  refs.ops.set(f.id, radios);
  return linha;
}

function montarFiltros() {
  const container = $('#filtros');
  container.replaceChildren();

  const grupoIst = document.createElement('fieldset');
  const legendaIst = document.createElement('legend');
  legendaIst.textContent = 'Cenário de IST';
  grupoIst.append(legendaIst);

  const opcoes = [
    ['sem', 'Sem filtro de IST'],
    ['c1', 'C1 — ISTs crônicas'],
    ['c2', 'C2 — todas as ISTs'],
  ];
  for (const [valor, texto] of opcoes) {
    const caixa = document.createElement('input');
    caixa.type = 'radio';
    caixa.name = 'ist-cenario';
    caixa.id = `ist-${valor}`;
    caixa.value = valor;
    const rotulo = document.createElement('label');
    rotulo.setAttribute('for', caixa.id);
    rotulo.textContent = texto;
    grupoIst.append(caixa, rotulo);
    refs.ist.set(valor, caixa);
  }
  container.append(grupoIst);

  const ordem = [];
  const porGrupo = new Map();
  for (const f of dados.filtros.filtros ?? []) {
    const grupo = f.grupo ?? 'Outros';
    if (!porGrupo.has(grupo)) {
      porGrupo.set(grupo, []);
      ordem.push(grupo);
    }
    porGrupo.get(grupo).push(f);
  }
  const menorOrdem = (grupo) => Math.min(...porGrupo.get(grupo).map((f) => f.ordem ?? 0));
  ordem.sort((a, b) => menorOrdem(a) - menorOrdem(b));

  for (const grupo of ordem) {
    const fieldset = document.createElement('fieldset');
    const legenda = document.createElement('legend');
    legenda.textContent = grupo;
    fieldset.append(legenda);
    for (const f of porGrupo.get(grupo).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))) fieldset.append(linhaFiltro(f));
    container.append(fieldset);
  }
}

function montarFontes() {
  const container = $('#fontes');
  container.replaceChildren();
  for (const fonte of dados.fontes.fontes ?? []) {
    const termo = document.createElement('dt');
    termo.textContent = [fonte.publicador, fonte.titulo, fonte.ano].filter(Boolean).join(' — ');
    const definicao = document.createElement('dd');
    if (fonte.url) {
      const link = document.createElement('a');
      link.href = fonte.url;
      link.textContent = fonte.tabela || 'tabela';
      link.rel = 'noopener noreferrer';
      link.target = '_blank';
      definicao.append(link);
    } else {
      definicao.textContent = fonte.tabela || 'sem link';
    }
    if (fonte.confianca) {
      const selo = document.createElement('span');
      selo.className = 'selo';
      selo.textContent = fonte.confianca;
      definicao.append(' ', selo);
    }
    container.append(termo, definicao);
  }
}

// ---------- sincronização e render ----------

function atualizarPrevalencias() {
  const sexos = estado.sexo === 'ambos' ? ['mulheres', 'homens'] : [estado.sexo];
  for (const f of dados.filtros.filtros ?? []) {
    const alvo = refs.prevalencias.get(f.id);
    if (!alvo) continue;
    const partes = [];
    for (const sexo of sexos) {
      const p = prevalencia(f, sexo);
      if (!p) continue;
      const prefixo = sexos.length > 1 ? (sexo === 'mulheres' ? 'M ' : 'H ') : '';
      const valor = p[0] === p[1] ? pct(p[0]) : `${pct(p[0])}–${pct(p[1])}`;
      partes.push(`${prefixo}${valor}`);
    }
    alvo.textContent = partes.length ? `${partes.join(' · ')} têm` : '';
  }
}

function sincronizar() {
  const radio = document.querySelector(`input[name="sexo"][value="${estado.sexo}"]`);
  if (radio) radio.checked = true;

  $('#idade-min').value = String(estado.idadeMin);
  $('#idade-max').value = String(estado.idadeMax);
  $('#idade-info').textContent = `${estado.idadeMin} a ${estado.idadeMax} anos`;
  if (refs.escala) refs.escala.checked = estado.escala;

  refs.rendaPiso.value = String(estado.rendaPiso);
  refs.rendaTeto.value = estado.rendaTeto === null ? '' : String(estado.rendaTeto);
  refs.rendaTeto.disabled = estado.rendaSemTeto;
  refs.rendaSemTeto.checked = estado.rendaSemTeto;

  const ras = dados.ra.ras ?? [];
  for (const [id, caixa] of refs.ras) caixa.checked = estado.ras.has(id);
  refs.raTodas.checked = ras.length > 0 && estado.ras.size === ras.length;

  for (const [id, radios] of refs.ops) {
    const f = porId.get(id);
    const ok = Boolean(f) && disponivel(f);
    const atual = ok ? operacao(f) : 'ignorar';
    for (const [valor, radio] of radios) {
      radio.checked = valor === atual;
      radio.disabled = !ok;
    }
  }

  const cenario = cenarioAtual();
  for (const [valor, caixa] of refs.ist) caixa.checked = valor === cenario;
  atualizarPrevalencias();
}

function avisoTexto() {
  const semPrevalencia = (dados.filtros.filtros ?? []).filter((f) => !disponivel(f));
  if (!semPrevalencia.length) return '';
  const nomes = semPrevalencia.map((f) => f.rotulo).join('; ');
  if (estado.sexo === 'homens') return `Indisponíveis para homens (sem prevalência masculina verificada): ${nomes}.`;
  return `Indisponíveis neste modo (sem prevalência para os dois sexos): ${nomes}.`;
}

function desenhar(seletor, titulo, labels, valores) {
  const antigo = $(seletor);
  if (!antigo) return;
  const largura = Math.max(320, Math.floor((antigo.parentElement?.clientWidth || 640) - 8));
  const altura = 420;
  const svg = antigo.cloneNode(false);
  svg.setAttribute('width', String(largura));
  svg.setAttribute('height', String(altura));
  svg.setAttribute('viewBox', `0 0 ${largura} ${altura}`);
  antigo.replaceWith(svg);
  if (!labels.length || !valores.some((valor) => valor > 0)) {
    svg.setAttribute('aria-label', `${titulo}: sem dados`);
    return;
  }
  new chartXkcd.Bar(svg, {
    title: titulo,
    yLabel: 'pessoas',
    data: { labels: labels.map((rotulo) => rotuloCurto(rotulo, 14)), datasets: [{ data: valores }] },
    options: { yTickCount: 5, unxkcdify: false },
  });
}

function render(c) {
  $('#contador').textContent = `${fmt(c.lo)} a ${fmt(c.hi)}`;
  $('#faixa').textContent = 'pessoas';

  const total = dados.populacao.total;
  $('#percentual').textContent = total
    ? `${pct(c.lo / total, 2)} a ${pct(c.hi / total, 2)} da população do Distrito Federal (${fmt(total)} habitantes)`
    : '';

  const fator = dados.populacao.escala_2026?.fator;
  const escala = c.escala ? `escala 2026 aplicada (fator ${String(fator).replace('.', ',')})` : 'sem escala 2026';
  const quem = estado.sexo === 'ambos' ? 'pessoas' : estado.sexo;
  $('#base-info').textContent = `Base antes dos filtros: ${fmt(c.base)} ${quem}, ${estado.idadeMin} a ${estado.idadeMax} anos — ${escala}.`;
  $('#aviso').textContent = avisoTexto();

  const meio = (passo) => (passo.lo + passo.hi) / 2;

  desenhar(
    '#grafico-etapas',
    'População restante por etapa',
    c.passos.map((passo) => passo.rotulo),
    c.passos.map((passo) => Math.round(meio(passo))),
  );

  const labels = [];
  const removidos = [];
  for (let i = 1; i < c.passos.length; i += 1) {
    labels.push(c.passos[i].rotulo);
    removidos.push(Math.max(0, Math.round(meio(c.passos[i - 1]) - meio(c.passos[i]))));
  }
  desenhar('#grafico-impacto', 'Removidos por filtro', labels, removidos);
}

function atualizar() {
  sincronizar();
  const c = calcular();
  render(c);

  const mid = (c.lo + c.hi) / 2;
  if (rotuloDelta && midAnterior !== null && Number.isFinite(mid)) {
    const diferenca = midAnterior - mid;
    const verbo = diferenca >= 0 ? 'removeu' : 'acrescentou';
    $('#delta').textContent = `${rotuloDelta}: ${verbo} ${fmt(Math.abs(diferenca))} pessoas nesta etapa.`;
  }
  midAnterior = mid;
  rotuloDelta = null;
  salvarURL();
}

// ---------- URL ----------

function salvarURL() {
  const params = new URLSearchParams();
  params.set('sexo', estado.sexo);
  params.set('idade_min', String(estado.idadeMin));
  params.set('idade_max', String(estado.idadeMax));
  params.set('exigir', [...estado.exigir].filter((id) => porId.has(id)).join(','));
  params.set('excluir', [...estado.excluir].filter((id) => porId.has(id)).join(','));
  params.set('escala', estado.escala ? '1' : '0');
  params.set('renda_piso', String(estado.rendaPiso));
  if (estado.rendaTeto !== null) params.set('renda_teto', String(estado.rendaTeto));
  params.set('ras', [...estado.ras].join(','));
  history.replaceState(null, '', `?${params.toString()}`);
}

function aplicarURL() {
  const params = new URLSearchParams(location.search);

  const sexo = params.get('sexo');
  if (SEXOS.includes(sexo)) estado.sexo = sexo;

  const idadeMin = inteiro(params.get('idade_min'), IDADE_UI.min, IDADE_UI.max);
  const idadeMax = inteiro(params.get('idade_max'), IDADE_UI.min, IDADE_UI.max);
  if (idadeMin !== null) estado.idadeMin = idadeMin;
  if (idadeMax !== null) estado.idadeMax = idadeMax;
  if (estado.idadeMin > estado.idadeMax) estado.idadeMin = estado.idadeMax;

  const lerIds = (chave) => (params.get(chave) ?? '').split(',').map((id) => id.trim()).filter((id) => porId.has(id));
  if (params.has('exigir') || params.has('excluir')) {
    const exigir = new Set(lerIds('exigir'));
    estado.exigir = exigir;
    estado.excluir = new Set(lerIds('excluir').filter((id) => !exigir.has(id)));
  }

  const escala = params.get('escala');
  if (escala === '0' || escala === '1') estado.escala = escala === '1';

  const rendaPiso = inteiro(params.get('renda_piso'), 0, Number.MAX_SAFE_INTEGER);
  if (rendaPiso !== null) estado.rendaPiso = rendaPiso;
  const rendaTeto = params.has('renda_teto') ? inteiro(params.get('renda_teto'), 0, Number.MAX_SAFE_INTEGER) : null;
  if (rendaTeto !== null) {
    estado.rendaTeto = Math.max(estado.rendaPiso, rendaTeto);
    estado.rendaSemTeto = false;
  } else {
    estado.rendaTeto = null;
    estado.rendaSemTeto = true;
  }

  if (params.has('ras')) {
    const validas = (params.get('ras') ?? '').split(',').map((id) => id.trim()).filter(Boolean);
    estado.ras = new Set(validas.filter((id) => (dados.ra.ras ?? []).some((ra) => ra.id === id)));
  }
}

// ---------- preset ----------

function aplicarPreset() {
  estado.sexo = 'mulheres';
  estado.idadeMin = 25;
  estado.idadeMax = 29;
  estado.escala = true;
  estado.rendaPiso = 0;
  estado.rendaSemTeto = true;
  estado.rendaTeto = null;
  estado.ras = new Set((dados.ra.ras ?? []).map((ra) => ra.id));
  estado.exigir = new Set(PRESET_EXIGIR);
  estado.excluir = new Set(PRESET_EXCLUIR);
  rotuloDelta = null;
}

// ---------- eventos ----------

function ligarEventos() {
  refs.rendaPiso = $('#renda-piso');
  refs.rendaTeto = $('#renda-teto');
  refs.rendaSemTeto = $('#renda-sem-teto');

  $('#botao-preset').addEventListener('click', () => {
    aplicarPreset();
    atualizar();
  });

  document.querySelectorAll('input[name="sexo"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      estado.sexo = radio.value;
      atualizar();
    });
  });

  refs.escala.addEventListener('change', () => {
    estado.escala = refs.escala.checked;
    atualizar();
  });

  $('#idade-min').addEventListener('input', () => {
    estado.idadeMin = Number($('#idade-min').value);
    if (estado.idadeMin > estado.idadeMax) estado.idadeMax = estado.idadeMin;
    atualizar();
  });

  $('#idade-max').addEventListener('input', () => {
    estado.idadeMax = Number($('#idade-max').value);
    if (estado.idadeMax < estado.idadeMin) estado.idadeMin = estado.idadeMax;
    atualizar();
  });

  document.querySelectorAll('[data-idade]').forEach((botao) => {
    botao.addEventListener('click', () => {
      const [min, max] = botao.dataset.idade.split('-').map((valor) => Number(valor));
      if (!Number.isFinite(min) || !Number.isFinite(max)) return;
      estado.idadeMin = min;
      estado.idadeMax = max;
      atualizar();
    });
  });

  refs.rendaPiso.addEventListener('input', () => {
    estado.rendaPiso = Math.max(0, Number(refs.rendaPiso.value) || 0);
    if (estado.rendaTeto !== null) estado.rendaTeto = Math.max(estado.rendaTeto, estado.rendaPiso);
    rotuloDelta = 'Faixa de renda';
    atualizar();
  });

  refs.rendaTeto.addEventListener('input', () => {
    const teto = inteiro(refs.rendaTeto.value, 0, Number.MAX_SAFE_INTEGER);
    estado.rendaTeto = teto === null ? null : Math.max(teto, estado.rendaPiso);
    rotuloDelta = 'Faixa de renda';
    atualizar();
  });

  refs.rendaSemTeto.addEventListener('change', () => {
    estado.rendaSemTeto = refs.rendaSemTeto.checked;
    if (estado.rendaSemTeto) estado.rendaTeto = null;
    rotuloDelta = 'Faixa de renda';
    atualizar();
  });

  $('#ras').addEventListener('change', (evento) => {
    const alvo = evento.target;
    if (alvo === refs.raTodas) {
      estado.ras = alvo.checked ? new Set((dados.ra.ras ?? []).map((ra) => ra.id)) : new Set();
    } else if (alvo.dataset?.ra) {
      if (alvo.checked) estado.ras.add(alvo.dataset.ra);
      else estado.ras.delete(alvo.dataset.ra);
    } else {
      return;
    }
    atualizar();
  });

  $('#filtros').addEventListener('change', (evento) => {
    const alvo = evento.target;
    if (alvo.name === 'ist-cenario') {
      definirCenario(alvo.value);
      rotuloDelta = 'Cenário de IST';
      atualizar();
      return;
    }
    const id = alvo.dataset?.filtro;
    if (!id) return;
    aplicarOperacao(id, alvo.value);
    rotuloDelta = porId.get(id)?.rotulo ?? id;
    atualizar();
  });
}

iniciar();
