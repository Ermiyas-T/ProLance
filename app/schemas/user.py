from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole


# validates the body of POST /auth/register
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    role: UserRole


# validates the body of POST /auth/login
class UserLogin(BaseModel):
    email: EmailStr
    password: str


# the shape we return to the client (never exposes the password hash)
class UserOut(BaseModel):
    # allow building this schema straight from a SQLAlchemy User row
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    role: UserRole
    is_active: bool
    created_at: datetime


# the login success payload containing the JWT
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# the identity decoded out of a token (user id + role)
class TokenData(BaseModel):
    user_id: int | None = None
    role: UserRole | None = None