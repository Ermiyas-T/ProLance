from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.profile import ClientProfile, FreelancerProfile
from app.models.user import User, UserRole
from app.services.avatar_storage import AvatarStorageError, AvatarStorageNotConfiguredError

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
def freelancer_user(db) -> User:
    # insert freelancer user into database
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


@pytest.fixture
def client_headers(client_user: User) -> dict[str, str]:
    # generate auth headers for client user
    token = create_access_token({"user_id": str(client_user.id), "role": client_user.role.value})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def freelancer_headers(freelancer_user: User) -> dict[str, str]:
    # generate auth headers for freelancer user
    token = create_access_token(
        {"user_id": str(freelancer_user.id), "role": freelancer_user.role.value}
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


@pytest.mark.parametrize("role", [UserRole.CLIENT, UserRole.FREELANCER])
def test_avatar_upload_persists_cloudinary_asset(
    client: TestClient,
    db,
    client_user: User,
    freelancer_user: User,
    client_headers: dict[str, str],
    freelancer_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
    role: UserRole,
):
    # Create the role-specific profile before exercising the authenticated upload route.
    if role is UserRole.CLIENT:
        user, headers = client_user, client_headers
        response = client.post(
            "/profiles/client",
            json={"display_name": "Client"},
            headers=headers,
        )
        assert response.status_code == 201
        profile_model = ClientProfile
    else:
        user, headers = freelancer_user, freelancer_headers
        response = client.post(
            "/profiles/freelancer",
            json={"hourly_rate": "50.00"},
            headers=headers,
        )
        assert response.status_code == 201
        profile_model = FreelancerProfile

    # Replace the remote call while retaining the real profile persistence behavior.
    monkeypatch.setattr(
        "app.services.profile_service.upload_avatar_asset",
        lambda image_data: (
            "https://res.cloudinary.com/prolance/image/upload/avatar.jpg",
            "prolance/avatars/avatar",
        ),
    )
    response = client.post(
        "/profiles/me/avatar",
        files={"file": ("avatar.png", b"\x89PNG\r\n\x1a\nimage-data", "image/png")},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json() == {
        "avatar_url": "https://res.cloudinary.com/prolance/image/upload/avatar.jpg"
    }
    profile = db.query(profile_model).filter_by(user_id=user.id).one()
    assert profile.avatar_url == response.json()["avatar_url"]
    assert profile.avatar_public_id == "prolance/avatars/avatar"


def test_avatar_upload_requires_existing_profile_and_does_not_upload(
    client: TestClient,
    client_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
):
    # Reject the request before creating a remote asset when setup is incomplete.
    upload_called = False

    def fail_if_uploaded(_image_data: bytes) -> tuple[str, str]:
        nonlocal upload_called
        upload_called = True
        raise AssertionError("Cloudinary upload should not run")

    monkeypatch.setattr("app.services.profile_service.upload_avatar_asset", fail_if_uploaded)
    response = client.post(
        "/profiles/me/avatar",
        files={"file": ("avatar.png", b"\x89PNG\r\n\x1a\nimage-data", "image/png")},
        headers=client_headers,
    )

    assert response.status_code == 404
    assert not upload_called


@pytest.mark.parametrize(
    ("storage_error", "status_code"),
    [
        (AvatarStorageNotConfiguredError("missing config"), 503),
        (AvatarStorageError("provider failure"), 502),
    ],
)
def test_avatar_upload_reports_safe_storage_errors(
    client: TestClient,
    client_user: User,
    client_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
    storage_error: Exception,
    status_code: int,
):
    # Provider failures must not expose Cloudinary details in the API response.
    client.post("/profiles/client", json={"display_name": "Client"}, headers=client_headers)

    def fail_upload(_image_data: bytes) -> tuple[str, str]:
        raise storage_error

    monkeypatch.setattr("app.services.profile_service.upload_avatar_asset", fail_upload)
    response = client.post(
        "/profiles/me/avatar",
        files={"file": ("avatar.png", b"\x89PNG\r\n\x1a\nimage-data", "image/png")},
        headers=client_headers,
    )

    assert response.status_code == status_code
    assert "Cloudinary" not in response.json()["detail"]


def test_avatar_upload_rejects_invalid_image_signature(
    client: TestClient,
    client_user: User,
    client_headers: dict[str, str],
):
    # A declared image MIME type is insufficient when its contents are not an image.
    client.post("/profiles/client", json={"display_name": "Client"}, headers=client_headers)
    response = client.post(
        "/profiles/me/avatar",
        files={"file": ("avatar.png", b"not-an-image", "image/png")},
        headers=client_headers,
    )

    assert response.status_code == 415


def test_avatar_upload_requires_authentication(client: TestClient):
    # Do not allow anonymous callers to create assets in the platform Cloudinary account.
    response = client.post(
        "/profiles/me/avatar",
        files={"file": ("avatar.png", b"\x89PNG\r\n\x1a\nimage-data", "image/png")},
    )

    assert response.status_code == 401


def test_avatar_upload_rejects_wrong_role(client: TestClient, admin_user: User):
    # Admin accounts are not profile owners and must not use the avatar upload route.
    token = create_access_token({"user_id": str(admin_user.id), "role": admin_user.role.value})
    response = client.post(
        "/profiles/me/avatar",
        files={"file": ("avatar.png", b"\x89PNG\r\n\x1a\nimage-data", "image/png")},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403


def test_avatar_upload_rejects_oversized_image(
    client: TestClient,
    client_user: User,
    client_headers: dict[str, str],
):
    # Reject oversized input before forwarding any bytes to Cloudinary.
    client.post("/profiles/client", json={"display_name": "Client"}, headers=client_headers)
    oversized_image = b"\x89PNG\r\n\x1a\n" + b"x" * (5 * 1024 * 1024)
    response = client.post(
        "/profiles/me/avatar",
        files={"file": ("avatar.png", oversized_image, "image/png")},
        headers=client_headers,
    )

    assert response.status_code == 413

    # client attempting to call freelancer endpoint should fail with 403
    response = client.post(
        "/profiles/freelancer",
        json={"hourly_rate": 100.00},
        headers=client_headers,
    )
    assert response.status_code == 403
