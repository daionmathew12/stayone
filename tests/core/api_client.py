"""
StayOne Test Framework - Robust API Client
Wraps requests with auto-auth, timing, logging, and response assertion helpers.
"""
import time
from typing import Dict, Any, Optional
import requests
from requests import Response

from tests.config.settings import settings
from tests.core.logger import logger

class APIResponse:
    """Wrapper around requests.Response providing timing, logging, and assertion methods"""
    def __init__(self, raw: Response, duration_ms: float):
        self.raw = raw
        self.status_code = raw.status_code
        self.headers = raw.headers
        self.duration_ms = duration_ms
        self._json_cache = None

    def json(self) -> Any:
        if self._json_cache is None:
            self._json_cache = self.raw.json()
        return self._json_cache

    @property
    def text(self) -> str:
        return self.raw.text

    def assert_status(self, expected_status: int, message: str = "") -> "APIResponse":
        err = message or f"Expected status {expected_status}, but received {self.status_code}. Response: {self.text[:200]}"
        assert self.status_code == expected_status, err
        return self

    def assert_json_contains(self, key: str, message: str = "") -> "APIResponse":
        data = self.json()
        err = message or f"Key '{key}' not found in JSON response keys: {list(data.keys()) if isinstance(data, dict) else type(data)}"
        if isinstance(data, dict):
            assert key in data, err
        elif isinstance(data, list):
            assert any(isinstance(item, dict) and key in item for item in data), err
        else:
            raise AssertionError(f"Expected dict or list JSON response, got {type(data)}")
        return self

    def assert_max_duration(self, max_ms: float) -> "APIResponse":
        assert self.duration_ms <= max_ms, f"Request took {self.duration_ms:.1f}ms, exceeding threshold of {max_ms}ms"
        return self


class APIClient:
    """Enterprise API Client for StayOne Backend & Gateway Services"""
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or settings.BACKEND_URL).rstrip("/")
        self.session = requests.Session()
        self.token: Optional[str] = None
        self.branch_id: str = "all"
        self.default_timeout = settings.REQUEST_TIMEOUT

    def set_auth_token(self, token: str):
        self.token = token

    def set_branch(self, branch_id: str):
        self.branch_id = str(branch_id)

    def _get_headers(self, custom_headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers = {
            "Accept": "application/json",
            "X-Branch-ID": self.branch_id
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        if custom_headers:
            headers.update(custom_headers)
        return headers

    def request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Any] = None,
        data: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[int] = None
    ) -> APIResponse:
        url = endpoint if endpoint.startswith("http") else f"{self.base_url}/{endpoint.lstrip('/')}"
        merged_headers = self._get_headers(headers)
        t_start = time.time()
        
        try:
            raw = self.session.request(
                method=method.upper(),
                url=url,
                params=params,
                json=json,
                data=data,
                headers=merged_headers,
                timeout=timeout or self.default_timeout
            )
            duration_ms = (time.time() - t_start) * 1000
            logger.debug(f"{method.upper()} {url} -> {raw.status_code} ({duration_ms:.1f}ms)")
            return APIResponse(raw, duration_ms)
        except requests.RequestException as e:
            duration_ms = (time.time() - t_start) * 1000
            logger.error(f"{method.upper()} {url} FAILED after {duration_ms:.1f}ms: {e}")
            raise

    def get(self, endpoint: str, **kwargs) -> APIResponse:
        return self.request("GET", endpoint, **kwargs)

    def post(self, endpoint: str, **kwargs) -> APIResponse:
        return self.request("POST", endpoint, **kwargs)

    def put(self, endpoint: str, **kwargs) -> APIResponse:
        return self.request("PUT", endpoint, **kwargs)

    def patch(self, endpoint: str, **kwargs) -> APIResponse:
        return self.request("PATCH", endpoint, **kwargs)

    def delete(self, endpoint: str, **kwargs) -> APIResponse:
        return self.request("DELETE", endpoint, **kwargs)

    # High-level domain helpers
    def authenticate(self, email: Optional[str] = None, password: Optional[str] = None) -> str:
        """Authenticate using credentials and store JWT token"""
        email = email or settings.SUPERADMIN_EMAIL
        password = password or settings.SUPERADMIN_PASSWORD
        
        resp = self.post("/api/auth/login", json={"email": email, "password": password})
        resp.assert_status(200, "Authentication failed")
        data = resp.json()
        assert "access_token" in data, "No access_token in response"
        self.token = data["access_token"]
        return self.token

    def get_rooms(self, search: Optional[str] = None) -> APIResponse:
        params = {"search": search} if search else None
        return self.get("/api/rooms", params=params)

    def get_bookings(self, search: Optional[str] = None) -> APIResponse:
        params = {"search": search} if search else None
        return self.get("/api/bookings", params=params)

    def create_booking(self, payload: Dict[str, Any]) -> APIResponse:
        return self.post("/api/bookings", json=payload)

    def delete_booking(self, booking_id: int) -> APIResponse:
        return self.delete(f"/api/bookings/{booking_id}")

    def get_branches(self) -> APIResponse:
        return self.get("/api/branches")

