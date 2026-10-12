from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
import os
# Absolute project root path (ResortApp/)
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_UPLOAD_ROOT = os.path.join(_BASE_DIR, "uploads")
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError # Added import
from sqlalchemy import func
from typing import List, Optional
import shutil
import uuid
from datetime import timezone, datetime, timedelta, date
from app.utils.date_utils import get_ist_now, get_ist_today
from app.utils.auth import get_db, get_current_user
from app.utils.branch_scope import get_branch_id
from app.utils.booking_id import parse_display_id, format_display_id
from app.models.user import User
from app.models.inventory import (
    InventoryCategory, InventoryItem, Vendor, PurchaseMaster, PurchaseDetail,
    InventoryTransaction, StockRequisition, StockIssue, WasteLog, Location,
    AssetMapping, AssetRegistry, LocationStock, LaundryLog
)

from app.curd import inventory as inventory_crud
from app.schemas.inventory import (
    InventoryCategoryCreate, InventoryCategoryUpdate, InventoryCategoryOut,
    InventoryItemCreate, InventoryItemUpdate, InventoryItemOut,
    VendorCreate, VendorUpdate, VendorOut,
    PurchaseMasterCreate, PurchaseMasterUpdate, PurchaseMasterOut,
    PurchaseDetailOut, InventoryTransactionOut,
    StockRequisitionCreate, StockRequisitionOut, StockRequisitionUpdate,
    StockIssueCreate, StockIssueOut,
    WasteLogCreate, WasteLogOut,
    LocationCreate, LocationOut, LocationUpdate,
    AssetMappingCreate, AssetMappingOut, AssetMappingUpdate,
    AssetRegistryCreate, AssetRegistryOut, AssetRegistryUpdate,
    StockAdjustmentCreate,
    LaundryLogCreate, LaundryLogOut, LaundryLogUpdate,
    InterBranchTransferCreate, InterBranchTransferOut
)


router = APIRouter(prefix="/inventory", tags=["Inventory"])

UPLOAD_DIR = os.path.join(_UPLOAD_ROOT, "inventory_items")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# Category Endpoints
@router.post("/categories", response_model=InventoryCategoryOut)
def create_category(
    category: InventoryCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    return inventory_crud.create_category(db, category, branch_id=branch_id)


@router.get("/categories", response_model=List[InventoryCategoryOut])
def get_categories(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    categories = inventory_crud.get_all_categories(db, skip=skip, limit=limit, active_only=active_only, branch_id=branch_id)
    return categories


@router.put("/categories/{category_id}", response_model=InventoryCategoryOut)
def update_category(
    category_id: int,
    category: InventoryCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    updated = inventory_crud.update_category(db, category_id, category, branch_id=branch_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Category not found in this branch")
    return updated


@router.delete("/categories/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    # Check if category exists in this branch
    category = inventory_crud.get_category_by_id(db, category_id, branch_id=branch_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found in this branch")
    
    # Check if category has active items
    items_count = db.query(InventoryItem).filter(InventoryItem.category_id == category_id, InventoryItem.is_active == True).count()
    if items_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete category with active items")
        
    # Soft delete
    category.is_active = False
    db.commit()
    return {"message": "Category deleted successfully"}


# Item Endpoints
@router.post("/items", response_model=InventoryItemOut)
async def create_item(
    name: str = Form(...),
    item_code: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    category_id: int = Form(...),
    sub_category: Optional[str] = Form(None),
    hsn_code: Optional[str] = Form(None),
    unit: str = Form("pcs"),
    initial_stock: float = Form(0.0),
    min_stock_level: float = Form(0.0),
    max_stock_level: Optional[float] = Form(None),
    unit_price: float = Form(0.0),
    selling_price: Optional[float] = Form(None),
    gst_rate: float = Form(0.0),
    location: Optional[str] = Form(None),
    barcode: Optional[str] = Form(None),
    is_perishable: bool = Form(False),
    track_serial_number: bool = Form(False),
    is_sellable_to_guest: bool = Form(False),
    track_laundry_cycle: bool = Form(False),
    is_asset_fixed: bool = Form(False),
    maintenance_schedule_days: Optional[int] = Form(None),
    complimentary_limit: Optional[int] = Form(None),
    ingredient_yield_percentage: Optional[float] = Form(None),
    preferred_vendor_id: Optional[int] = Form(None),
    vendor_item_code: Optional[str] = Form(None),
    lead_time_days: Optional[int] = Form(None),
    is_active: bool = Form(True),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):

    try:
        # Verify category exists
        category = inventory_crud.get_category_by_id(db, category_id)
        if not category:
            raise HTTPException(status_code=404, detail=f"Category with id {category_id} not found")
        
        # Handle image upload
        image_path = None
        if image and image.filename:
            filename = f"item_{uuid.uuid4().hex}_{image.filename}"
            file_path = os.path.join(UPLOAD_DIR, filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(image.file, buffer)
            image_path = f"uploads/inventory_items/{filename}".replace("\\", "/")
        
        # Sanitize optional unique fields to avoid empty string duplicates
        if barcode == "" or (isinstance(barcode, str) and barcode.lower() == "null"):
            barcode = None
        if vendor_item_code == "" or (isinstance(vendor_item_code, str) and vendor_item_code.lower() == "null"):
            vendor_item_code = None
        if item_code == "" or (isinstance(item_code, str) and item_code.lower() == "null"):
            item_code = None

        # Generate item_code if missing
        if not item_code:
            import random
            while True:
                # Pattern: ITM-XXXX
                new_code = f"ITM-{random.randint(1000, 9999)}"
                # Check if exists
                exists = db.query(InventoryItem).filter(InventoryItem.item_code == new_code).first()
                if not exists:
                    item_code = new_code
                    break
        
        # Check if category enforces fixed asset status
        if category.is_asset_fixed:
            is_asset_fixed = True

        # Create item with 0 initial stock
        created_item = InventoryItem(
            name=name,
            item_code=item_code,
            description=description,
            category_id=category_id,
            sub_category=sub_category,
            hsn_code=hsn_code,
            unit=unit,
            current_stock=0.0,  # Always 0 at creation
            min_stock_level=min_stock_level,
            max_stock_level=max_stock_level,
            unit_price=unit_price,
            selling_price=selling_price,
            gst_rate=gst_rate,
            location=location,
            barcode=barcode,
            image_path=image_path,
            is_perishable=is_perishable,
            track_serial_number=track_serial_number,
            is_sellable_to_guest=is_sellable_to_guest,
            track_laundry_cycle=track_laundry_cycle,
            is_asset_fixed=is_asset_fixed,
            maintenance_schedule_days=maintenance_schedule_days,
            complimentary_limit=complimentary_limit,
            ingredient_yield_percentage=ingredient_yield_percentage,
            preferred_vendor_id=preferred_vendor_id,
            vendor_item_code=vendor_item_code,
            lead_time_days=lead_time_days,
            is_active=is_active,
            branch_id=branch_id  # FIXED: branch_id was commented out
        )
        
        db.add(created_item)
        try:
            db.flush()  # Get the ID
        except IntegrityError as e:
            db.rollback()
            err_msg = str(e).lower()
            if "uix_inventory_item_code" in err_msg:
                raise HTTPException(status_code=400, detail="Item Code already exists. Please use a unique code.")
            elif "uix_inventory_item_barcode" in err_msg:
                raise HTTPException(status_code=400, detail="Barcode already exists.")
            elif "uix_inventory_item_name" in err_msg or "inventory_items_name_key" in err_msg:
                 raise HTTPException(status_code=400, detail="Item Name already exists.")
            elif "branch_id" in err_msg and "null" in err_msg:
                 raise HTTPException(status_code=400, detail="Branch assignment missing. Please ensure your user is assigned to a branch.")
            else:
                print(f"Database Error: {e}")
                raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")
        
        # NOTE: Initial stock transaction logic removed as per user request (initial stock always 0)
        
        db.commit()
        db.refresh(created_item)
        
        # Convert SQLAlchemy model to dict
        item_dict = {
            key: getattr(created_item, key)
            for key in created_item.__table__.columns.keys()
        }
        item_dict["category_name"] = category.name
        item_dict["department"] = category.parent_department  # Add department from category
        item_dict["current_stock"] = 0.0
        item_dict["is_low_stock"] = False
        
        return item_dict
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating item: {str(e)}")


@router.get("/items", response_model=List[InventoryItemOut])
def get_items(
    skip: int = 0,
    limit: int = 100,
    category_id: Optional[int] = None,
    active_only: bool = True,
    is_fixed_asset: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):

    """Optimized endpoint with eager loading - no N+1 queries"""
    try:
        items = inventory_crud.get_all_items(
            db, 
            skip=skip, 
            limit=limit, 
            category_id=category_id, 
            active_only=active_only,
            is_fixed_asset=is_fixed_asset,
            branch_id=branch_id
        )
        
        # Fetch last purchase prices efficiently
        item_ids = [i.id for i in items]
        last_prices = {}
        if item_ids:
            # Fetch most recent purchase details for these items using DISTINCT ON (PostgreSQL)
            # statuses: confirmed or received are valid for "last price"
            # Note: order_by must start with the distinct column
            rows = db.query(
                PurchaseDetail.item_id, 
                PurchaseDetail.unit_price, 
                PurchaseMaster.purchase_date, 
                PurchaseMaster.vendor_id
            ).join(PurchaseMaster)\
             .filter(PurchaseDetail.item_id.in_(item_ids))\
             .filter(PurchaseMaster.status.in_(['received', 'confirmed']))\
             .distinct(PurchaseDetail.item_id)\
             .order_by(PurchaseDetail.item_id, PurchaseMaster.purchase_date.desc(), PurchaseDetail.id.desc())\
             .all()
            
            # Since we used DISTINCT ON, each item_id appears at most once
            vendor_ids = set()
            for iid, price, pdate, vid in rows:
                last_prices[iid] = {
                    "price": float(price) if price else 0.0,
                    "date": pdate,
                    "vendor_id": vid
                }
                if vid: vendor_ids.add(vid)
            
            # Fetch vendor names
            vendor_names = {}
            if vendor_ids:
                v_query = db.query(Vendor).filter(Vendor.id.in_(vendor_ids))
                if branch_id is not None:
                    v_query = v_query.filter(Vendor.branch_id == branch_id)
                vendors = v_query.all()
                vendor_names = {v.id: v.name for v in vendors}

        # Fetch branch-specific stocks
        stock_q = db.query(
            LocationStock.item_id, 
            func.sum(LocationStock.quantity).label("total")
        ).filter(
            LocationStock.item_id.in_(item_ids)
        )
        if branch_id is not None:
            stock_q = stock_q.filter(LocationStock.branch_id == branch_id)
        branch_stocks = stock_q.group_by(LocationStock.item_id).all()
        
        branch_stock_map = {item_id: float(total) for item_id, total in branch_stocks}

        result = []
        for item in items:
            try:
                # Category is already loaded via eager loading, no extra query needed
                category = getattr(item, "category", None)
                last_p = last_prices.get(item.id, {})
                
                # Use branch-specific stock if available, else 0
                current_branch_stock = branch_stock_map.get(item.id, 0.0)
                
                # Build item dict safely from model attributes to avoid __dict__ issues
                item_dict = {
                    "id": item.id,
                    "name": item.name,
                    "item_code": item.item_code,
                    "description": item.description,
                    "category_id": item.category_id,
                    "sub_category": item.sub_category,
                    "hsn_code": item.hsn_code,
                    "unit": item.unit,
                    "min_stock_level": item.min_stock_level,
                    "max_stock_level": item.max_stock_level,
                    "unit_price": item.unit_price,
                    "selling_price": item.selling_price,
                    "gst_rate": item.gst_rate,
                    "location": item.location,
                    "barcode": item.barcode,
                    "image_path": item.image_path,
                    "is_perishable": item.is_perishable,
                    "track_serial_number": item.track_serial_number,
                    "is_sellable_to_guest": item.is_sellable_to_guest,
                    "track_laundry_cycle": item.track_laundry_cycle,
                    "is_asset_fixed": item.is_asset_fixed,
                    "maintenance_schedule_days": item.maintenance_schedule_days,
                    "complimentary_limit": item.complimentary_limit,
                    "ingredient_yield_percentage": item.ingredient_yield_percentage,
                    "preferred_vendor_id": item.preferred_vendor_id,
                    "vendor_item_code": item.vendor_item_code,
                    "lead_time_days": item.lead_time_days,
                    "is_active": item.is_active,
                    "created_at": item.created_at,
                    "updated_at": item.updated_at,
                    "category_name": category.name if category else None,
                    "department": category.parent_department if category else None,
                    "current_stock": current_branch_stock,
                    "is_low_stock": current_branch_stock <= item.min_stock_level if item.min_stock_level else False,
                    "last_purchase_price": last_p.get("price", 0.0),
                    "last_purchase_date": last_p.get("date"),
                    "last_vendor_name": vendor_names.get(last_p.get("vendor_id")) if last_p.get("vendor_id") else None,
                    "branch_name": "Enterprise",
                    "branch_id": branch_id or 1
                }

                # Add category object for frontend grouping
                if category:
                    item_dict["category"] = {
                        "id": category.id,
                        "name": category.name,
                        "classification": category.classification
                    }
                result.append(item_dict)
            except Exception as item_err:
                print(f"Error processing item {item.id}: {item_err}")
                import traceback
                traceback.print_exc()
                continue
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching items: {str(e)}")


@router.get("/items/{item_id}", response_model=InventoryItemOut)
def get_item(
    item_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    item = inventory_crud.get_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Fetch branch-specific stock
    stock_q = db.query(func.sum(LocationStock.quantity)).filter(
        LocationStock.item_id == item_id
    )
    if branch_id is not None:
        stock_q = stock_q.filter(LocationStock.branch_id == branch_id)
    branch_stock = stock_q.scalar() or 0.0
    
    category = inventory_crud.get_category_by_id(db, item.category_id)
    return {
        **item.__dict__,
        "category_name": category.name if category else None,
        "department": category.parent_department if category else None,  # Add department from category
        "current_stock": float(branch_stock),
        "is_low_stock": float(branch_stock) <= item.min_stock_level
    }




@router.get("/items/{item_id}/stocks")
def get_item_stocks(
    item_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    """Get stock distribution for an item across all locations in the current branch"""
    return inventory_crud.get_item_stocks(db, item_id, branch_id=branch_id)



@router.get("/items/{item_id}/comprehensive-details")
def get_item_comprehensive_details(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):

    from sqlalchemy import func

    # 1. Basic Item Details
    item = inventory_crud.get_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    category = inventory_crud.get_category_by_id(db, item.category_id)
    
    # 2. Location Stocks
    stocks_q = db.query(LocationStock, Location.name, Location.location_type)\
        .join(Location, LocationStock.location_id == Location.id)\
        .filter(LocationStock.item_id == item_id, LocationStock.quantity != 0)
    if branch_id is not None:
        stocks_q = stocks_q.filter(LocationStock.branch_id == branch_id)
    stocks_query = stocks_q.all()

        
    location_stocks = []
    for stock, loc_name, loc_type in stocks_query:
        location_stocks.append({
            "location_id": stock.location_id,
            "location_name": loc_name,
            "location_type": loc_type,
            "quantity": float(stock.quantity),
            "last_updated": stock.last_updated
        })

    # 3. Purchase History & Stats
    purchases_q = db.query(PurchaseDetail, PurchaseMaster)\
        .join(PurchaseMaster, PurchaseDetail.purchase_master_id == PurchaseMaster.id)\
        .filter(PurchaseDetail.item_id == item_id, PurchaseMaster.status.in_(['received', 'confirmed']))
    if branch_id is not None:
        purchases_q = purchases_q.filter(PurchaseMaster.branch_id == branch_id)
    purchases_query = purchases_q.order_by(PurchaseMaster.purchase_date.desc()).all()


    total_purchased_qty = 0.0
    total_purchased_val = 0.0
    purchase_history = []
    
    for detail, master in purchases_query:
        qty = float(detail.quantity or 0)
        val = float(detail.total_amount or 0)
        total_purchased_qty += qty
        total_purchased_val += val
        
        # Get vendor name safely
        vendor_name = master.vendor.name if master.vendor else "Unknown"
        
        purchase_history.append({
            "date": master.purchase_date,
            "purchase_number": master.purchase_number,
            "vendor_name": vendor_name,
            "quantity": qty,
            "unit_price": float(detail.unit_price or 0),
            "total_amount": val
        })

    avg_purchase_price = (total_purchased_val / total_purchased_qty) if total_purchased_qty > 0 else 0.0

    # 4. Usage (Consumption) History & Stats (Transactions type='out', Ref starts with ISS)
    usage_q = db.query(InventoryTransaction)\
        .filter(
            InventoryTransaction.item_id == item_id, 
            InventoryTransaction.transaction_type == 'out',
            InventoryTransaction.reference_number.like('ISS-%')
        )
    if branch_id is not None:
        usage_q = usage_q.filter(InventoryTransaction.branch_id == branch_id)
    usage_query = usage_q.order_by(InventoryTransaction.created_at.desc()).all()


    total_consumed_qty = 0.0
    total_consumed_val = 0.0
    usage_history = []
    
    for trans in usage_query:
        qty = float(trans.quantity or 0)
        val = float(trans.total_amount or 0)
        total_consumed_qty += qty
        total_consumed_val += val
        
        usage_history.append({
            "date": trans.created_at,
            "reference": trans.reference_number,
            "quantity": qty,
            "notes": trans.notes or "Consumption"
        })

    # 5. Wastage History & Stats
    waste_q = db.query(WasteLog, Location.name)\
        .outerjoin(Location, WasteLog.location_id == Location.id)\
        .filter(WasteLog.item_id == item_id)
    if branch_id is not None:
        waste_q = waste_q.filter(WasteLog.branch_id == branch_id)
    waste_query = waste_q.order_by(WasteLog.waste_date.desc()).all()

        
    total_wasted_qty = 0.0
    waste_history = []
    
    for log, loc_name in waste_query:
        qty = float(log.quantity or 0)
        total_wasted_qty += qty
        
        waste_history.append({
            "date": log.waste_date,
            "reference": log.log_number,
            "location": loc_name or "Unknown",
            "quantity": qty,
            "reason": log.reason_code,
            "notes": log.notes
        })

    # Calculate wastage value from transactions
    waste_val_q = db.query(func.sum(InventoryTransaction.total_amount))\
        .filter(
            InventoryTransaction.item_id == item_id,
            InventoryTransaction.transaction_type == 'out',
            InventoryTransaction.reference_number.like('WASTE-%')
        )
    if branch_id is not None:
        waste_val_q = waste_val_q.filter(InventoryTransaction.branch_id == branch_id)
    waste_trans_query = waste_val_q.scalar()

    total_wasted_val = float(waste_trans_query or 0)

    # 6. Transfers (Stock Movement)
    transfer_q = db.query(InventoryTransaction)\
        .filter(
            InventoryTransaction.item_id == item_id,
            InventoryTransaction.transaction_type.in_(['transfer_out', 'transfer_in', 'transfer'])
        )
    if branch_id is not None:
        transfer_q = transfer_q.filter(InventoryTransaction.branch_id == branch_id)
    transfer_query = transfer_q.order_by(InventoryTransaction.created_at.desc()).all()

        
    transfer_history = []
    for trans in transfer_query:
        transfer_history.append({
            "date": trans.created_at,
            "type": trans.transaction_type,
            "reference": trans.reference_number,
            "quantity": float(trans.quantity or 0),
            "department": trans.department,
            "notes": trans.notes
        })

    # Convert item to dict handling SQLAlchemy internal state
    item_dict = {c.name: getattr(item, c.name) for c in item.__table__.columns}
    item_dict["category_name"] = category.name if category else None

    return {
        "item": {**item_dict, "current_stock": float(sum(ls["quantity"] for ls in location_stocks))},
        "location_stocks": location_stocks,

        "stats": {
            "total_purchased_qty": total_purchased_qty,
            "total_purchased_val": total_purchased_val,
            "avg_purchase_price": avg_purchase_price,
            "total_consumed_qty": total_consumed_qty,
            "total_consumed_val": total_consumed_val,
            "total_wasted_qty": total_wasted_qty,
            "total_wasted_val": total_wasted_val,
        },
        "history": {
            "purchases": purchase_history,
            "usage": usage_history,
            "wastage": waste_history,
            "transfers": transfer_history
        }
    }


@router.put("/items/{item_id}", response_model=InventoryItemOut)
async def update_item(
    item_id: int,
    name: Optional[str] = Form(None),
    item_code: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    category_id: Optional[int] = Form(None),
    sub_category: Optional[str] = Form(None),
    hsn_code: Optional[str] = Form(None),
    unit: Optional[str] = Form(None),
    min_stock_level: Optional[float] = Form(None),
    max_stock_level: Optional[float] = Form(None),
    unit_price: Optional[float] = Form(None),
    selling_price: Optional[float] = Form(None),
    gst_rate: Optional[float] = Form(None),
    location: Optional[str] = Form(None),
    barcode: Optional[str] = Form(None),
    is_perishable: Optional[bool] = Form(None),
    track_serial_number: Optional[bool] = Form(None),
    is_sellable_to_guest: Optional[bool] = Form(None),
    track_laundry_cycle: Optional[bool] = Form(None),
    is_asset_fixed: Optional[bool] = Form(None),
    maintenance_schedule_days: Optional[int] = Form(None),
    complimentary_limit: Optional[int] = Form(None),
    ingredient_yield_percentage: Optional[float] = Form(None),
    preferred_vendor_id: Optional[int] = Form(None),
    vendor_item_code: Optional[str] = Form(None),
    lead_time_days: Optional[int] = Form(None),
    is_active: Optional[bool] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):

    try:
        # Handle image upload if provided
        image_path = None
        if image and image.filename:
            filename = f"item_{uuid.uuid4().hex}_{image.filename}"
            file_path = os.path.join(UPLOAD_DIR, filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(image.file, buffer)
            image_path = f"uploads/inventory_items/{filename}".replace("\\", "/")
        
        # Sanitize optional unique fields
        if barcode == "" or (isinstance(barcode, str) and barcode.lower() == "null"):
            barcode = None
        if vendor_item_code == "" or (isinstance(vendor_item_code, str) and vendor_item_code.lower() == "null"):
            vendor_item_code = None
        if item_code == "" or (isinstance(item_code, str) and item_code.lower() == "null"):
            item_code = None
        
        # Construct update data
        update_data = InventoryItemUpdate(
            name=name,
            item_code=item_code,
            description=description,
            category_id=category_id,
            sub_category=sub_category,
            hsn_code=hsn_code,
            unit=unit,
            min_stock_level=min_stock_level,
            max_stock_level=max_stock_level,
            unit_price=unit_price,
            selling_price=selling_price,
            gst_rate=gst_rate,
            location=location,
            barcode=barcode,
            image_path=image_path,
            is_perishable=is_perishable,
            track_serial_number=track_serial_number,
            is_sellable_to_guest=is_sellable_to_guest,
            track_laundry_cycle=track_laundry_cycle,
            is_asset_fixed=is_asset_fixed,
            maintenance_schedule_days=maintenance_schedule_days,
            complimentary_limit=complimentary_limit,
            ingredient_yield_percentage=ingredient_yield_percentage,
            preferred_vendor_id=preferred_vendor_id,
            vendor_item_code=vendor_item_code,
            lead_time_days=lead_time_days,
            is_active=is_active
        )
        
        # Check if category enforces fixed asset status
        # Get specified category or current item category
        check_cat_id = category_id if category_id is not None else None
        
        # If no new category specified, need to fetch current item's category to check
        if check_cat_id is None:
             current_item = inventory_crud.get_item_by_id(db, item_id)
             if current_item:
                 check_cat_id = current_item.category_id

        if check_cat_id:
            cat_obj = inventory_crud.get_category_by_id(db, check_cat_id)
            if cat_obj and cat_obj.is_asset_fixed:
                update_data.is_asset_fixed = True

        updated = inventory_crud.update_item(db, item_id, update_data)
        if not updated:
            raise HTTPException(status_code=404, detail="Item not found")
            
        # Get category for response
        category = inventory_crud.get_category_by_id(db, updated.category_id)
        
        # Fetch branch-specific stock for response
        from app.models.inventory import LocationStock
        branch_stock = db.query(func.sum(LocationStock.quantity)).filter(
            LocationStock.item_id == updated.id,
            LocationStock.branch_id == branch_id
        ).scalar() or 0.0

        return {
            **updated.__dict__,
            "category_name": category.name if category else None,
            "department": category.parent_department if category else None,
            "current_stock": float(branch_stock),
            "is_low_stock": float(branch_stock) <= updated.min_stock_level if updated.min_stock_level else False
        }

    except IntegrityError as e:
        db.rollback()
        err_msg = str(e).lower()
        if "uix_inventory_item_code" in err_msg or "item_code" in err_msg:
            raise HTTPException(status_code=400, detail="Item Code already exists.")
        elif "uix_inventory_item_barcode" in err_msg or "barcode" in err_msg:
            raise HTTPException(status_code=400, detail="Barcode already exists.")
        elif "uix_inventory_item_name" in err_msg or "ix_inventory_items_name" in err_msg:
            raise HTTPException(status_code=400, detail="Item Name already exists.")
        else:
             raise HTTPException(status_code=400, detail=f"Database integrity error: {err_msg}")
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error updating item: {str(e)}")


@router.delete("/items/{item_id}")
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    try:
        item = inventory_crud.get_item_by_id(db, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        
        # Always soft delete
        item.is_active = False
        db.commit()
        return {"message": "Item deleted successfully"}
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error deleting item: {str(e)}")


# Vendor Endpoints
@router.post("/vendors", response_model=VendorOut)
def create_vendor(
    vendor: VendorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    return inventory_crud.create_vendor(db, vendor, branch_id=branch_id)


@router.get("/vendors", response_model=List[VendorOut])
def get_vendors(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    vendors = inventory_crud.get_all_vendors(db, branch_id=branch_id, skip=skip, limit=limit, active_only=active_only)
    
    # Enrich with branch name
    result = []
    for v in vendors:
        v_dict = {**v.__dict__}
        if hasattr(v, 'branch') and v.branch:
            v_dict['branch_name'] = v.branch.name
        else:
            v_dict['branch_name'] = "Main"
        result.append(v_dict)
    return result


@router.get("/vendors/{vendor_id}", response_model=VendorOut)
def get_vendor(
    vendor_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    vendor = inventory_crud.get_vendor_by_id(db, vendor_id, branch_id=branch_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor


@router.put("/vendors/{vendor_id}", response_model=VendorOut)
def update_vendor(
    vendor_id: int,
    vendor_update: VendorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    vendor = inventory_crud.get_vendor_by_id(db, vendor_id, branch_id=branch_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    for field, value in vendor_update.model_dump(exclude_unset=True).items():
        setattr(vendor, field, value)
    
    db.commit()
    db.refresh(vendor)
    return vendor


# Purchase Master Endpoints
@router.post("/purchases", response_model=PurchaseMasterOut)
def create_purchase(
    purchase: PurchaseMasterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):

    print(f"[DEBUG CREATE_PURCHASE] Received purchase data:")
    print(f"  Status: {purchase.status}")
    print(f"  Destination Location ID: {purchase.destination_location_id}")
    print(f"  Details count: {len(purchase.details)}")
    
    # 1. MANDATORY RULE: Before creating a purchase, at least one Main Inventory is mandatory
    from app.models.inventory import Location
    from sqlalchemy import or_, func

    effective_branch_id = branch_id
    if (not effective_branch_id or str(effective_branch_id).lower() == "all") and purchase.destination_location_id:
        loc = db.query(Location).filter(Location.id == purchase.destination_location_id).first()
        if loc:
            effective_branch_id = loc.branch_id

    # Check for at least one active Main Inventory (warehouse / central store / inventory point)
    main_inv_query = db.query(Location).filter(
        Location.is_active == True,
        or_(
            Location.is_inventory_point == True,
            func.upper(Location.location_type).in_(["MAIN_INVENTORY", "WAREHOUSE", "CENTRAL_WAREHOUSE", "BRANCH_STORE", "SUB_STORE"]),
            func.lower(Location.name).like("%main inventory%"),
            func.lower(Location.name).like("%main warehouse%"),
            func.lower(Location.name).like("%central store%"),
            func.lower(Location.name).like("%central warehouse%"),
            func.lower(Location.name).like("%main store%")
        )
    )
    if effective_branch_id and str(effective_branch_id).lower() != "all":
        main_inv_query = main_inv_query.filter(Location.branch_id == effective_branch_id)

    main_inventories = main_inv_query.all()
    if not main_inventories:
        raise HTTPException(
            status_code=400,
            detail="Before creating a purchase, at least one Main Inventory is mandatory. Please configure a Main Inventory (Warehouse / Central Store) location for this branch first."
        )

    # Validate destination location if provided, or auto-assign the branch's primary Main Inventory
    if purchase.destination_location_id:
        dest_loc = db.query(Location).filter(
            Location.id == purchase.destination_location_id,
            Location.is_active == True
        ).first()
        if not dest_loc:
            raise HTTPException(
                status_code=400,
                detail="Selected destination location does not exist or is inactive."
            )
        if effective_branch_id and str(effective_branch_id).lower() != "all" and dest_loc.branch_id != effective_branch_id:
            raise HTTPException(
                status_code=400,
                detail="Selected destination location does not belong to the active branch."
            )
    else:
        # Auto-assign the primary Main Inventory
        primary_inv = None
        for inv in main_inventories:
            inv_name = (inv.name or "").lower()
            inv_type = (inv.location_type or "").upper()
            if "main" in inv_name or inv_type in ["MAIN_INVENTORY", "CENTRAL_WAREHOUSE"]:
                primary_inv = inv
                break
        if not primary_inv:
            primary_inv = main_inventories[0]

        purchase.destination_location_id = primary_inv.id
        print(f"[AUTO-ASSIGN] No destination location specified in request. Using Main Inventory: {primary_inv.name} (ID: {primary_inv.id})")

    # 2. Create the master record
    created = inventory_crud.create_purchase_master(db, purchase, branch_id=branch_id, created_by=current_user.id)
    
    # 3. Use centralized status update logic to handle inventory, prices, and journal entries
    # If it was created as 'received', we MUST call update_purchase_status to trigger inventory flow
    target_status = purchase.status.lower()
    
    if target_status == "received":
        # CRITICAL FIX: Temporarily reset status in DB to 'draft' to trigger the transition logic
        # since create_purchase_master already saved it as 'received' and committed it.
        # This ensures update_purchase_status sees a change from draft -> received.
        created.status = "draft"
        db.commit()
        
        created = inventory_crud.update_purchase_status(db, created.id, target_status, current_user_id=current_user.id)
    
    # Handle immediate payment journal entry if created as 'paid'
    if purchase.payment_status == "paid":
        from app.utils.accounting_helpers import create_purchase_payment_journal_entry
        vendor = inventory_crud.get_vendor_by_id(db, created.vendor_id)
        vendor_name = (vendor.legal_name or vendor.name) if vendor else "Unknown"
        
        p_date = None
        if created.payment_date:
            if isinstance(created.payment_date, date) and not isinstance(created.payment_date, datetime):
                from datetime import datetime as dt, timezone as tz
                now = dt.now(tz.utc)
                if created.payment_date == now.date():
                    p_date = now
                else:
                    p_date = dt.combine(created.payment_date, dt.min.time()).replace(tzinfo=tz.utc)
            else:
                p_date = created.payment_date

        try:
            create_purchase_payment_journal_entry(
                db=db,
                purchase_id=created.id,
                amount=float(created.total_amount or 0),
                payment_method=created.payment_method or "Cash",
                vendor_name=vendor_name,
                branch_id=branch_id,
                created_by=current_user.id,
                payment_date=p_date
            )
            print(f"[INFO] Immediate payment journal entry created for purchase {created.id}")
        except Exception as e:
            import traceback
            print(f"[WARNING] Could not create immediate payment journal entry: {str(e)}\n{traceback.format_exc()}")

    # Optimized: Batch load items to avoid N+1 queries
    from sqlalchemy.orm import joinedload
    db.refresh(created, ["details"])
    detail_item_ids = [d.item_id for d in created.details if d.item_id]
    items_map = {}
    if detail_item_ids:
        items = db.query(InventoryItem).filter(InventoryItem.id.in_(detail_item_ids)).all()
        items_map = {item.id: item for item in items}
    
    # Load vendor
    vendor = inventory_crud.get_vendor_by_id(db, created.vendor_id, branch_id=branch_id)
    
    # Build details with item names from map
    details = []
    for detail in created.details:
        item = items_map.get(detail.item_id) if detail.item_id else None
        details.append({
            **detail.__dict__,
            "item_name": item.name if item else None
        })
    
    return {
        **created.__dict__,
        "vendor_name": vendor.name if vendor else None,
        "vendor_gst": vendor.gst_number if vendor else None,
        "created_by_name": current_user.name if current_user else None,
        "details": details
    }


@router.get("/purchases", response_model=List[PurchaseMasterOut])
def get_purchases(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    """Optimized with eager loading - no N+1 queries"""
    purchases = inventory_crud.get_all_purchases(db, branch_id=branch_id, skip=skip, limit=limit, status=status)

    result = []
    for purchase in purchases:
        # Vendor, details, items, user, and location already loaded via eager loading
        details = []
        for detail in purchase.details:
            details.append({
                "id": detail.id,
                "purchase_master_id": detail.purchase_master_id,
                "item_id": detail.item_id,
                "item_name": detail.item.name if detail.item else "Unknown",
                "quantity": detail.quantity,
                "unit": detail.unit,
                "unit_price": detail.unit_price,
                "gst_rate": detail.gst_rate,
                "cgst_amount": detail.cgst_amount,
                "sgst_amount": detail.sgst_amount,
                "igst_amount": detail.igst_amount,
                "discount": detail.discount,
                "total_amount": detail.total_amount,
                "hsn_code": detail.hsn_code,
                "notes": detail.notes
            })
        
        result.append({
            "id": purchase.id,
            "purchase_number": purchase.purchase_number,
            "vendor_id": purchase.vendor_id,
            "vendor_name": purchase.vendor.name if purchase.vendor else None,
            "vendor_gst": purchase.vendor.gst_number if purchase.vendor else None,
            "purchase_date": purchase.purchase_date,
            "expected_delivery_date": purchase.expected_delivery_date,
            "invoice_number": purchase.invoice_number,
            "invoice_date": purchase.invoice_date,
            "status": purchase.status,
            "payment_status": purchase.payment_status,
            "payment_method": purchase.payment_method,
            "payment_terms": purchase.payment_terms,
            "payment_date": purchase.payment_date,
            "sub_total": purchase.sub_total,
            "cgst": purchase.cgst,
            "sgst": purchase.sgst,
            "igst": purchase.igst,
            "discount": purchase.discount,
            "total_amount": purchase.total_amount,
            "destination_location_id": purchase.destination_location_id,
            "destination_location_name": purchase.destination_location.name if purchase.destination_location else None,
            "created_by": purchase.created_by,
            "created_by_name": purchase.user.name if purchase.user else None,
            "created_at": purchase.created_at,
            "updated_at": purchase.updated_at,
            "notes": purchase.notes,
            "bill_file_url": purchase.bill_file_url,
            "details": details
        })
    return result


@router.get("/purchases/{purchase_id}", response_model=PurchaseMasterOut)
def get_purchase(
    purchase_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    purchase = inventory_crud.get_purchase_by_id(db, purchase_id, branch_id=branch_id)

    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    
    details = []
    for detail in purchase.details:
        details.append({
            "id": detail.id,
            "purchase_master_id": detail.purchase_master_id,
            "item_id": detail.item_id,
            "item_name": detail.item.name if detail.item else "Unknown",
            "quantity": detail.quantity,
            "unit": detail.unit,
            "unit_price": detail.unit_price,
            "gst_rate": detail.gst_rate,
            "cgst_amount": detail.cgst_amount,
            "sgst_amount": detail.sgst_amount,
            "igst_amount": detail.igst_amount,
            "discount": detail.discount,
            "total_amount": detail.total_amount,
            "hsn_code": detail.hsn_code,
            "notes": detail.notes
        })
    
    return {
        "id": purchase.id,
        "purchase_number": purchase.purchase_number,
        "vendor_id": purchase.vendor_id,
        "vendor_name": purchase.vendor.name if purchase.vendor else None,
        "vendor_gst": purchase.vendor.gst_number if purchase.vendor else None,
        "purchase_date": purchase.purchase_date,
        "expected_delivery_date": purchase.expected_delivery_date,
        "invoice_number": purchase.invoice_number,
        "invoice_date": purchase.invoice_date,
        "status": purchase.status,
        "payment_status": purchase.payment_status,
        "payment_method": purchase.payment_method,
        "payment_terms": purchase.payment_terms,
        "payment_date": purchase.payment_date,
        "sub_total": purchase.sub_total,
        "cgst": purchase.cgst,
        "sgst": purchase.sgst,
        "igst": purchase.igst,
        "discount": purchase.discount,
        "total_amount": purchase.total_amount,
        "destination_location_id": purchase.destination_location_id,
        "destination_location_name": purchase.destination_location.name if purchase.destination_location else None,
        "created_by": purchase.created_by,
        "created_by_name": purchase.user.name if purchase.user else None,
        "created_at": purchase.created_at,
        "updated_at": purchase.updated_at,
        "notes": purchase.notes,
        "bill_file_url": purchase.bill_file_url,
        "details": details
    }


@router.put("/purchases/{purchase_id}", response_model=PurchaseMasterOut)
def update_purchase(
    purchase_id: int,
    purchase_update: PurchaseMasterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    query = db.query(PurchaseMaster).filter(PurchaseMaster.id == purchase_id)
    if branch_id is not None:
        query = query.filter(PurchaseMaster.branch_id == branch_id)
    
    purchase = query.first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found in this branch")

    
    old_status = purchase.status
    new_status = purchase_update.status if purchase_update.status is not None else old_status
    
    updated = inventory_crud.update_purchase_master(db, purchase_id, purchase_update)
    if not updated:
        raise HTTPException(status_code=400, detail="Cannot update purchase")
    
    # CASE 1: Transition Logic (handled centrally in CRUD)
    if purchase_update.status is not None and purchase_update.status.lower() != old_status.lower():
        target_status = purchase_update.status.lower()
        
        # Handle auto-assign location for receiving if needed
        if target_status == "received" and not updated.destination_location_id:
            default_location = db.query(Location).filter(
                Location.location_type.in_(["WAREHOUSE", "CENTRAL_WAREHOUSE", "BRANCH_STORE"]),
                (Location.branch_id == branch_id if branch_id is not None else True)
            ).first()

            if default_location:
                updated.destination_location_id = default_location.id
                db.commit()
        
        # Reset to old status temporarily to ensure CRUD sees a transition
        updated.status = old_status
        db.commit()

        # Call centralized logic
        updated = inventory_crud.update_purchase_status(db, updated.id, target_status, current_user_id=current_user.id)
    
    # CASE 2: Sync Journal Entry Date if payment_date is updated
    if purchase_update.payment_date is not None:
        from app.models.account import JournalEntry
        # Find the journal entry for this purchase payment
        journal_entry = db.query(JournalEntry).filter(
            JournalEntry.reference_type == "purchase_payment",
            JournalEntry.reference_id == purchase_id,
            JournalEntry.branch_id == branch_id
        ).first()

        if journal_entry:
            # Sync the entry_date with the new payment_date
            new_date = datetime.combine(purchase_update.payment_date, datetime.min.time())
            journal_entry.entry_date = new_date
            db.commit()
            print(f"[INFO] Synced JournalEntry {journal_entry.id} to new payment date: {purchase_update.payment_date}")

    # CASE 3: Sync Journal Entry if payment_status changed to 'paid'
    if purchase_update.payment_status == "paid":
        from app.models.account import JournalEntry
        from app.utils.accounting_helpers import create_purchase_payment_journal_entry
        
        # Check if entry already exists to avoid duplicates
        existing_entry = db.query(JournalEntry).filter(
            JournalEntry.reference_type == "purchase_payment",
            JournalEntry.reference_id == purchase_id,
            JournalEntry.branch_id == branch_id
        ).first()

        if not existing_entry:
            vendor = inventory_crud.get_vendor_by_id(db, updated.vendor_id)
            vendor_name = (vendor.legal_name or vendor.name) if vendor else "Unknown"
            
            p_date = None
            if isinstance(updated.payment_date, date) and not isinstance(updated.payment_date, datetime):
                from datetime import datetime as dt, timezone as tz
                now = dt.now(tz.utc)
                if updated.payment_date == now.date():
                    p_date = now
                else:
                    p_date = dt.combine(updated.payment_date, dt.min.time()).replace(tzinfo=tz.utc)
            else:
                p_date = updated.payment_date

            create_purchase_payment_journal_entry(
                db=db,
                purchase_id=updated.id,
                amount=float(updated.total_amount or 0),
                payment_method=updated.payment_method or "Cash",
                vendor_name=vendor_name,
                branch_id=branch_id,
                created_by=current_user.id,
                payment_date=p_date
            )

    db.commit()
    return get_purchase(purchase_id, db, current_user, branch_id=branch_id)



@router.delete("/purchases/{purchase_id}")
def delete_purchase(
    purchase_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):

    query = db.query(PurchaseMaster).filter(PurchaseMaster.id == purchase_id)
    if branch_id is not None:
        query = query.filter(PurchaseMaster.branch_id == branch_id)
    
    purchase = query.first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    
    # Only allow deleting draft purchases
    if purchase.status not in ["draft", "cancelled"]:
        raise HTTPException(status_code=400, detail="Cannot delete purchase that is not draft or cancelled")
    
    # Delete details first
    db.query(PurchaseDetail).filter(PurchaseDetail.purchase_master_id == purchase_id).delete()
    
    db.delete(purchase)
    db.commit()
    return {"message": "Purchase deleted successfully"}


@router.post("/purchases/{purchase_id}/payments")
def create_purchase_payment(
    purchase_id: int,
    payment_data: dict,  # {amount: float, payment_method: str, notes: str}
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    """Record a payment for a purchase (Vendor Payment)"""
    query = db.query(PurchaseMaster).filter(PurchaseMaster.id == purchase_id)
    if branch_id is not None:
        query = query.filter(PurchaseMaster.branch_id == branch_id)
    
    purchase = query.first()

    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    
    try:
        amount = float(payment_data.get("amount", 0))
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Invalid amount")
            
        payment_method = payment_data.get("payment_method", "Bank Transfer")
        notes = payment_data.get("notes", "")
        
        # Create Journal Entry
        # Debit: Accounts Payable (Vendor)
        # Credit: Bank/Cash
        
        from app.utils.accounting_helpers import find_ledger_by_name, create_journal_entry
        from app.schemas.account import JournalEntryCreate, JournalEntryLineCreateInEntry
        
        vendor_payable = find_ledger_by_name(db, "Accounts Payable (Vendor)", "Purchase")
        
        # Determine credit ledger
        if payment_method.lower() in ["cash"]:
            credit_ledger = find_ledger_by_name(db, "Cash in Hand", "Asset")
        else:
            credit_ledger = find_ledger_by_name(db, "Bank Account (HDFC)", "Asset") or find_ledger_by_name(db, "Bank Account", "Asset")
            
        if not all([vendor_payable, credit_ledger]):
             raise HTTPException(status_code=400, detail="Required ledgers not found in Chart of Accounts")
             
        lines = [
            JournalEntryLineCreateInEntry(
                debit_ledger_id=vendor_payable.id,
                credit_ledger_id=None,
                amount=amount,
                description=f"Payment for Purchase #{purchase.purchase_number}"
            ),
            JournalEntryLineCreateInEntry(
                debit_ledger_id=None,
                credit_ledger_id=credit_ledger.id,
                amount=amount,
                description=f"Payment to {purchase.vendor.name if purchase.vendor else 'Vendor'}"
            )
        ]
        
        entry = JournalEntryCreate(
            entry_date=datetime.now(timezone.utc),
            reference_type="purchase_payment",
            reference_id=purchase.id,
            description=f"Vendor Payment - {purchase.purchase_number}",
            notes=f"Method: {payment_method}. {notes}",
            lines=lines,
            branch_id=branch_id
        )

        
        journal_entry = create_journal_entry(db, entry, branch_id=branch_id, created_by=current_user.id)
        
        # Update purchase payment status
        # This is a simplified logic; ideally we sum up all payments
        if amount >= float(purchase.total_amount):
            purchase.payment_status = "paid"
        else:
            purchase.payment_status = "partial"
            
        db.commit()
        
        return {"message": "Payment recorded successfully", "journal_entry_id": journal_entry.id, "payment_status": purchase.payment_status}
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error recording payment: {str(e)}")


@router.post("/purchases/{purchase_id}/upload-bill")
async def upload_purchase_bill(
    purchase_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    query = db.query(PurchaseMaster).filter(PurchaseMaster.id == purchase_id)
    if branch_id is not None:
        query = query.filter(PurchaseMaster.branch_id == branch_id)
    
    purchase = query.first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
        
    try:
        # Create dir if not exist
        bill_dir = os.path.join(_UPLOAD_ROOT, "purchase_bills")
        os.makedirs(bill_dir, exist_ok=True)
        
        # Determine file extension safely
        filename_parts = os.path.splitext(file.filename)
        ext = filename_parts[1] if len(filename_parts) > 1 else ""
        
        # Save file
        filename = f"bill_po_{purchase_id}_{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(bill_dir, filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        rel_path = f"uploads/purchase_bills/{filename}".replace("\\", "/")
        purchase.bill_file_url = rel_path
        db.commit()
        
        return {"message": "Bill uploaded successfully", "bill_file_url": rel_path}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to upload bill: {str(e)}")

@router.patch("/purchases/{purchase_id}/status")
def update_purchase_status(
    purchase_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    # Verify purchase belongs to branch
    query = db.query(PurchaseMaster).filter(PurchaseMaster.id == purchase_id)
    if branch_id is not None:
        query = query.filter(PurchaseMaster.branch_id == branch_id)
    
    purchase_check = query.first()
    if not purchase_check:
        raise HTTPException(status_code=404, detail="Purchase not found in this branch")
        
    purchase = inventory_crud.update_purchase_status(db, purchase_id, status, current_user_id=current_user.id)

    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
        
    # Note: inventory_crud.update_purchase_status already handles 
    # Weighted Average Cost and price updates internally when status is 'received'.
    # Manual price update here is redundant and removed to prevent session synchronization issues.
            
    return {"message": "Purchase status updated successfully", "status": purchase.status}


@router.patch("/purchases/{purchase_id}/payment-status")
def update_purchase_payment_status(
    purchase_id: int,
    payment_status: str,
    payment_method: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    """Update payment status and payment method for a purchase order"""
    query = db.query(PurchaseMaster).filter(PurchaseMaster.id == purchase_id)
    if branch_id is not None:
        query = query.filter(PurchaseMaster.branch_id == branch_id)
    
    purchase = query.first()

    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    
    # Check if payment_status is None or empty
    if not payment_status or payment_status.strip() == "":
        raise HTTPException(status_code=400, detail="Payment status is required")
    
    # Normalize payment status to lowercase for comparison
    payment_status_lower = payment_status.strip().lower()
    
    # Validate payment status
    valid_statuses = ["pending", "partial", "paid"]
    if payment_status_lower not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid payment status. Must be one of: {', '.join(valid_statuses)}")
    
    old_status = purchase.payment_status

    # Update payment status
    purchase.payment_status = payment_status_lower
    
    # Update payment method if provided (handle None and empty strings)
    if payment_method and payment_method.strip():
        purchase.payment_method = payment_method.strip().lower()

    # Manage journal entries based on status change
    if old_status != payment_status_lower:
        from app.models.account import JournalEntry
        if payment_status_lower == "pending":
            # Delete any existing payment journal entries since it is now unpaid
            jes = db.query(JournalEntry).filter(
                JournalEntry.reference_type == "purchase_payment",
                JournalEntry.reference_id == purchase_id
            ).all()
            for je in jes:
                db.delete(je)
        elif payment_status_lower == "paid" and old_status != "paid":
            # Check if one already exists to avoid duplicates
            existing_je = db.query(JournalEntry).filter(
                JournalEntry.reference_type == "purchase_payment",
                JournalEntry.reference_id == purchase_id
            ).first()
            if not existing_je:
                from app.utils.accounting_helpers import create_purchase_payment_journal_entry
                vendor = purchase.vendor
                vendor_name = (vendor.legal_name or vendor.name) if vendor else "Unknown"
                try:
                    create_purchase_payment_journal_entry(
                        db=db,
                        purchase_id=purchase.id,
                        amount=float(purchase.total_amount or 0),
                        payment_method=purchase.payment_method or "Cash",
                        vendor_name=vendor_name,
                        branch_id=branch_id,
                        created_by=current_user.id
                    )
                except Exception as e:
                    print(f"Warning: Could not create payment JE: {e}")
    
    try:
        db.commit()
        db.refresh(purchase)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update payment status: {str(e)}")
    
    return {
        "message": "Payment status updated successfully",
        "payment_status": purchase.payment_status,
        "payment_method": purchase.payment_method
    }


# Transaction Endpoints
@router.get("/transactions", response_model=List[InventoryTransactionOut])
def get_transactions(
    skip: int = 0,
    limit: int = 100,
    item_id: Optional[int] = None,
    # New Filters
    type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    """Optimized with eager loading - no N+1 queries"""
    from sqlalchemy.orm import joinedload
    from sqlalchemy import or_, and_

    query = db.query(InventoryTransaction).join(InventoryItem).options(

        joinedload(InventoryTransaction.item),
        joinedload(InventoryTransaction.user),
        joinedload(InventoryTransaction.source_location),
        joinedload(InventoryTransaction.destination_location)
    )
    
    if branch_id is not None:
        query = query.filter(InventoryTransaction.branch_id == branch_id)
        
    if item_id:
        query = query.filter(InventoryTransaction.item_id == item_id)
        
    # Filter by Type
    if type and type != "all":
        if type == "initial_stock":
             # Special logic for initial stock
             query = query.filter(
                 InventoryTransaction.transaction_type == "in",
                 or_(
                     InventoryTransaction.notes.ilike("%initial stock%"),
                     InventoryTransaction.notes.ilike("%opening balance%")
                 )
             )
        elif type == "purchase":
             # Purchase means 'in' BUT NOT initial stock
             query = query.filter(
                 InventoryTransaction.transaction_type == "in",
                 ~or_(
                     InventoryTransaction.notes.ilike("%initial stock%"),
                     InventoryTransaction.notes.ilike("%opening balance%")
                 )
             )
        elif type == "usage": # Consumption
             query = query.filter(
                 InventoryTransaction.transaction_type == "out",
                 ~or_(
                     InventoryTransaction.notes.ilike("%waste%"),
                     InventoryTransaction.notes.ilike("%spoilage%")
                 )
             )
        elif type == "waste":
             query = query.filter(
                 or_(
                     InventoryTransaction.transaction_type == "waste",
                     and_(
                         InventoryTransaction.transaction_type.in_(["out", "adjustment"]),
                         or_(
                             InventoryTransaction.notes.ilike("%waste%"),
                             InventoryTransaction.notes.ilike("%spoilage%")
                         )
                     )
                 )
             )
        elif type == "laundry":
             query = query.filter(
                 or_(
                     InventoryTransaction.transaction_type == "laundry",
                     and_(
                         InventoryTransaction.transaction_type == "transfer",
                         or_(
                             InventoryTransaction.reference_number.ilike("%LAUNDRY%"),
                             InventoryTransaction.notes.ilike("%laundry%")
                         )
                     )
                 )
             )
        else:
             # Standard types: transfer_in, transfer_out, adjustment, transfer
             query = query.filter(InventoryTransaction.transaction_type == type)

    # Filter by Date
    if start_date:
        try:
            # Handle potential ISO format differences
            s_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            query = query.filter(InventoryTransaction.created_at >= s_date)
        except:
             pass # Ignore invalid date
             
    if end_date:
        try:
             e_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
             # Set to end of day? Usually frontend sends 23:59:59
             query = query.filter(InventoryTransaction.created_at <= e_date)
        except:
             pass

    # Filter by Category
    if category and category != "all":
        query = query.join(InventoryItem.category).filter(InventoryCategory.name == category)

    # Search
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                InventoryItem.name.ilike(search_term),
                InventoryTransaction.notes.ilike(search_term),
                InventoryTransaction.reference_number.ilike(search_term)
            )
        )

    transactions = query.order_by(InventoryTransaction.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for trans in transactions:
        # Relationships already loaded, no extra queries
        trans_dict = {
            **trans.__dict__,
            "item_name": trans.item.name if trans.item else None,
            "created_by_name": trans.user.name if trans.user else None,
            "source_location_name": trans.source_location.name if trans.source_location else None,
            "destination_location_name": trans.destination_location.name if trans.destination_location else None
        }

        # 1. Handle Stock Issues (Transfers)
        if not trans_dict["source_location_name"] and trans.reference_number and trans.reference_number.startswith("ISS-"):
            issue = db.query(StockIssue).filter(StockIssue.issue_number == trans.reference_number).first()
            if issue:
                if issue.source_location_id:
                    src_loc = db.query(Location).filter(Location.id == issue.source_location_id, (Location.branch_id == branch_id if branch_id is not None else True)).first()
                    if src_loc:
                        trans_dict["source_location_name"] = f"{src_loc.building} - {src_loc.room_area}" if (src_loc.building or src_loc.room_area) else src_loc.name
                
                if issue.destination_location_id:
                    dest_loc = db.query(Location).filter(Location.id == issue.destination_location_id, (Location.branch_id == branch_id if branch_id is not None else True)).first()
                    if dest_loc:
                        trans_dict["destination_location_name"] = f"{dest_loc.building} - {dest_loc.room_area}" if (dest_loc.building or dest_loc.room_area) else dest_loc.name

        # 2. Handle Waste Logs
        elif not trans_dict["source_location_name"] and trans.reference_number and trans.reference_number.startswith("WASTE-"):
            waste = db.query(WasteLog).filter(WasteLog.log_number == trans.reference_number).first()
            if waste and waste.location_id:
                w_loc = db.query(Location).filter(Location.id == waste.location_id, (Location.branch_id == branch_id if branch_id is not None else True)).first()
                if w_loc:
                    trans_dict["source_location_name"] = f"{w_loc.building} - {w_loc.room_area}" if (w_loc.building or w_loc.room_area) else w_loc.name

        # 3. Handle Returns and Consumption from Checkout
        elif not trans_dict["source_location_name"] and trans.reference_number and (trans.reference_number.startswith("RET-") or "RM" in (trans.reference_number or "") or "RM" in (trans.notes or "")):
            # Try to extract room number from reference like RET-RM001 or RET-LAUNDRY001
            import re
            room_match = re.search(r'RM(\d+)', trans.reference_number) or re.search(r'RM\s*([A-Za-z0-0-]+)', trans.notes or "")
            if room_match:
                room_num = room_match.group(1)
                trans_dict["source_location_name"] = f"Room {room_num}"
            
            # For returns, destination is usually a warehouse or laundry
            if trans.transaction_type == "transfer_in" and trans.notes:
                if "Laundry" in trans.notes:
                    trans_dict["destination_location_name"] = "Laundry"
                elif "Stock" in trans.notes or "Warehouse" in trans.notes:
                    trans_dict["destination_location_name"] = "Central Warehouse"

        result.append(trans_dict)

    # Fetch food waste logs if relevant
    food_waste_dicts = []
    if not item_id and (not type or type == "all" or type == "waste"):
        from app.models.inventory import WasteLog
        from app.models.food_item import FoodItem
        
        food_query = db.query(WasteLog).filter(WasteLog.is_food_item == True)
        if branch_id is not None:
            food_query = food_query.filter(WasteLog.branch_id == branch_id)
            
        if start_date:
            try:
                s_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                food_query = food_query.filter(WasteLog.created_at >= s_date)
            except:
                pass
        if end_date:
            try:
                e_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                food_query = food_query.filter(WasteLog.created_at <= e_date)
            except:
                pass
                
        if category and category != "all":
            from app.models.food_item import FoodCategory
            food_query = food_query.join(FoodItem, WasteLog.food_item_id == FoodItem.id).join(FoodCategory).filter(FoodCategory.name == category)
            
        if search:
            search_term = f"%{search}%"
            food_query = food_query.join(FoodItem, WasteLog.food_item_id == FoodItem.id).filter(
                or_(
                    FoodItem.name.ilike(search_term),
                    WasteLog.notes.ilike(search_term),
                    WasteLog.log_number.ilike(search_term)
                )
            )
            
        food_waste_logs = food_query.order_by(WasteLog.created_at.desc()).limit(limit + skip).all()
        
        for log in food_waste_logs:
            fi = db.query(FoodItem).filter(FoodItem.id == log.food_item_id).first()
            reporter = db.query(User).filter(User.id == log.reported_by).first()
            w_loc = db.query(Location).filter(Location.id == log.location_id).first() if log.location_id else None
            
            src_loc_name = f"{w_loc.building} - {w_loc.room_area}" if w_loc and (w_loc.building or w_loc.room_area) else (w_loc.name if w_loc else None)
            
            food_waste_dicts.append({
                "id": log.id + 1000000,
                "item_id": None,
                "item_name": fi.name if fi else "Unknown Food Item",
                "transaction_type": "waste",
                "quantity": float(log.quantity),
                "unit_price": float(fi.price or 0) if fi else 0.0,
                "total_amount": float(fi.price or 0) * float(log.quantity) if fi else 0.0,
                "reference_number": log.log_number,
                "purchase_master_id": None,
                "notes": f"WASTE: {log.reason_code} - {log.notes or ''}",
                "created_by": log.reported_by,
                "created_by_name": reporter.name if reporter else None,
                "source_location_name": src_loc_name,
                "destination_location_name": None,
                "created_at": log.created_at,
                "branch_id": log.branch_id
            })

    # Combine standard transactions and food waste logs
    all_transactions = result + food_waste_dicts
    
    # Sort combined list by created_at descending
    all_transactions.sort(key=lambda t: t["created_at"] if isinstance(t["created_at"], datetime) else datetime.fromisoformat(str(t["created_at"]).replace('Z', '+00:00')), reverse=True)
    
    # Apply pagination (skip and limit) on the combined list
    paginated_transactions = all_transactions[skip : skip + limit]
    
    return paginated_transactions


# Stock Requisition Endpoints
@router.post("/requisitions", response_model=StockRequisitionOut)
def create_requisition(
    requisition: StockRequisitionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    try:
        requisition_data = requisition.model_dump()
        created = inventory_crud.create_stock_requisition(db, requisition_data, branch_id=branch_id, created_by=current_user.id)

        
        # Load relationships for response
        requester = db.query(User).filter(User.id == created.requested_by).first()
        details = []
        for detail in created.details:
            item = inventory_crud.get_item_by_id(db, detail.item_id)
            details.append({
                **detail.__dict__,
                "item_name": item.name if item else None
            })
        
        return {
            **created.__dict__,
            "requested_by_name": requester.name if requester else None,
            "details": details
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating requisition: {str(e)}")


@router.get("/requisitions", response_model=List[StockRequisitionOut])
def get_requisitions(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    """Optimized with eager loading - no N+1 queries"""
    requisitions = inventory_crud.get_all_requisitions(db, branch_id=branch_id, skip=skip, limit=limit, status=status)

    result = []
    for req in requisitions:
        # Items already loaded via eager loading
        requester = db.query(User).filter(User.id == req.requested_by).first()
        approver = db.query(User).filter(User.id == req.approved_by).first() if req.approved_by else None
        details = []
        for detail in req.details:
            item = detail.item  # Already loaded
            details.append({
                **detail.__dict__,
                "item_name": item.name if item else None,
                "current_stock": item.current_stock if item else None
            })
        result.append({
            **req.__dict__,
            "requested_by_name": requester.name if requester else None,
            "approved_by_name": approver.name if approver else None,
            "details": details
        })
    return result


@router.patch("/requisitions/{requisition_id}/status")
def update_requisition_status(
    requisition_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    # Verify requisition belongs to branch
    requisition = db.query(StockRequisition).filter(StockRequisition.id == requisition_id, StockRequisition.branch_id == branch_id).first()
    if not requisition:
        raise HTTPException(status_code=404, detail="Requisition not found in this branch")
        
    requisition = inventory_crud.update_requisition_status(db, requisition_id, status, approved_by=current_user.id)

    if not requisition:
        raise HTTPException(status_code=404, detail="Requisition not found")
    return {"message": "Requisition status updated successfully", "status": requisition.status}


@router.put("/requisitions/{requisition_id}/approve-quantities")
def approve_requisition_quantities(
    requisition_id: int,
    approved_quantities: dict,  # {detail_id: approved_quantity}
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update approved quantities for requisition details"""
    for detail_id, approved_qty in approved_quantities.items():
        detail = db.query(StockRequisitionDetail).filter(StockRequisitionDetail.id == detail_id).first()
        if detail and detail.requisition_id == requisition_id:
            detail.approved_quantity = approved_qty
    db.commit()
    return {"message": "Approved quantities updated successfully"}


@router.get("/stocks", response_model=List[dict])
def get_all_stocks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    stocks_q = db.query(LocationStock).filter(LocationStock.quantity > 0)
    if branch_id is not None:
        stocks_q = stocks_q.filter(LocationStock.branch_id == branch_id)
    stocks = stocks_q.all()

    result = []
    for s in stocks:
        result.append({
            "location_id": s.location_id,
            "item_id": s.item_id,
            "quantity": float(s.quantity)
        })
    return result


# Stock Issue Endpoints
@router.post("/issues", response_model=StockIssueOut)
def create_issue(
    issue: StockIssueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    try:
        issue_data = issue.model_dump()
        created = inventory_crud.create_stock_issue(db, issue_data, branch_id=branch_id, issued_by=current_user.id)

        
        # Optimized: Batch load to avoid N+1 queries
        issuer = db.query(User).filter(User.id == created.issued_by).first()
        source_loc = inventory_crud.get_location_by_id(db, created.source_location_id) if created.source_location_id else None
        dest_loc = inventory_crud.get_location_by_id(db, created.destination_location_id) if created.destination_location_id else None
        
        # Batch load items
        detail_item_ids = [d.item_id for d in created.details if d.item_id]
        items_map = {}
        if detail_item_ids:
            from app.models.inventory import InventoryItem
            items = db.query(InventoryItem).filter(InventoryItem.id.in_(detail_item_ids)).all()
            items_map = {item.id: item for item in items}
        
        details = []
        for detail in created.details:
            item = items_map.get(detail.item_id) if detail.item_id else None
            details.append({
                **detail.__dict__,
                "item_name": item.name if item else None
            })
        
        return {
            **created.__dict__,
            "issued_by_name": issuer.name if issuer else None,
            "source_location_name": f"{source_loc.building} - {source_loc.room_area}" if source_loc else None,
            "destination_location_name": f"{dest_loc.building} - {dest_loc.room_area}" if dest_loc else None,
            "details": details
        }
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # If it's already an HTTPException (like our 400 validation error), re-raise it
        if isinstance(e, HTTPException):
            raise e
            
        import traceback
        traceback.print_exc()
        # Log to file for debugging
        try:
            with open("api_stock_issue_error.log", "a") as f:
                f.write(f"\n{'='*80}\n{get_ist_now()}\nError: {str(e)}\n{traceback.format_exc()}{'='*80}\n")
        except:
            pass
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating issue: {str(e)}")


@router.post("/consumption")
def add_inventory_consumption(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    """
    Backward compatibility endpoint for mobile app.
    Translates a flat consumption request into a StockIssue.
    """
    try:
        item_id = data.get("item_id")
        location_id = data.get("location_id")
        quantity = data.get("quantity", 1)
        notes = data.get("notes", "Consumption via mobile")
        booking_id = data.get("booking_id")
        used_by_type = data.get("used_by_type", "guest")
        
        if not item_id or not location_id:
            raise HTTPException(status_code=400, detail="item_id and location_id are required")
            
        # Fetch item to get unit
        item = inventory_crud.get_item_by_id(db, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
            
        # Create StockIssue payload
        issue_data = {
            "destination_location_id": location_id,
            "notes": notes,
            "booking_id": booking_id,
            "details": [
                {
                    "item_id": item_id,
                    "issued_quantity": quantity,
                    "unit": item.unit or "pcs",
                    "notes": notes,
                    "is_payable": (used_by_type == 'guest')
                }
            ]
        }
        
        created = inventory_crud.create_stock_issue(db, issue_data, branch_id=branch_id, issued_by=current_user.id)
        return {"message": "Inventory added successfully", "issue_number": created.issue_number}
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error adding inventory: {str(e)}")


@router.get("/issues", response_model=List[StockIssueOut])
def get_issues(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    """Optimized with eager loading - no N+1 queries"""
    issues = inventory_crud.get_all_issues(db, branch_id=branch_id, skip=skip, limit=limit)

    result = []
    for issue in issues:
        # Locations and items already loaded via eager loading
        issuer = db.query(User).filter(User.id == issue.issued_by).first()
        source_loc = issue.source_location  # Already loaded
        dest_loc = issue.destination_location  # Already loaded
        details = []
        for detail in issue.details:
            item = detail.item  # Already loaded
            # Parse payment status from notes
            is_paid = detail.notes and "PAID" in detail.notes.upper() if detail.notes else False
            details.append({
                **detail.__dict__,
                "item_name": item.name if item else None,
                "is_paid": is_paid
            })
        result.append({
            **issue.__dict__,
            "issued_by_name": issuer.name if issuer else None,
            "source_location_name": f"{source_loc.building} - {source_loc.room_area}" if source_loc else None,
            "destination_location_name": f"{dest_loc.building} - {dest_loc.room_area}" if dest_loc else None,
            "details": details
        })
    return result


@router.patch("/issues/{issue_id}/details/{detail_id}")
def update_issue_detail(
    issue_id: int,
    detail_id: int,
    is_payable: Optional[bool] = None,
    is_paid: Optional[bool] = None,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update issue detail payable/paid status"""
    from app.models.inventory import StockIssueDetail
    
    detail = db.query(StockIssueDetail).join(StockIssue).filter(
        StockIssueDetail.id == detail_id,
        StockIssueDetail.issue_id == issue_id,
        StockIssue.branch_id == branch_id
    ).first()
    
    if not detail:
        raise HTTPException(status_code=404, detail="Issue detail not found")
    
    # Update notes to reflect payable and paid status
    current_notes = detail.notes or ""
    
    # Parse existing notes to preserve other information
    note_parts = []
    if notes:
        note_parts.append(notes)
    elif current_notes and "PAID" not in current_notes.upper() and "UNPAID" not in current_notes.upper():
        note_parts.append(current_notes)
    
    # Update payable status
    if is_payable is not None:
        if is_payable:
            if "Payable item" not in current_notes:
                note_parts.append("Payable item")
            if "Complimentary item" in current_notes:
                current_notes = current_notes.replace("Complimentary item", "").strip()
        else:
            if "Complimentary item" not in current_notes:
                note_parts.append("Complimentary item")
            if "Payable item" in current_notes:
                current_notes = current_notes.replace("Payable item", "").strip()
    
    # Update paid status
    if is_paid is not None:
        # Remove existing PAID/UNPAID markers
        current_notes = current_notes.replace(" - PAID", "").replace(" - UNPAID", "").replace("PAID", "").replace("UNPAID", "").strip()
        if is_paid:
            note_parts.append("PAID")
        else:
            note_parts.append("UNPAID")
    
    # Combine notes
    detail.notes = " - ".join([p for p in note_parts if p.strip()])
    
    db.commit()
    db.refresh(detail)
    
    return {
        "id": detail.id,
        "item_id": detail.item_id,
        "notes": detail.notes,
        "is_payable": "Payable item" in detail.notes if detail.notes else False,
        "is_paid": "PAID" in detail.notes.upper() if detail.notes else False
    }


# Waste Log Endpoints
@router.post("/waste-logs", response_model=WasteLogOut)
def create_waste_log(
    item_id: Optional[str] = Form(None),
    food_item_id: Optional[str] = Form(None),
    is_food_item: Optional[str] = Form(None),
    location_id: Optional[str] = Form(None),
    batch_number: Optional[str] = Form(None),
    expiry_date: Optional[str] = Form(None),
    quantity: str = Form(...),
    unit: str = Form(...),
    reason_code: str = Form(...),
    action_taken: Optional[str] = Form(None),
    waste_date: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):

    try:
        from datetime import timezone, datetime as dt
        
        # Manual conversion
        parsed_item_id = int(item_id) if item_id and item_id.strip() else None
        parsed_food_item_id = int(food_item_id) if food_item_id and food_item_id.strip() else None
        parsed_location_id = int(location_id) if location_id and location_id.strip() else None
        parsed_quantity = float(quantity)
        parsed_is_food = is_food_item in ["true", "True", "1", "on"] if is_food_item else False

        waste_data = {
            "item_id": parsed_item_id,
            "food_item_id": parsed_food_item_id,
            "is_food_item": parsed_is_food,
            "location_id": parsed_location_id,
            "batch_number": batch_number,
            "expiry_date": dt.strptime(expiry_date, "%Y-%m-%d").date() if expiry_date else None,
            "quantity": parsed_quantity,
            "unit": unit,
            "reason_code": reason_code,
            "action_taken": action_taken if action_taken else None,
            "waste_date": dt.strptime(waste_date, "%Y-%m-%d") if waste_date else dt.now(),
            "notes": notes,
        }
        
        # Handle photo upload
        if photo and photo.filename:
            WASTE_UPLOAD_DIR = os.path.join(_UPLOAD_ROOT, "waste_logs")
            os.makedirs(WASTE_UPLOAD_DIR, exist_ok=True)
            filename = f"waste_{uuid.uuid4().hex}_{photo.filename}"
            file_path = os.path.join(WASTE_UPLOAD_DIR, filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(photo.file, buffer)
            waste_data["photo_path"] = f"uploads/waste_logs/{filename}".replace("\\", "/")
        
        created = inventory_crud.create_waste_log(db, waste_data, branch_id=branch_id, reported_by=current_user.id)

        
        # Load relationships for response
        reporter = db.query(User).filter(User.id == created.reported_by).first()
        item = inventory_crud.get_item_by_id(db, created.item_id) if created.item_id else None
        food_item = None
        if created.food_item_id:
            from app.models.food_item import FoodItem
            food_item = db.query(FoodItem).filter(FoodItem.id == created.food_item_id, FoodItem.branch_id == branch_id).first()
            
        location = db.query(Location).filter(Location.id == created.location_id, (Location.branch_id == branch_id if branch_id is not None else True)).first() if created.location_id else None
        
        return {
            **created.__dict__,
            "reported_by_name": reporter.name if reporter else None,
            "item_name": item.name if item else (food_item.name if food_item else None),
            "food_item_name": food_item.name if food_item else None,
            "location_name": f"{location.building} - {location.room_area}" if location else None
        }
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating waste log: {str(e)}")


@router.get("/waste-logs", response_model=List[WasteLogOut])
def get_waste_logs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    """Optimized with eager loading"""
    from app.models.inventory import WasteLog
    from sqlalchemy.orm import joinedload
    query = db.query(WasteLog).options(
        joinedload(WasteLog.item),
        joinedload(WasteLog.location)
    )
    if branch_id is not None:
        query = query.filter(WasteLog.branch_id == branch_id)
        
    waste_logs = query.order_by(WasteLog.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for log in waste_logs:
        reporter = db.query(User).filter(User.id == log.reported_by).first()
        item_name = log.item.name if log.item else None
        food_item_name = None
        
        if log.is_food_item and not item_name:
             from app.models.food_item import FoodItem
             fi_query = db.query(FoodItem).filter(FoodItem.id == log.food_item_id)
             if branch_id is not None:
                 fi_query = fi_query.filter(FoodItem.branch_id == branch_id)
             food_item = fi_query.first()
             if food_item:
                 food_item_name = food_item.name
                 
        location = log.location  # Already loaded
        result.append({
            **log.__dict__,
            "reported_by_name": reporter.name if reporter else None,
            "item_name": item_name or food_item_name,
            "food_item_name": food_item_name,
            "location_name": f"{location.building} - {location.room_area}" if location else None
        })
    return result


# Location Endpoints
@router.post("/locations", response_model=LocationOut)
def create_location(
    location: LocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    location_data = location.model_dump()
    created = inventory_crud.create_location(db, location_data, branch_id=branch_id)

    return created


@router.get("/locations", response_model=List[LocationOut])
def get_locations(
    skip: int = 0,
    limit: int = 10000,  # Increased limit to show all rooms
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    # Auto-sync rooms to locations
    from app.models.room import Room
    from app.models.inventory import Location
    from sqlalchemy import or_
    
    # Optimized: Only sync if there are unsynced rooms (performance optimization)
    # Only sync rooms for a specific branch. Skip if superadmin/enterprise view (branch_id=None)
    if branch_id is not None:
        unsynced_count = db.query(Room).filter(Room.inventory_location_id == None, Room.branch_id == branch_id).count()
        
        if unsynced_count > 0:
            # Auto-sync rooms to locations (batch operation for better performance)
            try:
                rooms_to_sync = db.query(Room).filter(Room.inventory_location_id == None, Room.branch_id == branch_id).all()
                
                for room in rooms_to_sync:
                    try:
                        # Check if location already exists for this room
                        existing_location = db.query(Location).filter(
                            or_(
                                Location.name == f"Room {room.number}",
                                Location.room_area == f"Room {room.number}"
                            ),
                            Location.location_type == "GUEST_ROOM",
                            (Location.branch_id == branch_id if branch_id is not None else True)
                        ).first()
                        
                        if not existing_location:
                            # Create new location for room
                            location_data = {
                                "name": f"Room {room.number}",
                                "building": "Main Building",
                                "floor": None,
                                "room_area": f"Room {room.number}",
                                "location_type": "GUEST_ROOM",
                                "is_inventory_point": False,
                                "description": f"Guest room {room.number} - {room.type or 'Standard'}",
                                "is_active": (room.status != "Deleted" if room.status else True)
                            }
                            location = inventory_crud.create_location(db, location_data, branch_id=branch_id)

                            room.inventory_location_id = location.id
                            db.commit()
                        else:
                            # Link room to existing location
                            room.inventory_location_id = existing_location.id
                            db.commit()
                    except Exception as e:
                        # Skip this room and continue
                        db.rollback()
                        print(f"Warning: Could not sync room {room.number}: {str(e)}")
                        continue
            except Exception as e:
                # If sync fails completely, just log and continue
                print(f"Warning: Room sync skipped: {str(e)}")
                try:
                    db.rollback()
                except:
                    pass
    
    # Now fetch all locations (optimized with eager loading)
    from sqlalchemy.orm import joinedload
    from sqlalchemy import func
    from app.models.inventory import LocationStock, InventoryItem, AssetRegistry
    
    loc_query = db.query(Location).options(
        joinedload(Location.parent_location),
        joinedload(Location.branch)
    ).filter(Location.is_active == True)
    
    # Scope by branch if not enterprise view
    if branch_id is not None:
        loc_query = loc_query.filter(Location.branch_id == branch_id)
    
    locations = loc_query.offset(skip).limit(limit).all()

    
    # Bulk Calculate Stats (Optimization)
    
    # 1. Consumables (LocationStock)
    stock_query = db.query(
        LocationStock.location_id,
        func.count(LocationStock.id),
        func.sum(LocationStock.quantity * InventoryItem.unit_price)
    ).join(InventoryItem, LocationStock.item_id == InventoryItem.id)\
     .filter(LocationStock.quantity > 0)
    
    if branch_id is not None:
        stock_query = stock_query.filter(LocationStock.branch_id == branch_id)
    
    stock_stats = stock_query.group_by(LocationStock.location_id).all()

     
    stock_map = {loc_id: {"count": c, "value": v or 0} for loc_id, c, v in stock_stats}
    
    # 2. Fixed Assets (AssetRegistry) - Include these in value/count
    asset_query = db.query(
        AssetRegistry.current_location_id,
        func.count(AssetRegistry.id),
        func.sum(InventoryItem.unit_price)
    ).join(InventoryItem, AssetRegistry.item_id == InventoryItem.id)\
     .filter(AssetRegistry.status == 'active')
    
    if branch_id is not None:
        asset_query = asset_query.filter(AssetRegistry.branch_id == branch_id)
    
    asset_stats = asset_query.group_by(AssetRegistry.current_location_id).all()

     
    asset_map = {loc_id: {"count": c, "value": v or 0} for loc_id, c, v in asset_stats}
    
    result = []
    for loc in locations:
        parent = loc.parent_location
        
        # Merge stats
        s_data = stock_map.get(loc.id, {"count": 0, "value": 0})
        a_data = asset_map.get(loc.id, {"count": 0, "value": 0})
        
        total_items = (s_data["count"] or 0) + (a_data["count"] or 0)
        total_value = float(s_data["value"] or 0) + float(a_data["value"] or 0)
        
        # Convert model instance to dict safely
        loc_dict = {c.name: getattr(loc, c.name) for c in loc.__table__.columns}
        
        result.append({
            **loc_dict,
            "parent_location_name": f"{parent.building} - {parent.room_area}" if parent else None,
            "total_items": total_items,
            "total_value": total_value,
            "asset_count": a_data["count"],
            "consumable_count": s_data["count"],
            "branch_id": loc.branch_id,
            "branch_name": loc.branch.name if loc.branch else "Main"
        })
    return result


@router.put("/locations/{location_id}", response_model=LocationOut)
def update_location(
    location_id: int,
    location_update: LocationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    from app.models.inventory import Location
    
    # Check if location exists and belongs to the branch (if branch_id is set)
    query = db.query(Location).filter(Location.id == location_id)
    if branch_id is not None:
        query = query.filter(Location.branch_id == branch_id)
    
    db_loc = query.first()
    if not db_loc:
        raise HTTPException(status_code=404, detail="Location not found")
        
    updated = inventory_crud.update_location(db, location_id, location_update.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Location not found")
        
    return updated


@router.get("/locations/{location_id}/items")
def get_location_items(
    location_id: int,
    booking_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    """Get all inventory items and their stock levels for a specific location in this branch"""

    from app.models.inventory import InventoryItem, AssetMapping, AssetRegistry, StockIssueDetail, StockIssue, LocationStock, WasteLog, Location
    from app.models.booking import Booking
    from app.models.Package import PackageBooking
    from sqlalchemy import func
    from sqlalchemy.orm import joinedload
    from datetime import timezone, datetime, timedelta
    
    # --- Date Filtering Logic ---
    filter_start = None
    filter_end = None
    
    # 1. Try to get dates from booking_id
    if booking_id:
        try:
            # Handle display ID BK-000001 or PK-000001
            numeric_id, booking_type = parse_display_id(str(booking_id))
            if numeric_id:
                working_id = numeric_id
                is_package = (booking_type == 'package')
            else:
                working_id = int(booking_id)
                is_package = False
            
            if is_package:
                b = db.query(PackageBooking).filter(PackageBooking.id == working_id, PackageBooking.branch_id == branch_id).first()
            else:
                b = db.query(Booking).filter(Booking.id == working_id, Booking.branch_id == branch_id).first()

            
            if b:
                filter_start = b.checked_in_at or b.check_in
                filter_end = b.check_out
                if isinstance(filter_start, str):
                    filter_start = datetime.strptime(filter_start, '%Y-%m-%d')
                if isinstance(filter_end, str):
                    filter_end = datetime.strptime(filter_end, '%Y-%m-%d')
        except Exception as e:
            print(f"Error parsing booking_id for filters: {e}")

    # 2. Override with explicit dates if provided
    if start_date:
        try:
            filter_start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        except:
            try: filter_start = datetime.strptime(start_date, '%Y-%m-%d')
            except: pass
    
    if end_date:
        try:
            filter_end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        except:
            try: filter_end = datetime.strptime(end_date, '%Y-%m-%d')
            except: pass

    # If end_date is just a date, set it to end of day
    if filter_end and (not hasattr(filter_end, 'hour') or filter_end.hour == 0):
        # Using a simple check if it has datetime properties or just date
        if isinstance(filter_end, datetime):
            filter_end = filter_end.replace(hour=23, minute=59, second=59)
    
    location = db.query(Location).filter(Location.id == location_id, (Location.branch_id == branch_id if branch_id is not None else True)).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found in this branch")

    
    # 1. Get items from LocationStock (Primary Source for bulk items)
    location_stocks_query = db.query(LocationStock).options(
        joinedload(LocationStock.item).joinedload(InventoryItem.category)
    ).filter(
        LocationStock.location_id == location_id
    )
    if branch_id is not None:
        location_stocks_query = location_stocks_query.filter(LocationStock.branch_id == branch_id)
    location_stocks = location_stocks_query.all()

    
    # 2. Get items assigned to this location via asset mappings
    asset_mappings_query = db.query(AssetMapping).filter(
        AssetMapping.location_id == location_id,
        AssetMapping.is_active == True
    )
    if branch_id is not None:
        asset_mappings_query = asset_mappings_query.filter(AssetMapping.branch_id == branch_id)
    asset_mappings = asset_mappings_query.all()

    
    # 3. Get items from asset registry (Only active/in_stock assets should count as current location stock)
    asset_registry_query = db.query(AssetRegistry).filter(
        AssetRegistry.current_location_id == location_id,
        AssetRegistry.status.in_(["active", "in_stock", "In Stock"])
    )
    if branch_id is not None:
        asset_registry_query = asset_registry_query.filter(AssetRegistry.branch_id == branch_id)
    asset_registry = asset_registry_query.all()

    
    # Combine all items
    items_dict = {}
    
    # Pre-calculate mapped quantities to prioritize stock attribution
    mapped_counts = {}
    for m in asset_mappings:
        mapped_counts[m.item_id] = mapped_counts.get(m.item_id, 0) + (m.quantity or 1)
    
    # Add items from LocationStock
    # Add items from LocationStock
    for stock in location_stocks:
        item = stock.item
        if item:
            category = inventory_crud.get_category_by_id(db, item.category_id)
            
            # Fetch all issue details ordered by date DESC
            # REFINED: Prioritize booking_id filtering to avoid showing items from other guests
            # that might overlap on the same day due to loose date filtering.
            issue_query = db.query(StockIssueDetail).join(StockIssue).filter(
                StockIssue.destination_location_id == location_id,
                StockIssueDetail.item_id == item.id
            )
            if branch_id is not None:
                issue_query = issue_query.filter(StockIssue.branch_id == branch_id)

            
            # Use working_id (numeric ID) derived from booking_id prefix parsing if available
            w_id = None
            try: w_id = int(working_id)
            except: pass

            if w_id:
                from sqlalchemy import or_
                # Filter to records for this booking or untagged records
                issue_query = issue_query.filter(
                    or_(
                        StockIssue.booking_id == w_id,
                        StockIssue.booking_id.is_(None)
                    )
                )
            
            if filter_start:
                issue_query = issue_query.filter(StockIssue.issue_date >= filter_start)
            if filter_end:
                issue_query = issue_query.filter(StockIssue.issue_date <= filter_end)
                
            issue_details_all = issue_query.order_by(StockIssue.issue_date.desc()).all()

            # Post-filter: If we have a booking context, exclude records that explicitly belong to OTHER bookings (in notes)
            if w_id:
                # Include new branch-scoped format and old format patterns
                display_id_patterns = [
                    format_display_id(w_id, branch_id=branch_id, is_package=False),
                    format_display_id(w_id, branch_id=branch_id, is_package=True),
                    f"BK-{str(w_id).zfill(6)}", 
                    f"PK-{str(w_id).zfill(6)}", 
                    f"#{w_id}"
                ]
                issue_details = []
                for d in issue_details_all:
                    if d.issue.booking_id == w_id:
                        issue_details.append(d)
                        continue
                    
                    # If untagged, check notes for mention of other guests/bookings
                    notes = (d.issue.notes or "").upper()
                    has_any_bk = "BK-" in notes or "PK-" in notes or "BOOKING " in notes or "FOR BK" in notes
                    if has_any_bk:
                        # Only keep if it mentions OUR booking
                        matches_ours = any(p.upper() in notes for p in display_id_patterns)
                        if matches_ours:
                            issue_details.append(d)
                        else:
                            # Mentions a different booking, exclude from this guest's view
                            continue
                    else:
                        # No specific booking mentioned, assume it's preparation stock or general room issue
                        issue_details.append(d)
            else:
                issue_details = issue_details_all
            
            # Split issues into Rented vs Standard - Only items with rental_price > 0 are truly "Rented"
            # is_payable items (like Water) are consumables, not rentals.
            active_rented_issues = [d for d in issue_details if (d.rental_price and d.rental_price > 0)]
            good_rented_issues = [d for d in active_rented_issues if not d.is_damaged]
            damaged_issues = [d for d in issue_details if d.is_damaged]
            # All good issues (Standard + Rented) for consumables processing - This fixes the breakdown visibility
            good_issues = [d for d in issue_details if not d.is_damaged]
            
            # Determine split quantities based on current stock
            total_rented_need = sum(float(d.issued_quantity) for d in good_rented_issues)
            total_damaged_need = sum(float(d.issued_quantity) for d in damaged_issues)
            current_stock_qty = float(stock.quantity)
            
            # LOGIC: First reserve stock for Mapped Assets (Fixed), then Damaged items, then Rentals, then Standard
            mapped_need = float(mapped_counts.get(item.id, 0))
            
            # 1. Base Standard = min(stock, mapped_need)
            base_standard = min(current_stock_qty, mapped_need)
            remaining = current_stock_qty - base_standard
            
            # 2. Damaged (Actual Physical Units that are Damaged)
            # We attribute stock to damaged rows first to ensure they are represented accurately
            actual_damaged_stock = min(remaining, total_damaged_need)
            remaining -= actual_damaged_stock
            
            # 3. Rented = min(remaining, total_rented_need)
            rented_stock_qty = min(remaining, total_rented_need)
            
            # 4. Final Standard = base_standard + whatever is left (Standard Good)
            standard_stock_qty = base_standard + (remaining - rented_stock_qty)
            
            # Helper to process a batch and add to items_dict
            def process_batch(qty, issues, key_suffix, is_rent_split):
                # DETERMINATION: Should we show this row?
                is_asset = ((category and category.is_asset_fixed) or item.is_asset_fixed or item.track_laundry_cycle)
                
                if qty <= 0:
                    return

                # Group issues by price point for rentals/payable items
                price_groups = {} # price -> {qty: float, is_payable: bool}
                
                rem = qty
                for detail in issues:
                    if rem <= 0: break
                    issued = float(detail.issued_quantity)
                    attributed = min(rem, issued)
                    
                    # Determine price to use for grouping
                    price = float(detail.rental_price if detail.rental_price and detail.rental_price > 0 else (detail.unit_price or item.unit_price or 0))
                    is_pay = detail.is_payable or (is_rent_split and price > 0)
                    
                    # Group key: (price, is_pay) to keep complimentary vs paid separate even at same price if needed
                    group_key = (price, is_pay) if is_pay else (0.0, False)
                    
                    if group_key not in price_groups:
                        price_groups[group_key] = {"qty": 0.0, "is_payable": is_pay}
                    
                    price_groups[group_key]["qty"] += attributed
                    rem -= attributed

                # If there's still quantity left (e.g. no issues matching, or stock manually added), assign it to a default free/standard group
                if rem > 0:
                    group_key = (0.0, False)
                    if group_key not in price_groups:
                        price_groups[group_key] = {"qty": 0.0, "is_payable": False}
                    price_groups[group_key]["qty"] += rem

                for (price, is_pay), group_data in price_groups.items():
                    g_qty = group_data["qty"]
                    
                    selling_price = price if price > 0 else (item.selling_price if item.selling_price and item.selling_price > 0 else item.unit_price)
                    cost_price = item.unit_price or 0
                    stock_value = g_qty * cost_price
                    
                    # Unique key including price to prevent over-aggregation
                    key = f"item_{item.id}{key_suffix}_{price}_{is_pay}"
                    display_name = item.name
                    
                    if is_rent_split:
                        if is_asset:
                            display_name += " (Rented)"
                        else:
                            display_name += " (Payable)"
                    else:
                        # Logic for standard consumable display
                        if is_pay:
                             display_name += " (Payable)"
                    
                    if price > 0 and is_pay:
                         # For clarity in mixed pricing, add the price to the display name if multiple rows exist
                         if len(price_groups) > 1:
                              display_name += f" @ {price}"

                    items_dict[key] = {
                        "item_id": item.id,
                        "item_name": display_name,
                        "item_code": item.item_code,
                        "category_name": category.name if category else None,
                        "unit": item.unit,
                        "current_stock": g_qty,
                        "location_stock": g_qty,
                        "complimentary_qty": g_qty if not is_pay else 0.0,
                        "payable_qty": g_qty if is_pay else 0.0,
                        "min_stock_level": item.min_stock_level,
                        "unit_price": cost_price,
                        "cost_price": cost_price,
                        "selling_price": selling_price,
                        "total_value": stock_value,
                        "source": "Stock" + (" (Rented)" if is_rent_split else ""),
                        "last_updated": stock.last_updated,
                        "type": "asset" if is_asset else "consumable",
                        "is_rentable": is_rent_split,
                        "is_asset_fixed": item.is_asset_fixed
                    }

            # Determine if item is an asset
            is_asset_type = ((category and category.is_asset_fixed) or item.is_asset_fixed or item.track_laundry_cycle)

            # 5. Process Damaged Issues (Actually present in stock)
            rem_damaged = actual_damaged_stock
            for dmg in damaged_issues:
                if rem_damaged <= 0: break
                issued = float(dmg.issued_quantity)
                attributed = min(rem_damaged, issued)
                
                is_rented = (dmg.rental_price and dmg.rental_price > 0) or dmg.is_payable
                display_name = item.name + (" (Rented, Damaged)" if is_rented else " (Damaged)")
                key = f"item_{item.id}_damaged_{dmg.id}"
                
                selling_price = dmg.rental_price if dmg.rental_price and dmg.rental_price > 0 else (item.selling_price if item.selling_price and item.selling_price > 0 else item.unit_price)
                cost_price = item.unit_price or 0
                
                items_dict[key] = {
                    "item_id": item.id,
                    "item_name": display_name,
                    "item_code": item.item_code,
                    "category_name": category.name if category else None,
                    "unit": item.unit,
                    "current_stock": attributed,
                    "location_stock": attributed,
                    "is_damaged": True,
                    "damage_notes": dmg.damage_notes,
                    "unit_price": cost_price,
                    "selling_price": selling_price,
                    "total_value": attributed * cost_price,
                    "source": "Stock Issue (Damaged)",
                    "type": "asset" if is_asset_type else "consumable",
                    "is_rentable": is_rented,
                    "is_asset_fixed": item.is_asset_fixed
                }
                rem_damaged -= attributed

            # Process Rented and Standard Good batches
            if is_asset_type:
                if rented_stock_qty != 0 or total_rented_need > 0:
                    process_batch(rented_stock_qty, good_rented_issues, "_rented", True)
                if standard_stock_qty != 0 or mapped_need > 0 or (rented_stock_qty == 0 and total_rented_need == 0):
                    process_batch(standard_stock_qty, issue_details, "", False)
            else:
                # Use all good issues (not just rented) for consumables to ensure payable/complimentary breakdown is correct
                is_rent_any = total_rented_need > 0 or any(getattr(d, 'is_payable', False) for d in good_issues)
                process_batch(standard_stock_qty + rented_stock_qty, good_issues, "", is_rent_any)

    # Add items from asset mappings - These are permanently assigned assets
    # MERGE with LocationStock items if they exist to prevent duplicates
    for mapping in asset_mappings:
        item = inventory_crud.get_item_by_id(db, mapping.item_id)
        if item:
            # Check if this item was already added via LocationStock (Robust lookup)
            existing_key = next((k for k in items_dict if items_dict[k].get('item_id') == item.id), None)
            
            # Check if this mapping is reported as damaged in notes
            is_dam = "Reported Damaged" in (mapping.notes or "")
            
            if existing_key:
                # MERGE: Update the existing entry to ensure it's treated as a Fixed Asset
                # Do NOT increment count here, LocationStock is primary source of physical quantity
                items_dict[existing_key].update({
                    "type": "asset",           # Force type to asset
                    "is_fixed_asset": True,    # Force fixed asset flag
                    "is_rentable": False,      # Force not rentable
                    "source": items_dict[existing_key]["source"] + ", Asset Mapping" # Update source
                })
                # Add serial number if available
                if mapping.serial_number:
                    existing_sn = items_dict[existing_key].get("serial_number", "")
                    if mapping.serial_number not in str(existing_sn):
                        items_dict[existing_key]["serial_number"] = (str(existing_sn) + ", " + mapping.serial_number) if existing_sn else mapping.serial_number

                if is_dam and "(Damaged)" not in items_dict[existing_key]["item_name"]:
                    items_dict[existing_key]["item_name"] += " (Damaged)"
                    items_dict[existing_key]["is_damaged"] = True
            else:
                # Add as new entry if not in LocationStock
                key = f"asset_mapped_{item.id}"
                
                category = inventory_crud.get_category_by_id(db, item.category_id)
                display_name = item.name
                if is_dam:
                    display_name += " (Damaged)"
                
                items_dict[key] = {
                    "item_id": item.id,
                    "item_name": display_name,
                    "is_damaged": is_dam,
                    "item_code": item.item_code,
                    "category_name": category.name if category else None,
                    "unit": item.unit,
                    "current_stock": mapping.quantity or 1, 
                    "location_stock": mapping.quantity or 1,
                    "min_stock_level": item.min_stock_level,
                    "unit_price": item.unit_price,
                    "total_value": (item.unit_price or 0) * (mapping.quantity or 1),
                    "source": "Asset Mapping",
                    "serial_number": mapping.serial_number,
                    "assigned_date": mapping.assigned_date,
                    "type": "asset",
                    "is_fixed_asset": True,
                    "is_rentable": False
                }

    # Add items from asset registry - MERGE with existing rows to avoid duplicates
    for asset in asset_registry:
        item = asset.item
        if item:
            # Robust lookup for any existing entry for this item ID
            target_key = next((k for k in items_dict if items_dict[k].get('item_id') == item.id), None)
            
            if target_key:
                # MERGE details into the existing row
                agg = items_dict[target_key]
                if not agg.get("serial_number") and asset.serial_number:
                    agg["serial_number"] = asset.serial_number
                if not agg.get("asset_tag") and asset.asset_tag_id:
                    agg["asset_tag"] = asset.asset_tag_id
                
                # Append source info
                if "Asset Registry" not in agg["source"]:
                    agg["source"] += ", Asset Registry"
                
                # Update status if damaged in registry
                if asset.status and asset.status.lower() in ["damaged", "broken"]:
                    agg["is_damaged"] = True
                    if "(Damaged)" not in agg["item_name"]:
                        agg["item_name"] += " (Damaged)"
            else:
                # Add as new registry_ key if not already represented in stock
                key = f"registry_{asset.id}"
                category = inventory_crud.get_category_by_id(db, item.category_id)
                
                name = item.name
                is_damaged = False
                if asset.status and asset.status.lower() in ["damaged", "broken"]:
                    name += " (Damaged)"
                    is_damaged = True
                
                items_dict[key] = {
                    "item_id": item.id,
                    "item_name": name,
                    "is_damaged": is_damaged,
                    "item_code": item.item_code,
                    "category_name": category.name if category else None,
                    "unit": item.unit,
                    "current_stock": 1,
                    "location_stock": 1, 
                    "min_stock_level": item.min_stock_level,
                    "unit_price": item.unit_price,
                    "total_value": item.unit_price or 0,
                    "source": "Asset Registry",
                    "serial_number": asset.serial_number,
                    "asset_tag": asset.asset_tag_id,
                    "status": asset.status,
                    "type": "asset",
                    "is_asset_fixed": True 
                }
    
    # 4. Get History (Stock Issues & Waste Logs)
    history = []
    
    # Stock Issues (Inbound to location)
    stock_issues_in_query = db.query(StockIssue).options(
        joinedload(StockIssue.details).joinedload(StockIssueDetail.item),
        joinedload(StockIssue.issuer)
    ).filter(
        StockIssue.destination_location_id == location_id
    )

    if branch_id is not None:
        stock_issues_in_query = stock_issues_in_query.filter(StockIssue.branch_id == branch_id)

    
    if filter_start:
        stock_issues_in_query = stock_issues_in_query.filter(StockIssue.issue_date >= filter_start)
    if filter_end:
        stock_issues_in_query = stock_issues_in_query.filter(StockIssue.issue_date <= filter_end)
        
    stock_issues_in = stock_issues_in_query.order_by(StockIssue.issue_date.desc()).limit(50).all()
    
    for issue in stock_issues_in:
        for detail in issue.details:
            if detail.item:
                history.append({
                    "date": issue.issue_date,
                    "type": "Stock Received",
                    "item_name": detail.item.name,
                    "quantity": detail.issued_quantity,
                    "unit": detail.unit,
                    "reference": issue.issue_number,
                    "user": issue.issuer.name if issue.issuer else "Unknown",
                    "notes": detail.notes or issue.notes,
                    "color": "green"
                })

    # Stock Issues (Outbound from location - Transfers)
    stock_issues_out_query = db.query(StockIssue).options(
        joinedload(StockIssue.details).joinedload(StockIssueDetail.item),
        joinedload(StockIssue.issuer),
        joinedload(StockIssue.destination_location)
    ).filter(
        StockIssue.source_location_id == location_id
    )

    if branch_id is not None:
        stock_issues_out_query = stock_issues_out_query.filter(StockIssue.branch_id == branch_id)

    
    if filter_start:
        stock_issues_out_query = stock_issues_out_query.filter(StockIssue.issue_date >= filter_start)
    if filter_end:
        stock_issues_out_query = stock_issues_out_query.filter(StockIssue.issue_date <= filter_end)
        
    stock_issues_out = stock_issues_out_query.order_by(StockIssue.issue_date.desc()).limit(50).all()

    for issue in stock_issues_out:
        dest_name = issue.destination_location.name if issue.destination_location else "Unknown"
        for detail in issue.details:
            if detail.item:
                history.append({
                    "date": issue.issue_date,
                    "type": "Transfer Out", # Or "Stock Issued"
                    "item_name": detail.item.name,
                    "quantity": detail.issued_quantity,
                    "unit": detail.unit,
                    "reference": issue.issue_number,
                    "user": issue.issuer.name if issue.issuer else "Unknown",
                    "notes": f"To {dest_name} - {detail.notes or issue.notes}",
                    "color": "orange" # Distinct color for transfers
                })

    # Waste Logs (Outbound/Loss from location)
    waste_logs_query = db.query(WasteLog).options(
        joinedload(WasteLog.item),
        joinedload(WasteLog.food_item),
        joinedload(WasteLog.reporter)
    ).filter(
        WasteLog.location_id == location_id
    )

    if branch_id is not None:
        waste_logs_query = waste_logs_query.filter(WasteLog.branch_id == branch_id)

    
    if filter_start:
        waste_logs_query = waste_logs_query.filter(WasteLog.waste_date >= filter_start)
    if filter_end:
        waste_logs_query = waste_logs_query.filter(WasteLog.waste_date <= filter_end)
        
    waste_logs = waste_logs_query.order_by(WasteLog.waste_date.desc()).limit(50).all()
    
    for log in waste_logs:
        item_name = log.item.name if log.item else (log.food_item.name if log.food_item else "Unknown Item")
        history.append({
            "date": log.waste_date,
            "type": f"Waste ({log.reason_code})",
            "item_name": item_name,
            "quantity": log.quantity,
            "unit": log.unit,
            "reference": log.log_number,
            "user": log.reporter.name if log.reporter else "Unknown",
            "notes": log.notes,
            "color": "red"
        })

    # 5. Get Purchase History (Directly Received at Location)
    from app.models.inventory import PurchaseMaster, PurchaseDetail
    
    purchases_query = db.query(PurchaseDetail).join(PurchaseMaster).options(
        joinedload(PurchaseDetail.item),
        joinedload(PurchaseDetail.purchase_master).joinedload(PurchaseMaster.user)
    ).filter(
        PurchaseMaster.destination_location_id == location_id,
        PurchaseMaster.status == "received"
    )
    
    if branch_id is not None:
        purchases_query = purchases_query.filter(PurchaseMaster.branch_id == branch_id)

    
    if filter_start:
        purchases_query = purchases_query.filter(PurchaseMaster.updated_at >= filter_start)
    if filter_end:
        purchases_query = purchases_query.filter(PurchaseMaster.updated_at <= filter_end)
        
    purchases = purchases_query.order_by(PurchaseMaster.updated_at.desc()).limit(50).all()
    
    for detail in purchases:
        purchase = detail.purchase_master
        if detail.item:
            history.append({
                "date": purchase.updated_at, # Using updated_at as receive date proxy
                "type": "Purchase Received",
                "item_name": detail.item.name,
                "quantity": detail.quantity,
                "unit": detail.unit,
                "reference": purchase.purchase_number,
                "user": purchase.user.name if purchase.user else "System",
                "notes": f"Vendor: {purchase.vendor.name if purchase.vendor else 'Unknown'}",
                "color": "green"  # Green for incoming stock (positive quantity)
            })
    
    # 6. Get Adjustment History (InventoryTransactions)
    # This covers manual adjustments and auto-corrections from checkout
    from app.models.inventory import InventoryTransaction
    
    # Adjustments affecting this location specifically
    # Note: InventoryTransaction usually tracks global stock or is loosely coupled. 
    # But if we used specific references like "ADJ-CHK-...-LOC-{id}", we could filter.
    # However, my checkout fix used: reference_number=f"ADJ-CHK-{checkout_request.id}"
    # and notes=f"... Deducted from Source ID {adjust_source_id}."
    # This makes it hard to filter by location_id purely from DB query without a JOIN or structured ref.
    # But we can try to find transactions referencing this location in notes or reference? 
    # Better: If we want to show it in History, we should rely on WasteLog or StockIssue.
    # Since Step 3c created an InventoryTransaction but not a WasteLog/StockIssue for the source deduction, 
    # it is invisible here. 
    # TO FIX VISIBILITY: We will fetch InventoryTransactions that have this item and seem to be adjustments,
    # and filter in python if they mention this location.
    
    # 6. Get Adjustment History (InventoryTransactions)
    # Filter for items that are present in this location view
    location_item_ids = []
    for k in items_dict.keys():
        if k.startswith("item_"):
            try:
                location_item_ids.append(int(k.split('_')[1]))
            except: pass
        elif k.startswith("registry_"):
            # Getting item id from registry key might be harder unless we stored it
            if "item_id" in items_dict[k]:
                 location_item_ids.append(items_dict[k]["item_id"])

    # Remove duplicates
    location_item_ids = list(set(location_item_ids))
    
    adjustments = []
    if location_item_ids:
        adjustments_query = db.query(InventoryTransaction).options(
            joinedload(InventoryTransaction.user)
        ).filter(
            InventoryTransaction.item_id.in_(location_item_ids),
            InventoryTransaction.created_at >= (get_ist_now() - timedelta(days=30))
        )
        if branch_id is not None:
            adjustments_query = adjustments_query.filter(InventoryTransaction.branch_id == branch_id)
        adjustments = adjustments_query.all()


    # Iterate and filter manually for this location context
    existing_refs = set(item['reference'] for item in history if item.get('reference'))
    for adj in adjustments:
        if adj.reference_number and adj.reference_number in existing_refs:
            continue
            
        # Check if this transaction is relevant to this location
        # Our checkout fix used: reference_number=f"ADJ-CHK-{checkout_request.id}"
        # and notes=f"... Deducted from Source ID {adjust_source_id}."
        
        is_relevant = False
        if adj.source_location_id == location_id or adj.destination_location_id == location_id:
             is_relevant = True
        elif str(location.id) in (adj.notes or "") and "Source ID" in (adj.notes or ""):
             is_relevant = True
        elif adj.reference_number and f"LOC-{location.id}" in adj.reference_number:
             is_relevant = True
             
        if is_relevant:
            item_name = "Unknown Item"
            if adj.item: # If eager loaded or available
                item_name = adj.item.name
            else:
                 # Fetch item name if not loaded
                 from app.models.inventory import InventoryItem
                 tmp_item = db.query(InventoryItem).filter(InventoryItem.id == adj.item_id).first()
                 if tmp_item: item_name = tmp_item.name

            history.append({
                "date": adj.created_at,
                "type": "Stock Adjustment",
                "item_name": item_name,
                "quantity": -adj.quantity if adj.transaction_type == "out" else adj.quantity, # Negative for deduction
                "unit": "units", # Fallback
                "reference": adj.reference_number,
                "user": adj.user.name if adj.user else "System",
                "notes": adj.notes,
                "color": "red" if adj.transaction_type == "out" else "orange"
            })
    
    # Sort combined history by date desc
    history.sort(key=lambda x: x["date"], reverse=True)

    items_list = list(items_dict.values())
    total_items = len(items_list) # Use item count/rows instead of quantity sum
    total_value = sum(item["total_value"] for item in items_list)
    
    booking_metadata = None
    if booking_id:
        try:
            # Re-fetch or use existing b if it was loaded for dates
            # We already have filter_start/end, but we need name and IDs
            if 'b' in locals() and b:
                booking_metadata = {
                    "booking_id": b.id,
                    "display_id": getattr(b, 'display_id', format_display_id(b.id, branch_id=branch_id)),
                    "guest_name": b.guest_name,
                    "guest_id": getattr(b, 'user_id', None),
                    "check_in": b.check_in,
                    "check_out": b.check_out,
                    "checked_in_at": b.checked_in_at
                }
        except: pass

    return {
        "location": {
            "id": location.id,
            "name": location.name,
            "building": location.building,
            "floor": location.floor,
            "room_area": location.room_area,
            "location_type": location.location_type
        },
        "booking_metadata": booking_metadata,
        "total_items": total_items, # This is the sum of CURRENT LocationStock
        "total_stock_value": total_value,
        "items": items_list,
        "history": history
    }



@router.get("/stock-by-location")
def get_stock_by_location(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):

    """Get inventory stock summary grouped by location - OPTIMIZED"""
    from app.models.inventory import Location, AssetMapping, AssetRegistry, LocationStock, InventoryItem, InventoryCategory
    from sqlalchemy import func
    from sqlalchemy.orm import joinedload
    
    try:
        # 1. Fetch all locations at once
        locations = inventory_crud.get_all_locations(db, branch_id=branch_id, skip=0, limit=1000)

        location_ids = [loc.id for loc in locations]
        location_map = {loc.id: loc for loc in locations}
        
        # 2. Bulk fetch all LocationStock with eager loading
        stock_query = db.query(LocationStock).options(
            joinedload(LocationStock.item),
            joinedload(LocationStock.location)
        ).filter(
            LocationStock.location_id.in_(location_ids)
        )
        if branch_id is not None:
             stock_query = stock_query.filter(LocationStock.branch_id == branch_id)
        all_location_stocks = stock_query.all()

        
        # 3. Bulk fetch all AssetMappings
        asset_q = db.query(AssetMapping).options(
            joinedload(AssetMapping.item)
        ).filter(
            AssetMapping.location_id.in_(location_ids),
            AssetMapping.is_active == True
        )
        if branch_id is not None:
             asset_q = asset_q.filter(AssetMapping.branch_id == branch_id)
        all_asset_mappings = asset_q.all()

        
        # 4. Bulk fetch all AssetRegistry
        registry_q = db.query(AssetRegistry).options(
            joinedload(AssetRegistry.item)
        ).filter(
            AssetRegistry.current_location_id.in_(location_ids)
        )
        if branch_id is not None:
            registry_q = registry_q.filter(AssetRegistry.branch_id == branch_id)
        all_registry_items = registry_q.all()

        
        # 5. Bulk fetch all categories for items
        item_ids = set()
        for stock in all_location_stocks:
            if stock.item:
                item_ids.add(stock.item_id)
        for mapping in all_asset_mappings:
            item_ids.add(mapping.item_id)
        for reg in all_registry_items:
            item_ids.add(reg.item_id)
        
        categories_map = {}
        if item_ids:
            items_with_cats = db.query(InventoryItem).options(
                joinedload(InventoryItem.category)
            ).filter(InventoryItem.id.in_(item_ids)).all()
            for item in items_with_cats:
                if item.category:
                    categories_map[item.id] = item.category
            
            # Map item objects for calculation
            items_obj_map = {item.id: item for item in items_with_cats}
        
        # 5. Organize data by location
        location_data = {}
        for loc_id in location_ids:
            location_data[loc_id] = {
                'items_map': {},
                'seen_items': set(),
                'total_items': 0,
                'asset_count': 0,
                'consumable_count': 0,
                'total_stock_value': 0.0
            }
        
        # 6. Process LocationStock (PRIMARY source)
        for stock in all_location_stocks:
            loc_id = stock.location_id
            if loc_id in location_data:
                # Only track if quantity is non-zero (exclude empty stock from variety count, include negative)
                if stock.quantity != 0:
                    location_data[loc_id]['seen_items'].add(stock.item_id)
                    location_data[loc_id]['items_map'][stock.item_id] = stock.quantity
        
        # 7. Process AssetMappings (only if not in LocationStock)
        for mapping in all_asset_mappings:
            loc_id = mapping.location_id
            if loc_id in location_data and mapping.item_id not in location_data[loc_id]['seen_items']:
                location_data[loc_id]['items_map'][mapping.item_id] = mapping.quantity
                location_data[loc_id]['seen_items'].add(mapping.item_id)
        
        # 8. Process AssetRegistry (only if not seen)
        registry_counts = {}
        for reg in all_registry_items:
            key = (reg.current_location_id, reg.item_id)
            registry_counts[key] = registry_counts.get(key, 0) + 1
        
        for (loc_id, item_id), count in registry_counts.items():
            if loc_id in location_data and item_id not in location_data[loc_id]['seen_items']:
                location_data[loc_id]['items_map'][item_id] = count
        
        # 9. Calculate totals (items and categories are already loaded)
        # 9. Calculate totals (Iterate aggregated items_map to include Stocks, Mappings, and Registry)
        # This fixes missing values for items that are only mapped/registered but not in LocationStock
        for loc_id, data in location_data.items():
            for item_id, qty in data['items_map'].items():
                item = items_obj_map.get(item_id)
                if item:
                    # Value
                    val = qty * (item.unit_price or 0)
                    data['total_stock_value'] += val

                    # Counts (Asset vs Consumable)
                    category = categories_map.get(item_id)
                    is_asset = getattr(item, 'is_asset_fixed', False) or \
                              (category and getattr(category, 'is_asset_fixed', False)) or \
                              getattr(item, 'track_laundry_cycle', False) or \
                              (category and getattr(category, 'track_laundry', False))
                    
                    if is_asset:
                        data['asset_count'] += qty
                    else:
                        data['consumable_count'] += qty
        
        # 10. Build result
        result = []
        for location in locations:
            data = location_data[location.id]
            result.append({
                **location.__dict__,
                "asset_count": data['asset_count'],
                "consumable_items_count": data['consumable_count'],
                "total_stock_value": data['total_stock_value'],
                "total_items": len(data['items_map']) # Use variety count instead of quantity sum
            })
        
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching stock by location: {str(e)}")


@router.post("/locations/sync-rooms")
def sync_rooms_to_locations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):

    """Synchronize existing rooms from rooms table to locations table for inventory"""
    from app.models.room import Room
    from app.models.inventory import Location
    from app.curd import inventory as inventory_crud
    
    try:
        rooms = db.query(Room).filter(Room.branch_id == branch_id).all()

        synced_count = 0
        created_count = 0
        linked_count = 0
        
        for room in rooms:
            # Check if location already exists for this room
            from sqlalchemy import or_
            existing_location = db.query(Location).filter(
                or_(
                    Location.name == f"Room {room.number}",
                    Location.room_area == f"Room {room.number}"
                ),
                Location.location_type == "GUEST_ROOM",
                (Location.branch_id == branch_id if branch_id is not None else True)
            ).first()

            
            if existing_location:
                # Link room to existing location
                if not room.inventory_location_id:
                    room.inventory_location_id = existing_location.id
                    linked_count += 1
                synced_count += 1
            else:
                # Create new location for room using CRUD function
                location_data = {
                    "name": f"Room {room.number}",
                    "building": "Main Building",  # Default, can be updated later
                    "floor": None,  # Can be extracted from room number if needed
                    "room_area": f"Room {room.number}",
                    "location_type": "GUEST_ROOM",
                    "is_inventory_point": False,  # Rooms are not inventory points
                    "description": f"Guest room {room.number} - {room.type or 'Standard'}",
                    "is_active": (room.status != "Deleted" if room.status else True)
                }
                try:
                    location = inventory_crud.create_location(db, location_data, branch_id=branch_id)

                    
                    # Link room to location
                    room.inventory_location_id = location.id
                    created_count += 1
                    synced_count += 1
                except Exception as e:
                    db.rollback()
                    # Location might already exist, try to find and link
                    existing = db.query(Location).filter(
                        Location.name == f"Room {room.number}",
                        (Location.branch_id == branch_id if branch_id is not None else True)
                    ).first()
                    if existing and not room.inventory_location_id:
                        room.inventory_location_id = existing.id
                        linked_count += 1
                        synced_count += 1
        
        db.commit()
        
        return {
            "message": "Rooms synchronized successfully",
            "total_rooms": len(rooms),
            "synced": synced_count,
            "locations_created": created_count,
            "rooms_linked": linked_count
        }
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error syncing rooms: {str(e)}")


# Asset Mapping Endpoints
@router.post("/asset-mappings", response_model=AssetMappingOut)
@router.post("/mapping", response_model=AssetMappingOut)
def create_asset_mapping(
    mapping: AssetMappingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    try:
        mapping_data = mapping.model_dump()
        created = inventory_crud.create_asset_mapping(db, mapping_data, branch_id=branch_id, assigned_by=current_user.id)

        
        
        # Load relationships for response
        assigner = db.query(User).filter(User.id == created.assigned_by).first()
        item = inventory_crud.get_item_by_id(db, created.item_id)
        location = db.query(Location).filter(Location.id == created.location_id, (Location.branch_id == branch_id if branch_id is not None else True)).first()
        
        # Construct location name safely
        location_name = None
        if location:
            if location.building and location.room_area:
                location_name = f"{location.building} - {location.room_area}"
            elif location.building:
                location_name = location.building
            elif location.room_area:
                location_name = location.room_area
            elif hasattr(location, 'name') and location.name:
                location_name = location.name
        
        return {
            "id": created.id,
            "item_id": created.item_id,
            "location_id": created.location_id,
            "serial_number": created.serial_number,
            "assigned_date": created.assigned_date,
            "assigned_by": created.assigned_by,
            "notes": created.notes,
            "is_active": created.is_active,
            "unassigned_date": created.unassigned_date,
            "quantity": created.quantity,
            "assigned_by_name": assigner.name if assigner else None,
            "item_name": item.name if item else None,
            "location_name": location_name
        }
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating asset mapping: {str(e)}")


@router.get("/asset-mappings", response_model=List[AssetMappingOut])
def get_asset_mappings(
    skip: int = 0,
    limit: int = 100,
    location_id: Optional[int] = None,
    is_fixed_asset: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):

    from app.models.inventory import AssetMapping, InventoryItem, LocationStock, Location
    from sqlalchemy import or_

    # 1. Fetch Real Mappings
    mapping_query = db.query(AssetMapping).join(InventoryItem).filter(AssetMapping.is_active == True)
    if branch_id is not None:
        mapping_query = mapping_query.filter(AssetMapping.branch_id == branch_id)

    if location_id:
        mapping_query = mapping_query.filter(AssetMapping.location_id == location_id)
    if is_fixed_asset is not None:
        mapping_query = mapping_query.filter(InventoryItem.is_asset_fixed == is_fixed_asset)
    
    real_mappings = mapping_query.all()
    
    # 2. Fetch Location Stock
    stock_query = db.query(LocationStock).join(InventoryItem).join(Location)
    if branch_id is not None:
        stock_query = stock_query.filter(LocationStock.branch_id == branch_id)

    if location_id:
        stock_query = stock_query.filter(LocationStock.location_id == location_id)
    else:
        # Default: Exclude inventory points, BUT keep Guest Rooms (even if flagged as inventory points)
        stock_query = stock_query.filter(
            or_(
                Location.is_inventory_point == False,
                Location.location_type == "GUEST_ROOM"
            )
        )
    
    if is_fixed_asset is not None:
        stock_query = stock_query.filter(InventoryItem.is_asset_fixed == is_fixed_asset)
        
    stocks = stock_query.all()
    
    # 3. Calculate "Implicit" Mappings (Stock - Mapped)
    stock_map = {} # (location_id, item_id) -> total_stock_qty
    for s in stocks:
        key = (s.location_id, s.item_id)
        stock_map[key] = {
            "qty": s.quantity,
            "stock_obj": s,
            "item": s.item
        }
        
    mapped_qty_map = {} # (location_id, item_id) -> total_mapped_qty
    for m in real_mappings:
        key = (m.location_id, m.item_id)
        mapped_qty_map[key] = mapped_qty_map.get(key, 0) + (m.quantity or 1)
        
    final_list = []
    
    # Add Real Mappings
    for m in real_mappings:
        location = db.query(Location).filter(Location.id == m.location_id, (Location.branch_id == branch_id if branch_id is not None else True)).first()
        # Skip if location is inventory point AND NOT a Guest Room (unless specific location requested)
        if not location_id and location and location.is_inventory_point and location.location_type != "GUEST_ROOM":
            continue
            
        assigner = db.query(User).filter(User.id == m.assigned_by).first() if m.assigned_by else None
        item = inventory_crud.get_item_by_id(db, m.item_id)
        
        # Prioritize location.name (e.g., "Room 101"), fallback to building-room_area format
        if location.name:
            location_display = location.name
        elif location.building or location.room_area:
            location_display = f"{location.building} - {location.room_area}"
        else:
            location_display = f"Location {location.id}"
            
        final_list.append({
            **m.__dict__,
            "assigned_by_name": assigner.name if assigner else None,
            "item_name": item.name if item else None,
            "location_name": location_display,
            "is_virtual": False
        })
        
    # Add Virtual Mappings (Implicit)
    for key, data in stock_map.items():
        loc_id, item_id = key
        total_stock = data['qty']
        mapped_total = mapped_qty_map.get(key, 0)
        
        remaining = total_stock - mapped_total
        
        if remaining > 0:
            # Create Virtual Mapping
            s = data['stock_obj']
            item = data['item']
            location = s.location # Relationship should be loaded or fetched
            
            # Ensure location name is available
            if not location:
                location = db.query(Location).filter(Location.id == loc_id, (Location.branch_id == branch_id if branch_id is not None else True)).first()
            
            # Prioritize location.name (e.g., "Room 101"), fallback to building-room_area format
            if location.name:
                location_display = location.name
            elif location.building or location.room_area:
                location_display = f"{location.building} - {location.room_area}"
            else:
                location_display = f"Location {location.id}"
                
            final_list.append({
                "id": -s.id, # Negative ID to avoid collision
                "item_id": item_id,
                "location_id": loc_id,
                "item_name": item.name,
                "location_name": location_display,
                "quantity": remaining,
                "assigned_date": s.last_updated,
                "created_at": s.last_updated,
                "updated_at": s.last_updated,
                "notes": "Implicit Assignment (from Stock)",
                "serial_number": None,
                "assigned_by": None,
                "assigned_by_name": "System",
                "status": "active",
                "is_virtual": True
            })
            
    # Sort by recent date
    from datetime import timezone, datetime as dt
    final_list.sort(key=lambda x: x.get('created_at') or x.get('assigned_date') or dt.min, reverse=True)
    
    # Apply pagination
    return final_list[skip : skip + limit]


@router.put("/asset-mappings/{mapping_id}", response_model=AssetMappingOut)
def update_asset_mapping(
    mapping_id: int,
    update_data: AssetMappingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    # Verify mapping belongs to branch
    mapping = db.query(AssetMapping).filter(AssetMapping.id == mapping_id, AssetMapping.branch_id == branch_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Asset Mapping not found in this branch")
        
    data = update_data.model_dump(exclude_unset=True)

    updated = inventory_crud.update_asset_mapping(db, mapping_id, data)
    
    if not updated:
        raise HTTPException(status_code=404, detail="Asset Mapping not found")
        
    # Load relationships for response
    assigner = db.query(User).filter(User.id == updated.assigned_by).first() if updated.assigned_by else None
    item = inventory_crud.get_item_by_id(db, updated.item_id)
    location = db.query(Location).filter(Location.id == updated.location_id, (Location.branch_id == branch_id if branch_id is not None else True)).first()
    
    return {
        **updated.__dict__,
        "assigned_by_name": assigner.name if assigner else None,
        "item_name": item.name if item else None,
        "location_name": f"{location.building} - {location.room_area}" if location else None
    }


@router.delete("/asset-mappings/{mapping_id}")
def unassign_asset(
    mapping_id: int,
    destination_location_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    from app.models.inventory import AssetMapping, LocationStock
    
    # Handle Virtual Mapping (Negative ID implies it refers to LocationStock ID)
    if mapping_id < 0:
        stock_id = abs(mapping_id)
        stock_check = db.query(LocationStock).filter(LocationStock.id == stock_id).first()
        if not stock_check:
             raise HTTPException(status_code=404, detail="Virtual Asset Mapping (Stock) not found")
        
        if branch_id is not None and stock_check.branch_id != branch_id:
             raise HTTPException(status_code=403, detail="Access denied for this branch's stock")
        
        # Virtual mappings are always "active" if they exist in stock
        mapping_check = stock_check
    else:
        # Verify mapping exists and belongs to branch (if branch_id is provided)
        query = db.query(AssetMapping).filter(AssetMapping.id == mapping_id)
        if branch_id is not None:
            query = query.filter(AssetMapping.branch_id == branch_id)
        
        mapping_check = query.first()
        if not mapping_check:
            raise HTTPException(status_code=404, detail="Asset Mapping not found or access denied for this branch")
        
    try:
        mapping = inventory_crud.unassign_asset(db, mapping_id, destination_location_id=destination_location_id, unassigned_by=current_user.id)

        if not mapping:
            raise HTTPException(status_code=404, detail="Asset mapping not found")
        return {"message": "Asset unassigned successfully"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error unassigning asset: {str(e)}")


# Asset Registry Endpoints (The "Profile" - tracks individual instances)
@router.post("/asset-registry", response_model=AssetRegistryOut)
def create_asset_registry(
    asset: AssetRegistryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    asset_data = asset.model_dump()
    created = inventory_crud.create_asset_registry(db, asset_data, branch_id=branch_id, created_by=current_user.id)

    
    # Load relationships for response
    item = inventory_crud.get_item_by_id(db, created.item_id)
    location = db.query(Location).filter(Location.id == created.current_location_id, (Location.branch_id == branch_id if branch_id is not None else True)).first() if created.current_location_id else None
    
    return {
        **created.__dict__,
        "item_name": item.name if item else None,
        "current_location_name": f"{location.building} - {location.room_area}" if location else None
    }


@router.get("/asset-registry", response_model=List[AssetRegistryOut])
def get_asset_registry(
    skip: int = 0,
    limit: int = 100,
    location_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    assets = inventory_crud.get_all_asset_registry(db, branch_id=branch_id, skip=skip, limit=limit, location_id=location_id, status=status)

    result = []
    for asset in assets:
        item = inventory_crud.get_item_by_id(db, asset.item_id)
        location = db.query(Location).filter(Location.id == asset.current_location_id, (Location.branch_id == branch_id if branch_id is not None else True)).first() if asset.current_location_id else None
        result.append({
            **asset.__dict__,
            "item_name": item.name if item else None,
            "current_location_name": f"{location.building} - {location.room_area}" if location else None
        })
    return result


@router.get("/asset-registry/{asset_id}", response_model=AssetRegistryOut)
def get_asset_registry_by_id(
    asset_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    asset = db.query(AssetRegistry).filter(AssetRegistry.id == asset_id, AssetRegistry.branch_id == branch_id).first()

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    item = inventory_crud.get_item_by_id(db, asset.item_id)
    location = db.query(Location).filter(Location.id == asset.current_location_id, (Location.branch_id == branch_id if branch_id is not None else True)).first() if asset.current_location_id else None
    
    return {
        **asset.__dict__,
        "item_name": item.name if item else None,
        "current_location_name": f"{location.building} - {location.room_area}" if location else None
    }


@router.put("/asset-registry/{asset_id}", response_model=AssetRegistryOut)
def update_asset_registry(
    asset_id: int,
    asset_update: AssetRegistryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    # Verify asset belongs to branch
    asset_check = db.query(AssetRegistry).filter(AssetRegistry.id == asset_id, AssetRegistry.branch_id == branch_id).first()
    if not asset_check:
        raise HTTPException(status_code=404, detail="Asset not found in this branch")
        
    asset_data = asset_update.model_dump(exclude_unset=True)

    updated = inventory_crud.update_asset_registry(db, asset_id, asset_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    item = inventory_crud.get_item_by_id(db, updated.item_id)
    location = db.query(Location).filter(Location.id == updated.current_location_id, (Location.branch_id == branch_id if branch_id is not None else True)).first() if updated.current_location_id else None
    
    return {
        **updated.__dict__,
        "item_name": item.name if item else None,
        "current_location_name": f"{location.building} - {location.room_area}" if location else None
    }


# Stock Requisition Endpoints
@router.post("/requisitions", response_model=StockRequisitionOut)
def create_stock_requisition(
    requisition: StockRequisitionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    return inventory_crud.create_stock_requisition(db, requisition, branch_id=branch_id, requested_by_id=current_user.id)



@router.get("/requisitions", response_model=List[StockRequisitionOut])
def get_stock_requisitions(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    return inventory_crud.get_all_stock_requisitions(db, branch_id=branch_id, skip=skip, limit=limit, status=status)



@router.get("/requisitions/{requisition_id}", response_model=StockRequisitionOut)
def get_stock_requisition(
    requisition_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    requisition = db.query(StockRequisition).filter(StockRequisition.id == requisition_id, StockRequisition.branch_id == branch_id).first()

    if not requisition:
        raise HTTPException(status_code=404, detail="Requisition not found")
    return requisition


@router.patch("/requisitions/{requisition_id}", response_model=StockRequisitionOut)
def update_stock_requisition(
    requisition_id: int,
    update_data: StockRequisitionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # For now, we only support status update via this endpoint or specific fields
    # If status is in update_data, use the status update logic
    if update_data.status:
        return inventory_crud.update_stock_requisition_status(
            db, requisition_id, update_data.status, approved_by_id=current_user.id if update_data.status == "approved" else None
        )
    return inventory_crud.get_stock_requisition_by_id(db, requisition_id)


@router.patch("/requisitions/{requisition_id}/status", response_model=StockRequisitionOut)
def update_stock_requisition_status(
    requisition_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    updated = inventory_crud.update_stock_requisition_status(
        db, requisition_id, status, approved_by_id=current_user.id if status == "approved" else None
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Requisition not found")
    return updated




@router.get("/issues", response_model=List[StockIssueOut])
def get_stock_issues(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    return inventory_crud.get_all_stock_issues(db, branch_id=branch_id, skip=skip, limit=limit)


@router.get("/assets/registry", response_model=List[AssetRegistryOut])
def get_all_assets_registry(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    """Get all individual fixed asset instances"""
    from app.models.inventory import AssetRegistry
    assets = db.query(AssetRegistry).filter(AssetRegistry.branch_id == branch_id).options(

        joinedload(AssetRegistry.item),
        joinedload(AssetRegistry.current_location)
    ).order_by(AssetRegistry.created_at.desc()).offset(skip).limit(limit).all()
    
    return assets


@router.get("/transactions", response_model=List[InventoryTransactionOut])
def get_all_transactions(
    limit: int = 50,
    skip: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    """Get global transaction history"""
    from app.models.inventory import InventoryTransaction, InventoryItem
    from app.models.user import User
    
    query = db.query(InventoryTransaction).options(
        joinedload(InventoryTransaction.item),
        joinedload(InventoryTransaction.user),
        joinedload(InventoryTransaction.source_location),
        joinedload(InventoryTransaction.destination_location)
    )
    if branch_id is not None:
        query = query.filter(InventoryTransaction.branch_id == branch_id)
        
    transactions = query.order_by(InventoryTransaction.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for txn in transactions:
        result.append({
            **txn.__dict__,
            "item_name": txn.item.name if txn.item else "Unknown Item",
            "created_by_name": txn.user.name if txn.user else "System",
            "source_location_name": txn.source_location.name if txn.source_location else None,
            "destination_location_name": txn.destination_location.name if txn.destination_location else None,
            "unit": txn.item.unit if txn.item else ""
        })
        
    return result


@router.get("/items/{item_id}/transactions", response_model=List[InventoryTransactionOut])
def get_item_transactions(
    item_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):

    """
    Get all transactions for a specific item to show history/audit trail.
    """
    from app.models.inventory import InventoryTransaction, PurchaseMaster
    from app.models.user import User
    
    # Check if item exists
    item = inventory_crud.get_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    transactions = db.query(InventoryTransaction)\
        .options(
            joinedload(InventoryTransaction.source_location),
            joinedload(InventoryTransaction.destination_location)
        )\
        .filter(InventoryTransaction.item_id == item_id, InventoryTransaction.branch_id == branch_id)\
        .order_by(InventoryTransaction.created_at.desc())\
        .all()

    
    # Enrich with details if needed (User name, Reference context)
    # The response model InventoryTransactionOut should handle basic fields.
    # We might want to ensure 'created_by_name' is populated if the model expects it.
    
    result = []
    for txn in transactions:
        user = db.query(User).filter(User.id == txn.created_by).first() if txn.created_by else None
        
        # Format the result
        result.append({
            **txn.__dict__,
            "created_by_name": user.name if user else "System",
            "source_location_name": txn.source_location.name if txn.source_location else None,
            "destination_location_name": txn.destination_location.name if txn.destination_location else None,
        })
        
    return result

@router.post("/items/{item_id}/fix-stock", response_model=InventoryItemOut)
def fix_item_stock(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):

    """
    Recalculate item stock based on transaction history and update the current_stock value.
    This fixes discrepancies caused by manual edits or phantom updates.
    """
    from app.models.inventory import InventoryTransaction
    
    item = inventory_crud.get_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    # Calculate stock from transaction history
    transactions = db.query(InventoryTransaction).filter(InventoryTransaction.item_id == item_id, InventoryTransaction.branch_id == branch_id).all()

    
    calculated_stock = 0.0
    for txn in transactions:
        # Define logic match frontend
        if txn.transaction_type in ["in", "adjustment", "transfer_in"]:
            calculated_stock += txn.quantity
        elif txn.transaction_type in ["out", "transfer_out"]:
            calculated_stock -= txn.quantity
            
    # Update item
    item.current_stock = calculated_stock
    db.commit()
    db.refresh(item)
    
    # Return updated item with category (needed for response model)
    category = inventory_crud.get_category_by_id(db, item.category_id)
    
    return {
        **item.__dict__,
        "category_name": category.name if category else None,
        "department": category.parent_department if category else None,
        "is_low_stock": item.current_stock <= item.min_stock_level if item.min_stock_level else False,
        "branch_id": branch_id
    }



@router.post("/adjustments")
def create_stock_adjustment(
    adjustment: StockAdjustmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):

    from app.models.inventory import InventoryItem, LocationStock, InventoryTransaction
    
    item = db.query(InventoryItem).filter(InventoryItem.id == adjustment.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    loc_stock = db.query(LocationStock).filter(
        LocationStock.location_id == adjustment.location_id,
        LocationStock.item_id == adjustment.item_id,
        LocationStock.branch_id == branch_id
    ).first()

    
    current_qty = loc_stock.quantity if loc_stock else 0.0
    actual_qty = float(adjustment.actual_stock)
    diff = actual_qty - current_qty
    
    if diff == 0:
        return {"message": "No change in stock", "new_stock": actual_qty}
        
    # Transaction Type logic
    if diff > 0:
        trx_type = "adjustment" # Treated as positive/incoming in recalculate_stock
        direction = "Increased"
    else:
        trx_type = "out" # Treated as negative/outgoing in recalculate_stock
        direction = "Decreased"
    
    trx = InventoryTransaction(
        item_id=adjustment.item_id,
        transaction_type=trx_type,
        quantity=abs(diff),
        unit_price=item.unit_price,
        total_amount=abs(diff) * (item.unit_price or 0) if item.unit_price else 0,
        notes=f"Stock Adjustment by {current_user.name}: {direction} from {current_qty} to {actual_qty}. {adjustment.notes or ''}",
        created_by=current_user.id,
        reference_number=f"ADJ-{get_ist_now().strftime('%Y%m%d%H%M')}",
        source_location_id=adjustment.location_id if diff < 0 else None,
        destination_location_id=adjustment.location_id if diff > 0 else None,
        branch_id=branch_id
    )

    db.add(trx)
    
    # Update Location Stock
    if loc_stock:
        loc_stock.quantity = actual_qty
        loc_stock.updated_at = get_ist_now()
    else:
        new_stock = LocationStock(
            location_id=adjustment.location_id,
            item_id=adjustment.item_id,
            quantity=actual_qty,
            branch_id=branch_id
        )
        db.add(new_stock)
        
    # Update Global Stock
    if item.current_stock is None:
        item.current_stock = 0.0
    item.current_stock += diff
    
    db.commit()
    return {"message": "Stock adjusted successfully", "new_stock": actual_qty}


@router.get("/locations/{location_id}/stock")
def get_location_stock_endpoint(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    return inventory_crud.get_location_stock(db, location_id, branch_id=branch_id)



@router.get("/recipes")
def get_all_recipes_endpoint(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    recipes = inventory_crud.get_all_recipes(db, skip=skip, limit=limit, branch_id=branch_id)
    result = []
    for r in recipes:
        result.append({
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "food_item_name": r.food_item.name if r.food_item else None,
            "servings": float(r.servings or 1),
            "cost_per_serving": float(r.cost_per_serving or 0),
            "ingredients": [
                {
                    "item_name": i.inventory_item.name,
                    "quantity": float(i.quantity),
                    "unit": i.unit,
                    "cost": float(i.cost or 0)
                } for i in r.ingredients if i.inventory_item
            ]
        })
    return result


@router.get("/assets/registry", response_model=List[AssetRegistryOut])
def get_asset_registry(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    from app.models.inventory import AssetRegistry
    
    query = db.query(AssetRegistry)
    if branch_id is not None:
        query = query.filter(AssetRegistry.branch_id == branch_id)
    if active_only:
        query = query.filter(AssetRegistry.status != 'written_off')
        
    assets = query.offset(skip).limit(limit).all()

    
    result = []
    for asset in assets:
        result.append({
            **asset.__dict__,
            "item_name": asset.item.name if asset.item else "Unknown Item",
            "item_code": asset.item.item_code if asset.item else None,
            "category": asset.item.category.name if asset.item and asset.item.category else None,
            "location_name": asset.current_location.name if asset.current_location else "Unassigned",
            "purchase_order": asset.purchase_master.purchase_number if asset.purchase_master else None
        })
    return result


# Laundry Endpoints
@router.get("/laundry/items", response_model=List[LaundryLogOut])
def get_laundry_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    from app.models.inventory import LaundryLog
    from sqlalchemy.orm import joinedload
    
    query = db.query(LaundryLog).options(
        joinedload(LaundryLog.item),
        joinedload(LaundryLog.source_location)
    ).filter(LaundryLog.status != "Returned")
    
    if branch_id is not None:
        query = query.filter(LaundryLog.branch_id == branch_id)
        
    logs = query.order_by(LaundryLog.sent_at.desc()).all()

    
    result = []
    for log in logs:
        result.append({
            **log.__dict__,
            "item_name": log.item.name if log.item else None,
            "source_location_name": log.source_location.name if log.source_location else (f"Room {log.room_number}" if log.room_number else "Unknown")
        })
    return result


@router.patch("/laundry/{log_id}/status")
def update_laundry_status(
    log_id: int,
    status: str,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    from app.models.inventory import LaundryLog
    
    log = db.query(LaundryLog).filter(LaundryLog.id == log_id, LaundryLog.branch_id == branch_id).first()

    if not log:
        raise HTTPException(status_code=404, detail="Laundry log not found")
    
    log.status = status
    if notes:
        if log.notes:
            log.notes += f" | {notes}"
        else:
            log.notes = notes
    
    if status == "Washed":
        log.washed_at = datetime.now(timezone.utc)
    elif status == "Returned":
        log.returned_at = datetime.now(timezone.utc)
        
    db.commit()
    return {"message": f"Laundry status updated to {status}"}



@router.post("/laundry/return-items")
def return_laundry_items(
    log_id: int,
    target_location_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):

    from app.models.inventory import LaundryLog, LocationStock, InventoryTransaction, Location
    
    log = db.query(LaundryLog).filter(LaundryLog.id == log_id, LaundryLog.branch_id == branch_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Laundry log not found")
    
    # 1. Find Laundry Location
    laundry_loc = db.query(Location).filter(Location.location_type == "LAUNDRY", (Location.branch_id == branch_id if branch_id is not None else True)).first()

    if not laundry_loc:
        raise HTTPException(
            status_code=400, 
            detail="A Laundry Location is missing for this branch. Please go to Inventory -> Locations, and create a new Location with the type set to 'Laundry' before returning items."
        )

    # 2. Update stock: Move from Laundry to target
    # Decrease Laundry stock
    laundry_stock = db.query(LocationStock).filter(
        LocationStock.location_id == laundry_loc.id,
        LocationStock.item_id == log.item_id,
        LocationStock.branch_id == branch_id
    ).first()
    
    if laundry_stock:
        laundry_stock.quantity = max(0, laundry_stock.quantity - log.quantity)
    
    # Increase Target stock
    target_stock = db.query(LocationStock).filter(
        LocationStock.location_id == target_location_id,
        LocationStock.item_id == log.item_id,
        LocationStock.branch_id == branch_id
    ).first()
    
    if not target_stock:
        target_stock = LocationStock(
            location_id=target_location_id,
            item_id=log.item_id,
            quantity=0,
            branch_id=branch_id
        )
        db.add(target_stock)
    
    target_stock.quantity += log.quantity
    
    # 3. Update Log
    log.status = "Returned"
    log.returned_at = datetime.now(timezone.utc)
    
    # 4. Transaction
    target_loc = db.query(Location).filter(Location.id == target_location_id, (Location.branch_id == branch_id if branch_id is not None else True)).first()
    target_name = target_loc.name if target_loc else f"Location {target_location_id}"
    
    transaction = InventoryTransaction(
        item_id=log.item_id,
        transaction_type="transfer",
        quantity=log.quantity,
        unit_price=0.0,
        reference_number=f"LAUNDRY-RET-{log.id}",
        notes=f"Returned from Laundry to {target_name}",
        created_by=current_user.id,
        source_location_id=laundry_loc.id,
        destination_location_id=target_location_id,
        branch_id=branch_id
    )

    db.add(transaction)
    
    db.commit()
    return {"message": "Items returned from laundry successfully"}


@router.post("/cleanup-orphaned-assets")
def cleanup_orphaned_asset_mappings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):

    """
    Cleanup endpoint to deactivate orphaned asset mappings in checked-out rooms.
    This fixes asset mappings that weren't properly deactivated during return service completion.
    """
    from app.models.inventory import AssetMapping
    from app.models.room import Room
    
    # Find all Available rooms (checked out)
    available_rooms = db.query(Room).filter(Room.status == "Available", Room.branch_id == branch_id).all()

    
    total_deactivated = 0
    rooms_cleaned = []
    
    for room in available_rooms:
        if not room.inventory_location_id:
            continue
        
        # Find active asset mappings in this room
        active_mappings = db.query(AssetMapping).filter(
            AssetMapping.location_id == room.inventory_location_id,
            AssetMapping.is_active == True,
            AssetMapping.branch_id == branch_id
        ).all()
        
        if active_mappings:
            room_deactivated = 0
            for mapping in active_mappings:
                mapping.is_active = False
                total_deactivated += 1
                room_deactivated += 1
            
            rooms_cleaned.append({
                "room_number": room.number,
                "assets_deactivated": room_deactivated
            })
    
    db.commit()
    
    return {
        "message": f"Cleanup complete! Deactivated {total_deactivated} orphaned asset mappings.",
        "total_deactivated": total_deactivated,
        "rooms_cleaned": rooms_cleaned
    }


# Inter-branch Transfer Endpoints
@router.post("/transfers", response_model=InterBranchTransferOut)
def create_transfer_endpoint(
    transfer: InterBranchTransferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    try:
        # Check if item exists
        item = inventory_crud.get_item_by_id(db, transfer.item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")

        # Check if source location exists and belongs to this branch
        from app.models.inventory import Location
        source_loc = db.query(Location).filter(Location.id == transfer.source_location_id, Location.branch_id == branch_id).first()
        if not source_loc:
            raise HTTPException(status_code=404, detail="Source location not found in this branch")

        # Check if destination branch exists
        from app.models.branch import Branch
        dest_branch = db.query(Branch).filter(Branch.id == transfer.destination_branch_id).first()
        if not dest_branch:
            raise HTTPException(status_code=404, detail="Destination branch not found")

        created = inventory_crud.create_inter_branch_transfer(
            db, transfer.model_dump(), source_branch_id=branch_id, created_by=current_user.id
        )
        return created
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/transfers", response_model=List[InterBranchTransferOut])
def get_transfers_endpoint(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Depends(get_branch_id)
):
    transfers = inventory_crud.get_all_inter_branch_transfers(db, branch_id=branch_id, skip=skip, limit=limit)
    result = []
    for t in transfers:
        result.append({
            **t.__dict__,
            "item_name": t.item.name if t.item else None,
            "source_branch_name": t.source_branch.name if t.source_branch else None,
            "destination_branch_name": t.destination_branch.name if t.destination_branch else None,
            "source_location_name": t.source_location.name if t.source_location else None,
            "destination_location_name": t.destination_location.name if t.destination_location else None
        })
    return result


@router.patch("/transfers/{transfer_id}/status")
def update_transfer_status_endpoint(
    transfer_id: int,
    status: str,
    location_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    """
    Update status of a transfer.
    - 'in_transit': Can only be done by source branch. Deducts stock.
    - 'received': Can only be done by destination branch. Adds stock to location_id.
    - 'cancelled': Can be done by source branch if not in transit.
    """
    transfer = inventory_crud.get_transfer_by_id(db, transfer_id)
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")

    if status == "in_transit":
        if branch_id is not None and transfer.source_branch_id != branch_id:
            raise HTTPException(status_code=403, detail="Only source branch can mark as in-transit")
    
    if status == "received":
        if branch_id is not None and transfer.destination_branch_id != branch_id:
            raise HTTPException(status_code=403, detail="Only destination branch can mark as received")
        if not location_id:
            raise HTTPException(status_code=400, detail="location_id is required for receipt")

    updated = inventory_crud.update_transfer_status(db, transfer_id, status, location_id)
    if not updated:
        raise HTTPException(status_code=400, detail="Failed to update status")
    
    return updated


from pydantic import BaseModel

class ReturnItemRequest(BaseModel):
    booking_id: int
    item_id: int
    quantity: float
    return_location_id: int
    is_laundry: bool = False

@router.post("/return-item")
def return_inventory_item(
    req: ReturnItemRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: int = Depends(get_branch_id)
):
    from app.models.booking import Booking, BookingRoom
    from app.models.Package import PackageBooking, PackageBookingRoom
    from app.models.room import Room
    from app.models.inventory import Location, LocationStock, AssetMapping, InventoryTransaction, StockIssue, StockIssueDetail, LaundryLog, InventoryItem
    from datetime import timezone, datetime
    
    booking_id = req.booking_id
    item_id = req.item_id
    quantity = req.quantity
    return_location_id = req.return_location_id
    is_laundry = req.is_laundry
    
    # 1. Fetch booking to identify room location IDs
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    room_ids = []
    if booking:
        room_ids = [br.room_id for br in booking.booking_rooms if br.room_id]
    else:
        pkg_booking = db.query(PackageBooking).filter(PackageBooking.id == booking_id).first()
        if pkg_booking:
            room_ids = [r.room_id for r in pkg_booking.rooms if r.room_id]
            
    if not room_ids:
        raise HTTPException(status_code=400, detail="No rooms associated with this booking")
        
    rooms = db.query(Room).filter(Room.id.in_(room_ids)).all()
    source_location_ids = [r.inventory_location_id for r in rooms if r.inventory_location_id]
    
    if not source_location_ids:
        raise HTTPException(status_code=400, detail="No inventory location mapped to the rooms in this booking")
        
    primary_room_loc_id = source_location_ids[0]
    
    # 2. Check if active asset mapping exists first
    mapping = db.query(AssetMapping).filter(
        AssetMapping.location_id.in_(source_location_ids),
        AssetMapping.item_id == item_id,
        AssetMapping.is_active == True
    ).first()
    
    if mapping:
        # Return asset using unassign_asset CRUD function
        from app.curd.inventory import unassign_asset as crud_unassign_asset
        crud_unassign_asset(db, mapping_id=mapping.id, destination_location_id=return_location_id, unassigned_by=current_user.id)
        return {"message": "Asset mapping unassigned and returned successfully"}
        
    # 4. Perform physical LocationStock movements
    # Search for room stock in all locations associated with the booking's rooms
    room_stock = db.query(LocationStock).filter(
        LocationStock.location_id.in_(source_location_ids),
        LocationStock.item_id == item_id
    ).first()

    # 3. Check for issued inventory items to ensure we are returning something that was actually issued
    issue_detail = db.query(StockIssueDetail).join(StockIssue).filter(
        StockIssue.booking_id == booking_id,
        StockIssueDetail.item_id == item_id
    ).first()
    
    # We don't modify the existing record here to maintain audit trail, 
    # as we add a new negative issue below. The total sum will be correct.
    # But we check existence to validate the return.
    if not issue_detail and not room_stock:
        # If no issue record and no room stock, we might still allow return if it's a fixed asset 
        # but that's handled above in mapping section.
        pass
            
    if room_stock:
        # Use the actual location where the item was found
        actual_room_loc_id = room_stock.location_id
        room_stock.quantity = max(0.0, room_stock.quantity - quantity)
        room_stock.last_updated = datetime.now(timezone.utc)
    else:
        actual_room_loc_id = primary_room_loc_id
        
    # Update destination stock
    dest_stock = db.query(LocationStock).filter(
        LocationStock.location_id == return_location_id,
        LocationStock.item_id == item_id
    ).first()
    
    if dest_stock:
        dest_stock.quantity += quantity
        dest_stock.last_updated = datetime.now(timezone.utc)
    else:
        dest_stock = LocationStock(
            location_id=return_location_id,
            item_id=item_id,
            quantity=quantity,
            last_updated=datetime.now(timezone.utc),
            branch_id=branch_id
        )
        db.add(dest_stock)
        
    # 5. Create Transaction / Issue audit logs
    item_obj = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    unit_price = item_obj.unit_price if item_obj else 0.0
    
    from app.curd.inventory import generate_issue_number
    issue_number = generate_issue_number(db, branch_id)
    
    dest_loc = db.query(Location).filter(Location.id == return_location_id).first()
    dest_name = dest_loc.name if dest_loc else "Return Location"
    
    new_issue = StockIssue(
        issue_number=issue_number,
        issued_by=current_user.id,
        source_location_id=actual_room_loc_id,
        destination_location_id=return_location_id,
        issue_date=datetime.now(timezone.utc),
        notes=f"Return of item from Room Booking #{booking_id} to {dest_name}",
        branch_id=branch_id,
        booking_id=booking_id
    )
    db.add(new_issue)
    db.flush()
    
    new_detail = StockIssueDetail(
        issue_id=new_issue.id,
        item_id=item_id,
        issued_quantity=-quantity,
        unit=item_obj.unit if item_obj else "pcs",
        unit_price=unit_price,
        cost=-quantity * unit_price,
        notes="Returned to stock"
    )
    db.add(new_detail)
    
    # Traceability transactions
    txn_out = InventoryTransaction(
        item_id=item_id,
        transaction_type="transfer_out",
        quantity=quantity,
        unit_price=unit_price,
        total_amount=unit_price * quantity,
        reference_number=issue_number,
        notes=f"Returned item moved out from Room (Booking #{booking_id})",
        created_by=current_user.id,
        source_location_id=actual_room_loc_id,
        destination_location_id=return_location_id,
        branch_id=branch_id
    )
    db.add(txn_out)
    
    txn_in = InventoryTransaction(
        item_id=item_id,
        transaction_type="transfer_in",
        quantity=quantity,
        unit_price=unit_price,
        total_amount=unit_price * quantity,
        reference_number=issue_number,
        notes=f"Returned item received at {dest_name} (Booking #{booking_id})",
        created_by=current_user.id,
        source_location_id=actual_room_loc_id,
        destination_location_id=return_location_id,
        branch_id=branch_id
    )
    db.add(txn_in)
    
    # 6. If laundry return, create LaundryLog
    if is_laundry:
        laundry = LaundryLog(
            item_id=item_id,
            source_location_id=actual_room_loc_id,
            room_number=rooms[0].number if rooms else f"Room-{booking_id}",
            quantity=quantity,
            status="Incomplete Washing",
            sent_at=datetime.now(timezone.utc),
            created_by=current_user.id,
            branch_id=branch_id,
            notes=f"Linen return from Room (Booking #{booking_id})"
        )
        db.add(laundry)
        
    db.commit()
    return {"message": "Inventory returned successfully"}


