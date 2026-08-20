from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.user import TokenData
from app.services.user_service import get_user_by_id

# reads the Bearer token out of the Authorization header for us
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# a single 401 shape reused by every failure inside authentication
credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        # decode the token and extract the user id it was signed with
        payload = decode_access_token(token)
        token_data = TokenData(user_id=payload.get("user_id"), role=payload.get("role"))
        if token_data.user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # the token is valid, but confirm the user still exists in the DB
    user = get_user_by_id(db, token_data.user_id)
    if user is None:
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
