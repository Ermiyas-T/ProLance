// Typed fetchers for proposals (Architecture.md §3.3).

import { apiFetch } from "@/lib/api-client";
import type { PaginatedResponse } from "@/lib/pagination";
import type { Proposal } from "@/types/entities";

// GET /proposals — list own proposals (freelancer's proposals)
export function fetchOwnProposals(
  page = 1,
  page_size = 20,
): Promise<PaginatedResponse<Proposal>> {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(page_size));
  return apiFetch<PaginatedResponse<Proposal>>(
    `/proposals?${params.toString()}`,
  );
}

// GET /proposals/{id} — single proposal detail
export function fetchProposal(id: number): Promise<Proposal> {
  return apiFetch<Proposal>(`/proposals/${id}`);
}
