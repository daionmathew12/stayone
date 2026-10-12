from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func
from decimal import Decimal
from datetime import timezone, datetime
from typing import Optional, List
from fastapi import HTTPException
from app.models.inventory import (
    InventoryCategory, InventoryItem, Vendor, PurchaseMaster, PurchaseDetail, InventoryTransaction,
    StockRequisition, StockRequisitionDetail, StockIssue, StockIssueDetail, WasteLog, Location, AssetMapping
)
from app.schemas.inventory import (
    InventoryCategoryCreate, InventoryCategoryUpdate, InventoryItemCreate, InventoryItemUpdate, VendorCreate, PurchaseMasterCreate, PurchaseMasterUpdate,
    StockRequisitionCreate, StockRequisitionUpdate, StockIssueCreate
)


# Category CRUD
def create_category(db: Session, data: InventoryCategoryCreate, branch_id: int):
    category = InventoryCategory(**data.model_dump(), branch_id=branch_id)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def get_all_categories(db: Session, skip: int = 0, limit: int = 100, active_only: bool = True, branch_id: Optional[int] = None):
    query = db.query(InventoryCategory)
    if branch_id is not None:
        query = query.filter(InventoryCategory.branch_id == branch_id)
    if active_only:
        query = query.filter(InventoryCategory.is_active == True)
    return query.offset(skip).limit(limit).all()


def get_category_by_id(db: Session, category_id: int, branch_id: Optional[int] = None):
    query = db.query(InventoryCategory).filter(InventoryCategory.id == category_id)
    if branch_id is not None:
        query = query.filter(InventoryCategory.branch_id == branch_id)
    return query.first()


def update_category(db: Session, category_id: int, data: InventoryCategoryUpdate, branch_id: Optional[int] = None):
    from app.models.inventory import InventoryCategory
    category = get_category_by_id(db, category_id, branch_id=branch_id)
    if not category:
        return None
    
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    
    db.commit()
    db.refresh(category)
    return category


# Item CRUD
def create_item(db: Session, data: InventoryItemCreate, branch_id: int):
    item = InventoryItem(**data.model_dump(), branch_id=branch_id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def get_all_items(db: Session, skip: int = 0, limit: int = 100, category_id: Optional[int] = None, active_only: bool = True, is_fixed_asset: Optional[bool] = None, branch_id: Optional[int] = None):
    query = db.query(InventoryItem).options(
        joinedload(InventoryItem.category),
        joinedload(InventoryItem.preferred_vendor)
    )
    if branch_id is not None:
        query = query.filter(InventoryItem.branch_id == branch_id)
    if category_id:
        query = query.filter(InventoryItem.category_id == category_id)
    if active_only:
        query = query.filter(InventoryItem.is_active == True)
    if is_fixed_asset is not None:
        query = query.filter(InventoryItem.is_asset_fixed == is_fixed_asset)
    return query.offset(skip).limit(limit).all()


def get_item_by_id(db: Session, item_id: int):
    query = db.query(InventoryItem).filter(InventoryItem.id == item_id)
    return query.first()


def update_item(db: Session, item_id: int, data: InventoryItemUpdate):
    item = get_item_by_id(db, item_id)
    if not item:
        return None
    
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(item, field, value)
    
    db.commit()
    db.refresh(item)
    return item


def update_item_cost_wac(db: Session, item_id: int, new_quantity: float, new_unit_price: float, is_cancellation: bool = False, commit: bool = True):
    """
    Update item's unit_price using Weighted Average Cost (WAC) formula.
    WAC = (Old Stock * Old Price + New Stock * New Price) / (Old Stock + New Stock)
    """
    item = get_item_by_id(db, item_id)
    if not item:
        return None
    
    old_stock = float(item.current_stock or 0)
    old_price = float(item.unit_price or 0)
    old_value = old_stock * old_price
    
    if is_cancellation:
        # For cancellation, we want to remove the specific value of the cancelled items
        # NOTE: This assumes new_unit_price is the price at which they were purchased
        cancelled_stock = float(new_quantity)
        cancelled_price = float(new_unit_price)
        cancelled_value = cancelled_stock * cancelled_price
        
        remaining_stock = old_stock - cancelled_stock
        remaining_value = old_value - cancelled_value
        
        item.current_stock = remaining_stock
        if remaining_stock > 0:
            item.unit_price = round(remaining_value / remaining_stock, 2)
        elif remaining_stock == 0:
            # If stock becomes zero, we might keep the last price or reset to latest known price
            # Resetting to new_unit_price (the price of the batch being reversed) is a fallback
            pass 
    else:
        new_stock = float(new_quantity)
        new_price = float(new_unit_price)
        new_value = new_stock * new_price
        
        total_stock = old_stock + new_stock
        total_value = old_value + new_value
        
        item.current_stock = total_stock
        if total_stock > 0:
            item.unit_price = round(total_value / total_stock, 2)
        else:
            # If stock is 0 or negative after this, set price to the latest purchase price
            item.unit_price = new_price
            
    if commit:
        db.commit()
        db.refresh(item)
    return item


def update_item_stock(db: Session, item_id: int, quantity_change: float, transaction_type: str, unit_price: Optional[float] = None):
    """Update item stock and optionally update price using WAC if type is 'in'"""
    if transaction_type == "in" and unit_price is not None:
        return update_item_cost_wac(db, item_id, quantity_change, unit_price)
    
    item = get_item_by_id(db, item_id)
    if not item:
        return None
    
    if transaction_type == "in":
        item.current_stock += quantity_change
        if unit_price is not None:
            item.unit_price = unit_price # Simple update if not using WAC helper for some reason
    elif transaction_type == "out":
        item.current_stock -= quantity_change
    elif transaction_type == "adjustment":
        item.current_stock = quantity_change
        if unit_price is not None:
            item.unit_price = unit_price
    
    db.commit()
    db.refresh(item)
    return item


# Vendor CRUD
def create_vendor(db: Session, data: VendorCreate, branch_id: int):
    vendor = Vendor(**data.model_dump(), branch_id=branch_id)
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return vendor


def get_all_vendors(db: Session, branch_id: Optional[int] = None, skip: int = 0, limit: int = 100, active_only: bool = False):
    from sqlalchemy.orm import joinedload
    query = db.query(Vendor).options(joinedload(Vendor.branch))
    if branch_id is not None:
        query = query.filter(Vendor.branch_id == branch_id)
    if active_only:
        query = query.filter(Vendor.is_active == True)
    return query.offset(skip).limit(limit).all()


def get_vendor_by_id(db: Session, vendor_id: int, branch_id: Optional[int] = None):
    query = db.query(Vendor).filter(Vendor.id == vendor_id)
    if branch_id is not None:
        query = query.filter(Vendor.branch_id == branch_id)
    return query.first()

def get_vendors_by_ids(db: Session, vendor_ids: List[int]):
    """Batch load vendors by IDs to avoid N+1 queries"""
    if not vendor_ids:
        return []
    return db.query(Vendor).filter(Vendor.id.in_(vendor_ids)).all()


# Purchase Master CRUD
def generate_purchase_number(db: Session, branch_id: int):
    """Generate unique purchase number based on latest sequence for a branch"""
    today_str = datetime.now().strftime('%Y%m%d')
    prefix = f"PO-{today_str}-"
    
    last_entry = db.query(PurchaseMaster).filter(
        PurchaseMaster.purchase_number.like(f"{prefix}%")
    ).order_by(PurchaseMaster.id.desc()).first()

    start_seq = 1
    if last_entry and last_entry.purchase_number:
        try:
            parts = last_entry.purchase_number.split('-')
            start_seq = int(parts[-1]) + 1
        except (ValueError, IndexError):
            pass

    # Safety Check Loop
    loop_count = 0
    while True:
        loop_count += 1
        candidate = f"{prefix}{start_seq:04d}"
        exists = db.query(PurchaseMaster).filter(PurchaseMaster.purchase_number == candidate).count()
        if exists == 0:
            return candidate
            
        start_seq += 1
        if loop_count > 100:
             return candidate # Failsafe




def calculate_gst(amount: Decimal, gst_rate: Decimal, is_interstate: bool = False):
    """Calculate CGST, SGST, or IGST based on interstate status"""
    gst_amount = (amount * gst_rate) / Decimal("100")
    if is_interstate:
        return Decimal("0.00"), Decimal("0.00"), gst_amount
    else:
        # Split GST equally between CGST and SGST
        half_gst = gst_amount / Decimal("2")
        return half_gst, half_gst, Decimal("0.00")


def create_purchase_master(db: Session, data: PurchaseMasterCreate, branch_id: int, created_by: int = None):

    """Create purchase master with details and calculate totals"""
    from app.models.inventory import Location
    
    # Derivation logic for Enterprise View (branch_id=None or 'all')
    dest_loc_id = data.destination_location_id
    if not branch_id or branch_id == "all":
        if dest_loc_id:
            loc = db.query(Location).filter(Location.id == dest_loc_id).first()
            if loc:
                branch_id = loc.branch_id
        # Fallback to 2 (trails) if still not found
        if not branch_id or branch_id == "all":
            branch_id = 2

    # Generate purchase number if not provided
    if not data.purchase_number:
        data.purchase_number = generate_purchase_number(db, branch_id)

    
    # Get vendor to check if interstate (different state)
    vendor = get_vendor_by_id(db, data.vendor_id)
    is_interstate = False  # Default, can be enhanced with user state
    
    # Calculate totals from details
    sub_total = Decimal("0.00")
    total_cgst = Decimal("0.00")
    total_sgst = Decimal("0.00")
    total_igst = Decimal("0.00")
    total_discount = Decimal("0.00")
    
    # Create purchase master
    master_data = data.model_dump(exclude={"details"})
    purchase_master = PurchaseMaster(**master_data, created_by=created_by, branch_id=branch_id)

    db.add(purchase_master)
    db.flush()  # Get the ID
    
    # Create purchase details and calculate totals
    for detail_data in data.details:
        item = get_item_by_id(db, detail_data.item_id)
        if not item:
            continue
        
        # Use item's HSN if not provided in detail
        hsn_code = detail_data.hsn_code or item.hsn_code
        
        # Calculate line total before GST
        line_total = (Decimal(str(detail_data.quantity)) * Decimal(str(detail_data.unit_price))) - Decimal(str(detail_data.discount))
        
        # Calculate GST
        cgst, sgst, igst = calculate_gst(line_total, Decimal(str(detail_data.gst_rate)), is_interstate)
        line_total_with_gst = line_total + cgst + sgst + igst
        
        # Create purchase detail
        purchase_detail = PurchaseDetail(
            purchase_master_id=purchase_master.id,
            item_id=detail_data.item_id,
            hsn_code=hsn_code,
            quantity=detail_data.quantity,
            unit=detail_data.unit,
            unit_price=Decimal(str(detail_data.unit_price)),
            gst_rate=Decimal(str(detail_data.gst_rate)),
            cgst_amount=cgst,
            sgst_amount=sgst,
            igst_amount=igst,
            discount=Decimal(str(detail_data.discount)),
            total_amount=line_total_with_gst,
            notes=detail_data.notes
        )
        db.add(purchase_detail)
        
        # Accumulate totals
        sub_total += line_total
        total_cgst += cgst
        total_sgst += sgst
        total_igst += igst
        total_discount += Decimal(str(detail_data.discount))
    
    # Update master totals
    purchase_master.sub_total = sub_total
    purchase_master.cgst = total_cgst
    purchase_master.sgst = total_sgst
    purchase_master.igst = total_igst
    purchase_master.discount = total_discount
    purchase_master.total_amount = sub_total + total_cgst + total_sgst + total_igst - total_discount
    
    # Logic for inventory update is handled in API layer to support LocationStock and Weighted Average Cost
    # calling simple update_item_stock here would miss LocationStock and cause double counting if API also runs.
    
    db.commit()
    db.refresh(purchase_master)
    return purchase_master


def get_all_purchases(db: Session, branch_id: int, skip: int = 0, limit: int = 100, status: Optional[str] = None):
    """Optimized with eager loading and case-insensitive status filtering"""
    query = db.query(PurchaseMaster).options(
        joinedload(PurchaseMaster.vendor),
        joinedload(PurchaseMaster.user),
        joinedload(PurchaseMaster.destination_location),
        selectinload(PurchaseMaster.details).joinedload(PurchaseDetail.item)
    )
    if branch_id is not None:
        query = query.filter(PurchaseMaster.branch_id == branch_id)
    if status:
        from sqlalchemy import func
        query = query.filter(func.lower(PurchaseMaster.status) == status.lower())
    return query.order_by(PurchaseMaster.created_at.desc()).offset(skip).limit(limit).all()


def get_purchase_by_id(db: Session, purchase_id: int, branch_id: Optional[int] = None):
    """Optimized with eager loading"""
    query = db.query(PurchaseMaster).options(
        joinedload(PurchaseMaster.vendor),
        joinedload(PurchaseMaster.user),
        joinedload(PurchaseMaster.destination_location),
        selectinload(PurchaseMaster.details).joinedload(PurchaseDetail.item)
    ).filter(PurchaseMaster.id == purchase_id)
    if branch_id is not None:
        query = query.filter(PurchaseMaster.branch_id == branch_id)
    return query.first()



def get_item_stocks(db: Session, item_id: int, branch_id: Optional[int] = None):
    """Fetch all location stocks for a specific item, optionally filtered by branch"""
    from app.models.inventory import LocationStock, Location
    
    query = db.query(LocationStock).join(Location).filter(
        LocationStock.item_id == item_id,
        LocationStock.quantity > 0
    )
    if branch_id is not None:
        query = query.filter(LocationStock.branch_id == branch_id)
    
    stocks = query.all()
    
    result = []
    for s in stocks:
        result.append({
            "location_id": s.location.id,
            "location_name": s.location.name,
            "location_type": s.location.location_type,
            "quantity": float(s.quantity)
        })
    return result


def update_location_stock(db: Session, location_id: int, item_id: int, quantity: float):
    """Helper to update stock at a specific location and synchronize global item stock"""
    from app.models.inventory import LocationStock, Location, InventoryItem
    from datetime import timezone, datetime
    
    # 1. Update Location-Specific Stock
    stock = db.query(LocationStock).filter(
        LocationStock.location_id == location_id,
        LocationStock.item_id == item_id
    ).first()
    
    if stock:
        stock.quantity += quantity
        stock.last_updated = datetime.now(timezone.utc)
    else:
        # Get branch_id from location
        loc = db.query(Location).filter(Location.id == location_id).first()
        branch_id = loc.branch_id if loc else 1
        
        stock = LocationStock(
            location_id=location_id,
            item_id=item_id,
            quantity=quantity,
            branch_id=branch_id,
            last_updated=datetime.now(timezone.utc)
        )
        db.add(stock)
    
    # 2. Synchronize Global Item Stock
    # In this system, InventoryItem.current_stock acts as a cache of total stock.
    # We update it to maintain consistency.
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if item:
        if item.current_stock is None: 
            item.current_stock = 0.0
        item.current_stock += quantity
        
    return stock



def update_purchase_master(db: Session, purchase_id: int, data: PurchaseMasterUpdate):
    purchase = get_purchase_by_id(db, purchase_id)
    if not purchase:
        return None
    
    # Only allow updates if status is not received or cancelled
    if purchase.status in ["received", "cancelled"] and data.status != "cancelled":
        # If trying to update other fields but not cancelling, restrict it
        # But if just updating payment status, method or date, allow it
        allowed_fields = ["payment_status", "payment_method", "payment_date", "payment_terms", "notes"]
        update_data = data.model_dump(exclude_unset=True)
        if any(field not in allowed_fields for field in update_data.keys()):
             return None # Or raise error in API
    
    for field, value in data.model_dump(exclude_unset=True, exclude={"details"}).items():
        setattr(purchase, field, value)
    
    # Handle details update if provided
    if data.details is not None:
        # Delete existing details
        db.query(PurchaseDetail).filter(PurchaseDetail.purchase_master_id == purchase.id).delete()
        
        # Reset totals
        sub_total = Decimal("0.00")
        total_cgst = Decimal("0.00")
        total_sgst = Decimal("0.00")
        total_igst = Decimal("0.00")
        total_discount = Decimal("0.00")
        
        # Check if interstate (based on current vendor)
        vendor = get_vendor_by_id(db, purchase.vendor_id)
        is_interstate = False
        # Logic to determine interstate (simplified)
        # In a real app, compare vendor state with company state
        
        for detail_data in data.details:
            item = get_item_by_id(db, detail_data.item_id)
            if not item:
                continue
            
            hsn_code = detail_data.hsn_code or item.hsn_code
            
            # Calculate line total before GST
            line_total = (Decimal(str(detail_data.quantity)) * Decimal(str(detail_data.unit_price))) - Decimal(str(detail_data.discount))
            
            # Calculate GST
            cgst, sgst, igst = calculate_gst(line_total, Decimal(str(detail_data.gst_rate)), is_interstate)
            line_total_with_gst = line_total + cgst + sgst + igst
            
            # Create purchase detail
            purchase_detail = PurchaseDetail(
                purchase_master_id=purchase.id,
                item_id=detail_data.item_id,
                hsn_code=hsn_code,
                quantity=detail_data.quantity,
                unit=detail_data.unit,
                unit_price=Decimal(str(detail_data.unit_price)),
                gst_rate=Decimal(str(detail_data.gst_rate)),
                cgst_amount=cgst,
                sgst_amount=sgst,
                igst_amount=igst,
                discount=Decimal(str(detail_data.discount)),
                total_amount=line_total_with_gst,
                notes=detail_data.notes
            )
            db.add(purchase_detail)
            
            # Accumulate totals
            sub_total += line_total
            total_cgst += cgst
            total_sgst += sgst
            total_igst += igst
            total_discount += Decimal(str(detail_data.discount))
        
        # Update master totals
        purchase.sub_total = sub_total
        purchase.cgst = total_cgst
        purchase.sgst = total_sgst
        purchase.igst = total_igst
        purchase.discount = total_discount
        purchase.total_amount = sub_total + total_cgst + total_sgst + total_igst - total_discount
    
    db.commit()
    db.refresh(purchase)
    return purchase


def update_purchase_status(db: Session, purchase_id: int, status: str, current_user_id: int = None):
    """
    Update purchase status and handle inventory if received.
    Now handles both receiving (stock in) and cancellation (stock out if previously received).
    """
    purchase = get_purchase_by_id(db, purchase_id)
    if not purchase:
        return None
    
    # Ensure we have the latest state from the DB before making decisions
    db.refresh(purchase)
    
    old_status = purchase.status.lower() if purchase.status else ""
    new_status = status.lower()
    
    # If no change, just return
    if old_status == new_status:
        return purchase

    from datetime import timezone, datetime
    from app.models.inventory import LocationStock, InventoryTransaction
        
    # CASE 1: Transition TO RECEIVED (Stock In)
    if old_status != "received" and new_status == "received":
        # Use a list to avoid iterator issues during commits
        details = list(purchase.details)
        for detail in details:
            # Update global stock and cost using WAC (WITHOUT commit in loop)
            update_item_cost_wac(db, detail.item_id, float(detail.quantity or 0), float(detail.unit_price or 0), commit=False)
            
            # Update destination location stock
            if purchase.destination_location_id:
                loc_stock = db.query(LocationStock).filter(
                    LocationStock.location_id == purchase.destination_location_id,
                    LocationStock.item_id == detail.item_id,
                    LocationStock.branch_id == purchase.branch_id
                ).first()
                
                qty = float(detail.quantity or 0)
                if loc_stock:
                    loc_stock.quantity += qty
                    loc_stock.last_updated = datetime.now(timezone.utc)
                else:
                    loc_stock = LocationStock(
                        location_id=purchase.destination_location_id,
                        item_id=detail.item_id,
                        quantity=qty,
                        last_updated=datetime.now(timezone.utc),
                        branch_id=purchase.branch_id
                    )
                    db.add(loc_stock)
            
            # Create transaction
            u_price = float(detail.unit_price or 0)
            transaction = InventoryTransaction(
                item_id=detail.item_id,
                transaction_type="in",
                quantity=float(detail.quantity or 0),
                unit_price=u_price,
                total_amount=u_price * float(detail.quantity or 0),
                reference_number=purchase.purchase_number,
                purchase_master_id=purchase.id,
                notes=f"Purchase received: {purchase.purchase_number}",
                created_by=current_user_id or purchase.created_by,
                destination_location_id=purchase.destination_location_id,
                branch_id=purchase.branch_id
            )

            db.add(transaction)

        # Trigger Journal Entry Creation
        try:
            from app.utils.accounting_helpers import create_purchase_journal_entry
            from app.api.gst_reports import RESORT_STATE_CODE
            from app.models.account import JournalEntry
            
            # Check if entry already exists
            existing_entry = db.query(JournalEntry).filter(
                JournalEntry.reference_type == "purchase",
                JournalEntry.reference_id == purchase.id
            ).first()
            
            if not existing_entry:
                vendor = get_vendor_by_id(db, purchase.vendor_id)
                vendor_name = (vendor.legal_name or vendor.name) if vendor else "Unknown"
                
                # Determine if inter-state
                is_interstate = False
                if vendor and vendor.gst_number and len(vendor.gst_number) >= 2:
                    is_interstate = vendor.gst_number[:2] != RESORT_STATE_CODE
                
                # Separate amounts into Assets and regular Inventory
                equipment_amount = 0.0
                furniture_amount = 0.0
                inventory_amount = 0.0
                from app.models.inventory import InventoryItem, InventoryCategory
                
                for detail in purchase.details:
                    item_subtotal = float(detail.quantity or 0) * float(detail.unit_price or 0)
                    
                    # Query item category to check if it's an asset
                    item_info = db.query(InventoryItem, InventoryCategory).join(
                        InventoryCategory, InventoryItem.category_id == InventoryCategory.id
                    ).filter(InventoryItem.id == detail.item_id).first()
                    
                    if item_info:
                        cat = item_info.InventoryCategory
                        if cat.is_asset_fixed or getattr(cat, 'is_capital_good', False):
                            if cat.name and 'furniture' in cat.name.lower():
                                furniture_amount += item_subtotal
                            else:
                                equipment_amount += item_subtotal
                        else:
                            inventory_amount += item_subtotal
                    else:
                        inventory_amount += item_subtotal
                        
                create_purchase_journal_entry(
                    db=db,
                    purchase_id=purchase.id,
                    vendor_id=purchase.vendor_id,
                    inventory_amount=inventory_amount,
                    cgst_amount=float(purchase.cgst or 0),
                    sgst_amount=float(purchase.sgst or 0),
                    igst_amount=float(purchase.igst or 0),
                    vendor_name=vendor_name,
                    is_interstate=is_interstate,
                    branch_id=purchase.branch_id,
                    created_by=current_user_id or purchase.created_by,
                    equipment_amount=equipment_amount,
                    furniture_amount=furniture_amount
                )

        except Exception as e:
            db.rollback()
            import traceback
            print(f"Warning: Could not create journal entry for purchase {purchase.id}: {str(e)}\n{traceback.format_exc()}")
            from fastapi import HTTPException
            raise HTTPException(status_code=500, detail=f"Failed to record journal entry for purchase: {str(e)}")

    # CASE 2: Transition FROM RECEIVED TO CANCELLED (Reverse Stock)
    elif old_status == "received" and new_status == "cancelled":
        details = list(purchase.details)
        for detail in details:
            # Reverse global WAC (using is_cancellation=True)
            update_item_cost_wac(
                db, 
                detail.item_id, 
                float(detail.quantity or 0), 
                float(detail.unit_price or 0),
                is_cancellation=True,
                commit=False
            )
            
            # Reverse location stock
            if purchase.destination_location_id:
                loc_stock = db.query(LocationStock).filter(
                    LocationStock.location_id == purchase.destination_location_id,
                    LocationStock.item_id == detail.item_id
                ).first()
                if loc_stock:
                    loc_stock.quantity -= float(detail.quantity or 0)
                    # If quantity hits 0, maybe keep it? Usually better to keep historical locations
            
            # Create reversal transaction
            u_price = float(detail.unit_price or 0)
            transaction = InventoryTransaction(
                item_id=detail.item_id,
                transaction_type="out", # Out because we are removing stock
                quantity=float(detail.quantity or 0),
                unit_price=u_price,
                total_amount=u_price * float(detail.quantity or 0),
                reference_number=purchase.purchase_number,
                purchase_master_id=purchase.id,
                notes=f"Purchase cancelled/reversed: {purchase.purchase_number}",
                created_by=current_user_id or purchase.created_by,
                source_location_id=purchase.destination_location_id,
                branch_id=purchase.branch_id
            )

            db.add(transaction)
    
    # Update status and save
    purchase.status = status
    db.commit()
    db.refresh(purchase)
    return purchase


# Stock Requisition CRUD
def generate_requisition_number(db: Session, branch_id: int):
    from datetime import timezone, datetime
    today = datetime.now(timezone.utc)
    date_str = today.strftime("%Y%m%d")
    start_count = db.query(StockRequisition).filter(
        StockRequisition.requisition_number.like(f"REQ-{date_str}-%")
    ).count() + 1
    
    # Safety Check Loop
    loop_count = 0
    while True:
        loop_count += 1
        candidate = f"REQ-{date_str}-{str(start_count).zfill(3)}"
        exists = db.query(StockRequisition).filter(StockRequisition.requisition_number == candidate).count()
        if exists == 0:
            return candidate
            
        start_count += 1
        if loop_count > 100:
             return candidate # Failsafe




def create_stock_requisition(db: Session, data: dict, branch_id: int, created_by: int):

    from app.models.inventory import StockRequisition, StockRequisitionDetail
    from datetime import timezone, datetime
    
    requisition_number = generate_requisition_number(db, branch_id)

    requisition = StockRequisition(
        requisition_number=requisition_number,
        requested_by=created_by,
        destination_department=data["destination_department"],
        date_needed=data.get("date_needed"),
        priority=data.get("priority", "normal"),
        status="pending",
        notes=data.get("notes"),
        branch_id=branch_id,
    )

    db.add(requisition)
    db.flush()
    
    for detail_data in data["details"]:
        detail = StockRequisitionDetail(
            requisition_id=requisition.id,
            item_id=detail_data["item_id"],
            requested_quantity=detail_data["requested_quantity"],
            approved_quantity=detail_data.get("approved_quantity"),
            unit=detail_data["unit"],
            notes=detail_data.get("notes"),
        )
        db.add(detail)
    
    db.commit()
    db.refresh(requisition)
    return requisition


def get_all_requisitions(db: Session, branch_id: int, skip: int = 0, limit: int = 100, status: Optional[str] = None):
    """Optimized with eager loading"""
    from app.models.inventory import StockRequisition
    query = db.query(StockRequisition).options(
        joinedload(StockRequisition.details).joinedload(StockRequisitionDetail.item)
    )
    if branch_id is not None:
        query = query.filter(StockRequisition.branch_id == branch_id)
    if status:
        query = query.filter(StockRequisition.status == status)
    return query.order_by(StockRequisition.created_at.desc()).offset(skip).limit(limit).all()


def get_requisition_by_id(db: Session, requisition_id: int):
    from app.models.inventory import StockRequisition
    return db.query(StockRequisition).filter(StockRequisition.id == requisition_id).first()


def update_requisition_status(db: Session, requisition_id: int, status: str, approved_by: Optional[int] = None):
    from app.models.inventory import StockRequisition
    from datetime import timezone, datetime
    
    requisition = get_requisition_by_id(db, requisition_id)
    if not requisition:
        return None
    
    requisition.status = status
    if status == "approved" and approved_by:
        requisition.approved_by = approved_by
        requisition.approved_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(requisition)
    return requisition


def generate_issue_number(db: Session, branch_id: int):
    from datetime import timezone, datetime
    from app.models.inventory import StockIssue
    
    today = datetime.now(timezone.utc)
    date_str = today.strftime("%Y%m%d")
    
    # Get the last issue number for today to continue sequence
    last_issue = db.query(StockIssue).filter(
        StockIssue.issue_number.like(f"ISS-{date_str}-%")
    ).order_by(StockIssue.issue_number.desc()).first()
    
    start_suffix = 1
    if last_issue:
        try:
            parts = last_issue.issue_number.split('-')
            # Assuming format ISS-YYYYMMDD-XXX
            if len(parts) >= 3:
                start_suffix = int(parts[-1]) + 1
        except:
             pass
             
    # Fallback to count if parsing failed or no previous
    if start_suffix == 1 and not last_issue:
         count = db.query(StockIssue).filter(
            StockIssue.issue_number.like(f"ISS-{date_str}-%")
         ).count()
         if count > 0:
            start_suffix = count + 1

    # Safety Check Loop to ensure uniqueness
    loop_count = 0
    while True:
        loop_count += 1
        candidate = f"ISS-{date_str}-{str(start_suffix).zfill(3)}"
        
        exists = db.query(StockIssue).filter(StockIssue.issue_number == candidate).count()
        if exists == 0:
            return candidate
            
        start_suffix += 1
        if loop_count > 1000:
             return candidate



def create_stock_issue(db: Session, data: dict, branch_id: int, issued_by: int):

    from app.models.inventory import StockIssue, StockIssueDetail, InventoryTransaction, InventoryItem, Location, LocationStock
    from datetime import timezone, datetime
    from sqlalchemy.exc import IntegrityError
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            issue_number = generate_issue_number(db, branch_id)

            
            # Parse issue_date if provided as string
            issue_date = data.get("issue_date")
            if issue_date and isinstance(issue_date, str):
                try:
                    issue_date = datetime.fromisoformat(issue_date.replace('Z', '+00:00'))
                except (ValueError, AttributeError):
                    issue_date = datetime.now(timezone.utc)
            elif not issue_date:
                issue_date = datetime.now(timezone.utc)
            
            issue = StockIssue(
                issue_number=issue_number,
                requisition_id=data.get("requisition_id"),
                issued_by=issued_by,
                source_location_id=data.get("source_location_id"),
                destination_location_id=data.get("destination_location_id"),
                issue_date=issue_date,
                notes=data.get("notes"),
                booking_id=data.get("booking_id"),
                guest_id=data.get("guest_id"),
                branch_id=branch_id
            )

            db.add(issue)
            db.flush()
            
            for detail_data in data["details"]:
                item = get_item_by_id(db, detail_data["item_id"])
                if not item:
                    continue
                
                # Check stock availability
                issued_qty = detail_data.get("issued_quantity", detail_data.get("quantity", 0))
                if issued_qty <= 0:
                    continue  # Skip zero or negative quantities
                
                # SMART SOURCE LOCATION DETECTION
                # If no source specified, find which non-guest-room location actually has this item
                source_loc_id = data.get("source_location_id")
                if not source_loc_id:
                    from app.models.inventory import LocationStock
                    # Find locations that have this item (excluding guest rooms)
                    available_locations = db.query(LocationStock).join(Location).filter(
                        LocationStock.item_id == detail_data["item_id"],
                        LocationStock.quantity >= issued_qty,
                        Location.location_type != "GUEST_ROOM",
                        Location.branch_id == branch_id
                    ).order_by(LocationStock.quantity.desc()).all()
                    
                    if available_locations:
                        # Use the location with most stock
                        source_loc_id = available_locations[0].location_id
                        source_loc_name = available_locations[0].location.name if available_locations[0].location else f"Location {source_loc_id}"
                        print(f"[AUTO-DETECT] Item {item.name}: Using {source_loc_name} (ID: {source_loc_id}) as source (has {available_locations[0].quantity} units)")
                        # Update the issue record's source if this is the first item
                        if not issue.source_location_id:
                            issue.source_location_id = source_loc_id
                    else:
                        # Fallback: try to find ANY warehouse/store
                        warehouse = db.query(Location).filter(
                            Location.location_type.in_(["WAREHOUSE", "CENTRAL_WAREHOUSE", "BRANCH_STORE", "DEPARTMENT", "LAUNDRY"]),
                            Location.branch_id == branch_id
                        ).first()
                        if warehouse:
                            source_loc_id = warehouse.id
                            if not issue.source_location_id:
                                issue.source_location_id = source_loc_id
                
                # Strict Stock Check
                # Check against Source Location Stock if specified (preferred for allocations)
                if source_loc_id:
                     from app.models.inventory import LocationStock
                     source_stock_record = db.query(LocationStock).filter(
                         LocationStock.location_id == source_loc_id,
                         LocationStock.item_id == detail_data["item_id"]
                     ).first()
                     
                     available_qty = source_stock_record.quantity if source_stock_record else 0.0
                     
                     if available_qty < issued_qty:
                         print(f"[WARNING] Insufficient stock at source location for {item.name}. Available: {available_qty}, Requested: {issued_qty}. Proceeding with negative stock.")
                else:
                     # Global stock check - warn but allow negative stock
                     if item.current_stock < issued_qty:
                         print(f"[WARNING] Insufficient Global Stock for {item.name}. Available: {item.current_stock}, Requested: {issued_qty}. Proceeding with negative stock.")
                
                # Calculate cost/price
                # Ensure float arithmetic
                # USE SELLING PRICE PREFERENCE for Guest Room issues (or generally if defined)
                price_to_use = item.unit_price # Default to cost
                if item.selling_price and item.selling_price > 0:
                     price_to_use = item.selling_price
                
                u_price = float(price_to_use or 0)
                i_qty = float(issued_qty or 0)
                cost = u_price * i_qty
                
                # Use is_payable from request if provided (frontend sends this), otherwise default to False
                is_payable = detail_data.get("is_payable", False)
                print(f"[DEBUG] Item {item.name}: is_payable from request = {is_payable}, detail_data = {detail_data}")
                
                # Create issue detail
                detail = StockIssueDetail(
                    issue_id=issue.id,
                    item_id=detail_data["item_id"],
                    issued_quantity=i_qty,
                    batch_lot_number=detail_data.get("batch_lot_number"),
                    unit=detail_data["unit"],
                    unit_price=u_price,
                    cost=cost,
                    notes=detail_data.get("notes"),
                    is_payable=is_payable,
                    rental_price=detail_data.get("rental_price"),
                )
                db.add(detail)
                
                # Get destination location for determining if this is a transfer or consumption
                # CRITICAL FIX: Check destination_location_id directly, not just the fetched object
                dest_location_id = data.get("destination_location_id")
                dest_location = None
                if dest_location_id:
                    dest_location = get_location_by_id(db, dest_location_id)
                
                # CRITICAL FIX: Only deduct global stock if this is actual consumption (no destination)
                # If there's a destination, it's a transfer - stock still exists, just moved locations
                if not dest_location_id:
                    # Actual consumption - deduct from global stock
                    print(f"[STOCK] Consumption: Deducting {issued_qty} of {item.name} from global stock")
                    item.current_stock -= issued_qty
                else:
                    # Transfer between locations - global stock unchanged (just location stocks change)
                    print(f"[STOCK] Transfer: Moving {issued_qty} of {item.name} between locations (global stock unchanged)")
                
                dest_location_name = ""
                if dest_location:
                    dest_location_name = f"{dest_location.building} - {dest_location.room_area}" if dest_location.building or dest_location.room_area else dest_location.name or f"Location {dest_location.id}"
                
                # Create transaction record with destination location info
                transaction_notes = f"Stock Issue: {issue_number}"
                if dest_location_name:
                    transaction_notes += f" → {dest_location_name}"
                if data.get('notes'):
                    transaction_notes += f" - {data.get('notes', '')}"
                
                # Determine transaction type based on whether this is a transfer or consumption
                # If there's a destination location, it's a transfer (stock still exists)
                # If no destination, it's actual consumption (stock is used up)
                out_transaction_type = "transfer_out" if dest_location else "out"
                
                # OUT transaction (from source/global inventory)
                transaction_out = InventoryTransaction(
                    item_id=detail_data["item_id"],
                    transaction_type=out_transaction_type,
                    quantity=i_qty,
                    unit_price=u_price,
                    total_amount=cost,
                    reference_number=issue_number,
                    notes=transaction_notes,
                    created_by=issued_by,
                    source_location_id=source_loc_id,
                    destination_location_id=dest_location_id,
                    branch_id=branch_id
                )
                db.add(transaction_out)
                
                # IN transaction (to destination location) - shows as "Stock Received" at destination
                if dest_location:
                    transaction_in = InventoryTransaction(
                        item_id=detail_data["item_id"],
                        transaction_type="transfer_in",
                        quantity=i_qty,
                        unit_price=u_price,
                        total_amount=cost,
                        reference_number=issue_number,
                        notes=f"Stock Received: {issue_number} from {data.get('source_location_id', 'Central')}",
                        created_by=issued_by,
                        department=dest_location_name,  # Track which location received it
                        source_location_id=source_loc_id,
                        destination_location_id=dest_location_id,
                        branch_id=branch_id
                    )
                    db.add(transaction_in)

                
                # Create Journal Entry for Consumption (COGS)
                # ONLY if this is actual consumption (no destination location)
                # If there's a destination, it's just a transfer - inventory still exists
                # We also check data.get("destination_location_id") to be safe in case object lookup failed
                if cost and cost > 0 and not dest_location and not data.get("destination_location_id"):
                    try:
                        from app.utils.accounting_helpers import create_consumption_journal_entry
                        create_consumption_journal_entry(
                            db=db,
                            consumption_id=issue.id,
                            cogs_amount=float(cost),
                            inventory_item_name=item.name,
                            branch_id=issue.branch_id,
                            created_by=issued_by
                        )

                    except Exception as e:
                        print(f"[WARNING] Could not create consumption journal entry: {e}")
                
                # Update requisition status if linked
                if data.get("requisition_id"):
                    update_requisition_status(db, data["requisition_id"], "issued")

                # Update Destination Location Stock
                # This ensures the item appears in the room's inventory list
                dest_loc_id = data.get("destination_location_id")
                if dest_loc_id:
                     from app.models.inventory import LocationStock
                     
                     loc_stock = db.query(LocationStock).filter(
                         LocationStock.location_id == dest_loc_id,
                         LocationStock.item_id == detail_data["item_id"]
                     ).first()
                     
                     if loc_stock:
                         loc_stock.quantity += i_qty
                         loc_stock.last_updated = datetime.now(timezone.utc)
                     else:
                         new_stock = LocationStock(
                             location_id=dest_loc_id,
                             item_id=detail_data["item_id"],
                             quantity=i_qty,
                             last_updated=datetime.now(timezone.utc),
                             branch_id=branch_id
                         )
                         db.add(new_stock)

                # Update Source Location Stock (Deduct)
                if source_loc_id:
                     from app.models.inventory import LocationStock
                     
                     source_stock = db.query(LocationStock).filter(
                         LocationStock.location_id == source_loc_id,
                         LocationStock.item_id == detail_data["item_id"]
                     ).first()
                     
                     if source_stock:
                         source_stock.quantity -= i_qty
                         # If negative, we allowed it via fallback, so just track it.
                     else:
                         # Use 0 and subtract
                         new_source_stock = LocationStock(
                             location_id=source_loc_id,
                             item_id=detail_data["item_id"],
                             quantity= -i_qty if i_qty > 0 else 0, # Initialize negative if we believe we owe it
                             last_updated=datetime.now(timezone.utc),
                             branch_id=branch_id
                         )
                         db.add(new_source_stock)
            
            db.commit()
            db.refresh(issue)
            return issue
            
        except IntegrityError as e:
            db.rollback()
            # Check for specific unique constraint on issue_number
            err_str = str(e).lower()
            if ("unique constraint" in err_str or "duplicate key" in err_str) and "issue_number" in err_str:
                if attempt < max_retries - 1:
                    print(f"[RETRY] Duplicate issue_number encountered. Retrying {attempt+1}/{max_retries}...")
                    continue
            raise e
        except Exception as e:
            db.rollback()
            raise e


def get_all_issues(db: Session, branch_id: Optional[int] = None, skip: int = 0, limit: int = 100):
    """Optimized with eager loading"""
    from app.models.inventory import StockIssue
    query = db.query(StockIssue).options(
        joinedload(StockIssue.source_location),
        joinedload(StockIssue.destination_location),
        selectinload(StockIssue.details).joinedload(StockIssueDetail.item)
    )
    if branch_id is not None:
        query = query.filter(StockIssue.branch_id == branch_id)
    return query.order_by(StockIssue.created_at.desc()).offset(skip).limit(limit).all()


def get_issue_by_id(db: Session, issue_id: int):
    from app.models.inventory import StockIssue
    return db.query(StockIssue).filter(StockIssue.id == issue_id).first()


# Waste Log CRUD
def generate_waste_log_number(db: Session, branch_id: int):
    from datetime import timezone, datetime
    from app.models.inventory import WasteLog
    today = datetime.now(timezone.utc)
    date_str = today.strftime("%Y%m%d")
    
    # Get the last log number for today
    last_log = db.query(WasteLog).filter(
        WasteLog.log_number.like(f"WASTE-{date_str}-%")
    ).order_by(WasteLog.log_number.desc()).first()
    
    start_suffix = 1
    if last_log:
        try:
            parts = last_log.log_number.split('-')
            start_suffix = int(parts[-1]) + 1
        except:
             count = db.query(WasteLog).filter(
                WasteLog.log_number.like(f"WASTE-{date_str}-%")
             ).count() + 1
             start_suffix = count
    
    # Safety Check Loop
    loop_count = 0
    while True:
        loop_count += 1
        candidate = f"WASTE-B{branch_id}-{date_str}-{str(start_suffix).zfill(3)}"
        
        exists = db.query(WasteLog).filter(WasteLog.log_number == candidate).count()
        if exists == 0:
            return candidate
            
        start_suffix += 1
        if loop_count > 1000:
             # Failsafe - should practically never happen if start_suffix is correct
             print(f"WARNING: generate_waste_log_number looped 1000 times. Returning risky candidate: {candidate}")
             return candidate


def create_waste_log(db: Session, data: dict, reported_by: int, branch_id: Optional[int] = 1):

    from app.models.inventory import WasteLog, InventoryTransaction, InventoryItem, Location
    from app.models.food_item import FoodItem
    from datetime import timezone, datetime
    
    # Derivation logic for Enterprise View (branch_id=None or 'all')
    loc_id = data.get("location_id")
    if not branch_id or branch_id == "all":
        if loc_id:
            loc = db.query(Location).filter(Location.id == loc_id).first()
            if loc:
                branch_id = loc.branch_id
        # Fallback to 2 (trails) if still not found, to ensure DB constraint is met
        if not branch_id or branch_id == "all":
            branch_id = 2

    is_food = data.get("is_food_item", False)
    
    if is_food:
        food_item_id = data.get("food_item_id")
        if not food_item_id:
            raise ValueError("Food item ID is required for food waste")
        
        food_item = db.query(FoodItem).filter(FoodItem.id == food_item_id).first()
        if not food_item:
            raise ValueError("Food item not found")
        
        log_number = generate_waste_log_number(db, branch_id)
        waste_log = WasteLog(
            log_number=log_number,
            food_item_id=food_item_id,
            is_food_item=True,
            location_id=data.get("location_id"),
            quantity=data["quantity"],
            unit=data["unit"],
            reason_code=data["reason_code"],
            action_taken=data.get("action_taken"),
            photo_path=data.get("photo_path"),
            notes=data.get("notes"),
            reported_by=reported_by,
            waste_date=data.get("waste_date", datetime.now(timezone.utc)),
            branch_id=branch_id
        )

        db.add(waste_log)
        
    else:
        item_id = data.get("item_id")
        if not item_id:
            raise ValueError("Item ID is required for inventory waste")
        
        item = get_item_by_id(db, item_id)
        if not item:
            raise ValueError("Item not found")
        
        if item.current_stock < data["quantity"]:
            print(f"[WARNING] Reporting waste for {item.name} with insufficient global stock. Available: {item.current_stock}, Requested: {data['quantity']}")
            # We allow it to proceed for assets/issued items
        
        log_number = generate_waste_log_number(db, branch_id)
        waste_log = WasteLog(
            log_number=log_number,
            item_id=item_id,
            is_food_item=False,
            location_id=data.get("location_id"),
            batch_number=data.get("batch_number"),
            expiry_date=data.get("expiry_date"),
            quantity=data["quantity"],
            unit=data["unit"],
            reason_code=data["reason_code"],
            action_taken=data.get("action_taken"),
            photo_path=data.get("photo_path"),
            notes=data.get("notes"),
            reported_by=reported_by,
            waste_date=data.get("waste_date", datetime.now(timezone.utc)),
            branch_id=branch_id
        )
        db.add(waste_log)
        
        item.current_stock -= data["quantity"]
        
        # Deduct from Location Stock if location is specified
        if data.get("location_id"):
            from app.models.inventory import LocationStock, AssetMapping, AssetRegistry
            
            # 1. Try Deducting from Location Stock
            loc_stock = db.query(LocationStock).filter(
                LocationStock.location_id == data["location_id"],
                LocationStock.item_id == item_id
            ).first()
            if loc_stock:
                loc_stock.quantity -= data["quantity"]
                loc_stock.last_updated = datetime.now(timezone.utc)
            
            # 2. Handle Asset Mappings (e.g. "light" in Room 101)
            # PERSISTENCE FIX: We don't deactivate the mapping, we just record the waste.
            # This ensures the item stays visible in the room list until checkout.
            mappings = db.query(AssetMapping).filter(
                AssetMapping.location_id == data["location_id"],
                AssetMapping.item_id == item_id,
                AssetMapping.is_active == True
            ).all()
            
            # We just update notes on mappings if needed, but don't deactivate
            for m in mappings:
                m.notes = (m.notes or "") + f" [Reported Damaged: {log_number}]"

            # 3. Update Asset Registry (Specific tagged assets)
            qty_to_mark = data["quantity"]
            registry_items = db.query(AssetRegistry).filter(
                AssetRegistry.current_location_id == data["location_id"],
                AssetRegistry.item_id == item_id,
                AssetRegistry.status == "active"
            ).limit(int(qty_to_mark)).all()
            
            for asset in registry_items:
                asset.status = "damaged" # Change from written_off to damaged
                asset.notes = (asset.notes or "") + f" [Waste Log: {log_number}]"
        
        transaction = InventoryTransaction(
            item_id=item_id,
            transaction_type="waste", # Explicitly use 'waste'
            quantity=data["quantity"],
            unit_price=item.unit_price,
            total_amount=float(item.unit_price or 0) * data["quantity"],
            reference_number=log_number,
            notes=f"WASTE: {data['reason_code']} - {data.get('notes', '')}", # Add prefix for visibility
            created_by=reported_by,
            source_location_id=data.get("location_id"),
            branch_id=branch_id
        )
        if transaction.total_amount and transaction.total_amount > 0:
            try:
                from app.utils.accounting_helpers import create_consumption_journal_entry
                create_consumption_journal_entry(
                    db=db,
                    consumption_id=waste_log.id,
                    cogs_amount=float(transaction.total_amount),
                    inventory_item_name=item.name,
                    branch_id=waste_log.branch_id,
                    created_by=reported_by,
                    reference_type="waste"
                )

            except Exception as e:
                print(f"Failed to create accounting entry for waste: {e}")
        
        db.add(transaction)
    
    db.commit()
    db.refresh(waste_log)
    return waste_log


def get_all_waste_logs(db: Session, skip: int = 0, limit: int = 100, branch_id: Optional[int] = None):
    from app.models.inventory import WasteLog
    query = db.query(WasteLog)
    if branch_id is not None:
        query = query.filter(WasteLog.branch_id == branch_id)
    return query.order_by(WasteLog.created_at.desc()).offset(skip).limit(limit).all()



def get_waste_log_by_id(db: Session, waste_log_id: int, branch_id: Optional[int] = None):
    from app.models.inventory import WasteLog
    query = db.query(WasteLog).filter(WasteLog.id == waste_log_id)
    if branch_id is not None:
        query = query.filter(WasteLog.branch_id == branch_id)
    return query.first()


# Location CRUD
def generate_location_code(db: Session, location_type: str, room_area: str):
    """Generate location code like LOC-RM-101"""
    prefix_map = {
        "MAIN_INVENTORY": "INV",
        "Main Inventory": "INV",
        "GUEST_ROOM": "RM",
        "Guest Room": "RM",
        "WAREHOUSE": "WH",
        "CENTRAL_WAREHOUSE": "WH",
        "BRANCH_STORE": "BS",
        "SUB_STORE": "SS",
        "DEPARTMENT": "DEPT",
        "PUBLIC_AREA": "PA",
        "Public Area": "PA",
        "LAUNDRY": "LNDRY",
        "Laundry": "LNDRY"
    }
    prefix = prefix_map.get(location_type, "LOC")
    
    # Extract numbers from room_area if available
    import re
    numbers = re.findall(r'\d+', room_area)
    
    if numbers:
        base_suffix = numbers[0]
        code = f"LOC-{prefix}-{base_suffix}"
        # Check existence within branch if possible, otherwise global code
        if not db.query(Location).filter(Location.location_code == code).first():
            return code
        # If exists with number, append 'A', 'B' etc? Or just fallback to count.
        # Let's fallback to incremental if specific number logic fails or is taken.
    
    # Generic incremental fallback
    count = db.query(Location).count() + 1
    while True:
        code = f"LOC-{prefix}-{count}"
        if not db.query(Location).filter(Location.location_code == code).first():
            return code
        count += 1


def create_location(db: Session, data: dict, branch_id: Optional[int] = 1):
    from app.models.inventory import Location
    # Auto-enable is_inventory_point for warehouse and main inventory locations if not specified
    loc_type = str(data.get("location_type", "")).upper()
    if loc_type in ["MAIN_INVENTORY", "WAREHOUSE", "CENTRAL_WAREHOUSE", "BRANCH_STORE"] and "is_inventory_point" not in data:
        data["is_inventory_point"] = True
    elif loc_type in ["MAIN_INVENTORY", "CENTRAL_WAREHOUSE"] and data.get("is_inventory_point") is None:
        data["is_inventory_point"] = True

    location_code = generate_location_code(db, data.get("location_type", ""), data.get("room_area", ""))
    location = Location(
        location_code=location_code,
        branch_id=branch_id,
        **data
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


def get_all_locations(db: Session, skip: int = 0, limit: int = 10000, branch_id: Optional[int] = None):  # Increased limit to show all rooms
    from app.models.inventory import Location
    from sqlalchemy.orm import joinedload
    # Skip auto-sync here - it's handled in the API endpoint to avoid transaction conflicts
    # Just return locations directly
    query = db.query(Location).options(joinedload(Location.branch)).filter(Location.is_active == True)
    if branch_id is not None:
        query = query.filter(Location.branch_id == branch_id)
    return query.offset(skip).limit(limit).all()



def get_location_by_id(db: Session, location_id: int):
    from app.models.inventory import Location
    return db.query(Location).filter(Location.id == location_id).first()


def update_location(db: Session, location_id: int, data: dict):
    from app.models.inventory import Location
    location = get_location_by_id(db, location_id)
    if not location:
        return None
    for key, value in data.items():
        setattr(location, key, value)
    db.commit()
    db.refresh(location)
    return location


# Asset Mapping CRUD
def create_asset_mapping(db: Session, data: dict, branch_id: int, assigned_by: Optional[int] = None):
    from app.models.inventory import AssetMapping, InventoryItem, LocationStock, Location
    from datetime import timezone, datetime
    
    # Derivation logic for Enterprise View (branch_id=None or 'all')
    dest_loc_id = data.get("location_id")
    if not branch_id or branch_id == "all":
        if dest_loc_id:
            loc = db.query(Location).filter(Location.id == dest_loc_id).first()
            if loc:
                branch_id = loc.branch_id
        # Fallback to 2 (trails) if still not found
        if not branch_id or branch_id == "all":
            branch_id = 2

    item_id = data["item_id"]
    quantity = data.get("quantity", 1.0)
    
    # 1. Get Item (No stock check - allow negative stock to track deficits)
    item = get_item_by_id(db, item_id)
    if not item:
        raise ValueError("Item not found")
    
    # Allow assignment even with insufficient stock - will create negative stock if needed
    # This helps track deficits and maintains transaction history
        
    # 2. Create Mapping
    mapping = AssetMapping(
        item_id=item_id,
        location_id=dest_loc_id,
        serial_number=data.get("serial_number"),
        notes=data.get("notes"),
        branch_id=branch_id,
        assigned_by=assigned_by,
        quantity=quantity
    )
    db.add(mapping)
    
    # 3. Deduct from Source Location Stock (e.g. Warehouse)
    # Do NOT deduct from item.current_stock (Global), as that represents Total Assets Owned.
    # Only deduct from the specific LocationStock where the item is physically moving from.
    
    # Assume source is Central Warehouse (ID 1) strictly for now as per current flow
    # Future improvement: Pass source_location_id in data
    # FIX: Find warehouse dynamically instead of hardcoding ID 1
    from app.models.inventory import LocationStock, InventoryTransaction, Location
    
    source_loc_id = data.get("source_location_id")
    
    if not source_loc_id:
        warehouse = db.query(Location).filter(
            Location.location_type.in_(["WAREHOUSE", "CENTRAL_WAREHOUSE"]),
            Location.branch_id == branch_id
        ).first()
        
        if not warehouse:
            warehouse = db.query(Location).filter(
                Location.location_type.ilike("%warehouse%")
            ).first()
        
        if not warehouse:
            raise ValueError("No warehouse location found. Please create a warehouse location first.")
        
        source_loc_id = warehouse.id
    

    source_stock = db.query(LocationStock).filter(
        LocationStock.location_id == source_loc_id,
        LocationStock.item_id == item_id
    ).first()
    
    if source_stock:
        source_stock.quantity -= quantity
        source_stock.last_updated = datetime.now(timezone.utc)
        print(f"[ASSET] Deducted {quantity} of {item.name} from {source_loc_id}. New stock: {source_stock.quantity}")
    else:
        # Create negative stock record if it doesn't exist
        print(f"[ASSET] No stock record at source {source_loc_id} for {item.name}. Creating negative entry.")
        new_source_stock = LocationStock(
            location_id=source_loc_id,
            item_id=item_id,
            quantity=-quantity,
            last_updated=datetime.now(timezone.utc),
            branch_id=branch_id
        )
        db.add(new_source_stock)
             
    # 3.2 Create Stock Issue (Transfer Record)
    # This ensures it shows up in history for both Source and Destination
    from app.models.inventory import StockIssue, StockIssueDetail
    
    # Generate Issue Number
    from app.curd.inventory import generate_issue_number
    issue_number = generate_issue_number(db, branch_id)
    
    # Fetch Dest Location Name
    dest_loc = db.query(Location).filter(Location.id == data["location_id"]).first()
    dest_name = dest_loc.name if dest_loc else "Unknown Location"

    stock_issue = StockIssue(
        issue_number=issue_number,
        issued_by=assigned_by,
        source_location_id=source_loc_id,
        destination_location_id=data["location_id"],
        issue_date=datetime.now(timezone.utc),
        notes=f"Auto-generated from Asset Assignment to {dest_name}",
        branch_id=branch_id
    )
    db.add(stock_issue)
    db.flush() # Get ID
    
    issue_detail = StockIssueDetail(
        issue_id=stock_issue.id,
        item_id=item_id,
        issued_quantity=quantity,
        unit=item.unit,
        unit_price=item.unit_price,
        cost=(item.unit_price or 0) * quantity,
        notes=f"Asset Mapping ID: {mapping.id}"
    )
    db.add(issue_detail)

    # 3.3 Create Transaction Record (Linked to Issue)
    transaction = InventoryTransaction(
        item_id=item_id,
        transaction_type="transfer_out", # snake_case matches frontend logic
        quantity=quantity,
        unit_price=item.unit_price,
        total_amount=item.unit_price * quantity if item.unit_price else 0,
        reference_number=issue_number, # Link to Stock Issue
        notes=f"Asset Assigned to {dest_name}",
        created_by=assigned_by,
        source_location_id=source_loc_id,
        destination_location_id=data["location_id"],
        branch_id=branch_id
    )
    db.add(transaction)
    
    # 3.4 Create Paired "Transfer In" Transaction (Stock Received at Dest)
    transaction_in = InventoryTransaction(
        item_id=item_id,
        transaction_type="transfer_in",
        quantity=quantity,
        unit_price=item.unit_price,
        total_amount=item.unit_price * quantity if item.unit_price else 0,
        reference_number=issue_number,
        department=dest_name, # Critical for frontend to show "To Location"
        notes=f"Asset Received from Central Warehouse",
        created_by=assigned_by,
        source_location_id=source_loc_id,
        destination_location_id=data["location_id"],
        branch_id=branch_id
    )
    db.add(transaction_in)
    
    # 4. Add to Destination Location Stock
    loc_stock = db.query(LocationStock).filter(
        LocationStock.location_id == data["location_id"],
        LocationStock.item_id == item_id
    ).first()
    
    if loc_stock:
        loc_stock.quantity += quantity
        loc_stock.last_updated = datetime.now(timezone.utc)
    else:
        new_stock = LocationStock(
            location_id=data["location_id"],
            item_id=item_id,
            quantity=quantity,
            last_updated=datetime.now(timezone.utc),
            branch_id=branch_id
        )
        db.add(new_stock)
    
    db.commit()
    db.refresh(mapping)
    return mapping


def get_all_asset_mappings(db: Session, skip: int = 0, limit: int = 100, location_id: Optional[int] = None, branch_id: Optional[int] = None):
    from app.models.inventory import AssetMapping
    query = db.query(AssetMapping).filter(AssetMapping.is_active == True)
    if branch_id is not None:
        query = query.filter(AssetMapping.branch_id == branch_id)

    if location_id:
        query = query.filter(AssetMapping.location_id == location_id)
    return query.order_by(AssetMapping.assigned_date.desc()).offset(skip).limit(limit).all()


def get_asset_mapping_by_id(db: Session, mapping_id: int):
    from app.models.inventory import AssetMapping
    # Return directly, assuming controller handles 404
    return db.query(AssetMapping).filter(AssetMapping.id == mapping_id).first()


def update_asset_mapping(db: Session, mapping_id: int, data: dict):
    from app.models.inventory import AssetMapping, Location, LocationStock
    from datetime import timezone, datetime
    mapping = get_asset_mapping_by_id(db, mapping_id)
    if not mapping:
        return None
    
    # Check if unassigning (is_active -> False)
    if "is_active" in data and data["is_active"] is False and mapping.is_active:
        # Transfer stock BACK to Warehouse (Location -> Warehouse)
        warehouse = db.query(Location).filter(
            Location.location_type.in_(["WAREHOUSE", "CENTRAL_WAREHOUSE"]),
            Location.branch_id == mapping.branch_id
        ).first()
        
        if warehouse:
            qty = mapping.quantity
            
            # 1. Deduct from Target Location
            target_stock = db.query(LocationStock).filter(
                LocationStock.location_id == mapping.location_id,
                LocationStock.item_id == mapping.item_id
            ).first()
            
            if target_stock:
                target_stock.quantity -= qty
                target_stock.last_updated = datetime.now(timezone.utc)
                
            # 2. Add back to Warehouse
            wh_stock = db.query(LocationStock).filter(
                LocationStock.location_id == warehouse.id,
                LocationStock.item_id == mapping.item_id
            ).first()
            
            if wh_stock:
                wh_stock.quantity += qty
                wh_stock.last_updated = datetime.now(timezone.utc)
            else:
                wh_stock = LocationStock(
                    location_id=warehouse.id,
                    item_id=mapping.item_id,
                    quantity=qty,
                    last_updated=datetime.now(timezone.utc)
                )
                db.add(wh_stock)

    # Update allowed fields
    for field in ["location_id", "serial_number", "quantity", "notes", "is_active"]:
        if field in data and data[field] is not None:
             setattr(mapping, field, data[field])
             
    db.commit()
    db.refresh(mapping)
    return mapping


def unassign_asset(db: Session, mapping_id: int, destination_location_id: int = None, unassigned_by: int = None):
    from app.models.inventory import AssetMapping, Location, LocationStock, InventoryTransaction, StockIssue, StockIssueDetail, InventoryItem
    from datetime import timezone, datetime
    
    # Handle Virtual Mapping vs Real Mapping
    is_virtual = False
    if mapping_id < 0:
        # Virtual unassignment using LocationStock ID
        stock_id = abs(mapping_id)
        stock = db.query(LocationStock).filter(LocationStock.id == stock_id).first()
        if not stock:
            return None
            
        # Calculate how many are already mapped to avoid unassigning mapped ones
        from sqlalchemy import func
        mapped_total = db.query(func.sum(func.coalesce(AssetMapping.quantity, 1))).filter(
            AssetMapping.location_id == stock.location_id,
            AssetMapping.item_id == stock.item_id,
            AssetMapping.is_active == True
        ).scalar() or 0
        
        remaining = max(0, stock.quantity - mapped_total)
        if remaining <= 0:
            return None

        # Create a synthetic mapping object
        from types import SimpleNamespace
        mapping = SimpleNamespace(
            id=mapping_id,
            item_id=stock.item_id,
            location_id=stock.location_id,
            quantity=remaining,
            branch_id=stock.branch_id,
            is_active=True,
            location=stock.location,
            unassigned_date=None
        )
        is_virtual = True
    else:
        mapping = get_asset_mapping_by_id(db, mapping_id)
        if not mapping:
            return None

    if mapping.is_active:
        if not is_virtual:
            mapping.is_active = False
            mapping.unassigned_date = datetime.now(timezone.utc)
        
        # Get Item details for transaction
        item = db.query(InventoryItem).filter(InventoryItem.id == mapping.item_id).first()
        
        # Return stock to Warehouse/Available
        # 1. Deduct from Location
        loc_stock = db.query(LocationStock).filter(
            LocationStock.location_id == mapping.location_id,
            LocationStock.item_id == mapping.item_id
        ).first()
        
        source_loc_id = mapping.location_id
        
        if loc_stock:
            loc_stock.quantity = max(0, loc_stock.quantity - mapping.quantity)
            loc_stock.last_updated = datetime.now(timezone.utc)
            
        # 2. Add back to Warehouse (Physical Location)
        # Find warehouse to return to
        warehouse = None
        if destination_location_id:
             warehouse = db.query(Location).filter(Location.id == destination_location_id).first()

        if not warehouse:
            # Fallback to default logic
            warehouse = db.query(Location).filter(
                Location.location_type.in_(["WAREHOUSE", "CENTRAL_WAREHOUSE"]),
                Location.branch_id == mapping.branch_id
            ).first()
        
        if not warehouse:
             warehouse = db.query(Location).filter(
                Location.location_type.ilike("%warehouse%")
            ).first()
            
        dest_loc_id = None
        dest_name = "Unknown Warehouse"
        
        if warehouse:
            dest_loc_id = warehouse.id
            dest_name = warehouse.name
            wh_stock = db.query(LocationStock).filter(
                LocationStock.location_id == warehouse.id,
                LocationStock.item_id == mapping.item_id
            ).first()
            
            if wh_stock:
                wh_stock.quantity += mapping.quantity
                wh_stock.last_updated = datetime.now(timezone.utc)
            else:
                wh_stock = LocationStock(
                    location_id=warehouse.id,
                    item_id=mapping.item_id,
                    quantity=mapping.quantity,
                    last_updated=datetime.now(timezone.utc),
                    branch_id=mapping.branch_id
                )
                db.add(wh_stock)
        else:
             print("Warning: No warehouse found to return unassigned asset stock to.")

        # 3. Create Traceability Records (Inventory Transaction History)
        if item and dest_loc_id:
            # Generate Issue Number
            from app.curd.inventory import generate_issue_number
            issue_number = generate_issue_number(db, mapping.branch_id)
            
            # 3.1 Create Stock Issue (Transfer Record)
            stock_issue = StockIssue(
                issue_number=issue_number,
                issued_by=unassigned_by,
                source_location_id=source_loc_id,
                destination_location_id=dest_loc_id,
                issue_date=datetime.now(timezone.utc),
                notes=f"Asset Unassigned from {mapping.location.name if mapping.location else 'Unknown'} to {dest_name}",
                branch_id=mapping.branch_id
            )
            db.add(stock_issue)
            db.flush()
            
            issue_detail = StockIssueDetail(
                issue_id=stock_issue.id,
                item_id=mapping.item_id,
                issued_quantity=mapping.quantity,
                unit=item.unit,
                unit_price=item.unit_price,
                cost=(item.unit_price or 0) * mapping.quantity,
                notes=f"Asset Unassignment - Mapping ID: {mapping.id}"
            )
            db.add(issue_detail)
            
            # 3.2 Create Transaction Records
            # Transfer out from original location (Room)
            transaction_out = InventoryTransaction(
                item_id=mapping.item_id,
                transaction_type="transfer_out",
                quantity=mapping.quantity,
                unit_price=item.unit_price,
                total_amount=(item.unit_price or 0) * mapping.quantity,
                reference_number=issue_number,
                notes=f"Unassigned moved transaction from {mapping.location.name if mapping.location else 'Room'}",
                created_by=unassigned_by,
                source_location_id=source_loc_id,
                destination_location_id=dest_loc_id,
                branch_id=mapping.branch_id
            )
            db.add(transaction_out)
            
            # Transfer in to warehouse
            transaction_in = InventoryTransaction(
                item_id=mapping.item_id,
                transaction_type="transfer_in",
                quantity=mapping.quantity,
                unit_price=item.unit_price,
                total_amount=(item.unit_price or 0) * mapping.quantity,
                reference_number=issue_number,
                notes=f"Unassigned moved transaction to {dest_name}",
                created_by=unassigned_by,
                source_location_id=source_loc_id,
                destination_location_id=dest_loc_id,
                branch_id=mapping.branch_id
            )
            db.add(transaction_in)

        # Note: Global stock (item.current_stock) should NOT change because the item 
        # is just moving from Room -> Warehouse. It is still owned.
        # But if the previous logic was incrementing global stock, it was wrong because 
        # unassigning doesn't mean "New Purchase", it means "Return to Shelf".
    db.commit()
    if not is_virtual:
        db.refresh(mapping)
    return mapping


# Asset Registry CRUD
def generate_asset_tag_id(db: Session, item_id: int):
    """Generate asset tag ID like AST-TV-014"""
    from app.models.inventory import AssetRegistry, InventoryItem
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    item_prefix = item.name[:2].upper() if item else "AST"
    count = db.query(AssetRegistry).filter(AssetRegistry.item_id == item_id).count() + 1
    return f"AST-{item_prefix}-{str(count).zfill(3)}"


def create_asset_registry(db: Session, data: dict, branch_id: int, created_by: int = None):
    from app.models.inventory import AssetRegistry, LocationStock, Location, InventoryTransaction, PurchaseMaster
    
    # 1. Determine Source Location (Automatic Detection)
    source_loc_id = None
    
    # Strategy A: Check Purchase Master
    if data.get("purchase_master_id"):
        purchase = db.query(PurchaseMaster).filter(PurchaseMaster.id == data["purchase_master_id"]).first()
        if purchase and purchase.destination_location_id:
            source_loc_id = purchase.destination_location_id
    
    # Strategy B: Check Item's default string location
    if not source_loc_id:
        item = get_item_by_id(db, data["item_id"])
        if item and item.location:
             # Try to map string to ID
             # This is a basic lookup. can be optimized with a pre-fetched map if needed
             loc = db.query(Location).filter(Location.name.ilike(item.location.strip())).first()
             if loc:
                 source_loc_id = loc.id
    
    # Strategy C: Default to Central Warehouse if nothing else found
    if not source_loc_id:
        # Find warehouse dynamically instead of hardcoding ID 1
        warehouse_query = db.query(Location).filter(
            Location.location_type.in_(["WAREHOUSE", "CENTRAL_WAREHOUSE"])
        )
        if branch_id is not None:
             warehouse_query = warehouse_query.filter(Location.branch_id == branch_id)
             
        warehouse = warehouse_query.first()
        
        if not warehouse:
            warehouse = db.query(Location).filter(
                Location.location_type.ilike("%warehouse%")
            ).first()
        
        if warehouse:
            source_loc_id = warehouse.id
            
    # 2. Deduct from Source Stock
    if source_loc_id:
        stock = db.query(LocationStock).filter(
            LocationStock.location_id == source_loc_id,
            LocationStock.item_id == data["item_id"]
        ).first()
        
        if stock:
            if stock.quantity >= 1:
                stock.quantity -= 1
            else:
                # Stock is 0 or negative. Still deduct? User wants "reduced from source".
                # Let's allow it to go negative or stay 0 based on policy. 
                # Usually better to decrement to track deficit.
                stock.quantity -= 1
        else:
            # Create negative stock entry if it doesn't exist? 
            # Or assume it wasn't tracked. Let's create it to be safe/explicit.
            new_stock = LocationStock(
                location_id=source_loc_id,
                item_id=data["item_id"],
                quantity=-1,
                branch_id=branch_id
            )
            db.add(new_stock)
            
    # 3. Create Asset
    asset_tag_id = generate_asset_tag_id(db, data["item_id"])
    asset = AssetRegistry(
        asset_tag_id=asset_tag_id,
        item_id=data["item_id"],
        serial_number=data.get("serial_number"),
        current_location_id=data["current_location_id"],
        status=data.get("status", "active"),
        purchase_date=data.get("purchase_date"),
        warranty_expiry_date=data.get("warranty_expiry_date"),
        last_maintenance_date=data.get("last_maintenance_date"),
        next_maintenance_due_date=data.get("next_maintenance_due_date"),
        purchase_master_id=data.get("purchase_master_id"),
        notes=data.get("notes"),
        branch_id=branch_id
    )
    db.add(asset)
    
    # 4. Create Transaction
    # Get names for notes
    source_name = "Unknown Source"
    if source_loc_id:
        src = db.query(Location).filter(Location.id == source_loc_id).first()
        if src: source_name = src.name
        
    dest_name = "Unknown Destination"
    if data.get("current_location_id"):
        dst = db.query(Location).filter(Location.id == data["current_location_id"]).first()
        if dst: dest_name = dst.name

    transaction = InventoryTransaction(
        item_id=data["item_id"],
        transaction_type="Transfer Out", # Matching frontend filter
        quantity=1,
        # unit_price=?, FIXME: Need item price
        reference_number=asset_tag_id,
        notes=f"Asset Assigned: {source_name} -> {dest_name}",
        created_by=created_by,
        source_location_id=source_loc_id,
        destination_location_id=data["current_location_id"],
        branch_id=branch_id
    )
    # Fetch item for price
    item_obj = get_item_by_id(db, data["item_id"])
    if item_obj:
        transaction.unit_price = item_obj.unit_price
        transaction.total_amount = item_obj.unit_price * 1
        
    db.add(transaction)

    db.commit()
    db.refresh(asset)
    return asset


def get_all_asset_registry(db: Session, branch_id: Optional[int] = None, skip: int = 0, limit: int = 100, location_id: Optional[int] = None, status: Optional[str] = None):
    from app.models.inventory import AssetRegistry
    query = db.query(AssetRegistry)
    if branch_id is not None:
        query = query.filter(AssetRegistry.branch_id == branch_id)
    if location_id:
        query = query.filter(AssetRegistry.current_location_id == location_id)
    if status:
        query = query.filter(AssetRegistry.status == status)
    return query.order_by(AssetRegistry.created_at.desc()).offset(skip).limit(limit).all()


def get_asset_registry_by_id(db: Session, asset_id: int, branch_id: Optional[int] = None):
    from app.models.inventory import AssetRegistry
    query = db.query(AssetRegistry).filter(AssetRegistry.id == asset_id)
    if branch_id is not None:
        query = query.filter(AssetRegistry.branch_id == branch_id)
    return query.first()


def update_asset_registry(db: Session, asset_id: int, data: dict):
    from app.models.inventory import AssetRegistry
    asset = get_asset_registry_by_id(db, asset_id)
    if not asset:
        return None
    for key, value in data.items():
        setattr(asset, key, value)
    db.commit()
    db.refresh(asset)
    return asset


def delete_asset_registry(db: Session, asset_id: int):
    from app.models.inventory import AssetRegistry
    asset = get_asset_registry_by_id(db, asset_id)
    if not asset:
        return None
    db.delete(asset)
    db.commit()
    return asset





def get_all_stock_requisitions(db: Session, skip: int = 0, limit: int = 100, status: Optional[str] = None, branch_id: Optional[int] = None):
    query = db.query(StockRequisition).options(
        joinedload(StockRequisition.details).joinedload(StockRequisitionDetail.item),
        joinedload(StockRequisition.requester)
    )
    if branch_id is not None:
        query = query.filter(StockRequisition.branch_id == branch_id)
    if status:
        query = query.filter(StockRequisition.status == status)
    return query.order_by(StockRequisition.created_at.desc()).offset(skip).limit(limit).all()


def get_stock_requisition_by_id(db: Session, requisition_id: int):
    return db.query(StockRequisition).options(
        joinedload(StockRequisition.details).joinedload(StockRequisitionDetail.item),
        joinedload(StockRequisition.requester)
    ).filter(StockRequisition.id == requisition_id).first()


def update_stock_requisition_status(db: Session, requisition_id: int, status: str, approved_by_id: Optional[int] = None):
    requisition = get_stock_requisition_by_id(db, requisition_id)
    if not requisition:
        return None
    
    requisition.status = status
    if status == "approved" and approved_by_id:
        requisition.approved_by = approved_by_id
        requisition.approved_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(requisition)
    return requisition


# Stock Issue CRUD

def get_all_stock_issues(db: Session, skip: int = 0, limit: int = 100, branch_id: Optional[int] = None):
    query = db.query(StockIssue).options(
        joinedload(StockIssue.details).joinedload(StockIssueDetail.item),
        joinedload(StockIssue.source_location),
        joinedload(StockIssue.destination_location),
        joinedload(StockIssue.issuer)
    )
    if branch_id is not None:
        query = query.filter(StockIssue.branch_id == branch_id)
    return query.order_by(StockIssue.created_at.desc()).offset(skip).limit(limit).all()



def process_food_order_usage(db: Session, order_id: int):
    """
    Deduct inventory stock based on food order items and their recipes.
    Should be called when order status changes to 'completed'.
    """
    from app.models.foodorder import FoodOrder
    from app.models.recipe import Recipe
    
    order = db.query(FoodOrder).filter(FoodOrder.id == order_id).first()
    if not order or not order.items:
        return
    
    # Group total ingredient usage across all items in the order
    ingredient_usage = {} # item_id -> quantity
    
    for order_item in order.items:
        # Find recipe for this food item
        recipe = db.query(Recipe).filter(Recipe.food_item_id == order_item.food_item_id).first()
        
        if recipe and recipe.ingredients:
            servings = recipe.servings or 1
            multiplier = order_item.quantity / servings
            
            for ingredient in recipe.ingredients:
                qty_needed = ingredient.quantity * multiplier
                
                if ingredient.inventory_item_id in ingredient_usage:
                    ingredient_usage[ingredient.inventory_item_id] += qty_needed
                else:
                    ingredient_usage[ingredient.inventory_item_id] = qty_needed
    
    # Find Kitchen/Consumption Location
    # Strategy:
    # 1. Look for a location named "Main Kitchen" or containing "Kitchen" (preferred).
    # 2. Look for a location matching the item's category parent_department (e.g. "Restaurant").
    
    from app.models.inventory import Location, LocationStock
    
    kitchen_query = db.query(Location).filter(
        Location.is_active == True
    )
    
    if order.branch_id:
        kitchen_query = kitchen_query.filter(Location.branch_id == order.branch_id)

    kitchen_loc = kitchen_query.filter(
        Location.name.ilike("%Main Kitchen%")
    ).first()
    
    if not kitchen_loc:
        # Fallback to any kitchen in this branch
        kitchen_loc = kitchen_query.filter(
            Location.name.ilike("%Kitchen%")
        ).first()

    # Deduct stock and create transactions
    for item_id, quantity in ingredient_usage.items():
        item = get_item_by_id(db, item_id)
        if not item:
            continue
            
        # 1. Deduct Global Stock (Total Assets Owned)
        current = item.current_stock or 0.0
        item.current_stock = current - quantity
        
        # 2. Deduct Location Stock (Physical consumption from Kitchen)
        if kitchen_loc:
             loc_stock = db.query(LocationStock).filter(
                 LocationStock.location_id == kitchen_loc.id,
                 LocationStock.item_id == item_id
             ).first()
             
             if loc_stock:
                 loc_stock.quantity -= quantity
                 loc_stock.last_updated = datetime.now(timezone.utc)
             else:
                 # Create negative stock to track deficit/usage if not transferred yet
                 new_stock = LocationStock(
                     location_id=kitchen_loc.id,
                     item_id=item_id,
                     quantity=-quantity,
                     last_updated=datetime.now(timezone.utc),
                     branch_id=order.branch_id
                 )
                 db.add(new_stock)

        # Create transaction
        transaction = InventoryTransaction(
            item_id=item_id,
            transaction_type="out", # Standard consumption
            quantity=quantity,
            unit_price=item.unit_price,
            total_amount=item.unit_price * quantity if item.unit_price else None,
            reference_number=f"ORD-{order_id}",
            department=item.category.parent_department if item.category else "Restaurant",
            notes=f"Food Order #{order_id} Consumption from {kitchen_loc.name if kitchen_loc else 'Global Stock'}",
            created_by=None,
            source_location_id=kitchen_loc.id if kitchen_loc else None,
            branch_id=order.branch_id
        )
        db.add(transaction)
        
        if transaction.total_amount and transaction.total_amount > 0:
            try:
                from app.utils.accounting_helpers import create_consumption_journal_entry
                create_consumption_journal_entry(
                    db=db,
                    consumption_id=order_id,
                    cogs_amount=float(transaction.total_amount),
                    inventory_item_name=item.name,
                    branch_id=order.branch_id,
                    created_by=None,
                    reference_type="food_order_consumption"
                )
            except Exception as e:
                print(f"[WARNING] Could not create COGS journal for food order: {e}")
    
    # db.commit() removed to allow atomic transaction in caller


def get_location_stock(db: Session, location_id: int):
    """Get all items available at a specific location"""
    from app.models.inventory import LocationStock, InventoryItem, Location
    
    # Get the location object to get its name
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        return []
    
    # Query LocationStock table (new system)
    stocks = db.query(LocationStock).options(
        joinedload(LocationStock.item).joinedload(InventoryItem.category)
    ).filter(
        LocationStock.location_id == location_id,
        LocationStock.quantity != 0 
    ).all()
    
    result = []
    item_ids_seen = set()
    
    # Add items from LocationStock table
    for s in stocks:
        if not s.item: continue
        item_ids_seen.add(s.item_id)
        result.append({
            "item_id": s.item_id,
            "item_name": s.item.name,
            "quantity": float(s.quantity),
            "unit": s.item.unit,
            "category_name": s.item.category.name if s.item.category else None,
            "min_stock_level": float(s.item.min_stock_level or 0),
            "is_low_stock": float(s.quantity) <= (s.item.min_stock_level or 0),
            "unit_price": float(s.item.unit_price or 0)
        })
    
    # FALLBACK: Also check InventoryItem.location field (legacy system)
    # This handles items that were created with location as a text field
    legacy_items = db.query(InventoryItem).options(
        joinedload(InventoryItem.category)
    ).filter(
        InventoryItem.location.ilike(f"%{location.name}%"),
        InventoryItem.current_stock > 0,
        InventoryItem.is_active == True
    ).all()
    
    for item in legacy_items:
        if item.id in item_ids_seen:
            continue  # Already added from LocationStock
        result.append({
            "item_id": item.id,
            "item_name": item.name,
            "quantity": float(item.current_stock or 0),
            "unit": item.unit,
            "category_name": item.category.name if item.category else None,
            "min_stock_level": float(item.min_stock_level or 0),
            "is_low_stock": float(item.current_stock or 0) <= (item.min_stock_level or 0),
            "unit_price": float(item.unit_price or 0)
        })
    
    return result


def get_all_recipes(db: Session, skip: int = 0, limit: int = 100, branch_id: Optional[int] = None):
    """Get all recipes"""
    from app.models.recipe import Recipe, RecipeIngredient
    query = db.query(Recipe).options(
        joinedload(Recipe.food_item),
        selectinload(Recipe.ingredients).joinedload(RecipeIngredient.inventory_item)
    )
    if branch_id is not None:
        query = query.filter(Recipe.branch_id == branch_id)
    return query.offset(skip).limit(limit).all()


# Inter-branch Transfer CRUD
def generate_transfer_number(db: Session, branch_id: int):
    # Branch specific numbering
    from app.models.inventory import InterBranchTransfer
    count = db.query(InterBranchTransfer).filter(InterBranchTransfer.source_branch_id == branch_id).count() + 1
    return f"TRF-{branch_id}-{datetime.now(timezone.utc).strftime('%y%m')}-{count:04d}"


def create_inter_branch_transfer(db: Session, data: dict, source_branch_id: int, created_by: int):
    from app.models.inventory import InterBranchTransfer
    
    transfer_number = generate_transfer_number(db, source_branch_id)
    transfer = InterBranchTransfer(
        **data,
        transfer_number=transfer_number,
        source_branch_id=source_branch_id,
        created_by=created_by,
        status="pending"
    )
    db.add(transfer)
    db.commit()
    db.refresh(transfer)
    return transfer


def get_all_inter_branch_transfers(db: Session, branch_id: Optional[int] = None, skip: int = 0, limit: int = 100):
    from app.models.inventory import InterBranchTransfer
    from sqlalchemy import or_
    query = db.query(InterBranchTransfer).options(
        joinedload(InterBranchTransfer.item),
        joinedload(InterBranchTransfer.source_branch),
        joinedload(InterBranchTransfer.destination_branch),
        joinedload(InterBranchTransfer.source_location),
        joinedload(InterBranchTransfer.destination_location)
    )
    
    if branch_id is not None:
        query = query.filter(or_(
            InterBranchTransfer.source_branch_id == branch_id,
            InterBranchTransfer.destination_branch_id == branch_id
        ))
        
    return query.order_by(InterBranchTransfer.created_at.desc()).offset(skip).limit(limit).all()


def get_transfer_by_id(db: Session, transfer_id: int):
    from app.models.inventory import InterBranchTransfer
    return db.query(InterBranchTransfer).filter(InterBranchTransfer.id == transfer_id).first()


def update_transfer_status(db: Session, transfer_id: int, status: str, location_id: int = None):
    from app.models.inventory import InterBranchTransfer, InventoryTransaction
    transfer = db.query(InterBranchTransfer).filter(InterBranchTransfer.id == transfer_id).first()
    if not transfer:
        return None
    
    old_status = transfer.status
    transfer.status = status
    
    # Fetch related objects for accurate transaction logging
    dest_branch_name = transfer.destination_branch.name if transfer.destination_branch else f"branch {transfer.destination_branch_id}"
    src_branch_name = transfer.source_branch.name if transfer.source_branch else f"branch {transfer.source_branch_id}"
    unit_price = transfer.item.unit_price if transfer.item and transfer.item.unit_price else 0.0
    total_val = unit_price * transfer.quantity

    if status == "in_transit" and old_status == "pending":
        # Deduct from source branch / location
        update_location_stock(db, transfer.source_location_id, transfer.item_id, -transfer.quantity)
        
        # Create transaction record for source branch
        trans = InventoryTransaction(
            item_id=transfer.item_id,
            transaction_type="out",
            quantity=transfer.quantity,
            unit_price=unit_price,
            total_amount=total_val,
            reference_number=transfer.transfer_number,
            notes=f"Inter-branch transfer to {dest_branch_name}",
            source_location_id=transfer.source_location_id,
            branch_id=transfer.source_branch_id
        )
        db.add(trans)
        
    elif status == "received" and old_status == "in_transit":
        if not location_id:
            raise ValueError("Destination location_id is required for receipt")
        
        transfer.destination_location_id = location_id
        # Add to destination branch / location
        update_location_stock(db, location_id, transfer.item_id, transfer.quantity)
        
        # Create transaction record for destination branch
        trans = InventoryTransaction(
            item_id=transfer.item_id,
            transaction_type="in",
            quantity=transfer.quantity,
            unit_price=unit_price,
            total_amount=total_val,
            reference_number=transfer.transfer_number,
            notes=f"Inter-branch transfer received from {src_branch_name}",
            destination_location_id=location_id,
            branch_id=transfer.destination_branch_id
        )
        db.add(trans)
        
    db.commit()
    db.refresh(transfer)
    return transfer
