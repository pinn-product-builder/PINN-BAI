# Fábrica de Onboarding (paperclip) — mapa validado

> **Data:** 2026-07-23 · **Status:** P1 construída (company + org chart no paperclip)
> Substitui/atualiza o `pinn-onboarding-blueprint.md` nos pontos marcados como **MUDOU**.

## 0. O que mudou vs. o blueprint original
| Item | Antes | Agora |
|---|---|---|
| Hermes | worker de provisionamento | **REMOVIDO** — não existe mais |
| ClickUp | folder-template + tasks | **REMOVIDO** → **Planer (Plane self-hosted)** |
| Destino do cliente | só BAI | **SELECIONÁVEL: `BAI` ou `ai-ops-platform`** |

## 1. Company no paperclip (P1 — construída)
`Pinn Onboarding` — org chart:
- **Onboarding Manager** (ceo) — intake (empresa, contato, produto, **destino**) → roteia → status → exige **aprovação humana** antes de criar recurso real.
- **Planer Provisioner** (pm) — sempre.
- **BAI Provisioner** (devops) — se `destino=BAI`.
- **AI-Ops Provisioner** (engineer) — se `destino=ai-ops`.

## 2. Caminhos validados

### ① Planer (Plane self-hosted) — sempre
- Base `https://planer.pinnpb.com/api/v1` · auth header **`X-API-Key`** (`/users/me/` → 401 sem auth ✅).
- Criar projeto: `POST /workspaces/{workspace_slug}/projects/`
- Criar tarefas: `POST /workspaces/{slug}/projects/{project_id}/issues/`
- Instância: signup habilitado, e-mail/senha, sem SSO. Idempotência: reusar projeto existente pelo nome.
- **Falta:** workspace slug + API token (config).

### ② Destino A — BAI
**Caminho atual (Supabase, 2 passos):**
1. insert em `organizations` (service role): `{name, slug (único, sufixo aleatório), plan int 1-5, status, admin_name, admin_email}` → trigger cria `tenants` 1:1.
2. `POST {SUPABASE_URL}/functions/v1/create-org-admin` `{email,password,fullName,orgId}` — **exige `Authorization: Bearer <JWT de usuário platform_admin>`** (NÃO aceita service role).

**Alternativa recomendada (atômica):** `POST /v1/admin/organizations` no **pinn-platform** (Hono) — cria org+user+membership numa transação. Auth Bearer com permissão `platform:manage`. Body `{orgName, orgSlug, adminEmail, adminPassword?, plan?}`.

**⚠️ Bug conhecido (D4) — causa raiz:** `create-org-admin` chama `listUsers()` **sem paginação** (default 50) → e-mail existente não é achado → `createUser` → *"User already registered"* → 400 → o front faz rollback e **apaga a org**. Também: `profiles.update` (sem upsert) e role sem upsert. **Fix:** paginar (`perPage:1000`), tratar "already registered" como idempotente, usar upsert.

Planos BAI (`src/lib/plans.ts`, fonte real = tabela `plans`): 1 Agent Sales · 2 Revenue OS · 3 Growth Engine · 4 Automation Hub · 5 MicroSaaS Studio *(plano 5 fora do type do wizard — armadilha)*.

### ③ Destino B — ai-ops-platform (ROI de RPA)
Ordem obrigatória:
1. `POST /v1/orgs` (JWT **`pinn_admin`**) `{slug (kebab), name, source}` → **`{org, ingestionToken}`**
   ⚠️ **o `ingestionToken` só aparece nesta resposta** (SHA-256 em repouso; perdeu → `POST /v1/orgs/{id}/tokens`).
2. `POST /v1/users` `{email,password,role: org_admin|org_viewer}`
3. `POST /v1/assets` `{slug,name,type:'rpa',tags}`
4. `POST /v1/rules` **`kind:'baseline'`** ← **único item OBRIGATÓRIO para existir ROI**
   - exige **`approvedBy`** (sem ele não grava `approvedAt` → ROI falha) e **`validFrom` ≤ 1º dia do mês medido**
   - `params`: `tempoManualMin`, `custoHoraCents`, `custoMensalCents`, `investimentoInicialCents`, `taxaErroManualPct?`
   - **só `pinn_admin` salva baseline** (org_admin recebe 403)
5. RPA emite: `POST /webhooks/{source}/{ingestionToken}` (sem JWT, idempotente por `externalId`)
6. Mede: `GET /v1/metrics/roi?assetSlug=&month=YYYY-MM`

**⚠️ `x-org-id` obrigatório em TODA rota `/v1`** quando o ator é `pinn_admin` (claims têm `orgId:null`). Exceção: `/v1/orgs`.
Outras: sem migration runner (SQL manual 0000→0008); vigência só pra frente (409 `invalid_vigencia`); alertas/widgets são registros **sem consumidor** hoje.

## 3. Credenciais necessárias (config, nunca no chat)
| Sistema | O que |
|---|---|
| Plane | workspace slug + API token |
| BAI | service role key + login `platform_admin` (ou usar pinn-platform) |
| ai-ops | login `pinn_admin` + URL da API (local `:3333`) |

## 4. Já existe (não reconstruir)
`Pinn-Onboarding/pinn-onboarding` — orquestrador FastAPI (`POST /onboarding/requests`, retry, status) + workers **ClickUp** e **Hermes** (agora obsoletos) — **falta o worker BAI**. Reaproveitar o padrão (idempotência, `onboarding_requests`/`steps`).

## 5. Próximas partes
- **P2** — plugar o **Planer** (mais simples) e rodar um provisionamento de teste.
- **P3** — destino **ai-ops** (org+token+asset+baseline).
- **P4** — destino **BAI** (corrigir o bug D4 ou usar pinn-platform).
- **P5** — status + notificação.

## 6. Dívidas de segurança encontradas
- `Pinn-Onboarding/pinn-onboarding/.env.example:5` — **senha de admin real em texto plano** (rotacionar + trocar por placeholder).
- `PINN-BAI/src/pages/admin/NewOrganization.tsx:98` — URL + anon key hardcoded.
- Repos locais **parciais** após a reorganização de pastas (arquivos faltando; `PINN-BAI/.git` sem HEAD/config) — restaurar via git.
