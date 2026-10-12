from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
import os
# Absolute project root path (ResortApp/)
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_UPLOAD_ROOT = os.path.join(_BASE_DIR, "uploads")
from sqlalchemy.orm import Session, joinedload
from app.schemas.service_request import ServiceRequestCreate, ServiceRequestOut, ServiceRequestUpdate
from app.curd import service_request as crud
from app.utils.auth import get_db, get_current_user
from app.utils.branch_scope import get_branch_id
from app.utils.date_utils import format_iso_z

from app.models.user import User
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import json
import shutil
import uuid
from datetime import timezone, datetime, timedelta

UPLOAD_DIR = os.path.join(_UPLOAD_ROOT, "service_requests")
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter(prefix="/service-requests", tags=["Service Requests"])

@router.post("", response_model=ServiceRequestOut)
def create_service_request(
    request: ServiceRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):

    return crud.create_service_request(db, request, branch_id=branch_id)


@router.post("/damage", response_model=ServiceRequestOut)
async def create_damage_report(
    room_id: int = Form(...),
    description: str = Form(...),
    category: str = Form(...),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):

    image_path = None
    if image and image.filename:
        filename = f"damage_{uuid.uuid4().hex}_{image.filename}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        image_path = f"uploads/service_requests/{filename}".replace("\\", "/")
    
    request_data = ServiceRequestCreate(
        room_id=room_id,
        request_type="maintenance",
        description=f"[{category}] {description}",
        image_path=image_path
    )
    
    return crud.create_service_request(db, request_data, branch_id=branch_id)


_last_trigger_time = {}

@router.get("", response_model=List[dict])
@router.get("/", response_model=List[dict])
def get_service_requests(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    room_id: Optional[int] = None,
    include_checkout_requests: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    """
    Get service requests. If include_checkout_requests is True, also includes checkout requests.
    Returns a list of dicts (not ServiceRequestOut) to support both service requests and checkout requests.
    """
    # Authorization logic: Only admins/managers see everything; staff see assigned or unassigned tasks
    user_role = (current_user.role.name.lower() if current_user.role else "guest").strip()
    is_admin = getattr(current_user, 'is_superadmin', False) or any(k in user_role for k in ["admin", "manager", "owner", "superadmin"])
    
    current_employee_id = None
    if current_user.employee:
        current_employee_id = current_user.employee.id
    
    # Apply employee filter if not admin
    effective_employee_id = None if is_admin else current_employee_id
    
    # Trigger scheduled orders so they appear in the task list if due
    # Throttle: Only trigger once every 2 minutes per branch to avoid DB overhead
    now = datetime.now()
    cache_key = branch_id or 0
    
    if cache_key not in _last_trigger_time or (now - _last_trigger_time[cache_key] > timedelta(minutes=2)):
        try:
            from app.curd.foodorder import trigger_scheduled_orders
            if branch_id is not None:
                trigger_scheduled_orders(db, branch_id)
            elif is_admin: # Only trigger all branches if user is admin and no branch_id specified
                from app.models.branch import Branch
                branches = db.query(Branch).all()
                for b in branches:
                    trigger_scheduled_orders(db, b.id)
            _last_trigger_time[cache_key] = now
        except Exception as e:
            print(f"[ERROR] Failed to trigger scheduled orders: {e}")


    service_requests = crud.get_service_requests(
        db, skip=skip, limit=limit, status=status, room_id=room_id, 
        employee_id=effective_employee_id, branch_id=branch_id
    )

    print(f"[DEBUG-API] Fetched {len(service_requests)} service requests")
    for s in service_requests:
        print(f"  [DEBUG-API] SR ID: {s.id}, Room: {s.room_id}, Type: {s.request_type}")

    # Convert service requests to dict format
    result = []
    for sr in service_requests:
        refill_data = None
        if sr.refill_data:
            try:
                refill_data = json.loads(sr.refill_data)
            except:
                refill_data = None
        
        try:
            food_order_data = None
            guest_name = None
            prepared_by_name = None

            if sr.food_order:
                    # Get Guest Name
                    if sr.food_order.booking:
                        guest_name = sr.food_order.booking.guest_name
                    elif sr.food_order.package_booking:
                        guest_name = sr.food_order.package_booking.guest_name
                    
                    # Get Prepared By Name (Chef)
                    if sr.food_order.chef:
                        prepared_by_name = sr.food_order.chef.name

                    food_order_data = {
                    "id": sr.food_order.id,
                    "amount": sr.food_order.amount,
                    "status": sr.food_order.status,
                    "billing_status": sr.food_order.billing_status,
                    "prepared_by_name": prepared_by_name,
                    "items": [
                        {
                            "id": item.id,
                            "food_item_id": item.food_item_id,
                            "food_item_name": item.food_item.name if item.food_item else "Unknown",
                            "quantity": item.quantity
                        } for item in sr.food_order.items
                    ] if sr.food_order.items else []
                }

            # Dynamic GST calculation for summary
            from app.utils.settings_helpers import get_gst_settings
            gst_settings = get_gst_settings(db, branch_id)
            gst_rate = float(gst_settings["food_gst_rate"]) / 100.0 if gst_settings["gst_enabled"] else 0.0
            
            fo_amount = sr.food_order.amount if sr.food_order else getattr(sr, 'food_order_amount', 0)
            
            if sr.food_order and sr.food_order.gst_amount is not None:
                fo_gst = sr.food_order.gst_amount
                fo_total = sr.food_order.total_with_gst
            else:
                if fo_amount and gst_settings.get("gst_inclusive", False) and gst_rate > 0:
                    fo_total = fo_amount
                    fo_gst = fo_total - (fo_total / (1 + gst_rate))
                    fo_amount = fo_total - fo_gst
                else:
                    fo_gst = fo_amount * gst_rate if fo_amount else 0
                    fo_total = fo_amount + fo_gst if fo_amount else 0

            result.append({
                "id": sr.id,
                "food_order_id": sr.food_order_id,
                "food_order": food_order_data,
                "room_id": sr.room_id,
                "employee_id": sr.employee_id,
                "request_type": str(sr.request_type) if sr.request_type else None,
                "type": str(sr.request_type) if sr.request_type else "Other", # Alias for mobile app
                "description": str(sr.description) if sr.description else None,
                "status": str(sr.status) if sr.status else "pending",
                "billing_status": sr.billing_status,
                "created_at": format_iso_z(sr.created_at),
                "completed_at": format_iso_z(sr.completed_at),
                "is_checkout_request": False,
                "is_assigned_service": False,
                "room_number": sr.room.number if sr.room else (str(getattr(sr, 'room_number', '')) if getattr(sr, 'room_number', None) else None),
                "employee_name": sr.employee.name if sr.employee else (str(getattr(sr, 'employee_name', '')) if getattr(sr, 'employee_name', None) else None),
                "guest_name": guest_name,
                "prepared_by_name": prepared_by_name,
                "refill_data": refill_data,
                "food_order_amount": fo_amount,
                "food_order_gst": fo_gst,
                "food_order_total": fo_total,
                "food_order_status": sr.food_order.status if sr.food_order else getattr(sr, 'food_order_status', None),
                "food_order_billing_status": sr.food_order.billing_status if sr.food_order else getattr(sr, 'food_order_billing_status', None),
                "food_items": food_order_data["items"] if food_order_data else []
            })
        except Exception as e:
            print(f"[ERROR] Error converting service request {sr.id}: {e}")
            import traceback
            traceback.print_exc()
            continue

    # 2. Also include manually assigned services (AssignedService model)
    # These are tasks like 'Massage', 'Laundry', etc. assigned via the Services module
    from app.models.service import AssignedService as AssignedServiceModel, service_inventory_item
    
    assigned_query = db.query(AssignedServiceModel).options(
        joinedload(AssignedServiceModel.service),
        joinedload(AssignedServiceModel.room),
        joinedload(AssignedServiceModel.employee)
    )
    
    if branch_id:
        assigned_query = assigned_query.filter(AssignedServiceModel.branch_id == branch_id)
    
    if not is_admin:
        from sqlalchemy import or_
        if current_employee_id:
            assigned_query = assigned_query.filter(
                or_(AssignedServiceModel.employee_id == current_employee_id, AssignedServiceModel.employee_id == None)
            )
        else:
            assigned_query = assigned_query.filter(AssignedServiceModel.employee_id == None)
    
    if status:
        # Convert status to lowercase and validate for Enum
        norm_status = status.lower().replace(" ", "_")
        from app.models.service import ServiceStatus
        if norm_status in [s.value for s in ServiceStatus]:
             assigned_query = assigned_query.filter(AssignedServiceModel.status == norm_status)
        else:
             # If status doesn't match assigned service enums, don't return any assigned services
             assigned_query = assigned_query.filter(AssignedServiceModel.id == -1)
    else:
        # Include all pending, in_progress, and recently completed (last 7 days)
        from app.models.service import ServiceStatus
        seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
        assigned_query = assigned_query.filter(
            (AssignedServiceModel.status.notin_([ServiceStatus.completed, ServiceStatus.cancelled])) |
            ((AssignedServiceModel.status.in_([ServiceStatus.completed, ServiceStatus.cancelled])) & 
             (AssignedServiceModel.assigned_at >= seven_days_ago))
        )
    
    if room_id:
        assigned_query = assigned_query.filter(AssignedServiceModel.room_id == room_id)
        
    import sys
    try:
        # Print compiled SQL for debugging
        sql_stmt = str(assigned_query.statement.compile(compile_kwargs={"literal_binds": True}))
        print(f"[DEBUG-SQL] AssignedService SQL: {sql_stmt}")
    except Exception as e:
        print(f"[DEBUG-SQL] Could not print SQL: {e}")

    assigned_services_list = assigned_query.order_by(AssignedServiceModel.assigned_at.desc()).limit(limit).all()
    print(f"[DEBUG-RES] Found {len(assigned_services_list)} Assigned Services.")
    for x in assigned_services_list:
        print(f"  -> AsvcID: {x.id}, EmpID: {x.employee_id}, Status: {x.status}")
    
    for asvc in assigned_services_list:
        try:
            if not asvc.service:
                continue
                
            # Fetch inventory needs for this service assignment
            from app.api.service import _load_assigned_inventory_items, _load_inventory_items_for_service
            items_used = []
            try:
                items_used = _load_assigned_inventory_items(db, asvc.id)
                if not items_used:
                    items_used = _load_inventory_items_for_service(db, asvc.service_id)
            except Exception as e:
                print(f"[ERROR] Error fetching inventory for assigned service {asvc.id}: {e}")

            result.append({
                "id": asvc.id + 2000000, # Use 2M offset for AssignedService IDs
                "food_order_id": None,
                "room_id": asvc.room_id,
                "employee_id": asvc.employee_id,
                "request_type": asvc.service.name,
                "type": asvc.service.name, # Alias for mobile app
                "description": asvc.service.description or f"Manual duty: {asvc.service.name}",
                "status": str(asvc.status.value if hasattr(asvc.status, 'value') else asvc.status),
                "created_at": format_iso_z(asvc.assigned_at),
                "started_at": format_iso_z(getattr(asvc, 'started_at', None)),
                "completed_at": format_iso_z(getattr(asvc, 'last_used_at', None)),
                "is_checkout_request": False,
                "is_assigned_service": True,
                "assigned_service_id": asvc.id,
                "billing_status": asvc.billing_status, # Include billing status from AssignedService
                "room_number": asvc.room.number if asvc.room else (asvc.location.name if asvc.location else "???"),
                "employee_name": asvc.employee.name if asvc.employee else "Unassigned",
                "refill_data": None,
                "inventory_items_used": items_used,
                "service": {
                    "id": asvc.service.id,
                    "name": asvc.service.name,
                    "average_completion_time": getattr(asvc.service, 'average_completion_time', None)
                }
            })
        except Exception as e:
            print(f"[ERROR] Error converting assigned service {asvc.id}: {e}")
            continue
    
    # 3. Also include checkout requests as service requests
    if include_checkout_requests:
        from app.models.checkout import CheckoutRequest as CheckoutRequestModel
        from app.models.room import Room
        from app.models.inventory import InventoryItem
        
        checkout_query = db.query(CheckoutRequestModel).options(
            joinedload(CheckoutRequestModel.employee)
        )
        
        if branch_id:
            checkout_query = checkout_query.filter(CheckoutRequestModel.branch_id == branch_id)

        if not is_admin:
            from sqlalchemy import or_
            if current_employee_id:
                checkout_query = checkout_query.filter(
                    or_(CheckoutRequestModel.employee_id == current_employee_id, CheckoutRequestModel.employee_id == None)
                )
            else:
                checkout_query = checkout_query.filter(CheckoutRequestModel.employee_id == None)
        
        # Show all checkout requests, including recently completed ones (last 7 days)
        if status:
            checkout_query = checkout_query.filter(CheckoutRequestModel.status == status)

        if room_id:
            room_obj = db.query(Room).filter(Room.id == room_id).first()
            if room_obj:
                checkout_query = checkout_query.filter(CheckoutRequestModel.room_number == room_obj.number)
            else:
                checkout_query = checkout_query.filter(CheckoutRequestModel.id == -1)
        else:
            # Include all pending, in_progress, and recently completed (last 7 days)
            seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
            checkout_query = checkout_query.filter(
                (CheckoutRequestModel.status.notin_(["cancelled", "completed"])) |
                ((CheckoutRequestModel.status.in_(["completed", "cancelled"])) & 
                 (CheckoutRequestModel.completed_at >= seven_days_ago))
            )
        
        checkout_requests = checkout_query.order_by(CheckoutRequestModel.created_at.desc()).limit(limit).offset(skip).all()
        
        # Optimization: Pre-fetch rooms
        room_numbers = [str(cr.room_number) for cr in checkout_requests if cr.room_number]
        room_query = db.query(Room).filter(Room.number.in_(room_numbers))
        if branch_id:
            room_query = room_query.filter(Room.branch_id == branch_id)
        rooms = room_query.all()
        
        # Consistent keying by string room number
        room_map = {str(r.number): r for r in rooms}
        
        # Optimization: Pre-fetch items
        item_ids = set()
        for cr in checkout_requests:
            if cr.inventory_data:
                for item in cr.inventory_data:
                    if item.get('item_id'):
                        item_ids.add(item.get('item_id'))
        
        inventory_items = {}
        if item_ids:
            items = db.query(InventoryItem).filter(InventoryItem.id.in_(list(item_ids))).all()
            inventory_items = {i.id: i for i in items}
        
        for cr in checkout_requests:
            try:
                room = room_map.get(str(cr.room_number))
                # Always append checkout request - use room_id=None as fallback if room not found
                # (Previously: silently dropped if room wasn't in room_map due to branch mismatch)
                room_id = room.id if room else None
                enriched_inventory_data = []
                if cr.inventory_data:
                    for item in cr.inventory_data:
                        enriched_item = item.copy()
                        if ('item_name' not in enriched_item or not enriched_item['item_name']) and enriched_item.get('item_id'):
                            inv_item = inventory_items.get(enriched_item.get('item_id'))
                            if inv_item:
                                enriched_item['item_name'] = inv_item.name
                                if 'item_code' not in enriched_item:
                                    enriched_item['item_code'] = inv_item.item_code
                        enriched_inventory_data.append(enriched_item)

                result.append({
                    "id": cr.id + 1000000, 
                    "food_order_id": None,
                    "room_id": room_id,
                    "employee_id": cr.employee_id,
                    "request_type": "checkout_verification",
                    "type": "checkout_verification", # Alias for mobile app
                    "description": f"Checkout inventory verification for Room {cr.room_number} - Guest: {cr.guest_name}",
                    "status": str(cr.status) if cr.status else "pending",
                    "created_at": format_iso_z(cr.created_at),
                    "started_at": format_iso_z(getattr(cr, 'started_at', None)),
                    "completed_at": format_iso_z(cr.completed_at),
                    "inventory_checked_at": format_iso_z(cr.inventory_checked_at),
                    "requested_at": format_iso_z(cr.requested_at),
                    "is_checkout_request": True,
                    "is_assigned_service": False,
                    "checkout_request_id": cr.id,
                    "room_number": str(cr.room_number) if cr.room_number else None,
                    "guest_name": str(cr.guest_name) if cr.guest_name else None,
                    "employee_name": str(cr.employee.name) if cr.employee and cr.employee.name else None,
                    "inventory_notes": cr.inventory_notes,
                    "asset_damages": [item for item in enriched_inventory_data if item.get('is_fixed_asset')],
                    "inventory_data_with_charges": [item for item in enriched_inventory_data if not item.get('is_fixed_asset')]
                })
            except Exception as e:
                print(f"[ERROR] Error converting checkout request {cr.id}: {e}")
                continue
    
    # 4. Sort the combined results by date descending (newest first)
    # We use a helper to extract the date safely as a string for lexicographical comparison or parse it
    def get_item_date(item):
        d = item.get('created_at') or item.get('assigned_at') or "1970-01-01T00:00:00Z"
        return d

    result.sort(key=get_item_date, reverse=True)

    print(f"[DEBUG] Returning {len(result)} items for user {current_user.email if current_user else 'None'}")
    for item in result[:10]: # Print top 10 for debug
        print(f"  - Item ID: {item.get('id')}, Type: {item.get('type')}, Status: {item.get('status')}, Date: {item.get('created_at')}")
    
    return result

@router.get("/{request_id}", response_model=ServiceRequestOut)
def get_service_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    request = crud.get_service_request(db, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Service request not found")
    return request

@router.put("/{request_id}")
def update_service_request(
    request_id: int,
    update: ServiceRequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    # Authorization logic
    user_role = (current_user.role.name.lower() if current_user.role else "guest").strip()
    is_admin = getattr(current_user, 'is_superadmin', False) or any(k in user_role for k in ["admin", "manager", "owner", "superadmin"])
    current_employee_id = current_user.employee.id if current_user.employee else None
    
    print(f"[DEBUG-API] Updating ServiceRequest {request_id}. Status: {update.status}, Billing: {update.billing_status}, Branch: {branch_id}")

    # 1. Check if this is a checkout request (ID > 1000000 and < 2000000)
    if 1000000 < request_id < 2000000:
        actual_checkout_id = request_id - 1000000
        from app.models.checkout import CheckoutRequest as CheckoutRequestModel
        checkout_request = db.query(CheckoutRequestModel).filter(CheckoutRequestModel.id == actual_checkout_id).first()
        if not checkout_request:
            raise HTTPException(status_code=404, detail="Checkout request not found")
        
        # Branch validation
        if branch_id and hasattr(checkout_request, 'branch_id') and checkout_request.branch_id != branch_id:
             # Some old checkout models might not have branch_id directly, but if they do, we check
             pass

        # Check authorization
        if not is_admin:
            if checkout_request.employee_id is not None and checkout_request.employee_id != current_employee_id:
                 raise HTTPException(status_code=403, detail="Task assigned to another employee")

        if update.employee_id is not None:
            checkout_request.employee_id = update.employee_id
        if update.status is not None:
            old_checkout_status = checkout_request.status
            checkout_request.status = update.status
            if update.status == "in_progress" and not checkout_request.started_at:
                checkout_request.started_at = datetime.now(timezone.utc)
            elif update.status == "completed":
                checkout_request.completed_at = datetime.now(timezone.utc)
                checkout_request.inventory_checked = True
                checkout_request.inventory_checked_by = getattr(current_user, 'name', None) or getattr(current_user, 'email', None) or "system"
                checkout_request.inventory_checked_at = datetime.now(timezone.utc)
            print(f"[INFO] CheckoutRequest {actual_checkout_id} status: {old_checkout_status} -> {update.status}")
        
        db.commit()
        db.refresh(checkout_request)
        
        from app.models.room import Room
        room = db.query(Room).filter(Room.number == checkout_request.room_number).first()
        return {
            "id": request_id,
            "food_order_id": None,
            "food_order": None,
            "room_id": room.id if room else None,
            "employee_id": checkout_request.employee_id,
            "request_type": "checkout_verification",
            "type": "checkout_verification",
            "description": f"Checkout inventory verification for Room {checkout_request.room_number}",
            "status": checkout_request.status,
            "billing_status": None,
            "created_at": format_iso_z(checkout_request.created_at),
            "started_at": format_iso_z(checkout_request.started_at),
            "completed_at": format_iso_z(checkout_request.completed_at),
            "is_checkout_request": True,
            "is_assigned_service": False,
            "room_number": checkout_request.room_number,
            "employee_name": checkout_request.employee.name if checkout_request.employee else None,
            "refill_data": None,
            "food_order_amount": None,
            "food_order_status": None,
            "food_order_billing_status": None,
            "food_items": [],
            "service": {
                "id": 0,
                "name": "Checkout Verification",
                "average_completion_time": "15 minutes"
            }
        }
    
    # 2. Check if this is an assigned service (ID > 2000000)
    if request_id > 2000000:
        actual_assigned_id = request_id - 2000000
        from app.models.service import AssignedService as AssignedServiceModel
        from app.curd.service import update_assigned_service_status
        from app.schemas.service import AssignedServiceUpdate
        
        # Check authorization
        as_existing = db.query(AssignedServiceModel).filter(AssignedServiceModel.id == actual_assigned_id).first()
        if not as_existing:
            raise HTTPException(status_code=404, detail="Assigned service not found")
        
        # Branch validation
        if branch_id and as_existing.branch_id != branch_id:
             raise HTTPException(status_code=403, detail="Access denied to this branch")

        if not is_admin:
             if as_existing.employee_id is not None and as_existing.employee_id != current_employee_id:
                  raise HTTPException(status_code=403, detail="Task assigned to another employee")

        # Map ServiceRequestUpdate to AssignedServiceUpdate
        as_update = AssignedServiceUpdate(
            status=update.status,
            employee_id=update.employee_id,
            billing_status=update.billing_status,
            payment_mode=update.payment_mode,
            return_location_id=update.return_location_id,
            inventory_returns=update.inventory_returns
        )
        
        updated_asvc = update_assigned_service_status(db, actual_assigned_id, as_update)
        if not updated_asvc:
            raise HTTPException(status_code=404, detail="Assigned service not found")

        asvc_status = str(updated_asvc.status.value if hasattr(updated_asvc.status, 'value') else updated_asvc.status)
        print(f"[INFO] AssignedService {actual_assigned_id} updated to status={asvc_status}")
            
        return {
            "id": request_id,
            "food_order_id": None,
            "food_order": None,
            "room_id": updated_asvc.room_id,
            "employee_id": updated_asvc.employee_id,
            "request_type": updated_asvc.service.name if updated_asvc.service else "Service",
            "type": updated_asvc.service.name if updated_asvc.service else "Service",
            "description": updated_asvc.service.description if updated_asvc.service else "",
            "status": asvc_status,
            "billing_status": updated_asvc.billing_status,
            "created_at": format_iso_z(updated_asvc.assigned_at),
            "started_at": format_iso_z(getattr(updated_asvc, 'started_at', None)),
            "completed_at": format_iso_z(getattr(updated_asvc, 'completed_at', None)),
            "is_checkout_request": False,
            "is_assigned_service": True,
            "assigned_service_id": updated_asvc.id,
            "room_number": updated_asvc.room.number if updated_asvc.room else None,
            "employee_name": updated_asvc.employee.name if updated_asvc.employee else None,
            "refill_data": None,
            "food_order_amount": None,
            "food_order_status": None,
            "food_order_billing_status": None,
            "food_items": [],
            "service": {
                "id": updated_asvc.service.id if updated_asvc.service else 0,
                "name": updated_asvc.service.name if updated_asvc.service else "Service",
                "average_completion_time": getattr(updated_asvc.service, 'average_completion_time', None) if updated_asvc.service else None
            }
        }

    # 3. Regular service request
    # Check authorization
    existing = crud.get_service_request(db, request_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Service request not found")
    
    # Branch validation
    if branch_id and existing.branch_id != branch_id:
         raise HTTPException(status_code=403, detail="Access denied to this branch")
        
    if not is_admin:
        if existing.employee_id is not None and existing.employee_id != current_employee_id:
            raise HTTPException(status_code=403, detail="Task assigned to another employee")

    updated = crud.update_service_request(db, request_id, update, branch_id=branch_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Service request not found")
    
    # Reload with all relationships to populate computed fields (room_number, food_order_status, etc.)
    reloaded = crud.get_service_request(db, request_id)
    if not reloaded:
        reloaded = updated

    old_status_str = str(existing.status)
    new_status_str = str(reloaded.status)
    print(f"[INFO] ServiceRequest {request_id} status: {old_status_str} -> {new_status_str}")

    # Build response dict (same structure as GET endpoint) to avoid Pydantic serialization issues
    food_order_data = None
    if reloaded.food_order:
        food_order_data = {
            "id": reloaded.food_order.id,
            "amount": reloaded.food_order.amount,
            "status": reloaded.food_order.status,
            "billing_status": reloaded.food_order.billing_status,
            "prepared_by_name": reloaded.food_order.chef.name if reloaded.food_order.chef else None,
            "items": [
                {
                    "id": item.id,
                    "food_item_id": item.food_item_id,
                    "food_item_name": item.food_item.name if item.food_item else "Unknown",
                    "quantity": item.quantity
                } for item in reloaded.food_order.items
            ] if reloaded.food_order.items else []
        }

    # Calculate dynamic GST for response
    from app.utils.settings_helpers import get_gst_settings
    gst_settings = get_gst_settings(db, branch_id)
    gst_rate = float(gst_settings["food_gst_rate"]) / 100.0 if gst_settings["gst_enabled"] else 0.0
    fo_amount = reloaded.food_order.amount if reloaded.food_order else 0
    if reloaded.food_order and reloaded.food_order.gst_amount is not None:
        fo_gst = reloaded.food_order.gst_amount
        fo_total = reloaded.food_order.total_with_gst
    else:
        if fo_amount and gst_settings.get("gst_inclusive", False) and gst_rate > 0:
            fo_total = fo_amount
            fo_gst = fo_total - (fo_total / (1 + gst_rate))
            fo_amount = fo_total - fo_gst
        else:
            fo_gst = fo_amount * gst_rate if fo_amount else 0
            fo_total = fo_amount + fo_gst if fo_amount else 0

    return {
        "id": reloaded.id,
        "food_order_id": reloaded.food_order_id,
        "food_order": food_order_data,
        "room_id": reloaded.room_id,
        "employee_id": reloaded.employee_id,
        "request_type": str(reloaded.request_type) if reloaded.request_type else None,
        "type": str(reloaded.request_type) if reloaded.request_type else "Other",
        "description": str(reloaded.description) if reloaded.description else None,
        "status": str(reloaded.status) if reloaded.status else "pending",
        "billing_status": reloaded.billing_status,
        "created_at": format_iso_z(reloaded.created_at),
        "started_at": format_iso_z(reloaded.started_at),
        "completed_at": format_iso_z(reloaded.completed_at),
        "is_checkout_request": False,
        "is_assigned_service": False,
        "room_number": reloaded.room.number if reloaded.room else None,
        "employee_name": reloaded.employee.name if reloaded.employee else None,
        "refill_data": json.loads(reloaded.refill_data) if reloaded.refill_data else None,
        "food_order_amount": fo_amount,
        "food_order_gst": fo_gst,
        "food_order_total": fo_total,
        "food_order_status": reloaded.food_order.status if reloaded.food_order else None,
        "food_order_billing_status": reloaded.food_order.billing_status if reloaded.food_order else None,
        "guest_name": reloaded.food_order.booking.guest_name if reloaded.food_order and reloaded.food_order.booking else (reloaded.food_order.package_booking.guest_name if reloaded.food_order and reloaded.food_order.package_booking else None),
        "prepared_by_name": reloaded.food_order.chef.name if reloaded.food_order and reloaded.food_order.chef else None,
        "food_items": food_order_data["items"] if food_order_data else []
    }

@router.delete("/{request_id}")
def delete_service_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    deleted = crud.delete_service_request(db, request_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Service request not found")
    return {"message": "Service request deleted successfully"}

