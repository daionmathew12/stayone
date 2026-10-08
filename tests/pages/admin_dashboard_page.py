"""
Page Object Model for StayOne Admin Dashboard
"""
from typing import Optional
from playwright.sync_api import Page
from tests.config.settings import settings
from tests.core.base_page import BasePage

class AdminDashboardPage(BasePage):
    # Locators
    SIDEBAR_NAV = "nav"
    BOOKINGS_LINK = "nav a[href*='bookings']"
    FINANCE_LINK = "nav a[href*='account']"
    SETTINGS_LINK = "nav a[href*='settings']"
    BRANCHES_LINK = "nav a[href*='branch-management']"
    LOGOUT_LINK = "a:has-text('Log Out')"

    def __init__(self, page: Page):
        super().__init__(page, base_url=settings.ADMIN_URL)

    def load(self) -> "AdminDashboardPage":
        self.navigate("superadmin-dashboard")
        self.wait_for_selector(self.SIDEBAR_NAV)
        return self

    def is_dashboard_loaded(self) -> bool:
        return self.is_visible(self.SIDEBAR_NAV)

    def navigate_to_bookings(self):
        self.click(self.BOOKINGS_LINK)
        self.wait_for_url_contains("bookings")

    def navigate_to_finance(self):
        self.click(self.FINANCE_LINK)
        self.wait_for_url_contains("account")

    def navigate_to_settings(self):
        self.click(self.SETTINGS_LINK)
        self.wait_for_url_contains("settings")

    def logout(self):
        self.click(self.LOGOUT_LINK)
        self.wait_for_url_contains("login")
