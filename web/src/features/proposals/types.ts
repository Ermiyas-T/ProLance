// Proposal-specific request/response types (shared entity shapes in @/types/entities).

import type { PaginationParams } from "@/lib/pagination";

// GET /proposals query params (pagination only — the API has no status filter)
export type ProposalFilters = PaginationParams;

// POST /proposals body
export interface ProposalCreateRequest {
  project_id: string;
  proposed_price: string;
  delivery_days: number;
  cover_letter: string;
}
