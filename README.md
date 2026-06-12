# FleetControlRH

Sistema para controle de frota, abastecimentos, uso de veiculos, manutencoes e leitura de NFC-e.

## Requisitos locais

- .NET 8 SDK
- Node.js 24
- PostgreSQL 16 ou superior
- Python 3.11 ou superior, se for usar o leitor NFC-e local

## Banco local

Crie o banco local no PostgreSQL:

```powershell
createdb -U postgres fleetcontrolrh
```

O backend usa por padrao:

```txt
Host=localhost;Port=5432;Database=fleetcontrolrh;Username=postgres;Password=postgres
```

Se seu usuario/senha forem diferentes, defina a variavel antes de rodar:

```powershell
$env:ConnectionStrings__DefaultConnection="Host=localhost;Port=5432;Database=fleetcontrolrh;Username=SEU_USUARIO;Password=SUA_SENHA"
```

## Rodar o backend

```powershell
cd backend/FleetControlRH.Api
$env:JWT_KEY="troque-por-uma-chave-local-grande-com-32-caracteres-ou-mais"
$env:SEED_ADMIN_EMAIL="admin@fleet.local"
$env:SEED_ADMIN_PASSWORD="troque-esta-senha"
dotnet restore
dotnet run --urls "http://localhost:5000"
```

Ao subir, o backend aplica as migrations automaticamente. O usuario inicial so e criado quando `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` estiverem configurados e o banco ainda nao tiver usuarios.

Swagger local:

```txt
http://localhost:5000/swagger
```

## Rodar o frontend

```powershell
cd frontend/fleet-control-rh
npm install
npm run dev
```

Acesse:

```txt
http://localhost:5173
```

## Rodar o leitor NFC-e local

```powershell
cd nfce-reader
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:ALLOWED_ORIGINS="http://localhost:5173"
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

O backend ja aponta para `http://localhost:8000` em desenvolvimento.

## Replicar dados do banco Render para o computador

1. No Render, copie a connection string externa do banco PostgreSQL.
2. No seu computador, feche o backend local para evitar escrita durante a copia.
3. Gere um dump do banco de producao:

```powershell
$env:PROD_DATABASE_URL="cole-a-connection-string-externa-do-render"
pg_dump $env:PROD_DATABASE_URL --format=custom --no-owner --file=fleetcontrolrh.backup
```

4. Recrie o banco local:

```powershell
dropdb -U postgres fleetcontrolrh
createdb -U postgres fleetcontrolrh
```

5. Restaure o backup:

```powershell
pg_restore -U postgres --dbname=fleetcontrolrh --clean --if-exists --no-owner fleetcontrolrh.backup
```

6. Suba o backend local normalmente. Ele aplicara migrations pendentes, se houver.

Importante: esse backup contem dados reais. Nao envie o arquivo `fleetcontrolrh.backup` para GitHub, WhatsApp ou armazenamento publico.
