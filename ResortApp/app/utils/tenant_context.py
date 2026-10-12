from fastapi import Request, HTTPException, Depends, Header
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone

from app.database import SessionLocal
from app.utils.auth import get_db
from app.models.tenant import Tenant, SaaSPlan

def resolve_tenant_from_request(request: Request, db: Session) -> Optional[Tenant]:
    """
    Multi-tenant resolver hierarchy:
    1. Header: 'X-Tenant-Slug' or 'X-Tenant-ID'
    2. Header: 'X-Branch-ID' (resolves parent tenant of active branch)
    3. JWT Bearer Auth: User's assigned tenant_id or branch's tenant_id
    4. Query param: '?tenant=...'
    5. Host subdomain: e.g. 'paradisebay.stayone.com' -> 'paradisebay'
    6. Default fallback: First active tenant or 'stayone'
    """
    tenant = None

    # 1. Check Header
    tenant_slug_header = request.headers.get("X-Tenant-Slug")
    if tenant_slug_header:
        tenant = db.query(Tenant).filter(Tenant.slug == tenant_slug_header.strip().lower(), Tenant.is_active == True).first()
        if tenant:
            return tenant

    tenant_id_header = request.headers.get("X-Tenant-ID")
    if tenant_id_header and tenant_id_header.isdigit():
        tenant = db.query(Tenant).filter(Tenant.id == int(tenant_id_header), Tenant.is_active == True).first()
        if tenant:
            return tenant

    # 2. Check X-Branch-ID Header
    branch_id_header = request.headers.get("X-Branch-ID")
    if branch_id_header and branch_id_header.strip().isdigit():
        from app.models.branch import Branch
        branch = db.query(Branch).filter(Branch.id == int(branch_id_header.strip())).first()
        if branch and branch.tenant_id:
            tenant = db.query(Tenant).filter(Tenant.id == branch.tenant_id, Tenant.is_active == True).first()
            if tenant:
                return tenant

    # 3. Check JWT Bearer Token (Authenticated User's Tenant)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            from app.utils.auth import decode_token
            from app.models.user import User as UserModel
            from app.models.branch import Branch
            payload = decode_token(token)
            user_id = payload.get("user_id")
            if user_id:
                u = db.query(UserModel).filter(UserModel.id == user_id).first()
                if u:
                    if u.tenant_id:
                        tenant = db.query(Tenant).filter(Tenant.id == u.tenant_id, Tenant.is_active == True).first()
                        if tenant:
                            return tenant
                    elif u.branch_id:
                        branch = db.query(Branch).filter(Branch.id == u.branch_id).first()
                        if branch and branch.tenant_id:
                            tenant = db.query(Tenant).filter(Tenant.id == branch.tenant_id, Tenant.is_active == True).first()
                            if tenant:
                                return tenant
        except Exception:
            pass

    # 4. Check Query parameter
    tenant_param = request.query_params.get("tenant")
    if tenant_param:
        tenant = db.query(Tenant).filter(Tenant.slug == tenant_param.strip().lower(), Tenant.is_active == True).first()
        if tenant:
            return tenant

    # 5. Check Hostname / Subdomain
    host = request.headers.get("host", "").split(":")[0].lower()
    if host and host not in ("localhost", "127.0.0.1") and not host.replace(".", "").isdigit():
        parts = host.split(".")
        # If subdomain exists and not 'www', 'api', 'admin'
        if len(parts) >= 3 and parts[0] not in ("www", "api", "admin", "app"):
            subdomain = parts[0]
            tenant = db.query(Tenant).filter(Tenant.slug == subdomain, Tenant.is_active == True).first()
            if tenant:
                return tenant

        # Check custom domain
        tenant = db.query(Tenant).filter(Tenant.custom_domain == host, Tenant.is_active == True).first()
        if tenant:
            return tenant

    # 6. Fallback to primary default tenant
    tenant = db.query(Tenant).filter(Tenant.slug == "stayone").first()
    if not tenant:
        tenant = db.query(Tenant).first()
    return tenant

def get_current_tenant(request: Request, db: Session = Depends(get_db)) -> Tenant:
    tenant = resolve_tenant_from_request(request, db)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant organization not found")
    
    if not tenant.is_active:
        raise HTTPException(status_code=403, detail="Tenant account is deactivated. Please contact support.")
        
    return tenant
