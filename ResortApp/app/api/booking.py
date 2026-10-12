# booking.py
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Query, Form, BackgroundTasks
import os
# Absolute project root path (ResortApp/)
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_UPLOAD_ROOT = os.path.join(_BASE_DIR, "uploads")
from sqlalchemy.orm import Session, joinedload, load_only
from sqlalchemy import func, or_, and_
from typing import List, Union, Optional
from datetime import date, datetime
from app.utils.auth import get_db, get_current_user
from app.utils.api_optimization import optimize_limit, MAX_LIMIT_LOW_NETWORK
from app.utils.booking_id import parse_display_id, format_display_id
from app.utils.pricing import calculate_dynamic_booking_price
from app.utils.checkout_helpers import calculate_gst_breakdown
from app.models.booking import Booking, BookingRoom
from app.utils.branch_scope import get_branch_id
from app.models.user import User

from app.models.room import Room
from app.models.Package import Package, PackageBooking, PackageBookingRoom
from app.schemas.booking import BookingCreate, BookingOut, BookingConfirm, BookingUpdate
from app.models.checkout import Checkout
from app.models.payment import Payment
from app.schemas.room import RoomOut
from fastapi.responses import FileResponse
import shutil
import uuid
from app.curd import foodorder as crud_food_order
from app.schemas.foodorder import FoodOrderCreate, FoodOrderItemCreate
from app.utils.employee_helpers import get_fallback_employee_id
from app.utils.date_utils import get_ist_now, get_ist_today

UPLOAD_DIR = os.path.join(_UPLOAD_ROOT, "checkin_proofs")
os.makedirs(UPLOAD_DIR, exist_ok=True)
from app.schemas.booking import BookingOut, BookingRoomOut
from pydantic import BaseModel, ValidationError

# Detailed Model Imports
from app.models.foodorder import FoodOrder
from app.models.service import AssignedService
from app.models.inventory import StockIssue, StockIssueDetail, InventoryItem, Location, AssetMapping, LocationStock

class PaginatedBookingResponse(BaseModel):
    total: int
    bookings: List[BookingOut]

router = APIRouter(prefix="/bookings", tags=["Bookings"])

@router.post("/{booking_id}/confirm", response_model=BookingOut)
def confirm_booking(
    booking_id: Union[str, int],
    confirm_data: BookingConfirm,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    # Parse display ID (BK-000001) or accept numeric ID
    numeric_id, _ = parse_display_id(str(booking_id))
    if numeric_id is not None:
        booking_id = numeric_id
    
    query = db.query(Booking).filter(Booking.id == booking_id)
    if branch_id is not None:
        query = query.filter(Booking.branch_id == branch_id)
    booking = query.first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    was_pending = booking.status.lower() == "pending"
    
    booking.is_confirmed = True
    booking.confirmed_at = get_ist_now()
    
    # Calculate total advance and create payment records
    total_advance = 0.0
    from app.utils.accounting_helpers import create_advance_payment_journal_entry

    for p in confirm_data.payments:
        payment = Payment(
            booking_id=booking.id,
            amount=p.amount,
            method=p.method,
            status="paid",
            branch_id=branch_id or booking.branch_id
        )
        db.add(payment)
        total_advance += p.amount
        
        # Accounting Sync
        create_advance_payment_journal_entry(
            db=db,
            booking_id=booking.id,
            amount=p.amount,
            payment_method=p.method,
            guest_name=booking.guest_name,
            branch_id=branch_id or booking.branch_id,
            created_by=current_user.id
        )
        
    # INCREMENT advance deposit instead of overwriting
    booking.advance_deposit = (booking.advance_deposit or 0.0) + total_advance
    booking.confirmation_notes = confirm_data.notes
    
    # Promote enquiry (pending) to confirmed booking
    if booking.status.lower() == "pending":
        booking.status = "booked"
        # If direct room assignments exist, now update their status to Booked
        if was_pending and booking.booking_rooms:
            from app.models.room import Room as RoomModel
            for br in booking.booking_rooms:
                room = db.query(RoomModel).filter(RoomModel.id == br.room_id).first()
                if room:
                    room.status = "Booked"
    
    db.commit()
    db.refresh(booking)
    
    return booking

@router.get("/{booking_id}/receipt")
def get_booking_receipt(
    booking_id: Union[str, int],
    is_package: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    numeric_id, _ = parse_display_id(str(booking_id))
    if numeric_id is not None:
        booking_id = numeric_id
        
    if is_package:
        query = db.query(PackageBooking).filter(PackageBooking.id == booking_id)
        if branch_id is not None:
            query = query.filter(PackageBooking.branch_id == branch_id)
        booking = query.first()
        payments = db.query(Payment).filter(Payment.package_booking_id == booking_id).all()
    else:
        query = db.query(Booking).filter(Booking.id == booking_id)
        if branch_id is not None:
            query = query.filter(Booking.branch_id == branch_id)
        booking = query.first()
        payments = db.query(Payment).filter(Payment.booking_id == booking_id).all()
        
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    # We allow downloading if confirmed OR if advance_deposit > 0
    if not booking.is_confirmed and booking.advance_deposit <= 0:
        raise HTTPException(status_code=400, detail="No advance payment found for this booking")

    filename = f"receipt_{booking_id}.pdf"
    output_path = os.path.join(_UPLOAD_ROOT, "receipts", filename)
    
    from app.utils.pdf_generator import generate_advance_payment_receipt_pdf
    generate_advance_payment_receipt_pdf(booking, payments, output_path)
    
    return FileResponse(output_path, filename=filename, media_type="application/pdf")

@router.get("", response_model=PaginatedBookingResponse)
def get_bookings(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user), 
    skip: int = 0, 
    limit: int = 20, 
    order_by: str = "id", 
    order: str = "desc",
    fields: Optional[str] = None,
    room_id: Optional[int] = None,
    status: Optional[str] = None,
    guest_name: Optional[str] = None,
    check_in_date: Optional[str] = None,
    branch_id: int = Depends(get_branch_id)
):

    try:
        # Optimize limit for low network
        limit = optimize_limit(limit, MAX_LIMIT_LOW_NETWORK)
        
        # Get regular bookings - NO eager loading to maximize performance
        # Load relationships separately only when needed
        query = db.query(Booking)
        
        if branch_id is not None:
             query = query.filter(Booking.branch_id == branch_id)

        if status:
            query = query.filter(Booking.status.ilike(status))
        
        if guest_name:
            query = query.filter(Booking.guest_name.ilike(f"%{guest_name}%"))
            
        if check_in_date:
            try:
                from datetime import datetime
                d = datetime.strptime(check_in_date, '%Y-%m-%d').date()
                query = query.filter(Booking.check_in == d)
            except:
                pass

        if room_id:
            query = query.join(BookingRoom).filter(BookingRoom.room_id == room_id)
        
        # Apply ordering - Default to Checked-in first
        from sqlalchemy import case
        status_priority = case(
            (Booking.status.ilike('checked-in'), 1),
            (Booking.status.ilike('booked'), 2),
            (Booking.status.ilike('confirmed'), 2),
            (Booking.status.ilike('pending'), 3),  # Enquiries show prominently
            (Booking.status.ilike('checked-out'), 4),
            (Booking.status.ilike('cancelled'), 5),
            else_=6
        )

        if order_by == "id" and order == "desc":
            query = query.order_by(status_priority, Booking.id.desc())
        elif order_by == "id" and order == "asc":
            query = query.order_by(status_priority, Booking.id.asc())
        elif order_by == "check_in" and order == "desc":
            query = query.order_by(status_priority, Booking.check_in.desc())
        elif order_by == "check_in" and order == "asc":
            query = query.order_by(status_priority, Booking.check_in.asc())
        else:
            # Default fallback
            query = query.order_by(status_priority, Booking.id.desc())
        
        regular_bookings = query.offset(skip).limit(limit).all()
        
        # Batch load rooms for all bookings to avoid N+1
        booking_ids = [b.id for b in regular_bookings]
        booking_rooms_map = {}
        if booking_ids:
            booking_rooms = db.query(BookingRoom).filter(BookingRoom.booking_id.in_(booking_ids)).all()
            room_ids = [br.room_id for br in booking_rooms if br.room_id]
            rooms_map = {}
            if room_ids:
                rooms = db.query(Room).filter(Room.id.in_(room_ids)).all()
                rooms_map = {r.id: r for r in rooms}
            
            for br in booking_rooms:
                if br.booking_id not in booking_rooms_map:
                    booking_rooms_map[br.booking_id] = []
                if br.room_id and br.room_id in rooms_map:
                    booking_rooms_map[br.booking_id].append(rooms_map[br.room_id])
        
        # Pre-load all payments for all bookings to avoid N+1
        payments_map = {}
        if booking_ids:
            all_payments = db.query(Payment).filter(
                or_(
                    Payment.booking_id.in_(booking_ids),
                    Payment.package_booking_id.in_(booking_ids) # Just in case, though this loop is for regular
                )
            ).all()
            for p in all_payments:
                bid = p.booking_id or p.package_booking_id
                if bid not in payments_map:
                    payments_map[bid] = []
                payments_map[bid].append(p)

        # Pre-load all room types for name resolution (avoids N+1)
        from app.models.room import RoomType
        all_room_types = db.query(RoomType.id, RoomType.name).all()
        room_type_name_map = {rt.id: rt.name for rt in all_room_types}

        # Convert to BookingOut format
        booking_results = []
        for booking in regular_bookings:
            # Handle invalid emails gracefully
            user_obj = None
            # Load user separately to avoid blocking on eager load
            try:
                if hasattr(booking, 'user_id') and booking.user_id:
                    booking_user = db.query(User).filter(User.id == booking.user_id).first()
                else:
                    booking_user = None
            except:
                booking_user = None
            
            if booking_user:
                try:
                    from app.schemas.user import UserOut
                    user_data = booking_user
                    email = user_data.email if hasattr(user_data, "email") else None
                    if email and "@" in email and "." not in email.split("@")[1]:
                        # Fix malformed email by appending .com
                        email = email + ".com"
                    # Load role separately if needed (avoid eager load blocking)
                    role_obj = None
                    try:
                        if hasattr(user_data, 'role_id') and user_data.role_id:
                            from app.models.role import Role
                            role_obj = db.query(Role).filter(Role.id == user_data.role_id).first()
                    except:
                        role_obj = None
                    
                    user_dict = {
                        "id": user_data.id,
                        "name": user_data.name,
                        "email": email,
                        "phone": getattr(user_data, "phone", None),
                        "is_active": getattr(user_data, "is_active", True),
                        "role": role_obj,
                        "branch_id": getattr(user_data, "branch_id", None),
                        "is_superadmin": getattr(user_data, "is_superadmin", False)
                    }
                    user_obj = UserOut.model_validate(user_dict)
                except Exception as e:
                    print(f"Warning: Could not create UserOut for booking {booking.id}: {str(e)}")
                    user_obj = None

            # Resolve room type name
            rt_id = getattr(booking, 'room_type_id', None)
            if not rt_id:
                # Fall back to first assigned room's type
                assigned = booking_rooms_map.get(booking.id, [])
                if assigned:
                    rt_id = getattr(assigned[0], 'room_type_id', None)
            rt_name = room_type_name_map.get(rt_id) if rt_id else None

            booking_out = BookingOut(
                id=booking.id,
                guest_name=booking.guest_name,
                guest_mobile=booking.guest_mobile,
                guest_email=booking.guest_email,
                status=booking.status,
                check_in=booking.check_in,
                check_out=booking.check_out,
                adults=booking.adults,
                children=booking.children,
                id_card_image_url=getattr(booking, 'id_card_image_url', None),
                guest_photo_url=getattr(booking, 'guest_photo_url', None),
                user=user_obj,
                is_package=False,
                total_amount=booking.total_amount or 0.0,
                advance_deposit=booking.advance_deposit or 0.0,
                checked_in_at=booking.checked_in_at,
                checked_out_at=booking.checked_out_at,
                rooms=booking_rooms_map.get(booking.id, []),
                room_type_id=rt_id,
                room_type_name=rt_name,
                room_rate=getattr(booking, 'room_rate', 0.0),
                rate_plan_code=getattr(booking, 'rate_plan_code', None),
                num_rooms=getattr(booking, 'num_rooms', 1) or 1,
                source=getattr(booking, 'source', 'Direct'),
                branch_id=getattr(booking, 'branch_id', None),
                display_id=getattr(booking, 'display_id', None),
                payments=payments_map.get(booking.id, [])
            )
            
            # Fallback: Calculate total amount if 0 (for legacy data)
            if (booking_out.total_amount is None or booking_out.total_amount == 0) and booking.check_in and booking.check_out and booking_out.rooms:
                try:
                    # Calculate duration
                    d_in = booking.check_in
                    d_out = booking.check_out
                    
                    # Handle potential string dates from unexpected sources
                    if isinstance(d_in, str):
                        from datetime import timezone, datetime
                        d_in = datetime.strptime(d_in, '%Y-%m-%d').date()
                    if isinstance(d_out, str):
                        from datetime import timezone, datetime
                        d_out = datetime.strptime(d_out, '%Y-%m-%d').date()
                        
                    stay_days = (d_out - d_in).days
                    stay_nights = max(1, stay_days)
                    
                    room_total = sum(float(r.price or 0) for r in booking_out.rooms)
                    final_amount = room_total * stay_nights

                    # If room_type_id available, try dynamic pricing first
                    if getattr(booking, 'room_type_id', None):
                        room_count = len(booking_out.rooms) or 1
                        try:
                            dyn_price = calculate_dynamic_booking_price(db, booking.room_type_id, d_in, d_out, room_count)
                            if dyn_price > 0:
                                final_amount = dyn_price
                        except:
                            pass
                    
                    if final_amount > 0:
                        booking_out.total_amount = final_amount
                        # Self-healing: Update DB
                        # Note: We need to be careful with commits in GET, but specific updates are okay.
                        # We use a separate update query to avoid messing with the current session state too much.
                        try:
                            # Use core update to avoid session issues
                            from sqlalchemy import update
                            stmt = update(Booking).where(Booking.id == booking.id).values(total_amount=final_amount)
                            db.execute(stmt)
                            db.commit()
                            print(f"Self-healed Booking {booking.id} total_amount to {final_amount}")
                        except Exception as db_e:
                            print(f"Failed to update healed amount to DB: {db_e}")
                            db.rollback()
                            db.commit()
                            print(f"Self-healed Booking {booking.id} total_amount to {final_amount}")
                        except Exception as db_e:
                            print(f"Failed to update healed amount to DB: {db_e}")
                            db.rollback()
                except Exception as e:
                    print(f"Error calculating fallback amount for booking {booking.id}: {str(e)}")
            
            booking_results.append(booking_out)
        
        # Get total count
        total_count = query.count()
        
        return {"total": total_count, "bookings": booking_results}
    except Exception as e:
        print(f"Error fetching bookings: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching bookings: {str(e)}")

# ----------------------------------------------------------------
# GET Detailed view for a SINGLE booking (regular or package)
# This is a more reliable way to get full details for the modal view.
# ----------------------------------------------------------------
# ----------------------------------------------------------------
# HELPERS for Detailed Views
# ----------------------------------------------------------------
def _fetch_extras(db: Session, room_ids: List[int], check_in, check_out):
    if not room_ids:
        return []
    
    # Fetch food orders for these rooms created during the stay
    # We use a permissive date filter (created_at >= check_in)
    # Note: check_out is usually noon, so orders on check_out day before checkout are valid.
    from app.models.foodorder import FoodOrderItem
    query = db.query(FoodOrder).options(
        joinedload(FoodOrder.items).joinedload(FoodOrderItem.food_item)
    ).filter(
        FoodOrder.room_id.in_(room_ids),
        FoodOrder.created_at >= check_in
    )
    # If check_out is provided, filter
    if check_out:
         # Convert date to datetime if needed or just compare date part
         query = query.filter(func.date(FoodOrder.created_at) <= check_out)
         
    orders = query.all()
    
    result = []
    for o in orders:
        items_summary = []
        for i in o.items:
            # Safely access food_item name via relationship or ID
            # Assuming relationship is 'food_item'
            i_name = i.food_item.name if i.food_item else "Unknown Item"
            items_summary.append(f"{i_name} (x{i.quantity})")
            
        result.append({
            "id": o.id,
            "items": items_summary, # Simplified list of strings
            "amount": o.total_with_gst or o.amount,
            "status": o.status,
            "created_at": o.created_at
        })
    return result

def _fetch_services(db: Session, room_ids: List[int], check_in, check_out):
    if not room_ids:
        return []
        
    query = db.query(AssignedService).options(joinedload(AssignedService.service)).filter(
        AssignedService.room_id.in_(room_ids),
        AssignedService.assigned_at >= check_in
    )
    if check_out:
         query = query.filter(func.date(AssignedService.assigned_at) <= check_out)
         
    services = query.all()
    
    return [{
        "id": s.id,
        "service_name": s.service.name if s.service else "Unknown Service",
        "charges": s.service.charges if s.service else 0.0,
        "status": s.status,
        "assigned_at": s.assigned_at,
        "is_rental": (s.service.charges > 0 if s.service else False) or ("rental" in (s.service.name.lower() if s.service else ""))
    } for s in services]

def _fetch_inventory(db: Session, room_ids: List[int], check_in: Union[date, datetime], check_out: Optional[Union[date, datetime]], booking_id: int = None, branch_id: int = None):
    if not room_ids and not booking_id:
        return []
        
    # Get location IDs for rooms
    rooms = db.query(Room).filter(Room.id.in_(room_ids)).all()
    location_ids = [r.inventory_location_id for r in rooms if r.inventory_location_id]
    
    # Aggregation Logic to prevent duplicates
    aggregated = {}

    # 1. Fetch stock issues (Temporary usage/consumables)
    query = (
        db.query(StockIssueDetail)
        .join(StockIssue)
        .join(InventoryItem)
    )
    
    if booking_id:
        query = query.filter(StockIssue.booking_id == booking_id)
        if branch_id is not None:
             query = query.filter(StockIssue.branch_id == branch_id)
    else:
        if not location_ids:
            return []
        query = query.filter(StockIssue.destination_location_id.in_(location_ids))
        if branch_id is not None:
             query = query.filter(StockIssue.branch_id == branch_id)
        query = query.filter(StockIssue.issue_date >= check_in)
        if check_out:
            query = query.filter(func.date(StockIssue.issue_date) <= check_out)

    query = query.options(joinedload(StockIssueDetail.item).joinedload(InventoryItem.category))
    details = query.all()
    
    for d in details:
        key = f"issue_{d.item_id}"
        if key not in aggregated:
            is_fixed = d.item.is_asset_fixed if d.item else False
            aggregated[key] = {
                "item_id": d.item_id,
                "item_name": d.item.name if d.item else "Unknown",
                "quantity": 0.0,
                "complimentary_qty": 0.0,
                "payable_qty": 0.0,
                "unit": d.unit,
                "category": d.item.category.name if d.item and d.item.category else None,
                "issued_at": d.issue.issue_date,
                "is_payable": False,
                "unit_price": d.unit_price or 0.0,
                "is_damaged": d.is_damaged or False,
                "notes": d.damage_notes if d.is_damaged else d.notes,
                "is_asset_fixed": is_fixed,
                "is_consumable": not is_fixed,
                "is_rental": (d.rental_price is not None and d.rental_price > 0),
                "track_laundry_cycle": d.item.track_laundry_cycle if d.item else False,
                "v": 2,
                "type": "asset" if is_fixed else "consumable"
            }
        
        qty = (d.issued_quantity or 0)
        aggregated[key]["quantity"] += qty
        if d.is_payable:
            aggregated[key]["payable_qty"] += qty
            aggregated[key]["is_payable"] = True
        else:
            aggregated[key]["complimentary_qty"] += qty
        if d.is_damaged:
            aggregated[key]["is_damaged"] = True

    # 2. Fetch Fixed Asset Mappings (Permanent fixtures)
    if location_ids:
        mapping_query = db.query(AssetMapping).join(InventoryItem).filter(
            AssetMapping.location_id.in_(location_ids),
            AssetMapping.is_active == True
        )
        if branch_id is not None:
            mapping_query = mapping_query.filter(AssetMapping.branch_id == branch_id)
            
        mappings = mapping_query.options(joinedload(AssetMapping.item).joinedload(InventoryItem.category)).all()
        
        for m in mappings:
            # Avoid duplicate if already in aggregated from StockIssue (unlikely for fixed assets but safe)
            key = f"fixed_{m.item_id}"
            if key not in aggregated:
                is_fixed = m.item.is_asset_fixed if m.item else True
                aggregated[key] = {
                    "item_id": m.item_id,
                    "item_name": m.item.name if m.item else "Unknown Asset",
                    "quantity": m.quantity or 1.0,
                    "complimentary_qty": m.quantity or 1.0,
                    "payable_qty": 0.0,
                    "unit": m.item.unit if m.item else "pcs",
                    "category": m.item.category.name if m.item and m.item.category else "Fixed Asset",
                    "issued_at": m.assigned_date,
                    "is_payable": False,
                    "unit_price": m.item.unit_price if m.item else 0.0,
                    "is_damaged": False,
                    "notes": m.notes,
                    "is_asset_fixed": is_fixed,
                    "is_consumable": not is_fixed,
                    "type": "asset" if is_fixed else "consumable"
                }

    # 3. Fetch Location Stock (Current items in room/location)
    if location_ids:
        stock_query = db.query(LocationStock).join(InventoryItem).filter(
            LocationStock.location_id.in_(location_ids),
            LocationStock.quantity > 0
        )
        if branch_id is not None:
            stock_query = stock_query.filter(LocationStock.branch_id == branch_id)
            
        stocks = stock_query.options(joinedload(LocationStock.item).joinedload(InventoryItem.category)).all()
        
        for s in stocks:
            # Avoid duplication: if item already in aggregated (from AssetMapping or StockIssue), skip it
            item_id = s.item_id
            already_present = any(key.split('_')[-1] == str(item_id) for key in aggregated.keys())
            
            if not already_present:
                is_fixed = s.item.is_asset_fixed if s.item else False
                aggregated[f"stock_{item_id}"] = {
                    "item_id": s.item_id,
                    "item_name": s.item.name if s.item else "Unknown",
                    "quantity": s.quantity,
                    "complimentary_qty": s.quantity,
                    "payable_qty": 0.0,
                    "unit": s.item.unit if s.item else "pcs",
                    "category": s.item.category.name if s.item and s.item.category else None,
                    "issued_at": s.last_updated,
                    "is_payable": False,
                    "unit_price": s.item.unit_price or 0.0,
                    "is_damaged": False,
                    "notes": "Current Location Stock",
                    "is_asset_fixed": is_fixed,
                    "is_consumable": not is_fixed,
                    "type": "asset" if is_fixed else "consumable"
                }

    # Filter out items with zero or negative quantity (returned items)
    return [item for item in aggregated.values() if item["quantity"] > 0]

# ----------------------------------------------------------------
# GET Detailed view for a SINGLE booking (regular or package)
# ----------------------------------------------------------------
@router.get("/details/{booking_id}", response_model=BookingOut)
def get_booking_details(booking_id: Union[str, int], is_package: bool, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), branch_id: int = Depends(get_branch_id)):

    # Parse display ID (BK-000001 or PK-000001) or accept numeric ID
    numeric_id, booking_type = parse_display_id(str(booking_id))
    print(f"[DEBUG-API] get_booking_details for {booking_id} (numeric_id={numeric_id}), branch_id from token={branch_id}")
    if numeric_id is None:
        raise HTTPException(status_code=400, detail=f"Invalid booking ID format: {booking_id}")
    
    if booking_type:
        if booking_type == "package" and not is_package:
            raise HTTPException(status_code=400, detail=f"Booking ID {booking_id} is a package booking, but is_package parameter is False")
        if booking_type == "booking" and is_package:
            raise HTTPException(status_code=400, detail=f"Booking ID {booking_id} is a regular booking, but is_package parameter is True")
    
    booking_id = numeric_id
    
    try:
        if is_package:
            query = db.query(PackageBooking).options(
                joinedload(PackageBooking.rooms).joinedload(PackageBookingRoom.room),
                joinedload(PackageBooking.user),
                joinedload(PackageBooking.package),
                joinedload(PackageBooking.checkouts),
                joinedload(PackageBooking.payments)
            ).filter(PackageBooking.id == booking_id)
            
            if branch_id is not None:
                query = query.filter(PackageBooking.branch_id == branch_id)
                
            booking = query.first()


            if not booking:
                raise HTTPException(status_code=404, detail="Package booking not found")

            # Calc total
            total_amt = 0.0
            # Sum all per-room checkout grand_totals for this booking
            if booking.checkouts:
                total_amt = sum(c.grand_total or 0 for c in booking.checkouts)
            elif booking.status in ['checked_out', 'checked-out', 'checked out']:
                 checkout_recs = db.query(Checkout).filter(Checkout.package_booking_id == booking.id).all()
                 if checkout_recs: total_amt = sum(c.grand_total or 0 for c in checkout_recs)

            room_ids = [r.room_id for r in booking.rooms if r.room_id]
            start_filter = booking.checked_in_at or booking.check_in
            
            return BookingOut(
                id=booking.id,
                guest_name=booking.guest_name,
                guest_mobile=booking.guest_mobile,
                guest_email=booking.guest_email,
                status=booking.status,
                check_in=booking.check_in,
                check_out=booking.check_out,
                adults=booking.adults,
                children=booking.children,
                id_card_image_url=getattr(booking, 'id_card_image_url', None),
                guest_photo_url=getattr(booking, 'guest_photo_url', None),
                user=booking.user,
                is_package=True,
                total_amount=total_amt,
                num_rooms=getattr(booking, 'num_rooms', 1) or 1,
                room_type_id=booking.package.room_types if booking.package else None,
                room_type_name=booking.package.title if booking.package else "Package Details Implied",
                checked_in_at=booking.checked_in_at,
                checked_out_at=booking.checked_out_at,
                # Pass the most recent checkout for display in the dossier
                checkout=booking.checkouts[-1] if booking.checkouts else None,
                rooms=[pbr.room for pbr in booking.rooms if pbr.room],
                food_orders=_fetch_extras(db, room_ids, start_filter, booking.check_out),
                service_requests=_fetch_services(db, room_ids, start_filter, booking.check_out),
                inventory_usage=_fetch_inventory(db, room_ids, start_filter, booking.check_out, booking_id=booking.id, branch_id=booking.branch_id),
                payments=booking.payments
            )
        else: # Regular booking
            query = db.query(Booking).options(
                joinedload(Booking.booking_rooms).joinedload(BookingRoom.room),
                joinedload(Booking.user).joinedload(User.role),
                joinedload(Booking.checkouts),
                joinedload(Booking.room_type),
                joinedload(Booking.payments)
            ).filter(Booking.id == booking_id)
            
            if branch_id is not None:
                query = query.filter(Booking.branch_id == branch_id)
                
            booking = query.first()


            if not booking:
                raise HTTPException(status_code=404, detail="Booking not found")
            
            total_amt = getattr(booking, 'total_amount', 0.0)
            # Sum all per-room checkout grand_totals for this booking
            if booking.checkouts:
                total_amt = sum(c.grand_total or 0 for c in booking.checkouts)
            elif booking.status in ['checked_out', 'checked-out', 'checked out'] and (total_amt is None or total_amt == 0):
                 checkout_recs = db.query(Checkout).filter(Checkout.booking_id == booking.id).all()
                 if checkout_recs: total_amt = sum(c.grand_total or 0 for c in checkout_recs)
            
            # Fallback for active regular bookings without a total (legacy data)
            if (total_amt is None or total_amt == 0) and booking.check_in and booking.check_out and booking.booking_rooms:
                try:
                    # Calculate dates
                    d_in = booking.check_in
                    d_out = booking.check_out
                    
                    if isinstance(d_in, str):
                        from datetime import timezone, datetime
                        d_in = datetime.strptime(d_in, '%Y-%m-%d').date()
                    if isinstance(d_out, str):
                        from datetime import timezone, datetime
                        d_out = datetime.strptime(d_out, '%Y-%m-%d').date()
                        
                    stay_days = (d_out - d_in).days
                    stay_nights = max(1, stay_days)
                    
                    room_total = sum(float(br.room.price or 0) for br in booking.booking_rooms if br.room)
                    calc_amt = room_total * stay_nights

                    if getattr(booking, 'room_type_id', None):
                        room_count = len(booking.booking_rooms) or 1
                        try:
                            dyn_price = calculate_dynamic_booking_price(db, booking.room_type_id, d_in, d_out, room_count)
                            if dyn_price > 0:
                                calc_amt = dyn_price
                        except:
                            pass
                    
                    if calc_amt > 0:
                        total_amt = calc_amt
                        # Update DB 
                        from sqlalchemy import update
                        stmt = update(Booking).where(Booking.id == booking.id).values(total_amount=calc_amt)
                        db.execute(stmt)
                        db.commit()
                except Exception as e:
                    print(f"Error self-healing booking detail {booking.id}: {e}")
            
            room_ids = [r.room_id for r in booking.booking_rooms if r.room_id]
            start_filter = booking.checked_in_at or booking.check_in
            
            # If checked-in, don't cap the end date at theoretical check_out 
            # so that overstays/test-data orders are still visible.
            end_filter = None if booking.status.lower().strip() == 'checked-in' else booking.check_out

            return BookingOut(
                id=booking.id,
                guest_name=booking.guest_name,
                guest_mobile=booking.guest_mobile,
                guest_email=booking.guest_email,
                status=booking.status,
                check_in=booking.check_in,
                check_out=booking.check_out,
                adults=booking.adults,
                children=booking.children,
                id_card_image_url=getattr(booking, 'id_card_image_url', None),
                guest_photo_url=getattr(booking, 'guest_photo_url', None),
                user=booking.user,
                is_package=False,
                total_amount=total_amt,
                num_rooms=getattr(booking, 'num_rooms', 1) or 1,
                room_type_id=getattr(booking, 'room_type_id', None),
                room_type_name=booking.room_type.name if getattr(booking, 'room_type', None) else None,
                advance_deposit=booking.advance_deposit or 0.0,
                room_rate=getattr(booking, 'room_rate', 0.0),
                rate_plan_code=getattr(booking, 'rate_plan_code', None),
                checked_in_at=booking.checked_in_at,
                checked_out_at=booking.checked_out_at,
                # Pass the most recent checkout for display in the dossier
                checkout=booking.checkouts[-1] if booking.checkouts else None,
                rooms=[br.room for br in booking.booking_rooms if br.room],
                food_orders=_fetch_extras(db, room_ids, start_filter, end_filter),
                service_requests=_fetch_services(db, room_ids, start_filter, end_filter),
                inventory_usage=_fetch_inventory(db, room_ids, start_filter, end_filter, booking_id=booking.id, branch_id=booking.branch_id),
                payments=booking.payments
            )
    except Exception as e:
        print(f"Error getting booking details: {e}")
        # Return basic details if list fetching fails, to avoid 500 error on the whole page
        # But for development/debugging, seeing the error is better. 
        # I'll raise it for now.
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------
# Helper function to get or create guest user
# -------------------------------
def get_or_create_guest_user(db: Session, email: str, mobile: str, name: str, branch_id: int):

    """
    Find or create a guest user based on email and mobile number.
    Returns the user_id to link bookings to the same user.
    """
    from app.models.user import User, Role
    import bcrypt
    
    # Normalize empty strings to None for easier handling
    email = email.strip() if email and isinstance(email, str) else None
    mobile = mobile.strip() if mobile and isinstance(mobile, str) else None
    name = name.strip() if name and isinstance(name, str) else "Guest User"
    
    # Need at least one identifier (email or mobile)
    if not email and not mobile:
        raise ValueError("Either email or mobile number must be provided")
    
    # First, try to find user by email (most reliable identifier)
    user = None
    if email:
        user = db.query(User).filter(User.email == email, User.branch_id == branch_id).first()

    
    # If not found by email, try by mobile/phone
    if not user and mobile:
        user = db.query(User).filter(User.phone == mobile, User.branch_id == branch_id).first()

    
    # If user exists, return the user_id
    if user:
        # Update name if provided and different (Only for guests, do NOT overwrite staff/admin names)
        if name and user.name != name:
            role_obj = db.query(Role).filter(Role.id == user.role_id).first()
            if role_obj and role_obj.name == "guest":
                user.name = name
                db.commit()
        return user.id
    
    # If user doesn't exist, create a new guest user
    try:
        # First, ensure 'guest' role exists
        guest_role = db.query(Role).filter(Role.name == "guest").first()
        if not guest_role:
            # Create guest role if it doesn't exist
            guest_role = Role(name="guest", permissions="[]")
            db.add(guest_role)
            db.commit()
            db.refresh(guest_role)
        
        # Generate a placeholder password for guest users (they won't log in)
        password_bytes = "guest_user_no_password".encode("utf-8")
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password_bytes, salt).decode("utf-8")
        
        # Create email if not provided (use mobile-based email or generate unique one)
        if not email:
            if mobile:
                user_email = f"guest_{mobile}@temp.com"
            else:
                # Generate a unique email based on timestamp
                import time
                user_email = f"guest_{int(time.time())}@temp.com"
        else:
            user_email = email
        
        # Check if email already exists (race condition check)
        existing_user = db.query(User).filter(User.email == user_email).first()
        if existing_user:
            # User was created between our check and creation attempt
            return existing_user.id
        
        # Create new guest user
        new_user = User(
            name=name,
            email=user_email,
            phone=mobile if mobile else None,
            hashed_password=hashed_password,
            role_id=guest_role.id,
            is_active=True,
            branch_id=branch_id
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user.id
    except Exception as e:
        # If user creation fails due to unique constraint or other DB error, try to find existing user
        db.rollback()  # Rollback the failed transaction
        if email:
            existing_user = db.query(User).filter(User.email == email).first()
            if existing_user:
                return existing_user.id
        if mobile:
            existing_user = db.query(User).filter(User.phone == mobile).first()
            if existing_user:
                return existing_user.id
        # Re-raise if we can't find existing user
        raise ValueError(f"Failed to create or find guest user: {str(e)}")

from pydantic import BaseModel
from datetime import date
from app.utils.date_utils import get_ist_today
from typing import List

class PriceCalculationRequest(BaseModel):
    room_type_id: int
    check_in: date
    check_out: date
    room_count: int = 1

@router.post("/calculate-price", summary="Calculate dynamic booking price")
def calculate_price_api(request: PriceCalculationRequest, db: Session = Depends(get_db)):
    try:
        total = calculate_dynamic_booking_price(db, request.room_type_id, request.check_in, request.check_out, request.room_count)
        return {"total_amount": total}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error calculating price: {str(e)}")

# -------------------------------
# POST a new booking
# -------------------------------
@router.post("", response_model=BookingOut)
def create_booking(
    booking: BookingCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user), 
    branch_id: int = Depends(get_branch_id),
    *,
    background_tasks: BackgroundTasks
):

    print(f"DEBUG: create_booking called with: {booking}")
    
    # Need at least one of room_ids or room_type_id
    if not booking.room_ids and not booking.room_type_id:
        raise HTTPException(status_code=400, detail="You must provide either room_ids or room_type_id.")

    # Find or create guest user based on email and mobile
    guest_user_id = None
    try:
        guest_email = booking.guest_email.strip() if (booking.guest_email and isinstance(booking.guest_email, str) and booking.guest_email.strip()) else None
    except (AttributeError, TypeError):
        guest_email = None
    
    try:
        guest_mobile = booking.guest_mobile.strip() if (booking.guest_mobile and isinstance(booking.guest_mobile, str) and booking.guest_mobile.strip()) else None
    except (AttributeError, TypeError):
        guest_mobile = None
    
    if guest_email or guest_mobile:
        try:
            guest_user_id = get_or_create_guest_user(
                db=db,
                email=guest_email,
                mobile=guest_mobile,
                name=booking.guest_name or "Guest User",
                branch_id=branch_id
            )
        except Exception as e:
            print(f"Warning: Could not create/link guest user: {str(e)}")
    
    from app.models.room import RoomType
    
    from app.models.Package import Package, PackageBooking, PackageBookingRoom
    active_statuses = ["booked", "checked-in", "checked_in", "confirmed", "occupied"]

    # 1. SOFT ALLOCATION LOGIC (Booking by Type)
    if booking.room_type_id and not booking.room_ids:
        # Fetch Room Type (support Enterprise View where branch_id might be None)
        print(f"[DEBUG] Soft Allocation: room_type_id={booking.room_type_id}, initial_branch_id={branch_id}")
        query = db.query(RoomType).filter(RoomType.id == booking.room_type_id)
        if branch_id is not None:
            query = query.filter(RoomType.branch_id == branch_id)
        room_type = query.first()

        if not room_type:
            print(f"[DEBUG] Room Type NOT FOUND for ID {booking.room_type_id} and Branch {branch_id}")
            raise HTTPException(status_code=404, detail="Room Type not found")
        
        # Correct the branch_id if it was None (Superadmin context)
        if branch_id is None:
            branch_id = room_type.branch_id
            print(f"[DEBUG] Enterprise View: adopted branch_id={branch_id} from RoomType")

        # Check if an active Whole Property Package booking blocks the property
        whole_prop_conflict = db.query(PackageBooking).join(Package).filter(
            PackageBooking.branch_id == branch_id,
            func.lower(PackageBooking.status).in_(active_statuses),
            PackageBooking.check_in < booking.check_out,
            PackageBooking.check_out > booking.check_in,
            Package.booking_type == "whole_property"
        ).first()
        if whole_prop_conflict:
            raise HTTPException(
                status_code=400,
                detail="The property is fully booked under a Whole Property package for the selected dates."
            )
        
        # Validate Capacity based on number of rooms requested
        num_rooms_requested = booking.num_rooms or 1
        max_adults = (room_type.adults_capacity or 0) * num_rooms_requested
        max_children = (room_type.children_capacity or 0) * num_rooms_requested
        
        if booking.adults > max_adults:
            raise HTTPException(status_code=400, detail=f"Adults exceed capacity ({max_adults})")
        if room_type.children_capacity is not None and room_type.children_capacity > 0:
            if booking.children > max_children:
                raise HTTPException(status_code=400, detail=f"Children exceed capacity ({max_children})")
            
        # Check Availability by Counting
        total_rooms = db.query(Room).filter(Room.room_type_id == room_type.id, Room.branch_id == branch_id, Room.status.notin_(["Deleted", "Maintenance", "Out of Order"])).count()
        
        # Determine capacity based on source
        # Online bookings (User End, OTA) strictly respect Online Inventory limit if set.
        # Dashboard/Admin bookings can use all physical rooms.
        online_sources = ["guest", "userend", "website", "ota", "booking.com", "expedia", "agoda"]
        current_source = (booking.source or "").lower().replace(" ", "")
        is_online = any(s in current_source for s in online_sources)
        
        if is_online:
            if room_type.online_inventory is not None:
                capacity = room_type.online_inventory
            else:
                capacity = room_type.total_inventory or total_rooms
        else:
            # Dashboard/Direct bookings use the total physical room capacity
            capacity = max(total_rooms, room_type.total_inventory or 0)
        
        # Count 1: Physical assignments of this room type (Regular bookings)
        assigned_overlaps = db.query(BookingRoom).join(Booking).join(Room).filter(
            Room.room_type_id == room_type.id,
            Booking.branch_id == branch_id,
            func.lower(Booking.status).in_(active_statuses),
            Booking.check_in < booking.check_out,
            Booking.check_out > booking.check_in
        ).count()

        # Count 2: Physical assignments of this room type (Package bookings)
        pkg_assigned_overlaps = db.query(PackageBookingRoom).join(PackageBooking).join(Room).filter(
            Room.room_type_id == room_type.id,
            PackageBooking.branch_id == branch_id,
            func.lower(PackageBooking.status).in_(active_statuses),
            PackageBooking.check_in < booking.check_out,
            PackageBooking.check_out > booking.check_in
        ).count()
        
        # Count 3: Soft allocations (by type) that don't have physical rooms yet
        from sqlalchemy import func
        soft_overlaps_sum = db.query(func.sum(Booking.num_rooms)).filter(
            Booking.room_type_id == room_type.id,
            Booking.branch_id == branch_id,
            func.lower(Booking.status).in_(active_statuses),
            Booking.check_in < booking.check_out,
            Booking.check_out > booking.check_in,
            ~Booking.booking_rooms.any() # No assigned rooms
        ).scalar()
        soft_overlaps = int(soft_overlaps_sum) if soft_overlaps_sum else 0
        
        effective_overlaps = assigned_overlaps + pkg_assigned_overlaps + soft_overlaps
        rooms_requested = booking.num_rooms or 1

        if (effective_overlaps + rooms_requested) > capacity:
            raise HTTPException(status_code=400, detail=f"No rooms of type '{room_type.name}' available for selected dates (Available: {max(0, capacity - effective_overlaps)}, Requested: {rooms_requested}).")

        num_rooms_val = booking.num_rooms or 1
        nights = max(1, (booking.check_out - booking.check_in).days)
        # Distribute the total manually set amount across all rooms and nights
        stored_room_rate = (booking.custom_room_rate / (num_rooms_val * nights)) if (booking.custom_room_rate and booking.custom_room_rate > 0) else 0.0

        db_booking = Booking(
            guest_name=booking.guest_name,
            guest_mobile=booking.guest_mobile,
            guest_email=booking.guest_email,
            check_in=booking.check_in,
            check_out=booking.check_out,
            adults=booking.adults,
            children=booking.children,
            room_type_id=booking.room_type_id,
            source=booking.source,
            external_id=booking.external_id,
            user_id=guest_user_id,
            branch_id=branch_id,
            status="Booked",
            num_rooms=num_rooms_val,
            room_rate=stored_room_rate,
            total_amount=booking.custom_room_rate if booking.custom_room_rate else 0.0,
            pan_number=booking.pan_number,
            gst_number=booking.gst_number
        )
        
        db.add(db_booking)
        db.commit()
        db.refresh(db_booking)
        
    # 2. DIRECT ALLOCATION LOGIC (Booking specific rooms)
    else:
        selected_rooms = db.query(Room).filter(Room.id.in_(booking.room_ids), Room.branch_id == branch_id).all()
        if len(selected_rooms) != len(booking.room_ids):
            raise HTTPException(status_code=400, detail="One or more selected rooms are invalid.")

        # If branch_id was None, derive it from selected_rooms
        if branch_id is None and selected_rooms:
            branch_id = selected_rooms[0].branch_id

        # Check if an active Whole Property Package booking blocks the property
        whole_prop_conflict = db.query(PackageBooking).join(Package).filter(
            PackageBooking.branch_id == branch_id,
            func.lower(PackageBooking.status).in_(active_statuses),
            PackageBooking.check_in < booking.check_out,
            PackageBooking.check_out > booking.check_in,
            Package.booking_type == "whole_property"
        ).first()
        if whole_prop_conflict:
            raise HTTPException(
                status_code=400,
                detail="The property is fully booked under a Whole Property package for the selected dates."
            )
        
        # Capacity check requires fetching RoomType for each room
        total_adults = 0
        total_children = 0
        num_rooms = booking.num_rooms or len(selected_rooms)
        for r in selected_rooms:
            rt = db.query(RoomType).filter(RoomType.id == r.room_type_id).first()
            if rt:
                total_adults += (rt.adults_capacity or 2)
                total_children += (rt.children_capacity or 0)
        # If num_rooms > number of distinct selected rooms (same type booked multiple times),
        # scale capacity proportionally
        if num_rooms > len(selected_rooms) and len(selected_rooms) > 0:
            scale = num_rooms / len(selected_rooms)
            total_adults = int(total_adults * scale)
            total_children = int(total_children * scale)

        if booking.adults > total_adults or booking.children > total_children:
            raise HTTPException(status_code=400, detail=f"Total guest count exceeds selected room capacity (max {total_adults} adults, {total_children} children).")

        # Availability check for each requested room
        for room_id in booking.room_ids:
            conflict = db.query(BookingRoom).join(Booking).filter(
                BookingRoom.room_id == room_id,
                Booking.branch_id == branch_id,
                func.lower(Booking.status).in_(active_statuses),
                Booking.check_in < booking.check_out,
                Booking.check_out > booking.check_in
            ).first()

            pkg_conflict = db.query(PackageBookingRoom).join(PackageBooking).filter(
                PackageBookingRoom.room_id == room_id,
                PackageBooking.branch_id == branch_id,
                func.lower(PackageBooking.status).in_(active_statuses),
                PackageBooking.check_in < booking.check_out,
                PackageBooking.check_out > booking.check_in
            ).first()

            if conflict or pkg_conflict:
                room = next((r for r in selected_rooms if r.id == room_id), None)
                raise HTTPException(status_code=400, detail=f"Room {room.number if room else room_id} is unavailable for the selected dates.")

        # Check that selecting these rooms does not exhaust capacity reserved by unassigned soft-allocations
        type_requested_counts = {}
        for r in selected_rooms:
            if r.room_type_id:
                type_requested_counts[r.room_type_id] = type_requested_counts.get(r.room_type_id, 0) + 1

        for r_type_id, req_count in type_requested_counts.items():
            total_type_rooms = db.query(Room).filter(Room.room_type_id == r_type_id, Room.branch_id == branch_id).count()
            assigned_reg = db.query(BookingRoom).join(Booking).join(Room).filter(
                Room.room_type_id == r_type_id,
                Booking.branch_id == branch_id,
                func.lower(Booking.status).in_(active_statuses),
                Booking.check_in < booking.check_out,
                Booking.check_out > booking.check_in
            ).count()
            assigned_pkg = db.query(PackageBookingRoom).join(PackageBooking).join(Room).filter(
                Room.room_type_id == r_type_id,
                PackageBooking.branch_id == branch_id,
                func.lower(PackageBooking.status).in_(active_statuses),
                PackageBooking.check_in < booking.check_out,
                PackageBooking.check_out > booking.check_in
            ).count()
            soft_sum = db.query(func.sum(Booking.num_rooms)).filter(
                Booking.room_type_id == r_type_id,
                Booking.branch_id == branch_id,
                func.lower(Booking.status).in_(active_statuses),
                Booking.check_in < booking.check_out,
                Booking.check_out > booking.check_in,
                ~Booking.booking_rooms.any()
            ).scalar()
            soft_count = int(soft_sum) if soft_sum else 0

            avail_capacity = total_type_rooms - (assigned_reg + assigned_pkg + soft_count)
            if req_count > avail_capacity:
                rt = db.query(RoomType).filter(RoomType.id == r_type_id).first()
                rt_name = rt.name if rt else f"Type {r_type_id}"
                raise HTTPException(
                    status_code=400,
                    detail=f"No rooms available for room type '{rt_name}' for selected dates (Available: {max(0, avail_capacity)}, Requested: {req_count})."
                )

        num_rooms_val = num_rooms
        nights = max(1, (booking.check_out - booking.check_in).days)
        # Store the base room rate per night per room
        stored_room_rate = (booking.custom_room_rate / (num_rooms_val * nights)) if (booking.custom_room_rate and booking.custom_room_rate > 0) else 0.0

        db_booking = Booking(
            guest_name=booking.guest_name,
            guest_mobile=booking.guest_mobile,
            guest_email=booking.guest_email,
            check_in=booking.check_in,
            check_out=booking.check_out,
            adults=booking.adults,
            children=booking.children,
            source=booking.source,
            external_id=booking.external_id,
            user_id=guest_user_id,
            branch_id=branch_id,
            status="Booked",
            num_rooms=num_rooms_val,
            room_rate=stored_room_rate,
            total_amount=booking.custom_room_rate if booking.custom_room_rate else 0.0,
            pan_number=booking.pan_number,
            gst_number=booking.gst_number
        )
        # Use first room's type as primary type if none provided
        if not db_booking.room_type_id and selected_rooms:
            db_booking.room_type_id = selected_rooms[0].room_type_id

        db.add(db_booking)
        db.commit()
        db.refresh(db_booking)

        # Create links
        for room_id in booking.room_ids:
            db.add(BookingRoom(booking_id=db_booking.id, room_id=room_id, branch_id=branch_id))
            room = db.query(Room).filter(Room.id == room_id).first()
            if room: room.status = "Booked"
        
        db.commit()
    
    # Generate Display ID
    db_booking.display_id = format_display_id(db_booking.id, branch_id=branch_id)
    db.commit()
    db.refresh(db_booking)
    
    # Reload for response
    booking_full = db.query(Booking).options(
        joinedload(Booking.booking_rooms).joinedload(BookingRoom.room),
        joinedload(Booking.user)
    ).filter(Booking.id == db_booking.id).first()

    # Calculate amount (using custom price if provided, else prices from RoomType dynamically)
    total_amt = 0.0
    try:
        room_count = len(booking_full.booking_rooms) or booking_full.num_rooms or 1
        nights = max(1, (booking_full.check_out - booking_full.check_in).days)
        base_amt = 0.0

        if booking.custom_room_rate and booking.custom_room_rate > 0:
            # Custom rate is treated as "Base Room Charges"
            base_amt = booking.custom_room_rate
        elif booking_full.room_type_id and booking_full.check_in and booking_full.check_out:
            base_amt = calculate_dynamic_booking_price(db, booking_full.room_type_id, booking_full.check_in, booking_full.check_out, room_count)

        # Check if actually inclusive
        from app.utils.settings_helpers import get_gst_settings
        gst_settings = get_gst_settings(db, branch_id)
        is_inclusive_global = gst_settings.get("gst_inclusive", False)

        # Calculate GST
        gst_data = calculate_gst_breakdown(
            db=db,
            branch_id=branch_id,
            room_charges=base_amt,
            food_charges=0,
            package_charges=0,
            nights=nights * room_count, # Pass total room nights so daily slab is calculated correctly per room
            is_inclusive=is_inclusive_global
        )
        if gst_settings.get("gst_inclusive", False):
            # If inclusive, base_amt IS the total. Keep room_rate inclusive of tax for checkout math
            total_amt = base_amt
            booking_full.room_rate = base_amt / (nights * room_count)
        else:
            total_amt = base_amt + gst_data["total_gst"]
            booking_full.room_rate = base_amt / (nights * room_count)

    except Exception as e:
        print(f"Error calculating dynamic price for booking {booking_full.id}: {e}")
    
    booking_full.total_amount = total_amt
    db.commit()
    db.commit()
    
    if background_tasks and booking_full.room_type_id:
        try:
            from app.core.aiosell_triggers import trigger_inventory_push
            background_tasks.add_task(trigger_inventory_push, booking_full.room_type_id)
        except Exception as e:
            print(f"Failed to queue Aiosell inventory push: {e}")

    try:
        from app.utils.email import send_email, create_booking_confirmation_email
        
        rooms_data = [{"number": br.room.number, "type": br.room.room_type.name if br.room and br.room.room_type else "Room", "price": br.room.room_type.price if br.room and br.room.room_type else 0} for br in booking_full.booking_rooms] if hasattr(booking_full, 'booking_rooms') and booking_full.booking_rooms else []
        
        email_html = create_booking_confirmation_email(
            guest_name=booking_full.guest_name,
            booking_id=booking_full.id,
            booking_type='room',
            check_in=str(booking_full.check_in),
            check_out=str(booking_full.check_out),
            rooms=rooms_data,
            total_amount=total_amt,
            guests={'adults': booking_full.adults, 'children': booking_full.children},
            guest_mobile=booking_full.guest_mobile,
            room_charges=total_amt
        )
        formatted_booking_id = format_display_id(booking_full.id, branch_id=branch_id)
        
        # Send confirmation email to guest if guest email is provided
        if booking_full.guest_email:
            send_email(
                to_email=booking_full.guest_email,
                subject=f"Booking Confirmation {formatted_booking_id} - Stayone Hospitality",
                html_content=email_html,
                to_name=booking_full.guest_name
            )

        # Notify admin
        send_email(
            to_email="info@stayone.com",
            subject=f"New Room Booking: {formatted_booking_id}",
            html_content=email_html,
            cc="orchidresort@gmail.com"
        )
    except Exception as e:
        print(f"Failed to send booking notification email: {str(e)}")

    return booking_full

@router.post("/guest", response_model=BookingOut, summary="Create a booking enquiry as a guest")
def create_guest_booking(booking: BookingCreate, background_tasks: BackgroundTasks = None, db: Session = Depends(get_db), branch_id_query: int = Query(1, alias="branch_id")):
    try:
        # Guest bookings are treated as enquiries (status=pending).
        # Room inventory is only affected when admin/staff confirms the booking.
        booking.branch_id = booking.branch_id if booking.branch_id is not None else branch_id_query
        booking.source = "Guest"
        result = create_booking(booking, background_tasks=background_tasks, db=db, current_user=None, branch_id=booking.branch_id)
        
        # Downgrade status to 'pending' — this is an enquiry, not a confirmed booking.
        # Room inventory is NOT affected until admin/staff confirms via the confirm endpoint.
        downgrade_query = db.query(Booking).filter(Booking.id == result.id)
        db_booking = downgrade_query.first()
        if db_booking and db_booking.status.lower() != "pending":
            db_booking.status = "pending"
            db.commit()
            db.refresh(db_booking)
            return db_booking
        return result
    except HTTPException:
        # Re-raise HTTP exceptions (like validation errors) as-is
        raise
    except Exception as e:
        # Log the full error for debugging
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error in create_guest_booking: {str(e)}")
        print(f"Traceback: {error_trace}")
        
        # Return a user-friendly error message
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while creating booking: {str(e)}"
        )

# -------------------------------
# Check-in a booking
# -------------------------------
@router.put("/{booking_id}/check-in", response_model=BookingOut)
def check_in_booking(
    booking_id: Union[str, int],
    id_card_image: Optional[UploadFile] = File(None),
    guest_photo: Optional[UploadFile] = File(None),
    room_ids: Optional[str] = Form(None), # JSON list of room IDs for assignment
    amenityAllocation: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id),
    *,
    background_tasks: BackgroundTasks
):
    print(f"[DEBUG] REGULAR CHECK-IN REQUEST: Booking ID: {booking_id}")
    print(f"[DEBUG] Amenity Allocation: {amenityAllocation}")

    # Parse display ID (BK-000001) or accept numeric ID
    numeric_id, booking_type = parse_display_id(str(booking_id))
    if numeric_id is None:
        raise HTTPException(status_code=400, detail=f"Invalid booking ID format: {booking_id}")
    if booking_type and booking_type != "booking":
        raise HTTPException(status_code=400, detail=f"Invalid booking type. Expected regular booking, got: {booking_id}")
    booking_id = numeric_id
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Handle room assignment for "Soft Allocated" bookings if room_ids are provided
    if room_ids:
        try:
            import json
            id_list = json.loads(room_ids)
            if id_list:
                print(f"[DEBUG] Assigning rooms {id_list} to booking {booking.id}")
                from app.models.room import Room
                from app.models.booking import BookingRoom as BR, Booking as B
                
                # Check for existing assignments to avoid duplicates
                existing_room_ids = {br.room_id for br in booking.booking_rooms}
                
                for r_id in id_list:
                    if r_id not in existing_room_ids:
                        target_room = db.query(Room).filter(Room.id == r_id).first()
                        if not target_room:
                             raise HTTPException(status_code=404, detail=f"Room ID {r_id} not found")
                        
                        # Availability Guard: Check if room is already booked by someone else for these dates
                        # (Already imported BR, B above)
                        from app.models.Package import PackageBooking, PackageBookingRoom
                        active_check_statuses = ["booked", "checked-in", "checked_in", "confirmed", "occupied"]

                        conflict = db.query(BR).join(B).filter(
                            BR.room_id == r_id,
                            func.lower(B.status).in_(active_check_statuses),
                            B.id != booking.id, # Exclude current booking
                            B.check_in < booking.check_out,
                            B.check_out > booking.check_in
                        ).first()

                        pkg_conflict = db.query(PackageBookingRoom).join(PackageBooking).filter(
                            PackageBookingRoom.room_id == r_id,
                            func.lower(PackageBooking.status).in_(active_check_statuses),
                            PackageBooking.check_in < booking.check_out,
                            PackageBooking.check_out > booking.check_in
                        ).first()
                        
                        if conflict or pkg_conflict:
                            raise HTTPException(status_code=400, detail=f"Room {target_room.number} is already booked for these dates.")

                        # Resolve branch_id from room if in enterprise mode
                        effective_branch_id = branch_id if branch_id is not None else target_room.branch_id
                        
                        new_br = BookingRoom(booking_id=booking.id, room_id=r_id, branch_id=effective_branch_id)
                        db.add(new_br)
                
                db.flush()
                db.refresh(booking)
        except Exception as e:
             print(f"[ERROR] Room assignment failed: {e}")
             db.rollback()
             raise HTTPException(status_code=400, detail=f"Failed to assign rooms: {str(e)}")

    # Normalize status cross-platform
    normalized_status = (booking.status or "").strip().lower().replace("_", "-").replace(" ", "-")
    if normalized_status != "booked":
        raise HTTPException(status_code=400, detail=f"Booking is not in 'booked' state. Current status: {booking.status}")

    # PROCESS AMENITY ALLOCATION / SCHEDULED ORDERS FOR REGULAR BOOKINGS TOO
    if amenityAllocation:
        try:
            import json
            from app.models.foodorder import FoodOrder, FoodOrderItem
            from app.models.food_item import FoodItem
            from datetime import timezone, datetime, timedelta, date, time
            
            alloc_data = json.loads(amenityAllocation)
            items = alloc_data.get("items", [])
            
            # Find first room ID
            room_id = None
            if booking.booking_rooms and len(booking.booking_rooms) > 0:
                room_id = booking.booking_rooms[0].room_id
            
            if items and room_id:
                check_in_date = get_ist_today().date()
                
                for item in items:
                    name = item.get("name")
                    scheduled_time = item.get("scheduledTime")
                    scheduled_date_str = item.get("scheduledDate")
                    
                    if name and scheduled_time:
                        try:
                             scheduled_time = scheduled_time.strip()
                             # Handle time format with simple heuristics
                             if " " in scheduled_time:
                                 try:
                                     t = datetime.strptime(scheduled_time, "%I:%M %p")
                                     sh, sm = t.hour, t.minute
                                 except ValueError:
                                     sh, sm = map(int, scheduled_time.split(":")[:2])
                             else:
                                 sh, sm = map(int, scheduled_time.split(":")[:2])
                                 
                             if scheduled_date_str:
                                 s_year, s_month, s_day = map(int, scheduled_date_str.split("-"))
                                 scheduled_dt = datetime(s_year, s_month, s_day, sh, sm)
                             else:
                                 now = get_ist_now()
                                 scheduled_dt = datetime.combine(check_in_date, time(sh, sm))
                                 if scheduled_dt < now:
                                     scheduled_dt = scheduled_dt + timedelta(days=1)
                             
                             schedule_str = scheduled_dt.strftime("%Y-%m-%d %H:%M:%S")
                             
                             food_item = db.query(FoodItem).filter(FoodItem.name.ilike(name)).first()
                             
                             # Build items list
                             items_to_add = []
                             specific_items = item.get("specificFoodItems", [])
                             
                             if specific_items and len(specific_items) > 0:
                                 for spec_item in specific_items:
                                     f_id = spec_item.get("foodItemId")
                                     qty = spec_item.get("quantity", 1)
                                     if f_id:
                                         items_to_add.append(FoodOrderItemCreate(food_item_id=int(f_id), quantity=int(qty)))
                             
                             # Fallback: find by name if no specific items
                             if not items_to_add:
                                 # Try direct match
                                 found_item = db.query(FoodItem).filter(FoodItem.name.ilike(name)).first()
                                 
                                 # Improved matching for common package meals
                                 if not found_item:
                                     if "breakfast" in name.lower():
                                         found_item = db.query(FoodItem).filter(FoodItem.name.ilike("%breakfast%")).first()
                                     elif "lunch" in name.lower():
                                         found_item = db.query(FoodItem).filter(FoodItem.name.ilike("%lunch%")).first()
                                     elif "dinner" in name.lower():
                                         found_item = db.query(FoodItem).filter(FoodItem.name.ilike("%dinner%")).first()
                                     elif "tea" in name.lower() or "snack" in name.lower():
                                         found_item = db.query(FoodItem).filter(FoodItem.name.ilike("%tea%") | FoodItem.name.ilike("%snack%")).first()
                             
                                 if found_item:
                                     qty = item.get("complimentaryPerNight", 1)
                                     items_to_add.append(FoodOrderItemCreate(food_item_id=found_item.id, quantity=int(qty)))
                             
                                 # Create the order via CRUD to ensure ServiceRequest is created
                                 assigned_emp_id = item.get("assigned_employee_id")
                                 if not assigned_emp_id:
                                     assigned_emp_id = get_fallback_employee_id(db, current_user.employee.id if current_user.employee else None)
                                 
                                 order_data = FoodOrderCreate(
                                     room_id=room_id,
                                     amount=0.0,
                                     assigned_employee_id=int(assigned_emp_id) if assigned_emp_id else None,
                                     items=items_to_add,
                                     status="scheduled",
                                     billing_status="unbilled",
                                     order_type="room_service",
                                     delivery_request=f"SCHEDULED_FOR: {schedule_str} -- Package Meal: {name}"
                                 )
                                 
                                 new_order = crud_food_order.create_food_order(db, order_data)
                                 print(f"[DEBUG] REGULAR: Created scheduled order {new_order.id} via CRUD")
                        except Exception as e:
                            print(f"Error creating scheduled order for {name}: {e}")
                            
        except Exception as e:
            print(f"Error processing amenity allocation in regular check-in: {e}")

    # CRITICAL: Check if any of the rooms are ALREADY occupied (Checked-in) by another booking
    # This prevents double check-ins for the same room
    if booking.booking_rooms:
        room_ids = [br.room_id for br in booking.booking_rooms]
        occupied_rooms = db.query(Room).filter(
            Room.id.in_(room_ids),
            # Check for strings indicating occupancy, case-insensitive
            or_(
                func.lower(Room.status) == 'checked-in',
                func.lower(Room.status) == 'occupied'
            )
        ).all()
        
        if occupied_rooms:
            # Check if the occupied room is actually occupied by THIS booking (unlikely if status was 'booked', but safe check)
            # Actually, we just verified booking.status == 'booked'. So it can't be occupied by this booking.
            if len(occupied_rooms) > 0:
                 occupied_numbers = ", ".join([str(r.number) for r in occupied_rooms])
                 print(f"WARNING: Prevented check-in due to occupied status for rooms: {occupied_numbers}")
                 raise HTTPException(
                     status_code=400, 
                     detail=f"Cannot check-in. The following room(s) are currently marked as Checked-in/Occupied: {occupied_numbers}. Please check-out the previous guest first."
                 )

    # Save ID card image (if provided)
    if id_card_image:
        id_card_filename = f"id_{booking_id}_{uuid.uuid4().hex}.jpg"
        id_card_path = os.path.join(UPLOAD_DIR, id_card_filename)
        with open(id_card_path, "wb") as buffer:
            shutil.copyfileobj(id_card_image.file, buffer)
        booking.id_card_image_url = id_card_filename

    # Save guest photo (if provided)
    if guest_photo:
        guest_photo_filename = f"guest_{booking_id}_{uuid.uuid4().hex}.jpg"
        guest_photo_path = os.path.join(UPLOAD_DIR, guest_photo_filename)
        with open(guest_photo_path, "wb") as buffer:
            shutil.copyfileobj(guest_photo.file, buffer)
        booking.guest_photo_url = guest_photo_filename

    booking.status = "checked-in"
    # Set the actual check-in timestamp for strict bill scoping
    from datetime import timezone, datetime
    booking.checked_in_at = datetime.now(timezone.utc)

    # Save the ID of the user who performed the check-in
    booking.user_id = current_user.id

    # CRITICAL FIX: Update the status of the associated rooms to 'Checked-in'
    if booking.booking_rooms:
        room_ids = [br.room_id for br in booking.booking_rooms]
        db.query(Room).filter(Room.id.in_(room_ids)).update({"status": "Checked-in"}, synchronize_session=False)
        db.flush()  # Ensure room status update is persisted immediately
        print(f"[CHECK-IN] Updated room status to 'Checked-in' for room IDs: {room_ids}")

    # Create notification for check-in
    try:
        from app.models.notification import Notification
        # Get room numbers for notification
        room_numbers = ", ".join([f"#{br.room.number}" for br in booking.booking_rooms if br.room])
        formatted_booking_id = format_display_id(booking_id, branch_id=branch_id)
        
        notification = Notification(
            recipient_id=current_user.id,
            branch_id=branch_id,
            title=f"Guest Checked In - {formatted_booking_id}",
            message=f"Guest {booking.guest_name} has successfully checked in. Booking ID: {formatted_booking_id}, Room(s): {room_numbers}",
            type="check_in",
            reference_id=booking_id,
            reference_type="booking",
            is_read=False,
            created_at=datetime.now(timezone.utc)
        )
        db.add(notification)
    except Exception as e:
        # Log error but don't fail the check-in
        print(f"Warning: Failed to create check-in notification: {str(e)}")

    # Process Amenity Allocation (Stock Issue)
    if amenityAllocation:
        try:
            # Use a savepoint to ensure amenity errors don't crash the whole check-in
            with db.begin_nested():
                import json
                amenity_data = json.loads(amenityAllocation)
                
                # If items exist
                if amenity_data and "items" in amenity_data and len(amenity_data["items"]) > 0:
                    # We need to issue stock to the room(s)
                    
                    for br in booking.booking_rooms:
                        room = br.room
                        if not room or not room.inventory_location_id:
                            continue # Skip if no inventory location
                            
                        # Create Stock Issue Header
                        from app.models.inventory import StockIssue, StockIssueDetail, LocationStock
                        
                        # Find Warehouse (Source) - uppercase to match DB ENUM
                        warehouse = db.query(Location).filter(Location.location_type == "WAREHOUSE").first()
                        source_id = warehouse.id if warehouse else None
                        
                        if not source_id:
                            print("Warning: No Warehouse found for amenity stock issue.")
                            continue

                        # Create Issue Record
                        formatted_booking_id = format_display_id(booking_id, branch_id=branch_id)
                        stock_issue = StockIssue(
                            source_location_id=source_id,
                            destination_location_id=room.inventory_location_id,
                            issue_date=datetime.now(timezone.utc),
                            status="approved", # Auto-approve system issues
                            issued_by_id=current_user.id,
                            reference_number=f"CHK-IN-{booking_id}-{room.number}",
                            notes=f"Automatic Amenity Issue for Check-in {formatted_booking_id}",
                            booking_id=booking.id,
                            guest_id=booking.user_id
                        )
                        db.add(stock_issue)
                        db.flush() # Get ID
                        
                        # Process Items
                        for item in amenity_data["items"]:
                            item_id = item.get("item_id")
                            if not item_id: continue
                            
                            # Calculate Total Quantity to Issue
                            qty_per_night = float(item.get("complimentaryPerNight", 0))
                            qty_per_stay = float(item.get("complimentaryPerStay", 0))
                            
                            # Stay duration
                            from datetime import timezone, date
                            check_in_dt = booking.check_in if isinstance(booking.check_in, date) else datetime.strptime(str(booking.check_in), '%Y-%m-%d').date()
                            check_out_dt = booking.check_out if isinstance(booking.check_out, date) else datetime.strptime(str(booking.check_out), '%Y-%m-%d').date()
                            nights = max(1, (check_out_dt - check_in_dt).days)
                            
                            total_qty = (qty_per_night * nights) + qty_per_stay
                            
                            if total_qty > 0:
                                # Add Detail
                                detail = StockIssueDetail(
                                    issue_id=stock_issue.id,
                                    item_id=item_id,
                                    issued_quantity=total_qty, # Ensure correct column name
                                    unit=item.get("unit", "pcs"), # Fallback unit
                                    notes=f"{item.get('frequency')} allocation"
                                )
                                db.add(detail)
                                
                                # Move Stock (Warehouse -> Room)
                                # 1. Deduct Warehouse
                                from app.models.inventory import InventoryItem
                                inv_item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
                                if inv_item:
                                    inv_item.current_stock = max(0, (inv_item.current_stock or 0) - total_qty)
                                    
                                # 2. Add Room Stock
                                loc_stock = db.query(LocationStock).filter(
                                    LocationStock.location_id == room.inventory_location_id,
                                    LocationStock.item_id == item_id
                                ).first()
                                
                                if loc_stock:
                                    loc_stock.quantity = (loc_stock.quantity or 0) + total_qty
                                    loc_stock.last_updated = datetime.now(timezone.utc)
                                else:
                                    loc_stock = LocationStock(
                                        location_id=room.inventory_location_id,
                                        item_id=item_id,
                                        quantity=total_qty,
                                        last_updated=datetime.now(timezone.utc)
                                    )
                                    db.add(loc_stock)
        except Exception as e:
            print(f"Error processing amenity allocation: {e}")
            import traceback
            traceback.print_exc()
            # Non-blocking error, log and continue check-in. 
            # nested transaction automatically rolls back on exception if used in with block,
            # but we catch it here to prevent it from propagating up.

    
    db.commit()
    db.refresh(booking)

    if background_tasks and booking.room_type_id:
        try:
            from app.core.aiosell_triggers import trigger_inventory_push
            background_tasks.add_task(trigger_inventory_push, booking.room_type_id)
        except Exception as e:
            print(f"Failed to queue Aiosell inventory push: {e}")

    return booking

# -------------------------------
# Cancel a booking
# -------------------------------
@router.put("/{booking_id}/cancel", response_model=BookingOut)
def cancel_booking(
    booking_id: Union[str, int], 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user), 
    branch_id: int = Depends(get_branch_id),
    *,
    background_tasks: BackgroundTasks
):
    # Parse display ID (BK-000001) or accept numeric ID
    numeric_id, booking_type = parse_display_id(str(booking_id))
    if numeric_id is None:
        raise HTTPException(status_code=400, detail=f"Invalid booking ID format: {booking_id}")
    if booking_type and booking_type != "booking":
        raise HTTPException(status_code=400, detail=f"Invalid booking type. Expected regular booking, got: {booking_id}")
    booking_id = numeric_id
    
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Free up the rooms associated with the booking
    if booking.booking_rooms:
        room_ids = [br.room_id for br in booking.booking_rooms]
        db.query(Room).filter(Room.id.in_(room_ids)).update({"status": "Available"}, synchronize_session=False)

    booking.status = "cancelled"
    db.commit()
    db.refresh(booking)

    if background_tasks and booking.room_type_id:
        try:
            from app.core.aiosell_triggers import trigger_inventory_push
            background_tasks.add_task(trigger_inventory_push, booking.room_type_id)
        except Exception as e:
            print(f"Failed to queue Aiosell inventory push on cancellation: {e}")

    return booking

@router.put("/{booking_id}", response_model=BookingOut)
def update_booking(
    booking_id: Union[str, int], 
    booking_in: BookingUpdate,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user), 
    branch_id: int = Depends(get_branch_id)
):
    numeric_id, booking_type = parse_display_id(str(booking_id))
    if numeric_id is None:
        raise HTTPException(status_code=400, detail=f"Invalid booking ID format: {booking_id}")
    booking_id = numeric_id

    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    update_data = booking_in.model_dump(exclude_unset=True)
    room_ids = update_data.pop("room_ids", None)

    for field, value in update_data.items():
        if value is not None:
            setattr(booking, field, value)
            
    if "total_amount" in update_data and update_data["total_amount"] is not None:
        base_amt = update_data["total_amount"]
        nights = max(1, (booking.check_out - booking.check_in).days)
        room_count = len(booking.booking_rooms) or booking.num_rooms or 1
        
        from app.utils.settings_helpers import get_gst_settings
        from app.utils.checkout_helpers import calculate_gst_breakdown
        gst_settings = get_gst_settings(db, branch_id)
        is_inclusive_global = gst_settings.get("gst_inclusive", False)
        
        gst_data = calculate_gst_breakdown(
            db=db,
            branch_id=booking.branch_id,
            room_charges=base_amt,
            food_charges=0,
            package_charges=0,
            nights=nights * room_count,
            is_inclusive=is_inclusive_global
        )
        if gst_settings.get("gst_inclusive", False):
            # Keep inclusive room_rate
            total_amt = base_amt
            booking.room_rate = base_amt / (nights * room_count)
        else:
            total_amt = base_amt + gst_data["total_gst"]
            booking.room_rate = base_amt / (nights * room_count)
            
    # Handle room assignments if changed
    if room_ids is not None:
        from app.models.booking import BookingRoom
        from app.models.room import Room
        
        # Free up old rooms
        old_room_ids = [br.room_id for br in booking.booking_rooms]
        if old_room_ids:
            db.query(Room).filter(Room.id.in_(old_room_ids)).update({"status": "Available"}, synchronize_session=False)
            
        # Delete old relationships
        db.query(BookingRoom).filter(BookingRoom.booking_id == booking.id).delete()
        
        # Add new rooms
        for room_id in room_ids:
            db.add(BookingRoom(booking_id=booking.id, room_id=room_id, branch_id=branch_id))
            room = db.query(Room).filter(Room.id == room_id).first()
            if room:
                room.status = "Booked"

    db.commit()
    db.refresh(booking)

    return booking
    

@router.put("/{booking_id}/extend", response_model=BookingOut)
def extend_checkout(
    booking_id: Union[str, int], 
    new_checkout: str, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user), 
    branch_id: int = Depends(get_branch_id),
    *,
    background_tasks: BackgroundTasks
):
    """
    Extend the checkout date for a booking.
    Validates that the new checkout date is after the current checkout date
    and checks for conflicts with other bookings on the same rooms.
    Accepts both display ID (BK-000001) and numeric ID.
    """
    from datetime import timezone, datetime
    
    # Parse display ID (BK-000001) or accept numeric ID
    numeric_id, booking_type = parse_display_id(str(booking_id))
    if numeric_id is None:
        raise HTTPException(status_code=400, detail=f"Invalid booking ID format: {booking_id}")
    if booking_type and booking_type != "booking":
        raise HTTPException(status_code=400, detail=f"Invalid booking type. Expected regular booking, got: {booking_id}")
    booking_id = numeric_id
    
    # Parse the new checkout date string to a date object
    try:
        new_checkout_date = datetime.strptime(new_checkout, '%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD format")
    
    # Fetch the booking with its rooms
    booking = db.query(Booking).options(
        joinedload(Booking.booking_rooms).joinedload(BookingRoom.room)
    ).filter(Booking.id == booking_id).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check if booking is in a valid state for extension
    # Normalize status: convert to lowercase and replace underscores/hyphens with hyphens for consistent comparison
    raw_status_lower = booking.status.lower().strip() if booking.status else ''
    normalized_status = raw_status_lower.replace('_', '-').replace(' ', '-')
    
    # Explicitly reject checked-out/checked_out statuses (guest has already left)
    # Be careful: "checked-in" normalizes to "checked-in", "checked-out" normalizes to "checked-out"
    # We need to check for "out" specifically, not just the normalized form
    is_checked_out = (
        'out' in normalized_status and normalized_status.startswith('checked-') and normalized_status.endswith('-out')
    ) or raw_status_lower in ['checked_out', 'checked-out', 'checked out']
    
    if is_checked_out:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot extend checkout for booking with status '{booking.status}'. The guest has already checked out."
        )
    
    # Allow extension for 'booked' or 'checked-in' statuses (handle variations like 'checked_in', 'checked-in', 'Checked In', etc.)
    if normalized_status not in ['booked', 'checked-in']:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot extend checkout for booking with status '{booking.status}'. Only 'booked' or 'checked-in' bookings can be extended."
        )
    
    # Validate that new checkout date is after current checkout date
    if new_checkout_date <= booking.check_out:
        raise HTTPException(
            status_code=400, 
            detail=f"New checkout date ({new_checkout_date}) must be after current checkout date ({booking.check_out})"
        )
    
    # Check for conflicts with other bookings on the same rooms
    room_ids = [br.room_id for br in booking.booking_rooms if br.room_id]
    
    if room_ids:
        # Check for conflicts with regular bookings
        # A conflict exists if another booking overlaps with the extended period
        # Extended period: from booking.check_out (exclusive) to new_checkout_date (inclusive)
        conflicting_bookings = db.query(Booking).join(BookingRoom).filter(
            Booking.id != booking_id,
            BookingRoom.room_id.in_(room_ids),
            Booking.status.in_(['booked', 'checked-in', 'checked_in']),
            and_(
                Booking.check_in < new_checkout_date,
                Booking.check_out > booking.check_out
            )
        ).first()
        
        if conflicting_bookings:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot extend checkout date. Room(s) are already booked by another booking (ID: {conflicting_bookings.id}) during the extended period."
            )
        
        # Check for conflicts with package bookings
        # A conflict exists if a package booking overlaps with the extended period
        conflicting_package_bookings = db.query(PackageBooking).join(PackageBookingRoom).filter(
            PackageBookingRoom.room_id.in_(room_ids),
            PackageBooking.status.in_(['booked', 'checked-in', 'checked_in']),
            and_(
                PackageBooking.check_in < new_checkout_date,
                PackageBooking.check_out > booking.check_out
            )
        ).first()
        
        if conflicting_package_bookings:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot extend checkout date. Room(s) are already booked by a package booking (ID: {conflicting_package_bookings.id}) during the extended period."
            )
    
    # Update the checkout date
    booking.check_out = new_checkout_date
    db.commit()
    db.refresh(booking)
    
    # Reload booking with relationships for response
    booking_with_rooms = db.query(Booking).options(
        joinedload(Booking.booking_rooms).joinedload(BookingRoom.room)
    ).filter(Booking.id == booking_id).first()

    # Trigger Aiosell sync on extension
    if background_tasks and booking.room_type_id:
        try:
            from app.core.aiosell_triggers import trigger_inventory_push
            background_tasks.add_task(trigger_inventory_push, booking.room_type_id)
        except Exception as e:
            print(f"Failed to queue Aiosell inventory push on extension: {e}")

    return BookingOut(
        id=booking_with_rooms.id,
        status=booking_with_rooms.status,
        guest_name=booking_with_rooms.guest_name,
        guest_mobile=booking_with_rooms.guest_mobile,
        guest_email=booking_with_rooms.guest_email,
        check_in=booking_with_rooms.check_in,
        check_out=booking_with_rooms.check_out,
        adults=booking_with_rooms.adults,
        children=booking_with_rooms.children,
        id_card_image_url=booking_with_rooms.id_card_image_url,
        guest_photo_url=booking_with_rooms.guest_photo_url,
        user_id=booking_with_rooms.user_id,
        total_amount=booking_with_rooms.total_amount,
        rooms=[br.room for br in booking_with_rooms.booking_rooms if br.room]
    )
# -------------------------------
# GET booking by ID
# -------------------------------
@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(booking_id: Union[str, int], db: Session = Depends(get_db), current_user: User = Depends(get_current_user), branch_id: int = Depends(get_branch_id)):
    # Parse display ID (BK-000001) or accept numeric ID
    numeric_id, booking_type = parse_display_id(str(booking_id))
    if numeric_id is None:
        raise HTTPException(status_code=400, detail=f"Invalid booking ID format: {booking_id}")
    
    booking_id_num = numeric_id
    is_package = (booking_type == 'package')
    formatted_booking_id = format_display_id(booking_id_num, branch_id=branch_id, is_package=is_package)
    if booking_type and booking_type != "booking":
        raise HTTPException(status_code=400, detail=f"Invalid booking type. Expected regular booking, got: {booking_id}")
    booking_id = numeric_id
    
    booking = db.query(Booking).options(
        joinedload(Booking.booking_rooms).joinedload(BookingRoom.room)
    ).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking

# -------------------------------
# GET check-in images
# -------------------------------
@router.get("/checkin-image/{filename}")
def get_checkin_image(filename: str):
    filepath = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(filepath) or not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(filepath)

# -------------------------------
# DELETE booking by ID  →  soft-cancel (status = "cancelled")
# -------------------------------
@router.delete("/{booking_id}")
def delete_booking(
    booking_id: Union[str, int],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    """
    Soft-cancel a booking by ID.
    Sets status to 'cancelled' — does NOT delete the row from the database.
    Checked-in bookings cannot be cancelled; they must go through checkout.
    """
    numeric_id, _ = parse_display_id(str(booking_id))
    if numeric_id is None:
        raise HTTPException(status_code=400, detail=f"Invalid booking ID format: {booking_id}")
    booking_id = numeric_id

    query = db.query(Booking).filter(Booking.id == booking_id)
    if branch_id is not None:
        query = query.filter(Booking.branch_id == branch_id)
    booking = query.first()

    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Block cancellation of active (checked-in) bookings
    blocked_statuses = {"checked-in", "checked_in", "checkedin"}
    if booking.status.lower().replace(" ", "-") == "checked-in" or booking.status.lower() in blocked_statuses:
        raise HTTPException(
            status_code=409,
            detail="Cannot cancel a checked-in booking. Please complete checkout first."
        )

    # Already cancelled — idempotent
    if booking.status.lower() == "cancelled":
        return {"detail": f"Booking {booking_id} is already cancelled"}

    # Soft-cancel: update status only, keep all records intact
    booking.status = "cancelled"
    if hasattr(booking, 'cancelled_at'):
        booking.cancelled_at = get_ist_now()

    db.commit()
    db.refresh(booking)

    return {"detail": f"Booking {booking_id} cancelled successfully", "status": "cancelled"}
