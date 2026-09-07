// Dispute-specific request/response types (shared entity shapes in @/types/entities).

// POST /disputes body
export interface DisputeCreateRequest {
  contract_id: number;
  title: string;
  description: string;
}

// POST /disputes/{id}/resolve body
export interface DisputeResolveRequest {
  resolution: string;
}
