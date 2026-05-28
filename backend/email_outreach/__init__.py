"""Email Outreach — motor próprio de cold email do PINN BAI.

Estrutura:
- ``api/``      → rotas FastAPI (inboxes, campaigns, webhooks, ...)
- ``core/``     → lógica de domínio (scheduler, sender, templating, ...)
- ``adapters/`` → integrações externas (Gmail, Outlook, SMTP, SES, Ploomes)
- ``models.py`` → DTOs Pydantic
- ``router.py`` → roteador principal que agrega os sub-routers

Convenções:
- Tudo é multi-tenant via ``org_id`` (Supabase ``organizations``).
- O backend usa service-role (bypassa RLS); a UI usa JWT (RLS aplica).
- Segredos (tokens OAuth, senhas SMTP) trafegam em texto plano no backend,
  mas são criptografados antes de chegar ao banco via ``core.crypto``.
"""
