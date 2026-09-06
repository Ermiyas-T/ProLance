from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.contract import ContractStatus
from app.models.user import User
from app.schemas.task import TaskCreate, TaskOut, TaskUpdate
from app.services.task_service import (
    ContractNotActiveError,
    InvalidTaskStateError,
    TaskNotFoundError,
    TaskParticipationError,
    create_task,
    delete_task,
    get_task,
    list_tasks_for_contract,
    update_task,
)

# expose task actions under one resource router
router = APIRouter(tags=["tasks"])


# convert task-domain failures into stable, safe HTTP responses at the API boundary
def _raise_task_http_error(error: Exception) -> None:
    if isinstance(error, TaskNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if isinstance(error, TaskParticipationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant in this contract"
        )
    if isinstance(error, ContractNotActiveError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot modify tasks on a non-active contract",
        )
    if isinstance(error, InvalidTaskStateError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invalid task status transition",
        )
    raise error


@router.post("/contracts/{contract_id}/tasks", response_model=TaskOut)
def create_task_endpoint(
    contract_id: int,
    task_data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return create_task(db, contract_id, current_user.id, task_data)
    except (TaskNotFoundError, TaskParticipationError, ContractNotActiveError) as error:
        _raise_task_http_error(error)


@router.get("/contracts/{contract_id}/tasks", response_model=list[TaskOut])
def list_tasks_endpoint(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return list_tasks_for_contract(db, contract_id, current_user.id)
    except (TaskNotFoundError, TaskParticipationError) as error:
        _raise_task_http_error(error)


@router.get("/tasks/{task_id}", response_model=TaskOut)
def get_task_endpoint(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # retrieve the task
    task = get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    # verify requester is a participant in the contract this task belongs to
    try:
        _ = list_tasks_for_contract(db, task.contract_id, current_user.id)
    except TaskParticipationError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant in this contract"
        )
    except TaskNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    return task


@router.put("/tasks/{task_id}", response_model=TaskOut)
def update_task_endpoint(
    task_id: int,
    task_data: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return update_task(db, task_id, current_user.id, task_data)
    except (
        TaskNotFoundError,
        TaskParticipationError,
        ContractNotActiveError,
        InvalidTaskStateError,
    ) as error:
        _raise_task_http_error(error)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task_endpoint(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        delete_task(db, task_id, current_user.id)
    except (TaskNotFoundError, TaskParticipationError, ContractNotActiveError) as error:
        _raise_task_http_error(error)
