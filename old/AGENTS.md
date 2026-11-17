# AGENTS.md — demografia-demagoga

## Repo shape
Three Markdown documents. No code, build, tests, lint, or git. Nothing to run; work is writing and reconciling prose in **pt-BR**.

| File | Role |
| --- | --- |
| `estudo_demografico_e_comportamental_distrito_federal.md` | Canonical report: 10 funnel stages, consolidated table (§3), RA table (§4), limitations (§5), references (§6) |
| `data.md` | Condensed numeric mirror: same funnel + RA tables, plus the Cenário 1 "de fato / no papel" split |
| `PLAN.md` | Plano consolidado em pt-BR: Fases 1–5, equação de reciprocidade, próximos passos, convenções de edição; §5 documenta papéis dos arquivos e regras de sincronização |

## Sync rules (easy to break)
- `data.md` §1–§2 restate the report's §3–§4 tables nearly verbatim. Edit one → edit the other; keep row order, ranges, and labels identical.
- `data.md` splits Cenário 1 into "solteiras de fato ~15.500–17.600" and "no papel ~19.600–21.550"; the report only gives the combined ~15.500–21.550. Intentional, not a contradiction. Do not merge or "fix".
- RA weights must sum to 100,0%, and RA Cenário 1/2 columns must total the funnel totals (~15.500–21.550 / ~7.900–11.050).
- `PLAN.md` §5.2 restates the table-sync rules; update both places if the rules change.

## Content conventions
- Every figure is a range plus a named source (IBGE, PDAD/IPEDF, Vigitel, PNS, POP-Brasil, Estudo Mosaico 2.0, Infopen, FBSP). Unsourced numbers violate the document's method.
- Base year 2026; total DF population 3.009.996; cohort = women aged 25–29.
- Cenário 1 = excludes only chronic/systemic STIs (HIV, hepatites B/C, sífilis ativa). Cenário 2 = excludes all STIs, including HPV and herpes.
- Filters multiply as independent probabilities. §5 of the report already concedes positive correlation and states real values sit near the upper bound — do not repeat or relocate that caveat.
- Share-of-DF quoted with 2 decimals: 0,51%–0,72% (C1), 0,26%–0,37% (C2).

## Formatting
- `#` title, numbered `## N.` sections, `###` sub-steps, `---` separators, tables left-aligned with `| :--- |`.
- pt-BR typography: decimal comma, dot thousands (`3.009.996`), `~` for approximations.
- Report bolds numeric cells in its tables; `data.md` leaves them plain. Preserve each file's existing style when editing.

## Tone
Subject is a deliberately blunt partner-market funnel (screening on STIs, criminal record, IMC, income). Keep the analytical framing neutral: no moral commentary, no softening of criteria, no added disclaimers unless asked.
