import cv2
import numpy as np
from PIL import Image
from pyzbar.pyzbar import decode as pyzbar_decode
import zxingcpp


def normalize_result(text: str | None) -> str | None:
    if not text:
        return None

    text = text.strip()

    if len(text) < 20:
        return None

    return text


def read_with_opencv(image: np.ndarray) -> str | None:
    detector = cv2.QRCodeDetector()

    try:
        data, _, _ = detector.detectAndDecode(image)
        return normalize_result(data)
    except Exception:
        return None


def read_with_zxing(image: np.ndarray) -> str | None:
    try:
        if len(image.shape) == 2:
            pil = Image.fromarray(image)
        else:
            rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            pil = Image.fromarray(rgb)

        results = zxingcpp.read_barcodes(pil)

        for r in results:
            if r.text:
                return normalize_result(r.text)

        return None
    except Exception:
        return None


def read_with_pyzbar(image: np.ndarray) -> str | None:
    try:
        if len(image.shape) == 2:
            pil = Image.fromarray(image)
        else:
            rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            pil = Image.fromarray(rgb)

        results = pyzbar_decode(pil)

        for r in results:
            text = r.data.decode("utf-8", errors="ignore")
            if text:
                return normalize_result(text)

        return None
    except Exception:
        return None


def read_qr_from_variants(variants: list[tuple[str, np.ndarray]]) -> tuple[str | None, str, float]:
    readers = [
        ("OpenCV", read_with_opencv, 0.92),
        ("ZXingCPP", read_with_zxing, 0.88),
        ("pyzbar", read_with_pyzbar, 0.82),
    ]

    for variant_name, image in variants:
        for reader_name, reader, confidence in readers:
            result = reader(image)
            if result:
                return result, f"{reader_name}:{variant_name}", confidence

    return None, "QRCodeFalhou", 0
