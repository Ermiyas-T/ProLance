from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import require_role
from app.models.project import ProjectStatus
from app.models.user import User, UserRole
from app.schemas.project import (
    ProjectCreate,
    ProjectFilters,
    ProjectListOut,
    ProjectOut,
    ProjectSortBy,
    ProjectUpdate,
)
from app.schemas.proposal import ProposalListOut
from app.services.project_service import (
    InvalidProjectSkillError,
    InvalidProjectStateError,
    ProjectNotFoundError,
    ProjectOwnershipError,
    cancel_project,
    create_project,
    get_project,
    list_projects,
    publish_project,
    update_project,
)
from app.services.proposal_service import (
    ProposalOwnershipError,
    ProjectNotFoundError as ProposalProjectNotFoundError,
    list_proposals_for_project,
)


# expose client project actions and public marketplace discovery under one resource router
router = APIRouter(prefix="/projects", tags=["projects"])


# convert project-domain failures into stable, safe HTTP responses at the API boundary
def _raise_project_http_error(error: Exception) -> None:
    if isinstance(error, ProjectNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if isinstance(error, ProjectOwnershipError):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not the project owner")
    if isinstance(error, InvalidProjectStateError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Project action is not allowed in its current status",
        )
    if isinstance(error, InvalidProjectSkillError):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="One or more skills do not exist")
    raise error


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project_endpoint(
    data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CLIENT)),
):
    try:
        # bind the new draft to the verified client identity, never an input owner ID
        return create_project(db, current_user.id, data)
    except InvalidProjectSkillError as error:
        _raise_project_http_error(error)


@router.get("", response_model=ProjectListOut)
def list_projects_endpoint(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    skill: int | None = Query(default=None, gt=0),
    min_budget: Decimal | None = Query(default=None, gt=Decimal("0.00")),
    max_budget: Decimal | None = Query(default=None, gt=Decimal("0.00")),
    status_filter: ProjectStatus = Query(default=ProjectStatus.OPEN, alias="status"),
    search: str | None = Query(default=None, min_length=1, max_length=200),
    sort_by: ProjectSortBy = Query(default=ProjectSortBy.CREATED_AT),
    db: Session = Depends(get_db),
):
    # prevent public query parameters from exposing client drafts or non-public lifecycle states
    if status_filter != ProjectStatus.OPEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only open projects are publicly visible",
        )
    try:
        # validate coupled filters before building the marketplace query
        filters = ProjectFilters(
            skill=skill,
            min_budget=min_budget,
            max_budget=max_budget,
            status=status_filter,
            search=search,
            sort_by=sort_by,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error))

    # keep response pagination metadata aligned with the exact filtered query
    projects, total = list_projects(db, filters, page, page_size)
    return ProjectListOut(items=projects, total=total, page=page, page_size=page_size)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project_endpoint(project_id: int, db: Session = Depends(get_db)):
    # load project requirements before deciding whether this anonymous request may view them
    project = get_project(db, project_id)
    if project is None or project.status != ProjectStatus.OPEN:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectOut)
def update_project_endpoint(
    project_id: int,
    data: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CLIENT)),
):
    try:
        # service verifies both project ownership and draft-only editability
        return update_project(db, project_id, current_user.id, data)
    except (
        ProjectNotFoundError,
        ProjectOwnershipError,
        InvalidProjectStateError,
        InvalidProjectSkillError,
    ) as error:
        _raise_project_http_error(error)


@router.post("/{project_id}/publish", response_model=ProjectOut)
def publish_project_endpoint(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CLIENT)),
):
    try:
        # expose publication as an explicit state action rather than a writable status field
        return publish_project(db, project_id, current_user.id)
    except (ProjectNotFoundError, ProjectOwnershipError, InvalidProjectStateError) as error:
        _raise_project_http_error(error)


@router.post("/{project_id}/cancel", response_model=ProjectOut)
def cancel_project_endpoint(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CLIENT)),
):
    try:
        # expose cancellation as an explicit state action with service-enforced legal states
        return cancel_project(db, project_id, current_user.id)
    except (ProjectNotFoundError, ProjectOwnershipError, InvalidProjectStateError) as error:
        _raise_project_http_error(error)


@router.get("/{project_id}/proposals", response_model=ProposalListOut)
def list_project_proposals_endpoint(
    project_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CLIENT)),
):
    try:
        # only the project owner can view proposals for their project
        all_proposals = list_proposals_for_project(db, project_id, current_user.id)

        # apply pagination to the results
        total = len(all_proposals)
        start = (page - 1) * page_size
        end = start + page_size
        paginated_proposals = all_proposals[start:end]

        return ProposalListOut(
            items=paginated_proposals, total=total, page=page, page_size=page_size
        )
    except (ProposalProjectNotFoundError, ProposalOwnershipError) as error:
        if isinstance(error, ProposalProjectNotFoundError):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        if isinstance(error, ProposalOwnershipError):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not the project owner")
        raise error
