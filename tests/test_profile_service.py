from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.models.user import User, UserRole
from app.core.config import settings
from app.services.avatar_storage import (
    AvatarStorageNotConfiguredError,
    delete_avatar_asset,
    upload_avatar_asset,
)
from app.schemas.profile import (
    ClientProfileCreate,
    ClientProfileUpdate,
    FreelancerProfileCreate,
    FreelancerProfileUpdate,
    PortfolioItemCreate,
)
from app.services.profile_service import (
    add_portfolio_item,
    add_skill_to_freelancer,
    create_client_profile,
    create_freelancer_profile,
    get_client_profile,
    get_freelancer_profile,
    get_freelancer_skills,
    remove_skill_from_freelancer,
    update_client_profile,
    update_freelancer_profile,
    update_profile_avatar,
)
from app.services import profile_service

# create SQLite in-memory engine for fast service testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    # build database tables before each test and drop them after
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    # provide a clean database session per test
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client_user(db: Session) -> User:
    # create dummy client user account for testing
    user = User(
        full_name="Client User",
        email="client@example.com",
        hashed_password="hash",
        role=UserRole.CLIENT,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def freelancer_user(db: Session) -> User:
    # create dummy freelancer user account for testing
    user = User(
        full_name="Freelancer User",
        email="freelancer@example.com",
        hashed_password="hash",
        role=UserRole.FREELANCER,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_client_profile_crud(db: Session, client_user: User):
    # test client profile creation
    create_data = ClientProfileCreate(
        display_name="Tech Corp",
        bio="Leading tech company",
        location="Austin, TX",
    )
    profile = create_client_profile(db, client_user.id, create_data)
    assert profile.id is not None
    assert profile.user_id == client_user.id
    assert profile.display_name == "Tech Corp"

    # test client profile fetching
    fetched = get_client_profile(db, client_user.id)
    assert fetched is not None
    assert fetched.id == profile.id

    # test client profile update
    update_data = ClientProfileUpdate(display_name="Tech Corp Inc", location="Dallas, TX")
    updated = update_client_profile(db, client_user.id, update_data)
    assert updated is not None
    assert updated.display_name == "Tech Corp Inc"
    assert updated.location == "Dallas, TX"
    assert updated.bio == "Leading tech company"


def test_freelancer_profile_crud(db: Session, freelancer_user: User):
    # test freelancer profile creation with initial skills
    create_data = FreelancerProfileCreate(
        professional_title="Python Developer",
        bio="FastAPI specialist",
        hourly_rate=Decimal("65.00"),
        skills=["Python", "FastAPI"],
    )
    profile = create_freelancer_profile(db, freelancer_user.id, create_data)
    assert profile.id is not None
    assert profile.user_id == freelancer_user.id
    assert profile.hourly_rate == Decimal("65.00")
    assert len(profile.skills) == 2

    # test freelancer profile fetching
    fetched = get_freelancer_profile(db, freelancer_user.id)
    assert fetched is not None
    assert fetched.id == profile.id

    # test freelancer profile update
    update_data = FreelancerProfileUpdate(
        hourly_rate=Decimal("80.00"), skills=["Python", "PostgreSQL"]
    )
    updated = update_freelancer_profile(db, freelancer_user.id, update_data)
    assert updated is not None
    assert updated.hourly_rate == Decimal("80.00")
    skill_names = [s.name for s in updated.skills]
    assert "Python" in skill_names
    assert "PostgreSQL" in skill_names
    assert "FastAPI" not in skill_names


def test_skill_management_and_portfolio_items(db: Session, freelancer_user: User):
    # create initial freelancer profile
    create_data = FreelancerProfileCreate(
        professional_title="Dev",
        hourly_rate=Decimal("50.00"),
    )
    profile = create_freelancer_profile(db, freelancer_user.id, create_data)

    # add a skill explicitly
    added_skill = add_skill_to_freelancer(db, profile.id, "Docker")
    assert added_skill.name == "Docker"
    skills = get_freelancer_skills(db, profile.id)
    assert any(s.name == "Docker" for s in skills)

    # remove the skill
    removed = remove_skill_from_freelancer(db, profile.id, added_skill.id)
    assert removed is True
    skills_after = get_freelancer_skills(db, profile.id)
    assert not any(s.name == "Docker" for s in skills_after)

    # add portfolio item
    portfolio_data = PortfolioItemCreate(
        title="Microservice Project",
        description="Built with Docker and Python",
        url="https://github.com/example/microservice",
    )
    item = add_portfolio_item(db, profile.id, portfolio_data)
    assert item.id is not None
    assert item.freelancer_profile_id == profile.id
    assert item.title == "Microservice Project"


def test_avatar_replacement_commits_new_asset_before_deleting_old_one(
    db: Session,
    freelancer_user: User,
    monkeypatch: pytest.MonkeyPatch,
):
    # Establish an existing provider asset before recording replacement ordering.
    profile = create_freelancer_profile(
        db,
        freelancer_user.id,
        FreelancerProfileCreate(hourly_rate=Decimal("50.00")),
    )
    profile.avatar_url = "https://res.cloudinary.com/prolance/image/upload/old.jpg"
    profile.avatar_public_id = "prolance/avatars/old"
    db.commit()

    events: list[str] = []
    original_commit = db.commit

    def commit_and_record() -> None:
        original_commit()
        events.append("commit")

    def upload(_image_data: bytes) -> tuple[str, str]:
        events.append("upload")
        return "https://res.cloudinary.com/prolance/image/upload/new.jpg", "prolance/avatars/new"

    def delete(public_id: str) -> None:
        events.append(f"delete:{public_id}")

    monkeypatch.setattr(db, "commit", commit_and_record)
    monkeypatch.setattr(profile_service, "upload_avatar_asset", upload)
    monkeypatch.setattr(profile_service, "delete_avatar_asset", delete)

    avatar_url = update_profile_avatar(db, freelancer_user.id, "FREELANCER", b"image-bytes")

    assert avatar_url == "https://res.cloudinary.com/prolance/image/upload/new.jpg"
    assert profile.avatar_public_id == "prolance/avatars/new"
    assert events == ["upload", "commit", "delete:prolance/avatars/old"]


def test_avatar_upload_is_cleaned_up_when_profile_commit_fails(
    db: Session,
    freelancer_user: User,
    monkeypatch: pytest.MonkeyPatch,
):
    # A failed database write must not leave the just-uploaded remote image orphaned.
    create_freelancer_profile(
        db,
        freelancer_user.id,
        FreelancerProfileCreate(hourly_rate=Decimal("50.00")),
    )
    deleted_assets: list[str] = []

    def fail_commit() -> None:
        raise RuntimeError("database write failed")

    monkeypatch.setattr(
        profile_service,
        "upload_avatar_asset",
        lambda _image_data: (
            "https://res.cloudinary.com/prolance/image/upload/new.jpg",
            "prolance/avatars/new",
        ),
    )
    monkeypatch.setattr(profile_service, "delete_avatar_asset", deleted_assets.append)
    monkeypatch.setattr(db, "commit", fail_commit)

    with pytest.raises(RuntimeError, match="database write failed"):
        update_profile_avatar(db, freelancer_user.id, "FREELANCER", b"image-bytes")

    assert deleted_assets == ["prolance/avatars/new"]


def test_cloudinary_storage_uses_server_credentials_and_generated_asset_ids(
    monkeypatch: pytest.MonkeyPatch,
):
    # Provider calls use backend credentials and a namespaced server-generated public ID.
    monkeypatch.setattr(settings, "CLOUDINARY_CLOUD_NAME", "test-cloud")
    monkeypatch.setattr(settings, "CLOUDINARY_API_KEY", "test-key")
    monkeypatch.setattr(settings, "CLOUDINARY_API_SECRET", "test-secret")
    config_values: dict[str, object] = {}
    upload_values: dict[str, object] = {}
    destroy_values: dict[str, object] = {}

    def capture_config(**kwargs: object) -> None:
        config_values.update(kwargs)

    def capture_upload(_image_data: bytes, **kwargs: object) -> dict[str, str]:
        upload_values.update(kwargs)
        return {
            "secure_url": "https://res.cloudinary.com/test-cloud/image/upload/avatar.jpg",
            "public_id": f"prolance/avatars/{kwargs['public_id']}",
        }

    def capture_destroy(public_id: str, **kwargs: object) -> dict[str, str]:
        destroy_values.update({"public_id": public_id, **kwargs})
        return {"result": "ok"}

    monkeypatch.setattr("app.services.avatar_storage.cloudinary.config", capture_config)
    monkeypatch.setattr("app.services.avatar_storage.uploader.upload", capture_upload)
    monkeypatch.setattr("app.services.avatar_storage.uploader.destroy", capture_destroy)

    avatar_url, public_id = upload_avatar_asset(b"image-bytes")
    delete_avatar_asset(public_id)

    assert avatar_url == "https://res.cloudinary.com/test-cloud/image/upload/avatar.jpg"
    assert public_id.startswith("prolance/avatars/avatar-")
    assert config_values == {
        "cloud_name": "test-cloud",
        "api_key": "test-key",
        "api_secret": "test-secret",
        "secure": True,
    }
    assert upload_values["folder"] == "prolance/avatars"
    assert upload_values["resource_type"] == "image"
    assert destroy_values == {
        "public_id": public_id,
        "invalidate": True,
        "resource_type": "image",
    }


def test_cloudinary_storage_requires_complete_credentials(monkeypatch: pytest.MonkeyPatch):
    # Fail closed before making a provider request when any credential is absent.
    monkeypatch.setattr(settings, "CLOUDINARY_CLOUD_NAME", "test-cloud")
    monkeypatch.setattr(settings, "CLOUDINARY_API_KEY", "")
    monkeypatch.setattr(settings, "CLOUDINARY_API_SECRET", "test-secret")

    with pytest.raises(AvatarStorageNotConfiguredError):
        upload_avatar_asset(b"image-bytes")
