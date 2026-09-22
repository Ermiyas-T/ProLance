from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_refresh_secret, hash_refresh_secret
from app.models.auth_session import AuthSession


def is_auth_session_expired(auth_session: AuthSession, now: datetime) -> bool:
    # normalize SQLite test timestamps so expiry checks stay timezone-safe everywhere
    expires_at = auth_session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at <= now


def create_auth_session(db: Session, user_id: int) -> tuple[AuthSession, str]:
    # create a server-revocable session and return its browser-only secret once
    refresh_secret = create_refresh_secret()
    auth_session = AuthSession(
        id=str(uuid4()),
        user_id=user_id,
        refresh_secret_hash=hash_refresh_secret(refresh_secret),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(auth_session)
    db.commit()
    db.refresh(auth_session)
    return auth_session, refresh_secret


def rotate_auth_session(
    db: Session, session_id: str, refresh_secret: str
) -> tuple[AuthSession | None, str | None]:
    # verify refresh ownership and expiry before issuing a replacement secret
    auth_session = db.get(AuthSession, session_id)
    now = datetime.now(timezone.utc)
    if (
        auth_session is None
        or auth_session.revoked_at is not None
        or is_auth_session_expired(auth_session, now)
        or auth_session.refresh_secret_hash != hash_refresh_secret(refresh_secret)
    ):
        return None, None

    # rotate the secret atomically so an old refresh cookie cannot be reused
    next_secret = create_refresh_secret()
    auth_session.refresh_secret_hash = hash_refresh_secret(next_secret)
    auth_session.rotated_at = now
    auth_session.expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db.commit()
    db.refresh(auth_session)
    return auth_session, next_secret


def revoke_auth_session(db: Session, session_id: str) -> None:
    # mark only the current browser session invalid during explicit logout
    auth_session = db.get(AuthSession, session_id)
    if auth_session is not None and auth_session.revoked_at is None:
        auth_session.revoked_at = datetime.now(timezone.utc)
        db.commit()


def revoke_all_user_sessions(db: Session, user_id: int) -> None:
    # stage every session revocation for the caller's surrounding security transaction
    db.execute(
        update(AuthSession)
        .where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )
