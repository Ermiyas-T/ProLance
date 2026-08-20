import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


# enum of the platform roles used for authorization decisions
class UserRole(str, enum.Enum):
    CLIENT = "CLIENT"
    FREELANCER = "FREELANCER"
    ADMIN = "ADMIN"


# the user record stored in the `users` table
class User(Base):
    __tablename__: str = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    # email is unique + indexed so lookups and the duplicate check are fast
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    # never store plaintext; only the bcrypt hash of the password
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # timestamps use DB server time so all rows stay consistent
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )