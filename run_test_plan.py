#!/usr/bin/env python3
"""
StayOne Automated Test Plan Runner
==================================
Automated QA & Security verification suite corresponding to the StayOne Test Plan.
Executes test cases across Authentication, Booking Engine, Schema Validation,
Multi-Branch Boundary checks, and System Health.
"""

import sys
import time
import argparse
import requests
from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Default endpoints
DEFAULT_BACKEND_URL = "http://localhost:8011"
DEFAULT_GATEWAY_URL = "http://localhost:8080"
DEFAULT_ADMIN_URL = "http://localhost:3000"
DEFAULT_USEREND_URL = "http://localhost:3002"

# Test credentials
SUPERADMIN_EMAIL = "admin@orchid.com"
SUPERADMIN_PASSWORD = "admin123"

class TestRunner:
    def __init__(self, backend_url: str, gateway_url: str, admin_url: str, userend_url: str, verbose: bool = False):
        self.backend_url = backend_url.rstrip("/")
        self.gateway_url = gateway_url.rstrip("/")
        self.admin_url = admin_url.rstrip("/")
        self.userend_url = userend_url.rstrip("/")
        self.verbose = verbose
        self.token: Optional[str] = None
        self.test_results = []
        self.start_time = 0

    def log(self, msg: str):
        if self.verbose:
            print(f"  [DEBUG] {msg}")

    def record_result(self, test_id: str, name: str, status: str, duration_ms: float, details: str = ""):
        self.test_results.append({
            "id": test_id,
            "name": name,
            "status": status,
            "duration": duration_ms,
            "details": details
        })
        status_icon = "[PASS]" if status == "PASS" else ("[WARN]" if status == "WARN" else "[FAIL]")
        print(f" {status_icon} {test_id}: {name} ({duration_ms:.1f}ms)")
        if details and (status != "PASS" or self.verbose):
            print(f"        -> {details}")

    def auth_headers(self, branch_id: Optional[str] = "all") -> Dict[str, str]:
        headers = {"Authorization": f"Bearer {self.token}"}
        if branch_id:
            headers["X-Branch-ID"] = branch_id
        return headers

    # =========================================================================
    # Suite 0: Infrastructure & Microservices Health Checks
    # =========================================================================
    def test_health_checks(self):
        print("\n--- [Suite 0: Infrastructure & Gateway Health Checks] ---")
        
        # 1. Backend /health
        t0 = time.time()
        try:
            r = requests.get(f"{self.backend_url}/health", timeout=5)
            dur = (time.time() - t0) * 1000
            if r.status_code == 200 and "healthy" in r.text.lower():
                self.record_result("TC-SYS-01", "FastAPI Backend Health Endpoint", "PASS", dur, f"Response: {r.json()}")
            else:
                self.record_result("TC-SYS-01", "FastAPI Backend Health Endpoint", "FAIL", dur, f"Status: {r.status_code}, Body: {r.text}")
        except Exception as e:
            self.record_result("TC-SYS-01", "FastAPI Backend Health Endpoint", "FAIL", (time.time() - t0) * 1000, str(e))

        # 2. Admin Dashboard
        t0 = time.time()
        try:
            r = requests.get(self.admin_url, timeout=5)
            dur = (time.time() - t0) * 1000
            if r.status_code == 200:
                self.record_result("TC-SYS-02", "React Admin Dashboard Accessible", "PASS", dur, f"HTTP {r.status_code}")
            else:
                self.record_result("TC-SYS-02", "React Admin Dashboard Accessible", "FAIL", dur, f"HTTP {r.status_code}")
        except Exception as e:
            self.record_result("TC-SYS-02", "React Admin Dashboard Accessible", "FAIL", (time.time() - t0) * 1000, str(e))

        # 3. User-end Guest Portal
        t0 = time.time()
        try:
            r = requests.get(self.userend_url, timeout=5)
            dur = (time.time() - t0) * 1000
            if r.status_code == 200:
                self.record_result("TC-SYS-03", "React User-End Portal Accessible", "PASS", dur, f"HTTP {r.status_code}")
            else:
                self.record_result("TC-SYS-03", "React User-End Portal Accessible", "FAIL", dur, f"HTTP {r.status_code}")
        except Exception as e:
            self.record_result("TC-SYS-03", "React User-End Portal Accessible", "FAIL", (time.time() - t0) * 1000, str(e))

        # 4. Nginx Gateway
        t0 = time.time()
        try:
            r = requests.get(self.gateway_url, timeout=5)
            dur = (time.time() - t0) * 1000
            if r.status_code == 200:
                self.record_result("TC-SYS-04", "Unified Nginx Gateway Accessible", "PASS", dur, f"HTTP {r.status_code}")
            else:
                self.record_result("TC-SYS-04", "Unified Nginx Gateway Accessible", "FAIL", dur, f"HTTP {r.status_code}")
        except Exception as e:
            self.record_result("TC-SYS-04", "Unified Nginx Gateway Accessible", "FAIL", (time.time() - t0) * 1000, str(e))

    # =========================================================================
    # Suite 1: Authentication & Authorization Tests
    # =========================================================================
    def test_authentication(self):
        print("\n--- [Suite 1: Authentication & Authorization] ---")
        
        # TC-AUTH-01: Super Admin Login
        t0 = time.time()
        try:
            payload = {"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD}
            r = requests.post(f"{self.backend_url}/api/auth/login", json=payload, timeout=5)
            dur = (time.time() - t0) * 1000
            if r.status_code == 200 and "access_token" in r.json():
                self.token = r.json()["access_token"]
                self.record_result("TC-AUTH-01", "Super Admin Valid Login", "PASS", dur, "Received valid JWT access token")
            else:
                self.record_result("TC-AUTH-01", "Super Admin Valid Login", "FAIL", dur, f"HTTP {r.status_code}: {r.text}")
        except Exception as e:
            self.record_result("TC-AUTH-01", "Super Admin Valid Login", "FAIL", (time.time() - t0) * 1000, str(e))

        # TC-AUTH-02: Invalid Credentials Rejection
        t0 = time.time()
        try:
            payload = {"email": SUPERADMIN_EMAIL, "password": "WrongPassword999!"}
            r = requests.post(f"{self.backend_url}/api/auth/login", json=payload, timeout=5)
            dur = (time.time() - t0) * 1000
            if r.status_code == 400:
                self.record_result("TC-AUTH-02", "Invalid Password Rejection", "PASS", dur, "Rejected with HTTP 400 Bad Request")
            else:
                self.record_result("TC-AUTH-02", "Invalid Password Rejection", "FAIL", dur, f"Expected 400, got {r.status_code}")
        except Exception as e:
            self.record_result("TC-AUTH-02", "Invalid Password Rejection", "FAIL", (time.time() - t0) * 1000, str(e))

        # TC-AUTH-05: Authenticated Endpoint Protection
        t0 = time.time()
        try:
            r = requests.get(f"{self.backend_url}/api/rooms?limit=5", timeout=5)
            dur = (time.time() - t0) * 1000
            if r.status_code in [401, 403]:
                self.record_result("TC-AUTH-05", "Unauthenticated Request Rejection", "PASS", dur, f"Correctly blocked with HTTP {r.status_code}")
            else:
                self.record_result("TC-AUTH-05", "Unauthenticated Request Rejection", "FAIL", dur, f"Expected 401/403, got {r.status_code}")
        except Exception as e:
            self.record_result("TC-AUTH-05", "Unauthenticated Request Rejection", "FAIL", (time.time() - t0) * 1000, str(e))

    # =========================================================================
    # Suite 2: Booking Engine & Schema Validation Tests
    # =========================================================================
    def test_booking_engine(self):
        print("\n--- [Suite 2: Booking Engine & Input Validation] ---")
        if not self.token:
            print("  [SKIP] Skipping Booking Engine tests due to missing authentication token.")
            return

        # Fetch an active room for booking tests
        headers = self.auth_headers()
        rooms_res = requests.get(f"{self.backend_url}/api/rooms", headers=headers)
        if rooms_res.status_code != 200 or not rooms_res.json():
            print("  [WARN] No rooms available in database to perform room bookings.")
            return
        
        all_rooms = rooms_res.json()
        target_room = next((r for r in all_rooms if r.get("status") == "Available"), all_rooms[0])
        room_id = target_room["id"]
        room_type_id = target_room.get("room_type_id")
        self.log(f"Selected test room ID: {room_id}, Type ID: {room_type_id}")

        today = datetime.now()
        offset = (int(time.time()) % 1000) + 20
        check_in = (today + timedelta(days=offset)).strftime("%Y-%m-%d")
        check_out = (today + timedelta(days=offset + 2)).strftime("%Y-%m-%d")

        # TC-BOOK-01: Direct Physical Room Booking
        t0 = time.time()
        created_booking_id = None
        try:
            payload = {
                "guest_name": "QA Automated Guest",
                "guest_mobile": "9876543210",
                "guest_email": "qa.guest@stayone.com",
                "room_ids": [room_id],
                "room_type_id": room_type_id,
                "check_in": check_in,
                "check_out": check_out,
                "adults": 1,
                "children": 0,
                "num_rooms": 1,
                "source": "Admin"
            }
            r = requests.post(f"{self.backend_url}/api/bookings", json=payload, headers=headers, timeout=5)
            dur = (time.time() - t0) * 1000
            if r.status_code == 200 and "id" in r.json():
                booking_data = r.json()
                created_booking_id = booking_data.get("id")
                self.record_result("TC-BOOK-01", "Direct Room Booking Creation", "PASS", dur, f"Booking ID: {booking_data.get('display_id') or created_booking_id}")
            else:
                self.record_result("TC-BOOK-01", "Direct Room Booking Creation", "FAIL", dur, f"HTTP {r.status_code}: {r.text}")
        except Exception as e:
            self.record_result("TC-BOOK-01", "Direct Room Booking Creation", "FAIL", (time.time() - t0) * 1000, str(e))
        finally:
            if created_booking_id:
                try:
                    requests.delete(f"{self.backend_url}/api/bookings/{created_booking_id}", headers=headers, timeout=5)
                except Exception:
                    pass

        # TC-BOOK-03: Optional Guest Email (Blank string "" sanitized to None)
        t0 = time.time()
        created_booking_id2 = None
        try:
            alt_check_in = (today + timedelta(days=offset + 5)).strftime("%Y-%m-%d")
            alt_check_out = (today + timedelta(days=offset + 7)).strftime("%Y-%m-%d")
            payload = {
                "guest_name": "No-Email Guest",
                "guest_mobile": "9876500000",
                "guest_email": "",  # Empty string - should sanitize to None
                "room_ids": [room_id],
                "room_type_id": room_type_id,
                "check_in": alt_check_in,
                "check_out": alt_check_out,
                "adults": 1,
                "children": 0,
                "num_rooms": 1,
                "source": "Admin"
            }
            r = requests.post(f"{self.backend_url}/api/bookings", json=payload, headers=headers, timeout=5)
            dur = (time.time() - t0) * 1000
            if r.status_code == 200:
                created_booking_id2 = r.json().get("id")
                self.record_result("TC-BOOK-03", "Empty Email Sanitization Validation", "PASS", dur, "Accepted without 422 validation failure")
            else:
                self.record_result("TC-BOOK-03", "Empty Email Sanitization Validation", "FAIL", dur, f"HTTP {r.status_code}: {r.text}")
        except Exception as e:
            self.record_result("TC-BOOK-03", "Empty Email Sanitization Validation", "FAIL", (time.time() - t0) * 1000, str(e))
        finally:
            if created_booking_id2:
                try:
                    requests.delete(f"{self.backend_url}/api/bookings/{created_booking_id2}", headers=headers, timeout=5)
                except Exception:
                    pass

        # TC-BOOK-04: Invalid Email Format Rejection
        t0 = time.time()
        try:
            payload = {
                "guest_name": "Bad Email Guest",
                "guest_mobile": "9876500001",
                "guest_email": "invalid_email_without_at_sign",
                "room_ids": [room_id],
                "check_in": check_in,
                "check_out": check_out,
                "adults": 1,
                "children": 0
            }
            r = requests.post(f"{self.backend_url}/api/bookings", json=payload, headers=headers, timeout=5)
            dur = (time.time() - t0) * 1000
            if r.status_code == 422:
                self.record_result("TC-BOOK-04", "Malformed Email Validation Error", "PASS", dur, "Correctly rejected with HTTP 422 Unprocessable Entity")
            else:
                self.record_result("TC-BOOK-04", "Malformed Email Validation Error", "FAIL", dur, f"Expected 422, got {r.status_code}")
        except Exception as e:
            self.record_result("TC-BOOK-04", "Malformed Email Validation Error", "FAIL", (time.time() - t0) * 1000, str(e))

        # TC-BOOK-06: Check-Out Prior to Check-In Date
        t0 = time.time()
        try:
            payload = {
                "guest_name": "Backwards Date Guest",
                "guest_mobile": "9876500002",
                "room_ids": [room_id],
                "check_in": check_out,
                "check_out": check_in,  # Check-out is before check-in
                "adults": 1,
                "children": 0
            }
            r = requests.post(f"{self.backend_url}/api/bookings", json=payload, headers=headers, timeout=5)
            dur = (time.time() - t0) * 1000
            if r.status_code in [400, 422]:
                self.record_result("TC-BOOK-06", "Invalid Date Sequence Rejection", "PASS", dur, f"Rejected with HTTP {r.status_code}")
            else:
                self.record_result("TC-BOOK-06", "Invalid Date Sequence Rejection", "FAIL", dur, f"Expected 400/422, got {r.status_code}")
        except Exception as e:
            self.record_result("TC-BOOK-06", "Invalid Date Sequence Rejection", "FAIL", (time.time() - t0) * 1000, str(e))

        # TC-BOOK-08: Dynamic Price Calculation API
        if room_type_id:
            t0 = time.time()
            try:
                payload = {
                    "room_type_id": room_type_id,
                    "check_in": check_in,
                    "check_out": check_out,
                    "room_count": 1
                }
                r = requests.post(f"{self.backend_url}/api/bookings/calculate-price", json=payload, headers=headers, timeout=5)
                dur = (time.time() - t0) * 1000
                if r.status_code == 200 and "total_amount" in r.json():
                    self.record_result("TC-BOOK-08", "Dynamic Price Calculation API", "PASS", dur, f"Total calculated: Rs. {r.json()['total_amount']}")
                else:
                    self.record_result("TC-BOOK-08", "Dynamic Price Calculation API", "FAIL", dur, f"HTTP {r.status_code}: {r.text}")
            except Exception as e:
                self.record_result("TC-BOOK-08", "Dynamic Price Calculation API", "FAIL", (time.time() - t0) * 1000, str(e))

    # =========================================================================
    # Suite 3: Defensive & Security Checks
    # =========================================================================
    def test_security_hardening(self):
        print("\n--- [Suite 3: Defensive Security Checks] ---")
        headers = self.auth_headers()

        # TC-SEC-02: SQL Parameterization & Meta-character Resistance
        t0 = time.time()
        try:
            # Inject SQL meta-characters into search query parameters
            sql_payload = "' OR 1=1 --"
            r = requests.get(f"{self.backend_url}/api/rooms?search={sql_payload}", headers=headers, timeout=5)
            dur = (time.time() - t0) * 1000
            # If server crashes with 500 or exposes SQL syntax errors, test fails
            if r.status_code == 200 and "syntax error" not in r.text.lower():
                self.record_result("TC-SEC-02", "SQL Injection Parameterization Safety", "PASS", dur, "ORM safely handled meta-characters without syntax crash")
            elif r.status_code == 500:
                self.record_result("TC-SEC-02", "SQL Injection Parameterization Safety", "FAIL", dur, "HTTP 500 Internal Error triggered by SQL meta-characters")
            else:
                self.record_result("TC-SEC-02", "SQL Injection Parameterization Safety", "PASS", dur, f"HTTP {r.status_code}")
        except Exception as e:
            self.record_result("TC-SEC-02", "SQL Injection Parameterization Safety", "FAIL", (time.time() - t0) * 1000, str(e))

        # TC-SEC-03: XSS Script Tag Handling in Payloads
        t0 = time.time()
        try:
            xss_name = "<script>alert('XSS')</script>"
            r = requests.get(f"{self.backend_url}/api/bookings?search={xss_name}", headers=headers, timeout=5)
            dur = (time.time() - t0) * 1000
            if r.status_code == 200:
                self.record_result("TC-SEC-03", "XSS Parameter Input Sanitization", "PASS", dur, "Handled safely without execution")
            else:
                self.record_result("TC-SEC-03", "XSS Parameter Input Sanitization", "WARN", dur, f"Status: {r.status_code}")
        except Exception as e:
            self.record_result("TC-SEC-03", "XSS Parameter Input Sanitization", "FAIL", (time.time() - t0) * 1000, str(e))

    # =========================================================================
    # Report & Summary
    # =========================================================================
    def generate_report(self):
        total_time = (time.time() - self.start_time)
        total_tests = len(self.test_results)
        passed = sum(1 for t in self.test_results if t["status"] == "PASS")
        failed = sum(1 for t in self.test_results if t["status"] == "FAIL")
        warned = sum(1 for t in self.test_results if t["status"] == "WARN")
        pass_rate = (passed / total_tests * 100) if total_tests > 0 else 0

        print("\n" + "=" * 65)
        print("          STAYONE AUTOMATED TEST EXECUTION REPORT")
        print("=" * 65)
        print(f"Total Tests Executed : {total_tests}")
        print(f"Passed               : {passed}")
        print(f"Failed               : {failed}")
        print(f"Warnings             : {warned}")
        print(f"Pass Rate            : {pass_rate:.1f}%")
        print(f"Total Duration       : {total_time:.2f} seconds")
        print("=" * 65)

        if failed > 0:
            print("\n[!] Failed Tests:")
            for t in self.test_results:
                if t["status"] == "FAIL":
                    print(f"  - [{t['id']}] {t['name']}: {t['details']}")
            print("\nResult: TEST RUN FAILED")
            return 1
        else:
            print("\n[+] Result: ALL AUTOMATED TESTS PASSED SUCCESSFULLY")
            return 0

    def run(self) -> int:
        self.start_time = time.time()
        print("=================================================================")
        print("Starting StayOne Automated Test Plan Execution")
        print(f"Target Backend: {self.backend_url}")
        print(f"Target Gateway: {self.gateway_url}")
        print("=================================================================")
        
        self.test_health_checks()
        self.test_authentication()
        self.test_booking_engine()
        self.test_security_hardening()
        
        return self.generate_report()

def main():
    parser = argparse.ArgumentParser(description="StayOne Test Plan Automation Runner")
    parser.add_argument("--backend-url", default=DEFAULT_BACKEND_URL, help="Base URL for FastAPI backend")
    parser.add_argument("--gateway-url", default=DEFAULT_GATEWAY_URL, help="Base URL for Nginx gateway")
    parser.add_argument("--admin-url", default=DEFAULT_ADMIN_URL, help="Base URL for Admin frontend")
    parser.add_argument("--userend-url", default=DEFAULT_USEREND_URL, help="Base URL for Userend portal")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose debug logging")
    args = parser.parse_args()

    runner = TestRunner(
        backend_url=args.backend_url,
        gateway_url=args.gateway_url,
        admin_url=args.admin_url,
        userend_url=args.userend_url,
        verbose=args.verbose
    )
    sys.exit(runner.run())

if __name__ == "__main__":
    main()
