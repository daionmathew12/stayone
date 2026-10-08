"""
Page Object Model for StayOne User-End Public Portal & Guest Room Portal
"""
from typing import Optional
from playwright.sync_api import Page
from tests.config.settings import settings
from tests.core.base_page import BasePage

class UserPortalPage(BasePage):
    # Locators
    BRANDING_LOGO = "img[alt*='Logo'], img[alt*='Stayone']"
    HERO_SECTION = "section"
    THEME_BUTTONS = "button[title], button[aria-label*='theme']"
    ROOM_CARDS = ".luxury-card, div:has-text('Room'), div:has-text('Villa')"
    GUEST_PORTAL_SERVICES = "div:has-text('Room Service'), div:has-text('Housekeeping')"

    def __init__(self, page: Page):
        super().__init__(page, base_url=settings.USEREND_URL)

    def load_home(self) -> "UserPortalPage":
        self.navigate("")
        self.wait_for_selector(self.HERO_SECTION)
        return self

    def load_guest_room_portal(self, room_id: int = 1) -> "UserPortalPage":
        self.navigate(f"#/room/{room_id}")
        return self

    def get_hero_title(self) -> str:
        return self.get_title()

    def get_room_cards_count(self) -> int:
        return self.locator(self.ROOM_CARDS).count()
