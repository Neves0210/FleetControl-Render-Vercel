import logging
import time
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import NfceResponse
from app.services.image_pipeline import load_image_from_bytes, generate_variants, crop_bottom_center
from app.services.qr_reader import read_qr_from_variants
from app.services.ocr_reader import read_key_with_ocr
from app.services.vision_fallback import read_nfce_with_vision
from app.services.nfce_client import fetch_nfce_html, parse_nfce_html, build_sp_url_from_key


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="FleetControlRH NFC-e Reader", version="2.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# HELPER
# ─────────────────────────────────────────────────────────────────────────────

def _consultar_e_retornar(
    chave, url, metodo, confianca, started, dados_extras=None
) -> NfceResponse:
    if not url and chave:
        url = build_sp_url_from_key(chave)
    try:
        html = fetch_nfce_html(url)
        dados = parse_nfce_html(html)
        if dados_extras:
            dados.update(dados_extras)
        elapsed = round(time.time() - started, 2)
        return NfceResponse(
            sucesso=True, metodo=metodo, chaveAcesso=chave, urlConsulta=url,
            dadosExtraidos={**dados, "tempoProcessamentoSegundos": elapsed},
            confianca=confianca,
        )
    except Exception as ex:
        logger.warning("main: erro ao consultar NFC-e (%s): %s", metodo, ex)
        elapsed = round(time.time() - started, 2)
        return NfceResponse(
            sucesso=True, metodo=metodo, chaveAcesso=chave, urlConsulta=url,
            dadosExtraidos={"erroConsulta": str(ex),
                            "tempoProcessamentoSegundos": elapsed, **(dados_extras or {})},
            confianca=confianca,
            mensagem="Chave/URL obtida, mas houve erro ao consultar a NFC-e.",
        )


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINT
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/nfce/analisar-imagem", response_model=NfceResponse)
async def analisar_imagem(file: UploadFile = File(...)):
    started = time.time()

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Envie uma imagem válida.")

    file_bytes = await file.read()

    try:
        image = load_image_from_bytes(file_bytes)
    except Exception as ex:
        raise HTTPException(status_code=400, detail=str(ex))

    # ── Estágio 1: QR Code ────────────────────────────────────────────────────
    # generate_variants agora é um GERADOR (sob demanda). O leitor para na
    # primeira variante que decodificar, então não há mais len() aqui.
    variants = generate_variants(image)
    logger.info("main: iniciando leitura de QR | arquivo='%s'", file.filename)

    qr_url, qr_method, qr_confidence = read_qr_from_variants(variants)

    if qr_url:
        logger.info("main: ✅ QR lido via %s (%.2fs)", qr_method, time.time() - started)
        return _consultar_e_retornar(None, qr_url, f"QRCode:{qr_method}", qr_confidence, started)

    # ── Estágio 2: OCR ────────────────────────────────────────────────────────
    logger.info("main: QR falhou (%s) → OCR", qr_method)
    ocr_region = crop_bottom_center(image)

    try:
        chave, ocr_method, ocr_confidence, texto_ocr = read_key_with_ocr(ocr_region)
    except Exception as ex:
        chave, ocr_method, ocr_confidence, texto_ocr = None, "OCRFalhou", 0.0, str(ex)

    if chave:
        logger.info("main: ✅ OCR via %s → chave %s", ocr_method, chave)
        return _consultar_e_retornar(chave, None, ocr_method, ocr_confidence, started)

    # ── Estágio 3: Vision (Claude Haiku) ─────────────────────────────────────
    # Último recurso: foto ruim, QR danificado, mão na frente, bleed-through severo.
    # O modelo lê o texto impresso diretamente, independente da qualidade do QR.
    logger.info("main: OCR falhou (%s) → Vision API", ocr_method)

    media_type = file.content_type or "image/jpeg"
    dados_vision, vision_method, vision_confidence = read_nfce_with_vision(
        file_bytes, media_type
    )

    if dados_vision:
        chave_v = dados_vision.get("chaveAcesso")
        url_v   = dados_vision.get("urlConsulta")

        if chave_v or url_v:
            logger.info("main: ✅ Vision via %s → chave=%s", vision_method, chave_v)
            dados_extras = {k: v for k, v in dados_vision.items()
                            if k not in ("chaveAcesso", "urlConsulta") and v is not None}
            return _consultar_e_retornar(
                chave_v, url_v, f"Vision:{vision_method}",
                vision_confidence, started, dados_extras
            )

        # Dados parciais sem chave (valor, combustível, etc.)
        elapsed = round(time.time() - started, 2)
        logger.info("main: Vision retornou dados parciais via %s", vision_method)
        return NfceResponse(
            sucesso=True,
            metodo=f"Vision:{vision_method}",
            dadosExtraidos={**dados_vision, "tempoProcessamentoSegundos": elapsed},
            confianca=vision_confidence,
            mensagem="Dados extraídos por visão, mas sem chave para consultar a NFC-e.",
        )

    # ── Falha total ───────────────────────────────────────────────────────────
    elapsed = round(time.time() - started, 2)
    logger.warning("main: ❌ falha total após %.2fs", elapsed)

    return NfceResponse(
        sucesso=False,
        metodo="Falha",
        dadosExtraidos={"tempoProcessamentoSegundos": elapsed, "textoOcr": texto_ocr[:1500]},
        confianca=0.0,
        mensagem="Não foi possível ler QR Code, OCR nem extrair dados por visão.",
    )
