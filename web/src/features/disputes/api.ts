// Typed fetchers for disputes (Architecture.md §3.3).

import { apiFetch } from "@/lib/api-client";
import type { Dispute } from "@/types/entities";
import type { DisputeCreateRequest, DisputeResolveRequest } from "./types";

// GET /disputes — list open disputes (admin only)
export function fetchOpenDisputes(): Promise<Dispute[]> {
  return apiFetch<Dispute[]>("/disputes");
}

// GET /disputes/{id} — single dispute detail
export function fetchDispute(id: number): Promise<Dispute> {
  return apiFetch<Dispute>(`/disputes/${id}`);
}

// POST /disputes — open a new dispute (contract participant only)
export function createDispute(data: DisputeCreateRequest): Promise<Dispute> {
  return apiFetch<Dispute>("/disputes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// POST /disputes/{id}/start-review — move dispute to UNDER_REVIEW (admin only)
export function startDisputeReview(id: number): Promise<Dispute> {
  return apiFetch<Dispute>(`/disputes/${id}/start-review`, {
    method: "POST",
  });
}

// POST /disputes/{id}/resolve — resolve a dispute (admin only)
export function resolveDispute(
  id: number,
  data: DisputeResolveRequest,
): Promise<Dispute> {
  return apiFetch<Dispute>(`/disputes/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
