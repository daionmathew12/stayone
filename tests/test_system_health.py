"""
Suite 0: Microservices & Gateway Health Checks
"""
import sys
import os
import time
import requests

# Add tests directory to path
sys.path.insert(0, os.path.dirname(__file__))
from conftest import BACKEND_URL, GATEWAY_URL, ADMIN_URL, USEREND_URL

def test_backend_health():
    t0 = time.time()
    r = requests.get(f"{BACKEND_URL}/health", timeout=5)
    dur = (time.time() - t0) * 1000
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    data = r.json()
    assert data.get("status") == "healthy", f"Expected healthy, got {data}"
    return dur, f"Status: {data.get('status')}"

def test_admin_dashboard_accessible():
    t0 = time.time()
    r = requests.get(ADMIN_URL, timeout=5)
    dur = (time.time() - t0) * 1000
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    return dur, "Admin dashboard reachable"

def test_userend_portal_accessible():
    t0 = time.time()
    r = requests.get(USEREND_URL, timeout=5)
    dur = (time.time() - t0) * 1000
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    return dur, "Guest portal reachable"

def test_gateway_accessible():
    t0 = time.time()
    r = requests.get(GATEWAY_URL, timeout=5)
    dur = (time.time() - t0) * 1000
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    return dur, "Nginx gateway reachable"

if __name__ == "__main__":
    tests = [
        ("TC-SYS-01", "FastAPI Backend Health", test_backend_health),
        ("TC-SYS-02", "React Admin Dashboard", test_admin_dashboard_accessible),
        ("TC-SYS-03", "React User-End Portal", test_userend_portal_accessible),
        ("TC-SYS-04", "Unified Nginx Gateway", test_gateway_accessible),
    ]
    print("\n--- Running Suite 0: System Health ---")
    for test_id, name, func in tests:
        try:
            dur, msg = func()
            print(f" [PASS] {test_id}: {name} ({dur:.1f}ms) - {msg}")
        except Exception as e:
            print(f" [FAIL] {test_id}: {name} - {e}")
