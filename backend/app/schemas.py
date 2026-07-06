from datetime import date, datetime
from decimal import Decimal
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field

RecordStatus = Literal["open", "in_progress", "closed"]
NearMissStatus = Literal["on_time", "delayed", "concluded"]
NCSeverity = Literal["minor", "major", "critical"]
AccidentSeverity = Literal["first_aid", "minor", "serious", "fatal"]
RiskLevel = Literal["low", "medium", "high"]
Role = Literal["admin", "user"]
Team = Literal["quality", "purchasing", "warehouse"]


# ---------------------------------------------------------------- auth / users

class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: Role
    team: Team
    is_active: bool
    created_at: datetime


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str = Field(min_length=8)
    role: Role = "user"
    team: Team = "quality"


class UserUpdate(BaseModel):
    full_name: str | None = None
    password: str | None = Field(default=None, min_length=8)
    role: Role | None = None
    team: Team | None = None
    is_active: bool | None = None


# ------------------------------------------------------------- shared helpers

class RecordRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reference: str
    created_at: datetime
    updated_at: datetime
    created_by_name: str | None = None


T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


# --------------------------------------------------- internal non-conformity

class InternalNCBase(BaseModel):
    date_detected: date
    po: str | None = None
    project: str | None = None
    sector: str | None = None
    description: str = Field(min_length=1)
    designer: str | None = None
    root_cause: str | None = None
    cost: Decimal | None = None
    cost_note: str | None = None
    corrective_action: str | None = None
    preventive_action: str | None = None
    communicated_date: date | None = None
    implementation_date: date | None = None
    notes: str | None = None
    severity: NCSeverity = "minor"
    status: RecordStatus = "open"


class InternalNCCreate(InternalNCBase):
    pass


class InternalNCUpdate(InternalNCBase):
    date_detected: date | None = None
    description: str | None = None
    severity: NCSeverity | None = None
    status: RecordStatus | None = None


class InternalNCRead(RecordRead, InternalNCBase):
    pass


# --------------------------------------------- external (supplier) NC

class ExternalNCBase(BaseModel):
    date_detected: date
    supplier: str = Field(min_length=1)
    po: str | None = None
    delivery_doc: str | None = None
    item_reference: str | None = None
    item_designation: str | None = None
    quantity: Decimal | None = None
    description: str = Field(min_length=1)
    location: str | None = None
    has_control_range: bool = False
    communicated_date: date | None = None
    supplier_response: str | None = None
    root_cause: str | None = None
    action_to_take: str | None = None
    return_note: str | None = None
    closure_responsible: str | None = None
    closure_date: date | None = None
    notes: str | None = None
    severity: NCSeverity = "minor"
    status: RecordStatus = "open"


class ExternalNCCreate(ExternalNCBase):
    pass


class ExternalNCUpdate(ExternalNCBase):
    date_detected: date | None = None
    supplier: str | None = None
    description: str | None = None
    has_control_range: bool | None = None
    severity: NCSeverity | None = None
    status: RecordStatus | None = None


class ExternalNCRead(RecordRead, ExternalNCBase):
    pass


# -------------------------------------------------------------- work accident

class AccidentBase(BaseModel):
    occurred_at: datetime
    injured_person: str = Field(min_length=1)
    department: str | None = None
    description: str = Field(min_length=1)
    body_part: str | None = None
    nature: str | None = None
    severity: AccidentSeverity = "first_aid"
    days_lost: int = Field(default=0, ge=0)
    hours_lost: Decimal | None = Field(default=None, ge=0)
    inability: str | None = None
    witnesses: str | None = None
    insurance_notified: bool = False
    act_notified: bool = False
    root_cause: str | None = None
    corrective_action: str | None = None
    preventive_action: str | None = None
    closed_date: date | None = None
    status: RecordStatus = "open"


class AccidentCreate(AccidentBase):
    pass


class AccidentUpdate(AccidentBase):
    occurred_at: datetime | None = None
    injured_person: str | None = None
    description: str | None = None
    severity: AccidentSeverity | None = None
    days_lost: int | None = Field(default=None, ge=0)
    insurance_notified: bool | None = None
    act_notified: bool | None = None
    status: RecordStatus | None = None


class AccidentRead(RecordRead, AccidentBase):
    pass


# ------------------------------------------------------------------ near miss

class NearMissBase(BaseModel):
    occurred_date: date
    description: str = Field(min_length=1)
    event_type: str | None = None
    location: str | None = None
    risk_level: RiskLevel = "low"
    root_cause: str | None = None
    corrective_action: str | None = None
    preventive_action: str | None = None
    owner: str | None = None
    preventive_close_date: date | None = None
    status: NearMissStatus = "on_time"


class NearMissCreate(NearMissBase):
    pass


class NearMissUpdate(NearMissBase):
    occurred_date: date | None = None
    description: str | None = None
    risk_level: RiskLevel | None = None
    status: NearMissStatus | None = None


class NearMissRead(RecordRead, NearMissBase):
    pass


# --------------------------------------------------------------- waste record

class WasteBase(BaseModel):
    collection_date: date
    waste_type: str = Field(min_length=1)
    ler_code: str | None = None
    waste_description: str | None = None
    quantity_kg: Decimal = Field(gt=0)
    hazardous: bool = False
    egar: str | None = None
    operator: str | None = None
    invoiced_value: Decimal | None = None
    notes: str | None = None


class WasteCreate(WasteBase):
    pass


class WasteUpdate(WasteBase):
    collection_date: date | None = None
    waste_type: str | None = None
    quantity_kg: Decimal | None = Field(default=None, gt=0)
    hazardous: bool | None = None


class WasteRead(RecordRead, WasteBase):
    pass


# ---------------------------------------------------------------- attachments

class AttachmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entity_type: str
    entity_id: int
    filename: str
    content_type: str | None
    size_bytes: int
    created_at: datetime


# ---------------------------------------------------------------------- audit

class AuditRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entity_type: str
    entity_id: int
    reference: str
    action: str
    user_name: str | None
    changes: dict | None
    created_at: datetime
