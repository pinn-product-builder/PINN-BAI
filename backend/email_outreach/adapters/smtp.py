"""Adapter SMTP — envio via servidor SMTP genérico.

Para inboxes com ``provider='smtp'`` (não OAuth). Senhas vêm do banco
criptografadas (bytea); decriptam via ``eo_decrypt`` antes de chamar.
"""
from __future__ import annotations

import logging
import smtplib
import ssl
import uuid
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import format_datetime

logger = logging.getLogger(__name__)


def build_message(
    *,
    from_email: str,
    from_name: str | None,
    to_email: str,
    to_name: str | None,
    subject: str,
    body_html: str,
    body_text: str | None = None,
    in_reply_to: str | None = None,
    references: str | None = None,
    message_id_domain: str = "pinnpb.com",
    extra_headers: dict[str, str] | None = None,
) -> tuple[str, EmailMessage]:
    """Constrói EmailMessage pronta pra SMTP. Retorna (Message-ID, msg)."""
    msg = EmailMessage()
    msg["From"] = f'"{from_name}" <{from_email}>' if from_name else from_email
    msg["To"] = f'"{to_name}" <{to_email}>' if to_name else to_email
    msg["Subject"] = subject
    message_id = f"<{uuid.uuid4()}@{message_id_domain}>"
    msg["Message-ID"] = message_id
    msg["Date"] = format_datetime(datetime.now(timezone.utc))
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
        msg["References"] = references or in_reply_to

    if extra_headers:
        for k, v in extra_headers.items():
            msg[k] = v

    if not body_text:
        import re

        body_text = re.sub(r"<[^>]+>", "", body_html).strip()

    msg.set_content(body_text)
    msg.add_alternative(body_html, subtype="html")
    return message_id, msg


def send_smtp(
    *,
    smtp_host: str,
    smtp_port: int,
    smtp_username: str,
    smtp_password: str,
    msg: EmailMessage,
    use_tls: bool = True,
) -> None:
    """Envia ``msg`` via SMTP. STARTTLS na porta 587, SSL implícito 465.

    Pode demorar 5-30s dependendo do provedor. Chamador deve rodar em thread/async.
    """
    if smtp_port == 465:
        # SSL implícito
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(smtp_host, smtp_port, context=ctx, timeout=30) as s:
            s.login(smtp_username, smtp_password)
            s.send_message(msg)
    else:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as s:
            s.ehlo()
            if use_tls:
                ctx = ssl.create_default_context()
                s.starttls(context=ctx)
                s.ehlo()
            s.login(smtp_username, smtp_password)
            s.send_message(msg)
