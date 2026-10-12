from app.utils.timezone import get_system_timezone
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from sqlalchemy.orm import Session
from sqlalchemy import func

from typing import List, Optional, Any, Dict
from datetime import date, time, datetime, timedelta
import datetime as dt
from pydantic import BaseModel
import pytz

from calendar import monthrange
from app.utils.auth import get_db, get_current_user
from app.models.employee import Attendance, WorkingLog, Employee, Leave, EmployeeLocationHistory
from app.models.salary_advance import SalaryAdvance
from app.models.settings import SystemSetting
from app.models.user import User
from app.utils.branch_scope import get_branch_id
from app.utils.date_utils import get_ist_now, get_ist_today
import json
import os
import shutil

router = APIRouter(prefix="/attendance", tags=["Attendance"])

# --- Pydantic Schemas ---
class AttendanceRecord(BaseModel):
    id: int
    date: date
    status: str
    class Config: from_attributes = True

class WorkingLogRecord(BaseModel):
    id: int
    employee_id: int
    date: date
    check_in_time: Optional[time]
    check_out_time: Optional[time]
    location: Optional[str]
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    duration_hours: Optional[float] = None
    completed_tasks: Optional[str] = None
    is_tasks_approved: int = 0
    tasks_approved_by_id: Optional[int] = None
    tasks_approved_at: Optional[datetime] = None
    clock_in_image: Optional[str] = None
    clock_out_image: Optional[str] = None
    class Config: from_attributes = True

class TasksUpdate(BaseModel):
    completed_tasks: str

class AttendanceCreate(BaseModel):
    employee_id: int
    date: date
    status: str
    leave_type: Optional[str] = 'Paid'

class WorkingLogCreate(BaseModel):
    employee_id: int
    date: date
    check_in_time: Optional[time] = None
    check_out_time: Optional[time] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class WorkingLogUpdate(BaseModel):
    check_in_time: Optional[time] = None
    check_out_time: Optional[time] = None
    date: Optional[dt.date] = None
    location: Optional[str] = None

class HolidayItem(BaseModel):
    date: str
    name: str

class UtilizationRecord(BaseModel):
    month: str
    hours: float

class TodayStatus(BaseModel):
    on_leave: int
    active_today: int
    currently_online: int

class MonthlyReport(BaseModel):
    month: int
    year: int
    total_days: int
    present_days: int      # Full day: >= 8 hrs
    half_days: int         # Half day: 4-8 hrs
    partial_days: int      # Partial: > 0 and < 4 hrs (only hours count)
    absent_days: float
    paid_leaves_taken: int
    sick_leaves_taken: int
    unpaid_leaves: float
    unused_paid_leaves: int    # Unused monthly paid leaves
    leave_encashment_amount: float # Extra salary credited for unused leaves
    total_paid_leaves_year: int
    total_sick_leaves_year: int
    paid_leave_balance: int
    sick_leave_balance: int
    base_salary: float
    deductions: float
    advance_deductions: float  # Total salary advances to be deducted this month
    advance_count: int         # Number of advance records for this month
    net_salary: float

class ClockInCreate(BaseModel):
    employee_id: int
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class ClockOutCreate(BaseModel):
    employee_id: int

# --- API Endpoints ---

@router.post("/mark", response_model=AttendanceRecord)
def mark_attendance(record: AttendanceCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), branch_id: int = Depends(get_branch_id)):
    data = record.model_dump()
    data['branch_id'] = branch_id
    db_record = Attendance(**data)
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record

@router.post("/log-work", response_model=WorkingLogRecord)
def log_working_hours(log: WorkingLogCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), branch_id: int = Depends(get_branch_id)):
    role_lower = (current_user.role.name.lower() if current_user.role else "").strip()
    if not (getattr(current_user, 'is_superadmin', False) or any(k in role_lower for k in ['super_admin', 'superadmin', 'admin', 'manager', 'owner'])):
        raise HTTPException(status_code=403, detail="Only admins or managers can log work hours manually.")

    data = log.model_dump()
    data['branch_id'] = branch_id
    db_log = WorkingLog(**data)
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    
    log_data = WorkingLogRecord.model_validate(db_log)
    log_data.duration_hours = _calculate_duration(db_log.date, db_log.check_in_time, db_log.check_out_time)
    return log_data

@router.post("/clock-in", response_model=WorkingLogRecord)
def clock_in(
    employee_id: int = Form(...),
    location: str = Form(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user), 
    branch_id: int = Depends(get_branch_id)
):
    try:
        # Use Indian Standard Time (IST)
        ist = get_system_timezone()
        now = datetime.now(ist)
        
        # Auto clock-out any open clock-ins from previous days
        from datetime import time as dt_time
        previous_open_logs = db.query(WorkingLog).filter(
            WorkingLog.employee_id == employee_id,
            WorkingLog.date < now.date(),
            WorkingLog.check_out_time.is_(None)
        ).all()
        
        for log in previous_open_logs:
            # Auto clock-out at 6:00 PM (18:00) of that log's date
            log.check_out_time = dt_time(18, 0, 0)
        if previous_open_logs:
            db.commit()

        # Check if there's an open clock-in for this employee today
        open_log = db.query(WorkingLog).filter(
            WorkingLog.employee_id == employee_id,
            WorkingLog.date == now.date(),
            WorkingLog.check_out_time.is_(None)
        ).first()

        if open_log:
            raise HTTPException(status_code=400, detail="Employee is already clocked in. Please clock out first.")

        image_url = None
        if image and image.filename:
            upload_folder = os.path.join("uploads", "attendance")
            os.makedirs(upload_folder, exist_ok=True)
            file_extension = os.path.splitext(image.filename)[1]
            file_name = f"in_{employee_id}_{get_ist_now().strftime('%Y%m%d%H%M%S')}{file_extension}"
            file_path = os.path.join(upload_folder, file_name)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(image.file, buffer)
            image_url = file_path.replace("\\", "/")

        new_log = WorkingLog(
            employee_id=employee_id,
            date=now.date(),
            check_in_time=now.time(),
            location=location,
            latitude=latitude,
            longitude=longitude,
            clock_in_image=image_url,
            branch_id=branch_id
        )
        db.add(new_log)
        db.commit()
        db.refresh(new_log)
        return new_log
    except Exception as e:
        import traceback
        print(f"ERROR: Clock-in failed for employee {employee_id}: {str(e)}")
        traceback.print_exc()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Internal Server Error during clock-in: {str(e)}")

@router.post("/clock-out", response_model=WorkingLogRecord)
def clock_out(
    employee_id: int = Form(...),
    completed_tasks: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user), 
    branch_id: int = Depends(get_branch_id)
):
    # Use Indian Standard Time (IST)
    ist = get_system_timezone()
    now = datetime.now(ist)
    
    # Find the last open clock-in for this employee in this branch
    query = db.query(WorkingLog).filter(
        WorkingLog.employee_id == employee_id, 
        WorkingLog.check_out_time.is_(None)
    )
    if branch_id is not None:
        query = query.filter(WorkingLog.branch_id == branch_id)
        
    log_to_close = query.order_by(WorkingLog.check_in_time.desc()).first()

    if not log_to_close:
        raise HTTPException(status_code=404, detail="No open clock-in found to clock out.")
        
    # Update tasks if provided
    if completed_tasks is not None:
        log_to_close.completed_tasks = completed_tasks

    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if employee and employee.daily_tasks:
        try:
            assigned_tasks = json.loads(employee.daily_tasks)
            if not isinstance(assigned_tasks, list):
                assigned_tasks = [employee.daily_tasks]
        except:
            assigned_tasks = [employee.daily_tasks]
            
        if assigned_tasks:
            try:
                tasks_done = json.loads(log_to_close.completed_tasks or "[]")
            except:
                tasks_done = []
                
            all_completed = all(task in tasks_done for task in assigned_tasks)
            if not all_completed:
                raise HTTPException(status_code=400, detail="Please complete all assigned active shift tasks before clocking out.")

    image_url = None
    if image and image.filename:
        upload_folder = os.path.join("uploads", "attendance")
        os.makedirs(upload_folder, exist_ok=True)
        file_extension = os.path.splitext(image.filename)[1]
        file_name = f"out_{employee_id}_{get_ist_now().strftime('%Y%m%d%H%M%S')}{file_extension}"
        file_path = os.path.join(upload_folder, file_name)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        image_url = file_path.replace("\\", "/")
        log_to_close.clock_out_image = image_url

    log_to_close.check_out_time = now.time()
    
    # If clocking out on a different day, update the date to the check-out date
    if log_to_close.date != now.date():
        log_to_close.date = now.date()

    db.commit()
    db.refresh(log_to_close)
    
    # Calculate duration hours for the response
    log_data = WorkingLogRecord.model_validate(log_to_close)
    log_data.duration_hours = _calculate_duration(log_to_close.date, log_to_close.check_in_time, log_to_close.check_out_time)
            
    return log_data

def _calculate_duration(log_date, check_in_time, check_out_time):
    if not check_in_time or not check_out_time:
        return None
    start_dt = datetime.combine(log_date, check_in_time)
    end_dt = datetime.combine(log_date, check_out_time)
    if end_dt < start_dt:
        end_dt += timedelta(days=1)
    return (end_dt - start_dt).total_seconds() / 3600

class LiveLocationUpdate(BaseModel):
    employee_id: int
    latitude: float
    longitude: float

@router.post("/update-live-location")
def update_live_location(
    update: LiveLocationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    employee = db.query(Employee).filter(Employee.id == update.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    employee.latitude = update.latitude
    employee.longitude = update.longitude
    employee.last_location_update = datetime.utcnow()
    
    history_entry = EmployeeLocationHistory(
        employee_id=update.employee_id,
        latitude=update.latitude,
        longitude=update.longitude,
        timestamp=datetime.utcnow()
    )
    db.add(history_entry)
    db.commit()
    
    return {"status": "success", "message": "Live location updated"}

@router.get("/work-logs/date/{log_date}", response_model=List[WorkingLogRecord])
def get_work_logs_by_date(log_date: date, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), branch_id: int = Depends(get_branch_id)):
    try:
        query = db.query(WorkingLog).filter(WorkingLog.date == log_date)
        if branch_id is not None:
            query = query.filter(WorkingLog.branch_id == branch_id)
        work_logs = query.all()
        results = []
        for log in work_logs:
            duration_hours = _calculate_duration(log.date, log.check_in_time, log.check_out_time)
            try:
                log_data = WorkingLogRecord.model_validate(log)
                log_data.duration_hours = duration_hours
                results.append(log_data)
            except Exception as validation_error:
                continue
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/work-logs/{employee_id}", response_model=List[WorkingLogRecord])
def get_work_logs_for_employee(employee_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), branch_id: int = Depends(get_branch_id)):
    try:
        query = db.query(WorkingLog).filter(WorkingLog.employee_id == employee_id)
        if branch_id is not None:
            query = query.filter(WorkingLog.branch_id == branch_id)
            
        work_logs = query.order_by(WorkingLog.date.desc(), WorkingLog.check_in_time.desc()).all()
        
        results = []
        for log in work_logs:
            duration_hours = _calculate_duration(log.date, log.check_in_time, log.check_out_time)
            try:
                log_data = WorkingLogRecord.model_validate(log)
                log_data.duration_hours = duration_hours
                results.append(log_data)
            except Exception as validation_error:
                print(f"Validation error for log {log.id}: {validation_error}")
                continue # Skip invalid records instead of crashing
            
        return results
    except Exception as e:
        import traceback
        print(f"ERROR: Fetching work logs failed for employee {employee_id}: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error fetching work logs: {str(e)}")

@router.put("/work-logs/{log_id}/tasks", response_model=WorkingLogRecord)
def update_completed_tasks(log_id: int, tasks_update: TasksUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    log = db.query(WorkingLog).filter(WorkingLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Working log not found")
        
    log.completed_tasks = tasks_update.completed_tasks
    db.commit()
    db.refresh(log)
    
    # Needs to match WorkingLogRecord output logic
    log_data = WorkingLogRecord.model_validate(log)
    log_data.duration_hours = _calculate_duration(log.date, log.check_in_time, log.check_out_time)
    
    return log_data

@router.put("/work-logs/{log_id}", response_model=WorkingLogRecord)
def update_working_log(log_id: int, log_update: WorkingLogUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _role = current_user.role.name.lower().replace(' ', '_').replace('-', '_')
    if not (getattr(current_user, "is_superadmin", False) or _role in ['super_admin', 'superadmin']):
        raise HTTPException(status_code=403, detail="Only super administrators can edit clock in/out times.")
        
    db_log = db.query(WorkingLog).filter(WorkingLog.id == log_id).first()
    if not db_log:
        raise HTTPException(status_code=404, detail="Working log not found")
        
    update_data = log_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_log, key, value)
        
    db.commit()
    db.refresh(db_log)
    
    log_data = WorkingLogRecord.model_validate(db_log)
    log_data.duration_hours = _calculate_duration(db_log.date, db_log.check_in_time, db_log.check_out_time)
    return log_data

@router.post("/work-logs/{log_id}/approve", response_model=WorkingLogRecord)
def approve_working_log_tasks(log_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Restrict to admins/managers (handle all common role name formats)
    _role = (current_user.role.name.lower() if current_user.role else "").replace(' ', '_').replace('-', '_')
    if not (getattr(current_user, "is_superadmin", False) or any(k in _role for k in ['super_admin', 'superadmin', 'admin', 'manager', 'owner'])):
        raise HTTPException(status_code=403, detail="Only admins or managers can approve tasks.")
        
    log = db.query(WorkingLog).filter(WorkingLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Working log not found")
        
    log.is_tasks_approved = 1 # Approved
    log.tasks_approved_by_id = current_user.id
    log.tasks_approved_at = get_ist_now()
    
    db.commit()
    db.refresh(log)
    
    log_data = WorkingLogRecord.model_validate(log)
    log_data.duration_hours = _calculate_duration(log.date, log.check_in_time, log.check_out_time)
    return log_data

@router.get("/monthly-report/{employee_id}", response_model=MonthlyReport)
def get_monthly_report(employee_id: int, year: int, month: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), branch_id: int = Depends(get_branch_id)):
    query = db.query(Employee).filter(Employee.id == employee_id)
    if branch_id is not None:
        query = query.filter(Employee.branch_id == branch_id)
    
    employee = query.first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # --- Date and Day Calculations ---
    _, total_days_in_month = monthrange(year, month)
    start_of_month = date(year, month, 1)
    end_of_month = date(year, month, total_days_in_month)

    # Calculate present days based on duration (>= 4 hours)
    working_logs_q = db.query(WorkingLog).filter(
        WorkingLog.employee_id == employee_id,
        WorkingLog.date >= start_of_month,
        WorkingLog.date <= end_of_month
    )
    if branch_id is not None:
        working_logs_q = working_logs_q.filter(WorkingLog.branch_id == branch_id)
        
    working_logs = working_logs_q.all()
    
    daily_hours = {}
    for log in working_logs:
        # Only count completed sessions (both clock-in and clock-out exist)
        duration = _calculate_duration(log.date, log.check_in_time, log.check_out_time) or 0
        d_str = str(log.date)
        daily_hours[d_str] = daily_hours.get(d_str, 0) + duration
        
    # Three-tier attendance classification:
    #   >= 8 hrs  -> Full Day (1.0 present day)
    #   4-8 hrs   -> Half Day (0.5 present day)
    #   0-4 hrs   -> Partial  (only the actual hours count, i.e. hours/8 of a day)
    present_days = sum(1 for hours in daily_hours.values() if hours >= 8)
    half_days    = sum(1 for hours in daily_hours.values() if 4 <= hours < 8)
    partial_days = sum(1 for hours in daily_hours.values() if 0 < hours < 4)
    partial_hours_total = sum(hours for hours in daily_hours.values() if 0 < hours < 4)

    # --- Leave Calculation for the Month ---
    approved_leaves_q = db.query(Leave).filter(
        Leave.employee_id == employee_id,
        Leave.status == 'approved',
        Leave.from_date <= end_of_month,
        Leave.to_date >= start_of_month
    )
    if branch_id is not None:
        approved_leaves_q = approved_leaves_q.filter(Leave.branch_id == branch_id)
        
    approved_leaves_month = approved_leaves_q.all()

    paid_leaves_taken_month = 0
    sick_leaves_taken_month = 0
    for leave in approved_leaves_month:
        # Calculate overlap with the current month
        overlap_start = max(leave.from_date, start_of_month)
        overlap_end = min(leave.to_date, end_of_month)
        if overlap_end >= overlap_start:
            leave_days_in_month = (overlap_end - overlap_start).days + 1
            if leave.leave_type == 'Paid':
                paid_leaves_taken_month += leave_days_in_month
            elif leave.leave_type == 'Sick':
                sick_leaves_taken_month += leave_days_in_month

    # --- Leave Balance Calculation for the Year ---
    policy_row = db.query(SystemSetting).filter(SystemSetting.key == "leave_policy").first()
    policy = json.loads(policy_row.value) if policy_row else {
        "paid_leave_monthly": 4,
        "paid_leave_yearly": 48,
        "sick_leave_monthly": 1,
        "sick_leave_yearly": 12,
    }

    # Robust handling for missing join_date
    if employee.join_date:
        months_of_service = (get_ist_today().year - employee.join_date.year) * 12 + get_ist_today().month - employee.join_date.month + 1
    else:
        # Fallback if join_date is missing
        months_of_service = 1 # Assume at least 1 month
    
    # Calculate accrued leaves based on monthly rate, capped by yearly max
    accrued_paid = months_of_service * policy.get("paid_leave_monthly", 4)
    total_paid_leaves_year = min(accrued_paid, policy.get("paid_leave_yearly", 48))
    
    accrued_sick = months_of_service * policy.get("sick_leave_monthly", 1)
    total_sick_leaves_year = min(accrued_sick, policy.get("sick_leave_yearly", 12))

    approved_leaves_year = db.query(Leave).filter(Leave.employee_id == employee_id, Leave.status == 'approved').all()
    paid_leaves_used_year = sum([(l.to_date - l.from_date).days + 1 for l in approved_leaves_year if l.leave_type == 'Paid'])
    sick_leaves_used_year = sum([(l.to_date - l.from_date).days + 1 for l in approved_leaves_year if l.leave_type == 'Sick'])

    # --- Final Report ---
    # Effective present days:
    #   Full days  = present_days × 1.0
    #   Half days  = half_days × 0.5
    #   Partial    = partial_hours_total / 8  (only actual hours credit, rest is absent)
    effective_present = present_days + (half_days * 0.5) + (partial_hours_total / 8)
    absent_days = total_days_in_month - effective_present - paid_leaves_taken_month - sick_leaves_taken_month
    unpaid_leaves = max(0.0, absent_days)

    # --- Salary Calculation ---
    base_salary = employee.salary or 0.0
    per_day_salary = base_salary / total_days_in_month if total_days_in_month > 0 else 0.0
    deductions = per_day_salary * unpaid_leaves
    
    # Leave Encashment: if employee has not used their monthly paid leave, add the amount to their salary
    paid_leave_limit = policy.get("paid_leave_monthly", 4)
    unused_paid_leaves = max(0, paid_leave_limit - paid_leaves_taken_month)
    leave_encashment_amount = per_day_salary * unused_paid_leaves

    # Salary Advances deductible this month (both pending and already deducted for this target month)
    advances = db.query(SalaryAdvance).filter(
        SalaryAdvance.employee_id == employee_id,
        SalaryAdvance.deduct_year == year,
        SalaryAdvance.deduct_month == month
    ).all()
    advance_deductions = sum(a.amount for a in advances)
    advance_count = len(advances)
    
    net_salary = base_salary - deductions + leave_encashment_amount - advance_deductions


    return MonthlyReport(
        month=month, year=year, total_days=total_days_in_month,
        present_days=present_days,
        half_days=half_days,
        partial_days=partial_days,
        absent_days=round(unpaid_leaves, 2),
        paid_leaves_taken=paid_leaves_taken_month,
        sick_leaves_taken=sick_leaves_taken_month,
        unpaid_leaves=round(unpaid_leaves, 2),
        unused_paid_leaves=unused_paid_leaves,
        leave_encashment_amount=round(leave_encashment_amount, 2),
        total_paid_leaves_year=total_paid_leaves_year,
        total_sick_leaves_year=total_sick_leaves_year,
        paid_leave_balance=total_paid_leaves_year - paid_leaves_used_year,
        sick_leave_balance=total_sick_leaves_year - sick_leaves_used_year,
        base_salary=base_salary, deductions=round(deductions, 2),
        advance_deductions=round(advance_deductions, 2),
        advance_count=advance_count,
        net_salary=round(net_salary, 2)
    )


@router.get("/utilization/aggregate", response_model=List[UtilizationRecord])
def get_aggregate_utilization(db: Session = Depends(get_db), current_user: Any = Depends(get_current_user), branch_id: int = Depends(get_branch_id)):
    """Calculates aggregate working hours per month for the last 12 months for all staff."""
    now = get_ist_now()
    results = []
    for i in range(11, -1, -1):
        # Calculate month and year correctly
        m = (now.month - i - 1) % 12 + 1
        y = now.year + (now.month - i - 1) // 12
        
        start_date = date(y, m, 1)
        _, last_day = monthrange(y, m)
        end_date = date(y, m, last_day)
        
        query = db.query(WorkingLog).filter(
            WorkingLog.date >= start_date,
            WorkingLog.date <= end_date
        )
        if branch_id is not None:
            query = query.filter(WorkingLog.branch_id == branch_id)
            
        logs = query.all()
        
        total_month_hours = 0
        for log in logs:
            duration = _calculate_duration(log.date, log.check_in_time, log.check_out_time) or 0
            total_month_hours += duration
        
        results.append({
            "month": start_date.strftime("%b"),
            "hours": round(total_month_hours, 1)
        })
    return results

@router.get("/holidays", response_model=List[HolidayItem])
def get_holidays(db: Session = Depends(get_db)):
    """Retrieves the institutional calendar (holidays) from system settings."""
    setting = db.query(SystemSetting).filter(SystemSetting.key == "institutional_calendar").first()
    if not setting:
        # Default holidays if none set
        defaults = [
            {"date": "DEC 25", "name": "Christmas"},
            {"date": "JAN 01", "name": "New Year"},
            {"date": "JAN 26", "name": "Republic Day"}
        ]
        return defaults
    try:
        data = json.loads(setting.value)
        if isinstance(data, list):
            # Filtering to ensure each item has the required fields
            return [item for item in data if isinstance(item, dict) and "date" in item and "name" in item]
        return []
    except:
        return []

@router.post("/holidays")
def update_holidays(holidays: List[HolidayItem], db: Session = Depends(get_db), current_user: Any = Depends(get_current_user)):
    """Updates the institutional calendar (holidays) in system settings."""
    setting = db.query(SystemSetting).filter(SystemSetting.key == "institutional_calendar").first()
    holidays_data = [h.model_dump() for h in holidays]
    if not setting:
        setting = SystemSetting(key="institutional_calendar", value=json.dumps(holidays_data), description="Institutional Calendar Holidays")
        db.add(setting)
    else:
        setting.value = json.dumps(holidays_data)
    db.commit()
    return {"message": "Holidays updated successfully"}

@router.get("/status/today", response_model=TodayStatus)
def get_today_status(db: Session = Depends(get_db), current_user: Any = Depends(get_current_user), branch_id: int = Depends(get_branch_id)):
    """Returns the count of employees on leave and active today."""
    today = get_ist_today().date()
    yesterday = today - timedelta(days=1)
    
    # Employees on leave today
    query_leave = db.query(func.count(Leave.id)).filter(
        Leave.status == 'approved',
        Leave.from_date <= today,
        Leave.to_date >= today
    )
    if branch_id is not None:
        query_leave = query_leave.filter(Leave.branch_id == branch_id)
    on_leave_count = query_leave.scalar() or 0
    
    # Active today (have any activity today OR currently clocked in)
    query_active = db.query(func.count(func.distinct(WorkingLog.employee_id))).filter(
        (WorkingLog.date == today) | (WorkingLog.check_out_time.is_(None) & (WorkingLog.date >= yesterday))
    )
    if branch_id is not None:
        query_active = query_active.filter(WorkingLog.branch_id == branch_id)
    active_count = query_active.scalar() or 0
    
    # Currently online (clocked in and not clocked out - include overnight shifts)
    query_online = db.query(func.count(func.distinct(WorkingLog.employee_id))).filter(
        WorkingLog.check_out_time.is_(None),
        WorkingLog.date >= yesterday
    )
    if branch_id is not None:
        query_online = query_online.filter(WorkingLog.branch_id == branch_id)
    online_count = query_online.scalar() or 0
    
    return {
        "on_leave": on_leave_count,
        "active_today": active_count,
        "currently_online": online_count
    }

@router.get("/{employee_id}", response_model=List[AttendanceRecord])
def get_attendance_for_employee(employee_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), branch_id: int = Depends(get_branch_id)):
    query = db.query(Attendance).filter(Attendance.employee_id == employee_id)
    if branch_id is not None:
        query = query.filter(Attendance.branch_id == branch_id)
    return query.order_by(Attendance.date.desc()).all()
