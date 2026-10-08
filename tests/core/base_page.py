"""
StayOne Test Framework - Base Page Object Model (POM)
Encapsulates common browser interactions using Playwright.
"""
import time
from pathlib import Path
from typing import Optional, Any
from playwright.sync_api import Page, Locator, expect

from tests.config.settings import settings
from tests.core.logger import logger

class BasePage:
    """Base class for all Page Object Models"""
    def __init__(self, page: Page, base_url: Optional[str] = None):
        self.page = page
        self.base_url = (base_url or settings.ADMIN_URL).rstrip("/")
        self.default_timeout = settings.DEFAULT_TIMEOUT

    def navigate(self, path: str = "") -> "BasePage":
        url = path if path.startswith("http") else f"{self.base_url}/{path.lstrip('/')}"
        logger.debug(f"Navigating to {url}")
        self.page.goto(url, timeout=self.default_timeout, wait_until="domcontentloaded")
        return self

    def locator(self, selector: str) -> Locator:
        return self.page.locator(selector)

    def wait_for_selector(self, selector: str, state: str = "visible", timeout: Optional[int] = None) -> Locator:
        loc = self.locator(selector)
        loc.first.wait_for(state=state, timeout=timeout or self.default_timeout)
        return loc

    def click(self, selector: str, timeout: Optional[int] = None) -> "BasePage":
        logger.debug(f"Clicking: {selector}")
        self.locator(selector).first.click(timeout=timeout or self.default_timeout)
        return self

    def fill(self, selector: str, text: str, timeout: Optional[int] = None) -> "BasePage":
        logger.debug(f"Filling '{selector}' with: {text}")
        loc = self.locator(selector).first
        loc.fill(text, timeout=timeout or self.default_timeout)
        return self

    def get_text(self, selector: str, timeout: Optional[int] = None) -> str:
        return self.locator(selector).first.inner_text(timeout=timeout or self.default_timeout).strip()

    def is_visible(self, selector: str, timeout: int = 3000) -> bool:
        try:
            return self.locator(selector).first.is_visible(timeout=timeout)
        except Exception:
            return False

    def wait_for_url_contains(self, substring: str, timeout: Optional[int] = None):
        self.page.wait_for_url(lambda u: substring in u, timeout=timeout or self.default_timeout)

    def wait_for_network_idle(self, timeout: Optional[int] = None):
        self.page.wait_for_load_state("networkidle", timeout=timeout or self.default_timeout)

    def take_screenshot(self, name: Optional[str] = None) -> str:
        ts = int(time.time() * 1000)
        filename = f"{name or 'screenshot'}_{ts}.png"
        filepath = settings.SCREENSHOTS_DIR / filename
        self.page.screenshot(path=str(filepath), full_page=True)
        logger.info(f"Screenshot saved to {filepath}")
        return str(filepath)

    def get_title(self) -> str:
        return self.page.title()

    def get_current_url(self) -> str:
        return self.page.url

    def set_local_storage(self, key: str, value: str):
        self.page.evaluate(f"window.localStorage.setItem({repr(key)}, {repr(value)});")

    def get_local_storage(self, key: str) -> Any:
        return self.page.evaluate(f"window.localStorage.getItem({repr(key)});")
