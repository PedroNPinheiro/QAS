from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Numeric, case, cast, func, select
from sqlalchemy.orm import Session

from .. import models as m
from ..database import get_db
from ..permissions import require_full_access

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

# What can be analysed per module: the date column that buckets records into
# months, the numeric metrics that can be summed (count is always available),
# and the dimensions records can be grouped by.
CONFIG = {
    "internal_nc": {
        "model": m.InternalNonConformity,
        "date": m.InternalNonConformity.date_detected,
        "metrics": {"cost": m.InternalNonConformity.cost},
        "dims": {
            "sector": m.InternalNonConformity.sector,
            "project": m.InternalNonConformity.project,
            "severity": m.InternalNonConformity.severity,
            "status": m.InternalNonConformity.status,
            "designer": m.InternalNonConformity.designer,
        },
    },
    "external_nc": {
        "model": m.ExternalNonConformity,
        "date": m.ExternalNonConformity.date_detected,
        "metrics": {"quantity": m.ExternalNonConformity.quantity},
        "dims": {
            "supplier": m.ExternalNonConformity.supplier,
            "severity": m.ExternalNonConformity.severity,
            "status": m.ExternalNonConformity.status,
            "location": m.ExternalNonConformity.location,
        },
    },
    "test_report": {
        "model": m.TestReport,
        "date": m.TestReport.test_date,
        "metrics": {},
        "dims": {
            "tested_by": m.TestReport.tested_by,
            "derogation": m.TestReport.derogation,
        },
    },
    "accident": {
        "model": m.WorkAccident,
        "date": m.WorkAccident.occurred_at,
        "metrics": {"days_lost": m.WorkAccident.days_lost, "hours_lost": m.WorkAccident.hours_lost},
        "dims": {
            "department": m.WorkAccident.department,
            "body_part": m.WorkAccident.body_part,
            "nature": m.WorkAccident.nature,
            "severity": m.WorkAccident.severity,
            "status": m.WorkAccident.status,
        },
    },
    "near_miss": {
        "model": m.NearMiss,
        "date": m.NearMiss.occurred_date,
        "metrics": {},
        "dims": {
            "event_type": m.NearMiss.event_type,
            "location": m.NearMiss.location,
            "risk_level": m.NearMiss.risk_level,
            "status": m.NearMiss.status,
        },
    },
    "waste": {
        "model": m.WasteRecord,
        "date": m.WasteRecord.collection_date,
        "metrics": {
            "quantity_kg": m.WasteRecord.quantity_kg,
            "invoiced_value": m.WasteRecord.invoiced_value,
        },
        "dims": {
            "waste_type": m.WasteRecord.waste_type,
            "operator": m.WasteRecord.operator,
            "ler_code": m.WasteRecord.ler_code,
            "hazardous": m.WasteRecord.hazardous,
        },
    },
}


def _parse_month(value: str, name: str) -> date:
    try:
        year, month = value.split("-")
        return date(int(year), int(month), 1)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail=f"{name} must be YYYY-MM")


def _next_month(d: date) -> date:
    return date(d.year + (d.month == 12), d.month % 12 + 1, 1)


def _month_range(start: date, end: date) -> list[str]:
    months, current = [], start
    while current <= end and len(months) < 240:
        months.append(f"{current.year:04d}-{current.month:02d}")
        current = _next_month(current)
    return months


@router.get("")
def analytics(
    module: str,
    date_from: str,
    date_to: str,
    metric: str = "count",
    group_by: str | None = None,
    db: Session = Depends(get_db),
    _: m.User = Depends(require_full_access),
):
    cfg = CONFIG.get(module)
    if cfg is None:
        raise HTTPException(status_code=400, detail=f"Unknown module '{module}'")
    if metric != "count" and metric not in cfg["metrics"]:
        raise HTTPException(status_code=400, detail=f"Unknown metric '{metric}' for {module}")
    dims = cfg["dims"]
    if group_by is None:
        group_by = next(iter(dims))
    if group_by not in dims:
        raise HTTPException(status_code=400, detail=f"Unknown dimension '{group_by}' for {module}")

    start = _parse_month(date_from, "date_from")
    end = _parse_month(date_to, "date_to")
    if end < start:
        start, end = end, start
    window_end = _next_month(end)

    date_col = cfg["date"]
    in_window = (date_col >= start, date_col < window_end)

    if metric == "count":
        value_expr = func.count()
    else:
        value_expr = func.coalesce(func.sum(cast(cfg["metrics"][metric], Numeric)), 0)

    # Monthly series, zero-filled
    month_expr = func.to_char(date_col, "YYYY-MM")
    rows = db.execute(
        select(month_expr, value_expr).where(*in_window).group_by(month_expr)
    ).all()
    by_month = {r[0]: float(r[1] or 0) for r in rows}
    monthly = [{"month": mo, "value": by_month.get(mo, 0.0)} for mo in _month_range(start, end)]

    # Breakdown by dimension
    BOOL_DIM_LABELS = {
        "hazardous": ("Hazardous", "Non-hazardous"),
        "derogation": ("With derogation", "No derogation"),
    }
    dim_col = dims[group_by]
    if group_by in BOOL_DIM_LABELS:
        yes, no = BOOL_DIM_LABELS[group_by]
        dim_expr = case((dim_col.is_(True), yes), else_=no)
    else:
        dim_expr = func.coalesce(dim_col, "—")
    rows = db.execute(
        select(dim_expr, value_expr, func.count())
        .where(*in_window)
        .group_by(dim_expr)
        .order_by(value_expr.desc())
    ).all()
    breakdown = [
        {"key": r[0], "value": float(r[1] or 0), "records": r[2]} for r in rows
    ]

    total_value = db.scalar(select(value_expr).where(*in_window)) or 0
    total_records = db.scalar(
        select(func.count()).select_from(cfg["model"]).where(*in_window)
    )

    return {
        "monthly": monthly,
        "breakdown": breakdown,
        "total_value": float(total_value),
        "total_records": total_records,
        "months": len(monthly),
    }
