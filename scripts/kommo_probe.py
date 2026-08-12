#!/usr/bin/env python3
"""Verdade-base: bate na API do Kommo com o token da conexão e conta o que EXISTE.

Read-only (só GET). Lê access_token+subdomain de crm_auditor_connections via
SUPABASE_DB_URL (.env.local). NUNCA imprime o token.

Uso: python3 scripts/kommo_probe.py <tenant_slug>
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parent.parent


def db_url() -> str:
    for raw in (ROOT / ".env.local").read_text().splitlines():
        if raw.strip().startswith("SUPABASE_DB_URL="):
            return raw.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("SUPABASE_DB_URL ausente em .env.local")


def get_conn_creds(slug: str):
    with psycopg.connect(db_url()) as conn, conn.cursor() as cur:
        cur.execute(
            """
            select c.credentials->>'access_token', c.credentials->>'subdomain',
                   c.provider, c.auth_via, c.updated_at
            from crm_auditor_connections c join tenants t on t.id=c.tenant_id
            where t.slug=%s order by c.updated_at desc limit 1
            """,
            (slug,),
        )
        row = cur.fetchone()
    if not row or not row[0]:
        sys.exit(f"Sem access_token na conexão de {slug}")
    return {"token": row[0], "subdomain": row[1], "provider": row[2], "auth_via": row[3], "updated_at": row[4]}


def api_get(base: str, token: str, path: str, params: dict | None = None):
    url = base + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            if r.status in (204,):
                return None
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        if e.code in (204, 404):
            return None
        raise


def main():
    if len(sys.argv) < 2:
        sys.exit("uso: kommo_probe.py <tenant_slug>")
    slug = sys.argv[1]
    creds = get_conn_creds(slug)
    sub = (creds["subdomain"] or "").strip().lower().removesuffix(".kommo.com")
    base = f"https://{sub}.kommo.com"
    token = creds["token"]

    print(f"Conta (subdomínio): {sub}.kommo.com")
    print(f"auth_via={creds['auth_via']}  conn.updated_at={creds['updated_at']}")
    print("-" * 64)

    # /account → confirma identidade da conta
    acc = api_get(base, token, "/api/v4/account")
    if acc:
        print(f"account.id={acc.get('id')}  name={acc.get('name')}  subdomain={acc.get('subdomain')}")
    print("-" * 64)

    # pipelines + stages reais
    pipes = api_get(base, token, "/api/v4/leads/pipelines")
    plist = ((pipes or {}).get("_embedded") or {}).get("pipelines") or []
    print(f"PIPELINES reais no Kommo: {len(plist)}")
    for p in plist:
        statuses = ((p.get("_embedded") or {}).get("statuses")) or []
        print(f"  - id={p.get('id')}  '{p.get('name')}'  stages={len(statuses)}")

    # contagem total de leads (paginação completa, _limit 250)
    print("-" * 64)
    total = 0
    by_pipe: dict = {}
    page = 1
    while page < 1000:
        body = api_get(base, token, "/api/v4/leads", {"_limit": 250, "_page": page, "with": "contacts"})
        items = ((body or {}).get("_embedded") or {}).get("leads") or []
        if not items:
            break
        total += len(items)
        for ld in items:
            pid = str(ld.get("pipeline_id"))
            by_pipe[pid] = by_pipe.get(pid, 0) + 1
        if "next" not in ((body or {}).get("_links") or {}):
            break
        page += 1
    print(f"TOTAL de leads no Kommo: {total}  (em {page} página[s])")
    for pid, n in sorted(by_pipe.items(), key=lambda x: -x[1]):
        name = next((p.get("name") for p in plist if str(p.get("id")) == pid), "?")
        print(f"  pipeline {pid} '{name}': {n} leads")


if __name__ == "__main__":
    main()
