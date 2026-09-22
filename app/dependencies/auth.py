from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.auth_session import AuthSession
from app.models.user import User, UserRole
from app.schemas.user import TokenData
from app.services.user_service import get_user_by_id

# reads the Bearer token out of the Authorization header for us
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

ACCESS_COOKIE_NAME = "prolance_access"

# a single 401 shape reused by every failure inside authentication
credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    request: Request,
    bearer_token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        # prefer the HttpOnly browser cookie while retaining Bearer access for API clients
        token = bearer_token or request.cookies.get(ACCESS_COOKIE_NAME)
        if token is None:
            raise credentials_exception

        # decode the token and extract the user id it was signed with
        payload = decode_access_token(token)
        token_data = TokenData(user_id=payload.get("user_id"), role=payload.get("role"))
        if token_data.user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # access cookies are bound to a live session so logout takes effect immediately
    session_id = payload.get("session_id")
    if session_id is not None:
        auth_session = db.get(AuthSession, session_id)
        if auth_session is None or auth_session.revoked_at is not None:
            raise credentials_exception

    # the token is valid, but confirm the user still exists and remains active
    user = get_user_by_id(db, token_data.user_id)
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_role(*roles: UserRole):
    # returns a dependency that only lets users with an allowed role through
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return role_checker
