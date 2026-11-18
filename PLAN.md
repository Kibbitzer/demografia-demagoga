# Plano — Calculadora Demográfica de Parceiros em Potencial (DF)

Plano de implementação. Fonte do pedido: spec original em `PLAN.md` (substituída por este plano). Base estatística reaproveitável em `old/` (não alterar `old/`).

---

## 1. Entrega

Aplicação web estática, sem build, aberta por `index.html` (duplo clique), responsiva, em pt-BR.

- Motor de cálculo orientado a dados: adicionar critério novo = novo objeto em `data/filtros.js` (+ tabela de taxas). Nenhuma alteração em UI/cálculo para filtros categóricos.
- 35 RAs do DF, distribuição por RA, tabela pesquisável.
- Sensibilidade Top 4, perfis prontos, modal de metodologia/fontes, módulo lúdico de aparência.
- Atualização instantânea (< 100 ms por ajuste).

Stack: HTML + CSS próprio (sem build, sem CDN obrigatório) + JS clássico (IIFE, `window.*`), Chart.js UMD vendorizado. Motivo: `file://` bloqueia `type="module"` e `fetch`, e CDN quebra offline. “Estrutura modular equivalente” prevista na spec.

Alternativa vetada: arquivo único gigante (>3k linhas) — difícil de manter e revisar.

---

## 2. Estrutura de arquivos

```
index.html
assets/css/styles.css
assets/js/data/populacao.js      # Censo 2022 SIDRA 9514, idade×sexo, escala 2026
assets/js/data/ras.js            # 35 RAs: população, peso, índices renda/escolaridade
assets/js/data/taxas.js          # todas as tabelas probabilísticas + metadados de fonte
assets/js/data/filtros.js        # FILTERS_CONFIG
assets/js/engine.js              # motor puro, sem DOM
assets/js/sensibilidade.js       # simulação de remoção de filtros
assets/js/charts.js              # Chart.js: barras RA + curva normal
assets/js/ui.js                  # render de filtros, eventos, tabela, modal
assets/js/main.js                # bootstrap, presets, estado
assets/vendor/chart.umd.min.js   # cópia local
scripts/test-engine.mjs          # testes de sanidade do motor (node)
```

`old/data/populacao.json` é doador: copiar dados para `populacao.js` como `window.DATA_POPULACAO`. `old/data/ra.json` tem só 14 RAs agrupadas — não serve; criar 35.

---

## 3. Modelo de dados

### 3.1 `populacao.js`
`{ anoEscala: 2026, totalDF: 3009996, fator: 1.068367, idades: [{ idade, homens, mulheres }] }`
Fonte: Censo 2022 SIDRA 9514 (n3/53, c2/4,5, c286/113635), escalado pela projeção 2026 já usada em `old/`.

### 3.2 `ras.js`
Array de 35 objetos:
```js
{ id, nome, populacao, peso, rendaIdx, educIdx, confianca }
```
- `peso` = população da RA / população DF; soma = 100,0% (validar).
- `rendaIdx`: 0,55 (populares) … 2,8 (Lago Sul) — desloca odds das faixas de renda, renormalizado.
- `educIdx`: desloca probabilidade de superior/pós.
- Origem: PDAD/IPEDF 2024 (população e renda domiciliar por RA) + Censo 2022. Onde só houver estimativa, `confianca: "C"` e nota.
- Lista canônica: usar a relação oficial de RAs do GDF/PDAD 2024 (35, incluindo Arniqueira, Arapoanga e Água Quente). Não montar lista de memória: copiar nomes e códigos da fonte e conferir contagem = 35 e soma dos pesos = 100,0% no teste.

### 3.3 `taxas.js`
Toda taxa é faixa + fonte + confiança:
```js
orientacao: { porSexo: { M: {hetero:[..], homo:[..], bi:[..]}, F: {...} }, fonte, nota }
rendaPorIdade: { "18-24": [...6 faixas], "25-29": ..., ... }        // soma 1
rendaEduBase: { "18-24": [[...], ...], ... }                        // matriz 6×5
estadoCivilPorIdade: { "18-24": {solteiroLivre, namorando, casadoUniao, divorciado...}, ... }
filhosPorIdade: { "18-24": pTemFilhos, ... }
estadoCivilFilhos: { "18-24": matriz 3×2, ... }
escolaridadePorIdade: { ... }
religiaoDF: { catolica, evangelica, espirita, semReligiao, matrizAfricana, outras }
fumante: { M:[min,max], F:[...] }
obesidade: { M:[...], F:[...] }
ist: { porIdade: {...} }
antecedentes: { geral:[...], porIdade: {...} }
infidelidade: { M:[...], F:[...] }
altura: { M:{mu:174, sd:7.5}, F:{mu:161, sd:6.5} }
aparencia: { mu:5, sd:1.5, min:1, max:10 }
```
Regras:
- Cada bloco carrega `fonte`, `nota`, `confianca` (A/B/C).
- Margens de um mesmo domínio somam 1 (tolerância 0,5%).
- Sem fonte verificável → faixa larga (±20%) e `confianca:"C"`. Nunca número único inventado.
- Hierarquia: DF (PDAD/Vigitel-DF) > CO > Sudeste > Brasil; registrar qual nível foi usado.
- Fonte de cada taxa também entra em `fontes` para o modal.

### 3.4 `filtros.js` — `FILTERS_CONFIG`
```js
{
  id: "renda",
  label: "Renda mensal",
  category: "Socioeconômico",
  type: "range",                 // range | select | multi-select | toggle | tri-state
  rateKey: "rendaPorIdade",
  options: [{ value, label, probKey }],   // ou min/max/step
  source: "PDAD 2024 (IPEDF); PNAD Contínua",
  methodologyNote: "Probabilidade condicionada a faixa etária e ajustada por RA.",
  defaultValue: ...
}
```
Filtros: gênero do usuário, gênero buscado, orientação do alvo (auto/manual), idade, altura, renda, relacionamento (multi), filhos, escolaridade (multi), religião (multi), fumante, obesidade, antecedentes, IST, infidelidade, aparência (switch).
Categorias: `Demografia & Compatibilidade`, `Socioeconômico`, `Físico & Estilo de Vida`, `Comportamental`.

Contrato do motor: tipo categórico → resolve `probKey` em `taxas`; tipo range → handler registrado (`idade`, `altura`, `renda`). Novo filtro categórico não exige código.

---

## 4. Motor estatístico

`engine.calcular(state) -> { total, porRA, porIdade, porGenero, base }`

Pipeline por `RA × idade (18..80+) × sexo`:

1. `base = populacao[idade][sexo] × fator2026 × pesoRA`
2. Orientação: fator = soma das categorias compatíveis com (gênero usuário × gênero alvo). Auto:
   - usuário M busca F → hetero + bi
   - usuário M busca M → homo + bi
   - usuário F busca M → hetero + bi
   - usuário F busca F → homo + bi
   - “Ambos” → união dos dois pools, sem dupla contagem (sexo já separa).
3. Idade: só idades dentro de [min,max] entram no somatório (não é multiplicador).
4. Altura: `Φ((max−μ)/σ) − Φ((min−μ)/σ)` por sexo; “Indiferente” = 1. `Φ` via erf aproximado (Abramowitz-Stegun).
5. Blocos categóricos independentes: se “Indiferente”/todas as opções → 1; senão soma das opções marcadas. Nunca multiplicar opções do mesmo bloco.
6. Correlações (eixo idade):
   - renda: usa linha da faixa etária (5 faixas: 18–24, 25–29, 30–39, 40–49, 50+).
   - estado civil × filhos: matriz conjunta 3×2 por faixa etária. Sem opção marcada = 1.
   - IST e antecedentes: taxa por faixa etária, não constante.
7. Correlação RA: matriz renda×escolaridade base do DF inclinada por `rendaIdx` e `educIdx` da RA, renormalizada. Aplicada uma vez; não multiplicar renda e escolaridade em separado quando ambas ativas.
8. Aparência (se ligada): `1 − Φ((notaMin−5)/1,5)`, truncada em [1,10] e renormalizada.
9. Soma final. `porRA` = total de cada RA; soma das RAs = total (validar em teste).

Aproximação declarada: independência condicional entre domínios dada idade/sexo/RA. Matrizes cruzadas cobrem as correlações exigidas; o resto é produto de domínios distintos, não de opções dentro do domínio.

KPI:
- total absoluto;
- `% da população DF` = total / 3.009.996 (2 casas);
- `1 em cada X` = público adulto 18+ do(s) gênero(s) buscado(s) com orientação compatível ÷ total (denominador sem filtro de idade, documentado no tooltip).

`porIdade` e `porGenero` para gráfico/insight opcional.

---

## 5. Sensibilidade

`sensibilidade.top(state, n=4)`:
1. Base = `calcular(state)`.
2. Para cada filtro ativo (fora gênero/idade estrutural), recalcular com aquele filtro em “indiferente”/faixa total.
3. Delta absoluto e relativo; ordenar por delta absoluto; Top 4.
4. Texto: “Remover **Renda ≥ R$ 10.000** adiciona +18.400 pessoas (+240%)”. Formatar com `Intl.NumberFormat('pt-BR')`.
5. Recalcular a cada mudança, com debounce de 60 ms; custo ~13 recomputes × 4.400 células = desprezível.
6. Se nenhum filtro ativo: mensagem “Nenhum filtro restritivo ativo”.

---

## 6. Interface

Layout: sidebar 320 px fixa (desktop), drawer no mobile (< 1024 px, botão “Filtros”, overlay, fechar). Main: header com título, chips de presets, hero KPI, grid de cards, gráfico RA, tabela, sensibilidade, metodologia, módulo lúdico no fim.

Componentes:
- Slider duplo nativo (dois `input[type=range]` sobrepostos + trilho preenchido), valores em `<output>`, passos: idade 1, altura 1 cm, renda R$ 500.
- Multi-select em chips/checkbox; tri-state em segmented control (Sim / Não / Indiferente).
- Categoria colapsável com contador de filtros ativos.
- “Resetar filtros” + presets: `Padrão Médio DF` (idade 25–35, renda ≥ 2 SM, ensino médio+, solteiro/namorando, sem filhos, não fumante), `Super Seletivo` (25–32, ≥ 10 SM, superior+, sem filhos, não fumante, IMC ≤ 30, altura 170–185/160–175, sem antecedentes/IST, aparência ≥ 8), `Sem Restrições` (tudo indiferente, idade 18–80).
- `aria-live="polite"` no KPI; foco visível; contraste AA.
- Modal “Metodologia e Fontes”: uma linha por filtro (label, fonte, nota, badge A/B/C) + premissas + aviso de estimativa.
- Tabela RA: busca por nome, ordenação por coluna, linha de total, colunas População / Peso / Candidatos / % do total.
- Cards de resumo: candidatos, % DF, 1 em X, gargalo principal.

Design tokens: `--navy:#0f172a`, `--slate:#334155`, `--bg:#f1f5f9`, `--card:#fff`, `--emerald:#10b981`, `--indigo:#6366f1`, raio 12 px, sombra sutil, tipografia system-ui. Sem dark mode (YAGNI).

Gráficos: Chart.js barras horizontais ordenadas (RA) e linha da normal com área sombreada ≥ nota mínima. Se Chart.js falhar ao carregar, fallback CSS de barras (sem quebrar o resto).

Módulo lúdico: switch discreto; ao ligar, card com slider de nota mínima 1–10 (passo 0,5), curva desenhada, área pintada, multiplicador exibido e aviso de subjetividade.

---

## 7. Dados — tabelas a preencher

| Bloco | Eixos | Fonte | Confiança esperada |
| :--- | :--- | :--- | :--- |
| População | idade × sexo | Censo 2022 SIDRA 9514 + projeção 2026 | A |
| População RA | 35 RAs | PDAD 2024 / Censo 2022 | A/B |
| Orientação | sexo | PNS 2019 (autoidentificação) | B |
| Renda | faixa etária, RA | PDAD 2024, PNAD Contínua | A/B |
| Renda × escolaridade | faixa etária, RA | PDAD/PNAD | B |
| Estado civil | faixa etária | Censo 2022, Registro Civil | B |
| Namoro sem coabitação | faixa etária | premissa comportamental | C |
| Filhos | faixa etária | Censo 2022 / PNAD | A/B |
| Escolaridade | faixa etária, RA | PDAD, PNAD Educação | A/B |
| Religião | DF | Censo 2022 | A |
| Altura | sexo | PNS/POF (μ 174/161 cm) | B |
| Tabagismo | sexo | Vigitel DF | A |
| Obesidade IMC>30 | sexo | Vigitel DF | A |
| IST diagnosticada | faixa etária | MS/SES-DF | B |
| Antecedentes | faixa etária | SENAPPEN/SSP-DF | C |
| Infidelidade | sexo | estudos acadêmicos (ProSex/USP etc.) | C |

Não usar número sem `fonte`. Divergência entre DF e Brasil: usar DF; senão CO; senão Brasil — anotar.

---

## 8. Fases de execução (delegar ao orchestrator)

1. **Dados** — `populacao.js`, `ras.js` (35, soma 100%), `taxas.js` esqueleto + valores iniciais. Saída: `node scripts/test-dados.mjs` verde (somas, cobertura 35).
2. **Motor** — `engine.js`, `sensibilidade.js`, `scripts/test-engine.mjs`. Casos: sem filtros = adultos 18+ do pool; só idade; altura simétrica; monotonicidade (restrição nova nunca aumenta total); soma RAs = total.
3. **UI base** — `index.html`, `styles.css`, `filtros.js`, `ui.js`: render data-driven, sliders, drawer, presets, reset, modal fontes.
4. **Visualizações** — `charts.js` (RA + Gauss), tabela RA, cards KPI, sensibilidade.
5. **Acabamento** — responsivo 360–1440 px, acessibilidade, estados vazios (0 candidatos, 1 em X), formatação pt-BR, fallback de gráfico.
6. **QA** — checklist da §9; revisão de fonte em cada taxa; rodar testes.

Dependências: 2 depende de 1; 3 e 4 dependem de 2; 5 depende de 3–4. Um integrador único no motor para evitar conflito.

---

## 9. Critérios de aceite

- [ ] `index.html` abre por `file://` sem erro de console e sem servidor.
- [ ] Todos os 13 filtros obrigatórios + gênero/orientação/altura/aparência presentes e funcionais.
- [ ] Nenhum id de filtro hardcoded na UI nem no cálculo (exceto handlers de tipo).
- [ ] Novo filtro categórico em `filtros.js` aparece na UI sem editar `ui.js`/`engine.js`.
- [ ] Soma das 35 RAs = total do KPI (±1 por arredondamento).
- [ ] Pesos das RAs somam 100,0%; margens de cada domínio somam 1 ±0,005.
- [ ] Sensibilidade: delta exibido = recalculo real; Top 4 ordenado; some quando filtro removido.
- [ ] Aparência só afeta o total quando ligada; curva e área coerentes com a nota.
- [ ] Mobile 360 px: drawer abre/fecha, sem overflow horizontal.
- [ ] Toda taxa tem `source` + `methodologyNote` visíveis no modal.
- [ ] `1 em cada X` usa denominador adulto compatível, coerente com o texto.
- [ ] Textos em pt-BR, vírgula decimal, ponto de milhar (3.009.996).
- [ ] Zero candidatos: UI não quebra, mostra 0 e “1 em cada —”.
- [ ] Rodar `node scripts/test-engine.mjs` e `node scripts/test-dados.mjs`: verde.

---

## 10. Riscos e limites

- Taxas comportamentais (infidelidade, namoro sem coabitação, antecedentes) são estimativas; marcar `C` e usar faixa. Sem isso, o número vira falsa precisão.
- Correlações não modeladas (ex.: escolaridade × religião) permanecem como independência condicional — documentar na metodologia.
- RA com amostra pequena (Varjão, Fercal, SIA) → flag `C`.
- Aparência é lúdica; nunca somar ao KPI sem aviso e sem switch explícito.
- Sem internet: Chart.js local resolve; não usar Tailwind CDN.
- `old/` é referência congelada; não editar nem contradizer seus números sem nota.

---

## 11. Aprovação

Responder `build` para executar as fases 1–6 via orchestrator. Ajustes de escopo (ex.: Tailwind CDN, arquivo único) devem ser ditos antes.

---
---

# PARTE II — Plano de correção metodológica

**Estado da Parte I:** implementada e publicada. Não reexecutar. Esta parte é o plano novo.

**Diagnóstico de origem:** `paper_metodologia.md` (críticas 4.1–4.13 e propostas §5). Objetivo: converter o KPI de "número preciso" para "cenário com incerteza declarada, linhagem e validação".

**Princípio de migração:** manter o motor atual como `modo='legado'`; construir `modo='calibrado'` em paralelo; comparação lado a lado antes de trocar o padrão. Nenhuma mudança que apague o modo legado sem aprovação.

## 12. Priorização

| Prioridade | Item | Depende de microdados? | Ganho |
| :--- | :--- | :--- | :--- |
| P0.1 | Propagar incerteza das faixas A/B/C para IC95 no KPI | Não | Alto |
| P0.2 | Rótulo de cenário/escopo/modo junto ao KPI | Não | Alto |
| P0.3 | Funil com atribuição invariante à ordem (Shapley) | Não | Médio |
| P0.4 | Sensibilidade global (Sobol) substituindo Top4 local | Não | Alto |
| P0.5 | Testes de margem, monotonicidade e invariância | Não | Alto |
| P1.1 | DAG e registro de independências/colisores | Não | Alto |
| P1.2 | Junta renda×escolaridade via IPF, substituir reweight ad hoc | Margens 2-vias publicadas | Alto |
| P1.3 | Correção de erro de medida em altura/IMC (Vigitel/PNS) | Não (parâmetros publicados) | Médio |
| P1.4 | Separar construtos IST (C1 crônica — C2 histórico — ativa) | Não | Alto |
| P2.1 | Modelo hierárquico bayesiano com efeito RA/idade | Microdados ou tabelas 2-vias | Alto |
| P2.2 | Pequenas áreas (Rao) para Varjão/Fercal/SIA | Microdados | Médio |
| P2.3 | Imputação múltipla de comportamentos ausentes | Microdados | Médio |
| P2.4 | Backtest contra microdados PNAD/Censo liberados | Microdados | Alto |

## 13. Fase P0 — correções sem dados novos

### 13.1 Propagação de incerteza
- Arquivo novo: `assets/js/incerteza.js`; API `window.Incerteza = { amostrar(state, n), resumo(state) }`.
- Para cada `TAXAS.*` com `min`/`max`: Beta(α,β) com média em `p` e dispersão definida pela faixa; para `altura`/`aparencia`: Normal(μ,σ) com μ perturbado pelo erro de medida.
- `amostrar()` chama `Engine.calcular` com tabela de taxas perturbada; não altera o motor.
- `resumo()` → `{ median, p025, p975, p05, p95 }` sobre `total`, `porRA`, `umEmCadaHabitantes`.
- Render: KPI mostra mediana e faixa 95%; gráfico RA com barras de erro; pct com 1 casa, não 2.
- `n=2000` por padrão; Web Worker se `n>5000`.

### 13.2 Rótulos e semântica
- `index.html`: badge de cenário ao lado do KPI: `IST C1/C2 · renda familiar/per capita · modo correlacionado/independente`.
- Modal: bloco "Como ler este número" com base canônica (adultos 18–80) e aviso de cenário ilustrativo.
- `ui.js`: `#kpi-pct` passa a 1 casa decimal; remover falsa precisão de 3 algarismos.

### 13.3 Funil invariante
- `analytics.js`: manter `Funil.calcular(state)`; acrescentar `Funil.atribuicao(state)` com valores de Shapley: média da perda marginal de cada filtro sobre 100 permutações com seed determinístico.
- `charts.js`: `renderFunil` desenha barras de média + desvio entre permutações.
- Texto do card: "Atribuição por Shapley; a ordem visual não afeta os valores."

### 13.4 Sensibilidade global
- `sensibilidade.js`: manter `top()` (legado) e acrescentar `global(state)`:
  - 2048 combinações de filtros ativos (sequência Sobol' com seed simples, sem lib externa);
  - índice de 1ª ordem `S_i` e total `S_Ti`;
  - saída `[{id,label,S,S_T,rank}]`.
- UI: card "Filtros de maior impacto" mostra `S_T` com barra; legenda explica que `S_T−S` mede interação.
- Teste: `scripts/test-sensibilidade-global.mjs` — soma de `S` ≤ 1; `S_T ≥ S`; ordem estável em 3 seeds.

### 13.5 Testes P0
- `scripts/test-incerteza.mjs`: IC contém a mediana; p025 ≤ median ≤ p975; determinismo por seed.
- `scripts/test-engine.mjs`: invariância de ordem do funil (desvio ≤ 2%) e conservação da soma por RA sob perturbação.
- Critério: testes verdes; `file://` sem erro; recompute < 150 ms com n=2000.

## 14. Fase P1 — estrutura estatística

### 14.1 DAG e contrato de independência
- Arquivo: `docs/dag.md` com nós: idade, sexo, RA, renda, escolaridade, raça, civil, filhos, fumo, IMC, IST, antecedentes, infidelidade, altura.
- Arestas declaradas; marcar colisores e variáveis latentes (nutrição, contexto familiar, acesso a saúde).
- Cada `FILTERS_CONFIG[].independencias` lista pares tratados como independentes e justificativa.
- Regra: novo filtro só entra se tiver `independencias` preenchido.

### 14.2 Junta consistente (IPF)
- `scripts/build_joint.py` (numpy/scipy): entrada = marginais de `TAXAS` + tabelas 2-vias publicadas (`rendaEduBase`, `estadoCivilFilhos`, `racaPorRenda`) + margens por RA.
- Saída: `data/joint_calibrado.json` com pesos log-lineares; erro de margem ≤ 1%.
- `engine_v2.js`: substitui `juntaRD`/`civilFilhoProb`/`fatorRaca` por consulta à tabela calibrada; `modo='calibrado'` seleciona.
- `scripts/validate_margins.py`: falha se marginal reconstruída divergir > 1% da publicada.
- Teste A/B: cenários do `test-engine.mjs` rodam nos dois modos; nenhum total negativo/NaN.

### 14.3 Erro de medida e construtos
- Altura: substituir `(μ,σ)` pontuais por distribuição preditiva; parâmetro de correção do auto-relato (Vigitel/Malta 2010); nota em `taxas.js`.
- Tabagismo/obesidade: declarar período de referência em `label`/`ajuda`.
- IST: `istCenario` → `istDefinicao` com `cronica` (C1), `historicoAmplo` (C2), `infecciosaAtual` (novo); manter aliases.
- Infidelidade/antecedentes: badge `C` visível no filtro e no KPI.

## 15. Fase P2 — dados e modelo hierárquico

### 15.1 Aquisição
- `scripts/fetch_ibge.py`: SIDRA (Censo 2022, PNAD Contínua 2022/2023, PNS 2019) com `ano`, `tabela`, `variavel` parametrizados; salvar URL e data de acesso.
- PDAD/IPEDF: verificar microdados; se indisponíveis, usar tabelas 2-vias publicadas e registrar limitação.
- `data/fontes.json`: linhagem (nome, nível DF/CO/BR, ano, URL, acesso, confiança).

### 15.2 Modelo hierárquico
- `modelo_v2.js`: logit hierárquico `logit p[i,ra] = α + β_idade + γ_ra + δ_renda + ...`, `γ_ra ~ N(0, σ_ra²)`; ajuste em `scripts/fit_model.py` (PyMC/Stan) ou MAP+bootstrap.
- Priors: Beta(2,8) para taxas raras; Normal(0,0.5) para coeficientes; HalfNormal para σ_ra.
- Saída: `data/posterior.json`; browser só interpola amostras.
- RAs pequenas: encolhimento para média DF; IC por RA na tabela.

### 15.3 Validação
- Backtest: treino/teste em microdados; comparar contagens agregadas previstas vs observadas por RA×idade×sexo.
- Métricas: erro absoluto mediano ≤ 5% em agregados grandes; cobertura do IC95 entre 93–97%; calibração por decil.
- `scripts/report_validacao.py` → `docs/validacao.md`.

## 16. Ordem de execução e delegação

1. P0.5 → P0.1 → P0.2 → P0.3 → P0.4 (um coder por arquivo; integrador único em `engine.js`/`incerteza.js`).
2. P1.1 → P1.2 → P1.3 → P1.4.
3. P2.1 → P2.2 → P2.3 → P2.4.
4. Após P2.4 verde: trocar padrão para `calibrado`, manter `legado` por 1 release.

## 17. Critérios de aceite finais

- [ ] KPI mostra mediana + IC95, nunca número isolado.
- [ ] Badge declara cenário IST, base de renda, modo e ano das fontes.
- [ ] Toda marginal publicada reproduzida com erro ≤ 1% no modo calibrado.
- [ ] Atribuição do funil invariante à ordem (≤ 2% entre permutações).
- [ ] `S_T ≥ S` para todos os filtros; interações quantificadas.
- [ ] RAs pequenas têm IC e encolhimento; não recebem ponto fixo.
- [ ] Backtest: cobertura IC95 93–97%; erro mediano ≤ 5% em agregados grandes.
- [ ] `docs/dag.md` justifica cada independência; nenhum filtro novo sem `independencias`.
- [ ] `data/fontes.json` cobre 100% das taxas com URL e data de acesso.
- [ ] Testes verdes nos dois modos; `file://` sem erro; recompute < 150 ms (ou worker).
- [ ] Modo legado permanece acessível para comparação.

## 18. Riscos

- Microdados PDAD podem exigir solicitação formal: Plano B é IPF sobre tabelas 2-vias, com confiança C.
- IPF com restrições insuficientes pode fabricar dependência: exigir diagnóstico de convergência e comparação com tabela legada.
- MCMC em browser é inviável: ajuste offline, posterior serializado.
- Mais incerteza pode parecer "menos preciso": comunicação deve enquadrar IC como honestidade.
- Números diferentes não são "correção" automática: só validação externa decide.

## 19. Aprovação da Parte II

Responder `build-method` para executar P0. Responder `build-method-all` para P0→P2. Cada fase termina com relatório de testes antes da seguinte.
