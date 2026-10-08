from fastapi.testclient import TestClient

from api.optimize import app

client = TestClient(app)


def test_health_reports_ortools_version():
    response = client.get("/api/optimize/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["ortools"].startswith("9.")
