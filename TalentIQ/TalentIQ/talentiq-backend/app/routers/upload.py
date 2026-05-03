"""
app/routers/upload.py
─────────────────────────────────────────────────────────────
Three upload endpoints. Each one now also takes a date/month/week
in addition to the file, and:
  1. REJECTS the upload (HTTP 409) if that exact date already exists
  2. APPENDS rows tagged with that date (does NOT delete old rows)

Frontend sends its date in these formats:
  • TA      → "YYYY-MM-DD"  (HTML <input type="date">)
  • MSD     → "YYYY-MM"     (HTML <input type="month">)
  • Bench   → "YYYY-Www"    (HTML <input type="week">, e.g. "2024-W12")
"""

import io
from datetime import date, datetime
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
import pandas as pd

from app.database import get_db
from app.models import Requisition, MsdAllocation, BenchEmployeeId
from app.schemas import UploadResponse

router = APIRouter(prefix="/api/upload", tags=["upload"])


# ── date parsers ────────────────────────────────────────────
def _parse_date(s: str) -> date:
    """Parse 'YYYY-MM-DD' from <input type='date'>."""
    try:
        return date.fromisoformat(s.strip())
    except (ValueError, AttributeError):
        raise HTTPException(400, f"Invalid date '{s}'. Expected format YYYY-MM-DD.")


def _parse_month(s: str) -> date:
    """Parse 'YYYY-MM' from <input type='month'> → first day of that month."""
    try:
        s = s.strip()
        year, month = int(s[:4]), int(s[5:7])
        return date(year, month, 1)
    except (ValueError, IndexError):
        raise HTTPException(400, f"Invalid month '{s}'. Expected format YYYY-MM.")


def _parse_iso_week(s: str) -> date:
    """Parse 'YYYY-Www' from <input type='week'> → Monday of that ISO week."""
    try:
        s = s.strip().upper()
        year, week_part = s.split("-W")
        return date.fromisocalendar(int(year), int(week_part), 1)  # day=1 = Monday
    except (ValueError, AttributeError):
        raise HTTPException(400, f"Invalid week '{s}'. Expected format YYYY-Www e.g. 2024-W12.")


# ── helpers (Excel parsing + column lookup) ──────────────────
def _read_excel(upload: UploadFile, sheet_hint: str | None = None) -> pd.DataFrame:
    try:
        content = upload.file.read()
        if upload.filename.lower().endswith(".csv"):
            return pd.read_csv(io.BytesIO(content))
        xls = pd.ExcelFile(io.BytesIO(content), engine="openpyxl")
        sheets = xls.sheet_names
        if sheet_hint:
            for s in sheets:
                if sheet_hint.lower() in s.lower():
                    return pd.read_excel(xls, sheet_name=s)
        for s in sheets:
            if "lookup" not in s.lower():
                return pd.read_excel(xls, sheet_name=s)
        return pd.read_excel(xls, sheet_name=sheets[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Could not parse file: {e}")


def _pick(row: dict, *candidates: str) -> str:
    for c in candidates:
        if c in row and pd.notna(row[c]) and str(row[c]).strip() != "":
            return str(row[c]).strip()
    norm = {str(k).lower().strip(): k for k in row.keys()}
    for c in candidates:
        target = c.lower().strip()
        if target in norm:
            v = row[norm[target]]
            if pd.notna(v) and str(v).strip() != "":
                return str(v).strip()
    return ""


def _to_int(s: str) -> int | None:
    try:
        return int(float(s)) if s != "" else None
    except (TypeError, ValueError):
        return None


# ── 1. TA Data — exact date ─────────────────────────────────
@router.post("/ta", response_model=UploadResponse)
def upload_ta(
    file: UploadFile = File(...),
    file_date: str = Form(..., description="Exact file date, format YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    parsed = _parse_date(file_date)

    # Duplicate check
    exists = db.query(Requisition.id).filter(
        Requisition.requisition_file_date == parsed
    ).first()
    if exists:
        raise HTTPException(
            status_code=409,
            detail=f"A requisition file dated {parsed.isoformat()} already exists. "
                   f"Each date can only be uploaded once.",
        )

    df = _read_excel(file, sheet_hint="req")
    rows = df.to_dict(orient="records")

    objs = []
    for r in rows:
        objs.append(Requisition(
            requisition_file_date=parsed,
            job_req_id=_pick(r, "Job_Req_ID"),
            client_name=_pick(r, "Client_Name"),
            customer_name=_pick(r, "Customer_Name"),
            project_name=_pick(r, "Project_Name"),
            status=_pick(r, "Status"),
            country=_pick(r, "Country").upper(),
            age=_to_int(_pick(r, "Age")),
            requisition_status=_pick(r, "Requisition_Status"),
            job_title=_pick(r, "Job_Title"),
            primary_skill_1=_pick(r, "Primary_Skill_1"),
            l3_skills=_pick(r, "L3_Skills"),
            grade=_pick(r, "Grade"),
            lob=_pick(r, "LOB"),
            vertical=_pick(r, "Vertical"),
            criticality=_pick(r, "Criticality"),
        ))
    db.bulk_save_objects(objs)
    db.commit()
    return UploadResponse(
        rows_inserted=len(objs),
        message=f"TA data for {parsed.isoformat()} uploaded",
        period=parsed.isoformat(),
    )


# ── 2. MSD Allocation — month ───────────────────────────────
@router.post("/msd", response_model=UploadResponse)
def upload_msd(
    file: UploadFile = File(...),
    file_month: str = Form(..., description="Allocation month, format YYYY-MM"),
    db: Session = Depends(get_db),
):
    parsed = _parse_month(file_month)

    exists = db.query(MsdAllocation.id).filter(
        MsdAllocation.allocation_month == parsed
    ).first()
    if exists:
        raise HTTPException(
            status_code=409,
            detail=f"An allocation file for month {parsed.strftime('%B %Y')} already exists. "
                   f"Each month can only be uploaded once.",
        )

    df = _read_excel(file)
    rows = df.to_dict(orient="records")

    objs = []
    for r in rows:
        emp_id = _pick(r, "Employee Id", "Employee_Id", "EmployeeId", "Emp Id", "Emp ID", "ID")
        if not emp_id:
            continue
        bench_days = _to_int(_pick(
            r, "Bench Ageing(days)", "Bench_Ageing_days", "Bench Ageing",
            "Bench Aging (days)", "Bench Aging", "Bench Days",
        ))
        objs.append(MsdAllocation(
            allocation_month=parsed,
            employee_id=emp_id,
            name=_pick(r, "Name", "Employee Name", "Full Name", "Resource Name", "Emp Name"),
            grade=_pick(r, "Grade as per HRIS", "Grade", "HRIS Grade", "Band"),
            designation=_pick(r, "Designation as per HRIS", "Designation", "Job Title", "Title", "Role"),
            onshore_offshore_label=_pick(r, "Onshore/Offshore", "Onshore Offshore", "Shore", "Location Type"),
            work_location=_pick(r, "Work Location as per HRIS", "Work Location", "Location", "City"),
            division=_pick(r, "Division", "BU", "Business Unit"),
            lob=_pick(r, "LOB as per HRIS", "LOB", "Line of Business"),
            vertical=_pick(r, "Project Vertical", "Vertical", "Practice"),
            skillsets=_pick(r, "Skillsets", "Skill Sets", "Skills"),
            l3_skill_family=_pick(r, "L3 (Skill Family)", "L3", "Skill Family", "Primary Skill"),
            l4_sub_skill=_pick(r, "L4 (Sub Skill)", "L4", "Sub Skill", "Secondary Skill"),
            bench_ageing_days=bench_days,
            project_name=_pick(r, "Project Name", "Project_Name", "Project"),
            allocation_start_date=_pick(r, "Allocation Start Date", "Start Date") or None,
        ))
    db.bulk_save_objects(objs)
    db.commit()
    return UploadResponse(
        rows_inserted=len(objs),
        message=f"MSD allocation for {parsed.strftime('%B %Y')} uploaded",
        period=parsed.strftime("%Y-%m"),
    )


# ── 3. Bench Employee IDs — week ────────────────────────────
@router.post("/bench", response_model=UploadResponse)
def upload_bench(
    file: UploadFile = File(...),
    file_week: str = Form(..., description="ISO week, format YYYY-Www e.g. 2024-W12"),
    db: Session = Depends(get_db),
):
    parsed = _parse_iso_week(file_week)

    exists = db.query(BenchEmployeeId.id).filter(
        BenchEmployeeId.bench_week_date == parsed
    ).first()
    if exists:
        # Rebuild a YYYY-Www string for the human-readable error
        iso_year, iso_week, _ = parsed.isocalendar()
        raise HTTPException(
            status_code=409,
            detail=f"A bench file for week {iso_year}-W{iso_week:02d} "
                   f"(starting {parsed.isoformat()}) already exists. "
                   f"Each week can only be uploaded once.",
        )

    df = _read_excel(file)
    rows = df.to_dict(orient="records")

    seen = set()
    objs = []
    for r in rows:
        emp_id = _pick(r, "Employee Id", "Employee_Id", "EmployeeId", "Emp ID", "Emp Id", "ID", "id")
        if emp_id and emp_id not in seen and emp_id not in ("undefined", "null"):
            seen.add(emp_id)
            objs.append(BenchEmployeeId(
                bench_week_date=parsed,
                employee_id=emp_id,
            ))
    db.bulk_save_objects(objs)
    db.commit()
    iso_year, iso_week, _ = parsed.isocalendar()
    return UploadResponse(
        rows_inserted=len(objs),
        message=f"Bench IDs for week {iso_year}-W{iso_week:02d} uploaded",
        period=f"{iso_year}-W{iso_week:02d}",
    )
