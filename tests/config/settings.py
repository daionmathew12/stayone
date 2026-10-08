"""
StayOne Test Framework - Global Settings & Environment Configuration
"""
import os
from pathlib import Path
from dataclasses import dataclass, field

@dataclass
class FrameworkSettings:
    # Directories
    TESTS_DIR: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent)
    PROJECT_ROOT: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent.parent)
    REPORTS_DIR: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent / "reports")
    SCREENSHOTS_DIR: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent / "reports" / "screenshots")

    # Service Endpoints
    BACKEND_URL: str = os.getenv("STAYONE_BACKEND_URL", "http://localhost:8011").rstrip("/")
    GATEWAY_URL: str = os.getenv("STAYONE_GATEWAY_URL", "http://localhost:8080").rstrip("/")
    ADMIN_URL: str = os.getenv("STAYONE_ADMIN_URL", "http://localhost:3000").rstrip("/")
    USEREND_URL: str = os.getenv("STAYONE_USEREND_URL", "http://localhost:3002").rstrip("/")

    # Default Authentication Credentials
    SUPERADMIN_EMAIL: str = os.getenv("STAYONE_SUPERADMIN_EMAIL", "admin@orchid.com")
    SUPERADMIN_PASSWORD: str = os.getenv("STAYONE_SUPERADMIN_PASSWORD", "admin123")

    # UI / Browser Automation Settings (Playwright)
    BROWSER_TYPE: str = os.getenv("STAYONE_BROWSER", "chromium")  # chromium, firefox, webkit
    HEADLESS: bool = os.getenv("STAYONE_HEADLESS", "true").lower() in ("true", "1", "yes")
    VIEWPORT_WIDTH: int = int(os.getenv("STAYONE_VIEWPORT_W", "1440"))
    VIEWPORT_HEIGHT: int = int(os.getenv("STAYONE_VIEWPORT_H", "900"))
    DEFAULT_TIMEOUT: int = int(os.getenv("STAYONE_TIMEOUT", "15000"))  # ms
    ACTION_TIMEOUT: int = int(os.getenv("STAYONE_ACTION_TIMEOUT", "5000"))  # ms
    SLOW_MO: int = int(os.getenv("STAYONE_SLOW_MO", "0"))  # ms delay between operations

    # API Settings
    REQUEST_TIMEOUT: int = int(os.getenv("STAYONE_API_TIMEOUT", "10"))  # seconds

    def __post_init__(self):
        # Ensure report & screenshot directories exist
        self.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        self.SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

# Global singleton
settings = FrameworkSettings()
