"""One-off: move the quality test register from the yearly numbering
(65_2026) to the monthly scheme the other registers use (QT1026.01).

Every test is renumbered from its own test date, in date order within the
month; the old number is kept in the audit trail, the audit rows of each
record follow the new reference, and the counters are resynced so the next
created test continues the month's sequence.

Usage:
    python renumber_tests.py            # dry run — prints what would change
    python renumber_tests.py --apply
"""
import re
import sys
from collections import defaultdict

from sqlalchemy import delete, select

from app import models
from app.database import SessionLocal

PREFIX = "QT"
AUDIT_USER = "QAS maintenance (reference renumber)"


def register_nr(reference: str) -> tuple[int, int]:
    """(year, number) of a yearly reference — the register's own order."""
    m = re.match(r"^(\d+)_(\d{4})$", reference)
    return (int(m.group(2)), int(m.group(1))) if m else (0, 0)


def main() -> None:
    apply = "--apply" in sys.argv
    db = SessionLocal()
    try:
        records = db.scalars(select(models.TestReport)).all()
        todo = [r for r in records if not r.reference.startswith(PREFIX)]
        if not todo:
            print("Nothing to do — every quality test already uses the QT format.")
            return

        # Numbers already taken per month, so a re-run never collides
        counters: dict[tuple[int, int], int] = defaultdict(int)
        for r in records:
            m = re.match(rf"^{PREFIX}(\d{{2}})(\d{{2}})\.(\d+)$", r.reference)
            if m:
                key = (2000 + int(m.group(2)), int(m.group(1)))
                counters[key] = max(counters[key], int(m.group(3)))

        renames: list[tuple[models.TestReport, str]] = []
        for rec in sorted(todo, key=lambda r: (r.test_date, register_nr(r.reference), r.id)):
            d = rec.test_date
            counters[(d.year, d.month)] += 1
            n = counters[(d.year, d.month)]
            renames.append((rec, f"{PREFIX}{d.month:02d}{d.year % 100:02d}.{n:02d}"))

        for rec, new_ref in renames:
            print(f"  {rec.reference:>10s}  {rec.test_date}  ->  {new_ref}")
        print(f"\n{len(renames)} quality tests renumbered "
              f"({len({(r.test_date.year, r.test_date.month) for r, _ in renames})} months).")

        if not apply:
            print("\nDRY RUN — nothing written. Re-run with --apply.")
            return

        for rec, new_ref in renames:
            old_ref = rec.reference
            rec.reference = new_ref
            # the denormalized reference on this record's history follows it
            for entry in db.scalars(
                select(models.AuditLog).where(
                    models.AuditLog.entity_type == "test_report",
                    models.AuditLog.entity_id == rec.id,
                )
            ):
                entry.reference = new_ref
            db.add(models.AuditLog(
                entity_type="test_report",
                entity_id=rec.id,
                reference=new_ref,
                action="update",
                user_name=AUDIT_USER,
                changes={"reference": {"from": old_ref, "to": new_ref}},
            ))
        db.flush()

        db.execute(delete(models.RefSequence).where(models.RefSequence.prefix == "TR"))
        db.execute(delete(models.RefSequence).where(models.RefSequence.prefix == PREFIX))
        for (year, month), last in counters.items():
            db.add(models.RefSequence(prefix=PREFIX, year=year, month=month, last_number=last))
        db.commit()
        print("\nAPPLIED — references renumbered, history updated, counters synced.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
