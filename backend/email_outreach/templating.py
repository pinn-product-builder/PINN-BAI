"""Formatação do corpo de cold emails — padrão "plain-like" Pinn Smart.

Antes do ``inject_tracking()`` (pixel + click rewrite + footer unsubscribe),
passamos o ``body_html`` cru por aqui pra:

1. **Normalizar parágrafos**: se o usuário escreveu texto puro, transforma
   quebras duplas (``\\n\\n``) em ``<p>`` e quebras simples em ``<br>``.
   Se já veio com ``<p>``/``<br>``/``<div>``, preserva o HTML.
2. **Aplicar CSS inline mínimo**: alguns clientes (Outlook desktop, Gmail
   mobile em modo dark) zeram margens de ``<p>``. Garantimos espaçamento
   natural entre parágrafos sem depender de ``<style>`` no head.
3. **Anexar assinatura plain-like**: usa os campos ``signature_*`` da
   ``eo_inboxes``. Se ``signature_html`` estiver preenchido, usa ele
   verbatim (override total). Caso contrário, monta a partir de
   ``signature_name``, ``signature_role``, ``signature_company``,
   ``signature_phone``, ``signature_link``.

Por que NÃO usar ``<table>`` 600px estilo newsletter?
Cold email B2B 1:1 deve parecer escrito à mão. Tabelas, fontes web,
cores fortes e imagens fazem o Gmail classificar como "Promoções" e
o Outlook joga em "Lixo eletrônico". Mantemos texto puro com fontes
default do cliente.

Esta camada NÃO mexe em links (quem reescreve é ``tracking.inject_tracking``)
nem injeta pixel/footer de unsubscribe (idem). É puramente sobre estética.
"""
from __future__ import annotations

import html as html_lib
import re
from typing import Any


# Tags consideradas "estruturais" — se o body cru já contém alguma delas,
# assumimos que o usuário escreveu HTML conscientemente e não tentamos
# inferir parágrafos a partir de quebras de linha.
_STRUCTURAL_TAGS_RE = re.compile(
    r"<\s*(p|div|br|ul|ol|li|h[1-6]|blockquote|table)\b",
    flags=re.IGNORECASE,
)

# CSS inline aplicado em cada <p> que injetamos. Mantemos curto pra não
# explodir o tamanho do email; só o essencial pra spacing + tipografia legível.
_PARAGRAPH_STYLE = (
    "margin:0 0 14px 0;line-height:1.55;color:#1f2937;"
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',"
    "Roboto,Helvetica,Arial,sans-serif;font-size:15px"
)

# Wrapper container — max-width pra ficar legível em desktop (sem virar
# linha gigante atravessada), mas SEM <table> nem background colorido.
_CONTAINER_OPEN = (
    '<div style="max-width:560px;color:#1f2937;'
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',"
    'Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55">'
)
_CONTAINER_CLOSE = "</div>"


def _normalize_paragraphs(raw: str) -> str:
    """Texto puro → HTML simples com ``<p>`` por blocos e ``<br>`` em quebras.

    Se ``raw`` já contém tags estruturais (``<p>``, ``<div>``, ``<br>``...),
    assume HTML deliberado e devolve sem alterar — apenas re-injeta o estilo
    inline em ``<p>`` que esteja sem ``style=`` (cobertura defensiva).
    """
    if not raw:
        return ""

    if _STRUCTURAL_TAGS_RE.search(raw):
        # Re-aplica style em <p> que estejam sem style explícito.
        # Não toca em <p style="..."> existente (respeita override do usuário).
        def _inject_style(match: re.Match[str]) -> str:
            tag = match.group(0)
            if "style=" in tag.lower():
                return tag
            return tag[:-1] + f' style="{_PARAGRAPH_STYLE}">'

        return re.sub(r"<\s*p\b[^>]*>", _inject_style, raw, flags=re.IGNORECASE)

    # Texto puro: split por \n\n (parágrafos), \n vira <br>.
    blocks = [b.strip() for b in re.split(r"\n\s*\n", raw.strip()) if b.strip()]
    pieces: list[str] = []
    for block in blocks:
        # Escapa HTML pra não permitir injeção via template do usuário.
        safe = html_lib.escape(block, quote=False)
        # \n simples vira <br>.
        safe = safe.replace("\n", "<br>")
        pieces.append(f'<p style="{_PARAGRAPH_STYLE}">{safe}</p>')
    return "".join(pieces)


def render_signature(inbox: dict[str, Any]) -> str:
    """Monta o HTML da assinatura a partir dos campos ``signature_*``.

    Precedência:
    - Se ``signature_html`` existir e não-vazio → usa ele verbatim
      (já está "plain-like" se quem preencheu fez certo).
    - Senão monta linhas formatadas a partir de:
      * Linha 1: ``signature_name``
      * Linha 2: ``signature_role`` · ``signature_company`` (separador "·")
      * Linha 3: ``signature_phone`` (se houver) — link tel: opcional
      * Linha 4: ``signature_link`` (se houver) — link http opcional

    Sem nenhum campo preenchido → string vazia (sem assinatura).
    """
    raw_html = (inbox.get("signature_html") or "").strip()
    if raw_html:
        return (
            '<div style="margin-top:24px;padding-top:14px;'
            'border-top:1px solid #e5e7eb;font-size:14px;color:#4b5563;'
            "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',"
            'Roboto,Helvetica,Arial,sans-serif;line-height:1.5">'
            f"{raw_html}"
            "</div>"
        )

    name = (inbox.get("signature_name") or "").strip()
    role = (inbox.get("signature_role") or "").strip()
    company = (inbox.get("signature_company") or "").strip()
    phone = (inbox.get("signature_phone") or "").strip()
    link = (inbox.get("signature_link") or "").strip()

    if not any((name, role, company, phone, link)):
        return ""

    lines: list[str] = []
    if name:
        lines.append(
            f'<div style="font-weight:600;color:#1f2937">{html_lib.escape(name)}</div>'
        )
    role_company_parts = [p for p in (role, company) if p]
    if role_company_parts:
        lines.append(
            '<div style="color:#4b5563">'
            + html_lib.escape(" · ".join(role_company_parts))
            + "</div>"
        )
    if phone:
        digits = re.sub(r"[^\d+]", "", phone)
        phone_html = (
            f'<a href="tel:{digits}" style="color:#4b5563;text-decoration:none">'
            f"{html_lib.escape(phone)}</a>"
            if digits
            else html_lib.escape(phone)
        )
        lines.append(f'<div style="color:#4b5563">{phone_html}</div>')
    if link:
        # Garante schema; se o usuário botou só "pinnpb.com", prefixa https://.
        href = link if re.match(r"^https?://", link, re.IGNORECASE) else f"https://{link}"
        lines.append(
            '<div style="color:#4b5563">'
            f'<a href="{html_lib.escape(href, quote=True)}" '
            'style="color:#4b5563;text-decoration:underline">'
            f"{html_lib.escape(link)}</a>"
            "</div>"
        )

    return (
        '<div style="margin-top:24px;padding-top:14px;'
        'border-top:1px solid #e5e7eb;font-size:14px;'
        "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',"
        'Roboto,Helvetica,Arial,sans-serif;line-height:1.5">'
        + "".join(lines)
        + "</div>"
    )


def render_email_body(raw_body_html: str, *, inbox: dict[str, Any]) -> str:
    """Pipeline completo: normaliza + wrap + assinatura.

    NÃO injeta pixel/click rewrite/unsubscribe footer — isso é responsabilidade
    do ``tracking.inject_tracking`` que roda DEPOIS, recebendo o resultado
    desta função.

    O ``inbox`` é o dict completo (linha de ``eo_inboxes``), de onde lemos
    os campos ``signature_*`` para montar a assinatura.
    """
    body_html = _normalize_paragraphs(raw_body_html)
    signature_html = render_signature(inbox)
    return f"{_CONTAINER_OPEN}{body_html}{signature_html}{_CONTAINER_CLOSE}"


# Alias retrocompatível — codepaths futuros podem usar o nome curto.
format_body = render_email_body
