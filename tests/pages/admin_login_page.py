"""
Page Object Model for StayOne Admin Login Page
"""
from typing import Optional
from playwright.sync_api import Page, Dialog
from tests.config.settings import settings
from tests.core.base_page import BasePage

class AdminLoginPage(BasePage):
    # Locators
    EMAIL_INPUT = "input[type='text'], input[placeholder*='@stayone.com']"
    PASSWORD_INPUT = "input[type='password']"
    SUBMIT_BUTTON = "button[type='submit']"
    REMEMBER_ME_CHECKBOX = "input#remember-me"
    REGISTER_LINK = "a[href*='register']"
    WELCOME_HEADING = "h1"

    def __init__(self, page: Page):
        super().__init__(page, base_url=settings.ADMIN_URL)
        self.last_dialog_message: Optional[str] = None

        # Setup dialog handler to catch alert() popups
        def handle_dialog(dialog: Dialog):
            self.last_dialog_message = dialog.message
            dialog.accept()

        self.page.on("dialog", handle_dialog)

    def load(self) -> "AdminLoginPage":
        self.navigate("")
        self.wait_for_selector(self.EMAIL_INPUT)
        return self

    def login(self, email: str, password: str) -> "AdminLoginPage":
        self.fill(self.EMAIL_INPUT, email)
        self.fill(self.PASSWORD_INPUT, password)
        self.click(self.SUBMIT_BUTTON)
        return self

    def is_login_page_loaded(self) -> bool:
        return self.is_visible(self.EMAIL_INPUT) and self.is_visible(self.PASSWORD_INPUT)

    def get_dialog_error(self) -> Optional[str]:
        return self.last_dialog_message
