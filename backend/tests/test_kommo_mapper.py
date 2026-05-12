from crm_auditor.modules.kommo import mapper


def test_infer_lead_status_open() -> None:
    raw = {"closed_at": None, "status_id": 1}
    assert mapper.infer_lead_status(raw, {"1": "progress"}) == "open"


def test_infer_lead_status_won() -> None:
    raw = {"closed_at": 1700000000, "status_id": 99}
    assert mapper.infer_lead_status(raw, {"99": "won"}) == "won"


def test_map_lead_row_basic() -> None:
    raw = {
        "id": 1,
        "name": "Deal",
        "price": 100,
        "pipeline_id": 10,
        "status_id": 20,
        "responsible_user_id": 5,
        "created_at": 1700000000,
        "updated_at": 1700000100,
        "closed_at": None,
        "_embedded": {"contacts": [{"id": 7}]},
    }
    stages = {"20": "progress"}
    row = mapper.map_lead_row("00000000-0000-0000-0000-000000000001", raw, stages, "2025-01-01T00:00:00Z")
    assert row["external_id"] == "1"
    assert row["lead_status"] == "open"
    assert row["contact_external_id"] == "7"
    assert row["owner_external_id"] == "5"


def test_map_note_row_scope() -> None:
    tid = "00000000-0000-0000-0000-000000000001"
    raw = {
        "id": 99,
        "entity_id": 7001,
        "entity_type": 2,
        "note_type": "common",
        "text": "Teste",
        "created_at": 1700000000,
        "_auditor_scope_entity_type": "leads",
    }
    row = mapper.map_note_row(tid, raw, "2025-01-01T00:00:00Z")
    assert row["external_id"] == "99"
    assert row["scope_entity_type"] == "leads"
    assert row["entity_external_id"] == "7001"


def test_map_event_row_entity_type() -> None:
    tid = "00000000-0000-0000-0000-000000000001"
    raw = {"id": 1, "type": "lead_status_changed", "entity_id": 2, "entity_type": 2, "created_at": 1700000000}
    row = mapper.map_event_row(tid, raw, "2025-01-01T00:00:00Z")
    assert row["entity_type"] == "lead"
    assert row["event_type"] == "lead_status_changed"
