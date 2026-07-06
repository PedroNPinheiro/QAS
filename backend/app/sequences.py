from datetime import date

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from .models import RefSequence


def next_reference(db: Session, prefix: str) -> str:
    """Return the next reference for a prefix in the spreadsheet-compatible
    format PREFIX + MMYY + .NN, e.g. NCI0726.01 (nr. 1 of July 2026).

    Counters are per prefix and month and locked FOR UPDATE, so concurrent
    creates never produce duplicates.
    """
    today = date.today()
    db.execute(
        pg_insert(RefSequence)
        .values(prefix=prefix, year=today.year, month=today.month, last_number=0)
        .on_conflict_do_nothing(index_elements=["prefix", "year", "month"])
    )
    seq = db.execute(
        select(RefSequence)
        .where(
            RefSequence.prefix == prefix,
            RefSequence.year == today.year,
            RefSequence.month == today.month,
        )
        .with_for_update()
    ).scalar_one()
    seq.last_number += 1
    return f"{prefix}{today.month:02d}{today.year % 100:02d}.{seq.last_number:02d}"
