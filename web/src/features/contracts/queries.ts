// Query keys + queryOptions for contracts — one cache contract per entity
// (Architecture.md §3.2).

import { queryOptions } from "@tanstack/react-query";
import { fetchContract, fetchContracts } from "./api";

export const contractKeys = {
  all: ["contracts"] as const,
  lists: () => [...contractKeys.all, "list"] as const,
  list: (page: number, page_size: number) =>
    [...contractKeys.lists(), { page, page_size }] as const,
  details: () => [...contractKeys.all, "detail"] as const,
  detail: (id: number) => [...contractKeys.details(), id] as const,
};

// Fetches the current user's contracts (as client or freelancer)
export const contractListOptions = (page = 1, page_size = 20) =>
  queryOptions({
    queryKey: contractKeys.list(page, page_size),
    queryFn: () => fetchContracts(page, page_size),
  });

// Fetches a single contract by ID
export const contractDetailOptions = (id: number) =>
  queryOptions({
    queryKey: contractKeys.detail(id),
    queryFn: () => fetchContract(id),
  });
