"""
Page Object Model for StayOne Admin Bookings Page
"""
from typing import Optional, List
from playwright.sync_api import Page
from tests.config.settings import settings
from tests.core.base_page import BasePage

class AdminBookingsPage(BasePage):
    # Locators
    PAGE_HEADING = "text=Booking Management Dashboard"
    BOOKINGS_TAB_BUTTON = "button:has-text('Bookings')"
    CREATE_BOOKING_BUTTON = "button:has-text('Create New Booking')"
    SEARCH_INPUT = "input[placeholder*='Search']"
    BOOKINGS_TABLE = "table"
    BOOKING_ROWS = "table tbody tr"

    def __init__(self, page: Page):
        super().__init__(page, base_url=settings.ADMIN_URL)

    def load(self) -> "AdminBookingsPage":
        self.navigate("bookings")
        self.wait_for_selector(self.PAGE_HEADING)
        return self

    def is_loaded(self) -> bool:
        return self.is_visible(self.PAGE_HEADING)

    def switch_to_bookings_tab(self) -> "AdminBookingsPage":
        self.click(self.BOOKINGS_TAB_BUTTON)
        self.wait_for_selector("text=Booking Operations")
        return self

    def open_create_modal(self) -> "AdminBookingsPage":
        self.switch_to_bookings_tab()
        self.click(self.CREATE_BOOKING_BUTTON)
        return self

    def search_bookings(self, query: str) -> "AdminBookingsPage":
        if self.is_visible(self.SEARCH_INPUT):
            self.fill(self.SEARCH_INPUT, query)
        return self

    def get_booking_rows_count(self) -> int:
        return self.locator(self.BOOKING_ROWS).count()
