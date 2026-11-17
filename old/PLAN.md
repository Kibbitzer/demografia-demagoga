# Plano de Expansão Metodológica — Estudo Demográfico e Comportamental do DF

## 1. Objetivo

Este documento estrutura a segunda fase do estudo demográfico e comportamental aplicado ao Distrito Federal. A primeira etapa estabeleceu a linha de base populacional (filtrada por idade, sexo, estado civil formal, histórico de fidelidade, escolaridade, antecedentes criminais, saúde sexual, orientação sexual e IMC), consolidada em `estudo_demografico_e_comportamental_distrito_federal.md` e `data.md`.

Esta fase mapeia **novas dimensões estatísticas** necessárias para estimar com maior precisão a disponibilidade real e a compatibilidade bilateral de parceiras em potencial.

---

## 2. Roadmap de Novos Filtros e Dimensões Analíticas

### Fase 1: Disponibilidade Relacional Real (O "Vácuo Censitário")

Os dados censitários oficiais (IBGE) identificam apenas o estado civil formal e a coabitação (união consensual), deixando uma lacuna significativa sobre o status afetivo real.

* **1.1. Namoros sem Coabitação:**
  * *Premissa:* Na faixa etária de 25 a 29 anos, uma parcela expressiva de mulheres classificadas como "solteiras" pelo IBGE encontra-se em relacionamentos monogâmicos fechados sem morar junto.
  * *Estimativa de Impacto:* Descarte estimado de **30% a 40%** da base restante.
* **1.2. Indisponibilidade Voluntária (Intenção):**
  * *Premissa:* Parcela de solteiras sem namoro que não está ativa na busca por parceiros (foco exclusivo em carreira, pós-graduação, concursos públicos ou período sabático afetivo).
  * *Fontes de Referência:* Levantamentos comportamentais de mercado (Datafolha, Pew Research Center adaptado ao contexto urbano brasileiro) e pesquisas de comportamento em plataformas digitais.

### Fase 2: Histórico Familiar e Projeto Reprodutivo

* **2.1. Presença de Filhos (Maternidade Prévia):**
  * *Premissa:* Filtragem baseada na existência ou não de filhos de relacionamentos anteriores. Embora o recorte de ensino superior no DF adie a maternidade, há uma fração residual relevante.
  * *Fontes de Referência:* IBGE (Censo Demográfico 2022 — Fecundidade) e PDAD/IPEDF (Composição Domiciliar por RA).
* **2.2. Alinhamento sobre Filhos Futuros:**
  * *Premissa:* Compatibilidade entre o desejo de ter filhos no futuro versus a opção *childfree* (não ter filhos), fator crítico para relacionamentos de longo prazo.

### Fase 3: Estilo de Vida, Hábitos e Saúde Mental

* **3.1. Tabagismo e Consumo Abusivo de Álcool:**
  * *Premissa:* Exclusão de fumantes habituais (~6% a 8% das mulheres adultas no DF) e consumo abusivo/episódico pesado de álcool (~14% a 17%), dependendo do grau de tolerância definido.
  * *Fontes de Referência:* Ministério da Saúde (*Vigitel Brasil — Distrito Federal*).
* **3.2. Uso de Substâncias Ilícitas:**
  * *Premissa:* Estimativa de consumo regular de substâncias ilícitas na faixa etária jovem adulta.
  * *Fontes de Referência:* Fiocruz (*Levantamento Nacional sobre o Uso de Drogas pela População Brasileira - LNUD*) e SENAD.
* **3.3. Nível de Atividade Física / Sedentarismo:**
  * *Premissa:* Utilizado como *proxy* de alinhamento de rotina e cuidados com a saúde (~40% a 45% das mulheres com alta escolaridade no DF atingem a recomendação semanal da OMS).
  * *Fontes de Referência:* Vigitel / Ministério da Saúde.
* **3.4. Saúde Mental Severa / Não Tratada:**
  * *Premissa:* Prevalência de transtornos psiquiátricos incapacitantes ou sem acompanhamento clínico adequado.
  * *Fontes de Referência:* IBGE (*Pesquisa Nacional de Saúde - PNS — Percepção do Estado de Saúde e Doenças Crônicas*) e OMS.

### Fase 4: Alinhamento Cultural, Religioso e Ideológico

* **4.1. Religiosidade e Endogamia Religiosa:**
  * *Premissa:* Afiliação religiosa (católica, evangélica, espírita, matriz africana, sem religião/ateia) e grau de praticância. No DF, o crescimento do segmento evangélico (~28% a 30%) implica forte preferência por parceiros da mesma denominação.
  * *Fontes de Referência:* IBGE (Censo Demográfico 2022 — Características Gerais da População e Religião).
* **4.2. Espectro Político e Valores Sociais:**
  * *Premissa:* Alinhamento em valores morais, visão de mundo e posicionamento político, variáveis que operam como filtros de triagem inicial em ambientes urbanos polarizados como Brasília.
  * *Fontes de Referência:* Datafolha, Ipec e estudos de comportamento eleitoral/social no DF.

### Fase 5: Estabilidade Socioeconômica e Patrimonial

* **5.1. Ocupação e Estabilidade de Renda:**
  * *Premissa:* Diferenciação entre servidoras públicas estatutárias, profissionais do setor privado/liberais, empreendedoras e desempregadas/subocupadas, considerando a estrutura econômica singular de Brasília.
  * *Fontes de Referência:* IBGE (PNAD Contínua) e IPEDF (PDAD — Trabalho e Rendimento).
* **5.2. Saúde Financeira:**
  * *Premissa:* Exposição a endividamento severo ou inadimplência crônica.
  * *Fontes de Referência:* CNC (*Pesquisa de Endividamento e Inadimplência do Consumidor - PEIC*) e Serasa Experian.

---

## 3. Modelagem Matemática: O Fator de Reciprocidade (Equação de Drake Relacional)

Todos os filtros aplicados até a Fase 5 calculam apenas a **probabilidade unilateral** ($P_{uni}$), ou seja, o universo de mulheres que atendem aos critérios definidos pelo observador. Para estimar o universo real de viabilidade ($N_{final}$), o modelo deve incorporar a **compatibilidade bilateral**:

$$N_{final} = N_{filtrado} \times P_{reciprocidade} \times P_{exposicao}$$

Onde:

* **$N_{filtrado}$:** População resultante após a aplicação de todos os filtros objetivos e subjetivos.
* **$P_{reciprocidade}$ (Atração e Critérios Mútuos):** Probabilidade de que o observador também atenda aos critérios etários, estéticos, socioeconômicos, culturais e comportamentais exigidos por essas mulheres. Na literatura de modelagem probabilística aplicada a encontros (como o modelo de Peter Backus), esse fator costuma situar-se entre **5% e 15%** do grupo filtrado.
* **$P_{exposicao}$ (Fator de Encontro / Acessibilidade):** Probabilidade logística de cruzamento social no espaço urbano (frequência nos mesmos círculos sociais, locais de trabalho, eventos, bairros ou algoritmos de aplicativos de relacionamento).

---

## 4. Plano de Execução e Próximos Passos

1. **Definição de Parâmetros Pessoais (Calibração):** Estabelecer quais critérios das Fases 1 a 5 são *eliminatórios* (filtros rígidos) e quais são apenas *preferenciais* (pesos probabilísticos).
2. **Coleta de Microdados Complementares:** Extrair os percentuais exatos da PDAD/IPEDF e do Censo 2022 para religião, fecundidade e renda na faixa de 25 a 29 anos no DF.
3. **Ajuste de Correlação Multivariada:** Aplicar fatores de correção para evitar dupla contagem (ex.: mulheres com ensino superior no DF têm menor taxa de tabagismo e menor fecundidade precoce do que a média geral, exigindo ajuste nos multiplicadores).
4. **Atualização do Relatório Principal:** Integrar os novos resultados numéricos e atualizar a distribuição por Região Administrativa no relatório canônico `estudo_demografico_e_comportamental_distrito_federal.md` e no espelho numérico `data.md`.

---

## 5. Estado do Repositório e Convenções de Edição

### 5.1. Papéis dos arquivos

| Arquivo | Papel |
| :--- | :--- |
| `estudo_demografico_e_comportamental_distrito_federal.md` | Relatório canônico: 10 etapas do afunilamento, tabela consolidada (§3), tabela por RA (§4), limitações (§5), referências (§6) |
| `data.md` | Espelho numérico condensado: mesmas tabelas de afunilamento e por RA, mais o desdobramento do Cenário 1 em "solteiras de fato" e "no papel" |
| `PLAN.md` | Este documento: roadmap das Fases 1–5, equação de reciprocidade, próximos passos e convenções |
| `AGENTS.md` | Instruções operacionais para sessões de agente neste repositório |

### 5.2. Regras de sincronização

* `data.md` (§1–§2) reproduz quase literalmente as tabelas do relatório (§3–§4). Editar um arquivo exige editar o outro, mantendo ordem das linhas, faixas e rótulos.
* `data.md` desdobra o Cenário 1 em "solteiras de fato" (~15.500 a 17.600) e "no papel" (~19.600 a 21.550); o relatório apresenta apenas a faixa combinada (~15.500 a 21.550). O desdobramento é intencional, não uma contradição. Não unificar nem "corrigir".
* Os pesos por RA devem somar 100,0%, e as colunas de Cenário 1/2 por RA devem totalizar as faixas do afunilamento (~15.500 a 21.550 / ~7.900 a 11.050).

### 5.3. Convenções de conteúdo

* Todo número é uma faixa acompanhada de fonte nomeada (IBGE, PDAD/IPEDF, Vigitel, PNS, POP-Brasil, Estudo Mosaico 2.0, Infopen, FBSP). Número sem fonte quebra o método do documento.
* Ano-base 2026; população total do DF 3.009.996; coorte = mulheres de 25 a 29 anos.
* Cenário 1 exclui apenas ISTs crônicas/sistêmicas (HIV, hepatites B/C, sífilis ativa). Cenário 2 exclui todas as ISTs, inclusive HPV e herpes.
* Os filtros são multiplicados como probabilidades independentes; a §5 do relatório já admite correlação positiva e afirma que os valores reais tendem ao limite superior da faixa. Não repetir nem deslocar essa ressalva.
* Participação na população do DF com 2 casas decimais: 0,51%–0,72% (C1) e 0,26%–0,37% (C2).

### 5.4. Formatação

* Título `#`, seções numeradas `## N.`, subetapas `###`, separadores `---`, tabelas alinhadas à esquerda com `| :--- |`.
* Tipografia pt-BR: vírgula decimal, ponto de milhar (`3.009.996`), `~` para aproximações.
* O relatório destaca números em negrito nas tabelas; `data.md` não. Preservar o estilo de cada arquivo ao editar.

### 5.5. Tom

O tema é um funil de mercado relacional deliberadamente direto (triagem por ISTs, antecedentes criminais, IMC, renda). Manter o enquadramento analítico neutro: sem comentário moral, sem suavizar critérios, sem ressalvas adicionais não solicitadas.

---

## 6. Página Web Interativa (fase 3)

### 6.1. Objetivo

Site estático que recalcula o afunilamento em tempo real. A interface deve deixar óbvio que os controles funcionam: caixas de seleção visíveis, valor restante atualizado imediatamente, gráfico redesenhado, diferença causada pelo último filtro e fonte identificável.

Mais flexível que o relatório: sexo alternável, idade simples, seleção por faixas de IMC e renda quando sustentadas por dados, seleção por RA e possibilidade de acrescentar filtros sem reescrever o núcleo. Usar dados rastreáveis de fontes consolidadas (IBGE/SIDRA, PDAD-A/IPEDF, Vigitel, PNS, POP-Brasil, Mosaico 2.0), pt-BR e sem backend.

### Diagnóstico do estado atual

* `index.html` tem apenas contêineres vazios para `#filtros`, `#ras` e os gráficos. A aplicação cria controles e carrega cinco JSONs depois que o módulo JS inicia. Se o módulo não carregar, se a página for aberta por `file://` ou se uma requisição falhar, a página fica quase vazia; não há estado de carregamento nem aviso estático útil. Isso é hipótese provável para “não vejo controles”, a confirmar no navegador antes de reescrever a lógica.
* `assets/app.js` reúne carregamento, estado, modelo numérico, geração de controles, URL e gráficos em um arquivo de ~668 linhas. Há caixas e listeners gerados dinamicamente, mas não há teste de navegador que prove que aparecem, respondem e redesenham os gráficos.
* `assets/styles.css` é um reset visual mínimo. Não define hierarquia para resultados, grupos de filtros, controles, alertas, fontes ou gráficos; o layout parece formulário sem acabamento. Os gráficos estão depois de todos os filtros e podem ficar fora da área inicial.
* Há filtros de checkbox no código, mas só um corte de IMC (`IMC < 30`); não há distribuição verificada para faixas finas de IMC. Renda, RA e várias taxas são marginais, não cruzamentos reais com idade/sexo. A UI deve declarar isso, não sugerir precisão inexistente.
* `data/renda.json` soma 99,98% por arredondamento; selecionar todas as classes deve ser operação neutra exata, não reduzir a população 0,02%. A distribuição atual é feminina, sem recorte de idade, mas o código aplica-a também a homens.
* Com escala 2026 ligada, o contador é projetado para 2026, mas o percentual exibido usa o total censitário de 2022. Numerador e denominador precisam usar o mesmo ano/base.
* `data/fontes.json` contém URLs genéricas ou nulas para vários estudos. O painel de fontes precisa apontar para a tabela/relatório exato ou marcar claramente que a taxa não pode ser ativada até a referência ser verificada.

### 6.2. Arquitetura

Manter site estático, sem backend e sem build. Usar HTML semântico, módulos ES e **Pico CSS** como base visual (CSS classless, arquivo local e versão fixa, não CDN), com poucas regras próprias para manter o visual simples tipo XKCD. Vendorização deve incluir versão e licença. Gráficos com **chart.xkcd 2.0.12** já vendorizado (MIT, `assets/vendor/chart.xkcd.esm.js` + licença). Nenhuma requisição externa em runtime; servir por `python3 -m http.server 8000`.

```
index.html
assets/styles.css                          ajustes pequenos sobre o framework
assets/js/app.js                            inicialização e ligação dos módulos
assets/js/data.js                           carregamento e validação de JSON
assets/js/state.js                          estado, presets, query string
assets/js/engine.js                         cálculo puro, sem DOM
assets/js/filters.js                        render genérico dos controles
assets/js/charts.js                         render chart.xkcd e estados vazios
assets/vendor/pico.min.css                  framework CSS pinado, com licença
assets/vendor/chart.xkcd.esm.js             chart.xkcd 2.0.12 (pinado)
assets/vendor/chart.xkcd.LICENSE            MIT
data/populacao.json                         Censo 2022 tabela 9514: idade simples × sexo, DF
data/filtros.json                           taxas e definição dos controles
data/fontes.json                            procedência das taxas
data/renda.json                             classes de rendimento per capita
data/ra.json                                pesos por Região Administrativa
scripts/fetch_sidra.py                      baixa 9514 e grava data/populacao.json
scripts/verify_parity.py                    recalcula o funil e compara com referência
tests/                                      testes unitários e smoke tests do navegador
README.md                                   como servir, atualizar e testar
```

Responsabilidade modular: filtro simples entra como registro em `data/filtros.json` + fonte em `data/fontes.json`; não exige alterar `engine.js` nem duplicar markup. Novo tipo de controle exige uma implementação genérica em `filters.js`, não um ramo específico por nome de filtro em `app.js`. O motor numérico não importa DOM nem biblioteca de gráficos.

Regras duras: nenhum número demográfico ou prevalência hardcoded em JS; taxas e faixas vêm de `data/*.json`. Cada filtro tem `id`, rótulo, grupo, tipo de controle, semântica de aplicação, aplicabilidade por sexo/idade, taxa/faixa, fonte, confiança e nota de limitações. Validar o esquema ao carregar; dados inválidos mostram erro compreensível, não falham silenciosamente.

### 6.3. Modelo de cálculo

Base: `N0(sexo, idadeMin, idadeMax)` = soma das idades simples inclusivas em `data/populacao.json`. Calcular mulheres e homens separadamente antes de somar para "ambos". Escala 2026 opcional; o denominador do percentual deve ser o total da mesma população/ano selecionado. Exibir ano-base, fator de escala e contagem de partida.

Padronizar semântica dos dados antes de mexer na UI: cada taxa representa a **prevalência da condição descrita**, não a fração restante. Campo `operacao` = `excluir` (fator de manutenção `1 − prevalencia`) ou `exigir` (fator `prevalencia`). Exemplo: "Fumantes" + excluir usa prevalência 6%–8%; "Sem fumantes" + exigir usa prevalência 92%–94%. Não armazenar complemento como se fosse taxa do filtro e não mostrar 92%–94% como percentual de fumantes.

Contrato mínimo de filtro em `data/filtros.json`: `id` estável, `rotulo`, `descricao`, `grupo`, `controle` (`checkbox`, `faixa`, `multiseleção` ou `cenário`), `operacao`, `ativo_por_padrao`, valores/limites, taxas por sexo/estrato, `fonte`, `confianca`, `aplicabilidade` e `nota`. O motor não conhece ids como `fumantes`, `ist_c1` ou `imc_abaixo_30`; comportamentos especiais são declarados nos dados e implementados uma vez por tipo genérico.

`N_min` e `N_max` usam intervalos publicados. São limites de cenário calculados sob independência aproximada, **não intervalos de confiança**. Taxas sem cruzamento idade×sexo usam a margem disponível e recebem aviso visível "taxa não estratificada; independência presumida". Taxa desconhecida para um sexo não é copiada do outro: o filtro fica indisponível naquele modo.

Renda: usar classes publicadas em salários mínimos. Todas as classes selecionadas = fator 1 exato, independentemente da soma arredondada em 99,98%; subconjunto = soma dos percentuais selecionados / total publicado, com nota de universo e recorte. A distribuição atual é de mulheres sem recorte etário; não aplicar a homens nem anunciar estimativa por idade até obter cruzamento adequado da PDAD-A.

RA: seleção só pode reduzir população usando distribuição ponderada compatível com o sexo/faixa etária, se disponível. Até obter os microdados, os pesos agregados do relatório §4 são **aproximação de baixa confiança**, identificados como tais; selecionar todas as RAs = fator 1 exato. Não usar rótulo "contagem por RA" para estimativa calculada com pesos gerais.

IMC: preservar o corte verificável atual (`IMC < 30`, Vigitel) até apurar distribuição oficial por faixas. Buscar microdados ou tabelas desagregadas do Vigitel DF; se as faixas ajustáveis solicitadas não puderem ser derivadas com base publicável, mostrar somente os cortes disponíveis e explicar a limitação. Nunca fabricar `<18,5`, `18,5–24,9`, etc. a partir da prevalência de obesidade agregada.

Filtros de filhos, saúde mental, religião e outras dimensões entram só quando há taxa citável para o universo relevante; a ausência de dado é mostrada, não substituída por estimativa inventada. Bloco de reciprocidade/exposição permanece separado e desligado por padrão; é modelo de encontro, não filtro demográfico.

### 6.4. Filtros da v1

| Grupo | Controle/filtro inicial | Situação atual | Regra de entrada |
| :--- | :--- | :--- | :--- |
| População | Sexo: mulheres / homens / ambos | Censo 2022 t. 9514 | Calcular cada sexo separado; descrever ano da base. |
| População | Idade mínima/máxima e presets | Censo 2022 t. 9514 | Idades simples; limites inclusivos e sincronizados. |
| População | Região Administrativa | PDAD-A 2024 / relatório §4 | Mostrar baixa confiança enquanto não houver pesos cruzados. |
| Status | Estado civil e união consensual | Censo / PDAD-A | Separar estado civil formal de união/coabitação. |
| Status | Histórico de infidelidade | Mosaico 2.0 | Declarar recorte geográfico e população da pesquisa. |
| Status | Namoro sem coabitação | Premissa | Desligado por padrão e identificado como hipótese, não dado oficial. |
| Socioeconômico | Escolaridade | Censo / PDAD-A | Aplicar só em estratos publicados. |
| Socioeconômico | Faixa de renda | Censo SIDRA 10296 / PDAD-A | Controles de classe; feminina e sem idade até validar cruzamento. |
| Saúde | Cenário de IST C1/C2 | POP-Brasil / MS | Cenários mutuamente exclusivos, com definição visível. |
| Saúde | Faixa de IMC | Vigitel DF | Controle por bandas só após verificar dados oficiais; manter corte <30 agora. |
| Saúde | Tabagismo, álcool e atividade física | Vigitel DF | Marcar taxa estratificada ou marginal e semântica de prevalência. |
| Outros | Antecedentes criminais | Infopen / FBSP | Proxy de confiança C, claramente rotulado. |
| Outros | Orientação sexual | PNS / Mosaico 2.0 | Respeitar categoria publicada; mostrar recorte e confiança. |
| Futuro | Filhos, saúde mental, religião | Fontes a identificar | Não ativar sem taxa e metodologia verificáveis para o DF. |

Confiança: A = recorte direto DF; B = fonte nacional/proxy ou agregado incompatível com algum seletor; C = hipótese/proxy frágil. Confiança e compatibilidade do estrato são coisas distintas: exibir ambos. Sexo sem taxa verificada fica indisponível; renda também deve ser condicionada ao sexo com que foi coletada.

### 6.5. Interface

Princípio visual: XKCD simples, funcional, sem tentar imitar o desenho do site inteiro. Fundo branco, texto quase todo preto, coluna central de largura moderada, linhas finas, links sublinhados, tipografia do sistema e ilustrações desenhadas apenas nos gráficos chart.xkcd. Pico CSS fornece estilo coerente para HTML semântico e formulários; CSS próprio fica pequeno e não cria um segundo framework visual. Sem gradientes, sombras pesadas, cartões decorativos, ícones sem função ou fonte remota.

Hierarquia da página, nesta ordem:

1. Título `Infimo nihil superest`, com hover para "Sobra nada para o betinha"; subtítulo curto com universo e data-base.
2. Resumo sempre visível: população restante em número grande, faixa min–max, percentual com denominador do mesmo ano, filtros ativos e botão "Limpar filtros" + "Preset do relatório".
3. Gráfico de população restante e gráfico de impacto, logo abaixo do resumo e antes do formulário. Não esconder os resultados depois de uma lista longa de controles.
4. Seletor de sexo e idade; ranges nativos com valores mostrados e presets.
5. Filtros organizados em grupos claros. Caixas de seleção nativas, uma por filtro, label clicável, estado ligado/desligado explícito, taxa aplicada, impacto após interação, confiança e link/nota da fonte. Mostrar os filtros principais sem exigir hover/tooltip.
6. Renda, IMC e RA em grupos próprios. Preferir checkboxes para classes/bandas, com "Selecionar todas" e "Limpar"; se o número de classes exigir range min/máx, mostrar limites atuais e permitir teclado.
7. Área "Como ler esta estimativa" com modelo de independência, diferença entre contagem censitária e taxa marginal e significado de confiança A/B/C.
8. Fontes recolhíveis no fim, mantendo visíveis publisher, ano, tabela, link e recorte usado.

Em desktop, distribuir controles em colunas moderadas sem comprimir rótulos; resultados e filtros não devem competir visualmente. Em largura ≤600 px, empilhar em uma coluna e garantir que os controles não causem rolagem horizontal. Rótulos e mensagens em pt-BR, contraste AA, foco de teclado visível, `aria-live="polite"` no resultado e nos avisos. Não exigir hover para descobrir o que uma opção faz.

Estados de página: `carregando` com mensagem visível; `pronto`; `sem resultados` (base zero ou intervalo vazio); `erro de dados` com instrução para servir via HTTP e atualizar. Incluir `<noscript>` e aviso inicial estático; não deixar os contêineres vazios parecerem página pronta.

### 6.6. Interações e componentes modulares

* Controles de filtros são gerados pelo esquema de dados, agrupados por `grupo`; o usuário vê checkboxes reais no DOM, e cada alteração atualiza número, gráfico, delta e URL na mesma ação.
* O grupo de IST usa `controle: "cenário"` e dados declarativos de exclusividade; não fazer o motor depender dos ids `ist_c1`/`ist_c2`.
* `checkbox` cobre um critério independente. `multiseleção` cobre classes de renda, RAs ou bandas de IMC. `faixa` cobre intervalos numéricos. Novo filtro de um tipo existente deve ser adicionável por JSON; só um novo tipo exige código de renderização genérico.
* Cada filtro exibe: o que liga/desliga, prevalência (ou taxa de manutenção) no universo de origem, parcela removida/mantida, variação no total calculado e confiança/estrato. Para filtro indisponível, explicar em texto o que falta e deixar o controle desabilitado.
* Controles "selecionar todas" e "limpar" precisam manter estado consistente; todas as classes de renda e todas as RAs devem equivaler exatamente a não aplicar aquele filtro.
* Estado completo em URL: sexo, faixa etária, escala, ids ativos, cenário, seleção de renda/IMC/RA. Validar querystring ao carregar e restaurar ao navegar com voltar/avançar.
* Mensagem do delta deve indicar direção e comparar o resultado anterior e posterior; não depender somente de `title`/tooltip.

### 6.7. Gráficos

* Usar `chartXkcd.Bar` vendorizado para a população restante por etapa e para o impacto marginal dos filtros ativos. Manter SVG acessível com título/descrição, rótulos curtos e formatação legível de milhares.
* Recriar/atualizar o gráfico sem acumular elementos SVG em cada clique. Tratar separadamente carregamento, erro do chart, nenhum filtro selecionado e valores iguais a zero; sempre deixar texto alternativo com o resultado numérico.
* A série "restante por etapa" deve refletir a ordem real de aplicação dos filtros. A série "impacto" deve calcular a diferença sem esconder filtros que aumentam população por serem critérios de inclusão.
* Testar a saída SVG real no navegador (ex.: `path`/elementos do gráfico presentes após carregar e depois de alternar filtro); existir um `<svg>` vazio não conta como gráfico renderizado.

### 6.8. Testes e critérios de aceite

Testar primeiro por navegador em servidor local; não assumir que `node --check` prova que módulo, JSON, controles e gráfico funcionam juntos. Usar Playwright como dependência de desenvolvimento somente se já houver ambiente Node; caso contrário, escolher um smoke test automatizável equivalente e documentar a dependência, sem incorporá-la ao site em runtime.

1. A página servida por `python3 -m http.server 8000` entra em `pronto`, carrega os cinco JSONs e mostra checkboxes; se aberta por `file://` ou com fetch falho, explica o problema.
2. Console sem exceções; rede runtime limitada aos arquivos locais do projeto; sem CDN. Verificar desktop e viewport móvel de 360 px.
3. O preset aparece e é utilizável; executar `scripts/verify_parity.py`. Comparar as referências numéricas do §6.11 e registrar que os valores recalculados da base censitária diferem do relatório Markdown em até ±5%, sem forçar os dados para igualar a estimativa antiga.
4. Alternar um checkbox de exemplo (fumantes) altera de forma visível o total, o delta, a série de população restante, a série de impacto e a URL. Desmarcar restaura o valor original dentro do arredondamento.
5. Trocar sexo, idade, cenário IST, classes de renda, IMC e RA atualiza resultado; seleção masculina não aplica taxa feminina. Controles sem dados verificáveis ficam claramente indisponíveis.
6. Selecionar todas as classes de renda ou todas as RAs não altera o resultado. Percentual do DF usa denominador compatível com a escala/ano selecionado.
7. O gráfico tem elementos desenhados após carga e atualiza sem duplicação de SVG/legendas; estado vazio mostra texto compreensível.
8. `data/fontes.json` resolve cada fonte usada; link direto/recorte ausente aparece como pendência e não como fonte validada.
9. Adicionar um filtro checkbox válido ao JSON, com fonte, faz surgir uma opção funcional sem editar `engine.js`, `app.js` ou markup por filtro.
10. Teclado, labels, foco, leitores de tela, contraste AA e hover do título funcionam; sem rolagem horizontal a 360 px.

### 6.9. Coleta e verificação de dados

1. População: `https://apisidra.ibge.gov.br/values/t/9514/n3/53/v/93/p/2022/c2/4,5/c287/all/c286/113635` (a variante com `c86` devolve HTTP 400). Validar soma 2.817.381 (Censo 2022). Registrar em `fontes.json` com data de acesso.
2. Vigitel 2024 DF: taxas de tabagismo, álcool, excesso de peso e obesidade por sexo e faixa etária, do relatório oficial; quando o recorte DF não for publicado, usar a taxa nacional e marcar confiança B.
3. PDAD-A 2024: escolaridade 25+ (38,8%), estado civil, fecundidade, renda por faixa e por RA, das tabelas do relatório DF.
4. PNS 2019 e Mosaico 2.0: orientação sexual e infidelidade; registrar se o recorte é DF ou nacional.
5. POP-Brasil/MS: prevalências de IST por cenário C1/C2.
6. Toda taxa entra com `min`, `max`, `fonte`, `estrato`, `confianca`. Valor sem fonte não entra no JSON.

### 6.10. Plano de execução

1. **Reproduzir o defeito atual:** servir por HTTP, abrir navegador, registrar console/rede e capturas desktop/móvel. Confirmar se o usuário abriu por `file://`, se algum JSON falha, se a importação do chart falha ou se os controles ficam apenas abaixo da dobra. Consertar causa observada antes de redesenhar.
2. **Fechar modelo e fontes:** harmonizar semântica de prevalência versus taxa mantida; corrigir renda neutra, denominador de percentual, aplicabilidade por sexo e aviso de independência; substituir URLs genéricas por referências diretas. Auditar quais variáveis podem realmente ser ajustadas com dados oficiais.
3. **Separar módulos:** mover estado/URL, cálculo, dados, render de filtros e gráficos para módulos pequenos. Adicionar validação do esquema e um filtro de demonstração cujo resultado seja testável.
4. **Aplicar layout:** vendorizar versão estável do Pico CSS + licença; refazer hierarquia em `index.html`/CSS; pôr resumo e gráficos acima das opções; renderizar filtros agrupados com checkbox e labels explícitos; incluir carregamento/erro/sem resultados.
5. **Tornar filtros extensíveis:** migrar `filtros.json` para contrato declarativo; tirar ramificações por id do app; implementar renderizadores genéricos para checkbox, faixa e multiseleção; manter filtros sem fonte em estado desativado/documentado.
6. **Validar em navegador:** testes de interação, chart SVG, querystring, sexo/idade/renda/IMC/RA, 360 px, contraste e acesso por teclado; executar teste de paridade e corrigir falhas reais.
7. **Documentar:** README com servidor local, atualização SIDRA, fontes não verificadas, arquitetura de módulos e receita para adicionar um filtro JSON sem alterar o núcleo; atualizar `AGENTS.md` com comandos e restrições atuais.

### 6.11. Valores verificados (referência legada para paridade)

Base Censo 2022, tabela 9514, DF:

* Total 2.817.381; fator de escala para 2026 = 3.009.996 / 2.817.381 = **1,068367**.
* Mulheres 25–29: 23.184 + 22.875 + 23.120 + 22.775 + 21.695 = **113.649** → escalado **121.419** (113.649 × 1,068367 = 121.418,84).
* Homens 25–29: **110.513**.

Divergência de base: o relatório usa ~126.000 mulheres, arredondando cada etapa para cima; com a base real o preset C1 cai ~3%. Manter a base real e documentar a diferença no `README.md`; não ajustar números para forçar igualdade.

Taxas de manutenção atualmente gravadas no JSON legado (mulheres, 25–29). Na migração de esquema, converter para prevalência da condição e preservar equivalência numérica; não interpretar a coluna como prevalência de exclusão:

| Filtro | manter min–max | Fonte | Conf. |
| :--- | :--- | :--- | :--- |
| Solteiras | 0,52–0,68 | Censo 2022 | A |
| Fidelidade | 0,698 | Mosaico 2.0 | B |
| Superior completo | 0,41–0,43 | Censo/PNAD | A |
| Antecedentes | 0,99–0,995 | Infopen/FBSP | C |
| IST C1 | 0,98 | POP-Brasil/MS | B |
| IST C2 | 0,50–0,52 | POP-Brasil/MS | B |
| Orientação | 0,975–0,985 | PNS/Mosaico | B |
| IMC < 30 | 0,86–0,90 | Vigitel | A |
| Fumantes | 0,92–0,94 | Vigitel | A |
| Álcool abusivo | 0,83–0,86 | Vigitel | A |
| Atividade física | 0,40–0,45 | Vigitel | B |
| Namoro sem coabitação | 0,60–0,70 | premissa, off | C |

Resultado esperado do preset: C1 **15.041–20.944**, C2 **7.674–11.113** (divergência ≤3% do relatório; C1 mínimo com margem de 0,04 p.p. em relação a ±3%, por isso a tolerância do verificador é ±5%).

Renda: Censo 2022, tabela 10296, mulheres DF, rendimento per capita, 11 classes (5,18 / 12,68 / 23,24 / 21,87 / 10,35 / 11,12 / 9,20 / 2,24 / 0,68 / 0,46 / 2,96%, incluindo sem rendimento). Confiança B: sem recorte de idade.

RA: pesos do relatório §4 somam 100,0%; valor por RA = peso × total do funil.

---

## 7. Redesenho da interface e auditoria de fontes (fase 4)

### 7.1. Problema de usabilidade

Hoje cada filtro aparece como uma caixa com o nome de uma característica ("Fumantes") mas aplica o complemento (mantém 92%–94%). O usuário não consegue dizer se marcar a caixa inclui ou remove a característica, e o percentual exibido contradiz o rótulo. A página também acumula controles antes dos resultados e não declara quais números foram conferidos.

### 7.2. Semântica explícita (tri-estado)

Cada critério vira uma característica com **prevalência `p`** da presença. O controle é tri-estado, por linha:

| Opção | Fator aplicado | Rótulo na UI |
| :--- | :--- | :--- |
| Ignorar | 1 | "não filtrar" |
| Exigir | `p` | "só quem tem" |
| Excluir | `1 − p` | "só quem não tem" |

Consequências obrigatórias:

* `data/filtros.json` passa a guardar `prevalencia` (não "fator de manutenção"), com `min`, `max` e opcional `padrao`, por sexo e por estrato.
* O motor deixa de interpretar `direcao`; a operação vem do estado da UI.
* Rótulo descreve a característica, nunca a ação: "Fumante", "Obesidade (IMC ≥ 30)", "Ensino superior completo", "Histórico de infidelidade", "Sem filhos", "Vive em união", "IST (cenário C1)", "Atividade física mínima".
* O percentual mostrado ao lado é sempre a prevalência da característica, com a frase curta do efeito: "excluir → remove 6%–8%".
* Filtro sem dado para o sexo selecionado fica visível, desabilitado, com o motivo escrito.

### 7.3. Auditoria de fontes (resultado desta revisão)

| Critério | Fonte declarada | Situação |
| :--- | :--- | :--- |
| Não vive em união (solteiras) | Censo 2022, SIDRA 10185 | **Verificado**: 50,5% mulheres, 59,3% homens, DF, 25–29 |
| Sem filhos | Censo 2022, SIDRA 10075 | **Verificado**: 58,4% mulheres, sem dado masculino |
| Ensino superior completo | Censo 2022, SIDRA 10061 | **Corrigido agora**: 41,7% mulheres, 31,0% homens (antes citava a 9514, que não tem escolaridade) |
| IMC < 30 | Vigitel DF | Não conferido nesta auditoria |
| Fumante | Vigitel DF | Não conferido nesta auditoria |
| Álcool abusivo | Vigitel DF | Não conferido nesta auditoria |
| Atividade física mínima | Vigitel DF | Não conferido; semântica original era ambígua |
| IST C1 / C2 | POP-Brasil / MS | Não conferido nesta auditoria |
| Histórico de infidelidade | Mosaico 2.0 | Não conferido; recorte DF a confirmar |
| Antecedentes criminais | Infopen / FBSP | Proxy nacional, confiança C |
| Orientação sexual | PNS 2019 | **Suspeita**: não há agregado de orientação sexual na PNS no SIDRA; confirmar ou remover |
| Namoro sem coabitação | Premissa | Sem fonte pública; manter desligado e rotulado como hipótese |

Regra nova: todo critério carrega `verificado: true|false` e a UI mostra o selo. Critério não verificado não entra no preset e não é apresentado como número consolidado.

### 7.4. Layout redesenhado

1. Cabeçalho enxuto: título com hover, subtítulo com universo e data-base, e o contador grande.
2. Faixa de resultado fixa (sticky no topo em telas altas): número restante, intervalo, % do DF, botão de preset e de limpar.
3. Gráfico único à esquerda e impacto por critério à direita, ambos acima dos controles; em telas estreitas, empilhados.
4. Controles em duas colunas com `<fieldset>` por grupo; cada linha tem o nome da característica, o tri-estado e a prevalência.
5. Painel lateral ou seção final "O que está sendo aplicado": lista só dos critérios ativos, com operação, fator e fonte.
6. Auditoria e limitações em seção recolhível, com selo de verificação por critério.

Manter estética simples tipo XKCD: branco, preto, uma coluna de leitura, bordas finas, tipografia do sistema e apenas os gráficos com traço à mão.

### 7.5. Critérios de aceite da fase 4

1. Nenhum controle ambíguo: cada linha mostra explicitamente "ignorar / só quem tem / só quem não tem".
2. Alterar o tri-estado muda contador, gráficos, delta e URL; estado é restaurável.
3. Preset reproduz o resultado atual conhecido (14.607–15.555 para C1) após a migração de prevalências.
4. Todo critério exibe fonte e selo de verificação; `verificado: false` também aparece no preset como indisponível.
5. Layout utilizável a 360 px, sem rolagem horizontal, resultados acima dos controles.
6. `python3 scripts/verify_parity.py` continua passando com as novas prevalências.
