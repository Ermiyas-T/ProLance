from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_password
from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.user import AccountDeactivation, PasswordChange, Token, UserCreate, UserLogin, UserOut
from app.services.user_service import (
    InvalidPasswordError,
    UserAlreadyExistsError,
    change_password,
    create_user,
    deactivate_account,
    get_user_by_email,
)

# group all /auth routes under one router mounted into the app
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, db: Session = Depends(get_db)):
    try:
        # the service owns both the duplicate check and transaction-safe user creation
        return create_user(db, data)
    except UserAlreadyExistsError:
        # use conflict because this email clashes with an existing account resource
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email already registered"
        )


@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    # find the user and verify the supplied password against the stored hash
    user = get_user_by_email(db, data.email)
    # use one generic response so account status is not disclosed to attackers
    if not user or not user.is_active or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    # issue a signed token carrying the user identity and role
    access_token = create_access_token({"user_id": user.id, "role": user.role.value})
    return Token(access_token=access_token)


@router.get("/me", response_model=UserOut)
def read_me(current_user: User = Depends(get_current_user)):
    # the dependency already authenticated us; return the current user
    return current_user


@router.patch("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_my_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        # change the user's password safely via the user_service
        change_password(db, current_user, data.current_password, data.new_password)
    except InvalidPasswordError:
        # return 400 bad request if the current password is incorrect
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )


@router.post("/me/deactivate", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_my_account(
    data: AccountDeactivation,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        # deactivate the user's account safely via the user_service
        deactivate_account(db, current_user, data.password)
    except InvalidPasswordError:
        # return 400 bad request if the confirmation password is incorrect
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect password",
        )

