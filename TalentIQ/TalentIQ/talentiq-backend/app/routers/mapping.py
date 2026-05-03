"""
app/routers/mapping.py
─────────────────────────────────────────────────────────────
Skill mapping endpoints. ALL reads are filtered to the latest
period of each respective table:
  • requisitions       → MAX(requisition_file_date)
  • msd_allocations    → MAX(allocation_month)
  • bench_employee_ids → MAX(bench_week_date)

The backend may have many older snapshots; the frontend sees
only the most recent.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Requisition, MsdAllocation, BenchEmployeeId
from app.processors import (
    extract_positions,
    build_bench_resources,
    get_match_score,
    is_grade_match,
)

router = APIRouter(prefix="/api", tags=["mapping"])


# ── helpers to fetch latest snapshots ───────────────────────
def _latest_requisitions(db: Session, status: str | None = None):
    latest = db.query(func.max(Requisition.requisition_file_date)).scalar()
    if latest is None:
        return []
    q = db.query(Requisition).filter(Requisition.requisition_file_date == latest)
    if status:
        q = q.filter(Requisition.status == status)
    return q.all()


def _latest_msd(db: Session):
    latest = db.query(func.max(MsdAllocation.allocation_month)).scalar()
    if latest is None:
        return []
    return db.query(MsdAllocation).filter(
        MsdAllocation.allocation_month == latest
    ).all()


def _latest_bench_ids(db: Session) -> list[str]:
    latest = db.query(func.max(BenchEmployeeId.bench_week_date)).scalar()
    if latest is None:
        return []
    rows = db.query(BenchEmployeeId).filter(
        BenchEmployeeId.bench_week_date == latest
    ).all()
    return [r.employee_id for r in rows]


# ── endpoints ───────────────────────────────────────────────
@router.get("/positions")
def get_positions(db: Session = Depends(get_db)):
    return extract_positions(_latest_requisitions(db, status="Open"))


@router.get("/bench-resources")
def get_bench_resources(db: Session = Depends(get_db)):
    return build_bench_resources(_latest_msd(db), _latest_bench_ids(db))


@router.get("/matches/{position_id}")
def get_matches_for_position(position_id: str, db: Session = Depends(get_db)):
    """Ranked bench-resource matches for a single open position."""
    open_reqs = _latest_requisitions(db, status="Open")
    pos_row = next((r for r in open_reqs if r.job_req_id == position_id), None)
    if not pos_row:
        raise HTTPException(404, "Position not found in latest snapshot")

    position = extract_positions([pos_row])[0]
    resources = build_bench_resources(_latest_msd(db), _latest_bench_ids(db))

    matches = []
    for res in resources:
        ms = get_match_score(position["skills"], res["skills"])
        matches.append({
            "resource": res,
            "score": ms["score"],
            "matched": ms["matched"],
            "total": ms["total"],
            "grade_compatible": is_grade_match(position["grade"], res["grade"]),
        })
    matches.sort(key=lambda m: (m["score"], m["grade_compatible"]), reverse=True)
    return {"position": position, "matches": matches}


@router.get("/all-matches")
def get_all_matches(min_score: int = 40, db: Session = Depends(get_db)):
    """Bulk endpoint — every open position with all bench matches above min_score."""
    positions = extract_positions(_latest_requisitions(db, status="Open"))
    resources = build_bench_resources(_latest_msd(db), _latest_bench_ids(db))

    out = []
    for position in positions:
        matches = []
        for res in resources:
            ms = get_match_score(position["skills"], res["skills"])
            if ms["score"] < min_score:
                continue
            matches.append({
                "resource_id": res["id"],
                "resource_name": res["name"],
                "score": ms["score"],
                "matched": ms["matched"],
                "total": ms["total"],
                "grade_compatible": is_grade_match(position["grade"], res["grade"]),
            })
        matches.sort(key=lambda m: m["score"], reverse=True)
        out.append({"position": position, "matches": matches})
    return out
