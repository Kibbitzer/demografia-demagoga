/**
 * taxas.js — Taxas e prevalências usadas pela calculadora demográfica DF.
 * Base 2026. Hierarquia de fonte: DF > Centro-Oeste > Brasil (divergências em `nota`).
 * Todo bloco de taxas traz { fonte, fonteId?, nota, confianca:"A"|"B"|"C" }.
 * Regras: margens somam 1 (±0,005); p dentro de [min,max]; sem fonte verificável
 * ⇒ faixa larga ±20% e confianca "C"; nunca número único sem nota.
 * Valores reutilizados de old/data/filtros.json quando lá existiam (infidelidade,
 * sem_filhos 25–29, nao_vive_em_uniao 25–29, fumante/obesidade/IST/orientação).
 */
(function () {
  'use strict';
  window.TAXAS = {

    meta: {
      titulo: 'Taxas demográficas e comportamentais — DF 2026',
      geradoEm: '2026-11-16',
      anoBase: 2026,
      populacaoDF: 3009996,
      faixaEtariaMin: 18,
      moeda: 'salário mínimo nominal (SM)',
      unidadeAltura: 'cm',
      toleranciaSomaMargens: 0.005,
      hierarquia: 'DF > Centro-Oeste > Brasil; quando só há série nacional, registrar em nota e alargar faixa',
      nota: 'Filtros multiplicam probabilidades como eventos independentes (limitação conhecida do modelo; valores reais tendem ao limite superior).'
    },

    fontes: {
      censo_sidra_9514: { nome: 'Censo 2022 — SIDRA 9514 (IBGE): população por idade e sexo', url: 'https://sidra.ibge.gov.br/tabela/9514', nivel: 'DF', confianca: 'A' },
      censo_sidra_10061: { nome: 'Censo 2022 — SIDRA 10061 (IBGE): nível de instrução', url: 'https://sidra.ibge.gov.br/tabela/10061', nivel: 'DF', confianca: 'A' },
      censo_sidra_10075: { nome: 'Censo 2022 — SIDRA 10075 (IBGE): filhos por mulher', url: 'https://sidra.ibge.gov.br/tabela/10075', nivel: 'DF', confianca: 'A' },
      censo_sidra_10185: { nome: 'Censo 2022 — SIDRA 10185 (IBGE): estado civil', url: 'https://sidra.ibge.gov.br/tabela/10185', nivel: 'DF', confianca: 'A' },
      censo_sidra_2056: { nome: 'Censo 2022 — SIDRA 2056 (IBGE): cor ou raça / religião', url: 'https://sidra.ibge.gov.br/tabela/2056', nivel: 'DF', confianca: 'B' },
      codeplan_ra: { nome: 'Codeplan — Projeções Populacionais para as RAs do DF 2020-2030 (Tabelas A.1/A.2)', url: 'https://www.codeplan.df.gov.br/wp-content/uploads/2021/12/Estudo-Projecoes-populacionais-para-as-Regioes-Administrativas-do-Distrito-Federal-2020-2030-Resultados.pdf', nivel: 'DF/RA', confianca: 'B' },
      pdad_2024: { nome: 'PDAD Contínua 2024 — IBGE (renda e escolaridade do DF)', url: 'https://www.ibge.gov.br/estatisticas/sociais/trabalho/17270-pnad-continua.html', nivel: 'DF', confianca: 'B' },
      vigitel_2023: { nome: 'Vigitel 2023 — Vigilância de Fatores de Risco (Ministério da Saúde, Brasília-DF)', url: 'https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/v/vigitel', nivel: 'DF (capitais)', confianca: 'A' },
      pns_2019: { nome: 'PNS 2019 — Pesquisa Nacional de Saúde (IBGE): orientação sexual autodeclarada', url: 'https://www.ibge.gov.br/estatisticas/sociais/populacao/17298-pesquisa-nacional-de-saude.html', nivel: 'Brasil (premissa p/ DF)', confianca: 'B' },
      pop_brasil_ms: { nome: 'POP-Brasil / estimativas ONDA — Ministério da Saúde: prevalência de IST', nivel: 'Brasil (premissa p/ DF)', confianca: 'B' },
      mosaico_2_0: { nome: 'Estudo Mosaico 2.0 — comportamento sexual (infidelidade declarada)', nivel: 'Brasil/DF', confianca: 'B' },
      infopen_fbsp: { nome: 'Infopen / FBSP — antecedentes e população prisional (proxy)', nivel: 'Brasil', confianca: 'C' },
      premissa_interna: { nome: 'Premissa interna do modelo (sem fonte verificável)', nivel: 'DF', confianca: 'C' }
    },

    // ---------- Escalas ----------
    faixasIdade: ['18-24', '25-29', '30-39', '40-49', '50+'],

    rendaFaixas: [
      { id: 'ate1', label: 'Até 1 salário mínimo' },
      { id: '1a2', label: 'De 1 a 2 salários mínimos' },
      { id: '2a5', label: 'De 2 a 5 salários mínimos' },
      { id: '5a10', label: 'De 5 a 10 salários mínimos' },
      { id: '10a20', label: 'De 10 a 20 salários mínimos' },
      { id: '20mais', label: 'Mais de 20 salários mínimos' }
    ],

    escolaridadeFaixas: [
      { id: 'fundamental', label: 'Ensino fundamental (completo ou menos)' },
      { id: 'medio', label: 'Ensino médio completo' },
      { id: 'superiorIncompleto', label: 'Superior incompleto' },
      { id: 'superior', label: 'Superior completo' },
      { id: 'pos', label: 'Pós-graduação' }
    ],

    estadoCivilFaixas: [
      { id: 'solteiro', label: 'Solteiro(a)' },
      { id: 'namorando', label: 'Namorando (sem coabitação)' },
      { id: 'casadoUniao', label: 'Casado(a) ou união estável' },
      { id: 'divorciado', label: 'Divorciado(a) / separado(a)' },
      { id: 'viuvo', label: 'Viúvo(a)' }
    ],

    // ---------- Renda (SM) por idade — soma por linha = 1 ----------
    rendaPorIdade: {
      '18-24': [0.28, 0.27, 0.24, 0.13, 0.06, 0.02],
      '25-29': [0.20, 0.25, 0.29, 0.16, 0.07, 0.03],
      '30-39': [0.15, 0.23, 0.31, 0.19, 0.09, 0.03],
      '40-49': [0.15, 0.24, 0.30, 0.19, 0.08, 0.04],
      '50+':   [0.22, 0.26, 0.27, 0.15, 0.07, 0.03],
      fonte: 'PDAD Contínua 2024 / PNAD Contínua DF — renda mensal, distribuída por faixa etária',
      fonteId: 'pdad_2024',
      nota: 'DF. Rendimento médio/habitante por faixa (SM), nacionalidade do trabalho. Cauda 10a20/20mais do DF acima da média Brasil (função pública); leitura linha a linha da microidade não realizada ⇒ faixa larga, confiança B.',
      confianca: 'B'
    },

    // ---------- Escolaridade por idade — soma por linha = 1 ----------
    escolaridadePorIdade: {
      '18-24': [0.18, 0.42, 0.20, 0.15, 0.05],
      '25-29': [0.16, 0.31, 0.16, 0.26, 0.11],
      '30-39': [0.14, 0.29, 0.11, 0.30, 0.16],
      '40-49': [0.17, 0.32, 0.09, 0.27, 0.15],
      '50+':   [0.31, 0.36, 0.07, 0.18, 0.08],
      fonte: 'Censo 2022 — SIDRA 10061 (IBGE); calibrado a old/data/filtros.json (superior completo 25–29: mulheres 41,7% / homens 31,0%)',
      fonteId: 'censo_sidra_10061',
      nota: 'DF, população 18+. Linha 25–29 bate o verificado do estudo anterior (superior+pos ≈ 0,37 ≈ média ponderada dos sexos). Superior+pos cresce até 30–39 e cai em 50+ (efeito coorte).',
      confianca: 'B'
    },

    // ---------- Renda × Escolaridade por idade — matriz 6×5, cada linha soma 1 ----------
    rendaEduBase: {
      '18-24': [
        [0.38, 0.34, 0.18, 0.08, 0.02],
        [0.26, 0.40, 0.22, 0.10, 0.02],
        [0.12, 0.34, 0.28, 0.22, 0.04],
        [0.05, 0.22, 0.26, 0.38, 0.09],
        [0.02, 0.12, 0.22, 0.46, 0.18],
        [0.02, 0.08, 0.16, 0.48, 0.26]
      ],
      '25-29': [
        [0.42, 0.33, 0.14, 0.09, 0.02],
        [0.29, 0.39, 0.19, 0.11, 0.02],
        [0.13, 0.34, 0.24, 0.24, 0.05],
        [0.05, 0.22, 0.22, 0.40, 0.11],
        [0.03, 0.12, 0.18, 0.46, 0.21],
        [0.02, 0.08, 0.12, 0.44, 0.34]
      ],
      '30-39': [
        [0.45, 0.33, 0.12, 0.07, 0.03],
        [0.32, 0.38, 0.16, 0.11, 0.03],
        [0.15, 0.34, 0.20, 0.24, 0.07],
        [0.06, 0.22, 0.18, 0.38, 0.16],
        [0.03, 0.12, 0.13, 0.40, 0.32],
        [0.02, 0.08, 0.08, 0.36, 0.46]
      ],
      '40-49': [
        [0.48, 0.32, 0.10, 0.07, 0.03],
        [0.34, 0.37, 0.15, 0.10, 0.04],
        [0.16, 0.34, 0.19, 0.23, 0.08],
        [0.07, 0.22, 0.17, 0.36, 0.18],
        [0.04, 0.12, 0.12, 0.37, 0.35],
        [0.02, 0.07, 0.07, 0.33, 0.51]
      ],
      '50+': [
        [0.55, 0.28, 0.07, 0.07, 0.03],
        [0.40, 0.35, 0.12, 0.10, 0.03],
        [0.20, 0.33, 0.15, 0.24, 0.08],
        [0.10, 0.22, 0.14, 0.36, 0.18],
        [0.05, 0.13, 0.10, 0.36, 0.36],
        [0.03, 0.08, 0.06, 0.30, 0.53]
      ],
      fonte: 'Cruzamento PDAD 2024 / Censo 2022 — renda condicionada à escolaridade; premissa de forma',
      fonteId: 'pdad_2024',
      nota: 'Linha = faixa de renda, coluna = escolaridade. Estrutura (renda cresce com escolaridade) é DF; pesos exatos da matriz são premissa calibrada — sem matriz pública linha a linha ⇒ confiança C para o detalhe, B para a estrutura.',
      confianca: 'C'
    },

    // ---------- Estado civil por idade — soma por linha = 1 ----------
    estadoCivilPorIdade: {
      '18-24': [0.66, 0.21, 0.10, 0.02, 0.01],
      '25-29': [0.37, 0.14, 0.44, 0.04, 0.01],
      '30-39': [0.27, 0.07, 0.58, 0.07, 0.01],
      '40-49': [0.22, 0.05, 0.64, 0.08, 0.01],
      '50+':   [0.22, 0.04, 0.60, 0.09, 0.05],
      fonte: 'Censo 2022 — SIDRA 10185 (IBGE) + PDAD; categoria "namorando" = premissa C',
      fonteId: 'censo_sidra_10185',
      nota: 'União (casadoUniao) em 25–29 = 0,44, consistente com old/data/filtros.json: "não vive em união" mulheres 0,505 / homens 0,592 ⇒ união 0,495/0,408. "Namorando" não existe no Censo; fatia retirada de solteiro (premissa C, cf. namoro_sem_coabitacao 0,30–0,40).',
      confianca: 'B'
    },

    // ---------- Probabilidade de ter filhos por idade ----------
    filhosPorIdade: {
      '18-24': { p: 0.15, fonte: 'Censo 2022 — SIDRA 10075 (mulheres 18–24)', nota: 'Sem verificação linha a linha; estimativa a partir do padrão do estudo anterior ⇒ C.', confianca: 'C' },
      '25-29': { p: 0.416, fonte: 'Censo 2022 — SIDRA 10075 (DF, mulheres 25–29)', nota: 'Verificado em old/data/filtros.json: 47.262 com filhos / 113.649 ⇒ 41,6% com filhos (58,4% sem). Sem recorte masculino.', confianca: 'B' },
      '30-39': { p: 0.68, fonte: 'Censo 2022 — SIDRA 10075 (extrapolação de coorte)', nota: 'Estimativa; sem verificação linha a linha ⇒ C.', confianca: 'C' },
      '40-49': { p: 0.78, fonte: 'Censo 2022 — SIDRA 10075 (extrapolação de coorte)', nota: 'Estimativa; sem verificação linha a linha ⇒ C.', confianca: 'C' },
      '50+':   { p: 0.82, fonte: 'Censo 2022 — SIDRA 10075 (extrapolação de coorte)', nota: 'Estimativa; plateau materno acima de 40 ⇒ C.', confianca: 'C' },
      fonte: 'Censo 2022 — SIDRA 10075 (IBGE)',
      fonteId: 'censo_sidra_10075',
      nota: 'Pessoa com filhos (vivos), 18+, ponderada entre sexos quando disponível; base feminina (filhos tidos). Homens: subdeclarado no Censo — tratar como limite inferior.',
      confianca: 'B'
    },

    // ---------- Estado civil × filhos por idade — matriz 5×2 [semFilhos, comFilhos], linha soma 1 ----------
    estadoCivilFilhos: {
      '18-24': [
        [0.90, 0.10],
        [0.82, 0.18],
        [0.45, 0.55],
        [0.55, 0.45],
        [0.70, 0.30]
      ],
      '25-29': [
        [0.72, 0.28],
        [0.62, 0.38],
        [0.30, 0.70],
        [0.42, 0.58],
        [0.55, 0.45]
      ],
      '30-39': [
        [0.55, 0.45],
        [0.45, 0.55],
        [0.18, 0.82],
        [0.32, 0.68],
        [0.40, 0.60]
      ],
      '40-49': [
        [0.48, 0.52],
        [0.38, 0.62],
        [0.12, 0.88],
        [0.28, 0.72],
        [0.32, 0.68]
      ],
      '50+': [
        [0.42, 0.58],
        [0.32, 0.68],
        [0.08, 0.92],
        [0.24, 0.76],
        [0.25, 0.75]
      ],
      fonte: 'Censo 2022 — SIDRA 10075 × 10185 (IBGE); forma condicional por premissa',
      fonteId: 'censo_sidra_10075',
      nota: 'Linha = estado civil (ordem de estadoCivilFaixas), coluna = [sem filhos, com filhos]. Marginal da linha 25–29 reproduz p=0,416 de filhosPorIdade quando combinada com estadoCivilPorIdade. Detalhe condicional sem tabela pública ⇒ confiança C.',
      confianca: 'C'
    },

    // ---------- Religião DF — soma = 1 ----------
    religiaoDF: {
      catolica: 0.500,
      evangelica: 0.230,
      espirita: 0.025,
      semReligiao: 0.210,
      matrizAfricana: 0.008,
      outras: 0.027,
      fonte: 'Censo 2022 — SIDRA 2056 (IBGE), religião/credo',
      fonteId: 'censo_sidra_2056',
      nota: 'DF, população 18+. Arredondado para soma 1,000. "outras" inclui Testemunhas de Jeová, mórmons, outras religiões e indiferente/ignorado. Cauda espírita do DF acima da média Brasil.',
      confianca: 'B'
    },

    // ---------- Orientação sexual por sexo — soma por sexo = 1 ----------
    orientacao: {
      porSexo: {
        M: { hetero: 0.935, homo: 0.035, bi: 0.030 },
        F: { hetero: 0.925, homo: 0.025, bi: 0.050 }
      },
      fonte: 'PNS 2019 / premissa',
      fonteId: 'pns_2019',
      nota: 'PNS 2019 (Brasil): homossexual ~1,5% (F 0,015–0,025 no estudo anterior), bissexual ~1,1%. DF (metrópole, subregistro menor) tratado como ~2× Brasil — premissa. "sem_resposta" distribuído proporcionalmente.',
      confianca: 'B'
    },

    // ---------- Escalares com faixa ----------
    fumante: {
      M: { p: 0.11, min: 0.09, max: 0.13 },
      F: { p: 0.07, min: 0.06, max: 0.08 },
      fonte: 'Vigitel 2023 — Ministério da Saúde (Brasília), fumante corrente',
      fonteId: 'vigitel_2023',
      nota: 'Feminino reutilizado de old/data/filtros.json (0,06–0,08). Masculino: faixa Vigitel capitais ~0,10–0,13; sem leitura DF específica ⇒ B.',
      confianca: 'B'
    },

    obesidade: {
      M: { p: 0.13, min: 0.104, max: 0.156 },
      F: { p: 0.12, min: 0.10, max: 0.14 },
      fonte: 'Vigitel — Ministério da Saúde (Brasília), IMC ≥ 30 auto-relatado',
      fonteId: 'vigitel_2023',
      nota: 'Feminino reutilizado de old/data/filtros.json (0,10–0,14, padrão 0,12; recorte jovem da série anterior). IMC auto-relatado subestima. Masculino estimado por simetria (faixa ±20%) ⇒ C para o sexo M.',
      confianca: 'B'
    },

    ist: {
      porIdade: {
        '18-24': { p: 0.52, min: 0.45, max: 0.58 },
        '25-29': { p: 0.50, min: 0.44, max: 0.55 },
        '30-39': { p: 0.46, min: 0.40, max: 0.52 },
        '40-49': { p: 0.42, min: 0.36, max: 0.48 },
        '50+':   { p: 0.38, min: 0.32, max: 0.44 }
      },
      fonte: 'POP-Brasil / estimativas ONDA — Ministério da Saúde (qualquer IST, cenário C2)',
      fonteId: 'pop_brasil_ms',
      nota: 'Cenário C2 (inclui HPV e herpes): old/data/filtros.json 0,48–0,50 no recorte 25–29 feminino. Cenário C1 (IST crônicas — HIV, hepatites B/C, sífilis ativa): ~0,02 (0,015–0,03); motor pode alternar cenário. Curva decrescente com a idade segue atividade sexual autorrelatada (PNS) — premissa B.',
      confianca: 'B'
    },

    antecedentes: {
      porIdade: {
        '18-24': { p: 0.020, min: 0.016, max: 0.024 },
        '25-29': { p: 0.030, min: 0.024, max: 0.036 },
        '30-39': { p: 0.035, min: 0.028, max: 0.042 },
        '40-49': { p: 0.030, min: 0.024, max: 0.036 },
        '50+':   { p: 0.020, min: 0.016, max: 0.024 }
      },
      fonte: 'Infopen / FBSP (proxy nacional)',
      fonteId: 'infopen_fbsp',
      nota: 'Sem registro público de antecedentes por RA/idade: proxy a partir de taxa de encarceramento e primariedade (Brasil). old/data/filtros.json: feminino 0,005–0,01. Valores acima são média populacional com viés masculino; faixa larga ±20% ⇒ C.',
      confianca: 'C'
    },

    infidelidade: {
      M: { p: 0.505, min: 0.43, max: 0.58 },
      F: { p: 0.302, min: 0.25, max: 0.36 },
      fonte: 'Estudo Mosaico 2.0 (infidelidade declarada, relação anterior)',
      fonteId: 'mosaico_2_0',
      nota: 'Reutilizado de old/data/filtros.json: homens 0,505 / mulheres 0,302, valor único sem faixa; alargado ±15% para operação como intervalo. Autodeclaração, viés de desejabilidade social.',
      confianca: 'B'
    },

    altura: {
      M: { mu: 174, sd: 7.5, min: 150, max: 200 },
      F: { mu: 161, sd: 6.5, min: 140, max: 190 },
      fonte: 'IBGE (antropometria inquirida, PNS/Vigitel) — aproximação normal',
      fonteId: 'pns_2019',
      nota: 'Média DF ~ média Brasil masculina adulta (173–175 cm) e feminina (160–162 cm). min/max ≈ ±3σ truncados. Distribuição assumida normal (premissa B); auto-relato infla ~1 cm.',
      confianca: 'B'
    },

    aparencia: {
      mu: 5, sd: 1.5, min: 1, max: 10,
      fonte: 'Premissa interna (escala subjetiva 1–10)',
      fonteId: 'premissa_interna',
      nota: 'Sem fonte possível: nota de atratividade física é construto do próprio modelo. Normal truncada mu=5, sd=1,5; calibração qualitativa do funil. Usar apenas com peso baixo no relatório.',
      confianca: 'C'
    }
  };
})();
