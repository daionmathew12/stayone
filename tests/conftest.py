"""
StayOne Test Automation Framework - Pytest Global Fixtures & Hooks
Supports API client sessions, Playwright browser lifecycles, and auto-screenshot on failure.
"""
import os
import sys
import time
from pathlib import Path
from typing import Generator
import pytest
from playwright.sync_api import sync_playwright, Browser, BrowserContext, Page

# Add tests directory to python path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from tests.config.settings import settings
from tests.core.api_client import APIClient
from tests.core.logger import logger

# Backward-compatible global exports for legacy scripts
BACKEND_URL = settings.BACKEND_URL
GATEWAY_URL = settings.GATEWAY_URL
ADMIN_URL = settings.ADMIN_URL
USEREND_URL = settings.USEREND_URL
SUPERADMIN_EMAIL = settings.SUPERADMIN_EMAIL
SUPERADMIN_PASSWORD = settings.SUPERADMIN_PASSWORD


# --- CLI Options & Configuration ---
def pytest_addoption(parser):
    parser.addoption(
        "--headed",
        action="store_true",
        default=False,
        help="Run UI tests in headed browser mode (visible window)"
    )
    parser.addoption(
        "--browser-type",
        action="store",
        default="chromium",
        help="Browser type: chromium, firefox, webkit"
    )


# --- API Fixtures ---
@pytest.fixture(scope="session")
def api_client() -> Generator[APIClient, None, None]:
    """Provides a fresh API client instance pointing to backend service"""
    client = APIClient(base_url=settings.BACKEND_URL)
    yield client


@pytest.fixture(scope="session")
def auth_api_client() -> Generator[APIClient, None, None]:
    """Provides an authenticated API client with Super Admin credentials"""
    client = APIClient(base_url=settings.BACKEND_URL)
    client.authenticate(
        email=settings.SUPERADMIN_EMAIL,
        password=settings.SUPERADMIN_PASSWORD
    )
    yield client


# --- Playwright UI Fixtures ---
@pytest.fixture(scope="session")
def browser_instance(request) -> Generator[Browser, None, None]:
    """Launches Playwright browser instance for the test session"""
    is_headed = request.config.getoption("--headed") or not settings.HEADLESS
    browser_type_name = request.config.getoption("--browser-type") or settings.BROWSER_TYPE

    with sync_playwright() as p:
        browser_launcher = getattr(p, browser_type_name, p.chromium)
        browser = browser_launcher.launch(
            headless=not is_headed,
            slow_mo=settings.SLOW_MO
        )
        logger.info(f"Launched {browser_type_name.upper()} browser (headless={not is_headed})")
        yield browser
        browser.close()


@pytest.fixture(scope="function")
def context(browser_instance: Browser) -> Generator[BrowserContext, None, None]:
    """Creates an isolated browser context per test with standard viewport"""
    ctx = browser_instance.new_context(
        viewport={"width": settings.VIEWPORT_WIDTH, "height": settings.VIEWPORT_HEIGHT},
        ignore_https_errors=True
    )
    yield ctx
    ctx.close()


@pytest.fixture(scope="function")
def page(context: BrowserContext, request) -> Generator[Page, None, None]:
    """Provides a fresh browser Page with auto-screenshot on test failure"""
    page_instance = context.new_page()
    page_instance.set_default_timeout(settings.DEFAULT_TIMEOUT)

    yield page_instance

    # Auto screenshot on failure
    if hasattr(request.node, "rep_call") and request.node.rep_call.failed:
        test_name = request.node.name.replace("[", "_").replace("]", "_")
        screenshot_path = settings.SCREENSHOTS_DIR / f"FAILURE_{test_name}.png"
        try:
            page_instance.screenshot(path=str(screenshot_path), full_page=True)
            logger.error(f"Captured failure screenshot: {screenshot_path}")
        except Exception as e:
            logger.warning(f"Could not take failure screenshot: {e}")

    page_instance.close()


# --- Pytest Hook for Test Failure Detection ---
@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    setattr(item, f"rep_{rep.when}", rep)
