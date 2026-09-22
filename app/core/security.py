from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from typing import Any

import bcrypt
from jose import jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    # generate a random salt, then one-way hash the password with bcrypt
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    # re-hash the candidate password and compare against the stored hash
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )


def create_access_token(data: dict[str, Any]) -> str:
    # copy payload, then attach an expiry based on configured minutes
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire})
    # sign the token so it cannot be forged or tampered with
    return jwt.encode(
        to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM
    )


def decode_access_token(token: str) -> dict[str, Any]:
    # verify signature and expiry, returning the original payload
    return jwt.decode(
        token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
    )


def create_refresh_secret() -> str:
    # generate enough entropy that a refresh secret cannot be guessed in practice
    return secrets.token_urlsafe(48)


def hash_refresh_secret(secret: str) -> str:
    # persist only a one-way digest so a database leak cannot replay sessions
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()
