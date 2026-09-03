from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.user import User, UserRole

from sqlalchemy.pool import StaticPool

# create in-memory SQLite engine using StaticPool so threads share the same in-memory database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    # recreate database schema before each test
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    # provide isolated test session
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    # override get_db dependency for TestClient to use SQLite in-memory DB
    def _override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def client_user(db) -> User:
    # insert client user into database
    user = User(email="client@example.com", hashed_password="hash", role=UserRole.CLIENT)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def freelancer_user(db) -> User:
    # insert freelancer user into database
    user = User(email="freelancer@example.com", hashed_password="hash", role=UserRole.FREELANCER)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def client_headers(client_user: User) -> dict[str, str]:
    # generate auth headers for client user
    token = create_access_token({"user_id": client_user.id, "role": client_user.role.value})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def freelancer_headers(freelancer_user: User) -> dict[str, str]:
    # generate auth headers for freelancer user
    token = create_access_token(
        {"user_id": freelancer_user.id, "role": freelancer_user.role.value}
    )
    return {"Authorization": f"Bearer {token}"}


def test_client_profile_endpoints(client: TestClient, client_headers: dict[str, str]):
    # test POST /profiles/client
    response = client.post(
        "/profiles/client",
        json={"display_name": "Acme Inc", "bio": "Innovators"},
        headers=client_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["display_name"] == "Acme Inc"

    # test GET /profiles/client/me
    response = client.get("/profiles/client/me", headers=client_headers)
    assert response.status_code == 200
    assert response.json()["display_name"] == "Acme Inc"

    # test PUT /profiles/client/me
    response = client.put(
        "/profiles/client/me",
        json={"display_name": "Acme Global"},
        headers=client_headers,
    )
    assert response.status_code == 200
    assert response.json()["display_name"] == "Acme Global"


def test_freelancer_profile_endpoints(
    client: TestClient, freelancer_headers: dict[str, str], freelancer_user: User
):
    # test POST /profiles/freelancer
    response = client.post(
        "/profiles/freelancer",
        json={
            "professional_title": "Backend Dev",
            "hourly_rate": 75.00,
            "skills": ["Python", "FastAPI"],
        },
        headers=freelancer_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["professional_title"] == "Backend Dev"
    assert len(data["skills"]) == 2

    # test GET /profiles/freelancer/me
    response = client.get("/profiles/freelancer/me", headers=freelancer_headers)
    assert response.status_code == 200
    assert response.json()["professional_title"] == "Backend Dev"

    # test public GET /profiles/freelancer/{user_id}
    response = client.get(f"/profiles/freelancer/{freelancer_user.id}")
    assert response.status_code == 200
    assert response.json()["professional_title"] == "Backend Dev"

    # test GET /skills
    response = client.get("/skills")
    assert response.status_code == 200
    skill_names = [s["name"] for s in response.json()]
    assert "Python" in skill_names


def test_freelancer_skill_and_portfolio_endpoints(
    client: TestClient, freelancer_headers: dict[str, str]
):
    # create profile first
    client.post(
        "/profiles/freelancer",
        json={"professional_title": "Dev", "hourly_rate": 50.00},
        headers=freelancer_headers,
    )

    # test POST /profiles/freelancer/skills
    response = client.post(
        "/profiles/freelancer/skills?skill_name=Docker",
        headers=freelancer_headers,
    )
    assert response.status_code == 200
    skill_id = response.json()["id"]

    # test DELETE /profiles/freelancer/skills/{skill_id}
    response = client.delete(
        f"/profiles/freelancer/skills/{skill_id}",
        headers=freelancer_headers,
    )
    assert response.status_code == 204

    # test POST /profiles/freelancer/portfolio
    response = client.post(
        "/profiles/freelancer/portfolio",
        json={"title": "My App", "description": "Awesome app"},
        headers=freelancer_headers,
    )
    assert response.status_code == 201
    assert response.json()["title"] == "My App"


def test_authorization_role_guards(
    client: TestClient, client_headers: dict[str, str], freelancer_headers: dict[str, str]
):
    # freelancer attempting to call client endpoint should fail with 403
    response = client.post(
        "/profiles/client",
        json={"display_name": "Sneaky Freelancer"},
        headers=freelancer_headers,
    )
    assert response.status_code == 403

    # client attempting to call freelancer endpoint should fail with 403
    response = client.post(
        "/profiles/freelancer",
        json={"hourly_rate": 100.00},
        headers=client_headers,
    )
    assert response.status_code == 403
