# Deploy na VPS (PINN BAI)

Stack preparada: **Nginx** (SPA estático) + **API Node** (`server/`, CRM Auditor e futuros módulos) + **Supabase** (Postgres/Auth na nuvem).

## 1. Pré-requisitos na VPS

- Docker Engine + Docker Compose plugin  
- Domínio apontando para o servidor (opcional no primeiro teste por IP + porta)

## 2. Variáveis de ambiente

1. Copie `deploy.env.example` para `.env` na **raiz do repositório**.
2. Preencha:
   - **`SUPABASE_URL`** e **`SUPABASE_ANON_KEY`**: para o container da API (usa JWT do usuário + RLS; **service role não é obrigatória** para o CRM Auditor).
   - **`VITE_SUPABASE_URL`** e **`VITE_SUPABASE_PUBLISHABLE_KEY`**: iguais à URL pública e à **anon key** no build do front (nunca use service role no Vite).
   - **`CORS_ORIGIN`**: URL pública do app (ex.: `https://app.seudominio.com`). Com o Compose atual, tráfego do browser para `/api` passa pelo mesmo Nginx (mesma origem); mesmo assim definir a URL ajuda a API em cenários mistos.
   - **`COMPOSIO_API_KEY`**: opcional (CRM Auditor modo live).
3. **`WEB_HOST_PORT`**: porta no host para o Nginx (padrão `80`). Use `8080` se já houver outro serviço na 80.

## 3. Subir com Docker Compose

Na raiz do projeto:

```bash
cp deploy.env.example .env
# edite .env

docker compose --env-file .env up -d --build
```

Ou:

```bash
npm run docker:up
```

- **Front:** `http://SEU_IP` (ou domínio) → arquivos estáticos do Vite.  
- **API:** mesma origem em `/api/...` (proxy no `docker/nginx.conf`).  
- **Health da API:** `GET /health` (no mesmo host, via Nginx).

## 4. HTTPS (recomendado)

Na frente do Compose, use **Caddy** ou **Nginx + Certbot** no host, ou um reverse proxy gerenciado, terminando TLS e encaminhando para `WEB_HOST_PORT`.

## 5. Migrações Supabase

O banco continua no Supabase. Aplique todas as migrations (incluindo políticas RLS de escrita do CRM Auditor, ex.: `20260507130000_crm_auditor_rls_writes.sql`) antes de usar sync em produção:

```bash
supabase db push
# ou seu fluxo CI/CD
```

## 6. Desenvolvimento local (sem Docker)

- Terminal 1: `npm run dev` (Vite em `:8080`, proxy `/api` → `:8787`).
- Terminal 2: `npm run dev:api` (API em `:8787`).
- `.env` local com `VITE_SUPABASE_*` como em `.env.example`.
