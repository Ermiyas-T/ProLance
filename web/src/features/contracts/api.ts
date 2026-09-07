// Typed fetchers for contracts (Architecture.md §3.3).

import { apiFetch } from "@/lib/api-client";
import type { Contract } from "@/types/entities";
import type { PaginatedResponse } from "@/lib/pagination";

// GET /contracts — list contracts for current user (client or freelancer)
export function fetchContracts(
  page = 1,
  page_size = 20,
): Promise<PaginatedResponse<Contract>> {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(page_size));
  return apiFetch<PaginatedResponse<Contract>>(
    `/contracts?${params.toString()}`,
  );
}

// GET /contracts/{id} — single contract detail
export function fetchContract(id: number): Promise<Contract> {
  return apiFetch<Contract>(`/contracts/${id}`);
}

// POST /contracts/{id}/complete — mark contract as completed
export function completeContract(id: number): Promise<Contract> {
  return apiFetch<Contract>(`/contracts/${id}/complete`, {
    method: "POST",
  });
}

// POST /contracts/{id}/cancel — cancel contract
export function cancelContract(id: number): Promise<Contract> {
  return apiFetch<Contract>(`/contracts/${id}/cancel`, {
    method: "POST",
  });
}
