"""
StayOne Test Automation Framework - Master CLI Test Runner
Usage:
    python tests/run_tests.py --all
    python tests/run_tests.py --api
    python tests/run_tests.py --ui
    python tests/run_tests.py --smoke
    python tests/run_tests.py --security
    python tests/run_tests.py --headed
    python tests/run_tests.py --html
"""
import sys
import os
import argparse
import subprocess
import time
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from tests.config.settings import settings

def print_banner():
    print("""
===================================================================
       STAYONE ENTERPRISE TEST AUTOMATION FRAMEWORK
                API & UI (Playwright) Runner
===================================================================
""")

def main():
    print_banner()

    parser = argparse.ArgumentParser(description="StayOne Test Framework CLI Runner")
    parser.add_argument("--all", action="store_true", help="Execute both API and UI test suites")
    parser.add_argument("--api", action="store_true", help="Execute API test suites only")
    parser.add_argument("--ui", action="store_true", help="Execute UI test suites only")
    parser.add_argument("--keywords", action="store_true", help="Execute Keyword-Driven test suite only")
    parser.add_argument("--smoke", action="store_true", help="Execute smoke tests only")
    parser.add_argument("--security", action="store_true", help="Execute security tests only")
    parser.add_argument("--headed", action="store_true", help="Run browser in headed mode (UI visible)")
    parser.add_argument("--html", action="store_true", default=True, help="Generate HTML test report (default: True)")
    parser.add_argument("-k", "--keyword", type=str, help="Only run tests matching expression")

    args = parser.parse_args()

    # Determine pytest arguments
    cmd = [sys.executable, "-m", "pytest"]

    # Target selection
    if args.api and not args.ui:
    if args.keywords:
        cmd.extend(["tests/test_keywords_suite.py"])
        print("[*] Target: Keyword-Driven Suite (Single File Engine + YAML XPaths)")
    elif args.api and not args.ui:
        cmd.extend(["-m", "api"])
        print("[*] Target: API Suites Only")
    elif args.ui and not args.api:
        cmd.extend(["-m", "ui"])
        print("[*] Target: UI Suites Only (Playwright)")
    elif args.smoke:
        cmd.extend(["-m", "smoke"])
        print("[*] Target: Smoke Test Suite")

    elif args.security:
        cmd.extend(["-m", "security"])
        print("[*] Target: Defensive Security Suite")
    else:
        print("[*] Target: Full Regression (API + UI)")

    # Headed flag
    if args.headed:
        cmd.append("--headed")
        print("[*] Browser Mode: HEADED (Visible)")
    else:
        print("[*] Browser Mode: HEADLESS (Fast / CI)")

    # Keyword filter
    if args.keyword:
        cmd.extend(["-k", args.keyword])

    # HTML Report
    if args.html:
        report_file = settings.REPORTS_DIR / "stayone_test_report.html"
        cmd.extend([f"--html={report_file}", "--self-contained-html"])
        print(f"[*] Report: HTML report enabled -> {report_file}")

    print("-" * 67)
    t0 = time.time()
    
    # Execute pytest subprocess
    res = subprocess.run(cmd, cwd=str(PROJECT_ROOT))
    duration = time.time() - t0

    print("-" * 67)
    print(f"Test Run Finished in {duration:.2f} seconds.")
    if args.html:
        report_path = (settings.REPORTS_DIR / 'stayone_test_report.html').resolve()
        print(f"HTML Report generated at: file:///{report_path.as_posix()}")
    print("=" * 67)

    sys.exit(res.returncode)

if __name__ == "__main__":
    main()
