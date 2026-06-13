import os
import re

import requests
from bs4 import BeautifulSoup

_CONNECT_TIMEOUT = 5
_READ_TIMEOUT = float(os.environ.get("NFCE_HTTP_TIMEOUT", "12"))

_session = requests.Session()
_session.headers.update({"User-Agent": "Mozilla/5.0 FleetControlRH/1.0"})


def build_sp_url_from_key(chave: str) -> str:
    return f"https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p={chave}|2|1|1"


def fetch_nfce_html(url: str) -> str:
    response = _session.get(url, timeout=(_CONNECT_TIMEOUT, _READ_TIMEOUT))
    response.raise_for_status()
    return response.text


def normalize_decimal_br(value: str | None):
    if not value:
        return None
    value = value.strip().replace(".", "").replace(",", ".")
    try:
        return float(value)
    except Exception:
        return None


def normalize_fuel_name(value: str) -> str:
    value = re.sub(r"\s+", " ", value or "").strip().upper()
    return value.replace("ÁLCOOL", "ALCOOL").replace("ÃLCOOL", "ALCOOL").replace("ÃƒÂLCOOL", "ALCOOL")


def parse_fuel_items(text: str) -> list[dict]:
    fuel_pattern = re.compile(
        r"(ETANOL\s+COMUM|ETANOL|GASOLINA\s+COMUM|GASOLINA|"
        r"DIESEL\s+S?10|DIESEL\s+S?500|DIESEL|ALCOOL|ÁLCOOL|ÃLCOOL|ÃƒÂLCOOL)",
        re.I,
    )

    items = []
    matches = list(fuel_pattern.finditer(text))

    for index, match in enumerate(matches):
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else min(len(text), start + 500)
        block = text[start:end]

        litros_match = re.search(r"Qtde\.?\s*:\s*([\d.,]+)\s*UN\s*:\s*L", block, re.I)
        litros = normalize_decimal_br(litros_match.group(1) if litros_match else None)
        if not litros:
            continue

        valor_unitario_match = re.search(
            r"(?:Vl\.?\s*Unit\.?|Valor\s*Unit(?:ario|ário|Ã¡rio)?)\s*:?\s*([\d]+[,.]\d{2,4})",
            block,
            re.I,
        )
        valor_unitario = normalize_decimal_br(valor_unitario_match.group(1) if valor_unitario_match else None)

        valor_total_match = re.search(
            r"(?:Vl\.?\s*Total|Valor\s*Total)\s*:?\s*([\d]+[,.]\d{2})",
            block,
            re.I,
        )
        valor_total = normalize_decimal_br(valor_total_match.group(1) if valor_total_match else None)

        if valor_total is None and valor_unitario:
            valor_total = round(litros * valor_unitario, 2)

        items.append(
            {
                "tipo": normalize_fuel_name(match.group(1)),
                "litros": litros,
                "valorUnitario": valor_unitario,
                "valorTotal": valor_total,
            }
        )

    return items


def parse_nfce_html(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text("\n", strip=True)

    valor = None
    litros = None
    posto = None
    combustivel = None
    combustiveis = parse_fuel_items(text)

    valor_match = re.search(r"Valor\s+total.*?([\d]+[,.]\d{2})", text, re.I | re.S)
    if not valor_match:
        valor_match = re.search(r"R\$\s*([\d]+[,.]\d{2})", text, re.I)

    if valor_match:
        valor = normalize_decimal_br(valor_match.group(1))

    if combustiveis:
        litros = round(sum(item["litros"] or 0 for item in combustiveis), 3)
        valores_itens = [item["valorTotal"] for item in combustiveis if item["valorTotal"] is not None]
        if len(valores_itens) == len(combustiveis):
            valor = round(sum(valores_itens), 2)
        combustivel = " + ".join(dict.fromkeys(item["tipo"] for item in combustiveis))
    else:
        litros_match = re.search(r"Qtde\.?\s*:\s*([\d.,]+)\s*UN\s*:\s*L", text, re.I)
        if litros_match:
            litros = normalize_decimal_br(litros_match.group(1))

        combustivel_match = re.search(
            r"(ETANOL|GASOLINA|DIESEL|ALCOOL|ÁLCOOL|ÃLCOOL|ÃƒÂLCOOL)[^\n]*",
            text,
            re.I,
        )
        if combustivel_match:
            combustivel = combustivel_match.group(0).strip()

    linhas = [line.strip() for line in text.split("\n") if line.strip()]
    if linhas:
        posto = linhas[0]

    return {
        "posto": posto,
        "valorTotal": valor,
        "litros": litros,
        "combustivel": combustivel,
        "combustiveis": combustiveis,
        "textoBruto": text[:5000],
    }
