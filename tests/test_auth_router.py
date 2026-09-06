import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.user import User, UserRole
from app.schemas.user import UserCreate
from app.services import user_service


# share one in-memory SQLite database across TestClient's worker thread
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# rebuild schema for each test so registration cases stay isolated
@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


# provide an independent session for database assertions and service tests
@pytest.fixture
def db() -> Session:
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


# route FastAPI database dependencies to the isolated test session
@pytest.fixture
def client(db: Session):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


# create a valid registration payload that individual tests can override
@pytest.fixture
def registration_payload() -> dict[str, str]:
    return {
        "full_name": "Ada Lovelace",
        "email": "ada@example.com",
        "password": "secure-password",
        "role": "FREELANCER",
    }


@pytest.mark.parametrize("role", ["CLIENT", "FREELANCER"])
def test_registers_public_roles_with_account_name(
    client: TestClient,
    db: Session,
    registration_payload: dict[str, str],
    role: str,
):
    # verify both permitted public roles create a complete account identity
    registration_payload["role"] = role
    response = client.post("/auth/register", json=registration_payload)

    assert response.status_code == 201
    response_data = response.json()
    assert response_data["full_name"] == "Ada Lovelace"
    assert response_data["role"] == role

    # confirm only a bcrypt hash reaches persistence
    created_user = db.get(User, response_data["id"])
    assert created_user is not None
    assert created_user.hashed_password != registration_payload["password"]
    assert created_user.full_name == "Ada Lovelace"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("full_name", "   "),
        ("full_name", "a" * 121),
        ("email", "not-an-email"),
        ("password", "short"),
        ("role", "ADMIN"),
    ],
)
def test_registration_rejects_invalid_input(
    client: TestClient,
    registration_payload: dict[str, str],
    field: str,
    value: str,
):
    # validate each unsafe or incomplete registration input at the API boundary
    registration_payload[field] = value
    response = client.post("/auth/register", json=registration_payload)

    assert response.status_code == 422


def test_registration_requires_full_name(client: TestClient, registration_payload: dict[str, str]):
    # require the account identity explicitly instead of silently inventing one
    registration_payload.pop("full_name")
    response = client.post("/auth/register", json=registration_payload)

    assert response.status_code == 422


def test_registration_normalizes_email_and_reports_duplicate_conflict(
    client: TestClient, registration_payload: dict[str, str]
):
    # create the canonical account before attempting a case-and-space variant
    first_response = client.post("/auth/register", json=registration_payload)
    duplicate_payload = registration_payload | {"email": "  ADA@EXAMPLE.COM  "}
    duplicate_response = client.post("/auth/register", json=duplicate_payload)

    assert first_response.status_code == 201
    assert first_response.json()["email"] == "ada@example.com"
    assert duplicate_response.status_code == 409
    assert duplicate_response.json()["detail"] == "Email already registered"


def test_duplicate_integrity_error_is_translated_to_domain_conflict(
    db: Session, registration_payload: dict[str, str], monkeypatch: pytest.MonkeyPatch
):
    # model the race where another request inserts the email after the initial lookup
    data = UserCreate(**registration_payload)
    existing_user = User(
        full_name="Existing User",
        email=data.email,
        hashed_password=hash_password("another-password"),
        role=UserRole.FREELANCER,
    )
    lookup_results = iter([None, existing_user])

    def race_aware_lookup(_: Session, __: str) -> User | None:
        return next(lookup_results)

    def duplicate_commit() -> None:
        raise IntegrityError("INSERT", {}, Exception("unique violation"))

    # replace only the race-sensitive collaborators while keeping service control flow intact
    monkeypatch.setattr(user_service, "get_user_by_email", race_aware_lookup)
    monkeypatch.setattr(db, "commit", duplicate_commit)

    with pytest.raises(user_service.UserAlreadyExistsError):
        user_service.create_user(db, data)


def test_inactive_user_cannot_log_in(client: TestClient, db: Session):
    # insert a suspended account to verify it cannot receive a fresh access token
    inactive_user = User(
        full_name="Inactive User",
        email="inactive@example.com",
        hashed_password=hash_password("secure-password"),
        role=UserRole.CLIENT,
        is_active=False,
    )
    db.add(inactive_user)
    db.commit()

    response = client.post(
        "/auth/login",
        json={"email": " INACTIVE@EXAMPLE.COM ", "password": "secure-password"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"


def test_me_returns_account_name_after_login(
    client: TestClient, registration_payload: dict[str, str]
):
    # authenticate a newly registered user before verifying the account identity response
    register_response = client.post("/auth/register", json=registration_payload)
    login_response = client.post(
        "/auth/login",
        json={"email": registration_payload["email"], "password": registration_payload["password"]},
    )

    access_token = login_response.json()["access_token"]
    me_response = client.get("/auth/me", headers={"Authorization": f"Bearer {access_token}"})

    assert register_response.status_code == 201
    assert login_response.status_code == 200
    assert me_response.status_code == 200
    assert me_response.json()["full_name"] == registration_payload["full_name"]
