"""
Fonte unificada de leads para os serviços de KPI (threshold/achievement).

`crm_leads` (sync de CRM — Kommo/Ploomes/Omie, chave tenant_id) é a fonte
principal; a tabela legada `leads` (Meta Ads, chave org_id) é fallback.
Normaliza para o shape {id, status, value, created_at} usado nos cálculos,
com lead_status 'won' → 'converted'.

Invariante: tenants.id == organizations.id (auto_provision_tenant), então
o org_id vale como tenant_id.
"""
from __future__ import annotations


def fetch_org_leads(db, org_id: str, start: str | None = None) -> list[dict]:
    q = db.table("crm_leads").select(
        "external_id,lead_status,value,opportunity_value,created_at"
    ).eq("tenant_id", org_id)
    if start:
        q = q.gte("created_at", start)
    rows = (q.execute().data) or []
    if rows:
        normalized: list[dict] = []
        for r in rows:
            status_raw = (r.get("lead_status") or "open").lower()
            normalized.append({
                "id": r.get("external_id"),
                "status": "converted" if status_raw == "won" else status_raw,
                "value": r.get("opportunity_value") or r.get("value") or 0,
                "created_at": r.get("created_at"),
            })
        return normalized

    q = db.table("leads").select("id,status,value,created_at").eq("org_id", org_id)
    if start:
        q = q.gte("created_at", start)
    return (q.execute().data) or []


def org_has_converted_lead(db, org_id: str) -> bool:
    """Existe algum lead ganho/convertido na org (all-time)? crm_leads first."""
    r = (
        db.table("crm_leads").select("external_id")
        .eq("tenant_id", org_id).eq("lead_status", "won").limit(1).execute()
    )
    if r.data:
        return True
    r = (
        db.table("leads").select("id")
        .eq("org_id", org_id).eq("status", "converted").limit(1).execute()
    )
    return bool(r.data)
