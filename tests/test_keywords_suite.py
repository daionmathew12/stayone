"""
Keyword-Driven Test Suite for StayOne Platform
Validates platform functionalities via the single unified Keywords engine with YAML XPaths.
"""
from pathlib import Path
import pytest
from playwright.sync_api import Page
from tests.keywords.keywords import Keywords

@pytest.fixture
def kw(page: Page) -> Keywords:
    """Fixture providing an initialized Keywords instance connected to Playwright Page"""
    return Keywords(page)


@pytest.mark.ui
class TestKeywordDrivenSuite:

    def test_kw_admin_valid_login(self, kw: Keywords):
        """Verify keyword: open_admin_login & login_as_admin"""
        kw.open_admin_login()
        kw.login_as_admin()
        kw.verify_url_contains("dashboard")
        kw.take_screenshot("kw_valid_login")

    def test_kw_admin_invalid_login(self, kw: Keywords):
        """Verify keyword: submit_invalid_login & verify_login_error_displayed"""
        kw.open_admin_login()
        kw.submit_invalid_login("baduser@stayone.com", "WrongPassword123")
        kw.verify_login_error_displayed()

    def test_kw_dashboard_navigation_and_branch(self, kw: Keywords):
        """Verify keyword: navigate_to_module & switch_branch"""
        kw.open_admin_login()
        kw.login_as_admin()
        kw.navigate_to_module("finance")
        kw.verify_url_contains("account")
        kw.navigate_to_module("bookings")
        kw.verify_url_contains("bookings")

    def test_kw_bookings_tab_and_table(self, kw: Keywords):
        """Verify keyword: switch_to_bookings_tab & verify_booking_table_visible"""
        kw.open_admin_login()
        kw.login_as_admin()
        kw.navigate_to_module("bookings")
        kw.switch_to_bookings_tab()
        kw.verify_booking_table_visible()
        kw.verify_visible("bookings.btn_create_new_booking")

    def test_kw_rooms_view(self, kw: Keywords):
        """Verify keyword: view_rooms_section & verify_room_card_exists"""
        kw.open_admin_login()
        kw.login_as_admin()
        kw.navigate_to_module("bookings")
        kw.view_rooms_section()
        kw.verify_room_card_exists()

    def test_kw_user_portal_and_room_qr(self, kw: Keywords):
        """Verify keyword: open_user_portal, open_guest_room_portal & verify_guest_room_portal_status"""
        kw.open_user_portal()
        kw.open_guest_room_portal(room_id=1)
        kw.verify_guest_room_portal_status()
        kw.take_screenshot("kw_user_portal_qr")

    def test_kw_execute_yaml_scenario_file(self, kw: Keywords):
        """Execute complete YAML scenario file containing step-by-step keywords"""
        scenario_file = Path(__file__).resolve().parent / "scenarios" / "admin_flow_scenario.yaml"
        assert scenario_file.exists(), f"Scenario file not found: {scenario_file}"
        kw.execute_scenario(scenario_file)
