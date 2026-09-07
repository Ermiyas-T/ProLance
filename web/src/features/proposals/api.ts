// Typed fetchers for proposals (Architecture.md §3.3).

import { apiFetch } from "@/lib/api-client";
import type { Contract } from "@/types/entities";
import type { PaginatedResponse } from "@/lib/pagination";
import type { Proposal } from "@/types/entities";
import type { ProposalCreateRequest } from "./types";

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

// POST /proposals — create a new proposal (freelancer only)
export function createProposal(data: ProposalCreateRequest): Promise<Proposal> {
  return apiFetch<Proposal>("/proposals", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// POST /proposals/{id}/withdraw — withdraw a pending proposal (not DELETE)
export function withdrawProposal(id: number): Promise<Proposal> {
  return apiFetch<Proposal>(`/proposals/${id}/withdraw`, {
    method: "POST",
  });
}

// POST /proposals/{id}/accept — accept proposal, create contract, reject others
export function acceptProposal(id: number): Promise<Contract> {
  return apiFetch<Contract>(`/proposals/${id}/accept`, {
    method: "POST",
  });
}

// GET /projects/{id}/proposals — list proposals for a project (client only)
export function fetchProjectProposals(
  projectId: number,
  page = 1,
  page_size = 20,
): Promise<PaginatedResponse<Proposal>> {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(page_size));
  return apiFetch<PaginatedResponse<Proposal>>(
    `/projects/${projectId}/proposals?${params.toString()}`,
  );
}
