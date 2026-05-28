"""Adapters de envio/leitura para cada provider de email.

- ``gmail``        → Gmail API + OAuth2
- ``outlook``      → Microsoft Graph + OAuth2 (E5)
- ``smtp_imap``    → SMTP/IMAP genérico
- ``ses``          → AWS SES (envio transacional, p/ warmup e notificações)
- ``ploomes``      → ler contatos / escrever interações no CRM (E8)
"""
