// Query keys + queryOptions for disputes — one cache contract per entity
// (Architecture.md §3.2).

import { queryOptions } from "@tanstack/react-query";
import { fetchOpenDisputes, fetchDispute } from "./api";

export const disputeKeys = {
  all: ["disputes"] as const,
  lists: () => [...disputeKeys.all, "list"] as const,
  open: () => [...disputeKeys.lists(), "open"] as const,
  details: () => [...disputeKeys.all, "detail"] as const,
  detail: (id: number) => [...disputeKeys.details(), id] as const,
};

// Fetches open disputes for admin queue
export const openDisputesOptions = queryOptions({
  queryKey: disputeKeys.open(),
  queryFn: fetchOpenDisputes,
});

// Fetches a single dispute by ID
export const disputeDetailOptions = (id: number) =>
  queryOptions({
    queryKey: disputeKeys.detail(id),
    queryFn: () => fetchDispute(id),
  });
