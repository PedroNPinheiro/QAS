from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models
from ..auth import require_admin
from ..database import get_db
from ..permissions import MODULE_TEAMS
from ..schemas import NotificationRecipientCreate, NotificationRecipientRead

router = APIRouter(
    prefix="/api/notifications",
    tags=["notifications"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=list[NotificationRecipientRead])
def list_recipients(db: Session = Depends(get_db)):
    return db.scalars(
        select(models.NotificationRecipient).order_by(
            models.NotificationRecipient.entity_type, models.NotificationRecipient.email
        )
    ).all()


@router.post("", response_model=NotificationRecipientRead, status_code=201)
def add_recipient(payload: NotificationRecipientCreate, db: Session = Depends(get_db)):
    if payload.entity_type != "all" and payload.entity_type not in MODULE_TEAMS:
        raise HTTPException(status_code=400, detail=f"Unknown module '{payload.entity_type}'")
    email = payload.email.lower()
    exists = db.scalar(
        select(models.NotificationRecipient).where(
            models.NotificationRecipient.entity_type == payload.entity_type,
            models.NotificationRecipient.email == email,
        )
    )
    if exists:
        raise HTTPException(status_code=409, detail="This recipient is already on the list")
    recipient = models.NotificationRecipient(entity_type=payload.entity_type, email=email)
    db.add(recipient)
    db.commit()
    return recipient


@router.delete("/{recipient_id}", status_code=204)
def remove_recipient(recipient_id: int, db: Session = Depends(get_db)):
    recipient = db.get(models.NotificationRecipient, recipient_id)
    if recipient is None:
        raise HTTPException(status_code=404, detail="Recipient not found")
    db.delete(recipient)
    db.commit()
