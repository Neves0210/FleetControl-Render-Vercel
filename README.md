# FleetControlRH - ASP.NET Core API + React

Sistema MVP para controle de abastecimentos com backend ASP.NET Core Web API, frontend React/Vite, JWT, SQLite e análise de NFC-e.

## Login padrão

```txt
admin@fleet.local
123456
```

## Como rodar o backend

```bash
cd backend/FleetControlRH.Api
dotnet restore
dotnet run --urls "http://localhost:5000"
```

Swagger:

```txt
http://localhost:5000/swagger
```

## Como rodar o frontend

```bash
cd frontend/fleet-control-rh
npm install
npm run dev
```

Acesse:

```txt
http://localhost:5173
```

## Análise da NFC-e

Na tela de Abastecimentos, agora existem duas opções:

1. **Enviar foto da nota**: o backend tenta ler o QR Code da imagem.
2. **Colar URL da NFC-e**: alternativa mais confiável. Cole a URL gerada pelo QR Code da SEFAZ.

Fluxo recomendado:

```txt
Novo abastecimento
→ cole a URL da NFC-e ou envie a foto
→ clique em Analisar Nota
→ confira veículo, motorista, KM, litros, valor e posto
→ salve o abastecimento
```

## Pacotes adicionados no backend

- HtmlAgilityPack
- ZXing.Net
- SixLabors.ImageSharp 3.1.11

## Observação importante

A leitura do QR Code pode falhar se a foto estiver tremida, muito inclinada, com sombra ou baixa definição. Por isso o campo de URL manual foi mantido como fallback principal.
