import cv2
import numpy as np


def load_image_from_bytes(file_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(file_bytes, np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    if image is None:
        raise ValueError("Imagem inválida ou corrompida.")

    return image


def resize_large_image(image: np.ndarray, max_width: int = 1800) -> np.ndarray:
    h, w = image.shape[:2]

    if w <= max_width:
        return image

    scale = max_width / w
    return cv2.resize(image, (max_width, int(h * scale)), interpolation=cv2.INTER_AREA)


def to_gray(image: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def apply_clahe(gray: np.ndarray) -> np.ndarray:
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    return clahe.apply(gray)


def denoise(gray: np.ndarray) -> np.ndarray:
    return cv2.fastNlMeansDenoising(gray, None, h=12, templateWindowSize=7, searchWindowSize=21)


def adaptive_binary(gray: np.ndarray) -> np.ndarray:
    return cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 7
    )


def sharpen(image: np.ndarray) -> np.ndarray:
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    return cv2.filter2D(image, -1, kernel)


def upscale(image: np.ndarray, scale: int = 2) -> np.ndarray:
    return cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)


def crop_bottom_center(image: np.ndarray) -> np.ndarray:
    h, w = image.shape[:2]
    return image[int(h * 0.30):h, int(w * 0.02):int(w * 0.98)]


def crop_regions(image: np.ndarray) -> list[tuple[str, np.ndarray]]:
    h, w = image.shape[:2]
    regions = [
        ("full", image),
        ("bottom", image[int(h * 0.35):h, 0:w]),
        ("bottom_center", image[int(h * 0.30):h, int(w * 0.05):int(w * 0.95)]),
        ("middle_bottom", image[int(h * 0.20):h, int(w * 0.00):int(w * 1.00)]),
        ("left_bottom", image[int(h * 0.35):h, 0:int(w * 0.65)]),
        ("right_bottom", image[int(h * 0.35):h, int(w * 0.35):w]),
    ]
    return [(name, r) for name, r in regions if r.size > 0]


def try_detect_qr_region(image: np.ndarray) -> np.ndarray | None:
    detector = cv2.QRCodeDetector()
    gray = to_gray(image)

    ok, points = detector.detect(gray)

    if not ok or points is None:
        return None

    pts = points.reshape(-1, 2).astype(np.float32)
    x, y, w, h = cv2.boundingRect(pts.astype(np.int32))
    pad = int(max(w, h) * 0.35)

    y1 = max(y - pad, 0)
    y2 = min(y + h + pad, image.shape[0])
    x1 = max(x - pad, 0)
    x2 = min(x + w + pad, image.shape[1])

    return image[y1:y2, x1:x2]


def generate_variants(image: np.ndarray) -> list[tuple[str, np.ndarray]]:
    image = resize_large_image(image)
    variants: list[tuple[str, np.ndarray]] = []

    for region_name, region in crop_regions(image):
        variants.append((f"{region_name}_original", region))

        try:
            gray = to_gray(region)
            clahe = apply_clahe(gray)
            clean = denoise(clahe)
            binary = adaptive_binary(clean)
            sharp = sharpen(clahe)

            variants.append((f"{region_name}_gray", gray))
            variants.append((f"{region_name}_clahe", clahe))
            variants.append((f"{region_name}_denoise", clean))
            variants.append((f"{region_name}_binary", binary))
            variants.append((f"{region_name}_sharp", sharp))
            variants.append((f"{region_name}_upscale_gray", upscale(gray, 2)))
            variants.append((f"{region_name}_upscale_clahe", upscale(clahe, 2)))
            if region_name in ["bottom", "bottom_center", "qr_region"]:
                variants.append((f"{region_name}_upscale_binary", upscale(binary, 2)))
        except Exception:
            pass

    qr_region = try_detect_qr_region(image)
    if qr_region is not None:
        variants.append(("qr_region_original", qr_region))
        qr_gray = to_gray(qr_region)
        qr_clahe = apply_clahe(qr_gray)
        qr_binary = adaptive_binary(qr_clahe)
        variants.append(("qr_region_gray", qr_gray))
        variants.append(("qr_region_clahe", qr_clahe))
        variants.append(("qr_region_binary", qr_binary))
        variants.append(("qr_region_upscale_binary", upscale(qr_binary, 3)))

    return variants
