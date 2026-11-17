#!/usr/bin/env python3
"""Gera data/renda_pc.json a partir dos microdados da PDAD 2021 (IPEDF).

Fonte: PDAD 2021, base de moradores e base de domicílios.
Variável: renda_domiciliar_pc_r (renda domiciliar per capita, corrigida
para julho de 2021), atribuída a cada morador pela ficha do domicílio.
Peso: PESO_MOR (moradores).

Uso:
    python3 scripts/build_renda.py [--cache DIR]

O script baixa os dois CSV públicos (~63 MB) se não estiverem no cache.
Domicílios sem renda informada são excluídos; a cobertura é registrada no JSON.
"""
import csv
import json
import os
import sys
import urllib.request

BASE = "https://www.ipe.df.gov.br/documents/9915964/10214561/"
MORADORES = BASE + "PDAD_2021-Moradores.csv"
DOMICILIOS = BASE + "PDAD_2021-Domicilios.csv"

LARGURA = 100          # R$ por faixa
TETO = 20000           # último bin fechado
CAUDA = [(20000, 30000), (30000, 50000), (50000, 100000), (100000, None)]
IDADE_MIN, IDADE_MAX = 18, 69
SEXOS = {"1": "homens", "2": "mulheres"}


def baixar(url, destino):
    if os.path.exists(destino) and os.path.getsize(destino) > 0:
        return destino
    print(f"baixando {url}")
    urllib.request.urlretrieve(url, destino)
    return destino


def numero(texto):
    texto = (texto or "").strip().replace(".", "").replace(",", ".")
    try:
        return float(texto)
    except ValueError:
        return None


def main():
    cache = sys.argv[sys.argv.index("--cache") + 1] if "--cache" in sys.argv else "/tmp/pdad-2021"
    os.makedirs(cache, exist_ok=True)
    mor = baixar(MORADORES, os.path.join(cache, "moradores.csv"))
    dom = baixar(DOMICILIOS, os.path.join(cache, "domicilios.csv"))

    renda = {}
    with open(dom, encoding="latin-1", newline="") as fh:
        for linha in csv.DictReader(fh, delimiter=";"):
            valor = numero(linha.get("renda_domiciliar_pc_r"))
            if valor is not None:
                renda[linha["A01nficha"].strip()] = valor
            else:
                renda[linha["A01nficha"].strip()] = None

    dados = {sexo: {} for sexo in SEXOS.values()}
    cobertura = {"pessoas_com_renda": 0, "pessoas_total": 0}

    with open(mor, encoding="latin-1", newline="") as fh:
        for linha in csv.DictReader(fh, delimiter=";"):
            cobertura["pessoas_total"] += 1
            sexo = SEXOS.get((linha.get("E04") or "").strip())
            idade = (linha.get("idade") or "").strip()
            if not sexo or not idade.isdigit():
                continue
            idade = int(idade)
            valor = renda.get(linha["A01nficha"].strip())
            peso = numero(linha.get("PESO_MOR")) or 0.0
            if valor is None or peso <= 0:
                continue
            faixa = str(idade) if idade <= IDADE_MAX else f"{IDADE_MAX + 1}+"
            bins = dados[sexo].setdefault(faixa, {})
            if valor < TETO:
                indice = int(valor // LARGURA)
                chave = str(indice)
                bins[chave] = bins.get(chave, 0.0) + peso
            else:
                for inicio, fim in CAUDA:
                    if valor >= inicio and (fim is None or valor < fim):
                        chave = f"{inicio}+"
                        bins[chave] = bins.get(chave, 0.0) + peso
                        break
            cobertura["pessoas_com_renda"] += 1

    for sexo, faixas in dados.items():
        for faixa, bins in faixas.items():
            dados[sexo][faixa] = {k: round(v) for k, v in sorted(bins.items(), key=lambda kv: (len(kv[0]), kv[0]))}

    saida = {
        "fonte": "pdad_2021",
        "publicador": "IPEDF",
        "titulo": "PDAD 2021 — microdados de moradores e domicílios",
        "ano": 2021,
        "variavel": "renda_domiciliar_pc_r",
        "unidade": "R$ de julho de 2021, renda domiciliar per capita",
        "peso": "PESO_MOR",
        "sexo": "E04 (1=homens, 2=mulheres)",
        "bin": {"largura": LARGURA, "teto": TETO, "cauda": [[a, b] for a, b in CAUDA]},
        "idades": [str(i) for i in range(IDADE_MIN, IDADE_MAX + 1)] + [f"{IDADE_MAX + 1}+"],
        "cobertura": cobertura,
        "nota": (
            "Domicílios que recusaram ou não informaram renda são excluídos, como no método da PDAD; "
            "a distribuição é aplicada à população total do recorte, portanto é uma premissa de independência "
            "entre renda e os demais filtros. Contagens são ponderadas por PESO_MOR e arredondadas."
        ),
        "url_moradores": MORADORES,
        "url_domicilios": DOMICILIOS,
        "dados": dados,
    }

    destino = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "renda_pc.json")
    with open(destino, "w", encoding="utf-8") as fh:
        json.dump(saida, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"ok: {destino} ({os.path.getsize(destino)} bytes)")
    print(f"cobertura: {cobertura}")


if __name__ == "__main__":
    main()
