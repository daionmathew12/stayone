from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, UploadFile
from typing import List, Optional, Union
import uuid
import os
import shutil
from datetime import timezone, datetime, date, time, timedelta

from app.models.Package import Package, PackageImage, PackageBooking, PackageBookingRoom
from app.models.room import Room
from app.models.user import User
from app.schemas.packages import PackageBookingCreate
from app.models.foodorder import FoodOrder, FoodOrderItem
from app.models.food_item import FoodItem
from app.schemas.foodorder import FoodOrderCreate, FoodOrderItemCreate
from app.curd import foodorder as crud_food_order
from app.utils.employee_helpers import get_fallback_employee_id
from app.models.inventory import StockIssue, StockIssueDetail, LocationStock, Location, InventoryItem
from sqlalchemy import or_, func, and_
import json


# ------------------- Packages -------------------

def create_package(db: Session, title: str, description: str, price: float, image_urls: List[str], booking_type: str = "room_type", room_types: str = None, theme: str = None, default_adults: int = 2, default_children: int = 0, max_stay_days: int = None, food_included: str = None, food_timing: str = None, complimentary: str = None, branch_id: int = None):
    try:
        pkg = Package(
            title=title, 
            description=description, 
            price=price,
            booking_type=booking_type,
            room_types=room_types,
            theme=theme,
            default_adults=default_adults,
            default_children=default_children,
            max_stay_days=max_stay_days,
            food_included=food_included,
            food_timing=food_timing,
            complimentary=complimentary,
            branch_id=branch_id
        )
        db.add(pkg)
        db.commit()
        db.refresh(pkg)

        for url in image_urls:
            img = PackageImage(package_id=pkg.id, image_url=url)
            db.add(img)
        db.commit()
        db.refresh(pkg)
        return pkg
    except Exception as e:
        db.rollback()
        import traceback
        error_detail = f"Database error in create_package: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR: {error_detail}")
        import sys
        sys.stderr.write(f"ERROR in create_package: {error_detail}\n")
        raise HTTPException(status_code=500, detail=f"Failed to create package: {str(e)}")





def delete_package(db: Session, package_id: int):
    pkg = db.query(Package).filter(Package.id == package_id).first()
    if not pkg:
        return False
    db.delete(pkg)
    db.commit()
    return True


# ------------------- Package Bookings -------------------
def get_package_bookings(db: Session):
    return (
        db.query(PackageBooking)
        .join(PackageBooking.package)  # Use an inner join to filter out bookings with no package
        .options(joinedload(PackageBooking.rooms).joinedload(PackageBookingRoom.room))
    ).all()

def get_or_create_guest_user(db: Session, email: str, mobile: str, name: str, branch_id: int = 1):
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
        user = db.query(User).filter(User.email == email).first()
    
    # If not found by email, try by mobile/phone
    if not user and mobile:
        user = db.query(User).filter(User.phone == mobile).first()
    
    # If user exists, return the user_id
    if user:
        # Update name if provided and different
        if name and user.name != name:
            user.name = name
            # If user has no branch_id, set it
            if user.branch_id is None:
                user.branch_id = branch_id
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

def book_package(db: Session, booking: PackageBookingCreate, branch_id: int = None, is_guest_enquiry: bool = False):
    # If branch_id is not provided, try to derive it from the package or first room
    selected_package = db.query(Package).filter(Package.id == booking.package_id).first()
    if not selected_package:
        raise HTTPException(status_code=404, detail="Package not found")

    if branch_id is None:
        if booking.room_ids:
            first_room = db.query(Room).filter(Room.id == booking.room_ids[0]).first()
            if first_room:
                branch_id = first_room.branch_id
        
        # Fallback to package's branch_id if still None
        if branch_id is None:
            branch_id = selected_package.branch_id
        
        # FINAL FALLBACK: If still None (Global Package), use branch 1 as active branch
        if branch_id is None:
            branch_id = 1
    # Find or create guest user based on email and mobile
    guest_user_id = None
    # Normalize email and mobile - convert empty strings to None, handle None safely
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
            # Log error but don't fail the booking if user creation fails
            print(f"Warning: Could not create/link guest user: {str(e)}")
    
    # Check for an existing package booking to reuse guest details for consistency
    # Only check if we have at least email or mobile
    existing_booking = None
    if guest_email or guest_mobile:
        existing_query = db.query(PackageBooking).filter(PackageBooking.branch_id == branch_id)
        
        # Add email filter if normalized email exists
        if guest_email:
            existing_query = existing_query.filter(PackageBooking.guest_email == guest_email)
        
        # Add mobile filter if normalized mobile exists
        if guest_mobile:
            existing_query = existing_query.filter(PackageBooking.guest_mobile == guest_mobile)
        
        existing_booking = existing_query.order_by(PackageBooking.id.desc()).first()

    # Logic Removed: Do not overwrite guest name with old data.
    guest_name_to_use = booking.guest_name or "Guest User"

    # Validate room capacity for adults and children separately (skip for whole_property packages)
    selected_package = db.query(Package).filter(Package.id == booking.package_id).first()
    if not selected_package:
        raise HTTPException(status_code=404, detail="Package not found")
    
    is_whole_property = selected_package.booking_type == 'whole_property'
    
    if not is_whole_property:
        # Enforce package limits instead of room capacity
        if booking.adults > selected_package.default_adults:
            raise HTTPException(
                status_code=400,
                detail=f"The number of adults ({booking.adults}) exceeds the package limit ({selected_package.default_adults} adults max)."
            )
        
        if booking.children > selected_package.default_children:
            raise HTTPException(
                status_code=400,
                detail=f"The number of children ({booking.children}) exceeds the package limit ({selected_package.default_children} children max)."
            )

    # Active booking statuses to check for overlaps
    active_statuses = ["booked", "checked-in", "checked_in", "confirmed", "occupied"]
    from app.models.booking import Booking, BookingRoom
    from app.models.room import RoomType

    all_branch_rooms = db.query(Room).filter(Room.branch_id == branch_id).all()
    if not all_branch_rooms:
        raise HTTPException(status_code=400, detail="No rooms configured for this branch.")

    if is_whole_property:
        # Whole Property Package: The ENTIRE property must be 100% available.
        # Check 1: ANY active regular booking in the branch overlapping dates (whether assigned or soft-allocated)
        reg_conflict = db.query(Booking).filter(
            Booking.branch_id == branch_id,
            func.lower(Booking.status).in_(active_statuses),
            Booking.check_in < booking.check_out,
            Booking.check_out > booking.check_in
        ).first()
        if reg_conflict:
            raise HTTPException(
                status_code=400,
                detail=f"The whole property is not available for the selected dates because an existing booking ({reg_conflict.display_id or reg_conflict.id}) is present."
            )

        # Check 2: ANY active package booking in the branch overlapping dates
        pkg_conflict = db.query(PackageBooking).filter(
            PackageBooking.branch_id == branch_id,
            func.lower(PackageBooking.status).in_(active_statuses),
            PackageBooking.check_in < booking.check_out,
            PackageBooking.check_out > booking.check_in
        ).first()
        if pkg_conflict:
            raise HTTPException(
                status_code=400,
                detail=f"The whole property is not available for the selected dates because an existing package booking ({pkg_conflict.display_id or pkg_conflict.id}) is present."
            )

        # Automatically allocate ALL rooms of the property for whole_property bookings
        booking.room_ids = [r.id for r in all_branch_rooms]

    else:
        # Non-whole property package:
        # Check if an active whole-property package already occupies the property
        whole_prop_conflict = (
            db.query(PackageBooking)
            .join(Package)
            .filter(
                PackageBooking.branch_id == branch_id,
                func.lower(PackageBooking.status).in_(active_statuses),
                PackageBooking.check_in < booking.check_out,
                PackageBooking.check_out > booking.check_in,
                Package.booking_type == "whole_property"
            )
            .first()
        )
        if whole_prop_conflict:
            raise HTTPException(
                status_code=400,
                detail="The property is fully booked under a Whole Property package for the selected dates."
            )

        if booking.room_ids:
            for room_id in booking.room_ids:
                # Check for conflicts with package bookings
                package_conflict = (
                    db.query(PackageBookingRoom)
                    .join(PackageBooking)
                    .filter(
                        PackageBookingRoom.room_id == room_id,
                        PackageBooking.branch_id == branch_id,
                        func.lower(PackageBooking.status).in_(active_statuses),
                        PackageBooking.check_in < booking.check_out,
                        PackageBooking.check_out > booking.check_in
                    )
                    .first()
                )

                # Check for conflicts with regular bookings (direct assignment)
                regular_conflict = (
                    db.query(BookingRoom)
                    .join(Booking)
                    .filter(
                        BookingRoom.room_id == room_id,
                        Booking.branch_id == branch_id,
                        func.lower(Booking.status).in_(active_statuses),
                        Booking.check_in < booking.check_out,
                        Booking.check_out > booking.check_in
                    )
                    .first()
                )

                if package_conflict or regular_conflict:
                    room = db.query(Room).filter(Room.id == room_id).first()
                    raise HTTPException(status_code=400, detail=f"Room {room.number if room else room_id} is not available for the selected dates.")

            # Check for capacity exhaustion due to soft allocations
            requested_rooms = db.query(Room).filter(Room.id.in_(booking.room_ids), Room.branch_id == branch_id).all()
            type_requested_counts = {}
            for r in requested_rooms:
                if r.room_type_id:
                    type_requested_counts[r.room_type_id] = type_requested_counts.get(r.room_type_id, 0) + 1

            for r_type_id, req_count in type_requested_counts.items():
                total_type_rooms = db.query(Room).filter(
                    Room.room_type_id == r_type_id,
                    Room.branch_id == branch_id
                ).count()

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

    # Calculate calculated_total_amount based on package price and duration
    # Note: Package price is typically per night.
    # Logic: price * nights * (rooms count if applicable? usually package is per room-night or per person-night?
    # Based on book_package_guest_api logic: package_charges = package_price * stay_nights * len(booking.room_ids)
    
    d_check_in = booking.check_in if isinstance(booking.check_in, date) else datetime.strptime(str(booking.check_in), '%Y-%m-%d').date()
    d_check_out = booking.check_out if isinstance(booking.check_out, date) else datetime.strptime(str(booking.check_out), '%Y-%m-%d').date()
    stay_days = (d_check_out - d_check_in).days
    stay_nights = stay_days if stay_days > 0 else 1
    
    calc_total_amount = 0.0
    if selected_package:
        # Package price * nights (no room count multiplier)
        calc_total_amount = selected_package.price * stay_nights

    # All conflict checks passed - now create the booking
    # Guest bookings from userend are treated as enquiries (pending) until admin accepts.
    booking_status = "pending" if is_guest_enquiry else "booked"
    db_booking = PackageBooking(
        package_id=booking.package_id,
        check_in=booking.check_in,
        check_out=booking.check_out,
        guest_name=guest_name_to_use,
        guest_email=guest_email or booking.guest_email or None,  # Use normalized email or original, fallback to None
        guest_mobile=guest_mobile or booking.guest_mobile or None,  # Use normalized mobile or original, fallback to None
        adults=booking.adults,
        children=booking.children,
        status=booking_status,
        user_id=guest_user_id,  # Link booking to guest user
        food_preferences=booking.food_preferences,
        special_requests=booking.special_requests,
        total_amount=calc_total_amount, # Set calculated total
        branch_id=branch_id
    )
    db.add(db_booking)
    db.commit()
    db.refresh(db_booking)

    # Generate and save display_id
    from app.utils.booking_id import format_display_id
    db_booking.display_id = format_display_id(db_booking.id, branch_id=branch_id, is_package=True)
    db.commit()
    db.refresh(db_booking)

    # Assign multiple rooms (conflicts already checked, safe to proceed)
    # For guest enquiries, rooms are linked but NOT marked as Booked yet.
    # Room status is only updated when admin/staff confirms the enquiry.
    if booking.room_ids:
        for room_id in booking.room_ids:
            if not is_guest_enquiry:
                # Update the room's status to 'Booked' only for confirmed bookings
                room_to_update = db.query(Room).filter(Room.id == room_id).first()
                if room_to_update:
                    room_to_update.status = "Booked"

            db_room_link = PackageBookingRoom(package_booking_id=db_booking.id, room_id=room_id, branch_id=branch_id)
            db.add(db_room_link)

    db.commit()

    # Reload with rooms + room details
    booking_with_rooms = (
        db.query(PackageBooking)
        .options(joinedload(PackageBooking.rooms).joinedload(PackageBookingRoom.room))
        .filter(PackageBooking.id == db_booking.id)
        .first()
    )
    return booking_with_rooms





def delete_package_booking(db: Session, booking_id: int):
    booking = db.query(PackageBooking).filter(PackageBooking.id == booking_id).first()
    if not booking:
        return False

    booking.status = "cancelled"

    for link in booking.rooms:
        room_to_update = db.query(Room).filter(Room.id == link.room_id).first()
        if room_to_update:
            room_to_update.status = "Available"

    db.commit()
    db.refresh(booking)
    return True
def get_packages(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Package).options(joinedload(Package.images)).offset(skip).limit(limit).all()


def get_package(db: Session, package_id: int):
    return db.query(Package).options(joinedload(Package.images)).filter(Package.id == package_id).first()

import os
import shutil
# ------------------- Package Check-in -------------------

UPLOAD_DIR = "uploads/checkin_proofs"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def check_in_package(db: Session, booking_id: int, current_user: User, id_card_image: UploadFile = None, guest_photo: UploadFile = None, room_ids: str = None, amenityAllocation: str = None):
    try:
        booking = db.query(PackageBooking).filter(PackageBooking.id == booking_id).first()
        if not booking:
            return False, "Package booking not found"
        
        normalized_status = (booking.status or "").strip().lower().replace("_", "-").replace(" ", "-")
        if normalized_status != "booked":
            return False, f"Booking is not in 'booked' state. Current status: {booking.status}"

        # 0. Handle room assignment for "Soft Allocated" package bookings
        if room_ids:
            try:
                import json
                id_list = json.loads(room_ids)
                if id_list:
                    print(f"[DEBUG] Assigning rooms {id_list} to package booking {booking.id}")
                    
                    # Check for existing assignments to avoid duplicates
                    existing_room_ids = {br.room_id for br in booking.rooms}
                    
                    for r_id in id_list:
                        if r_id not in existing_room_ids:
                            target_room = db.query(Room).filter(Room.id == r_id).first()
                            if not target_room:
                                 return False, f"Room ID {r_id} not found"
                            
                            # Availability Guard
                            from app.models.booking import BookingRoom as BR, Booking as B
                            regular_conflict = db.query(BR).join(B).filter(
                                BR.room_id == r_id,
                                B.status.in_(["Booked", "Checked-in"]),
                                B.check_in < booking.check_out,
                                B.check_out > booking.check_in
                            ).first()

                            package_conflict = db.query(PackageBookingRoom).join(PackageBooking).filter(
                                PackageBookingRoom.room_id == r_id,
                                PackageBooking.status.in_(["booked", "checked-in"]),
                                PackageBooking.id != booking.id,
                                PackageBooking.check_in < booking.check_out,
                                PackageBooking.check_out > booking.check_in
                            ).first()
                            
                            if regular_conflict or package_conflict:
                                return False, f"Room {target_room.number} is already booked for these dates."

                            new_pbr = PackageBookingRoom(package_booking_id=booking.id, room_id=r_id, branch_id=booking.branch_id)
                            db.add(new_pbr)
                    
                    db.flush()
                    db.refresh(booking)
            except Exception as e:
                 print(f"[ERROR] Package room assignment failed: {e}")
                 db.rollback()
                 return False, f"Failed to assign rooms: {str(e)}"

        # CRITICAL: Check if any of the rooms are ALREADY occupied (Checked-in) by another booking
        if booking.rooms:
            from sqlalchemy import or_, func
            room_ids = [br.room_id for br in booking.rooms]
            occupied_rooms = db.query(Room).filter(
                Room.id.in_(room_ids),
                or_(
                    func.lower(Room.status) == 'checked-in',
                    func.lower(Room.status) == 'occupied'
                )
            ).all()
            
            if occupied_rooms:
                occupied_numbers = ", ".join([str(r.number) for r in occupied_rooms])
                return False, f"Cannot check-in. The following room(s) are already Checked-in/Occupied: {occupied_numbers}. Please check-out the previous guest first."

        # 1. Process images
        if id_card_image and id_card_image.filename:
            id_card_filename = f"pkg_id_{booking_id}_{uuid.uuid4().hex}.jpg"
            id_card_path = os.path.join(UPLOAD_DIR, id_card_filename)
            with open(id_card_path, "wb") as buffer:
                shutil.copyfileobj(id_card_image.file, buffer)
            booking.id_card_image_url = id_card_filename

        if guest_photo and guest_photo.filename:
            guest_photo_filename = f"pkg_guest_{booking_id}_{uuid.uuid4().hex}.jpg"
            guest_photo_path = os.path.join(UPLOAD_DIR, guest_photo_filename)
            with open(guest_photo_path, "wb") as buffer:
                shutil.copyfileobj(guest_photo.file, buffer)
            booking.guest_photo_url = guest_photo_filename
            
        # 1.5. PROCESS AMENITY ALLOCATION / SCHEDULED ORDERS (Ported from booking.py)
        if amenityAllocation:
            try:
                alloc_data = json.loads(amenityAllocation)
                items = alloc_data.get("items", [])
                
                # Find first room ID
                room_id = None
                if booking.rooms and len(booking.rooms) > 0:
                    room_id = booking.rooms[0].room_id
                
                if items and room_id:
                    check_in_date = date.today()
                    
                    for item in items:
                        name = item.get("name")
                        scheduled_time = item.get("scheduledTime")
                        scheduled_date_str = item.get("scheduledDate")
                        
                        if name:
                            # Fallback if scheduled_time is missing/null/empty
                            if not scheduled_time or not str(scheduled_time).strip() or str(scheduled_time).lower() == 'null':
                                timings = {}
                                if booking.package and booking.package.food_timing:
                                    try:
                                        timings = json.loads(booking.package.food_timing)
                                    except:
                                        pass
                                
                                meal_config = timings.get(name, {})
                                if isinstance(meal_config, dict):
                                    scheduled_time = meal_config.get("time")
                                else:
                                    scheduled_time = meal_config
                                
                                if not scheduled_time or not str(scheduled_time).strip() or str(scheduled_time).lower() == 'null':
                                    if "breakfast" in name.lower():
                                        scheduled_time = "08:00"
                                    elif "lunch" in name.lower():
                                        scheduled_time = "13:00"
                                    elif "dinner" in name.lower():
                                        scheduled_time = "20:00"
                                    else:
                                        scheduled_time = "08:00"
                            
                            try:
                                 scheduled_time = scheduled_time.strip()
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
                                     now = datetime.now()
                                     scheduled_dt = datetime.combine(check_in_date, time(sh, sm))
                                     if scheduled_dt < now:
                                         scheduled_dt = scheduled_dt + timedelta(days=1)
                                 
                                 schedule_str = scheduled_dt.strftime("%Y-%m-%d %H:%M:%S")
                                 
                                 # Build items list
                                 items_to_add = []
                                 specific_items = item.get("specificFoodItems", [])
                                 
                                 if specific_items and len(specific_items) > 0:
                                     for spec_item in specific_items:
                                         f_id = spec_item.get("foodItemId")
                                         qty = spec_item.get("quantity", 1)
                                         if f_id:
                                             items_to_add.append(FoodOrderItemCreate(food_item_id=int(f_id), quantity=int(qty)))
                                 
                                 if not items_to_add:
                                     found_item = db.query(FoodItem).filter(FoodItem.name.ilike(name)).first()
                                     if not found_item:
                                         if "breakfast" in name.lower():
                                             found_item = db.query(FoodItem).filter(FoodItem.name.ilike("%breakfast%")).first()
                                         elif "lunch" in name.lower():
                                             found_item = db.query(FoodItem).filter(FoodItem.name.ilike("%lunch%")).first()
                                         elif "dinner" in name.lower():
                                             found_item = db.query(FoodItem).filter(FoodItem.name.ilike("%dinner%")).first()
                                     
                                     if found_item:
                                         qty = item.get("complimentaryPerNight", 1)
                                         items_to_add.append(FoodOrderItemCreate(food_item_id=found_item.id, quantity=int(qty)))
                                 
                                 if items_to_add:
                                     assigned_emp_id = item.get("assigned_employee_id")
                                     if not assigned_emp_id:
                                         assigned_emp_id = get_fallback_employee_id(db, current_user.employee.id if (current_user and current_user.employee) else None)
                                     
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
                                     crud_food_order.create_food_order(db, order_data, branch_id=booking.branch_id)
                            except Exception as e:
                                print(f"Error creating scheduled order for {name}: {e}")
            except Exception as e:
                print(f"Error processing amenity allocation in package check-in: {e}")

        # 1.6. AUTO-SCHEDULE PACKAGE MEALS if not in allocation
        if booking.package and booking.package.food_included and not amenityAllocation:
            try:
                meals = [m.strip() for m in booking.package.food_included.split(",") if m.strip()]
                # Load food timing JSON
                timings = {}
                if booking.package.food_timing:
                    try: timings = json.loads(booking.package.food_timing)
                    except: pass
                
                room_id = booking.rooms[0].room_id if booking.rooms else None
                if room_id:
                    for meal in meals:
                        # Find meal config in timings or use defaults
                        meal_config = timings.get(meal, {})
                        if isinstance(meal_config, dict):
                            meal_time_str = meal_config.get("time", "08:00" if "breakfast" in meal.lower() else "13:00" if "lunch" in meal.lower() else "20:00")
                        else:
                            meal_time_str = meal_config or ("08:00" if "breakfast" in meal.lower() else "13:00" if "lunch" in meal.lower() else "20:00")
                        
                        sh, sm = map(int, meal_time_str.split(":")[:2])
                        
                        now = datetime.now()
                        scheduled_dt = datetime.combine(date.today(), time(sh, sm))
                        if scheduled_dt < now:
                            scheduled_dt = scheduled_dt + timedelta(days=1)
                        
                        schedule_str = scheduled_dt.strftime("%Y-%m-%d %H:%M:%S")
                        
                        # Populate items either using defined items or matching names
                        items_to_add = []
                        if isinstance(meal_config, dict) and "items" in meal_config:
                            for timing_item in meal_config["items"]:
                                f_id = timing_item.get("id")
                                qty = timing_item.get("qty", 1)
                                if f_id:
                                    total_qty = int(qty) * (booking.adults or 1)
                                    items_to_add.append(FoodOrderItemCreate(food_item_id=int(f_id), quantity=total_qty))
                        
                        if not items_to_add:
                            found_item = db.query(FoodItem).filter(FoodItem.name.ilike(meal)).first()
                            if not found_item:
                                 if "breakfast" in meal.lower(): found_item = db.query(FoodItem).filter(FoodItem.name.ilike("%breakfast%")).first()
                                 elif "lunch" in meal.lower(): found_item = db.query(FoodItem).filter(FoodItem.name.ilike("%lunch%")).first()
                                 elif "dinner" in meal.lower(): found_item = db.query(FoodItem).filter(FoodItem.name.ilike("%dinner%")).first()
                            
                            if found_item:
                                items_to_add.append(FoodOrderItemCreate(food_item_id=found_item.id, quantity=booking.adults or 1))

                        if items_to_add:
                            assigned_emp_id = get_fallback_employee_id(db, current_user.employee.id if (current_user and current_user.employee) else None)
                            order_data = FoodOrderCreate(
                                room_id=room_id,
                                amount=0.0,
                                assigned_employee_id=int(assigned_emp_id) if assigned_emp_id else None,
                                items=items_to_add,
                                status="scheduled",
                                billing_status="unbilled",
                                order_type="room_service",
                                delivery_request=f"AUTO-SCHEDULED: {schedule_str} -- Package Meal: {meal}"
                            )
                            crud_food_order.create_food_order(db, order_data, branch_id=booking.branch_id)
            except Exception as e:
                print(f"Error auto-scheduling package meals: {e}")

        # 2. Update booking status
        booking.status = "checked-in"
        booking.checked_in_at = datetime.now(timezone.utc)
        
        # 3. Update room status
        if booking.rooms:
            room_ids = [br.room_id for br in booking.rooms]
            db.query(Room).filter(Room.id.in_(room_ids)).update({"status": "Checked-in"}, synchronize_session=False)

        # 3.5. Process Stock Issues (if in allocation)
        if amenityAllocation:
            try:
                # Issue stock to the room(s)
                for br in booking.rooms:
                    room = br.room
                    if not room or not room.inventory_location_id: continue
                    
                    warehouse = db.query(Location).filter(Location.location_type == "WAREHOUSE").first()
                    source_id = warehouse.id if warehouse else None
                    if not source_id: continue

                    stock_issue = StockIssue(
                        source_location_id=source_id,
                        destination_location_id=room.inventory_location_id,
                        issue_date=datetime.now(timezone.utc),
                        status="approved",
                        issued_by_id=current_user.id if current_user else None,
                        reference_number=f"PKG-CHKIN-{booking.id}-{room.number}",
                        notes=f"Auto Issue for Package Check-in {booking_id}",
                        booking_id=None, # Regular booking_id column, might not fit package_booking_id
                        guest_id=booking.user_id
                    )
                    db.add(stock_issue)
                    db.flush()
                    
                    alloc_data = json.loads(amenityAllocation)
                    for item in alloc_data.get("items", []):
                        item_id = item.get("item_id")
                        if not item_id: continue
                        
                        qty_per_night = float(item.get("complimentaryPerNight", 0))
                        qty_per_stay = float(item.get("complimentaryPerStay", 0))
                        
                        check_in_dt = booking.check_in if isinstance(booking.check_in, date) else datetime.strptime(str(booking.check_in), '%Y-%m-%d').date()
                        check_out_dt = booking.check_out if isinstance(booking.check_out, date) else datetime.strptime(str(booking.check_out), '%Y-%m-%d').date()
                        nights = max(1, (check_out_dt - check_in_dt).days)
                        total_qty = (qty_per_night * nights) + qty_per_stay
                        
                        if total_qty > 0:
                            detail = StockIssueDetail(
                                issue_id=stock_issue.id,
                                item_id=item_id,
                                issued_quantity=total_qty,
                                unit=item.get("unit", "pcs"),
                                notes=f"{item.get('frequency')} allocation"
                            )
                            db.add(detail)
                            
                            inv_item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
                            if inv_item: inv_item.current_stock = max(0, (inv_item.current_stock or 0) - total_qty)
                            
                            loc_stock = db.query(LocationStock).filter(LocationStock.location_id == room.inventory_location_id, LocationStock.item_id == item_id).first()
                            if loc_stock:
                                loc_stock.quantity = (loc_stock.quantity or 0) + total_qty
                            else:
                                db.add(LocationStock(location_id=room.inventory_location_id, item_id=item_id, quantity=total_qty))
            except Exception as e:
                print(f"Error processing package amenity stock issue: {e}")

        db.commit()
        db.refresh(booking)
        
        # Reload the booking with options
        from sqlalchemy.orm import joinedload
        booking_with_rooms = (
            db.query(PackageBooking)
            .options(joinedload(PackageBooking.rooms).joinedload(PackageBookingRoom.room))
            .filter(PackageBooking.id == booking_id)
            .first()
        )
        
        return True, booking_with_rooms
    except Exception as e:
        db.rollback()
        import traceback
        error_detail = f"Failed to check-in package: {str(e)}\n{traceback.format_exc()}"
        print(error_detail)
        return False, str(e)
