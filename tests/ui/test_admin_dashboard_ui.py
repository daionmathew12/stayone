"""
UI Test Suite: Admin Dashboard Navigation & Branch Switching (Playwright)
"""
import pytest
from playwright.sync_api import Page
from tests.config.settings import settings
from tests.pages.admin_login_page import AdminLoginPage
from tests.pages.admin_dashboard_page import AdminDashboardPage

@pytest.mark.ui
class TestAdminDashboardUI:
    @pytest.fixture(autouse=True)
    def setup_authenticated_session(self, page: Page):
        """Pre-login as Super Admin before running dashboard tests"""
        login_page = AdminLoginPage(page)
        login_page.load()
        login_page.login(settings.SUPERADMIN_EMAIL, settings.SUPERADMIN_PASSWORD)
        page.wait_for_url(lambda u: "dashboard" in u or "superadmin" in u, timeout=10000)

    def test_dashboard_sidebar_rendered(self, page: Page):
        """Verify dashboard sidebar and primary modules are displayed"""
        dashboard_page = AdminDashboardPage(page)
        assert dashboard_page.is_dashboard_loaded(), "Dashboard sidebar failed to render"

    def test_navigation_to_bookings_page(self, page: Page):
        """Verify clicking Bookings link in sidebar navigates to /bookings"""
        dashboard_page = AdminDashboardPage(page)
        dashboard_page.navigate_to_bookings()
        assert "bookings" in page.url.lower(), f"Expected bookings URL, got {page.url}"

    def test_navigation_to_finance_page(self, page: Page):
        """Verify clicking Finance link in sidebar navigates to /account"""
        dashboard_page = AdminDashboardPage(page)
        dashboard_page.navigate_to_finance()
        assert "account" in page.url.lower(), f"Expected account URL, got {page.url}"
