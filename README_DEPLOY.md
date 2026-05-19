# FleetControlRH — Deploy Vercel + Render

## Estrutura

- `backend/FleetControlRH.Api` → ASP.NET Core API para Render
- `frontend/fleet-control-rh` → React/Vite para Vercel
- Banco produção → PostgreSQL no Render
- Banco local → SQLite

## Rodar local

### Backend

```bash
cd backend/FleetControlRH.Api
dotnet restore
dotnet run --urls "http://localhost:5000"
```

### Frontend

```bash
cd frontend/fleet-control-rh
npm install
npm run dev
```

Crie ou ajuste `frontend/fleet-control-rh/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

Login padrão:

```txt
admin@fleet.local
123456
```

---

## Deploy do Backend no Render

### Opção recomendada: Blueprint

1. Suba o projeto no GitHub.
2. No Render, escolha **New → Blueprint**.
3. Selecione o repositório.
4. O Render vai ler o arquivo `render.yaml`.
5. Ele criará:
   - Web Service `fleetcontrolrh-api`
   - PostgreSQL `fleetcontrolrh-db`

Depois que o backend subir, copie a URL pública, por exemplo:

```txt
https://fleetcontrolrh-api.onrender.com
```

### Variável importante no Render

Depois de criar o frontend na Vercel, volte no Render e ajuste:

```txt
AllowedOrigins=https://seu-projeto.vercel.app
```

---

## Deploy do Frontend na Vercel

1. Importe o repositório na Vercel.
2. Configure:

```txt
Framework Preset: Vite
Root Directory: frontend/fleet-control-rh
Build Command: npm run build
Output Directory: dist
```

3. Adicione a variável:

```txt
VITE_API_URL=https://fleetcontrolrh-api.onrender.com/api
```

4. Faça o deploy.

---

## Observações importantes

### Upload de notas fiscais

No Render, arquivos enviados para `wwwroot/uploads` podem ser perdidos em novo deploy/restart dependendo do plano. Para produção real, o ideal é trocar para:

- Cloudinary
- AWS S3
- Azure Blob Storage
- Supabase Storage

Para MVP/teste, funciona.

### Banco

Local usa SQLite automaticamente.
Produção usa `DATABASE_URL` do Render e PostgreSQL.

### CORS

O backend aceita local por padrão. Em produção, configure `AllowedOrigins` com a URL da Vercel.

