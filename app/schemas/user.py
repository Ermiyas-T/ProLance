import enum
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.user import UserRole


# limits public self-registration without weakening the persisted role enum
class PublicRegistrationRole(str, enum.Enum):
    CLIENT = UserRole.CLIENT.value
    FREELANCER = UserRole.FREELANCER.value


# validates the body of POST /auth/register
class UserCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8)
    role: PublicRegistrationRole

    # normalize names so whitespace-only values cannot become account identities
    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str) -> str:
        normalized_name = value.strip()
        if not normalized_name:
            raise ValueError("Full name must not be blank")
        return normalized_name

    # normalize email before persistence so duplicate checks are case-insensitive
    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


# validates the body of POST /auth/login
class UserLogin(BaseModel):
    email: EmailStr
    password: str

    # apply the same normalization used during registration before lookup
    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


# the shape we return to the client (never exposes the password hash)
class UserOut(BaseModel):
    # allow building this schema straight from a SQLAlchemy User row
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
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
