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

app = FastAPI(title="FleetControlRH NFC-e Reader", version="1.0.0")

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

    variants = generate_variants(image)
    variants = variants[:35]
    logging.info("NFC-e: tentando QR com %s variantes", len(variants))

    qr_url, qr_method, qr_confidence = read_qr_from_variants(variants)

    if qr_url:
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
                confianca=qr_confidence
            )
        except Exception as ex:
            return NfceResponse(
                sucesso=True,
                metodo=f"QRCode:{qr_method}",
                chaveAcesso=None,
                urlConsulta=qr_url,
                dadosExtraidos={"erroConsulta": str(ex)},
                confianca=qr_confidence,
                mensagem="QR Code lido, mas houve erro ao consultar a NFC-e."
            )

    logging.info("NFC-e: QR falhou. Tentando OCR.")
    ocr_region = crop_bottom_center(image)
    chave, ocr_method, ocr_confidence, texto_ocr = read_key_with_ocr(ocr_region)

    if chave:
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
                confianca=ocr_confidence
            )
        except Exception as ex:
            return NfceResponse(
                sucesso=True,
                metodo=ocr_method,
                chaveAcesso=chave,
                urlConsulta=url,
                dadosExtraidos={"erroConsulta": str(ex), "textoOcr": texto_ocr[:1500]},
                confianca=ocr_confidence,
                mensagem="Chave extraída por OCR, mas houve erro ao consultar a NFC-e."
            )

    elapsed = round(time.time() - started, 2)

    return NfceResponse(
        sucesso=False,
        metodo="Falha",
        dadosExtraidos={"tempoProcessamentoSegundos": elapsed, "textoOcr": texto_ocr[:1500]},
        confianca=0,
        mensagem="Não foi possível ler QR Code nem extrair chave de acesso por OCR."
    )
