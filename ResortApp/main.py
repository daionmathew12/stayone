# app/main.py - Trigger Reload 4 - ROOT FORCE
from fastapi import FastAPI, Request, HTTPException, Depends
print(">>> STARTING WITH NEW MAIN.PY - DEBUG VERSION 2 <<<") # Confirm file load
# Force Reload Fix 14 (Trigger Reload for Bill Filter Fix)
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from pathlib import Path
import os
import traceback
from time import time
from sqlalchemy.orm import Session
from typing import Any, List
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# GCP Instance ID Lock
INSTANCE_ID_LOCK = "4726854500094706993"

def check_instance_id():
    """Instance check bypassed for local docker development"""
    return

# Execute security check
check_instance_id()

# Import all API routers
from app.api import (
    packages,
    room,
    user,
    auth,
    frontend,
    booking,
    checkout,
    dashboard,
    employee,
    expenses,
    food_category,
    food_item,
    food_orders,
    payment,
    report,
    reports,
    role,
    service,
    attendance,
    service_request,
    service_report,
    account,
    gst_reports,
    branch,
    notification,
    activity_logs,
    rate_plan,
    calendar,
    day_audit,
    restaurant_table,
    salary_advance,
    saas_register,
)
from app.api.settings import router as settings_router
from app.api import reports_module

# Import recipe router separately to catch any import errors
recipe_module = None
try:
    from app.api import recipe as recipe_module
    print("[OK] Recipe router imported successfully")
    print(f"   Router prefix: {recipe_module.router.prefix}")
    print(f"   Number of routes: {len(recipe_module.router.routes)}")
except Exception as e:
    print(f"[ERROR] ERROR importing recipe router: {e}")
    import traceback
    traceback.print_exc()
    recipe_module = None

# Import inventory router separately to catch any import errors
try:
    from app.api import inventory
    print("[OK] Inventory router imported successfully")
except Exception as e:
    print(f"[ERROR] ERROR importing inventory router: {e}")
    import traceback
    traceback.print_exc()
    inventory = None


# Import comprehensive reports router separately to catch any import errors
try:
    from app.api import comprehensive_reports
    print("[OK] Comprehensive Reports router imported successfully")
except Exception as e:
    print(f"[ERROR] ERROR importing comprehensive_reports router: {e}")
    import traceback
    traceback.print_exc()
    comprehensive_reports = None

# Import public router separately to catch any import errors
public_module = None
try:
    from app.api import public as public_module
    print("[OK] Public router imported successfully")
    print(f"   Router prefix: {public_module.router.prefix}")
    print(f"   Number of routes: {len(public_module.router.routes)}")
except Exception as e:
    print(f"[ERROR] ERROR importing public router: {e}")
    import traceback
    traceback.print_exc()
    public_module = None

from app.database import engine, Base

# Create database tables
from app.models.settings import SystemSetting
from app.utils.auth import get_db
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Resort Management System",
    description="Complete resort management system with booking, payments, and customer management",
    version="1.0.0",
    redirect_slashes=False,  # Prevent automatic trailing slash redirects
)

@app.on_event("startup")
async def startup_event():
    """Start background tasks"""
    # from app.utils.food_scheduler import run_food_scheduler
    # import asyncio
    # asyncio.create_task(run_food_scheduler())

# Exception handlers for proper error logging and responses
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions with proper logging and CORS headers"""
    import sys
    print(f"HTTP Exception {exc.status_code} in {request.method} {request.url.path}: {exc.detail}")
    headers = dict(exc.headers) if hasattr(exc, 'headers') and exc.headers else {}
    # Add CORS headers to error responses
    headers.update({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
    })
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=headers
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with proper logging and CORS headers"""
    from fastapi.encoders import jsonable_encoder
    try:
        errors = jsonable_encoder(exc.errors())
    except Exception:
        errors = []
        for err in exc.errors():
            clean = {}
            for k, v in err.items():
                if k == "ctx" and isinstance(v, dict):
                    clean[k] = {ck: str(cv) for ck, cv in v.items()}
                elif isinstance(v, bytes):
                    clean[k] = v.decode("utf-8", errors="replace")
                else:
                    try:
                        import json
                        json.dumps(v)
                        clean[k] = v
                    except Exception:
                        clean[k] = str(v)
            errors.append(clean)

    print(f"Validation error in {request.method} {request.url.path}: {errors}")
    return JSONResponse(
        status_code=422,
        content={"detail": errors},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch all other unhandled exceptions and return proper error responses"""
    import sys
    
    # Log the full error with traceback
    # Log the full error with traceback
    # error_detail = f"Unhandled exception in {request.method} {request.url.path}: {str(exc)}\n{traceback.format_exc()}"
    # try:
    #     print(f"ERROR (global handler): {error_detail}")
    #     sys.stderr.write(f"ERROR (global handler): {error_detail}\n")
    # except Exception:
    #     pass
    traceback.print_exc()
    
    # Return 500 with error message and CORS headers
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

# Compression middleware (reduces response size by 70-90%)
app.add_middleware(GZipMiddleware, minimum_size=500)  # Compress responses > 500 bytes

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Activity Logging Middleware
from app.core.middleware import ActivityLoggingMiddleware
app.add_middleware(ActivityLoggingMiddleware)


# Performance monitoring and caching middleware
class PerformanceMiddleware(BaseHTTPMiddleware):
    # Image and font extensions that can be cached for a long time
    _IMMUTABLE_EXTS = (".webp", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf")
    # Upload path prefix — served as user-uploaded images
    _STATIC_PATHS = ("/uploads/", "/static/", "/user-static/", "/admin-static/", "/landing/")
    # Real-time paths that must never be cached
    _NO_CACHE_PATHS = ("/bill/active-rooms", "/active-rooms", "/checkout", "/auth/")

    async def dispatch(self, request: Request, call_next):
        start_time = time()
        response = await call_next(request)
        process_time = time() - start_time

        # Add performance header
        response.headers["X-Process-Time"] = str(round(process_time, 3))

        if request.method == "GET":
            path = str(request.url.path).lower()

            # 1. Real-time endpoints — never cache
            if any(p in path for p in self._NO_CACHE_PATHS):
                response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"

            # 2. Uploaded images & static assets — cache 1 year (immutable, fingerprinted filenames)
            elif any(path.startswith(p) for p in self._STATIC_PATHS):
                if any(path.endswith(ext) for ext in self._IMMUTABLE_EXTS):
                    response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
                else:
                    response.headers["Cache-Control"] = "public, max-age=3600"

            # 3. Semi-static API data (rooms, packages, menus) — cache 5 minutes
            elif any(p in path for p in ["/rooms", "/packages", "/services", "/food-items", "/menu"]):
                response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=60"

            # 4. All other API endpoints — short cache 30 seconds
            else:
                response.headers["Cache-Control"] = "public, max-age=30, stale-while-revalidate=10"

        # Log slow requests (> 1 second)
        if process_time > 1.0:
            print(f"[PERF] Slow request: {request.method} {request.url.path} took {process_time:.2f}s")

        return response

@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"[RECV-LOG] {request.method} {request.url.path}")
    response = await call_next(request)
    print(f"[SEND-LOG] {request.method} {request.url.path} -> {response.status_code}")
    return response

app.add_middleware(PerformanceMiddleware)

# Static file directories - use absolute paths so they work regardless of working directory
_MAIN_DIR = os.path.dirname(os.path.abspath(__file__))
_UPLOADS_DIR = os.path.join(_MAIN_DIR, "uploads")
_STATIC_DIR = os.path.join(_MAIN_DIR, "static")
os.makedirs(_UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_UPLOADS_DIR), name="uploads")
if os.path.exists(_STATIC_DIR):
    app.mount("/static", StaticFiles(directory=_STATIC_DIR), name="static")

# Mount landing page static files
landing_page_path = Path("../landingpage")
if landing_page_path.exists():
    app.mount("/landing", StaticFiles(directory="../landingpage"), name="landing")

# Mount dashboard build files (React build)
dashboard_build_path = Path("../dasboard/build")
if dashboard_build_path.exists():
    static_path = dashboard_build_path / "static"
    if static_path.exists():
        app.mount(
            "/admin-static",
            StaticFiles(directory=str(static_path)),
            name="admin-static",
        )

# Mount user end build files
userend_build_path = Path("../userend/build")
if userend_build_path.exists():
    static_path = userend_build_path / "static"
    if static_path.exists():
        app.mount(
            "/user-static",
            StaticFiles(directory=str(static_path)),
            name="user-static",
        )

# API Routes
app.include_router(saas_register.router, prefix="/api", tags=["SaaS Registration & Subscriptions"])
app.include_router(settings_router, prefix="/api/settings", tags=["Settings"])
app.include_router(auth.router, prefix="/api", tags=["Authentication"])
app.include_router(user.router, prefix="/api", tags=["Users"])
app.include_router(room.router, prefix="/api", tags=["Rooms"])
app.include_router(packages.router, prefix="/api", tags=["Packages"])
app.include_router(frontend.router, prefix="/api", tags=["Frontend"])
app.include_router(booking.router, prefix="/api", tags=["Booking"])
app.include_router(checkout.router, prefix="/api", tags=["Checkout"])
app.include_router(dashboard.router, prefix="/api", tags=["Dashboard"])
app.include_router(employee.router, prefix="/api", tags=["Employee"])
app.include_router(expenses.router, prefix="/api", tags=["Expenses"])
app.include_router(food_category.router, prefix="/api", tags=["Food Category"])
app.include_router(food_item.router, prefix="/api", tags=["Food Items"])
app.include_router(food_orders.router, prefix="/api", tags=["Food Orders"])
# Include recipe router if it was imported successfully
if recipe_module is not None:
    try:
        app.include_router(recipe_module.router, prefix="/api", tags=["Recipes"])
        print(f"[OK] Recipe router registered with {len(recipe_module.router.routes)} routes")
        # Print all recipe routes for debugging
        for route in recipe_module.router.routes:
            if hasattr(route, 'path') and hasattr(route, 'methods'):
                methods = ', '.join(route.methods)
                print(f"   Registered: {methods} /api{route.path}")
    except Exception as e:
        print(f"[ERROR] ERROR registering recipe router: {e}")
        import traceback
        traceback.print_exc()
else:
    print("[ERROR] Recipe router not imported, skipping registration")
    print("   This means there was an import error. Check the error message above.")

app.include_router(payment.router, prefix="/api", tags=["Payment"])
app.include_router(report.router, prefix="/api", tags=["Report"])
app.include_router(reports.router, prefix="/api", tags=["Reports"])
app.include_router(role.router, prefix="/api", tags=["Role"])
app.include_router(service.router, prefix="/api", tags=["Service"])
app.include_router(branch.router, prefix="/api", tags=["Branches"])
app.include_router(service_request.router, prefix="/api", tags=["Service Requests"])
app.include_router(account.router, prefix="/api", tags=["Accounts"])
app.include_router(gst_reports.router, prefix="/api", tags=["GST Reports"])
app.include_router(reports_module.router, prefix="/api", tags=["Reports Module"])
app.include_router(attendance.router, prefix="/api", tags=["Attendance"])
app.include_router(day_audit.router, prefix="/api", tags=["Day Audit"])
app.include_router(restaurant_table.router, prefix="/api", tags=["Restaurant Tables"])
app.include_router(salary_advance.router, prefix="/api", tags=["Salary Advances"])
app.include_router(notification.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(service_report.router, prefix="/api", tags=["Service Reports"])
app.include_router(activity_logs.router, prefix="/api/activity-logs", tags=["Activity Logs"])
app.include_router(rate_plan.router, prefix="/api", tags=["RatePlans"])
app.include_router(calendar.router, prefix="/api/calendar", tags=["Calendar"])

# Channel Manager
from app.api import channel_manager
app.include_router(channel_manager.router, prefix="/api/channel-manager", tags=["Channel Manager"])


# Notification system re-enabled
app.include_router(notification.router, prefix="/api", tags=["Notifications"])
app.include_router(activity_logs.router, prefix="/api", tags=["Activity Logs"])

# Include comprehensive reports router if it was imported successfully
if comprehensive_reports is not None:
    try:
        app.include_router(comprehensive_reports.router, prefix="/api", tags=["Comprehensive Reports"])
        print(f"[OK] Comprehensive Reports router registered with {len(comprehensive_reports.router.routes)} routes")
    except Exception as e:
        print(f"[ERROR] ERROR registering comprehensive_reports router: {e}")
        import traceback
        traceback.print_exc()
else:
    print("[ERROR] Comprehensive Reports router not imported, skipping registration")

# Include inventory router if it was imported successfully
if inventory is not None:
    try:
        app.include_router(inventory.router, prefix="/api", tags=["Inventory"])
        print(f"[OK] Inventory router registered with {len(inventory.router.routes)} routes")
    except Exception as e:
        print(f"[ERROR] ERROR registering inventory router: {e}")
        import traceback
        traceback.print_exc()
else:
    print("[ERROR] Inventory router not imported, skipping registration")


# Include stock reconciliation router
# try:
#     from app.api import stock_reconciliation
#     app.include_router(stock_reconciliation.router, prefix="/api", tags=["Stock Reconciliation"])
#     print(f"[OK] Stock reconciliation router registered with {len(stock_reconciliation.router.routes)} routes")
# except Exception as e:
#     print(f"[ERROR] ERROR importing/registering stock reconciliation router: {e}")
#     import traceback
#     traceback.print_exc()

# Include public router if it was imported successfully
if public_module is not None:
    try:
        app.include_router(public_module.router, prefix="/api", tags=["Public"])
        print(f"[OK] Public router registered with {len(public_module.router.routes)} routes")
    except Exception as e:
        print(f"[ERROR] ERROR registering public router: {e}")
        import traceback
        traceback.print_exc()
else:
    print("[ERROR] Public router not imported, skipping registration")

# Include frontend router (Resort Info, Gallery, etc.)
app.include_router(frontend.router, prefix="/api", tags=["Frontend"])


# Root route - Landing Page
@app.get("/", response_class=HTMLResponse)
async def landing_page():
    """Serve the landing page at www.teqmates.com"""
    landing_file = Path("../landingpage/index.html")
    if landing_file.exists():
        return FileResponse(landing_file)
    return HTMLResponse(
        "<h1>Welcome to TeqMates Resort</h1><p>Landing page not found</p>"
    )


# Admin Dashboard route
@app.get("/admin", response_class=HTMLResponse)
@app.get("/admin/{path:path}", response_class=HTMLResponse)
async def admin_dashboard(request: Request, path: str = ""):
    """Serve the React admin dashboard at www.teqmates.com/admin"""
    dashboard_file = Path("../dasboard/build/index.html")
    if dashboard_file.exists():
        return FileResponse(dashboard_file)
    return HTMLResponse("<h1>Admin Dashboard</h1><p>Dashboard not found</p>")


# User/Resort route
@app.get("/resort", response_class=HTMLResponse)
@app.get("/resort/{path:path}", response_class=HTMLResponse)
async def user_page(request: Request, path: str = ""):
    """Serve the user interface at www.teqmates.com/resort"""
    userend_dir = Path("../userend/build").resolve()
    index_file = userend_dir / "index.html"

    if path:
        requested_path = (userend_dir / path).resolve()
        if requested_path.is_file() and userend_dir in requested_path.parents:
            return FileResponse(requested_path)

    if index_file.exists():
        return FileResponse(index_file)

    # Fallback to a simple user interface
    return HTMLResponse("""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Resort User Interface</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .container { max-width: 800px; margin: 0 auto; }
            .header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; }
            .content { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Resort User Interface</h1>
                <p>Welcome to TeqMates Resort Management</p>
            </div>
            <div class="content">
                <h2>Available Services</h2>
                <ul>
                    <li>Room Booking</li>
                    <li>Package Selection</li>
                    <li>Food Ordering</li>
                    <li>Service Requests</li>
                </ul>
                <p>Please contact the administrator to set up the user interface.</p>
            </div>
        </div>
    </body>
    </html>
    """)


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {"status": "healthy", "message": "ROOT_MAIN_ACTIVE_V4"}


# API documentation redirect
@app.get("/api-docs")
async def api_docs():
    """Redirect to API documentation"""
    return {"message": "API documentation available at /docs"}


if __name__ == "__main__":
    import uvicorn
    import os

    # Get port from environment or default to 8012 for Orchid (Avoiding 8011 conflict)
    port = int(os.getenv("PORT", 8011))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True, reload_dirs=["app"])
