from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user, hash_password, require_admin
from ..database import get_db
from ..models import User
from ..schemas import UserCreate, UserOption, UserRead, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"], dependencies=[Depends(require_admin)])

# Non-admin endpoint: active users as notification choices (id, name, email)
options_router = APIRouter(prefix="/api/users", tags=["users"])


@options_router.get("/options", response_model=list[UserOption])
def user_options(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.scalars(
        select(User).where(User.is_active.is_(True)).order_by(User.full_name)
    ).all()


@router.get("", response_model=list[UserRead])
def list_users(db: Session = Depends(get_db)):
    return db.scalars(select(User).order_by(User.full_name)).all()


@router.post("", response_model=UserRead, status_code=201)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    email = payload.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="A user with this email already exists")
    user = User(
        email=email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password) if payload.password else None,
        role=payload.role,
        team=payload.team,
    )
    db.add(user)
    db.flush()
    return user


@router.put("/{user_id}", response_model=UserRead)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    data = payload.model_dump(exclude_unset=True)
    if "password" in data:
        user.hashed_password = hash_password(data.pop("password"))
    for key, value in data.items():
        setattr(user, key, value)
    db.flush()
    return user
