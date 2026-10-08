"""
StayOne Test Automation Framework - Single Consolidated Keyword Engine
Contains:
  1. YAML XPath Locator Registry (auto-loads tests/locators/*.yaml)
  2. Keywords class implementing every platform functionality
  3. Dynamic parameter substitution in XPaths
  4. Playwright validation engine with assertions and screenshots
  5. Step execution engine for running YAML-defined test scenarios
"""
import os
import time
from pathlib import Path
from typing import Dict, Any, Optional, List, Union
import yaml
from playwright.sync_api import Page, expect

from tests.config.settings import settings
from tests.core.logger import logger


class LocatorRegistry:
    """Loads all YAML files from tests/locators/ into a unified XPath dictionary."""
    def __init__(self, locators_dir: Optional[Path] = None):
        self.locators_dir = locators_dir or (Path(__file__).resolve().parent.parent / "locators")
        self.locators: Dict[str, str] = {}
        self.load_all()

    def load_all(self):
        """Scans and loads all .yaml files in the locators directory"""
        if not self.locators_dir.exists():
            logger.warning(f"Locators directory {self.locators_dir} does not exist!")
            return

        for yaml_file in self.locators_dir.glob("*.yaml"):
            prefix = yaml_file.stem
            try:
                with open(yaml_file, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f) or {}
                    for key, xpath in data.items():
                        # Qualified key (e.g., login.email_input)
                        self.locators[f"{prefix}.{key}"] = xpath
                        # Unqualified fallback if not conflicting
                        if key not in self.locators:
                            self.locators[key] = xpath
                logger.debug(f"Loaded XPath locators from: {yaml_file.name}")
            except Exception as e:
                logger.error(f"Failed to load locator file {yaml_file.name}: {e}")

    def get(self, key: str, **kwargs) -> str:
        """Retrieves and formats XPath by key with optional variable interpolation"""
        # If already a raw XPath string, format and return directly
        if key.startswith("//") or key.startswith("(") or key.startswith("xpath="):
            xpath = key.replace("xpath=", "")
            return xpath.format(**kwargs) if kwargs else xpath

        if key not in self.locators:
            available = list(self.locators.keys())[:10]
            raise KeyError(f"XPath locator '{key}' not found in YAML registry! Sample keys: {available}...")

        xpath = self.locators[key]
        return xpath.format(**kwargs) if kwargs else xpath


class Keywords:
    """
    SINGLE CONSOLIDATED KEYWORD ENGINE FOR STAYONE
    Implements all keywords across Auth, Dashboard, Bookings, Rooms, User Portal, and Verification.
    """
    def __init__(self, page: Page):
        self.page = page
        self.locators = LocatorRegistry()

    # =========================================================================
    # SECTION 1: CORE PLAYWRIGHT & XPATH ATOMIC ACTIONS
    # =========================================================================

    def click_xpath(self, locator_key: str, timeout: int = 10000, **kwargs):
        """Clicks an element identified by YAML locator key or raw XPath"""
        xpath = self.locators.get(locator_key, **kwargs)
        logger.info(f"[KEYWORD] CLICK_XPATH -> '{locator_key}' (xpath: {xpath})")
        self.page.locator(xpath).first.click(timeout=timeout)

    def fill_xpath(self, locator_key: str, text: str, timeout: int = 10000, **kwargs):
        """Fills an input identified by YAML locator key or raw XPath"""
        xpath = self.locators.get(locator_key, **kwargs)
        logger.info(f"[KEYWORD] FILL_XPATH -> '{locator_key}' with text: '{text}'")
        self.page.locator(xpath).first.fill(text, timeout=timeout)

    def verify_visible(self, locator_key: str, timeout: int = 10000, **kwargs):
        """Validates that an element is visible on the page"""
        xpath = self.locators.get(locator_key, **kwargs)
        logger.info(f"[KEYWORD] VERIFY_VISIBLE -> '{locator_key}'")
        expect(self.page.locator(xpath).first).to_be_visible(timeout=timeout)

    def verify_text_contains(self, locator_key: str, expected_text: str, timeout: int = 10000, **kwargs):
        """Validates that an element's inner text contains the expected substring"""
        xpath = self.locators.get(locator_key, **kwargs)
        logger.info(f"[KEYWORD] VERIFY_TEXT_CONTAINS -> '{locator_key}' expects '{expected_text}'")
        expect(self.page.locator(xpath).first).to_contain_text(expected_text, timeout=timeout)

    def verify_url_contains(self, substring: str, timeout: int = 10000):
        """Validates that the current page URL contains the substring"""
        logger.info(f"[KEYWORD] VERIFY_URL_CONTAINS -> '{substring}'")
        self.page.wait_for_url(lambda u: substring in u, timeout=timeout)

    def wait_seconds(self, seconds: float):
        """Pauses execution for a specified duration in seconds"""
        logger.info(f"[KEYWORD] WAIT_SECONDS -> {seconds}s")
        self.page.wait_for_timeout(int(seconds * 1000))

    def take_screenshot(self, name: str):
        """Captures a full-page screenshot to the reports directory"""
        ts = int(time.time() * 1000)
        filename = f"{name}_{ts}.png"
        filepath = settings.SCREENSHOTS_DIR / filename
        self.page.screenshot(path=str(filepath), full_page=True)
        logger.info(f"[KEYWORD] TAKE_SCREENSHOT -> {filepath}")
        return str(filepath)

    # =========================================================================
    # SECTION 2: AUTHENTICATION FUNCTIONALITY KEYWORDS
    # =========================================================================

    def open_admin_login(self):
        """Navigates to the Admin login page"""
        logger.info("[KEYWORD] OPEN_ADMIN_LOGIN")
        self.page.goto(f"{settings.ADMIN_URL}/stayoneadmin", wait_until="domcontentloaded")
        self.verify_visible("login.email_input")

    def login_as_admin(self, email: Optional[str] = None, password: Optional[str] = None):
        """Submits credentials and verifies successful login redirection"""
        email = email or settings.SUPERADMIN_EMAIL
        password = password or settings.SUPERADMIN_PASSWORD
        logger.info(f"[KEYWORD] LOGIN_AS_ADMIN -> {email}")
        self.fill_xpath("login.email_input", email)
        self.fill_xpath("login.password_input", password)
        self.click_xpath("login.submit_button")
        self.verify_url_contains("dashboard")

    def submit_invalid_login(self, email: str = "invalid@stayone.com", password: str = "WrongPass123!"):
        """Attempts login with invalid credentials"""
        logger.info(f"[KEYWORD] SUBMIT_INVALID_LOGIN -> {email}")
        self.fill_xpath("login.email_input", email)
        self.fill_xpath("login.password_input", password)
        self.click_xpath("login.submit_button")
        self.wait_seconds(1.0)

    def verify_login_error_displayed(self):
        """Validates that login was rejected and user remains on login screen"""
        logger.info("[KEYWORD] VERIFY_LOGIN_ERROR_DISPLAYED")
        assert "dashboard" not in self.page.url.lower(), "User should not be on dashboard after failed login"
        self.verify_visible("login.submit_button")

    def logout(self):
        """Clicks logout button and verifies return to login page"""
        logger.info("[KEYWORD] LOGOUT")
        self.click_xpath("dashboard.btn_logout")
        self.verify_visible("login.email_input")

    # =========================================================================
    # SECTION 3: NAVIGATION & DASHBOARD FUNCTIONALITY KEYWORDS
    # =========================================================================

    def navigate_to_module(self, module_name: str):
        """Navigates to a specific admin module using sidebar navigation"""
        logger.info(f"[KEYWORD] NAVIGATE_TO_MODULE -> '{module_name}'")
        mapping = {
            "dashboard": "dashboard.nav_dashboard",
            "superadmin": "dashboard.nav_superadmin_dashboard",
            "finance": "dashboard.nav_finance",
            "account": "dashboard.nav_finance",
            "bookings": "dashboard.nav_bookings",
            "services": "dashboard.nav_services",
            "expenses": "dashboard.nav_expenses",
            "food": "dashboard.nav_food_management",
            "billing": "dashboard.nav_billing",
            "website": "dashboard.nav_web_management",
            "reports": "dashboard.nav_reports",
            "guestprofiles": "dashboard.nav_guest_profiles",
            "employees": "dashboard.nav_employee_management",
            "inventory": "dashboard.nav_inventory",
            "dayaudit": "dashboard.nav_day_audit",
            "settings": "dashboard.nav_settings",
            "branches": "dashboard.nav_branch_management",
            "activitylogs": "dashboard.nav_activity_logs",
        }
        key = mapping.get(module_name.lower().replace(" ", "").replace("_", ""))
        if not key:
            raise ValueError(f"Unknown module '{module_name}'. Valid modules: {list(mapping.keys())}")
        self.click_xpath(key)

    def switch_branch(self, branch_name: str = "All Branches"):
        """Switches active branch context via the top-left branch selector"""
        logger.info(f"[KEYWORD] SWITCH_BRANCH -> '{branch_name}'")
        self.click_xpath("dashboard.branch_selector_dropdown")
        option_xpath = f"//button[contains(., '{branch_name}')]"
        self.click_xpath(option_xpath)

    # =========================================================================
    # SECTION 4: BOOKINGS FUNCTIONALITY KEYWORDS
    # =========================================================================

    def switch_to_bookings_tab(self):
        """Switches from Bookings Overview tab to Bookings Management table"""
        logger.info("[KEYWORD] SWITCH_TO_BOOKINGS_TAB")
        self.click_xpath("bookings.tab_bookings")
        self.verify_visible("bookings.heading_booking_operations")

    def open_create_booking_modal(self):
        """Opens the New Booking modal terminal"""
        logger.info("[KEYWORD] OPEN_CREATE_BOOKING_MODAL")
        self.switch_to_bookings_tab()
        self.click_xpath("bookings.btn_create_new_booking")
        self.verify_visible("bookings.modal_booking_terminal")

    def search_booking(self, query: str):
        """Enters a search string into the bookings filter search box"""
        logger.info(f"[KEYWORD] SEARCH_BOOKING -> '{query}'")
        self.fill_xpath("bookings.input_search_booking", query)

    def verify_booking_table_visible(self):
        """Verifies that the reservations table is visible"""
        logger.info("[KEYWORD] VERIFY_BOOKING_TABLE_VISIBLE")
        self.verify_visible("bookings.bookings_table")

    # =========================================================================
    # SECTION 5: ROOMS & INVENTORY FUNCTIONALITY KEYWORDS
    # =========================================================================

    def view_rooms_section(self):
        """Switches to Rooms tab in Bookings Dashboard"""
        logger.info("[KEYWORD] VIEW_ROOMS_SECTION")
        self.click_xpath("bookings.tab_rooms")
        self.verify_visible("rooms.rooms_section_heading")

    def verify_room_card_exists(self, room_number: Optional[str] = None):
        """Verifies that at least one room card or a specific room card is displayed"""
        logger.info(f"[KEYWORD] VERIFY_ROOM_CARD_EXISTS -> {room_number or 'any'}")
        if room_number:
            self.verify_visible("rooms.room_card_by_number", room_number=room_number)
        else:
            self.verify_visible("rooms.room_cards")

    # =========================================================================
    # SECTION 6: USER-END PUBLIC & GUEST ROOM PORTAL KEYWORDS
    # =========================================================================

    def open_user_portal(self):
        """Navigates to the public StayOne resort website"""
        logger.info("[KEYWORD] OPEN_USER_PORTAL")
        self.page.goto(settings.USEREND_URL, wait_until="domcontentloaded")
        self.verify_visible("user_portal.portal_hero_title")

    def open_guest_room_portal(self, room_id: int = 1):
        """Navigates to the in-room QR code guest portal route"""
        logger.info(f"[KEYWORD] OPEN_GUEST_ROOM_PORTAL -> Room {room_id}")
        self.page.goto(f"{settings.USEREND_URL}/#/room/{room_id}", wait_until="domcontentloaded")
        self.wait_seconds(1.5)

    def verify_guest_room_portal_status(self):
        """Verifies that the in-room portal displays either checked-in welcome or reception button"""
        logger.info("[KEYWORD] VERIFY_GUEST_ROOM_PORTAL_STATUS")
        welcome_xpath = self.locators.get("user_portal.guest_room_heading")
        reception_xpath = self.locators.get("user_portal.btn_call_reception")
        is_welcome = self.page.locator(welcome_xpath).is_visible()
        is_reception = self.page.locator(reception_xpath).is_visible()
        assert is_welcome or is_reception, "Guest Room Portal did not display welcome heading or reception button"

    # =========================================================================
    # SECTION 7: GENERIC STEP SCENARIO EXECUTOR
    # =========================================================================

    def execute_step(self, step: Dict[str, Any]):
        """Executes a single step dictionary: {'keyword': ..., 'args': [...], 'kwargs': {...}}"""
        kw_name = step.get("keyword") or step.get("action")
        if not kw_name:
            raise ValueError(f"Step missing 'keyword' or 'action': {step}")

        # Normalize keyword name (e.g., 'LOGIN_AS_ADMIN' -> 'login_as_admin')
        method_name = kw_name.lower().strip()
        if not hasattr(self, method_name):
            raise AttributeError(f"Keywords engine does not have keyword method: '{method_name}'")

        method = getattr(self, method_name)
        args = step.get("args", [])
        kwargs = step.get("kwargs", {})

        logger.info(f"===> EXECUTING STEP: {kw_name} (args: {args}, kwargs: {kwargs})")
        return method(*args, **kwargs)

    def execute_scenario(self, scenario_yaml_path: Union[str, Path]):
        """Executes all steps defined in a YAML scenario file"""
        path = Path(scenario_yaml_path)
        logger.info(f"[KEYWORD ENGINE] Executing scenario file: {path.name}")
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        steps = data.get("steps", [])
        for idx, step in enumerate(steps, 1):
            logger.info(f"--- Step {idx}/{len(steps)}: {step.get('keyword', step.get('name'))} ---")
            self.execute_step(step)
        logger.info(f"[KEYWORD ENGINE] Scenario '{data.get('name', path.stem)}' completed successfully!")
