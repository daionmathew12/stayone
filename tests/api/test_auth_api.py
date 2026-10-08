"""
API Test Suite: Authentication & Authorization Security
"""
import pytest
from tests.config.settings import settings
from tests.core.api_client import APIClient

@pytest.mark.api
@pytest.mark.smoke
class TestAuthAPI:
    def test_valid_superadmin_login(self, api_client: APIClient):
        """Verify Super Admin can successfully authenticate and obtain JWT token"""
        resp = api_client.post(
            "/api/auth/login",
            json={"email": settings.SUPERADMIN_EMAIL, "password": settings.SUPERADMIN_PASSWORD}
        )
        resp.assert_status(200)
        data = resp.json()
        assert "access_token" in data, "Token missing in response"
        assert data.get("token_type", "").lower() == "bearer"
        assert len(data["access_token"]) > 30

    def test_invalid_credentials_rejected(self, api_client: APIClient):
        """Verify invalid passwords correctly fail with HTTP 400 or 401"""
        resp = api_client.post(
            "/api/auth/login",
            json={"email": settings.SUPERADMIN_EMAIL, "password": "WrongPassword999!"}
        )
        assert resp.status_code in [400, 401], f"Expected 400/401, got {resp.status_code}"

    def test_unregistered_email_rejected(self, api_client: APIClient):
        """Verify non-existent user returns 400 or 401"""
        resp = api_client.post(
            "/api/auth/login",
            json={"email": "nonexistent_user@stayone.com", "password": "AnyPassword123"}
        )
        assert resp.status_code in [400, 401], f"Expected 400/401, got {resp.status_code}"

    def test_protected_endpoint_without_token(self, api_client: APIClient):
        """Verify protected endpoints return HTTP 401 when no token is supplied"""
        api_client.set_auth_token("")
        resp = api_client.get("/api/bookings")
        resp.assert_status(401)

    def test_protected_endpoint_with_malformed_token(self, api_client: APIClient):
        """Verify protected endpoints reject forged/malformed tokens"""
        api_client.set_auth_token("invalid.jwt.token.here")
        resp = api_client.get("/api/bookings")
        resp.assert_status(401)
