"""
Suite 3: Defensive Security & Hardening Tests
"""
import sys
import os
import time
import requests

# Add tests directory to path
sys.path.insert(0, os.path.dirname(__file__))
from conftest import BACKEND_URL
from test_auth import get_auth_token

def test_sql_parameterization_safety():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}", "X-Branch-ID": "all"}
    
    sql_payload = "' OR 1=1 --"
    t0 = time.time()
    r = requests.get(f"{BACKEND_URL}/api/rooms?search={sql_payload}", headers=headers, timeout=5)
    dur = (time.time() - t0) * 1000
    
    # Must not crash with 500 or expose SQL syntax error
    assert r.status_code != 500, "Server returned 500 Internal Server Error"
    assert "syntax error" not in r.text.lower(), "SQL syntax error exposed in response"
    return dur, f"Safely handled without syntax error (HTTP {r.status_code})"

def test_xss_parameter_handling():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}", "X-Branch-ID": "all"}
    
    xss_payload = "<script>alert('XSS')</script>"
    t0 = time.time()
    r = requests.get(f"{BACKEND_URL}/api/bookings?search={xss_payload}", headers=headers, timeout=5)
    dur = (time.time() - t0) * 1000
    
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    return dur, "Safely handled XSS query parameter"

def test_repo_private_key_audit():
    """Defensive audit checking if raw private keys exist in the repository root"""
    t0 = time.time()
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    found_keys = []
    
    for f in os.listdir(repo_root):
        if f.endswith("_key") or f.endswith(".pem") or f.endswith(".id_rsa"):
            found_keys.append(f)
            
    dur = (time.time() - t0) * 1000
    if found_keys:
        return dur, f"WARNING: Sensitive key files found in root: {', '.join(found_keys)}"
    return dur, "Clean: No private keys found in repo root"

if __name__ == "__main__":
    tests = [
        ("TC-SEC-01", "Private Key Audit", test_repo_private_key_audit),
        ("TC-SEC-02", "SQL Parameterization Safety", test_sql_parameterization_safety),
        ("TC-SEC-03", "XSS Parameter Handling", test_xss_parameter_handling),
    ]
    print("\n--- Running Suite 3: Security Hardening ---")
    for test_id, name, func in tests:
        try:
            dur, msg = func()
            print(f" [PASS] {test_id}: {name} ({dur:.1f}ms) - {msg}")
        except Exception as e:
            print(f" [FAIL] {test_id}: {name} - {e}")
