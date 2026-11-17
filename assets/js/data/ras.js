/**
 * ras.js — 35 Regiões Administrativas do DF (ordem RA I–XXXV, GDF).
 * População 2026: Tabela A.2 do estudo Codeplan "Projeções Populacionais para as
 * Regiões Administrativas do Distrito Federal 2020-2030" (2021/2022), normalizada
 * para o total DF 2026 do IBGE (3.009.996). Arapoanga e Água Quente: estimativas
 * (fora da base Codeplan). rendaIdx/educIdx: índices relativos à média DF (=1,00),
 * premissas qualitativas (confianca C).
 * Gerado por script — não editar à mão.
 */
(function () {
  'use strict';
  window.DATA_RAS = {
    fonte: 'Codeplan — Projeções Populacionais para as RAs do DF 2020-2030 (Tabela A.2, 2026), normalizada para 3.009.996 (IBGE 2026)',
    url: 'https://www.codeplan.df.gov.br/wp-content/uploads/2021/12/Estudo-Projecoes-populacionais-para-as-Regioes-Administrativas-do-Distrito-Federal-2020-2030-Resultados.pdf',
    nota: 'peso = participacao percentual no total DF; soma peso = 100,00; soma populacao = 3.009.996. rendaIdx/educIdx = multiplicador sobre a renda média / escolaridade média do DF; estimativa qualitativa por RA (confianca C).',
    atualizadoEm: '2026-11-16',
    confianca: 'B',
    lista: [
    { id: 'ra-01-plano-piloto', numero: 'I', nome: 'Plano Piloto', populacao: 222983, peso: 7.41, rendaIdx: 2.4, educIdx: 2, confianca: 'B' },
    { id: 'ra-02-gama', numero: 'II', nome: 'Gama', populacao: 131597, peso: 4.37, rendaIdx: 1.1, educIdx: 1.1, confianca: 'B' },
    { id: 'ra-03-taguatinga', numero: 'III', nome: 'Taguatinga', populacao: 195629, peso: 6.5, rendaIdx: 1.15, educIdx: 1.15, confianca: 'B' },
    { id: 'ra-04-brazlandia', numero: 'IV', nome: 'Brazlândia', populacao: 60153, peso: 2, rendaIdx: 0.9, educIdx: 0.9, confianca: 'B' },
    { id: 'ra-05-sobradinho', numero: 'V', nome: 'Sobradinho', populacao: 67970, peso: 2.26, rendaIdx: 1.05, educIdx: 1.1, confianca: 'B' },
    { id: 'ra-06-planaltina', numero: 'VI', nome: 'Planaltina', populacao: 198495, peso: 6.59, rendaIdx: 1, educIdx: 1, confianca: 'B' },
    { id: 'ra-07-paranoa', numero: 'VII', nome: 'Paranoá', populacao: 68762, peso: 2.28, rendaIdx: 0.9, educIdx: 0.85, confianca: 'B' },
    { id: 'ra-08-nucleo-bandeirante', numero: 'VIII', nome: 'Núcleo Bandeirante', populacao: 22182, peso: 0.74, rendaIdx: 1.3, educIdx: 1.1, confianca: 'B' },
    { id: 'ra-09-ceilandia', numero: 'IX', nome: 'Ceilândia', populacao: 319205, peso: 10.62, rendaIdx: 0.85, educIdx: 0.85, confianca: 'B' },
    { id: 'ra-10-guara', numero: 'X', nome: 'Guará', populacao: 133141, peso: 4.42, rendaIdx: 1.6, educIdx: 1.5, confianca: 'B' },
    { id: 'ra-11-cruzeiro', numero: 'XI', nome: 'Cruzeiro', populacao: 27144, peso: 0.9, rendaIdx: 1.9, educIdx: 1.7, confianca: 'B' },
    { id: 'ra-12-samambaia', numero: 'XII', nome: 'Samambaia', populacao: 241214, peso: 8.01, rendaIdx: 1, educIdx: 1, confianca: 'B' },
    { id: 'ra-13-santa-maria', numero: 'XIII', nome: 'Santa Maria', populacao: 118725, peso: 3.94, rendaIdx: 1, educIdx: 1, confianca: 'B' },
    { id: 'ra-14-sao-sebastiao', numero: 'XIV', nome: 'São Sebastião', populacao: 115807, peso: 3.85, rendaIdx: 0.85, educIdx: 0.8, confianca: 'B' },
    { id: 'ra-15-recanto-das-emas', numero: 'XV', nome: 'Recanto das Emas', populacao: 136861, peso: 4.55, rendaIdx: 0.8, educIdx: 0.8, confianca: 'B' },
    { id: 'ra-16-lago-sul', numero: 'XVI', nome: 'Lago Sul', populacao: 27549, peso: 0.92, rendaIdx: 2.8, educIdx: 2.2, confianca: 'B' },
    { id: 'ra-17-riacho-fundo', numero: 'XVII', nome: 'Riacho Fundo', populacao: 41931, peso: 1.39, rendaIdx: 0.95, educIdx: 0.9, confianca: 'B' },
    { id: 'ra-18-lago-norte', numero: 'XVIII', nome: 'Lago Norte', populacao: 35427, peso: 1.18, rendaIdx: 2.5, educIdx: 2, confianca: 'B' },
    { id: 'ra-19-candangolandia', numero: 'XIX', nome: 'Candangolândia', populacao: 14332, peso: 0.48, rendaIdx: 1.05, educIdx: 1.05, confianca: 'B' },
    { id: 'ra-20-aguas-claras', numero: 'XX', nome: 'Águas Claras', populacao: 117598, peso: 3.91, rendaIdx: 1.9, educIdx: 1.7, confianca: 'B' },
    { id: 'ra-21-riacho-fundo-ii', numero: 'XXI', nome: 'Riacho Fundo II', populacao: 68872, peso: 2.29, rendaIdx: 0.9, educIdx: 0.85, confianca: 'B' },
    { id: 'ra-22-sudoeste-octogonal', numero: 'XXII', nome: 'Sudoeste/Octogonal', populacao: 52507, peso: 1.74, rendaIdx: 2.3, educIdx: 2, confianca: 'B' },
    { id: 'ra-23-varjao', numero: 'XXIII', nome: 'Varjão', populacao: 8381, peso: 0.28, rendaIdx: 0.55, educIdx: 0.65, confianca: 'C', nota: 'RA pequena; Codeplan pode subestimar ocupações informais' },
    { id: 'ra-24-park-way', numero: 'XXIV', nome: 'Park Way', populacao: 21836, peso: 0.73, rendaIdx: 1.6, educIdx: 1.4, confianca: 'B' },
    { id: 'ra-25-scia-estrutural', numero: 'XXV', nome: 'SCIA/Estrutural', populacao: 36134, peso: 1.2, rendaIdx: 0.55, educIdx: 0.7, confianca: 'B', nota: 'SCIA e Estrutural somadas na base Codeplan (SCIA)' },
    { id: 'ra-26-sobradinho-ii', numero: 'XXVI', nome: 'Sobradinho II', populacao: 76923, peso: 2.56, rendaIdx: 0.85, educIdx: 0.8, confianca: 'B' },
    { id: 'ra-27-jardim-botanico', numero: 'XXVII', nome: 'Jardim Botânico', populacao: 57574, peso: 1.91, rendaIdx: 1.3, educIdx: 1.2, confianca: 'B' },
    { id: 'ra-28-itapoa', numero: 'XXVIII', nome: 'Itapoã', populacao: 89234, peso: 2.96, rendaIdx: 0.7, educIdx: 0.7, confianca: 'B' },
    { id: 'ra-29-sia', numero: 'XXIX', nome: 'SIA', populacao: 2445, peso: 0.08, rendaIdx: 0.9, educIdx: 0.9, confianca: 'C', nota: 'População residencial mínima; zona industrial' },
    { id: 'ra-30-vicente-pires', numero: 'XXX', nome: 'Vicente Pires', populacao: 76235, peso: 2.53, rendaIdx: 1.2, educIdx: 1.2, confianca: 'B' },
    { id: 'ra-31-fercal', numero: 'XXXI', nome: 'Fercal', populacao: 8502, peso: 0.28, rendaIdx: 0.65, educIdx: 0.7, confianca: 'C', nota: 'RA rural pequena; projeção Codeplan' },
    { id: 'ra-32-sol-nascente-por-do-sol', numero: 'XXXII', nome: 'Sol Nascente/Pôr do Sol', populacao: 91043, peso: 3.02, rendaIdx: 0.55, educIdx: 0.65, confianca: 'B' },
    { id: 'ra-33-arniqueira', numero: 'XXXIII', nome: 'Arniqueira', populacao: 43083, peso: 1.43, rendaIdx: 1, educIdx: 0.9, confianca: 'B' },
    { id: 'ra-34-arapoanga', numero: 'XXXIV', nome: 'Arapoanga', populacao: 53681, peso: 1.78, rendaIdx: 0.65, educIdx: 0.65, confianca: 'C', nota: 'População estimada; RA criada após o estudo Codeplan (2021); desmembrada de Planaltina' },
    { id: 'ra-35-agua-quente', numero: 'XXXV', nome: 'Água Quente', populacao: 26841, peso: 0.89, rendaIdx: 0.6, educIdx: 0.6, confianca: 'C', nota: 'População estimada; RA criada após o estudo Codeplan (2021); desmembrada de São Sebastião' }
    ]
  };
})();
