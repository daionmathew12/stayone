"""
UI Test Suite: Bookings Management Interface (Playwright)
"""
import pytest
from playwright.sync_api import Page
from tests.config.settings import settings
from tests.pages.admin_login_page import AdminLoginPage
from tests.pages.admin_bookings_page import AdminBookingsPage

@pytest.mark.ui
@pytest.mark.smoke
class TestAdminBookingsUI:
    @pytest.fixture(autouse=True)
    def setup_authenticated_session(self, page: Page):
        """Pre-login and navigate directly to bookings"""
        login_page = AdminLoginPage(page)
        login_page.load()
        login_page.login(settings.SUPERADMIN_EMAIL, settings.SUPERADMIN_PASSWORD)
        page.wait_for_url(lambda u: "dashboard" in u or "superadmin" in u, timeout=10000)
        
        # Navigate to bookings via sidebar link
        page.click("nav a[href*='bookings']")
        page.wait_for_selector("text=Booking Management Dashboard", timeout=10000)

    def test_bookings_page_loads_and_displays_operations(self, page: Page):
        """Verify Bookings dashboard loads with overview and tabs"""
        bookings_page = AdminBookingsPage(page)
        assert bookings_page.is_loaded(), "Bookings dashboard failed to load"

    def test_open_create_booking_modal(self, page: Page):
        """Verify switching to Bookings tab and clicking 'Create New Booking' opens modal"""
        bookings_page = AdminBookingsPage(page)
        bookings_page.open_create_modal()
        page.wait_for_timeout(1000)
        
        # Verify modal or booking terminal container is visible
        modal_visible = page.locator("text=New Booking Terminal").first.is_visible(timeout=5000)
        assert modal_visible, "Create booking modal did not open"
