from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.models.user import User, UserRole
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
)

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
        avatar_url="https://example.com/logo.png",
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
