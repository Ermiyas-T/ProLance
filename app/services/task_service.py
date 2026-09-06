import enum
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.contract import Contract, ContractStatus
from app.models.task import Task, TaskStatus


# keep missing-resource outcomes distinct from failed ownership checks at the HTTP boundary
class TaskNotFoundError(Exception):
    pass


# prevent authenticated users from accessing tasks they're not allowed to
class TaskParticipationError(Exception):
    pass


# expose invalid lifecycle action attempts without allowing arbitrary status assignments
class InvalidTaskStateError(Exception):
    pass


# prevent task creation on contracts that are not active
class ContractNotActiveError(Exception):
    pass

# validate allowed task status transitions
_VALID_TRANSITIONS = {
    TaskStatus.TODO: {TaskStatus.IN_PROGRESS},
    TaskStatus.IN_PROGRESS: {TaskStatus.DONE},
    TaskStatus.DONE: set(),  # terminal state, no transitions allowed
}


def get_task(db: Session, task_id: int) -> Task | None:
    """Retrieve a task by primary key."""
    return db.get(Task, task_id)


def _get_task_contract(db: Session, task_id: int) -> Contract:
    """Get the contract that owns this task, raising TaskNotFoundError if missing."""
    task = get_task(db, task_id)
    if task is None:
        raise TaskNotFoundError
    return db.get(Contract, task.contract_id)


def _get_participant_contract(db: Session, contract_id: int, user_id: int) -> Contract:
    """Verify the contract exists and the requester is a participant."""
    contract = db.get(Contract, contract_id)
    if contract is None:
        raise TaskNotFoundError  # contract not found - task's parent is missing
    if contract.client_id != user_id and contract.freelancer_id != user_id:
        raise TaskParticipationError
    return contract


def _validate_status_transition(current_status: TaskStatus, new_status: TaskStatus) -> None:
    """Validate that the status transition follows the allowed lifecycle."""
    allowed_next = _VALID_TRANSITIONS.get(current_status, set())
    if new_status not in allowed_next:
        raise InvalidTaskStateError


class _TaskCreate:
    """Lightweight stand-in so the service has type hints without a schema import loop."""

    title: str
    description: str | None = None


class _TaskUpdate:
    """Lightweight stand-in so the service has type hints without a schema import loop."""

    title: str | None = None
    description: str | None = None
    status: TaskStatus | None = None


def create_task(
    db: Session, contract_id: int, user_id: int, data: _TaskCreate
) -> Task:
    """Create a new task for a contract."""

    # verify contract exists and requester is a participant
    contract = _get_participant_contract(db, contract_id, user_id)

    # verify contract is active - completed/cancelled contracts cannot accept new work
    if contract.status != ContractStatus.ACTIVE:
        raise ContractNotActiveError

    # create the task with current user's inputs
    task = Task(
        contract_id=contract_id,
        title=data.title,
        description=data.description,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def list_tasks_for_contract(db: Session, contract_id: int, user_id: int) -> list[Task]:
    """List all tasks for a contract, verifying requester is a participant."""
    # verify requester is a participant in this contract
    _get_participant_contract(db, contract_id, user_id)

    statement = select(Task).where(Task.contract_id == contract_id).order_by(Task.created_at)
    return list(db.scalars(statement).all())


def update_task(db: Session, task_id: int, user_id: int, data: _TaskUpdate) -> Task:
    """Update a task's title, description, or status."""

    # retrieve the task
    task = get_task(db, task_id)
    if task is None:
        raise TaskNotFoundError

    # verify requester is a participant in the contract this task belongs to
    contract = _get_participant_contract(db, task.contract_id, user_id)

    # apply optional field updates
    if data.title is not None:
        task.title = data.title
    if data.description is not None:
        task.description = data.description

    # validate and apply status transition if provided
    if data.status is not None:
        _validate_status_transition(task.status, data.status)
        task.status = data.status

    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, task_id: int, user_id: int) -> Task:
    """Delete a task, verifying contract is active and requester is a participant."""
    # retrieve the task
    task = get_task(db, task_id)
    if task is None:
        raise TaskNotFoundError

    # verify contract is active - cannot delete tasks from inactive contracts
    contract = _get_participant_contract(db, task.contract_id, user_id)
    if contract.status != ContractStatus.ACTIVE:
        raise ContractNotActiveError

    # verify requester is a participant (already done by _get_participant_contract)
    db.delete(task)
    db.commit()
    return task
