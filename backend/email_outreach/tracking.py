"""Utilitários de tracking de email (E2 — Brick F).

Antes de cada envio, injetamos:
- Pixel transparente 1x1 → ``GET /email/track/open/{message_id}``.
- Rewrite de todos os ``<a href="...">`` → ``/email/track/click/{message_id}?u=<url-encoded>``.
- ``List-Unsubscribe`` header + link no rodapé → ``/email/unsubscribe/{token}``.

Token de unsubscribe é HMAC(message_id) — não precisa de DB lookup pra validar,
e o lead já está identificado pelo próprio message_id.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import re
from urllib.parse import quote


def _tracking_base() -> str:
    """URL pública que recebe pixel/click. Default = mesmo host do app
    (proxy via Nginx no docker-compose), override via env."""
    return (os.environ.get("EO_PUBLIC_BASE_URL") or "https://bai.pinnpb.com").rstrip("/")


def _unsubscribe_secret() -> str:
    """Segredo HMAC pro token de unsubscribe. Usa EO_ENCRYPTION_KEY como fallback."""
    return os.environ.get("EO_UNSUBSCRIBE_SECRET") or os.environ.get("EO_ENCRYPTION_KEY", "fallback-key")


def build_unsubscribe_token(message_id: str) -> str:
    """HMAC-SHA256 truncado em 16 bytes hex (32 chars). Suficiente contra adivinhação."""
    sig = hmac.new(_unsubscribe_secret().encode(), message_id.encode(), hashlib.sha256).hexdigest()
    return sig[:32]


def verify_unsubscribe_token(message_id: str, token: str) -> bool:
    expected = build_unsubscribe_token(message_id)
    return hmac.compare_digest(token, expected)


def open_pixel_url(message_id: str) -> str:
    return f"{_tracking_base()}/email/track/open/{message_id}"


def click_redirect_url(message_id: str, target_url: str) -> str:
    return f"{_tracking_base()}/email/track/click/{message_id}?u={quote(target_url, safe='')}"


def unsubscribe_url(message_id: str) -> str:
    token = build_unsubscribe_token(message_id)
    return f"{_tracking_base()}/email/unsubscribe/{message_id}/{token}"


_HREF_RE = re.compile(
    r'(<a\s+[^>]*?href\s*=\s*)(["\'])(?P<url>https?://[^"\']+)\2',
    flags=re.IGNORECASE,
)


def inject_tracking(
    html: str,
    message_id: str,
    *,
    track_opens: bool,
    track_clicks: bool,
    add_unsubscribe_footer: bool = True,
) -> str:
    """Pega body HTML cru e retorna versão com pixel, links reescritos e
    footer de unsubscribe. Se ``track_opens=False``, sem pixel. Mesmo
    raciocínio pra clicks.

    O footer de unsubscribe vai sempre que ``add_unsubscribe_footer=True``
    (compliance CAN-SPAM/LGPD).
    """
    out = html

    if track_clicks:
        def rewrite(m: re.Match[str]) -> str:
            url = m.group("url")
            # Não reescreve mailto:, tel:, ou já está apontando pra nós.
            if not url.startswith(("http://", "https://")):
                return m.group(0)
            if "/email/track/" in url or "/email/unsubscribe/" in url:
                return m.group(0)
            new_url = click_redirect_url(message_id, url)
            return f'{m.group(1)}{m.group(2)}{new_url}{m.group(2)}'

        out = _HREF_RE.sub(rewrite, out)

    footer_parts: list[str] = []
    if add_unsubscribe_footer:
        unsub = unsubscribe_url(message_id)
        footer_parts.append(
            f'<div style="margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;'
            f'font-size:11px;color:#9ca3af;font-family:sans-serif">'
            f'Não quer mais receber? <a href="{unsub}" '
            f'style="color:#6b7280;text-decoration:underline">Cancelar inscrição</a>.'
            f'</div>'
        )

    if track_opens:
        pixel = open_pixel_url(message_id)
        # Pixel no fim do body, antes de </body> se existir.
        img = f'<img src="{pixel}" width="1" height="1" alt="" style="display:none;border:0" />'
        footer_parts.append(img)

    if footer_parts:
        injection = "".join(footer_parts)
        if "</body>" in out.lower():
            out = re.sub(r"</body>", injection + "</body>", out, count=1, flags=re.IGNORECASE)
        else:
            out = out + injection

    return out


def list_unsubscribe_headers(message_id: str) -> dict[str, str]:
    """Headers ``List-Unsubscribe`` e ``List-Unsubscribe-Post`` (RFC 8058 — one-click).

    Gmail/Outlook respeitam: mostram botão "Cancelar inscrição" nativo no topo do email.
    """
    url = unsubscribe_url(message_id)
    return {
        "List-Unsubscribe": f"<{url}>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    }
