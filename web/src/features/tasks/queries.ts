// Query keys + queryOptions for tasks — one cache contract per entity
// (Architecture.md §3.2).

import { queryOptions } from "@tanstack/react-query";
import { fetchTasks } from "./api";

export const taskKeys = {
  all: ["tasks"] as const,
  lists: () => [...taskKeys.all, "list"] as const,
  byContract: (contractId: string) =>
    [...taskKeys.lists(), { contractId }] as const,
};

// Fetches tasks for a specific contract
export const contractTasksOptions = (contractId: string) =>
  queryOptions({
    queryKey: taskKeys.byContract(contractId),
    queryFn: () => fetchTasks(contractId),
  });
