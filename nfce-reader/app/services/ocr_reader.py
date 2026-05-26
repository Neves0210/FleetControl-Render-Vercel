import re
import cv2
import numpy as np
import pytesseract
from PIL import Image


CHAVE_REGEX = re.compile(r"\d{44}")


def preprocess_for_ocr(image: np.ndarray) -> Image.Image:
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image

    gray = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)

    binary = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 41, 9
    )

    return Image.fromarray(binary)


def extract_key_from_text(text: str) -> str | None:
    cleaned = re.sub(r"\D", "", text)
    matches = CHAVE_REGEX.findall(cleaned)
    return matches[0] if matches else None


def read_key_with_ocr(image: np.ndarray) -> tuple[str | None, str, float, str]:
    pil = preprocess_for_ocr(image)
    config = "--psm 6 -c tessedit_char_whitelist=0123456789"

    text = pytesseract.image_to_string(pil, lang="por", config=config)
    key = extract_key_from_text(text)

    if key:
        return key, "OCR", 0.70, text

    return None, "OCRFalhou", 0, text
