#!/usr/bin/env python3
import json, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, "data")

def load(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f)

pop = load("populacao.json")
filtros = load("filtros.json")
renda = load("renda.json")
ra = load("ra.json")
fontes = load("fontes.json")

fonte_ids = {f["id"] for f in fontes["fontes"]}
erros = []
checks = []  # (label, esperado, calculado, ok)

def reg(label, exp, got, ok, tol_msg=""):
    checks.append((label, exp, got, ok))
    if not ok:
        erros.append(f"{label}: esperado {exp}, calculado {got}" + (f" ({tol_msg})" if tol_msg else ""))

# (a) base
total_ok = pop["total"] == 2817381 and pop["total_calculado"] == 2817381
reg("Base total", 2817381, pop["total"], total_ok)

fator = pop["escala_2026"]["fator"]
reg("Fator 2026", 1.068367, fator, abs(fator - 1.068367) < 1e-6)

mulheres = pop["agregados"]["mulheres_25_29"]
reg("Mulheres 25-29", 113649, mulheres, mulheres == 113649)

escalado_calc = mulheres * fator
reg("Escalado 25-29", 121419, escalado_calc, abs(escalado_calc - 121419) <= 1,
    f"diff {escalado_calc-121419:.2f}")

homens = pop["agregados"]["homens_25_29"]
reg("Homens 25-29", 110513, homens, homens == 110513)

# rates vs PLAN 6.9
ref_rates = {
  "solteiras": (0.505, 0.505, None),
  "fidelidade": (0.698, 0.698, None),
  "escolaridade_superior": (0.41, 0.43, None),
  "antecedentes_criminais": (0.99, 0.995, None),
  "ist_c1": (0.98, 0.98, None),
  "ist_c2": (0.50, 0.52, None),
  "orientacao_nao_exclusiva": (0.975, 0.985, None),
  "imc_abaixo_30": (0.86, 0.90, 0.88),
  "fumantes": (0.92, 0.94, None),
  "alcool_abusivo": (0.83, 0.86, None),
  "atividade_fisica_minima": (0.40, 0.45, None),
  "namoro_sem_coabitacao": (0.60, 0.70, None),
}
rates_ok = 0; rates_total = 0
for f in filtros["filtros"]:
    fid = f["id"]
    if fid not in ref_rates:
        continue
    exp_min, exp_max, exp_pad = ref_rates[fid]
    t = f["taxas"]["mulheres"]
    rates_total += 1
    ok = (abs(t["min"]-exp_min) <= 1e-6 and abs(t["max"]-exp_max) <= 1e-6
          and (exp_pad is None or abs(t.get("padrao")-exp_pad) <= 1e-6))
    if ok:
        rates_ok += 1
    else:
        erros.append(f"Taxa {fid}: min {t['min']}/max {t['max']} (padrao {t.get('padrao')}) != ref {exp_min}/{exp_max}/{exp_pad}")
reg("Taxas (mulheres) vs 6.9", f"{rates_ok}/{rates_total}", f"{rates_ok}/{rates_total}", rates_ok == rates_total)

# preset
preset_filters = [f for f in filtros["filtros"] if f.get("padrao_relatorio")]
base_preset = 121419

# Constantes esperadas do preset — apuradas em uma única execução sobre
# data/fontes.json + data/filtros.json já corrigidos (não recalculadas aqui,
# para o script não comparar um cálculo consigo mesmo).
# Origem: base 121419 × fatores mulheres dos filtros com padrao_relatorio=true:
#   solteiras 0,505 | fidelidade 0,698 | escolaridade_superior 0,41–0,43
#   antecedentes_criminais 0,99–0,995 | ist_c1 0,98 | orientacao 0,975–0,985
#   imc_abaixo_30 padrão 0,88. C2 = C1 × (0,50/0,98) mín e (0,52/0,98) máx.
EXPECTED_C1_MIN = 14607.162724
EXPECTED_C1_MAX = 15554.998270
EXPECTED_C2_MIN = 7452.634043
EXPECTED_C2_MAX = 8253.672551

def product(filters_list):
    p_min = 1.0; p_max = 1.0
    for f in filters_list:
        t = f["taxas"]["mulheres"]
        if f["id"] == "imc_abaixo_30":
            rate = t["padrao"]
            p_min *= rate; p_max *= rate
        else:
            p_min *= t["min"]; p_max *= t["max"]
    return p_min, p_max

c1_min_factor, c1_max_factor = product(preset_filters)
c1_min_calc = base_preset * c1_min_factor
c1_max_calc = base_preset * c1_max_factor

c2_filters = [f for f in preset_filters if f["id"] != "ist_c1"] + [x for x in filtros["filtros"] if x["id"]=="ist_c2"]
# C2 via spec: C1 x 0.50/0.98 and 0.52/0.98
c2_min_calc = c1_min_calc * (0.50/0.98)
c2_max_calc = c1_max_calc * (0.52/0.98)

reg("Preset C1 min", EXPECTED_C1_MIN, c1_min_calc, abs(c1_min_calc - EXPECTED_C1_MIN) <= 1e-6)
reg("Preset C1 max", EXPECTED_C1_MAX, c1_max_calc, abs(c1_max_calc - EXPECTED_C1_MAX) <= 1e-6)
reg("Preset C2 min", EXPECTED_C2_MIN, c2_min_calc, abs(c2_min_calc - EXPECTED_C2_MIN) <= 1e-6)
reg("Preset C2 max", EXPECTED_C2_MAX, c2_max_calc, abs(c2_max_calc - EXPECTED_C2_MAX) <= 1e-6)

# renda
soma_classes = sum(c["percentual"] for c in renda["classes"])
reg("Renda soma classes", 99.98, soma_classes, abs(soma_classes - 99.98) <= 0.05)
reg("Renda soma_percentual", 99.98, renda["soma_percentual"], abs(renda["soma_percentual"] - 99.98) <= 0.05)

# ra
peso_sum = sum(r["peso"] for r in ra["ras"])
reg("RA pesos", 100.0, peso_sum, abs(peso_sum - 100.0) <= 0.01)

# fontes resolve
ids_to_check = [pop.get("fonte"), renda.get("fonte"), ra.get("fonte")] + [f.get("fonte") for f in filtros["filtros"]]
fontes_ok = 0; fontes_total = 0
for fid in ids_to_check:
    if fid is None: continue
    fontes_total += 1
    if fid in fonte_ids:
        fontes_ok += 1
    else:
        erros.append(f"Fonte nao resolve: {fid}")
reg("Fontes resolvidas", f"{fontes_ok}/{fontes_total}", f"{fontes_ok}/{fontes_total}", fontes_ok == fontes_total)

# (b) — comparação apenas informativa com o relatório antigo
rel = {"C1": (15500, 21550), "C2": (7900, 11050)}
calc = {"C1": (c1_min_calc, c1_max_calc), "C2": (c2_min_calc, c2_max_calc)}
devs = {}
for scen in ["C1","C2"]:
    cmin, cmax = calc[scen]; rmin, rmax = rel[scen]
    devs[scen] = ((cmin-rmin)/rmin*100.0, (cmax-rmax)/rmax*100.0)

# Print table (a)
def fmt(x):
    if isinstance(x, float):
        d = 6 if abs(x) < 10 else 2
        return f"{x:,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return str(x)

print("=== (a) Consistencia interna ===")
print(f"{'Verificacao':<26}{'Esperado':>14}{'Calculado':>14}{'Status':>8}")
for label, exp, got, ok in checks:
    status = "OK" if ok else "FAIL"
    print(f"{label:<26}{str(exp):>14}{fmt(got) if not isinstance(got,str) else got:>14}{status:>8}")

print()
print("=== Constantes esperadas do preset vs calculado ===")
for label, exp, got in [("C1 min", EXPECTED_C1_MIN, c1_min_calc), ("C1 max", EXPECTED_C1_MAX, c1_max_calc),
                        ("C2 min", EXPECTED_C2_MIN, c2_min_calc), ("C2 max", EXPECTED_C2_MAX, c2_max_calc)]:
    print(f"{label:<8}esperado {exp:>14.6f}  calculado {got:>14.6f}  diff {got-exp:>10.6f}")

print()
print("=== (b) relatório antigo, superado pelas fontes corrigidas ===")
print("informativo — não falha")
print(f"{'Cenario':<8}{'Lado':<8}{'Calculado':>12}{'Relatorio':>12}{'Desvio %':>10}")
for scen in ["C1","C2"]:
    cmin, cmax = calc[scen]; rmin, rmax = rel[scen]
    dmin, dmax = devs[scen]
    print(f"{scen:<8}{'min':<8}{fmt(cmin):>12}{rmin:>12}{dmin:>9.2f}%")
    print(f"{scen:<8}{'max':<8}{fmt(cmax):>12}{rmax:>12}{dmax:>9.2f}%")

print()
if erros:
    print("FALHAS:")
    for e in erros:
        print(" - " + e)
    print(f"Resultado: REPROVADO ({len(erros)} falha(s))")
    sys.exit(1)
else:
    print("Resultado: APROVADO")
    sys.exit(0)
