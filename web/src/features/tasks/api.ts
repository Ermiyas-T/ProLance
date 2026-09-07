// Typed fetchers for contract tasks (Architecture.md §3.3).

import { apiFetch } from "@/lib/api-client";
import type { Task } from "@/types/entities";
import type { TaskCreateRequest, TaskUpdateRequest } from "./types";

// GET /contracts/{contractId}/tasks — list tasks for a contract
export function fetchTasks(contractId: number): Promise<Task[]> {
  return apiFetch<Task[]>(`/contracts/${contractId}/tasks`);
}

// POST /contracts/{contractId}/tasks — create a new task
export function createTask(
  contractId: number,
  data: TaskCreateRequest,
): Promise<Task> {
  return apiFetch<Task>(`/contracts/${contractId}/tasks`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// PUT /tasks/{taskId} — update a task (title, description, status)
export function updateTask(
  taskId: number,
  data: TaskUpdateRequest,
): Promise<Task> {
  return apiFetch<Task>(`/tasks/${taskId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// DELETE /tasks/{taskId} — delete a task
export function deleteTask(taskId: number): Promise<void> {
  return apiFetch<void>(`/tasks/${taskId}`, {
    method: "DELETE",
  });
}
