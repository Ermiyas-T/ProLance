from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import UserCreate


def get_user_by_email(db: Session, email: str) -> User | None:
    # find the user by email, used for login and duplicate checks
    return db.scalar(select(User).where(User.email == email))


def get_user_by_id(db: Session, user_id: int) -> User | None:
    # fetch a user by primary key, used to resolve the authenticated identity
    return db.get(User, user_id)


def create_user(db: Session, data: UserCreate) -> User:
    # build the row with the hashed password (never the plaintext)
    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user