import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import create_access_token, get_current_user, verify_password
from ..config import settings
from ..database import get_db
from ..models import User
from ..schemas import LoginRequest, TokenResponse, UserRead

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger("qas.sso")

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
    # Password sign-in is a break-glass path for administrators only;
    # everyone else uses Microsoft sign-in.
    if user is not None and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password sign-in is disabled — use “Sign in with Microsoft”.",
        )
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


# ------------------------------------------------- Microsoft Entra ID sign-in
#
# Microsoft only proves identity. Access is decided here: the email must match
# an active, pre-created QAS user (the app is the allowlist).

_jwks_client: jwt.PyJWKClient | None = None


def _ms_base() -> str:
    return f"https://login.microsoftonline.com/{settings.ms_tenant_id}/oauth2/v2.0"


def _redirect_uri() -> str:
    return f"{settings.app_base_url.rstrip('/')}/api/auth/callback"


def _sso_state() -> str:
    payload = {"purpose": "sso", "exp": datetime.now(timezone.utc) + timedelta(minutes=10)}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def _check_sso_state(state: str) -> bool:
    try:
        payload = jwt.decode(state, settings.secret_key, algorithms=["HS256"])
        return payload.get("purpose") == "sso"
    except jwt.PyJWTError:
        return False


@router.get("/sso/login")
def sso_login():
    if not settings.ms_client_id:
        raise HTTPException(status_code=503, detail="Microsoft sign-in is not configured")
    params = urlencode(
        {
            "client_id": settings.ms_client_id,
            "response_type": "code",
            "redirect_uri": _redirect_uri(),
            "response_mode": "query",
            "scope": "openid profile email",
            "state": _sso_state(),
        }
    )
    return RedirectResponse(f"{_ms_base()}/authorize?{params}")


@router.get("/callback")
def sso_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    db: Session = Depends(get_db),
):
    def fail(reason: str) -> RedirectResponse:
        return RedirectResponse(f"/login#sso_error={reason}")

    if error:
        logger.warning("SSO error from Microsoft: %s — %s", error, error_description)
        return fail("microsoft")
    if not code or not state or not _check_sso_state(state):
        return fail("invalid_state")

    # Exchange the authorization code for an ID token
    try:
        resp = httpx.post(
            f"{_ms_base()}/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": _redirect_uri(),
                "client_id": settings.ms_client_id,
                "client_secret": settings.ms_client_secret,
            },
            timeout=20,
        )
        body = resp.json()
        id_token = body.get("id_token")
        if not id_token:
            logger.error("SSO token exchange failed: %s", str(body)[:300])
            return fail("token_exchange")
    except Exception:
        logger.exception("SSO token exchange request failed")
        return fail("token_exchange")

    # Validate the ID token signature and claims
    global _jwks_client
    try:
        if _jwks_client is None:
            _jwks_client = jwt.PyJWKClient(
                f"https://login.microsoftonline.com/{settings.ms_tenant_id}/discovery/v2.0/keys"
            )
        signing_key = _jwks_client.get_signing_key_from_jwt(id_token)
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.ms_client_id,
            issuer=f"https://login.microsoftonline.com/{settings.ms_tenant_id}/v2.0",
        )
    except Exception:
        logger.exception("SSO id_token validation failed")
        return fail("invalid_token")

    email = str(claims.get("preferred_username") or claims.get("email") or "").lower().strip()
    if not email:
        return fail("no_email")

    user = db.scalar(select(User).where(User.email == email))
    if user is None or not user.is_active:
        logger.warning("SSO sign-in refused for %s (not an active QAS user)", email)
        return fail("not_authorized")

    logger.info("SSO sign-in: %s", email)
    return RedirectResponse(f"/login#sso_token={create_access_token(user)}")
