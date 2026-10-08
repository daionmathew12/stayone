"""
StayOne Test Framework - Test Data Factory
Generates reproducible and randomized test fixtures for API and UI tests.
"""
import random
import string
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List

class DataFactory:
    @staticmethod
    def random_string(length: int = 8) -> str:
        return "".join(random.choices(string.ascii_letters, k=length))

    @staticmethod
    def random_digits(length: int = 10) -> str:
        return "".join(random.choices(string.digits, k=length))

    @classmethod
    def fake_guest_name(cls) -> str:
        first_names = ["Alexander", "Sophia", "Marcus", "Elena", "Liam", "Ava", "Noah", "Isabella", "David", "Maya"]
        last_names = ["Vance", "Sterling", "Cross", "Chen", "Dubois", "Sinclair", "Mercer", "Kowalski", "Santos"]
        return f"{random.choice(first_names)} {random.choice(last_names)}"

    @classmethod
    def fake_guest_email(cls, prefix: str = "guest") -> str:
        unique = int(time.time() * 1000) % 1000000
        return f"{prefix}_{unique}@example-test.com"

    @classmethod
    def fake_guest_phone(cls) -> str:
        # Standard 10-digit number
        return f"9{cls.random_digits(9)}"

    @classmethod
    def booking_dates(cls, start_offset_days: int = 30, duration_days: int = 2) -> tuple:
        today = datetime.now()
        check_in = (today + timedelta(days=start_offset_days)).strftime("%Y-%m-%d")
        check_out = (today + timedelta(days=start_offset_days + duration_days)).strftime("%Y-%m-%d")
        return check_in, check_out

    @classmethod
    def create_booking_payload(
        cls,
        room_id: int,
        room_type_id: Optional[int] = None,
        guest_name: Optional[str] = None,
        guest_email: Optional[str] = None,
        guest_phone: Optional[str] = None,
        start_offset_days: Optional[int] = None,
        duration_days: int = 2,
        source: str = "Direct"
    ) -> Dict[str, Any]:
        if start_offset_days is None:
            start_offset_days = (int(time.time()) % 500) + 60
        check_in, check_out = cls.booking_dates(start_offset_days, duration_days)

        return {
            "guest_name": guest_name or cls.fake_guest_name(),
            "guest_mobile": guest_phone or cls.fake_guest_phone(),
            "guest_email": guest_email or cls.fake_guest_email(),
            "room_ids": [room_id],
            "room_type_id": room_type_id,
            "check_in": check_in,
            "check_out": check_out,
            "adults": random.randint(1, 2),
            "children": 0,
            "num_rooms": 1,
            "source": source
        }

    @classmethod
    def create_room_payload(cls, branch_id: int = 1) -> Dict[str, Any]:
        num = random.randint(100, 999)
        return {
            "room_number": f"RM-{num}",
            "room_type": "Deluxe Villa",
            "price_per_night": 4500.0,
            "max_occupancy": 3,
            "branch_id": branch_id,
            "description": "Luxury automated test room fixture"
        }
