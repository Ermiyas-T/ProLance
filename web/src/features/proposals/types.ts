// Proposal-specific request/response types (shared entity shapes in @/types/entities).

import type { PaginationParams } from "@/lib/pagination";

// GET /proposals query params
export interface ProposalFilters extends PaginationParams {}
