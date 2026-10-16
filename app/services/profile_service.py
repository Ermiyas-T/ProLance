import logging
import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.services.avatar_storage import (
    AvatarStorageError,
    AvatarStorageNotConfiguredError,
    delete_avatar_asset,
    upload_avatar_asset,
)
from app.models.profile import ClientProfile, FreelancerProfile, PortfolioItem, Skill
from app.schemas.profile import (
    ClientProfileCreate,
    ClientProfileUpdate,
    FreelancerProfileCreate,
    FreelancerProfileUpdate,
    PortfolioItemCreate,
)

logger = logging.getLogger(__name__)


# fetch client profile by user ID or return None if not found
def get_client_profile(db: Session, user_id: uuid.UUID) -> ClientProfile | None:
    # querying using SQLAlchemy 2.x scalar select on unique user_id
    return db.scalar(select(ClientProfile).where(ClientProfile.user_id == user_id))


# create a new client profile for the authenticated client user
def create_client_profile(db: Session, user_id: uuid.UUID, data: ClientProfileCreate) -> ClientProfile:
    # create the SQLAlchemy ClientProfile model instance bound to the user
    profile = ClientProfile(
        user_id=user_id,
        display_name=data.display_name,
        bio=data.bio,
        location=data.location,
    )
    # add and commit to database, then refresh to populate generated fields
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


# update an existing client profile using non-None fields from update schema
def update_client_profile(
    db: Session, user_id: uuid.UUID, data: ClientProfileUpdate
) -> ClientProfile | None:
    # retrieve existing profile row for user
    profile = get_client_profile(db, user_id)
    if not profile:
        return None

    # update only fields explicitly provided in the request
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    # save changes to database and refresh profile
    db.commit()
    db.refresh(profile)
    return profile


# fetch freelancer profile by user ID or return None if not found
def get_freelancer_profile(db: Session, user_id: uuid.UUID) -> FreelancerProfile | None:
    # querying using SQLAlchemy 2.x scalar select on unique user_id
    return db.scalar(select(FreelancerProfile).where(FreelancerProfile.user_id == user_id))


# get or create a normalized skill instance by name
def _get_or_create_skill(db: Session, skill_name: str) -> Skill:
    # normalize skill name by trimming whitespace
    normalized_name = skill_name.strip()
    # check if skill already exists in database
    skill = db.scalar(select(Skill).where(Skill.name == normalized_name))
    if not skill:
        # create and persist new normalized skill if absent
        skill = Skill(name=normalized_name)
        db.add(skill)
        db.flush()
    return skill


# create a freelancer profile for the authenticated freelancer user
def create_freelancer_profile(
    db: Session, user_id: uuid.UUID, data: FreelancerProfileCreate
) -> FreelancerProfile:
    # instantiate profile row with primary fields
    profile = FreelancerProfile(
        user_id=user_id,
        professional_title=data.professional_title,
        bio=data.bio,
        hourly_rate=data.hourly_rate,
    )
    # add profile to session so relationship population during flush proceeds cleanly
    db.add(profile)

    # resolve and associate requested skill names
    if data.skills:
        for skill_name in data.skills:
            skill = _get_or_create_skill(db, skill_name)
            profile.skills.append(skill)

    # commit session to save profile and skill relations
    db.commit()
    db.refresh(profile)
    return profile


# update an existing freelancer profile using non-None fields from update schema
def update_freelancer_profile(
    db: Session, user_id: uuid.UUID, data: FreelancerProfileUpdate
) -> FreelancerProfile | None:
    # retrieve existing profile row for user
    profile = get_freelancer_profile(db, user_id)
    if not profile:
        return None

    # dump only provided payload fields
    update_data = data.model_dump(exclude_unset=True)

    # handle skills list separately if provided in update payload
    if "skills" in update_data:
        skill_names = update_data.pop("skills")
        if skill_names is not None:
            # clear existing skills and replace with newly specified skills
            profile.skills.clear()
            for skill_name in skill_names:
                skill = _get_or_create_skill(db, skill_name)
                profile.skills.append(skill)

    # apply scalar field updates
    for field, value in update_data.items():
        setattr(profile, field, value)

    # commit updates to database and refresh profile
    db.commit()
    db.refresh(profile)
    return profile


# persist a validated avatar URL on the role-specific profile record
def update_profile_avatar(
    db: Session, user_id: uuid.UUID, role: str, image_data: bytes
) -> str | None:
    # Resolve the profile first so missing profiles never create orphan Cloudinary assets.
    profile = (
        get_client_profile(db, user_id)
        if role == "CLIENT"
        else get_freelancer_profile(db, user_id)
    )
    if not profile:
        return None

    # Upload a new asset before changing the profile so the old avatar remains available.
    avatar_url, public_id = upload_avatar_asset(image_data)
    previous_public_id = profile.avatar_public_id
    profile.avatar_url = avatar_url
    profile.avatar_public_id = public_id
    try:
        # Commit the new reference before removing the previous remote asset.
        db.commit()
    except Exception:
        db.rollback()
        try:
            delete_avatar_asset(public_id)
        except (AvatarStorageError, AvatarStorageNotConfiguredError):
            logger.exception("Failed to clean up a Cloudinary avatar after profile persistence failed")
        raise

    # Old assets are cleanup-only; a provider error must not undo a successful profile update.
    if previous_public_id and previous_public_id != public_id:
        try:
            delete_avatar_asset(previous_public_id)
        except (AvatarStorageError, AvatarStorageNotConfiguredError):
            logger.exception("Failed to clean up the previous Cloudinary avatar")
    return avatar_url


# add a new skill by name to a freelancer profile
def add_skill_to_freelancer(db: Session, profile_id: uuid.UUID, skill_name: str) -> Skill:
    # fetch freelancer profile by ID
    profile = db.get(FreelancerProfile, profile_id)
    if not profile:
        raise ValueError(f"Freelancer profile {profile_id} not found")

    # lookup or insert normalized skill entity
    skill = _get_or_create_skill(db, skill_name)

    # attach skill if not already linked
    if skill not in profile.skills:
        profile.skills.append(skill)
        db.commit()
    return skill


# remove a skill link from a freelancer profile
def remove_skill_from_freelancer(db: Session, profile_id: uuid.UUID, skill_id: int) -> bool:
    # fetch freelancer profile by ID
    profile = db.get(FreelancerProfile, profile_id)
    if not profile:
        raise ValueError(f"Freelancer profile {profile_id} not found")

    # locate target skill within existing linked skills
    target_skill = next((s for s in profile.skills if s.id == skill_id), None)
    if not target_skill:
        return False

    # unlink skill and commit
    profile.skills.remove(target_skill)
    db.commit()
    return True


# retrieve all skills associated with a given freelancer profile
def get_freelancer_skills(db: Session, profile_id: uuid.UUID) -> list[Skill]:
    # fetch profile and return associated skills list
    profile = db.get(FreelancerProfile, profile_id)
    if not profile:
        return []
    return list(profile.skills)


# add a new portfolio item under a freelancer profile
def add_portfolio_item(
    db: Session, profile_id: uuid.UUID, data: PortfolioItemCreate
) -> PortfolioItem:
    # ensure freelancer profile exists
    profile = db.get(FreelancerProfile, profile_id)
    if not profile:
        raise ValueError(f"Freelancer profile {profile_id} not found")

    # instantiate portfolio item
    item = PortfolioItem(
        freelancer_profile_id=profile_id,
        title=data.title,
        description=data.description,
        url=data.url,
    )
    # persist portfolio item in database
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
