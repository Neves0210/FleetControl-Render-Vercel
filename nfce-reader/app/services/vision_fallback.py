import os
import re
import json
import base64
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# VISION FALLBACK — Claude Haiku como leitor de NFC-e
#
# Usado quando QR Code e OCR falham (foto ruim, QR danificado, bleed-through
# severo, mão na frente, etc.).
#
# O modelo lê o TEXTO IMPRESSO da nota diretamente, extraindo a chave de
# acesso de 44 dígitos e demais dados, independente da qualidade do QR Code.
#
# Custo estimado: ~$0.001 por nota (claude-haiku-4-5).
# Configurar: ANTHROPIC_API_KEY no ambiente do Render.
# ─────────────────────────────────────────────────────────────────────────────

_PROMPT = """\
Esta é uma NFC-e brasileira (Nota Fiscal de Consumidor Eletrônica), \
possivelmente fotografada em ângulo ou com baixa qualidade.

Leia o TEXTO IMPRESSO na nota (ignore o QR Code) e retorne APENAS \
um objeto JSON válido com os campos abaixo. \
Não inclua explicações, markdown ou texto adicional — apenas o JSON.

{
  "chaveAcesso": "string com exatamente 44 dígitos sem espaços, ou null",
  "valorTotal": numero em float (ex: 167.71) ou null,
  "cnpjEmitente": "string com CNPJ do emitente (só dígitos) ou null",
  "dataEmissao": "string no formato DD/MM/YYYY ou null",
  "urlConsulta": "URL completa de consulta se visível na nota, ou null",
  "combustivel": "nome do combustível se for posto de gasolina, ou null",
  "litros": numero em float se houver quantidade em litros, ou null
}

A chave de acesso são os 44 dígitos agrupados que aparecem na nota, \
geralmente acima ou ao lado do QR Code, no formato:
XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX
(remova os espaços e retorne só os 44 dígitos)."""


def _is_available() -> bool:
    """Verifica se a API key está configurada."""
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def _call_api(image_bytes: bytes, media_type: str = "image/jpeg") -> str:
    """
    Chama a API da Anthropic via SDK.
    Levanta exceção se falhar.
    """
    import anthropic

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    b64 = base64.standard_b64encode(image_bytes).decode()

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=600,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": b64,
                    }
                },
                {
                    "type": "text",
                    "text": _PROMPT,
                }
            ]
        }]
    )

    return message.content[0].text


def _parse_response(text: str) -> Optional[dict]:
    """
    Extrai e valida o JSON retornado pelo modelo.
    Retorna None se não for possível parsear.
    """
    # Remover possíveis blocos de código que o modelo insira por engano
    cleaned = re.sub(r"```(?:json)?|```", "", text).strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        # Tentar extrair o primeiro objeto JSON do texto
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            logger.warning("vision_fallback: resposta sem JSON válido: %s", text[:200])
            return None
        try:
            data = json.loads(match.group())
        except json.JSONDecodeError:
            logger.warning("vision_fallback: falha ao parsear JSON extraído")
            return None

    # Validar e normalizar chaveAcesso
    chave = data.get("chaveAcesso")
    if chave:
        chave_digits = re.sub(r"\D", "", str(chave))
        if len(chave_digits) == 44:
            data["chaveAcesso"] = chave_digits
        else:
            logger.warning(
                "vision_fallback: chaveAcesso com %d dígitos (esperado 44): %s",
                len(chave_digits), chave_digits
            )
            data["chaveAcesso"] = None

    return data


def read_nfce_with_vision(
    image_bytes: bytes,
    media_type: str = "image/jpeg",
) -> tuple[Optional[dict], str, float]:
    """
    Envia a imagem da nota para o Claude Haiku e extrai os dados via visão.

    Retorna: (dados_dict, metodo, confianca)
      - dados_dict: dict com chaveAcesso, valorTotal, etc. ou None se falhou
      - metodo: string descritiva para o campo `metodo` da resposta
      - confianca: float entre 0 e 1
    """
    if not _is_available():
        logger.info("vision_fallback: ANTHROPIC_API_KEY não configurada — pulando")
        return None, "VisionNaoConfigurado", 0.0

    # Imagens muito grandes podem exceder o limite da API — reduzir se necessário
    # O limite é ~5MB em base64; 3.7MB de JPEG vira ~5MB em base64 (limite justo)
    MAX_BYTES = 3_500_000
    if len(image_bytes) > MAX_BYTES:
        try:
            import cv2
            import numpy as np
            arr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            h, w = img.shape[:2]
            scale = (MAX_BYTES / len(image_bytes)) ** 0.5
            img_small = cv2.resize(img, (int(w * scale), int(h * scale)),
                                   interpolation=cv2.INTER_AREA)
            _, buf = cv2.imencode(".jpg", img_small, [cv2.IMWRITE_JPEG_QUALITY, 85])
            image_bytes = buf.tobytes()
            logger.info("vision_fallback: imagem reduzida para %.0fKB", len(image_bytes) / 1024)
        except Exception as ex:
            logger.warning("vision_fallback: falha ao reduzir imagem: %s", ex)

    try:
        logger.info("vision_fallback: enviando %.0fKB para claude-haiku", len(image_bytes) / 1024)
        raw_text = _call_api(image_bytes, media_type)
        logger.info("vision_fallback: resposta recebida: %s", raw_text[:200])

        dados = _parse_response(raw_text)

        if dados and dados.get("chaveAcesso"):
            return dados, "VisionHaiku:chaveAcesso", 0.85

        if dados and any(dados.get(k) for k in ("valorTotal", "urlConsulta", "cnpjEmitente")):
            return dados, "VisionHaiku:dadosParciais", 0.60

        return None, "VisionHaiku:semDados", 0.0

    except Exception as ex:
        logger.error("vision_fallback: erro na chamada API: %s", ex)
        return None, f"VisionHaiku:erro:{type(ex).__name__}", 0.0
