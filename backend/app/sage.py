"""Thin async client for the Sage X3 REST API (F12 Consulting endpoint).

Only the read operations the QAS app needs: search purchase-order headers and
read a single order's lines (with prices), so an Internal NC can pull its cost
straight from the PO line instead of it being keyed in by hand.

Enabled only when SAGEX3_BASE_URL is configured; otherwise the router returns
503 and the frontend hides the picker.
"""
from urllib.parse import quote, urlencode

import httpx

from .config import settings

_TIMEOUT = 30


def enabled() -> bool:
    return bool(settings.sagex3_base_url)


def _auth() -> tuple[str, str]:
    return (settings.sagex3_user, settings.sagex3_password)


def _sanitize(value: str) -> str:
    """Neutralize quotes/semicolons before interpolating into a Sage `where`."""
    return value.replace("'", "''").replace(";", "")


async def _query(class_name: str, where: str = "", count: int = 10,
                 order_by: str = "", key: str = "") -> dict:
    params = urlencode({
        "representation": f"{class_name}.$query",
        "count": count,
        **({"key": key} if key else {}),
        **({"orderBy": order_by} if order_by else {}),
    })
    url = f"{settings.sagex3_base_url}/{class_name}?{params}"
    if where:
        url += "&where=" + quote(where)
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        res = await client.get(url, auth=_auth())
        res.raise_for_status()
        return res.json()


def _supplier_name(row: dict) -> str:
    ref = row.get("BPSNUM_REF") or {}
    return ref.get("$description") or ref.get("$title") or row.get("BPSNUM", "")


async def search_purchase_orders(q: str, count: int = 15) -> list[dict]:
    """Search PO headers by order number or supplier code. Empty q = most recent."""
    q = _sanitize(q.strip())
    if q:
        by_num = await _query("PORDER", where=f"POHNUM like '{q}%'", count=count)
        by_sup = await _query("PORDER", where=f"BPSNUM like '{q}%'", count=count)
        seen = {r["$uuid"] for r in by_num.get("$resources", [])}
        rows = by_num.get("$resources", []) + [
            r for r in by_sup.get("$resources", []) if r["$uuid"] not in seen
        ]
        rows = rows[:count]
    else:
        # key=lt + orderBy=ORDDAT → most recent orders first
        res = await _query("PORDER", count=count, key="lt", order_by="ORDDAT")
        rows = res.get("$resources", [])
    return [
        {
            "pohnum": r.get("POHNUM", ""),
            "order_date": r.get("ORDDAT") or None,
            "supplier": _supplier_name(r),
            "site": (r.get("POHFCY_REF") or {}).get("$title") or r.get("POHFCY", ""),
        }
        for r in rows
    ]


def _num(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


async def get_purchase_order_lines(pohnum: str) -> dict:
    """Read one PO's detail and return its lines with prices, in order currency."""
    key = quote(_sanitize(pohnum), safe="")
    url = (f"{settings.sagex3_base_url}/PORDER('{key}')"
           f"?representation=PORDER.$details")
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        res = await client.get(url, auth=_auth())
        res.raise_for_status()
        data = res.json()

    currency = data.get("CUR") or "EUR"
    lines = []
    for i, ln in enumerate(data.get("POHPOP", []), start=1):
        net_cur = (ln.get("NETCUR_REF") or {})
        lines.append({
            "line": i,
            "item_ref": ln.get("ITMREF", ""),
            "item_des": ln.get("ITMDES1") or ln.get("ITMDES") or "",
            "quantity": _num(ln.get("QTYUOM")),
            "unit": (ln.get("UOM_REF") or {}).get("$symbol") or ln.get("UOM", ""),
            "unit_price": _num(ln.get("NETPRI")),
            "line_amount": _num(ln.get("LINAMT")),
            "currency": ln.get("NETCUR") or currency,
        })
    return {
        "pohnum": data.get("POHNUM", pohnum),
        "order_date": data.get("ORDDAT") or None,
        "supplier": _supplier_name(data),
        "currency": currency,
        "lines": lines,
    }
