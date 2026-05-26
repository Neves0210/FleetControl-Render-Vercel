import re
import requests
from bs4 import BeautifulSoup


def build_sp_url_from_key(chave: str) -> str:
    return f"https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p={chave}|2|1|1"


def fetch_nfce_html(url: str) -> str:
    headers = {"User-Agent": "Mozilla/5.0 FleetControlRH/1.0"}
    response = requests.get(url, headers=headers, timeout=20)
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


def parse_nfce_html(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text("\n", strip=True)

    valor = None
    litros = None
    posto = None
    combustivel = None

    valor_match = re.search(r"Valor\s+total.*?([\d]+[,.]\d{2})", text, re.I | re.S)
    if not valor_match:
        valor_match = re.search(r"R\$\s*([\d]+[,.]\d{2})", text, re.I)

    if valor_match:
        valor = normalize_decimal_br(valor_match.group(1))

    litros_match = re.search(r"Qtde\.?\s*:\s*([\d.,]+)\s*UN\s*:\s*L", text, re.I)
    if litros_match:
        litros = normalize_decimal_br(litros_match.group(1))

    combustivel_match = re.search(r"(ETANOL|GASOLINA|DIESEL|ALCOOL|ÁLCOOL)[^\n]*", text, re.I)
    if combustivel_match:
        combustivel = combustivel_match.group(0).strip()

    linhas = [l.strip() for l in text.split("\n") if l.strip()]
    if linhas:
        posto = linhas[0]

    return {
        "posto": posto,
        "valorTotal": valor,
        "litros": litros,
        "combustivel": combustivel,
        "textoBruto": text[:5000]
    }
