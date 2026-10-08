"""
Suite 2: Booking Engine, Input Validation & Schema Tests
"""
import sys
import os
import time
import requests
from datetime import datetime, timedelta

# Add tests directory to path
sys.path.insert(0, os.path.dirname(__file__))
from conftest import BACKEND_URL
from test_auth import get_auth_token

def test_direct_booking_and_cleanup():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}", "X-Branch-ID": "all"}
    
    # Get an available room
    r = requests.get(f"{BACKEND_URL}/api/rooms", headers=headers, timeout=5)
    assert r.status_code == 200, f"Failed to get rooms: {r.status_code}"
    rooms = r.json()
    assert len(rooms) > 0, "No rooms found in database"
    room = rooms[0]
    
    today = datetime.now()
    offset = (int(time.time()) % 1000) + 50
    check_in = (today + timedelta(days=offset)).strftime("%Y-%m-%d")
    check_out = (today + timedelta(days=offset + 2)).strftime("%Y-%m-%d")

    payload = {
        "guest_name": "QA Automated Guest",
        "guest_mobile": "9876543210",
        "guest_email": "qa.guest@stayone.com",
        "room_ids": [room["id"]],
        "room_type_id": room.get("room_type_id"),
        "check_in": check_in,
        "check_out": check_out,
        "adults": 1,
        "children": 0,
        "num_rooms": 1,
        "source": "Admin"
    }
    t0 = time.time()
    res = requests.post(f"{BACKEND_URL}/api/bookings", json=payload, headers=headers, timeout=5)
    dur = (time.time() - t0) * 1000
    assert res.status_code == 200, f"Booking failed with HTTP {res.status_code}: {res.text}"
    booking_id = res.json()["id"]

    # Cleanup created booking
    try:
        requests.delete(f"{BACKEND_URL}/api/bookings/{booking_id}", headers=headers, timeout=5)
    except Exception:
        pass

    return dur, f"Created booking ID: {booking_id} and cleaned up"

def test_empty_email_sanitization():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}", "X-Branch-ID": "all"}
    
    r = requests.get(f"{BACKEND_URL}/api/rooms", headers=headers, timeout=5)
    rooms = r.json()
    room = rooms[0]
    
    today = datetime.now()
    offset = (int(time.time()) % 1000) + 60
    check_in = (today + timedelta(days=offset)).strftime("%Y-%m-%d")
    check_out = (today + timedelta(days=offset + 2)).strftime("%Y-%m-%d")

    payload = {
        "guest_name": "No-Email Guest",
        "guest_mobile": "9876500000",
        "guest_email": "",  # Empty string - must sanitize to None
        "room_ids": [room["id"]],
        "room_type_id": room.get("room_type_id"),
        "check_in": check_in,
        "check_out": check_out,
        "adults": 1,
        "children": 0,
        "num_rooms": 1,
        "source": "Admin"
    }
    t0 = time.time()
    res = requests.post(f"{BACKEND_URL}/api/bookings", json=payload, headers=headers, timeout=5)
    dur = (time.time() - t0) * 1000
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    booking_id = res.json()["id"]

    # Cleanup
    try:
        requests.delete(f"{BACKEND_URL}/api/bookings/{booking_id}", headers=headers, timeout=5)
    except Exception:
        pass

    return dur, "Empty email sanitized without 422 validation failure"

def test_malformed_email_rejection():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}", "X-Branch-ID": "all"}
    r = requests.get(f"{BACKEND_URL}/api/rooms", headers=headers, timeout=5)
    room = r.json()[0]

    payload = {
        "guest_name": "Bad Email Guest",
        "guest_mobile": "9876500001",
        "guest_email": "not_an_email_address",
        "room_ids": [room["id"]],
        "check_in": "2026-10-01",
        "check_out": "2026-10-03",
        "adults": 1,
        "children": 0
    }
    t0 = time.time()
    res = requests.post(f"{BACKEND_URL}/api/bookings", json=payload, headers=headers, timeout=5)
    dur = (time.time() - t0) * 1000
    assert res.status_code == 422, f"Expected 422, got {res.status_code}"
    return dur, "Correctly rejected malformed email with HTTP 422"

def test_invalid_date_range_rejection():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}", "X-Branch-ID": "all"}
    r = requests.get(f"{BACKEND_URL}/api/rooms", headers=headers, timeout=5)
    room = r.json()[0]

    payload = {
        "guest_name": "Backwards Date Guest",
        "guest_mobile": "9876500002",
        "room_ids": [room["id"]],
        "check_in": "2026-10-05",
        "check_out": "2026-10-03", # Check-out is before check-in
        "adults": 1,
        "children": 0
    }
    t0 = time.time()
    res = requests.post(f"{BACKEND_URL}/api/bookings", json=payload, headers=headers, timeout=5)
    dur = (time.time() - t0) * 1000
    assert res.status_code in [400, 422], f"Expected 400 or 422, got {res.status_code}"
    return dur, f"Correctly rejected invalid date range with HTTP {res.status_code}"

if __name__ == "__main__":
    tests = [
        ("TC-BOOK-01", "Direct Room Booking & Cleanup", test_direct_booking_and_cleanup),
        ("TC-BOOK-03", "Empty Email Sanitization", test_empty_email_sanitization),
        ("TC-BOOK-04", "Malformed Email Validation", test_malformed_email_rejection),
        ("TC-BOOK-06", "Invalid Date Range Rejection", test_invalid_date_range_rejection),
    ]
    print("\n--- Running Suite 2: Booking Engine ---")
    for test_id, name, func in tests:
        try:
            dur, msg = func()
            print(f" [PASS] {test_id}: {name} ({dur:.1f}ms) - {msg}")
        except Exception as e:
            print(f" [FAIL] {test_id}: {name} - {e}")
