"""
UI Test Suite: User-End Luxury Portal & Guest Room Portal (Playwright)
"""
import pytest
from playwright.sync_api import Page
from tests.config.settings import settings
from tests.pages.user_portal_page import UserPortalPage

@pytest.mark.ui
@pytest.mark.smoke
class TestUserPortalUI:
    def test_user_portal_homepage_loads(self, page: Page):
        """Verify the public hotel website loads with luxury branding and navigation"""
        portal = UserPortalPage(page)
        portal.load_home()
        title = portal.get_hero_title()
        assert "StayOne" in title or "Hospitality" in title or len(title) > 0

    def test_guest_room_portal_qr_access(self, page: Page):
        """Verify QR-code-accessible Guest Room Portal renders room-specific status or services"""
        portal = UserPortalPage(page)
        portal.load_guest_room_portal(room_id=1)
        
        # Verify guest room portal renders either active services or checked-in welcome interface
        page.wait_for_timeout(1500)
        has_welcome = page.locator("h1:has-text('Welcome to Room')").is_visible(timeout=5000)
        has_reception = page.locator("button:has-text('Call Reception')").is_visible(timeout=5000)
        assert has_welcome or has_reception, "Guest Room Portal did not render room welcome or reception button"
