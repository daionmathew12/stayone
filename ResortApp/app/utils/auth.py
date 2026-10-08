from datetime import timezone, datetime, timedelta
from jose import JWTError, jwt
import bcrypt
from app.models.user import User
from sqlalchemy.orm import Session, joinedload
from fastapi import Depends, HTTPException, status, Request
from typing import Optional, List, Any
from app.database import SessionLocal
from fastapi.security import OAuth2PasswordBearer
import os

# ENV
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "24"))

# Removed pwd_context - using bcrypt directly
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_password_hash(password):
    # Use bcrypt directly to avoid compatibility issues
    password_bytes = password.encode("utf-8")
    # bcrypt handles truncation automatically, but we'll limit to 72 bytes to be safe
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]

    # Generate salt and hash password using bcrypt directly
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def verify_password(plain, hashed):
    # Use bcrypt directly to avoid compatibility issues
    password_bytes = plain.encode("utf-8")
    # bcrypt handles truncation automatically, but we'll limit to 72 bytes to be safe
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]

    # Verify password using bcrypt directly
    return bcrypt.checkpw(password_bytes, hashed.encode("utf-8"))


def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(days=100))
    to_encode.update({"exp": expire})
    encoded = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    # Handle both string and bytes return from jwt.encode (version compatibility)
    return encoded.decode('utf-8') if isinstance(encoded, bytes) else encoded


def decode_token(token: str):
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)
):
    # Support token as query parameter for PDF downloads/prints from mobile
    if not token:
        token = request.query_params.get("token")

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Debug Logging
        # print(f"[AUTH DEBUG] Verifying token: {token[:10]}...")
        
        # Check if token is None or empty
        if not token:
            print("[AUTH DEBUG] Token is missing")
            raise credentials_exception
        
        payload = decode_token(token)
        # print(f"[AUTH DEBUG] Decoded payload: {payload}")
        
        user_id: int = payload.get("user_id")
        if user_id is None:
            print("[AUTH DEBUG] user_id missing in payload")
            raise credentials_exception
            
    except HTTPException:
        raise
    except JWTError as e:
        print(f"[AUTH DEBUG] JWT Error: {e}")
        raise credentials_exception
    except Exception as e:
        import traceback
        print(f"[AUTH DEBUG] Token Decode Error: {str(e)}\n{traceback.format_exc()}")
        raise credentials_exception

    try:
        from app.models.branch import Branch
        user = db.query(User).options(
            joinedload(User.role),
            joinedload(User.tenant),
            joinedload(User.branch).joinedload(Branch.tenant)
        ).filter(User.id == user_id).first()

        if user is None:
            print(f"[AUTH DEBUG] User ID {user_id} not found in database")
            raise credentials_exception
            
        if user.role is None:
            print(f"[AUTH DEBUG] User {user_id} has no role assigned")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User role not found. Please contact administrator."
            )
            
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account has been deactivated."
            )

        # In-memory check: Verify tenant workspace is active & approved
        if user.tenant and not getattr(user, 'is_superadmin', False):
            if user.tenant.subscription_status == "pending_approval" or not user.tenant.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"This property workspace '{user.tenant.name}' is pending approval / activation by Super Admin."
                )

        # In-memory check: Verify assigned branch and its parent tenant are active
        if user.branch_id is not None and not getattr(user, 'is_superadmin', False):
            user_branch = user.branch
            if not user_branch or not user_branch.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied: Branch '{user_branch.name if user_branch else user.branch_id}' is pending activation by Super Admin."
                )
            if user_branch.tenant and (user_branch.tenant.subscription_status == "pending_approval" or not user_branch.tenant.is_active):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied: Property workspace '{user_branch.tenant.name}' is pending approval / activation by Super Admin."
                )

        # Store user info in request state for logging and scoping
        request.state.user_id = user.id
        request.state.branch_id = user.branch_id
        request.state.is_superadmin = getattr(user, 'is_superadmin', False)

        # print(f"[AUTH DEBUG] User verified: {user.email}")
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[AUTH DEBUG] DB Error during auth: {str(e)}\n{traceback.format_exc()}")
        raise credentials_exception



def get_branch_id(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Optional[int]:
    # 1. If global superadmin without branch_id, allow override via header
    is_global_superadmin = getattr(current_user, 'is_superadmin', False) and current_user.branch_id is None
    if is_global_superadmin:
        branch_header = request.headers.get("X-Branch-ID")
        if branch_header == "all":
            return None
        if branch_header: 
            try:
                return int(branch_header)
            except ValueError:
                pass
        return None
    
    # 2. If user belongs to a tenant workspace, allow switching between branches that belong to their tenant
    if getattr(current_user, "tenant_id", None) is not None:
        branch_header = request.headers.get("X-Branch-ID")
        if branch_header:
            if branch_header == "all":
                return None
            try:
                requested_id = int(branch_header)
                from app.models.branch import Branch
                target_branch = db.query(Branch).filter(
                    Branch.id == requested_id,
                    Branch.tenant_id == current_user.tenant_id
                ).first()
                if target_branch:
                    if not target_branch.is_active:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"Access denied: Branch '{target_branch.name}' has been disabled."
                        )
                    return target_branch.id
            except ValueError:
                pass

    # 3. Otherwise, strictly return user's fixed branch_id
    if getattr(current_user, 'branch_id', None) is None:
        raise HTTPException(status_code=403, detail="User not assigned to a branch")
    
    from app.models.branch import Branch
    from app.models.tenant import Tenant
    branch = db.query(Branch).filter(Branch.id == current_user.branch_id).first()
    if not branch or not branch.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Branch '{branch.name if branch else current_user.branch_id}' has been disabled by platform administration."
        )
    if branch.tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == branch.tenant_id).first()
        if tenant and not tenant.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Property workspace '{tenant.name}' has been disabled by platform administration."
            )
    return current_user.branch_id

def verify_superadmin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency to ensure the current user is a superadmin."""
    if not getattr(current_user, 'is_superadmin', False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmin privileges required to perform this action."
        )
    return current_user

def has_permission(user: User, required_permission: str) -> bool:
    """
    Check if a user has a specific permission.
    Superadmins and admin/owner roles bypass all checks.
    Otherwise, checks against the role's parsed permissions_list.
    """
    if getattr(user, 'is_superadmin', False):
        return True
        
    if user.role:
        role_lower = user.role.name.lower()
        if "admin" in role_lower or "owner" in role_lower or role_lower in ["manager", "superadmin"]:
            return True
            
        # permissions_list is a property on Role that returns a list of strings
        perms = getattr(user.role, "permissions_list", [])
        print(f"[DEBUG-AUTH] Checking permission '{required_permission}' for user {user.email}")
        print(f"[DEBUG-AUTH] Role: {user.role.name}, Permissions: {perms}")
        
        # 1. Exact match (e.g., "rooms:create")
        if required_permission in perms:
            return True
            
        # 2. Module wildcard match (if required_permission is "rooms", match if any permission starts with "rooms:")
        # This is useful for high-level visibility or broad access 
        if any(p.startswith(f"{required_permission}:") or p.startswith(f"{required_permission}_") for p in perms):
            return True
            
    return False

def require_permission(permission: str):
    """
    FastAPI dependency that ensures the current user has the required permission.
    Usage: Depends(require_permission("rooms:view"))
    """
    def permission_checker(current_user: User = Depends(get_current_user)):
        if not has_permission(current_user, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {permission} required."
            )
        return current_user
    return permission_checker
