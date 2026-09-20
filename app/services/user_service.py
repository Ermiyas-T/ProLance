from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import User, UserRole
from app.schemas.user import UserCreate


# represents the safe duplicate-account outcome without coupling services to HTTP
class UserAlreadyExistsError(Exception):
    # keep duplicate account handling explicit without exposing persistence details
    pass


# represents password mismatch during security mutations
class InvalidPasswordError(Exception):
    # raised when current password does not match during password change or account deactivation
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


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    # verify that the user's current password matches before replacing it
    if not verify_password(current_password, user.hashed_password):
        raise InvalidPasswordError

    # update the hashed_password column with the new hashed password
    user.hashed_password = hash_password(new_password)
    # persist the password change to the database
    db.commit()


def deactivate_account(db: Session, user: User, password: str) -> None:
    # verify that the user's password matches before deactivating the account
    if not verify_password(password, user.hashed_password):
        raise InvalidPasswordError

    # mark the user account as inactive
    user.is_active = False
    # persist the deactivation to the database
    db.commit()

