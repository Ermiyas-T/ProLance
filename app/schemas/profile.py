import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

# --- Skill Schemas ---


# representation of a Skill returned by the API
class SkillOut(BaseModel):
    # allow building this schema straight from a SQLAlchemy Skill model
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


# --- Portfolio Item Schemas ---


# payload to create a new portfolio item under a freelancer profile
class PortfolioItemCreate(BaseModel):
    # reject any client-sent id or unexpected fields
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    url: str | None = None


# representation of a PortfolioItem returned by the API
class PortfolioItemOut(BaseModel):
    # allow building this schema straight from a SQLAlchemy PortfolioItem model
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    freelancer_profile_id: uuid.UUID
    title: str
    description: str | None = None
    url: str | None = None
    created_at: datetime


# --- Client Profile Schemas ---


# payload to create a client profile for the authenticated client user
class ClientProfileCreate(BaseModel):
    # reject any client-sent id or unexpected fields
    model_config = ConfigDict(extra="forbid")

    display_name: str = Field(min_length=1, max_length=100)
    bio: str | None = None
    location: str | None = Field(default=None, max_length=100)


# payload for partial updates of a client profile (all fields optional)
class ClientProfileUpdate(BaseModel):
    # reject any client-sent id or unexpected fields
    model_config = ConfigDict(extra="forbid")

    display_name: str | None = Field(default=None, min_length=1, max_length=100)
    bio: str | None = None
    location: str | None = Field(default=None, max_length=100)


# representation of a ClientProfile returned by the API
class ClientProfileOut(BaseModel):
    # allow building this schema straight from a SQLAlchemy ClientProfile model
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    display_name: str
    bio: str | None = None
    location: str | None = None
    avatar_url: str | None = None
    created_at: datetime
    updated_at: datetime


# --- Freelancer Profile Schemas ---


# payload to create a freelancer profile for the authenticated freelancer user
class FreelancerProfileCreate(BaseModel):
    # reject any client-sent id or unexpected fields
    model_config = ConfigDict(extra="forbid")

    professional_title: str | None = Field(default=None, max_length=100)
    bio: str | None = None
    # hourly_rate must be greater than zero for valid monetary representation
    hourly_rate: Decimal = Field(gt=Decimal("0.00"), decimal_places=2)
    # optional list of skill names to associate during creation
    skills: list[str] = Field(default_factory=list)


# payload for partial updates of a freelancer profile (all fields optional)
class FreelancerProfileUpdate(BaseModel):
    # reject any client-sent id or unexpected fields
    model_config = ConfigDict(extra="forbid")

    professional_title: str | None = Field(default=None, max_length=100)
    bio: str | None = None
    hourly_rate: Decimal | None = Field(default=None, gt=Decimal("0.00"), decimal_places=2)
    skills: list[str] | None = None


# representation of a FreelancerProfile returned by the API
class FreelancerProfileOut(BaseModel):
    # allow building this schema straight from a SQLAlchemy FreelancerProfile model
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    professional_title: str | None = None
    bio: str | None = None
    avatar_url: str | None = None
    hourly_rate: Decimal
    # ISO 4217 code for the hourly rate (ETB is the platform default)
    currency: str
    # running aggregate rating of the freelancer
    avg_rating: Decimal = Decimal("0.00")
    # counter of completed contracts
    completed_projects_count: int = 0
    skills: list[SkillOut] = Field(default_factory=list)
    portfolio_items: list[PortfolioItemOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


# return the public URL after a validated avatar upload
class AvatarUploadOut(BaseModel):
    avatar_url: str
