from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, verify_password
from app.db.session import get_db
from app.dependencies.auth import ACCESS_COOKIE_NAME, get_current_user
from app.models.user import User
from app.schemas.user import AccountDeactivation, PasswordChange, UserCreate, UserLogin, UserOut
from app.services.auth_session_service import (
    create_auth_session,
    revoke_auth_session,
    rotate_auth_session,
)
from app.services.user_service import (
    InvalidPasswordError,
    UserAlreadyExistsError,
    change_password,
    create_user,
    deactivate_account,
    get_user_by_email,
    get_user_by_id,
)

# group all account and session actions beneath the authentication resource
router = APIRouter(prefix="/auth", tags=["auth"])
REFRESH_COOKIE_NAME = "prolance_refresh"


def set_auth_cookies(response: Response, user: User, session_id: str, refresh_secret: str) -> None:
    # issue HttpOnly cookies so browser JavaScript can never read credential material
    access_token = create_access_token(
        {"user_id": user.id, "role": user.role.value, "session_id": session_id}
    )
    cookie_options = {
        "httponly": True,
        "secure": settings.AUTH_COOKIE_SECURE,
        "samesite": settings.AUTH_COOKIE_SAMESITE,
        "domain": settings.AUTH_COOKIE_DOMAIN,
        "path": "/",
    }
    response.set_cookie(
        ACCESS_COOKIE_NAME,
        access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        **cookie_options,
    )
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        f"{session_id}.{refresh_secret}",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        **cookie_options,
    )


def clear_auth_cookies(response: Response) -> None:
    # remove both client cookies whether logout is normal or recovery has failed
    cookie_options = {
        "domain": settings.AUTH_COOKIE_DOMAIN,
        "path": "/",
        "samesite": settings.AUTH_COOKIE_SAMESITE,
        "secure": settings.AUTH_COOKIE_SECURE,
        "httponly": True,
    }
    response.delete_cookie(ACCESS_COOKIE_NAME, **cookie_options)
    response.delete_cookie(REFRESH_COOKIE_NAME, **cookie_options)


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, db: Session = Depends(get_db)) -> User:
    try:
        # the service owns duplicate detection and the user-creation transaction
        return create_user(db, data)
    except UserAlreadyExistsError:
        # expose a safe conflict without leaking persistence details
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email already registered"
        )


@router.post("/login", status_code=status.HTTP_204_NO_CONTENT)
def login(data: UserLogin, response: Response, db: Session = Depends(get_db)) -> Response:
    # authenticate credentials without disclosing whether an account is inactive
    user = get_user_by_email(db, data.email)
    if not user or not user.is_active or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # persist a revocable refresh session before handing credentials to the browser
    auth_session, refresh_secret = create_auth_session(db, user.id)
    set_auth_cookies(response, user, auth_session.id, refresh_secret)
    # preserve the documented no-content status when returning the injected response
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post("/refresh", status_code=status.HTTP_204_NO_CONTENT)
def refresh_session(request: Request, response: Response, db: Session = Depends(get_db)) -> Response:
    # parse the opaque refresh cookie without ever accepting secrets in request bodies
    refresh_value = request.cookies.get(REFRESH_COOKIE_NAME)
    if refresh_value is None or "." not in refresh_value:
        clear_auth_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")

    session_id, refresh_secret = refresh_value.split(".", maxsplit=1)
    auth_session, next_secret = rotate_auth_session(db, session_id, refresh_secret)
    if auth_session is None or next_secret is None:
        clear_auth_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")

    # re-read the user so suspended accounts cannot regain access through refresh
    user = get_user_by_id(db, auth_session.user_id)
    if user is None or not user.is_active:
        revoke_auth_session(db, auth_session.id)
        clear_auth_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")

    set_auth_cookies(response, user, auth_session.id, next_secret)
    # preserve the documented no-content status when returning the injected response
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> Response:
    # revoke only this browser's session and then clear its two HttpOnly cookies
    refresh_value = request.cookies.get(REFRESH_COOKIE_NAME)
    if refresh_value and "." in refresh_value:
        session_id, _ = refresh_value.split(".", maxsplit=1)
        revoke_auth_session(db, session_id)
    clear_auth_cookies(response)
    # preserve the documented no-content status when returning the injected response
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=UserOut)
def read_me(current_user: User = Depends(get_current_user)) -> User:
    # the dependency authenticated the cookie or Bearer token and loaded the live user
    return current_user


@router.patch("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_my_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    try:
        # changing credentials also revokes sessions inside the service transaction flow
        change_password(db, current_user, data.current_password, data.new_password)
    except InvalidPasswordError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )


@router.post("/me/deactivate", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_my_account(
    data: AccountDeactivation,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    try:
        # deactivating an account invalidates every session before returning success
        deactivate_account(db, current_user, data.password)
    except InvalidPasswordError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect password",
        )
