// Project-specific request/response types (shared entity shapes in @/types/entities).

import type { PaginationParams } from "@/lib/pagination";

// GET /projects query filters
export interface ProjectFilters extends PaginationParams {
  skill?: number;
  min_budget?: string;
  max_budget?: string;
  status?: string;
  search?: string;
  sort_by?: "created_at" | "budget" | "deadline";
}
