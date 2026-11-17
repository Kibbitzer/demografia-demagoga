#!/usr/bin/env python3
"""Baixa Censo 2022 (Sidra t. 9514, DF) e grava data/populacao.json.

Modo verificado: parseia idades simples x sexo, valida soma e 25-29.
Modo fallback (falha de rede/parse): grava só 25-29 mulheres de §6.9,
homens null, verificado false, exit 0. Divergencia de validacao: exit 1.
"""
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

URL = ("https://apisidra.ibge.gov.br/values/t/9514/n3/53/v/93/p/2022"
       "/c2/4,5/c287/all/c286/113635")
TOTAL_CENSO = 2817381
POP_2026 = 3009996
ESPERADO = {"mulheres_25_29": 113649, "homens_25_29": 110513}
FALLBACK_MULHERES_25_29 = {25: 23184, 26: 22875, 27: 23120, 28: 22775, 29: 21695}
VAZIOS = {"", "-", "..", "..."}

RE_ANOS = re.compile(r"^(\d+) anos?$")  # "1 ano" (singular) + "2 anos"...
RE_ANOS_MAIS = re.compile(r"^(\d+) anos ou mais$")

DESTINO = Path(__file__).resolve().parent.parent / "data" / "populacao.json"


def parse_idade(label):
    """Idade simples a partir do rotulo; None para agregados e meses."""
    if label == "Menos de 1 ano":
        return 0
    m = RE_ANOS_MAIS.match(label) or RE_ANOS.match(label)
    return int(m.group(1)) if m else None


def base_json():
    return {
        "fonte": "censo_2022_sidra_9514",
        "url": URL,
        "ano": 2022,
        "municipio": {"codigo": "53", "nome": "Distrito Federal"},
        "acessado_em": date.today().isoformat(),
        "verificado": True,
        "total": TOTAL_CENSO,
        "total_calculado": None,
        "escala_2026": {"populacao_2026": POP_2026,
                        "fator": round(POP_2026 / TOTAL_CENSO, 6)},
        "idades": [],
        "agregados": {},
    }


def buscar():
    with urllib.request.urlopen(URL, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def montar_verificado(payload):
    sexes = {"4": "homens", "5": "mulheres"}
    por_idade = {}
    for linha in payload[1:]:
        idade = parse_idade(linha.get("D5N", ""))
        if idade is None:
            continue
        valor = linha.get("V", "")
        if valor in VAZIOS:
            continue
        por_idade.setdefault(idade, {"homens": None, "mulheres": None})
        por_idade[idade][sexes[linha["D4C"]]] = int(valor)
    idades = [{"idade": i, **por_idade[i]} for i in sorted(por_idade)]
    dados = base_json()
    dados["idades"] = idades
    dados["total_calculado"] = sum((x["homens"] or 0) + (x["mulheres"] or 0)
                                   for x in idades)
    faixa = [x for x in idades if 25 <= x["idade"] <= 29]
    dados["agregados"] = {
        "mulheres_25_29": sum(x["mulheres"] or 0 for x in faixa),
        "homens_25_29": sum(x["homens"] or 0 for x in faixa),
    }
    return dados


def validar(dados):
    """Divergencia contra valores verificados de §6.9/§6.7 -> exit 1."""
    if dados["total_calculado"] != TOTAL_CENSO:
        sys.exit(f"FALHA: soma das idades {dados['total_calculado']} "
                 f"!= esperado {TOTAL_CENSO}")
    for chave, esperado in ESPERADO.items():
        real = dados["agregados"][chave]
        if real != esperado:
            sys.exit(f"FALHA: {chave} = {real} != esperado {esperado}")


def montar_fallback(motivo):
    dados = base_json()
    dados["verificado"] = False
    dados["motivo"] = motivo
    dados["idades"] = [{"idade": i, "homens": None,
                        "mulheres": FALLBACK_MULHERES_25_29[i]}
                       for i in sorted(FALLBACK_MULHERES_25_29)]
    dados["agregados"] = dict(ESPERADO)
    return dados


def gravar(dados):
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text(json.dumps(dados, ensure_ascii=False, indent=2) + "\n",
                       encoding="utf-8")


def main():
    try:
        dados = montar_verificado(buscar())
    except Exception as exc:  # rede/HTTP/parse: fallback documentado
        gravar(montar_fallback(f"{type(exc).__name__}: {exc}"))
        print(f"modo: fallback ({exc})")
        return
    validar(dados)
    gravar(dados)
    print(f"modo: verificado | total_calculado={dados['total_calculado']} "
          f"| agregados={dados['agregados']} | idades={len(dados['idades'])}")


if __name__ == "__main__":
    main()
