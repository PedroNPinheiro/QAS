from fastapi import APIRouter

from .. import models, schemas
from ..crud_router import create_crud_router

router = APIRouter(prefix="/api", tags=["records"])

router.include_router(
    create_crud_router(
        model=models.InternalNonConformity,
        ref_prefix="NCI",
        entity_type="internal_nc",
        create_schema=schemas.InternalNCCreate,
        update_schema=schemas.InternalNCUpdate,
        read_schema=schemas.InternalNCRead,
        search_fields=("description", "po", "project", "sector", "designer"),
    ),
    prefix="/quality/internal-nc",
)

router.include_router(
    create_crud_router(
        model=models.ExternalNonConformity,
        ref_prefix="NCE",
        entity_type="external_nc",
        create_schema=schemas.ExternalNCCreate,
        update_schema=schemas.ExternalNCUpdate,
        read_schema=schemas.ExternalNCRead,
        search_fields=("description", "supplier", "po", "item_reference", "item_designation"),
    ),
    prefix="/quality/external-nc",
)

router.include_router(
    create_crud_router(
        model=models.WorkAccident,
        ref_prefix="ACC",
        entity_type="accident",
        create_schema=schemas.AccidentCreate,
        update_schema=schemas.AccidentUpdate,
        read_schema=schemas.AccidentRead,
        search_fields=("description", "injured_person", "department", "body_part", "nature"),
    ),
    prefix="/security/accidents",
)

router.include_router(
    create_crud_router(
        model=models.NearMiss,
        ref_prefix="NM",
        entity_type="near_miss",
        create_schema=schemas.NearMissCreate,
        update_schema=schemas.NearMissUpdate,
        read_schema=schemas.NearMissRead,
        search_fields=("description", "location", "event_type", "owner"),
    ),
    prefix="/security/near-misses",
)

router.include_router(
    create_crud_router(
        model=models.WasteRecord,
        ref_prefix="WST",
        entity_type="waste",
        create_schema=schemas.WasteCreate,
        update_schema=schemas.WasteUpdate,
        read_schema=schemas.WasteRead,
        search_fields=("waste_type", "ler_code", "waste_description", "operator", "egar"),
    ),
    prefix="/environment/waste",
)
