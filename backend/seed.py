"""Seed the database.

Usage:
    python seed.py            # create tables + admin user (admin@example.com / admin123)
    python seed.py --demo     # also insert sample records in every module
"""
import sys
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from app import models
from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.sequences import next_reference

ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"


def seed_admin(db) -> models.User:
    admin = db.scalar(select(models.User).where(models.User.email == ADMIN_EMAIL))
    if admin is None:
        admin = models.User(
            email=ADMIN_EMAIL,
            full_name="QAS Administrator",
            hashed_password=hash_password(ADMIN_PASSWORD),
            role="admin",
        )
        db.add(admin)
        db.flush()
        print(f"Created admin user: {ADMIN_EMAIL} / {ADMIN_PASSWORD} — change this password!")
    else:
        print("Admin user already exists, skipping.")
    return admin


def seed_demo(db, admin: models.User):
    if db.scalar(select(models.InternalNonConformity).limit(1)):
        print("Demo data already present, skipping.")
        return

    today = date.today()
    now = datetime.now(timezone.utc)

    def common(prefix):
        return {"reference": next_reference(db, prefix), "created_by_id": admin.id}

    records = [
        models.InternalNonConformity(
            **common("NCI"), date_detected=today - timedelta(days=12),
            po="0050026POH/000731", project="Les Pattes de l'Adour", sector="Pintura",
            description="Orange peel effect on control panel sheets, batch of 9 units.",
            cost=42.5, corrective_action="Re-sand and repaint affected panels.",
            preventive_action="Check gun pressure at shift start.",
            communicated_date=today - timedelta(days=11),
            severity="minor", status="in_progress",
        ),
        models.ExternalNonConformity(
            **common("NCE"), date_detected=today - timedelta(days=8),
            supplier="Kitepinte", po="PO 30-02114", delivery_doc="GT 26/0410",
            item_designation="Control panel sheets X62", quantity=9,
            description="Non-uniform lacquering and dents on delivered sheets.",
            has_control_range=True,
            communicated_date=today - timedelta(days=7),
            action_to_take="Return for rework at supplier cost.",
            severity="major", status="in_progress",
        ),
        models.WorkAccident(
            **common("ACC"), occurred_at=now - timedelta(days=18),
            injured_person="(Example) João Silva", department="Joinery",
            description="Cut on left hand while handling a panel without gloves.",
            body_part="Hand", nature="Cut", severity="minor",
            days_lost=3, hours_lost=24, insurance_notified=True, act_notified=False,
            corrective_action="First aid and clinic treatment.",
            preventive_action="Reinforce glove use for panel handling.",
            status="in_progress",
        ),
        models.NearMiss(
            **common("NM"), occurred_date=today - timedelta(days=5),
            description="Pallet left on the traffic lane of the external waste park.",
            event_type="Shock", location="External Waste Park", risk_level="medium",
            corrective_action="Pallet removed immediately.",
            preventive_action="Mark no-storage zone on the lane.",
            owner="HSE team", status="on_time",
        ),
        models.WasteRecord(
            **common("WST"), collection_date=today - timedelta(days=3),
            waste_type="Papel e Cartão", ler_code="150101",
            waste_description="Embalagens de papel e cartão",
            quantity_kg=820, hazardous=False, egar="PT20260630123456",
            operator="Resifluxos", invoiced_value=73.8,
        ),
    ]
    db.add_all(records)
    print(f"Inserted {len(records)} demo records.")


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        admin = seed_admin(db)
        if "--demo" in sys.argv:
            seed_demo(db, admin)
        db.commit()
    finally:
        db.close()
    print("Done.")


if __name__ == "__main__":
    main()
