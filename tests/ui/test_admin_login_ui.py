"""
UI Test Suite: Admin Login Workflows (Playwright)
"""
import pytest
from playwright.sync_api import Page
from tests.config.settings import settings
from tests.pages.admin_login_page import AdminLoginPage

@pytest.mark.ui
@pytest.mark.smoke
class TestAdminLoginUI:
    def test_login_page_renders_elements(self, page: Page):
        """Verify Admin login page renders branding, input fields and submit button"""
        login_page = AdminLoginPage(page)
        login_page.load()
        assert login_page.is_login_page_loaded(), "Login inputs are not visible"
        assert login_page.is_visible(login_page.SUBMIT_BUTTON), "Submit button is missing"

    def test_invalid_credentials_triggers_dialog(self, page: Page):
        """Verify invalid login triggers an error alert or prevents dashboard entry"""
        login_page = AdminLoginPage(page)
        login_page.load()
        login_page.login("wrong@stayone.com", "InvalidPassword123")
        page.wait_for_timeout(1500)
        
        # Verify user is not redirected to dashboard and stays on login/portal
        assert "dashboard" not in page.url.lower(), f"Unexpected dashboard access after failed login: {page.url}"
        assert login_page.is_login_page_loaded(), "Login form should still be displayed after failed login"

    def test_successful_superadmin_login(self, page: Page):
        """Verify Super Admin credentials log in successfully and redirect to dashboard"""
        login_page = AdminLoginPage(page)
        login_page.load()
        login_page.login(settings.SUPERADMIN_EMAIL, settings.SUPERADMIN_PASSWORD)
        
        # Wait for redirection to dashboard or superadmin-dashboard
        page.wait_for_url(lambda u: "dashboard" in u or "superadmin" in u, timeout=10000)
        assert "dashboard" in page.url or "superadmin" in page.url
        assert page.locator("nav").is_visible(timeout=5000), "Sidebar navigation did not render after login"
