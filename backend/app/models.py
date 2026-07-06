from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    # Nullable so SSO-provisioned accounts can exist without a local password.
    hashed_password: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="user")  # admin | user
    # quality (full record access) | purchasing | warehouse (external NCs only)
    team: Mapped[str] = mapped_column(String(20), default="quality", server_default="quality")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class RefSequence(Base):
    """Per-prefix, per-month counters for record references, matching the
    numbering used in the department's spreadsheets (e.g. NCI0726.01 =
    internal NC nr. 1 of July 2026)."""

    __tablename__ = "ref_sequences"

    prefix: Mapped[str] = mapped_column(String(10), primary_key=True)
    year: Mapped[int] = mapped_column(Integer, primary_key=True)
    month: Mapped[int] = mapped_column(Integer, primary_key=True)
    last_number: Mapped[int] = mapped_column(Integer, default=0)


class RecordMixin:
    id: Mapped[int] = mapped_column(primary_key=True)
    reference: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class CreatedByMixin:
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))


class InternalNonConformity(RecordMixin, CreatedByMixin, Base):
    """Registo de Não Conformidade interna (RC.QCP.0020.003)."""

    __tablename__ = "internal_nonconformities"

    date_detected: Mapped[date] = mapped_column(Date)
    po: Mapped[str | None] = mapped_column(String(100))
    project: Mapped[str | None] = mapped_column(String(255))
    sector: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    designer: Mapped[str | None] = mapped_column(String(255))
    root_cause: Mapped[str | None] = mapped_column(Text)
    cost: Mapped[float | None] = mapped_column(Numeric(12, 2))
    cost_note: Mapped[str | None] = mapped_column(Text)
    corrective_action: Mapped[str | None] = mapped_column(Text)
    preventive_action: Mapped[str | None] = mapped_column(Text)
    communicated_date: Mapped[date | None] = mapped_column(Date)  # comunicação ao setor
    implementation_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(20), default="minor")  # minor | major | critical
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)  # open | in_progress | closed

    created_by: Mapped[User | None] = relationship()


class ExternalNonConformity(RecordMixin, CreatedByMixin, Base):
    """Supplier non-conformity (RC.QCP.0020.009). Sections mirror who fills
    them in the spreadsheet: Quality, Purchasing, Warehouse."""

    __tablename__ = "external_nonconformities"

    # Quality
    date_detected: Mapped[date] = mapped_column(Date)
    supplier: Mapped[str] = mapped_column(String(255))
    po: Mapped[str | None] = mapped_column(String(100))  # PO/OF
    delivery_doc: Mapped[str | None] = mapped_column(String(100))  # guia/fatura
    item_reference: Mapped[str | None] = mapped_column(String(100))
    item_designation: Mapped[str | None] = mapped_column(String(255))
    quantity: Mapped[float | None] = mapped_column(Numeric(12, 3))
    description: Mapped[str] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(255))
    has_control_range: Mapped[bool] = mapped_column(Boolean, default=False)
    # Purchasing
    communicated_date: Mapped[date | None] = mapped_column(Date)  # comunicação ao fornecedor
    supplier_response: Mapped[str | None] = mapped_column(Text)
    root_cause: Mapped[str | None] = mapped_column(Text)
    action_to_take: Mapped[str | None] = mapped_column(Text)
    # Warehouse
    return_note: Mapped[str | None] = mapped_column(String(100))
    closure_responsible: Mapped[str | None] = mapped_column(String(255))
    closure_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)

    severity: Mapped[str] = mapped_column(String(20), default="minor")  # minor | major | critical
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)  # open | in_progress | closed

    created_by: Mapped[User | None] = relationship()


class WorkAccident(RecordMixin, CreatedByMixin, Base):
    """Work accident, matching the LTI tracking sheet."""

    __tablename__ = "work_accidents"

    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    injured_person: Mapped[str] = mapped_column(String(255))
    department: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)  # accident detail
    body_part: Mapped[str | None] = mapped_column(String(50))
    nature: Mapped[str | None] = mapped_column(String(50))  # cut, fall, burn, ...
    severity: Mapped[str] = mapped_column(String(20), default="first_aid")  # first_aid | minor | serious | fatal
    days_lost: Mapped[int] = mapped_column(Integer, default=0)
    hours_lost: Mapped[float | None] = mapped_column(Numeric(8, 1))
    inability: Mapped[str | None] = mapped_column(String(255))
    witnesses: Mapped[str | None] = mapped_column(Text)
    insurance_notified: Mapped[bool] = mapped_column(Boolean, default=False)
    act_notified: Mapped[bool] = mapped_column(Boolean, default=False)  # ACT communication
    root_cause: Mapped[str | None] = mapped_column(Text)
    corrective_action: Mapped[str | None] = mapped_column(Text)
    preventive_action: Mapped[str | None] = mapped_column(Text)
    closed_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)  # open | in_progress | closed

    created_by: Mapped[User | None] = relationship()


class NearMiss(RecordMixin, CreatedByMixin, Base):
    """Near miss / incident record (RC.QUA.0020.019)."""

    __tablename__ = "near_misses"

    occurred_date: Mapped[date] = mapped_column(Date)
    description: Mapped[str] = mapped_column(Text)
    event_type: Mapped[str | None] = mapped_column(String(50))  # fall, shock, fire, ...
    location: Mapped[str | None] = mapped_column(String(100))
    risk_level: Mapped[str] = mapped_column(String(20), default="low")  # low | medium | high
    root_cause: Mapped[str | None] = mapped_column(Text)
    corrective_action: Mapped[str | None] = mapped_column(Text)
    preventive_action: Mapped[str | None] = mapped_column(Text)
    owner: Mapped[str | None] = mapped_column(String(255))
    preventive_close_date: Mapped[date | None] = mapped_column(Date)
    # on_time | delayed | concluded (statuses used in the spreadsheet)
    status: Mapped[str] = mapped_column(String(20), default="on_time", index=True)

    created_by: Mapped[User | None] = relationship()


class WasteRecord(RecordMixin, CreatedByMixin, Base):
    """Registo de Produção de Resíduos (RC.QUA.0020.014). Quantities are
    always in kg; recyclables are often sold, so value can be revenue."""

    __tablename__ = "waste_records"

    collection_date: Mapped[date] = mapped_column(Date)
    waste_type: Mapped[str] = mapped_column(String(255))
    ler_code: Mapped[str | None] = mapped_column(String(20))
    waste_description: Mapped[str | None] = mapped_column(String(255))
    quantity_kg: Mapped[float] = mapped_column(Numeric(12, 1))
    hazardous: Mapped[bool] = mapped_column(Boolean, default=False)
    egar: Mapped[str | None] = mapped_column(String(100))
    operator: Mapped[str | None] = mapped_column(String(255))  # gestor de resíduo
    invoiced_value: Mapped[float | None] = mapped_column(Numeric(12, 2))
    notes: Mapped[str | None] = mapped_column(Text)

    created_by: Mapped[User | None] = relationship()


class AuditLog(Base):
    """One row per change: create/update/delete of a record, or an attachment
    being added/removed. `changes` holds field-level diffs for updates:
    {"field": {"from": old, "to": new}, ...}. The user name is denormalized so
    history stays readable even if the account is later removed."""

    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_entity", "entity_type", "entity_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(30))
    entity_id: Mapped[int] = mapped_column(Integer)
    reference: Mapped[str] = mapped_column(String(20), index=True)
    # create | update | delete | attachment_add | attachment_delete
    action: Mapped[str] = mapped_column(String(20))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    user_name: Mapped[str | None] = mapped_column(String(255))
    changes: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(30), index=True)
    entity_id: Mapped[int] = mapped_column(Integer, index=True)
    filename: Mapped[str] = mapped_column(String(255))
    stored_name: Mapped[str] = mapped_column(String(255), unique=True)
    content_type: Mapped[str | None] = mapped_column(String(120))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    uploaded_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    uploaded_by: Mapped[User | None] = relationship()
