"""
API Test Suite: Rooms & Inventory API
"""
import pytest
from tests.core.api_client import APIClient

@pytest.mark.api
class TestRoomsAPI:
    def test_list_all_rooms(self, auth_api_client: APIClient):
        """Verify authenticated users can retrieve room inventory"""
        resp = auth_api_client.get_rooms()
        resp.assert_status(200)
        rooms = resp.json()
        assert isinstance(rooms, list), "Expected list of rooms"
        assert len(rooms) > 0, "Expected at least one room in database"
        
        # Verify required keys in room structure
        room = rooms[0]
        for key in ["id", "number"]:
            assert key in room, f"Missing '{key}' in room record: {list(room.keys())}"

    def test_unauthenticated_rooms_rejected(self, api_client: APIClient):
        """Verify unauthenticated requests to rooms are rejected with 401"""
        api_client.set_auth_token("")
        resp = api_client.get("/api/rooms")
        resp.assert_status(401)

    def test_room_search_filter(self, auth_api_client: APIClient):
        """Verify room search query filter functions without syntax error"""
        resp = auth_api_client.get_rooms(search="Villa")
        resp.assert_status(200)
        assert isinstance(resp.json(), list)

    def test_room_types_retrieval(self, auth_api_client: APIClient):
        """Verify room types can be queried"""
        resp = auth_api_client.get("/api/rooms/types")
        resp.assert_status(200)
        types = resp.json()
        assert isinstance(types, list)
