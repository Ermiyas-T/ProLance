from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.profile import Skill
from app.models.user import User, UserRole
from app.schemas.profile import (
    ClientProfileCreate,
    ClientProfileOut,
    ClientProfileUpdate,
    FreelancerProfileCreate,
    FreelancerProfileOut,
    FreelancerProfileUpdate,
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
)

# router grouping for profile management endpoints
router = APIRouter(prefix="/profiles", tags=["profiles"])


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
    user_id: int,
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
