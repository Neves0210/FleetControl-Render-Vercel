import logging
import time
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import NfceResponse
from app.services.image_pipeline import load_image_from_bytes, generate_variants, crop_bottom_center
from app.services.qr_reader import read_qr_from_variants
from app.services.ocr_reader import read_key_with_ocr
from app.services.nfce_client import fetch_nfce_html, parse_nfce_html, build_sp_url_from_key


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="FleetControlRH NFC-e Reader", version="2.0.0")

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

    # generate_variants já aplica:
    #  - correct_orientation (fix landscape)
    #  - detect_note_region (remove fundo)
    #  - strict_threshold variants (anti bleed-through)
    variants = generate_variants(image)

    logger.info("NFC-e: %s variantes geradas para '%s'", len(variants), file.filename)

    qr_url, qr_method, qr_confidence = read_qr_from_variants(variants)

    if qr_url:
        logger.info("NFC-e: QR lido via %s → %s", qr_method, qr_url[:80])
        try:
            html = fetch_nfce_html(qr_url)
            dados = parse_nfce_html(html)
            elapsed = round(time.time() - started, 2)

            return NfceResponse(
                sucesso=True,
                metodo=f"QRCode:{qr_method}",
                chaveAcesso=None,
                urlConsulta=qr_url,
                dadosExtraidos={**dados, "tempoProcessamentoSegundos": elapsed},
                confianca=qr_confidence,
            )
        except Exception as ex:
            logger.warning("NFC-e: QR lido mas erro ao consultar: %s", ex)
            return NfceResponse(
                sucesso=True,
                metodo=f"QRCode:{qr_method}",
                chaveAcesso=None,
                urlConsulta=qr_url,
                dadosExtraidos={"erroConsulta": str(ex)},
                confianca=qr_confidence,
                mensagem="QR Code lido, mas houve erro ao consultar a NFC-e.",
            )

    logger.info("NFC-e: QR falhou (%s). Tentando OCR.", qr_method)
    ocr_region = crop_bottom_center(image)

    try:
        chave, ocr_method, ocr_confidence, texto_ocr = read_key_with_ocr(ocr_region)
    except Exception as ex:
        chave = None
        ocr_method = "OCRFalhou"
        ocr_confidence = 0
        texto_ocr = str(ex)

    if chave:
        logger.info("NFC-e: chave extraída via %s → %s", ocr_method, chave)
        url = build_sp_url_from_key(chave)

        try:
            html = fetch_nfce_html(url)
            dados = parse_nfce_html(html)
            elapsed = round(time.time() - started, 2)

            return NfceResponse(
                sucesso=True,
                metodo=ocr_method,
                chaveAcesso=chave,
                urlConsulta=url,
                dadosExtraidos={**dados, "tempoProcessamentoSegundos": elapsed},
                confianca=ocr_confidence,
            )
        except Exception as ex:
            logger.warning("NFC-e: OCR ok mas erro ao consultar: %s", ex)
            return NfceResponse(
                sucesso=True,
                metodo=ocr_method,
                chaveAcesso=chave,
                urlConsulta=url,
                dadosExtraidos={"erroConsulta": str(ex), "textoOcr": texto_ocr[:1500]},
                confianca=ocr_confidence,
                mensagem="Chave extraída por OCR, mas houve erro ao consultar a NFC-e.",
            )

    elapsed = round(time.time() - started, 2)
    logger.warning("NFC-e: falha total após %.2fs. textoOCR: %s", elapsed, texto_ocr[:200])

    return NfceResponse(
        sucesso=False,
        metodo="Falha",
        dadosExtraidos={"tempoProcessamentoSegundos": elapsed, "textoOcr": texto_ocr[:1500]},
        confianca=0,
        mensagem="Não foi possível ler QR Code nem extrair chave de acesso por OCR.",
    )
