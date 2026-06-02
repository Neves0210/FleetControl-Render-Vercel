# FleetControlRH NFC-e Reader

Microserviço Python para leitura robusta de NFC-e por foto da nota inteira.

## Pipeline de leitura (3 estágios)

```
Foto da nota
    │
    ▼
┌─────────────────────────────┐
│  Estágio 1 — QR Code        │  OpenCV → ZXingCPP → pyzbar
│  + pré-processamento        │  orientação, detecção da nota,
│    automático               │  anti-bleed-through
└────────────┬────────────────┘
             │ falhou
             ▼
┌─────────────────────────────┐
│  Estágio 2 — OCR            │  Tesseract + correção de
│                             │  caracteres (O→0, G→0, B→8…)
└────────────┬────────────────┘
             │ falhou
             ▼
┌─────────────────────────────┐
│  Estágio 3 — Vision API     │  Claude Haiku lê o texto
│  (requer ANTHROPIC_API_KEY) │  impresso diretamente
└─────────────────────────────┘
```

## Rodar local

```bash
cd nfce-reader
python -m venv .venv
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # Linux/Mac
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Linux/Docker precisa:
```bash
apt-get install -y tesseract-ocr tesseract-ocr-por libzbar0
```

## Variáveis de ambiente

| Variável            | Obrigatório | Descrição                                      |
|---------------------|-------------|------------------------------------------------|
| `ANTHROPIC_API_KEY` | Não         | Ativa o estágio 3 (Vision). Sem ela, pula.     |
| `PORT`              | Não         | Porta do servidor (padrão: 8000)               |

## Endpoint

```
POST /api/nfce/analisar-imagem
Content-Type: multipart/form-data

file: <imagem da nota inteira>
```

### Resposta

```json
{
  "sucesso": true,
  "metodo": "QRCode:ZXingCPP:qr_zone_strict100",
  "chaveAcesso": "35260558844834000194650020000643751000858620",
  "urlConsulta": "https://www.nfce.fazenda.sp.gov.br/...",
  "dadosExtraidos": {
    "posto": "POSTO ESTRELA DA MANHA DE SALTO LTDA",
    "valorTotal": 167.71,
    "litros": 44.251,
    "combustivel": "ETANOL COMUM",
    "tempoProcessamentoSegundos": 1.8
  },
  "confianca": 0.88
}
```

O campo `metodo` mostra exatamente qual estágio e variante resolveu:
- `QRCode:ZXingCPP:qr_zone_strict100` — QR Code lido pelo ZXing na variante com threshold estrito
- `OCR:upscale3_otsu:digits` — chave extraída por OCR
- `Vision:VisionHaiku:chaveAcesso` — lido pelo Claude Haiku

## Integração no ASP.NET

Configure no `appsettings.json` ou variável de ambiente:
```
NFCE_READER_URL=https://seu-servico.onrender.com
```
