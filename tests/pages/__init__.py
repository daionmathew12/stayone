"""
Page Object Models for StayOne Frontend Applications
"""
from .admin_login_page import AdminLoginPage
from .admin_dashboard_page import AdminDashboardPage
from .admin_bookings_page import AdminBookingsPage
from .user_portal_page import UserPortalPage

__all__ = [
    "AdminLoginPage",
    "AdminDashboardPage",
    "AdminBookingsPage",
    "UserPortalPage"
]
