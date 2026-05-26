# QR Code por upload de imagem

## O que mudou

A tela de abastecimentos agora usa como método principal:

1. Foto da nota fiscal completa: fica apenas como comprovante obrigatório.
2. Foto aproximada do QR Code: usada para ler a URL da NFC-e.
3. URL completa da NFC-e: mantida somente como emergência.

## O que foi removido da tela

- Leitura por câmera ao vivo
- Campo de chave de acesso

A chave de acesso foi removida porque em muitas NFC-e a chave de 44 dígitos não substitui a URL completa, pois falta o hash de segurança do QR Code.

## Arquivo alterado

Frontend:
- src/pages/Abastecimentos.jsx

Backend:
- Mantido endpoint já existente:
  - POST /api/abastecimentos/ler-qrcode-imagem
  - POST /api/abastecimentos/analisar-nota
