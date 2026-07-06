from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .. import models
from ..auth import get_current_user, require_admin
from ..database import get_db
from ..schemas import AuditRead, Page

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/record/{entity_type}/{entity_id}", response_model=list[AuditRead])
def record_history(
    entity_type: str,
    entity_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    return db.scalars(
        select(models.AuditLog)
        .where(
            models.AuditLog.entity_type == entity_type,
            models.AuditLog.entity_id == entity_id,
        )
        .order_by(models.AuditLog.created_at.desc())
        .limit(200)
    ).all()


@router.get("", response_model=Page[AuditRead], dependencies=[Depends(require_admin)])
def audit_log(
    q: str | None = None,
    action: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    stmt = select(models.AuditLog)
    if q:
        stmt = stmt.where(
            or_(
                models.AuditLog.reference.ilike(f"%{q}%"),
                models.AuditLog.user_name.ilike(f"%{q}%"),
            )
        )
    if action:
        stmt = stmt.where(models.AuditLog.action == action)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    items = db.scalars(
        stmt.order_by(models.AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return Page(items=items, total=total, page=page, page_size=page_size)
