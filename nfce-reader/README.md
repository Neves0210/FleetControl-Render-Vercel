# FleetControlRH NFC-e Reader

Microserviço Python para leitura robusta de NFC-e por foto da nota inteira.

## Rodar local

```bash
cd nfce-reader
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Linux/Docker precisa:
```bash
apt-get install -y tesseract-ocr tesseract-ocr-por libzbar0
```

## Endpoint

POST `/api/nfce/analisar-imagem`

multipart/form-data:
- file: imagem da nota inteira

## Variável no ASP.NET

Configure no backend principal:

```txt
NFCE_READER_URL=http://localhost:8000
```

Em produção no Render, use a URL pública do serviço Python.
