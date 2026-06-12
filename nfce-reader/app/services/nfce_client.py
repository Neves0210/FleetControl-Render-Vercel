import os
import re

import requests
from bs4 import BeautifulSoup

# Consulta a NFC-e com sessao reutilizavel e timeout separado.
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
    return value.replace("ÁLCOOL", "ALCOOL").replace("ÃLCOOL", "ALCOOL")


def parse_fuel_items(text: str) -> list[dict]:
    pattern = re.compile(
        r"(ETANOL\s+COMUM|ETANOL|GASOLINA\s+COMUM|GASOLINA|"
        r"DIESEL\s+S?10|DIESEL\s+S?500|DIESEL|ALCOOL|ÁLCOOL|ÃLCOOL)"
        r".{0,240}?Qtde\.?\s*:\s*([\d.,]+)\s*UN\s*:\s*L"
        r"(?:.{0,180}?(?:Vl\.?\s*Total|Valor\s*Total)\s*:?\s*([\d]+[,.]\d{2}))?",
        re.I | re.S,
    )

    items = []
    for match in pattern.finditer(text):
        litros = normalize_decimal_br(match.group(2))
        if not litros:
            continue

        items.append(
            {
                "tipo": normalize_fuel_name(match.group(1)),
                "litros": litros,
                "valorTotal": normalize_decimal_br(match.group(3)),
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
        combustivel = " + ".join(dict.fromkeys(item["tipo"] for item in combustiveis))
    else:
        litros_match = re.search(r"Qtde\.?\s*:\s*([\d.,]+)\s*UN\s*:\s*L", text, re.I)
        if litros_match:
            litros = normalize_decimal_br(litros_match.group(1))

        combustivel_match = re.search(
            r"(ETANOL|GASOLINA|DIESEL|ALCOOL|ÁLCOOL|ÃLCOOL)[^\n]*",
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
