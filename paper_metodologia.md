# Inferência a partir de marginais: avaliação crítica da metodologia estatística da Calculadora Demográfica de Parceiros em Potencial (DF)

## 1. Resumo

A Calculadora Demográfica de Parceiros em Potencial — DF, exibida na interface como "Quanto Sobra Para o Betinha", converte filtros de preferência (de idade a comportamentos) em contagem estimada de pessoas compatíveis no DF, a partir de marginais do Censo 2022, PNS 2019, Vigitel e PDAD 2024. Este paper avalia a arquitetura sob três eixos: (i) a premissa de independência condicional entre domínios dados idade/sexo/RA, não testada; (ii) a reconstrução de conjuntas por reweighting linear de marginais, sem consistência garantida; (iii) o compounding multiplicativo de erros sem intervalos. Discutem-se falácia ecológica, MAUP, defasagem das fontes, desejabilidade social e ordem do funil. Propõe-se microsimulação Monte Carlo calibrada por raking/IPF, DAGs, modelos hierárquicos bayesianos, sensibilidade global de Sobol e validação contra microdados. Conclui-se que os KPIs devem ser lidos como cenários ilustrativos de um modelo gerador declarável, não como estimativas pontuais.

**Palavras-chave:** inferência ecológica; independência condicional; tabelas de contingência; microsimulação; análise de sensibilidade.

## 2. Introdução e objeto de análise

O problema operacional: dado um perfil desejado, quantas pessoas no DF o satisfazem? A resposta exige P(∩ᵢ{xᵢ∈Bᵢ}) — probabilidade conjunta de quinze características — aplicada à população. As fontes públicas (IBGE, Codeplan, MS) só divulgam marginais e cruzamentos esparsos (idade×sexo, renda×idade, raça×renda) — jamais a conjunta. Estimar mercado de parceiros é, portanto, inferência a partir de marginais: reconstruir uma conjunta ausente sob premissas de dependência — aqui, majoritariamente assumidas e não verificadas.

O objeto é a metodologia, não o conteúdo lúdico: o pipeline de `PLAN.md` §4 implementado em `engine.js`, o módulo de sensibilidade e o funil de barras proporcionais. Pergunta central: que confiança os números suportam, e quais mecanismos a limitam?

## 3. Arquitetura atual do cálculo

### 3.1 Pipeline

Base: idade×sexo do Censo 2022 (SIDRA 9514) escalada por k = 1,068367 para 2026 — 3.009.996 habitantes. Domínio: RA×idade×sexo, 35 RAs, ≈ 4.410 células. Em cada célula,

  N(r,a,s) = Pop(a,s) · k · w_r,  Σ_r w_r = 1  (1)

(w_r = população da RA / DF, PDAD 2024). Sobre N incide um produto de fatores:

  T = Σ_{r,a∈[a₁,a₂],s∈alvo} N(r,a,s) · ω_s · h_s · ∏_d f_d(a,s)  (2)

ω_s = Σ_{o∈O} P(orientação=o|s): fatia compatível com o par usuário–alvo (hetero+bi ou homo+bi; PNS 2019, premissa DF ≈ 2× Brasil). Idade é recorte de somatório, não multiplicador. h_s é a massa normal truncada de altura: Φ((h₂−μ_s)/σ_s) − Φ((h₁−μ_s)/σ_s), com μ = 174/161 cm, σ = 7,5/6,5 cm. Cada domínio categórico d (renda, escolaridade, religião, civil, filhos, tabagismo, obesidade, IST, antecedentes, infidelidade, aparência) entra com um único fator — soma das opções marcadas, nunca produto dentro do bloco:

  f_d(a,s) = Σ_{j∈J_d} P(x_d = j | a, s)  (3)

Pares correlacionados usam matrizes condicionais: junta estado civil×filhos 3×2 por faixa etária; junta renda×escolaridade obtida da matriz base 6×5 do DF reweightada e inclinada por rendaIdx (0,55–2,8) e educIdx da RA, aplicada uma única vez:

  p̂(i,j | r,a) ∝ p(i,j | a) · ρ_r · ε_r, renormalizada  (4)

Renda usa base domiciliar total (padrão) ou per capita, tabelas intercambiáveis. Raça usa P(cor/raça | faixa de renda, sexo) ponderada pelas faixas selecionadas.

### 3.2 Modos, cenários, KPIs

**Correlacionado** (padrão) aplica as matrizes; **independente** as descarta e multiplica marginais puras. A premissa global do primeiro é independência condicional entre domínios dados idade/sexo/RA: P(x₁,…,x_m | a,s,r) ≈ ∏ P(xᵢ | a,s,r). Cenários IST trocam a tabela: C1 (crônicas — HIV, hepatites B/C, sífilis ativa — ~2%, faixa 1,5–3%) vs C2 (qualquer IST, com HPV/herpes — ~38–52% por faixa). KPIs: T; %DF = T/3.009.996; "1 em cada X" = D/T, com D = adultos 18+ dos gêneros buscados com orientação compatível, sem filtro de idade; "1 em cada X habitantes" = 3.009.996/T. Sensibilidade: um filtro removido por vez, Top 4. Funil em barras proporcionais (a UI registra que largura de funil distorce a leitura).

## 4. Crítica metodológica

### 4.1 Independência condicional não testada

**Problema.** O produto (3)→(2) assume renda ⟂ religião, tabagismo ⟂ renda, raça ⟂ escolaridade, IST ⟂ escolaridade, dadas idade/sexo/RA; nada é testado, não há DAG (Pearl, 2009) que fundamente os condicionamentos. **Mecanismo.** Violações conhecidas: renda↑ com escolaridade↑ e tabagismo↓; escolaridade com diagnóstico de IST e com composição racial; condicionar em renda — colisor de escolaridade e origem — cria associação espúria entre raça e escolaridade (viés de colisão). O produto f_d·f_d′ superestima P(x∧x′) sob correlação negativa e subestima sob positiva (|Cov| não contabilizado); reversões Simpson (1951)/Yule (1903) são plausíveis ao agregar RAs. **Impacto.** Com 3+ filtros correlacionados, erro de dezenas de %, sinal indeterminado. **Remédio.** DAG, testes de independência residual em microdados PNAD, tabela conjunta calibrada (§5).

### 4.2 Heterogeneidade temporal e geográfica das fontes

**Problema.** Censo 2022, PNS 2019, Vigitel 2023/24, PDAD 2024 e projeção 2026 entram como retrato simultâneo. **Mecanismo.** Taxas comportamentais tendem (fumo cai, obesidade sobe de 2019 a 2024): aplicar linha etária da PNS 2019 ao coorte de 2026 confunde efeito de idade com período/coorte. A hierarquia DF>CO>Brasil mistura composições populacionais distintas. **Impacto.** Viés de nível por fator e de composição entre fatores pareados; não se cancelam no produto. **Remédio.** Janela temporal máxima declarada por bloco, ajuste de tendência onde houver série, nota de defasagem no modal.

### 4.3 Falácia ecológica e MAUP

**Problema.** w_r, ρ_r, ε_r são agregados de RA aplicados homogeneamente a indivíduos. **Mecanismo.** Robinson (1950): correlação ecológica ≠ individual — P(raça|renda,RA=r) da média oculta a segregação intra-RA, justamente onde renda e raça co-variam mais; cada célula N·f é imputação ecológica. King (1997): viés de agregação não se remove por suposição. Openshaw (1984): o resultado depende da partição — 35 RAs é escolha de zona; reagrupar altera o KPI sem alterar a realidade (MAUP de zona e classificação). **Impacto.** Contagens por RA só valem se a composição intra-RA igualar a média — a segregação nega. **Remédio.** Hierárquicos com componente intra-RA; sensibilidade a reagrupamentos.

### 4.4 Matrizes ad hoc e consistência de marginais

**Problema.** A conjunta renda×escolaridade não é estimada: reweighta-se a matriz base por multiplicadores ρ_r·ε_r e pela razão renda total/per capita, sem garantir que as marginais de p̂ reproduzam as publicadas por RA. **Mecanismo.** O reweighting linear altera marginais e dependência sem controle. Cada matriz cobre um par (renda×edu; civil×filhos; raça×renda); sem uma conjunta única por trás delas, condicionamentos encadeados podem ser inconsistentes. A renda ainda reaparece como peso dentro do fator de raça — inofensivo sob linearidade, indevido se as matrizes divergirem. **Impacto.** Erro correlacionado entre cenários: presets movem T por artefato de inconsistência, não por demografia. **Remédio.** IPF/raking sobre uma tabela de contingência unificada, convergindo a todas as marginais e 2-vias.

### 4.5 Altura: normal truncada nacional e cauda dominante

**Problema.** Altura tratada como Normal nacional sem estrutura por idade, coorte ou renda, em auto-relato. **Mecanismo.** Há gradiente secular e socioeconômico (nutrição), e correlação de estatura com renda/raça já filtradas; o auto-relato infla μ dos homens ~1 cm (nota do próprio código). A cauda é o ponto frágil: para mulheres (μ=161, σ=6,5), P(altura ≥ 178) ≈ 0,4%; como ∂ln[1−Φ(z)]/∂μ = −z/σ ≈ −2,6/6,5 para z = 2,6, um erro de 1 cm em μ desloca a cauda superior em ~33%; filtros "178–186" decidem-se por ~4 em cada 1.000 células. **Impacto.** Gargalos de presets altos governados por parâmetro cuja incerteza iguala o deslocamento. **Remédio.** Quantis condicionais por idade/sexo de antropometria medida (PNS), erro de medida modelado, (μ,σ) incertos.

### 4.6 Raça×renda×sexo sem microdados

**Problema.** P(raça|renda,sexo) é aproximação B declarada ("sem microdados públicos"), padrão nacional com faixa ±20%. **Mecanismo.** O filtro renda alta×raça empilha três dependências: condicional estimada × seleção de renda × condicionamento escolar. A autodeclaração de cor/raça flui entre censos (2010→2022, mudança de contexto da pergunta) e afeta as linhas não parametricamente; a engine usa o valor pontual, ignorando a faixa ±20% que ela mesma declara. **Impacto.** Erro de 10–20% no KPI em presets com seleção racial, sem sinal definido. **Remédio.** Estimar a condicional em microdados PNAD/DF com amostra grande, reportar intervalo, calibrar por raking onde houver marginais.

### 4.7 Comportamentos auto-relatados e cenários IST

**Problema.** Infidelidade, IST, tabagismo e antecedentes misturam constructos e períodos de referência: "diagnosticado alguma vez" vs "atual" vs "últimos 30 dias". **Mecanismo.** Desejabilidade social (Tourangeau & Yan, 2007) deprime relatos de infidelidade e fumo e infla "sem IST"; C2 (~38–52%) mede exposição acumulada a vírus majoritariamente transitório (HPV — Forman et al., 2012), não infecciosidade atual; logo "sem IST" em C2 remove ~metade do pool, filtrando traço quase universal como se fosse raro; Malta et al. (2010) documentam subestimação sistemática nesses inquéritos. **Impacto.** Erro de constructo, não só de medição, no maior gargalo do funil. **Remédio.** Separar constructos (infecção atual, infecciosidade estimada, histórico), período de referência explícito no filtro, C1 como padrão, C2 rotulado "histórico amplo".

### 4.8 Compounding multiplicativo de erros

**Problema.** T é produto de 10–15 fatores com incerteza B/C; o KPI não exibe intervalo. **Mecanismo.** Erros relativos se compõem multiplicativamente: sistemáticos correlacionados escalam como ∏(1+δᵢ) — 12 fatores a ±20% dão (1,2)¹² ≈ 8,9; independentes, como √(Σδᵢ²) ≈ ±0,7; correlação positiva entre δ's aproxima o regime do primeiro. Três algarismos significativos convivem com faixas de ±20%: precisão aparente. **Impacto.** Vieses pequenos por fator (desejabilidade, altura, raça) viram erro de ordem de grandeza na cauda do funil. **Remédio.** Monte Carlo com distribuições paramétricas por fator (Beta sobre taxas, Normal sobre μ,σ), mediana e IC95% no KPI.

### 4.9 Sensibilidade local one-at-a-time

**Problema.** A sensibilidade remove um filtro por vez, Top 4 por delta. **Mecanismo.** O modelo não é aditivo: o efeito de remover "altura ≥ 178" depende de "renda ≥ 10k" estar ativo quando entram as matrizes de correlação; interações de ordem ≥ 2 são invisíveis ao esquema OAT (Saltelli et al., 2008). A decomposição de Sobol (1993) — Sᵢ (efeito principal) e S_Tᵢ (total) — existe para quantificar essa diferença. **Impacto.** Gargalos exibidos podem estar mal ordenados e superestimar a removibilidade de fatores interagentes. **Remédio.** Índices de Sobol de 1ª e total ordem por Monte Carlo sobre a caixa de premissas; tornado com variações conjuntas.

### 4.10 Funil sequencial e dependência de ordem

**Problema.** O funil exibe a base encolhendo "a cada critério". **Mecanismo.** A decomposição sequencial P(A∧B∧C) = P(A)·P(B|A)·P(C|A∧B) é permutação-dependente sob dependência: T final é invariante (produto comuta), a atribuição visual por passo não é. Ademais o funil não é estimativa causal — "remover o filtro adiciona X pessoas" é contrafactual de interface, não efeito de intervenção sobre o mercado. As barras proporcionais da UI corrigem a distorção gráfica (Tufte, 2001; Few, 2006), não a semântica de ordem. **Remédio.** Decomposição simétrica (Shapley sobre fatores) ou marginais promediadas sobre ordens aleatórias.

### 4.11 Denominador e semântica do "1 em cada X"

**Problema.** Três bases convivem: população total (3.009.996, inclui crianças), adultos 18+, pool compatível sem filtro de idade. **Mecanismo.** D não tem restrição etária e T tem — descompasso que encolhe X; "1 em cada habitantes" com base total infla X em ~1,3× versus a base adulta. Nenhuma base é "errada"; o problema é o KPI não declarar a sua. **Remédio.** Base canônica única, declarada junto ao KPI, com linguagem de cenário.

### 4.12 Calibração externa e pesos amostrais ausentes

**Problema.** Não há validação externa do pipeline; pesos do desenho complexo não entram. **Mecanismo.** Tratar taxa amostral como probabilidade pontual ignora o efeito de desenho de Kish (1965; deff ≫ 1 em caudas e domínios pequenos) e os erros padrão das marginais de RA pequena (Varjão, Fercal, SIA, confiança C). Sem backtest contra microdados, a calibração global de T é desconhecida — teste decisivo dispensado por construção (Lohr, 2010). **Remédio.** Raking com pesos, bootstrap com estratos, validação preditiva contra microdados liberados.

### 4.13 Ética e comunicação

**Problema.** O rótulo "Quanto Sobra Para o Betinha" e o KPI "1 em cada X" comunicam pessoas como inventário de mercado. **Mecanismo.** Pareamento individual não é amostra da margem populacional: a leitura agregado→indivíduo é a generalização inversa da falácia ecológica; filtros de raça e de aparência (nota 1–10) operam sobre condicionais cujas inclinações por RA podem reproduzir estereótipo. As mitigações existentes (modal, badges A/B/C, aviso de subjetividade) são fracas: falta incerteza na tela. **Remédio.** Exibição padrão por ordem de grandeza ("milhares, centenas"), rótulo de cenário no KPI, aviso de que o modelo descreve a população, não o usuário.

## 5. Propostas de melhoria priorizadas

| Prioridade | Método | Esforço | Ganho |
| :--- | :--- | :--- | :--- |
| P1 | Microsimulação Monte Carlo + raking/IPF | Médio | Alto: substitui o produto, gera IC |
| P1 | Tabela conjunta única, consistente com todas as marginais | Baixo | Alto: elimina o reweighting ad hoc (4.4) |
| P2 | DAG + testes de independência; propensity scores | Baixo | Médio: fundamenta condicionamentos |
| P2 | Hierárquico bayesiano por RA/idade com pooling parcial | Médio | Alto: incerteza honesta e RAs pequenas |
| P2 | Pesos amostrais/deff + validação externa | Médio | Alto: calibração real |
| P2 | Sensibilidade global (Sobol) + tornado | Baixo | Médio: interações visíveis |
| P3 | Estimação de pequenas áreas (Rao & Molina) | Médio | Médio: cauda do mapa |
| P3 | Cópulas/log-lineares p/ renda·edu·raça | Médio | Médio: dependência não linear |
| P3 | Imputação múltipla + modelo de erro de medida | Médio | Médio: caudas confiáveis |
| P3 | Barras proporcionais com faixa de incerteza | Baixo | Médio: leitura honesta |
| P3 | Governança: linhagem, versão, confiança A/B/C, datas | Baixo | Médio: auditabilidade |

**5.1 Microsimulação com IPF.** Gerar população sintética individual-level cujas marginais e 2-vias coincidam com todas as fontes, ajustando iterativamente linhas e colunas (Deming & Stephan, 1940; Bishop et al., 1975) até convergência sobre todas as marginais e 2-vias usadas. Cada preset vira seleção sobre ~10⁶ registros; o KPI sai por mediana e IC95% com incerteza paramétrica. Resolve 4.1, 4.4, 4.8 e barateia a sensibilidade global.

**5.2 DAG e propensity scores.** Especificar o grafo entre escolaridade, renda, raça, religião, comportamento e IST (Pearl, 2009; Spirtes, Glymour & Scheines, 2000), evitando condicionar em colisores; se os números forem tratados como preditivos, balancear perfis com propensity scores (Rosenbaum & Rubin, 1983), dando definição contrafactual aos gargalos.

**5.3 Hierárquico bayesiano.** p(x|r,a,s) com efeitos aleatórios por RA e idade (Gelman et al., 2013): pooling parcial regulariza RAs pequenas (Varjão, Fercal, SIA) em vez de índices pontuais C; posterior predictive checks validam as matrizes; intervalos credíveis vêm do posterior. Para RA com amostra insuficiente, estimação de área pequena no estilo Rao & Molina (2003) substitui a inclinação multiplicativa ρ_r.

**5.4 Dependência não linear.** Cópulas (Sklar, 1959; Nelsen, 2006) ou log-lineares hierárquicos capturam caudas conjuntas de renda·escolaridade·raça que o reweighting linear não reproduz.

**5.5 Imputação e erro de medida.** Variáveis sem leitura DF (antecedentes, infidelidade) por imputação múltipla (Rubin, 1987; Little & Rubin, 2019) com sensibilidade a MNAR; modelo auto-relato→medida para altura e IMC (viés de direção conhecida; Malta et al., 2010).

**5.6 Sensibilidade global.** Índices de Sobol de 1ª e total ordem (Sobol, 1993; Saltelli et al., 2008) sobre a caixa de premissas (faixas simultâneas); tornado com pares conjuntos.

**5.7 Desenho e validação.** Pesos e deff por pesquisa (Kish, 1965; Lohr, 2010); backtest de presets sobre microdados PNAD; cobertura de IC contra replicatas. Visualização mantém barras proporcionais (decisão correta), adicionando caudas de incerteza e eixo log para gargalos de várias ordens (Tufte, 2001; Few, 2006). Governança: linhagem por taxa (arquivo→versão→data de acesso), política para confiança C (só em cenário, nunca em headline), changelog do dataset.

## 6. Plano de validação e métricas

| Verificação | Métrica | Aceite |
| :--- | :--- | :--- |
| Marginais reconstruídas × publicadas | erro relativo máx. por célula | < 1% (idade×sexo); < 3% (2-vias) |
| Soma por RA = total | erro relativo | < 1e-9 (já testado) |
| Cobertura de IC | cobertura empírica nominal | ≥ 90% nos backtests |
| Estabilidade temporal | ΔKPI trocando ano de fonte | reportada por bloco |
| Invariância de ordem | T sob permutação de filtros | idêntico; atribuição de funil via Shapley |
| Consistência de cenários | razão T(C1)/T(C2) × tabelas | dentro de 2× erro declarado |
| Posterior predictive | discrepância das 2-vias simuladas | sem padrão sistemático |

Ordem: marginais → réplicas MC → backtest com microdados → só então publicar KPI com intervalo.

## 7. Considerações éticas e limitações do próprio paper

Usam-se exclusivamente tabelas públicas agregadas: nenhuma pessoa identificável, sem resultados sobre indivíduos reais. A crítica ao objeto (4.13) é limite de comunicação, não recomendação de desuso. Limitações deste paper: (i) sem acesso a microdados, os vieses apontados foram caracterizados por mecanismo, não medidos; (ii) avaliou-se a arquitetura declarada, sem reanálise completa das fontes; (iii) os remédios têm custo computacional e de manutenção, e a sintética por IPF pode fabricar dependências se as 2-vias forem insuficientes; (iv) sem dado conjunto, interseções de dez variáveis permanecem modelagem, não medição.

## 8. Conclusão

As variáveis demográficas, socioeconômicas e comportamentais **não são independentes** condicionadas a idade/sexo/RA: renda, escolaridade, raça e tabagismo formam bloco correlacionado documentado, e o produto de marginais é substituto com erro desconhecido, composto multiplicativamente em 10–15 fatores. O modo **independente é contraste metodológico, não limite**: mede o que as correlações valeriam; não afirma nada sobre o mercado. Os números exibidos — inclusive os cenários IST, que divergem por fator ~20 na prevalência conforme a definição de "IST" — devem ser lidos como **cenários ilustrativos de um modelo gerador declarável, não estimativas pontuais**. Com microsimulação calibrada por IPF, incerteza propagada, sensibilidade global e validação externa, a calculadora pode migrar de ilustração precisa a estimativa honesta: número com intervalo, linhagem e limites ditos na tela.

## 9. Referências

- BISHOP, Y. M. M.; FIENBERG, S. E.; HOLLAND, P. W. **Discrete Multivariate Analysis: Theory and Practice**. Cambridge: MIT Press, 1975.
- CODEPLAN/IPEDF. **Pesquisa de Análise de Dados Distritais — PDAD 2024**. Brasília, 2024.
- DEMING, W. E.; STEPHAN, F. F. On a least squares adjustment of a sampled frequency table when the expected marginal totals are known. **The Annals of Mathematical Statistics**, v. 11, n. 4, p. 427–444, 1940.
- FEW, S. **Show Me the Numbers**: Designing Tables and Graphs to Enlighten. Oakland: Analytics Press, 2006.
- FORMAN, D. et al. Global prevalence and genotype distribution of cervical human papillomavirus infection in women with normal cervical cytology: a systematic review and meta-analysis. **The Lancet Infectious Diseases**, v. 12, n. 5, p. 345–355, 2012.
- GELMAN, A.; CARLIN, J. B.; STERN, H. S.; RUBIN, D. B. **Bayesian Data Analysis**. 3. ed. Boca Raton: Chapman & Hall/CRC, 2013.
- IBGE. **Censo Demográfico 2022**: população e idade por sexo (tabela SIDRA 9514). Rio de Janeiro, 2023.
- IBGE. **Pesquisa Nacional de Saúde — PNS 2019**. Rio de Janeiro, 2021.
- KING, G. **A Solution to the Ecological Inference Problem**: Reconstructing Individual Behavior from Aggregate Data. Princeton: Princeton University Press, 1997.
- KISH, L. **Survey Sampling**. New York: Wiley, 1965.
- LITTLE, R. J. A.; RUBIN, D. B. **Statistical Analysis with Missing Data**. 3. ed. Hoboken: Wiley, 2019.
- LOHR, S. L. **Sampling: Design and Analysis**. 2. ed. Belmont: Brooks/Cole, 2010.
- MALTA, D. C.; ANDRADE, S. C.; CLARO, R. M.; BERNAL, R. T. I.; MONTEIRO, C. A. Validade do peso e da altura auto-relatados: o Vigitel. **Revista de Saúde Pública**, v. 44, n. 5, p. 856–864, 2010.
- MINISTÉRIO DA SAÚDE (BRASIL). **Vigitel — Vigilância de Fatores de Risco e Proteção para Doenças Crônicas por Inquérito Telefônico**: Brasília. Série anual, edições 2023–2024.
- NELSEN, R. B. **An Introduction to Copulas**. 2. ed. New York: Springer, 2006.
- OPENSHAW, S. **The Modifiable Areal Unit Problem**. CAT Monograph 38. Norwich: Geo Books, 1984.
- PEARL, J. **Causality**: Models, Reasoning, and Inference. 2. ed. Cambridge: Cambridge University Press, 2009.
- RAO, C. R.; MOLINA, I. **Small Area Estimation**. New York: Wiley, 2003.
- ROBINSON, W. S. Ecological correlations and the behavior of individuals. **American Sociological Review**, v. 15, n. 3, p. 351–357, 1950.
- ROSENBAUM, P. R.; RUBIN, D. B. The central role of the propensity score in observational studies for causal effects. **Biometrika**, v. 70, n. 1, p. 41–55, 1983.
- RUBIN, D. B. **Multiple Imputation for Nonresponse in Surveys**. New York: Wiley, 1987.
- SALTELLI, A. et al. **Global Sensitivity Analysis: The Primer**. Chichester: Wiley, 2008.
- SIMPSON, E. H. The interpretation of interaction in contingency tables. **Journal of the Royal Statistical Society, Series B**, v. 13, n. 2, p. 238–241, 1951.
- SKLAR, M. Fonctions de répartition à n dimensions et leurs marges. **Publications de l'Institut Statistique de l'Université de Paris**, v. 8, p. 229–231, 1959.
- SOBOL', I. M. Sensitivity estimates for nonlinear mathematical models. **Mathematical Modelling and Computational Experiments**, v. 1, n. 4, p. 407–414, 1993.
- SPIRTES, P.; GLYMOUR, C.; SCHEINES, J. **Causation, Prediction, and Search**. 2. ed. Cambridge: MIT Press, 2000.
- TOURANGEAU, R.; YAN, T. Sensitive questions in surveys. **Psychological Bulletin**, v. 133, n. 5, p. 859–883, 2007.
- TUFTE, E. R. **The Visual Display of Quantitative Information**. 2. ed. Cheshire: Graphics Press, 2001.
- YULE, G. U. Notes on the theory of association of attributes in statistics. **Biometrika**, v. 2, n. 2, p. 121–134, 1903.
