"""
API Test Suite: Bookings Management Lifecycle & Workflows
"""
import pytest
from tests.core.api_client import APIClient
from tests.core.data_factory import DataFactory

@pytest.mark.api
@pytest.mark.smoke
class TestBookingsAPI:
    def test_list_bookings(self, auth_api_client: APIClient):
        """Verify admin can list bookings"""
        resp = auth_api_client.get_bookings()
        resp.assert_status(200)
        data = resp.json()
        assert "bookings" in data, f"Expected 'bookings' key in response: {list(data.keys())}"
        assert isinstance(data["bookings"], list)

    def test_create_and_cleanup_booking(self, auth_api_client: APIClient):
        """End-to-end booking lifecycle: Create booking -> Verify record -> Clean up"""
        # 1. Fetch available room
        rooms_resp = auth_api_client.get_rooms()
        rooms_resp.assert_status(200)
        rooms = rooms_resp.json()
        assert len(rooms) > 0, "No rooms available for booking test"
        target_room = rooms[0]

        # 2. Build payload with DataFactory
        guest_name = f"QA Auto-{DataFactory.random_string(5)}"
        payload = DataFactory.create_booking_payload(
            room_id=target_room["id"],
            room_type_id=target_room.get("room_type_id"),
            guest_name=guest_name
        )

        # 3. Create booking
        create_resp = auth_api_client.create_booking(payload)
        assert create_resp.status_code in [200, 201], f"Unexpected status: {create_resp.status_code}"
        booking_data = create_resp.json()
        booking_id = booking_data["id"]
        assert booking_data["guest_name"] == guest_name

        try:
            # 4. Search and retrieve the newly created booking
            search_resp = auth_api_client.get_bookings(search=guest_name)
            search_resp.assert_status(200)
            search_data = search_resp.json()
            booking_list = search_data.get("bookings", search_data if isinstance(search_data, list) else [])
            matching = [b for b in booking_list if b["id"] == booking_id]
            assert len(matching) == 1, f"Created booking {booking_id} not found in search"
        finally:
            # 5. Clean up test record to maintain database hygiene
            del_resp = auth_api_client.delete_booking(booking_id)
            del_resp.assert_status(200)

    def test_booking_empty_payload_validation(self, auth_api_client: APIClient):
        """Verify API rejects invalid booking schemas with 422 Unprocessable Entity"""
        resp = auth_api_client.post("/api/bookings", json={})
        resp.assert_status(422)
