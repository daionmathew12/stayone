"""
StayOne Unified Test Suite Runner
==================================
Discovers and executes all test suites in the tests/ directory.
Produces a structured summary report with timing and pass/fail metrics.
"""
import sys
import os
import time
import argparse

# Add tests directory to path
sys.path.insert(0, os.path.dirname(__file__))
from conftest import BACKEND_URL, GATEWAY_URL, ADMIN_URL, USEREND_URL

import test_system_health
import test_auth
import test_bookings
import test_security

class MasterTestRunner:
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.results = []
        self.start_time = 0

    def run_suite(self, suite_name: str, tests: list):
        print(f"\n--- [{suite_name}] ---")
        for test_id, name, func in tests:
            t0 = time.time()
            try:
                dur, details = func()
                status = "PASS" if not details.startswith("WARNING") else "WARN"
                self.results.append({"id": test_id, "name": name, "status": status, "duration": dur, "details": details})
                status_icon = "[PASS]" if status == "PASS" else "[WARN]"
                print(f" {status_icon} {test_id}: {name} ({dur:.1f}ms)")
                if details and (self.verbose or status != "PASS"):
                    print(f"        -> {details}")
            except Exception as e:
                dur = (time.time() - t0) * 1000
                self.results.append({"id": test_id, "name": name, "status": "FAIL", "duration": dur, "details": str(e)})
                print(f" [FAIL] {test_id}: {name} ({dur:.1f}ms)")
                print(f"        -> {e}")

    def generate_report(self) -> int:
        total_time = time.time() - self.start_time
        total_tests = len(self.results)
        passed = sum(1 for t in self.results if t["status"] == "PASS")
        failed = sum(1 for t in self.results if t["status"] == "FAIL")
        warned = sum(1 for t in self.results if t["status"] == "WARN")
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
            for t in self.results:
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
        print("StayOne Automated Test Suite Execution")
        print(f"Backend Target: {BACKEND_URL}")
        print(f"Gateway Target: {GATEWAY_URL}")
        print("=================================================================")

        # Suite 0: System Health
        self.run_suite("Suite 0: Infrastructure & Gateway Health", [
            ("TC-SYS-01", "FastAPI Backend Health Endpoint", test_system_health.test_backend_health),
            ("TC-SYS-02", "React Admin Dashboard Accessible", test_system_health.test_admin_dashboard_accessible),
            ("TC-SYS-03", "React User-End Portal Accessible", test_system_health.test_userend_portal_accessible),
            ("TC-SYS-04", "Unified Nginx Gateway Accessible", test_system_health.test_gateway_accessible),
        ])

        # Suite 1: Authentication
        self.run_suite("Suite 1: Authentication & Authorization", [
            ("TC-AUTH-01", "Super Admin Valid Login", test_auth.test_superadmin_login),
            ("TC-AUTH-02", "Invalid Password Rejection", test_auth.test_invalid_password_rejection),
            ("TC-AUTH-05", "Unauthenticated Request Rejection", test_auth.test_unauthenticated_request_blocked),
        ])

        # Suite 2: Booking Engine
        self.run_suite("Suite 2: Booking Engine & Schema Validation", [
            ("TC-BOOK-01", "Direct Physical Room Booking Creation", test_bookings.test_direct_booking_and_cleanup),
            ("TC-BOOK-03", "Empty Email Sanitization Validation", test_bookings.test_empty_email_sanitization),
            ("TC-BOOK-04", "Malformed Email Validation Error", test_bookings.test_malformed_email_rejection),
            ("TC-BOOK-06", "Invalid Date Sequence Rejection", test_bookings.test_invalid_date_range_rejection),
        ])

        # Suite 3: Security Hardening
        self.run_suite("Suite 3: Defensive Security Checks", [
            ("TC-SEC-01", "Repository Secret & Private Key Audit", test_security.test_repo_private_key_audit),
            ("TC-SEC-02", "SQL Injection Parameterization Safety", test_security.test_sql_parameterization_safety),
            ("TC-SEC-03", "XSS Parameter Input Sanitization", test_security.test_xss_parameter_handling),
        ])

        return self.generate_report()

def main():
    parser = argparse.ArgumentParser(description="StayOne Master Test Runner")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose debug output")
    args = parser.parse_args()

    runner = MasterTestRunner(verbose=args.verbose)
    sys.exit(runner.run())

if __name__ == "__main__":
    main()
