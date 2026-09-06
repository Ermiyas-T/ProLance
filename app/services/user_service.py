from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User, UserRole
from app.schemas.user import UserCreate


# represents the safe duplicate-account outcome without coupling services to HTTP
class UserAlreadyExistsError(Exception):
    # keep duplicate account handling explicit without exposing persistence details
    pass


def get_user_by_email(db: Session, email: str) -> User | None:
    # find the user by email, used for login and duplicate checks
    return db.scalar(select(User).where(User.email == email))


def get_user_by_id(db: Session, user_id: int) -> User | None:
    # fetch a user by primary key, used to resolve the authenticated identity
    return db.get(User, user_id)


def create_user(db: Session, data: UserCreate) -> User:
    # fail early with a clear conflict when the normalized email is already present
    if get_user_by_email(db, data.email):
        raise UserAlreadyExistsError

    # build the row with the hashed password (never the plaintext)
    user = User(
        full_name=data.full_name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role=UserRole(data.role.value),
    )
    db.add(user)
    try:
        # commit here makes the database unique constraint the final race-condition guard
        db.commit()
    except IntegrityError:
        # reset the failed transaction before the request-scoped session is reused
        db.rollback()
        # report a duplicate only when the competing transaction created this email
        if get_user_by_email(db, data.email):
            raise UserAlreadyExistsError from None
        raise
    db.refresh(user)
    return user
