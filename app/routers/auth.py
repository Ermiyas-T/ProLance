from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_password
from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.user import Token, UserCreate, UserLogin, UserOut
from app.services.user_service import UserAlreadyExistsError, create_user, get_user_by_email

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
