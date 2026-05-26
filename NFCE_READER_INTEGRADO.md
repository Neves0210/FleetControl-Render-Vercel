# Integração NFC-e Reader Robusto

## O que foi adicionado

Este pacote adiciona um microserviço Python separado para leitura robusta de NFC-e usando foto da nota fiscal inteira.

## Fluxo novo

1. Usuário tira foto da nota fiscal inteira pelo celular.
2. Frontend envia a imagem para o backend ASP.NET.
3. Backend ASP.NET chama o microserviço Python.
4. Python aplica:
   - escala de cinza
   - CLAHE
   - binarização adaptativa
   - redução de ruído
   - recortes automáticos
   - upscale
   - sharpen
   - OpenCV QRCodeDetector
   - ZXing CPP
   - pyzbar
   - OCR com Tesseract
5. Retorna URL/chave/dados.
6. ASP.NET complementa os dados consultando a NFC-e.
7. Frontend preenche o abastecimento.

## Pastas adicionadas

- nfce-reader/

## Backend ASP.NET alterado

- Services/NfceReaderService.cs
- DTOs/NfceReaderDtos.cs
- Controllers/AbastecimentosController.cs
- Program.cs

## Frontend alterado

- services/abastecimentoService.js
- pages/Abastecimentos.jsx

## Como rodar local

### 1. Rodar microserviço Python

```bash
cd nfce-reader
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Teste:

```txt
http://localhost:8000/health
```

### 2. Configurar backend ASP.NET

No PowerShell:

```powershell
$env:NFCE_READER_URL="http://localhost:8000"
```

Depois:

```bash
cd backend/FleetControlRH.Api
dotnet run
```

### 3. Rodar frontend

```bash
cd frontend/fleet-control-rh
npm install
npm run dev
```

## Produção

Suba o `nfce-reader` como outro serviço no Render usando Dockerfile.

No Render do backend ASP.NET, adicione:

```txt
NFCE_READER_URL=https://url-do-seu-nfce-reader.onrender.com
```

## Endpoint novo no ASP.NET

```txt
POST /api/abastecimentos/analisar-nota-imagem-robusta
```

multipart/form-data:

```txt
fotoNotaFiscal: imagem
```
