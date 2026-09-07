// Query keys + queryOptions for projects — one cache contract per entity
// (Architecture.md §3.2).

import { queryOptions } from "@tanstack/react-query";
import { fetchClientProjects, fetchProjects, fetchProject } from "./api";
import type { ProjectFilters } from "./types";

export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  list: (filters: ProjectFilters) => [...projectKeys.lists(), filters] as const,
  clients: () => [...projectKeys.all, "client"] as const,
  client: (page: number, page_size: number) =>
    [...projectKeys.clients(), { page, page_size }] as const,
  details: () => [...projectKeys.all, "detail"] as const,
  detail: (id: number) => [...projectKeys.details(), id] as const,
};

export const projectListOptions = (filters: ProjectFilters = {}) =>
  queryOptions({
    queryKey: projectKeys.list(filters),
    queryFn: () => fetchProjects(filters),
    placeholderData: (prev) => prev,
  });

export const projectDetailOptions = (id: number) =>
  queryOptions({
    queryKey: projectKeys.detail(id),
    queryFn: () => fetchProject(id),
  });

// Fetches the current client's own projects (all statuses)
export const clientProjectsOptions = (page = 1, page_size = 20) =>
  queryOptions({
    queryKey: projectKeys.client(page, page_size),
    queryFn: () => fetchClientProjects(page, page_size),
  });
