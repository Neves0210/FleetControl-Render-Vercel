import re
import cv2
import numpy as np
import pytesseract
from PIL import Image

# ─────────────────────────────────────────────────────────────────────────────
# FIX 4 — CORREÇÃO DE CARACTERES DO OCR
# O Tesseract confunde letras com dígitos em fontes termais degradadas.
# Mapeamento baseado nos erros reais observados nas notas NFC-e.
# ─────────────────────────────────────────────────────────────────────────────

OCR_CHAR_MAP: dict[str, str] = {
    # Confusões O/0 (mais comuns em fontes termais)
    'O': '0', 'o': '0', 'Q': '0',
    # G também parece 0 em fontes degradadas
    'G': '0',
    # B parece 8
    'B': '8',
    # S parece 5
    'S': '5',
    # I/l/| parecem 1
    'I': '1', 'l': '1', '|': '1',
    # Z parece 2
    'Z': '2',
    # g parece 9
    'g': '9',
}

CHAVE_REGEX = re.compile(r"\d{44}")


def _corrigir_texto_ocr(texto: str) -> str:
    """
    Aplica o mapa de correção caractere a caractere e retorna apenas dígitos.
    """
    resultado = ""
    for c in texto:
        resultado += OCR_CHAR_MAP.get(c, c)
    return resultado


def preprocess_for_ocr(image: np.ndarray) -> list[tuple[str, Image.Image]]:
    """
    Gera múltiplas versões pré-processadas para OCR, aumentando a chance de
    leitura correta da chave de 44 dígitos.
    """
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    variants = []

    # Versão 1: upscale 3x + Otsu (melhor para texto impresso limpo)
    big3 = cv2.resize(gray, None, fx=3, fy=3, interpolation=cv2.INTER_LANCZOS4)
    _, otsu3 = cv2.threshold(big3, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    variants.append(("upscale3_otsu", Image.fromarray(otsu3)))

    # Versão 2: upscale 2x + adaptativo (melhor para iluminação irregular)
    big2 = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    blur2 = cv2.GaussianBlur(big2, (3, 3), 0)
    adapt2 = cv2.adaptiveThreshold(blur2, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY, 41, 9)
    variants.append(("upscale2_adapt", Image.fromarray(adapt2)))

    # Versão 3: CLAHE + upscale 2x + Otsu (melhor para baixo contraste)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    cl = clahe.apply(gray)
    big_cl = cv2.resize(cl, None, fx=2, fy=2, interpolation=cv2.INTER_LANCZOS4)
    _, otsu_cl = cv2.threshold(big_cl, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    variants.append(("clahe_upscale2_otsu", Image.fromarray(otsu_cl)))

    return variants


def extract_key_from_text(text: str) -> str | None:
    """
    Extrai a chave de 44 dígitos do texto bruto do OCR.
    Aplica correção de caracteres antes de buscar.
    """
    corrigido = _corrigir_texto_ocr(text)
    # Remove tudo que não for dígito
    apenas_digitos = re.sub(r"\D", "", corrigido)
    matches = CHAVE_REGEX.findall(apenas_digitos)
    return matches[0] if matches else None


def read_key_with_ocr(image: np.ndarray) -> tuple[str | None, str, float, str]:
    """
    Tenta extrair a chave de acesso de 44 dígitos via OCR.
    Retorna: (chave, metodo, confianca, texto_bruto)
    """
    config_digits = "--psm 6 -c tessedit_char_whitelist=0123456789"
    config_general = "--psm 6 --oem 3"

    all_text = []
    variants = preprocess_for_ocr(image)

    for variant_name, pil in variants:
        # Tentativa 1: OCR só com dígitos (menos erro, mas perde contexto)
        try:
            text_d = pytesseract.image_to_string(pil, lang="por", config=config_digits)
            all_text.append(text_d)
            key = extract_key_from_text(text_d)
            if key:
                return key, f"OCR:{variant_name}:digits", 0.72, text_d
        except Exception:
            pass

        # Tentativa 2: OCR geral com correção de mapa (capta melhor a linha inteira)
        try:
            text_g = pytesseract.image_to_string(pil, lang="por", config=config_general)
            all_text.append(text_g)
            key = extract_key_from_text(text_g)
            if key:
                return key, f"OCR:{variant_name}:general", 0.68, text_g
        except Exception:
            pass

    texto_consolidado = "\n---\n".join(all_text)
    return None, "OCRFalhou", 0, texto_consolidado
