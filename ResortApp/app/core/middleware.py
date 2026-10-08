from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
from app.database import SessionLocal
from app.models.activity_log import ActivityLog
from jose import jwt
import os
import time
import json

class ActivityLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # Only log API calls that modify data (POST, PUT, DELETE, PATCH)
        # GET/HEAD/OPTIONS requests are read-only and logging them synchronously 
        # causes significant overhead and database bloating.
        if request.url.path.startswith("/api") and request.method not in ("GET", "HEAD", "OPTIONS"):
            # Extract User info and Branch info from request state
            # request.state is populated by get_current_user dependency
            user_id = getattr(request.state, "user_id", None)
            
            # Use branch_id from state if available, else None
            branch_id = getattr(request.state, "branch_id", None)
            
            # If branch_id is "all", it should be logged as None (global activity)
            if branch_id == "all":
                branch_id = None
            
            if not user_id:
                auth_header = request.headers.get("Authorization")
                if auth_header and auth_header.startswith("Bearer "):
                    token = auth_header.split(" ")[1]
                    try:
                        SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
                        ALGORITHM = os.getenv("ALGORITHM", "HS256")
                        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                        user_id = payload.get("user_id")
                    except:
                        pass
            
            # Pre-extract data from request/response so they can be logged 
            # safely in a background thread without holding request references
            path = request.url.path
            method = request.method
            client_ip = request.client.host if request.client else "Unknown"
            user_agent = request.headers.get("user-agent")
            query_params = str(request.query_params)
            status_code = response.status_code
            
            self.log_activity_async(
                path, method, client_ip, user_agent, query_params, 
                status_code, user_id, branch_id, process_time
            )
             
        return response

    def log_activity_async(self, path, method, client_ip, user_agent, query_params, status_code, user_id, branch_id, process_time):
        import threading
        
        def run():
            try:
                db = SessionLocal()
                
                # Simple mapping for better readability
                action_map = {
                    "POST": "Created/Added",
                    "GET": "Viewed/List",
                    "PUT": "Updated/Modified",
                    "PATCH": "Updated/Modified",
                    "DELETE": "Removed/Deleted"
                }
                
                friendly_action = f"{action_map.get(method, method)} {path.split('/')[-1].replace('-', ' ').title()}"
                if "login" in path: friendly_action = "User Login Attempt"
                if "logout" in path: friendly_action = "User Logout"
                
                log = ActivityLog(
                    user_id=int(user_id) if user_id else None,
                    action=friendly_action,
                    method=method,
                    path=path,
                    status_code=status_code,
                    client_ip=client_ip,
                    details=json.dumps({
                        "process_time_ms": round(process_time * 1000, 2),
                        "user_agent": user_agent,
                        "query_params": query_params
                    }),
                    branch_id=branch_id if branch_id else None
                )
                db.add(log)
                db.commit()
                db.close()
            except Exception as e:
                print(f"Logging failed: {e}")
                
        threading.Thread(target=run, daemon=True).start()

