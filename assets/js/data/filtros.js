/**
 * filtros.js — Configuração dos filtros da calculadora demográfica DF.
 * Tipos permitidos: range | select | multi | toggle | tri-state.
 * rateKey aponta o bloco correspondente em window.TAXAS.
 * probKey: caminho no TAXAS; sufixo ":<índice|id>" = coluna/linha da margem
 * da faixa de idade corrente (tratamento por tipo é do motor).
 */
(function () {
  'use strict';

  var CATEGORIAS = ['Demografia & Compatibilidade', 'Socioeconômico', 'Físico & Estilo de Vida', 'Comportamental'];

  var TODAS_RENDA = ['ate1', '1a2', '2a5', '5a10', '10a20', '20mais'];
  var TODAS_CIVIL = ['solteiro', 'namorando', 'casadoUniao', 'divorciado', 'viuvo'];
  var TODAS_ESCOLA = ['fundamental', 'medio', 'superiorIncompleto', 'superior', 'pos'];
  var TODAS_RELIGIAO = ['catolica', 'evangelica', 'espirita', 'semReligiao', 'matrizAfricana', 'outras'];

  // Labels curtos para a sidebar (taxas.js mantém os completos p/ metodologia).
  var LABELS_RENDA = {
    'ate1': 'Até 1 SM', '1a2': '1–2 SM', '2a5': '2–5 SM',
    '5a10': '5–10 SM', '10a20': '10–20 SM', '20mais': '20+ SM'
  };
  var LABELS_ESCOLA = {
    'fundamental': 'Fundamental', 'medio': 'Médio', 'superiorIncompleto': 'Superior incompl.',
    'superior': 'Superior', 'pos': 'Pós'
  };
  var LABELS_CIVIL = {
    'solteiro': 'Solteiro(a)', 'namorando': 'Namorando', 'casadoUniao': 'Casado/união',
    'divorciado': 'Divorciado(a)', 'viuvo': 'Viúvo(a)'
  };

  function opcaoRenda(idx) {
    var f = window.TAXAS.rendaFaixas[idx];
    return { value: f.id, label: LABELS_RENDA[f.id] || f.label, probKey: 'rendaPorIdade:' + idx };
  }
  function opcaoEscola(idx) {
    var f = window.TAXAS.escolaridadeFaixas[idx];
    return { value: f.id, label: LABELS_ESCOLA[f.id] || f.label, probKey: 'escolaridadePorIdade:' + idx };
  }
  function opcaoCivil(id) {
    var f = window.TAXAS.estadoCivilFaixas.filter(function (x) { return x.id === id; })[0];
    return { value: f.id, label: LABELS_CIVIL[f.id] || f.label, probKey: 'estadoCivilPorIdade:' + id };
  }
  function opcaoReligiao(id, label) {
    return { value: id, label: label, probKey: 'religiaoDF.' + id };
  }
  function opcoesTri(probKey, rotulos) {
    return [
      { value: 'sim', label: rotulos[0], probKey: probKey },
      { value: 'nao', label: rotulos[1], probKey: probKey + ':complemento' },
      { value: 'indiferente', label: 'Tanto faz', probKey: null }
    ];
  }

  window.FILTERS_CONFIG = [
    {
      id: 'modoCalculo',
      label: 'Modo de cálculo',
      category: 'Demografia & Compatibilidade',
      type: 'select',
      structural: true,
      options: [
        { value: 'correlacionado', label: 'Correlacionado (matrizes)', probKey: null },
        { value: 'independente', label: 'Independente (produto)', probKey: null }
      ],
      defaultValue: 'correlacionado',
      source: 'Premissa metodológica do modelo',
      methodologyNote: 'Correlacionado (padrão): matrizes idade×renda, idade×estado civil×filhos, RA×renda×escolaridade, renda×escolaridade e renda×raça. Independente: produto das marginais, como se as variáveis não covariassem. Não é teto: dependendo da seleção, pode inflar ou reduzir o total. A realidade está entre os dois.',
      confianca: 'B',
      ajuda: 'Compare os dois modos. Correlacionado é o mais realista; independente serve como contraste metodológico.'
    },
    {
      id: 'generoUsuario',
      label: 'Meu gênero',
      category: 'Demografia & Compatibilidade',
      type: 'select',
      options: [
        { value: 'M', label: 'Homem', probKey: null },
        { value: 'F', label: 'Mulher', probKey: null }
      ],
      source: 'Definição do modelo',
      methodologyNote: 'Seletor do usuário; define sexo do alvo padrão e chaves por sexo em TAXAS (orientacao, fumante, altura etc.).',
      defaultValue: 'M',
      confianca: 'A',
      ajuda: 'Usado só para indexar as taxas por sexo; não entra como probabilidade.'
    },
    {
      id: 'generoBuscado',
      label: 'Busco',
      category: 'Demografia & Compatibilidade',
      type: 'select',
      options: [
        { value: 'M', label: 'Homens', probKey: null },
        { value: 'F', label: 'Mulheres', probKey: null },
        { value: 'ambos', label: 'Ambos', probKey: null }
      ],
      source: 'Censo 2022 — SIDRA 9514 (razão sexual por idade)',
      methodologyNote: 'Recorte da pirâmide etária (DATA_POPULACAO). "ambos" soma os dois sexos.',
      defaultValue: 'ambos',
      confianca: 'A',
      ajuda: 'Determina qual lado da pirâmide etária é contado.'
    },
    {
      id: 'orientacaoAlvo',
      label: 'Orientação',
      category: 'Demografia & Compatibilidade',
      type: 'select',
      options: [
        { value: 'auto', label: 'Auto (compatível)', probKey: null },
        { value: 'manual', label: 'Manual', probKey: null }
      ],
      multiOptions: [
        { value: 'hetero', label: 'Heterossexual', probKey: 'orientacao.porSexo.{sexo}.hetero' },
        { value: 'homo', label: 'Homossexual', probKey: 'orientacao.porSexo.{sexo}.homo' },
        { value: 'bi', label: 'Bissexual', probKey: 'orientacao.porSexo.{sexo}.bi' }
      ],
      rateKey: 'orientacao',
      source: 'PNS 2019 / premissa',
      methodologyNote: 'Modo auto: mantém só a orientação compatível com generoBuscado e o sexo efetivo do alvo (TAXAS.orientacao.porSexo). Modo manual: usa multiOptions, com {sexo} resolvido pelo motor.',
      defaultValue: 'auto',
      confianca: 'B',
      ajuda: 'Em modo manual, marque quais orientações entram no funil (usa as opções multiescolhíveis acima).'
    },
    {
      id: 'idade',
      label: 'Idade',
      category: 'Demografia & Compatibilidade',
      type: 'range',
      min: 18,
      max: 80,
      step: 1,
      source: 'Censo 2022 — SIDRA 9514 (escala 2026)',
      methodologyNote: 'Contagem direta da pirâmide por idade (DATA_POPULACAO.idades), sem taxa envolvida.',
      defaultValue: [18, 80],
      confianca: 'A',
      ajuda: 'A pirâmide só existe de 18 a 100; abaixo de 18 o funil é nulo por definição do produto.'
    },
    {
      id: 'altura',
      label: 'Altura do alvo (cm)',
      category: 'Físico & Estilo de Vida',
      type: 'range',
      min: 140,
      max: 210,
      step: 1,
      rateKey: 'altura',
      source: 'IBGE — antropometria inquirida (aproximação normal)',
      methodologyNote: 'Normal truncada por sexo (TAXAS.altura). Probabilidade = massa entre os dois limites. Refere-se ao alvo, não ao usuário.',
      defaultValue: [140, 210],
      confianca: 'B',
      ajuda: 'Altura da pessoa buscada, não a sua. 178–186 cm entre mulheres é ~0,4% (cauda alta).'
    },
    {
      id: 'rendaEscopo',
      label: 'Base da renda',
      category: 'Socioeconômico',
      type: 'select',
      structural: true,
      options: [
        { value: 'familiar', label: 'Familiar total', probKey: null },
        { value: 'perCapita', label: 'Per capita', probKey: null }
      ],
      defaultValue: 'familiar',
      source: 'PDAD 2024 (IPEDF) / PNAD Contínua',
      methodologyNote: 'Familiar total = soma da renda mensal de todos os moradores (inclui pais/cônjuge). Per capita = renda domiciliar dividida pelo número de moradores. O motor troca a tabela de probabilidades; não soma as duas.',
      confianca: 'B',
      ajuda: 'Use "Familiar total" se a renda vem da família; "Per capita" para comparação por pessoa.'
    },
    {
      id: 'renda',
      label: 'Renda familiar (SM)',
      category: 'Socioeconômico',
      type: 'multi',
      options: TODAS_RENDA.map(function (id, idx) { return opcaoRenda(idx); }),
      rateKey: 'rendaPorIdade',
      source: 'PDAD Contínua 2024 / PNAD Contínua DF',
      methodologyNote: 'Base escolhida em "Base da renda": familiar total usa TAXAS.rendaFamiliarPorIdade; per capita usa TAXAS.rendaPorIdade. O motor troca a tabela (probKey dos itens é a margem per capita). Independência entre renda e demais filtros é premissa do modelo.',
      defaultValue: TODAS_RENDA.slice(),
      confianca: 'B',
      ajuda: 'Renda declarada em SM; as 6 faixas somam 1 dentro de cada idade. Troque a base em "Base da renda".'
    },
    {
      id: 'relacionamento',
      label: 'Relacionamento',
      category: 'Demografia & Compatibilidade',
      type: 'multi',
      options: TODAS_CIVIL.map(function (id) { return opcaoCivil(id); }),
      rateKey: 'estadoCivilPorIdade',
      source: 'Censo 2022 — SIDRA 10185 + PDAD',
      methodologyNote: 'Margem por faixa etária em TAXAS.estadoCivilPorIdade; probKey usa id da coluna. "Namorando" não existe no Censo — premissa C documentada em TAXAS.',
      defaultValue: TODAS_CIVIL.slice(),
      confianca: 'B',
      ajuda: 'Para excluir quem vive em união, marque solteiro + namorando + divorciado + viúvo.'
    },
    {
      id: 'filhos',
      label: 'Filhos',
      category: 'Demografia & Compatibilidade',
      type: 'tri-state',
      options: opcoesTri('filhosPorIdade.p', ['Tem', 'Não tem']),
      rateKey: 'filhosPorIdade',
      source: 'Censo 2022 — SIDRA 10075',
      methodologyNote: 'P(tem filhos) por idade em TAXAS.filhosPorIdade; sim = p, não = 1−p. Condicional com estado civil em TAXAS.estadoCivilFilhos quando ambos filtram.',
      defaultValue: 'indiferente',
      confianca: 'B',
      ajuda: 'Base feminina no Censo (filhos tidos); para homens é limite inferior.'
    },
    {
      id: 'escolaridade',
      label: 'Escolaridade',
      category: 'Socioeconômico',
      type: 'multi',
      options: TODAS_ESCOLA.map(function (id, idx) { return opcaoEscola(idx); }),
      rateKey: 'escolaridadePorIdade',
      source: 'Censo 2022 — SIDRA 10061',
      methodologyNote: 'Margem por idade em TAXAS.escolaridadePorIdade; probKey usa índice da coluna (5 níveis). Correlação renda×escolaridade vem de TAXAS.rendaEduBase quando ambos filtram.',
      defaultValue: TODAS_ESCOLA.slice(),
      confianca: 'B',
      ajuda: 'Ex.: "superior completo ou mais" = marcar superior + pós.'
    },
    {
      id: 'religiao',
      label: 'Religião',
      category: 'Demografia & Compatibilidade',
      type: 'multi',
      options: [
        opcaoReligiao('catolica', 'Católica'),
        opcaoReligiao('evangelica', 'Evangélica'),
        opcaoReligiao('espirita', 'Espírita'),
        opcaoReligiao('semReligiao', 'Sem religião'),
        opcaoReligiao('matrizAfricana', 'Africana'),
        opcaoReligiao('outras', 'Outras')
      ],
      rateKey: 'religiaoDF',
      source: 'Censo 2022 — SIDRA 2056 (IBGE)',
      methodologyNote: 'Margem única do DF (sem corte etário público) em TAXAS.religiaoDF; probKey = caminho direto no bloco.',
      defaultValue: TODAS_RELIGIAO.slice(),
      confianca: 'B',
      ajuda: 'Aplicada igual para todas as idades; limitação registrada no bloco TAXAS.'
    },
    {
      id: 'raca',
      label: 'Cor/raça',
      category: 'Demografia & Compatibilidade',
      type: 'multi',
      // probKey null de propósito: sem caminho resolvido; o motor trata o rateKey
      // 'racaPorRenda' de forma especial (P(raça | renda, sexo)). A chave existe só
      // para satisfazer o contrato de formato de opções (test-dados.mjs).
      options: [
        { value: 'branca', label: 'Branca', probKey: null },
        { value: 'parda', label: 'Parda', probKey: null },
        { value: 'preta', label: 'Negra', probKey: null },
        { value: 'amarela', label: 'Amarela', probKey: null },
        { value: 'indigena', label: 'Indígena', probKey: null },
        { value: 'outros', label: 'Outros', probKey: null }
      ],
      rateKey: 'racaPorRenda',
      source: 'PDAD 2024 / Censo 2022 / PNAD Contínua',
      methodologyNote: 'Autodeclaração. Probabilidade condicionada à renda e ao sexo: pretas/pardas concentram-se nas faixas baixas; brancas nas altas. Não é distribuição uniforme. Com renda ativa, o motor usa P(raça | renda selecionada); sem renda, usa a marginal ponderada pela distribuição etária de renda.',
      defaultValue: ['branca', 'parda', 'preta', 'amarela', 'indigena', 'outros'],
      confianca: 'B',
      ajuda: 'Marcar tudo = indiferente. Excluir "Negra" derruba mais candidatos quando a renda está limitada às faixas baixas.'
    },
    {
      id: 'fumante',
      label: 'Fumante',
      category: 'Físico & Estilo de Vida',
      type: 'tri-state',
      options: opcoesTri('fumante.{sexo}.p', ['Sim', 'Não']),
      rateKey: 'fumante',
      source: 'Vigitel 2023 — Ministério da Saúde (Brasília)',
      methodologyNote: 'p por sexo em TAXAS.fumante; sim = p, não = 1−p.',
      defaultValue: 'indiferente',
      confianca: 'B',
      ajuda: 'Fumante corrente (Vigitel), qualquer frequência.'
    },
    {
      id: 'obesidade',
      label: 'IMC ≥ 30',
      category: 'Físico & Estilo de Vida',
      type: 'tri-state',
      options: opcoesTri('obesidade.{sexo}.p', ['Sim', 'Não']),
      rateKey: 'obesidade',
      source: 'Vigitel — Ministério da Saúde (IMC auto-relatado)',
      methodologyNote: 'p por sexo em TAXAS.obesidade; sim = p, não = 1−p. Auto-relato subestima obesidade ⇒ p real pode ser maior que max.',
      defaultValue: 'indiferente',
      confianca: 'B',
      ajuda: 'Recorte jovem da série anterior (mulheres 0,10–0,14).'
    },
    {
      id: 'antecedentes',
      label: 'Antecedentes',
      category: 'Comportamental',
      type: 'tri-state',
      options: opcoesTri('antecedentes.porIdade:{faixa}.p', ['Sim', 'Não']),
      rateKey: 'antecedentes',
      source: 'Infopen / FBSP (proxy nacional)',
      methodologyNote: 'p por idade em TAXAS.antecedentes; proxy de encarceramento — sem registro público por RA ⇒ confiança C, faixa ±20%.',
      defaultValue: 'indiferente',
      confianca: 'C',
      ajuda: 'Onde "antecedentes" = condenação transitada em julgado; inquéritos não entram.'
    },
    {
      id: 'istCenario',
      label: 'Cenário de IST',
      category: 'Comportamental',
      type: 'select',
      structural: true,
      options: [
        { value: 'c2', label: 'C2 — qualquer IST', probKey: null },
        { value: 'c1', label: 'C1 — só crônicas', probKey: null }
      ],
      defaultValue: 'c2',
      source: 'Ministério da Saúde / SES-DF — POP-Brasil, ONDA e boletins epidemiológicos',
      methodologyNote: 'C2 inclui HPV e herpes: prevalência alta (~38–52% por faixa etária, POP-Brasil). C1 restringe a IST crônicas/sistêmicas (HIV, hepatites B/C, sífilis ativa): ~2% (1,5–3%). O seletor troca a tabela usada pelo filtro IST; não soma probabilidades.',
      confianca: 'B',
      ajuda: 'C1 é o recorte do estudo consolidado; C2 é o mais amplo e inclui HPV/herpes.'
    },
    {
      id: 'ist',
      label: 'IST diagnosticada',
      category: 'Comportamental',
      type: 'tri-state',
      options: opcoesTri('ist.porIdade:{faixa}.p', ['Sim', 'Não']),
      rateKey: 'ist',
      source: 'POP-Brasil / estimativas ONDA — Ministério da Saúde',
      methodologyNote: 'Cenário escolhido em Cenário de IST (C1/C2). C2 = qualquer IST (TAXAS.ist); C1 = só crônicas: HIV, hepatites B/C, sífilis ativa (TAXAS.istC1). O seletor troca a tabela; não soma probabilidades.',
      defaultValue: 'indiferente',
      confianca: 'B',
      ajuda: 'Use o seletor "Cenário de IST" para alternar C1/C2.'
    },
    {
      id: 'infidelidade',
      label: 'Já traiu?',
      category: 'Comportamental',
      type: 'tri-state',
      options: opcoesTri('infidelidade.{sexo}.p', ['Sim', 'Não']),
      rateKey: 'infidelidade',
      source: 'Estudo Mosaico 2.0',
      methodologyNote: 'p por sexo em TAXAS.infidelidade (valores do estudo anterior: H 0,505 / M 0,302), faixa alargada ±15%. Autodeclaração.',
      defaultValue: 'indiferente',
      confianca: 'B',
      ajuda: 'Histórico, não intenção futura; ler como proxy, com nota de viés no relatório.'
    },
    {
      id: 'aparencia',
      label: 'Nota de aparência',
      category: 'Físico & Estilo de Vida',
      type: 'toggle',
      rateKey: 'aparencia',
      notaMinima: { valor: 6, min: 1, max: 10, step: 1 },
      source: 'Premissa interna (escala 1–10)',
      methodologyNote: 'Normal truncada em TAXAS.aparencia (mu=5, sd=1,5); toggle ativo aplica P(nota ≥ notaMinima.valor). Sem base empírica — manter peso baixo.',
      defaultValue: false,
      confianca: 'C',
      ajuda: 'Construto subjetivo do próprio modelo; usar com consciência da limitação §5 do estudo.'
    }
  ];
})();
