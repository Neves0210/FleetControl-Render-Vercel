import cv2
import numpy as np
import logging

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# CARREGAMENTO
# ─────────────────────────────────────────────────────────────────────────────

def load_image_from_bytes(file_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(file_bytes, np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    if image is None:
        raise ValueError("Imagem inválida ou corrompida.")

    return image


# ─────────────────────────────────────────────────────────────────────────────
# FIX 1 — ORIENTAÇÃO
# Fotos tiradas em landscape (w > h) têm a nota virada 90°.
# Rotacionar antes de qualquer processamento resolve ~80% dos casos de falha.
# ─────────────────────────────────────────────────────────────────────────────

def correct_orientation(image: np.ndarray) -> np.ndarray:
    h, w = image.shape[:2]
    if w > h:
        logger.info("image_pipeline: imagem landscape (%dx%d) → rotacionando 90°", w, h)
        image = cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
    return image


# ─────────────────────────────────────────────────────────────────────────────
# FIX 2 — DETECÇÃO DA NOTA NO FUNDO
# Quando a nota é fotografada sobre mesa/madeira, há fundo ao redor.
# Detectar o contorno do papel branco evita recortes errados.
# ─────────────────────────────────────────────────────────────────────────────

def detect_note_region(image: np.ndarray) -> np.ndarray:
    """
    Tenta encontrar o contorno retangular do papel (branco) no fundo.
    Retorna o recorte da nota se encontrado, ou a imagem original.
    """
    h, w = image.shape[:2]
    scale = 0.25

    small = cv2.resize(image, (int(w * scale), int(h * scale)))
    gray_s = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

    # Papel branco tem pixels acima de 200
    _, thresh = cv2.threshold(gray_s, 200, 255, cv2.THRESH_BINARY)

    # Fechar buracos (texto impresso cria lacunas no papel)
    kernel = np.ones((15, 15), np.uint8)
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return image

    largest = max(contours, key=cv2.contourArea)
    area_ratio = cv2.contourArea(largest) / (small.shape[0] * small.shape[1])

    # Só usar se o contorno cobrir pelo menos 20% da imagem (é realmente a nota)
    if area_ratio < 0.20:
        return image

    bx, by, bw, bh = cv2.boundingRect(largest)
    # Converter de volta para escala original com margem de 10px
    pad = 10
    x1 = max(int(bx / scale) - pad, 0)
    y1 = max(int(by / scale) - pad, 0)
    x2 = min(int((bx + bw) / scale) + pad, w)
    y2 = min(int((by + bh) / scale) + pad, h)

    note = image[y1:y2, x1:x2]
    logger.info("image_pipeline: nota detectada (%dx%d) → recorte (%dx%d)", w, h, x2 - x1, y2 - y1)
    return note


# ─────────────────────────────────────────────────────────────────────────────
# REDIMENSIONAMENTO
# ─────────────────────────────────────────────────────────────────────────────

def resize_large_image(image: np.ndarray, max_width: int = 2000) -> np.ndarray:
    h, w = image.shape[:2]
    if w <= max_width:
        return image
    scale = max_width / w
    return cv2.resize(image, (max_width, int(h * scale)), interpolation=cv2.INTER_AREA)


# ─────────────────────────────────────────────────────────────────────────────
# PROCESSAMENTOS BASE
# ─────────────────────────────────────────────────────────────────────────────

def to_gray(image: np.ndarray) -> np.ndarray:
    if len(image.shape) == 2:
        return image
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


# ─────────────────────────────────────────────────────────────────────────────
# FIX 3 — THRESHOLD ESTRITO ANTI-BLEED-THROUGH
# Em papel térmico fino, o texto do verso sangra na frente.
# O texto do verso tem intensidade ~150-200 (cinza médio).
# Os módulos do QR Code real têm intensidade ~0-100 (preto forte).
# Threshold estrito abaixo de 110 elimina o texto do verso.
# ─────────────────────────────────────────────────────────────────────────────

def strict_threshold(gray: np.ndarray, threshold: int = 100) -> np.ndarray:
    """
    Binariza capturando apenas pixels muito escuros (tinta preta forte do QR).
    Elimina texto cinza do verso que sangra pelo papel térmico fino.
    """
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    _, th = cv2.threshold(blurred, threshold, 255, cv2.THRESH_BINARY)
    return th


def strict_threshold_upscaled(gray: np.ndarray, threshold: int = 100, scale: int = 3) -> np.ndarray:
    """
    Threshold estrito + upscale com INTER_NEAREST para preservar bordas binárias.
    """
    th = strict_threshold(gray, threshold)
    return cv2.resize(th, (th.shape[1] * scale, th.shape[0] * scale),
                      interpolation=cv2.INTER_NEAREST)


# ─────────────────────────────────────────────────────────────────────────────
# RECORTES — com coordenadas corrigidas para nota em portrait
# ─────────────────────────────────────────────────────────────────────────────

def crop_regions(image: np.ndarray) -> list[tuple[str, np.ndarray]]:
    h, w = image.shape[:2]
    regions = [
        # Imagem completa
        ("full",            image),
        # Metade inferior (onde o QR sempre está)
        ("bottom_half",     image[int(h * 0.40):h, 0:w]),
        # Região do QR: ~50-75% da altura, lado esquerdo
        ("qr_zone",         image[int(h * 0.48):int(h * 0.76), 0:int(w * 0.60)]),
        # Variações de recorte para compensar notas com posições ligeiramente diferentes
        ("qr_zone_tight",   image[int(h * 0.52):int(h * 0.73), int(w * 0.05):int(w * 0.55)]),
        ("qr_zone_wide",    image[int(h * 0.45):int(h * 0.78), 0:int(w * 0.65)]),
        # Terço inferior esquerdo
        ("bottom_left",     image[int(h * 0.35):h, 0:int(w * 0.65)]),
    ]
    return [(name, r) for name, r in regions if r.size > 0]


def crop_bottom_center(image: np.ndarray) -> np.ndarray:
    """Recorte para OCR: região inferior com chave de acesso."""
    h, w = image.shape[:2]
    return image[int(h * 0.40):h, int(w * 0.02):int(w * 0.98)]


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


# ─────────────────────────────────────────────────────────────────────────────
# GERAÇÃO DE VARIANTES — pipeline completo
# ─────────────────────────────────────────────────────────────────────────────

def generate_variants(image: np.ndarray) -> list[tuple[str, np.ndarray]]:
    # FIX 1: corrigir orientação antes de qualquer coisa
    image = correct_orientation(image)

    # FIX 2: detectar a nota no fundo (mesa, madeira, mão)
    image = detect_note_region(image)

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

            # Variantes padrão
            variants.append((f"{region_name}_gray", gray))
            variants.append((f"{region_name}_clahe", clahe))
            variants.append((f"{region_name}_binary", binary))
            variants.append((f"{region_name}_sharp", sharp))

            # FIX 3: variantes com threshold estrito anti-bleed-through
            # São as mais importantes para notas térmicas com sangramento
            variants.append((f"{region_name}_strict90",  strict_threshold(gray, 90)))
            variants.append((f"{region_name}_strict100", strict_threshold(gray, 100)))
            variants.append((f"{region_name}_strict120", strict_threshold(gray, 120)))

            # Upscale com threshold estrito (melhor combinação para QR danificado)
            variants.append((f"{region_name}_strict_up3",
                             strict_threshold_upscaled(gray, 100, 3)))
            variants.append((f"{region_name}_strict_up3_90",
                             strict_threshold_upscaled(gray, 90, 3)))

            # Upscale padrão
            if region_name in ("qr_zone", "qr_zone_tight", "bottom_left"):
                variants.append((f"{region_name}_upscale2", upscale(gray, 2)))
                variants.append((f"{region_name}_upscale2_clahe", upscale(clahe, 2)))
                variants.append((f"{region_name}_upscale2_binary", upscale(binary, 2)))

        except Exception:
            pass

    # Detecção automática de QR pelo OpenCV (quando funciona, é o mais preciso)
    qr_region = try_detect_qr_region(image)
    if qr_region is not None:
        qr_gray = to_gray(qr_region)
        qr_clahe = apply_clahe(qr_gray)
        qr_binary = adaptive_binary(qr_clahe)

        variants.append(("qr_detected_original", qr_region))
        variants.append(("qr_detected_gray", qr_gray))
        variants.append(("qr_detected_clahe", qr_clahe))
        variants.append(("qr_detected_binary", qr_binary))
        variants.append(("qr_detected_strict100", strict_threshold(qr_gray, 100)))
        variants.append(("qr_detected_strict_up3", strict_threshold_upscaled(qr_gray, 100, 3)))
        variants.append(("qr_detected_upscale3", upscale(qr_binary, 3)))

    return variants
