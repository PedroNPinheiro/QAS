from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from .models import RefSequence


def next_reference(
    db: Session,
    prefix: str,
    ref_date: date | datetime | None = None,
    style: str = "monthly",
) -> str:
    """Return the next reference in the spreadsheet-compatible format.

    - "monthly": PREFIX + MMYY + .NN, e.g. NCI0626.01 (counter per month)
    - "yearly":  N_YYYY, e.g. 41_2026 (counter per year — test reports)

    The month/year come from the record's own date (`ref_date`) — a record
    registered in July for something that happened in June gets a June
    reference. Falls back to today when no date is given.

    Counters are locked FOR UPDATE, so concurrent creates never produce
    duplicates. Yearly counters are stored with month=0.
    """
    if isinstance(ref_date, datetime):
        ref_date = ref_date.date()
    d = ref_date or date.today()
    month = 0 if style == "yearly" else d.month
    db.execute(
        pg_insert(RefSequence)
        .values(prefix=prefix, year=d.year, month=month, last_number=0)
        .on_conflict_do_nothing(index_elements=["prefix", "year", "month"])
    )
    seq = db.execute(
        select(RefSequence)
        .where(
            RefSequence.prefix == prefix,
            RefSequence.year == d.year,
            RefSequence.month == month,
        )
        .with_for_update()
    ).scalar_one()
    seq.last_number += 1
    if style == "yearly":
        return f"{seq.last_number}_{d.year}"
    return f"{prefix}{d.month:02d}{d.year % 100:02d}.{seq.last_number:02d}"
