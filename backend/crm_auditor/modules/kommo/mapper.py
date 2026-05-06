"""
Normalização de payloads Kommo API v4 → linhas Supabase do auditor.

Referência: https://www.kommo.com/developers/content/crm-platform/api-reference/
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

# Tipos de status Kommo/Amo: 0 comum, 1 ganho, 2 perdido (convenção amplamente usada na API v4)
_STAGE_TYPE_WON = 1
_STAGE_TYPE_LOST = 2


def _ts(unix: int | None) -> datetime | None:
    if unix is None or unix == 0:
        return None
    return datetime.fromtimestamp(int(unix), tz=timezone.utc)


def map_stage_type(type_id: int | None) -> str | None:
    if type_id is None:
        return None
    if type_id == _STAGE_TYPE_WON:
        return "won"
    if type_id == _STAGE_TYPE_LOST:
        return "lost"
    return "progress"


def map_pipeline_row(tenant_id: str, raw: dict[str, Any], synced_at: str) -> dict[str, Any]:
    pid = str(raw["id"])
    return {
        "tenant_id": tenant_id,
        "external_id": pid,
        "name": raw.get("name") or "",
        "is_active": bool(raw.get("is_active", True)),
        "raw": raw,
        "synced_at": synced_at,
    }


def map_stage_row(
    tenant_id: str,
    pipeline_external_id: str,
    raw: dict[str, Any],
    synced_at: str,
) -> dict[str, Any]:
    sid = str(raw["id"])
    return {
        "tenant_id": tenant_id,
        "pipeline_external_id": pipeline_external_id,
        "external_id": sid,
        "name": raw.get("name") or "",
        "sort_order": raw.get("sort"),
        "stage_type": map_stage_type(raw.get("type")),
        "raw": raw,
        "synced_at": synced_at,
    }


def map_user_row(tenant_id: str, raw: dict[str, Any], synced_at: str) -> dict[str, Any]:
    return {
        "tenant_id": tenant_id,
        "external_id": str(raw["id"]),
        "name": (raw.get("name") or "")[:500],
        "email": raw.get("email"),
        "is_active": not bool(raw.get("is_deleted", False)),
        "raw": raw,
        "synced_at": synced_at,
    }


def _lead_primary_contact_id(raw: dict[str, Any]) -> str | None:
    emb = raw.get("_embedded") or {}
    contacts = emb.get("contacts") or []
    if contacts and isinstance(contacts, list):
        cid = contacts[0].get("id")
        if cid is not None:
            return str(cid)
    return None


def infer_lead_status(raw: dict[str, Any], stages_by_id: dict[str, str]) -> str:
    """Deriva open | won | lost a partir de closed_at e tipo de estágio."""
    closed_at = raw.get("closed_at")
    is_closed = closed_at not in (None, 0, "0", "")
    status_id = str(raw.get("status_id") or "")
    stype = stages_by_id.get(status_id)
    if is_closed:
        if stype == "won":
            return "won"
        if stype == "lost":
            return "lost"
        return "lost"
    return "open"


def map_lead_row(
    tenant_id: str,
    raw: dict[str, Any],
    stages_by_id: dict[str, str],
    synced_at: str,
) -> dict[str, Any]:
    status_id = str(raw.get("status_id") or "")
    lead_status = infer_lead_status(raw, stages_by_id)
    loss_reason = raw.get("loss_reason_id")
    return {
        "tenant_id": tenant_id,
        "external_id": str(raw["id"]),
        "name": (raw.get("name") or "")[:500],
        "pipeline_external_id": str(raw["pipeline_id"]) if raw.get("pipeline_id") is not None else None,
        "stage_external_id": status_id or None,
        "lead_status": lead_status,
        "value": float(raw.get("price") or 0),
        "currency": None,
        "owner_external_id": str(raw["responsible_user_id"])
        if raw.get("responsible_user_id") is not None
        else None,
        "contact_external_id": _lead_primary_contact_id(raw),
        "company_external_id": None,
        "source": None,
        "lost_reason": str(loss_reason) if loss_reason is not None else None,
        "created_at": _ts(raw.get("created_at")).isoformat() if _ts(raw.get("created_at")) else None,
        "closed_at": _ts(raw.get("closed_at")).isoformat() if _ts(raw.get("closed_at")) else None,
        "external_updated_at": _ts(raw.get("updated_at")).isoformat()
        if _ts(raw.get("updated_at"))
        else None,
        "raw": raw,
        "synced_at": synced_at,
    }


def map_contact_row(tenant_id: str, raw: dict[str, Any], synced_at: str) -> dict[str, Any]:
    email = phone = None
    for field in raw.get("custom_fields_values") or []:
        code = field.get("field_code")
        vals = field.get("values") or []
        val = str(vals[0].get("value", "")).strip() if vals else ""
        if code == "EMAIL" and val:
            email = val
        if code == "PHONE" and val:
            phone = val
    return {
        "tenant_id": tenant_id,
        "external_id": str(raw["id"]),
        "name": (raw.get("name") or "")[:500],
        "email": email,
        "phone": phone,
        "company_external_id": str(raw["_embedded"]["companies"][0]["id"])
        if (raw.get("_embedded") or {}).get("companies")
        else None,
        "raw": raw,
        "synced_at": synced_at,
    }


def map_company_row(tenant_id: str, raw: dict[str, Any], synced_at: str) -> dict[str, Any]:
    return {
        "tenant_id": tenant_id,
        "external_id": str(raw["id"]),
        "name": (raw.get("name") or "")[:500],
        "raw": raw,
        "synced_at": synced_at,
    }


def _task_entity_type_as_int(entity_type: Any) -> int:
    if entity_type is None:
        return 0
    if isinstance(entity_type, int):
        return entity_type
    if isinstance(entity_type, str):
        s = entity_type.strip().lower()
        if s.isdigit():
            return int(s)
        mapping = {"contacts": 1, "contact": 1, "leads": 2, "lead": 2, "companies": 3, "company": 3}
        return mapping.get(s, 0)
    return 0


def map_task_row(tenant_id: str, raw: dict[str, Any], synced_at: str) -> dict[str, Any]:
    entity_id = raw.get("entity_id")
    etype = _task_entity_type_as_int(raw.get("entity_type"))
    lead_external_id = str(entity_id) if entity_id is not None and etype == 2 else None
    contact_external_id = str(entity_id) if entity_id is not None and etype == 1 else None
    is_completed = bool(raw.get("is_completed", False))
    return {
        "tenant_id": tenant_id,
        "external_id": str(raw["id"]),
        "lead_external_id": lead_external_id,
        "contact_external_id": contact_external_id,
        "title": str(raw.get("text") or raw.get("task_type_id") or "")[:500],
        "due_at": _ts(raw.get("complete_till")).isoformat() if _ts(raw.get("complete_till")) else None,
        "completed_at": _ts(raw.get("completed_at")).isoformat()
        if _ts(raw.get("completed_at"))
        else None,
        "is_completed": is_completed,
        "assignee_external_id": str(raw["responsible_user_id"])
        if raw.get("responsible_user_id") is not None
        else None,
        "raw": raw,
        "synced_at": synced_at,
    }


def map_custom_field_row(
    tenant_id: str,
    entity_type: str,
    raw: dict[str, Any],
    synced_at: str,
) -> dict[str, Any]:
    return {
        "tenant_id": tenant_id,
        "entity_type": entity_type,
        "external_id": str(raw.get("id") or raw.get("field_id") or ""),
        "name": (raw.get("name") or "")[:500],
        "field_type": raw.get("type"),
        "raw": raw,
        "synced_at": synced_at,
    }


def build_stage_index(stages_rows: list[dict[str, Any]]) -> dict[str, str]:
    """external_id do estágio -> stage_type (won/lost/progress)."""
    out: dict[str, str] = {}
    for r in stages_rows:
        sid = r.get("external_id")
        st = r.get("stage_type")
        if sid and st:
            out[str(sid)] = st
    return out


def _kommo_entity_label(entity_type: Any) -> str | None:
    if entity_type is None:
        return None
    if isinstance(entity_type, str):
        s = entity_type.strip().lower()
        if s in ("lead", "leads"):
            return "lead"
        if s in ("contact", "contacts"):
            return "contact"
        if s in ("company", "companies"):
            return "company"
        if s.isdigit():
            return _kommo_entity_label(int(s))
        return None
    try:
        code = int(entity_type)
    except (TypeError, ValueError):
        return None
    return {1: "contact", 2: "lead", 3: "company"}.get(code)


def map_note_row(tenant_id: str, raw: dict[str, Any], synced_at: str) -> dict[str, Any]:
    scope = raw.get("_auditor_scope_entity_type")
    if scope is None:
        scope = raw.get("entity_type")
    scope_s = str(scope or "leads").lower()
    if scope_s.isdigit():
        scope_s = {1: "contacts", 2: "leads", 3: "companies"}.get(int(scope_s), "leads")
    else:
        _pl = {"lead": "leads", "contact": "contacts", "company": "companies"}
        scope_s = _pl.get(scope_s, scope_s if scope_s in _pl.values() else "leads")
    text = raw.get("text")
    if text is None and isinstance(raw.get("params"), dict):
        text = raw["params"].get("text")
    if not isinstance(text, str):
        text = str(text or "")
    ts = raw.get("created_at")
    note_dt = None
    if ts is not None:
        try:
            note_dt = _ts(int(ts))
        except (TypeError, ValueError):
            note_dt = None
    eid = raw.get("entity_id")
    return {
        "tenant_id": tenant_id,
        "external_id": str(raw["id"]),
        "scope_entity_type": scope_s[:80],
        "entity_external_id": str(eid) if eid is not None else None,
        "note_type": str(raw["note_type"]) if raw.get("note_type") is not None else None,
        "content_preview": text[:2000],
        "note_at": note_dt.isoformat() if note_dt else None,
        "raw": raw,
        "synced_at": synced_at,
    }


def map_event_row(tenant_id: str, raw: dict[str, Any], synced_at: str) -> dict[str, Any]:
    et_label = _kommo_entity_label(raw.get("entity_type"))
    ts = raw.get("created_at")
    occurred = None
    if ts is not None:
        try:
            occurred = _ts(int(ts))
        except (TypeError, ValueError):
            occurred = None
    eid = raw.get("entity_id")
    return {
        "tenant_id": tenant_id,
        "external_id": str(raw["id"]),
        "event_type": str(raw["type"]) if raw.get("type") is not None else None,
        "entity_type": et_label,
        "entity_external_id": str(eid) if eid is not None else None,
        "occurred_at": occurred.isoformat() if occurred else None,
        "raw": raw,
        "synced_at": synced_at,
    }


def map_conversation_row(tenant_id: str, raw: dict[str, Any], synced_at: str) -> dict[str, Any]:
    cid = raw.get("contact_id")
    preview = raw.get("last_message") or raw.get("preview") or ""
    if not isinstance(preview, str):
        preview = str(preview or "")
    ts = raw.get("updated_at") or raw.get("last_message_at")
    last_at = None
    if ts is not None:
        try:
            last_at = _ts(int(ts))
        except (TypeError, ValueError):
            last_at = None
    return {
        "tenant_id": tenant_id,
        "external_id": str(raw["id"]),
        "contact_external_id": str(cid) if cid is not None else None,
        "status": str(raw["status"]) if raw.get("status") is not None else None,
        "last_message_preview": preview[:2000],
        "last_message_at": last_at.isoformat() if last_at else None,
        "raw": raw,
        "synced_at": synced_at,
    }
