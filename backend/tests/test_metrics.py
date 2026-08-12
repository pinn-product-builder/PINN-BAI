from crm_auditor.modules.analytics.metrics_service import MetricsService


def test_compute_data_quality_score_bounds() -> None:
    svc = MetricsService(db=None)  # type: ignore[arg-type]
    overview = {
        "total_active_leads": 10,
        "open_leads_without_owner": 5,
        "open_leads_without_value": 4,
        "open_leads_without_source": 3,
    }
    breakdown = {
        "contacts_total": 10,
        "contacts_without_email": 5,
        "contacts_without_phone": 2,
        "duplicate_email_keys": 1,
        "duplicate_open_lead_groups": 1,
    }
    score = svc.compute_data_quality_score(overview, breakdown)
    assert 0 <= score <= 100


def test_compute_operation_score() -> None:
    svc = MetricsService(db=None)  # type: ignore[arg-type]
    op = svc.compute_operation_score(80, overdue_tasks=5, stuck_leads=2, no_action=3)
    assert 0 <= op <= 80
