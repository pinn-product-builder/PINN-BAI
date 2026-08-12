# Blueprint — Pinn Onboarding (provisionamento de cliente)

> **Status:** proposta para revisão · **Data:** 2026-06-05
> **Decisões âncora (confirmadas):** sistema **EXTERNO** ao BAI (`onboarding.pinnpb.com`); formulário preenchível por **AMBOS** (cliente self-service + Pinn interno); provisionamento **assíncrono + idempotente**.

---

## 1. O que existe hoje (grounding — já mapeado)

| Peça | Onde | Estado |
|---|---|---|
| **Produtos/planos** | `src/lib/plans.ts` | 5 planos BAI: Agent Sales, Revenue OS, Growth Engine, Automation Hub, MicroSaaS Studio |
| **Hermes** | API em **jt-vps** (`/opt/hermes`, backend `icp_radar`, `hermes-api` :8000, `hermes-web` :8082) | Plataforma multi-tenant de prospecção/ICP. **`POST /signup-with-plan`** cria conta + plano (auth via **api-key**; tem `api/plan_catalog.py`). Integração **viável** — worker chama esse endpoint. |
| **Login BAI** | edge `supabase/functions/create-org-admin` | Cria org + admin (service role; exige platform_admin). ⚠️ tem **bug histórico de onboarding** a corrigir |
| **ClickUp — onboarding** | Space "Onboarding Clientes" (`90131758893`) | Já recebe tasks "...Form Submission" (há um form hoje) |
| **ClickUp — entrega por cliente** | Space "Delivery" (`901313818792`) → Folder por cliente (ex.: "H2M Embalagens" `901317804444`) → Lists "🗺️ Roadmap & Entregas" + "🐛 Bugs & Suporte" | Padrão existente |
| **ClickUp — template de tarefas** | Folder H2M → conjunto **"[Etapa A]"** | Kickoff → Diagnóstico comercial → Análise RFM → Análise OKRs → Workshop Funil → Sessões Baseline → Check-ins OKR → Validação → Entrega (= metodologia Pinn / skills `h2m-*`) |
| **ClickUp — CRM** | Space "CRM Comercial" → "99 — Empresas" + "06 — Pós-Venda CS" | Registro da empresa + pós-venda |

---

## 2. Arquitetura-alvo: "Pinn Onboarding"

```
Formulário (onboarding.pinnpb.com)
   ├─ público (link/token) — cliente preenche
   └─ interno (login Pinn) — time preenche
        │ submit
        ▼
Orquestrador (grava onboarding_request + enfileira passos)
        │
        ├─► Worker BAI      → create-org-admin (org + login)        [se plano inclui BAI]
        ├─► Worker Hermes    → cria conta/login Hermes               [se inclui Hermes]
        ├─► Worker ClickUp   → Folder do cliente (Delivery) + Lists
        │                      + clona tasks "[Etapa A]" (template)
        │                      + registro em CRM>Empresas
        └─► (notifica + atualiza status)
   cada passo: IDEMPOTENTE + retry + status próprio
        ▼
Painel de status (acompanhar cada onboarding: pendente→provisionando→pronto/erro)
```

**Por que externo:** mantém o BAI como produto de BI; o onboarding orquestra BAI + Hermes + ClickUp por API. Stack sugerida: app leve (mesmo stack do BAI — React + um backend FastAPI/edge) + fila simples (tabela `onboarding_steps` + worker) — sem infra pesada.

---

## 3. Modelo de dados (proposto)

- **`onboarding_requests`**: `id`, `company_name`, `contact_name`, `contact_email`, `plan_ids[]`, `products` (bai?/hermes?/clickup?), `form_data` (jsonb — questionário), `origin` (`client`|`pinn`), `status` (`pending`→`provisioning`→`done`|`error`), `created_at`.
- **`onboarding_steps`**: `request_id`, `step` (`bai_login`|`hermes_login`|`clickup_folder`|`clickup_tasks`|`crm_record`), `status`, `result` (jsonb — ids/links criados), `error`, `attempts`, `updated_at`. **Idempotente** (re-rodar não duplica — checa `result` antes).

---

## 4. Matriz plano → provisionamento (a confirmar)

| Produto comprado | Login BAI | Login Hermes | ClickUp folder + tasks | Registro CRM |
|---|:---:|:---:|:---:|:---:|
| Plano BAI (qualquer dos 5) | ✅ | — | ✅ | ✅ |
| Hermes / SDR | — | ✅ | ✅ | ✅ |
| Combo (BAI + Hermes) | ✅ | ✅ | ✅ | ✅ |

(→ regra exata depende dos produtos/planos reais — ver decisão D2.)

---

## 5. Passos de provisionamento (detalhe técnico)

1. **BAI login** — `create-org-admin` (cria org se não existir + admin user). Pré-requisito: corrigir o bug histórico de onboarding.
2. **Hermes login** — chamar a API do Hermes (D1). Se não houver API → fallback: cria uma **task no ClickUp** pro time provisionar manualmente.
3. **ClickUp**:
   - `clickup_create_folder` no Space Delivery (`901313818792`), nome = cliente.
   - `clickup_create_list_in_folder` ("Roadmap & Entregas", "Bugs & Suporte").
   - clonar tasks do template "[Etapa A]" (`clickup_create_task` por item, com datas relativas ao kickoff).
   - `clickup_create_task` em CRM Comercial → "99 — Empresas" (registro do cliente).
   - *(MCP do ClickUp já validado nesta sessão — todas essas chamadas existem.)*

---

## 6. Formulário

- **Campos**: empresa, contato, email, produtos/plano comprado, + questionário (dados pra diagnóstico/SI — reusar o kit de SI existente). 
- **Público** (cliente): link com token (anti-fraude/validação). **Interno** (Pinn): atrás de login.
- Submissão → cria `onboarding_request` → dispara orquestrador.

---

## 7. Decisões/dependências em aberto

| # | Item | Status |
|---|---|---|
| **D1** | **Hermes API** | ✅ RESOLVIDO — API em jt-vps, `POST /signup-with-plan` (api-key auth + plan_catalog). Worker chama esse endpoint. Falta: pegar a api-key + mapear o body de `signup-with-plan` no build. |
| **D2** | **Produtos** | ✅ RESOLVIDO — **BAI = camada de dados** (planos `plans.ts`: Agent Sales, Revenue OS, etc.) · **Hermes = prospecção** (planos do `plan_catalog` do Hermes) · cliente compra projetos da Pinn. Provisiona conforme o que comprou. |
| **D3** | **Fonte da compra** | ✅ RESOLVIDO — **ambos**: puxar do "ganho" no CRM Comercial (ClickUp) **ou** preencher à mão no form. |
| **D4** | **create-org-admin bug** | ⏳ Corrigir o blocker histórico antes de automatizar o login BAI (F3). |
| **D5** | **Template ClickUp** | ✅ FEITO — Folder-template dedicado criado: **"__TEMPLATE Cliente (Onboarding Pinn)"** (folder `901318389272`, Space Delivery `901313818792`) → Lista "🗺️ Roadmap & Entregas" (`901327479051`, **13 tarefas-modelo [Etapa A]**) + "🐛 Bugs & Suporte" (`901327479056`). O worker **clona** este folder por cliente. Provisionamento ClickUp validado via MCP. |
| **D6** | **Domínio/host/auth** do app | ⏳ `onboarding.pinnpb.com` + auth do form (público token + interno login). |

---

## 8. Plano faseado (incremental)

- **F1 — Fundação**: modelo (`onboarding_requests`/`steps`) + form (público+interno) + orquestrador que grava e enfileira. Sem provisionar ainda — só captura + status.
- **F2 — Worker ClickUp** (maior valor, mais pronto): cria folder + lists + clona template + registro CRM. *(Tenho toda a estrutura mapeada.)*
- **F3 — Worker BAI**: corrige `create-org-admin` + automatiza org+login.
- **F4 — Worker Hermes**: quando D1 estiver definido (API ou fallback-task).
- **F5 — Painel de status + notificações** (email/ClickUp ao concluir).

---

## 9. Riscos
- **Hermes sem API** → passo manual (fallback-task). Não bloqueia o resto.
- **create-org-admin bug** → resolver antes do F3.
- **Idempotência** → cada passo checa o que já criou (evita org/folder/tasks duplicados em re-run).
- **Template drift** → se "[Etapa A]" mudar, o clone muda; daí a sugestão de um Folder-template versionado (D5).

---

## 10. Próximo passo
Responder **D1 (Hermes API)** e **D2/D3 (produtos + fonte da compra)**. Com isso eu detalho o F1 em tarefas executáveis e a gente começa pela fundação + Worker ClickUp (o de maior valor imediato).
