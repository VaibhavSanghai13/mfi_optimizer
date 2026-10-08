"""POST /api/optimize: JWT checks and a real solve through the HTTP layer."""

import json
import time
from pathlib import Path

import jwt
import pytest
from fastapi.testclient import TestClient

from api.optimize import app

SECRET = "test-secret-that-is-long-enough-for-hs256"
client = TestClient(app)
sample = json.loads((Path(__file__).parent / "sample_request.json").read_text())
sample["time_limit_sec"] = 1


@pytest.fixture(autouse=True)
def jwt_secret(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)


def token(role: str, secret: str = SECRET, expires_in: int = 3600) -> dict:
    claims = {"sub": "user-1", "role": role, "officerId": None, "exp": int(time.time()) + expires_in}
    return {"Authorization": f"Bearer {jwt.encode(claims, secret, algorithm='HS256')}"}


def test_without_token_is_401():
    assert client.post("/api/optimize", json=sample).status_code == 401


def test_wrong_secret_or_expired_token_is_401():
    assert client.post("/api/optimize", json=sample, headers=token("manager", secret="other-secret-of-sufficient-length")).status_code == 401
    assert client.post("/api/optimize", json=sample, headers=token("manager", expires_in=-10)).status_code == 401


def test_field_officer_is_403():
    assert client.post("/api/optimize", json=sample, headers=token("field_officer")).status_code == 403


def test_manager_gets_routes():
    response = client.post("/api/optimize", json=sample, headers=token("manager"))
    assert response.status_code == 200
    body = response.json()
    assert body["status"] in ("optimal", "partial")
    assert len(body["routes"]) == 3


def test_invalid_input_is_422():
    response = client.post("/api/optimize", json={**sample, "time_matrix": [[0, 1]]}, headers=token("manager"))
    assert response.status_code == 422
