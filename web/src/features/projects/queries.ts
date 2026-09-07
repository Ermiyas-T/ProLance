// Query keys + queryOptions for projects — one cache contract per entity
// (Architecture.md §3.2).

import { queryOptions } from "@tanstack/react-query";
import { fetchProjects, fetchProject } from "./api";
import type { ProjectFilters } from "./types";

export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  list: (filters: ProjectFilters) => [...projectKeys.lists(), filters] as const,
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
