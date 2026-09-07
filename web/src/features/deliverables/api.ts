// Typed fetchers for deliverables (Architecture.md §3.3).

import { apiFetch } from "@/lib/api-client";
import type { Deliverable } from "@/types/entities";
import type {
  DeliverableRevisionRequest,
  DeliverableSubmitRequest,
} from "./types";

// GET /contracts/{contractId}/deliverables — list deliverables for a contract
export function fetchDeliverables(contractId: number): Promise<Deliverable[]> {
  return apiFetch<Deliverable[]>(`/contracts/${contractId}/deliverables`);
}

// POST /contracts/{contractId}/deliverables — submit a deliverable (freelancer only)
export function submitDeliverable(
  contractId: number,
  data: DeliverableSubmitRequest,
): Promise<Deliverable> {
  return apiFetch<Deliverable>(`/contracts/${contractId}/deliverables`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// POST /deliverables/{id}/approve — approve a deliverable (client only)
export function approveDeliverable(id: number): Promise<Deliverable> {
  return apiFetch<Deliverable>(`/deliverables/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

// POST /deliverables/{id}/request-revision — request revision (client only)
export function requestRevision(
  id: number,
  data: DeliverableRevisionRequest,
): Promise<Deliverable> {
  return apiFetch<Deliverable>(`/deliverables/${id}/request-revision`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
