from collections.abc import Sequence
from typing import Any

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.profile import Skill
from app.models.project import Project, ProjectStatus
from app.schemas.project import ProjectCreate, ProjectFilters, ProjectSortBy, ProjectUpdate


# keep missing-resource outcomes distinct from failed ownership checks at the HTTP boundary
class ProjectNotFoundError(Exception):
    pass


# prevent authenticated clients from changing projects owned by another client
class ProjectOwnershipError(Exception):
    pass


# expose invalid lifecycle action attempts without allowing arbitrary status assignments
class InvalidProjectStateError(Exception):
    pass


# return client-correctable errors when requested reusable skills do not exist
class InvalidProjectSkillError(Exception):
    pass


# load project skills in one query and reject IDs that do not resolve to stored skills
def _get_skills_or_raise(db: Session, skill_ids: list[int]) -> Sequence[Skill]:
    if not skill_ids:
        return []

    # resolve every requested ID before assigning a project-to-skill association
    skills = db.scalars(select(Skill).where(Skill.id.in_(skill_ids))).all()
    if len(skills) != len(skill_ids):
        raise InvalidProjectSkillError
    return skills


# retrieve a project and eager-load skills for response serialization without N+1 queries
def get_project(db: Session, project_id: int) -> Project | None:
    # select by primary key with its collection ready for ProjectOut serialization
    statement = select(Project).options(selectinload(Project.skills)).where(Project.id == project_id)
    return db.scalar(statement)


# create a private draft owned by the authenticated client account
def create_project(db: Session, owner_id: int, data: ProjectCreate) -> Project:
    # validate all required skills before starting a write transaction
    skills = _get_skills_or_raise(db, data.skill_ids)
    # force the first lifecycle state instead of accepting a caller-controlled status
    project = Project(
        owner_id=owner_id,
        title=data.title,
        description=data.description,
        budget=data.budget,
        currency=data.currency,
        deadline=data.deadline,
        status=ProjectStatus.DRAFT,
        skills=list(skills),
    )
    # persist the project and its skill links together
    db.add(project)
    db.commit()
    db.refresh(project)
    return get_project(db, project.id) or project


# require an existing project to belong to the acting client before a mutation proceeds
def _get_owned_project(db: Session, project_id: int, owner_id: int) -> Project:
    project = get_project(db, project_id)
    if project is None:
        raise ProjectNotFoundError
    if project.owner_id != owner_id:
        raise ProjectOwnershipError
    return project


# update project requirements only while the project is still an unpublished draft
def update_project(db: Session, project_id: int, owner_id: int, data: ProjectUpdate) -> Project:
    # enforce object-level ownership before inspecting the requested changes
    project = _get_owned_project(db, project_id, owner_id)
    if project.status != ProjectStatus.DRAFT:
        raise InvalidProjectStateError

    # retain omitted fields and handle the relationship collection separately
    update_data = data.model_dump(exclude_unset=True)
    if "skill_ids" in update_data:
        skill_ids = update_data.pop("skill_ids")
        project.skills = list(_get_skills_or_raise(db, skill_ids))
    # apply only explicitly supplied scalar fields to the owned draft
    for field, value in update_data.items():
        setattr(project, field, value)

    # atomically save all draft requirement changes and skill replacements
    db.commit()
    db.refresh(project)
    return get_project(db, project.id) or project


# transition an owned draft into the public marketplace exactly once
def publish_project(db: Session, project_id: int, owner_id: int) -> Project:
    # enforce ownership before applying a lifecycle action
    project = _get_owned_project(db, project_id, owner_id)
    if project.status != ProjectStatus.DRAFT:
        raise InvalidProjectStateError

    # publish is the only legal transition from DRAFT in this feature slice
    project.status = ProjectStatus.OPEN
    db.commit()
    db.refresh(project)
    return get_project(db, project.id) or project


# cancel an owned project before a proposal acceptance creates in-progress work
def cancel_project(db: Session, project_id: int, owner_id: int) -> Project:
    # enforce ownership before applying a lifecycle action
    project = _get_owned_project(db, project_id, owner_id)
    if project.status not in {ProjectStatus.DRAFT, ProjectStatus.OPEN}:
        raise InvalidProjectStateError

    # cancellation becomes terminal and prevents future proposal acceptance flows
    project.status = ProjectStatus.CANCELLED
    db.commit()
    db.refresh(project)
    return get_project(db, project.id) or project


# apply shared marketplace filters to project and count queries consistently
def _apply_filters(statement: Select[Any], filters: ProjectFilters) -> Select[Any]:
    # filter by a required skill without joining duplicate project rows
    if filters.skill is not None:
        statement = statement.where(Project.skills.any(Skill.id == filters.skill))
    # include budgets at or above the requested marketplace floor
    if filters.min_budget is not None:
        statement = statement.where(Project.budget >= filters.min_budget)
    # include budgets at or below the requested marketplace ceiling
    if filters.max_budget is not None:
        statement = statement.where(Project.budget <= filters.max_budget)
    # apply the requested project lifecycle filter after public visibility validation
    statement = statement.where(Project.status == filters.status)
    # search visible project requirements by title or description, not private account data
    if filters.search is not None:
        search_term = f"%{filters.search.strip()}%"
        statement = statement.where(
            or_(Project.title.ilike(search_term), Project.description.ilike(search_term))
        )
    return statement


# return a bounded, eagerly loaded marketplace page plus its total matching count
def list_projects(
    db: Session, filters: ProjectFilters, page: int, page_size: int
) -> tuple[list[Project], int]:
    # build the base query once so result and count filters cannot drift apart
    statement = _apply_filters(select(Project), filters)
    count_statement = _apply_filters(select(func.count()).select_from(Project), filters)

    # use documented defaults: newest first, then lowest budget or nearest deadline
    sort_columns = {
        ProjectSortBy.CREATED_AT: Project.created_at.desc(),
        ProjectSortBy.BUDGET: Project.budget.asc(),
        ProjectSortBy.DEADLINE: Project.deadline.asc(),
    }
    statement = statement.order_by(sort_columns[filters.sort_by])
    # eager-load skills in one additional query and cap the database result window
    statement = statement.options(selectinload(Project.skills)).offset((page - 1) * page_size).limit(page_size)

    total = int(db.scalar(count_statement) or 0)
    projects = list(db.scalars(statement).all())
    return projects, total
