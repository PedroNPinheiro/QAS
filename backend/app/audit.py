from datetime import date, datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from .models import AuditLog, User


def _plain(value):
    """Make a value JSON-serializable for the audit diff."""
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def diff_changes(obj, new_values: dict) -> dict:
    """Field-level diff between a record and the incoming update payload."""
    changes = {}
    for field, new in new_values.items():
        old = getattr(obj, field, None)
        if _plain(old) != _plain(new):
            changes[field] = {"from": _plain(old), "to": _plain(new)}
    return changes


def log_audit(
    db: Session,
    *,
    entity_type: str,
    entity_id: int,
    reference: str,
    action: str,
    user: User | None,
    changes: dict | None = None,
) -> None:
    db.add(
        AuditLog(
            entity_type=entity_type,
            entity_id=entity_id,
            reference=reference,
            action=action,
            user_id=user.id if user else None,
            user_name=user.full_name if user else None,
            changes=changes or None,
        )
    )
