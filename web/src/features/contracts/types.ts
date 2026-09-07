// Contract-specific request/response types (shared entity shapes in @/types/entities).

import type { PaginationParams } from "@/lib/pagination";

// GET /contracts query params
export interface ContractFilters extends PaginationParams {}
