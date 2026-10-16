// Query keys + queryOptions for deliverables — one cache contract per entity
// (Architecture.md §3.2).

import { queryOptions } from "@tanstack/react-query";
import { fetchDeliverables } from "./api";

export const deliverableKeys = {
  all: ["deliverables"] as const,
  lists: () => [...deliverableKeys.all, "list"] as const,
  byContract: (contractId: string) =>
    [...deliverableKeys.lists(), { contractId }] as const,
};

// Fetches deliverables for a specific contract
export const contractDeliverablesOptions = (contractId: string) =>
  queryOptions({
    queryKey: deliverableKeys.byContract(contractId),
    queryFn: () => fetchDeliverables(contractId),
  });
