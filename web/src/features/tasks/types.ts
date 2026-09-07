// Task-specific request/response types (shared entity shapes in @/types/entities).

import type { TaskStatus } from "@/types/entities";

// POST /contracts/{contractId}/tasks body
export interface TaskCreateRequest {
  title: string;
  description?: string;
}

// PUT /tasks/{taskId} body
export interface TaskUpdateRequest {
  title?: string;
  description?: string;
  status?: TaskStatus;
}
