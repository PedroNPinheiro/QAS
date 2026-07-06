from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import Numeric, case, cast, func, select
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..permissions import require_full_access

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

# (key, model, date column used for trends, "closed" status value)
TREND_MODULES = (
    ("internal_nc", models.InternalNonConformity, models.InternalNonConformity.date_detected, "closed"),
    ("external_nc", models.ExternalNonConformity, models.ExternalNonConformity.date_detected, "closed"),
    ("accidents", models.WorkAccident, models.WorkAccident.occurred_at, "closed"),
    ("near_misses", models.NearMiss, models.NearMiss.occurred_date, "concluded"),
)


def _month_keys(months: int = 12) -> list[str]:
    today = date.today().replace(day=1)
    keys = []
    for i in range(months - 1, -1, -1):
        y, m = divmod(today.year * 12 + today.month - 1 - i, 12)
        keys.append(f"{y:04d}-{m + 1:02d}")
    return keys


@router.get("/summary")
def summary(db: Session = Depends(get_db), _: models.User = Depends(require_full_access)):
    year_start = date(date.today().year, 1, 1)
    months = _month_keys(12)
    window_start = date(int(months[0][:4]), int(months[0][5:]), 1)

    kpis = {}
    for key, model, date_col, closed_value in TREND_MODULES:
        total = db.scalar(select(func.count()).select_from(model))
        open_count = db.scalar(
            select(func.count()).select_from(model).where(model.status != closed_value)
        )
        year_count = db.scalar(
            select(func.count()).select_from(model).where(date_col >= year_start)
        )
        kpis[key] = {"total": total, "open": open_count, "year": year_count}

    kpis["near_misses"]["delayed"] = db.scalar(
        select(func.count())
        .select_from(models.NearMiss)
        .where(models.NearMiss.status == "delayed")
    )

    waste_kg_year = db.scalar(
        select(func.coalesce(func.sum(cast(models.WasteRecord.quantity_kg, Numeric)), 0)).where(
            models.WasteRecord.collection_date >= year_start
        )
    )
    waste_value_year = db.scalar(
        select(func.coalesce(func.sum(cast(models.WasteRecord.invoiced_value, Numeric)), 0)).where(
            models.WasteRecord.collection_date >= year_start
        )
    )
    kpis["waste"] = {
        "total": db.scalar(select(func.count()).select_from(models.WasteRecord)),
        "year": db.scalar(
            select(func.count())
            .select_from(models.WasteRecord)
            .where(models.WasteRecord.collection_date >= year_start)
        ),
        "kg_year": float(waste_kg_year or 0),
        "value_year": float(waste_value_year or 0),
    }

    # Days without accident
    last_accident = db.scalar(select(func.max(models.WorkAccident.occurred_at)))
    days_without_accident = None
    if last_accident is not None:
        if last_accident.tzinfo is None:
            last_accident = last_accident.replace(tzinfo=timezone.utc)
        days_without_accident = max(0, (datetime.now(timezone.utc) - last_accident).days)

    # Monthly counts per module over the last 12 months
    monthly = {m: {"month": m} for m in months}
    for key, model, date_col, _closed in TREND_MODULES:
        month_expr = func.to_char(date_col, "YYYY-MM")
        rows = db.execute(
            select(month_expr, func.count())
            .where(date_col >= window_start)
            .group_by(month_expr)
        ).all()
        counts = dict(rows)
        for m in months:
            monthly[m][key] = counts.get(m, 0)

    # Monthly waste in kg, hazardous vs non-hazardous
    kg_expr = func.sum(cast(models.WasteRecord.quantity_kg, Numeric))
    month_expr = func.to_char(models.WasteRecord.collection_date, "YYYY-MM")
    waste_rows = db.execute(
        select(
            month_expr,
            kg_expr.filter(models.WasteRecord.hazardous.is_(True)),
            kg_expr.filter(models.WasteRecord.hazardous.is_(False)),
        )
        .where(models.WasteRecord.collection_date >= window_start)
        .group_by(month_expr)
    ).all()
    waste_by_month = {r[0]: r for r in waste_rows}
    waste_monthly = []
    for m in months:
        row = waste_by_month.get(m)
        waste_monthly.append(
            {
                "month": m,
                "hazardous_kg": float(row[1] or 0) if row else 0.0,
                "non_hazardous_kg": float(row[2] or 0) if row else 0.0,
            }
        )

    # Open NCs by severity (internal + external)
    severity = {"minor": 0, "major": 0, "critical": 0}
    for model in (models.InternalNonConformity, models.ExternalNonConformity):
        rows = db.execute(
            select(model.severity, func.count())
            .where(model.status != "closed")
            .group_by(model.severity)
        ).all()
        for sev, count in rows:
            severity[sev] = severity.get(sev, 0) + count

    return {
        "kpis": kpis,
        "days_without_accident": days_without_accident,
        "monthly": [monthly[m] for m in months],
        "waste_monthly": waste_monthly,
        "open_nc_by_severity": severity,
    }
