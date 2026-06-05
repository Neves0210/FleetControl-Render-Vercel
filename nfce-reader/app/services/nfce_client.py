import os
import re
import requests
from bs4 import BeautifulSoup

# ─────────────────────────────────────────────────────────────────────────────
# OTIMIZAÇÃO DE VELOCIDADE
# O site da SEFAZ-SP costuma ser lento e às vezes fica pendurado. Antes o
# timeout era 20s "cego" — se o governo travasse, o request todo segurava 20s.
#
# Agora:
#  - Sessão reutilizável (reaproveita conexão TCP/TLS entre chamadas).
#  - Timeout separado: (connect, read). Connect curto; read limitado.
#  - Configurável por env var NFCE_HTTP_TIMEOUT (segundos de leitura).
#
# Se a consulta estourar o tempo, o serviço ainda retorna a CHAVE/URL lida —
# apenas sem os dados extras (valor/litros), que o usuário pode preencher.
# ─────────────────────────────────────────────────────────────────────────────

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
