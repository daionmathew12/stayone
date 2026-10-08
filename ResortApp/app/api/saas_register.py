from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import re
import json
import os
import shutil
import uuid

from app.database import SessionLocal
from app.utils.auth import get_db, get_password_hash, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from app.models.tenant import Tenant, SaaSPlan
from app.models.branch import Branch
from app.models.user import User, Role
from app.models.room import Room
from app.utils.tenant_context import get_current_tenant

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter(prefix="/saas", tags=["SaaS Registration & Subscriptions"])

RESERVED_SLUGS = {
    "admin", "administrator", "api", "app", "auth", "dashboard", "help", 
    "login", "mail", "payment", "register", "root", "saas", "stayone", 
    "support", "sysadmin", "system", "user", "userend", "www"
}

# --- Pydantic Schemas ---

class CheckSlugResponse(BaseModel):
    slug: str
    available: bool
    reason: Optional[str] = None

class SaaSPlanResponse(BaseModel):
    id: int
    name: str
    code: str
    price_monthly: float
    price_yearly: float
    max_branches: int
    max_rooms: int
    max_staff_users: int
    description: Optional[str] = None
    badge: Optional[str] = None
    is_active: Optional[bool] = True
    features: List[str]

class SaaSUserRegisterRequest(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=100)
    slug: str = Field(..., min_length=3, max_length=50)
    owner_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    phone: Optional[str] = None
    country: Optional[str] = "IN"
    currency: Optional[str] = "INR"
    plan_code: Optional[str] = "starter"
    branch_code: str = Field(..., min_length=1, max_length=50, description="Compulsory Aiosell Hotel Code")
    location: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    facebook: Optional[str] = None
    instagram: Optional[str] = None
    twitter: Optional[str] = None
    linkedin: Optional[str] = None
    image_url: Optional[str] = None

class SaaSRegisterResponse(BaseModel):
    success: bool
    message: str
    access_token: Optional[str] = None
    token_type: str = "bearer"
    tenant: Dict[str, Any]
    branch: Dict[str, Any]

# Default Admin Permissions granting full dashboard access
DEFAULT_OWNER_PERMISSIONS = [
    "/dashboard", "dashboard:view", "dashboard",
    "/rooms", "/bookings", "/checkouts", "/day-audit",
    "/food-orders", "/food-items", "/food-categories",
    "/services", "/service-requests",
    "/inventory", "/inventory-items", "/vendors", "/purchases", "/stock-requisitions", "/waste-logs",
    "/expenses", "/accounts", "/ledger", "/journal", "/day-book",
    "/employees", "/attendance", "/leaves", "/salaries",
    "/reports", "/gst-reports",
    "/branches", "/users", "/roles", "/settings", "/channel-manager"
]

# --- Endpoints ---

@router.get("/check-slug", response_model=CheckSlugResponse)
def check_slug(slug: str, db: Session = Depends(get_db)):
    """Check whether a business slug is valid and available"""
    clean_slug = slug.strip().lower()
    
    if not re.match(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", clean_slug):
        return CheckSlugResponse(
            slug=clean_slug,
            available=False,
            reason="Slug can only contain lowercase letters, numbers, and hyphens"
        )
        
    if clean_slug in RESERVED_SLUGS:
        return CheckSlugResponse(
            slug=clean_slug,
            available=False,
            reason="This slug is reserved by the platform"
        )
        
    existing = db.query(Tenant).filter(Tenant.slug == clean_slug).first()
    if existing:
        return CheckSlugResponse(
            slug=clean_slug,
            available=False,
            reason="This URL is already taken by another resort business"
        )
        
    return CheckSlugResponse(slug=clean_slug, available=True)


@router.get("/plans", response_model=List[SaaSPlanResponse])
def list_plans(db: Session = Depends(get_db)):
    code_order = {"starter": 1, "growth": 2, "enterprise": 3, "trial": 4}
    plans = db.query(SaaSPlan).filter(SaaSPlan.is_active == True).all()
    plans = sorted(plans, key=lambda p: code_order.get(p.code, 99))
    return [
        SaaSPlanResponse(
            id=p.id,
            name=p.name,
            code=p.code,
            price_monthly=p.price_monthly or 0.0,
            price_yearly=p.price_yearly or 0.0,
            max_branches=p.max_branches or 1,
            max_rooms=p.max_rooms or 15,
            max_staff_users=p.max_staff_users or 5,
            description=p.description or "",
            badge=p.badge or "",
            is_active=bool(p.is_active),
            features=p.features_list
        ) for p in plans
    ]


@router.post("/upload-image")
async def upload_property_image(image: UploadFile = File(...)):
    """Upload a property profile / banner image during registration"""
    if not image or not image.filename:
        raise HTTPException(status_code=400, detail="No image file provided")
    file_ext = image.filename.split('.')[-1].lower() if '.' in image.filename else 'jpg'
    if file_ext not in ['jpg', 'jpeg', 'png', 'webp']:
        raise HTTPException(status_code=400, detail="Unsupported image format. Allowed: JPG, PNG, WEBP")
    unique_filename = f"property_{uuid.uuid4().hex}.{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)
    return {"image_url": f"/uploads/{unique_filename}"}


@router.post("/register", response_model=SaaSRegisterResponse)
def register_saas_business(req: SaaSUserRegisterRequest, db: Session = Depends(get_db)):
    """
    Frictionless 60-second self-service onboarding:
    1. Validates slug and email.
    2. Provisions Tenant with 14-day free trial.
    3. Creates primary Branch (Main Property).
    4. Creates Owner/Admin Role with full permissions.
    5. Creates Owner User and generates instant JWT login token.
    """
    clean_slug = req.slug.strip().lower()
    
    # 1. Validation
    if not re.match(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", clean_slug) or clean_slug in RESERVED_SLUGS:
        raise HTTPException(status_code=400, detail="Invalid or reserved business URL slug")
        
    if db.query(Tenant).filter(Tenant.slug == clean_slug).first():
        raise HTTPException(status_code=400, detail="Business URL slug is already taken")
        
    if db.query(User).filter(User.email == req.email.strip().lower()).first():
        raise HTTPException(status_code=400, detail="A user with this email address already exists")

    # 2. Get Selected Plan (default: starter - 10 rooms)
    plan = db.query(SaaSPlan).filter(SaaSPlan.code == (req.plan_code or "starter")).first()
    if not plan:
        plan = db.query(SaaSPlan).filter(SaaSPlan.code == "starter").first()

    try:
        # 3. Create Tenant (No free trial - pending platform admin approval)
        now = datetime.now(timezone.utc)
        monthly_amt = plan.price_monthly if (plan and plan.price_monthly is not None) else 2999.0
        
        tenant = Tenant(
            name=req.business_name.strip(),
            slug=clean_slug,
            contact_email=req.email.strip().lower(),
            contact_phone=req.phone.strip() if req.phone else None,
            country=req.country or "IN",
            currency=req.currency or "INR",
            plan_id=plan.id if plan else None,
            subscription_status="pending_approval",
            trial_ends_at=None,
            billing_cycle="monthly",
            monthly_amount=monthly_amt,
            payment_status="unpaid",
            next_billing_date=now + timedelta(days=30),
            is_active=False # Inactive until accepted by Super Admin
        )
        db.add(tenant)
        db.flush() # get tenant.id

        # 4. Validate and Sanitize Compulsory Hotel Code
        branch_code = re.sub(r'[^a-zA-Z0-9_-]', '', req.branch_code.strip()).upper()
        if not branch_code:
            raise HTTPException(status_code=400, detail="Hotel Code / Property Code is compulsory. Please enter your code.")

        if db.query(Branch).filter(Branch.code == branch_code).first():
            raise HTTPException(
                status_code=400, 
                detail=f"Hotel Code '{branch_code}' is already registered with another property. Please enter your unique hotel code."
            )

        # 5. Create Default Branch with Aiosell Hotel/Branch Code & Details
        branch = Branch(
            tenant_id=tenant.id,
            name=req.business_name.strip(),
            code=branch_code,
            phone=req.phone.strip() if req.phone else None,
            email=req.email.strip().lower(),
            address=req.address.strip() if req.address else None,
            location=req.location.strip() if req.location else None,
            gst_number=req.gst_number.strip().upper() if req.gst_number else None,
            facebook=req.facebook.strip() if req.facebook else None,
            instagram=req.instagram.strip() if req.instagram else None,
            twitter=req.twitter.strip() if req.twitter else None,
            linkedin=req.linkedin.strip() if req.linkedin else None,
            image_url=req.image_url.strip() if req.image_url else None,
            is_active=False # Inactive until accepted by Super Admin
        )
        db.add(branch)
        db.flush() # get branch.id

        # 6. Create Default Owner Role for this Branch
        owner_role = Role(
            name="Owner / Admin",
            branch_id=branch.id,
            permissions=json.dumps(DEFAULT_OWNER_PERMISSIONS)
        )
        db.add(owner_role)
        db.flush() # get owner_role.id

        # 7. Create Owner User
        hashed_pwd = get_password_hash(req.password)
        user = User(
            tenant_id=tenant.id,
            name=req.owner_name.strip(),
            email=req.email.strip().lower(),
            hashed_password=hashed_pwd,
            phone=req.phone,
            is_active=True,
            role_id=owner_role.id,
            branch_id=branch.id,
            is_superadmin=False # Branch admin scoped exclusively to their branch
        )
        db.add(user)
        db.commit()

        # Refresh objects
        db.refresh(tenant)
        db.refresh(branch)
        db.refresh(user)

        # Access token is NOT generated until Super Admin accepts/approves the property
        return SaaSRegisterResponse(
            success=True,
            message="Registration submitted successfully! Your property is awaiting Super Admin approval and payment confirmation before activation.",
            access_token=None,
            tenant={
                "id": tenant.id,
                "name": tenant.name,
                "slug": tenant.slug,
                "currency": tenant.currency,
                "subscription_status": tenant.subscription_status,
                "is_approved": False,
                "monthly_amount": tenant.monthly_amount if tenant.monthly_amount is not None else (tenant.plan.price_monthly if getattr(tenant, 'plan', None) else 2999.0),
                "payment_status": tenant.payment_status,
                "next_billing_date": str(tenant.next_billing_date) if tenant.next_billing_date else None,
                "branch_code": branch.code
            },
            branch={
                "id": branch.id,
                "name": branch.name,
                "code": branch.code
            }
        )

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print(f"Error during SaaS registration: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


@router.get("/tenant-profile")
def get_tenant_profile(
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Fetch current tenant details, active plan, quotas, approval status, and billing info"""
    primary_branch = db.query(Branch).filter(Branch.tenant_id == tenant.id).first()
    branch_count = db.query(Branch).filter(Branch.tenant_id == tenant.id).count()
    room_count = db.query(Room).join(Branch).filter(Branch.tenant_id == tenant.id).count()
    user_count = db.query(User).filter(User.tenant_id == tenant.id).count()

    is_approved = tenant.subscription_status == "active"

    return {
        "id": tenant.id,
        "name": tenant.name,
        "slug": tenant.slug,
        "custom_domain": tenant.custom_domain,
        "contact_email": tenant.contact_email,
        "contact_phone": tenant.contact_phone,
        "currency": tenant.currency,
        "timezone": tenant.timezone,
        "logo_url": tenant.logo_url,
        "primary_color": tenant.primary_color,
        "subscription_status": tenant.subscription_status,
        "is_approved": is_approved,
        "payment_status": tenant.payment_status or "unpaid",
        "monthly_amount": getattr(tenant, 'monthly_amount', None) or (tenant.plan.price_monthly if tenant.plan else 2500.0),
        "last_billed_at": str(tenant.last_billed_at) if tenant.last_billed_at else None,
        "next_billing_date": str(tenant.next_billing_date) if tenant.next_billing_date else None,
        "branch_code": primary_branch.code if primary_branch else None,
        "plan": {
            "name": tenant.plan.name if tenant.plan else "Starter",
            "code": tenant.plan.code if tenant.plan else "starter",
            "price_monthly": getattr(tenant, 'monthly_amount', None) or (tenant.plan.price_monthly if tenant.plan else 2500.0),
            "max_branches": tenant.plan.max_branches if tenant.plan else 1,
            "max_rooms": tenant.plan.max_rooms if tenant.plan else 20,
            "max_staff_users": tenant.plan.max_staff_users if tenant.plan else 10,
            "features": tenant.plan.features_list if tenant.plan else []
        },
        "usage": {
            "branches": branch_count,
            "rooms": room_count,
            "users": user_count
        }
    }


# --- SuperAdmin Approval Endpoints ---

class ApproveTenantRequest(BaseModel):
    branch_code: Optional[str] = Field(None, max_length=50, description="Assigned Aiosell Hotel / Branch Code")

@router.get("/admin/overview")
def get_superadmin_overview(db: Session = Depends(get_db)):
    """Fast, single-trip aggregated KPI statistics for Super Admin Dashboard"""
    from app.models.checkout import Checkout
    from app.models.expense import Expense
    from app.models.room import Room
    from app.models.employee import Employee
    from sqlalchemy import func

    # Execute high-speed SQL aggregates directly inside PostgreSQL
    total_rev = db.query(func.coalesce(func.sum(Checkout.grand_total), 0.0)).scalar() or 0.0
    total_exp = db.query(func.coalesce(func.sum(Expense.amount), 0.0)).scalar() or 0.0
    total_rooms = db.query(func.count(Room.id)).scalar() or 0
    occupied_rooms = db.query(func.count(Room.id)).filter(
        func.lower(Room.status).in_(["occupied", "booked", "checked-in", "checkedin", "checked_in"])
    ).scalar() or 0
    active_employees = db.query(func.count(Employee.id)).filter(Employee.is_active == True).scalar() or 0
    total_properties = db.query(func.count(Tenant.id)).scalar() or 0
    active_properties = db.query(func.count(Tenant.id)).filter(Tenant.is_active == True, Tenant.subscription_status == "active").scalar() or 0

    return {
        "total_revenue": float(total_rev),
        "total_expenses": float(total_exp),
        "total_rooms": int(total_rooms),
        "occupied_rooms": int(occupied_rooms),
        "active_employees": int(active_employees),
        "total_properties": int(total_properties),
        "active_properties": int(active_properties)
    }


@router.get("/admin/tenants")
def list_all_tenants_for_admin(db: Session = Depends(get_db)):
    """List all registered properties and approval/billing status for Platform SuperAdmin with high efficiency"""
    from sqlalchemy.orm import joinedload
    from sqlalchemy import func

    tenants = db.query(Tenant).options(
        joinedload(Tenant.plan),
        joinedload(Tenant.branches),
        joinedload(Tenant.users)
    ).order_by(Tenant.created_at.desc()).all()

    # Pre-fetch room counts per branch in a single aggregated query
    room_counts = dict(
        db.query(Branch.tenant_id, func.count(Room.id))
        .join(Room, Room.branch_id == Branch.id)
        .group_by(Branch.tenant_id)
        .all()
    )

    result = []
    now = datetime.now(timezone.utc)
    for t in tenants:
        primary_branch = t.branches[0] if t.branches else None
        owner_user = next((u for u in t.users if not getattr(u, 'is_superadmin', False)), (t.users[0] if t.users else None))
        
        next_date = t.next_billing_date
        days_until_due = None
        is_overdue = False
        is_due_soon = False
        expiry_date = None
        if next_date:
            if next_date.tzinfo is None:
                next_date = next_date.replace(tzinfo=timezone.utc)
            diff_seconds = (next_date - now).total_seconds()
            days_until_due = int(round(diff_seconds / 86400.0))
            is_overdue = days_until_due < 0
            is_due_soon = 0 <= days_until_due <= 7
            expiry_date = next_date.strftime("%d %b %Y")

        result.append({
            "id": t.id,
            "name": t.name,
            "business_name": t.name,
            "slug": t.slug,
            "owner_name": owner_user.name if owner_user else "—",
            "email": owner_user.email if owner_user else t.contact_email,
            "contact_email": t.contact_email,
            "contact_phone": t.contact_phone,
            "subscription_status": t.subscription_status,
            "is_approved": t.subscription_status == "active",
            "is_active": bool(t.is_active),
            "plan_name": t.plan.name if t.plan else "Starter",
            "plan_code": t.plan.code if t.plan else "starter",
            "monthly_amount": t.monthly_amount if t.monthly_amount is not None else (t.plan.price_monthly if t.plan else 2999.0),
            "payment_status": t.payment_status or "unpaid",
            "payment_ref": getattr(t, 'payment_ref', None),
            "payment_method": getattr(t, 'payment_method', None),
            "payment_raised_at": str(t.payment_raised_at) if getattr(t, 'payment_raised_at', None) else None,
            "next_billing_date": str(t.next_billing_date.strftime("%Y-%m-%d")) if t.next_billing_date else None,
            "expiry_date": expiry_date,
            "days_until_due": days_until_due,
            "is_due_soon": is_due_soon,
            "is_overdue": is_overdue,
            "last_billed_at": str(t.last_billed_at) if t.last_billed_at else None,
            "branch_code": primary_branch.code if primary_branch else "N/A",
            "branch_id": primary_branch.id if primary_branch else None,
            "room_count": room_counts.get(t.id, 0),
            "created_at": str(t.created_at),
            "approved_at": str(t.approved_at) if t.approved_at else None
        })
    return result


@router.post("/admin/approve-tenant/{tenant_id}")
def approve_tenant(
    tenant_id: int, 
    req: Optional[ApproveTenantRequest] = None, 
    db: Session = Depends(get_db)
):
    """Approve and activate a registered property workspace, optionally assigning/updating hotel/branch code"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant property not found")
    
    assigned_code = None
    if req and req.branch_code and req.branch_code.strip():
        clean_code = re.sub(r'[^a-zA-Z0-9_-]', '', req.branch_code.strip()).upper()
        if clean_code:
            conflict = db.query(Branch).filter(Branch.code == clean_code, Branch.tenant_id != tenant.id).first()
            if conflict:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Hotel code '{clean_code}' is already assigned to property '{conflict.name}'. Please enter a unique code."
                )
            primary_branch = db.query(Branch).filter(Branch.tenant_id == tenant.id).first()
            if primary_branch:
                primary_branch.code = clean_code
                assigned_code = clean_code
            else:
                primary_branch = Branch(
                    tenant_id=tenant.id,
                    name=tenant.name,
                    code=clean_code,
                    phone=tenant.contact_phone,
                    email=tenant.contact_email,
                    is_active=True
                )
                db.add(primary_branch)
                assigned_code = clean_code
    else:
        primary_branch = db.query(Branch).filter(Branch.tenant_id == tenant.id).first()
        if primary_branch:
            assigned_code = primary_branch.code

    tenant.subscription_status = "active"
    tenant.is_active = True
    tenant.approved_at = datetime.now(timezone.utc)

    # Activate all branches of this tenant
    branches = db.query(Branch).filter(Branch.tenant_id == tenant.id).all()
    for b in branches:
        b.is_active = True

    # Activate all users of this tenant
    users = db.query(User).filter(User.tenant_id == tenant.id).all()
    for u in users:
        u.is_active = True

    db.commit()
    db.refresh(tenant)
    
    msg = f"Property '{tenant.name}' approved and activated! Property admin can now log in."
    if assigned_code:
        msg += f" Hotel Code set to '{assigned_code}'."
    return {
        "success": True, 
        "message": msg,
        "tenant_id": tenant.id, 
        "subscription_status": tenant.subscription_status,
        "is_active": tenant.is_active,
        "branch_code": assigned_code
    }


@router.post("/admin/update-branch-code/{tenant_id}")
def update_tenant_branch_code(
    tenant_id: int, 
    req: ApproveTenantRequest, 
    db: Session = Depends(get_db)
):
    """Allow SuperAdmin to assign or update Aiosell hotel/branch code anytime"""
    if not req.branch_code or not req.branch_code.strip():
        raise HTTPException(status_code=400, detail="Hotel code is required")
    
    clean_code = re.sub(r'[^a-zA-Z0-9_-]', '', req.branch_code.strip()).upper()
    if not clean_code:
        raise HTTPException(status_code=400, detail="Invalid hotel code")
        
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant property not found")
        
    conflict = db.query(Branch).filter(Branch.code == clean_code, Branch.tenant_id != tenant.id).first()
    if conflict:
        raise HTTPException(status_code=400, detail=f"Hotel code '{clean_code}' is already in use by '{conflict.name}'.")
        
    primary_branch = db.query(Branch).filter(Branch.tenant_id == tenant.id).first()
    if not primary_branch:
        primary_branch = Branch(
            tenant_id=tenant.id,
            name=tenant.name,
            code=clean_code,
            is_active=True
        )
        db.add(primary_branch)
    else:
        primary_branch.code = clean_code
        
    db.commit()
    return {"success": True, "message": f"Hotel code updated to '{clean_code}'", "branch_code": clean_code}


@router.post("/admin/toggle-tenant-status/{tenant_id}")
def toggle_tenant_status(
    tenant_id: int, 
    db: Session = Depends(get_db)
):
    """Enable or disable a tenant property workspace (SuperAdmin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant property not found")
        
    tenant.is_active = not bool(tenant.is_active)
    if tenant.is_active and tenant.subscription_status == "pending_approval":
        tenant.subscription_status = "active"
        tenant.approved_at = datetime.now(timezone.utc)
    
    # Synchronize all branches of this tenant
    branches = db.query(Branch).filter(Branch.tenant_id == tenant.id).all()
    for b in branches:
        b.is_active = tenant.is_active
        
    # Synchronize all users of this tenant
    users = db.query(User).filter(User.tenant_id == tenant.id).all()
    for u in users:
        u.is_active = tenant.is_active
        
    db.commit()
    db.refresh(tenant)
    status_label = "enabled" if tenant.is_active else "disabled"
    return {
        "success": True, 
        "message": f"Property '{tenant.name}' has been {status_label} successfully.", 
        "tenant_id": tenant.id, 
        "is_active": tenant.is_active
    }


class AcceptPaymentRequest(BaseModel):
    payment_status: Optional[str] = "paid" # "paid", "unpaid", "overdue"
    payment_method: Optional[str] = "UPI (Teqmates)"
    transaction_ref: Optional[str] = None
    activate_property: Optional[bool] = True

@router.post("/admin/accept-payment/{tenant_id}")
def accept_tenant_payment(
    tenant_id: int,
    req: Optional[AcceptPaymentRequest] = None,
    db: Session = Depends(get_db)
):
    """Allow SuperAdmin to accept, verify, or toggle payment status for a tenant property"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant property not found")
        
    status = (req.payment_status if req and req.payment_status else "paid").lower()
    tenant.payment_status = status
    now = datetime.now(timezone.utc)
    
    if status == "paid":
        tenant.last_billed_at = now
        tenant.next_billing_date = now + timedelta(days=30)
        
        # When payment is accepted, immediately activate the property workspace
        if req is None or req.activate_property:
            tenant.subscription_status = "active"
            tenant.is_active = True
            tenant.approved_at = now
            
            # Ensure all branches are active
            branches = db.query(Branch).filter(Branch.tenant_id == tenant.id).all()
            for b in branches:
                b.is_active = True
                
            # Ensure all users are active
            users = db.query(User).filter(User.tenant_id == tenant.id).all()
            for u in users:
                u.is_active = True
    elif status == "unpaid":
        tenant.last_billed_at = None
        
    db.commit()
    db.refresh(tenant)
    
    action_text = "accepted & property activated" if status == "paid" else f"updated to {status}"
    ref_info = f" (Ref: {req.transaction_ref})" if req and req.transaction_ref else ""
    return {
        "success": True,
        "message": f"Payment for '{tenant.name}' has been {action_text}{ref_info}! Property is now active.",
        "tenant_id": tenant.id,
        "payment_status": tenant.payment_status,
        "subscription_status": tenant.subscription_status
    }


# --- SuperAdmin SaaS Plan Management ---

class PlanUpdateRequest(BaseModel):
    name: Optional[str] = None
    price_monthly: Optional[float] = None
    price_yearly: Optional[float] = None
    max_rooms: Optional[int] = None
    max_branches: Optional[int] = None
    max_staff_users: Optional[int] = None
    description: Optional[str] = None
    badge: Optional[str] = None
    features: Optional[List[str]] = None
    is_active: Optional[bool] = None
    update_existing_tenants: Optional[bool] = False

@router.get("/admin/plans")
def list_all_plans_for_admin(db: Session = Depends(get_db)):
    code_order = {"starter": 1, "growth": 2, "enterprise": 3, "trial": 4}
    plans = db.query(SaaSPlan).all()
    plans = sorted(plans, key=lambda p: code_order.get(p.code, 99))
    result = []
    for p in plans:
        subscriber_count = db.query(Tenant).filter(Tenant.plan_id == p.id).count()
        result.append({
            "id": p.id,
            "name": p.name,
            "code": p.code,
            "price_monthly": p.price_monthly or 0.0,
            "price_yearly": p.price_yearly or 0.0,
            "max_branches": p.max_branches or 1,
            "max_rooms": p.max_rooms or 15,
            "max_staff_users": p.max_staff_users or 5,
            "description": p.description or "",
            "badge": p.badge or "",
            "is_active": bool(p.is_active),
            "features": p.features_list,
            "subscriber_count": subscriber_count
        })
    return result


@router.put("/admin/plans/{plan_id}")
def update_plan_for_admin(
    plan_id: int,
    req: PlanUpdateRequest,
    db: Session = Depends(get_db)
):
    """Allow SuperAdmin to edit any SaaS plan (name, pricing, rooms, features, badges, description)"""
    plan = db.query(SaaSPlan).filter(SaaSPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="SaaS Plan not found")

    if req.name is not None and req.name.strip():
        plan.name = req.name.strip()
    if req.price_monthly is not None:
        plan.price_monthly = float(req.price_monthly)
    if req.price_yearly is not None:
        plan.price_yearly = float(req.price_yearly)
    if req.max_rooms is not None:
        plan.max_rooms = int(req.max_rooms)
    if req.max_branches is not None:
        plan.max_branches = int(req.max_branches)
    if req.max_staff_users is not None:
        plan.max_staff_users = int(req.max_staff_users)
    if req.description is not None:
        plan.description = req.description.strip()
    if req.badge is not None:
        plan.badge = req.badge.strip()
    if req.is_active is not None:
        plan.is_active = bool(req.is_active)
    if req.features is not None:
        clean_features = [f.strip() for f in req.features if f and f.strip()]
        plan.features = json.dumps(clean_features)

    # If requested, update monthly_amount for tenants currently on this plan
    if req.update_existing_tenants and req.price_monthly is not None:
        tenants = db.query(Tenant).filter(Tenant.plan_id == plan.id).all()
        for t in tenants:
            t.monthly_amount = float(req.price_monthly)

    db.commit()
    db.refresh(plan)

    return {
        "success": True,
        "message": f"Plan '{plan.name}' has been updated successfully!",
        "plan": {
            "id": plan.id,
            "name": plan.name,
            "code": plan.code,
            "price_monthly": plan.price_monthly,
            "price_yearly": plan.price_yearly,
            "max_branches": plan.max_branches,
            "max_rooms": plan.max_rooms,
            "max_staff_users": plan.max_staff_users,
            "description": plan.description,
            "badge": plan.badge,
            "is_active": plan.is_active,
            "features": plan.features_list
        }
    }


@router.delete("/admin/plans/{plan_id}")
def delete_plan_for_admin(plan_id: int, db: Session = Depends(get_db)):
    """Allow SuperAdmin to delete a SaaS plan"""
    plan = db.query(SaaSPlan).filter(SaaSPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="SaaS Plan not found")

    # Unlink any tenants currently assigned to this plan
    tenants = db.query(Tenant).filter(Tenant.plan_id == plan.id).all()
    for t in tenants:
        t.plan_id = None

    plan_name = plan.name
    db.delete(plan)
    db.commit()

    return {
        "success": True,
        "message": f"Plan '{plan_name}' has been deleted successfully."
    }


# --- Property Billing & Payment Endpoints (Day 1 & Monthly) ---

class PayBillRequest(BaseModel):
    payment_method: Optional[str] = "UPI / Card"
    transaction_ref: Optional[str] = None

class RaisePaymentRequest(BaseModel):
    tenant_id: Optional[int] = None
    slug: Optional[str] = None
    branch_code: Optional[str] = None
    payment_method: Optional[str] = "UPI (Teqmates)"
    transaction_ref: str
    notes: Optional[str] = None

@router.get("/billing")
def get_tenant_billing(
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Fetch property billing, monthly subscription rates, and payment options"""
    primary_branch = db.query(Branch).filter(Branch.tenant_id == tenant.id).first()
    monthly_amt = tenant.monthly_amount if tenant.monthly_amount is not None else (tenant.plan.price_monthly if tenant.plan else 2999.0)
    now = datetime.now(timezone.utc)
    next_date = tenant.next_billing_date or (now + timedelta(days=30))
    if next_date.tzinfo is None:
        next_date = next_date.replace(tzinfo=timezone.utc)

    diff_seconds = (next_date - now).total_seconds()
    days_until_due = int(round(diff_seconds / 86400.0))
    is_overdue = days_until_due < 0
    is_due_soon = 0 <= days_until_due <= 7

    current_status = tenant.payment_status or "unpaid"
    # If the due date / expiry date has passed and previous month was paid,
    # the new monthly cycle is now due!
    if is_overdue and current_status == "paid":
        current_status = "overdue"

    return {
        "tenant_id": tenant.id,
        "business_name": tenant.name,
        "subscription_status": tenant.subscription_status,
        "is_approved": tenant.subscription_status == "active",
        "plan": {
            "name": tenant.plan.name if tenant.plan else "Starter",
            "code": tenant.plan.code if tenant.plan else "starter",
            "price_monthly": monthly_amt,
        },
        "branch_code": primary_branch.code if primary_branch else "N/A",
        "monthly_amount": monthly_amt,
        "payment_status": current_status,
        "payment_ref": getattr(tenant, 'payment_ref', None),
        "payment_method": getattr(tenant, 'payment_method', None),
        "payment_raised_at": str(tenant.payment_raised_at) if getattr(tenant, 'payment_raised_at', None) else None,
        "billing_cycle": tenant.billing_cycle or "monthly",
        "last_billed_at": str(tenant.last_billed_at) if tenant.last_billed_at else None,
        "next_billing_date": str(next_date),
        "due_date": next_date.strftime("%Y-%m-%d"),
        "expiry_date": next_date.strftime("%d %b %Y"),
        "days_until_due": days_until_due,
        "is_due_soon": is_due_soon,
        "is_overdue": is_overdue,
        "currency": tenant.currency or "INR"
    }


@router.post("/raise-payment")
def raise_property_payment(
    req: RaisePaymentRequest,
    db: Session = Depends(get_db)
):
    """Allows a property (pending approval or active) to raise payment with UTR / reference for Super Admin acceptance"""
    if not req.transaction_ref or not req.transaction_ref.strip():
        raise HTTPException(status_code=400, detail="Transaction reference / UTR number is required")
        
    tenant = None
    if req.tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == req.tenant_id).first()
    elif req.slug:
        tenant = db.query(Tenant).filter(Tenant.slug == req.slug.strip().lower()).first()
    elif req.branch_code:
        branch = db.query(Branch).filter(Branch.code == req.branch_code.strip().upper()).first()
        if branch and branch.tenant_id:
            tenant = db.query(Tenant).filter(Tenant.id == branch.tenant_id).first()
            
    if not tenant:
        raise HTTPException(status_code=404, detail="Property not found")
        
    now = datetime.now(timezone.utc)
    tenant.payment_status = "payment_raised"
    tenant.payment_ref = req.transaction_ref.strip().upper()
    tenant.payment_method = req.payment_method or "UPI (Teqmates)"
    tenant.payment_raised_at = now
    
    db.commit()
    db.refresh(tenant)
    amount_val = getattr(tenant, 'monthly_amount', None) if getattr(tenant, 'monthly_amount', None) is not None else (tenant.plan.price_monthly if getattr(tenant, 'plan', None) else 2999.0)
    return {
        "success": True,
        "message": f"Payment of {tenant.currency} {amount_val:,.2f} raised with UTR '{tenant.payment_ref}'! Super Admin can now verify and accept the payment.",
        "tenant_id": tenant.id,
        "payment_status": tenant.payment_status,
        "payment_ref": tenant.payment_ref,
        "payment_raised_at": str(tenant.payment_raised_at)
    }


@router.post("/pay-bill")
def pay_monthly_bill(
    req: Optional[PayBillRequest] = None,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Raise monthly bill payment from property for Super Admin verification & acceptance"""
    now = datetime.now(timezone.utc)
    tenant.payment_status = "payment_raised"
    tenant.payment_ref = req.transaction_ref.strip().upper() if req and req.transaction_ref else f"TXN-{int(now.timestamp())}"
    tenant.payment_method = req.payment_method if req and req.payment_method else "UPI (Teqmates)"
    tenant.payment_raised_at = now
    
    db.commit()
    db.refresh(tenant)
    return {
        "success": True,
        "message": f"Payment raised with reference '{tenant.payment_ref}'! Super Admin will review and accept your payment.",
        "payment_status": tenant.payment_status,
        "payment_ref": tenant.payment_ref,
        "payment_raised_at": str(tenant.payment_raised_at),
        "next_billing_date": str(tenant.next_billing_date)
    }
