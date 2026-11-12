"""Team-based access control.

Teams: quality (full record access), purchasing, warehouse.
Admins always have full access regardless of team.

Workflow for external (supplier) NCs: Quality opens the record, Purchasing
fills the supplier follow-up section, Warehouse fills the closure section —
so those two teams see only that module and can edit only their fields.
"""
from fastapi import Depends, HTTPException

from .auth import get_current_user
from .models import User

TEAMS = (
    "quality",
    "purchasing",
    "warehouse",
    "viewer",
    "internal_nc_viewer",
    "internal_nc_editor",
    "waste_viewer",
    "improvements_editor",
)

# Teams that may never change anything (no record edits, no file uploads)
READ_ONLY_TEAMS = {"viewer", "internal_nc_viewer", "waste_viewer"}

# Teams with full edit rights (create/edit/attach) but scoped to specific
# modules: team -> entity_types it may fully edit.
MODULE_EDITORS: dict[str, set[str]] = {
    "internal_nc_editor": {"internal_nc"},
    "improvements_editor": {"weekly_improvement"},
}

# entity_type -> teams allowed to view the module
MODULE_TEAMS: dict[str, set[str]] = {
    "internal_nc": {"quality", "viewer", "internal_nc_viewer", "internal_nc_editor"},
    "external_nc": {"quality", "purchasing", "warehouse", "viewer"},
    "test_report": {"quality", "viewer"},
    # others get in via the improvements_editor team or a per-user extra module
    "weekly_improvement": {"quality", "improvements_editor"},
    "accident": {"quality", "viewer"},
    "near_miss": {"quality", "viewer"},
    "waste": {"quality", "viewer", "waste_viewer"},
}

# Fields non-quality teams may edit, per module (mirrored in the frontend)
TEAM_EDITABLE_FIELDS: dict[str, dict[str, set[str]]] = {
    "external_nc": {
        "purchasing": {"communicated_date", "supplier_response", "root_cause", "action_to_take", "purchasing_complete"},
        "warehouse": {"return_note", "closure_responsible", "closure_date", "notes", "status"},
    },
}


def has_full_access(user: User) -> bool:
    return user.role == "admin" or user.team == "quality"


def is_module_editor(user: User, entity_type: str) -> bool:
    """User may fully use this specific module (view/create/edit all fields/
    attach) — through their team, or a module granted to them individually."""
    return entity_type in MODULE_EDITORS.get(user.team, set()) or entity_type in (
        user.extra_modules or []
    )


def require_view(user: User, entity_type: str) -> None:
    if user.role == "admin" or is_module_editor(user, entity_type):
        return
    if user.team not in MODULE_TEAMS.get(entity_type, set()):
        raise HTTPException(status_code=403, detail="Your team does not have access to this module")


def require_create(user: User, entity_type: str) -> None:
    if has_full_access(user) or is_module_editor(user, entity_type):
        return
    raise HTTPException(status_code=403, detail="You do not have permission to create records here")


def editable_fields(user: User, entity_type: str) -> set[str] | None:
    """Fields the user may change on this module. None means unrestricted."""
    if has_full_access(user) or is_module_editor(user, entity_type):
        return None
    fields = TEAM_EDITABLE_FIELDS.get(entity_type, {}).get(user.team)
    if fields is None:
        raise HTTPException(status_code=403, detail="Your team cannot edit this module")
    return fields


def require_full_access(user: User = Depends(get_current_user)) -> User:
    """Dependency for cross-module views (dashboard, analytics) — the
    all-modules viewer team may also see them."""
    if not (has_full_access(user) or user.team == "viewer"):
        raise HTTPException(status_code=403, detail="Your team does not have access to this page")
    return user


def require_attach(user: User, entity_type: str) -> None:
    """Uploading/removing files counts as editing — read-only teams may not."""
    require_view(user, entity_type)
    if is_module_editor(user, entity_type):
        return
    if user.role != "admin" and user.team in READ_ONLY_TEAMS:
        raise HTTPException(status_code=403, detail="Your access is read-only")
