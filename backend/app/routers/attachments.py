import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models
from ..audit import log_audit
from ..auth import get_current_user
from ..permissions import require_view
from ..config import settings
from ..database import get_db
from ..schemas import AttachmentRead

router = APIRouter(prefix="/api/attachments", tags=["attachments"])

ENTITY_MODELS = {
    "internal_nc": models.InternalNonConformity,
    "external_nc": models.ExternalNonConformity,
    "test_report": models.TestReport,
    "accident": models.WorkAccident,
    "near_miss": models.NearMiss,
    "waste": models.WasteRecord,
}

# Documents and images only — executables and scripts are rejected.
ALLOWED_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".heic",
    ".pdf", ".txt", ".csv", ".rtf",
    ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods",
    ".eml", ".msg", ".zip",
}


def _get_entity_or_404(db: Session, entity_type: str, entity_id: int):
    model = ENTITY_MODELS.get(entity_type)
    if model is None:
        raise HTTPException(status_code=400, detail=f"Unknown entity type '{entity_type}'")
    entity = db.get(model, entity_id)
    if entity is None:
        raise HTTPException(status_code=404, detail="Record not found")
    return entity


# NOTE: declared before the /{entity_type}/{entity_id} routes — FastAPI matches
# in declaration order, and "/file/123" would otherwise parse as entity_type="file".
@router.get("/file/{attachment_id}")
def download_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    attachment = db.get(models.Attachment, attachment_id)
    if attachment is None:
        raise HTTPException(status_code=404, detail="Attachment not found")
    require_view(user, attachment.entity_type)
    path = Path(settings.upload_dir) / attachment.stored_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File missing from storage")
    return FileResponse(
        path,
        filename=attachment.filename,
        media_type=attachment.content_type or "application/octet-stream",
    )


@router.get("/{entity_type}/{entity_id}", response_model=list[AttachmentRead])
def list_attachments(
    entity_type: str,
    entity_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    require_view(user, entity_type)
    _get_entity_or_404(db, entity_type, entity_id)
    return db.scalars(
        select(models.Attachment)
        .where(
            models.Attachment.entity_type == entity_type,
            models.Attachment.entity_id == entity_id,
        )
        .order_by(models.Attachment.created_at)
    ).all()


@router.post("/{entity_type}/{entity_id}", response_model=AttachmentRead, status_code=201)
def upload_attachment(
    entity_type: str,
    entity_id: int,
    file: UploadFile,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    require_view(user, entity_type)
    entity = _get_entity_or_404(db, entity_type, entity_id)
    suffix = Path(file.filename or "file").suffix[:20].lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{suffix or 'unknown'}' is not allowed. "
            "Upload documents or images (pdf, office, txt, csv, zip, png, jpg, …).",
        )
    content = file.file.read()
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(
            status_code=413, detail=f"File exceeds {settings.max_upload_mb} MB limit"
        )
    stored_name = f"{uuid.uuid4().hex}{suffix}"
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    (upload_dir / stored_name).write_bytes(content)

    attachment = models.Attachment(
        entity_type=entity_type,
        entity_id=entity_id,
        filename=file.filename or stored_name,
        stored_name=stored_name,
        content_type=file.content_type,
        size_bytes=len(content),
        uploaded_by_id=user.id,
    )
    db.add(attachment)
    db.flush()
    log_audit(
        db,
        entity_type=entity_type,
        entity_id=entity_id,
        reference=entity.reference,
        action="attachment_add",
        user=user,
        changes={"file": {"from": None, "to": attachment.filename}},
    )
    return attachment


@router.delete("/{attachment_id}", status_code=204)
def delete_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    attachment = db.get(models.Attachment, attachment_id)
    if attachment is None:
        raise HTTPException(status_code=404, detail="Attachment not found")
    require_view(user, attachment.entity_type)
    entity = db.get(ENTITY_MODELS.get(attachment.entity_type), attachment.entity_id)
    (Path(settings.upload_dir) / attachment.stored_name).unlink(missing_ok=True)
    log_audit(
        db,
        entity_type=attachment.entity_type,
        entity_id=attachment.entity_id,
        reference=entity.reference if entity else "?",
        action="attachment_delete",
        user=user,
        changes={"file": {"from": attachment.filename, "to": None}},
    )
    db.delete(attachment)
