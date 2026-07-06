import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import create_access_token, get_current_user, verify_password
from ..database import get_db
from ..models import User
from ..schemas import LoginRequest, TokenResponse, UserRead

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Simple in-process brute-force protection: after MAX_ATTEMPTS failed logins
# for the same email, block that email for LOCKOUT_SECONDS.
MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 300
_failed: dict[str, list[float]] = defaultdict(list)


def _check_lockout(email: str) -> None:
    now = time.monotonic()
    attempts = [t for t in _failed[email] if now - t < LOCKOUT_SECONDS]
    _failed[email] = attempts
    if len(attempts) >= MAX_ATTEMPTS:
        wait = int(LOCKOUT_SECONDS - (now - attempts[0]))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed attempts. Try again in {max(wait // 60, 1)} minute(s).",
        )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    _check_lockout(email)
    user = db.scalar(select(User).where(User.email == email))
    if (
        user is None
        or not user.is_active
        or user.hashed_password is None
        or not verify_password(payload.password, user.hashed_password)
    ):
        _failed[email].append(time.monotonic())
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )
    _failed.pop(email, None)
    return TokenResponse(access_token=create_access_token(user))


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)):
    return user
