// Proposal-specific request/response types (shared entity shapes in @/types/entities).

import type { PaginationParams } from "@/lib/pagination";

// GET /proposals query params
export interface ProposalFilters extends PaginationParams {}

// POST /proposals body
export interface ProposalCreateRequest {
  project_id: number;
  proposed_price: string;
  delivery_days: number;
  cover_letter: string;
}
