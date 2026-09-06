from collections.abc import Generator
from pathlib import Path
import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# make the application package importable when pytest starts inside tests/
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.models  # noqa: F401
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.profile import Skill
from app.models.user import User, UserRole
from helpers import auth_headers, make_user

# share one in-memory SQLite database with FastAPI's test worker thread
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def setup_database() -> Generator[None, None, None]:
    # rebuild all mapped tables for each test to keep workflow cases isolated
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db(setup_database: None) -> Generator[Session, None, None]:
    # provide one SQLAlchemy session that tests and dependency overrides can share
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db: Session) -> Generator[TestClient, None, None]:
    # route application database access to the same isolated test session
    def override_get_db() -> Generator[Session, None, None]:
        yield db

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def client_user(db: Session) -> User:
    # provide a client account that can own projects
    return make_user(db, UserRole.CLIENT, "client@example.com", "Client User")


@pytest.fixture
def other_client_user(db: Session) -> User:
    # provide a second client account for object-level authorization checks
    return make_user(db, UserRole.CLIENT, "other-client@example.com", "Other Client")


@pytest.fixture
def freelancer_user(db: Session) -> User:
    # provide a freelancer account that can submit proposals
    return make_user(db, UserRole.FREELANCER, "freelancer@example.com", "Freelancer User")


@pytest.fixture
def other_freelancer_user(db: Session) -> User:
    # provide a second freelancer account for competing proposal workflows
    return make_user(
        db,
        UserRole.FREELANCER,
        "other-freelancer@example.com",
        "Other Freelancer",
    )


@pytest.fixture
def admin_user(db: Session) -> User:
    # provide an admin account for role guard tests
    return make_user(db, UserRole.ADMIN, "admin@example.com", "Admin User")


@pytest.fixture
def client_headers(client_user: User) -> dict[str, str]:
    # authenticate the default client account
    return auth_headers(client_user)


@pytest.fixture
def other_client_headers(other_client_user: User) -> dict[str, str]:
    # authenticate the second client account
    return auth_headers(other_client_user)


@pytest.fixture
def freelancer_headers(freelancer_user: User) -> dict[str, str]:
    # authenticate the default freelancer account
    return auth_headers(freelancer_user)


@pytest.fixture
def admin_headers(admin_user: User) -> dict[str, str]:
    # authenticate an admin account
    return auth_headers(admin_user)


@pytest.fixture
def python_skill(db: Session) -> Skill:
    # seed a reusable skill that projects can require
    skill = Skill(name="Python")
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill
