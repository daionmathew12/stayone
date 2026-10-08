# StayOne Enterprise Test Automation Framework (API & UI)

A unified, modular test automation framework designed for the **StayOne Hospitality Platform**, supporting both **API test automation** (REST, Schema, Auth, Database Cleanup) and **UI test automation** (Playwright, Page Object Model, Headless/Headed, Automatic Failure Screenshots).

---

## 🏗️ Architecture & Directory Layout

```text
d:\stayone\
├── pytest.ini                     # Pytest configuration (markers, test paths, CLI flags)
└── tests\
    ├── conftest.py                # Global fixtures (API client, Playwright browser, screenshot on failure)
    ├── run_tests.py               # Master CLI test runner tool
    │
    ├── config\                    # Centralized Environment Configuration
    │   ├── __init__.py
    │   └── settings.py            # Endpoints, credentials, timeouts, browser flags
    │
    ├── core\                      # Reusable Automation Engines
    │   ├── __init__.py
    │   ├── api_client.py          # Session-managed API client with auto-token auth & timing
    │   ├── base_page.py           # Playwright Base Page Object Model (POM) wrapper
    │   ├── data_factory.py        # Dynamic, randomized test fixture generators
    │   └── logger.py              # Centralized logging engine
    │
    ├── pages\                     # Page Object Models (UI Layer)
    │   ├── __init__.py
    │   ├── admin_login_page.py    # Admin authentication interactions & error dialogs
    │   ├── admin_dashboard_page.py# Sidebar navigation, KPI cards, branch switching
    │   ├── admin_bookings_page.py # Bookings table, tab controls, create booking modal
    │   └── user_portal_page.py    # Public luxury website & QR-accessible Guest Room Portal
    │
    ├── api\                       # API Test Suites
    │   ├── __init__.py
    │   ├── test_auth_api.py       # Authentication, JWT verification, invalid credentials
    │   ├── test_rooms_api.py      # Rooms list, search, room types, access restrictions
    │   ├── test_bookings_api.py   # Booking creation lifecycle, search, cleanup, validation
    │   └── test_security_api.py   # SQL injection guards, XSS handling, sensitive file audit
    │
    ├── ui\                        # UI Test Suites (Playwright)
    │   ├── __init__.py
    │   ├── test_admin_login_ui.py # Admin login flow, error dialogs, superadmin redirect
    │   ├── test_admin_dashboard_ui.py # Dashboard sidebar rendering & multi-page navigation
    │   ├── test_admin_bookings_ui.py  # Bookings operations dashboard & create modal
    │   └── test_user_portal_ui.py     # Public portal branding & in-room QR service page
    │
    └── reports\                   # Automated Test Reports & Evidence
        ├── stayone_test_report.html   # Self-contained HTML execution report
        ├── test_run.log               # Detailed log file
        └── screenshots\               # Automatic failure screenshots
```

---

## 🚀 Quick Start & CLI Execution

The framework includes a high-level CLI runner (`tests/run_tests.py`) and direct `pytest` support.

### 1. Run All Tests (API + UI)
```powershell
python tests/run_tests.py --all
```

### 2. Run Only API Tests
```powershell
python tests/run_tests.py --api
```

### 3. Run Only UI Tests (Playwright)
```powershell
# Headless mode (fast execution):
python tests/run_tests.py --ui

# Headed mode (visible browser window):
python tests/run_tests.py --ui --headed
```

### 4. Run Smoke Suite Only
```powershell
python tests/run_tests.py --smoke
```

### 5. Run Security Hardening Suite Only
```powershell
python tests/run_tests.py --security
```

### 6. Filter by Keyword
```powershell
python tests/run_tests.py -k "login"
```

---

## 📊 Test Reporting & Screenshots

- **HTML Report**: Automatically saved to `tests/reports/stayone_test_report.html`.
- **Automatic Failure Screenshots**: If any UI test fails, the framework automatically captures a full-page screenshot and saves it to `tests/reports/screenshots/FAILURE_<test_name>.png`.
- **Execution Logs**: Detailed logs saved to `tests/reports/test_run.log`.

---

## 🛠️ Adding New Tests

### Adding a New API Test
Create or edit a test file under `tests/api/`:
```python
import pytest
from tests.core.api_client import APIClient

@pytest.mark.api
def test_example_endpoint(auth_api_client: APIClient):
    resp = auth_api_client.get("/api/expenses")
    resp.assert_status(200)
    data = resp.json()
    assert isinstance(data, list)
```

### Adding a New UI Test (Page Object Model)
1. Define a Page Object in `tests/pages/`:
```python
from tests.core.base_page import BasePage

class SettingsPage(BasePage):
    HEADING = "h1:has-text('Settings')"

    def load(self):
        self.navigate("settings")
        self.wait_for_selector(self.HEADING)
```
2. Write the test in `tests/ui/`:
```python
import pytest
from playwright.sync_api import Page
from tests.pages.admin_login_page import AdminLoginPage
from tests.config.settings import settings

@pytest.mark.ui
def test_settings_view(page: Page):
    login = AdminLoginPage(page)
    login.load().login(settings.SUPERADMIN_EMAIL, settings.SUPERADMIN_PASSWORD)
    page.wait_for_url(lambda u: "dashboard" in u or "superadmin" in u)
    page.goto(f"{settings.ADMIN_URL}/settings")
    assert page.is_visible("text=Settings")
```
