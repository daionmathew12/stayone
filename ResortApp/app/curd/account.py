"""
CRUD operations for Accounting Module
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import List, Optional
from datetime import timezone, datetime
from app.models.account import AccountGroup, AccountLedger, JournalEntry, JournalEntryLine
from app.schemas.account import (
    AccountGroupCreate, AccountGroupUpdate,
    AccountLedgerCreate, AccountLedgerUpdate,
    JournalEntryCreate, JournalEntryUpdate
)


# Account Group CRUD
def create_account_group(db: Session, group: AccountGroupCreate, branch_id: int) -> AccountGroup:
    """Create a new account group"""
    db_group = AccountGroup(**group.model_dump(), branch_id=branch_id)

    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db_group


def get_account_group(db: Session, group_id: int, branch_id: int) -> Optional[AccountGroup]:
    """Get account group by ID"""
    query = db.query(AccountGroup).filter(AccountGroup.id == group_id)
    if branch_id is not None:
        from sqlalchemy import or_
        query = query.filter(or_(AccountGroup.branch_id == branch_id, AccountGroup.branch_id == None))
    return query.first()



def get_account_groups(db: Session, branch_id: Optional[int], skip: int = 0, limit: int = 100, account_type: Optional[str] = None) -> List[AccountGroup]:
    """Get all account groups - includes global (NULL branch_id) and branch-specific groups"""
    from sqlalchemy import or_
    query = db.query(AccountGroup)
    if branch_id is not None:
        # Show global groups (NULL branch_id) AND branch-specific groups
        query = query.filter(
            or_(AccountGroup.branch_id == branch_id, AccountGroup.branch_id == None)
        )

    if account_type:
        query = query.filter(AccountGroup.account_type == account_type)
    return query.filter(AccountGroup.is_active == True).offset(skip).limit(limit).all()


def update_account_group(db: Session, group_id: int, group_update: AccountGroupUpdate, branch_id: int) -> Optional[AccountGroup]:
    """Update account group"""
    db_group = db.query(AccountGroup).filter(AccountGroup.id == group_id, AccountGroup.branch_id == branch_id).first()

    if not db_group:
        return None
    
    update_data = group_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_group, field, value)
    
    db.commit()
    db.refresh(db_group)
    return db_group


def delete_account_group(db: Session, group_id: int, branch_id: int) -> bool:
    """Delete account group (soft delete)"""
    db_group = db.query(AccountGroup).filter(AccountGroup.id == group_id, AccountGroup.branch_id == branch_id).first()

    if not db_group:
        return False
    
    db_group.is_active = False
    db.commit()
    return True


# Account Ledger CRUD
def create_account_ledger(db: Session, ledger: AccountLedgerCreate, branch_id: int) -> AccountLedger:
    """Create a new account ledger"""
    db_ledger = AccountLedger(**ledger.model_dump(), branch_id=branch_id)

    db.add(db_ledger)
    db.commit()
    db.refresh(db_ledger)
    return db_ledger


def get_account_ledger(db: Session, ledger_id: int, branch_id: int) -> Optional[AccountLedger]:
    """Get account ledger by ID"""
    query = db.query(AccountLedger).filter(AccountLedger.id == ledger_id)
    if branch_id is not None:
        from sqlalchemy import or_
        query = query.filter(or_(AccountLedger.branch_id == branch_id, AccountLedger.branch_id == None))
    return query.first()



def get_account_ledgers(
    db: Session, 
    branch_id: int,
    skip: int = 0, 
    limit: int = 100, 
    group_id: Optional[int] = None,
    module: Optional[str] = None,
    is_active: Optional[bool] = True
) -> List[AccountLedger]:
    """Get all account ledgers with calculated current balance - includes global (NULL branch_id) ledgers"""
    from sqlalchemy import or_
    query = db.query(AccountLedger)
    if branch_id is not None:
        # Show global ledgers (NULL branch_id) AND branch-specific ledgers
        query = query.filter(
            or_(AccountLedger.branch_id == branch_id, AccountLedger.branch_id == None)
        )

    if group_id:
        query = query.filter(AccountLedger.group_id == group_id)
    if module:
        query = query.filter(AccountLedger.module == module)
    if is_active is not None:
        query = query.filter(AccountLedger.is_active == is_active)
    
    ledgers = query.offset(skip).limit(limit).all()
    
    # Efficiently calculate balances for all fetched ledgers
    if not ledgers:
        return []
        
    ledger_ids = [l.id for l in ledgers]
    
    # Fetch total debits per ledger
    debit_totals = db.query(
        JournalEntryLine.debit_ledger_id,
        func.sum(JournalEntryLine.amount)
    ).filter(
        JournalEntryLine.debit_ledger_id.in_(ledger_ids)
    ).group_by(JournalEntryLine.debit_ledger_id).all()
    
    debit_map = {l_id: amount for l_id, amount in debit_totals}
    
    # Fetch total credits per ledger
    credit_totals = db.query(
        JournalEntryLine.credit_ledger_id,
        func.sum(JournalEntryLine.amount)
    ).filter(
        JournalEntryLine.credit_ledger_id.in_(ledger_ids)
    ).group_by(JournalEntryLine.credit_ledger_id).all()
    
    credit_map = {l_id: amount for l_id, amount in credit_totals}
    
    # Calculate current balance for each ledger
    for ledger in ledgers:
        opening = ledger.opening_balance or 0.0
        debits = debit_map.get(ledger.id, 0.0)
        credits = credit_map.get(ledger.id, 0.0)
        
        if ledger.balance_type == "debit":
            ledger.current_balance = opening + debits - credits
        else:
            ledger.current_balance = opening - debits + credits
            
    return ledgers


def update_account_ledger(db: Session, ledger_id: int, ledger_update: AccountLedgerUpdate, branch_id: int) -> Optional[AccountLedger]:
    """Update account ledger"""
    query = db.query(AccountLedger).filter(AccountLedger.id == ledger_id)
    
    if branch_id is not None:
        from sqlalchemy import or_
        query = query.filter(or_(AccountLedger.branch_id == branch_id, AccountLedger.branch_id == None))
        
    db_ledger = query.first()

    if not db_ledger:
        return None
    
    update_data = ledger_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_ledger, field, value)
    
    db.commit()
    db.refresh(db_ledger)
    return db_ledger


def delete_account_ledger(db: Session, ledger_id: int, branch_id: int) -> bool:
    """Delete account ledger (soft delete)"""
    query = db.query(AccountLedger).filter(AccountLedger.id == ledger_id)
    
    if branch_id is not None:
        from sqlalchemy import or_
        query = query.filter(or_(AccountLedger.branch_id == branch_id, AccountLedger.branch_id == None))
        
    db_ledger = query.first()

    if not db_ledger:
        return False
    
    db_ledger.is_active = False
    db.commit()
    return True


# Journal Entry CRUD
def generate_entry_number(db: Session, branch_id: Optional[int] = None) -> str:
    """Generate globally unique journal entry number: JE-YYYY-MM-XXXX"""
    today = datetime.now(timezone.utc).date()
    year = today.year
    month = today.month
    prefix = f"JE-{year}-{str(month).zfill(2)}-"

    # Find the latest journal entry number for this month across all branches
    last_entry = db.query(JournalEntry).filter(
        JournalEntry.entry_number.like(f"{prefix}%")
    ).order_by(JournalEntry.entry_number.desc()).first()

    start_seq = 1
    if last_entry and last_entry.entry_number:
        try:
            parts = last_entry.entry_number.split("-")
            start_seq = int(parts[-1]) + 1
        except (ValueError, IndexError):
            start_seq = 1

    # Safety check loop: Guarantee absolute uniqueness across the entire table
    while True:
        entry_number = f"{prefix}{str(start_seq).zfill(4)}"
        exists = db.query(JournalEntry).filter(
            JournalEntry.entry_number == entry_number
        ).first()

        if not exists:
            return entry_number
        start_seq += 1


def create_journal_entry(db: Session, entry: JournalEntryCreate, branch_id: int, created_by: Optional[int] = None, commit: bool = True) -> JournalEntry:

    """Create a new journal entry with lines - includes balance validation"""
    # Validate balance: Total Debits must equal Total Credits
    total_debits = sum(line.amount for line in entry.lines if line.debit_ledger_id)
    total_credits = sum(line.amount for line in entry.lines if line.credit_ledger_id)
    
    # Check if entry is balanced (allow small rounding differences)
    if abs(total_debits - total_credits) > 0.01:
        raise ValueError(
            f"Journal entry must balance. Debits: Rs.{total_debits:.2f}, Credits: Rs.{total_credits:.2f}, "
            f"Difference: Rs.{abs(total_debits - total_credits):.2f}"
        )
    
    # Validate each line has either debit OR credit (not both, not neither)
    for idx, line in enumerate(entry.lines, 1):
        if not line.debit_ledger_id and not line.credit_ledger_id:
            raise ValueError(f"Line {idx}: Must have either debit or credit ledger (both are missing)")
        if line.debit_ledger_id and line.credit_ledger_id:
            raise ValueError(f"Line {idx}: Cannot have both debit and credit ledger")
        if line.amount <= 0:
            raise ValueError(f"Line {idx}: Amount must be greater than zero")
    
    # Generate entry number
    entry_number = generate_entry_number(db, branch_id=branch_id)

    
    # Calculate total amount (Sum of debits OR sum of credits, not both)
    total_amount = total_debits
    
    # Create journal entry
    db_entry = JournalEntry(
        entry_number=entry_number,
        entry_date=entry.entry_date,
        reference_type=entry.reference_type,
        reference_id=entry.reference_id,
        description=entry.description,
        total_amount=total_amount,
        created_by=created_by,
        notes=entry.notes,
        branch_id=branch_id
    )

    db.add(db_entry)
    db.flush()  # Get the entry ID
    
    # Create journal entry lines
    for idx, line_data in enumerate(entry.lines, start=1):
        db_line = JournalEntryLine(
            entry_id=db_entry.id,
            debit_ledger_id=line_data.debit_ledger_id,
            credit_ledger_id=line_data.credit_ledger_id,
            amount=line_data.amount,
            description=line_data.description,
            line_number=idx,
            branch_id=branch_id
        )

        db.add(db_line)
    
    if commit:
        db.commit()
        db.refresh(db_entry)
    else:
        db.flush()
        
    return db_entry

def update_journal_entry(db: Session, entry_id: int, entry_update: JournalEntryUpdate, branch_id: int, commit: bool = True) -> Optional[JournalEntry]:
    """Update a journal entry including its lines"""
    query = db.query(JournalEntry).filter(JournalEntry.id == entry_id)
    if branch_id is not None:
        from sqlalchemy import or_
        query = query.filter(or_(JournalEntry.branch_id == branch_id, JournalEntry.branch_id == None))
        
    db_entry = query.first()
    if not db_entry:
        return None

    # Update basic fields if provided
    if entry_update.entry_date is not None:
        db_entry.entry_date = entry_update.entry_date
    if entry_update.description is not None:
        db_entry.description = entry_update.description
    if entry_update.notes is not None:
        db_entry.notes = entry_update.notes

    # Update lines if provided
    if entry_update.lines is not None:
        total_debits = sum(line.amount for line in entry_update.lines if line.debit_ledger_id)
        total_credits = sum(line.amount for line in entry_update.lines if line.credit_ledger_id)
        
        if abs(total_debits - total_credits) > 0.01:
            raise ValueError(
                f"Journal entry must balance. Debits: Rs.{total_debits:.2f}, Credits: Rs.{total_credits:.2f}, "
                f"Difference: Rs.{abs(total_debits - total_credits):.2f}"
            )
            
        for idx, line in enumerate(entry_update.lines, 1):
            if not line.debit_ledger_id and not line.credit_ledger_id:
                raise ValueError(f"Line {idx}: Must have either debit or credit ledger (both are missing)")
            if line.debit_ledger_id and line.credit_ledger_id:
                raise ValueError(f"Line {idx}: Cannot have both debit and credit ledger")
            if line.amount <= 0:
                raise ValueError(f"Line {idx}: Amount must be greater than zero")

        db_entry.total_amount = total_debits

        # Delete existing lines
        db.query(JournalEntryLine).filter(JournalEntryLine.entry_id == entry_id).delete()
        
        # Add new lines
        for idx, line_data in enumerate(entry_update.lines, start=1):
            db_line = JournalEntryLine(
                entry_id=db_entry.id,
                debit_ledger_id=line_data.debit_ledger_id,
                credit_ledger_id=line_data.credit_ledger_id,
                amount=line_data.amount,
                description=line_data.description,
                line_number=idx,
                branch_id=db_entry.branch_id
            )
            db.add(db_line)

    if commit:
        db.commit()
        # Expire the lines relationship so it's re-fetched correctly
        db.expire(db_entry, ['lines'])
        db.refresh(db_entry)
    else:
        db.flush()
        
    return db_entry


def get_journal_entry(db: Session, entry_id: int, branch_id: int) -> Optional[JournalEntry]:
    """Get journal entry by ID"""
    query = db.query(JournalEntry).filter(JournalEntry.id == entry_id)
    if branch_id is not None:
        from sqlalchemy import or_
        query = query.filter(or_(JournalEntry.branch_id == branch_id, JournalEntry.branch_id == None))
    return query.first()



def get_journal_entries(
    db: Session,
    branch_id: int,
    skip: int = 0,
    limit: int = 100,
    reference_type: Optional[str] = None,
    reference_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> List[JournalEntry]:
    """Get journal entries with filters and line items"""
    from sqlalchemy.orm import joinedload
    query = db.query(JournalEntry).options(
        joinedload(JournalEntry.lines).joinedload(JournalEntryLine.debit_ledger),
        joinedload(JournalEntry.lines).joinedload(JournalEntryLine.credit_ledger)
    )
    if branch_id is not None:
        query = query.filter(JournalEntry.branch_id == branch_id)

    
    if reference_type:
        query = query.filter(JournalEntry.reference_type == reference_type)
    if reference_id:
        query = query.filter(JournalEntry.reference_id == reference_id)
    if start_date:
        query = query.filter(JournalEntry.entry_date >= start_date)
    if end_date:
        query = query.filter(JournalEntry.entry_date <= end_date)
    
    return query.order_by(JournalEntry.entry_date.desc()).offset(skip).limit(limit).all()


def get_ledger_balance(db: Session, ledger_id: int, branch_id: int, as_on_date: Optional[datetime] = None) -> dict:
    """Calculate ledger balance up to a specific date"""
    query = db.query(
        func.sum(JournalEntryLine.amount).label('debit_total')
    ).filter(
        JournalEntryLine.debit_ledger_id == ledger_id
    )
    if branch_id is not None:
        query = query.filter(JournalEntryLine.branch_id == branch_id)

    
    if as_on_date:
        query = query.join(JournalEntry).filter(JournalEntry.entry_date <= as_on_date)
    
    debit_result = query.scalar() or 0.0
    
    query = db.query(
        func.sum(JournalEntryLine.amount).label('credit_total')
    ).filter(
        JournalEntryLine.credit_ledger_id == ledger_id
    )
    if branch_id is not None:
        query = query.filter(JournalEntryLine.branch_id == branch_id)
    
    if as_on_date:
        query = query.join(JournalEntry).filter(JournalEntry.entry_date <= as_on_date)
        if branch_id is not None:
            query = query.filter(JournalEntry.branch_id == branch_id)

    
    credit_result = query.scalar() or 0.0
    
    # Get ledger details
    ledger_query = db.query(AccountLedger).filter(AccountLedger.id == ledger_id)
    if branch_id is not None:
        from sqlalchemy import or_
        ledger_query = ledger_query.filter(or_(AccountLedger.branch_id == branch_id, AccountLedger.branch_id == None))
    ledger = ledger_query.first()

    if not ledger:
        return {"debit_total": 0.0, "credit_total": 0.0, "balance": 0.0, "balance_type": "debit"}
    
    # Calculate balance based on ledger type
    opening_balance = ledger.opening_balance or 0.0
    
    if ledger.balance_type == "debit":
        balance = opening_balance + debit_result - credit_result
        closing_debit = balance if balance >= 0 else 0.0
        closing_credit = abs(balance) if balance < 0 else 0.0
    else:  # credit
        balance = opening_balance - debit_result + credit_result
        closing_credit = balance if balance >= 0 else 0.0
        closing_debit = abs(balance) if balance < 0 else 0.0
    
    return {
        "ledger_id": ledger_id,
        "ledger_name": ledger.name,
        "debit_total": debit_result,
        "credit_total": credit_result,
        "opening_balance": opening_balance,
        "balance": balance,
        "closing_debit": closing_debit,
        "closing_credit": closing_credit,
        "balance_type": ledger.balance_type,
        "group_name": ledger.group.name if ledger.group else "General Ledger"
    }


def get_ledger_details(db: Session, ledger_id: int, branch_id: int, as_on_date: Optional[datetime] = None) -> list:
    from app.models.account import JournalEntry, JournalEntryLine
    from sqlalchemy import or_
    
    query = db.query(JournalEntryLine).join(JournalEntry).filter(
        or_(
            JournalEntryLine.debit_ledger_id == ledger_id,
            JournalEntryLine.credit_ledger_id == ledger_id
        )
    )
    if branch_id is not None:
        query = query.filter(JournalEntryLine.branch_id == branch_id)
    if as_on_date:
        query = query.filter(JournalEntry.entry_date <= as_on_date)
        
    lines = query.all()
    details_map = {}
    
    for line in lines:
        je = line.entry
        is_debit = line.debit_ledger_id == ledger_id
        amt = float(line.amount if is_debit else -line.amount)
        detail_name = line.description or je.description or f"JE {je.entry_number}"
        
        if je.reference_type == 'purchase':
            from app.models.inventory import PurchaseMaster, InventoryItem
            pm = db.query(PurchaseMaster).get(je.reference_id)
            if pm:
                for pd in pm.details:
                    item = db.query(InventoryItem).get(pd.item_id)
                    name = item.name if item else "Unknown Item"
                    if name not in details_map:
                        details_map[name] = 0.0
                    details_map[name] += float(pd.total_amount if is_debit else -pd.total_amount)
                continue
                
        if detail_name not in details_map:
            details_map[detail_name] = 0.0
        details_map[detail_name] += amt

    # Convert to list
    details_list = []
    for name, amt in details_map.items():
        if abs(amt) > 0.001:
            details_list.append({
                "item_name": name,
                "amount": abs(amt),
                "type": "debit" if amt > 0 else "credit"
            })
    
    return details_list

def get_trial_balance(db: Session, branch_id: int, as_on_date: Optional[datetime] = None, automatic: bool = False, detailed: bool = False) -> dict:
    """
    Generate trial balance for all active ledgers in a branch.
    
    If automatic=True, calculates from all business transactions (checkouts, food orders, 
    services, expenses, purchases, consumption) in addition to journal entries.
    """
    if automatic:
        return get_automatic_trial_balance(db, branch_id=branch_id, as_on_date=as_on_date)
    
    # Original logic: only from journal entries
    query = db.query(AccountLedger).filter(AccountLedger.is_active == True)
    if branch_id is not None:
        from sqlalchemy import or_
        query = query.filter(or_(AccountLedger.branch_id == branch_id, AccountLedger.branch_id == None))
    ledgers = query.all()

    ledger_balances = []
    total_debits = 0.0
    total_credits = 0.0
    
    for ledger in ledgers:
        balance_data = get_ledger_balance(db, ledger.id, branch_id=branch_id, as_on_date=as_on_date)
        
        if detailed and abs(balance_data["balance"]) > 0.001:
            balance_data["details"] = get_ledger_details(db, ledger.id, branch_id=branch_id, as_on_date=as_on_date)

        ledger_balances.append(balance_data)
        
        # Correct logic: Check ledger type
        balance = balance_data["balance"]
        balance_type = balance_data["balance_type"]
        
        if balance_type == "debit":
            if balance >= 0:
                total_debits += balance
            else:
                total_credits += abs(balance)
        else:  # credit type
            if balance >= 0:
                total_credits += balance
            else:
                total_debits += abs(balance)
    
    # Group ledgers
    groups_dict = {}
    for lb in ledger_balances:
        g_name = lb.get("group_name", "General Ledger")
        if g_name not in groups_dict:
            groups_dict[g_name] = {
                "group_name": g_name,
                "ledgers": [],
                "closing_debit": 0.0,
                "closing_credit": 0.0
            }
        groups_dict[g_name]["ledgers"].append(lb)
        groups_dict[g_name]["closing_debit"] += lb.get("closing_debit", 0.0)
        groups_dict[g_name]["closing_credit"] += lb.get("closing_credit", 0.0)
        
    return {
        "ledgers": ledger_balances,
        "groups": list(groups_dict.values()),
        "total_debits": total_debits,
        "total_credits": total_credits,
        "is_balanced": abs(total_debits - total_credits) < 0.01  # Allow small rounding differences
    }


def get_automatic_trial_balance(db: Session, branch_id: int, as_on_date: Optional[datetime] = None) -> dict:
    """
    Automatically calculate trial balance from all business transactions for a branch:

    - Checkouts (revenue)
    - Food Orders (revenue)
    - Services (revenue)
    - Expenses (expenses)
    - Inventory Purchases (expenses/assets)
    - Inventory Consumption (COGS)
    - Journal Entries (manual entries)
    """
    try:
        from app.models.checkout import Checkout
        from app.models.foodorder import FoodOrder
        from app.models.service import AssignedService
        from app.models.expense import Expense
        from app.models.inventory import PurchaseMaster, InventoryTransaction
        from sqlalchemy import func, and_, case
        
        # Dictionary to store ledger balances
        ledger_balances_dict = {}
        
        # 1. Revenue from Checkouts
        try:
            checkout_date_filter = []
            if branch_id is not None:
                checkout_date_filter.append(Checkout.branch_id == branch_id)
            if as_on_date:
                checkout_date_filter.append(Checkout.checkout_date <= as_on_date)

            
            checkout_query = db.query(
                func.coalesce(func.sum(Checkout.room_total), 0).label("room_revenue"),
                func.coalesce(func.sum(Checkout.food_total), 0).label("food_revenue"),
                func.coalesce(func.sum(Checkout.service_total), 0).label("service_revenue"),
                func.coalesce(func.sum(Checkout.package_total), 0).label("package_revenue"),
                func.coalesce(func.sum(Checkout.grand_total), 0).label("total_revenue"),
            )
            if checkout_date_filter:
                checkout_query = checkout_query.filter(and_(*checkout_date_filter))
            
            checkout_result = checkout_query.first()
            if checkout_result:
                total_revenue = float(checkout_result.total_revenue or 0)
                if total_revenue > 0:
                    # Add to "Revenue from Operations" ledger (virtual)
                    if "Revenue from Operations" not in ledger_balances_dict:
                        ledger_balances_dict["Revenue from Operations"] = {
                            "ledger_id": None,
                            "ledger_name": "Revenue from Operations",
                            "debit_total": 0.0,
                            "credit_total": 0.0,
                            "opening_balance": 0.0,
                            "balance": 0.0,
                            "balance_type": "credit"
                        }
                    ledger_balances_dict["Revenue from Operations"]["credit_total"] += total_revenue
                    ledger_balances_dict["Revenue from Operations"]["balance"] -= total_revenue  # Credit balance is negative
        except Exception as e:
            print(f"Error calculating checkout revenue: {str(e)}")
        
        # 2. Revenue from Food Orders (billed and paid)
        try:
            food_date_filter = []
            if branch_id is not None:
                food_date_filter.append(FoodOrder.branch_id == branch_id)
            if as_on_date:
                food_date_filter.append(FoodOrder.created_at <= as_on_date)

            
            food_query = db.query(
                func.coalesce(func.sum(case(
                    (and_(
                        FoodOrder.amount > 0,
                        FoodOrder.billing_status.in_(["billed", "paid"])
                    ), FoodOrder.amount), 
                    else_=0
                )), 0).label("billed_revenue"),
            )
            if food_date_filter:
                food_query = food_query.filter(and_(*food_date_filter))
            
            food_result = food_query.first()
            if food_result:
                food_revenue = float(food_result.billed_revenue or 0)
                if food_revenue > 0:
                    if "Food & Beverage Revenue" not in ledger_balances_dict:
                        ledger_balances_dict["Food & Beverage Revenue"] = {
                            "ledger_id": None,
                            "ledger_name": "Food & Beverage Revenue",
                            "debit_total": 0.0,
                            "credit_total": 0.0,
                            "opening_balance": 0.0,
                            "balance": 0.0,
                            "balance_type": "credit"
                        }
                    ledger_balances_dict["Food & Beverage Revenue"]["credit_total"] += food_revenue
                    ledger_balances_dict["Food & Beverage Revenue"]["balance"] -= food_revenue
        except Exception as e:
            print(f"Error calculating food revenue: {str(e)}")
        
        # 3. Expenses
        try:
            expense_date_filter = []
            if branch_id is not None:
                expense_date_filter.append(Expense.branch_id == branch_id)
            if as_on_date:
                expense_date = as_on_date.date() if hasattr(as_on_date, 'date') else as_on_date

                expense_date_filter.append(Expense.date <= expense_date)
            
            expense_query = db.query(
                func.coalesce(func.sum(Expense.amount), 0).label("total_expenses"),
            )
            if expense_date_filter:
                expense_query = expense_query.filter(and_(*expense_date_filter))
            
            expense_result = expense_query.first()
            if expense_result:
                total_expenses = float(expense_result.total_expenses or 0)
                if total_expenses > 0:
                    if "Operating Expenses" not in ledger_balances_dict:
                        ledger_balances_dict["Operating Expenses"] = {
                            "ledger_id": None,
                            "ledger_name": "Operating Expenses",
                            "debit_total": 0.0,
                            "credit_total": 0.0,
                            "opening_balance": 0.0,
                            "balance": 0.0,
                            "balance_type": "debit"
                        }
                    ledger_balances_dict["Operating Expenses"]["debit_total"] += total_expenses
                    ledger_balances_dict["Operating Expenses"]["balance"] += total_expenses
        except Exception as e:
            print(f"Error calculating expenses: {str(e)}")
        
        # 4. Inventory Purchases
        try:
            purchase_date_filter = []
            if branch_id is not None:
                purchase_date_filter.append(PurchaseMaster.branch_id == branch_id)
            if as_on_date:
                purchase_date = as_on_date.date() if hasattr(as_on_date, 'date') else as_on_date

                purchase_date_filter.append(PurchaseMaster.purchase_date <= purchase_date)
            
            purchase_query = db.query(
                func.coalesce(func.sum(PurchaseMaster.total_amount), 0).label("total_purchases"),
            )
            if purchase_date_filter:
                purchase_query = purchase_query.filter(and_(*purchase_date_filter))
            
            purchase_result = purchase_query.first()
            if purchase_result:
                total_purchases = float(purchase_result.total_purchases or 0)
                if total_purchases > 0:
                    if "Inventory Purchases" not in ledger_balances_dict:
                        ledger_balances_dict["Inventory Purchases"] = {
                            "ledger_id": None,
                            "ledger_name": "Inventory Purchases",
                            "debit_total": 0.0,
                            "credit_total": 0.0,
                            "opening_balance": 0.0,
                            "balance": 0.0,
                            "balance_type": "debit"
                        }
                    ledger_balances_dict["Inventory Purchases"]["debit_total"] += total_purchases
                    ledger_balances_dict["Inventory Purchases"]["balance"] += total_purchases
        except Exception as e:
            print(f"Error calculating purchases: {str(e)}")
        
        # 5. Inventory Consumption (COGS)
        try:
            consumption_date_filter = []
            if branch_id is not None:
                consumption_date_filter.append(InventoryTransaction.branch_id == branch_id)
            if as_on_date:
                consumption_date_filter.append(InventoryTransaction.created_at <= as_on_date)
            
            consumption_query = db.query(
                func.coalesce(func.sum(InventoryTransaction.total_amount), 0).label("total_cogs"),
            ).filter(InventoryTransaction.transaction_type == "out")

            if consumption_date_filter:
                consumption_query = consumption_query.filter(and_(*consumption_date_filter))
            
            consumption_result = consumption_query.first()
            if consumption_result:
                total_cogs = float(consumption_result.total_cogs or 0)
                if total_cogs > 0:
                    if "Cost of Goods Sold" not in ledger_balances_dict:
                        ledger_balances_dict["Cost of Goods Sold"] = {
                            "ledger_id": None,
                            "ledger_name": "Cost of Goods Sold",
                            "debit_total": 0.0,
                            "credit_total": 0.0,
                            "opening_balance": 0.0,
                            "balance": 0.0,
                            "balance_type": "debit"
                        }
                    ledger_balances_dict["Cost of Goods Sold"]["debit_total"] += total_cogs
                    ledger_balances_dict["Cost of Goods Sold"]["balance"] += total_cogs
        except Exception as e:
            print(f"Error calculating COGS: {str(e)}")
        
        # 6. Skip journal entries in automatic mode to avoid timeouts
        # Journal entries can be viewed separately in the "Journal Entries" tab
        # Automatic trial balance focuses on business transactions only
        print("Automatic trial balance: Skipping journal entries to improve performance")
        
        # Convert to list and calculate totals
        ledger_balances = list(ledger_balances_dict.values())
        total_debits = 0.0
        total_credits = 0.0
        
        for ledger_balance in ledger_balances:
            bal = ledger_balance["balance"]
            b_type = ledger_balance.get("balance_type", "debit")
            if b_type == "debit":
                ledger_balance["closing_debit"] = bal if bal >= 0 else 0.0
                ledger_balance["closing_credit"] = abs(bal) if bal < 0 else 0.0
            else:
                ledger_balance["closing_credit"] = bal if bal >= 0 else 0.0
                ledger_balance["closing_debit"] = abs(bal) if bal < 0 else 0.0
                
            total_debits += ledger_balance["debit_total"]
            total_credits += ledger_balance["credit_total"]
        
        # Group ledgers
        groups_dict = {}
        for lb in ledger_balances:
            g_name = lb.get("group_name", "General Ledger")
            if g_name not in groups_dict:
                groups_dict[g_name] = {
                    "group_name": g_name,
                    "ledgers": [],
                    "closing_debit": 0.0,
                    "closing_credit": 0.0
                }
            groups_dict[g_name]["ledgers"].append(lb)
            groups_dict[g_name]["closing_debit"] += lb.get("closing_debit", 0.0)
            groups_dict[g_name]["closing_credit"] += lb.get("closing_credit", 0.0)
            
        return {
            "ledgers": ledger_balances,
            "groups": list(groups_dict.values()),
            "total_debits": total_debits,
            "total_credits": total_credits,
            "is_balanced": abs(total_debits - total_credits) < 0.01  # Allow small rounding differences
        }
    except Exception as e:
        import traceback
        error_msg = f"Error in get_automatic_trial_balance: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        # Return empty trial balance on error
        return {
            "ledgers": [],
            "groups": [],
            "total_debits": 0.0,
            "total_credits": 0.0,
            "is_balanced": True
        }


