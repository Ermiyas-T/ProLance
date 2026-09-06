from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.models.contract import Contract, ContractStatus
from app.models.project import Project, ProjectStatus
from app.models.proposal import Proposal, ProposalStatus
from app.models.user import User, UserRole


def make_user(db: Session, role: UserRole, email: str, full_name: str | None = None) -> User:
    # create a persisted account for authentication and ownership tests
    user = User(
        full_name=full_name or role.value.title(),
        email=email,
        hashed_password="hashed-password",
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def auth_headers(user: User) -> dict[str, str]:
    # sign the same identity shape produced by the real login endpoint
    token = create_access_token({"user_id": user.id, "role": user.role.value})
    return {"Authorization": f"Bearer {token}"}


def future_deadline(days: int = 14) -> datetime:
    # centralize future aware timestamps required by project and contract schemas
    return datetime.now(timezone.utc) + timedelta(days=days)


def make_project(
    db: Session,
    owner_id: int,
    status: ProjectStatus = ProjectStatus.OPEN,
    title: str = "Build an API",
    budget: Decimal = Decimal("1200.00"),
) -> Project:
    # persist a project directly when a test needs a known lifecycle state
    project = Project(
        owner_id=owner_id,
        title=title,
        description="Create a production-ready FastAPI backend.",
        budget=budget,
        currency="USD",
        deadline=future_deadline(),
        status=status,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def make_proposal(
    db: Session,
    project_id: int,
    freelancer_id: int,
    status: ProposalStatus = ProposalStatus.PENDING,
    price: Decimal = Decimal("900.00"),
) -> Proposal:
    # persist a proposal directly when a service or router test needs setup state
    proposal = Proposal(
        project_id=project_id,
        freelancer_id=freelancer_id,
        proposed_price=price,
        delivery_days=10,
        cover_letter="I can deliver this work cleanly.",
        status=status,
    )
    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    return proposal


def make_contract(
    db: Session,
    project: Project,
    proposal: Proposal,
    status: ContractStatus = ContractStatus.ACTIVE,
) -> Contract:
    # persist a contract for participant and lifecycle action tests
    contract = Contract(
        project_id=project.id,
        proposal_id=proposal.id,
        client_id=project.owner_id,
        freelancer_id=proposal.freelancer_id,
        agreed_price=proposal.proposed_price,
        deadline=project.deadline,
        status=status,
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return contract
