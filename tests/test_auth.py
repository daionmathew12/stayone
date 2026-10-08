"""
Suite 1: Authentication & Authorization Tests
"""
import sys
import os
import time
import requests

# Add tests directory to path
sys.path.insert(0, os.path.dirname(__file__))
from conftest import BACKEND_URL, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD

def get_auth_token(email: str = SUPERADMIN_EMAIL, password: str = SUPERADMIN_PASSWORD) -> str:
    r = requests.post(f"{BACKEND_URL}/api/auth/login", json={"email": email, "password": password}, timeout=5)
    if r.status_code != 200:
        raise ValueError(f"Failed to login: {r.status_code} {r.text}")
    return r.json()["access_token"]

def test_superadmin_login():
    t0 = time.time()
    token = get_auth_token(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
    dur = (time.time() - t0) * 1000
    assert len(token) > 20, "Expected non-empty JWT token"
    return dur, "Received valid JWT access token"

def test_invalid_password_rejection():
    t0 = time.time()
    r = requests.post(f"{BACKEND_URL}/api/auth/login", json={"email": SUPERADMIN_EMAIL, "password": "WrongPassword999!"}, timeout=5)
    dur = (time.time() - t0) * 1000
    assert r.status_code == 400, f"Expected 400, got {r.status_code}"
    return dur, "Correctly rejected with HTTP 400 Bad Request"

def test_unauthenticated_request_blocked():
    t0 = time.time()
    r = requests.get(f"{BACKEND_URL}/api/rooms?limit=5", timeout=5)
    dur = (time.time() - t0) * 1000
    assert r.status_code in [401, 403], f"Expected 401/403, got {r.status_code}"
    return dur, f"Protected endpoint returned HTTP {r.status_code}"

if __name__ == "__main__":
    tests = [
        ("TC-AUTH-01", "Super Admin Login", test_superadmin_login),
        ("TC-AUTH-02", "Invalid Password Rejection", test_invalid_password_rejection),
        ("TC-AUTH-05", "Unauthenticated Request Blocked", test_unauthenticated_request_blocked),
    ]
    print("\n--- Running Suite 1: Authentication ---")
    for test_id, name, func in tests:
        try:
            dur, msg = func()
            print(f" [PASS] {test_id}: {name} ({dur:.1f}ms) - {msg}")
        except Exception as e:
            print(f" [FAIL] {test_id}: {name} - {e}")
