// Typed fetchers for projects (Architecture.md §3.3).

import { apiFetch } from "@/lib/api-client";
import type { PaginatedResponse } from "@/lib/pagination";
import type { Project } from "@/types/entities";
import type { ProjectCreateRequest, ProjectFilters } from "./types";

// Build query string from filters
function toQueryString(filters: ProjectFilters): string {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.page_size) params.set("page_size", String(filters.page_size));
  if (filters.skill) params.set("skill", String(filters.skill));
  if (filters.min_budget) params.set("min_budget", filters.min_budget);
  if (filters.max_budget) params.set("max_budget", filters.max_budget);
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  if (filters.sort_by) params.set("sort_by", filters.sort_by);
  return params.toString();
}

// GET /projects — list open projects (marketplace)
export function fetchProjects(
  filters: ProjectFilters = {},
): Promise<PaginatedResponse<Project>> {
  const qs = toQueryString(filters);
  return apiFetch<PaginatedResponse<Project>>(`/projects${qs ? `?${qs}` : ""}`);
}

// GET /projects/{id} — single project detail
export function fetchProject(id: number): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}`);
}

// GET /projects/mine — client's own projects (all statuses)
export function fetchClientProjects(
  page = 1,
  page_size = 20,
): Promise<PaginatedResponse<Project>> {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(page_size));
  return apiFetch<PaginatedResponse<Project>>(
    `/projects/mine?${params.toString()}`,
  );
}

// POST /projects — create a new draft project
export function createProject(data: ProjectCreateRequest): Promise<Project> {
  return apiFetch<Project>("/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// POST /projects/{id}/publish — publish a draft to the marketplace
export function publishProject(id: number): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}/publish`, {
    method: "POST",
  });
}
