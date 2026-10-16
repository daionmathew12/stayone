from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
import os
# Absolute project root path (ResortApp/)
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_UPLOAD_ROOT = os.path.join(_BASE_DIR, "uploads")
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func
from typing import List, Union, Optional
from app.models.user import User
from app.models.room import Room, RoomType
from app.models.booking import Booking, BookingRoom
from app.models.Package import Package, PackageBooking, PackageBookingRoom
from app.utils.auth import get_db, get_current_user
from app.utils.branch_scope import get_branch_id
from app.utils.booking_id import parse_display_id, format_display_id
from app.models.payment import Payment
from app.schemas.packages import PackageBookingCreate, PackageOut, PackageBookingOut
from app.schemas.booking import BookingConfirm
from fastapi.responses import FileResponse
from app.curd import packages as crud_package
from app.curd import foodorder as crud_food_order
from app.schemas.foodorder import FoodOrderCreate, FoodOrderItemCreate
from app.utils.employee_helpers import get_fallback_employee_id
from app.utils.date_utils import get_ist_now, get_ist_today
import shutil
import uuid
import json

router = APIRouter(prefix="/packages", tags=["Packages"])

@router.post("/booking/{booking_id}/confirm", response_model=PackageBookingOut)
def confirm_package_booking(
    booking_id: Union[str, int],
    confirm_data: BookingConfirm,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    # Parse display ID (PK-000001) or accept numeric ID
    numeric_id, _ = parse_display_id(str(booking_id))
    if numeric_id is not None:
        booking_id = numeric_id
        
    query = db.query(PackageBooking).filter(PackageBooking.id == booking_id)
    if branch_id is not None:
        query = query.filter(PackageBooking.branch_id == branch_id)
    booking = query.first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Package booking not found")
    
    was_pending = booking.status.lower() == "pending"
    
    booking.is_confirmed = True
    booking.confirmed_at = get_ist_now()
    
    # Calculate total advance and create payment records
    total_advance = 0.0
    from app.utils.accounting_helpers import create_advance_payment_journal_entry

    for p in confirm_data.payments:
        payment = Payment(
            package_booking_id=booking.id,
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
            created_by=current_user.id,
            is_package=True
        )
        
    booking.advance_deposit = (booking.advance_deposit or 0.0) + total_advance
    booking.confirmation_notes = confirm_data.notes
    
    # Promote enquiry (pending) to confirmed booking
    if booking.status.lower() == "pending":
        booking.status = "booked"
        # Now that admin has confirmed, update physical room statuses
        if was_pending and booking.rooms:
            for pbr in booking.rooms:
                room = db.query(Room).filter(Room.id == pbr.room_id).first()
                if room:
                    room.status = "Booked"
    
    db.commit()
    db.refresh(booking)
    
    return booking

UPLOAD_DIR = os.path.join(_UPLOAD_ROOT, "packages")
CHECKIN_UPLOAD_DIR = os.path.join(_UPLOAD_ROOT, "checkin_proofs")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(CHECKIN_UPLOAD_DIR, exist_ok=True)


# ------------------- Packages -------------------

@router.post("", response_model=PackageOut)
async def create_package_api(
    title: str = Form(...),
    description: str = Form(...),
    price: float = Form(...),
    booking_type: str = Form("room_type"),  # "whole_property" or "room_type"
    room_types: str = Form(None),  # Comma-separated list of room types
    theme: str = Form(None),
    default_adults: int = Form(2),
    default_children: int = Form(0),
    max_stay_days: int = Form(None),
    food_included: str = Form(None),
    food_timing: str = Form(None),
    complimentary: str = Form(None),
    images: List[UploadFile] = File([]),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    try:
        # Validate booking_type
        if booking_type not in ["whole_property", "room_type"]:
            raise HTTPException(status_code=400, detail="booking_type must be either 'whole_property' or 'room_type'")
        
        # If booking_type is room_type, room_types must be provided
        if booking_type == "room_type" and not room_types:
            raise HTTPException(status_code=400, detail="room_types is required when booking_type is 'room_type'")
            
        # Ensure a package is always created under a specific branch
        if branch_id is None:
            raise HTTPException(status_code=400, detail="A specific branch must be selected to create a package (cannot be 'All')")
        
        # If booking_type is whole_property, room_types should be empty
        if booking_type == "whole_property":
            room_types = None
        
        image_urls = []
        try:
            for img in images:
                # Generate unique filename - handle case where filename might be None
                original_filename = img.filename if img.filename else "image.jpg"
                filename = f"pkg_{uuid.uuid4().hex}_{original_filename}"
                file_path = os.path.join(UPLOAD_DIR, filename)
                
                # Use async file operations for better performance with large files
                try:
                    # Read file content asynchronously
                    contents = await img.read()
                    # Write to disk
                    with open(file_path, "wb") as buffer:
                        buffer.write(contents)
                except (AttributeError, TypeError):
                    # Fallback to synchronous if async methods not available
                    with open(file_path, "wb") as buffer:
                        shutil.copyfileobj(img.file, buffer)
                
                # Store with leading slash for proper URL construction
                image_urls.append(f"/uploads/packages/{filename}")
        except Exception as img_error:
            import traceback
            error_detail = f"Failed to save package images: {str(img_error)}\n{traceback.format_exc()}"
            print(f"ERROR: {error_detail}")
            import sys
            sys.stderr.write(f"ERROR in create_package_api (image upload): {error_detail}\n")
            raise HTTPException(status_code=500, detail=f"Failed to upload images: {str(img_error)}")

        try:
            return crud_package.create_package(db, title, description, price, image_urls, booking_type, room_types, theme, default_adults, default_children, max_stay_days, food_included, food_timing, complimentary, branch_id=branch_id)
        except Exception as db_error:
            import traceback
            error_detail = f"Failed to create package in database: {str(db_error)}\n{traceback.format_exc()}"
            print(f"ERROR: {error_detail}")
            import sys
            sys.stderr.write(f"ERROR in create_package_api (database): {error_detail}\n")
            # Clean up uploaded images if package creation fails
            for img_url in image_urls:
                try:
                    # Remove leading slash to get actual file path
                    file_path = img_url.lstrip('/')
                    if os.path.exists(file_path):
                        os.remove(file_path)
                except Exception as cleanup_error:
                    print(f"Warning: Failed to cleanup image {img_url}: {str(cleanup_error)}")
            raise HTTPException(status_code=500, detail=f"Failed to create package: {str(db_error)}")
    except HTTPException:
        # Re-raise HTTP exceptions (like validation errors) as-is
        raise
    except Exception as e:
        import traceback
        error_detail = f"Unexpected error in create_package_api: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR: {error_detail}")
        import sys
        sys.stderr.write(f"ERROR in create_package_api: {error_detail}\n")
        raise HTTPException(status_code=500, detail=f"Failed to create package: {str(e)}")


@router.post("/", response_model=PackageOut)  # Handle trailing slash
async def create_package_api_slash(
    title: str = Form(...),
    description: str = Form(...),
    price: float = Form(...),
    booking_type: str = Form("room_type"),
    room_types: str = Form(None),
    theme: str = Form(None),
    default_adults: int = Form(2),
    default_children: int = Form(0),
    max_stay_days: int = Form(None),
    food_included: str = Form(None),
    food_timing: str = Form(None),
    complimentary: str = Form(None),
    images: List[UploadFile] = File([]),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    """Handle POST /packages/ with trailing slash"""
    try:
        # Validate booking_type
        if booking_type not in ["whole_property", "room_type"]:
            raise HTTPException(status_code=400, detail="booking_type must be either 'whole_property' or 'room_type'")
        
        # If booking_type is room_type, room_types must be provided
        if booking_type == "room_type" and not room_types:
            raise HTTPException(status_code=400, detail="room_types is required when booking_type is 'room_type'")
            
        # Ensure a package is always created under a specific branch
        if branch_id is None:
            raise HTTPException(status_code=400, detail="A specific branch must be selected to create a package (cannot be 'All')")
        
        # If booking_type is whole_property, room_types should be empty
        if booking_type == "whole_property":
            room_types = None
        
        image_urls = []
        try:
            for img in images:
                # Generate unique filename - handle case where filename might be None
                original_filename = img.filename if img.filename else "image.jpg"
                filename = f"pkg_{uuid.uuid4().hex}_{original_filename}"
                file_path = os.path.join(UPLOAD_DIR, filename)
                
                # Use async file operations for better performance with large files
                try:
                    # Read file content asynchronously
                    contents = await img.read()
                    # Write to disk
                    with open(file_path, "wb") as buffer:
                        buffer.write(contents)
                except (AttributeError, TypeError):
                    # Fallback to synchronous if async methods not available
                    with open(file_path, "wb") as buffer:
                        shutil.copyfileobj(img.file, buffer)
                
                # Store with leading slash for proper URL construction
                image_urls.append(f"/uploads/packages/{filename}")
        except Exception as img_error:
            import traceback
            error_detail = f"Failed to save package images: {str(img_error)}\n{traceback.format_exc()}"
            print(f"ERROR: {error_detail}")
            import sys
            sys.stderr.write(f"ERROR in create_package_api_slash (image upload): {error_detail}\n")
            raise HTTPException(status_code=500, detail=f"Failed to upload images: {str(img_error)}")

        try:
            return crud_package.create_package(db, title, description, price, image_urls, booking_type, room_types, theme, default_adults, default_children, max_stay_days, food_included, food_timing, complimentary, branch_id=branch_id)
        except Exception as db_error:
            import traceback
            error_detail = f"Failed to create package in database: {str(db_error)}\n{traceback.format_exc()}"
            print(f"ERROR: {error_detail}")
            import sys
            sys.stderr.write(f"ERROR in create_package_api_slash (database): {error_detail}\n")
            # Clean up uploaded images if package creation fails
            for img_url in image_urls:
                try:
                    # Remove leading slash to get actual file path
                    file_path = img_url.lstrip('/')
                    if os.path.exists(file_path):
                        os.remove(file_path)
                except Exception as cleanup_error:
                    print(f"Warning: Failed to cleanup image {img_url}: {str(cleanup_error)}")
            raise HTTPException(status_code=500, detail=f"Failed to create package: {str(db_error)}")
    except HTTPException:
        # Re-raise HTTP exceptions (like validation errors) as-is
        raise
    except Exception as e:
        import traceback
        error_detail = f"Unexpected error in create_package_api_slash: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR: {error_detail}")
        import sys
        sys.stderr.write(f"ERROR in create_package_api_slash: {error_detail}\n")
        raise HTTPException(status_code=500, detail=f"Failed to create package: {str(e)}")


@router.put("/{package_id}", response_model=PackageOut)
async def update_package_api(
    package_id: int,
    title: str = Form(...),
    description: str = Form(...),
    price: float = Form(...),
    booking_type: str = Form("room_type"),  # "whole_property" or "room_type"
    room_types: str = Form(None),  # Comma-separated list of room types
    theme: str = Form(None),
    default_adults: int = Form(2),
    default_children: int = Form(0),
    max_stay_days: int = Form(None),
    food_included: str = Form(None),
    food_timing: str = Form(None),
    complimentary: str = Form(None),
    images: List[UploadFile] = File([]),
    existing_images: str = Form(None), # JSON list of image URLs to keep
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Validate booking_type
    if booking_type not in ["whole_property", "room_type"]:
        raise HTTPException(status_code=400, detail="booking_type must be either 'whole_property' or 'room_type'")
    
    # If booking_type is room_type, room_types must be provided
    if booking_type == "room_type" and not room_types:
        raise HTTPException(status_code=400, detail="room_types is required when booking_type is 'room_type'")
    
    # If booking_type is whole_property, room_types should be empty
    if booking_type == "whole_property":
        room_types = None
    
    # Get existing package
    package = db.query(Package).filter(Package.id == package_id).first()
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    
    # Update package fields
    package.title = title
    package.description = description
    package.price = price
    package.booking_type = booking_type
    package.room_types = room_types
    package.theme = theme
    package.complimentary = complimentary
    package.default_adults = default_adults
    package.default_children = default_children
    package.max_stay_days = max_stay_days
    package.food_included = food_included
    package.food_timing = food_timing
    
    # --- IMAGE HANDLING ---
    from app.models.Package import PackageImage
    
    # 1. Handle selective deletion if existing_images is provided
    if existing_images is not None:
        try:
            keep_urls = json.loads(existing_images)
            # Find images to delete
            for img_record in package.images:
                if img_record.image_url not in keep_urls:
                    # Delete file from disk
                    path = img_record.image_url.lstrip("/")
                    if os.path.exists(path):
                        try: os.remove(path)
                        except: pass
                    # Delete record from DB
                    db.delete(img_record)
        except Exception as e:
            print(f"Error parsing existing_images in package update: {e}")

    # 2. Add new images if provided
    if images:
        image_urls = []
        for img in images:
            # Generate unique filename
            filename = f"pkg_{uuid.uuid4().hex}_{img.filename}"
            file_path = os.path.join(UPLOAD_DIR, filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(img.file, buffer)
            # Store with leading slash for proper URL construction
            image_urls.append(f"/uploads/packages/{filename}")
        
        # Add new images to existing ones
        for url in image_urls:
            img_rec = PackageImage(package_id=package.id, image_url=url)
            db.add(img_rec)
    
    db.commit()
    db.refresh(package)
    return package


@router.delete("/{package_id}")
def delete_package_api(package_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    success = crud_package.delete_package(db, package_id)
    return {"deleted": success}


# ------------------- Package Bookings -------------------

@router.post("/book", response_model=PackageBookingOut)
def book_package_api(
    booking: PackageBookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    result = crud_package.book_package(db, booking, branch_id=branch_id)
    
    # Calculate booking charges and send confirmation email if email address is provided
    if booking.guest_email and result:
        try:
            from app.utils.email import send_email, create_booking_confirmation_email
            from datetime import datetime, date
            
            # Get package details
            package = db.query(Package).filter(Package.id == booking.package_id).first()
            
            # Calculate stay duration
            check_in_date = result.check_in if isinstance(result.check_in, date) else datetime.strptime(str(result.check_in), '%Y-%m-%d').date()
            check_out_date = result.check_out if isinstance(result.check_out, date) else datetime.strptime(str(result.check_out), '%Y-%m-%d').date()
            stay_nights = max(1, (check_out_date - check_in_date).days)
            
            # Calculate package charges (package price * nights, no room count multiplier)
            package_price = package.price if package else 0
            package_charges = package_price * stay_nights


            
            # Get room details with prices
            rooms_data = []
            for pbr in result.rooms:
                if pbr.room:
                    rooms_data.append({
                        'number': pbr.room.number,
                        'type': pbr.room.type or 'Standard',
                        'price': pbr.room.price or 0
                    })
            
            # Format booking ID (PK-1-000001)
            formatted_booking_id = format_display_id(result.id, branch_id=branch_id, is_package=True)
            
            email_html = create_booking_confirmation_email(
                guest_name=result.guest_name,
                booking_id=result.id,
                booking_type='package',
                check_in=str(result.check_in),
                check_out=str(result.check_out),
                rooms=rooms_data,
                total_amount=package_charges,
                package_name=package.title if package else None,
                guests={'adults': booking.adults, 'children': booking.children},
                guest_mobile=booking.guest_mobile,
                package_charges=package_charges,
                stay_nights=stay_nights
            )
            
            send_email(
                to_email=booking.guest_email,
                subject=f"Package Booking Confirmation {formatted_booking_id} - Orchid Resort",
                html_content=email_html,
                to_name=result.guest_name
            )
            
            # Notify admin
            send_email(
                to_email="info@stayone.com",
                subject=f"New Package Booking: {formatted_booking_id}",
                html_content=email_html,
                cc="orchidresort@gmail.com"
            )
        except Exception as e:
            # Log error but don't fail the booking
            print(f"Failed to send confirmation email: {str(e)}")
    
    return result

@router.post("/book/guest", response_model=PackageBookingOut, summary="Book a package as a guest")
def book_package_guest_api(
    booking: PackageBookingCreate,
    db: Session = Depends(get_db)
):
    """
    Public endpoint for guests to book a package without authentication.
    """
    try:
        # Prioritize branch_id from the JSON body
        branch_id = booking.branch_id
        
        # Guest bookings from userend are treated as enquiries — is_guest_enquiry=True
        # sets status='pending' and skips room status updates until admin confirms.
        result = crud_package.book_package(db, booking, branch_id=branch_id, is_guest_enquiry=True)
        
        # Calculate booking charges and send confirmation email if email address is provided
        if result:
            # Normalize email for sending
            guest_email = None
            try:
                if booking.guest_email:
                    guest_email = booking.guest_email.strip() if isinstance(booking.guest_email, str) and booking.guest_email.strip() else None
            except (AttributeError, TypeError):
                pass
            
            if guest_email:
                try:
                    from app.utils.email import send_email, create_booking_confirmation_email
                    from datetime import datetime, date
                    
                    # Get package details
                    package = db.query(Package).filter(Package.id == booking.package_id).first()
                    
                    # Calculate stay duration
                    check_in_date = result.check_in if isinstance(result.check_in, date) else datetime.strptime(str(result.check_in), '%Y-%m-%d').date()
                    check_out_date = result.check_out if isinstance(result.check_out, date) else datetime.strptime(str(result.check_out), '%Y-%m-%d').date()
                    stay_nights = max(1, (check_out_date - check_in_date).days)
                    
                    # Calculate package charges (package price * nights, no room count multiplier)
                    package_price = package.price if package else 0
                    package_charges = package_price * stay_nights


                    
                    # Get room details with prices
                    rooms_data = []
                    for pbr in result.rooms:
                        if pbr.room:
                            rooms_data.append({
                                'number': pbr.room.number,
                                'type': pbr.room.type or 'Standard',
                                'price': pbr.room.price or 0
                            })
                    
                    # Format booking ID (PK-1-000001)
                    # For guest booking without explicit branch_id in dependencies, try to use result.branch_id
                    formatted_booking_id = format_display_id(result.id, branch_id=getattr(result, 'branch_id', 1), is_package=True)
                    
                    email_html = create_booking_confirmation_email(
                        guest_name=result.guest_name,
                        booking_id=result.id,
                        booking_type='package',
                        check_in=str(result.check_in),
                        check_out=str(result.check_out),
                        rooms=rooms_data,
                        total_amount=package_charges,
                        package_name=package.title if package else None,
                        guests={'adults': booking.adults, 'children': booking.children},
                        guest_mobile=booking.guest_mobile,
                        package_charges=package_charges,
                        stay_nights=stay_nights
                    )
                    
                    send_email(
                        to_email=guest_email,
                        subject=f"Package Booking Confirmation {formatted_booking_id} - Orchid Resort",
                        html_content=email_html,
                        to_name=result.guest_name
                    )
                    
                    # Notify admin
                    send_email(
                        to_email="info@stayone.com",
                        subject=f"New Package Booking: {formatted_booking_id}",
                        html_content=email_html,
                        cc="orchidresort@gmail.com"
                    )
                except Exception as e:
                    # Log error but don't fail the booking
                    print(f"Failed to send confirmation email: {str(e)}")
        
        return result
        
    except HTTPException:
        # Re-raise HTTP exceptions (like validation errors) as-is
        raise
    except Exception as e:
        # Log the full error for debugging
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error in book_package_guest_api: {str(e)}")
        print(f"Traceback: {error_trace}")
        
        # Return a user-friendly error message
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create package booking: {str(e)}"
        )

@router.get("/bookingsall", response_model=List[PackageBookingOut])
def get_bookings(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user), 
    skip: int = 0, 
    limit: int = 20, 
    status: Optional[str] = None,
    guest_name: Optional[str] = None,
    check_in_date: Optional[str] = None,
    branch_id: Optional[int] = Depends(get_branch_id)
):
    try:
        # Optimized for low network - reduced to 50
        if limit > 50:
            limit = 50
        if limit < 1:
            limit = 20
        
        # Simplified query - removed nested eager loading to prevent hangs
        # It's possible for a package to be deleted, leaving an orphaned booking.
        # We must filter to only include bookings that still have a valid package_id.
        query = db.query(PackageBooking).options(
            joinedload(PackageBooking.package),
            joinedload(PackageBooking.checkouts),
            joinedload(PackageBooking.rooms).joinedload(PackageBookingRoom.room),
            joinedload(PackageBooking.payments)
        ).filter(PackageBooking.package_id.is_not(None))
        
        if branch_id is not None:
            query = query.filter(PackageBooking.branch_id == branch_id)
            
        if status:
            query = query.filter(PackageBooking.status.ilike(status))
        
        if guest_name:
            query = query.filter(PackageBooking.guest_name.ilike(f"%{guest_name}%"))
            
        if check_in_date:
            try:
                from datetime import datetime
                d = datetime.strptime(check_in_date, '%Y-%m-%d').date()
                query = query.filter(PackageBooking.check_in == d)
            except:
                pass
            
        result = query.order_by(PackageBooking.id.desc()).offset(skip).limit(limit).all()
        
        # Populate room_type_id from package and handle total_amount fallback
        for booking in result:
            booking.room_type_id = booking.package.room_types if booking.package else None
            
            if (not booking.total_amount or booking.total_amount == 0) and booking.check_in and booking.check_out and booking.package:
                try:
                    from datetime import datetime, date
                    d_in = booking.check_in
                    d_out = booking.check_out
                    
                    if isinstance(d_in, str):
                        d_in = datetime.strptime(d_in, '%Y-%m-%d').date()
                    if isinstance(d_out, str):
                        d_out = datetime.strptime(d_out, '%Y-%m-%d').date()
                        
                    stay_days = (d_out - d_in).days
                    stay_nights = max(1, stay_days)
                    # For packages, price is package price * nights (no room count multiplier)
                    calc_amount = booking.package.price * stay_nights


                    
                    if calc_amount > 0:
                         booking.total_amount = calc_amount
                         # Self-healing
                         try:
                             from sqlalchemy import update
                             stmt = update(PackageBooking).where(PackageBooking.id == booking.id).values(total_amount=calc_amount)
                             db.execute(stmt)
                             db.commit()
                             print(f"Self-healed Package Booking {booking.id} total_amount to {calc_amount}")
                         except Exception as db_e:
                             print(f"Failed to update healed package amount: {db_e}")
                             db.rollback()

                except Exception as e:
                    print(f"Error patching total_amount for package {booking.id}: {e}")
                    pass

        return result if result is not None else []
    except Exception as e:
        import traceback
        error_detail = f"Failed to fetch package bookings: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR: {error_detail}")
        import sys
        sys.stderr.write(f"ERROR in /packages/bookingsall: {error_detail}\n")
        # Return empty list to prevent frontend breakage
        print(f"Unexpected error in package bookings endpoint, returning empty list: {str(e)}")
        return []



def _list_packages_impl(db: Session, skip: int = 0, limit: int = 20, status: str = None, branch_id: int = None):
    """Helper function for list_packages"""
    try:
        # Optimized for low network - reduced to 50
        if limit > 50:
            limit = 50
        if limit < 1:
            limit = 20
        
        # Query directly in the endpoint to apply pagination and filtering
        # Eager-load images relationship to include them in the response
        query = db.query(Package).options(joinedload(Package.images))
        
        # If branch_id is None, it means Enterprise View (all branches)
        # We only apply branch filtering if a specific branch_id is provided
        if branch_id is not None:
            # Show branch-specific packages PLUS global packages (NULL branch_id)
            query = query.filter(or_(Package.branch_id == branch_id, Package.branch_id == None))
            
        if status:
            query = query.filter(Package.status == status)
            
        result = query.offset(skip).limit(limit).all()
        return result if result is not None else []
    except Exception as e:
        import traceback
        error_detail = f"Failed to fetch packages: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR: {error_detail}")
        import sys
        sys.stderr.write(f"ERROR in /packages: {error_detail}\n")
        # Return empty list to prevent frontend breakage
        print(f"Unexpected error in packages endpoint, returning empty list: {str(e)}")
        return []

@router.get("", response_model=List[PackageOut])
def list_packages(db: Session = Depends(get_db), current_user: User = Depends(get_current_user), skip: int = 0, limit: int = 20, status: str = None, branch_id: int = Depends(get_branch_id)):
    return _list_packages_impl(db, skip, limit, status, branch_id)

@router.get("/", response_model=List[PackageOut])  # Handle trailing slash
def list_packages_slash(db: Session = Depends(get_db), current_user: User = Depends(get_current_user), skip: int = 0, limit: int = 20, status: str = None, branch_id: int = Depends(get_branch_id)):
    return _list_packages_impl(db, skip, limit, status, branch_id)


@router.get("/{package_id}", response_model=PackageOut)
def get_package_api(package_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return crud_package.get_package(db, package_id)


@router.get("/history/{package_id}", response_model=List[PackageBookingOut])
def get_package_bookings_history(package_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from sqlalchemy import desc
    bookings = db.query(PackageBooking).options(
        joinedload(PackageBooking.rooms).joinedload(PackageBookingRoom.room),
        joinedload(PackageBooking.user),
        joinedload(PackageBooking.checkouts),
        joinedload(PackageBooking.package).joinedload(Package.images)
    ).filter(PackageBooking.package_id == package_id).order_by(desc(PackageBooking.created_at)).all()
    
    for b in bookings:
        b.room_type_id = b.package.room_types if b.package else None
        
    return bookings


@router.delete("/booking/{booking_id}")
def delete_package_booking_api(booking_id: Union[str, int], db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Parse display ID (PK-000001) or accept numeric ID
    numeric_id, booking_type = parse_display_id(str(booking_id))
    if numeric_id is None:
        raise HTTPException(status_code=400, detail=f"Invalid booking ID format: {booking_id}")
    if booking_type and booking_type != "package":
        raise HTTPException(status_code=400, detail=f"Invalid booking type. Expected package booking, got: {booking_id}")
    booking_id = numeric_id
    
    success = crud_package.delete_package_booking(db, booking_id)
    if not success:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"deleted": success}

# ------------------- Cancel a package booking -------------------
@router.put("/booking/{booking_id}/cancel", response_model=PackageBookingOut)
def cancel_package_booking(booking_id: Union[str, int], db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Parse display ID (PK-000001) or accept numeric ID
    numeric_id, booking_type = parse_display_id(str(booking_id))
    if numeric_id is None:
        raise HTTPException(status_code=400, detail=f"Invalid booking ID format: {booking_id}")
    if booking_type and booking_type != "package":
        raise HTTPException(status_code=400, detail=f"Invalid booking type. Expected package booking, got: {booking_id}")
    booking_id = numeric_id
    
    booking = db.query(PackageBooking).filter(PackageBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Package booking not found")

    # Free rooms back to Available
    if booking.rooms:
        room_ids = [br.room_id for br in booking.rooms]
        db.query(Room).filter(Room.id.in_(room_ids)).update({"status": "Available"}, synchronize_session=False)

    booking.status = "cancelled"
    db.commit()
    db.refresh(booking)
    return booking

@router.put("/booking/{booking_id}/extend", response_model=PackageBookingOut)
def extend_package_booking_checkout(booking_id: Union[str, int], new_checkout: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Extend the checkout date for a package booking.
    Validates that the new checkout date is after the current checkout date
    and checks for conflicts with other bookings on the same rooms.
    Accepts both display ID (PK-000001) and numeric ID.
    """
    from datetime import datetime
    
    # Parse display ID (PK-000001) or accept numeric ID
    numeric_id, booking_type = parse_display_id(str(booking_id))
    if numeric_id is None:
        raise HTTPException(status_code=400, detail=f"Invalid booking ID format: {booking_id}")
    if booking_type and booking_type != "package":
        raise HTTPException(status_code=400, detail=f"Invalid booking type. Expected package booking, got: {booking_id}")
    booking_id = numeric_id
    
    # Parse the new checkout date string to a date object
    try:
        new_checkout_date = datetime.strptime(new_checkout, '%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD format")
    
    # Fetch the package booking with its rooms and package
    booking = db.query(PackageBooking).options(
        joinedload(PackageBooking.rooms).joinedload(PackageBookingRoom.room),
        joinedload(PackageBooking.package)
    ).filter(PackageBooking.id == booking_id).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Package booking not found")
    
    # IMPORTANT: Refresh the booking from database to get the latest status
    # This ensures we have the most current status, not a stale cached value
    db.refresh(booking)
    
    # Check if booking is in a valid state for extension
    # Normalize status: convert to lowercase and replace underscores/hyphens with hyphens for consistent comparison
    if not booking.status:
        raise HTTPException(
            status_code=400, 
            detail="Booking status is missing. Cannot extend checkout."
        )
    
    # Normalize status: handle variations like "booked", "Booked", "BOOKED", "checked-in", "checked_in", "checked-out", "checked_out"
    raw_status_lower = booking.status.lower().strip() if booking.status else ''
    # Replace underscores and spaces with hyphens, but be careful not to break "booked"
    normalized_status = raw_status_lower.replace('_', '-').replace(' ', '-')
    
    # Debug: Print the actual status values for troubleshooting
    print(f"[DEBUG] Extend package booking - ID: {booking_id}")
    print(f"[DEBUG]   Guest: {booking.guest_name}")
    print(f"[DEBUG]   Original status from DB: '{booking.status}'")
    print(f"[DEBUG]   Raw lower: '{raw_status_lower}'")
    print(f"[DEBUG]   Normalized: '{normalized_status}'")
    print(f"[DEBUG]   Check-in: {booking.check_in}, Check-out: {booking.check_out}")
    
    # First, check if it's explicitly "booked" - this should always be allowed and skip all other checks
    is_booked = normalized_status == 'booked' or raw_status_lower == 'booked'
    
    if is_booked:
        # "booked" status is always valid for extension - skip all other checks
        print(f"[DEBUG]   Status is 'booked' - allowing extension without further checks")
        # Continue to date validation and conflict checks below
    else:
        # For non-"booked" statuses, check if it's checked-out
        # Check if it's checked-out (must end with "-out" or be exactly "checked_out")
        # This ensures "checked-in" is NOT matched
        # Be very specific: only match if it explicitly contains "checked" and "out"
        is_checked_out = False
        if normalized_status == 'checked-out' or raw_status_lower in ['checked_out', 'checked-out', 'checked out']:
            is_checked_out = True
        elif normalized_status.startswith('checked-') and normalized_status.endswith('-out'):
            is_checked_out = True
        
        # Check if it's a valid status for extension (checked-in)
        is_valid_for_extension = (
            normalized_status == 'checked-in' or
            raw_status_lower in ['checked_in', 'checked-in', 'checked in']
        )
        
        print(f"[DEBUG]   Is valid for extension: {is_valid_for_extension}")
        print(f"[DEBUG]   Is checked out: {is_checked_out}")
        print(f"[DEBUG]   Has check-in images: id_card={bool(booking.id_card_image_url)}, guest_photo={bool(booking.guest_photo_url)}")
        
        # Special case: If status is "checked_out" but has check-in images, it might be a data inconsistency
        # Also check if check-out date is in the future (guest is still checked in)
        from datetime import date
        has_checkin_images = bool(booking.id_card_image_url) or bool(booking.guest_photo_url)
        today = get_ist_today().date()
        checkout_is_future = booking.check_out >= today
        
        # If status says "checked_out" but:
        # 1. Has check-in images (guest was checked in), OR
        # 2. Check-out date is today or in the future (guest should still be checked in)
        # Then treat as checked-in for extension purposes
        if is_checked_out and (has_checkin_images or checkout_is_future):
            print(f"[DEBUG]   WARNING: Status is 'checked_out' but has check-in images or future checkout date.")
            print(f"[DEBUG]   Has check-in images: {has_checkin_images}, Checkout is future: {checkout_is_future}")
            print(f"[DEBUG]   Allowing extension due to data inconsistency - treating as checked-in.")
            # Treat as checked-in for extension purposes
            is_checked_out = False
            is_valid_for_extension = True
        
        # Reject checked-out statuses first (unless they have check-in images)
        if is_checked_out:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot extend checkout for package booking with status '{booking.status}'. The guest has already checked out. If this booking was checked in, please refresh the page or contact support."
            )
        
        # Then check if it's a valid status for extension
        if not is_valid_for_extension:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot extend checkout for package booking with status '{booking.status}'. Only 'booked' or 'checked-in' bookings can be extended."
            )
    
    # Validate that new checkout date is after current checkout date
    if new_checkout_date <= booking.check_out:
        raise HTTPException(
            status_code=400, 
            detail=f"New checkout date ({new_checkout_date}) must be after current checkout date ({booking.check_out})"
        )
    
    # Active booking statuses to check for overlaps
    active_statuses = ["booked", "checked-in", "checked_in", "confirmed", "occupied"]
    
    branch_id = booking.branch_id
    if branch_id is None:
        if booking.package and booking.package.branch_id:
            branch_id = booking.package.branch_id
        elif booking.rooms:
            first_r = db.query(Room).filter(Room.id == booking.rooms[0].room_id).first()
            if first_r:
                branch_id = first_r.branch_id

    is_whole_property = booking.package and booking.package.booking_type == "whole_property"

    if is_whole_property:
        # Whole Property Package: The ENTIRE property must be 100% available during the extended period.
        # Check 1: ANY active regular booking in the branch overlapping the extended period
        reg_conflict = db.query(Booking).filter(
            Booking.branch_id == branch_id,
            func.lower(Booking.status).in_(active_statuses),
            Booking.check_in < new_checkout_date,
            Booking.check_out > booking.check_out
        ).first()
        if reg_conflict:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot extend checkout date. The property has an existing booking ({reg_conflict.display_id or reg_conflict.id}) during the extended period."
            )

        # Check 2: ANY other active package booking in the branch overlapping the extended period
        pkg_conflict = db.query(PackageBooking).filter(
            PackageBooking.id != booking_id,
            PackageBooking.branch_id == branch_id,
            func.lower(PackageBooking.status).in_(active_statuses),
            PackageBooking.check_in < new_checkout_date,
            PackageBooking.check_out > booking.check_out
        ).first()
        if pkg_conflict:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot extend checkout date. The property has an existing package booking ({pkg_conflict.display_id or pkg_conflict.id}) during the extended period."
            )

    else:
        # Non-whole-property package:
        # Check if an active whole-property package already occupies the property during the extended period
        whole_prop_conflict = (
            db.query(PackageBooking)
            .join(Package)
            .filter(
                PackageBooking.id != booking_id,
                PackageBooking.branch_id == branch_id,
                func.lower(PackageBooking.status).in_(active_statuses),
                PackageBooking.check_in < new_checkout_date,
                PackageBooking.check_out > booking.check_out,
                Package.booking_type == "whole_property"
            )
            .first()
        )
        if whole_prop_conflict:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot extend checkout date. The property is booked under a Whole Property package ({whole_prop_conflict.display_id or whole_prop_conflict.id}) during the extended period."
            )

        room_ids = [br.room_id for br in booking.rooms if br.room_id]
        if room_ids:
            # Check for physical room conflicts with regular bookings
            conflicting_bookings = db.query(Booking).join(BookingRoom).filter(
                BookingRoom.room_id.in_(room_ids),
                Booking.branch_id == branch_id,
                func.lower(Booking.status).in_(active_statuses),
                Booking.check_in < new_checkout_date,
                Booking.check_out > booking.check_out
            ).first()
            if conflicting_bookings:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot extend checkout date. Room(s) are already booked by another booking ({conflicting_bookings.display_id or conflicting_bookings.id}) during the extended period."
                )

            # Check for physical room conflicts with other package bookings
            conflicting_package_bookings = db.query(PackageBooking).join(PackageBookingRoom).filter(
                PackageBooking.id != booking_id,
                PackageBookingRoom.room_id.in_(room_ids),
                PackageBooking.branch_id == branch_id,
                func.lower(PackageBooking.status).in_(active_statuses),
                PackageBooking.check_in < new_checkout_date,
                PackageBooking.check_out > booking.check_out
            ).first()
            if conflicting_package_bookings:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot extend checkout date. Room(s) are already booked by another package booking ({conflicting_package_bookings.display_id or conflicting_package_bookings.id}) during the extended period."
                )

            # Check for capacity exhaustion due to soft allocations of these room types
            requested_rooms = db.query(Room).filter(Room.id.in_(room_ids), Room.branch_id == branch_id).all()
            type_requested_counts = {}
            for r in requested_rooms:
                if r.room_type_id:
                    type_requested_counts[r.room_type_id] = type_requested_counts.get(r.room_type_id, 0) + 1

            for r_type_id, req_count in type_requested_counts.items():
                total_type_rooms = db.query(Room).filter(
                    Room.room_type_id == r_type_id,
                    Room.branch_id == branch_id,
                    Room.status.notin_(["Deleted", "Maintenance", "Out of Order"])
                ).count()

                assigned_reg = db.query(BookingRoom).join(Booking).join(Room).filter(
                    Room.room_type_id == r_type_id,
                    Booking.branch_id == branch_id,
                    func.lower(Booking.status).in_(active_statuses),
                    Booking.check_in < new_checkout_date,
                    Booking.check_out > booking.check_out
                ).count()

                assigned_pkg = db.query(PackageBookingRoom).join(PackageBooking).join(Room).filter(
                    Room.room_type_id == r_type_id,
                    PackageBooking.id != booking_id,
                    PackageBooking.branch_id == branch_id,
                    func.lower(PackageBooking.status).in_(active_statuses),
                    PackageBooking.check_in < new_checkout_date,
                    PackageBooking.check_out > booking.check_out
                ).count()

                soft_sum = db.query(func.sum(Booking.num_rooms)).filter(
                    Booking.room_type_id == r_type_id,
                    Booking.branch_id == branch_id,
                    func.lower(Booking.status).in_(active_statuses),
                    Booking.check_in < new_checkout_date,
                    Booking.check_out > booking.check_out,
                    ~Booking.booking_rooms.any()
                ).scalar()
                soft_count = int(soft_sum) if soft_sum else 0

                avail_capacity = total_type_rooms - (assigned_reg + assigned_pkg + soft_count)
                if req_count > avail_capacity:
                    rt = db.query(RoomType).filter(RoomType.id == r_type_id).first()
                    rt_name = rt.name if rt else f"Type {r_type_id}"
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot extend checkout date. Room type '{rt_name}' does not have enough available rooms for the extended dates (Available: {max(0, avail_capacity)}, Requested: {req_count})."
                    )
    
    # Update the checkout date
    booking.check_out = new_checkout_date
    db.commit()
    db.refresh(booking)
    
    # Reload booking with relationships for response
    booking_with_rooms = db.query(PackageBooking).options(
        joinedload(PackageBooking.rooms).joinedload(PackageBookingRoom.room),
        joinedload(PackageBooking.package)
    ).filter(PackageBooking.id == booking_id).first()
    
    return booking_with_rooms

@router.put("/booking/{booking_id}/check-in", response_model=PackageBookingOut)
def check_in_package_booking(
    booking_id: Union[str, int],
    id_card_image: UploadFile = File(...),
    guest_photo: UploadFile = File(...),
    room_ids: Optional[str] = Form(None),
    amenityAllocation: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Parse display ID (PK-000001) or accept numeric ID
    numeric_id, booking_type = parse_display_id(str(booking_id))
    if numeric_id is None:
        raise HTTPException(status_code=400, detail=f"Invalid booking ID format: {booking_id}")
    booking_id = numeric_id
    
    success, result = crud_package.check_in_package(db, booking_id, current_user, id_card_image, guest_photo, room_ids, amenityAllocation)
    if not success:
        raise HTTPException(status_code=400, detail=result)
    return result
