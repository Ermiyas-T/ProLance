import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import require_role
from app.models.profile import Skill
from app.models.user import User, UserRole
from app.schemas.profile import (
    ClientProfileCreate,
    ClientProfileOut,
    ClientProfileUpdate,
    FreelancerProfileCreate,
    FreelancerProfileOut,
    FreelancerProfileUpdate,
    AvatarUploadOut,
    PortfolioItemCreate,
    PortfolioItemOut,
    SkillOut,
)
from app.services.profile_service import (
    add_portfolio_item,
    add_skill_to_freelancer,
    create_client_profile,
    create_freelancer_profile,
    get_client_profile,
    get_freelancer_profile,
    remove_skill_from_freelancer,
    update_client_profile,
    update_freelancer_profile,
    update_profile_avatar,
)
from app.services.avatar_storage import AvatarStorageError, AvatarStorageNotConfiguredError

# router grouping for profile management endpoints
router = APIRouter(prefix="/profiles", tags=["profiles"])

MAX_AVATAR_BYTES = 5 * 1024 * 1024
AVATAR_TYPES = {
    "image/jpeg": (b"\xff\xd8\xff", ".jpg"),
    "image/png": (b"\x89PNG\r\n\x1a\n", ".png"),
    "image/gif": (b"GIF8", ".gif"),
    "image/webp": (b"RIFF", ".webp"),
}
# validate declared and actual image content before it reaches public storage
def _validate_avatar(data: bytes, content_type: str | None) -> str:
    if content_type not in AVATAR_TYPES:
        raise HTTPException(status_code=415, detail="Use a JPEG, PNG, GIF, or WebP image")
    if len(data) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=413, detail="Profile images must be 5 MB or smaller")

    signature, extension = AVATAR_TYPES[content_type]
    is_valid_signature = data.startswith(signature)
    if content_type == "image/webp":
        is_valid_signature = is_valid_signature and data[8:12] == b"WEBP"
    if not is_valid_signature:
        raise HTTPException(status_code=415, detail="The uploaded file is not a valid image")
    return extension


@router.post("/me/avatar", response_model=AvatarUploadOut)
def upload_my_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CLIENT, UserRole.FREELANCER)),
):
    # read one byte beyond the limit so oversized uploads are rejected without storing them
    image_data = file.file.read(MAX_AVATAR_BYTES + 1)
    _validate_avatar(image_data, file.content_type)

    # FastAPI runs this synchronous handler in a worker thread while Cloudinary and SQLAlchemy block.
    try:
        avatar_url = update_profile_avatar(db, current_user.id, current_user.role.value, image_data)
    except AvatarStorageNotConfiguredError:
        raise HTTPException(status_code=503, detail="Profile image storage is not configured") from None
    except AvatarStorageError:
        raise HTTPException(status_code=502, detail="Could not store profile image") from None
    if avatar_url is None:
        raise HTTPException(status_code=404, detail="Create your profile before uploading an image")
    return AvatarUploadOut(avatar_url=avatar_url)


# --- Client Profile Endpoints ---


@router.post(
    "/client",
    response_model=ClientProfileOut,
    status_code=status.HTTP_201_CREATED,
)
def create_client_profile_endpoint(
    data: ClientProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CLIENT)),
):
    # check if client profile already exists for current user
    if get_client_profile(db, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Client profile already exists",
        )
    return create_client_profile(db, current_user.id, data)


@router.get("/client/me", response_model=ClientProfileOut)
def get_my_client_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CLIENT, UserRole.ADMIN)),
):
    # fetch client profile owned by current user
    profile = get_client_profile(db, current_user.id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client profile not found",
        )
    return profile


@router.put("/client/me", response_model=ClientProfileOut)
def update_my_client_profile(
    data: ClientProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CLIENT)),
):
    # update client profile owned by current user
    profile = update_client_profile(db, current_user.id, data)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client profile not found",
        )
    return profile


# --- Freelancer Profile Endpoints ---


@router.post(
    "/freelancer",
    response_model=FreelancerProfileOut,
    status_code=status.HTTP_201_CREATED,
)
def create_freelancer_profile_endpoint(
    data: FreelancerProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.FREELANCER)),
):
    # check if freelancer profile already exists for current user
    if get_freelancer_profile(db, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Freelancer profile already exists",
        )
    return create_freelancer_profile(db, current_user.id, data)


@router.get("/freelancer/me", response_model=FreelancerProfileOut)
def get_my_freelancer_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.FREELANCER, UserRole.ADMIN)),
):
    # fetch freelancer profile owned by current user
    profile = get_freelancer_profile(db, current_user.id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Freelancer profile not found",
        )
    return profile


@router.put("/freelancer/me", response_model=FreelancerProfileOut)
def update_my_freelancer_profile(
    data: FreelancerProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.FREELANCER)),
):
    # update freelancer profile owned by current user
    profile = update_freelancer_profile(db, current_user.id, data)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Freelancer profile not found",
        )
    return profile


# --- Skill & Portfolio Endpoints ---


@router.post("/freelancer/skills", response_model=SkillOut)
def add_skill_to_my_profile(
    skill_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.FREELANCER)),
):
    # ensure current freelancer has a created profile before linking skills
    profile = get_freelancer_profile(db, current_user.id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Freelancer profile not found",
        )
    return add_skill_to_freelancer(db, profile.id, skill_name)


@router.delete(
    "/freelancer/skills/{skill_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_skill_from_my_profile(
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.FREELANCER)),
):
    # ensure current freelancer has a profile
    profile = get_freelancer_profile(db, current_user.id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Freelancer profile not found",
        )
    # remove skill association
    removed = remove_skill_from_freelancer(db, profile.id, skill_id)
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Skill association not found on profile",
        )
    return None


@router.post(
    "/freelancer/portfolio",
    response_model=PortfolioItemOut,
    status_code=status.HTTP_201_CREATED,
)
def add_portfolio_item_to_my_profile(
    data: PortfolioItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.FREELANCER)),
):
    # ensure current freelancer has a profile
    profile = get_freelancer_profile(db, current_user.id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Freelancer profile not found",
        )
    return add_portfolio_item(db, profile.id, data)


# --- Public & Admin Endpoints ---


@router.get("/freelancer/{user_id}", response_model=FreelancerProfileOut)
def get_freelancer_profile_public(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    # public view allowing anyone to view a freelancer profile by user_id
    profile = get_freelancer_profile(db, user_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Freelancer profile not found",
        )
    return profile


# auxiliary route for listing available skills in system
skills_router = APIRouter(tags=["skills"])


@skills_router.get("/skills", response_model=list[SkillOut])
def list_skills(
    db: Session = Depends(get_db),
):
    # list all normalized skills registered in system
    return list(db.scalars(select(Skill)).all())
