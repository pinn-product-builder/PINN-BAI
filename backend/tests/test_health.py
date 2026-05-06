import pytest


def test_health_ok() -> None:
    pytest.importorskip("dotenv")
    pytest.importorskip("fastapi")
    from fastapi.testclient import TestClient

    from main import app

    client = TestClient(app)
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body.get("status") == "ok"
    assert "adapters" in body
