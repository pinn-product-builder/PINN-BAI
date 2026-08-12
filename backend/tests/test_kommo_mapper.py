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


def test_map_lead_row_resolves_loss_reason_name() -> None:
    raw = {
        "id": 1,
        "name": "Deal",
        "price": 0,
        "pipeline_id": 10,
        "status_id": 20,
        "responsible_user_id": 5,
        "closed_at": 1700000000,
        "loss_reason_id": 3503,
    }
    stages = {"20": "lost"}
    reasons = {"3503": "Preço alto", "75": "Sem fit"}
    row = mapper.map_lead_row(
        "00000000-0000-0000-0000-000000000001", raw, stages, "2025-01-01T00:00:00Z", reasons
    )
    assert row["lost_reason"] == "Preço alto"


def test_map_lead_row_loss_reason_unknown_id_falls_back_to_none() -> None:
    raw = {
        "id": 1,
        "name": "Deal",
        "price": 0,
        "pipeline_id": 10,
        "status_id": 20,
        "responsible_user_id": 5,
        "closed_at": 1700000000,
        "loss_reason_id": 9999,
    }
    stages = {"20": "lost"}
    row = mapper.map_lead_row(
        "00000000-0000-0000-0000-000000000001", raw, stages, "2025-01-01T00:00:00Z", {"3503": "Preço alto"}
    )
    # Sem nome no catálogo: prefere None a expor o ID cru no dashboard.
    assert row["lost_reason"] is None


def test_build_loss_reason_index() -> None:
    idx = mapper.build_loss_reason_index([
        {"id": 3503, "name": "Preço alto"},
        {"id": 75, "name": "Sem fit"},
        {"id": None, "name": "x"},
        {"id": 1, "name": ""},
    ])
    assert idx == {"3503": "Preço alto", "75": "Sem fit"}


def test_opportunity_value_no_config_returns_none() -> None:
    raw = {"price": 9_000_000}
    assert mapper.compute_opportunity_value(raw, None) is None
    assert mapper.compute_opportunity_value(raw, {}) is None


def test_opportunity_value_debt_with_commission() -> None:
    raw = {"price": 1_000_000}
    cfg = {"value_is_debt": True, "commission_pct": 0.20, "fixed_fee": 5000}
    # 1M de dívida × 20% comissão + R$5k fixo = R$205k
    assert mapper.compute_opportunity_value(raw, cfg) == 205_000.0


def test_opportunity_value_custom_field_id() -> None:
    raw = {
        "price": 9_000_000,
        "custom_fields_values": [
            {"field_id": 12345, "values": [{"value": "85000"}]},
            {"field_id": 99999, "values": [{"value": "ignored"}]},
        ],
    }
    cfg = {"opportunity_field_id": "12345"}
    assert mapper.compute_opportunity_value(raw, cfg) == 85_000.0


def test_detect_person_type_cpf() -> None:
    raw = {"custom_fields_values": [{"values": [{"value": "123.456.789-01"}]}]}
    assert mapper.detect_person_type(raw) == "PF"


def test_detect_person_type_cnpj() -> None:
    raw = {"custom_fields_values": [{"values": [{"value": "12.345.678/0001-99"}]}]}
    assert mapper.detect_person_type(raw) == "PJ"


def test_detect_person_type_pj_via_embedded_companies() -> None:
    raw = {"_embedded": {"companies": [{"id": 42}]}}
    assert mapper.detect_person_type(raw) == "PJ"


def test_detect_person_type_returns_none_when_no_signal() -> None:
    raw = {"custom_fields_values": [{"values": [{"value": "foo@bar.com"}]}]}
    assert mapper.detect_person_type(raw) is None


def test_map_contact_row_includes_person_type() -> None:
    raw = {
        "id": 7,
        "name": "Acme Ltda",
        "custom_fields_values": [
            {"field_code": "EMAIL", "values": [{"value": "ops@acme.com"}]},
            {"values": [{"value": "00.000.000/0001-00"}]},
        ],
    }
    row = mapper.map_contact_row("00000000-0000-0000-0000-000000000001", raw, "2025-01-01T00:00:00Z")
    assert row["person_type"] == "PJ"
    assert row["email"] == "ops@acme.com"


def test_map_lead_row_writes_opportunity_value_when_config_present() -> None:
    raw = {
        "id": 1, "name": "Lead", "price": 100_000, "pipeline_id": 10,
        "status_id": 20, "responsible_user_id": 5,
    }
    cfg = {"value_is_debt": True, "commission_pct": 0.1}
    row = mapper.map_lead_row(
        "00000000-0000-0000-0000-000000000001",
        raw, {"20": "progress"}, "2025-01-01T00:00:00Z",
        None, cfg,
    )
    assert row["value"] == 100_000.0
    assert row["opportunity_value"] == 10_000.0
