"""Sage X3 purchase-order lookup for the Internal NC cost helper.

Any authenticated QAS user can search POs and read a PO's lines; the frontend
uses this to prefill an Internal NC's PO and cost from the real order line.
"""
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException

from .. import models, sage
from ..auth import get_current_user

logger = logging.getLogger("qas.sage")

router = APIRouter(prefix="/api/sage", tags=["sage"])


def _require_enabled():
    if not sage.enabled():
        raise HTTPException(status_code=503, detail="Sage integration is not configured.")


@router.get("/status")
def status(_: models.User = Depends(get_current_user)):
    """Cheap check the frontend uses to decide whether to show the picker."""
    return {"enabled": sage.enabled()}


@router.get("/purchase-orders")
async def purchase_orders(
    q: str = "",
    _: models.User = Depends(get_current_user),
):
    _require_enabled()
    try:
        return await sage.search_purchase_orders(q)
    except httpx.HTTPError as e:
        logger.warning("Sage PO search failed: %s", e)
        raise HTTPException(status_code=502, detail="Could not reach Sage X3.")


@router.get("/purchase-order-lines")
async def purchase_order_lines(
    pohnum: str,
    _: models.User = Depends(get_current_user),
):
    """`pohnum` is passed as a query param because Sage PO numbers contain '/'."""
    _require_enabled()
    if not pohnum.strip():
        raise HTTPException(status_code=400, detail="pohnum is required.")
    try:
        return await sage.get_purchase_order_lines(pohnum)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Purchase order not found.")
        logger.warning("Sage PO lines failed: %s", e)
        raise HTTPException(status_code=502, detail="Could not reach Sage X3.")
    except httpx.HTTPError as e:
        logger.warning("Sage PO lines failed: %s", e)
        raise HTTPException(status_code=502, detail="Could not reach Sage X3.")
